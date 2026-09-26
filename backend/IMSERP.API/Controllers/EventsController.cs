using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.API.Helpers;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EventsController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IWebHostEnvironment _env;

    public EventsController(IIMSERPDbContext db, ICurrentUserService currentUser, IWebHostEnvironment env)
    {
        _db = db;
        _currentUser = currentUser;
        _env = env;
    }

    [HttpGet("dashboard-summary")]
    public async Task<ActionResult<DashboardCelebrationsSummaryDto>> GetDashboardSummary()
    {
        var tenantId = _currentUser.TenantId;
        var today = DateTime.UtcNow.Date;
        var endOfMonth = today.AddDays(30);

        // 1. Top upcoming events
        var upcomingEvents = await _db.SchoolEvents
            .AsNoTracking()
            .Include(e => e.Branch)
            .Include(e => e.Photos)
            .Where(e => e.IsActive && e.StartDate.Date >= today.AddDays(-1))
            .OrderBy(e => e.StartDate)
            .Take(6)
            .Select(e => new SchoolEventDto(
                e.Id,
                e.TenantId,
                e.BranchId,
                e.Branch != null ? e.Branch.Name : null,
                e.Title,
                e.Category,
                e.StartDate,
                e.EndDate,
                e.StartTime,
                e.EndTime,
                e.Venue,
                e.Description,
                e.TargetAudience,
                e.BannerUrl,
                e.AttachmentPdfUrl,
                e.ChiefGuestName,
                e.CoordinatorName,
                e.Status,
                e.IsActive,
                e.CreatedAt,
                e.Photos.Count,
                null
            ))
            .ToListAsync();

        // 2. Today's birthdays (Students & Staff)
        var todayMonth = today.Month;
        var todayDay = today.Day;

        var studentBirthdaysToday = await _db.Students
            .AsNoTracking()
            .Include(s => s.Batch)
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Where(s => s.IsActive && s.DateOfBirth.HasValue 
                     && s.DateOfBirth.Value.Month == todayMonth 
                     && s.DateOfBirth.Value.Day == todayDay)
            .Select(s => new BirthdayItemDto(
                s.Id,
                s.StudentName,
                "Student",
                s.Class != null ? $"{s.Class.Name}{(s.Section != null ? " - " + s.Section.Name : "")}" : (s.Batch != null ? s.Batch.Name : "Classroom Student"),
                s.RollNumber,
                s.ProfilePhoto,
                s.DateOfBirth!.Value,
                today.Year - s.DateOfBirth!.Value.Year,
                s.ParentWhatsAppPhone,
                "Today",
                true
            ))
            .ToListAsync();

        var teacherBirthdaysToday = await _db.Teachers
            .AsNoTracking()
            .Where(t => t.IsActive && t.DateOfBirth.HasValue 
                     && t.DateOfBirth.Value.Month == todayMonth 
                     && t.DateOfBirth.Value.Day == todayDay)
            .Select(t => new BirthdayItemDto(
                t.Id,
                t.FullName,
                "Staff",
                t.Department ?? t.Specialization ?? "Faculty Staff",
                t.EmployeeCode,
                t.PhotoUrl,
                t.DateOfBirth!.Value,
                today.Year - t.DateOfBirth!.Value.Year,
                t.WhatsAppPhone ?? t.PhoneNumber,
                "Today",
                true
            ))
            .ToListAsync();

        var todayBirthdays = studentBirthdaysToday.Concat(teacherBirthdaysToday).ToList();

        // 3. Upcoming Birthdays in Next 7 Days (excluding today)
        var upcomingDays = Enumerable.Range(1, 7).Select(offset => today.AddDays(offset)).ToList();
        var upcomingMonthDays = upcomingDays.Select(d => new { d.Month, d.Day, DateObj = d }).ToList();

        var allUpcomingStudents = await _db.Students
            .AsNoTracking()
            .Include(s => s.Batch)
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Where(s => s.IsActive && s.DateOfBirth.HasValue)
            .ToListAsync();

        var upcomingStudentBirthdays = allUpcomingStudents
            .Where(s => upcomingDays.Any(d => d.Month == s.DateOfBirth!.Value.Month && d.Day == s.DateOfBirth!.Value.Day))
            .Select(s => {
                var nextMatch = upcomingDays.First(d => d.Month == s.DateOfBirth!.Value.Month && d.Day == s.DateOfBirth!.Value.Day);
                return new BirthdayItemDto(
                    s.Id,
                    s.StudentName,
                    "Student",
                    s.Class != null ? $"{s.Class.Name}{(s.Section != null ? " - " + s.Section.Name : "")}" : (s.Batch != null ? s.Batch.Name : "Classroom Student"),
                    s.RollNumber,
                    s.ProfilePhoto,
                    s.DateOfBirth!.Value,
                    today.Year - s.DateOfBirth!.Value.Year,
                    s.ParentWhatsAppPhone,
                    nextMatch.ToString("dd MMM"),
                    false
                );
            })
            .ToList();

        var allUpcomingTeachers = await _db.Teachers
            .AsNoTracking()
            .Where(t => t.IsActive && t.DateOfBirth.HasValue)
            .ToListAsync();

        var upcomingTeacherBirthdays = allUpcomingTeachers
            .Where(t => upcomingDays.Any(d => d.Month == t.DateOfBirth!.Value.Month && d.Day == t.DateOfBirth!.Value.Day))
            .Select(t => {
                var nextMatch = upcomingDays.First(d => d.Month == t.DateOfBirth!.Value.Month && d.Day == t.DateOfBirth!.Value.Day);
                return new BirthdayItemDto(
                    t.Id,
                    t.FullName,
                    "Staff",
                    t.Department ?? t.Specialization ?? "Faculty Staff",
                    t.EmployeeCode,
                    t.PhotoUrl,
                    t.DateOfBirth!.Value,
                    today.Year - t.DateOfBirth!.Value.Year,
                    t.WhatsAppPhone ?? t.PhoneNumber,
                    nextMatch.ToString("dd MMM"),
                    false
                );
            })
            .ToList();

        var upcomingBirthdaysThisWeek = upcomingStudentBirthdays.Concat(upcomingTeacherBirthdays)
            .OrderBy(b => b.BirthdayDateFormatted)
            .Take(8)
            .ToList();

        // 4. Recent gallery highlights (e.g. from past events)
        var recentGalleryHighlights = await _db.EventPhotos
            .AsNoTracking()
            .OrderByDescending(p => p.UploadedAt)
            .Take(8)
            .Select(p => new EventPhotoDto(
                p.Id,
                p.EventId,
                p.PhotoUrl,
                p.Caption,
                p.UploadedAt
            ))
            .ToListAsync();

        var totalEventsThisMonth = await _db.SchoolEvents
            .CountAsync(e => e.IsActive && e.StartDate.Month == today.Month && e.StartDate.Year == today.Year);

        return Ok(new DashboardCelebrationsSummaryDto(
            upcomingEvents,
            todayBirthdays,
            upcomingBirthdaysThisWeek,
            recentGalleryHighlights,
            totalEventsThisMonth,
            todayBirthdays.Count
        ));
    }

    [HttpGet("paged")]
    public async Task<ActionResult<PagedResultDto<SchoolEventDto>>> GetEventsPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? category = null,
        [FromQuery] string? status = null,
        [FromQuery] int year = 0)
    {
        var query = _db.SchoolEvents
            .AsNoTracking()
            .Include(e => e.Branch)
            .Include(e => e.Photos)
            .Where(e => e.IsActive);

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(e => e.Title.ToLower().Contains(term) 
                                  || (e.Venue != null && e.Venue.ToLower().Contains(term))
                                  || (e.Description != null && e.Description.ToLower().Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(category) && category != "All")
        {
            query = query.Where(e => e.Category == category);
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
        {
            query = query.Where(e => e.Status == status);
        }

        if (year > 0)
        {
            query = query.Where(e => e.StartDate.Year == year || (e.EndDate.HasValue && e.EndDate.Value.Year == year));
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderBy(e => e.StartDate)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new SchoolEventDto(
                e.Id,
                e.TenantId,
                e.BranchId,
                e.Branch != null ? e.Branch.Name : null,
                e.Title,
                e.Category,
                e.StartDate,
                e.EndDate,
                e.StartTime,
                e.EndTime,
                e.Venue,
                e.Description,
                e.TargetAudience,
                e.BannerUrl,
                e.AttachmentPdfUrl,
                e.ChiefGuestName,
                e.CoordinatorName,
                e.Status,
                e.IsActive,
                e.CreatedAt,
                e.Photos.Count,
                null
            ))
            .ToListAsync();

        return Ok(new PagedResultDto<SchoolEventDto>(items, totalCount, pageNumber, pageSize));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SchoolEventDto>> GetEventById(Guid id)
    {
        var e = await _db.SchoolEvents
            .AsNoTracking()
            .Include(ev => ev.Branch)
            .Include(ev => ev.Photos)
            .FirstOrDefaultAsync(ev => ev.Id == id);

        if (e == null) return NotFound("Event not found");

        var photos = e.Photos
            .OrderByDescending(p => p.UploadedAt)
            .Select(p => new EventPhotoDto(p.Id, p.EventId, p.PhotoUrl, p.Caption, p.UploadedAt))
            .ToList();

        return Ok(new SchoolEventDto(
            e.Id,
            e.TenantId,
            e.BranchId,
            e.Branch != null ? e.Branch.Name : null,
            e.Title,
            e.Category,
            e.StartDate,
            e.EndDate,
            e.StartTime,
            e.EndTime,
            e.Venue,
            e.Description,
            e.TargetAudience,
            e.BannerUrl,
            e.AttachmentPdfUrl,
            e.ChiefGuestName,
            e.CoordinatorName,
            e.Status,
            e.IsActive,
            e.CreatedAt,
            photos.Count,
            photos
        ));
    }

    [HttpPost]
    public async Task<ActionResult<SchoolEventDto>> CreateEvent([FromBody] CreateSchoolEventDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
        {
            return BadRequest("Event Title is required");
        }

        var tenantId = _currentUser.TenantId;
        var eventId = Guid.NewGuid();

        string? bannerPath = null;
        if (!string.IsNullOrWhiteSpace(dto.BannerBase64))
        {
            bannerPath = ImageStorageHelper.SaveBase64Image(dto.BannerBase64, "events", eventId.ToString(), _env.ContentRootPath);
        }

        string? circularPath = null;
        if (!string.IsNullOrWhiteSpace(dto.AttachmentPdfBase64))
        {
            circularPath = ImageStorageHelper.SaveBase64File(dto.AttachmentPdfBase64, "events/circulars", eventId.ToString(), _env.ContentRootPath);
        }

        var ev = new SchoolEvent
        {
            Id = eventId,
            TenantId = tenantId,
            BranchId = dto.BranchId ?? _currentUser.BranchId,
            Title = dto.Title.Trim(),
            Category = dto.Category,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            StartTime = dto.StartTime,
            EndTime = dto.EndTime,
            Venue = dto.Venue,
            Description = dto.Description,
            TargetAudience = dto.TargetAudience,
            BannerUrl = bannerPath,
            AttachmentPdfUrl = circularPath,
            ChiefGuestName = dto.ChiefGuestName,
            CoordinatorName = dto.CoordinatorName,
            Status = "Upcoming",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.SchoolEvents.Add(ev);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetEventById), new { id = ev.Id }, new SchoolEventDto(
            ev.Id,
            ev.TenantId,
            ev.BranchId,
            null,
            ev.Title,
            ev.Category,
            ev.StartDate,
            ev.EndDate,
            ev.StartTime,
            ev.EndTime,
            ev.Venue,
            ev.Description,
            ev.TargetAudience,
            ev.BannerUrl,
            ev.AttachmentPdfUrl,
            ev.ChiefGuestName,
            ev.CoordinatorName,
            ev.Status,
            ev.IsActive,
            ev.CreatedAt,
            0,
            new List<EventPhotoDto>()
        ));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<SchoolEventDto>> UpdateEvent(Guid id, [FromBody] UpdateSchoolEventDto dto)
    {
        var ev = await _db.SchoolEvents.FirstOrDefaultAsync(e => e.Id == id);
        if (ev == null) return NotFound("Event not found");

        if (!string.IsNullOrWhiteSpace(dto.BannerBase64))
        {
            ev.BannerUrl = ImageStorageHelper.SaveBase64Image(dto.BannerBase64, "events", ev.Id.ToString(), _env.ContentRootPath) ?? ev.BannerUrl;
        }

        if (!string.IsNullOrWhiteSpace(dto.AttachmentPdfBase64))
        {
            ev.AttachmentPdfUrl = ImageStorageHelper.SaveBase64File(dto.AttachmentPdfBase64, "events/circulars", ev.Id.ToString(), _env.ContentRootPath) ?? ev.AttachmentPdfUrl;
        }

        ev.Title = dto.Title.Trim();
        ev.Category = dto.Category;
        ev.StartDate = dto.StartDate;
        ev.EndDate = dto.EndDate;
        ev.StartTime = dto.StartTime;
        ev.EndTime = dto.EndTime;
        ev.Venue = dto.Venue;
        ev.Description = dto.Description;
        ev.TargetAudience = dto.TargetAudience;
        ev.ChiefGuestName = dto.ChiefGuestName;
        ev.CoordinatorName = dto.CoordinatorName;
        ev.Status = dto.Status;
        ev.IsActive = dto.IsActive;
        if (dto.BranchId.HasValue) ev.BranchId = dto.BranchId;

        await _db.SaveChangesAsync();

        return Ok(new SchoolEventDto(
            ev.Id,
            ev.TenantId,
            ev.BranchId,
            null,
            ev.Title,
            ev.Category,
            ev.StartDate,
            ev.EndDate,
            ev.StartTime,
            ev.EndTime,
            ev.Venue,
            ev.Description,
            ev.TargetAudience,
            ev.BannerUrl,
            ev.AttachmentPdfUrl,
            ev.ChiefGuestName,
            ev.CoordinatorName,
            ev.Status,
            ev.IsActive,
            ev.CreatedAt,
            0,
            null
        ));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> DeleteEvent(Guid id)
    {
        var ev = await _db.SchoolEvents.Include(e => e.Photos).FirstOrDefaultAsync(e => e.Id == id);
        if (ev == null) return NotFound("Event not found");

        _db.EventPhotos.RemoveRange(ev.Photos);
        _db.SchoolEvents.Remove(ev);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("{id:guid}/photos")]
    public async Task<ActionResult<List<EventPhotoDto>>> AddEventPhotos(Guid id, [FromBody] AddEventPhotosDto dto)
    {
        var ev = await _db.SchoolEvents.FirstOrDefaultAsync(e => e.Id == id);
        if (ev == null) return NotFound("Event not found");

        if (dto.PhotosBase64 == null || dto.PhotosBase64.Count == 0)
        {
            return BadRequest("At least one photo is required");
        }

        var uploadedPhotos = new List<EventPhoto>();
        foreach (var pBase64 in dto.PhotosBase64)
        {
            var photoId = Guid.NewGuid();
            var path = ImageStorageHelper.SaveBase64Image(pBase64, "events/gallery", photoId.ToString(), _env.ContentRootPath);
            if (!string.IsNullOrEmpty(path))
            {
                var photo = new EventPhoto
                {
                    Id = photoId,
                    TenantId = ev.TenantId,
                    EventId = ev.Id,
                    PhotoUrl = path,
                    Caption = dto.Caption,
                    UploadedAt = DateTime.UtcNow
                };
                uploadedPhotos.Add(photo);
                _db.EventPhotos.Add(photo);
            }
        }

        await _db.SaveChangesAsync();

        var result = uploadedPhotos.Select(p => new EventPhotoDto(p.Id, p.EventId, p.PhotoUrl, p.Caption, p.UploadedAt)).ToList();
        return Ok(result);
    }

    [HttpDelete("photos/{photoId:guid}")]
    public async Task<ActionResult> DeleteEventPhoto(Guid photoId)
    {
        var photo = await _db.EventPhotos.FirstOrDefaultAsync(p => p.Id == photoId);
        if (photo == null) return NotFound("Photo not found");

        _db.EventPhotos.Remove(photo);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("calendar")]
    public async Task<ActionResult<List<CalendarActivityItemDto>>> GetCalendarFeed([FromQuery] int year, [FromQuery] int month)
    {
        if (year <= 0) year = DateTime.UtcNow.Year;
        if (month <= 0 || month > 12) month = DateTime.UtcNow.Month;

        var items = new List<CalendarActivityItemDto>();

        // 1. Holidays in this month
        var holidays = await _db.Holidays
            .AsNoTracking()
            .Where(h => h.IsActive && (h.StartDate.Month == month || h.EndDate.Month == month) && (h.StartDate.Year == year || h.EndDate.Year == year))
            .ToListAsync();

        foreach (var h in holidays)
        {
            items.Add(new CalendarActivityItemDto(
                h.StartDate.ToString("yyyy-MM-dd"),
                "Holiday",
                h.Title,
                h.HolidayType,
                "#ef4444",
                h.Description
            ));
        }

        // 2. Events in this month
        var events = await _db.SchoolEvents
            .AsNoTracking()
            .Where(e => e.IsActive && e.StartDate.Month == month && e.StartDate.Year == year)
            .ToListAsync();

        foreach (var ev in events)
        {
            items.Add(new CalendarActivityItemDto(
                ev.StartDate.ToString("yyyy-MM-dd"),
                "Event",
                ev.Title,
                $"{ev.Category} • {ev.Venue ?? "Campus"}",
                "#8b5cf6",
                ev.Description
            ));
        }

        // 3. Birthdays in this month
        var studentBirthdays = await _db.Students
            .AsNoTracking()
            .Where(s => s.IsActive && s.DateOfBirth.HasValue && s.DateOfBirth.Value.Month == month)
            .ToListAsync();

        foreach (var s in studentBirthdays)
        {
            var day = s.DateOfBirth!.Value.Day;
            var dateStr = $"{year}-{month:D2}-{day:D2}";
            items.Add(new CalendarActivityItemDto(
                dateStr,
                "Birthday",
                $"🎂 {s.StudentName}'s Birthday",
                $"Student • {s.RollNumber}",
                "#f59e0b",
                null
            ));
        }

        var teacherBirthdays = await _db.Teachers
            .AsNoTracking()
            .Where(t => t.IsActive && t.DateOfBirth.HasValue && t.DateOfBirth.Value.Month == month)
            .ToListAsync();

        foreach (var t in teacherBirthdays)
        {
            var day = t.DateOfBirth!.Value.Day;
            var dateStr = $"{year}-{month:D2}-{day:D2}";
            items.Add(new CalendarActivityItemDto(
                dateStr,
                "Birthday",
                $"🎂 {t.FullName}'s Birthday",
                $"Staff • {t.Department ?? "Faculty"}",
                "#10b981",
                null
            ));
        }

        return Ok(items);
    }
}
