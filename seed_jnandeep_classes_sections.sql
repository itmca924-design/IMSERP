USE IMSERP;
GO

DECLARE @TenantId UNIQUEIDENTIFIER;
DECLARE @BranchId UNIQUEIDENTIFIER;

SELECT @TenantId = Id FROM Tenants WHERE Code = 'JNANDEEP';
SELECT TOP 1 @BranchId = Id FROM Branches WHERE TenantId = @TenantId AND IsActive = 1;

IF @TenantId IS NULL
BEGIN
    RAISERROR('Tenant JNANDEEP not found!', 16, 1);
    RETURN;
END

-- 1. Classes to ensure
DECLARE @ClassDefinitions TABLE (
    Name NVARCHAR(100),
    Code NVARCHAR(50),
    DisplayOrder INT
);

INSERT INTO @ClassDefinitions (Name, Code, DisplayOrder) VALUES
('Play Group', 'PLAY', 1),
('Nursery',    'NUR',  2),
('LKG',        'LKG',  3),
('UKG',        'UKG',  4),
('Class 1st',  'C01',  5),
('Class 2nd',  'C02',  6),
('Class 3rd',  'C03',  7),
('Class 4th',  'C04',  8),
('Class 5th',  'C05',  9);

-- Insert missing classes
INSERT INTO SchoolClasses (Id, TenantId, BranchId, Name, Code, DisplayOrder, IsActive, CreatedAt)
SELECT 
    NEWID(), 
    @TenantId, 
    @BranchId, 
    cd.Name, 
    cd.Code, 
    cd.DisplayOrder, 
    1, 
    GETUTCDATE()
FROM @ClassDefinitions cd
WHERE NOT EXISTS (
    SELECT 1 FROM SchoolClasses sc 
    WHERE sc.TenantId = @TenantId AND sc.Name = cd.Name
);

-- 2. Sections to ensure for each class: A, B, C
DECLARE @SectionNames TABLE (Name NVARCHAR(50));
INSERT INTO @SectionNames (Name) VALUES ('A'), ('B'), ('C');

INSERT INTO SchoolSections (Id, TenantId, BranchId, ClassId, Name, MaxCapacity, RoomId, IsActive, CreatedAt, ClassTeacherId)
SELECT 
    NEWID(), 
    @TenantId, 
    @BranchId, 
    sc.Id, 
    sn.Name, 
    45, 
    NULL, 
    1, 
    GETUTCDATE(), 
    NULL
FROM SchoolClasses sc
CROSS JOIN @SectionNames sn
WHERE sc.TenantId = @TenantId
  AND NOT EXISTS (
      SELECT 1 FROM SchoolSections ss 
      WHERE ss.TenantId = @TenantId 
        AND ss.ClassId = sc.Id 
        AND ss.Name = sn.Name
  );

-- 3. Verification Report
SELECT 
    c.DisplayOrder,
    c.Name AS ClassName,
    c.Code AS ClassCode,
    STRING_AGG(s.Name, ', ') WITHIN GROUP (ORDER BY s.Name) AS Sections,
    COUNT(s.Id) AS TotalSections
FROM SchoolClasses c
LEFT JOIN SchoolSections s ON c.Id = s.ClassId
WHERE c.TenantId = @TenantId
GROUP BY c.DisplayOrder, c.Name, c.Code
ORDER BY c.DisplayOrder;
GO
