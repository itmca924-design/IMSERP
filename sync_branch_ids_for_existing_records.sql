-- ============================================================================
-- SQL Script: Sync & Backfill BranchId for all Existing Records in IMSERP
-- Database: IMSERP
-- Safe & Idempotent: Can be run multiple times safely
-- ============================================================================

USE [IMSERP];
GO

SET NOCOUNT ON;

PRINT 'Starting BranchId synchronization for all operational tables...';

-- 1. Ensure Batches have BranchId (fallback to Tenant Main Branch)
UPDATE b
SET b.BranchId = br.Id
FROM [dbo].[Batches] b
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] 
    WHERE [TenantId] = b.[TenantId] 
    ORDER BY [IsMainBranch] DESC, [CreatedAt] ASC
) br
WHERE b.[BranchId] IS NULL;
PRINT '1. Batches BranchId synced: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));

-- 2. Sync Students BranchId from their assigned Batch (or Tenant Main Branch)
UPDATE s
SET s.BranchId = COALESCE(b.BranchId, br.Id)
FROM [dbo].[Students] s
LEFT JOIN [dbo].[Batches] b ON b.Id = s.BatchId
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] 
    WHERE [TenantId] = s.[TenantId] 
    ORDER BY [IsMainBranch] DESC, [CreatedAt] ASC
) br
WHERE s.[BranchId] IS NULL;
PRINT '2. Students BranchId synced: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));

-- 3. Sync Teachers BranchId (from assigned batch branch, or Tenant Main Branch)
UPDATE t
SET t.BranchId = COALESCE(assignedBranch.BranchId, br.Id)
FROM [dbo].[Teachers] t
OUTER APPLY (
    SELECT TOP 1 b.BranchId
    FROM [dbo].[TeacherBatchAssignments] a
    INNER JOIN [dbo].[Batches] b ON b.Id = a.BatchId
    WHERE a.TeacherId = t.Id AND b.BranchId IS NOT NULL
) assignedBranch
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] 
    WHERE [TenantId] = t.[TenantId] 
    ORDER BY [IsMainBranch] DESC, [CreatedAt] ASC
) br
WHERE t.[BranchId] IS NULL;
PRINT '3. Teachers BranchId synced: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));

-- 4. Sync Rooms BranchId (fallback to Tenant Main Branch)
UPDATE r
SET r.BranchId = br.Id
FROM [dbo].[Rooms] r
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] 
    WHERE [TenantId] = r.[TenantId] 
    ORDER BY [IsMainBranch] DESC, [CreatedAt] ASC
) br
WHERE r.[BranchId] IS NULL;
PRINT '4. Rooms BranchId synced: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));

-- 5. Sync StudentAttendances BranchId from Students
UPDATE sa
SET sa.BranchId = COALESCE(s.BranchId, br.Id)
FROM [dbo].[StudentAttendances] sa
LEFT JOIN [dbo].[Students] s ON s.Id = sa.StudentId
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] 
    WHERE [TenantId] = sa.[TenantId] 
    ORDER BY [IsMainBranch] DESC, [CreatedAt] ASC
) br
WHERE sa.[BranchId] IS NULL;
PRINT '5. StudentAttendances BranchId synced: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));

-- 6. Sync TeacherAttendances BranchId from Teachers
UPDATE ta
SET ta.BranchId = COALESCE(t.BranchId, br.Id)
FROM [dbo].[TeacherAttendances] ta
LEFT JOIN [dbo].[Teachers] t ON t.Id = ta.TeacherId
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] 
    WHERE [TenantId] = ta.[TenantId] 
    ORDER BY [IsMainBranch] DESC, [CreatedAt] ASC
) br
WHERE ta.[BranchId] IS NULL;
PRINT '6. TeacherAttendances BranchId synced: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));

-- 7. Sync FeeInvoices BranchId from Students
UPDATE fi
SET fi.BranchId = COALESCE(s.BranchId, br.Id)
FROM [dbo].[FeeInvoices] fi
LEFT JOIN [dbo].[Students] s ON s.Id = fi.StudentId
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] 
    WHERE [TenantId] = fi.[TenantId] 
    ORDER BY [IsMainBranch] DESC, [CreatedAt] ASC
) br
WHERE fi.[BranchId] IS NULL;
PRINT '7. FeeInvoices BranchId synced: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));

-- 8. Sync FeePayments BranchId from FeeInvoices
UPDATE fp
SET fp.BranchId = COALESCE(fi.BranchId, br.Id)
FROM [dbo].[FeePayments] fp
LEFT JOIN [dbo].[FeeInvoices] fi ON fi.Id = fp.InvoiceId
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] 
    WHERE [TenantId] = fp.[TenantId] 
    ORDER BY [IsMainBranch] DESC, [CreatedAt] ASC
) br
WHERE fp.[BranchId] IS NULL;
PRINT '8. FeePayments BranchId synced: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));

-- 9. Sync Tests BranchId from Batches
UPDATE tst
SET tst.BranchId = COALESCE(b.BranchId, br.Id)
FROM [dbo].[Tests] tst
LEFT JOIN [dbo].[Batches] b ON b.Id = tst.BatchId
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] 
    WHERE [TenantId] = tst.[TenantId] 
    ORDER BY [IsMainBranch] DESC, [CreatedAt] ASC
) br
WHERE tst.[BranchId] IS NULL;
PRINT '9. Tests BranchId synced: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));

-- 10. Sync BiometricDevices BranchId (fallback to Tenant Main Branch)
UPDATE bd
SET bd.BranchId = br.Id
FROM [dbo].[BiometricDevices] bd
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] 
    WHERE [TenantId] = bd.[TenantId] 
    ORDER BY [IsMainBranch] DESC, [CreatedAt] ASC
) br
WHERE bd.[BranchId] IS NULL;
PRINT '10. BiometricDevices BranchId synced: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));

-- 11. Sync AttendanceSettings BranchId (fallback to Tenant Main Branch)
UPDATE ast
SET ast.BranchId = br.Id
FROM [dbo].[AttendanceSettings] ast
CROSS APPLY (
    SELECT TOP 1 [Id] FROM [dbo].[Branches] 
    WHERE [TenantId] = ast.[TenantId] 
    ORDER BY [IsMainBranch] DESC, [CreatedAt] ASC
) br
WHERE ast.[BranchId] IS NULL;
PRINT '11. AttendanceSettings BranchId synced: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));

PRINT '============================================================================';
PRINT 'All existing NULL BranchId records have been successfully synchronized!';
PRINT '============================================================================';
GO
