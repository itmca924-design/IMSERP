-- =========================================================================
-- IMSERP: Add Day Book to MenuItems & Configure Role Permissions
-- Multi-Tenant & Multi-Branch Architecture
-- =========================================================================
USE [IMSERP];
GO

SET NOCOUNT ON;

PRINT '>> Registering Day Book in MenuItems...';

DECLARE @FinanceParentId UNIQUEIDENTIFIER = '5C2B386E-C08A-4846-858B-7B38ED07B427';
DECLARE @DayBookMenuId UNIQUEIDENTIFIER;

-- Verify or create Finance Parent Menu
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = @FinanceParentId)
BEGIN
    SELECT TOP 1 @FinanceParentId = [Id] FROM [dbo].[MenuItems] WHERE [Title] = 'Finance & Accounts' AND [ParentId] IS NULL;
    IF @FinanceParentId IS NULL
    BEGIN
        SET @FinanceParentId = NEWID();
        INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
        VALUES (@FinanceParentId, 'Finance & Accounts', NULL, 'account_balance', NULL, 7, 'Finance', 1);
        PRINT '  + Created Finance & Accounts parent menu.';
    END
END

-- Check if Day Book menu already exists
SELECT TOP 1 @DayBookMenuId = [Id] FROM [dbo].[MenuItems] WHERE [RouteUrl] = '/finance/day-book';

IF @DayBookMenuId IS NULL
BEGIN
    SET @DayBookMenuId = NEWID();
    INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
    VALUES (@DayBookMenuId, 'Day Book', '/finance/day-book', 'auto_stories', @FinanceParentId, 3, 'Finance', 1);
    PRINT '  + Added Day Book to MenuItems.';
END
ELSE
BEGIN
    UPDATE [dbo].[MenuItems]
    SET [Title] = 'Day Book',
        [ParentId] = @FinanceParentId,
        [SortOrder] = 3,
        [Icon] = 'auto_stories',
        [Module] = 'Finance',
        [IsActive] = 1
    WHERE [Id] = @DayBookMenuId;
    PRINT '  + Updated Day Book in MenuItems.';
END

-- Order other finance submenus cleanly
UPDATE [dbo].[MenuItems] SET [SortOrder] = 1 WHERE [RouteUrl] = '/finance/profit-loss';
UPDATE [dbo].[MenuItems] SET [SortOrder] = 2 WHERE [RouteUrl] = '/finance/balance-sheet';
UPDATE [dbo].[MenuItems] SET [SortOrder] = 3 WHERE [RouteUrl] = '/finance/day-book';
UPDATE [dbo].[MenuItems] SET [SortOrder] = 4 WHERE [RouteUrl] = '/finance/expenses';
UPDATE [dbo].[MenuItems] SET [SortOrder] = 5 WHERE [RouteUrl] = '/finance/chart-of-accounts';

PRINT '>> Granting Day Book permissions to Admin, Accountant, and Branch Manager roles...';

-- 1. Grant Day Book child permission
INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
SELECT NEWID(), r.[Id], @DayBookMenuId, 1, 1, 1, 1
FROM [dbo].[Roles] r
WHERE (
    r.[Name] LIKE '%Admin%' OR
    r.[Name] LIKE '%Accountant%' OR
    r.[Name] LIKE '%Branch Manager%' OR
    r.[Name] LIKE '%Cashier%'
)
AND NOT EXISTS (
    SELECT 1 FROM [dbo].[RolePermissions] rp
    WHERE rp.[RoleId] = r.[Id] AND rp.[MenuItemId] = @DayBookMenuId
);

-- 2. Ensure Finance & Accounts Parent Menu has CanView permission
INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
SELECT NEWID(), r.[Id], @FinanceParentId, 1, 1, 1, 1
FROM [dbo].[Roles] r
WHERE (
    r.[Name] LIKE '%Admin%' OR
    r.[Name] LIKE '%Accountant%' OR
    r.[Name] LIKE '%Branch Manager%' OR
    r.[Name] LIKE '%Cashier%'
)
AND NOT EXISTS (
    SELECT 1 FROM [dbo].[RolePermissions] rp
    WHERE rp.[RoleId] = r.[Id] AND rp.[MenuItemId] = @FinanceParentId
);

PRINT '>> Verification:';
SELECT m.Id, m.Title, m.RouteUrl, m.SortOrder, COUNT(rp.Id) AS AllowedRolesCount
FROM [dbo].[MenuItems] m
LEFT JOIN [dbo].[RolePermissions] rp ON rp.MenuItemId = m.Id
WHERE m.RouteUrl LIKE '%finance%' OR m.Id = @FinanceParentId
GROUP BY m.Id, m.Title, m.RouteUrl, m.SortOrder
ORDER BY m.SortOrder;

PRINT '>> Day Book Menu & Permissions registration complete.';
GO
