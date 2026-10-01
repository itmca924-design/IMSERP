-- IMSERP - STUDY MATERIAL & QUESTION BANK REPOSITORY SETUP & SEED DATA
USE [IMSERP];
GO

-- 1. Ensure Table & Indexes Exist
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StudyMaterials')
BEGIN
    PRINT '--> Creating StudyMaterials table...';
    CREATE TABLE StudyMaterials (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        BranchId UNIQUEIDENTIFIER NULL,
        Title NVARCHAR(300) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        TargetScope NVARCHAR(50) NOT NULL DEFAULT 'Both', -- Both | School | Coaching
        ClassId UNIQUEIDENTIFIER NULL,
        SectionId UNIQUEIDENTIFIER NULL,
        BatchId UNIQUEIDENTIFIER NULL,
        SubjectId UNIQUEIDENTIFIER NULL,
        Subject NVARCHAR(150) NOT NULL DEFAULT '',
        MaterialType NVARCHAR(50) NOT NULL DEFAULT 'Notes', -- Notes | PYQ | QuestionBank | FormulaSheet | SamplePaper | Syllabus
        ChapterName NVARCHAR(200) NULL,
        Topic NVARCHAR(200) NULL,
        AcademicYear NVARCHAR(50) NULL,
        TargetExam NVARCHAR(100) NULL,
        ExamYear NVARCHAR(50) NULL,
        HasSolutions BIT NOT NULL DEFAULT 0,
        DifficultyLevel NVARCHAR(50) NULL,
        FileUrl NVARCHAR(1000) NOT NULL,
        FileName NVARCHAR(300) NOT NULL,
        FileSizeBytes BIGINT NOT NULL DEFAULT 0,
        FileFormat NVARCHAR(50) NOT NULL DEFAULT 'pdf',
        ExternalLink NVARCHAR(1000) NULL,
        SolutionFileUrl NVARCHAR(1000) NULL,
        SolutionFileName NVARCHAR(300) NULL,
        UploadedByName NVARCHAR(150) NOT NULL DEFAULT '',
        UploadedByUserId UNIQUEIDENTIFIER NULL,
        DownloadCount INT NOT NULL DEFAULT 0,
        ViewCount INT NOT NULL DEFAULT 0,
        IsPublished BIT NOT NULL DEFAULT 1,
        IsFeatured BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_StudyMaterials_Tenant_Scope ON StudyMaterials (TenantId, TargetScope, MaterialType, IsPublished);
    CREATE INDEX IX_StudyMaterials_Class_Batch ON StudyMaterials (TenantId, ClassId, BatchId);
    CREATE INDEX IX_StudyMaterials_Subject ON StudyMaterials (TenantId, Subject);
    CREATE INDEX IX_StudyMaterials_CreatedAt ON StudyMaterials (TenantId, CreatedAt DESC);
    PRINT '--> StudyMaterials table created successfully.';
END
ELSE
BEGIN
    PRINT '--> StudyMaterials table already exists.';
END
GO

-- 2. Populate Sample Realistic Data
DECLARE @TenantId UNIQUEIDENTIFIER = (SELECT TOP 1 Id FROM Tenants WHERE IsActive = 1);
IF @TenantId IS NULL
    SET @TenantId = (SELECT TOP 1 TenantId FROM Users);

DECLARE @BranchId UNIQUEIDENTIFIER = (SELECT TOP 1 Id FROM Branches WHERE TenantId = @TenantId);

-- Get Class & Batch references if available
DECLARE @Class10Id UNIQUEIDENTIFIER = (SELECT TOP 1 Id FROM SchoolClasses WHERE TenantId = @TenantId AND (Name LIKE '%10%' OR Name LIKE '%X%'));
IF @Class10Id IS NULL SET @Class10Id = (SELECT TOP 1 Id FROM SchoolClasses WHERE TenantId = @TenantId);

DECLARE @BatchJeeId UNIQUEIDENTIFIER = (SELECT TOP 1 Id FROM Batches WHERE TenantId = @TenantId AND (Name LIKE '%JEE%' OR Name LIKE '%NEET%' OR Name LIKE '%Target%'));
IF @BatchJeeId IS NULL SET @BatchJeeId = (SELECT TOP 1 Id FROM Batches WHERE TenantId = @TenantId);

PRINT 'Tenant: ' + CAST(@TenantId AS NVARCHAR(50));

-- Insert sample study materials if table is empty
IF NOT EXISTS (SELECT 1 FROM StudyMaterials WHERE TenantId = @TenantId)
BEGIN
    PRINT '--> Seeding realistic study materials, PYQs & formula books...';

    -- 1. Common Formula Sheet (Both School & Coaching)
    INSERT INTO StudyMaterials (
        Id, TenantId, BranchId, Title, Description, TargetScope, ClassId, SectionId, BatchId,
        Subject, MaterialType, ChapterName, Topic, AcademicYear, TargetExam, ExamYear,
        HasSolutions, DifficultyLevel, FileUrl, FileName, FileSizeBytes, FileFormat,
        UploadedByName, DownloadCount, ViewCount, IsPublished, IsFeatured, CreatedAt, UpdatedAt
    ) VALUES (
        NEWID(), @TenantId, @BranchId,
        'Class 9 & 10 Mathematics - Complete Formula & Mindmap Handbook',
        'Handy 14-page pocket revision guide containing all theorems, trigonometry identities, mensuration & coordinate geometry formulas.',
        'Both', NULL, NULL, NULL,
        'Mathematics', 'FormulaSheet', 'Complete Syllabus', 'All Chapters Formula Compilation', '2026-27', 'CBSE / Foundation', '2026',
        1, 'All Levels', '/uploads/study-materials/files/Maths_Formula_Handbook_2026.pdf', 'Maths_Formula_Handbook_2026.pdf', 2450000, 'pdf',
        'HOD Mathematics', 84, 210, 1, 1, DATEADD(day, -10, GETUTCDATE()), GETUTCDATE()
    );

    -- 2. School Class Notes (School Only)
    INSERT INTO StudyMaterials (
        Id, TenantId, BranchId, Title, Description, TargetScope, ClassId, SectionId, BatchId,
        Subject, MaterialType, ChapterName, Topic, AcademicYear, TargetExam, ExamYear,
        HasSolutions, DifficultyLevel, FileUrl, FileName, FileSizeBytes, FileFormat,
        UploadedByName, DownloadCount, ViewCount, IsPublished, IsFeatured, CreatedAt, UpdatedAt
    ) VALUES (
        NEWID(), @TenantId, @BranchId,
        'Science (Physics) - Light: Reflection and Refraction Detailed Notes',
        'NCERT chapter-wise handwritten concept notes with ray diagrams, mirror/lens formulas, sign convention rules and solved exemplar numericals.',
        'School', @Class10Id, NULL, NULL,
        'Science', 'Notes', 'Chapter 10: Light - Reflection and Refraction', 'Spherical Mirrors & Lenses', '2026-27', 'CBSE Board', '2026',
        1, 'Medium', '/uploads/study-materials/files/Class10_Physics_Light_Notes.pdf', 'Class10_Physics_Light_Notes.pdf', 3820000, 'pdf',
        'Ramesh Sharma (Science Faculty)', 62, 145, 1, 1, DATEADD(day, -8, GETUTCDATE()), GETUTCDATE()
    );

    -- 3. Board PYQ Paper (School Only)
    INSERT INTO StudyMaterials (
        Id, TenantId, BranchId, Title, Description, TargetScope, ClassId, SectionId, BatchId,
        Subject, MaterialType, ChapterName, Topic, AcademicYear, TargetExam, ExamYear,
        HasSolutions, DifficultyLevel, FileUrl, FileName, FileSizeBytes, FileFormat,
        SolutionFileUrl, SolutionFileName,
        UploadedByName, DownloadCount, ViewCount, IsPublished, IsFeatured, CreatedAt, UpdatedAt
    ) VALUES (
        NEWID(), @TenantId, @BranchId,
        'CBSE Class 10th Science - 5-Year Solved Board PYQ Papers (2020-2024)',
        'Comprehensive chapter-wise compilation of previous 5 years CBSE Class 10 Science board examination questions with official marking scheme.',
        'School', @Class10Id, NULL, NULL,
        'Science', 'PYQ', 'Full Syllabus', 'Board Exam Archive', '2026-27', 'CBSE Board', '2020-2024',
        1, 'Hard', '/uploads/study-materials/files/Class10_Science_CBSE_PYQ_Solved.pdf', 'Class10_Science_CBSE_PYQ_Solved.pdf', 5410000, 'pdf',
        '/uploads/study-materials/solutions/Class10_Science_Official_MarkingScheme.pdf', 'Class10_Science_Official_MarkingScheme.pdf',
        'Academic Coordinator', 115, 340, 1, 1, DATEADD(day, -6, GETUTCDATE()), GETUTCDATE()
    );

    -- 4. Coaching DPP & Question Bank (Coaching Only)
    INSERT INTO StudyMaterials (
        Id, TenantId, BranchId, Title, Description, TargetScope, ClassId, SectionId, BatchId,
        Subject, MaterialType, ChapterName, Topic, AcademicYear, TargetExam, ExamYear,
        HasSolutions, DifficultyLevel, FileUrl, FileName, FileSizeBytes, FileFormat,
        UploadedByName, DownloadCount, ViewCount, IsPublished, IsFeatured, CreatedAt, UpdatedAt
    ) VALUES (
        NEWID(), @TenantId, @BranchId,
        'JEE Foundation - Quadratic Equations & Complex Numbers Master DPP Set',
        'Daily Practice Problem (DPP) containing 60 advanced analytical MCQs, integer-type questions, and shortcut problem-solving methods.',
        'Coaching', NULL, NULL, @BatchJeeId,
        'Mathematics', 'QuestionBank', 'Quadratic Equations', 'Roots & Transformation of Equations', '2026-27', 'JEE Main / Advanced', '2026',
        1, 'Hard', '/uploads/study-materials/files/JEE_Maths_Quadratic_DPP_Set1.pdf', 'JEE_Maths_Quadratic_DPP_Set1.pdf', 1980000, 'pdf',
        'Sanjeev Verma (JEE Faculty)', 47, 98, 1, 0, DATEADD(day, -4, GETUTCDATE()), GETUTCDATE()
    );

    -- 5. Coaching Competitive PYQ (Coaching Only)
    INSERT INTO StudyMaterials (
        Id, TenantId, BranchId, Title, Description, TargetScope, ClassId, SectionId, BatchId,
        Subject, MaterialType, ChapterName, Topic, AcademicYear, TargetExam, ExamYear,
        HasSolutions, DifficultyLevel, FileUrl, FileName, FileSizeBytes, FileFormat,
        SolutionFileUrl, SolutionFileName,
        UploadedByName, DownloadCount, ViewCount, IsPublished, IsFeatured, CreatedAt, UpdatedAt
    ) VALUES (
        NEWID(), @TenantId, @BranchId,
        'NEET & JEE - Kinematics & Laws of Motion 10-Year Chapterwise PYQs',
        'Categorized past 10 years entrance questions for Motion in 1D/2D, Newton Laws of Motion, and Friction with step-by-step vector solutions.',
        'Coaching', NULL, NULL, @BatchJeeId,
        'Physics', 'PYQ', 'Kinematics & NLM', 'Newtonian Mechanics', '2026-27', 'JEE / NEET', '2015-2024',
        1, 'Hard', '/uploads/study-materials/files/NEET_JEE_Kinematics_10Yr_PYQ.pdf', 'NEET_JEE_Kinematics_10Yr_PYQ.pdf', 6720000, 'pdf',
        '/uploads/study-materials/solutions/Kinematics_PYQ_StepByStep_Solutions.pdf', 'Kinematics_PYQ_StepByStep_Solutions.pdf',
        'Dr. Ananya Ray (Senior Physics)', 78, 260, 1, 1, DATEADD(day, -2, GETUTCDATE()), GETUTCDATE()
    );

    -- 6. English Grammar & Writing Skills (Both / Open)
    INSERT INTO StudyMaterials (
        Id, TenantId, BranchId, Title, Description, TargetScope, ClassId, SectionId, BatchId,
        Subject, MaterialType, ChapterName, Topic, AcademicYear, TargetExam, ExamYear,
        HasSolutions, DifficultyLevel, FileUrl, FileName, FileSizeBytes, FileFormat,
        UploadedByName, DownloadCount, ViewCount, IsPublished, IsFeatured, CreatedAt, UpdatedAt
    ) VALUES (
        NEWID(), @TenantId, @BranchId,
        'English Language - Formal Letter, Article & Analytical Paragraph Writing Formats',
        'Essential writing skills guide with high-scoring formats, sample drafts, vocabulary lists and common grammar pitfalls to avoid.',
        'Both', NULL, NULL, NULL,
        'English', 'Notes', 'Writing Skills & Grammar', 'Formal Letters & Analytical Paragraphs', '2026-27', 'CBSE / ICSE / General', '2026',
        0, 'Easy', '/uploads/study-materials/files/English_Writing_Skills_Format_Guide.pdf', 'English_Writing_Skills_Format_Guide.pdf', 1450000, 'pdf',
        'Sunita Mehra (English Department)', 95, 180, 1, 0, DATEADD(day, -1, GETUTCDATE()), GETUTCDATE()
    );

    PRINT '--> Study Materials demo data seeded successfully!';
END
ELSE
BEGIN
    PRINT '--> Study Materials already has data. Skipping demo seed.';
END
GO
