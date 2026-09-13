using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.Infrastructure.Persistence;

public class IMSERPDbContext : DbContext, IIMSERPDbContext
{
    private readonly ICurrentUserService _currentUserService;

    public IMSERPDbContext(DbContextOptions<IMSERPDbContext> options, ICurrentUserService currentUserService)
        : base(options)
    {
        _currentUserService = currentUserService;
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<RoleEntity> Roles => Set<RoleEntity>();
    public DbSet<SubjectEntity> Subjects => Set<SubjectEntity>();
    public DbSet<MenuItem> MenuItems => Set<MenuItem>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<Batch> Batches => Set<Batch>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<StudentAttendance> StudentAttendances => Set<StudentAttendance>();
    public DbSet<AttendanceSettings> AttendanceSettings => Set<AttendanceSettings>();
    public DbSet<BiometricDevice> BiometricDevices => Set<BiometricDevice>();
    public DbSet<BiometricEventLog> BiometricEventLogs => Set<BiometricEventLog>();
    public DbSet<FeeInvoice> FeeInvoices => Set<FeeInvoice>();
    public DbSet<FeePayment> FeePayments => Set<FeePayment>();
    public DbSet<Test> Tests => Set<Test>();
    public DbSet<TestMarks> TestMarks => Set<TestMarks>();
    public DbSet<WhatsAppLog> WhatsAppLogs => Set<WhatsAppLog>();
    public DbSet<Teacher> Teachers => Set<Teacher>();
    public DbSet<TeacherBatchAssignment> TeacherBatchAssignments => Set<TeacherBatchAssignment>();
    public DbSet<TeacherAttendance> TeacherAttendances => Set<TeacherAttendance>();
    public DbSet<TeacherSalary> TeacherSalaries => Set<TeacherSalary>();
    public DbSet<TeacherSalaryPayment> TeacherSalaryPayments => Set<TeacherSalaryPayment>();
    public DbSet<TeacherSalaryAdvance> TeacherSalaryAdvances => Set<TeacherSalaryAdvance>();
    public DbSet<TeacherLeave> TeacherLeaves => Set<TeacherLeave>();
    public DbSet<Holiday> Holidays => Set<Holiday>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Global Multi-Tenant Query Filters
        var currentTenantId = _currentUserService.TenantId;

        modelBuilder.Entity<User>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<RoleEntity>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<SubjectEntity>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<Batch>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<Student>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<StudentAttendance>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<AttendanceSettings>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<BiometricDevice>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<BiometricEventLog>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<FeeInvoice>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<FeePayment>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<Test>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<TestMarks>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<WhatsAppLog>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<Teacher>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<TeacherBatchAssignment>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<TeacherAttendance>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<TeacherSalary>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<TeacherSalaryPayment>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<TeacherSalaryAdvance>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<TeacherLeave>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);
        modelBuilder.Entity<Holiday>().HasQueryFilter(x => currentTenantId == Guid.Empty || x.TenantId == currentTenantId);

