using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;

    public DashboardController(IIMSERPDbContext dbContext, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary()
    {
        var roleNormalized = (_currentUser.UserRole ?? "").Trim();
        if (roleNormalized.Contains("Student", StringComparison.OrdinalIgnoreCase) || roleNormalized.Contains("Parent", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        bool isSuperAdmin = string.Equals(_currentUser.UserRole, "SuperAdmin", StringComparison.OrdinalIgnoreCase);

        var studentsQuery = isSuperAdmin ? _dbContext.Students.IgnoreQueryFilters() : _dbContext.Students;
        var batchesQuery = isSuperAdmin ? _dbContext.Batches.IgnoreQueryFilters() : _dbContext.Batches;
        var feePaymentsQuery = isSuperAdmin ? _dbContext.FeePayments.IgnoreQueryFilters() : _dbContext.FeePayments;
        var feeInvoicesQuery = isSuperAdmin ? _dbContext.FeeInvoices.IgnoreQueryFilters() : _dbContext.FeeInvoices;
        var testsQuery = isSuperAdmin ? _dbContext.Tests.IgnoreQueryFilters() : _dbContext.Tests;
        var whatsAppQuery = isSuperAdmin ? _dbContext.WhatsAppLogs.IgnoreQueryFilters() : _dbContext.WhatsAppLogs;
        var studentAttendancesQuery = isSuperAdmin ? _dbContext.StudentAttendances.IgnoreQueryFilters() : _dbContext.StudentAttendances;

        var totalStudents = await studentsQuery.CountAsync(s => s.IsActive);
        var activeBatches = await batchesQuery.CountAsync();
        
        var startOfMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var totalFeeCollectedThisMonth = await feePaymentsQuery
            .Where(p => p.PaymentDate >= startOfMonth)
            .SumAsync(p => (decimal?)p.AmountPaid) ?? 0;

        var pendingFeesTotal = await feeInvoicesQuery
            .Where(i => i.Status != InvoiceStatus.Paid)
            .SumAsync(i => (decimal?)(i.TotalAmount - i.PaidAmount)) ?? 0;

        var totalTestsConducted = await testsQuery.CountAsync();
        var whatsAppSent = await whatsAppQuery.CountAsync();

        var overdueInvoices = await feeInvoicesQuery
            .Include(i => i.Student)
            .Where(i => i.Status == InvoiceStatus.Overdue || (i.Status != InvoiceStatus.Paid && i.DueDate < DateTime.UtcNow))
            .OrderBy(i => i.DueDate)
            .Take(5)
            .Select(i => new FeeInvoiceDto(
                i.Id,
                i.StudentId,
                i.Student != null ? i.Student.StudentName : "",
                i.Student != null ? i.Student.RollNumber : "",
                i.Student != null ? i.Student.ParentWhatsAppPhone : "",
                i.InvoiceNumber,
                i.Title,
                i.TotalAmount,
                i.PaidAmount,
                i.TotalAmount - i.PaidAmount,
                i.DueDate,
                i.Status.ToString()
            )).ToListAsync();

        var recentTests = await testsQuery
            .Include(t => t.Batch)
            .Include(t => t.Class)
            .Include(t => t.Section)
            .OrderByDescending(t => t.TestDate)
            .Take(5)
            .Select(t => new TestDto(
                t.Id,
                t.BatchId,
                t.Batch != null ? t.Batch.Name : (t.Class != null ? (t.Section != null ? $"{t.Class.Name} ({t.Section.Name})" : t.Class.Name) : "General"),
                t.Title,
                t.Subject,
                t.MaxMarks,
                t.TestDate,
                t.MarksList.Count,
                t.ClassId,
                t.Class != null ? t.Class.Name : null,
                t.SectionId,
                t.Section != null ? t.Section.Name : null
            )).ToListAsync();

        // Dynamic Chart Analytics from Database
        var now = DateTime.UtcNow;
        var allInvoices = await feeInvoicesQuery.AsNoTracking().ToListAsync();
        var allPayments = await feePaymentsQuery.AsNoTracking().ToListAsync();

        // 1. Monthly Revenue & Collection Trend (Last 6 Months)
        var revenueTrends = new List<MonthlyRevenueTrendItemDto>();
        for (int i = 5; i >= 0; i--)
        {
            var targetDate = now.AddMonths(-i);
            int year = targetDate.Year;
            int month = targetDate.Month;
            string monthName = targetDate.ToString("MMM yyyy", System.Globalization.CultureInfo.InvariantCulture);

            decimal billed = allInvoices
                .Where(inv => inv.DueDate.Year == year && inv.DueDate.Month == month)
                .Sum(inv => inv.TotalAmount);

            decimal collected = allPayments
                .Where(p => p.PaymentDate.Year == year && p.PaymentDate.Month == month)
                .Sum(p => p.AmountPaid);

            revenueTrends.Add(new MonthlyRevenueTrendItemDto(monthName, year, month, billed, collected));
        }

        // 2. Batch-wise Student Enrollment Distribution
        var batches = await batchesQuery.AsNoTracking().ToListAsync();
        var students = await studentsQuery.AsNoTracking().Where(s => s.IsActive).ToListAsync();
        var batchDistributions = batches.Select(b =>
        {
            int count = students.Count(s => s.BatchId == b.Id);
            decimal potential = count * b.StandardMonthlyFee;
            return new BatchDistributionItemDto(b.Id, b.Name, count, b.StandardMonthlyFee, potential);
        }).OrderByDescending(x => x.StudentCount).ToList();

        // 3. Overall Fee Collection & Recovery Breakdown
        decimal totalBilledAll = allInvoices.Sum(i => i.TotalAmount);
        decimal totalPaidAll = allInvoices.Sum(i => i.PaidAmount);
        decimal totalPendingAll = allInvoices.Where(i => i.Status != InvoiceStatus.Paid).Sum(i => i.TotalAmount - i.PaidAmount);
        decimal recoveryRate = totalBilledAll > 0 ? Math.Round((totalPaidAll / totalBilledAll) * 100m, 1) : 0m;

        var feeBreakdown = new FeeCollectionBreakdownDto(totalBilledAll, totalPaidAll, totalPendingAll, recoveryRate);

        // 4. Today's Student Attendance Live Summary & Time
        var today = DateTime.UtcNow.Date;
        var todayAttendances = await studentAttendancesQuery
            .AsNoTracking()
            .Include(a => a.Student)
            .ThenInclude(s => s!.Batch)
            .Where(a => a.AttendanceDate == today)
            .OrderByDescending(a => a.CapturedAt ?? a.CreatedAt)
            .ToListAsync();

        TodayAttendanceSummaryDto? todayAttendance = null;
        if (todayAttendances.Any())
        {
            int presentCount = todayAttendances.Count(a => a.Status == TeacherAttendanceStatus.Present);
            int absentCount = todayAttendances.Count(a => a.Status == TeacherAttendanceStatus.Absent);
            int lateCount = todayAttendances.Count(a => a.Status == TeacherAttendanceStatus.Late);
            int halfDayCount = todayAttendances.Count(a => a.Status == TeacherAttendanceStatus.HalfDay);
            int totalMarked = todayAttendances.Count;
            decimal pct = totalMarked > 0 ? Math.Round((decimal)presentCount / totalMarked * 100m, 1) : 0m;

            var latest = todayAttendances.FirstOrDefault();
            string? lastTime = null;
            if (latest != null)
            {
                var rawDt = latest.CapturedAt ?? latest.CreatedAt;
                var utcDt = DateTime.SpecifyKind(rawDt, DateTimeKind.Utc);
                var istTime = utcDt.AddHours(5).AddMinutes(30);
                lastTime = istTime.ToString("hh:mm tt");
            }
            string? lastBatch = latest?.Student?.Batch?.Name;

            todayAttendance = new TodayAttendanceSummaryDto(
                totalMarked,
                presentCount,
                absentCount,
                lateCount,
                halfDayCount,
                pct,
                lastTime,
                lastBatch
            );
        }

        return Ok(new DashboardSummaryDto(
            totalStudents,
            activeBatches,
            totalFeeCollectedThisMonth,
            pendingFeesTotal,
            totalTestsConducted,
            whatsAppSent,
            overdueInvoices,
            recentTests,
            revenueTrends,
            batchDistributions,
            feeBreakdown,
            todayAttendance
        ));
    }

    [HttpGet("student-summary")]
    public async Task<ActionResult<StudentDashboardSummaryDto>> GetStudentSummary()
    {
        var userId = _currentUser.UserId;
        var tenantId = _currentUser.TenantId;

        // 1. Look up student by UserId or ParentUserId
        var student = await _dbContext.Students.AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .Include(s => s.Branch)
            .FirstOrDefaultAsync(s => (s.UserId == userId || s.ParentUserId == userId) && s.TenantId == tenantId);

        if (student == null)
        {
            var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user != null)
            {
                student = await _dbContext.Students.AsNoTracking()
                    .Include(s => s.Class)
                    .Include(s => s.Section)
                    .Include(s => s.Batch)
                    .Include(s => s.Branch)
                    .FirstOrDefaultAsync(s => s.TenantId == tenantId && (
                        (!string.IsNullOrEmpty(user.PhoneNumber) && (s.ParentWhatsAppPhone == user.PhoneNumber || s.EmergencyContactPhone == user.PhoneNumber)) ||
                        (!string.IsNullOrEmpty(user.FullName) && s.StudentName == user.FullName)
                    ));
            }
        }

        if (student == null)
        {
            student = await _dbContext.Students.AsNoTracking()
                .Include(s => s.Class)
                .Include(s => s.Section)
                .Include(s => s.Batch)
                .Include(s => s.Branch)
                .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.IsActive);
        }

        if (student == null) return NotFound(new { message = "Student profile not found." });

        // Personal Attendance
        var attendances = await _dbContext.StudentAttendances.AsNoTracking()
            .Where(a => a.StudentId == student.Id)
            .ToListAsync();
        int totalAttDays = attendances.Count;
        int presentDays = attendances.Count(a => a.Status == TeacherAttendanceStatus.Present);
        int absentDays = attendances.Count(a => a.Status == TeacherAttendanceStatus.Absent);
        decimal attPct = totalAttDays > 0 ? Math.Round((decimal)presentDays / totalAttDays * 100m, 1) : 100m;
        string attStatus = attPct >= 85 ? "Excellent Attendance" : (attPct >= 75 ? "Good Standing" : "Attendance Warning (<75%)");

        // Personal Fees
        var invoices = await _dbContext.FeeInvoices.AsNoTracking()
            .Where(i => i.StudentId == student.Id)
            .OrderByDescending(i => i.DueDate)
            .ToListAsync();
        decimal totalBilled = invoices.Sum(i => i.TotalAmount);
        decimal totalPaid = invoices.Sum(i => i.PaidAmount);
        decimal totalDue = invoices.Where(i => i.Status != InvoiceStatus.Paid).Sum(i => i.TotalAmount - i.PaidAmount);
        var nextDueInv = invoices.Where(i => i.Status != InvoiceStatus.Paid).OrderBy(i => i.DueDate).FirstOrDefault();
        DateTime? nextDueDate = nextDueInv?.DueDate;

        var lastPayment = await _dbContext.FeePayments.AsNoTracking()
            .Include(p => p.Invoice)
            .Where(p => p.Invoice != null && p.Invoice.StudentId == student.Id)
            .OrderByDescending(p => p.PaymentDate)
            .FirstOrDefaultAsync();
        string? lastReceiptNumber = lastPayment?.ReceiptNumber;
        decimal? lastPaymentAmount = lastPayment?.AmountPaid;
        DateTime? lastPaymentDate = lastPayment?.PaymentDate;

        // Upcoming Tests
        var today = DateTime.UtcNow.Date;
        var upcomingTestsRaw = await _dbContext.Tests.AsNoTracking()
            .Include(t => t.Batch)
            .Include(t => t.Class)
            .Include(t => t.Section)
            .Where(t => t.TenantId == tenantId && t.TestDate >= today &&
                ((student.ClassId.HasValue && t.ClassId == student.ClassId) ||
                 (student.BatchId.HasValue && t.BatchId == student.BatchId)))
            .OrderBy(t => t.TestDate)
            .Take(5)
            .ToListAsync();

        var upcomingTests = upcomingTestsRaw.Select(t => new StudentUpcomingTestDto(
            t.Id,
            t.Title,
            t.Subject,
            t.TestDate,
            t.MaxMarks,
            t.Class != null ? (t.Section != null ? $"{t.Class.Name} - {t.Section.Name}" : t.Class.Name) : (t.Batch != null ? t.Batch.Name : "General")
        )).ToList();

        var latestMark = await _dbContext.TestMarks.AsNoTracking()
            .Include(m => m.Test)
            .Where(m => m.StudentId == student.Id)
            .OrderByDescending(m => m.Test != null ? m.Test.TestDate : DateTime.MinValue)
            .FirstOrDefaultAsync();
        decimal? latestTestPct = (latestMark != null && latestMark.Test != null && latestMark.Test.MaxMarks > 0) ? Math.Round((latestMark.MarksObtained / latestMark.Test.MaxMarks) * 100m, 1) : null;
        string? latestTestSubject = latestMark?.Test?.Subject;

        // Recent Homework
        var recentHomeworkRaw = await _dbContext.StudentHomeworks.AsNoTracking()
            .Where(h => h.TenantId == tenantId &&
                ((student.ClassId.HasValue && h.ClassId == student.ClassId) ||
                 (student.SectionId.HasValue && h.SectionId == student.SectionId) ||
                 (student.BatchId.HasValue && h.BatchId == student.BatchId)))
            .OrderByDescending(h => h.AssignedDate)
            .Take(5)
            .ToListAsync();
        var recentHomework = recentHomeworkRaw.Select(h => new StudentHomeworkItemDto(
            h.Id,
            !string.IsNullOrEmpty(h.SubjectName) ? h.SubjectName : (h.Class != null ? "Academic" : "General"),
            h.Title,
            h.Description ?? "",
            h.AssignedDate,
            h.DueDate,
            h.TeacherName ?? "Faculty"
        )).ToList();
        int pendingHomeworkCount = recentHomeworkRaw.Count(h => h.DueDate >= today);

        // Issued Library Books
        var issuedCircs = await _dbContext.LibraryCirculations.AsNoTracking()
            .Include(c => c.BookCopy)
            .ThenInclude(bc => bc!.Book)
            .Where(c => c.StudentId == student.Id && c.Status == "Issued")
            .ToListAsync();
        int issuedBooksCount = issuedCircs.Count;
        int overdueBooksCount = issuedCircs.Count(c => c.DueDate < DateTime.UtcNow);
        var issuedBooks = issuedCircs.Select(c => new StudentIssuedBookDto(
            c.Id,
            c.BookCopy?.Book?.Title ?? "Textbook",
            c.BookCopy?.AccessionNumber ?? "N/A",
            c.IssueDate,
            c.DueDate,
            c.DueDate < DateTime.UtcNow
        )).ToList();

        // Honors & Wall of Fame
        var honors = await _dbContext.StudentAchievements.AsNoTracking()
            .Where(a => a.StudentId == student.Id)
            .OrderByDescending(a => a.AwardDate)
            .ToListAsync();
        int totalAccoladesCount = honors.Count;
        var recentAccolades = honors.Take(3).Select(h => $"{h.Title} ({h.AwardLevel})").ToList();
        bool isStarPerformer = totalAccoladesCount >= 2 || attPct >= 95 || (latestTestPct.HasValue && latestTestPct.Value >= 90);
        string perfBadge = isStarPerformer ? "Star Scholar" : (attPct >= 80 ? "Consistent Performer" : "Active Learner");

        // Today's Routine
        var todayDow = DateTime.UtcNow.DayOfWeek.ToString();
        var routineRaw = await _dbContext.TeacherBatchAssignments.AsNoTracking()
            .Include(a => a.Teacher)
            .Where(a => a.IsActive && student.SectionId.HasValue && a.SectionId == student.SectionId.Value &&
                        (!string.IsNullOrEmpty(a.DaysOfWeek) && a.DaysOfWeek.Contains(todayDow)))
            .OrderBy(a => a.TimeSlot)
            .ToListAsync();
        var todayRoutine = routineRaw.Select(r => new StudentTodayRoutineDto(
            r.TimeSlot ?? "Period",
            r.Subject,
            r.Teacher?.FullName ?? "Subject Faculty",
            r.TimeSlot ?? "Scheduled",
            "Classroom"
        )).ToList();

        // Recent Notices
        var noticesRaw = await _dbContext.SchoolNotices.AsNoTracking()
            .Where(n => n.TenantId == tenantId && n.IsActive && (n.TargetAudience == "All" || n.TargetAudience == "Students" || n.TargetAudience == "Parents"))
            .OrderByDescending(n => n.IsPinned)
            .ThenByDescending(n => n.CreatedAt)
            .Take(4)
            .ToListAsync();
        var recentNotices = noticesRaw.Select(n => new DashboardNoticeItemDto(
            n.Id, n.Title, n.Content, n.Category, n.CreatedAt, n.Priority
        )).ToList();

        return Ok(new StudentDashboardSummaryDto(
            student.Id,
            student.StudentName,
            student.RollNumber,
            student.AdmissionNumber,
            student.Class?.Name,
            student.Section?.Name,
            student.Batch?.Name,
            student.Branch?.Name,
            student.ProfilePhoto,
            isStarPerformer,
            perfBadge,
            totalAttDays,
            presentDays,
            absentDays,
            attPct,
            attStatus,
            totalBilled,
            totalPaid,
            totalDue,
            nextDueDate,
            lastReceiptNumber,
            lastPaymentAmount,
            lastPaymentDate,
            upcomingTests.Count,
            upcomingTests,
            latestTestPct,
            latestTestSubject,
            pendingHomeworkCount,
            recentHomework,
            issuedBooksCount,
            overdueBooksCount,
            issuedBooks,
            totalAccoladesCount,
            recentAccolades,
            todayRoutine,
            recentNotices
        ));
    }

    [HttpGet("teacher-summary")]
    public async Task<ActionResult<TeacherDashboardSummaryDto>> GetTeacherSummary()
    {
        var userId = _currentUser.UserId;
        var tenantId = _currentUser.TenantId;

        var teacher = await _dbContext.Teachers.AsNoTracking()
            .Include(t => t.Branch)
            .Include(t => t.BatchAssignments)
            .FirstOrDefaultAsync(t => t.UserId == userId && t.TenantId == tenantId);

        if (teacher == null)
        {
            var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user != null)
            {
                teacher = await _dbContext.Teachers.AsNoTracking()
                    .Include(t => t.Branch)
                    .Include(t => t.BatchAssignments)
                    .FirstOrDefaultAsync(t => t.TenantId == tenantId && (
                        (!string.IsNullOrEmpty(user.PhoneNumber) && t.PhoneNumber == user.PhoneNumber) ||
                        (!string.IsNullOrEmpty(user.Email) && t.Email == user.Email) ||
                        (!string.IsNullOrEmpty(user.FullName) && t.FullName == user.FullName)
                    ));
            }
        }

        if (teacher == null)
        {
            teacher = await _dbContext.Teachers.AsNoTracking()
                .Include(t => t.Branch)
                .Include(t => t.BatchAssignments)
                .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.IsActive);
        }

        if (teacher == null) return NotFound(new { message = "Teacher record not found." });

        var today = DateTime.UtcNow.Date;
        var todayDow = DateTime.UtcNow.DayOfWeek.ToString();

        var assignments = await _dbContext.TeacherBatchAssignments.AsNoTracking()
            .Include(a => a.Class)
            .Include(a => a.Section)
            .Include(a => a.Batch)
            .Where(a => a.TeacherId == teacher.Id && a.IsActive)
            .ToListAsync();

        var todayLectures = assignments
            .Where(a => string.IsNullOrEmpty(a.DaysOfWeek) || a.DaysOfWeek.Contains(todayDow))
            .OrderBy(a => a.TimeSlot)
            .Select(a => new TeacherTodayLectureDto(
                a.TimeSlot ?? "Period",
                a.Class != null ? (a.Section != null ? $"{a.Class.Name} ({a.Section.Name})" : a.Class.Name) : (a.Batch != null ? a.Batch.Name : "Class"),
                a.Subject,
                "Classroom",
                a.TimeSlot ?? "Scheduled"
            )).ToList();

        var assignedBatchNames = assignments
            .Select(a => a.Class != null ? (a.Section != null ? $"{a.Class.Name} - {a.Section.Name}" : a.Class.Name) : (a.Batch != null ? a.Batch.Name : a.Subject))
            .Distinct()
            .ToList();

        // Punch in status
        var teacherAttendanceToday = await _dbContext.TeacherAttendances.AsNoTracking()
            .FirstOrDefaultAsync(a => a.TeacherId == teacher.Id && a.AttendanceDate == today);
        bool hasPunchedIn = teacherAttendanceToday != null && teacherAttendanceToday.Status == TeacherAttendanceStatus.Present;
        string? punchTime = teacherAttendanceToday?.CheckInTime;

        // Pending Marks Entry Tests
        var batchIds = assignments.Where(a => a.BatchId.HasValue).Select(a => a.BatchId!.Value).Distinct().ToList();
        var classIds = assignments.Where(a => a.ClassId.HasValue).Select(a => a.ClassId!.Value).Distinct().ToList();
        var tests = await _dbContext.Tests.AsNoTracking()
            .Include(t => t.Batch)
            .Include(t => t.Class)
            .Include(t => t.MarksList)
            .Where(t => t.TenantId == tenantId && ((t.BatchId.HasValue && batchIds.Contains(t.BatchId.Value)) || (t.ClassId.HasValue && classIds.Contains(t.ClassId.Value))))
            .OrderByDescending(t => t.TestDate)
            .Take(10)
            .ToListAsync();
        var pendingTests = tests.Where(t => t.MarksList.Count == 0).Take(5).Select(t => new TeacherPendingTestDto(
            t.Id, t.Title, t.Subject, t.Class != null ? t.Class.Name : (t.Batch != null ? t.Batch.Name : "Class"), t.TestDate
        )).ToList();

        // Homework this week
        var startOfWeek = today.AddDays(-(int)today.DayOfWeek);
        int homeworkCount = await _dbContext.StudentHomeworks.CountAsync(h => h.TenantId == tenantId && h.CreatedAt >= startOfWeek && (h.TeacherName == teacher.FullName || h.TeacherId == teacher.Id));

        // Notices
        var noticesRaw = await _dbContext.SchoolNotices.AsNoTracking()
            .Where(n => n.TenantId == tenantId && n.IsActive && (n.TargetAudience == "All" || n.TargetAudience == "Teachers"))
            .OrderByDescending(n => n.IsPinned)
            .ThenByDescending(n => n.CreatedAt)
            .Take(4)
            .ToListAsync();
        var recentNotices = noticesRaw.Select(n => new DashboardNoticeItemDto(
            n.Id, n.Title, n.Content, n.Category, n.CreatedAt, n.Priority
        )).ToList();

        return Ok(new TeacherDashboardSummaryDto(
            teacher.Id,
            teacher.FullName,
            teacher.EmployeeCode,
            teacher.Designation ?? "Faculty Member",
            teacher.Department,
            teacher.Branch?.Name,
            teacher.PhotoUrl,
            todayLectures.Count,
            todayLectures,
            assignedBatchNames.Count,
            assignedBatchNames,
            hasPunchedIn,
            punchTime,
            pendingTests.Count,
            pendingTests.Count,
            pendingTests,
            homeworkCount,
            12,
            6,
            recentNotices
        ));
    }
}


