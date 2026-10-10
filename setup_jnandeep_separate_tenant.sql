-- =========================================================================
-- IMSERP: Setup Separate Tenant for Jnandeep Campus (Code: JNANDEEP)
-- and Revert SYSTEM Tenant back to Platform Superadmin
-- =========================================================================

USE [IMSERP];
GO

SET NOCOUNT ON;

-- 1. Revert SYSTEM tenant back to IMSERP Platform Admin Console
UPDATE [dbo].[Tenants]
SET [Name] = N'IMSERP Platform Admin Console',
    [IsActive] = 1
WHERE [Code] = 'SYSTEM';
PRINT 'Reverted SYSTEM tenant to IMSERP Platform Admin Console.';

-- 2. Create or Update Dedicated Tenant for Jnandeep Campus (Code: JNANDEEP)
DECLARE @JnandeepTenantId UNIQUEIDENTIFIER;
SELECT TOP 1 @JnandeepTenantId = [Id] FROM [dbo].[Tenants] WHERE [Code] = 'JNANDEEP' OR [Code] = 'JNADEEP';

IF @JnandeepTenantId IS NULL
BEGIN
    SET @JnandeepTenantId = NEWID();
    INSERT INTO [dbo].[Tenants] (
        [Id], [Name], [Code], [ContactPhone], [Address], [IsActive], [CreatedAt],
        [HasSchoolModule], [HasCoachingModule], [HasHostelModule], [HasLibraryModule], [HasTransportModule],
        [SubscriptionPlan], [SubscriptionStatus], [PaidUntil], [MaxStudentsLimit], [MaxBranchesLimit], [LicensedModules]
    )
    VALUES (
        @JnandeepTenantId, N'Jnandeep Campus', N'JNANDEEP', N'+919876543210', N'Main Road, Jnandeep Campus', 1, GETUTCDATE(),
        1, 1, 1, 1, 1,
        N'Enterprise', N'Active', '2099-12-31', 10000, 20, N'School,Coaching,Hostel,Library,Transport,Finance,HRMS,Exams,Attendance,FrontDesk'
    );
    PRINT 'Created new Tenant: Jnandeep Campus with Code JNANDEEP.';
END
ELSE
BEGIN
    UPDATE [dbo].[Tenants]
    SET [Name] = N'Jnandeep Campus',
        [Code] = N'JNANDEEP',
        [IsActive] = 1,
        [HasSchoolModule] = 1,
        [HasCoachingModule] = 1,
        [HasHostelModule] = 1,
        [HasLibraryModule] = 1,
        [HasTransportModule] = 1,
        [SubscriptionPlan] = N'Enterprise',
        [SubscriptionStatus] = N'Active',
        [PaidUntil] = '2099-12-31',
        [MaxStudentsLimit] = 10000,
        [MaxBranchesLimit] = 20,
        [LicensedModules] = N'School,Coaching,Hostel,Library,Transport,Finance,HRMS,Exams,Attendance,FrontDesk'
    WHERE [Id] = @JnandeepTenantId;
    PRINT 'Updated existing Tenant to Jnandeep Campus (JNANDEEP).';
END
GO

-- 3. Roles and Permissions for Jnandeep Campus
DECLARE @TenantId UNIQUEIDENTIFIER;
SELECT TOP 1 @TenantId = [Id] FROM [dbo].[Tenants] WHERE [Code] = 'JNANDEEP';

