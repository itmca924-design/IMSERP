SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

-- 1. Create User accounts for all students with NULL UserId
DECLARE @tbl TABLE (StudentId UNIQUEIDENTIFIER, NewUserId UNIQUEIDENTIFIER, TenantId UNIQUEIDENTIFIER, BranchId UNIQUEIDENTIFIER, FullName NVARCHAR(200), Username NVARCHAR(100), Phone NVARCHAR(50));

INSERT INTO @tbl
SELECT 
    s.Id,
    NEWID(),
    s.TenantId,
    s.BranchId,
    s.StudentName,
    LOWER(REPLACE(REPLACE(REPLACE(s.StudentName, ' ', ''), '.', ''), '''', '')) + '_' + SUBSTRING(REPLACE(CAST(s.Id AS NVARCHAR(36)), '-', ''), 1, 4),
    ISNULL(s.ParentWhatsAppPhone, '9999999999')
FROM Students s
WHERE s.UserId IS NULL;

INSERT INTO Users (Id, TenantId, BranchId, Username, PasswordHash, FullName, PhoneNumber, Role, IsActive, CreatedAt)
SELECT 
    NewUserId,
    TenantId,
    BranchId,
    Username,
    'password123',
    FullName,
    Phone,
    6, -- Student
    1,
    GETUTCDATE()
FROM @tbl;

UPDATE s
SET s.UserId = t.NewUserId
FROM Students s
JOIN @tbl t ON t.StudentId = s.Id;

-- 2. Enroll these students into their class group channels
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

SELECT COUNT(*) as SyncedStudents FROM @tbl;
SELECT COUNT(*) as RemainingNullStudents FROM Students WHERE UserId IS NULL;
