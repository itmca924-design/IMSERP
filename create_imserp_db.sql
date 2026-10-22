-- ============================================================================
-- SQL Script: Create IMSERP Database & Multi-Tenant Multi-Branch SaaS Schema
-- Server Target: Local SQL Server / Production SQL Server
-- Database Name: IMSERP
-- Architecture: Dual-Tier Multi-Tenant (TenantId) & Multi-Branch (BranchId)
-- ============================================================================

USE [master];
GO

-- 1. Create Database IMSERP if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'IMSERP')
BEGIN
    CREATE DATABASE [IMSERP];
    PRINT 'Database IMSERP created successfully.';
END
ELSE
BEGIN
    PRINT 'Database IMSERP already exists.';
END
GO

USE [IMSERP];
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 2. Create Tenants Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Tenants]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Tenants] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_Tenants] PRIMARY KEY DEFAULT NEWID(),
        [Name] NVARCHAR(200) NOT NULL,
        [Code] NVARCHAR(50) NOT NULL,
        [ContactPhone] NVARCHAR(50) NULL,
        [Address] NVARCHAR(500) NULL,
        [WhatsAppPhoneId] NVARCHAR(100) NULL,
        [WhatsAppAccessToken] NVARCHAR(MAX) NULL,
        [IsActive] BIT NOT NULL CONSTRAINT [DF_Tenants_IsActive] DEFAULT (1),
        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Tenants_CreatedAt] DEFAULT (SYSUTCDATETIME())
    );
    CREATE UNIQUE INDEX [UX_Tenants_Code] ON [dbo].[Tenants] ([Code]);
    PRINT 'Tenants table created successfully.';
END
GO

-- 3. Create Branches Table (Strict Multi-Branch Support)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Branches]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Branches] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_Branches] PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [Name] NVARCHAR(150) NOT NULL,
        [Code] NVARCHAR(50) NOT NULL,
        [Address] NVARCHAR(300) NULL,
        [ContactPhone] NVARCHAR(50) NULL,
        [IsMainBranch] BIT NOT NULL CONSTRAINT [DF_Branches_IsMainBranch] DEFAULT (0),
        [IsActive] BIT NOT NULL CONSTRAINT [DF_Branches_IsActive] DEFAULT (1),
        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Branches_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_Branches_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX [UX_Branches_Tenant_Code] ON [dbo].[Branches] ([TenantId], [Code]);
    PRINT 'Branches table created successfully.';
END
GO

-- 4. Create Users Table (Tenant & Branch Partitioned)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Users] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_Users] PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [Username] NVARCHAR(100) NOT NULL,
        [PasswordHash] NVARCHAR(256) NOT NULL,
        [FullName] NVARCHAR(200) NOT NULL,
        [Email] NVARCHAR(150) NULL,
        [PhoneNumber] NVARCHAR(50) NULL,
        [Role] INT NOT NULL, -- 1: SuperAdmin, 2: InstituteAdmin, 3: Teacher, 4: Accountant, 5: Parent, 6: Student
        [IsActive] BIT NOT NULL CONSTRAINT [DF_Users_IsActive] DEFAULT (1),
        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Users_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_Users_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_Users_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]) ON DELETE NO ACTION
    );
    CREATE INDEX [IX_Users_Tenant_Branch] ON [dbo].[Users] ([TenantId], [BranchId]);
    PRINT 'Users table created successfully.';
END
GO

-- 5. Create Rooms (Classrooms) Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Rooms]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Rooms] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_Rooms] PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NOT NULL,
        [RoomNumber] NVARCHAR(50) NOT NULL,
        [Capacity] INT NOT NULL CONSTRAINT [DF_Rooms_Capacity] DEFAULT (40),
        [Floor] NVARCHAR(50) NULL,
        [IsActive] BIT NOT NULL CONSTRAINT [DF_Rooms_IsActive] DEFAULT (1),
        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Rooms_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_Rooms_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_Rooms_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_Rooms_Tenant_Branch] ON [dbo].[Rooms] ([TenantId], [BranchId]);
    PRINT 'Rooms table created successfully.';
END
GO

