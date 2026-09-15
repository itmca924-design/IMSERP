using IMSERP.API.Helpers;
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
public class TenantsController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly IPasswordHasherService _passwordHasher;
    private readonly ICurrentUserService _currentUser;
    private readonly IWebHostEnvironment _env;

    public TenantsController(
        IIMSERPDbContext dbContext,
        IPasswordHasherService passwordHasher,
        ICurrentUserService currentUser,
        IWebHostEnvironment env)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _currentUser = currentUser;
        _env = env;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TenantDto>>> GetAllTenants()
    {
        // Fetch all tenants
        var tenants = await _dbContext.Tenants
            .AsNoTracking()
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        var tenantDtos = new List<TenantDto>();
        foreach (var t in tenants)
        {
            var studentCount = await _dbContext.Students
                .IgnoreQueryFilters()
                .CountAsync(s => s.TenantId == t.Id);

            var batchCount = await _dbContext.Batches
                .IgnoreQueryFilters()
                .CountAsync(b => b.TenantId == t.Id);

            tenantDtos.Add(new TenantDto(
                t.Id,
                t.Name,
                t.Code,
                t.ContactPhone,
                t.Address,
                t.ProfilePhoto,
                t.WhatsAppPhoneId,
                t.IsActive,
                t.CreatedAt,
                studentCount,
                batchCount
            ));
        }

        return Ok(tenantDtos);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<TenantDto>> GetTenantById(Guid id)
    {
        var t = await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (t == null) return NotFound(new { message = "Institute tenant not found." });

        var studentCount = await _dbContext.Students.IgnoreQueryFilters().CountAsync(s => s.TenantId == t.Id);
        var batchCount = await _dbContext.Batches.IgnoreQueryFilters().CountAsync(b => b.TenantId == t.Id);

        return Ok(new TenantDto(
            t.Id,
            t.Name,
            t.Code,
            t.ContactPhone,
            t.Address,
            t.ProfilePhoto,
            t.WhatsAppPhoneId,
            t.IsActive,
            t.CreatedAt,
            studentCount,
            batchCount
        ));
    }

    [HttpPost]
    public async Task<ActionResult<TenantDto>> CreateTenant([FromBody] CreateTenantDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.Code))
        {
            return BadRequest(new { message = "Institute Name and Unique Code are required." });
        }

        var normalizedCode = dto.Code.Trim().ToUpper();

        var codeExists = await _dbContext.Tenants.AnyAsync(t => t.Code == normalizedCode);
        if (codeExists)
        {
            return Conflict(new { message = $"Institute Code '{normalizedCode}' is already registered. Please choose another code." });
        }

        var tenantId = Guid.NewGuid();
        var savedPhotoPath = ImageStorageHelper.SaveBase64Image(dto.ProfilePhoto, "tenants", tenantId.ToString(), _env.ContentRootPath);

        var tenant = new Tenant
        {
            Id = tenantId,
            Name = dto.Name.Trim(),
            Code = normalizedCode,
            ContactPhone = dto.ContactPhone,
            Address = dto.Address,
            ProfilePhoto = savedPhotoPath,
            WhatsAppPhoneId = dto.WhatsAppPhoneId,
            WhatsAppAccessToken = dto.WhatsAppAccessToken,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Tenants.Add(tenant);

        // Auto-provision initial Main Branch for this tenant
        var mainBranch = new Branch
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Name = $"{tenant.Name} - Main Branch",
            Code = "MAIN",
            Address = tenant.Address,
            ContactPhone = tenant.ContactPhone,
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

        // Auto-provision initial administrator user
        if (!string.IsNullOrWhiteSpace(dto.AdminUsername) && !string.IsNullOrWhiteSpace(dto.AdminPassword))
        {
            var adminUser = new User
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                BranchId = mainBranch.Id,
                Username = dto.AdminUsername.Trim().ToLower(),
                PasswordHash = _passwordHasher.HashPassword(dto.AdminPassword),
                FullName = !string.IsNullOrWhiteSpace(dto.AdminFullName) ? dto.AdminFullName : $"{tenant.Name} Administrator",
                PhoneNumber = dto.ContactPhone,
                Email = $"{dto.AdminUsername.Trim().ToLower()}@{normalizedCode.ToLower()}.com",
                Role = UserRole.InstituteAdmin,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.Users.Add(adminUser);
        }

        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetTenantById), new { id = tenant.Id }, new TenantDto(
            tenant.Id,
            tenant.Name,
            tenant.Code,
            tenant.ContactPhone,
            tenant.Address,
            tenant.ProfilePhoto,
            tenant.WhatsAppPhoneId,
            tenant.IsActive,
            tenant.CreatedAt,
            0,
            0
        ));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateTenant(Guid id, [FromBody] UpdateTenantDto dto)
    {
        var tenant = await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == id);
        if (tenant == null) return NotFound(new { message = "Institute not found." });

        tenant.Name = dto.Name.Trim();
        tenant.ContactPhone = dto.ContactPhone;
        tenant.Address = dto.Address;
        tenant.ProfilePhoto = ImageStorageHelper.SaveBase64Image(dto.ProfilePhoto, "tenants", tenant.Id.ToString(), _env.ContentRootPath);
        if (!string.IsNullOrWhiteSpace(dto.WhatsAppPhoneId)) tenant.WhatsAppPhoneId = dto.WhatsAppPhoneId;
        if (!string.IsNullOrWhiteSpace(dto.WhatsAppAccessToken)) tenant.WhatsAppAccessToken = dto.WhatsAppAccessToken;

        await _dbContext.SaveChangesAsync();

        return Ok(new { message = "Institute details updated successfully." });
    }

    [HttpPatch("{id}/toggle-status")]
    public async Task<ActionResult> ToggleTenantStatus(Guid id)
    {
        var tenant = await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == id);
        if (tenant == null) return NotFound(new { message = "Institute not found." });

        tenant.IsActive = !tenant.IsActive;
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = $"Institute is now {(tenant.IsActive ? "Active" : "Inactive")}.", isActive = tenant.IsActive });
    }
}
