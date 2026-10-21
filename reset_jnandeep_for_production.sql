-- =========================================================================
-- IMSERP: Production Reset Script for Jnandeep Campus (Code: JNANDEEP)
-- Purpose: Wipe all test/dummy transactional data for customer go-live
-- PRESERVED:
--   1. Admin Settings: Tenants, Branches, Rooms, Roles, RolePermissions,
--      RoleMenuAssignments, Users, AttendanceSettings, AutomationSettings,
--      BiometricDevices, Policies, ExamSettings, LibrarySettings
--   2. Academic Setup: SchoolClasses, SchoolSections, Batches, Subjects,
--      ClassSubjects, SchoolPeriodSlots, SchoolActivityTypes, Holidays
--   3. Fee Heads Master: FeeHeads, ClassFeeStructures, LibraryMembershipPlans
-- WIPED:
--   Students, Invoices, Payments, Attendance, Exams, Homework, Inventory
--   transactions, Hostel & Transport allocations, Payroll, Chat, WhatsApp
-- =========================================================================

USE [IMSERP];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

-- 1. Identify Target Tenant
DECLARE @JnandeepTenantId UNIQUEIDENTIFIER;
SELECT TOP 1 @JnandeepTenantId = [Id] 
FROM [dbo].[Tenants] 
WHERE [Code] = 'JNANDEEP' OR [Code] = 'JNADEEP';

IF @JnandeepTenantId IS NULL
BEGIN
    RAISERROR(N'ERROR: Tenant with Code JNANDEEP not found in database! Operation aborted.', 16, 1);
    RETURN;
END

PRINT 'Target Tenant identified: Jnandeep Campus (ID: ' + CAST(@JnandeepTenantId AS NVARCHAR(50)) + ')';
PRINT 'Starting safe transactional cleanup...';
PRINT '-------------------------------------------------------------';

BEGIN TRY
    BEGIN TRANSACTION;

    -- =============================================================
    -- STEP 1: BREAK CIRCULAR / NULLABLE FOREIGN KEYS TO STUDENTS
    -- =============================================================
    UPDATE [dbo].[HostelBeds]
    SET [CurrentStudentId] = NULL, 
        [Status] = 'Available'
    WHERE [TenantId] = @JnandeepTenantId;

    UPDATE [dbo].[AdmissionEnquiries]
    SET [ConvertedStudentId] = NULL
    WHERE [TenantId] = @JnandeepTenantId;

    PRINT '[Step 1] Cleared Student foreign keys from Hostel Beds & Enquiries.';

    -- =============================================================
    -- STEP 2: STUDENT 360, LEAVES, GATE PASSES, ATTENDANCE & DIARY
    -- =============================================================
    DELETE FROM [dbo].[StudentAchievements] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[StudentDisciplinaryRecords] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[StudentPtmRecords] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[StudentHealthRecords] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[StudentSiblings] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[StudentFeeConcessions] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[StudentDocuments] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[StudentGatePasses] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[StudentLeaves] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[StudentPromotionHistories] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[DailyStudentBehaviours] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[DailyStudentDiaries] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[StudentHomeworkSubmissions] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[StudentHomeworks] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[StudentMonthlyEvaluations] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[StudentAttendanceRegularizations] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[StudentAttendances] WHERE [TenantId] = @JnandeepTenantId;

    PRINT '[Step 2] Cleaned Student 360 sub-records, leaves, homework & attendance.';

    -- =============================================================
    -- STEP 3: FEE INVOICES, PAYMENTS & RECEIPTS
    -- =============================================================
    DELETE FROM [dbo].[FeePayments] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[FeeInvoiceItems] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[FeeInvoices] WHERE [TenantId] = @JnandeepTenantId;

    PRINT '[Step 3] Cleaned Fee Payments, Receipts and Invoices.';

    -- =============================================================
    -- STEP 4: FINANCE & ACCOUNTING TRANSACTIONS
    -- =============================================================
    DELETE FROM [dbo].[ExpenseVouchers] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[AccountLedgers] WHERE [TenantId] = @JnandeepTenantId;

    PRINT '[Step 4] Cleaned Expense Vouchers and Account Ledgers.';

    -- =============================================================
    -- STEP 5: TESTS & EXAMS
    -- =============================================================
    DELETE FROM [dbo].[TestMarks] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[Tests] WHERE [TenantId] = @JnandeepTenantId;

    PRINT '[Step 5] Cleaned Test Exams and Marks records.';

    -- =============================================================
    -- STEP 6: HOSTEL, TRANSPORT & LIBRARY TRANSACTIONS
    -- =============================================================
    DELETE FROM [dbo].[HostelAttendances] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[HostelGatePasses] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[HostelAllocations] WHERE [TenantId] = @JnandeepTenantId;

    DELETE FROM [dbo].[TransportAttendances] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[TransportAllocations] WHERE [TenantId] = @JnandeepTenantId;

    DELETE FROM [dbo].[LibraryCirculations] WHERE [TenantId] = @JnandeepTenantId;

    PRINT '[Step 6] Cleaned Hostel allocations, Transport seats and Library circulations.';

    -- =============================================================
    -- STEP 7: FRONT DESK, INFIRMARY, PTM, GRIEVANCES & NOTICES
    -- =============================================================
    DELETE FROM [dbo].[VisitorLogs] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[CampusGatePasses] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[InfirmaryVisits] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[PtmBookings] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[PtmSessions] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[GrievanceComments] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[GrievanceTickets] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[SchoolNotices] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[AdmissionEnquiries] WHERE [TenantId] = @JnandeepTenantId;

    PRINT '[Step 7] Cleaned Front Desk, Grievances, PTM and Enquiries.';

    -- =============================================================
    -- STEP 8: INVENTORY TRANSACTIONS
    -- =============================================================
    DELETE FROM [dbo].[InventoryVendorPayments] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[InventorySaleReturnItems] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[InventorySaleReturns] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[InventoryPurchaseReturnItems] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[InventoryPurchaseReturns] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[InventoryStockAdjustments] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[InventoryOutwardItems] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[InventoryOutwards] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[InventoryInwardItems] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[InventoryInwards] WHERE [TenantId] = @JnandeepTenantId;

    -- Reset stock quantity to 0 on inventory items while preserving item master
    UPDATE [dbo].[InventoryItems] 
    SET [CurrentStock] = 0 
    WHERE [TenantId] = @JnandeepTenantId;

    PRINT '[Step 8] Cleaned Inventory sales, inwards, vendor payments (Stock reset to 0).';

    -- =============================================================
    -- STEP 9: TEACHER / STAFF TRANSACTIONS & PAYROLL
    -- =============================================================
    DELETE FROM [dbo].[TeacherSalaryPayments] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[TeacherSalaryAdvances] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[TeacherSalaries] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[StaffPromotionIncrements] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[TeacherFnFSettlements] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[TeacherAttendanceRegularizations] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[TeacherAttendances] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[TeacherLeaves] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[TeacherSubstitutions] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[TeacherLessonPlans] WHERE [TenantId] = @JnandeepTenantId;

    PRINT '[Step 9] Cleaned Staff Attendance, Leaves & Payroll transactions.';

    -- =============================================================
    -- STEP 10: COMMUNICATION, CHAT & AUDIT LOGS
    -- =============================================================
    DELETE FROM [dbo].[WhatsAppLogs] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[BiometricEventLogs] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[ChatMessages] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[ChatParticipants] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[ChatConversations] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[EventPhotos] WHERE [TenantId] = @JnandeepTenantId;
    DELETE FROM [dbo].[SchoolEvents] WHERE [TenantId] = @JnandeepTenantId;

    PRINT '[Step 10] Cleaned WhatsApp logs, Chat history, Event photos & Biometric punch logs.';

    -- =============================================================
    -- STEP 11: STUDENTS DIRECTORY
    -- =============================================================
    DELETE FROM [dbo].[Students] WHERE [TenantId] = @JnandeepTenantId;

    PRINT '[Step 11] Cleaned all Student Directory records.';

    -- Commit transaction
    COMMIT TRANSACTION;
    PRINT '-------------------------------------------------------------';
    PRINT 'SUCCESS: All test data for Jnandeep Campus wiped clean!';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT 'ERROR ENCOUNTERED! Entire transaction rolled back.';
    PRINT 'Error Message: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO

-- =============================================================
-- VERIFICATION REPORT
-- =============================================================
DECLARE @JnandeepTenantId UNIQUEIDENTIFIER;
SELECT TOP 1 @JnandeepTenantId = [Id] FROM [dbo].[Tenants] WHERE [Code] = 'JNANDEEP' OR [Code] = 'JNADEEP';

SELECT 'PRESERVED: Tenants' AS [Category], COUNT(*) AS [Count] FROM [dbo].[Tenants] WHERE [Id] = @JnandeepTenantId
UNION ALL
SELECT 'PRESERVED: Branches', COUNT(*) FROM [dbo].[Branches] WHERE [TenantId] = @JnandeepTenantId
UNION ALL
SELECT 'PRESERVED: Users / Logins', COUNT(*) FROM [dbo].[Users] WHERE [TenantId] = @JnandeepTenantId
UNION ALL
SELECT 'PRESERVED: Roles', COUNT(*) FROM [dbo].[Roles] WHERE [TenantId] = @JnandeepTenantId
UNION ALL
SELECT 'PRESERVED: Fee Heads Master', COUNT(*) FROM [dbo].[FeeHeads] WHERE [TenantId] = @JnandeepTenantId
UNION ALL
SELECT 'PRESERVED: School Classes', COUNT(*) FROM [dbo].[SchoolClasses] WHERE [TenantId] = @JnandeepTenantId
UNION ALL
SELECT 'PRESERVED: School Sections', COUNT(*) FROM [dbo].[SchoolSections] WHERE [TenantId] = @JnandeepTenantId
UNION ALL
SELECT 'PRESERVED: Batches', COUNT(*) FROM [dbo].[Batches] WHERE [TenantId] = @JnandeepTenantId
UNION ALL
SELECT 'CLEANED: Students (Should be 0)', COUNT(*) FROM [dbo].[Students] WHERE [TenantId] = @JnandeepTenantId
UNION ALL
SELECT 'CLEANED: Fee Invoices (Should be 0)', COUNT(*) FROM [dbo].[FeeInvoices] WHERE [TenantId] = @JnandeepTenantId
UNION ALL
SELECT 'CLEANED: Fee Payments (Should be 0)', COUNT(*) FROM [dbo].[FeePayments] WHERE [TenantId] = @JnandeepTenantId
UNION ALL
SELECT 'CLEANED: Student Attendance (Should be 0)', COUNT(*) FROM [dbo].[StudentAttendances] WHERE [TenantId] = @JnandeepTenantId
UNION ALL
SELECT 'CLEANED: Test Exams (Should be 0)', COUNT(*) FROM [dbo].[Tests] WHERE [TenantId] = @JnandeepTenantId
UNION ALL
SELECT 'CLEANED: Inventory Outwards (Should be 0)', COUNT(*) FROM [dbo].[InventoryOutwards] WHERE [TenantId] = @JnandeepTenantId;
GO
