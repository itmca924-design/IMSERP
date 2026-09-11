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
            u.CreatedAt
        )).ToList();

        return Ok(dtos);
    }

    [HttpPost]
    public async Task<ActionResult<UserDto>> CreateUser([FromBody] CreateUserDto dto)
    {
        var existing = await _dbContext.Users.AnyAsync(u => u.Username.ToLower() == dto.Username.Trim().ToLower());
        if (existing)
        {
            return BadRequest(new { message = "Username already exists." });
        }

        var role = await _dbContext.Roles.FindAsync(dto.RoleId);
        if (role == null)
        {
            return BadRequest(new { message = "Selected Role is invalid." });
        }

        var user = new User
        {
            TenantId = _currentUser.TenantId,
            Username = dto.Username.Trim(),
            PasswordHash = _passwordHasher.HashPassword(dto.Password),
            FullName = dto.FullName.Trim(),
            Email = dto.Email?.Trim(),
            PhoneNumber = dto.PhoneNumber?.Trim(),
            RoleId = dto.RoleId,
            Role = UserRole.InstituteAdmin,
            IsActive = dto.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync();

        return Ok(new UserDto(
            user.Id,
            user.Username,
            user.FullName,
            user.Email,
            user.PhoneNumber,
            role.Name,
            role.Id,
            user.IsActive,
            user.CreatedAt
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

        if (!string.IsNullOrWhiteSpace(dto.Password))
        {
            user.PasswordHash = _passwordHasher.HashPassword(dto.Password);
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new UserDto(
            user.Id,
            user.Username,
            user.FullName,
            user.Email,
            user.PhoneNumber,
            role.Name,
            role.Id,
            user.IsActive,
            user.CreatedAt
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
