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
}