[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WhatsAppController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;

    public WhatsAppController(IIMSERPDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("logs")]
    public async Task<ActionResult<IEnumerable<WhatsAppLog>>> GetLogs()
    {
        var logs = await _dbContext.WhatsAppLogs
            .AsNoTracking()
            .OrderByDescending(l => l.SentAt)
            .Take(50)
            .ToListAsync();

        return Ok(logs);
    }

    [HttpGet("paged")]
    public async Task<ActionResult<PagedResultDto<WhatsAppLogPagedItemDto>>> GetLogsPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? messageType = null,
        [FromQuery] string? sortBy = "sentAt",
        [FromQuery] bool sortDescending = true)
    {
        var query = _dbContext.WhatsAppLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(l =>
                l.StudentName.ToLower().Contains(term) ||
                l.RecipientPhone.Contains(term) ||
                l.Content.ToLower().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(messageType))
        {
            if (Enum.TryParse<MessageType>(messageType, true, out var parsedType))
            {
                query = query.Where(l => l.MessageType == parsedType);
            }
        }

        query = sortBy?.ToLower() switch
        {
            "studentname" => sortDescending ? query.OrderByDescending(l => l.StudentName) : query.OrderBy(l => l.StudentName),
            "recipientphone" => sortDescending ? query.OrderByDescending(l => l.RecipientPhone) : query.OrderBy(l => l.RecipientPhone),
            "messagetype" => sortDescending ? query.OrderByDescending(l => l.MessageType) : query.OrderBy(l => l.MessageType),
            "status" => sortDescending ? query.OrderByDescending(l => l.Status) : query.OrderBy(l => l.Status),
            _ => sortDescending ? query.OrderByDescending(l => l.SentAt) : query.OrderBy(l => l.SentAt)
        };

        var totalCount = await query.CountAsync();
        var rawItems = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new
            {
                l.Id,
                l.RecipientPhone,
                l.StudentName,
                MessageType = l.MessageType.ToString(),
                l.Content,
                l.Status,
                l.SentAt
            })
            .ToListAsync();

        var items = rawItems.Select(l => new WhatsAppLogPagedItemDto(
            l.Id,
            l.RecipientPhone,
            l.StudentName,
            l.MessageType,
            l.Content,
            l.Status,
            DateTime.SpecifyKind(l.SentAt, DateTimeKind.Utc)
        )).ToList();

        return Ok(new PagedResultDto<WhatsAppLogPagedItemDto>(items, totalCount, pageNumber, pageSize));
    }
}
