-- ============================================================================
-- IMSERP: Library Management System Architecture Migration
-- Safe & Non-Breaking: Retains all existing Coaching & School data
-- Run this script in SQL Server Management Studio (SSMS)
-- Database: IMSERP
-- ============================================================================

USE [IMSERP];
GO

-- 1. Create LibraryBooks Master Catalog Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LibraryBooks')
BEGIN
    CREATE TABLE LibraryBooks (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        Title NVARCHAR(250) NOT NULL,
        Author NVARCHAR(180) NOT NULL,
        Publisher NVARCHAR(150) NULL,
        Edition NVARCHAR(50) NULL,
        ISBN NVARCHAR(50) NULL,
        Category NVARCHAR(100) NOT NULL DEFAULT 'General', -- 'NCERT', 'JEE Advanced', 'NEET', 'Foundation', 'Reference', 'Sample Papers'
        Subject NVARCHAR(100) NULL,                         -- 'Physics', 'Mathematics', 'Chemistry', 'Biology'
        ClassId UNIQUEIDENTIFIER NULL,                      -- Optional link to SchoolClasses
        Description NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        IsActive BIT NOT NULL DEFAULT 1,
        CONSTRAINT FK_LibraryBooks_SchoolClasses FOREIGN KEY (ClassId) REFERENCES SchoolClasses(Id) ON DELETE SET NULL
    );
    CREATE INDEX IX_LibraryBooks_Tenant_Branch ON LibraryBooks(TenantId, BranchId);
    CREATE INDEX IX_LibraryBooks_Title_Author ON LibraryBooks(Title, Author);
    PRINT 'Created table LibraryBooks';
END;
GO

-- 2. Create BookCopies (Physical Copies & Accession Numbers) Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BookCopies')
BEGIN
    CREATE TABLE BookCopies (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        BookId UNIQUEIDENTIFIER NOT NULL,
        AccessionNumber NVARCHAR(60) NOT NULL, -- e.g. 'ACC-00101', Barcode scan target
        Barcode NVARCHAR(100) NULL,
        RackLocation NVARCHAR(100) NULL,       -- e.g. 'Almirah B - Shelf 3'
        Price DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        Status NVARCHAR(50) NOT NULL DEFAULT 'Available', -- 'Available', 'Issued', 'Lost', 'Damaged', 'ReferenceOnly'
        ConditionNotes NVARCHAR(250) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        IsActive BIT NOT NULL DEFAULT 1,
        CONSTRAINT FK_BookCopies_LibraryBooks FOREIGN KEY (BookId) REFERENCES LibraryBooks(Id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX UX_BookCopies_Tenant_Accession ON BookCopies(TenantId, AccessionNumber);
    CREATE INDEX IX_BookCopies_Status ON BookCopies(Status);
    PRINT 'Created table BookCopies';
END;
GO

-- 3. Create LibraryCirculations (Issue, Return, Renewal & Fine Ledger) Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LibraryCirculations')
BEGIN
    CREATE TABLE LibraryCirculations (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        BookCopyId UNIQUEIDENTIFIER NOT NULL,
        StudentId UNIQUEIDENTIFIER NULL,
        TeacherId UNIQUEIDENTIFIER NULL,
        MemberType NVARCHAR(50) NOT NULL DEFAULT 'Student', -- 'Student' or 'Teacher'
        IssueDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        DueDate DATETIME2 NOT NULL,
        ReturnDate DATETIME2 NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'Issued',      -- 'Issued', 'Returned', 'Overdue', 'Lost'
        OverdueDays INT NOT NULL DEFAULT 0,
        FinePerDay DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        FineAmount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        FineStatus NVARCHAR(50) NOT NULL DEFAULT 'None',    -- 'None', 'Pending', 'Paid', 'Waived'
        FinePaymentReceiptNumber NVARCHAR(50) NULL,
        FinePaidAt DATETIME2 NULL,
        Remarks NVARCHAR(300) NULL,
        IssuedByUserId UNIQUEIDENTIFIER NULL,
        ReceivedByUserId UNIQUEIDENTIFIER NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_LibraryCirculations_BookCopies FOREIGN KEY (BookCopyId) REFERENCES BookCopies(Id) ON DELETE CASCADE,
        CONSTRAINT FK_LibraryCirculations_Students FOREIGN KEY (StudentId) REFERENCES Students(Id) ON DELETE SET NULL,
        CONSTRAINT FK_LibraryCirculations_Teachers FOREIGN KEY (TeacherId) REFERENCES Teachers(Id) ON DELETE SET NULL
    );
    CREATE INDEX IX_LibraryCirculations_Status_DueDate ON LibraryCirculations(Status, DueDate);
    CREATE INDEX IX_LibraryCirculations_Student ON LibraryCirculations(StudentId);
    CREATE INDEX IX_LibraryCirculations_Receipt ON LibraryCirculations(FinePaymentReceiptNumber);
    PRINT 'Created table LibraryCirculations';
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('LibraryCirculations') AND name = 'FinePaymentReceiptNumber')
    BEGIN
        ALTER TABLE LibraryCirculations ADD FinePaymentReceiptNumber NVARCHAR(50) NULL;
        CREATE INDEX IX_LibraryCirculations_Receipt ON LibraryCirculations(FinePaymentReceiptNumber);
        PRINT 'Added column FinePaymentReceiptNumber to LibraryCirculations';
    END;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('LibraryCirculations') AND name = 'FinePaidAt')
    BEGIN
        ALTER TABLE LibraryCirculations ADD FinePaidAt DATETIME2 NULL;
        PRINT 'Added column FinePaidAt to LibraryCirculations';
    END;
