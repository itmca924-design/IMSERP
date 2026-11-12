using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using IMSERP.API.Services;
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
    private readonly IMenuPermissionService _menuPermissions;

    public DashboardController(IIMSERPDbContext dbContext, ICurrentUserService currentUser, IMenuPermissionService menuPermissions)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _menuPermissions = menuPermissions;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary()
    {
        if (!await _menuPermissions.HasPermissionAsync("/dashboard", MenuPermissionOperation.View))
            return Forbid();

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
            .Where(p => !p.IsReversed && !p.IsAdvanceAdjustment && p.PaymentDate >= startOfMonth)
            .SumAsync(p => (decimal?)p.AmountPaid) ?? 0;

        var pendingFeesTotal = await feeInvoicesQuery
            .Where(i => i.Status != InvoiceStatus.Paid)
            .SumAsync(i => (decimal?)(i.TotalAmount - i.PaidAmount)) ?? 0;

        var totalTestsConducted = await testsQuery.CountAsync();
        var whatsAppSent = await whatsAppQuery.CountAsync();

        var rawOverdueInvoices = await feeInvoicesQuery
            .AsNoTracking()
            .Include(i => i.Student)
                .ThenInclude(s => s.Class)
            .Include(i => i.Student)
                .ThenInclude(s => s.Section)
            .Include(i => i.Student)
                .ThenInclude(s => s.Batch)
            .Where(i => i.Student != null &&
                        !i.Student.IsDeleted &&
                        i.Student.IsActive &&
                        i.Status != InvoiceStatus.Paid &&
                        i.Status != InvoiceStatus.Cancelled &&
                        (i.TotalAmount - i.PaidAmount) > 0 &&
                        (i.Status == InvoiceStatus.Overdue || i.DueDate <= DateTime.UtcNow || i.Status == InvoiceStatus.Pending || i.Status == InvoiceStatus.Partial))
            .ToListAsync();

        var overdueInvoices = rawOverdueInvoices
            .GroupBy(i => i.StudentId)
            .Select(g =>
            {
                var rep = g.OrderByDescending(x => x.DueDate).ThenByDescending(x => x.CreatedAt).First();
                var totalAmt = g.Sum(x => x.TotalAmount);
                var paidAmt = g.Sum(x => x.PaidAmount);
                var dueAmt = g.Sum(x => x.TotalAmount - x.PaidAmount);
                var latestCreated = g.Max(x => x.CreatedAt);
                var latestDue = g.Max(x => x.DueDate);
                var invCount = g.Count();
                var statusStr = paidAmt > 0
                    ? InvoiceStatus.Partial.ToString()
                    : (g.Any(x => x.Status == InvoiceStatus.Overdue || x.DueDate <= DateTime.UtcNow) ? InvoiceStatus.Overdue.ToString() : InvoiceStatus.Pending.ToString());

                string className = !string.IsNullOrEmpty(rep.ClassName)
                    ? (!string.IsNullOrEmpty(rep.SectionName) ? $"{rep.ClassName} ({rep.SectionName})" : rep.ClassName)
                    : (rep.Student != null && rep.Student.Class != null
                        ? (rep.Student.Section != null ? $"{rep.Student.Class.Name} ({rep.Student.Section.Name})" : rep.Student.Class.Name)
                        : (rep.Student != null && rep.Student.Batch != null ? rep.Student.Batch.Name : "General"));

                bool isSchool = rep.Student != null && rep.Student.IsSchoolStudent;
                bool isCoaching = rep.Student != null && rep.Student.IsCoachingStudent;
                string scopeTag = (isSchool && isCoaching) ? "School + Coaching" : (isCoaching ? "Coaching" : "School");

                return new
                {
                    LatestCreated = latestCreated,
                    LatestDue = latestDue,
                    Dto = new FeeInvoiceDto(
                        rep.Id,
                        rep.StudentId,
                        rep.Student != null ? rep.Student.StudentName : "",
                        rep.Student != null ? rep.Student.RollNumber : "",
                        rep.Student != null ? rep.Student.ParentWhatsAppPhone : "",
                        invCount > 1 ? $"{rep.InvoiceNumber} (+{invCount - 1})" : rep.InvoiceNumber,
                        invCount > 1 ? $"{invCount} Pending Invoices Consolidated" : rep.Title,
                        totalAmt,
                        paidAmt,
                        dueAmt,
                        latestDue,
                        statusStr,
                        className,
                        rep.Student != null ? rep.Student.ProfilePhoto : null,
                        false,
                        null,
                        null,
                        isSchool,
                        isCoaching,
                        scopeTag
                    )
                };
            })
            .OrderByDescending(x => x.LatestCreated)
            .ThenBy(x => x.LatestDue)
            .Take(10)
            .Select(x => x.Dto)
            .ToList();

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

    [HttpGet("urgent-fee-reminders")]
    public async Task<ActionResult<PagedResultDto<FeeInvoiceDto>>> GetUrgentFeeReminders(
        [FromQuery] int pageIndex = 0,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? scope = null, // "All", "School", "Coaching"
        [FromQuery] Guid? classId = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortOrder = "desc")
    {
        if (!await _menuPermissions.HasPermissionAsync("/dashboard", MenuPermissionOperation.View))
            return Forbid();

        bool isSuperAdmin = string.Equals(_currentUser.UserRole, "SuperAdmin", StringComparison.OrdinalIgnoreCase);
        var tenantId = _currentUser.TenantId;
        var activeBranchId = _currentUser.BranchId;

        var feeInvoicesQuery = isSuperAdmin ? _dbContext.FeeInvoices.IgnoreQueryFilters() : _dbContext.FeeInvoices;

        var query = feeInvoicesQuery
            .AsNoTracking()
            .Include(i => i.Student)
                .ThenInclude(s => s.Class)
            .Include(i => i.Student)
                .ThenInclude(s => s.Section)
            .Include(i => i.Student)
                .ThenInclude(s => s.Batch)
            .Where(i => i.Student != null &&
                        !i.Student.IsDeleted &&
                        i.Student.IsActive &&
                        i.Status != InvoiceStatus.Paid &&
                        i.Status != InvoiceStatus.Cancelled &&
                        (i.TotalAmount - i.PaidAmount) > 0 &&
                        (i.Status == InvoiceStatus.Overdue || i.DueDate <= DateTime.UtcNow || i.Status == InvoiceStatus.Pending || i.Status == InvoiceStatus.Partial));

        // Branch filtering per AGENTS.md
        if (activeBranchId.HasValue && !isSuperAdmin)
        {
            query = query.Where(i => i.BranchId == activeBranchId || (i.Student != null && i.Student.BranchId == activeBranchId));
        }

        // Division Scope filtering per AGENTS.md Tri-Modal Division Architecture
        if (!string.IsNullOrWhiteSpace(scope) && !scope.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            if (scope.Equals("School", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(i => i.Student.IsSchoolStudent);
            }
            else if (scope.Equals("Coaching", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(i => i.Student.IsCoachingStudent);
            }
        }

        // Class / Batch filtering
        if (classId.HasValue && classId.Value != Guid.Empty)
        {
            query = query.Where(i => i.ClassId == classId || (i.Student != null && (i.Student.ClassId == classId || i.Student.BatchId == classId)));
        }

        // Search filtering (student name, roll no, invoice no, phone, class)
        var searchTermNorm = !string.IsNullOrWhiteSpace(search) ? search.Trim().ToLower() : null;
        if (!string.IsNullOrEmpty(searchTermNorm))
        {
            query = query.Where(i => (i.Student.StudentName != null && i.Student.StudentName.ToLower().Contains(searchTermNorm)) ||
                                     (i.Student.RollNumber != null && i.Student.RollNumber.ToLower().Contains(searchTermNorm)) ||
                                     (i.InvoiceNumber != null && i.InvoiceNumber.ToLower().Contains(searchTermNorm)) ||
                                     (i.Student.ParentWhatsAppPhone != null && i.Student.ParentWhatsAppPhone.Contains(searchTermNorm)) ||
                                     (i.ClassName != null && i.ClassName.ToLower().Contains(searchTermNorm)) ||
                                     (i.Student.Class != null && i.Student.Class.Name.ToLower().Contains(searchTermNorm)) ||
                                     (i.Student.Batch != null && i.Student.Batch.Name.ToLower().Contains(searchTermNorm)));
        }

        var matchingInvoices = await query.ToListAsync();

        // Check deduplication logs for today in IST - Student-Specific (Handles Siblings sharing parent phone)
        var todayStartUtc = GetTodayStartUtcInIst();
        var todayLogs = await _dbContext.WhatsAppLogs
            .AsNoTracking()
            .Where(l => l.TenantId == tenantId &&
                        l.MessageType == MessageType.FeeReminder &&
                        l.SentAt >= todayStartUtc)
            .Select(l => new { l.RecipientPhone, l.StudentName, l.SentAt, l.Content })
            .ToListAsync();

        var remindedComposite = new HashSet<string>(
            todayLogs.Where(l => !string.IsNullOrWhiteSpace(l.StudentName))
                     .Select(l => $"{NormalizePhone(l.RecipientPhone)}::{l.StudentName.Trim().ToLower()}")
        );

        var remindedStudentNames = new HashSet<string>(
            todayLogs.Where(l => !string.IsNullOrWhiteSpace(l.StudentName))
                     .Select(l => l.StudentName.Trim().ToLower())
        );

        // Consolidate per StudentId so each student shows a single row with accurate total dues (including Partial + Pending) matching Student Ledger
        var groupedStudents = matchingInvoices
            .GroupBy(i => i.StudentId)
            .Select(g =>
            {
                var rep = g.OrderByDescending(x => x.DueDate).ThenByDescending(x => x.CreatedAt).First();
                var totalAmt = g.Sum(x => x.TotalAmount);
                var paidAmt = g.Sum(x => x.PaidAmount);
                var dueAmt = g.Sum(x => x.TotalAmount - x.PaidAmount);
                var latestCreatedAt = g.Max(x => x.CreatedAt);
                var latestDueDate = g.Max(x => x.DueDate);
                var invCount = g.Count();

                var phoneNorm = NormalizePhone(rep.Student?.ParentWhatsAppPhone);
                var nameNorm = rep.Student?.StudentName?.Trim().ToLower() ?? "";
                string compositeKey = $"{phoneNorm}::{nameNorm}";

                bool alreadyReminded = !string.IsNullOrEmpty(nameNorm) &&
                                       (remindedComposite.Contains(compositeKey) || remindedStudentNames.Contains(nameNorm));

                var logMatch = alreadyReminded
                    ? todayLogs.FirstOrDefault(l => l.StudentName.Trim().ToLower() == nameNorm)
                    : null;

                string className = !string.IsNullOrEmpty(rep.ClassName)
                    ? (!string.IsNullOrEmpty(rep.SectionName) ? $"{rep.ClassName} ({rep.SectionName})" : rep.ClassName)
                    : (rep.Student != null && rep.Student.Class != null
                        ? (rep.Student.Section != null ? $"{rep.Student.Class.Name} ({rep.Student.Section.Name})" : rep.Student.Class.Name)
                        : (rep.Student != null && rep.Student.Batch != null ? rep.Student.Batch.Name : "General"));

                bool isSchool = rep.Student?.IsSchoolStudent ?? false;
                bool isCoaching = rep.Student?.IsCoachingStudent ?? false;
                string scopeTag = (isSchool && isCoaching) ? "School + Coaching" : (isCoaching ? "Coaching" : "School");

                var statusStr = paidAmt > 0
                    ? InvoiceStatus.Partial.ToString()
                    : (g.Any(x => x.Status == InvoiceStatus.Overdue || x.DueDate <= DateTime.UtcNow) ? InvoiceStatus.Overdue.ToString() : InvoiceStatus.Pending.ToString());

                int searchRank = 0;
                if (!string.IsNullOrEmpty(searchTermNorm))
                {
                    var rollNorm = rep.Student?.RollNumber?.Trim().ToLower() ?? "";
                    if (nameNorm == searchTermNorm || rollNorm == searchTermNorm || g.Any(x => x.InvoiceNumber != null && x.InvoiceNumber.Trim().ToLower() == searchTermNorm))
                        searchRank = 0;
                    else if (nameNorm.StartsWith(searchTermNorm))
                        searchRank = 1;
                    else
                        searchRank = 2;
                }

                return new
                {
                    SearchRank = searchRank,
                    NameLength = nameNorm.Length,
                    StudentName = rep.Student?.StudentName ?? "",
                    ClassName = className,
                    DueAmount = dueAmt,
                    DueDate = latestDueDate,
                    CreatedAt = latestCreatedAt,
                    Dto = new FeeInvoiceDto(
                        rep.Id,
                        rep.StudentId,
                        rep.Student?.StudentName ?? "",
                        rep.Student?.RollNumber ?? "",
                        rep.Student?.ParentWhatsAppPhone ?? "",
                        invCount > 1 ? $"{rep.InvoiceNumber} (+{invCount - 1})" : rep.InvoiceNumber,
                        invCount > 1 ? $"{invCount} Pending Invoices Consolidated" : rep.Title,
                        totalAmt,
                        paidAmt,
                        dueAmt,
                        latestDueDate,
                        statusStr,
                        className,
                        rep.Student?.ProfilePhoto,
                        alreadyReminded,
                        logMatch != null ? DateTime.SpecifyKind(logMatch.SentAt, DateTimeKind.Utc) : null,
                        logMatch?.Content?.Contains("AI Voice") == true ? "Voice" : "WhatsApp",
                        isSchool,
                        isCoaching,
                        scopeTag
                    )
                };
            });

        // Sorting with Search Relevance Priority (Exact match first, StartsWith second, Contains last)
        bool isAsc = string.Equals(sortOrder, "asc", StringComparison.OrdinalIgnoreCase);
        var orderedStudents = !string.IsNullOrEmpty(searchTermNorm)
            ? groupedStudents.OrderBy(x => x.SearchRank).ThenBy(x => x.NameLength)
            : groupedStudents.OrderBy(x => 0);

        orderedStudents = (sortField?.ToLower()) switch
        {
            "studentname" => isAsc ? orderedStudents.ThenBy(x => x.StudentName) : orderedStudents.ThenByDescending(x => x.StudentName),
            "classname" => isAsc ? orderedStudents.ThenBy(x => x.ClassName) : orderedStudents.ThenByDescending(x => x.ClassName),
            "dueamount" => isAsc ? orderedStudents.ThenBy(x => x.DueAmount) : orderedStudents.ThenByDescending(x => x.DueAmount),
            "duedate" => isAsc ? orderedStudents.ThenBy(x => x.DueDate) : orderedStudents.ThenByDescending(x => x.DueDate),
            _ => isAsc ? orderedStudents.ThenBy(x => x.CreatedAt) : orderedStudents.ThenByDescending(x => x.CreatedAt)
        };

        var finalList = orderedStudents.ToList();
        var totalCount = finalList.Count;

        var items = finalList
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .Select(x => x.Dto)
            .ToList();

        return Ok(new PagedResultDto<FeeInvoiceDto>(items, totalCount, pageIndex + 1, pageSize));
    }

    [HttpPost("log-reminder-dispatched")]
    public async Task<ActionResult> LogReminderDispatched([FromBody] LogReminderDispatchedDto req)
    {
        if (!await _menuPermissions.HasPermissionAsync("/dashboard", MenuPermissionOperation.Create) &&
            !await _menuPermissions.HasPermissionAsync("/fees", MenuPermissionOperation.Create))
        {
            return Forbid();
        }

        var todayStartUtc = GetTodayStartUtcInIst();
        var phoneNorm = NormalizePhone(req.RecipientPhone);
        var sName = req.StudentName?.Trim().ToLower() ?? "";

        // Check deduplication per student per day - strictly by student name so siblings sharing phone are not blocked
        var alreadySent = await _dbContext.WhatsAppLogs
            .AsNoTracking()
            .AnyAsync(l => l.TenantId == _currentUser.TenantId &&
                           l.MessageType == MessageType.FeeReminder &&
                           l.SentAt >= todayStartUtc &&
                           l.StudentName.ToLower() == sName);

        if (alreadySent)
        {
            return BadRequest(new { message = "Fee reminder has already been dispatched to this student today. Per-day single message limit enforced." });
        }

        var log = new WhatsAppLog
        {
            TenantId = _currentUser.TenantId,
            RecipientPhone = req.RecipientPhone ?? "",
            StudentName = req.StudentName ?? "Student",
            MessageType = MessageType.FeeReminder,
            Content = $"Fee reminder ({req.ReminderType ?? "WhatsApp"}) dispatched for student {req.StudentName} by {_currentUser.Username ?? "Staff"}",
            Status = "Sent",
            SentAt = DateTime.UtcNow
        };

        _dbContext.WhatsAppLogs.Add(log);
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = "Reminder dispatch recorded successfully.", sentAt = log.SentAt });
    }

    private static DateTime GetTodayStartUtcInIst()
    {
        TimeZoneInfo istZone;
        try
        {
            istZone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
        }
        catch
        {
            istZone = TimeZoneInfo.CreateCustomTimeZone("IST", TimeSpan.FromHours(5.5), "India Standard Time", "IST");
        }
        var istNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istZone);
        var istMidnight = new DateTime(istNow.Year, istNow.Month, istNow.Day, 0, 0, 0, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(istMidnight, istZone);
    }

    private static string NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return string.Empty;
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.Length == 12 && digits.StartsWith("91")) return digits.Substring(2);
        if (digits.Length == 11 && digits.StartsWith("0")) return digits.Substring(1);
        return digits;
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

        // Timezone: Indian Standard Time (IST - Asia/Kolkata)
        TimeZoneInfo istZone;
        try { istZone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time"); }
        catch { istZone = TimeZoneInfo.Utc; }

        var istNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istZone);
        var today = istNow.Date;
        var todayDowFull = istNow.DayOfWeek.ToString();
        var todayDowShort = istNow.ToString("ddd", System.Globalization.CultureInfo.InvariantCulture);

        var assignments = await _dbContext.TeacherBatchAssignments.AsNoTracking()
            .Include(a => a.Class)
            .Include(a => a.Section)
            .Include(a => a.Batch)
            .Where(a => a.TeacherId == teacher.Id && a.IsActive)
            .ToListAsync();

        var todayLectures = assignments
            .Where(a => string.IsNullOrWhiteSpace(a.DaysOfWeek) ||
                        a.DaysOfWeek.Contains(todayDowFull, StringComparison.OrdinalIgnoreCase) ||
                        a.DaysOfWeek.Contains(todayDowShort, StringComparison.OrdinalIgnoreCase))
            .OrderBy(a => a.TimeSlot)
            .Select((a, idx) => new TeacherTodayLectureDto(
                $"Period {idx + 1}",
                a.Class != null ? (a.Section != null ? $"{a.Class.Name} ({a.Section.Name})" : a.Class.Name) : (a.Batch != null ? a.Batch.Name : "Class"),
                a.Subject,
                $"Room 10{idx + 1}",
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
