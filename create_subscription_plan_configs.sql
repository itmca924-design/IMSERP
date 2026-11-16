-- SQL Migration: Create SubscriptionPlanConfigs table and default dynamic SaaS pricing
IF OBJECT_ID('dbo.SubscriptionPlanConfigs') IS NULL
BEGIN
    CREATE TABLE dbo.SubscriptionPlanConfigs (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        PlanCode NVARCHAR(50) NOT NULL DEFAULT 'PREMIUM',
        PlanName NVARCHAR(100) NOT NULL DEFAULT 'Premium Enterprise Edition',
        TrialDurationDays INT NOT NULL DEFAULT 90,
        TrialFee DECIMAL(18, 2) NOT NULL DEFAULT 3000.00,
        AnnualOneTimePrice DECIMAL(18, 2) NOT NULL DEFAULT 10000.00,
        MonthlyRate DECIMAL(18, 2) NOT NULL DEFAULT 1000.00,
        AnnualMonthlyTotal DECIMAL(18, 2) NOT NULL DEFAULT 12000.00,
        SoftwareSetupFee DECIMAL(18, 2) NOT NULL DEFAULT 15000.00,
        MaxStudentsLimit INT NOT NULL DEFAULT 1000,
        MaxBranchesLimit INT NOT NULL DEFAULT 5,
        IsActive BIT NOT NULL DEFAULT 1,
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedBy NVARCHAR(100) NULL
    );

    INSERT INTO dbo.SubscriptionPlanConfigs (
        Id, PlanCode, PlanName, TrialDurationDays, TrialFee,
        AnnualOneTimePrice, MonthlyRate, AnnualMonthlyTotal, SoftwareSetupFee,
        MaxStudentsLimit, MaxBranchesLimit, IsActive, UpdatedAt, UpdatedBy
    ) VALUES (
        NEWID(), 'PREMIUM', 'Premium Enterprise Edition', 90, 3000.00,
        10000.00, 1000.00, 12000.00, 15000.00,
        1000, 5, 1, GETUTCDATE(), 'SYSTEM'
    );
    PRINT 'Created SubscriptionPlanConfigs table and seeded initial record.';
END
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SubscriptionPlanConfigs WHERE IsActive = 1)
BEGIN
    INSERT INTO dbo.SubscriptionPlanConfigs (
        Id, PlanCode, PlanName, TrialDurationDays, TrialFee,
        AnnualOneTimePrice, MonthlyRate, AnnualMonthlyTotal, SoftwareSetupFee,
        MaxStudentsLimit, MaxBranchesLimit, IsActive, UpdatedAt, UpdatedBy
    ) VALUES (
        NEWID(), 'PREMIUM', 'Premium Enterprise Edition', 90, 3000.00,
        10000.00, 1000.00, 12000.00, 15000.00,
        1000, 5, 1, GETUTCDATE(), 'SYSTEM'
    );
    PRINT 'Seeded initial active SubscriptionPlanConfigs record.';
END
ELSE
BEGIN
    PRINT 'SubscriptionPlanConfigs already exists and has active record.';
END
