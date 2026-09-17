using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SchoolController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public SchoolController(IIMSERPDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    #region Classes Management

    [HttpGet("classes")]
    public async Task<ActionResult<IEnumerable<SchoolClassDto>>> GetClasses([FromQuery] bool activeOnly = false)
    {
        var query = _db.SchoolClasses.AsNoTracking();
        if (activeOnly)
        {
            query = query.Where(c => c.IsActive);
        }

        var classes = await query
            .OrderBy(c => c.DisplayOrder)
            .ThenBy(c => c.Name)
            .Select(c => new SchoolClassDto(
                c.Id,
                c.TenantId,
                c.Name,
                c.Code,
                c.DisplayOrder,
                c.IsActive,
                c.CreatedAt,
                c.BranchId,
                c.Sections.Count,
                _db.Students.Count(s => s.ClassId == c.Id && s.IsActive),
                c.Sections.OrderBy(s => s.Name).Select(s => new SchoolSectionDto(
                    s.Id,
                    s.TenantId,
                    s.ClassId,
                    c.Name,
                    s.Name,
                    s.MaxCapacity,
                    s.RoomId,
                    s.Room != null ? s.Room.RoomNumber : null,
                    s.IsActive,
                    s.CreatedAt,
                    s.BranchId,
                    _db.Students.Count(st => st.SectionId == s.Id && st.IsActive)
                )).ToList()
            ))
            .ToListAsync();

        return Ok(classes);
    }

    [HttpGet("classes/{id}")]
    public async Task<ActionResult<SchoolClassDto>> GetClassById(Guid id)
    {
        var c = await _db.SchoolClasses
            .Include(x => x.Sections)
                .ThenInclude(sec => sec.Room)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (c == null) return NotFound();

        var dto = new SchoolClassDto(
            c.Id,
            c.TenantId,
            c.Name,
            c.Code,
            c.DisplayOrder,
            c.IsActive,
            c.CreatedAt,
            c.BranchId,
            c.Sections.Count,
            await _db.Students.CountAsync(s => s.ClassId == c.Id && s.IsActive),
            c.Sections.OrderBy(s => s.Name).Select(s => new SchoolSectionDto(
                s.Id,
                s.TenantId,
                s.ClassId,
                c.Name,
                s.Name,
                s.MaxCapacity,
                s.RoomId,
                s.Room?.RoomNumber,
                s.IsActive,
                s.CreatedAt,
                s.BranchId,
                _db.Students.Count(st => st.SectionId == s.Id && st.IsActive)
            )).ToList()
        );

        return Ok(dto);
    }

    [HttpPost("classes")]
    public async Task<ActionResult<SchoolClassDto>> CreateClass([FromBody] CreateSchoolClassDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { message = "Class name is required." });
        }

        var newClass = new SchoolClass
        {
            TenantId = _currentUser.TenantId,
            BranchId = dto.BranchId ?? _currentUser.BranchId,
            Name = dto.Name.Trim(),
            Code = dto.Code?.Trim(),
            DisplayOrder = dto.DisplayOrder,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.SchoolClasses.Add(newClass);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetClassById), new { id = newClass.Id }, new SchoolClassDto(
            newClass.Id,
            newClass.TenantId,
            newClass.Name,
            newClass.Code,
            newClass.DisplayOrder,
            newClass.IsActive,
            newClass.CreatedAt,
            newClass.BranchId,
            0,
            0,
            new List<SchoolSectionDto>()
        ));
    }

    [HttpPut("classes/{id}")]
    public async Task<IActionResult> UpdateClass(Guid id, [FromBody] UpdateSchoolClassDto dto)
    {
        var c = await _db.SchoolClasses.FindAsync(id);
        if (c == null) return NotFound();

        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { message = "Class name is required." });
        }

        c.Name = dto.Name.Trim();
        c.Code = dto.Code?.Trim();
        c.DisplayOrder = dto.DisplayOrder;
        c.IsActive = dto.IsActive;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("classes/{id}")]
    public async Task<IActionResult> DeleteClass(Guid id)
    {
        var c = await _db.SchoolClasses.Include(x => x.Sections).FirstOrDefaultAsync(x => x.Id == id);
        if (c == null) return NotFound();

        var studentCount = await _db.Students.CountAsync(s => s.ClassId == id);
        if (studentCount > 0)
        {
            return BadRequest(new { message = $"Cannot delete class with {studentCount} active students. Please transfer or reassign students first." });
        }

        _db.SchoolClasses.Remove(c);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Sections Management

    [HttpGet("sections")]
    public async Task<ActionResult<IEnumerable<SchoolSectionDto>>> GetSections([FromQuery] Guid? classId = null)
    {
        var query = _db.SchoolSections.Include(s => s.Class).Include(s => s.Room).AsNoTracking();
        if (classId.HasValue && classId.Value != Guid.Empty)
        {
            query = query.Where(s => s.ClassId == classId.Value);
        }

        var sections = await query
            .OrderBy(s => s.Class != null ? s.Class.DisplayOrder : 0)
            .ThenBy(s => s.Name)
            .Select(s => new SchoolSectionDto(
                s.Id,
                s.TenantId,
                s.ClassId,
                s.Class != null ? s.Class.Name : null,
                s.Name,
                s.MaxCapacity,
                s.RoomId,
                s.Room != null ? s.Room.RoomNumber : null,
                s.IsActive,
                s.CreatedAt,
                s.BranchId,
                _db.Students.Count(st => st.SectionId == s.Id && st.IsActive)
            ))
            .ToListAsync();

        return Ok(sections);
    }

    [HttpPost("sections")]
    public async Task<ActionResult<SchoolSectionDto>> CreateSection([FromBody] CreateSchoolSectionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { message = "Section name is required." });
        }

        var parentClass = await _db.SchoolClasses.FindAsync(dto.ClassId);
        if (parentClass == null)
        {
            return BadRequest(new { message = "Selected class not found." });
        }

        var section = new SchoolSection
        {
            TenantId = _currentUser.TenantId,
            BranchId = dto.BranchId ?? _currentUser.BranchId,
            ClassId = dto.ClassId,
            Name = dto.Name.Trim(),
            MaxCapacity = dto.MaxCapacity > 0 ? dto.MaxCapacity : 45,
            RoomId = dto.RoomId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.SchoolSections.Add(section);
        await _db.SaveChangesAsync();

        string? roomNumber = null;
        if (section.RoomId.HasValue)
        {
            var room = await _db.Rooms.FindAsync(section.RoomId.Value);
            roomNumber = room?.RoomNumber;
        }

        return Ok(new SchoolSectionDto(
            section.Id,
            section.TenantId,
            section.ClassId,
            parentClass.Name,
            section.Name,
            section.MaxCapacity,
            section.RoomId,
            roomNumber,
            section.IsActive,
            section.CreatedAt,
            section.BranchId,
            0
        ));
    }

    [HttpPut("sections/{id}")]
    public async Task<IActionResult> UpdateSection(Guid id, [FromBody] UpdateSchoolSectionDto dto)
    {
        var section = await _db.SchoolSections.FindAsync(id);
        if (section == null) return NotFound();

        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { message = "Section name is required." });
        }

        section.Name = dto.Name.Trim();
        section.MaxCapacity = dto.MaxCapacity > 0 ? dto.MaxCapacity : 45;
        section.RoomId = dto.RoomId;
        section.IsActive = dto.IsActive;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("sections/{id}")]
    public async Task<IActionResult> DeleteSection(Guid id)
    {
        var section = await _db.SchoolSections.FindAsync(id);
        if (section == null) return NotFound();

        var studentCount = await _db.Students.CountAsync(s => s.SectionId == id);
        if (studentCount > 0)
        {
            return BadRequest(new { message = $"Cannot delete section with {studentCount} assigned students. Please reassign students first." });
        }

        _db.SchoolSections.Remove(section);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region School + Coaching Integration & Dual Enrollment

    [HttpGet("students/search")]
    public async Task<ActionResult<IEnumerable<object>>> SearchSchoolStudents([FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2)
        {
            return Ok(new List<object>());
        }

        var q = query.Trim().ToLower();
        var students = await _db.Students
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .Where(s => s.IsActive && (
                s.StudentName.ToLower().Contains(q) ||
                (s.AdmissionNumber != null && s.AdmissionNumber.ToLower().Contains(q)) ||
                (s.RollNumber.ToLower().Contains(q)) ||
                (s.ParentWhatsAppPhone.Contains(q))
            ))
            .Take(15)
            .Select(s => new
            {
                s.Id,
                s.StudentName,
                s.ParentName,
                s.ParentWhatsAppPhone,
                s.Address,
                s.ProfilePhoto,
                s.AdmissionNumber,
                s.SchoolRollNumber,
                s.CoachingRollNumber,
                s.IsSchoolStudent,
                s.IsCoachingStudent,
                ClassId = s.ClassId,
                ClassName = s.Class != null ? s.Class.Name : null,
                SectionId = s.SectionId,
                SectionName = s.Section != null ? s.Section.Name : null,
                BatchId = s.BatchId,
                BatchName = s.Batch != null ? s.Batch.Name : null
            })
            .ToListAsync();

        return Ok(students);
    }

    [HttpPost("students/enroll-coaching")]
    public async Task<ActionResult<object>> EnrollSchoolStudentInCoaching([FromBody] EnrollSchoolStudentInCoachingDto dto)
    {
        var student = await _db.Students
            .Include(s => s.Class)
            .Include(s => s.Section)
            .FirstOrDefaultAsync(s => s.Id == dto.StudentId);

        if (student == null)
        {
            return NotFound(new { message = "Student not found." });
        }

        var batch = await _db.Batches.FindAsync(dto.BatchId);
        if (batch == null)
        {
            return BadRequest(new { message = "Selected coaching batch not found." });
        }

        // Assign coaching batch and mark as coaching student
        student.BatchId = dto.BatchId;
        student.IsCoachingStudent = true;

        if (!string.IsNullOrWhiteSpace(dto.CoachingRollNumber))
        {
            student.CoachingRollNumber = dto.CoachingRollNumber.Trim();
        }
        else if (string.IsNullOrWhiteSpace(student.CoachingRollNumber))
        {
            // Auto generate coaching roll number if missing
            var count = await _db.Students.CountAsync(s => s.BatchId == dto.BatchId);
            student.CoachingRollNumber = $"{batch.Name.Substring(0, Math.Min(3, batch.Name.Length)).ToUpper()}-{(count + 1):D3}";
        }

        // Generate initial coaching monthly fee invoice for the newly enrolled coaching student
        var invoiceMonth = DateTime.UtcNow.ToString("MMM yyyy");
        var invoiceNumber = $"INV-{DateTime.UtcNow:yyyyMM}-{Random.Shared.Next(100, 999)}";
        var amount = dto.CustomMonthlyFee ?? batch.StandardMonthlyFee;

        if (amount > 0)
        {
            var invoice = new FeeInvoice
            {
                TenantId = student.TenantId,
                BranchId = student.BranchId,
                StudentId = student.Id,
                InvoiceNumber = invoiceNumber,
                Title = $"Coaching Tuition Fee - {invoiceMonth}",
                InvoiceCategory = "Coaching",
                TotalAmount = amount,
                PaidAmount = 0,
                DueDate = DateTime.UtcNow.AddDays(10),
                Status = IMSERP.Domain.Enums.InvoiceStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };
            _db.FeeInvoices.Add(invoice);
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"Student '{student.StudentName}' successfully enrolled into coaching batch '{batch.Name}'.",
            studentId = student.Id,
            studentName = student.StudentName,
            batchId = batch.Id,
            batchName = batch.Name,
            coachingRollNumber = student.CoachingRollNumber,
            isSchoolStudent = student.IsSchoolStudent,
            isCoachingStudent = student.IsCoachingStudent
        });
    }

    [HttpGet("stats")]
    public async Task<ActionResult<object>> GetUnifiedStats()
    {
        var totalSchoolStudents = await _db.Students.CountAsync(s => s.IsActive && s.IsSchoolStudent);
        var totalCoachingStudents = await _db.Students.CountAsync(s => s.IsActive && s.IsCoachingStudent);
        var dualEnrolledStudents = await _db.Students.CountAsync(s => s.IsActive && s.IsSchoolStudent && s.IsCoachingStudent);
        var totalClasses = await _db.SchoolClasses.CountAsync(c => c.IsActive);
        var totalBatches = await _db.Batches.CountAsync();

        return Ok(new
        {
            TotalSchoolStudents = totalSchoolStudents,
            TotalCoachingStudents = totalCoachingStudents,
            DualEnrolledStudents = dualEnrolledStudents,
            TotalClasses = totalClasses,
            TotalBatches = totalBatches
        });
    }

    #endregion
}
