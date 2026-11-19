-- =============================================================================
-- IMSERP - Dedicated "Coaching Operations (कोचिंग प्रबंधन)" Module
-- MenuItems and RolePermissions Seed / Migration Script
-- =============================================================================

USE IMSERP;
BEGIN TRANSACTION;

-- 1. Ensure Parent 'Coaching Operations' exists with Module = 'Coaching', ParentId = NULL, TenantId = NULL
DECLARE @ParentId UNIQUEIDENTIFIER;

SELECT TOP 1 @ParentId = Id FROM MenuItems 
WHERE Module = 'Coaching' AND ParentId IS NULL;

IF @ParentId IS NULL
BEGIN
    SET @ParentId = NEWID();
    INSERT INTO MenuItems (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module, IsActive, TenantId, BranchId)
    VALUES (@ParentId, 'Coaching Operations', NULL, 'model_training', NULL, 6, 'Coaching', 1, NULL, NULL);
END
ELSE
BEGIN
    UPDATE MenuItems 
    SET Title = 'Coaching Operations',
        RouteUrl = NULL,
        Icon = 'model_training',
        ParentId = NULL,
        SortOrder = 6,
        Module = 'Coaching',
        IsActive = 1,
        TenantId = NULL
    WHERE Id = @ParentId;
END

-- 2. Define all 9 child items
DECLARE @Children TABLE (
    Title NVARCHAR(150),
    RouteUrl NVARCHAR(250),
    Icon NVARCHAR(100),
    SortOrder INT,
    Module NVARCHAR(100)
);

INSERT INTO @Children (Title, RouteUrl, Icon, SortOrder, Module) VALUES
('Batches & Courses', '/batches', 'category', 1, 'Coaching'),
('Student Batch Allocation', '/coaching/batch-allocation', 'group_add', 2, 'Coaching'),
('Batch Daily Attendance', '/coaching/attendance', 'fact_check', 3, 'Coaching'),
('Tests & Test Series', '/tests', 'quiz', 4, 'Coaching'),
('DPP & Study Material', '/study-materials', 'auto_stories', 5, 'Coaching'),
('Batch Timetable & Routine', '/coaching/timetable', 'calendar_view_week', 6, 'Coaching'),
('Coaching Student ID Cards', '/coaching/id-cards', 'badge', 7, 'Coaching'),
('Batch Fee Vouchers & Dues', '/coaching/fee-vouchers', 'receipt_long', 8, 'Coaching'),
('Coaching Analytics & Reports', '/coaching/analytics', 'insights', 9, 'Coaching');

-- 3. Upsert children
DECLARE @Title NVARCHAR(150), @RouteUrl NVARCHAR(250), @Icon NVARCHAR(100), @SortOrder INT, @Module NVARCHAR(100);
DECLARE @ChildId UNIQUEIDENTIFIER;

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR 
    SELECT Title, RouteUrl, Icon, SortOrder, Module FROM @Children;

