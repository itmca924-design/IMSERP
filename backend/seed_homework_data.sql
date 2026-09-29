-- ==============================================================================
-- IMSERP - DIGITAL HOMEWORK & SUBMISSIONS DEMO SEED DATA SCRIPT
-- ==============================================================================
USE IMSERP;
GO

SET NOCOUNT ON;

DECLARE @TenantId UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
DECLARE @BranchId UNIQUEIDENTIFIER = '9BFD4859-E02C-43F2-AC9A-ACA34FE3EBFB';

-- Target Class & Section: Class 3rd, Section A
DECLARE @ClassId UNIQUEIDENTIFIER = '2B0C01D8-F08F-479C-BA1A-0BDF2DF2FCD0'; -- Class 3rd
DECLARE @SectionId UNIQUEIDENTIFIER = '38C4F9C4-7046-4719-B199-33B48C1AF4AA'; -- Section A

-- Teachers
DECLARE @TeacherId1 UNIQUEIDENTIFIER = '18D67754-6C96-4D66-95FE-67ECA82F7B0E'; -- Pappu Singh
DECLARE @TeacherName1 NVARCHAR(150) = 'Pappu Singh';

DECLARE @TeacherId2 UNIQUEIDENTIFIER = 'B283208B-9CD8-46E2-82F9-526583836E13'; -- Dr. Sunita Mishra
DECLARE @TeacherName2 NVARCHAR(150) = 'Dr. Sunita Mishra';

-- Target Students in Class 3rd
DECLARE @StudentAarav UNIQUEIDENTIFIER = 'EE607187-F89C-4A44-AE52-2ACAAFCFAD7C'; -- Aarav Sharma (Roll 1)
DECLARE @StudentReyansh UNIQUEIDENTIFIER = '5ADF17F5-A090-43DF-809A-0E97ACEBDC35'; -- Reyansh Kumar Singh (Roll 2)
DECLARE @StudentVikash UNIQUEIDENTIFIER = '88C2EFF1-83D2-491F-BC38-D689CBC13514'; -- Vikash Kumar (Roll 3)

PRINT '--> Cleaning existing homework seed data...';
DELETE FROM StudentHomeworkSubmissions WHERE TenantId = @TenantId;
DELETE FROM StudentHomeworks WHERE TenantId = @TenantId;

-- ==============================================================================
-- 1. INSERT HOMEWORK ASSIGNMENTS
-- ==============================================================================
PRINT '--> Inserting Homework Assignments...';

DECLARE @Hw1Id UNIQUEIDENTIFIER = NEWID();
DECLARE @Hw2Id UNIQUEIDENTIFIER = NEWID();
DECLARE @Hw3Id UNIQUEIDENTIFIER = NEWID();
DECLARE @Hw4Id UNIQUEIDENTIFIER = NEWID();

-- Assignment 1: Mathematics - Active (Due Tomorrow 5:00 PM IST)
INSERT INTO StudentHomeworks (
    Id, TenantId, BranchId, ClassId, SectionId, BatchId, SubjectId, SubjectName,
    TeacherId, TeacherName, Title, Description, AssignedDate, DueDate,
    AttachmentUrl, AttachmentFileName, Status, EstimatedMinutes, CreatedAt, UpdatedAt
)
VALUES (
    @Hw1Id, @TenantId, @BranchId, @ClassId, @SectionId, NULL, NULL, 'Mathematics',
    @TeacherId1, @TeacherName1,
    N'Chapter 4: Multiplication & Real-Life Word Problems',
    N'Complete Exercise 4.3 from page 48 in your Mathematics fair notebook. Solve all 6 word problems showing proper statements and calculation steps. Practice 12x multiplication table before solving.',
    DATEADD(HOUR, -6, GETUTCDATE()),
    DATEADD(HOUR, 26, GETUTCDATE()), -- Tomorrow evening
    '/uploads/homework/worksheets/Class3_Maths_Multiplication_Worksheet.pdf',
    'Class3_Maths_Multiplication_Worksheet.pdf',
    'Active', 35,
    DATEADD(HOUR, -6, GETUTCDATE()),
    DATEADD(HOUR, -6, GETUTCDATE())
);

