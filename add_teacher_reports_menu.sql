-- ============================================================================
-- SQL Script: Add "Teacher Reports" to Teacher Module in IMSERP
-- Safe & Idempotent: Can be executed multiple times safely without duplicates
-- ============================================================================

USE [IMSERP];
GO

SET NOCOUNT ON;

DECLARE @TeacherReportsId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000048';
DECLARE @TeacherParentId UNIQUEIDENTIFIER = NULL;

-- Step 1: Locate Teacher Module parent menu item
SELECT TOP 1 @TeacherParentId = [Id]
FROM [dbo].[MenuItems]
WHERE ([Title] LIKE '%Teacher%' OR [Module] = 'Teachers')
  AND [ParentId] IS NULL;

-- If not found by title, look for parent of any existing teacher sub-menu
IF @TeacherParentId IS NULL
BEGIN
    SELECT TOP 1 @TeacherParentId = [ParentId]
    FROM [dbo].[MenuItems]
    WHERE [RouteUrl] IN ('/teachers', '/teachers/assignments', '/teachers/attendance')
      AND [ParentId] IS NOT NULL;
END

PRINT 'Teacher Module Parent Menu Id: ' + ISNULL(CAST(@TeacherParentId AS NVARCHAR(50)), 'NOT FOUND');

-- Step 2: Insert or Update "Teacher Reports" menu item
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = @TeacherReportsId OR [RouteUrl] = '/teachers/reports')
BEGIN
    INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
    VALUES (@TeacherReportsId, N'Teacher Reports', N'/teachers/reports', N'assessment', @TeacherParentId, 8, N'Teachers', 1);
    PRINT 'Teacher Reports menu item created.';
END
ELSE
BEGIN
    UPDATE [dbo].[MenuItems]
    SET [Title] = N'Teacher Reports',
        [RouteUrl] = N'/teachers/reports',
        [Icon] = N'assessment',
        [ParentId] = ISNULL(@TeacherParentId, [ParentId]),
        [SortOrder] = 8,
        [Module] = N'Teachers',
        [IsActive] = 1
    WHERE [Id] = @TeacherReportsId OR [RouteUrl] = '/teachers/reports';
    PRINT 'Teacher Reports menu item updated.';
END

-- Step 3: Grant Permissions to Admin Roles (Institute Admin, Admin, Director, SuperAdmin)
DECLARE @ActualMenuId UNIQUEIDENTIFIER;
SELECT TOP 1 @ActualMenuId = [Id] FROM [dbo].[MenuItems] WHERE [RouteUrl] = '/teachers/reports';

IF @ActualMenuId IS NOT NULL
BEGIN
    INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
    SELECT NEWID(), r.[Id], @ActualMenuId, 1, 1, 1, 1
    FROM [dbo].[Roles] r
    WHERE (r.[Name] LIKE '%Admin%' OR r.[Name] LIKE '%Director%' OR r.[Name] LIKE '%Super%')
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[RolePermissions] rp
          WHERE rp.[RoleId] = r.[Id] AND rp.[MenuItemId] = @ActualMenuId
      );

    PRINT 'RolePermissions granted for Teacher Reports to Admin roles.';
END

PRINT '============================================================================';
PRINT 'Teacher Reports menu and permissions configured successfully!';
PRINT '============================================================================';
GO
