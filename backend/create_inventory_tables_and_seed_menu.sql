-- =========================================================================================
-- IMSERP - Inventory & Store Management Module: Tables, Indexes, Default Data & Menu Seeding
-- =========================================================================================

SET NOCOUNT ON;

-- 1. Create InventoryCategories Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'InventoryCategories')
BEGIN
    CREATE TABLE InventoryCategories (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [Name] NVARCHAR(100) NOT NULL,
        [Code] NVARCHAR(50) NOT NULL,
        [Description] NVARCHAR(255) NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_InventoryCategories_Branches FOREIGN KEY ([BranchId]) REFERENCES Branches([Id]) ON DELETE NO ACTION
    );
    CREATE INDEX IX_InventoryCategories_Tenant_Branch ON InventoryCategories([TenantId], [BranchId]);
    PRINT 'Created InventoryCategories table.';
END

-- 2. Create InventoryVendors Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'InventoryVendors')
BEGIN
    CREATE TABLE InventoryVendors (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [VendorName] NVARCHAR(150) NOT NULL,
        [ContactPerson] NVARCHAR(100) NULL,
        [Phone] NVARCHAR(30) NULL,
        [Email] NVARCHAR(100) NULL,
        [Address] NVARCHAR(255) NULL,
        [Gstin] NVARCHAR(50) NULL,
        [Pan] NVARCHAR(50) NULL,
        [PaymentTerms] NVARCHAR(100) NULL,
        [BankDetails] NVARCHAR(255) NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_InventoryVendors_Branches FOREIGN KEY ([BranchId]) REFERENCES Branches([Id]) ON DELETE NO ACTION
    );
    CREATE INDEX IX_InventoryVendors_Tenant_Branch ON InventoryVendors([TenantId], [BranchId]);
    PRINT 'Created InventoryVendors table.';
END

-- 3. Create InventoryItems Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'InventoryItems')
BEGIN
    CREATE TABLE InventoryItems (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [CategoryId] UNIQUEIDENTIFIER NOT NULL,
        [ItemCode] NVARCHAR(50) NOT NULL,
        [ItemName] NVARCHAR(150) NOT NULL,
        [ItemType] NVARCHAR(50) NOT NULL DEFAULT 'Consumable', -- Consumable, Kit/Sellable, Asset
        [UnitOfMeasurement] NVARCHAR(50) NOT NULL DEFAULT 'Pcs', -- Pcs, Box, Set, Packet, Dozen, Roll, Kg
        [PurchasePrice] DECIMAL(18,2) NOT NULL DEFAULT 0,
        [SellingPrice] DECIMAL(18,2) NOT NULL DEFAULT 0,
        [CurrentStock] DECIMAL(18,2) NOT NULL DEFAULT 0,
        [MinStockAlertLevel] DECIMAL(18,2) NOT NULL DEFAULT 5,
        [RackOrLocation] NVARCHAR(100) NULL,
        [Description] NVARCHAR(500) NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] DATETIME2 NULL,
        CONSTRAINT FK_InventoryItems_Categories FOREIGN KEY ([CategoryId]) REFERENCES InventoryCategories([Id]) ON DELETE NO ACTION,
        CONSTRAINT FK_InventoryItems_Branches FOREIGN KEY ([BranchId]) REFERENCES Branches([Id]) ON DELETE NO ACTION
    );
    CREATE INDEX IX_InventoryItems_Tenant_Branch_Code ON InventoryItems([TenantId], [BranchId], [ItemCode]);
    CREATE INDEX IX_InventoryItems_Tenant_Category ON InventoryItems([TenantId], [CategoryId]);
    PRINT 'Created InventoryItems table.';
END

