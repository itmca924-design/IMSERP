using IMSERP.Application.Interfaces;
using IMSERP.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Services;

public interface IMenuPermissionService
{
    Task<bool> HasPermissionAsync(string menuRoute, MenuPermissionOperation operation, CancellationToken cancellationToken = default);
    Task<bool> HasAnyPermissionAsync(string menuRoute, CancellationToken cancellationToken = default, params MenuPermissionOperation[] operations);
    Task<bool> IsPlatformAdministratorAsync(CancellationToken cancellationToken = default);
}

public enum MenuPermissionOperation
{
    View,
    Create,
    Edit,
    Delete
}

public sealed class MenuPermissionService : IMenuPermissionService
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;

    public MenuPermissionService(IIMSERPDbContext dbContext, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<bool> HasPermissionAsync(
        string menuRoute,
        MenuPermissionOperation operation,
        CancellationToken cancellationToken = default)
    {
        var user = await _dbContext.Users
            .AsNoTracking()
            .Where(candidate => candidate.Id == _currentUser.UserId &&
                                candidate.TenantId == _currentUser.TenantId &&
                                candidate.IsActive)
            .Select(candidate => new { candidate.Role, candidate.RoleId })
            .FirstOrDefaultAsync(cancellationToken);

        if (user == null)
        {
            return false;
        }

        if (user.Role == UserRole.SuperAdmin || user.Role == UserRole.InstituteAdmin)
        {
            return true;
        }

        if (!user.RoleId.HasValue)
        {
            return false;
        }

        var permission = await _dbContext.RolePermissions
            .AsNoTracking()
            .Where(permission =>
                permission.RoleId == user.RoleId.Value &&
                permission.Role != null &&
                permission.Role.IsActive &&
                permission.Role.TenantId == _currentUser.TenantId &&
                permission.MenuItem != null &&
                permission.MenuItem.IsActive &&
                permission.MenuItem.RouteUrl == menuRoute &&
                (!permission.MenuItem.TenantId.HasValue ||
                 permission.MenuItem.TenantId == _currentUser.TenantId) &&
                (!permission.MenuItem.BranchId.HasValue ||
                 !_currentUser.BranchId.HasValue ||
                 permission.MenuItem.BranchId == _currentUser.BranchId))
            .Select(permission => new
            {
                permission.CanView,
                permission.CanCreate,
                permission.CanEdit,
                permission.CanDelete
            })
            .FirstOrDefaultAsync(cancellationToken);

        return permission != null && (operation switch
        {
            MenuPermissionOperation.View => permission.CanView,
            MenuPermissionOperation.Create => permission.CanCreate,
            MenuPermissionOperation.Edit => permission.CanEdit,
            MenuPermissionOperation.Delete => permission.CanDelete,
            _ => false
        });
    }

    public async Task<bool> HasAnyPermissionAsync(
        string menuRoute,
        CancellationToken cancellationToken = default,
        params MenuPermissionOperation[] operations)
    {
        foreach (var operation in operations)
        {
            if (await HasPermissionAsync(menuRoute, operation, cancellationToken))
            {
                return true;
            }
        }

        return false;
    }

    public async Task<bool> IsPlatformAdministratorAsync(CancellationToken cancellationToken = default)
    {
        return await _dbContext.Users
            .AsNoTracking()
            .AnyAsync(user =>
                user.Id == _currentUser.UserId &&
                user.TenantId == _currentUser.TenantId &&
                user.IsActive &&
                (user.Role == UserRole.SuperAdmin || user.Role == UserRole.InstituteAdmin),
                cancellationToken);
    }
}
