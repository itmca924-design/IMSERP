using System.Security.Claims;
using IMSERP.Application.Interfaces;
using Microsoft.AspNetCore.Http;

namespace IMSERP.Infrastructure.Services;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid TenantId
    {
        get
        {
            var tenantClaim = _httpContextAccessor.HttpContext?.User?.FindFirst("TenantId")?.Value;
            if (Guid.TryParse(tenantClaim, out var tenantId))
            {
                return tenantId;
            }
            return Guid.Empty;
        }
    }

    public Guid UserId
    {
        get
        {
            var userClaim = _httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (Guid.TryParse(userClaim, out var userId))
            {
                return userId;
            }
            return Guid.Empty;
        }
    }

    public Guid? BranchId
    {
        get
        {
            var branchHeader = _httpContextAccessor.HttpContext?.Request?.Headers["X-Branch-Id"].ToString();
            if (!string.IsNullOrWhiteSpace(branchHeader) && Guid.TryParse(branchHeader, out var headerBranchId))
            {
                return headerBranchId;
            }

            var branchClaim = _httpContextAccessor.HttpContext?.User?.FindFirst("BranchId")?.Value;
            if (Guid.TryParse(branchClaim, out var claimBranchId))
            {
                return claimBranchId;
            }

            return null;
        }
    }

    public string? BranchName => _httpContextAccessor.HttpContext?.User?.FindFirst("BranchName")?.Value;

    public string UserRole => _httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.Role)?.Value ?? "Guest";
}
