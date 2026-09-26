using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StudentLeavesController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IWhatsAppService _whatsAppService;
    private readonly ILogger<StudentLeavesController> _logger;

    public StudentLeavesController(
        IIMSERPDbContext db,
        ICurrentUserService currentUser,
        IWhatsAppService whatsAppService,
        ILogger<StudentLeavesController> logger)
    {
        _db = db;
        _currentUser = currentUser;
        _whatsAppService = whatsAppService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<StudentLeaveDto>>> GetLeaves(
        [FromQuery] string? status,
        [FromQuery] Guid? studentId,
        [FromQuery] Guid? classId,
        [FromQuery] string? category,
        [FromQuery] string? search)
    {
        var tenantId = _currentUser.TenantId;
        var scope = await GetUserAccessScopeAsync(tenantId);

        var query = _db.StudentLeaves
            .AsNoTracking()
            .Include(l => l.Student)
                .ThenInclude(s => s!.Class)
            .Include(l => l.Student)
                .ThenInclude(s => s!.Section)
            .Where(l => l.TenantId == tenantId);

        if (_currentUser.BranchId.HasValue)
        {
            var branchId = _currentUser.BranchId.Value;
            query = query.Where(l => !l.BranchId.HasValue || l.BranchId == branchId);
        }

        // =========================================================================
        // ROLE-BASED ACCESS CONTROL FILTERING
        // =========================================================================
        if (scope.Scope == "Student" || scope.Scope == "Parent")
        {
            if (scope.StudentId.HasValue)
            {
                query = query.Where(l => l.StudentId == scope.StudentId.Value);
            }
            else
            {
                // Unlinked student/parent user has no leave records to view
                return Ok(new List<StudentLeaveDto>());
            }
        }
        else if (scope.Scope == "Teacher")
        {
            if (scope.AssignedSectionIds != null && scope.AssignedSectionIds.Count > 0)
            {
                query = query.Where(l => l.Student != null && l.Student.SectionId.HasValue && scope.AssignedSectionIds.Contains(l.Student.SectionId.Value));
            }
            else
            {
                // Teacher with no assigned sections as Class Teacher
                query = query.Where(l => false);
            }
        }
        // Admin / Institute Admin sees all leaves across the institution/branch

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(l => l.Status == status);

        if (studentId.HasValue && studentId.Value != Guid.Empty)
            query = query.Where(l => l.StudentId == studentId.Value);

        if (classId.HasValue && classId.Value != Guid.Empty)
            query = query.Where(l => l.Student != null && l.Student.ClassId == classId.Value);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(l => l.LeaveCategory == category);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(l =>
                (l.Student != null && (l.Student.StudentName.ToLower().Contains(s) || l.Student.RollNumber.ToLower().Contains(s))) ||
                l.Reason.ToLower().Contains(s) ||
                l.LeaveCategory.ToLower().Contains(s));
        }

        var list = await query
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new StudentLeaveDto(
                l.Id,
                l.TenantId,
                l.BranchId,
                l.StudentId,
                l.Student != null ? l.Student.StudentName : "Unknown",
                l.Student != null ? l.Student.RollNumber : "—",
                l.Student != null && l.Student.Class != null ? l.Student.Class.Name : null,
                l.Student != null && l.Student.Section != null ? l.Student.Section.Name : null,
                l.ParentContactNumber ?? (l.Student != null ? l.Student.ParentWhatsAppPhone ?? l.Student.EmergencyContactPhone : null),
                l.LeaveCategory,
                l.FromDate,
                l.ToDate,
                l.TotalDays,
                l.Reason,
                l.AttachmentUrl,
                l.Status,
                l.ReviewedBy,
                l.ReviewedAt,
                l.ReviewRemarks,
                l.AttendanceMarked,
                l.AppliedBy,
                l.CreatedAt,
                l.UpdatedAt
            ))
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("stats")]
    public async Task<ActionResult<StudentLeaveStatsDto>> GetStats()
    {
        var tenantId = _currentUser.TenantId;
        var scope = await GetUserAccessScopeAsync(tenantId);

        var query = _db.StudentLeaves
            .AsNoTracking()
            .Include(l => l.Student)
            .Where(l => l.TenantId == tenantId);

        if (_currentUser.BranchId.HasValue)
        {
            var branchId = _currentUser.BranchId.Value;
            query = query.Where(l => !l.BranchId.HasValue || l.BranchId == branchId);
        }

        if (scope.Scope == "Student" || scope.Scope == "Parent")
        {
            if (scope.StudentId.HasValue)
            {
                query = query.Where(l => l.StudentId == scope.StudentId.Value);
            }
            else
            {
                return Ok(new StudentLeaveStatsDto(0, 0, 0, 0, 0));
            }
        }
        else if (scope.Scope == "Teacher")
        {
            if (scope.AssignedSectionIds != null && scope.AssignedSectionIds.Count > 0)
            {
                query = query.Where(l => l.Student != null && l.Student.SectionId.HasValue && scope.AssignedSectionIds.Contains(l.Student.SectionId.Value));
            }
            else
            {
                return Ok(new StudentLeaveStatsDto(0, 0, 0, 0, 0));
            }
        }

        var today = DateTime.Today;
        var total = await query.CountAsync();
        var pending = await query.CountAsync(l => l.Status == "Pending");
        var approved = await query.CountAsync(l => l.Status == "Approved");
        var rejected = await query.CountAsync(l => l.Status == "Rejected");
        var todayOnLeave = await query.CountAsync(l =>
            l.Status == "Approved" && l.FromDate.Date <= today && l.ToDate.Date >= today);

        return Ok(new StudentLeaveStatsDto(total, pending, approved, rejected, todayOnLeave));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<StudentLeaveDto>> GetById(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var l = await _db.StudentLeaves
            .AsNoTracking()
            .Include(x => x.Student)
                .ThenInclude(s => s!.Class)
            .Include(x => x.Student)
                .ThenInclude(s => s!.Section)
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);

        if (l == null) return NotFound(new { message = "Student leave application not found." });

        return Ok(new StudentLeaveDto(
            l.Id,
            l.TenantId,
            l.BranchId,
            l.StudentId,
            l.Student != null ? l.Student.StudentName : "Unknown",
            l.Student != null ? l.Student.RollNumber : "—",
            l.Student != null && l.Student.Class != null ? l.Student.Class.Name : null,
            l.Student != null && l.Student.Section != null ? l.Student.Section.Name : null,
            l.ParentContactNumber ?? (l.Student != null ? l.Student.ParentWhatsAppPhone ?? l.Student.EmergencyContactPhone : null),
            l.LeaveCategory,
            l.FromDate,
            l.ToDate,
            l.TotalDays,
            l.Reason,
            l.AttachmentUrl,
            l.Status,
            l.ReviewedBy,
            l.ReviewedAt,
            l.ReviewRemarks,
            l.AttendanceMarked,
            l.AppliedBy,
            l.CreatedAt,
            l.UpdatedAt
        ));
    }

    [HttpPost]
    public async Task<ActionResult<StudentLeaveDto>> CreateLeave([FromBody] CreateStudentLeaveDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Reason))
            return BadRequest(new { message = "Leave reason / explanation is required." });

        if (dto.ToDate.Date < dto.FromDate.Date)
            return BadRequest(new { message = "To Date cannot be earlier than From Date." });

        var tenantId = _currentUser.TenantId;
        var scope = await GetUserAccessScopeAsync(tenantId);

        Guid targetStudentId = dto.StudentId;

        // If Student or Parent, enforce that they can only apply for their own linked student
        if (scope.Scope == "Student" || scope.Scope == "Parent")
        {
            if (!scope.StudentId.HasValue)
            {
                return BadRequest(new { message = "No student profile is linked with your current user account." });
            }
            targetStudentId = scope.StudentId.Value;
        }
        else if (targetStudentId == Guid.Empty)
        {
            return BadRequest(new { message = "Student selection is required." });
        }

        var student = await _db.Students
            .Include(s => s.Class)
            .Include(s => s.Section)
            .FirstOrDefaultAsync(s => s.Id == targetStudentId && s.TenantId == tenantId);

        if (student == null)
            return NotFound(new { message = "Selected student record not found." });

        // Overlapping leave check
        var overlap = await _db.StudentLeaves
            .AnyAsync(l => l.TenantId == tenantId &&
                           l.StudentId == targetStudentId &&
                           l.Status != "Rejected" &&
                           l.FromDate.Date <= dto.ToDate.Date &&
                           l.ToDate.Date >= dto.FromDate.Date);

        if (overlap)
        {
            return BadRequest(new { message = "An active or pending leave application already exists for this student in the selected date range." });
        }

        var totalDays = Math.Max(1, (int)(dto.ToDate.Date - dto.FromDate.Date).TotalDays + 1);

        string appliedByLabel;
        if (scope.Scope == "Student") appliedByLabel = "Student";
        else if (scope.Scope == "Parent") appliedByLabel = "Parent";
        else if (scope.Scope == "Teacher") appliedByLabel = "Class Teacher";
        else appliedByLabel = !string.IsNullOrWhiteSpace(dto.AppliedBy) ? dto.AppliedBy.Trim() : "School Desk";

        var leave = new StudentLeave
        {
            TenantId = tenantId,
            BranchId = student.BranchId ?? _currentUser.BranchId,
            StudentId = student.Id,
            LeaveCategory = string.IsNullOrWhiteSpace(dto.LeaveCategory) ? "Other" : dto.LeaveCategory.Trim(),
            FromDate = dto.FromDate.Date,
            ToDate = dto.ToDate.Date,
            TotalDays = totalDays,
            Reason = dto.Reason.Trim(),
            AttachmentUrl = dto.AttachmentUrl?.Trim(),
            ParentContactNumber = dto.ParentContactNumber?.Trim() ?? student.ParentWhatsAppPhone ?? student.EmergencyContactPhone,
            Status = "Pending",
            AppliedBy = appliedByLabel,
            AttendanceMarked = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.StudentLeaves.Add(leave);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = leave.Id }, new StudentLeaveDto(
            leave.Id,
            leave.TenantId,
            leave.BranchId,
            leave.StudentId,
            student.StudentName,
            student.RollNumber,
            student.Class != null ? student.Class.Name : null,
            student.Section != null ? student.Section.Name : null,
            leave.ParentContactNumber,
            leave.LeaveCategory,
            leave.FromDate,
            leave.ToDate,
            leave.TotalDays,
            leave.Reason,
            leave.AttachmentUrl,
            leave.Status,
            leave.ReviewedBy,
            leave.ReviewedAt,
            leave.ReviewRemarks,
            leave.AttendanceMarked,
            leave.AppliedBy,
            leave.CreatedAt,
            leave.UpdatedAt
        ));
    }

    [HttpPut("{id}/review")]
    public async Task<IActionResult> ReviewLeave(Guid id, [FromBody] ReviewStudentLeaveDto dto)
    {
        if (dto.Status != "Approved" && dto.Status != "Rejected")
            return BadRequest(new { message = "Status must be either 'Approved' or 'Rejected'." });

        var tenantId = _currentUser.TenantId;
        var scope = await GetUserAccessScopeAsync(tenantId);

        // Security: Students and Parents cannot approve or reject leaves
        if (scope.Scope == "Student" || scope.Scope == "Parent")
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Students and parents are not authorized to approve or reject leave applications." });
        }

        var leave = await _db.StudentLeaves
            .Include(l => l.Student)
            .FirstOrDefaultAsync(l => l.Id == id && l.TenantId == tenantId);

        if (leave == null)
            return NotFound(new { message = "Student leave application not found." });

        // If Teacher, ensure student belongs to their assigned section
        if (scope.Scope == "Teacher" && scope.AssignedSectionIds != null && scope.AssignedSectionIds.Count > 0)
        {
            if (leave.Student == null || !leave.Student.SectionId.HasValue || !scope.AssignedSectionIds.Contains(leave.Student.SectionId.Value))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "You can only review leave applications for students in your assigned Class/Section." });
            }
        }

        var now = DateTime.Now;
        leave.Status = dto.Status;
        leave.ReviewRemarks = dto.ReviewRemarks?.Trim();
        leave.ReviewedBy = scope.ReviewerName;
        leave.ReviewedAt = now;
        leave.UpdatedAt = now;

        // =========================================================================
        // ATTENDANCE LINKAGE: Update attendance records upon Approval or Rejection
        // =========================================================================
        if (dto.Status == "Approved")
        {
            var from = leave.FromDate.Date;
            var to = leave.ToDate.Date;

            for (var cur = from; cur <= to; cur = cur.AddDays(1))
            {
                // Skip Sundays if not a working day
                if (cur.DayOfWeek == DayOfWeek.Sunday) continue;

                var existingAtt = await _db.StudentAttendances
                    .FirstOrDefaultAsync(a => a.StudentId == leave.StudentId && a.AttendanceDate == cur);

                if (existingAtt != null)
                {
                    existingAtt.Status = TeacherAttendanceStatus.Leave;
                    existingAtt.Remarks = $"Sanctioned Leave ({leave.LeaveCategory}): {leave.Reason}";
                    existingAtt.CaptureSource = "LeaveApplication";
                }
                else
                {
                    var newAtt = new StudentAttendance
                    {
                        TenantId = leave.TenantId,
                        BranchId = leave.BranchId,
                        StudentId = leave.StudentId,
                        AttendanceDate = cur,
                        Status = TeacherAttendanceStatus.Leave,
                        Remarks = $"Sanctioned Leave ({leave.LeaveCategory}): {leave.Reason}",
                        CaptureSource = "LeaveApplication",
                        MarkedBy = scope.ReviewerName,
                        CreatedAt = DateTime.UtcNow
                    };
                    _db.StudentAttendances.Add(newAtt);
                }
            }

            leave.AttendanceMarked = true;
        }
        else if (dto.Status == "Rejected" && leave.AttendanceMarked)
        {
            // Roll back attendance records marked by this leave application
            var from = leave.FromDate.Date;
            var to = leave.ToDate.Date;

            var markedAtts = await _db.StudentAttendances
                .Where(a => a.StudentId == leave.StudentId &&
                            a.AttendanceDate >= from && a.AttendanceDate <= to &&
                            a.CaptureSource == "LeaveApplication")
                .ToListAsync();

            if (markedAtts.Count > 0)
            {
                _db.StudentAttendances.RemoveRange(markedAtts);
            }

            leave.AttendanceMarked = false;
        }

        await _db.SaveChangesAsync();

        // =========================================================================
        // WHATSAPP / SMS NOTIFICATION DISPATCH TO PARENT
        // =========================================================================
        var parentPhone = leave.ParentContactNumber ?? leave.Student?.ParentWhatsAppPhone ?? leave.Student?.EmergencyContactPhone;
        if (!string.IsNullOrWhiteSpace(parentPhone))
        {
            try
            {
                await _whatsAppService.SendLeaveStatusAlertAsync(
                    tenantId,
                    parentPhone,
                    leave.Student != null ? leave.Student.StudentName : "Student",
                    dto.Status,
                    leave.FromDate,
                    leave.ToDate,
                    dto.ReviewRemarks,
                    scope.ReviewerName
                );
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to dispatch WhatsApp leave alert to parent {Phone}", parentPhone);
            }
        }

        return Ok(new {
            message = $"Leave application {dto.Status.ToLower()} successfully by {scope.ReviewerName}.",
            status = leave.Status,
            reviewedBy = leave.ReviewedBy,
            attendanceMarked = leave.AttendanceMarked,
            whatsappAlertDispatched = !string.IsNullOrWhiteSpace(parentPhone)
        });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteLeave(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var scope = await GetUserAccessScopeAsync(tenantId);

        var leave = await _db.StudentLeaves.FirstOrDefaultAsync(l => l.Id == id && l.TenantId == tenantId);
        if (leave == null) return NotFound(new { message = "Leave application not found." });

        if ((scope.Scope == "Student" || scope.Scope == "Parent") && leave.StudentId != scope.StudentId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You cannot delete leave applications for other students." });
        }

        if (leave.Status == "Approved" && (scope.Scope == "Student" || scope.Scope == "Parent"))
        {
            return BadRequest(new { message = "Approved leave applications cannot be deleted by students or parents. Please contact school administration." });
        }

        if (leave.AttendanceMarked)
        {
            // Roll back attendance
            var from = leave.FromDate.Date;
            var to = leave.ToDate.Date;
            var markedAtts = await _db.StudentAttendances
                .Where(a => a.StudentId == leave.StudentId &&
                            a.AttendanceDate >= from && a.AttendanceDate <= to &&
                            a.CaptureSource == "LeaveApplication")
                .ToListAsync();

            if (markedAtts.Count > 0)
            {
                _db.StudentAttendances.RemoveRange(markedAtts);
            }
        }

        _db.StudentLeaves.Remove(leave);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Leave application deleted successfully." });
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
