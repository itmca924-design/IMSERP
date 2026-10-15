using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;

namespace IMSERP.API.Services;

public record UserPresenceConnection(
    string ConnectionId,
    Guid UserId,
    string Username,
    string FullName,
    string Role,
    Guid TenantId,
    Guid? BranchId,
    string? BranchName,
    string SessionId,
    DateTime ConnectedAt
);

public record ActiveUserDto(
    Guid UserId,
    string Username,
    string FullName,
    string Role,
    Guid TenantId,
    Guid? BranchId,
    string? BranchName,
    DateTime LastActiveAt
);

public class PresenceTracker
{
    // ConnectionId -> UserPresenceConnection
    private readonly ConcurrentDictionary<string, UserPresenceConnection> _connections = new();
    
    // UserId -> Latest ActiveSessionId (Fast memory lookup for single-session enforcement)
    private readonly ConcurrentDictionary<Guid, string> _userActiveSessions = new();

    public void AddConnection(UserPresenceConnection connection)
    {
        _connections[connection.ConnectionId] = connection;
        _userActiveSessions[connection.UserId] = connection.SessionId;
    }

    public UserPresenceConnection? RemoveConnection(string connectionId)
    {
        _connections.TryRemove(connectionId, out var removed);
        return removed;
    }

    public void SetActiveSession(Guid userId, string sessionId)
    {
        _userActiveSessions[userId] = sessionId;
    }

    public string? GetActiveSession(Guid userId)
    {
        _userActiveSessions.TryGetValue(userId, out var sessionId);
        return sessionId;
    }

    public bool IsUserOnline(Guid userId)
    {
        return _connections.Values.Any(c => c.UserId == userId);
    }

    public List<UserPresenceConnection> GetConnectionsForUser(Guid userId)
    {
        return _connections.Values.Where(c => c.UserId == userId).ToList();
    }

    public List<UserPresenceConnection> GetConnectionsForUserExcluding(Guid userId, string? excludeSessionId)
    {
        return _connections.Values
            .Where(c => c.UserId == userId && (string.IsNullOrEmpty(excludeSessionId) || c.SessionId != excludeSessionId))
            .ToList();
    }

    public List<ActiveUserDto> GetActiveUsers(Guid tenantId, Guid? branchId)
    {
        var query = _connections.Values.Where(c => c.TenantId == tenantId);

        if (branchId.HasValue)
        {
            query = query.Where(c => c.BranchId == branchId.Value);
        }

        // Distinct by UserId so multiple tabs by the same user on same machine count as 1 user
        return query
            .GroupBy(c => c.UserId)
            .Select(g =>
            {
                var latest = g.OrderByDescending(x => x.ConnectedAt).First();
                return new ActiveUserDto(
                    latest.UserId,
                    latest.Username,
                    latest.FullName,
                    latest.Role,
                    latest.TenantId,
                    latest.BranchId,
                    latest.BranchName,
                    latest.ConnectedAt
                );
            })
            .OrderBy(u => u.FullName)
            .ToList();
    }

    public int GetActiveUsersCount(Guid tenantId, Guid? branchId)
    {
        var query = _connections.Values.Where(c => c.TenantId == tenantId);

        if (branchId.HasValue)
        {
            query = query.Where(c => c.BranchId == branchId.Value);
        }

        return query.Select(c => c.UserId).Distinct().Count();
    }
}
