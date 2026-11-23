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
[Route("api/student-retention")]
public class StudentRetentionController : ControllerBase
{
    private readonly IMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;
    private readonly IWhatsAppService _whatsAppService;
    private readonly ILogger<StudentRetentionController> _logger;

    public StudentRetentionController(
        IMSERPDbContext dbContext,
        ICurrentUserService currentUser,
        IWhatsAppService whatsAppService,
        ILogger<StudentRetentionController> logger)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _whatsAppService = whatsAppService;
        _logger = logger;
    }

    [HttpGet("analysis")]
    public async Task<ActionResult<object>> GetRetentionAnalysis(
        [FromQuery] Guid? branchId,
        [FromQuery] Guid? classId,
        [FromQuery] Guid? batchId,
        [FromQuery] string? academicScope = "all", // all, school, coaching
        [FromQuery] string? riskLevel = "all",     // all, critical, moderate, safe
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var tenantId = _currentUser.TenantId;
        var nowUtc = DateTime.UtcNow;
        var thirtyDaysAgo = nowUtc.AddDays(-30);
        var sixtyDaysAgo = nowUtc.AddDays(-60);

        // 1. Base Active Students Query with multi-tenant & branch isolation
        var studentsQuery = _dbContext.Students
            .AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .Include(s => s.Branch)
            .Where(s => s.TenantId == tenantId && s.IsActive);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            studentsQuery = studentsQuery.Where(s => s.BranchId == branchId.Value);
        }
        else if (_currentUser.BranchId.HasValue && _currentUser.BranchId.Value != Guid.Empty)
        {
            studentsQuery = studentsQuery.Where(s => s.BranchId == _currentUser.BranchId.Value);
        }

        if (classId.HasValue && classId.Value != Guid.Empty)
        {
            studentsQuery = studentsQuery.Where(s => s.ClassId == classId.Value);
        }

        if (batchId.HasValue && batchId.Value != Guid.Empty)
        {
            studentsQuery = studentsQuery.Where(s => s.BatchId == batchId.Value);
        }

        if (!string.IsNullOrWhiteSpace(academicScope))
        {
            var sc = academicScope.Trim().ToLowerInvariant();
            if (sc == "school")
                studentsQuery = studentsQuery.Where(s => s.IsSchoolStudent);
            else if (sc == "coaching")
                studentsQuery = studentsQuery.Where(s => s.IsCoachingStudent);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            studentsQuery = studentsQuery.Where(s =>
                s.StudentName.ToLower().Contains(q) ||
                s.RollNumber.ToLower().Contains(q) ||
                (s.AdmissionNumber != null && s.AdmissionNumber.ToLower().Contains(q)) ||
                (s.ParentWhatsAppPhone != null && s.ParentWhatsAppPhone.Contains(q)) ||
                (s.ParentName != null && s.ParentName.ToLower().Contains(q)));
        }

        var students = await studentsQuery.ToListAsync();
        if (students.Count == 0)
        {
            return Ok(new
            {
                items = Array.Empty<StudentDropoutRiskItemDto>(),
                totalCount = 0,
                page,
                pageSize,
                summary = new StudentDropoutRiskSummaryKpiDto(0, 0, 0, 0, 0, 0, 0)
            });
        }

        var studentIds = students.Select(s => s.Id).ToList();

        // 2. Batch-Fetch Attendance in last 30 days
        var attendances = await _dbContext.StudentAttendances
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId && studentIds.Contains(a.StudentId) && a.AttendanceDate >= thirtyDaysAgo)
            .OrderByDescending(a => a.AttendanceDate)
            .Select(a => new { a.StudentId, a.AttendanceDate, a.Status })
            .ToListAsync();

        var attendanceByStudent = attendances.GroupBy(a => a.StudentId).ToDictionary(g => g.Key, g => g.ToList());

        // 3. Batch-Fetch Unpaid Invoices
        var unpaidInvoices = await _dbContext.FeeInvoices
            .AsNoTracking()
            .Where(i => i.TenantId == tenantId &&
                        studentIds.Contains(i.StudentId) &&
                        i.Status != InvoiceStatus.Paid &&
                        i.Status != InvoiceStatus.Cancelled)
            .Select(i => new { i.StudentId, i.TotalAmount, i.PaidAmount, i.DueDate })
            .ToListAsync();

        var invoicesByStudent = unpaidInvoices.GroupBy(i => i.StudentId).ToDictionary(g => g.Key, g => g.ToList());

        // 4. Batch-Fetch Test Marks in last 60 days
        var testMarks = await _dbContext.TestMarks
            .AsNoTracking()
            .Include(m => m.Test)
            .Where(m => m.TenantId == tenantId &&
                        studentIds.Contains(m.StudentId) &&
                        m.Test != null &&
                        m.Test.TestDate >= sixtyDaysAgo &&
                        m.Test.MaxMarks > 0)
            .Select(m => new { m.StudentId, m.MarksObtained, MaxMarks = m.Test!.MaxMarks })
            .ToListAsync();

        var marksByStudent = testMarks.GroupBy(m => m.StudentId).ToDictionary(g => g.Key, g => g.ToList());

        // 5. Batch-Fetch Past Counseling Interventions
        var interventions = await _dbContext.StudentRetentionInterventions
            .AsNoTracking()
            .Where(i => i.TenantId == tenantId && studentIds.Contains(i.StudentId))
            .OrderByDescending(i => i.InterventionDate)
            .Select(i => new { i.StudentId, i.InterventionDate, i.OutcomeStatus })
            .ToListAsync();

        var interventionsByStudent = interventions.GroupBy(i => i.StudentId).ToDictionary(g => g.Key, g => g.ToList());

        // 6. Compute Risk Profiles for All Matching Students
        var analyzedItems = new List<StudentDropoutRiskItemDto>();

        foreach (var s in students)
        {
            // A. Attendance Signals
            decimal attPct = 100m;
            int consecutiveAbsents = 0;
            if (attendanceByStudent.TryGetValue(s.Id, out var attList) && attList.Count > 0)
            {
                int totalMarked = attList.Count;
                int presentCount = attList.Count(a => a.Status == TeacherAttendanceStatus.Present || a.Status == TeacherAttendanceStatus.Late);
                attPct = Math.Round((decimal)presentCount / totalMarked * 100m, 1);

                // Count consecutive absents from most recent
                foreach (var att in attList.OrderByDescending(x => x.AttendanceDate))
                {
                    if (att.Status == TeacherAttendanceStatus.Absent)
                        consecutiveAbsents++;
                    else
                        break;
                }
            }

            // B. Fee Overdue Signals
            decimal overdueAmt = 0m;
            int maxDaysOverdue = 0;
            if (invoicesByStudent.TryGetValue(s.Id, out var invList) && invList.Count > 0)
            {
                foreach (var inv in invList)
                {
                    decimal bal = Math.Max(0m, inv.TotalAmount - inv.PaidAmount);
                    overdueAmt += bal;
                    if (inv.DueDate < nowUtc)
                    {
                        int days = (nowUtc - inv.DueDate).Days;
                        if (days > maxDaysOverdue) maxDaysOverdue = days;
                    }
                }
            }

            // C. Academic Marks Signals
            decimal? avgMarksPct = null;
            if (marksByStudent.TryGetValue(s.Id, out var mList) && mList.Count > 0)
            {
                decimal totalObt = mList.Sum(x => x.MarksObtained);
                decimal totalMax = mList.Sum(x => x.MaxMarks);
                if (totalMax > 0)
                {
                    avgMarksPct = Math.Round((totalObt / totalMax) * 100m, 1);
                }
            }

            // D. Compute Multi-Dimensional Risk Score (0 - 100)
            int riskScore = 0;
            var riskFactors = new List<string>();

            // 1) Attendance Weight (up to 35 pts)
            if (attPct < 50m)
            {
                riskScore += 35;
                riskFactors.Add($"Severe Low Attendance ({attPct}%)");
            }
            else if (attPct < 65m)
            {
                riskScore += 25;
                riskFactors.Add($"Irregular Attendance ({attPct}%)");
            }
            else if (attPct < 75m)
            {
                riskScore += 15;
                riskFactors.Add($"Attendance Below Cutoff ({attPct}%)");
            }

            if (consecutiveAbsents >= 5)
            {
                riskScore = Math.Min(100, riskScore + 15);
                riskFactors.Add($"{consecutiveAbsents} Consecutive Days Absent");
            }
            else if (consecutiveAbsents >= 3)
            {
                riskScore = Math.Min(100, riskScore + 8);
            }

            // 2) Overdue Fee Weight (up to 35 pts)
            if (overdueAmt > 5000m || maxDaysOverdue > 60)
            {
                riskScore = Math.Min(100, riskScore + 35);
                riskFactors.Add($"Critical Overdue Fee (₹{overdueAmt:N0}, {maxDaysOverdue} days)");
            }
            else if (overdueAmt > 2000m || maxDaysOverdue > 30)
            {
                riskScore = Math.Min(100, riskScore + 25);
                riskFactors.Add($"Overdue Fee Pending (₹{overdueAmt:N0}, {maxDaysOverdue} days)");
            }
            else if (overdueAmt > 0m)
            {
                riskScore = Math.Min(100, riskScore + 10);
            }

            // 3) Academic Decline Weight (up to 20 pts)
            if (avgMarksPct.HasValue)
            {
                if (avgMarksPct.Value < 35m)
                {
                    riskScore = Math.Min(100, riskScore + 20);
                    riskFactors.Add($"Failing Academic Test Score ({avgMarksPct.Value}%)");
                }
                else if (avgMarksPct.Value < 50m)
                {
                    riskScore = Math.Min(100, riskScore + 10);
                    riskFactors.Add($"Weak Academic Performance ({avgMarksPct.Value}%)");
                }
            }

            // 4) Engagement Silence Weight (up to 10 pts)
            if (attList == null || attList.Count == 0)
            {
                riskScore = Math.Min(100, riskScore + 10);
                riskFactors.Add("No Attendance Logged in 30 Days");
            }

            // Determine Risk Tier
            string tier = "Safe";
            if (riskScore >= 70)
                tier = "Critical";
            else if (riskScore >= 40)
                tier = "Moderate";

            // Primary Factor string
            string primaryFactor = riskFactors.Count > 0 ? string.Join(" • ", riskFactors) : "Normal Regular Profile";

            // Recommended AI Action
            string recommendedAction;
            if (tier == "Critical")
            {
                recommendedAction = consecutiveAbsents >= 4
                    ? "Immediate Home Visit / Urgent Principal Call"
                    : (overdueAmt > 3000 ? "Emergency Parent Counseling & Fee Relief Discussion" : "Urgent Academic & Attendance Counseling");
            }
            else if (tier == "Moderate")
            {
                recommendedAction = overdueAmt > 0
                    ? "Deploy Warm WhatsApp Outreach & Check-in"
                    : "Class Teacher Attendance Follow-up";
            }
            else
            {
                recommendedAction = "Healthy Academic Progression — No Action Needed";
            }

            // Generated Outreach Messages (Empathetic, caring tone)
            string classNameDisplay = s.Class?.Name ?? s.Batch?.Name ?? "Classroom";
            string hindiOutreach = $"आदरणीय अभिभावक, प्रणाम। विद्यालय प्रशासन की ओर से हम आपके बच्चे {s.StudentName} (कक्षा: {classNameDisplay}) की पढ़ाई को लेकर निरंतर प्रयासरत हैं। हमने देखा कि पिछले कुछ दिनों से उनकी कक्षा उपस्थिति एवं नियमितता में कमी आई है। क्या कोई विशेष कठिनाई या समस्या है? कृपया कल प्रातः 10:00 बजे विद्यालय कार्यालय में पधारकर मार्गदर्शन प्राप्त करें।";
            string englishOutreach = $"Dear Parent, Greetings. We are reaching out regarding your ward {s.StudentName} (Class: {classNameDisplay}). We noticed a recent dip in attendance and consistency. If there is any difficulty or support required, please feel free to visit the school office tomorrow at 10:00 AM so we can assist together.";

            // Past interventions
            int prevCount = 0;
            DateTime? lastDate = null;
            string? lastOutcome = null;
            if (interventionsByStudent.TryGetValue(s.Id, out var pastInts) && pastInts.Count > 0)
            {
                prevCount = pastInts.Count;
                var latest = pastInts.First();
                lastDate = latest.InterventionDate;
                lastOutcome = latest.OutcomeStatus;
            }

            analyzedItems.Add(new StudentDropoutRiskItemDto(
                StudentId: s.Id,
                StudentName: s.StudentName,
                RollNumber: s.RollNumber,
                AdmissionNumber: s.AdmissionNumber,
                PhotoUrl: s.ProfilePhoto,
                ClassId: s.ClassId,
                ClassName: s.Class?.Name,
                SectionId: s.SectionId,
                SectionName: s.Section?.Name,
                BatchId: s.BatchId,
                BatchName: s.Batch?.Name,
                BranchId: s.BranchId,
                BranchName: s.Branch?.Name,
                ParentName: s.ParentName,
                ParentPhone: s.ParentWhatsAppPhone,
                IsSchoolStudent: s.IsSchoolStudent,
                IsCoachingStudent: s.IsCoachingStudent,
                RiskScore: riskScore,
                RiskLevel: tier,
                AttendancePercentage: attPct,
                ConsecutiveAbsentDays: consecutiveAbsents,
                OverdueFeeAmount: overdueAmt,
                OverdueFeeDays: maxDaysOverdue,
                LatestTestPercentage: avgMarksPct,
                PrimaryRiskFactor: primaryFactor,
                RecommendedAction: recommendedAction,
                GeneratedOutreachMessageHindi: hindiOutreach,
                GeneratedOutreachMessageEnglish: englishOutreach,
                PreviousInterventionsCount: prevCount,
                LastInterventionDate: lastDate,
                LastInterventionOutcome: lastOutcome
            ));
        }

        // 7. Calculate Global Summary KPIs for active selection
        int totalMonitored = analyzedItems.Count;
        int criticalCount = analyzedItems.Count(x => x.RiskLevel == "Critical");
        int moderateCount = analyzedItems.Count(x => x.RiskLevel == "Moderate");
        int safeCount = analyzedItems.Count(x => x.RiskLevel == "Safe");
        decimal potentialFeeRisk = analyzedItems.Where(x => x.RiskLevel == "Critical" || x.RiskLevel == "Moderate").Sum(x => x.OverdueFeeAmount);
        int totalInterventionsDone = analyzedItems.Sum(x => x.PreviousInterventionsCount);
        int retainedCount = analyzedItems.Count(x => x.LastInterventionOutcome == "Retained" || x.LastInterventionOutcome == "FinancialReliefGiven");

        var summaryKpi = new StudentDropoutRiskSummaryKpiDto(
            TotalStudentsMonitored: totalMonitored,
            CriticalRiskCount: criticalCount,
            ModerateRiskCount: moderateCount,
            SafeCount: safeCount,
            PotentialFeeAtRisk: potentialFeeRisk,
            InterventionsCompletedCount: totalInterventionsDone,
            StudentsRetainedCount: retainedCount
        );

        // 8. Filter by Risk Level if specified
        var filteredList = analyzedItems.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(riskLevel) && !riskLevel.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            filteredList = filteredList.Where(x => x.RiskLevel.Equals(riskLevel, StringComparison.OrdinalIgnoreCase));
        }

        // Sort: Critical first (highest risk score descending), then highest overdue fee
        filteredList = filteredList
            .OrderByDescending(x => x.RiskScore)
            .ThenByDescending(x => x.OverdueFeeAmount)
            .ThenBy(x => x.StudentName);

        var totalFiltered = filteredList.Count();
        var pagedItems = filteredList
            .Skip((Math.Max(1, page) - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return Ok(new
        {
            items = pagedItems,
            totalCount = totalFiltered,
            page,
            pageSize,
            summary = summaryKpi
        });
    }

    [HttpGet("summary")]
    public async Task<ActionResult<StudentDropoutRiskSummaryKpiDto>> GetRetentionSummary([FromQuery] Guid? branchId)
    {
        var tenantId = _currentUser.TenantId;
        var nowUtc = DateTime.UtcNow;
        var thirtyDaysAgo = nowUtc.AddDays(-30);

        var students = await _dbContext.Students
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.IsActive && (!branchId.HasValue || s.BranchId == branchId.Value))
            .Select(s => s.Id)
            .ToListAsync();

        if (students.Count == 0)
        {
            return Ok(new StudentDropoutRiskSummaryKpiDto(0, 0, 0, 0, 0, 0, 0));
        }

        var attendances = await _dbContext.StudentAttendances
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId && students.Contains(a.StudentId) && a.AttendanceDate >= thirtyDaysAgo)
            .Select(a => new { a.StudentId, a.Status })
            .ToListAsync();

        var attMap = attendances.GroupBy(a => a.StudentId).ToDictionary(
            g => g.Key,
            g => (decimal)g.Count(x => x.Status == TeacherAttendanceStatus.Present || x.Status == TeacherAttendanceStatus.Late) / g.Count() * 100m
        );

        var invoices = await _dbContext.FeeInvoices
            .AsNoTracking()
            .Where(i => i.TenantId == tenantId && students.Contains(i.StudentId) && i.Status != InvoiceStatus.Paid && i.Status != InvoiceStatus.Cancelled)
            .Select(i => new { i.StudentId, Due = i.TotalAmount - i.PaidAmount, i.DueDate })
            .ToListAsync();

        var feeMap = invoices.GroupBy(i => i.StudentId).ToDictionary(
            g => g.Key,
            g => new { TotalDue = g.Sum(x => x.Due), MaxDaysOverdue = g.Where(x => x.DueDate < nowUtc).Select(x => (nowUtc - x.DueDate).Days).DefaultIfEmpty(0).Max() }
        );

        int critical = 0, moderate = 0, safe = 0;
        decimal feeAtRisk = 0;

        foreach (var id in students)
        {
            decimal att = attMap.TryGetValue(id, out var aVal) ? aVal : 100m;
            decimal due = feeMap.TryGetValue(id, out var fVal) ? fVal.TotalDue : 0m;
            int days = fVal != null ? fVal.MaxDaysOverdue : 0;

            int score = 0;
            if (att < 50m) score += 35;
            else if (att < 70m) score += 20;

            if (due > 5000m || days > 60) score += 35;
            else if (due > 2000m || days > 30) score += 20;
            else if (due > 0m) score += 10;

            if (score >= 70)
            {
                critical++;
                feeAtRisk += due;
            }
            else if (score >= 40)
            {
                moderate++;
                feeAtRisk += due;
            }
            else
            {
                safe++;
            }
        }

        var interventionsCount = await _dbContext.StudentRetentionInterventions
            .CountAsync(i => i.TenantId == tenantId && (!branchId.HasValue || i.BranchId == branchId.Value));

        var retainedCount = await _dbContext.StudentRetentionInterventions
            .CountAsync(i => i.TenantId == tenantId && (!branchId.HasValue || i.BranchId == branchId.Value) &&
                             (i.OutcomeStatus == "Retained" || i.OutcomeStatus == "FinancialReliefGiven"));

        return Ok(new StudentDropoutRiskSummaryKpiDto(
            TotalStudentsMonitored: students.Count,
            CriticalRiskCount: critical,
            ModerateRiskCount: moderate,
            SafeCount: safe,
            PotentialFeeAtRisk: feeAtRisk,
            InterventionsCompletedCount: interventionsCount,
            StudentsRetainedCount: retainedCount
        ));
    }

    [HttpGet("{studentId}/interventions")]
    public async Task<ActionResult<List<StudentRetentionInterventionDto>>> GetInterventions(Guid studentId)
    {
        var tenantId = _currentUser.TenantId;

        var list = await _dbContext.StudentRetentionInterventions
            .AsNoTracking()
            .Include(i => i.Student)
            .Where(i => i.TenantId == tenantId && i.StudentId == studentId)
            .OrderByDescending(i => i.InterventionDate)
            .Select(i => new StudentRetentionInterventionDto(
                i.Id,
                i.StudentId,
                i.Student != null ? i.Student.StudentName : "Student",
                i.InterventionDate,
                i.InterventionType,
                i.CounselorName,
                i.ParentFeedback,
                i.ReasonForRisk,
                i.OutcomeStatus,
                i.NextFollowUpDate,
                i.ActionNotes,
                i.CreatedBy,
                i.CreatedAt
            ))
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost("intervention")]
    public async Task<ActionResult<StudentRetentionInterventionDto>> RecordIntervention([FromBody] RecordRetentionInterventionRequestDto dto)
    {
        var tenantId = _currentUser.TenantId;

        var student = await _dbContext.Students
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Id == dto.StudentId);

        if (student == null)
            return NotFound("Student not found.");

        var entity = new StudentRetentionIntervention
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = student.BranchId,
            StudentId = student.Id,
            InterventionDate = DateTime.UtcNow,
            InterventionType = string.IsNullOrWhiteSpace(dto.InterventionType) ? "ParentCounseling" : dto.InterventionType.Trim(),
            CounselorName = string.IsNullOrWhiteSpace(dto.CounselorName) ? (User?.Identity?.Name ?? _currentUser.Username ?? "Administrator") : dto.CounselorName.Trim(),
            ParentFeedback = dto.ParentFeedback?.Trim(),
            ReasonForRisk = string.IsNullOrWhiteSpace(dto.ReasonForRisk) ? "Other" : dto.ReasonForRisk.Trim(),
            OutcomeStatus = string.IsNullOrWhiteSpace(dto.OutcomeStatus) ? "UnderMonitoring" : dto.OutcomeStatus.Trim(),
            NextFollowUpDate = dto.NextFollowUpDate,
            ActionNotes = dto.ActionNotes?.Trim(),
            CreatedBy = User?.Identity?.Name ?? _currentUser.Username ?? "Admin",
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.StudentRetentionInterventions.Add(entity);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("[Retention] Recorded intervention {Id} for student {StudentId} by {User}", entity.Id, student.Id, entity.CreatedBy);

        return Ok(new StudentRetentionInterventionDto(
            entity.Id,
            entity.StudentId,
            student.StudentName,
            entity.InterventionDate,
            entity.InterventionType,
            entity.CounselorName,
            entity.ParentFeedback,
            entity.ReasonForRisk,
            entity.OutcomeStatus,
            entity.NextFollowUpDate,
            entity.ActionNotes,
            entity.CreatedBy,
            entity.CreatedAt
        ));
    }

    [HttpPost("whatsapp-outreach")]
    public async Task<ActionResult> SendWhatsAppOutreach([FromBody] RetentionWhatsAppOutreachRequestDto dto)
    {
        var tenantId = _currentUser.TenantId;

        var student = await _dbContext.Students
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Id == dto.StudentId);

        if (student == null)
            return NotFound("Student not found.");

        if (string.IsNullOrWhiteSpace(dto.RecipientPhone))
            return BadRequest("Recipient phone number is required.");

        bool sent = false;
        try
        {
            // Use WhatsApp Cloud API if configured
            var testRes = await _whatsAppService.TestWhatsAppGatewayAsync(tenantId, dto.RecipientPhone, dto.MessageText);
            sent = testRes?.Success == true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Retention] WhatsApp Cloud dispatch failed, fallback to client URL");
        }

        // Log intervention record automatically
        var log = new StudentRetentionIntervention
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = student.BranchId,
            StudentId = student.Id,
            InterventionDate = DateTime.UtcNow,
            InterventionType = "WhatsAppOutreach",
            CounselorName = User?.Identity?.Name ?? _currentUser.Username ?? "AI Retention Agent",
            ParentFeedback = "Empathetic WhatsApp outreach dispatched to parent.",
            ReasonForRisk = "Irregularity / Absence / Fees",
            OutcomeStatus = "UnderMonitoring",
            ActionNotes = $"Message sent to {dto.RecipientPhone}: {dto.MessageText}",
            CreatedBy = User?.Identity?.Name ?? _currentUser.Username ?? "AI Agent",
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.StudentRetentionInterventions.Add(log);
        await _dbContext.SaveChangesAsync();

        return Ok(new { success = true, cloudDispatched = sent, interventionId = log.Id });
    }
}
