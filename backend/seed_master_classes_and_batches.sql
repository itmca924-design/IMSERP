-- ==============================================================================
-- IMSERP - MASTER DATA SEED SCRIPT (CLASSES PLAY TO 12th & SUBJECT-WISE BATCHES)
-- ==============================================================================
USE IMSERP;
GO

SET NOCOUNT ON;

-- 1. Identify Target Tenant and Branch (Default to Active Tenant)
DECLARE @TenantId UNIQUEIDENTIFIER;
DECLARE @BranchId UNIQUEIDENTIFIER;

SELECT TOP 1 @TenantId = Id FROM Tenants WHERE Code = 'APEX';
IF @TenantId IS NULL SELECT TOP 1 @TenantId = Id FROM Tenants WHERE IsActive = 1;

SELECT TOP 1 @BranchId = Id FROM Branches WHERE TenantId = @TenantId AND IsActive = 1;

PRINT 'Target TenantId: ' + CAST(@TenantId AS NVARCHAR(50));
PRINT 'Target BranchId: ' + CAST(@BranchId AS NVARCHAR(50));

-- ==============================================================================
-- 2. CLASSROOMS / ROOMS MASTER
-- ==============================================================================
PRINT '--> Seeding Rooms...';
DECLARE @RoomsTable TABLE (RoomNumber NVARCHAR(50), Capacity INT, Floor NVARCHAR(50));
INSERT INTO @RoomsTable VALUES 
('Room 101', 45, 'Ground Floor'),
('Room 102', 45, 'Ground Floor'),
('Room 103', 40, 'Ground Floor'),
('Room 201', 50, '1st Floor'),
('Room 202', 50, '1st Floor'),
('Room 203', 50, '1st Floor'),
('Room 301', 60, '2nd Floor'),
('Room 302', 60, '2nd Floor'),
('Science Lab', 40, '1st Floor'),
('Computer Lab', 40, '2nd Floor');

MERGE Rooms AS target
USING (SELECT RoomNumber, Capacity, Floor FROM @RoomsTable) AS source
ON (target.TenantId = @TenantId AND target.RoomNumber = source.RoomNumber)
WHEN NOT MATCHED THEN
    INSERT (Id, TenantId, BranchId, RoomNumber, Capacity, Floor, IsActive, CreatedAt)
    VALUES (NEWID(), @TenantId, @BranchId, source.RoomNumber, source.Capacity, source.Floor, 1, GETUTCDATE());

-- ==============================================================================
-- 3. SUBJECTS MASTER
-- ==============================================================================
PRINT '--> Seeding Master Subjects...';
DECLARE @SubTable TABLE (Name NVARCHAR(100), Code NVARCHAR(20), Description NVARCHAR(200));
INSERT INTO @SubTable VALUES
('Mathematics', 'MTH', 'Mathematics & Applied Maths'),
('Physics', 'PHY', 'Physics Theory & Numerical'),
('Chemistry', 'CHM', 'Organic, Inorganic & Physical Chemistry'),
('Biology', 'BIO', 'Botany & Zoology'),
('English', 'ENG', 'English Language & Literature'),
('Hindi', 'HIN', 'Hindi Core & Literature'),
('Social Science', 'SST', 'History, Civics, Geography & Economics'),
('Science', 'SCI', 'General Science for Juniors'),
('Computer Science', 'CS', 'Informatics & Programming'),
('Accountancy', 'ACC', 'Accountancy & Book-keeping'),
('Business Studies', 'BST', 'Business Studies & Management'),
('Economics', 'ECO', 'Micro & Macro Economics'),
('Environmental Studies', 'EVS', 'Environmental Science for Primary');

MERGE Subjects AS target
USING (SELECT Name, Code, Description FROM @SubTable) AS source
ON (target.TenantId = @TenantId AND target.Name = source.Name)
WHEN NOT MATCHED THEN
    INSERT (Id, TenantId, Name, Code, Description, IsActive, CreatedAt)
    VALUES (NEWID(), @TenantId, source.Name, source.Code, source.Description, 1, GETUTCDATE());

