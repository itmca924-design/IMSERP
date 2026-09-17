using IMSERP.Domain.Enums;

namespace IMSERP.Application.DTOs;

public record LoginRequestDto(string TenantCode, string Username, string Password);

public record LoginResponseDto(
    string Token,
    string RefreshToken,
    Guid UserId,
    string Username,
    string FullName,
    string Role,
    Guid TenantId,
    string InstituteName,
    string TenantCode,
    string? ProfilePhoto,
    Guid? BranchId = null,
    string? BranchName = null,
    List<BranchDto>? Branches = null
);

public record BranchDto(
    Guid Id,
    Guid TenantId,
    string Name,
    string Code,
    string? Address,
    string? ContactPhone,
    bool IsMainBranch,
    bool IsActive,
    DateTime CreatedAt,
    int StudentCount = 0,
    int BatchCount = 0,
    int RoomCount = 0
);

public record CreateBranchDto(
    string Name,
    string Code,
    string? Address,
    string? ContactPhone,
    bool IsMainBranch = false
);

public record UpdateBranchDto(
    string Name,
    string? Address,
    string? ContactPhone,
    bool IsActive
);

public record RoomDto(
    Guid Id,
    Guid TenantId,
    Guid BranchId,
    string? BranchName,
    string RoomNumber,
    int Capacity,
    string? Floor,
    bool IsActive,
    DateTime CreatedAt,
    int ActiveBatchCount = 0
);

public record CreateRoomDto(
    Guid BranchId,
    string RoomNumber,
    int Capacity,
    string? Floor
);

public record UpdateRoomDto(
    string RoomNumber,
    int Capacity,
    string? Floor,
    bool IsActive
);

public record RefreshTokenRequestDto(string Token, string RefreshToken);

public record RegisterInstituteDto(
    string InstituteName,
    string InstituteCode,
    string AdminFullName,
    string AdminUsername,
    string AdminPassword,
    string Phone,
    string Address,
    string? ProfilePhoto = null
);

public record TenantDto(
    Guid Id,
    string Name,
    string Code,
    string? ContactPhone,
    string? Address,
    string? ProfilePhoto,
    string? WhatsAppPhoneId,
    bool IsActive,
    DateTime CreatedAt,
    int StudentCount,
    int BatchCount
);

public record CreateTenantDto(
    string Name,
    string Code,
    string? ContactPhone,
    string? Address,
    string? ProfilePhoto,
    string? WhatsAppPhoneId,
    string? WhatsAppAccessToken,
    string AdminUsername,
    string AdminPassword,
    string AdminFullName,
    List<CreateBranchDto>? Branches = null
);

public record UpdateTenantDto(
    string Name,
    string? ContactPhone,
    string? Address,
    string? ProfilePhoto,
    string? WhatsAppPhoneId,
    string? WhatsAppAccessToken
);

public record StudentDto(
    Guid Id,
    Guid BatchId,
    string BatchName,
    string RollNumber,
    string StudentName,
    string ParentName,
    string ParentWhatsAppPhone,
    bool IsActive,
    DateTime JoiningDate,
    string? Address,
    string? ProfilePhoto,
    Guid? BranchId = null,
    string? BranchName = null
);

public record CreateStudentDto(
    Guid BatchId,
    string RollNumber,
    string StudentName,
    string ParentName,
    string ParentWhatsAppPhone,
    string Address,
    string? ProfilePhoto,
    Guid? BranchId = null
);

public record StudentAttendanceDto(
    Guid Id,
    Guid StudentId,
    string StudentName,
    string RollNumber,
    DateTime AttendanceDate,
    string Status,
    string? Remarks,
    string CaptureSource,
    DateTime? CapturedAt = null
);

public record StudentAttendanceSummaryDto(
    int PresentDays,
    int AbsentDays,
    int LateDays,
    int HalfDays,
    int HolidayDays,
    int TotalWorkingDays,
    decimal AttendancePercentage
);

