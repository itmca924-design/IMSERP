-- =========================================================================
-- IMSERP: Standard Roles & Subscription Menu Item Seed Script
-- =========================================================================

SET NOCOUNT ON;

PRINT '1. Ensuring MenuItems for Subscription & Biometric Devices...';

DECLARE @AdminSettingsParentId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000005';
DECLARE @SubscriptionMenuId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000065';
DECLARE @BiometricMenuId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000063';

-- 1A. Subscription & Plan Menu Item
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [RouteUrl] = '/subscription')
BEGIN
    INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
    VALUES (@SubscriptionMenuId, 'Subscription & Plan', '/subscription', 'workspace_premium', @AdminSettingsParentId, 5, 'Admin', 1);
    PRINT '--> Inserted Subscription & Plan menu item.';
END
ELSE
BEGIN
    UPDATE [dbo].[MenuItems]
    SET [Title] = 'Subscription & Plan',
        [Icon] = 'workspace_premium',
        [ParentId] = @AdminSettingsParentId,
        [SortOrder] = 5,
        [Module] = 'Admin',
        [IsActive] = 1
    WHERE [RouteUrl] = '/subscription';
    PRINT '--> Updated Subscription & Plan menu item.';
END

-- 1B. Biometric Devices Menu Item
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [RouteUrl] = '/attendance/devices')
BEGIN
    INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
    VALUES (@BiometricMenuId, 'Biometric Devices', '/attendance/devices', 'fingerprint', @AdminSettingsParentId, 3, 'Admin', 1);
    PRINT '--> Inserted Biometric Devices menu item.';
END
ELSE
BEGIN
    UPDATE [dbo].[MenuItems]
    SET [ParentId] = @AdminSettingsParentId,
        [SortOrder] = 3,
        [Module] = 'Admin',
        [IsActive] = 1
    WHERE [RouteUrl] = '/attendance/devices';
    PRINT '--> Updated Biometric Devices menu item under Admin Settings.';
END

PRINT '2. Seeding Standard Roles & Permissions for ALL Tenants...';

DECLARE @TenantsCursor CURSOR;
DECLARE @CurrentTenantId UNIQUEIDENTIFIER;
DECLARE @TenantName NVARCHAR(200);

SET @TenantsCursor = CURSOR FOR
    SELECT [Id], [Name] FROM [dbo].[Tenants];

OPEN @TenantsCursor;
FETCH NEXT FROM @TenantsCursor INTO @CurrentTenantId, @TenantName;

