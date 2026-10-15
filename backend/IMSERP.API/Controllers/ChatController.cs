using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using IMSERP.API.Hubs;
using IMSERP.API.Services;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChatController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;
    private readonly PresenceTracker _presenceTracker;
    private readonly IHubContext<ChatHub> _chatHubContext;
    private readonly IWebHostEnvironment _env;

    public ChatController(
        IIMSERPDbContext dbContext,
        ICurrentUserService currentUser,
        PresenceTracker presenceTracker,
        IHubContext<ChatHub> chatHubContext,
        IWebHostEnvironment env)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _presenceTracker = presenceTracker;
        _chatHubContext = chatHubContext;
        _env = env;
    }

    /// <summary>
    /// Gets all active conversations for the current user (Class groups + 1-on-1 direct chats)
    /// </summary>
    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        var tenantId = _currentUser.TenantId;
        var userId = _currentUser.UserId;
        var branchId = _currentUser.BranchId;

        // Auto-provision class group conversation for student or teacher if not already added
        await AutoProvisionClassRoomsAsync(tenantId, userId, branchId);

        // Fetch all conversations where current user is a participant
        var participantEntries = await _dbContext.ChatParticipants
            .IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantId && p.UserId == userId)
            .Include(p => p.Conversation)
                .ThenInclude(c => c!.Participants)
                    .ThenInclude(cp => cp.User)
            .OrderByDescending(p => p.Conversation!.LastMessageAt ?? p.Conversation!.CreatedAt)
            .ToListAsync();

        var result = new List<ChatConversationDto>();

        foreach (var entry in participantEntries)
        {
            var conv = entry.Conversation;
            if (conv == null || !conv.IsActive) continue;

            var dto = new ChatConversationDto
            {
                Id = conv.Id,
                TenantId = conv.TenantId,
                BranchId = conv.BranchId,
                ConversationType = (int)conv.ConversationType,
                ClassId = conv.ClassId,
                SectionId = conv.SectionId,
                Title = conv.Title,
                Description = conv.Description,
                LastMessageContent = conv.LastMessageContent,
                LastMessageAt = conv.LastMessageAt,
                LastMessageSenderId = conv.LastMessageSenderId,
                LastMessageSenderName = conv.LastMessageSenderName,
                UnreadCount = entry.UnreadCount
            };

            // If 1-on-1 Direct Chat, personalize Title & Avatar to the OTHER participant
            if (conv.ConversationType == ChatConversationType.Direct1on1)
            {
                var otherParticipant = conv.Participants.FirstOrDefault(p => p.UserId != userId);
                if (otherParticipant?.User != null)
                {
                    dto.Title = otherParticipant.User.FullName;
                    dto.AvatarUrl = otherParticipant.User.ProfilePhoto;
                    dto.TargetUserId = otherParticipant.UserId;
                    dto.TargetUserRole = otherParticipant.User.Role.ToString();
                    dto.IsOnline = _presenceTracker.IsUserOnline(otherParticipant.UserId);
                }
            }
            else
            {
                // Group chat: check if any participant is online
                dto.IsOnline = conv.Participants.Any(p => p.UserId != userId && _presenceTracker.IsUserOnline(p.UserId));
            }

            dto.Participants = conv.Participants.Select(p => new ChatParticipantDto
            {
                Id = p.Id,
                UserId = p.UserId,
                FullName = p.User?.FullName ?? "Member",
                Role = p.User?.Role.ToString() ?? "User",
                RoleInChat = p.RoleInChat,
                AvatarUrl = p.User?.ProfilePhoto,
                IsOnline = _presenceTracker.IsUserOnline(p.UserId)
            }).ToList();

            result.Add(dto);
        }

        return Ok(result);
    }

    /// <summary>
    /// Gets message history for a conversation with pagination
    /// </summary>
    [HttpGet("conversations/{conversationId}/messages")]
    public async Task<IActionResult> GetMessages(Guid conversationId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var tenantId = _currentUser.TenantId;
        var userId = _currentUser.UserId;

        // Verify participant
        var participant = await _dbContext.ChatParticipants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.ConversationId == conversationId && p.UserId == userId);

        if (participant == null)
        {
            return Forbid("You are not a participant in this conversation.");
        }

        // Reset unread count
        if (participant.UnreadCount > 0)
        {
            participant.UnreadCount = 0;
            await _dbContext.SaveChangesAsync();
        }

        var total = await _dbContext.ChatMessages
            .IgnoreQueryFilters()
            .CountAsync(m => m.TenantId == tenantId && m.ConversationId == conversationId && !m.IsDeleted);

        var messages = await _dbContext.ChatMessages
            .IgnoreQueryFilters()
            .Where(m => m.TenantId == tenantId && m.ConversationId == conversationId && !m.IsDeleted)
            .OrderByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Reverse to chronological order (oldest first)
        messages.Reverse();

        var messageDtos = messages.Select(m => new ChatMessageDto
        {
            Id = m.Id,
            ConversationId = m.ConversationId,
            SenderUserId = m.SenderUserId,
            SenderName = m.SenderName,
            SenderRole = m.SenderRole,
            Content = m.Content,
            MessageType = m.MessageType,
            AttachmentUrl = m.AttachmentUrl,
            AttachmentFileName = m.AttachmentFileName,
            FileSizeBytes = m.FileSizeBytes,
            CreatedAt = m.CreatedAt,
            IsMe = m.SenderUserId == userId
        }).ToList();

        return Ok(new
        {
            total,
            page,
            pageSize,
            messages = messageDtos
        });
    }

    /// <summary>
    /// Starts or retrieves an existing 1-on-1 direct conversation with another user
    /// </summary>
    [HttpPost("direct")]
    public async Task<IActionResult> StartDirectChat([FromBody] StartDirectChatRequestDto request)
    {
        var tenantId = _currentUser.TenantId;
        var userId = _currentUser.UserId;
        var branchId = _currentUser.BranchId;

        if (request.TargetUserId == userId)
        {
            return BadRequest(new { message = "Cannot start a direct chat with yourself." });
        }

        // Verify target user belongs to the same tenant and branch
        var targetUser = await _dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.TenantId == tenantId && u.Id == request.TargetUserId && u.IsActive);

        if (targetUser == null)
        {
            return NotFound(new { message = "Target user not found in this institute." });
        }

        // Check if a direct conversation already exists between these two users
        var existingConvId = await _dbContext.ChatParticipants
            .IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantId && (p.UserId == userId || p.UserId == request.TargetUserId))
            .GroupBy(p => p.ConversationId)
            .Where(g => g.Count() == 2)
            .Select(g => g.Key)
            .FirstOrDefaultAsync();

        if (existingConvId != Guid.Empty)
        {
            var existingConv = await _dbContext.ChatConversations
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(c => c.Id == existingConvId && c.ConversationType == ChatConversationType.Direct1on1);

            if (existingConv != null)
            {
                return Ok(new { conversationId = existingConv.Id, isNew = false });
            }
        }

        // Create new direct conversation
        var newConv = new ChatConversation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId ?? targetUser.BranchId,
            ConversationType = ChatConversationType.Direct1on1,
            Title = $"{targetUser.FullName}",
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId,
            IsActive = true
        };

        _dbContext.ChatConversations.Add(newConv);

        // Add both participants
        _dbContext.ChatParticipants.Add(new ChatParticipant
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = newConv.BranchId,
            ConversationId = newConv.Id,
            UserId = userId,
            RoleInChat = "Member",
            JoinedAt = DateTime.UtcNow
        });

        _dbContext.ChatParticipants.Add(new ChatParticipant
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = newConv.BranchId,
            ConversationId = newConv.Id,
            UserId = request.TargetUserId,
            RoleInChat = "Member",
            JoinedAt = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync();

        return Ok(new { conversationId = newConv.Id, isNew = true });
    }

    /// <summary>
    /// Searches available users (same-class students, cross-class students, teachers) within current tenant & branch
    /// </summary>
    [HttpGet("directory")]
    public async Task<IActionResult> GetDirectory([FromQuery] string? search = null, [FromQuery] string? filter = null)
    {
        var tenantId = _currentUser.TenantId;
        var userId = _currentUser.UserId;
        var branchId = _currentUser.BranchId;

        // Determine if current user is student or teacher
        var studentProfile = await _dbContext.Students
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.UserId == userId);

        var query = _dbContext.Users
            .IgnoreQueryFilters()
            .Where(u => u.TenantId == tenantId && u.Id != userId && u.IsActive);

        if (branchId.HasValue)
        {
            query = query.Where(u => u.BranchId == null || u.BranchId == branchId.Value);
        }

        var searchLower = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLower();

        // Match student user IDs by Class Name, Section Name, Roll Number, or Admission Number
        List<Guid> matchingStudentUserIds = new();
        if (!string.IsNullOrEmpty(searchLower))
        {
            matchingStudentUserIds = await _dbContext.Students
                .IgnoreQueryFilters()
                .Include(s => s.Class)
                .Include(s => s.Section)
                .Where(s => s.TenantId == tenantId && s.UserId.HasValue &&
                            ((s.Class != null && s.Class.Name.ToLower().Contains(searchLower)) ||
                             (s.Section != null && s.Section.Name.ToLower().Contains(searchLower)) ||
                             (s.RollNumber != null && s.RollNumber.ToLower().Contains(searchLower)) ||
                             (s.AdmissionNumber != null && s.AdmissionNumber.ToLower().Contains(searchLower))))
                .Select(s => s.UserId!.Value)
                .ToListAsync();
        }

        if (!string.IsNullOrEmpty(searchLower))
        {
            query = query.Where(u => u.FullName.ToLower().Contains(searchLower) ||
                                     u.Username.ToLower().Contains(searchLower) ||
                                     matchingStudentUserIds.Contains(u.Id));
        }

        var users = await query.Take(100).ToListAsync();

        // Get student profiles to extract Class & Section info
        var studentUserIds = users.Select(u => u.Id).ToList();
        var students = await _dbContext.Students
            .IgnoreQueryFilters()
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Where(s => s.TenantId == tenantId && s.UserId.HasValue && studentUserIds.Contains(s.UserId.Value))
            .ToDictionaryAsync(s => s.UserId!.Value, s => s);

        // Get teacher profiles
        var teachers = await _dbContext.Teachers
            .IgnoreQueryFilters()
            .Where(t => t.TenantId == tenantId && t.UserId.HasValue && studentUserIds.Contains(t.UserId.Value))
            .ToDictionaryAsync(t => t.UserId!.Value, t => t);

        var result = new List<ChatDirectoryUserDto>();

        foreach (var u in users)
        {
            var dto = new ChatDirectoryUserDto
            {
                UserId = u.Id,
                FullName = u.FullName,
                Username = u.Username,
                UserRole = u.Role.ToString(),
                ProfilePhoto = u.ProfilePhoto,
                IsOnline = _presenceTracker.IsUserOnline(u.Id)
            };

            if (students.TryGetValue(u.Id, out var st))
            {
                dto.ClassName = st.Class?.Name;
                dto.SectionName = st.Section?.Name;
                dto.RollNumber = st.RollNumber;
                dto.IsSameClass = studentProfile != null && studentProfile.ClassId == st.ClassId;
            }

            if (teachers.TryGetValue(u.Id, out var tc))
            {
                dto.EmployeeCode = tc.EmployeeCode;
                dto.Designation = tc.Designation ?? "Faculty";
            }

            // Apply filter tab
            if (filter == "same_class")
            {
                if (studentProfile != null)
                {
                    if (!dto.IsSameClass) continue;
                }
                else
                {
                    // For Teacher or Admin, showing classmates means showing students
                    if (dto.UserRole != "Student") continue;
                }
            }
            if (filter == "students" && dto.UserRole != "Student") continue;
            if (filter == "other_classes" && (dto.IsSameClass || dto.UserRole != "Student")) continue;
            if (filter == "teachers" && dto.UserRole != "Teacher" && dto.UserRole != "Principal") continue;

            result.Add(dto);
        }

        return Ok(result);
    }

    /// <summary>
    /// Uploads an attachment (Image, PDF, Document) for chat
    /// </summary>
    [HttpPost("upload-attachment")]
    public async Task<IActionResult> UploadAttachment([FromForm] IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "No file selected." });
        }

        if (file.Length > 10 * 1024 * 1024)
        {
            return BadRequest(new { message = "File size cannot exceed 10 MB." });
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowedExts = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt" };
        if (!allowedExts.Contains(ext))
        {
            return BadRequest(new { message = "File format not supported. Only images and standard documents are allowed." });
        }

        var tenantId = _currentUser.TenantId;
        var uploadsFolder = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "chat", tenantId.ToString());
        Directory.CreateDirectory(uploadsFolder);

        var safeFileName = $"{Guid.NewGuid()}{ext}";
        var filePath = Path.Combine(uploadsFolder, safeFileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var fileUrl = $"/uploads/chat/{tenantId}/{safeFileName}";

        return Ok(new
        {
            url = fileUrl,
            fileName = file.FileName,
            fileSizeBytes = file.Length,
            messageType = (ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".gif" || ext == ".webp") ? "Image" : "File"
        });
    }

    /// <summary>
    /// Auto provisions Class Group Channels for the student or teacher
    /// </summary>
    private async Task AutoProvisionClassRoomsAsync(Guid tenantId, Guid userId, Guid? branchId)
    {
        try
        {
            // 1. If user is a student, ensure their class room exists and they are joined
            var student = await _dbContext.Students
                .IgnoreQueryFilters()
                .Include(s => s.Class)
                .Include(s => s.Section)
                .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.UserId == userId);

            if (student != null && student.ClassId.HasValue)
            {
                var className = student.Class?.Name ?? "Class Room";
                var sectionName = student.Section?.Name ?? "General";
                var roomTitle = $"{className} - {sectionName} Group";

                await EnsureClassRoomAndMember(tenantId, userId, student.BranchId ?? branchId, student.ClassId, student.SectionId, roomTitle, $"Official student & faculty room for {className} ({sectionName})", "Member");
            }
            else
            {
                // 2. If user is a Teacher or Admin ("teacher global hoga, but multi tenant branch wise")
                var user = await _dbContext.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == userId);
                var roleStr = user?.Role.ToString() ?? "";
                if (roleStr.Contains("Teacher") || roleStr.Contains("Faculty") || roleStr.Contains("Admin"))
                {
                    var classesQuery = _dbContext.SchoolClasses
                        .IgnoreQueryFilters()
                        .Include(c => c.Sections)
                        .Where(c => c.TenantId == tenantId && c.IsActive);

                    if (branchId.HasValue)
                    {
                        classesQuery = classesQuery.Where(c => c.BranchId == null || c.BranchId == branchId.Value);
                    }

                    var classes = await classesQuery.ToListAsync();

                    foreach (var cls in classes)
                    {
                        var sections = cls.Sections.Where(s => s.IsActive).ToList();
                        if (sections.Count == 0)
                        {
                            await EnsureClassRoomAndMember(tenantId, userId, cls.BranchId ?? branchId, cls.Id, null, $"{cls.Name} Group", $"Official room for {cls.Name}", "Faculty");
                        }
                        else
                        {
                            foreach (var sec in sections)
                            {
                                await EnsureClassRoomAndMember(tenantId, userId, sec.BranchId ?? cls.BranchId ?? branchId, cls.Id, sec.Id, $"{cls.Name} - {sec.Name} Group", $"Official room for {cls.Name} ({sec.Name})", "Faculty");
                            }
                        }
                    }
                }
            }
        }
        catch { }
    }

    private async Task EnsureClassRoomAndMember(Guid tenantId, Guid userId, Guid? branchId, Guid? classId, Guid? sectionId, string title, string description, string roleInChat)
    {
        var classConv = await _dbContext.ChatConversations
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.ClassId == classId && c.SectionId == sectionId);

        if (classConv == null)
        {
            classConv = new ChatConversation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BranchId = branchId,
                ConversationType = ChatConversationType.ClassGroup,
                ClassId = classId,
                SectionId = sectionId,
                Title = title,
                Description = description,
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = userId,
                IsActive = true
            };
            _dbContext.ChatConversations.Add(classConv);
            await _dbContext.SaveChangesAsync();
        }

        var isParticipant = await _dbContext.ChatParticipants
            .IgnoreQueryFilters()
            .AnyAsync(p => p.TenantId == tenantId && p.ConversationId == classConv.Id && p.UserId == userId);

        if (!isParticipant)
        {
            _dbContext.ChatParticipants.Add(new ChatParticipant
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BranchId = branchId,
                ConversationId = classConv.Id,
                UserId = userId,
                RoleInChat = roleInChat,
                JoinedAt = DateTime.UtcNow
            });
            await _dbContext.SaveChangesAsync();
        }
    }
}
