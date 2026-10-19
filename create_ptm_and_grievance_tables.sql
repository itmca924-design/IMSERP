-- ============================================================================
-- Migration: PTM Scheduler & Grievance Helpdesk Tables, Menus & Permissions
-- ============================================================================

-- 1. PtmSessions Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PtmSessions')
BEGIN
    CREATE TABLE [dbo].[PtmSessions] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [Title] NVARCHAR(200) NOT NULL,
        [AcademicYear] NVARCHAR(50) NULL,
        [MeetingDate] DATETIME2 NOT NULL,
        [StartTime] NVARCHAR(20) NOT NULL,
        [EndTime] NVARCHAR(20) NOT NULL,
        [MeetingMode] NVARCHAR(50) NOT NULL DEFAULT 'In-Person',
        [VenueOrLink] NVARCHAR(500) NULL,
        [TargetClassId] UNIQUEIDENTIFIER NULL,
        [TargetClassName] NVARCHAR(200) NULL,
        [TargetSection] NVARCHAR(50) NULL,
        [OrganizerName] NVARCHAR(200) NOT NULL,
        [Agenda] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(50) NOT NULL DEFAULT 'Scheduled',
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX [IX_PtmSessions_Tenant_Date] ON [dbo].[PtmSessions]([TenantId], [MeetingDate]);
    CREATE INDEX [IX_PtmSessions_Branch] ON [dbo].[PtmSessions]([BranchId]);
    PRINT 'Created PtmSessions table.';
END
GO

-- 2. PtmBookings Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PtmBookings')
BEGIN
    CREATE TABLE [dbo].[PtmBookings] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [PtmSessionId] UNIQUEIDENTIFIER NOT NULL,
        [StudentId] UNIQUEIDENTIFIER NOT NULL,
        [StudentName] NVARCHAR(200) NOT NULL,
        [AdmissionNumber] NVARCHAR(100) NULL,
        [ClassName] NVARCHAR(100) NULL,
        [ParentName] NVARCHAR(200) NULL,
        [ParentPhone] NVARCHAR(50) NULL,
        [SlotTime] NVARCHAR(50) NULL,
        [ParentAttended] NVARCHAR(50) NOT NULL DEFAULT 'Pending',
        [TeacherName] NVARCHAR(200) NULL,
        [TeacherFeedback] NVARCHAR(MAX) NULL,
        [ParentFeedback] NVARCHAR(MAX) NULL,
        [ActionPoints] NVARCHAR(MAX) NULL,
        [FollowUpRequired] BIT NOT NULL DEFAULT 0,
        [FollowUpDate] DATETIME2 NULL,
        [AttendedAt] DATETIME2 NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [FK_PtmBookings_PtmSessions] FOREIGN KEY ([PtmSessionId]) REFERENCES [dbo].[PtmSessions]([Id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_PtmBookings_Session_Student] ON [dbo].[PtmBookings]([PtmSessionId], [StudentId]);
    CREATE INDEX [IX_PtmBookings_Tenant] ON [dbo].[PtmBookings]([TenantId]);
    CREATE INDEX [IX_PtmBookings_Branch] ON [dbo].[PtmBookings]([BranchId]);
    PRINT 'Created PtmBookings table.';
END
GO

-- 3. GrievanceTickets Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'GrievanceTickets')
BEGIN
    CREATE TABLE [dbo].[GrievanceTickets] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [TicketNumber] NVARCHAR(50) NOT NULL,
        [StudentId] UNIQUEIDENTIFIER NULL,
        [StudentName] NVARCHAR(200) NULL,
        [AdmissionNumber] NVARCHAR(100) NULL,
        [ClassName] NVARCHAR(100) NULL,
        [RaisedByName] NVARCHAR(200) NOT NULL,
        [RaisedByRole] NVARCHAR(50) NOT NULL DEFAULT 'Parent',
        [ContactPhone] NVARCHAR(50) NOT NULL,
        [ContactEmail] NVARCHAR(150) NULL,
        [Category] NVARCHAR(100) NOT NULL,
        [Priority] NVARCHAR(50) NOT NULL DEFAULT 'Medium',
        [Subject] NVARCHAR(300) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [Status] NVARCHAR(50) NOT NULL DEFAULT 'Open',
        [AssignedToUserId] UNIQUEIDENTIFIER NULL,
        [AssignedToName] NVARCHAR(200) NULL,
        [ResolutionSummary] NVARCHAR(MAX) NULL,
        [ResolvedAt] DATETIME2 NULL,
        [ResolvedByName] NVARCHAR(200) NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX [IX_GrievanceTickets_Tenant_Status] ON [dbo].[GrievanceTickets]([TenantId], [Status]);
    CREATE INDEX [IX_GrievanceTickets_Branch] ON [dbo].[GrievanceTickets]([BranchId]);
    CREATE INDEX [IX_GrievanceTickets_Student] ON [dbo].[GrievanceTickets]([StudentId]);
    PRINT 'Created GrievanceTickets table.';
END
GO

-- 4. GrievanceComments Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'GrievanceComments')
BEGIN
    CREATE TABLE [dbo].[GrievanceComments] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [TicketId] UNIQUEIDENTIFIER NOT NULL,
        [AuthorName] NVARCHAR(200) NOT NULL,
        [AuthorRole] NVARCHAR(50) NOT NULL DEFAULT 'Staff',
        [Comment] NVARCHAR(MAX) NOT NULL,
        [IsInternal] BIT NOT NULL DEFAULT 0,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [FK_GrievanceComments_GrievanceTickets] FOREIGN KEY ([TicketId]) REFERENCES [dbo].[GrievanceTickets]([Id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_GrievanceComments_Ticket] ON [dbo].[GrievanceComments]([TicketId]);
    PRINT 'Created GrievanceComments table.';
END
GO

-- 5. Seed Front Desk Menu Items & Role Permissions for PTM and Grievances
DECLARE @FrontDeskParentId UNIQUEIDENTIFIER;
SELECT TOP 1 @FrontDeskParentId = [Id] FROM [dbo].[MenuItems] WHERE [Title] = 'Front Desk' AND [ParentId] IS NULL;

IF @FrontDeskParentId IS NOT NULL
BEGIN
    -- A. PTM Scheduler Menu
    IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [RouteUrl] = '/front-desk/ptm')
    BEGIN
        DECLARE @PtmMenuId UNIQUEIDENTIFIER = NEWID();
        INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
        VALUES (@PtmMenuId, 'PTM Scheduler', '/front-desk/ptm', 'calendar_month', @FrontDeskParentId, 4, 'FrontDesk', 1);

        INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
        SELECT NEWID(), r.[Id], @PtmMenuId, 1, 1, 1, 1
        FROM [dbo].[Roles] r;

        PRINT 'Inserted PTM Scheduler menu item & granted permissions.';
    END

    -- B. Grievance Helpdesk Menu
    IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [RouteUrl] = '/front-desk/grievances')
    BEGIN
        DECLARE @GrievanceMenuId UNIQUEIDENTIFIER = NEWID();
        INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
        VALUES (@GrievanceMenuId, 'Grievance Helpdesk', '/front-desk/grievances', 'support_agent', @FrontDeskParentId, 5, 'FrontDesk', 1);

        INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
        SELECT NEWID(), r.[Id], @GrievanceMenuId, 1, 1, 1, 1
        FROM [dbo].[Roles] r;

        PRINT 'Inserted Grievance Helpdesk menu item & granted permissions.';
    END
END
GO
