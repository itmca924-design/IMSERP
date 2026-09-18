-- ============================================================================
-- IMSERP: Hostel Management System Architecture Migration
-- Safe & Non-Breaking: Retains all existing Coaching, School & Day Scholar data
-- Student Hostel status is 100% OPTIONAL (Default: Day Scholar)
-- Database: IMSERP
-- ============================================================================

USE [IMSERP];
GO

-- 1. Alter Students Table to add Optional Hostel Flags
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'IsHostelStudent')
BEGIN
    ALTER TABLE Students ADD IsHostelStudent BIT NOT NULL DEFAULT 0;
    PRINT 'Added IsHostelStudent column to Students table';
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'HostelBedId')
BEGIN
    ALTER TABLE Students ADD HostelBedId UNIQUEIDENTIFIER NULL;
    PRINT 'Added HostelBedId column to Students table';
END;
GO

-- 2. Create Hostels Master Table (Blocks/Buildings)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Hostels')
BEGIN
    CREATE TABLE Hostels (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        Name NVARCHAR(200) NOT NULL,
        HostelType NVARCHAR(50) NOT NULL DEFAULT 'Boys', -- Boys, Girls, Co-ed, Staff
        Address NVARCHAR(300) NULL,
        WardenName NVARCHAR(150) NULL,
        WardenPhone NVARCHAR(50) NULL,
        TotalFloors INT NOT NULL DEFAULT 1,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Hostels_Branches FOREIGN KEY (BranchId) REFERENCES Branches(Id) ON DELETE SET NULL
    );
    CREATE INDEX IX_Hostels_Tenant_Branch ON Hostels(TenantId, BranchId);
    PRINT 'Created table Hostels';
END;
GO

