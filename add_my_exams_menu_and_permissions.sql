-- =========================================================================
-- Add 'My Exams & Datesheet' MenuItem and reconfigure Parent/Student permissions
-- Admin Exam Desk (/school/exams) is restricted from Parent & Student roles
-- =========================================================================
SET NOCOUNT ON;

DECLARE @MyExamsMenuId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-00000000005E';
DECLARE @AcademicParentMenuId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000004';

-- 1. Ensure MenuItem exists in MenuItems table
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = @MyExamsMenuId)
BEGIN
    INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
    VALUES (
        @MyExamsMenuId,
        'My Exams & Datesheet',
        '/my-exams',
        'event_available',
        @AcademicParentMenuId,
        3,
        'Academic',
        1
    );
    PRINT 'Created MenuItem: My Exams & Datesheet (/my-exams)';
END
ELSE
BEGIN
    UPDATE [dbo].[MenuItems]
    SET [Title] = 'My Exams & Datesheet',
        [RouteUrl] = '/my-exams',
        [Icon] = 'event_available',
        [ParentId] = @AcademicParentMenuId,
        [SortOrder] = 3,
        [Module] = 'Academic',
        [IsActive] = 1
    WHERE [Id] = @MyExamsMenuId;
    PRINT 'Updated MenuItem: My Exams & Datesheet (/my-exams)';
END

-- 2. Remove /school/exams (Admin Exam Desk) permission from Parent and Student roles across all tenants
DELETE rp
FROM [dbo].[RolePermissions] rp
INNER JOIN [dbo].[Roles] r ON rp.[RoleId] = r.[Id]
INNER JOIN [dbo].[MenuItems] m ON rp.[MenuItemId] = m.[Id]
WHERE (LOWER(r.[Name]) LIKE '%parent%' OR LOWER(r.[Name]) LIKE '%student%')
  AND (m.[RouteUrl] = '/school/exams' OR m.[Title] LIKE '%School Examinations%');

PRINT 'Removed /school/exams permission from Parent and Student roles.';

-- 3. Grant /my-exams (Read-only) to Parent and Student roles across all tenants
INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
SELECT 
    NEWID(),
    r.[Id],
    @MyExamsMenuId,
    1, -- CanView
    0, -- CanCreate
    0, -- CanEdit
    0  -- CanDelete
FROM [dbo].[Roles] r
WHERE (LOWER(r.[Name]) LIKE '%parent%' OR LOWER(r.[Name]) LIKE '%student%')
  AND NOT EXISTS (
      SELECT 1 FROM [dbo].[RolePermissions] rp 
      WHERE rp.[RoleId] = r.[Id] AND rp.[MenuItemId] = @MyExamsMenuId
  );

PRINT 'Granted /my-exams permission to Parent and Student roles.';

-- 4. Grant /my-exams to Admin, SuperAdmin, Principal, Teacher, Accountant roles so it can be managed dynamically
INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
SELECT 
    NEWID(),
    r.[Id],
    @MyExamsMenuId,
    1, -- CanView
    1, -- CanCreate
    1, -- CanEdit
    1  -- CanDelete
FROM [dbo].[Roles] r
WHERE (LOWER(r.[Name]) LIKE '%admin%' OR LOWER(r.[Name]) LIKE '%principal%' OR LOWER(r.[Name]) LIKE '%director%' OR LOWER(r.[Name]) LIKE '%super%' OR LOWER(r.[Name]) LIKE '%teacher%' OR LOWER(r.[Name]) LIKE '%faculty%' OR LOWER(r.[Name]) LIKE '%accountant%')
  AND NOT EXISTS (
      SELECT 1 FROM [dbo].[RolePermissions] rp 
      WHERE rp.[RoleId] = r.[Id] AND rp.[MenuItemId] = @MyExamsMenuId
  );

PRINT 'Granted /my-exams permission to Administrative & Teacher roles.';

-- 5. Verification
SELECT 
    r.[Name] AS [RoleName],
    m.[Title] AS [MenuTitle],
    m.[RouteUrl],
    rp.[CanView],
    rp.[CanCreate],
    rp.[CanEdit],
    rp.[CanDelete]
FROM [dbo].[RolePermissions] rp
INNER JOIN [dbo].[Roles] r ON rp.[RoleId] = r.[Id]
INNER JOIN [dbo].[MenuItems] m ON rp.[MenuItemId] = m.[Id]
WHERE m.[RouteUrl] IN ('/my-exams', '/school/exams')
ORDER BY m.[RouteUrl], r.[Name];
