using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/student-regularizations")]
public class StudentRegularizationController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly ILogger<StudentRegularizationController> _logger;

    public StudentRegularizationController(
        IIMSERPDbContext db,
        ICurrentUserService currentUser,
        ILogger<StudentRegularizationController> logger)
    {
        _db = db;
        _currentUser = currentUser;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<StudentAttendanceRegularizationDto>>> GetRegularizations(
        [FromQuery] string? status,
        [FromQuery] Guid? studentId,
        [FromQuery] Guid? classId,
        [FromQuery] Guid? sectionId,
        [FromQuery] int? month,
        [FromQuery] int? year,
        [FromQuery] string? search)
    {
        var tenantId = _currentUser.TenantId;
        var scope = await GetUserAccessScopeAsync(tenantId);

        var query = _db.StudentAttendanceRegularizations
            .AsNoTracking()
            .Include(r => r.Student)
                .ThenInclude(s => s!.Class)
            .Include(r => r.Student)
                .ThenInclude(s => s!.Section)
            .Where(r => r.TenantId == tenantId);

        if (_currentUser.BranchId.HasValue)
        {
            var branchId = _currentUser.BranchId.Value;
            query = query.Where(r => !r.BranchId.HasValue || r.BranchId == branchId);
        }

        // =========================================================================
        // ROLE-BASED ACCESS CONTROL FILTERING
        // =========================================================================
        if (scope.Scope == "Student" || scope.Scope == "Parent")
        {
            if (scope.StudentId.HasValue)
            {
                query = query.Where(r => r.StudentId == scope.StudentId.Value);
            }
            else
            {
                return Ok(new List<StudentAttendanceRegularizationDto>());
            }
        }
        else if (scope.Scope == "Teacher")
        {
            if (scope.AssignedSectionIds != null && scope.AssignedSectionIds.Count > 0)
            {
                query = query.Where(r => r.Student != null && r.Student.SectionId.HasValue && scope.AssignedSectionIds.Contains(r.Student.SectionId.Value));
            }
            else
            {
                query = query.Where(r => false);
            }
        }

        // Status Filter
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<RegularizationStatus>(status, true, out var regStatus))
        {
            query = query.Where(r => r.Status == regStatus);
        }

        if (studentId.HasValue && studentId.Value != Guid.Empty)
            query = query.Where(r => r.StudentId == studentId.Value);

        if (classId.HasValue && classId.Value != Guid.Empty)
            query = query.Where(r => r.ClassId == classId.Value || (r.Student != null && r.Student.ClassId == classId.Value));

        if (sectionId.HasValue && sectionId.Value != Guid.Empty)
            query = query.Where(r => r.SectionId == sectionId.Value || (r.Student != null && r.Student.SectionId == sectionId.Value));

        if (month.HasValue && month.Value > 0)
            query = query.Where(r => r.AttendanceDate.Month == month.Value);

        if (year.HasValue && year.Value > 0)
            query = query.Where(r => r.AttendanceDate.Year == year.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(r =>
                (r.Student != null && (r.Student.StudentName.ToLower().Contains(s) || r.Student.RollNumber.ToLower().Contains(s))) ||
                r.Reason.ToLower().Contains(s) ||
                r.ReasonCategory.ToLower().Contains(s));
        }

        var list = await query
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new StudentAttendanceRegularizationDto(
                r.Id,
                r.TenantId,
                r.BranchId,
                r.StudentId,
                r.Student != null ? r.Student.StudentName : "Unknown",
                r.Student != null ? r.Student.RollNumber : "—",
                r.ClassId ?? (r.Student != null ? r.Student.ClassId : null),
                r.Student != null && r.Student.Class != null ? r.Student.Class.Name : null,
                r.SectionId ?? (r.Student != null ? r.Student.SectionId : null),
                r.Student != null && r.Student.Section != null ? r.Student.Section.Name : null,
                r.AttendanceDate,
                r.RequestedStatus.ToString(),
                r.ReasonCategory,
                r.Reason,
                r.AttachmentUrl,
                r.Status.ToString(),
                r.ReviewedBy,
                r.ReviewedAt,
                r.ReviewRemarks,
                r.AppliedBy,
                r.CreatedAt,
                r.UpdatedAt
            ))
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("stats")]
    public async Task<ActionResult<StudentRegularizationStatsDto>> GetStats()
    {
        var tenantId = _currentUser.TenantId;
        var scope = await GetUserAccessScopeAsync(tenantId);

        var query = _db.StudentAttendanceRegularizations
            .AsNoTracking()
            .Include(r => r.Student)
            .Where(r => r.TenantId == tenantId);

        if (_currentUser.BranchId.HasValue)
        {
            var branchId = _currentUser.BranchId.Value;
            query = query.Where(r => !r.BranchId.HasValue || r.BranchId == branchId);
        }

        if (scope.Scope == "Student" || scope.Scope == "Parent")
        {
            if (scope.StudentId.HasValue)
            {
                query = query.Where(r => r.StudentId == scope.StudentId.Value);
            }
            else
            {
                return Ok(new StudentRegularizationStatsDto(0, 0, 0, 0));
            }
        }
        else if (scope.Scope == "Teacher")
        {
            if (scope.AssignedSectionIds != null && scope.AssignedSectionIds.Count > 0)
            {
                query = query.Where(r => r.Student != null && r.Student.SectionId.HasValue && scope.AssignedSectionIds.Contains(r.Student.SectionId.Value));
            }
            else
            {
                return Ok(new StudentRegularizationStatsDto(0, 0, 0, 0));
            }
        }

        var total = await query.CountAsync();
        var pending = await query.CountAsync(r => r.Status == RegularizationStatus.Pending);
        var approved = await query.CountAsync(r => r.Status == RegularizationStatus.Approved);
        var rejected = await query.CountAsync(r => r.Status == RegularizationStatus.Rejected);

        return Ok(new StudentRegularizationStatsDto(total, pending, approved, rejected));
    }

    [HttpPost]
    public async Task<ActionResult<StudentAttendanceRegularizationDto>> ApplyRegularization([FromBody] ApplyStudentRegularizationDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var scope = await GetUserAccessScopeAsync(tenantId);

        Guid targetStudentId = dto.StudentId;
        if (scope.Scope == "Student" || scope.Scope == "Parent")
        {
            if (!scope.StudentId.HasValue)
                return BadRequest(new { message = "No student profile is linked to your login." });
            targetStudentId = scope.StudentId.Value;
        }

        var student = await _db.Students
            .Include(s => s.Class)
            .Include(s => s.Section)
            .FirstOrDefaultAsync(s => s.Id == targetStudentId && s.TenantId == tenantId);

        if (student == null) return NotFound(new { message = "Student not found." });

        if (dto.AttendanceDate.Date > DateTime.UtcNow.Date)
            return BadRequest(new { message = "Cannot regularize attendance for a future date." });

        if (dto.AttendanceDate.DayOfWeek == DayOfWeek.Sunday)
            return BadRequest(new { message = "Attendance cannot be regularized on a Sunday / Weekly Off." });

        // Check if an existing request is pending for this student on this date
        var alreadyPending = await _db.StudentAttendanceRegularizations.AnyAsync(r =>
            r.TenantId == tenantId &&
            r.StudentId == targetStudentId &&
            r.AttendanceDate.Date == dto.AttendanceDate.Date &&
            r.Status == RegularizationStatus.Pending);

        if (alreadyPending)
            return Conflict(new { message = $"A regularization request for {dto.AttendanceDate:dd MMM yyyy} is already pending review." });

        // Parse requested status
        var requestedStatus = TeacherAttendanceStatus.Present;
        if (Enum.TryParse<TeacherAttendanceStatus>(dto.RequestedStatus, true, out var parsedStatus))
        {
            requestedStatus = parsedStatus;
        }

        string appliedByLabel = scope.Scope switch
        {
            "Student" => "Student",
            "Parent" => "Parent",
            "Teacher" => "Class Teacher",
            _ => "School Admin"
        };

        var reg = new StudentAttendanceRegularization
        {
            TenantId = tenantId,
            BranchId = student.BranchId ?? _currentUser.BranchId,
            StudentId = student.Id,
            ClassId = student.ClassId,
            SectionId = student.SectionId,
            AttendanceDate = dto.AttendanceDate.Date,
            RequestedStatus = requestedStatus,
            ReasonCategory = string.IsNullOrWhiteSpace(dto.ReasonCategory) ? "OnDuty" : dto.ReasonCategory.Trim(),
            Reason = dto.Reason.Trim(),
            AttachmentUrl = dto.AttachmentUrl?.Trim(),
            Status = RegularizationStatus.Pending,
            AppliedBy = appliedByLabel,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.StudentAttendanceRegularizations.Add(reg);
        await _db.SaveChangesAsync();

        return Ok(new StudentAttendanceRegularizationDto(
            reg.Id,
            reg.TenantId,
            reg.BranchId,
            reg.StudentId,
            student.StudentName,
            student.RollNumber,
            student.ClassId,
            student.Class?.Name,
            student.SectionId,
            student.Section?.Name,
            reg.AttendanceDate,
            reg.RequestedStatus.ToString(),
            reg.ReasonCategory,
            reg.Reason,
            reg.AttachmentUrl,
            reg.Status.ToString(),
            reg.ReviewedBy,
            reg.ReviewedAt,
            reg.ReviewRemarks,
            reg.AppliedBy,
            reg.CreatedAt,
            reg.UpdatedAt
        ));
    }

    [HttpPut("{id}/review")]
    public async Task<IActionResult> ReviewRegularization(Guid id, [FromBody] ReviewStudentRegularizationDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var scope = await GetUserAccessScopeAsync(tenantId);

        // Security Check: Students and Parents cannot review/approve regularizations!
        if (scope.Scope == "Student" || scope.Scope == "Parent")
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Students and parents are not authorized to review attendance regularizations." });
        }

        var reg = await _db.StudentAttendanceRegularizations
            .Include(r => r.Student)
            .FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId);

        if (reg == null) return NotFound(new { message = "Regularization request not found." });

        if (reg.Status != RegularizationStatus.Pending)
        {
            return Conflict(new { message = $"This request has already been {reg.Status}." });
        }

        // If Teacher, ensure student belongs to their assigned Class/Section
        if (scope.Scope == "Teacher" && scope.AssignedSectionIds != null && scope.AssignedSectionIds.Count > 0)
        {
            if (reg.Student == null || !reg.Student.SectionId.HasValue || !scope.AssignedSectionIds.Contains(reg.Student.SectionId.Value))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "You can only review attendance regularizations for students in your assigned Class & Section." });
            }
        }

        var approverName = scope.ReviewerName;
        reg.Status = dto.Approve ? RegularizationStatus.Approved : RegularizationStatus.Rejected;
        reg.ReviewedBy = approverName;
        reg.ReviewedAt = DateTime.UtcNow;
        reg.ReviewRemarks = dto.ReviewRemarks?.Trim();
        reg.UpdatedAt = DateTime.UtcNow;

        // =========================================================================
        // ATTENDANCE SYNCHRONIZATION: Update or Create Student Attendance Record
        // =========================================================================
        if (dto.Approve)
        {
            var targetStatus = reg.RequestedStatus;
            if (!string.IsNullOrWhiteSpace(dto.ApprovedStatus) && Enum.TryParse<TeacherAttendanceStatus>(dto.ApprovedStatus, true, out var customStatus))
            {
                targetStatus = customStatus;
            }

            var attDate = reg.AttendanceDate.Date;
            var att = await _db.StudentAttendances
                .FirstOrDefaultAsync(a => a.StudentId == reg.StudentId && a.AttendanceDate.Date == attDate);

            var statusNote = reg.ReasonCategory switch
            {
                "OnDuty" => $"[On-Duty / OD] {reg.Reason}",
                "Medical" => $"[Medical Excused] {reg.Reason}",
                "RollCallError" => $"[Roll Call Corrected] {reg.Reason}",
                "PunchMiss" => $"[Biometric Missed] {reg.Reason}",
                _ => $"[Regularized] {reg.Reason}"
            };

            if (att == null)
            {
                att = new StudentAttendance
                {
                    TenantId = tenantId,
                    BranchId = reg.BranchId ?? _currentUser.BranchId,
                    StudentId = reg.StudentId,
                    AttendanceDate = attDate,
                    Status = targetStatus,
                    CaptureSource = "Regularization",
                    Remarks = $"Regularized by {approverName}: {statusNote}",
                    MarkedBy = approverName,
                    CreatedAt = DateTime.UtcNow
                };
                _db.StudentAttendances.Add(att);
            }
            else
            {
                att.Status = targetStatus;
                att.CaptureSource = "Regularization";
                att.Remarks = $"Regularized by {approverName}: {statusNote}";
                att.MarkedBy = approverName;
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = dto.Approve
                ? "Attendance regularization approved. Attendance register successfully updated."
                : "Attendance regularization rejected.",
            status = reg.Status.ToString()
        });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRegularization(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var scope = await GetUserAccessScopeAsync(tenantId);

        var reg = await _db.StudentAttendanceRegularizations.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId);
        if (reg == null) return NotFound(new { message = "Regularization request not found." });

        if ((scope.Scope == "Student" || scope.Scope == "Parent") && reg.StudentId != scope.StudentId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You cannot delete requests for other students." });
        }

        if (reg.Status != RegularizationStatus.Pending && (scope.Scope == "Student" || scope.Scope == "Parent"))
        {
            return BadRequest(new { message = "Only Pending regularization requests can be deleted/cancelled." });
        }

        _db.StudentAttendanceRegularizations.Remove(reg);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Regularization request removed successfully." });
    }

    // =========================================================================
    // PRIVATE ACCESS SCOPE HELPER
    // =========================================================================
    private async Task<(string Scope, List<Guid>? AssignedSectionIds, Guid? StudentId, string ReviewerName)> GetUserAccessScopeAsync(Guid tenantId)
    {
        var userId = _currentUser.UserId;
        var user = await _db.Users
            .Include(u => u.AssignedRole)
            .FirstOrDefaultAsync(u => u.Id == userId);

        var roleName = user?.AssignedRole?.Name ?? _currentUser.UserRole ?? "";

        // 1. Check if Student
        if (roleName.Contains("Student", StringComparison.OrdinalIgnoreCase) || _currentUser.UserRole.Equals("Student", StringComparison.OrdinalIgnoreCase))
        {
            var student = await _db.Students.FirstOrDefaultAsync(s => s.UserId == userId && s.TenantId == tenantId);
            return ("Student", null, student?.Id, user?.FullName ?? "Student");
        }

        // 2. Check if Parent
        if (roleName.Contains("Parent", StringComparison.OrdinalIgnoreCase) || _currentUser.UserRole.Equals("Parent", StringComparison.OrdinalIgnoreCase))
        {
            var student = await _db.Students.FirstOrDefaultAsync(s => s.ParentUserId == userId && s.TenantId == tenantId);
            return ("Parent", null, student?.Id, user?.FullName ?? "Parent");
        }

        // 3. Check if Teacher (or linked in Teachers table)
        var teacher = await _db.Teachers.FirstOrDefaultAsync(t => t.UserId == userId && t.TenantId == tenantId);
        if (teacher == null && (roleName.Contains("Teacher", StringComparison.OrdinalIgnoreCase) || _currentUser.UserRole.Equals("Teacher", StringComparison.OrdinalIgnoreCase)))
        {
            if (user != null)
            {
                teacher = await _db.Teachers.FirstOrDefaultAsync(t => t.TenantId == tenantId &&
                    (t.Email == user.Email || t.PhoneNumber == user.PhoneNumber || t.FullName == user.FullName));
            }
        }

        if (teacher != null)
        {
            var sectionIds = await _db.SchoolSections
                .Where(sec => sec.ClassTeacherId == teacher.Id && sec.TenantId == tenantId)
                .Select(sec => sec.Id)
                .ToListAsync();

            return ("Teacher", sectionIds, null, $"{teacher.FullName} (Class Teacher)");
        }

        // 4. Default: Admin / Principal / SuperAdmin
        var adminName = user?.FullName ?? "Administrator";
        return ("Admin", null, null, $"{adminName} (Admin)");
    }
}
