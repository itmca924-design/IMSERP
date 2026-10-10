using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SubjectsController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;

    public SubjectsController(IIMSERPDbContext dbContext, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<SubjectDto>>> GetSubjects([FromQuery] bool activeOnly = false)
    {
        var query = _dbContext.Subjects.AsNoTracking();
        if (activeOnly)
        {
            query = query.Where(s => s.IsActive);
        }

        var list = await query
            .OrderBy(s => s.Name)
            .Select(s => new SubjectDto(
                s.Id,
                s.Name,
                s.Code,
                s.Description,
                s.IsActive,
                s.CreatedAt
            )).ToListAsync();

        return Ok(list);
    }

    [HttpGet("paged")]
    public async Task<ActionResult<PagedResult<SubjectDto>>> GetSubjectsPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? sortBy = "Name",
        [FromQuery] bool sortDescending = false,
        [FromQuery] bool? isActive = null)
    {
        var query = _dbContext.Subjects.AsNoTracking();

        if (isActive.HasValue)
        {
            query = query.Where(s => s.IsActive == isActive.Value);
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(s => s.Name.ToLower().Contains(term) ||
                                     (s.Code != null && s.Code.ToLower().Contains(term)) ||
                                     (s.Description != null && s.Description.ToLower().Contains(term)));
        }

        query = (sortBy?.ToLower()) switch
        {
            "code" => sortDescending ? query.OrderByDescending(s => s.Code) : query.OrderBy(s => s.Code),
            "description" => sortDescending ? query.OrderByDescending(s => s.Description) : query.OrderBy(s => s.Description),
            "status" => sortDescending ? query.OrderByDescending(s => s.IsActive) : query.OrderBy(s => s.IsActive),
            _ => sortDescending ? query.OrderByDescending(s => s.Name) : query.OrderBy(s => s.Name)
        };

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new SubjectDto(
                s.Id,
                s.Name,
                s.Code,
                s.Description,
                s.IsActive,
                s.CreatedAt
            )).ToListAsync();

        return Ok(new PagedResult<SubjectDto>(items, totalCount, pageNumber, pageSize));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SubjectDto>> GetSubjectById(Guid id)
    {
        var s = await _dbContext.Subjects.FindAsync(id);
        if (s == null) return NotFound();

        return Ok(new SubjectDto(s.Id, s.Name, s.Code, s.Description, s.IsActive, s.CreatedAt));
    }

    [HttpPost]
    public async Task<ActionResult<SubjectDto>> CreateSubject([FromBody] CreateSubjectDto dto)
    {
        var existing = await _dbContext.Subjects.AnyAsync(s => s.Name.ToLower() == dto.Name.Trim().ToLower());
        if (existing)
        {
            return BadRequest(new { message = "Subject name already exists." });
        }

        var subject = new SubjectEntity
        {
            TenantId = _currentUser.TenantId,
            Name = dto.Name.Trim(),
            Code = dto.Code?.Trim(),
            Description = dto.Description?.Trim(),
            IsActive = dto.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Subjects.Add(subject);
        await _dbContext.SaveChangesAsync();

        return Ok(new SubjectDto(subject.Id, subject.Name, subject.Code, subject.Description, subject.IsActive, subject.CreatedAt));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<SubjectDto>> UpdateSubject(Guid id, [FromBody] CreateSubjectDto dto)
    {
        var subject = await _dbContext.Subjects.FindAsync(id);
        if (subject == null) return NotFound();

        subject.Name = dto.Name.Trim();
        subject.Code = dto.Code?.Trim();
        subject.Description = dto.Description?.Trim();
        subject.IsActive = dto.IsActive;

        await _dbContext.SaveChangesAsync();

        return Ok(new SubjectDto(subject.Id, subject.Name, subject.Code, subject.Description, subject.IsActive, subject.CreatedAt));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteSubject(Guid id)
    {
        var subject = await _dbContext.Subjects.FindAsync(id);
        if (subject == null) return NotFound();

        _dbContext.Subjects.Remove(subject);
        await _dbContext.SaveChangesAsync();

        return NoContent();
    }

    #region Class-Wise Subject Allocations

    [HttpGet("class-summary")]
    public async Task<ActionResult<IEnumerable<ClassSubjectSummaryDto>>> GetClassSubjectSummaries()
    {
        var classes = await _dbContext.SchoolClasses
            .AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.DisplayOrder)
            .ThenBy(c => c.Name)
            .ToListAsync();

        var allocations = await _dbContext.ClassSubjects
            .AsNoTracking()
            .Include(cs => cs.Subject)
            .OrderBy(cs => cs.DisplayOrder)
            .ToListAsync();

        var summaries = classes.Select(c =>
        {
            var classAllocations = allocations.Where(a => a.ClassId == c.Id).ToList();
            return new ClassSubjectSummaryDto(
                c.Id,
                c.Name,
                c.Code,
                c.DisplayOrder,
                classAllocations.Count,
                classAllocations.Select(a => a.Subject?.Name ?? "Subject").ToList()
            );
        }).ToList();

        return Ok(summaries);
    }

    [HttpGet("classes/{classId}")]
    public async Task<ActionResult<IEnumerable<ClassSubjectDto>>> GetClassSubjects(Guid classId)
    {
        var classObj = await _dbContext.SchoolClasses
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == classId);

        if (classObj == null)
            return NotFound(new { message = "Class not found." });

        var items = await _dbContext.ClassSubjects
            .AsNoTracking()
            .Include(cs => cs.Subject)
            .Include(cs => cs.Teacher)
            .Where(cs => cs.ClassId == classId)
            .OrderBy(cs => cs.DisplayOrder)
            .ThenBy(cs => cs.Subject != null ? cs.Subject.Name : string.Empty)
            .Select(cs => new ClassSubjectDto(
                cs.Id,
                cs.ClassId,
                classObj.Name,
                cs.SubjectId,
                cs.Subject != null ? cs.Subject.Name : string.Empty,
                cs.Subject != null ? cs.Subject.Code : null,
                cs.TeacherId,
                cs.Teacher != null ? cs.Teacher.FullName : null,
                cs.IsCompulsory,
                cs.TotalMarks,
                cs.PassingMarks,
                cs.DisplayOrder,
                cs.CreatedAt
            ))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("classes/{classId}/allocate")]
    public async Task<ActionResult<IEnumerable<ClassSubjectDto>>> AllocateClassSubjects(Guid classId, [FromBody] AllocateClassSubjectsRequestDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var branchId = _currentUser.BranchId;

        var classObj = await _dbContext.SchoolClasses
            .FirstOrDefaultAsync(c => c.Id == classId);

        if (classObj == null)
            return NotFound(new { message = "Class not found." });

        var effectiveTenantId = classObj.TenantId != Guid.Empty
            ? classObj.TenantId
            : (tenantId != Guid.Empty ? tenantId : Guid.Parse("a8c89ff2-ed12-4e4b-80c4-316453c3a1c6"));

        var existingAllocations = await _dbContext.ClassSubjects
            .Where(cs => cs.ClassId == classId)
            .ToListAsync();

        _dbContext.ClassSubjects.RemoveRange(existingAllocations);

        if (dto.Subjects != null && dto.Subjects.Count > 0)
        {
            var now = DateTime.UtcNow;
            int order = 1;
            foreach (var item in dto.Subjects)
            {
                var newCs = new ClassSubject
                {
                    Id = Guid.NewGuid(),
                    TenantId = effectiveTenantId,
                    BranchId = branchId,
                    ClassId = classId,
                    SubjectId = item.SubjectId,
                    TeacherId = item.TeacherId,
                    IsCompulsory = item.IsCompulsory,
                    TotalMarks = item.TotalMarks > 0 ? item.TotalMarks : 100,
                    PassingMarks = item.PassingMarks > 0 ? item.PassingMarks : 33,
                    DisplayOrder = item.DisplayOrder > 0 ? item.DisplayOrder : order++,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                _dbContext.ClassSubjects.Add(newCs);
            }
        }

        await _dbContext.SaveChangesAsync();

        return await GetClassSubjects(classId);
    }

    [HttpPost("classes/{targetClassId}/copy-from/{sourceClassId}")]
    public async Task<ActionResult<IEnumerable<ClassSubjectDto>>> CopyClassSubjects(Guid targetClassId, Guid sourceClassId)
    {
        var tenantId = _currentUser.TenantId;
        var branchId = _currentUser.BranchId;

        var targetClass = await _dbContext.SchoolClasses.FirstOrDefaultAsync(c => c.Id == targetClassId);
        if (targetClass == null) return NotFound(new { message = "Target class not found." });

        var effectiveTenantId = targetClass.TenantId != Guid.Empty
            ? targetClass.TenantId
            : (tenantId != Guid.Empty ? tenantId : Guid.Parse("a8c89ff2-ed12-4e4b-80c4-316453c3a1c6"));

        var sourceAllocations = await _dbContext.ClassSubjects
            .AsNoTracking()
            .Where(cs => cs.ClassId == sourceClassId)
            .ToListAsync();

        if (sourceAllocations.Count == 0)
            return BadRequest(new { message = "Source class does not have any subjects allocated." });

        var existingTargetAllocations = await _dbContext.ClassSubjects
            .Where(cs => cs.ClassId == targetClassId)
            .ToListAsync();

        _dbContext.ClassSubjects.RemoveRange(existingTargetAllocations);

        var now = DateTime.UtcNow;
        foreach (var src in sourceAllocations)
        {
            var newCs = new ClassSubject
            {
                Id = Guid.NewGuid(),
                TenantId = effectiveTenantId,
                BranchId = branchId,
                ClassId = targetClassId,
                SubjectId = src.SubjectId,
                TeacherId = null,
                IsCompulsory = src.IsCompulsory,
                TotalMarks = src.TotalMarks,
                PassingMarks = src.PassingMarks,
                DisplayOrder = src.DisplayOrder,
                CreatedAt = now,
                UpdatedAt = now
            };
            _dbContext.ClassSubjects.Add(newCs);
        }

        await _dbContext.SaveChangesAsync();
        return await GetClassSubjects(targetClassId);
    }

    #endregion
}
