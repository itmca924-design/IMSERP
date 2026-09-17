using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HolidaysController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public HolidaysController(IIMSERPDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<HolidayDto>>> GetHolidays(
        [FromQuery] int year = 0,
        [FromQuery] int month = 0,
        [FromQuery] bool activeOnly = true)
    {
        var query = _db.Holidays.AsNoTracking();

        if (activeOnly)
        {
            query = query.Where(h => h.IsActive);
        }

        if (year > 0)
        {
            query = query.Where(h => h.StartDate.Year == year || h.EndDate.Year == year);
        }

        if (month > 0)
        {
            query = query.Where(h => h.StartDate.Month == month || h.EndDate.Month == month);
        }

        var list = await query
            .OrderBy(h => h.StartDate)
            .Select(h => new HolidayDto(
                h.Id,
                h.Title,
                h.StartDate,
                h.EndDate,
                h.HolidayType,
                h.Description,
                h.IsActive,
                h.CreatedAt))
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("paged")]
    public async Task<ActionResult<PagedResult<HolidayDto>>> GetHolidaysPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? searchTerm = null,
        [FromQuery] int year = 0,
        [FromQuery] int month = 0,
        [FromQuery] string? category = null,
        [FromQuery] string? sortBy = "StartDate",
        [FromQuery] bool sortDescending = false,
        [FromQuery] bool? isActive = null)
    {
        var query = _db.Holidays.AsNoTracking();

        if (isActive.HasValue)
        {
            query = query.Where(h => h.IsActive == isActive.Value);
        }

        if (year > 0)
        {
            query = query.Where(h => h.StartDate.Year == year || h.EndDate.Year == year);
        }

        if (month > 0)
        {
            query = query.Where(h => h.StartDate.Month == month || h.EndDate.Month == month);
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            var cat = category.Trim().ToLower();
            query = query.Where(h => h.HolidayType.ToLower() == cat);
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(h => h.Title.ToLower().Contains(term) ||
                                     (h.Description != null && h.Description.ToLower().Contains(term)));
        }

        query = (sortBy?.ToLower()) switch
        {
            "title" => sortDescending ? query.OrderByDescending(h => h.Title) : query.OrderBy(h => h.Title),
            "category" or "holidaytype" => sortDescending ? query.OrderByDescending(h => h.HolidayType) : query.OrderBy(h => h.HolidayType),
            "description" => sortDescending ? query.OrderByDescending(h => h.Description) : query.OrderBy(h => h.Description),
            "status" or "isactive" => sortDescending ? query.OrderByDescending(h => h.IsActive) : query.OrderBy(h => h.IsActive),
            "duration" => sortDescending ? query.OrderByDescending(h => EF.Functions.DateDiffDay(h.StartDate, h.EndDate)) : query.OrderBy(h => EF.Functions.DateDiffDay(h.StartDate, h.EndDate)),
            _ => sortDescending ? query.OrderByDescending(h => h.StartDate) : query.OrderBy(h => h.StartDate)
        };

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(h => new HolidayDto(
                h.Id,
                h.Title,
                h.StartDate,
                h.EndDate,
                h.HolidayType,
                h.Description,
                h.IsActive,
                h.CreatedAt))
            .ToListAsync();

        return Ok(new PagedResult<HolidayDto>(items, totalCount, pageNumber, pageSize));
    }

    [HttpGet("summary")]
    public async Task<ActionResult<object>> GetHolidaysSummary(
        [FromQuery] int year = 0,
        [FromQuery] int month = 0)
    {
        var query = _db.Holidays.AsNoTracking();

        if (year > 0)
        {
            query = query.Where(h => h.StartDate.Year == year || h.EndDate.Year == year);
        }

        if (month > 0)
        {
            query = query.Where(h => h.StartDate.Month == month || h.EndDate.Month == month);
        }

        var total = await query.CountAsync();
        var national = await query.CountAsync(h => h.HolidayType.ToLower() == "national");
        var festival = await query.CountAsync(h => h.HolidayType.ToLower() == "festival");
        var academic = await query.CountAsync(h => h.HolidayType.ToLower() == "academic" || h.HolidayType.ToLower() == "institutional");

        return Ok(new
        {
            TotalDeclared = total,
            NationalHolidays = national,
            Festivals = festival,
            AcademicRecess = academic
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<HolidayDto>> GetHoliday(Guid id)
    {
        var h = await _db.Holidays.FindAsync(id);
        if (h == null) return NotFound();

        return Ok(new HolidayDto(
            h.Id, h.Title, h.StartDate, h.EndDate,
            h.HolidayType, h.Description, h.IsActive, h.CreatedAt));
    }

    [HttpPost]
    public async Task<ActionResult<HolidayDto>> CreateHoliday([FromBody] CreateHolidayDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
        {
            return BadRequest(new { message = "Holiday title is required." });
        }

        var holiday = new Holiday
        {
            TenantId = _currentUser.TenantId,
            Title = dto.Title.Trim(),
            StartDate = dto.StartDate.Date,
            EndDate = dto.EndDate.Date,
            HolidayType = string.IsNullOrWhiteSpace(dto.HolidayType) ? "Festival" : dto.HolidayType.Trim(),
            Description = dto.Description?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.Holidays.Add(holiday);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetHoliday), new { id = holiday.Id }, new HolidayDto(
            holiday.Id, holiday.Title, holiday.StartDate, holiday.EndDate,
            holiday.HolidayType, holiday.Description, holiday.IsActive, holiday.CreatedAt));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateHoliday(Guid id, [FromBody] UpdateHolidayDto dto)
    {
        var holiday = await _db.Holidays.FindAsync(id);
        if (holiday == null) return NotFound();

        if (string.IsNullOrWhiteSpace(dto.Title))
        {
            return BadRequest(new { message = "Holiday title is required." });
        }

        holiday.Title = dto.Title.Trim();
        holiday.StartDate = dto.StartDate.Date;
        holiday.EndDate = dto.EndDate.Date;
        holiday.HolidayType = string.IsNullOrWhiteSpace(dto.HolidayType) ? "Festival" : dto.HolidayType.Trim();
        holiday.Description = dto.Description?.Trim();
        holiday.IsActive = dto.IsActive;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteHoliday(Guid id)
    {
        var holiday = await _db.Holidays.FindAsync(id);
        if (holiday == null) return NotFound();

        _db.Holidays.Remove(holiday);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
