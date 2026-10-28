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

    private static readonly System.Text.Json.JsonSerializerOptions _assetJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

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
        var isSuperAdmin = string.Equals(_currentUser.UserRole, nameof(UserRole.SuperAdmin), StringComparison.OrdinalIgnoreCase);

        // SuperAdmin can view all tenants in the SaaS provisioning management console
        var query = _dbContext.Tenants
            .AsNoTracking()
            .IgnoreQueryFilters()
            .OrderByDescending(t => t.CreatedAt)
            .AsQueryable();

        if (isSuperAdmin)
        {
            // Omit internal SYSTEM platform console tenant from ordinary client institutes list
            query = query.Where(t => t.Code != "SYSTEM");
        }
        else
        {
            // Individual Institute Admin / Staff ONLY sees their own company
            query = query.Where(t => t.Id == _currentUser.TenantId);
        }

        var tenants = await query.ToListAsync();

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
                batchCount,
                t.HasSchoolModule,
                t.HasCoachingModule,
                t.HasHostelModule,
                t.HasLibraryModule,
                t.HasTransportModule,
                t.LicensedModules,
                t.SubscriptionPlan,
                t.SubscriptionStatus,
                t.TrialStartDate,
                t.TrialEndDate,
                t.PaidUntil,
                t.MaxStudentsLimit,
                t.MaxBranchesLimit,
                t.UpiId,
                t.UpiMerchantName,
                t.UpiMerchantCode,
                t.UpiQrEnabled,
                t.UpiAutoVerify,
                t.BankName,
                t.BankAccountNumber,
                t.BankIfscCode,
                t.BankAccountHolderName,
                t.BankAccountType,
                t.BankBranch,
                t.Email,
                t.City,
                t.State,
                t.Pincode,
                t.Website,
                t.AffiliationNumber,
                t.EstablishedYear,
                t.OfficialSeal,
                t.DigitalSignature,
                t.OfficialSealsJson,
                t.DigitalSignaturesJson
            ));
        }

        return Ok(tenantDtos);
    }

    [HttpGet("current")]
    public async Task<ActionResult<TenantDto>> GetCurrentTenant()
    {
        var tenantId = _currentUser.TenantId;
        Tenant? t = null;

        if (tenantId != Guid.Empty)
        {
            t = await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == tenantId);
        }

        if (t == null)
        {
            t = await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(x => x.IsActive);
        }

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
            batchCount,
            t.HasSchoolModule,
            t.HasCoachingModule,
            t.HasHostelModule,
            t.HasLibraryModule,
            t.HasTransportModule,
            t.LicensedModules,
            t.SubscriptionPlan,
            t.SubscriptionStatus,
            t.TrialStartDate,
            t.TrialEndDate,
            t.PaidUntil,
            t.MaxStudentsLimit,
            t.MaxBranchesLimit,
            t.UpiId,
            t.UpiMerchantName,
            t.UpiMerchantCode,
            t.UpiQrEnabled,
            t.UpiAutoVerify,
            t.BankName,
            t.BankAccountNumber,
            t.BankIfscCode,
            t.BankAccountHolderName,
            t.BankAccountType,
            t.BankBranch,
            t.Email,
            t.City,
            t.State,
            t.Pincode,
            t.Website,
            t.AffiliationNumber,
            t.EstablishedYear,
            t.OfficialSeal,
            t.DigitalSignature,
            t.OfficialSealsJson,
            t.DigitalSignaturesJson
        ));
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
            batchCount,
            t.HasSchoolModule,
            t.HasCoachingModule,
            t.HasHostelModule,
            t.HasLibraryModule,
            t.HasTransportModule,
            t.LicensedModules,
            t.SubscriptionPlan,
            t.SubscriptionStatus,
            t.TrialStartDate,
            t.TrialEndDate,
            t.PaidUntil,
            t.MaxStudentsLimit,
            t.MaxBranchesLimit,
            t.UpiId,
            t.UpiMerchantName,
            t.UpiMerchantCode,
            t.UpiQrEnabled,
            t.UpiAutoVerify,
            t.BankName,
            t.BankAccountNumber,
            t.BankIfscCode,
            t.BankAccountHolderName,
            t.BankAccountType,
            t.BankBranch,
            t.Email,
            t.City,
            t.State,
            t.Pincode,
            t.Website,
            t.AffiliationNumber,
            t.EstablishedYear,
            t.OfficialSeal,
            t.DigitalSignature,
            t.OfficialSealsJson,
            t.DigitalSignaturesJson
        ));
    }

    [HttpGet("my-subscription")]
    public async Task<ActionResult> GetMySubscription([FromQuery] Guid? tenantId = null)
    {
        var isSuperAdmin = string.Equals(_currentUser.UserRole, "SuperAdmin", StringComparison.OrdinalIgnoreCase);
        var targetTenantId = (isSuperAdmin && tenantId.HasValue && tenantId.Value != Guid.Empty)
            ? tenantId.Value
            : _currentUser.TenantId;

        var tenant = await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == targetTenantId);
        if (tenant == null) return NotFound(new { message = "Institute not found." });

        var studentCount = await _dbContext.Students.IgnoreQueryFilters().CountAsync(s => s.TenantId == tenant.Id);
        var branchCount = await _dbContext.Branches.IgnoreQueryFilters().CountAsync(b => b.TenantId == tenant.Id);

        int? trialDaysLeft = null;
        if (tenant.TrialEndDate.HasValue)
        {
            var diff = (tenant.TrialEndDate.Value.Date - DateTime.UtcNow.Date).Days;
            trialDaysLeft = Math.Max(0, diff);
        }

        bool isExpired = !isSuperAdmin &&
                         (string.Equals(tenant.SubscriptionStatus, "Expired", StringComparison.OrdinalIgnoreCase) ||
                          (string.Equals(tenant.SubscriptionPlan, "FreeTrial", StringComparison.OrdinalIgnoreCase) &&
                           tenant.TrialEndDate.HasValue && tenant.TrialEndDate.Value.Date < DateTime.UtcNow.Date));

        if (isExpired && tenant.SubscriptionStatus != "Expired")
        {
            var trackedTenant = await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == targetTenantId);
            if (trackedTenant != null)
            {
                trackedTenant.SubscriptionStatus = "Expired";
                await _dbContext.SaveChangesAsync();
            }
        }

        return Ok(new
        {
            tenantId = tenant.Id,
            instituteName = tenant.Name,
            tenantCode = tenant.Code,
            subscriptionPlan = tenant.SubscriptionPlan,
            subscriptionStatus = isExpired ? "Expired" : tenant.SubscriptionStatus,
            trialStartDate = tenant.TrialStartDate,
            trialEndDate = tenant.TrialEndDate,
            paidUntil = tenant.PaidUntil,
            trialDaysLeft,
            studentCount,
            maxStudentsLimit = tenant.MaxStudentsLimit,
            branchCount,
            maxBranchesLimit = tenant.MaxBranchesLimit,
            hasSchoolModule = tenant.HasSchoolModule,
            hasCoachingModule = tenant.HasCoachingModule,
            hasHostelModule = tenant.HasHostelModule,
            hasLibraryModule = tenant.HasLibraryModule,
            hasTransportModule = tenant.HasTransportModule,
            licensedModules = tenant.LicensedModules,
            isSubscriptionExpired = isExpired
        });
    }

    [HttpPost("{id}/extend-subscription")]
    public async Task<ActionResult> ExtendSubscription(Guid id, [FromBody] ExtendSubscriptionDto dto)
    {
        var isSuperAdmin = string.Equals(_currentUser.UserRole, nameof(UserRole.SuperAdmin), StringComparison.OrdinalIgnoreCase);
        if (!isSuperAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only SuperAdmin can extend subscriptions." });
        }

        var tenant = await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == id);
        if (tenant == null) return NotFound(new { message = "Institute not found." });

        DateTime baseDate = tenant.TrialEndDate.HasValue && tenant.TrialEndDate.Value > DateTime.UtcNow
            ? tenant.TrialEndDate.Value
            : DateTime.UtcNow;

        if (dto.DaysToAdd.HasValue && dto.DaysToAdd.Value > 0)
        {
            tenant.TrialEndDate = baseDate.AddDays(dto.DaysToAdd.Value);
            tenant.PaidUntil = baseDate.AddDays(dto.DaysToAdd.Value);
        }
        else if (dto.NewEndDate.HasValue)
        {
            tenant.TrialEndDate = dto.NewEndDate.Value;
            tenant.PaidUntil = dto.NewEndDate.Value;
        }

        if (!string.IsNullOrWhiteSpace(dto.NewPlan))
        {
            tenant.SubscriptionPlan = dto.NewPlan;
        }

        if (!string.IsNullOrWhiteSpace(dto.NewStatus))
        {
            tenant.SubscriptionStatus = dto.NewStatus;
        }
        else
        {
            tenant.SubscriptionStatus = "Active";
        }

        if (dto.MaxStudentsLimit.HasValue && dto.MaxStudentsLimit.Value > 0)
        {
            tenant.MaxStudentsLimit = dto.MaxStudentsLimit.Value;
        }

        if (dto.MaxBranchesLimit.HasValue && dto.MaxBranchesLimit.Value > 0)
        {
            tenant.MaxBranchesLimit = dto.MaxBranchesLimit.Value;
        }

        await _dbContext.SaveChangesAsync();

        int daysLeft = tenant.TrialEndDate.HasValue
            ? Math.Max(0, (tenant.TrialEndDate.Value.Date - DateTime.UtcNow.Date).Days)
            : 0;

        return Ok(new
        {
            message = $"Subscription extended successfully for {tenant.Name}.",
            subscriptionPlan = tenant.SubscriptionPlan,
            subscriptionStatus = tenant.SubscriptionStatus,
            trialEndDate = tenant.TrialEndDate,
            paidUntil = tenant.PaidUntil,
            trialDaysLeft = daysLeft
        });
    }

    [HttpPost]
    public async Task<ActionResult<TenantDto>> CreateTenant([FromBody] CreateTenantDto dto)
    {
        var isSuperAdmin = string.Equals(_currentUser.UserRole, nameof(UserRole.SuperAdmin), StringComparison.OrdinalIgnoreCase);
        if (!isSuperAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Access denied: Only Platform Super Admin can provision new institutes." });
        }

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
        var savedSealPath = ImageStorageHelper.SaveBase64Image(dto.OfficialSeal, "seals", tenantId.ToString(), _env.ContentRootPath);
        var savedSignaturePath = ImageStorageHelper.SaveBase64Image(dto.DigitalSignature, "signatures", tenantId.ToString(), _env.ContentRootPath);

        var tenant = new Tenant
        {
            Id = tenantId,
            Name = dto.Name.Trim(),
            Code = normalizedCode,
            Email = dto.Email?.Trim(),
            ContactPhone = dto.ContactPhone,
            Address = dto.Address,
            City = dto.City?.Trim(),
            State = dto.State?.Trim(),
            Pincode = dto.Pincode?.Trim(),
            Website = dto.Website?.Trim(),
            AffiliationNumber = dto.AffiliationNumber?.Trim(),
            EstablishedYear = dto.EstablishedYear?.Trim(),
            ProfilePhoto = savedPhotoPath,
            OfficialSeal = savedSealPath,
            DigitalSignature = savedSignaturePath,
            WhatsAppPhoneId = dto.WhatsAppPhoneId,
            WhatsAppAccessToken = dto.WhatsAppAccessToken,
            HasSchoolModule = dto.HasSchoolModule,
            HasCoachingModule = dto.HasCoachingModule,
            HasHostelModule = dto.HasHostelModule,
            HasLibraryModule = dto.HasLibraryModule,
            HasTransportModule = dto.HasTransportModule,
            LicensedModules = string.Join(",", new[] {
                dto.HasSchoolModule ? "School" : null,
                dto.HasCoachingModule ? "Coaching" : null,
                dto.HasHostelModule ? "Hostel" : null,
                dto.HasLibraryModule ? "Library" : null,
                dto.HasTransportModule ? "Transport" : null
            }.Where(s => s != null)),
            SubscriptionPlan = string.IsNullOrWhiteSpace(dto.SubscriptionPlan) ? "FreeTrial" : dto.SubscriptionPlan,
            SubscriptionStatus = "TrialActive",
            TrialStartDate = DateTime.UtcNow,
            TrialEndDate = DateTime.UtcNow.AddDays(30),
            MaxStudentsLimit = dto.MaxStudentsLimit > 0 ? dto.MaxStudentsLimit : 50,
            MaxBranchesLimit = dto.MaxBranchesLimit > 0 ? dto.MaxBranchesLimit : 2,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Tenants.Add(tenant);

        // Provision branches for this tenant (bulk or default single main branch)
        var branchesToCreate = new List<Branch>();

        if (dto.Branches != null && dto.Branches.Count > 0)
        {
            bool hasMain = dto.Branches.Any(b => b.IsMainBranch);
            for (int i = 0; i < dto.Branches.Count; i++)
            {
                var bDto = dto.Branches[i];
                if (string.IsNullOrWhiteSpace(bDto.Name)) continue;

                var isMain = bDto.IsMainBranch || (!hasMain && i == 0);
                var branchCode = !string.IsNullOrWhiteSpace(bDto.Code)
                    ? bDto.Code.Trim().ToUpper()
                    : (isMain ? "MAIN" : $"BR{i + 1}");

                var branch = new Branch
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    Name = bDto.Name.Trim(),
                    Code = branchCode,
                    Address = !string.IsNullOrWhiteSpace(bDto.Address) ? bDto.Address.Trim() : tenant.Address,
                    ContactPhone = !string.IsNullOrWhiteSpace(bDto.ContactPhone) ? bDto.ContactPhone.Trim() : tenant.ContactPhone,
                    Email = !string.IsNullOrWhiteSpace(bDto.Email) ? bDto.Email.Trim() : tenant.Email,
                    City = !string.IsNullOrWhiteSpace(bDto.City) ? bDto.City.Trim() : tenant.City,
                    State = !string.IsNullOrWhiteSpace(bDto.State) ? bDto.State.Trim() : tenant.State,
                    Pincode = !string.IsNullOrWhiteSpace(bDto.Pincode) ? bDto.Pincode.Trim() : tenant.Pincode,
                    IsMainBranch = isMain,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                branchesToCreate.Add(branch);
            }
        }

        if (branchesToCreate.Count == 0)
        {
            // Default single main branch fallback
            branchesToCreate.Add(new Branch
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Name = $"{tenant.Name} - Main Branch",
                Code = "MAIN",
                Address = tenant.Address,
                ContactPhone = tenant.ContactPhone,
                Email = tenant.Email,
                City = tenant.City,
                State = tenant.State,
                Pincode = tenant.Pincode,
                IsMainBranch = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
        }

        _dbContext.Branches.AddRange(branchesToCreate);

        var mainBranch = branchesToCreate.FirstOrDefault(b => b.IsMainBranch) ?? branchesToCreate.First();

        // Auto-provision default Room for each created branch
        foreach (var br in branchesToCreate)
        {
            var defaultRoom = new Room
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                BranchId = br.Id,
                RoomNumber = "Room 101",
                Capacity = 40,
                Floor = "Ground Floor",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.Rooms.Add(defaultRoom);
        }

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
            0,
            tenant.HasSchoolModule,
            tenant.HasCoachingModule,
            tenant.HasHostelModule,
            tenant.HasLibraryModule,
            tenant.HasTransportModule,
            tenant.LicensedModules,
            tenant.SubscriptionPlan,
            tenant.SubscriptionStatus,
            tenant.TrialStartDate,
            tenant.TrialEndDate,
            tenant.PaidUntil,
            tenant.MaxStudentsLimit,
            tenant.MaxBranchesLimit,
            tenant.UpiId,
            tenant.UpiMerchantName,
            tenant.UpiMerchantCode,
            tenant.UpiQrEnabled,
            tenant.UpiAutoVerify,
            tenant.BankName,
            tenant.BankAccountNumber,
            tenant.BankIfscCode,
            tenant.BankAccountHolderName,
            tenant.BankAccountType,
            tenant.BankBranch,
            tenant.Email,
            tenant.City,
            tenant.State,
            tenant.Pincode,
            tenant.Website,
            tenant.AffiliationNumber,
            tenant.EstablishedYear,
            tenant.OfficialSeal,
            tenant.DigitalSignature
        ));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateTenant(Guid id, [FromBody] UpdateTenantDto dto)
    {
        var isSuperAdmin = string.Equals(_currentUser.UserRole, nameof(UserRole.SuperAdmin), StringComparison.OrdinalIgnoreCase);

        // Institute Admin can only update their own tenant
        if (!isSuperAdmin && id != _currentUser.TenantId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You can only update your own institute profile." });
        }

        var tenant = await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == id);
        if (tenant == null) return NotFound(new { message = "Institute not found." });

        tenant.Name = dto.Name.Trim();
        tenant.ContactPhone = dto.ContactPhone;
        tenant.Address = dto.Address;
        if (dto.Email != null) tenant.Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim();
        if (dto.City != null) tenant.City = string.IsNullOrWhiteSpace(dto.City) ? null : dto.City.Trim();
        if (dto.State != null) tenant.State = string.IsNullOrWhiteSpace(dto.State) ? null : dto.State.Trim();
        if (dto.Pincode != null) tenant.Pincode = string.IsNullOrWhiteSpace(dto.Pincode) ? null : dto.Pincode.Trim();
        if (dto.Website != null) tenant.Website = string.IsNullOrWhiteSpace(dto.Website) ? null : dto.Website.Trim();
        if (dto.AffiliationNumber != null) tenant.AffiliationNumber = string.IsNullOrWhiteSpace(dto.AffiliationNumber) ? null : dto.AffiliationNumber.Trim();
        if (dto.EstablishedYear != null) tenant.EstablishedYear = string.IsNullOrWhiteSpace(dto.EstablishedYear) ? null : dto.EstablishedYear.Trim();
        tenant.ProfilePhoto = ImageStorageHelper.SaveBase64Image(dto.ProfilePhoto, "tenants", tenant.Id.ToString(), _env.ContentRootPath);
        if (dto.OfficialSeal != null) tenant.OfficialSeal = ImageStorageHelper.SaveBase64Image(dto.OfficialSeal, "seals", tenant.Id.ToString(), _env.ContentRootPath);
        if (dto.DigitalSignature != null) tenant.DigitalSignature = ImageStorageHelper.SaveBase64Image(dto.DigitalSignature, "signatures", tenant.Id.ToString(), _env.ContentRootPath);
        if (dto.OfficialSealsJson != null) tenant.OfficialSealsJson = dto.OfficialSealsJson;
        if (dto.DigitalSignaturesJson != null) tenant.DigitalSignaturesJson = dto.DigitalSignaturesJson;
        if (!string.IsNullOrWhiteSpace(dto.WhatsAppPhoneId)) tenant.WhatsAppPhoneId = dto.WhatsAppPhoneId;
        if (!string.IsNullOrWhiteSpace(dto.WhatsAppAccessToken)) tenant.WhatsAppAccessToken = dto.WhatsAppAccessToken;

        // Dynamic UPI Configuration
        if (dto.UpiId != null) tenant.UpiId = string.IsNullOrWhiteSpace(dto.UpiId) ? null : dto.UpiId.Trim();
        if (dto.UpiMerchantName != null) tenant.UpiMerchantName = string.IsNullOrWhiteSpace(dto.UpiMerchantName) ? null : dto.UpiMerchantName.Trim();
        if (dto.UpiMerchantCode != null) tenant.UpiMerchantCode = string.IsNullOrWhiteSpace(dto.UpiMerchantCode) ? "8211" : dto.UpiMerchantCode.Trim();
        if (dto.UpiQrEnabled.HasValue) tenant.UpiQrEnabled = dto.UpiQrEnabled.Value;
        if (dto.UpiAutoVerify.HasValue) tenant.UpiAutoVerify = dto.UpiAutoVerify.Value;

        // Company Settlement Bank Account Details & Indian Banking Validation
        if (!string.IsNullOrWhiteSpace(dto.BankAccountNumber))
        {
            var cleanedAcc = dto.BankAccountNumber.Trim();
            if (!System.Text.RegularExpressions.Regex.IsMatch(cleanedAcc, @"^[0-9]{9,18}$"))
            {
                return BadRequest(new { message = "Invalid Bank Account Number. Standard Indian Bank Accounts must be between 9 to 18 digits (numeric only)." });
            }
            tenant.BankAccountNumber = cleanedAcc;
        }
        else if (dto.BankAccountNumber != null)
        {
            tenant.BankAccountNumber = null;
        }

        if (!string.IsNullOrWhiteSpace(dto.BankIfscCode))
        {
            var cleanedIfsc = dto.BankIfscCode.Trim().ToUpper();
            if (!System.Text.RegularExpressions.Regex.IsMatch(cleanedIfsc, @"^[A-Z]{4}0[A-Z0-9]{6}$"))
            {
                return BadRequest(new { message = "Invalid Bank IFSC Code format. Must be an 11-character RBI standard code (e.g. SBIN0001234)." });
            }
            tenant.BankIfscCode = cleanedIfsc;
        }
        else if (dto.BankIfscCode != null)
        {
            tenant.BankIfscCode = null;
        }

        if (dto.BankName != null) tenant.BankName = string.IsNullOrWhiteSpace(dto.BankName) ? null : dto.BankName.Trim();
        if (dto.BankAccountHolderName != null) tenant.BankAccountHolderName = string.IsNullOrWhiteSpace(dto.BankAccountHolderName) ? null : dto.BankAccountHolderName.Trim();
        if (dto.BankAccountType != null) tenant.BankAccountType = string.IsNullOrWhiteSpace(dto.BankAccountType) ? "Current" : dto.BankAccountType.Trim();
        if (dto.BankBranch != null) tenant.BankBranch = string.IsNullOrWhiteSpace(dto.BankBranch) ? null : dto.BankBranch.Trim();

        // Auto-sync UPI and Bank settlement details to branches if they don't have custom credentials
        if (dto.UpiId != null || dto.UpiMerchantName != null || dto.BankAccountNumber != null)
        {
            var branches = await _dbContext.Branches.Where(b => b.TenantId == tenant.Id).ToListAsync();
            foreach (var b in branches)
            {
                if (string.IsNullOrWhiteSpace(b.UpiId) || b.IsMainBranch)
                {
                    b.UpiId = tenant.UpiId;
                    b.UpiMerchantName = tenant.UpiMerchantName;
                }
                if (string.IsNullOrWhiteSpace(b.BankAccountNumber) || b.IsMainBranch)
                {
                    b.BankName = tenant.BankName;
                    b.BankAccountNumber = tenant.BankAccountNumber;
                    b.BankIfscCode = tenant.BankIfscCode;
                    b.BankAccountHolderName = tenant.BankAccountHolderName;
                    b.BankAccountType = tenant.BankAccountType;
                    b.BankBranch = tenant.BankBranch;
                }
            }
        }

        // ONLY SuperAdmin can modify functional modules and subscription entitlements
        if (isSuperAdmin)
        {
            if (dto.HasSchoolModule.HasValue) tenant.HasSchoolModule = dto.HasSchoolModule.Value;
            if (dto.HasCoachingModule.HasValue) tenant.HasCoachingModule = dto.HasCoachingModule.Value;
            if (dto.HasHostelModule.HasValue) tenant.HasHostelModule = dto.HasHostelModule.Value;
            if (dto.HasLibraryModule.HasValue) tenant.HasLibraryModule = dto.HasLibraryModule.Value;
            if (dto.HasTransportModule.HasValue) tenant.HasTransportModule = dto.HasTransportModule.Value;

            if (!string.IsNullOrWhiteSpace(dto.SubscriptionPlan)) tenant.SubscriptionPlan = dto.SubscriptionPlan;
            if (!string.IsNullOrWhiteSpace(dto.SubscriptionStatus)) tenant.SubscriptionStatus = dto.SubscriptionStatus;
            if (dto.TrialEndDate.HasValue) tenant.TrialEndDate = dto.TrialEndDate.Value;
            if (dto.PaidUntil.HasValue) tenant.PaidUntil = dto.PaidUntil.Value;
            if (dto.MaxStudentsLimit.HasValue) tenant.MaxStudentsLimit = dto.MaxStudentsLimit.Value;
            if (dto.MaxBranchesLimit.HasValue) tenant.MaxBranchesLimit = dto.MaxBranchesLimit.Value;
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new { 
            message = "Institute details updated successfully.",
            profilePhoto = tenant.ProfilePhoto,
            officialSeal = tenant.OfficialSeal,
            digitalSignature = tenant.DigitalSignature,
            officialSealsJson = tenant.OfficialSealsJson,
            digitalSignaturesJson = tenant.DigitalSignaturesJson,
            name = tenant.Name,
            code = tenant.Code,
            email = tenant.Email,
            contactPhone = tenant.ContactPhone,
            address = tenant.Address,
            city = tenant.City,
            state = tenant.State,
            pincode = tenant.Pincode,
            website = tenant.Website,
            affiliationNumber = tenant.AffiliationNumber,
            establishedYear = tenant.EstablishedYear,
            tenant.HasSchoolModule,
            tenant.HasCoachingModule,
            tenant.HasHostelModule,
            tenant.HasLibraryModule,
            tenant.HasTransportModule,
            tenant.SubscriptionPlan,
            tenant.SubscriptionStatus,
            tenant.UpiId,
            tenant.UpiMerchantName,
            tenant.UpiMerchantCode,
            tenant.UpiQrEnabled,
            tenant.UpiAutoVerify,
            tenant.BankName,
            tenant.BankAccountNumber,
            tenant.BankIfscCode,
            tenant.BankAccountHolderName,
            tenant.BankAccountType,
            tenant.BankBranch
        });
    }

    [HttpPut("{id}/modules")]
    public async Task<ActionResult> UpdateTenantModules(Guid id, [FromBody] UpdateTenantModulesDto dto)
    {
        var isSuperAdmin = string.Equals(_currentUser.UserRole, nameof(UserRole.SuperAdmin), StringComparison.OrdinalIgnoreCase);

        var tenant = await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == id);
        if (tenant == null) return NotFound(new { message = "Institute not found." });

        if (!isSuperAdmin)
        {
            if (_currentUser.TenantId != id)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "You can only update module settings for your own institute." });
            }

            var licensed = (tenant.LicensedModules ?? "School,Coaching,Hostel,Library,Transport")
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => s.Trim().ToLowerInvariant())
                .ToHashSet();

            if (dto.HasSchoolModule && !licensed.Contains("school"))
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "School module is not subscribed in your plan. Contact SaaS Admin." });
            if (dto.HasCoachingModule && !licensed.Contains("coaching"))
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Coaching module is not subscribed in your plan. Contact SaaS Admin." });
            if (dto.HasHostelModule && !licensed.Contains("hostel"))
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Hostel module is not subscribed in your plan. Contact SaaS Admin." });
            if (dto.HasLibraryModule && !licensed.Contains("library"))
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Library module is not subscribed in your plan. Contact SaaS Admin." });
            if (dto.HasTransportModule && !licensed.Contains("transport"))
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Transport module is not subscribed in your plan. Contact SaaS Admin." });

            var hasPrimary = licensed.Contains("school") || licensed.Contains("coaching");
            if (hasPrimary && !dto.HasSchoolModule && !dto.HasCoachingModule)
            {
                return BadRequest(new { message = "At least one primary module (School or Coaching) must be enabled." });
            }

            tenant.HasSchoolModule = dto.HasSchoolModule;
            tenant.HasCoachingModule = dto.HasCoachingModule;
            tenant.HasHostelModule = dto.HasHostelModule;
            tenant.HasLibraryModule = dto.HasLibraryModule;
            tenant.HasTransportModule = dto.HasTransportModule;
        }
        else
        {
            tenant.HasSchoolModule = dto.HasSchoolModule;
            tenant.HasCoachingModule = dto.HasCoachingModule;
            tenant.HasHostelModule = dto.HasHostelModule;
            tenant.HasLibraryModule = dto.HasLibraryModule;
            tenant.HasTransportModule = dto.HasTransportModule;

            var activeList = new List<string>();
            if (dto.HasSchoolModule) activeList.Add("School");
            if (dto.HasCoachingModule) activeList.Add("Coaching");
            if (dto.HasHostelModule) activeList.Add("Hostel");
            if (dto.HasLibraryModule) activeList.Add("Library");
            if (dto.HasTransportModule) activeList.Add("Transport");
            tenant.LicensedModules = string.Join(",", activeList);
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "Institute module subscription updated successfully.",
            tenantId = tenant.Id,
            tenant.HasSchoolModule,
            tenant.HasCoachingModule,
            tenant.HasHostelModule,
            tenant.HasLibraryModule,
            tenant.HasTransportModule,
            tenant.LicensedModules
        });
    }

    [HttpPatch("{id}/toggle-status")]
    public async Task<ActionResult> ToggleTenantStatus(Guid id)
    {
        var isSuperAdmin = string.Equals(_currentUser.UserRole, nameof(UserRole.SuperAdmin), StringComparison.OrdinalIgnoreCase);
        if (!isSuperAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only Platform Super Admin can activate or deactivate institutes." });
        }

        var tenant = await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == id);
        if (tenant == null) return NotFound(new { message = "Institute not found." });

        tenant.IsActive = !tenant.IsActive;
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = $"Institute is now {(tenant.IsActive ? "Active" : "Inactive")}.", isActive = tenant.IsActive });
    }

    [HttpPost("assets/upload")]
    public async Task<ActionResult> UploadTenantAsset([FromBody] UploadTenantAssetDto dto)
    {
        var targetTenantId = _currentUser.TenantId;
        var tenant = await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == targetTenantId);
        if (tenant == null) return NotFound(new { message = "Institute not found." });

        if (string.IsNullOrWhiteSpace(dto.ImageData))
            return BadRequest(new { message = "Image data is required." });

        var assetType = dto.AssetType?.ToLowerInvariant() == "signature" ? "signature" : "seal";
        var subFolder = assetType == "signature" ? "signatures" : "seals";
        var assetId = Guid.NewGuid().ToString("N");

        // Save image to disk using distinct identifier so existing files are preserved
        var savedPath = ImageStorageHelper.SaveBase64Image(dto.ImageData, subFolder, $"{tenant.Id}_{assetId}", _env.ContentRootPath);
        if (string.IsNullOrWhiteSpace(savedPath))
            return BadRequest(new { message = "Failed to process image data." });

        var now = DateTime.UtcNow.ToString("O");
        var newItem = new TenantAssetItemDto(
            Id: assetId,
            Title: string.IsNullOrWhiteSpace(dto.Title) ? (assetType == "signature" ? "Digital Signature" : "Official Seal") : dto.Title.Trim(),
            Url: savedPath,
            IsDefault: dto.SetAsDefault,
            Name: string.IsNullOrWhiteSpace(dto.SignatoryName) ? null : dto.SignatoryName.Trim(),
            CreatedAt: now
        );

        if (assetType == "seal")
        {
            var list = new List<TenantAssetItemDto>();
            if (!string.IsNullOrWhiteSpace(tenant.OfficialSealsJson))
            {
                try {
                    list = (System.Text.Json.JsonSerializer.Deserialize<List<TenantAssetItemDto>>(tenant.OfficialSealsJson, _assetJsonOptions) ?? new List<TenantAssetItemDto>())
                        .Where(x => !string.IsNullOrWhiteSpace(x.Url))
                        .ToList();
                } catch { }
            }
            if (dto.SetAsDefault || list.Count == 0)
            {
                list = list.Select(x => x with { IsDefault = false }).ToList();
                tenant.OfficialSeal = savedPath;
            }
            list.Add(newItem);
            tenant.OfficialSealsJson = System.Text.Json.JsonSerializer.Serialize(list, _assetJsonOptions);
        }
        else
        {
            var list = new List<TenantAssetItemDto>();
            if (!string.IsNullOrWhiteSpace(tenant.DigitalSignaturesJson))
            {
                try {
                    list = (System.Text.Json.JsonSerializer.Deserialize<List<TenantAssetItemDto>>(tenant.DigitalSignaturesJson, _assetJsonOptions) ?? new List<TenantAssetItemDto>())
                        .Where(x => !string.IsNullOrWhiteSpace(x.Url))
                        .ToList();
                } catch { }
            }
            if (dto.SetAsDefault || list.Count == 0)
            {
                list = list.Select(x => x with { IsDefault = false }).ToList();
                tenant.DigitalSignature = savedPath;
            }
            list.Add(newItem);
            tenant.DigitalSignaturesJson = System.Text.Json.JsonSerializer.Serialize(list, _assetJsonOptions);
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = $"{newItem.Title} saved & applied successfully.",
            asset = newItem,
            officialSeal = tenant.OfficialSeal,
            digitalSignature = tenant.DigitalSignature,
            officialSealsJson = tenant.OfficialSealsJson,
            digitalSignaturesJson = tenant.DigitalSignaturesJson
        });
    }

    [HttpPost("assets/set-default")]
    public async Task<ActionResult> SetDefaultTenantAsset([FromBody] SetDefaultTenantAssetDto dto)
    {
        var targetTenantId = _currentUser.TenantId;
        var tenant = await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == targetTenantId);
        if (tenant == null) return NotFound(new { message = "Institute not found." });

        var assetType = dto.AssetType?.ToLowerInvariant() == "signature" ? "signature" : "seal";

        if (assetType == "seal")
        {
            if (string.IsNullOrWhiteSpace(tenant.OfficialSealsJson)) return NotFound(new { message = "No seals configured." });
            var list = (System.Text.Json.JsonSerializer.Deserialize<List<TenantAssetItemDto>>(tenant.OfficialSealsJson, _assetJsonOptions) ?? new List<TenantAssetItemDto>())
                .Where(x => !string.IsNullOrWhiteSpace(x.Url))
                .ToList();
            var target = list.FirstOrDefault(x => x.Id == dto.AssetId || x.Url == dto.AssetId);
            if (target == null) return NotFound(new { message = "Seal not found." });

            list = list.Select(x => x with { IsDefault = (x.Id == target.Id) }).ToList();
            tenant.OfficialSeal = target.Url;
            tenant.OfficialSealsJson = System.Text.Json.JsonSerializer.Serialize(list, _assetJsonOptions);
        }
        else
        {
            if (string.IsNullOrWhiteSpace(tenant.DigitalSignaturesJson)) return NotFound(new { message = "No signatures configured." });
            var list = (System.Text.Json.JsonSerializer.Deserialize<List<TenantAssetItemDto>>(tenant.DigitalSignaturesJson, _assetJsonOptions) ?? new List<TenantAssetItemDto>())
                .Where(x => !string.IsNullOrWhiteSpace(x.Url))
                .ToList();
            var target = list.FirstOrDefault(x => x.Id == dto.AssetId || x.Url == dto.AssetId);
            if (target == null) return NotFound(new { message = "Signature not found." });

            list = list.Select(x => x with { IsDefault = (x.Id == target.Id) }).ToList();
            tenant.DigitalSignature = target.Url;
            tenant.DigitalSignaturesJson = System.Text.Json.JsonSerializer.Serialize(list, _assetJsonOptions);
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "Default asset updated successfully.",
            officialSeal = tenant.OfficialSeal,
            digitalSignature = tenant.DigitalSignature,
            officialSealsJson = tenant.OfficialSealsJson,
            digitalSignaturesJson = tenant.DigitalSignaturesJson
        });
    }

    [HttpDelete("assets/{assetType}/{assetId}")]
    public async Task<ActionResult> DeleteTenantAsset(string assetType, string assetId)
    {
        var targetTenantId = _currentUser.TenantId;
        var tenant = await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == targetTenantId);
        if (tenant == null) return NotFound(new { message = "Institute not found." });

        var normalizedType = assetType?.ToLowerInvariant() == "signature" ? "signature" : "seal";

        if (normalizedType == "seal")
        {
            if (string.IsNullOrWhiteSpace(tenant.OfficialSealsJson)) return NotFound(new { message = "No seals configured." });
            var list = (System.Text.Json.JsonSerializer.Deserialize<List<TenantAssetItemDto>>(tenant.OfficialSealsJson, _assetJsonOptions) ?? new List<TenantAssetItemDto>())
                .Where(x => !string.IsNullOrWhiteSpace(x.Url))
                .ToList();
            var itemToRemove = list.FirstOrDefault(x => x.Id == assetId || x.Url == assetId);
            if (itemToRemove == null) return NotFound(new { message = "Seal not found." });

            list.Remove(itemToRemove);

            if (itemToRemove.IsDefault || tenant.OfficialSeal == itemToRemove.Url)
            {
                if (list.Count > 0)
                {
                    list[0] = list[0] with { IsDefault = true };
                    tenant.OfficialSeal = list[0].Url;
                }
                else
                {
                    tenant.OfficialSeal = null;
                }
            }

            tenant.OfficialSealsJson = System.Text.Json.JsonSerializer.Serialize(list, _assetJsonOptions);
        }
        else
        {
            if (string.IsNullOrWhiteSpace(tenant.DigitalSignaturesJson)) return NotFound(new { message = "No signatures configured." });
            var list = (System.Text.Json.JsonSerializer.Deserialize<List<TenantAssetItemDto>>(tenant.DigitalSignaturesJson, _assetJsonOptions) ?? new List<TenantAssetItemDto>())
                .Where(x => !string.IsNullOrWhiteSpace(x.Url))
                .ToList();
            var itemToRemove = list.FirstOrDefault(x => x.Id == assetId || x.Url == assetId);
            if (itemToRemove == null) return NotFound(new { message = "Signature not found." });

            list.Remove(itemToRemove);

            if (itemToRemove.IsDefault || tenant.DigitalSignature == itemToRemove.Url)
            {
                if (list.Count > 0)
                {
                    list[0] = list[0] with { IsDefault = true };
                    tenant.DigitalSignature = list[0].Url;
                }
                else
                {
                    tenant.DigitalSignature = null;
                }
            }

            tenant.DigitalSignaturesJson = System.Text.Json.JsonSerializer.Serialize(list, _assetJsonOptions);
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "Asset deleted successfully.",
            officialSeal = tenant.OfficialSeal,
            digitalSignature = tenant.DigitalSignature,
            officialSealsJson = tenant.OfficialSealsJson,
            digitalSignaturesJson = tenant.DigitalSignaturesJson
        });
    }
}
