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
        var user = await _dbContext.Users
            .AsNoTracking()
            .Include(u => u.AssignedRole)
            .FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);

        var permissionOnlyRoutes = new[]
        {
            "/teachers/attendance/ph-sun-edit",
            "/attendance/permissions/mode-settings",
            "/attendance/permissions/manual",
            "/attendance/permissions/biometric",
            "/attendance/permissions/biometric-mapping",
            "/attendance/permissions/correction"
        };

        var allMenuItems = await _dbContext.MenuItems
            .AsNoTracking()
            .Where(m => m.IsActive && !permissionOnlyRoutes.Contains(m.RouteUrl!))
            .OrderBy(m => m.SortOrder)
            .ToListAsync();

        HashSet<Guid> allowedMenuIds;

        if (user?.RoleId != null)
        {
            var permissions = await _dbContext.RolePermissions
                .AsNoTracking()
                .Where(rp => rp.RoleId == user.RoleId && rp.CanView)
                .Select(rp => rp.MenuItemId)
                .ToListAsync();

            allowedMenuIds = new HashSet<Guid>(permissions);
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
