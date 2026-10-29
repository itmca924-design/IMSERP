using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace IMSERP.Infrastructure.Services;

public class FeeRecoveryAgentService : IFeeRecoveryAgentService
{
    private readonly IIMSERPDbContext _db;
    private readonly IWhatsAppService _whatsAppService;
    private readonly ILogger<FeeRecoveryAgentService> _logger;

    public FeeRecoveryAgentService(
        IIMSERPDbContext db,
        IWhatsAppService whatsAppService,
        ILogger<FeeRecoveryAgentService> logger)
    {
        _db = db;
        _whatsAppService = whatsAppService;
        _logger = logger;
    }

    private static TimeZoneInfo GetIstTimeZone()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("India Standard Time"); }
        catch { return TimeZoneInfo.CreateCustomTimeZone("IST", TimeSpan.FromMinutes(330), "IST", "IST"); }
    }

    public async Task<FeeRecoverySummaryKpiDto> GetSummaryKpisAsync(Guid tenantId, Guid? branchId, string? academicScope = "All")
    {
        var ist = GetIstTimeZone();
        var today = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ist).Date;

        var plansQuery = _db.FeeRecoveryPlans
            .Include(p => p.Student)
            .Include(p => p.Invoice)
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
            plansQuery = plansQuery.Where(p => p.BranchId == branchId.Value);

        if (!string.IsNullOrWhiteSpace(academicScope) && !academicScope.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            if (academicScope.Equals("School", StringComparison.OrdinalIgnoreCase))
                plansQuery = plansQuery.Where(p => p.Student != null && p.Student.IsSchoolStudent);
            else if (academicScope.Equals("Coaching", StringComparison.OrdinalIgnoreCase))
                plansQuery = plansQuery.Where(p => p.Student != null && p.Student.IsCoachingStudent);
        }

        var plans = await plansQuery.ToListAsync();

        var promisesQuery = _db.FeePromisesToPay
            .Include(p => p.Student)
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
            promisesQuery = promisesQuery.Where(p => p.BranchId == branchId.Value);

        if (!string.IsNullOrWhiteSpace(academicScope) && !academicScope.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            if (academicScope.Equals("School", StringComparison.OrdinalIgnoreCase))
                promisesQuery = promisesQuery.Where(p => p.Student != null && p.Student.IsSchoolStudent);
            else if (academicScope.Equals("Coaching", StringComparison.OrdinalIgnoreCase))
                promisesQuery = promisesQuery.Where(p => p.Student != null && p.Student.IsCoachingStudent);
        }

        var promises = await promisesQuery.ToListAsync();

        // Calculate recovered amount from invoices that had dispatched/resolved plans
        var planInvoiceIds = plans
            .Where(p => p.InvoiceId.HasValue && (p.Status == RecoveryPlanStatus.Dispatched || p.Status == RecoveryPlanStatus.PromiseMade || p.Status == RecoveryPlanStatus.PromiseKept || p.Status == RecoveryPlanStatus.Resolved))
            .Select(p => p.InvoiceId!.Value)
            .Distinct()
            .ToList();

        decimal totalRecovered = 0;
        int recoveredCount = 0;
        if (planInvoiceIds.Count > 0)
        {
            var paidPayments = await _db.FeePayments
                .AsNoTracking()
                .Where(p => p.TenantId == tenantId && planInvoiceIds.Contains(p.InvoiceId))
                .ToListAsync();

            totalRecovered = paidPayments.Sum(p => p.AmountPaid);
            recoveredCount = paidPayments.Select(p => p.InvoiceId).Distinct().Count();
        }

        var activePromises = promises.Where(p => !p.IsKept && !p.IsBroken && p.PromisedDate.Date >= today).ToList();

        var lastPlanRun = plans.OrderByDescending(p => p.UpdatedAt).FirstOrDefault()?.UpdatedAt;

        var activePlans = plans.Where(p => p.Status != RecoveryPlanStatus.Resolved && (p.Invoice == null || (p.Invoice.Status != InvoiceStatus.Paid && p.Invoice.TotalAmount > p.Invoice.PaidAmount))).ToList();

        return new FeeRecoverySummaryKpiDto(
            TotalOverdueAmount: activePlans.Sum(p => p.Invoice != null ? Math.Max(0, p.Invoice.TotalAmount - p.Invoice.PaidAmount) : p.TotalOverdueAmount),
            TotalDefaultersCount: activePlans.Count,
            CriticalCount: activePlans.Count(p => p.RiskLevel == RecoveryRiskLevel.Critical),
            HighRiskCount: activePlans.Count(p => p.RiskLevel == RecoveryRiskLevel.High),
            ModerateCount: activePlans.Count(p => p.RiskLevel == RecoveryRiskLevel.Moderate),
            LowRiskCount: activePlans.Count(p => p.RiskLevel == RecoveryRiskLevel.Low),
            ActivePromisesCount: activePromises.Count,
            ActivePromisesAmount: activePromises.Sum(p => p.PromisedAmount),
            RecoveredCount: recoveredCount,
            TotalRecoveredAmount: totalRecovered,
            LastAnalysisRunAt: lastPlanRun
        );
    }

    public async Task<List<FeeRecoveryPlanItemDto>> GetPlansAsync(
        Guid tenantId,
        Guid? branchId,
        Guid? classId,
        Guid? batchId,
        string? riskLevel,
        string? status,
        string? academicScope = "All")
    {
        var query = _db.FeeRecoveryPlans
            .Include(p => p.Student)
            .Include(p => p.Invoice)
            .Include(p => p.PromisesToPay)
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
            query = query.Where(p => p.BranchId == branchId.Value);

        if (!string.IsNullOrWhiteSpace(academicScope) && !academicScope.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            if (academicScope.Equals("School", StringComparison.OrdinalIgnoreCase))
                query = query.Where(p => p.Student != null && p.Student.IsSchoolStudent);
            else if (academicScope.Equals("Coaching", StringComparison.OrdinalIgnoreCase))
                query = query.Where(p => p.Student != null && p.Student.IsCoachingStudent);
        }

        if (classId.HasValue && classId.Value != Guid.Empty)
            query = query.Where(p => p.Student != null && p.Student.ClassId == classId.Value);

        if (batchId.HasValue && batchId.Value != Guid.Empty)
            query = query.Where(p => p.Student != null && p.Student.BatchId == batchId.Value);

        if (!string.IsNullOrWhiteSpace(riskLevel) && Enum.TryParse<RecoveryRiskLevel>(riskLevel, true, out var rLevel))
            query = query.Where(p => p.RiskLevel == rLevel);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<RecoveryPlanStatus>(status, true, out var rStatus))
            query = query.Where(p => p.Status == rStatus);

        var list = await query
            .OrderByDescending(p => p.RiskLevel)
            .ThenByDescending(p => p.TotalOverdueAmount)
            .ToListAsync();

        return list.Select(MapPlanToDto).ToList();
    }

    public async Task<List<FeeRecoveryPlanItemDto>> RunAnalysisAsync(
        Guid tenantId,
        Guid? branchId,
        RunFeeRecoveryAnalysisRequestDto request)
    {
        var ist = GetIstTimeZone();
        var today = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ist).Date;

        var tenant = await _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId);
        string instituteName = tenant?.Name ?? "School & Coaching ERP";
        string defaultUpiId = !string.IsNullOrWhiteSpace(tenant?.UpiId) ? tenant.UpiId.Trim() : "imserp.fees@sbi";
        string defaultPayeeName = !string.IsNullOrWhiteSpace(tenant?.UpiMerchantName) ? tenant.UpiMerchantName.Trim() : instituteName;

        // Query all unpaid or partially paid invoices
        var invQuery = _db.FeeInvoices
            .Include(i => i.Student)
                .ThenInclude(s => s.Branch)
            .Include(i => i.Branch)
            .Where(i => i.TenantId == tenantId && i.Status != InvoiceStatus.Paid && i.Status != InvoiceStatus.Cancelled);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
            invQuery = invQuery.Where(i => i.BranchId == branchId.Value);

        if (!string.IsNullOrWhiteSpace(request.AcademicScope) && !request.AcademicScope.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            if (request.AcademicScope.Equals("School", StringComparison.OrdinalIgnoreCase))
                invQuery = invQuery.Where(i => i.Student != null && i.Student.IsSchoolStudent);
            else if (request.AcademicScope.Equals("Coaching", StringComparison.OrdinalIgnoreCase))
                invQuery = invQuery.Where(i => i.Student != null && i.Student.IsCoachingStudent);
        }

        if (request.ClassId.HasValue && request.ClassId.Value != Guid.Empty)
            invQuery = invQuery.Where(i => i.ClassId == request.ClassId.Value);

        if (request.BatchId.HasValue && request.BatchId.Value != Guid.Empty)
            invQuery = invQuery.Where(i => i.Student != null && i.Student.BatchId == request.BatchId.Value);

        var invoices = await invQuery.ToListAsync();

        var existingPlans = await _db.FeeRecoveryPlans
            .Where(p => p.TenantId == tenantId)
            .ToListAsync();

        var activePromises = await _db.FeePromisesToPay
            .Where(p => p.TenantId == tenantId && !p.IsKept && !p.IsBroken)
            .ToListAsync();

        var createdOrUpdatedPlans = new List<FeeRecoveryPlan>();

        // Check promise compliance
        foreach (var promise in activePromises)
        {
            if (promise.PromisedDate.Date < today)
            {
                // Check if invoice or student made a payment since promised date
                var hasPaid = await _db.FeePayments
                    .Include(pay => pay.Invoice)
                    .AnyAsync(pay =>
                        pay.TenantId == tenantId &&
                        pay.Invoice != null &&
                        pay.Invoice.StudentId == promise.StudentId &&
                        pay.PaymentDate.Date >= promise.CreatedAt.Date);

                if (hasPaid)
                {
                    promise.IsKept = true;
                    promise.SettledAt = DateTime.UtcNow;
                }
                else
                {
                    promise.IsBroken = true;
                }
            }
        }

        foreach (var inv in invoices)
        {
            var student = inv.Student;
            if (student == null) continue;

            decimal dueAmount = inv.TotalAmount - inv.PaidAmount;
            if (dueAmount <= 0) continue;

            int daysOverdue = Math.Max(0, (today - inv.DueDate.Date).Days);
            if (daysOverdue < request.MinDaysOverdue && daysOverdue > 0)
                continue;

            // AI Risk Categorization
            RecoveryRiskLevel riskLevel;
            string tone;
            RecoveryActionChannel channel;
            string rationale;

            if (daysOverdue > 45 || dueAmount > 25000)
            {
                riskLevel = RecoveryRiskLevel.Critical;
                tone = "Administrative Demand";
                channel = RecoveryActionChannel.InPersonPTM;
                rationale = $"Severely overdue by {daysOverdue} days with significant balance (₹{dueAmount:N0}). High non-settlement risk. Requires administrative meeting / guardian conference.";
            }
            else if (daysOverdue > 20 || dueAmount > 10000)
            {
                riskLevel = RecoveryRiskLevel.High;
                tone = "Urgent Formal";
                channel = RecoveryActionChannel.WhatsApp;
                rationale = $"Overdue by {daysOverdue} days. Noticeable delay. Persistent follow-up and voice check required.";
            }
            else if (daysOverdue > 7)
            {
                riskLevel = RecoveryRiskLevel.Moderate;
                tone = "Standard Reminder";
                channel = RecoveryActionChannel.WhatsApp;
                rationale = $"Overdue by {daysOverdue} days. Standard monthly reminder with direct UPI pay link.";
            }
            else
            {
                riskLevel = RecoveryRiskLevel.Low;
                tone = "Gentle Courtesy";
                channel = RecoveryActionChannel.WhatsApp;
                rationale = $"Recent fee bill ({daysOverdue} days). Friendly courtesy nudge before late fee imposition.";
            }

            // Generate tailored dynamic message with direct UPI Payment Link
            string rollOrAdm = student.AdmissionNumber ?? student.RollNumber ?? "N/A";
            string studentClass = inv.ClassName ?? student.Batch?.Name ?? "General";
            string parentGreeting = !string.IsNullOrWhiteSpace(student.ParentName) ? $"Dear {student.ParentName}" : "Respected Parent / Guardian";

            string payeeUpiId = !string.IsNullOrWhiteSpace(inv.Branch?.UpiId)
                ? inv.Branch.UpiId.Trim()
                : (!string.IsNullOrWhiteSpace(student.Branch?.UpiId) ? student.Branch.UpiId.Trim() : defaultUpiId);

            string payeeName = !string.IsNullOrWhiteSpace(inv.Branch?.UpiMerchantName)
                ? inv.Branch.UpiMerchantName.Trim()
                : (!string.IsNullOrWhiteSpace(student.Branch?.UpiMerchantName) ? student.Branch.UpiMerchantName.Trim() : defaultPayeeName);

            string formattedAmount = dueAmount.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture);
            string encodedPayee = Uri.EscapeDataString(payeeName);
            string transactionNote = Uri.EscapeDataString($"Fee {inv.InvoiceNumber} {student.StudentName}");
            string upiIntentUri = $"upi://pay?pa={payeeUpiId}&pn={encodedPayee}&am={formattedAmount}&cu=INR&tn={transactionNote}&tr={inv.InvoiceNumber}";

            string upiPaymentBlock =
                $"💳 *Instant UPI Online Payment:*\n" +
                $"• Payee UPI ID: `{payeeUpiId}`\n" +
                $"• Payee Name: *{payeeName}*\n" +
                $"• Payable Amount: *₹{dueAmount:N0}*\n" +
                $"• 1-Tap Pay Link (GPay / PhonePe / Paytm):\n" +
                $"{upiIntentUri}\n\n";

            string messageBody = riskLevel switch
            {
                RecoveryRiskLevel.Critical =>
                    $"🚨 *FINAL FEE DEMAND NOTICE* - {instituteName}\n\n" +
                    $"{parentGreeting},\n" +
                    $"This is a critical reminder regarding the outstanding educational fee for your ward *{student.StudentName}* (Adm/Roll: {rollOrAdm}, Class: {studentClass}).\n\n" +
                    $"• Total Overdue Balance: *₹{dueAmount:N0}*\n" +
                    $"• Pending Since: *{inv.DueDate:dd-MMM-yyyy}* ({daysOverdue} days overdue)\n" +
                    $"• Invoice Reference: *#{inv.InvoiceNumber}*\n\n" +
                    upiPaymentBlock +
                    $"Kindly clear the fee immediately via the UPI link above or visit the Accounts Office. Thank you.\n\n" +
                    $"— Accounts Department, {instituteName}",

                RecoveryRiskLevel.High =>
                    $"⚠️ *URGENT FEE PAYMENT REMINDER* - {instituteName}\n\n" +
                    $"{parentGreeting},\n" +
                    $"Please note that tuition fees for *{student.StudentName}* (Roll: {rollOrAdm}) remain unpaid past the due date.\n\n" +
                    $"• Outstanding Amount: *₹{dueAmount:N0}*\n" +
                    $"• Due Date: *{inv.DueDate:dd-MMM-yyyy}*\n" +
                    $"• Invoice: *#{inv.InvoiceNumber}*\n\n" +
                    upiPaymentBlock +
                    $"Please settle the balance at your earliest convenience or reply to schedule a Promise-to-Pay. Thank you.\n\n" +
                    $"— {instituteName}",

                RecoveryRiskLevel.Moderate =>
                    $"🔔 *FEE PAYMENT NOTICE* - {instituteName}\n\n" +
                    $"{parentGreeting},\n" +
                    $"This is a friendly reminder that fee bill of *₹{dueAmount:N0}* for *{student.StudentName}* ({studentClass}) was due on *{inv.DueDate:dd-MMM-yyyy}*.\n\n" +
                    upiPaymentBlock +
                    $"Kindly remit the payment via the UPI link above or at the school counter to avoid late fee charges.\n\n" +
                    $"— {instituteName}",

                _ =>
                    $"🌸 *FEE INVOICE COURTESY NUDGE* - {instituteName}\n\n" +
                    $"{parentGreeting},\n" +
                    $"Tuition fee invoice *#{inv.InvoiceNumber}* for *{student.StudentName}* (₹{dueAmount:N0}) has been generated with due date *{inv.DueDate:dd-MMM-yyyy}*.\n\n" +
                    upiPaymentBlock +
                    $"Thank you for your continued support.\n\n" +
                    $"— {instituteName}"
            };

            var plan = existingPlans.FirstOrDefault(p => p.StudentId == student.Id && p.InvoiceId == inv.Id);
            if (plan == null)
            {
                plan = new FeeRecoveryPlan
                {
                    TenantId = tenantId,
                    BranchId = inv.BranchId ?? branchId,
                    StudentId = student.Id,
                    InvoiceId = inv.Id,
                    TotalOverdueAmount = dueAmount,
                    DaysOverdue = daysOverdue,
                    RiskLevel = riskLevel,
                    Status = RecoveryPlanStatus.Proposed,
                    RecommendedChannel = channel,
                    RecommendedTone = tone,
                    GeneratedMessage = messageBody,
                    AiRationale = rationale,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _db.FeeRecoveryPlans.Add(plan);
            }
            else
            {
                plan.TotalOverdueAmount = dueAmount;
                plan.DaysOverdue = daysOverdue;
                plan.RiskLevel = riskLevel;
                plan.RecommendedTone = tone;
                plan.RecommendedChannel = channel;
                plan.AiRationale = rationale;
                plan.GeneratedMessage = messageBody;
                plan.UpdatedAt = DateTime.UtcNow;

                if (plan.Status == RecoveryPlanStatus.Resolved)
                    plan.Status = RecoveryPlanStatus.Proposed;
            }

            createdOrUpdatedPlans.Add(plan);
        }

        await _db.SaveChangesAsync();
        _logger.LogInformation("[FeeRecoveryAgent] Analyzed {Count} defaulters for tenant {TenantId}", createdOrUpdatedPlans.Count, tenantId);

        return await GetPlansAsync(tenantId, branchId, request.ClassId, request.BatchId, null, null, request.AcademicScope);
    }

    public async Task<bool> DispatchNudgeAsync(Guid tenantId, Guid? branchId, DispatchRecoveryNudgeRequestDto request)
    {
        var plan = await _db.FeeRecoveryPlans
            .Include(p => p.Student)
            .Include(p => p.Invoice)
            .FirstOrDefaultAsync(p => p.Id == request.PlanId && p.TenantId == tenantId);

        if (plan == null || plan.Student == null)
            return false;

        string phone = !string.IsNullOrWhiteSpace(plan.Student.ParentWhatsAppPhone)
            ? plan.Student.ParentWhatsAppPhone
            : plan.Student.EmergencyContactPhone ?? "";
        if (string.IsNullOrWhiteSpace(phone))
        {
            _logger.LogWarning("[FeeRecoveryAgent] Student {StudentId} has no parent phone number", plan.StudentId);
            return false;
        }

        string message = !string.IsNullOrWhiteSpace(request.CustomMessage)
            ? request.CustomMessage
            : plan.GeneratedMessage;

        // Dispatch via WhatsAppService
        var dispatched = await _whatsAppService.SendDailyDiaryAlertAsync(
            tenantId,
            phone,
            plan.Student.StudentName,
            plan.Student.RollNumber ?? plan.Student.AdmissionNumber ?? "STU",
            DateTime.UtcNow.ToString("dd-MMM-yyyy"),
            message
        );

        plan.Status = RecoveryPlanStatus.Dispatched;
        plan.FollowUpCount++;
        plan.LastFollowUpAt = DateTime.UtcNow;
        plan.NextFollowUpScheduledAt = DateTime.UtcNow.AddDays(plan.RiskLevel == RecoveryRiskLevel.Critical ? 2 : 4);
        plan.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<int> BatchDispatchNudgesAsync(Guid tenantId, Guid? branchId, BatchDispatchNudgesRequestDto request)
    {
        int successCount = 0;
        foreach (var planId in request.PlanIds)
        {
            try
            {
                var ok = await DispatchNudgeAsync(tenantId, branchId, new DispatchRecoveryNudgeRequestDto(planId, null, null));
                if (ok) successCount++;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[FeeRecoveryAgent] Failed to dispatch nudge for plan {PlanId}", planId);
            }
        }
        return successCount;
    }

    public async Task<FeePromiseItemDto> RecordPromiseAsync(
        Guid tenantId,
        Guid? branchId,
        RecordPromiseToPayDto request,
        string recordedByName)
    {
        var student = await _db.Students
            .Include(s => s.Class)
            .Include(s => s.Batch)
            .FirstOrDefaultAsync(s => s.Id == request.StudentId && s.TenantId == tenantId);

        if (student == null)
            throw new InvalidOperationException("Student not found.");

        var promise = new FeePromiseToPay
        {
            TenantId = tenantId,
            BranchId = branchId ?? student.BranchId,
            StudentId = request.StudentId,
            RecoveryPlanId = request.RecoveryPlanId,
            InvoiceId = request.InvoiceId,
            PromisedAmount = request.PromisedAmount,
            PromisedDate = request.PromisedDate,
            ContactPerson = request.ContactPerson,
            ContactPhone = request.ContactPhone,
            Notes = request.Notes,
            RecordedByName = recordedByName,
            CreatedAt = DateTime.UtcNow
        };

        _db.FeePromisesToPay.Add(promise);

        if (request.RecoveryPlanId.HasValue)
        {
            var plan = await _db.FeeRecoveryPlans.FirstOrDefaultAsync(p => p.Id == request.RecoveryPlanId.Value && p.TenantId == tenantId);
            if (plan != null)
            {
                plan.Status = RecoveryPlanStatus.PromiseMade;
                plan.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _db.SaveChangesAsync();

        return new FeePromiseItemDto(
            Id: promise.Id,
            StudentId: promise.StudentId,
            StudentName: student.StudentName,
            RollNumber: student.RollNumber ?? student.AdmissionNumber,
            ClassName: student.Class?.Name,
            BatchName: student.Batch?.Name,
            PromisedAmount: promise.PromisedAmount,
            PromisedDate: promise.PromisedDate,
            ContactPerson: promise.ContactPerson,
            ContactPhone: promise.ContactPhone,
            Notes: promise.Notes,
            IsKept: promise.IsKept,
            IsBroken: promise.IsBroken,
            SettledAt: promise.SettledAt,
            SettledAmount: promise.SettledAmount,
            RecordedByName: promise.RecordedByName,
            CreatedAt: promise.CreatedAt
        );
    }

    public async Task<List<FeePromiseItemDto>> GetPromisesAsync(Guid tenantId, Guid? branchId, bool? pendingOnly, string? academicScope = "All")
    {
        var query = _db.FeePromisesToPay
            .Include(p => p.Student)
                .ThenInclude(s => s!.Class)
            .Include(p => p.Student)
                .ThenInclude(s => s!.Batch)
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
            query = query.Where(p => p.BranchId == branchId.Value);

        if (!string.IsNullOrWhiteSpace(academicScope) && !academicScope.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            if (academicScope.Equals("School", StringComparison.OrdinalIgnoreCase))
                query = query.Where(p => p.Student != null && p.Student.IsSchoolStudent);
            else if (academicScope.Equals("Coaching", StringComparison.OrdinalIgnoreCase))
                query = query.Where(p => p.Student != null && p.Student.IsCoachingStudent);
        }

        if (pendingOnly == true)
            query = query.Where(p => !p.IsKept && !p.IsBroken);

        var list = await query.OrderByDescending(p => p.PromisedDate).ToListAsync();

        return list.Select(p => {
            bool isSchool = p.Student?.IsSchoolStudent ?? false;
            bool isCoaching = p.Student?.IsCoachingStudent ?? false;
            string divisionTag = (isSchool && isCoaching) ? "Hybrid" : (isSchool ? "School" : (isCoaching ? "Coaching" : "General"));

            return new FeePromiseItemDto(
                Id: p.Id,
                StudentId: p.StudentId,
                StudentName: p.Student?.StudentName ?? "Student",
                RollNumber: p.Student?.RollNumber ?? p.Student?.AdmissionNumber,
                ClassName: p.Student?.Class?.Name,
                BatchName: p.Student?.Batch?.Name,
                PromisedAmount: p.PromisedAmount,
                PromisedDate: p.PromisedDate,
                ContactPerson: p.ContactPerson,
                ContactPhone: p.ContactPhone,
                Notes: p.Notes,
                IsKept: p.IsKept,
                IsBroken: p.IsBroken,
                SettledAt: p.SettledAt,
                SettledAmount: p.SettledAmount,
                RecordedByName: p.RecordedByName,
                CreatedAt: p.CreatedAt,
                IsSchoolStudent: isSchool,
                IsCoachingStudent: isCoaching,
                DivisionTag: divisionTag
            );
        }).ToList();
    }

    public async Task<bool> UpdatePromiseStatusAsync(Guid tenantId, Guid promiseId, UpdatePromiseStatusDto request)
    {
        var promise = await _db.FeePromisesToPay.FirstOrDefaultAsync(p => p.Id == promiseId && p.TenantId == tenantId);
        if (promise == null) return false;

        promise.IsKept = request.IsKept;
        promise.IsBroken = request.IsBroken;
        if (request.SettledAmount.HasValue)
        {
            promise.SettledAmount = request.SettledAmount.Value;
            promise.SettledAt = DateTime.UtcNow;
        }
        if (!string.IsNullOrWhiteSpace(request.Notes))
        {
            promise.Notes = (promise.Notes + "\n" + request.Notes).Trim();
        }

        if (promise.RecoveryPlanId.HasValue)
        {
            var plan = await _db.FeeRecoveryPlans.FirstOrDefaultAsync(p => p.Id == promise.RecoveryPlanId.Value && p.TenantId == tenantId);
            if (plan != null)
            {
                if (request.IsKept)
                    plan.Status = RecoveryPlanStatus.PromiseKept;
                else if (request.IsBroken)
                    plan.Status = RecoveryPlanStatus.PromiseBroken;

                plan.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _db.SaveChangesAsync();
        return true;
    }

    private static FeeRecoveryPlanItemDto MapPlanToDto(FeeRecoveryPlan p)
    {
        var activePromise = p.PromisesToPay.OrderByDescending(x => x.CreatedAt).FirstOrDefault(x => !x.IsKept && !x.IsBroken);
        bool isSchool = p.Student?.IsSchoolStudent ?? false;
        bool isCoaching = p.Student?.IsCoachingStudent ?? false;
        string divisionTag = (isSchool && isCoaching) ? "Hybrid" : (isSchool ? "School" : (isCoaching ? "Coaching" : "General"));

        decimal liveDue = p.Invoice != null ? Math.Max(0, p.Invoice.TotalAmount - p.Invoice.PaidAmount) : p.TotalOverdueAmount;
        bool isInvoicePaid = p.Status == RecoveryPlanStatus.Resolved || (p.Invoice != null && (p.Invoice.Status == InvoiceStatus.Paid || liveDue <= 0));
        string effectiveStatus = isInvoicePaid ? RecoveryPlanStatus.Resolved.ToString() : p.Status.ToString();
        decimal effectiveDue = isInvoicePaid ? 0 : liveDue;

        return new FeeRecoveryPlanItemDto(
            Id: p.Id,
            StudentId: p.StudentId,
            StudentName: p.Student?.StudentName ?? "Student",
            AdmissionNumber: p.Student?.AdmissionNumber,
            RollNumber: p.Student?.RollNumber ?? p.Student?.SchoolRollNumber,
            ClassName: p.Invoice?.ClassName ?? p.Student?.Class?.Name,
            SectionName: p.Invoice?.SectionName ?? p.Student?.Section?.Name,
            BatchName: p.Student?.Batch?.Name,
            ParentName: p.Student?.ParentName,
            ParentPhone: !string.IsNullOrWhiteSpace(p.Student?.ParentWhatsAppPhone) ? p.Student?.ParentWhatsAppPhone : p.Student?.EmergencyContactPhone,
            ProfilePhoto: p.Student?.ProfilePhoto,
            InvoiceId: p.InvoiceId,
            InvoiceNumber: p.Invoice?.InvoiceNumber,
            TotalOverdueAmount: effectiveDue,
            DaysOverdue: isInvoicePaid ? 0 : p.DaysOverdue,
            RiskLevel: p.RiskLevel.ToString(),
            Status: effectiveStatus,
            RecommendedChannel: p.RecommendedChannel.ToString(),
            RecommendedTone: p.RecommendedTone,
            GeneratedMessage: p.GeneratedMessage,
            AiRationale: p.AiRationale,
            FollowUpCount: p.FollowUpCount,
            LastFollowUpAt: p.LastFollowUpAt,
            NextFollowUpScheduledAt: p.NextFollowUpScheduledAt,
            ActivePromiseDate: activePromise?.PromisedDate,
            ActivePromiseAmount: activePromise?.PromisedAmount,
            ActivePromiseContact: activePromise?.ContactPerson,
            CreatedAt: p.CreatedAt,
            IsSchoolStudent: isSchool,
            IsCoachingStudent: isCoaching,
            DivisionTag: divisionTag
        );
    }
}
