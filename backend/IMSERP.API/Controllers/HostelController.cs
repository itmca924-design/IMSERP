using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class HostelController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public HostelController(IIMSERPDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    // =========================================================================
    // 1. Overview & Statistics
    // =========================================================================

    [HttpGet("overview")]
    public async Task<ActionResult<HostelOverviewSummaryDto>> GetOverview()
    {
        var totalHostels = await _db.Hostels.CountAsync(h => h.IsActive);
        var totalRooms = await _db.HostelRooms.CountAsync(r => r.IsActive);
        var totalBeds = await _db.HostelBeds.CountAsync(b => b.IsActive);
        var occupiedBeds = await _db.HostelBeds.CountAsync(b => b.IsActive && b.Status == "Occupied");
        var availableBeds = await _db.HostelBeds.CountAsync(b => b.IsActive && b.Status == "Available");
        var activeGatePasses = await _db.HostelGatePasses.CountAsync(g => g.WardenApprovalStatus == "Approved" && g.ActualReturnDate == null);
        var hostelerStudentsCount = await _db.Students.CountAsync(s => s.IsActive && s.IsHostelStudent);

        decimal occupancyRate = totalBeds > 0 ? Math.Round(((decimal)occupiedBeds / totalBeds) * 100, 1) : 0m;

        return Ok(new HostelOverviewSummaryDto(
            totalHostels,
            totalRooms,
            totalBeds,
            occupiedBeds,
            availableBeds,
            occupancyRate,
            activeGatePasses,
            hostelerStudentsCount
        ));
    }

    // =========================================================================
    // 2. Hostel Buildings / Blocks CRUD
    // =========================================================================

    [HttpGet]
    public async Task<ActionResult<IEnumerable<HostelDto>>> GetHostels()
    {
        var hostels = await _db.Hostels
            .AsNoTracking()
            .Include(h => h.Branch)
            .Include(h => h.Rooms)
                .ThenInclude(r => r.Beds)
            .OrderBy(h => h.Name)
            .ToListAsync();

        var result = hostels.Select(h =>
        {
            var totalBeds = h.Rooms.Where(r => r.IsActive).SelectMany(r => r.Beds).Count(b => b.IsActive);
            var occupiedBeds = h.Rooms.Where(r => r.IsActive).SelectMany(r => r.Beds).Count(b => b.IsActive && b.Status == "Occupied");
            var availableBeds = totalBeds - occupiedBeds;

            return new HostelDto(
                h.Id,
                h.TenantId,
                h.BranchId,
                h.Branch?.Name,
                h.Name,
                h.HostelType,
                h.Address,
                h.WardenName,
                h.WardenPhone,
                h.TotalFloors,
                h.Rooms.Count(r => r.IsActive),
                totalBeds,
                occupiedBeds,
                availableBeds,
                h.IsActive,
                h.CreatedAt
            );
        });

        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<HostelDto>> CreateHostel([FromBody] CreateHostelDto dto)
    {
        var targetBranchId = dto.BranchId ?? _currentUser.BranchId;

        var hostel = new Hostel
        {
            TenantId = _currentUser.TenantId,
            BranchId = targetBranchId,
            Name = dto.Name.Trim(),
            HostelType = dto.HostelType,
            Address = dto.Address,
            WardenName = dto.WardenName,
            WardenPhone = dto.WardenPhone,
            TotalFloors = dto.TotalFloors,
            IsActive = true
        };

        _db.Hostels.Add(hostel);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetHostels), new { id = hostel.Id }, new HostelDto(
            hostel.Id,
            hostel.TenantId,
            hostel.BranchId,
            null,
            hostel.Name,
            hostel.HostelType,
            hostel.Address,
            hostel.WardenName,
            hostel.WardenPhone,
            hostel.TotalFloors,
            0,
            0,
            0,
            0,
            hostel.IsActive,
            hostel.CreatedAt
        ));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateHostel(Guid id, [FromBody] CreateHostelDto dto)
    {
        var hostel = await _db.Hostels.FindAsync(id);
        if (hostel == null) return NotFound();

        hostel.Name = dto.Name.Trim();
        hostel.HostelType = dto.HostelType;
        hostel.Address = dto.Address;
        hostel.WardenName = dto.WardenName;
        hostel.WardenPhone = dto.WardenPhone;
        hostel.TotalFloors = dto.TotalFloors;
        if (dto.BranchId.HasValue) hostel.BranchId = dto.BranchId.Value;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Hostel updated successfully", id = hostel.Id });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteHostel(Guid id)
    {
        var hostel = await _db.Hostels
            .Include(h => h.Rooms)
                .ThenInclude(r => r.Beds)
            .FirstOrDefaultAsync(h => h.Id == id);

        if (hostel == null) return NotFound();

        bool hasOccupants = hostel.Rooms.Any(r => r.Beds.Any(b => b.Status == "Occupied"));
        if (hasOccupants)
        {
            return BadRequest(new { message = "Cannot delete hostel while it has occupied beds. Vacate beds first." });
        }

        hostel.IsActive = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // =========================================================================
    // 3. Rooms & Beds Management
    // =========================================================================

    [HttpGet("{hostelId}/rooms")]
    public async Task<ActionResult<IEnumerable<HostelRoomDto>>> GetRooms(Guid hostelId)
    {
        var rooms = await _db.HostelRooms
            .AsNoTracking()
            .Include(r => r.Hostel)
            .Include(r => r.Beds)
                .ThenInclude(b => b.CurrentStudent)
                    .ThenInclude(s => s != null ? s.Batch : null)
            .Include(r => r.Beds)
                .ThenInclude(b => b.CurrentStudent)
                    .ThenInclude(s => s != null ? s.Class : null)
            .Where(r => r.HostelId == hostelId && r.IsActive)
            .OrderBy(r => r.Floor).ThenBy(r => r.RoomNumber)
            .ToListAsync();

        var result = rooms.Select(r => new HostelRoomDto(
            r.Id,
            r.TenantId,
            r.BranchId,
            r.HostelId,
            r.Hostel?.Name ?? "",
            r.RoomNumber,
            r.Floor,
            r.RoomType,
            r.Capacity,
            r.MonthlyRent,
            r.HasAC,
            r.HasAttachedBath,
            r.Amenities,
            r.Status,
            r.Beds.Count(b => b.IsActive),
            r.Beds.Count(b => b.IsActive && b.Status == "Occupied"),
            r.Beds.Where(b => b.IsActive).Select(b => new HostelBedDto(
                b.Id,
                b.RoomId,
                r.RoomNumber,
                r.HostelId,
                r.Hostel?.Name ?? "",
                b.BedCode,
                b.Status,
                b.MonthlyRent,
                b.CurrentStudentId,
                b.CurrentStudent?.StudentName,
                b.CurrentStudent?.RollNumber,
                b.CurrentStudent?.ParentWhatsAppPhone,
                b.CurrentStudent?.Class?.Name ?? b.CurrentStudent?.Batch?.Name,
                b.CurrentStudent?.ProfilePhoto
            )).ToList()
        ));

        return Ok(result);
    }

    [HttpPost("rooms")]
    public async Task<ActionResult<HostelRoomDto>> CreateRoom([FromBody] CreateHostelRoomDto dto)
    {
        var hostel = await _db.Hostels.FindAsync(dto.HostelId);
        if (hostel == null) return BadRequest(new { message = "Hostel not found" });

        var room = new HostelRoom
        {
            TenantId = _currentUser.TenantId,
            BranchId = hostel.BranchId,
            HostelId = dto.HostelId,
            RoomNumber = dto.RoomNumber.Trim(),
            Floor = dto.Floor,
            RoomType = dto.RoomType,
            Capacity = dto.Capacity,
            MonthlyRent = dto.MonthlyRent,
            HasAC = dto.HasAC,
            HasAttachedBath = dto.HasAttachedBath,
            Amenities = dto.Amenities,
            Status = "Active",
            IsActive = true
        };

        _db.HostelRooms.Add(room);
        await _db.SaveChangesAsync();

        // Auto-generate Beds e.g. 101-A, 101-B
        if (dto.AutoGenerateBeds && dto.Capacity > 0)
        {
            char bedSuffix = 'A';
            for (int i = 0; i < dto.Capacity; i++)
            {
                var bedCode = $"{dto.RoomNumber.Trim()}-{(char)(bedSuffix + i)}";
                _db.HostelBeds.Add(new HostelBed
                {
                    TenantId = _currentUser.TenantId,
                    BranchId = hostel.BranchId,
                    RoomId = room.Id,
                    BedCode = bedCode,
                    Status = "Available",
                    MonthlyRent = dto.MonthlyRent,
                    IsActive = true
                });
            }
            await _db.SaveChangesAsync();
        }

        return Ok(new { message = "Room created successfully", roomId = room.Id, roomNumber = room.RoomNumber });
    }

    [HttpDelete("rooms/{id}")]
    public async Task<IActionResult> DeleteRoom(Guid id)
    {
        var room = await _db.HostelRooms
            .Include(r => r.Beds)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (room == null) return NotFound();

        if (room.Beds.Any(b => b.Status == "Occupied"))
        {
            return BadRequest(new { message = "Cannot delete room while it has occupied beds." });
        }

        room.IsActive = false;
        foreach (var bed in room.Beds)
        {
            bed.IsActive = false;
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // =========================================================================
    // 4. Visual Bed Matrix & Available Beds Dropdown
    // =========================================================================

    [HttpGet("bed-matrix")]
    public async Task<ActionResult> GetBedMatrix([FromQuery] Guid? hostelId = null)
    {
        var query = _db.HostelRooms
            .AsNoTracking()
            .Include(r => r.Hostel)
            .Include(r => r.Beds)
                .ThenInclude(b => b.CurrentStudent)
                    .ThenInclude(s => s != null ? s.Class : null)
            .Include(r => r.Beds)
                .ThenInclude(b => b.CurrentStudent)
                    .ThenInclude(s => s != null ? s.Batch : null)
            .Where(r => r.IsActive);

        if (hostelId.HasValue && hostelId.Value != Guid.Empty)
        {
            query = query.Where(r => r.HostelId == hostelId.Value);
        }

        var rooms = await query.OrderBy(r => r.Floor).ThenBy(r => r.RoomNumber).ToListAsync();

        var matrix = rooms.Select(r => new
        {
            roomId = r.Id,
            hostelId = r.HostelId,
            hostelName = r.Hostel?.Name,
            hostelType = r.Hostel?.HostelType,
            roomNumber = r.RoomNumber,
            floor = r.Floor,
            roomType = r.RoomType,
            capacity = r.Capacity,
            monthlyRent = r.MonthlyRent,
            hasAC = r.HasAC,
            hasAttachedBath = r.HasAttachedBath,
            amenities = r.Amenities,
            beds = r.Beds.Where(b => b.IsActive).Select(b => new
            {
                bedId = b.Id,
                bedCode = b.BedCode,
                status = b.Status, // Available, Occupied, Maintenance
                monthlyRent = b.MonthlyRent,
                studentId = b.CurrentStudentId,
                studentName = b.CurrentStudent?.StudentName,
                rollNumber = b.CurrentStudent?.RollNumber,
                phone = b.CurrentStudent?.ParentWhatsAppPhone,
                classOrBatch = b.CurrentStudent?.Class != null ? b.CurrentStudent.Class.Name : (b.CurrentStudent?.Batch != null ? b.CurrentStudent.Batch.Name : ""),
                profilePhoto = b.CurrentStudent?.ProfilePhoto,
                gender = b.CurrentStudent?.Gender,
                stream = (b.CurrentStudent?.IsSchoolStudent == true && b.CurrentStudent?.IsCoachingStudent == true) ? "School + Coaching" :
                         (b.CurrentStudent?.IsSchoolStudent == true ? "School" : "Coaching")
            }).ToList()
        });

        return Ok(matrix);
    }

    [HttpGet("available-beds")]
    public async Task<ActionResult<IEnumerable<HostelBedDto>>> GetAvailableBeds([FromQuery] Guid? hostelId = null, [FromQuery] Guid? includeBedId = null)
    {
        var query = _db.HostelBeds
            .AsNoTracking()
            .Include(b => b.Room)
                .ThenInclude(r => r.Hostel)
            .Where(b => b.IsActive && b.Room.IsActive && b.Room.Hostel.IsActive && (b.Status == "Available" || (includeBedId.HasValue && b.Id == includeBedId.Value)));

        if (hostelId.HasValue && hostelId.Value != Guid.Empty)
        {
            query = query.Where(b => b.Room.HostelId == hostelId.Value);
        }

        var beds = await query
            .OrderBy(b => b.Room.Hostel.Name)
            .ThenBy(b => b.Room.RoomNumber)
            .ThenBy(b => b.BedCode)
            .ToListAsync();

        var result = beds.Select(b => new HostelBedDto(
            b.Id,
            b.RoomId,
            b.Room.RoomNumber,
            b.Room.HostelId,
            b.Room.Hostel.Name,
            b.BedCode,
            b.Status,
            b.MonthlyRent,
            null,
            null,
            null,
            null,
            null,
            null
        ));

        return Ok(result);
    }

    // =========================================================================
    // 5. Allocation & Vacating
    // =========================================================================

    [HttpPost("allocate")]
    public async Task<IActionResult> AllocateBed([FromBody] AllocateBedDto dto)
    {
        var student = await _db.Students.FindAsync(dto.StudentId);
        if (student == null) return BadRequest(new { message = "Student not found" });

        var bed = await _db.HostelBeds.Include(b => b.Room).FirstOrDefaultAsync(b => b.Id == dto.BedId);
        if (bed == null) return BadRequest(new { message = "Bed not found" });

        if (bed.Status != "Available")
        {
            return BadRequest(new { message = $"Bed {bed.BedCode} is already {bed.Status}" });
        }

        // Check if student already has an active bed
        if (student.HostelBedId.HasValue && student.HostelBedId.Value != Guid.Empty)
        {
            var currentBed = await _db.HostelBeds.FindAsync(student.HostelBedId.Value);
            if (currentBed != null)
            {
                currentBed.Status = "Available";
                currentBed.CurrentStudentId = null;
            }

            var activeAlloc = await _db.HostelAllocations
                .FirstOrDefaultAsync(a => a.StudentId == student.Id && a.Status == "Active");
            if (activeAlloc != null)
            {
                activeAlloc.Status = "Transferred";
                activeAlloc.VacatedDate = DateTime.UtcNow;
            }
        }

        // Allocate new bed
        bed.Status = "Occupied";
        bed.CurrentStudentId = student.Id;

        student.IsHostelStudent = true;
        student.HostelBedId = bed.Id;

        var rent = dto.MonthlyRent ?? bed.MonthlyRent;
        var allocation = new HostelAllocation
        {
            TenantId = _currentUser.TenantId,
            BranchId = student.BranchId,
            StudentId = student.Id,
            BedId = bed.Id,
            AllocatedDate = dto.AllocatedDate ?? DateTime.UtcNow,
            MonthlyRent = rent,
            IsMessIncluded = dto.IsMessIncluded,
            MessPlan = dto.MessPlan,
            MonthlyMessFee = dto.MonthlyMessFee,
            Status = "Active",
            Remarks = dto.Remarks
        };

        _db.HostelAllocations.Add(allocation);
        await _db.SaveChangesAsync();

        // ── Immediate First-Month Invoice ──────────────────────────────────────
        // Generate a hostel fee invoice for the current month immediately so the
        // parent can settle at the admission counter without waiting for bulk generation.
        try
        {
            var now = DateTime.UtcNow;
            var periodStart = new DateTime(now.Year, now.Month, 1);
            var periodEnd   = periodStart.AddMonths(1).AddDays(-1);

            // Skip if an active invoice already exists this month for this student
            bool invoiceAlreadyExists = await _db.FeeInvoices.AnyAsync(i =>
                i.StudentId == student.Id &&
                i.DueDate >= periodStart &&
                i.DueDate <= periodEnd &&
                i.Status != InvoiceStatus.Cancelled);

            if (!invoiceAlreadyExists && (rent > 0 || dto.MonthlyMessFee > 0))
            {
                var residentialHeads = await _db.FeeHeads
                    .AsNoTracking()
                    .Where(h => h.IsActive && (h.Code == "HOSTEL" || h.Code == "MESS"))
                    .ToListAsync();

                Guid? hostelHeadId = residentialHeads.FirstOrDefault(h => h.Code == "HOSTEL")?.Id;
                Guid? messHeadId   = residentialHeads.FirstOrDefault(h => h.Code == "MESS")?.Id;

                var roomNumber = bed.Room?.RoomNumber ?? "Room";
                var bedCode    = bed.BedCode;

                var hostelItems = new List<FeeInvoiceItem>();
                decimal hostelTotal = 0;

                if (rent > 0)
                {
                    hostelTotal += rent;
                    hostelItems.Add(new FeeInvoiceItem
                    {
                        TenantId  = _currentUser.TenantId,
                        FeeHeadId = hostelHeadId,
                        HeadName  = $"Hostel / Accommodation Fee (Rm {roomNumber} - Bed {bedCode})",
                        Amount    = rent,
                        PaidAmount = 0
                    });
                }

                if (dto.IsMessIncluded && dto.MonthlyMessFee > 0)
                {
                    hostelTotal += dto.MonthlyMessFee;
                    hostelItems.Add(new FeeInvoiceItem
                    {
                        TenantId  = _currentUser.TenantId,
                        FeeHeadId = messHeadId,
                        HeadName  = $"Mess & Dining Fee ({dto.MessPlan})",
                        Amount    = dto.MonthlyMessFee,
                        PaidAmount = 0
                    });
                }

                if (hostelTotal > 0)
                {
                    var hostelInvoice = new FeeInvoice
                    {
                        TenantId      = _currentUser.TenantId,
                        BranchId      = student.BranchId,
                        StudentId     = student.Id,
                        ClassId       = student.ClassId,
                        ClassName     = student.Class?.Name,
                        SectionId     = student.SectionId,
                        SectionName   = student.Section?.Name,
                        InvoiceNumber = $"INV-HOSTEL-{now.Year}{now.Month:D2}-{new Random().Next(100, 999)}",
                        Title         = $"{now:MMMM yyyy} Hostel Charges",
                        TotalAmount   = hostelTotal,
                        PaidAmount    = 0,
                        DueDate       = new DateTime(now.Year, now.Month, Math.Min(10, DateTime.DaysInMonth(now.Year, now.Month))),
                        Status        = InvoiceStatus.Pending,
                        CreatedAt     = now,
                        Items         = hostelItems
                    };
                    _db.FeeInvoices.Add(hostelInvoice);
                    await _db.SaveChangesAsync();
                }
            }
        }
        catch
        {
            // Non-critical: invoice generation failure should not block bed allocation
        }
        // ─────────────────────────────────────────────────────────────────────────

        return Ok(new { message = $"Bed {bed.BedCode} allocated to {student.StudentName} successfully." });
    }

    [HttpPost("vacate")]
    public async Task<IActionResult> VacateBed([FromBody] VacateBedDto dto)
    {
        var alloc = await _db.HostelAllocations
            .Include(a => a.Bed)
            .Include(a => a.Student)
            .FirstOrDefaultAsync(a => a.Id == dto.AllocationId);

        if (alloc == null) return NotFound(new { message = "Allocation record not found" });

        alloc.Status = "Vacated";
        alloc.VacatedDate = dto.VacatedDate ?? DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(dto.Remarks))
        {
            alloc.Remarks = (alloc.Remarks ?? "") + " | Vacated: " + dto.Remarks;
        }

        if (alloc.Bed != null)
        {
            alloc.Bed.Status = "Available";
            alloc.Bed.CurrentStudentId = null;
        }

        if (alloc.Student != null && alloc.Student.HostelBedId == alloc.BedId)
        {
            alloc.Student.HostelBedId = null;
            // Student remains active academic student (Day Scholar)
            alloc.Student.IsHostelStudent = false;
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Bed vacated successfully. Student is now marked as Day Scholar." });
    }

    [HttpGet("allocations")]
    public async Task<ActionResult<IEnumerable<HostelAllocationDto>>> GetAllocations(
        [FromQuery] string? status = null,
        [FromQuery] Guid? studentId = null)
    {
        var query = _db.HostelAllocations
            .AsNoTracking()
            .Include(a => a.Student)
                .ThenInclude(s => s.Class)
            .Include(a => a.Student)
                .ThenInclude(s => s.Batch)
            .Include(a => a.Bed)
                .ThenInclude(b => b.Room)
                    .ThenInclude(r => r.Hostel)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(a => a.Status == status);
        }

        if (studentId.HasValue && studentId != Guid.Empty)
        {
            query = query.Where(a => a.StudentId == studentId.Value);
        }

        var list = await query
            .OrderByDescending(a => a.AllocatedDate)
            .ToListAsync();

        var result = list.Select(a => new HostelAllocationDto(
            a.Id,
            a.StudentId,
            a.Student?.StudentName ?? "",
            a.Student?.RollNumber,
            a.Student?.ParentWhatsAppPhone,
            a.Student?.Class?.Name ?? a.Student?.Batch?.Name,
            a.BedId,
            a.Bed?.BedCode ?? "",
            a.Bed?.Room?.RoomNumber ?? "",
            a.Bed?.Room?.HostelId ?? Guid.Empty,
            a.Bed?.Room?.Hostel?.Name ?? "",
            a.AllocatedDate,
            a.VacatedDate,
            a.MonthlyRent,
            a.IsMessIncluded,
            a.MessPlan,
            a.MonthlyMessFee,
            a.Status,
            a.Remarks
        ));

        return Ok(result);
    }

    // =========================================================================
    // 6. Gate Pass & Outing Management
    // =========================================================================

    [HttpGet("gatepasses")]
    public async Task<ActionResult<GatePassPagedResultDto>> GetGatePasses(
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? sortBy = "outDate",
        [FromQuery] string? sortOrder = "desc",
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 10)
    {
        var tenantId = _currentUser.TenantId;
        var istZone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
        var now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istZone);

        var baseQuery = _db.HostelGatePasses
            .AsNoTracking()
            .Include(g => g.Student)
                .ThenInclude(s => s!.Class)
            .Include(g => g.Student)
                .ThenInclude(s => s!.Batch)
            .Include(g => g.Student)
                .ThenInclude(s => s!.HostelBed)
                    .ThenInclude(b => b!.Room)
                        .ThenInclude(r => r!.Hostel)
            .Where(g => g.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            baseQuery = baseQuery.Where(g =>
                (g.Student != null && g.Student.StudentName.ToLower().Contains(term)) ||
                (g.Student != null && g.Student.RollNumber != null && g.Student.RollNumber.ToLower().Contains(term)) ||
                g.PassNumber.ToLower().Contains(term) ||
                g.Purpose.ToLower().Contains(term) ||
                (g.ParentContactNumber != null && g.ParentContactNumber.Contains(term)) ||
                (g.Student != null && g.Student.ParentWhatsAppPhone != null && g.Student.ParentWhatsAppPhone.Contains(term)) ||
                (g.Student != null && g.Student.Class != null && g.Student.Class.Name.ToLower().Contains(term)) ||
                (g.Student != null && g.Student.Batch != null && g.Student.Batch.Name.ToLower().Contains(term))
            );
        }

        // Aggregate counts on filtered search before status partitioning
        var activeOutCount = await baseQuery.CountAsync(g => g.WardenApprovalStatus == "Approved" && g.ActualReturnDate == null && g.ExpectedReturnDate >= now);
        var overdueCount = await baseQuery.CountAsync(g => g.WardenApprovalStatus == "Approved" && g.ActualReturnDate == null && g.ExpectedReturnDate < now);
        var completedCount = await baseQuery.CountAsync(g => g.WardenApprovalStatus == "Completed" || g.ActualReturnDate != null);

        // Filter by Status Tab
        if (!string.IsNullOrWhiteSpace(status) && status.ToLower() != "all")
        {
            var s = status.Trim().ToLower();
            if (s == "approved" || s == "out")
            {
                baseQuery = baseQuery.Where(g => g.WardenApprovalStatus == "Approved" && g.ActualReturnDate == null);
            }
            else if (s == "completed" || s == "returned")
            {
                baseQuery = baseQuery.Where(g => g.WardenApprovalStatus == "Completed" || g.ActualReturnDate != null);
            }
            else if (s == "overdue")
            {
                baseQuery = baseQuery.Where(g => g.WardenApprovalStatus == "Approved" && g.ActualReturnDate == null && g.ExpectedReturnDate < now);
            }
            else
            {
                baseQuery = baseQuery.Where(g => g.WardenApprovalStatus.ToLower() == s);
            }
        }

        var totalCount = await baseQuery.CountAsync();

        // Server-Side Sorting
        var isDesc = string.Equals(sortOrder, "desc", StringComparison.OrdinalIgnoreCase);
        baseQuery = (sortBy?.ToLower()) switch
        {
            "studentname" or "student" => isDesc
                ? baseQuery.OrderByDescending(g => g.Student != null ? g.Student.StudentName : "")
                : baseQuery.OrderBy(g => g.Student != null ? g.Student.StudentName : ""),
            "expectedreturn" or "expectedreturndate" => isDesc
                ? baseQuery.OrderByDescending(g => g.ExpectedReturnDate)
                : baseQuery.OrderBy(g => g.ExpectedReturnDate),
            "passnumber" or "passno" => isDesc
                ? baseQuery.OrderByDescending(g => g.PassNumber)
                : baseQuery.OrderBy(g => g.PassNumber),
            "status" => isDesc
                ? baseQuery.OrderByDescending(g => g.WardenApprovalStatus)
                : baseQuery.OrderBy(g => g.WardenApprovalStatus),
            _ => isDesc
                ? baseQuery.OrderByDescending(g => g.OutDate)
                : baseQuery.OrderBy(g => g.OutDate)
        };

        pageIndex = Math.Max(1, pageIndex);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        var list = await baseQuery
            .Skip((pageIndex - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var dtos = list.Select(g => new HostelGatePassDto(
            g.Id,
            g.StudentId,
            g.Student?.StudentName ?? "",
            g.Student?.RollNumber,
            g.Student?.Class?.Name ?? g.Student?.Batch?.Name,
            g.Student?.HostelBed != null ? $"{g.Student.HostelBed.Room?.Hostel?.Name} - {g.Student.HostelBed.Room?.RoomNumber} ({g.Student.HostelBed.BedCode})" : "",
            g.PassNumber,
            g.OutDate,
            g.ExpectedReturnDate,
            g.ActualReturnDate,
            g.Purpose,
            g.ParentConsentGiven,
            g.ParentContactNumber ?? g.Student?.ParentWhatsAppPhone,
            g.WardenApprovalStatus,
            g.ApprovedByWarden,
            g.Remarks,
            g.CreatedAt
        )).ToList();

        return Ok(new GatePassPagedResultDto(
            dtos,
            totalCount,
            pageIndex,
            pageSize,
            totalPages,
            activeOutCount,
            completedCount,
            overdueCount
        ));
    }

    [HttpPost("gatepasses")]
    public async Task<ActionResult<HostelGatePassDto>> CreateGatePass([FromBody] CreateGatePassDto dto)
    {
        var student = await _db.Students.FindAsync(dto.StudentId);
        if (student == null) return BadRequest(new { message = "Student not found" });

        var passNumber = $"GP-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(100, 999)}";

        var pass = new HostelGatePass
        {
            TenantId = _currentUser.TenantId,
            BranchId = student.BranchId,
            StudentId = student.Id,
            PassNumber = passNumber,
            OutDate = dto.OutDate,
            ExpectedReturnDate = dto.ExpectedReturnDate,
            Purpose = dto.Purpose,
            ParentConsentGiven = dto.ParentConsentGiven,
            ParentContactNumber = dto.ParentContactNumber ?? student.ParentWhatsAppPhone,
            WardenApprovalStatus = "Approved",
            ApprovedByWarden = "Warden On Duty",
            Remarks = dto.Remarks
        };

        _db.HostelGatePasses.Add(pass);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Gate pass issued successfully",
            id = pass.Id,
            passNumber = pass.PassNumber,
            outDate = pass.OutDate,
            expectedReturnDate = pass.ExpectedReturnDate,
            wardenApprovalStatus = pass.WardenApprovalStatus
        });
    }

    [HttpPut("gatepasses/{id}/status")]
    public async Task<IActionResult> UpdateGatePassStatus(Guid id, [FromQuery] string status, [FromQuery] string? remarks = null)
    {
        var pass = await _db.HostelGatePasses.FindAsync(id);
        if (pass == null) return NotFound();

        pass.WardenApprovalStatus = status;
        if (status == "Completed")
        {
            var istZone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
            pass.ActualReturnDate = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istZone);

            // Auto-flip today's roll call attendance from GatePass to Present since student is back
            var today = pass.ActualReturnDate.Value.Date;
            var att = await _db.HostelAttendances.FirstOrDefaultAsync(a =>
                a.StudentId == pass.StudentId && a.AttendanceDate == today && a.Status == "GatePass");
            if (att != null)
            {
                att.Status = "Present";
            }
        }
        if (!string.IsNullOrWhiteSpace(remarks))
        {
            pass.Remarks = (pass.Remarks ?? "") + " | " + remarks;
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Gate pass updated successfully", id = pass.Id, status = pass.WardenApprovalStatus });
    }

    // =========================================================================
    // 7. Night Roll Call & Biometric Attendance
    // =========================================================================

    [HttpGet("attendance/settings")]
    public async Task<ActionResult> GetAttendanceSettings()
    {
        var settings = await _db.AttendanceSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);

        return Ok(new
        {
            hostelMode = settings?.HostelMode ?? "Both",
            studentMode = settings?.StudentMode ?? "Both",
            teacherMode = settings?.TeacherMode ?? "Both"
        });
    }

    [HttpPut("attendance/settings")]
    public async Task<IActionResult> UpdateAttendanceSettings([FromBody] HostelAttendanceSettingsDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.HostelMode) ||
            (!dto.HostelMode.Equals("Manual", StringComparison.OrdinalIgnoreCase) &&
             !dto.HostelMode.Equals("Biometric", StringComparison.OrdinalIgnoreCase) &&
             !dto.HostelMode.Equals("Both", StringComparison.OrdinalIgnoreCase)))
        {
            return BadRequest(new { message = "Mode must be 'Manual', 'Biometric', or 'Both'." });
        }

        var settings = await _db.AttendanceSettings.FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);
        if (settings == null)
        {
            settings = new AttendanceSettings { TenantId = _currentUser.TenantId };
            _db.AttendanceSettings.Add(settings);
        }

        settings.HostelMode = dto.HostelMode;
        settings.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Hostel attendance mode updated successfully", hostelMode = settings.HostelMode });
    }

    [HttpGet("rollcall")]
    public async Task<ActionResult> GetRollCall(
        [FromQuery] Guid hostelId,
        [FromQuery] DateTime date,
        [FromQuery] string shift = "Night")
    {
        var dateOnly = date.Date;

        // Get all students allocated to this hostel
        var studentsInHostel = await _db.HostelBeds
            .AsNoTracking()
            .Include(b => b.Room)
            .Include(b => b.CurrentStudent)
                .ThenInclude(s => s.Class)
            .Include(b => b.CurrentStudent)
                .ThenInclude(s => s.Batch)
            .Where(b => b.Room.HostelId == hostelId && b.Status == "Occupied" && b.CurrentStudentId != null)
            .ToListAsync();

        var studentIds = studentsInHostel.Select(b => b.CurrentStudentId!.Value).Distinct().ToList();

        // Get existing attendance marks for this date, shift and hostel
        var attendancesList = await _db.HostelAttendances
            .AsNoTracking()
            .Where(a => a.HostelId == hostelId && a.AttendanceDate == dateOnly && a.RollCallShift == shift)
            .ToListAsync();

        var attendances = attendancesList
            .GroupBy(a => a.StudentId)
            .ToDictionary(grp => grp.Key, grp => grp.First());

        // Check active approved gate passes for today (student currently out)
        var activeGatePassesList = await _db.HostelGatePasses
            .AsNoTracking()
            .Where(g => studentIds.Contains(g.StudentId) &&
                        g.WardenApprovalStatus == "Approved" &&
                        g.OutDate.Date <= dateOnly &&
                        g.ActualReturnDate == null)
            .OrderByDescending(g => g.OutDate)
            .ToListAsync();

        var activeGatePasses = activeGatePassesList
            .GroupBy(g => g.StudentId)
            .ToDictionary(grp => grp.Key, grp => grp.First());

        var list = studentsInHostel.Select(b =>
        {
            var student = b.CurrentStudent!;
            attendances.TryGetValue(student.Id, out var existingAtt);
            activeGatePasses.TryGetValue(student.Id, out var gatePass);

            string resolvedStatus = "Present";
            string resolvedCaptureSource = existingAtt?.CaptureSource ?? (existingAtt != null ? "Manual" : "None");
            string? resolvedPunchTime = existingAtt?.PunchTime;

            if (gatePass != null)
            {
                // If a biometric punch happened AFTER the gate pass was issued, student returned
                if (existingAtt?.CapturedAt != null && existingAtt.CapturedAt.Value > gatePass.CreatedAt)
                {
                    resolvedStatus = existingAtt.Status;
                }
                else
                {
                    resolvedStatus = "GatePass";
                    // If punch was from before the gate pass was issued, it was a morning punch; student is now out
                    if (existingAtt?.CapturedAt != null && existingAtt.CapturedAt.Value <= gatePass.CreatedAt)
                    {
                        resolvedCaptureSource = "None";
                        resolvedPunchTime = null;
                    }
                }
            }
            else
            {
                // If student has no active gate pass, but earlier attendance had "GatePass" (from when they were out),
                // since they have returned, automatically switch to "Present"
                if (existingAtt?.Status == "GatePass")
                {
                    resolvedStatus = "Present";
                }
                else
                {
                    resolvedStatus = existingAtt?.Status ?? "Present";
                }
            }

            return new
            {
                studentId = student.Id,
                studentName = student.StudentName,
                rollNumber = student.RollNumber,
                biometricUserId = student.BiometricUserId,
                parentPhone = student.ParentWhatsAppPhone,
                roomNumber = b.Room.RoomNumber,
                bedCode = b.BedCode,
                classOrBatch = student.Class?.Name ?? student.Batch?.Name ?? "",
                profilePhoto = student.ProfilePhoto,
                status = resolvedStatus,
                captureSource = resolvedCaptureSource,
                punchTime = resolvedPunchTime,
                biometricDeviceId = existingAtt?.BiometricDeviceId,
                hasActiveGatePass = gatePass != null,
                gatePassDetails = gatePass != null ? $"Pass #{gatePass.PassNumber}: {gatePass.Purpose} (Return: {gatePass.ExpectedReturnDate:dd MMM hh:mm tt})" : null,
                remarks = existingAtt?.Remarks
            };
        });

        return Ok(list);
    }

    [HttpPost("rollcall/bulk")]
    public async Task<IActionResult> SaveBulkRollCall([FromBody] BulkRollCallDto dto)
    {
        var settings = await _db.AttendanceSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);

        if (string.Equals(settings?.HostelMode, "Biometric", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Manual roll call submission is disabled because Hostel Attendance Mode is set to 'Biometric Only'." });
        }

        var dateOnly = dto.AttendanceDate.Date;

        // Fetch existing records for this date/shift/hostel
        var existingList = await _db.HostelAttendances
            .Where(a => a.HostelId == dto.HostelId && a.AttendanceDate == dateOnly && a.RollCallShift == dto.RollCallShift)
            .ToListAsync();

        var existing = existingList
            .GroupBy(a => a.StudentId)
            .ToDictionary(grp => grp.Key, grp => grp.First());

        foreach (var item in dto.Items)
        {
            if (existing.TryGetValue(item.StudentId, out var attRecord))
            {
                attRecord.Status = item.Status;
                attRecord.Remarks = item.Remarks;
                // If previously captured by Biometric, keep Biometric source unless explicitly changed
                if (attRecord.CaptureSource != "Biometric")
                {
                    attRecord.CaptureSource = "Manual";
                    attRecord.MarkedBy = "Warden";
                }
            }
            else
            {
                _db.HostelAttendances.Add(new HostelAttendance
                {
                    TenantId = _currentUser.TenantId,
                    BranchId = _currentUser.BranchId,
                    HostelId = dto.HostelId,
                    StudentId = item.StudentId,
                    AttendanceDate = dateOnly,
                    RollCallShift = dto.RollCallShift,
                    Status = item.Status,
                    CaptureSource = "Manual",
                    Remarks = item.Remarks,
                    MarkedBy = "Warden"
                });
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = $"Night roll call recorded for {dto.Items.Count} students." });
    }

    [HttpPost("attendance/biometric-punch")]
    public async Task<IActionResult> SimulateBiometricPunch([FromBody] SimulateBiometricPunchDto dto)
    {
        var settings = await _db.AttendanceSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);

        if (string.Equals(settings?.HostelMode, "Manual", StringComparison.OrdinalIgnoreCase))
        {
            return Conflict(new { message = "Biometric attendance is disabled. Current mode is set to 'Manual Only'." });
        }

        Student? student = null;
        if (dto.StudentId.HasValue)
        {
            student = await _db.Students
                .Include(s => s.HostelBed)
                    .ThenInclude(b => b.Room)
                .FirstOrDefaultAsync(s => s.Id == dto.StudentId.Value);
        }
        else if (!string.IsNullOrWhiteSpace(dto.BiometricUserId))
        {
            student = await _db.Students
                .Include(s => s.HostelBed)
                    .ThenInclude(b => b.Room)
                .FirstOrDefaultAsync(s => s.BiometricUserId == dto.BiometricUserId.Trim());
        }

        if (student == null)
        {
            return NotFound(new { message = "Student not found for given StudentId or BiometricUserId." });
        }

        if (!student.IsHostelStudent || student.HostelBed?.Room?.HostelId == null)
        {
            return BadRequest(new { message = $"Student {student.StudentName} is not registered in any hostel bed." });
        }

        var hostelId = student.HostelBed.Room.HostelId;
        var punchDateTime = dto.PunchTime ?? DateTime.UtcNow;
        var dateOnly = punchDateTime.Date;
        var shift = dto.Shift ?? "Night";

        var indiaTime = TimeZoneInfo.ConvertTimeBySystemTimeZoneId(
            DateTime.SpecifyKind(punchDateTime, DateTimeKind.Utc), "India Standard Time");
        var punchTimeStr = indiaTime.ToString("HH:mm");

        var record = await _db.HostelAttendances.FirstOrDefaultAsync(a =>
            a.StudentId == student.Id && a.HostelId == hostelId && a.AttendanceDate == dateOnly && a.RollCallShift == shift);

        if (record == null)
        {
            record = new HostelAttendance
            {
                TenantId = _currentUser.TenantId,
                BranchId = student.BranchId ?? _currentUser.BranchId,
                StudentId = student.Id,
                HostelId = hostelId,
                AttendanceDate = dateOnly,
                RollCallShift = shift
            };
            _db.HostelAttendances.Add(record);
        }

        record.Status = "Present";
        record.CaptureSource = "Biometric";
        record.BiometricDeviceId = dto.DeviceId ?? "GATE-TURNSTILE-01";
        record.CapturedAt = punchDateTime;
        record.PunchTime = punchTimeStr;
        record.MarkedBy = "biometric-turnstile";

        // Also record in BiometricEventLogs
        _db.BiometricEventLogs.Add(new BiometricEventLog
        {
            TenantId = _currentUser.TenantId,
            PersonType = "hostel",
            BiometricUserId = student.BiometricUserId ?? student.RollNumber ?? student.Id.ToString(),
            EventTime = punchDateTime,
            Status = "Processed",
            AttendanceId = record.Id
        });

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"Biometric punch captured successfully for {student.StudentName}.",
            studentId = student.Id,
            studentName = student.StudentName,
            status = "Present",
            captureSource = "Biometric",
            punchTime = punchTimeStr,
            deviceId = record.BiometricDeviceId
        });
    }

    [HttpGet("attendance/biometric-mappings")]
    public async Task<ActionResult> GetHostelBiometricMappings()
    {
        var residents = await _db.HostelBeds
            .AsNoTracking()
            .Include(b => b.Room)
                .ThenInclude(r => r.Hostel)
            .Include(b => b.CurrentStudent)
                .ThenInclude(s => s.Class)
            .Include(b => b.CurrentStudent)
                .ThenInclude(s => s.Batch)
            .Where(b => b.Status == "Occupied" && b.CurrentStudent != null)
            .OrderBy(b => b.Room.Hostel.Name)
            .ThenBy(b => b.Room.RoomNumber)
            .ThenBy(b => b.BedCode)
            .Select(b => new
            {
                studentId = b.CurrentStudent!.Id,
                studentName = b.CurrentStudent.StudentName,
                rollNumber = b.CurrentStudent.RollNumber,
                biometricUserId = b.CurrentStudent.BiometricUserId,
                hostelId = b.Room.HostelId,
                hostelName = b.Room.Hostel.Name,
                roomNumber = b.Room.RoomNumber,
                bedCode = b.BedCode,
                classOrBatch = b.CurrentStudent.Class != null ? b.CurrentStudent.Class.Name : (b.CurrentStudent.Batch != null ? b.CurrentStudent.Batch.Name : "")
            })
            .ToListAsync();

        return Ok(residents);
    }

    [HttpPut("attendance/biometric-mappings")]
    public async Task<IActionResult> UpdateResidentBiometricMapping([FromBody] UpdateResidentBiometricMappingDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.BiometricUserId))
        {
            return BadRequest(new { message = "Biometric user ID is required." });
        }

        var student = await _db.Students.FindAsync(dto.StudentId);
        if (student == null) return NotFound(new { message = "Student not found." });

        student.BiometricUserId = dto.BiometricUserId.Trim();
        await _db.SaveChangesAsync();

        return Ok(new { message = $"Biometric ID '{dto.BiometricUserId.Trim()}' assigned to {student.StudentName}." });
    }

    // =========================================================================
    // 8. Server-Side Student Search & Categorized Filtering for Bed Allocation
    // =========================================================================

    [HttpGet("students/search")]
    public async Task<ActionResult<IEnumerable<HostelStudentSearchResultDto>>> SearchStudentsForHostel(
        [FromQuery] string? q = null,
        [FromQuery] string? type = "all",
        [FromQuery] string? gender = null,
        [FromQuery] int limit = 40)
    {
        var tenantId = _currentUser.TenantId;
        var query = _db.Students
            .AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .Include(s => s.HostelBed)
                .ThenInclude(b => b!.Room)
            .Where(s => s.TenantId == tenantId && s.IsActive);

        if (!string.IsNullOrWhiteSpace(type))
        {
            var lowerType = type.Trim().ToLowerInvariant();
            if (lowerType == "school")
            {
                query = query.Where(s => s.IsSchoolStudent);
            }
            else if (lowerType == "coaching")
            {
                query = query.Where(s => s.IsCoachingStudent && !s.IsSchoolStudent);
            }
        }

        if (!string.IsNullOrWhiteSpace(gender))
        {
            var g = gender.Trim().ToLowerInvariant();
            query = query.Where(s => s.Gender != null && s.Gender.ToLower() == g);
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            query = query.Where(s =>
                s.StudentName.ToLower().Contains(term) ||
                (s.RollNumber != null && s.RollNumber.ToLower().Contains(term)) ||
                (s.SchoolRollNumber != null && s.SchoolRollNumber.ToLower().Contains(term)) ||
                (s.CoachingRollNumber != null && s.CoachingRollNumber.ToLower().Contains(term)) ||
                (s.AdmissionNumber != null && s.AdmissionNumber.ToLower().Contains(term)) ||
                (s.ParentWhatsAppPhone != null && s.ParentWhatsAppPhone.Contains(term)) ||
                (s.Class != null && s.Class.Name.ToLower().Contains(term)) ||
                (s.Batch != null && s.Batch.Name.ToLower().Contains(term))
            );
        }

        limit = Math.Clamp(limit, 1, 100);

        var students = await query
            .OrderBy(s => s.IsSchoolStudent ? 0 : 1)
            .ThenBy(s => s.Class != null ? s.Class.Name : "")
            .ThenBy(s => s.Batch != null ? s.Batch.Name : "")
            .ThenBy(s => s.StudentName)
            .Take(limit)
            .ToListAsync();

        var result = students.Select(s =>
        {
            string groupName;
            if (s.IsSchoolStudent)
            {
                var className = s.Class?.Name ?? "School General";
                var secName = s.Section != null ? $" - {s.Section.Name}" : "";
                groupName = $"School: {className}{secName}";
            }
            else if (s.IsCoachingStudent)
            {
                var batchName = s.Batch?.Name ?? "Coaching Batch";
                groupName = $"Coaching: {batchName}";
            }
            else
            {
                groupName = "General Boarding";
            }

            string? bedInfo = null;
            if (s.HostelBed != null && s.HostelBed.Room != null)
            {
                bedInfo = $"Room {s.HostelBed.Room.RoomNumber} ({s.HostelBed.BedCode})";
            }

            return new HostelStudentSearchResultDto(
                s.Id,
                s.StudentName,
                s.RollNumber,
                s.AdmissionNumber,
                s.SchoolRollNumber,
                s.CoachingRollNumber,
                s.Gender,
                s.IsSchoolStudent,
                s.IsCoachingStudent,
                s.IsHostelStudent,
                s.HostelBedId,
                s.Class?.Name,
                s.Section?.Name,
                s.Batch?.Name,
                s.ProfilePhoto,
                s.ParentName,
                s.ParentWhatsAppPhone,
                groupName,
                bedInfo,
                s.HostelBedId != null
            );
        }).ToList();

        return Ok(result);
    }
}
