IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'OfficialSeal')
    ALTER TABLE Tenants ADD OfficialSeal NVARCHAR(MAX) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'DigitalSignature')
    ALTER TABLE Tenants ADD DigitalSignature NVARCHAR(MAX) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ExamSettings') AND name = 'OfficialSealUrl')
    ALTER TABLE ExamSettings ADD OfficialSealUrl NVARCHAR(MAX) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ExamSettings') AND name = 'PrincipalSignatureUrl')
    ALTER TABLE ExamSettings ADD PrincipalSignatureUrl NVARCHAR(MAX) NULL;