-- Assignment 2: Science - Active (Due Today 6:00 PM IST)
INSERT INTO StudentHomeworks (
    Id, TenantId, BranchId, ClassId, SectionId, BatchId, SubjectId, SubjectName,
    TeacherId, TeacherName, Title, Description, AssignedDate, DueDate,
    AttachmentUrl, AttachmentFileName, Status, EstimatedMinutes, CreatedAt, UpdatedAt
)
VALUES (
    @Hw2Id, @TenantId, @BranchId, @ClassId, @SectionId, NULL, NULL, 'Science',
    @TeacherId2, @TeacherName2,
    N'Chapter 3: Parts of Plants & Leaf Photosynthesis Diagram',
    N'Draw a neat flowering plant diagram on your Science project sheet. Label Roots, Stem, Leaves, Flower and Fruit. Write down 3 key functions of roots in paragraph format.',
    DATEADD(DAY, -1, GETUTCDATE()),
    DATEADD(HOUR, 4, GETUTCDATE()), -- Due today soon
    '/uploads/homework/worksheets/Class3_Science_Plants_Worksheet.pdf',
    'Class3_Science_Plants_Worksheet.pdf',
    'Active', 40,
    DATEADD(DAY, -1, GETUTCDATE()),
    DATEADD(DAY, -1, GETUTCDATE())
);

-- Assignment 3: English - Active (Due in 2 days)
INSERT INTO StudentHomeworks (
    Id, TenantId, BranchId, ClassId, SectionId, BatchId, SubjectId, SubjectName,
    TeacherId, TeacherName, Title, Description, AssignedDate, DueDate,
    AttachmentUrl, AttachmentFileName, Status, EstimatedMinutes, CreatedAt, UpdatedAt
)
VALUES (
    @Hw3Id, @TenantId, @BranchId, @ClassId, @SectionId, NULL, NULL, 'English',
    @TeacherId1, @TeacherName1,
    N'Reading & Grammar: The Brave Little Sparrow & Past Tense Verbs',
    N'Read chapter 5 aloud twice with proper pronunciation. Underline 8 past tense verbs and write 5 creative sentences on topic "How I helped a wounded bird in my garden".',
    DATEADD(HOUR, -2, GETUTCDATE()),
    DATEADD(DAY, 2, GETUTCDATE()),
    NULL, NULL,
    'Active', 25,
    DATEADD(HOUR, -2, GETUTCDATE()),
    DATEADD(HOUR, -2, GETUTCDATE())
);

-- Assignment 4: Hindi - Completed
INSERT INTO StudentHomeworks (
    Id, TenantId, BranchId, ClassId, SectionId, BatchId, SubjectId, SubjectName,
    TeacherId, TeacherName, Title, Description, AssignedDate, DueDate,
    AttachmentUrl, AttachmentFileName, Status, EstimatedMinutes, CreatedAt, UpdatedAt
)
VALUES (
    @Hw4Id, @TenantId, @BranchId, @ClassId, @SectionId, NULL, NULL, 'Hindi',
    @TeacherId1, @TeacherName1,
    'Chapter 4: Prakriti Ka Sandesh (Poem Recitation & Handwriting)',
    'Write first 8 lines of the poem ''Prakriti Ka Sandesh'' in neat cursive Hindi notebook. Practice 10 difficult vocabulary words 3 times with word meanings.',
    DATEADD(DAY, -4, GETUTCDATE()),
    DATEADD(DAY, -2, GETUTCDATE()),
    NULL, NULL,
    'Completed', 30,
    DATEADD(DAY, -4, GETUTCDATE()),
    DATEADD(DAY, -2, GETUTCDATE())
);

-- ==============================================================================
-- 2. INSERT STUDENT SUBMISSIONS (Realistic copies, grades, reviews)
-- ==============================================================================
PRINT '--> Inserting Student Submissions for Assignment 1 (Maths)...';

