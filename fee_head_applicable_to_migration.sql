-- =========================================================================================
-- Migration: Add ApplicableTo column to FeeHeads table and tag standard heads
-- Target Database: SQL Server (IMSERPDb)
-- =========================================================================================

SET NOCOUNT ON;
PRINT 'Starting FeeHeads ApplicableTo migration...';

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FeeHeads]') AND type in (N'U'))
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FeeHeads]') AND name = 'ApplicableTo')
    BEGIN
        ALTER TABLE [dbo].[FeeHeads] ADD [ApplicableTo] NVARCHAR(50) NOT NULL DEFAULT 'Both';
        PRINT '>> Added column [ApplicableTo] to [FeeHeads] table.';
    END
    ELSE
    BEGIN
        PRINT '>> Column [ApplicableTo] already exists on [FeeHeads].';
    END
END
GO

-- Update standard fee head presets with their appropriate scope
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FeeHeads]') AND name = 'ApplicableTo')
BEGIN
    -- School Only:
    UPDATE [dbo].[FeeHeads] SET [ApplicableTo] = 'School' WHERE [Code] IN ('LAB', 'SPORT', 'KIT', 'ANNUAL');
    -- Coaching Only:
    UPDATE [dbo].[FeeHeads] SET [ApplicableTo] = 'Coaching' WHERE [Code] IN ('COACH', 'MAT');
    -- Both (Common):
    UPDATE [dbo].[FeeHeads] SET [ApplicableTo] = 'Both' WHERE [Code] IN ('TUI', 'ADM', 'EXAM', 'COMP', 'LIB', 'TRANS', 'HOSTEL', 'MESS', 'MISC');

    PRINT '>> Updated standard preset FeeHeads with proper ApplicableTo tags (School, Coaching, Both).';
END
GO
