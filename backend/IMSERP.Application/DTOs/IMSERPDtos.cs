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

public record SchoolClassDto(
    Guid Id,
    Guid TenantId,
    string Name,
    string? Code,
    int DisplayOrder,
    bool IsActive,
    DateTime CreatedAt,
    Guid? BranchId = null,
    int SectionCount = 0,
    int StudentCount = 0,
    List<SchoolSectionDto>? Sections = null
);

public record CreateSchoolClassDto(
    string Name,
    string? Code,
    int DisplayOrder = 0,
    Guid? BranchId = null
);

public record UpdateSchoolClassDto(
    string Name,
    string? Code,
    int DisplayOrder,
    bool IsActive
);

public record SchoolSectionDto(
    Guid Id,
    Guid TenantId,
    Guid ClassId,
    string? ClassName,
    string Name,
    int MaxCapacity,
    Guid? RoomId,
    string? RoomNumber,
    bool IsActive,
    DateTime CreatedAt,
    Guid? BranchId = null,
    int StudentCount = 0,
    Guid? ClassTeacherId = null,
    string? ClassTeacherName = null,
    string? ClassTeacherEmployeeCode = null
);

public record CreateSchoolSectionDto(
    Guid ClassId,
    string Name,
    int MaxCapacity = 45,
    Guid? RoomId = null,
    Guid? BranchId = null,
    Guid? ClassTeacherId = null
);

public record UpdateSchoolSectionDto(
    string Name,
    int MaxCapacity,
    Guid? RoomId,
    bool IsActive,
    Guid? ClassTeacherId = null
);

public record EnrollSchoolStudentInCoachingDto(
    Guid StudentId,
    Guid BatchId,
    string? CoachingRollNumber,
    decimal? CustomMonthlyFee = null
);

public record StudentDto(
    Guid Id,
    Guid? BatchId,
    string? BatchName,
    string RollNumber,
    string StudentName,
    string ParentName,
    string ParentWhatsAppPhone,
    bool IsActive,
    DateTime JoiningDate,
    string? Address,
    string? ProfilePhoto,
    Guid? BranchId = null,
    string? BranchName = null,
    Guid? ClassId = null,
    string? ClassName = null,
    Guid? SectionId = null,
    string? SectionName = null,
    string? AdmissionNumber = null,
    string? SchoolRollNumber = null,
    string? CoachingRollNumber = null,
    bool IsSchoolStudent = false,
    bool IsCoachingStudent = true,
    string? MotherName = null,
    string? Gender = null,
    DateTime? DateOfBirth = null,
    string? BloodGroup = null,
    bool IsHostelStudent = false,
    Guid? HostelBedId = null,
    string? HostelName = null,
    string? RoomNumber = null,
    string? BedCode = null,
    Guid? HostelId = null,
    DateTime? LeavingDate = null,
    string? LeavingReason = null,
    string? TCNumber = null,
    bool IsLibraryMember = false,
    string? LibraryCardNumber = null,
    string? LibraryMembershipType = null,
    int MaxLibraryBooks = 2,
    decimal MonthlyLibraryFee = 0
);

public record StudentLeavingClearanceDto(
    Guid StudentId,
    string StudentName,
    string RollNumber,
    bool IsActive,
    decimal PendingFees,
    int PendingInvoicesCount,
    bool HasHostelBed,
    Guid? HostelBedId,
    Guid? HostelAllocationId,
    string? HostelName,
    string? RoomNumber,
    string? BedCode,
    int IssuedLibraryBooksCount,
    decimal PendingLibraryFines,
    string? ExistingTCNumber,
    DateTime? ExistingLeavingDate,
    string? ExistingLeavingReason
);

public record MarkStudentLeftDto(
    DateTime LeavingDate,
    string LeavingReason, // e.g., "TC Issued", "School Transfer", "Course Completed", "Dropped Out", "Rusticated", "Other"
    string? Remarks,
    bool VacateHostelBed = true,
    string? CustomTCNumber = null
);

public record MarkStudentLeftResultDto(
    bool Success,
    string Message,
    string TCNumber,
    DateTime LeavingDate,
    string LeavingReason,
    decimal PendingFeesRemaining,
    bool HostelVacated
);

