using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/grievances")]
[Authorize]
public class GrievancesController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public GrievancesController(IIMSERPDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet("stats")]
    public async Task<ActionResult<GrievanceStatsDto>> GetStats([FromQuery] Guid? branchId)
    {
        var tenantId = _currentUser.TenantId;
        var activeBranch = branchId ?? _currentUser.BranchId;

        var query = _db.GrievanceTickets.AsNoTracking().Where(g => g.TenantId == tenantId);
        if (activeBranch.HasValue)
        {
            query = query.Where(g => g.BranchId == activeBranch.Value);
        }

        var total = await query.CountAsync();
        var open = await query.CountAsync(g => g.Status == "Open" || g.Status == "Under Review");
        var inProgress = await query.CountAsync(g => g.Status == "In Progress");
        var resolved = await query.CountAsync(g => g.Status == "Resolved" || g.Status == "Closed");
        var urgent = await query.CountAsync(g => g.Priority == "Urgent" && g.Status != "Resolved" && g.Status != "Closed");

        decimal resolutionRate = total > 0
            ? Math.Round(((decimal)resolved / total) * 100m, 1)
            : 0;

        return Ok(new GrievanceStatsDto(
            total,
            open,
            inProgress,
            resolved,
            urgent,
            resolutionRate
        ));
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<GrievanceTicketDto>>> GetTickets(
        [FromQuery] Guid? branchId,
        [FromQuery] string? status,
        [FromQuery] string? category,
        [FromQuery] string? priority,
        [FromQuery] string? divisionScope,
        [FromQuery] Guid? studentId,
        [FromQuery] string? searchTerm)
    {
        var tenantId = _currentUser.TenantId;
        var activeBranch = branchId ?? _currentUser.BranchId;

        var query = _db.GrievanceTickets
            .AsNoTracking()
            .Include(g => g.Comments)
            .Where(g => g.TenantId == tenantId);

        if (activeBranch.HasValue)
        {
            query = query.Where(g => g.BranchId == activeBranch.Value);
        }

        if (studentId.HasValue)
        {
            query = query.Where(g => g.StudentId == studentId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
        {
            query = query.Where(g => g.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(category) && category != "All")
        {
            query = query.Where(g => g.Category == category);
        }

        if (!string.IsNullOrWhiteSpace(priority) && priority != "All")
        {
            query = query.Where(g => g.Priority == priority);
        }

        if (!string.IsNullOrWhiteSpace(divisionScope) && divisionScope != "All")
        {
            query = query.Where(g => g.DivisionScope == divisionScope);
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(g =>
                g.TicketNumber.ToLower().Contains(term) ||
                g.Subject.ToLower().Contains(term) ||
                g.RaisedByName.ToLower().Contains(term) ||
                (g.StudentName != null && g.StudentName.ToLower().Contains(term)) ||
                (g.AdmissionNumber != null && g.AdmissionNumber.ToLower().Contains(term)) ||
                g.ContactPhone.Contains(term));
        }

        var list = await query
            .OrderByDescending(g => g.CreatedAt)
            .Select(g => new GrievanceTicketDto(
                g.Id,
                g.TenantId,
                g.BranchId,
                g.TicketNumber,
                g.DivisionScope,
                g.StudentId,
                g.StudentName,
                g.AdmissionNumber,
                g.ClassName,
                g.RaisedByName,
                g.RaisedByRole,
                g.ContactPhone,
                g.ContactEmail,
                g.Category,
                g.Priority,
                g.Subject,
                g.Description,
                g.Status,
                g.AssignedToUserId,
                g.AssignedToName,
                g.ResolutionSummary,
                g.ResolvedAt,
                g.ResolvedByName,
                g.CreatedAt,
                g.Comments.Count
            ))
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetTicketDetails(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var g = await _db.GrievanceTickets
            .AsNoTracking()
            .Include(x => x.Comments)
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);

        if (g == null) return NotFound(new { message = "Grievance ticket not found." });

        var ticketDto = new GrievanceTicketDto(
            g.Id,
            g.TenantId,
            g.BranchId,
            g.TicketNumber,
            g.DivisionScope,
            g.StudentId,
            g.StudentName,
            g.AdmissionNumber,
            g.ClassName,
            g.RaisedByName,
            g.RaisedByRole,
            g.ContactPhone,
            g.ContactEmail,
            g.Category,
            g.Priority,
            g.Subject,
            g.Description,
            g.Status,
            g.AssignedToUserId,
            g.AssignedToName,
            g.ResolutionSummary,
            g.ResolvedAt,
            g.ResolvedByName,
            g.CreatedAt,
            g.Comments.Count
        );

        var commentsDto = g.Comments
            .OrderBy(c => c.CreatedAt)
            .Select(c => new GrievanceCommentDto(
                c.Id,
                c.TicketId,
                c.BranchId,
                c.AuthorName,
                c.AuthorRole,
                c.Comment,
                c.IsInternal,
                c.CreatedAt
            ))
            .ToList();

        return Ok(new { ticket = ticketDto, comments = commentsDto });
    }

    [HttpPost]
    public async Task<ActionResult<GrievanceTicketDto>> CreateTicket([FromBody] CreateGrievanceTicketDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var branchId = _currentUser.BranchId;

        // Auto-generate ticket number e.g. GRV-2026-0001
        var year = DateTime.UtcNow.Year;
        var countThisYear = await _db.GrievanceTickets
            .CountAsync(g => g.TenantId == tenantId && g.TicketNumber.StartsWith($"GRV-{year}-"));
        var ticketNumber = $"GRV-{year}-{(countThisYear + 1):D4}";

        string? studentName = null;
        string? admissionNumber = null;
        string? className = null;
        string divisionScope = !string.IsNullOrWhiteSpace(dto.DivisionScope) ? dto.DivisionScope.Trim() : "All";

        if (dto.StudentId.HasValue)
        {
            var student = await _db.Students
                .Include(s => s.Class)
                .Include(s => s.Section)
                .Include(s => s.Batch)
                .FirstOrDefaultAsync(s => s.Id == dto.StudentId.Value && s.TenantId == tenantId);
            if (student != null)
            {
                studentName = student.StudentName;
                admissionNumber = student.AdmissionNumber ?? student.RollNumber;
                className = student.Class?.Name != null
                    ? (student.Section?.Name != null ? $"{student.Class.Name} - {student.Section.Name}" : student.Class.Name)
                    : (student.Batch?.Name ?? "Class / Batch");
                branchId ??= student.BranchId;

                if (student.ClassId != null && student.BatchId != null)
                    divisionScope = "Dual";
                else if (student.BatchId != null)
                    divisionScope = "Coaching";
                else if (student.ClassId != null)
                    divisionScope = "School";
            }
        }

        var ticket = new GrievanceTicket
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            TicketNumber = ticketNumber,
            DivisionScope = divisionScope,
            StudentId = dto.StudentId,
            StudentName = studentName,
            AdmissionNumber = admissionNumber,
            ClassName = className,
            RaisedByName = dto.RaisedByName.Trim(),
            RaisedByRole = string.IsNullOrWhiteSpace(dto.RaisedByRole) ? "Parent" : dto.RaisedByRole.Trim(),
            ContactPhone = dto.ContactPhone.Trim(),
            ContactEmail = dto.ContactEmail?.Trim(),
            Category = string.IsNullOrWhiteSpace(dto.Category) ? "Academic" : dto.Category.Trim(),
            Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "Medium" : dto.Priority.Trim(),
            Subject = dto.Subject.Trim(),
            Description = dto.Description.Trim(),
            Status = "Open",
            AssignedToUserId = dto.AssignedToUserId,
            AssignedToName = dto.AssignedToName?.Trim(),
            ResolutionSummary = null,
            ResolvedAt = null,
            ResolvedByName = null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // Add initial system comment
        ticket.Comments.Add(new GrievanceComment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            TicketId = ticket.Id,
            AuthorName = "System",
            AuthorRole = "Helpdesk",
            Comment = $"Ticket {ticketNumber} created by {ticket.RaisedByName} ({ticket.RaisedByRole}) under category '{ticket.Category}' with Priority '{ticket.Priority}'.",
            IsInternal = false,
            CreatedAt = DateTime.UtcNow
        });

        _db.GrievanceTickets.Add(ticket);
        await _db.SaveChangesAsync();

        var resultDto = new GrievanceTicketDto(
            ticket.Id,
            ticket.TenantId,
            ticket.BranchId,
            ticket.TicketNumber,
            ticket.DivisionScope,
            ticket.StudentId,
            ticket.StudentName,
            ticket.AdmissionNumber,
            ticket.ClassName,
            ticket.RaisedByName,
            ticket.RaisedByRole,
            ticket.ContactPhone,
            ticket.ContactEmail,
            ticket.Category,
            ticket.Priority,
            ticket.Subject,
            ticket.Description,
            ticket.Status,
            ticket.AssignedToUserId,
            ticket.AssignedToName,
            ticket.ResolutionSummary,
            ticket.ResolvedAt,
            ticket.ResolvedByName,
            ticket.CreatedAt,
            1
        );

        return CreatedAtAction(nameof(GetTicketDetails), new { id = ticket.Id }, resultDto);
    }

    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateGrievanceStatusDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var ticket = await _db.GrievanceTickets.FirstOrDefaultAsync(g => g.Id == id && g.TenantId == tenantId);
        if (ticket == null) return NotFound(new { message = "Grievance ticket not found." });

        var previousStatus = ticket.Status;
        ticket.Status = dto.Status.Trim();
        ticket.AssignedToUserId = dto.AssignedToUserId ?? ticket.AssignedToUserId;
        ticket.AssignedToName = dto.AssignedToName?.Trim() ?? ticket.AssignedToName;

        if (ticket.Status == "Resolved" || ticket.Status == "Closed")
        {
            ticket.ResolvedAt = DateTime.UtcNow;
            ticket.ResolvedByName = string.IsNullOrWhiteSpace(dto.ResolvedByName) ? "Grievance Redressal Officer" : dto.ResolvedByName.Trim();
            ticket.ResolutionSummary = dto.ResolutionSummary?.Trim();
        }
        else if (ticket.Status == "Open" || ticket.Status == "In Progress")
        {
            ticket.ResolvedAt = null;
        }

        ticket.UpdatedAt = DateTime.UtcNow;

        // Auto-log status change to comments
        _db.GrievanceComments.Add(new GrievanceComment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = ticket.BranchId,
            TicketId = ticket.Id,
            AuthorName = dto.ResolvedByName ?? "Staff / Redressal Desk",
            AuthorRole = "Admin",
            Comment = $"Status updated from '{previousStatus}' to '{ticket.Status}'. " +
                      (!string.IsNullOrWhiteSpace(dto.ResolutionSummary) ? $"Resolution Notes: {dto.ResolutionSummary}" : string.Empty),
            IsInternal = false,
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
        return Ok(new { message = $"Ticket status updated to '{ticket.Status}' successfully." });
    }

    [HttpPost("{id}/comments")]
    public async Task<ActionResult<GrievanceCommentDto>> AddComment(Guid id, [FromBody] AddGrievanceCommentDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var ticket = await _db.GrievanceTickets.FirstOrDefaultAsync(g => g.Id == id && g.TenantId == tenantId);
        if (ticket == null) return NotFound(new { message = "Grievance ticket not found." });

        var comment = new GrievanceComment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = ticket.BranchId ?? _currentUser.BranchId,
            TicketId = ticket.Id,
            AuthorName = string.IsNullOrWhiteSpace(dto.AuthorName) ? "Staff Member" : dto.AuthorName.Trim(),
            AuthorRole = string.IsNullOrWhiteSpace(dto.AuthorRole) ? "Staff" : dto.AuthorRole.Trim(),
            Comment = dto.Comment.Trim(),
            IsInternal = dto.IsInternal,
            CreatedAt = DateTime.UtcNow
        };

        ticket.UpdatedAt = DateTime.UtcNow;
        _db.GrievanceComments.Add(comment);
        await _db.SaveChangesAsync();

        var resultDto = new GrievanceCommentDto(
            comment.Id,
            comment.TicketId,
            comment.BranchId,
            comment.AuthorName,
            comment.AuthorRole,
            comment.Comment,
            comment.IsInternal,
            comment.CreatedAt
        );

        return Ok(resultDto);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTicket(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var ticket = await _db.GrievanceTickets
            .Include(g => g.Comments)
            .FirstOrDefaultAsync(g => g.Id == id && g.TenantId == tenantId);

        if (ticket == null) return NotFound(new { message = "Grievance ticket not found." });

        _db.GrievanceComments.RemoveRange(ticket.Comments);
        _db.GrievanceTickets.Remove(ticket);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Grievance ticket deleted successfully." });
    }
}
