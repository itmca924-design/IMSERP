using IMSERP.API.Services;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using IMSERP.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[SkipMenuPermission]
public class SubscriptionController : ControllerBase
{
    private readonly IMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;

    public SubscriptionController(IMSERPDbContext dbContext, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    [HttpGet("pricing-config")]
    [AllowAnonymous]
    public async Task<ActionResult<SubscriptionPlanConfig>> GetPricingConfig()
    {
        var config = await _dbContext.SubscriptionPlanConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.IsActive);

        if (config == null)
        {
            config = new SubscriptionPlanConfig
            {
                Id = Guid.NewGuid(),
                PlanCode = "PREMIUM",
                PlanName = "Premium Enterprise Edition",
                TrialDurationDays = 90,
                TrialFee = 3000.00m,
                AnnualOneTimePrice = 10000.00m,
                MonthlyRate = 1000.00m,
                AnnualMonthlyTotal = 12000.00m,
                SoftwareSetupFee = 15000.00m,
                MaxStudentsLimit = 1000,
                MaxBranchesLimit = 5,
                IsActive = true,
                UpdatedAt = DateTime.UtcNow,
                UpdatedBy = "SYSTEM"
            };
            _dbContext.SubscriptionPlanConfigs.Add(config);
            await _dbContext.SaveChangesAsync();
        }

        return Ok(config);
    }

