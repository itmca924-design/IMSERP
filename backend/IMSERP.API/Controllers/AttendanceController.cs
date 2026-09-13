using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/attendance")]
[Authorize]
public class AttendanceController : ControllerBase
{
    private const string ModeSettingsRoute = "/attendance/permissions/mode-settings";
    private const string ManualRoute = "/attendance/permissions/manual";
    private const string BiometricRoute = "/attendance/permissions/biometric";
    private const string MappingRoute = "/attendance/permissions/biometric-mapping";
    private const string CorrectionRoute = "/attendance/permissions/correction";
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public AttendanceController(IIMSERPDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet("permissions")]
    public async Task<ActionResult<AttendancePermissionsDto>> GetPermissions()
    {
        return Ok(new AttendancePermissionsDto(
            await HasPermissionAsync(ModeSettingsRoute, PermissionAction.Edit),
            await HasPermissionAsync(ManualRoute, PermissionAction.Create),
            await HasPermissionAsync(BiometricRoute, PermissionAction.Create),
            await HasPermissionAsync(MappingRoute, PermissionAction.Edit),
            await HasPermissionAsync(CorrectionRoute, PermissionAction.Edit)));
    }

    [HttpGet("settings")]
    public async Task<ActionResult<AttendanceSettingsDto>> GetSettings()
    {
        var settings = await _db.AttendanceSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);
        return Ok(new AttendanceSettingsDto(settings?.StudentMode ?? "Both", settings?.TeacherMode ?? "Both"));
    }

    [HttpPut("settings")]
    public async Task<ActionResult<AttendanceSettingsDto>> UpdateSettings([FromBody] AttendanceSettingsDto dto)
    {
        if (!await HasPermissionAsync(ModeSettingsRoute, PermissionAction.Edit))
            return Forbid();

        if (!IsValidMode(dto.StudentMode) || !IsValidMode(dto.TeacherMode))
            return BadRequest(new { message = "Mode must be Manual, Biometric, or Both." });

        var settings = await _db.AttendanceSettings.FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);
        if (settings == null)
        {
            settings = new AttendanceSettings { TenantId = _currentUser.TenantId };
            _db.AttendanceSettings.Add(settings);
        }

        settings.StudentMode = dto.StudentMode;
        settings.TeacherMode = dto.TeacherMode;
        settings.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new AttendanceSettingsDto(settings.StudentMode, settings.TeacherMode));
    }

    [HttpPost("biometric-events")]
    public async Task<IActionResult> ReceiveBiometricEvent([FromBody] BiometricAttendanceEventDto dto)
    {
        if (!await HasPermissionAsync(BiometricRoute, PermissionAction.Create))
            return Forbid();

        if (string.IsNullOrWhiteSpace(dto.BiometricUserId) || dto.EventTime == default)
            return BadRequest(new { message = "BiometricUserId and EventTime are required." });

        var personType = dto.PersonType.Trim().ToLowerInvariant();
        var settings = await _db.AttendanceSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);
        var mode = personType == "student" ? settings?.StudentMode : personType == "teacher" ? settings?.TeacherMode : null;
        if (mode == null) return BadRequest(new { message = "PersonType must be Student or Teacher." });
        if (string.Equals(mode, "Manual", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { message = "Biometric attendance is disabled for this person type." });

        if (personType == "student")
        {
            var student = await _db.Students.FirstOrDefaultAsync(s => s.BiometricUserId == dto.BiometricUserId);
            if (student == null) return NotFound(new { message = "No student is mapped to this biometric user ID." });

            var record = await _db.StudentAttendances.FirstOrDefaultAsync(a =>
                (dto.EventId != null && a.BiometricEventId == dto.EventId) ||
                (a.StudentId == student.Id && a.AttendanceDate == dto.EventTime.Date));
            if (record == null)
            {
                record = new StudentAttendance { TenantId = _currentUser.TenantId, StudentId = student.Id, AttendanceDate = dto.EventTime.Date };
                _db.StudentAttendances.Add(record);
            }
            record.Status = TeacherAttendanceStatus.Present;
            record.CaptureSource = "Biometric";
            record.BiometricDeviceId = dto.DeviceId;
            record.BiometricEventId = dto.EventId;
            record.CapturedAt = dto.EventTime;
            record.MarkedBy = "biometric-device";
            await _db.SaveChangesAsync();
            return Ok(new { message = "Student biometric attendance captured.", attendanceId = record.Id });
        }

        var teacher = await _db.Teachers.FirstOrDefaultAsync(t => t.BiometricUserId == dto.BiometricUserId);
        if (teacher == null) return NotFound(new { message = "No teacher is mapped to this biometric user ID." });

        var teacherRecord = await _db.TeacherAttendances.FirstOrDefaultAsync(a =>
            (dto.EventId != null && a.BiometricEventId == dto.EventId) ||
            (a.TeacherId == teacher.Id && a.AttendanceDate == dto.EventTime.Date));
        if (teacherRecord == null)
        {
            teacherRecord = new TeacherAttendance { TenantId = _currentUser.TenantId, TeacherId = teacher.Id, AttendanceDate = dto.EventTime.Date };
            _db.TeacherAttendances.Add(teacherRecord);
        }

        teacherRecord.Status = TeacherAttendanceStatus.Present;
        teacherRecord.CaptureSource = "Biometric";
        teacherRecord.BiometricDeviceId = dto.DeviceId;
        teacherRecord.BiometricEventId = dto.EventId;
        teacherRecord.CapturedAt = dto.EventTime;
        teacherRecord.MarkedBy = "biometric-device";
        if (dto.IsCheckOut)
            teacherRecord.CheckOutTime = dto.EventTime.ToString("HH:mm");
        else
            teacherRecord.CheckInTime ??= dto.EventTime.ToString("HH:mm");

        await _db.SaveChangesAsync();
        return Ok(new { message = "Teacher biometric attendance captured.", attendanceId = teacherRecord.Id });
    }

    [HttpPut("mappings/{personType}/{personId:guid}")]
    public async Task<IActionResult> UpdateBiometricMapping(string personType, Guid personId, [FromBody] BiometricMappingDto dto)
    {
        if (!await HasPermissionAsync(MappingRoute, PermissionAction.Edit))
            return Forbid();

        if (string.IsNullOrWhiteSpace(dto.BiometricUserId))
            return BadRequest(new { message = "BiometricUserId is required." });

        if (personType.Equals("student", StringComparison.OrdinalIgnoreCase))
        {
            var student = await _db.Students.FirstOrDefaultAsync(s => s.Id == personId);
            if (student == null) return NotFound(new { message = "Student not found." });
            student.BiometricUserId = dto.BiometricUserId.Trim();
        }
        else if (personType.Equals("teacher", StringComparison.OrdinalIgnoreCase))
        {
            var teacher = await _db.Teachers.FirstOrDefaultAsync(t => t.Id == personId);
            if (teacher == null) return NotFound(new { message = "Teacher not found." });
            teacher.BiometricUserId = dto.BiometricUserId.Trim();
        }
        else
        {
            return BadRequest(new { message = "PersonType must be Student or Teacher." });
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static bool IsValidMode(string mode) =>
        mode.Equals("Manual", StringComparison.OrdinalIgnoreCase) ||
        mode.Equals("Biometric", StringComparison.OrdinalIgnoreCase) ||
        mode.Equals("Both", StringComparison.OrdinalIgnoreCase);

    private enum PermissionAction { View, Create, Edit, Delete }

    private async Task<bool> HasPermissionAsync(string route, PermissionAction action)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);
        if (user?.RoleId == null) return false;

        var permission = await _db.RolePermissions.AsNoTracking()
            .Where(rp => rp.RoleId == user.RoleId)
            .Join(_db.MenuItems, rp => rp.MenuItemId, menu => menu.Id, (rp, menu) => new { rp, menu.RouteUrl })
            .FirstOrDefaultAsync(item => item.RouteUrl == route);

        return permission != null && action switch
        {
            PermissionAction.View => permission.rp.CanView,
            PermissionAction.Create => permission.rp.CanCreate,
            PermissionAction.Edit => permission.rp.CanEdit,
            PermissionAction.Delete => permission.rp.CanDelete,
            _ => false
        };
    }
}