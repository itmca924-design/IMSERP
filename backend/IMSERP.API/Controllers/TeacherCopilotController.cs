using System.Text.Json;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[Authorize]
[ApiController]
[Route("api/teacher-copilot")]
public class TeacherCopilotController : ControllerBase
{
    private readonly IMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;
    private readonly ILogger<TeacherCopilotController> _logger;

    public TeacherCopilotController(
        IMSERPDbContext dbContext,
        ICurrentUserService currentUser,
        ILogger<TeacherCopilotController> logger)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _logger = logger;
    }

    [HttpPost("generate-paper")]
    public async Task<ActionResult<TeacherQuestionPaperDto>> GenerateQuestionPaper([FromBody] GenerateQuestionPaperRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Subject) || string.IsNullOrWhiteSpace(request.ClassName))
        {
            return BadRequest("Subject and Class Name are required.");
        }

        var tenantId = _currentUser.TenantId;
        var branchId = request.BranchId ?? _currentUser.BranchId;

        // Auto-Generate Authentic Academic Paper Blueprint
        var generatedPaper = SynthesizeCurriculumPaper(request);

        var entity = new TeacherQuestionPaper
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            Title = string.IsNullOrWhiteSpace(request.Title) ? $"{request.Subject} Examination ({request.ClassName})" : request.Title.Trim(),
            Subject = request.Subject.Trim(),
            ClassName = request.ClassName.Trim(),
            BoardOrCurriculum = string.IsNullOrWhiteSpace(request.BoardOrCurriculum) ? "CBSE / State Board Standard" : request.BoardOrCurriculum.Trim(),
            TotalMarks = request.TotalMarks > 0 ? request.TotalMarks : 50,
            DurationMinutes = request.DurationMinutes > 0 ? request.DurationMinutes : 90,
            DifficultyLevel = string.IsNullOrWhiteSpace(request.DifficultyLevel) ? "Balanced" : request.DifficultyLevel.Trim(),
            Language = string.IsNullOrWhiteSpace(request.Language) ? "Bilingual" : request.Language.Trim(),
            ChaptersList = request.ChaptersList?.Trim() ?? string.Empty,
            GeneralInstructions = generatedPaper.GeneralInstructions,
            PaperSectionsJson = JsonSerializer.Serialize(generatedPaper.Sections),
            MarkingSchemeJson = generatedPaper.MarkingSchemeJson,
            CreatedBy = User?.Identity?.Name ?? _currentUser.Username ?? "Academic Teacher",
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.TeacherQuestionPapers.Add(entity);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("[TeacherCopilot] Generated paper {PaperId} for Subject {Subject}, Class {Class} by {User}",
            entity.Id, entity.Subject, entity.ClassName, entity.CreatedBy);

        string? branchName = null;
        if (branchId.HasValue)
        {
            var b = await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(x => x.Id == branchId.Value);
            branchName = b?.Name;
        }

        return Ok(new TeacherQuestionPaperDto(
            entity.Id,
            entity.TenantId,
            entity.BranchId,
            branchName,
            entity.Title,
            entity.Subject,
            entity.ClassName,
            entity.BoardOrCurriculum,
            entity.TotalMarks,
            entity.DurationMinutes,
            entity.DifficultyLevel,
            entity.Language,
            entity.ChaptersList,
            entity.GeneralInstructions,
            generatedPaper.Sections,
            entity.MarkingSchemeJson,
            entity.CreatedBy,
            entity.CreatedAt
        ));
    }

    [HttpGet("papers")]
    public async Task<ActionResult<List<TeacherQuestionPaperDto>>> GetQuestionPapers(
        [FromQuery] Guid? branchId,
        [FromQuery] string? subject,
        [FromQuery] string? className)
    {
        var tenantId = _currentUser.TenantId;

        var query = _dbContext.TeacherQuestionPapers
            .AsNoTracking()
            .Include(p => p.Branch)
            .Where(p => p.TenantId == tenantId);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
            query = query.Where(p => p.BranchId == branchId.Value);

        if (!string.IsNullOrWhiteSpace(subject))
            query = query.Where(p => p.Subject.ToLower().Contains(subject.Trim().ToLower()));

        if (!string.IsNullOrWhiteSpace(className))
            query = query.Where(p => p.ClassName.ToLower().Contains(className.Trim().ToLower()));

        var list = await query
            .OrderByDescending(p => p.CreatedAt)
            .Take(50)
            .ToListAsync();

        var result = list.Select(p =>
        {
            List<QuestionSectionDto> sections;
            try
            {
                sections = JsonSerializer.Deserialize<List<QuestionSectionDto>>(p.PaperSectionsJson) ?? new List<QuestionSectionDto>();
            }
            catch
            {
                sections = new List<QuestionSectionDto>();
            }

            return new TeacherQuestionPaperDto(
                p.Id,
                p.TenantId,
                p.BranchId,
                p.Branch?.Name,
                p.Title,
                p.Subject,
                p.ClassName,
                p.BoardOrCurriculum,
                p.TotalMarks,
                p.DurationMinutes,
                p.DifficultyLevel,
                p.Language,
                p.ChaptersList,
                p.GeneralInstructions,
                sections,
                p.MarkingSchemeJson,
                p.CreatedBy,
                p.CreatedAt
            );
        }).ToList();

        return Ok(result);
    }

    [HttpGet("papers/{id}")]
    public async Task<ActionResult<TeacherQuestionPaperDto>> GetQuestionPaperById(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var p = await _dbContext.TeacherQuestionPapers
            .AsNoTracking()
            .Include(x => x.Branch)
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id);

        if (p == null) return NotFound("Question paper not found.");

        List<QuestionSectionDto> sections;
        try
        {
            sections = JsonSerializer.Deserialize<List<QuestionSectionDto>>(p.PaperSectionsJson) ?? new List<QuestionSectionDto>();
        }
        catch
        {
            sections = new List<QuestionSectionDto>();
        }

        return Ok(new TeacherQuestionPaperDto(
            p.Id,
            p.TenantId,
            p.BranchId,
            p.Branch?.Name,
            p.Title,
            p.Subject,
            p.ClassName,
            p.BoardOrCurriculum,
            p.TotalMarks,
            p.DurationMinutes,
            p.DifficultyLevel,
            p.Language,
            p.ChaptersList,
            p.GeneralInstructions,
            sections,
            p.MarkingSchemeJson,
            p.CreatedBy,
            p.CreatedAt
        ));
    }

    [HttpDelete("papers/{id}")]
    public async Task<ActionResult> DeleteQuestionPaper(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var p = await _dbContext.TeacherQuestionPapers.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id);
        if (p == null) return NotFound("Question paper not found.");

        _dbContext.TeacherQuestionPapers.Remove(p);
        await _dbContext.SaveChangesAsync();

        return Ok(new { success = true });
    }

    [HttpPost("generate-lesson-plan")]
    public async Task<ActionResult<TeacherAiLessonPlanDto>> GenerateLessonPlan([FromBody] GenerateAiLessonPlanRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Subject) || string.IsNullOrWhiteSpace(request.ClassName) || string.IsNullOrWhiteSpace(request.TopicOrChapter))
        {
            return BadRequest("Subject, Class, and Topic/Chapter are required.");
        }

        var tenantId = _currentUser.TenantId;
        var branchId = request.BranchId ?? _currentUser.BranchId;

        var synthesizedPlan = SynthesizeNEP2020LessonPlan(request);

        var entity = new TeacherAiLessonPlan
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            Title = $"NEP 2020 Lesson Plan: {request.TopicOrChapter} ({request.ClassName})",
            Subject = request.Subject.Trim(),
            ClassName = request.ClassName.Trim(),
            TopicOrChapter = request.TopicOrChapter.Trim(),
            TotalPeriods = request.TotalPeriods > 0 ? request.TotalPeriods : 4,
            PedagogicalApproach = string.IsNullOrWhiteSpace(request.PedagogicalApproach) ? "Experiential & 5E Inquiry Model (NEP 2020)" : request.PedagogicalApproach.Trim(),
            LearningObjectives = synthesizedPlan.LearningObjectives,
            TeachingAidsAndResources = synthesizedPlan.TeachingAidsAndResources,
            PlanPeriodsJson = JsonSerializer.Serialize(synthesizedPlan.Periods),
            FormativeAssessmentQuestions = synthesizedPlan.FormativeAssessmentQuestions,
            HomeworkAndWorksheetAssignment = synthesizedPlan.HomeworkAndWorksheetAssignment,
            CreatedBy = User?.Identity?.Name ?? _currentUser.Username ?? "Faculty Member",
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.TeacherAiLessonPlans.Add(entity);
        await _dbContext.SaveChangesAsync();

        string? branchName = null;
        if (branchId.HasValue)
        {
            var b = await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(x => x.Id == branchId.Value);
            branchName = b?.Name;
        }

        return Ok(new TeacherAiLessonPlanDto(
            entity.Id,
            entity.TenantId,
            entity.BranchId,
            branchName,
            entity.Title,
            entity.Subject,
            entity.ClassName,
            entity.TopicOrChapter,
            entity.TotalPeriods,
            entity.PedagogicalApproach,
            entity.LearningObjectives,
            entity.TeachingAidsAndResources,
            synthesizedPlan.Periods,
            entity.FormativeAssessmentQuestions,
            entity.HomeworkAndWorksheetAssignment,
            entity.CreatedBy,
            entity.CreatedAt
        ));
    }

    [HttpGet("lesson-plans")]
    public async Task<ActionResult<List<TeacherAiLessonPlanDto>>> GetLessonPlans(
        [FromQuery] Guid? branchId,
        [FromQuery] string? subject,
        [FromQuery] string? className)
    {
        var tenantId = _currentUser.TenantId;

        var query = _dbContext.TeacherAiLessonPlans
            .AsNoTracking()
            .Include(p => p.Branch)
            .Where(p => p.TenantId == tenantId);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
            query = query.Where(p => p.BranchId == branchId.Value);

        if (!string.IsNullOrWhiteSpace(subject))
            query = query.Where(p => p.Subject.ToLower().Contains(subject.Trim().ToLower()));

        if (!string.IsNullOrWhiteSpace(className))
            query = query.Where(p => p.ClassName.ToLower().Contains(className.Trim().ToLower()));

        var list = await query
            .OrderByDescending(p => p.CreatedAt)
            .Take(50)
            .ToListAsync();

        var result = list.Select(p =>
        {
            List<LessonPeriodItemDto> periods;
            try
            {
                periods = JsonSerializer.Deserialize<List<LessonPeriodItemDto>>(p.PlanPeriodsJson) ?? new List<LessonPeriodItemDto>();
            }
            catch
            {
                periods = new List<LessonPeriodItemDto>();
            }

            return new TeacherAiLessonPlanDto(
                p.Id,
                p.TenantId,
                p.BranchId,
                p.Branch?.Name,
                p.Title,
                p.Subject,
                p.ClassName,
                p.TopicOrChapter,
                p.TotalPeriods,
                p.PedagogicalApproach,
                p.LearningObjectives,
                p.TeachingAidsAndResources,
                periods,
                p.FormativeAssessmentQuestions,
                p.HomeworkAndWorksheetAssignment,
                p.CreatedBy,
                p.CreatedAt
            );
        }).ToList();

        return Ok(result);
    }

    [HttpDelete("lesson-plans/{id}")]
    public async Task<ActionResult> DeleteLessonPlan(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var p = await _dbContext.TeacherAiLessonPlans.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id);
        if (p == null) return NotFound("Lesson plan not found.");

        _dbContext.TeacherAiLessonPlans.Remove(p);
        await _dbContext.SaveChangesAsync();

        return Ok(new { success = true });
    }

    // --- Academic Synthesis Heuristic Engine (Curriculum-Aligned Paper & Blueprint Generator) ---

    private class SynthesizedPaperResult
    {
        public string GeneralInstructions { get; set; } = string.Empty;
        public List<QuestionSectionDto> Sections { get; set; } = new();
        public string MarkingSchemeJson { get; set; } = string.Empty;
    }

    private SynthesizedPaperResult SynthesizeCurriculumPaper(GenerateQuestionPaperRequestDto req)
    {
        bool isHindi = req.Language.Equals("Hindi", StringComparison.OrdinalIgnoreCase);
        bool isBilingual = req.Language.Equals("Bilingual", StringComparison.OrdinalIgnoreCase);

        int totalMarks = req.TotalMarks > 0 ? req.TotalMarks : 50;
        int duration = req.DurationMinutes > 0 ? req.DurationMinutes : 90;

        string chapters = string.IsNullOrWhiteSpace(req.ChaptersList) ? "Complete Prescribed Term Syllabus" : req.ChaptersList.Trim();

        // General Instructions
        string instructions = isHindi
            ? "1. सभी प्रश्न अनिवार्य हैं।\n2. प्रश्न-पत्र में कुल 4 खंड (A, B, C, D) हैं।\n3. खंड A में बहुविकल्पीय प्रश्न हैं (प्रत्येक 1 अंक)।\n4. खंड B में अति-लघु उत्तरीय प्रश्न हैं (प्रत्येक 2 अंक)।\n5. खंड C में लघु उत्तरीय प्रश्न हैं (प्रत्येक 3 अंक)।\n6. खंड D में दीर्घ उत्तरीय/केस स्टडी प्रश्न हैं (प्रत्येक 5 अंक)।\n7. स्वच्छता एवं स्पष्ट लिखावट का विशेष ध्यान रखें।"
            : "1. All questions are compulsory.\n2. The question paper consists of 4 Sections: A, B, C, and D.\n3. Section A contains Multiple Choice Questions carrying 1 mark each.\n4. Section B contains Very Short Answer Questions carrying 2 marks each.\n5. Section C contains Short Answer Questions carrying 3 marks each.\n6. Section D contains Long Answer / Application Questions carrying 5 marks each.\n7. Neat and organized presentation is expected.";

        // Calculate Question Distribution based on total marks
        int mcqCount = Math.Max(4, (int)Math.Round(totalMarks * 0.20)); // 20%
        int mcqMarks = mcqCount * 1;

        int remainingMarks = totalMarks - mcqMarks;
        int saCount = Math.Max(2, (int)Math.Round(remainingMarks * 0.25 / 2)); // 2 marks each
        int saMarks = saCount * 2;

        remainingMarks -= saMarks;
        int la3Count = Math.Max(2, (int)Math.Round(remainingMarks * 0.40 / 3)); // 3 marks each
        int la3Marks = la3Count * 3;

        remainingMarks -= la3Marks;
        int la5Count = Math.Max(1, (int)Math.Round((double)remainingMarks / 5)); // 5 marks each
        if (la5Count * 5 + la3Marks + saMarks + mcqMarks != totalMarks)
        {
            // Adjust MCQ to exactly balance total marks
            int diff = totalMarks - (la5Count * 5 + la3Marks + saMarks + mcqMarks);
            mcqCount += diff;
            if (mcqCount < 1) mcqCount = 1;
            mcqMarks = mcqCount * 1;
        }

        var sections = new List<QuestionSectionDto>();
        int qCounter = 1;

        // SECTION A: MCQs
        var secAQuestions = new List<QuestionItemDto>();
        for (int i = 1; i <= mcqCount; i++)
        {
            var q = BuildAcademicMCQ(req.Subject, req.ClassName, chapters, qCounter++, i, isHindi, isBilingual);
            secAQuestions.Add(q);
        }
        sections.Add(new QuestionSectionDto(
            "Section A",
            isHindi ? "खंड 'क' — वस्तुनिष्ठ / बहुविकल्पीय प्रश्न (MCQ)" : "Section A — Objective / Multiple Choice Questions (1 Mark Each)",
            1,
            secAQuestions.Count,
            secAQuestions.Count * 1,
            secAQuestions
        ));

        // SECTION B: Very Short Answer (2 marks)
        var secBQuestions = new List<QuestionItemDto>();
        for (int i = 1; i <= saCount; i++)
        {
            var q = BuildAcademicShortQuestion(req.Subject, req.ClassName, chapters, qCounter++, 2, i, isHindi, isBilingual);
            secBQuestions.Add(q);
        }
        sections.Add(new QuestionSectionDto(
            "Section B",
            isHindi ? "खंड 'ख' — अति-लघु उत्तरीय प्रश्न (प्रत्येक 2 अंक)" : "Section B — Very Short Answer Questions (2 Marks Each)",
            2,
            secBQuestions.Count,
            secBQuestions.Count * 2,
            secBQuestions
        ));

        // SECTION C: Short Answer (3 marks)
        var secCQuestions = new List<QuestionItemDto>();
        for (int i = 1; i <= la3Count; i++)
        {
            var q = BuildAcademicShortQuestion(req.Subject, req.ClassName, chapters, qCounter++, 3, i, isHindi, isBilingual);
            secCQuestions.Add(q);
        }
        sections.Add(new QuestionSectionDto(
            "Section C",
            isHindi ? "खंड 'ग' — लघु उत्तरीय प्रश्न (प्रत्येक 3 अंक)" : "Section C — Short Answer Questions (3 Marks Each)",
            3,
            secCQuestions.Count,
            secCQuestions.Count * 3,
            secCQuestions
        ));

        // SECTION D: Long Answer / HOTS / Case Study (5 marks)
        var secDQuestions = new List<QuestionItemDto>();
        for (int i = 1; i <= la5Count; i++)
        {
            var q = BuildAcademicLongQuestion(req.Subject, req.ClassName, chapters, qCounter++, 5, i, isHindi, isBilingual);
            secDQuestions.Add(q);
        }
        sections.Add(new QuestionSectionDto(
            "Section D",
            isHindi ? "खंड 'घ' — दीर्घ उत्तरीय / केस स्टडी प्रश्न (प्रत्येक 5 अंक)" : "Section D — Long Answer / Case Study Questions (5 Marks Each)",
            5,
            secDQuestions.Count,
            secDQuestions.Count * 5,
            secDQuestions
        ));

        // Build Marking Scheme Summary
        var markingSchemeLines = new List<string>();
        foreach (var sec in sections)
        {
            markingSchemeLines.Add($"=== {sec.SectionName}: {sec.SectionTitle} ===");
            foreach (var q in sec.Questions)
            {
                markingSchemeLines.Add($"Q{q.QuestionNumber} [{q.Marks} Mark(s)]: Answer: {q.CorrectAnswerOrKey} | Steps: {q.StepWiseExplanation}");
            }
        }

        return new SynthesizedPaperResult
        {
            GeneralInstructions = instructions,
            Sections = sections,
            MarkingSchemeJson = string.Join("\n", markingSchemeLines)
        };
    }

    private QuestionItemDto BuildAcademicMCQ(string subject, string className, string chapters, int qNum, int idx, bool isHindi, bool isBilingual)
    {
        string subLower = subject.ToLowerInvariant();
        var chList = (chapters ?? string.Empty)
            .Split(new[] { ',', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(s => s.Trim())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToList();

        string currentTopic = chList.Count > 0 ? chList[(idx - 1) % chList.Count] : subject;

        if (subLower.Contains("math"))
        {
            if (idx % 3 == 1)
            {
                return new QuestionItemDto(
                    QuestionNumber: qNum,
                    QuestionTextEn: $"If the discriminant of quadratic equation ax² + bx + c = 0 is greater than zero (D > 0), then the nature of its roots is:",
                    QuestionTextHi: isBilingual || isHindi ? "यदि द्विघात समीकरण ax² + bx + c = 0 का विविक्तकर शून्य से बड़ा है (D > 0), तो इसके मूलों की प्रकृति होगी:" : null,
                    Marks: 1,
                    QuestionType: "MCQ",
                    OptionsEn: new List<string> { "Real and Distinct", "Real and Equal", "No Real Roots", "Imaginary" },
                    OptionsHi: isBilingual || isHindi ? new List<string> { "वास्तविक और असमान", "वास्तविक और समान", "कोई वास्तविक मूल नहीं", "काल्पनिक" } : null,
                    CorrectAnswerOrKey: "Option (A): Real and Distinct",
                    StepWiseExplanation: "Since D = b² - 4ac > 0, the quadratic formula yields two distinct real values."
                );
            }
            else if (idx % 3 == 2)
            {
                return new QuestionItemDto(
                    QuestionNumber: qNum,
                    QuestionTextEn: $"The common difference of the arithmetic progression (A.P.): 3, 7, 11, 15, ... is:",
                    QuestionTextHi: isBilingual || isHindi ? "समानांतर श्रेणी (A.P.): 3, 7, 11, 15, ... का सार्व अंतर (d) क्या होगा?" : null,
                    Marks: 1,
                    QuestionType: "MCQ",
                    OptionsEn: new List<string> { "4", "3", "7", "-4" },
                    OptionsHi: isBilingual || isHindi ? new List<string> { "4", "3", "7", "-4" } : null,
                    CorrectAnswerOrKey: "Option (A): 4",
                    StepWiseExplanation: "Common difference d = a₂ - a₁ = 7 - 3 = 4."
                );
            }
            else
            {
                return new QuestionItemDto(
                    QuestionNumber: qNum,
                    QuestionTextEn: $"The distance of the point P(3, 4) from the origin (0, 0) is:",
                    QuestionTextHi: isBilingual || isHindi ? "मूल बिंदु (0, 0) से बिंदु P(3, 4) की दूरी क्या होगी?" : null,
                    Marks: 1,
                    QuestionType: "MCQ",
                    OptionsEn: new List<string> { "5 units", "7 units", "1 unit", "25 units" },
                    OptionsHi: isBilingual || isHindi ? new List<string> { "5 मात्रक", "7 मात्रक", "1 मात्रक", "25 मात्रक" } : null,
                    CorrectAnswerOrKey: "Option (A): 5 units",
                    StepWiseExplanation: "Distance = √(x² + y²) = √(3² + 4²) = √(9 + 16) = √25 = 5."
                );
            }
        }
        else if (subLower.Contains("sci") || subLower.Contains("phys") || subLower.Contains("chem") || subLower.Contains("bio"))
        {
            if (idx % 3 == 1)
            {
                return new QuestionItemDto(
                    QuestionNumber: qNum,
                    QuestionTextEn: $"Which cellular organelle is universally referred to as the 'Powerhouse of the Cell'?",
                    QuestionTextHi: isBilingual || isHindi ? "किस कोशिकांग को सर्वमान्य रूप से 'कोशिका का पावरहाउस' कहा जाता है?" : null,
                    Marks: 1,
                    QuestionType: "MCQ",
                    OptionsEn: new List<string> { "Ribosome", "Mitochondria", "Golgi Body", "Chloroplast" },
                    OptionsHi: isBilingual || isHindi ? new List<string> { "राइबोसोम", "माइटोकॉन्ड्रिया", "गॉल्जी काय", "हरित लवक" } : null,
                    CorrectAnswerOrKey: "Option (B): Mitochondria",
                    StepWiseExplanation: "Mitochondria synthesizes ATP through cellular respiration, powering cellular activities."
                );
            }
            else if (idx % 3 == 2)
            {
                return new QuestionItemDto(
                    QuestionNumber: qNum,
                    QuestionTextEn: $"What is the SI unit of Electric Potential Difference (Voltage)?",
                    QuestionTextHi: isBilingual || isHindi ? "विद्युत विभवान्तर (Voltage) का SI मात्रक क्या है?" : null,
                    Marks: 1,
                    QuestionType: "MCQ",
                    OptionsEn: new List<string> { "Volt (V)", "Ampere (A)", "Ohm (Ω)", "Joule (J)" },
                    OptionsHi: isBilingual || isHindi ? new List<string> { "वोल्ट (V)", "एम्पीयर (A)", "ओम (Ω)", "जूल (J)" } : null,
                    CorrectAnswerOrKey: "Option (A): Volt (V)",
                    StepWiseExplanation: "Electric potential difference is measured in Volts (V), defined as Joules per Coulomb."
                );
            }
            else
            {
                return new QuestionItemDto(
                    QuestionNumber: qNum,
                    QuestionTextEn: $"The pH of pure distilled water at 25°C is exactly:",
                    QuestionTextHi: isBilingual || isHindi ? "25°C तापमान पर शुद्ध आसुत जल का pH मान कितना होता है?" : null,
                    Marks: 1,
                    QuestionType: "MCQ",
                    OptionsEn: new List<string> { "7 (Neutral)", "0 (Acidic)", "14 (Basic)", "5.6 (Slightly Acidic)" },
                    OptionsHi: isBilingual || isHindi ? new List<string> { "7 (उदासीन)", "0 (अम्लीय)", "14 (क्षारीय)", "5.6 (हल्का अम्लीय)" } : null,
                    CorrectAnswerOrKey: "Option (A): 7 (Neutral)",
                    StepWiseExplanation: "Pure neutral water has equal concentrations of H⁺ and OH⁻ ions resulting in pH 7."
                );
            }
        }
        else if (subLower.Contains("hind") || subLower.Contains("sanskrit"))
        {
            if (idx % 2 == 1)
            {
                return new QuestionItemDto(
                    QuestionNumber: qNum,
                    QuestionTextEn: $"In grammar, which type of compound (Samas) is represented by 'Rajputra' (Son of King)?",
                    QuestionTextHi: "'राजपुत्र' (राजा का पुत्र) सामासिक पद में कौन सा समास प्रयुक्त हुआ है?",
                    Marks: 1,
                    QuestionType: "MCQ",
                    OptionsEn: new List<string> { "Avyayibhav", "Tatpurush", "Dvandva", "Bahuvrihi" },
                    OptionsHi: new List<string> { "अव्ययीभाव समास", "तत्पुरुष समास", "द्वंद्व समास", "बहुव्रीहि समास" },
                    CorrectAnswerOrKey: "विकल्प (B): तत्पुरुष समास",
                    StepWiseExplanation: "जिस समास में उत्तर पद प्रधान हो तथा कारक चिन्ह (का, की, के) का लोप हो, उसे तत्पुरुष समास कहते हैं।"
                );
            }
            else
            {
                return new QuestionItemDto(
                    QuestionNumber: qNum,
                    QuestionTextEn: "Identify the correct Sandhi Viched of 'Suryoday':",
                    QuestionTextHi: "'सूर्योदय' शब्द का सही संधि-विच्छेद क्या होगा?",
                    Marks: 1,
                    QuestionType: "MCQ",
                    OptionsEn: new List<string> { "Surya + Uday", "Sur + Uday", "Suryo + Day", "Surya + Oday" },
                    OptionsHi: new List<string> { "सूर्य + उदय", "सुर + उदय", "सूर्यो + दय", "सूर्य + ओदय" },
                    CorrectAnswerOrKey: "विकल्प (A): सूर्य + उदय",
                    StepWiseExplanation: "अ/आ + उ = ओ (गुण स्वर संधि का नियम)।"
                );
            }
        }
        else
        {
            // Dynamic Subject Generation tailored to actual subject name and syllabus topic
            int variant = (idx % 3);
            if (variant == 1)
            {
                return new QuestionItemDto(
                    QuestionNumber: qNum,
                    QuestionTextEn: $"In {subject}, which of the following is considered a primary foundational rule/principle in '{currentTopic}'?",
                    QuestionTextHi: isBilingual || isHindi ? $"{subject} के अंतर्गत '{currentTopic}' में निम्नलिखित में से कौन सा प्रमुख मूलभूत सिद्धांत है?" : null,
                    Marks: 1,
                    QuestionType: "MCQ",
                    OptionsEn: new List<string> { "Primary Foundational Axiom", "Secondary Hypothesis", "Variable Correlation", "Arbitrary Assumption" },
                    OptionsHi: isBilingual || isHindi ? new List<string> { "प्राथमिक आधारभूत सिद्धांत", "द्वितीयक परिकल्पना", "परिवर्तनीय सहसंबंध", "ऐच्छिक अनुमान" } : null,
                    CorrectAnswerOrKey: "Option (A): Primary Foundational Axiom",
                    StepWiseExplanation: $"Core concept of {currentTopic} under {subject} curriculum."
                );
            }
            else if (variant == 2)
            {
                return new QuestionItemDto(
                    QuestionNumber: qNum,
                    QuestionTextEn: $"Regarding the application of '{currentTopic}' in {subject}, what is the main objective or outcome?",
                    QuestionTextHi: isBilingual || isHindi ? $"{subject} में '{currentTopic}' के व्यावहारिक अनुप्रयोग का मुख्य उद्देश्य क्या है?" : null,
                    Marks: 1,
                    QuestionType: "MCQ",
                    OptionsEn: new List<string> { "Systematic Analysis & Precision", "Qualitative Generalization", "Random Sampling", "Unverified Estimation" },
                    OptionsHi: isBilingual || isHindi ? new List<string> { "व्यवस्थित विश्लेषण एवं शुद्धता", "गुणात्मक सामान्यीकरण", "यादृच्छिक प्रतिचयन", "अपरीक्षित अनुमान" } : null,
                    CorrectAnswerOrKey: "Option (A): Systematic Analysis & Precision",
                    StepWiseExplanation: $"Essential practical competency for '{currentTopic}' in {className} curriculum."
                );
            }
            else
            {
                return new QuestionItemDto(
                    QuestionNumber: qNum,
                    QuestionTextEn: $"Which tool, methodology, or notation is standardly used when studying '{currentTopic}' in {subject}?",
                    QuestionTextHi: isBilingual || isHindi ? $"{subject} में '{currentTopic}' के अध्ययन हेतु कौन सी प्रामाणिक विधि अथवा उपकरण उपयोगी है?" : null,
                    Marks: 1,
                    QuestionType: "MCQ",
                    OptionsEn: new List<string> { "Standardized Analytical Method", "Subjective Opinion", "Casual Observation", "None of the above" },
                    OptionsHi: isBilingual || isHindi ? new List<string> { "मानकीकृत विश्लेषणात्मक पद्धति", "व्यक्तिगत दृष्टिकोण", "अनौपचारिक अवलोकन", "इनमें से कोई नहीं" } : null,
                    CorrectAnswerOrKey: "Option (A): Standardized Analytical Method",
                    StepWiseExplanation: $"Standard academic evaluation methodology for {subject}."
                );
            }
        }
    }

    private QuestionItemDto BuildAcademicShortQuestion(string subject, string className, string chapters, int qNum, int marks, int idx, bool isHindi, bool isBilingual)
    {
        string subLower = subject.ToLowerInvariant();
        var chList = (chapters ?? string.Empty)
            .Split(new[] { ',', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(s => s.Trim())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToList();

        string currentTopic = chList.Count > 0 ? chList[(idx - 1) % chList.Count] : subject;

        if (subLower.Contains("math"))
        {
            if (idx % 2 == 1)
            {
                return new QuestionItemDto(
                    QuestionNumber: qNum,
                    QuestionTextEn: $"Find the roots of the quadratic equation 2x² - 7x + 3 = 0 using the method of factorization.",
                    QuestionTextHi: isBilingual || isHindi ? "गुणनखंड विधि द्वारा द्विघात समीकरण 2x² - 7x + 3 = 0 के मूल ज्ञात कीजिए।" : null,
                    Marks: marks,
                    QuestionType: marks == 2 ? "VeryShort" : "Short",
                    OptionsEn: null,
                    OptionsHi: null,
                    CorrectAnswerOrKey: "Roots: x = 3, x = 1/2",
                    StepWiseExplanation: "2x² - 6x - x + 3 = 0 => 2x(x - 3) - 1(x - 3) = 0 => (2x - 1)(x - 3) = 0. Therefore x = 1/2 or x = 3."
                );
            }
            else
            {
                return new QuestionItemDto(
                    QuestionNumber: qNum,
                    QuestionTextEn: $"Evaluate the value of: sin² 30° + cos² 30° + tan 45°.",
                    QuestionTextHi: isBilingual || isHindi ? "मान ज्ञात कीजिए: sin² 30° + cos² 30° + tan 45°" : null,
                    Marks: marks,
                    QuestionType: marks == 2 ? "VeryShort" : "Short",
                    OptionsEn: null,
                    OptionsHi: null,
                    CorrectAnswerOrKey: "Result = 2",
                    StepWiseExplanation: "Since sin² θ + cos² θ = 1, we have 1 + tan 45° = 1 + 1 = 2."
                );
            }
        }
        else if (subLower.Contains("sci"))
        {
            if (idx % 2 == 1)
            {
                return new QuestionItemDto(
                    QuestionNumber: qNum,
                    QuestionTextEn: $"State Ohm's Law. Write the mathematical formula relating Voltage (V), Current (I), and Resistance (R).",
                    QuestionTextHi: isBilingual || isHindi ? "ओम का नियम लिखिए। वोल्टेज (V), विद्युत धारा (I) तथा प्रतिरोध (R) के मध्य गणितीय सूत्र लिखिए।" : null,
                    Marks: marks,
                    QuestionType: marks == 2 ? "VeryShort" : "Short",
                    OptionsEn: null,
                    OptionsHi: null,
                    CorrectAnswerOrKey: "V = I * R at constant physical conditions.",
                    StepWiseExplanation: "Statement of law (1 mark). Mathematical formula V = IR and unit definition (1 mark)."
                );
            }
            else
            {
                return new QuestionItemDto(
                    QuestionNumber: qNum,
                    QuestionTextEn: $"Differentiate between Aerobic and Anaerobic respiration with one balanced example.",
                    QuestionTextHi: isBilingual || isHindi ? "वायवीय (ऑक्सी) तथा अवायवीय (अनॉक्सी) श्वसन में सोदाहरण अंतर स्पष्ट कीजिए।" : null,
                    Marks: marks,
                    QuestionType: marks == 2 ? "VeryShort" : "Short",
                    OptionsEn: null,
                    OptionsHi: null,
                    CorrectAnswerOrKey: "Aerobic uses oxygen (produces CO2, H2O, 38 ATP); Anaerobic occurs without oxygen.",
                    StepWiseExplanation: "1 point for oxygen dependency, 1 point for end products and energy yield comparison."
                );
            }
        }
        else
        {
            return new QuestionItemDto(
                QuestionNumber: qNum,
                QuestionTextEn: $"Explain the significance and main characteristics of '{currentTopic}' in {subject}. Provide two illustrative examples.",
                QuestionTextHi: isBilingual || isHindi ? $"{subject} के अंतर्गत '{currentTopic}' के महत्व एवं मुख्य विशेषताओं को स्पष्ट कीजिए तथा दो उपयुक्त उदाहरण दीजिए।" : null,
                Marks: marks,
                QuestionType: marks == 2 ? "VeryShort" : "Short",
                OptionsEn: null,
                OptionsHi: null,
                CorrectAnswerOrKey: "Core definition with two verified practical examples.",
                StepWiseExplanation: $"Accurate definition/context of {currentTopic} (1 mark), Two illustrative examples (1 mark each)."
            );
        }
    }

    private QuestionItemDto BuildAcademicLongQuestion(string subject, string className, string chapters, int qNum, int marks, int idx, bool isHindi, bool isBilingual)
    {
        string subLower = subject.ToLowerInvariant();
        var chList = (chapters ?? string.Empty)
            .Split(new[] { ',', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(s => s.Trim())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToList();

        string currentTopic = chList.Count > 0 ? chList[(idx - 1) % chList.Count] : subject;

        if (subLower.Contains("math"))
        {
            return new QuestionItemDto(
                QuestionNumber: qNum,
                QuestionTextEn: $"State and prove the Basic Proportionality Theorem (Thales' Theorem). Using this theorem, in triangle ABC if DE || BC, AD = 2.4 cm, DB = 3.6 cm, AE = 2 cm, find the value of EC.",
                QuestionTextHi: isBilingual || isHindi ? "आधारभूत आनुपातिकता प्रमेय (थेल्स प्रमेय) का कथन लिखकर सिद्ध कीजिए। इसकी सहायता से, त्रिभुज ABC में यदि DE || BC, AD = 2.4 सेमी, DB = 3.6 सेमी, AE = 2 सेमी हो, तो EC का मान ज्ञात कीजिए।" : null,
                Marks: 5,
                QuestionType: "Long",
                OptionsEn: null,
                OptionsHi: null,
                CorrectAnswerOrKey: "Theorem Statement (1m) + Geometric Construction & Proof (3m) + Numerical Solution EC = 3.0 cm (1m).",
                StepWiseExplanation: "By BPT: AD/DB = AE/EC => 2.4/3.6 = 2/EC => 2/3 = 2/EC => EC = 3.0 cm."
            );
        }
        else
        {
            return new QuestionItemDto(
                QuestionNumber: qNum,
                QuestionTextEn: $"Provide a comprehensive analytical explanation of '{currentTopic}' in {subject}. Detail its core mechanism, practical applications in modern society, and critical challenges with diagrams where applicable.",
                QuestionTextHi: isBilingual || isHindi ? $"{subject} के पाठ्यक्रम में '{currentTopic}' की एक विस्तृत विश्लेषणात्मक समीक्षा प्रस्तुत कीजिए। इसके सैद्धांतिक आधार, व्यावहारिक अनुप्रयोगों तथा चुनौतियों की सोदाहरण व्याख्या कीजिए।" : null,
                Marks: 5,
                QuestionType: "Long",
                OptionsEn: null,
                OptionsHi: null,
                CorrectAnswerOrKey: "Structured 5-point comprehensive response with labeled diagram or detailed derivation.",
                StepWiseExplanation: $"1. Conceptual Introduction (1m), 2. Working Mechanism/Analysis of {currentTopic} (2m), 3. Real-world Applications (1m), 4. Conclusion & Critical Insights (1m)."
            );
        }
    }

    private class SynthesizedLessonPlanResult
    {
        public string LearningObjectives { get; set; } = string.Empty;
        public string TeachingAidsAndResources { get; set; } = string.Empty;
        public List<LessonPeriodItemDto> Periods { get; set; } = new();
        public string FormativeAssessmentQuestions { get; set; } = string.Empty;
        public string HomeworkAndWorksheetAssignment { get; set; } = string.Empty;
    }

    private SynthesizedNEPLessonPlanResult SynthesizeNEP2020LessonPlan(GenerateAiLessonPlanRequestDto req)
    {
        int periods = req.TotalPeriods > 0 ? req.TotalPeriods : 4;
        string topic = req.TopicOrChapter.Trim();

        var periodItems = new List<LessonPeriodItemDto>();

        // 5E NEP 2020 Pedagogical Stages
        string[] phases = { "Engage (संबद्धता)", "Explore (अन्वेषण)", "Explain (स्पष्टीकरण)", "Elaborate (विस्तारीकरण)", "Evaluate (मूल्यांकन)" };

        for (int p = 1; p <= periods; p++)
        {
            string phase = phases[(p - 1) % phases.Length];
            periodItems.Add(new LessonPeriodItemDto(
                PeriodNumber: p,
                PhaseName: phase,
                KeyConcept: $"Core Foundation & Problem Solving for {topic} (Part {p})",
                TeacherAction: $"Facilitate discussion, present real-world triggers related to {topic}, guide inquiry and clarify core misconceptions.",
                StudentActivity: $"Collaborative peer group activity, solve diagnostic questions on smartboard, and maintain concept journal notes.",
                TeachingAidsUsed: "Interactive Smartboard, Curricular Charts, Concrete Models / Flashcards, Digital Visuals",
                AssessmentCheck: $"Quick 2-minute exit slip quiz: Explain 1 key takeaway and solve 1 application problem on {topic}."
            ));
        }

        string learningObjectives =
            $"1. Cognitive (ज्ञान): Students will define and state the fundamental principles of {topic} with 100% accuracy.\n" +
            $"2. Comprehension (अवबोध): Students will explain the underlying mechanism and differentiate related sub-concepts.\n" +
            $"3. Application (अनुप्रयोग): Students will apply learned rules to solve real-world problems and board-pattern questions independently.\n" +
            $"4. NEP 2020 Competency: Develop critical thinking, inquiry-driven curiosity, and experiential learning habits.";

        string teachingAids = "Digital Smartboard & 3D Interactive Visualizer, CBSE/State Board Prescribed Textbook, Peer Group Worksheets, Demonstration Lab Kit";

        string formativeAssessment =
            $"1. Diagnostic Check: What prerequisite knowledge is required to understand {topic}?\n" +
            $"2. Mid-Lesson Check: Why does this formula/principle work under given conditions?\n" +
            $"3. Exit Slip Question: Solve one conceptual numerical or critical reasoning problem before period dismissal.";

        string homework =
            $"1. Solve Exercise questions 1 to 5 from prescribed textbook.\n" +
            $"2. Prepare a 1-page mind map / visual summary diagram for {topic}.\n" +
            $"3. Differentiated Homework: Advanced learners solve 2 HOTS (Higher Order Thinking Skills) problems; struggling learners complete guided step-by-step worksheet.";

        return new SynthesizedNEPLessonPlanResult
        {
            LearningObjectives = learningObjectives,
            TeachingAidsAndResources = teachingAids,
            Periods = periodItems,
            FormativeAssessmentQuestions = formativeAssessment,
            HomeworkAndWorksheetAssignment = homework
        };
    }

    private class SynthesizedNEPLessonPlanResult
    {
        public string LearningObjectives { get; set; } = string.Empty;
        public string TeachingAidsAndResources { get; set; } = string.Empty;
        public List<LessonPeriodItemDto> Periods { get; set; } = new();
        public string FormativeAssessmentQuestions { get; set; } = string.Empty;
        public string HomeworkAndWorksheetAssignment { get; set; } = string.Empty;
    }
}
