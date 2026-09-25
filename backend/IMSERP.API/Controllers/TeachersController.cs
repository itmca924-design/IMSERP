using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using IMSERP.API.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
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
    private readonly IPasswordHasherService _passwordHasher;
    private readonly IWebHostEnvironment _env;

    public TeachersController(IIMSERPDbContext db, ICurrentUserService currentUser, IPasswordHasherService passwordHasher, IWebHostEnvironment env)
    {
        _db = db;
        _currentUser = currentUser;
        _passwordHasher = passwordHasher;
        _env = env;
    }

    // ─── Helper ──────────────────────────────────────────────
    private static TeacherDto MapTeacher(Teacher t, int batchCount) => new(
        t.Id, t.EmployeeCode, t.FullName, t.FatherName,
        t.Gender.ToString(), t.DateOfBirth, t.Qualification,
        t.Specialization, t.ExperienceYears, t.PhoneNumber,
        t.WhatsAppPhone, t.Email, t.Address, t.PhotoUrl,
        t.JoiningDate, t.LeavingDate, t.IsActive, t.CreatedAt, batchCount,
        t.BranchId, t.Branch?.Name,
        t.UserId, t.User?.Username, t.UserId.HasValue,
        t.IsTransportStaff, t.TransportAllocationId,
        t.TransportAllocation?.Route?.RouteName,
        t.TransportAllocation?.Stop?.StopName,
        t.TransportAllocation?.Vehicle?.VehicleNumber,
        t.IsHostelResident, t.HostelBedId,
        t.HostelBed?.Room?.Hostel?.Name,
        t.HostelBed?.Room?.RoomNumber,
        t.HostelBed?.BedCode,
        0, 0,
        t.StaffType.ToString(), t.Department, t.Designation);

    private async Task<bool> CanEditPublicHolidayOrSundayAsync()
    {
        if (_currentUser.UserId == Guid.Empty) return false;

        var user = await _db.Users.IgnoreQueryFilters().AsNoTracking()
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

    private async Task<bool> IsManualAttendanceAllowedAsync()
    {
        var settings = await _db.AttendanceSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);
        return !string.Equals(settings?.TeacherMode, "Biometric", StringComparison.OrdinalIgnoreCase);
    }

    private async Task<bool> HasAttendancePermissionAsync(string route, bool edit)
    {
        var user = await _db.Users.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);
        if (user == null) return false;
        if (user.Role == IMSERP.Domain.Enums.UserRole.SuperAdmin || user.Role == IMSERP.Domain.Enums.UserRole.InstituteAdmin || user.Role == IMSERP.Domain.Enums.UserRole.HR) return true;
        if (user.RoleId == null) return false;

        var hasDirect = await _db.RolePermissions.AsNoTracking()
            .Where(permission => permission.RoleId == user.RoleId && (edit ? permission.CanEdit : permission.CanCreate))
            .Join(_db.MenuItems, permission => permission.MenuItemId, menu => menu.Id, (permission, menu) => menu.RouteUrl)
            .AnyAsync(routeUrl => routeUrl == route);
        if (hasDirect) return true;

        // Fallback: If user has permission on /teachers/attendance, allow manual marking/correction
        if (route == "/attendance/permissions/manual" || route == "/attendance/permissions/correction")
        {
            return await _db.RolePermissions.AsNoTracking()
                .Where(permission => permission.RoleId == user.RoleId && (edit ? permission.CanEdit : (permission.CanCreate || permission.CanEdit)))
                .Join(_db.MenuItems, permission => permission.MenuItemId, menu => menu.Id, (permission, menu) => menu.RouteUrl)
                .AnyAsync(routeUrl => routeUrl == "/teachers/attendance");
        }

        return false;
    }

    // ─── Teacher CRUD ─────────────────────────────────────────

    /// <summary>
    /// Auto-generate next employee code for this tenant.
    /// Format: {TenantCode}-TCH-{001}  e.g. ACA-TCH-003
    /// </summary>
    [HttpGet("next-employee-code")]
    public async Task<ActionResult<object>> GetNextEmployeeCode([FromQuery] string? staffType = null)
    {
        var tenant = await _db.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == _currentUser.TenantId);

        var tenantPrefix = (tenant?.Code ?? "TCH").ToUpper();
        var typePrefix = (string.Equals(staffType, "NonTeaching", StringComparison.OrdinalIgnoreCase) || staffType == "2") ? "STF" : "TCH";

        // Count existing teachers for this tenant (already filtered by global query filter)
        var count = await _db.Teachers.CountAsync();
        var nextNumber = count + 1;

        // Generate code: e.g. ACA-TCH-001 or ACA-STF-001
        var code = $"{tenantPrefix}-{typePrefix}-{nextNumber:D3}";

        // Make sure this code doesn't already exist (loop until unique)
        while (await _db.Teachers.AnyAsync(t => t.EmployeeCode == code))
        {
            nextNumber++;
            code = $"{tenantPrefix}-{typePrefix}-{nextNumber:D3}";
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
    public async Task<ActionResult<IEnumerable<TeacherDto>>> GetTeachers([FromQuery] bool activeOnly = false, [FromQuery] string? staffType = null)
    {
        var q = _db.Teachers.AsNoTracking()
            .Include(t => t.BatchAssignments)
            .Include(t => t.Branch)
            .Include(t => t.User)
            .AsQueryable();
        if (activeOnly)
        {
            var settledTeacherIds = _db.TeacherFnFSettlements
                .Where(s => s.Status == "Settled")
                .Select(s => s.TeacherId);
            q = q.Where(t => t.IsActive && !settledTeacherIds.Contains(t.Id));
        }

        if (!string.IsNullOrWhiteSpace(staffType) && !string.Equals(staffType, "All", StringComparison.OrdinalIgnoreCase))
        {
            if (Enum.TryParse<StaffType>(staffType, true, out var parsedStaffType))
            {
                q = q.Where(t => t.StaffType == parsedStaffType);
            }
        }

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
        [FromQuery] bool? isActive = null,
        [FromQuery] string? staffType = null)
    {
        var q = _db.Teachers.AsNoTracking()
            .Include(t => t.BatchAssignments)
            .Include(t => t.Branch)
            .Include(t => t.User)
            .AsQueryable();

        if (isActive.HasValue)
        {
            q = q.Where(t => t.IsActive == isActive.Value);
            if (isActive.Value)
            {
                var settledTeacherIds = _db.TeacherFnFSettlements
                    .Where(s => s.Status == "Settled")
                    .Select(s => s.TeacherId);
                q = q.Where(t => !settledTeacherIds.Contains(t.Id));
            }
        }

        if (!string.IsNullOrWhiteSpace(staffType) && !string.Equals(staffType, "All", StringComparison.OrdinalIgnoreCase))
        {
            if (Enum.TryParse<StaffType>(staffType, true, out var parsedStaffType))
            {
                q = q.Where(t => t.StaffType == parsedStaffType);
            }
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            q = q.Where(t => t.FullName.ToLower().Contains(term) ||
                              t.EmployeeCode.ToLower().Contains(term) ||
                              (t.Specialization != null && t.Specialization.ToLower().Contains(term)) ||
                              (t.Department != null && t.Department.ToLower().Contains(term)) ||
                              (t.Designation != null && t.Designation.ToLower().Contains(term)) ||
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
            .Include(x => x.Branch)
            .Include(x => x.User)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (t == null) return NotFound();
        return Ok(MapTeacher(t, t.BatchAssignments.Count(a => a.IsActive)));
    }

    /// <summary>
    /// Creates or links an ERP login User account for this Teacher.
    /// </summary>
    [HttpPost("{id}/create-user")]
    public async Task<ActionResult<object>> CreateUserAccount(Guid id, [FromBody] CreateTeacherUserAccountDto dto)
    {
        var teacher = await _db.Teachers.Include(t => t.User).FirstOrDefaultAsync(t => t.Id == id);
        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        if (teacher.UserId.HasValue)
        {
            return BadRequest(new { message = "Teacher already has a linked login account." });
        }

        var username = dto.Username.Trim();
        var existingUser = await _db.Users.AnyAsync(u => u.Username.ToLower() == username.ToLower());
        if (existingUser)
        {
            return BadRequest(new { message = $"Username '{username}' is already taken." });
        }

        Guid roleId;
        if (dto.RoleId.HasValue && dto.RoleId.Value != Guid.Empty)
        {
            roleId = dto.RoleId.Value;
        }
        else
        {
            var teacherRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name.ToLower() == "teacher");
            if (teacherRole == null)
            {
                teacherRole = await _db.Roles.FirstOrDefaultAsync(r => r.IsActive);
            }
            roleId = teacherRole?.Id ?? Guid.NewGuid();
        }

        var user = new User
        {
            TenantId = _currentUser.TenantId,
            BranchId = teacher.BranchId ?? _currentUser.BranchId,
            Username = username,
            PasswordHash = _passwordHasher.HashPassword(dto.Password),
            FullName = teacher.FullName,
            Email = teacher.Email,
            PhoneNumber = teacher.PhoneNumber,
            Role = UserRole.Teacher,
            RoleId = roleId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        teacher.UserId = user.Id;
        await _db.SaveChangesAsync();

        return Ok(new { 
            message = "Teacher user account created successfully.", 
            userId = user.Id, 
            username = user.Username 
        });
    }

    [HttpPost]
    public async Task<ActionResult<TeacherDto>> CreateTeacher([FromBody] CreateTeacherDto dto)
    {
        var exists = await _db.Teachers.AnyAsync(t => t.EmployeeCode == dto.EmployeeCode.Trim());
        if (exists) return BadRequest(new { message = "Employee code already exists." });

        if (!Enum.TryParse<Gender>(dto.Gender, true, out var gender))
            return BadRequest(new { message = "Invalid gender value." });

        var targetBranchId = dto.BranchId ?? _currentUser.BranchId;
        if (!targetBranchId.HasValue || targetBranchId.Value == Guid.Empty)
        {
            var mainBranch = await _db.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.IsMainBranch);
            targetBranchId = mainBranch?.Id;
        }

        StaffType staffType = StaffType.Teaching;
        if (!string.IsNullOrWhiteSpace(dto.StaffType) && Enum.TryParse<StaffType>(dto.StaffType, true, out var st))
        {
            staffType = st;
        }

        var teacherId = Guid.NewGuid();
        string? savedPhoto = null;
        if (!string.IsNullOrWhiteSpace(dto.PhotoUrl))
        {
            savedPhoto = ImageStorageHelper.SaveBase64Image(dto.PhotoUrl, "teachers", teacherId.ToString(), _env.ContentRootPath) ?? dto.PhotoUrl.Trim();
        }

        var teacher = new Teacher
        {
            Id = teacherId,
            TenantId = _currentUser.TenantId,
            BranchId = targetBranchId,
            EmployeeCode = dto.EmployeeCode.Trim(),
            FullName = dto.FullName.Trim(),
            FatherName = dto.FatherName?.Trim(),
            Gender = gender,
            StaffType = staffType,
            Department = dto.Department?.Trim(),
            Designation = dto.Designation?.Trim(),
            DateOfBirth = dto.DateOfBirth,
            Qualification = dto.Qualification?.Trim(),
            Specialization = dto.Specialization?.Trim(),
            ExperienceYears = dto.ExperienceYears,
            PhoneNumber = dto.PhoneNumber.Trim(),
            WhatsAppPhone = dto.WhatsAppPhone?.Trim(),
            Email = dto.Email?.Trim(),
            Address = dto.Address?.Trim(),
            PhotoUrl = savedPhoto,
            JoiningDate = dto.JoiningDate,
            IsActive = dto.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        _db.Teachers.Add(teacher);
        await _db.SaveChangesAsync();

        if (teacher.BranchId.HasValue)
        {
            teacher.Branch = await _db.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == teacher.BranchId);
        }

        return Ok(MapTeacher(teacher, 0));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<TeacherDto>> UpdateTeacher(Guid id, [FromBody] CreateTeacherDto dto)
    {
        var teacher = await _db.Teachers.Include(t => t.BatchAssignments).Include(t => t.Branch).FirstOrDefaultAsync(t => t.Id == id);
        if (teacher == null) return NotFound();

        if (!Enum.TryParse<Gender>(dto.Gender, true, out var gender))
            return BadRequest(new { message = "Invalid gender value." });

        if (dto.BranchId.HasValue && dto.BranchId.Value != Guid.Empty)
        {
            teacher.BranchId = dto.BranchId.Value;
        }
        else if (!teacher.BranchId.HasValue && _currentUser.BranchId.HasValue)
        {
            teacher.BranchId = _currentUser.BranchId;
        }

        if (!string.IsNullOrWhiteSpace(dto.StaffType) && Enum.TryParse<StaffType>(dto.StaffType, true, out var stUpdate))
        {
            teacher.StaffType = stUpdate;
        }
        teacher.Department = dto.Department?.Trim();
        teacher.Designation = dto.Designation?.Trim();

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

        if (string.IsNullOrWhiteSpace(dto.PhotoUrl))
        {
            teacher.PhotoUrl = null;
        }
        else
        {
            teacher.PhotoUrl = ImageStorageHelper.SaveBase64Image(dto.PhotoUrl, "teachers", teacher.Id.ToString(), _env.ContentRootPath) ?? dto.PhotoUrl.Trim();
        }

        teacher.JoiningDate = dto.JoiningDate;
        teacher.IsActive = dto.IsActive;

        await _db.SaveChangesAsync();

        if (teacher.BranchId.HasValue && teacher.Branch == null)
        {
            teacher.Branch = await _db.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == teacher.BranchId);
        }

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
        int denominator = Math.Max(totalWorkingDays, evaluatedDays);
        if (denominator > 0)
        {
            decimal attendedEffective = present + late + (half * 0.5m);
            pct = Math.Min(100m, Math.Round((attendedEffective / (decimal)denominator) * 100, 1));
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
        var rawList = await _db.TeacherBatchAssignments.AsNoTracking()
            .Include(a => a.Teacher)
            .Include(a => a.Batch)
            .Include(a => a.Class)
            .Include(a => a.Section)
            .Where(a => a.TeacherId == id)
            .OrderByDescending(a => a.AssignedAt)
            .ToListAsync();

        var list = rawList.Select(a => new TeacherBatchAssignmentDto(
            a.Id, a.TeacherId, a.Teacher?.FullName ?? "", a.BatchId,
            a.Batch != null ? a.Batch.Name : (a.Class != null ? (a.Section != null ? $"{a.Class.Name} - {a.Section.Name}" : a.Class.Name) : "N/A"),
            a.Subject, a.DaysOfWeek, a.TimeSlot, a.IsActive, a.AssignedAt,
            a.ClassId, a.Class?.Name,
            a.SectionId, a.Section?.Name)).ToList();

        return Ok(list);
    }

    [HttpPost("batch-assignments")]
    public async Task<ActionResult<TeacherBatchAssignmentDto>> AssignBatch([FromBody] CreateTeacherBatchAssignmentDto dto)
    {
        var teacher = await _db.Teachers.FindAsync(dto.TeacherId);
        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        var isFnFSettled = await _db.TeacherFnFSettlements.AnyAsync(s => s.TeacherId == dto.TeacherId && s.Status == "Settled");
        if (!teacher.IsActive || isFnFSettled)
        {
            return BadRequest(new { message = $"Cannot assign batch: {teacher.FullName} is inactive or offboarded (FnF settled)." });
        }

        string displayName = string.Empty;
        string? className = null;
        string? sectionName = null;

        if (dto.BatchId.HasValue && dto.BatchId.Value != Guid.Empty)
        {
            var batch = await _db.Batches.FindAsync(dto.BatchId.Value);
            if (batch == null) return NotFound(new { message = "Batch not found." });
            displayName = batch.Name;
        }
        else if (dto.ClassId.HasValue && dto.ClassId.Value != Guid.Empty)
        {
            var cls = await _db.SchoolClasses.FindAsync(dto.ClassId.Value);
            if (cls == null) return NotFound(new { message = "School class not found." });
            className = cls.Name;

            if (dto.SectionId.HasValue && dto.SectionId.Value != Guid.Empty)
            {
                var sec = await _db.SchoolSections.FindAsync(dto.SectionId.Value);
                sectionName = sec?.Name;
            }
            displayName = string.IsNullOrEmpty(sectionName) ? cls.Name : $"{cls.Name} - {sectionName}";
        }
        else
        {
            return BadRequest(new { message = "Either Batch or School Class must be selected." });
        }

        var assignment = new TeacherBatchAssignment
        {
            TenantId = _currentUser.TenantId,
            TeacherId = dto.TeacherId,
            BatchId = dto.BatchId.HasValue && dto.BatchId.Value != Guid.Empty ? dto.BatchId : null,
            ClassId = dto.ClassId.HasValue && dto.ClassId.Value != Guid.Empty ? dto.ClassId : null,
            SectionId = dto.SectionId.HasValue && dto.SectionId.Value != Guid.Empty ? dto.SectionId : null,
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
            assignment.BatchId, displayName, assignment.Subject,
            assignment.DaysOfWeek, assignment.TimeSlot, assignment.IsActive, assignment.AssignedAt,
            assignment.ClassId, className, assignment.SectionId, sectionName));
    }

    [HttpPost("batch-assignments/bulk")]
    public async Task<ActionResult<IEnumerable<TeacherBatchAssignmentDto>>> AssignBatchesBulk([FromBody] BulkCreateTeacherBatchAssignmentDto dto)
    {
        var teacher = await _db.Teachers.FindAsync(dto.TeacherId);
        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        var isFnFSettled = await _db.TeacherFnFSettlements.AnyAsync(s => s.TeacherId == dto.TeacherId && s.Status == "Settled");
        if (!teacher.IsActive || isFnFSettled)
        {
            return BadRequest(new { message = $"Cannot assign batch: {teacher.FullName} is inactive or offboarded (FnF settled)." });
        }

        if (dto.Slots == null || dto.Slots.Count == 0)
        {
            return BadRequest(new { message = "At least one slot must be provided." });
        }

        var results = new List<TeacherBatchAssignmentDto>();

        foreach (var slot in dto.Slots)
        {
            string displayName = string.Empty;
            string? className = null;
            string? sectionName = null;

            if (slot.BatchId.HasValue && slot.BatchId.Value != Guid.Empty)
            {
                var batch = await _db.Batches.FindAsync(slot.BatchId.Value);
                if (batch == null) continue;
                displayName = batch.Name;
            }
            else if (slot.ClassId.HasValue && slot.ClassId.Value != Guid.Empty)
            {
                var cls = await _db.SchoolClasses.FindAsync(slot.ClassId.Value);
                if (cls == null) continue;
                className = cls.Name;

                if (slot.SectionId.HasValue && slot.SectionId.Value != Guid.Empty)
                {
                    var sec = await _db.SchoolSections.FindAsync(slot.SectionId.Value);
                    sectionName = sec?.Name;
                }
                displayName = string.IsNullOrEmpty(sectionName) ? cls.Name : $"{cls.Name} - {sectionName}";
            }
            else
            {
                continue;
            }

            var assignment = new TeacherBatchAssignment
            {
                TenantId = _currentUser.TenantId,
                TeacherId = dto.TeacherId,
                BatchId = slot.BatchId.HasValue && slot.BatchId.Value != Guid.Empty ? slot.BatchId : null,
                ClassId = slot.ClassId.HasValue && slot.ClassId.Value != Guid.Empty ? slot.ClassId : null,
                SectionId = slot.SectionId.HasValue && slot.SectionId.Value != Guid.Empty ? slot.SectionId : null,
                Subject = slot.Subject?.Trim() ?? string.Empty,
                DaysOfWeek = slot.DaysOfWeek?.Trim(),
                TimeSlot = slot.TimeSlot?.Trim(),
                IsActive = true,
                AssignedAt = DateTime.UtcNow
            };

            _db.TeacherBatchAssignments.Add(assignment);
            results.Add(new TeacherBatchAssignmentDto(
                assignment.Id, assignment.TeacherId, teacher.FullName,
                assignment.BatchId, displayName, assignment.Subject,
                assignment.DaysOfWeek, assignment.TimeSlot, assignment.IsActive, assignment.AssignedAt,
                assignment.ClassId, className, assignment.SectionId, sectionName));
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

    // ─── Teacher Reports & Analytics ──────────────────────────

    [HttpGet("reports/workload")]
    public async Task<ActionResult<TeacherWorkloadReportDto>> GetWorkloadReport()
    {
        var teachers = await _db.Teachers.AsNoTracking()
            .Where(t => t.IsActive && t.StaffType == StaffType.Teaching)
            .OrderBy(t => t.FullName)
            .ToListAsync();

        var assignments = await _db.TeacherBatchAssignments.AsNoTracking()
            .Include(a => a.Teacher)
            .Include(a => a.Batch)
                .ThenInclude(b => b!.Students)
            .Where(a => a.IsActive)
            .ToListAsync();

        var teacherItems = teachers.Select(t =>
        {
            var tAssignments = assignments.Where(a => a.TeacherId == t.Id).ToList();
            var assignedBatchesDto = tAssignments.Select(a => new TeacherBatchAssignmentDto(
                a.Id, a.TeacherId, t.FullName, a.BatchId,
                a.Batch?.Name ?? "Unknown Batch", a.Subject, a.DaysOfWeek, a.TimeSlot, a.IsActive, a.AssignedAt
            )).ToList();

            var weeklyClasses = tAssignments.Sum(a =>
                string.IsNullOrWhiteSpace(a.DaysOfWeek) ? 0 : a.DaysOfWeek.Split(',', StringSplitOptions.RemoveEmptyEntries).Length);

            var weeklyHours = tAssignments.Sum(a => CalculateWeeklyHours(a.DaysOfWeek, a.TimeSlot));

            var studentCount = tAssignments
                .Where(a => a.Batch != null)
                .SelectMany(a => a.Batch!.Students.Where(s => s.IsActive).Select(s => s.Id))
                .Distinct()
                .Count();

            return new TeacherWorkloadSummaryItemDto(
                t.Id,
                t.FullName,
                t.EmployeeCode,
                t.Qualification,
                t.Specialization,
                tAssignments.Count,
                weeklyClasses,
                weeklyHours,
                studentCount,
                assignedBatchesDto
            );
        }).ToList();

        var totalTeachers = teachers.Count;
        var totalAssignedBatches = assignments.Select(a => a.BatchId).Distinct().Count();
        var totalWeeklyClasses = teacherItems.Sum(i => i.WeeklyClassesCount);
        var totalWeeklyHours = teacherItems.Sum(i => i.WeeklyHours);
        var totalStudentsReached = assignments
            .Where(a => a.Batch != null)
            .SelectMany(a => a.Batch!.Students.Where(s => s.IsActive).Select(s => s.Id))
            .Distinct()
            .Count();

        return Ok(new TeacherWorkloadReportDto(
            totalTeachers,
            totalAssignedBatches,
            totalWeeklyClasses,
            totalWeeklyHours,
            totalStudentsReached,
            teacherItems
        ));
    }

    [HttpGet("reports/master-timetable")]
    public async Task<ActionResult<IEnumerable<TeacherBatchAssignmentDto>>> GetMasterTimetable()
    {
        var list = await _db.TeacherBatchAssignments.AsNoTracking()
            .Include(a => a.Teacher)
            .Include(a => a.Batch)
            .Where(a => a.IsActive && a.Teacher != null && a.Teacher.IsActive && a.Teacher.StaffType == StaffType.Teaching)
            .OrderBy(a => a.Teacher!.FullName)
            .ThenBy(a => a.Batch!.Name)
            .Select(a => new TeacherBatchAssignmentDto(
                a.Id, a.TeacherId, a.Teacher!.FullName, a.BatchId,
                a.Batch!.Name, a.Subject, a.DaysOfWeek, a.TimeSlot, a.IsActive, a.AssignedAt))
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("reports/batch-coverage")]
    public async Task<ActionResult<TeacherBatchCoverageReportDto>> GetBatchCoverageReport()
    {
        var batches = await _db.Batches.AsNoTracking()
            .Include(b => b.Students)
            .Include(b => b.Branch)
            .Include(b => b.Room)
            .OrderBy(b => b.Name)
            .ToListAsync();

        var schoolClasses = await _db.SchoolClasses.AsNoTracking()
            .Include(c => c.Sections)
                .ThenInclude(s => s.Room)
            .Where(c => c.IsActive)
            .OrderBy(c => c.DisplayOrder)
            .ThenBy(c => c.Name)
            .ToListAsync();

        var assignments = await _db.TeacherBatchAssignments.AsNoTracking()
            .Include(a => a.Teacher)
            .Include(a => a.Batch)
            .Include(a => a.Class)
            .Include(a => a.Section)
            .Where(a => a.IsActive)
            .ToListAsync();

        var assignedBatchIds = assignments.Where(a => a.BatchId.HasValue).Select(a => a.BatchId!.Value).ToHashSet();
        var assignedSectionIds = assignments.Where(a => a.SectionId.HasValue).Select(a => a.SectionId!.Value).ToHashSet();
        var assignedClassIds = assignments.Where(a => a.ClassId.HasValue && !a.SectionId.HasValue).Select(a => a.ClassId!.Value).ToHashSet();

        var unassignedUnits = new List<BatchDto>();

        // 1. Coaching Batches
        foreach (var b in batches.Where(b => !assignedBatchIds.Contains(b.Id)))
        {
            unassignedUnits.Add(new BatchDto(
                b.Id,
                b.Name,
                b.Subject,
                b.AcademicYear,
                b.StandardMonthlyFee,
                b.Students.Count,
                b.BranchId,
                b.Branch != null ? b.Branch.Name : null,
                b.RoomId,
                b.Room != null ? b.Room.RoomNumber : null,
                "Coaching",
                null,
                null,
                null
            ));
        }

        // 2. School Classes & Sections
        foreach (var cls in schoolClasses)
        {
            if (cls.Sections != null && cls.Sections.Count > 0)
            {
                foreach (var sec in cls.Sections.Where(s => s.IsActive))
                {
                    if (!assignedSectionIds.Contains(sec.Id))
                    {
                        var studentCount = await _db.Students.CountAsync(s => s.SectionId == sec.Id && s.IsActive);
                        unassignedUnits.Add(new BatchDto(
                            sec.Id,
                            $"{cls.Name} - {sec.Name}",
                            "School Curriculum",
                            "Current",
                            0,
                            studentCount,
                            sec.BranchId ?? cls.BranchId,
                            null,
                            sec.RoomId,
                            sec.Room != null ? sec.Room.RoomNumber : null,
                            "School",
                            cls.Id,
                            sec.Id,
                            sec.Name
                        ));
                    }
                }
            }
            else
            {
                if (!assignedClassIds.Contains(cls.Id))
                {
                    var studentCount = await _db.Students.CountAsync(s => s.ClassId == cls.Id && s.IsActive);
                    unassignedUnits.Add(new BatchDto(
                        cls.Id,
                        cls.Name,
                        "School Curriculum",
                        "Current",
                        0,
                        studentCount,
                        cls.BranchId,
                        null,
                        null,
                        null,
                        "School",
                        cls.Id,
                        null,
                        null
                    ));
                }
            }
        }

        // Total assignable teaching units = coaching batches + school class sections
        int totalSchoolUnits = schoolClasses.Sum(c => c.Sections != null && c.Sections.Count > 0 ? c.Sections.Count(s => s.IsActive) : 1);
        int totalUnits = batches.Count + totalSchoolUnits;
        int unassignedCount = unassignedUnits.Count;
        int assignedCount = totalUnits > unassignedCount ? totalUnits - unassignedCount : 0;
        var coveragePct = totalUnits == 0 ? 0m : Math.Round(((decimal)assignedCount / totalUnits) * 100m, 1);

        var allAssignmentsDto = assignments.Select(a => new TeacherBatchAssignmentDto(
            a.Id, a.TeacherId, a.Teacher?.FullName ?? "Unknown", a.BatchId,
            a.Batch != null ? a.Batch.Name : (a.Class != null ? (a.Section != null ? $"{a.Class.Name} - {a.Section.Name}" : a.Class.Name) : "Unknown"),
            a.Subject, a.DaysOfWeek, a.TimeSlot, a.IsActive, a.AssignedAt,
            a.ClassId, a.Class?.Name, a.SectionId, a.Section?.Name
        )).ToList();

        return Ok(new TeacherBatchCoverageReportDto(
            totalUnits,
            assignedCount,
            unassignedCount,
            coveragePct,
            unassignedUnits,
            allAssignmentsDto
        ));
    }

    [HttpGet("reports/payroll")]
    public async Task<ActionResult<TeacherMonthlyPayrollReportDto>> GetMonthlyPayrollReport(
        [FromQuery] int month = 0, [FromQuery] int year = 0)
    {
        if (month == 0) month = DateTime.UtcNow.Month;
        if (year == 0) year = DateTime.UtcNow.Year;

        var monthName = new DateTime(year, month, 1).ToString("MMMM yyyy");

        var activeTeachers = await _db.Teachers.AsNoTracking()
            .Where(t => t.IsActive)
            .ToListAsync();

        var payments = await _db.TeacherSalaryPayments.AsNoTracking()
            .Include(p => p.Teacher)
            .Where(p => p.PaymentMonth == month && p.PaymentYear == year)
            .OrderBy(p => p.Teacher != null ? p.Teacher.FullName : "")
            .Select(p => new TeacherSalaryPaymentDto(
                p.Id, p.TeacherId, p.Teacher != null ? p.Teacher.FullName : "Teacher",
                p.Teacher != null ? p.Teacher.EmployeeCode : "",
                p.PaymentMonth, p.PaymentYear, monthName,
                p.PaymentDate, p.GrossAmount, p.Deductions, p.AdvanceAdjusted, p.NetPaid,
                p.PaymentMode.ToString(), p.TransactionRef, p.ReceiptNumber,
                p.PresentDays, p.AbsentDays, p.Remarks
            ))
            .ToListAsync();

        var paidCount = payments.Count;
        var totalTeachers = activeTeachers.Count;
        var pendingCount = Math.Max(0, totalTeachers - paidCount);

        var totalGross = payments.Sum(p => p.GrossAmount);
        var totalDeductions = payments.Sum(p => p.Deductions);
        var totalAdvances = payments.Sum(p => p.AdvanceAdjusted);
        var totalNetPaid = payments.Sum(p => p.NetPaid);

        return Ok(new TeacherMonthlyPayrollReportDto(
            month,
            year,
            monthName,
            totalTeachers,
            paidCount,
            pendingCount,
            totalGross,
            totalDeductions,
            totalAdvances,
            totalNetPaid,
            payments
        ));
    }

    private static decimal CalculateWeeklyHours(string? daysOfWeek, string? timeSlot)
    {
        if (string.IsNullOrWhiteSpace(daysOfWeek)) return 0m;
        var dayCount = daysOfWeek.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Length;
        if (dayCount == 0) return 0m;

        decimal hoursPerClass = 1.5m;
        if (!string.IsNullOrWhiteSpace(timeSlot))
        {
            var parts = timeSlot.Split('-', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (parts.Length == 2 && DateTime.TryParse(parts[0], out var start) && DateTime.TryParse(parts[1], out var end))
            {
                var diff = (decimal)(end - start).TotalHours;
                if (diff > 0 && diff < 8) hoursPerClass = Math.Round(diff, 2);
            }
        }

        return Math.Round(dayCount * hoursPerClass, 1);
    }

    // ─── Attendance ───────────────────────────────────────────


    [HttpGet("attendance/ph-sun-edit-permission")]
    public async Task<ActionResult<object>> GetPublicHolidaySundayEditPermission()
    {
        return Ok(new { canEdit = await CanEditPublicHolidayOrSundayAsync() });
    }

    [HttpGet("attendance/report")]
    public async Task<ActionResult<AttendanceReportDto>> GetAttendanceReport(
        [FromQuery] int month = 0, [FromQuery] int year = 0)
    {
        if (month == 0) month = DateTime.UtcNow.Month;
        if (year == 0) year = DateTime.UtcNow.Year;

        var monthStart = new DateTime(year, month, 1);
        var monthEnd = new DateTime(year, month, DateTime.DaysInMonth(year, month));
        var offDates = await GetAttendanceOffDates(monthStart, monthEnd);
        var teachers = await _db.Teachers.AsNoTracking().Where(t => t.IsActive).OrderBy(t => t.FullName).ToListAsync();
        var teacherIds = teachers.Select(t => t.Id).ToList();
        var records = await _db.TeacherAttendances.AsNoTracking()
            .Where(a => teacherIds.Contains(a.TeacherId) && a.AttendanceDate >= monthStart && a.AttendanceDate <= monthEnd)
            .ToListAsync();

        var totalDaysInMonth = DateTime.DaysInMonth(year, month);
        var totalWorkingDays = Math.Max(0, totalDaysInMonth - offDates.Count);

        var rows = teachers.Select(teacher =>
        {
            var personRecords = records.Where(record => record.TeacherId == teacher.Id).ToList();
            var statuses = personRecords.Select(record => EvaluateSmartAttendanceStatus(record.Status, record.CheckInTime, record.CheckOutTime)).ToList();
            var present = statuses.Count(status => status == TeacherAttendanceStatus.Present);
            var absent = statuses.Count(status => status == TeacherAttendanceStatus.Absent);
            var late = statuses.Count(status => status == TeacherAttendanceStatus.Late);
            var half = statuses.Count(status => status == TeacherAttendanceStatus.HalfDay);

            var dailyMap = new List<string>();
            for (int day = 1; day <= totalDaysInMonth; day++)
            {
                var curDate = new DateTime(year, month, day);
                if (offDates.Contains(curDate.Date))
                {
                    dailyMap.Add($"{day}:OFF");
                }
                else
                {
                    var rec = personRecords.FirstOrDefault(r => r.AttendanceDate.Date == curDate.Date);
                    if (rec != null)
                    {
                        var st = EvaluateSmartAttendanceStatus(rec.Status, rec.CheckInTime, rec.CheckOutTime);
                        var code = st switch
                        {
                            TeacherAttendanceStatus.Present => "P",
                            TeacherAttendanceStatus.Absent => "A",
                            TeacherAttendanceStatus.Late => "L",
                            TeacherAttendanceStatus.HalfDay => "HD",
                            _ => "P"
                        };
                        dailyMap.Add($"{day}:{code}");
                    }
                    else
                    {
                        dailyMap.Add($"{day}:-");
                    }
                }
            }

            var attendedWeighted = present + late + (half * 0.5m);
            var evaluated = present + absent + late + half;
            var denominator = Math.Max(totalWorkingDays, evaluated);
            var attendancePercentage = (denominator == 0 || attendedWeighted == 0)
                ? 0m
                : Math.Min(100m, Math.Round((attendedWeighted / (decimal)denominator) * 100m, 1));

            return new AttendanceReportRowDto(
                teacher.Id,
                teacher.FullName,
                teacher.EmployeeCode,
                "Faculty",
                present,
                absent,
                late,
                half,
                offDates.Count,
                totalWorkingDays,
                attendancePercentage,
                string.Join(",", dailyMap)
            );
        }).ToList();

        return Ok(new AttendanceReportDto("Teacher", month, year, rows.Count, rows.Sum(row => row.PresentDays), rows.Sum(row => row.AbsentDays), rows.Sum(row => row.LateDays), rows.Sum(row => row.HalfDays), rows.Sum(row => row.HolidayDays), rows));
    }


    private async Task<HashSet<DateTime>> GetAttendanceOffDates(DateTime monthStart, DateTime monthEnd)
    {
        var offDates = new HashSet<DateTime>();
        for (var date = monthStart; date <= monthEnd; date = date.AddDays(1))
            if (date.DayOfWeek == DayOfWeek.Sunday) offDates.Add(date.Date);

        var holidays = await _db.Holidays.AsNoTracking()
            .Where(holiday => holiday.IsActive && holiday.StartDate.Date <= monthEnd && holiday.EndDate.Date >= monthStart)
            .ToListAsync();
        foreach (var holiday in holidays)
        {
            var start = holiday.StartDate.Date < monthStart ? monthStart : holiday.StartDate.Date;
            var end = holiday.EndDate.Date > monthEnd ? monthEnd : holiday.EndDate.Date;
            for (var date = start; date <= end; date = date.AddDays(1)) offDates.Add(date.Date);
        }
        return offDates;
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
            a.CheckInTime, a.CheckOutTime, a.Remarks, a.CaptureSource, a.CapturedAt)).ToList();

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
        int denominator = Math.Max(totalWorkingDays, evaluatedDays);
        if (denominator > 0)
        {
            decimal attendedEffective = present + late + (half * 0.5m);
            pct = Math.Min(100m, Math.Round((attendedEffective / (decimal)denominator) * 100, 1));
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
        if (!await HasAttendancePermissionAsync("/attendance/permissions/manual", false))
            return Forbid();

        if (!await IsManualAttendanceAllowedAsync())
            return Conflict(new { message = "Manual teacher attendance is disabled. Current mode is Biometric." });

        if (!await CanEditPublicHolidayOrSundayAsync() && await IsPublicHolidayOrSundayAsync(dto.AttendanceDate))
            return Forbid();

        var markedBy = _currentUser.UserId.ToString();
        foreach (var entry in dto.Entries)
        {
            if (!Enum.TryParse<TeacherAttendanceStatus>(entry.Status, true, out var status))
                continue;

            var existing = await _db.TeacherAttendances
                .FirstOrDefaultAsync(a => a.TeacherId == entry.TeacherId && a.AttendanceDate.Date == dto.AttendanceDate.Date);

            if (existing != null && !await HasAttendancePermissionAsync("/attendance/permissions/correction", true))
                return Forbid();

            var smartStatus = EvaluateSmartAttendanceStatus(status, entry.CheckInTime, entry.CheckOutTime);
            if (existing != null)
            {
                existing.Status = smartStatus;
                existing.CheckInTime = entry.CheckInTime;
                existing.CheckOutTime = entry.CheckOutTime;
                existing.Remarks = entry.Remarks;
                existing.CaptureSource = "Manual";
                existing.BiometricDeviceId = null;
                existing.BiometricEventId = null;
                existing.CapturedAt = null;
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
                    CaptureSource = "Manual",
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
        if (!await HasAttendancePermissionAsync("/attendance/permissions/manual", false))
            return Forbid();

        if (!await IsManualAttendanceAllowedAsync())
            return Conflict(new { message = "Manual teacher attendance is disabled. Current mode is Biometric." });

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

        if (existing != null && !await HasAttendancePermissionAsync("/attendance/permissions/correction", true))
            return Forbid();

        if (existing != null)
        {
            if (!existing.BranchId.HasValue && teacher.BranchId.HasValue)
            {
                existing.BranchId = teacher.BranchId;
            }
            existing.Status = smartStatus;
            existing.CheckInTime = dto.CheckInTime;
            existing.CheckOutTime = dto.CheckOutTime;
            existing.Remarks = dto.Remarks;
            existing.MarkedBy = _currentUser.UserId.ToString();
            existing.CaptureSource = "Manual";
            existing.BiometricDeviceId = null;
            existing.BiometricEventId = null;
            existing.CapturedAt = null;
        }
        else
        {
            existing = new TeacherAttendance
            {
                TenantId = _currentUser.TenantId,
                BranchId = teacher.BranchId ?? _currentUser.BranchId,
                TeacherId = id,
                AttendanceDate = date,
                Status = smartStatus,
                CheckInTime = dto.CheckInTime,
                CheckOutTime = dto.CheckOutTime,
                Remarks = dto.Remarks,
                CaptureSource = "Manual",
                MarkedBy = _currentUser.UserId.ToString(),
                CreatedAt = DateTime.UtcNow
            };
            _db.TeacherAttendances.Add(existing);
        }

        await _db.SaveChangesAsync();

        return Ok(new TeacherAttendanceDto(
            existing.Id, existing.TeacherId, teacher.FullName, teacher.EmployeeCode,
            existing.AttendanceDate, existing.Status.ToString(),
            existing.CheckInTime, existing.CheckOutTime, existing.Remarks, existing.CaptureSource, existing.CapturedAt));
    }

    [HttpDelete("attendance/{attendanceId}")]
    public async Task<IActionResult> DeleteAttendance(Guid attendanceId)
    {
        if (!await HasAttendancePermissionAsync("/attendance/permissions/correction", true))
            return Forbid();

        if (!await IsManualAttendanceAllowedAsync())
            return Conflict(new { message = "Manual teacher attendance changes are disabled in Biometric Only mode." });

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

        // Hostel rent deduction
        var hostelAlloc = await _db.HostelAllocations.AsNoTracking()
            .Include(a => a.Bed).ThenInclude(b => b!.Room)
            .FirstOrDefaultAsync(a => a.TeacherId == id && a.Status == "Active");
        decimal hostelRentDeduction = hostelAlloc != null ? hostelAlloc.MonthlyRent + hostelAlloc.MonthlyMessFee : 0m;
        string? hostelRentInfo = hostelAlloc != null
            ? $"Rm {hostelAlloc.Bed?.Room?.RoomNumber} (Bed {hostelAlloc.Bed?.BedCode}) — ₹{hostelAlloc.MonthlyRent:0}/mo rent" +
              (hostelAlloc.MonthlyMessFee > 0 ? $" + ₹{hostelAlloc.MonthlyMessFee:0}/mo mess" : "")
            : null;

        // Transport fare deduction (only if NOT a free perk)
        var transportAlloc = await _db.TransportAllocations.AsNoTracking()
            .Include(a => a.Route)
            .Include(a => a.Stop)
            .FirstOrDefaultAsync(a => a.TeacherId == id && a.Status == "Active");
        decimal transportFareDeduction = (transportAlloc != null && !transportAlloc.IsFreeAllocation) ? transportAlloc.MonthlyFare : 0m;
        string? transportFareInfo = transportAlloc != null
            ? $"{transportAlloc.Route?.RouteName} via {transportAlloc.Stop?.StopName}" +
              (transportAlloc.IsFreeAllocation ? " (Free Perk — ₹0)" : $" — ₹{transportAlloc.MonthlyFare:0}/mo")
            : null;

        decimal recommendedNet = Math.Max(0m, gross - (pf + tds + otherDeductions + totalAttendanceDeduction + pendingAdvance + hostelRentDeduction + transportFareDeduction));

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
            recommendedNet,
            hostelRentDeduction,
            transportFareDeduction,
            hostelRentInfo,
            transportFareInfo
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

        var isFnFSettled = await _db.TeacherFnFSettlements.AsNoTracking()
            .AnyAsync(s => s.TeacherId == dto.TeacherId && s.Status == "Settled");
        if (isFnFSettled)
            return BadRequest(new { message = $"Cannot record salary: {teacher.FullName} has already completed Full & Final Settlement (FNF) and is offboarded." });

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

    /// <summary>
    /// Dispatches Monthly Salary Slip details to Teacher's WhatsApp number.
    /// </summary>
    [HttpPost("salary-payments/{paymentId}/send-whatsapp")]
    public async Task<ActionResult<object>> SendSalarySlipWhatsApp(Guid paymentId, [FromServices] IWhatsAppService whatsApp)
    {
        var payment = await _db.TeacherSalaryPayments
            .Include(p => p.Teacher)
            .FirstOrDefaultAsync(p => p.Id == paymentId);

        if (payment == null) return NotFound(new { message = "Salary payment voucher not found." });

        var phone = !string.IsNullOrWhiteSpace(payment.Teacher?.WhatsAppPhone) 
            ? payment.Teacher.WhatsAppPhone 
            : payment.Teacher?.PhoneNumber;

        if (string.IsNullOrWhiteSpace(phone))
        {
            return BadRequest(new { message = "Teacher has no valid WhatsApp or Mobile phone number recorded." });
        }

        var monthName = new DateTime(payment.PaymentYear, payment.PaymentMonth, 1).ToString("MMMM");
        var success = await whatsApp.SendTeacherSalarySlipAsync(
            _currentUser.TenantId,
            phone,
            payment.Teacher!.FullName,
            monthName,
            payment.PaymentYear,
            payment.NetPaid,
            payment.ReceiptNumber
        );

        return Ok(new { success, message = success ? "Salary slip advice sent to Teacher on WhatsApp!" : "Failed to send WhatsApp message." });
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

    // ─── Teacher Exit & Full and Final Settlement (FnF) ────────

    /// <summary>
    /// Computes real-time preview of teacher dues, advances, library fines, and active assignments before FnF.
    /// </summary>
    [HttpGet("{id}/fnf-preview")]
    public async Task<ActionResult<TeacherFnFPreviewDto>> GetFnFPreview(Guid id)
    {
        var teacher = await _db.Teachers
            .Include(t => t.User)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id);
        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        // 1. Advance balance
        var advances = await _db.TeacherSalaryAdvances
            .Where(a => a.TeacherId == id && a.Status == AdvanceStatus.Approved)
            .SumAsync(a => a.Amount);

        // 2. Library checkouts and fines
        var circulations = await _db.LibraryCirculations
            .Where(c => c.TeacherId == id && c.ReturnDate == null)
            .ToListAsync();
        var pendingBooksCount = circulations.Count;
        var pendingLibraryFines = circulations.Sum(c => c.FineAmount);

        // 3. Batch assignments
        var assignments = await _db.TeacherBatchAssignments
            .Include(a => a.Batch)
            .Include(a => a.Class)
            .Include(a => a.Section)
            .Where(a => a.TeacherId == id && a.IsActive)
            .ToListAsync();
        var activeBatchesCount = assignments.Count;
        var activeNames = assignments.Select(a => a.Batch != null ? a.Batch.Name : (a.Class != null ? $"{a.Class.Name} - {a.Section?.Name}" : "Assignment")).Distinct().ToList();

        // 4. Class teacher sections
        var sections = await _db.SchoolSections
            .Include(s => s.Class)
            .Where(s => s.ClassTeacherId == id && s.IsActive)
            .ToListAsync();
        var assignedSectionsCount = sections.Count;
        activeNames.AddRange(sections.Select(s => $"Class Teacher: {s.Class?.Name} - {s.Name}"));

        // 5. Salary structure
        var salary = await _db.TeacherSalaries
            .Where(s => s.TeacherId == id && s.IsActive)
            .OrderByDescending(s => s.EffectiveFrom)
            .FirstOrDefaultAsync();
        var basic = salary?.BasicSalary ?? 0;
        var gross = salary?.GrossSalary ?? basic;
        var perDayRate = gross > 0 ? Math.Round(gross / 30m, 2) : 0;

        // 6. Current month attendance & salary payment check
        var now = DateTime.UtcNow;
        var presentDays = await _db.TeacherAttendances
            .CountAsync(a => a.TeacherId == id && a.AttendanceDate.Year == now.Year && a.AttendanceDate.Month == now.Month && (a.Status == TeacherAttendanceStatus.Present || a.Status == TeacherAttendanceStatus.Late));
        var suggestedUnpaid = Math.Round(presentDays * perDayRate, 2);

        // Check if regular salary payment already exists for this final month
        var finalMonthPayment = await _db.TeacherSalaryPayments.AsNoTracking()
            .FirstOrDefaultAsync(p => p.TeacherId == id && p.PaymentMonth == now.Month && p.PaymentYear == now.Year);
        bool isFinalMonthSalaryPaid = finalMonthPayment != null;
        string? finalMonthSalaryReceiptNumber = finalMonthPayment?.ReceiptNumber;
        decimal finalMonthSalaryPaidAmount = finalMonthPayment?.NetPaid ?? 0m;
        DateTime? finalMonthSalaryPaymentDate = finalMonthPayment?.PaymentDate;

        // If salary for the final month was already paid, prevent double payment by setting suggestedUnpaid to 0
        if (isFinalMonthSalaryPaid)
        {
            suggestedUnpaid = 0m;
        }

        // Check if teacher already has an existing settled FNF
        bool isFnFAlreadySettled = await _db.TeacherFnFSettlements.AsNoTracking()
            .AnyAsync(s => s.TeacherId == id && s.Status == "Settled");

        // 7. Transport clearance (live check)
        var transportAlloc = await _db.TransportAllocations
            .AsNoTracking()
            .Include(a => a.Route)
            .Include(a => a.Stop)
            .FirstOrDefaultAsync(a => a.TeacherId == id && a.Status == "Active");
        bool isTransportStaff = transportAlloc != null;

        // 8. Hostel clearance (live check)
        var hostelAlloc = await _db.HostelAllocations
            .AsNoTracking()
            .Include(a => a.Bed).ThenInclude(b => b!.Room).ThenInclude(r => r!.Hostel)
            .FirstOrDefaultAsync(a => a.TeacherId == id && a.Status == "Active");
        bool isHostelResident = hostelAlloc != null;

        return Ok(new TeacherFnFPreviewDto(
            teacher.Id,
            teacher.FullName,
            teacher.EmployeeCode,
            teacher.PhoneNumber,
            teacher.Email,
            teacher.Specialization,
            teacher.JoiningDate,
            basic,
            gross,
            perDayRate,
            presentDays,
            suggestedUnpaid,
            advances,
            pendingBooksCount,
            pendingLibraryFines,
            activeBatchesCount,
            assignedSectionsCount,
            activeNames,
            teacher.UserId.HasValue,
            teacher.User?.Username,
            // Transport clearance
            isTransportStaff,
            transportAlloc?.Route?.RouteName,
            transportAlloc?.Stop?.StopName,
            transportAlloc?.Id,
            // Hostel clearance
            isHostelResident,
            hostelAlloc?.Bed?.BedCode,
            hostelAlloc?.Bed?.Room?.RoomNumber,
            hostelAlloc?.Id,
            // Final month salary check & FNF status
            isFinalMonthSalaryPaid,
            finalMonthSalaryReceiptNumber,
            finalMonthSalaryPaidAmount,
            finalMonthSalaryPaymentDate,
            isFnFAlreadySettled
        ));
    }

    /// <summary>
    /// Lists all FnF settlements across the institute.
    /// </summary>
    [HttpGet("fnf-settlements")]
    public async Task<ActionResult<IEnumerable<TeacherFnFSettlementDto>>> GetFnFSettlements()
    {
        // Self-heal: ensure any past settled teachers have their allocations vacated / discontinued / returned
        var settledTeacherIds = await _db.TeacherFnFSettlements
            .Where(s => s.Status == "Settled")
            .Select(s => s.TeacherId)
            .Distinct()
            .ToListAsync();

        if (settledTeacherIds.Count > 0)
        {
            bool hadOrphans = false;
            var activeHostel = await _db.HostelAllocations
                .Include(a => a.Bed)
                .Where(a => a.Status == "Active" && a.TeacherId.HasValue && settledTeacherIds.Contains(a.TeacherId.Value))
                .ToListAsync();
            foreach (var ha in activeHostel)
            {
                ha.Status = "Vacated";
                ha.VacatedDate = DateTime.UtcNow;
                ha.Remarks = (ha.Remarks != null ? ha.Remarks + " | " : "") + "Auto-vacated: Teacher settled in F&F";
                if (ha.Bed != null)
                {
                    ha.Bed.Status = "Available";
                    ha.Bed.CurrentStudentId = null;
                }
                hadOrphans = true;
            }

            var activeTransport = await _db.TransportAllocations
                .Where(a => a.Status == "Active" && a.TeacherId.HasValue && settledTeacherIds.Contains(a.TeacherId.Value))
                .ToListAsync();
            foreach (var ta in activeTransport)
            {
                ta.Status = "Discontinued";
                ta.EffectiveTo = DateTime.UtcNow;
                ta.Remarks = (ta.Remarks != null ? ta.Remarks + " | " : "") + "Auto-discontinued: Teacher settled in F&F";
                hadOrphans = true;
            }

            var activeCircs = await _db.LibraryCirculations
                .Include(c => c.BookCopy)
                .Where(c => (c.Status == "Issued" || c.Status == "Overdue") && c.TeacherId.HasValue && settledTeacherIds.Contains(c.TeacherId.Value))
                .ToListAsync();
            foreach (var lc in activeCircs)
            {
                lc.ReturnDate = DateTime.UtcNow;
                lc.Status = "Returned";
                lc.FineStatus = "Paid";
                lc.Remarks = (lc.Remarks != null ? lc.Remarks + " | " : "") + "Auto-returned: Teacher settled in F&F";
                if (lc.BookCopy != null)
                {
                    lc.BookCopy.Status = "Available";
                }
                hadOrphans = true;
            }

            if (hadOrphans)
            {
                var teachersToUpdate = await _db.Teachers
                    .Where(t => settledTeacherIds.Contains(t.Id) && (t.IsHostelResident || t.IsTransportStaff || t.HostelBedId != null || t.TransportAllocationId != null))
                    .ToListAsync();
                foreach (var t in teachersToUpdate)
                {
                    t.IsHostelResident = false;
                    t.HostelBedId = null;
                    t.IsTransportStaff = false;
                    t.TransportAllocationId = null;
                }

                await _db.SaveChangesAsync();
            }

            // Clean up accidental duplicate zero-value FNF records for teachers who already have an earlier real settlement
            var allSettledList = await _db.TeacherFnFSettlements
                .Where(s => s.Status == "Settled")
                .ToListAsync();

            var duplicateSettlementGroups = allSettledList
                .GroupBy(s => s.TeacherId)
                .Where(g => g.Count() > 1)
                .ToList();

            if (duplicateSettlementGroups.Count > 0)
            {
                var duplicatesToRemove = new List<TeacherFnFSettlement>();
                foreach (var grp in duplicateSettlementGroups)
                {
                    var ordered = grp.OrderBy(x => x.CreatedAt).ToList();
                    // Keep the first (original) settlement; remove subsequent accidental zero-amount duplicates
                    var subsequentZeroDupes = ordered.Skip(1).Where(x => x.NetPayableAmount == 0m).ToList();
                    duplicatesToRemove.AddRange(subsequentZeroDupes);
                }
                if (duplicatesToRemove.Count > 0)
                {
                    _db.TeacherFnFSettlements.RemoveRange(duplicatesToRemove);
                    await _db.SaveChangesAsync();
                }
            }
        }

        var rawList = await _db.TeacherFnFSettlements
            .Include(s => s.Teacher)
            .AsNoTracking()
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        var dtos = rawList.Select(s => new TeacherFnFSettlementDto(
            s.Id, s.TenantId, s.BranchId, s.TeacherId,
            s.Teacher?.FullName ?? "Unknown",
            s.Teacher?.EmployeeCode ?? "N/A",
            s.Teacher?.Specialization,
            s.Teacher?.JoiningDate ?? s.CreatedAt,
            s.ResignationDate, s.LastWorkingDate, s.ReasonForLeaving, s.Remarks,
            s.AcademicClearance, s.LibraryClearance, s.AssetClearance, s.HostelClearance,
            s.AllClearancesApproved, s.ClearanceApprovedBy,
            s.WorkingDaysInFinalMonth, s.PerDaySalaryRate, s.UnpaidSalary,
            s.EarnedLeaveEncashment, s.GratuityOrBonus, s.OtherAdditions, s.TotalEarnings,
            s.PendingAdvanceDeduction, s.NoticeShortfallDeduction, s.LibraryDuesDeduction,
            s.AssetLossDeduction, s.OtherDeductions, s.TotalDeductions, s.NetPayableAmount,
            s.Status, s.SettlementDate, s.PaymentMode, s.PaymentReference, s.SettlementVoucherNo,
            s.RelievingLetterIssued, s.ExperienceCertificateIssued, s.CreatedAt
        )).ToList();

        return Ok(dtos);
    }

    /// <summary>
    /// Retrieves a single settlement with full details for printing statement or relieving certificate.
    /// </summary>
    [HttpGet("fnf-settlements/{settlementId}")]
    public async Task<ActionResult<TeacherFnFSettlementDto>> GetFnFSettlementById(Guid settlementId)
    {
        var s = await _db.TeacherFnFSettlements
            .Include(x => x.Teacher)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == settlementId);
        if (s == null) return NotFound(new { message = "Settlement record not found." });

        return Ok(new TeacherFnFSettlementDto(
            s.Id, s.TenantId, s.BranchId, s.TeacherId,
            s.Teacher?.FullName ?? "Unknown",
            s.Teacher?.EmployeeCode ?? "N/A",
            s.Teacher?.Specialization,
            s.Teacher?.JoiningDate ?? s.CreatedAt,
            s.ResignationDate, s.LastWorkingDate, s.ReasonForLeaving, s.Remarks,
            s.AcademicClearance, s.LibraryClearance, s.AssetClearance, s.HostelClearance,
            s.AllClearancesApproved, s.ClearanceApprovedBy,
            s.WorkingDaysInFinalMonth, s.PerDaySalaryRate, s.UnpaidSalary,
            s.EarnedLeaveEncashment, s.GratuityOrBonus, s.OtherAdditions, s.TotalEarnings,
            s.PendingAdvanceDeduction, s.NoticeShortfallDeduction, s.LibraryDuesDeduction,
            s.AssetLossDeduction, s.OtherDeductions, s.TotalDeductions, s.NetPayableAmount,
            s.Status, s.SettlementDate, s.PaymentMode, s.PaymentReference, s.SettlementVoucherNo,
            s.RelievingLetterIssued, s.ExperienceCertificateIssued, s.CreatedAt
        ));
    }

    /// <summary>
    /// Creates and processes an FnF settlement, offboarding the teacher, locking login user, releasing batches, and adjusting advances.
    /// </summary>
    [HttpPost("{id}/fnf-settlements")]
    public async Task<ActionResult<TeacherFnFSettlementDto>> CreateFnFSettlement(Guid id, [FromBody] CreateTeacherFnFRequestDto dto)
    {
        var teacher = await _db.Teachers
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Id == id);
        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        var existingSettled = await _db.TeacherFnFSettlements
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TeacherId == id && s.Status == "Settled");
        if (existingSettled != null)
        {
            return BadRequest(new { message = $"Full & Final Settlement for {teacher.FullName} has already been finalized under voucher {existingSettled.SettlementVoucherNo}. Duplicate settlement cannot be processed." });
        }

        var totalEarnings = dto.UnpaidSalary + dto.EarnedLeaveEncashment + dto.GratuityOrBonus + dto.OtherAdditions;
        var totalDeductions = dto.PendingAdvanceDeduction + dto.NoticeShortfallDeduction + dto.LibraryDuesDeduction + dto.AssetLossDeduction + dto.OtherDeductions;
        var netPayable = totalEarnings - totalDeductions;

        var allClear = dto.AcademicClearance && dto.LibraryClearance && dto.AssetClearance && dto.HostelClearance;
        var voucherNo = $"FNF-{DateTime.UtcNow:yyyyMM}-{new Random().Next(100, 999)}";

        var settlement = new TeacherFnFSettlement
        {
            TenantId = _currentUser.TenantId,
            BranchId = teacher.BranchId ?? _currentUser.BranchId,
            TeacherId = id,
            ResignationDate = dto.ResignationDate,
            LastWorkingDate = dto.LastWorkingDate,
            ReasonForLeaving = dto.ReasonForLeaving,
            Remarks = dto.Remarks,
            AcademicClearance = dto.AcademicClearance,
            LibraryClearance = dto.LibraryClearance,
            AssetClearance = dto.AssetClearance,
            HostelClearance = dto.HostelClearance,
            AllClearancesApproved = allClear,
            ClearanceApprovedBy = "Principal / Authorized Admin",
            WorkingDaysInFinalMonth = dto.WorkingDaysInFinalMonth,
            PerDaySalaryRate = dto.WorkingDaysInFinalMonth > 0 ? Math.Round(dto.UnpaidSalary / dto.WorkingDaysInFinalMonth, 2) : 0,
            UnpaidSalary = dto.UnpaidSalary,
            EarnedLeaveEncashment = dto.EarnedLeaveEncashment,
            GratuityOrBonus = dto.GratuityOrBonus,
            OtherAdditions = dto.OtherAdditions,
            TotalEarnings = totalEarnings,
            PendingAdvanceDeduction = dto.PendingAdvanceDeduction,
            NoticeShortfallDeduction = dto.NoticeShortfallDeduction,
            LibraryDuesDeduction = dto.LibraryDuesDeduction,
            AssetLossDeduction = dto.AssetLossDeduction,
            OtherDeductions = dto.OtherDeductions,
            TotalDeductions = totalDeductions,
            NetPayableAmount = netPayable,
            Status = dto.FinalizeNow ? "Settled" : "Draft",
            SettlementDate = dto.FinalizeNow ? DateTime.UtcNow : null,
            PaymentMode = dto.PaymentMode ?? "BankTransfer",
            PaymentReference = dto.PaymentReference,
            SettlementVoucherNo = voucherNo,
            RelievingLetterIssued = true,
            ExperienceCertificateIssued = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.TeacherFnFSettlements.Add(settlement);

        if (dto.FinalizeNow)
        {
            // 1. Offboard Teacher
            teacher.IsActive = false;
            teacher.LeavingDate = dto.LastWorkingDate;

            // 2. Lockout ERP Login User Account
            if (teacher.UserId.HasValue)
            {
                var user = await _db.Users.FindAsync(teacher.UserId.Value);
                if (user != null) user.IsActive = false;
            }

            // 3. Release batch assignments
            var assignments = await _db.TeacherBatchAssignments
                .Where(a => a.TeacherId == id && a.IsActive)
                .ToListAsync();
            foreach (var a in assignments) a.IsActive = false;

            // 4. Release School Class Teacher assignments
            var sections = await _db.SchoolSections
                .Where(s => s.ClassTeacherId == id)
                .ToListAsync();
            foreach (var s in sections) s.ClassTeacherId = null;

            // 5. Adjust pending advances
            if (dto.PendingAdvanceDeduction > 0)
            {
                var advances = await _db.TeacherSalaryAdvances
                    .Where(a => a.TeacherId == id && a.Status == AdvanceStatus.Approved)
                    .ToListAsync();
                foreach (var a in advances)
                {
                    a.Status = AdvanceStatus.Adjusted;
                    a.AdjustedInMonth = dto.LastWorkingDate.Month;
                    a.AdjustedInYear = dto.LastWorkingDate.Year;
                }
            }

            // 6. Release Hostel, Transport, and Library allocations upon F&F finalization
            await CleanupRelievedTeacherAllocationsAsync(id, dto.LastWorkingDate);
            teacher.HostelBedId = null;
            teacher.IsHostelResident = false;
            teacher.TransportAllocationId = null;
            teacher.IsTransportStaff = false;
        }

        await _db.SaveChangesAsync();

        return Ok(new TeacherFnFSettlementDto(
            settlement.Id, settlement.TenantId, settlement.BranchId, settlement.TeacherId,
            teacher.FullName, teacher.EmployeeCode, teacher.Specialization,
            teacher.JoiningDate, settlement.ResignationDate, settlement.LastWorkingDate,
            settlement.ReasonForLeaving, settlement.Remarks,
            settlement.AcademicClearance, settlement.LibraryClearance, settlement.AssetClearance, settlement.HostelClearance,
            settlement.AllClearancesApproved, settlement.ClearanceApprovedBy,
            settlement.WorkingDaysInFinalMonth, settlement.PerDaySalaryRate, settlement.UnpaidSalary,
            settlement.EarnedLeaveEncashment, settlement.GratuityOrBonus, settlement.OtherAdditions, settlement.TotalEarnings,
            settlement.PendingAdvanceDeduction, settlement.NoticeShortfallDeduction, settlement.LibraryDuesDeduction,
            settlement.AssetLossDeduction, settlement.OtherDeductions, settlement.TotalDeductions, settlement.NetPayableAmount,
            settlement.Status, settlement.SettlementDate, settlement.PaymentMode, settlement.PaymentReference, settlement.SettlementVoucherNo,
            settlement.RelievingLetterIssued, settlement.ExperienceCertificateIssued, settlement.CreatedAt
        ));
    }

    private async Task CleanupRelievedTeacherAllocationsAsync(Guid teacherId, DateTime effectiveDate)
    {
        // 1. Release Hostel Allocation & Beds
        var hostelAllocations = await _db.HostelAllocations
            .Include(a => a.Bed)
            .Where(a => a.TeacherId == teacherId && a.Status == "Active")
            .ToListAsync();
        foreach (var ha in hostelAllocations)
        {
            ha.Status = "Vacated";
            ha.VacatedDate = effectiveDate;
            ha.Remarks = (ha.Remarks != null ? ha.Remarks + " | " : "") + "Vacated via F&F Settlement";
            if (ha.Bed != null)
            {
                ha.Bed.Status = "Available";
                ha.Bed.CurrentStudentId = null;
            }
        }

        // 2. Release Transport Allocation
        var transportAllocations = await _db.TransportAllocations
            .Where(a => a.TeacherId == teacherId && a.Status == "Active")
            .ToListAsync();
        foreach (var ta in transportAllocations)
        {
            ta.Status = "Discontinued";
            ta.EffectiveTo = effectiveDate;
            ta.Remarks = (ta.Remarks != null ? ta.Remarks + " | " : "") + "Discontinued via F&F Settlement";
        }

        // 3. Return Library Books & Clear Fines
        var libraryCirculations = await _db.LibraryCirculations
            .Include(c => c.BookCopy)
            .Where(c => c.TeacherId == teacherId && (c.Status == "Issued" || c.Status == "Overdue"))
            .ToListAsync();
        foreach (var lc in libraryCirculations)
        {
            lc.ReturnDate = effectiveDate;
            lc.Status = "Returned";
            lc.FineStatus = "Paid";
            lc.Remarks = (lc.Remarks != null ? lc.Remarks + " | " : "") + "Returned & fine cleared via F&F Settlement";
            if (lc.BookCopy != null)
            {
                lc.BookCopy.Status = "Available";
            }
        }
    }

    // =========================================================================
    // PART 2: TEACHER SUBSTITUTION / PROXY
    // =========================================================================

    [HttpGet("substitutions")]
    public async Task<ActionResult<IEnumerable<TeacherSubstitutionDto>>> GetSubstitutions(
        [FromQuery] DateTime? date,
        [FromQuery] Guid? teacherId,
        [FromQuery] string? status)
    {
        var query = _db.TeacherSubstitutions
            .Include(s => s.OriginalTeacher)
            .Include(s => s.SubstituteTeacher)
            .Include(s => s.Batch)
            .Include(s => s.ClassSection)
                .ThenInclude(cs => cs!.Class)
            .AsNoTracking();

        if (date.HasValue)
        {
            var targetDate = date.Value.Date;
            query = query.Where(s => s.SubstitutionDate.Date == targetDate);
        }

        if (teacherId.HasValue)
        {
            query = query.Where(s => s.OriginalTeacherId == teacherId.Value || s.SubstituteTeacherId == teacherId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(s => s.Status == status);
        }

        var list = await query.OrderByDescending(s => s.SubstitutionDate).ThenBy(s => s.TimeSlot).ToListAsync();

        var dtos = list.Select(s => new TeacherSubstitutionDto(
            s.Id,
            s.SubstitutionDate,
            s.OriginalTeacherId,
            s.OriginalTeacher?.FullName ?? "Unknown",
            s.OriginalTeacher?.EmployeeCode ?? "",
            s.SubstituteTeacherId,
            s.SubstituteTeacher?.FullName ?? "Unknown",
            s.SubstituteTeacher?.EmployeeCode ?? "",
            s.BatchId,
            s.Batch?.Name,
            s.ClassSectionId,
            s.ClassSection != null ? $"{s.ClassSection.Class?.Name} - {s.ClassSection.Name}" : null,
            s.SubjectId,
            s.SubjectName,
            s.TimeSlot,
            s.RoomNumber,
            s.TopicToCover,
            s.Reason,
            s.Status,
            s.ProxyAllowance,
            s.Remarks,
            s.AssignedBy,
            s.CreatedAt
        ));

        return Ok(dtos);
    }

    [HttpPost("substitutions")]
    public async Task<ActionResult<TeacherSubstitutionDto>> CreateSubstitution([FromBody] CreateTeacherSubstitutionDto dto)
    {
        if (dto.OriginalTeacherId == dto.SubstituteTeacherId)
            return BadRequest(new { message = "Original teacher and substitute teacher cannot be the same person." });

        var orig = await _db.Teachers.FindAsync(dto.OriginalTeacherId);
        var sub = await _db.Teachers.FindAsync(dto.SubstituteTeacherId);
        if (orig == null || sub == null)
            return BadRequest(new { message = "Selected teacher not found." });

        var record = new TeacherSubstitution
        {
            TenantId = _currentUser.TenantId,
            BranchId = _currentUser.BranchId,
            SubstitutionDate = dto.SubstitutionDate.Date,
            OriginalTeacherId = dto.OriginalTeacherId,
            SubstituteTeacherId = dto.SubstituteTeacherId,
            BatchId = dto.BatchId,
            ClassSectionId = dto.ClassSectionId,
            SubjectId = dto.SubjectId,
            SubjectName = dto.SubjectName,
            TimeSlot = dto.TimeSlot,
            RoomNumber = dto.RoomNumber,
            TopicToCover = dto.TopicToCover,
            Reason = dto.Reason,
            Status = "Assigned",
            ProxyAllowance = dto.ProxyAllowance,
            Remarks = dto.Remarks,
            AssignedBy = User.Identity?.Name ?? "Admin"
        };

        _db.TeacherSubstitutions.Add(record);
        await _db.SaveChangesAsync();

        var created = await _db.TeacherSubstitutions
            .Include(s => s.OriginalTeacher)
            .Include(s => s.SubstituteTeacher)
            .Include(s => s.Batch)
            .Include(s => s.ClassSection).ThenInclude(cs => cs!.Class)
            .FirstAsync(s => s.Id == record.Id);

        return Ok(new TeacherSubstitutionDto(
            created.Id,
            created.SubstitutionDate,
            created.OriginalTeacherId,
            created.OriginalTeacher?.FullName ?? "",
            created.OriginalTeacher?.EmployeeCode ?? "",
            created.SubstituteTeacherId,
            created.SubstituteTeacher?.FullName ?? "",
            created.SubstituteTeacher?.EmployeeCode ?? "",
            created.BatchId,
            created.Batch?.Name,
            created.ClassSectionId,
            created.ClassSection != null ? $"{created.ClassSection.Class?.Name} - {created.ClassSection.Name}" : null,
            created.SubjectId,
            created.SubjectName,
            created.TimeSlot,
            created.RoomNumber,
            created.TopicToCover,
            created.Reason,
            created.Status,
            created.ProxyAllowance,
            created.Remarks,
            created.AssignedBy,
            created.CreatedAt
        ));
    }

    [HttpPut("substitutions/{id}")]
    public async Task<IActionResult> UpdateSubstitution(Guid id, [FromBody] UpdateTeacherSubstitutionDto dto)
    {
        var record = await _db.TeacherSubstitutions.FindAsync(id);
        if (record == null) return NotFound();

        record.Status = dto.Status;
        if (dto.Remarks != null) record.Remarks = dto.Remarks;
        if (dto.ProxyAllowance.HasValue) record.ProxyAllowance = dto.ProxyAllowance.Value;
        record.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Substitution updated successfully." });
    }

    [HttpDelete("substitutions/{id}")]
    public async Task<IActionResult> DeleteSubstitution(Guid id)
    {
        var record = await _db.TeacherSubstitutions.FindAsync(id);
        if (record == null) return NotFound();

        _db.TeacherSubstitutions.Remove(record);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Substitution deleted successfully." });
    }

    // =========================================================================
    // PART 2: DAILY LESSON PLANS & TEACHER DIARY
    // =========================================================================

    [HttpGet("lesson-plans")]
    public async Task<ActionResult<IEnumerable<TeacherLessonPlanDto>>> GetLessonPlans(
        [FromQuery] Guid? teacherId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] string? status)
    {
        var query = _db.TeacherLessonPlans
            .Include(p => p.Teacher)
            .Include(p => p.Batch)
            .Include(p => p.ClassSection)
                .ThenInclude(cs => cs!.Class)
            .AsNoTracking();

        if (teacherId.HasValue)
        {
            query = query.Where(p => p.TeacherId == teacherId.Value);
        }

        if (fromDate.HasValue)
        {
            query = query.Where(p => p.PlanDate >= fromDate.Value.Date);
        }

        if (toDate.HasValue)
        {
            query = query.Where(p => p.PlanDate <= toDate.Value.Date);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(p => p.Status == status);
        }

        var list = await query.OrderByDescending(p => p.PlanDate).ThenByDescending(p => p.CreatedAt).ToListAsync();

        var dtos = list.Select(p => new TeacherLessonPlanDto(
            p.Id,
            p.TeacherId,
            p.Teacher?.FullName ?? "Unknown",
            p.Teacher?.EmployeeCode ?? "",
            p.PlanDate,
            p.BatchId,
            p.Batch?.Name,
            p.ClassSectionId,
            p.ClassSection != null ? $"{p.ClassSection.Class?.Name} - {p.ClassSection.Name}" : null,
            p.SubjectId,
            p.SubjectName,
            p.ChapterTopic,
            p.LearningObjectives,
            p.TeachingMethodology,
            p.HomeworkAssigned,
            p.Status,
            p.CompletionPercentage,
            p.StudentResponse,
            p.Remarks,
            p.PrincipalFeedback,
            p.CreatedAt
        ));

        return Ok(dtos);
    }

    [HttpPost("lesson-plans")]
    public async Task<ActionResult<TeacherLessonPlanDto>> CreateLessonPlan([FromBody] CreateTeacherLessonPlanDto dto)
    {
        var teacher = await _db.Teachers.FindAsync(dto.TeacherId);
        if (teacher == null) return BadRequest(new { message = "Teacher not found." });

        var plan = new TeacherLessonPlan
        {
            TenantId = _currentUser.TenantId,
            BranchId = _currentUser.BranchId,
            TeacherId = dto.TeacherId,
            PlanDate = dto.PlanDate.Date,
            BatchId = dto.BatchId,
            ClassSectionId = dto.ClassSectionId,
            SubjectId = dto.SubjectId,
            SubjectName = dto.SubjectName,
            ChapterTopic = dto.ChapterTopic,
            LearningObjectives = dto.LearningObjectives,
            TeachingMethodology = dto.TeachingMethodology,
            HomeworkAssigned = dto.HomeworkAssigned,
            Status = dto.Status ?? "Completed",
            CompletionPercentage = dto.CompletionPercentage ?? "100%",
            StudentResponse = dto.StudentResponse,
            Remarks = dto.Remarks
        };

        _db.TeacherLessonPlans.Add(plan);
        await _db.SaveChangesAsync();

        var created = await _db.TeacherLessonPlans
            .Include(p => p.Teacher)
            .Include(p => p.Batch)
            .Include(p => p.ClassSection).ThenInclude(cs => cs!.Class)
            .FirstAsync(p => p.Id == plan.Id);

        return Ok(new TeacherLessonPlanDto(
            created.Id,
            created.TeacherId,
            created.Teacher?.FullName ?? "",
            created.Teacher?.EmployeeCode ?? "",
            created.PlanDate,
            created.BatchId,
            created.Batch?.Name,
            created.ClassSectionId,
            created.ClassSection != null ? $"{created.ClassSection.Class?.Name} - {created.ClassSection.Name}" : null,
            created.SubjectId,
            created.SubjectName,
            created.ChapterTopic,
            created.LearningObjectives,
            created.TeachingMethodology,
            created.HomeworkAssigned,
            created.Status,
            created.CompletionPercentage,
            created.StudentResponse,
            created.Remarks,
            created.PrincipalFeedback,
            created.CreatedAt
        ));
    }

    [HttpPut("lesson-plans/{id}")]
    public async Task<IActionResult> UpdateLessonPlan(Guid id, [FromBody] UpdateTeacherLessonPlanDto dto)
    {
        var plan = await _db.TeacherLessonPlans.FindAsync(id);
        if (plan == null) return NotFound();

        if (dto.ChapterTopic != null) plan.ChapterTopic = dto.ChapterTopic;
        if (dto.LearningObjectives != null) plan.LearningObjectives = dto.LearningObjectives;
        if (dto.HomeworkAssigned != null) plan.HomeworkAssigned = dto.HomeworkAssigned;
        if (dto.Status != null) plan.Status = dto.Status;
        if (dto.CompletionPercentage != null) plan.CompletionPercentage = dto.CompletionPercentage;
        if (dto.StudentResponse != null) plan.StudentResponse = dto.StudentResponse;
        if (dto.Remarks != null) plan.Remarks = dto.Remarks;
        if (dto.PrincipalFeedback != null) plan.PrincipalFeedback = dto.PrincipalFeedback;
        if (dto.SubjectName != null) plan.SubjectName = dto.SubjectName;
        if (dto.SubjectId.HasValue) plan.SubjectId = dto.SubjectId;
        plan.BatchId = dto.BatchId;
        plan.ClassSectionId = dto.ClassSectionId;
        plan.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Lesson plan updated successfully." });
    }

    [HttpDelete("lesson-plans/{id}")]
    public async Task<IActionResult> DeleteLessonPlan(Guid id)
    {
        var plan = await _db.TeacherLessonPlans.FindAsync(id);
        if (plan == null) return NotFound();

        _db.TeacherLessonPlans.Remove(plan);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Lesson plan deleted successfully." });
    }

    // =========================================================================
    // PART 2: TEACHER COMPLIANCE & KYC DOCUMENTS
    // =========================================================================

    [HttpGet("{id}/documents")]
    public async Task<ActionResult<IEnumerable<TeacherDocumentDto>>> GetTeacherDocuments(Guid id)
    {
        var teacher = await _db.Teachers.FindAsync(id);
        if (teacher == null) return NotFound();

        var docs = await _db.TeacherDocuments
            .Where(d => d.TeacherId == id)
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync();

        var dtos = docs.Select(d => new TeacherDocumentDto(
            d.Id,
            d.TeacherId,
            teacher.FullName,
            d.DocumentType,
            d.Title,
            d.DocumentNumber,
            d.FileUrl,
            d.FileName,
            d.VerificationStatus,
            d.VerifiedBy,
            d.VerifiedAt,
            d.ExpiryDate,
            d.Remarks,
            d.CreatedAt
        ));

        return Ok(dtos);
    }

    [HttpPost("{id}/documents")]
    public async Task<ActionResult<TeacherDocumentDto>> AddTeacherDocument(Guid id, [FromBody] CreateTeacherDocumentDto dto)
    {
        var teacher = await _db.Teachers.FindAsync(id);
        if (teacher == null) return NotFound();

        var doc = new TeacherDocument
        {
            TenantId = _currentUser.TenantId,
            BranchId = _currentUser.BranchId,
            TeacherId = id,
            DocumentType = dto.DocumentType,
            Title = dto.Title,
            DocumentNumber = dto.DocumentNumber,
            FileUrl = dto.FileUrl,
            FileName = dto.FileName,
            VerificationStatus = "Pending",
            ExpiryDate = dto.ExpiryDate,
            Remarks = dto.Remarks
        };

        _db.TeacherDocuments.Add(doc);
        await _db.SaveChangesAsync();

        return Ok(new TeacherDocumentDto(
            doc.Id,
            doc.TeacherId,
            teacher.FullName,
            doc.DocumentType,
            doc.Title,
            doc.DocumentNumber,
            doc.FileUrl,
            doc.FileName,
            doc.VerificationStatus,
            doc.VerifiedBy,
            doc.VerifiedAt,
            doc.ExpiryDate,
            doc.Remarks,
            doc.CreatedAt
        ));
    }

    [HttpPut("{id}/documents/{docId}/verify")]
    public async Task<IActionResult> VerifyTeacherDocument(Guid id, Guid docId, [FromBody] VerifyTeacherDocumentDto dto)
    {
        var doc = await _db.TeacherDocuments.FirstOrDefaultAsync(d => d.Id == docId && d.TeacherId == id);
        if (doc == null) return NotFound();

        doc.VerificationStatus = dto.VerificationStatus;
        doc.Remarks = dto.Remarks ?? doc.Remarks;
        if (dto.VerificationStatus == "Verified")
        {
            doc.VerifiedBy = User.Identity?.Name ?? "Admin";
            doc.VerifiedAt = DateTime.UtcNow;
        }
        else
        {
            doc.VerifiedBy = null;
            doc.VerifiedAt = null;
        }
        doc.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { message = $"Document marked as {dto.VerificationStatus}." });
    }

    [HttpDelete("{id}/documents/{docId}")]
    public async Task<IActionResult> DeleteTeacherDocument(Guid id, Guid docId)
    {
        var doc = await _db.TeacherDocuments.FirstOrDefaultAsync(d => d.Id == docId && d.TeacherId == id);
        if (doc == null) return NotFound();

        _db.TeacherDocuments.Remove(doc);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Document deleted successfully." });
    }

    // =========================================================================
    // PART 2: STAFF ID CARDS GENERATOR
    // =========================================================================

    [HttpGet("id-cards")]
    public async Task<ActionResult<IEnumerable<TeacherIdCardDto>>> GetIdCards([FromQuery] Guid? teacherId)
    {
        var branch = await _db.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == _currentUser.BranchId);
        var tenant = await _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == _currentUser.TenantId);

        string institutionName = tenant?.Name ?? "Coaching & School ERP";
        string? branchName = branch?.Name;
        string? instAddress = branch?.Address ?? tenant?.Address;
        string? instPhone = branch?.ContactPhone ?? tenant?.ContactPhone;
        string? affCode = branch?.Code ?? "EMP-STAFF";

        var query = _db.Teachers.AsNoTracking().Where(t => t.IsActive);
        if (teacherId.HasValue)
        {
            query = query.Where(t => t.Id == teacherId.Value);
        }

        var teachers = await query.OrderBy(t => t.FullName).ToListAsync();

        var cards = teachers.Select(t =>
        {
            string qrData = $"ID:{t.EmployeeCode}|NAME:{t.FullName}|DESIG:{t.Specialization ?? "Faculty"}|PHONE:{t.PhoneNumber}|JOIN:{t.JoiningDate:dd-MMM-yyyy}";
            return new TeacherIdCardDto(
                t.Id,
                t.FullName,
                t.EmployeeCode,
                t.Specialization ?? "Faculty / Teacher",
                t.Specialization,
                t.Qualification,
                t.PhoneNumber,
                t.WhatsAppPhone ?? t.PhoneNumber,
                "B+",
                t.Email,
                t.Address,
                t.JoiningDate,
                t.PhotoUrl,
                institutionName,
                branchName,
                instAddress,
                instPhone,
                affCode,
                qrData
            );
        });

        return Ok(cards);
    }
}