-- 4. Create InventoryInwards Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'InventoryInwards')
BEGIN
    CREATE TABLE InventoryInwards (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [VendorId] UNIQUEIDENTIFIER NULL,
        [InwardNumber] NVARCHAR(50) NOT NULL,
        [InvoiceBillNumber] NVARCHAR(50) NULL,
        [InwardDate] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [TotalAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
        [DiscountAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
        [TaxAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
        [NetAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
        [PaymentStatus] NVARCHAR(50) NOT NULL DEFAULT 'Paid',
        [PaymentMode] NVARCHAR(50) NOT NULL DEFAULT 'Cash',
        [Remarks] NVARCHAR(500) NULL,
        [CreatedBy] UNIQUEIDENTIFIER NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_InventoryInwards_Vendors FOREIGN KEY ([VendorId]) REFERENCES InventoryVendors([Id]) ON DELETE SET NULL,
        CONSTRAINT FK_InventoryInwards_Branches FOREIGN KEY ([BranchId]) REFERENCES Branches([Id]) ON DELETE NO ACTION
    );
    CREATE INDEX IX_InventoryInwards_Tenant_Branch ON InventoryInwards([TenantId], [BranchId]);
    PRINT 'Created InventoryInwards table.';
END

-- 5. Create InventoryInwardItems Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'InventoryInwardItems')
BEGIN
    CREATE TABLE InventoryInwardItems (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [InwardId] UNIQUEIDENTIFIER NOT NULL,
        [ItemId] UNIQUEIDENTIFIER NOT NULL,
        [Quantity] DECIMAL(18,2) NOT NULL DEFAULT 1,
        [UnitPrice] DECIMAL(18,2) NOT NULL DEFAULT 0,
        [TotalAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
        [BatchOrSerialNo] NVARCHAR(100) NULL,
        [Remarks] NVARCHAR(255) NULL,
        CONSTRAINT FK_InventoryInwardItems_Inwards FOREIGN KEY ([InwardId]) REFERENCES InventoryInwards([Id]) ON DELETE CASCADE,
        CONSTRAINT FK_InventoryInwardItems_Items FOREIGN KEY ([ItemId]) REFERENCES InventoryItems([Id]) ON DELETE NO ACTION,
        CONSTRAINT FK_InventoryInwardItems_Branches FOREIGN KEY ([BranchId]) REFERENCES Branches([Id]) ON DELETE NO ACTION
    );
    CREATE INDEX IX_InventoryInwardItems_Tenant_Branch ON InventoryInwardItems([TenantId], [BranchId]);
    CREATE INDEX IX_InventoryInwardItems_Inward ON InventoryInwardItems([InwardId]);
    PRINT 'Created InventoryInwardItems table.';
END

-- 6. Create InventoryOutwards Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'InventoryOutwards')
BEGIN
    CREATE TABLE InventoryOutwards (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [IssueNumber] NVARCHAR(50) NOT NULL,
        [IssueDate] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [IssueType] NVARCHAR(50) NOT NULL DEFAULT 'StaffDepartmentIssue',
        [StudentId] UNIQUEIDENTIFIER NULL,
        [IssuedToName] NVARCHAR(150) NOT NULL,
        [DepartmentOrClass] NVARCHAR(100) NULL,
        [TotalAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
        [PaymentStatus] NVARCHAR(50) NOT NULL DEFAULT 'Free/Complimentary',
        [PaymentMode] NVARCHAR(50) NULL,
        [Remarks] NVARCHAR(500) NULL,
        [CreatedBy] UNIQUEIDENTIFIER NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_InventoryOutwards_Students FOREIGN KEY ([StudentId]) REFERENCES Students([Id]) ON DELETE SET NULL,
        CONSTRAINT FK_InventoryOutwards_Branches FOREIGN KEY ([BranchId]) REFERENCES Branches([Id]) ON DELETE NO ACTION
    );
    CREATE INDEX IX_InventoryOutwards_Tenant_Branch ON InventoryOutwards([TenantId], [BranchId]);
    PRINT 'Created InventoryOutwards table.';
END

-- 7. Create InventoryOutwardItems Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'InventoryOutwardItems')
BEGIN
    CREATE TABLE InventoryOutwardItems (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [OutwardId] UNIQUEIDENTIFIER NOT NULL,
        [ItemId] UNIQUEIDENTIFIER NOT NULL,
        [Quantity] DECIMAL(18,2) NOT NULL DEFAULT 1,
        [UnitPrice] DECIMAL(18,2) NOT NULL DEFAULT 0,
        [TotalAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
        [Remarks] NVARCHAR(255) NULL,
        CONSTRAINT FK_InventoryOutwardItems_Outwards FOREIGN KEY ([OutwardId]) REFERENCES InventoryOutwards([Id]) ON DELETE CASCADE,
        CONSTRAINT FK_InventoryOutwardItems_Items FOREIGN KEY ([ItemId]) REFERENCES InventoryItems([Id]) ON DELETE NO ACTION,
        CONSTRAINT FK_InventoryOutwardItems_Branches FOREIGN KEY ([BranchId]) REFERENCES Branches([Id]) ON DELETE NO ACTION
    );
    CREATE INDEX IX_InventoryOutwardItems_Tenant_Branch ON InventoryOutwardItems([TenantId], [BranchId]);
    CREATE INDEX IX_InventoryOutwardItems_Outward ON InventoryOutwardItems([OutwardId]);
    PRINT 'Created InventoryOutwardItems table.';
END

-- 8. Create InventoryStockAdjustments Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'InventoryStockAdjustments')
BEGIN
    CREATE TABLE InventoryStockAdjustments (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [ItemId] UNIQUEIDENTIFIER NOT NULL,
        [AdjustmentType] NVARCHAR(50) NOT NULL DEFAULT 'PhysicalAuditCorrection',
        [PreviousStock] DECIMAL(18,2) NOT NULL DEFAULT 0,
        [AdjustedQuantity] DECIMAL(18,2) NOT NULL DEFAULT 0,
        [NewStock] DECIMAL(18,2) NOT NULL DEFAULT 0,
        [Reason] NVARCHAR(500) NULL,
        [AdjustedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [AdjustedBy] UNIQUEIDENTIFIER NULL,
        CONSTRAINT FK_InventoryStockAdjustments_Items FOREIGN KEY ([ItemId]) REFERENCES InventoryItems([Id]) ON DELETE NO ACTION,
        CONSTRAINT FK_InventoryStockAdjustments_Branches FOREIGN KEY ([BranchId]) REFERENCES Branches([Id]) ON DELETE NO ACTION
    );
    CREATE INDEX IX_InventoryStockAdjustments_Tenant_Item ON InventoryStockAdjustments([TenantId], [ItemId]);
    PRINT 'Created InventoryStockAdjustments table.';
END

-- -----------------------------------------------------------------------------------------
-- 9. Seed Default Inventory Categories for Active Tenants
-- -----------------------------------------------------------------------------------------
DECLARE @TenantCursor CURSOR;
DECLARE @CurrentTenantId UNIQUEIDENTIFIER;

SET @TenantCursor = CURSOR FOR
    SELECT Id FROM Tenants WHERE IsActive = 1;

OPEN @TenantCursor;
FETCH NEXT FROM @TenantCursor INTO @CurrentTenantId;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- Stationery & Consumables (Pens, pencils, chalk, registers, papers)
    IF NOT EXISTS (SELECT 1 FROM InventoryCategories WHERE TenantId = @CurrentTenantId AND Code = 'STAT')
    BEGIN
        INSERT INTO InventoryCategories (Id, TenantId, Name, Code, Description, IsActive, CreatedAt)
        VALUES (NEWID(), @CurrentTenantId, N'Stationery & Consumables', N'STAT', N'Pens, Pencils, Chalk, Registers, Marker, A4 Reams, Craft papers', 1, GETUTCDATE());
    END

    -- Uniforms & Apparel
    IF NOT EXISTS (SELECT 1 FROM InventoryCategories WHERE TenantId = @CurrentTenantId AND Code = 'UNIF')
    BEGIN
        INSERT INTO InventoryCategories (Id, TenantId, Name, Code, Description, IsActive, CreatedAt)
        VALUES (NEWID(), @CurrentTenantId, N'Uniforms & Apparel', N'UNIF', N'Shirts, Trousers, Skirts, Blazers, Ties, Belts, Badges, Socks', 1, GETUTCDATE());
    END

    -- Books & Notebooks
    IF NOT EXISTS (SELECT 1 FROM InventoryCategories WHERE TenantId = @CurrentTenantId AND Code = 'BOOK')
    BEGIN
        INSERT INTO InventoryCategories (Id, TenantId, Name, Code, Description, IsActive, CreatedAt)
        VALUES (NEWID(), @CurrentTenantId, N'Books & Study Kits', N'BOOK', N'Textbooks, Workbooks, Practical Notebooks, School Diaries', 1, GETUTCDATE());
    END

    -- Lab Apparatus & Chemicals
    IF NOT EXISTS (SELECT 1 FROM InventoryCategories WHERE TenantId = @CurrentTenantId AND Code = 'LAB')
    BEGIN
        INSERT INTO InventoryCategories (Id, TenantId, Name, Code, Description, IsActive, CreatedAt)
        VALUES (NEWID(), @CurrentTenantId, N'Lab Apparatus & Chemicals', N'LAB', N'Science Lab Equipment, Glassware, Chemicals, Microscopes', 1, GETUTCDATE());
    END

    -- Sports & Physical Education
    IF NOT EXISTS (SELECT 1 FROM InventoryCategories WHERE TenantId = @CurrentTenantId AND Code = 'SPORT')
    BEGIN
        INSERT INTO InventoryCategories (Id, TenantId, Name, Code, Description, IsActive, CreatedAt)
        VALUES (NEWID(), @CurrentTenantId, N'Sports Equipment', N'SPORT', N'Cricket kits, Footballs, Badminton, Cones, Table Tennis', 1, GETUTCDATE());
    END

    -- IT & Electronics Fixed Assets
    IF NOT EXISTS (SELECT 1 FROM InventoryCategories WHERE TenantId = @CurrentTenantId AND Code = 'IT')
    BEGIN
        INSERT INTO InventoryCategories (Id, TenantId, Name, Code, Description, IsActive, CreatedAt)
        VALUES (NEWID(), @CurrentTenantId, N'IT & Electronics Assets', N'IT', N'Smartboards, Projectors, PCs, Printers, UPS, Sound system', 1, GETUTCDATE());
    END

    -- Furniture & Fixtures
    IF NOT EXISTS (SELECT 1 FROM InventoryCategories WHERE TenantId = @CurrentTenantId AND Code = 'FURN')
    BEGIN
        INSERT INTO InventoryCategories (Id, TenantId, Name, Code, Description, IsActive, CreatedAt)
        VALUES (NEWID(), @CurrentTenantId, N'Furniture & Fixtures', N'FURN', N'Student Benches, Desks, Podiums, Office Chairs, Almirahs', 1, GETUTCDATE());
    END

    FETCH NEXT FROM @TenantCursor INTO @CurrentTenantId;
END

CLOSE @TenantCursor;
DEALLOCATE @TenantCursor;

PRINT 'Seeded default InventoryCategories.';

-- -----------------------------------------------------------------------------------------
-- 10. Seed Sample Stationery & Consumable Items for Apex Tenant
-- -----------------------------------------------------------------------------------------
DECLARE @ApexTenantId UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
IF EXISTS (SELECT 1 FROM Tenants WHERE Id = @ApexTenantId)
BEGIN
    DECLARE @StatCatId UNIQUEIDENTIFIER;
    SELECT TOP 1 @StatCatId = Id FROM InventoryCategories WHERE TenantId = @ApexTenantId AND Code = 'STAT';

    DECLARE @UnifCatId UNIQUEIDENTIFIER;
    SELECT TOP 1 @UnifCatId = Id FROM InventoryCategories WHERE TenantId = @ApexTenantId AND Code = 'UNIF';

    DECLARE @BookCatId UNIQUEIDENTIFIER;
    SELECT TOP 1 @BookCatId = Id FROM InventoryCategories WHERE TenantId = @ApexTenantId AND Code = 'BOOK';

    -- Pen
    IF @StatCatId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM InventoryItems WHERE TenantId = @ApexTenantId AND ItemCode = 'ITM-PEN-BLU')
    BEGIN
        INSERT INTO InventoryItems (Id, TenantId, CategoryId, ItemCode, ItemName, ItemType, UnitOfMeasurement, PurchasePrice, SellingPrice, CurrentStock, MinStockAlertLevel, RackOrLocation, Description, IsActive, CreatedAt)
        VALUES (NEWID(), @ApexTenantId, @StatCatId, 'ITM-PEN-BLU', N'Blue Ballpoint Pen (Box of 20)', 'Consumable', 'Box', 120.00, 160.00, 45, 10, N'Store Rack A-1', N'Standard blue writing pens for staff & students', 1, GETUTCDATE());
    END

    -- Pencil
    IF @StatCatId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM InventoryItems WHERE TenantId = @ApexTenantId AND ItemCode = 'ITM-PENCIL-HB')
    BEGIN
        INSERT INTO InventoryItems (Id, TenantId, CategoryId, ItemCode, ItemName, ItemType, UnitOfMeasurement, PurchasePrice, SellingPrice, CurrentStock, MinStockAlertLevel, RackOrLocation, Description, IsActive, CreatedAt)
        VALUES (NEWID(), @ApexTenantId, @StatCatId, 'ITM-PENCIL-HB', N'Apsara Extra Dark HB Pencils (Pack of 10)', 'Consumable', 'Packet', 50.00, 70.00, 60, 15, N'Store Rack A-2', N'Drawing & exam pencils for students', 1, GETUTCDATE());
    END

    -- Register
    IF @StatCatId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM InventoryItems WHERE TenantId = @ApexTenantId AND ItemCode = 'ITM-REG-192')
    BEGIN
        INSERT INTO InventoryItems (Id, TenantId, CategoryId, ItemCode, ItemName, ItemType, UnitOfMeasurement, PurchasePrice, SellingPrice, CurrentStock, MinStockAlertLevel, RackOrLocation, Description, IsActive, CreatedAt)
        VALUES (NEWID(), @ApexTenantId, @StatCatId, 'ITM-REG-192', N'Hardbound Class Attendance Register (192 Pages)', 'Consumable', 'Pcs', 95.00, 140.00, 28, 8, N'Store Rack A-3', N'Official class attendance & record registers', 1, GETUTCDATE());
    END

    -- Chalk & Duster Box
    IF @StatCatId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM InventoryItems WHERE TenantId = @ApexTenantId AND ItemCode = 'ITM-DUST-CHALK')
    BEGIN
        INSERT INTO InventoryItems (Id, TenantId, CategoryId, ItemCode, ItemName, ItemType, UnitOfMeasurement, PurchasePrice, SellingPrice, CurrentStock, MinStockAlertLevel, RackOrLocation, Description, IsActive, CreatedAt)
        VALUES (NEWID(), @ApexTenantId, @StatCatId, 'ITM-DUST-CHALK', N'White Dustless Chalk Box (100 Pcs) + Wooden Duster Set', 'Consumable', 'Set', 80.00, 110.00, 35, 10, N'Store Rack B-1', N'Classroom teaching consumables', 1, GETUTCDATE());
    END

    -- Uniform Set
    IF @UnifCatId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM InventoryItems WHERE TenantId = @ApexTenantId AND ItemCode = 'ITM-UNI-BOY-32')
    BEGIN
        INSERT INTO InventoryItems (Id, TenantId, CategoryId, ItemCode, ItemName, ItemType, UnitOfMeasurement, PurchasePrice, SellingPrice, CurrentStock, MinStockAlertLevel, RackOrLocation, Description, IsActive, CreatedAt)
        VALUES (NEWID(), @ApexTenantId, @UnifCatId, 'ITM-UNI-BOY-32', N'Boys Regular Uniform Kit (Size 32: Shirt + Pant + Tie + Belt)', 'Kit/Sellable', 'Set', 750.00, 1100.00, 18, 5, N'Wardrobe Room C', N'Complete school uniform kit for middle school boys', 1, GETUTCDATE());
    END

    -- School Diary
    IF @BookCatId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM InventoryItems WHERE TenantId = @ApexTenantId AND ItemCode = 'ITM-DIARY-2026')
    BEGIN
        INSERT INTO InventoryItems (Id, TenantId, CategoryId, ItemCode, ItemName, ItemType, UnitOfMeasurement, PurchasePrice, SellingPrice, CurrentStock, MinStockAlertLevel, RackOrLocation, Description, IsActive, CreatedAt)
        VALUES (NEWID(), @ApexTenantId, @BookCatId, 'ITM-DIARY-2026', N'Annual Student Almanac / School Diary 2026-27', 'Kit/Sellable', 'Pcs', 85.00, 150.00, 85, 20, N'Store Shelf D', N'Official school diary given to enrolled students', 1, GETUTCDATE());
    END

    -- Sample Vendor
    IF NOT EXISTS (SELECT 1 FROM InventoryVendors WHERE TenantId = @ApexTenantId AND VendorName = 'Apex Stationers & Uniform Suppliers')
    BEGIN
        INSERT INTO InventoryVendors (Id, TenantId, VendorName, ContactPerson, Phone, Email, Address, Gstin, PaymentTerms, IsActive, CreatedAt)
        VALUES (NEWID(), @ApexTenantId, N'Apex Stationers & Uniform Suppliers', N'Rakesh Agarwal', N'9876543210', N'apexsupplies@gmail.com', N'Station Road, Commercial Complex, Sector 4', N'07AAAAA0000A1Z5', N'Net 30 Days', 1, GETUTCDATE());
    END

    PRINT 'Seeded sample items & vendor for Apex tenant.';