-- 3. Create HostelRooms Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HostelRooms')
BEGIN
    CREATE TABLE HostelRooms (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        HostelId UNIQUEIDENTIFIER NOT NULL,
        RoomNumber NVARCHAR(50) NOT NULL,
        Floor NVARCHAR(50) NOT NULL DEFAULT 'Ground',
        RoomType NVARCHAR(50) NOT NULL DEFAULT 'Double', -- Single, Double, Triple, 4-Bed, Dormitory
        Capacity INT NOT NULL DEFAULT 2,
        MonthlyRent DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        HasAC BIT NOT NULL DEFAULT 0,
        HasAttachedBath BIT NOT NULL DEFAULT 0,
        Amenities NVARCHAR(300) NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'Active', -- Active, UnderMaintenance
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_HostelRooms_Hostels FOREIGN KEY (HostelId) REFERENCES Hostels(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_HostelRooms_Hostel ON HostelRooms(HostelId);
    PRINT 'Created table HostelRooms';
END;
GO

-- 4. Create HostelBeds Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HostelBeds')
BEGIN
    CREATE TABLE HostelBeds (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        RoomId UNIQUEIDENTIFIER NOT NULL,
        BedCode NVARCHAR(50) NOT NULL, -- e.g. '101-A', '101-B'
        Status NVARCHAR(50) NOT NULL DEFAULT 'Available', -- Available, Occupied, Maintenance, Reserved
        MonthlyRent DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        CurrentStudentId UNIQUEIDENTIFIER NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_HostelBeds_Rooms FOREIGN KEY (RoomId) REFERENCES HostelRooms(Id) ON DELETE CASCADE,
        CONSTRAINT FK_HostelBeds_Student FOREIGN KEY (CurrentStudentId) REFERENCES Students(Id) ON DELETE SET NULL
    );
    CREATE INDEX IX_HostelBeds_Room ON HostelBeds(RoomId);
    CREATE INDEX IX_HostelBeds_CurrentStudent ON HostelBeds(CurrentStudentId);
    PRINT 'Created table HostelBeds';
END;
GO

-- 5. Create HostelAllocations Table (History of Allotment & Vacating)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HostelAllocations')
BEGIN
    CREATE TABLE HostelAllocations (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        StudentId UNIQUEIDENTIFIER NOT NULL,
        BedId UNIQUEIDENTIFIER NOT NULL,
        AllocatedDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        VacatedDate DATETIME2 NULL,
        MonthlyRent DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        IsMessIncluded BIT NOT NULL DEFAULT 1,
        MessPlan NVARCHAR(100) NULL DEFAULT 'Full Board', -- Full Board, Lunch & Dinner, Breakfast Only
        MonthlyMessFee DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        Status NVARCHAR(50) NOT NULL DEFAULT 'Active', -- Active, Vacated, Transferred
        Remarks NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_HostelAllocations_Students FOREIGN KEY (StudentId) REFERENCES Students(Id) ON DELETE CASCADE,
        CONSTRAINT FK_HostelAllocations_Beds FOREIGN KEY (BedId) REFERENCES HostelBeds(Id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_HostelAllocations_Student ON HostelAllocations(StudentId);
    CREATE INDEX IX_HostelAllocations_Bed ON HostelAllocations(BedId);
    PRINT 'Created table HostelAllocations';
END;
GO

-- 6. Create HostelGatePasses Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HostelGatePasses')
BEGIN
    CREATE TABLE HostelGatePasses (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        StudentId UNIQUEIDENTIFIER NOT NULL,
        PassNumber NVARCHAR(50) NOT NULL,
        OutDate DATETIME2 NOT NULL,
        ExpectedReturnDate DATETIME2 NOT NULL,
        ActualReturnDate DATETIME2 NULL,
        Purpose NVARCHAR(250) NOT NULL,
        ParentConsentGiven BIT NOT NULL DEFAULT 1,
        ParentContactNumber NVARCHAR(50) NULL,
        WardenApprovalStatus NVARCHAR(50) NOT NULL DEFAULT 'Approved', -- Pending, Approved, Rejected, Completed, Overdue
        ApprovedByWarden NVARCHAR(150) NULL,
        Remarks NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_HostelGatePasses_Students FOREIGN KEY (StudentId) REFERENCES Students(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_HostelGatePasses_Student ON HostelGatePasses(StudentId);
    PRINT 'Created table HostelGatePasses';
END;
GO

-- 7. Create HostelAttendances Table (Night Roll Call)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HostelAttendances')
BEGIN
    CREATE TABLE HostelAttendances (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        StudentId UNIQUEIDENTIFIER NOT NULL,
        HostelId UNIQUEIDENTIFIER NOT NULL,
        AttendanceDate DATE NOT NULL,
        RollCallShift NVARCHAR(50) NOT NULL DEFAULT 'Night',
        Status NVARCHAR(50) NOT NULL DEFAULT 'Present', -- Present, Absent, OnLeave, Late, GatePass
        CaptureSource NVARCHAR(50) NOT NULL DEFAULT 'Manual', -- Manual, Biometric
        BiometricDeviceId NVARCHAR(100) NULL,
        BiometricEventId NVARCHAR(100) NULL,
        CapturedAt DATETIME2 NULL,
        PunchTime NVARCHAR(10) NULL,
        MarkedBy NVARCHAR(150) NULL,
        Remarks NVARCHAR(250) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_HostelAttendances_Students FOREIGN KEY (StudentId) REFERENCES Students(Id) ON DELETE CASCADE,
        CONSTRAINT FK_HostelAttendances_Hostels FOREIGN KEY (HostelId) REFERENCES Hostels(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_HostelAttendances_Date_Hostel ON HostelAttendances(AttendanceDate, HostelId);
    PRINT 'Created table HostelAttendances';
END;
GO

-- 7b. Update AttendanceSettings with HostelMode (Manual, Biometric, Both)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'AttendanceSettings' AND COLUMN_NAME = 'HostelMode')
BEGIN
    ALTER TABLE AttendanceSettings ADD HostelMode NVARCHAR(20) NOT NULL CONSTRAINT DF_AttendanceSettings_HostelMode DEFAULT 'Both';
    PRINT 'Added HostelMode to AttendanceSettings';
END;
GO

-- 8. Add Menu Item: Hostel Management in Academic Operations or Top-Level
DECLARE @HostelMenuId UNIQUEIDENTIFIER = '50000000-0000-0000-0000-000000000058';
DECLARE @AcademicParentId UNIQUEIDENTIFIER = NULL;

SELECT TOP 1 @AcademicParentId = [Id]
FROM [dbo].[MenuItems]
WHERE [Title] LIKE '%Academic%' AND [ParentId] IS NULL;

IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [RouteUrl] = '/hostel')
BEGIN
    INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
    VALUES (
        @HostelMenuId,
        N'Hostel Management',
        N'/hostel',
        N'apartment',
        @AcademicParentId,
        7,
        N'Academic',
        1
    );
    PRINT 'Inserted Hostel Management menu item';
END;
GO

-- 9. Grant Role Permissions for Hostel Menu
DECLARE @HostelTargetId UNIQUEIDENTIFIER;
SELECT TOP 1 @HostelTargetId = [Id] FROM [dbo].[MenuItems] WHERE [RouteUrl] = '/hostel';

IF @HostelTargetId IS NOT NULL
BEGIN
    INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
    SELECT 
        NEWID(),
        r.[Id],
        @HostelTargetId,
        1, 1, 1, 1
    FROM [dbo].[RoleEntities] r
    WHERE NOT EXISTS (
        SELECT 1 FROM [dbo].[RolePermissions] rp 
        WHERE rp.[RoleId] = r.[Id] AND rp.[MenuItemId] = @HostelTargetId
    );
    PRINT 'Granted Hostel permissions to active roles';
END;
GO

-- 10. Seed Initial Demo Hostel Data (If no hostels exist)
IF NOT EXISTS (SELECT 1 FROM Hostels)
BEGIN
    DECLARE @TenantId UNIQUEIDENTIFIER = (SELECT TOP 1 Id FROM Tenants);
    DECLARE @BranchId UNIQUEIDENTIFIER = (SELECT TOP 1 Id FROM Branches WHERE TenantId = @TenantId);

    IF @TenantId IS NOT NULL
    BEGIN
        DECLARE @HostelA_Id UNIQUEIDENTIFIER = NEWID();
        DECLARE @HostelB_Id UNIQUEIDENTIFIER = NEWID();

        -- Boys Hostel Block
        INSERT INTO Hostels (Id, TenantId, BranchId, Name, HostelType, Address, WardenName, WardenPhone, TotalFloors, IsActive)
        VALUES (@HostelA_Id, @TenantId, @BranchId, N'Ramanujan Boys Hostel (Block A)', 'Boys', N'Campus North Wing', N'Rajesh Sharma', N'9876543210', 3, 1);

        -- Girls Hostel Block
        INSERT INTO Hostels (Id, TenantId, BranchId, Name, HostelType, Address, WardenName, WardenPhone, TotalFloors, IsActive)
        VALUES (@HostelB_Id, @TenantId, @BranchId, N'Kalpana Chawla Girls Hostel (Block B)', 'Girls', N'Campus South Wing', N'Sunita Verma', N'9876543211', 2, 1);

        -- Room 101 in Hostel A (Double Sharing AC)
        DECLARE @Room101_Id UNIQUEIDENTIFIER = NEWID();
        INSERT INTO HostelRooms (Id, TenantId, BranchId, HostelId, RoomNumber, Floor, RoomType, Capacity, MonthlyRent, HasAC, HasAttachedBath, Amenities, Status, IsActive)
        VALUES (@Room101_Id, @TenantId, @BranchId, @HostelA_Id, N'101', N'1st Floor', N'Double', 2, 8500.00, 1, 1, N'Air Conditioner, Attached Bath, Study Table, Wardrobe', 'Active', 1);

        -- Beds for Room 101
        INSERT INTO HostelBeds (Id, TenantId, BranchId, RoomId, BedCode, Status, MonthlyRent, IsActive)
        VALUES (NEWID(), @TenantId, @BranchId, @Room101_Id, N'101-A', 'Available', 8500.00, 1);
        INSERT INTO HostelBeds (Id, TenantId, BranchId, RoomId, BedCode, Status, MonthlyRent, IsActive)
        VALUES (NEWID(), @TenantId, @BranchId, @Room101_Id, N'101-B', 'Available', 8500.00, 1);

        -- Room 102 in Hostel A (Triple Sharing Non-AC)
        DECLARE @Room102_Id UNIQUEIDENTIFIER = NEWID();
        INSERT INTO HostelRooms (Id, TenantId, BranchId, HostelId, RoomNumber, Floor, RoomType, Capacity, MonthlyRent, HasAC, HasAttachedBath, Amenities, Status, IsActive)
        VALUES (@Room102_Id, @TenantId, @BranchId, @HostelA_Id, N'102', N'1st Floor', N'Triple', 3, 5500.00, 0, 1, N'Ceiling Fan, Attached Bath, Study Table, Balcony', 'Active', 1);

        -- Beds for Room 102
        INSERT INTO HostelBeds (Id, TenantId, BranchId, RoomId, BedCode, Status, MonthlyRent, IsActive)
        VALUES (NEWID(), @TenantId, @BranchId, @Room102_Id, N'102-A', 'Available', 5500.00, 1);
        INSERT INTO HostelBeds (Id, TenantId, BranchId, RoomId, BedCode, Status, MonthlyRent, IsActive)
        VALUES (NEWID(), @TenantId, @BranchId, @Room102_Id, N'102-B', 'Available', 5500.00, 1);
        INSERT INTO HostelBeds (Id, TenantId, BranchId, RoomId, BedCode, Status, MonthlyRent, IsActive)
        VALUES (NEWID(), @TenantId, @BranchId, @Room102_Id, N'102-C', 'Available', 5500.00, 1);

        -- Room 201 in Hostel B (Girls Double Sharing AC)
        DECLARE @Room201_Id UNIQUEIDENTIFIER = NEWID();
        INSERT INTO HostelRooms (Id, TenantId, BranchId, HostelId, RoomNumber, Floor, RoomType, Capacity, MonthlyRent, HasAC, HasAttachedBath, Amenities, Status, IsActive)
        VALUES (@Room201_Id, @TenantId, @BranchId, @HostelB_Id, N'201', N'2nd Floor', N'Double', 2, 8500.00, 1, 1, N'Air Conditioner, Attached Bath, Study Table, Wardrobe', 'Active', 1);

        INSERT INTO HostelBeds (Id, TenantId, BranchId, RoomId, BedCode, Status, MonthlyRent, IsActive)
        VALUES (NEWID(), @TenantId, @BranchId, @Room201_Id, N'201-A', 'Available', 8500.00, 1);
        INSERT INTO HostelBeds (Id, TenantId, BranchId, RoomId, BedCode, Status, MonthlyRent, IsActive)
        VALUES (NEWID(), @TenantId, @BranchId, @Room201_Id, N'201-B', 'Available', 8500.00, 1);

        PRINT 'Seeded initial demo Hostels, Rooms, and Beds';
    END;
END;
GO

PRINT '============================================================================';
PRINT 'IMSERP Hostel Module Migration Completed Successfully!';
PRINT '============================================================================';
