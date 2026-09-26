using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;

namespace IMSERP.API.Controllers;

// ─── DTOs ────────────────────────────────────────────────────────

public class VisitorLogDto
{
    public Guid Id { get; set; }
    public string VisitorNumber { get; set; } = string.Empty;
    public string VisitorType { get; set; } = string.Empty;
    public string VisitorName { get; set; } = string.Empty;
    public string? Organization { get; set; }
    public string? ContactNumber { get; set; }
    public string? Email { get; set; }
    public string? IdProofType { get; set; }
    public string? IdProofNumber { get; set; }
    public string? PersonToMeet { get; set; }
    public string? DepartmentToVisit { get; set; }
    public Guid? StudentId { get; set; }
    public string? StudentName { get; set; }
    public string? StudentClass { get; set; }
    public string Purpose { get; set; } = string.Empty;
    public DateTime CheckInTime { get; set; }
    public DateTime? CheckOutTime { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? NumberOfVisitors { get; set; }
    public string? VehicleNumber { get; set; }
    public string? BadgeNumber { get; set; }
    public string? MaterialCarried { get; set; }
    public string? Remarks { get; set; }
    public string? ReceivedBy { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateVisitorLogRequest
{
    public string VisitorType { get; set; } = "Visitor";
    public string VisitorName { get; set; } = string.Empty;
    public string? Organization { get; set; }
    public string? ContactNumber { get; set; }
    public string? Email { get; set; }
    public string? IdProofType { get; set; }
    public string? IdProofNumber { get; set; }
    public string? PersonToMeet { get; set; }
    public string? DepartmentToVisit { get; set; }
    public Guid? StudentId { get; set; }
    public string? StudentName { get; set; }
    public string? StudentClass { get; set; }
    public string Purpose { get; set; } = string.Empty;
    public int? NumberOfVisitors { get; set; } = 1;
    public string? VehicleNumber { get; set; }
    public string? BadgeNumber { get; set; }
    public string? MaterialCarried { get; set; }
    public string? Remarks { get; set; }
    public string? ReceivedBy { get; set; }
}

public class StudentGatePassDto
{
    public Guid Id { get; set; }
    public string GatePassNumber { get; set; } = string.Empty;
    public Guid StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string? ClassName { get; set; }
    public string? SectionName { get; set; }
    public string? RollNumber { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string ReasonCategory { get; set; } = string.Empty;
    public DateTime OutDateTime { get; set; }
    public DateTime? ExpectedReturnTime { get; set; }
    public DateTime? ActualReturnTime { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ParentGuardianName { get; set; }
    public string? ParentContactNumber { get; set; }
    public string? ParentRelation { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? ApprovalRemarks { get; set; }
    public string? SecurityGuardName { get; set; }
    public string? Remarks { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateGatePassRequest
{
    public Guid StudentId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string ReasonCategory { get; set; } = "Early Pickup";
    public DateTime? ExpectedReturnTime { get; set; }
    public string? ParentGuardianName { get; set; }
    public string? ParentContactNumber { get; set; }
    public string? ParentRelation { get; set; }
    public string? SecurityGuardName { get; set; }
    public string? Remarks { get; set; }
}

public class ApproveGatePassRequest
{
    public string Action { get; set; } = "Approve"; // Approve | Reject
    public string? ApprovalRemarks { get; set; }
}

public class FrontDeskStatsDto
{
    public int TotalVisitorsToday { get; set; }
    public int ActiveVisitors { get; set; }
    public int CheckedOutToday { get; set; }
    public int GatePassesToday { get; set; }
    public int PendingGatePasses { get; set; }
    public int ApprovedGatePassesToday { get; set; }
}

// ─── Controllers ─────────────────────────────────────────────────

[ApiController]
[Route("api/front-desk")]
public class FrontDeskController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly ILogger<FrontDeskController> _logger;

    public FrontDeskController(
        IIMSERPDbContext db,
        ICurrentUserService currentUser,
        ILogger<FrontDeskController> logger)
    {
        _db = db;
        _currentUser = currentUser;
        _logger = logger;
    }

    // ─── Dashboard Stats ──────────────────────────────────────────
    [HttpGet("stats")]
    public async Task<ActionResult<FrontDeskStatsDto>> GetStats()
    {
        var tenantId = _currentUser.TenantId;
        var today = DateTime.Today;

        var visitors = _db.VisitorLogs.AsNoTracking().Where(v => v.TenantId == tenantId);
        var passes   = _db.StudentGatePasses.AsNoTracking().Where(g => g.TenantId == tenantId);

        var todayVisitors   = visitors.Where(v => v.CheckInTime.Date == today);
        var todayPasses     = passes.Where(g => g.OutDateTime.Date == today);

        return Ok(new FrontDeskStatsDto
        {
            TotalVisitorsToday      = await todayVisitors.CountAsync(),
            ActiveVisitors          = await todayVisitors.CountAsync(v => v.Status == "Active"),
            CheckedOutToday         = await todayVisitors.CountAsync(v => v.Status == "CheckedOut"),
            GatePassesToday         = await todayPasses.CountAsync(),
            PendingGatePasses       = await passes.CountAsync(g => g.Status == "Pending"),
            ApprovedGatePassesToday = await todayPasses.CountAsync(g => g.Status == "Approved")
        });
    }

    // ─── Visitor Book CRUD ────────────────────────────────────────

    [HttpGet("visitors")]
    public async Task<ActionResult<IEnumerable<VisitorLogDto>>> GetVisitors(
        [FromQuery] string? status,
        [FromQuery] string? visitorType,
        [FromQuery] string? search,
        [FromQuery] DateTime? date,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var tenantId = _currentUser.TenantId;
        var query = _db.VisitorLogs
            .AsNoTracking()
            .Where(v => v.TenantId == tenantId);

        if (!string.IsNullOrEmpty(status) && status != "All")
            query = query.Where(v => v.Status == status);

        if (!string.IsNullOrEmpty(visitorType) && visitorType != "All")
            query = query.Where(v => v.VisitorType == visitorType);

        if (date.HasValue)
            query = query.Where(v => v.CheckInTime.Date == date.Value.Date);
        else
            query = query.Where(v => v.CheckInTime.Date == DateTime.Today);

        if (!string.IsNullOrEmpty(search))
        {
            var s = search.ToLower();
            query = query.Where(v =>
                v.VisitorName.ToLower().Contains(s) ||
                (v.Organization != null && v.Organization.ToLower().Contains(s)) ||
                (v.ContactNumber != null && v.ContactNumber.Contains(s)) ||
                v.VisitorNumber.ToLower().Contains(s));
        }

        var items = await query
            .OrderByDescending(v => v.CheckInTime)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(v => new VisitorLogDto
            {
                Id               = v.Id,
                VisitorNumber    = v.VisitorNumber,
                VisitorType      = v.VisitorType,
                VisitorName      = v.VisitorName,
                Organization     = v.Organization,
                ContactNumber    = v.ContactNumber,
                Email            = v.Email,
                IdProofType      = v.IdProofType,
                IdProofNumber    = v.IdProofNumber,
                PersonToMeet     = v.PersonToMeet,
                DepartmentToVisit = v.DepartmentToVisit,
                StudentId        = v.StudentId,
                StudentName      = v.StudentName,
                StudentClass     = v.StudentClass,
                Purpose          = v.Purpose,
                CheckInTime      = v.CheckInTime,
                CheckOutTime     = v.CheckOutTime,
                Status           = v.Status,
                NumberOfVisitors = v.NumberOfVisitors,
                VehicleNumber    = v.VehicleNumber,
                BadgeNumber      = v.BadgeNumber,
                MaterialCarried  = v.MaterialCarried,
                Remarks          = v.Remarks,
                ReceivedBy       = v.ReceivedBy,
                CreatedAt        = v.CreatedAt
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("visitors/{id}")]
    public async Task<ActionResult<VisitorLogDto>> GetVisitor(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var v = await _db.VisitorLogs
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);

        if (v == null) return NotFound();
        return Ok(MapVisitorDto(v));
    }

    [HttpPost("visitors")]
    public async Task<ActionResult<VisitorLogDto>> CreateVisitor([FromBody] CreateVisitorLogRequest req)
    {
        var tenantId = _currentUser.TenantId;
        var year     = DateTime.Now.Year;

        // Auto-generate visitor number
        var count = await _db.VisitorLogs.CountAsync(v => v.TenantId == tenantId && v.CheckInTime.Year == year);
        var visitorNumber = $"VIS-{year}-{(count + 1):D4}";

        var visitor = new VisitorLog
        {
            Id               = Guid.NewGuid(),
            TenantId         = tenantId,
            BranchId         = _currentUser.BranchId,
            VisitorNumber    = visitorNumber,
            VisitorType      = req.VisitorType,
            VisitorName      = req.VisitorName.Trim(),
            Organization     = req.Organization?.Trim(),
            ContactNumber    = req.ContactNumber?.Trim(),
            Email            = req.Email?.Trim(),
            IdProofType      = req.IdProofType,
            IdProofNumber    = req.IdProofNumber?.Trim(),
            PersonToMeet     = req.PersonToMeet?.Trim(),
            DepartmentToVisit = req.DepartmentToVisit?.Trim(),
            StudentId        = req.StudentId,
            StudentName      = req.StudentName?.Trim(),
            StudentClass     = req.StudentClass?.Trim(),
            Purpose          = req.Purpose.Trim(),
            CheckInTime      = DateTime.Now,
            Status           = "Active",
            NumberOfVisitors = req.NumberOfVisitors ?? 1,
            VehicleNumber    = req.VehicleNumber?.Trim(),
            BadgeNumber      = req.BadgeNumber?.Trim(),
            MaterialCarried  = req.MaterialCarried?.Trim(),
            Remarks          = req.Remarks?.Trim(),
            ReceivedBy       = req.ReceivedBy?.Trim() ?? _currentUser.UserRole,
            CreatedAt        = DateTime.Now,
            UpdatedAt        = DateTime.Now
        };

        _db.VisitorLogs.Add(visitor);
        await _db.SaveChangesAsync();

        _logger.LogInformation("[FrontDesk] Visitor checked in: {VisitorNumber} - {Name}", visitorNumber, visitor.VisitorName);
        return CreatedAtAction(nameof(GetVisitor), new { id = visitor.Id }, MapVisitorDto(visitor));
    }

    [HttpPut("visitors/{id}/checkout")]
    public async Task<IActionResult> CheckOutVisitor(Guid id, [FromBody] string? remarks)
    {
        var tenantId = _currentUser.TenantId;
        var visitor = await _db.VisitorLogs.FirstOrDefaultAsync(v => v.Id == id && v.TenantId == tenantId);
        if (visitor == null) return NotFound();
        if (visitor.Status == "CheckedOut") return BadRequest(new { message = "Visitor already checked out." });

        visitor.CheckOutTime = DateTime.Now;
        visitor.Status       = "CheckedOut";
        if (!string.IsNullOrEmpty(remarks)) visitor.Remarks = remarks;
        visitor.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();
        _logger.LogInformation("[FrontDesk] Visitor checked out: {VisitorNumber}", visitor.VisitorNumber);
        return Ok(new { message = "Visitor checked out successfully.", checkOutTime = visitor.CheckOutTime });
    }

    [HttpDelete("visitors/{id}")]
    public async Task<IActionResult> DeleteVisitor(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var visitor = await _db.VisitorLogs.FirstOrDefaultAsync(v => v.Id == id && v.TenantId == tenantId);
        if (visitor == null) return NotFound();

        _db.VisitorLogs.Remove(visitor);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ─── Student Gate Pass CRUD ───────────────────────────────────

    [HttpGet("gate-passes/my-profile")]
    public async Task<ActionResult> GetMyStudentProfile()
    {
        var tenantId = _currentUser.TenantId;
        var scope = await GetUserAccessScopeAsync(tenantId);
        if (scope.StudentId.HasValue)
        {
            var s = await _db.Students
                .AsNoTracking()
                .Include(st => st.Class)
                .Include(st => st.Section)
                .FirstOrDefaultAsync(st => st.Id == scope.StudentId.Value && st.TenantId == tenantId);

            if (s != null)
            {
                return Ok(new
                {
                    isStudentOrParent = true,
                    studentId = s.Id,
                    studentName = s.StudentName,
                    className = s.Class?.Name,
                    sectionName = s.Section?.Name,
                    rollNumber = s.RollNumber,
                    parentName = s.ParentName,
                    parentPhone = s.ParentWhatsAppPhone ?? s.EmergencyContactPhone
                });
            }
        }

        return Ok(new { isStudentOrParent = false });
    }

    [HttpGet("gate-passes")]
    public async Task<ActionResult<IEnumerable<StudentGatePassDto>>> GetGatePasses(
        [FromQuery] string? status,
        [FromQuery] Guid? studentId,
        [FromQuery] string? search,
        [FromQuery] DateTime? date)
    {
        var tenantId = _currentUser.TenantId;
        var scope = await GetUserAccessScopeAsync(tenantId);

        var query = _db.StudentGatePasses
            .AsNoTracking()
            .Include(g => g.Student).ThenInclude(s => s!.Class)
            .Include(g => g.Student).ThenInclude(s => s!.Section)
            .Where(g => g.TenantId == tenantId);

        // Student/Parent can ONLY view their own gate passes
        if (scope.Scope == "Student" || scope.Scope == "Parent")
        {
            if (!scope.StudentId.HasValue)
                return Ok(new List<StudentGatePassDto>());
            query = query.Where(g => g.StudentId == scope.StudentId.Value);
        }
        else if (studentId.HasValue)
        {
            query = query.Where(g => g.StudentId == studentId.Value);
        }

        if (!string.IsNullOrEmpty(status) && status != "All")
            query = query.Where(g => g.Status == status);

        if (date.HasValue)
            query = query.Where(g => g.OutDateTime.Date == date.Value.Date);

        if (!string.IsNullOrEmpty(search))
        {
            var s = search.ToLower();
            query = query.Where(g =>
                g.Student!.StudentName.ToLower().Contains(s) ||
                g.GatePassNumber.ToLower().Contains(s) ||
                (g.ParentGuardianName != null && g.ParentGuardianName.ToLower().Contains(s)));
        }

        var items = await query
            .OrderByDescending(g => g.OutDateTime)
            .Select(g => new StudentGatePassDto
            {
                Id                  = g.Id,
                GatePassNumber      = g.GatePassNumber,
                StudentId           = g.StudentId,
                StudentName         = g.Student != null ? g.Student.StudentName : string.Empty,
                ClassName           = g.Student != null && g.Student.Class != null ? g.Student.Class.Name : null,
                SectionName         = g.Student != null && g.Student.Section != null ? g.Student.Section.Name : null,
                RollNumber          = g.Student != null ? g.Student.RollNumber : null,
                Reason              = g.Reason,
                ReasonCategory      = g.ReasonCategory,
                OutDateTime         = g.OutDateTime,
                ExpectedReturnTime  = g.ExpectedReturnTime,
                ActualReturnTime    = g.ActualReturnTime,
                Status              = g.Status,
                ParentGuardianName  = g.ParentGuardianName,
                ParentContactNumber = g.ParentContactNumber,
                ParentRelation      = g.ParentRelation,
                ApprovedBy          = g.ApprovedBy,
                ApprovedAt          = g.ApprovedAt,
                ApprovalRemarks     = g.ApprovalRemarks,
                SecurityGuardName   = g.SecurityGuardName,
                Remarks             = g.Remarks,
                CreatedAt           = g.CreatedAt
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("gate-passes")]
    public async Task<ActionResult<StudentGatePassDto>> CreateGatePass([FromBody] CreateGatePassRequest req)
    {
        var tenantId = _currentUser.TenantId;
        var scope = await GetUserAccessScopeAsync(tenantId);

        Guid targetStudentId = req.StudentId;
        if (scope.Scope == "Student" || scope.Scope == "Parent")
        {
            if (!scope.StudentId.HasValue)
            {
                return BadRequest(new { message = "No student profile is linked with your current user account." });
            }
            targetStudentId = scope.StudentId.Value;
        }

        var student = await _db.Students
            .AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Section)
            .FirstOrDefaultAsync(s => s.Id == targetStudentId && s.TenantId == tenantId);

        if (student == null) return BadRequest(new { message = "Student not found." });

        var year  = DateTime.Now.Year;
        var count = await _db.StudentGatePasses.CountAsync(g => g.TenantId == tenantId && g.OutDateTime.Year == year);
        var gatePassNumber = $"SGP-{year}-{(count + 1):D4}";

        var parentName = !string.IsNullOrWhiteSpace(req.ParentGuardianName) 
            ? req.ParentGuardianName.Trim() 
            : (!string.IsNullOrWhiteSpace(student.ParentName) ? student.ParentName : scope.DisplayName);

        var parentPhone = !string.IsNullOrWhiteSpace(req.ParentContactNumber) 
            ? req.ParentContactNumber.Trim() 
            : (student.ParentWhatsAppPhone ?? student.EmergencyContactPhone);

        var pass = new StudentGatePass
        {
            Id                  = Guid.NewGuid(),
            TenantId            = tenantId,
            BranchId            = _currentUser.BranchId,
            GatePassNumber      = gatePassNumber,
            StudentId           = targetStudentId,
            Reason              = req.Reason.Trim(),
            ReasonCategory      = req.ReasonCategory,
            OutDateTime         = DateTime.Now,
            ExpectedReturnTime  = req.ExpectedReturnTime,
            Status              = "Pending",
            ParentGuardianName  = parentName,
            ParentContactNumber = parentPhone,
            ParentRelation      = req.ParentRelation?.Trim() ?? "Parent",
            SecurityGuardName   = req.SecurityGuardName?.Trim(),
            Remarks             = req.Remarks?.Trim(),
            CreatedAt           = DateTime.Now,
            UpdatedAt           = DateTime.Now
        };

        _db.StudentGatePasses.Add(pass);
        await _db.SaveChangesAsync();

        _logger.LogInformation("[FrontDesk] Gate pass issued/requested: {GatePassNumber} for {Student} by {Scope}", gatePassNumber, student.StudentName, scope.Scope);

        return Ok(new StudentGatePassDto
        {
            Id                  = pass.Id,
            GatePassNumber      = pass.GatePassNumber,
            StudentId           = pass.StudentId,
            StudentName         = student.StudentName,
            ClassName           = student.Class?.Name,
            SectionName         = student.Section?.Name,
            RollNumber          = student.RollNumber,
            Reason              = pass.Reason,
            ReasonCategory      = pass.ReasonCategory,
            OutDateTime         = pass.OutDateTime,
            ExpectedReturnTime  = pass.ExpectedReturnTime,
            Status              = pass.Status,
            ParentGuardianName  = pass.ParentGuardianName,
            ParentContactNumber = pass.ParentContactNumber,
            ParentRelation      = pass.ParentRelation,
            SecurityGuardName   = pass.SecurityGuardName,
            Remarks             = pass.Remarks,
            CreatedAt           = pass.CreatedAt
        });
    }

    [HttpPut("gate-passes/{id}/approve")]
    public async Task<IActionResult> ApproveGatePass(Guid id, [FromBody] ApproveGatePassRequest req)
    {
        var tenantId = _currentUser.TenantId;
        var scope = await GetUserAccessScopeAsync(tenantId);

        // Students / Parents cannot approve or reject gate passes
        if (scope.Scope == "Student" || scope.Scope == "Parent")
            return Forbid();

        var pass = await _db.StudentGatePasses.FirstOrDefaultAsync(g => g.Id == id && g.TenantId == tenantId);
        if (pass == null) return NotFound();

        // Resolve approver name from DB
        var approverUser = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);
        var approverName = approverUser?.FullName ?? approverUser?.Username ?? _currentUser.UserRole;

        if (req.Action == "Approve")
        {
            pass.Status     = "Approved";
            pass.ApprovedBy = approverName;
            pass.ApprovedAt = DateTime.Now;
        }
        else
        {
            pass.Status     = "Rejected";
            pass.ApprovedBy = approverName;
            pass.ApprovedAt = DateTime.Now;
        }

        pass.ApprovalRemarks = req.ApprovalRemarks?.Trim();
        pass.UpdatedAt       = DateTime.Now;

        await _db.SaveChangesAsync();
        return Ok(new { message = $"Gate pass {req.Action}d successfully.", status = pass.Status });
    }

    [HttpPut("gate-passes/{id}/return")]
    public async Task<IActionResult> MarkReturn(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var pass = await _db.StudentGatePasses.FirstOrDefaultAsync(g => g.Id == id && g.TenantId == tenantId);
        if (pass == null) return NotFound();

        pass.ActualReturnTime = DateTime.Now;
        pass.Status           = "Returned";
        pass.UpdatedAt        = DateTime.Now;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Student marked as returned.", returnTime = pass.ActualReturnTime });
    }

    [HttpDelete("gate-passes/{id}")]
    public async Task<IActionResult> DeleteGatePass(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var scope = await GetUserAccessScopeAsync(tenantId);

        var pass = await _db.StudentGatePasses.FirstOrDefaultAsync(g => g.Id == id && g.TenantId == tenantId);
        if (pass == null) return NotFound();

        // If student or parent, they can only delete (cancel) their OWN PENDING gate pass
        if (scope.Scope == "Student" || scope.Scope == "Parent")
        {
            if (pass.StudentId != scope.StudentId)
                return Forbid();
            if (pass.Status != "Pending")
                return BadRequest(new { message = "Only Pending gate pass requests can be cancelled." });
        }

        _db.StudentGatePasses.Remove(pass);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ─── Helpers ──────────────────────────────────────────────────

    private async Task<(string Scope, Guid? StudentId, string DisplayName)> GetUserAccessScopeAsync(Guid tenantId)
    {
        var userId = _currentUser.UserId;
        var user = await _db.Users
            .AsNoTracking()
            .Include(u => u.AssignedRole)
            .FirstOrDefaultAsync(u => u.Id == userId);

        var roleName = user?.AssignedRole?.Name ?? _currentUser.UserRole ?? "";

        // Check if Student
        if (roleName.Contains("Student", StringComparison.OrdinalIgnoreCase) || _currentUser.UserRole.Equals("Student", StringComparison.OrdinalIgnoreCase))
        {
            var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == userId && s.TenantId == tenantId);
            return ("Student", student?.Id, user?.FullName ?? "Student");
        }

        // Check if Parent
        if (roleName.Contains("Parent", StringComparison.OrdinalIgnoreCase) || _currentUser.UserRole.Equals("Parent", StringComparison.OrdinalIgnoreCase))
        {
            var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.ParentUserId == userId && s.TenantId == tenantId);
            return ("Parent", student?.Id, user?.FullName ?? "Parent");
        }

        // Default: Staff / Admin / Teacher / FrontDesk
        return ("Staff", null, user?.FullName ?? _currentUser.UserRole ?? "Administrator");
    }

    private static VisitorLogDto MapVisitorDto(VisitorLog v) => new()
    {
        Id               = v.Id,
        VisitorNumber    = v.VisitorNumber,
        VisitorType      = v.VisitorType,
        VisitorName      = v.VisitorName,
        Organization     = v.Organization,
        ContactNumber    = v.ContactNumber,
        Email            = v.Email,
        IdProofType      = v.IdProofType,
        IdProofNumber    = v.IdProofNumber,
        PersonToMeet     = v.PersonToMeet,
        DepartmentToVisit = v.DepartmentToVisit,
        StudentId        = v.StudentId,
        StudentName      = v.StudentName,
        StudentClass     = v.StudentClass,
        Purpose          = v.Purpose,
        CheckInTime      = v.CheckInTime,
        CheckOutTime     = v.CheckOutTime,
        Status           = v.Status,
        NumberOfVisitors = v.NumberOfVisitors,
        VehicleNumber    = v.VehicleNumber,
        BadgeNumber      = v.BadgeNumber,
        MaterialCarried  = v.MaterialCarried,
        Remarks          = v.Remarks,
        ReceivedBy       = v.ReceivedBy,
        CreatedAt        = v.CreatedAt
    };
}