END

-- -----------------------------------------------------------------------------------------
-- 11. Seed Menu Item in MenuItems table
-- -----------------------------------------------------------------------------------------
DECLARE @InventoryMenuId UNIQUEIDENTIFIER = 'E0000000-0000-0000-0000-000000000001';

IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE Id = @InventoryMenuId OR RouteUrl = '/inventory')
BEGIN
    INSERT INTO MenuItems (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module, IsActive)
    VALUES (
        @InventoryMenuId,
        N'Stock & Inventory',
        N'/inventory',
        N'inventory_2',
        NULL,
        9,
        N'Inventory',
        1
    );
    PRINT 'Inserted /inventory into MenuItems.';
END
ELSE
BEGIN
    UPDATE MenuItems
    SET Title = N'Stock & Inventory',
        Icon = N'inventory_2',
        ParentId = NULL,
        SortOrder = 9,
        Module = N'Inventory',
        IsActive = 1
    WHERE RouteUrl = '/inventory';
    PRINT 'Updated existing /inventory MenuItem.';
END

-- -----------------------------------------------------------------------------------------
-- 12. Configure Role Permissions in RolePermissions table for ALL roles
-- -----------------------------------------------------------------------------------------
DECLARE @ActualInventoryMenuId UNIQUEIDENTIFIER;
SELECT TOP 1 @ActualInventoryMenuId = Id FROM MenuItems WHERE RouteUrl = '/inventory';