public record MarkStudentAttendanceDto(
    DateTime AttendanceDate,
    string Status,
    string? Remarks
);

public record BatchStudentAttendanceItemDto(
    Guid StudentId,
    string Status,
    string? Remarks
);

public record BulkBatchAttendanceDto(
    Guid BatchId,
    DateTime AttendanceDate,
    bool SendWhatsAppAlerts,
    List<BatchStudentAttendanceItemDto> Items
);

public record BatchAttendanceStudentRowDto(
    Guid StudentId,
    string StudentName,
    string RollNumber,
    string? ProfilePhoto,
    string? ParentWhatsAppPhone,
    string Status,
    string? Remarks,
    Guid? AttendanceId,
    DateTime? CapturedAt = null,
    string? CaptureSource = null
);

public record AttendanceReportRowDto(
    Guid PersonId,
    string PersonName,
    string Code,
    string GroupName,
    int PresentDays,
    int AbsentDays,
    int LateDays,
    int HalfDays,
    int HolidayDays,
    int TotalWorkingDays,
    decimal AttendancePercentage
);

public record AttendanceReportDto(
    string ReportType,
    int Month,
    int Year,
    int TotalPeople,
    int TotalPresentDays,
    int TotalAbsentDays,
    int TotalLateDays,
    int TotalHalfDays,
    int TotalHolidayDays,
    List<AttendanceReportRowDto> Rows
);

public record BatchDto(
    Guid Id,
    string Name,
    string Subject,
    string AcademicYear,
    decimal StandardMonthlyFee,
    int StudentCount,
    Guid? BranchId = null,
    string? BranchName = null,
    Guid? RoomId = null,
    string? RoomNumber = null
);

public record CreateBatchDto(
    string Name,
    string Subject,
    string AcademicYear,
    decimal StandardMonthlyFee,
    Guid? BranchId = null,
    Guid? RoomId = null
);

public record FeeInvoiceDto(
    Guid Id,
    Guid StudentId,
    string StudentName,
    string RollNumber,
    string ParentWhatsAppPhone,
    string InvoiceNumber,
    string Title,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal DueAmount,
    DateTime DueDate,
    string Status
);

public record CreateInvoiceDto(
    Guid StudentId,
    string Title,
    decimal TotalAmount,
    DateTime DueDate
);

public record CollectFeeDto(
    Guid InvoiceId,
    decimal AmountPaid,
    PaymentMode Mode,
    string TransactionRef,
    string Remarks,
    bool SendWhatsAppReceipt
);

public record FeePaymentReceiptDto(
    Guid PaymentId,
    string ReceiptNumber,
    string StudentName,
    string RollNumber,
    string BatchName,
    string ParentName,
    string ParentPhone,
    string InvoiceNumber,
    decimal AmountPaid,
    decimal RemainingDue,
    DateTime PaymentDate,
    PaymentMode Mode,
    string? TransactionRef,
    string? Remarks
);

public record FeeDueSlipItemDto(
    Guid InvoiceId,
    string InvoiceNumber,
    string Title,
    DateTime DueDate,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal DueAmount
);

public record FeeDueSlipDto(
    Guid StudentId,
    string StudentName,
    string RollNumber,
    string BatchName,
    string ParentName,
    string ParentPhone,
    decimal TotalOutstandingDue,
    DateTime GeneratedDate,
    List<FeeDueSlipItemDto> DueItems
);

public record TestDto(
    Guid Id,
    Guid BatchId,
    string BatchName,
    string Title,
    string Subject,
    decimal MaxMarks,
    DateTime TestDate,
    int TotalStudentsEvaluated
);

public record CreateTestDto(
    Guid BatchId,
    string Title,
    string Subject,
    decimal MaxMarks,
    DateTime TestDate
);

public record StudentMarksEntryItem(
    Guid StudentId,
    string StudentName,
    string RollNumber,
    decimal MarksObtained,
    bool IsAbsent,
    string Remarks
);

