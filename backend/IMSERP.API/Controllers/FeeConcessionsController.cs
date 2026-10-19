using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/fees/concessions")]
[Authorize]
public class FeeConcessionsController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;

    public FeeConcessionsController(IIMSERPDbContext dbContext, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<List<StudentFeeConcessionDto>>> GetConcessions(
        [FromQuery] string? search = null,
        [FromQuery] string? concessionType = null,
        [FromQuery] string? status = null,
        [FromQuery] Guid? branchId = null)
    {
        var targetBranchId = branchId ?? _currentUser.BranchId;
        var query = _dbContext.StudentFeeConcessions
            .AsNoTracking()
            .Include(c => c.Student)
                .ThenInclude(s => s!.Class)
            .Include(c => c.Student)
                .ThenInclude(s => s!.Section)
            .Include(c => c.Student)
                .ThenInclude(s => s!.Batch)
            .Include(c => c.Branch)
            .Include(c => c.FeeHead)
            .AsQueryable();

        if (targetBranchId.HasValue && targetBranchId.Value != Guid.Empty)
        {
            query = query.Where(c => c.BranchId == null || c.BranchId == targetBranchId.Value);
        }

        if (!string.IsNullOrWhiteSpace(concessionType) && concessionType != "all")
        {
            query = query.Where(c => c.ConcessionType == concessionType);
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "all")
        {
            query = query.Where(c => c.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c =>
                c.Title.ToLower().Contains(s) ||
                (c.Student != null && (
                    c.Student.StudentName.ToLower().Contains(s) ||
                    (c.Student.RollNumber != null && c.Student.RollNumber.ToLower().Contains(s)) ||
                    (c.Student.AdmissionNumber != null && c.Student.AdmissionNumber.ToLower().Contains(s))
                ))
            );
        }

        var list = await query
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new StudentFeeConcessionDto(
                c.Id,
                c.StudentId,
                c.Student != null ? c.Student.StudentName : "Unknown",
                c.Student != null ? c.Student.RollNumber : "N/A",
                c.Student != null ? c.Student.AdmissionNumber : null,
                c.Student != null
                    ? (c.Student.Class != null
                        ? $"{c.Student.Class.Name}{(c.Student.Section != null ? " - " + c.Student.Section.Name : "")}"
                        : (c.Student.Batch != null ? c.Student.Batch.Name : "N/A"))
                    : "N/A",
                c.BranchId,
                c.Branch != null ? c.Branch.Name : null,
                c.ConcessionType,
                c.Title,
                c.DiscountMode,
                c.DiscountValue,
                c.FeeHeadId,
                c.FeeHead != null ? c.FeeHead.Name : null,
                c.ApplicableFrom,
                c.ApplicableTo,
                c.Status,
                c.ApprovedBy,
                c.Remarks,
                c.CreatedAt
            ))
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("stats")]
    public async Task<ActionResult<FeeConcessionStatsDto>> GetConcessionStats([FromQuery] Guid? branchId = null)
    {
        var targetBranchId = branchId ?? _currentUser.BranchId;
        var query = _dbContext.StudentFeeConcessions.AsNoTracking().AsQueryable();

        if (targetBranchId.HasValue && targetBranchId.Value != Guid.Empty)
        {
            query = query.Where(c => c.BranchId == null || c.BranchId == targetBranchId.Value);
        }

        var activeList = await query.Where(c => c.Status == "Active").ToListAsync();
        var totalActive = activeList.Count;
        var siblingCount = activeList.Count(c => c.ConcessionType == "SiblingDiscount");
        var meritCount = activeList.Count(c => c.ConcessionType == "MeritScholarship");
        var ewsCount = activeList.Count(c => c.ConcessionType == "EWS_RTE");

        // Sum concession amount from FeeInvoices
        var invoiceQuery = _dbContext.FeeInvoices.AsNoTracking().Where(i => i.Status != Domain.Enums.InvoiceStatus.Cancelled);
        if (targetBranchId.HasValue && targetBranchId.Value != Guid.Empty)
        {
            invoiceQuery = invoiceQuery.Where(i => i.BranchId == null || i.BranchId == targetBranchId.Value);
        }
        var totalConcessionBilled = await invoiceQuery.SumAsync(i => i.ConcessionAmount);

        return Ok(new FeeConcessionStatsDto(
            totalActive,
            siblingCount,
            meritCount,
            ewsCount,
            totalConcessionBilled
        ));
    }

    [HttpPost]
    public async Task<ActionResult<StudentFeeConcessionDto>> CreateConcession([FromBody] CreateFeeConcessionDto dto)
    {
        if (dto.StudentId == Guid.Empty)
            return BadRequest("StudentId is required.");

        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest("Title is required.");

        if (dto.DiscountValue <= 0)
            return BadRequest("Discount value must be greater than zero.");

        var student = await _dbContext.Students
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .Include(s => s.Branch)
            .FirstOrDefaultAsync(s => s.Id == dto.StudentId);

        if (student == null)
            return NotFound("Student not found.");

        var feeHead = dto.FeeHeadId.HasValue
            ? await _dbContext.FeeHeads.FindAsync(dto.FeeHeadId.Value)
            : null;

        var concession = new StudentFeeConcession
        {
            Id = Guid.NewGuid(),
            TenantId = _currentUser.TenantId,
            BranchId = student.BranchId ?? _currentUser.BranchId,
            StudentId = student.Id,
            ConcessionType = !string.IsNullOrWhiteSpace(dto.ConcessionType) ? dto.ConcessionType : "SpecialManagement",
            Title = dto.Title.Trim(),
            DiscountMode = dto.DiscountMode == "FixedAmount" ? "FixedAmount" : "Percentage",
            DiscountValue = dto.DiscountValue,
            FeeHeadId = dto.FeeHeadId,
            ApplicableFrom = dto.ApplicableFrom ?? DateTime.UtcNow,
            ApplicableTo = dto.ApplicableTo,
            Status = "Active",
            ApprovedBy = !string.IsNullOrWhiteSpace(dto.ApprovedBy) ? dto.ApprovedBy.Trim() : "Administration",
            Remarks = dto.Remarks?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.StudentFeeConcessions.Add(concession);
        await _dbContext.SaveChangesAsync();

        var resultDto = new StudentFeeConcessionDto(
            concession.Id,
            student.Id,
            student.StudentName,
            student.RollNumber,
            student.AdmissionNumber,
            student.Class != null
                ? $"{student.Class.Name}{(student.Section != null ? " - " + student.Section.Name : "")}"
                : (student.Batch != null ? student.Batch.Name : "N/A"),
            concession.BranchId,
            student.Branch?.Name,
            concession.ConcessionType,
            concession.Title,
            concession.DiscountMode,
            concession.DiscountValue,
            concession.FeeHeadId,
            feeHead?.Name,
            concession.ApplicableFrom,
            concession.ApplicableTo,
            concession.Status,
            concession.ApprovedBy,
            concession.Remarks,
            concession.CreatedAt
        );

        return Ok(resultDto);
    }

    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateFeeConcessionStatusDto dto)
    {
        var concession = await _dbContext.StudentFeeConcessions.FirstOrDefaultAsync(c => c.Id == id);
        if (concession == null)
            return NotFound("Concession not found.");

        concession.Status = dto.Status;
        if (!string.IsNullOrWhiteSpace(dto.Remarks))
        {
            concession.Remarks = dto.Remarks.Trim();
        }

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = $"Concession status updated to {dto.Status}." });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteConcession(Guid id)
    {
        var concession = await _dbContext.StudentFeeConcessions.FirstOrDefaultAsync(c => c.Id == id);
        if (concession == null)
            return NotFound("Concession not found.");

        _dbContext.StudentFeeConcessions.Remove(concession);
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = "Concession removed successfully." });
    }
}
