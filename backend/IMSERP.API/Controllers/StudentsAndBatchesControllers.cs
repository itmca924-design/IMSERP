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
    private readonly IPasswordHasherService _passwordHasher;
    private readonly IWebHostEnvironment _env;

    public StudentsController(IIMSERPDbContext dbContext, ICurrentUserService currentUser, IPasswordHasherService passwordHasher, IWebHostEnvironment env)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _passwordHasher = passwordHasher;
        _env = env;
    }

    private static string NormalizePhoneWithPrefix(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return string.Empty;
        var digits = System.Text.RegularExpressions.Regex.Replace(phone, @"\D", "");
        if (digits.Length == 10) return "+91" + digits;
        if (digits.Length == 12 && digits.StartsWith("91")) return "+" + digits;
        return phone.Trim();
    }

    private static bool TryParseAttendanceStatus(string value, out TeacherAttendanceStatus status)
    {
        if (!Enum.TryParse(value, true, out status)) return false;
        return status is TeacherAttendanceStatus.Present
            or TeacherAttendanceStatus.Absent
            or TeacherAttendanceStatus.Late
            or TeacherAttendanceStatus.HalfDay
            or TeacherAttendanceStatus.Holiday
            or TeacherAttendanceStatus.Leave;
    }

    public static TeacherAttendanceStatus EvaluateStudentSmartAttendanceStatus(
        TeacherAttendanceStatus declaredStatus, string? inTime, string? outTime, AttendanceSettings? settings = null)
    {
        if (declaredStatus == TeacherAttendanceStatus.Absent || declaredStatus == TeacherAttendanceStatus.Holiday || declaredStatus == TeacherAttendanceStatus.WeekOff || declaredStatus == TeacherAttendanceStatus.Leave)
            return declaredStatus;

        if (string.IsNullOrWhiteSpace(inTime))
            return declaredStatus;

        var inMin = ParseTimeToMinutes(inTime);
        if (inMin == null)
            return declaredStatus;

        int halfDayThreshold = settings?.StudentHalfDayThresholdMinutes ?? 240;
        int shiftStartMin = ParseTimeToMinutes(settings?.StudentShiftStartTime ?? "08:00") ?? 480;
        int graceMinutes = settings?.StudentGracePeriodMinutes ?? 15;
        int lateCutoffMin = shiftStartMin + graceMinutes;

        // If outTime is provided, evaluate work duration for half day
        if (!string.IsNullOrWhiteSpace(outTime))
        {
            var outMin = ParseTimeToMinutes(outTime);
            if (outMin != null)
            {
                int calculatedOut = outMin.Value;
                if (calculatedOut <= inMin.Value)
                {
                    if (!outTime.Contains("AM", StringComparison.OrdinalIgnoreCase) && !outTime.Contains("PM", StringComparison.OrdinalIgnoreCase))
                    {
                        if (calculatedOut + 720 > inMin.Value && calculatedOut + 720 <= 1440)
                        {
                            calculatedOut += 720;
                        }
                    }
                }

                int diff = calculatedOut - inMin.Value;
                if (diff > 0 && diff < halfDayThreshold)
                {
                    return TeacherAttendanceStatus.HalfDay;
                }
            }
        }

        // Late detection based on check-in arrival time
        if (inMin.Value > lateCutoffMin)
        {
            return TeacherAttendanceStatus.Late;
        }
        else if (inMin.Value <= lateCutoffMin && declaredStatus == TeacherAttendanceStatus.Late)
        {
            return TeacherAttendanceStatus.Present;
        }

        return declaredStatus;
    }

    private static int? ParseTimeToMinutes(string timeStr)
    {
        if (string.IsNullOrWhiteSpace(timeStr)) return null;
        var str = timeStr.Trim();
        var match = System.Text.RegularExpressions.Regex.Match(str, @"^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (!match.Success) return null;

        if (!int.TryParse(match.Groups[1].Value, out int hour) || !int.TryParse(match.Groups[2].Value, out int minute))
            return null;

        string meridiem = match.Groups[3].Value.ToUpperInvariant();
        if (meridiem == "PM")
        {
            if (hour < 12) hour += 12;
        }
        else if (meridiem == "AM")
        {
            if (hour == 12) hour = 0;
        }

        return hour * 60 + minute;
    }

    private static StudentAttendanceDto MapStudentAttendance(StudentAttendance attendance, Student student, AttendanceSettings? settings = null)
    {
        var rawDt = attendance.CapturedAt ?? (attendance.CreatedAt != default ? attendance.CreatedAt : (DateTime?)null);
        DateTime? capturedUtc = rawDt.HasValue
            ? DateTime.SpecifyKind(rawDt.Value, DateTimeKind.Utc)
            : null;

        var effStatus = EvaluateStudentSmartAttendanceStatus(attendance.Status, attendance.CheckInTime, attendance.CheckOutTime, settings);

        return new(
            attendance.Id,
            attendance.StudentId,
            student.StudentName,
            student.RollNumber,
            attendance.AttendanceDate,
            effStatus.ToString(),
            attendance.Remarks,
            attendance.CaptureSource,
            capturedUtc,
            attendance.CheckInTime,
            attendance.CheckOutTime);
    }

    private async Task<bool> IsManualAttendanceAllowedAsync()
    {
        var settings = await _dbContext.AttendanceSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);
        return !string.Equals(settings?.StudentMode, "Biometric", StringComparison.OrdinalIgnoreCase);
    }

    private async Task<bool> HasAttendancePermissionAsync(string route, bool edit)
    {
        var user = await _dbContext.Users.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);
        if (user == null) return false;
        if (user.Role == IMSERP.Domain.Enums.UserRole.SuperAdmin || user.Role == IMSERP.Domain.Enums.UserRole.InstituteAdmin) return true;
        if (user.RoleId == null) return false;

        var hasDirect = await _dbContext.RolePermissions.AsNoTracking()
            .Where(permission => permission.RoleId == user.RoleId && (edit ? permission.CanEdit : permission.CanCreate))
            .Join(_dbContext.MenuItems, permission => permission.MenuItemId, menu => menu.Id, (permission, menu) => menu.RouteUrl)
            .AnyAsync(routeUrl => routeUrl == route);
        if (hasDirect) return true;

        if (route == "/attendance/permissions/manual" || route == "/attendance/permissions/correction")
        {
            return await _dbContext.RolePermissions.AsNoTracking()
                .Where(permission => permission.RoleId == user.RoleId && (edit ? permission.CanEdit : (permission.CanCreate || permission.CanEdit)))
                .Join(_dbContext.MenuItems, permission => permission.MenuItemId, menu => menu.Id, (permission, menu) => menu.RouteUrl)
                .AnyAsync(routeUrl => routeUrl == "/students/attendance");
        }

        return false;
    }

    private async Task<bool> CanEditPublicHolidayOrSundayAsync()
    {
        if (_currentUser.UserId == Guid.Empty) return false;

        var user = await _dbContext.Users.IgnoreQueryFilters().AsNoTracking()
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

    [HttpGet("lookup")]
    public async Task<IActionResult> GetStudentsLookup([FromQuery] Guid? classId = null, [FromQuery] Guid? sectionId = null, [FromQuery] Guid? batchId = null)
    {
        var tenantId = _currentUser.TenantId;
        var query = _dbContext.Students.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.IsActive);

        if (classId.HasValue && classId != Guid.Empty)
            query = query.Where(s => s.ClassId == classId.Value);

        if (sectionId.HasValue && sectionId != Guid.Empty)
            query = query.Where(s => s.SectionId == sectionId.Value);

        if (batchId.HasValue && batchId != Guid.Empty)
            query = query.Where(s => s.BatchId == batchId.Value);

        var list = await query
            .OrderBy(s => s.SchoolRollNumber)
            .ThenBy(s => s.RollNumber)
            .ThenBy(s => s.StudentName)
            .Select(s => new {
                id = s.Id,
                rollNumber = s.SchoolRollNumber ?? s.RollNumber ?? s.CoachingRollNumber ?? "",
                studentName = s.StudentName,
                batchId = s.BatchId,
                batchName = s.Batch != null ? s.Batch.Name : "",
                classId = s.ClassId,
                className = s.Class != null ? s.Class.Name : "",
                sectionId = s.SectionId,
                sectionName = s.Section != null ? s.Section.Name : "",
                schoolRollNumber = s.SchoolRollNumber ?? "",
                admissionNumber = s.AdmissionNumber ?? "",
                isSchoolStudent = s.IsSchoolStudent,
                isCoachingStudent = s.IsCoachingStudent,
                joiningDate = s.JoiningDate
            })
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<StudentDto>>> GetStudents(
        [FromQuery] Guid? batchId,
        [FromQuery] Guid? classId = null,
        [FromQuery] Guid? branchId = null)
    {
        var query = _dbContext.Students.AsNoTracking()
            .Include(s => s.Batch)
            .Include(s => s.Class)
            .Include(s => s.Section)
            .AsQueryable();

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            query = query.Where(s => s.BranchId == branchId.Value || (s.Batch != null && s.Batch.BranchId == branchId.Value));
        }

        if (batchId.HasValue && batchId != Guid.Empty)
        {
            query = query.Where(s => s.BatchId == batchId);
        }
        else if (classId.HasValue && classId != Guid.Empty)
        {
            query = query.Where(s => s.ClassId == classId);
        }

        query = query.OrderByDescending(s => s.JoiningDate).ThenByDescending(s => s.RollNumber);

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
            s.BloodGroup,
            s.IsHostelStudent,
            s.HostelBedId,
            null,
            null,
            null,
            null,
            s.LeavingDate,
            s.LeavingReason,
            s.TCNumber,
            s.IsLibraryMember,
            s.LibraryCardNumber,
            s.LibraryMembershipType,
            s.MaxLibraryBooks,
            s.MonthlyLibraryFee,
            s.IsTransportStudent,
            s.TransportAllocationId,
            s.TransportAllocation != null && s.TransportAllocation.Route != null ? s.TransportAllocation.Route.RouteName : null,
            s.TransportAllocation != null && s.TransportAllocation.Stop != null ? s.TransportAllocation.Stop.StopName : null,
            s.TransportAllocation != null && s.TransportAllocation.Vehicle != null ? s.TransportAllocation.Vehicle.VehicleNumber : null,
            s.TransportAllocation != null && s.TransportAllocation.Stop != null ? s.TransportAllocation.Stop.MonthlyFare : 0,
            s.Section != null ? s.Section.ClassTeacherId : null,
            s.Section != null && s.Section.ClassTeacher != null ? s.Section.ClassTeacher.FullName : null,
            s.Section != null && s.Section.ClassTeacher != null ? s.Section.ClassTeacher.PhoneNumber : null,
            s.AadhaarNumber,
            s.PenNumber,
            s.ApaarId,
            s.Category,
            s.Religion,
            s.EmergencyContactName,
            s.EmergencyContactPhone,
            s.PreviousSchoolName,
            s.PreviousBoard
        )).ToListAsync();

        if (list.Count > 0)
        {
            var studentIds = list.Select(x => x.Id).ToList();
            var kitOutwards = await _dbContext.InventoryOutwards
                .AsNoTracking()
                .Where(o => o.TenantId == _currentUser.TenantId &&
                            o.StudentId.HasValue &&
                            studentIds.Contains(o.StudentId.Value))
                .Select(o => new { o.StudentId, o.PaymentStatus })
                .ToListAsync();

            var kitByStudent = kitOutwards
                .GroupBy(x => x.StudentId!.Value)
                .ToDictionary(g => g.Key, g => g.First().PaymentStatus);

            if (kitByStudent.Count > 0)
            {
                list = list.Select(it => kitByStudent.TryGetValue(it.Id, out var status)
                    ? it with { HasAdmissionKit = true, KitStatus = status }
                    : it
                ).ToList();
            }
        }

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

        // Build a short batch code from AcademicYear, e.g. "2026-2027" => "2027"
        var ayParts = batch.AcademicYear?.Split('-');
        var ayShort = ayParts != null && ayParts.Length >= 2
            ? ayParts[^1].Trim()
            : (batch.AcademicYear ?? DateTime.UtcNow.Year.ToString());

        // Anti-duplicate: find existing roll numbers in this batch to determine max sequence
        var existingRolls = await _dbContext.Students
            .AsNoTracking()
            .Where(s => s.BatchId == batchId)
            .Select(s => new { s.RollNumber, s.CoachingRollNumber })
            .ToListAsync();

        int maxSeq = 0;
        foreach (var item in existingRolls)
        {
            var rollStr = !string.IsNullOrWhiteSpace(item.CoachingRollNumber) ? item.CoachingRollNumber : item.RollNumber;
            if (!string.IsNullOrWhiteSpace(rollStr))
            {
                var dashIndex = rollStr.LastIndexOf('-');
                if (dashIndex >= 0 && dashIndex < rollStr.Length - 1)
                {
                    if (int.TryParse(rollStr.Substring(dashIndex + 1), out int parsedNum))
                    {
                        if (parsedNum > maxSeq) maxSeq = parsedNum;
                    }
                }
            }
        }

        int nextSeq = Math.Max(maxSeq + 1, existingRolls.Count + 1);
        var rollNumber = $"CH{ayShort}-{nextSeq:D3}";

        // Guarantee uniqueness across the whole tenant
        while (await _dbContext.Students.AsNoTracking().AnyAsync(s => s.RollNumber == rollNumber || s.CoachingRollNumber == rollNumber))
        {
            nextSeq++;
            rollNumber = $"CH{ayShort}-{nextSeq:D3}";
        }

        return Ok(new { rollNumber });
    }

    [HttpGet("next-admission-number")]
    public async Task<ActionResult<object>> GetNextAdmissionNumber()
    {
        var year = DateTime.UtcNow.Year;
        var count = await _dbContext.Students
            .AsNoTracking()
            .CountAsync(s => s.AdmissionNumber != null && s.AdmissionNumber.StartsWith($"ADM-{year}-"));
        var nextSeq = count + 1;
        var admissionNumber = $"ADM-{year}-{nextSeq:D4}";
        return Ok(new { admissionNumber });
    }

    [HttpGet("next-school-roll-number")]
    public async Task<ActionResult<object>> GetNextSchoolRollNumber([FromQuery] Guid classId)
    {
        if (classId == Guid.Empty)
            return BadRequest(new { message = "classId is required." });

        // Count all school students in this class (class-wide, not section-wise)
        // Class 7 → 1,2,3,4... | Class 8 → 1,2,3,4... (each class resets independently)
        var count = await _dbContext.Students.AsNoTracking()
            .CountAsync(s => s.ClassId == classId && s.IsSchoolStudent);

        return Ok(new { schoolRollNumber = (count + 1).ToString() });
    }

    [HttpGet("{id}/attendance")]
    public async Task<ActionResult<IEnumerable<StudentAttendanceDto>>> GetAttendance(
        Guid id, [FromQuery] int month = 0, [FromQuery] int year = 0, [FromQuery] string? stream = null)
    {
        if (month == 0) month = DateTime.UtcNow.Month;
        if (year == 0) year = DateTime.UtcNow.Year;

        var student = await _dbContext.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound(new { message = "Student not found." });

        var query = _dbContext.StudentAttendances.AsNoTracking()
            .Where(a => a.StudentId == id && a.AttendanceDate.Month == month && a.AttendanceDate.Year == year);

        if (string.Equals(stream, "coaching", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(a => a.CaptureSource == "ManualBulk" 
                                  || a.CaptureSource == "Coaching" 
                                  || a.CaptureSource == "CoachingManual" 
                                  || a.CaptureSource == "ManualCoaching"
                                  || a.CaptureSource == "Manual"
                                  || (student.IsCoachingStudent && a.CaptureSource != "ManualSchoolBulk"));
        }
        else if (string.Equals(stream, "school", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(a => a.CaptureSource == "ManualSchoolBulk" 
                                  || a.CaptureSource == "School" 
                                  || a.CaptureSource == "SchoolManual" 
                                  || a.CaptureSource == "ManualSchool"
                                  || (a.CaptureSource != "ManualBulk" && a.CaptureSource != "Coaching" && a.CaptureSource != "CoachingManual" && a.CaptureSource != "ManualCoaching"));
        }

        var records = await query.OrderBy(a => a.AttendanceDate).ToListAsync();
        var attSettings = await _dbContext.AttendanceSettings.AsNoTracking().FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);

        return Ok(records.Select(a => MapStudentAttendance(a, student, attSettings)));
    }

    private async Task<Student?> ResolveCurrentStudentAsync()
    {
        var userId = _currentUser.UserId;
        var tenantId = _currentUser.TenantId;

        var student = await _dbContext.Students.AsNoTracking()
            .FirstOrDefaultAsync(s => (s.UserId == userId || s.ParentUserId == userId) && s.TenantId == tenantId);

        if (student == null)
        {
            var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user != null)
            {
                student = await _dbContext.Students.AsNoTracking()
                    .FirstOrDefaultAsync(s => s.TenantId == tenantId && (
                        (!string.IsNullOrEmpty(user.PhoneNumber) && (s.ParentWhatsAppPhone == user.PhoneNumber || s.EmergencyContactPhone == user.PhoneNumber)) ||
                        (!string.IsNullOrEmpty(user.FullName) && s.StudentName == user.FullName)
                    ));

                if (student == null && !string.IsNullOrEmpty(user.Username) && user.Username.ToLower().StartsWith("student."))
                {
                    var candidateName = user.Username.Substring("student.".Length).Replace(".", " ");
                    student = await _dbContext.Students.AsNoTracking()
                        .FirstOrDefaultAsync(s => s.TenantId == tenantId && EF.Functions.Like(s.StudentName, $"%{candidateName}%"));
                }
            }
        }

        return student;
    }

    private static DateTime GetIstToday()
    {
        try
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById(OperatingSystem.IsWindows() ? "India Standard Time" : "Asia/Kolkata");
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz).Date;
        }
        catch
        {
            return DateTime.UtcNow.AddMinutes(330).Date;
        }
    }

    [HttpGet("attendance/ph-sun-edit-permission")]
    public async Task<ActionResult<object>> GetPublicHolidaySundayEditPermission()
    {
        return Ok(new { canEdit = await CanEditPublicHolidayOrSundayAsync() });
    }

    [HttpGet("attendance/report")]
    public async Task<ActionResult<AttendanceReportDto>> GetAttendanceReport(
        [FromQuery] int month = 0,
        [FromQuery] int year = 0,
        [FromQuery] Guid? batchId = null,
        [FromQuery] Guid? classId = null,
        [FromQuery] Guid? sectionId = null,
        [FromQuery] string? stream = null)
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

        var studentsQuery = _dbContext.Students.AsNoTracking()
            .Include(student => student.Batch)
            .Include(student => student.Class)
            .Include(student => student.Section)
            .Where(student => student.IsActive);

        var isStudentOrParent = string.Equals(_currentUser.UserRole, "Student", StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(_currentUser.UserRole, "Parent", StringComparison.OrdinalIgnoreCase);

        if (isStudentOrParent)
        {
            var currentStudent = await ResolveCurrentStudentAsync();
            if (currentStudent != null)
            {
                studentsQuery = studentsQuery.Where(student => student.Id == currentStudent.Id);
            }
            else
            {
                var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);
                if (user != null && !string.IsNullOrEmpty(user.FullName))
                {
                    studentsQuery = studentsQuery.Where(student => student.StudentName == user.FullName);
                }
            }
        }
        else
        {
            var user = await _dbContext.Users.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);
            bool canManage = user != null && (user.Role == IMSERP.Domain.Enums.UserRole.SuperAdmin || user.Role == IMSERP.Domain.Enums.UserRole.InstituteAdmin || user.Role == IMSERP.Domain.Enums.UserRole.HR);
            if (!canManage)
            {
                var teacher = await _dbContext.Teachers.AsNoTracking().FirstOrDefaultAsync(t =>
                    (t.UserId.HasValue && t.UserId.Value == _currentUser.UserId) ||
                    (user != null && !string.IsNullOrEmpty(user.Email) && t.Email == user.Email) ||
                    (user != null && !string.IsNullOrEmpty(user.FullName) && t.FullName == user.FullName));

                if (teacher != null)
                {
                    var ctSectionIds = await _dbContext.SchoolSections.AsNoTracking()
                        .Where(s => s.ClassTeacherId == teacher.Id && s.IsActive)
                        .Select(s => s.Id)
                        .ToListAsync();

                    var ctClassIds = await _dbContext.SchoolSections.AsNoTracking()
                        .Where(s => s.ClassTeacherId == teacher.Id && s.IsActive)
                        .Select(s => s.ClassId)
                        .ToListAsync();

                    var assignments = await _dbContext.TeacherBatchAssignments.AsNoTracking()
                        .Where(a => a.TeacherId == teacher.Id && a.IsActive)
                        .ToListAsync();

                    var assignedSectionIds = assignments.Where(a => a.SectionId.HasValue).Select(a => a.SectionId!.Value).ToHashSet();
                    foreach (var sId in ctSectionIds) assignedSectionIds.Add(sId);

                    var assignedClassIds = assignments.Where(a => a.ClassId.HasValue).Select(a => a.ClassId!.Value).ToHashSet();
                    foreach (var cId in ctClassIds) assignedClassIds.Add(cId);

                    var assignedBatchIds = assignments.Where(a => a.BatchId.HasValue).Select(a => a.BatchId!.Value).ToHashSet();

                    studentsQuery = studentsQuery.Where(student =>
                        (student.SectionId.HasValue && assignedSectionIds.Contains(student.SectionId.Value)) ||
                        (student.ClassId.HasValue && assignedClassIds.Contains(student.ClassId.Value)) ||
                        (student.BatchId.HasValue && assignedBatchIds.Contains(student.BatchId.Value))
                    );
                }
            }

            if (!string.IsNullOrWhiteSpace(stream))
            {
                if (stream.Equals("school", StringComparison.OrdinalIgnoreCase))
                    studentsQuery = studentsQuery.Where(student => student.IsSchoolStudent);
                else if (stream.Equals("coaching", StringComparison.OrdinalIgnoreCase))
                    studentsQuery = studentsQuery.Where(student => student.IsCoachingStudent);
            }

            if (batchId.HasValue && batchId.Value != Guid.Empty)
                studentsQuery = studentsQuery.Where(student => student.BatchId == batchId.Value);

            if (classId.HasValue && classId.Value != Guid.Empty)
                studentsQuery = studentsQuery.Where(student => student.ClassId == classId.Value);

            if (sectionId.HasValue && sectionId.Value != Guid.Empty)
                studentsQuery = studentsQuery.Where(student => student.SectionId == sectionId.Value);
        }

        var students = await studentsQuery.OrderBy(student => student.StudentName).ToListAsync();
        var studentIds = students.Select(student => student.Id).ToList();
        var records = await _dbContext.StudentAttendances.AsNoTracking()
            .Where(record => studentIds.Contains(record.StudentId) && record.AttendanceDate >= monthStart && record.AttendanceDate <= monthEnd)
            .ToListAsync();

        var totalWorkingDaysInMonth = Math.Max(0, DateTime.DaysInMonth(year, month) - offDates.Count);
        var attSettings = await _dbContext.AttendanceSettings.AsNoTracking().FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);

        bool isDual = false;
        string? defaultStream = null;
        if (isStudentOrParent && students.Count == 1)
        {
            var st = students[0];
            isDual = st.IsSchoolStudent && st.IsCoachingStudent;
            defaultStream = isDual ? "all" : (st.IsSchoolStudent ? "school" : (st.IsCoachingStudent ? "coaching" : null));
        }

        var rows = students.Select(student =>
        {
            var personRecords = records.Where(record => record.StudentId == student.Id).ToList();

            var targetRecords = personRecords;
            if (string.Equals(stream, "coaching", StringComparison.OrdinalIgnoreCase))
            {
                targetRecords = personRecords.Where(r => r.CaptureSource == "ManualBulk" 
                                                      || r.CaptureSource == "Coaching" 
                                                      || r.CaptureSource == "CoachingManual" 
                                                      || r.CaptureSource == "ManualCoaching"
                                                      || r.CaptureSource == "Manual"
                                                      || (student.IsCoachingStudent && r.CaptureSource != "ManualSchoolBulk")).ToList();
            }
            else if (string.Equals(stream, "school", StringComparison.OrdinalIgnoreCase))
            {
                targetRecords = personRecords.Where(r => r.CaptureSource == "ManualSchoolBulk" 
                                                      || r.CaptureSource == "School" 
                                                      || r.CaptureSource == "SchoolManual" 
                                                      || r.CaptureSource == "ManualSchool"
                                                      || (r.CaptureSource != "ManualBulk" && r.CaptureSource != "Coaching" && r.CaptureSource != "CoachingManual" && r.CaptureSource != "ManualCoaching")).ToList();
            }

            var today = GetIstToday();
            var pastUnmarkedWorkingDays = 0;
            var daysInMonth = DateTime.DaysInMonth(year, month);
            var elapsedWorkingDaysForStudent = 0;
            for (int day = 1; day <= daysInMonth; day++)
            {
                var curDate = new DateTime(year, month, day);
                if (student.JoiningDate != default && curDate < student.JoiningDate.Date) continue;

                if (!offDates.Contains(curDate.Date))
                {
                    if (curDate <= today)
                    {
                        elapsedWorkingDaysForStudent++;
                    }

                    if (curDate < today && !targetRecords.Any(r => r.AttendanceDate.Date == curDate.Date))
                    {
                        pastUnmarkedWorkingDays++;
                    }
                }
            }

            var evaluatedStatuses = targetRecords.Select(r => EvaluateStudentSmartAttendanceStatus(r.Status, r.CheckInTime, r.CheckOutTime, attSettings)).ToList();
            var present = evaluatedStatuses.Count(st => st == TeacherAttendanceStatus.Present);
            var recordedAbsent = evaluatedStatuses.Count(st => st == TeacherAttendanceStatus.Absent);
            var absent = recordedAbsent + pastUnmarkedWorkingDays;
            var late = evaluatedStatuses.Count(st => st == TeacherAttendanceStatus.Late);
            var half = evaluatedStatuses.Count(st => st == TeacherAttendanceStatus.HalfDay);
            var attendedWeighted = present + late + (half * 0.5m);

            bool isPastMonth = year < today.Year || (year == today.Year && month < today.Month);
            var denominator = elapsedWorkingDaysForStudent > 0 
                ? elapsedWorkingDaysForStudent 
                : (isPastMonth ? totalWorkingDaysInMonth : 0);

            var attendancePercentage = (denominator == 0 || attendedWeighted == 0)
                ? 0m
                : Math.Min(100m, Math.Round((attendedWeighted / (decimal)denominator) * 100m, 1));

            string schoolClass = student.Class != null
                ? $"{student.Class.Name}{(student.Section != null ? " - " + student.Section.Name : "")}"
                : "";
            string coachingBatch = student.Batch != null
                ? student.Batch.Name
                : "";

            string roll;
            string group;

            if (string.Equals(stream, "coaching", StringComparison.OrdinalIgnoreCase))
            {
                roll = !string.IsNullOrWhiteSpace(student.CoachingRollNumber)
                    ? student.CoachingRollNumber
                    : (!string.IsNullOrWhiteSpace(student.RollNumber) ? student.RollNumber : student.AdmissionNumber ?? "");
                group = !string.IsNullOrWhiteSpace(coachingBatch)
                    ? $"Batch: {coachingBatch}"
                    : (student.IsCoachingStudent ? "Coaching (No Batch)" : "");
            }
            else if (string.Equals(stream, "school", StringComparison.OrdinalIgnoreCase))
            {
                roll = !string.IsNullOrWhiteSpace(student.SchoolRollNumber)
                    ? student.SchoolRollNumber
                    : (!string.IsNullOrWhiteSpace(student.RollNumber) ? student.RollNumber : student.AdmissionNumber ?? "");
                group = !string.IsNullOrWhiteSpace(schoolClass)
                    ? schoolClass
                    : (student.IsSchoolStudent ? "School" : "");
            }
            else
            {
                if (student.IsSchoolStudent && student.IsCoachingStudent)
                {
                    roll = $"Sch: {student.SchoolRollNumber ?? student.RollNumber} | Coa: {student.CoachingRollNumber ?? "-"}";
                    group = !string.IsNullOrWhiteSpace(schoolClass) && !string.IsNullOrWhiteSpace(coachingBatch)
                        ? $"{schoolClass} • Batch: {coachingBatch}"
                        : (!string.IsNullOrWhiteSpace(schoolClass) ? schoolClass : coachingBatch);
                }
                else
                {
                    roll = !string.IsNullOrWhiteSpace(student.SchoolRollNumber)
                        ? student.SchoolRollNumber
                        : (!string.IsNullOrWhiteSpace(student.RollNumber) ? student.RollNumber : student.AdmissionNumber ?? "");

                    group = student.Batch?.Name
                        ?? (student.Class != null
                            ? $"{student.Class.Name}{(student.Section != null ? " - " + student.Section.Name : "")}"
                            : "");
                }
            }

            return new AttendanceReportRowDto(
                student.Id, 
                student.StudentName, 
                roll, 
                group, 
                present, 
                absent, 
                late, 
                half, 
                offDates.Count, 
                totalWorkingDaysInMonth, 
                attendancePercentage,
                null,
                schoolClass,
                coachingBatch,
                student.SchoolRollNumber,
                student.CoachingRollNumber,
                student.IsSchoolStudent,
                student.IsCoachingStudent,
                elapsedWorkingDaysForStudent,
                student.JoiningDate != default ? student.JoiningDate.ToString("yyyy-MM-dd") : null
            );
        }).ToList();

        var todayDate = GetIstToday();
        int monthElapsedWorkingDays = 0;
        for (var d = monthStart; d <= monthEnd; d = d.AddDays(1))
        {
            if (d.Date <= todayDate && !offDates.Contains(d.Date))
            {
                monthElapsedWorkingDays++;
            }
        }

        return Ok(new AttendanceReportDto(
            "Student", 
            month, 
            year, 
            rows.Count, 
            rows.Sum(row => row.PresentDays), 
            rows.Sum(row => row.AbsentDays), 
            rows.Sum(row => row.LateDays), 
            rows.Sum(row => row.HalfDays), 
            rows.Sum(row => row.HolidayDays), 
            rows,
            isDual,
            defaultStream,
            totalWorkingDaysInMonth,
            monthElapsedWorkingDays
        ));
    }

    [HttpGet("{id}/attendance/summary")]
    public async Task<ActionResult<StudentAttendanceSummaryDto>> GetAttendanceSummary(
        Guid id, [FromQuery] int month = 0, [FromQuery] int year = 0, [FromQuery] string? stream = null)
    {
        if (month == 0) month = DateTime.UtcNow.Month;
        if (year == 0) year = DateTime.UtcNow.Year;

        var student = await _dbContext.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound(new { message = "Student not found." });

        var monthStart = new DateTime(year, month, 1);
        var monthEnd = new DateTime(year, month, DateTime.DaysInMonth(year, month));
        var query = _dbContext.StudentAttendances.AsNoTracking()
            .Where(a => a.StudentId == id && a.AttendanceDate >= monthStart && a.AttendanceDate <= monthEnd);

        if (string.Equals(stream, "coaching", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(a => a.CaptureSource == "ManualBulk" 
                                  || a.CaptureSource == "Coaching" 
                                  || a.CaptureSource == "CoachingManual" 
                                  || a.CaptureSource == "ManualCoaching"
                                  || a.CaptureSource == "Manual"
                                  || (student.IsCoachingStudent && a.CaptureSource != "ManualSchoolBulk"));
        }
        else if (string.Equals(stream, "school", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(a => a.CaptureSource == "ManualSchoolBulk" 
                                  || a.CaptureSource == "School" 
                                  || a.CaptureSource == "SchoolManual" 
                                  || a.CaptureSource == "ManualSchool"
                                  || (a.CaptureSource != "ManualBulk" && a.CaptureSource != "Coaching" && a.CaptureSource != "CoachingManual" && a.CaptureSource != "ManualCoaching"));
        }

        var records = await query.ToListAsync();

        var attSettings = await _dbContext.AttendanceSettings.AsNoTracking().FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);
        var evaluatedStatuses = records.Select(a => EvaluateStudentSmartAttendanceStatus(a.Status, a.CheckInTime, a.CheckOutTime, attSettings)).ToList();

        int present = evaluatedStatuses.Count(s => s == TeacherAttendanceStatus.Present);
        int absent = evaluatedStatuses.Count(s => s == TeacherAttendanceStatus.Absent);
        int late = evaluatedStatuses.Count(s => s == TeacherAttendanceStatus.Late);
        int half = evaluatedStatuses.Count(s => s == TeacherAttendanceStatus.HalfDay);

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

        int totalWorkingDays = Math.Max(0, DateTime.DaysInMonth(year, month) - offDates.Count);

        var today = GetIstToday();
        int pastUnmarked = 0;
        int elapsedWorkingDays = 0;
        for (int d = 1; d <= DateTime.DaysInMonth(year, month); d++)
        {
            var curDate = new DateTime(year, month, d);
            if (student.JoiningDate != default && curDate < student.JoiningDate.Date) continue;

            if (!offDates.Contains(curDate.Date))
            {
                if (curDate <= today)
                {
                    elapsedWorkingDays++;
                }

                if (curDate < today)
                {
                    if (!records.Any(r => r.AttendanceDate.Date == curDate.Date))
                    {
                        pastUnmarked++;
                    }
                }
            }
        }
        absent += pastUnmarked;

        if (student.JoiningDate != default && student.JoiningDate.Year == year && student.JoiningDate.Month == month)
        {
            int workingDaysPriorToAdmission = 0;
            for (var d = monthStart; d < student.JoiningDate.Date; d = d.AddDays(1))
            {
                if (!offDates.Contains(d)) workingDaysPriorToAdmission++;
            }
            totalWorkingDays = Math.Max(0, totalWorkingDays - workingDaysPriorToAdmission);
        }
        else if (student.JoiningDate != default && monthStart < new DateTime(student.JoiningDate.Year, student.JoiningDate.Month, 1))
        {
            totalWorkingDays = 0;
            elapsedWorkingDays = 0;
        }

        var evaluatedDays = present + absent + late + half;
        decimal attendedWeighted = present + late + (half * 0.5m);
        bool isPastMonth = year < today.Year || (year == today.Year && month < today.Month);
        int denominator = elapsedWorkingDays > 0 ? elapsedWorkingDays : (isPastMonth ? totalWorkingDays : 0);
        decimal percentage = (denominator == 0 || attendedWeighted == 0)
            ? 0m
            : Math.Min(100m, Math.Round((attendedWeighted / (decimal)denominator) * 100m, 1));

        return Ok(new StudentAttendanceSummaryDto(
            present, absent, late, half, offDates.Count,
            totalWorkingDays, percentage, elapsedWorkingDays));
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

        var today = GetIstToday();
        var date = dto.AttendanceDate.Date;
        if (date > today)
            return BadRequest(new { message = "Cannot mark attendance for future dates." });

        if (student.JoiningDate != default && date < student.JoiningDate.Date)
            return BadRequest(new { message = $"Cannot mark attendance for {date:dd MMM yyyy}. Student admission date is {student.JoiningDate:dd MMM yyyy}. Attendance prior to admission date is not allowed." });

        if (date < today && !await HasAttendancePermissionAsync("/attendance/permissions/correction", true))
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

        var attSettings = await _dbContext.AttendanceSettings.AsNoTracking().FirstOrDefaultAsync(s => s.TenantId == student.TenantId);
        status = EvaluateStudentSmartAttendanceStatus(status, dto.CheckInTime, dto.CheckOutTime, attSettings);

        string targetSource = string.Equals(dto.Stream, "coaching", StringComparison.OrdinalIgnoreCase)
            ? "ManualBulk"
            : (string.Equals(dto.Stream, "school", StringComparison.OrdinalIgnoreCase)
                ? "ManualSchoolBulk"
                : (student.IsCoachingStudent && !student.IsSchoolStudent ? "ManualBulk" : "Manual"));

        record.Status = status;
        record.Remarks = dto.Remarks;
        record.CheckInTime = dto.CheckInTime;
        record.CheckOutTime = dto.CheckOutTime;
        record.MarkedBy = _currentUser.UserId.ToString();
        record.CaptureSource = targetSource;
        record.BiometricDeviceId = null;
        record.BiometricEventId = null;
        record.CapturedAt ??= DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        return Ok(MapStudentAttendance(record, student, attSettings));
    }

    [HttpPost("{id}/attendance/multi-dates")]
    public async Task<ActionResult> MarkMultiDatesAttendance(
        Guid id, [FromBody] BulkStudentMultiDatesAttendanceDto dto)
    {
        if (!await HasAttendancePermissionAsync("/attendance/permissions/manual", false))
            return Forbid();

        if (!await IsManualAttendanceAllowedAsync())
            return Conflict(new { message = "Manual student attendance is disabled. Current mode is Biometric." });

        var student = await _dbContext.Students.FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound(new { message = "Student not found." });
        if (!TryParseAttendanceStatus(dto.Status, out var status))
            return BadRequest(new { message = "Invalid attendance status." });

        if (dto.AttendanceDates == null || dto.AttendanceDates.Count == 0)
            return BadRequest(new { message = "No dates provided." });

        var today = GetIstToday();
        var canCorrect = await HasAttendancePermissionAsync("/attendance/permissions/correction", true);
        var canEditHoliday = await CanEditPublicHolidayOrSundayAsync();

        var validDates = new List<DateTime>();
        foreach (var rawDate in dto.AttendanceDates)
        {
            var date = rawDate.Date;
            if (date > today) continue; // skip future
            if (student.JoiningDate != default && date < student.JoiningDate.Date) continue; // skip prior to admission
            if (date < today && !canCorrect) continue; // skip past if no permission
            if (!canEditHoliday && await IsPublicHolidayOrSundayAsync(date)) continue; // skip holiday/sunday
            validDates.Add(date);
        }

        if (validDates.Count == 0)
            return BadRequest(new { message = "No valid dates eligible for marking attendance." });

        var existingRecords = await _dbContext.StudentAttendances
            .Where(a => a.StudentId == id && validDates.Contains(a.AttendanceDate))
            .ToListAsync();

        var existingMap = existingRecords.ToDictionary(a => a.AttendanceDate.Date);
        var attSettings = await _dbContext.AttendanceSettings.AsNoTracking().FirstOrDefaultAsync(s => s.TenantId == student.TenantId);

        string targetSource = string.Equals(dto.Stream, "coaching", StringComparison.OrdinalIgnoreCase)
            ? "ManualBulk"
            : (string.Equals(dto.Stream, "school", StringComparison.OrdinalIgnoreCase)
                ? "ManualSchoolBulk"
                : (student.IsCoachingStudent && !student.IsSchoolStudent ? "ManualBulk" : "Manual"));

        foreach (var date in validDates)
        {
            var effectiveStatus = EvaluateStudentSmartAttendanceStatus(status, dto.CheckInTime, dto.CheckOutTime, attSettings);

            if (existingMap.TryGetValue(date, out var record))
            {
                if (!canCorrect) continue; // cannot edit existing without correction permission
                record.Status = effectiveStatus;
                record.Remarks = dto.Remarks;
                record.CheckInTime = dto.CheckInTime;
                record.CheckOutTime = dto.CheckOutTime;
                record.MarkedBy = _currentUser.UserId.ToString();
                record.CaptureSource = targetSource;
                record.CapturedAt ??= DateTime.UtcNow;
            }
            else
            {
                var newRecord = new StudentAttendance
                {
                    TenantId = _currentUser.TenantId,
                    BranchId = student.BranchId ?? _currentUser.BranchId,
                    StudentId = id,
                    AttendanceDate = date,
                    Status = effectiveStatus,
                    Remarks = dto.Remarks,
                    CheckInTime = dto.CheckInTime,
                    CheckOutTime = dto.CheckOutTime,
                    MarkedBy = _currentUser.UserId.ToString(),
                    CaptureSource = targetSource,
                    CreatedAt = DateTime.UtcNow,
                    CapturedAt = DateTime.UtcNow
                };
                _dbContext.StudentAttendances.Add(newRecord);
            }
        }

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = $"Successfully marked attendance for {validDates.Count} date(s).", count = validDates.Count });
    }

    [HttpPost("{id}/attendance/monthly-register")]
    public async Task<ActionResult> SaveStudentMonthlyRegister(
        Guid id, [FromBody] SaveStudentMonthlyRegisterDto dto)
    {
        if (!await HasAttendancePermissionAsync("/attendance/permissions/manual", false))
            return Forbid();

        if (!await IsManualAttendanceAllowedAsync())
            return Conflict(new { message = "Manual student attendance is disabled. Current mode is Biometric Only." });

        var student = await _dbContext.Students.FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound(new { message = "Student not found." });

        if (dto.Days == null || dto.Days.Count == 0)
            return BadRequest(new { message = "No days provided in monthly register payload." });

        var monthStart = new DateTime(dto.Year, dto.Month, 1);
        var monthEnd = new DateTime(dto.Year, dto.Month, DateTime.DaysInMonth(dto.Year, dto.Month));
        var today = GetIstToday();

        // Fetch declared holidays for the month
        var holidays = await _dbContext.Holidays.AsNoTracking()
            .Where(h => h.IsActive && h.StartDate.Date <= monthEnd && h.EndDate.Date >= monthStart)
            .ToListAsync();

        var holidayDates = new HashSet<DateTime>();
        foreach (var h in holidays)
        {
            var cur = h.StartDate.Date < monthStart ? monthStart : h.StartDate.Date;
            var end = h.EndDate.Date > monthEnd ? monthEnd : h.EndDate.Date;
            for (var dt = cur; dt <= end; dt = dt.AddDays(1)) holidayDates.Add(dt);
        }

        // Fetch student approved leaves
        var approvedLeaves = await _dbContext.StudentLeaves.AsNoTracking()
            .Where(l => l.StudentId == id && l.Status == "Approved" &&
                        l.FromDate.Date <= monthEnd && l.ToDate.Date >= monthStart)
            .ToListAsync();

        var leaveDates = new HashSet<DateTime>();
        foreach (var l in approvedLeaves)
        {
            for (var dt = l.FromDate.Date; dt <= l.ToDate.Date; dt = dt.AddDays(1))
            {
                leaveDates.Add(dt);
            }
        }

        var existingRecords = await _dbContext.StudentAttendances
            .Where(a => a.StudentId == id && a.AttendanceDate >= monthStart && a.AttendanceDate <= monthEnd)
            .ToListAsync();

        var existingMap = existingRecords.ToDictionary(a => a.AttendanceDate.Date);

        var markedBy = _currentUser.UserId.ToString();
        var attSettings = await _dbContext.AttendanceSettings.AsNoTracking().FirstOrDefaultAsync(s => s.TenantId == student.TenantId);
        int presentSaved = 0, absentSaved = 0;

        string targetSource = string.Equals(dto.Stream, "coaching", StringComparison.OrdinalIgnoreCase)
            ? "ManualBulk"
            : (string.Equals(dto.Stream, "school", StringComparison.OrdinalIgnoreCase)
                ? "ManualSchoolBulk"
                : (student.IsCoachingStudent && !student.IsSchoolStudent ? "ManualBulk" : "Manual"));

        foreach (var day in dto.Days)
        {
            var date = day.Date.Date;
            if (date.Month != dto.Month || date.Year != dto.Year) continue;

            // Never mark future dates
            if (date > today) continue;

            // Never mark before student admission / joining date
            if (student.JoiningDate != default && date < student.JoiningDate.Date) continue;

            // Sunday or declared holiday: skip
            if (date.DayOfWeek == DayOfWeek.Sunday || holidayDates.Contains(date)) continue;

            // Sanctioned approved leave: skip
            if (leaveDates.Contains(date)) continue;

            var status = day.IsPresent ? TeacherAttendanceStatus.Present : TeacherAttendanceStatus.Absent;
            string? inTime = day.IsPresent ? (day.CheckInTime ?? dto.DefaultCheckInTime ?? attSettings?.StudentShiftStartTime ?? "08:00") : null;
            string? outTime = day.IsPresent ? (day.CheckOutTime ?? dto.DefaultCheckOutTime ?? attSettings?.StudentShiftEndTime ?? "14:00") : null;
            string? remarks = day.Remarks ?? (day.IsPresent ? "Manual Monthly Register (Present)" : "Manual Monthly Register (Absent)");

            if (day.IsPresent)
            {
                status = EvaluateStudentSmartAttendanceStatus(status, inTime, outTime, attSettings);
            }

            if (existingMap.TryGetValue(date, out var existing))
            {
                // If it originated from LeaveApplication, do not overwrite
                if (existing.CaptureSource == "LeaveApplication" || existing.Status == TeacherAttendanceStatus.Leave)
                    continue;

                existing.Status = status;
                existing.CheckInTime = inTime;
                existing.CheckOutTime = outTime;
                existing.Remarks = remarks;
                existing.CaptureSource = targetSource;
                existing.MarkedBy = markedBy;
                existing.CapturedAt ??= DateTime.UtcNow;
            }
            else
            {
                var newRecord = new StudentAttendance
                {
                    TenantId = _currentUser.TenantId,
                    BranchId = student.BranchId ?? _currentUser.BranchId,
                    StudentId = id,
                    AttendanceDate = date,
                    Status = status,
                    CheckInTime = inTime,
                    CheckOutTime = outTime,
                    Remarks = remarks,
                    CaptureSource = targetSource,
                    MarkedBy = markedBy,
                    CreatedAt = DateTime.UtcNow,
                    CapturedAt = DateTime.UtcNow
                };
                _dbContext.StudentAttendances.Add(newRecord);
            }

            if (day.IsPresent) presentSaved++;
            else absentSaved++;
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = $"Monthly attendance register saved for {student.StudentName}: {presentSaved} Present, {absentSaved} Absent.",
            presentSaved,
            absentSaved
        });
    }

    [HttpGet("batch/{batchId}/attendance")]
    public async Task<ActionResult<IEnumerable<BatchAttendanceStudentRowDto>>> GetBatchAttendance(
        Guid batchId, [FromQuery] DateTime? date = null)
    {
        var targetDate = (date ?? GetIstToday()).Date;
        var tenantId = _currentUser.TenantId;

        var students = await _dbContext.Students
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.BatchId == batchId && s.IsActive 
                     && (s.JoiningDate == default || s.JoiningDate.Date <= targetDate))
            .OrderBy(s => s.RollNumber)
            .ThenBy(s => s.StudentName)
            .Select(s => new {
                s.Id,
                s.StudentName,
                s.RollNumber,
                s.ProfilePhoto,
                s.ParentWhatsAppPhone
            })
            .ToListAsync();

        var studentIds = students.Select(s => s.Id).ToList();

        var existingRecords = studentIds.Count > 0
            ? await _dbContext.StudentAttendances
                .AsNoTracking()
                .Where(a => a.TenantId == tenantId && studentIds.Contains(a.StudentId) && a.AttendanceDate == targetDate)
                .ToDictionaryAsync(a => a.StudentId)
            : new Dictionary<Guid, StudentAttendance>();

        var attSettings = await _dbContext.AttendanceSettings.AsNoTracking().FirstOrDefaultAsync(s => s.TenantId == tenantId);

        var result = students.Select(s =>
        {
            existingRecords.TryGetValue(s.Id, out var att);
            DateTime? captured = att?.CapturedAt ?? att?.CreatedAt;
            DateTime? capturedUtc = captured.HasValue ? DateTime.SpecifyKind(captured.Value, DateTimeKind.Utc) : null;
            var effStatus = att != null ? EvaluateStudentSmartAttendanceStatus(att.Status, att.CheckInTime, att.CheckOutTime, attSettings).ToString() : "Present";
            return new BatchAttendanceStudentRowDto(
                s.Id,
                s.StudentName,
                s.RollNumber,
                s.ProfilePhoto,
                s.ParentWhatsAppPhone,
                effStatus,
                att?.Remarks,
                att?.Id,
                capturedUtc,
                att?.CaptureSource,
                att?.CheckInTime,
                att?.CheckOutTime
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

        var today = GetIstToday();
        var date = dto.AttendanceDate.Date;
        if (date > today)
            return BadRequest(new { message = "Cannot mark attendance for future dates." });

        if (date < today && !await HasAttendancePermissionAsync("/attendance/permissions/correction", true))
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

        var attSettings = await _dbContext.AttendanceSettings.AsNoTracking().FirstOrDefaultAsync(s => s.TenantId == tenantId);

        int presentCount = 0;
        int absentCount = 0;
        int lateCount = 0;
        int halfDayCount = 0;

        foreach (var item in dto.Items)
        {
            if (!students.TryGetValue(item.StudentId, out var student)) continue;
            if (student.JoiningDate != default && date < student.JoiningDate.Date) continue; // skip prior to admission
            if (!TryParseAttendanceStatus(item.Status, out var status)) continue;

            status = EvaluateStudentSmartAttendanceStatus(status, item.CheckInTime, item.CheckOutTime, attSettings);

            if (status == TeacherAttendanceStatus.Present) presentCount++;
            else if (status == TeacherAttendanceStatus.Absent) absentCount++;
            else if (status == TeacherAttendanceStatus.Late) lateCount++;
            else if (status == TeacherAttendanceStatus.HalfDay) halfDayCount++;

            if (existingRecords.TryGetValue(item.StudentId, out var existing))
            {
                existing.Status = status;
                existing.Remarks = item.Remarks;
                existing.CheckInTime = item.CheckInTime;
                existing.CheckOutTime = item.CheckOutTime;
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
                    CheckInTime = item.CheckInTime,
                    CheckOutTime = item.CheckOutTime,
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

    [HttpGet("school/attendance")]
    public async Task<ActionResult<IEnumerable<SchoolAttendanceStudentRowDto>>> GetSchoolAttendance(
        [FromQuery] Guid classId, [FromQuery] Guid? sectionId = null, [FromQuery] DateTime? date = null)
    {
        var targetDate = (date ?? GetIstToday()).Date;
        var tenantId = _currentUser.TenantId;

        var query = _dbContext.Students
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.ClassId == classId && s.IsActive && s.IsSchoolStudent
                     && (s.JoiningDate == default || s.JoiningDate.Date <= targetDate));

        if (sectionId.HasValue && sectionId != Guid.Empty)
        {
            query = query.Where(s => s.SectionId == sectionId.Value);
        }

        var students = await query
            .OrderBy(s => s.SchoolRollNumber)
            .ThenBy(s => s.StudentName)
            .Select(s => new {
                s.Id,
                s.StudentName,
                s.SchoolRollNumber,
                s.AdmissionNumber,
                ClassName = s.Class != null ? s.Class.Name : null,
                SectionName = s.Section != null ? s.Section.Name : null,
                s.ProfilePhoto,
                s.ParentWhatsAppPhone
            })
            .ToListAsync();

        var studentIds = students.Select(s => s.Id).ToList();

        var existingRecords = studentIds.Count > 0
            ? await _dbContext.StudentAttendances
                .AsNoTracking()
                .Where(a => a.TenantId == tenantId && studentIds.Contains(a.StudentId) && a.AttendanceDate == targetDate)
                .ToDictionaryAsync(a => a.StudentId)
            : new Dictionary<Guid, StudentAttendance>();

        var attSettings = await _dbContext.AttendanceSettings.AsNoTracking().FirstOrDefaultAsync(s => s.TenantId == tenantId);

        var result = students.Select(s =>
        {
            existingRecords.TryGetValue(s.Id, out var att);
            DateTime? captured = att?.CapturedAt ?? att?.CreatedAt;
            DateTime? capturedUtc = captured.HasValue ? DateTime.SpecifyKind(captured.Value, DateTimeKind.Utc) : null;
            var effStatus = att != null ? EvaluateStudentSmartAttendanceStatus(att.Status, att.CheckInTime, att.CheckOutTime, attSettings).ToString() : "Present";
            return new SchoolAttendanceStudentRowDto(
                s.Id,
                s.StudentName,
                s.SchoolRollNumber,
                s.AdmissionNumber,
                s.ClassName,
                s.SectionName,
                s.ProfilePhoto,
                s.ParentWhatsAppPhone,
                effStatus,
                att?.Remarks,
                att?.Id,
                capturedUtc,
                att?.CaptureSource,
                att?.CheckInTime,
                att?.CheckOutTime
            );
        }).ToList();

        return Ok(result);
    }

    [HttpPost("school/attendance/bulk")]
    public async Task<IActionResult> SaveBulkSchoolAttendance([FromBody] BulkSchoolAttendanceDto dto)
    {
        if (!await HasAttendancePermissionAsync("/attendance/permissions/manual", false))
            return Forbid();

        if (!await IsManualAttendanceAllowedAsync())
            return Conflict(new { message = "Manual student attendance is disabled. Current mode is Biometric." });

        var today = GetIstToday();
        var date = dto.AttendanceDate.Date;
        if (date > today)
            return BadRequest(new { message = "Cannot mark attendance for future dates." });

        if (date < today && !await HasAttendancePermissionAsync("/attendance/permissions/correction", true))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Marking or modifying past attendance requires Admin Attendance Correction permission." });

        if (!await CanEditPublicHolidayOrSundayAsync() && await IsPublicHolidayOrSundayAsync(date))
            return Forbid();

        var tenantId = _currentUser.TenantId;
        var schoolClass = await _dbContext.SchoolClasses.Include(c => c.Branch).FirstOrDefaultAsync(c => c.Id == dto.ClassId && c.TenantId == tenantId);
        if (schoolClass == null) return NotFound(new { message = "School class not found." });

        var studentIds = dto.Items.Select(i => i.StudentId).ToList();
        var students = await _dbContext.Students
            .Where(s => s.TenantId == tenantId && studentIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id);

        var existingRecords = await _dbContext.StudentAttendances
            .Where(a => a.TenantId == tenantId && studentIds.Contains(a.StudentId) && a.AttendanceDate == date)
            .ToDictionaryAsync(a => a.StudentId);

        var attSettings = await _dbContext.AttendanceSettings.AsNoTracking().FirstOrDefaultAsync(s => s.TenantId == tenantId);

        int presentCount = 0;
        int absentCount = 0;
        int lateCount = 0;
        int halfDayCount = 0;

        foreach (var item in dto.Items)
        {
            if (!students.TryGetValue(item.StudentId, out var student)) continue;
            if (student.JoiningDate != default && date < student.JoiningDate.Date) continue; // skip prior to admission
            if (!TryParseAttendanceStatus(item.Status, out var status)) continue;

            status = EvaluateStudentSmartAttendanceStatus(status, item.CheckInTime, item.CheckOutTime, attSettings);

            if (status == TeacherAttendanceStatus.Present) presentCount++;
            else if (status == TeacherAttendanceStatus.Absent) absentCount++;
            else if (status == TeacherAttendanceStatus.Late) lateCount++;
            else if (status == TeacherAttendanceStatus.HalfDay) halfDayCount++;

            if (existingRecords.TryGetValue(item.StudentId, out var existing))
            {
                existing.Status = status;
                existing.Remarks = item.Remarks;
                existing.CheckInTime = item.CheckInTime;
                existing.CheckOutTime = item.CheckOutTime;
                existing.MarkedBy = _currentUser.UserId.ToString();
                existing.BranchId = student.BranchId ?? schoolClass.BranchId ?? _currentUser.BranchId;
                existing.CaptureSource = "ManualSchoolBulk";
                existing.CapturedAt = DateTime.UtcNow;
            }
            else
            {
                var newRecord = new StudentAttendance
                {
                    TenantId = tenantId,
                    BranchId = student.BranchId ?? schoolClass.BranchId ?? _currentUser.BranchId,
                    StudentId = student.Id,
                    AttendanceDate = date,
                    Status = status,
                    Remarks = item.Remarks,
                    CheckInTime = item.CheckInTime,
                    CheckOutTime = item.CheckOutTime,
                    MarkedBy = _currentUser.UserId.ToString(),
                    CaptureSource = "ManualSchoolBulk",
                    CapturedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };
                _dbContext.StudentAttendances.Add(newRecord);
            }
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = $"School attendance saved successfully for {dto.Items.Count} students.",
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

    /// <summary>
    /// Creates or updates the sibling linkage chosen in the admission / edit form.
    /// Discount is stored on the link where StudentId = this student, so the invoice engine
    /// applies it to this student's School + Coaching academic fees.
    /// </summary>
    private async Task UpsertSiblingLinkFromFormAsync(Student student, CreateStudentDto dto)
    {
        if (!dto.LinkedSiblingStudentId.HasValue || dto.LinkedSiblingStudentId.Value == Guid.Empty) return;
        if (dto.LinkedSiblingStudentId.Value == student.Id) return;

        var siblingExists = await _dbContext.Students.AsNoTracking()
            .AnyAsync(s => s.Id == dto.LinkedSiblingStudentId.Value && s.TenantId == _currentUser.TenantId);
        if (!siblingExists) return;

        var discount = Math.Clamp(dto.SiblingDiscountPercent ?? 0m, 0m, 100m);
        var relationship = string.IsNullOrWhiteSpace(dto.SiblingRelationship) ? null : dto.SiblingRelationship.Trim();
        var notes = string.IsNullOrWhiteSpace(dto.SiblingDiscountNotes) ? null : dto.SiblingDiscountNotes.Trim();

        var existingLink = await _dbContext.StudentSiblings.FirstOrDefaultAsync(l =>
            (l.StudentId == student.Id && l.SiblingStudentId == dto.LinkedSiblingStudentId.Value) ||
            (l.StudentId == dto.LinkedSiblingStudentId.Value && l.SiblingStudentId == student.Id));

        if (existingLink != null)
        {
            // Keep the discount on this student's side of the link
            if (existingLink.StudentId != student.Id)
            {
                existingLink.SiblingStudentId = existingLink.StudentId;
                existingLink.StudentId = student.Id;
            }
            existingLink.DiscountPercent = discount;
            if (relationship != null) existingLink.Relationship = relationship;
            if (notes != null) existingLink.Notes = notes;
            existingLink.BranchId ??= student.BranchId;
            return;
        }

        var link = new StudentSibling
        {
            Id = Guid.NewGuid(),
            TenantId = _currentUser.TenantId,
            BranchId = student.BranchId ?? _currentUser.BranchId,
            StudentId = student.Id,
            SiblingStudentId = dto.LinkedSiblingStudentId.Value,
            DiscountPercent = discount,
            Notes = notes,
            CreatedAt = DateTime.UtcNow
        };
        if (relationship != null) link.Relationship = relationship;
        _dbContext.StudentSiblings.Add(link);
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
                s.Id,
                s.StudentName,
                s.ParentName,
                s.MotherName,
                s.Address,
                s.Gender,
                s.IsSchoolStudent,
                s.IsCoachingStudent,
                ClassName = s.Class != null ? s.Class.Name : null,
                SectionName = s.Section != null ? s.Section.Name : null,
                BatchName = s.Batch != null ? s.Batch.Name : "",
                BranchName = s.Branch != null ? s.Branch.Name : (s.Batch != null && s.Batch.Branch != null ? s.Batch.Branch.Name : "")
            })
            .FirstOrDefaultAsync();

        if (existing != null)
        {
            var isSameStudent = !string.IsNullOrWhiteSpace(currentStudentName)
                && string.Equals(existing.StudentName.Trim(), currentStudentName.Trim(), StringComparison.OrdinalIgnoreCase);

            // Family discount already configured for this sibling group (tenant data, not hardcoded)
            var familyDiscount = await _dbContext.StudentSiblings.AsNoTracking()
                .Where(l => l.TenantId == tenantId && (l.StudentId == existing.Id || l.SiblingStudentId == existing.Id))
                .Select(l => (decimal?)l.DiscountPercent)
                .MaxAsync() ?? 0m;

            // Already linked with the student being edited? Return that link's own saved values.
            var existingLink = (excludeStudentId.HasValue && excludeStudentId != Guid.Empty)
                ? await _dbContext.StudentSiblings.AsNoTracking()
                    .Where(l => (l.StudentId == excludeStudentId.Value && l.SiblingStudentId == existing.Id) ||
                                (l.StudentId == existing.Id && l.SiblingStudentId == excludeStudentId.Value))
                    .Select(l => new { l.DiscountPercent, l.Relationship, l.Notes })
                    .FirstOrDefaultAsync()
                : null;
            var alreadyLinked = existingLink != null;

            return Ok(new
            {
                isFound = true,
                isDuplicate = isSameStudent,
                isSibling = !isSameStudent,
                studentId = existing.Id,
                studentName = existing.StudentName,
                parentName = existing.ParentName,
                motherName = existing.MotherName,
                address = existing.Address,
                gender = existing.Gender,
                isSchoolStudent = existing.IsSchoolStudent,
                isCoachingStudent = existing.IsCoachingStudent,
                className = existing.ClassName,
                sectionName = existing.SectionName,
                batchName = existing.BatchName,
                branchName = existing.BranchName,
                existingFamilyDiscountPercent = familyDiscount,
                isAlreadyLinked = alreadyLinked,
                linkedDiscountPercent = existingLink?.DiscountPercent,
                linkedRelationship = existingLink?.Relationship,
                linkedNotes = existingLink?.Notes
            });
        }

        return Ok(new
        {
            isFound = false,
            isDuplicate = false,
            isSibling = false,
            studentId = (Guid?)null,
            studentName = (string?)null,
            parentName = (string?)null,
            motherName = (string?)null,
            address = (string?)null,
            gender = (string?)null,
            isSchoolStudent = false,
            isCoachingStudent = false,
            className = (string?)null,
            sectionName = (string?)null,
            batchName = (string?)null,
            branchName = (string?)null,
            existingFamilyDiscountPercent = 0m,
            isAlreadyLinked = false
        });
    }

    [HttpGet("paged")]
    public async Task<ActionResult<PagedResult<StudentDto>>> GetStudentsPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? sortBy = "joiningDate",
        [FromQuery] bool sortDescending = true,
        [FromQuery] Guid? batchId = null,
        [FromQuery] Guid? classId = null,
        [FromQuery] Guid? sectionId = null,
        [FromQuery] string? stream = null, // "school", "coaching", or null for all
        [FromQuery] string? status = null) // "active", "left" / "inactive", or null / "all"
    {
        IQueryable<Student> query;
        if (!string.IsNullOrWhiteSpace(status) && (status.Equals("left", StringComparison.OrdinalIgnoreCase) || status.Equals("inactive", StringComparison.OrdinalIgnoreCase) || status.Equals("all", StringComparison.OrdinalIgnoreCase)))
        {
            query = _dbContext.Students.IgnoreQueryFilters().AsNoTracking()
                .Where(s => s.TenantId == _currentUser.TenantId && (_currentUser.BranchId == null || s.BranchId == null || s.BranchId == _currentUser.BranchId));
            if (!status.Equals("all", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(s => !s.IsActive || s.IsDeleted);
            }
        }
        else
        {
            query = _dbContext.Students.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(status) && status.Equals("active", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(s => s.IsActive && !s.IsDeleted);
            }
        }

        query = query
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
            else if (stream.Equals("library", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(s => s.IsLibraryMember);
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
                                     (s.CoachingRollNumber != null && s.CoachingRollNumber.ToLower().Contains(term)) ||
                                     (s.TCNumber != null && s.TCNumber.ToLower().Contains(term)) ||
                                     (s.LibraryCardNumber != null && s.LibraryCardNumber.ToLower().Contains(term)));
        }

        query = (sortBy?.ToLower()) switch
        {
            "name" or "studentname" => sortDescending ? query.OrderByDescending(s => s.StudentName) : query.OrderBy(s => s.StudentName),
            "parentname" => sortDescending ? query.OrderByDescending(s => s.ParentName) : query.OrderBy(s => s.ParentName),
            "joiningdate" => sortDescending ? query.OrderByDescending(s => s.JoiningDate) : query.OrderBy(s => s.JoiningDate),
            "rollnumber" => sortDescending ? query.OrderBy(s => s.RollNumber) : query.OrderByDescending(s => s.JoiningDate).ThenByDescending(s => s.RollNumber),
            _ => query.OrderByDescending(s => s.JoiningDate).ThenByDescending(s => s.RollNumber)
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
                s.HostelBed != null ? s.HostelBed.BedCode : null,
                s.HostelBed != null && s.HostelBed.Room != null ? (Guid?)s.HostelBed.Room.HostelId : null,
                s.LeavingDate,
                s.LeavingReason,
                s.TCNumber,
                s.IsLibraryMember,
                s.LibraryCardNumber,
                s.LibraryMembershipType,
                s.MaxLibraryBooks,
                s.MonthlyLibraryFee,
                s.IsTransportStudent,
                s.TransportAllocationId,
                s.TransportAllocation != null && s.TransportAllocation.Route != null ? s.TransportAllocation.Route.RouteName : null,
                s.TransportAllocation != null && s.TransportAllocation.Stop != null ? s.TransportAllocation.Stop.StopName : null,
                s.TransportAllocation != null && s.TransportAllocation.Vehicle != null ? s.TransportAllocation.Vehicle.VehicleNumber : null,
                s.TransportAllocation != null && s.TransportAllocation.Stop != null ? s.TransportAllocation.Stop.MonthlyFare : 0,
                s.Section != null ? s.Section.ClassTeacherId : null,
                s.Section != null && s.Section.ClassTeacher != null ? s.Section.ClassTeacher.FullName : null,
                s.Section != null && s.Section.ClassTeacher != null ? s.Section.ClassTeacher.PhoneNumber : null,
                s.AadhaarNumber,
                s.PenNumber,
                s.ApaarId,
                s.Category,
                s.Religion,
                s.EmergencyContactName,
                s.EmergencyContactPhone,
                s.PreviousSchoolName,
                s.PreviousBoard
            )).ToListAsync();

        if (items.Count > 0)
        {
            var pagedStudentIds = items.Select(x => x.Id).ToList();
            var kitOutwards = await _dbContext.InventoryOutwards
                .AsNoTracking()
                .Where(o => o.TenantId == _currentUser.TenantId &&
                            o.StudentId.HasValue &&
                            pagedStudentIds.Contains(o.StudentId.Value))
                .Select(o => new { o.StudentId, o.PaymentStatus })
                .ToListAsync();

            var kitByStudent = kitOutwards
                .GroupBy(x => x.StudentId!.Value)
                .ToDictionary(g => g.Key, g => g.First().PaymentStatus);

            if (kitByStudent.Count > 0)
            {
                items = items.Select(it => kitByStudent.TryGetValue(it.Id, out var status)
                    ? it with { HasAdmissionKit = true, KitStatus = status }
                    : it
                ).ToList();
            }
        }

        return Ok(new PagedResult<StudentDto>(items, totalCount, pageNumber, pageSize));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteStudent(Guid id)
    {
        var student = await _dbContext.Students
            .IgnoreQueryFilters()
            .Include(s => s.TransportAllocation)
            .Include(s => s.HostelBed)
            .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == _currentUser.TenantId);

        if (student == null) return NotFound();

        // 1. Free the hostel bed: clear CurrentStudentId and reset Status to Available
        if (student.HostelBedId.HasValue)
        {
            var bed = await _dbContext.HostelBeds.FindAsync(student.HostelBedId.Value);
            if (bed != null)
            {
                bed.CurrentStudentId = null;
                bed.Status = "Available";
            }
            student.HostelBedId = null;
            student.IsHostelStudent = false;
        }

        var linkedBeds = await _dbContext.HostelBeds
            .IgnoreQueryFilters()
            .Where(b => b.CurrentStudentId == id)
            .ToListAsync();
        foreach (var b in linkedBeds)
        {
            b.CurrentStudentId = null;
            b.Status = "Available";
        }

        // 2. Free Transport Allocation: set Status = "Discontinued" and unassign student
        if (student.TransportAllocationId.HasValue)
        {
            var alloc = await _dbContext.TransportAllocations.FindAsync(student.TransportAllocationId.Value);
            if (alloc != null)
            {
                alloc.Status = "Discontinued";
                alloc.EffectiveTo = DateTime.UtcNow;
            }
            student.TransportAllocationId = null;
            student.IsTransportStudent = false;
        }

        var linkedAllocations = await _dbContext.TransportAllocations
            .IgnoreQueryFilters()
            .Where(a => a.StudentId == id && a.Status == "Active")
            .ToListAsync();
        foreach (var a in linkedAllocations)
        {
            a.Status = "Discontinued";
            a.EffectiveTo = DateTime.UtcNow;
        }

        // 3. Deactivate User Login if student had a portal/app login account
        if (student.UserId.HasValue)
        {
            var user = await _dbContext.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == student.UserId.Value);
            if (user != null)
            {
                user.IsActive = false;
            }
        }

        // 4. Mark student as Soft-Deleted (Preserves FeeInvoices, FeePayments, Attendances, TestMarks, Outward Kit History for Audit)
        student.IsDeleted = true;
        student.IsActive = false;
        student.DeletedAt = DateTime.UtcNow;
        student.DeletedBy = _currentUser.UserId;
        student.LeavingDate = DateTime.UtcNow;
        if (string.IsNullOrWhiteSpace(student.LeavingReason))
        {
            student.LeavingReason = "Admission Cancelled / Deleted";
        }

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
                CoachingRollNumber = dto.IsCoachingStudent ? (!string.IsNullOrWhiteSpace(dto.CoachingRollNumber) ? dto.CoachingRollNumber : dto.RollNumber) : null,
                AdmissionNumber = dto.AdmissionNumber,
                IsSchoolStudent = dto.IsSchoolStudent,
                IsCoachingStudent = dto.IsCoachingStudent,
                IsHostelStudent = dto.IsHostelStudent,
                HostelBedId = dto.IsHostelStudent ? dto.HostelBedId : null,
                IsLibraryMember = dto.IsLibraryMember,
                LibraryCardNumber = dto.IsLibraryMember ? dto.LibraryCardNumber : null,
                LibraryMembershipType = dto.IsLibraryMember ? dto.LibraryMembershipType : null,
                MaxLibraryBooks = dto.IsLibraryMember && dto.MaxLibraryBooks > 0 ? dto.MaxLibraryBooks : 2,
                MonthlyLibraryFee = dto.IsLibraryMember ? dto.MonthlyLibraryFee : 0,
                StudentName = dto.StudentName,
                ParentName = dto.ParentName,
                ParentWhatsAppPhone = NormalizePhoneWithPrefix(dto.ParentWhatsAppPhone),
                MotherName = dto.MotherName,
                Gender = dto.Gender,
                DateOfBirth = dto.DateOfBirth,
                BloodGroup = dto.BloodGroup,
                Address = dto.Address,
                AadhaarNumber = dto.AadhaarNumber,
                PenNumber = dto.PenNumber,
                ApaarId = dto.ApaarId,
                Category = dto.Category,
                Religion = dto.Religion,
                EmergencyContactName = dto.EmergencyContactName,
                EmergencyContactPhone = dto.EmergencyContactPhone,
                PreviousSchoolName = dto.PreviousSchoolName,
                PreviousBoard = dto.PreviousBoard,
                JoiningDate = dto.JoiningDate ?? DateTime.UtcNow,
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

            // ── Inventory Kit Issuance on Admission ──
            if (dto.IsIssueAdmissionKit && dto.AdmissionKitItems != null && dto.AdmissionKitItems.Any(i => i.Quantity > 0))
            {
                var issueNumber = $"OUT-{DateTime.UtcNow:yyyyMMddHHmmss}-{new Random().Next(100, 999)}";
                var outward = new InventoryOutward
                {
                    Id = Guid.NewGuid(),
                    TenantId = _currentUser.TenantId,
                    BranchId = targetBranchId,
                    IssueNumber = issueNumber,
                    IssueDate = DateTime.UtcNow,
                    IssueType = "StudentKitSale",
                    StudentId = student.Id,
                    IssuedToName = student.StudentName,
                    DepartmentOrClass = dto.ClassId.HasValue ? (await _dbContext.SchoolClasses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == dto.ClassId.Value))?.Name : (batch?.Name ?? "Admission"),
                    PaymentStatus = !string.IsNullOrWhiteSpace(dto.KitPaymentStatus) ? dto.KitPaymentStatus : "Paid",
                    PaymentMode = dto.KitPaymentMode ?? "Cash",
                    Remarks = $"Issued automatically during student admission ({student.AdmissionNumber ?? student.RollNumber})",
                    CreatedBy = _currentUser.UserId,
                    CreatedAt = DateTime.UtcNow
                };

                decimal totalKitAmount = 0;
                foreach (var kitRow in dto.AdmissionKitItems)
                {
                    if (kitRow.Quantity <= 0) continue;
                    var invItem = await _dbContext.InventoryItems.FindAsync(kitRow.ItemId);
                    if (invItem == null) continue;

                    var unitPrice = kitRow.UnitPrice > 0 ? kitRow.UnitPrice : invItem.SellingPrice;
                    var lineTotal = kitRow.Quantity * unitPrice;
                    totalKitAmount += lineTotal;

                    // Deduct stock in store
                    invItem.CurrentStock = Math.Max(0, invItem.CurrentStock - kitRow.Quantity);
                    invItem.UpdatedAt = DateTime.UtcNow;

                    outward.Items.Add(new InventoryOutwardItem
                    {
                        Id = Guid.NewGuid(),
                        TenantId = _currentUser.TenantId,
                        BranchId = outward.BranchId,
                        OutwardId = outward.Id,
                        ItemId = invItem.Id,
                        Quantity = kitRow.Quantity,
                        UnitPrice = unitPrice,
                        TotalAmount = lineTotal,
                        Remarks = "Admission Kit Item"
                    });
                }

                outward.TotalAmount = totalKitAmount;
                _dbContext.InventoryOutwards.Add(outward);

                // If marked as 'AddedToFeeBill', physical kit is issued from store inventory
                // and charges will be automatically bundled into the student's tuition fee invoice (no separate inventory invoice).
                if (dto.KitPaymentStatus == "AddedToFeeBill")
                {
                    outward.PaymentStatus = "AddedToFeeBill";
                    outward.Remarks = string.IsNullOrEmpty(outward.Remarks)
                        ? "Admission Kit - Pending bundling in student fee invoice"
                        : $"{outward.Remarks} (Pending bundling in student fee invoice)";
                }

                await _dbContext.SaveChangesAsync();
            }

            // ── Sibling & Family Linkage chosen on Admission (School + Coaching) ──
            await UpsertSiblingLinkFromFormAsync(student, dto);
            await _dbContext.SaveChangesAsync();

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
                student.BloodGroup,
                student.IsHostelStudent,
                student.HostelBedId,
                null,
                null,
                null,
                null,
                student.LeavingDate,
                student.LeavingReason,
                student.TCNumber,
                student.IsLibraryMember,
                student.LibraryCardNumber,
                student.LibraryMembershipType,
                student.MaxLibraryBooks,
                student.MonthlyLibraryFee,
                student.IsTransportStudent,
                student.TransportAllocationId,
                null,
                null,
                null,
                0,
                null,
                null,
                null,
                student.AadhaarNumber,
                student.PenNumber,
                student.ApaarId,
                student.Category,
                student.Religion,
                student.EmergencyContactName,
                student.EmergencyContactPhone,
                student.PreviousSchoolName,
                student.PreviousBoard
            ));
        });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<StudentDto>> UpdateStudent(Guid id, [FromBody] CreateStudentDto dto)
    {
        try
        {
            var student = await _dbContext.Students.FindAsync(id);
            if (student == null) return NotFound(new { message = "Student not found" });

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
            student.IsSchoolStudent = dto.IsSchoolStudent;
            student.IsCoachingStudent = dto.IsCoachingStudent;
            student.RollNumber = !string.IsNullOrWhiteSpace(dto.RollNumber) 
                ? dto.RollNumber.Trim() 
                : (dto.SchoolRollNumber?.Trim() ?? dto.CoachingRollNumber?.Trim() ?? student.RollNumber ?? "N/A");
            student.SchoolRollNumber = dto.SchoolRollNumber?.Trim();
            student.CoachingRollNumber = dto.CoachingRollNumber?.Trim();
            student.AdmissionNumber = dto.AdmissionNumber?.Trim();
            if (dto.JoiningDate.HasValue)
            {
                student.JoiningDate = dto.JoiningDate.Value;
            }
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
            student.IsLibraryMember = dto.IsLibraryMember;
            student.LibraryCardNumber = dto.IsLibraryMember ? dto.LibraryCardNumber : null;
            student.LibraryMembershipType = dto.IsLibraryMember ? dto.LibraryMembershipType : null;
            student.MaxLibraryBooks = dto.IsLibraryMember && dto.MaxLibraryBooks > 0 ? dto.MaxLibraryBooks : 2;
            student.MonthlyLibraryFee = dto.IsLibraryMember ? dto.MonthlyLibraryFee : 0;
            if (!string.IsNullOrWhiteSpace(dto.StudentName)) student.StudentName = dto.StudentName.Trim();
            if (!string.IsNullOrWhiteSpace(dto.ParentName)) student.ParentName = dto.ParentName.Trim();
            student.ParentWhatsAppPhone = NormalizePhoneWithPrefix(dto.ParentWhatsAppPhone) ?? string.Empty;
            student.MotherName = dto.MotherName?.Trim();
            student.Gender = dto.Gender ?? "Male";
            student.DateOfBirth = dto.DateOfBirth;
            student.BloodGroup = dto.BloodGroup?.Trim();
            student.Address = dto.Address?.Trim();
            student.AadhaarNumber = dto.AadhaarNumber?.Trim();
            student.PenNumber = dto.PenNumber?.Trim();
            student.ApaarId = dto.ApaarId?.Trim();
            student.Category = dto.Category ?? "General";
            student.Religion = dto.Religion;
            student.EmergencyContactName = dto.EmergencyContactName?.Trim();
            student.EmergencyContactPhone = dto.EmergencyContactPhone?.Trim();
            student.PreviousSchoolName = dto.PreviousSchoolName?.Trim();
            student.PreviousBoard = dto.PreviousBoard;
            student.ProfilePhoto = ImageStorageHelper.SaveBase64Image(dto.ProfilePhoto, "students", student.Id.ToString(), _env.ContentRootPath)
                ?? student.ProfilePhoto;

            if (student.UserId.HasValue)
            {
                var linkedUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == student.UserId.Value);
                if (linkedUser != null)
                {
                    linkedUser.ProfilePhoto = student.ProfilePhoto;
                }
            }

            // ── Inventory Kit Issuance if items issued on Edit ──
            if (dto.IsIssueAdmissionKit && dto.AdmissionKitItems != null && dto.AdmissionKitItems.Any(i => i.Quantity > 0))
            {
                var issueNumber = $"OUT-{DateTime.UtcNow:yyyyMMddHHmmss}-{new Random().Next(100, 999)}";
                var outward = new InventoryOutward
                {
                    Id = Guid.NewGuid(),
                    TenantId = _currentUser.TenantId,
                    BranchId = student.BranchId,
                    IssueNumber = issueNumber,
                    IssueDate = DateTime.UtcNow,
                    IssueType = "StudentKitSale",
                    StudentId = student.Id,
                    IssuedToName = student.StudentName,
                    DepartmentOrClass = student.ClassId.HasValue ? (await _dbContext.SchoolClasses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == student.ClassId.Value))?.Name : "Admission",
                    PaymentStatus = !string.IsNullOrWhiteSpace(dto.KitPaymentStatus) ? dto.KitPaymentStatus : "Paid",
                    PaymentMode = dto.KitPaymentMode ?? "Cash",
                    Remarks = $"Issued during student edit ({student.AdmissionNumber ?? student.RollNumber})",
                    CreatedBy = _currentUser.UserId,
                    CreatedAt = DateTime.UtcNow
                };

                decimal totalKitAmount = 0;
                foreach (var kitRow in dto.AdmissionKitItems)
                {
                    if (kitRow.Quantity <= 0) continue;
                    var invItem = await _dbContext.InventoryItems.FindAsync(kitRow.ItemId);
                    if (invItem == null) continue;

                    var unitPrice = kitRow.UnitPrice > 0 ? kitRow.UnitPrice : invItem.SellingPrice;
                    var lineTotal = kitRow.Quantity * unitPrice;
                    totalKitAmount += lineTotal;

                    invItem.CurrentStock = Math.Max(0, invItem.CurrentStock - kitRow.Quantity);
                    invItem.UpdatedAt = DateTime.UtcNow;

                    outward.Items.Add(new InventoryOutwardItem
                    {
                        Id = Guid.NewGuid(),
                        TenantId = _currentUser.TenantId,
                        BranchId = outward.BranchId,
                        OutwardId = outward.Id,
                        ItemId = invItem.Id,
                        Quantity = kitRow.Quantity,
                        UnitPrice = unitPrice,
                        TotalAmount = lineTotal,
                        Remarks = "Kit Item issued on profile edit"
                    });
                }

                outward.TotalAmount = totalKitAmount;
                _dbContext.InventoryOutwards.Add(outward);

                if (dto.KitPaymentStatus == "AddedToFeeBill")
                {
                    outward.PaymentStatus = "AddedToFeeBill";
                    outward.Remarks = string.IsNullOrEmpty(outward.Remarks)
                        ? "Admission Kit - Pending bundling in student fee invoice"
                        : $"{outward.Remarks} (Pending bundling in student fee invoice)";
                }
            }

            // ── Sibling & Family Linkage chosen on Edit ──
            await UpsertSiblingLinkFromFormAsync(student, dto);

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
            Guid? hostelId = null;
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
                    hostelId = bedInfo.Room?.HostelId;
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
                bedCode,
                hostelId,
                student.LeavingDate,
                student.LeavingReason,
                student.TCNumber,
                student.IsLibraryMember,
                student.LibraryCardNumber,
                student.LibraryMembershipType,
                student.MaxLibraryBooks,
                student.MonthlyLibraryFee,
                student.IsTransportStudent,
                student.TransportAllocationId,
                null,
                null,
                null,
                0,
                null,
                null,
                null,
                student.AadhaarNumber,
                student.PenNumber,
                student.ApaarId,
                student.Category,
                student.Religion,
                student.EmergencyContactName,
                student.EmergencyContactPhone,
                student.PreviousSchoolName,
                student.PreviousBoard
            ));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.InnerException?.Message ?? ex.Message });
        }
    }

    [HttpGet("{id}/clearance-status")]
    public async Task<ActionResult<StudentLeavingClearanceDto>> GetClearanceStatus(Guid id)
    {
        var student = await _dbContext.Students
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id);

        if (student == null) return NotFound(new { message = "Student not found" });

        // 1. Fee Invoices pending
        var unpaidInvoices = await _dbContext.FeeInvoices
            .AsNoTracking()
            .Where(i => i.StudentId == id && i.Status != InvoiceStatus.Paid && i.Status != InvoiceStatus.Cancelled)
            .ToListAsync();

        var pendingFees = unpaidInvoices.Sum(i => i.TotalAmount - i.PaidAmount);

        // 2. Hostel allocation
        var activeAlloc = await _dbContext.HostelAllocations
            .AsNoTracking()
            .Include(a => a.Bed)
                .ThenInclude(b => b!.Room)
                    .ThenInclude(r => r!.Hostel)
            .Where(a => a.StudentId == id && a.Status == "Active")
            .FirstOrDefaultAsync();

        bool hasHostelBed = student.IsHostelStudent || student.HostelBedId.HasValue || activeAlloc != null;
        Guid? bedId = student.HostelBedId ?? activeAlloc?.BedId;
        Guid? allocId = activeAlloc?.Id;
        string? hostelName = activeAlloc?.Bed?.Room?.Hostel?.Name;
        string? roomNum = activeAlloc?.Bed?.Room?.RoomNumber;
        string? bedCode = activeAlloc?.Bed?.BedCode;

        // 3. Library circulations
        var issuedBooksCount = await _dbContext.LibraryCirculations
            .AsNoTracking()
            .CountAsync(c => c.StudentId == id && (c.Status == "Issued" || c.Status == "Overdue"));

        var pendingLibFines = await _dbContext.LibraryCirculations
            .AsNoTracking()
            .Where(c => c.StudentId == id && c.FineStatus == "Pending")
            .SumAsync(c => c.FineAmount);

        // 4. Transport allocation
        var activeTransportAlloc = await _dbContext.TransportAllocations
            .AsNoTracking()
            .Include(a => a.Route)
            .Include(a => a.Stop)
            .FirstOrDefaultAsync(a => a.StudentId == id && a.Status == "Active");

        return Ok(new StudentLeavingClearanceDto(
            student.Id,
            student.StudentName,
            student.RollNumber,
            student.IsActive,
            pendingFees,
            unpaidInvoices.Count,
            hasHostelBed,
            bedId,
            allocId,
            hostelName,
            roomNum,
            bedCode,
            issuedBooksCount,
            pendingLibFines,
            student.TCNumber,
            student.LeavingDate,
            student.LeavingReason,
            student.IsTransportStudent || activeTransportAlloc != null,
            activeTransportAlloc?.Id,
            activeTransportAlloc?.Route?.RouteName,
            activeTransportAlloc?.Stop?.StopName
        ));
    }

    [HttpPost("{id}/mark-left")]
    public async Task<ActionResult<MarkStudentLeftResultDto>> MarkStudentLeft(Guid id, [FromBody] MarkStudentLeftDto dto)
    {
        var student = await _dbContext.Students
            .Include(s => s.HostelAllocations)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (student == null) return NotFound(new { message = "Student not found" });

        student.IsActive = false;
        student.LeavingDate = dto.LeavingDate != default ? dto.LeavingDate : DateTime.UtcNow;
        student.LeavingReason = !string.IsNullOrWhiteSpace(dto.Remarks)
            ? $"{dto.LeavingReason} - {dto.Remarks}"
            : dto.LeavingReason;

        // Generate TC number if not already present or provided
        if (!string.IsNullOrWhiteSpace(dto.CustomTCNumber))
        {
            student.TCNumber = dto.CustomTCNumber.Trim();
        }
        else if (string.IsNullOrWhiteSpace(student.TCNumber))
        {
            var year = DateTime.UtcNow.Year;
            var isPassedOut = !string.IsNullOrWhiteSpace(dto.LeavingReason) && 
                (dto.LeavingReason.Contains("Passed Out", StringComparison.OrdinalIgnoreCase) || 
                 dto.LeavingReason.Contains("Completed", StringComparison.OrdinalIgnoreCase));
            var prefix = isPassedOut ? $"SLC-{year}" : $"TC-{year}";
            var countThisYear = await _dbContext.Students
                .IgnoreQueryFilters()
                .CountAsync(s => s.TenantId == _currentUser.TenantId && s.TCNumber != null && s.TCNumber.StartsWith(prefix));
            student.TCNumber = $"{prefix}-{(countThisYear + 1):D4}";
        }

        // Handle hostel bed deallocation
        bool hostelVacated = false;
        if (dto.VacateHostelBed)
        {
            if (student.HostelBedId.HasValue)
            {
                var bed = await _dbContext.HostelBeds.FindAsync(student.HostelBedId.Value);
                if (bed != null)
                {
                    bed.CurrentStudentId = null;
                    bed.Status = "Available";
                }
                student.HostelBedId = null;
                student.IsHostelStudent = false;
                hostelVacated = true;
            }

            var linkedBeds = await _dbContext.HostelBeds
                .Where(b => b.CurrentStudentId == id)
                .ToListAsync();
            foreach (var b in linkedBeds)
            {
                b.CurrentStudentId = null;
                b.Status = "Available";
                hostelVacated = true;
            }

            var activeAllocations = await _dbContext.HostelAllocations
                .Where(a => a.StudentId == id && a.Status == "Active")
                .ToListAsync();

            foreach (var alloc in activeAllocations)
            {
                alloc.Status = "Vacated";
                alloc.VacatedDate = dto.LeavingDate != default ? dto.LeavingDate : DateTime.UtcNow;
                alloc.Remarks = (alloc.Remarks ?? "") + $" | Left School: {dto.LeavingReason}";
                hostelVacated = true;
            }
        }

        // Handle transport seat release
        bool transportReleased = false;
        if (dto.ReleaseTransportSeat && student.IsTransportStudent)
        {
            var activeTransAlloc = await _dbContext.TransportAllocations
                .FirstOrDefaultAsync(a => a.StudentId == id && a.Status == "Active");
            if (activeTransAlloc != null)
            {
                activeTransAlloc.Status = "Discontinued";
                activeTransAlloc.EffectiveTo = dto.LeavingDate != default ? dto.LeavingDate : DateTime.UtcNow;
                activeTransAlloc.Remarks = (activeTransAlloc.Remarks ?? "") + $" | Left School: {dto.LeavingReason}";
                student.IsTransportStudent = false;
                student.TransportAllocationId = null;
                transportReleased = true;
            }
        }

        await _dbContext.SaveChangesAsync();

        var unpaidInvoices = await _dbContext.FeeInvoices
            .AsNoTracking()
            .Where(i => i.StudentId == id && i.Status != InvoiceStatus.Paid && i.Status != InvoiceStatus.Cancelled)
            .ToListAsync();
        var pendingFeesRemaining = unpaidInvoices.Sum(i => i.TotalAmount - i.PaidAmount);

        return Ok(new MarkStudentLeftResultDto(
            true,
            $"Student marked as left successfully. TC Number: {student.TCNumber}",
            student.TCNumber,
            student.LeavingDate.Value,
            student.LeavingReason,
            pendingFeesRemaining,
            hostelVacated,
            transportReleased
        ));
    }

    [HttpPost("{id}/re-admit")]
    public async Task<IActionResult> ReAdmitStudent(Guid id, [FromBody] ReAdmitStudentDto dto)
    {
        var student = await _dbContext.Students
            .Include(s => s.Class)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound(new { message = "Student not found" });

        // Check if student was marked as Passed Out / Graduated (Point 1 rule)
        if (!string.IsNullOrWhiteSpace(student.LeavingReason) && 
            (student.LeavingReason.Contains("Passed Out", StringComparison.OrdinalIgnoreCase) || 
             student.LeavingReason.Contains("Completed", StringComparison.OrdinalIgnoreCase)))
        {
            return BadRequest(new { 
                message = "Graduated / Passed-Out students cannot be re-admitted to the same class. Please register a fresh admission for the next class/stream." 
            });
        }

        student.IsActive = true;
        student.JoiningDate = dto.ReAdmissionDate != default ? dto.ReAdmissionDate : DateTime.UtcNow;

        if (dto.ClassId.HasValue) student.ClassId = dto.ClassId.Value;
        if (dto.SectionId.HasValue) student.SectionId = dto.SectionId.Value;
        if (dto.BatchId.HasValue) student.BatchId = dto.BatchId.Value;
        if (!string.IsNullOrWhiteSpace(dto.NewRollNumber))
        {
            student.RollNumber = dto.NewRollNumber.Trim();
            if (student.IsSchoolStudent) student.SchoolRollNumber = dto.NewRollNumber.Trim();
        }

        if (dto.ResetTC)
        {
            student.TCNumber = null;
            student.LeavingDate = null;
            student.LeavingReason = null;
        }

        // Optional Re-Admission Fee invoice generation
        if (dto.ReAdmissionFee > 0)
        {
            var invoiceNumber = $"INV-READMIT-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(100, 999)}";
            var invoice = new FeeInvoice
            {
                Id = Guid.NewGuid(),
                TenantId = _currentUser.TenantId,
                BranchId = student.BranchId ?? _currentUser.BranchId,
                StudentId = student.Id,
                ClassId = student.ClassId,
                ClassName = student.Class?.Name,
                SectionId = student.SectionId,
                SectionName = student.Section?.Name,
                InvoiceNumber = invoiceNumber,
                Title = "Re-Admission Fee",
                InvoiceCategory = student.IsSchoolStudent ? "School" : "Coaching",
                TotalAmount = dto.ReAdmissionFee,
                PaidAmount = 0,
                DueDate = DateTime.UtcNow.AddDays(7),
                Status = InvoiceStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };

            invoice.Items.Add(new FeeInvoiceItem
            {
                Id = Guid.NewGuid(),
                TenantId = _currentUser.TenantId,
                InvoiceId = invoice.Id,
                HeadName = "Re-Admission Fee",
                Amount = dto.ReAdmissionFee,
                PaidAmount = 0,
                CreatedAt = DateTime.UtcNow
            });

            _dbContext.FeeInvoices.Add(invoice);
        }

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = $"Student '{student.StudentName}' successfully re-admitted and restored to active enrollment." });
    }

    // =========================================================================
    // STUDENT ID CARD GENERATOR
    // =========================================================================

    [HttpGet("id-cards")]
    public async Task<ActionResult<IEnumerable<StudentIdCardDto>>> GetStudentIdCards(
        [FromQuery] Guid? studentId,
        [FromQuery] Guid? classId,
        [FromQuery] Guid? sectionId,
        [FromQuery] Guid? batchId)
    {
        var branch = await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == _currentUser.BranchId);
        var tenant = await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == _currentUser.TenantId);

        string institutionName = tenant?.Name ?? "School ERP";
        string? branchName = branch?.Name;
        string? instAddress = branch?.Address ?? tenant?.Address;
        string? instPhone = branch?.ContactPhone ?? tenant?.ContactPhone;
        string? affCode = branch?.Code ?? "STUDENT-ID";
        string academicYear = $"{DateTime.UtcNow.Year}-{DateTime.UtcNow.Year + 1}";

        var query = _dbContext.Students.AsNoTracking()
            .Include(s => s.Batch)
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Where(s => s.IsActive && s.IsSchoolStudent);

        if (studentId.HasValue && studentId.Value != Guid.Empty)
            query = query.Where(s => s.Id == studentId.Value);
        else if (classId.HasValue && classId.Value != Guid.Empty)
        {
            query = query.Where(s => s.ClassId == classId.Value);
            if (sectionId.HasValue && sectionId.Value != Guid.Empty)
                query = query.Where(s => s.SectionId == sectionId.Value);
        }
        else if (batchId.HasValue && batchId.Value != Guid.Empty)
            query = query.Where(s => s.BatchId == batchId.Value);

        var students = await query.OrderBy(s => s.StudentName).ToListAsync();

        var cards = students.Select(s =>
        {
            string qrData = $"ADM:{s.AdmissionNumber ?? s.RollNumber}|NAME:{s.StudentName}|CLASS:{s.Class?.Name ?? s.Batch?.Name}|DOB:{s.DateOfBirth?.ToString("dd-MMM-yyyy") ?? ""}";
            return new StudentIdCardDto(
                s.Id,
                s.StudentName,
                s.AdmissionNumber,
                s.SchoolRollNumber,
                s.RollNumber,
                s.Class?.Name,
                s.Section?.Name,
                s.Batch?.Name,
                s.DateOfBirth?.ToString("yyyy-MM-dd"),
                s.Gender,
                s.BloodGroup,
                s.ParentName,
                s.ParentWhatsAppPhone,
                s.Address,
                s.ProfilePhoto,
                s.AadhaarNumber,
                s.Category,
                institutionName,
                branchName,
                instAddress,
                instPhone,
                affCode,
                academicYear,
                qrData
            );
        });

        return Ok(cards);
    }

    // =========================================================================
    // BONAFIDE / CHARACTER CERTIFICATE GENERATOR
    // =========================================================================

    [HttpGet("{id}/bonafide")]
    public async Task<ActionResult<BonafideCertificateDto>> GetBonafideCertificate(
        Guid id,
        [FromQuery] string certType = "Bonafide")
    {
        var s = await _dbContext.Students.AsNoTracking()
            .Include(st => st.Class)
            .Include(st => st.Section)
            .FirstOrDefaultAsync(st => st.Id == id);

        if (s == null) return NotFound(new { message = "Student not found." });

        var branch = await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == (_currentUser.BranchId ?? s.BranchId));
        var tenant = await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == _currentUser.TenantId);

        string institutionName = tenant?.Name ?? "School ERP";
        string? branchName = branch?.Name;
        string? instAddress = branch?.Address ?? tenant?.Address;
        string? instPhone = branch?.ContactPhone ?? tenant?.ContactPhone;
        string? affCode = branch?.Code;
        string academicYear = $"{DateTime.UtcNow.Year}-{DateTime.UtcNow.Year + 1}";

        // Try to get principal from active teachers
        string? principalName = await _dbContext.Teachers.AsNoTracking()
            .Where(t => t.IsActive && (t.Designation != null && t.Designation.ToLower().Contains("principal")))
            .Select(t => t.FullName)
            .FirstOrDefaultAsync();

        var cert = new BonafideCertificateDto(
            s.Id,
            s.StudentName,
            s.AdmissionNumber,
            s.SchoolRollNumber,
            s.Class?.Name,
            s.Section?.Name,
            academicYear,
            s.DateOfBirth?.ToString("dd MMMM yyyy"),
            s.Gender,
            s.Category,
            s.ParentName,
            s.MotherName,
            s.Address,
            s.ProfilePhoto,
            s.PreviousSchoolName,
            s.BloodGroup,
            s.Religion,
            s.JoiningDate,
            institutionName,
            branchName,
            instAddress,
            instPhone,
            principalName,
            affCode,
            null, // affiliation number can be expanded later
            certType,
            DateTime.UtcNow.ToString("dd MMMM yyyy"),
            s.RollNumber
        );

        return Ok(cert);
    }

    // =========================================================================
    // STUDENT 360° PROFILE DOSSIER
    // =========================================================================

    [HttpGet("my-profile-360")]
    public async Task<ActionResult<Student360Dto>> GetMyProfile360()
    {
        var userId = _currentUser.UserId;
        var tenantId = _currentUser.TenantId;

        // 1. Check if logged in user is a Student directly linked via UserId
        var student = await _dbContext.Students.AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId && s.TenantId == tenantId);

        // 2. Check if logged in user is a Parent directly linked via ParentUserId
        if (student == null)
        {
            student = await _dbContext.Students.AsNoTracking()
                .FirstOrDefaultAsync(s => s.ParentUserId == userId && s.TenantId == tenantId);
        }

        // 3. Fallback: match by user's phone or name
        if (student == null)
        {
            var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user != null)
            {
                student = await _dbContext.Students.AsNoTracking().FirstOrDefaultAsync(s =>
                    s.TenantId == tenantId && (
                        (!string.IsNullOrEmpty(user.PhoneNumber) && (s.ParentWhatsAppPhone == user.PhoneNumber || s.EmergencyContactPhone == user.PhoneNumber)) ||
                        (!string.IsNullOrEmpty(user.FullName) && s.StudentName == user.FullName)
                    ));
            }
        }

        // 4. Fallback for staff/admin previewing the portal: first active student
        if (student == null)
        {
            student = await _dbContext.Students.AsNoTracking()
                .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.IsActive);
        }

        if (student == null) return NotFound(new { message = "No associated student profile found." });

        return await GetStudentProfile360(student.Id);
    }

    [HttpGet("{id}/profile-360")]
    public async Task<ActionResult<Student360Dto>> GetStudentProfile360(Guid id)
    {
        var student = await _dbContext.Students.AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Section)
                .ThenInclude(sec => sec!.ClassTeacher)
            .Include(s => s.Batch)
            .Include(s => s.Branch)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (student == null) return NotFound(new { message = "Student not found." });

        // 1. Linked Siblings (from explicit StudentSiblings table + matching Parent Phone)
        var explicitSiblingLinks = await _dbContext.StudentSiblings.AsNoTracking()
            .Where(s => s.StudentId == id || s.SiblingStudentId == id)
            .ToListAsync();
        var explicitIds = explicitSiblingLinks
            .Select(l => l.StudentId == id ? l.SiblingStudentId : l.StudentId)
            .ToHashSet();

        var phoneTrimmed = !string.IsNullOrWhiteSpace(student.ParentWhatsAppPhone) ? student.ParentWhatsAppPhone.Trim() : null;

        var siblingStudents = await _dbContext.Students.AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .Where(s => s.Id != student.Id && (
                explicitIds.Contains(s.Id) ||
                (phoneTrimmed != null && s.ParentWhatsAppPhone == phoneTrimmed)
            ))
            .ToListAsync();

        var siblings = siblingStudents.Select(s => new StudentSibling360Dto(
            s.Id,
            s.StudentName,
            s.SchoolRollNumber ?? s.RollNumber,
            s.Class != null ? s.Class.Name : null,
            s.Section != null ? s.Section.Name : null,
            s.Batch != null ? s.Batch.Name : null,
            s.ProfilePhoto,
            s.IsActive
        )).ToList();

        // 2. Fee Summary & Recent Invoices
        var invoices = await _dbContext.FeeInvoices.AsNoTracking()
            .Where(i => i.StudentId == id && i.Status != InvoiceStatus.Cancelled)
            .OrderByDescending(i => i.DueDate)
            .ToListAsync();

        var totalInvoiced = invoices.Sum(i => i.TotalAmount);
        var totalPaid = invoices.Sum(i => i.PaidAmount);
        var totalPending = invoices.Where(i => i.Status != InvoiceStatus.Paid).Sum(i => i.TotalAmount - i.PaidAmount);
        var unpaidCount = invoices.Count(i => i.Status != InvoiceStatus.Paid);

        var recentInvoices = invoices.Take(8).Select(i => new StudentFeeInvoiceItem360Dto(
            i.Id,
            i.InvoiceNumber,
            i.Title,
            i.TotalAmount,
            i.PaidAmount,
            i.TotalAmount - i.PaidAmount,
            i.Status.ToString(),
            i.DueDate,
            i.CreatedAt
        )).ToList();

        var feeSummary = new StudentFeeSummary360Dto(
            totalInvoiced,
            totalPaid,
            totalPending,
            invoices.Count,
            unpaidCount,
            recentInvoices
        );

        // 3. Attendance Summary & Recent Logs
        var attendances = await _dbContext.StudentAttendances.AsNoTracking()
            .Where(a => a.StudentId == id)
            .OrderByDescending(a => a.AttendanceDate)
            .ToListAsync();

        int totalRecDays = attendances.Count;
        int presentCount = attendances.Count(a => a.Status == TeacherAttendanceStatus.Present);
        int absentCount = attendances.Count(a => a.Status == TeacherAttendanceStatus.Absent);
        int lateCount = attendances.Count(a => a.Status == TeacherAttendanceStatus.Late);
        int halfCount = attendances.Count(a => a.Status == TeacherAttendanceStatus.HalfDay);
        int leaveCount = attendances.Count(a => a.Status == TeacherAttendanceStatus.Leave);

        decimal attPct = totalRecDays > 0 
            ? Math.Round(((presentCount + lateCount + (halfCount * 0.5m)) / (decimal)totalRecDays) * 100m, 1) 
            : 0m;

        var recentAttLogs = attendances.Take(15).Select(a => new StudentRecentAttendanceItem360Dto(
            a.AttendanceDate,
            a.Status.ToString(),
            a.Remarks,
            a.CaptureSource
        )).ToList();

        var attSummary = new StudentAttendance360Dto(
            totalRecDays,
            presentCount,
            absentCount,
            lateCount,
            halfCount,
            leaveCount,
            attPct,
            recentAttLogs
        );

        // 4. Exams & Test Marks
        var testMarks = await _dbContext.TestMarks.AsNoTracking()
            .Include(m => m.Test)
            .Where(m => m.StudentId == id)
            .OrderByDescending(m => m.Test != null ? m.Test.TestDate : DateTime.MinValue)
            .Take(10)
            .ToListAsync();

        var examMarksList = testMarks.Select(m => {
            var maxMarks = m.Test?.MaxMarks ?? 100m;
            var pct = maxMarks > 0 ? Math.Round((m.MarksObtained / maxMarks) * 100m, 1) : 0m;
            var passMarks = m.Test?.PassingMarks ?? (maxMarks * 0.33m);
            var isPass = m.MarksObtained >= passMarks;
            return new StudentExamMark360Dto(
                m.TestId,
                m.Test?.Title ?? "Assessment Test",
                m.Test?.Subject ?? "General",
                m.Test?.TestDate ?? DateTime.UtcNow,
                m.MarksObtained,
                maxMarks,
                pct,
                isPass ? "Passed" : "Needs Improvement",
                m.Remarks
            );
        }).ToList();

        // 5. Library Info & Issued Books
        var circulations = await _dbContext.LibraryCirculations.AsNoTracking()
            .Include(c => c.BookCopy)
                .ThenInclude(bc => bc!.Book)
            .Where(c => c.StudentId == id && (c.Status == "Issued" || c.Status == "Overdue"))
            .OrderByDescending(c => c.IssueDate)
            .ToListAsync();

        var issuedBooks = circulations.Select(c => new StudentIssuedBook360Dto(
            c.Id,
            c.BookCopy?.Book?.Title ?? "Library Book",
            c.BookCopy?.AccessionNumber ?? "",
            c.IssueDate,
            c.DueDate,
            c.DueDate.Date < DateTime.UtcNow.Date || c.Status == "Overdue",
            c.FineAmount,
            c.FineStatus
        )).ToList();

        var libInfo = new StudentLibrary360Dto(
            student.IsLibraryMember,
            student.LibraryCardNumber,
            student.LibraryMembershipType,
            student.MaxLibraryBooks,
            student.MonthlyLibraryFee,
            issuedBooks.Count,
            issuedBooks
        );

        // 6. Facilities (Hostel & Transport)
        var activeHostel = await _dbContext.HostelAllocations.AsNoTracking()
            .Include(h => h.Bed)
                .ThenInclude(b => b!.Room)
                    .ThenInclude(r => r!.Hostel)
            .FirstOrDefaultAsync(h => h.StudentId == id && h.Status == "Active");

        var activeTransport = await _dbContext.TransportAllocations.AsNoTracking()
            .Include(t => t.Route)
            .Include(t => t.Stop)
            .Include(t => t.Vehicle)
            .FirstOrDefaultAsync(t => t.StudentId == id && t.Status == "Active");

        var facilities = new StudentFacility360Dto(
            student.IsHostelStudent || activeHostel != null,
            activeHostel?.Bed?.Room?.Hostel?.Name,
            activeHostel?.Bed?.Room?.RoomNumber,
            activeHostel?.Bed?.BedCode,
            activeHostel?.MonthlyRent,
            student.IsTransportStudent || activeTransport != null,
            activeTransport?.Route?.RouteName,
            activeTransport?.Stop?.StopName,
            activeTransport?.Vehicle?.VehicleNumber,
            activeTransport?.MonthlyFare
        );

        // 7. Recent Leaves
        var leaves = await _dbContext.StudentLeaves.AsNoTracking()
            .Where(l => l.StudentId == id)
            .OrderByDescending(l => l.FromDate)
            .Take(6)
            .Select(l => new StudentLeave360Dto(
                l.Id,
                l.Reason,
                l.FromDate,
                l.ToDate,
                l.TotalDays,
                l.Status,
                l.CreatedAt
            ))
            .ToListAsync();

        // 8. Recent Gate Passes
        var gatePasses = await _dbContext.CampusGatePasses.AsNoTracking()
            .Where(g => g.StudentId == id)
            .OrderByDescending(g => g.OutDateTime)
            .Take(6)
            .Select(g => new StudentGatePass360Dto(
                g.Id,
                g.PassNumber,
                g.Purpose ?? "Campus Outpass",
                g.OutDateTime,
                g.ActualInDateTime,
                g.Status,
                g.PersonName
            ))
            .ToListAsync();

        // 9. Uploaded Documents
        var docs = await _dbContext.StudentDocuments.AsNoTracking()
            .Where(d => d.StudentId == id)
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new StudentDocumentDto(
                d.Id,
                d.StudentId,
                student.StudentName,
                d.DocumentType,
                d.Title,
                d.DocumentNumber,
                d.FileUrl,
                d.FileName,
                d.VerificationStatus,
                d.VerifiedBy,
                d.VerifiedAt,
                d.Remarks,
                d.CreatedAt
            ))
            .ToListAsync();

        // 10. Achievements & Awards
        var achievements = await _dbContext.StudentAchievements.AsNoTracking()
            .Where(a => a.StudentId == id)
            .OrderByDescending(a => a.AwardDate)
            .Select(a => new StudentAchievementDto(
                a.Id,
                a.StudentId,
                a.Title,
                a.Category,
                a.AwardLevel,
                a.AwardDate,
                a.BadgeIcon,
                a.CertificateNumber,
                a.Description,
                a.AwardedBy,
                a.CreatedAt
            ))
            .ToListAsync();

        // 11. Disciplinary Records
        var disciplinary = await _dbContext.StudentDisciplinaryRecords.AsNoTracking()
            .Where(d => d.StudentId == id)
            .OrderByDescending(d => d.IncidentDate)
            .Select(d => new StudentDisciplinaryDto(
                d.Id,
                d.StudentId,
                d.IncidentDate,
                d.IncidentType,
                d.Severity,
                d.Title,
                d.Description,
                d.ActionTaken,
                d.ReportedBy,
                d.ParentNotified,
                d.IsResolved,
                d.CreatedAt
            ))
            .ToListAsync();

        // 12. PTM Records
        var ptmRecords = await _dbContext.StudentPtmRecords.AsNoTracking()
            .Where(p => p.StudentId == id)
            .OrderByDescending(p => p.PtmDate)
            .Select(p => new StudentPtmDto(
                p.Id,
                p.StudentId,
                p.PtmDate,
                p.TeacherName,
                p.TeacherRemarks,
                p.ParentFeedback,
                p.ChildStrengths,
                p.AreasOfImprovement,
                p.ParentAttended,
                p.FollowUpRequired,
                p.CreatedAt
            ))
            .ToListAsync();

        // 13. Health Profile
        var healthEntity = await _dbContext.StudentHealthRecords.AsNoTracking()
            .FirstOrDefaultAsync(h => h.StudentId == id);
        
        StudentHealthDto? healthProfile = null;
        if (healthEntity != null)
        {
            healthProfile = new StudentHealthDto(
                healthEntity.Id,
                healthEntity.StudentId,
                healthEntity.HeightCm,
                healthEntity.WeightKg,
                healthEntity.Bmi,
                healthEntity.BmiCategory,
                healthEntity.VisionLeft,
                healthEntity.VisionRight,
                healthEntity.BloodGroup ?? student.BloodGroup,
                healthEntity.KnownAllergies,
                healthEntity.ChronicConditions,
                healthEntity.RegularMedications,
                healthEntity.EmergencyDoctorName,
                healthEntity.EmergencyDoctorPhone,
                healthEntity.LastCheckupDate,
                healthEntity.DoctorRemarks
            );
        }
        else if (!string.IsNullOrWhiteSpace(student.BloodGroup))
        {
            healthProfile = new StudentHealthDto(
                null,
                student.Id,
                null, null, null, null, null, null,
                student.BloodGroup,
                null, null, null, null, null, null, null
            );
        }

        // 14. Academic Early-Warning & Performance Radar
        bool hasAttendanceWarning = attSummary.AttendancePercentage < 75 && attSummary.TotalRecordedDays >= 5;
        string? attMsg = hasAttendanceWarning ? $"Attendance ({attSummary.AttendancePercentage:F1}%) is below CBSE/State minimum 75% threshold." : null;

        var failingExams = examMarksList.Where(e => e.Status == "Needs Improvement" || e.Status == "Failed" || e.Percentage < 35).ToList();
        bool hasExamWarning = failingExams.Any();
        string? examMsg = hasExamWarning ? $"Needs academic intervention in {string.Join(", ", failingExams.Select(f => f.SubjectName))}" : null;

        var strongSubs = examMarksList.Where(e => e.Percentage >= 75).Select(e => e.SubjectName).Distinct().ToList();
        var weakSubs = examMarksList.Where(e => e.Percentage < 45).Select(e => e.SubjectName).Distinct().ToList();

        bool isStar = attSummary.AttendancePercentage >= 90 && examMarksList.Any() && examMarksList.Average(e => e.Percentage) >= 80;
        string badgeText = isStar ? "Star Scholar (Top Performer)" : (hasAttendanceWarning || hasExamWarning ? "Remedial Attention Needed" : "Consistent Performer");

        var perfAlert = new StudentAcademicAlert360Dto(
            hasAttendanceWarning,
            attMsg,
            hasExamWarning,
            examMsg,
            isStar,
            badgeText,
            strongSubs,
            weakSubs
        );

        // 15. Student Detail DTO
        var studentDetail = new StudentDetail360Dto(
            student.Id,
            student.StudentName,
            student.RollNumber,
            student.SchoolRollNumber,
            student.CoachingRollNumber,
            student.AdmissionNumber,
            student.IsSchoolStudent,
            student.IsCoachingStudent,
            student.IsHostelStudent,
            student.IsLibraryMember,
            student.IsTransportStudent,
            student.ClassId,
            student.Class?.Name,
            student.SectionId,
            student.Section?.Name,
            student.Section?.ClassTeacher?.FullName,
            student.Section?.ClassTeacher?.PhoneNumber,
            student.BatchId,
            student.Batch?.Name,
            student.Batch?.Subject,
            student.ParentName,
            student.ParentWhatsAppPhone,
            student.MotherName,
            student.Gender,
            student.DateOfBirth,
            student.DateOfBirth.HasValue ? DateTime.UtcNow.Year - student.DateOfBirth.Value.Year : null,
            student.BloodGroup,
            student.Address,
            student.ProfilePhoto,
            student.IsActive,
            student.JoiningDate,
            student.AadhaarNumber,
            student.PenNumber,
            student.ApaarId,
            student.Category,
            student.Religion,
            student.EmergencyContactName,
            student.EmergencyContactPhone,
            student.PreviousSchoolName,
            student.PreviousBoard,
            student.Branch?.Name
        );

        var inventoryKits = await _dbContext.InventoryOutwards
            .AsNoTracking()
            .Include(o => o.Items)
                .ThenInclude(i => i.Item)
            .Where(o => o.StudentId == id)
            .OrderByDescending(o => o.IssueDate)
            .Select(o => new StudentInventoryKit360Dto(
                o.Id,
                o.IssueNumber,
                o.IssueDate,
                string.Join(", ", o.Items.Select(oi => $"{(oi.Item != null ? oi.Item.ItemName : "Item")} (x{oi.Quantity})")),
                o.Items.Sum(oi => oi.Quantity),
                o.TotalAmount,
                o.PaymentStatus,
                o.Remarks
            ))
            .ToListAsync();

        return Ok(new Student360Dto(
            studentDetail,
            siblings,
            feeSummary,
            attSummary,
            examMarksList,
            libInfo,
            facilities,
            leaves,
            gatePasses,
            docs,
            perfAlert,
            achievements,
            disciplinary,
            ptmRecords,
            healthProfile,
            inventoryKits
        ));
    }

    // =========================================================================
    // STUDENT LIVE CLASS ROUTINE & TIMETABLE
    // =========================================================================

    [HttpGet("my-timetable")]
    public async Task<ActionResult<StudentWeeklyTimetableDto>> GetMyTimetable([FromQuery] string? dayOfWeek)
    {
        var userId = _currentUser.UserId;
        var tenantId = _currentUser.TenantId;

        // 1. Resolve student from UserId, ParentUserId, or phone/name
        var student = await _dbContext.Students.AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId && s.TenantId == tenantId);

        if (student == null)
        {
            student = await _dbContext.Students.AsNoTracking()
                .FirstOrDefaultAsync(s => s.ParentUserId == userId && s.TenantId == tenantId);
        }

        if (student == null)
        {
            var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user != null)
            {
                student = await _dbContext.Students.AsNoTracking().FirstOrDefaultAsync(s =>
                    s.TenantId == tenantId && (
                        (!string.IsNullOrEmpty(user.PhoneNumber) && (s.ParentWhatsAppPhone == user.PhoneNumber || s.EmergencyContactPhone == user.PhoneNumber)) ||
                        (!string.IsNullOrEmpty(user.FullName) && s.StudentName == user.FullName)
                    ));
            }
        }

        if (student == null)
        {
            student = await _dbContext.Students.AsNoTracking()
                .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.IsActive);
        }

        if (student == null) return NotFound(new { message = "No associated student profile found." });

        return await GetStudentTimetable(student.Id, dayOfWeek);
    }

    [HttpGet("{id}/timetable")]
    public async Task<ActionResult<StudentWeeklyTimetableDto>> GetStudentTimetable(Guid id, [FromQuery] string? dayOfWeek)
    {
        var tenantId = _currentUser.TenantId;
        var student = await _dbContext.Students.AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Section)
                .ThenInclude(sec => sec!.ClassTeacher)
            .Include(s => s.Section)
                .ThenInclude(sec => sec!.Room)
            .Include(s => s.Batch)
                .ThenInclude(b => b!.Room)
            .Include(s => s.Branch)
            .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId);

        if (student == null) return NotFound(new { message = "Student not found." });

        // Indian Standard Time (IST)
        TimeZoneInfo istTz;
        try { istTz = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time"); }
        catch { istTz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata"); }
        var istNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istTz);
        var currentLiveTimeIst = istNow.ToString("hh:mm tt");
        var todayDow = istNow.DayOfWeek.ToString(); // e.g. "Wednesday"
        var todayDate = istNow.Date;

        var sectionId = student.SectionId;
        var classId = student.ClassId;
        var batchId = student.BatchId;

        // Fetch active assignments (School Section/Class or Coaching Batch)
        var assignments = await _dbContext.TeacherBatchAssignments.AsNoTracking()
            .Include(a => a.Teacher)
            .Include(a => a.Class)
            .Include(a => a.Section)
                .ThenInclude(sec => sec!.Room)
            .Include(a => a.Batch)
                .ThenInclude(b => b!.Room)
            .Where(a => a.TenantId == tenantId && a.IsActive &&
                        ((sectionId.HasValue && a.SectionId == sectionId.Value) ||
                         (classId.HasValue && a.ClassId == classId.Value && !a.SectionId.HasValue) ||
                         (batchId.HasValue && a.BatchId == batchId.Value)))
            .ToListAsync();

        // Fetch today's substitutions
        var substitutions = await _dbContext.TeacherSubstitutions.AsNoTracking()
            .Include(s => s.SubstituteTeacher)
            .Where(s => s.TenantId == tenantId && s.SubstitutionDate.Date == todayDate && s.Status == "Assigned" &&
                        ((sectionId.HasValue && s.ClassSectionId == sectionId.Value) ||
                         (batchId.HasValue && s.BatchId == batchId.Value)))
            .ToListAsync();

        var daysOfWeekList = new List<string> { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" };
        var weeklySchedule = new Dictionary<string, List<StudentTimetableSlotDto>>();

        TimeSpan? ParseTime(string? slot, bool isStart)
        {
            if (string.IsNullOrWhiteSpace(slot)) return null;
            var parts = slot.Split(new[] { "-", "–", "to" }, StringSplitOptions.RemoveEmptyEntries);
            string target = isStart ? parts.FirstOrDefault()?.Trim() ?? "" : parts.LastOrDefault()?.Trim() ?? "";
            if (DateTime.TryParse(target, out var dt)) return dt.TimeOfDay;
            if (TimeSpan.TryParse(target, out var ts)) return ts;
            return null;
        }

        List<StudentTimetableSlotDto> BuildSlotsForDay(string dow)
        {
            var isCurrentDay = string.Equals(dow, todayDow, StringComparison.OrdinalIgnoreCase);
            var daySlots = new List<StudentTimetableSlotDto>();

            var matching = assignments.Where(a =>
                string.IsNullOrEmpty(a.DaysOfWeek) ||
                a.DaysOfWeek.Contains(dow, StringComparison.OrdinalIgnoreCase) ||
                (dow.Length >= 3 && a.DaysOfWeek.Contains(dow.Substring(0, 3), StringComparison.OrdinalIgnoreCase))
            ).ToList();

            matching = matching.OrderBy(m => ParseTime(m.TimeSlot, true) ?? TimeSpan.MaxValue)
                               .ThenBy(m => m.TimeSlot)
                               .ToList();

            int periodNum = 1;
            foreach (var a in matching)
            {
                var startTimeSpan = ParseTime(a.TimeSlot, true);
                var endTimeSpan = ParseTime(a.TimeSlot, false);

                bool isLiveNow = false;
                bool isUpcoming = false;
                bool isCompleted = false;

                if (isCurrentDay && startTimeSpan.HasValue && endTimeSpan.HasValue)
                {
                    var nowTs = istNow.TimeOfDay;
                    if (nowTs >= startTimeSpan.Value && nowTs <= endTimeSpan.Value) isLiveNow = true;
                    else if (nowTs < startTimeSpan.Value) isUpcoming = true;
                    else if (nowTs > endTimeSpan.Value) isCompleted = true;
                }

                TeacherSubstitution? sub = null;
                if (isCurrentDay)
                {
                    sub = substitutions.FirstOrDefault(s =>
                        (s.TimeSlot != null && a.TimeSlot != null && s.TimeSlot.Trim().Equals(a.TimeSlot.Trim(), StringComparison.OrdinalIgnoreCase)) ||
                        (!string.IsNullOrEmpty(s.SubjectName) && s.SubjectName.Trim().Equals(a.Subject?.Trim(), StringComparison.OrdinalIgnoreCase))
                    );
                }

                var defaultRoom = a.Section?.Room?.RoomNumber ??
                                  student.Section?.Room?.RoomNumber ??
                                  a.Batch?.Room?.RoomNumber ??
                                  student.Batch?.Room?.RoomNumber;

                var stream = a.BatchId.HasValue ? "Coaching" : "School";
                var isClassTeacher = student.Section?.ClassTeacherId.HasValue == true &&
                                     a.TeacherId == student.Section.ClassTeacherId.Value;

                daySlots.Add(new StudentTimetableSlotDto(
                    a.Id,
                    periodNum++,
                    a.Subject,
                    a.TimeSlot ?? $"Period {periodNum - 1}",
                    startTimeSpan?.ToString(@"hh\:mm"),
                    endTimeSpan?.ToString(@"hh\:mm"),
                    a.TeacherId,
                    a.Teacher?.FullName ?? "Faculty",
                    a.Teacher?.PhoneNumber,
                    a.Teacher?.PhotoUrl,
                    isClassTeacher,
                    sub?.RoomNumber ?? defaultRoom ?? "Classroom",
                    a.DaysOfWeek ?? "Mon-Sat",
                    stream,
                    isLiveNow,
                    isUpcoming,
                    isCompleted,
                    sub != null,
                    sub?.SubstituteTeacher?.FullName,
                    sub?.Reason,
                    sub?.TopicToCover
                ));
            }

            return daySlots;
        }

        foreach (var dow in daysOfWeekList)
        {
            weeklySchedule[dow] = BuildSlotsForDay(dow);
        }

        var todayPeriods = weeklySchedule.ContainsKey(todayDow)
            ? weeklySchedule[todayDow]
            : (weeklySchedule.Values.FirstOrDefault() ?? new List<StudentTimetableSlotDto>());

        var facultyContacts = assignments
            .Where(a => a.Teacher != null)
            .GroupBy(a => a.TeacherId)
            .Select(g =>
            {
                var first = g.First();
                var isCt = student.Section?.ClassTeacherId.HasValue == true &&
                           first.TeacherId == student.Section.ClassTeacherId.Value;
                var allSubjects = string.Join(", ", g.Select(x => x.Subject).Distinct());
                var room = first.Section?.Room?.RoomNumber ?? student.Section?.Room?.RoomNumber ?? first.Batch?.Room?.RoomNumber;

                return new StudentFacultyContactDto(
                    first.TeacherId,
                    first.Teacher!.FullName,
                    allSubjects,
                    first.Teacher.PhoneNumber,
                    first.Teacher.Email,
                    first.Teacher.PhotoUrl,
                    isCt,
                    room ?? "Staff Room"
                );
            })
            .OrderByDescending(f => f.IsClassTeacher)
            .ThenBy(f => f.TeacherName)
            .ToList();

        var result = new StudentWeeklyTimetableDto(
            student.Id,
            student.StudentName,
            student.RollNumber,
            student.Class?.Name,
            student.Section?.Name,
            student.Batch?.Name,
            student.Branch?.Name,
            student.Section?.ClassTeacher?.FullName,
            student.Section?.ClassTeacher?.PhoneNumber,
            todayDow,
            currentLiveTimeIst,
            todayPeriods,
            weeklySchedule,
            facultyContacts
        );

        return Ok(result);
    }

    // =========================================================================
    // STUDENT KYC DOCUMENTS
    // =========================================================================

    [HttpGet("{id}/documents")]
    public async Task<ActionResult<IEnumerable<StudentDocumentDto>>> GetStudentDocuments(Guid id)
    {
        var student = await _dbContext.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound(new { message = "Student not found." });

        var docs = await _dbContext.StudentDocuments.AsNoTracking()
            .Where(d => d.StudentId == id)
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new StudentDocumentDto(
                d.Id,
                d.StudentId,
                student.StudentName,
                d.DocumentType,
                d.Title,
                d.DocumentNumber,
                d.FileUrl,
                d.FileName,
                d.VerificationStatus,
                d.VerifiedBy,
                d.VerifiedAt,
                d.Remarks,
                d.CreatedAt
            ))
            .ToListAsync();

        return Ok(docs);
    }

    [HttpPost("{id}/documents")]
    public async Task<ActionResult<StudentDocumentDto>> AddStudentDocument(Guid id, [FromBody] CreateStudentDocumentDto dto)
    {
        var student = await _dbContext.Students.FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound(new { message = "Student not found." });

        var docId = Guid.NewGuid();
        string? fileUrl = dto.FileUrl;

        // If file base64 is provided, save it to uploads/students/documents
        if (!string.IsNullOrWhiteSpace(dto.FileBase64))
        {
            fileUrl = ImageStorageHelper.SaveBase64File(dto.FileBase64, "students/documents", docId.ToString(), _env.ContentRootPath);
        }

        var doc = new StudentDocument
        {
            Id = docId,
            TenantId = _currentUser.TenantId,
            BranchId = _currentUser.BranchId ?? student.BranchId,
            StudentId = id,
            DocumentType = dto.DocumentType,
            Title = string.IsNullOrWhiteSpace(dto.Title) ? dto.DocumentType : dto.Title.Trim(),
            DocumentNumber = dto.DocumentNumber?.Trim(),
            FileUrl = fileUrl,
            FileName = dto.FileName,
            VerificationStatus = "Verified",
            VerifiedBy = _currentUser.UserRole,
            VerifiedAt = DateTime.UtcNow,
            Remarks = dto.Remarks?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.StudentDocuments.Add(doc);
        await _dbContext.SaveChangesAsync();

        return Ok(new StudentDocumentDto(
            doc.Id,
            doc.StudentId,
            student.StudentName,
            doc.DocumentType,
            doc.Title,
            doc.DocumentNumber,
            doc.FileUrl,
            doc.FileName,
            doc.VerificationStatus,
            doc.VerifiedBy,
            doc.VerifiedAt,
            doc.Remarks,
            doc.CreatedAt
        ));
    }

    [HttpDelete("{id}/documents/{docId}")]
    public async Task<IActionResult> DeleteStudentDocument(Guid id, Guid docId)
    {
        var doc = await _dbContext.StudentDocuments.FirstOrDefaultAsync(d => d.Id == docId && d.StudentId == id);
        if (doc == null) return NotFound(new { message = "Document not found." });

        _dbContext.StudentDocuments.Remove(doc);
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = "Document deleted successfully." });
    }

    // =========================================================================
    // STUDENT ACHIEVEMENTS & WALL OF FAME
    // =========================================================================

    [HttpPost("{id}/achievements")]
    public async Task<ActionResult<StudentAchievementDto>> AddStudentAchievement(Guid id, [FromBody] CreateStudentAchievementDto dto)
    {
        var student = await _dbContext.Students.FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound(new { message = "Student not found." });

        var achievement = new StudentAchievement
        {
            Id = Guid.NewGuid(),
            TenantId = _currentUser.TenantId,
            BranchId = _currentUser.BranchId ?? student.BranchId,
            StudentId = id,
            Title = dto.Title.Trim(),
            Category = dto.Category ?? "Academic",
            AwardLevel = dto.AwardLevel ?? "School",
            AwardDate = dto.AwardDate,
            BadgeIcon = string.IsNullOrWhiteSpace(dto.BadgeIcon) ? "emoji_events" : dto.BadgeIcon,
            CertificateNumber = dto.CertificateNumber?.Trim(),
            Description = dto.Description?.Trim(),
            AwardedBy = dto.AwardedBy?.Trim() ?? _currentUser.UserRole,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.StudentAchievements.Add(achievement);
        await _dbContext.SaveChangesAsync();

        return Ok(new StudentAchievementDto(
            achievement.Id,
            achievement.StudentId,
            achievement.Title,
            achievement.Category,
            achievement.AwardLevel,
            achievement.AwardDate,
            achievement.BadgeIcon,
            achievement.CertificateNumber,
            achievement.Description,
            achievement.AwardedBy,
            achievement.CreatedAt
        ));
    }

    [HttpDelete("{id}/achievements/{achId}")]
    public async Task<IActionResult> DeleteStudentAchievement(Guid id, Guid achId)
    {
        var ach = await _dbContext.StudentAchievements.FirstOrDefaultAsync(a => a.Id == achId && a.StudentId == id);
        if (ach == null) return NotFound(new { message = "Achievement record not found." });

        _dbContext.StudentAchievements.Remove(ach);
        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "Achievement removed successfully." });
    }

    // =========================================================================
    // STUDENT DISCIPLINARY & CONDUCT REGISTER
    // =========================================================================

    [HttpPost("{id}/discipline")]
    public async Task<ActionResult<StudentDisciplinaryDto>> AddStudentDisciplinaryRecord(Guid id, [FromBody] CreateStudentDisciplinaryDto dto)
    {
        var student = await _dbContext.Students.FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound(new { message = "Student not found." });

        var record = new StudentDisciplinaryRecord
        {
            Id = Guid.NewGuid(),
            TenantId = _currentUser.TenantId,
            BranchId = _currentUser.BranchId ?? student.BranchId,
            StudentId = id,
            IncidentDate = dto.IncidentDate,
            IncidentType = dto.IncidentType ?? "Warning",
            Severity = dto.Severity ?? "Low",
            Title = dto.Title.Trim(),
            Description = dto.Description.Trim(),
            ActionTaken = dto.ActionTaken?.Trim(),
            ReportedBy = dto.ReportedBy?.Trim() ?? _currentUser.UserRole,
            ParentNotified = dto.ParentNotified,
            IsResolved = dto.IsResolved,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.StudentDisciplinaryRecords.Add(record);
        await _dbContext.SaveChangesAsync();

        return Ok(new StudentDisciplinaryDto(
            record.Id,
            record.StudentId,
            record.IncidentDate,
            record.IncidentType,
            record.Severity,
            record.Title,
            record.Description,
            record.ActionTaken,
            record.ReportedBy,
            record.ParentNotified,
            record.IsResolved,
            record.CreatedAt
        ));
    }

    [HttpDelete("{id}/discipline/{recId}")]
    public async Task<IActionResult> DeleteStudentDisciplinaryRecord(Guid id, Guid recId)
    {
        var rec = await _dbContext.StudentDisciplinaryRecords.FirstOrDefaultAsync(r => r.Id == recId && r.StudentId == id);
        if (rec == null) return NotFound(new { message = "Disciplinary record not found." });

        _dbContext.StudentDisciplinaryRecords.Remove(rec);
        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "Disciplinary record removed successfully." });
    }

    // =========================================================================
    // PTM & PARENT INTERACTION DESK
    // =========================================================================

    [HttpPost("{id}/ptm")]
    public async Task<ActionResult<StudentPtmDto>> AddStudentPtmRecord(Guid id, [FromBody] CreateStudentPtmDto dto)
    {
        var student = await _dbContext.Students.FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound(new { message = "Student not found." });

        var record = new StudentPtmRecord
        {
            Id = Guid.NewGuid(),
            TenantId = _currentUser.TenantId,
            BranchId = _currentUser.BranchId ?? student.BranchId,
            StudentId = id,
            PtmDate = dto.PtmDate,
            TeacherName = dto.TeacherName.Trim(),
            TeacherRemarks = dto.TeacherRemarks.Trim(),
            ParentFeedback = dto.ParentFeedback?.Trim(),
            ChildStrengths = dto.ChildStrengths?.Trim(),
            AreasOfImprovement = dto.AreasOfImprovement?.Trim(),
            ParentAttended = dto.ParentAttended ?? "Both",
            FollowUpRequired = dto.FollowUpRequired,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.StudentPtmRecords.Add(record);
        await _dbContext.SaveChangesAsync();

        return Ok(new StudentPtmDto(
            record.Id,
            record.StudentId,
            record.PtmDate,
            record.TeacherName,
            record.TeacherRemarks,
            record.ParentFeedback,
            record.ChildStrengths,
            record.AreasOfImprovement,
            record.ParentAttended,
            record.FollowUpRequired,
            record.CreatedAt
        ));
    }

    [HttpDelete("{id}/ptm/{ptmId}")]
    public async Task<IActionResult> DeleteStudentPtmRecord(Guid id, Guid ptmId)
    {
        var ptm = await _dbContext.StudentPtmRecords.FirstOrDefaultAsync(p => p.Id == ptmId && p.StudentId == id);
        if (ptm == null) return NotFound(new { message = "PTM record not found." });

        _dbContext.StudentPtmRecords.Remove(ptm);
        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "PTM record removed successfully." });
    }

    // =========================================================================
    // STUDENT HEALTH & MEDICAL PROFILE
    // =========================================================================

    [HttpPost("{id}/health")]
    public async Task<ActionResult<StudentHealthDto>> SaveStudentHealth(Guid id, [FromBody] SaveStudentHealthDto dto)
    {
        var student = await _dbContext.Students.FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound(new { message = "Student not found." });

        // Calculate BMI if height and weight available
        decimal? bmi = null;
        string? bmiCategory = null;
        if (dto.HeightCm.HasValue && dto.HeightCm.Value > 0 && dto.WeightKg.HasValue && dto.WeightKg.Value > 0)
        {
            var heightM = dto.HeightCm.Value / 100m;
            bmi = Math.Round(dto.WeightKg.Value / (heightM * heightM), 2);
            if (bmi < 18.5m) bmiCategory = "Underweight";
            else if (bmi < 25m) bmiCategory = "Normal";
            else if (bmi < 30m) bmiCategory = "Overweight";
            else bmiCategory = "Obese";
        }

        var health = await _dbContext.StudentHealthRecords.FirstOrDefaultAsync(h => h.StudentId == id);
        if (health == null)
        {
            health = new StudentHealthRecord
            {
                Id = Guid.NewGuid(),
                TenantId = _currentUser.TenantId,
                BranchId = _currentUser.BranchId ?? student.BranchId,
                StudentId = id,
                HeightCm = dto.HeightCm,
                WeightKg = dto.WeightKg,
                Bmi = bmi,
                BmiCategory = bmiCategory,
                VisionLeft = dto.VisionLeft?.Trim(),
                VisionRight = dto.VisionRight?.Trim(),
                BloodGroup = dto.BloodGroup?.Trim() ?? student.BloodGroup,
                KnownAllergies = dto.KnownAllergies?.Trim(),
                ChronicConditions = dto.ChronicConditions?.Trim(),
                RegularMedications = dto.RegularMedications?.Trim(),
                EmergencyDoctorName = dto.EmergencyDoctorName?.Trim(),
                EmergencyDoctorPhone = dto.EmergencyDoctorPhone?.Trim(),
                LastCheckupDate = dto.LastCheckupDate,
                DoctorRemarks = dto.DoctorRemarks?.Trim(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _dbContext.StudentHealthRecords.Add(health);
        }
        else
        {
            health.HeightCm = dto.HeightCm;
            health.WeightKg = dto.WeightKg;
            health.Bmi = bmi;
            health.BmiCategory = bmiCategory;
            health.VisionLeft = dto.VisionLeft?.Trim();
            health.VisionRight = dto.VisionRight?.Trim();
            health.BloodGroup = dto.BloodGroup?.Trim() ?? student.BloodGroup;
            health.KnownAllergies = dto.KnownAllergies?.Trim();
            health.ChronicConditions = dto.ChronicConditions?.Trim();
            health.RegularMedications = dto.RegularMedications?.Trim();
            health.EmergencyDoctorName = dto.EmergencyDoctorName?.Trim();
            health.EmergencyDoctorPhone = dto.EmergencyDoctorPhone?.Trim();
            health.LastCheckupDate = dto.LastCheckupDate;
            health.DoctorRemarks = dto.DoctorRemarks?.Trim();
            health.UpdatedAt = DateTime.UtcNow;
        }

        if (!string.IsNullOrWhiteSpace(dto.BloodGroup) && student.BloodGroup != dto.BloodGroup)
        {
            student.BloodGroup = dto.BloodGroup.Trim();
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new StudentHealthDto(
            health.Id,
            health.StudentId,
            health.HeightCm,
            health.WeightKg,
            health.Bmi,
            health.BmiCategory,
            health.VisionLeft,
            health.VisionRight,
            health.BloodGroup,
            health.KnownAllergies,
            health.ChronicConditions,
            health.RegularMedications,
            health.EmergencyDoctorName,
            health.EmergencyDoctorPhone,
            health.LastCheckupDate,
            health.DoctorRemarks
        ));
    }

    // =========================================================================
    // FEATURE 1: SIBLING & FAMILY MAPPING
    // =========================================================================

    [HttpGet("{id}/siblings")]
    public async Task<ActionResult<List<StudentSiblingDto>>> GetStudentSiblings(Guid id)
    {
        var links = await _dbContext.StudentSiblings
            .AsNoTracking()
            .Where(s => s.StudentId == id || s.SiblingStudentId == id)
            .ToListAsync();

        if (!links.Any()) return Ok(new List<StudentSiblingDto>());

        var siblingStudentIds = links
            .Select(l => l.StudentId == id ? l.SiblingStudentId : l.StudentId)
            .Distinct()
            .ToList();

        var siblingStudents = await _dbContext.Students
            .AsNoTracking()
            .Include(st => st.Class)
            .Include(st => st.Section)
            .Include(st => st.Batch)
            .Where(st => siblingStudentIds.Contains(st.Id))
            .ToDictionaryAsync(st => st.Id);

        var duesByStudent = await _dbContext.FeeInvoices
            .AsNoTracking()
            .Where(f => siblingStudentIds.Contains(f.StudentId) && f.Status != InvoiceStatus.Paid && f.Status != InvoiceStatus.Cancelled)
            .GroupBy(f => f.StudentId)
            .Select(g => new { StudentId = g.Key, TotalDue = g.Sum(f => f.TotalAmount - f.PaidAmount) })
            .ToDictionaryAsync(x => x.StudentId, x => x.TotalDue);

        var result = new List<StudentSiblingDto>();
        var seenSiblingIds = new HashSet<Guid>();

        foreach (var link in links)
        {
            var targetId = link.StudentId == id ? link.SiblingStudentId : link.StudentId;
            if (!seenSiblingIds.Add(targetId) || !siblingStudents.TryGetValue(targetId, out var targetStudent)) continue;

            duesByStudent.TryGetValue(targetId, out var dues);

            result.Add(new StudentSiblingDto(
                link.Id,
                id,
                targetStudent.Id,
                targetStudent.StudentName,
                targetStudent.AdmissionNumber,
                targetStudent.Class?.Name,
                targetStudent.Section?.Name,
                targetStudent.Batch?.Name,
                targetStudent.SchoolRollNumber,
                targetStudent.RollNumber,
                targetStudent.Gender,
                targetStudent.ProfilePhoto,
                link.Relationship,
                link.DiscountPercent,
                targetStudent.ParentName,
                targetStudent.ParentWhatsAppPhone,
                dues,
                link.Notes,
                link.CreatedAt
            ));
        }

        return Ok(result);
    }

    [HttpPost("{id}/siblings")]
    public async Task<ActionResult<StudentSiblingDto>> AddStudentSibling(Guid id, [FromBody] AddStudentSiblingDto dto)
    {
        if (id == dto.SiblingStudentId)
            return BadRequest(new { message = "A student cannot be added as their own sibling." });

        var student = await _dbContext.Students.FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound(new { message = "Primary student not found." });

        var siblingStudent = await _dbContext.Students
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .FirstOrDefaultAsync(s => s.Id == dto.SiblingStudentId);
        if (siblingStudent == null) return NotFound(new { message = "Sibling student not found." });

        var alreadyLinked = await _dbContext.StudentSiblings.AnyAsync(s => 
            (s.StudentId == id && s.SiblingStudentId == dto.SiblingStudentId) ||
            (s.StudentId == dto.SiblingStudentId && s.SiblingStudentId == id));
        if (alreadyLinked)
            return BadRequest(new { message = "These students are already linked as siblings." });

        var link = new StudentSibling
        {
            Id = Guid.NewGuid(),
            TenantId = _currentUser.TenantId,
            BranchId = _currentUser.BranchId ?? student.BranchId,
            StudentId = id,
            SiblingStudentId = dto.SiblingStudentId,
            Relationship = string.IsNullOrWhiteSpace(dto.Relationship) ? "Brother" : dto.Relationship.Trim(),
            DiscountPercent = dto.DiscountPercent,
            Notes = dto.Notes?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.StudentSiblings.Add(link);
        await _dbContext.SaveChangesAsync();

        var dues = await _dbContext.FeeInvoices
            .AsNoTracking()
            .Where(f => f.StudentId == siblingStudent.Id && f.Status != InvoiceStatus.Paid && f.Status != InvoiceStatus.Cancelled)
            .SumAsync(f => (decimal?)(f.TotalAmount - f.PaidAmount)) ?? 0m;

        return Ok(new StudentSiblingDto(
            link.Id,
            id,
            siblingStudent.Id,
            siblingStudent.StudentName,
            siblingStudent.AdmissionNumber,
            siblingStudent.Class?.Name,
            siblingStudent.Section?.Name,
            siblingStudent.Batch?.Name,
            siblingStudent.SchoolRollNumber,
            siblingStudent.RollNumber,
            siblingStudent.Gender,
            siblingStudent.ProfilePhoto,
            link.Relationship,
            link.DiscountPercent,
            siblingStudent.ParentName,
            siblingStudent.ParentWhatsAppPhone,
            dues,
            link.Notes,
            link.CreatedAt
        ));
    }

    [HttpDelete("siblings/{linkId}")]
    public async Task<IActionResult> DeleteStudentSibling(Guid linkId)
    {
        var link = await _dbContext.StudentSiblings.FirstOrDefaultAsync(s => s.Id == linkId);
        if (link == null) return NotFound(new { message = "Sibling linkage not found." });

        _dbContext.StudentSiblings.Remove(link);
        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "Sibling linkage removed successfully." });
    }

    [HttpGet("search-for-sibling")]
    public async Task<ActionResult<List<SiblingCandidateSearchDto>>> SearchStudentsForSibling(
        [FromQuery] string query,
        [FromQuery] Guid? excludeStudentId)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2)
            return Ok(new List<SiblingCandidateSearchDto>());

        var q = query.Trim().ToLower();
        var students = await _dbContext.Students
            .AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .Where(s => s.IsActive &&
                (!excludeStudentId.HasValue || s.Id != excludeStudentId.Value) &&
                (s.StudentName.ToLower().Contains(q) ||
                 (s.AdmissionNumber != null && s.AdmissionNumber.ToLower().Contains(q)) ||
                 (s.CoachingRollNumber != null && s.CoachingRollNumber.ToLower().Contains(q)) ||
                 (s.ParentWhatsAppPhone != null && s.ParentWhatsAppPhone.Contains(q)) ||
                 (s.ParentName != null && s.ParentName.ToLower().Contains(q))))
            .Take(15)
            .Select(s => new SiblingCandidateSearchDto(
                s.Id,
                s.StudentName,
                s.AdmissionNumber,
                s.Class != null ? s.Class.Name : null,
                s.Section != null ? s.Section.Name : null,
                s.CoachingRollNumber ?? s.RollNumber,
                s.SchoolRollNumber,
                s.ParentName,
                s.ParentWhatsAppPhone,
                s.Gender,
                s.ProfilePhoto,
                s.Batch != null ? s.Batch.Name : null,
                s.IsSchoolStudent,
                s.IsCoachingStudent
            ))
            .ToListAsync();

        return Ok(students);
    }

    // =========================================================================
    // FEATURE 2: CLASS ROLL NUMBER RE-SEQUENCER
    // =========================================================================

    [HttpPost("resequence-roll-numbers")]
    public async Task<ActionResult<ResequenceRollNumbersResultDto>> ResequenceRollNumbers([FromBody] ResequenceRollNumbersRequestDto dto)
    {
        var query = _dbContext.Students
            .Where(s => s.IsActive && s.ClassId == dto.ClassId);

        if (dto.SectionId.HasValue && dto.SectionId.Value != Guid.Empty)
        {
            query = query.Where(s => s.SectionId == dto.SectionId.Value);
        }

        var students = await query.ToListAsync();
        if (!students.Any())
        {
            return Ok(new ResequenceRollNumbersResultDto(0, 0, dto.IsDryRun, dto.SortRule, new List<StudentRollNumberPreviewItemDto>()));
        }

        IEnumerable<Student> sorted = dto.SortRule?.ToLower() switch
        {
            "gender_alphabetical" => students
                .OrderBy(s => (s.Gender?.ToLower() == "female" || s.Gender?.ToLower() == "girl") ? 0 : 1)
                .ThenBy(s => s.StudentName, StringComparer.OrdinalIgnoreCase),
            "admission_date" => students
                .OrderBy(s => s.JoiningDate)
                .ThenBy(s => s.StudentName, StringComparer.OrdinalIgnoreCase),
            "admission_no" => students
                .OrderBy(s => s.AdmissionNumber ?? "")
                .ThenBy(s => s.StudentName, StringComparer.OrdinalIgnoreCase),
            _ => students
                .OrderBy(s => s.StudentName, StringComparer.OrdinalIgnoreCase)
        };

        var previewItems = new List<StudentRollNumberPreviewItemDto>();
        var prefix = dto.Prefix?.Trim() ?? "";
        int currentNumber = Math.Max(1, dto.StartFrom);

        foreach (var student in sorted)
        {
            var newRoll = string.IsNullOrEmpty(prefix) ? currentNumber.ToString() : $"{prefix}{currentNumber}";
            previewItems.Add(new StudentRollNumberPreviewItemDto(
                student.Id,
                student.StudentName,
                student.AdmissionNumber,
                student.Gender,
                student.SchoolRollNumber ?? student.RollNumber,
                newRoll
            ));

            if (!dto.IsDryRun)
            {
                student.SchoolRollNumber = newRoll;
                student.RollNumber = newRoll;
            }

            currentNumber++;
        }

        if (!dto.IsDryRun)
        {
            await _dbContext.SaveChangesAsync();
        }

        return Ok(new ResequenceRollNumbersResultDto(
            previewItems.Count,
            dto.IsDryRun ? 0 : previewItems.Count,
            dto.IsDryRun,
            dto.SortRule ?? "alphabetical",
            previewItems
        ));
    }

    // =========================================================================
    // FEATURE: STUDENT & PARENT ERP PORTAL LOGINS
    // =========================================================================

    [HttpGet("{id}/portal-logins")]
    public async Task<ActionResult<StudentPortalLoginInfoDto>> GetStudentPortalLogins(Guid id)
    {
        var student = await _dbContext.Students
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id);

        if (student == null) return NotFound(new { message = "Student not found." });

        // Retrieve student user if exists
        string? studentUsername = null;
        if (student.UserId.HasValue)
        {
            var sUser = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == student.UserId.Value && u.Role == UserRole.Student);
            studentUsername = sUser?.Username;
        }

        // Retrieve parent user if exists
        string? parentUsername = null;
        if (student.ParentUserId.HasValue)
        {
            var pUser = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == student.ParentUserId.Value && u.Role == UserRole.Parent);
            parentUsername = pUser?.Username;
        }

        // Check if Parent phone is linked to siblings
        var cleanPhone = (student.ParentWhatsAppPhone ?? "").Trim();
        var siblingNames = new List<string>();
        if (!string.IsNullOrWhiteSpace(cleanPhone))
        {
            siblingNames = await _dbContext.Students
                .AsNoTracking()
                .Where(s => s.Id != student.Id && s.IsActive && s.ParentWhatsAppPhone == cleanPhone)
                .Select(s => s.StudentName)
                .ToListAsync();

            // If parent user wasn't directly set on this student, check if another sibling already has a parent user with this phone!
            if (string.IsNullOrEmpty(parentUsername))
            {
                var existingParentByPhone = await _dbContext.Users
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => (u.PhoneNumber == cleanPhone || u.Username == cleanPhone) && u.Role == UserRole.Parent);
                if (existingParentByPhone != null)
                {
                    parentUsername = existingParentByPhone.Username;
                }
            }
        }

        // Calculate default credentials
        // Student default username: Clean Admission No or Roll No
        string defaultStudUser = !string.IsNullOrWhiteSpace(student.AdmissionNumber)
            ? student.AdmissionNumber.Trim().ToLower().Replace(" ", "").Replace("/", "-")
            : (!string.IsNullOrWhiteSpace(student.RollNumber)
                ? student.RollNumber.Trim().ToLower().Replace(" ", "").Replace("/", "-")
                : $"student.{student.StudentName.ToLower().Replace(" ", "")}");

        // Student default password: DOB in DDMMYYYY or Student@2026
        string defaultStudPass = student.DateOfBirth.HasValue
            ? student.DateOfBirth.Value.ToString("ddMMyyyy")
            : $"Student@{DateTime.UtcNow.Year}";

        // Parent default username: Phone number or parent.name
        string defaultParentUser = !string.IsNullOrWhiteSpace(cleanPhone)
            ? cleanPhone
            : $"parent.{student.ParentName.ToLower().Replace(" ", "")}";

        string defaultParentPass = $"Parent@{DateTime.UtcNow.Year}";

        string classOrBatch = student.Class != null
            ? $"{student.Class.Name}{(student.Section != null ? " - " + student.Section.Name : "")}"
            : (student.Batch != null ? student.Batch.Name : "");

        var result = new StudentPortalLoginInfoDto
        {
            StudentId = student.Id,
            StudentName = student.StudentName,
            RollNumber = student.RollNumber,
            AdmissionNumber = student.AdmissionNumber,
            ClassOrBatch = classOrBatch,
            ParentName = student.ParentName,
            ParentPhone = cleanPhone,
            ProfilePhoto = student.ProfilePhoto,
            HasStudentAccount = student.UserId.HasValue || !string.IsNullOrEmpty(studentUsername),
            StudentUsername = studentUsername,
            DefaultStudentUsername = defaultStudUser,
            DefaultStudentPassword = defaultStudPass,
            HasParentAccount = student.ParentUserId.HasValue || !string.IsNullOrEmpty(parentUsername),
            ParentUsername = parentUsername,
            DefaultParentUsername = defaultParentUser,
            DefaultParentPassword = defaultParentPass,
            IsParentLinkedToSiblings = siblingNames.Count > 0,
            SiblingNames = siblingNames
        };

        return Ok(result);
    }

    [HttpPost("{id}/create-portal-login")]
    public async Task<ActionResult<StudentPortalLoginResultDto>> CreateStudentPortalLogin(Guid id, [FromBody] CreateStudentPortalLoginRequestDto dto)
    {
        var student = await _dbContext.Students.FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound(new { message = "Student not found." });

        var messages = new List<string>();

        // Find or create Student Role and Parent Role
        var studentRole = await _dbContext.Roles.FirstOrDefaultAsync(r => r.Name.ToLower() == "student");
        var studentRoleId = studentRole?.Id ?? Guid.NewGuid();

        var parentRole = await _dbContext.Roles.FirstOrDefaultAsync(r => r.Name.ToLower() == "parent");
        var parentRoleId = parentRole?.Id ?? Guid.NewGuid();

        // 1. Handle Student Account
        if (dto.AccountType == "Student" || dto.AccountType == "Both")
        {
            var sUsername = (dto.StudentUsername ?? (!string.IsNullOrWhiteSpace(student.AdmissionNumber) ? student.AdmissionNumber : student.RollNumber)).Trim();
            var sPassword = (dto.StudentPassword ?? $"Student@{DateTime.UtcNow.Year}").Trim();

            string? sPhotoToSet = student.ProfilePhoto;
            if (!string.IsNullOrWhiteSpace(dto.StudentProfilePhoto))
            {
                if (dto.StudentProfilePhoto.StartsWith("data:image"))
                {
                    sPhotoToSet = ImageStorageHelper.SaveBase64Image(dto.StudentProfilePhoto, "students", student.Id.ToString(), _env.ContentRootPath);
                }
                else
                {
                    sPhotoToSet = dto.StudentProfilePhoto.Trim();
                }
                student.ProfilePhoto = sPhotoToSet;
            }

            if (student.UserId.HasValue)
            {
                // Update / Reset existing student user
                var existingUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == student.UserId.Value);
                if (existingUser != null)
                {
                    if (dto.ResetExistingPassword)
                    {
                        existingUser.PasswordHash = _passwordHasher.HashPassword(sPassword);
                        messages.Add("Student password reset successfully.");
                    }
                    if (!string.IsNullOrEmpty(sUsername) && !string.Equals(existingUser.Username, sUsername, StringComparison.OrdinalIgnoreCase))
                    {
                        var isTaken = await _dbContext.Users.AnyAsync(u => u.Id != existingUser.Id && u.Username.ToLower() == sUsername.ToLower());
                        if (!isTaken)
                        {
                            existingUser.Username = sUsername;
                        }
                    }
                    if (!string.IsNullOrEmpty(sPhotoToSet))
                    {
                        existingUser.ProfilePhoto = sPhotoToSet;
                    }
                }
            }
            else
            {
                // Check if username taken
                var isTaken = await _dbContext.Users.AnyAsync(u => u.Username.ToLower() == sUsername.ToLower());
                if (isTaken)
                {
                    return BadRequest(new { message = $"Student username '{sUsername}' is already taken by another user." });
                }

                var newUser = new User
                {
                    TenantId = _currentUser.TenantId,
                    BranchId = student.BranchId ?? _currentUser.BranchId,
                    Username = sUsername,
                    PasswordHash = _passwordHasher.HashPassword(sPassword),
                    FullName = student.StudentName,
                    PhoneNumber = student.ParentWhatsAppPhone,
                    Role = UserRole.Student,
                    RoleId = studentRoleId,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    ProfilePhoto = sPhotoToSet
                };
                _dbContext.Users.Add(newUser);
                await _dbContext.SaveChangesAsync();

                student.UserId = newUser.Id;
                messages.Add($"Student login account '@{sUsername}' created.");
            }
        }

        // 2. Handle Parent Account
        if (dto.AccountType == "Parent" || dto.AccountType == "Both")
        {
            var pPhone = (student.ParentWhatsAppPhone ?? "").Trim();
            var pUsername = (!string.IsNullOrWhiteSpace(dto.ParentUsername) ? dto.ParentUsername : pPhone).Trim();
            var pPassword = (dto.ParentPassword ?? $"Parent@{DateTime.UtcNow.Year}").Trim();

            if (string.IsNullOrWhiteSpace(pUsername))
            {
                return BadRequest(new { message = "Parent mobile phone / username is required to create parent login." });
            }

            if (student.ParentUserId.HasValue)
            {
                // Update / Reset existing parent user
                var existingPUser = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == student.ParentUserId.Value);
                if (existingPUser != null)
                {
                    if (dto.ResetExistingPassword)
                    {
                        existingPUser.PasswordHash = _passwordHasher.HashPassword(pPassword);
                        messages.Add("Parent password reset successfully.");
                    }
                }
            }
            else
            {
                // Check if user already exists with this username or phone (e.g. Sibling's parent)
                var existingPUser = await _dbContext.Users.FirstOrDefaultAsync(u =>
                    (u.Username.ToLower() == pUsername.ToLower() ||
                    (!string.IsNullOrEmpty(pPhone) && u.PhoneNumber == pPhone)) && u.Role == UserRole.Parent);

                if (existingPUser != null)
                {
                    // Seamless Sibling linking!
                    student.ParentUserId = existingPUser.Id;
                    if (dto.ResetExistingPassword)
                    {
                        existingPUser.PasswordHash = _passwordHasher.HashPassword(pPassword);
                    }
                    messages.Add($"Linked to existing parent account '@{existingPUser.Username}'.");
                }
                else
                {
                    var newParentUser = new User
                    {
                        TenantId = _currentUser.TenantId,
                        BranchId = student.BranchId ?? _currentUser.BranchId,
                        Username = pUsername,
                        PasswordHash = _passwordHasher.HashPassword(pPassword),
                        FullName = student.ParentName,
                        PhoneNumber = pPhone,
                        Role = UserRole.Parent,
                        RoleId = parentRoleId,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    };
                    _dbContext.Users.Add(newParentUser);
                    await _dbContext.SaveChangesAsync();

                    student.ParentUserId = newParentUser.Id;
                    messages.Add($"Parent login account '@{pUsername}' created.");
                }
            }
        }

        await _dbContext.SaveChangesAsync();

        // Get updated details
        var updatedInfoResult = await GetStudentPortalLogins(student.Id);
        var updatedInfo = (updatedInfoResult.Result as OkObjectResult)?.Value as StudentPortalLoginInfoDto
            ?? updatedInfoResult.Value;

        return Ok(new StudentPortalLoginResultDto
        {
            Success = true,
            Message = string.Join(" ", messages),
            LoginInfo = updatedInfo!
        });
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
