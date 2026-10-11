-- =========================================================================
-- Add 'My Fee Ledger & Receipts' MenuItem and reconfigure Parent/Student permissions
-- =========================================================================
SET NOCOUNT ON;

DECLARE @MyFeesMenuId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-00000000004F';
DECLARE @AcademicParentMenuId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000004';
DECLARE @FeesAdminMenuId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000041';

-- 1. Ensure MenuItem exists in MenuItems table
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = @MyFeesMenuId)
BEGIN
    INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
    VALUES (
        @MyFeesMenuId,
        'My Fee Ledger & Receipts',
        '/my-fees',
        'receipt_long',
        @AcademicParentMenuId,
        1,
        'Academic',
        1
    );
    PRINT 'Created MenuItem: My Fee Ledger & Receipts (/my-fees)';
END
ELSE
BEGIN
    UPDATE [dbo].[MenuItems]
    SET [Title] = 'My Fee Ledger & Receipts',
        [RouteUrl] = '/my-fees',
        [Icon] = 'receipt_long',
        [ParentId] = @AcademicParentMenuId,
        [SortOrder] = 1,
        [Module] = 'Academic',
        [IsActive] = 1
    WHERE [Id] = @MyFeesMenuId;
    PRINT 'Updated MenuItem: My Fee Ledger & Receipts (/my-fees)';
END

-- 2. Remove /fees (Admin Fee Collection Desk) permission from Parent and Student roles across all tenants
DELETE rp
FROM [dbo].[RolePermissions] rp
INNER JOIN [dbo].[Roles] r ON rp.[RoleId] = r.[Id]
INNER JOIN [dbo].[MenuItems] m ON rp.[MenuItemId] = m.[Id]
WHERE (LOWER(r.[Name]) LIKE '%parent%' OR LOWER(r.[Name]) LIKE '%student%')
  AND (m.[RouteUrl] = '/fees' OR rp.[MenuItemId] = @FeesAdminMenuId);

PRINT 'Removed /fees permission from Parent and Student roles.';

-- 3. Grant /my-fees (Read-only) to Parent and Student roles across all tenants
INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
SELECT 
    NEWID(),
    r.[Id],
    @MyFeesMenuId,
    1, -- CanView
    0, -- CanCreate
    0, -- CanEdit
    0  -- CanDelete
FROM [dbo].[Roles] r
WHERE (LOWER(r.[Name]) LIKE '%parent%' OR LOWER(r.[Name]) LIKE '%student%')
  AND NOT EXISTS (
      SELECT 1 FROM [dbo].[RolePermissions] rp
      WHERE rp.[RoleId] = r.[Id] AND rp.[MenuItemId] = @MyFeesMenuId
  );

PRINT 'Granted /my-fees permission to Parent and Student roles.';

-- 4. Also grant /my-fees (CanView = 1) to Admins and Accountants so they can preview it if needed
INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
SELECT 
    NEWID(),
    r.[Id],
    @MyFeesMenuId,
    1,
    0,
    0,
    0
FROM [dbo].[Roles] r
WHERE (LOWER(r.[Name]) LIKE '%admin%' OR LOWER(r.[Name]) LIKE '%accountant%')
  AND NOT EXISTS (
      SELECT 1 FROM [dbo].[RolePermissions] rp
      WHERE rp.[RoleId] = r.[Id] AND rp.[MenuItemId] = @MyFeesMenuId
  );

PRINT 'Granted /my-fees permission to Admin and Accountant roles.';
GO