public record ReAdmitStudentDto(
    DateTime ReAdmissionDate,
    string? Remarks = null,
    Guid? ClassId = null,
    Guid? SectionId = null,
    Guid? BatchId = null,
    string? NewRollNumber = null,
    decimal ReAdmissionFee = 0,
    bool ResetTC = true
);


public record CreateStudentDto(
    Guid? BatchId,
    string? RollNumber,
    string StudentName,
    string ParentName,
    string ParentWhatsAppPhone,
    string? Address,
    string? ProfilePhoto,
    Guid? BranchId = null,
    Guid? ClassId = null,
    Guid? SectionId = null,
    string? AdmissionNumber = null,
    string? SchoolRollNumber = null,
    string? CoachingRollNumber = null,
    bool IsSchoolStudent = false,
    bool IsCoachingStudent = true,
    string? MotherName = null,
    string? Gender = null,
    DateTime? DateOfBirth = null,
    string? BloodGroup = null,
    bool IsHostelStudent = false,
    Guid? HostelBedId = null,
    bool IsLibraryMember = false,
    string? LibraryCardNumber = null,
    string? LibraryMembershipType = null,
    int MaxLibraryBooks = 2,
    decimal MonthlyLibraryFee = 0
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
    decimal AttendancePercentage,
    string? DailyStatuses = null
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
    string? RoomNumber = null,
    string Category = "Coaching",
    Guid? ClassId = null,
    Guid? SectionId = null,
    string? SectionName = null
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

public record FeeReceiptLineItemDto(
    int ItemIndex,
    string Particulars,
    string? SubTitle,
    string? Reference,
    decimal Amount
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
    string? Remarks,
    decimal TuitionAmountPaid = 0,
    decimal LibraryFineAmountPaid = 0,
    string? LibraryFineParticulars = null,
    decimal PendingLibraryFine = 0,
    List<FeeReceiptLineItemDto>? Items = null,
    string? HostelInfo = null
);

public record StudentPendingFineItemDto(
    Guid CirculationId,
    string AccessionNumber,
    string BookTitle,
    int OverdueDays,
    decimal FineAmount,
    DateTime DueDate,
    DateTime? ReturnDate
);

public record StudentLibraryDuesDto(
    Guid StudentId,
    decimal PendingFineAmount,
    int PendingFinesCount,
    List<StudentPendingFineItemDto> PendingFines,
    int ActiveOverdueBooksCount
);

public record ReversePaymentDto(string Reason);

public record ReversePaymentResponseDto(
    string Message,
    string InvoiceNumber,
    decimal NewPaidAmount,
    decimal NewDueAmount,
    string NewInvoiceStatus
);

public record FeeDueSlipItemDto(
    Guid InvoiceId,
    string InvoiceNumber,
    string Title,
    DateTime DueDate,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal DueAmount,
    List<FeeInvoiceItemDto>? Breakdown = null
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
    List<FeeDueSlipItemDto> DueItems,
    decimal PendingLibraryFine = 0,
    int ActiveOverdueBooksCount = 0,
    string? HostelInfo = null
);

public record TestDto(
    Guid Id,
    Guid? BatchId,
    string? BatchName,
    string Title,
    string Subject,
    decimal MaxMarks,
    DateTime TestDate,
    int TotalStudentsEvaluated
);

public record CreateTestDto(
    Guid? BatchId,
    string Title,
    string Subject,
    decimal MaxMarks,
    DateTime TestDate,
    Guid? ClassId = null,
    Guid? SectionId = null,
    string? ExamType = "Annual Exam",
    string? AcademicYear = null,
    decimal PassingMarks = 33
);

public record StudentMarksEntryItem(
    Guid StudentId,
    string StudentName,
    string RollNumber,
    decimal MarksObtained,
    bool IsAbsent,
    string Remarks,
    string ClassName = "",
    string SectionName = "",
    string BatchName = "",
    bool IsSchoolStudent = false,
    bool IsCoachingStudent = false,
    string EnrollmentType = ""
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
    List<StudentRankItem> Rankings,
    string BatchName = "",
    string BranchName = "",
    DateTime? TestDate = null
);

public record StudentRankItem(
    Guid StudentId,
    string StudentName,
    string RollNumber,
    decimal MarksObtained,
    decimal Percentage,
    int Rank,
    bool IsAbsent,
    string Remarks,
    string ParentWhatsAppPhone = "",
    string ParentName = "",
    string ClassName = "",
    string SectionName = "",
    string BatchName = "",
    bool IsSchoolStudent = false,
    bool IsCoachingStudent = false,
    string EnrollmentType = "",
    string SchoolRollNumber = "",
    string CoachingRollNumber = ""
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
    string Status,
    string? CancellationReason = null,
    DateTime? CancelledAt = null,
    List<FeeInvoiceItemDto>? Items = null,
    string? ClassName = null,
    string? SectionName = null,
    bool IsSchoolStudent = false,
    bool IsCoachingStudent = true,
    string? CurrentClassName = null,
    string? CurrentSectionName = null
);

public record StudentLedgerInvoiceItemDto(
    Guid Id,
    string InvoiceNumber,
    string Title,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal DueAmount,
    DateTime DueDate,
    string Status,
    string? CancellationReason = null,
    DateTime? CancelledAt = null,
    List<FeeInvoiceItemDto>? Items = null
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
    List<StudentLedgerPaymentItemDto> Payments,
    decimal PendingLibraryFine = 0
);

public record FeeItemPaymentDto(
    Guid ItemId,
    decimal Amount
);

public record CollectFifoFeeDto(
    Guid StudentId,
    decimal AmountPaid,
    PaymentMode Mode,
    string? TransactionRef,
    string? Remarks,
    bool SendWhatsAppReceipt,
    bool IncludeLibraryFine = false,
    List<Guid>? LibraryCirculationIds = null,
    List<FeeItemPaymentDto>? ItemPayments = null
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
    DateTime DueDate,
    BillingCycle BillingCycle = BillingCycle.Monthly,
    Guid? ClassId = null,
    Guid? StudentId = null
);

public record GenerateMonthlyInvoicesResultDto(
    int GeneratedCount,
    int SkippedCount,
    string Message
);

public record PendingInvoicingStudentDto(
    Guid StudentId,
    string StudentName,
    string RollNumber,
    string? AdmissionNumber,
    Guid? ClassId,
    string? ClassName,
    Guid? BatchId,
    string? BatchName,
    DateTime JoiningDate,
    decimal EstimatedMonthlyFee
);

public record CancelInvoiceDto(
    string Reason
);

public record AddFeeInvoiceItemDto(
    Guid? FeeHeadId,
    string HeadName,
    decimal Amount
);

public record UpdateInvoiceHeadsRequestDto(
    List<AddFeeInvoiceItemDto> Items
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
    string? BranchName = null,
    Guid? UserId = null,
    string? Username = null,
    bool HasLoginAccount = false
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
    Guid? BatchId,
    string? BatchName,
    string Subject,
    string? DaysOfWeek,
    string? TimeSlot,
    bool IsActive,
    DateTime AssignedAt,
    Guid? ClassId = null,
    string? ClassName = null,
    Guid? SectionId = null,
    string? SectionName = null
);

public record CreateTeacherBatchAssignmentDto(
    Guid TeacherId,
    Guid? BatchId,
    string Subject,
    string? DaysOfWeek,
    string? TimeSlot,
    Guid? ClassId = null,
    Guid? SectionId = null
);

public record TeacherBatchSlotDto(
    Guid? BatchId,
    string Subject,
    string? DaysOfWeek,
    string? TimeSlot,
    Guid? ClassId = null,
    Guid? SectionId = null
);

public record BulkCreateTeacherBatchAssignmentDto(
    Guid TeacherId,
    List<TeacherBatchSlotDto> Slots
);

public record CreateTeacherUserAccountDto(
    string Username,
    string Password,
    Guid? RoleId = null
);

public record SendTeacherSalarySlipWhatsAppDto(
    Guid PaymentId
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

public record AttendanceSettingsDto(string StudentMode, string TeacherMode, string HostelMode = "Both");

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

// ─── Teacher Reports & Analytics DTOs ──────────────────────────────
public record TeacherWorkloadSummaryItemDto(
    Guid TeacherId,
    string TeacherName,
    string EmployeeCode,
    string? Qualification,
    string? Specialization,
    int AssignedBatchCount,
    int WeeklyClassesCount,
    decimal WeeklyHours,
    int TotalStudentReach,
    List<TeacherBatchAssignmentDto> AssignedBatches
);

public record TeacherWorkloadReportDto(
    int TotalActiveTeachers,
    int TotalAssignedBatches,
    int TotalWeeklyClasses,
    decimal TotalWeeklyHours,
    int TotalStudentsReached,
    List<TeacherWorkloadSummaryItemDto> Teachers
);

public record TeacherBatchCoverageReportDto(
    int TotalBatches,
    int AssignedBatchesCount,
    int UnassignedBatchesCount,
    decimal CoveragePercentage,
    List<BatchDto> UnassignedBatches,
    List<TeacherBatchAssignmentDto> AllAssignments
);

public record TeacherMonthlyPayrollReportDto(
    int Month,
    int Year,
    string MonthName,
    int TotalTeachers,
    int PaidTeachersCount,
    int PendingTeachersCount,
    decimal TotalGrossAmount,
    decimal TotalDeductions,
    decimal TotalAdvancesAdjusted,
    decimal TotalNetPaid,
    List<TeacherSalaryPaymentDto> Payments
);

// --- Library Management System DTOs ---

public record LibraryBookDto(
    Guid Id,
    Guid TenantId,
    Guid? BranchId,
    string Title,
    string Author,
    string? Publisher,
    string? Edition,
    string? ISBN,
    string Category,
    string? Subject,
    Guid? ClassId,
    string? ClassName,
    string? Description,
    int TotalCopies,
    int AvailableCopies,
    int IssuedCopies,
    DateTime CreatedAt,
    bool IsActive,
    List<BookCopyDto>? Copies
);

public record CreateLibraryBookDto(
    string Title,
    string Author,
    string? Publisher,
    string? Edition,
    string? ISBN,
    string Category,
    string? Subject,
    Guid? ClassId,
    string? Description,
    int InitialCopiesCount,
    string? InitialRackLocation,
    decimal InitialPrice
);

public record UpdateLibraryBookDto(
    string Title,
    string Author,
    string? Publisher,
    string? Edition,
    string? ISBN,
    string Category,
    string? Subject,
    Guid? ClassId,
    string? Description,
    bool IsActive
);

public record BookCopyDto(
    Guid Id,
    Guid TenantId,
    Guid? BranchId,
    Guid BookId,
    string BookTitle,
    string Author,
    string AccessionNumber,
    string? Barcode,
    string? RackLocation,
    decimal Price,
    string Status,
    string? ConditionNotes,
    DateTime CreatedAt,
    bool IsActive
);

public record CreateBookCopyDto(
    Guid BookId,
    string AccessionNumber,
    string? Barcode,
    string? RackLocation,
    decimal Price,
    string? ConditionNotes
);

public record UpdateBookCopyDto(
    string AccessionNumber,
    string? Barcode,
    string? RackLocation,
    decimal Price,
    string Status,
    string? ConditionNotes,
    bool IsActive
);

public record IssueBookDto(
    string AccessionNumber,
    Guid? StudentId,
    Guid? TeacherId,
    string MemberType,
    int? CustomDueDays,
    string? Remarks
);

public record ReturnBookDto(
    string AccessionNumber,
    string? Remarks,
    decimal? CollectedFineAmount,
    string FinePaymentStatus
);

public record LibraryCirculationDto(
    Guid Id,
    Guid BookCopyId,
    string AccessionNumber,
    string BookTitle,
    string Author,
    string? RackLocation,
    Guid? StudentId,
    string? StudentName,
    string? StudentRollNumber,
    string? StudentAdmissionNumber,
    string? StudentClassName,
    string? StudentBatchName,
    string? ParentWhatsAppPhone,
    Guid? TeacherId,
    string? TeacherName,
    string? TeacherEmployeeCode,
    string MemberType,
    DateTime IssueDate,
    DateTime DueDate,
    DateTime? ReturnDate,
    string Status,
    int OverdueDays,
    decimal FinePerDay,
    decimal FineAmount,
    string FineStatus,
    string? Remarks
);

public record LibraryStatsDto(
    int TotalTitles,
    int TotalCopies,
    int AvailableCopies,
    int IssuedCopies,
    int OverdueCount,
    decimal TotalFinesCollected,
    decimal TotalFinesPending
);

public record LibrarySettingDto(
    Guid Id,
    int MaxBooksPerStudent,
    int MaxBooksPerTeacher,
    int StudentIssueDays,
    int TeacherIssueDays,
    decimal DailyFineRate,
    bool AllowFineWaiver
);

public record UpdateLibrarySettingDto(
    int MaxBooksPerStudent,
    int MaxBooksPerTeacher,
    int StudentIssueDays,
    int TeacherIssueDays,
    decimal DailyFineRate,
    bool AllowFineWaiver
);

public record LibraryMembershipPlanDto(
    Guid Id,
    Guid TenantId,
    Guid? BranchId,
    string PlanName,
    string? ShiftTiming,
    decimal MonthlyFee,
    int MaxBooks,
    bool IsActive,
    int SortOrder
);

public record CreateLibraryMembershipPlanDto(
    string PlanName,
    string? ShiftTiming,
    decimal MonthlyFee,
    int MaxBooks,
    int SortOrder
);

public record UpdateLibraryMembershipPlanDto(
    string PlanName,
    string? ShiftTiming,
    decimal MonthlyFee,
    int MaxBooks,
    bool IsActive,
    int SortOrder
);

// ─── School Multi-Head Fees & Structure DTOs ────────────────────

public record FeeInvoiceItemDto(
    Guid Id,
    Guid InvoiceId,
    Guid? FeeHeadId,
    string HeadName,
    decimal Amount,
    decimal PaidAmount
);

public record FeeHeadDto(
    Guid Id,
    string Name,
    string Code,
    string Category,
    string Frequency,
    string? Description,
    bool IsActive,
    bool IsDefault,
    int SortOrder,
    string ApplicableTo = "Both"
);

public record CreateFeeHeadDto(
    string Name,
    string Code,
    string Category,
    string Frequency,
    string? Description,
    int SortOrder = 0,
    bool IsActive = true,
    bool IsDefault = false,
    string ApplicableTo = "Both"
);

public record UpdateFeeHeadDto(
    string Name,
    string Code,
    string Category,
    string Frequency,
    string? Description,
    bool IsActive,
    int SortOrder,
    bool IsDefault = false,
    string ApplicableTo = "Both"
);

public record ClassFeeStructureItemDto(
    Guid Id,
    Guid? ClassId,
    string? ClassName,
    Guid? BatchId,
    string? BatchName,
    Guid FeeHeadId,
    string FeeHeadName,
    string FeeHeadCode,
    string Category,
    string Frequency,
    decimal Amount,
    int? ApplicableMonth,
    bool IsActive,
    string? ApplicableTo = "Both"
);

public record SaveClassFeeStructureItemDto(
    Guid? Id,
    Guid? ClassId,
    Guid? BatchId,
    Guid FeeHeadId,
    decimal Amount,
    int? ApplicableMonth,
    bool IsActive = true
);

public record SaveClassFeeStructureBatchDto(
    Guid? ClassId,
    Guid? BatchId,
    List<SaveClassFeeStructureItemDto> Items
);

// ─── Student Promotion & Class Upgrade DTOs ──────────────────────

public record PromotionCandidateDto(
    Guid StudentId,
    string StudentName,
    string AdmissionNumber,
    string CurrentRollNumber,
    string? SchoolRollNumber,
    string? CoachingRollNumber,
    Guid CurrentClassId,
    string CurrentClassName,
    Guid? CurrentSectionId,
    string? CurrentSectionName,
    string? ParentName,
    string? ParentWhatsAppPhone,
    string? Gender,
    string? ProfilePhoto,
    decimal PendingDues,
    int AttendancePercentage,
    bool IsCoachingStudent,
    Guid? CoachingBatchId,
    string? CoachingBatchName,
    decimal? ExamMarksObtained = null,
    decimal? ExamMaxMarks = null,
    decimal? ExamPercentage = null,
    string? ExamResultStatus = null, // "Passed", "Failed", "Absent", "No Exam Record"
    string? ExamGrade = null, // "A+", "A", "B", "C", "D", "F"
    string? SuggestedStatus = "Promoted" // "Promoted", "Detained"
);

public record ClassExamDto(
    Guid Id,
    string Title,
    string Subject,
    string ExamType,
    string? AcademicYear,
    decimal MaxMarks,
    decimal PassingMarks,
    DateTime TestDate,
    int EvaluatedCount
);

public record StudentPromotionItemDto(
    Guid StudentId,
    string ResultStatus, // "Promoted", "Detained", "Passed with Grace", "Double Promoted"
    string? NewRollNumber,
    string? Remarks,
    decimal? ExamPercentage = null,
    string? ExamTotalMarks = null,
    string? ExamGrade = null,
    string? ExamResultStatus = null
);

public record ExecutePromotionRequestDto(
    Guid FromClassId,
    Guid? FromSectionId,
    string FromAcademicYear,
    Guid ToClassId,
    Guid? ToSectionId,
    string ToAcademicYear,
    List<StudentPromotionItemDto> Promotions
);

public record PromotionExecutionResultDto(
    int TotalProcessed,
    int PromotedCount,
    int DetainedCount,
    string Message,
    List<Guid> PromotedStudentIds
);

public record StudentPromotionHistoryDto(
    Guid Id,
    Guid StudentId,
    string StudentName,
    string AdmissionNumber,
    Guid FromClassId,
    string FromClassName,
    Guid? FromSectionId,
    string? FromSectionName,
    string? FromRollNumber,
    string FromAcademicYear,
    Guid ToClassId,
    string ToClassName,
    Guid? ToSectionId,
    string? ToSectionName,
    string? ToRollNumber,
    string ToAcademicYear,
    string ResultStatus,
    DateTime PromotionDate,
    string? PromotedBy,
    string? Remarks,
    decimal? ExamPercentage = null,
    string? ExamTotalMarks = null,
    string? ExamGrade = null
);

// ─── School Examination & Marks Entry DTOs ──────────────────────

public record SchoolExamDto(
    Guid Id,
    string Title,
    string Subject,
    string ExamType,
    string AcademicYear,
    Guid ClassId,
    string ClassName,
    Guid? SectionId,
    string? SectionName,
    decimal MaxMarks,
    decimal PassingMarks,
    DateTime TestDate,
    int TotalStudents,
    int EvaluatedStudents
);

public record CreateSchoolExamItemDto(
    string Subject,
    string Title,
    DateTime TestDate,
    decimal MaxMarks = 100,
    decimal PassingMarks = 33
);

public record CreateBulkSchoolExamsDto(
    Guid ClassId,
    Guid? SectionId,
    string AcademicYear,
    string ExamType,
    List<CreateSchoolExamItemDto> Exams
);

public record SchoolExamMarksItemDto(
    Guid StudentId,
    string StudentName,
    string? RollNumber,
    string? SchoolRollNumber,
    string AdmissionNumber,
    string? Gender,
    decimal MarksObtained,
    bool IsAbsent,
    string? Remarks,
    decimal Percentage,
    bool IsPassed
);

public record SaveSchoolExamMarkItemDto(
    Guid StudentId,
    decimal MarksObtained,
    bool IsAbsent = false,
    string? Remarks = null
);

public record SaveSchoolExamMarksDto(
    Guid ExamId,
    List<SaveSchoolExamMarkItemDto> MarksList
);

public record ExamSettingDto(
    Guid Id,
    decimal PassingPercentage,
    int MaxCompartmentSubjects,
    bool AllowGraceMarks,
    int MaxGraceMarks,
    string? SchoolAffiliationNumber,
    string? PrincipalSignTitle,
    string? ClassTeacherSignTitle,
    string? ResultDeclarationNote
);

public record UpdateExamSettingDto(
    decimal PassingPercentage,
    int MaxCompartmentSubjects,
    bool AllowGraceMarks,
    int MaxGraceMarks,
    string? SchoolAffiliationNumber,
    string? PrincipalSignTitle,
    string? ClassTeacherSignTitle,
    string? ResultDeclarationNote
);

public record ConsolidatedSubjectDetailDto(
    string Subject,
    decimal MaxMarks,
    decimal PassingMarks,
    decimal? MarksObtained,
    bool IsAbsent,
    string Grade,
    bool IsPassed
);

public record ConsolidatedStudentResultDto(
    Guid StudentId,
    string StudentName,
    string RollNumber,
    string AdmissionNumber,
    Dictionary<string, decimal?> SubjectMarks,
    decimal TotalObtained,
    decimal TotalMax,
    decimal OverallPercentage,
    string Grade,
    string ResultStatus, // "Passed", "Compartment", "Failed", "Passed with Grace", "Absent"
    int Rank,
    int FailedSubjectCount,
    string PromotionVerdict, // "Promoted to Next Grade", "Eligible for Compartment Exam", "Detained in Current Grade"
    decimal AttendancePercentage,
    int PresentDays,
    int TotalAttendanceDays,
    string? FatherName,
    string? MotherName,
    string? DateOfBirth,
    string? Gender,
    string? ParentWhatsAppPhone,
    string? SectionName,
    List<ConsolidatedSubjectDetailDto> SubjectDetails,
    string? ClassTeacherName = null
);

public record ConsolidatedClassResultDto(
    Guid ClassId,
    string ClassName,
    string AcademicYear,
    string ExamType,
    List<string> Subjects,
    decimal PassingPercentage,
    int TotalStudents,
    int PassedCount,
    int CompartmentCount,
    int FailedCount,
    ExamSettingDto Settings,
    List<ConsolidatedStudentResultDto> Students
);

public record SendAnnualResultWhatsAppDto(
    Guid StudentId,
    string StudentName,
    string RecipientPhone,
    string ExamTitle,
    string AcademicYear,
    decimal TotalObtained,
    decimal TotalMax,
    decimal Percentage,
    string Grade,
    string ResultStatus,
    int? Rank
);

// ── Teacher Exit & FNF DTOs ──────────────────────────────────────────

public record TeacherFnFPreviewDto(
    Guid TeacherId,
    string TeacherName,
    string EmployeeCode,
    string? PhoneNumber,
    string? Email,
    string? Designation,
    DateTime JoiningDate,
    decimal BasicSalary,
    decimal GrossMonthlySalary,
    decimal PerDayRate,
    int FinalMonthPresentDays,
    decimal SuggestedUnpaidSalary,
    decimal OutstandingAdvanceBalance,
    int PendingLibraryBooksCount,
    decimal PendingLibraryFines,
    int ActiveBatchesCount,
    int AssignedSectionsCount,
    List<string> ActiveAssignmentNames,
    bool HasActiveLoginAccount,
    string? LoginUsername
);

public record CreateTeacherFnFRequestDto(
    Guid TeacherId,
    DateTime ResignationDate,
    DateTime LastWorkingDate,
    string ReasonForLeaving,
    string? Remarks,
    bool AcademicClearance,
    bool LibraryClearance,
    bool AssetClearance,
    bool HostelClearance,
    int WorkingDaysInFinalMonth,
    decimal UnpaidSalary,
    decimal EarnedLeaveEncashment,
    decimal GratuityOrBonus,
    decimal OtherAdditions,
    decimal PendingAdvanceDeduction,
    decimal NoticeShortfallDeduction,
    decimal LibraryDuesDeduction,
    decimal AssetLossDeduction,
    decimal OtherDeductions,
    string? PaymentMode,
    string? PaymentReference,
    bool FinalizeNow = true
);

public record TeacherFnFSettlementDto(
    Guid Id,
    Guid TenantId,
    Guid? BranchId,
    Guid TeacherId,
    string TeacherName,
    string EmployeeCode,
    string? Designation,
    DateTime JoiningDate,
    DateTime ResignationDate,
    DateTime LastWorkingDate,
    string ReasonForLeaving,
    string? Remarks,
    bool AcademicClearance,
    bool LibraryClearance,
    bool AssetClearance,
    bool HostelClearance,
    bool AllClearancesApproved,
    string? ClearanceApprovedBy,
    int WorkingDaysInFinalMonth,
    decimal PerDaySalaryRate,
    decimal UnpaidSalary,
    decimal EarnedLeaveEncashment,
    decimal GratuityOrBonus,
    decimal OtherAdditions,
    decimal TotalEarnings,
    decimal PendingAdvanceDeduction,
    decimal NoticeShortfallDeduction,
    decimal LibraryDuesDeduction,
    decimal AssetLossDeduction,
    decimal OtherDeductions,
    decimal TotalDeductions,
    decimal NetPayableAmount,
    string Status,
    DateTime? SettlementDate,
    string? PaymentMode,
    string? PaymentReference,
    string SettlementVoucherNo,
    bool RelievingLetterIssued,
    bool ExperienceCertificateIssued,
    DateTime CreatedAt
);

// ==========================================
// TEACHER MODULE PART 2 DTOs
// ==========================================

public record TeacherSubstitutionDto(
    Guid Id,
    DateTime SubstitutionDate,
    Guid OriginalTeacherId,
    string OriginalTeacherName,
    string OriginalTeacherCode,
    Guid SubstituteTeacherId,
    string SubstituteTeacherName,
    string SubstituteTeacherCode,
    Guid? BatchId,
    string? BatchName,
    Guid? ClassSectionId,
    string? ClassSectionName,
    Guid? SubjectId,
    string? SubjectName,
    string TimeSlot,
    string? RoomNumber,
    string? TopicToCover,
    string? Reason,
    string Status,
    decimal ProxyAllowance,
    string? Remarks,
    string? AssignedBy,
    DateTime CreatedAt
);

public record CreateTeacherSubstitutionDto(
    DateTime SubstitutionDate,
    Guid OriginalTeacherId,
    Guid SubstituteTeacherId,
    Guid? BatchId,
    Guid? ClassSectionId,
    Guid? SubjectId,
    string? SubjectName,
    string TimeSlot,
    string? RoomNumber,
    string? TopicToCover,
    string? Reason,
    decimal ProxyAllowance = 0,
    string? Remarks = null
);

public record UpdateTeacherSubstitutionDto(
    string Status,
    string? Remarks,
    decimal? ProxyAllowance
);

public record TeacherLessonPlanDto(
    Guid Id,
    Guid TeacherId,
    string TeacherName,
    string TeacherCode,
    DateTime PlanDate,
    Guid? BatchId,
    string? BatchName,
    Guid? ClassSectionId,
    string? ClassSectionName,
    Guid? SubjectId,
    string SubjectName,
    string ChapterTopic,
    string? LearningObjectives,
    string? TeachingMethodology,
    string? HomeworkAssigned,
    string Status,
    string? CompletionPercentage,
    string? StudentResponse,
    string? Remarks,
    string? PrincipalFeedback,
    DateTime CreatedAt
);

public record CreateTeacherLessonPlanDto(
    Guid TeacherId,
    DateTime PlanDate,
    Guid? BatchId,
    Guid? ClassSectionId,
    Guid? SubjectId,
    string SubjectName,
    string ChapterTopic,
    string? LearningObjectives,
    string? TeachingMethodology,
    string? HomeworkAssigned,
    string Status = "Completed",
    string? CompletionPercentage = "100%",
    string? StudentResponse = null,
    string? Remarks = null
);

public record UpdateTeacherLessonPlanDto(
    string? ChapterTopic,
    string? LearningObjectives,
    string? HomeworkAssigned,
    string? Status,
    string? CompletionPercentage,
    string? StudentResponse,
    string? Remarks,
    string? PrincipalFeedback
);

public record TeacherDocumentDto(
    Guid Id,
    Guid TeacherId,
    string TeacherName,
    string DocumentType,
    string Title,
    string? DocumentNumber,
    string? FileUrl,
    string? FileName,
    string VerificationStatus,
    string? VerifiedBy,
    DateTime? VerifiedAt,
    DateTime? ExpiryDate,
    string? Remarks,
    DateTime CreatedAt
);

public record CreateTeacherDocumentDto(
    string DocumentType,
    string Title,
    string? DocumentNumber,
    string? FileUrl,
    string? FileName,
    DateTime? ExpiryDate,
    string? Remarks
);

public record VerifyTeacherDocumentDto(
    string VerificationStatus,
    string? Remarks
);

public record TeacherIdCardDto(
    Guid Id,
    string FullName,
    string EmployeeCode,
    string? Designation,
    string? Specialization,
    string? Qualification,
    string PhoneNumber,
    string? EmergencyContact,
    string? BloodGroup,
    string? Email,
    string? Address,
    DateTime JoiningDate,
    string? PhotoUrl,
    string InstitutionName,
    string? BranchName,
    string? InstitutionAddress,
    string? InstitutionPhone,
    string? AffiliationCode,
    string QrCodeData
);
