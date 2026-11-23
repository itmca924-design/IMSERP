using System.Text.RegularExpressions;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/ai-attendance")]
[Authorize]
public class AiAttendanceScannerController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IWebHostEnvironment _environment;

    public AiAttendanceScannerController(
        IIMSERPDbContext db,
        ICurrentUserService currentUser,
        IWebHostEnvironment environment)
    {
        _db = db;
        _currentUser = currentUser;
        _environment = environment;
    }

    private static DateTime GetIstToday()
    {
        var istZone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istZone).Date;
    }

    private static string GetIstTimeFormatted()
    {
        var istZone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istZone).ToString("hh:mm tt");
    }

    [HttpGet("roster")]
    public async Task<ActionResult<object>> GetRoster(
        [FromQuery] Guid? branchId,
        [FromQuery] string? divisionScope,
        [FromQuery] Guid? classId,
        [FromQuery] Guid? sectionId,
        [FromQuery] Guid? batchId,
        [FromQuery] DateTime? date,
        [FromQuery] string? search)
    {
        var targetDate = date?.Date ?? GetIstToday();
        var effectiveBranchId = branchId ?? _currentUser.BranchId;

        var query = _db.Students.AsNoTracking()
            .Where(s => s.TenantId == _currentUser.TenantId && s.IsActive && !s.IsDeleted);

        if (effectiveBranchId.HasValue && effectiveBranchId.Value != Guid.Empty)
        {
            query = query.Where(s => s.BranchId == effectiveBranchId);
        }

        if (string.Equals(divisionScope, "school", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(s => s.IsSchoolStudent);
        }
        else if (string.Equals(divisionScope, "coaching", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(s => s.IsCoachingStudent);
        }

        if (classId.HasValue && classId.Value != Guid.Empty)
        {
            query = query.Where(s => s.ClassId == classId);
        }

        if (sectionId.HasValue && sectionId.Value != Guid.Empty)
        {
            query = query.Where(s => s.SectionId == sectionId);
        }

        if (batchId.HasValue && batchId.Value != Guid.Empty)
        {
            query = query.Where(s => s.BatchId == batchId);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var sTerm = search.Trim().ToLower();
            query = query.Where(s =>
                s.StudentName.ToLower().Contains(sTerm) ||
                s.RollNumber.ToLower().Contains(sTerm) ||
                (s.SchoolRollNumber != null && s.SchoolRollNumber.ToLower().Contains(sTerm)) ||
                (s.CoachingRollNumber != null && s.CoachingRollNumber.ToLower().Contains(sTerm)) ||
                (s.AdmissionNumber != null && s.AdmissionNumber.ToLower().Contains(sTerm)));
        }

        var students = await query
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .OrderBy(s => s.StudentName)
            .ToListAsync();

        var studentIds = students.Select(s => s.Id).ToList();

        var attendances = await _db.StudentAttendances.AsNoTracking()
            .Where(a => a.TenantId == _currentUser.TenantId &&
                        a.AttendanceDate == targetDate &&
                        studentIds.Contains(a.StudentId))
            .ToDictionaryAsync(a => a.StudentId);

        var roster = new List<AiAttendanceRosterItemDto>();

        foreach (var s in students)
        {
            attendances.TryGetValue(s.Id, out var att);

            var statusStr = att != null
                ? att.Status.ToString()
                : "Unmarked";

            roster.Add(new AiAttendanceRosterItemDto
            {
                StudentId = s.Id,
                StudentName = s.StudentName,
                RollNumber = s.RollNumber,
                SchoolRollNumber = s.SchoolRollNumber,
                CoachingRollNumber = s.CoachingRollNumber,
                AdmissionNumber = s.AdmissionNumber,
                ProfilePhoto = s.ProfilePhoto,
                ParentName = s.ParentName,
                ParentWhatsAppPhone = s.ParentWhatsAppPhone,
                ClassName = s.Class?.Name,
                SectionName = s.Section?.Name,
                BatchName = s.Batch?.Name,
                IsSchoolStudent = s.IsSchoolStudent,
                IsCoachingStudent = s.IsCoachingStudent,
                AttendanceStatus = statusStr,
                CheckInTime = att?.CheckInTime,
                CheckOutTime = att?.CheckOutTime,
                Remarks = att?.Remarks,
                CaptureSource = att?.CaptureSource,
                PunchDate = att?.AttendanceDate
            });
        }

        var total = roster.Count;
        var present = roster.Count(r => r.AttendanceStatus == "Present");
        var absent = roster.Count(r => r.AttendanceStatus == "Absent");
        var late = roster.Count(r => r.AttendanceStatus == "Late");
        var unmarked = roster.Count(r => r.AttendanceStatus == "Unmarked");
        var pct = total > 0 ? Math.Round((decimal)present / total * 100m, 1) : 0m;

        var summary = new AiAttendanceSummaryDto
        {
            TotalStudents = total,
            PresentCount = present,
            AbsentCount = absent,
            LateCount = late,
            UnmarkedCount = unmarked,
            AttendancePercentage = pct,
            RecentPunches = roster.Where(r => r.AttendanceStatus != "Unmarked")
                .OrderByDescending(r => r.CheckInTime)
                .Take(10)
                .ToList()
        };

        return Ok(new
        {
            Date = targetDate.ToString("yyyy-MM-dd"),
            Summary = summary,
            Roster = roster
        });
    }

    [HttpPost("punch")]
    public async Task<ActionResult<object>> PunchAttendance([FromBody] AiAttendancePunchRequestDto dto)
    {
        if (dto.StudentId == Guid.Empty)
            return BadRequest(new { message = "Student ID is required." });

        var student = await _db.Students
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .FirstOrDefaultAsync(s => s.Id == dto.StudentId && s.TenantId == _currentUser.TenantId);

        if (student == null)
            return NotFound(new { message = "Student not found." });

        var targetDate = dto.AttendanceDate?.Date ?? GetIstToday();
        var punchTime = !string.IsNullOrWhiteSpace(dto.CheckInTime) ? dto.CheckInTime : GetIstTimeFormatted();

        if (!Enum.TryParse<TeacherAttendanceStatus>(dto.Status, true, out var parsedStatus))
        {
            parsedStatus = TeacherAttendanceStatus.Present;
        }

        var record = await _db.StudentAttendances
            .FirstOrDefaultAsync(a => a.TenantId == _currentUser.TenantId &&
                                      a.StudentId == student.Id &&
                                      a.AttendanceDate == targetDate);

        if (record == null)
        {
            record = new StudentAttendance
            {
                TenantId = _currentUser.TenantId,
                BranchId = student.BranchId ?? _currentUser.BranchId,
                StudentId = student.Id,
                AttendanceDate = targetDate,
                Status = parsedStatus,
                CheckInTime = punchTime,
                Remarks = !string.IsNullOrWhiteSpace(dto.Remarks) ? dto.Remarks : "AI Camera Scanner Punch",
                MarkedBy = _currentUser.Username ?? "AI-Camera-Scanner",
                CaptureSource = "AiCameraScanner",
                CapturedAt = DateTime.UtcNow
            };
            _db.StudentAttendances.Add(record);
        }
        else
        {
            record.Status = parsedStatus;
            if (string.IsNullOrEmpty(record.CheckInTime))
            {
                record.CheckInTime = punchTime;
            }
            record.Remarks = !string.IsNullOrWhiteSpace(dto.Remarks) ? dto.Remarks : record.Remarks ?? "AI Camera Scanner Punch";
            record.CaptureSource = "AiCameraScanner";
            record.CapturedAt = DateTime.UtcNow;
            record.MarkedBy = _currentUser.Username ?? "AI-Camera-Scanner";
        }

        string? whatsAppStatus = null;

        if (dto.SendWhatsAppAlert && !string.IsNullOrWhiteSpace(student.ParentWhatsAppPhone))
        {
            try
            {
                var tenant = await _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == _currentUser.TenantId);
                var instituteName = tenant?.Name ?? "Institute";

                var greeting = parsedStatus == TeacherAttendanceStatus.Present
                    ? $"Namaste {student.ParentName}! Your ward {student.StudentName} has safely arrived at {instituteName} and attendance marked PRESENT at {punchTime} IST."
                    : $"Namaste {student.ParentName}! Attendance for your ward {student.StudentName} at {instituteName} has been marked as {parsedStatus} on {targetDate:dd MMM yyyy}.";

                var cleanPhone = Regex.Replace(student.ParentWhatsAppPhone, @"[^\d]", "");
                if (cleanPhone.Length == 10) cleanPhone = "91" + cleanPhone;

                var wLog = new WhatsAppLog
                {
                    TenantId = _currentUser.TenantId,
                    RecipientPhone = cleanPhone,
                    StudentName = student.StudentName,
                    MessageType = MessageType.Announcement,
                    Content = greeting,
                    Status = "Queued",
                    SentAt = DateTime.UtcNow
                };
                _db.WhatsAppLogs.Add(wLog);
                whatsAppStatus = "Queued";
            }
            catch
            {
                whatsAppStatus = "Failed";
            }
        }

        await _db.SaveChangesAsync();

        var resultItem = new AiAttendanceRosterItemDto
        {
            StudentId = student.Id,
            StudentName = student.StudentName,
            RollNumber = student.RollNumber,
            SchoolRollNumber = student.SchoolRollNumber,
            CoachingRollNumber = student.CoachingRollNumber,
            AdmissionNumber = student.AdmissionNumber,
            ProfilePhoto = student.ProfilePhoto,
            ParentName = student.ParentName,
            ParentWhatsAppPhone = student.ParentWhatsAppPhone,
            ClassName = student.Class?.Name,
            SectionName = student.Section?.Name,
            BatchName = student.Batch?.Name,
            IsSchoolStudent = student.IsSchoolStudent,
            IsCoachingStudent = student.IsCoachingStudent,
            AttendanceStatus = record.Status.ToString(),
            CheckInTime = record.CheckInTime,
            CheckOutTime = record.CheckOutTime,
            Remarks = record.Remarks,
            CaptureSource = record.CaptureSource,
            PunchDate = record.AttendanceDate
        };

        return Ok(new
        {
            Success = true,
            Message = $"{student.StudentName} marked {record.Status} at {record.CheckInTime}",
            Punch = resultItem,
            WhatsAppStatus = whatsAppStatus
        });
    }

    [HttpPost("bulk-punch")]
    public async Task<ActionResult<object>> BulkPunch([FromBody] AiAttendanceBulkPunchRequestDto dto)
    {
        if (dto.StudentIds == null || dto.StudentIds.Count == 0)
            return BadRequest(new { message = "No students selected for bulk punch." });

        var targetDate = dto.AttendanceDate?.Date ?? GetIstToday();
        var punchTime = GetIstTimeFormatted();

        if (!Enum.TryParse<TeacherAttendanceStatus>(dto.Status, true, out var parsedStatus))
        {
            parsedStatus = TeacherAttendanceStatus.Present;
        }

        var students = await _db.Students
            .Where(s => s.TenantId == _currentUser.TenantId && dto.StudentIds.Contains(s.Id))
            .ToListAsync();

        var existingAttendances = await _db.StudentAttendances
            .Where(a => a.TenantId == _currentUser.TenantId &&
                        a.AttendanceDate == targetDate &&
                        dto.StudentIds.Contains(a.StudentId))
            .ToDictionaryAsync(a => a.StudentId);

        var markedCount = 0;

        foreach (var s in students)
        {
            if (existingAttendances.TryGetValue(s.Id, out var existing))
            {
                existing.Status = parsedStatus;
                if (string.IsNullOrEmpty(existing.CheckInTime)) existing.CheckInTime = punchTime;
                existing.CaptureSource = "AiCameraScanner";
                existing.CapturedAt = DateTime.UtcNow;
                existing.MarkedBy = _currentUser.Username ?? "AI-Camera-Scanner";
            }
            else
            {
                _db.StudentAttendances.Add(new StudentAttendance
                {
                    TenantId = _currentUser.TenantId,
                    BranchId = s.BranchId ?? _currentUser.BranchId,
                    StudentId = s.Id,
                    AttendanceDate = targetDate,
                    Status = parsedStatus,
                    CheckInTime = punchTime,
                    Remarks = !string.IsNullOrWhiteSpace(dto.Remarks) ? dto.Remarks : "AI Scanner Bulk Punch",
                    MarkedBy = _currentUser.Username ?? "AI-Camera-Scanner",
                    CaptureSource = "AiCameraScanner",
                    CapturedAt = DateTime.UtcNow
                });
            }
            markedCount++;
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            Success = true,
            Message = $"Successfully marked {markedCount} students as {parsedStatus} at {punchTime}.",
            Count = markedCount
        });
    }

    [HttpPost("capture-photo")]
    public async Task<ActionResult<object>> CaptureStudentPhoto([FromBody] AiAttendancePhotoUploadRequestDto dto)
    {
        if (dto.StudentId == Guid.Empty || string.IsNullOrWhiteSpace(dto.PhotoBase64))
            return BadRequest(new { message = "Student ID and Base64 Photo are required." });

        var student = await _db.Students
            .FirstOrDefaultAsync(s => s.Id == dto.StudentId && s.TenantId == _currentUser.TenantId);

        if (student == null)
            return NotFound(new { message = "Student not found." });

        try
        {
            var cleanBase64 = dto.PhotoBase64;
            if (cleanBase64.Contains(','))
            {
                cleanBase64 = cleanBase64.Substring(cleanBase64.IndexOf(',') + 1);
            }

            var bytes = Convert.FromBase64String(cleanBase64);

            var webRoot = _environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var uploadsDir = Path.Combine(webRoot, "uploads", "students");
            if (!Directory.Exists(uploadsDir))
            {
                Directory.CreateDirectory(uploadsDir);
            }

            var fileName = $"student_{student.Id}_{DateTime.UtcNow.Ticks}.jpg";
            var filePath = Path.Combine(uploadsDir, fileName);

            await System.IO.File.WriteAllBytesAsync(filePath, bytes);

            var relativeUrl = $"/uploads/students/{fileName}";
            student.ProfilePhoto = relativeUrl;

            await _db.SaveChangesAsync();

            return Ok(new
            {
                Success = true,
                Message = $"Profile photo captured and saved for {student.StudentName}.",
                PhotoUrl = relativeUrl
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to save photo: " + ex.Message });
        }
    }
}