public record BulkSaveMarksDto(
    Guid TestId,
    List<StudentMarksEntryItem> MarksList,
    bool NotifyParentsViaWhatsApp
);

public record TestReportCardDto(
    Guid TestId,
    string TestTitle,
    string Subject,
    decimal MaxMarks,
    List<StudentRankItem> Rankings
);

public record StudentRankItem(
    Guid StudentId,
    string StudentName,
    string RollNumber,
    decimal MarksObtained,
    decimal Percentage,
    int Rank,
    bool IsAbsent,
    string Remarks
);

public record ExamAdmitCardDto(
    Guid TestId,
    string ExamTitle,
    string Subject,
    DateTime ExamDate,
    decimal MaxMarks,
    string BatchName,
    string BranchName,
    List<StudentAdmitCardItemDto> Students
);

public record StudentAdmitCardItemDto(
    Guid StudentId,
    string StudentName,
    string RollNumber,
    string BatchName,
    string ParentName,
    string ParentWhatsAppPhone,
    string? PhotoUrl,
    decimal OutstandingDue,
    bool IsFeeCleared,
    string ExamRollNumber,
    string CenterName,
    string ReportingTime,
    string ExamDuration
);

public record MonthlyRevenueTrendItemDto(
    string MonthName,
    int Year,
    int Month,
    decimal BilledAmount,
    decimal CollectedAmount
);

public record BatchDistributionItemDto(
    Guid BatchId,
    string BatchName,
    int StudentCount,
    decimal MonthlyFeeRate,
    decimal TotalMonthlyRevenuePotential
);

public record FeeCollectionBreakdownDto(
    decimal TotalBilled,
    decimal TotalPaid,
    decimal TotalPending,
    decimal RecoveryPercentage
);

public record TodayAttendanceSummaryDto(
    int TotalMarked,
    int PresentCount,
    int AbsentCount,
    int LateCount,
    int HalfDayCount,
    decimal AttendancePercentage,
    string? LastMarkedTime,
    string? LastBatchName
);

public record DashboardSummaryDto(
    int TotalStudents,
    int ActiveBatches,
    decimal TotalFeeCollectedThisMonth,
    decimal PendingFeesTotal,
    int TotalTestsConducted,
    int WhatsAppMessagesSent,
    List<FeeInvoiceDto> OverdueInvoices,
    List<TestDto> RecentTests,
    List<MonthlyRevenueTrendItemDto> RevenueTrends,
    List<BatchDistributionItemDto> BatchDistributions,
    FeeCollectionBreakdownDto FeeBreakdown,
    TodayAttendanceSummaryDto? TodayAttendance = null
);

public record MenuItemDto(
    Guid Id,
    string Title,
    string? RouteUrl,
    string? Icon,
    Guid? ParentId,
    int SortOrder,
    string Module,
    bool IsActive,
    List<MenuItemDto> Children
);

public record RolePermissionDto(
    Guid Id,
    Guid RoleId,
    Guid MenuItemId,
    string MenuTitle,
    string? RouteUrl,
    string? Icon,
    string Module,
    bool CanView,
    bool CanCreate,
    bool CanEdit,
    bool CanDelete
);

public record SaveRolePermissionsDto(
    Guid RoleId,
    List<RolePermissionDto> Permissions
);

public record RoleDto(
    Guid Id,
    string Name,
    string? Description,
    bool IsActive,
    int UserCount,
    List<RolePermissionDto> Permissions
);

public record CreateRoleDto(
    string Name,
    string? Description,
    bool IsActive,
    List<RolePermissionDto>? Permissions
);

public record UserDto(
    Guid Id,
    string Username,
    string FullName,
    string? Email,
    string? PhoneNumber,
    string RoleName,
    Guid? RoleId,
    bool IsActive,
    DateTime CreatedAt,
    Guid? BranchId = null,
    string? BranchName = null
);

public record CreateUserDto(
    string Username,
    string Password,
    string FullName,
    string? Email,
    string? PhoneNumber,
    Guid RoleId,
    bool IsActive,
    Guid? BranchId = null
);

