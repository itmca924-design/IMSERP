using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.API.Helpers;
using IMSERP.API.Services;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EventsController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IWebHostEnvironment _env;
    private readonly IMenuPermissionService _menuPermissions;

    public EventsController(IIMSERPDbContext db, ICurrentUserService currentUser, IWebHostEnvironment env, IMenuPermissionService menuPermissions)
    {
        _db = db;
        _currentUser = currentUser;
        _env = env;
        _menuPermissions = menuPermissions;
    }

    [HttpGet("dashboard-summary")]
    [SkipMenuPermission]
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

        // 2. Role-based birthday visibility scope
        var birthdayScope = await GetBirthdayScopeAsync();

        // Today's birthdays (Students & Staff)
        var todayMonth = today.Month;
        var todayDay = today.Day;

        var studentBirthdaysToday = new List<BirthdayItemDto>();
        if (birthdayScope.CanViewStudents)
        {
            var studentTodayQuery = _db.Students
                .AsNoTracking()
                .Where(s => s.IsActive && s.DateOfBirth.HasValue 
                         && s.DateOfBirth.Value.Month == todayMonth 
                         && s.DateOfBirth.Value.Day == todayDay);

            if (birthdayScope.AllowedStudentIds != null)
            {
                studentTodayQuery = studentTodayQuery.Where(s => birthdayScope.AllowedStudentIds.Contains(s.Id));
            }

            studentBirthdaysToday = await studentTodayQuery
                .Select(s => new BirthdayItemDto(
                    s.Id,
                    s.StudentName,
                    "Student",
                    s.Class != null ? $"{s.Class.Name}{(s.Section != null ? " - " + s.Section.Name : "")}" : (s.Batch != null ? s.Batch.Name : "Classroom Student"),
                    s.RollNumber,
                    s.ProfilePhoto,
                    s.DateOfBirth!.Value,
                    today.Year - s.DateOfBirth!.Value.Year,
                    birthdayScope.HideStudentContact ? null : s.ParentWhatsAppPhone,
                    "Today",
                    true
                ))
                .ToListAsync();
        }

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
        var d1 = upcomingDays[0];
        var d2 = upcomingDays[1];
        var d3 = upcomingDays[2];
        var d4 = upcomingDays[3];
        var d5 = upcomingDays[4];
        var d6 = upcomingDays[5];
        var d7 = upcomingDays[6];

        var upcomingStudentBirthdays = new List<BirthdayItemDto>();
        if (birthdayScope.CanViewStudents)
        {
            var upcomingStudentQuery = _db.Students
                .AsNoTracking()
                .Where(s => s.IsActive && s.DateOfBirth.HasValue &&
                    (
                        (s.DateOfBirth.Value.Month == d1.Month && s.DateOfBirth.Value.Day == d1.Day) ||
                        (s.DateOfBirth.Value.Month == d2.Month && s.DateOfBirth.Value.Day == d2.Day) ||
                        (s.DateOfBirth.Value.Month == d3.Month && s.DateOfBirth.Value.Day == d3.Day) ||
                        (s.DateOfBirth.Value.Month == d4.Month && s.DateOfBirth.Value.Day == d4.Day) ||
                        (s.DateOfBirth.Value.Month == d5.Month && s.DateOfBirth.Value.Day == d5.Day) ||
                        (s.DateOfBirth.Value.Month == d6.Month && s.DateOfBirth.Value.Day == d6.Day) ||
                        (s.DateOfBirth.Value.Month == d7.Month && s.DateOfBirth.Value.Day == d7.Day)
                    ));

            if (birthdayScope.AllowedStudentIds != null)
            {
                upcomingStudentQuery = upcomingStudentQuery.Where(s => birthdayScope.AllowedStudentIds.Contains(s.Id));
            }

            var rawUpcomingStudents = await upcomingStudentQuery
                .Select(s => new {
                    s.Id,
                    s.StudentName,
                    ClassName = s.Class != null ? $"{s.Class.Name}{(s.Section != null ? " - " + s.Section.Name : "")}" : (s.Batch != null ? s.Batch.Name : "Classroom Student"),
                    s.RollNumber,
                    s.ProfilePhoto,
                    DateOfBirth = s.DateOfBirth!.Value,
                    s.ParentWhatsAppPhone
                })
                .ToListAsync();

            upcomingStudentBirthdays = rawUpcomingStudents
                .Select(s => {
                    var nextMatch = upcomingDays.First(d => d.Month == s.DateOfBirth.Month && d.Day == s.DateOfBirth.Day);
                    return new BirthdayItemDto(
                        s.Id,
                        s.StudentName,
                        "Student",
                        s.ClassName,
                        s.RollNumber,
                        s.ProfilePhoto,
                        s.DateOfBirth,
                        today.Year - s.DateOfBirth.Year,
                        birthdayScope.HideStudentContact ? null : s.ParentWhatsAppPhone,
                        nextMatch.ToString("dd MMM"),
                        false
                    );
                })
                .ToList();
        }

        var upcomingTeacherQuery = _db.Teachers
            .AsNoTracking()
            .Where(t => t.IsActive && t.DateOfBirth.HasValue &&
                (
                    (t.DateOfBirth.Value.Month == d1.Month && t.DateOfBirth.Value.Day == d1.Day) ||
                    (t.DateOfBirth.Value.Month == d2.Month && t.DateOfBirth.Value.Day == d2.Day) ||
                    (t.DateOfBirth.Value.Month == d3.Month && t.DateOfBirth.Value.Day == d3.Day) ||
                    (t.DateOfBirth.Value.Month == d4.Month && t.DateOfBirth.Value.Day == d4.Day) ||
                    (t.DateOfBirth.Value.Month == d5.Month && t.DateOfBirth.Value.Day == d5.Day) ||
                    (t.DateOfBirth.Value.Month == d6.Month && t.DateOfBirth.Value.Day == d6.Day) ||
                    (t.DateOfBirth.Value.Month == d7.Month && t.DateOfBirth.Value.Day == d7.Day)
                ));

        var rawUpcomingTeachers = await upcomingTeacherQuery
            .Select(t => new {
                t.Id,
                t.FullName,
                Department = t.Department ?? t.Specialization ?? "Faculty Staff",
                t.EmployeeCode,
                t.PhotoUrl,
                DateOfBirth = t.DateOfBirth!.Value,
                Phone = t.WhatsAppPhone ?? t.PhoneNumber
            })
            .ToListAsync();

        var upcomingTeacherBirthdays = rawUpcomingTeachers
            .Select(t => {
                var nextMatch = upcomingDays.First(d => d.Month == t.DateOfBirth.Month && d.Day == t.DateOfBirth.Day);
                return new BirthdayItemDto(
                    t.Id,
                    t.FullName,
                    "Staff",
                    t.Department,
                    t.EmployeeCode,
                    t.PhotoUrl,
                    t.DateOfBirth,
                    today.Year - t.DateOfBirth.Year,
                    t.Phone,
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

        // 3. Birthdays in this month (Role-scoped)
        var calBirthdayScope = await GetBirthdayScopeAsync();
        if (calBirthdayScope.CanViewStudents)
        {
            var studentMonthQuery = _db.Students
                .AsNoTracking()
                .Where(s => s.IsActive && s.DateOfBirth.HasValue && s.DateOfBirth.Value.Month == month);

            if (calBirthdayScope.AllowedStudentIds != null)
            {
                studentMonthQuery = studentMonthQuery.Where(s => calBirthdayScope.AllowedStudentIds.Contains(s.Id));
            }

            var studentBirthdays = await studentMonthQuery
                .Select(s => new {
                    s.StudentName,
                    s.RollNumber,
                    DateOfBirth = s.DateOfBirth!.Value
                })
                .ToListAsync();

            foreach (var s in studentBirthdays)
            {
                var day = s.DateOfBirth.Day;
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
        }

        var teacherBirthdays = await _db.Teachers
            .AsNoTracking()
            .Where(t => t.IsActive && t.DateOfBirth.HasValue && t.DateOfBirth.Value.Month == month)
            .Select(t => new {
                t.FullName,
                Department = t.Department ?? "Faculty",
                DateOfBirth = t.DateOfBirth!.Value
            })
            .ToListAsync();

        foreach (var t in teacherBirthdays)
        {
            var day = t.DateOfBirth.Day;
            var dateStr = $"{year}-{month:D2}-{day:D2}";
            items.Add(new CalendarActivityItemDto(
                dateStr,
                "Birthday",
                $"🎂 {t.FullName}'s Birthday",
                $"Staff • {t.Department}",
                "#10b981",
                null
            ));
        }

        return Ok(items);
    }

    // ── Birthday Scope Helper ──────────────────────────────────────────────────
    private record BirthdayScopeResult(
        bool CanViewStudents,
        List<Guid>? AllowedStudentIds,
        bool HideStudentContact
    );

    private async Task<BirthdayScopeResult> GetBirthdayScopeAsync()
    {
        var tenantId = _currentUser.TenantId;
        var userId = _currentUser.UserId;

        var user = await _db.Users
            .AsNoTracking()
            .Include(u => u.AssignedRole)
            .FirstOrDefaultAsync(u => u.Id == userId);

        var roleName = user?.AssignedRole?.Name ?? _currentUser.UserRole ?? "";

        // 1. If user doesn't have student view permission (e.g. Accountant, Finance, Office Clerk), hide student birthdays
        bool canViewStudents = await _menuPermissions.HasPermissionAsync("/students", MenuPermissionOperation.View)
            || await _menuPermissions.HasPermissionAsync("/school/students", MenuPermissionOperation.View);

        if (!canViewStudents)
        {
            return new BirthdayScopeResult(
                CanViewStudents: false,
                AllowedStudentIds: new List<Guid>(),
                HideStudentContact: false
            );
        }

        // 2. Student / Parent → Only classmates in their specific section/batch; hide contact phone for child privacy
        // Detect via DB link (UserId/ParentUserId → Student record), not role string
        var studentOrParentRecord = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s =>
            (s.UserId == userId || s.ParentUserId == userId) && s.TenantId == tenantId);

        if (studentOrParentRecord != null)
        {
            var student = studentOrParentRecord;

            if (student != null)
            {
                var classmateIds = await _db.Students.AsNoTracking()
                    .Where(s => s.IsActive &&
                                ((student.SectionId.HasValue && s.SectionId == student.SectionId.Value) ||
                                 (student.BatchId.HasValue && s.BatchId == student.BatchId.Value) ||
                                 (student.ClassId.HasValue && s.ClassId == student.ClassId.Value)))
                    .Select(s => s.Id)
                    .ToListAsync();

                return new BirthdayScopeResult(
                    CanViewStudents: true,
                    AllowedStudentIds: classmateIds,
                    HideStudentContact: true
                );
            }

            return new BirthdayScopeResult(
                CanViewStudents: false,
                AllowedStudentIds: new List<Guid>(),
                HideStudentContact: true
            );
        }

        // 3. Teacher / Faculty → Detect via DB link (Teacher record), not role string
        var linkedTeacherForBirthday = await _db.Teachers.AsNoTracking().FirstOrDefaultAsync(t =>
            t.TenantId == tenantId &&
            (t.UserId == userId || (user != null && user.Email != null && t.Email == user.Email)));

        if (linkedTeacherForBirthday != null)
        {
            var linkedTeacher = linkedTeacherForBirthday;

            if (linkedTeacher != null)
            {
                // Class Teacher sections
                var classTeacherSectionIds = await _db.SchoolSections.AsNoTracking()
                    .Where(s => s.ClassTeacherId == linkedTeacher.Id && s.IsActive)
                    .Select(s => s.Id)
                    .ToListAsync();

                // Batch & Class assignments
                var assignments = await _db.TeacherBatchAssignments.AsNoTracking()
                    .Where(a => a.TeacherId == linkedTeacher.Id && a.IsActive)
                    .ToListAsync();

                var assignedBatchIds = assignments.Where(a => a.BatchId.HasValue).Select(a => a.BatchId!.Value).Distinct().ToList();
                var assignedClassIds = assignments.Where(a => a.ClassId.HasValue).Select(a => a.ClassId!.Value).Distinct().ToList();
                var assignedSectionIds = assignments.Where(a => a.SectionId.HasValue).Select(a => a.SectionId!.Value)
                    .Concat(classTeacherSectionIds).Distinct().ToList();

                var teacherStudentIds = await _db.Students.AsNoTracking()
                    .Where(s => s.IsActive &&
                                ((s.SectionId.HasValue && assignedSectionIds.Contains(s.SectionId.Value)) ||
                                 (s.BatchId.HasValue && assignedBatchIds.Contains(s.BatchId.Value)) ||
                                 (s.ClassId.HasValue && assignedClassIds.Contains(s.ClassId.Value))))
                    .Select(s => s.Id)
                    .ToListAsync();

                return new BirthdayScopeResult(
                    CanViewStudents: true,
                    AllowedStudentIds: teacherStudentIds,
                    HideStudentContact: false
                );
            }
        }

        // 4. Default: Admin, SuperAdmin, InstituteAdmin, HR, Principal, FrontDesk -> Full branch/school access
        return new BirthdayScopeResult(
            CanViewStudents: true,
            AllowedStudentIds: null, // null indicates all students in branch
            HideStudentContact: false
        );
    }
}
