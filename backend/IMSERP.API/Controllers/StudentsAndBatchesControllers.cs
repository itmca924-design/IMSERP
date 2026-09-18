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
public class StudentsController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;
    private readonly IWebHostEnvironment _env;

    public StudentsController(IIMSERPDbContext dbContext, ICurrentUserService currentUser, IWebHostEnvironment env)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _env = env;
    }

    private static bool TryParseAttendanceStatus(string value, out TeacherAttendanceStatus status)
    {
        if (!Enum.TryParse(value, true, out status)) return false;
        return status is TeacherAttendanceStatus.Present
            or TeacherAttendanceStatus.Absent
            or TeacherAttendanceStatus.Late
            or TeacherAttendanceStatus.HalfDay
            or TeacherAttendanceStatus.Holiday;
    }

    private static StudentAttendanceDto MapStudentAttendance(StudentAttendance attendance, Student student)
    {
        var rawDt = attendance.CapturedAt ?? (attendance.CreatedAt != default ? attendance.CreatedAt : (DateTime?)null);
        DateTime? capturedUtc = rawDt.HasValue
            ? DateTime.SpecifyKind(rawDt.Value, DateTimeKind.Utc)
            : null;

        return new(
            attendance.Id,
            attendance.StudentId,
            student.StudentName,
            student.RollNumber,
            attendance.AttendanceDate,
            attendance.Status.ToString(),
            attendance.Remarks,
            attendance.CaptureSource,
            capturedUtc);
    }

    private async Task<bool> IsManualAttendanceAllowedAsync()
    {
        var settings = await _dbContext.AttendanceSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);
        return !string.Equals(settings?.StudentMode, "Biometric", StringComparison.OrdinalIgnoreCase);
    }

    private async Task<bool> HasAttendancePermissionAsync(string route, bool edit)
    {
        var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);
        if (user?.RoleId == null) return false;
        return await _dbContext.RolePermissions.AsNoTracking()
            .Where(permission => permission.RoleId == user.RoleId && (edit ? permission.CanEdit : permission.CanCreate))
            .Join(_dbContext.MenuItems, permission => permission.MenuItemId, menu => menu.Id, (permission, menu) => menu.RouteUrl)
            .AnyAsync(routeUrl => routeUrl == route);
    }

    private async Task<bool> CanEditPublicHolidayOrSundayAsync()
    {
        if (_currentUser.UserId == Guid.Empty) return false;

        var user = await _dbContext.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);
        if (user?.RoleId == null) return false;

        return await _dbContext.RolePermissions.AsNoTracking()
            .Where(permission => permission.RoleId == user.RoleId && permission.CanEdit)
            .Join(_dbContext.MenuItems,
                permission => permission.MenuItemId,
                menu => menu.Id,
                (permission, menu) => menu.RouteUrl)
            .AnyAsync(route => route == "/teachers/attendance/ph-sun-edit");
    }

    private async Task<bool> IsPublicHolidayOrSundayAsync(DateTime date)
    {
        if (date.DayOfWeek == DayOfWeek.Sunday) return true;

        return await _dbContext.Holidays.AsNoTracking()
            .AnyAsync(holiday => holiday.IsActive && holiday.StartDate.Date <= date.Date && holiday.EndDate.Date >= date.Date);
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<StudentDto>>> GetStudents([FromQuery] Guid? batchId)
    {
        var query = _dbContext.Students.AsNoTracking()
            .Include(s => s.Batch)
            .Include(s => s.Class)
            .Include(s => s.Section)
            .AsQueryable();

        if (batchId.HasValue && batchId != Guid.Empty)
        {
            query = query.Where(s => s.BatchId == batchId);
        }

        var list = await query.Select(s => new StudentDto(
            s.Id,
            s.BatchId,
            s.Batch != null ? s.Batch.Name : "",
            s.RollNumber,
            s.StudentName,
            s.ParentName,
            s.ParentWhatsAppPhone,
            s.IsActive,
            s.JoiningDate,
            s.Address,
            s.ProfilePhoto,
            s.BranchId,
            null,
            s.ClassId,
            s.Class != null ? s.Class.Name : null,
            s.SectionId,
            s.Section != null ? s.Section.Name : null,
            s.AdmissionNumber,
            s.SchoolRollNumber,
            s.CoachingRollNumber,
            s.IsSchoolStudent,
            s.IsCoachingStudent,
            s.MotherName,
            s.Gender,
            s.DateOfBirth,
            s.BloodGroup
        )).ToListAsync();

        return Ok(list);
    }

    [HttpGet("next-roll-number")]
    public async Task<ActionResult<object>> GetNextRollNumber([FromQuery] Guid batchId)
    {
        if (batchId == Guid.Empty)
            return BadRequest(new { message = "batchId is required." });

        var batch = await _dbContext.Batches
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == batchId);

        if (batch == null)
            return NotFound(new { message = "Batch not found." });

        // Count students already enrolled in this batch
        var studentCount = await _dbContext.Students
            .AsNoTracking()
            .CountAsync(s => s.BatchId == batchId);

        // Build a short batch code from AcademicYear, e.g. "2025-26" => "26"
        var ayParts = batch.AcademicYear?.Split('-');
        var ayShort = ayParts != null && ayParts.Length >= 2
            ? ayParts[^1].Trim()
            : (batch.AcademicYear ?? DateTime.UtcNow.Year.ToString());

        // Roll number format: AY{short}-{SEQ:D3}  e.g. AY26-001
        var nextSeq = studentCount + 1;
        var rollNumber = $"AY{ayShort}-{nextSeq:D3}";

        return Ok(new { rollNumber });
    }

    [HttpGet("{id}/attendance")]
    public async Task<ActionResult<IEnumerable<StudentAttendanceDto>>> GetAttendance(
        Guid id, [FromQuery] int month = 0, [FromQuery] int year = 0)
    {
        if (month == 0) month = DateTime.UtcNow.Month;
        if (year == 0) year = DateTime.UtcNow.Year;

        var student = await _dbContext.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound(new { message = "Student not found." });

        var records = await _dbContext.StudentAttendances.AsNoTracking()
            .Where(a => a.StudentId == id && a.AttendanceDate.Month == month && a.AttendanceDate.Year == year)
            .OrderBy(a => a.AttendanceDate)
            .ToListAsync();

        return Ok(records.Select(a => MapStudentAttendance(a, student)));
    }

    [HttpGet("attendance/ph-sun-edit-permission")]
    public async Task<ActionResult<object>> GetPublicHolidaySundayEditPermission()
    {
        return Ok(new { canEdit = await CanEditPublicHolidayOrSundayAsync() });
    }

    [HttpGet("attendance/report")]
    public async Task<ActionResult<AttendanceReportDto>> GetAttendanceReport(
        [FromQuery] int month = 0, [FromQuery] int year = 0, [FromQuery] Guid? batchId = null)
    {
        if (month == 0) month = DateTime.UtcNow.Month;
        if (year == 0) year = DateTime.UtcNow.Year;

        var monthStart = new DateTime(year, month, 1);
        var monthEnd = new DateTime(year, month, DateTime.DaysInMonth(year, month));
        var offDates = new HashSet<DateTime>();
        for (var date = monthStart; date <= monthEnd; date = date.AddDays(1))
            if (date.DayOfWeek == DayOfWeek.Sunday) offDates.Add(date.Date);

        var holidays = await _dbContext.Holidays.AsNoTracking()
            .Where(holiday => holiday.IsActive && holiday.StartDate.Date <= monthEnd && holiday.EndDate.Date >= monthStart)
            .ToListAsync();
        foreach (var holiday in holidays)
        {
            var start = holiday.StartDate.Date < monthStart ? monthStart : holiday.StartDate.Date;
            var end = holiday.EndDate.Date > monthEnd ? monthEnd : holiday.EndDate.Date;
            for (var date = start; date <= end; date = date.AddDays(1)) offDates.Add(date.Date);
        }

        var studentsQuery = _dbContext.Students.AsNoTracking().Include(student => student.Batch).Where(student => student.IsActive);
        if (batchId.HasValue && batchId.Value != Guid.Empty) studentsQuery = studentsQuery.Where(student => student.BatchId == batchId.Value);
        var students = await studentsQuery.OrderBy(student => student.StudentName).ToListAsync();
        var studentIds = students.Select(student => student.Id).ToList();
        var records = await _dbContext.StudentAttendances.AsNoTracking()
            .Where(record => studentIds.Contains(record.StudentId) && record.AttendanceDate >= monthStart && record.AttendanceDate <= monthEnd)
            .ToListAsync();

        var rows = students.Select(student =>
        {
            var personRecords = records.Where(record => record.StudentId == student.Id).ToList();
            var present = personRecords.Count(record => record.Status == TeacherAttendanceStatus.Present);
            var absent = personRecords.Count(record => record.Status == TeacherAttendanceStatus.Absent);
            var late = personRecords.Count(record => record.Status == TeacherAttendanceStatus.Late);
            var half = personRecords.Count(record => record.Status == TeacherAttendanceStatus.HalfDay);
            var evaluated = present + absent + late + half;
            return new AttendanceReportRowDto(student.Id, student.StudentName, student.RollNumber, student.Batch?.Name ?? "", present, absent, late, half, offDates.Count, Math.Max(0, DateTime.DaysInMonth(year, month) - offDates.Count), evaluated == 0 ? 0 : Math.Round(((present + late + half * 0.5m) / evaluated) * 100, 1));
        }).ToList();

        return Ok(new AttendanceReportDto("Student", month, year, rows.Count, rows.Sum(row => row.PresentDays), rows.Sum(row => row.AbsentDays), rows.Sum(row => row.LateDays), rows.Sum(row => row.HalfDays), rows.Sum(row => row.HolidayDays), rows));
    }

    [HttpGet("{id}/attendance/summary")]
    public async Task<ActionResult<StudentAttendanceSummaryDto>> GetAttendanceSummary(
        Guid id, [FromQuery] int month = 0, [FromQuery] int year = 0)
    {
        if (month == 0) month = DateTime.UtcNow.Month;
        if (year == 0) year = DateTime.UtcNow.Year;

        if (!await _dbContext.Students.AnyAsync(s => s.Id == id)) return NotFound(new { message = "Student not found." });

        var monthStart = new DateTime(year, month, 1);
        var monthEnd = new DateTime(year, month, DateTime.DaysInMonth(year, month));
        var records = await _dbContext.StudentAttendances.AsNoTracking()
            .Where(a => a.StudentId == id && a.AttendanceDate >= monthStart && a.AttendanceDate <= monthEnd)
            .ToListAsync();

        int present = records.Count(a => a.Status == TeacherAttendanceStatus.Present);
        int absent = records.Count(a => a.Status == TeacherAttendanceStatus.Absent);
        int late = records.Count(a => a.Status == TeacherAttendanceStatus.Late);
        int half = records.Count(a => a.Status == TeacherAttendanceStatus.HalfDay);

        var offDates = new HashSet<DateTime>();
        for (var date = monthStart; date <= monthEnd; date = date.AddDays(1))
        {
            if (date.DayOfWeek == DayOfWeek.Sunday) offDates.Add(date.Date);
        }

        var holidays = await _dbContext.Holidays.AsNoTracking()
            .Where(h => h.IsActive && h.StartDate.Date <= monthEnd && h.EndDate.Date >= monthStart)
            .ToListAsync();

        foreach (var holiday in holidays)
        {
            var start = holiday.StartDate.Date < monthStart ? monthStart : holiday.StartDate.Date;
            var end = holiday.EndDate.Date > monthEnd ? monthEnd : holiday.EndDate.Date;
            for (var date = start; date <= end; date = date.AddDays(1)) offDates.Add(date.Date);
        }

        foreach (var record in records.Where(a => a.Status == TeacherAttendanceStatus.Holiday))
            offDates.Add(record.AttendanceDate.Date);

        var evaluatedDays = present + absent + late + half;
        var percentage = evaluatedDays == 0
            ? 0
            : Math.Round(((present + late + (half * 0.5m)) / evaluatedDays) * 100, 1);

        return Ok(new StudentAttendanceSummaryDto(
            present, absent, late, half, offDates.Count,
            Math.Max(0, DateTime.DaysInMonth(year, month) - offDates.Count), percentage));
    }

    [HttpPost("{id}/attendance")]
    public async Task<ActionResult<StudentAttendanceDto>> MarkAttendance(
        Guid id, [FromBody] MarkStudentAttendanceDto dto)
    {
        if (!await HasAttendancePermissionAsync("/attendance/permissions/manual", false))
            return Forbid();

        if (!await IsManualAttendanceAllowedAsync())
            return Conflict(new { message = "Manual student attendance is disabled. Current mode is Biometric." });

        var student = await _dbContext.Students.FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound(new { message = "Student not found." });
        if (!TryParseAttendanceStatus(dto.Status, out var status))
            return BadRequest(new { message = "Invalid attendance status." });

        var date = dto.AttendanceDate.Date;
        if (date > DateTime.UtcNow.Date)
            return BadRequest(new { message = "Cannot mark attendance for future dates." });

        if (date < DateTime.UtcNow.Date && !await HasAttendancePermissionAsync("/attendance/permissions/correction", true))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Marking or modifying past attendance requires Admin Attendance Correction permission." });

        if (!await CanEditPublicHolidayOrSundayAsync() && await IsPublicHolidayOrSundayAsync(date))
            return Forbid();

        var record = await _dbContext.StudentAttendances
            .FirstOrDefaultAsync(a => a.StudentId == id && a.AttendanceDate == date);

        if (record != null && !await HasAttendancePermissionAsync("/attendance/permissions/correction", true))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Modifying existing attendance records requires Admin Attendance Correction permission." });

        if (record == null)
        {
            record = new StudentAttendance
            {
                TenantId = _currentUser.TenantId,
                BranchId = student.BranchId ?? _currentUser.BranchId,
                StudentId = id,
                AttendanceDate = date,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.StudentAttendances.Add(record);
        }
        else if (!record.BranchId.HasValue && student.BranchId.HasValue)
        {
            record.BranchId = student.BranchId;
        }

        record.Status = status;
        record.Remarks = dto.Remarks;
        record.MarkedBy = _currentUser.UserId.ToString();
        record.CaptureSource = "Manual";
        record.BiometricDeviceId = null;
        record.BiometricEventId = null;
        record.CapturedAt ??= DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        return Ok(MapStudentAttendance(record, student));
    }

    [HttpGet("batch/{batchId}/attendance")]
    public async Task<ActionResult<IEnumerable<BatchAttendanceStudentRowDto>>> GetBatchAttendance(
        Guid batchId, [FromQuery] DateTime? date = null)
    {
        var targetDate = (date ?? DateTime.UtcNow).Date;
        var tenantId = _currentUser.TenantId;

        var students = await _dbContext.Students
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.BatchId == batchId && s.IsActive)
            .OrderBy(s => s.RollNumber)
            .ThenBy(s => s.StudentName)
            .ToListAsync();

        var studentIds = students.Select(s => s.Id).ToList();

        var existingRecords = await _dbContext.StudentAttendances
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId && studentIds.Contains(a.StudentId) && a.AttendanceDate == targetDate)
            .ToDictionaryAsync(a => a.StudentId);

        var result = students.Select(s =>
        {
            existingRecords.TryGetValue(s.Id, out var att);
            DateTime? captured = att?.CapturedAt ?? att?.CreatedAt;
            DateTime? capturedUtc = captured.HasValue ? DateTime.SpecifyKind(captured.Value, DateTimeKind.Utc) : null;
            return new BatchAttendanceStudentRowDto(
                s.Id,
                s.StudentName,
                s.RollNumber,
                s.ProfilePhoto,
                s.ParentWhatsAppPhone,
                att != null ? att.Status.ToString() : "Present",
                att?.Remarks,
                att?.Id,
                capturedUtc,
                att?.CaptureSource
            );
        }).ToList();

        return Ok(result);
    }

    [HttpPost("batch/{batchId}/attendance/bulk")]
    public async Task<IActionResult> SaveBulkBatchAttendance(
        Guid batchId, [FromBody] BulkBatchAttendanceDto dto)
    {
        if (!await HasAttendancePermissionAsync("/attendance/permissions/manual", false))
            return Forbid();

        if (!await IsManualAttendanceAllowedAsync())
            return Conflict(new { message = "Manual student attendance is disabled. Current mode is Biometric." });

        var date = dto.AttendanceDate.Date;
        if (date > DateTime.UtcNow.Date)
            return BadRequest(new { message = "Cannot mark attendance for future dates." });

        if (date < DateTime.UtcNow.Date && !await HasAttendancePermissionAsync("/attendance/permissions/correction", true))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Marking or modifying past attendance requires Admin Attendance Correction permission." });

        if (!await CanEditPublicHolidayOrSundayAsync() && await IsPublicHolidayOrSundayAsync(date))
            return Forbid();

        var tenantId = _currentUser.TenantId;
        var batch = await _dbContext.Batches.Include(b => b.Branch).FirstOrDefaultAsync(b => b.Id == batchId && b.TenantId == tenantId);
        if (batch == null) return NotFound(new { message = "Batch not found." });

        var studentIds = dto.Items.Select(i => i.StudentId).ToList();
        var students = await _dbContext.Students
            .Where(s => s.TenantId == tenantId && studentIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id);

        var existingRecords = await _dbContext.StudentAttendances
            .Where(a => a.TenantId == tenantId && studentIds.Contains(a.StudentId) && a.AttendanceDate == date)
            .ToDictionaryAsync(a => a.StudentId);

        int presentCount = 0;
        int absentCount = 0;
        int lateCount = 0;
        int halfDayCount = 0;

        foreach (var item in dto.Items)
        {
            if (!students.TryGetValue(item.StudentId, out var student)) continue;
            if (!TryParseAttendanceStatus(item.Status, out var status)) continue;

            if (status == TeacherAttendanceStatus.Present) presentCount++;
            else if (status == TeacherAttendanceStatus.Absent) absentCount++;
            else if (status == TeacherAttendanceStatus.Late) lateCount++;
            else if (status == TeacherAttendanceStatus.HalfDay) halfDayCount++;

            if (existingRecords.TryGetValue(item.StudentId, out var existing))
            {
                existing.Status = status;
                existing.Remarks = item.Remarks;
                existing.MarkedBy = _currentUser.UserId.ToString();
                existing.BranchId = student.BranchId ?? batch.BranchId ?? _currentUser.BranchId;
                existing.CaptureSource = "ManualBulk";
                existing.CapturedAt = DateTime.UtcNow;
            }
            else
            {
                var newRecord = new StudentAttendance
                {
                    TenantId = tenantId,
                    BranchId = student.BranchId ?? batch.BranchId ?? _currentUser.BranchId,
                    StudentId = student.Id,
                    AttendanceDate = date,
                    Status = status,
                    Remarks = item.Remarks,
                    MarkedBy = _currentUser.UserId.ToString(),
                    CaptureSource = "ManualBulk",
                    CapturedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };
                _dbContext.StudentAttendances.Add(newRecord);
            }
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = $"Batch attendance saved successfully for {dto.Items.Count} students.",
            totalCount = dto.Items.Count,
            presentCount,
            absentCount,
            lateCount,
            halfDayCount
        });
    }

    [HttpDelete("attendance/{attendanceId}")]
    public async Task<IActionResult> DeleteAttendance(Guid attendanceId)
    {
        if (!await HasAttendancePermissionAsync("/attendance/permissions/correction", true))
            return Forbid();

        if (!await IsManualAttendanceAllowedAsync())
            return Conflict(new { message = "Manual student attendance changes are disabled in Biometric Only mode." });

        var record = await _dbContext.StudentAttendances.FindAsync(attendanceId);
        if (record == null) return NotFound();

        if (!await CanEditPublicHolidayOrSundayAsync() && await IsPublicHolidayOrSundayAsync(record.AttendanceDate))
            return Forbid();

        _dbContext.StudentAttendances.Remove(record);
        await _dbContext.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("check-phone")]
    public async Task<IActionResult> CheckPhoneDuplicate(
        [FromQuery] string phone, 
        [FromQuery] Guid? excludeStudentId = null,
        [FromQuery] string? currentStudentName = null)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return BadRequest(new { message = "phone is required." });

        var tenantId = _currentUser.TenantId;
        var clean = phone.Trim().Replace(" ", "").Replace("-", "");
        var withPrefix = clean.StartsWith("+91") ? clean : "+91" + clean;
        var withoutPrefix = clean.StartsWith("+91") ? clean.Substring(3) : clean;

        var query = _dbContext.Students
            .AsNoTracking()
            .Include(s => s.Batch)
            .ThenInclude(b => b.Branch)
            .Include(s => s.Branch)
            .Where(s => s.TenantId == tenantId)
            .Where(s => s.ParentWhatsAppPhone == clean || s.ParentWhatsAppPhone == withPrefix || s.ParentWhatsAppPhone == withoutPrefix);

        if (excludeStudentId.HasValue && excludeStudentId != Guid.Empty)
            query = query.Where(s => s.Id != excludeStudentId.Value);

        var existing = await query
            .Select(s => new
            {
                s.StudentName,
                s.ParentName,
                BatchName = s.Batch != null ? s.Batch.Name : "",
                BranchName = s.Branch != null ? s.Branch.Name : (s.Batch != null && s.Batch.Branch != null ? s.Batch.Branch.Name : "")
            })
            .FirstOrDefaultAsync();

        if (existing != null)
        {
            var isSameStudent = !string.IsNullOrWhiteSpace(currentStudentName)
                && string.Equals(existing.StudentName.Trim(), currentStudentName.Trim(), StringComparison.OrdinalIgnoreCase);

            return Ok(new
            {
                isFound = true,
                isDuplicate = isSameStudent,
                isSibling = !isSameStudent,
                studentName = existing.StudentName,
                parentName = existing.ParentName,
                batchName = existing.BatchName,
                branchName = existing.BranchName
            });
        }

        return Ok(new
        {
            isFound = false,
            isDuplicate = false,
            isSibling = false,
            studentName = (string?)null,
            parentName = (string?)null,
            batchName = (string?)null,
            branchName = (string?)null
        });
    }

    [HttpGet("paged")]
    public async Task<ActionResult<PagedResult<StudentDto>>> GetStudentsPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? sortBy = "rollNumber",
        [FromQuery] bool sortDescending = false,
        [FromQuery] Guid? batchId = null,
        [FromQuery] Guid? classId = null,
        [FromQuery] Guid? sectionId = null,
        [FromQuery] string? stream = null) // "school", "coaching", or null for all
    {
        var query = _dbContext.Students.AsNoTracking()
            .Include(s => s.Batch)
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Branch)
            .AsQueryable();

        if (batchId.HasValue && batchId != Guid.Empty)
        {
            query = query.Where(s => s.BatchId == batchId.Value);
        }

        if (classId.HasValue && classId != Guid.Empty)
        {
            query = query.Where(s => s.ClassId == classId.Value);
        }

        if (sectionId.HasValue && sectionId != Guid.Empty)
        {
            query = query.Where(s => s.SectionId == sectionId.Value);
        }

        if (!string.IsNullOrWhiteSpace(stream))
        {
            if (stream.Equals("school", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(s => s.IsSchoolStudent);
            }
            else if (stream.Equals("coaching", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(s => s.IsCoachingStudent);
            }
            else if (stream.Equals("hostel", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(s => s.IsHostelStudent);
            }
            else if (stream.Equals("dayscholar", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(s => !s.IsHostelStudent);
            }
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(s => s.RollNumber.ToLower().Contains(term) ||
                                     s.StudentName.ToLower().Contains(term) ||
                                     s.ParentName.ToLower().Contains(term) ||
                                     s.ParentWhatsAppPhone.ToLower().Contains(term) ||
                                     (s.AdmissionNumber != null && s.AdmissionNumber.ToLower().Contains(term)) ||
                                     (s.SchoolRollNumber != null && s.SchoolRollNumber.ToLower().Contains(term)) ||
                                     (s.CoachingRollNumber != null && s.CoachingRollNumber.ToLower().Contains(term)));
        }

        query = (sortBy?.ToLower()) switch
        {
            "name" => sortDescending ? query.OrderByDescending(s => s.StudentName) : query.OrderBy(s => s.StudentName),
            "rollnumber" => sortDescending ? query.OrderByDescending(s => s.RollNumber) : query.OrderBy(s => s.RollNumber),
            "joiningdate" => sortDescending ? query.OrderByDescending(s => s.JoiningDate) : query.OrderBy(s => s.JoiningDate),
            _ => sortDescending ? query.OrderByDescending(s => s.RollNumber) : query.OrderBy(s => s.RollNumber)
        };

        var totalCount = await query.CountAsync();
        var items = await query
            .Include(s => s.HostelBed)
                .ThenInclude(b => b.Room)
                    .ThenInclude(r => r.Hostel)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new StudentDto(
                s.Id,
                s.BatchId,
                s.Batch != null ? s.Batch.Name : "",
                s.RollNumber,
                s.StudentName,
                s.ParentName,
                s.ParentWhatsAppPhone,
                s.IsActive,
                s.JoiningDate,
                s.Address,
                s.ProfilePhoto,
                s.BranchId,
                s.Branch != null ? s.Branch.Name : null,
                s.ClassId,
                s.Class != null ? s.Class.Name : null,
                s.SectionId,
                s.Section != null ? s.Section.Name : null,
                s.AdmissionNumber,
                s.SchoolRollNumber,
                s.CoachingRollNumber,
                s.IsSchoolStudent,
                s.IsCoachingStudent,
                s.MotherName,
                s.Gender,
                s.DateOfBirth,
                s.BloodGroup,
                s.IsHostelStudent,
                s.HostelBedId,
                s.HostelBed != null && s.HostelBed.Room != null && s.HostelBed.Room.Hostel != null ? s.HostelBed.Room.Hostel.Name : null,
                s.HostelBed != null && s.HostelBed.Room != null ? s.HostelBed.Room.RoomNumber : null,
                s.HostelBed != null ? s.HostelBed.BedCode : null
            )).ToListAsync();

        return Ok(new PagedResult<StudentDto>(items, totalCount, pageNumber, pageSize));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteStudent(Guid id)
    {
        var student = await _dbContext.Students.FindAsync(id);
        if (student == null) return NotFound();

        _dbContext.Students.Remove(student);
        await _dbContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost]
    public async Task<ActionResult<StudentDto>> CreateStudent([FromBody] CreateStudentDto dto)
    {
        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<ActionResult<StudentDto>>(async () =>
        {
            using var transaction = await _dbContext.Database.BeginTransactionAsync();

            var batch = dto.BatchId.HasValue ? await _dbContext.Batches.Include(b => b.Branch).FirstOrDefaultAsync(b => b.Id == dto.BatchId.Value) : null;
            var targetBranchId = dto.BranchId ?? batch?.BranchId ?? _currentUser.BranchId;
            if (!targetBranchId.HasValue || targetBranchId.Value == Guid.Empty)
            {
                var mainBranch = await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.IsMainBranch);
                targetBranchId = mainBranch?.Id;
            }

            var student = new Student
            {
                TenantId = _currentUser.TenantId,
                BranchId = targetBranchId,
                BatchId = dto.BatchId,
                ClassId = dto.ClassId,
                SectionId = dto.SectionId,
                RollNumber = !string.IsNullOrWhiteSpace(dto.RollNumber) ? dto.RollNumber : (dto.SchoolRollNumber ?? dto.CoachingRollNumber ?? "N/A"),
                SchoolRollNumber = dto.SchoolRollNumber,
                CoachingRollNumber = dto.CoachingRollNumber ?? dto.RollNumber,
                AdmissionNumber = dto.AdmissionNumber,
                IsSchoolStudent = dto.IsSchoolStudent,
                IsCoachingStudent = dto.IsCoachingStudent,
                IsHostelStudent = dto.IsHostelStudent,
                HostelBedId = dto.IsHostelStudent ? dto.HostelBedId : null,
                StudentName = dto.StudentName,
                ParentName = dto.ParentName,
                ParentWhatsAppPhone = dto.ParentWhatsAppPhone,
                MotherName = dto.MotherName,
                Gender = dto.Gender,
                DateOfBirth = dto.DateOfBirth,
                BloodGroup = dto.BloodGroup,
                Address = dto.Address,
                JoiningDate = DateTime.UtcNow,
                IsActive = true
            };

            _dbContext.Students.Add(student);
            await _dbContext.SaveChangesAsync();

            // Reserve bed if hostel student
            if (dto.IsHostelStudent && dto.HostelBedId.HasValue)
            {
                var bed = await _dbContext.HostelBeds.FindAsync(dto.HostelBedId.Value);
                if (bed != null)
                {
                    bed.Status = "Occupied";
                    bed.CurrentStudentId = student.Id;
                    _dbContext.HostelAllocations.Add(new HostelAllocation
                    {
                        TenantId = _currentUser.TenantId,
                        BranchId = targetBranchId,
                        StudentId = student.Id,
                        BedId = bed.Id,
                        AllocatedDate = DateTime.UtcNow,
                        MonthlyRent = bed.MonthlyRent,
                        IsMessIncluded = true,
                        Status = "Active"
                    });
                }
            }

            // Save profile photo after we have the student Id
            student.ProfilePhoto = ImageStorageHelper.SaveBase64Image(dto.ProfilePhoto, "students", student.Id.ToString(), _env.ContentRootPath);
            await _dbContext.SaveChangesAsync();

            // Auto-generate initial Monthly Fee Invoice for coaching student if enrolled in batch
            if (dto.IsCoachingStudent && batch != null)
            {
                var feeRate = batch.StandardMonthlyFee;
                var now = DateTime.UtcNow;

                var initialInvoice = new FeeInvoice
                {
                    TenantId = _currentUser.TenantId,
                    BranchId = student.BranchId,
                    StudentId = student.Id,
                    InvoiceNumber = $"INV-{now.Year}{now.Month:D2}-{new Random().Next(100, 999)}",
                    Title = $"{now:MMMM yyyy} Tuition Fee",
                    InvoiceCategory = "Coaching",
                    TotalAmount = feeRate,
                    PaidAmount = 0,
                    DueDate = new DateTime(now.Year, now.Month, Math.Min(10, DateTime.DaysInMonth(now.Year, now.Month))),
                    Status = InvoiceStatus.Pending,
                    CreatedAt = now
                };

                _dbContext.FeeInvoices.Add(initialInvoice);
                await _dbContext.SaveChangesAsync();
            }

            await transaction.CommitAsync();

            var branchName = student.BranchId.HasValue
                ? (await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == student.BranchId))?.Name
                : null;

            var className = student.ClassId.HasValue
                ? (await _dbContext.SchoolClasses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == student.ClassId))?.Name
                : null;

            var sectionName = student.SectionId.HasValue
                ? (await _dbContext.SchoolSections.AsNoTracking().FirstOrDefaultAsync(sec => sec.Id == student.SectionId))?.Name
                : null;

            return Ok(new StudentDto(
                student.Id,
                student.BatchId,
                batch?.Name ?? "",
                student.RollNumber,
                student.StudentName,
                student.ParentName,
                student.ParentWhatsAppPhone,
                student.IsActive,
                student.JoiningDate,
                student.Address,
                student.ProfilePhoto,
                student.BranchId,
                branchName,
                student.ClassId,
                className,
                student.SectionId,
                sectionName,
                student.AdmissionNumber,
                student.SchoolRollNumber,
                student.CoachingRollNumber,
                student.IsSchoolStudent,
                student.IsCoachingStudent,
                student.MotherName,
                student.Gender,
                student.DateOfBirth,
                student.BloodGroup
            ));
        });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<StudentDto>> UpdateStudent(Guid id, [FromBody] CreateStudentDto dto)
    {
        var student = await _dbContext.Students.FindAsync(id);
        if (student == null) return NotFound();

        var batch = dto.BatchId.HasValue ? await _dbContext.Batches.FindAsync(dto.BatchId.Value) : null;
        if (dto.BranchId.HasValue && dto.BranchId.Value != Guid.Empty)
        {
            student.BranchId = dto.BranchId.Value;
        }
        else if (batch?.BranchId.HasValue == true)
        {
            student.BranchId = batch.BranchId;
        }
        else if (!student.BranchId.HasValue && _currentUser.BranchId.HasValue)
        {
            student.BranchId = _currentUser.BranchId;
        }

        student.BatchId = dto.BatchId;
        student.ClassId = dto.ClassId;
        student.SectionId = dto.SectionId;
        student.RollNumber = !string.IsNullOrWhiteSpace(dto.RollNumber) ? dto.RollNumber : (dto.SchoolRollNumber ?? dto.CoachingRollNumber ?? student.RollNumber);
        student.SchoolRollNumber = dto.SchoolRollNumber;
        student.CoachingRollNumber = dto.CoachingRollNumber;
        student.AdmissionNumber = dto.AdmissionNumber;
        // Hostel Bed Allocation / Reallocation / Deallocation
        if (student.IsHostelStudent != dto.IsHostelStudent || student.HostelBedId != dto.HostelBedId)
        {
            if (student.HostelBedId.HasValue && (!dto.IsHostelStudent || student.HostelBedId != dto.HostelBedId))
            {
                var oldBed = await _dbContext.HostelBeds.FindAsync(student.HostelBedId.Value);
                if (oldBed != null && oldBed.CurrentStudentId == student.Id)
                {
                    oldBed.Status = "Available";
                    oldBed.CurrentStudentId = null;
                }
                var activeAlloc = await _dbContext.HostelAllocations
                    .FirstOrDefaultAsync(a => a.StudentId == student.Id && a.Status == "Active");
                if (activeAlloc != null)
                {
                    activeAlloc.Status = "Vacated";
                    activeAlloc.VacatedDate = DateTime.UtcNow;
                }
            }

            if (dto.IsHostelStudent && dto.HostelBedId.HasValue && student.HostelBedId != dto.HostelBedId)
            {
                var newBed = await _dbContext.HostelBeds.FindAsync(dto.HostelBedId.Value);
                if (newBed != null)
                {
                    newBed.Status = "Occupied";
                    newBed.CurrentStudentId = student.Id;
                    _dbContext.HostelAllocations.Add(new HostelAllocation
                    {
                        TenantId = _currentUser.TenantId,
                        BranchId = student.BranchId,
                        StudentId = student.Id,
                        BedId = newBed.Id,
                        AllocatedDate = DateTime.UtcNow,
                        MonthlyRent = newBed.MonthlyRent,
                        IsMessIncluded = true,
                        Status = "Active"
                    });
                }
            }
        }

        student.IsHostelStudent = dto.IsHostelStudent;
        student.HostelBedId = dto.IsHostelStudent ? dto.HostelBedId : null;
        student.StudentName = dto.StudentName;
        student.ParentName = dto.ParentName;
        student.ParentWhatsAppPhone = dto.ParentWhatsAppPhone;
        student.MotherName = dto.MotherName;
        student.Gender = dto.Gender;
        student.DateOfBirth = dto.DateOfBirth;
        student.BloodGroup = dto.BloodGroup;
        student.Address = dto.Address;
        student.ProfilePhoto = ImageStorageHelper.SaveBase64Image(dto.ProfilePhoto, "students", student.Id.ToString(), _env.ContentRootPath)
            ?? student.ProfilePhoto;

        await _dbContext.SaveChangesAsync();

        var branchName = student.BranchId.HasValue
            ? (await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == student.BranchId))?.Name
            : null;

        var className = student.ClassId.HasValue
            ? (await _dbContext.SchoolClasses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == student.ClassId))?.Name
            : null;

        var sectionName = student.SectionId.HasValue
            ? (await _dbContext.SchoolSections.AsNoTracking().FirstOrDefaultAsync(sec => sec.Id == student.SectionId))?.Name
            : null;

        string? hostelName = null;
        string? roomNum = null;
        string? bedCode = null;
        if (student.HostelBedId.HasValue)
        {
            var bedInfo = await _dbContext.HostelBeds
                .Include(b => b.Room).ThenInclude(r => r.Hostel)
                .AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == student.HostelBedId.Value);
            if (bedInfo != null)
            {
                bedCode = bedInfo.BedCode;
                roomNum = bedInfo.Room?.RoomNumber;
                hostelName = bedInfo.Room?.Hostel?.Name;
            }
        }

        return Ok(new StudentDto(
            student.Id,
            student.BatchId,
            batch?.Name ?? "",
            student.RollNumber,
            student.StudentName,
            student.ParentName,
            student.ParentWhatsAppPhone,
            student.IsActive,
            student.JoiningDate,
            student.Address,
            student.ProfilePhoto,
            student.BranchId,
            branchName,
            student.ClassId,
            className,
            student.SectionId,
            sectionName,
            student.AdmissionNumber,
            student.SchoolRollNumber,
            student.CoachingRollNumber,
            student.IsSchoolStudent,
            student.IsCoachingStudent,
            student.MotherName,
            student.Gender,
            student.DateOfBirth,
            student.BloodGroup,
            student.IsHostelStudent,
            student.HostelBedId,
            hostelName,
            roomNum,
            bedCode
        ));
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BatchesController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;

    public BatchesController(IIMSERPDbContext dbContext, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<BatchDto>>> GetBatches()
    {
        var list = await _dbContext.Batches
            .AsNoTracking()
            .Include(b => b.Branch)
            .Include(b => b.Room)
            .Select(b => new BatchDto(
                b.Id,
                b.Name,
                b.Subject,
                b.AcademicYear,
                b.StandardMonthlyFee,
                b.Students.Count,
                b.BranchId,
                b.Branch != null ? b.Branch.Name : null,
                b.RoomId,
                b.Room != null ? b.Room.RoomNumber : null
            )).ToListAsync();

        return Ok(list);
    }

    [HttpGet("paged")]
    public async Task<ActionResult<PagedResult<BatchDto>>> GetBatchesPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? sortBy = "name",
        [FromQuery] bool sortDescending = false,
        [FromQuery] string? academicYear = null)
    {
        var query = _dbContext.Batches
            .AsNoTracking()
            .Include(b => b.Branch)
            .Include(b => b.Room)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(academicYear))
        {
            query = query.Where(b => b.AcademicYear == academicYear.Trim());
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(b => b.Name.ToLower().Contains(term) ||
                                     b.Subject.ToLower().Contains(term) ||
                                     b.AcademicYear.ToLower().Contains(term));
        }

        query = (sortBy?.ToLower()) switch
        {
            "subject" => sortDescending ? query.OrderByDescending(b => b.Subject) : query.OrderBy(b => b.Subject),
            "academicyear" => sortDescending ? query.OrderByDescending(b => b.AcademicYear) : query.OrderBy(b => b.AcademicYear),
            "fee" => sortDescending ? query.OrderByDescending(b => b.StandardMonthlyFee) : query.OrderBy(b => b.StandardMonthlyFee),
            "students" => sortDescending ? query.OrderByDescending(b => b.Students.Count) : query.OrderBy(b => b.Students.Count),
            _ => sortDescending ? query.OrderByDescending(b => b.Name) : query.OrderBy(b => b.Name)
        };

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(b => new BatchDto(
                b.Id,
                b.Name,
                b.Subject,
                b.AcademicYear,
                b.StandardMonthlyFee,
                b.Students.Count,
                b.BranchId,
                b.Branch != null ? b.Branch.Name : null,
                b.RoomId,
                b.Room != null ? b.Room.RoomNumber : null
            )).ToListAsync();

        return Ok(new PagedResult<BatchDto>(items, totalCount, pageNumber, pageSize));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<BatchDto>> GetBatchById(Guid id)
    {
        var batch = await _dbContext.Batches
            .AsNoTracking()
            .Include(b => b.Students)
            .Include(b => b.Branch)
            .Include(b => b.Room)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (batch == null) return NotFound();

        return Ok(new BatchDto(
            batch.Id,
            batch.Name,
            batch.Subject,
            batch.AcademicYear,
            batch.StandardMonthlyFee,
            batch.Students.Count,
            batch.BranchId,
            batch.Branch?.Name,
            batch.RoomId,
            batch.Room?.RoomNumber
        ));
    }

    [HttpPost]
    public async Task<ActionResult<BatchDto>> CreateBatch([FromBody] CreateBatchDto dto)
    {
        var targetBranchId = dto.BranchId ?? _currentUser.BranchId;
        if (!targetBranchId.HasValue || targetBranchId.Value == Guid.Empty)
        {
            var mainBranch = await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.IsMainBranch);
            targetBranchId = mainBranch?.Id;
        }

        var batch = new Batch
        {
            TenantId = _currentUser.TenantId,
            BranchId = targetBranchId,
            RoomId = dto.RoomId,
            Name = dto.Name,
            Subject = dto.Subject,
            AcademicYear = dto.AcademicYear,
            StandardMonthlyFee = dto.StandardMonthlyFee
        };

        _dbContext.Batches.Add(batch);
        await _dbContext.SaveChangesAsync();

        var branchName = (await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == batch.BranchId))?.Name;
        var roomNumber = batch.RoomId.HasValue ? (await _dbContext.Rooms.AsNoTracking().FirstOrDefaultAsync(r => r.Id == batch.RoomId))?.RoomNumber : null;

        return Ok(new BatchDto(
            batch.Id,
            batch.Name,
            batch.Subject,
            batch.AcademicYear,
            batch.StandardMonthlyFee,
            0,
            batch.BranchId,
            branchName,
            batch.RoomId,
            roomNumber
        ));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<BatchDto>> UpdateBatch(Guid id, [FromBody] CreateBatchDto dto)
    {
        var batch = await _dbContext.Batches.FindAsync(id);
        if (batch == null) return NotFound();

        batch.Name = dto.Name;
        batch.Subject = dto.Subject;
        batch.AcademicYear = dto.AcademicYear;
        batch.StandardMonthlyFee = dto.StandardMonthlyFee;
        if (dto.BranchId.HasValue && dto.BranchId.Value != Guid.Empty) batch.BranchId = dto.BranchId.Value;
        batch.RoomId = dto.RoomId;

        await _dbContext.SaveChangesAsync();

        var studentCount = await _dbContext.Students.CountAsync(s => s.BatchId == id);
        var branchName = (await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == batch.BranchId))?.Name;
        var roomNumber = batch.RoomId.HasValue ? (await _dbContext.Rooms.AsNoTracking().FirstOrDefaultAsync(r => r.Id == batch.RoomId))?.RoomNumber : null;

        return Ok(new BatchDto(
            batch.Id,
            batch.Name,
            batch.Subject,
            batch.AcademicYear,
            batch.StandardMonthlyFee,
            studentCount,
            batch.BranchId,
            branchName,
            batch.RoomId,
            roomNumber
        ));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteBatch(Guid id)
    {
        var batch = await _dbContext.Batches.FindAsync(id);
        if (batch == null) return NotFound();

        _dbContext.Batches.Remove(batch);
        await _dbContext.SaveChangesAsync();

        return NoContent();
    }
}
