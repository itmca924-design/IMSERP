-- ============================================================================
-- SQL Script: Add Institutes & Tenants Menu under Admin Settings
-- Target Database: IMSERP
-- ============================================================================

USE [IMSERP];
GO

DECLARE @TenantsMenuId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000026';
DECLARE @AdminSettingsParentId UNIQUEIDENTIFIER = NULL;

-- 1. Find Admin Settings parent menu
SELECT TOP 1 @AdminSettingsParentId = [Id]
FROM [dbo].[MenuItems]
WHERE [Title] = 'Admin Settings' AND [ParentId] IS NULL AND [IsActive] = 1
ORDER BY CASE WHEN [Id] = '00000000-0000-0000-0000-000000000005' THEN 0 ELSE 1 END;

IF @AdminSettingsParentId IS NULL
BEGIN
    SELECT TOP 1 @AdminSettingsParentId = [Id]
    FROM [dbo].[MenuItems]
    WHERE [Title] LIKE '%Admin%' AND [ParentId] IS NULL;
END;

-- 2. Insert or Update 'Institutes & Tenants' MenuItem
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = @TenantsMenuId OR [RouteUrl] = '/admin/tenants')
BEGIN
    INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
    VALUES (
        @TenantsMenuId,
        N'Institutes & Tenants',
        N'/admin/tenants',
        N'corporate_fare',
        @AdminSettingsParentId,
        4,
        N'Admin',
        1
    );
    PRINT 'Institutes & Tenants menu item inserted successfully.';
END
ELSE
BEGIN
    UPDATE [dbo].[MenuItems]
    SET [Title] = N'Institutes & Tenants',
        [RouteUrl] = N'/admin/tenants',
        [Icon] = N'corporate_fare',
        [ParentId] = @AdminSettingsParentId,
        [SortOrder] = 4,
        [Module] = N'Admin',
        [IsActive] = 1
    WHERE [Id] = @TenantsMenuId OR [RouteUrl] = '/admin/tenants';
    PRINT 'Institutes & Tenants menu item updated successfully.';
END;

-- 3. Grant Permissions to Admin Roles
DECLARE @TargetMenuId UNIQUEIDENTIFIER;
SELECT TOP 1 @TargetMenuId = [Id] FROM [dbo].[MenuItems] WHERE [RouteUrl] = '/admin/tenants';

-- Grant to Institute Admin role and any Admin-level roles
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
WHERE (r.[Name] LIKE '%Admin%' OR r.[Id] = '22222222-1111-1111-1111-111111111111')
  AND NOT EXISTS (
      SELECT 1 FROM [dbo].[RolePermissions] rp 
      WHERE rp.[RoleId] = r.[Id] AND rp.[MenuItemId] = @TargetMenuId
  );

PRINT 'Role permissions granted successfully for Institutes & Tenants.';
GO
