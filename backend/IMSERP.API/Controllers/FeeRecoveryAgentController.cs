using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/finance/fee-recovery-agent")]
[Authorize]
public class FeeRecoveryAgentController : ControllerBase
{
    private readonly IFeeRecoveryAgentService _agentService;
    private readonly IAiVoiceService _voiceService;
    private readonly IWhatsAppService _whatsAppService;
    private readonly IAutomationService _automationService;
    private readonly IIMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;

    public FeeRecoveryAgentController(
        IFeeRecoveryAgentService agentService,
        IAiVoiceService voiceService,
        IWhatsAppService whatsAppService,
        IAutomationService automationService,
        IIMSERPDbContext dbContext,
        ICurrentUserService currentUser)
    {
        _agentService = agentService;
        _voiceService = voiceService;
        _whatsAppService = whatsAppService;
        _automationService = automationService;
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    [HttpGet("automation-status")]
    public async Task<ActionResult<FeeDueAutomationStatusDto>> GetAutomationStatus()
    {
        var settings = await _dbContext.AutomationSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);

        return Ok(new FeeDueAutomationStatusDto(
            FeeDueRemindersEnabled: settings?.FeeDueRemindersEnabled ?? true,
            FeeDueVoiceNoteEnabled: settings?.FeeDueVoiceNoteEnabled ?? true,
            FeeDueVoiceGender: settings?.FeeDueVoiceGender ?? "Female",
            FeeDueReminderDayOfMonth: settings?.FeeDueReminderDayOfMonth ?? 10,
            FeeDueDaysPrior: settings?.FeeDueDaysPrior ?? 7,
            HasMetaCloudApiConfigured: !string.IsNullOrWhiteSpace(settings?.WhatsAppCloudApiToken) && !string.IsNullOrWhiteSpace(settings?.WhatsAppPhoneNumberId),
            WhatsAppPhoneNumberId: settings?.WhatsAppPhoneNumberId,
            LastFeeReminderDate: settings?.LastFeeReminderDate
        ));
    }

    [HttpPut("automation-settings")]
    public async Task<ActionResult<FeeDueAutomationStatusDto>> UpdateAutomationSettings([FromBody] UpdateFeeDueAutomationSettingsDto dto)
    {
        var settings = await _dbContext.AutomationSettings
            .FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);

        if (settings == null)
        {
            settings = new Domain.Entities.AutomationSettings
            {
                TenantId = _currentUser.TenantId,
                UpdatedAt = DateTime.UtcNow
            };
            _dbContext.AutomationSettings.Add(settings);
        }

