-- Adds attendance permissions to the existing Role Management matrix.
-- Run after add_role_management_tables.sql and configure_biometric_attendance.sql.

DECLARE @AdminRoleId UNIQUEIDENTIFIER = '22222222-1111-1111-1111-111111111111';

-- Fall back to the role name when an existing database uses a different seeded ID.
IF NOT EXISTS (SELECT 1 FROM [dbo].[Roles] WHERE Id = @AdminRoleId)
    SELECT TOP 1 @AdminRoleId = Id
    FROM [dbo].[Roles]
    WHERE Name IN ('Institute Admin', 'Admin', 'Director')
    ORDER BY CASE Name WHEN 'Institute Admin' THEN 1 WHEN 'Admin' THEN 2 ELSE 3 END;

DECLARE @PermissionMenus TABLE
(
    Id UNIQUEIDENTIFIER NOT NULL,
    Title NVARCHAR(150) NOT NULL,
    RouteUrl NVARCHAR(250) NOT NULL,
    Icon NVARCHAR(80) NOT NULL,
    SortOrder INT NOT NULL
);

INSERT INTO @PermissionMenus (Id, Title, RouteUrl, Icon, SortOrder)
VALUES
('10000000-0000-0000-0000-000000000020', 'Attendance Mode Settings', '/attendance/permissions/mode-settings', 'tune', 100),
('10000000-0000-0000-0000-000000000021', 'Manual Attendance Marking', '/attendance/permissions/manual', 'edit_calendar', 101),
('10000000-0000-0000-0000-000000000022', 'Biometric Attendance Capture', '/attendance/permissions/biometric', 'fingerprint', 102),
('10000000-0000-0000-0000-000000000023', 'Biometric User Mapping', '/attendance/permissions/biometric-mapping', 'badge', 103),
('10000000-0000-0000-0000-000000000024', 'Attendance Correction', '/attendance/permissions/correction', 'fact_check', 104);

INSERT INTO [dbo].[MenuItems] (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module, IsActive)
SELECT p.Id, p.Title, p.RouteUrl, p.Icon, NULL, p.SortOrder, 'Admin', 1
FROM @PermissionMenus p
WHERE NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] m WHERE m.Id = p.Id);

-- Admin receives the complete attendance permission set by default.
IF EXISTS (SELECT 1 FROM [dbo].[Roles] WHERE Id = @AdminRoleId)
BEGIN
    INSERT INTO [dbo].[RolePermissions] (Id, RoleId, MenuItemId, CanView, CanCreate, CanEdit, CanDelete)
    SELECT NEWID(), @AdminRoleId, p.Id,
           CASE WHEN p.RouteUrl IN ('/attendance/permissions/mode-settings', '/attendance/permissions/biometric-mapping') THEN 0 ELSE 1 END,
           CASE WHEN p.RouteUrl IN ('/attendance/permissions/manual', '/attendance/permissions/biometric') THEN 1 ELSE 0 END,
           CASE WHEN p.RouteUrl IN ('/attendance/permissions/mode-settings', '/attendance/permissions/biometric-mapping', '/attendance/permissions/correction') THEN 1 ELSE 0 END,
           CASE WHEN p.RouteUrl = '/attendance/permissions/correction' THEN 1 ELSE 0 END
    FROM @PermissionMenus p
    WHERE NOT EXISTS (SELECT 1 FROM [dbo].[RolePermissions] rp WHERE rp.RoleId = @AdminRoleId AND rp.MenuItemId = p.Id);

    -- Correct permissions that may already exist from an earlier run or role creation.
    UPDATE rp
    SET CanView = CASE WHEN p.RouteUrl IN ('/attendance/permissions/mode-settings', '/attendance/permissions/biometric-mapping') THEN 0 ELSE 1 END,
        CanCreate = CASE WHEN p.RouteUrl IN ('/attendance/permissions/manual', '/attendance/permissions/biometric') THEN 1 ELSE 0 END,
        CanEdit = CASE WHEN p.RouteUrl IN ('/attendance/permissions/mode-settings', '/attendance/permissions/biometric-mapping', '/attendance/permissions/correction') THEN 1 ELSE 0 END,
        CanDelete = CASE WHEN p.RouteUrl = '/attendance/permissions/correction' THEN 1 ELSE 0 END
    FROM [dbo].[RolePermissions] rp
    INNER JOIN @PermissionMenus p ON p.Id = rp.MenuItemId
    WHERE rp.RoleId = @AdminRoleId;
END;

-- These entries control actions, not sidebar navigation. Keep them hidden from the sidebar.
UPDATE rp
SET CanView = 0
FROM [dbo].[RolePermissions] rp
INNER JOIN @PermissionMenus p ON p.Id = rp.MenuItemId;

PRINT 'Attendance role permissions are ready in Role Management.';
GO