-- ==============================================================================
-- 4. SCHOOL CLASSES (PLAY TO 10+2)
-- ==============================================================================
PRINT '--> Seeding School Classes (Play to 10+2)...';
DECLARE @ClassesTable TABLE (Name NVARCHAR(100), Code NVARCHAR(20), DisplayOrder INT);
INSERT INTO @ClassesTable VALUES
('Play Group', 'PLAY', 1),
('Nursery', 'NUR', 2),
('LKG', 'LKG', 3),
('UKG', 'UKG', 4),
('Class 1st', 'C01', 5),
('Class 2nd', 'C02', 6),
('Class 3rd', 'C03', 7),
('Class 4th', 'C04', 8),
('Class 5th', 'C05', 9),
('Class 6th', 'C06', 10),
('Class 7th', 'C07', 11),
('Class 8th', 'C08', 12),
('Class 9th', 'C09', 13),
('Class 10th', 'C10', 14),
('Class 11th', 'C11', 15),
('Class 10+2', 'C12', 16);

MERGE SchoolClasses AS target
USING (SELECT Name, Code, DisplayOrder FROM @ClassesTable) AS source
ON (target.TenantId = @TenantId AND (target.Name = source.Name OR target.Code = source.Code))
WHEN MATCHED THEN
    UPDATE SET DisplayOrder = source.DisplayOrder, IsActive = 1
WHEN NOT MATCHED THEN
    INSERT (Id, TenantId, BranchId, Name, Code, DisplayOrder, IsActive, CreatedAt)
    VALUES (NEWID(), @TenantId, @BranchId, source.Name, source.Code, source.DisplayOrder, 1, GETUTCDATE());

-- ==============================================================================
-- 5. SCHOOL SECTIONS (Section A & Section B for every Class)
-- ==============================================================================
PRINT '--> Seeding School Sections for all Classes...';
DECLARE @ClassCursor CURSOR;
DECLARE @CurrentClassId UNIQUEIDENTIFIER;
DECLARE @CurrentClassName NVARCHAR(100);

-- Assign a default room and teacher if available
DECLARE @DefaultRoomId UNIQUEIDENTIFIER;
SELECT TOP 1 @DefaultRoomId = Id FROM Rooms WHERE TenantId = @TenantId;

DECLARE @DefaultTeacherId UNIQUEIDENTIFIER;
SELECT TOP 1 @DefaultTeacherId = Id FROM Teachers WHERE TenantId = @TenantId AND IsActive = 1;

SET @ClassCursor = CURSOR FOR 
    SELECT Id, Name FROM SchoolClasses WHERE TenantId = @TenantId;

OPEN @ClassCursor;
FETCH NEXT FROM @ClassCursor INTO @CurrentClassId, @CurrentClassName;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- Section A
    IF NOT EXISTS (SELECT 1 FROM SchoolSections WHERE TenantId = @TenantId AND ClassId = @CurrentClassId AND Name = 'Section A')
    BEGIN
        INSERT INTO SchoolSections (Id, TenantId, BranchId, ClassId, Name, MaxCapacity, RoomId, ClassTeacherId, IsActive, CreatedAt)
        VALUES (NEWID(), @TenantId, @BranchId, @CurrentClassId, 'Section A', 45, @DefaultRoomId, @DefaultTeacherId, 1, GETUTCDATE());
    END

    -- Section B
    IF NOT EXISTS (SELECT 1 FROM SchoolSections WHERE TenantId = @TenantId AND ClassId = @CurrentClassId AND Name = 'Section B')
    BEGIN
        INSERT INTO SchoolSections (Id, TenantId, BranchId, ClassId, Name, MaxCapacity, RoomId, ClassTeacherId, IsActive, CreatedAt)
        VALUES (NEWID(), @TenantId, @BranchId, @CurrentClassId, 'Section B', 45, @DefaultRoomId, NULL, 1, GETUTCDATE());
    END

    FETCH NEXT FROM @ClassCursor INTO @CurrentClassId, @CurrentClassName;
END

CLOSE @ClassCursor;
DEALLOCATE @ClassCursor;

-- ==============================================================================
-- 6. COACHING BATCHES (Short, Crisp, Multiple Batches per Subject)
-- ==============================================================================
PRINT '--> Seeding Short & Valid Subject-wise Coaching Batches...';

-- Clean up any confusing dummy batches with long names if desired
-- Or insert standard batches
DECLARE @BatchesTable TABLE (Name NVARCHAR(100), Subject NVARCHAR(100), Fee DECIMAL(18,2), AcademicYear NVARCHAR(20));
INSERT INTO @BatchesTable VALUES
-- Mathematics (Multiple Batches)
('MTH-09-A', 'Mathematics', 1200.00, '2025-2026'),
('MTH-09-B', 'Mathematics', 1200.00, '2025-2026'),
('MTH-10-A', 'Mathematics', 1500.00, '2025-2026'),
('MTH-10-B', 'Mathematics', 1500.00, '2025-2026'),
('MTH-11-JEE', 'Mathematics', 2500.00, '2025-2026'),
('MTH-12-JEE', 'Mathematics', 3000.00, '2025-2026'),