    [HttpPut("pricing-config")]
    [Authorize]
    public async Task<ActionResult> UpdatePricingConfig([FromBody] UpdateSubscriptionPricingDto dto)
    {
        bool isSuperAdmin = await CheckIsSuperAdminAsync();
        if (!isSuperAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only Platform SuperAdmin can configure SaaS pricing tiers." });
        }

        var config = await _dbContext.SubscriptionPlanConfigs.FirstOrDefaultAsync(c => c.IsActive);
        if (config == null)
        {
            config = new SubscriptionPlanConfig { Id = Guid.NewGuid(), IsActive = true };
            _dbContext.SubscriptionPlanConfigs.Add(config);
        }

        if (dto.TrialDurationDays > 0) config.TrialDurationDays = dto.TrialDurationDays;
        if (dto.TrialFee >= 0) config.TrialFee = dto.TrialFee;
        if (dto.AnnualOneTimePrice >= 0) config.AnnualOneTimePrice = dto.AnnualOneTimePrice;
        if (dto.MonthlyRate >= 0) config.MonthlyRate = dto.MonthlyRate;
        if (dto.AnnualMonthlyTotal >= 0) config.AnnualMonthlyTotal = dto.AnnualMonthlyTotal;
        if (dto.SoftwareSetupFee >= 0) config.SoftwareSetupFee = dto.SoftwareSetupFee;
        if (dto.MaxStudentsLimit > 0) config.MaxStudentsLimit = dto.MaxStudentsLimit;
        if (dto.MaxBranchesLimit > 0) config.MaxBranchesLimit = dto.MaxBranchesLimit;
        if (!string.IsNullOrWhiteSpace(dto.PlanName)) config.PlanName = dto.PlanName.Trim();

        // Platform Payment Settings
        if (!string.IsNullOrWhiteSpace(dto.PlatformUpiId)) config.PlatformUpiId = dto.PlatformUpiId.Trim();
        if (!string.IsNullOrWhiteSpace(dto.PlatformPayeeName)) config.PlatformPayeeName = dto.PlatformPayeeName.Trim();
        if (!string.IsNullOrWhiteSpace(dto.PlatformBankName)) config.PlatformBankName = dto.PlatformBankName.Trim();
        if (!string.IsNullOrWhiteSpace(dto.PlatformBankAccountNumber)) config.PlatformBankAccountNumber = dto.PlatformBankAccountNumber.Trim();
        if (!string.IsNullOrWhiteSpace(dto.PlatformBankIfsc)) config.PlatformBankIfsc = dto.PlatformBankIfsc.Trim();

        config.UpdatedAt = DateTime.UtcNow;
        config.UpdatedBy = _currentUser.Username ?? "SuperAdmin";

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "SaaS Pricing & Plan Configuration updated successfully.",
            config
        });
    }

    [HttpPost("renewal-request")]
    [Authorize]
    public async Task<ActionResult> SubmitRenewalRequest([FromBody] SubmitRenewalRequestDto dto)
    {
        var tenantId = _currentUser.TenantId;
        if (tenantId == Guid.Empty)
        {
            return BadRequest(new { message = "Invalid tenant context." });
        }

        var tenant = await _dbContext.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId);

        if (tenant == null)
        {
            return NotFound(new { message = "Tenant not found." });
        }

        var config = await _dbContext.SubscriptionPlanConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.IsActive);

        decimal calculatedAmount = dto.BillingCycle.Equals("Annual", StringComparison.OrdinalIgnoreCase)
            ? ((config?.AnnualOneTimePrice ?? 10000m) + (config?.SoftwareSetupFee ?? 15000m))
            : ((config?.MonthlyRate ?? 1000m) + (config?.SoftwareSetupFee ?? 15000m));

        var request = new SubscriptionRenewalRequest
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            TenantCode = tenant.Code,
            InstituteName = tenant.Name,
            PlanCode = "PREMIUM",
            BillingCycle = dto.BillingCycle,
            Amount = dto.Amount > 0 ? dto.Amount : calculatedAmount,
            PaymentMode = string.IsNullOrWhiteSpace(dto.PaymentMode) ? "UPI" : dto.PaymentMode,
            UtrNumber = dto.UtrNumber?.Trim(),
            Notes = dto.Notes?.Trim(),
            Status = "Pending",
            RequestedAt = DateTime.UtcNow
        };

        _dbContext.SubscriptionRenewalRequests.Add(request);
        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "Subscription renewal payment details submitted successfully. Platform SuperAdmin has been notified for verification.",
            requestId = request.Id,
            amount = request.Amount,
            billingCycle = request.BillingCycle
        });
    }

    [HttpGet("renewal-requests")]
    [Authorize]
    public async Task<ActionResult> GetRenewalRequests([FromQuery] string? status = null)
    {
        bool isSuperAdmin = await CheckIsSuperAdminAsync();
        if (!isSuperAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only SuperAdmin can view subscription renewal requests." });
        }

        var query = _dbContext.SubscriptionRenewalRequests.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(r => r.Status == status);
        }

        var list = await query
            .OrderByDescending(r => r.RequestedAt)
            .Take(100)
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost("renewal-requests/{id}/approve")]
    [Authorize]
    public async Task<ActionResult> ApproveRenewalRequest(Guid id)
    {
        bool isSuperAdmin = await CheckIsSuperAdminAsync();
        if (!isSuperAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only SuperAdmin can approve subscription renewals." });
        }

        var request = await _dbContext.SubscriptionRenewalRequests.FirstOrDefaultAsync(r => r.Id == id);
        if (request == null)
        {
            return NotFound(new { message = "Renewal request not found." });
        }

        var tenant = await _dbContext.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == request.TenantId);

        if (tenant == null)
        {
            return NotFound(new { message = "Associated tenant institute not found." });
        }

        var config = await _dbContext.SubscriptionPlanConfigs.FirstOrDefaultAsync(c => c.IsActive);

        request.Status = "Approved";
        request.ProcessedAt = DateTime.UtcNow;
        request.ProcessedBy = _currentUser.Username ?? "SuperAdmin";

        // Auto activate 1-Year Premium for Annual or 1-Month for Monthly
        var baseDate = tenant.PaidUntil.HasValue && tenant.PaidUntil.Value > DateTime.UtcNow
            ? tenant.PaidUntil.Value
            : DateTime.UtcNow;

        if (request.BillingCycle.Equals("Annual", StringComparison.OrdinalIgnoreCase))
        {
            tenant.PaidUntil = baseDate.AddYears(1);
        }
        else
        {
            tenant.PaidUntil = baseDate.AddMonths(1);
        }

        tenant.SubscriptionPlan = "Premium";
        tenant.SubscriptionStatus = "Active";
        tenant.TrialEndDate = null;
        if (config != null)
        {
            tenant.MaxStudentsLimit = config.MaxStudentsLimit;
            tenant.MaxBranchesLimit = config.MaxBranchesLimit;
        }
        tenant.IsActive = true;

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = $"Subscription approved successfully! Institute '{tenant.Name}' is now active on Premium tier until {tenant.PaidUntil:yyyy-MM-dd}.",
            tenantId = tenant.Id,
            paidUntil = tenant.PaidUntil,
            status = tenant.SubscriptionStatus
        });
    }

    [HttpPost("renewal-requests/{id}/reject")]
    [Authorize]
    public async Task<ActionResult> RejectRenewalRequest(Guid id, [FromBody] RejectRenewalRequestDto? dto)
    {
        bool isSuperAdmin = await CheckIsSuperAdminAsync();
        if (!isSuperAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only SuperAdmin can reject subscription renewals." });
        }

        var request = await _dbContext.SubscriptionRenewalRequests.FirstOrDefaultAsync(r => r.Id == id);
        if (request == null)
        {
            return NotFound(new { message = "Renewal request not found." });
        }

        request.Status = "Rejected";
        request.ProcessedAt = DateTime.UtcNow;
        request.ProcessedBy = _currentUser.Username ?? "SuperAdmin";
        request.AdminRemarks = dto?.Remarks?.Trim() ?? "Payment details could not be verified.";

        await _dbContext.SaveChangesAsync();

        return Ok(new { message = "Renewal request rejected.", requestId = request.Id });
    }

    private async Task<bool> CheckIsSuperAdminAsync()
    {
        var role = _currentUser.UserRole;
        bool isSuperAdmin = string.Equals(role, "SuperAdmin", StringComparison.OrdinalIgnoreCase) || _currentUser.IsSystemContext;
        if (!isSuperAdmin && _currentUser.UserId != Guid.Empty)
        {
            var user = await _dbContext.Users
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);
            isSuperAdmin = user?.Role == UserRole.SuperAdmin;
        }
        return isSuperAdmin;
    }
}

public class UpdateSubscriptionPricingDto
{
    public string? PlanName { get; set; }
    public int TrialDurationDays { get; set; } = 90;
    public decimal TrialFee { get; set; } = 3000.00m;
    public decimal AnnualOneTimePrice { get; set; } = 10000.00m;
    public decimal MonthlyRate { get; set; } = 1000.00m;
    public decimal AnnualMonthlyTotal { get; set; } = 12000.00m;
    public decimal SoftwareSetupFee { get; set; } = 15000.00m;
    public int MaxStudentsLimit { get; set; } = 1000;
    public int MaxBranchesLimit { get; set; } = 5;
    public string? PlatformUpiId { get; set; }
    public string? PlatformPayeeName { get; set; }
    public string? PlatformBankName { get; set; }
    public string? PlatformBankAccountNumber { get; set; }
    public string? PlatformBankIfsc { get; set; }
}

public class SubmitRenewalRequestDto
{
    public string BillingCycle { get; set; } = "Annual"; // "Annual" or "Monthly"
    public decimal Amount { get; set; }
    public string? PaymentMode { get; set; } = "UPI";
    public string? UtrNumber { get; set; }
    public string? Notes { get; set; }
}

public class RejectRenewalRequestDto
{
    public string? Remarks { get; set; }
}
