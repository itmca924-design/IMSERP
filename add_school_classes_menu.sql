-- ============================================================================
-- SQL Script: Add 'Classes & Sections' Menu under Master Management
-- Target Database: IMSERP
-- Safe & Idempotent: Run in SQL Server Management Studio (SSMS)
-- ============================================================================

USE [IMSERP];
GO

DECLARE @SchoolClassesMenuId UNIQUEIDENTIFIER = '20000000-0000-0000-0000-000000000020';
DECLARE @MasterParentId UNIQUEIDENTIFIER = NULL;

-- 1. Find Master Management parent menu
SELECT TOP 1 @MasterParentId = [Id]
FROM [dbo].[MenuItems]
WHERE [Title] = 'Master Management' AND [ParentId] IS NULL AND [IsActive] = 1;

IF @MasterParentId IS NULL
BEGIN
    SELECT TOP 1 @MasterParentId = [Id]
    FROM [dbo].[MenuItems]
    WHERE [Title] LIKE '%Master%' AND [ParentId] IS NULL;
END;

-- 2. Insert or Update 'Classes & Sections' MenuItem
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = @SchoolClassesMenuId OR [RouteUrl] = '/school/classes')
BEGIN
    INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
    VALUES (
        @SchoolClassesMenuId,
        N'Classes & Sections',
        N'/school/classes',
        N'domain',
        @MasterParentId,
        1,
        N'Master',
        1
    );
    PRINT 'Inserted ''Classes & Sections'' menu item successfully.';
END
ELSE
BEGIN
    UPDATE [dbo].[MenuItems]
    SET [Title] = N'Classes & Sections',
        [RouteUrl] = N'/school/classes',
        [Icon] = N'domain',
        [ParentId] = @MasterParentId,
        [SortOrder] = 1,
        [Module] = N'Master',
        [IsActive] = 1
    WHERE [Id] = @SchoolClassesMenuId OR [RouteUrl] = '/school/classes';
    PRINT 'Updated ''Classes & Sections'' menu item successfully.';
END;
GO

-- 3. Grant Permissions to all Active Roles
DECLARE @TargetMenuId UNIQUEIDENTIFIER;
SELECT TOP 1 @TargetMenuId = [Id] FROM [dbo].[MenuItems] WHERE [RouteUrl] = '/school/classes';

IF @TargetMenuId IS NOT NULL
BEGIN
    -- Grant permissions to all roles that don't have it yet
    INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
    SELECT 
        NEWID(),
        r.[Id],
        @TargetMenuId,
        1, -- CanView
        1, -- CanCreate
        1, -- CanEdit
        1  -- CanDelete
    FROM [dbo].[Roles] r
    WHERE NOT EXISTS (
        SELECT 1 FROM [dbo].[RolePermissions] rp 
        WHERE rp.[RoleId] = r.[Id] AND rp.[MenuItemId] = @TargetMenuId
    );

    PRINT 'Granted permissions for ''Classes & Sections'' to all active roles.';
END;
GO

PRINT 'Menu configuration completed successfully!';