END;
GO

-- 4. Create LibrarySettings (Institutional Borrowing Rules & Fine Configuration) Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LibrarySettings')
BEGIN
    CREATE TABLE LibrarySettings (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        MaxBooksPerStudent INT NOT NULL DEFAULT 2,
        MaxBooksPerTeacher INT NOT NULL DEFAULT 5,
        StudentIssueDays INT NOT NULL DEFAULT 14,
        TeacherIssueDays INT NOT NULL DEFAULT 30,
        DailyFineRate DECIMAL(18,2) NOT NULL DEFAULT 2.00, -- ₹2/day late fine
        AllowFineWaiver BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_LibrarySettings_Tenant ON LibrarySettings(TenantId, BranchId);
    PRINT 'Created table LibrarySettings';
END;
GO

-- 5. Seed Default LibrarySettings for existing Tenants
INSERT INTO LibrarySettings (Id, TenantId, BranchId, MaxBooksPerStudent, MaxBooksPerTeacher, StudentIssueDays, TeacherIssueDays, DailyFineRate, AllowFineWaiver)
SELECT 
    NEWID(),
    t.Id,
    NULL,
    2,
    5,
    14,
    30,
    2.00,
    1
FROM Tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM LibrarySettings s WHERE s.TenantId = t.Id
);
GO

-- 6. Seed Library Navigation Menu under Academic Operations
DECLARE @AcademicMenuId UNIQUEIDENTIFIER = NULL;

SELECT TOP 1 @AcademicMenuId = [Id]
FROM [dbo].[MenuItems]
WHERE [Title] LIKE '%Academic%' AND [ParentId] IS NULL AND [IsActive] = 1;

IF @AcademicMenuId IS NOT NULL
BEGIN
    -- 6a. Books Catalog Menu
    DECLARE @LibraryBooksMenuId UNIQUEIDENTIFIER = '30000000-0000-0000-0000-000000000031';
    IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = @LibraryBooksMenuId OR [RouteUrl] = '/library/books')
    BEGIN
        INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
        VALUES (@LibraryBooksMenuId, N'Library Books', N'/library/books', N'local_library', @AcademicMenuId, 4, N'Academic', 1);
        PRINT 'Inserted Library Books menu item.';
    END;

    -- 6b. Circulation Desk (Issue & Return) Menu
    DECLARE @LibraryCirculationMenuId UNIQUEIDENTIFIER = '30000000-0000-0000-0000-000000000032';
    IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = @LibraryCirculationMenuId OR [RouteUrl] = '/library/circulation')
    BEGIN
        INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
        VALUES (@LibraryCirculationMenuId, N'Book Issue & Return', N'/library/circulation', N'sync_alt', @AcademicMenuId, 5, N'Academic', 1);
        PRINT 'Inserted Book Issue & Return menu item.';
    END;

    -- Grant Permissions to all Active Roles
    INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
    SELECT NEWID(), r.[Id], m.[Id], 1, 1, 1, 1
    FROM [dbo].[Roles] r
    CROSS JOIN (
        SELECT [Id] FROM [dbo].[MenuItems] WHERE [RouteUrl] IN ('/library/books', '/library/circulation')
    ) m
    WHERE NOT EXISTS (
        SELECT 1 FROM [dbo].[RolePermissions] rp WHERE rp.[RoleId] = r.[Id] AND rp.[MenuItemId] = m.[Id]
    );
    PRINT 'Granted Library permissions to all active roles.';
END;
GO

PRINT '=======================================================';
PRINT 'IMSERP Library Module Database Migration Completed!';
PRINT '=======================================================';
