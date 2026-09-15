using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

using IMSERP.API.Helpers;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly IPasswordHasherService _passwordHasher;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;

    public AuthController(IIMSERPDbContext dbContext, IPasswordHasherService passwordHasher, IConfiguration config, IWebHostEnvironment env)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _config = config;
        _env = env;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponseDto>> Login([FromBody] LoginRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.TenantCode) ||
            string.IsNullOrWhiteSpace(request.Username) ||
            string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Institute Code, Username, and Password are all required." });
        }

        // 1. Locate and validate active tenant by Code
        var tenant = await _dbContext.Tenants
            .FirstOrDefaultAsync(t => t.Code.ToLower() == request.TenantCode.Trim().ToLower() && t.IsActive);

        if (tenant == null)
        {
            return Unauthorized(new { message = $"Invalid Institute Code '{request.TenantCode}' or Institute is inactive." });
        }

        // 2. Locate user strictly within this tenant
        var user = await _dbContext.Users
            .IgnoreQueryFilters()
            .Include(u => u.Branch)
            .FirstOrDefaultAsync(u => u.TenantId == tenant.Id && u.Username.ToLower() == request.Username.Trim().ToLower() && u.IsActive);

        if (user == null || !_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = $"Invalid username or password for {tenant.Name}." });
        }

        // Fetch active branches of this tenant
        var branches = await _dbContext.Branches
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(b => b.TenantId == tenant.Id && b.IsActive)
            .OrderByDescending(b => b.IsMainBranch)
            .ThenBy(b => b.Name)
            .Select(b => new BranchDto(b.Id, b.TenantId, b.Name, b.Code, b.Address, b.ContactPhone, b.IsMainBranch, b.IsActive, b.CreatedAt, 0, 0, 0))
            .ToListAsync();

        if (user.Role != UserRole.SuperAdmin && user.Role != UserRole.InstituteAdmin)
        {
            if (user.BranchId.HasValue)
            {
                branches = branches.Where(b => b.Id == user.BranchId.Value).ToList();
            }
        }

        // 3. Generate Access Token (30 min) + Refresh Token (7 days)
        var accessToken = GenerateJwtToken(user, tenant.Name, tenant.Code);
        var refreshToken = GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await _dbContext.SaveChangesAsync();

        return Ok(new LoginResponseDto(
            Token: accessToken,
            RefreshToken: refreshToken,
            UserId: user.Id,
            Username: user.Username,
            FullName: user.FullName,
            Role: user.Role.ToString(),
            TenantId: user.TenantId,
            InstituteName: tenant.Name,
            TenantCode: tenant.Code,
            ProfilePhoto: tenant.ProfilePhoto,
            BranchId: user.BranchId,
            BranchName: user.Branch?.Name,
            Branches: branches
        ));
    }

    [HttpPost("refresh-token")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponseDto>> RefreshToken([FromBody] RefreshTokenRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Token) || string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return BadRequest(new { message = "Token and Refresh Token are required." });
        }

        var principal = GetPrincipalFromExpiredToken(request.Token);
        if (principal == null)
        {
            return Unauthorized(new { message = "Invalid access token." });
        }

        var userIdClaim = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "Invalid user identification in token." });
        }

        var user = await _dbContext.Users
            .IgnoreQueryFilters()
            .Include(u => u.Branch)
            .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive);

        if (user == null || user.RefreshToken != request.RefreshToken || user.RefreshTokenExpiryTime <= DateTime.UtcNow)
        {
            return Unauthorized(new { message = "Refresh token has expired or is invalid. Please log in again." });
        }

        var tenant = await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == user.TenantId);

        var branches = await _dbContext.Branches
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(b => b.TenantId == user.TenantId && b.IsActive)
            .OrderByDescending(b => b.IsMainBranch)
            .ThenBy(b => b.Name)
            .Select(b => new BranchDto(b.Id, b.TenantId, b.Name, b.Code, b.Address, b.ContactPhone, b.IsMainBranch, b.IsActive, b.CreatedAt, 0, 0, 0))
            .ToListAsync();

        if (user.Role != UserRole.SuperAdmin && user.Role != UserRole.InstituteAdmin)
        {
            if (user.BranchId.HasValue)
            {
                branches = branches.Where(b => b.Id == user.BranchId.Value).ToList();
            }
        }

        // Token Rotation: issue brand new access token and refresh token
        var newAccessToken = GenerateJwtToken(user, tenant?.Name ?? "Coaching Institute", tenant?.Code ?? "");
        var newRefreshToken = GenerateRefreshToken();

        user.RefreshToken = newRefreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await _dbContext.SaveChangesAsync();

        return Ok(new LoginResponseDto(
            Token: newAccessToken,
            RefreshToken: newRefreshToken,
            UserId: user.Id,
            Username: user.Username,
            FullName: user.FullName,
            Role: user.Role.ToString(),
            TenantId: user.TenantId,
            InstituteName: tenant?.Name ?? "Coaching Institute",
            TenantCode: tenant?.Code ?? "",
            ProfilePhoto: tenant?.ProfilePhoto,
            BranchId: user.BranchId,
            BranchName: user.Branch?.Name,
            Branches: branches
        ));
    }

    [HttpPost("revoke-token")]
    [Authorize]
    public async Task<ActionResult> RevokeToken()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (Guid.TryParse(userIdClaim, out var userId))
        {
            var user = await _dbContext.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == userId);
            if (user != null)
            {
                user.RefreshToken = null;
                user.RefreshTokenExpiryTime = null;
                await _dbContext.SaveChangesAsync();
            }
        }
        return Ok(new { message = "Token revoked successfully." });
    }

    [HttpPost("register-tenant")]
    [AllowAnonymous]
    public async Task<ActionResult> RegisterTenant([FromBody] RegisterInstituteDto dto)
    {
        var tenantId = Guid.NewGuid();
        var savedPhotoPath = ImageStorageHelper.SaveBase64Image(dto.ProfilePhoto, "tenants", tenantId.ToString(), _env.ContentRootPath);

        var tenant = new Tenant
        {
            Id = tenantId,
            Name = dto.InstituteName,
            Code = dto.InstituteCode.ToUpper().Trim(),
            ContactPhone = dto.Phone,
            Address = dto.Address,
            ProfilePhoto = savedPhotoPath,
            IsActive = true
        };

        _dbContext.Tenants.Add(tenant);

        // Auto-provision initial Main Branch for this tenant
        var mainBranch = new Branch
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Name = $"{dto.InstituteName} - Main Branch",
            Code = "MAIN",
            Address = dto.Address,
            ContactPhone = dto.Phone,
            IsMainBranch = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        _dbContext.Branches.Add(mainBranch);

        // Auto-provision default Room for this main branch
        var defaultRoom = new Room
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            BranchId = mainBranch.Id,
            RoomNumber = "Room 101",
            Capacity = 40,
            Floor = "Ground Floor",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        _dbContext.Rooms.Add(defaultRoom);

        // Securely Hash the Admin Password before saving to database
        var hashedPassword = _passwordHasher.HashPassword(dto.AdminPassword);

        var adminUser = new User
        {
            TenantId = tenant.Id,
            BranchId = mainBranch.Id,
            Username = dto.AdminUsername,
            PasswordHash = hashedPassword,
            FullName = dto.AdminFullName,
            Email = $"{dto.AdminUsername}@coaching.com",
            PhoneNumber = dto.Phone,
            Role = UserRole.InstituteAdmin,
            IsActive = true
        };

        _dbContext.Users.Add(adminUser);
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = "Institute registered successfully with secure hashed password", tenantId = tenant.Id, branchId = mainBranch.Id });
    }

    private string GenerateJwtToken(User user, string instituteName, string tenantCode)
    {
        var secretKey = _config["Jwt:Key"] ?? "SuperSecretKeyForIMSERPCoachingSaaSApp123456!";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.GivenName, user.FullName),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("TenantId", user.TenantId.ToString()),
            new Claim("TenantCode", tenantCode),
            new Claim("InstituteName", instituteName)
        };

        if (user.BranchId.HasValue && user.BranchId.Value != Guid.Empty)
        {
            claims.Add(new Claim("BranchId", user.BranchId.Value.ToString()));
            if (!string.IsNullOrWhiteSpace(user.Branch?.Name))
            {
                claims.Add(new Claim("BranchName", user.Branch.Name));
            }
        }

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "IMSERPCoachingSaaS",
            audience: _config["Jwt:Audience"] ?? "IMSERPUsers",
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(30),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateRefreshToken()
    {
        var randomNumber = new byte[64];
        using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }

    private ClaimsPrincipal? GetPrincipalFromExpiredToken(string token)
    {
        var secretKey = _config["Jwt:Key"] ?? "SuperSecretKeyForIMSERPCoachingSaaSApp123456!";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));

        var tokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = false,
            ValidateIssuer = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
            ValidateLifetime = false // Allow expired access tokens to be verified for refresh
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        try
        {
            var principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out var securityToken);
            if (securityToken is not JwtSecurityToken jwtSecurityToken ||
                !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
            {
                return null;
            }
            return principal;
        }
        catch
        {
            return null;
        }
    }
}
