using System.ComponentModel.DataAnnotations.Schema;
using IMSERP.Domain.Enums;

namespace IMSERP.Domain.Entities;

public class Tenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? ContactPhone { get; set; }
    public string? Address { get; set; }
    public string? ProfilePhoto { get; set; }
    public string? WhatsAppPhoneId { get; set; }
    public string? WhatsAppAccessToken { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Branch> Branches { get; set; } = new List<Branch>();
}

public class Branch
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? ContactPhone { get; set; }
    public bool IsMainBranch { get; set; } = false;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Tenant? Tenant { get; set; }
    public ICollection<Room> Rooms { get; set; } = new List<Room>();
    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<Batch> Batches { get; set; } = new List<Batch>();
    public ICollection<Student> Students { get; set; } = new List<Student>();
    public ICollection<Teacher> Teachers { get; set; } = new List<Teacher>();
}

public class Room
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public string RoomNumber { get; set; } = string.Empty;
    public int Capacity { get; set; } = 40;
    public string? Floor { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Branch? Branch { get; set; }
    public ICollection<Batch> Batches { get; set; } = new List<Batch>();
}

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public UserRole Role { get; set; }
    public Guid? RoleId { get; set; }
    
    [ForeignKey("RoleId")]
    public RoleEntity? AssignedRole { get; set; }

    [ForeignKey("BranchId")]
    public Branch? Branch { get; set; }

    public bool IsActive { get; set; } = true;
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class RoleEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}

public class SubjectEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class MenuItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string? RouteUrl { get; set; }
    public string? Icon { get; set; }
    public Guid? ParentId { get; set; }
    public int SortOrder { get; set; } = 0;
    public string Module { get; set; } = "Master";
    public bool IsActive { get; set; } = true;

    public MenuItem? Parent { get; set; }
    public ICollection<MenuItem> Children { get; set; } = new List<MenuItem>();
}

public class RolePermission
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RoleId { get; set; }
    public Guid MenuItemId { get; set; }
    public bool CanView { get; set; } = true;
    public bool CanCreate { get; set; } = true;
    public bool CanEdit { get; set; } = true;
    public bool CanDelete { get; set; } = true;

    public RoleEntity? Role { get; set; }
    public MenuItem? MenuItem { get; set; }
}

public class Batch
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid? RoomId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string AcademicYear { get; set; } = string.Empty;
    public decimal StandardMonthlyFee { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("BranchId")]
    public Branch? Branch { get; set; }

    [ForeignKey("RoomId")]
    public Room? Room { get; set; }

    public ICollection<Student> Students { get; set; } = new List<Student>();
}

public class SchoolClass
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public int DisplayOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("BranchId")]
    public Branch? Branch { get; set; }

    public ICollection<SchoolSection> Sections { get; set; } = new List<SchoolSection>();
    public ICollection<Student> Students { get; set; } = new List<Student>();
}

public class SchoolSection
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid ClassId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int MaxCapacity { get; set; } = 45;
    public Guid? RoomId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("ClassId")]
    public SchoolClass? Class { get; set; }

    [ForeignKey("RoomId")]
    public Room? Room { get; set; }

    public ICollection<Student> Students { get; set; } = new List<Student>();
}