-- Admin Role
DECLARE @AdminRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @AdminRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND [Name] = 'Institute Admin';
IF @AdminRoleId IS NULL
BEGIN
    SET @AdminRoleId = NEWID();
    INSERT INTO [dbo].[Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
    VALUES (@AdminRoleId, @TenantId, 'Institute Admin', 'Principal / Center Director — full administrative access to master setup, academics, faculty, finance, attendance and institute settings.', 1, GETUTCDATE());
END

-- Teacher Role
DECLARE @TeacherRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @TeacherRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND ([Name] = 'Teacher' OR [Name] = 'Teacher / Faculty');
IF @TeacherRoleId IS NULL
BEGIN
    SET @TeacherRoleId = NEWID();
    INSERT INTO [dbo].[Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
    VALUES (@TeacherRoleId, @TenantId, 'Teacher', 'Faculty Member — batch lecture assignments, daily lesson diary, student attendance, and exam test results.', 1, GETUTCDATE());
END

-- Student Role
DECLARE @StudentRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @StudentRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND [Name] = 'Student';
IF @StudentRoleId IS NULL
BEGIN
    SET @StudentRoleId = NEWID();
    INSERT INTO [dbo].[Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
    VALUES (@StudentRoleId, @TenantId, 'Student', 'Enrolled student — view academic marks, schedule, attendance, fees and notices.', 1, GETUTCDATE());
END

-- Parent Role
DECLARE @ParentRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @ParentRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND [Name] = 'Parent';
IF @ParentRoleId IS NULL
BEGIN
    SET @ParentRoleId = NEWID();
    INSERT INTO [dbo].[Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
    VALUES (@ParentRoleId, @TenantId, 'Parent', 'Student guardian — view child attendance, test marks, fee receipts and academic reports.', 1, GETUTCDATE());
END

-- HR Role
DECLARE @HrRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @HrRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND [Name] = 'HR';
IF @HrRoleId IS NULL
BEGIN
    SET @HrRoleId = NEWID();
    INSERT INTO [dbo].[Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
    VALUES (@HrRoleId, @TenantId, 'HR', 'Human Resources — manages teacher profiles, attendance biometric logs, payroll salaries and staff leave policies.', 1, GETUTCDATE());
END

-- Staff Role
DECLARE @StaffRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @StaffRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND ([Name] = 'Staff' OR [Name] = 'Support & Facility Staff' OR [Name] = 'Front Desk / Receptionist');
IF @StaffRoleId IS NULL
BEGIN
    SET @StaffRoleId = NEWID();
    INSERT INTO [dbo].[Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
    VALUES (@StaffRoleId, @TenantId, 'Staff', 'Support Staff — front desk, admission enquiries, visitor logs and campus facilities.', 1, GETUTCDATE());
END

-- Grant Institute Admin full permissions across ALL MenuItems
INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
SELECT NEWID(), @AdminRoleId, m.[Id], 1, 1, 1, 1
FROM [dbo].[MenuItems] m
WHERE m.[IsActive] = 1
  AND NOT EXISTS (
      SELECT 1 FROM [dbo].[RolePermissions] rp
      WHERE rp.[RoleId] = @AdminRoleId AND rp.[MenuItemId] = m.[Id]
  );

-- Grant Teacher standard permissions
INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
SELECT NEWID(), @TeacherRoleId, m.[Id], 1, 1, 1, 0
FROM [dbo].[MenuItems] m
WHERE m.[IsActive] = 1
  AND m.[RouteUrl] IN ('/dashboard', '/students', '/students/attendance', '/batches', '/school/exams', '/school/homework', '/teachers/routine', '/materials', '/school-notices', '/events')
  AND NOT EXISTS (
      SELECT 1 FROM [dbo].[RolePermissions] rp
      WHERE rp.[RoleId] = @TeacherRoleId AND rp.[MenuItemId] = m.[Id]
  );

-- Grant Student standard permissions
INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
SELECT NEWID(), @StudentRoleId, m.[Id], 1, 0, 0, 0
FROM [dbo].[MenuItems] m
WHERE m.[IsActive] = 1
  AND m.[RouteUrl] IN ('/dashboard', '/students/my-profile', '/school/exams', '/school/homework', '/materials', '/school-notices', '/events', '/library', '/hostel', '/transport')
  AND NOT EXISTS (
      SELECT 1 FROM [dbo].[RolePermissions] rp
      WHERE rp.[RoleId] = @StudentRoleId AND rp.[MenuItemId] = m.[Id]
  );

-- Grant Parent standard permissions
INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
SELECT NEWID(), @ParentRoleId, m.[Id], 1, 0, 0, 0
FROM [dbo].[MenuItems] m
WHERE m.[IsActive] = 1
  AND m.[RouteUrl] IN ('/dashboard', '/students/my-profile', '/school/exams', '/school/homework', '/fees', '/school-notices', '/events')
  AND NOT EXISTS (
      SELECT 1 FROM [dbo].[RolePermissions] rp
      WHERE rp.[RoleId] = @ParentRoleId AND rp.[MenuItemId] = m.[Id]
  );

-- Grant HR standard permissions
INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
SELECT NEWID(), @HrRoleId, m.[Id], 1, 1, 1, 1
FROM [dbo].[MenuItems] m
WHERE m.[IsActive] = 1
  AND m.[RouteUrl] IN ('/dashboard', '/teachers', '/teachers/attendance', '/teachers/salaries', '/teachers/fnf', '/teachers/substitution', '/attendance/devices', '/school-notices', '/events')
  AND NOT EXISTS (
      SELECT 1 FROM [dbo].[RolePermissions] rp
      WHERE rp.[RoleId] = @HrRoleId AND rp.[MenuItemId] = m.[Id]
  );

-- Grant Staff standard permissions
INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
SELECT NEWID(), @StaffRoleId, m.[Id], 1, 1, 1, 0
FROM [dbo].[MenuItems] m
WHERE m.[IsActive] = 1
  AND m.[RouteUrl] IN ('/dashboard', '/enquiries', '/front-desk/visitors', '/library', '/hostel', '/transport', '/school-notices', '/events')
  AND NOT EXISTS (
      SELECT 1 FROM [dbo].[RolePermissions] rp
      WHERE rp.[RoleId] = @StaffRoleId AND rp.[MenuItemId] = m.[Id]
  );

PRINT 'Roles and permissions configured for Jnandeep Campus.';
GO

-- 4. Create Users for Jnandeep Campus (Tenant Code: JNANDEEP)
DECLARE @TenantId UNIQUEIDENTIFIER;
SELECT TOP 1 @TenantId = [Id] FROM [dbo].[Tenants] WHERE [Code] = 'JNANDEEP';

DECLARE @AdminRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @AdminRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND [Name] = 'Institute Admin';

DECLARE @TeacherRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @TeacherRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND ([Name] = 'Teacher' OR [Name] = 'Teacher / Faculty');

DECLARE @StudentRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @StudentRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND [Name] = 'Student';

DECLARE @ParentRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @ParentRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND [Name] = 'Parent';

DECLARE @HrRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @HrRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND [Name] = 'HR';

DECLARE @StaffRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @StaffRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND ([Name] = 'Staff' OR [Name] = 'Support & Facility Staff' OR [Name] = 'Front Desk / Receptionist');

-- 4A. admin (Principal / Admin of Jnandeep Campus)
IF EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [TenantId] = @TenantId AND [Username] = 'admin')
BEGIN
    UPDATE [dbo].[Users]
    SET [PasswordHash] = 'password123',
        [RoleId] = @AdminRoleId,
        [Role] = 2,
        [FullName] = 'Principal / Administrator',
        [IsActive] = 1
    WHERE [TenantId] = @TenantId AND [Username] = 'admin';
END
ELSE
BEGIN
    INSERT INTO [dbo].[Users] ([Id], [TenantId], [Username], [PasswordHash], [FullName], [Email], [PhoneNumber], [Role], [RoleId], [IsActive], [CreatedAt])
    VALUES (NEWID(), @TenantId, 'admin', 'password123', 'Principal / Administrator', 'admin@jnandeep.edu.in', '9876543210', 2, @AdminRoleId, 1, GETUTCDATE());
END

-- 4B. teacher
IF EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [TenantId] = @TenantId AND [Username] = 'teacher')
BEGIN
    UPDATE [dbo].[Users]
    SET [PasswordHash] = 'password123',
        [RoleId] = @TeacherRoleId,
        [Role] = 3,
        [FullName] = 'Senior Faculty Member',
        [IsActive] = 1
    WHERE [TenantId] = @TenantId AND [Username] = 'teacher';
END
ELSE
BEGIN
    INSERT INTO [dbo].[Users] ([Id], [TenantId], [Username], [PasswordHash], [FullName], [Email], [PhoneNumber], [Role], [RoleId], [IsActive], [CreatedAt])
    VALUES (NEWID(), @TenantId, 'teacher', 'password123', 'Senior Faculty Member', 'teacher@jnandeep.edu.in', '9876543212', 3, @TeacherRoleId, 1, GETUTCDATE());
END

-- 4C. student
IF EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [TenantId] = @TenantId AND [Username] = 'student')
BEGIN
    UPDATE [dbo].[Users]
    SET [PasswordHash] = 'password123',
        [RoleId] = @StudentRoleId,
        [Role] = 5,
        [FullName] = 'Student User',
        [IsActive] = 1
    WHERE [TenantId] = @TenantId AND [Username] = 'student';
END
ELSE
BEGIN
    INSERT INTO [dbo].[Users] ([Id], [TenantId], [Username], [PasswordHash], [FullName], [Email], [PhoneNumber], [Role], [RoleId], [IsActive], [CreatedAt])
    VALUES (NEWID(), @TenantId, 'student', 'password123', 'Student User', 'student@jnandeep.edu.in', '9876543213', 5, @StudentRoleId, 1, GETUTCDATE());
END

-- 4D. parents / parent
IF EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [TenantId] = @TenantId AND [Username] = 'parents')
BEGIN
    UPDATE [dbo].[Users]
    SET [PasswordHash] = 'password123',
        [RoleId] = @ParentRoleId,
        [Role] = 6,
        [FullName] = 'Parent / Guardian',
        [IsActive] = 1
    WHERE [TenantId] = @TenantId AND [Username] = 'parents';
END
ELSE
BEGIN
    INSERT INTO [dbo].[Users] ([Id], [TenantId], [Username], [PasswordHash], [FullName], [Email], [PhoneNumber], [Role], [RoleId], [IsActive], [CreatedAt])
    VALUES (NEWID(), @TenantId, 'parents', 'password123', 'Parent / Guardian', 'parent@jnandeep.edu.in', '9876543214', 6, @ParentRoleId, 1, GETUTCDATE());
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [TenantId] = @TenantId AND [Username] = 'parent')
BEGIN
    INSERT INTO [dbo].[Users] ([Id], [TenantId], [Username], [PasswordHash], [FullName], [Email], [PhoneNumber], [Role], [RoleId], [IsActive], [CreatedAt])
    VALUES (NEWID(), @TenantId, 'parent', 'password123', 'Parent / Guardian', 'parent2@jnandeep.edu.in', '9876543214', 6, @ParentRoleId, 1, GETUTCDATE());
END

-- 4E. hr
IF EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [TenantId] = @TenantId AND [Username] = 'hr')
BEGIN
    UPDATE [dbo].[Users]
    SET [PasswordHash] = 'password123',
        [RoleId] = @HrRoleId,
        [Role] = 2,
        [FullName] = 'HR Manager',
        [IsActive] = 1
    WHERE [TenantId] = @TenantId AND [Username] = 'hr';
