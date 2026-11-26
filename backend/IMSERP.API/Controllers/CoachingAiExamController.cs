using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using IMSERP.API.Services;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using IMSERP.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/coaching-ai-exam")]
[Authorize]
public class CoachingAiExamController : ControllerBase
{
    private readonly IMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IMenuPermissionService _menuPermissions;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<CoachingAiExamController> _logger;

    private const string CoachingTestsRoute = "/coaching/tests";

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public CoachingAiExamController(
        IMSERPDbContext db,
        ICurrentUserService currentUser,
        IMenuPermissionService menuPermissions,
        IConfiguration config,
        IHttpClientFactory httpClientFactory,
        ILogger<CoachingAiExamController> logger)
    {
        _db = db;
        _currentUser = currentUser;
        _menuPermissions = menuPermissions;
        _config = config;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    // ─── Dynamic Role-Based Permission Helper ─────────────────────────────
    private async Task<bool> HasCoachingTestPermissionAsync(MenuPermissionOperation op)
    {
        if (await _menuPermissions.HasPermissionAsync(CoachingTestsRoute, op))
            return true;
        if (await _menuPermissions.HasPermissionAsync("/tests", op))
            return true;
        return await _menuPermissions.HasPermissionAsync("/school/exams", op);
    }

    private async Task<(string? ApiKey, string ModelName, string Source)> ResolveGeminiConfigAsync()
    {
        var tenantCfg = await _db.TenantAiConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == _currentUser.TenantId && x.IsEnabled);

        if (tenantCfg != null && !string.IsNullOrWhiteSpace(tenantCfg.ApiKey))
        {
            return (tenantCfg.ApiKey.Trim(), string.IsNullOrWhiteSpace(tenantCfg.ModelName) ? "gemini-2.5-flash" : tenantCfg.ModelName.Trim(), "Tenant");
        }

        var serverKey = _config["Gemini:ApiKey"] ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");
        var serverModel = _config["Gemini:Model"] ?? "gemini-2.5-flash";
        if (!string.IsNullOrWhiteSpace(serverKey))
        {
            return (serverKey.Trim(), serverModel.Trim(), "Server");
        }

        return (null, tenantCfg?.ModelName ?? "gemini-2.5-flash", "None");
    }

    private static string MaskKey(string? key)
    {
        if (string.IsNullOrWhiteSpace(key)) return string.Empty;
        var k = key.Trim();
        if (k.Length <= 8) return "****";
        return $"{k[..6]}••••••{k[^4..]}";
    }

    // ─── 1. AI Configuration (Safe Masked GET & Admin PUT) ────────────────
    [HttpGet("ai-config")]
    public async Task<IActionResult> GetAiConfig()
    {
        if (!await HasCoachingTestPermissionAsync(MenuPermissionOperation.View))
            return Forbid();

        var (apiKey, modelName, source) = await ResolveGeminiConfigAsync();
        var canConfigure = await HasCoachingTestPermissionAsync(MenuPermissionOperation.Edit);

        return Ok(new
        {
            isConfigured = !string.IsNullOrWhiteSpace(apiKey),
            provider = "Gemini",
            modelName,
            maskedKey = MaskKey(apiKey),
            source,
            canConfigure
        });
    }

    [HttpPut("ai-config")]
    public async Task<IActionResult> SaveAiConfig([FromBody] SaveTenantAiConfigRequest dto)
    {
        if (!await HasCoachingTestPermissionAsync(MenuPermissionOperation.Edit))
            return Forbid();

        var existing = await _db.TenantAiConfigs
            .FirstOrDefaultAsync(x => x.TenantId == _currentUser.TenantId);

        if (existing == null)
        {
            if (string.IsNullOrWhiteSpace(dto.ApiKey))
                return BadRequest(new { message = "Please enter a valid Gemini API key." });

            existing = new TenantAiConfig
            {
                TenantId = _currentUser.TenantId,
                BranchId = _currentUser.BranchId,
                Provider = "Gemini",
                ModelName = string.IsNullOrWhiteSpace(dto.ModelName) ? "gemini-2.5-flash" : dto.ModelName.Trim(),
                ApiKey = dto.ApiKey.Trim(),
                IsEnabled = true,
                UpdatedBy = _currentUser.UserId.ToString(),
                UpdatedAt = DateTime.UtcNow
            };
            _db.TenantAiConfigs.Add(existing);
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(dto.ApiKey))
                existing.ApiKey = dto.ApiKey.Trim();
            if (!string.IsNullOrWhiteSpace(dto.ModelName))
                existing.ModelName = dto.ModelName.Trim();
            existing.IsEnabled = true;
            existing.UpdatedBy = _currentUser.UserId.ToString();
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return Ok(new
        {
            message = "Gemini AI configuration saved securely.",
            isConfigured = !string.IsNullOrWhiteSpace(existing.ApiKey),
            modelName = existing.ModelName,
            maskedKey = MaskKey(existing.ApiKey)
        });
    }

    // ─── 2. Paper Status Map for Coaching Tests Table ─────────────────────
    [HttpGet("papers/status-map")]
    public async Task<IActionResult> GetPaperStatusMap()
    {
        if (!await HasCoachingTestPermissionAsync(MenuPermissionOperation.View))
            return Forbid();

        var papers = await _db.CoachingQuestionPapers
            .AsNoTracking()
            .Where(p => p.TenantId == _currentUser.TenantId)
            .Select(p => new
            {
                p.Id,
                p.TestId,
                p.PaperStatus,
                p.TotalMarks,
                p.ChapterTitle,
                p.Language,
                p.QuestionsJson,
                p.UpdatedAt
            })
            .ToListAsync();

        var map = new Dictionary<string, object>();
        foreach (var p in papers)
        {
            int qCount = 0;
            try
            {
                var parsed = JsonSerializer.Deserialize<List<AiExamQuestionItem>>(p.QuestionsJson ?? "[]", JsonOpts);
                qCount = parsed?.Count ?? 0;
            }
            catch { }

            map[p.TestId.ToString()] = new
            {
                paperId = p.Id,
                paperStatus = p.PaperStatus,
                totalMarks = p.TotalMarks,
                chapterTitle = p.ChapterTitle,
                language = p.Language,
                questionCount = qCount,
                updatedAt = DateTime.SpecifyKind(p.UpdatedAt, DateTimeKind.Utc)
            };
        }

        return Ok(map);
    }

    // ─── 3. Get Question Paper for a Specific Coaching Test ───────────────
    [HttpGet("tests/{testId:guid}/paper")]
    public async Task<IActionResult> GetPaperForTest(Guid testId)
    {
        if (!await HasCoachingTestPermissionAsync(MenuPermissionOperation.View))
            return Forbid();

        var paper = await _db.CoachingQuestionPapers
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.TenantId == _currentUser.TenantId && p.TestId == testId);

        if (paper == null)
            return Ok(new { exists = false });

