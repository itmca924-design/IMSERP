using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
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
    [IMSERP.API.Services.SkipMenuPermission]
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
                RoleName = u.AssignedRole != null ? u.AssignedRole.Name : null,
                u.Role
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
        var isSuperAdmin = await IsSuperAdminAsync();
        var allActiveMenuItems = await GetVisibleMenuItems(isSuperAdmin)
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
            // Note: Menu access is 100% driven by RolePermissions in DB.
            // No hardcoded role-name checks here — grant/revoke routes via the Roles & Permissions UI instead.
        }
        else
        {
            allowedMenuIds = new HashSet<Guid>();
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
        var isSuperAdmin = await IsSuperAdminAsync();
        var allMenuItems = await GetVisibleMenuItems(isSuperAdmin)
            .Where(m => m.IsActive)
            .OrderBy(m => m.SortOrder)
            .ToListAsync();

        var topLevelNodes = allMenuItems.Where(m => m.ParentId == null).OrderBy(m => m.SortOrder).ToList();
        var result = topLevelNodes.Select(parent => MapMenuItemToDto(parent, allMenuItems)).ToList();

        return Ok(result);
    }

    [HttpGet("manage")]
    public async Task<ActionResult<PagedResultDto<ManagedMenuItemDto>>> GetManagedMenuItems(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? module = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] Guid? parentId = null,
        [FromQuery] string? sortBy = "sortOrder",
        [FromQuery] bool sortDescending = false)
    {
        if (!await HasManagementPermissionAsync(MenuPermission.View))
        {
            return Forbid();
        }
        var isSuperAdmin = await IsSuperAdminAsync();

        pageNumber = Math.Max(1, pageNumber);
        pageSize = Math.Clamp(pageSize, 5, 100);

        var scopedMenuQuery = GetVisibleMenuItems(isSuperAdmin);
        var query = scopedMenuQuery;
        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim();
            query = query.Where(item =>
                item.Title.Contains(term) ||
                (item.RouteUrl != null && item.RouteUrl.Contains(term)) ||
                item.Module.Contains(term) ||
                (item.Icon != null && item.Icon.Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(module))
        {
            query = query.Where(item => item.Module == module);
        }

        if (isActive.HasValue)
        {
            query = query.Where(item => item.IsActive == isActive.Value);
        }

        if (parentId.HasValue)
        {
            query = parentId.Value == Guid.Empty
                ? query.Where(item => item.ParentId == null)
                : query.Where(item => item.ParentId == parentId.Value);
        }

        query = (sortBy?.Trim().ToLowerInvariant(), sortDescending) switch
        {
            ("title", false) => query.OrderBy(item => item.Title).ThenBy(item => item.SortOrder),
            ("title", true) => query.OrderByDescending(item => item.Title).ThenBy(item => item.SortOrder),
            ("routeurl", false) => query.OrderBy(item => item.RouteUrl).ThenBy(item => item.SortOrder),
            ("routeurl", true) => query.OrderByDescending(item => item.RouteUrl).ThenBy(item => item.SortOrder),
            ("module", false) => query.OrderBy(item => item.Module).ThenBy(item => item.SortOrder),
            ("module", true) => query.OrderByDescending(item => item.Module).ThenBy(item => item.SortOrder),
            ("isactive", false) => query.OrderBy(item => item.IsActive).ThenBy(item => item.SortOrder),
            ("isactive", true) => query.OrderByDescending(item => item.IsActive).ThenBy(item => item.SortOrder),
            ("parent", false) => query.OrderBy(item => item.Parent!.Title).ThenBy(item => item.SortOrder),
            ("parent", true) => query.OrderByDescending(item => item.Parent!.Title).ThenBy(item => item.SortOrder),
            ("sortorder", true) => query.OrderByDescending(item => item.SortOrder).ThenBy(item => item.Title),
            _ => query.OrderBy(item => item.SortOrder).ThenBy(item => item.Title)
        };

        var totalCount = await query.CountAsync();
        var pageItems = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(item => new
            {
                item.Id,
                item.Title,
                item.RouteUrl,
                item.Icon,
                item.ParentId,
                ParentTitle = item.Parent != null ? item.Parent.Title : null,
                item.SortOrder,
                item.Module,
                item.IsActive,
                item.TenantId,
                item.BranchId
            })
            .ToListAsync();

        var hierarchy = await scopedMenuQuery
            .Select(item => new { item.Id, item.ParentId })
            .ToDictionaryAsync(item => item.Id, item => item.ParentId);

        var permissions = await GetMenuPermissionsAsync(pageItems.Select(item => item.Id));
        var items = pageItems.Select(item =>
        {
            permissions.TryGetValue(item.Id, out var itemPermission);
            return new ManagedMenuItemDto(
            item.Id,
            item.Title,
            item.RouteUrl,
            item.Icon,
            item.ParentId,
            item.ParentTitle,
            GetMenuLevel(item.ParentId, hierarchy),
            item.SortOrder,
            item.Module,
            item.IsActive,
            item.TenantId,
            item.BranchId,
            IsWithinManageScope(new MenuItem { TenantId = item.TenantId, BranchId = item.BranchId }, isSuperAdmin) &&
                itemPermission?.CanEdit == true,
            IsWithinManageScope(new MenuItem { TenantId = item.TenantId, BranchId = item.BranchId }, isSuperAdmin) &&
                itemPermission?.CanDelete == true);
        }).ToList();

        return Ok(new PagedResultDto<ManagedMenuItemDto>(items, totalCount, pageNumber, pageSize));
    }

    [HttpGet("manage/permissions")]
    public async Task<ActionResult<MenuManagementPermissionsDto>> GetMenuManagementPermissions()
    {
        return Ok(new MenuManagementPermissionsDto(
            await HasManagementPermissionAsync(MenuPermission.Create),
            await HasManagementPermissionAsync(MenuPermission.Edit),
            await HasManagementPermissionAsync(MenuPermission.Delete)));
    }

    [HttpGet("manage/{id:guid}")]
    public async Task<ActionResult<ManagedMenuItemDto>> GetManagedMenuItem(Guid id, CancellationToken cancellationToken)
    {
        if (!await HasManagementPermissionAsync(MenuPermission.Edit))
        {
            return Forbid();
        }

        var isSuperAdmin = await IsSuperAdminAsync();
        var item = await GetVisibleMenuItems(isSuperAdmin)
            .FirstOrDefaultAsync(menu => menu.Id == id, cancellationToken);
        if (item == null)
        {
            return NotFound(new { message = "Menu item was not found." });
        }
        if (!await HasMenuPermissionAsync(id, MenuPermission.Edit))
        {
            return Forbid();
        }

        var managedItem = await MapManagedMenuItemAsync(id, cancellationToken);
        return managedItem == null ? NotFound(new { message = "Menu item was not found." }) : Ok(managedItem);
    }

    [HttpGet("manage/options")]
    public async Task<ActionResult<IEnumerable<ManagedMenuOptionDto>>> GetMenuOptions()
    {
        if (!await HasManagementPermissionAsync(MenuPermission.View))
        {
            return Forbid();
        }
        var isSuperAdmin = await IsSuperAdminAsync();

        var items = await GetVisibleMenuItems(isSuperAdmin)
            .OrderBy(item => item.SortOrder)
            .ThenBy(item => item.Title)
            .Select(item => new ManagedMenuOptionDto(item.Id, item.Title, item.ParentId, item.Module, item.IsActive,
                isSuperAdmin || !item.TenantId.HasValue || item.TenantId == _currentUser.TenantId))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("manage")]
    public async Task<ActionResult<ManagedMenuItemDto>> CreateMenuItem([FromBody] SaveMenuItemRequest request)
    {
        if (!await HasManagementPermissionAsync(MenuPermission.Create))
        {
            return Forbid();
        }

        var isSuperAdmin = await IsSuperAdminAsync();
        var validation = await ValidateMenuRequestAsync(request, isSuperAdmin: isSuperAdmin);
        if (validation != null)
        {
            return BadRequest(new { message = validation });
        }

        var item = new MenuItem
        {
            Title = request.Title.Trim(),
            RouteUrl = NormalizeOptional(request.RouteUrl),
            Icon = NormalizeOptional(request.Icon),
            ParentId = request.ParentId,
            SortOrder = request.SortOrder,
            Module = request.Module.Trim(),
            IsActive = request.IsActive,
            TenantId = isSuperAdmin ? null : _currentUser.TenantId,
            BranchId = isSuperAdmin ? null : _currentUser.BranchId
        };

        _dbContext.MenuItems.Add(item);
        await _dbContext.SaveChangesAsync();
        await GrantCreatorMenuPermissionAsync(item.Id);
        return CreatedAtAction(nameof(GetManagedMenuItems), new { }, await MapManagedMenuItemAsync(item.Id));
    }

    [HttpPut("manage/{id:guid}")]
    public async Task<ActionResult<ManagedMenuItemDto>> UpdateMenuItem(Guid id, [FromBody] SaveMenuItemRequest request)
    {
        if (!await HasManagementPermissionAsync(MenuPermission.Edit))
        {
            return Forbid();
        }

        var isSuperAdmin = await IsSuperAdminAsync();
        var item = await _dbContext.MenuItems.FirstOrDefaultAsync(menu => menu.Id == id);
        if (item == null)
        {
            return NotFound(new { message = "Menu item was not found." });
        }
        if (!IsWithinManageScope(item, isSuperAdmin) ||
            !await HasMenuPermissionAsync(item.Id, MenuPermission.Edit))
        {
            return Forbid();
        }

        var validation = await ValidateMenuRequestAsync(request, id, isSuperAdmin);
        if (validation != null)
        {
            return BadRequest(new { message = validation });
        }

        item.Title = request.Title.Trim();
        item.RouteUrl = NormalizeOptional(request.RouteUrl);
        item.Icon = NormalizeOptional(request.Icon);
        item.ParentId = request.ParentId;
        item.SortOrder = request.SortOrder;
        item.Module = request.Module.Trim();
        item.IsActive = request.IsActive;

        await _dbContext.SaveChangesAsync();
        return Ok(await MapManagedMenuItemAsync(item.Id));
    }

    [HttpDelete("manage/{id:guid}")]
    public async Task<IActionResult> DeactivateMenuItem(Guid id)
    {
        if (!await HasManagementPermissionAsync(MenuPermission.Delete))
        {
            return Forbid();
        }

        var isSuperAdmin = await IsSuperAdminAsync();
        var item = await _dbContext.MenuItems.FirstOrDefaultAsync(menu => menu.Id == id);
        if (item == null)
        {
            return NotFound(new { message = "Menu item was not found." });
        }
        if (!IsWithinManageScope(item, isSuperAdmin) ||
            !await HasMenuPermissionAsync(item.Id, MenuPermission.Delete))
        {
            return Forbid();
        }

        if (await HasActiveDescendantsAsync(id))
        {
            return BadRequest(new { message = "Move or deactivate active descendant menu items before deactivating this parent." });
        }

        item.IsActive = false;
        await _dbContext.SaveChangesAsync();
        return NoContent();
    }

    private async Task<string?> ValidateMenuRequestAsync(
        SaveMenuItemRequest request,
        Guid? itemId = null,
        bool isSuperAdmin = false)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length > 120)
        {
            return "Title is required and must be 120 characters or fewer.";
        }

        if (request.RouteUrl?.Trim().Length > 300)
        {
            return "Route URL must be 300 characters or fewer.";
        }

        if (request.Icon?.Trim().Length > 60)
        {
            return "Icon must be 60 characters or fewer.";
        }

        if (string.IsNullOrWhiteSpace(request.Module) || request.Module.Trim().Length > 80)
        {
            return "Module is required and must be 80 characters or fewer.";
        }

        if (!request.ParentId.HasValue)
        {
            return null;
        }

        var parent = await _dbContext.MenuItems.AsNoTracking()
            .FirstOrDefaultAsync(menu => menu.Id == request.ParentId.Value);
        if (parent == null)
        {
            return "Selected parent menu item does not exist.";
        }
        var targetBranchId = itemId.HasValue
            ? await _dbContext.MenuItems.AsNoTracking()
                .Where(menu => menu.Id == itemId.Value)
                .Select(menu => menu.BranchId)
                .FirstOrDefaultAsync()
            : _currentUser.BranchId;
        if (!isSuperAdmin &&
            (parent.TenantId.HasValue && parent.TenantId.Value != _currentUser.TenantId ||
             parent.BranchId.HasValue && parent.BranchId != targetBranchId))
        {
            return "The selected parent menu is outside your tenant or branch scope.";
        }

        if (!parent.IsActive && request.IsActive)
        {
            return "An active menu item must have an active parent.";
        }

        if (!itemId.HasValue)
        {
            return null;
        }

        if (itemId.Value == request.ParentId.Value)
        {
            return "A menu item cannot be its own parent.";
        }

        var descendants = new HashSet<Guid> { itemId.Value };
        var frontier = new List<Guid> { itemId.Value };
        while (frontier.Count > 0)
        {
            var children = await _dbContext.MenuItems.AsNoTracking()
                .Where(menu => menu.ParentId.HasValue && frontier.Contains(menu.ParentId.Value))
                .Select(menu => menu.Id)
                .ToListAsync();
            frontier = children.Where(descendants.Add).ToList();
        }

        return descendants.Contains(request.ParentId.Value)
            ? "A menu item cannot be moved under one of its descendants."
            : null;
    }

    private async Task GrantCreatorMenuPermissionAsync(Guid menuItemId)
    {
        var roleId = await GetCurrentRoleIdAsync();
        if (!roleId.HasValue)
        {
            return;
        }

        var permission = await _dbContext.RolePermissions
            .FirstOrDefaultAsync(entry => entry.RoleId == roleId.Value && entry.MenuItemId == menuItemId);
        if (permission == null)
        {
            _dbContext.RolePermissions.Add(new RolePermission
            {
                RoleId = roleId.Value,
                MenuItemId = menuItemId,
                CanView = true,
                CanCreate = true,
                CanEdit = true,
                CanDelete = true
            });
        }
        else
        {
            permission.CanView = true;
            permission.CanCreate = true;
            permission.CanEdit = true;
            permission.CanDelete = true;
        }
        await _dbContext.SaveChangesAsync();
    }

    private async Task<bool> HasActiveDescendantsAsync(Guid parentId)
    {
        var frontier = new List<Guid> { parentId };
        var visited = new HashSet<Guid> { parentId };
        while (frontier.Count > 0)
        {
            var children = await _dbContext.MenuItems.AsNoTracking()
                .Where(menu => menu.ParentId.HasValue && frontier.Contains(menu.ParentId.Value))
                .Select(menu => new { menu.Id, menu.IsActive })
                .ToListAsync();
            if (children.Any(child => child.IsActive))
            {
                return true;
            }

            frontier = children.Select(child => child.Id).Where(visited.Add).ToList();
        }

        return false;
    }

    private async Task<ManagedMenuItemDto?> MapManagedMenuItemAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var item = await _dbContext.MenuItems.AsNoTracking()
            .Where(menu => menu.Id == id)
            .Select(menu => new
            {
                menu.Id,
                menu.Title,
                menu.RouteUrl,
                menu.Icon,
                menu.ParentId,
                ParentTitle = menu.Parent != null ? menu.Parent.Title : null,
                menu.SortOrder,
                menu.Module,
                menu.IsActive,
                menu.TenantId,
                menu.BranchId
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (item == null)
        {
            return null;
        }

        var level = 0;
        var parentId = item.ParentId;
        var visited = new HashSet<Guid>();
        while (parentId.HasValue && visited.Add(parentId.Value))
        {
            level++;
            parentId = await _dbContext.MenuItems.AsNoTracking()
                .Where(menu => menu.Id == parentId.Value)
                .Select(menu => menu.ParentId)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var permissions = await GetMenuPermissionsAsync([item.Id]);
        permissions.TryGetValue(item.Id, out var itemPermission);
        var canManageScope = IsWithinManageScope(
            new MenuItem { TenantId = item.TenantId, BranchId = item.BranchId },
            await IsSuperAdminAsync());

        return new ManagedMenuItemDto(
            item.Id, item.Title, item.RouteUrl, item.Icon, item.ParentId,
            item.ParentTitle, level, item.SortOrder, item.Module, item.IsActive,
            item.TenantId, item.BranchId,
            canManageScope && itemPermission?.CanEdit == true,
            canManageScope && itemPermission?.CanDelete == true);
    }

    private IQueryable<MenuItem> GetVisibleMenuItems(bool isSuperAdmin)
    {
        var query = _dbContext.MenuItems.AsNoTracking();
        if (isSuperAdmin)
        {
            return query;
        }

        var tenantId = _currentUser.TenantId;
        var branchId = _currentUser.BranchId;
        return query.Where(item =>
            (!item.TenantId.HasValue || item.TenantId == tenantId) &&
            (!item.BranchId.HasValue || !branchId.HasValue || item.BranchId == branchId));
    }

    private bool IsWithinManageScope(MenuItem item, bool isSuperAdmin) =>
        isSuperAdmin ||
        (!item.TenantId.HasValue || item.TenantId == _currentUser.TenantId) &&
        (!item.BranchId.HasValue || !_currentUser.BranchId.HasValue || item.BranchId == _currentUser.BranchId);

    private async Task<bool> HasManagementPermissionAsync(MenuPermission permission)
    {
        var isSuperAdmin = await IsSuperAdminAsync();
        var roleId = await GetCurrentRoleIdAsync();
        if (!roleId.HasValue)
        {
            return false;
        }

        var managementMenuIds = await GetVisibleMenuItems(isSuperAdmin)
            .Where(item => item.RouteUrl == "/admin/menu-management")
            .Select(item => item.Id)
            .ToListAsync();
        if (managementMenuIds.Count == 0)
        {
            return false;
        }

        var grants = await _dbContext.RolePermissions.AsNoTracking()
            .Where(entry => entry.RoleId == roleId.Value && managementMenuIds.Contains(entry.MenuItemId))
            .Select(entry => new { entry.CanView, entry.CanCreate, entry.CanEdit, entry.CanDelete })
            .ToListAsync();

        return grants.Any(grant => permission switch
        {
            MenuPermission.View => grant.CanView,
            MenuPermission.Create => grant.CanCreate,
            MenuPermission.Edit => grant.CanEdit,
            MenuPermission.Delete => grant.CanDelete,
            _ => false
        });
    }

    private async Task<bool> HasMenuPermissionAsync(Guid menuItemId, MenuPermission permission)
    {
        var roleId = await GetCurrentRoleIdAsync();
        if (!roleId.HasValue)
        {
            return false;
        }

        var granted = await _dbContext.RolePermissions.AsNoTracking()
            .Where(entry => entry.RoleId == roleId.Value && entry.MenuItemId == menuItemId)
            .Select(entry => new { entry.CanView, entry.CanCreate, entry.CanEdit, entry.CanDelete })
            .FirstOrDefaultAsync();
        return granted != null && (permission switch
        {
            MenuPermission.View => granted.CanView,
            MenuPermission.Create => granted.CanCreate,
            MenuPermission.Edit => granted.CanEdit,
            MenuPermission.Delete => granted.CanDelete,
            _ => false
        });
    }

    private async Task<Guid?> GetCurrentRoleIdAsync() =>
        await _dbContext.Users.AsNoTracking()
            .Where(user => user.Id == _currentUser.UserId)
            .Select(user => user.RoleId)
            .FirstOrDefaultAsync();

    private async Task<Dictionary<Guid, MenuPermissionSnapshot>> GetMenuPermissionsAsync(IEnumerable<Guid> menuIds)
    {
        var roleId = await GetCurrentRoleIdAsync();
        if (!roleId.HasValue)
        {
            return new Dictionary<Guid, MenuPermissionSnapshot>();
        }

        var ids = menuIds.ToArray();
        return await _dbContext.RolePermissions.AsNoTracking()
            .Where(entry => entry.RoleId == roleId.Value && ids.Contains(entry.MenuItemId))
            .ToDictionaryAsync(entry => entry.MenuItemId, entry => new MenuPermissionSnapshot(
                entry.CanView, entry.CanCreate, entry.CanEdit, entry.CanDelete));
    }

    private async Task<bool> IsSuperAdminAsync()
    {
        var role = await _dbContext.Users.AsNoTracking()
            .Where(user => user.Id == _currentUser.UserId)
            .Select(user => user.Role)
            .FirstOrDefaultAsync();
        return role == UserRole.SuperAdmin ||
               string.Equals(_currentUser.UserRole, "SuperAdmin", StringComparison.OrdinalIgnoreCase);
    }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static int GetMenuLevel(Guid? parentId, IReadOnlyDictionary<Guid, Guid?> hierarchy)
    {
        var level = 0;
        var visited = new HashSet<Guid>();
        while (parentId.HasValue && visited.Add(parentId.Value) &&
               hierarchy.TryGetValue(parentId.Value, out var nextParentId))
        {
            level++;
            parentId = nextParentId;
        }

        return level;
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

public sealed record SaveMenuItemRequest(
    string Title,
    string? RouteUrl,
    string? Icon,
    Guid? ParentId,
    int SortOrder,
    string Module,
    bool IsActive);

public sealed record ManagedMenuItemDto(
    Guid Id,
    string Title,
    string? RouteUrl,
    string? Icon,
    Guid? ParentId,
    string? ParentTitle,
    int Level,
    int SortOrder,
    string Module,
    bool IsActive,
    Guid? TenantId,
    Guid? BranchId,
    bool CanEdit,
    bool CanDelete);

public sealed record MenuManagementPermissionsDto(bool CanCreate, bool CanEdit, bool CanDelete);

public sealed record ManagedMenuOptionDto(
    Guid Id,
    string Title,
    Guid? ParentId,
    string Module,
    bool IsActive,
    bool CanManage);

internal enum MenuPermission
{
    View,
    Create,
    Edit,
    Delete
}

internal sealed record MenuPermissionSnapshot(bool CanView, bool CanCreate, bool CanEdit, bool CanDelete);