        modelBuilder.Entity<User>()
            .HasOne(u => u.AssignedRole)
            .WithMany()
            .HasForeignKey(u => u.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<RolePermission>()
            .HasOne(rp => rp.Role)
            .WithMany(r => r.RolePermissions)
            .HasForeignKey(rp => rp.RoleId)
            .IsRequired(false);

        modelBuilder.Entity<Batch>().Property(b => b.StandardMonthlyFee).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<FeeInvoice>().Property(f => f.TotalAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<FeeInvoice>().Property(f => f.PaidAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<FeePayment>().Property(f => f.AmountPaid).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Test>().Property(t => t.MaxMarks).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<TestMarks>().Property(tm => tm.MarksObtained).HasColumnType("decimal(18,2)");

        // Teacher salary decimal configs
        modelBuilder.Entity<TeacherSalary>().Property(t => t.BasicSalary).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<TeacherSalary>().Property(t => t.HRA).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<TeacherSalary>().Property(t => t.OtherAllowances).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<TeacherSalary>().Property(t => t.PFDeduction).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<TeacherSalary>().Property(t => t.TDSDeduction).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<TeacherSalary>().Property(t => t.OtherDeductions).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<TeacherSalaryPayment>().Property(t => t.GrossAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<TeacherSalaryPayment>().Property(t => t.Deductions).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<TeacherSalaryPayment>().Property(t => t.AdvanceAdjusted).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<TeacherSalaryPayment>().Property(t => t.NetPaid).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<TeacherSalaryAdvance>().Property(t => t.Amount).HasColumnType("decimal(18,2)");

        // Ignore computed properties (EF cannot map them to columns)
        modelBuilder.Entity<TeacherSalary>().Ignore(t => t.GrossSalary).Ignore(t => t.NetSalary);
        modelBuilder.Entity<TeacherLeave>().Ignore(t => t.TotalDays);

        // Enums → store as string in DB (avoids InvalidCastException when DB column is nvarchar)
        modelBuilder.Entity<Teacher>()
            .Property(t => t.Gender)
            .HasConversion<string>()
            .HasColumnType("nvarchar(20)");

        modelBuilder.Entity<TeacherAttendance>()
            .Property(t => t.Status)
            .HasConversion<string>()
            .HasColumnType("nvarchar(50)");

        modelBuilder.Entity<StudentAttendance>()
            .Property(t => t.Status)
            .HasConversion<string>()
            .HasColumnType("nvarchar(50)");

        modelBuilder.Entity<TeacherLeave>()
            .Property(t => t.LeaveType)
            .HasConversion<string>()
            .HasColumnType("nvarchar(50)");

        modelBuilder.Entity<TeacherLeave>()
            .Property(t => t.Status)
            .HasConversion<string>()
            .HasColumnType("nvarchar(50)");

        modelBuilder.Entity<TeacherSalaryAdvance>()
            .Property(t => t.Status)
            .HasConversion<string>()
            .HasColumnType("nvarchar(50)");

        modelBuilder.Entity<TeacherSalaryPayment>()
            .Property(t => t.PaymentMode)
            .HasConversion<string>()
            .HasColumnType("nvarchar(50)");

        // Unique index: one attendance record per teacher per date
        modelBuilder.Entity<TeacherAttendance>()
            .HasIndex(t => new { t.TeacherId, t.AttendanceDate })
            .IsUnique();

        modelBuilder.Entity<StudentAttendance>()
            .HasIndex(t => new { t.StudentId, t.AttendanceDate })
            .IsUnique();

        modelBuilder.Entity<AttendanceSettings>()
            .HasIndex(x => x.TenantId)
            .IsUnique();

        modelBuilder.Entity<BiometricDevice>()
            .HasIndex(x => new { x.TenantId, x.SerialNumber })
            .IsUnique()
            .HasFilter("[SerialNumber] IS NOT NULL");

        modelBuilder.Entity<BiometricEventLog>()
            .HasIndex(x => new { x.TenantId, x.DeviceEventId })
            .IsUnique()
            .HasFilter("[DeviceEventId] IS NOT NULL");

        // Unique index: one salary payment per teacher per month/year
        modelBuilder.Entity<TeacherSalaryPayment>()
            .HasIndex(t => new { t.TeacherId, t.PaymentMonth, t.PaymentYear })
            .IsUnique();

        SeedData(modelBuilder);
    }

    private void SeedData(ModelBuilder modelBuilder)
    {
        var tenantId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var adminRoleId = Guid.Parse("22222222-1111-1111-1111-111111111111");
        var teacherRoleId = Guid.Parse("33333333-1111-1111-1111-111111111111");

        modelBuilder.Entity<Tenant>().HasData(new Tenant
        {
            Id = tenantId,
            Name = "Apex Coaching Academy",
            Code = "APEX",
            ContactPhone = "+919876543210",
            Address = "101 Knowledge Park, New Delhi",
            IsActive = true,
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        });

        modelBuilder.Entity<User>().HasData(
            new User
            {
                Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
                TenantId = tenantId,
                Username = "admin",
                PasswordHash = "admin123",
                FullName = "Prof. Rajesh Sharma (Director)",
                Email = "director@apexcoaching.com",
                PhoneNumber = "+919876543210",
                Role = UserRole.InstituteAdmin,
                RoleId = adminRoleId,
                IsActive = true
            },
            new User
            {
                Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
                TenantId = tenantId,
                Username = "teacher",
                PasswordHash = "teacher123",
                FullName = "Anita Verma (Physics Faculty)",
                Email = "anita@apexcoaching.com",
                PhoneNumber = "+919876543211",
                Role = UserRole.Teacher,
                RoleId = teacherRoleId,
                IsActive = true
            },
            new User
            {
                Id = Guid.Parse("44444444-4444-4444-4444-444444444444"),
                TenantId = tenantId,
                Username = "accountant",
                PasswordHash = "account123",
                FullName = "Suresh Gupta (Accountant)",
                Email = "accounts@apexcoaching.com",
                PhoneNumber = "+919876543212",
                Role = UserRole.Accountant,
                RoleId = adminRoleId,
                IsActive = true
            }
        );

        var batch1Id = Guid.Parse("55555555-5555-5555-5555-555555555555");
        var batch2Id = Guid.Parse("66666666-6666-6666-6666-666666666666");

        modelBuilder.Entity<Batch>().HasData(
            new Batch
            {
                Id = batch1Id,
                TenantId = tenantId,
                Name = "Class 10th - Science & Math Batch A",
                Subject = "Physics, Chemistry, Math",
                AcademicYear = "2026-2027",
                StandardMonthlyFee = 3500
            },
            new Batch
            {
                Id = batch2Id,
                TenantId = tenantId,
                Name = "Class 12th - Board + JEE Physics Target",
                Subject = "Physics",
                AcademicYear = "2026-2027",
                StandardMonthlyFee = 4500
            }
        );

        var student1Id = Guid.Parse("77777777-7777-7777-7777-777777777777");
        var student2Id = Guid.Parse("88888888-8888-8888-8888-888888888888");
        var student3Id = Guid.Parse("99999999-9999-9999-9999-999999999999");

        modelBuilder.Entity<Student>().HasData(
            new Student
            {
                Id = student1Id,
                TenantId = tenantId,
                BatchId = batch1Id,
                RollNumber = "APX-10-001",
                StudentName = "Rahul Verma",
                ParentName = "Ramesh Verma",
                ParentWhatsAppPhone = "+919988776655",
                Address = "Sector 14, Gurgaon",
                IsActive = true,
                JoiningDate = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Student
            {
                Id = student2Id,
                TenantId = tenantId,
                BatchId = batch1Id,
                RollNumber = "APX-10-002",
                StudentName = "Priya Sharma",
                ParentName = "Vikram Sharma",
                ParentWhatsAppPhone = "+919988776644",
                Address = "DLF Phase 3, Gurgaon",
                IsActive = true,
                JoiningDate = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Student
            {
                Id = student3Id,
                TenantId = tenantId,
                BatchId = batch2Id,
                RollNumber = "APX-12-005",
                StudentName = "Aman Gupta",
                ParentName = "Sunil Gupta",
                ParentWhatsAppPhone = "+919988776633",
                Address = "Green Park, Delhi",
                IsActive = true,
                JoiningDate = new DateTime(2026, 4, 15, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        modelBuilder.Entity<FeeInvoice>().HasData(
            new FeeInvoice
            {
                Id = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                TenantId = tenantId,
                StudentId = student1Id,
                InvoiceNumber = "INV-2026-0801",
                Title = "Tuition Fee - August 2026",
                TotalAmount = 3500,
                PaidAmount = 3500,
                DueDate = new DateTime(2026, 8, 10, 0, 0, 0, DateTimeKind.Utc),
                Status = InvoiceStatus.Paid
            },
            new FeeInvoice
            {
                Id = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                TenantId = tenantId,
                StudentId = student2Id,
                InvoiceNumber = "INV-2026-0802",
                Title = "Tuition Fee - August 2026",
                TotalAmount = 3500,
                PaidAmount = 1500,
                DueDate = new DateTime(2026, 8, 10, 0, 0, 0, DateTimeKind.Utc),
                Status = InvoiceStatus.Partial
            },
            new FeeInvoice
            {
                Id = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
                TenantId = tenantId,
                StudentId = student3Id,
                InvoiceNumber = "INV-2026-0803",
                Title = "Tuition Fee - August 2026",
                TotalAmount = 4500,
                PaidAmount = 0,
                DueDate = new DateTime(2026, 8, 10, 0, 0, 0, DateTimeKind.Utc),
                Status = InvoiceStatus.Overdue
            }
        );

        // ─── Teacher Seed Data ────────────────────────────────────
        var teacher1Id = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
        var teacher2Id = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");

        modelBuilder.Entity<Teacher>().HasData(
            new Teacher
            {
                Id = teacher1Id,
                TenantId = tenantId,
                EmployeeCode = "TCH-001",
                FullName = "Anita Verma",
                FatherName = "Ramesh Verma",
                Gender = Gender.Female,
                DateOfBirth = new DateTime(1988, 3, 15, 0, 0, 0, DateTimeKind.Utc),
                Qualification = "M.Sc Physics, B.Ed",
                Specialization = "Physics",
                ExperienceYears = 8,
                PhoneNumber = "+919876543211",
                WhatsAppPhone = "+919876543211",
                Email = "anita@apexcoaching.com",
                Address = "Sector 21, Gurgaon",
                JoiningDate = new DateTime(2020, 7, 1, 0, 0, 0, DateTimeKind.Utc),
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Teacher
            {
                Id = teacher2Id,
                TenantId = tenantId,
                EmployeeCode = "TCH-002",
                FullName = "Vikram Joshi",
                FatherName = "Mohan Joshi",
                Gender = Gender.Male,
                DateOfBirth = new DateTime(1985, 11, 22, 0, 0, 0, DateTimeKind.Utc),
                Qualification = "M.Sc Mathematics",
                Specialization = "Mathematics",
                ExperienceYears = 12,
                PhoneNumber = "+919876543220",
                WhatsAppPhone = "+919876543220",
                Email = "vikram@apexcoaching.com",
                Address = "DLF Phase 1, Gurgaon",
                JoiningDate = new DateTime(2018, 4, 1, 0, 0, 0, DateTimeKind.Utc),
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        modelBuilder.Entity<TeacherBatchAssignment>().HasData(
            new TeacherBatchAssignment
            {
                Id = Guid.Parse("11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                TenantId = tenantId,
                TeacherId = teacher1Id,
                BatchId = batch1Id,
                Subject = "Physics",
                DaysOfWeek = "Mon,Wed,Fri",
                TimeSlot = "08:00-09:30",
                IsActive = true,
                AssignedAt = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new TeacherBatchAssignment
            {
                Id = Guid.Parse("22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                TenantId = tenantId,
                TeacherId = teacher1Id,
                BatchId = batch2Id,
                Subject = "Physics",
                DaysOfWeek = "Tue,Thu,Sat",
                TimeSlot = "10:00-11:30",
                IsActive = true,
                AssignedAt = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new TeacherBatchAssignment
            {
                Id = Guid.Parse("33333333-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                TenantId = tenantId,
                TeacherId = teacher2Id,
                BatchId = batch1Id,
                Subject = "Mathematics",
                DaysOfWeek = "Mon,Wed,Fri",
                TimeSlot = "09:30-11:00",
                IsActive = true,
                AssignedAt = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        modelBuilder.Entity<TeacherSalary>().HasData(
            new TeacherSalary
            {
                Id = Guid.Parse("11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                TenantId = tenantId,
                TeacherId = teacher1Id,
                BasicSalary = 30000,
                HRA = 6000,
                OtherAllowances = 4000,
                PFDeduction = 3600,
                TDSDeduction = 0,
                OtherDeductions = 0,
                EffectiveFrom = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc),
                IsActive = true,
                CreatedAt = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new TeacherSalary
            {
                Id = Guid.Parse("22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                TenantId = tenantId,
                TeacherId = teacher2Id,
                BasicSalary = 35000,
                HRA = 7000,
                OtherAllowances = 5000,
                PFDeduction = 4200,
                TDSDeduction = 1000,
                OtherDeductions = 0,
                EffectiveFrom = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc),
                IsActive = true,
                CreatedAt = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        var test1Id = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        modelBuilder.Entity<Test>().HasData(new Test
        {
            Id = test1Id,
            TenantId = tenantId,
            BatchId = batch1Id,
            Title = "Unit Test 3 - Newton's Laws of Motion",
            Subject = "Physics",
            MaxMarks = 50,
            TestDate = new DateTime(2026, 8, 25, 0, 0, 0, DateTimeKind.Utc)
        });

        modelBuilder.Entity<TestMarks>().HasData(
            new TestMarks
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                TestId = test1Id,
                StudentId = student1Id,
                MarksObtained = 46,
                Rank = 1,
                IsAbsent = false,
                Remarks = "Excellent conceptual understanding"
            },
            new TestMarks
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                TestId = test1Id,
                StudentId = student2Id,
                MarksObtained = 41,
                Rank = 2,
                IsAbsent = false,
                Remarks = "Good effort, work on numericals"
            }
        );
    }
}