END
ELSE
BEGIN
    INSERT INTO [dbo].[Users] ([Id], [TenantId], [Username], [PasswordHash], [FullName], [Email], [PhoneNumber], [Role], [RoleId], [IsActive], [CreatedAt])
    VALUES (NEWID(), @TenantId, 'hr', 'password123', 'HR Manager', 'hr@jnandeep.edu.in', '9876543215', 2, @HrRoleId, 1, GETUTCDATE());
END

-- 4F. staff
IF EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [TenantId] = @TenantId AND [Username] = 'staff')
BEGIN
    UPDATE [dbo].[Users]
    SET [PasswordHash] = 'password123',
        [RoleId] = @StaffRoleId,
        [Role] = 4,
        [FullName] = 'Support Staff / Front Desk',
        [IsActive] = 1
    WHERE [TenantId] = @TenantId AND [Username] = 'staff';
END
ELSE
BEGIN
    INSERT INTO [dbo].[Users] ([Id], [TenantId], [Username], [PasswordHash], [FullName], [Email], [PhoneNumber], [Role], [RoleId], [IsActive], [CreatedAt])
    VALUES (NEWID(), @TenantId, 'staff', 'password123', 'Support Staff / Front Desk', 'staff@jnandeep.edu.in', '9876543216', 4, @StaffRoleId, 1, GETUTCDATE());
END

-- 5. Create Default Main Branch for Jnandeep Campus if none exists
IF NOT EXISTS (SELECT 1 FROM [dbo].[Branches] WHERE [TenantId] = @TenantId)
BEGIN
    INSERT INTO [dbo].[Branches] ([Id], [TenantId], [Name], [Code], [IsMainBranch], [IsActive], [CreatedAt])
    VALUES (NEWID(), @TenantId, N'Jnandeep Campus - Main Branch', N'MAIN', 1, 1, GETUTCDATE());
    PRINT 'Created Main Branch for Jnandeep Campus.';
END

PRINT 'All users for Jnandeep Campus (JNANDEEP) configured with password: password123.';
GO
