using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/finance/fee-recovery-agent")]
[Authorize]
public class FeeRecoveryAgentController : ControllerBase
{
    private readonly IFeeRecoveryAgentService _agentService;
    private readonly ICurrentUserService _currentUser;

    public FeeRecoveryAgentController(
        IFeeRecoveryAgentService agentService,
        ICurrentUserService currentUser)
    {
        _agentService = agentService;
        _currentUser = currentUser;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<FeeRecoverySummaryKpiDto>> GetSummary(
        [FromQuery] Guid? branchId,
        [FromQuery] string? academicScope = "All")
    {
        var targetBranch = branchId ?? _currentUser.BranchId;
        var summary = await _agentService.GetSummaryKpisAsync(_currentUser.TenantId, targetBranch, academicScope);
        return Ok(summary);
    }

    [HttpGet("plans")]
    public async Task<IActionResult> GetPlans(
        [FromQuery] Guid? branchId,
        [FromQuery] Guid? classId,
        [FromQuery] Guid? batchId,
        [FromQuery] string? riskLevel,
        [FromQuery] string? status,
        [FromQuery] string? academicScope = "All",
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = "overdue",
        [FromQuery] string? sortDirection = "desc",
        [FromQuery] int? pageNumber = null,
        [FromQuery] int? pageSize = null)
    {
        var targetBranch = branchId ?? _currentUser.BranchId;
        var pNum = pageNumber ?? 1;
        var pSize = pageSize ?? (pageNumber.HasValue ? 10 : 1000);
        var plans = await _agentService.GetPlansAsync(
            _currentUser.TenantId, targetBranch, classId, batchId, riskLevel, status,
            academicScope, search, sortBy, sortDirection, pNum, pSize);

        // Backward compatibility: If client did not send pageNumber (e.g. cached client expecting raw array), return Items directly
        if (!pageNumber.HasValue)
        {
            return Ok(plans.Items);
        }

        return Ok(plans);
    }

    [HttpPost("run-analysis")]
    public async Task<ActionResult<PagedResult<FeeRecoveryPlanItemDto>>> RunAnalysis([FromBody] RunFeeRecoveryAnalysisRequestDto request)
    {
        var targetBranch = request.BranchId ?? _currentUser.BranchId;
        var plans = await _agentService.RunAnalysisAsync(_currentUser.TenantId, targetBranch, request);
        return Ok(plans);
    }

    [HttpPost("dispatch-nudge")]
    public async Task<ActionResult<bool>> DispatchNudge([FromBody] DispatchRecoveryNudgeRequestDto request)
    {
        var ok = await _agentService.DispatchNudgeAsync(_currentUser.TenantId, _currentUser.BranchId, request);
        return Ok(ok);
    }

    [HttpPost("batch-dispatch-nudges")]
    public async Task<ActionResult<int>> BatchDispatchNudges([FromBody] BatchDispatchNudgesRequestDto request)
    {
        var count = await _agentService.BatchDispatchNudgesAsync(_currentUser.TenantId, _currentUser.BranchId, request);
        return Ok(count);
    }

    [HttpPost("record-promise")]
    public async Task<ActionResult<FeePromiseItemDto>> RecordPromise([FromBody] RecordPromiseToPayDto request)
    {
        string recorder = _currentUser.Username ?? _currentUser.UserRole ?? "Accounts Staff";
        var promise = await _agentService.RecordPromiseAsync(_currentUser.TenantId, _currentUser.BranchId, request, recorder);
        return Ok(promise);
    }

    [HttpGet("promises")]
    public async Task<ActionResult<List<FeePromiseItemDto>>> GetPromises(
        [FromQuery] Guid? branchId,
        [FromQuery] bool? pendingOnly,
        [FromQuery] string? academicScope = "All")
    {
        var targetBranch = branchId ?? _currentUser.BranchId;
        var promises = await _agentService.GetPromisesAsync(_currentUser.TenantId, targetBranch, pendingOnly, academicScope);
        return Ok(promises);
    }

    [HttpPut("promises/{id}")]
    public async Task<ActionResult<bool>> UpdatePromiseStatus(Guid id, [FromBody] UpdatePromiseStatusDto request)
    {
        var ok = await _agentService.UpdatePromiseStatusAsync(_currentUser.TenantId, id, request);
        return Ok(ok);
    }
}