-- 6. Create SchoolClasses Table (Tenant & Branch Partitioned)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SchoolClasses]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[SchoolClasses] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_SchoolClasses] PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [Name] NVARCHAR(100) NOT NULL, -- e.g. 'Class 10th', 'Class 9th'
        [Code] NVARCHAR(50) NULL,
        [DisplayOrder] INT NOT NULL CONSTRAINT [DF_SchoolClasses_DisplayOrder] DEFAULT (0),
        [IsActive] BIT NOT NULL CONSTRAINT [DF_SchoolClasses_IsActive] DEFAULT (1),
        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_SchoolClasses_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_SchoolClasses_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_SchoolClasses_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]) ON DELETE NO ACTION
    );
    CREATE INDEX [IX_SchoolClasses_Tenant_Branch] ON [dbo].[SchoolClasses] ([TenantId], [BranchId]);
    PRINT 'SchoolClasses table created successfully.';
END
GO

-- 7. Create SchoolSections Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SchoolSections]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[SchoolSections] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_SchoolSections] PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [ClassId] UNIQUEIDENTIFIER NOT NULL,
        [Name] NVARCHAR(50) NOT NULL,
        [MaxCapacity] INT NOT NULL CONSTRAINT [DF_SchoolSections_MaxCapacity] DEFAULT (45),
        [RoomId] UNIQUEIDENTIFIER NULL,
        [IsActive] BIT NOT NULL CONSTRAINT [DF_SchoolSections_IsActive] DEFAULT (1),
        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_SchoolSections_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_SchoolSections_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_SchoolSections_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_SchoolSections_SchoolClasses] FOREIGN KEY ([ClassId]) REFERENCES [dbo].[SchoolClasses]([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_SchoolSections_Rooms] FOREIGN KEY ([RoomId]) REFERENCES [dbo].[Rooms]([Id]) ON DELETE NO ACTION
    );
    CREATE INDEX [IX_SchoolSections_Class] ON [dbo].[SchoolSections] ([ClassId]);
    PRINT 'SchoolSections table created successfully.';
END
GO

-- 8. Create Batches Table (Coaching Batches with BranchId & ClassId)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Batches]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Batches] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_Batches] PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [RoomId] UNIQUEIDENTIFIER NULL,
        [ClassId] UNIQUEIDENTIFIER NULL,
        [Name] NVARCHAR(200) NOT NULL,
        [Subject] NVARCHAR(200) NOT NULL,
        [AcademicYear] NVARCHAR(50) NOT NULL,
        [StandardMonthlyFee] DECIMAL(18,2) NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Batches_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_Batches_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_Batches_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Batches_Rooms] FOREIGN KEY ([RoomId]) REFERENCES [dbo].[Rooms]([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Batches_SchoolClasses] FOREIGN KEY ([ClassId]) REFERENCES [dbo].[SchoolClasses]([Id]) ON DELETE NO ACTION
    );
    CREATE INDEX [IX_Batches_Tenant_Branch] ON [dbo].[Batches] ([TenantId], [BranchId]);
    CREATE INDEX [IX_Batches_ClassId] ON [dbo].[Batches] ([ClassId]);
    PRINT 'Batches table created successfully.';
END
GO

-- 9. Create Students Table (School & Coaching Dual Identity, Tenant & Branch Partitioned)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Students]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Students] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_Students] PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [BatchId] UNIQUEIDENTIFIER NULL,
        [ClassId] UNIQUEIDENTIFIER NULL,
        [SectionId] UNIQUEIDENTIFIER NULL,
        [AdmissionNumber] NVARCHAR(100) NULL,
        [RollNumber] NVARCHAR(50) NOT NULL,
        [StudentName] NVARCHAR(200) NOT NULL,
        [ParentName] NVARCHAR(200) NOT NULL,
        [ParentWhatsAppPhone] NVARCHAR(50) NOT NULL,
        [Address] NVARCHAR(500) NULL,
        [IsActive] BIT NOT NULL CONSTRAINT [DF_Students_IsActive] DEFAULT (1),
        [JoiningDate] DATETIME2 NOT NULL CONSTRAINT [DF_Students_JoiningDate] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_Students_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_Students_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Students_Batches] FOREIGN KEY ([BatchId]) REFERENCES [dbo].[Batches]([Id]) ON DELETE SET NULL,
        CONSTRAINT [FK_Students_SchoolClasses] FOREIGN KEY ([ClassId]) REFERENCES [dbo].[SchoolClasses]([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Students_SchoolSections] FOREIGN KEY ([SectionId]) REFERENCES [dbo].[SchoolSections]([Id]) ON DELETE NO ACTION
    );
    CREATE INDEX [IX_Students_Tenant_Branch] ON [dbo].[Students] ([TenantId], [BranchId]);
    CREATE INDEX [IX_Students_Batch] ON [dbo].[Students] ([BatchId]);
    CREATE INDEX [IX_Students_Class_Section] ON [dbo].[Students] ([ClassId], [SectionId]);
    PRINT 'Students table created successfully.';
