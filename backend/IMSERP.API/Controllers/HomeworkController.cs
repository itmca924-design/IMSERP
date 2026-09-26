using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HomeworkController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public HomeworkController(IIMSERPDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<StudentHomeworkDto>>> GetHomeworkList(
        [FromQuery] Guid? classId,
        [FromQuery] Guid? sectionId,
        [FromQuery] Guid? batchId,
        [FromQuery] Guid? subjectId,
        [FromQuery] DateTime? date,
        [FromQuery] string? status)
    {
        var tenantId = _currentUser.TenantId;
        var query = _db.StudentHomeworks
            .AsNoTracking()
            .Include(h => h.Class)
            .Include(h => h.Section)
            .Include(h => h.Batch)
            .Where(h => h.TenantId == tenantId);

        if (_currentUser.BranchId.HasValue)
        {
            var branchId = _currentUser.BranchId.Value;
            query = query.Where(h => !h.BranchId.HasValue || h.BranchId == branchId);
        }

        if (classId.HasValue && classId.Value != Guid.Empty)
            query = query.Where(h => h.ClassId == classId.Value);

        if (sectionId.HasValue && sectionId.Value != Guid.Empty)
            query = query.Where(h => h.SectionId == sectionId.Value);

        if (batchId.HasValue && batchId.Value != Guid.Empty)
            query = query.Where(h => h.BatchId == batchId.Value);

        if (subjectId.HasValue && subjectId.Value != Guid.Empty)
            query = query.Where(h => h.SubjectId == subjectId.Value);

        if (date.HasValue)
        {
            var targetDate = date.Value.Date;
            query = query.Where(h => h.AssignedDate.Date == targetDate);
        }

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(h => h.Status.ToLower() == status.ToLower());

        var items = await query
            .OrderByDescending(h => h.AssignedDate)
            .ThenByDescending(h => h.CreatedAt)
            .Select(h => new StudentHomeworkDto(
                h.Id,
                h.TenantId,
                h.BranchId,
                h.ClassId,
                h.Class != null ? h.Class.Name : null,
                h.SectionId,
                h.Section != null ? h.Section.Name : null,
                h.BatchId,
                h.Batch != null ? h.Batch.Name : null,
                h.SubjectId,
                h.SubjectName,
                h.TeacherId,
                h.TeacherName,
                h.Title,
                h.Description,
                h.AssignedDate,
                h.DueDate,
                h.AttachmentUrl,
                h.Status,
                h.EstimatedMinutes,
                h.CreatedAt
            ))
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<StudentHomeworkDto>> GetHomeworkById(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var h = await _db.StudentHomeworks
            .AsNoTracking()
            .Include(x => x.Class)
            .Include(x => x.Section)
            .Include(x => x.Batch)
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);

        if (h == null) return NotFound(new { message = "Homework entry not found." });

        return Ok(new StudentHomeworkDto(
            h.Id,
            h.TenantId,
            h.BranchId,
            h.ClassId,
            h.Class != null ? h.Class.Name : null,
            h.SectionId,
            h.Section != null ? h.Section.Name : null,
            h.BatchId,
            h.Batch != null ? h.Batch.Name : null,
            h.SubjectId,
            h.SubjectName,
            h.TeacherId,
            h.TeacherName,
            h.Title,
            h.Description,
            h.AssignedDate,
            h.DueDate,
            h.AttachmentUrl,
            h.Status,
            h.EstimatedMinutes,
            h.CreatedAt
        ));
    }

    [HttpGet("stats")]
    public async Task<ActionResult<HomeworkStatsDto>> GetHomeworkStats()
    {
        var tenantId = _currentUser.TenantId;
        var today = DateTime.Now.Date;

        var query = _db.StudentHomeworks.AsNoTracking().Where(h => h.TenantId == tenantId);
        if (_currentUser.BranchId.HasValue)
        {
            var branchId = _currentUser.BranchId.Value;
            query = query.Where(h => !h.BranchId.HasValue || h.BranchId == branchId);
        }

        var totalActive = await query.CountAsync(h => h.Status == "Active");
        var dueToday = await query.CountAsync(h => h.Status == "Active" && h.DueDate.Date == today);
        var assignedToday = await query.CountAsync(h => h.AssignedDate.Date == today);
        var completed = await query.CountAsync(h => h.Status == "Completed");

        return Ok(new HomeworkStatsDto(totalActive, dueToday, assignedToday, completed));
    }

    [HttpPost]
    public async Task<ActionResult<StudentHomeworkDto>> CreateHomework([FromBody] CreateStudentHomeworkDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(new { message = "Homework title is required." });

        if (string.IsNullOrWhiteSpace(dto.Description))
            return BadRequest(new { message = "Homework description is required." });

        var tenantId = _currentUser.TenantId;
        var branchId = _currentUser.BranchId;

        // Auto lookup teacher name if teacherId is provided
        string? teacherName = dto.TeacherName;
        if (dto.TeacherId.HasValue && string.IsNullOrWhiteSpace(teacherName))
        {
            var teacher = await _db.Teachers.AsNoTracking().FirstOrDefaultAsync(t => t.Id == dto.TeacherId.Value);
            if (teacher != null) teacherName = teacher.FullName;
        }

        var now = DateTime.Now;
        var homework = new StudentHomework
        {
            TenantId = tenantId,
            BranchId = branchId,
            ClassId = dto.ClassId,
            SectionId = dto.SectionId,
            BatchId = dto.BatchId,
            SubjectId = dto.SubjectId,
            SubjectName = dto.SubjectName ?? "General",
            TeacherId = dto.TeacherId,
            TeacherName = teacherName,
            Title = dto.Title.Trim(),
            Description = dto.Description.Trim(),
            AssignedDate = dto.AssignedDate != default ? dto.AssignedDate : now,
            DueDate = dto.DueDate != default ? dto.DueDate : now.Date.AddDays(1).AddHours(17),
            AttachmentUrl = dto.AttachmentUrl,
            Status = "Active",
            EstimatedMinutes = dto.EstimatedMinutes ?? 30,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.StudentHomeworks.Add(homework);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetHomeworkById), new { id = homework.Id }, new StudentHomeworkDto(
            homework.Id,
            homework.TenantId,
            homework.BranchId,
            homework.ClassId,
            null,
            homework.SectionId,
            null,
            homework.BatchId,
            null,
            homework.SubjectId,
            homework.SubjectName,
            homework.TeacherId,
            homework.TeacherName,
            homework.Title,
            homework.Description,
            homework.AssignedDate,
            homework.DueDate,
            homework.AttachmentUrl,
            homework.Status,
            homework.EstimatedMinutes,
            homework.CreatedAt
        ));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateHomework(Guid id, [FromBody] UpdateStudentHomeworkDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var homework = await _db.StudentHomeworks.FirstOrDefaultAsync(h => h.Id == id && h.TenantId == tenantId);
        if (homework == null) return NotFound(new { message = "Homework entry not found." });

        homework.Title = dto.Title?.Trim() ?? homework.Title;
        homework.Description = dto.Description?.Trim() ?? homework.Description;
        if (dto.DueDate != default) homework.DueDate = dto.DueDate;
        if (!string.IsNullOrWhiteSpace(dto.Status)) homework.Status = dto.Status;
        if (dto.AttachmentUrl != null) homework.AttachmentUrl = dto.AttachmentUrl;
        if (dto.EstimatedMinutes.HasValue) homework.EstimatedMinutes = dto.EstimatedMinutes.Value;
        homework.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Homework updated successfully." });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteHomework(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var homework = await _db.StudentHomeworks.FirstOrDefaultAsync(h => h.Id == id && h.TenantId == tenantId);
        if (homework == null) return NotFound(new { message = "Homework entry not found." });

        _db.StudentHomeworks.Remove(homework);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Homework deleted successfully." });
    }
}
