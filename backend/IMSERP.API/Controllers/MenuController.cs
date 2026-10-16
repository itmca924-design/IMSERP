using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MenuController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;

    public MenuController(IIMSERPDbContext dbContext, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    [HttpGet("my-menu")]
    public async Task<ActionResult<IEnumerable<MenuItemDto>>> GetMyMenu()
    {
        var userId = _currentUser.UserId;
        var tenantId = _currentUser.TenantId;

        // 1. Lightweight projection: fetch only RoleId & RoleName (index seek on Users PK)
        var userRoleInfo = await _dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new 
            { 
                u.RoleId, 
                RoleName = u.AssignedRole != null ? u.AssignedRole.Name : null 
            })
            .FirstOrDefaultAsync();

        // 2. Lightweight projection: fetch only module flags
        var tenantModules = await _dbContext.Tenants
            .AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => new 
            {
                t.HasSchoolModule,
                t.HasCoachingModule,
                t.HasHostelModule,
                t.HasLibraryModule,
                t.HasTransportModule
            })
            .FirstOrDefaultAsync();

        var permissionOnlyRoutes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "/teachers/attendance/ph-sun-edit",
            "/attendance/permissions/mode-settings",
            "/attendance/permissions/manual",
            "/attendance/permissions/biometric",
            "/attendance/permissions/biometric-mapping",
            "/attendance/permissions/correction",
            "/settings/quick/general",
            "/settings/quick/modules",
            "/settings/quick/automation",
            "/settings/quick/appearance",
            "/settings/quick/shortcuts"
        };

        var disabledRoutes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (tenantModules != null)
        {
            if (!tenantModules.HasSchoolModule)
            {
                disabledRoutes.Add("/school/classes");
                disabledRoutes.Add("/school/exams");
                disabledRoutes.Add("/students/promotion");
                disabledRoutes.Add("/fee-heads");
            }
            if (!tenantModules.HasCoachingModule)
            {
                disabledRoutes.Add("/batches");
            }
            if (!tenantModules.HasSchoolModule && !tenantModules.HasCoachingModule)
            {
                disabledRoutes.Add("/tests");
            }
            if (!tenantModules.HasHostelModule)
            {
                disabledRoutes.Add("/hostel");
            }
            if (!tenantModules.HasLibraryModule)
            {
                disabledRoutes.Add("/library/books");
                disabledRoutes.Add("/library/circulation");
                disabledRoutes.Add("/library/plans");
            }
            if (!tenantModules.HasTransportModule)
            {
                disabledRoutes.Add("/transport");
            }
        }

        // 3. Fast index scan on MenuItems using IX_MenuItems_IsActive_SortOrder
        var allActiveMenuItems = await _dbContext.MenuItems
            .AsNoTracking()
            .Where(m => m.IsActive)
            .OrderBy(m => m.SortOrder)
            .ToListAsync();

        // Filter out permission-only routes and module-disabled routes in memory
        var allMenuItems = allActiveMenuItems
            .Where(m => m.RouteUrl == null || (!permissionOnlyRoutes.Contains(m.RouteUrl) && !disabledRoutes.Contains(m.RouteUrl)))
            .ToList();

        HashSet<Guid> allowedMenuIds;

        if (userRoleInfo?.RoleId != null)
        {
            // 4. Index-backed seek on RolePermissions (IX_RolePermissions_RoleId_CanView)
            var permissions = await _dbContext.RolePermissions
                .AsNoTracking()
                .Where(rp => rp.RoleId == userRoleInfo.RoleId.Value && rp.CanView)
                .Select(rp => rp.MenuItemId)
                .ToListAsync();

            allowedMenuIds = new HashSet<Guid>(permissions);

            // Ensure Teacher / Faculty / Admin / Principal roles have access to Tests / Marks Entry and Exams
            var roleNameLower = userRoleInfo.RoleName?.ToLower() ?? "";
            if (roleNameLower.Contains("teacher") || roleNameLower.Contains("faculty") || roleNameLower.Contains("admin") || roleNameLower.Contains("principal"))
            {
                var essentialRoutes = new HashSet<string>(StringComparer.OrdinalIgnoreCase) 
                { 
                    "/tests", 
                    "/school/exams", 
                    "/teachers/lesson-plans", 
                    "/school/homework",
                    "/school/good-manners",
                    "/school/monthly-performance"
                };
                var testMenuIds = allMenuItems
                    .Where(m => m.RouteUrl != null && essentialRoutes.Contains(m.RouteUrl))
                    .Select(m => m.Id);
                foreach (var id in testMenuIds)
                {
                    allowedMenuIds.Add(id);
                }
            }
        }
        else
        {
            allowedMenuIds = new HashSet<Guid>(allMenuItems.Select(m => m.Id));
        }

        var allowedItems = allMenuItems
            .Where(m => allowedMenuIds.Contains(m.Id) || m.ParentId == null && allMenuItems.Any(child => child.ParentId == m.Id && allowedMenuIds.Contains(child.Id)))
            .ToList();

        var topLevelNodes = allowedItems.Where(m => m.ParentId == null).OrderBy(m => m.SortOrder).ToList();

        var result = topLevelNodes.Select(parent => MapMenuItemToDto(parent, allowedItems)).ToList();

        return Ok(result);
    }

    [HttpGet("all")]
    public async Task<ActionResult<IEnumerable<MenuItemDto>>> GetAllMenuItems()
    {
        var allMenuItems = await _dbContext.MenuItems
            .Where(m => m.IsActive)
            .OrderBy(m => m.SortOrder)
            .ToListAsync();

        var topLevelNodes = allMenuItems.Where(m => m.ParentId == null).OrderBy(m => m.SortOrder).ToList();
        var result = topLevelNodes.Select(parent => MapMenuItemToDto(parent, allMenuItems)).ToList();

        return Ok(result);
    }

    private MenuItemDto MapMenuItemToDto(MenuItem item, List<MenuItem> allList)
    {
        var children = allList
            .Where(c => c.ParentId == item.Id)
            .OrderBy(c => c.SortOrder)
            .Select(c => MapMenuItemToDto(c, allList))
            .ToList();

        return new MenuItemDto(
            item.Id,
            item.Title,
            item.RouteUrl,
            item.Icon,
            item.ParentId,
            item.SortOrder,
            item.Module,
            item.IsActive,
            children
        );
    }
}