        return Ok(BuildPaperResponse(paper));
    }

    // ─── 4. Agentic AI Generate Question Paper (Text + PDF + Images) ──────
    [HttpPost("tests/{testId:guid}/generate")]
    public async Task<IActionResult> GenerateQuestionPaper(Guid testId, [FromBody] GenerateCoachingAiPaperRequest req)
    {
        if (!await HasCoachingTestPermissionAsync(MenuPermissionOperation.Create) &&
            !await HasCoachingTestPermissionAsync(MenuPermissionOperation.Edit))
            return Forbid();

        var test = await _db.Tests
            .Include(t => t.Batch)
            .Include(t => t.Class)
            .FirstOrDefaultAsync(t => t.Id == testId && t.TenantId == _currentUser.TenantId);

        if (test == null)
            return NotFound(new { message = "Coaching test not found." });

        var existingPaper = await _db.CoachingQuestionPapers
            .FirstOrDefaultAsync(p => p.TenantId == _currentUser.TenantId && p.TestId == testId);

        if (existingPaper != null && existingPaper.PaperStatus == "ApprovedAndLocked")
            return Conflict(new { message = "Question paper is already Approved & Locked. Unlock it first to regenerate." });

        bool hasText = !string.IsNullOrWhiteSpace(req.ChapterText);
        bool hasFiles = req.Attachments != null && req.Attachments.Count > 0;
        if (!hasText && !hasFiles)
            return BadRequest(new { message = "Please paste chapter content or upload a chapter PDF / book page image." });

        var (apiKey, modelName, _) = await ResolveGeminiConfigAsync();
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return UnprocessableEntity(new
            {
                requiresApiKey = true,
                message = "Gemini API Key is not configured yet. Please add your free Gemini API key in AI Settings to generate questions."
            });
        }

        // Compute exact blueprint totals
        int mcqCount = Math.Max(0, req.McqCount);
        decimal mcqMarks = req.McqMarks > 0 ? req.McqMarks : 1;
        int fillCount = Math.Max(0, req.FillBlankCount);
        decimal fillMarks = req.FillBlankMarks > 0 ? req.FillBlankMarks : 1;
        int shortCount = Math.Max(0, req.ShortCount);
        decimal shortMarks = req.ShortMarks > 0 ? req.ShortMarks : 2;
        int longCount = Math.Max(0, req.LongCount);
        decimal longMarks = req.LongMarks > 0 ? req.LongMarks : 5;

        int totalQ = mcqCount + fillCount + shortCount + longCount;
        if (totalQ == 0)
            return BadRequest(new { message = "Please specify at least 1 question in the paper blueprint." });

        decimal computedTotalMarks = (mcqCount * mcqMarks) + (fillCount * fillMarks) + (shortCount * shortMarks) + (longCount * longMarks);
        string subject = !string.IsNullOrWhiteSpace(req.Subject) ? req.Subject.Trim() : (test.Subject ?? "General");
        string chapterTitle = !string.IsNullOrWhiteSpace(req.ChapterTitle) ? req.ChapterTitle.Trim() : test.Title;
        string language = string.IsNullOrWhiteSpace(req.Language) ? "English" : req.Language.Trim();
        string classOrBatch = test.Class?.Name ?? test.Batch?.Name ?? "Coaching Batch";

        var prompt = BuildAgenticGenerationPrompt(
            classOrBatch, subject, chapterTitle, language,
            computedTotalMarks, req.DurationMinutes > 0 ? req.DurationMinutes : 60,
            mcqCount, mcqMarks, fillCount, fillMarks, shortCount, shortMarks, longCount, longMarks,
            req.EasyPercent, req.MediumPercent, req.HardPercent,
            req.ChapterText);

        var (aiPayload, usedModel, errorMsg) = await CallGeminiMultimodalAsync(apiKey, modelName, prompt, req.Attachments);
        if (aiPayload == null)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new
            {
                message = errorMsg ?? "AI service could not generate the question paper right now. Please try again."
            });
        }

        // Server-Side Critic / Verifier Pass
        var verifiedQuestions = RunCriticVerification(aiPayload.Questions);
        if (verifiedQuestions.Count == 0)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new
            {
                message = "AI returned an empty question list. Please provide clearer chapter content and retry."
            });
        }

        decimal verifiedTotalMarks = verifiedQuestions.Sum(q => q.Marks);
        var blueprintObj = new
        {
            mcqCount, mcqMarks,
            fillCount, fillMarks,
            shortCount, shortMarks,
            longCount, longMarks
        };
        var diffObj = new
        {
            easy = req.EasyPercent,
            medium = req.MediumPercent,
            hard = req.HardPercent
        };

        string sourceType = hasFiles
            ? (req.Attachments!.Any(a => (a.MimeType ?? "").Contains("pdf", StringComparison.OrdinalIgnoreCase)) ? "Pdf" : "Image")
            : "Text";

        if (existingPaper == null)
        {
            existingPaper = new CoachingQuestionPaper
            {
                TenantId = _currentUser.TenantId,
                BranchId = test.BranchId ?? _currentUser.BranchId,
                TestId = test.Id,
                ClassId = test.ClassId,
                BatchId = test.BatchId,
                CreatedBy = _currentUser.UserId.ToString(),
                CreatedAt = DateTime.UtcNow
            };
            _db.CoachingQuestionPapers.Add(existingPaper);
        }

        existingPaper.Subject = subject;
        existingPaper.ChapterTitle = chapterTitle;
        existingPaper.ChapterSourceType = sourceType;
        existingPaper.ChapterSourceText = !string.IsNullOrWhiteSpace(req.ChapterText)
            ? (req.ChapterText.Length > 25000 ? req.ChapterText[..25000] : req.ChapterText)
            : $"[Uploaded {req.Attachments?.Count ?? 0} file(s): {string.Join(", ", req.Attachments?.Select(a => a.FileName) ?? Array.Empty<string>())}]";
        existingPaper.Language = language;
        existingPaper.DurationMinutes = req.DurationMinutes > 0 ? req.DurationMinutes : 60;
        existingPaper.TotalMarks = verifiedTotalMarks;
        existingPaper.BlueprintJson = JsonSerializer.Serialize(blueprintObj, JsonOpts);
        existingPaper.DifficultyMixJson = JsonSerializer.Serialize(diffObj, JsonOpts);
        existingPaper.QuestionsJson = JsonSerializer.Serialize(verifiedQuestions, JsonOpts);
        existingPaper.AnswerKeyJson = JsonSerializer.Serialize(
            verifiedQuestions.Select(q => new { q.QNo, q.Section, q.Type, q.Marks, q.CorrectAnswer, q.MarkingScheme }),
            JsonOpts);
        existingPaper.GeneralInstructions = !string.IsNullOrWhiteSpace(aiPayload.GeneralInstructions)
            ? aiPayload.GeneralInstructions
            : "All questions are compulsory. Marks are indicated against each question. Write neat and clear answers.";
        existingPaper.PaperStatus = "Draft";
        existingPaper.RevisionRemarks = null;
        existingPaper.AiModelUsed = usedModel;
        existingPaper.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(BuildPaperResponse(existingPaper, aiPayload.VerificationSummary));
    }

    // ─── 5. Regenerate Single Question with AI ────────────────────────────
    [HttpPost("papers/{paperId:guid}/regenerate-question")]
    public async Task<IActionResult> RegenerateSingleQuestion(Guid paperId, [FromBody] RegenerateSingleQuestionRequest req)
    {
        if (!await HasCoachingTestPermissionAsync(MenuPermissionOperation.Edit) &&
            !await HasCoachingTestPermissionAsync(MenuPermissionOperation.Create))
            return Forbid();

        var paper = await _db.CoachingQuestionPapers
            .FirstOrDefaultAsync(p => p.Id == paperId && p.TenantId == _currentUser.TenantId);

        if (paper == null) return NotFound(new { message = "Question paper not found." });
        if (paper.PaperStatus == "ApprovedAndLocked")
            return Conflict(new { message = "Paper is Approved & Locked. Unlock before regenerating questions." });

        var (apiKey, modelName, _) = await ResolveGeminiConfigAsync();
        if (string.IsNullOrWhiteSpace(apiKey))
            return UnprocessableEntity(new { requiresApiKey = true, message = "Gemini API Key is not configured." });

        var questions = JsonSerializer.Deserialize<List<AiExamQuestionItem>>(paper.QuestionsJson ?? "[]", JsonOpts) ?? new();
        var target = questions.FirstOrDefault(q => q.QNo == req.QNo);
        if (target == null) return NotFound(new { message = $"Question #{req.QNo} not found." });

        var otherQuestions = string.Join("\n", questions.Where(q => q.QNo != req.QNo).Select(q => $"- {q.QuestionText}"));
        var prompt = $@"You are an expert Indian coaching exam paper setter.
Regenerate EXACTLY 1 fresh replacement question strictly grounded in the chapter below.
Do NOT repeat the previous question or any existing question in the paper.

Subject: {paper.Subject}
Chapter: {paper.ChapterTitle}
Language: {paper.Language}
Question Type: {target.Type}
Section: {target.Section}
Marks: {target.Marks}
Difficulty: {(!string.IsNullOrWhiteSpace(req.Difficulty) ? req.Difficulty : target.Difficulty)}
Teacher Custom Instruction: {req.CustomHint ?? "Generate a crisp, exam-worthy fresh question."}

Previous Question (DO NOT REPEAT):
{target.QuestionText}

Other Questions Already in Paper (DO NOT DUPLICATE):
{otherQuestions}

Chapter Source Content:
{paper.ChapterSourceText}

Return STRICT JSON ONLY (no markdown fences) matching this exact schema:
{{
  ""generalInstructions"": """",
  ""verificationSummary"": ""Regenerated 1 question"",
  ""questions"": [
    {{
      ""qNo"": {target.QNo},
      ""section"": ""{target.Section}"",
      ""type"": ""{target.Type}"",
      ""difficulty"": ""{(!string.IsNullOrWhiteSpace(req.Difficulty) ? req.Difficulty : target.Difficulty)}"",
      ""topic"": ""topic name"",
      ""marks"": {target.Marks},
      ""questionText"": ""..."",
      ""options"": [""A"", ""B"", ""C"", ""D""],
      ""correctAnswer"": ""..."",
      ""markingScheme"": ""Step-by-step rubric""
    }}
  ]
}}
Note: Only include 4 options for MCQ type; for non-MCQ types use empty array [].";

        var (aiPayload, _, errorMsg) = await CallGeminiMultimodalAsync(apiKey, modelName, prompt, null);
        var fresh = aiPayload?.Questions?.FirstOrDefault();
        if (fresh == null || string.IsNullOrWhiteSpace(fresh.QuestionText))
            return StatusCode(StatusCodes.Status502BadGateway, new { message = errorMsg ?? "Could not regenerate question." });

        target.QuestionText = fresh.QuestionText.Trim();
        target.Options = string.Equals(target.Type, "MCQ", StringComparison.OrdinalIgnoreCase)
            ? (fresh.Options?.Take(4).ToList() ?? target.Options)
            : new List<string>();
        target.CorrectAnswer = fresh.CorrectAnswer?.Trim() ?? string.Empty;
        target.MarkingScheme = fresh.MarkingScheme?.Trim() ?? string.Empty;
        target.Topic = !string.IsNullOrWhiteSpace(fresh.Topic) ? fresh.Topic.Trim() : target.Topic;
        target.Difficulty = !string.IsNullOrWhiteSpace(fresh.Difficulty) ? fresh.Difficulty.Trim() : target.Difficulty;

        paper.QuestionsJson = JsonSerializer.Serialize(questions, JsonOpts);
        paper.AnswerKeyJson = JsonSerializer.Serialize(
            questions.Select(q => new { q.QNo, q.Section, q.Type, q.Marks, q.CorrectAnswer, q.MarkingScheme }),
            JsonOpts);
        paper.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(BuildPaperResponse(paper, $"Question #{req.QNo} regenerated successfully."));
    }

    // ─── 6. Save Manual Edits to Question Paper ───────────────────────────
    [HttpPut("papers/{paperId:guid}")]
    public async Task<IActionResult> UpdateQuestionPaper(Guid paperId, [FromBody] UpdateCoachingAiPaperRequest req)
    {
        if (!await HasCoachingTestPermissionAsync(MenuPermissionOperation.Edit) &&
            !await HasCoachingTestPermissionAsync(MenuPermissionOperation.Create))
            return Forbid();

        var paper = await _db.CoachingQuestionPapers
            .FirstOrDefaultAsync(p => p.Id == paperId && p.TenantId == _currentUser.TenantId);

        if (paper == null) return NotFound(new { message = "Question paper not found." });
        if (paper.PaperStatus == "ApprovedAndLocked")
            return Conflict(new { message = "Approved & Locked paper cannot be edited. Unlock it first." });

        var verified = RunCriticVerification(req.Questions ?? new List<AiExamQuestionItem>());
        if (verified.Count == 0)
            return BadRequest(new { message = "Question paper must contain at least 1 question." });

        if (!string.IsNullOrWhiteSpace(req.ChapterTitle)) paper.ChapterTitle = req.ChapterTitle.Trim();
        if (!string.IsNullOrWhiteSpace(req.Language)) paper.Language = req.Language.Trim();
        if (req.DurationMinutes > 0) paper.DurationMinutes = req.DurationMinutes;
        if (req.GeneralInstructions != null) paper.GeneralInstructions = req.GeneralInstructions.Trim();

        paper.QuestionsJson = JsonSerializer.Serialize(verified, JsonOpts);
        paper.TotalMarks = verified.Sum(q => q.Marks);
        paper.AnswerKeyJson = JsonSerializer.Serialize(
            verified.Select(q => new { q.QNo, q.Section, q.Type, q.Marks, q.CorrectAnswer, q.MarkingScheme }),
            JsonOpts);
        paper.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(BuildPaperResponse(paper, "Question paper changes saved."));
    }

    // ─── 7. Maker-Checker Approval Workflow Endpoints ─────────────────────
    [HttpPut("papers/{paperId:guid}/submit-approval")]
    public async Task<IActionResult> SubmitForApproval(Guid paperId)
    {
        if (!await HasCoachingTestPermissionAsync(MenuPermissionOperation.Create) &&
            !await HasCoachingTestPermissionAsync(MenuPermissionOperation.Edit))
            return Forbid();

        var paper = await _db.CoachingQuestionPapers
            .FirstOrDefaultAsync(p => p.Id == paperId && p.TenantId == _currentUser.TenantId);
        if (paper == null) return NotFound(new { message = "Question paper not found." });
        if (paper.PaperStatus == "ApprovedAndLocked")
            return Conflict(new { message = "Paper is already Approved & Locked." });

        paper.PaperStatus = "SubmittedForApproval";
        paper.RevisionRemarks = null;
        paper.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(BuildPaperResponse(paper, "Question paper submitted for approval."));
    }

    [HttpPut("papers/{paperId:guid}/approve-lock")]
    public async Task<IActionResult> ApproveAndLock(Guid paperId)
    {
        if (!await HasCoachingTestPermissionAsync(MenuPermissionOperation.Edit))
            return Forbid();

        var paper = await _db.CoachingQuestionPapers
            .FirstOrDefaultAsync(p => p.Id == paperId && p.TenantId == _currentUser.TenantId);
        if (paper == null) return NotFound(new { message = "Question paper not found." });

        paper.PaperStatus = "ApprovedAndLocked";
        paper.ApprovedBy = _currentUser.UserId.ToString();
        paper.ApprovedAt = DateTime.UtcNow;
        paper.RevisionRemarks = null;
        paper.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(BuildPaperResponse(paper, "Question paper Approved & Locked for exam print."));
    }

    [HttpPut("papers/{paperId:guid}/request-revision")]
    public async Task<IActionResult> RequestRevision(Guid paperId, [FromBody] PaperRevisionRequest req)
    {
        if (!await HasCoachingTestPermissionAsync(MenuPermissionOperation.Edit))
            return Forbid();

        var paper = await _db.CoachingQuestionPapers
            .FirstOrDefaultAsync(p => p.Id == paperId && p.TenantId == _currentUser.TenantId);
        if (paper == null) return NotFound(new { message = "Question paper not found." });

        paper.PaperStatus = "RevisionRequested";
        paper.RevisionRemarks = string.IsNullOrWhiteSpace(req.Remarks) ? "Please review and update questions." : req.Remarks.Trim();
        paper.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(BuildPaperResponse(paper, "Revision requested from paper creator."));
    }

    [HttpPut("papers/{paperId:guid}/unlock")]
    public async Task<IActionResult> UnlockPaper(Guid paperId)
    {
        if (!await HasCoachingTestPermissionAsync(MenuPermissionOperation.Edit))
            return Forbid();

        var paper = await _db.CoachingQuestionPapers
            .FirstOrDefaultAsync(p => p.Id == paperId && p.TenantId == _currentUser.TenantId);
        if (paper == null) return NotFound(new { message = "Question paper not found." });

        paper.PaperStatus = "Draft";
        paper.ApprovedAt = null;
        paper.ApprovedBy = null;
        paper.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(BuildPaperResponse(paper, "Question paper unlocked to Draft status."));
    }

    // ─── 8. Phase 2: Exam Hall / Room & Auto Seating Plan Endpoints ───────
    [HttpGet("tests/{testId:guid}/seating")]
    public async Task<IActionResult> GetTestSeating(Guid testId)
    {
        if (!await HasCoachingTestPermissionAsync(MenuPermissionOperation.View))
            return Forbid();

        var test = await _db.Tests
            .AsNoTracking()
            .Include(t => t.Batch)
            .Include(t => t.Class)
            .Include(t => t.Section)
            .FirstOrDefaultAsync(t => t.Id == testId && t.TenantId == _currentUser.TenantId);
        if (test == null) return NotFound(new { message = "Exam / Test not found." });

        bool isSchoolTest = (!test.BatchId.HasValue || test.BatchId.Value == Guid.Empty) && test.ClassId.HasValue;

        var rooms = await _db.Rooms
            .AsNoTracking()
            .Where(r => r.TenantId == _currentUser.TenantId && r.IsActive)
            .OrderBy(r => r.RoomNumber)
            .Select(r => new { r.Id, r.RoomNumber, r.Capacity, r.Floor, r.BranchId })
            .ToListAsync();

        var rawTeachers = await _db.Teachers
            .AsNoTracking()
            .Where(t => t.TenantId == _currentUser.TenantId && t.IsActive && t.EmploymentType != "Deleted" && t.StaffType == StaffType.Teaching)
            .OrderBy(t => t.FullName)
            .Select(t => new { t.Id, t.FullName, t.EmployeeCode, t.StaffType, t.Department, t.Designation })
            .ToListAsync();

        var nonTeachingTokens = new[] { "account", "clerk", "peon", "driver", "conductor", "guard", "cashier", "reception", "librarian", "sweeper", "security", "gatekeeper", "warden", "supervisor", "hr manager" };
        var teachers = rawTeachers
            .Where(t =>
            {
                var blob = $"{t.FullName} {t.Department} {t.Designation}".ToLowerInvariant();
                return !nonTeachingTokens.Any(tok => blob.Contains(tok)) &&
                       !(t.EmployeeCode ?? string.Empty).StartsWith("ACC", StringComparison.OrdinalIgnoreCase);
            })
            .Select(t => new { t.Id, t.FullName, t.EmployeeCode, staffType = t.StaffType.ToString() })
            .ToList();

        var halls = await _db.CoachingExamHallAllocations
            .AsNoTracking()
            .Where(h => h.TenantId == _currentUser.TenantId && h.TestId == testId)
            .OrderBy(h => h.SortOrder)
            .ToListAsync();

        var seats = await _db.CoachingExamSeatAllocations
            .AsNoTracking()
            .Include(s => s.Student)
            .Where(s => s.TenantId == _currentUser.TenantId && s.TestId == testId)
            .OrderBy(s => s.RoomName)
            .ThenBy(s => s.BenchNumber)
            .ThenBy(s => s.SeatNumber)
            .Select(s => new
            {
                s.Id,
                s.HallAllocationId,
                s.RoomId,
                s.RoomName,
                s.StudentId,
                studentName = s.Student != null ? s.Student.StudentName : "",
                rollNumber = s.Student != null
                    ? (isSchoolTest
                        ? (!string.IsNullOrWhiteSpace(s.Student.SchoolRollNumber) ? s.Student.SchoolRollNumber : (!string.IsNullOrWhiteSpace(s.Student.AdmissionNumber) ? s.Student.AdmissionNumber : s.Student.RollNumber))
                        : (!string.IsNullOrWhiteSpace(s.Student.CoachingRollNumber) ? s.Student.CoachingRollNumber : s.Student.RollNumber))
                    : "",
                parentPhone = s.Student != null ? s.Student.ParentWhatsAppPhone : "",
                s.SeatNumber,
                s.BenchNumber,
                s.AttendanceStatus
            })
            .ToListAsync();

        int enrolledCount = 0;
        if (test.BatchId.HasValue && test.BatchId.Value != Guid.Empty)
        {
            enrolledCount = await _db.Students.AsNoTracking()
                .CountAsync(s => s.TenantId == _currentUser.TenantId && s.BatchId == test.BatchId && s.IsActive);
        }
        else if (test.ClassId.HasValue && test.ClassId.Value != Guid.Empty)
        {
            var sq = _db.Students.AsNoTracking()
                .Where(s => s.TenantId == _currentUser.TenantId && s.ClassId == test.ClassId && s.IsActive && s.IsSchoolStudent);
            if (test.SectionId.HasValue && test.SectionId.Value != Guid.Empty)
                sq = sq.Where(s => s.SectionId == test.SectionId);
            enrolledCount = await sq.CountAsync();
        }

        string groupLabel = isSchoolTest
            ? (test.Class != null ? (test.Section != null ? $"{test.Class.Name} - Sec {test.Section.Name}" : test.Class.Name) : "School Class")
            : (test.Batch?.Name ?? "");

        return Ok(new
        {
            testId = test.Id,
            testTitle = test.Title,
            batchName = groupLabel,
            isSchoolTest,
            enrolledCount,
            rooms,
            teachers,
            halls,
            seats
        });
    }

    [HttpPost("tests/{testId:guid}/seating/auto-allocate")]
    public async Task<IActionResult> AutoAllocateSeating(Guid testId, [FromBody] AutoAllocateSeatingRequest req)
    {
        if (!await HasCoachingTestPermissionAsync(MenuPermissionOperation.Edit) &&
            !await HasCoachingTestPermissionAsync(MenuPermissionOperation.Create))
            return Forbid();

        var test = await _db.Tests
            .FirstOrDefaultAsync(t => t.Id == testId && t.TenantId == _currentUser.TenantId);
        if (test == null) return NotFound(new { message = "Coaching test not found." });

        if (req.Halls == null || req.Halls.Count == 0)
            return BadRequest(new { message = "Please add at least one Exam Hall / Room." });

        var studentsQuery = _db.Students
            .AsNoTracking()
            .Where(s => s.TenantId == _currentUser.TenantId && s.IsActive);

        bool isSchoolTest = (!test.BatchId.HasValue || test.BatchId.Value == Guid.Empty) && test.ClassId.HasValue;

        if (test.BatchId.HasValue && test.BatchId.Value != Guid.Empty)
            studentsQuery = studentsQuery.Where(s => s.BatchId == test.BatchId.Value);
        else if (test.ClassId.HasValue && test.ClassId.Value != Guid.Empty)
        {
            studentsQuery = studentsQuery.Where(s => s.ClassId == test.ClassId.Value && s.IsSchoolStudent);
            if (test.SectionId.HasValue && test.SectionId.Value != Guid.Empty)
                studentsQuery = studentsQuery.Where(s => s.SectionId == test.SectionId.Value);
        }
        else
            return BadRequest(new { message = "Test has no linked Coaching Batch or School Class." });

        var students = await studentsQuery.ToListAsync();
        if (students.Count == 0)
            return BadRequest(new { message = "No active enrolled students found for this exam." });

        students = string.Equals(req.OrderBy, "Name", StringComparison.OrdinalIgnoreCase)
            ? students.OrderBy(s => s.StudentName).ToList()
            : (isSchoolTest
                ? students.OrderBy(s => !string.IsNullOrWhiteSpace(s.SchoolRollNumber) ? s.SchoolRollNumber : s.AdmissionNumber).ThenBy(s => s.StudentName).ToList()
                : students.OrderBy(s => !string.IsNullOrWhiteSpace(s.CoachingRollNumber) ? s.CoachingRollNumber : s.RollNumber).ThenBy(s => s.StudentName).ToList());

        int totalCapacity = req.Halls.Sum(h => Math.Max(1, h.Capacity));
        if (totalCapacity < students.Count)
            return BadRequest(new { message = $"Total hall capacity ({totalCapacity}) is less than enrolled students ({students.Count}). Please add another room or increase capacity." });

        // Remove previous allocations for this test
        var oldSeats = await _db.CoachingExamSeatAllocations
            .Where(s => s.TenantId == _currentUser.TenantId && s.TestId == testId)
            .ToListAsync();
        var oldHalls = await _db.CoachingExamHallAllocations
            .Where(h => h.TenantId == _currentUser.TenantId && h.TestId == testId)
            .ToListAsync();

        _db.CoachingExamSeatAllocations.RemoveRange(oldSeats);
        _db.CoachingExamHallAllocations.RemoveRange(oldHalls);

        var newHalls = new List<CoachingExamHallAllocation>();
        int sortOrder = 1;
        foreach (var h in req.Halls)
        {
            var hallEntity = new CoachingExamHallAllocation
            {
                TenantId = _currentUser.TenantId,
                BranchId = test.BranchId ?? _currentUser.BranchId,
                TestId = testId,
                RoomId = h.RoomId,
                RoomName = string.IsNullOrWhiteSpace(h.RoomName) ? $"Hall {sortOrder}" : h.RoomName.Trim(),
                Capacity = Math.Max(1, h.Capacity),
                InvigilatorTeacherId = h.InvigilatorTeacherId,
                InvigilatorName = h.InvigilatorName?.Trim(),
                ExamStartTime = req.ExamStartTime,
                ExamEndTime = req.ExamEndTime,
                SortOrder = sortOrder++,
                CreatedAt = DateTime.UtcNow
            };
            newHalls.Add(hallEntity);
            _db.CoachingExamHallAllocations.Add(hallEntity);
        }

        // Distribute students sequentially across halls
        int studentIdx = 0;
        for (int hi = 0; hi < newHalls.Count && studentIdx < students.Count; hi++)
        {
            var hall = newHalls[hi];
            string prefix = $"H{hi + 1}";
            for (int seatInHall = 1; seatInHall <= hall.Capacity && studentIdx < students.Count; seatInHall++)
            {
                var st = students[studentIdx++];
                _db.CoachingExamSeatAllocations.Add(new CoachingExamSeatAllocation
                {
                    TenantId = _currentUser.TenantId,
                    BranchId = test.BranchId ?? _currentUser.BranchId,
                    TestId = testId,
                    HallAllocationId = hall.Id,
                    RoomId = hall.RoomId,
                    RoomName = hall.RoomName,
                    StudentId = st.Id,
                    SeatNumber = $"{prefix}-{seatInHall:D2}",
                    BenchNumber = (seatInHall + 1) / 2,
                    AttendanceStatus = "Scheduled",
                    UpdatedAt = DateTime.UtcNow
                });
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new
        {
            message = $"Allocated {students.Count} students across {newHalls.Count} exam hall(s). Admit Cards are now automatically synced!",
            allocatedStudents = students.Count,
            hallCount = newHalls.Count
        });
    }

    [HttpPut("tests/{testId:guid}/seating/attendance")]
    public async Task<IActionResult> UpdateExamHallAttendance(Guid testId, [FromBody] UpdateExamHallAttendanceRequest req)
    {
        if (!await HasCoachingTestPermissionAsync(MenuPermissionOperation.Edit) &&
            !await HasCoachingTestPermissionAsync(MenuPermissionOperation.Create))
            return Forbid();

        var seats = await _db.CoachingExamSeatAllocations
            .Where(s => s.TenantId == _currentUser.TenantId && s.TestId == testId)
            .ToListAsync();

        var map = seats.ToDictionary(s => s.StudentId);
        foreach (var item in req.Items ?? new List<ExamHallAttendanceItem>())
        {
            if (map.TryGetValue(item.StudentId, out var seat))
            {
                seat.AttendanceStatus = string.IsNullOrWhiteSpace(item.AttendanceStatus) ? "Present" : item.AttendanceStatus.Trim();
                seat.UpdatedAt = DateTime.UtcNow;
            }
        }

        int presentCount = seats.Count(s => s.AttendanceStatus == "Present");

        // Auto-sync Present copies count onto Test.TotalCopiesIssued if requested
        if (req.SyncCopyBundleCount)
        {
            var test = await _db.Tests.FirstOrDefaultAsync(t => t.Id == testId && t.TenantId == _currentUser.TenantId);
            if (test != null && presentCount > 0)
            {
                test.TotalCopiesIssued = presentCount;
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new
        {
            message = $"Exam Hall Attendance saved ({presentCount} Present / {seats.Count} Total).",
            presentCount,
            absentCount = seats.Count(s => s.AttendanceStatus == "Absent"),
            totalCount = seats.Count
        });
    }

    [HttpPost("seating/by-tests")]
    public async Task<IActionResult> GetSeatingByTests([FromBody] SeatingByTestsRequest req)
    {
        if (!await HasCoachingTestPermissionAsync(MenuPermissionOperation.View))
            return Forbid();

        var ids = (req.TestIds ?? new List<Guid>()).Distinct().ToList();
        if (ids.Count == 0) return Ok(new { seats = Array.Empty<object>() });

        var hallTimes = await _db.CoachingExamHallAllocations
            .AsNoTracking()
            .Where(h => h.TenantId == _currentUser.TenantId && ids.Contains(h.TestId))
            .ToDictionaryAsync(h => h.Id, h => new { h.ExamStartTime, h.ExamEndTime });

        var seats = await _db.CoachingExamSeatAllocations
            .AsNoTracking()
            .Where(s => s.TenantId == _currentUser.TenantId && ids.Contains(s.TestId))
            .Select(s => new
            {
                s.TestId,
                s.StudentId,
                s.HallAllocationId,
                s.RoomName,
                s.SeatNumber
            })
            .ToListAsync();

        var enriched = seats.Select(s =>
        {
            hallTimes.TryGetValue(s.HallAllocationId, out var ht);
            return new
            {
                s.TestId,
                s.StudentId,
                s.RoomName,
                s.SeatNumber,
                examStartTime = ht?.ExamStartTime,
                examEndTime = ht?.ExamEndTime
            };
        }).ToList();

        return Ok(new { seats = enriched });
    }

    // ─── 9. Phase 3: Coaching Weekly Marksheet, Rank & AI Remarks ─────────
    [HttpGet("tests/{testId:guid}/weekly-marksheet")]
    public async Task<IActionResult> GetWeeklyMarksheet(Guid testId)
    {
        if (!await HasCoachingTestPermissionAsync(MenuPermissionOperation.View))
            return Forbid();

        var test = await _db.Tests
            .AsNoTracking()
            .Include(t => t.Batch)
            .Include(t => t.Class)
            .Include(t => t.Section)
            .Include(t => t.Branch)
            .FirstOrDefaultAsync(t => t.Id == testId && t.TenantId == _currentUser.TenantId);

        if (test == null) return NotFound(new { message = "Exam / Test not found." });

        bool isSchoolTest = (!test.BatchId.HasValue || test.BatchId.Value == Guid.Empty) && test.ClassId.HasValue;

        var paper = await _db.CoachingQuestionPapers
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.TenantId == _currentUser.TenantId && p.TestId == testId);

        var marksList = await _db.TestMarks
            .AsNoTracking()
            .Include(m => m.Student)
            .Where(m => m.TenantId == _currentUser.TenantId && m.TestId == testId)
            .ToListAsync();

        var maxMarks = test.MaxMarks > 0 ? test.MaxMarks : (paper?.TotalMarks ?? 100m);
        var passingMarks = test.PassingMarks > 0 ? test.PassingMarks : Math.Round(maxMarks * 0.33m, 1);
        var chapterTitle = !string.IsNullOrWhiteSpace(paper?.ChapterTitle) ? paper.ChapterTitle : test.Title;

        var presentMarks = marksList.Where(m => !m.IsAbsent).OrderByDescending(m => m.MarksObtained).ToList();
        decimal highest = presentMarks.Count > 0 ? presentMarks.Max(m => m.MarksObtained) : 0m;
        decimal lowest = presentMarks.Count > 0 ? presentMarks.Min(m => m.MarksObtained) : 0m;
        decimal average = presentMarks.Count > 0 ? Math.Round(presentMarks.Average(m => m.MarksObtained), 2) : 0m;

        // Dense-aware standard competition ranking (ties get same rank)
        var rankMap = new Dictionary<Guid, int>();
        int currentRank = 0;
        decimal? lastScore = null;
        for (int i = 0; i < presentMarks.Count; i++)
        {
            var m = presentMarks[i];
            if (!lastScore.HasValue || m.MarksObtained != lastScore.Value)
            {
                currentRank = i + 1;
                lastScore = m.MarksObtained;
            }
            rankMap[m.StudentId] = currentRank;
        }

        static string ComputeGrade(decimal pct, bool isAbsent)
        {
            if (isAbsent) return "AB";
            if (pct >= 90) return "A+";
            if (pct >= 80) return "A";
            if (pct >= 70) return "B+";
            if (pct >= 60) return "B";
            if (pct >= 45) return "C";
            if (pct >= 33) return "D";
            return "E";
        }

        static string DefaultSmartRemark(decimal pct, bool isAbsent, string subject, string chapter)
        {
            if (isAbsent) return $"Student was absent for {subject} ({chapter}). Please ensure regular attendance in weekly tests.";
            if (pct >= 90) return $"Outstanding mastery in {subject} ({chapter})! Consistent topper-level performance.";
            if (pct >= 75) return $"Very good grasp of {chapter}. Minor practice on application problems will push to 90%+.";
            if (pct >= 60) return $"Good effort in {subject}. Revise core concepts of {chapter} to boost speed and accuracy.";
            if (pct >= 33) return $"Satisfactory performance in {chapter}. Needs structured daily practice and doubt clearing.";
            return $"Needs immediate academic attention in {subject} ({chapter}). Recommend 1-on-1 revision with faculty.";
        }

        var rows = marksList
            .OrderBy(m => m.IsAbsent ? 1 : 0)
            .ThenByDescending(m => m.MarksObtained)
            .ThenBy(m => m.Student?.StudentName)
            .Select(m =>
            {
                var pct = (!m.IsAbsent && maxMarks > 0) ? Math.Round((m.MarksObtained / maxMarks) * 100m, 1) : 0m;
                var passed = !m.IsAbsent && m.MarksObtained >= passingMarks;
                var grade = ComputeGrade(pct, m.IsAbsent);
                var rank = (!m.IsAbsent && rankMap.TryGetValue(m.StudentId, out var r)) ? r : 0;
                var roll = isSchoolTest
                    ? (!string.IsNullOrWhiteSpace(m.Student?.SchoolRollNumber)
                        ? m.Student!.SchoolRollNumber
                        : (!string.IsNullOrWhiteSpace(m.Student?.AdmissionNumber) ? m.Student!.AdmissionNumber : (m.Student?.RollNumber ?? "—")))
                    : (!string.IsNullOrWhiteSpace(m.Student?.CoachingRollNumber)
                        ? m.Student!.CoachingRollNumber
                        : (m.Student?.RollNumber ?? m.Student?.AdmissionNumber ?? "—"));

                return new
                {
                    studentId = m.StudentId,
                    studentName = m.Student?.StudentName ?? "Student",
                    rollNumber = roll,
                    parentName = m.Student?.ParentName ?? "",
                    parentWhatsAppPhone = m.Student?.ParentWhatsAppPhone ?? "",
                    profilePhoto = m.Student?.ProfilePhoto,
                    marksObtained = m.MarksObtained,
                    maxMarks,
                    passingMarks,
                    percentage = pct,
                    grade,
                    rank,
                    isAbsent = m.IsAbsent,
                    isPassed = passed,
                    remarks = !string.IsNullOrWhiteSpace(m.Remarks) ? m.Remarks : DefaultSmartRemark(pct, m.IsAbsent, test.Subject ?? "Subject", chapterTitle)
                };
            })
            .ToList();

        int passedCount = rows.Count(r => r.isPassed);
        int appearedCount = rows.Count(r => !r.isAbsent);
        decimal passRate = appearedCount > 0 ? Math.Round((passedCount * 100m) / appearedCount, 1) : 0m;
        var topper = rows.FirstOrDefault(r => !r.isAbsent && r.rank == 1);

        return Ok(new
        {
            testId = test.Id,
            title = test.Title,
            subject = test.Subject ?? "General",
            chapterTitle,
            batchName = isSchoolTest
                ? (test.Class != null ? (test.Section != null ? $"{test.Class.Name} - Sec {test.Section.Name}" : test.Class.Name) : "School Class")
                : (test.Batch?.Name ?? test.Class?.Name ?? "Coaching Batch"),
            isSchoolTest,
            branchName = test.Branch?.Name ?? "",
            testDate = DateTime.SpecifyKind(test.TestDate, DateTimeKind.Utc),
            maxMarks,
            passingMarks,
            isMarksLocked = test.IsMarksLocked,
            evaluationStatus = test.EvaluationStatus,
            summary = new
            {
                totalStudents = rows.Count,
                appearedCount,
                absentCount = rows.Count - appearedCount,
                passedCount,
                passRate,
                highest,
                average,
                lowest,
                topperName = topper?.studentName ?? "—",
                topperScore = topper?.marksObtained ?? 0m
            },
            rows
        });
    }

    [HttpPost("tests/{testId:guid}/ai-remarks")]
    public async Task<IActionResult> GenerateAiRemarksForTest(Guid testId)
    {
        if (!await HasCoachingTestPermissionAsync(MenuPermissionOperation.Edit) &&
            !await HasCoachingTestPermissionAsync(MenuPermissionOperation.Create))
            return Forbid();

        var test = await _db.Tests
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == testId && t.TenantId == _currentUser.TenantId);
        if (test == null) return NotFound(new { message = "Test not found." });

        var marksList = await _db.TestMarks
            .Include(m => m.Student)
            .Where(m => m.TenantId == _currentUser.TenantId && m.TestId == testId && !m.IsAbsent)
            .ToListAsync();

        if (marksList.Count == 0)
            return BadRequest(new { message = "No present student marks found to generate AI remarks." });

        var (apiKey, modelName, _) = await ResolveGeminiConfigAsync();
        if (string.IsNullOrWhiteSpace(apiKey))
            return UnprocessableEntity(new { requiresApiKey = true, message = "Gemini API Key is not configured." });

        var paper = await _db.CoachingQuestionPapers
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.TenantId == _currentUser.TenantId && p.TestId == testId);
        var chapter = !string.IsNullOrWhiteSpace(paper?.ChapterTitle) ? paper.ChapterTitle : test.Title;
        var maxMarks = test.MaxMarks > 0 ? test.MaxMarks : 100m;

        var studentSummaryLines = string.Join("\n", marksList.Take(60).Select(m =>
            $"- id={m.StudentId}, name={m.Student?.StudentName}, score={m.MarksObtained}/{maxMarks}"));

        var prompt = $@"You are an encouraging Indian Coaching Academic Mentor writing short 1-sentence personalized weekly exam feedback for parents.
Subject: {test.Subject} | Chapter: {chapter} | Max Marks: {maxMarks}
Students:
{studentSummaryLines}

Return STRICT JSON ONLY (no markdown fences):
{{
  ""generalInstructions"": """",
  ""verificationSummary"": ""Generated personalized remarks"",
  ""questions"": [
    {{ ""qNo"": 1, ""topic"": ""<studentId>"", ""questionText"": ""<1 concise encouraging sentence specific to their score & chapter>"" }}
  ]
}}";

        var (aiPayload, _, err) = await CallGeminiMultimodalAsync(apiKey, modelName, prompt, null);
        if (aiPayload?.Questions == null || aiPayload.Questions.Count == 0)
            return StatusCode(StatusCodes.Status502BadGateway, new { message = err ?? "Could not generate AI remarks right now." });

        var remarkByStudentId = aiPayload.Questions
            .Where(q => Guid.TryParse(q.Topic, out _))
            .GroupBy(q => Guid.Parse(q.Topic))
            .ToDictionary(g => g.Key, g => g.First().QuestionText);

        int updated = 0;
        foreach (var m in marksList)
        {
            if (remarkByStudentId.TryGetValue(m.StudentId, out var aiRem) && !string.IsNullOrWhiteSpace(aiRem))
            {
                m.Remarks = aiRem.Trim();
                updated++;
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = $"Generated personalized Gemini AI remarks for {updated} student(s).", updated });
    }

    // ─── Internal Helpers: Prompt, Gemini Multimodal Call, Critic ─────────
    private static string BuildAgenticGenerationPrompt(
        string classOrBatch, string subject, string chapterTitle, string language,
        decimal totalMarks, int durationMinutes,
        int mcqCount, decimal mcqMarks,
        int fillCount, decimal fillMarks,
        int shortCount, decimal shortMarks,
        int longCount, decimal longMarks,
        int easyPct, int mediumPct, int hardPct,
        string? chapterText)
    {
        var sb = new StringBuilder();
        sb.AppendLine("You are an Enterprise Academic Exam Paper Agent for an Indian Coaching Institute.");
        sb.AppendLine("Follow this strict 3-step internal reasoning pipeline before outputting JSON:");
        sb.AppendLine("STEP 1 (Chapter Grounding): Read the provided chapter text and/or uploaded PDF/image pages deeply. NEVER invent facts outside the uploaded chapter syllabus.");
        sb.AppendLine("STEP 2 (Blueprint & Question Design): Create the exact number of questions per section and exact marks per question requested below, matching the difficulty mix.");
        sb.AppendLine("STEP 3 (Self-Critic Verification): Verify that (a) sum of all question marks == Total Marks, (b) every MCQ has exactly 4 distinct options and 1 unambiguous correct answer, (c) zero duplicate questions exist, (d) language matches the requested medium.");
        sb.AppendLine();
        sb.AppendLine($"Target Class / Batch: {classOrBatch}");
        sb.AppendLine($"Subject: {subject}");
        sb.AppendLine($"Chapter / Topic: {chapterTitle}");
        sb.AppendLine($"Medium / Language: {language} (If 'Hindi', write in Devanagari Hindi. If 'Bilingual', write each question in English followed by Hindi translation in parentheses.)");
        sb.AppendLine($"Total Marks: {totalMarks} | Duration: {durationMinutes} minutes");
        sb.AppendLine($"Difficulty Distribution Target: Easy {easyPct}%, Medium {mediumPct}%, Hard {hardPct}%");
        sb.AppendLine();
        sb.AppendLine("EXACT BLUEPRINT:");
        if (mcqCount > 0) sb.AppendLine($"- Section A (MCQ): {mcqCount} questions x {mcqMarks} mark(s) each");
        if (fillCount > 0) sb.AppendLine($"- Section B (FillInBlank): {fillCount} questions x {fillMarks} mark(s) each");
        if (shortCount > 0) sb.AppendLine($"- Section C (ShortAnswer): {shortCount} questions x {shortMarks} mark(s) each");
        if (longCount > 0) sb.AppendLine($"- Section D (LongAnswer): {longCount} questions x {longMarks} mark(s) each");
        sb.AppendLine();
        sb.AppendLine("Return STRICT VALID JSON ONLY (no markdown ``` fences, no commentary outside JSON) matching this exact schema:");
        sb.AppendLine(@"{
  ""generalInstructions"": ""Concise exam instructions for students"",
  ""verificationSummary"": ""Self-check summary confirming exact question count, marks total, and chapter grounding"",
  ""questions"": [
    {
      ""qNo"": 1,
      ""section"": ""Section A"",
      ""type"": ""MCQ"",
      ""difficulty"": ""Easy"",
      ""topic"": ""Subtopic from chapter"",
      ""marks"": 1,
      ""questionText"": ""Clear exam question text"",
      ""options"": [""Option 1"", ""Option 2"", ""Option 3"", ""Option 4""],
      ""correctAnswer"": ""Exact correct option or full model answer"",
      ""markingScheme"": ""Step-by-step evaluation rubric / explanation""
    }
  ]
}");
        sb.AppendLine("Rules for 'type': use ONLY 'MCQ', 'FillInBlank', 'ShortAnswer', or 'LongAnswer'. For non-MCQ, set 'options' to [].");

        if (!string.IsNullOrWhiteSpace(chapterText))
        {
            sb.AppendLine();
            sb.AppendLine("=== CHAPTER SOURCE CONTENT ===");
            sb.AppendLine(chapterText.Length > 22000 ? chapterText[..22000] : chapterText);
        }

        return sb.ToString();
    }

    private async Task<(AiPaperGenerationPayload? Payload, string UsedModel, string? ErrorMessage)> CallGeminiMultimodalAsync(
        string apiKey, string preferredModel, string prompt, List<ChapterAttachmentDto>? attachments)
    {
        var modelsToTry = new List<string>();
        if (!string.IsNullOrWhiteSpace(preferredModel) && !preferredModel.Equals("gemini-2.0-flash", StringComparison.OrdinalIgnoreCase))
            modelsToTry.Add(preferredModel);
        modelsToTry.Add("gemini-2.5-flash");
        modelsToTry.Add("gemini-2.5-flash-lite");
        modelsToTry.Add("gemini-3.5-flash");
        modelsToTry.Add("gemini-3.5-flash-lite");
        modelsToTry.Add("gemini-3-flash-preview");
        modelsToTry.Add("gemini-flash-latest");

        var parts = new List<object> { new { text = prompt } };
        if (attachments != null)
        {
            foreach (var att in attachments.Take(6))
            {
                if (string.IsNullOrWhiteSpace(att.Base64Data)) continue;
                var cleanB64 = att.Base64Data.Contains(",") ? att.Base64Data[(att.Base64Data.IndexOf(',') + 1)..] : att.Base64Data;
                var mime = string.IsNullOrWhiteSpace(att.MimeType) ? "image/jpeg" : att.MimeType;
                parts.Add(new
                {
                    inline_data = new
                    {
                        mime_type = mime,
                        data = cleanB64
                    }
                });
            }
        }

        var requestBody = new
        {
            contents = new[] { new { role = "user", parts } },
            generationConfig = new
            {
                temperature = 0.35,
                responseMimeType = "application/json"
            }
        };

        var jsonBody = JsonSerializer.Serialize(requestBody);
        var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(95);

        string? lastError = null;
        foreach (var model in modelsToTry.Distinct())
        {
            try
            {
                var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={Uri.EscapeDataString(apiKey)}";
                using var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
                using var response = await client.PostAsync(url, content);
                var rawResp = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("[CoachingAiExam] Gemini {Model} returned {Code}: {Body}", model, (int)response.StatusCode, rawResp.Length > 400 ? rawResp[..400] : rawResp);
                    string apiDetail = string.Empty;
                    try
                    {
                        using var errDoc = JsonDocument.Parse(rawResp);
                        if (errDoc.RootElement.TryGetProperty("error", out var errObj) && errObj.TryGetProperty("message", out var msgProp))
                            apiDetail = msgProp.GetString() ?? string.Empty;
                    }
                    catch { }

                    if ((int)response.StatusCode == 400 && apiDetail.Contains("API key", StringComparison.OrdinalIgnoreCase) || (int)response.StatusCode == 403)
                    {
                        return (null, model, "Gemini API Key appears invalid or restricted. Please verify your API key in AI Settings.");
                    }
                    lastError = !string.IsNullOrWhiteSpace(apiDetail)
                        ? $"Gemini ({model}): {apiDetail}"
                        : $"Gemini API ({model}) returned HTTP {(int)response.StatusCode}.";
                    continue;
                }

                using var doc = JsonDocument.Parse(rawResp);
                var textOut = doc.RootElement
                    .GetProperty("candidates")[0]
                    .GetProperty("content")
                    .GetProperty("parts")[0]
                    .GetProperty("text")
                    .GetString();

                if (string.IsNullOrWhiteSpace(textOut))
                {
                    lastError = "Gemini returned empty text.";
                    continue;
                }

                var cleaned = StripJsonFences(textOut);
                var parsed = JsonSerializer.Deserialize<AiPaperGenerationPayload>(cleaned, JsonOpts);
                if (parsed?.Questions != null && parsed.Questions.Count > 0)
                {
                    return (parsed, model, null);
                }

                lastError = "AI response could not be parsed into questions.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[CoachingAiExam] Gemini call failed on model {Model}", model);
                lastError = $"AI generation error ({model}): {ex.Message}";
            }
        }

        return (null, preferredModel, lastError);
    }

    private static string StripJsonFences(string raw)
    {
        var s = raw.Trim();
        if (s.StartsWith("```"))
        {
            var firstNewline = s.IndexOf('\n');
            if (firstNewline >= 0) s = s[(firstNewline + 1)..];
            if (s.EndsWith("```")) s = s[..^3];
        }
        return s.Trim();
    }

    private static List<AiExamQuestionItem> RunCriticVerification(List<AiExamQuestionItem>? rawQuestions)
    {
        var clean = new List<AiExamQuestionItem>();
        if (rawQuestions == null) return clean;

        int num = 1;
        foreach (var q in rawQuestions)
        {
            if (string.IsNullOrWhiteSpace(q.QuestionText)) continue;
            var qType = string.IsNullOrWhiteSpace(q.Type) ? "ShortAnswer" : q.Type.Trim();
            var opts = string.Equals(qType, "MCQ", StringComparison.OrdinalIgnoreCase)
                ? (q.Options ?? new List<string>()).Where(o => !string.IsNullOrWhiteSpace(o)).Select(o => o.Trim()).Take(4).ToList()
                : new List<string>();

            clean.Add(new AiExamQuestionItem
            {
                QNo = num++,
                Section = string.IsNullOrWhiteSpace(q.Section) ? (qType == "MCQ" ? "Section A" : "Section B") : q.Section.Trim(),
                Type = qType,
                Difficulty = string.IsNullOrWhiteSpace(q.Difficulty) ? "Medium" : q.Difficulty.Trim(),
                Topic = string.IsNullOrWhiteSpace(q.Topic) ? "Core Concept" : q.Topic.Trim(),
                Marks = q.Marks > 0 ? q.Marks : 1,
                QuestionText = q.QuestionText.Trim(),
                Options = opts,
                CorrectAnswer = q.CorrectAnswer?.Trim() ?? string.Empty,
                MarkingScheme = q.MarkingScheme?.Trim() ?? string.Empty
            });
        }
        return clean;
    }

    private static object BuildPaperResponse(CoachingQuestionPaper paper, string? verificationSummary = null)
    {
        var questions = new List<AiExamQuestionItem>();
        try
        {
            questions = JsonSerializer.Deserialize<List<AiExamQuestionItem>>(paper.QuestionsJson ?? "[]", JsonOpts) ?? new();
        }
        catch { }

        object? blueprint = null;
        try
        {
            if (!string.IsNullOrWhiteSpace(paper.BlueprintJson))
                blueprint = JsonSerializer.Deserialize<object>(paper.BlueprintJson, JsonOpts);
        }
        catch { }

        object? difficultyMix = null;
        try
        {
            if (!string.IsNullOrWhiteSpace(paper.DifficultyMixJson))
                difficultyMix = JsonSerializer.Deserialize<object>(paper.DifficultyMixJson, JsonOpts);
        }
        catch { }

        return new
        {
            exists = true,
            id = paper.Id,
            testId = paper.TestId,
            subject = paper.Subject,
            chapterTitle = paper.ChapterTitle,
            chapterSourceType = paper.ChapterSourceType,
            chapterSourceText = paper.ChapterSourceText,
            language = paper.Language,
            durationMinutes = paper.DurationMinutes,
            totalMarks = paper.TotalMarks,
            blueprint,
            difficultyMix,
            questions,
            generalInstructions = paper.GeneralInstructions,
            paperStatus = paper.PaperStatus,
            revisionRemarks = paper.RevisionRemarks,
            approvedBy = paper.ApprovedBy,
            approvedAt = paper.ApprovedAt.HasValue ? DateTime.SpecifyKind(paper.ApprovedAt.Value, DateTimeKind.Utc) : (DateTime?)null,
            aiModelUsed = paper.AiModelUsed,
            updatedAt = DateTime.SpecifyKind(paper.UpdatedAt, DateTimeKind.Utc),
            verificationSummary
        };
    }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────

