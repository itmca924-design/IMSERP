using System;
using System.Security.Claims;
using IMSERP.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PresenceController : ControllerBase
{
    private readonly PresenceTracker _tracker;

    public PresenceController(PresenceTracker tracker)
    {
        _tracker = tracker;
    }

    [HttpGet("active-users")]
    public IActionResult GetActiveUsers([FromQuery] Guid? branchId)
    {
        var tenantIdStr = User.FindFirst("tenantId")?.Value;
        if (!Guid.TryParse(tenantIdStr, out var tenantId))
        {
            return Unauthorized();
        }

        var users = _tracker.GetActiveUsers(tenantId, branchId);
        var count = users.Count;

        return Ok(new
        {
            totalActive = count,
            branchId = branchId,
            users = users
        });
    }

    [HttpGet("active-count")]
    public IActionResult GetActiveCount([FromQuery] Guid? branchId)
    {
        var tenantIdStr = User.FindFirst("tenantId")?.Value;
        if (!Guid.TryParse(tenantIdStr, out var tenantId))
        {
            return Unauthorized();
        }

        var count = _tracker.GetActiveUsersCount(tenantId, branchId);
        return Ok(new { count });
    }
}
