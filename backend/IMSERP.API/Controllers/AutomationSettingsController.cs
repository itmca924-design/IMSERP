using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/automation-settings")]
[Authorize]
public class AutomationSettingsController : ControllerBase
{
    private readonly IAutomationService _automationService;
    private readonly ICurrentUserService _currentUser;

    public AutomationSettingsController(
        IAutomationService automationService,
        ICurrentUserService currentUser)
    {
        _automationService = automationService;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<AutomationSettingsDto>> GetSettings()
    {
        var settings = await _automationService.GetSettingsAsync(_currentUser.TenantId);
        return Ok(settings);
    }

    [HttpPut]
    public async Task<ActionResult<AutomationSettingsDto>> UpdateSettings([FromBody] SaveAutomationSettingsDto dto)
    {
        var updated = await _automationService.UpdateSettingsAsync(_currentUser.TenantId, dto);
        return Ok(updated);
    }

    [HttpPost("run/{jobName}")]
    public async Task<ActionResult<RunAutomationJobResultDto>> RunJob(string jobName)
    {
        try
        {
            var result = await _automationService.RunJobAsync(_currentUser.TenantId, jobName);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Failed to execute job '{jobName}': {ex.Message}" });
        }
    }
}
