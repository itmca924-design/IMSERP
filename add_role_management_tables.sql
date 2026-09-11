-- ============================================================================
-- SQL Script: Add Role Management, Page Permissions, Dynamic Menu & Subject Master
-- Target Database: IMSERP
-- ============================================================================

USE [IMSERP];
GO

-- 1. Create Roles Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Roles]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Roles] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [Name] NVARCHAR(100) NOT NULL,
        [Description] NVARCHAR(250) NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [FK_Roles_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]) ON DELETE CASCADE
    );
    PRINT 'Roles table created successfully.';
END
GO

-- 2. Create Subjects Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Subjects]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Subjects] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [Name] NVARCHAR(100) NOT NULL,
        [Code] NVARCHAR(50) NULL,
        [Description] NVARCHAR(250) NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [FK_Subjects_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]) ON DELETE CASCADE
    );
    PRINT 'Subjects table created successfully.';
END
GO

-- 3. Create MenuItems Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MenuItems]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[MenuItems] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [Title] NVARCHAR(100) NOT NULL,
        [RouteUrl] NVARCHAR(200) NULL,
        [Icon] NVARCHAR(50) NULL,
        [ParentId] UNIQUEIDENTIFIER NULL,
        [SortOrder] INT NOT NULL DEFAULT 0,
        [Module] NVARCHAR(50) NOT NULL DEFAULT 'Master',
        [IsActive] BIT NOT NULL DEFAULT 1,
        CONSTRAINT [FK_MenuItems_Parent] FOREIGN KEY ([ParentId]) REFERENCES [dbo].[MenuItems]([Id])
    );
    PRINT 'MenuItems table created successfully.';
END
GO

-- 4. Create RolePermissions Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RolePermissions]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[RolePermissions] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [RoleId] UNIQUEIDENTIFIER NOT NULL,
        [MenuItemId] UNIQUEIDENTIFIER NOT NULL,
        [CanView] BIT NOT NULL DEFAULT 1,
        [CanCreate] BIT NOT NULL DEFAULT 1,
        [CanEdit] BIT NOT NULL DEFAULT 1,
        [CanDelete] BIT NOT NULL DEFAULT 1,
        CONSTRAINT [FK_RolePermissions_Roles] FOREIGN KEY ([RoleId]) REFERENCES [dbo].[Roles]([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_RolePermissions_MenuItems] FOREIGN KEY ([MenuItemId]) REFERENCES [dbo].[MenuItems]([Id]) ON DELETE CASCADE
    );
    PRINT 'RolePermissions table created successfully.';
END
GO

-- 5. Add RoleId column to Users table if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = N'RoleId')
BEGIN
    ALTER TABLE [dbo].[Users] ADD [RoleId] UNIQUEIDENTIFIER NULL;
    ALTER TABLE [dbo].[Users] ADD CONSTRAINT [FK_Users_Roles] FOREIGN KEY ([RoleId]) REFERENCES [dbo].[Roles]([Id]);
    PRINT 'RoleId column added to Users table successfully.';
END
GO

-- 6. Seed MenuItems (Master Management & Admin Settings Modules)
DECLARE @DashboardId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000002';
DECLARE @MasterParentId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000001';
DECLARE @AdminSettingsParentId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000010';

DECLARE @BatchesId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000003';
DECLARE @SubjectMasterId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000011';
DECLARE @StudentsId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000004';

DECLARE @RolesId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000005';
DECLARE @UsersId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000006';

DECLARE @FeesId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000007';
DECLARE @TestsId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000008';
DECLARE @WhatsAppId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000009';

IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE Id = @DashboardId)
    INSERT INTO MenuItems (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module)
    VALUES (@DashboardId, 'Dashboard', '/dashboard', 'dashboard', NULL, 1, 'Main');

-- Module 1: Master Management
IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE Id = @MasterParentId)
    INSERT INTO MenuItems (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module)
    VALUES (@MasterParentId, 'Master Management', NULL, 'category', NULL, 2, 'Master');

IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE Id = @BatchesId)
    INSERT INTO MenuItems (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module)
    VALUES (@BatchesId, 'Batches Master', '/batches', 'class', @MasterParentId, 1, 'Master');

IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE Id = @SubjectMasterId)
    INSERT INTO MenuItems (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module)
    VALUES (@SubjectMasterId, 'Subject Master', '/subjects', 'menu_book', @MasterParentId, 2, 'Master');

IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE Id = @StudentsId)
    INSERT INTO MenuItems (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module)
    VALUES (@StudentsId, 'Students Master', '/students', 'people', @MasterParentId, 3, 'Master');

-- Module 2: Admin Settings
IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE Id = @AdminSettingsParentId)
    INSERT INTO MenuItems (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module)
    VALUES (@AdminSettingsParentId, 'Admin Settings', NULL, 'settings', NULL, 6, 'Admin');

IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE Id = @RolesId)
    INSERT INTO MenuItems (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module)
    VALUES (@RolesId, 'Roles & Permissions', '/roles', 'admin_panel_settings', @AdminSettingsParentId, 1, 'Admin');
ELSE
    UPDATE MenuItems SET ParentId = @AdminSettingsParentId, Module = 'Admin', SortOrder = 1 WHERE Id = @RolesId;

IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE Id = @UsersId)
    INSERT INTO MenuItems (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module)
    VALUES (@UsersId, 'User Management', '/users', 'person_add', @AdminSettingsParentId, 2, 'Admin');
ELSE
    UPDATE MenuItems SET ParentId = @AdminSettingsParentId, Module = 'Admin', SortOrder = 2 WHERE Id = @UsersId;

-- Operations Module
IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE Id = @FeesId)
    INSERT INTO MenuItems (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module)
    VALUES (@FeesId, 'Fee Collection', '/fees', 'payments', NULL, 3, 'Operations');

IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE Id = @TestsId)
    INSERT INTO MenuItems (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module)
    VALUES (@TestsId, 'Tests & Report Cards', '/tests', 'assignment', NULL, 4, 'Operations');

IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE Id = @WhatsAppId)
    INSERT INTO MenuItems (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module)
    VALUES (@WhatsAppId, 'WhatsApp Logs', '/whatsapp', 'chat', NULL, 5, 'Operations');

-- 7. Seed Default Tenant & Roles
DECLARE @TenantId UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
DECLARE @AdminRoleId UNIQUEIDENTIFIER = '22222222-1111-1111-1111-111111111111';
DECLARE @TeacherRoleId UNIQUEIDENTIFIER = '33333333-1111-1111-1111-111111111111';

IF NOT EXISTS (SELECT 1 FROM Roles WHERE Id = @AdminRoleId)
BEGIN
    INSERT INTO Roles (Id, TenantId, Name, Description, IsActive)
    VALUES (@AdminRoleId, @TenantId, 'Institute Admin', 'Full access to all modules and configurations', 1);
END

-- Grant Admin permission to any newly added menu items
INSERT INTO RolePermissions (Id, RoleId, MenuItemId, CanView, CanCreate, CanEdit, CanDelete)
SELECT NEWID(), @AdminRoleId, m.Id, 1, 1, 1, 1 
FROM MenuItems m
WHERE NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = @AdminRoleId AND rp.MenuItemId = m.Id);

-- 8. Seed Default Subjects for Coaching Tenant
IF NOT EXISTS (SELECT 1 FROM Subjects WHERE TenantId = @TenantId)
BEGIN
    INSERT INTO Subjects (Id, TenantId, Name, Code, Description, IsActive)
    VALUES 
    (NEWID(), @TenantId, 'Physics', 'PHY', 'Physics for Board & Entrance Exams', 1),
    (NEWID(), @TenantId, 'Chemistry', 'CHEM', 'Physical, Organic & Inorganic Chemistry', 1),
    (NEWID(), @TenantId, 'Mathematics', 'MATH', 'Pure & Applied Mathematics', 1),
    (NEWID(), @TenantId, 'Biology', 'BIO', 'Botany & Zoology for Medical Exams', 1),
    (NEWID(), @TenantId, 'English', 'ENG', 'English Literature & Grammar', 1),
    (NEWID(), @TenantId, 'Accountancy', 'ACC', 'Financial Accountancy for Commerce', 1),
    (NEWID(), @TenantId, 'Economics', 'ECO', 'Micro & Macro Economics', 1);
    PRINT 'Default subjects seeded successfully.';
END

-- Update existing users to assign Admin Role if RoleId is NULL
UPDATE Users SET RoleId = @AdminRoleId WHERE RoleId IS NULL;

PRINT 'Database script execution completed successfully.';
GO
