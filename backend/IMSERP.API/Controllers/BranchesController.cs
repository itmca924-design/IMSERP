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
    [IMSERP.API.Services.SkipMenuPermission]
    public async Task<ActionResult<IEnumerable<BranchDto>>> GetAllBranches()
    {
        var isSuperAdmin = string.Equals(_currentUser.UserRole, "SuperAdmin", StringComparison.OrdinalIgnoreCase);

        List<Branch> branches;
        if (isSuperAdmin)
        {
            branches = await _dbContext.Branches
                .IgnoreQueryFilters()
                .Include(b => b.Tenant)
                .AsNoTracking()
                .Where(b => b.IsActive)
                .OrderBy(b => b.Tenant != null ? b.Tenant.Name : "")
                .ThenByDescending(b => b.IsMainBranch)
                .ThenBy(b => b.Name)
                .ToListAsync();
        }
        else
        {
            branches = await _dbContext.Branches
                .AsNoTracking()
                .OrderByDescending(b => b.IsMainBranch)
                .ThenBy(b => b.Name)
                .ToListAsync();
        }

        var result = new List<BranchDto>();
        foreach (var b in branches)
        {
            var studentCount = await _dbContext.Students.IgnoreQueryFilters().CountAsync(s => s.TenantId == b.TenantId && s.BranchId == b.Id);
            var batchCount = await _dbContext.Batches.IgnoreQueryFilters().CountAsync(bat => bat.TenantId == b.TenantId && bat.BranchId == b.Id);
            var roomCount = await _dbContext.Rooms.IgnoreQueryFilters().CountAsync(r => r.TenantId == b.TenantId && r.BranchId == b.Id);

            var displayName = isSuperAdmin && b.Tenant != null && !string.IsNullOrWhiteSpace(b.Tenant.Name)
                ? $"{b.Name} [{b.Tenant.Name}]"
                : b.Name;

            result.Add(new BranchDto(
                b.Id,
                b.TenantId,
                displayName,
                b.Code,
                b.Address,
                b.ContactPhone,
                b.IsMainBranch,
                b.IsActive,
                b.CreatedAt,
                studentCount,
                batchCount,
                roomCount,
                b.Email,
                b.City,
                b.State,
                b.Pincode
            ));
        }

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<BranchDto>> GetBranchById(Guid id)
    {
        var isSuperAdmin = string.Equals(_currentUser.UserRole, "SuperAdmin", StringComparison.OrdinalIgnoreCase);

        IQueryable<Branch> query = _dbContext.Branches.AsNoTracking();
        if (isSuperAdmin)
        {
            query = _dbContext.Branches.IgnoreQueryFilters().Include(b => b.Tenant).AsNoTracking();
        }

        var b = await query.FirstOrDefaultAsync(x => x.Id == id);

        if (b == null) return NotFound(new { message = "Branch not found." });

        var studentCount = await _dbContext.Students.IgnoreQueryFilters().CountAsync(s => s.TenantId == b.TenantId && s.BranchId == b.Id);
        var batchCount = await _dbContext.Batches.IgnoreQueryFilters().CountAsync(bat => bat.TenantId == b.TenantId && bat.BranchId == b.Id);
        var roomCount = await _dbContext.Rooms.IgnoreQueryFilters().CountAsync(r => r.TenantId == b.TenantId && r.BranchId == b.Id);

        var displayName = isSuperAdmin && b.Tenant != null && !string.IsNullOrWhiteSpace(b.Tenant.Name)
            ? $"{b.Name} [{b.Tenant.Name}]"
            : b.Name;

        return Ok(new BranchDto(
            b.Id,
            b.TenantId,
            displayName,
            b.Code,
            b.Address,
            b.ContactPhone,
            b.IsMainBranch,
            b.IsActive,
            b.CreatedAt,
            studentCount,
            batchCount,
            roomCount,
            b.Email,
            b.City,
            b.State,
            b.Pincode
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
            Email = dto.Email?.Trim(),
            City = dto.City?.Trim(),
            State = dto.State?.Trim(),
            Pincode = dto.Pincode?.Trim(),
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
            1,
            branch.Email,
            branch.City,
            branch.State,
            branch.Pincode
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
        if (dto.Email != null) branch.Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim();
        if (dto.City != null) branch.City = string.IsNullOrWhiteSpace(dto.City) ? null : dto.City.Trim();
        if (dto.State != null) branch.State = string.IsNullOrWhiteSpace(dto.State) ? null : dto.State.Trim();
        if (dto.Pincode != null) branch.Pincode = string.IsNullOrWhiteSpace(dto.Pincode) ? null : dto.Pincode.Trim();
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