-- Physics (Multiple Batches)
('PHY-10-MOR', 'Physics', 1500.00, '2025-2026'),
('PHY-10-EVE', 'Physics', 1500.00, '2025-2026'),
('PHY-11-FND', 'Physics', 2500.00, '2025-2026'),
('PHY-12-JEE', 'Physics', 3000.00, '2025-2026'),
('PHY-12-NEET', 'Physics', 2800.00, '2025-2026'),

-- Chemistry (Multiple Batches)
('CHM-10-A', 'Chemistry', 1500.00, '2025-2026'),
('CHM-10-B', 'Chemistry', 1500.00, '2025-2026'),
('CHM-11-TGT', 'Chemistry', 2500.00, '2025-2026'),
('CHM-12-JEE', 'Chemistry', 3000.00, '2025-2026'),
('CHM-12-NEET', 'Chemistry', 2800.00, '2025-2026'),

-- Biology (Multiple Batches)
('BIO-10-A', 'Biology', 1200.00, '2025-2026'),
('BIO-11-NEET-A', 'Biology', 2500.00, '2025-2026'),
('BIO-11-NEET-B', 'Biology', 2500.00, '2025-2026'),
('BIO-12-NEET-A', 'Biology', 3000.00, '2025-2026'),
('BIO-12-NEET-B', 'Biology', 3000.00, '2025-2026'),

-- English (Multiple Batches)
('ENG-09-A', 'English', 800.00, '2025-2026'),
('ENG-10-A', 'English', 1000.00, '2025-2026'),
('ENG-10-B', 'English', 1000.00, '2025-2026'),
('ENG-12-A', 'English', 1200.00, '2025-2026'),

-- Commerce / Accountancy (Multiple Batches)
('ACC-11-A', 'Accountancy', 2000.00, '2025-2026'),
('ACC-12-A', 'Accountancy', 2500.00, '2025-2026'),
('ECO-12-A', 'Economics', 1800.00, '2025-2026'),

-- Junior Foundation
('FND-07-A', 'Science', 1000.00, '2025-2026'),
('FND-08-A', 'Science', 1200.00, '2025-2026'),
('FND-08-B', 'Science', 1200.00, '2025-2026');

MERGE Batches AS target
USING (SELECT Name, Subject, Fee, AcademicYear FROM @BatchesTable) AS source
ON (target.TenantId = @TenantId AND target.Name = source.Name)
WHEN MATCHED THEN
    UPDATE SET Subject = source.Subject, StandardMonthlyFee = source.Fee, AcademicYear = source.AcademicYear
WHEN NOT MATCHED THEN
    INSERT (Id, TenantId, BranchId, Name, Subject, AcademicYear, StandardMonthlyFee, CreatedAt)
    VALUES (NEWID(), @TenantId, @BranchId, source.Name, source.Subject, source.AcademicYear, source.Fee, GETUTCDATE());

-- ==============================================================================
-- 7. VERIFICATION OUTPUT
-- ==============================================================================
PRINT '=======================================================';
PRINT 'SUCCESS! MASTER SEEDING COMPLETED.';
PRINT '=======================================================';

SELECT 'Total Classes' AS Metric, COUNT(*) AS Total FROM SchoolClasses WHERE TenantId = @TenantId
UNION ALL
SELECT 'Total Sections' AS Metric, COUNT(*) AS Total FROM SchoolSections WHERE TenantId = @TenantId
UNION ALL
SELECT 'Total Subjects' AS Metric, COUNT(*) AS Total FROM Subjects WHERE TenantId = @TenantId
UNION ALL
SELECT 'Total Batches' AS Metric, COUNT(*) AS Total FROM Batches WHERE TenantId = @TenantId
UNION ALL
SELECT 'Total Rooms' AS Metric, COUNT(*) AS Total FROM Rooms WHERE TenantId = @TenantId;

SELECT TOP 16 DisplayOrder, Name AS ClassName, Code FROM SchoolClasses WHERE TenantId = @TenantId ORDER BY DisplayOrder;

SELECT Subject, COUNT(*) AS BatchCount FROM Batches WHERE TenantId = @TenantId GROUP BY Subject ORDER BY BatchCount DESC;
GO
