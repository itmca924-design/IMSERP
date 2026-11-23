using System.Text.RegularExpressions;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

public class UniversalCopilotQueryRequestDto
{
    public string Query { get; set; } = string.Empty;
    public Guid? BranchId { get; set; }
    public string? Language { get; set; } = "hi-IN";
}

public class UniversalCopilotActionLinkDto
{
    public string Label { get; set; } = string.Empty;
    public string RouteUrl { get; set; } = string.Empty;
    public string Icon { get; set; } = "arrow_forward";
    public string? Phone { get; set; }
}

public class UniversalCopilotQueryResponseDto
{
    public string Query { get; set; } = string.Empty;
    public string Intent { get; set; } = "General"; // "Student" | "Financials" | "Attendance" | "Navigation" | "General"
    public string SpokenResponseHindi { get; set; } = string.Empty;
    public string SpokenResponseEnglish { get; set; } = string.Empty;
    public string FormattedAnswer { get; set; } = string.Empty;
    public string? HighlightMetric { get; set; }
    public string? HighlightLabel { get; set; }
    public List<UniversalCopilotActionLinkDto> ActionLinks { get; set; } = new();
}

[ApiController]
[Route("api/copilot")]
[Authorize]
[IMSERP.API.Services.SkipMenuPermission]
public class UniversalCopilotController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public UniversalCopilotController(IIMSERPDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    private static DateTime GetIstToday()
    {
        var istZone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istZone).Date;
    }

    [HttpPost("universal-query")]
    public async Task<ActionResult<UniversalCopilotQueryResponseDto>> ProcessQuery(
        [FromBody] UniversalCopilotQueryRequestDto dto)
    {
        var rawQuery = (dto.Query ?? "").Trim();
        if (string.IsNullOrWhiteSpace(rawQuery))
        {
            return BadRequest(new { message = "Query cannot be empty." });
        }

        var q = rawQuery.ToLower();
        var tenantId = _currentUser.TenantId;
        var effectiveBranchId = dto.BranchId ?? _currentUser.BranchId;

        var tenant = await _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId);
        var instituteName = tenant?.Name ?? "Institute";

        // ════════════════════════════════════════════════════════════
        // 1. NAVIGATION INTENT
        // ════════════════════════════════════════════════════════════
        if (q.Contains("day book") || q.Contains("cash book"))
        {
            return Ok(new UniversalCopilotQueryResponseDto
            {
                Query = rawQuery,
                Intent = "Navigation",
                SpokenResponseHindi = "Main aapko Day Book journal par le ja raha hoon.",
                SpokenResponseEnglish = "Navigating to Day Book journal.",
                FormattedAnswer = "Opening **Day Book (Daily Cash & Bank Journal)**.",
                HighlightMetric = "Day Book",
                HighlightLabel = "Finance Module",
                ActionLinks = new() { new() { Label = "Open Day Book", RouteUrl = "/finance/day-book", Icon = "auto_stories" } }
            });
        }

        if (q.Contains("fee recovery") || q.Contains("recovery agent"))
        {
            return Ok(new UniversalCopilotQueryResponseDto
            {
                Query = rawQuery,
                Intent = "Navigation",
                SpokenResponseHindi = "Main aapko AI Fee Recovery Agent par le ja raha hoon.",
                SpokenResponseEnglish = "Opening AI Fee Recovery Agent.",
                FormattedAnswer = "Opening **AI Autonomous Fee Recovery Agent**.",
                HighlightMetric = "Fee Recovery Agent",
                HighlightLabel = "Smart Dues Engine",
                ActionLinks = new() { new() { Label = "Open Fee Recovery Agent", RouteUrl = "/finance/fee-recovery-agent", Icon = "psychology" } }
            });
        }

        if (q.Contains("briefing") || q.Contains("morning briefing") || q.Contains("principal desk"))
        {
            return Ok(new UniversalCopilotQueryResponseDto
            {
                Query = rawQuery,
                Intent = "Navigation",
                SpokenResponseHindi = "Main aapko Principal AI Morning Briefing Desk par le ja raha hoon.",
                SpokenResponseEnglish = "Opening Principal AI Morning Briefing Desk.",
                FormattedAnswer = "Opening **Principal AI Morning Briefing Desk**.",
                HighlightMetric = "Morning Briefing",
                HighlightLabel = "Executive Desk",
                ActionLinks = new() { new() { Label = "Open Morning Briefing", RouteUrl = "/dashboard/briefing", Icon = "record_voice_over" } }
            });
        }

        if (q.Contains("scanner") || q.Contains("face attendance") || q.Contains("camera attendance"))
        {
            return Ok(new UniversalCopilotQueryResponseDto
            {
                Query = rawQuery,
                Intent = "Navigation",
                SpokenResponseHindi = "Main AI Face Attendance Scanner khol raha hoon.",
                SpokenResponseEnglish = "Opening AI Camera & Face Attendance Scanner.",
                FormattedAnswer = "Opening **AI Camera & Face Attendance Scanner**.",
                HighlightMetric = "AI Face Scanner",
                HighlightLabel = "Gate Kiosk",
                ActionLinks = new() { new() { Label = "Open AI Scanner", RouteUrl = "/attendance/ai-scanner", Icon = "camera_indoor" } }
            });
        }

        if (q.Contains("retention") || q.Contains("dropout") || q.Contains("early warning"))
        {
            return Ok(new UniversalCopilotQueryResponseDto
            {
                Query = rawQuery,
                Intent = "Navigation",
                SpokenResponseHindi = "Main Student Retention aur Early Warning Desk khol raha hoon.",
                SpokenResponseEnglish = "Opening Student Retention & Early Warning Desk.",
                FormattedAnswer = "Opening **Student Dropout & Retention Early Warning Desk**.",
                HighlightMetric = "Retention Desk",
                HighlightLabel = "Student Analytics",
                ActionLinks = new() { new() { Label = "Open Retention Desk", RouteUrl = "/students/retention", Icon = "shield" } }
            });
        }

        if (q.Contains("question paper") || q.Contains("lesson plan") || q.Contains("teacher copilot"))
        {
            return Ok(new UniversalCopilotQueryResponseDto
            {
                Query = rawQuery,
                Intent = "Navigation",
                SpokenResponseHindi = "Main Teacher Copilot studio khol raha hoon.",
                SpokenResponseEnglish = "Opening Teacher Copilot Studio.",
                FormattedAnswer = "Opening **Teacher Copilot Studio (Question Paper & Lesson Plan Generator)**.",
                HighlightMetric = "Teacher Studio",
                HighlightLabel = "Academic Studio",
                ActionLinks = new() { new() { Label = "Open Teacher Copilot", RouteUrl = "/teachers/copilot", Icon = "history_edu" } }
            });
        }

        // ════════════════════════════════════════════════════════════
        // 2. FINANCIAL / DAY BOOK / COLLECTION INTENT
        // ════════════════════════════════════════════════════════════
        if (q.Contains("collection") || q.Contains("fees collected") || q.Contains("aaj kitna aaya") || q.Contains("today fee") || q.Contains("income") || q.Contains("payment"))
        {
            var todayIst = GetIstToday();
            var tomorrowIst = todayIst.AddDays(1);

            var payQuery = _db.FeePayments.AsNoTracking()
                .Where(p => p.TenantId == tenantId && !p.IsReversed && p.PaymentDate >= todayIst && p.PaymentDate < tomorrowIst);

            var expQuery = _db.ExpenseVouchers.AsNoTracking()
                .Where(e => e.TenantId == tenantId && e.ExpenseDate >= todayIst && e.ExpenseDate < tomorrowIst);

            if (effectiveBranchId.HasValue && effectiveBranchId.Value != Guid.Empty)
            {
                payQuery = payQuery.Where(p => p.BranchId == effectiveBranchId);
                expQuery = expQuery.Where(e => e.BranchId == effectiveBranchId);
            }

            var todayPayments = await payQuery.ToListAsync();
            var todayExpenses = await expQuery.ToListAsync();

            var totalCol = todayPayments.Sum(p => p.AmountPaid);
            var totalExp = todayExpenses.Sum(e => e.Amount);
            var net = totalCol - totalExp;

            var hindiSpoken = $"Aaj ka total fee collection {totalCol:N0} rupaye hai. Kul {todayPayments.Count} payments prapt hui hain. Aaj ka expense {totalExp:N0} rupaye hai.";
            var engSpoken = $"Today's total fee collection is ₹{totalCol:N0} across {todayPayments.Count} transactions. Total expenses today are ₹{totalExp:N0}.";

            var formatted = $"### 💰 Financial Snapshot Today (IST)\n\n" +
                            $"- **Total Fee Collected Today:** ₹{totalCol:N2} ({todayPayments.Count} payments)\n" +
                            $"- **Today's Expenses:** ₹{totalExp:N2} ({todayExpenses.Count} vouchers)\n" +
                            $"- **Net Cashflow Today:** ₹{net:N2}\n\n" +
                            $"Institution: *{instituteName}*";

            return Ok(new UniversalCopilotQueryResponseDto
            {
                Query = rawQuery,
                Intent = "Financials",
                SpokenResponseHindi = hindiSpoken,
                SpokenResponseEnglish = engSpoken,
                FormattedAnswer = formatted,
                HighlightMetric = $"₹{totalCol:N0}",
                HighlightLabel = "Today's Fee Collection",
                ActionLinks = new()
                {
                    new() { Label = "View Day Book", RouteUrl = "/finance/day-book", Icon = "auto_stories" },
                    new() { Label = "Fee Recovery Agent", RouteUrl = "/finance/fee-recovery-agent", Icon = "psychology" }
                }
            });
        }

        // ════════════════════════════════════════════════════════════
        // 3. ATTENDANCE INTENT
        // ════════════════════════════════════════════════════════════
        if (q.Contains("attendance") || q.Contains("haziri") || q.Contains("kitne bache") || q.Contains("kitne student aaye") || q.Contains("present") || q.Contains("absent"))
        {
            var todayIst = GetIstToday();

            var stuQuery = _db.Students.AsNoTracking().Where(s => s.TenantId == tenantId && s.IsActive && !s.IsDeleted);
            if (effectiveBranchId.HasValue && effectiveBranchId.Value != Guid.Empty)
            {
                stuQuery = stuQuery.Where(s => s.BranchId == effectiveBranchId);
            }

            var totalEnrolled = await stuQuery.CountAsync();

            var attQuery = _db.StudentAttendances.AsNoTracking()
                .Where(a => a.TenantId == tenantId && a.AttendanceDate == todayIst);

            if (effectiveBranchId.HasValue && effectiveBranchId.Value != Guid.Empty)
            {
                attQuery = attQuery.Where(a => a.BranchId == effectiveBranchId);
            }

            var todayAttendances = await attQuery.ToListAsync();
            var presentCount = todayAttendances.Count(a => a.Status == TeacherAttendanceStatus.Present);
            var absentCount = todayAttendances.Count(a => a.Status == TeacherAttendanceStatus.Absent);
            var lateCount = todayAttendances.Count(a => a.Status == TeacherAttendanceStatus.Late);
            var unmarkedCount = totalEnrolled - (presentCount + absentCount + lateCount);
            if (unmarkedCount < 0) unmarkedCount = 0;

            var pct = totalEnrolled > 0 ? Math.Round((decimal)presentCount / totalEnrolled * 100m, 1) : 0m;

            var hindiSpoken = $"Aaj kul {presentCount} vidyarthi present hain, jo kul chhatron ka {pct} pratishat hai. {absentCount} vidyarthi absent hain.";
            var engSpoken = $"Today, {presentCount} students are marked present, representing {pct}% attendance. {absentCount} students are absent.";

            var formatted = $"### 📋 Real-time Attendance Snapshot Today\n\n" +
                            $"- **Total Enrolled Roster:** {totalEnrolled} Students\n" +
                            $"- **Present Today:** {presentCount} ({pct}%)\n" +
                            $"- **Absent Today:** {absentCount}\n" +
                            $"- **Late Arrivals:** {lateCount}\n" +
                            $"- **Pending / Unmarked:** {unmarkedCount}\n";

            return Ok(new UniversalCopilotQueryResponseDto
            {
                Query = rawQuery,
                Intent = "Attendance",
                SpokenResponseHindi = hindiSpoken,
                SpokenResponseEnglish = engSpoken,
                FormattedAnswer = formatted,
                HighlightMetric = $"{presentCount} / {totalEnrolled}",
                HighlightLabel = "Present Today",
                ActionLinks = new()
                {
                    new() { Label = "Open AI Face Scanner", RouteUrl = "/attendance/ai-scanner", Icon = "camera_indoor" },
                    new() { Label = "Attendance Reports", RouteUrl = "/attendance/reports", Icon = "summarize" }
                }
            });
        }

        // ════════════════════════════════════════════════════════════
        // 4. STUDENT SPECIFIC DUES / LOOKUP INTENT
        // ════════════════════════════════════════════════════════════
        // Attempt to find a student name or roll number inside query
        var candidateStudent = await FindStudentFromQueryAsync(rawQuery, tenantId, effectiveBranchId);

        if (candidateStudent != null)
        {
            var s = candidateStudent;

            // Calculate pending dues
            var invoices = await _db.FeeInvoices.AsNoTracking()
                .Where(i => i.TenantId == tenantId && i.StudentId == s.Id && i.Status != InvoiceStatus.Cancelled)
                .ToListAsync();

            var totalInvoiced = invoices.Sum(i => i.TotalAmount);
            var totalPaid = invoices.Sum(i => i.PaidAmount);
            var totalDue = totalInvoiced - totalPaid;
            if (totalDue < 0) totalDue = 0;

            var className = s.Class?.Name ?? (s.IsCoachingStudent ? s.Batch?.Name : "General");
            var roll = !string.IsNullOrWhiteSpace(s.RollNumber) ? s.RollNumber : s.AdmissionNumber ?? "N/A";

            var hindiSpoken = $"{s.StudentName}, {className} ke vidyarthi hain. Inki total pending fees {totalDue:N0} rupaye hai. Roll number {roll} hai.";
            var engSpoken = $"{s.StudentName} is enrolled in {className}. Total outstanding fee dues: ₹{totalDue:N0}. Roll number: {roll}.";

            var formatted = $"### 👤 Student Profile & Dues Card\n\n" +
                            $"- **Student Name:** {s.StudentName}\n" +
                            $"- **Class & Section:** {className} {(s.Section != null ? "Sec " + s.Section.Name : "")}\n" +
                            $"- **Roll Number:** {roll}\n" +
                            $"- **Father / Parent:** {s.ParentName}\n" +
                            $"- **WhatsApp Contact:** {s.ParentWhatsAppPhone}\n" +
                            $"- **Total Outstanding Dues:** **₹{totalDue:N2}**\n";

            var links = new List<UniversalCopilotActionLinkDto>
            {
                new() { Label = "Open Fee Ledger", RouteUrl = $"/fees?studentId={s.Id}", Icon = "payments" },
                new() { Label = "Student Retention & Counseling", RouteUrl = "/students/retention", Icon = "shield" }
            };

            if (!string.IsNullOrWhiteSpace(s.ParentWhatsAppPhone))
            {
                var cleanPhone = Regex.Replace(s.ParentWhatsAppPhone, @"[^\d]", "");
                if (cleanPhone.Length == 10) cleanPhone = "91" + cleanPhone;
                links.Add(new() { Label = "WhatsApp Parent", RouteUrl = $"https://wa.me/{cleanPhone}", Icon = "chat", Phone = cleanPhone });
            }

            return Ok(new UniversalCopilotQueryResponseDto
            {
                Query = rawQuery,
                Intent = "Student",
                SpokenResponseHindi = hindiSpoken,
                SpokenResponseEnglish = engSpoken,
                FormattedAnswer = formatted,
                HighlightMetric = $"₹{totalDue:N0}",
                HighlightLabel = $"{s.StudentName} Dues",
                ActionLinks = links
            });
        }

        // ════════════════════════════════════════════════════════════
        // 5. GENERAL CAMPUS OVERVIEW FALLBACK
        // ════════════════════════════════════════════════════════════
        var studentCount = await _db.Students.AsNoTracking()
            .CountAsync(s => s.TenantId == tenantId && s.IsActive && !s.IsDeleted);

        var teacherCount = await _db.Teachers.AsNoTracking()
            .CountAsync(t => t.TenantId == tenantId && t.IsActive);

        var classCount = await _db.SchoolClasses.AsNoTracking()
            .CountAsync(c => c.TenantId == tenantId);

        var genHindi = $"{instituteName} mein kul {studentCount} active students enrolled hain, aur {teacherCount} teachers karyarat hain.";
        var genEng = $"{instituteName} currently has {studentCount} active enrolled students across {classCount} classes, supported by {teacherCount} teachers.";

        var genFormatted = $"### 🏫 {instituteName} Overview\n\n" +
                           $"- **Active Students:** {studentCount}\n" +
                           $"- **Faculty Members:** {teacherCount}\n" +
                           $"- **Academic Classes:** {classCount}\n\n" +
                           $"Ask about any student name (e.g., *'Aarav ki fees'*) or daily metric (e.g., *'today collection'*, *'today attendance'*).";

        return Ok(new UniversalCopilotQueryResponseDto
        {
            Query = rawQuery,
            Intent = "General",
            SpokenResponseHindi = genHindi,
            SpokenResponseEnglish = genEng,
            FormattedAnswer = genFormatted,
            HighlightMetric = $"{studentCount} Students",
            HighlightLabel = "Active Enrollment",
            ActionLinks = new()
            {
                new() { Label = "Principal Morning Briefing", RouteUrl = "/dashboard/briefing", Icon = "record_voice_over" },
                new() { Label = "AI Face Attendance Scanner", RouteUrl = "/attendance/ai-scanner", Icon = "camera_indoor" },
                new() { Label = "Fee Recovery Agent", RouteUrl = "/finance/fee-recovery-agent", Icon = "psychology" }
            }
        });
    }

    private async Task<Student?> FindStudentFromQueryAsync(string query, Guid tenantId, Guid? branchId)
    {
        var clean = query.ToLower()
            .Replace("ki fees", "")
            .Replace("ka fees", "")
            .Replace("fees kitni hai", "")
            .Replace("kitni baki hai", "")
            .Replace("due kitna hai", "")
            .Replace("pending fees", "")
            .Replace("dues", "")
            .Replace("fee", "")
            .Replace("student", "")
            .Replace("roll number", "")
            .Replace("roll", "")
            .Trim();

        var words = clean.Split(new[] { ' ', ',', '.', '?' }, StringSplitOptions.RemoveEmptyEntries);

        foreach (var w in words)
        {
            if (w.Length < 3) continue;

            var found = await _db.Students
                .Include(s => s.Class)
                .Include(s => s.Section)
                .Include(s => s.Batch)
                .FirstOrDefaultAsync(s => s.TenantId == tenantId &&
                                          s.IsActive && !s.IsDeleted &&
                                          (s.StudentName.ToLower().Contains(w) ||
                                           s.RollNumber.ToLower() == w ||
                                           (s.AdmissionNumber != null && s.AdmissionNumber.ToLower() == w)));

            if (found != null) return found;
        }

        return null;
    }
}
