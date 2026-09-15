-- ============================================================================
-- SQL Script: Add Multi-Branch & Classrooms (Rooms) Support with Zero Downtime
-- Target Database: IMSERP
-- ============================================================================

USE [IMSERP];
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 1. Create Branches Table
IF OBJECT_ID(N'[dbo].[Branches]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Branches] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_Branches] PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [Name] NVARCHAR(150) NOT NULL,
        [Code] NVARCHAR(50) NOT NULL,
        [Address] NVARCHAR(300) NULL,
        [ContactPhone] NVARCHAR(50) NULL,
        [IsMainBranch] BIT NOT NULL CONSTRAINT [DF_Branches_IsMainBranch] DEFAULT (0),
        [IsActive] BIT NOT NULL CONSTRAINT [DF_Branches_IsActive] DEFAULT (1),
        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Branches_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_Branches_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX [UX_Branches_Tenant_Code] ON [dbo].[Branches] ([TenantId], [Code]);
    PRINT 'Branches table created successfully.';
END
GO

-- 2. Create Rooms (Classrooms) Table
IF OBJECT_ID(N'[dbo].[Rooms]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Rooms] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_Rooms] PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NOT NULL,
        [RoomNumber] NVARCHAR(50) NOT NULL,
        [Capacity] INT NOT NULL CONSTRAINT [DF_Rooms_Capacity] DEFAULT (40),
        [Floor] NVARCHAR(50) NULL,
        [IsActive] BIT NOT NULL CONSTRAINT [DF_Rooms_IsActive] DEFAULT (1),
        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Rooms_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_Rooms_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_Rooms_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_Rooms_Tenant_Branch] ON [dbo].[Rooms] ([TenantId], [BranchId]);
    PRINT 'Rooms table created successfully.';
END
GO

-- 3. Auto-Seed Default "Main Branch" & Default "Room" for every existing Tenant
DECLARE @TenantCursor CURSOR;
DECLARE @CurrTenantId UNIQUEIDENTIFIER;
DECLARE @CurrTenantName NVARCHAR(200);
DECLARE @CurrTenantCode NVARCHAR(50);
DECLARE @NewBranchId UNIQUEIDENTIFIER;
DECLARE @NewRoomId UNIQUEIDENTIFIER;

SET @TenantCursor = CURSOR FOR 
    SELECT [Id], [Name], [Code] FROM [dbo].[Tenants];

OPEN @TenantCursor;
FETCH NEXT FROM @TenantCursor INTO @CurrTenantId, @CurrTenantName, @CurrTenantCode;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- Check if this tenant already has a main branch
    SELECT TOP 1 @NewBranchId = [Id] 
    FROM [dbo].[Branches] 
    WHERE [TenantId] = @CurrTenantId AND [IsMainBranch] = 1;

    IF @NewBranchId IS NULL
    BEGIN
        SET @NewBranchId = NEWID();
        INSERT INTO [dbo].[Branches] ([Id], [TenantId], [Name], [Code], [Address], [ContactPhone], [IsMainBranch], [IsActive])
        VALUES (
            @NewBranchId,
            @CurrTenantId,
            @CurrTenantName + N' - Main Branch',
            N'MAIN',
            N'Head Office Campus',
            NULL,
            1,
            1
        );
        PRINT 'Created default Main Branch for Tenant: ' + @CurrTenantCode;
    END

    -- Check if this branch has a default room
    SELECT TOP 1 @NewRoomId = [Id]
    FROM [dbo].[Rooms]
    WHERE [TenantId] = @CurrTenantId AND [BranchId] = @NewBranchId;

    IF @NewRoomId IS NULL
    BEGIN
        SET @NewRoomId = NEWID();
        INSERT INTO [dbo].[Rooms] ([Id], [TenantId], [BranchId], [RoomNumber], [Capacity], [Floor], [IsActive])
        VALUES (
            @NewRoomId,
            @CurrTenantId,
            @NewBranchId,
            N'Room 101',
            50,
            N'Ground Floor',
            1
        );
        PRINT 'Created default Classroom (Room 101) for Main Branch.';
    END

    FETCH NEXT FROM @TenantCursor INTO @CurrTenantId, @CurrTenantName, @CurrTenantCode;
END

CLOSE @TenantCursor;
DEALLOCATE @TenantCursor;
GO

-- 4. Add BranchId and RoomId columns to Batches
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Batches]') AND name = N'BranchId')
BEGIN
    ALTER TABLE [dbo].[Batches] ADD [BranchId] UNIQUEIDENTIFIER NULL;
    ALTER TABLE [dbo].[Batches] ADD CONSTRAINT [FK_Batches_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]);
    PRINT 'BranchId added to Batches.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Batches]') AND name = N'RoomId')
BEGIN
    ALTER TABLE [dbo].[Batches] ADD [RoomId] UNIQUEIDENTIFIER NULL;
    ALTER TABLE [dbo].[Batches] ADD CONSTRAINT [FK_Batches_Rooms] FOREIGN KEY ([RoomId]) REFERENCES [dbo].[Rooms]([Id]);
    PRINT 'RoomId added to Batches.';
