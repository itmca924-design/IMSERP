-- =========================================================================================
-- IMSERP - 5 Student Features Demo Seed Data Script (100% Schema-Matched)
-- Populates:
-- 1. 🏆 StudentAchievements (Wall of Fame, Awards, Badges, 1-Click Printable Certificates)
-- 2. ⚠️ StudentDisciplinaryRecords (Positive Commendations + Disciplinary Warnings)
-- 3. 👨‍👩‍👧 StudentPtmRecords (PTM Desk, Parent Feedback, Teacher Remarks, Action Points)
-- 4. 🩺 StudentHealthRecords (Height, Weight, BMI Meter, Allergies, Emergency Doctor)
-- =========================================================================================

DECLARE @TenantId UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
DECLARE @BranchId UNIQUEIDENTIFIER = '9BFD4859-E02C-43F2-AC9A-ACA34FE3EBFB'; -- Apex Coaching Academy - Main Branch

-- Target Student 1: Reyansh Kumar Singh
DECLARE @StudentId1 UNIQUEIDENTIFIER = '5ADF17F5-A090-43DF-809A-0E97ACEBDC35';

-- Target Student 2: Aarav Sharma
DECLARE @StudentId2 UNIQUEIDENTIFIER = 'EE607187-F89C-4A44-AE52-2ACAAFCFAD7C';

-- Target Student 3: Rishu
DECLARE @StudentId3 UNIQUEIDENTIFIER = 'F56485CF-1EC2-4258-BD26-3FB7147CF1EF';

PRINT 'Starting Demo Seed for 5 Student Features...';

-- -----------------------------------------------------------------------------------------
-- 1. 🏆 STUDENT ACHIEVEMENTS (Wall of Fame & Merit Certificates)
-- -----------------------------------------------------------------------------------------
DELETE FROM StudentAchievements WHERE StudentId IN (@StudentId1, @StudentId2, @StudentId3);

INSERT INTO StudentAchievements (Id, TenantId, BranchId, StudentId, Title, Category, AwardLevel, AwardDate, BadgeIcon, CertificateNumber, Description, AwardedBy, CreatedAt)
VALUES
-- Student 1 Achievements (Reyansh)
(NEWID(), @TenantId, @BranchId, @StudentId1, '1st Prize - State Science & Innovation Exhibition', 'Olympiad', 'State', '2026-08-15', 'military_tech', 'CERT-SCI-2026-894', 'Exhibited automated solar irrigation model. Highly praised by judges and secured 1st position across 45 schools.', 'State Science Congress & Research Council', GETUTCDATE()),
(NEWID(), @TenantId, @BranchId, @StudentId1, 'Inter-School Football Championship - Golden Boot', 'Sports', 'Inter-School', '2026-07-22', 'sports_soccer', 'SPO-2026-552', 'Scored highest goals in tournament and led institutional team to victory.', 'District Athletic & Sports Federation', GETUTCDATE()),
(NEWID(), @TenantId, @BranchId, @StudentId1, 'Excellence in Mathematics & Logical Reasoning', 'Academic', 'School', '2026-05-10', 'school', 'ACAD-2026-102', 'Ranked 1st in institutional Math Aptitude Test with 98% score.', 'Apex Academy Academic Council', GETUTCDATE()),

-- Student 2 Achievements (Aarav)
(NEWID(), @TenantId, @BranchId, @StudentId2, 'National Cyber Olympiad - Gold Medal', 'Olympiad', 'National', '2026-06-18', 'workspace_premium', 'NCO-2026-7881', 'Outstanding performance in computer science and logical algorithms (All India Rank 4).', 'Science Olympiad Foundation (SOF)', GETUTCDATE()),
(NEWID(), @TenantId, @BranchId, @StudentId2, 'Inter-House Debate Competition - 1st Position', 'Cultural', 'School', '2026-04-12', 'record_voice_over', 'LIT-2026-301', 'Articulated debate on AI in education with exceptional conviction and won best speaker award.', 'Literary & Debating Society', GETUTCDATE()),