public record BatchPagedQueryDto(
    int PageNumber = 1,
    int PageSize = 10,
    string? SearchTerm = null,
    string? SortBy = "Name",
    bool SortDescending = false
);

public record SubjectDto(
    Guid Id,
    string Name,
    string? Code,
    string? Description,
    bool IsActive,
    DateTime CreatedAt
);

public record CreateSubjectDto(
    string Name,
    string? Code,
    string? Description,
    bool IsActive = true
);

public record PagedResultDto<T>(
    List<T> Items,
    int TotalCount,
    int PageNumber,
    int PageSize
);

public record FeeInvoicePagedItemDto(
    Guid Id,
    Guid StudentId,
    string StudentName,
    string RollNumber,
    string BatchName,
    string ParentWhatsAppPhone,
    string InvoiceNumber,
    string Title,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal DueAmount,
    DateTime DueDate,
    string Status
);

public record StudentLedgerInvoiceItemDto(
    Guid Id,
    string InvoiceNumber,
    string Title,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal DueAmount,
    DateTime DueDate,
    string Status
);

public record StudentLedgerPaymentItemDto(
    Guid PaymentId,
    string ReceiptNumber,
    string InvoiceNumber,
    decimal AmountPaid,
    PaymentMode Mode,
    string? TransactionRef,
    string? Remarks,
    DateTime PaymentDate
);

public record StudentLedgerDto(
    Guid StudentId,
    string StudentName,
    string RollNumber,
    string BatchName,
    string ParentName,
    string ParentWhatsAppPhone,
    decimal StandardMonthlyFee,
    decimal TotalFeesCharged,
    decimal TotalFeesPaid,
    decimal TotalOutstandingDue,
    List<StudentLedgerInvoiceItemDto> Invoices,
    List<StudentLedgerPaymentItemDto> Payments
);

public record CollectFifoFeeDto(
    Guid StudentId,
    decimal AmountPaid,
    PaymentMode Mode,
    string? TransactionRef,
    string? Remarks,
    bool SendWhatsAppReceipt
);

public record WhatsAppLogPagedItemDto(
    Guid Id,
    string RecipientPhone,
    string StudentName,
    string MessageType,
    string Content,
    string Status,
    DateTime SentAt
);

public record GenerateMonthlyInvoicesRequestDto(
    int Year,
    int Month,
    Guid? BatchId,
    DateTime DueDate
);

public record GenerateMonthlyInvoicesResultDto(
    int GeneratedCount,
    int SkippedCount,
    string Message
);

public record CancelInvoiceDto(
    string Reason
);

// ─── Teacher Module DTOs ──────────────────────────────────────

public record TeacherDto(
    Guid Id,
    string EmployeeCode,
    string FullName,
    string? FatherName,
    string Gender,
    DateTime? DateOfBirth,
    string? Qualification,
    string? Specialization,
    int ExperienceYears,
    string PhoneNumber,
    string? WhatsAppPhone,
    string? Email,
    string? Address,
    string? PhotoUrl,
    DateTime JoiningDate,
    DateTime? LeavingDate,
    bool IsActive,
    DateTime CreatedAt,
    int AssignedBatchCount,
    Guid? BranchId = null,
    string? BranchName = null
);

public record CreateTeacherDto(
    string EmployeeCode,
    string FullName,
    string? FatherName,
    string Gender,
    DateTime? DateOfBirth,
    string? Qualification,
    string? Specialization,
    int ExperienceYears,
    string PhoneNumber,
    string? WhatsAppPhone,
    string? Email,
    string? Address,
    DateTime JoiningDate,
    bool IsActive = true,
    Guid? BranchId = null
);

public record TeacherBatchAssignmentDto(
    Guid Id,
    Guid TeacherId,
    string TeacherName,
    Guid BatchId,
    string BatchName,
    string Subject,
    string? DaysOfWeek,
    string? TimeSlot,
    bool IsActive,
    DateTime AssignedAt
);

