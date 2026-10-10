-- =========================================================================
-- IMSERP: Setup Jnandeep Campus (Institute Code: SYSTEM) with All Modules & Logins
-- =========================================================================

USE [IMSERP];
GO

SET NOCOUNT ON;

DECLARE @TenantId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000001';
DECLARE @TenantCode NVARCHAR(50) = 'SYSTEM';
DECLARE @TenantName NVARCHAR(200) = N'Jnandeep Campus';

-- 1. Update / Ensure Tenant SYSTEM has Name 'Jnandeep Campus' and ALL Modules Enabled
IF EXISTS (SELECT 1 FROM [dbo].[Tenants] WHERE [Code] = @TenantCode)
BEGIN
    UPDATE [dbo].[Tenants]
    SET [Name] = @TenantName,
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
    WHERE [Code] = @TenantCode;
    PRINT 'Updated Tenant SYSTEM to ' + @TenantName + ' with ALL modules.';
END
ELSE
BEGIN
    INSERT INTO [dbo].[Tenants] (
        [Id], [Name], [Code], [ContactPhone], [Address], [IsActive], [CreatedAt],
        [HasSchoolModule], [HasCoachingModule], [HasHostelModule], [HasLibraryModule], [HasTransportModule],
        [SubscriptionPlan], [SubscriptionStatus], [PaidUntil], [MaxStudentsLimit], [MaxBranchesLimit], [LicensedModules]
    )
    VALUES (
        @TenantId, @TenantName, @TenantCode, N'+919876543210', N'Main Road, Jnandeep Campus', 1, GETUTCDATE(),
        1, 1, 1, 1, 1,
        N'Enterprise', N'Active', '2099-12-31', 10000, 20, N'School,Coaching,Hostel,Library,Transport,Finance,HRMS,Exams,Attendance,FrontDesk'
    );
    PRINT 'Inserted Tenant SYSTEM as ' + @TenantName + ' with ALL modules.';
END
GO

-- 2. Create Roles for Jnandeep Campus
DECLARE @TenantId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000001';

