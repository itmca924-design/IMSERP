-- =========================================================================================
-- IMSERP - Study Material & PYQ Bank: Menu Permissions & Class 3rd / 10th Data Seeding
-- =========================================================================================

SET NOCOUNT ON;

DECLARE @ApexTenantId UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
DECLARE @SystemTenantId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000001';
DECLARE @Class3Id UNIQUEIDENTIFIER = '2B0C01D8-F08F-479C-BA1A-0BDF2DF2FCD0'; -- Class 3rd
DECLARE @Class10Id UNIQUEIDENTIFIER = '37CC5995-B562-403A-80A1-1F3F9A10EB9E'; -- Class 10th
DECLARE @AcademicParentMenuId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000004';
DECLARE @StudyMaterialMenuId UNIQUEIDENTIFIER = '50000000-0000-0000-0000-000000000059';

-- -----------------------------------------------------------------------------------------
-- 1. Insert Menu Item in MenuItems table
-- -----------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE Id = @StudyMaterialMenuId OR RouteUrl = '/study-materials')
BEGIN
    INSERT INTO MenuItems (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module, IsActive)
    VALUES (
        @StudyMaterialMenuId,
        N'Study Material & PYQ Bank',
        N'/study-materials',
        N'auto_stories',
        @AcademicParentMenuId,
        3,
        N'Academic',
        1
    );
    PRINT 'Inserted /study-materials into MenuItems.';
END
ELSE
BEGIN
    UPDATE MenuItems
    SET Title = N'Study Material & PYQ Bank',
        Icon = N'auto_stories',
        ParentId = @AcademicParentMenuId,
        SortOrder = 3,
        Module = N'Academic',
        IsActive = 1
    WHERE RouteUrl = '/study-materials';
    PRINT 'Updated existing /study-materials MenuItem.';
END

-- -----------------------------------------------------------------------------------------
-- 2. Configure Role Permissions in RolePermissions table for ALL roles
-- -----------------------------------------------------------------------------------------
DECLARE @ActualMenuId UNIQUEIDENTIFIER;
SELECT TOP 1 @ActualMenuId = Id FROM MenuItems WHERE RouteUrl = '/study-materials';

-- For each role:
-- Students & Parents get Read-Only (CanView = 1, CanCreate = 0, CanEdit = 0, CanDelete = 0)
-- All other roles (SuperAdmin, Institute Admin, Teacher, HR, etc.) get Full Access (CanView = 1, CanCreate = 1, CanEdit = 1, CanDelete = 1)
INSERT INTO RolePermissions (Id, RoleId, MenuItemId, CanView, CanCreate, CanEdit, CanDelete)
SELECT 
    NEWID(),
    r.Id,
    @ActualMenuId,
    1 AS CanView,
    CASE WHEN LOWER(r.Name) LIKE '%student%' OR LOWER(r.Name) LIKE '%parent%' THEN 0 ELSE 1 END AS CanCreate,
    CASE WHEN LOWER(r.Name) LIKE '%student%' OR LOWER(r.Name) LIKE '%parent%' THEN 0 ELSE 1 END AS CanEdit,
    CASE WHEN LOWER(r.Name) LIKE '%student%' OR LOWER(r.Name) LIKE '%parent%' THEN 0 ELSE 1 END AS CanDelete
FROM Roles r
WHERE NOT EXISTS (
    SELECT 1 FROM RolePermissions rp 
    WHERE rp.RoleId = r.Id AND rp.MenuItemId = @ActualMenuId
);

PRINT 'RolePermissions configured for Study Material & PYQ Bank.';

-- -----------------------------------------------------------------------------------------
-- 3. Seed Realistic Study Materials for Apex Tenant (Class 3rd, Class 10th & Common)
-- -----------------------------------------------------------------------------------------
-- Delete prior seeded items for Apex to avoid duplication
DELETE FROM StudyMaterials WHERE TenantId = @ApexTenantId;

