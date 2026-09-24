-- =========================================================================================
-- IMSERP - Finance, Accounting, Balance Sheet & Profit & Loss Database Setup Script
-- Description: Creates ExpenseCategories, ExpenseVouchers, and AccountLedgers tables,
--              configures foreign keys, indexes, and seeds standard default accounts/categories.
-- Target Database: SQL Server (IMSERPDb)
-- =========================================================================================

SET NOCOUNT ON;
PRINT '-------------------------------------------------------------';
PRINT 'Starting IMSERP Finance & Accounting Schema Migration...';
PRINT '-------------------------------------------------------------';

-- 1. Create ExpenseCategories Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ExpenseCategories]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[ExpenseCategories] (
        [Id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [TenantId]    UNIQUEIDENTIFIER NOT NULL,
        [BranchId]    UNIQUEIDENTIFIER NULL,
        [Name]        NVARCHAR(150)    NOT NULL,
        [Code]        NVARCHAR(50)     NOT NULL,
        [Description] NVARCHAR(500)    NULL,
        [IsActive]    BIT              NOT NULL DEFAULT 1,
        [SortOrder]   INT              NOT NULL DEFAULT 0,
        [CreatedAt]   DATETIME2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_ExpenseCategories] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '>> Created table [ExpenseCategories] successfully.';
END
ELSE
BEGIN
    PRINT '>> Table [ExpenseCategories] already exists.';
END
GO

-- 2. Create ExpenseVouchers Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ExpenseVouchers]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[ExpenseVouchers] (
        [Id]                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [TenantId]              UNIQUEIDENTIFIER NOT NULL,
        [BranchId]              UNIQUEIDENTIFIER NULL,
        [VoucherNo]             NVARCHAR(50)     NOT NULL,
        [ExpenseDate]           DATETIME2(7)     NOT NULL,
        [ExpenseCategoryId]     UNIQUEIDENTIFIER NOT NULL,
        [Title]                 NVARCHAR(200)    NOT NULL,
        [Amount]                DECIMAL(18, 2)   NOT NULL,
        [PaymentMode]           INT              NOT NULL DEFAULT 1, -- 1=Cash, 2=UPI, 3=BankTransfer, 4=Cheque, 5=Card
        [VendorName]            NVARCHAR(200)    NULL,
        [BillInvoiceNo]         NVARCHAR(100)    NULL,
        [Description]           NVARCHAR(MAX)    NULL,
        [ReceiptAttachmentUrl]  NVARCHAR(500)    NULL,
        [CreatedByUserId]       UNIQUEIDENTIFIER NULL,
        [CreatedAt]             DATETIME2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_ExpenseVouchers] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_ExpenseVouchers_ExpenseCategories] FOREIGN KEY ([ExpenseCategoryId]) REFERENCES [dbo].[ExpenseCategories] ([Id]) ON DELETE CASCADE
    );
    PRINT '>> Created table [ExpenseVouchers] successfully.';
END
ELSE
BEGIN
    PRINT '>> Table [ExpenseVouchers] already exists.';
END
GO

-- 3. Create AccountLedgers Table (Chart of Accounts for Assets, Liabilities & Capital)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AccountLedgers]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[AccountLedgers] (
        [Id]             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [TenantId]       UNIQUEIDENTIFIER NOT NULL,
        [BranchId]       UNIQUEIDENTIFIER NULL,
        [AccountCode]    NVARCHAR(50)     NOT NULL,
        [AccountName]    NVARCHAR(150)    NOT NULL,
        [AccountType]    INT              NOT NULL, -- 1=Asset, 2=Liability, 3=Equity, 4=Income, 5=Expense
        [SubType]        INT              NOT NULL, -- 1=CurrentAsset, 2=FixedAsset, 3=CurrentLiability, 4=LongTermLiability, 5=Capital
        [OpeningBalance] DECIMAL(18, 2)   NOT NULL DEFAULT 0.00,
        [CurrentBalance] DECIMAL(18, 2)   NOT NULL DEFAULT 0.00,
        [Description]    NVARCHAR(500)    NULL,
        [IsActive]       BIT              NOT NULL DEFAULT 1,
        [IsDefault]      BIT              NOT NULL DEFAULT 0,
        [CreatedAt]      DATETIME2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_AccountLedgers] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '>> Created table [AccountLedgers] successfully.';
END
ELSE
BEGIN
    PRINT '>> Table [AccountLedgers] already exists.';
END
GO

-- 4. Create Indexes for High Performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[ExpenseVouchers]') AND name = N'IX_ExpenseVouchers_Tenant_Date')
BEGIN
    CREATE INDEX [IX_ExpenseVouchers_Tenant_Date] ON [dbo].[ExpenseVouchers] ([TenantId], [ExpenseDate] DESC);
    PRINT '>> Index [IX_ExpenseVouchers_Tenant_Date] created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[AccountLedgers]') AND name = N'IX_AccountLedgers_Tenant_Type')
