-- =============================================================
-- IMSERP: School + Coaching Unified ERP Architecture Migration
-- Safe & Non-Breaking: Retains all existing Coaching data & Batches
-- Run this script in SQL Server Management Studio (SSMS)
-- Database: IMSERP
-- =============================================================

USE IMSERP;
GO

-- 1. Create SchoolClasses Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SchoolClasses')
BEGIN
    CREATE TABLE SchoolClasses (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        Name NVARCHAR(100) NOT NULL, -- e.g. 'Class 1st', 'Class 8th', 'Class 10th'
        Code NVARCHAR(50) NULL,      -- e.g. 'C08', 'C10'
        DisplayOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT 'Created table SchoolClasses';
END;
GO

-- 2. Create SchoolSections Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SchoolSections')
BEGIN
    CREATE TABLE SchoolSections (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        ClassId UNIQUEIDENTIFIER NOT NULL,
        Name NVARCHAR(50) NOT NULL, -- e.g. 'A', 'B', 'C'
        MaxCapacity INT NOT NULL DEFAULT 45,
        RoomId UNIQUEIDENTIFIER NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_SchoolSections_SchoolClasses FOREIGN KEY (ClassId) REFERENCES SchoolClasses(Id) ON DELETE CASCADE
    );
    PRINT 'Created table SchoolSections';
END;
GO

-- 3. Enhance Students Table with School & Coaching Dual Identity
-- Make BatchId nullable so School-only students can be admitted without a dummy batch
ALTER TABLE Students ALTER COLUMN BatchId UNIQUEIDENTIFIER NULL;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'AdmissionNumber')
BEGIN
    ALTER TABLE Students ADD AdmissionNumber NVARCHAR(100) NULL; -- School Admission / Scholar Register No
    PRINT 'Added AdmissionNumber column to Students';
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'ClassId')
BEGIN
    ALTER TABLE Students ADD ClassId UNIQUEIDENTIFIER NULL;
    PRINT 'Added ClassId column to Students';
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'SectionId')
BEGIN
    ALTER TABLE Students ADD SectionId UNIQUEIDENTIFIER NULL;
    PRINT 'Added SectionId column to Students';
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'SchoolRollNumber')
BEGIN
    ALTER TABLE Students ADD SchoolRollNumber NVARCHAR(50) NULL;
    PRINT 'Added SchoolRollNumber column to Students';
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'CoachingRollNumber')
BEGIN
    ALTER TABLE Students ADD CoachingRollNumber NVARCHAR(50) NULL;
    PRINT 'Added CoachingRollNumber column to Students';
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'IsSchoolStudent')
BEGIN
    ALTER TABLE Students ADD IsSchoolStudent BIT NOT NULL DEFAULT 0;
    PRINT 'Added IsSchoolStudent column to Students';
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'IsCoachingStudent')
BEGIN
    ALTER TABLE Students ADD IsCoachingStudent BIT NOT NULL DEFAULT 1; -- Existing students default to Coaching
    PRINT 'Added IsCoachingStudent column to Students';
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'Gender')
BEGIN
    ALTER TABLE Students ADD Gender NVARCHAR(20) NULL;
    PRINT 'Added Gender column to Students';
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'DateOfBirth')
BEGIN
    ALTER TABLE Students ADD DateOfBirth DATETIME2 NULL;
    PRINT 'Added DateOfBirth column to Students';
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'MotherName')
BEGIN
    ALTER TABLE Students ADD MotherName NVARCHAR(150) NULL;
    PRINT 'Added MotherName column to Students';
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'BloodGroup')
BEGIN
    ALTER TABLE Students ADD BloodGroup NVARCHAR(10) NULL;
    PRINT 'Added BloodGroup column to Students';
END;
GO

-- 4. Sync existing coaching students so their RollNumber is preserved in CoachingRollNumber
UPDATE Students
SET CoachingRollNumber = RollNumber,
    IsCoachingStudent = 1
WHERE CoachingRollNumber IS NULL AND RollNumber IS NOT NULL;
GO

-- 5. Enhance FeeInvoices to support School & Coaching Fee streams
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('FeeInvoices') AND name = 'InvoiceCategory')
BEGIN
    ALTER TABLE FeeInvoices ADD InvoiceCategory NVARCHAR(50) NOT NULL DEFAULT 'Coaching'; -- 'Coaching' or 'School'
    PRINT 'Added InvoiceCategory column to FeeInvoices';
END;
GO

PRINT 'IMSERP School + Coaching Migration Completed Successfully!';
