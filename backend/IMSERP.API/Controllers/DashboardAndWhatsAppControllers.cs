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

    public DashboardController(IIMSERPDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary()
    {
        var totalStudents = await _dbContext.Students.CountAsync(s => s.IsActive);
        var activeBatches = await _dbContext.Batches.CountAsync();
        
        var startOfMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var totalFeeCollectedThisMonth = await _dbContext.FeePayments
            .Where(p => p.PaymentDate >= startOfMonth)
            .SumAsync(p => (decimal?)p.AmountPaid) ?? 0;

        var pendingFeesTotal = await _dbContext.FeeInvoices
            .Where(i => i.Status != InvoiceStatus.Paid)
            .SumAsync(i => (decimal?)(i.TotalAmount - i.PaidAmount)) ?? 0;

        var totalTestsConducted = await _dbContext.Tests.CountAsync();
        var whatsAppSent = await _dbContext.WhatsAppLogs.CountAsync();

        var overdueInvoices = await _dbContext.FeeInvoices
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

        var recentTests = await _dbContext.Tests
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
        var allInvoices = await _dbContext.FeeInvoices.AsNoTracking().ToListAsync();
        var allPayments = await _dbContext.FeePayments.AsNoTracking().ToListAsync();

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
        var batches = await _dbContext.Batches.AsNoTracking().ToListAsync();
        var students = await _dbContext.Students.AsNoTracking().Where(s => s.IsActive).ToListAsync();
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
        var todayAttendances = await _dbContext.StudentAttendances
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
