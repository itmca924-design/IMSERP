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

    public StudentsController(IIMSERPDbContext dbContext, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
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

    private static StudentAttendanceDto MapStudentAttendance(StudentAttendance attendance, Student student) => new(
        attendance.Id,
        attendance.StudentId,
        student.StudentName,
        student.RollNumber,
        attendance.AttendanceDate,
        attendance.Status.ToString(),
        attendance.Remarks);

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
        var query = _dbContext.Students.AsNoTracking().Include(s => s.Batch).AsQueryable();

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
            s.Address
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
        var student = await _dbContext.Students.FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound(new { message = "Student not found." });
        if (!TryParseAttendanceStatus(dto.Status, out var status))
            return BadRequest(new { message = "Invalid attendance status." });

        var date = dto.AttendanceDate.Date;
        if (!await CanEditPublicHolidayOrSundayAsync() && await IsPublicHolidayOrSundayAsync(date))
            return Forbid();

        var record = await _dbContext.StudentAttendances
            .FirstOrDefaultAsync(a => a.StudentId == id && a.AttendanceDate == date);

        if (record == null)
        {
            record = new StudentAttendance
            {
                TenantId = _currentUser.TenantId,
                StudentId = id,
                AttendanceDate = date,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.StudentAttendances.Add(record);
        }

        record.Status = status;
        record.Remarks = dto.Remarks;
        record.MarkedBy = _currentUser.UserId.ToString();
        await _dbContext.SaveChangesAsync();

        return Ok(MapStudentAttendance(record, student));
    }

    [HttpDelete("attendance/{attendanceId}")]
    public async Task<IActionResult> DeleteAttendance(Guid attendanceId)
    {
        var record = await _dbContext.StudentAttendances.FindAsync(attendanceId);
        if (record == null) return NotFound();

        if (!await CanEditPublicHolidayOrSundayAsync() && await IsPublicHolidayOrSundayAsync(record.AttendanceDate))
            return Forbid();

        _dbContext.StudentAttendances.Remove(record);
        await _dbContext.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("check-phone")]
    public async Task<ActionResult<object>> CheckPhoneDuplicate(
        [FromQuery] string phone,
        [FromQuery] Guid? excludeStudentId = null)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return BadRequest(new { message = "phone is required." });

        var query = _dbContext.Students
            .AsNoTracking()
            .Include(s => s.Batch)
            .Where(s => s.ParentWhatsAppPhone == phone.Trim());

        if (excludeStudentId.HasValue && excludeStudentId != Guid.Empty)
            query = query.Where(s => s.Id != excludeStudentId.Value);

        var existing = await query
            .Select(s => new
            {
                s.StudentName,
                BatchName = s.Batch != null ? s.Batch.Name : ""
            })
            .FirstOrDefaultAsync();

        if (existing != null)
            return Ok(new { isDuplicate = true, studentName = existing.StudentName, batchName = existing.BatchName });

        return Ok(new { isDuplicate = false, studentName = (string?)null, batchName = (string?)null });
    }

    [HttpGet("paged")]
    public async Task<ActionResult<PagedResult<StudentDto>>> GetStudentsPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? sortBy = "rollNumber",
        [FromQuery] bool sortDescending = false,
        [FromQuery] Guid? batchId = null)
    {
        var query = _dbContext.Students.AsNoTracking().Include(s => s.Batch).AsQueryable();

        if (batchId.HasValue && batchId != Guid.Empty)
        {
            query = query.Where(s => s.BatchId == batchId.Value);
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(s => s.RollNumber.ToLower().Contains(term) ||
                                     s.StudentName.ToLower().Contains(term) ||
                                     s.ParentName.ToLower().Contains(term) ||
                                     s.ParentWhatsAppPhone.ToLower().Contains(term));
        }

        query = (sortBy?.ToLower()) switch
        {
            "studentname" => sortDescending ? query.OrderByDescending(s => s.StudentName) : query.OrderBy(s => s.StudentName),
            "batchname" => sortDescending ? query.OrderByDescending(s => s.Batch != null ? s.Batch.Name : "") : query.OrderBy(s => s.Batch != null ? s.Batch.Name : ""),
            "parentname" => sortDescending ? query.OrderByDescending(s => s.ParentName) : query.OrderBy(s => s.ParentName),
            "joiningdate" => sortDescending ? query.OrderByDescending(s => s.JoiningDate) : query.OrderBy(s => s.JoiningDate),
            _ => sortDescending ? query.OrderByDescending(s => s.RollNumber) : query.OrderBy(s => s.RollNumber)
        };

        var totalCount = await query.CountAsync();
        var items = await query
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
                s.Address
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

            var student = new Student
            {
                TenantId = _currentUser.TenantId,
                BatchId = dto.BatchId,
                RollNumber = dto.RollNumber,
                StudentName = dto.StudentName,
                ParentName = dto.ParentName,
                ParentWhatsAppPhone = dto.ParentWhatsAppPhone,
                Address = dto.Address,
                JoiningDate = DateTime.UtcNow,
                IsActive = true
            };

            _dbContext.Students.Add(student);
            await _dbContext.SaveChangesAsync();

            var batch = await _dbContext.Batches.FindAsync(dto.BatchId);
            var feeRate = batch?.StandardMonthlyFee ?? 3500m;
            var now = DateTime.UtcNow;

            // Auto-generate initial Monthly Fee Invoice for joining month
            var initialInvoice = new FeeInvoice
            {
                TenantId = _currentUser.TenantId,
                StudentId = student.Id,
                InvoiceNumber = $"INV-{now.Year}{now.Month:D2}-{new Random().Next(100, 999)}",
                Title = $"{now:MMMM yyyy} Tuition Fee",
                TotalAmount = feeRate,
                PaidAmount = 0,
                DueDate = new DateTime(now.Year, now.Month, Math.Min(10, DateTime.DaysInMonth(now.Year, now.Month))),
                Status = InvoiceStatus.Pending,
                CreatedAt = now
            };

            _dbContext.FeeInvoices.Add(initialInvoice);
            await _dbContext.SaveChangesAsync();

            await transaction.CommitAsync();

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
                student.Address
            ));
        });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<StudentDto>> UpdateStudent(Guid id, [FromBody] CreateStudentDto dto)
    {
        var student = await _dbContext.Students.FindAsync(id);
        if (student == null) return NotFound();

        student.BatchId = dto.BatchId;
        student.RollNumber = dto.RollNumber;
        student.StudentName = dto.StudentName;
        student.ParentName = dto.ParentName;
        student.ParentWhatsAppPhone = dto.ParentWhatsAppPhone;
        student.Address = dto.Address;

        await _dbContext.SaveChangesAsync();

        var batch = await _dbContext.Batches.FindAsync(dto.BatchId);

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
            student.Address
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
            .Select(b => new BatchDto(
                b.Id,
                b.Name,
                b.Subject,
                b.AcademicYear,
                b.StandardMonthlyFee,
                b.Students.Count
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
        var query = _dbContext.Batches.AsNoTracking();

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
                b.Students.Count
            )).ToListAsync();

        return Ok(new PagedResult<BatchDto>(items, totalCount, pageNumber, pageSize));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<BatchDto>> GetBatchById(Guid id)
    {
        var batch = await _dbContext.Batches
            .Include(b => b.Students)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (batch == null) return NotFound();

        return Ok(new BatchDto(batch.Id, batch.Name, batch.Subject, batch.AcademicYear, batch.StandardMonthlyFee, batch.Students.Count));
    }

    [HttpPost]
    public async Task<ActionResult<BatchDto>> CreateBatch([FromBody] CreateBatchDto dto)
    {
        var batch = new Batch
        {
            TenantId = _currentUser.TenantId,
            Name = dto.Name,
            Subject = dto.Subject,
            AcademicYear = dto.AcademicYear,
            StandardMonthlyFee = dto.StandardMonthlyFee
        };

        _dbContext.Batches.Add(batch);
        await _dbContext.SaveChangesAsync();

        return Ok(new BatchDto(batch.Id, batch.Name, batch.Subject, batch.AcademicYear, batch.StandardMonthlyFee, 0));
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

        await _dbContext.SaveChangesAsync();

        var studentCount = await _dbContext.Students.CountAsync(s => s.BatchId == id);
        return Ok(new BatchDto(batch.Id, batch.Name, batch.Subject, batch.AcademicYear, batch.StandardMonthlyFee, studentCount));
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
