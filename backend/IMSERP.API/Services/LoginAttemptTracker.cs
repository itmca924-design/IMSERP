using System.Collections.Concurrent;

namespace IMSERP.API.Services;

public interface ILoginAttemptTracker
{
    bool IsLockedOut(string tenantCode, string username, string clientIp, out TimeSpan remainingTime);
    int RecordFailedAttempt(string tenantCode, string username, string clientIp, out bool nowLockedOut, out TimeSpan lockoutDuration);
    void ResetAttempts(string tenantCode, string username, string clientIp);
}

public class LoginAttemptTracker : ILoginAttemptTracker
{
    private class AttemptRecord
    {
        public int FailedCount { get; set; }
        public DateTime LastAttemptUtc { get; set; }
        public DateTime? LockoutUntilUtc { get; set; }
    }

    private readonly ConcurrentDictionary<string, AttemptRecord> _records = new(StringComparer.OrdinalIgnoreCase);

    private const int MaxFailedAttempts = 5;
    private static readonly TimeSpan AttemptWindow = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    private static string BuildKey(string tenantCode, string username, string clientIp)
    {
        var cleanTenant = (tenantCode ?? "unknown").Trim().ToLowerInvariant();
        var cleanUser = (username ?? "unknown").Trim().ToLowerInvariant();
        var cleanIp = (clientIp ?? "0.0.0.0").Split(',')[0].Trim();
        return $"{cleanTenant}:{cleanUser}:{cleanIp}";
    }

    public bool IsLockedOut(string tenantCode, string username, string clientIp, out TimeSpan remainingTime)
    {
        CleanupExpired();
        var key = BuildKey(tenantCode, username, clientIp);
        remainingTime = TimeSpan.Zero;

        if (_records.TryGetValue(key, out var record) && record.LockoutUntilUtc.HasValue)
        {
            var now = DateTime.UtcNow;
            if (record.LockoutUntilUtc.Value > now)
            {
                remainingTime = record.LockoutUntilUtc.Value - now;
                return true;
            }
            _records.TryRemove(key, out _);
        }

        return false;
    }

    public int RecordFailedAttempt(string tenantCode, string username, string clientIp, out bool nowLockedOut, out TimeSpan lockoutDuration)
    {
        var key = BuildKey(tenantCode, username, clientIp);
        var now = DateTime.UtcNow;
        nowLockedOut = false;
        lockoutDuration = LockoutDuration;

        var record = _records.AddOrUpdate(key,
            _ => new AttemptRecord
            {
                FailedCount = 1,
                LastAttemptUtc = now
            },
            (_, existing) =>
            {
                if (now - existing.LastAttemptUtc > AttemptWindow)
                {
                    existing.FailedCount = 1;
                    existing.LockoutUntilUtc = null;
                }
                else
                {
                    existing.FailedCount++;
                }

                existing.LastAttemptUtc = now;

                if (existing.FailedCount >= MaxFailedAttempts)
                {
                    existing.LockoutUntilUtc = now.Add(LockoutDuration);
                }

                return existing;
            });

        if (record.LockoutUntilUtc.HasValue && record.LockoutUntilUtc.Value > now)
        {
            nowLockedOut = true;
        }

        return record.FailedCount;
    }

    public void ResetAttempts(string tenantCode, string username, string clientIp)
    {
        var key = BuildKey(tenantCode, username, clientIp);
        _records.TryRemove(key, out _);
    }

    private void CleanupExpired()
    {
        if (_records.Count < 500) return;

        var now = DateTime.UtcNow;
        foreach (var kvp in _records)
        {
            if (kvp.Value.LockoutUntilUtc.HasValue && kvp.Value.LockoutUntilUtc.Value < now)
            {
                _records.TryRemove(kvp.Key, out _);
            }
            else if (!kvp.Value.LockoutUntilUtc.HasValue && (now - kvp.Value.LastAttemptUtc > AttemptWindow))
            {
                _records.TryRemove(kvp.Key, out _);
            }
        }
    }
}

