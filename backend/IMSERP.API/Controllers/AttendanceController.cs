using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/attendance")]
[Authorize]
public class AttendanceController : ControllerBase
{
    private const string ModeSettingsRoute = "/attendance/permissions/mode-settings";
    private const string ManualRoute = "/attendance/permissions/manual";
    private const string BiometricRoute = "/attendance/permissions/biometric";
    private const string MappingRoute = "/attendance/permissions/biometric-mapping";
    private const string CorrectionRoute = "/attendance/permissions/correction";
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IConfiguration _configuration;
    private readonly IMSERP.API.Services.IMenuPermissionService _menuPermissions;

    public AttendanceController(
        IIMSERPDbContext db,
        ICurrentUserService currentUser,
        IConfiguration configuration,
        IMSERP.API.Services.IMenuPermissionService menuPermissions)
    {
        _db = db;
        _currentUser = currentUser;
        _configuration = configuration;
        _menuPermissions = menuPermissions;
    }

    [HttpGet("permissions")]
    [IMSERP.API.Services.SkipMenuPermission]
    public async Task<ActionResult<AttendancePermissionsDto>> GetPermissions()
    {
        return Ok(new AttendancePermissionsDto(
            await HasPermissionAsync(ModeSettingsRoute, IMSERP.API.Services.MenuPermissionOperation.Edit),
            await HasPermissionAsync(ManualRoute, IMSERP.API.Services.MenuPermissionOperation.Create),
            await HasPermissionAsync(BiometricRoute, IMSERP.API.Services.MenuPermissionOperation.Create),
            await HasPermissionAsync(MappingRoute, IMSERP.API.Services.MenuPermissionOperation.Edit),
            await HasPermissionAsync(CorrectionRoute, IMSERP.API.Services.MenuPermissionOperation.Edit)));
    }