        settings.FeeDueRemindersEnabled = dto.FeeDueRemindersEnabled;
        settings.FeeDueVoiceNoteEnabled = dto.FeeDueVoiceNoteEnabled;
        settings.FeeDueVoiceGender = dto.FeeDueVoiceGender ?? "Female";
        settings.FeeDueReminderDayOfMonth = dto.FeeDueReminderDayOfMonth > 0 ? dto.FeeDueReminderDayOfMonth : 10;
        if (dto.FeeDueDaysPrior.HasValue) settings.FeeDueDaysPrior = dto.FeeDueDaysPrior.Value;
        if (dto.WhatsAppCloudApiToken != null) settings.WhatsAppCloudApiToken = dto.WhatsAppCloudApiToken;
        if (dto.WhatsAppPhoneNumberId != null) settings.WhatsAppPhoneNumberId = dto.WhatsAppPhoneNumberId;
        if (dto.WhatsAppBusinessAccountId != null) settings.WhatsAppBusinessAccountId = dto.WhatsAppBusinessAccountId;
        settings.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        return Ok(new FeeDueAutomationStatusDto(
            FeeDueRemindersEnabled: settings.FeeDueRemindersEnabled,
            FeeDueVoiceNoteEnabled: settings.FeeDueVoiceNoteEnabled,
            FeeDueVoiceGender: settings.FeeDueVoiceGender,
            FeeDueReminderDayOfMonth: settings.FeeDueReminderDayOfMonth,
            FeeDueDaysPrior: settings.FeeDueDaysPrior,
            HasMetaCloudApiConfigured: !string.IsNullOrWhiteSpace(settings.WhatsAppCloudApiToken) && !string.IsNullOrWhiteSpace(settings.WhatsAppPhoneNumberId),
            WhatsAppPhoneNumberId: settings.WhatsAppPhoneNumberId,
            LastFeeReminderDate: settings.LastFeeReminderDate
        ));
    }

    [HttpPost("send-test-whatsapp")]
    public async Task<ActionResult<object>> SendTestWhatsApp([FromBody] SendDuesTestWhatsAppRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.RecipientPhone))
            return BadRequest(new { message = "Recipient WhatsApp mobile number is required." });

        var tenant = await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == _currentUser.TenantId);
        var instName = tenant?.Name ?? "Jnandeep Campus";
        var amount = request.DueAmount > 0 ? request.DueAmount : 2500m;
        var sName = !string.IsNullOrWhiteSpace(request.StudentName) ? request.StudentName : "रोहित कुमार";
        var pName = !string.IsNullOrWhiteSpace(request.ParentName) ? request.ParentName : "राजेश कुमार";
        var cName = !string.IsNullOrWhiteSpace(request.ClassName) ? request.ClassName : "Class 10 (PCM)";
        var gender = !string.IsNullOrWhiteSpace(request.VoiceGender) ? request.VoiceGender : "Female";

        var ok = await _whatsAppService.SendFeeDueWithVoiceAsync(
            _currentUser.TenantId,
            request.RecipientPhone,
            sName,
            pName,
            cName,
            $"TEST-{DateTime.UtcNow:MMddHHmm}",
            amount,
            DateTime.UtcNow.Date.AddDays(3),
            null,
            true,
            gender
        );

        return Ok(new
        {
            success = ok,
            message = $"Test Dues Reminder with AI Hindi Voice ({gender}) successfully dispatched to {request.RecipientPhone}!"
        });
    }

    [HttpPost("trigger-automated-reminders")]
    public async Task<ActionResult<RunAutomationJobResultDto>> TriggerAutomatedReminders([FromQuery] int? daysPrior)
    {
        var result = await _automationService.ExecuteFeeDueRemindersAsync(_currentUser.TenantId, daysPrior);
        return Ok(result);
    }

    [HttpPost("preview-voice")]
    public async Task<ActionResult<PreviewDuesVoiceResultDto>> PreviewVoice([FromBody] PreviewDuesVoiceRequestDto request)
    {
        var dueDay = request.DueDay > 0 ? request.DueDay : 10;
        var month = !string.IsNullOrWhiteSpace(request.MonthName) ? request.MonthName : DateTime.UtcNow.ToString("MMMM yyyy");
        var instName = !string.IsNullOrWhiteSpace(request.InstituteName) ? request.InstituteName : "विद्यालय प्रशासन";

        var script = _voiceService.BuildHindiScript(
            request.ParentName ?? "",
            request.StudentName ?? "",
            request.ClassName ?? "",
            request.DueAmount,
            month,
            dueDay,
            instName
        );

        var audioBytes = await _voiceService.GenerateDuesReminderVoiceAsync(
            request.ParentName ?? "",
            request.StudentName ?? "",
            request.ClassName ?? "",
            request.DueAmount,
            month,
            dueDay,
            instName,
            request.VoiceGender ?? "Female"
        );

        var base64 = Convert.ToBase64String(audioBytes);
        return Ok(new PreviewDuesVoiceResultDto(
            HindiScript: script,
            AudioBase64: base64,
            ContentType: "audio/mpeg",
            ByteLength: audioBytes.Length
        ));
    }

    private record FeeVoiceTargetDetails(
        Guid TenantId,
        string InstName,
        string StudentName,
        string ParentName,
        string ClassName,
        decimal DueAmount,
        DateTime DueDate,
        string? ContactPhone
    );

    private async Task<decimal> GetStudentConsolidatedDueAsync(Guid studentId, decimal fallbackDue)
    {
        if (studentId == Guid.Empty) return fallbackDue;

        var totalDue = await _dbContext.FeeInvoices
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(i => i.StudentId == studentId &&
                        i.Status != Domain.Enums.InvoiceStatus.Paid &&
                        i.Status != Domain.Enums.InvoiceStatus.Cancelled &&
                        (i.TotalAmount - i.PaidAmount) > 0)
            .SumAsync(i => (decimal?)(i.TotalAmount - i.PaidAmount)) ?? 0m;

        return totalDue > 0 ? totalDue : fallbackDue;
    }

    private async Task<FeeVoiceTargetDetails?> ResolveVoiceTargetAsync(Guid targetId)
    {
        // 1. Check FeeRecoveryPlans by Id, InvoiceId, or StudentId
        var plan = await _dbContext.FeeRecoveryPlans
            .IgnoreQueryFilters()
            .Include(p => p.Student).ThenInclude(s => s!.Class)
            .Include(p => p.Invoice)
            .FirstOrDefaultAsync(p => p.Id == targetId || p.InvoiceId == targetId || p.StudentId == targetId);

        if (plan != null)
        {
            if (plan.Student == null)
            {
                plan.Student = await _dbContext.Students.IgnoreQueryFilters().Include(s => s.Class).FirstOrDefaultAsync(s => s.Id == plan.StudentId);
            }
            if (plan.Invoice == null && plan.InvoiceId.HasValue)
            {
                plan.Invoice = await _dbContext.FeeInvoices.IgnoreQueryFilters().FirstOrDefaultAsync(i => i.Id == plan.InvoiceId.Value);
            }

            var tenantObj = await _dbContext.Tenants.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(t => t.Id == plan.TenantId);
            var consolidatedDue = await GetStudentConsolidatedDueAsync(plan.StudentId, plan.TotalOverdueAmount);

            return new FeeVoiceTargetDetails(
                TenantId: plan.TenantId,
                InstName: tenantObj?.Name ?? "Jnandeep Campus",
                StudentName: plan.Student?.StudentName ?? "प्रिय छात्र",
                ParentName: !string.IsNullOrWhiteSpace(plan.Student?.ParentName) ? plan.Student.ParentName : "अभिभावक",
                ClassName: !string.IsNullOrWhiteSpace(plan.Invoice?.ClassName) ? plan.Invoice.ClassName : (plan.Student?.Class?.Name ?? "Class"),
                DueAmount: consolidatedDue,
                DueDate: plan.Invoice?.DueDate ?? DateTime.UtcNow.Date.AddDays(7),
                ContactPhone: tenantObj?.ContactPhone
            );
        }

        // 2. Fallback to FeeInvoices directly by Id
        var invoice = await _dbContext.FeeInvoices
            .IgnoreQueryFilters()
            .Include(i => i.Student).ThenInclude(s => s!.Class)
            .FirstOrDefaultAsync(i => i.Id == targetId);

        if (invoice != null)
        {
            var tenantObj = await _dbContext.Tenants.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(t => t.Id == invoice.TenantId);
            var consolidatedDue = await GetStudentConsolidatedDueAsync(invoice.StudentId, invoice.DueAmount);

            return new FeeVoiceTargetDetails(
                TenantId: invoice.TenantId,
                InstName: tenantObj?.Name ?? "Jnandeep Campus",
                StudentName: invoice.Student?.StudentName ?? "प्रिय छात्र",
                ParentName: !string.IsNullOrWhiteSpace(invoice.Student?.ParentName) ? invoice.Student.ParentName : "अभिभावक",
                ClassName: !string.IsNullOrWhiteSpace(invoice.ClassName) ? invoice.ClassName : (invoice.Student?.Class?.Name ?? "Class"),
                DueAmount: consolidatedDue,
                DueDate: invoice.DueDate,
                ContactPhone: tenantObj?.ContactPhone
            );
        }

        // 3. Fallback to Students directly by Id
        var student = await _dbContext.Students
            .IgnoreQueryFilters()
            .Include(s => s.Class)
            .FirstOrDefaultAsync(s => s.Id == targetId);

        if (student != null)
        {
            var tenantObj = await _dbContext.Tenants.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(t => t.Id == student.TenantId);

            var latestDueInvoice = await _dbContext.FeeInvoices
                .IgnoreQueryFilters()
                .Where(i => i.StudentId == student.Id && i.DueAmount > 0)
                .OrderByDescending(i => i.DueDate)
                .FirstOrDefaultAsync();

            var consolidatedDue = await GetStudentConsolidatedDueAsync(student.Id, latestDueInvoice?.DueAmount ?? 0m);

            return new FeeVoiceTargetDetails(
                TenantId: student.TenantId,
                InstName: tenantObj?.Name ?? "Jnandeep Campus",
                StudentName: student.StudentName ?? "प्रिय छात्र",
                ParentName: !string.IsNullOrWhiteSpace(student.ParentName) ? student.ParentName : "अभिभावक",
                ClassName: !string.IsNullOrWhiteSpace(latestDueInvoice?.ClassName) ? latestDueInvoice.ClassName : (student.Class?.Name ?? "Class"),
                DueAmount: consolidatedDue,
                DueDate: latestDueInvoice?.DueDate ?? DateTime.UtcNow.Date.AddDays(7),
                ContactPhone: tenantObj?.ContactPhone
            );
        }

        return null;
    }

    [AllowAnonymous]
    [HttpGet("student-voice/{planId}")]
    public async Task<IActionResult> GetStudentVoiceAudio(Guid planId, [FromQuery] string? gender = "Female")
    {
        var target = await ResolveVoiceTargetAsync(planId);
        if (target == null)
            return NotFound(new { message = "Recovery plan, invoice, or student not found." });

        var monthName = target.DueDate.ToString("MMMM yyyy");
        var voiceGender = string.Equals(gender, "Male", StringComparison.OrdinalIgnoreCase) ? "Male" : "Female";

        var audioBytes = await _voiceService.GenerateDuesReminderVoiceAsync(
            target.ParentName,
            target.StudentName,
            target.ClassName,
            target.DueAmount,
            monthName,
            target.DueDate.Day,
            target.InstName,
            voiceGender
        );

        return File(audioBytes, "audio/mpeg", $"{target.StudentName}_fee_reminder.mp3", enableRangeProcessing: true);
    }

    [AllowAnonymous]
    [HttpGet("listen/{planId}")]
    public async Task<IActionResult> ListenStudentVoice(
        Guid planId, 
        [FromQuery] string? gender = "Female", 
        [FromQuery] string? format = null)
    {
        // Publicly accessed from WhatsApp / external link: must bypass tenant query filters
        var target = await ResolveVoiceTargetAsync(planId);
        if (target == null)
            return NotFound("Fee reminder audio note not found.");

        var monthName = target.DueDate.ToString("MMMM yyyy");
        var voiceGender = string.Equals(gender, "Male", StringComparison.OrdinalIgnoreCase) ? "Male" : "Female";

        var isAudioStream = (format == "audio") ||
                            Request.Query.ContainsKey("audio") ||
                            Request.Query.ContainsKey("raw") ||
                            Request.Headers.Accept.ToString().StartsWith("audio/", StringComparison.OrdinalIgnoreCase);

        if (isAudioStream)
        {
            var audioBytes = await _voiceService.GenerateDuesReminderVoiceAsync(
                target.ParentName,
                target.StudentName,
                target.ClassName,
                target.DueAmount,
                monthName,
                target.DueDate.Day,
                target.InstName,
                voiceGender
            );

            return File(audioBytes, "audio/mpeg", $"{target.StudentName}_fee_reminder.mp3", enableRangeProcessing: true);
        }

        // Return a modern, mobile-friendly HTML audio player page
        var html = GetBrandedAudioPlayerHtml(target.InstName, target.StudentName, target.ParentName, target.ClassName, target.DueAmount, target.DueDate, planId, voiceGender, target.ContactPhone);
        return Content(html, "text/html; charset=utf-8");
    }

    private static string GetBrandedAudioPlayerHtml(
        string instName, 
        string studentName, 
        string parentName, 
        string className, 
        decimal dueAmount, 
        DateTime dueDate, 
        Guid planId, 
        string gender, 
        string? contactPhone)
    {
        var dueDay = dueDate.Day;
        var dueFormatted = dueDate.ToString("dd-MMM-yyyy");
        var femaleActive = gender == "Female" ? "active" : "";
        var maleActive = gender == "Male" ? "active" : "";
        var phoneHtml = !string.IsNullOrWhiteSpace(contactPhone)
            ? $"<a href=\"tel:{contactPhone}\" class=\"btn phone-btn\">📞 संस्थान से संपर्क करें ({contactPhone})</a>"
            : "";

        return $@"<!DOCTYPE html>
<html lang=""hi"">
<head>
  <meta charset=""UTF-8"">
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
  <title>फीस भुगतान अनुस्मारक | {instName}</title>
  <link rel=""preconnect"" href=""https://fonts.googleapis.com"">
  <link rel=""preconnect"" href=""https://fonts.gstatic.com"" crossorigin>
  <link href=""https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"" rel=""stylesheet"">
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px;
    }}
    .player-card {{
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
      max-width: 480px;
      width: 100%;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }}
    .card-header {{
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 24px;
      text-align: center;
      position: relative;
    }}
    .icon-badge {{
      width: 56px;
      height: 56px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 16px;
      box-shadow: 0 8px 16px -2px rgba(37, 99, 235, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      margin: 0 auto 12px;
    }}
    .inst-name {{
      color: #1e3a8a;
      font-weight: 700;
      font-size: 1.25rem;
      letter-spacing: -0.01em;
      margin-bottom: 4px;
    }}
    .sub-title {{
      color: #3b82f6;
      font-size: 0.875rem;
      font-weight: 500;
    }}
    .card-body {{
      padding: 24px;
    }}
    .details-grid {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }}
    .detail-item {{
      display: flex;
      flex-direction: column;
    }}
    .detail-label {{
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 2px;
    }}
    .detail-val {{
      font-size: 0.95rem;
      font-weight: 700;
      color: #0f172a;
    }}
    .due-amount {{
      color: #dc2626;
      font-size: 1.15rem;
    }}
    .audio-wrapper {{
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1px solid #bbf7d0;
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 20px;
      text-align: center;
    }}
    .audio-label {{
      font-size: 0.85rem;
      font-weight: 600;
      color: #166534;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }}
    audio {{
      width: 100%;
      height: 48px;
      border-radius: 30px;
      outline: none;
    }}
    .voice-toggles {{
      display: flex;
      gap: 8px;
      justify-content: center;
      margin-top: 12px;
    }}
    .voice-pill {{
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.78rem;
      font-weight: 600;
      text-decoration: none;
      color: #475569;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      transition: all 0.2s ease;
    }}
    .voice-pill.active {{
      background: #2563eb;
      color: #ffffff;
      border-color: #2563eb;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }}
    .actions-list {{
      display: flex;
      flex-direction: column;
      gap: 10px;
    }}
    .btn {{
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 18px;
      border-radius: 12px;
      font-size: 0.9rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
    }}
    .download-btn {{
      background: #1e293b;
      color: #ffffff;
    }}
    .download-btn:hover {{
      background: #0f172a;
    }}
    .phone-btn {{
      background: #f8fafc;
      color: #0284c7;
      border: 1px solid #bae6fd;
    }}
    .phone-btn:hover {{
      background: #f0f9ff;
    }}
    .card-footer {{
      padding: 16px 24px;
      background: #f8fafc;
      border-top: 1px solid #f1f5f9;
      text-align: center;
      font-size: 0.75rem;
      color: #94a3b8;
    }}
  </style>
</head>
<body>
  <div class=""player-card"">
    <div class=""card-header"">
      <div class=""icon-badge"">🎙️</div>
      <div class=""inst-name"">{instName}</div>
      <div class=""sub-title"">आधिकारिक फीस अनुस्मारक वॉयस नोट</div>
    </div>
    <div class=""card-body"">
      <div class=""details-grid"">
        <div class=""detail-item"">
          <span class=""detail-label"">छात्र का नाम</span>
          <span class=""detail-val"">{studentName}</span>
        </div>
        <div class=""detail-item"">
          <span class=""detail-label"">कक्षा / क्लास</span>
          <span class=""detail-val"">{className}</span>
        </div>
        <div class=""detail-item"">
          <span class=""detail-label"">बकाया फीस</span>
          <span class=""detail-val due-amount"">₹{dueAmount:N0}</span>
        </div>
        <div class=""detail-item"">
          <span class=""detail-label"">नियत देय तिथि</span>
          <span class=""detail-val"">{dueFormatted}</span>
        </div>
      </div>

      <div class=""audio-wrapper"">
        <div class=""audio-label"">
          <span>🔊</span> AI वॉयस संदेश सुनें
        </div>
        <audio controls autoplay preload=""auto"" src=""/api/finance/fee-recovery-agent/listen/{planId}?gender={gender}&format=audio"">
          Your browser does not support the audio element.
        </audio>
        <div class=""voice-toggles"">
          <a href=""/api/finance/fee-recovery-agent/listen/{planId}?gender=Female"" class=""voice-pill {femaleActive}"">♀️ Swara (महिला)</a>
          <a href=""/api/finance/fee-recovery-agent/listen/{planId}?gender=Male"" class=""voice-pill {maleActive}"">♂️ Madhur (पुरुष)</a>
        </div>
      </div>

      <div class=""actions-list"">
        <a href=""/api/finance/fee-recovery-agent/listen/{planId}?gender={gender}&format=audio"" download=""{studentName}_fee_reminder.mp3"" class=""btn download-btn"">
          📥 वॉयस नोट डाउनलोड करें (.mp3)
        </a>
        {phoneHtml}
      </div>
    </div>
    <div class=""card-footer"">
      © {DateTime.UtcNow.Year} {instName} • Autonomous AI Voice Reminder Engine
    </div>
  </div>
</body>
</html>";
    }

    [HttpGet("summary")]
    public async Task<ActionResult<FeeRecoverySummaryKpiDto>> GetSummary(
        [FromQuery] Guid? branchId,
        [FromQuery] string? academicScope = "All")
    {
        var targetBranch = branchId ?? _currentUser.BranchId;
        var summary = await _agentService.GetSummaryKpisAsync(_currentUser.TenantId, targetBranch, academicScope);
        return Ok(summary);
    }

    [HttpGet("plans")]
    public async Task<IActionResult> GetPlans(
        [FromQuery] Guid? branchId,
        [FromQuery] Guid? classId,
        [FromQuery] Guid? batchId,
        [FromQuery] string? riskLevel,
        [FromQuery] string? status,
        [FromQuery] string? academicScope = "All",
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = "overdue",
        [FromQuery] string? sortDirection = "desc",
        [FromQuery] int? pageNumber = null,
        [FromQuery] int? pageSize = null)
    {
        var targetBranch = branchId ?? _currentUser.BranchId;
        var pNum = pageNumber ?? 1;
        var pSize = pageSize ?? (pageNumber.HasValue ? 10 : 1000);
        var plans = await _agentService.GetPlansAsync(
            _currentUser.TenantId, targetBranch, classId, batchId, riskLevel, status,
            academicScope, search, sortBy, sortDirection, pNum, pSize);

        // Backward compatibility: If client did not send pageNumber (e.g. cached client expecting raw array), return Items directly
        if (!pageNumber.HasValue)
        {
            return Ok(plans.Items);
        }

        return Ok(plans);
    }

    [HttpPost("run-analysis")]
    public async Task<ActionResult<PagedResult<FeeRecoveryPlanItemDto>>> RunAnalysis([FromBody] RunFeeRecoveryAnalysisRequestDto request)
    {
        var targetBranch = request.BranchId ?? _currentUser.BranchId;
        var plans = await _agentService.RunAnalysisAsync(_currentUser.TenantId, targetBranch, request);
        return Ok(plans);
    }

    [HttpPost("dispatch-nudge")]
    public async Task<ActionResult<bool>> DispatchNudge([FromBody] DispatchRecoveryNudgeRequestDto request)
    {
        var ok = await _agentService.DispatchNudgeAsync(_currentUser.TenantId, _currentUser.BranchId, request);
        return Ok(ok);
    }

    [HttpPost("batch-dispatch-nudges")]
    public async Task<ActionResult<int>> BatchDispatchNudges([FromBody] BatchDispatchNudgesRequestDto request)
    {
        var count = await _agentService.BatchDispatchNudgesAsync(_currentUser.TenantId, _currentUser.BranchId, request);
        return Ok(count);
    }

    [HttpPost("record-promise")]
    public async Task<ActionResult<FeePromiseItemDto>> RecordPromise([FromBody] RecordPromiseToPayDto request)
    {
        string recorder = _currentUser.Username ?? _currentUser.UserRole ?? "Accounts Staff";
        var promise = await _agentService.RecordPromiseAsync(_currentUser.TenantId, _currentUser.BranchId, request, recorder);
        return Ok(promise);
    }

    [HttpGet("promises")]
    public async Task<ActionResult<List<FeePromiseItemDto>>> GetPromises(
        [FromQuery] Guid? branchId,
        [FromQuery] bool? pendingOnly,
        [FromQuery] string? academicScope = "All")
    {
        var targetBranch = branchId ?? _currentUser.BranchId;
        var promises = await _agentService.GetPromisesAsync(_currentUser.TenantId, targetBranch, pendingOnly, academicScope);
        return Ok(promises);
    }

    [HttpPut("promises/{id}")]
    public async Task<ActionResult<bool>> UpdatePromiseStatus(Guid id, [FromBody] UpdatePromiseStatusDto request)
    {
        var ok = await _agentService.UpdatePromiseStatusAsync(_currentUser.TenantId, id, request);
        return Ok(ok);
    }
}

