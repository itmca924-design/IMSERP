-- Adds biometric mapping, capture metadata, and tenant-level attendance modes.
-- Run once after the existing attendance tables have been created.

IF COL_LENGTH('dbo.Students', 'BiometricUserId') IS NULL
    ALTER TABLE [dbo].[Students] ADD [BiometricUserId] NVARCHAR(100) NULL;

IF COL_LENGTH('dbo.Teachers', 'BiometricUserId') IS NULL
    ALTER TABLE [dbo].[Teachers] ADD [BiometricUserId] NVARCHAR(100) NULL;

IF COL_LENGTH('dbo.StudentAttendances', 'CaptureSource') IS NULL
BEGIN
    ALTER TABLE [dbo].[StudentAttendances] ADD [CaptureSource] NVARCHAR(20) NOT NULL CONSTRAINT [DF_StudentAttendances_CaptureSource] DEFAULT ('Manual');
    ALTER TABLE [dbo].[StudentAttendances] ADD [BiometricDeviceId] NVARCHAR(100) NULL, [BiometricEventId] NVARCHAR(150) NULL, [CapturedAt] DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.TeacherAttendances', 'CaptureSource') IS NULL
BEGIN
    ALTER TABLE [dbo].[TeacherAttendances] ADD [CaptureSource] NVARCHAR(20) NOT NULL CONSTRAINT [DF_TeacherAttendances_CaptureSource] DEFAULT ('Manual');
    ALTER TABLE [dbo].[TeacherAttendances] ADD [BiometricDeviceId] NVARCHAR(100) NULL, [BiometricEventId] NVARCHAR(150) NULL, [CapturedAt] DATETIME2 NULL;
END;

IF OBJECT_ID(N'[dbo].[AttendanceSettings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AttendanceSettings]
    (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_AttendanceSettings] PRIMARY KEY,
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [StudentMode] NVARCHAR(20) NOT NULL CONSTRAINT [DF_AttendanceSettings_StudentMode] DEFAULT ('Both'),
        [TeacherMode] NVARCHAR(20) NOT NULL CONSTRAINT [DF_AttendanceSettings_TeacherMode] DEFAULT ('Both'),
        [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_AttendanceSettings_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_AttendanceSettings_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id])
    );
    CREATE UNIQUE INDEX [IX_AttendanceSettings_TenantId] ON [dbo].[AttendanceSettings] ([TenantId]);
END;

INSERT INTO [dbo].[AttendanceSettings] ([Id], [TenantId], [StudentMode], [TeacherMode])
SELECT NEWID(), [Id], 'Both', 'Both'
FROM [dbo].[Tenants] t
WHERE NOT EXISTS (SELECT 1 FROM [dbo].[AttendanceSettings] s WHERE s.[TenantId] = t.[Id]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Students_Tenant_BiometricUserId' AND object_id = OBJECT_ID(N'[dbo].[Students]'))
    EXEC(N'CREATE UNIQUE INDEX [UX_Students_Tenant_BiometricUserId] ON [dbo].[Students] ([TenantId], [BiometricUserId]) WHERE [BiometricUserId] IS NOT NULL');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Teachers_Tenant_BiometricUserId' AND object_id = OBJECT_ID(N'[dbo].[Teachers]'))
    EXEC(N'CREATE UNIQUE INDEX [UX_Teachers_Tenant_BiometricUserId] ON [dbo].[Teachers] ([TenantId], [BiometricUserId]) WHERE [BiometricUserId] IS NOT NULL');

PRINT 'Biometric attendance schema is ready. Default mode is Both.';