using System.IO.Compression;
using System.Linq.Expressions;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
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
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _env;

    public BiometricDevicesController(
        IIMSERPDbContext db,
        ICurrentUserService currentUser,
        IConfiguration configuration,
        IWebHostEnvironment env)
    {
        _db = db;
        _currentUser = currentUser;
        _configuration = configuration;
        _env = env;
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

        if (string.IsNullOrWhiteSpace(device.IpAddress))
        {
            device.Status = "ConfigRequired";
            device.LastError = "Please enter the Device IP Address to test LAN/Wi-Fi connection.";
            await _db.SaveChangesAsync();
            return Ok(ToDto(device));
        }

        try
        {
            using var tcp = new System.Net.Sockets.TcpClient();
            var port = device.Port > 0 ? device.Port : 80;
            var connectTask = tcp.ConnectAsync(device.IpAddress.Trim(), port);
            var timeoutTask = Task.Delay(2500);

            if (await Task.WhenAny(connectTask, timeoutTask) == connectTask && tcp.Connected)
            {
                device.Status = "Online";
                device.LastSeenAt = DateTime.UtcNow;
                device.LastError = null;
            }
            else
            {
                device.Status = "Offline";
                device.LastError = $"Cannot connect to {device.IpAddress}:{port}. Check device power, LAN/Wi-Fi cable, or assigned IP.";
            }
        }
        catch (Exception ex)
        {
            device.Status = "Offline";
            device.LastError = $"Connection failed: {ex.Message}";
        }

        await _db.SaveChangesAsync();
        return Ok(ToDto(device));
    }

    [HttpGet("{id:guid}/bridge-package")]
    public async Task<IActionResult> DownloadBridgePackage(Guid id)
    {
        if (!await HasDevicePermissionAsync()) return Forbid();

        var device = await _db.BiometricDevices.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id);
        if (device == null) return NotFound(new { message = "Biometric device not found." });

        var webhookKey = _configuration["Biometric:WebhookKey"];
        if (string.IsNullOrWhiteSpace(webhookKey) || Encoding.UTF8.GetByteCount(webhookKey) < 32)
        {
            return BadRequest(new { message = "Biometric WebhookKey is not configured on the server. Please contact your system administrator." });
        }

        var bridgeExePath = Path.Combine(_env.ContentRootPath, "Assets", "IMSERP.BiometricBridge.exe");
        if (!System.IO.File.Exists(bridgeExePath))
        {
            return NotFound(new { message = "IMSERP Biometric Bridge binary is not deployed on the server yet." });
        }

        var forwardedProto = Request.Headers["X-Forwarded-Proto"].FirstOrDefault();
        var scheme = !string.IsNullOrWhiteSpace(forwardedProto) ? forwardedProto.Split(',')[0].Trim() : Request.Scheme;
        var host = Request.Host.Value;
        var webhookUrl = $"{scheme}://{host}/api/attendance/biometric/hikvision";

        var bridgeConfig = new
        {
            ErpWebhookUrl = webhookUrl,
            WebhookKey = webhookKey,
            TenantId = _currentUser.TenantId.ToString(),
            DeviceName = device.Name,
            DeviceSerialNumber = device.SerialNumber ?? "",
            DeviceIp = string.IsNullOrWhiteSpace(device.IpAddress) ? "192.168.1.2" : device.IpAddress.Trim(),
            DevicePort = device.Port > 0 ? device.Port : 80,
            DeviceUsername = "admin",
            DevicePassword = "",
            PollIntervalSeconds = 5,
            LookbackDays = 2
        };

        var configJson = JsonSerializer.Serialize(bridgeConfig, new JsonSerializerOptions { WriteIndented = true });

        var autoStartBat =
            "@echo off\r\n" +
            "setlocal\r\n" +
            "set \"SCRIPT_DIR=%~dp0\"\r\n" +
            "set \"EXE_PATH=%SCRIPT_DIR%IMSERP.BiometricBridge.exe\"\r\n" +
            "set \"STARTUP_DIR=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\"\r\n" +
            "powershell -NoProfile -Command \"$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%STARTUP_DIR%\\IMSERP-Biometric-Bridge.lnk'); $s.TargetPath = '%EXE_PATH%'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.WindowStyle = 7; $s.Save()\"\r\n" +
            "echo.\r\n" +
            "echo [OK] IMSERP Biometric Bridge added to Windows Startup!\r\n" +
            "echo Ab har baar PC on hone par attendance automatic sync hogi.\r\n" +
            "echo.\r\n" +
            "pause\r\n";

        var readmeTxt =
            "====================================================================\r\n" +
            "   IMSERP BIOMETRIC LIVE SYNC BRIDGE (Hikvision DS-K1A802AEF)\r\n" +
            "====================================================================\r\n\r\n" +
            $"Device Name   : {device.Name}\r\n" +
            $"Serial Number : {device.SerialNumber ?? "Not set"}\r\n" +
            $"Local IP      : {bridgeConfig.DeviceIp}:{bridgeConfig.DevicePort}\r\n" +
            $"Cloud ERP URL : {webhookUrl}\r\n\r\n" +
            "SETUP STEPS (Sirf 1 Baar Karna Hai - 2 Minute Setup):\r\n" +
            "1. Is ZIP folder ko apne School Desktop PC par extract kar lein\r\n" +
            "   (Desktop PC usi Wi-Fi/LAN par hona chahiye jis par biometric machine hai).\r\n" +
            "2. 'IMSERP.BiometricBridge.exe' par double-click karein.\r\n" +
            "3. Pehli baar aapse Hikvision machine ka Admin Password pucha jayega.\r\n" +
            "   Password daal kar Enter dabate hi:\r\n" +
            "   - Password locally bridge-config.json me save ho jayega.\r\n" +
            "   - ERP me machine turant 'Online' dikhne lagegi.\r\n" +
            "   - Har 5 second me naye finger/RFID punches seedha ERP me sync honge!\r\n" +
            "4. (Optional) 'Install-AutoStart.bat' ko 1 baar double-click kar dein\r\n" +
            "   taaki har baar PC start hone par bridge apne aap background me chal jaye.\r\n\r\n" +
            "NOTE: Biometric machine me koi extra URL, EHome ya Router Port Forwarding\r\n" +
            "      karne ki bilkul zaroorat nahi hai!\r\n";

        using var ms = new MemoryStream();
        using (var archive = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            var exeEntry = archive.CreateEntry("IMSERP.BiometricBridge.exe", CompressionLevel.Fastest);
            await using (var entryStream = exeEntry.Open())
            await using (var fileStream = System.IO.File.OpenRead(bridgeExePath))
            {
                await fileStream.CopyToAsync(entryStream);
            }

            var cfgEntry = archive.CreateEntry("bridge-config.json", CompressionLevel.Optimal);
            await using (var sw = new StreamWriter(cfgEntry.Open(), new UTF8Encoding(false)))
            {
                await sw.WriteAsync(configJson);
            }

            var batEntry = archive.CreateEntry("Install-AutoStart.bat", CompressionLevel.Optimal);
            await using (var sw = new StreamWriter(batEntry.Open(), new UTF8Encoding(false)))
            {
                await sw.WriteAsync(autoStartBat);
            }

            var readmeEntry = archive.CreateEntry("README.txt", CompressionLevel.Optimal);
            await using (var sw = new StreamWriter(readmeEntry.Open(), new UTF8Encoding(false)))
            {
                await sw.WriteAsync(readmeTxt);
            }
        }

        var safeName = Regex.Replace(device.SerialNumber ?? device.Name ?? "Device", @"[^A-Za-z0-9_-]", "");
        return File(ms.ToArray(), "application/zip", $"IMSERP-Biometric-Bridge-{safeName}.zip");
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