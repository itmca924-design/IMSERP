using System;
using System.Security.Claims;
using System.Threading.Tasks;
using IMSERP.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace IMSERP.API.Hubs;

[Authorize]
public class PresenceHub : Hub
{
    private readonly PresenceTracker _tracker;

    public PresenceHub(PresenceTracker tracker)
    {
        _tracker = tracker;
    }

    public override async Task OnConnectedAsync()
    {
        var user = Context.User;
        if (user?.Identity?.IsAuthenticated == true)
        {
            var userIdStr = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var tenantIdStr = user.FindFirst("tenantId")?.Value;
            var branchIdStr = user.FindFirst("branchId")?.Value;
            var branchName = user.FindFirst("branchName")?.Value;
            var username = user.FindFirst(ClaimTypes.Name)?.Value ?? user.FindFirst("username")?.Value ?? "User";
            var fullName = user.FindFirst("fullName")?.Value ?? username;
            var role = user.FindFirst(ClaimTypes.Role)?.Value ?? "Staff";
            var sessionId = user.FindFirst("sessionId")?.Value ?? Guid.NewGuid().ToString();

            if (Guid.TryParse(userIdStr, out var userId) && Guid.TryParse(tenantIdStr, out var tenantId))
            {
                Guid? branchId = Guid.TryParse(branchIdStr, out var bId) ? bId : null;

                var connection = new UserPresenceConnection(
                    Context.ConnectionId,
                    userId,
                    username,
                    fullName,
                    role,
                    tenantId,
                    branchId,
                    branchName,
                    sessionId,
                    DateTime.UtcNow
                );

                _tracker.AddConnection(connection);

                // Add to SignalR groups for targeted notifications
                await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant_{tenantId}");
                await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
                if (branchId.HasValue)
                {
                    await Groups.AddToGroupAsync(Context.ConnectionId, $"branch_{branchId.Value}");
                }

                // Notify all clients in tenant that active user count changed
                await Clients.Group($"tenant_{tenantId}").SendAsync("ActiveUsersUpdated");
            }
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var removed = _tracker.RemoveConnection(Context.ConnectionId);
        if (removed != null)
        {
            await Clients.Group($"tenant_{removed.TenantId}").SendAsync("ActiveUsersUpdated");
        }

        await base.OnDisconnectedAsync(exception);
    }

    public Task<int> GetActiveCount(string? branchId)
    {
        var tenantIdStr = Context.User?.FindFirst("tenantId")?.Value;
        if (Guid.TryParse(tenantIdStr, out var tenantId))
        {
            Guid? bId = Guid.TryParse(branchId, out var parsed) ? parsed : null;
            return Task.FromResult(_tracker.GetActiveUsersCount(tenantId, bId));
        }
        return Task.FromResult(0);
    }
}
