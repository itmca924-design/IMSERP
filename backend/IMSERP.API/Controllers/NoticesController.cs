using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NoticesController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public NoticesController(IIMSERPDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<SchoolNoticeDto>>> GetNotices(
        [FromQuery] string? category,
        [FromQuery] string? targetAudience,
        [FromQuery] string? priority,
        [FromQuery] Guid? classId,
        [FromQuery] bool? isPinned,
        [FromQuery] string? search)
    {
        var tenantId = _currentUser.TenantId;
        var query = _db.SchoolNotices
            .AsNoTracking()
            .Include(n => n.Class)
            .Where(n => n.TenantId == tenantId);

        if (_currentUser.BranchId.HasValue)
        {
            var branchId = _currentUser.BranchId.Value;
            query = query.Where(n => !n.BranchId.HasValue || n.BranchId == branchId);
        }

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(n => n.Category == category);

        if (!string.IsNullOrWhiteSpace(targetAudience))
            query = query.Where(n => n.TargetAudience == targetAudience);

        if (!string.IsNullOrWhiteSpace(priority))
            query = query.Where(n => n.Priority == priority);

        if (classId.HasValue && classId.Value != Guid.Empty)
            query = query.Where(n => n.ClassId == classId);

        if (isPinned.HasValue)
            query = query.Where(n => n.IsPinned == isPinned.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(n =>
                n.Title.ToLower().Contains(s) ||
                n.NoticeNumber.ToLower().Contains(s) ||
                n.Content.ToLower().Contains(s));
        }

        var notices = await query
            .OrderByDescending(n => n.IsPinned)
            .ThenByDescending(n => n.PublishDate)
            .Select(n => new SchoolNoticeDto(
                n.Id,
                n.TenantId,
                n.BranchId,
                n.NoticeNumber,
                n.Title,
                n.Content,
                n.Category,
                n.TargetAudience,
                n.ClassId,
                n.ClassName ?? (n.Class != null ? n.Class.Name : null),
                n.Priority,
                n.PublishDate,
                n.ExpiryDate,
                n.AttachmentUrl,
                n.IsPinned,
                n.IsActive,
                n.CreatedBy,
                n.CreatedAt,
                n.UpdatedAt
            ))
            .ToListAsync();

        return Ok(notices);
    }

    [HttpGet("stats")]
    public async Task<ActionResult<NoticeStatsDto>> GetNoticeStats()
    {
        var tenantId = _currentUser.TenantId;
        var today = DateTime.Now.Date;

        var query = _db.SchoolNotices.AsNoTracking().Where(n => n.TenantId == tenantId);
        if (_currentUser.BranchId.HasValue)
        {
            var branchId = _currentUser.BranchId.Value;
            query = query.Where(n => !n.BranchId.HasValue || n.BranchId == branchId);
        }

        var total = await query.CountAsync();
        var urgent = await query.CountAsync(n => n.Priority == "Urgent");
        var pinned = await query.CountAsync(n => n.IsPinned);
        var active = await query.CountAsync(n => n.IsActive && (!n.ExpiryDate.HasValue || n.ExpiryDate.Value.Date >= today));
        var student = await query.CountAsync(n => n.TargetAudience == "Students" || n.TargetAudience == "All" || n.TargetAudience == "Parents");
        var staff = await query.CountAsync(n => n.TargetAudience == "Teachers" || n.TargetAudience == "Staff");

        return Ok(new NoticeStatsDto(total, urgent, pinned, active, student, staff));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SchoolNoticeDto>> GetNoticeById(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var n = await _db.SchoolNotices
            .AsNoTracking()
            .Include(x => x.Class)
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);

        if (n == null) return NotFound(new { message = "Notice record not found." });

        return Ok(new SchoolNoticeDto(
            n.Id,
            n.TenantId,
            n.BranchId,
            n.NoticeNumber,
            n.Title,
            n.Content,
            n.Category,
            n.TargetAudience,
            n.ClassId,
            n.ClassName ?? (n.Class != null ? n.Class.Name : null),
            n.Priority,
            n.PublishDate,
            n.ExpiryDate,
            n.AttachmentUrl,
            n.IsPinned,
            n.IsActive,
            n.CreatedBy,
            n.CreatedAt,
            n.UpdatedAt
        ));
    }

    [HttpPost]
    public async Task<ActionResult<SchoolNoticeDto>> CreateNotice([FromBody] CreateSchoolNoticeDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(new { message = "Notice title is required." });

        if (string.IsNullOrWhiteSpace(dto.Content))
            return BadRequest(new { message = "Notice content / description is required." });

        if (dto.ExpiryDate.HasValue && dto.PublishDate != default && dto.ExpiryDate.Value.Date < dto.PublishDate.Date)
            return BadRequest(new { message = "Expiry date cannot be earlier than publish date." });

        var tenantId = _currentUser.TenantId;
        var branchId = _currentUser.BranchId;

        // Auto-generate serial circular number: CIR-2026-0001
        var now = DateTime.Now;
        var year = now.Year;
        var count = await _db.SchoolNotices
            .CountAsync(n => n.TenantId == tenantId && n.CreatedAt.Year == year);
        var noticeNum = $"CIR-{year}-{(count + 1):D4}";

        string? className = dto.ClassName;
        if (dto.ClassId.HasValue && string.IsNullOrWhiteSpace(className))
        {
            var cls = await _db.SchoolClasses.FirstOrDefaultAsync(c => c.Id == dto.ClassId.Value);
            className = cls?.Name;
        }

        var notice = new SchoolNotice
        {
            TenantId = tenantId,
            BranchId = branchId,
            NoticeNumber = noticeNum,
            Title = dto.Title.Trim(),
            Content = dto.Content.Trim(),
            Category = !string.IsNullOrWhiteSpace(dto.Category) ? dto.Category : "Academic",
            TargetAudience = !string.IsNullOrWhiteSpace(dto.TargetAudience) ? dto.TargetAudience : "All",
            ClassId = dto.ClassId,
            ClassName = className,
            Priority = !string.IsNullOrWhiteSpace(dto.Priority) ? dto.Priority : "Normal",
            PublishDate = dto.PublishDate != default ? dto.PublishDate : now,
            ExpiryDate = dto.ExpiryDate,
            AttachmentUrl = dto.AttachmentUrl?.Trim(),
            IsPinned = dto.IsPinned,
            IsActive = true,
            CreatedBy = _currentUser.UserId.ToString(),
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.SchoolNotices.Add(notice);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetNoticeById), new { id = notice.Id }, new SchoolNoticeDto(
            notice.Id,
            notice.TenantId,
            notice.BranchId,
            notice.NoticeNumber,
            notice.Title,
            notice.Content,
            notice.Category,
            notice.TargetAudience,
            notice.ClassId,
            notice.ClassName,
            notice.Priority,
            notice.PublishDate,
            notice.ExpiryDate,
            notice.AttachmentUrl,
            notice.IsPinned,
            notice.IsActive,
            notice.CreatedBy,
            notice.CreatedAt,
            notice.UpdatedAt
        ));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateNotice(Guid id, [FromBody] UpdateSchoolNoticeDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var notice = await _db.SchoolNotices.FirstOrDefaultAsync(n => n.Id == id && n.TenantId == tenantId);
        if (notice == null) return NotFound(new { message = "Notice record not found." });

        string? className = dto.ClassName;
        if (dto.ClassId.HasValue && string.IsNullOrWhiteSpace(className))
        {
            var cls = await _db.SchoolClasses.FirstOrDefaultAsync(c => c.Id == dto.ClassId.Value);
            className = cls?.Name;
        }

        notice.Title = dto.Title.Trim();
        notice.Content = dto.Content.Trim();
        notice.Category = !string.IsNullOrWhiteSpace(dto.Category) ? dto.Category : notice.Category;
        notice.TargetAudience = !string.IsNullOrWhiteSpace(dto.TargetAudience) ? dto.TargetAudience : notice.TargetAudience;
        notice.ClassId = dto.ClassId;
        notice.ClassName = className;
        notice.Priority = !string.IsNullOrWhiteSpace(dto.Priority) ? dto.Priority : notice.Priority;
        var effectivePubDate = dto.PublishDate != default ? dto.PublishDate : notice.PublishDate;
        if (dto.ExpiryDate.HasValue && dto.ExpiryDate.Value.Date < effectivePubDate.Date)
            return BadRequest(new { message = "Expiry date cannot be earlier than publish date." });

        if (dto.PublishDate != default) notice.PublishDate = dto.PublishDate;
        notice.ExpiryDate = dto.ExpiryDate;
        notice.AttachmentUrl = dto.AttachmentUrl?.Trim();
        notice.IsPinned = dto.IsPinned;
        notice.IsActive = dto.IsActive;
        notice.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Notice updated successfully." });
    }

    [HttpPut("{id}/pin")]
    public async Task<IActionResult> TogglePin(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var notice = await _db.SchoolNotices.FirstOrDefaultAsync(n => n.Id == id && n.TenantId == tenantId);
        if (notice == null) return NotFound(new { message = "Notice record not found." });

        notice.IsPinned = !notice.IsPinned;
        notice.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();
        return Ok(new { message = notice.IsPinned ? "Notice pinned to top." : "Notice unpinned.", isPinned = notice.IsPinned });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteNotice(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var notice = await _db.SchoolNotices.FirstOrDefaultAsync(n => n.Id == id && n.TenantId == tenantId);
        if (notice == null) return NotFound(new { message = "Notice record not found." });

        _db.SchoolNotices.Remove(notice);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Notice deleted successfully." });
    }
}
