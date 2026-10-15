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
        var tenantId = _currentUser.TenantId;
        var query = _dbContext.Subjects.AsNoTracking();
        if (tenantId != Guid.Empty)
        {
            query = query.Where(s => s.TenantId == tenantId);
        }

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
        var tenantId = _currentUser.TenantId;
        var query = _dbContext.Subjects.AsNoTracking();
        if (tenantId != Guid.Empty)
        {
            query = query.Where(s => s.TenantId == tenantId);
        }

        if (isActive.HasValue)
        {
            query = query.Where(s => s.IsActive == isActive.Value);
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim();
            query = query.Where(s => EF.Functions.Like(s.Name, $"%{term}%") ||
                                     (s.Code != null && EF.Functions.Like(s.Code, $"%{term}%")) ||
                                     (s.Description != null && EF.Functions.Like(s.Description, $"%{term}%")));
        }

        var totalCount = await query.CountAsync();

        query = (sortBy?.ToLower()) switch
        {
            "code" => sortDescending ? query.OrderByDescending(s => s.Code) : query.OrderBy(s => s.Code),
            "description" => sortDescending ? query.OrderByDescending(s => s.Description) : query.OrderBy(s => s.Description),
            "status" => sortDescending ? query.OrderByDescending(s => s.IsActive) : query.OrderBy(s => s.IsActive),
            _ => sortDescending ? query.OrderByDescending(s => s.Name) : query.OrderBy(s => s.Name)
        };

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
        var tenantId = _currentUser.TenantId;
        var classesQuery = _dbContext.SchoolClasses.AsNoTracking().Where(c => c.IsActive);
        if (tenantId != Guid.Empty)
        {
            classesQuery = classesQuery.Where(c => c.TenantId == tenantId);
        }

        var classes = await classesQuery
            .OrderBy(c => c.DisplayOrder)
            .ThenBy(c => c.Name)
            .Select(c => new { c.Id, c.Name, c.Code, c.DisplayOrder })
            .ToListAsync();

        var allocationsQuery = _dbContext.ClassSubjects.AsNoTracking();
        if (tenantId != Guid.Empty)
        {
            allocationsQuery = allocationsQuery.Where(cs => cs.TenantId == tenantId);
        }

        var allocations = await allocationsQuery
            .Select(cs => new { cs.ClassId, SubjectName = cs.Subject != null ? cs.Subject.Name : "Subject" })
            .ToListAsync();

        var allocLookup = allocations.ToLookup(a => a.ClassId);

        var summaries = classes.Select(c =>
        {
            var classAllocations = allocLookup[c.Id];
            return new ClassSubjectSummaryDto(
                c.Id,
                c.Name,
                c.Code,
                c.DisplayOrder,
                classAllocations.Count(),
                classAllocations.Select(a => a.SubjectName).ToList()
            );
        }).ToList();

        return Ok(summaries);
    }

    [HttpGet("classes/{classId}")]
    public async Task<ActionResult<IEnumerable<ClassSubjectDto>>> GetClassSubjects(Guid classId)
    {
        var tenantId = _currentUser.TenantId;
        var classQuery = _dbContext.SchoolClasses.AsNoTracking().Where(c => c.Id == classId);
        if (tenantId != Guid.Empty)
        {
            classQuery = classQuery.Where(c => c.TenantId == tenantId);
        }

        var classObj = await classQuery
            .Select(c => new { c.Id, c.Name })
            .FirstOrDefaultAsync();

        if (classObj == null)
            return NotFound(new { message = "Class not found." });

        var allocQuery = _dbContext.ClassSubjects.AsNoTracking().Where(cs => cs.ClassId == classId);
        if (tenantId != Guid.Empty)
        {
            allocQuery = allocQuery.Where(cs => cs.TenantId == tenantId);
        }

        var items = await allocQuery
            .OrderBy(cs => cs.DisplayOrder)
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
