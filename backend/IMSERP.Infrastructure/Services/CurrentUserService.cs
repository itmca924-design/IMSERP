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

    public string UserRole => _httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.Role)?.Value ?? "Guest";
}
