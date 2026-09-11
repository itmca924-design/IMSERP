-- ============================================================================
-- SQL Script: Create IMSERP Database & Coaching Micro-SaaS Schema
-- Server Target: LAPTOP-MM46D5U5
-- Database Name: IMSERP
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

-- 2. Create Tenants Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Tenants]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Tenants] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [Name] NVARCHAR(200) NOT NULL,
        [Code] NVARCHAR(50) NOT NULL,
        [ContactPhone] NVARCHAR(50) NULL,
        [Address] NVARCHAR(500) NULL,
        [WhatsAppPhoneId] NVARCHAR(100) NULL,
        [WhatsAppAccessToken] NVARCHAR(MAX) NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
END
GO

-- 3. Create Users Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Users] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [Username] NVARCHAR(100) NOT NULL,
        [PasswordHash] NVARCHAR(256) NOT NULL,
        [FullName] NVARCHAR(200) NOT NULL,
        [Email] NVARCHAR(150) NULL,
        [PhoneNumber] NVARCHAR(50) NULL,
        [Role] INT NOT NULL, -- 1: SuperAdmin, 2: InstituteAdmin, 3: Teacher, 4: Accountant, 5: Parent, 6: Student
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [FK_Users_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]) ON DELETE CASCADE
    );
END
GO

-- 4. Create Batches Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Batches]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Batches] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [Name] NVARCHAR(200) NOT NULL,
        [Subject] NVARCHAR(200) NOT NULL,
        [AcademicYear] NVARCHAR(50) NOT NULL,
        [StandardMonthlyFee] DECIMAL(18,2) NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [FK_Batches_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id])
    );
END
GO

-- 5. Create Students Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Students]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Students] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BatchId] UNIQUEIDENTIFIER NOT NULL,
        [RollNumber] NVARCHAR(50) NOT NULL,
        [StudentName] NVARCHAR(200) NOT NULL,
        [ParentName] NVARCHAR(200) NOT NULL,
        [ParentWhatsAppPhone] NVARCHAR(50) NOT NULL,
        [Address] NVARCHAR(500) NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [JoiningDate] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [FK_Students_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_Students_Batches] FOREIGN KEY ([BatchId]) REFERENCES [dbo].[Batches]([Id]) ON DELETE CASCADE
    );
END
GO

-- 6. Create FeeInvoices Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FeeInvoices]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[FeeInvoices] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [StudentId] UNIQUEIDENTIFIER NOT NULL,
        [InvoiceNumber] NVARCHAR(50) NOT NULL,
        [Title] NVARCHAR(200) NOT NULL,
        [TotalAmount] DECIMAL(18,2) NOT NULL,
        [PaidAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
        [DueDate] DATETIME2 NOT NULL,
        [Status] INT NOT NULL DEFAULT 1, -- 1: Pending, 2: Partial, 3: Paid, 4: Overdue
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [FK_FeeInvoices_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_FeeInvoices_Students] FOREIGN KEY ([StudentId]) REFERENCES [dbo].[Students]([Id]) ON DELETE CASCADE
    );
END
GO

-- 7. Create FeePayments Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FeePayments]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[FeePayments] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [InvoiceId] UNIQUEIDENTIFIER NOT NULL,
        [ReceiptNumber] NVARCHAR(50) NOT NULL,
        [AmountPaid] DECIMAL(18,2) NOT NULL,
        [Mode] INT NOT NULL DEFAULT 1, -- 1: Cash, 2: UPI, 3: Card, 4: NetBanking
        [TransactionRef] NVARCHAR(100) NULL,
        [PaymentDate] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [Remarks] NVARCHAR(500) NULL,
        CONSTRAINT [FK_FeePayments_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_FeePayments_FeeInvoices] FOREIGN KEY ([InvoiceId]) REFERENCES [dbo].[FeeInvoices]([Id]) ON DELETE CASCADE
    );
END
GO

-- 8. Create Tests Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Tests]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Tests] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BatchId] UNIQUEIDENTIFIER NOT NULL,
        [Title] NVARCHAR(200) NOT NULL,
        [Subject] NVARCHAR(100) NOT NULL,
        [MaxMarks] DECIMAL(18,2) NOT NULL,
        [TestDate] DATETIME2 NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [FK_Tests_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_Tests_Batches] FOREIGN KEY ([BatchId]) REFERENCES [dbo].[Batches]([Id]) ON DELETE CASCADE
    );
END
GO

-- 9. Create TestMarks Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TestMarks]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[TestMarks] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [TestId] UNIQUEIDENTIFIER NOT NULL,
        [StudentId] UNIQUEIDENTIFIER NOT NULL,
        [MarksObtained] DECIMAL(18,2) NOT NULL DEFAULT 0,
        [Rank] INT NOT NULL DEFAULT 0,
        [IsAbsent] BIT NOT NULL DEFAULT 0,
        [Remarks] NVARCHAR(500) NULL,
        CONSTRAINT [FK_TestMarks_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_TestMarks_Tests] FOREIGN KEY ([TestId]) REFERENCES [dbo].[Tests]([Id]),
        CONSTRAINT [FK_TestMarks_Students] FOREIGN KEY ([StudentId]) REFERENCES [dbo].[Students]([Id])
    );
END
GO

-- 10. Create WhatsAppLogs Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[WhatsAppLogs]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[WhatsAppLogs] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [RecipientPhone] NVARCHAR(50) NOT NULL,
        [StudentName] NVARCHAR(200) NOT NULL,
        [MessageType] INT NOT NULL, -- 1: FeeReceipt, 2: FeeReminder, 3: TestMarks, 4: Announcement
        [Content] NVARCHAR(MAX) NOT NULL,
        [Status] NVARCHAR(50) NOT NULL DEFAULT 'Sent',
        [SentAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [FK_WhatsAppLogs_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id])
    );
END
GO

PRINT 'All tables for IMSERP database created successfully.';
GO
