using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
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
        var role = _currentUser.UserRole;
        bool isSuperAdmin = string.Equals(role, "SuperAdmin", StringComparison.OrdinalIgnoreCase) || _currentUser.IsSystemContext;
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

        config.UpdatedAt = DateTime.UtcNow;
        config.UpdatedBy = _currentUser.Username ?? "SuperAdmin";

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "SaaS Pricing & Plan Configuration updated successfully.",
            config
        });
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
}