public record CreateTeacherBatchAssignmentDto(
    Guid TeacherId,
    Guid BatchId,
    string Subject,
    string? DaysOfWeek,
    string? TimeSlot
);

public record TeacherBatchSlotDto(
    Guid BatchId,
    string Subject,
    string? DaysOfWeek,
    string? TimeSlot
);

public record BulkCreateTeacherBatchAssignmentDto(
    Guid TeacherId,
    List<TeacherBatchSlotDto> Slots
);

public record TeacherAttendanceDto(
    Guid Id,
    Guid TeacherId,
    string TeacherName,
    string EmployeeCode,
    DateTime AttendanceDate,
    string Status,
    string? CheckInTime,
    string? CheckOutTime,
    string? Remarks,
    string CaptureSource,
    DateTime? CapturedAt
);

public record MarkTeacherAttendanceDto(
    DateTime AttendanceDate,
    string Status,
    string? CheckInTime,
    string? CheckOutTime,
    string? Remarks
);

public record AttendanceSettingsDto(string StudentMode, string TeacherMode);

public record BiometricAttendanceEventDto(
    string PersonType,
    string BiometricUserId,
    DateTime EventTime,
    string? DeviceId,
    string? EventId,
    bool IsCheckOut = false
);

public record BiometricMappingDto(string BiometricUserId);

public record AttendancePermissionsDto(
    bool CanChangeMode,
    bool CanManualMark,
    bool CanBiometricCapture,
    bool CanMapBiometric,
    bool CanCorrectAttendance
);

public record BiometricDeviceDto(
    Guid Id, string Name, string? Brand, string? Model, string? SerialNumber,
    string? IpAddress, int Port, string ConnectionMode, bool IsActive,
    string Status, DateTime? LastSeenAt, DateTime? LastSyncAt, string? LastError
);

public record SaveBiometricDeviceDto(
    string Name, string? Brand, string? Model, string? SerialNumber,
    string? IpAddress, int Port, string ConnectionMode, bool IsActive
);

public record BiometricEventLogDto(
    Guid Id, Guid? DeviceId, string PersonType, string BiometricUserId,
    DateTime EventTime, string? DeviceEventId, string Status, string? ErrorMessage,
    Guid? AttendanceId, DateTime ReceivedAt
);

public record BiometricMappingPersonDto(Guid Id, string PersonType, string Name, string Code, string? BiometricUserId, string? BatchName);

public record BulkAttendanceEntryItem(
    Guid TeacherId,
    string Status,
    string? CheckInTime,
    string? CheckOutTime,
    string? Remarks
);

public record BulkMarkAttendanceDto(
    DateTime AttendanceDate,
    List<BulkAttendanceEntryItem> Entries
);

public record TeacherAttendanceSummaryDto(
    int PresentDays,
    int AbsentDays,
    int LateDays,
    int HalfDays,
    int HolidayDays,
    int TotalWorkingDays,
    decimal AttendancePercentage,
    int AllowedLateDays = 3,
    int ExcessLateDays = 0,
    decimal LatePenaltyDays = 0,
    decimal PayableDays = 0
);

public record TeacherPayrollPreviewDto(
    Guid TeacherId,
    string TeacherName,
    string EmployeeCode,
    int Month,
    int Year,
    decimal BasicSalary,
    decimal HRA,
    decimal OtherAllowances,
    decimal GrossSalary,
    decimal PFDeduction,
    decimal TDSDeduction,
    decimal OtherDeductions,
    int TotalWorkingDays,
    decimal PerDayRate,
    int PresentDays,
    int AbsentDays,
    int HalfDays,
    int LateDays,
    int AllowedLateDays,
    int ExcessLateDays,
    decimal LatePenaltyDays,
    decimal AbsentDeduction,
    decimal HalfDayDeduction,
    decimal LatePenaltyDeduction,
    decimal TotalAttendanceDeduction,
    decimal PendingAdvance,
    decimal RecommendedNetPaid
);

