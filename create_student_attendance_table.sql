-- Student attendance storage for the Student Attendance module.
-- Run this script once on the IMSERP database before using the new UI.

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[StudentAttendances]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[StudentAttendances]
    (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [PK_StudentAttendances] PRIMARY KEY,
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [StudentId] UNIQUEIDENTIFIER NOT NULL,
        [AttendanceDate] DATE NOT NULL,
        [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_StudentAttendances_Status] DEFAULT ('Present'),
        [Remarks] NVARCHAR(500) NULL,
        [MarkedBy] NVARCHAR(100) NULL,
        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_StudentAttendances_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_StudentAttendances_Tenants]
            FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_StudentAttendances_Students]
            FOREIGN KEY ([StudentId]) REFERENCES [dbo].[Students]([Id]) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX [IX_StudentAttendances_StudentId_AttendanceDate]
        ON [dbo].[StudentAttendances] ([StudentId], [AttendanceDate]);

    CREATE INDEX [IX_StudentAttendances_TenantId_AttendanceDate]
        ON [dbo].[StudentAttendances] ([TenantId], [AttendanceDate]);

    PRINT 'StudentAttendances table created successfully.';
END
ELSE
BEGIN
    PRINT 'StudentAttendances table already exists. No changes made.';
END
GO