-- Helper to ensure role exists
DECLARE @AdminRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @AdminRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND [Name] = 'Institute Admin';
IF @AdminRoleId IS NULL
BEGIN
    SET @AdminRoleId = NEWID();
    INSERT INTO [dbo].[Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
    VALUES (@AdminRoleId, @TenantId, 'Institute Admin', 'Principal / Center Director — full administrative access to master setup, academics, faculty, finance, attendance and institute settings.', 1, GETUTCDATE());
END

DECLARE @TeacherRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @TeacherRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND ([Name] = 'Teacher' OR [Name] = 'Teacher / Faculty');
IF @TeacherRoleId IS NULL
BEGIN
    SET @TeacherRoleId = NEWID();
    INSERT INTO [dbo].[Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
    VALUES (@TeacherRoleId, @TenantId, 'Teacher', 'Faculty Member — batch lecture assignments, daily lesson diary, student attendance, and exam test results.', 1, GETUTCDATE());
END

DECLARE @StudentRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @StudentRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND [Name] = 'Student';
IF @StudentRoleId IS NULL
BEGIN
    SET @StudentRoleId = NEWID();
    INSERT INTO [dbo].[Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
    VALUES (@StudentRoleId, @TenantId, 'Student', 'Enrolled student — view academic marks, schedule, attendance, fees and notices.', 1, GETUTCDATE());
END

DECLARE @ParentRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @ParentRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND [Name] = 'Parent';
IF @ParentRoleId IS NULL
BEGIN
    SET @ParentRoleId = NEWID();
    INSERT INTO [dbo].[Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
    VALUES (@ParentRoleId, @TenantId, 'Parent', 'Student guardian — view child attendance, test marks, fee receipts and academic reports.', 1, GETUTCDATE());
END

DECLARE @HrRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @HrRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND [Name] = 'HR';
IF @HrRoleId IS NULL
BEGIN
    SET @HrRoleId = NEWID();
    INSERT INTO [dbo].[Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
    VALUES (@HrRoleId, @TenantId, 'HR', 'Human Resources — manages teacher profiles, attendance biometric logs, payroll salaries and staff leave policies.', 1, GETUTCDATE());
END

DECLARE @StaffRoleId UNIQUEIDENTIFIER;
SELECT TOP 1 @StaffRoleId = [Id] FROM [dbo].[Roles] WHERE [TenantId] = @TenantId AND ([Name] = 'Staff' OR [Name] = 'Support & Facility Staff' OR [Name] = 'Front Desk / Receptionist');
IF @StaffRoleId IS NULL
BEGIN
    SET @StaffRoleId = NEWID();
    INSERT INTO [dbo].[Roles] ([Id], [TenantId], [Name], [Description], [IsActive], [CreatedAt])
    VALUES (@StaffRoleId, @TenantId, 'Staff', 'Support Staff — front desk, admission enquiries, visitor logs and campus facilities.', 1, GETUTCDATE());
END

-- 3. Grant Institute Admin full permissions across ALL MenuItems
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

PRINT 'Roles and permissions configured successfully.';
GO

-- 4. Create / Ensure Logins for Jnandeep Campus (Code: SYSTEM)
-- Users: superadmin, admin, teacher, student, parent (parents), hr, staff
-- Password: password123 for all
DECLARE @TenantId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000001';

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

-- 4A. superadmin
IF EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [TenantId] = @TenantId AND [Username] = 'superadmin')
BEGIN
    UPDATE [dbo].[Users]
    SET [PasswordHash] = 'password123',
        [RoleId] = @AdminRoleId,
        [Role] = 2, -- InstituteAdmin
        [FullName] = 'Super Admin (Jnandeep Campus)',
        [IsActive] = 1
    WHERE [TenantId] = @TenantId AND [Username] = 'superadmin';
END
ELSE
BEGIN
    INSERT INTO [dbo].[Users] ([Id], [TenantId], [Username], [PasswordHash], [FullName], [Email], [PhoneNumber], [Role], [RoleId], [IsActive], [CreatedAt])
    VALUES (NEWID(), @TenantId, 'superadmin', 'password123', 'Super Admin (Jnandeep Campus)', 'superadmin@jnandeep.edu.in', '9876543210', 2, @AdminRoleId, 1, GETUTCDATE());
END

-- 4B. admin
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
    VALUES (NEWID(), @TenantId, 'admin', 'password123', 'Principal / Administrator', 'admin@jnandeep.edu.in', '9876543211', 2, @AdminRoleId, 1, GETUTCDATE());
END

-- 4C. teacher
IF EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [TenantId] = @TenantId AND [Username] = 'teacher')
BEGIN
    UPDATE [dbo].[Users]
    SET [PasswordHash] = 'password123',
        [RoleId] = @TeacherRoleId,
        [Role] = 3, -- Teacher
        [FullName] = 'Senior Faculty Member',
        [IsActive] = 1
    WHERE [TenantId] = @TenantId AND [Username] = 'teacher';
END
ELSE
BEGIN
    INSERT INTO [dbo].[Users] ([Id], [TenantId], [Username], [PasswordHash], [FullName], [Email], [PhoneNumber], [Role], [RoleId], [IsActive], [CreatedAt])
    VALUES (NEWID(), @TenantId, 'teacher', 'password123', 'Senior Faculty Member', 'teacher@jnandeep.edu.in', '9876543212', 3, @TeacherRoleId, 1, GETUTCDATE());
END

-- 4D. student
IF EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [TenantId] = @TenantId AND [Username] = 'student')
BEGIN
    UPDATE [dbo].[Users]
    SET [PasswordHash] = 'password123',
        [RoleId] = @StudentRoleId,
        [Role] = 5, -- Student
        [FullName] = 'Student User',
        [IsActive] = 1
    WHERE [TenantId] = @TenantId AND [Username] = 'student';
END
ELSE
BEGIN
    INSERT INTO [dbo].[Users] ([Id], [TenantId], [Username], [PasswordHash], [FullName], [Email], [PhoneNumber], [Role], [RoleId], [IsActive], [CreatedAt])
    VALUES (NEWID(), @TenantId, 'student', 'password123', 'Student User', 'student@jnandeep.edu.in', '9876543213', 5, @StudentRoleId, 1, GETUTCDATE());
END

-- 4E. parents / parent
IF EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [TenantId] = @TenantId AND [Username] = 'parents')
BEGIN
    UPDATE [dbo].[Users]
    SET [PasswordHash] = 'password123',
        [RoleId] = @ParentRoleId,
        [Role] = 6, -- Parent
        [FullName] = 'Parent / Guardian',
        [IsActive] = 1
    WHERE [TenantId] = @TenantId AND [Username] = 'parents';
END
ELSE
BEGIN
    INSERT INTO [dbo].[Users] ([Id], [TenantId], [Username], [PasswordHash], [FullName], [Email], [PhoneNumber], [Role], [RoleId], [IsActive], [CreatedAt])
    VALUES (NEWID(), @TenantId, 'parents', 'password123', 'Parent / Guardian', 'parent@jnandeep.edu.in', '9876543214', 6, @ParentRoleId, 1, GETUTCDATE());
END

-- Also ensure 'parent' username works
IF NOT EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [TenantId] = @TenantId AND [Username] = 'parent')
BEGIN
    INSERT INTO [dbo].[Users] ([Id], [TenantId], [Username], [PasswordHash], [FullName], [Email], [PhoneNumber], [Role], [RoleId], [IsActive], [CreatedAt])
    VALUES (NEWID(), @TenantId, 'parent', 'password123', 'Parent / Guardian', 'parent2@jnandeep.edu.in', '9876543214', 6, @ParentRoleId, 1, GETUTCDATE());
