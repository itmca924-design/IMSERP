using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly IIMSERPDbContext _dbContext;

    public ChatHub(IIMSERPDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override async Task OnConnectedAsync()
    {
        var user = Context.User;
        if (user?.Identity?.IsAuthenticated == true)
        {
            var userIdStr = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var tenantIdStr = user.FindFirst("tenantId")?.Value;
            var branchIdStr = user.FindFirst("branchId")?.Value;

            if (Guid.TryParse(userIdStr, out var userId) && Guid.TryParse(tenantIdStr, out var tenantId))
            {
                // Join private user inbox channel
                await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");

                // Join tenant channel
                await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant_{tenantId}");

                // Join branch channel
                if (Guid.TryParse(branchIdStr, out var branchId))
                {
                    await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant_{tenantId}_branch_{branchId}");
                }
            }
        }

        await base.OnConnectedAsync();
    }

    public async Task JoinConversation(string conversationId)
    {
        if (Guid.TryParse(conversationId, out var convGuid))
        {
            var userId = GetCurrentUserId();
            var tenantId = GetCurrentTenantId();

            // Verify user is a participant of this conversation
            var isParticipant = await _dbContext.ChatParticipants
                .IgnoreQueryFilters()
                .AnyAsync(p => p.TenantId == tenantId && p.ConversationId == convGuid && p.UserId == userId);

            if (isParticipant)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"conv_{conversationId}");
            }
        }
    }

    public async Task LeaveConversation(string conversationId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"conv_{conversationId}");
    }

    public async Task SendTyping(string conversationId, bool isTyping)
    {
        var userId = GetCurrentUserId();
        var fullName = Context.User?.FindFirst("fullName")?.Value ?? Context.User?.FindFirst(ClaimTypes.Name)?.Value ?? "User";

        await Clients.OthersInGroup($"conv_{conversationId}").SendAsync("UserTyping", new
        {
            conversationId,
            userId,
            fullName,
            isTyping
        });
    }

    public async Task<ChatMessageDto?> SendMessage(SendMessageRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Content) && string.IsNullOrWhiteSpace(request.AttachmentUrl))
        {
            return null;
        }

        var userId = GetCurrentUserId();
        var tenantId = GetCurrentTenantId();
        var branchId = GetCurrentBranchId();
        var fullName = Context.User?.FindFirst("fullName")?.Value ?? Context.User?.FindFirst(ClaimTypes.Name)?.Value ?? "User";
        var role = Context.User?.FindFirst(ClaimTypes.Role)?.Value ?? "Staff";

        // Verify conversation belongs to this tenant and branch
        var conversation = await _dbContext.ChatConversations
            .IgnoreQueryFilters()
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == request.ConversationId);

        if (conversation == null) return null;

        // Check if user is participant, or add if teacher/admin
        var participant = conversation.Participants.FirstOrDefault(p => p.UserId == userId);
        if (participant == null)
        {
            // If user has global teacher or admin privileges, auto-join
            if (role == "Teacher" || role == "Principal" || role == "Admin" || role == "SuperAdmin")
            {
                participant = new ChatParticipant
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = branchId,
                    ConversationId = conversation.Id,
                    UserId = userId,
                    RoleInChat = "Member",
                    JoinedAt = DateTime.UtcNow
                };
                _dbContext.ChatParticipants.Add(participant);
            }
            else
            {
                return null; // Not authorized
            }
        }

        // Create message
        var message = new ChatMessage
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = conversation.BranchId ?? branchId,
            ConversationId = conversation.Id,
            SenderUserId = userId,
            SenderName = fullName,
            SenderRole = role,
            Content = request.Content?.Trim() ?? string.Empty,
            MessageType = request.MessageType ?? "Text",
            AttachmentUrl = request.AttachmentUrl,
            AttachmentFileName = request.AttachmentFileName,
            FileSizeBytes = request.FileSizeBytes,
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false
        };

        _dbContext.ChatMessages.Add(message);

        // Update conversation summary
        conversation.LastMessageContent = message.Content.Length > 100 ? message.Content.Substring(0, 97) + "..." : message.Content;
        if (string.IsNullOrWhiteSpace(conversation.LastMessageContent) && !string.IsNullOrWhiteSpace(message.AttachmentFileName))
        {
            conversation.LastMessageContent = $"📎 {message.AttachmentFileName}";
        }
        conversation.LastMessageAt = message.CreatedAt;
        conversation.LastMessageSenderId = userId;
        conversation.LastMessageSenderName = fullName;

        // Increment unread count for other participants
        foreach (var p in conversation.Participants.Where(p => p.UserId != userId))
        {
            p.UnreadCount++;
        }

        await _dbContext.SaveChangesAsync();

        var messageDto = new ChatMessageDto
        {
            Id = message.Id,
            ConversationId = message.ConversationId,
            SenderUserId = message.SenderUserId,
            SenderName = message.SenderName,
            SenderRole = message.SenderRole,
            Content = message.Content,
            MessageType = message.MessageType,
            AttachmentUrl = message.AttachmentUrl,
            AttachmentFileName = message.AttachmentFileName,
            FileSizeBytes = message.FileSizeBytes,
            CreatedAt = message.CreatedAt,
            IsMe = false
        };

        // Broadcast to anyone actively inside the conversation room
        await Clients.Group($"conv_{conversation.Id}").SendAsync("ReceiveMessage", messageDto);

        // Also push notifications to each participant's inbox for unread count & sidebar update
        foreach (var p in conversation.Participants)
        {
            await Clients.Group($"user_{p.UserId}").SendAsync("ConversationUpdated", new
            {
                conversationId = conversation.Id,
                lastMessageContent = conversation.LastMessageContent,
                lastMessageAt = conversation.LastMessageAt,
                lastMessageSenderName = fullName,
                unreadCount = p.UserId == userId ? 0 : p.UnreadCount
            });
        }

        return messageDto;
    }

    public async Task MarkAsRead(string conversationId, string lastMessageId)
    {
        if (Guid.TryParse(conversationId, out var convGuid))
        {
            var userId = GetCurrentUserId();
            var tenantId = GetCurrentTenantId();

            var participant = await _dbContext.ChatParticipants
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.ConversationId == convGuid && p.UserId == userId);

            if (participant != null)
            {
                participant.UnreadCount = 0;
                if (Guid.TryParse(lastMessageId, out var msgGuid))
                {
                    participant.LastReadMessageId = msgGuid;
                }
                await _dbContext.SaveChangesAsync();

                await Clients.Group($"conv_{conversationId}").SendAsync("MessagesRead", new
                {
                    conversationId = convGuid,
                    readerUserId = userId,
                    readAt = DateTime.UtcNow
                });
            }
        }
    }

    public async Task<bool> DeleteMessage(string messageId)
    {
        if (!Guid.TryParse(messageId, out var msgGuid)) return false;

        var userId = GetCurrentUserId();
        var tenantId = GetCurrentTenantId();
        var userRole = Context.User?.FindFirst(ClaimTypes.Role)?.Value ?? "";

        var message = await _dbContext.ChatMessages
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(m => m.Id == msgGuid && m.TenantId == tenantId);

        if (message == null || message.IsDeleted) return false;

        var isOwner = message.SenderUserId == userId;
        var isAdminOrTeacher = userRole.Contains("Admin", StringComparison.OrdinalIgnoreCase) ||
                               userRole.Contains("Teacher", StringComparison.OrdinalIgnoreCase) ||
                               userRole.Contains("Principal", StringComparison.OrdinalIgnoreCase);

        if (!isOwner && !isAdminOrTeacher) return false;

        message.IsDeleted = true;

        var conversation = await _dbContext.ChatConversations
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == message.ConversationId && c.TenantId == tenantId);

        if (conversation != null)
        {
            var prevMessage = await _dbContext.ChatMessages
                .IgnoreQueryFilters()
                .Where(m => m.ConversationId == message.ConversationId && !m.IsDeleted && m.Id != msgGuid)
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefaultAsync();

            conversation.LastMessageContent = prevMessage?.Content ?? (prevMessage?.AttachmentUrl != null ? "📎 Attachment" : null);
            conversation.LastMessageAt = prevMessage?.CreatedAt;
            conversation.LastMessageSenderId = prevMessage?.SenderUserId;
            conversation.LastMessageSenderName = prevMessage?.SenderName;
        }

        await _dbContext.SaveChangesAsync();

        await Clients.Group($"conv_{message.ConversationId}").SendAsync("MessageDeleted", new
        {
            conversationId = message.ConversationId,
            messageId = msgGuid
        });

        var participants = await _dbContext.ChatParticipants
            .IgnoreQueryFilters()
            .Where(p => p.ConversationId == message.ConversationId && p.TenantId == tenantId)
            .ToListAsync();

        foreach (var p in participants)
        {
            await Clients.Group($"user_{p.UserId}").SendAsync("ConversationUpdated", new
            {
                conversationId = message.ConversationId,
                lastMessageContent = conversation?.LastMessageContent,
                lastMessageAt = conversation?.LastMessageAt,
                lastMessageSenderName = conversation?.LastMessageSenderName,
                unreadCount = p.UnreadCount
            });
        }

        return true;
    }

    public async Task<bool> ClearConversation(string conversationId)
    {
        if (!Guid.TryParse(conversationId, out var convGuid)) return false;

        var userId = GetCurrentUserId();
        var tenantId = GetCurrentTenantId();
        var userRole = Context.User?.FindFirst(ClaimTypes.Role)?.Value ?? "";

        var conversation = await _dbContext.ChatConversations
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == convGuid && c.TenantId == tenantId);

        if (conversation == null) return false;

        var isParticipant = await _dbContext.ChatParticipants
            .IgnoreQueryFilters()
            .AnyAsync(p => p.ConversationId == convGuid && p.UserId == userId && p.TenantId == tenantId);

        if (!isParticipant) return false;

        var isAdminOrTeacher = userRole.Contains("Admin", StringComparison.OrdinalIgnoreCase) ||
                               userRole.Contains("Teacher", StringComparison.OrdinalIgnoreCase) ||
                               userRole.Contains("Principal", StringComparison.OrdinalIgnoreCase);

        if (conversation.ConversationType == ChatConversationType.ClassGroup && !isAdminOrTeacher)
        {
            return false;
        }

        var messages = await _dbContext.ChatMessages
            .IgnoreQueryFilters()
            .Where(m => m.ConversationId == convGuid && m.TenantId == tenantId && !m.IsDeleted)
            .ToListAsync();

        foreach (var msg in messages)
        {
            msg.IsDeleted = true;
        }

        conversation.LastMessageContent = null;
        conversation.LastMessageSenderId = null;
        conversation.LastMessageSenderName = null;

        await _dbContext.SaveChangesAsync();

        await Clients.Group($"conv_{convGuid}").SendAsync("ConversationCleared", new
        {
            conversationId = convGuid
        });

        var participants = await _dbContext.ChatParticipants
            .IgnoreQueryFilters()
            .Where(p => p.ConversationId == convGuid && p.TenantId == tenantId)
            .ToListAsync();

        foreach (var p in participants)
        {
            await Clients.Group($"user_{p.UserId}").SendAsync("ConversationUpdated", new
            {
                conversationId = convGuid,
                lastMessageContent = (string?)null,
                lastMessageAt = conversation.LastMessageAt,
                lastMessageSenderName = (string?)null,
                unreadCount = 0
            });
        }

        return true;
    }

    private Guid GetCurrentUserId()
    {
        var idStr = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(idStr, out var id) ? id : Guid.Empty;
    }

    private Guid GetCurrentTenantId()
    {
        var idStr = Context.User?.FindFirst("tenantId")?.Value;
        return Guid.TryParse(idStr, out var id) ? id : Guid.Empty;
    }

    private Guid? GetCurrentBranchId()
    {
        var idStr = Context.User?.FindFirst("branchId")?.Value;
        return Guid.TryParse(idStr, out var id) ? id : null;
    }
}
