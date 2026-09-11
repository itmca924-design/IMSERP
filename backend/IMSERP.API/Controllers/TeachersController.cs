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
public class TeachersController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public TeachersController(IIMSERPDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    // ─── Helper ──────────────────────────────────────────────
    private static TeacherDto MapTeacher(Teacher t, int batchCount) => new(
        t.Id, t.EmployeeCode, t.FullName, t.FatherName,
        t.Gender.ToString(), t.DateOfBirth, t.Qualification,
        t.Specialization, t.ExperienceYears, t.PhoneNumber,
        t.WhatsAppPhone, t.Email, t.Address, t.PhotoUrl,
        t.JoiningDate, t.LeavingDate, t.IsActive, t.CreatedAt, batchCount);

    private async Task<bool> CanEditPublicHolidayOrSundayAsync()
    {
        if (_currentUser.UserId == Guid.Empty) return false;

        var user = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);
        if (user?.RoleId == null) return false;

        return await _db.RolePermissions.AsNoTracking()
            .Where(rp => rp.RoleId == user.RoleId && rp.CanEdit)
            .Join(_db.MenuItems,
                permission => permission.MenuItemId,
                menu => menu.Id,
                (permission, menu) => menu.RouteUrl)
            .AnyAsync(route => route == "/teachers/attendance/ph-sun-edit");
    }

    private async Task<bool> IsPublicHolidayOrSundayAsync(DateTime date)
    {
        if (date.DayOfWeek == DayOfWeek.Sunday) return true;

        return await _db.Holidays.AsNoTracking()
            .AnyAsync(h => h.IsActive && h.StartDate.Date <= date.Date && h.EndDate.Date >= date.Date);
    }

    // ─── Teacher CRUD ─────────────────────────────────────────

    /// <summary>
    /// Auto-generate next employee code for this tenant.
    /// Format: {TenantCode}-TCH-{001}  e.g. ACA-TCH-003
    /// </summary>
    [HttpGet("next-employee-code")]
    public async Task<ActionResult<object>> GetNextEmployeeCode()
    {
        var tenant = await _db.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == _currentUser.TenantId);

        var tenantPrefix = (tenant?.Code ?? "TCH").ToUpper();

        // Count existing teachers for this tenant (already filtered by global query filter)
        var count = await _db.Teachers.CountAsync();
        var nextNumber = count + 1;

        // Generate code: ACA-TCH-001
        var code = $"{tenantPrefix}-TCH-{nextNumber:D3}";

        // Make sure this code doesn't already exist (loop until unique)
        while (await _db.Teachers.AnyAsync(t => t.EmployeeCode == code))
        {
            nextNumber++;
            code = $"{tenantPrefix}-TCH-{nextNumber:D3}";
        }

        return Ok(new { code });
    }

    /// <summary>
    /// Check if phone or email already exists for another teacher in this tenant.
    /// Pass excludeId when editing to skip the current teacher.
    /// </summary>
    [HttpGet("check-duplicate")]
    public async Task<ActionResult<object>> CheckDuplicate(
        [FromQuery] string? phone = null,
        [FromQuery] string? email = null,
        [FromQuery] Guid? excludeId = null)
    {
        var phoneExists = false;
        var emailExists = false;

        if (!string.IsNullOrWhiteSpace(phone))
        {
            var q = _db.Teachers.Where(t => t.PhoneNumber == phone.Trim());
            if (excludeId.HasValue) q = q.Where(t => t.Id != excludeId.Value);
            phoneExists = await q.AnyAsync();
        }

        if (!string.IsNullOrWhiteSpace(email))
        {
            var q = _db.Teachers.Where(t => t.Email != null && t.Email == email.Trim().ToLower());
            if (excludeId.HasValue) q = q.Where(t => t.Id != excludeId.Value);
            emailExists = await q.AnyAsync();
        }

        return Ok(new { phoneExists, emailExists });
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TeacherDto>>> GetTeachers([FromQuery] bool activeOnly = false)
    {
        var q = _db.Teachers.AsNoTracking()
            .Include(t => t.BatchAssignments)
            .AsQueryable();
        if (activeOnly) q = q.Where(t => t.IsActive);

        // Pehle DB se raw data lo, phir C# mein map karo (EF Core translation issue avoid)
        var rawList = await q.OrderBy(t => t.FullName).ToListAsync();
        var list = rawList.Select(t => MapTeacher(t, t.BatchAssignments.Count(a => a.IsActive))).ToList();
        return Ok(list);
    }

    [HttpGet("paged")]
    public async Task<ActionResult<PagedResult<TeacherDto>>> GetTeachersPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? sortBy = "fullName",
        [FromQuery] bool sortDescending = false,
        [FromQuery] bool? isActive = null)
    {
        var q = _db.Teachers.AsNoTracking()
            .Include(t => t.BatchAssignments)
            .AsQueryable();

        if (isActive.HasValue) q = q.Where(t => t.IsActive == isActive.Value);

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            q = q.Where(t => t.FullName.ToLower().Contains(term) ||
                              t.EmployeeCode.ToLower().Contains(term) ||
                              (t.Specialization != null && t.Specialization.ToLower().Contains(term)) ||
                              t.PhoneNumber.Contains(term));
        }

        // if-else instead of switch — avoids EF Core expression tree ambiguity with mixed key types
        var sortKey = sortBy?.ToLower() ?? "fullname";
        if (sortKey == "employeecode")
            q = sortDescending ? q.OrderByDescending(t => t.EmployeeCode) : q.OrderBy(t => t.EmployeeCode);
        else if (sortKey == "specialization")
            q = sortDescending ? q.OrderByDescending(t => t.Specialization) : q.OrderBy(t => t.Specialization);
        else if (sortKey == "joiningdate")
            q = sortDescending ? q.OrderByDescending(t => t.JoiningDate) : q.OrderBy(t => t.JoiningDate);
        else if (sortKey == "experience")
            q = sortDescending ? q.OrderByDescending(t => t.ExperienceYears) : q.OrderBy(t => t.ExperienceYears);
        else
            q = sortDescending ? q.OrderByDescending(t => t.FullName) : q.OrderBy(t => t.FullName);

        var totalCount = await q.CountAsync();

        // Pehle DB se raw data lo, phir C# mein map karo (EF Core translation issue avoid)
        var rawItems = await q
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = rawItems
            .Select(t => MapTeacher(t, t.BatchAssignments.Count(a => a.IsActive)))
            .ToList();

        return Ok(new PagedResult<TeacherDto>(items, totalCount, pageNumber, pageSize));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<TeacherDto>> GetTeacherById(Guid id)
    {
        var t = await _db.Teachers.AsNoTracking()
            .Include(x => x.BatchAssignments)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (t == null) return NotFound();
        return Ok(MapTeacher(t, t.BatchAssignments.Count(a => a.IsActive)));
    }

    [HttpPost]
    public async Task<ActionResult<TeacherDto>> CreateTeacher([FromBody] CreateTeacherDto dto)
    {
        var exists = await _db.Teachers.AnyAsync(t => t.EmployeeCode == dto.EmployeeCode.Trim());
        if (exists) return BadRequest(new { message = "Employee code already exists." });

        if (!Enum.TryParse<Gender>(dto.Gender, true, out var gender))
            return BadRequest(new { message = "Invalid gender value." });

        var teacher = new Teacher
        {
            TenantId = _currentUser.TenantId,
            EmployeeCode = dto.EmployeeCode.Trim(),
            FullName = dto.FullName.Trim(),
            FatherName = dto.FatherName?.Trim(),
            Gender = gender,
            DateOfBirth = dto.DateOfBirth,
            Qualification = dto.Qualification?.Trim(),
            Specialization = dto.Specialization?.Trim(),
            ExperienceYears = dto.ExperienceYears,
            PhoneNumber = dto.PhoneNumber.Trim(),
            WhatsAppPhone = dto.WhatsAppPhone?.Trim(),
            Email = dto.Email?.Trim(),
            Address = dto.Address?.Trim(),
            JoiningDate = dto.JoiningDate,
            IsActive = dto.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        _db.Teachers.Add(teacher);
        await _db.SaveChangesAsync();
        return Ok(MapTeacher(teacher, 0));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<TeacherDto>> UpdateTeacher(Guid id, [FromBody] CreateTeacherDto dto)
    {
        var teacher = await _db.Teachers.Include(t => t.BatchAssignments).FirstOrDefaultAsync(t => t.Id == id);
        if (teacher == null) return NotFound();

        if (!Enum.TryParse<Gender>(dto.Gender, true, out var gender))
            return BadRequest(new { message = "Invalid gender value." });

        teacher.FullName = dto.FullName.Trim();
        teacher.FatherName = dto.FatherName?.Trim();
        teacher.Gender = gender;
        teacher.DateOfBirth = dto.DateOfBirth;
        teacher.Qualification = dto.Qualification?.Trim();
        teacher.Specialization = dto.Specialization?.Trim();
        teacher.ExperienceYears = dto.ExperienceYears;
        teacher.PhoneNumber = dto.PhoneNumber.Trim();
        teacher.WhatsAppPhone = dto.WhatsAppPhone?.Trim();
        teacher.Email = dto.Email?.Trim();
        teacher.Address = dto.Address?.Trim();
        teacher.JoiningDate = dto.JoiningDate;
        teacher.IsActive = dto.IsActive;

        await _db.SaveChangesAsync();
        return Ok(MapTeacher(teacher, teacher.BatchAssignments.Count(a => a.IsActive)));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTeacher(Guid id)
    {
        var teacher = await _db.Teachers.FindAsync(id);
        if (teacher == null) return NotFound();
        teacher.IsActive = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ─── Teacher Dashboard Card ───────────────────────────────

    [HttpGet("{id}/dashboard")]
    public async Task<ActionResult<TeacherDashboardDto>> GetTeacherDashboard(Guid id)
    {
        var teacher = await _db.Teachers.AsNoTracking()
            .Include(t => t.BatchAssignments).ThenInclude(a => a.Batch).ThenInclude(b => b!.Students)
            .Include(t => t.Salaries)
            .FirstOrDefaultAsync(t => t.Id == id);
        if (teacher == null) return NotFound();

        var now = DateTime.UtcNow;
        var attendances = await _db.TeacherAttendances.AsNoTracking()
            .Where(a => a.TeacherId == id && a.AttendanceDate.Month == now.Month && a.AttendanceDate.Year == now.Year)
            .ToListAsync();

        int present = 0, absent = 0, late = 0, half = 0;
        foreach (var a in attendances)
        {
            var effectiveStatus = EvaluateSmartAttendanceStatus(a.Status, a.CheckInTime, a.CheckOutTime);
            if (effectiveStatus == TeacherAttendanceStatus.Present) present++;
            else if (effectiveStatus == TeacherAttendanceStatus.Absent) absent++;
            else if (effectiveStatus == TeacherAttendanceStatus.Late) late++;
            else if (effectiveStatus == TeacherAttendanceStatus.HalfDay) half++;
        }

        var monthStart = new DateTime(now.Year, now.Month, 1);
        var monthEnd = new DateTime(now.Year, now.Month, DateTime.DaysInMonth(now.Year, now.Month));
        var declaredHolidays = await _db.Holidays.AsNoTracking()
            .Where(h => h.IsActive && h.StartDate.Date <= monthEnd && h.EndDate.Date >= monthStart)
            .ToListAsync();

        int daysInMonth = DateTime.DaysInMonth(now.Year, now.Month);
        var offDates = new HashSet<DateTime>();
        for (int d = 1; d <= daysInMonth; d++)
        {
            var date = new DateTime(now.Year, now.Month, d);
            if (date.DayOfWeek == DayOfWeek.Sunday) offDates.Add(date.Date);
        }
        foreach (var h in declaredHolidays)
        {
            var cur = h.StartDate.Date < monthStart ? monthStart : h.StartDate.Date;
            var end = h.EndDate.Date > monthEnd ? monthEnd : h.EndDate.Date;
            for (var dt = cur; dt <= end; dt = dt.AddDays(1))
            {
                offDates.Add(dt);
            }
        }
        foreach (var r in attendances.Where(a => a.Status == TeacherAttendanceStatus.Holiday || a.Status == TeacherAttendanceStatus.WeekOff))
        {
            offDates.Add(r.AttendanceDate.Date);
        }

        int holiday = offDates.Count;
        int totalWorkingDays = Math.Max(0, daysInMonth - holiday);

        int evaluatedDays = present + absent + late + half;
        decimal pct = 0;
        if (evaluatedDays > 0)
        {
            decimal attendedEffective = present + late + (half * 0.5m);
            pct = Math.Round((attendedEffective / evaluatedDays) * 100, 1);
        }

        var activeSalary = teacher.Salaries.Where(s => s.IsActive).OrderByDescending(s => s.EffectiveFrom).FirstOrDefault();
        var netSalary = activeSalary != null ? activeSalary.BasicSalary + activeSalary.HRA + activeSalary.OtherAllowances - activeSalary.PFDeduction - activeSalary.TDSDeduction - activeSalary.OtherDeductions : (decimal?)null;

        var totalPaid = await _db.TeacherSalaryPayments.AsNoTracking()
            .Where(p => p.TeacherId == id && p.PaymentYear == now.Year)
            .SumAsync(p => p.NetPaid);

        var pendingLeaves = await _db.TeacherLeaves.AsNoTracking()
            .CountAsync(l => l.TeacherId == id && l.Status == LeaveStatus.Pending);

        var approvedLeaves = await _db.TeacherLeaves.AsNoTracking()
            .CountAsync(l => l.TeacherId == id && l.Status == LeaveStatus.Approved && l.FromDate.Year == now.Year);

        var pendingAdvance = await _db.TeacherSalaryAdvances.AsNoTracking()
            .Where(a => a.TeacherId == id && (a.Status == AdvanceStatus.Approved || a.Status == AdvanceStatus.Pending))
            .SumAsync(a => a.Amount);

        int assignedBatches = teacher.BatchAssignments.Count(a => a.IsActive);
        int totalStudents = teacher.BatchAssignments.Where(a => a.IsActive)
            .SelectMany(a => a.Batch?.Students ?? new List<Student>())
            .Select(s => s.Id).Distinct().Count();

        const int allowedLateDays = 3;
        int excessLateDays = Math.Max(0, late - allowedLateDays);
        decimal latePenaltyDays = Math.Floor(excessLateDays / 3.0m) * 0.5m;
        decimal payableDays = Math.Max(0, present + (half * 0.5m) + holiday - latePenaltyDays);

        return Ok(new TeacherDashboardDto(
            teacher.Id, teacher.FullName, teacher.EmployeeCode, teacher.Specialization,
            assignedBatches, totalStudents,
            new TeacherAttendanceSummaryDto(present, absent, late, half, holiday, totalWorkingDays, pct, allowedLateDays, excessLateDays, latePenaltyDays, payableDays),
            netSalary, totalPaid, pendingLeaves, approvedLeaves, pendingAdvance));
    }

    // ─── Batch Assignments ────────────────────────────────────

    [HttpGet("{id}/batch-assignments")]
    public async Task<ActionResult<IEnumerable<TeacherBatchAssignmentDto>>> GetBatchAssignments(Guid id)
    {
        var list = await _db.TeacherBatchAssignments.AsNoTracking()
            .Include(a => a.Teacher)
            .Include(a => a.Batch)
            .Where(a => a.TeacherId == id)
            .OrderByDescending(a => a.AssignedAt)
            .Select(a => new TeacherBatchAssignmentDto(
                a.Id, a.TeacherId, a.Teacher!.FullName, a.BatchId,
                a.Batch!.Name, a.Subject, a.DaysOfWeek, a.TimeSlot, a.IsActive, a.AssignedAt))
            .ToListAsync();
        return Ok(list);
    }

    [HttpPost("batch-assignments")]
    public async Task<ActionResult<TeacherBatchAssignmentDto>> AssignBatch([FromBody] CreateTeacherBatchAssignmentDto dto)
    {
        var teacher = await _db.Teachers.FindAsync(dto.TeacherId);
        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        var batch = await _db.Batches.FindAsync(dto.BatchId);
        if (batch == null) return NotFound(new { message = "Batch not found." });

        var assignment = new TeacherBatchAssignment
        {
            TenantId = _currentUser.TenantId,
            TeacherId = dto.TeacherId,
            BatchId = dto.BatchId,
            Subject = dto.Subject.Trim(),
            DaysOfWeek = dto.DaysOfWeek?.Trim(),
            TimeSlot = dto.TimeSlot?.Trim(),
            IsActive = true,
            AssignedAt = DateTime.UtcNow
        };

        _db.TeacherBatchAssignments.Add(assignment);
        await _db.SaveChangesAsync();

        return Ok(new TeacherBatchAssignmentDto(
            assignment.Id, assignment.TeacherId, teacher.FullName,
            assignment.BatchId, batch.Name, assignment.Subject,
            assignment.DaysOfWeek, assignment.TimeSlot, assignment.IsActive, assignment.AssignedAt));
    }

    [HttpPost("batch-assignments/bulk")]
    public async Task<ActionResult<IEnumerable<TeacherBatchAssignmentDto>>> AssignBatchesBulk([FromBody] BulkCreateTeacherBatchAssignmentDto dto)
    {
        var teacher = await _db.Teachers.FindAsync(dto.TeacherId);
        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        if (dto.Slots == null || dto.Slots.Count == 0)
        {
            return BadRequest(new { message = "At least one batch slot must be provided." });
        }

        var results = new List<TeacherBatchAssignmentDto>();

        foreach (var slot in dto.Slots)
        {
            if (slot.BatchId == Guid.Empty) continue;
            var batch = await _db.Batches.FindAsync(slot.BatchId);
            if (batch == null) continue;

            var assignment = new TeacherBatchAssignment
            {
                TenantId = _currentUser.TenantId,
                TeacherId = dto.TeacherId,
                BatchId = slot.BatchId,
                Subject = slot.Subject?.Trim() ?? string.Empty,
                DaysOfWeek = slot.DaysOfWeek?.Trim(),
                TimeSlot = slot.TimeSlot?.Trim(),
                IsActive = true,
                AssignedAt = DateTime.UtcNow
            };

            _db.TeacherBatchAssignments.Add(assignment);
            results.Add(new TeacherBatchAssignmentDto(
                assignment.Id, assignment.TeacherId, teacher.FullName,
                assignment.BatchId, batch.Name, assignment.Subject,
                assignment.DaysOfWeek, assignment.TimeSlot, assignment.IsActive, assignment.AssignedAt));
        }

        await _db.SaveChangesAsync();
        return Ok(results);
    }

    [HttpDelete("batch-assignments/{assignmentId}")]
    public async Task<IActionResult> RemoveBatchAssignment(Guid assignmentId)
    {
        var a = await _db.TeacherBatchAssignments.FindAsync(assignmentId);
        if (a == null) return NotFound();
        _db.TeacherBatchAssignments.Remove(a);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ─── Attendance ───────────────────────────────────────────

    [HttpGet("attendance/ph-sun-edit-permission")]
    public async Task<ActionResult<object>> GetPublicHolidaySundayEditPermission()
    {
        return Ok(new { canEdit = await CanEditPublicHolidayOrSundayAsync() });
    }

    [HttpGet("{id}/attendance")]
    public async Task<ActionResult<IEnumerable<TeacherAttendanceDto>>> GetAttendance(
        Guid id,
        [FromQuery] int month = 0,
        [FromQuery] int year = 0)
    {
        if (month == 0) month = DateTime.UtcNow.Month;
        if (year == 0) year = DateTime.UtcNow.Year;

        var teacher = await _db.Teachers.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);
        if (teacher == null) return NotFound();

        var rawList = await _db.TeacherAttendances.AsNoTracking()
            .Where(a => a.TeacherId == id && a.AttendanceDate.Month == month && a.AttendanceDate.Year == year)
            .OrderBy(a => a.AttendanceDate)
            .ToListAsync();

        var list = rawList.Select(a => new TeacherAttendanceDto(
            a.Id, a.TeacherId, teacher.FullName, teacher.EmployeeCode,
            a.AttendanceDate, EvaluateSmartAttendanceStatus(a.Status, a.CheckInTime, a.CheckOutTime).ToString(),
            a.CheckInTime, a.CheckOutTime, a.Remarks)).ToList();

        return Ok(list);
    }

    [HttpGet("{id}/attendance/summary")]
    public async Task<ActionResult<TeacherAttendanceSummaryDto>> GetAttendanceSummary(
        Guid id, [FromQuery] int month = 0, [FromQuery] int year = 0)
    {
        if (month == 0) month = DateTime.UtcNow.Month;
        if (year == 0) year = DateTime.UtcNow.Year;

        var records = await _db.TeacherAttendances.AsNoTracking()
            .Where(a => a.TeacherId == id && a.AttendanceDate.Month == month && a.AttendanceDate.Year == year)
            .ToListAsync();

        int present = 0, absent = 0, late = 0, half = 0;
        foreach (var r in records)
        {
            var effectiveStatus = EvaluateSmartAttendanceStatus(r.Status, r.CheckInTime, r.CheckOutTime);
            if (effectiveStatus == TeacherAttendanceStatus.Present) present++;
            else if (effectiveStatus == TeacherAttendanceStatus.Absent) absent++;
            else if (effectiveStatus == TeacherAttendanceStatus.Late) late++;
            else if (effectiveStatus == TeacherAttendanceStatus.HalfDay) half++;
        }

        // Fetch declared holidays from Holidays table
        var monthStart = new DateTime(year, month, 1);
        var monthEnd = new DateTime(year, month, DateTime.DaysInMonth(year, month));
        var declaredHolidays = await _db.Holidays.AsNoTracking()
            .Where(h => h.IsActive && h.StartDate.Date <= monthEnd && h.EndDate.Date >= monthStart)
            .ToListAsync();

        // Calculate all Sundays in the month
        int daysInMonth = DateTime.DaysInMonth(year, month);
        var offDates = new HashSet<DateTime>();
        for (int d = 1; d <= daysInMonth; d++)
        {
            var date = new DateTime(year, month, d);
            if (date.DayOfWeek == DayOfWeek.Sunday)
            {
                offDates.Add(date.Date);
            }
        }

        // Merge declared holidays without double counting Sundays
        foreach (var h in declaredHolidays)
        {
            var cur = h.StartDate.Date < monthStart ? monthStart : h.StartDate.Date;
            var end = h.EndDate.Date > monthEnd ? monthEnd : h.EndDate.Date;
            for (var dt = cur; dt <= end; dt = dt.AddDays(1))
            {
                offDates.Add(dt);
            }
        }

        // Also merge any attendance rows explicitly marked as Holiday or WeekOff
        foreach (var r in records.Where(a => a.Status == TeacherAttendanceStatus.Holiday || a.Status == TeacherAttendanceStatus.WeekOff))
        {
            offDates.Add(r.AttendanceDate.Date);
        }

        int holiday = offDates.Count;
        int totalWorkingDays = Math.Max(0, daysInMonth - holiday);

        int evaluatedDays = present + absent + late + half;
        decimal pct = 0;
        if (evaluatedDays > 0)
        {
            decimal attendedEffective = present + late + (half * 0.5m);
            pct = Math.Round((attendedEffective / evaluatedDays) * 100, 1);
        }

        const int allowedLateDays = 3;
        int excessLateDays = Math.Max(0, late - allowedLateDays);
        decimal latePenaltyDays = Math.Floor(excessLateDays / 3.0m) * 0.5m;
        decimal payableDays = Math.Max(0, present + (half * 0.5m) + holiday - latePenaltyDays);

        return Ok(new TeacherAttendanceSummaryDto(
            present, absent, late, half, holiday, totalWorkingDays, pct,
            allowedLateDays, excessLateDays, latePenaltyDays, payableDays));
    }

    [HttpPost("attendance/bulk")]
    public async Task<IActionResult> BulkMarkAttendance([FromBody] BulkMarkAttendanceDto dto)
    {
        if (!await CanEditPublicHolidayOrSundayAsync() && await IsPublicHolidayOrSundayAsync(dto.AttendanceDate))
            return Forbid();

        var markedBy = _currentUser.UserId.ToString();
        foreach (var entry in dto.Entries)
        {
            if (!Enum.TryParse<TeacherAttendanceStatus>(entry.Status, true, out var status))
                continue;

            var existing = await _db.TeacherAttendances
                .FirstOrDefaultAsync(a => a.TeacherId == entry.TeacherId && a.AttendanceDate.Date == dto.AttendanceDate.Date);

            var smartStatus = EvaluateSmartAttendanceStatus(status, entry.CheckInTime, entry.CheckOutTime);
            if (existing != null)
            {
                existing.Status = smartStatus;
                existing.CheckInTime = entry.CheckInTime;
                existing.CheckOutTime = entry.CheckOutTime;
                existing.Remarks = entry.Remarks;
            }
            else
            {
                _db.TeacherAttendances.Add(new TeacherAttendance
                {
                    TenantId = _currentUser.TenantId,
                    TeacherId = entry.TeacherId,
                    AttendanceDate = dto.AttendanceDate.Date,
                    Status = smartStatus,
                    CheckInTime = entry.CheckInTime,
                    CheckOutTime = entry.CheckOutTime,
                    Remarks = entry.Remarks,
                    MarkedBy = markedBy,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = $"Attendance marked for {dto.Entries.Count} teachers on {dto.AttendanceDate:dd-MMM-yyyy}." });
    }

    [HttpPost("{id}/attendance")]
    public async Task<ActionResult<TeacherAttendanceDto>> MarkAttendance(Guid id, [FromBody] MarkTeacherAttendanceDto dto)
    {
        var teacher = await _db.Teachers.FindAsync(id);
        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        if (!Enum.TryParse<TeacherAttendanceStatus>(dto.Status, true, out var status))
            return BadRequest(new { message = "Invalid attendance status." });

        var smartStatus = EvaluateSmartAttendanceStatus(status, dto.CheckInTime, dto.CheckOutTime);
        var date = dto.AttendanceDate.Date;
        if (!await CanEditPublicHolidayOrSundayAsync() && await IsPublicHolidayOrSundayAsync(date))
            return Forbid();

        var existing = await _db.TeacherAttendances
            .FirstOrDefaultAsync(a => a.TeacherId == id && a.AttendanceDate.Date == date);

        if (existing != null)
        {
            existing.Status = smartStatus;
            existing.CheckInTime = dto.CheckInTime;
            existing.CheckOutTime = dto.CheckOutTime;
            existing.Remarks = dto.Remarks;
            existing.MarkedBy = _currentUser.UserId.ToString();
        }
        else
        {
            existing = new TeacherAttendance
            {
                TenantId = _currentUser.TenantId,
                TeacherId = id,
                AttendanceDate = date,
                Status = smartStatus,
                CheckInTime = dto.CheckInTime,
                CheckOutTime = dto.CheckOutTime,
                Remarks = dto.Remarks,
                MarkedBy = _currentUser.UserId.ToString(),
                CreatedAt = DateTime.UtcNow
            };
            _db.TeacherAttendances.Add(existing);
        }

        await _db.SaveChangesAsync();

        return Ok(new TeacherAttendanceDto(
            existing.Id, existing.TeacherId, teacher.FullName, teacher.EmployeeCode,
            existing.AttendanceDate, existing.Status.ToString(),
            existing.CheckInTime, existing.CheckOutTime, existing.Remarks));
    }

    [HttpDelete("attendance/{attendanceId}")]
    public async Task<IActionResult> DeleteAttendance(Guid attendanceId)
    {
        var record = await _db.TeacherAttendances.FindAsync(attendanceId);
        if (record == null) return NotFound();

        if (!await CanEditPublicHolidayOrSundayAsync() && await IsPublicHolidayOrSundayAsync(record.AttendanceDate))
            return Forbid();

        _db.TeacherAttendances.Remove(record);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ─── Salary Structure ─────────────────────────────────────

    [HttpGet("{id}/salary")]
    public async Task<ActionResult<TeacherSalaryDto?>> GetSalaryStructure(Guid id)
    {
        var teacher = await _db.Teachers.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);
        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        var sal = await _db.TeacherSalaries.AsNoTracking()
            .Where(s => s.TeacherId == id && s.IsActive)
            .OrderByDescending(s => s.EffectiveFrom)
            .FirstOrDefaultAsync();

        if (sal == null) return Ok((TeacherSalaryDto?)null);

        return Ok(new TeacherSalaryDto(
            sal.Id, sal.TeacherId, teacher.FullName,
            sal.BasicSalary, sal.HRA, sal.OtherAllowances,
            sal.BasicSalary + sal.HRA + sal.OtherAllowances,
            sal.PFDeduction, sal.TDSDeduction, sal.OtherDeductions,
            sal.BasicSalary + sal.HRA + sal.OtherAllowances - sal.PFDeduction - sal.TDSDeduction - sal.OtherDeductions,
            sal.EffectiveFrom, sal.EffectiveTo, sal.IsActive));
    }

    [HttpPost("{id}/salary")]
    public async Task<ActionResult<TeacherSalaryDto>> SetSalaryStructure(Guid id, [FromBody] CreateTeacherSalaryDto dto)
    {
        if (dto.BasicSalary <= 0) return BadRequest(new { message = "Basic Salary must be greater than 0." });

        var teacher = await _db.Teachers.FindAsync(id);
        if (teacher == null) return NotFound();

        // Deactivate existing
        var existing = await _db.TeacherSalaries.Where(s => s.TeacherId == id && s.IsActive).ToListAsync();
        foreach (var e in existing) { e.IsActive = false; e.EffectiveTo = dto.EffectiveFrom.AddDays(-1); }

        var sal = new TeacherSalary
        {
            TenantId = _currentUser.TenantId,
            TeacherId = id,
            BasicSalary = dto.BasicSalary,
            HRA = dto.HRA,
            OtherAllowances = dto.OtherAllowances,
            PFDeduction = dto.PFDeduction,
            TDSDeduction = dto.TDSDeduction,
            OtherDeductions = dto.OtherDeductions,
            EffectiveFrom = dto.EffectiveFrom,
            EffectiveTo = dto.EffectiveTo,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.TeacherSalaries.Add(sal);
        await _db.SaveChangesAsync();

        return Ok(new TeacherSalaryDto(sal.Id, sal.TeacherId, teacher.FullName,
            sal.BasicSalary, sal.HRA, sal.OtherAllowances,
            sal.BasicSalary + sal.HRA + sal.OtherAllowances,
            sal.PFDeduction, sal.TDSDeduction, sal.OtherDeductions,
            sal.BasicSalary + sal.HRA + sal.OtherAllowances - sal.PFDeduction - sal.TDSDeduction - sal.OtherDeductions,
            sal.EffectiveFrom, sal.EffectiveTo, sal.IsActive));
    }

    // ─── Salary Payments ──────────────────────────────────────

    [HttpGet("{id}/salary-preview")]
    public async Task<ActionResult<TeacherPayrollPreviewDto>> GetSalaryPreview(
        Guid id, [FromQuery] int month = 0, [FromQuery] int year = 0)
    {
        if (month == 0) month = DateTime.UtcNow.Month;
        if (year == 0) year = DateTime.UtcNow.Year;

        var teacher = await _db.Teachers.AsNoTracking()
            .Include(t => t.Salaries)
            .FirstOrDefaultAsync(t => t.Id == id);
        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        var sal = teacher.Salaries
            .Where(s => s.IsActive && s.EffectiveFrom <= new DateTime(year, month, DateTime.DaysInMonth(year, month)))
            .OrderByDescending(s => s.EffectiveFrom)
            .FirstOrDefault();

        decimal basic = sal?.BasicSalary ?? 0m;
        decimal hra = sal?.HRA ?? 0m;
        decimal otherAllowances = sal?.OtherAllowances ?? 0m;
        decimal gross = basic + hra + otherAllowances;
        decimal pf = sal?.PFDeduction ?? 0m;
        decimal tds = sal?.TDSDeduction ?? 0m;
        decimal otherDeductions = sal?.OtherDeductions ?? 0m;

        // Fetch attendance for the month
        var records = await _db.TeacherAttendances.AsNoTracking()
            .Where(a => a.TeacherId == id && a.AttendanceDate.Month == month && a.AttendanceDate.Year == year)
            .ToListAsync();

        int present = 0, absent = 0, late = 0, half = 0;
        foreach (var r in records)
        {
            var effectiveStatus = EvaluateSmartAttendanceStatus(r.Status, r.CheckInTime, r.CheckOutTime);
            if (effectiveStatus == TeacherAttendanceStatus.Present) present++;
            else if (effectiveStatus == TeacherAttendanceStatus.Absent) absent++;
            else if (effectiveStatus == TeacherAttendanceStatus.Late) late++;
            else if (effectiveStatus == TeacherAttendanceStatus.HalfDay) half++;
        }

        // Calculate working days
        var monthStart = new DateTime(year, month, 1);
        var monthEnd = new DateTime(year, month, DateTime.DaysInMonth(year, month));
        var declaredHolidays = await _db.Holidays.AsNoTracking()
            .Where(h => h.IsActive && h.StartDate.Date <= monthEnd && h.EndDate.Date >= monthStart)
            .ToListAsync();

        int daysInMonth = DateTime.DaysInMonth(year, month);
        var offDates = new HashSet<DateTime>();
        for (int d = 1; d <= daysInMonth; d++)
        {
            var date = new DateTime(year, month, d);
            if (date.DayOfWeek == DayOfWeek.Sunday) offDates.Add(date.Date);
        }
        foreach (var h in declaredHolidays)
        {
            var cur = h.StartDate.Date < monthStart ? monthStart : h.StartDate.Date;
            var end = h.EndDate.Date > monthEnd ? monthEnd : h.EndDate.Date;
            for (var dt = cur; dt <= end; dt = dt.AddDays(1)) offDates.Add(dt);
        }
        foreach (var r in records.Where(a => a.Status == TeacherAttendanceStatus.Holiday || a.Status == TeacherAttendanceStatus.WeekOff))
        {
            offDates.Add(r.AttendanceDate.Date);
        }

        int holiday = offDates.Count;
        int totalWorkingDays = Math.Max(1, daysInMonth - holiday);

        const int allowedLateDays = 3;
        int excessLateDays = Math.Max(0, late - allowedLateDays);
        decimal latePenaltyDays = Math.Floor(excessLateDays / 3.0m) * 0.5m;

        decimal perDayRate = totalWorkingDays > 0 ? Math.Round(gross / totalWorkingDays, 2) : 0m;
        decimal absentDeduction = Math.Round(absent * perDayRate, 2);
        decimal halfDayDeduction = Math.Round((half * 0.5m) * perDayRate, 2);
        decimal latePenaltyDeduction = Math.Round(latePenaltyDays * perDayRate, 2);
        decimal totalAttendanceDeduction = absentDeduction + halfDayDeduction + latePenaltyDeduction;

        var pendingAdvance = await _db.TeacherSalaryAdvances.AsNoTracking()
            .Where(a => a.TeacherId == id && a.Status == AdvanceStatus.Approved)
            .SumAsync(a => a.Amount);

        decimal recommendedNet = Math.Max(0m, gross - (pf + tds + otherDeductions + totalAttendanceDeduction + pendingAdvance));

        return Ok(new TeacherPayrollPreviewDto(
            teacher.Id, teacher.FullName, teacher.EmployeeCode,
            month, year,
            basic, hra, otherAllowances, gross,
            pf, tds, otherDeductions,
            totalWorkingDays, perDayRate,
            present, absent, half, late,
            allowedLateDays, excessLateDays, latePenaltyDays,
            absentDeduction, halfDayDeduction, latePenaltyDeduction,
            totalAttendanceDeduction, pendingAdvance,
            recommendedNet
        ));
    }

    [HttpGet("{id}/salary-payments")]
    public async Task<ActionResult<IEnumerable<TeacherSalaryPaymentDto>>> GetSalaryPayments(Guid id)
    {
        var teacher = await _db.Teachers.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);
        if (teacher == null) return NotFound();

        var list = await _db.TeacherSalaryPayments.AsNoTracking()
            .Where(p => p.TeacherId == id)
            .OrderByDescending(p => p.PaymentYear).ThenByDescending(p => p.PaymentMonth)
            .Select(p => new TeacherSalaryPaymentDto(
                p.Id, p.TeacherId, teacher.FullName, teacher.EmployeeCode,
                p.PaymentMonth, p.PaymentYear,
                new DateTime(p.PaymentYear, p.PaymentMonth, 1).ToString("MMMM yyyy"),
                p.PaymentDate, p.GrossAmount, p.Deductions, p.AdvanceAdjusted, p.NetPaid,
                p.PaymentMode.ToString(), p.TransactionRef, p.ReceiptNumber,
                p.PresentDays, p.AbsentDays, p.Remarks))
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost("salary-payments")]
    public async Task<ActionResult<TeacherSalaryPaymentDto>> RecordSalaryPayment([FromBody] CreateSalaryPaymentDto dto)
    {
        var teacher = await _db.Teachers.FindAsync(dto.TeacherId);
        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        var alreadyPaid = await _db.TeacherSalaryPayments.AnyAsync(p =>
            p.TeacherId == dto.TeacherId && p.PaymentMonth == dto.PaymentMonth && p.PaymentYear == dto.PaymentYear);
        if (alreadyPaid) return BadRequest(new { message = $"Salary for {dto.PaymentMonth}/{dto.PaymentYear} already recorded." });

        if (!Enum.TryParse<SalaryPaymentMode>(dto.PaymentMode, true, out var mode))
            mode = SalaryPaymentMode.Cash;

        var now = DateTime.UtcNow;
        var payment = new TeacherSalaryPayment
        {
            TenantId = _currentUser.TenantId,
            TeacherId = dto.TeacherId,
            PaymentMonth = dto.PaymentMonth,
            PaymentYear = dto.PaymentYear,
            PaymentDate = dto.PaymentDate,
            GrossAmount = dto.GrossAmount,
            Deductions = dto.Deductions,
            AdvanceAdjusted = dto.AdvanceAdjusted,
            NetPaid = dto.NetPaid,
            PaymentMode = mode,
            TransactionRef = dto.TransactionRef,
            ReceiptNumber = $"TSAL-{now.Year}{now.Month:D2}-{new Random().Next(100, 999)}",
            PresentDays = dto.PresentDays,
            AbsentDays = dto.AbsentDays,
            Remarks = dto.Remarks,
            CreatedAt = now
        };

        _db.TeacherSalaryPayments.Add(payment);

        // Mark related advances as adjusted
        if (dto.AdvanceAdjusted > 0)
        {
            var advances = await _db.TeacherSalaryAdvances
                .Where(a => a.TeacherId == dto.TeacherId && a.Status == AdvanceStatus.Approved)
                .ToListAsync();
            foreach (var adv in advances)
            {
                adv.Status = AdvanceStatus.Adjusted;
                adv.AdjustedInMonth = dto.PaymentMonth;
                adv.AdjustedInYear = dto.PaymentYear;
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new TeacherSalaryPaymentDto(
            payment.Id, payment.TeacherId, teacher.FullName, teacher.EmployeeCode,
            payment.PaymentMonth, payment.PaymentYear,
            new DateTime(payment.PaymentYear, payment.PaymentMonth, 1).ToString("MMMM yyyy"),
            payment.PaymentDate, payment.GrossAmount, payment.Deductions,
            payment.AdvanceAdjusted, payment.NetPaid,
            payment.PaymentMode.ToString(), payment.TransactionRef, payment.ReceiptNumber,
            payment.PresentDays, payment.AbsentDays, payment.Remarks));
    }

    // ─── Salary Advances ──────────────────────────────────────

    [HttpGet("{id}/advances")]
    public async Task<ActionResult<IEnumerable<TeacherSalaryAdvanceDto>>> GetAdvances(Guid id)
    {
        var teacher = await _db.Teachers.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);
        if (teacher == null) return NotFound();

        var list = await _db.TeacherSalaryAdvances.AsNoTracking()
            .Where(a => a.TeacherId == id)
            .OrderByDescending(a => a.RequestDate)
            .Select(a => new TeacherSalaryAdvanceDto(
                a.Id, a.TeacherId, teacher.FullName, teacher.EmployeeCode,
                a.Amount, a.RequestDate, a.ApprovedDate, a.Reason,
                a.Status.ToString(), a.AdjustedInMonth, a.AdjustedInYear))
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost("advances")]
    public async Task<ActionResult<TeacherSalaryAdvanceDto>> RequestAdvance([FromBody] CreateAdvanceDto dto)
    {
        var teacher = await _db.Teachers.FindAsync(dto.TeacherId);
        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        var advance = new TeacherSalaryAdvance
        {
            TenantId = _currentUser.TenantId,
            TeacherId = dto.TeacherId,
            Amount = dto.Amount,
            Reason = dto.Reason?.Trim(),
            Status = AdvanceStatus.Pending,
            RequestDate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        _db.TeacherSalaryAdvances.Add(advance);
        await _db.SaveChangesAsync();

        return Ok(new TeacherSalaryAdvanceDto(
            advance.Id, advance.TeacherId, teacher.FullName, teacher.EmployeeCode,
            advance.Amount, advance.RequestDate, advance.ApprovedDate, advance.Reason,
            advance.Status.ToString(), advance.AdjustedInMonth, advance.AdjustedInYear));
    }

    [HttpPut("advances/{advanceId}/approve")]
    public async Task<IActionResult> ApproveAdvance(Guid advanceId, [FromBody] ApproveAdvanceDto dto)
    {
        var advance = await _db.TeacherSalaryAdvances.FindAsync(advanceId);
        if (advance == null) return NotFound();

        advance.Status = dto.Approve ? AdvanceStatus.Approved : AdvanceStatus.Rejected;
        advance.ApprovedDate = dto.Approve ? DateTime.UtcNow : null;
        if (dto.Approve)
        {
            advance.AdjustedInMonth = dto.AdjustedInMonth;
            advance.AdjustedInYear = dto.AdjustedInYear;
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = dto.Approve ? "Advance approved." : "Advance rejected.", status = advance.Status.ToString() });
    }

    // ─── Leave Management ─────────────────────────────────────

    [HttpGet("{id}/leaves")]
    public async Task<ActionResult<IEnumerable<TeacherLeaveDto>>> GetLeaves(
        Guid id, [FromQuery] string? status = null)
    {
        var teacher = await _db.Teachers.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);
        if (teacher == null) return NotFound();

        var q = _db.TeacherLeaves.AsNoTracking().Where(l => l.TeacherId == id);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<LeaveStatus>(status, true, out var leaveStatus))
            q = q.Where(l => l.Status == leaveStatus);

        var list = await q.OrderByDescending(l => l.FromDate)
            .Select(l => new TeacherLeaveDto(
                l.Id, l.TeacherId, teacher.FullName, teacher.EmployeeCode,
                l.LeaveType.ToString(), l.FromDate, l.ToDate,
                (int)(l.ToDate - l.FromDate).TotalDays + 1,
                l.Reason, l.Status.ToString(),
                l.ApprovedBy, l.ApprovedAt, l.RejectionReason, l.CreatedAt))
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost("leaves")]
    public async Task<ActionResult<TeacherLeaveDto>> ApplyLeave([FromBody] ApplyLeaveDto dto)
    {
        var teacher = await _db.Teachers.FindAsync(dto.TeacherId);
        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        if (!Enum.TryParse<LeaveType>(dto.LeaveType, true, out var leaveType))
            return BadRequest(new { message = "Invalid leave type." });

        if (dto.ToDate < dto.FromDate)
            return BadRequest(new { message = "ToDate must be after FromDate." });

        var leave = new TeacherLeave
        {
            TenantId = _currentUser.TenantId,
            TeacherId = dto.TeacherId,
            LeaveType = leaveType,
            FromDate = dto.FromDate.Date,
            ToDate = dto.ToDate.Date,
            Reason = dto.Reason?.Trim(),
            Status = LeaveStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _db.TeacherLeaves.Add(leave);
        await _db.SaveChangesAsync();

        return Ok(new TeacherLeaveDto(
            leave.Id, leave.TeacherId, teacher.FullName, teacher.EmployeeCode,
            leave.LeaveType.ToString(), leave.FromDate, leave.ToDate,
            (int)(leave.ToDate - leave.FromDate).TotalDays + 1,
            leave.Reason, leave.Status.ToString(),
            leave.ApprovedBy, leave.ApprovedAt, leave.RejectionReason, leave.CreatedAt));
    }

    [HttpPut("leaves/{leaveId}/approve")]
    public async Task<IActionResult> ApproveLeave(Guid leaveId, [FromBody] ApproveLeaveDto dto)
    {
        var leave = await _db.TeacherLeaves.FindAsync(leaveId);
        if (leave == null) return NotFound();

        leave.Status = dto.Approve ? LeaveStatus.Approved : LeaveStatus.Rejected;
        leave.ApprovedBy = _currentUser.UserId.ToString();
        leave.ApprovedAt = DateTime.UtcNow;
        leave.RejectionReason = dto.Approve ? null : dto.RejectionReason?.Trim();

        await _db.SaveChangesAsync();
        return Ok(new { message = dto.Approve ? "Leave approved." : "Leave rejected.", status = leave.Status.ToString() });
    }

    private static TeacherAttendanceStatus EvaluateSmartAttendanceStatus(TeacherAttendanceStatus declaredStatus, string? inTime, string? outTime)
    {
        if (declaredStatus == TeacherAttendanceStatus.Absent || declaredStatus == TeacherAttendanceStatus.Holiday || declaredStatus == TeacherAttendanceStatus.WeekOff)
            return declaredStatus;

        if (string.IsNullOrWhiteSpace(inTime) || string.IsNullOrWhiteSpace(outTime))
            return declaredStatus;

        var inMin = ParseTimeToMinutes(inTime);
        var outMin = ParseTimeToMinutes(outTime);
        if (inMin == null || outMin == null)
            return declaredStatus;

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
        if (diff > 0 && diff < 240)
        {
            // Duration under 4 hours is coaching standard Half Day
            return TeacherAttendanceStatus.HalfDay;
        }
        else if (diff >= 240)
        {
            // Reporting after 08:15 AM (495 mins) flags Late
            if (inMin.Value > 495 && declaredStatus == TeacherAttendanceStatus.Present)
            {
                return TeacherAttendanceStatus.Late;
            }
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
}

