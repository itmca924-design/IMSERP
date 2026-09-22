using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TransportController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IWhatsAppService _whatsAppService;

    public TransportController(IIMSERPDbContext db, ICurrentUserService currentUser, IWhatsAppService whatsAppService)
    {
        _db = db;
        _currentUser = currentUser;
        _whatsAppService = whatsAppService;
    }

    // =========================================================================
    // 1. Overview
    // =========================================================================

    [HttpGet("overview")]
    public async Task<ActionResult<TransportOverviewDto>> GetOverview()
    {
        var totalVehicles = await _db.TransportVehicles.CountAsync(v => v.IsActive);
        var activeRoutes = await _db.TransportRoutes.CountAsync(r => r.IsActive);
        var studentAllocations = await _db.TransportAllocations.CountAsync(a => a.MemberType == "Student" && a.Status == "Active");
        var teacherAllocations = await _db.TransportAllocations.CountAsync(a => a.MemberType == "Teacher" && a.Status == "Active");
        var today = DateTime.UtcNow.Date;
        var todayBusDepartures = await _db.CampusGatePasses.CountAsync(g => g.PassType == "BusDeparture" && g.OutDateTime.Date == today);
        var threshold = DateTime.UtcNow.AddDays(30);
        var expiredAlerts = await _db.TransportVehicles.CountAsync(v => v.IsActive && (
            (v.InsuranceExpiry.HasValue && v.InsuranceExpiry.Value <= threshold) ||
            (v.FitnessExpiry.HasValue && v.FitnessExpiry.Value <= threshold) ||
            (v.PollutionExpiry.HasValue && v.PollutionExpiry.Value <= threshold)));
        return Ok(new TransportOverviewDto(totalVehicles, activeRoutes, studentAllocations, teacherAllocations, todayBusDepartures, expiredAlerts));
    }

    // =========================================================================
    // 2. Drivers CRUD
    // =========================================================================

    [HttpGet("drivers")]
    public async Task<ActionResult<IEnumerable<TransportDriverDto>>> GetDrivers([FromQuery] bool includeInactive = false)
    {
        var query = _db.TransportDrivers.AsNoTracking().Include(d => d.Vehicles);
        var drivers = await (includeInactive ? query : query.Where(d => d.IsActive)).OrderBy(d => d.FullName).ToListAsync();
        return Ok(drivers.Select(d => new TransportDriverDto(d.Id, d.FullName, d.PhoneNumber, d.EmergencyPhone, d.LicenseNumber, d.LicenseExpiry, d.AadhaarNumber, d.Address, d.PhotoUrl, d.IsActive, d.CreatedAt, d.Vehicles.Count(v => v.IsActive))));
    }

    [HttpPost("drivers")]
    public async Task<ActionResult<TransportDriverDto>> CreateDriver([FromBody] CreateTransportDriverDto dto)
    {
        var driver = new TransportDriver { TenantId = _currentUser.TenantId, BranchId = _currentUser.BranchId, FullName = dto.FullName.Trim(), PhoneNumber = dto.PhoneNumber, EmergencyPhone = dto.EmergencyPhone, LicenseNumber = dto.LicenseNumber, LicenseExpiry = dto.LicenseExpiry, AadhaarNumber = dto.AadhaarNumber, Address = dto.Address, PhotoUrl = dto.PhotoUrl, IsActive = true };
        _db.TransportDrivers.Add(driver);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetDrivers), new { id = driver.Id }, new TransportDriverDto(driver.Id, driver.FullName, driver.PhoneNumber, driver.EmergencyPhone, driver.LicenseNumber, driver.LicenseExpiry, driver.AadhaarNumber, driver.Address, driver.PhotoUrl, driver.IsActive, driver.CreatedAt));
    }

    [HttpPut("drivers/{id}")]
    public async Task<IActionResult> UpdateDriver(Guid id, [FromBody] CreateTransportDriverDto dto)
    {
        var driver = await _db.TransportDrivers.FindAsync(id);
        if (driver == null) return NotFound();
        driver.FullName = dto.FullName.Trim(); driver.PhoneNumber = dto.PhoneNumber; driver.EmergencyPhone = dto.EmergencyPhone; driver.LicenseNumber = dto.LicenseNumber; driver.LicenseExpiry = dto.LicenseExpiry; driver.AadhaarNumber = dto.AadhaarNumber; driver.Address = dto.Address;
        if (dto.PhotoUrl != null) driver.PhotoUrl = dto.PhotoUrl;
        await _db.SaveChangesAsync(); return NoContent();
    }

    [HttpPatch("drivers/{id}/toggle-active")]
    public async Task<IActionResult> ToggleDriverActive(Guid id) { var driver = await _db.TransportDrivers.FindAsync(id); if (driver == null) return NotFound(); driver.IsActive = !driver.IsActive; await _db.SaveChangesAsync(); return Ok(new { driver.IsActive }); }

    // =========================================================================
    // 3. Vehicles CRUD
    // =========================================================================

    [HttpGet("vehicles")]
    public async Task<ActionResult<IEnumerable<TransportVehicleDto>>> GetVehicles([FromQuery] bool includeInactive = false)
    {
        var query = _db.TransportVehicles.AsNoTracking().Include(v => v.Driver);
        var vehicles = await (includeInactive ? query : query.Where(v => v.IsActive)).OrderBy(v => v.VehicleNumber).ToListAsync();
        var threshold = DateTime.UtcNow.AddDays(30);
        var allocationCounts = await _db.TransportAllocations.Where(a => a.Status == "Active" && a.VehicleId.HasValue).GroupBy(a => a.VehicleId!.Value).Select(g => new { VehicleId = g.Key, Count = g.Count() }).ToListAsync();
        return Ok(vehicles.Select(v => {
            var count = allocationCounts.FirstOrDefault(c => c.VehicleId == v.Id)?.Count ?? 0;
            return new TransportVehicleDto(v.Id, v.VehicleNumber, v.VehicleType, v.TotalCapacity, v.Model, v.Color, v.DriverId, v.Driver?.FullName, v.Driver?.PhoneNumber, v.ConductorName, v.ConductorPhone, v.GpsDeviceId, v.InsuranceExpiry, v.FitnessExpiry, v.PollutionExpiry, v.IsActive, v.CreatedAt, count, v.InsuranceExpiry.HasValue && v.InsuranceExpiry.Value <= threshold, v.FitnessExpiry.HasValue && v.FitnessExpiry.Value <= threshold);
        }));
    }

    [HttpPost("vehicles")]
    public async Task<ActionResult<TransportVehicleDto>> CreateVehicle([FromBody] CreateTransportVehicleDto dto)
    {
        var vehicle = new TransportVehicle { TenantId = _currentUser.TenantId, BranchId = _currentUser.BranchId, VehicleNumber = dto.VehicleNumber.Trim().ToUpper(), VehicleType = dto.VehicleType, TotalCapacity = dto.TotalCapacity, Model = dto.Model, Color = dto.Color, DriverId = dto.DriverId, ConductorName = dto.ConductorName, ConductorPhone = dto.ConductorPhone, GpsDeviceId = dto.GpsDeviceId, InsuranceExpiry = dto.InsuranceExpiry, FitnessExpiry = dto.FitnessExpiry, PollutionExpiry = dto.PollutionExpiry, IsActive = true };
        _db.TransportVehicles.Add(vehicle); await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetVehicles), new { id = vehicle.Id }, new TransportVehicleDto(vehicle.Id, vehicle.VehicleNumber, vehicle.VehicleType, vehicle.TotalCapacity, vehicle.Model, vehicle.Color, vehicle.DriverId, null, null, vehicle.ConductorName, vehicle.ConductorPhone, vehicle.GpsDeviceId, vehicle.InsuranceExpiry, vehicle.FitnessExpiry, vehicle.PollutionExpiry, vehicle.IsActive, vehicle.CreatedAt));
    }

    [HttpPut("vehicles/{id}")]
    public async Task<IActionResult> UpdateVehicle(Guid id, [FromBody] CreateTransportVehicleDto dto)
    {
        var vehicle = await _db.TransportVehicles.FindAsync(id); if (vehicle == null) return NotFound();
        vehicle.VehicleNumber = dto.VehicleNumber.Trim().ToUpper(); vehicle.VehicleType = dto.VehicleType; vehicle.TotalCapacity = dto.TotalCapacity; vehicle.Model = dto.Model; vehicle.Color = dto.Color; vehicle.DriverId = dto.DriverId; vehicle.ConductorName = dto.ConductorName; vehicle.ConductorPhone = dto.ConductorPhone; vehicle.GpsDeviceId = dto.GpsDeviceId; vehicle.InsuranceExpiry = dto.InsuranceExpiry; vehicle.FitnessExpiry = dto.FitnessExpiry; vehicle.PollutionExpiry = dto.PollutionExpiry;
        await _db.SaveChangesAsync(); return NoContent();
    }

    [HttpPatch("vehicles/{id}/toggle-active")]
    public async Task<IActionResult> ToggleVehicleActive(Guid id) { var v = await _db.TransportVehicles.FindAsync(id); if (v == null) return NotFound(); v.IsActive = !v.IsActive; await _db.SaveChangesAsync(); return Ok(new { v.IsActive }); }

    // =========================================================================
    // 4. Routes CRUD
    // =========================================================================

    [HttpGet("routes")]
    public async Task<ActionResult<IEnumerable<TransportRouteDto>>> GetRoutes([FromQuery] bool includeStops = false, [FromQuery] bool includeInactive = false)
    {
        var query = _db.TransportRoutes.AsNoTracking().Include(r => r.Vehicle).ThenInclude(v => v!.Driver).Include(r => r.Stops).Include(r => r.Allocations);
        var routes = await (includeInactive ? query : query.Where(r => r.IsActive)).OrderBy(r => r.RouteCode).ToListAsync();
        return Ok(routes.Select(r => new TransportRouteDto(r.Id, r.RouteCode, r.RouteName, r.StartPoint, r.EndPoint, r.VehicleId, r.Vehicle?.VehicleNumber, r.Vehicle?.Driver?.FullName, r.Vehicle?.Driver?.PhoneNumber, r.Description, r.MorningDepartureTime, r.EveningDepartureTime, r.IsActive, r.CreatedAt, r.Stops.Count(s => s.IsActive), r.Allocations.Count(a => a.Status == "Active"), includeStops ? r.Stops.Where(s => s.IsActive).OrderBy(s => s.StopOrder).Select(s => new TransportRouteStopDto(s.Id, s.RouteId, r.RouteName, s.StopName, s.StopOrder, s.PickupTime, s.DropTime, s.MonthlyFare, s.QuarterlyFare, s.HalfYearlyFare, s.AnnualFare, s.Landmark, s.DistanceKm, s.IsActive, r.Allocations.Count(a => a.RouteStopId == s.Id && a.Status == "Active"))).ToList() : null)));
    }

    [HttpGet("routes/{id}")]
    public async Task<ActionResult<TransportRouteDto>> GetRoute(Guid id)
    {
        var r = await _db.TransportRoutes.AsNoTracking().Include(r => r.Vehicle).ThenInclude(v => v!.Driver).Include(r => r.Stops).Include(r => r.Allocations).FirstOrDefaultAsync(r => r.Id == id);
        if (r == null) return NotFound();
        return Ok(new TransportRouteDto(r.Id, r.RouteCode, r.RouteName, r.StartPoint, r.EndPoint, r.VehicleId, r.Vehicle?.VehicleNumber, r.Vehicle?.Driver?.FullName, r.Vehicle?.Driver?.PhoneNumber, r.Description, r.MorningDepartureTime, r.EveningDepartureTime, r.IsActive, r.CreatedAt, r.Stops.Count(s => s.IsActive), r.Allocations.Count(a => a.Status == "Active"), r.Stops.Where(s => s.IsActive).OrderBy(s => s.StopOrder).Select(s => new TransportRouteStopDto(s.Id, s.RouteId, r.RouteName, s.StopName, s.StopOrder, s.PickupTime, s.DropTime, s.MonthlyFare, s.QuarterlyFare, s.HalfYearlyFare, s.AnnualFare, s.Landmark, s.DistanceKm, s.IsActive, r.Allocations.Count(a => a.RouteStopId == s.Id && a.Status == "Active"))).ToList()));
    }

    [HttpPost("routes")]
    public async Task<ActionResult<TransportRouteDto>> CreateRoute([FromBody] CreateTransportRouteDto dto)
    {
        var route = new TransportRoute { TenantId = _currentUser.TenantId, BranchId = _currentUser.BranchId, RouteCode = dto.RouteCode.Trim().ToUpper(), RouteName = dto.RouteName.Trim(), StartPoint = dto.StartPoint, EndPoint = dto.EndPoint, VehicleId = dto.VehicleId, Description = dto.Description, MorningDepartureTime = dto.MorningDepartureTime, EveningDepartureTime = dto.EveningDepartureTime, IsActive = true };
        _db.TransportRoutes.Add(route); await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetRoute), new { id = route.Id }, new TransportRouteDto(route.Id, route.RouteCode, route.RouteName, route.StartPoint, route.EndPoint, route.VehicleId, null, null, null, route.Description, route.MorningDepartureTime, route.EveningDepartureTime, route.IsActive, route.CreatedAt));
    }

    [HttpPut("routes/{id}")]
    public async Task<IActionResult> UpdateRoute(Guid id, [FromBody] CreateTransportRouteDto dto)
    {
        var route = await _db.TransportRoutes.FindAsync(id); if (route == null) return NotFound();
        route.RouteCode = dto.RouteCode.Trim().ToUpper(); route.RouteName = dto.RouteName.Trim(); route.StartPoint = dto.StartPoint; route.EndPoint = dto.EndPoint; route.VehicleId = dto.VehicleId; route.Description = dto.Description; route.MorningDepartureTime = dto.MorningDepartureTime; route.EveningDepartureTime = dto.EveningDepartureTime;
        await _db.SaveChangesAsync(); return NoContent();
    }

    [HttpPatch("routes/{id}/toggle-active")]
    public async Task<IActionResult> ToggleRouteActive(Guid id) { var r = await _db.TransportRoutes.FindAsync(id); if (r == null) return NotFound(); r.IsActive = !r.IsActive; await _db.SaveChangesAsync(); return Ok(new { r.IsActive }); }

    // =========================================================================
    // 5. Route Stops CRUD
    // =========================================================================

    [HttpGet("routes/{routeId}/stops")]
    public async Task<ActionResult<IEnumerable<TransportRouteStopDto>>> GetStops(Guid routeId)
    {
        var route = await _db.TransportRoutes.AsNoTracking().FirstOrDefaultAsync(r => r.Id == routeId);
        if (route == null) return NotFound();
        var stops = await _db.TransportRouteStops.AsNoTracking().Where(s => s.RouteId == routeId && s.IsActive).OrderBy(s => s.StopOrder).ToListAsync();
        var allocationCounts = await _db.TransportAllocations.Where(a => a.RouteId == routeId && a.Status == "Active").GroupBy(a => a.RouteStopId).Select(g => new { StopId = g.Key, Count = g.Count() }).ToListAsync();
        return Ok(stops.Select(s => new TransportRouteStopDto(s.Id, s.RouteId, route.RouteName, s.StopName, s.StopOrder, s.PickupTime, s.DropTime, s.MonthlyFare, s.QuarterlyFare, s.HalfYearlyFare, s.AnnualFare, s.Landmark, s.DistanceKm, s.IsActive, allocationCounts.FirstOrDefault(c => c.StopId == s.Id)?.Count ?? 0)));
    }

    [HttpPost("routes/{routeId}/stops")]
    public async Task<ActionResult<TransportRouteStopDto>> CreateStop(Guid routeId, [FromBody] CreateTransportRouteStopDto dto)
    {
        var route = await _db.TransportRoutes.FindAsync(routeId); if (route == null) return NotFound(new { message = "Route not found" });
        var stop = new TransportRouteStop { TenantId = _currentUser.TenantId, RouteId = routeId, StopName = dto.StopName.Trim(), StopOrder = dto.StopOrder, PickupTime = dto.PickupTime, DropTime = dto.DropTime, MonthlyFare = dto.MonthlyFare, QuarterlyFare = dto.QuarterlyFare, HalfYearlyFare = dto.HalfYearlyFare, AnnualFare = dto.AnnualFare, Landmark = dto.Landmark, DistanceKm = dto.DistanceKm, IsActive = true };
        _db.TransportRouteStops.Add(stop); await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetStops), new { routeId }, new TransportRouteStopDto(stop.Id, stop.RouteId, route.RouteName, stop.StopName, stop.StopOrder, stop.PickupTime, stop.DropTime, stop.MonthlyFare, stop.QuarterlyFare, stop.HalfYearlyFare, stop.AnnualFare, stop.Landmark, stop.DistanceKm, stop.IsActive));
    }

    [HttpPut("stops/{stopId}")]
    public async Task<IActionResult> UpdateStop(Guid stopId, [FromBody] CreateTransportRouteStopDto dto)
    {
        var stop = await _db.TransportRouteStops.FindAsync(stopId); if (stop == null) return NotFound();
        stop.StopName = dto.StopName.Trim(); stop.StopOrder = dto.StopOrder; stop.PickupTime = dto.PickupTime; stop.DropTime = dto.DropTime; stop.MonthlyFare = dto.MonthlyFare; stop.QuarterlyFare = dto.QuarterlyFare; stop.HalfYearlyFare = dto.HalfYearlyFare; stop.AnnualFare = dto.AnnualFare; stop.Landmark = dto.Landmark; stop.DistanceKm = dto.DistanceKm;
        await _db.SaveChangesAsync(); return NoContent();
    }

    [HttpDelete("stops/{stopId}")]
    public async Task<IActionResult> DeleteStop(Guid stopId)
    {
        var stop = await _db.TransportRouteStops.FindAsync(stopId); if (stop == null) return NotFound();
        var hasAllocations = await _db.TransportAllocations.AnyAsync(a => a.RouteStopId == stopId && a.Status == "Active");
        if (hasAllocations) return BadRequest(new { message = "Cannot delete stop with active allocations." });
        stop.IsActive = false; await _db.SaveChangesAsync(); return NoContent();
    }

    // =========================================================================
    // 6. Transport Allocations
    // =========================================================================

    [HttpGet("allocations")]
    public async Task<ActionResult<IEnumerable<TransportAllocationDto>>> GetAllocations([FromQuery] string? memberType = null, [FromQuery] Guid? routeId = null, [FromQuery] string? status = "Active", [FromQuery] string? search = null)
    {
        var query = _db.TransportAllocations.AsNoTracking()
            .Include(a => a.Student).ThenInclude(s => s!.Class)
            .Include(a => a.Student).ThenInclude(s => s!.Section)
            .Include(a => a.Student).ThenInclude(s => s!.Batch)
            .Include(a => a.Teacher)
            .Include(a => a.Route)
            .Include(a => a.Stop)
            .Include(a => a.Vehicle)
            .AsQueryable();

        if (!string.IsNullOrEmpty(memberType)) query = query.Where(a => a.MemberType == memberType);
        if (routeId.HasValue) query = query.Where(a => a.RouteId == routeId.Value);
        if (!string.IsNullOrEmpty(status) && status != "All") query = query.Where(a => a.Status == status);
        if (!string.IsNullOrEmpty(search)) { var term = search.ToLower(); query = query.Where(a => (a.Student != null && a.Student.StudentName.ToLower().Contains(term)) || (a.Teacher != null && a.Teacher.FullName.ToLower().Contains(term)) || a.Route.RouteName.ToLower().Contains(term) || a.Stop.StopName.ToLower().Contains(term)); }
        var allocations = await query.OrderByDescending(a => a.CreatedAt).ToListAsync();
        return Ok(allocations.Select(a => MapAllocationDto(a)));
    }

    [HttpGet("allocations/{id}")]
    public async Task<ActionResult<TransportAllocationDto>> GetAllocation(Guid id)
    {
        var a = await _db.TransportAllocations.AsNoTracking()
            .Include(a => a.Student).ThenInclude(s => s!.Class)
            .Include(a => a.Student).ThenInclude(s => s!.Section)
            .Include(a => a.Student).ThenInclude(s => s!.Batch)
            .Include(a => a.Teacher)
            .Include(a => a.Route)
            .Include(a => a.Stop)
            .Include(a => a.Vehicle)
            .FirstOrDefaultAsync(a => a.Id == id);
        if (a == null) return NotFound(); return Ok(MapAllocationDto(a));
    }

    [HttpPost("allocate")]
    public async Task<ActionResult<TransportAllocationDto>> AllocateTransport([FromBody] CreateTransportAllocationDto dto)
    {
        if (dto.MemberType == "Student") { if (!dto.StudentId.HasValue) return BadRequest(new { message = "StudentId required." }); var s = await _db.Students.FindAsync(dto.StudentId.Value); if (s == null) return BadRequest(new { message = "Student not found." }); }
        else if (dto.MemberType == "Teacher") { if (!dto.TeacherId.HasValue) return BadRequest(new { message = "TeacherId required." }); var t = await _db.Teachers.FindAsync(dto.TeacherId.Value); if (t == null) return BadRequest(new { message = "Teacher not found." }); }
        else return BadRequest(new { message = "MemberType must be 'Student' or 'Teacher'." });

        var route = await _db.TransportRoutes.FindAsync(dto.RouteId); if (route == null) return BadRequest(new { message = "Route not found." });
        var stop = await _db.TransportRouteStops.FindAsync(dto.RouteStopId); if (stop == null) return BadRequest(new { message = "Stop not found." });

        // Discontinue existing allocation
        var existingQuery = _db.TransportAllocations.Where(a => a.Status == "Active" && a.MemberType == dto.MemberType);
        if (dto.MemberType == "Student") existingQuery = existingQuery.Where(a => a.StudentId == dto.StudentId);
        else existingQuery = existingQuery.Where(a => a.TeacherId == dto.TeacherId);
        var existing = await existingQuery.FirstOrDefaultAsync();
        if (existing != null) { existing.Status = "Discontinued"; existing.EffectiveTo = DateTime.UtcNow; }

        var allocation = new TransportAllocation { TenantId = _currentUser.TenantId, BranchId = _currentUser.BranchId, MemberType = dto.MemberType, StudentId = dto.StudentId, TeacherId = dto.TeacherId, RouteId = dto.RouteId, RouteStopId = dto.RouteStopId, VehicleId = dto.VehicleId ?? route.VehicleId, PickupDropType = dto.PickupDropType, MonthlyFare = dto.MonthlyFare, IsFreeAllocation = dto.IsFreeAllocation, EffectiveFrom = dto.EffectiveFrom, Status = "Active", Remarks = dto.Remarks };
        _db.TransportAllocations.Add(allocation);

        if (dto.MemberType == "Student") { var s = await _db.Students.FindAsync(dto.StudentId!.Value); s!.IsTransportStudent = true; s.TransportAllocationId = allocation.Id; }
        else { var t = await _db.Teachers.FindAsync(dto.TeacherId!.Value); t!.IsTransportStaff = true; t.TransportAllocationId = allocation.Id; }

        await _db.SaveChangesAsync();
        var result = await _db.TransportAllocations.AsNoTracking()
            .Include(a => a.Student).ThenInclude(s => s!.Class)
            .Include(a => a.Student).ThenInclude(s => s!.Section)
            .Include(a => a.Student).ThenInclude(s => s!.Batch)
            .Include(a => a.Teacher)
            .Include(a => a.Route)
            .Include(a => a.Stop)
            .Include(a => a.Vehicle)
            .FirstOrDefaultAsync(a => a.Id == allocation.Id);
        return CreatedAtAction(nameof(GetAllocation), new { id = allocation.Id }, MapAllocationDto(result!));
    }

    [HttpPatch("allocations/{id}/discontinue")]
    public async Task<IActionResult> DiscontinueAllocation(Guid id)
    {
        var allocation = await _db.TransportAllocations.FindAsync(id); if (allocation == null) return NotFound();
        if (allocation.Status != "Active") return BadRequest(new { message = "Only active allocations can be discontinued." });
        allocation.Status = "Discontinued"; allocation.EffectiveTo = DateTime.UtcNow;
        if (allocation.MemberType == "Student" && allocation.StudentId.HasValue) { var s = await _db.Students.FindAsync(allocation.StudentId.Value); if (s != null) { s.IsTransportStudent = false; s.TransportAllocationId = null; } }
        else if (allocation.MemberType == "Teacher" && allocation.TeacherId.HasValue) { var t = await _db.Teachers.FindAsync(allocation.TeacherId.Value); if (t != null) { t.IsTransportStaff = false; t.TransportAllocationId = null; } }
        await _db.SaveChangesAsync(); return Ok(new { message = "Allocation discontinued." });
    }

    // =========================================================================
    // 7. Bus Pass
    // =========================================================================

    [HttpGet("allocations/{id}/bus-pass")]
    public async Task<ActionResult<TransportBusPassDto>> GetBusPass(Guid id)
    {
        var a = await _db.TransportAllocations.AsNoTracking()
            .Include(a => a.Student).ThenInclude(s => s!.Class)
            .Include(a => a.Student).ThenInclude(s => s!.Section)
            .Include(a => a.Student).ThenInclude(s => s!.Batch)
            .Include(a => a.Teacher)
            .Include(a => a.Route)
            .Include(a => a.Stop)
            .Include(a => a.Vehicle).ThenInclude(v => v!.Driver)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (a == null) return NotFound();
        var tenant = await _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == _currentUser.TenantId);
        string memberName = a.MemberType == "Student" ? a.Student?.StudentName ?? "" : a.Teacher?.FullName ?? "";
        
        string? code = a.MemberType == "Student" 
            ? GetStudentRollCode(a.Student)
            : a.Teacher?.EmployeeCode;

        string? classOrBatch = null;
        if (a.MemberType == "Student" && a.Student != null)
        {
            var parts = new List<string>();
            if (a.Student.Class != null)
                parts.Add(a.Student.Section != null ? $"{a.Student.Class.Name} - {a.Student.Section.Name}" : a.Student.Class.Name);
            if (a.Student.Batch != null)
                parts.Add($"Batch: {a.Student.Batch.Name}");
            classOrBatch = parts.Count > 0 ? string.Join(" • ", parts) : "Enrolled Student";
        }
        else if (a.Teacher != null)
        {
            classOrBatch = a.Teacher.Specialization ?? "Faculty Member";
        }

        string? photo = a.MemberType == "Student" ? a.Student?.ProfilePhoto : a.Teacher?.PhotoUrl;
        string? contact = a.MemberType == "Student" ? a.Student?.ParentWhatsAppPhone : a.Teacher?.PhoneNumber;
        string qr = $"BUSPASS:{a.Id}|{a.MemberType}|{memberName}|Roll:{code}|Route:{a.Route?.RouteCode}|Stop:{a.Stop?.StopName}";
        return Ok(new TransportBusPassDto(a.Id, a.MemberType, memberName, code, classOrBatch, photo, contact, a.Route?.RouteName ?? "", a.Route?.RouteCode ?? "", a.Stop?.StopName ?? "", a.Stop?.PickupTime, a.Stop?.DropTime, a.Vehicle?.VehicleNumber ?? "N/A", a.Vehicle?.Driver?.FullName, a.Vehicle?.Driver?.PhoneNumber, a.PickupDropType, a.EffectiveFrom, tenant?.Name ?? "Institution", null, qr));
    }

    // =========================================================================
    // 8. Boarding Manifest
    // =========================================================================

    [HttpGet("routes/{routeId}/manifest")]
    public async Task<ActionResult<BusBoardingManifestDto>> GetManifest(Guid routeId, [FromQuery] string departureType = "Morning")
    {
        var route = await _db.TransportRoutes.AsNoTracking().Include(r => r.Vehicle).ThenInclude(v => v!.Driver).FirstOrDefaultAsync(r => r.Id == routeId);
        if (route == null) return NotFound();
        var allocations = await _db.TransportAllocations.AsNoTracking()
            .Include(a => a.Student).ThenInclude(s => s!.Class)
            .Include(a => a.Student).ThenInclude(s => s!.Section)
            .Include(a => a.Student).ThenInclude(s => s!.Batch)
            .Include(a => a.Teacher)
            .Include(a => a.Stop)
            .Where(a => a.RouteId == routeId && a.Status == "Active")
            .OrderBy(a => a.Stop!.StopOrder)
            .ToListAsync();

        if (departureType == "Morning") allocations = allocations.Where(a => a.PickupDropType == "Both" || a.PickupDropType == "PickupOnly").ToList();
        else allocations = allocations.Where(a => a.PickupDropType == "Both" || a.PickupDropType == "DropOnly").ToList();
        
        var today = DateTime.UtcNow.Date;
        var todayAttendances = await _db.TransportAttendances.AsNoTracking()
            .Where(t => t.RouteId == routeId && t.AttendanceDate == today && t.DepartureType == departureType)
            .ToListAsync();

        int srNo = 1;
        var passengers = allocations.Select(a =>
        {
            var s = a.Student;
            var t = a.Teacher;
            string name = a.MemberType == "Student" ? s?.StudentName ?? "" : t?.FullName ?? "";
            string? code = a.MemberType == "Student"
                ? GetStudentRollCode(s)
                : t?.EmployeeCode;

            string? classInfo = null;
            if (a.MemberType == "Student" && s != null)
            {
                var parts = new List<string>();
                if (s.Class != null)
                    parts.Add(s.Section != null ? $"{s.Class.Name} - {s.Section.Name}" : s.Class.Name);
                if (s.Batch != null)
                    parts.Add(s.Batch.Name);
                classInfo = parts.Count > 0 ? string.Join(" • ", parts) : null;
            }
            else if (t != null)
            {
                classInfo = t.Specialization ?? "Faculty Member";
            }

            string stopName = a.Stop?.StopName ?? "Campus Stop";
            string? scheduledTime = departureType == "Morning"
                ? (!string.IsNullOrWhiteSpace(a.Stop?.PickupTime) ? a.Stop.PickupTime : route.MorningDepartureTime)
                : (!string.IsNullOrWhiteSpace(a.Stop?.DropTime) ? a.Stop.DropTime : route.EveningDepartureTime);

            string? phone = a.MemberType == "Student" ? s?.ParentWhatsAppPhone : t?.PhoneNumber;

            bool isBoarded = todayAttendances.Any(att =>
                att.MemberType == a.MemberType &&
                ((a.StudentId.HasValue && att.StudentId == a.StudentId) ||
                 (a.TeacherId.HasValue && att.TeacherId == a.TeacherId) ||
                 att.PassengerName.ToLower() == name.ToLower()) &&
                att.IsBoarded);

            return new BusBoardingManifestRowDto(srNo++, a.MemberType, name, code, classInfo, stopName, scheduledTime, phone, isBoarded, isBoarded);
        }).ToList();

        return Ok(new BusBoardingManifestDto(route.Id, route.RouteCode, route.RouteName, route.Vehicle?.VehicleNumber ?? "N/A", route.Vehicle?.Driver?.FullName, route.Vehicle?.Driver?.PhoneNumber, route.Vehicle?.ConductorName, DateTime.UtcNow.ToString("dd MMM yyyy"), departureType, passengers.Count, passengers));
    }

    [HttpPost("routes/{routeId}/manifest/save-attendance")]
    public async Task<IActionResult> SaveBoardingAttendance(Guid routeId, [FromBody] SaveBoardingAttendanceDto dto)
    {
        var route = await _db.TransportRoutes.Include(r => r.Vehicle).FirstOrDefaultAsync(r => r.Id == routeId);
        if (route == null) return NotFound(new { message = "Route not found." });

        var allocations = await _db.TransportAllocations.AsNoTracking()
            .Include(a => a.Student)
            .Include(a => a.Teacher)
            .Where(a => a.RouteId == routeId && a.Status == "Active")
            .ToListAsync();

        var today = DateTime.UtcNow.Date;
        var existingAttendances = await _db.TransportAttendances
            .Where(t => t.RouteId == routeId && t.AttendanceDate == today && t.DepartureType == dto.DepartureType)
            .ToListAsync();

        foreach (var p in dto.Passengers)
        {
            var alloc = allocations.FirstOrDefault(a =>
                a.MemberType == p.MemberType &&
                ((a.MemberType == "Student" && a.Student != null && (a.Student.StudentName.ToLower() == p.Name.ToLower() || (!string.IsNullOrWhiteSpace(p.Code) && a.Student.RollNumber == p.Code))) ||
                 (a.MemberType == "Teacher" && a.Teacher != null && (a.Teacher.FullName.ToLower() == p.Name.ToLower() || (!string.IsNullOrWhiteSpace(p.Code) && a.Teacher.EmployeeCode == p.Code)))));

            var rec = existingAttendances.FirstOrDefault(r =>
                r.MemberType == p.MemberType &&
                ((alloc != null && alloc.StudentId.HasValue && r.StudentId == alloc.StudentId) ||
                 (alloc != null && alloc.TeacherId.HasValue && r.TeacherId == alloc.TeacherId) ||
                 r.PassengerName.ToLower() == p.Name.ToLower()));

            if (rec == null)
            {
                rec = new TransportAttendance
                {
                    TenantId = _currentUser.TenantId,
                    BranchId = _currentUser.BranchId,
                    RouteId = routeId,
                    MemberType = p.MemberType,
                    StudentId = alloc?.StudentId,
                    TeacherId = alloc?.TeacherId,
                    PassengerName = p.Name,
                    PassengerCode = p.Code,
                    StopName = p.StopName,
                    AttendanceDate = today,
                    DepartureType = dto.DepartureType,
                    IsBoarded = p.IsBoarded,
                    BoardedAt = p.IsBoarded ? DateTime.UtcNow : null,
                    MarkedBy = _currentUser.UserId.ToString()
                };
                _db.TransportAttendances.Add(rec);
            }
            else
            {
                rec.IsBoarded = p.IsBoarded;
                rec.BoardedAt = p.IsBoarded ? (rec.BoardedAt ?? DateTime.UtcNow) : null;
                rec.PassengerCode = p.Code;
                rec.StopName = p.StopName;
                rec.MarkedBy = _currentUser.UserId.ToString();
            }
        }

        await _db.SaveChangesAsync();

        int boardedCount = dto.Passengers.Count(p => p.IsBoarded);
        int totalCount = dto.Passengers.Count;

        if (dto.SendWhatsAppAlerts)
        {
            var boardedStudents = dto.Passengers.Where(p => p.IsBoarded && !string.IsNullOrWhiteSpace(p.Phone)).ToList();
            foreach (var student in boardedStudents)
            {
                await _whatsAppService.SendTransportBoardingAlertAsync(
                    _currentUser.TenantId,
                    student.Phone!,
                    student.Name,
                    route.Vehicle?.VehicleNumber ?? route.RouteCode,
                    student.StopName,
                    DateTime.Now.ToString("hh:mm tt"),
                    dto.DepartureType
                );
            }
        }

        return Ok(new
        {
            message = $"Boarding attendance saved successfully for {dto.DepartureType} run. ({boardedCount}/{totalCount} Boarded)",
            routeId,
            departureType = dto.DepartureType,
            date = DateTime.UtcNow.ToString("dd MMM yyyy"),
            totalCount,
            boardedCount,
            absentCount = totalCount - boardedCount,
            savedAt = DateTime.UtcNow
        });
    }

    [HttpPost("routes/{routeId}/manifest/notify-parents")]
    public async Task<IActionResult> NotifyBoardedParents(Guid routeId, [FromBody] NotifyBoardingParentsDto dto)
    {
        var route = await _db.TransportRoutes.Include(r => r.Vehicle).FirstOrDefaultAsync(r => r.Id == routeId);
        if (route == null) return NotFound(new { message = "Route not found." });

        int sentCount = 0;
        foreach (var student in dto.Passengers.Where(p => p.IsBoarded && !string.IsNullOrWhiteSpace(p.Phone)))
        {
            var sent = await _whatsAppService.SendTransportBoardingAlertAsync(
                _currentUser.TenantId,
                student.Phone!,
                student.Name,
                route.Vehicle?.VehicleNumber ?? route.RouteCode,
                student.StopName,
                DateTime.Now.ToString("hh:mm tt"),
                dto.DepartureType
            );
            if (sent) sentCount++;
        }

        return Ok(new
        {
            message = $"Safe transit WhatsApp alerts dispatched to parents of {sentCount} boarded commuter(s).",
            sentCount
        });
    }

    [HttpPost("verify-pass-qr")]
    public async Task<IActionResult> VerifyPassQr([FromBody] VerifyPassQrRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.QrPayload))
            return BadRequest(new { message = "QR Payload is required." });

        var raw = dto.QrPayload.Trim();
        if (raw.StartsWith("BUSPASS:"))
            raw = raw.Substring("BUSPASS:".Length);

        var segments = raw.Split('|');
        string? allocIdStr = segments.Length > 0 ? segments[0] : null;
        string? memberType = segments.Length > 1 ? segments[1] : null;
        string? memberName = segments.Length > 2 ? segments[2] : null;

        Guid? allocGuid = Guid.TryParse(allocIdStr, out var parsedGuid) ? parsedGuid : null;
        TransportAllocation? alloc = null;
        if (allocGuid.HasValue)
        {
            alloc = await _db.TransportAllocations.AsNoTracking()
                .Include(a => a.Student)
                .Include(a => a.Teacher)
                .Include(a => a.Route)
                .Include(a => a.Stop)
                .Include(a => a.Vehicle)
                .FirstOrDefaultAsync(a => a.Id == allocGuid.Value);
        }

        if (alloc != null)
        {
            string studentOrEmpCode = alloc.MemberType == "Student"
                ? (!string.IsNullOrWhiteSpace(alloc.Student?.RollNumber) ? alloc.Student.RollNumber : (alloc.Student?.CoachingRollNumber ?? alloc.Student?.SchoolRollNumber ?? alloc.Student?.AdmissionNumber ?? ""))
                : (alloc.Teacher?.EmployeeCode ?? "");

            return Ok(new
            {
                success = true,
                allocationId = alloc.Id,
                memberType = alloc.MemberType,
                name = alloc.MemberType == "Student" ? alloc.Student?.StudentName : alloc.Teacher?.FullName,
                code = studentOrEmpCode,
                routeId = alloc.RouteId,
                routeCode = alloc.Route?.RouteCode,
                stopName = alloc.Stop?.StopName,
                vehicleNumber = alloc.Vehicle?.VehicleNumber,
                status = alloc.Status
            });
        }

        return Ok(new
        {
            success = true,
            memberType = memberType ?? "Student",
            name = memberName ?? "Commuter",
            code = segments.FirstOrDefault(s => s.StartsWith("Roll:"))?.Replace("Roll:", ""),
            routeCode = segments.FirstOrDefault(s => s.StartsWith("Route:"))?.Replace("Route:", ""),
            stopName = segments.FirstOrDefault(s => s.StartsWith("Stop:"))?.Replace("Stop:", "")
        });
    }

    // =========================================================================
    // 9. Campus Gate Passes
    // =========================================================================

    [HttpGet("gate-passes")]
    public async Task<ActionResult<IEnumerable<CampusGatePassDto>>> GetGatePasses([FromQuery] string? passType = null, [FromQuery] string? status = null, [FromQuery] string? search = null, [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 20)
    {
        var query = _db.CampusGatePasses.AsNoTracking().Include(g => g.Student).Include(g => g.Teacher).Include(g => g.Vehicle).AsQueryable();
        if (!string.IsNullOrEmpty(passType)) query = query.Where(g => g.PassType == passType);
        if (!string.IsNullOrEmpty(status)) query = query.Where(g => g.Status == status);
        if (!string.IsNullOrEmpty(search)) { var term = search.ToLower(); query = query.Where(g => g.PassNumber.ToLower().Contains(term) || (g.Student != null && g.Student.StudentName.ToLower().Contains(term)) || (g.Teacher != null && g.Teacher.FullName.ToLower().Contains(term)) || (g.PersonName != null && g.PersonName.ToLower().Contains(term))); }
        var passes = await query.OrderByDescending(g => g.CreatedAt).Skip((pageIndex - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(passes.Select(g => MapGatePassDto(g)));
    }

    [HttpPost("gate-passes")]
    public async Task<ActionResult<CampusGatePassDto>> CreateGatePass([FromBody] CreateCampusGatePassDto dto)
    {
        var passNumber = $"CGP-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}";
        var pass = new CampusGatePass { TenantId = _currentUser.TenantId, BranchId = _currentUser.BranchId, PassType = dto.PassType, PassNumber = passNumber, StudentId = dto.StudentId, TeacherId = dto.TeacherId, VehicleId = dto.VehicleId, PersonName = dto.PersonName, ContactNumber = dto.ContactNumber, Purpose = dto.Purpose, OutDateTime = dto.OutDateTime, ExpectedInDateTime = dto.ExpectedInDateTime, ApprovedBy = dto.ApprovedBy, SecurityGuardName = dto.SecurityGuardName, PassengerCount = dto.PassengerCount, Status = "Issued", Remarks = dto.Remarks };
        _db.CampusGatePasses.Add(pass); await _db.SaveChangesAsync();
        var result = await _db.CampusGatePasses.AsNoTracking().Include(g => g.Student).Include(g => g.Teacher).Include(g => g.Vehicle).FirstOrDefaultAsync(g => g.Id == pass.Id);
        return CreatedAtAction(nameof(GetGatePasses), new { id = pass.Id }, MapGatePassDto(result!));
    }

    [HttpPatch("gate-passes/{id}/close")]
    public async Task<IActionResult> CloseGatePass(Guid id, [FromBody] CloseGatePassDto dto)
    {
        var pass = await _db.CampusGatePasses.FindAsync(id); if (pass == null) return NotFound();
        if (pass.Status == "Closed") return BadRequest(new { message = "Already closed." });
        pass.ActualInDateTime = dto.ActualInDateTime ?? DateTime.UtcNow; pass.Status = "Closed"; if (dto.Remarks != null) pass.Remarks = dto.Remarks;
        await _db.SaveChangesAsync(); return Ok(new { message = "Gate pass closed.", pass.PassNumber, pass.ActualInDateTime });
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    private static string? GetStudentRollCode(Student? s)
    {
        if (s == null) return null;
        var rollParts = new List<string>();
        if (!string.IsNullOrWhiteSpace(s.SchoolRollNumber))
            rollParts.Add($"Sch: {s.SchoolRollNumber.Trim()}");
        if (!string.IsNullOrWhiteSpace(s.CoachingRollNumber))
            rollParts.Add($"Cch: {s.CoachingRollNumber.Trim()}");

        if (rollParts.Count > 0)
            return string.Join(" • ", rollParts);

        if (!string.IsNullOrWhiteSpace(s.RollNumber))
            return s.RollNumber.Trim();

        if (!string.IsNullOrWhiteSpace(s.AdmissionNumber))
            return s.AdmissionNumber.Trim();

        return null;
    }

    private static TransportAllocationDto MapAllocationDto(TransportAllocation a)
    {
        var s = a.Student;
        string? rollNo = s != null
            ? GetStudentRollCode(s)
            : null;
        string? studentClass = s?.Class != null
            ? (s.Section != null ? $"{s.Class.Name} - {s.Section.Name}" : s.Class.Name)
            : null;
        string? studentBatch = s?.Batch?.Name;
        string? admNo = s?.AdmissionNumber;
        return new TransportAllocationDto(
            a.Id, a.MemberType, a.StudentId, s?.StudentName, rollNo, studentClass,
            a.TeacherId, a.Teacher?.FullName, a.Teacher?.EmployeeCode,
            a.RouteId, a.Route?.RouteName ?? "", a.Route?.RouteCode ?? "",
            a.RouteStopId, a.Stop?.StopName ?? "", a.Stop?.PickupTime, a.Stop?.DropTime,
            a.VehicleId, a.Vehicle?.VehicleNumber, a.PickupDropType, a.MonthlyFare,
            a.IsFreeAllocation, a.EffectiveFrom, a.EffectiveTo, a.Status, a.Remarks, a.CreatedAt,
            studentBatch, admNo
        );
    }

    private static CampusGatePassDto MapGatePassDto(CampusGatePass g)
    {
        var s = g.Student;
        string? rollNo = s != null
            ? GetStudentRollCode(s)
            : null;
        string? studentClass = s?.Class != null
            ? (s.Section != null ? $"{s.Class.Name} - {s.Section.Name}" : s.Class.Name)
            : null;
        return new CampusGatePassDto(
            g.Id, g.PassType, g.PassNumber, g.StudentId, s?.StudentName, rollNo, studentClass,
            g.TeacherId, g.Teacher?.FullName, g.Teacher?.EmployeeCode,
            g.VehicleId, g.Vehicle?.VehicleNumber, g.PersonName, g.ContactNumber,
            g.Purpose, g.OutDateTime, g.ExpectedInDateTime, g.ActualInDateTime,
            g.ApprovedBy, g.SecurityGuardName, g.PassengerCount, g.Status, g.Remarks, g.CreatedAt
        );
    }
}

public record CloseGatePassDto(DateTime? ActualInDateTime, string? Remarks);