-- [A] Class 3rd Materials (School Scope)
INSERT INTO StudyMaterials (
    Id, TenantId, Title, Description, TargetScope, ClassId, SectionId, BatchId, 
    Subject, MaterialType, ChapterName, Topic, AcademicYear, TargetExam, ExamYear, 
    HasSolutions, DifficultyLevel, FileUrl, FileName, FileSizeBytes, FileFormat, 
    SolutionFileUrl, SolutionFileName, UploadedByName, DownloadCount, ViewCount, 
    IsPublished, IsFeatured, CreatedAt
)
VALUES
(
    NEWID(), @ApexTenantId,
    N'Class 3rd English - Marigold Fun Stories & Vocabulary Illustrated Notes',
    N'Complete chapter explanation with word meanings, poem recitation guide and fun picture comprehension exercises for Class 3 kids.',
    N'School', @Class3Id, NULL, NULL,
    N'English', N'Notes', N'Unit 1 & 2: Good Morning & Bird Talk', N'Poem & Word Meanings', N'2026-27',
    NULL, NULL, 0, N'Easy',
    N'/uploads/study-materials/class3_english_marigold_notes.pdf', N'class3_english_marigold_notes.pdf',
    2457600, N'pdf', NULL, NULL, N'Pooja Sharma (English Faculty)', 38, 142, 1, 1, DATEADD(DAY, -4, GETUTCDATE())
),
(
    NEWID(), @ApexTenantId,
    N'Class 3rd Mathematics - 3-Digit Addition, Multiplication & Shapes Practice Workbook',
    N'Activity-based colorful mental math worksheets covering 3-digit carryover addition, basic times tables up to 10 and 2D/3D shapes recognition.',
    N'School', @Class3Id, NULL, NULL,
    N'Mathematics', N'QuestionBank', N'Chapter 3 & 4: Give and Take & Shapes', N'Multiplication & Geometry', N'2026-27',
    NULL, NULL, 1, N'Easy',
    N'/uploads/study-materials/class3_maths_workbook_practice.pdf', N'class3_maths_workbook_practice.pdf',
    3145728, N'pdf',
    N'/uploads/study-materials/class3_maths_workbook_solutions.pdf', N'class3_maths_workbook_solutions.pdf',
    N'Pappu Singh (Maths HOD)', 65, 210, 1, 1, DATEADD(DAY, -3, GETUTCDATE())
),
(
    NEWID(), @ApexTenantId,
    N'Class 3rd EVS - Poonam''s Day Out & Water O'' Water Nature Mindmaps',
    N'Interactive environmental science mindmaps showing animals, birds, habitats, sources of water, and conservation tips with colorful diagrams.',
    N'School', @Class3Id, NULL, NULL,
    N'Environmental Studies', N'Notes', N'Chapter 1 & 2: Animals & Water Around Us', N'Habitats & Water Cycle', N'2026-27',
    NULL, NULL, 0, N'Easy',
    N'/uploads/study-materials/class3_evs_mindmaps_illustrated.pdf', N'class3_evs_mindmaps_illustrated.pdf',
    1835008, N'pdf', NULL, NULL, N'Anita Roy (EVS Faculty)', 41, 128, 1, 0, DATEADD(DAY, -2, GETUTCDATE())
);

-- [B] Class 10th Materials (School & Board Scope)
INSERT INTO StudyMaterials (
    Id, TenantId, Title, Description, TargetScope, ClassId, SectionId, BatchId, 
    Subject, MaterialType, ChapterName, Topic, AcademicYear, TargetExam, ExamYear, 
    HasSolutions, DifficultyLevel, FileUrl, FileName, FileSizeBytes, FileFormat, 
    SolutionFileUrl, SolutionFileName, UploadedByName, DownloadCount, ViewCount, 
    IsPublished, IsFeatured, CreatedAt
)
VALUES
(
    NEWID(), @ApexTenantId,
    N'CBSE Class 10th Science - 5-Year Solved Board PYQ Papers (2020-2024)',
    N'Complete compilation of CBSE Class 10 Board exam science question papers from 2020 to 2024. Includes step-wise official marking scheme solutions for Physics, Chemistry and Biology.',
    N'School', @Class10Id, NULL, NULL,
    N'Science', N'PYQ', N'All Chapters Physics, Chemistry & Biology', N'5-Year Board Solved Papers', N'2026-27',
    N'CBSE Board', N'2020-2024', 1, N'Medium',
    N'/uploads/study-materials/class10_science_5year_solved_pyq.pdf', N'class10_science_5year_solved_pyq.pdf',
    5872025, N'pdf',
    N'/uploads/study-materials/class10_science_marking_scheme_solutions.pdf', N'class10_science_marking_scheme_solutions.pdf',
    N'Dr. R.K. Verma (Science Faculty)', 142, 480, 1, 1, DATEADD(DAY, -6, GETUTCDATE())
),
(
    NEWID(), @ApexTenantId,
    N'Class 10th Mathematics - Standard & Basic Board PYQs with Stepwise Marking Scheme',
    N'Handpicked past 10 years chapter-wise questions covering Real Numbers, Polynomials, Quadratic Equations, Triangles, and Trigonometry with full proofs.',
    N'School', @Class10Id, NULL, NULL,
    N'Mathematics', N'PYQ', N'Real Numbers, Polynomials & Quadratic Equations', N'CBSE Standard & Basic PYQs', N'2026-27',
    N'CBSE Board', N'2024', 1, N'Hard',
    N'/uploads/study-materials/class10_maths_pyq_marking_scheme.pdf', N'class10_maths_pyq_marking_scheme.pdf',
    4299161, N'pdf',
    N'/uploads/study-materials/class10_maths_complete_solutions.pdf', N'class10_maths_complete_solutions.pdf',
    N'Pappu Singh (Maths HOD)', 189, 560, 1, 1, DATEADD(DAY, -5, GETUTCDATE())
),
(
    NEWID(), @ApexTenantId,
    N'Class 10th Social Science - Complete Mindmaps, Historical Timeline & Map Work Revision Sheet',
    N'Quick revision handbook containing visual timelines of Nationalism in Europe and India, geography map work locators, and civic power sharing summaries.',
    N'School', @Class10Id, NULL, NULL,
    N'Social Science', N'FormulaSheet', N'History & Geography High-Yield Chapters', N'Timelines & Map Locator', N'2026-27',
    N'CBSE Board', N'2026', 0, N'Medium',
    N'/uploads/study-materials/class10_sst_mindmaps_and_maps.pdf', N'class10_sst_mindmaps_and_maps.pdf',
    3984588, N'pdf', NULL, NULL, N'Vikas Gupta (SST Lead)', 97, 312, 1, 0, DATEADD(DAY, -3, GETUTCDATE())
);

