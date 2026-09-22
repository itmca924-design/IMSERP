-- ============================================================================
-- IMSERP: Transport & Fleet Management System Architecture Migration
-- Safe & Non-Breaking: Retains all existing Coaching, School & Day Scholar data
-- Student & Teacher Transport status is 100% OPTIONAL (Default: Day Scholar / No Transport)
-- Database: IMSERP
-- ============================================================================

USE [IMSERP];
GO

-- 1. Alter Students Table to add Transport Flags
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'IsTransportStudent')
BEGIN
    ALTER TABLE Students ADD IsTransportStudent BIT NOT NULL DEFAULT 0;
    PRINT 'Added IsTransportStudent column to Students table';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'TransportAllocationId')
BEGIN
    ALTER TABLE Students ADD TransportAllocationId UNIQUEIDENTIFIER NULL;
    PRINT 'Added TransportAllocationId column to Students table';
END;
GO

-- 2. Alter Teachers Table to add Transport & Hostel Staff Quarters Flags
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Teachers') AND name = 'IsTransportStaff')
BEGIN
    ALTER TABLE Teachers ADD IsTransportStaff BIT NOT NULL DEFAULT 0;
    PRINT 'Added IsTransportStaff column to Teachers table';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Teachers') AND name = 'IsHostelResident')
BEGIN
    ALTER TABLE Teachers ADD IsHostelResident BIT NOT NULL DEFAULT 0;
    PRINT 'Added IsHostelResident column to Teachers table';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Teachers') AND name = 'HostelBedId')
BEGIN
    ALTER TABLE Teachers ADD HostelBedId UNIQUEIDENTIFIER NULL;
    PRINT 'Added HostelBedId column to Teachers table';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Teachers') AND name = 'TransportAllocationId')
BEGIN
    ALTER TABLE Teachers ADD TransportAllocationId UNIQUEIDENTIFIER NULL;
    PRINT 'Added TransportAllocationId column to Teachers table';
END;
GO

-- 3. Alter HostelAllocations Table to support Teacher / Faculty staff quarters
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('HostelAllocations') AND name = 'MemberType')
BEGIN
    ALTER TABLE HostelAllocations ADD MemberType NVARCHAR(50) NOT NULL DEFAULT 'Student';
    PRINT 'Added MemberType column to HostelAllocations table';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('HostelAllocations') AND name = 'TeacherId')
BEGIN
    ALTER TABLE HostelAllocations ADD TeacherId UNIQUEIDENTIFIER NULL;
    PRINT 'Added TeacherId column to HostelAllocations table';
END;
GO

-- Make StudentId nullable in HostelAllocations (for teacher allocations)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('HostelAllocations') AND name = 'StudentId' AND is_nullable = 0)
BEGIN
    ALTER TABLE HostelAllocations ALTER COLUMN StudentId UNIQUEIDENTIFIER NULL;
    PRINT 'Made StudentId nullable in HostelAllocations';
END;
GO

-- 4. Create TransportDrivers Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TransportDrivers')
BEGIN
    CREATE TABLE TransportDrivers (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        FullName NVARCHAR(150) NOT NULL,
        PhoneNumber NVARCHAR(50) NOT NULL,
        EmergencyPhone NVARCHAR(50) NULL,
        LicenseNumber NVARCHAR(100) NOT NULL,
        LicenseExpiry DATETIME2 NULL,
        AadhaarNumber NVARCHAR(50) NULL,
        Address NVARCHAR(300) NULL,
        PhotoUrl NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_TransportDrivers_Branches FOREIGN KEY (BranchId) REFERENCES Branches(Id) ON DELETE SET NULL
    );
    CREATE INDEX IX_TransportDrivers_Tenant_Branch ON TransportDrivers(TenantId, BranchId);
    PRINT 'Created table TransportDrivers';
END;
GO

