namespace IMSERP.Application.DTOs;

public class ChatConversationDto
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public int ConversationType { get; set; } // 1 = Direct1on1, 2 = ClassGroup, 3 = StaffGroup, 4 = Broadcast
    public Guid? ClassId { get; set; }
    public string? ClassName { get; set; }
    public Guid? SectionId { get; set; }
    public string? SectionName { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? LastMessageContent { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public Guid? LastMessageSenderId { get; set; }
    public string? LastMessageSenderName { get; set; }
    public int UnreadCount { get; set; }
    public bool IsOnline { get; set; }
    public string? AvatarUrl { get; set; }
    public string? TargetUserRole { get; set; }
    public Guid? TargetUserId { get; set; }
    public List<ChatParticipantDto> Participants { get; set; } = new();
}

public class ChatParticipantDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string RoleInChat { get; set; } = "Member";
    public string? AvatarUrl { get; set; }
    public bool IsOnline { get; set; }
    public DateTime? LastActiveAt { get; set; }
}

public class ChatMessageDto
{
    public Guid Id { get; set; }
    public Guid ConversationId { get; set; }
    public Guid SenderUserId { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string SenderRole { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string MessageType { get; set; } = "Text"; // Text, Image, File
    public string? AttachmentUrl { get; set; }
    public string? AttachmentFileName { get; set; }
    public long? FileSizeBytes { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsMe { get; set; }
}

public class SendMessageRequestDto
{
    public Guid ConversationId { get; set; }
    public string Content { get; set; } = string.Empty;
    public string MessageType { get; set; } = "Text";
    public string? AttachmentUrl { get; set; }
    public string? AttachmentFileName { get; set; }
    public long? FileSizeBytes { get; set; }
}

public class StartDirectChatRequestDto
{
    public Guid TargetUserId { get; set; }
}

public class ChatDirectoryUserDto
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string UserRole { get; set; } = string.Empty; // Student, Teacher, Principal, Admin
    public string? ClassName { get; set; }
    public string? SectionName { get; set; }
    public string? RollNumber { get; set; }
    public string? EmployeeCode { get; set; }
    public string? Designation { get; set; }
    public string? ProfilePhoto { get; set; }
    public bool IsOnline { get; set; }
    public bool IsSameClass { get; set; }
    public Guid? ExistingConversationId { get; set; }
}