-- [C] Common / Coaching / Both Materials for Apex Tenant
INSERT INTO StudyMaterials (
    Id, TenantId, Title, Description, TargetScope, ClassId, SectionId, BatchId, 
    Subject, MaterialType, ChapterName, Topic, AcademicYear, TargetExam, ExamYear, 
    HasSolutions, DifficultyLevel, FileUrl, FileName, FileSizeBytes, FileFormat, 
    SolutionFileUrl, SolutionFileName, UploadedByName, DownloadCount, ViewCount, 
    IsPublished, IsFeatured, CreatedAt
)
VALUES
(
    NEWID(), @ApexTenantId,
    N'Class 9 & 10 Mathematics - Complete Formula & Mindmap Handbook',
    N'Pocket formula handbook containing all algebraic identities, mensuration formulas, coordinate geometry theorems, trigonometry tables, and statistics formulas.',
    N'Both', NULL, NULL, NULL,
    N'Mathematics', N'FormulaSheet', N'All Syllabus Formulae', N'Quick Revision Handbook', N'2026-27',
    N'General', N'2026', 0, N'Medium',
    N'/uploads/study-materials/maths_formula_handbook_class9_10.pdf', N'maths_formula_handbook_class9_10.pdf',
    3145728, N'pdf', NULL, NULL, N'Pappu Singh (Maths HOD)', 215, 680, 1, 1, DATEADD(DAY, -7, GETUTCDATE())
),
(
    NEWID(), @ApexTenantId,
    N'English Language - Formal Letter, Article & Analytical Paragraph Writing Formats',
    N'Standard marking rubrics and solved sample formats for Formal Letters to the Editor, Notice Writing, Analytical Paragraphs, and Reading Comprehension.',
    N'Both', NULL, NULL, NULL,
    N'English', N'Notes', N'Grammar & Creative Writing Skills', N'Letter & Article Formats', N'2026-27',
    N'CBSE Board', N'2026', 0, N'Easy',
    N'/uploads/study-materials/english_writing_skills_formats.pdf', N'english_writing_skills_formats.pdf',
    1887436, N'pdf', NULL, NULL, N'Pooja Sharma (English Faculty)', 88, 290, 1, 0, DATEADD(DAY, -4, GETUTCDATE())
),
(
    NEWID(), @ApexTenantId,
    N'JEE & NEET Foundation - Kinematics & Laws of Motion Chapterwise Master DPP Set',
    N'Competitive practice problem set (DPP) containing single-choice, multiple-choice, and numerical integer problems for aspiring engineers and doctors.',
    N'Coaching', NULL, NULL, NULL,
    N'Physics', N'QuestionBank', N'Kinematics, Friction & Newton''s Laws', N'Advanced Problem Solving DPP', N'2026-27',
    N'JEE Main', N'2026', 1, N'Hard',
    N'/uploads/study-materials/jee_neet_kinematics_master_dpp.pdf', N'jee_neet_kinematics_master_dpp.pdf',
    4194304, N'pdf',
    N'/uploads/study-materials/jee_neet_kinematics_dpp_solutions.pdf', N'jee_neet_kinematics_dpp_solutions.pdf',
    N'Er. Manish Sharma (Physics Faculty)', 174, 510, 1, 1, DATEADD(DAY, -5, GETUTCDATE())
);

PRINT 'Seeded StudyMaterials for Apex Tenant successfully.';
SELECT COUNT(*) AS TotalMaterialsForApex FROM StudyMaterials WHERE TenantId = @ApexTenantId;
