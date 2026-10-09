using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RolesController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;
    private readonly ILogger<RolesController> _logger;

    public RolesController(
        IIMSERPDbContext dbContext,
        ICurrentUserService currentUser,
        ILogger<RolesController> logger)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<RoleDto>>> GetRoles([FromQuery] Guid? tenantId = null)
    {
        try
        {
            var isSuperAdmin = string.Equals(_currentUser.UserRole, "SuperAdmin", StringComparison.OrdinalIgnoreCase);

            IQueryable<RoleEntity> rolesQuery = _dbContext.Roles;
            if (isSuperAdmin && tenantId.HasValue && tenantId.Value != Guid.Empty)
            {
                rolesQuery = _dbContext.Roles.IgnoreQueryFilters().Where(r => r.TenantId == tenantId.Value);
            }

            var roles = await rolesQuery
                .AsNoTracking()
                .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.MenuItem)
                .OrderBy(r => r.Name)
                .ToListAsync();

            var usersQuery = isSuperAdmin && tenantId.HasValue && tenantId.Value != Guid.Empty
                ? _dbContext.Users.IgnoreQueryFilters().Where(u => u.TenantId == tenantId.Value)
                : _dbContext.Users;

            var userCounts = await usersQuery
                .AsNoTracking()
                .Where(u => u.RoleId != null)
                .GroupBy(u => u.RoleId!.Value)
                .Select(g => new { RoleId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.RoleId, x => x.Count);

            var result = roles.Select(r => new RoleDto(
                r.Id,
                r.Name,
                r.Description,
                r.IsActive,
                userCounts.TryGetValue(r.Id, out var count) ? count : 0,
                r.RolePermissions.Select(rp => new RolePermissionDto(
                    rp.Id,
                    rp.RoleId,
                    rp.MenuItemId,
                    rp.MenuItem?.Title ?? "",
                    rp.MenuItem?.RouteUrl,
                    rp.MenuItem?.Icon,
                    rp.MenuItem?.Module ?? "Master",
                    rp.CanView,
                    rp.CanCreate,
                    rp.CanEdit,
                    rp.CanDelete
                )).ToList()
            ));

            return Ok(result);
        }
        catch (SqlException sqlEx)
        {
            _logger.LogError(sqlEx, "SQL Server timeout or connectivity error in GetRoles");
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Database server is currently busy or the query timed out. Please retry." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error in GetRoles");
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Failed to load roles. Please try again." });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<RoleDto>> GetRoleById(Guid id)
    {
        try
        {
            var role = await _dbContext.Roles
                .AsNoTracking()
                .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.MenuItem)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (role == null) return NotFound(new { message = $"Role with ID '{id}' was not found." });

            var userCount = await _dbContext.Users
                .AsNoTracking()
                .CountAsync(u => u.RoleId == id);

            var allMenuItems = await _dbContext.MenuItems
                .AsNoTracking()
                .Where(m => m.IsActive)
                .OrderBy(m => m.SortOrder)
                .ToListAsync();

            var permissionsMap = role.RolePermissions
                .Where(rp => rp.MenuItemId != Guid.Empty)
                .GroupBy(rp => rp.MenuItemId)
                .ToDictionary(g => g.Key, g => g.First());

            var permissionDtos = allMenuItems.Select(m => {
                if (permissionsMap.TryGetValue(m.Id, out var existing))
                {
                    return new RolePermissionDto(
                        existing.Id,
                        role.Id,
                        m.Id,
                        m.Title,
                        m.RouteUrl,
                        m.Icon,
                        m.Module,
                        existing.CanView,
                        existing.CanCreate,
                        existing.CanEdit,
                        existing.CanDelete
                    );
                }
                return new RolePermissionDto(
                    Guid.Empty,
                    role.Id,
                    m.Id,
                    m.Title,
                    m.RouteUrl,
                    m.Icon,
                    m.Module,
                    false, false, false, false
                );
            }).ToList();

            return Ok(new RoleDto(
                role.Id,
                role.Name,
                role.Description,
                role.IsActive,
                userCount,
                permissionDtos
            ));
        }
        catch (SqlException sqlEx)
        {
            _logger.LogError(sqlEx, "SQL Server timeout or connectivity error in GetRoleById for RoleId: {RoleId}", id);
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Database server is currently busy or the query timed out. Please retry." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error in GetRoleById for RoleId: {RoleId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Failed to load role details. Please try again." });
        }
    }

    [HttpPost]
    public async Task<ActionResult<RoleDto>> CreateRole([FromBody] CreateRoleDto dto)
    {
        try
        {
            var isSuperAdmin = string.Equals(_currentUser.UserRole, "SuperAdmin", StringComparison.OrdinalIgnoreCase);
            var targetTenantId = (isSuperAdmin && dto.TenantId.HasValue && dto.TenantId.Value != Guid.Empty)
                ? dto.TenantId.Value
                : _currentUser.TenantId;

            var role = new RoleEntity
            {
                TenantId = targetTenantId,
                Name = dto.Name,
                Description = dto.Description,
                IsActive = dto.IsActive
            };

            _dbContext.Roles.Add(role);

            var allMenuItems = await _dbContext.MenuItems.AsNoTracking().Where(m => m.IsActive).ToListAsync();
            var menuItemsMap = allMenuItems.ToDictionary(m => m.Id);

            bool hasAttendanceCreate = dto.Permissions != null && dto.Permissions.Any(p =>
                (p.CanCreate || p.CanEdit) &&
                menuItemsMap.TryGetValue(p.MenuItemId, out var m) &&
                (m.RouteUrl == "/teachers/attendance" || m.RouteUrl == "/students/attendance"));

            bool hasAttendanceEdit = dto.Permissions != null && dto.Permissions.Any(p =>
                p.CanEdit &&
                menuItemsMap.TryGetValue(p.MenuItemId, out var m) &&
                (m.RouteUrl == "/teachers/attendance" || m.RouteUrl == "/students/attendance"));

            foreach (var menu in allMenuItems)
            {
                var pDto = dto.Permissions?.FirstOrDefault(p => p.MenuItemId == menu.Id);
                var isAttendancePermission = menu.RouteUrl?.StartsWith("/attendance/permissions/", StringComparison.OrdinalIgnoreCase) == true;
                var isManual = menu.RouteUrl == "/attendance/permissions/manual";
                var isCorrection = menu.RouteUrl == "/attendance/permissions/correction";

                role.RolePermissions.Add(new RolePermission
                {
                    RoleId = role.Id,
                    MenuItemId = menu.Id,
                    CanView = pDto?.CanView ?? ((isManual && hasAttendanceCreate) || (isCorrection && hasAttendanceEdit) || !isAttendancePermission),
                    CanCreate = pDto?.CanCreate ?? ((isManual && hasAttendanceCreate) || !isAttendancePermission),
                    CanEdit = pDto?.CanEdit ?? ((isCorrection && hasAttendanceEdit) || !isAttendancePermission),
                    CanDelete = pDto?.CanDelete ?? !isAttendancePermission
                });
            }

            await _dbContext.SaveChangesAsync();

            return Ok(new RoleDto(
                role.Id,
                role.Name,
                role.Description,
                role.IsActive,
                0,
                role.RolePermissions.Select(rp => new RolePermissionDto(
                    rp.Id, rp.RoleId, rp.MenuItemId, "", null, null, "Master", rp.CanView, rp.CanCreate, rp.CanEdit, rp.CanDelete
                )).ToList()
            ));
        }
        catch (SqlException sqlEx)
        {
            _logger.LogError(sqlEx, "SQL Server timeout or connectivity error in CreateRole");
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Database server is currently busy. Please retry." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error in CreateRole");
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Failed to create role. Please try again." });
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<RoleDto>> UpdateRole(Guid id, [FromBody] CreateRoleDto dto)
    {
        try
        {
            var role = await _dbContext.Roles.FirstOrDefaultAsync(r => r.Id == id);
            if (role == null) return NotFound(new { message = $"Role with ID '{id}' was not found." });

            role.Name = dto.Name;
            role.Description = dto.Description;
            role.IsActive = dto.IsActive;

            // Cleanly remove existing permissions for this role
            var existingPerms = await _dbContext.RolePermissions.Where(rp => rp.RoleId == id).ToListAsync();
            if (existingPerms.Count > 0)
            {
                _dbContext.RolePermissions.RemoveRange(existingPerms);
            }

            if (dto.Permissions != null && dto.Permissions.Count > 0)
            {
                var menuItemsMap = await _dbContext.MenuItems.AsNoTracking().ToDictionaryAsync(m => m.Id);
                bool hasAttendanceCreate = dto.Permissions.Any(p =>
                    (p.CanCreate || p.CanEdit) &&
                    menuItemsMap.TryGetValue(p.MenuItemId, out var m) &&
                    (m.RouteUrl == "/teachers/attendance" || m.RouteUrl == "/students/attendance"));

                bool hasAttendanceEdit = dto.Permissions.Any(p =>
                    p.CanEdit &&
                    menuItemsMap.TryGetValue(p.MenuItemId, out var m) &&
                    (m.RouteUrl == "/teachers/attendance" || m.RouteUrl == "/students/attendance"));

                foreach (var permDto in dto.Permissions)
                {
                    var isManual = menuItemsMap.TryGetValue(permDto.MenuItemId, out var m) && m.RouteUrl == "/attendance/permissions/manual";
                    var isCorrection = menuItemsMap.TryGetValue(permDto.MenuItemId, out var mc) && mc.RouteUrl == "/attendance/permissions/correction";

                    _dbContext.RolePermissions.Add(new RolePermission
                    {
                        RoleId = role.Id,
                        MenuItemId = permDto.MenuItemId,
                        CanView = permDto.CanView || (isManual && hasAttendanceCreate) || (isCorrection && hasAttendanceEdit),
                        CanCreate = permDto.CanCreate || (isManual && hasAttendanceCreate),
                        CanEdit = permDto.CanEdit || (isCorrection && hasAttendanceEdit),
                        CanDelete = permDto.CanDelete
                    });
                }
            }

            await _dbContext.SaveChangesAsync();

            return Ok(new RoleDto(role.Id, role.Name, role.Description, role.IsActive, 0, new List<RolePermissionDto>()));
        }
        catch (SqlException sqlEx)
        {
            _logger.LogError(sqlEx, "SQL Server timeout or connectivity error in UpdateRole for RoleId: {RoleId}", id);
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Database server is currently busy. Please retry." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error in UpdateRole for RoleId: {RoleId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Failed to update role. Please try again." });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRole(Guid id)
    {
        try
        {
            var role = await _dbContext.Roles.FindAsync(id);
            if (role == null) return NotFound(new { message = $"Role with ID '{id}' was not found." });

            var isAssigned = await _dbContext.Users.AsNoTracking().AnyAsync(u => u.RoleId == id);
            if (isAssigned)
            {
                return BadRequest(new { message = "Cannot delete role assigned to active users." });
            }

            _dbContext.Roles.Remove(role);
            await _dbContext.SaveChangesAsync();

            return NoContent();
        }
        catch (SqlException sqlEx)
        {
            _logger.LogError(sqlEx, "SQL Server timeout or connectivity error in DeleteRole for RoleId: {RoleId}", id);
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Database server is currently busy. Please retry." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error in DeleteRole for RoleId: {RoleId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Failed to delete role. Please try again." });
        }
    }

    [HttpGet("my-permissions")]
    public async Task<ActionResult<Dictionary<string, UserPermissionSummaryDto>>> GetMyPermissions()
    {
        try
        {
            var isSuperAdmin = string.Equals(_currentUser.UserRole, "SuperAdmin", StringComparison.OrdinalIgnoreCase);

            if (isSuperAdmin)
            {
                var allItems = await _dbContext.MenuItems.AsNoTracking().Where(m => m.IsActive).ToListAsync();
                var fullDict = allItems
                    .Where(m => !string.IsNullOrEmpty(m.RouteUrl))
                    .ToDictionary(
                        m => m.RouteUrl!,
                        m => new UserPermissionSummaryDto(true, true, true, true),
                        StringComparer.OrdinalIgnoreCase
                    );
                return Ok(fullDict);
            }

            var user = await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);

            if (user?.RoleId == null)
            {
                var isInstituteAdmin = string.Equals(_currentUser.UserRole, "InstituteAdmin", StringComparison.OrdinalIgnoreCase) ||
                                       _currentUser.UserRole.Contains("Admin", StringComparison.OrdinalIgnoreCase);
                if (isInstituteAdmin)
                {
                    var allItems = await _dbContext.MenuItems.AsNoTracking().Where(m => m.IsActive).ToListAsync();
                    var adminDict = allItems
                        .Where(m => !string.IsNullOrEmpty(m.RouteUrl))
                        .ToDictionary(
                            m => m.RouteUrl!,
                            m => new UserPermissionSummaryDto(true, true, true, true),
                            StringComparer.OrdinalIgnoreCase
                        );
                    return Ok(adminDict);
                }

                return Ok(new Dictionary<string, UserPermissionSummaryDto>(StringComparer.OrdinalIgnoreCase));
            }

            var permissions = await _dbContext.RolePermissions
                .AsNoTracking()
                .Include(rp => rp.MenuItem)
                .Where(rp => rp.RoleId == user.RoleId && rp.MenuItem != null && !string.IsNullOrEmpty(rp.MenuItem.RouteUrl))
                .ToListAsync();

            var dict = permissions
                .GroupBy(p => p.MenuItem!.RouteUrl!)
                .ToDictionary(
                    g => g.Key,
                    g => new UserPermissionSummaryDto(
                        g.Any(p => p.CanView),
                        g.Any(p => p.CanCreate),
                        g.Any(p => p.CanEdit),
                        g.Any(p => p.CanDelete)
                    ),
                    StringComparer.OrdinalIgnoreCase
                );

            return Ok(dict);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching user permissions");
            return StatusCode(500, new { message = "Failed to load permissions" });
        }
    }
}