WHILE @@FETCH_STATUS = 0
BEGIN
    PRINT '-------------------------------------------------------------';
    PRINT 'Processing Tenant: ' + @TenantName + ' (' + CAST(@CurrentTenantId AS NVARCHAR(50)) + ')';

    -- =========================================================================
    -- Role 1: Institute Admin
    -- =========================================================================
    DECLARE @InstAdminRoleId UNIQUEIDENTIFIER;
    SELECT TOP 1 @InstAdminRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @CurrentTenantId AND [Name] = 'Institute Admin';
    IF @InstAdminRoleId IS NULL
    BEGIN
        SET @InstAdminRoleId = NEWID();
        INSERT INTO [dbo].[Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
        VALUES (@InstAdminRoleId, @CurrentTenantId, 'Institute Admin', 'Principal / Center Director — full administrative access to master setup, academics, faculty, finance, attendance and institute settings.', 1, GETUTCDATE());
        PRINT '  + Created Role: Institute Admin';
    END

    -- Grant Institute Admin full permissions across ALL active MenuItems
    INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
    SELECT NEWID(), @InstAdminRoleId, m.[Id], 1, 1, 1, 1
    FROM [dbo].[MenuItems] m
    WHERE m.[IsActive] = 1
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[RolePermissions] rp
          WHERE rp.[RoleId] = @InstAdminRoleId AND rp.[MenuItemId] = m.[Id]
      );

    -- =========================================================================
    -- Role 2: Accountant
    -- =========================================================================
    DECLARE @AccountantRoleId UNIQUEIDENTIFIER;
    SELECT TOP 1 @AccountantRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @CurrentTenantId AND [Name] = 'Accountant';
    IF @AccountantRoleId IS NULL
    BEGIN
        SET @AccountantRoleId = NEWID();
        INSERT INTO [dbo].[Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
        VALUES (@AccountantRoleId, @CurrentTenantId, 'Accountant', 'Accounts & Fee Manager — handles student fee collection, invoice receipts, fee heads master, expense vouchers, accounting ledger and financial reports.', 1, GETUTCDATE());
        PRINT '  + Created Role: Accountant';
    END

    -- Accountant Permissions
    DECLARE @AccountantRoutes TABLE (RouteUrl NVARCHAR(200));
    DELETE FROM @AccountantRoutes;
    INSERT INTO @AccountantRoutes VALUES
        ('/dashboard'),
        ('/school/classes'),
        ('/batches'),
        ('/students'),
        ('/fees'),
        ('/fee-heads'),
        ('/whatsapp'),
        ('/finance/profit-loss'),
        ('/finance/balance-sheet'),
        ('/finance/expenses'),
        ('/finance/chart-of-accounts'),
        ('/attendance/reports');

    INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
    SELECT NEWID(), @AccountantRoleId, m.[Id], 1, 1, 1, 1
    FROM [dbo].[MenuItems] m
    INNER JOIN @AccountantRoutes r ON m.[RouteUrl] = r.RouteUrl
    WHERE m.[IsActive] = 1
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[RolePermissions] rp
          WHERE rp.[RoleId] = @AccountantRoleId AND rp.[MenuItemId] = m.[Id]
      );

    -- =========================================================================
    -- Role 3: Teacher
    -- =========================================================================
    DECLARE @TeacherRoleId UNIQUEIDENTIFIER;
    SELECT TOP 1 @TeacherRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @CurrentTenantId AND [Name] = 'Teacher';
    IF @TeacherRoleId IS NULL
    BEGIN
        SET @TeacherRoleId = NEWID();
        INSERT INTO [dbo].[Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
        VALUES (@TeacherRoleId, @CurrentTenantId, 'Teacher', 'Faculty Member — batch lecture assignments, daily lesson diary, faculty attendance, student test marks, exam management and proxy substitution.', 1, GETUTCDATE());
        PRINT '  + Created Role: Teacher';
    END

    -- Teacher Permissions
    DECLARE @TeacherRoutes TABLE (RouteUrl NVARCHAR(200));
    DELETE FROM @TeacherRoutes;
    INSERT INTO @TeacherRoutes VALUES
        ('/dashboard'),
        ('/school/classes'),
        ('/batches'),
        ('/rooms'),
        ('/subjects'),
        ('/students'),
        ('/holidays'),
        ('/attendance/reports'),
        ('/teachers/assignments'),
        ('/teachers/attendance'),
        ('/teachers/substitution'),
        ('/teachers/lesson-plans'),
        ('/teachers/reports'),
        ('/school/exams'),
        ('/tests');

    INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
    SELECT NEWID(), @TeacherRoleId, m.[Id], 1, 
           CASE WHEN m.[RouteUrl] IN ('/teachers/lesson-plans', '/tests', '/teachers/attendance') THEN 1 ELSE 0 END,
           CASE WHEN m.[RouteUrl] IN ('/teachers/lesson-plans', '/tests', '/teachers/attendance', '/school/exams', '/teachers/substitution') THEN 1 ELSE 0 END,
           0
    FROM [dbo].[MenuItems] m
    INNER JOIN @TeacherRoutes r ON m.[RouteUrl] = r.RouteUrl
    WHERE m.[IsActive] = 1
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[RolePermissions] rp
          WHERE rp.[RoleId] = @TeacherRoleId AND rp.[MenuItemId] = m.[Id]
      );

    -- =========================================================================
    -- Role 4: HR
    -- =========================================================================
    DECLARE @HrRoleId UNIQUEIDENTIFIER;
    SELECT TOP 1 @HrRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @CurrentTenantId AND [Name] = 'HR';
    IF @HrRoleId IS NULL
    BEGIN
        SET @HrRoleId = NEWID();
        INSERT INTO [dbo].[Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
        VALUES (@HrRoleId, @CurrentTenantId, 'HR', 'Human Resources — manages faculty profiles, staff biometric mapping, leaves, salary generation, advances, FNF settlement and payroll processing.', 1, GETUTCDATE());
        PRINT '  + Created Role: HR';
    END

    -- HR Permissions
    DECLARE @HrRoutes TABLE (RouteUrl NVARCHAR(200));
    DELETE FROM @HrRoutes;
    INSERT INTO @HrRoutes VALUES
        ('/dashboard'),
        ('/teachers'),
        ('/teachers/assignments'),
        ('/teachers/attendance'),
        ('/teachers/salary'),
        ('/teachers/payments'),
        ('/teachers/advances'),
        ('/teachers/leaves'),
        ('/teachers/reports'),
        ('/teachers/fnf'),
        ('/teachers/substitution'),
        ('/teachers/lesson-plans'),
        ('/attendance/reports'),
        ('/attendance/permissions/manual'),
        ('/attendance/permissions/correction');

    INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
    SELECT NEWID(), @HrRoleId, m.[Id], 1, 1, 1, 1
    FROM [dbo].[MenuItems] m
    INNER JOIN @HrRoutes r ON m.[RouteUrl] = r.RouteUrl
    WHERE m.[IsActive] = 1
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[RolePermissions] rp
          WHERE rp.[RoleId] = @HrRoleId AND rp.[MenuItemId] = m.[Id]
      );

    -- =========================================================================
    -- Role 5: Front Desk / Receptionist
    -- =========================================================================
    DECLARE @FrontDeskRoleId UNIQUEIDENTIFIER;
    SELECT TOP 1 @FrontDeskRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @CurrentTenantId AND [Name] = 'Front Desk / Receptionist';
    IF @FrontDeskRoleId IS NULL
    BEGIN
        SET @FrontDeskRoleId = NEWID();
        INSERT INTO [dbo].[Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
        VALUES (@FrontDeskRoleId, @CurrentTenantId, 'Front Desk / Receptionist', 'Front Desk & Admissions — student inquiries, new admission registration, fee desk collection, WhatsApp notices and attendance verification.', 1, GETUTCDATE());
        PRINT '  + Created Role: Front Desk / Receptionist';
    END

    -- Front Desk Permissions
    DECLARE @FrontDeskRoutes TABLE (RouteUrl NVARCHAR(200));
    DELETE FROM @FrontDeskRoutes;
    INSERT INTO @FrontDeskRoutes VALUES
        ('/dashboard'),
        ('/school/classes'),
        ('/batches'),
        ('/students'),
        ('/holidays'),
        ('/fees'),
        ('/whatsapp'),
        ('/attendance/reports');

    INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
    SELECT NEWID(), @FrontDeskRoleId, m.[Id], 1, 
           CASE WHEN m.[RouteUrl] IN ('/students', '/fees', '/whatsapp') THEN 1 ELSE 0 END,
           CASE WHEN m.[RouteUrl] IN ('/students', '/fees') THEN 1 ELSE 0 END,
           0
    FROM [dbo].[MenuItems] m
    INNER JOIN @FrontDeskRoutes r ON m.[RouteUrl] = r.RouteUrl
    WHERE m.[IsActive] = 1
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[RolePermissions] rp
          WHERE rp.[RoleId] = @FrontDeskRoleId AND rp.[MenuItemId] = m.[Id]
      );

    FETCH NEXT FROM @TenantsCursor INTO @CurrentTenantId, @TenantName;
END

CLOSE @TenantsCursor;
DEALLOCATE @TenantsCursor;

PRINT '-------------------------------------------------------------';
PRINT 'SUCCESS! All standard roles & permissions seeded for all tenants.';
