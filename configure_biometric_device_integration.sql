-- Adds device registry and biometric event audit storage.
-- Run after configure_biometric_attendance.sql.

USE [IMSERP];
GO

DECLARE @BiometricDevicesMenuId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000025';
DECLARE @AdminRoleId UNIQUEIDENTIFIER = '22222222-1111-1111-1111-111111111111';
DECLARE @AdminSettingsParentId UNIQUEIDENTIFIER = NULL;

-- Resolve the actual Admin Settings parent in this database.
SELECT TOP 1 @AdminSettingsParentId = [Id]
FROM [dbo].[MenuItems]
WHERE [Title] = 'Admin Settings' AND [ParentId] IS NULL AND [IsActive] = 1
ORDER BY CASE WHEN [Id] = '10000000-0000-0000-0000-000000000010' THEN 0 ELSE 1 END;

IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = @BiometricDevicesMenuId)
BEGIN
    INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
    VALUES (@BiometricDevicesMenuId, 'Biometric Devices', '/attendance/devices', 'fingerprint', @AdminSettingsParentId, 3, 'Admin', 1);
END;

IF @AdminSettingsParentId IS NOT NULL
BEGIN
    UPDATE [dbo].[MenuItems]
    SET [ParentId] = @AdminSettingsParentId, [SortOrder] = 3, [Module] = 'Admin', [IsActive] = 1
    WHERE [Id] = @BiometricDevicesMenuId;
END;

IF EXISTS (SELECT 1 FROM [dbo].[Roles] WHERE [Id] = @AdminRoleId)
   AND NOT EXISTS (SELECT 1 FROM [dbo].[RolePermissions] WHERE [RoleId] = @AdminRoleId AND [MenuItemId] = @BiometricDevicesMenuId)
BEGIN
    INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
    VALUES (NEWID(), @AdminRoleId, @BiometricDevicesMenuId, 1, 1, 1, 1);
END;

IF OBJECT_ID(N'[dbo].[BiometricDevices]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[BiometricDevices]
    (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_BiometricDevices] PRIMARY KEY,
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [Name] NVARCHAR(150) NOT NULL,
        [Brand] NVARCHAR(100) NULL,
        [Model] NVARCHAR(100) NULL,
        [SerialNumber] NVARCHAR(100) NULL,
        [IpAddress] NVARCHAR(100) NULL,
        [Port] INT NOT NULL CONSTRAINT [DF_BiometricDevices_Port] DEFAULT (80),
        [ConnectionMode] NVARCHAR(30) NOT NULL CONSTRAINT [DF_BiometricDevices_ConnectionMode] DEFAULT ('PendingAdapter'),
        [IsActive] BIT NOT NULL CONSTRAINT [DF_BiometricDevices_IsActive] DEFAULT (1),
        [Status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_BiometricDevices_Status] DEFAULT ('NotConfigured'),
        [LastSeenAt] DATETIME2 NULL,
        [LastSyncAt] DATETIME2 NULL,
        [LastError] NVARCHAR(1000) NULL,
        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_BiometricDevices_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_BiometricDevices_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id])
    );
    CREATE UNIQUE INDEX [UX_BiometricDevices_Tenant_Serial] ON [dbo].[BiometricDevices] ([TenantId], [SerialNumber]) WHERE [SerialNumber] IS NOT NULL;
END;

IF OBJECT_ID(N'[dbo].[BiometricEventLogs]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[BiometricEventLogs]
    (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_BiometricEventLogs] PRIMARY KEY,
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [DeviceId] UNIQUEIDENTIFIER NULL,
        [PersonType] NVARCHAR(20) NOT NULL,
        [BiometricUserId] NVARCHAR(100) NOT NULL,
        [EventTime] DATETIME2 NOT NULL,
        [DeviceEventId] NVARCHAR(150) NULL,
        [RawPayload] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_BiometricEventLogs_Status] DEFAULT ('Received'),
        [ErrorMessage] NVARCHAR(1000) NULL,
        [AttendanceId] UNIQUEIDENTIFIER NULL,
        [ReceivedAt] DATETIME2 NOT NULL CONSTRAINT [DF_BiometricEventLogs_ReceivedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_BiometricEventLogs_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id])
    );
    CREATE UNIQUE INDEX [UX_BiometricEventLogs_Tenant_Event] ON [dbo].[BiometricEventLogs] ([TenantId], [DeviceEventId]) WHERE [DeviceEventId] IS NOT NULL;
    CREATE INDEX [IX_BiometricEventLogs_Tenant_ReceivedAt] ON [dbo].[BiometricEventLogs] ([TenantId], [ReceivedAt]);
END;

PRINT 'Biometric device registry and event audit storage is ready.';
GO