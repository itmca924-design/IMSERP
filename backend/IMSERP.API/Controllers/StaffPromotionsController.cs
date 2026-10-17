using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/staff-promotions")]
[Authorize]
public class StaffPromotionsController : ControllerBase
{
    private readonly IIMSERPDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public StaffPromotionsController(IIMSERPDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    [HttpGet]
    public async Task<IActionResult> GetPromotions(
        [FromQuery] Guid? teacherId,
        [FromQuery] string? type,
        [FromQuery] string? staffType,
        [FromQuery] string? department,
        [FromQuery] string? cycle,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? search,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? sortBy = "effectiveDate",
        [FromQuery] string? sortDirection = "desc")
    {
        var tenantId = _currentUserService.TenantId;
        var query = _context.StaffPromotionIncrements
            .Include(p => p.Teacher)
            .AsNoTracking()
            .AsQueryable();

        if (teacherId.HasValue && teacherId.Value != Guid.Empty)
        {
            query = query.Where(p => p.TeacherId == teacherId.Value);
        }

        if (!string.IsNullOrWhiteSpace(type))
        {
            query = query.Where(p => p.Type.ToLower() == type.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(staffType))
        {
            var stStr = staffType.Trim();
            if (Enum.TryParse<IMSERP.Domain.Enums.StaffType>(stStr, true, out var parsedSt))
            {
                query = query.Where(p => p.Teacher != null && p.Teacher.StaffType == parsedSt);
            }
        }

        if (!string.IsNullOrWhiteSpace(department))
        {
            query = query.Where(p => p.Teacher != null && p.Teacher.Department != null && p.Teacher.Department.ToLower() == department.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(cycle) && cycle.ToLower() != "all")
        {
            var cyc = cycle.Trim().ToLower();
            query = query.Where(p => p.Reason != null && p.Reason.ToLower().Contains(cyc));
        }

        if (startDate.HasValue)
        {
            query = query.Where(p => p.EffectiveDate >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            query = query.Where(p => p.EffectiveDate <= endDate.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            query = query.Where(p =>
                (p.Teacher != null && (p.Teacher.FullName.ToLower().Contains(q) || p.Teacher.EmployeeCode.ToLower().Contains(q))) ||
                p.NewDesignation.ToLower().Contains(q) ||
                p.OldDesignation.ToLower().Contains(q) ||
                (p.Reason != null && p.Reason.ToLower().Contains(q)));
        }

        // Summary KPI statistics computed over the filtered context
        var totalRecords = await query.CountAsync();
        var totalPromotions = await query.CountAsync(r => r.Type == "Promotion" || r.Type == "PromotionAndIncrement");
        var totalIncrements = await query.CountAsync(r => r.Type == "Increment" || r.Type == "PromotionAndIncrement");
        var totalMonthlyGrossHike = await query.Where(r => r.NewGrossSalary > r.OldGrossSalary)
            .SumAsync(r => (decimal?)(r.NewGrossSalary - r.OldGrossSalary)) ?? 0;
        var avgHike = await query.Where(r => r.IncrementPercentage.HasValue && r.IncrementPercentage > 0)
            .AverageAsync(r => (double?)r.IncrementPercentage) ?? 0;

        // Dynamic Appraisal Cycles present in the database
        var distinctCycles = await _context.StaffPromotionIncrements
            .AsNoTracking()
            .Where(r => !string.IsNullOrWhiteSpace(r.Reason))
            .Select(r => r.Reason!.Trim())
            .Distinct()
            .OrderBy(c => c)
            .Take(50)
            .ToListAsync();

        // Server-Side Sorting
        bool isAsc = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase);
        query = (sortBy?.ToLower()) switch
        {
            "teachername" => isAsc ? query.OrderBy(p => p.Teacher != null ? p.Teacher.FullName : "").ThenBy(p => p.EffectiveDate)
                                  : query.OrderByDescending(p => p.Teacher != null ? p.Teacher.FullName : "").ThenByDescending(p => p.EffectiveDate),
            "type" => isAsc ? query.OrderBy(p => p.Type).ThenBy(p => p.EffectiveDate)
                            : query.OrderByDescending(p => p.Type).ThenByDescending(p => p.EffectiveDate),
            "newdesignation" => isAsc ? query.OrderBy(p => p.NewDesignation).ThenBy(p => p.EffectiveDate)
                                      : query.OrderByDescending(p => p.NewDesignation).ThenByDescending(p => p.EffectiveDate),
            "newgrosssalary" => isAsc ? query.OrderBy(p => p.NewGrossSalary).ThenBy(p => p.EffectiveDate)
                                      : query.OrderByDescending(p => p.NewGrossSalary).ThenByDescending(p => p.EffectiveDate),
            "reason" => isAsc ? query.OrderBy(p => p.Reason).ThenBy(p => p.EffectiveDate)
                              : query.OrderByDescending(p => p.Reason).ThenByDescending(p => p.EffectiveDate),
            _ => isAsc ? query.OrderBy(p => p.EffectiveDate).ThenBy(p => p.CreatedAt)
                       : query.OrderByDescending(p => p.EffectiveDate).ThenByDescending(p => p.CreatedAt)
        };

        // Server-Side Pagination
        if (pageSize < 1) pageSize = 10;
        if (pageNumber < 1) pageNumber = 1;

        var pagedRecords = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var dtos = pagedRecords.Select(r => new StaffPromotionIncrementDto(
            r.Id,
            r.TenantId,
            r.TeacherId,
            r.Teacher?.FullName ?? "Unknown",
            r.Teacher?.EmployeeCode ?? "-",
            r.Teacher?.StaffType.ToString() ?? "Teaching",
            r.Type,
            r.OldDesignation,
            r.NewDesignation,
            r.OldDepartment,
            r.NewDepartment,
            r.OldBasicSalary,
            r.NewBasicSalary,
            r.OldHRA,
            r.NewHRA,
            r.OldOtherAllowances,
            r.NewOtherAllowances,
            r.OldGrossSalary,
            r.NewGrossSalary,
            r.IncrementPercentage,
            r.IncrementAmount,
            r.EffectiveDate,
            r.Reason,
            r.Remarks,
            r.ApprovedBy,
            r.ApprovalDate,
            r.Status,
            r.CreatedAt,
            r.Teacher?.PhotoUrl
        )).ToList();

        var totalPages = (int)Math.Ceiling((double)totalRecords / pageSize);

        return Ok(new
        {
            summary = new StaffPromotionSummaryDto(
                totalRecords,
                totalPromotions,
                totalIncrements,
                totalMonthlyGrossHike,
                Math.Round((decimal)avgHike, 1)
            ),
            records = dtos,
            totalCount = totalRecords,
            pageNumber,
            pageSize,
            totalPages = totalPages > 0 ? totalPages : 1,
            distinctCycles
        });
    }

    [HttpGet("cycles")]
    public async Task<IActionResult> GetAppraisalCycles()
    {
        var cycles = await _context.StaffPromotionIncrements
            .AsNoTracking()
            .Where(r => !string.IsNullOrWhiteSpace(r.Reason))
            .Select(r => r.Reason!.Trim())
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();

        return Ok(cycles);
    }

    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments()
    {
        var dbDepts = await _context.Teachers
            .AsNoTracking()
            .Where(t => !string.IsNullOrWhiteSpace(t.Department))
            .Select(t => t.Department!.Trim())
            .Distinct()
            .OrderBy(d => d)
            .ToListAsync();

        return Ok(dbDepts);
    }

    [HttpGet("policy")]
    public async Task<IActionResult> GetPolicy()
    {
        var tenantId = _currentUserService.TenantId;
        StaffAppraisalPolicySettings? policy = null;
        try
        {
            policy = await _context.StaffAppraisalPolicies
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.TenantId == tenantId);
        }
        catch
        {
            // Fallback to default policy if table is not yet initialized
        }

        if (policy == null)
        {
            policy = new StaffAppraisalPolicySettings
            {
                TenantId = tenantId,
                MinServiceMonthsForIncrement = 12,
                EnforceDryPromotionInProbation = true,
                AllowSpecialBypass = true,
                BypassApprovalRole = "SuperAdmin,InstituteAdmin,HR"
            };
        }

        return Ok(new StaffAppraisalPolicyDto(
            policy.MinServiceMonthsForIncrement,
            policy.EnforceDryPromotionInProbation,
            policy.AllowSpecialBypass,
            policy.BypassApprovalRole,
            policy.UpdatedAt
        ));
    }

    [HttpPost("policy")]
    public async Task<IActionResult> UpdatePolicy([FromBody] UpdateStaffAppraisalPolicyDto dto)
    {
        var tenantId = _currentUserService.TenantId;
        var policy = await _context.StaffAppraisalPolicies
            .FirstOrDefaultAsync(p => p.TenantId == tenantId);

        if (policy == null)
        {
            policy = new StaffAppraisalPolicySettings
            {
                TenantId = tenantId
            };
            _context.StaffAppraisalPolicies.Add(policy);
        }

        policy.MinServiceMonthsForIncrement = Math.Max(0, dto.MinServiceMonthsForIncrement);
        policy.EnforceDryPromotionInProbation = dto.EnforceDryPromotionInProbation;
        policy.AllowSpecialBypass = dto.AllowSpecialBypass;
        policy.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new StaffAppraisalPolicyDto(
            policy.MinServiceMonthsForIncrement,
            policy.EnforceDryPromotionInProbation,
            policy.AllowSpecialBypass,
            policy.BypassApprovalRole,
            policy.UpdatedAt
        ));
    }

    [HttpPost]
    public async Task<IActionResult> CreatePromotion([FromBody] CreateStaffPromotionIncrementDto dto)
    {
        if (dto.TeacherId == Guid.Empty)
            return BadRequest(new { message = "TeacherId is required." });

        var teacher = await _context.Teachers.FirstOrDefaultAsync(t => t.Id == dto.TeacherId);
        if (teacher == null)
            return NotFound(new { message = "Staff member not found." });

        var tenantId = _currentUserService.TenantId != Guid.Empty ? _currentUserService.TenantId : teacher.TenantId;

        // Current active salary snapshot
        var currentActiveSalary = await _context.TeacherSalaries
            .Where(s => s.TeacherId == teacher.Id && s.IsActive)
            .OrderByDescending(s => s.EffectiveFrom)
            .FirstOrDefaultAsync();

        var oldBasic = currentActiveSalary?.BasicSalary ?? 0;
        var oldHRA = currentActiveSalary?.HRA ?? 0;
        var oldAllowances = currentActiveSalary?.OtherAllowances ?? 0;
        var oldGross = oldBasic + oldHRA + oldAllowances;

        var oldDesignation = teacher.Designation ?? "Faculty";
        var oldDept = teacher.Department;

        var type = string.IsNullOrWhiteSpace(dto.Type) ? "PromotionAndIncrement" : dto.Type.Trim();
        var isPromotion = type == "Promotion" || type == "PromotionAndIncrement";
        var isIncrement = type == "Increment" || type == "PromotionAndIncrement";

        var newDesignation = isPromotion && !string.IsNullOrWhiteSpace(dto.NewDesignation) ? dto.NewDesignation.Trim() : oldDesignation;
        var newDept = isPromotion && !string.IsNullOrWhiteSpace(dto.NewDepartment) ? dto.NewDepartment.Trim() : oldDept;

        decimal newBasic = oldBasic;
        decimal newHRA = oldHRA;
        decimal newAllowances = oldAllowances;

        if (isIncrement)
        {
            newBasic = dto.NewBasicSalary ?? oldBasic;
            newHRA = dto.NewHRA ?? oldHRA;
            newAllowances = dto.NewOtherAllowances ?? oldAllowances;
        }

        var newGross = newBasic + newHRA + newAllowances;

        decimal? incrementAmount = dto.IncrementAmount;
        if (!incrementAmount.HasValue && isIncrement)
        {
            incrementAmount = Math.Max(0, newGross - oldGross);
        }

        decimal? incrementPct = dto.IncrementPercentage;
        if (!incrementPct.HasValue && isIncrement && oldGross > 0)
        {
            incrementPct = Math.Round(((newGross - oldGross) / oldGross) * 100, 2);
        }

        var effectiveDate = dto.EffectiveDate != default ? dto.EffectiveDate : DateTime.UtcNow;

        // Dynamic Tenure & Policy Check for Financial Salary Increment
        if (isIncrement)
        {
            StaffAppraisalPolicySettings? policy = null;
            try
            {
                policy = await _context.StaffAppraisalPolicies
                    .AsNoTracking()
                    .FirstOrDefaultAsync(p => p.TenantId == tenantId);
            }
            catch {}

            int minMonths = policy?.MinServiceMonthsForIncrement ?? 12;
            bool enforce = policy?.EnforceDryPromotionInProbation ?? true;

            if (enforce && minMonths > 0)
            {
                var joiningDate = teacher.JoiningDate != default ? teacher.JoiningDate : teacher.CreatedAt;
                var tenureMonths = ((effectiveDate.Year - joiningDate.Year) * 12) + effectiveDate.Month - joiningDate.Month;
                if (effectiveDate.Day < joiningDate.Day) tenureMonths--;
                tenureMonths = Math.Max(0, tenureMonths);

                if (tenureMonths < minMonths)
                {
                    bool allowBypass = policy?.AllowSpecialBypass ?? true;
                    if (!dto.IsSpecialBypass || !allowBypass)
                    {
                        return BadRequest(new { 
                            message = $"Staff member {teacher.FullName} has completed {tenureMonths} month(s) of service. Institute policy requires minimum {minMonths} months for financial increments. Only 'Promotion Only (Dry)' is allowed during this period." 
                        });
                    }
                }
            }
        }

        // 1. Update Teacher profile designation & department if promotion
        if (isPromotion)
        {
            teacher.Designation = newDesignation;
            if (!string.IsNullOrWhiteSpace(newDept))
            {
                teacher.Department = newDept;
            }
        }

        // 2. Update TeacherSalary active structure if increment
        if (isIncrement && (newBasic != oldBasic || newHRA != oldHRA || newAllowances != oldAllowances || currentActiveSalary == null))
        {
            if (currentActiveSalary != null)
            {
                currentActiveSalary.IsActive = false;
                currentActiveSalary.EffectiveTo = effectiveDate.AddDays(-1);
            }

            var newSalary = new TeacherSalary
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                TeacherId = teacher.Id,
                BasicSalary = newBasic,
                HRA = newHRA,
                OtherAllowances = newAllowances,
                PFDeduction = currentActiveSalary?.PFDeduction ?? 0,
                TDSDeduction = currentActiveSalary?.TDSDeduction ?? 0,
                OtherDeductions = currentActiveSalary?.OtherDeductions ?? 0,
                EffectiveFrom = effectiveDate,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            _context.TeacherSalaries.Add(newSalary);
        }

        // 3. Create StaffPromotionIncrement audit record
        var record = new StaffPromotionIncrement
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = teacher.BranchId,
            TeacherId = teacher.Id,
            Type = type,
            OldDesignation = oldDesignation,
            NewDesignation = newDesignation,
            OldDepartment = oldDept,
            NewDepartment = newDept,
            OldBasicSalary = oldBasic,
            NewBasicSalary = newBasic,
            OldHRA = oldHRA,
            NewHRA = newHRA,
            OldOtherAllowances = oldAllowances,
            NewOtherAllowances = newAllowances,
            OldGrossSalary = oldGross,
            NewGrossSalary = newGross,
            IncrementPercentage = incrementPct,
            IncrementAmount = incrementAmount,
            EffectiveDate = effectiveDate,
            Reason = dto.IsSpecialBypass 
                ? $"[Special Bypass: {dto.SpecialBypassReason ?? "Management Approval"}] {dto.Reason ?? "Annual Appraisal"}" 
                : (dto.Reason ?? "Annual Appraisal / Performance Promotion"),
            Remarks = dto.Remarks,
            ApprovedBy = "Admin",
            ApprovalDate = DateTime.UtcNow,
            Status = "Approved",
            CreatedAt = DateTime.UtcNow
        };

        _context.StaffPromotionIncrements.Add(record);
        await _context.SaveChangesAsync();

        var resultDto = new StaffPromotionIncrementDto(
            record.Id,
            record.TenantId,
            record.TeacherId,
            teacher.FullName,
            teacher.EmployeeCode,
            teacher.StaffType.ToString(),
            record.Type,
            record.OldDesignation,
            record.NewDesignation,
            record.OldDepartment,
            record.NewDepartment,
            record.OldBasicSalary,
            record.NewBasicSalary,
            record.OldHRA,
            record.NewHRA,
            record.OldOtherAllowances,
            record.NewOtherAllowances,
            record.OldGrossSalary,
            record.NewGrossSalary,
            record.IncrementPercentage,
            record.IncrementAmount,
            record.EffectiveDate,
            record.Reason,
            record.Remarks,
            record.ApprovedBy,
            record.ApprovalDate,
            record.Status,
            record.CreatedAt,
            teacher.PhotoUrl
        );

        return Ok(new { success = true, message = "Staff promotion / appraisal recorded successfully.", data = resultDto });
    }

    [HttpPost("bulk-increment")]
    public async Task<IActionResult> BulkIncrement([FromBody] BulkIncrementDto dto)
    {
        if (dto.IncrementValue <= 0)
            return BadRequest(new { message = "Increment value must be greater than zero." });

        var query = _context.Teachers.Where(t => t.IsActive).AsQueryable();

        if (!string.IsNullOrWhiteSpace(dto.StaffType) && dto.StaffType.ToLower() != "all")
        {
            if (Enum.TryParse<IMSERP.Domain.Enums.StaffType>(dto.StaffType.Trim(), true, out var parsedSt))
            {
                query = query.Where(t => t.StaffType == parsedSt);
            }
        }

        if (!string.IsNullOrWhiteSpace(dto.Department) && dto.Department.ToLower() != "all")
        {
            query = query.Where(t => t.Department != null && t.Department.ToLower() == dto.Department.ToLower());
        }

        var teachers = await query.ToListAsync();
        if (!teachers.Any())
            return NotFound(new { message = "No matching active staff members found for bulk increment." });

        var effectiveDate = dto.EffectiveDate != default ? dto.EffectiveDate : DateTime.UtcNow;
        var count = 0;
        decimal totalMonthlyBudgetHike = 0;

        foreach (var teacher in teachers)
        {
            var currentSalary = await _context.TeacherSalaries
                .Where(s => s.TeacherId == teacher.Id && s.IsActive)
                .OrderByDescending(s => s.EffectiveFrom)
                .FirstOrDefaultAsync();

            var oldBasic = currentSalary?.BasicSalary ?? 0;
            var oldHRA = currentSalary?.HRA ?? 0;
            var oldAllowances = currentSalary?.OtherAllowances ?? 0;
            var oldGross = oldBasic + oldHRA + oldAllowances;

            decimal newBasic;
            decimal newHRA = oldHRA;
            decimal newAllowances = oldAllowances;

            if (dto.IncrementType.ToLower() == "percentage")
            {
                var factor = 1 + (dto.IncrementValue / 100m);
                newBasic = Math.Round(oldBasic * factor, 2);
                newHRA = Math.Round(oldHRA * factor, 2);
                newAllowances = Math.Round(oldAllowances * factor, 2);
            }
            else
            {
                // Flat amount added to basic
                newBasic = oldBasic + dto.IncrementValue;
            }

            var newGross = newBasic + newHRA + newAllowances;
            var hikeAmount = Math.Max(0, newGross - oldGross);
            totalMonthlyBudgetHike += hikeAmount;

            if (currentSalary != null)
            {
                currentSalary.IsActive = false;
                currentSalary.EffectiveTo = effectiveDate.AddDays(-1);
            }

            var newSalary = new TeacherSalary
            {
                Id = Guid.NewGuid(),
                TenantId = teacher.TenantId,
                TeacherId = teacher.Id,
                BasicSalary = newBasic,
                HRA = newHRA,
                OtherAllowances = newAllowances,
                PFDeduction = currentSalary?.PFDeduction ?? 0,
                TDSDeduction = currentSalary?.TDSDeduction ?? 0,
                OtherDeductions = currentSalary?.OtherDeductions ?? 0,
                EffectiveFrom = effectiveDate,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            _context.TeacherSalaries.Add(newSalary);

            var pct = oldGross > 0 ? Math.Round(((newGross - oldGross) / oldGross) * 100, 2) : dto.IncrementValue;

            var record = new StaffPromotionIncrement
            {
                Id = Guid.NewGuid(),
                TenantId = teacher.TenantId,
                BranchId = teacher.BranchId,
                TeacherId = teacher.Id,
                Type = "Increment",
                OldDesignation = teacher.Designation ?? "Staff",
                NewDesignation = teacher.Designation ?? "Staff",
                OldDepartment = teacher.Department,
                NewDepartment = teacher.Department,
                OldBasicSalary = oldBasic,
                NewBasicSalary = newBasic,
                OldHRA = oldHRA,
                NewHRA = newHRA,
                OldOtherAllowances = oldAllowances,
                NewOtherAllowances = newAllowances,
                OldGrossSalary = oldGross,
                NewGrossSalary = newGross,
                IncrementPercentage = pct,
                IncrementAmount = hikeAmount,
                EffectiveDate = effectiveDate,
                Reason = dto.Reason ?? $"Bulk Annual Appraisal ({dto.IncrementValue}{(dto.IncrementType.ToLower() == "percentage" ? "%" : " flat")})",
                Remarks = dto.Remarks,
                ApprovedBy = "Admin",
                ApprovalDate = DateTime.UtcNow,
                Status = "Approved",
                CreatedAt = DateTime.UtcNow
            };
            _context.StaffPromotionIncrements.Add(record);
            count++;
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = $"Bulk increment applied successfully to {count} staff members.",
            totalStaffUpdated = count,
            totalMonthlyGrossHike = totalMonthlyBudgetHike
        });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeletePromotion(Guid id)
    {
        var record = await _context.StaffPromotionIncrements.FirstOrDefaultAsync(p => p.Id == id);
        if (record == null)
            return NotFound(new { message = "Promotion/Appraisal record not found." });

        _context.StaffPromotionIncrements.Remove(record);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Record deleted successfully." });
    }
}

public record StaffPromotionIncrementDto(
    Guid Id,
    Guid TenantId,
    Guid TeacherId,
    string TeacherName,
    string EmployeeCode,
    string? StaffType,
    string Type,
    string OldDesignation,
    string NewDesignation,
    string? OldDepartment,
    string? NewDepartment,
    decimal OldBasicSalary,
    decimal NewBasicSalary,
    decimal OldHRA,
    decimal NewHRA,
    decimal OldOtherAllowances,
    decimal NewOtherAllowances,
    decimal OldGrossSalary,
    decimal NewGrossSalary,
    decimal? IncrementPercentage,
    decimal? IncrementAmount,
    DateTime EffectiveDate,
    string? Reason,
    string? Remarks,
    string? ApprovedBy,
    DateTime? ApprovalDate,
    string Status,
    DateTime CreatedAt,
    string? PhotoUrl = null
);

public record CreateStaffPromotionIncrementDto(
    Guid TeacherId,
    string Type,
    string? NewDesignation,
    string? NewDepartment,
    decimal? NewBasicSalary,
    decimal? NewHRA,
    decimal? NewOtherAllowances,
    decimal? IncrementPercentage,
    decimal? IncrementAmount,
    DateTime EffectiveDate,
    string? Reason,
    string? Remarks,
    bool IsSpecialBypass = false,
    string? SpecialBypassReason = null
);

public record StaffAppraisalPolicyDto(
    int MinServiceMonthsForIncrement,
    bool EnforceDryPromotionInProbation,
    bool AllowSpecialBypass,
    string? BypassApprovalRole,
    DateTime? UpdatedAt
);

public record UpdateStaffAppraisalPolicyDto(
    int MinServiceMonthsForIncrement,
    bool EnforceDryPromotionInProbation,
    bool AllowSpecialBypass
);

public record BulkIncrementDto(
    string? StaffType,
    string? Department,
    string IncrementType,
    decimal IncrementValue,
    DateTime EffectiveDate,
    string? Reason,
    string? Remarks
);

public record StaffPromotionSummaryDto(
    int TotalRecords,
    int TotalPromotions,
    int TotalIncrements,
    decimal TotalMonthlyGrossHike,
    decimal AverageHikePercentage
);
