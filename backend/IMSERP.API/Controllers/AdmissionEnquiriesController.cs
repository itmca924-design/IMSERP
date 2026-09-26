using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/enquiries")]
public class AdmissionEnquiriesController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public AdmissionEnquiriesController(IIMSERPDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AdmissionEnquiryDto>>> GetEnquiries(
        [FromQuery] string? status,
        [FromQuery] string? source,
        [FromQuery] string? priority,
        [FromQuery] string? search,
        [FromQuery] bool? followUpToday,
        [FromQuery] Guid? classId)
    {
        var tenantId = _currentUser.TenantId;
        var query = _db.AdmissionEnquiries
            .AsNoTracking()
            .Where(e => e.TenantId == tenantId);

        if (_currentUser.BranchId.HasValue)
        {
            var branchId = _currentUser.BranchId.Value;
            query = query.Where(e => !e.BranchId.HasValue || e.BranchId == branchId);
        }

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(e => e.Status.ToLower() == status.ToLower());

        if (!string.IsNullOrWhiteSpace(source))
            query = query.Where(e => e.Source.ToLower() == source.ToLower());

        if (!string.IsNullOrWhiteSpace(priority))
            query = query.Where(e => e.Priority.ToLower() == priority.ToLower());

        if (classId.HasValue && classId.Value != Guid.Empty)
            query = query.Where(e => e.InterestedClassId == classId.Value);

        if (followUpToday == true)
        {
            var today = DateTime.UtcNow.Date;
            query = query.Where(e => e.FollowUpDate.HasValue && e.FollowUpDate.Value.Date <= today && e.Status != "Admitted" && e.Status != "Lost");
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(e =>
                e.StudentName.ToLower().Contains(s) ||
                e.ParentName.ToLower().Contains(s) ||
                e.Phone.Contains(s) ||
                e.EnquiryNumber.ToLower().Contains(s));
        }

        var items = await query
            .OrderByDescending(e => e.EnquiryDate)
            .Select(e => new AdmissionEnquiryDto(
                e.Id,
                e.TenantId,
                e.BranchId,
                e.EnquiryNumber,
                e.StudentName,
                e.ParentName,
                e.Phone,
                e.AlternatePhone,
                e.Email,
                e.InterestedClassId,
                e.InterestedClassName,
                e.InterestedBatchId,
                e.InterestedBatchName,
                e.EnquiryDate,
                e.FollowUpDate,
                e.Source,
                e.Status,
                e.Priority,
                e.Remarks,
                e.ConvertedStudentId,
                e.ConvertedAt,
                e.CreatedBy,
                e.CreatedAt
            ))
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<AdmissionEnquiryDto>> GetEnquiryById(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var e = await _db.AdmissionEnquiries
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);

        if (e == null) return NotFound(new { message = "Enquiry record not found." });

        return Ok(new AdmissionEnquiryDto(
            e.Id,
            e.TenantId,
            e.BranchId,
            e.EnquiryNumber,
            e.StudentName,
            e.ParentName,
            e.Phone,
            e.AlternatePhone,
            e.Email,
            e.InterestedClassId,
            e.InterestedClassName,
            e.InterestedBatchId,
            e.InterestedBatchName,
            e.EnquiryDate,
            e.FollowUpDate,
            e.Source,
            e.Status,
            e.Priority,
            e.Remarks,
            e.ConvertedStudentId,
            e.ConvertedAt,
            e.CreatedBy,
            e.CreatedAt
        ));
    }

    [HttpGet("stats")]
    public async Task<ActionResult<EnquiryStatsDto>> GetEnquiryStats()
    {
        var tenantId = _currentUser.TenantId;
        var today = DateTime.Now.Date;

        var query = _db.AdmissionEnquiries.AsNoTracking().Where(e => e.TenantId == tenantId);
        if (_currentUser.BranchId.HasValue)
        {
            var branchId = _currentUser.BranchId.Value;
            query = query.Where(e => !e.BranchId.HasValue || e.BranchId == branchId);
        }

        var total = await query.CountAsync();
        var newCount = await query.CountAsync(e => e.Status == "New");
        var followUpPending = await query.CountAsync(e => e.FollowUpDate.HasValue && e.FollowUpDate.Value.Date <= today && e.Status != "Admitted" && e.Status != "Lost");
        var demoOrVisit = await query.CountAsync(e => e.Status == "Demo / Visit" || e.Status == "Contacted");
        var admitted = await query.CountAsync(e => e.Status == "Admitted");
        var lost = await query.CountAsync(e => e.Status == "Lost");

        double convRate = total > 0 ? Math.Round(((double)admitted / total) * 100, 1) : 0;

        return Ok(new EnquiryStatsDto(total, newCount, followUpPending, demoOrVisit, admitted, lost, convRate));
    }

    [HttpPost]
    public async Task<ActionResult<AdmissionEnquiryDto>> CreateEnquiry([FromBody] CreateAdmissionEnquiryDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.StudentName))
            return BadRequest(new { message = "Student name is required." });

        if (string.IsNullOrWhiteSpace(dto.Phone))
            return BadRequest(new { message = "Primary contact phone is required." });

        var tenantId = _currentUser.TenantId;
        var branchId = _currentUser.BranchId;

        // Auto-generate serial enquiry number: ENQ-2026-0001
        var now = DateTime.Now;
        var year = now.Year;
        var count = await _db.AdmissionEnquiries
            .CountAsync(e => e.TenantId == tenantId && e.EnquiryDate.Year == year);
        var enqNum = $"ENQ-{year}-{(count + 1):D4}";

        var enquiry = new AdmissionEnquiry
        {
            TenantId = tenantId,
            BranchId = branchId,
            EnquiryNumber = enqNum,
            StudentName = dto.StudentName.Trim(),
            ParentName = dto.ParentName?.Trim() ?? string.Empty,
            Phone = dto.Phone.Trim(),
            AlternatePhone = dto.AlternatePhone?.Trim(),
            Email = dto.Email?.Trim(),
            InterestedClassId = dto.InterestedClassId,
            InterestedClassName = dto.InterestedClassName,
            InterestedBatchId = dto.InterestedBatchId,
            InterestedBatchName = dto.InterestedBatchName,
            EnquiryDate = dto.EnquiryDate != default ? dto.EnquiryDate : now,
            FollowUpDate = dto.FollowUpDate,
            Source = !string.IsNullOrWhiteSpace(dto.Source) ? dto.Source : "Walk-in",
            Status = !string.IsNullOrWhiteSpace(dto.Status) ? dto.Status : "New",
            Priority = !string.IsNullOrWhiteSpace(dto.Priority) ? dto.Priority : "Medium",
            Remarks = dto.Remarks?.Trim(),
            CreatedBy = _currentUser.UserId.ToString(),
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.AdmissionEnquiries.Add(enquiry);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetEnquiryById), new { id = enquiry.Id }, new AdmissionEnquiryDto(
            enquiry.Id,
            enquiry.TenantId,
            enquiry.BranchId,
            enquiry.EnquiryNumber,
            enquiry.StudentName,
            enquiry.ParentName,
            enquiry.Phone,
            enquiry.AlternatePhone,
            enquiry.Email,
            enquiry.InterestedClassId,
            enquiry.InterestedClassName,
            enquiry.InterestedBatchId,
            enquiry.InterestedBatchName,
            enquiry.EnquiryDate,
            enquiry.FollowUpDate,
            enquiry.Source,
            enquiry.Status,
            enquiry.Priority,
            enquiry.Remarks,
            enquiry.ConvertedStudentId,
            enquiry.ConvertedAt,
            enquiry.CreatedBy,
            enquiry.CreatedAt
        ));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateEnquiry(Guid id, [FromBody] UpdateAdmissionEnquiryDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var enquiry = await _db.AdmissionEnquiries.FirstOrDefaultAsync(e => e.Id == id && e.TenantId == tenantId);
        if (enquiry == null) return NotFound(new { message = "Enquiry record not found." });

        enquiry.StudentName = dto.StudentName?.Trim() ?? enquiry.StudentName;
        enquiry.ParentName = dto.ParentName?.Trim() ?? enquiry.ParentName;
        enquiry.Phone = dto.Phone?.Trim() ?? enquiry.Phone;
        enquiry.AlternatePhone = dto.AlternatePhone?.Trim();
        enquiry.Email = dto.Email?.Trim();
        enquiry.InterestedClassId = dto.InterestedClassId ?? enquiry.InterestedClassId;
        enquiry.InterestedClassName = dto.InterestedClassName ?? enquiry.InterestedClassName;
        enquiry.InterestedBatchId = dto.InterestedBatchId ?? enquiry.InterestedBatchId;
        enquiry.InterestedBatchName = dto.InterestedBatchName ?? enquiry.InterestedBatchName;
        enquiry.FollowUpDate = dto.FollowUpDate;
        if (!string.IsNullOrWhiteSpace(dto.Source)) enquiry.Source = dto.Source;
        if (!string.IsNullOrWhiteSpace(dto.Status)) enquiry.Status = dto.Status;
        if (!string.IsNullOrWhiteSpace(dto.Priority)) enquiry.Priority = dto.Priority;
        enquiry.Remarks = dto.Remarks?.Trim();
        enquiry.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Enquiry updated successfully." });
    }

    [HttpPost("{id}/convert")]
    public async Task<IActionResult> ConvertEnquiryToStudent(Guid id, [FromBody] ConvertEnquiryDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var branchId = _currentUser.BranchId;
        var enquiry = await _db.AdmissionEnquiries.FirstOrDefaultAsync(e => e.Id == id && e.TenantId == tenantId);
        if (enquiry == null) return NotFound(new { message = "Enquiry record not found." });

        if (enquiry.ConvertedStudentId.HasValue)
            return BadRequest(new { message = "This enquiry has already been converted to an admitted student." });

        var now = DateTime.Now;
        // Auto-generate admission number if not provided
        string admissionNumber = dto.AdmissionNumber ?? string.Empty;
        if (string.IsNullOrWhiteSpace(admissionNumber))
        {
            var year = now.Year;
            var studentCount = await _db.Students.CountAsync(s => s.TenantId == tenantId && s.JoiningDate.Year == year);
            admissionNumber = $"ADM-{year}-{(studentCount + 1):D4}";
        }

        var student = new Student
        {
            TenantId = tenantId,
            BranchId = branchId,
            StudentName = enquiry.StudentName,
            ParentName = enquiry.ParentName,
            ParentWhatsAppPhone = enquiry.Phone,
            AdmissionNumber = admissionNumber,
            ClassId = dto.ClassId ?? enquiry.InterestedClassId,
            SectionId = dto.SectionId,
            BatchId = dto.BatchId ?? enquiry.InterestedBatchId,
            DateOfBirth = dto.DateOfBirth,
            Gender = dto.Gender ?? "Male",
            IsSchoolStudent = dto.ClassId.HasValue || enquiry.InterestedClassId.HasValue,
            IsCoachingStudent = dto.BatchId.HasValue || enquiry.InterestedBatchId.HasValue,
            JoiningDate = now,
            IsActive = true
        };

        _db.Students.Add(student);
        await _db.SaveChangesAsync();

        // Update enquiry record status
        enquiry.Status = "Admitted";
        enquiry.ConvertedStudentId = student.Id;
        enquiry.ConvertedAt = now;
        enquiry.UpdatedAt = now;

        await _db.SaveChangesAsync();

        return Ok(new {
            message = "Enquiry successfully converted to student admission!",
            studentId = student.Id,
            admissionNumber = student.AdmissionNumber,
            studentName = student.StudentName
        });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteEnquiry(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var enquiry = await _db.AdmissionEnquiries.FirstOrDefaultAsync(e => e.Id == id && e.TenantId == tenantId);
        if (enquiry == null) return NotFound(new { message = "Enquiry record not found." });

        _db.AdmissionEnquiries.Remove(enquiry);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Enquiry record deleted successfully." });
    }
}