OPEN cur;
FETCH NEXT FROM cur INTO @Title, @RouteUrl, @Icon, @SortOrder, @Module;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @ChildId = NULL;
    SELECT TOP 1 @ChildId = Id FROM MenuItems WHERE RouteUrl = @RouteUrl;

    IF @ChildId IS NULL
    BEGIN
        SET @ChildId = NEWID();
        INSERT INTO MenuItems (Id, ParentId, Title, RouteUrl, Icon, SortOrder, Module, IsActive, TenantId, BranchId)
        VALUES (@ChildId, @ParentId, @Title, @RouteUrl, @Icon, @SortOrder, @Module, 1, NULL, NULL);
    END
    ELSE
    BEGIN
        UPDATE MenuItems 
        SET ParentId = @ParentId,
            Title = @Title,
            Icon = @Icon,
            SortOrder = @SortOrder,
            Module = @Module,
            IsActive = 1,
            TenantId = NULL
        WHERE Id = @ChildId;
    END

    -- Seed default RolePermissions for Admin / SuperAdmin roles (Full Access)
    INSERT INTO RolePermissions (Id, RoleId, MenuItemId, CanView, CanCreate, CanEdit, CanDelete)
    SELECT NEWID(), r.Id, @ChildId, 1, 1, 1, 1
    FROM Roles r
    WHERE (r.Name IN ('SuperAdmin', 'Super Admin', 'Admin', 'Institute Admin', 'InstituteAdmin', 'Principal', 'Director') OR r.Name LIKE '%Admin%')
      AND NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.MenuItemId = @ChildId);

    -- Seed default RolePermissions for Teacher / Faculty (View + Create + Edit on Attendance & Study Material & Tests; No Fee Vouchers edit)
    INSERT INTO RolePermissions (Id, RoleId, MenuItemId, CanView, CanCreate, CanEdit, CanDelete)
    SELECT NEWID(), r.Id, @ChildId, 1, 
           CASE WHEN @RouteUrl = '/coaching/fee-vouchers' THEN 0 ELSE 1 END,
           CASE WHEN @RouteUrl = '/coaching/fee-vouchers' THEN 0 ELSE 1 END,
           CASE WHEN @RouteUrl = '/coaching/fee-vouchers' THEN 0 ELSE 1 END
    FROM Roles r
    WHERE (r.Name LIKE '%Teacher%' OR r.Name LIKE '%Faculty%')
      AND NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.MenuItemId = @ChildId);

    -- Seed default RolePermissions for Accountant (CanView + Create/Edit on Fee Vouchers, CanView on Batches & Analytics)
    INSERT INTO RolePermissions (Id, RoleId, MenuItemId, CanView, CanCreate, CanEdit, CanDelete)
    SELECT NEWID(), r.Id, @ChildId, 
           CASE WHEN @RouteUrl IN ('/batches', '/coaching/fee-vouchers', '/coaching/analytics') THEN 1 ELSE 0 END,
           CASE WHEN @RouteUrl = '/coaching/fee-vouchers' THEN 1 ELSE 0 END,
           CASE WHEN @RouteUrl = '/coaching/fee-vouchers' THEN 1 ELSE 0 END,
           0
    FROM Roles r
    WHERE (r.Name LIKE '%Account%')
      AND NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.MenuItemId = @ChildId);

    -- Seed default RolePermissions for other roles (hidden / 0)
    INSERT INTO RolePermissions (Id, RoleId, MenuItemId, CanView, CanCreate, CanEdit, CanDelete)
    SELECT NEWID(), r.Id, @ChildId, 0, 0, 0, 0
    FROM Roles r
    WHERE NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.MenuItemId = @ChildId);

    FETCH NEXT FROM cur INTO @Title, @RouteUrl, @Icon, @SortOrder, @Module;
END

CLOSE cur;
DEALLOCATE cur;

-- Also ensure RolePermissions for ParentId itself exists for all roles so parent can be viewed
INSERT INTO RolePermissions (Id, RoleId, MenuItemId, CanView, CanCreate, CanEdit, CanDelete)
SELECT NEWID(), r.Id, @ParentId, 1, 1, 1, 1
FROM Roles r
WHERE (r.Name IN ('SuperAdmin', 'Super Admin', 'Admin', 'Institute Admin', 'InstituteAdmin', 'Principal', 'Director') OR r.Name LIKE '%Admin%')
  AND NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.MenuItemId = @ParentId);

INSERT INTO RolePermissions (Id, RoleId, MenuItemId, CanView, CanCreate, CanEdit, CanDelete)
SELECT NEWID(), r.Id, @ParentId, 1, 0, 0, 0
FROM Roles r
WHERE (r.Name LIKE '%Teacher%' OR r.Name LIKE '%Faculty%' OR r.Name LIKE '%Account%')
  AND NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.MenuItemId = @ParentId);

INSERT INTO RolePermissions (Id, RoleId, MenuItemId, CanView, CanCreate, CanEdit, CanDelete)
SELECT NEWID(), r.Id, @ParentId, 0, 0, 0, 0
FROM Roles r
WHERE NOT EXISTS (SELECT 1 FROM RolePermissions rp WHERE rp.RoleId = r.Id AND rp.MenuItemId = @ParentId);

COMMIT TRANSACTION;
