using IMSERP.Application.Interfaces;
using IMSERP.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace IMSERP.Infrastructure.Services;

public class InstituteAutomationBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<InstituteAutomationBackgroundService> _logger;

    public InstituteAutomationBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<InstituteAutomationBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("🚀 [InstituteAutomationBackgroundService] Automation Engine starting up...");

        // Small initial warm-up delay on server boot
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IMSERPDbContext>();
                var automationService = scope.ServiceProvider.GetRequiredService<IAutomationService>();

                var istZone = GetIstTimeZone();
                var nowIst = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istZone);
                var todayIst = nowIst.Date;

                // Discover active tenants
                var tenantIds = await db.Tenants
                    .Where(t => t.IsActive)
                    .Select(t => t.Id)
                    .ToListAsync(stoppingToken);

                if (tenantIds.Count == 0)
                {
                    tenantIds = await db.Users
                        .Select(u => u.TenantId)
                        .Distinct()
                        .ToListAsync(stoppingToken);
                }

                foreach (var tenantId in tenantIds)
                {
                    var settings = await db.AutomationSettings
                        .FirstOrDefaultAsync(s => s.TenantId == tenantId, stoppingToken);

                    if (settings == null)
                    {
                        // Ensure settings row exists
                        await automationService.GetSettingsAsync(tenantId);
                        continue;
                    }

                    // 1. Biometric / RFID Realtime Polling Sync
                    if (settings.BiometricSyncEnabled)
                    {
                        // Run biometric sync if not synced in the last 45 seconds
                        if (!settings.LastBiometricSyncAt.HasValue ||
                            (DateTime.UtcNow - settings.LastBiometricSyncAt.Value).TotalSeconds >= 45)
                        {
                            try
                            {
                                await automationService.ExecuteBiometricSyncAsync(tenantId);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "[BackgroundService] Biometric sync error for tenant {TenantId}", tenantId);
                            }
                        }
                    }

                    // 2. Daily Absentee Alert (Target: 10:30 AM IST)
                    if (settings.DailyAbsenteeAlertEnabled)
                    {
                        var targetTime = TimeSpan.FromHours(10).Add(TimeSpan.FromMinutes(30));
                        if (TimeSpan.TryParse(settings.DailyAbsenteeAlertTime, out var parsedTime))
                        {
                            targetTime = parsedTime;
                        }

                        var lastRunDate = settings.LastAbsenteeAlertDate.HasValue
                            ? TimeZoneInfo.ConvertTimeFromUtc(settings.LastAbsenteeAlertDate.Value, istZone).Date
                            : (DateTime?)null;

                        if (nowIst.TimeOfDay >= targetTime && lastRunDate != todayIst)
                        {
                            try
                            {
                                _logger.LogInformation("⏰ [BackgroundService] Triggering Daily Absentee Alerts for Tenant {TenantId} at {Time}", tenantId, nowIst);
                                await automationService.ExecuteAbsenteeAlertsAsync(tenantId);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "[BackgroundService] Daily Absentee Alert execution failed for tenant {TenantId}", tenantId);
                            }
                        }
                    }

                    // 3. Fee Due Auto-Reminders (Morning dispatch, e.g. at or after 09:00 AM IST)
                    if (settings.FeeDueRemindersEnabled)
                    {
                        var morningDueTime = new TimeSpan(9, 0, 0);
                        var lastReminderDate = settings.LastFeeReminderDate.HasValue
                            ? TimeZoneInfo.ConvertTimeFromUtc(settings.LastFeeReminderDate.Value, istZone).Date
                            : (DateTime?)null;

                        if (nowIst.TimeOfDay >= morningDueTime && lastReminderDate != todayIst)
                        {
                            try
                            {
                                _logger.LogInformation("📢 [BackgroundService] Triggering Fee Due Auto-Reminders for Tenant {TenantId}", tenantId);
                                await automationService.ExecuteFeeDueRemindersAsync(tenantId, settings.FeeDueDaysPrior);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "[BackgroundService] Fee Due Reminder execution failed for tenant {TenantId}", tenantId);
                            }
                        }
                    }

                    // 4. Late Fee Rule Auto-Compute (Runs daily at midnight or after 00:05 AM IST)
                    if (settings.LateFeeAutoComputeEnabled)
                    {
                        try
                        {
                            await automationService.ExecuteLateFeeComputationAsync(
                                tenantId,
                                settings.LateFeeDailyRate,
                                settings.LateFeeGraceDays
                            );
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "[BackgroundService] Late fee calculation failed for tenant {TenantId}", tenantId);
                        }
                    }
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "❌ [InstituteAutomationBackgroundService] Unhandled error during automation cycle");
            }

            // Loop interval: 60 seconds
            await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);
        }

        _logger.LogInformation("🛑 [InstituteAutomationBackgroundService] Automation engine stopped gracefully.");
    }

    private static TimeZoneInfo GetIstTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
        }
        catch
        {
            return TimeZoneInfo.Utc;
        }
    }
}
