-- 1. Provision Class Group Conversations for all active Class & Sections
INSERT INTO ChatConversations (Id, TenantId, BranchId, ConversationType, ClassId, SectionId, Title, Description, CreatedAt, CreatedByUserId, IsActive)
SELECT 
    NEWID(),
    c.TenantId,
    c.BranchId,
    2, -- ClassGroup
    c.Id,
    s.Id,
    c.Name + ' - ' + s.Name + ' Group',
    'Official student & faculty channel for ' + c.Name + ' (' + s.Name + ')',
    GETUTCDATE(),
    '00000000-0000-0000-0000-000000000001',
    1
FROM SchoolClasses c
JOIN SchoolSections s ON s.ClassId = c.Id
WHERE c.IsActive = 1 AND s.IsActive = 1
  AND NOT EXISTS (
      SELECT 1 FROM ChatConversations cc 
      WHERE cc.TenantId = c.TenantId AND cc.ClassId = c.Id AND cc.SectionId = s.Id
  );

-- 2. Enroll Students into their respective Class Group Conversations
INSERT INTO ChatParticipants (Id, TenantId, BranchId, ConversationId, UserId, RoleInChat, UnreadCount, JoinedAt, IsMuted)
SELECT 
    NEWID(),
    st.TenantId,
    st.BranchId,
    cc.Id,
    st.UserId,
    'Student',
    0,
    GETUTCDATE(),
    0
FROM Students st
JOIN ChatConversations cc ON cc.TenantId = st.TenantId AND cc.ClassId = st.ClassId AND cc.SectionId = st.SectionId
WHERE st.UserId IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM ChatParticipants cp 
      WHERE cp.ConversationId = cc.Id AND cp.UserId = st.UserId
  );

-- 3. Enroll Teachers & Admins into all Class Group Conversations of their branch
INSERT INTO ChatParticipants (Id, TenantId, BranchId, ConversationId, UserId, RoleInChat, UnreadCount, JoinedAt, IsMuted)
SELECT 
    NEWID(),
    u.TenantId,
    u.BranchId,
    cc.Id,
    u.Id,
    'Faculty',
    0,
    GETUTCDATE(),
    0
FROM Users u
CROSS JOIN ChatConversations cc
WHERE cc.ConversationType = 2
  AND u.TenantId = cc.TenantId
  AND (u.BranchId IS NULL OR cc.BranchId IS NULL OR u.BranchId = cc.BranchId)
  AND u.Role IN (2, 3) -- InstituteAdmin, Teacher
  AND u.IsActive = 1
  AND NOT EXISTS (
      SELECT 1 FROM ChatParticipants cp 
      WHERE cp.ConversationId = cc.Id AND cp.UserId = u.Id
  );

SELECT COUNT(*) as TotalClassRooms FROM ChatConversations WHERE ConversationType = 2;
SELECT COUNT(*) as TotalClassParticipants FROM ChatParticipants WHERE RoleInChat = 'Faculty';
