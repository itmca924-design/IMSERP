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
