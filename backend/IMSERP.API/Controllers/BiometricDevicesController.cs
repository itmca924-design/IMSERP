using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using System.Linq.Expressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/biometric-devices")]
[Authorize]
public class BiometricDevicesController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public BiometricDevicesController(IIMSERPDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<BiometricDeviceDto>>> GetDevices()
    {
        if (!await HasDevicePermissionAsync()) return Forbid();
        return Ok(await _db.BiometricDevices.AsNoTracking().OrderBy(d => d.Name).Select(Map).ToListAsync());
    }

    [HttpPost]
    public async Task<ActionResult<BiometricDeviceDto>> CreateDevice([FromBody] SaveBiometricDeviceDto dto)
    {
        if (!await HasDevicePermissionAsync()) return Forbid();
        var device = new BiometricDevice
        {
            TenantId = _currentUser.TenantId, BranchId = _currentUser.BranchId, Name = dto.Name.Trim(), Brand = dto.Brand?.Trim(), Model = dto.Model?.Trim(),
            SerialNumber = dto.SerialNumber?.Trim(), IpAddress = dto.IpAddress?.Trim(), Port = dto.Port,
            ConnectionMode = dto.ConnectionMode, IsActive = dto.IsActive, Status = "NotConfigured"
        };
        _db.BiometricDevices.Add(device);
        await _db.SaveChangesAsync();
        return Ok(ToDto(device));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<BiometricDeviceDto>> UpdateDevice(Guid id, [FromBody] SaveBiometricDeviceDto dto)
    {
        if (!await HasDevicePermissionAsync()) return Forbid();
        var device = await _db.BiometricDevices.FirstOrDefaultAsync(d => d.Id == id);
        if (device == null) return NotFound();
        device.Name = dto.Name.Trim(); device.Brand = dto.Brand?.Trim(); device.Model = dto.Model?.Trim();
        device.SerialNumber = dto.SerialNumber?.Trim(); device.IpAddress = dto.IpAddress?.Trim(); device.Port = dto.Port;
        device.ConnectionMode = dto.ConnectionMode; device.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();
        return Ok(ToDto(device));
    }

    [HttpPost("{id:guid}/test-connection")]
    public async Task<ActionResult<BiometricDeviceDto>> TestConnection(Guid id)
    {
        if (!await HasDevicePermissionAsync()) return Forbid();
        var device = await _db.BiometricDevices.FirstOrDefaultAsync(d => d.Id == id);
        if (device == null) return NotFound();
        device.Status = device.ConnectionMode.Equals("PendingAdapter", StringComparison.OrdinalIgnoreCase) ? "AdapterRequired" : "NotConnected";
        device.LastSeenAt = null;
        device.LastError = "Vendor adapter is not configured yet. Add the device-specific SDK/API adapter when the model is available.";
        await _db.SaveChangesAsync();
        return Ok(ToDto(device));
    }

    [HttpGet("events")]
    public async Task<ActionResult<IEnumerable<BiometricEventLogDto>>> GetEvents([FromQuery] int take = 100)
    {
        if (!await HasDevicePermissionAsync()) return Forbid();
        take = Math.Clamp(take, 1, 500);
        return Ok(await _db.BiometricEventLogs.AsNoTracking().OrderByDescending(e => e.ReceivedAt).Take(take).Select(e => new BiometricEventLogDto(
            e.Id, e.DeviceId, e.PersonType, e.BiometricUserId, e.EventTime, e.DeviceEventId,
            e.Status, e.ErrorMessage, e.AttendanceId, e.ReceivedAt)).ToListAsync());
    }

    private static readonly Expression<Func<BiometricDevice, BiometricDeviceDto>> Map = d => new(
        d.Id, d.Name, d.Brand, d.Model, d.SerialNumber, d.IpAddress, d.Port, d.ConnectionMode,
        d.IsActive, d.Status, d.LastSeenAt, d.LastSyncAt, d.LastError);

    private static BiometricDeviceDto ToDto(BiometricDevice d) => new(
        d.Id, d.Name, d.Brand, d.Model, d.SerialNumber, d.IpAddress, d.Port, d.ConnectionMode,
        d.IsActive, d.Status, d.LastSeenAt, d.LastSyncAt, d.LastError);

    private async Task<bool> HasDevicePermissionAsync()
    {
        var user = await _db.Users.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);
        if (user?.RoleId == null) return false;
        return await _db.RolePermissions.AsNoTracking()
            .Where(permission => permission.RoleId == user.RoleId && permission.CanEdit)
            .Join(_db.MenuItems, permission => permission.MenuItemId, menu => menu.Id, (permission, menu) => menu.RouteUrl)
            .AnyAsync(route => route == "/attendance/permissions/biometric-mapping");
    }
}