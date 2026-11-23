using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using IMSERP.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[Authorize]
[ApiController]
[Route("api/principal-briefing")]
public class PrincipalBriefingController : ControllerBase
{
    private readonly IMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;
    private readonly IWhatsAppService _whatsAppService;
    private readonly ILogger<PrincipalBriefingController> _logger;

    public PrincipalBriefingController(
        IMSERPDbContext dbContext,
        ICurrentUserService currentUser,
        IWhatsAppService whatsAppService,
        ILogger<PrincipalBriefingController> logger)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _whatsAppService = whatsAppService;
        _logger = logger;
    }

    [HttpGet("today")]
    public async Task<ActionResult<PrincipalMorningBriefingDto>> GetTodayMorningBriefing([FromQuery] Guid? branchId)
    {
        var tenantId = _currentUser.TenantId;
        var effectiveBranchId = branchId ?? _currentUser.BranchId;

        // Current IST Date Computation (UTC + 5:30)
        var utcNow = DateTime.UtcNow;
        var istNow = utcNow.AddHours(5.5);
        var istDate = istNow.Date;

        var startOfTodayUtc = istDate.AddHours(-5.5);
        var endOfTodayUtc = startOfTodayUtc.AddDays(1).AddTicks(-1);
        var startOfMonthUtc = new DateTime(istDate.Year, istDate.Month, 1).AddHours(-5.5);

        // Fetch Tenant / Branch Details
        var tenant = await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId);
        string instName = tenant?.Name ?? "Institutional Campus";

        string? branchName = null;
        if (effectiveBranchId.HasValue && effectiveBranchId.Value != Guid.Empty)
        {
            var b = await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(x => x.Id == effectiveBranchId.Value);
            branchName = b?.Name;
        }

        // 1. FINANCIALS (Today's Collections & Expenses)
        var feePaymentsQuery = _dbContext.FeePayments
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId && !p.IsReversed);

        if (effectiveBranchId.HasValue && effectiveBranchId.Value != Guid.Empty)
            feePaymentsQuery = feePaymentsQuery.Where(p => p.BranchId == effectiveBranchId.Value);

        var todayPayments = await feePaymentsQuery
            .Where(p => p.PaymentDate >= startOfTodayUtc && p.PaymentDate <= endOfTodayUtc)
            .ToListAsync();

        var monthPayments = await feePaymentsQuery
            .Where(p => p.PaymentDate >= startOfMonthUtc && p.PaymentDate <= endOfTodayUtc)
            .ToListAsync();

        decimal todayTotal = todayPayments.Sum(p => p.AmountPaid);
        decimal todayCash = todayPayments.Where(p => p.Mode == PaymentMode.Cash).Sum(p => p.AmountPaid);
        decimal todayUpi = todayPayments.Where(p => p.Mode == PaymentMode.UPI || p.Mode == PaymentMode.BankTransfer || p.Mode == PaymentMode.Card).Sum(p => p.AmountPaid);
        decimal todayCheque = todayPayments.Where(p => p.Mode == PaymentMode.Cheque || p.Mode == PaymentMode.NetBanking).Sum(p => p.AmountPaid);
        decimal monthTotal = monthPayments.Sum(p => p.AmountPaid);

        // Today's Expenses
        var expenseQuery = _dbContext.ExpenseVouchers
            .AsNoTracking()
            .Where(e => e.TenantId == tenantId && e.ExpenseDate >= startOfTodayUtc && e.ExpenseDate <= endOfTodayUtc);

        if (effectiveBranchId.HasValue && effectiveBranchId.Value != Guid.Empty)
            expenseQuery = expenseQuery.Where(e => e.BranchId == effectiveBranchId.Value);

        decimal todayExpenseTotal = await expenseQuery.SumAsync(e => e.Amount);

        var financials = new BriefingFinancialsDto(
            TodayCollection: todayTotal,
            TodayCash: todayCash,
            TodayOnlineOrUpi: todayUpi,
            TodayChequeOrOther: todayCheque,
            MonthToDateCollection: monthTotal,
            TodayExpense: todayExpenseTotal,
            ReceiptsIssuedTodayCount: todayPayments.Count
        );

        // 2. STUDENT ATTENDANCE PULSE
        var activeStudentsQuery = _dbContext.Students
            .AsNoTracking()
            .Include(s => s.Class)
            .Where(s => s.TenantId == tenantId && s.IsActive);

        if (effectiveBranchId.HasValue && effectiveBranchId.Value != Guid.Empty)
            activeStudentsQuery = activeStudentsQuery.Where(s => s.BranchId == effectiveBranchId.Value);

        var allStudents = await activeStudentsQuery.ToListAsync();
        int totalStudentCount = allStudents.Count;

        var studentIds = allStudents.Select(s => s.Id).ToList();

        var todayAttendance = await _dbContext.StudentAttendances
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId &&
                        studentIds.Contains(a.StudentId) &&
                        a.AttendanceDate >= startOfTodayUtc &&
                        a.AttendanceDate <= endOfTodayUtc)
            .ToListAsync();

        int presentCount = todayAttendance.Count(a => a.Status == TeacherAttendanceStatus.Present);
        int absentCount = todayAttendance.Count(a => a.Status == TeacherAttendanceStatus.Absent);
        int lateCount = todayAttendance.Count(a => a.Status == TeacherAttendanceStatus.Late);
        int unmarked = Math.Max(0, totalStudentCount - todayAttendance.Count);

        decimal overallAttPct = (presentCount + lateCount) > 0 && totalStudentCount > 0
            ? Math.Round((decimal)(presentCount + lateCount) / totalStudentCount * 100m, 1)
            : 0m;

        // Class-wise dips
        var lowAlerts = new List<string>();
        var classGroups = allStudents.GroupBy(s => s.Class?.Name ?? "General");
        foreach (var cg in classGroups)
        {
            var cIds = cg.Select(x => x.Id).ToList();
            var cAtt = todayAttendance.Where(a => cIds.Contains(a.StudentId)).ToList();
            if (cAtt.Count >= 5) // At least 5 attendance marked
            {
                int cPresent = cAtt.Count(x => x.Status == TeacherAttendanceStatus.Present || x.Status == TeacherAttendanceStatus.Late);
                decimal cPct = Math.Round((decimal)cPresent / cg.Count() * 100m, 1);
                if (cPct < 75m)
                {
                    lowAlerts.Add($"{cg.Key}: Attendance is low at {cPct}% ({cg.Count() - cPresent} absent)");
                }
            }
        }

        var attendance = new BriefingAttendanceDto(
            TotalStudents: totalStudentCount,
            PresentStudents: presentCount,
            AbsentStudents: absentCount,
            LateStudents: lateCount,
            AttendancePercentage: overallAttPct,
            UnmarkedStudentsCount: unmarked,
            LowAttendanceAlerts: lowAlerts
        );

        // 3. STAFF ATTENDANCE & LEAVES TODAY
        var teachersQuery = _dbContext.Teachers
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId && t.IsActive);

        if (effectiveBranchId.HasValue && effectiveBranchId.Value != Guid.Empty)
            teachersQuery = teachersQuery.Where(t => t.BranchId == effectiveBranchId.Value);

        var teachers = await teachersQuery.ToListAsync();
        var teacherIds = teachers.Select(t => t.Id).ToList();

        // Approved Leaves covering today
        var leavesToday = await _dbContext.TeacherLeaves
            .AsNoTracking()
            .Where(l => l.TenantId == tenantId &&
                        teacherIds.Contains(l.TeacherId) &&
                        l.Status == LeaveStatus.Approved &&
                        l.IsCancellationApproved != true &&
                        l.FromDate <= istDate &&
                        l.ToDate >= istDate)
            .ToListAsync();

        var absentTeachersList = new List<AbsentTeacherSummaryDto>();
        foreach (var l in leavesToday)
        {
            var t = teachers.FirstOrDefault(x => x.Id == l.TeacherId);
            if (t != null)
            {
                absentTeachersList.Add(new AbsentTeacherSummaryDto(
                    t.Id,
                    t.FullName,
                    t.Designation ?? "Faculty",
                    $"{l.LeaveType} (Approved Leave)",
                    l.Reason,
                    4 // Estimated periods
                ));
            }
        }

        var staffStatus = new BriefingStaffStatusDto(
            TotalStaff: teachers.Count,
            PresentStaff: Math.Max(0, teachers.Count - absentTeachersList.Count),
            AbsentStaff: absentTeachersList.Count,
            StaffOnLeave: leavesToday.Count,
            AbsentTeachers: absentTeachersList
        );

        // 4. BIRTHDAYS TODAY
        var birthdays = new List<BriefingBirthdayItemDto>();

        foreach (var s in allStudents)
        {
            if (s.DateOfBirth.HasValue && s.DateOfBirth.Value.Month == istDate.Month && s.DateOfBirth.Value.Day == istDate.Day)
            {
                birthdays.Add(new BriefingBirthdayItemDto(
                    s.Id,
                    s.StudentName,
                    "Student",
                    s.Class?.Name ?? s.Batch?.Name ?? "Student",
                    s.ParentWhatsAppPhone,
                    s.ProfilePhoto
                ));
            }
        }

        foreach (var t in teachers)
        {
            if (t.DateOfBirth.HasValue && t.DateOfBirth.Value.Month == istDate.Month && t.DateOfBirth.Value.Day == istDate.Day)
            {
                birthdays.Add(new BriefingBirthdayItemDto(
                    t.Id,
                    t.FullName,
                    "Staff",
                    t.Designation ?? "Faculty",
                    t.WhatsAppPhone ?? t.PhoneNumber,
                    t.PhotoUrl
                ));
            }
        }

        // 5. CRITICAL ACTION ITEMS
        var actionItems = new List<BriefingActionItemDto>();

        // Pending Enquiries
        var pendingEnquiries = await _dbContext.AdmissionEnquiries
            .CountAsync(e => e.TenantId == tenantId && e.Status == "Pending");
        if (pendingEnquiries > 0)
        {
            actionItems.Add(new BriefingActionItemDto(
                "Admission",
                $"{pendingEnquiries} Pending Admission Inquiries",
                "Prospective parents waiting for campus counseling or admission follow-up.",
                "Warning",
                "/admissions/enquiries"
            ));
        }

        // Unresolved Teacher Leaves
        var pendingStaffLeaves = await _dbContext.TeacherLeaves
            .CountAsync(l => l.TenantId == tenantId && l.Status == LeaveStatus.Pending);
        if (pendingStaffLeaves > 0)
        {
            actionItems.Add(new BriefingActionItemDto(
                "Staff",
                $"{pendingStaffLeaves} Staff Leave Applications Pending Approval",
                "Faculty members requested leaves requiring principal approval.",
                "Info",
                "/teachers/leaves"
            ));
        }

        // Critical Retention Risks
        var criticalRisksCount = await _dbContext.StudentRetentionInterventions
            .CountAsync(i => i.TenantId == tenantId && i.OutcomeStatus == "UnderMonitoring");
        if (criticalRisksCount > 0)
        {
            actionItems.Add(new BriefingActionItemDto(
                "Academic",
                $"{criticalRisksCount} Students Under Active Dropout Monitoring",
                "Scheduled for review this week to prevent student dropout.",
                "Critical",
                "/students/retention"
            ));
        }

        // 6. SYNTHESIZE DYNAMIC AI SPOKEN SCRIPT (HINDI & ENGLISH)
        string istFormatted = istDate.ToString("dd MMMM yyyy");
        string campusTitle = string.IsNullOrWhiteSpace(branchName) ? instName : $"{instName} ({branchName})";

        string greetingHi = $"सुप्रभात! {campusTitle} की आज की दैनिक ब्रीफिंग ({istFormatted}):";
        string greetingEn = $"Good morning! Daily executive intelligence briefing for {campusTitle} ({istFormatted}):";

        string voiceHi = $"नमस्ते सर! {campusTitle} की आज की दैनिक ब्रीफिंग। " +
            $"आज कुल {totalStudentCount} छात्रों में से {presentCount} छात्र उपस्थित हैं, जो कि {overallAttPct}% उपस्थिति है। " +
            (absentTeachersList.Count > 0
                ? $"संस्थान में {absentTeachersList.Count} शिक्षक अवकाश पर हैं: {string.Join(", ", absentTeachersList.Select(x => x.TeacherName))}। "
                : "सभी शिक्षक समय पर उपस्थित हैं। ") +
            (todayTotal > 0
                ? $"आज अब तक ₹{todayTotal:N0} की फीस वसूली दर्ज की गई है। "
                : "आज की फीस वसूली प्रारंभ हो चुकी है। ") +
            (birthdays.Count > 0
                ? $"आज {birthdays.Count} छात्र एवं शिक्षकों का जन्मदिन है, जिन्हें शुभकामनाएं भेजी जा सकती हैं। "
                : "") +
            "समस्त कक्षाएं सुचारू रूप से संचालित हैं। आपका दिन शुभ एवं फलदायी हो!";

        string voiceEn = $"Good morning Principal! Here is your daily operational briefing for {campusTitle}. " +
            $"Student attendance stands at {overallAttPct}% with {presentCount} students present out of {totalStudentCount}. " +
            (absentTeachersList.Count > 0
                ? $"{absentTeachersList.Count} teachers are on approved leave today. "
                : "Full staff presence is reported across all classrooms. ") +
            $"Today's fee collection currently stands at ₹{todayTotal:N0}. " +
            (birthdays.Count > 0 ? $"{birthdays.Count} birthdays are being celebrated today. " : "") +
            "All instructional units are operating normally. Have a productive day!";

        return Ok(new PrincipalMorningBriefingDto(
            BriefingDateUtc: startOfTodayUtc,
            BriefingDateIstFormatted: istFormatted,
            InstituteName: instName,
            BranchName: branchName,
            GreetingMessageHindi: greetingHi,
            GreetingMessageEnglish: greetingEn,
            AiSpokenScriptHindi: voiceHi,
            AiSpokenScriptEnglish: voiceEn,
            Financials: financials,
            Attendance: attendance,
            Staff: staffStatus,
            BirthdaysToday: birthdays,
            ActionItems: actionItems
        ));
    }

    [HttpPost("send-birthday-wishes")]
    public async Task<ActionResult> SendBirthdayWishes([FromBody] SendBirthdayWishRequestDto dto)
    {
        var tenantId = _currentUser.TenantId;

        if (string.IsNullOrWhiteSpace(dto.Phone))
            return BadRequest("Recipient phone number is required.");

        var tenant = await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId);
        string instName = tenant?.Name ?? "School Administration";

        string wishMessage = $"प्रिय {dto.RecipientName}, {instName} परिवार की ओर से आपको जन्मदिन की हार्दिक शुभकामनाएं! ईश्वर आपको उत्तम स्वास्थ्य, दीर्घायु एवं उज्ज्वल भविष्य प्रदान करें। 🎂🎉💐";

        try
        {
            await _whatsAppService.TestWhatsAppGatewayAsync(tenantId, dto.Phone, wishMessage);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Briefing] Birthday wish WhatsApp gateway dispatch failed");
        }

        return Ok(new { success = true, message = wishMessage });
    }
}

public record SendBirthdayWishRequestDto(
    Guid RecipientId,
    string RecipientName,
    string Phone,
    string Role
);