public class Student
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid? BatchId { get; set; }
    public Guid? ClassId { get; set; }
    public Guid? SectionId { get; set; }
    public string RollNumber { get; set; } = string.Empty;
    public string? SchoolRollNumber { get; set; }
    public string? CoachingRollNumber { get; set; }
    public string? AdmissionNumber { get; set; }
    public bool IsSchoolStudent { get; set; } = false;
    public bool IsCoachingStudent { get; set; } = true;
    public bool IsHostelStudent { get; set; } = false;
    public Guid? HostelBedId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string ParentName { get; set; } = string.Empty;
    public string ParentWhatsAppPhone { get; set; } = string.Empty;
    public string? MotherName { get; set; }
    public string? Gender { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? BloodGroup { get; set; }
    public string? Address { get; set; }
    public string? ProfilePhoto { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime JoiningDate { get; set; } = DateTime.UtcNow;
    public string? BiometricUserId { get; set; }

    [ForeignKey("BranchId")]
    public Branch? Branch { get; set; }

    [ForeignKey("BatchId")]
    public Batch? Batch { get; set; }

    [ForeignKey("ClassId")]
    public SchoolClass? Class { get; set; }

    [ForeignKey("SectionId")]
    public SchoolSection? Section { get; set; }

    [ForeignKey("HostelBedId")]
    public HostelBed? HostelBed { get; set; }

    public ICollection<FeeInvoice> FeeInvoices { get; set; } = new List<FeeInvoice>();
    public ICollection<TestMarks> TestMarks { get; set; } = new List<TestMarks>();
    public ICollection<StudentAttendance> Attendances { get; set; } = new List<StudentAttendance>();
    public ICollection<HostelAllocation> HostelAllocations { get; set; } = new List<HostelAllocation>();
    public ICollection<HostelGatePass> HostelGatePasses { get; set; } = new List<HostelGatePass>();
    public ICollection<HostelAttendance> HostelAttendances { get; set; } = new List<HostelAttendance>();
}

public class StudentAttendance
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid StudentId { get; set; }
    public DateTime AttendanceDate { get; set; }
    public TeacherAttendanceStatus Status { get; set; } = TeacherAttendanceStatus.Present;
    public string? Remarks { get; set; }
    public string? MarkedBy { get; set; }
    public string CaptureSource { get; set; } = "Manual";
    public string? BiometricDeviceId { get; set; }
    public string? BiometricEventId { get; set; }
    public DateTime? CapturedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("BranchId")]
    public Branch? Branch { get; set; }

    public Student? Student { get; set; }
}

public class FeeInvoice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid StudentId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string InvoiceCategory { get; set; } = "Coaching";
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal DueAmount => TotalAmount - PaidAmount;
    public DateTime DueDate { get; set; }
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Pending;
    public string? CancellationReason { get; set; }
    public DateTime? CancelledAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("BranchId")]
    public Branch? Branch { get; set; }

    public Student? Student { get; set; }
    public ICollection<FeePayment> Payments { get; set; } = new List<FeePayment>();
    public ICollection<FeeInvoiceItem> Items { get; set; } = new List<FeeInvoiceItem>();
}

public class FeePayment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid InvoiceId { get; set; }
    public string ReceiptNumber { get; set; } = string.Empty;
    public decimal AmountPaid { get; set; }
    public PaymentMode Mode { get; set; } = PaymentMode.Cash;
    public string? TransactionRef { get; set; }
    public DateTime PaymentDate { get; set; } = DateTime.UtcNow;
    public string? Remarks { get; set; }

    [ForeignKey("BranchId")]
    public Branch? Branch { get; set; }

    public FeeInvoice? Invoice { get; set; }
}

public class Test
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid BatchId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public decimal MaxMarks { get; set; }
    public DateTime TestDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("BranchId")]
    public Branch? Branch { get; set; }

    public Batch? Batch { get; set; }
    public ICollection<TestMarks> MarksList { get; set; } = new List<TestMarks>();
}

public class TestMarks
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid TestId { get; set; }
    public Guid StudentId { get; set; }
    public decimal MarksObtained { get; set; }
    public int Rank { get; set; }
    public bool IsAbsent { get; set; } = false;
    public string? Remarks { get; set; }

    public Test? Test { get; set; }
    public Student? Student { get; set; }
}

public class WhatsAppLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string RecipientPhone { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    public MessageType MessageType { get; set; }
    public string Content { get; set; } = string.Empty;
    public string Status { get; set; } = "Sent";
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}

// ─── Teacher Module Entities ─────────────────────────────────

public class Teacher
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? FatherName { get; set; }
    public Gender Gender { get; set; } = Gender.Male;
    public DateTime? DateOfBirth { get; set; }
    public string? Qualification { get; set; }
    public string? Specialization { get; set; }
    public int ExperienceYears { get; set; } = 0;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? WhatsAppPhone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? PhotoUrl { get; set; }
    public DateTime JoiningDate { get; set; } = DateTime.UtcNow;
    public DateTime? LeavingDate { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? BiometricUserId { get; set; }

    [ForeignKey("BranchId")]
    public Branch? Branch { get; set; }

    public ICollection<TeacherBatchAssignment> BatchAssignments { get; set; } = new List<TeacherBatchAssignment>();
    public ICollection<TeacherAttendance> Attendances { get; set; } = new List<TeacherAttendance>();
    public ICollection<TeacherSalary> Salaries { get; set; } = new List<TeacherSalary>();
    public ICollection<TeacherSalaryPayment> SalaryPayments { get; set; } = new List<TeacherSalaryPayment>();
    public ICollection<TeacherSalaryAdvance> SalaryAdvances { get; set; } = new List<TeacherSalaryAdvance>();
    public ICollection<TeacherLeave> Leaves { get; set; } = new List<TeacherLeave>();
}