END

-- 4F. hr
IF EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [TenantId] = @TenantId AND [Username] = 'hr')
BEGIN
    UPDATE [dbo].[Users]
    SET [PasswordHash] = 'password123',
        [RoleId] = @HrRoleId,
        [Role] = 2, -- Admin / HR
        [FullName] = 'HR Manager',
        [IsActive] = 1
    WHERE [TenantId] = @TenantId AND [Username] = 'hr';
END
ELSE
BEGIN
    INSERT INTO [dbo].[Users] ([Id], [TenantId], [Username], [PasswordHash], [FullName], [Email], [PhoneNumber], [Role], [RoleId], [IsActive], [CreatedAt])
    VALUES (NEWID(), @TenantId, 'hr', 'password123', 'HR Manager', 'hr@jnandeep.edu.in', '9876543215', 2, @HrRoleId, 1, GETUTCDATE());
END

-- 4G. staff
IF EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [TenantId] = @TenantId AND [Username] = 'staff')
BEGIN
    UPDATE [dbo].[Users]
    SET [PasswordHash] = 'password123',
        [RoleId] = @StaffRoleId,
        [Role] = 4, -- Staff
        [FullName] = 'Support Staff / Front Desk',
        [IsActive] = 1
    WHERE [TenantId] = @TenantId AND [Username] = 'staff';
END
ELSE
BEGIN
    INSERT INTO [dbo].[Users] ([Id], [TenantId], [Username], [PasswordHash], [FullName], [Email], [PhoneNumber], [Role], [RoleId], [IsActive], [CreatedAt])
    VALUES (NEWID(), @TenantId, 'staff', 'password123', 'Support Staff / Front Desk', 'staff@jnandeep.edu.in', '9876543216', 4, @StaffRoleId, 1, GETUTCDATE());
END

PRINT 'All users (superadmin, admin, teacher, student, parents, hr, staff) configured with password: password123.';
GO
