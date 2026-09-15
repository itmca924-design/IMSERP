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
public class RoomsController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;

    public RoomsController(IIMSERPDbContext dbContext, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<RoomDto>>> GetRooms([FromQuery] Guid? branchId)
    {
        var query = _dbContext.Rooms
            .AsNoTracking()
            .Include(r => r.Branch)
            .AsQueryable();

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            query = query.Where(r => r.BranchId == branchId.Value);
        }

        var rooms = await query
            .OrderBy(r => r.Branch != null ? r.Branch.Name : "")
            .ThenBy(r => r.RoomNumber)
            .ToListAsync();

        var result = new List<RoomDto>();
        foreach (var r in rooms)
        {
            var activeBatchCount = await _dbContext.Batches
                .IgnoreQueryFilters()
                .CountAsync(b => b.RoomId == r.Id);

            result.Add(new RoomDto(
                r.Id,
                r.TenantId,
                r.BranchId,
                r.Branch?.Name ?? "Branch",
                r.RoomNumber,
                r.Capacity,
                r.Floor,
                r.IsActive,
                r.CreatedAt,
                activeBatchCount
            ));
        }

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<RoomDto>> GetRoomById(Guid id)
    {
        var r = await _dbContext.Rooms
            .AsNoTracking()
            .Include(x => x.Branch)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (r == null) return NotFound(new { message = "Classroom / Room not found." });

        var activeBatchCount = await _dbContext.Batches
            .IgnoreQueryFilters()
            .CountAsync(b => b.RoomId == r.Id);

        return Ok(new RoomDto(
            r.Id,
            r.TenantId,
            r.BranchId,
            r.Branch?.Name ?? "Branch",
            r.RoomNumber,
            r.Capacity,
            r.Floor,
            r.IsActive,
            r.CreatedAt,
            activeBatchCount
        ));
    }

    [HttpPost]
    public async Task<ActionResult<RoomDto>> CreateRoom([FromBody] CreateRoomDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.RoomNumber))
        {
            return BadRequest(new { message = "Room Number / Name is required." });
        }

        var branchExists = await _dbContext.Branches.AnyAsync(b => b.Id == dto.BranchId);
        if (!branchExists)
        {
            return BadRequest(new { message = "Invalid Branch selected." });
        }

        var normalizedNumber = dto.RoomNumber.Trim();
        var existsInBranch = await _dbContext.Rooms.AnyAsync(r => r.BranchId == dto.BranchId && r.RoomNumber.ToLower() == normalizedNumber.ToLower());
        if (existsInBranch)
        {
            return Conflict(new { message = $"A room with number '{normalizedNumber}' already exists in this branch." });
        }

        var room = new Room
        {
            Id = Guid.NewGuid(),
            TenantId = _currentUser.TenantId,
            BranchId = dto.BranchId,
            RoomNumber = normalizedNumber,
            Capacity = dto.Capacity > 0 ? dto.Capacity : 40,
            Floor = dto.Floor?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Rooms.Add(room);
        await _dbContext.SaveChangesAsync();

        var branch = await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == dto.BranchId);

        return CreatedAtAction(nameof(GetRoomById), new { id = room.Id }, new RoomDto(
            room.Id,
            room.TenantId,
            room.BranchId,
            branch?.Name ?? "Branch",
            room.RoomNumber,
            room.Capacity,
            room.Floor,
            room.IsActive,
            room.CreatedAt,
            0
        ));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateRoom(Guid id, [FromBody] UpdateRoomDto dto)
    {
        var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == id);
        if (room == null) return NotFound(new { message = "Classroom / Room not found." });

        room.RoomNumber = dto.RoomNumber.Trim();
        room.Capacity = dto.Capacity > 0 ? dto.Capacity : room.Capacity;
        room.Floor = dto.Floor?.Trim();
        room.IsActive = dto.IsActive;

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "Classroom details updated successfully." });
    }

    [HttpPatch("{id}/toggle-status")]
    public async Task<ActionResult> ToggleRoomStatus(Guid id)
    {
        var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == id);
        if (room == null) return NotFound(new { message = "Classroom / Room not found." });

        room.IsActive = !room.IsActive;
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = $"Room {(room.IsActive ? "activated" : "deactivated")} successfully.", isActive = room.IsActive });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteRoom(Guid id)
    {
        var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == id);
        if (room == null) return NotFound(new { message = "Classroom / Room not found." });

        var hasBatches = await _dbContext.Batches.AnyAsync(b => b.RoomId == id);
        if (hasBatches)
        {
            return BadRequest(new { message = "Cannot delete room because it is currently assigned to one or more batches. Deactivate it instead." });
        }

        _dbContext.Rooms.Remove(room);
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = "Classroom deleted successfully." });
    }
}
