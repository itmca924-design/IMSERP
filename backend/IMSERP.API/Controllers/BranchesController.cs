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
public class BranchesController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;

    public BranchesController(IIMSERPDbContext dbContext, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<BranchDto>>> GetAllBranches()
    {
        var branches = await _dbContext.Branches
            .AsNoTracking()
            .OrderByDescending(b => b.IsMainBranch)
            .ThenBy(b => b.Name)
            .ToListAsync();

        var result = new List<BranchDto>();
        foreach (var b in branches)
        {
            var studentCount = await _dbContext.Students.IgnoreQueryFilters().CountAsync(s => s.BranchId == b.Id);
            var batchCount = await _dbContext.Batches.IgnoreQueryFilters().CountAsync(bat => bat.BranchId == b.Id);
            var roomCount = await _dbContext.Rooms.IgnoreQueryFilters().CountAsync(r => r.BranchId == b.Id);

            result.Add(new BranchDto(
                b.Id,
                b.TenantId,
                b.Name,
                b.Code,
                b.Address,
                b.ContactPhone,
                b.IsMainBranch,
                b.IsActive,
                b.CreatedAt,
                studentCount,
                batchCount,
                roomCount
            ));
        }

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<BranchDto>> GetBranchById(Guid id)
    {
        var b = await _dbContext.Branches
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);

        if (b == null) return NotFound(new { message = "Branch not found." });

        var studentCount = await _dbContext.Students.IgnoreQueryFilters().CountAsync(s => s.BranchId == b.Id);
        var batchCount = await _dbContext.Batches.IgnoreQueryFilters().CountAsync(bat => bat.BranchId == b.Id);
        var roomCount = await _dbContext.Rooms.IgnoreQueryFilters().CountAsync(r => r.BranchId == b.Id);

        return Ok(new BranchDto(
            b.Id,
            b.TenantId,
            b.Name,
            b.Code,
            b.Address,
            b.ContactPhone,
            b.IsMainBranch,
            b.IsActive,
            b.CreatedAt,
            studentCount,
            batchCount,
            roomCount
        ));
    }

    [HttpPost]
    public async Task<ActionResult<BranchDto>> CreateBranch([FromBody] CreateBranchDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.Code))
        {
            return BadRequest(new { message = "Branch Name and Branch Code are required." });
        }

        var normalizedCode = dto.Code.Trim().ToUpperInvariant();
        var codeExists = await _dbContext.Branches
            .AnyAsync(b => b.Code.ToUpper() == normalizedCode);

        if (codeExists)
        {
            return Conflict(new { message = $"Branch code '{normalizedCode}' is already registered in your institute." });
        }

        var branch = new Branch
        {
            Id = Guid.NewGuid(),
            TenantId = _currentUser.TenantId,
            Name = dto.Name.Trim(),
            Code = normalizedCode,
            Address = dto.Address?.Trim(),
            ContactPhone = dto.ContactPhone?.Trim(),
            IsMainBranch = dto.IsMainBranch,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Branches.Add(branch);

        // Auto-create a default Room for this new branch
        var defaultRoom = new Room
        {
            Id = Guid.NewGuid(),
            TenantId = _currentUser.TenantId,
            BranchId = branch.Id,
            RoomNumber = "Room 101",
            Capacity = 40,
            Floor = "Ground Floor",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        _dbContext.Rooms.Add(defaultRoom);

        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetBranchById), new { id = branch.Id }, new BranchDto(
            branch.Id,
            branch.TenantId,
            branch.Name,
            branch.Code,
            branch.Address,
            branch.ContactPhone,
            branch.IsMainBranch,
            branch.IsActive,
            branch.CreatedAt,
            0,
            0,
            1
        ));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateBranch(Guid id, [FromBody] UpdateBranchDto dto)
    {
        var branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Id == id);
        if (branch == null) return NotFound(new { message = "Branch not found." });

        branch.Name = dto.Name.Trim();
        branch.Address = dto.Address?.Trim();
        branch.ContactPhone = dto.ContactPhone?.Trim();
        branch.IsActive = dto.IsActive;

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "Branch details updated successfully." });
    }

    [HttpPatch("{id}/toggle-status")]
    public async Task<ActionResult> ToggleBranchStatus(Guid id)
    {
        var branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Id == id);
        if (branch == null) return NotFound(new { message = "Branch not found." });

        if (branch.IsMainBranch && branch.IsActive)
        {
            return BadRequest(new { message = "The Main Branch cannot be deactivated." });
        }

        branch.IsActive = !branch.IsActive;
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = $"Branch {(branch.IsActive ? "activated" : "deactivated")} successfully.", isActive = branch.IsActive });
    }
}