-- For SuperAdmin, Institute Admin, Branch Manager, HR, Accountant, Store Incharge:
-- Full Access (CanView = 1, CanCreate = 1, CanEdit = 1, CanDelete = 1)
-- For Teachers: View only (CanView = 1, CanCreate = 0, CanEdit = 0, CanDelete = 0)
-- For Students/Parents: No direct access (CanView = 0)
INSERT INTO RolePermissions (Id, RoleId, MenuItemId, CanView, CanCreate, CanEdit, CanDelete)
SELECT 
    NEWID(),
    r.Id,
    @ActualInventoryMenuId,
    CASE 
        WHEN LOWER(r.Name) LIKE '%student%' OR LOWER(r.Name) LIKE '%parent%' THEN 0 
        ELSE 1 
    END AS CanView,
    CASE 
        WHEN LOWER(r.Name) LIKE '%admin%' OR LOWER(r.Name) LIKE '%manager%' OR LOWER(r.Name) LIKE '%accountant%' OR LOWER(r.Name) LIKE '%store%' OR LOWER(r.Name) LIKE '%staff%' THEN 1 
        ELSE 0 
    END AS CanCreate,
    CASE 
        WHEN LOWER(r.Name) LIKE '%admin%' OR LOWER(r.Name) LIKE '%manager%' OR LOWER(r.Name) LIKE '%store%' THEN 1 
        ELSE 0 
    END AS CanEdit,
    CASE 
        WHEN LOWER(r.Name) LIKE '%admin%' THEN 1 
        ELSE 0 
    END AS CanDelete
FROM Roles r
WHERE NOT EXISTS (
    SELECT 1 FROM RolePermissions rp 
    WHERE rp.RoleId = r.Id AND rp.MenuItemId = @ActualInventoryMenuId
);

PRINT 'Seeded RolePermissions for /inventory.';
