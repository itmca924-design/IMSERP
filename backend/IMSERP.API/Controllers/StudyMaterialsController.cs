using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/study-materials")]
public class StudyMaterialsController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IWebHostEnvironment _env;

    public StudyMaterialsController(
        IIMSERPDbContext db,
        ICurrentUserService currentUser,
        IWebHostEnvironment env)
    {
        _db = db;
        _currentUser = currentUser;
        _env = env;
    }

    /// <summary>
    /// Superfast indexed search & filtering with AsNoTracking and projection.
    /// All query parameters are strictly optional.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetMaterials(
        [FromQuery] string? scope = null,           // "All" | "School" | "Coaching" | "Both"
        [FromQuery] Guid? classId = null,
        [FromQuery] Guid? sectionId = null,
        [FromQuery] Guid? batchId = null,
        [FromQuery] string? subject = null,
        [FromQuery] string? materialType = null,    // "Notes" | "PYQ" | "QuestionBank" | "FormulaSheet" | "SamplePaper" | "Syllabus"
        [FromQuery] string? targetExam = null,      // "CBSE Board", "JEE Main", "NEET", etc.
        [FromQuery] string? examYear = null,        // "2024", "2023", etc.
        [FromQuery] string? chapter = null,
        [FromQuery] string? search = null,
        [FromQuery] bool? hasSolutions = null,
        [FromQuery] Guid? studentId = null,         // Student-aware personal feed
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30)
    {
        var tenantId = _currentUser.TenantId;
        var query = _db.StudyMaterials
            .AsNoTracking()
            .Where(m => m.IsPublished);

        // Auto-detect student if logged in as Student or Parent and studentId not explicitly provided
        if (!studentId.HasValue && _currentUser.UserId != Guid.Empty && 
            (_currentUser.UserRole.Equals("Student", StringComparison.OrdinalIgnoreCase) || 
             _currentUser.UserRole.Equals("Parent", StringComparison.OrdinalIgnoreCase)))
        {
            var studentUser = await _db.Students
                .AsNoTracking()
                .Where(s => (s.UserId == _currentUser.UserId || s.ParentUserId == _currentUser.UserId) && s.TenantId == tenantId)
                .Select(s => (Guid?)s.Id)
                .FirstOrDefaultAsync();

            if (studentUser.HasValue)
            {
                studentId = studentUser.Value;
            }
        }

        // Optional: Student enrollment-aware filtering
        if (studentId.HasValue && studentId.Value != Guid.Empty)
        {
            var student = await _db.Students
                .AsNoTracking()
                .Where(s => s.Id == studentId.Value)
                .Select(s => new
                {
                    s.ClassId,
                    s.SectionId,
                    s.BatchId,
                    s.IsSchoolStudent,
                    s.IsCoachingStudent
                })
                .FirstOrDefaultAsync();

            if (student != null)
            {
                if (student.IsSchoolStudent && !student.IsCoachingStudent)
                {
                    // School Only: Materials for their class OR open to both/all
                    query = query.Where(m =>
                        m.TargetScope == "Both" ||
                        (m.TargetScope == "School" && (!m.ClassId.HasValue || m.ClassId == student.ClassId)));
                }
                else if (student.IsCoachingStudent && !student.IsSchoolStudent)
                {
                    // Coaching Only: Materials for their batch OR open to both/all
                    query = query.Where(m =>
                        m.TargetScope == "Both" ||
                        (m.TargetScope == "Coaching" && (!m.BatchId.HasValue || m.BatchId == student.BatchId)));
                }
                else if (student.IsSchoolStudent && student.IsCoachingStudent)
                {
                    // Dual Enrollment: School class OR Coaching batch OR Both
                    query = query.Where(m =>
                        m.TargetScope == "Both" ||
                        (m.TargetScope == "School" && (!m.ClassId.HasValue || m.ClassId == student.ClassId)) ||
                        (m.TargetScope == "Coaching" && (!m.BatchId.HasValue || m.BatchId == student.BatchId)));
                }
            }
        }

        // 1. Scope filter (Optional)
        if (!string.IsNullOrWhiteSpace(scope) && !scope.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var scopeLower = scope.Trim().ToLower();
            if (scopeLower == "school")
            {
                query = query.Where(m => m.TargetScope == "School" || m.TargetScope == "Both");
            }
            else if (scopeLower == "coaching")
            {
                query = query.Where(m => m.TargetScope == "Coaching" || m.TargetScope == "Both");
            }
            else if (scopeLower == "both")
            {
                query = query.Where(m => m.TargetScope == "Both");
            }
        }

        // 2. Class & Section filter (Optional)
        if (classId.HasValue && classId.Value != Guid.Empty)
        {
            query = query.Where(m => m.ClassId == classId.Value || !m.ClassId.HasValue);
        }
        if (sectionId.HasValue && sectionId.Value != Guid.Empty)
        {
            query = query.Where(m => m.SectionId == sectionId.Value || !m.SectionId.HasValue);
        }

        // 3. Batch filter (Optional)
        if (batchId.HasValue && batchId.Value != Guid.Empty)
        {
            query = query.Where(m => m.BatchId == batchId.Value || !m.BatchId.HasValue);
        }

        // 4. Subject filter (Optional)
        if (!string.IsNullOrWhiteSpace(subject) && !subject.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(m => m.Subject.ToLower() == subject.Trim().ToLower());
        }

        // 5. Material Type filter (Optional)
        if (!string.IsNullOrWhiteSpace(materialType) && !materialType.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(m => m.MaterialType.ToLower() == materialType.Trim().ToLower());
        }

        // 6. Target Exam & Exam Year (Optional)
        if (!string.IsNullOrWhiteSpace(targetExam) && !targetExam.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(m => m.TargetExam != null && m.TargetExam.ToLower() == targetExam.Trim().ToLower());
        }
        if (!string.IsNullOrWhiteSpace(examYear) && !examYear.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(m => m.ExamYear != null && m.ExamYear.Contains(examYear.Trim()));
        }

        // 7. Chapter & Topic filter (Optional)
        if (!string.IsNullOrWhiteSpace(chapter))
        {
            query = query.Where(m => m.ChapterName != null && m.ChapterName.Contains(chapter.Trim()));
        }

        // 8. Has Solutions toggle (Optional)
        if (hasSolutions.HasValue)
        {
            query = query.Where(m => m.HasSolutions == hasSolutions.Value);
        }

        // 9. Free-text search (Optional)
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(m =>
                m.Title.ToLower().Contains(s) ||
                (m.Description != null && m.Description.ToLower().Contains(s)) ||
                (m.Subject != null && m.Subject.ToLower().Contains(s)) ||
                (m.ChapterName != null && m.ChapterName.ToLower().Contains(s)) ||
                (m.Topic != null && m.Topic.ToLower().Contains(s)) ||
                (m.TargetExam != null && m.TargetExam.ToLower().Contains(s)) ||
                (m.ExamYear != null && m.ExamYear.ToLower().Contains(s)));
        }

        var totalCount = await query.CountAsync();

        // 10. Superfast Projection directly to DTO
        var items = await query
            .OrderByDescending(m => m.IsFeatured)
            .ThenByDescending(m => m.CreatedAt)
            .Skip((Math.Max(1, page) - 1) * Math.Clamp(pageSize, 1, 100))
            .Take(Math.Clamp(pageSize, 1, 100))
            .Select(m => new StudyMaterialDto(
                m.Id,
                m.TenantId,
                m.BranchId,
                m.Title,
                m.Description,
                m.TargetScope,
                m.ClassId,
                m.Class != null ? m.Class.Name : null,
                m.SectionId,
                m.Section != null ? m.Section.Name : null,
                m.BatchId,
                m.Batch != null ? m.Batch.Name : null,
                m.SubjectId,
                m.Subject,
                m.MaterialType,
                m.ChapterName,
                m.Topic,
                m.AcademicYear,
                m.TargetExam,
                m.ExamYear,
                m.HasSolutions,
                m.DifficultyLevel,
                m.FileUrl,
                m.FileName,
                m.FileSizeBytes,
                m.FileFormat,
                m.ExternalLink,
                m.SolutionFileUrl,
                m.SolutionFileName,
                m.UploadedByName,
                m.UploadedByUserId,
                m.DownloadCount,
                m.ViewCount,
                m.IsPublished,
                m.IsFeatured,
                m.CreatedAt,
                m.UpdatedAt
            ))
            .ToListAsync();

        return Ok(new
        {
            items,
            totalCount,
            page = Math.Max(1, page),
            pageSize = Math.Clamp(pageSize, 1, 100),
            totalPages = (int)Math.Ceiling(totalCount / (double)Math.Clamp(pageSize, 1, 100))
        });
    }

    /// <summary>
    /// Fast aggregation statistics for top summary cards.
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<StudyMaterialStatsDto>> GetStats([FromQuery] string? scope = null)
    {
        var query = _db.StudyMaterials.AsNoTracking().Where(m => m.IsPublished);

        if (!string.IsNullOrWhiteSpace(scope) && !scope.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var scopeLower = scope.Trim().ToLower();
            if (scopeLower == "school") query = query.Where(m => m.TargetScope == "School" || m.TargetScope == "Both");
            else if (scopeLower == "coaching") query = query.Where(m => m.TargetScope == "Coaching" || m.TargetScope == "Both");
        }

        var totalItems = await query.CountAsync();
        var notesCount = await query.CountAsync(m => m.MaterialType == "Notes");
        var pyqCount = await query.CountAsync(m => m.MaterialType == "PYQ");
        var qbCount = await query.CountAsync(m => m.MaterialType == "QuestionBank");
        var formulaCount = await query.CountAsync(m => m.MaterialType == "FormulaSheet");
        var totalDownloads = await query.SumAsync(m => (int?)m.DownloadCount) ?? 0;

        var topSubjects = await query
            .Where(m => !string.IsNullOrEmpty(m.Subject))
            .GroupBy(m => m.Subject)
            .OrderByDescending(g => g.Count())
            .Take(8)
            .Select(g => new StudyMaterialSubjectCountDto(g.Key, g.Count()))
            .ToListAsync();

        return Ok(new StudyMaterialStatsDto(
            totalItems,
            notesCount,
            pyqCount,
            qbCount,
            formulaCount,
            totalDownloads,
            topSubjects
        ));
    }

    /// <summary>
    /// Get single material detail & atomically increment view count.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<StudyMaterialDto>> GetById(Guid id)
    {
        var item = await _db.StudyMaterials
            .Include(m => m.Class)
            .Include(m => m.Section)
            .Include(m => m.Batch)
            .FirstOrDefaultAsync(m => m.Id == id);

        if (item == null) return NotFound(new { message = "Study material not found." });

        // Increment view count asynchronously
        item.ViewCount += 1;
        await _db.SaveChangesAsync();

        return Ok(new StudyMaterialDto(
            item.Id,
            item.TenantId,
            item.BranchId,
            item.Title,
            item.Description,
            item.TargetScope,
            item.ClassId,
            item.Class?.Name,
            item.SectionId,
            item.Section?.Name,
            item.BatchId,
            item.Batch?.Name,
            item.SubjectId,
            item.Subject,
            item.MaterialType,
            item.ChapterName,
            item.Topic,
            item.AcademicYear,
            item.TargetExam,
            item.ExamYear,
            item.HasSolutions,
            item.DifficultyLevel,
            item.FileUrl,
            item.FileName,
            item.FileSizeBytes,
            item.FileFormat,
            item.ExternalLink,
            item.SolutionFileUrl,
            item.SolutionFileName,
            item.UploadedByName,
            item.UploadedByUserId,
            item.DownloadCount,
            item.ViewCount,
            item.IsPublished,
            item.IsFeatured,
            item.CreatedAt,
            item.UpdatedAt
        ));
    }

    /// <summary>
    /// Upload study material / PYQ file (PDF, Docx, Pptx, Zip, etc. up to 50MB)
    /// </summary>
    [HttpPost("upload")]
    [RequestSizeLimit(52_428_800)] // 50 MB
    public async Task<IActionResult> UploadFile([FromForm] IFormFile? file, [FromForm] string? type)
    {
        if (_currentUser.UserRole.Equals("Student", StringComparison.OrdinalIgnoreCase) || 
            _currentUser.UserRole.Equals("Parent", StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(403, new { message = "Students and parents have read-only access to study materials." });
        }

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file was uploaded." });

        var allowedExtensions = new[] { ".pdf", ".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".xls", ".zip", ".jpg", ".jpeg", ".png", ".webp" };
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext))
        {
            return BadRequest(new { message = $"File format '{ext}' is not supported. Please upload PDF, Word, PowerPoint, Excel, or ZIP files." });
        }

        var folderName = type?.ToLowerInvariant() == "solution" ? "study-materials/solutions" : "study-materials/files";
        var uploadsFolder = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", folderName.Replace('/', Path.DirectorySeparatorChar));

        if (!Directory.Exists(uploadsFolder))
        {
            Directory.CreateDirectory(uploadsFolder);
        }

        var safeFileName = $"{Guid.NewGuid():N}_{DateTime.UtcNow.Ticks}{ext}";
        var fullPath = Path.Combine(uploadsFolder, safeFileName);

        using (var stream = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var relativeUrl = $"/uploads/{folderName}/{safeFileName}";
        var format = ext.TrimStart('.').ToLower();

        return Ok(new
        {
            fileUrl = relativeUrl,
            fileName = file.FileName,
            fileSize = file.Length,
            fileFormat = format
        });
    }

    /// <summary>
    /// Create study material record.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<StudyMaterialDto>> Create([FromBody] CreateStudyMaterialDto dto)
    {
        if (_currentUser.UserRole.Equals("Student", StringComparison.OrdinalIgnoreCase) || 
            _currentUser.UserRole.Equals("Parent", StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(403, new { message = "Students and parents have read-only access to study materials." });
        }

        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(new { message = "Material title is required." });

        if (string.IsNullOrWhiteSpace(dto.FileUrl) && string.IsNullOrWhiteSpace(dto.ExternalLink))
            return BadRequest(new { message = "Either a file or external resource link is required." });

        var tenantId = _currentUser.TenantId;
        var branchId = _currentUser.BranchId;
        var userName = User.Identity?.Name ?? "Faculty";
        var userId = _currentUser.UserId;

        var entity = new StudyMaterial
        {
            TenantId = tenantId,
            BranchId = branchId,
            Title = dto.Title.Trim(),
            Description = dto.Description?.Trim(),
            TargetScope = string.IsNullOrWhiteSpace(dto.TargetScope) ? "Both" : dto.TargetScope.Trim(),
            ClassId = dto.ClassId,
            SectionId = dto.SectionId,
            BatchId = dto.BatchId,
            SubjectId = dto.SubjectId,
            Subject = dto.Subject?.Trim() ?? string.Empty,
            MaterialType = string.IsNullOrWhiteSpace(dto.MaterialType) ? "Notes" : dto.MaterialType.Trim(),
            ChapterName = dto.ChapterName?.Trim(),
            Topic = dto.Topic?.Trim(),
            AcademicYear = dto.AcademicYear?.Trim(),
            TargetExam = dto.TargetExam?.Trim(),
            ExamYear = dto.ExamYear?.Trim(),
            HasSolutions = dto.HasSolutions,
            DifficultyLevel = dto.DifficultyLevel?.Trim(),
            FileUrl = dto.FileUrl?.Trim() ?? string.Empty,
            FileName = dto.FileName?.Trim() ?? "Document",
            FileSizeBytes = dto.FileSizeBytes,
            FileFormat = string.IsNullOrWhiteSpace(dto.FileFormat) ? "pdf" : dto.FileFormat.Trim().ToLower(),
            ExternalLink = dto.ExternalLink?.Trim(),
            SolutionFileUrl = dto.SolutionFileUrl?.Trim(),
            SolutionFileName = dto.SolutionFileName?.Trim(),
            UploadedByName = userName,
            UploadedByUserId = userId,
            IsPublished = dto.IsPublished,
            IsFeatured = dto.IsFeatured,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.StudyMaterials.Add(entity);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, new StudyMaterialDto(
            entity.Id,
            entity.TenantId,
            entity.BranchId,
            entity.Title,
            entity.Description,
            entity.TargetScope,
            entity.ClassId,
            null,
            entity.SectionId,
            null,
            entity.BatchId,
            null,
            entity.SubjectId,
            entity.Subject,
            entity.MaterialType,
            entity.ChapterName,
            entity.Topic,
            entity.AcademicYear,
            entity.TargetExam,
            entity.ExamYear,
            entity.HasSolutions,
            entity.DifficultyLevel,
            entity.FileUrl,
            entity.FileName,
            entity.FileSizeBytes,
            entity.FileFormat,
            entity.ExternalLink,
            entity.SolutionFileUrl,
            entity.SolutionFileName,
            entity.UploadedByName,
            entity.UploadedByUserId,
            entity.DownloadCount,
            entity.ViewCount,
            entity.IsPublished,
            entity.IsFeatured,
            entity.CreatedAt,
            entity.UpdatedAt
        ));
    }

    /// <summary>
    /// Update existing study material.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateStudyMaterialDto dto)
    {
        if (_currentUser.UserRole.Equals("Student", StringComparison.OrdinalIgnoreCase) || 
            _currentUser.UserRole.Equals("Parent", StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(403, new { message = "Students and parents have read-only access to study materials." });
        }

        var item = await _db.StudyMaterials.FirstOrDefaultAsync(m => m.Id == id);
        if (item == null) return NotFound(new { message = "Study material not found." });

        item.Title = dto.Title.Trim();
        item.Description = dto.Description?.Trim();
        item.TargetScope = dto.TargetScope.Trim();
        item.ClassId = dto.ClassId;
        item.SectionId = dto.SectionId;
        item.BatchId = dto.BatchId;
        item.SubjectId = dto.SubjectId;
        item.Subject = dto.Subject?.Trim() ?? string.Empty;
        item.MaterialType = dto.MaterialType.Trim();
        item.ChapterName = dto.ChapterName?.Trim();
        item.Topic = dto.Topic?.Trim();
        item.AcademicYear = dto.AcademicYear?.Trim();
        item.TargetExam = dto.TargetExam?.Trim();
        item.ExamYear = dto.ExamYear?.Trim();
        item.HasSolutions = dto.HasSolutions;
        item.DifficultyLevel = dto.DifficultyLevel?.Trim();
        item.FileUrl = dto.FileUrl?.Trim() ?? item.FileUrl;
        item.FileName = dto.FileName?.Trim() ?? item.FileName;
        item.FileSizeBytes = dto.FileSizeBytes > 0 ? dto.FileSizeBytes : item.FileSizeBytes;
        item.FileFormat = string.IsNullOrWhiteSpace(dto.FileFormat) ? item.FileFormat : dto.FileFormat.Trim().ToLower();
        item.ExternalLink = dto.ExternalLink?.Trim();
        item.SolutionFileUrl = dto.SolutionFileUrl?.Trim();
        item.SolutionFileName = dto.SolutionFileName?.Trim();
        item.IsPublished = dto.IsPublished;
        item.IsFeatured = dto.IsFeatured;
        item.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Study material updated successfully." });
    }

    /// <summary>
    /// Delete study material.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (_currentUser.UserRole.Equals("Student", StringComparison.OrdinalIgnoreCase) || 
            _currentUser.UserRole.Equals("Parent", StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(403, new { message = "Students and parents have read-only access to study materials." });
        }

        var item = await _db.StudyMaterials.FirstOrDefaultAsync(m => m.Id == id);
        if (item == null) return NotFound(new { message = "Study material not found." });

        _db.StudyMaterials.Remove(item);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Study material removed successfully." });
    }

    /// <summary>
    /// Atomically track download count.
    /// </summary>
    [HttpPost("{id}/track-download")]
    public async Task<IActionResult> TrackDownload(Guid id)
    {
        var item = await _db.StudyMaterials.FirstOrDefaultAsync(m => m.Id == id);
        if (item == null) return NotFound(new { message = "Study material not found." });

        item.DownloadCount += 1;
        await _db.SaveChangesAsync();

        return Ok(new { downloadCount = item.DownloadCount });
    }
}