BEGIN
    CREATE INDEX [IX_AccountLedgers_Tenant_Type] ON [dbo].[AccountLedgers] ([TenantId], [AccountType], [SubType]);
    PRINT '>> Index [IX_AccountLedgers_Tenant_Type] created.';
END
GO

-- 5. Seed Standard Default Expense Categories for All Registered Tenants
DECLARE @TenantId UNIQUEIDENTIFIER;
DECLARE TenantCursor CURSOR FOR 
    SELECT [Id] FROM [dbo].[Tenants] WHERE [IsActive] = 1;

OPEN TenantCursor;
FETCH NEXT FROM TenantCursor INTO @TenantId;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- Standard Operating Expense Categories
    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'UTIL')
        INSERT INTO [dbo].[ExpenseCategories] ([TenantId], [Name], [Code], [Description], [SortOrder])
        VALUES (@TenantId, 'Electricity & Utilities', 'UTIL', 'Electricity, water, generator fuel and utility bills', 1);

    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'RENT')
        INSERT INTO [dbo].[ExpenseCategories] ([TenantId], [Name], [Code], [Description], [SortOrder])
        VALUES (@TenantId, 'Campus & Building Rent', 'RENT', 'School or coaching campus lease and rent payments', 2);

    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'FUEL')
        INSERT INTO [dbo].[ExpenseCategories] ([TenantId], [Name], [Code], [Description], [SortOrder])
        VALUES (@TenantId, 'Transport Fuel & Maintenance', 'FUEL', 'Bus/van diesel, petrol, servicing, and fitness certs', 3);

    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'ACAD')
        INSERT INTO [dbo].[ExpenseCategories] ([TenantId], [Name], [Code], [Description], [SortOrder])
        VALUES (@TenantId, 'Academic & Exam Stationery', 'ACAD', 'Printing question papers, answer sheets, classroom stationery, lab chemicals', 4);

    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'ADV')
        INSERT INTO [dbo].[ExpenseCategories] ([TenantId], [Name], [Code], [Description], [SortOrder])
        VALUES (@TenantId, 'Marketing & Advertising', 'ADV', 'Pamphlets, hoardings, digital ads, social media campaigns, flex boards', 5);

    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'MAINT')
        INSERT INTO [dbo].[ExpenseCategories] ([TenantId], [Name], [Code], [Description], [SortOrder])
        VALUES (@TenantId, 'Repairs & Facility Maintenance', 'MAINT', 'Plumbing, electrical repairs, painting, civil maintenance, furniture repairs', 6);

    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'IT')
        INSERT INTO [dbo].[ExpenseCategories] ([TenantId], [Name], [Code], [Description], [SortOrder])
        VALUES (@TenantId, 'Software, Internet & Telecom', 'IT', 'Broadband internet, ERP/SMS/WhatsApp gateway, hosting and software licenses', 7);

    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'PANTRY')
        INSERT INTO [dbo].[ExpenseCategories] ([TenantId], [Name], [Code], [Description], [SortOrder])
        VALUES (@TenantId, 'Tea, Snacks & Staff Welfare', 'PANTRY', 'Daily staff tea, snacks, meeting refreshments, water cans', 8);

    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'LEGAL')
        INSERT INTO [dbo].[ExpenseCategories] ([TenantId], [Name], [Code], [Description], [SortOrder])
        VALUES (@TenantId, 'Legal, Audit & Bank Charges', 'LEGAL', 'Chartered Accountant audit fees, legal charges, bank transaction charges', 9);

    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'MISC')
        INSERT INTO [dbo].[ExpenseCategories] ([TenantId], [Name], [Code], [Description], [SortOrder])
        VALUES (@TenantId, 'General & Miscellaneous', 'MISC', 'Sundry day-to-day office expenses', 10);

    -- Standard Default Balance Sheet Account Ledgers
    -- AccountType: 1=Asset, 2=Liability, 3=Equity
    -- SubType: 1=CurrentAsset, 2=FixedAsset, 3=CurrentLiability, 4=LongTermLiability, 5=Capital
    IF NOT EXISTS (SELECT 1 FROM [dbo].[AccountLedgers] WHERE [TenantId] = @TenantId AND [AccountCode] = 'CASH-MAIN')
        INSERT INTO [dbo].[AccountLedgers] ([TenantId], [AccountCode], [AccountName], [AccountType], [SubType], [OpeningBalance], [CurrentBalance], [Description], [IsDefault])
        VALUES (@TenantId, 'CASH-MAIN', 'Cash in Hand (Counter)', 1, 1, 0.00, 0.00, 'Main Cash Drawer / Cash Counter Balance', 1);

    IF NOT EXISTS (SELECT 1 FROM [dbo].[AccountLedgers] WHERE [TenantId] = @TenantId AND [AccountCode] = 'BANK-MAIN')
        INSERT INTO [dbo].[AccountLedgers] ([TenantId], [AccountCode], [AccountName], [AccountType], [SubType], [OpeningBalance], [CurrentBalance], [Description], [IsDefault])
        VALUES (@TenantId, 'BANK-MAIN', 'Primary Bank Current Account', 1, 1, 0.00, 0.00, 'Main Operational Bank Account', 1);

    IF NOT EXISTS (SELECT 1 FROM [dbo].[AccountLedgers] WHERE [TenantId] = @TenantId AND [AccountCode] = 'FA-BLDG')
        INSERT INTO [dbo].[AccountLedgers] ([TenantId], [AccountCode], [AccountName], [AccountType], [SubType], [OpeningBalance], [CurrentBalance], [Description], [IsDefault])
        VALUES (@TenantId, 'FA-BLDG', 'Land & Campus Buildings', 1, 2, 0.00, 0.00, 'Freehold/Leasehold Campus Buildings & Infrastructure', 1);

    IF NOT EXISTS (SELECT 1 FROM [dbo].[AccountLedgers] WHERE [TenantId] = @TenantId AND [AccountCode] = 'FA-VEH')
        INSERT INTO [dbo].[AccountLedgers] ([TenantId], [AccountCode], [AccountName], [AccountType], [SubType], [OpeningBalance], [CurrentBalance], [Description], [IsDefault])
        VALUES (@TenantId, 'FA-VEH', 'School Buses & Fleet Vehicles', 1, 2, 0.00, 0.00, 'Buses, vans, staff cars owned by the institute', 1);

    IF NOT EXISTS (SELECT 1 FROM [dbo].[AccountLedgers] WHERE [TenantId] = @TenantId AND [AccountCode] = 'FA-FURN')
        INSERT INTO [dbo].[AccountLedgers] ([TenantId], [AccountCode], [AccountName], [AccountType], [SubType], [OpeningBalance], [CurrentBalance], [Description], [IsDefault])
        VALUES (@TenantId, 'FA-FURN', 'Classroom Furniture & Fixtures', 1, 2, 0.00, 0.00, 'Student benches, teacher tables, whiteboards, air conditioners', 1);

    IF NOT EXISTS (SELECT 1 FROM [dbo].[AccountLedgers] WHERE [TenantId] = @TenantId AND [AccountCode] = 'FA-COMP')
        INSERT INTO [dbo].[AccountLedgers] ([TenantId], [AccountCode], [AccountName], [AccountType], [SubType], [OpeningBalance], [CurrentBalance], [Description], [IsDefault])
        VALUES (@TenantId, 'FA-COMP', 'Computers, Projectors & Lab Equipment', 1, 2, 0.00, 0.00, 'IT equipment, computer labs, smart class projectors, biometric machines', 1);

    IF NOT EXISTS (SELECT 1 FROM [dbo].[AccountLedgers] WHERE [TenantId] = @TenantId AND [AccountCode] = 'CL-CAUTION')
        INSERT INTO [dbo].[AccountLedgers] ([TenantId], [AccountCode], [AccountName], [AccountType], [SubType], [OpeningBalance], [CurrentBalance], [Description], [IsDefault])
        VALUES (@TenantId, 'CL-CAUTION', 'Student Caution Money & Security Deposits', 2, 3, 0.00, 0.00, 'Refundable student security / caution money liability', 1);

    IF NOT EXISTS (SELECT 1 FROM [dbo].[AccountLedgers] WHERE [TenantId] = @TenantId AND [AccountCode] = 'LL-LOAN')
        INSERT INTO [dbo].[AccountLedgers] ([TenantId], [AccountCode], [AccountName], [AccountType], [SubType], [OpeningBalance], [CurrentBalance], [Description], [IsDefault])
        VALUES (@TenantId, 'LL-LOAN', 'Bank Term Loans & Vehicle EMIs', 2, 4, 0.00, 0.00, 'Long term institutional loans from banks/financial institutions', 1);

    IF NOT EXISTS (SELECT 1 FROM [dbo].[AccountLedgers] WHERE [TenantId] = @TenantId AND [AccountCode] = 'EQ-CAPITAL')
        INSERT INTO [dbo].[AccountLedgers] ([TenantId], [AccountCode], [AccountName], [AccountType], [SubType], [OpeningBalance], [CurrentBalance], [Description], [IsDefault])
        VALUES (@TenantId, 'EQ-CAPITAL', 'Institute Capital / Trust Corpus Fund', 3, 5, 0.00, 0.00, 'Initial capital contribution / promoter equity', 1);

    FETCH NEXT FROM TenantCursor INTO @TenantId;
END

CLOSE TenantCursor;
DEALLOCATE TenantCursor;

PRINT '>> Seeded standard default expense categories & ledgers for all active tenants.';
PRINT '-------------------------------------------------------------';
PRINT 'Finance & Accounting Schema Migration Completed Successfully!';
PRINT '-------------------------------------------------------------';
