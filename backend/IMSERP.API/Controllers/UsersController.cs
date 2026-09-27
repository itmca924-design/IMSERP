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
public class UsersController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;
    private readonly IPasswordHasherService _passwordHasher;

    public UsersController(IIMSERPDbContext dbContext, ICurrentUserService currentUser, IPasswordHasherService passwordHasher)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _passwordHasher = passwordHasher;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetUsers()
    {
        var users = await _dbContext.Users
            .AsNoTracking()
            .Include(u => u.AssignedRole)
            .Include(u => u.Branch)
            .OrderByDescending(u => u.CreatedAt)
            .ToListAsync();

        var dtos = users.Select(u => new UserDto(
            u.Id,
            u.Username,
            u.FullName,
            u.Email,
            u.PhoneNumber,
            u.AssignedRole?.Name ?? u.Role.ToString(),
            u.RoleId,
            u.IsActive,
            u.CreatedAt,
            u.BranchId,
            u.Branch?.Name
        )).ToList();

        return Ok(dtos);
    }

    [HttpGet("paged")]
    public async Task<ActionResult<PagedResult<UserDto>>> GetUsersPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? sortBy = "username",
        [FromQuery] bool sortDescending = false,
        [FromQuery] bool? isActive = null,
        [FromQuery] Guid? roleId = null,
        [FromQuery] Guid? branchId = null)
    {
        if (pageNumber < 1) pageNumber = 1;
        if (pageSize < 1) pageSize = 10;
        if (pageSize > 100) pageSize = 100;

        var query = _dbContext.Users
            .AsNoTracking()
            .Include(u => u.AssignedRole)
            .Include(u => u.Branch)
            .AsQueryable();

        // 1. Status Filter
        if (isActive.HasValue)
        {
            query = query.Where(u => u.IsActive == isActive.Value);
        }

        // 2. Role Filter
        if (roleId.HasValue && roleId.Value != Guid.Empty)
        {
            query = query.Where(u => u.RoleId == roleId.Value);
        }

        // 3. Branch Filter
        if (branchId.HasValue)
        {
            if (branchId.Value == Guid.Empty)
            {
                // HQ / No branch assigned
                query = query.Where(u => u.BranchId == null);
            }
            else
            {
                query = query.Where(u => u.BranchId == branchId.Value);
            }
        }

        // 4. Searching
        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(u =>
                u.Username.ToLower().Contains(term) ||
                u.FullName.ToLower().Contains(term) ||
                (u.Email != null && u.Email.ToLower().Contains(term)) ||
                (u.PhoneNumber != null && u.PhoneNumber.ToLower().Contains(term)) ||
                (u.AssignedRole != null && u.AssignedRole.Name.ToLower().Contains(term)) ||
                (u.Branch != null && u.Branch.Name.ToLower().Contains(term))
            );
        }

        // 5. Server-side Sorting
        query = (sortBy?.ToLower()) switch
        {
            "username" => sortDescending ? query.OrderByDescending(u => u.Username) : query.OrderBy(u => u.Username),
            "fullname" => sortDescending ? query.OrderByDescending(u => u.FullName) : query.OrderBy(u => u.FullName),
            "rolename" or "role" => sortDescending
                ? query.OrderByDescending(u => u.AssignedRole != null ? u.AssignedRole.Name : u.Role.ToString())
                : query.OrderBy(u => u.AssignedRole != null ? u.AssignedRole.Name : u.Role.ToString()),
            "branchname" or "branch" => sortDescending
                ? query.OrderByDescending(u => u.Branch != null ? u.Branch.Name : "")
                : query.OrderBy(u => u.Branch != null ? u.Branch.Name : ""),
            "contact" or "email" => sortDescending ? query.OrderByDescending(u => u.Email) : query.OrderBy(u => u.Email),
            "status" or "isactive" => sortDescending ? query.OrderByDescending(u => u.IsActive) : query.OrderBy(u => u.IsActive),
            _ => sortDescending ? query.OrderByDescending(u => u.CreatedAt) : query.OrderBy(u => u.CreatedAt)
        };

        var totalCount = await query.CountAsync();
        var users = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var dtos = users.Select(u => new UserDto(
            u.Id,
            u.Username,
            u.FullName,
            u.Email,
            u.PhoneNumber,
            u.AssignedRole?.Name ?? u.Role.ToString(),
            u.RoleId,
            u.IsActive,
            u.CreatedAt,
            u.BranchId,
            u.Branch?.Name
        )).ToList();

        return Ok(new PagedResult<UserDto>(dtos, totalCount, pageNumber, pageSize));
    }

    [HttpPost]
    public async Task<ActionResult<UserDto>> CreateUser([FromBody] CreateUserDto dto)
    {
        var existing = await _dbContext.Users.AnyAsync(u => u.Username.ToLower() == dto.Username.Trim().ToLower());
        if (existing)
        {
            return BadRequest(new { message = "Username already exists in this institute." });
        }

        var role = await _dbContext.Roles.FindAsync(dto.RoleId);
        if (role == null)
        {
            return BadRequest(new { message = "Selected Role is invalid." });
        }

        if (dto.BranchId.HasValue && dto.BranchId.Value != Guid.Empty)
        {
            var branchExists = await _dbContext.Branches.AnyAsync(b => b.Id == dto.BranchId.Value);
            if (!branchExists)
            {
                return BadRequest(new { message = "Selected Branch is invalid." });
            }
        }

        var mappedRole = UserRole.Teacher;
        if (Enum.TryParse<UserRole>(role.Name.Replace(" ", ""), true, out var parsedRole))
        {
            mappedRole = parsedRole;
        }
        else if (role.Name.Contains("Admin", StringComparison.OrdinalIgnoreCase))
        {
            mappedRole = UserRole.InstituteAdmin;
        }
        else if (role.Name.Equals("HR", StringComparison.OrdinalIgnoreCase) ||
                 role.Name.Contains("Human Resource", StringComparison.OrdinalIgnoreCase))
        {
            mappedRole = UserRole.HR;
        }
        else if (role.Name.Contains("Account", StringComparison.OrdinalIgnoreCase))
        {
            mappedRole = UserRole.Accountant;
        }

        var user = new User
        {
            TenantId = _currentUser.TenantId,
            BranchId = dto.BranchId,
            Username = dto.Username.Trim(),
            PasswordHash = _passwordHasher.HashPassword(dto.Password),
            FullName = dto.FullName.Trim(),
            Email = dto.Email?.Trim(),
            PhoneNumber = dto.PhoneNumber?.Trim(),
            RoleId = dto.RoleId,
            Role = mappedRole,
            IsActive = dto.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync();

        var branchName = dto.BranchId.HasValue ? (await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == dto.BranchId.Value))?.Name : null;

        return Ok(new UserDto(
            user.Id,
            user.Username,
            user.FullName,
            user.Email,
            user.PhoneNumber,
            role.Name,
            role.Id,
            user.IsActive,
            user.CreatedAt,
            user.BranchId,
            branchName
        ));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<UserDto>> UpdateUser(Guid id, [FromBody] CreateUserDto dto)
    {
        var user = await _dbContext.Users.FindAsync(id);
        if (user == null) return NotFound();

        var role = await _dbContext.Roles.FindAsync(dto.RoleId);
        if (role == null)
        {
            return BadRequest(new { message = "Selected Role is invalid." });
        }

        user.FullName = dto.FullName.Trim();
        user.Email = dto.Email?.Trim();
        user.PhoneNumber = dto.PhoneNumber?.Trim();
        user.RoleId = dto.RoleId;
        user.IsActive = dto.IsActive;
        user.BranchId = dto.BranchId;

        if (user.Role != UserRole.SuperAdmin)
        {
            if (Enum.TryParse<UserRole>(role.Name.Replace(" ", ""), true, out var parsedRole))
            {
                user.Role = parsedRole;
            }
            else if (role.Name.Contains("Admin", StringComparison.OrdinalIgnoreCase))
            {
                user.Role = UserRole.InstituteAdmin;
            }
            else if (role.Name.Equals("HR", StringComparison.OrdinalIgnoreCase) ||
                     role.Name.Contains("Human Resource", StringComparison.OrdinalIgnoreCase))
            {
                user.Role = UserRole.HR;
            }
            else if (role.Name.Contains("Account", StringComparison.OrdinalIgnoreCase))
            {
                user.Role = UserRole.Accountant;
            }
            else
            {
                user.Role = UserRole.Teacher;
            }
        }

        if (!string.IsNullOrWhiteSpace(dto.Password))
        {
            user.PasswordHash = _passwordHasher.HashPassword(dto.Password);
        }

        await _dbContext.SaveChangesAsync();

        var branchName = user.BranchId.HasValue ? (await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == user.BranchId.Value))?.Name : null;

        return Ok(new UserDto(
            user.Id,
            user.Username,
            user.FullName,
            user.Email,
            user.PhoneNumber,
            role.Name,
            role.Id,
            user.IsActive,
            user.CreatedAt,
            user.BranchId,
            branchName
        ));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        var user = await _dbContext.Users.FindAsync(id);
        if (user == null) return NotFound();

        if (user.Id == _currentUser.UserId)
        {
            return BadRequest(new { message = "You cannot delete your own account while logged in." });
        }

        _dbContext.Users.Remove(user);
        await _dbContext.SaveChangesAsync();

        return NoContent();
    }
}
