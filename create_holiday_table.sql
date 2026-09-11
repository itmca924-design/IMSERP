-- =========================================================
-- IMSERP: Create Holidays Table and Seed 2026 Academic Calendar
-- =========================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Holidays' AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[Holidays] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [Title] NVARCHAR(150) NOT NULL,
        [StartDate] DATETIME2(7) NOT NULL,
        [EndDate] DATETIME2(7) NOT NULL,
        [HolidayType] NVARCHAR(50) NOT NULL DEFAULT 'Festival', -- National, Festival, Academic, Institutional
        [Description] NVARCHAR(500) NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME2(7) NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE INDEX [IX_Holidays_TenantId_StartDate] ON [dbo].[Holidays] ([TenantId], [StartDate]);
    PRINT 'Table [dbo].[Holidays] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[Holidays] already exists.';
END
GO

-- Seed 2026 Common Academic & Festival Holidays for Tenant
DECLARE @tenantId UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';

IF NOT EXISTS (SELECT 1 FROM [dbo].[Holidays] WHERE [TenantId] = @tenantId)
BEGIN
    INSERT INTO [dbo].[Holidays] ([Id], [TenantId], [Title], [StartDate], [EndDate], [HolidayType], [Description], [IsActive], [CreatedAt])
    VALUES
    (NEWID(), @tenantId, 'Republic Day', '2026-01-26', '2026-01-26', 'National', 'National Holiday - Republic Day', 1, GETUTCDATE()),
    (NEWID(), @tenantId, 'Holi Celebration', '2026-03-04', '2026-03-05', 'Festival', 'Holi Festival Holidays', 1, GETUTCDATE()),
    (NEWID(), @tenantId, 'Independence Day', '2026-08-15', '2026-08-15', 'National', 'Independence Day Celebration', 1, GETUTCDATE()),
    (NEWID(), @tenantId, 'Janmashtami', '2026-09-04', '2026-09-04', 'Festival', 'Shri Krishna Janmashtami', 1, GETUTCDATE()),
    (NEWID(), @tenantId, 'Gandhi Jayanti', '2026-10-02', '2026-10-02', 'National', 'Mahatma Gandhi Jayanti', 1, GETUTCDATE()),
    (NEWID(), @tenantId, 'Dussehra / Vijayadashami', '2026-10-20', '2026-10-20', 'Festival', 'Dussehra Holidays', 1, GETUTCDATE()),
    (NEWID(), @tenantId, 'Diwali Vacation', '2026-11-08', '2026-11-11', 'Festival', 'Deepawali Festive Break', 1, GETUTCDATE()),
    (NEWID(), @tenantId, 'Christmas', '2026-12-25', '2026-12-25', 'Festival', 'Christmas Day', 1, GETUTCDATE());

    PRINT 'Default 2026 Academic Holidays seeded successfully.';
END
GO
