-- ==============================================================================
-- Seed & Configure Super Admin Role & Permissions for SYSTEM Platform Tenant
-- ==============================================================================

SET NOCOUNT ON;

DECLARE @SystemTenantId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000001';
DECLARE @SuperAdminRoleId UNIQUEIDENTIFIER;

-- 1. Ensure SYSTEM Tenant exists
IF NOT EXISTS (SELECT 1 FROM [Tenants] WHERE [Id] = @SystemTenantId)
BEGIN
    PRINT 'SYSTEM tenant does not exist. Aborting.';
    RETURN;
END

-- 2. Find or Create Super Admin Role for SYSTEM tenant
SELECT @SuperAdminRoleId = [Id]
FROM [Roles]
WHERE [TenantId] = @SystemTenantId AND ([Name] = 'Super Admin' OR [Name] = 'SuperAdmin');

IF @SuperAdminRoleId IS NULL
BEGIN
    SET @SuperAdminRoleId = NEWID();
    INSERT INTO [Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
    VALUES (@SuperAdminRoleId, @SystemTenantId, 'Super Admin', 'Platform SaaS Super Administrator with complete system access', 1, GETUTCDATE());
    PRINT 'Created Super Admin role with ID: ' + CAST(@SuperAdminRoleId AS NVARCHAR(50));
END
ELSE
BEGIN
    UPDATE [Roles]
    SET [Name] = 'Super Admin',
        [Description] = 'Platform SaaS Super Administrator with complete system access',
        [IsActive] = 1
    WHERE [Id] = @SuperAdminRoleId;
    PRINT 'Using existing Super Admin role ID: ' + CAST(@SuperAdminRoleId AS NVARCHAR(50));
END

-- 3. Grant Full Permissions for ALL active Menu Items to Super Admin
INSERT INTO [RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
SELECT NEWID(), @SuperAdminRoleId, m.[Id], 1, 1, 1, 1
FROM [MenuItems] m
WHERE m.[IsActive] = 1
  AND NOT EXISTS (
    SELECT 1 FROM [RolePermissions] rp
    WHERE rp.[RoleId] = @SuperAdminRoleId AND rp.[MenuItemId] = m.[Id]
  );

UPDATE [RolePermissions]
SET [CanView] = 1,
    [CanCreate] = 1,
    [CanEdit] = 1,
    [CanDelete] = 1
WHERE [RoleId] = @SuperAdminRoleId;

PRINT 'Populated and ticked all permissions for Super Admin role.';

-- 4. Update Platform Admin users (superadmin, admin) under SYSTEM tenant to SuperAdmin enum (1) and SuperAdmin role
UPDATE [Users]
SET [Role] = 1, -- UserRole.SuperAdmin
    [RoleId] = @SuperAdminRoleId
WHERE [TenantId] = @SystemTenantId
  AND ([Username] = 'superadmin' OR [Username] = 'admin' OR [RoleId] = 'EFC312E4-4498-4986-BFD8-11A8C3F12039');

PRINT 'Updated Platform Admin users under SYSTEM tenant to Role = 1 (SuperAdmin).';

-- 5. Verification
SELECT u.[Id], u.[Username], u.[Role], r.[Name] as [RoleName], r.[TenantId],
       (SELECT COUNT(*) FROM [RolePermissions] WHERE [RoleId] = r.[Id]) as [TotalPermissions]
FROM [Users] u
LEFT JOIN [Roles] r ON u.[RoleId] = r.[Id]
WHERE u.[Username] = 'superadmin' AND u.[TenantId] = @SystemTenantId;