public class TeacherBatchAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid TeacherId { get; set; }
    public Guid BatchId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string? DaysOfWeek { get; set; }
    public string? TimeSlot { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

    public Teacher? Teacher { get; set; }
    public Batch? Batch { get; set; }
}

public class TeacherAttendance
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid TeacherId { get; set; }
    public DateTime AttendanceDate { get; set; }
    public TeacherAttendanceStatus Status { get; set; } = TeacherAttendanceStatus.Present;
    public string? CheckInTime { get; set; }
    public string? CheckOutTime { get; set; }
    public string? Remarks { get; set; }
    public string? MarkedBy { get; set; }
    public string CaptureSource { get; set; } = "Manual";
    public string? BiometricDeviceId { get; set; }
    public string? BiometricEventId { get; set; }
    public DateTime? CapturedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("BranchId")]
    public Branch? Branch { get; set; }

    public Teacher? Teacher { get; set; }
}

public class AttendanceSettings
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public string StudentMode { get; set; } = "Both";
    public string TeacherMode { get; set; } = "Both";
    public string HostelMode { get; set; } = "Both";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("BranchId")]
    public Branch? Branch { get; set; }
}

public class BiometricDevice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Brand { get; set; }
    public string? Model { get; set; }
    public string? SerialNumber { get; set; }
    public string? IpAddress { get; set; }
    public int Port { get; set; } = 80;
    public string ConnectionMode { get; set; } = "PendingAdapter";
    public bool IsActive { get; set; } = true;
    public string Status { get; set; } = "NotConfigured";

    [ForeignKey("BranchId")]
    public Branch? Branch { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public DateTime? LastSyncAt { get; set; }
    public string? LastError { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class BiometricEventLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? DeviceId { get; set; }
    public string PersonType { get; set; } = string.Empty;
    public string BiometricUserId { get; set; } = string.Empty;
    public DateTime EventTime { get; set; }
    public string? DeviceEventId { get; set; }
    public string? RawPayload { get; set; }
    public string Status { get; set; } = "Received";
    public string? ErrorMessage { get; set; }
    public Guid? AttendanceId { get; set; }
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
}

public class TeacherSalary
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid TeacherId { get; set; }
    public decimal BasicSalary { get; set; }
    public decimal HRA { get; set; }
    public decimal OtherAllowances { get; set; }
    public decimal GrossSalary => BasicSalary + HRA + OtherAllowances;
    public decimal PFDeduction { get; set; }
    public decimal TDSDeduction { get; set; }
    public decimal OtherDeductions { get; set; }
    public decimal NetSalary => GrossSalary - PFDeduction - TDSDeduction - OtherDeductions;
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Teacher? Teacher { get; set; }
}

public class TeacherSalaryPayment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid TeacherId { get; set; }
    public int PaymentMonth { get; set; }
    public int PaymentYear { get; set; }
    public DateTime PaymentDate { get; set; } = DateTime.UtcNow;
    public decimal GrossAmount { get; set; }
    public decimal Deductions { get; set; }
    public decimal AdvanceAdjusted { get; set; }
    public decimal NetPaid { get; set; }
    public SalaryPaymentMode PaymentMode { get; set; } = SalaryPaymentMode.Cash;
    public string? TransactionRef { get; set; }
    public string ReceiptNumber { get; set; } = string.Empty;
    public int PresentDays { get; set; }
    public int AbsentDays { get; set; }
    public string? Remarks { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Teacher? Teacher { get; set; }
}

