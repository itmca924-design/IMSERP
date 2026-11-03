using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Controllers;

namespace IMSERP.API.Services;

[AttributeUsage(AttributeTargets.Method)]
public sealed class SkipMenuPermissionAttribute : Attribute
{
}

public sealed class DynamicMenuPermissionFilter : IAsyncActionFilter
{
    private static readonly IReadOnlyDictionary<string, string> ControllerRoutes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["AdmissionEnquiries"] = "/students/enquiries",
            ["AutomationSettings"] = "/admin/academic-workflow",
            ["BiometricDevices"] = "/attendance/devices",
            ["Branches"] = "/branches",
            ["Chat"] = "/chat",
            ["Dashboard"] = "/dashboard",
            ["Events"] = "/events",
            ["FeeConcessions"] = "/fees/concessions",
            ["FeeRecoveryAgent"] = "/finance/fee-recovery-agent",
            ["Fees"] = "/fees",
            ["FrontDesk"] = "/front-desk/visitors",
            ["Grievances"] = "/front-desk/grievances",
            ["Holidays"] = "/holidays",
            ["Homework"] = "/school/homework",
            ["Hostel"] = "/hostel",
            ["Infirmary"] = "/front-desk/infirmary",
            ["Inventory"] = "/inventory",
            ["Library"] = "/library/books",
            ["Menu"] = "/admin/menu-management",
            ["Notices"] = "/school/notices",
            ["Ptm"] = "/front-desk/ptm",
            ["Presence"] = "/dashboard",
            ["Roles"] = "/roles",
            ["Rooms"] = "/rooms",
            ["School"] = "/school/classes",
            ["StaffPromotions"] = "/teachers/promotions",
            ["StudentDuesAssistant"] = "/fees",
            ["StudentLeaves"] = "/students/leaves",
            ["StudentRegularization"] = "/students/attendance",
            ["Students"] = "/students",
            ["Batches"] = "/batches",
            ["StudyMaterials"] = "/study-materials",
            ["Subjects"] = "/subjects",
            ["Teachers"] = "/teachers",
            ["Tenants"] = "/admin/tenants",
            ["Transport"] = "/transport",
            ["Users"] = "/users",
            ["WhatsApp"] = "/whatsapp",
            ["Tests"] = "/tests",
            ["Finance"] = "/finance/profit-loss",
            ["Attendance"] = "/students/attendance",
            ["Auth"] = "/users"
        };

    private readonly IMenuPermissionService _permissions;
    private readonly ILogger<DynamicMenuPermissionFilter> _logger;

    public DynamicMenuPermissionFilter(
        IMenuPermissionService permissions,
        ILogger<DynamicMenuPermissionFilter> logger)
    {
        _permissions = permissions;
        _logger = logger;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (context.ActionDescriptor is not ControllerActionDescriptor action ||
            context.HttpContext.GetEndpoint()?.Metadata.GetMetadata<IAllowAnonymous>() != null ||
            action.EndpointMetadata.OfType<IAllowAnonymous>().Any() ||
            action.MethodInfo.IsDefined(typeof(SkipMenuPermissionAttribute), inherit: true) ||
            context.HttpContext.User.Identity?.IsAuthenticated != true)
        {
            await next();
            return;
        }

        var route = ResolveMenuRoute(action.ControllerName, action.ActionName, context.HttpContext.Request.Path);
        if (route == null)
        {
            _logger.LogError(
                "No menu permission route is configured for authenticated API action {Controller}.{Action} at {Path}.",
                action.ControllerName,
                action.ActionName,
                context.HttpContext.Request.Path);
            context.Result = new ForbidResult();
            return;
        }

        var operations = ResolveOperations(context.HttpContext.Request.Method, action.ActionName);
        var cancellationToken = context.HttpContext.RequestAborted;
        var permitted = operations.Length == 1
            ? await _permissions.HasPermissionAsync(route, operations[0], cancellationToken)
            : await _permissions.HasAnyPermissionAsync(route, cancellationToken, operations);

        if (!permitted)
        {
            var operationName = operations.Length == 1 ? operations[0].ToString() : "Access";
            context.Result = new ObjectResult(new
            {
                statusCode = StatusCodes.Status403Forbidden,
                error = "Forbidden",
                message = $"You do not have permission to {operationName.ToLower()} records on this page. Please contact your institute administrator.",
                requiredOperation = operationName,
                route = route
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
            return;
        }

        await next();
    }

    private static string? ResolveMenuRoute(string controller, string action, PathString requestPath)
    {
        var path = requestPath.Value ?? string.Empty;
        if (!ControllerRoutes.TryGetValue(controller, out var route))
        {
            return null;
        }

        if (controller.Equals("Menu", StringComparison.OrdinalIgnoreCase))
        {
            return route;
        }

        if (controller.Equals("Events", StringComparison.OrdinalIgnoreCase))
        {
            if (path.Contains("/dashboard-summary", StringComparison.OrdinalIgnoreCase))
            {
                return "/dashboard";
            }
            return route;
        }

        if (controller.Equals("Attendance", StringComparison.OrdinalIgnoreCase))
        {
            if (path.Contains("/biometric", StringComparison.OrdinalIgnoreCase) ||
                path.Contains("/mappings", StringComparison.OrdinalIgnoreCase))
            {
                return "/attendance/devices";
            }
            if (path.Contains("/settings", StringComparison.OrdinalIgnoreCase) ||
                path.Contains("/permissions", StringComparison.OrdinalIgnoreCase))
            {
                return "/attendance/settings";
            }
            return "/students/attendance";
        }

        if (controller.Equals("School", StringComparison.OrdinalIgnoreCase))
        {
            if (path.Contains("/my-exams", StringComparison.OrdinalIgnoreCase)) return "/my-exams";
            if (path.Contains("/exams", StringComparison.OrdinalIgnoreCase) ||
                path.Contains("/exam-settings", StringComparison.OrdinalIgnoreCase)) return "/school/exams";
            if (path.Contains("/promotions", StringComparison.OrdinalIgnoreCase)) return "/students/promotion";
            if (path.Contains("/period-slots", StringComparison.OrdinalIgnoreCase)) return "/school/period-settings";
            return route;
        }

        if (controller.Equals("Finance", StringComparison.OrdinalIgnoreCase))
        {
            if (path.Contains("/profit-loss", StringComparison.OrdinalIgnoreCase)) return "/finance/profit-loss";
            if (path.Contains("/balance-sheet", StringComparison.OrdinalIgnoreCase)) return "/finance/balance-sheet";
            if (path.Contains("/daybook", StringComparison.OrdinalIgnoreCase)) return "/finance/day-book";
            if (path.Contains("/expenses", StringComparison.OrdinalIgnoreCase)) return "/finance/expenses";
            if (path.Contains("/ledgers", StringComparison.OrdinalIgnoreCase)) return "/finance/chart-of-accounts";
            return "/finance/profit-loss";
        }

        if (controller.Equals("FrontDesk", StringComparison.OrdinalIgnoreCase))
        {
            if (path.Contains("/gate-passes/my-profile", StringComparison.OrdinalIgnoreCase))
            {
                return "/students/gate-pass";
            }
            return path.Contains("/gate-passes", StringComparison.OrdinalIgnoreCase)
                ? "/front-desk/gate-passes"
                : "/front-desk/visitors";
        }

        if (controller.Equals("Tenants", StringComparison.OrdinalIgnoreCase) &&
            path.Contains("/my-subscription", StringComparison.OrdinalIgnoreCase))
        {
            return "/subscription";
        }

        if (controller.Equals("Library", StringComparison.OrdinalIgnoreCase))
        {
            if (path.Contains("/circulation", StringComparison.OrdinalIgnoreCase)) return "/library/circulation";
            if (path.Contains("/membership-plans", StringComparison.OrdinalIgnoreCase) ||
                path.Contains("/assign-membership", StringComparison.OrdinalIgnoreCase)) return "/library/plans";
            return "/library/books";
        }

        if (controller.Equals("Inventory", StringComparison.OrdinalIgnoreCase))
        {
            if (path.Contains("/purchase-returns", StringComparison.OrdinalIgnoreCase)) return "/inventory/purchase-returns";
            if (path.Contains("/sale-returns", StringComparison.OrdinalIgnoreCase)) return "/inventory/sale-returns";
            if (path.Contains("/vendors", StringComparison.OrdinalIgnoreCase)) return "/inventory/vendors";
            return "/inventory";
        }

        if (controller.Equals("Fees", StringComparison.OrdinalIgnoreCase))
        {
            if (path.Contains("/my-ledger", StringComparison.OrdinalIgnoreCase)) return "/fees";
            return path.Contains("/heads", StringComparison.OrdinalIgnoreCase)
                ? "/fee-heads"
                : path.Contains("/fee-card", StringComparison.OrdinalIgnoreCase) ? "/fees/fee-card" : "/fees";
        }

        if (controller.Equals("Students", StringComparison.OrdinalIgnoreCase))
        {
            if (path.Contains("/attendance", StringComparison.OrdinalIgnoreCase)) return "/students/attendance";
            if (path.Contains("/leaves", StringComparison.OrdinalIgnoreCase)) return "/students/leaves";
            if (path.Contains("/gate-pass", StringComparison.OrdinalIgnoreCase)) return "/students/gate-pass";
            if (path.Contains("/promotion", StringComparison.OrdinalIgnoreCase)) return "/students/promotion";
            if (action.Equals("GetMyProfile360", StringComparison.OrdinalIgnoreCase)) return "/students/my-profile";
            if (action.Equals("GetMyTimetable", StringComparison.OrdinalIgnoreCase)) return "/students/timetable";
            return "/students";
        }

        if (controller.Equals("Homework", StringComparison.OrdinalIgnoreCase) &&
            action.Equals("GetMyHomework", StringComparison.OrdinalIgnoreCase))
        {
            return "/school/homework";
        }

        if (controller.Equals("Teachers", StringComparison.OrdinalIgnoreCase))
        {
            if (action.Equals("GetMyProfile", StringComparison.OrdinalIgnoreCase) ||
                action.Equals("GetMyTeacherProfile", StringComparison.OrdinalIgnoreCase) ||
                action.Equals("GetMyClassSection", StringComparison.OrdinalIgnoreCase))
            {
                return "/teachers";
            }
            if (path.Contains("/attendance", StringComparison.OrdinalIgnoreCase)) return "/teachers/attendance";
            if (path.Contains("/salary-payments", StringComparison.OrdinalIgnoreCase) ||
                path.Contains("/bulk-salary-payments", StringComparison.OrdinalIgnoreCase)) return "/teachers/payments";
            if (path.Contains("/advances", StringComparison.OrdinalIgnoreCase)) return "/teachers/advances";
            if (path.Contains("/salary", StringComparison.OrdinalIgnoreCase)) return "/teachers/salary";
            if (path.Contains("/leaves", StringComparison.OrdinalIgnoreCase)) return "/teachers/leaves";
            if (path.Contains("/regularizations", StringComparison.OrdinalIgnoreCase)) return "/teachers/attendance";
            if (path.Contains("/fnf", StringComparison.OrdinalIgnoreCase)) return "/teachers/fnf";
            if (path.Contains("/substitutions", StringComparison.OrdinalIgnoreCase)) return "/teachers/substitution";
            if (path.Contains("/lesson-plans", StringComparison.OrdinalIgnoreCase)) return "/teachers/lesson-plans";
            if (path.Contains("/batch-assignments", StringComparison.OrdinalIgnoreCase)) return "/teachers/assignments";
            if (path.Contains("/reports", StringComparison.OrdinalIgnoreCase)) return "/teachers/reports";
            return route;
        }

        return route;
    }

    private static MenuPermissionOperation[] ResolveOperations(string method, string action)
    {
        if (HttpMethods.IsGet(method) || HttpMethods.IsHead(method))
        {
            return [MenuPermissionOperation.View];
        }

        if (HttpMethods.IsDelete(method))
        {
            return [MenuPermissionOperation.Delete];
        }

        if (HttpMethods.IsPut(method) || HttpMethods.IsPatch(method))
        {
            return [MenuPermissionOperation.Edit];
        }

        if (!HttpMethods.IsPost(method))
        {
            return [MenuPermissionOperation.View];
        }

        if (HasAnyToken(action, "Search", "Find", "Lookup", "Preview", "Validate", "Check", "Calculate", "Export", "Download", "Ask", "Query"))
        {
            return [MenuPermissionOperation.View];
        }

        if (HasAnyToken(action, "Update", "Edit", "Toggle", "Approve", "Reject", "Cancel", "Complete", "Close", "Checkout", "Checkin", "Review", "Lock", "Unlock", "Revert", "Reset", "Resolve", "Verify", "Discontinue", "Vacate", "Retry", "Sync"))
        {
            return [MenuPermissionOperation.Edit];
        }

        if (HasAnyToken(action, "Create", "Add", "Upload", "Enroll", "Import", "Generate", "Register", "Collect"))
        {
            return [MenuPermissionOperation.Create];
        }

        return [MenuPermissionOperation.Create, MenuPermissionOperation.Edit];
    }

    private static bool HasAnyToken(string value, params string[] tokens) =>
        tokens.Any(token => value.Contains(token, StringComparison.OrdinalIgnoreCase));
}