public class SaveTenantAiConfigRequest
{
    public string? ApiKey { get; set; }
    public string? ModelName { get; set; }
}

public class ChapterAttachmentDto
{
    public string FileName { get; set; } = string.Empty;
    public string MimeType { get; set; } = "image/jpeg";
    public string Base64Data { get; set; } = string.Empty;
}

public class GenerateCoachingAiPaperRequest
{
    public string? Subject { get; set; }
    public string? ChapterTitle { get; set; }
    public string? Language { get; set; } = "English";
    public int DurationMinutes { get; set; } = 60;
    public int McqCount { get; set; } = 5;
    public decimal McqMarks { get; set; } = 1;
    public int FillBlankCount { get; set; } = 0;
    public decimal FillBlankMarks { get; set; } = 1;
    public int ShortCount { get; set; } = 5;
    public decimal ShortMarks { get; set; } = 2;
    public int LongCount { get; set; } = 1;
    public decimal LongMarks { get; set; } = 5;
    public int EasyPercent { get; set; } = 30;
    public int MediumPercent { get; set; } = 50;
    public int HardPercent { get; set; } = 20;
    public string? ChapterText { get; set; }
    public List<ChapterAttachmentDto>? Attachments { get; set; }
}

public class RegenerateSingleQuestionRequest
{
    public int QNo { get; set; }
    public string? Difficulty { get; set; }
    public string? CustomHint { get; set; }
}