-- Student 3 Achievements (Rishu)
(NEWID(), @TenantId, @BranchId, @StudentId3, 'District Drawing & Fine Arts Exhibition', 'Cultural', 'District', '2026-08-01', 'palette', 'ART-2026-441', 'Created exquisite water-color landscape depicting Indian rural culture and bagged 2nd prize.', 'Kala Kendra Art Guild', GETUTCDATE());

PRINT 'StudentAchievements inserted.';

-- -----------------------------------------------------------------------------------------
-- 2. ⚠️ STUDENT DISCIPLINARY & CONDUCT RECORDS (Commendations vs Infractions)
-- -----------------------------------------------------------------------------------------
DELETE FROM StudentDisciplinaryRecords WHERE StudentId IN (@StudentId1, @StudentId2, @StudentId3);

INSERT INTO StudentDisciplinaryRecords (Id, TenantId, BranchId, StudentId, IncidentDate, IncidentType, Severity, Title, Description, ActionTaken, ReportedBy, ParentNotified, IsResolved, CreatedAt)
VALUES
-- Student 1 Conduct (Reyansh)
(NEWID(), @TenantId, @BranchId, @StudentId1, '2026-09-10', 'PositiveCommendation', 'Commendation', 'Exemplary Honesty: Handed in Lost Purse with Cash', 'Reyansh found a lost leather wallet with cash and institution ID cards on playground and submitted it immediately to administrative desk.', 'Appreciation Certificate awarded during Morning Assembly & Special Mention on institution notice board.', 'Vikas Sharma (Faculty)', 1, 1, GETUTCDATE()),
(NEWID(), @TenantId, @BranchId, @StudentId1, '2026-08-04', 'MinorInfraction', 'Low', 'Tardy arrival after Lunch recess', 'Arrived 10 minutes late to Physics lecture post lunch interval due to library assignment overrun.', 'Student advised to manage transit time between academic blocks. Formal verbal counseling given.', 'Dr. S. K. Verma', 1, 1, GETUTCDATE()),

-- Student 2 Conduct (Aarav)
(NEWID(), @TenantId, @BranchId, @StudentId2, '2026-07-19', 'PositiveCommendation', 'Commendation', 'Peer Tutoring & Helping Junior Students', 'Voluntarily helped Class 6 students clarify mathematics homework doubts in study hall during free period.', 'Commended by Head of Department for collaborative leadership and teamwork.', 'Sunita Sharma (Teacher)', 1, 1, GETUTCDATE()),

-- Student 3 Conduct (Rishu)
(NEWID(), @TenantId, @BranchId, @StudentId3, '2026-09-02', 'MinorInfraction', 'Low', 'Incomplete Uniform (No institutional tie/belt)', 'Attended school without prescribed tie and blazer on formal Monday assembly.', 'Warning recorded in Student Handbook; student rectified next morning.', 'Discipline Incharge', 1, 1, GETUTCDATE());

PRINT 'StudentDisciplinaryRecords inserted.';

-- -----------------------------------------------------------------------------------------
-- 3. 👨‍👩‍👧 STUDENT PTM RECORDS (Parent-Teacher Interaction Journal)
-- -----------------------------------------------------------------------------------------
DELETE FROM StudentPtmRecords WHERE StudentId IN (@StudentId1, @StudentId2, @StudentId3);

INSERT INTO StudentPtmRecords (Id, TenantId, BranchId, StudentId, PtmDate, TeacherName, TeacherRemarks, ParentFeedback, ChildStrengths, AreasOfImprovement, ParentAttended, FollowUpRequired, CreatedAt)
VALUES
-- Student 1 PTM (Reyansh)
(NEWID(), @TenantId, @BranchId, @StudentId1, '2026-09-15', 'Sunita Sharma', 
 'Reyansh is exceptionally attentive in science & mathematics. His reasoning aptitude is stellar. Needs to maintain consistent speed during descriptive essay writing.',
 'Very happy with the conceptual coaching and regular assessments. Requested additional physics numerical practice worksheets before midterm exams.',
 'Analytical ability, sportsmanship, and polite behavior.',
 'Descriptive answer speed in Hindi and English literature.',
 'Both Parents (Father & Mother)', 0, GETUTCDATE()),