END
GO

-- 10. Create FeeInvoices Table (Tenant & Branch Partitioned)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FeeInvoices]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[FeeInvoices] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_FeeInvoices] PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [StudentId] UNIQUEIDENTIFIER NOT NULL,
        [InvoiceNumber] NVARCHAR(50) NOT NULL,
        [Title] NVARCHAR(200) NOT NULL,
        [TotalAmount] DECIMAL(18,2) NOT NULL,
        [PaidAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_FeeInvoices_PaidAmount] DEFAULT (0),
        [DueDate] DATETIME2 NOT NULL,
        [Status] INT NOT NULL CONSTRAINT [DF_FeeInvoices_Status] DEFAULT (1), -- 1: Pending, 2: Partial, 3: Paid, 4: Overdue
        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_FeeInvoices_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_FeeInvoices_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_FeeInvoices_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_FeeInvoices_Students] FOREIGN KEY ([StudentId]) REFERENCES [dbo].[Students]([Id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_FeeInvoices_Tenant_Branch] ON [dbo].[FeeInvoices] ([TenantId], [BranchId]);
    CREATE INDEX [IX_FeeInvoices_Student] ON [dbo].[FeeInvoices] ([StudentId]);
    PRINT 'FeeInvoices table created successfully.';
END
GO

-- 11. Create FeePayments Table (Tenant & Branch Partitioned)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FeePayments]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[FeePayments] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_FeePayments] PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [InvoiceId] UNIQUEIDENTIFIER NOT NULL,
        [ReceiptNumber] NVARCHAR(50) NOT NULL,
        [AmountPaid] DECIMAL(18,2) NOT NULL,
        [Mode] INT NOT NULL CONSTRAINT [DF_FeePayments_Mode] DEFAULT (1), -- 1: Cash, 2: UPI, 3: Card, 4: NetBanking
        [TransactionRef] NVARCHAR(100) NULL,
        [PaymentDate] DATETIME2 NOT NULL CONSTRAINT [DF_FeePayments_PaymentDate] DEFAULT (SYSUTCDATETIME()),
        [Remarks] NVARCHAR(500) NULL,
        CONSTRAINT [FK_FeePayments_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_FeePayments_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_FeePayments_FeeInvoices] FOREIGN KEY ([InvoiceId]) REFERENCES [dbo].[FeeInvoices]([Id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_FeePayments_Tenant_Branch] ON [dbo].[FeePayments] ([TenantId], [BranchId]);
    PRINT 'FeePayments table created successfully.';
END
GO

-- 12. Create Tests Table (Tenant & Branch Partitioned)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Tests]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Tests] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_Tests] PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [BatchId] UNIQUEIDENTIFIER NULL,
        [ClassId] UNIQUEIDENTIFIER NULL,
        [Title] NVARCHAR(200) NOT NULL,
        [Subject] NVARCHAR(100) NOT NULL,
        [MaxMarks] DECIMAL(18,2) NOT NULL,
        [TestDate] DATETIME2 NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Tests_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_Tests_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_Tests_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Tests_Batches] FOREIGN KEY ([BatchId]) REFERENCES [dbo].[Batches]([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_Tests_SchoolClasses] FOREIGN KEY ([ClassId]) REFERENCES [dbo].[SchoolClasses]([Id]) ON DELETE NO ACTION
    );
    CREATE INDEX [IX_Tests_Tenant_Branch] ON [dbo].[Tests] ([TenantId], [BranchId]);
    PRINT 'Tests table created successfully.';
END
GO