public class TeacherSalaryAdvance
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid TeacherId { get; set; }
    public decimal Amount { get; set; }
    public DateTime RequestDate { get; set; } = DateTime.UtcNow;
    public DateTime? ApprovedDate { get; set; }
    public string? Reason { get; set; }
    public AdvanceStatus Status { get; set; } = AdvanceStatus.Pending;
    public int? AdjustedInMonth { get; set; }
    public int? AdjustedInYear { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Teacher? Teacher { get; set; }
}

public class TeacherLeave
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid TeacherId { get; set; }
    public LeaveType LeaveType { get; set; } = LeaveType.CasualLeave;
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public int TotalDays => (int)(ToDate - FromDate).TotalDays + 1;
    public string? Reason { get; set; }
    public LeaveStatus Status { get; set; } = LeaveStatus.Pending;
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Teacher? Teacher { get; set; }
}

public class Holiday
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string HolidayType { get; set; } = "Festival"; // National, Festival, Academic, Institutional
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class LibraryBook
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string? Publisher { get; set; }
    public string? Edition { get; set; }
    public string? ISBN { get; set; }
    public string Category { get; set; } = "General"; // NCERT, JEE Advanced, NEET, Foundation, Reference, Sample Papers
    public string? Subject { get; set; }
    public Guid? ClassId { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;

    public SchoolClass? Class { get; set; }
    public ICollection<BookCopy> Copies { get; set; } = new List<BookCopy>();
}

public class BookCopy
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid BookId { get; set; }
    public string AccessionNumber { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public string? RackLocation { get; set; }
    public decimal Price { get; set; }
    public string Status { get; set; } = "Available"; // Available, Issued, Lost, Damaged, ReferenceOnly
    public string? ConditionNotes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;

    public LibraryBook? Book { get; set; }
    public ICollection<LibraryCirculation> Circulations { get; set; } = new List<LibraryCirculation>();
}

public class LibraryCirculation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid BookCopyId { get; set; }
    public Guid? StudentId { get; set; }
    public Guid? TeacherId { get; set; }
    public string MemberType { get; set; } = "Student"; // Student or Teacher
    public DateTime IssueDate { get; set; } = DateTime.UtcNow;
    public DateTime DueDate { get; set; }
    public DateTime? ReturnDate { get; set; }
    public string Status { get; set; } = "Issued"; // Issued, Returned, Overdue, Lost
    public int OverdueDays { get; set; } = 0;
    public decimal FinePerDay { get; set; } = 0;
    public decimal FineAmount { get; set; } = 0;
    public string FineStatus { get; set; } = "None"; // None, Pending, Paid, Waived
    public string? FinePaymentReceiptNumber { get; set; }
    public DateTime? FinePaidAt { get; set; }
    public string? Remarks { get; set; }
    public Guid? IssuedByUserId { get; set; }
    public Guid? ReceivedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public BookCopy? BookCopy { get; set; }
    public Student? Student { get; set; }
    public Teacher? Teacher { get; set; }
}

public class LibrarySetting
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public int MaxBooksPerStudent { get; set; } = 2;
    public int MaxBooksPerTeacher { get; set; } = 5;
    public int StudentIssueDays { get; set; } = 14;
    public int TeacherIssueDays { get; set; } = 30;
    public decimal DailyFineRate { get; set; } = 2.00m;
    public bool AllowFineWaiver { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class FeeHead
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Category { get; set; } = "Academic";
    public string Frequency { get; set; } = "Monthly";
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDefault { get; set; } = false;
    public string ApplicableTo { get; set; } = "Both";
    public int SortOrder { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Tenant? Tenant { get; set; }
    public Branch? Branch { get; set; }
}

public class ClassFeeStructure
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid? ClassId { get; set; }
    public Guid? BatchId { get; set; }
    public Guid FeeHeadId { get; set; }
    public decimal Amount { get; set; } = 0.00m;
    public int? ApplicableMonth { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public FeeHead? FeeHead { get; set; }
    public SchoolClass? Class { get; set; }
    public Batch? Batch { get; set; }
}

public class FeeInvoiceItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid InvoiceId { get; set; }
    public Guid? FeeHeadId { get; set; }
    public string HeadName { get; set; } = string.Empty;
    public decimal Amount { get; set; } = 0.00m;
    public decimal PaidAmount { get; set; } = 0.00m;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public FeeInvoice? Invoice { get; set; }
    public FeeHead? FeeHead { get; set; }
}

