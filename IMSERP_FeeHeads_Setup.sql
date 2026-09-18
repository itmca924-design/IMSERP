-- =========================================================================================
-- IMSERP - Fee Heads Database Table Creation & Standard Presets Data Seed Script
-- Description: Creates the FeeHeads table (if not exists), adds indexes, registers the
--              'Fee Heads Master' menu under 'Academic Operations' for all roles,
--              and inserts the 15 standard fee head presets for all registered tenants.
-- Target Database: SQL Server (IMSERPDb)
-- =========================================================================================

SET NOCOUNT ON;
PRINT '-------------------------------------------------------------';
PRINT 'Starting IMSERP FeeHeads Table & Data Setup...';
PRINT '-------------------------------------------------------------';

-- 1. Create FeeHeads table if it does not already exist
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FeeHeads]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[FeeHeads] (
        [Id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [TenantId]    UNIQUEIDENTIFIER NOT NULL,
        [BranchId]    UNIQUEIDENTIFIER NULL,
        [Name]        NVARCHAR(150)    NOT NULL,
        [Code]        NVARCHAR(50)     NOT NULL,
        [Category]    NVARCHAR(100)    NOT NULL DEFAULT 'Academic',
        [Frequency]   NVARCHAR(50)     NOT NULL DEFAULT 'Monthly',
        [Description] NVARCHAR(500)    NULL,
        [IsActive]    BIT              NOT NULL DEFAULT 1,
        [IsDefault]   BIT              NOT NULL DEFAULT 0,
        [SortOrder]   INT              NOT NULL DEFAULT 0,
        [CreatedAt]   DATETIME2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_FeeHeads] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '>> Created table [FeeHeads] successfully.';
END
ELSE
BEGIN
    PRINT '>> Table [FeeHeads] already exists. Checking columns...';
    
    -- Ensure all columns exist (idempotent alterations)
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FeeHeads]') AND name = 'Category')
        ALTER TABLE [dbo].[FeeHeads] ADD [Category] NVARCHAR(100) NOT NULL DEFAULT 'Academic';

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FeeHeads]') AND name = 'Frequency')
        ALTER TABLE [dbo].[FeeHeads] ADD [Frequency] NVARCHAR(50) NOT NULL DEFAULT 'Monthly';

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FeeHeads]') AND name = 'Description')
        ALTER TABLE [dbo].[FeeHeads] ADD [Description] NVARCHAR(500) NULL;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FeeHeads]') AND name = 'IsActive')
        ALTER TABLE [dbo].[FeeHeads] ADD [IsActive] BIT NOT NULL DEFAULT 1;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FeeHeads]') AND name = 'IsDefault')
        ALTER TABLE [dbo].[FeeHeads] ADD [IsDefault] BIT NOT NULL DEFAULT 0;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FeeHeads]') AND name = 'SortOrder')
        ALTER TABLE [dbo].[FeeHeads] ADD [SortOrder] INT NOT NULL DEFAULT 0;
END
GO

-- 2. Create useful indexes for tenant isolation & lookup speed
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[FeeHeads]') AND name = N'IX_FeeHeads_TenantId_Code')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FeeHeads_TenantId_Code] 
    ON [dbo].[FeeHeads] ([TenantId] ASC, [Code] ASC);
    PRINT '>> Created index [IX_FeeHeads_TenantId_Code].';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[FeeHeads]') AND name = N'IX_FeeHeads_TenantId_IsActive')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_FeeHeads_TenantId_IsActive] 
    ON [dbo].[FeeHeads] ([TenantId] ASC, [IsActive] ASC)
    INCLUDE ([Name], [Category], [Frequency], [SortOrder]);
    PRINT '>> Created index [IX_FeeHeads_TenantId_IsActive].';
END
GO

-- 3. Register 'Fee Heads Master' Menu Item under 'Academic Operations'
DECLARE @AcademicMenuId UNIQUEIDENTIFIER = NULL;
SELECT TOP 1 @AcademicMenuId = [Id] FROM [dbo].[MenuItems] WHERE [Title] = 'Academic Operations' AND [ParentId] IS NULL;

IF (@AcademicMenuId IS NOT NULL)
BEGIN
    DECLARE @FeeHeadMenuId UNIQUEIDENTIFIER = NULL;
    SELECT TOP 1 @FeeHeadMenuId = [Id] FROM [dbo].[MenuItems] WHERE [RouteUrl] = '/fee-heads';

    IF (@FeeHeadMenuId IS NULL)
    BEGIN
        SET @FeeHeadMenuId = NEWID();
        INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
        VALUES (
            @FeeHeadMenuId,
            'Fee Heads Master',
            '/fee-heads',
            'account_tree',
            @AcademicMenuId,
            2,
            'Academic',
            1
        );
        PRINT '>> Inserted [Fee Heads Master] menu item under Academic Operations.';

        -- Grant permissions to all roles for this new menu item
        INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
        SELECT 
            NEWID(),
            r.[Id],
            @FeeHeadMenuId,
            1, 1, 1, 1
        FROM [dbo].[Roles] r
        WHERE NOT EXISTS (
            SELECT 1 FROM [dbo].[RolePermissions] rp 
            WHERE rp.[RoleId] = r.[Id] AND rp.[MenuItemId] = @FeeHeadMenuId
        );
        PRINT '>> Granted Full Permissions to all existing Roles for [Fee Heads Master].';
    END
    ELSE
    BEGIN
        PRINT '>> Menu item [/fee-heads] already exists in [MenuItems].';
    END