    [HttpGet("settings")]
    [IMSERP.API.Services.SkipMenuPermission]
    public async Task<ActionResult<AttendanceSettingsDto>> GetSettings()
    {
        var settings = await _db.AttendanceSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);
        return Ok(new AttendanceSettingsDto(
            settings?.StudentMode ?? "Both",
            settings?.TeacherMode ?? "Both",
            settings?.HostelMode ?? "Both",
            settings?.TeacherShiftStartTime ?? "08:00",
            settings?.TeacherShiftEndTime ?? "17:00",
            settings?.TeacherGracePeriodMinutes ?? 15,
            settings?.TeacherHalfDayThresholdMinutes ?? 240,
            settings?.TeacherAllowedLateDaysPerMonth ?? 3,
            settings?.StudentShiftStartTime ?? "08:00",
            settings?.StudentShiftEndTime ?? "14:00",
            settings?.StudentGracePeriodMinutes ?? 15,
            settings?.StudentHalfDayThresholdMinutes ?? 240,
            settings?.StudentAllowedLateDaysPerMonth ?? 3,
            settings?.TeacherWeeklyOffPattern ?? "SundayOnly",
            settings?.StudentWeeklyOffPattern ?? "SundayOnly",
            settings?.EnableStudentAbsenceFine ?? true,
            settings?.AbsenceFineDaysThreshold ?? 3,
            settings?.AbsenceFineAmount ?? 10.00m,
            settings?.AbsenceFineMode ?? "PerBlock",
            settings?.CoachingMode ?? "Both",
            settings?.CoachingWeeklyOffPattern ?? "SundayOnly",
            settings?.CoachingMorningStartTime ?? "07:00",
            settings?.CoachingMorningEndTime ?? "10:00",
            settings?.CoachingMorningGraceMinutes ?? 15,
            settings?.CoachingEveningStartTime ?? "16:00",
            settings?.CoachingEveningEndTime ?? "19:00",
            settings?.CoachingEveningGraceMinutes ?? 15
        ));
    }

    [HttpGet("mappings")]
    public async Task<ActionResult<IEnumerable<BiometricMappingPersonDto>>> GetMappings()
    {
        if (!await HasPermissionAsync(MappingRoute, IMSERP.API.Services.MenuPermissionOperation.Edit)) return Forbid();

        var rawStudents = await _db.Students.AsNoTracking()
            .Where(s => s.IsActive && !s.IsDeleted)
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .OrderBy(s => s.StudentName)
            .ToListAsync();

        var rawTeachers = await _db.Teachers.AsNoTracking()
            .Where(t => t.IsActive)
            .OrderBy(t => t.EmployeeCode)
            .ThenBy(t => t.FullName)
            .ToListAsync();

        var usedIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var s in rawStudents)
        {
            if (!string.IsNullOrWhiteSpace(s.BiometricUserId))
                usedIds.Add(s.BiometricUserId.Trim());
        }
        foreach (var t in rawTeachers)
        {
            if (!string.IsNullOrWhiteSpace(t.BiometricUserId))
                usedIds.Add(t.BiometricUserId.Trim());
        }

        var batches = rawStudents.Where(s => s.BatchId != null)
            .Select(s => s.Batch!)
            .DistinctBy(b => b.Id)
            .OrderBy(b => b.Name)
            .ToList();
        var batchIndexMap = batches.Select((b, idx) => new { b.Id, Index = idx + 1 }).ToDictionary(x => x.Id, x => x.Index);

        var (punchByBioId, punchByStudentId, punchByTeacherId) = await GetBiometricEnrollmentLookupAsync();

        var students = new List<BiometricMappingPersonDto>();
        for (int idx = 0; idx < rawStudents.Count; idx++)
        {
            var s = rawStudents[idx];
            var roll = s.IsSchoolStudent && !string.IsNullOrEmpty(s.SchoolRollNumber)
                ? s.SchoolRollNumber
                : (!string.IsNullOrEmpty(s.CoachingRollNumber) ? s.CoachingRollNumber : s.RollNumber);
            var stream = s.IsSchoolStudent && s.IsCoachingStudent ? "Both" : (s.IsSchoolStudent ? "School" : "Coaching");

            string suggested = "";
            if (string.IsNullOrWhiteSpace(s.BiometricUserId))
            {
                if (s.IsSchoolStudent)
                {
                    int cCode = GetClassNumericCode(s.Class?.Name);
                    int rNum = ExtractNumericRoll(roll, idx + 1);
                    string candidate = $"{cCode}{rNum:D2}";
                    int offset = 1;
                    while (usedIds.Contains(candidate))
                    {
                        candidate = $"{cCode}{(rNum + offset):D2}";
                        offset++;
                    }
                    suggested = candidate;
                    usedIds.Add(suggested);
                }
                else if (s.IsCoachingStudent || s.BatchId != null)
                {
                    int bIdx = s.BatchId != null && batchIndexMap.TryGetValue(s.BatchId.Value, out int bi) ? bi : 1;
                    int bPrefix = 80 + (bIdx % 10);
                    int rNum = ExtractNumericRoll(roll, idx + 1);
                    string candidate = $"{bPrefix}{rNum:D2}";
                    int offset = 1;
                    while (usedIds.Contains(candidate))
                    {
                        candidate = $"{bPrefix}{(rNum + offset):D2}";
                        offset++;
                    }
                    suggested = candidate;
                    usedIds.Add(suggested);
                }
            }

            var (isEnrolled, lastPunchAt) = ResolveEnrollmentStatus(s.Id, s.BiometricUserId, roll, punchByBioId, punchByStudentId);

            students.Add(new BiometricMappingPersonDto(
                s.Id,
                "Student",
                s.StudentName,
                roll ?? "",
                s.BiometricUserId,
                s.Batch?.Name,
                s.Class?.Name,
                s.Section?.Name,
                stream,
                suggested,
                isEnrolled,
                lastPunchAt
            ));
        }

        var teachers = new List<BiometricMappingPersonDto>();
        for (int idx = 0; idx < rawTeachers.Count; idx++)
        {
            var t = rawTeachers[idx];
            string suggested = "";
            if (string.IsNullOrWhiteSpace(t.BiometricUserId))
            {
                int empDigits = ExtractNumericRoll(t.EmployeeCode, idx + 1);
                string candidate = (empDigits > 0 && empDigits < 1000) ? $"9{empDigits:D3}" : $"9{(idx + 1):D3}";
                int offset = 1;
                while (usedIds.Contains(candidate))
                {
                    candidate = $"9{(idx + 1 + offset):D3}";
                    offset++;
                }
                suggested = candidate;
                usedIds.Add(suggested);
            }

            var (isEnrolled, lastPunchAt) = ResolveEnrollmentStatus(t.Id, t.BiometricUserId, t.EmployeeCode, punchByBioId, punchByTeacherId);

            teachers.Add(new BiometricMappingPersonDto(
                t.Id,
                "Teacher",
                t.FullName,
                t.EmployeeCode ?? "",
                t.BiometricUserId,
                null,
                null,
                null,
                null,
                suggested,
                isEnrolled,
                lastPunchAt
            ));
        }

        return Ok(students.Concat(teachers).OrderBy(x => x.Name));
    }

    [HttpGet("mappings/paged")]
    public async Task<ActionResult<BiometricMappingPagedResultDto>> GetPagedMappings(
        [FromQuery] string category = "all",       // "coaching" | "school" | "teacher" | "all"
        [FromQuery] string? searchName = null,
        [FromQuery] string? searchCode = null,
        [FromQuery] string? searchGroup = null,    // batchName, className, sectionName, or staff
        [FromQuery] string? mappingStatus = null,  // "all" | "mapped" | "unmapped"
        [FromQuery] string? sortBy = "name",       // "name" | "code" | "group" | "biometricId"
        [FromQuery] string? sortDir = "asc",       // "asc" | "desc"
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25
    )
    {
        if (!await HasPermissionAsync(MappingRoute, IMSERP.API.Services.MenuPermissionOperation.Edit)) return Forbid();

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 5, 200);

        var studentQuery = _db.Students.AsNoTracking()
            .Where(s => s.TenantId == _currentUser.TenantId && s.IsActive && !s.IsDeleted);
        if (_currentUser.BranchId.HasValue)
        {
            studentQuery = studentQuery.Where(s => s.BranchId == null || s.BranchId == _currentUser.BranchId);
        }

        var teacherQuery = _db.Teachers.AsNoTracking()
            .Where(t => t.TenantId == _currentUser.TenantId && t.IsActive);
        if (_currentUser.BranchId.HasValue)
        {
            teacherQuery = teacherQuery.Where(t => t.BranchId == null || t.BranchId == _currentUser.BranchId);
        }

        int coachingCount = await studentQuery.CountAsync(s => s.IsCoachingStudent || s.BatchId != null);
        int schoolCount = await studentQuery.CountAsync(s => s.IsSchoolStudent || s.ClassId != null);
        int teacherCount = await teacherQuery.CountAsync();

        var sUsed = await studentQuery.Where(s => !string.IsNullOrEmpty(s.BiometricUserId)).Select(s => s.BiometricUserId!).ToListAsync();
        var tUsed = await teacherQuery.Where(t => !string.IsNullOrEmpty(t.BiometricUserId)).Select(t => t.BiometricUserId!).ToListAsync();
        var usedIds = new HashSet<string>(sUsed.Concat(tUsed), StringComparer.OrdinalIgnoreCase);

        var cat = (category ?? "all").Trim().ToLowerInvariant();
        bool includeStudents = cat == "all" || cat == "school" || cat == "coaching";
        bool includeTeachers = cat == "all" || cat == "teacher";

        var (punchByBioId, punchByStudentId, punchByTeacherId) = await GetBiometricEnrollmentLookupAsync();

        var students = new List<BiometricMappingPersonDto>();
        if (includeStudents)
        {
            var sq = studentQuery;
            if (cat == "school")
            {
                sq = sq.Where(s => s.IsSchoolStudent || s.ClassId != null);
            }
            else if (cat == "coaching")
            {
                sq = sq.Where(s => s.IsCoachingStudent || s.BatchId != null);
            }

            var rawStudents = await sq
                .Include(s => s.Class)
                .Include(s => s.Section)
                .Include(s => s.Batch)
                .OrderBy(s => s.StudentName)
                .ToListAsync();

            var batches = rawStudents.Where(s => s.BatchId != null)
                .Select(s => s.Batch!)
                .DistinctBy(b => b.Id)
                .OrderBy(b => b.Name)
                .ToList();
            var batchIndexMap = batches.Select((b, idx) => new { b.Id, Index = idx + 1 }).ToDictionary(x => x.Id, x => x.Index);

            for (int idx = 0; idx < rawStudents.Count; idx++)
            {
                var s = rawStudents[idx];
                var roll = s.IsSchoolStudent && !string.IsNullOrEmpty(s.SchoolRollNumber)
                    ? s.SchoolRollNumber
                    : (!string.IsNullOrEmpty(s.CoachingRollNumber) ? s.CoachingRollNumber : s.RollNumber);
                var stream = s.IsSchoolStudent && s.IsCoachingStudent ? "Both" : (s.IsSchoolStudent ? "School" : "Coaching");

                string suggested = "";
                if (string.IsNullOrWhiteSpace(s.BiometricUserId))
                {
                    if (s.IsSchoolStudent)
                    {
                        int cCode = GetClassNumericCode(s.Class?.Name);
                        int rNum = ExtractNumericRoll(roll, idx + 1);
                        string candidate = $"{cCode}{rNum:D2}";
                        int offset = 1;
                        while (usedIds.Contains(candidate))
                        {
                            candidate = $"{cCode}{(rNum + offset):D2}";
                            offset++;
                        }
                        suggested = candidate;
                        usedIds.Add(suggested);
                    }
                    else if (s.IsCoachingStudent || s.BatchId != null)
                    {
                        int bIdx = s.BatchId != null && batchIndexMap.TryGetValue(s.BatchId.Value, out int bi) ? bi : 1;
                        int bPrefix = 80 + (bIdx % 10);
                        int rNum = ExtractNumericRoll(roll, idx + 1);
                        string candidate = $"{bPrefix}{rNum:D2}";
                        int offset = 1;
                        while (usedIds.Contains(candidate))
                        {
                            candidate = $"{bPrefix}{(rNum + offset):D2}";
                            offset++;
                        }
                        suggested = candidate;
                        usedIds.Add(suggested);
                    }
                }

                var (isEnrolled, lastPunchAt) = ResolveEnrollmentStatus(s.Id, s.BiometricUserId, roll, punchByBioId, punchByStudentId);

                students.Add(new BiometricMappingPersonDto(
                    s.Id,
                    "Student",
                    s.StudentName,
                    roll ?? "",
                    s.BiometricUserId,
                    s.Batch?.Name,
                    s.Class?.Name,
                    s.Section?.Name,
                    stream,
                    suggested,
                    isEnrolled,
                    lastPunchAt
                ));
            }
        }

        var teachers = new List<BiometricMappingPersonDto>();
        if (includeTeachers)
        {
            var rawTeachers = await teacherQuery
                .OrderBy(t => t.EmployeeCode)
                .ThenBy(t => t.FullName)
                .ToListAsync();

            for (int idx = 0; idx < rawTeachers.Count; idx++)
            {
                var t = rawTeachers[idx];
                string suggested = "";
                if (string.IsNullOrWhiteSpace(t.BiometricUserId))
                {
                    int empDigits = ExtractNumericRoll(t.EmployeeCode, idx + 1);
                    string candidate = (empDigits > 0 && empDigits < 1000) ? $"9{empDigits:D3}" : $"9{(idx + 1):D3}";
                    int offset = 1;
                    while (usedIds.Contains(candidate))
                    {
                        candidate = $"9{(idx + 1 + offset):D3}";
                        offset++;
                    }
                    suggested = candidate;
                    usedIds.Add(suggested);
                }

                var (isEnrolled, lastPunchAt) = ResolveEnrollmentStatus(t.Id, t.BiometricUserId, t.EmployeeCode, punchByBioId, punchByTeacherId);

                teachers.Add(new BiometricMappingPersonDto(
                    t.Id,
                    "Teacher",
                    t.FullName,
                    t.EmployeeCode ?? "",
                    t.BiometricUserId,
                    null,
                    null,
                    null,
                    null,
                    suggested,
                    isEnrolled,
                    lastPunchAt
                ));
            }
        }

        IEnumerable<BiometricMappingPersonDto> combined = students.Concat(teachers);

        if (!string.IsNullOrWhiteSpace(searchName))
        {
            var nameTerm = searchName.Trim().ToLowerInvariant();
            combined = combined.Where(x => x.Name != null && x.Name.ToLowerInvariant().Contains(nameTerm));
        }

        if (!string.IsNullOrWhiteSpace(searchCode))
        {
            var codeTerm = searchCode.Trim().ToLowerInvariant();
            combined = combined.Where(x => (x.Code ?? "").ToLowerInvariant().Contains(codeTerm));
        }

        if (!string.IsNullOrWhiteSpace(searchGroup))
        {
            var groupTerm = searchGroup.Trim().ToLowerInvariant();
            combined = combined.Where(x =>
                (x.BatchName ?? "").ToLowerInvariant().Contains(groupTerm) ||
                (x.ClassName ?? "").ToLowerInvariant().Contains(groupTerm) ||
                (x.SectionName ?? "").ToLowerInvariant().Contains(groupTerm) ||
                (x.PersonType == "Teacher" && "faculty staff teacher".Contains(groupTerm))
            );
        }

        if (!string.IsNullOrWhiteSpace(mappingStatus) && !mappingStatus.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            if (mappingStatus.Equals("mapped", StringComparison.OrdinalIgnoreCase))
            {
                combined = combined.Where(x => !string.IsNullOrEmpty(x.BiometricUserId));
            }
            else if (mappingStatus.Equals("unmapped", StringComparison.OrdinalIgnoreCase))
            {
                combined = combined.Where(x => string.IsNullOrEmpty(x.BiometricUserId));
            }
            else if (mappingStatus.Equals("enrolled", StringComparison.OrdinalIgnoreCase))
            {
                combined = combined.Where(x => x.IsThumbEnrolled);
            }
            else if (mappingStatus.Equals("pending_thumb", StringComparison.OrdinalIgnoreCase))
            {
                combined = combined.Where(x => !x.IsThumbEnrolled);
            }
        }

        var isDesc = string.Equals(sortDir, "desc", StringComparison.OrdinalIgnoreCase);
        var sortKey = (sortBy ?? "name").Trim().ToLowerInvariant();

        combined = (sortKey, isDesc) switch
        {
            ("name", false) => combined.OrderBy(x => x.Name),
            ("name", true) => combined.OrderByDescending(x => x.Name),
            ("code", false) => combined.OrderBy(x => x.Code),
            ("code", true) => combined.OrderByDescending(x => x.Code),
            ("group", false) => combined.OrderBy(x => x.BatchName ?? x.ClassName ?? (x.PersonType == "Teacher" ? "Staff" : "")),
            ("group", true) => combined.OrderByDescending(x => x.BatchName ?? x.ClassName ?? (x.PersonType == "Teacher" ? "Staff" : "")),
            ("biometricid", false) => combined.OrderBy(x => x.BiometricUserId ?? x.SuggestedBiometricId ?? "ZZZ"),
            ("biometricid", true) => combined.OrderByDescending(x => x.BiometricUserId ?? x.SuggestedBiometricId ?? ""),
            _ => isDesc ? combined.OrderByDescending(x => x.Name) : combined.OrderBy(x => x.Name)
        };

        var totalCount = combined.Count();
        var totalPages = pageSize > 0 ? (int)Math.Ceiling(totalCount / (double)pageSize) : 1;
        var pagedItems = combined.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return Ok(new BiometricMappingPagedResultDto(
            pagedItems,
            totalCount,
            page,
            pageSize,
            totalPages,
            coachingCount,
            schoolCount,
            teacherCount
        ));
    }

    [HttpPut("settings")]
    public async Task<ActionResult<AttendanceSettingsDto>> UpdateSettings([FromBody] AttendanceSettingsDto dto)
    {
        if (!await HasPermissionAsync(ModeSettingsRoute, IMSERP.API.Services.MenuPermissionOperation.Edit))
            return Forbid();

        if (!IsValidMode(dto.StudentMode) || !IsValidMode(dto.TeacherMode) || (!string.IsNullOrEmpty(dto.HostelMode) && !IsValidMode(dto.HostelMode)))
            return BadRequest(new { message = "Mode must be Manual, Biometric, or Both." });

        var settings = await _db.AttendanceSettings.FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);
        if (settings == null)
        {
            settings = new AttendanceSettings { TenantId = _currentUser.TenantId, BranchId = _currentUser.BranchId };
            _db.AttendanceSettings.Add(settings);
        }
        else if (!settings.BranchId.HasValue && _currentUser.BranchId.HasValue)
        {
            settings.BranchId = _currentUser.BranchId;
        }

        settings.StudentMode = dto.StudentMode;
        settings.TeacherMode = dto.TeacherMode;
        if (!string.IsNullOrWhiteSpace(dto.HostelMode))
        {
            settings.HostelMode = dto.HostelMode;
        }

        // Save dynamic shift & policy settings
        if (!string.IsNullOrWhiteSpace(dto.TeacherShiftStartTime)) settings.TeacherShiftStartTime = dto.TeacherShiftStartTime.Trim();
        if (!string.IsNullOrWhiteSpace(dto.TeacherShiftEndTime)) settings.TeacherShiftEndTime = dto.TeacherShiftEndTime.Trim();
        if (dto.TeacherGracePeriodMinutes >= 0) settings.TeacherGracePeriodMinutes = dto.TeacherGracePeriodMinutes;
        if (dto.TeacherHalfDayThresholdMinutes > 0) settings.TeacherHalfDayThresholdMinutes = dto.TeacherHalfDayThresholdMinutes;
        if (dto.TeacherAllowedLateDaysPerMonth >= 0) settings.TeacherAllowedLateDaysPerMonth = dto.TeacherAllowedLateDaysPerMonth;
        if (!string.IsNullOrWhiteSpace(dto.TeacherWeeklyOffPattern)) settings.TeacherWeeklyOffPattern = dto.TeacherWeeklyOffPattern.Trim();

        if (!string.IsNullOrWhiteSpace(dto.StudentShiftStartTime)) settings.StudentShiftStartTime = dto.StudentShiftStartTime.Trim();
        if (!string.IsNullOrWhiteSpace(dto.StudentShiftEndTime)) settings.StudentShiftEndTime = dto.StudentShiftEndTime.Trim();
        if (dto.StudentGracePeriodMinutes >= 0) settings.StudentGracePeriodMinutes = dto.StudentGracePeriodMinutes;
        if (dto.StudentHalfDayThresholdMinutes > 0) settings.StudentHalfDayThresholdMinutes = dto.StudentHalfDayThresholdMinutes;
        if (dto.StudentAllowedLateDaysPerMonth >= 0) settings.StudentAllowedLateDaysPerMonth = dto.StudentAllowedLateDaysPerMonth;
        if (!string.IsNullOrWhiteSpace(dto.StudentWeeklyOffPattern)) settings.StudentWeeklyOffPattern = dto.StudentWeeklyOffPattern.Trim();

        // Save dynamic student absence fine policy
        settings.EnableStudentAbsenceFine = dto.EnableStudentAbsenceFine;
        settings.AbsenceFineDaysThreshold = dto.AbsenceFineDaysThreshold > 0 ? dto.AbsenceFineDaysThreshold : 3;
        settings.AbsenceFineAmount = dto.AbsenceFineAmount >= 0 ? dto.AbsenceFineAmount : 10.00m;
        settings.AbsenceFineMode = !string.IsNullOrWhiteSpace(dto.AbsenceFineMode) ? dto.AbsenceFineMode.Trim() : "PerBlock";

        // Save dynamic coaching shift policy (Morning & Evening)
        if (!string.IsNullOrWhiteSpace(dto.CoachingMode)) settings.CoachingMode = dto.CoachingMode.Trim();
        if (!string.IsNullOrWhiteSpace(dto.CoachingWeeklyOffPattern)) settings.CoachingWeeklyOffPattern = dto.CoachingWeeklyOffPattern.Trim();
        if (!string.IsNullOrWhiteSpace(dto.CoachingMorningStartTime)) settings.CoachingMorningStartTime = dto.CoachingMorningStartTime.Trim();
        if (!string.IsNullOrWhiteSpace(dto.CoachingMorningEndTime)) settings.CoachingMorningEndTime = dto.CoachingMorningEndTime.Trim();
        if (dto.CoachingMorningGraceMinutes >= 0) settings.CoachingMorningGraceMinutes = dto.CoachingMorningGraceMinutes;
        if (!string.IsNullOrWhiteSpace(dto.CoachingEveningStartTime)) settings.CoachingEveningStartTime = dto.CoachingEveningStartTime.Trim();
        if (!string.IsNullOrWhiteSpace(dto.CoachingEveningEndTime)) settings.CoachingEveningEndTime = dto.CoachingEveningEndTime.Trim();
        if (dto.CoachingEveningGraceMinutes >= 0) settings.CoachingEveningGraceMinutes = dto.CoachingEveningGraceMinutes;

        settings.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new AttendanceSettingsDto(
            settings.StudentMode,
            settings.TeacherMode,
            settings.HostelMode,
            settings.TeacherShiftStartTime,
            settings.TeacherShiftEndTime,
            settings.TeacherGracePeriodMinutes,
            settings.TeacherHalfDayThresholdMinutes,
            settings.TeacherAllowedLateDaysPerMonth,
            settings.StudentShiftStartTime,
            settings.StudentShiftEndTime,
            settings.StudentGracePeriodMinutes,
            settings.StudentHalfDayThresholdMinutes,
            settings.StudentAllowedLateDaysPerMonth,
            settings.TeacherWeeklyOffPattern,
            settings.StudentWeeklyOffPattern,
            settings.EnableStudentAbsenceFine,
            settings.AbsenceFineDaysThreshold,
            settings.AbsenceFineAmount,
            settings.AbsenceFineMode,
            settings.CoachingMode,
            settings.CoachingWeeklyOffPattern,
            settings.CoachingMorningStartTime,
            settings.CoachingMorningEndTime,
            settings.CoachingMorningGraceMinutes,
            settings.CoachingEveningStartTime,
            settings.CoachingEveningEndTime,
            settings.CoachingEveningGraceMinutes
        ));
    }

    [HttpPost("biometric-events")]
    public async Task<IActionResult> ReceiveBiometricEvent([FromBody] BiometricAttendanceEventDto dto)
    {
        if (!await HasPermissionAsync(BiometricRoute, IMSERP.API.Services.MenuPermissionOperation.Create))
            return Forbid();

        if (string.IsNullOrWhiteSpace(dto.BiometricUserId) || dto.EventTime == default)
            return BadRequest(new { message = "BiometricUserId and EventTime are required." });

        var personType = dto.PersonType.Trim().ToLowerInvariant();
        var settings = await _db.AttendanceSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);
        var mode = personType == "student" ? settings?.StudentMode :
                   personType == "teacher" ? settings?.TeacherMode :
                   (personType == "hostel" || personType == "hostel_student") ? (settings?.HostelMode ?? "Both") : null;
        if (mode == null) return BadRequest(new { message = "PersonType must be Student, Teacher, or Hostel." });
        if (string.Equals(mode, "Manual", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { message = "Biometric attendance is disabled for this person type." });

        var eventLog = new BiometricEventLog
        {
            TenantId = _currentUser.TenantId,
            DeviceId = Guid.TryParse(dto.DeviceId, out var parsedDeviceId) ? parsedDeviceId : null,
            PersonType = personType,
            BiometricUserId = dto.BiometricUserId,
            EventTime = dto.EventTime,
            DeviceEventId = dto.EventId,
            Status = "Received"
        };
        _db.BiometricEventLogs.Add(eventLog);
        await _db.SaveChangesAsync();

        var indiaTime = TimeZoneInfo.ConvertTimeBySystemTimeZoneId(
            DateTime.SpecifyKind(dto.EventTime, DateTimeKind.Utc), "India Standard Time");

        if (personType == "student")
        {
            var student = await _db.Students.Include(s => s.Batch).FirstOrDefaultAsync(s => s.BiometricUserId == dto.BiometricUserId);
            if (student == null)
            {
                eventLog.Status = "Failed";
                eventLog.ErrorMessage = "No student is mapped to this biometric user ID.";
                await _db.SaveChangesAsync();
                return NotFound(new { message = eventLog.ErrorMessage });
            }

            var record = await _db.StudentAttendances.FirstOrDefaultAsync(a =>
                (dto.EventId != null && a.BiometricEventId == dto.EventId) ||
                (a.StudentId == student.Id && a.AttendanceDate == dto.EventTime.Date));
            if (record == null)
            {
                record = new StudentAttendance { TenantId = _currentUser.TenantId, BranchId = student.BranchId ?? _currentUser.BranchId, StudentId = student.Id, AttendanceDate = dto.EventTime.Date };
                _db.StudentAttendances.Add(record);
            }
            record.Status = TeacherAttendanceStatus.Present;
            record.CaptureSource = "Biometric";
            record.BiometricDeviceId = dto.DeviceId;
            record.BiometricEventId = dto.EventId;
            record.CapturedAt = dto.EventTime;
            record.MarkedBy = "biometric-device";
            if (dto.IsCheckOut)
            {
                record.CheckOutTime = indiaTime.ToString("HH:mm");
            }
            else
            {
                if (string.IsNullOrEmpty(record.CheckInTime))
                {
                    record.CheckInTime = indiaTime.ToString("HH:mm");
                }
                else if (string.IsNullOrEmpty(record.CheckOutTime))
                {
                    record.CheckOutTime = indiaTime.ToString("HH:mm");
                }
            }

            // Solution B: Smart attendance evaluation for student biometric punch
            string shiftScope = student.IsCoachingStudent && !student.IsSchoolStudent
                ? (student.Batch?.Shift ?? (indiaTime.Hour >= 12 ? "coaching_evening" : "coaching_morning"))
                : (student.IsSchoolStudent ? "school" : (student.Batch?.Shift ?? (indiaTime.Hour >= 12 ? "coaching_evening" : "coaching_morning")));

            record.Status = StudentsController.EvaluateStudentSmartAttendanceStatus(
                TeacherAttendanceStatus.Present,
                record.CheckInTime,
                record.CheckOutTime,
                settings,
                shiftScope,
                shiftScope != "school" ? student.Batch?.StartTime : null,
                shiftScope != "school" ? student.Batch?.EndTime : null);

            // If student had approved leave on this date, update remarks noting turnstile attendance
            var approvedStudentLeave = await _db.StudentLeaves.FirstOrDefaultAsync(l =>
                l.TenantId == _currentUser.TenantId &&
                l.StudentId == student.Id &&
                l.Status == "Approved" &&
                l.FromDate.Date <= dto.EventTime.Date &&
                l.ToDate.Date >= dto.EventTime.Date);
            if (approvedStudentLeave != null)
            {
                record.Remarks = $"Present via Biometric Gate/Turnstile. Sanctioned leave overridden by attendance punch.";
            }

            eventLog.Status = "Processed";
            eventLog.AttendanceId = record.Id;
            await _db.SaveChangesAsync();
            return Ok(new { message = "Student biometric attendance captured.", attendanceId = record.Id });
        }

        if (personType == "hostel" || personType == "hostel_student")
        {
            var student = await _db.Students
                .Include(s => s.HostelBed)
                    .ThenInclude(b => b.Room)
                .FirstOrDefaultAsync(s => s.BiometricUserId == dto.BiometricUserId);

            if (student == null)
            {
                eventLog.Status = "Failed";
                eventLog.ErrorMessage = "No student is mapped to this biometric user ID.";
                await _db.SaveChangesAsync();
                return NotFound(new { message = eventLog.ErrorMessage });
            }

            if (!student.IsHostelStudent || student.HostelBed?.Room?.HostelId == null)
            {
                eventLog.Status = "Failed";
                eventLog.ErrorMessage = "Student is not registered as an active hostel resident.";
                await _db.SaveChangesAsync();
                return BadRequest(new { message = eventLog.ErrorMessage });
            }

            var hostelId = student.HostelBed.Room.HostelId;
            var record = await _db.HostelAttendances.FirstOrDefaultAsync(a =>
                (dto.EventId != null && a.BiometricEventId == dto.EventId) ||
                (a.StudentId == student.Id && a.AttendanceDate == dto.EventTime.Date));

            if (record == null)
            {
                record = new HostelAttendance
                {
                    TenantId = _currentUser.TenantId,
                    BranchId = student.BranchId ?? _currentUser.BranchId,
                    StudentId = student.Id,
                    HostelId = hostelId,
                    AttendanceDate = dto.EventTime.Date,
                    RollCallShift = "Night"
                };
                _db.HostelAttendances.Add(record);
            }

            record.Status = "Present";
            record.CaptureSource = "Biometric";
            record.BiometricDeviceId = dto.DeviceId;
            record.BiometricEventId = dto.EventId;
            record.CapturedAt = dto.EventTime;
            record.PunchTime = indiaTime.ToString("HH:mm");
            record.MarkedBy = "biometric-turnstile";

            eventLog.Status = "Processed";
            eventLog.AttendanceId = record.Id;
            await _db.SaveChangesAsync();
            return Ok(new { message = "Hostel resident biometric attendance captured.", attendanceId = record.Id, student = student.StudentName });
        }

        var teacher = await _db.Teachers.FirstOrDefaultAsync(t => t.BiometricUserId == dto.BiometricUserId);
        if (teacher == null)
        {
            eventLog.Status = "Failed";
            eventLog.ErrorMessage = "No teacher is mapped to this biometric user ID.";
            await _db.SaveChangesAsync();
            return NotFound(new { message = eventLog.ErrorMessage });
        }

        var teacherRecord = await _db.TeacherAttendances.FirstOrDefaultAsync(a =>
            (dto.EventId != null && a.BiometricEventId == dto.EventId) ||
            (a.TeacherId == teacher.Id && a.AttendanceDate == dto.EventTime.Date));
        if (teacherRecord == null)
        {
            teacherRecord = new TeacherAttendance { TenantId = _currentUser.TenantId, BranchId = teacher.BranchId ?? _currentUser.BranchId, TeacherId = teacher.Id, AttendanceDate = dto.EventTime.Date };
            _db.TeacherAttendances.Add(teacherRecord);
        }

        teacherRecord.Status = TeacherAttendanceStatus.Present;
        teacherRecord.CaptureSource = "Biometric";
        teacherRecord.BiometricDeviceId = dto.DeviceId;
        teacherRecord.BiometricEventId = dto.EventId;
        teacherRecord.CapturedAt = dto.EventTime;
        teacherRecord.MarkedBy = "biometric-device";
        if (dto.IsCheckOut)
            teacherRecord.CheckOutTime = indiaTime.ToString("HH:mm");
        else
            teacherRecord.CheckInTime ??= indiaTime.ToString("HH:mm");

        // Solution B: Smart attendance evaluation for teacher biometric punch
        string teacherShiftScope = "school";
        if (indiaTime.Hour < 8 || indiaTime.Hour >= 16)
        {
            teacherShiftScope = indiaTime.Hour >= 12 ? "coaching_evening" : "coaching_morning";
        }
        teacherRecord.Status = TeachersController.EvaluateSmartAttendanceStatus(
            TeacherAttendanceStatus.Present,
            teacherRecord.CheckInTime,
            teacherRecord.CheckOutTime,
            settings,
            teacherShiftScope);

        // Biometric Conflict Resolution: Check if teacher had an approved leave on this date
        var approvedLeave = await _db.TeacherLeaves.FirstOrDefaultAsync(l =>
            l.TenantId == _currentUser.TenantId &&
            l.TeacherId == teacher.Id &&
            (l.Status == LeaveStatus.Approved || l.Status == LeaveStatus.PartiallyCancelled) &&
            l.FromDate.Date <= dto.EventTime.Date &&
            l.ToDate.Date >= dto.EventTime.Date &&
            !(l.IsCancellationApproved == true &&
              l.CancellationFromDate.HasValue && l.CancellationToDate.HasValue &&
              dto.EventTime.Date >= l.CancellationFromDate.Value.Date &&
              dto.EventTime.Date <= l.CancellationToDate.Value.Date));

        var policy = await _db.LeaveAndAttendancePolicies.AsNoTracking()
            .FirstOrDefaultAsync(p => p.TenantId == _currentUser.TenantId);
        bool autoCancelLeave = policy?.AutoCancelLeaveOnBiometricPunch ?? true;

        if (approvedLeave != null && autoCancelLeave)
        {
            approvedLeave.Status = LeaveStatus.OverriddenByPunch;
            teacherRecord.Remarks = $"Present via Biometric Punch. Sanctioned {approvedLeave.LeaveType} overridden and leave balance quota restored.";
        }

        await _db.SaveChangesAsync();
        eventLog.Status = "Processed";
        eventLog.AttendanceId = teacherRecord.Id;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Teacher biometric attendance captured.", attendanceId = teacherRecord.Id });
    }

    [HttpPut("mappings/{personType}/{personId:guid}")]
    public async Task<IActionResult> UpdateBiometricMapping(string personType, Guid personId, [FromBody] BiometricMappingDto dto)
    {
        if (!await HasPermissionAsync(MappingRoute, IMSERP.API.Services.MenuPermissionOperation.Edit))
            return Forbid();

        if (string.IsNullOrWhiteSpace(dto.BiometricUserId))
            return BadRequest(new { message = "BiometricUserId is required." });

        var trimmedId = dto.BiometricUserId.Trim();

        if (personType.Equals("student", StringComparison.OrdinalIgnoreCase))
        {
            var student = await _db.Students.FirstOrDefaultAsync(s => s.Id == personId && !s.IsDeleted);
            if (student == null) return NotFound(new { message = "Student not found." });

            var duplicateStudent = await _db.Students.AnyAsync(s => s.Id != personId && !s.IsDeleted && s.BiometricUserId == trimmedId);
            if (duplicateStudent)
            {
                return BadRequest(new { message = $"Biometric ID '{trimmedId}' is already assigned to another active student." });
            }

            var duplicateTeacher = await _db.Teachers.AnyAsync(t => t.IsActive && t.BiometricUserId == trimmedId);
            if (duplicateTeacher)
            {
                return BadRequest(new { message = $"Biometric ID '{trimmedId}' is already assigned to a staff/teacher member." });
            }

            student.BiometricUserId = trimmedId;
        }
        else if (personType.Equals("teacher", StringComparison.OrdinalIgnoreCase))
        {
            var teacher = await _db.Teachers.FirstOrDefaultAsync(t => t.Id == personId && t.IsActive);
            if (teacher == null) return NotFound(new { message = "Teacher not found." });

            var duplicateTeacher = await _db.Teachers.AnyAsync(t => t.Id != personId && t.IsActive && t.BiometricUserId == trimmedId);
            if (duplicateTeacher)
            {
                return BadRequest(new { message = $"Biometric ID '{trimmedId}' is already assigned to another teacher." });
            }

            var duplicateStudent = await _db.Students.AnyAsync(s => !s.IsDeleted && s.BiometricUserId == trimmedId);
            if (duplicateStudent)
            {
                return BadRequest(new { message = $"Biometric ID '{trimmedId}' is already assigned to a student." });
            }

            teacher.BiometricUserId = trimmedId;
        }
        else
        {
            return BadRequest(new { message = "PersonType must be Student or Teacher." });
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }

    public record ToggleThumbEnrollmentRequest(bool Enrolled, string? BiometricUserId = null);

    [HttpPost("mappings/{personType}/{personId:guid}/toggle-thumb")]
    public async Task<IActionResult> ToggleThumbEnrollment(string personType, Guid personId, [FromBody] ToggleThumbEnrollmentRequest dto)
    {
        if (!await HasPermissionAsync(MappingRoute, IMSERP.API.Services.MenuPermissionOperation.Edit))
            return Forbid();

        string? bioId = dto.BiometricUserId?.Trim();
        string personName = "";

        if (personType.Equals("student", StringComparison.OrdinalIgnoreCase))
        {
            var student = await _db.Students.FirstOrDefaultAsync(s => s.Id == personId && !s.IsDeleted);
            if (student == null) return NotFound(new { message = "Student not found." });

            personName = student.StudentName;
            if (string.IsNullOrWhiteSpace(student.BiometricUserId) && !string.IsNullOrWhiteSpace(bioId))
            {
                var dupS = await _db.Students.AnyAsync(s => s.Id != personId && !s.IsDeleted && s.BiometricUserId == bioId);
                var dupT = await _db.Teachers.AnyAsync(t => t.IsActive && t.BiometricUserId == bioId);
                if (!dupS && !dupT)
                {
                    student.BiometricUserId = bioId;
                }
            }
            bioId = !string.IsNullOrWhiteSpace(student.BiometricUserId) ? student.BiometricUserId.Trim() : bioId;
        }
        else if (personType.Equals("teacher", StringComparison.OrdinalIgnoreCase))
        {
            var teacher = await _db.Teachers.FirstOrDefaultAsync(t => t.Id == personId && t.IsActive);
            if (teacher == null) return NotFound(new { message = "Teacher not found." });

            personName = teacher.FullName;
            if (string.IsNullOrWhiteSpace(teacher.BiometricUserId) && !string.IsNullOrWhiteSpace(bioId))
            {
                var dupT = await _db.Teachers.AnyAsync(t => t.Id != personId && t.IsActive && t.BiometricUserId == bioId);
                var dupS = await _db.Students.AnyAsync(s => !s.IsDeleted && s.BiometricUserId == bioId);
                if (!dupT && !dupS)
                {
                    teacher.BiometricUserId = bioId;
                }
            }
            bioId = !string.IsNullOrWhiteSpace(teacher.BiometricUserId) ? teacher.BiometricUserId.Trim() : bioId;
        }
        else
        {
            return BadRequest(new { message = "PersonType must be Student or Teacher." });
        }

        if (string.IsNullOrWhiteSpace(bioId))
        {
            return BadRequest(new { message = "Please assign a Biometric Device ID first before marking thumb enrollment." });
        }

        var existingManualLogs = await _db.BiometricEventLogs
            .Where(e => e.TenantId == _currentUser.TenantId &&
                        e.BiometricUserId == bioId &&
                        e.DeviceEventId == "THUMB-ENROLLED")
            .ToListAsync();

        if (dto.Enrolled)
        {
            if (existingManualLogs.Count == 0)
            {
                _db.BiometricEventLogs.Add(new BiometricEventLog
                {
                    TenantId = _currentUser.TenantId,
                    PersonType = personType.ToLowerInvariant(),
                    BiometricUserId = bioId,
                    EventTime = DateTime.UtcNow,
                    DeviceEventId = "THUMB-ENROLLED",
                    Status = "Enrolled",
                    ErrorMessage = $"Thumb enrollment verified for {personName}"
                });
            }
        }
        else
        {
            if (existingManualLogs.Count > 0)
            {
                _db.BiometricEventLogs.RemoveRange(existingManualLogs);
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            enrolled = dto.Enrolled,
            biometricUserId = bioId,
            lastBiometricPunchAt = dto.Enrolled ? DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc) : (DateTime?)null
        });
    }

    private async Task<(Dictionary<string, DateTime> ByBioId, Dictionary<Guid, DateTime> ByStudentId, Dictionary<Guid, DateTime> ByTeacherId)> GetBiometricEnrollmentLookupAsync()
    {
        var eventLogs = await _db.BiometricEventLogs.AsNoTracking()
            .Where(e => e.TenantId == _currentUser.TenantId &&
                        !string.IsNullOrEmpty(e.BiometricUserId) &&
                        e.Status != "Unmapped")
            .Select(e => new { e.BiometricUserId, e.EventTime })
            .ToListAsync();

        var byBioId = new Dictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        foreach (var log in eventLogs)
        {
            var key = log.BiometricUserId.Trim();
            var utcTime = DateTime.SpecifyKind(log.EventTime, DateTimeKind.Utc);
            if (!byBioId.TryGetValue(key, out var existing) || utcTime > existing)
            {
                byBioId[key] = utcTime;
            }
        }

        var studentPunches = await _db.StudentAttendances.AsNoTracking()
            .Where(a => a.TenantId == _currentUser.TenantId &&
                        (a.MarkedBy == "biometric-hikvision" ||
                         (a.CaptureSource != null && (a.CaptureSource.Contains("Hikvision") || a.CaptureSource.Contains("Biometric")))))
            .GroupBy(a => a.StudentId)
            .Select(g => new { StudentId = g.Key, LastAt = g.Max(x => x.CapturedAt ?? x.AttendanceDate) })
            .ToListAsync();

        var byStudentId = studentPunches.ToDictionary(
            x => x.StudentId,
            x => DateTime.SpecifyKind(x.LastAt, DateTimeKind.Utc));

        var teacherPunches = await _db.TeacherAttendances.AsNoTracking()
            .Where(a => a.TenantId == _currentUser.TenantId &&
                        (a.MarkedBy == "biometric-hikvision" ||
                         (a.CaptureSource != null && (a.CaptureSource.Contains("Hikvision") || a.CaptureSource.Contains("Biometric")))))
            .GroupBy(a => a.TeacherId)
            .Select(g => new { TeacherId = g.Key, LastAt = g.Max(x => x.CapturedAt ?? x.AttendanceDate) })
            .ToListAsync();

        var byTeacherId = teacherPunches.ToDictionary(
            x => x.TeacherId,
            x => DateTime.SpecifyKind(x.LastAt, DateTimeKind.Utc));

        return (byBioId, byStudentId, byTeacherId);
    }

    private static (bool IsEnrolled, DateTime? LastPunchAt) ResolveEnrollmentStatus(
        Guid personId,
        string? biometricUserId,
        string? code,
        Dictionary<string, DateTime> byBioId,
        Dictionary<Guid, DateTime> byPersonId)
    {
        DateTime? latest = null;

        if (!string.IsNullOrWhiteSpace(biometricUserId) && byBioId.TryGetValue(biometricUserId.Trim(), out var dtBio))
        {
            latest = dtBio;
        }
        if (!string.IsNullOrWhiteSpace(code) && byBioId.TryGetValue(code.Trim(), out var dtCode))
        {
            if (!latest.HasValue || dtCode > latest.Value)
                latest = dtCode;
        }
        if (byPersonId.TryGetValue(personId, out var dtPerson))
        {
            if (!latest.HasValue || dtPerson > latest.Value)
                latest = dtPerson;
        }

        return (latest.HasValue, latest);
    }

    [HttpPost("mappings/enroll-admin")]
    public async Task<IActionResult> EnrollAdminAsStaff()
    {
        if (!await HasPermissionAsync(MappingRoute, IMSERP.API.Services.MenuPermissionOperation.Edit))
            return Forbid();

        var userId = _currentUser.UserId;
        if (userId == Guid.Empty)
            return Unauthorized(new { message = "User session expired or not authenticated." });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.TenantId == _currentUser.TenantId);
        if (user == null)
            return NotFound(new { message = "Administrator user account not found." });

        // Check if an employee record is already linked to this User or has same phone
        var existingStaff = await _db.Teachers.FirstOrDefaultAsync(t => t.TenantId == _currentUser.TenantId && (t.UserId == user.Id || (!string.IsNullOrEmpty(user.PhoneNumber) && t.PhoneNumber == user.PhoneNumber)));

        if (existingStaff != null)
        {
            existingStaff.UserId = user.Id;
            existingStaff.IsActive = true;
            if (string.IsNullOrWhiteSpace(existingStaff.BiometricUserId))
            {
                var used = await _db.Teachers.Where(t => t.TenantId == _currentUser.TenantId && !string.IsNullOrEmpty(t.BiometricUserId)).Select(t => t.BiometricUserId!).ToHashSetAsync();
                var sUsed = await _db.Students.Where(s => s.TenantId == _currentUser.TenantId && !string.IsNullOrEmpty(s.BiometricUserId)).Select(s => s.BiometricUserId!).ToListAsync();
                foreach (var s in sUsed) used.Add(s);
                int num = 9001;
                while (used.Contains(num.ToString())) num++;
                existingStaff.BiometricUserId = num.ToString();
            }
            await _db.SaveChangesAsync();
            return Ok(new { 
                message = $"{user.FullName} is already linked as Staff ({existingStaff.Designation}) with Biometric Device ID {existingStaff.BiometricUserId}.",
                personId = existingStaff.Id,
                biometricUserId = existingStaff.BiometricUserId
            });
        }

        // Generate next Employee Code
        var teacherCount = await _db.Teachers.CountAsync(t => t.TenantId == _currentUser.TenantId);
        var empCode = $"ADM-{(teacherCount + 1):D3}";

        // Generate unique BiometricUserId starting at 9001
        var allUsed = await _db.Teachers.Where(t => t.TenantId == _currentUser.TenantId && !string.IsNullOrEmpty(t.BiometricUserId)).Select(t => t.BiometricUserId!).ToHashSetAsync();
        var allStudentUsed = await _db.Students.Where(s => s.TenantId == _currentUser.TenantId && !string.IsNullOrEmpty(s.BiometricUserId)).Select(s => s.BiometricUserId!).ToListAsync();
        foreach (var s in allStudentUsed) allUsed.Add(s);

        int candidateNum = 9001;
        while (allUsed.Contains(candidateNum.ToString())) candidateNum++;
        string bioId = candidateNum.ToString();

        var phone = !string.IsNullOrWhiteSpace(user.PhoneNumber) ? user.PhoneNumber.Trim() : "9999999999";
        if (await _db.Teachers.AnyAsync(t => t.TenantId == _currentUser.TenantId && t.PhoneNumber == phone))
        {
            phone = "9" + new Random().Next(100000000, 999999999).ToString();
        }

        var newStaff = new Teacher
        {
            Id = Guid.NewGuid(),
            TenantId = _currentUser.TenantId,
            BranchId = user.BranchId ?? _currentUser.BranchId,
            UserId = user.Id,
            EmployeeCode = empCode,
            FullName = !string.IsNullOrWhiteSpace(user.FullName) ? user.FullName.Trim() : "Administrator",
            PhoneNumber = phone,
            Email = user.Email?.Trim(),
            Designation = "Principal / Administrator",
            Department = "Administration & Management",
            StaffType = StaffType.NonTeaching,
            Gender = Gender.Male,
            JoiningDate = DateTime.UtcNow,
            IsActive = true,
            BiometricUserId = bioId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Teachers.Add(newStaff);
        await _db.SaveChangesAsync();

        return Ok(new { 
            message = $"Successfully enrolled {newStaff.FullName} (Principal / Administrator) as Staff with Biometric Device ID {bioId}.",
            personId = newStaff.Id,
            biometricUserId = bioId
        });
    }

    public record AutoGenerateMappingRequest(string? Category = "all", bool OverwriteExisting = false);

    [HttpPost("mappings/auto-generate")]
    public async Task<IActionResult> AutoGenerateBiometricMappings([FromBody] AutoGenerateMappingRequest? request)
    {
        if (!await HasPermissionAsync(MappingRoute, IMSERP.API.Services.MenuPermissionOperation.Edit))
            return Forbid();

        var category = (request?.Category ?? "all").Trim().ToLowerInvariant();
        var overwrite = request?.OverwriteExisting ?? false;
        int updatedCount = 0;

        // Track all used IDs across both students and teachers (only active and non-deleted)
        var usedIds = await _db.Students
            .Where(s => !s.IsDeleted && !string.IsNullOrEmpty(s.BiometricUserId))
            .Select(s => s.BiometricUserId!)
            .ToHashSetAsync();

        var teacherUsedIds = await _db.Teachers
            .Where(t => t.IsActive && !string.IsNullOrEmpty(t.BiometricUserId))
            .Select(t => t.BiometricUserId!)
            .ToHashSetAsync();

        foreach (var tid in teacherUsedIds)
        {
            usedIds.Add(tid);
        }

        if (overwrite)
        {
            if (category == "all")
            {
                usedIds.Clear();
            }
            else if (category == "teacher")
            {
                foreach (var tid in teacherUsedIds) usedIds.Remove(tid);
            }
            else
            {
                usedIds.RemoveWhere(id => !teacherUsedIds.Contains(id));
            }
        }

        // 1. School Students
        if (category == "all" || category == "school")
        {
            var schoolStudents = await _db.Students
                .Include(s => s.Class)
                .Where(s => !s.IsDeleted && s.IsActive && s.IsSchoolStudent && (overwrite || string.IsNullOrEmpty(s.BiometricUserId)))
                .ToListAsync();

            foreach (var group in schoolStudents.GroupBy(s => s.ClassId))
            {
                var sample = group.FirstOrDefault();
                int classCode = GetClassNumericCode(sample?.Class?.Name);
                int seq = 1;
                foreach (var student in group.OrderBy(s => ExtractNumericRoll(s.SchoolRollNumber ?? s.RollNumber, seq)))
                {
                    int rollNum = ExtractNumericRoll(student.SchoolRollNumber ?? student.RollNumber, seq++);
                    string candidate = $"{classCode}{rollNum:D2}";
                    int offset = 1;
                    while (usedIds.Contains(candidate))
                    {
                        candidate = $"{classCode}{(rollNum + offset):D2}";
                        offset++;
                    }
                    usedIds.Add(candidate);
                    student.BiometricUserId = candidate;
                    updatedCount++;
                }
            }
        }

        // 2. Coaching Students
        if (category == "all" || category == "coaching")
        {
            var coachingStudents = await _db.Students
                .Include(s => s.Batch)
                .Where(s => !s.IsDeleted && s.IsActive && (s.IsCoachingStudent || s.BatchId != null) && (overwrite || string.IsNullOrEmpty(s.BiometricUserId)))
                .ToListAsync();

            var batches = coachingStudents.Where(s => s.BatchId != null)
                .Select(s => s.Batch!)
                .DistinctBy(b => b.Id)
                .OrderBy(b => b.Name)
                .ToList();
            var batchIndexMap = batches.Select((b, idx) => new { b.Id, Index = idx + 1 }).ToDictionary(x => x.Id, x => x.Index);

            foreach (var group in coachingStudents.GroupBy(s => s.BatchId))
            {
                int bIdx = group.Key != null && batchIndexMap.TryGetValue(group.Key.Value, out int bi) ? bi : 1;
                int batchPrefix = 80 + (bIdx % 10);
                int seq = 1;
                foreach (var student in group.OrderBy(s => ExtractNumericRoll(s.CoachingRollNumber ?? s.RollNumber, seq)))
                {
                    int rollNum = ExtractNumericRoll(student.CoachingRollNumber ?? student.RollNumber, seq++);
                    string candidate = $"{batchPrefix}{rollNum:D2}";
                    int offset = 1;
                    while (usedIds.Contains(candidate))
                    {
                        candidate = $"{batchPrefix}{(rollNum + offset):D2}";
                        offset++;
                    }
                    usedIds.Add(candidate);
                    student.BiometricUserId = candidate;
                    updatedCount++;
                }
            }
        }

        // 3. Teachers & Faculty
        if (category == "all" || category == "teacher")
        {
            var teachers = await _db.Teachers
                .Where(t => t.IsActive && (overwrite || string.IsNullOrEmpty(t.BiometricUserId)))
                .OrderBy(t => t.EmployeeCode)
                .ThenBy(t => t.FullName)
                .ToListAsync();

            int tSeq = 1;
            foreach (var teacher in teachers)
            {
                int empDigits = ExtractNumericRoll(teacher.EmployeeCode, tSeq);
                string candidate = (empDigits > 0 && empDigits < 1000) ? $"9{empDigits:D3}" : $"9{tSeq:D3}";
                int offset = 1;
                while (usedIds.Contains(candidate))
                {
                    candidate = $"9{(tSeq + offset):D3}";
                    offset++;
                }
                usedIds.Add(candidate);
                teacher.BiometricUserId = candidate;
                tSeq++;
                updatedCount++;
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = $"Successfully generated and saved biometric device IDs for {updatedCount} person(s).", updatedCount });
    }

    private static int GetClassNumericCode(string? className)
    {
        if (string.IsNullOrWhiteSpace(className)) return 20;
        var name = className.Trim().ToLowerInvariant();
        if (name.Contains("play")) return 10;
        if (name.Contains("nursery") || name.Contains("nur")) return 11;
        if (name.Contains("lkg") || name.Contains("l.k.g") || name.Contains("lower")) return 12;
        if (name.Contains("ukg") || name.Contains("u.k.g") || name.Contains("upper") || name.Contains("kg")) return 13;

        // Matches 1st, 2nd, 3rd, 4th, 5th, 10th, or pure digits 1, 2, 3...
        var match = System.Text.RegularExpressions.Regex.Match(name, @"(\d{1,2})");
        if (match.Success && int.TryParse(match.Groups[1].Value, out int grade))
        {
            return 20 + grade; // 1st -> 21, 2nd -> 22, 5th -> 25, 10th -> 30
        }
        return 20;
    }

    private static int ExtractNumericRoll(string? rollStr, int fallback)
    {
        if (string.IsNullOrWhiteSpace(rollStr)) return fallback;
        var match = System.Text.RegularExpressions.Regex.Match(rollStr, @"(\d+)");
        if (match.Success && int.TryParse(match.Groups[1].Value, out int num))
        {
            return num;
        }
        return fallback;
    }

    [HttpPost("biometric-events/{eventId:guid}/retry")]
    public async Task<IActionResult> RetryBiometricEvent(Guid eventId)
    {
        if (!await HasPermissionAsync(BiometricRoute, IMSERP.API.Services.MenuPermissionOperation.Create)) return Forbid();
        var failed = await _db.BiometricEventLogs.FirstOrDefaultAsync(e => e.Id == eventId);
        if (failed == null) return NotFound(new { message = "Biometric event not found." });
        if (!string.Equals(failed.Status, "Failed", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { message = "Only failed biometric events can be retried." });
        var request = new BiometricAttendanceEventDto(failed.PersonType, failed.BiometricUserId, failed.EventTime,
            failed.DeviceId?.ToString(), $"{failed.DeviceEventId}-RETRY-{DateTime.UtcNow.Ticks}");
        return await ReceiveBiometricEvent(request);
    }

    /// <summary>
    /// Direct ISAPI / HTTP Push webhook for Hikvision DS-K1A802AEF (and any biometric + RFID device).
    /// Receives real-time fingerprint and RFID card events over LAN/WAN without requiring a user JWT token.
    /// </summary>
    [HttpPost("biometric/hikvision")]
    [HttpPost("biometric/push")]
    [AllowAnonymous]
    public async Task<IActionResult> ReceiveHikvisionPushEvent(
        [FromQuery] Guid? tenantId,
        [FromQuery] string? serialNumber)
    {
        var webhookKey = _configuration["Biometric:WebhookKey"];
        var suppliedWebhookKey = Request.Headers["X-Biometric-Webhook-Key"].ToString();
        if (string.IsNullOrWhiteSpace(webhookKey) || System.Text.Encoding.UTF8.GetByteCount(webhookKey) < 32)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Biometric webhook authentication is not configured." });
        }

        if (!System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(webhookKey),
                System.Text.Encoding.UTF8.GetBytes(suppliedWebhookKey)))
        {
            return Unauthorized();
        }

        string? employeeNo = null;
        string? cardNo = null;
        string? serialNo = serialNumber;
        DateTime eventTime = DateTime.UtcNow;
        string rawBody = string.Empty;

        if (Request.HasFormContentType)
        {
            try
            {
                var form = await Request.ReadFormAsync();
                rawBody = form["event_log"].FirstOrDefault()
                    ?? form["AccessControllerEvent"].FirstOrDefault()
                    ?? form.FirstOrDefault().Value.FirstOrDefault()
                    ?? string.Empty;

                if (string.IsNullOrWhiteSpace(employeeNo))
                    employeeNo = form["employeeNo"].FirstOrDefault() ?? form["employeeNoString"].FirstOrDefault() ?? form["userId"].FirstOrDefault();
                if (string.IsNullOrWhiteSpace(cardNo))
                    cardNo = form["cardNo"].FirstOrDefault();
                if (string.IsNullOrWhiteSpace(serialNo))
                    serialNo = form["serialNo"].FirstOrDefault() ?? form["serialNumber"].FirstOrDefault();
            }
            catch { }
        }

        if (string.IsNullOrWhiteSpace(rawBody))
        {
            try
            {
                Request.EnableBuffering();
                if (Request.Body.CanSeek) Request.Body.Position = 0;
                using var reader = new System.IO.StreamReader(Request.Body, System.Text.Encoding.UTF8, leaveOpen: true);
                rawBody = await reader.ReadToEndAsync();
            }
            catch { }
        }

        rawBody = rawBody?.Trim('\uFEFF', ' ', '\r', '\n', '\t') ?? string.Empty;

        if (string.IsNullOrWhiteSpace(rawBody) && Request.Query.Count == 0 && string.IsNullOrWhiteSpace(employeeNo) && string.IsNullOrWhiteSpace(cardNo))
        {
            return Ok(new { message = "Heartbeat received. Endpoint ready for Hikvision ISAPI events." });
        }

        if (!string.IsNullOrWhiteSpace(rawBody))
        {
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(rawBody);
                var root = doc.RootElement;

                string? GetVal(System.Text.Json.JsonElement elem, string prop)
                {
                    if (elem.TryGetProperty(prop, out var v))
                    {
                        return v.ValueKind switch
                        {
                            System.Text.Json.JsonValueKind.String => v.GetString(),
                            System.Text.Json.JsonValueKind.Number => v.GetRawText(),
                            _ => null
                        };
                    }
                    return null;
                }

                if (root.TryGetProperty("AccessControllerEvent", out var acs))
                {
                    employeeNo = GetVal(acs, "employeeNoString") ?? GetVal(acs, "employeeNo");
                    cardNo = GetVal(acs, "cardNo");
                    serialNo ??= GetVal(acs, "serialNo") ?? GetVal(acs, "serialNumber");
                }

                employeeNo ??= GetVal(root, "employeeNoString") ?? GetVal(root, "employeeNo") ?? GetVal(root, "userId");
                cardNo ??= GetVal(root, "cardNo");
                serialNo ??= GetVal(root, "serialNumber") ?? GetVal(root, "serialNo");

                if (root.TryGetProperty("dateTime", out var dt) && dt.TryGetDateTime(out var parsedDt)) eventTime = parsedDt;
                else if (root.TryGetProperty("eventTime", out var et) && et.TryGetDateTime(out var parsedEt)) eventTime = parsedEt;
            }
            catch
            {
                // Fallback: Regex for JSON
                var jsonEmp = System.Text.RegularExpressions.Regex.Match(rawBody, @"""employeeNo(?:String)?""\s*:\s*""?([^"",}\s]+)""?", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (jsonEmp.Success) employeeNo = jsonEmp.Groups[1].Value.Trim();

                var jsonCard = System.Text.RegularExpressions.Regex.Match(rawBody, @"""cardNo""\s*:\s*""?([^"",}\s]+)""?", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (jsonCard.Success) cardNo = jsonCard.Groups[1].Value.Trim();

                var jsonSerial = System.Text.RegularExpressions.Regex.Match(rawBody, @"""serialNo(?:String|Number)?""\s*:\s*""?([^"",}\s]+)""?", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (jsonSerial.Success) serialNo ??= jsonSerial.Groups[1].Value.Trim();

                // Fallback: Regex for XML
                var empMatch = System.Text.RegularExpressions.Regex.Match(rawBody, @"<employeeNo(?:String)?>([^<]+)</employeeNo(?:String)?>", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (empMatch.Success) employeeNo ??= empMatch.Groups[1].Value.Trim();

                var cardMatch = System.Text.RegularExpressions.Regex.Match(rawBody, @"<cardNo>([^<]+)</cardNo>", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (cardMatch.Success) cardNo ??= cardMatch.Groups[1].Value.Trim();

                var serialMatch = System.Text.RegularExpressions.Regex.Match(rawBody, @"<serialNo(?:String)?>([^<]+)</serialNo(?:String)?>", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (serialMatch.Success) serialNo ??= serialMatch.Groups[1].Value.Trim();

                var timeMatch = System.Text.RegularExpressions.Regex.Match(rawBody, @"<dateTime>([^<]+)</dateTime>", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (timeMatch.Success && DateTime.TryParse(timeMatch.Groups[1].Value.Trim(), out var parsedXmlTime)) eventTime = parsedXmlTime;
            }
        }

        if (Request.HasFormContentType)
        {
            employeeNo ??= Request.Form["employeeNo"].FirstOrDefault() ?? Request.Form["employeeNoString"].FirstOrDefault() ?? Request.Form["userId"].FirstOrDefault();
            cardNo ??= Request.Form["cardNo"].FirstOrDefault();
            serialNo ??= Request.Form["serialNo"].FirstOrDefault() ?? Request.Form["serialNumber"].FirstOrDefault();
        }

        employeeNo ??= Request.Query["employeeNo"].FirstOrDefault() ?? Request.Query["employeeNoString"].FirstOrDefault() ?? Request.Query["userId"].FirstOrDefault();
        cardNo ??= Request.Query["cardNo"].FirstOrDefault();
        serialNo ??= Request.Query["serialNo"].FirstOrDefault() ?? Request.Query["serialNumber"].FirstOrDefault();

        var punchId = !string.IsNullOrWhiteSpace(employeeNo) ? employeeNo.Trim() : cardNo?.Trim();
        if (string.IsNullOrWhiteSpace(punchId))
        {
            return Ok(new { message = "Heartbeat or non-punch event received. No employeeNo or cardNo detected." });
        }

        if (string.IsNullOrWhiteSpace(serialNo))
        {
            return BadRequest(new { message = "A registered biometric device serial number is required." });
        }

        var matchedDevice = await _db.BiometricDevices.IgnoreQueryFilters()
            .FirstOrDefaultAsync(d => d.SerialNumber == serialNo.Trim() && d.IsActive);
        if (matchedDevice == null || (tenantId.HasValue && tenantId.Value != matchedDevice.TenantId))
        {
            return Unauthorized();
        }

        HttpContext.Items["TrustedTenantWrite"] = true;

        var resolvedTenantId = matchedDevice.TenantId;
        Guid? resolvedBranchId = matchedDevice.BranchId;
        matchedDevice.LastSeenAt = DateTime.UtcNow;
        matchedDevice.LastSyncAt = DateTime.UtcNow;
        matchedDevice.Status = "Online";

        var indiaTime = TimeZoneInfo.ConvertTimeBySystemTimeZoneId(
            DateTime.SpecifyKind(eventTime, DateTimeKind.Utc), "India Standard Time");

        var eventLog = new BiometricEventLog
        {
            TenantId = resolvedTenantId,
            PersonType = "Auto",
            BiometricUserId = punchId,
            EventTime = eventTime,
            DeviceEventId = $"HIK-{DateTime.UtcNow.Ticks}",
            Status = "Received"
        };
        _db.BiometricEventLogs.Add(eventLog);

        var settings = await _db.AttendanceSettings.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(s => s.TenantId == resolvedTenantId);

        // Check Student first (by Biometric ID, Admission No, Roll No, Coaching Roll No, or RFID Card No)
        var student = await _db.Students.IgnoreQueryFilters()
            .Include(s => s.Batch)
            .FirstOrDefaultAsync(s => s.TenantId == resolvedTenantId &&
                (s.BiometricUserId == punchId ||
                 s.AdmissionNumber == punchId ||
                 s.RollNumber == punchId ||
                 s.CoachingRollNumber == punchId ||
                 s.SchoolRollNumber == punchId ||
                 (cardNo != null && (s.BiometricUserId == cardNo || s.LibraryCardNumber == cardNo))));

        if (student != null)
        {
            eventLog.PersonType = "student";
            var record = await _db.StudentAttendances.IgnoreQueryFilters().FirstOrDefaultAsync(a =>
                a.TenantId == resolvedTenantId && a.StudentId == student.Id && a.AttendanceDate == eventTime.Date);

            if (record == null)
            {
                record = new StudentAttendance
                {
                    TenantId = resolvedTenantId,
                    BranchId = student.BranchId ?? resolvedBranchId,
                    StudentId = student.Id,
                    AttendanceDate = eventTime.Date,
                    CheckInTime = indiaTime.ToString("HH:mm"),
                    Status = TeacherAttendanceStatus.Present,
                    CaptureSource = "Hikvision DS-K1A802AEF",
                    MarkedBy = "biometric-hikvision",
                    CapturedAt = eventTime
                };
                _db.StudentAttendances.Add(record);
            }
            else
            {
                record.Status = TeacherAttendanceStatus.Present;
                if (string.IsNullOrEmpty(record.CheckInTime))
                {
                    record.CheckInTime = indiaTime.ToString("HH:mm");
                }
                else
                {
                    record.CheckOutTime = indiaTime.ToString("HH:mm");
                }
                record.CaptureSource = "Hikvision DS-K1A802AEF";
                record.CapturedAt = eventTime;
            }

            // Solution B: Smart attendance evaluation for student Hikvision punch
            string shiftScope = student.IsCoachingStudent && !student.IsSchoolStudent
                ? (student.Batch?.Shift ?? (indiaTime.Hour >= 12 ? "coaching_evening" : "coaching_morning"))
                : (student.IsSchoolStudent ? "school" : (student.Batch?.Shift ?? (indiaTime.Hour >= 12 ? "coaching_evening" : "coaching_morning")));

            record.Status = StudentsController.EvaluateStudentSmartAttendanceStatus(
                TeacherAttendanceStatus.Present,
                record.CheckInTime,
                record.CheckOutTime,
                settings,
                shiftScope,
                shiftScope != "school" ? student.Batch?.StartTime : null,
                shiftScope != "school" ? student.Batch?.EndTime : null);

            eventLog.Status = "Processed";
            eventLog.AttendanceId = record.Id;
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "Student attendance recorded successfully via Hikvision punch.",
                student = student.StudentName,
                checkIn = record.CheckInTime,
                checkOut = record.CheckOutTime
            });
        }

        // Check Teacher next (by Biometric ID, Employee Code, or RFID Card No)
        var teacher = await _db.Teachers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.TenantId == resolvedTenantId &&
                (t.BiometricUserId == punchId ||
                 t.EmployeeCode == punchId ||
                 (cardNo != null && t.BiometricUserId == cardNo)));

        if (teacher != null)
        {
            eventLog.PersonType = "teacher";
            var record = await _db.TeacherAttendances.IgnoreQueryFilters().FirstOrDefaultAsync(a =>
                a.TenantId == resolvedTenantId && a.TeacherId == teacher.Id && a.AttendanceDate == eventTime.Date);

            if (record == null)
            {
                record = new TeacherAttendance
                {
                    TenantId = resolvedTenantId,
                    BranchId = teacher.BranchId ?? resolvedBranchId,
                    TeacherId = teacher.Id,
                    AttendanceDate = eventTime.Date,
                    CheckInTime = indiaTime.ToString("HH:mm"),
                    Status = TeacherAttendanceStatus.Present,
                    CaptureSource = "Hikvision DS-K1A802AEF",
                    MarkedBy = "biometric-hikvision",
                    CapturedAt = eventTime
                };
                _db.TeacherAttendances.Add(record);
            }
            else
            {
                record.Status = TeacherAttendanceStatus.Present;
                if (string.IsNullOrEmpty(record.CheckInTime))
                {
                    record.CheckInTime = indiaTime.ToString("HH:mm");
                }
                else
                {
                    record.CheckOutTime = indiaTime.ToString("HH:mm");
                }
                record.CaptureSource = "Hikvision DS-K1A802AEF";
                record.CapturedAt = eventTime;
            }

            // Solution B: Smart attendance evaluation for teacher Hikvision punch
            string teacherShiftScope = "school";
            if (indiaTime.Hour < 8 || indiaTime.Hour >= 16)
            {
                teacherShiftScope = indiaTime.Hour >= 12 ? "coaching_evening" : "coaching_morning";
            }
            record.Status = TeachersController.EvaluateSmartAttendanceStatus(
                TeacherAttendanceStatus.Present,
                record.CheckInTime,
                record.CheckOutTime,
                settings,
                teacherShiftScope);

            eventLog.Status = "Processed";
            eventLog.AttendanceId = record.Id;
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "Teacher attendance recorded successfully via Hikvision punch.",
                teacher = teacher.FullName,
                checkIn = record.CheckInTime,
                checkOut = record.CheckOutTime
            });
        }

        eventLog.Status = "Unmapped";
        eventLog.ErrorMessage = $"Unrecognized Biometric ID '{punchId}' (Card: '{cardNo}'). Assign this ID to a Student or Teacher in Biometric Mapping UI.";
        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Punch received but ID is unmapped.",
            unmappedId = punchId,
            cardNo = cardNo
        });
    }

    private static bool IsValidMode(string mode) =>
        mode.Equals("Manual", StringComparison.OrdinalIgnoreCase) ||
        mode.Equals("Biometric", StringComparison.OrdinalIgnoreCase) ||
        mode.Equals("Both", StringComparison.OrdinalIgnoreCase);

    private async Task<bool> HasPermissionAsync(string route, IMSERP.API.Services.MenuPermissionOperation operation)
    {
        if (await _menuPermissions.HasPermissionAsync(route, operation))
        {
            return true;
        }

        // Fallback for Manual Attendance: If checking ManualRoute or CorrectionRoute, check if role has CanCreate / CanEdit on Teacher Attendance or Student Attendance
        if (route == ManualRoute && (operation == IMSERP.API.Services.MenuPermissionOperation.Create || operation == IMSERP.API.Services.MenuPermissionOperation.View))
        {
            return await _menuPermissions.HasAnyPermissionAsync("/teachers/attendance", default, IMSERP.API.Services.MenuPermissionOperation.Create, IMSERP.API.Services.MenuPermissionOperation.Edit) ||
                   await _menuPermissions.HasAnyPermissionAsync("/students/attendance", default, IMSERP.API.Services.MenuPermissionOperation.Create, IMSERP.API.Services.MenuPermissionOperation.Edit);
        }

        if (route == CorrectionRoute && (operation == IMSERP.API.Services.MenuPermissionOperation.Edit || operation == IMSERP.API.Services.MenuPermissionOperation.View))
        {
            return await _menuPermissions.HasPermissionAsync("/teachers/attendance", IMSERP.API.Services.MenuPermissionOperation.Edit) ||
                   await _menuPermissions.HasPermissionAsync("/students/attendance", IMSERP.API.Services.MenuPermissionOperation.Edit);
        }

        return false;
    }
}