-- 13. Create TestMarks Table (Tenant & Branch Partitioned)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TestMarks]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[TestMarks] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_TestMarks] PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [TestId] UNIQUEIDENTIFIER NOT NULL,
        [StudentId] UNIQUEIDENTIFIER NOT NULL,
        [MarksObtained] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_TestMarks_MarksObtained] DEFAULT (0),
        [Rank] INT NOT NULL CONSTRAINT [DF_TestMarks_Rank] DEFAULT (0),
        [IsAbsent] BIT NOT NULL CONSTRAINT [DF_TestMarks_IsAbsent] DEFAULT (0),
        [Remarks] NVARCHAR(500) NULL,
        CONSTRAINT [FK_TestMarks_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_TestMarks_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_TestMarks_Tests] FOREIGN KEY ([TestId]) REFERENCES [dbo].[Tests]([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_TestMarks_Students] FOREIGN KEY ([StudentId]) REFERENCES [dbo].[Students]([Id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_TestMarks_Tenant_Branch] ON [dbo].[TestMarks] ([TenantId], [BranchId]);
    PRINT 'TestMarks table created successfully.';
END
GO

-- 14. Create WhatsAppLogs Table (Tenant & Branch Partitioned)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[WhatsAppLogs]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[WhatsAppLogs] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_WhatsAppLogs] PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [RecipientPhone] NVARCHAR(50) NOT NULL,
        [StudentName] NVARCHAR(200) NOT NULL,
        [MessageType] INT NOT NULL, -- 1: FeeReceipt, 2: FeeReminder, 3: TestMarks, 4: Announcement
        [Content] NVARCHAR(MAX) NOT NULL,
        [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_WhatsAppLogs_Status] DEFAULT ('Sent'),
        [SentAt] DATETIME2 NOT NULL CONSTRAINT [DF_WhatsAppLogs_SentAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_WhatsAppLogs_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_WhatsAppLogs_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]) ON DELETE NO ACTION
    );
    CREATE INDEX [IX_WhatsAppLogs_Tenant_Branch] ON [dbo].[WhatsAppLogs] ([TenantId], [BranchId]);
    PRINT 'WhatsAppLogs table created successfully.';
END
GO

-- 15. Create AutomationSettings Table (Tenant & Branch Partitioned)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AutomationSettings]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[AutomationSettings] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_AutomationSettings] PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [WhatsAppFeeReceiptsEnabled] BIT NOT NULL CONSTRAINT [DF_AutomationSettings_WhatsAppFeeReceipts] DEFAULT (1),
        [DailyAbsenteeAlertEnabled] BIT NOT NULL CONSTRAINT [DF_AutomationSettings_DailyAbsentee] DEFAULT (1),
        [DailyAbsenteeAlertTime] NVARCHAR(10) NOT NULL CONSTRAINT [DF_AutomationSettings_DailyAbsenteeTime] DEFAULT ('10:30'),
        [LastAbsenteeAlertDate] DATETIME2 NULL,
        [FeeDueRemindersEnabled] BIT NOT NULL CONSTRAINT [DF_AutomationSettings_FeeDueReminders] DEFAULT (1),
        [FeeDueDaysPrior] INT NOT NULL CONSTRAINT [DF_AutomationSettings_FeeDueDays] DEFAULT (7),
        [LastFeeReminderDate] DATETIME2 NULL,
        [BiometricSyncEnabled] BIT NOT NULL CONSTRAINT [DF_AutomationSettings_BiometricSync] DEFAULT (1),
        [LastBiometricSyncAt] DATETIME2 NULL,
        [LateFeeAutoComputeEnabled] BIT NOT NULL CONSTRAINT [DF_AutomationSettings_LateFeeAuto] DEFAULT (1),
        [LateFeeDailyRate] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_AutomationSettings_LateFeeRate] DEFAULT (10),
        [LateFeeGraceDays] INT NOT NULL CONSTRAINT [DF_AutomationSettings_LateFeeGrace] DEFAULT (5),
        [AutoPilotFeeInvoicingEnabled] BIT NOT NULL CONSTRAINT [DF_AutomationSettings_AutoPilotInvoicing] DEFAULT (0),
        [AutoPilotInvoicingDayOfMonth] INT NOT NULL CONSTRAINT [DF_AutomationSettings_AutoPilotDay] DEFAULT (25),
        [LastAutoPilotInvoicingRun] DATETIME2 NULL,
        [AdmissionCutoffDay] INT NOT NULL CONSTRAINT [DF_AutomationSettings_CutoffDay] DEFAULT (20),
        [AdmissionRolloverPolicy] NVARCHAR(50) NOT NULL CONSTRAINT [DF_AutomationSettings_RolloverPolicy] DEFAULT ('NextMonthFull'),
        [FinancialYearStartMonth] INT NOT NULL CONSTRAINT [DF_AutomationSettings_FYStartMonth] DEFAULT (4),
        [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_AutomationSettings_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_AutomationSettings_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_AutomationSettings_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]) ON DELETE NO ACTION
    );
    CREATE INDEX [IX_AutomationSettings_Tenant_Branch] ON [dbo].[AutomationSettings] ([TenantId], [BranchId]);
    PRINT 'AutomationSettings table created successfully.';
END
GO

PRINT '========================================================================';
PRINT 'All multi-tenant and branch-partitioned tables initialized successfully.';
PRINT '========================================================================';
GO