END
GO

-- 5. Add BranchId to other operational tables
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Students]') AND name = N'BranchId')
BEGIN
    ALTER TABLE [dbo].[Students] ADD [BranchId] UNIQUEIDENTIFIER NULL;
    ALTER TABLE [dbo].[Students] ADD CONSTRAINT [FK_Students_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]);
    PRINT 'BranchId added to Students.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Teachers]') AND name = N'BranchId')
BEGIN
    ALTER TABLE [dbo].[Teachers] ADD [BranchId] UNIQUEIDENTIFIER NULL;
    ALTER TABLE [dbo].[Teachers] ADD CONSTRAINT [FK_Teachers_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]);
    PRINT 'BranchId added to Teachers.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = N'BranchId')
BEGIN
    ALTER TABLE [dbo].[Users] ADD [BranchId] UNIQUEIDENTIFIER NULL;
    ALTER TABLE [dbo].[Users] ADD CONSTRAINT [FK_Users_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]);
    PRINT 'BranchId added to Users.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[BiometricDevices]') AND name = N'BranchId')
BEGIN
    ALTER TABLE [dbo].[BiometricDevices] ADD [BranchId] UNIQUEIDENTIFIER NULL;
    ALTER TABLE [dbo].[BiometricDevices] ADD CONSTRAINT [FK_BiometricDevices_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]);
    PRINT 'BranchId added to BiometricDevices.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[AttendanceSettings]') AND name = N'BranchId')
BEGIN
    ALTER TABLE [dbo].[AttendanceSettings] ADD [BranchId] UNIQUEIDENTIFIER NULL;
    ALTER TABLE [dbo].[AttendanceSettings] ADD CONSTRAINT [FK_AttendanceSettings_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]);
    PRINT 'BranchId added to AttendanceSettings.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FeeInvoices]') AND name = N'BranchId')
BEGIN
    ALTER TABLE [dbo].[FeeInvoices] ADD [BranchId] UNIQUEIDENTIFIER NULL;
    ALTER TABLE [dbo].[FeeInvoices] ADD CONSTRAINT [FK_FeeInvoices_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]);
    PRINT 'BranchId added to FeeInvoices.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FeePayments]') AND name = N'BranchId')
BEGIN
    ALTER TABLE [dbo].[FeePayments] ADD [BranchId] UNIQUEIDENTIFIER NULL;
    ALTER TABLE [dbo].[FeePayments] ADD CONSTRAINT [FK_FeePayments_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]);
    PRINT 'BranchId added to FeePayments.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[StudentAttendances]') AND name = N'BranchId')
BEGIN
    ALTER TABLE [dbo].[StudentAttendances] ADD [BranchId] UNIQUEIDENTIFIER NULL;
    ALTER TABLE [dbo].[StudentAttendances] ADD CONSTRAINT [FK_StudentAttendances_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]);
    PRINT 'BranchId added to StudentAttendances.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TeacherAttendances]') AND name = N'BranchId')
BEGIN
    ALTER TABLE [dbo].[TeacherAttendances] ADD [BranchId] UNIQUEIDENTIFIER NULL;
    ALTER TABLE [dbo].[TeacherAttendances] ADD CONSTRAINT [FK_TeacherAttendances_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]);
    PRINT 'BranchId added to TeacherAttendances.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Tests]') AND name = N'BranchId')
BEGIN
    ALTER TABLE [dbo].[Tests] ADD [BranchId] UNIQUEIDENTIFIER NULL;
    ALTER TABLE [dbo].[Tests] ADD CONSTRAINT [FK_Tests_Branches] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id]);
    PRINT 'BranchId added to Tests.';
END
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 6. Backfill existing records with their Tenant's Main Branch and Room
UPDATE b
SET b.[BranchId] = mb.[Id]
FROM [dbo].[Batches] b
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] WHERE [TenantId] = b.[TenantId] AND [IsMainBranch] = 1
) mb
WHERE b.[BranchId] IS NULL;

UPDATE b
SET b.[RoomId] = mr.[Id]
FROM [dbo].[Batches] b
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Rooms] WHERE [TenantId] = b.[TenantId] AND [BranchId] = b.[BranchId]
) mr
WHERE b.[RoomId] IS NULL;

UPDATE s
SET s.[BranchId] = mb.[Id]
FROM [dbo].[Students] s
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] WHERE [TenantId] = s.[TenantId] AND [IsMainBranch] = 1
) mb
WHERE s.[BranchId] IS NULL;

UPDATE t
SET t.[BranchId] = mb.[Id]
FROM [dbo].[Teachers] t
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] WHERE [TenantId] = t.[TenantId] AND [IsMainBranch] = 1
) mb
WHERE t.[BranchId] IS NULL;

