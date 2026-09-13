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
public class RolesController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;

    public RolesController(IIMSERPDbContext dbContext, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<RoleDto>>> GetRoles()
    {
        var roles = await _dbContext.Roles
            .AsNoTracking()
            .Include(r => r.RolePermissions)
            .ThenInclude(rp => rp.MenuItem)
            .ToListAsync();

        var userCounts = await _dbContext.Users
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

    [HttpGet("{id}")]
    public async Task<ActionResult<RoleDto>> GetRoleById(Guid id)
    {
        var role = await _dbContext.Roles
            .Include(r => r.RolePermissions)
            .ThenInclude(rp => rp.MenuItem)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (role == null) return NotFound();

        var userCount = await _dbContext.Users.CountAsync(u => u.RoleId == id);

        var allMenuItems = await _dbContext.MenuItems.Where(m => m.IsActive).ToListAsync();

        var permissionsMap = role.RolePermissions.ToDictionary(rp => rp.MenuItemId);

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

    [HttpPost]
    public async Task<ActionResult<RoleDto>> CreateRole([FromBody] CreateRoleDto dto)
    {
        var role = new RoleEntity
        {
            TenantId = _currentUser.TenantId,
            Name = dto.Name,
            Description = dto.Description,
            IsActive = dto.IsActive
        };

        _dbContext.Roles.Add(role);

        var allMenuItems = await _dbContext.MenuItems.Where(m => m.IsActive).ToListAsync();
        foreach (var menu in allMenuItems)
        {
            var pDto = dto.Permissions?.FirstOrDefault(p => p.MenuItemId == menu.Id);
            var isAttendancePermission = menu.RouteUrl?.StartsWith("/attendance/permissions/", StringComparison.OrdinalIgnoreCase) == true;
            role.RolePermissions.Add(new RolePermission
            {
                RoleId = role.Id,
                MenuItemId = menu.Id,
                CanView = pDto?.CanView ?? !isAttendancePermission,
                CanCreate = pDto?.CanCreate ?? !isAttendancePermission,
                CanEdit = pDto?.CanEdit ?? !isAttendancePermission,
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

    [HttpPut("{id}")]
    public async Task<ActionResult<RoleDto>> UpdateRole(Guid id, [FromBody] CreateRoleDto dto)
    {
        var role = await _dbContext.Roles.FirstOrDefaultAsync(r => r.Id == id);
        if (role == null) return NotFound();

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
            foreach (var permDto in dto.Permissions)
            {
                _dbContext.RolePermissions.Add(new RolePermission
                {
                    RoleId = role.Id,
                    MenuItemId = permDto.MenuItemId,
                    CanView = permDto.CanView,
                    CanCreate = permDto.CanCreate,
                    CanEdit = permDto.CanEdit,
                    CanDelete = permDto.CanDelete
                });
            }
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new RoleDto(role.Id, role.Name, role.Description, role.IsActive, 0, new List<RolePermissionDto>()));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRole(Guid id)
    {
        var role = await _dbContext.Roles.FindAsync(id);
        if (role == null) return NotFound();

        var isAssigned = await _dbContext.Users.AnyAsync(u => u.RoleId == id);
        if (isAssigned)
        {
            return BadRequest(new { message = "Cannot delete role assigned to active users." });
        }

        _dbContext.Roles.Remove(role);
        await _dbContext.SaveChangesAsync();

        return NoContent();
    }
}
