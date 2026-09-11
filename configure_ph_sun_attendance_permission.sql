-- Adds the role-level checkbox used to allow PH/Sunday attendance editing.
-- No new table is required. Run this script after add_role_management_tables.sql.

DECLARE @PhSunEditMenuId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000012';
DECLARE @AdminRoleId UNIQUEIDENTIFIER = '22222222-1111-1111-1111-111111111111';

IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE Id = @PhSunEditMenuId)
BEGIN
    INSERT INTO MenuItems (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module, IsActive)
    VALUES (
        @PhSunEditMenuId,
        'PH/SUN Red Mark Section',
        '/teachers/attendance/ph-sun-edit',
        'edit_calendar',
        NULL,
        99,
        'Admin',
        1
    );
END

IF EXISTS (SELECT 1 FROM Roles WHERE Id = @AdminRoleId)
   AND NOT EXISTS (
       SELECT 1 FROM RolePermissions
       WHERE RoleId = @AdminRoleId AND MenuItemId = @PhSunEditMenuId
   )
BEGIN
    INSERT INTO RolePermissions (Id, RoleId, MenuItemId, CanView, CanCreate, CanEdit, CanDelete)
    VALUES (NEWID(), @AdminRoleId, @PhSunEditMenuId, 0, 0, 1, 0);
END

-- This is a permission-only item, never a sidebar navigation item.
UPDATE RolePermissions
SET CanView = 0, CanCreate = 0, CanDelete = 0
WHERE MenuItemId = @PhSunEditMenuId;

PRINT 'PH/SUN attendance editing permission is ready in Role Management.';
GO