(NEWID(), @TenantId, @BranchId, @StudentId1, '2026-06-25', 'R. K. Gupta',
 'Term-1 review meeting. Student showed remarkable progress after initial term assessments. Regular homework submission appreciated.',
 'Father expressed satisfaction with campus security, bus transport, and coaching faculty dedication.',
 'Punctuality and active participation in co-curricular clubs.',
 'Needs to revise chemistry nomenclature regularly.',
 'Father', 0, GETUTCDATE()),

-- Student 2 PTM (Aarav)
(NEWID(), @TenantId, @BranchId, @StudentId2, '2026-09-15', 'Priya Nambiar',
 'Aarav is performing in the top 5% of the class. Excellent verbal articulation and computer programming interest.',
 'Parents requested recommendation for upcoming advanced Olympiad study resources and mock tests.',
 'Leadership, presentation skills, quick learner.',
 'Physical athletics and field sports participation.',
 'Mother', 0, GETUTCDATE());

PRINT 'StudentPtmRecords inserted.';

-- -----------------------------------------------------------------------------------------
-- 4. 🩺 STUDENT HEALTH RECORDS (Growth, BMI, Allergies, Emergency Doctor)
-- -----------------------------------------------------------------------------------------
DELETE FROM StudentHealthRecords WHERE StudentId IN (@StudentId1, @StudentId2, @StudentId3);

INSERT INTO StudentHealthRecords (Id, TenantId, BranchId, StudentId, HeightCm, WeightKg, Bmi, BmiCategory, VisionLeft, VisionRight, BloodGroup, KnownAllergies, ChronicConditions, RegularMedications, EmergencyDoctorName, EmergencyDoctorPhone, LastCheckupDate, DoctorRemarks, CreatedAt, UpdatedAt)
VALUES
-- Student 1 Health: Normal BMI, Mild Seasonal Allergy
(NEWID(), @TenantId, @BranchId, @StudentId1, 154.00, 46.50, 19.61, 'Normal', '6/6', '6/6', 'B+', 
 'Dust & Seasonal Grass Pollen (Mild sneeze in changing weather)', 
 'None', 
 'Cetirizine 5mg (SOS only when allergic rhinitis flares)', 
 'Dr. Arvind Pathak (MD Pediatrics)', '+91 98765 43210', '2026-08-20', 
 'Healthy adolescent vitals. Good muscle tone, clear chest and throat, 6/6 vision without corrective lenses. Fit for all sports.', GETUTCDATE(), GETUTCDATE()),

-- Student 2 Health: Severe Peanut Allergy (Demonstrates Critical Emergency Alert UI)
(NEWID(), @TenantId, @BranchId, @StudentId2, 149.00, 41.00, 18.47, 'Underweight', '6/6', '-0.5D', 'O+', 
 'CRITICAL ALLERGY: Peanuts and Tree Nuts (Requires immediate Epipen / Medical intervention if ingested)', 
 'Mild Juvenile Asthma (Exercise induced)', 
 'Asthalin Inhaler (1 puff before heavy physical exertion)', 
 'Dr. S. K. Mehta (Pediatric Pulmonologist)', '+91 98111 22334', '2026-09-01', 
 'Keep inhaler and anti-allergy antihistamine accessible at school infirmary and with coach during sports.', GETUTCDATE(), GETUTCDATE()),

-- Student 3 Health: Normal
(NEWID(), @TenantId, @BranchId, @StudentId3, 150.00, 48.00, 21.33, 'Normal', '6/6', '6/6', 'A+', 
 'None reported', 
 'None', 
 'None', 
 'Dr. Neha Kapoor (Clinic Care)', '+91 98222 33445', '2026-07-15', 
 'All growth parameters normal. BMI healthy and vitals stable.', GETUTCDATE(), GETUTCDATE());

PRINT 'StudentHealthRecords inserted successfully!';
PRINT 'All 5 features now have rich, realistic demonstration data.';
