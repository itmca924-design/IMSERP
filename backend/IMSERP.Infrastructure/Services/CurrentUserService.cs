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
            var roleClaim = _httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.Role)?.Value;
            var isStaff = !string.IsNullOrEmpty(roleClaim) &&
                          !roleClaim.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) &&
                          !roleClaim.Equals("InstituteAdmin", StringComparison.OrdinalIgnoreCase);

            var branchClaim = _httpContextAccessor.HttpContext?.User?.FindFirst("BranchId")?.Value;
            Guid? claimBranchId = null;
            if (Guid.TryParse(branchClaim, out var parsedClaimId))
            {
                claimBranchId = parsedClaimId;
            }

            // Staff users (Teacher, Accountant, etc.) are strictly locked to their assigned branch
            if (isStaff && claimBranchId.HasValue)
            {
                return claimBranchId;
            }

            // SuperAdmin & InstituteAdmin can switch branch via X-Branch-Id header
            var branchHeader = _httpContextAccessor.HttpContext?.Request?.Headers["X-Branch-Id"].ToString();
            if (!string.IsNullOrWhiteSpace(branchHeader) && Guid.TryParse(branchHeader, out var headerBranchId))
            {
                return headerBranchId;
            }

            return claimBranchId;
        }
    }

    public string? BranchName => _httpContextAccessor.HttpContext?.User?.FindFirst("BranchName")?.Value;

    public string UserRole => _httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.Role)?.Value ?? "Guest";
}
