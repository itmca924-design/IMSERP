-- ============================================================================
-- SQL Script: Add Dedicated "Attendance Management" Module in IMSERP
-- Includes: Student Attendance, Teacher Attendance, Attendance Reports, Biometric Devices
-- Safe & Idempotent: Can be run multiple times safely without duplicates
-- ============================================================================

USE [IMSERP];
GO

SET NOCOUNT ON;

DECLARE @AttendanceParentId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000030';
DECLARE @StudentAttendanceId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000031';
DECLARE @TeacherAttendanceId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000032';
DECLARE @AttendanceReportsId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000033';
DECLARE @BiometricDevicesId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000025';

PRINT 'Step 1: Configuring Attendance Management parent menu...';

-- 1. Insert or Update Parent: 'Attendance Management'
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = @AttendanceParentId OR ([Title] = 'Attendance Management' AND [ParentId] IS NULL))
BEGIN
    INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
    VALUES (@AttendanceParentId, N'Attendance Management', NULL, N'event_available', NULL, 3, N'Attendance', 1);
    PRINT 'Attendance Management parent menu inserted.';
END
ELSE
BEGIN
    SELECT TOP 1 @AttendanceParentId = [Id] 
    FROM [dbo].[MenuItems] 
    WHERE [Id] = @AttendanceParentId OR ([Title] = 'Attendance Management' AND [ParentId] IS NULL);

    UPDATE [dbo].[MenuItems]
    SET [Title] = N'Attendance Management',
        [Icon] = N'event_available',
        [SortOrder] = 3,
        [Module] = N'Attendance',
        [IsActive] = 1
    WHERE [Id] = @AttendanceParentId;
    PRINT 'Attendance Management parent menu updated.';
END

PRINT 'Step 2: Configuring sub-menus under Attendance Management...';

-- 2. Sub-Item 1: Student Attendance (/students/attendance)
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = @StudentAttendanceId OR [RouteUrl] = '/students/attendance')
BEGIN
    INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
    VALUES (@StudentAttendanceId, N'Student Attendance', N'/students/attendance', N'how_to_reg', @AttendanceParentId, 1, N'Attendance', 1);
    PRINT 'Student Attendance menu inserted.';
END
ELSE
BEGIN
    UPDATE [dbo].[MenuItems]
    SET [Title] = N'Student Attendance',
        [RouteUrl] = N'/students/attendance',
        [Icon] = N'how_to_reg',
        [ParentId] = @AttendanceParentId,
        [SortOrder] = 1,
        [Module] = N'Attendance',
        [IsActive] = 1
    WHERE [Id] = @StudentAttendanceId OR [RouteUrl] = '/students/attendance';
    PRINT 'Student Attendance menu updated.';
END

-- 3. Sub-Item 2: Teacher Attendance (/teachers/attendance)
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = @TeacherAttendanceId OR [RouteUrl] = '/teachers/attendance')
BEGIN
    INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
    VALUES (@TeacherAttendanceId, N'Teacher Attendance', N'/teachers/attendance', N'co_present', @AttendanceParentId, 2, N'Attendance', 1);
    PRINT 'Teacher Attendance menu inserted.';
END
ELSE
BEGIN
    UPDATE [dbo].[MenuItems]
    SET [Title] = N'Teacher Attendance',
        [RouteUrl] = N'/teachers/attendance',
        [Icon] = N'co_present',
        [ParentId] = @AttendanceParentId,
        [SortOrder] = 2,
        [Module] = N'Attendance',
        [IsActive] = 1
    WHERE [Id] = @TeacherAttendanceId OR [RouteUrl] = '/teachers/attendance';
    PRINT 'Teacher Attendance menu updated.';
END

-- 4. Sub-Item 3: Attendance Reports (/attendance/reports)
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = @AttendanceReportsId OR [RouteUrl] = '/attendance/reports')
BEGIN
    INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
    VALUES (@AttendanceReportsId, N'Attendance Reports', N'/attendance/reports', N'summarize', @AttendanceParentId, 3, N'Attendance', 1);
    PRINT 'Attendance Reports menu inserted.';
END
ELSE
BEGIN
    UPDATE [dbo].[MenuItems]
    SET [Title] = N'Attendance Reports',
        [RouteUrl] = N'/attendance/reports',
        [Icon] = N'summarize',
        [ParentId] = @AttendanceParentId,
        [SortOrder] = 3,
        [Module] = N'Attendance',
        [IsActive] = 1
    WHERE [Id] = @AttendanceReportsId OR [RouteUrl] = '/attendance/reports';
    PRINT 'Attendance Reports menu updated.';
END

-- 5. Sub-Item 4: Biometric Devices (/attendance/devices)
IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = @BiometricDevicesId OR [RouteUrl] = '/attendance/devices')
BEGIN
    INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
    VALUES (@BiometricDevicesId, N'Biometric Devices', N'/attendance/devices', N'fingerprint', @AttendanceParentId, 4, N'Attendance', 1);
    PRINT 'Biometric Devices menu inserted.';
END
ELSE
BEGIN
    UPDATE [dbo].[MenuItems]
    SET [Title] = N'Biometric Devices',
        [RouteUrl] = N'/attendance/devices',
        [Icon] = N'fingerprint',
        [ParentId] = @AttendanceParentId,
        [SortOrder] = 4,
        [Module] = N'Attendance',
        [IsActive] = 1
    WHERE [Id] = @BiometricDevicesId OR [RouteUrl] = '/attendance/devices';
    PRINT 'Biometric Devices menu updated.';
END

PRINT 'Step 3: Granting RolePermissions to Admin/Director roles...';

-- 6. Grant Permissions to all Admin Roles (Institute Admin, Admin, Director, SuperAdmin)
DECLARE @TargetMenuIds TABLE (MenuItemId UNIQUEIDENTIFIER);
INSERT INTO @TargetMenuIds (MenuItemId)
SELECT [Id] FROM [dbo].[MenuItems] 
WHERE [Id] IN (@AttendanceParentId, @StudentAttendanceId, @TeacherAttendanceId, @AttendanceReportsId, @BiometricDevicesId);

INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
SELECT NEWID(), r.[Id], t.MenuItemId, 1, 1, 1, 1
FROM [dbo].[Roles] r
CROSS JOIN @TargetMenuIds t
WHERE (r.[Name] LIKE '%Admin%' OR r.[Name] LIKE '%Director%' OR r.[Name] LIKE '%Super%')
  AND NOT EXISTS (
      SELECT 1 FROM [dbo].[RolePermissions] rp
      WHERE rp.[RoleId] = r.[Id] AND rp.[MenuItemId] = t.MenuItemId
  );

PRINT 'RolePermissions updated successfully for Admin roles.';
PRINT '============================================================================';
PRINT 'Attendance Management module setup completed successfully!';
PRINT '============================================================================';
GO