public record TeacherSalaryDto(
    Guid Id,
    Guid TeacherId,
    string TeacherName,
    decimal BasicSalary,
    decimal HRA,
    decimal OtherAllowances,
    decimal GrossSalary,
    decimal PFDeduction,
    decimal TDSDeduction,
    decimal OtherDeductions,
    decimal NetSalary,
    DateTime EffectiveFrom,
    DateTime? EffectiveTo,
    bool IsActive
);

public record CreateTeacherSalaryDto(
    Guid TeacherId,
    decimal BasicSalary,
    decimal HRA,
    decimal OtherAllowances,
    decimal PFDeduction,
    decimal TDSDeduction,
    decimal OtherDeductions,
    DateTime EffectiveFrom,
    DateTime? EffectiveTo
);

public record TeacherSalaryPaymentDto(
    Guid Id,
    Guid TeacherId,
    string TeacherName,
    string EmployeeCode,
    int PaymentMonth,
    int PaymentYear,
    string MonthName,
    DateTime PaymentDate,
    decimal GrossAmount,
    decimal Deductions,
    decimal AdvanceAdjusted,
    decimal NetPaid,
    string PaymentMode,
    string? TransactionRef,
    string ReceiptNumber,
    int PresentDays,
    int AbsentDays,
    string? Remarks
);

public record CreateSalaryPaymentDto(
    Guid TeacherId,
    int PaymentMonth,
    int PaymentYear,
    DateTime PaymentDate,
    decimal GrossAmount,
    decimal Deductions,
    decimal AdvanceAdjusted,
    decimal NetPaid,
    string PaymentMode,
    string? TransactionRef,
    int PresentDays,
    int AbsentDays,
    string? Remarks
);

public record TeacherSalaryAdvanceDto(
    Guid Id,
    Guid TeacherId,
    string TeacherName,
    string EmployeeCode,
    decimal Amount,
    DateTime RequestDate,
    DateTime? ApprovedDate,
    string? Reason,
    string Status,
    int? AdjustedInMonth,
    int? AdjustedInYear
);

public record CreateAdvanceDto(
    Guid TeacherId,
    decimal Amount,
    string? Reason
);

public record ApproveAdvanceDto(
    bool Approve,
    int? AdjustedInMonth,
    int? AdjustedInYear
);

public record TeacherLeaveDto(
    Guid Id,
    Guid TeacherId,
    string TeacherName,
    string EmployeeCode,
    string LeaveType,
    DateTime FromDate,
    DateTime ToDate,
    int TotalDays,
    string? Reason,
    string Status,
    string? ApprovedBy,
    DateTime? ApprovedAt,
    string? RejectionReason,
    DateTime CreatedAt
);

public record ApplyLeaveDto(
    Guid TeacherId,
    string LeaveType,
    DateTime FromDate,
    DateTime ToDate,
    string? Reason
);

public record ApproveLeaveDto(
    bool Approve,
    string? RejectionReason
);

public record TeacherDashboardDto(
    Guid TeacherId,
    string FullName,
    string EmployeeCode,
    string? Specialization,
    int AssignedBatches,
    int TotalStudents,
    TeacherAttendanceSummaryDto AttendanceThisMonth,
    decimal? CurrentNetSalary,
    decimal TotalSalaryPaidThisYear,
    int PendingLeaves,
    int ApprovedLeavesThisYear,
    decimal PendingAdvanceAmount
);

public record HolidayDto(
    Guid Id,
    string Title,
    DateTime StartDate,
    DateTime EndDate,
    string HolidayType,
    string? Description,
    bool IsActive,
    DateTime CreatedAt
);

public record CreateHolidayDto(
    string Title,
    DateTime StartDate,
    DateTime EndDate,
    string HolidayType,
    string? Description
);

public record UpdateHolidayDto(
    string Title,
    DateTime StartDate,
    DateTime EndDate,
    string HolidayType,
    string? Description,
    bool IsActive
);
