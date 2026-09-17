using IMSERP.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace IMSERP.Application.Interfaces;

public interface IIMSERPDbContext
{
    DatabaseFacade Database { get; }
    DbSet<Tenant> Tenants { get; }
    DbSet<User> Users { get; }
    DbSet<RoleEntity> Roles { get; }
    DbSet<SubjectEntity> Subjects { get; }
    DbSet<MenuItem> MenuItems { get; }
    DbSet<RolePermission> RolePermissions { get; }
    DbSet<Batch> Batches { get; }
    DbSet<Student> Students { get; }
    DbSet<StudentAttendance> StudentAttendances { get; }
    DbSet<AttendanceSettings> AttendanceSettings { get; }
    DbSet<BiometricDevice> BiometricDevices { get; }
    DbSet<BiometricEventLog> BiometricEventLogs { get; }
    DbSet<FeeInvoice> FeeInvoices { get; }
    DbSet<FeePayment> FeePayments { get; }
    DbSet<Test> Tests { get; }
    DbSet<TestMarks> TestMarks { get; }
    DbSet<WhatsAppLog> WhatsAppLogs { get; }
    DbSet<Teacher> Teachers { get; }
    DbSet<TeacherBatchAssignment> TeacherBatchAssignments { get; }
    DbSet<TeacherAttendance> TeacherAttendances { get; }
    DbSet<TeacherSalary> TeacherSalaries { get; }
    DbSet<TeacherSalaryPayment> TeacherSalaryPayments { get; }
    DbSet<TeacherSalaryAdvance> TeacherSalaryAdvances { get; }
    DbSet<Branch> Branches { get; }
    DbSet<Room> Rooms { get; }
    DbSet<TeacherLeave> TeacherLeaves { get; }
    DbSet<Holiday> Holidays { get; }
    DbSet<SchoolClass> SchoolClasses { get; }
    DbSet<SchoolSection> SchoolSections { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public interface IWhatsAppService
{
    Task<bool> SendFeeReceiptAsync(Guid tenantId, string recipientPhone, string studentName, string receiptNo, decimal amount, decimal balanceDue);
    Task<bool> SendFeeReminderAsync(Guid tenantId, string recipientPhone, string studentName, string invoiceNo, decimal amountDue, DateTime dueDate);
    Task<bool> SendTestMarksReportAsync(Guid tenantId, string recipientPhone, string studentName, string testTitle, decimal marksObtained, decimal maxMarks, int rank);
}

public interface ICurrentUserService
{
    Guid TenantId { get; }
    Guid? BranchId { get; }
    string? BranchName { get; }
    Guid UserId { get; }
    string UserRole { get; }
}