UPDATE u
SET u.[BranchId] = mb.[Id]
FROM [dbo].[Users] u
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] WHERE [TenantId] = u.[TenantId] AND [IsMainBranch] = 1
) mb
WHERE u.[BranchId] IS NULL;

UPDATE d
SET d.[BranchId] = mb.[Id]
FROM [dbo].[BiometricDevices] d
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] WHERE [TenantId] = d.[TenantId] AND [IsMainBranch] = 1
) mb
WHERE d.[BranchId] IS NULL;

UPDATE a
SET a.[BranchId] = mb.[Id]
FROM [dbo].[AttendanceSettings] a
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] WHERE [TenantId] = a.[TenantId] AND [IsMainBranch] = 1
) mb
WHERE a.[BranchId] IS NULL;

UPDATE fi
SET fi.[BranchId] = mb.[Id]
FROM [dbo].[FeeInvoices] fi
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] WHERE [TenantId] = fi.[TenantId] AND [IsMainBranch] = 1
) mb
WHERE fi.[BranchId] IS NULL;

UPDATE fp
SET fp.[BranchId] = mb.[Id]
FROM [dbo].[FeePayments] fp
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] WHERE [TenantId] = fp.[TenantId] AND [IsMainBranch] = 1
) mb
WHERE fp.[BranchId] IS NULL;

UPDATE sa
SET sa.[BranchId] = mb.[Id]
FROM [dbo].[StudentAttendances] sa
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] WHERE [TenantId] = sa.[TenantId] AND [IsMainBranch] = 1
) mb
WHERE sa.[BranchId] IS NULL;

UPDATE ta
SET ta.[BranchId] = mb.[Id]
FROM [dbo].[TeacherAttendances] ta
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] WHERE [TenantId] = ta.[TenantId] AND [IsMainBranch] = 1
) mb
WHERE ta.[BranchId] IS NULL;

UPDATE tst
SET tst.[BranchId] = mb.[Id]
FROM [dbo].[Tests] tst
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] WHERE [TenantId] = tst.[TenantId] AND [IsMainBranch] = 1
) mb
WHERE tst.[BranchId] IS NULL;
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 7. High-Performance Composite Indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Batches_Tenant_Branch' AND object_id = OBJECT_ID(N'[dbo].[Batches]'))
    CREATE INDEX [IX_Batches_Tenant_Branch] ON [dbo].[Batches] ([TenantId], [BranchId]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Students_Tenant_Branch' AND object_id = OBJECT_ID(N'[dbo].[Students]'))
    CREATE INDEX [IX_Students_Tenant_Branch] ON [dbo].[Students] ([TenantId], [BranchId]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_FeeInvoices_Tenant_Branch' AND object_id = OBJECT_ID(N'[dbo].[FeeInvoices]'))
    CREATE INDEX [IX_FeeInvoices_Tenant_Branch] ON [dbo].[FeeInvoices] ([TenantId], [BranchId]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_StudentAttendances_Tenant_Branch_Date' AND object_id = OBJECT_ID(N'[dbo].[StudentAttendances]'))
    CREATE INDEX [IX_StudentAttendances_Tenant_Branch_Date] ON [dbo].[StudentAttendances] ([TenantId], [BranchId], [AttendanceDate]);
GO

-- 8. Add Classrooms / Rooms Menu Item under Master Management
DECLARE @RoomsMenuId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000027';
DECLARE @MasterParentId UNIQUEIDENTIFIER = NULL;

SELECT TOP 1 @MasterParentId = [Id]
FROM [dbo].[MenuItems]
WHERE [Title] = 'Master Management' AND [ParentId] IS NULL;

IF @MasterParentId IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = @RoomsMenuId OR [RouteUrl] = '/rooms')
    BEGIN
        INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
        VALUES (@RoomsMenuId, N'Classrooms Master', N'/rooms', N'meeting_room', @MasterParentId, 5, N'Master', 1);
        PRINT 'Classrooms Master menu inserted.';
    END
    ELSE
    BEGIN
        UPDATE [dbo].[MenuItems]
        SET [Title] = N'Classrooms Master',
            [RouteUrl] = N'/rooms',
            [Icon] = N'meeting_room',
            [ParentId] = @MasterParentId,
            [SortOrder] = 5,
            [Module] = N'Master',
            [IsActive] = 1
        WHERE [Id] = @RoomsMenuId OR [RouteUrl] = '/rooms';
    END

    -- Grant permissions to Admin roles
    INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
    SELECT NEWID(), r.[Id], @RoomsMenuId, 1, 1, 1, 1
    FROM [dbo].[Roles] r
    WHERE (r.[Name] LIKE '%Admin%' OR r.[Id] = '22222222-1111-1111-1111-111111111111')
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[RolePermissions] rp WHERE rp.[RoleId] = r.[Id] AND rp.[MenuItemId] = @RoomsMenuId
      );
END
GO

PRINT 'Multi-Branch & Classrooms (Rooms) migration completed successfully.';
GO
