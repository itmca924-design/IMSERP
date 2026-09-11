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

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly IPasswordHasherService _passwordHasher;
    private readonly IConfiguration _config;

    public AuthController(IIMSERPDbContext dbContext, IPasswordHasherService passwordHasher, IConfiguration config)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _config = config;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponseDto>> Login([FromBody] LoginRequestDto request)
    {
        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Username.ToLower() == request.Username.ToLower() && u.IsActive);

        if (user == null || !_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid username or password" });
        }

        var tenant = await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == user.TenantId);
        var token = GenerateJwtToken(user, tenant?.Name ?? "Coaching Institute");

        return Ok(new LoginResponseDto(
            Token: token,
            Username: user.Username,
            FullName: user.FullName,
            Role: user.Role.ToString(),
            TenantId: user.TenantId,
            InstituteName: tenant?.Name ?? "Apex Coaching Academy"
        ));
    }

    [HttpPost("register-tenant")]
    [AllowAnonymous]
    public async Task<ActionResult> RegisterTenant([FromBody] RegisterInstituteDto dto)
    {
        var tenant = new Tenant
        {
            Name = dto.InstituteName,
            Code = dto.InstituteCode,
            ContactPhone = dto.Phone,
            Address = dto.Address,
            IsActive = true
        };

        _dbContext.Tenants.Add(tenant);

        // Securely Hash the Admin Password before saving to database
        var hashedPassword = _passwordHasher.HashPassword(dto.AdminPassword);

        var adminUser = new User
        {
            TenantId = tenant.Id,
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

        return Ok(new { message = "Institute registered successfully with secure hashed password", tenantId = tenant.Id });
    }

    private string GenerateJwtToken(User user, string instituteName)
    {
        var secretKey = _config["Jwt:Key"] ?? "SuperSecretKeyForIMSERPCoachingSaaSApp123456!";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.GivenName, user.FullName),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("TenantId", user.TenantId.ToString()),
            new Claim("InstituteName", instituteName)
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "IMSERPCoachingSaaS",
            audience: _config["Jwt:Audience"] ?? "IMSERPUsers",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
