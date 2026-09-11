-- ============================================================================
-- SQL Script: Seed Initial Demo Institute, Users & Data in IMSERP Database
-- Database: IMSERP
-- ============================================================================

USE [IMSERP];
GO

-- 1. Insert Initial Tenant (Coaching Institute)
IF NOT EXISTS (SELECT 1 FROM [dbo].[Tenants] WHERE [Code] = 'APEX')
BEGIN
    INSERT INTO [dbo].[Tenants] ([Id], [Name], [Code], [ContactPhone], [Address], [IsActive], [CreatedAt])
    VALUES (
        '11111111-1111-1111-1111-111111111111',
        N'Apex Coaching Academy',
        N'APEX',
        N'+919876543210',
        N'101 Knowledge Park, New Delhi',
        1,
        GETUTCDATE()
    );
    PRINT 'Demo Tenant APEX inserted.';
END
GO

-- 2. Insert Initial Users (Admin, Teacher, Accountant)
-- Roles: 2 = InstituteAdmin (Director), 3 = Teacher (Faculty), 4 = Accountant
IF NOT EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [Username] = 'admin')
BEGIN
    INSERT INTO [dbo].[Users] ([Id], [TenantId], [Username], [PasswordHash], [FullName], [Email], [PhoneNumber], [Role], [IsActive], [CreatedAt])
    VALUES 
    -- Director / Admin
    (
        '22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111',
        N'admin',
        N'admin123',
        N'Prof. Rajesh Sharma (Director)',
        N'director@apexcoaching.com',
        N'+919876543210',
        2, -- InstituteAdmin
        1,
        GETUTCDATE()
    ),
    -- Faculty / Teacher
    (
        '33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111',
        N'teacher',
        N'teacher123',
        N'Anita Verma (Physics Faculty)',
        N'anita@apexcoaching.com',
        N'+919876543211',
        3, -- Teacher
        1,
        GETUTCDATE()
    ),
    -- Accountant
    (
        '44444444-4444-4444-4444-444444444444',
        '11111111-1111-1111-1111-111111111111',
        N'accountant',
        N'account123',
        N'Suresh Gupta (Accountant)',
        N'accounts@apexcoaching.com',
        N'+919876543212',
        4, -- Accountant
        1,
        GETUTCDATE()
    );
    PRINT 'Initial Users (admin, teacher, accountant) inserted.';
END
GO

-- 3. Insert Initial Batches
IF NOT EXISTS (SELECT 1 FROM [dbo].[Batches] WHERE [Id] = '55555555-5555-5555-5555-555555555555')
BEGIN
    INSERT INTO [dbo].[Batches] ([Id], [TenantId], [Name], [Subject], [AcademicYear], [StandardMonthlyFee], [CreatedAt])
    VALUES 
    (
        '55555555-5555-5555-5555-555555555555',
        '11111111-1111-1111-1111-111111111111',
        N'Class 10th - Science & Math Batch A',
        N'Physics, Chemistry, Math',
        N'2026-2027',
        3500.00,
        GETUTCDATE()
    ),
    (
        '66666666-6666-6666-6666-666666666666',
        '11111111-1111-1111-1111-111111111111',
        N'Class 12th - Board + JEE Physics Target',
        N'Physics',
        N'2026-2027',
        4500.00,
        GETUTCDATE()
    );
    PRINT 'Demo Batches inserted.';
END
GO

-- 4. Insert Sample Students
IF NOT EXISTS (SELECT 1 FROM [dbo].[Students] WHERE [Id] = '77777777-7777-7777-7777-777777777777')
BEGIN
    INSERT INTO [dbo].[Students] ([Id], [TenantId], [BatchId], [RollNumber], [StudentName], [ParentName], [ParentWhatsAppPhone], [Address], [IsActive], [JoiningDate])
    VALUES 
    (
        '77777777-7777-7777-7777-777777777777',
        '11111111-1111-1111-1111-111111111111',
        '55555555-5555-5555-5555-555555555555',
        N'APX-10-001',
        N'Rahul Verma',
        N'Ramesh Verma',
        N'+919988776655',
        N'Sector 14, Gurgaon',
        1,
        GETUTCDATE()
    ),
    (
        '88888888-8888-8888-8888-888888888888',
        '11111111-1111-1111-1111-111111111111',
        '55555555-5555-5555-5555-555555555555',
        N'APX-10-002',
        N'Priya Sharma',
        N'Vikram Sharma',
        N'+919988776644',
        N'DLF Phase 3, Gurgaon',
        1,
        GETUTCDATE()
    );
    PRINT 'Sample Students inserted.';
END
GO

-- 5. Verify User Records
SELECT [Id], [Username], [FullName], [Email], [Role], [IsActive] FROM [dbo].[Users];
GO
