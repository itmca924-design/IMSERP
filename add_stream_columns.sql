USE [IMSERP];
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PtmSessions') AND name = 'DivisionScope')
BEGIN
    ALTER TABLE [PtmSessions] ADD [DivisionScope] NVARCHAR(50) NOT NULL DEFAULT 'All';
    PRINT 'Added DivisionScope to PtmSessions';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PtmSessions') AND name = 'TargetBatchId')
BEGIN
    ALTER TABLE [PtmSessions] ADD [TargetBatchId] UNIQUEIDENTIFIER NULL;
    PRINT 'Added TargetBatchId to PtmSessions';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PtmSessions') AND name = 'TargetBatchName')
BEGIN
    ALTER TABLE [PtmSessions] ADD [TargetBatchName] NVARCHAR(200) NULL;
    PRINT 'Added TargetBatchName to PtmSessions';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('GrievanceTickets') AND name = 'DivisionScope')
BEGIN
    ALTER TABLE [GrievanceTickets] ADD [DivisionScope] NVARCHAR(50) NOT NULL DEFAULT 'All';
    PRINT 'Added DivisionScope to GrievanceTickets';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AdmissionEnquiries') AND name = 'AdmissionStream')
BEGIN
    ALTER TABLE [AdmissionEnquiries] ADD [AdmissionStream] NVARCHAR(50) NOT NULL DEFAULT 'School';
    PRINT 'Added AdmissionStream to AdmissionEnquiries';
END
GO

PRINT 'All columns checked and updated.';
