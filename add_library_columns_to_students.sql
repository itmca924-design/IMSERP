-- ==============================================================================
-- Migration Script: Add Library Membership Columns to Students Table
-- Database: IMSERP
-- Safe & Idempotent (Checks IF NOT EXISTS before adding columns)
-- ==============================================================================

USE [IMSERP]; -- Or your active ERP database name
GO

-- 1. IsLibraryMember (Flag indicating if student opted into Library membership)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'IsLibraryMember')
BEGIN
    ALTER TABLE [dbo].[Students] 
    ADD [IsLibraryMember] BIT NOT NULL CONSTRAINT [DF_Students_IsLibraryMember] DEFAULT (0);
    PRINT 'Added IsLibraryMember column to Students (Default: 0 - Unchecked)';
END
ELSE
BEGIN
    PRINT 'IsLibraryMember already exists.';
END
GO

-- 2. LibraryCardNumber (Barcode / Card identifier for library access)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'LibraryCardNumber')
BEGIN
    ALTER TABLE [dbo].[Students] 
    ADD [LibraryCardNumber] NVARCHAR(100) NULL;
    PRINT 'Added LibraryCardNumber column to Students';
END
ELSE
BEGIN
    PRINT 'LibraryCardNumber already exists.';
END
GO

-- 3. LibraryMembershipType (Shift / Facility type, e.g. 'Standard Book Lending', 'Morning Study Shift (8AM-1PM)')
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'LibraryMembershipType')
BEGIN
    ALTER TABLE [dbo].[Students] 
    ADD [LibraryMembershipType] NVARCHAR(100) NULL;
    PRINT 'Added LibraryMembershipType column to Students';
END
ELSE
BEGIN
    PRINT 'LibraryMembershipType already exists.';
END
GO

-- 4. MaxLibraryBooks (Maximum concurrent book borrow limit, default 2)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'MaxLibraryBooks')
BEGIN
    ALTER TABLE [dbo].[Students] 
    ADD [MaxLibraryBooks] INT NOT NULL CONSTRAINT [DF_Students_MaxLibraryBooks] DEFAULT (2);
    PRINT 'Added MaxLibraryBooks column to Students (Default: 2)';
END
ELSE
BEGIN
    PRINT 'MaxLibraryBooks already exists.';
END
GO

-- 5. MonthlyLibraryFee (Monthly library / reading room facility fee, default 0)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'MonthlyLibraryFee')
BEGIN
    ALTER TABLE [dbo].[Students] 
    ADD [MonthlyLibraryFee] DECIMAL(18, 2) NOT NULL CONSTRAINT [DF_Students_MonthlyLibraryFee] DEFAULT (0.00);
    PRINT 'Added MonthlyLibraryFee column to Students (Default: 0.00)';
END
ELSE
BEGIN
    PRINT 'MonthlyLibraryFee already exists.';
END
GO

-- 6. Index on LibraryCardNumber for instant barcode lookups
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Students_LibraryCardNumber' AND object_id = OBJECT_ID('Students'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Students_LibraryCardNumber] 
    ON [dbo].[Students]([LibraryCardNumber]) 
    WHERE [LibraryCardNumber] IS NOT NULL;
    PRINT 'Created index IX_Students_LibraryCardNumber on Students';
END
GO

PRINT '=======================================================';
PRINT 'Library columns added to Students table successfully!';
PRINT '=======================================================';
