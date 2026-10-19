-- =========================================================================================
-- IMSERP - Automated Fee Concession & Sibling Discount Engine: Tables, Columns & Menu Seeding
-- =========================================================================================

SET NOCOUNT ON;

-- 1. Add Concession Columns to FeeInvoices Table if not exists
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeeInvoices') AND name = 'ConcessionAmount')
BEGIN
    ALTER TABLE FeeInvoices ADD [ConcessionAmount] DECIMAL(18, 2) NOT NULL DEFAULT 0;
    PRINT 'Added ConcessionAmount column to FeeInvoices.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeeInvoices') AND name = 'ConcessionReason')
BEGIN
    ALTER TABLE FeeInvoices ADD [ConcessionReason] NVARCHAR(255) NULL;
    PRINT 'Added ConcessionReason column to FeeInvoices.';
END

-- 2. Create StudentFeeConcessions Table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StudentFeeConcessions')
BEGIN
    CREATE TABLE StudentFeeConcessions (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [BranchId] UNIQUEIDENTIFIER NULL,
        [StudentId] UNIQUEIDENTIFIER NOT NULL,
        [ConcessionType] NVARCHAR(50) NOT NULL, -- SiblingDiscount, MeritScholarship, StaffWard, EWS_RTE, SportsQuota, SpecialManagement
        [Title] NVARCHAR(150) NOT NULL,
        [DiscountMode] NVARCHAR(20) NOT NULL DEFAULT 'Percentage', -- Percentage, FixedAmount
        [DiscountValue] DECIMAL(18, 2) NOT NULL DEFAULT 0,
        [FeeHeadId] UNIQUEIDENTIFIER NULL,
        [ApplicableFrom] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [ApplicableTo] DATETIME2 NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT 'Active', -- Active, Suspended, Expired
        [ApprovedBy] NVARCHAR(100) NULL,
        [Remarks] NVARCHAR(255) NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_StudentFeeConcessions_Students FOREIGN KEY ([StudentId]) REFERENCES Students([Id]) ON DELETE CASCADE,
        CONSTRAINT FK_StudentFeeConcessions_Branches FOREIGN KEY ([BranchId]) REFERENCES Branches([Id]) ON DELETE NO ACTION,
        CONSTRAINT FK_StudentFeeConcessions_FeeHeads FOREIGN KEY ([FeeHeadId]) REFERENCES FeeHeads([Id]) ON DELETE SET NULL
    );

    CREATE INDEX IX_StudentFeeConcessions_Tenant_Student ON StudentFeeConcessions([TenantId], [StudentId]);
    CREATE INDEX IX_StudentFeeConcessions_Tenant_Status ON StudentFeeConcessions([TenantId], [Status]);
    PRINT 'Created StudentFeeConcessions table.';
END

-- 3. Seed Menu Item for Fee Concessions & Discounts
DECLARE @ConcessionMenuId UNIQUEIDENTIFIER = 'FEE00000-0000-0000-0000-0000000000FD';
DECLARE @AcademicOpsParentId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000004';

IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE Id = @ConcessionMenuId)
BEGIN
    INSERT INTO MenuItems ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
    VALUES (@ConcessionMenuId, 'Fee Concessions & Discounts', '/fees/concessions', 'card_giftcard', @AcademicOpsParentId, 3, 'Fee', 1);
    PRINT 'Seeded Fee Concessions menu item.';
END
ELSE
BEGIN
    UPDATE MenuItems
    SET [Title] = 'Fee Concessions & Discounts',
        [RouteUrl] = '/fees/concessions',
        [Icon] = 'card_giftcard',
        [ParentId] = @AcademicOpsParentId,
        [SortOrder] = 3,
        [Module] = 'Fee',
        [IsActive] = 1
    WHERE Id = @ConcessionMenuId;
    PRINT 'Updated Fee Concessions menu item.';
END

-- 4. Grant Permissions to SuperAdmin and InstituteAdmin Roles
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RoleMenuPermissions')
BEGIN
    INSERT INTO RoleMenuPermissions ([Id], [RoleId], [MenuItemId], [CreatedAt])
    SELECT NEWID(), r.[Id], @ConcessionMenuId, GETUTCDATE()
    FROM Roles r
    WHERE r.[Name] IN ('SuperAdmin', 'InstituteAdmin', 'Admin', 'Principal')
      AND NOT EXISTS (
          SELECT 1 FROM RoleMenuPermissions rmp 
          WHERE rmp.[RoleId] = r.[Id] AND rmp.[MenuItemId] = @ConcessionMenuId
      );
    PRINT 'Granted permissions for Fee Concessions menu item.';
END

PRINT 'Fee Concessions migration completed successfully.';
