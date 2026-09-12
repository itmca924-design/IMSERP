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
    public string? WhatsAppPhoneId { get; set; }
    public string? WhatsAppAccessToken { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public UserRole Role { get; set; }
    public Guid? RoleId { get; set; }
    
    [ForeignKey("RoleId")]
    public RoleEntity? AssignedRole { get; set; }
    public bool IsActive { get; set; } = true;
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
    public string Name { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string AcademicYear { get; set; } = string.Empty;
    public decimal StandardMonthlyFee { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Student> Students { get; set; } = new List<Student>();
}

public class Student
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid BatchId { get; set; }
    public string RollNumber { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    public string ParentName { get; set; } = string.Empty;
    public string ParentWhatsAppPhone { get; set; } = string.Empty;
    public string? Address { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime JoiningDate { get; set; } = DateTime.UtcNow;

    public Batch? Batch { get; set; }
    public ICollection<FeeInvoice> FeeInvoices { get; set; } = new List<FeeInvoice>();
    public ICollection<TestMarks> TestMarks { get; set; } = new List<TestMarks>();
    public ICollection<StudentAttendance> Attendances { get; set; } = new List<StudentAttendance>();
}

public class StudentAttendance
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid StudentId { get; set; }
    public DateTime AttendanceDate { get; set; }
    public TeacherAttendanceStatus Status { get; set; } = TeacherAttendanceStatus.Present;
    public string? Remarks { get; set; }
    public string? MarkedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Student? Student { get; set; }
}

public class FeeInvoice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid StudentId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal DueAmount => TotalAmount - PaidAmount;
    public DateTime DueDate { get; set; }
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Pending;
    public string? CancellationReason { get; set; }
    public DateTime? CancelledAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Student? Student { get; set; }
    public ICollection<FeePayment> Payments { get; set; } = new List<FeePayment>();
}

public class FeePayment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid InvoiceId { get; set; }
    public string ReceiptNumber { get; set; } = string.Empty;
    public decimal AmountPaid { get; set; }
    public PaymentMode Mode { get; set; } = PaymentMode.Cash;
    public string? TransactionRef { get; set; }
    public DateTime PaymentDate { get; set; } = DateTime.UtcNow;
    public string? Remarks { get; set; }

    public FeeInvoice? Invoice { get; set; }
}

public class Test
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid BatchId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public decimal MaxMarks { get; set; }
    public DateTime TestDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

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
    public Guid TeacherId { get; set; }
    public DateTime AttendanceDate { get; set; }
    public TeacherAttendanceStatus Status { get; set; } = TeacherAttendanceStatus.Present;
    public string? CheckInTime { get; set; }
    public string? CheckOutTime { get; set; }
    public string? Remarks { get; set; }
    public string? MarkedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Teacher? Teacher { get; set; }
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