public class UpdateCoachingAiPaperRequest
{
    public string? ChapterTitle { get; set; }
    public string? Language { get; set; }
    public int DurationMinutes { get; set; }
    public string? GeneralInstructions { get; set; }
    public List<AiExamQuestionItem>? Questions { get; set; }
}

public class PaperRevisionRequest
{
    public string? Remarks { get; set; }
}

public class AiPaperGenerationPayload
{
    public string? GeneralInstructions { get; set; }
    public string? VerificationSummary { get; set; }
    public List<AiExamQuestionItem> Questions { get; set; } = new();
}

public class AiExamQuestionItem
{
    public int QNo { get; set; }
    public string Section { get; set; } = "Section A";
    public string Type { get; set; } = "MCQ";
    public string Difficulty { get; set; } = "Medium";
    public string Topic { get; set; } = string.Empty;
    public decimal Marks { get; set; } = 1;
    public string QuestionText { get; set; } = string.Empty;
    public List<string> Options { get; set; } = new();
    public string CorrectAnswer { get; set; } = string.Empty;
    public string MarkingScheme { get; set; } = string.Empty;
}

public class ExamHallInputDto
{
    public Guid? RoomId { get; set; }
    public string RoomName { get; set; } = string.Empty;
    public int Capacity { get; set; } = 30;
    public Guid? InvigilatorTeacherId { get; set; }
    public string? InvigilatorName { get; set; }
}

public class AutoAllocateSeatingRequest
{
    public string? ExamStartTime { get; set; }
    public string? ExamEndTime { get; set; }
    public string? OrderBy { get; set; } = "RollNo";
    public List<ExamHallInputDto> Halls { get; set; } = new();
}

public class ExamHallAttendanceItem
{
    public Guid StudentId { get; set; }
    public string AttendanceStatus { get; set; } = "Present";
}

public class UpdateExamHallAttendanceRequest
{
    public bool SyncCopyBundleCount { get; set; } = true;
    public List<ExamHallAttendanceItem> Items { get; set; } = new();
}

public class SeatingByTestsRequest
{
    public List<Guid> TestIds { get; set; } = new();
}