-- 5. Create TransportVehicles Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TransportVehicles')
BEGIN
    CREATE TABLE TransportVehicles (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        VehicleNumber NVARCHAR(50) NOT NULL,
        VehicleType NVARCHAR(50) NOT NULL DEFAULT 'Bus', -- Bus, MiniBus, Van, Cab
        TotalCapacity INT NOT NULL DEFAULT 40,
        Model NVARCHAR(100) NULL,
        Color NVARCHAR(50) NULL DEFAULT 'Yellow',
        DriverId UNIQUEIDENTIFIER NULL,
        ConductorName NVARCHAR(150) NULL,
        ConductorPhone NVARCHAR(50) NULL,
        GpsDeviceId NVARCHAR(100) NULL,
        InsuranceExpiry DATETIME2 NULL,
        FitnessExpiry DATETIME2 NULL,
        PollutionExpiry DATETIME2 NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_TransportVehicles_Drivers FOREIGN KEY (DriverId) REFERENCES TransportDrivers(Id) ON DELETE SET NULL,
        CONSTRAINT FK_TransportVehicles_Branches FOREIGN KEY (BranchId) REFERENCES Branches(Id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_TransportVehicles_Tenant ON TransportVehicles(TenantId);
    PRINT 'Created table TransportVehicles';
END;
GO

-- 6. Create TransportRoutes Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TransportRoutes')
BEGIN
    CREATE TABLE TransportRoutes (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        RouteCode NVARCHAR(50) NOT NULL,
        RouteName NVARCHAR(150) NOT NULL,
        StartPoint NVARCHAR(150) NULL,
        EndPoint NVARCHAR(150) NULL,
        VehicleId UNIQUEIDENTIFIER NULL,
        Description NVARCHAR(500) NULL,
        MorningDepartureTime NVARCHAR(50) NULL DEFAULT '07:00 AM',
        EveningDepartureTime NVARCHAR(50) NULL DEFAULT '03:30 PM',
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_TransportRoutes_Vehicles FOREIGN KEY (VehicleId) REFERENCES TransportVehicles(Id) ON DELETE SET NULL,
        CONSTRAINT FK_TransportRoutes_Branches FOREIGN KEY (BranchId) REFERENCES Branches(Id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_TransportRoutes_Tenant ON TransportRoutes(TenantId);
    PRINT 'Created table TransportRoutes';
END;
GO

-- 7. Create TransportRouteStops Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TransportRouteStops')
BEGIN
    CREATE TABLE TransportRouteStops (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        RouteId UNIQUEIDENTIFIER NOT NULL,
        StopName NVARCHAR(150) NOT NULL,
        StopOrder INT NOT NULL DEFAULT 1,
        PickupTime NVARCHAR(50) NULL DEFAULT '07:15 AM',
        DropTime NVARCHAR(50) NULL DEFAULT '03:45 PM',
        MonthlyFare DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        QuarterlyFare DECIMAL(18,2) NULL,
        HalfYearlyFare DECIMAL(18,2) NULL,
        AnnualFare DECIMAL(18,2) NULL,
        Landmark NVARCHAR(200) NULL,
        DistanceKm DECIMAL(18,2) NULL DEFAULT 0.00,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_TransportRouteStops_Routes FOREIGN KEY (RouteId) REFERENCES TransportRoutes(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_TransportRouteStops_RouteId ON TransportRouteStops(RouteId);
    PRINT 'Created table TransportRouteStops';
END;
GO

-- 8. Create TransportAllocations Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TransportAllocations')
BEGIN
    CREATE TABLE TransportAllocations (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        MemberType NVARCHAR(50) NOT NULL DEFAULT 'Student', -- Student, Teacher
        StudentId UNIQUEIDENTIFIER NULL,
        TeacherId UNIQUEIDENTIFIER NULL,
        RouteId UNIQUEIDENTIFIER NOT NULL,
        RouteStopId UNIQUEIDENTIFIER NOT NULL,
        VehicleId UNIQUEIDENTIFIER NULL,
        PickupDropType NVARCHAR(50) NOT NULL DEFAULT 'Both', -- Both, PickupOnly, DropOnly
        MonthlyFare DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        IsFreeAllocation BIT NOT NULL DEFAULT 0,
        EffectiveFrom DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        EffectiveTo DATETIME2 NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'Active', -- Active, Suspended, Discontinued
        Remarks NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_TransportAllocations_Students FOREIGN KEY (StudentId) REFERENCES Students(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_TransportAllocations_Teachers FOREIGN KEY (TeacherId) REFERENCES Teachers(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_TransportAllocations_Routes FOREIGN KEY (RouteId) REFERENCES TransportRoutes(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_TransportAllocations_Stops FOREIGN KEY (RouteStopId) REFERENCES TransportRouteStops(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_TransportAllocations_Vehicles FOREIGN KEY (VehicleId) REFERENCES TransportVehicles(Id) ON DELETE SET NULL,
        CONSTRAINT FK_TransportAllocations_Branches FOREIGN KEY (BranchId) REFERENCES Branches(Id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_TransportAllocations_StudentId ON TransportAllocations(StudentId);
    CREATE INDEX IX_TransportAllocations_TeacherId ON TransportAllocations(TeacherId);
    CREATE INDEX IX_TransportAllocations_RouteId ON TransportAllocations(RouteId);
    PRINT 'Created table TransportAllocations';
END;
GO

-- 9. Create CampusGatePasses Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CampusGatePasses')
BEGIN
    CREATE TABLE CampusGatePasses (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        PassType NVARCHAR(50) NOT NULL DEFAULT 'StudentEarlyExit', -- StudentEarlyExit, BusDeparture, TeacherMovement, Visitor
        PassNumber NVARCHAR(100) NOT NULL,
        StudentId UNIQUEIDENTIFIER NULL,
        TeacherId UNIQUEIDENTIFIER NULL,
        VehicleId UNIQUEIDENTIFIER NULL,
        PersonName NVARCHAR(150) NULL,
        ContactNumber NVARCHAR(50) NULL,
        Purpose NVARCHAR(500) NOT NULL,
        OutDateTime DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        ExpectedInDateTime DATETIME2 NULL,
        ActualInDateTime DATETIME2 NULL,
        ApprovedBy NVARCHAR(150) NULL,
        SecurityGuardName NVARCHAR(150) NULL,
        PassengerCount INT NULL DEFAULT 1,
        Status NVARCHAR(50) NOT NULL DEFAULT 'Issued', -- Issued, Closed, Overdue, Cancelled
        Remarks NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_CampusGatePasses_Students FOREIGN KEY (StudentId) REFERENCES Students(Id) ON DELETE SET NULL,
        CONSTRAINT FK_CampusGatePasses_Teachers FOREIGN KEY (TeacherId) REFERENCES Teachers(Id) ON DELETE SET NULL,
        CONSTRAINT FK_CampusGatePasses_Vehicles FOREIGN KEY (VehicleId) REFERENCES TransportVehicles(Id) ON DELETE SET NULL,
        CONSTRAINT FK_CampusGatePasses_Branches FOREIGN KEY (BranchId) REFERENCES Branches(Id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_CampusGatePasses_Tenant ON CampusGatePasses(TenantId);
    CREATE INDEX IX_CampusGatePasses_PassNumber ON CampusGatePasses(PassNumber);
    PRINT 'Created table CampusGatePasses';
END;
GO

-- 10. Ensure Transport Fee Head exists in FeeHeads
IF NOT EXISTS (SELECT 1 FROM FeeHeads WHERE Code = 'TRANS')
BEGIN
    DECLARE @TenantId UNIQUEIDENTIFIER = (SELECT TOP 1 Id FROM Tenants);
    IF @TenantId IS NOT NULL
    BEGIN
        INSERT INTO FeeHeads (Id, TenantId, Code, Name, Description, Frequency, Category, IsDefault, IsActive, CreatedAt, ApplicableTo)
        VALUES (NEWID(), @TenantId, 'TRANS', 'Transport & Commute Fee', 'Automated monthly route bus boarding fee', 'Monthly', 'Transport', 1, 1, GETUTCDATE(), 'Both');
        PRINT 'Created default TRANS FeeHead';
    END;
END;
GO

-- 11. Seed Initial Demo Transport Data (If no routes exist)
IF NOT EXISTS (SELECT 1 FROM TransportRoutes)
BEGIN
    DECLARE @TId UNIQUEIDENTIFIER = (SELECT TOP 1 Id FROM Tenants);
    DECLARE @BId UNIQUEIDENTIFIER = (SELECT TOP 1 Id FROM Branches WHERE TenantId = @TId);

    IF @TId IS NOT NULL
    BEGIN
        -- Driver 1
        DECLARE @Driver1_Id UNIQUEIDENTIFIER = NEWID();
        INSERT INTO TransportDrivers (Id, TenantId, BranchId, FullName, PhoneNumber, EmergencyPhone, LicenseNumber, LicenseExpiry, AadhaarNumber, Address, IsActive)
        VALUES (@Driver1_Id, @TId, @BId, N'Ramesh Kumar Yadav', N'9811223344', N'9811223355', N'DL-0420180098231', DATEADD(year, 4, GETUTCDATE()), N'4821 9087 1123', N'Village Badarpur, South Delhi', 1);

        -- Driver 2
        DECLARE @Driver2_Id UNIQUEIDENTIFIER = NEWID();
        INSERT INTO TransportDrivers (Id, TenantId, BranchId, FullName, PhoneNumber, EmergencyPhone, LicenseNumber, LicenseExpiry, AadhaarNumber, Address, IsActive)
        VALUES (@Driver2_Id, @TId, @BId, N'Satish Chandra Mishra', N'9822334455', N'9822334466', N'DL-0520190012456', DATEADD(year, 3, GETUTCDATE()), N'3412 8876 5432', N'Sector 12, Dwarka', 1);

        -- Vehicle 1: Heavy Bus
        DECLARE @Veh1_Id UNIQUEIDENTIFIER = NEWID();
        INSERT INTO TransportVehicles (Id, TenantId, BranchId, VehicleNumber, VehicleType, TotalCapacity, Model, Color, DriverId, ConductorName, ConductorPhone, GpsDeviceId, InsuranceExpiry, FitnessExpiry, PollutionExpiry, IsActive)
        VALUES (@Veh1_Id, @TId, @BId, N'DL-1P-B-4421', N'Bus', 42, N'Tata Starbus Ultra 2024', N'Yellow', @Driver1_Id, N'Manoj Singh', N'9871100223', N'GPS-TK-8021', DATEADD(month, 9, GETUTCDATE()), DATEADD(month, 11, GETUTCDATE()), DATEADD(month, 6, GETUTCDATE()), 1);

        -- Vehicle 2: Mini Bus
        DECLARE @Veh2_Id UNIQUEIDENTIFIER = NEWID();
        INSERT INTO TransportVehicles (Id, TenantId, BranchId, VehicleNumber, VehicleType, TotalCapacity, Model, Color, DriverId, ConductorName, ConductorPhone, GpsDeviceId, InsuranceExpiry, FitnessExpiry, PollutionExpiry, IsActive)
        VALUES (@Veh2_Id, @TId, @BId, N'DL-1P-V-9012', N'MiniBus', 26, N'Force Traveller 26 Seater', N'Yellow', @Driver2_Id, N'Sunil Rawat', N'9871100334', N'GPS-TK-8022', DATEADD(month, 8, GETUTCDATE()), DATEADD(month, 10, GETUTCDATE()), DATEADD(month, 5, GETUTCDATE()), 1);

        -- Route 1: North Campus Line
        DECLARE @Route1_Id UNIQUEIDENTIFIER = NEWID();
        INSERT INTO TransportRoutes (Id, TenantId, BranchId, RouteCode, RouteName, StartPoint, EndPoint, VehicleId, Description, MorningDepartureTime, EveningDepartureTime, IsActive)
        VALUES (@Route1_Id, @TId, @BId, N'R-01', N'North City Line via Ring Road', N'Model Town Metro', N'Campus Main Gate', @Veh1_Id, N'Primary school and coaching student transport route', N'06:45 AM', N'03:30 PM', 1);

        -- Stops for Route 1
        INSERT INTO TransportRouteStops (Id, TenantId, RouteId, StopName, StopOrder, PickupTime, DropTime, MonthlyFare, QuarterlyFare, AnnualFare, Landmark, DistanceKm, IsActive)
        VALUES 
        (NEWID(), @TId, @Route1_Id, N'Model Town Metro Gate 2', 1, N'06:45 AM', N'04:15 PM', 1800.00, 5100.00, 19800.00, N'Opposite Metro Pillar 84', 18.5, 1),
        (NEWID(), @TId, @Route1_Id, N'Azadpur Chowk Underpass', 2, N'07:00 AM', N'04:00 PM', 1500.00, 4200.00, 16500.00, N'Near Metro station entrance', 14.0, 1),
        (NEWID(), @TId, @Route1_Id, N'Shalimar Bagh Club', 3, N'07:15 AM', N'03:45 PM', 1200.00, 3400.00, 13200.00, N'Community Centre gate', 9.5, 1);

        -- Route 2: West Express
        DECLARE @Route2_Id UNIQUEIDENTIFIER = NEWID();
        INSERT INTO TransportRoutes (Id, TenantId, BranchId, RouteCode, RouteName, StartPoint, EndPoint, VehicleId, Description, MorningDepartureTime, EveningDepartureTime, IsActive)
        VALUES (@Route2_Id, @TId, @BId, N'R-02', N'West Express via Janakpuri', N'Uttam Nagar East', N'Campus Main Gate', @Veh2_Id, N'Fast shuttle for western residential sectors', N'07:00 AM', N'03:45 PM', 1);

        INSERT INTO TransportRouteStops (Id, TenantId, RouteId, StopName, StopOrder, PickupTime, DropTime, MonthlyFare, QuarterlyFare, AnnualFare, Landmark, DistanceKm, IsActive)
        VALUES 
        (NEWID(), @TId, @Route2_Id, N'Uttam Nagar Terminal', 1, N'07:00 AM', N'04:20 PM', 2000.00, 5700.00, 22000.00, N'Bus Terminal Flyover', 22.0, 1),
        (NEWID(), @TId, @Route2_Id, N'Janakpuri District Center', 2, N'07:15 AM', N'04:05 PM', 1600.00, 4500.00, 17600.00, N'Behind West End Mall', 16.0, 1),
        (NEWID(), @TId, @Route2_Id, N'Tilak Nagar Central Market', 3, N'07:30 AM', N'03:50 PM', 1300.00, 3700.00, 14300.00, N'Near Gurudwara Gate', 11.5, 1);

        PRINT 'Seeded demo transport drivers, vehicles, routes, and boarding stops';
    END;
END;
GO

PRINT '============================================================================';
PRINT 'IMSERP Transport & Fleet Module Migration Completed Successfully!';
PRINT '============================================================================';
