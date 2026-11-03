using IMSERP.API.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace IMSERP.API.Services;

public sealed class DynamicMenuPermissionHubFilter : IHubFilter
{
    private readonly IMenuPermissionService _permissions;

    public DynamicMenuPermissionHubFilter(IMenuPermissionService permissions)
    {
        _permissions = permissions;
    }

    public async Task OnConnectedAsync(HubLifetimeContext context, Func<HubLifetimeContext, Task> next)
    {
        var route = GetMenuRoute(context.Hub);
        if (!await _permissions.HasPermissionAsync(route, MenuPermissionOperation.View, context.Context.ConnectionAborted))
        {
            context.Context.Abort();
            return;
        }

        await next(context);
    }

    public Task OnDisconnectedAsync(
        HubLifetimeContext context,
        Exception? exception,
        Func<HubLifetimeContext, Exception?, Task> next) =>
        next(context, exception);

    public async ValueTask<object?> InvokeMethodAsync(
        HubInvocationContext context,
        Func<HubInvocationContext, ValueTask<object?>> next)
    {
        var (route, operation) = GetPermission(context.Hub, context.HubMethodName);
        if (!await _permissions.HasPermissionAsync(route, operation, context.Context.ConnectionAborted))
        {
            throw new HubException("You do not have permission to perform this operation.");
        }

        return await next(context);
    }

    private static string GetMenuRoute(Hub hub) => hub switch
    {
        ChatHub => "/chat",
        PresenceHub => "/dashboard",
        _ => throw new HubException("No menu permission route is configured for this hub.")
    };

    private static (string Route, MenuPermissionOperation Operation) GetPermission(Hub hub, string methodName)
    {
        if (hub is ChatHub)
        {
            return methodName switch
            {
                "JoinConversation" or "LeaveConversation" or "MarkAsRead" =>
                    ("/chat", MenuPermissionOperation.View),
                "SendMessage" or "SendTyping" => ("/chat", MenuPermissionOperation.Create),
                "DeleteMessage" or "ClearConversation" => ("/chat", MenuPermissionOperation.Delete),
                _ => throw new HubException("No menu permission operation is configured for this chat action.")
            };
        }

        if (hub is PresenceHub && methodName == "GetActiveCount")
        {
            return ("/dashboard", MenuPermissionOperation.View);
        }

        throw new HubException("No menu permission operation is configured for this hub action.");
    }
}
