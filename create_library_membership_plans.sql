-- ==============================================================================
-- Migration Script: Create LibraryMembershipPlans Table & Seed Default Shifts/Plans
-- Database: IMSERP
-- Safe & Idempotent (Checks IF NOT EXISTS before creating or inserting)
-- ==============================================================================

USE [IMSERP];
GO

-- 1. Create LibraryMembershipPlans Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LibraryMembershipPlans')
BEGIN
    CREATE TABLE [dbo].[LibraryMembershipPlans] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [PlanName] NVARCHAR(120) NOT NULL,
        [ShiftTiming] NVARCHAR(100) NULL,
        [MonthlyFee] DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
        [MaxBooks] INT NOT NULL DEFAULT 2,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [SortOrder] INT NOT NULL DEFAULT 0,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX [IX_LibraryMembershipPlans_Tenant] ON [dbo].[LibraryMembershipPlans]([TenantId], [IsActive]);
    PRINT 'Created table LibraryMembershipPlans successfully.';
END
ELSE
BEGIN
    PRINT 'Table LibraryMembershipPlans already exists.';
END
GO

-- 2. Seed Default Plans if table is empty
DECLARE @TenantId UNIQUEIDENTIFIER;
SELECT TOP 1 @TenantId = [Id] FROM [dbo].[Tenants];
IF @TenantId IS NULL
BEGIN
    SET @TenantId = '00000000-0000-0000-0000-000000000001';
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[LibraryMembershipPlans])
BEGIN
    INSERT INTO [dbo].[LibraryMembershipPlans] 
        ([Id], [TenantId], [BranchId], [PlanName], [ShiftTiming], [MonthlyFee], [MaxBooks], [IsActive], [SortOrder], [CreatedAt])
    VALUES
        (NEWID(), @TenantId, NULL, 'Standard Book Lending', 'Home Issue / Book Borrowing', 0.00, 2, 1, 1, GETUTCDATE()),
        (NEWID(), @TenantId, NULL, 'Morning Study Shift (8AM - 1PM)', '8:00 AM - 1:00 PM', 500.00, 2, 1, 2, GETUTCDATE()),
        (NEWID(), @TenantId, NULL, 'Evening Study Shift (2PM - 7PM)', '2:00 PM - 7:00 PM', 500.00, 2, 1, 3, GETUTCDATE()),
        (NEWID(), @TenantId, NULL, 'Full Day Reading Shift (8AM - 8PM)', '8:00 AM - 8:00 PM', 800.00, 4, 1, 4, GETUTCDATE());

    PRINT 'Seeded 4 default library membership plans.';
END
ELSE
BEGIN
    PRINT 'LibraryMembershipPlans already contains data.';
END
GO

PRINT '=======================================================';
PRINT 'LibraryMembershipPlans setup completed successfully!';
PRINT '=======================================================';
