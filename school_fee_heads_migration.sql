-- ============================================================================
-- IMSERP: School Multi-Head Fee Structure Architecture Migration
-- Safe & Idempotent: Retains all existing Coaching & School data
-- Database: IMSERP
-- ============================================================================

USE [IMSERP];
GO

-- 1. Create FeeHeads Master Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FeeHeads')
BEGIN
    CREATE TABLE FeeHeads (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        Name NVARCHAR(150) NOT NULL,
        Code NVARCHAR(50) NOT NULL,
        Category NVARCHAR(80) NOT NULL DEFAULT 'Academic', -- 'Academic', 'Infrastructure', 'Activities', 'Supplies', 'Residential', 'Transport', 'Other'
        Frequency NVARCHAR(50) NOT NULL DEFAULT 'Monthly',  -- 'Monthly', 'Quarterly', 'Annual', 'OneTime', 'TermWise', 'AdHoc'
        Description NVARCHAR(300) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        IsDefault BIT NOT NULL DEFAULT 0,
        SortOrder INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_FeeHeads_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_FeeHeads_Tenant_Branch ON FeeHeads(TenantId, BranchId);
    CREATE INDEX IX_FeeHeads_Code ON FeeHeads(TenantId, Code);
    PRINT 'Created table FeeHeads';
END;
GO

-- 2. Create ClassFeeStructures (Class / Batch to Fee Head Amount Mapping) Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ClassFeeStructures')
BEGIN
    CREATE TABLE ClassFeeStructures (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        ClassId UNIQUEIDENTIFIER NULL,                      -- Optional link to SchoolClasses
        BatchId UNIQUEIDENTIFIER NULL,                      -- Optional link to Batches
        FeeHeadId UNIQUEIDENTIFIER NOT NULL,
        Amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        ApplicableMonth INT NULL,                           -- NULL = Every billing cycle; 1-12 = Only in that month (e.g. 4 for April)
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_ClassFeeStructures_FeeHeads FOREIGN KEY (FeeHeadId) REFERENCES FeeHeads(Id) ON DELETE CASCADE,
        CONSTRAINT FK_ClassFeeStructures_SchoolClasses FOREIGN KEY (ClassId) REFERENCES SchoolClasses(Id) ON DELETE CASCADE,
        CONSTRAINT FK_ClassFeeStructures_Batches FOREIGN KEY (BatchId) REFERENCES Batches(Id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_ClassFeeStructures_Tenant ON ClassFeeStructures(TenantId, BranchId);
    CREATE INDEX IX_ClassFeeStructures_Class ON ClassFeeStructures(ClassId);
    CREATE INDEX IX_ClassFeeStructures_Batch ON ClassFeeStructures(BatchId);
    PRINT 'Created table ClassFeeStructures';
END;
GO

-- 3. Create FeeInvoiceItems (Itemized Breakdown for Invoices) Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FeeInvoiceItems')
BEGIN
    CREATE TABLE FeeInvoiceItems (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        InvoiceId UNIQUEIDENTIFIER NOT NULL,
        FeeHeadId UNIQUEIDENTIFIER NULL,
        HeadName NVARCHAR(150) NOT NULL,
        Amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        PaidAmount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_FeeInvoiceItems_FeeInvoices FOREIGN KEY (InvoiceId) REFERENCES FeeInvoices(Id) ON DELETE CASCADE,
        CONSTRAINT FK_FeeInvoiceItems_FeeHeads FOREIGN KEY (FeeHeadId) REFERENCES FeeHeads(Id) ON DELETE SET NULL
    );
    CREATE INDEX IX_FeeInvoiceItems_InvoiceId ON FeeInvoiceItems(InvoiceId);
    PRINT 'Created table FeeInvoiceItems';
END;
GO

-- 4. Seed Standard Default Fee Heads for all existing Tenants
INSERT INTO FeeHeads (Id, TenantId, BranchId, Name, Code, Category, Frequency, Description, IsActive, IsDefault, SortOrder)
SELECT 
    NEWID(),
    t.Id,
    NULL,
    seed.Name,
    seed.Code,
    seed.Category,
    seed.Frequency,
    seed.Description,
    1,
    seed.IsDefault,
    seed.SortOrder
FROM Tenants t
CROSS JOIN (
    VALUES
        (N'Tuition Fee', N'TUI', N'Academic', N'Monthly', N'Standard monthly academic & coaching instruction fee', 1, 1),
        (N'Computer & Smart Class Fee', N'COMP', N'Academic', N'Monthly', N'IT lab, computers, projector & digital classroom charge', 1, 2),
        (N'Sports & Physical Activity Fee', N'SPORT', N'Activities', N'Annual', N'Physical education, sports ground & games event charge', 1, 3),
        (N'Annual Development Charge', N'ANNUAL', N'Infrastructure', N'Annual', N'School building, campus development & annual maintenance', 1, 4),
        (N'Tie, Belt, Badge & Diary Kit', N'KIT', N'Supplies', N'OneTime', N'School kit: Tie, belt, student badge and academic diary', 1, 5),
        (N'Examination Fee', N'EXAM', N'Academic', N'TermWise', N'Terminal examination paper printing & report cards cost', 1, 6),
        (N'Science & Lab Practical Fee', N'LAB', N'Academic', N'Annual', N'Science lab equipments and practical chemical charges', 1, 7),
        (N'Hostel / Accommodation Fee', N'HOSTEL', N'Residential', N'Monthly', N'Hostel boarding and residential room maintenance fee', 0, 8),
        (N'Mess & Dining Fee', N'MESS', N'Residential', N'Monthly', N'Hostel mess, breakfast, lunch and dinner catering fee', 0, 9),
        (N'Transport / Bus Stoppage Fee', N'TRANS', N'Transport', N'Monthly', N'School bus / van pick and drop transportation charge', 0, 10),
        (N'Miscellaneous & Activity Fee', N'MISC', N'Other', N'AdHoc', N'Ad-hoc cultural events, tours or miscellaneous expense', 0, 11)
) AS seed(Name, Code, Category, Frequency, Description, IsDefault, SortOrder)
WHERE NOT EXISTS (
    SELECT 1 FROM FeeHeads fh WHERE fh.TenantId = t.Id AND fh.Code = seed.Code
);
GO

PRINT '=======================================================';
PRINT 'IMSERP School Fee Heads Database Migration Completed!';
PRINT '=======================================================';
