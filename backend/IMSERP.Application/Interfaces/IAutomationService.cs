using IMSERP.Application.DTOs;

namespace IMSERP.Application.Interfaces;

public interface IAutomationService
{
    Task<AutomationSettingsDto> GetSettingsAsync(Guid tenantId);
    Task<AutomationSettingsDto> UpdateSettingsAsync(Guid tenantId, SaveAutomationSettingsDto dto);
    Task<RunAutomationJobResultDto> ExecuteAbsenteeAlertsAsync(Guid tenantId);
    Task<RunAutomationJobResultDto> ExecuteFeeDueRemindersAsync(Guid tenantId, int? daysPrior = null);
    Task<RunAutomationJobResultDto> ExecuteBiometricSyncAsync(Guid tenantId);
    Task<RunAutomationJobResultDto> ExecuteLateFeeComputationAsync(Guid tenantId, decimal? dailyRate = null, int? graceDays = null);
    Task<RunAutomationJobResultDto> RunJobAsync(Guid tenantId, string jobName);
}