// ─── Hostel & Residential Management Entities ────────────────

public class Hostel
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string HostelType { get; set; } = "Boys"; // Boys, Girls, Co-ed, Staff
    public string? Address { get; set; }
    public string? WardenName { get; set; }
    public string? WardenPhone { get; set; }
    public int TotalFloors { get; set; } = 1;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("BranchId")]
    public Branch? Branch { get; set; }

    public ICollection<HostelRoom> Rooms { get; set; } = new List<HostelRoom>();
    public ICollection<HostelAttendance> Attendances { get; set; } = new List<HostelAttendance>();
}

public class HostelRoom
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid HostelId { get; set; }
    public string RoomNumber { get; set; } = string.Empty;
    public string Floor { get; set; } = "Ground";
    public string RoomType { get; set; } = "Double"; // Single, Double, Triple, 4-Bed, Dormitory
    public int Capacity { get; set; } = 2;
    public decimal MonthlyRent { get; set; } = 0.00m;
    public bool HasAC { get; set; } = false;
    public bool HasAttachedBath { get; set; } = false;
    public string? Amenities { get; set; }
    public string Status { get; set; } = "Active"; // Active, UnderMaintenance
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("HostelId")]
    public Hostel? Hostel { get; set; }

    [ForeignKey("BranchId")]
    public Branch? Branch { get; set; }

    public ICollection<HostelBed> Beds { get; set; } = new List<HostelBed>();
}

public class HostelBed
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid RoomId { get; set; }
    public string BedCode { get; set; } = string.Empty; // e.g. 101-A, 101-B
    public string Status { get; set; } = "Available"; // Available, Occupied, Maintenance, Reserved
    public decimal MonthlyRent { get; set; } = 0.00m;
    public Guid? CurrentStudentId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("RoomId")]
    public HostelRoom? Room { get; set; }

    [ForeignKey("CurrentStudentId")]
    public Student? CurrentStudent { get; set; }

    public ICollection<HostelAllocation> Allocations { get; set; } = new List<HostelAllocation>();
}

public class HostelAllocation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid StudentId { get; set; }
    public Guid BedId { get; set; }
    public DateTime AllocatedDate { get; set; } = DateTime.UtcNow;
    public DateTime? VacatedDate { get; set; }
    public decimal MonthlyRent { get; set; } = 0.00m;
    public bool IsMessIncluded { get; set; } = true;
    public string MessPlan { get; set; } = "Full Board";
    public decimal MonthlyMessFee { get; set; } = 0.00m;
    public string Status { get; set; } = "Active"; // Active, Vacated, Transferred
    public string? Remarks { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("StudentId")]
    public Student? Student { get; set; }

    [ForeignKey("BedId")]
    public HostelBed? Bed { get; set; }
}

public class HostelGatePass
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid StudentId { get; set; }
    public string PassNumber { get; set; } = string.Empty;
    public DateTime OutDate { get; set; } = DateTime.UtcNow;
    public DateTime ExpectedReturnDate { get; set; }
    public DateTime? ActualReturnDate { get; set; }
    public string Purpose { get; set; } = string.Empty;
    public bool ParentConsentGiven { get; set; } = true;
    public string? ParentContactNumber { get; set; }
    public string WardenApprovalStatus { get; set; } = "Approved"; // Pending, Approved, Rejected, Completed, Overdue
    public string? ApprovedByWarden { get; set; }
    public string? Remarks { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("StudentId")]
    public Student? Student { get; set; }
}

public class HostelAttendance
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid StudentId { get; set; }
    public Guid HostelId { get; set; }
    public DateTime AttendanceDate { get; set; }
    public string RollCallShift { get; set; } = "Night";
    public string Status { get; set; } = "Present"; // Present, Absent, OnLeave, Late, GatePass
    public string CaptureSource { get; set; } = "Manual"; // Manual, Biometric
    public string? BiometricDeviceId { get; set; }
    public string? BiometricEventId { get; set; }
    public DateTime? CapturedAt { get; set; }
    public string? PunchTime { get; set; }
    public string? MarkedBy { get; set; }
    public string? Remarks { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("StudentId")]
    public Student? Student { get; set; }

    [ForeignKey("HostelId")]
    public Hostel? Hostel { get; set; }
}

