-- ============================================================================
-- IMSERP: Add Library Shifts & Plans to MenuItems and RolePermissions
-- Safe & Idempotent
-- Database: IMSERP
-- ============================================================================

USE [IMSERP];
GO

DECLARE @AcademicMenuId UNIQUEIDENTIFIER = NULL;

SELECT TOP 1 @AcademicMenuId = [Id]
FROM [dbo].[MenuItems]
WHERE [Title] LIKE '%Academic%' AND [ParentId] IS NULL AND [IsActive] = 1;

IF @AcademicMenuId IS NOT NULL
BEGIN
    DECLARE @LibraryPlansMenuId UNIQUEIDENTIFIER = '30000000-0000-0000-0000-000000000033';

    IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = @LibraryPlansMenuId OR [RouteUrl] = '/library/plans')
    BEGIN
        INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
        VALUES (@LibraryPlansMenuId, N'Library Shifts & Plans', N'/library/plans', N'schedule', @AcademicMenuId, 6, N'Academic', 1);
        PRINT 'Inserted Library Shifts & Plans menu item.';
    END
    ELSE
    BEGIN
        UPDATE [dbo].[MenuItems]
        SET [Title] = N'Library Shifts & Plans',
            [RouteUrl] = N'/library/plans',
            [Icon] = N'schedule',
            [ParentId] = @AcademicMenuId,
            [SortOrder] = 6,
            [Module] = N'Academic',
            [IsActive] = 1
        WHERE [Id] = @LibraryPlansMenuId OR [RouteUrl] = '/library/plans';
        PRINT 'Updated Library Shifts & Plans menu item.';
    END;

    -- Adjust sort order of Hostel if it's 6 or 7 so it stays after library items
    UPDATE [dbo].[MenuItems]
    SET [SortOrder] = 7
    WHERE [RouteUrl] = '/hostel' AND [ParentId] = @AcademicMenuId;

    -- Grant full permissions to all roles
    INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
    SELECT NEWID(), r.[Id], m.[Id], 1, 1, 1, 1
    FROM [dbo].[Roles] r
    CROSS JOIN (
        SELECT [Id] FROM [dbo].[MenuItems] WHERE [RouteUrl] = '/library/plans'
    ) m
    WHERE NOT EXISTS (
        SELECT 1 FROM [dbo].[RolePermissions] rp WHERE rp.[RoleId] = r.[Id] AND rp.[MenuItemId] = m.[Id]
    );
    PRINT 'Granted permissions for Library Shifts & Plans to all active roles.';
END
ELSE
BEGIN
    PRINT 'Academic Operations menu not found!';
END
GO

PRINT '=======================================================';
PRINT 'Library Shifts & Plans Menu Migration Completed!';
PRINT '=======================================================';
