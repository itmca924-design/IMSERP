using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/ptm")]
[Authorize]
public class PtmController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public PtmController(IIMSERPDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet("stats")]
    public async Task<ActionResult<PtmStatsDto>> GetStats([FromQuery] Guid? branchId)
    {
        var tenantId = _currentUser.TenantId;
        var activeBranch = branchId ?? _currentUser.BranchId;

        var sessionQuery = _db.PtmSessions.AsNoTracking().Where(s => s.TenantId == tenantId);
        var bookingQuery = _db.PtmBookings.AsNoTracking().Where(b => b.TenantId == tenantId);

        if (activeBranch.HasValue)
        {
            sessionQuery = sessionQuery.Where(s => s.BranchId == activeBranch.Value);
            bookingQuery = bookingQuery.Where(b => b.BranchId == activeBranch.Value);
        }

        var totalSessions = await sessionQuery.CountAsync();
        var today = DateTime.UtcNow.Date;
        var upcomingSessions = await sessionQuery.CountAsync(s => s.MeetingDate >= today && s.Status != "Cancelled");
        var totalBookings = await bookingQuery.CountAsync();
        var totalAttended = await bookingQuery.CountAsync(b => b.ParentAttended == "Attended" || b.ParentAttended == "Both" || b.ParentAttended == "Father" || b.ParentAttended == "Mother" || b.ParentAttended == "Guardian");
        var pendingFollowUps = await bookingQuery.CountAsync(b => b.FollowUpRequired);

        decimal attendanceRate = totalBookings > 0
            ? Math.Round(((decimal)totalAttended / totalBookings) * 100m, 1)
            : 0;

        return Ok(new PtmStatsDto(
            totalSessions,
            upcomingSessions,
            totalBookings,
            totalAttended,
            attendanceRate,
            pendingFollowUps
        ));
    }

    [HttpGet("sessions")]
    public async Task<ActionResult<IEnumerable<PtmSessionDto>>> GetSessions(
        [FromQuery] Guid? branchId,
        [FromQuery] string? status,
        [FromQuery] string? academicYear,
        [FromQuery] string? divisionScope,
        [FromQuery] string? searchTerm)
    {
        var tenantId = _currentUser.TenantId;
        var activeBranch = branchId ?? _currentUser.BranchId;

        var query = _db.PtmSessions
            .AsNoTracking()
            .Include(s => s.Bookings)
            .Where(s => s.TenantId == tenantId);

        if (activeBranch.HasValue)
        {
            query = query.Where(s => s.BranchId == activeBranch.Value);
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
        {
            query = query.Where(s => s.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(academicYear) && academicYear != "All")
        {
            query = query.Where(s => s.AcademicYear == academicYear);
        }

        if (!string.IsNullOrWhiteSpace(divisionScope) && divisionScope != "All")
        {
            query = query.Where(s => s.DivisionScope == divisionScope);
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(s =>
                s.Title.ToLower().Contains(term) ||
                (s.TargetClassName != null && s.TargetClassName.ToLower().Contains(term)) ||
                (s.TargetBatchName != null && s.TargetBatchName.ToLower().Contains(term)) ||
                s.OrganizerName.ToLower().Contains(term));
        }

        var list = await query
            .OrderByDescending(s => s.MeetingDate)
            .ThenByDescending(s => s.CreatedAt)
            .Select(s => new PtmSessionDto(
                s.Id,
                s.TenantId,
                s.BranchId,
                s.Title,
                s.AcademicYear,
                s.MeetingDate,
                s.StartTime,
                s.EndTime,
                s.MeetingMode,
                s.VenueOrLink,
                s.DivisionScope,
                s.TargetClassId,
                s.TargetClassName,
                s.TargetSection,
                s.TargetBatchId,
                s.TargetBatchName,
                s.OrganizerName,
                s.Agenda,
                s.Status,
                s.CreatedAt,
                s.Bookings.Count,
                s.Bookings.Count(b => b.ParentAttended == "Attended" || b.ParentAttended == "Both" || b.ParentAttended == "Father" || b.ParentAttended == "Mother" || b.ParentAttended == "Guardian")
            ))
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("sessions/{id}")]
    public async Task<ActionResult<object>> GetSessionDetails(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var s = await _db.PtmSessions
            .AsNoTracking()
            .Include(x => x.Bookings)
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);

        if (s == null) return NotFound(new { message = "PTM Session not found." });

        var sessionDto = new PtmSessionDto(
            s.Id,
            s.TenantId,
            s.BranchId,
            s.Title,
            s.AcademicYear,
            s.MeetingDate,
            s.StartTime,
            s.EndTime,
            s.MeetingMode,
            s.VenueOrLink,
            s.DivisionScope,
            s.TargetClassId,
            s.TargetClassName,
            s.TargetSection,
            s.TargetBatchId,
            s.TargetBatchName,
            s.OrganizerName,
            s.Agenda,
            s.Status,
            s.CreatedAt,
            s.Bookings.Count,
            s.Bookings.Count(b => b.ParentAttended == "Attended" || b.ParentAttended == "Both" || b.ParentAttended == "Father" || b.ParentAttended == "Mother" || b.ParentAttended == "Guardian")
        );

        var bookingsDto = s.Bookings
            .OrderBy(b => b.StudentName)
            .Select(b => new PtmBookingDto(
                b.Id,
                b.TenantId,
                b.BranchId,
                b.PtmSessionId,
                s.Title,
                s.MeetingDate,
                b.StudentId,
                b.StudentName,
                b.AdmissionNumber,
                b.ClassName,
                b.ParentName,
                b.ParentPhone,
                b.SlotTime,
                b.ParentAttended,
                b.TeacherName,
                b.TeacherFeedback,
                b.ParentFeedback,
                b.ActionPoints,
                b.FollowUpRequired,
                b.FollowUpDate,
                b.AttendedAt,
                b.CreatedAt
            )).ToList();

        return Ok(new { session = sessionDto, bookings = bookingsDto });
    }

    [HttpPost("sessions")]
    public async Task<ActionResult<PtmSessionDto>> CreateSession([FromBody] CreatePtmSessionDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var branchId = _currentUser.BranchId;

        var session = new PtmSession
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            Title = dto.Title.Trim(),
            AcademicYear = dto.AcademicYear?.Trim(),
            MeetingDate = dto.MeetingDate,
            StartTime = string.IsNullOrWhiteSpace(dto.StartTime) ? "09:00 AM" : dto.StartTime.Trim(),
            EndTime = string.IsNullOrWhiteSpace(dto.EndTime) ? "01:30 PM" : dto.EndTime.Trim(),
            MeetingMode = string.IsNullOrWhiteSpace(dto.MeetingMode) ? "In-Person" : dto.MeetingMode.Trim(),
            VenueOrLink = dto.VenueOrLink?.Trim(),
            DivisionScope = string.IsNullOrWhiteSpace(dto.DivisionScope) ? "All" : dto.DivisionScope.Trim(),
            TargetClassId = dto.TargetClassId,
            TargetClassName = dto.TargetClassName?.Trim(),
            TargetSection = dto.TargetSection?.Trim(),
            TargetBatchId = dto.TargetBatchId,
            TargetBatchName = dto.TargetBatchName?.Trim(),
            OrganizerName = string.IsNullOrWhiteSpace(dto.OrganizerName) ? "School Administration" : dto.OrganizerName.Trim(),
            Agenda = dto.Agenda?.Trim(),
            Status = string.IsNullOrWhiteSpace(dto.Status) ? "Scheduled" : dto.Status.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.PtmSessions.Add(session);
        await _db.SaveChangesAsync();

        var resultDto = new PtmSessionDto(
            session.Id,
            session.TenantId,
            session.BranchId,
            session.Title,
            session.AcademicYear,
            session.MeetingDate,
            session.StartTime,
            session.EndTime,
            session.MeetingMode,
            session.VenueOrLink,
            session.DivisionScope,
            session.TargetClassId,
            session.TargetClassName,
            session.TargetSection,
            session.TargetBatchId,
            session.TargetBatchName,
            session.OrganizerName,
            session.Agenda,
            session.Status,
            session.CreatedAt,
            0,
            0
        );

        return CreatedAtAction(nameof(GetSessionDetails), new { id = session.Id }, resultDto);
    }

    [HttpPut("sessions/{id}")]
    public async Task<IActionResult> UpdateSession(Guid id, [FromBody] UpdatePtmSessionDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var session = await _db.PtmSessions.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId);
        if (session == null) return NotFound(new { message = "PTM Session not found." });

        session.Title = dto.Title.Trim();
        session.AcademicYear = dto.AcademicYear?.Trim();
        session.MeetingDate = dto.MeetingDate;
        session.StartTime = dto.StartTime.Trim();
        session.EndTime = dto.EndTime.Trim();
        session.MeetingMode = dto.MeetingMode.Trim();
        session.VenueOrLink = dto.VenueOrLink?.Trim();
        session.DivisionScope = string.IsNullOrWhiteSpace(dto.DivisionScope) ? "All" : dto.DivisionScope.Trim();
        session.TargetClassId = dto.TargetClassId;
        session.TargetClassName = dto.TargetClassName?.Trim();
        session.TargetSection = dto.TargetSection?.Trim();
        session.TargetBatchId = dto.TargetBatchId;
        session.TargetBatchName = dto.TargetBatchName?.Trim();
        session.OrganizerName = dto.OrganizerName.Trim();
        session.Agenda = dto.Agenda?.Trim();
        session.Status = dto.Status.Trim();
        session.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { message = "PTM Session updated successfully." });
    }

    [HttpDelete("sessions/{id}")]
    public async Task<IActionResult> DeleteSession(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var session = await _db.PtmSessions
            .Include(s => s.Bookings)
            .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId);

        if (session == null) return NotFound(new { message = "PTM Session not found." });

        _db.PtmBookings.RemoveRange(session.Bookings);
        _db.PtmSessions.Remove(session);
        await _db.SaveChangesAsync();

        return Ok(new { message = "PTM Session deleted successfully." });
    }

    [HttpGet("bookings")]
    public async Task<ActionResult<IEnumerable<PtmBookingDto>>> GetBookings(
        [FromQuery] Guid? sessionId,
        [FromQuery] Guid? studentId,
        [FromQuery] string? status,
        [FromQuery] Guid? branchId,
        [FromQuery] string? searchTerm)
    {
        var tenantId = _currentUser.TenantId;
        var activeBranch = branchId ?? _currentUser.BranchId;

        var query = _db.PtmBookings
            .AsNoTracking()
            .Include(b => b.PtmSession)
            .Where(b => b.TenantId == tenantId);

        if (activeBranch.HasValue)
        {
            query = query.Where(b => b.BranchId == activeBranch.Value);
        }

        if (sessionId.HasValue)
        {
            query = query.Where(b => b.PtmSessionId == sessionId.Value);
        }

        if (studentId.HasValue)
        {
            query = query.Where(b => b.StudentId == studentId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
        {
            query = query.Where(b => b.ParentAttended == status);
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(b =>
                b.StudentName.ToLower().Contains(term) ||
                (b.AdmissionNumber != null && b.AdmissionNumber.ToLower().Contains(term)) ||
                (b.ParentName != null && b.ParentName.ToLower().Contains(term)) ||
                (b.ParentPhone != null && b.ParentPhone.Contains(term)) ||
                (b.TeacherName != null && b.TeacherName.ToLower().Contains(term)));
        }

        var list = await query
            .OrderBy(b => b.SlotTime)
            .ThenBy(b => b.StudentName)
            .Select(b => new PtmBookingDto(
                b.Id,
                b.TenantId,
                b.BranchId,
                b.PtmSessionId,
                b.PtmSession != null ? b.PtmSession.Title : "PTM Session",
                b.PtmSession != null ? b.PtmSession.MeetingDate : b.CreatedAt,
                b.StudentId,
                b.StudentName,
                b.AdmissionNumber,
                b.ClassName,
                b.ParentName,
                b.ParentPhone,
                b.SlotTime,
                b.ParentAttended,
                b.TeacherName,
                b.TeacherFeedback,
                b.ParentFeedback,
                b.ActionPoints,
                b.FollowUpRequired,
                b.FollowUpDate,
                b.AttendedAt,
                b.CreatedAt
            ))
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost("bookings")]
    public async Task<ActionResult<PtmBookingDto>> CreateBooking([FromBody] CreatePtmBookingDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var session = await _db.PtmSessions.FirstOrDefaultAsync(s => s.Id == dto.PtmSessionId && s.TenantId == tenantId);
        if (session == null) return NotFound(new { message = "PTM Session not found." });

        var student = await _db.Students
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .FirstOrDefaultAsync(s => s.Id == dto.StudentId && s.TenantId == tenantId);
        if (student == null) return NotFound(new { message = "Student not found." });

        // Check if student already enrolled in this session
        var existingBooking = await _db.PtmBookings.FirstOrDefaultAsync(b => b.PtmSessionId == dto.PtmSessionId && b.StudentId == dto.StudentId && b.TenantId == tenantId);
        if (existingBooking != null)
        {
            return BadRequest(new { message = "Student is already scheduled for this PTM session." });
        }

        string className = student.Class?.Name != null
            ? (student.Section?.Name != null ? $"{student.Class.Name} - {student.Section.Name}" : student.Class.Name)
            : (student.Batch?.Name ?? "Class / Batch");

        var booking = new PtmBooking
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = student.BranchId ?? session.BranchId,
            PtmSessionId = session.Id,
            StudentId = student.Id,
            StudentName = student.StudentName,
            AdmissionNumber = student.AdmissionNumber ?? student.RollNumber,
            ClassName = className,
            ParentName = !string.IsNullOrWhiteSpace(student.ParentName) ? student.ParentName : "Parent",
            ParentPhone = !string.IsNullOrWhiteSpace(student.ParentWhatsAppPhone) ? student.ParentWhatsAppPhone : student.EmergencyContactPhone,
            SlotTime = dto.SlotTime?.Trim(),
            ParentAttended = string.IsNullOrWhiteSpace(dto.ParentAttended) ? "Pending" : dto.ParentAttended.Trim(),
            TeacherName = string.IsNullOrWhiteSpace(dto.TeacherName) ? session.OrganizerName : dto.TeacherName.Trim(),
            TeacherFeedback = dto.TeacherFeedback?.Trim(),
            ParentFeedback = dto.ParentFeedback?.Trim(),
            ActionPoints = dto.ActionPoints?.Trim(),
            FollowUpRequired = dto.FollowUpRequired,
            FollowUpDate = dto.FollowUpDate,
            AttendedAt = (dto.ParentAttended != "Pending" && dto.ParentAttended != "Absent" && dto.ParentAttended != "Cancelled") ? DateTime.UtcNow : null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.PtmBookings.Add(booking);
        await _db.SaveChangesAsync();

        var resultDto = new PtmBookingDto(
            booking.Id,
            booking.TenantId,
            booking.BranchId,
            booking.PtmSessionId,
            session.Title,
            session.MeetingDate,
            booking.StudentId,
            booking.StudentName,
            booking.AdmissionNumber,
            booking.ClassName,
            booking.ParentName,
            booking.ParentPhone,
            booking.SlotTime,
            booking.ParentAttended,
            booking.TeacherName,
            booking.TeacherFeedback,
            booking.ParentFeedback,
            booking.ActionPoints,
            booking.FollowUpRequired,
            booking.FollowUpDate,
            booking.AttendedAt,
            booking.CreatedAt
        );

        return Ok(resultDto);
    }

    [HttpPost("sessions/{id}/bulk-enroll")]
    public async Task<IActionResult> BulkEnrollStudents(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var session = await _db.PtmSessions.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId);
        if (session == null) return NotFound(new { message = "PTM Session not found." });

        var studentsQuery = _db.Students
            .AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .Where(s => s.TenantId == tenantId && s.IsActive);

        if (session.BranchId.HasValue)
        {
            studentsQuery = studentsQuery.Where(s => s.BranchId == session.BranchId.Value);
        }

        if (session.TargetBatchId.HasValue)
        {
            studentsQuery = studentsQuery.Where(s => s.BatchId == session.TargetBatchId.Value);
        }
        else if (session.TargetClassId.HasValue)
        {
            studentsQuery = studentsQuery.Where(s => s.ClassId == session.TargetClassId.Value);
        }
        else if (!string.IsNullOrWhiteSpace(session.TargetClassName))
        {
            studentsQuery = studentsQuery.Where(s => s.Class != null && s.Class.Name == session.TargetClassName);
        }
        else if (session.DivisionScope == "Coaching")
        {
            studentsQuery = studentsQuery.Where(s => s.BatchId != null);
        }
        else if (session.DivisionScope == "School")
        {
            studentsQuery = studentsQuery.Where(s => s.ClassId != null);
        }

        var candidateStudents = await studentsQuery.ToListAsync();
        var existingStudentIds = await _db.PtmBookings
            .AsNoTracking()
            .Where(b => b.PtmSessionId == id && b.TenantId == tenantId)
            .Select(b => b.StudentId)
            .ToHashSetAsync();

        var newBookings = new List<PtmBooking>();
        foreach (var st in candidateStudents)
        {
            if (existingStudentIds.Contains(st.Id)) continue;

            string className = st.Class?.Name != null
                ? (st.Section?.Name != null ? $"{st.Class.Name} - {st.Section.Name}" : st.Class.Name)
                : (st.Batch?.Name ?? "Class / Batch");

            newBookings.Add(new PtmBooking
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BranchId = st.BranchId ?? session.BranchId,
                PtmSessionId = session.Id,
                StudentId = st.Id,
                StudentName = st.StudentName,
                AdmissionNumber = st.AdmissionNumber ?? st.RollNumber,
                ClassName = className,
                ParentName = !string.IsNullOrWhiteSpace(st.ParentName) ? st.ParentName : "Parent",
                ParentPhone = !string.IsNullOrWhiteSpace(st.ParentWhatsAppPhone) ? st.ParentWhatsAppPhone : st.EmergencyContactPhone,
                SlotTime = null,
                ParentAttended = "Pending",
                TeacherName = session.OrganizerName,
                TeacherFeedback = null,
                ParentFeedback = null,
                ActionPoints = null,
                FollowUpRequired = false,
                FollowUpDate = null,
                AttendedAt = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        if (newBookings.Any())
        {
            _db.PtmBookings.AddRange(newBookings);
            await _db.SaveChangesAsync();
        }

        return Ok(new { message = $"Successfully enrolled {newBookings.Count} students for '{session.Title}'." });
    }

    [HttpPut("bookings/{id}")]
    public async Task<IActionResult> UpdateBooking(Guid id, [FromBody] UpdatePtmBookingDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var booking = await _db.PtmBookings
            .Include(b => b.PtmSession)
            .FirstOrDefaultAsync(b => b.Id == id && b.TenantId == tenantId);

        if (booking == null) return NotFound(new { message = "PTM Booking not found." });

        booking.SlotTime = dto.SlotTime?.Trim();
        booking.TeacherName = dto.TeacherName?.Trim();
        booking.ParentAttended = dto.ParentAttended.Trim();
        booking.TeacherFeedback = dto.TeacherFeedback?.Trim();
        booking.ParentFeedback = dto.ParentFeedback?.Trim();
        booking.ActionPoints = dto.ActionPoints?.Trim();
        booking.FollowUpRequired = dto.FollowUpRequired;
        booking.FollowUpDate = dto.FollowUpDate;
        booking.UpdatedAt = DateTime.UtcNow;

        bool isAttended = booking.ParentAttended == "Attended" ||
                          booking.ParentAttended == "Both" ||
                          booking.ParentAttended == "Father" ||
                          booking.ParentAttended == "Mother" ||
                          booking.ParentAttended == "Guardian";

        if (isAttended && booking.AttendedAt == null)
        {
            booking.AttendedAt = DateTime.UtcNow;
        }
        else if (!isAttended)
        {
            booking.AttendedAt = null;
        }

        // Automatic synchronization to Student 360 PTM Records
        if (isAttended && !string.IsNullOrWhiteSpace(booking.TeacherFeedback))
        {
            var ptmMeetingDate = booking.PtmSession != null ? booking.PtmSession.MeetingDate : DateTime.UtcNow;
            var existingPtmRecord = await _db.StudentPtmRecords
                .FirstOrDefaultAsync(p => p.StudentId == booking.StudentId && p.TenantId == tenantId && p.PtmDate.Date == ptmMeetingDate.Date);

            if (existingPtmRecord != null)
            {
                existingPtmRecord.TeacherName = booking.TeacherName ?? "Teacher";
                existingPtmRecord.TeacherRemarks = booking.TeacherFeedback ?? string.Empty;
                existingPtmRecord.ParentFeedback = booking.ParentFeedback;
                existingPtmRecord.AreasOfImprovement = booking.ActionPoints;
                existingPtmRecord.ParentAttended = booking.ParentAttended;
                existingPtmRecord.FollowUpRequired = booking.FollowUpRequired;
            }
            else
            {
                _db.StudentPtmRecords.Add(new StudentPtmRecord
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = booking.BranchId,
                    StudentId = booking.StudentId,
                    PtmDate = ptmMeetingDate,
                    TeacherName = booking.TeacherName ?? "Teacher",
                    TeacherRemarks = booking.TeacherFeedback ?? string.Empty,
                    ParentFeedback = booking.ParentFeedback,
                    AreasOfImprovement = booking.ActionPoints,
                    ParentAttended = booking.ParentAttended,
                    FollowUpRequired = booking.FollowUpRequired,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "PTM Booking updated and synchronized successfully." });
    }

    [HttpDelete("bookings/{id}")]
    public async Task<IActionResult> DeleteBooking(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var booking = await _db.PtmBookings.FirstOrDefaultAsync(b => b.Id == id && b.TenantId == tenantId);
        if (booking == null) return NotFound(new { message = "PTM Booking not found." });

        _db.PtmBookings.Remove(booking);
        await _db.SaveChangesAsync();

        return Ok(new { message = "PTM Booking removed successfully." });
    }
}