-- Student 1: Aarav Sharma - Approved with Grade A+
INSERT INTO StudentHomeworkSubmissions (
    Id, TenantId, BranchId, HomeworkId, StudentId,
    SubmissionDate, StudentRemarks, SubmissionFileUrl, SubmissionFileName,
    Status, TeacherRemarks, GradeOrMarks, ReviewedAt, ReviewedByTeacherId, CreatedAt
)
VALUES (
    NEWID(), @TenantId, @BranchId, @Hw1Id, @StudentAarav,
    DATEADD(HOUR, -4, GETUTCDATE()),
    N'Completed all 6 word problems on page 48 in my math copy. Verified calculations with table 12.',
    '/uploads/homework/submissions/aarav_maths_page32.png',
    'Aarav_Maths_Page48.png',
    'Approved',
    N'Outstanding work Aarav! Calculation statements are well-formatted and handwriting is very neat.',
    'A+ (10/10)',
    DATEADD(HOUR, -2, GETUTCDATE()),
    @TeacherId1,
    DATEADD(HOUR, -4, GETUTCDATE())
);

-- Student 2: Reyansh Kumar Singh - Submitted (Pending Teacher Review)
INSERT INTO StudentHomeworkSubmissions (
    Id, TenantId, BranchId, HomeworkId, StudentId,
    SubmissionDate, StudentRemarks, SubmissionFileUrl, SubmissionFileName,
    Status, TeacherRemarks, GradeOrMarks, ReviewedAt, ReviewedByTeacherId, CreatedAt
)
VALUES (
    NEWID(), @TenantId, @BranchId, @Hw1Id, @StudentReyansh,
    DATEADD(HOUR, -1, GETUTCDATE()),
    N'Sir, completed questions 1 to 5 with steps. Had a small doubt in Q6 statement.',
    '/uploads/homework/submissions/reyansh_maths_copy.pdf',
    'Reyansh_Maths_Homework.pdf',
    'Submitted',
    NULL, NULL, NULL, NULL,
    DATEADD(HOUR, -1, GETUTCDATE())
);

-- Student 3: Vikash Kumar - Needs Correction
INSERT INTO StudentHomeworkSubmissions (
    Id, TenantId, BranchId, HomeworkId, StudentId,
    SubmissionDate, StudentRemarks, SubmissionFileUrl, SubmissionFileName,
    Status, TeacherRemarks, GradeOrMarks, ReviewedAt, ReviewedByTeacherId, CreatedAt
)
VALUES (
    NEWID(), @TenantId, @BranchId, @Hw1Id, @StudentVikash,
    DATEADD(HOUR, -3, GETUTCDATE()),
    N'Solved all problems on copy page 28.',
    '/uploads/homework/submissions/vikash_page28.png',
    'Vikash_Maths_Page28.png',
    'NeedsCorrection',
    N'Good attempt, but check Question 4 carry-over multiplication. Redo Q4 and resubmit before tomorrow.',
    'B (7/10)',
    DATEADD(HOUR, -1, GETUTCDATE()),
    @TeacherId1,
    DATEADD(HOUR, -3, GETUTCDATE())
);

PRINT '--> Inserting Student Submissions for Assignment 2 (Science)...';

-- Aarav Sharma - Approved
INSERT INTO StudentHomeworkSubmissions (
    Id, TenantId, BranchId, HomeworkId, StudentId,
    SubmissionDate, StudentRemarks, SubmissionFileUrl, SubmissionFileName,
    Status, TeacherRemarks, GradeOrMarks, ReviewedAt, ReviewedByTeacherId, CreatedAt
)
VALUES (
    NEWID(), @TenantId, @BranchId, @Hw2Id, @StudentAarav,
    DATEADD(HOUR, -8, GETUTCDATE()),
    N'Drew plant diagram and colored with pencils. Root functions written.',
    '/uploads/homework/submissions/aarav_maths_page32.png',
    'Aarav_Science_Plant_Diagram.png',
    'Approved',
    N'Neat sketch and accurate labeling of xylem & root hairs. Excellent effort!',
    'A (9/10)',
    DATEADD(HOUR, -5, GETUTCDATE()),
    @TeacherId2,
    DATEADD(HOUR, -8, GETUTCDATE())
);

PRINT '=======================================================';
PRINT '✅ Digital Homework & Submissions Demo Seeded Successfully!';
PRINT '=======================================================';