END
ELSE
BEGIN
    PRINT '>> Note: Parent menu [Academic Operations] not found in MenuItems. Menu item insertion deferred to runtime auto-seed.';
END
GO

-- 4. Seed Standard Fee Head Presets for All Tenants
-- Define 15 industry-standard presets covering coaching institutes, schools, and dual setups:
CREATE TABLE #PresetHeads (
    [Name] NVARCHAR(150),
    [Code] NVARCHAR(50),
    [Category] NVARCHAR(100),
    [Frequency] NVARCHAR(50),
    [Description] NVARCHAR(500),
    [SortOrder] INT,
    [IsDefault] BIT
);

INSERT INTO #PresetHeads ([Name], [Code], [Category], [Frequency], [Description], [SortOrder], [IsDefault])
VALUES
('Tuition Fee',                  'TUI',     'Academic',       'Monthly',   'Core academic monthly tuition fee for syllabus coverage and curriculum teaching', 10, 1),
('Coaching & Guidance Fee',      'COACH',   'Academic',       'Monthly',   'After-school coaching, doubt sessions & competitive test preparation guidance',  20, 1),
('Admission & Registration Fee', 'ADM',     'Academic',       'OneTime',   'One-time student registration, prospectus, enrollment and onboarding charge',      30, 1),
('Examination & Assessment Fee', 'EXAM',    'Academic',       'TermWise',  'Terminal/semester exam paper printing, invigilation and digital marksheets',       40, 0),
('Computer & Smart Class Fee',   'COMP',    'Infrastructure', 'Monthly',   'Computer lab access, high-speed Wi-Fi & interactive digital board maintenance',   50, 0),
('Science Laboratory Fee',       'LAB',     'Infrastructure', 'Monthly',   'Physics, Chemistry, Biology laboratory equipment, glassware & practicals',        60, 0),
('Library & Reading Room',       'LIB',     'Academic',       'Annual',    'Annual library subscription, textbook issues, reference books & reading space',    70, 0),
('Study Material & Modules',     'MAT',     'Academic',       'OneTime',   'Printed study packages, formula booklets, question banks & daily practice papers', 80, 0),
('Transport / Bus Facility',     'TRANS',   'Transport',      'Monthly',   'Monthly dedicated school/coaching bus, van or transit transport charge',          90, 0),
('Sports & Cultural Activity',   'SPORT',   'Activities',     'Annual',    'Annual sports meet, athletic coaching, cultural fest, and co-curricular events',  100, 0),
('Hostel & Boarding Fee',        'HOSTEL',  'Residential',    'Monthly',   'Hostel lodging, room accommodation, power backup and boarding facilities',        110, 0),
('Mess & Dining Charge',         'MESS',    'Residential',    'Monthly',   'Breakfast, lunch, evening refreshment and dinner catering charges',               120, 0),
('Tie, Belt, Badge & Diary Kit', 'KIT',     'Supplies',       'OneTime',   'Student identity kit: institutional diary, student card, uniform tie and belt',   130, 0),
('Annual Development Charge',    'ANNUAL',  'Infrastructure', 'Annual',    'Institutional campus upgrade, emergency medical and annual maintenance fund',     140, 0),
('Miscellaneous / Fines',        'MISC',    'Other',          'AdHoc',     'Late submission fine, loss-of-asset recovery, or incidental non-academic fee',     150, 0);

-- Insert presets for each registered tenant where the code does not already exist
INSERT INTO [dbo].[FeeHeads] (
    [Id],
    [TenantId],
    [BranchId],
    [Name],
    [Code],
    [Category],
    [Frequency],
    [Description],
    [IsActive],
    [IsDefault],
    [SortOrder],
    [CreatedAt]
)
SELECT 
    NEWID() AS [Id],
    t.[Id]  AS [TenantId],
    NULL    AS [BranchId],
    p.[Name],
    p.[Code],
    p.[Category],
    p.[Frequency],
    p.[Description],
    1       AS [IsActive],
    p.[IsDefault],
    p.[SortOrder],
    SYSUTCDATETIME() AS [CreatedAt]
FROM [dbo].[Tenants] t
CROSS JOIN #PresetHeads p
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[FeeHeads] fh 
    WHERE fh.[TenantId] = t.[Id] AND fh.[Code] = p.[Code]
);

DECLARE @InsertedCount INT = @@ROWCOUNT;
PRINT '>> Inserted ' + CAST(@InsertedCount AS NVARCHAR(10)) + ' standard FeeHead preset records across all tenants.';

DROP TABLE #PresetHeads;

PRINT '-------------------------------------------------------------';
PRINT 'FeeHeads Database Setup Completed Successfully!';
PRINT '-------------------------------------------------------------';
GO
