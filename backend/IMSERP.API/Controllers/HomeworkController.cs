using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using IMSERP.API.Helpers;
using System.Text.Json;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class HomeworkController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IWebHostEnvironment _env;

    public HomeworkController(IIMSERPDbContext db, ICurrentUserService currentUser, IWebHostEnvironment env)
    {
        _db = db;
        _currentUser = currentUser;
        _env = env;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<StudentHomeworkDto>>> GetHomeworkList(
        [FromQuery] Guid? classId,
        [FromQuery] Guid? sectionId,
        [FromQuery] Guid? batchId,
        [FromQuery] Guid? subjectId,
        [FromQuery] DateTime? date,
        [FromQuery] string? status)
    {
        var tenantId = _currentUser.TenantId;
        var query = _db.StudentHomeworks
            .AsNoTracking()
            .Include(h => h.Class)
            .Include(h => h.Section)
            .Include(h => h.Batch)
            .Include(h => h.Submissions)
            .Where(h => h.TenantId == tenantId);

        if (_currentUser.BranchId.HasValue)
        {
            var branchId = _currentUser.BranchId.Value;
            query = query.Where(h => !h.BranchId.HasValue || h.BranchId == branchId);
        }

        if (classId.HasValue && classId.Value != Guid.Empty)
            query = query.Where(h => h.ClassId == classId.Value);

        if (sectionId.HasValue && sectionId.Value != Guid.Empty)
            query = query.Where(h => h.SectionId == sectionId.Value);

        if (batchId.HasValue && batchId.Value != Guid.Empty)
            query = query.Where(h => h.BatchId == batchId.Value);

        if (subjectId.HasValue && subjectId.Value != Guid.Empty)
            query = query.Where(h => h.SubjectId == subjectId.Value);

        if (date.HasValue)
        {
            var targetDate = date.Value.Date;
            query = query.Where(h => h.AssignedDate.Date == targetDate);
        }

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(h => h.Status.ToLower() == status.ToLower());

        var items = await query
            .OrderByDescending(h => h.AssignedDate)
            .ThenByDescending(h => h.CreatedAt)
            .Select(h => new StudentHomeworkDto(
                h.Id,
                h.TenantId,
                h.BranchId,
                h.ClassId,
                h.Class != null ? h.Class.Name : null,
                h.SectionId,
                h.Section != null ? h.Section.Name : null,
                h.BatchId,
                h.Batch != null ? h.Batch.Name : null,
                h.SubjectId,
                h.SubjectName,
                h.TeacherId,
                h.TeacherName,
                h.Title,
                h.Description,
                h.AssignedDate,
                h.DueDate,
                h.AttachmentUrl,
                h.AttachmentFileName,
                h.Status,
                h.EstimatedMinutes,
                h.CreatedAt,
                h.Submissions.Count
            ))
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<StudentHomeworkDto>> GetHomeworkById(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var h = await _db.StudentHomeworks
            .AsNoTracking()
            .Include(x => x.Class)
            .Include(x => x.Section)
            .Include(x => x.Batch)
            .Include(x => x.Submissions)
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);

        if (h == null) return NotFound(new { message = "Homework entry not found." });

        return Ok(new StudentHomeworkDto(
            h.Id,
            h.TenantId,
            h.BranchId,
            h.ClassId,
            h.Class != null ? h.Class.Name : null,
            h.SectionId,
            h.Section != null ? h.Section.Name : null,
            h.BatchId,
            h.Batch != null ? h.Batch.Name : null,
            h.SubjectId,
            h.SubjectName,
            h.TeacherId,
            h.TeacherName,
            h.Title,
            h.Description,
            h.AssignedDate,
            h.DueDate,
            h.AttachmentUrl,
            h.AttachmentFileName,
            h.Status,
            h.EstimatedMinutes,
            h.CreatedAt,
            h.Submissions.Count
        ));
    }

    [HttpGet("stats")]
    public async Task<ActionResult<HomeworkStatsDto>> GetHomeworkStats()
    {
        var tenantId = _currentUser.TenantId;
        var today = DateTime.Now.Date;

        var query = _db.StudentHomeworks.AsNoTracking().Where(h => h.TenantId == tenantId);
        if (_currentUser.BranchId.HasValue)
        {
            var branchId = _currentUser.BranchId.Value;
            query = query.Where(h => !h.BranchId.HasValue || h.BranchId == branchId);
        }

        var totalActive = await query.CountAsync(h => h.Status == "Active");
        var dueToday = await query.CountAsync(h => h.Status == "Active" && h.DueDate.Date == today);
        var assignedToday = await query.CountAsync(h => h.AssignedDate.Date == today);
        var completed = await query.CountAsync(h => h.Status == "Completed");

        return Ok(new HomeworkStatsDto(totalActive, dueToday, assignedToday, completed));
    }

    [HttpPost("upload")]
    [RequestSizeLimit(30_000_000)] // 30 MB
    public async Task<IActionResult> UploadHomeworkFile([FromForm] IFormFile? file, [FromForm] string? category)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file was uploaded." });

        var subFolder = category?.ToLower() == "submission" ? "homework/submissions" : "homework/worksheets";
        var uploadsFolder = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", subFolder.Replace('/', Path.DirectorySeparatorChar));

        if (!Directory.Exists(uploadsFolder))
        {
            Directory.CreateDirectory(uploadsFolder);
        }

        var extension = Path.GetExtension(file.FileName);
        var safeFileName = $"{Guid.NewGuid():N}_{DateTime.UtcNow.Ticks}{extension}";
        var fullPath = Path.Combine(uploadsFolder, safeFileName);

        using (var stream = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var relativeUrl = $"/uploads/{subFolder}/{safeFileName}";

        return Ok(new
        {
            fileUrl = relativeUrl,
            fileName = file.FileName,
            fileSize = file.Length
        });
    }

    [HttpPost]
    public async Task<ActionResult<StudentHomeworkDto>> CreateHomework([FromBody] CreateStudentHomeworkDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(new { message = "Homework title is required." });

        if (string.IsNullOrWhiteSpace(dto.Description))
            return BadRequest(new { message = "Homework description is required." });

        var tenantId = _currentUser.TenantId;
        var branchId = _currentUser.BranchId;

        // Auto lookup teacher name if teacherId is provided
        string? teacherName = dto.TeacherName;
        if (dto.TeacherId.HasValue && string.IsNullOrWhiteSpace(teacherName))
        {
            var teacher = await _db.Teachers.AsNoTracking().FirstOrDefaultAsync(t => t.Id == dto.TeacherId.Value);
            if (teacher != null) teacherName = teacher.FullName;
        }

        string? attachmentUrl = dto.AttachmentUrl;
        if (!string.IsNullOrWhiteSpace(attachmentUrl) && attachmentUrl.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            attachmentUrl = ImageStorageHelper.SaveBase64File(attachmentUrl, "homework/worksheets", Guid.NewGuid().ToString(), _env.ContentRootPath);
        }

        var now = DateTime.Now;
        var homework = new StudentHomework
        {
            TenantId = tenantId,
            BranchId = branchId,
            ClassId = dto.ClassId,
            SectionId = dto.SectionId,
            BatchId = dto.BatchId,
            SubjectId = dto.SubjectId,
            SubjectName = dto.SubjectName ?? "General",
            TeacherId = dto.TeacherId,
            TeacherName = teacherName,
            Title = dto.Title.Trim(),
            Description = dto.Description.Trim(),
            AssignedDate = dto.AssignedDate != default ? dto.AssignedDate : now,
            DueDate = dto.DueDate != default ? dto.DueDate : now.Date.AddDays(1).AddHours(17),
            AttachmentUrl = attachmentUrl,
            AttachmentFileName = dto.AttachmentFileName,
            Status = "Active",
            EstimatedMinutes = dto.EstimatedMinutes ?? 30,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.StudentHomeworks.Add(homework);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetHomeworkById), new { id = homework.Id }, new StudentHomeworkDto(
            homework.Id,
            homework.TenantId,
            homework.BranchId,
            homework.ClassId,
            null,
            homework.SectionId,
            null,
            homework.BatchId,
            null,
            homework.SubjectId,
            homework.SubjectName,
            homework.TeacherId,
            homework.TeacherName,
            homework.Title,
            homework.Description,
            homework.AssignedDate,
            homework.DueDate,
            homework.AttachmentUrl,
            homework.AttachmentFileName,
            homework.Status,
            homework.EstimatedMinutes,
            homework.CreatedAt,
            0
        ));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateHomework(Guid id, [FromBody] UpdateStudentHomeworkDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var homework = await _db.StudentHomeworks.FirstOrDefaultAsync(h => h.Id == id && h.TenantId == tenantId);
        if (homework == null) return NotFound(new { message = "Homework entry not found." });

        homework.Title = dto.Title?.Trim() ?? homework.Title;
        homework.Description = dto.Description?.Trim() ?? homework.Description;
        if (dto.DueDate != default) homework.DueDate = dto.DueDate;
        if (!string.IsNullOrWhiteSpace(dto.Status)) homework.Status = dto.Status;
        if (dto.AttachmentFileName != null) homework.AttachmentFileName = dto.AttachmentFileName;

        if (dto.AttachmentUrl != null)
        {
            if (dto.AttachmentUrl.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            {
                homework.AttachmentUrl = ImageStorageHelper.SaveBase64File(dto.AttachmentUrl, "homework/worksheets", id.ToString(), _env.ContentRootPath);
            }
            else
            {
                homework.AttachmentUrl = dto.AttachmentUrl;
            }
        }

        if (dto.EstimatedMinutes.HasValue) homework.EstimatedMinutes = dto.EstimatedMinutes.Value;
        homework.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Homework updated successfully." });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteHomework(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var homework = await _db.StudentHomeworks.FirstOrDefaultAsync(h => h.Id == id && h.TenantId == tenantId);
        if (homework == null) return NotFound(new { message = "Homework entry not found." });

        _db.StudentHomeworks.Remove(homework);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Homework deleted successfully." });
    }

    // =========================================================================
    // STUDENT PORTAL: VIEW ASSIGNED HOMEWORK & MY SUBMISSION
    // =========================================================================
    [HttpGet("my-homework")]
    public async Task<ActionResult<IEnumerable<StudentHomeworkWithSubmissionDto>>> GetMyHomework([FromQuery] Guid? studentId)
    {
        var tenantId = _currentUser.TenantId;
        Student? student = null;

        if (studentId.HasValue && studentId.Value != Guid.Empty)
        {
            student = await _db.Students.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == studentId.Value && s.TenantId == tenantId);
        }

        if (student == null)
        {
            student = await ResolveCurrentStudentAsync();
        }

        // If user is Admin or Teacher previewing student portal, auto-fallback to student in assigned section or tenant
        if (student == null)
        {
            var teacher = await _db.Teachers.AsNoTracking().FirstOrDefaultAsync(t => t.UserId == _currentUser.UserId && t.TenantId == tenantId);
            if (teacher != null)
            {
                var section = await _db.SchoolSections.AsNoTracking().FirstOrDefaultAsync(s => s.ClassTeacherId == teacher.Id && s.TenantId == tenantId);
                if (section != null)
                {
                    student = await _db.Students.AsNoTracking()
                        .FirstOrDefaultAsync(s => s.SectionId == section.Id && s.TenantId == tenantId && s.IsActive != false);
                }
            }

            if (student == null)
            {
                student = await _db.Students.AsNoTracking()
                    .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.IsActive != false);
            }
        }

        if (student == null)
            return Ok(new List<StudentHomeworkWithSubmissionDto>());

        var query = _db.StudentHomeworks
            .AsNoTracking()
            .Include(h => h.Class)
            .Include(h => h.Section)
            .Include(h => h.Batch)
            .Include(h => h.Submissions)
                .ThenInclude(s => s.ReviewedByTeacher)
            .Where(h => h.TenantId == tenantId);

        if (student.BranchId.HasValue)
        {
            var branchId = student.BranchId.Value;
            query = query.Where(h => !h.BranchId.HasValue || h.BranchId == branchId);
        }

        // Match student's class, section, batch
        if (student.ClassId.HasValue)
        {
            var cId = student.ClassId.Value;
            query = query.Where(h => !h.ClassId.HasValue || h.ClassId == cId);
        }

        if (student.SectionId.HasValue)
        {
            var sId = student.SectionId.Value;
            query = query.Where(h => !h.SectionId.HasValue || h.SectionId == sId);
        }

        if (student.BatchId.HasValue)
        {
            var bId = student.BatchId.Value;
            query = query.Where(h => !h.BatchId.HasValue || h.BatchId == bId);
        }

        var list = await query
            .OrderByDescending(h => h.AssignedDate)
            .ThenByDescending(h => h.CreatedAt)
            .ToListAsync();

        var result = list.Select(h =>
        {
            var sub = h.Submissions.FirstOrDefault(s => s.StudentId == student.Id);
            StudentHomeworkSubmissionDto? subDto = null;
            if (sub != null)
            {
                subDto = new StudentHomeworkSubmissionDto(
                    sub.Id,
                    sub.HomeworkId,
                    sub.StudentId,
                    student.StudentName,
                    student.RollNumber,
                    student.AdmissionNumber,
                    sub.SubmissionDate,
                    sub.StudentRemarks,
                    sub.SubmissionFileUrl,
                    sub.SubmissionFileName,
                    sub.Status,
                    sub.TeacherRemarks,
                    sub.GradeOrMarks,
                    sub.ReviewedAt,
                    sub.ReviewedByTeacher != null ? sub.ReviewedByTeacher.FullName : null
                );
            }

            return new StudentHomeworkWithSubmissionDto(
                h.Id,
                h.TenantId,
                h.BranchId,
                h.ClassId,
                h.Class != null ? h.Class.Name : null,
                h.SectionId,
                h.Section != null ? h.Section.Name : null,
                h.BatchId,
                h.Batch != null ? h.Batch.Name : null,
                h.SubjectId,
                h.SubjectName,
                h.TeacherId,
                h.TeacherName,
                h.Title,
                h.Description,
                h.AssignedDate,
                h.DueDate,
                h.AttachmentUrl,
                h.AttachmentFileName,
                h.Status,
                h.EstimatedMinutes,
                h.CreatedAt,
                sub != null,
                subDto
            );
        }).ToList();

        return Ok(result);
    }

    [HttpGet("preview-students")]
    public async Task<IActionResult> GetPreviewStudents([FromQuery] Guid? classId, [FromQuery] Guid? sectionId)
    {
        var tenantId = _currentUser.TenantId;
        var query = _db.Students.AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Where(s => s.TenantId == tenantId && s.IsActive != false);

        if (classId.HasValue && classId.Value != Guid.Empty)
            query = query.Where(s => s.ClassId == classId.Value);

        if (sectionId.HasValue && sectionId.Value != Guid.Empty)
            query = query.Where(s => s.SectionId == sectionId.Value);

        var list = await query
            .OrderBy(s => s.RollNumber)
            .ThenBy(s => s.StudentName)
            .Select(s => new
            {
                s.Id,
                s.StudentName,
                s.RollNumber,
                s.AdmissionNumber,
                s.ClassId,
                ClassName = s.Class != null ? s.Class.Name : null,
                s.SectionId,
                SectionName = s.Section != null ? s.Section.Name : null
            })
            .ToListAsync();

        return Ok(list);
    }

    // =========================================================================
    // STUDENT PORTAL: SUBMIT COMPLETED HOMEWORK COPY / FILE
    // =========================================================================
    [HttpPost("{id}/submit")]
    public async Task<IActionResult> SubmitHomework(Guid id, [FromBody] SubmitHomeworkRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.SubmissionFileUrl))
            return BadRequest(new { message = "Homework solution file is required." });

        Student? student = null;
        var tenantId = _currentUser.TenantId;

        if (dto.StudentId.HasValue && dto.StudentId.Value != Guid.Empty)
        {
            student = await _db.Students.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == dto.StudentId.Value && s.TenantId == tenantId);
        }

        if (student == null)
        {
            student = await ResolveCurrentStudentAsync();
        }

        if (student == null)
        {
            student = await _db.Students.AsNoTracking()
                .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.IsActive != false);
        }

        if (student == null)
            return BadRequest(new { message = "You are not logged in as a student or your profile is not linked." });

        var homework = await _db.StudentHomeworks.FirstOrDefaultAsync(h => h.Id == id && h.TenantId == tenantId);
        if (homework == null)
            return NotFound(new { message = "Homework assignment not found." });

        var fileUrl = dto.SubmissionFileUrl;
        if (fileUrl.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            fileUrl = ImageStorageHelper.SaveBase64File(fileUrl, "homework/submissions", $"{student.Id}_{id}", _env.ContentRootPath) ?? fileUrl;
        }

        var existingSubmission = await _db.StudentHomeworkSubmissions
            .FirstOrDefaultAsync(s => s.HomeworkId == id && s.StudentId == student.Id);

        var now = DateTime.UtcNow;
        if (existingSubmission != null)
        {
            // Resubmit / update
            existingSubmission.SubmissionFileUrl = fileUrl;
            existingSubmission.SubmissionFileName = dto.SubmissionFileName ?? "Homework_Solution";
            existingSubmission.StudentRemarks = dto.StudentRemarks;
            existingSubmission.SubmissionDate = now;
            existingSubmission.Status = "Submitted";
            existingSubmission.TeacherRemarks = null; // Reset prior feedback on resubmission
            existingSubmission.GradeOrMarks = null;
            existingSubmission.ReviewedAt = null;
        }
        else
        {
            var submission = new StudentHomeworkSubmission
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BranchId = homework.BranchId ?? student.BranchId,
                HomeworkId = id,
                StudentId = student.Id,
                SubmissionDate = now,
                StudentRemarks = dto.StudentRemarks,
                SubmissionFileUrl = fileUrl,
                SubmissionFileName = string.IsNullOrWhiteSpace(dto.SubmissionFileName) ? "Homework_Solution" : dto.SubmissionFileName,
                Status = "Submitted",
                CreatedAt = now
            };
            _db.StudentHomeworkSubmissions.Add(submission);
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Homework submitted successfully!" });
    }

    // =========================================================================
    // TEACHER: VIEW CLASS SUBMISSION ROSTER FOR A HOMEWORK ENTRY
    // =========================================================================
    [HttpGet("{id}/submissions")]
    public async Task<ActionResult<IEnumerable<ClassStudentSubmissionRosterDto>>> GetHomeworkSubmissions(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var homework = await _db.StudentHomeworks
            .AsNoTracking()
            .FirstOrDefaultAsync(h => h.Id == id && h.TenantId == tenantId);

        if (homework == null)
            return NotFound(new { message = "Homework assignment not found." });

        // Retrieve all active students in the target class / section / batch
        var studentsQuery = _db.Students.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.IsActive != false);

        if (homework.ClassId.HasValue)
            studentsQuery = studentsQuery.Where(s => s.ClassId == homework.ClassId.Value);

        if (homework.SectionId.HasValue)
            studentsQuery = studentsQuery.Where(s => s.SectionId == homework.SectionId.Value);

        if (homework.BatchId.HasValue)
            studentsQuery = studentsQuery.Where(s => s.BatchId == homework.BatchId.Value);

        var students = await studentsQuery
            .OrderBy(s => s.RollNumber)
            .ThenBy(s => s.StudentName)
            .ToListAsync();

        var submissions = await _db.StudentHomeworkSubmissions
            .AsNoTracking()
            .Include(s => s.ReviewedByTeacher)
            .Where(s => s.HomeworkId == id && s.TenantId == tenantId)
            .ToListAsync();

        var roster = students.Select(st =>
        {
            var sub = submissions.FirstOrDefault(s => s.StudentId == st.Id);
            StudentHomeworkSubmissionDto? subDto = null;
            if (sub != null)
            {
                subDto = new StudentHomeworkSubmissionDto(
                    sub.Id,
                    sub.HomeworkId,
                    sub.StudentId,
                    st.StudentName,
                    st.RollNumber,
                    st.AdmissionNumber,
                    sub.SubmissionDate,
                    sub.StudentRemarks,
                    sub.SubmissionFileUrl,
                    sub.SubmissionFileName,
                    sub.Status,
                    sub.TeacherRemarks,
                    sub.GradeOrMarks,
                    sub.ReviewedAt,
                    sub.ReviewedByTeacher != null ? sub.ReviewedByTeacher.FullName : null
                );
            }

            return new ClassStudentSubmissionRosterDto(
                st.Id,
                st.StudentName,
                st.RollNumber,
                st.AdmissionNumber,
                sub != null,
                subDto
            );
        }).ToList();

        return Ok(roster);
    }

    // =========================================================================
    // TEACHER: REVIEW & GRADE STUDENT SUBMISSION
    // =========================================================================
    [HttpPut("submissions/{submissionId}/review")]
    public async Task<IActionResult> ReviewSubmission(Guid submissionId, [FromBody] ReviewHomeworkSubmissionDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var submission = await _db.StudentHomeworkSubmissions
            .FirstOrDefaultAsync(s => s.Id == submissionId && s.TenantId == tenantId);

        if (submission == null)
            return NotFound(new { message = "Submission not found." });

        submission.Status = string.IsNullOrWhiteSpace(dto.Status) ? "Approved" : dto.Status.Trim();
        submission.TeacherRemarks = dto.TeacherRemarks?.Trim();
        submission.GradeOrMarks = dto.GradeOrMarks?.Trim();
        submission.ReviewedAt = DateTime.UtcNow;

        // Associate teacher if current user is a teacher
        var teacher = await _db.Teachers.AsNoTracking()
            .FirstOrDefaultAsync(t => t.UserId == _currentUser.UserId && t.TenantId == tenantId);
        if (teacher != null)
        {
            submission.ReviewedByTeacherId = teacher.Id;
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Submission review updated successfully." });
    }

    private static DateTime GetIstToday()
    {
        try
        {
            var istZone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istZone).Date;
        }
        catch
        {
            return DateTime.UtcNow.AddHours(5).AddMinutes(30).Date;
        }
    }

    // =========================================================================
    // DAILY CLASSWORK & HOMEWORK DIARY APIS
    // =========================================================================

    [HttpGet("daily-diary")]
    public async Task<ActionResult<IEnumerable<DailyStudentDiaryRowDto>>> GetDailyDiaryList(
        [FromQuery] DateTime? date,
        [FromQuery] Guid? classId,
        [FromQuery] Guid? sectionId)
    {
        var tenantId = _currentUser.TenantId;
        var targetDate = (date ?? GetIstToday()).Date;

        var studentsQuery = _db.Students.AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Where(s => s.TenantId == tenantId && s.IsActive != false && (s.JoiningDate == default || s.JoiningDate.Date <= targetDate));

        if (classId.HasValue && classId.Value != Guid.Empty)
            studentsQuery = studentsQuery.Where(s => s.ClassId == classId.Value);

        if (sectionId.HasValue && sectionId.Value != Guid.Empty)
            studentsQuery = studentsQuery.Where(s => s.SectionId == sectionId.Value);

        if (_currentUser.BranchId.HasValue)
        {
            var branchId = _currentUser.BranchId.Value;
            studentsQuery = studentsQuery.Where(s => !s.BranchId.HasValue || s.BranchId == branchId);
        }

        var students = await studentsQuery
            .OrderBy(s => s.SchoolRollNumber)
            .ThenBy(s => s.RollNumber)
            .ThenBy(s => s.StudentName)
            .ToListAsync();

        var studentIds = students.Select(s => s.Id).ToList();

        // 1. Fetch attendance records for this date
        var attendances = await _db.StudentAttendances.AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.AttendanceDate == targetDate && studentIds.Contains(a.StudentId))
            .ToDictionaryAsync(a => a.StudentId);

        // 2. Fetch existing daily diaries for this date
        var diaries = await _db.DailyStudentDiaries.AsNoTracking()
            .Where(d => d.TenantId == tenantId && d.DiaryDate == targetDate && studentIds.Contains(d.StudentId))
            .ToDictionaryAsync(d => d.StudentId);

        var result = students.Select(st =>
        {
            diaries.TryGetValue(st.Id, out var diary);
            attendances.TryGetValue(st.Id, out var att);

            string attendanceStatus;
            bool isAbsent;

            if (att != null)
            {
                attendanceStatus = att.Status switch
                {
                    TeacherAttendanceStatus.Present => "Present",
                    TeacherAttendanceStatus.Absent => "Absent",
                    TeacherAttendanceStatus.Late => "Late",
                    TeacherAttendanceStatus.HalfDay => "HalfDay",
                    TeacherAttendanceStatus.Leave => "Leave",
                    _ => att.Status.ToString()
                };
                // Ground truth: If attendance register marked Absent or Leave, mark absent
                isAbsent = att.Status == TeacherAttendanceStatus.Absent || att.Status == TeacherAttendanceStatus.Leave;
            }
            else if (diary != null && diary.IsAbsent)
            {
                isAbsent = true;
                attendanceStatus = "Absent";
            }
            else
            {
                isAbsent = false;
                attendanceStatus = "NotMarked";
            }

            var cwList = new List<DailySubjectTaskItem>();
            var hwList = new List<DailySubjectTaskItem>();

            if (diary != null)
            {
                if (!string.IsNullOrWhiteSpace(diary.ClassWorkJson))
                {
                    try { cwList = JsonSerializer.Deserialize<List<DailySubjectTaskItem>>(diary.ClassWorkJson) ?? new(); } catch { }
                }
                if (!string.IsNullOrWhiteSpace(diary.HomeWorkJson))
                {
                    try { hwList = JsonSerializer.Deserialize<List<DailySubjectTaskItem>>(diary.HomeWorkJson) ?? new(); } catch { }
                }
            }

            return new DailyStudentDiaryRowDto(
                st.Id,
                st.StudentName,
                st.SchoolRollNumber ?? st.RollNumber ?? "",
                st.AdmissionNumber,
                st.ClassId,
                st.Class != null ? st.Class.Name : null,
                st.SectionId,
                st.Section != null ? st.Section.Name : null,
                isAbsent,
                cwList,
                hwList,
                diary?.TeacherRemarks,
                diary?.Id,
                attendanceStatus,
                st.ParentWhatsAppPhone
            );
        }).ToList();

        return Ok(result);
    }

    [HttpPost("daily-diary/bulk")]
    public async Task<IActionResult> SaveBulkDailyDiary([FromBody] BulkSaveDailyStudentDiaryDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest(new { message = "No diary items provided." });

        var tenantId = _currentUser.TenantId;
        var targetDate = dto.DiaryDate.Date;
        var studentIds = dto.Items.Select(i => i.StudentId).ToList();

        var existingDiaries = await _db.DailyStudentDiaries
            .Where(d => d.TenantId == tenantId && d.DiaryDate == targetDate && studentIds.Contains(d.StudentId))
            .ToDictionaryAsync(d => d.StudentId);

        var students = await _db.Students.AsNoTracking()
            .Where(s => s.TenantId == tenantId && studentIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id);

        var now = DateTime.UtcNow;

        // Resolve assigning teacher / checker context once (no hardcoding; all from DB + login)
        var isStudentOrParent = string.Equals(_currentUser.UserRole, "Student", StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(_currentUser.UserRole, "Parent", StringComparison.OrdinalIgnoreCase);
        if (isStudentOrParent) return Forbid();

        var loginUser = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);
        var currentTeacher = await _db.Teachers.AsNoTracking()
            .FirstOrDefaultAsync(t => t.TenantId == tenantId && (
                t.UserId == _currentUser.UserId ||
                (loginUser != null && !string.IsNullOrEmpty(loginUser.Email) && t.Email == loginUser.Email) ||
                (loginUser != null && !string.IsNullOrEmpty(loginUser.FullName) && t.FullName == loginUser.FullName)
            ));
        var checkerName = currentTeacher?.FullName ?? loginUser?.FullName;

        var diaryClassId = dto.ClassId;
        var subjectTeacherMap = new Dictionary<string, (Guid TeacherId, string Name)>(StringComparer.OrdinalIgnoreCase);
        if (diaryClassId.HasValue)
        {
            var classSubjects = await _db.ClassSubjects.AsNoTracking()
                .Include(c => c.Subject)
                .Include(c => c.Teacher)
                .Where(c => c.TenantId == tenantId && c.ClassId == diaryClassId.Value && c.TeacherId != null)
                .ToListAsync();
            foreach (var cs in classSubjects)
            {
                if (cs.Subject != null && cs.Teacher != null && !subjectTeacherMap.ContainsKey(cs.Subject.Name))
                    subjectTeacherMap[cs.Subject.Name] = (cs.Teacher.Id, cs.Teacher.FullName);
            }
        }

        foreach (var item in dto.Items)
        {
            if (!students.TryGetValue(item.StudentId, out var student)) continue;

            existingDiaries.TryGetValue(item.StudentId, out var existingForItem);
            var cwItems = NormalizeDiaryTasks(item.ClassWork, existingForItem?.ClassWorkJson, false, currentTeacher, subjectTeacherMap, checkerName, now);
            var hwItems = NormalizeDiaryTasks(item.HomeWork, existingForItem?.HomeWorkJson, true, currentTeacher, subjectTeacherMap, checkerName, now);

            string? cwJson = cwItems.Count > 0 ? JsonSerializer.Serialize(cwItems) : null;
            string? hwJson = hwItems.Count > 0 ? JsonSerializer.Serialize(hwItems) : null;

            if (existingDiaries.TryGetValue(item.StudentId, out var existing))
            {
                existing.ClassWorkJson = cwJson;
                existing.HomeWorkJson = hwJson;
                existing.IsAbsent = item.IsAbsent;
                existing.TeacherRemarks = item.Remarks;
                existing.UpdatedAt = now;
            }
            else
            {
                var newDiary = new DailyStudentDiary
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = student.BranchId ?? _currentUser.BranchId,
                    StudentId = item.StudentId,
                    ClassId = dto.ClassId ?? student.ClassId,
                    SectionId = dto.SectionId ?? student.SectionId,
                    DiaryDate = targetDate,
                    ClassWorkJson = cwJson,
                    HomeWorkJson = hwJson,
                    IsAbsent = item.IsAbsent,
                    TeacherRemarks = item.Remarks,
                    TeacherId = null,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                _db.DailyStudentDiaries.Add(newDiary);
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Daily classwork & homework diary saved successfully!" });
    }

    [HttpGet("daily-diary/report")]
    public async Task<ActionResult<DailyDiaryReportHeaderDto>> GetDailyDiaryReport(
        [FromQuery] DateTime? date,
        [FromQuery] Guid? classId,
        [FromQuery] Guid? sectionId)
    {
        var tenantId = _currentUser.TenantId;
        var targetDate = (date ?? GetIstToday()).Date;

        var tenant = await _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId);
        var branch = _currentUser.BranchId.HasValue 
            ? await _db.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == _currentUser.BranchId.Value) 
            : null;

        string? className = null;
        if (classId.HasValue && classId.Value != Guid.Empty)
        {
            var cls = await _db.SchoolClasses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == classId.Value);
            className = cls?.Name;
        }

        string? sectionName = null;
        if (sectionId.HasValue && sectionId.Value != Guid.Empty)
        {
            var sec = await _db.SchoolSections.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sectionId.Value);
            sectionName = sec?.Name;
        }

        var diaryActionResult = await GetDailyDiaryList(targetDate, classId, sectionId);
        var rows = (diaryActionResult.Result as OkObjectResult)?.Value as List<DailyStudentDiaryRowDto> ?? new();

        string? classTeacherName = null;
        if (sectionId.HasValue && sectionId.Value != Guid.Empty)
        {
            classTeacherName = await _db.SchoolSections.AsNoTracking()
                .Where(s => s.Id == sectionId.Value && s.ClassTeacherId != null)
                .Select(s => s.ClassTeacher!.FullName)
                .FirstOrDefaultAsync();
        }
        else if (classId.HasValue && classId.Value != Guid.Empty)
        {
            var names = await _db.SchoolSections.AsNoTracking()
                .Where(s => s.ClassId == classId.Value && s.ClassTeacherId != null)
                .Select(s => s.ClassTeacher!.FullName)
                .Distinct()
                .ToListAsync();
            if (names.Count == 1) classTeacherName = names[0];
        }

        // Previous diary day's H.W. + its check status (H.W. is usually checked the next day)
        DateTime? previousHwDate = null;
        List<HwPreviousRowDto>? previousHw = null;
        if (classId.HasValue && classId.Value != Guid.Empty)
        {
            var prevDate = await DiaryScope(classId, sectionId)
                .Where(d => d.DiaryDate < targetDate && d.HomeWorkJson != null && !d.IsAbsent)
                .OrderByDescending(d => d.DiaryDate)
                .Select(d => (DateTime?)d.DiaryDate)
                .FirstOrDefaultAsync();
            if (prevDate.HasValue)
            {
                var prevDiaries = await DiaryScope(classId, sectionId)
                    .Where(d => d.DiaryDate == prevDate.Value && d.HomeWorkJson != null)
                    .ToListAsync();
                var prevStudentIds = prevDiaries.Select(d => d.StudentId).ToList();
                var prevStudents = await _db.Students.AsNoTracking()
                    .Where(s => s.TenantId == tenantId && prevStudentIds.Contains(s.Id))
                    .ToDictionaryAsync(s => s.Id);
                previousHw = prevDiaries
                    .Where(d => prevStudents.ContainsKey(d.StudentId))
                    .Select(d => new { d, st = prevStudents[d.StudentId], tasks = ParseTasks(d.HomeWorkJson).Where(t => !string.IsNullOrWhiteSpace(t.Task)).ToList() })
                    .Where(x => x.tasks.Count > 0)
                    .OrderBy(x => x.st.SchoolRollNumber ?? x.st.RollNumber).ThenBy(x => x.st.StudentName)
                    .Select(x => new HwPreviousRowDto(x.st.Id, x.st.StudentName, x.st.SchoolRollNumber ?? x.st.RollNumber ?? "", x.d.IsAbsent, x.tasks))
                    .ToList();
                previousHwDate = prevDate.Value;
            }
        }

        var header = new DailyDiaryReportHeaderDto(
            tenant?.Name ?? string.Empty,
            branch?.Address ?? tenant?.Address ?? string.Empty,
            "STUDENT DAILY CLASS WORK & HOME WORK REPORT",
            targetDate,
            className,
            sectionName,
            rows,
            classTeacherName,
            previousHwDate,
            previousHw
        );

        return Ok(header);
    }

    // =========================================================================
    // H.W. CHECK (next-day / back-dated), PREVIOUS STATUS & ANALYTICS
    // =========================================================================

    private static List<DailySubjectTaskItem> ParseTasks(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try { return JsonSerializer.Deserialize<List<DailySubjectTaskItem>>(json) ?? new(); } catch { return new(); }
    }

    private IQueryable<DailyStudentDiary> DiaryScope(Guid? classId, Guid? sectionId)
    {
        var tenantId = _currentUser.TenantId;
        var q = _db.DailyStudentDiaries.AsNoTracking().Where(d => d.TenantId == tenantId);
        if (classId.HasValue && classId.Value != Guid.Empty) q = q.Where(d => d.ClassId == classId.Value);
        if (sectionId.HasValue && sectionId.Value != Guid.Empty) q = q.Where(d => d.SectionId == sectionId.Value);
        return q;
    }

    [HttpPost("daily-diary/send-whatsapp-all")]
    public async Task<ActionResult<DailyDiaryWhatsAppDispatchResultDto>> SendDailyDiaryWhatsAppAll(
        [FromBody] DailyDiaryWhatsAppDispatchRequestDto dto,
        [FromServices] IWhatsAppService whatsAppService)
    {
        if (IsStudentOrParentRole()) return Forbid();
        var tenantId = _currentUser.TenantId;
        if (dto.Items == null || dto.Items.Count == 0)
        {
            return BadRequest(new { message = "No student items provided to send." });
        }

        var sentList = new List<string>();
        var skippedList = new List<string>();

        var studentIds = dto.Items.Select(x => x.StudentId).ToList();
        var studentsDb = await _db.Students.AsNoTracking()
            .Where(s => s.TenantId == tenantId && studentIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id);

        foreach (var item in dto.Items)
        {
            var phone = item.Phone?.Trim();
            if (string.IsNullOrWhiteSpace(phone) && studentsDb.TryGetValue(item.StudentId, out var st))
            {
                phone = st.ParentWhatsAppPhone?.Trim();
            }

            if (string.IsNullOrWhiteSpace(phone) || phone.Length < 10)
            {
                skippedList.Add($"{item.StudentName} (No Phone Number)");
                continue;
            }

            var cleanPhone = phone.StartsWith("+") ? phone : (phone.Length == 10 ? "+91" + phone : "+" + phone);

            try
            {
                var ok = await whatsAppService.SendDailyDiaryAlertAsync(
                    tenantId,
                    cleanPhone,
                    item.StudentName,
                    item.RollNumber ?? "",
                    dto.DiaryDate.ToString("dd-MMM-yyyy"),
                    item.MessageText
                );

                if (ok)
                {
                    sentList.Add($"{item.StudentName} ({cleanPhone})");
                }
                else
                {
                    skippedList.Add($"{item.StudentName} (Gateway Failed)");
                }
            }
            catch (Exception ex)
            {
                skippedList.Add($"{item.StudentName} ({ex.Message})");
            }
        }

        var message = sentList.Count > 0
            ? $"Successfully sent daily diary to {sentList.Count} parents via WhatsApp."
            : "No WhatsApp messages could be dispatched.";

        return Ok(new DailyDiaryWhatsAppDispatchResultDto(
            dto.Items.Count,
            sentList.Count,
            skippedList.Count,
            sentList,
            skippedList,
            message
        ));
    }

    [HttpPost("daily-diary/send-whatsapp-single")]
    public async Task<ActionResult<object>> SendDailyDiaryWhatsAppSingle(
        [FromBody] DailyDiaryWhatsAppStudentDispatchItem item,
        [FromServices] IWhatsAppService whatsAppService)
    {
        if (IsStudentOrParentRole()) return Forbid();
        var tenantId = _currentUser.TenantId;

        var phone = item.Phone?.Trim();
        if (string.IsNullOrWhiteSpace(phone))
        {
            var st = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Id == item.StudentId);
            phone = st?.ParentWhatsAppPhone?.Trim();
        }

        if (string.IsNullOrWhiteSpace(phone) || phone.Length < 10)
        {
            return BadRequest(new { message = $"Valid WhatsApp phone number not found for {item.StudentName}." });
        }

        var cleanPhone = phone.StartsWith("+") ? phone : (phone.Length == 10 ? "+91" + phone : "+" + phone);

        var ok = await whatsAppService.SendDailyDiaryAlertAsync(
            tenantId,
            cleanPhone,
            item.StudentName,
            item.RollNumber ?? "",
            DateTime.UtcNow.ToString("dd-MMM-yyyy"),
            item.MessageText
        );

        return Ok(new { success = ok, recipient = cleanPhone, studentName = item.StudentName, message = ok ? "WhatsApp message dispatched successfully!" : "Failed to dispatch WhatsApp message." });
    }

    private bool IsStudentOrParentRole() =>
        string.Equals(_currentUser.UserRole, "Student", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(_currentUser.UserRole, "Parent", StringComparison.OrdinalIgnoreCase);

    /// <summary>Dates (latest first) that have H.W. in the look-back window, with checked / pending counts.</summary>
    [HttpGet("daily-diary/hw-dates")]
    public async Task<ActionResult<IEnumerable<HwCheckDateDto>>> GetHwCheckDates(
        [FromQuery] Guid? classId,
        [FromQuery] Guid? sectionId,
        [FromQuery] int days = 14)
    {
        if (IsStudentOrParentRole()) return Forbid();
        days = Math.Clamp(days, 1, 60);
        var today = GetIstToday().Date;
        var from = today.AddDays(-days);

        var diaries = await DiaryScope(classId, sectionId)
            .Where(d => d.DiaryDate >= from && d.DiaryDate <= today && d.HomeWorkJson != null && !d.IsAbsent)
            .Select(d => new { d.DiaryDate, d.HomeWorkJson })
            .ToListAsync();

        var result = diaries
            .GroupBy(d => d.DiaryDate)
            .Select(g =>
            {
                int students = 0, total = 0, checkedCount = 0;
                foreach (var d in g)
                {
                    var tasks = ParseTasks(d.HomeWorkJson).Where(t => !string.IsNullOrWhiteSpace(t.Task)).ToList();
                    if (tasks.Count == 0) continue;
                    students++;
                    total += tasks.Count;
                    checkedCount += tasks.Count(t => NormalizeHwStatus(t.Status) != "Pending");
                }
                return new HwCheckDateDto(g.Key, students, total, checkedCount, total - checkedCount);
            })
            .Where(x => x.TotalPoints > 0)
            .OrderByDescending(x => x.Date)
            .ToList();

        return Ok(result);
    }

    /// <summary>
    /// Updates only the H.W. status of already-assigned points (usually the next day / back-dated).
    /// Subject teachers may change points they assigned; class teachers any point of their section;
    /// other staff roles (admin etc.) any point. Students / parents are rejected. Absent students are skipped.
    /// </summary>
    [HttpPost("daily-diary/hw-status")]
    public async Task<IActionResult> UpdateHwStatus([FromBody] HwStatusUpdateDto dto)
    {
        if (IsStudentOrParentRole()) return Forbid();
        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest(new { message = "No H.W. status items provided." });

        var tenantId = _currentUser.TenantId;
        var date = dto.DiaryDate.Date;
        var studentIds = dto.Items.Select(i => i.StudentId).Distinct().ToList();

        var diaries = await _db.DailyStudentDiaries
            .Where(d => d.TenantId == tenantId && d.DiaryDate == date && studentIds.Contains(d.StudentId))
            .ToDictionaryAsync(d => d.StudentId);

        var absentIds = (await _db.StudentAttendances.AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.AttendanceDate == date && studentIds.Contains(a.StudentId) &&
                        (a.Status == TeacherAttendanceStatus.Absent || a.Status == TeacherAttendanceStatus.Leave))
            .Select(a => a.StudentId).ToListAsync()).ToHashSet();

        var loginUser = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);
        var currentTeacher = await _db.Teachers.AsNoTracking()
            .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.UserId == _currentUser.UserId);
        var checkerName = currentTeacher?.FullName ?? loginUser?.FullName;

        var ownSectionIds = new HashSet<Guid>();
        if (currentTeacher != null)
        {
            ownSectionIds = (await _db.SchoolSections.AsNoTracking()
                .Where(s => s.ClassTeacherId == currentTeacher.Id)
                .Select(s => s.Id).ToListAsync()).ToHashSet();
        }

        var now = DateTime.UtcNow;
        int updated = 0, skipped = 0;

        foreach (var grp in dto.Items.GroupBy(i => i.StudentId))
        {
            if (!diaries.TryGetValue(grp.Key, out var diary) || diary.IsAbsent || absentIds.Contains(grp.Key))
            {
                skipped += grp.Count();
                continue;
            }

            var tasks = ParseTasks(diary.HomeWorkJson);
            var isClassTeacherOfStudent = diary.SectionId.HasValue && ownSectionIds.Contains(diary.SectionId.Value);
            var changed = false;

            foreach (var item in grp)
            {
                var idx = tasks.FindIndex(p =>
                    string.Equals((p.Subject ?? string.Empty).Trim(), (item.Subject ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase) &&
                    string.Equals((p.Task ?? string.Empty).Trim(), (item.Task ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase));
                if (idx < 0) { skipped++; continue; }

                var existing = tasks[idx];
                if (currentTeacher != null && existing.TeacherId.HasValue &&
                    existing.TeacherId != currentTeacher.Id && !isClassTeacherOfStudent)
                {
                    skipped++;
                    continue;
                }

                var newStatus = NormalizeHwStatus(item.Status);
                var oldStatus = NormalizeHwStatus(existing.Status);
                var remark = string.IsNullOrWhiteSpace(item.Remark) ? null : item.Remark.Trim();
                if (newStatus == oldStatus && remark == existing.StatusRemark) continue;

                tasks[idx] = newStatus == "Pending"
                    ? existing with { Status = newStatus, StatusRemark = remark, CheckedAt = null, CheckedByName = null }
                    : existing with
                    {
                        Status = newStatus,
                        StatusRemark = remark,
                        CheckedAt = newStatus == oldStatus && existing.CheckedAt.HasValue ? existing.CheckedAt : now,
                        CheckedByName = newStatus == oldStatus && existing.CheckedAt.HasValue ? existing.CheckedByName : checkerName
                    };
                changed = true;
                updated++;
            }

            if (changed)
            {
                diary.HomeWorkJson = JsonSerializer.Serialize(tasks);
                diary.UpdatedAt = now;
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { updated, skipped, message = $"{updated} H.W. point(s) updated." + (skipped > 0 ? $" {skipped} skipped (not permitted / absent / not found)." : string.Empty) });
    }

    /// <summary>Student-wise and subject-wise H.W. completion analytics for a date range.</summary>
    [HttpGet("daily-diary/hw-analytics")]
    public async Task<ActionResult<HwAnalyticsDto>> GetHwAnalytics(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] Guid? classId,
        [FromQuery] Guid? sectionId)
    {
        if (IsStudentOrParentRole()) return Forbid();
        var tenantId = _currentUser.TenantId;
        var toDate = (to ?? GetIstToday()).Date;
        var fromDate = (from ?? toDate.AddDays(-29)).Date;
        if (fromDate > toDate) (fromDate, toDate) = (toDate, fromDate);
        if ((toDate - fromDate).TotalDays > 366) fromDate = toDate.AddDays(-366);

        var diaries = await DiaryScope(classId, sectionId)
            .Where(d => d.DiaryDate >= fromDate && d.DiaryDate <= toDate && d.HomeWorkJson != null)
            .Select(d => new { d.StudentId, d.DiaryDate, d.IsAbsent, d.HomeWorkJson })
            .ToListAsync();

        var studentIds = diaries.Select(d => d.StudentId).Distinct().ToList();
        var students = await _db.Students.AsNoTracking()
            .Where(s => s.TenantId == tenantId && studentIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id);

        var absentKeys = (await _db.StudentAttendances.AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.AttendanceDate >= fromDate && a.AttendanceDate <= toDate &&
                        studentIds.Contains(a.StudentId) &&
                        (a.Status == TeacherAttendanceStatus.Absent || a.Status == TeacherAttendanceStatus.Leave))
            .Select(a => new { a.StudentId, a.AttendanceDate }).ToListAsync())
            .Select(a => (a.StudentId, a.AttendanceDate.Date)).ToHashSet();

        var perStudent = new Dictionary<Guid, int[]>(); // 0 assigned,1 completed,2 partial,3 notDone,4 pending,5 absent
        var perSubject = new Dictionary<string, int[]>(StringComparer.OrdinalIgnoreCase);

        foreach (var d in diaries)
        {
            if (!students.ContainsKey(d.StudentId)) continue;
            var tasks = ParseTasks(d.HomeWorkJson).Where(t => !string.IsNullOrWhiteSpace(t.Task)).ToList();
            if (tasks.Count == 0) continue;
            var excused = d.IsAbsent || absentKeys.Contains((d.StudentId, d.DiaryDate.Date));

            if (!perStudent.TryGetValue(d.StudentId, out var sc)) perStudent[d.StudentId] = sc = new int[6];
            foreach (var t in tasks)
            {
                var subject = string.IsNullOrWhiteSpace(t.Subject) ? "General" : t.Subject.Trim();
                if (!perSubject.TryGetValue(subject, out var sub)) perSubject[subject] = sub = new int[6];
                if (excused) { sc[5]++; sub[5]++; continue; }
                sc[0]++; sub[0]++;
                switch (NormalizeHwStatus(t.Status))
                {
                    case "Completed": sc[1]++; sub[1]++; break;
                    case "Partial": sc[2]++; sub[2]++; break;
                    case "NotDone": sc[3]++; sub[3]++; break;
                    default: sc[4]++; sub[4]++; break;
                }
            }
        }

        static double Pct(int completed, int partial, int notDone)
        {
            var checkedCount = completed + partial + notDone;
            return checkedCount == 0 ? 0 : Math.Round((completed + 0.5 * partial) * 100.0 / checkedCount, 1);
        }

        var studentRows = perStudent
            .Select(kv =>
            {
                var st = students[kv.Key];
                var a = kv.Value;
                return new HwAnalyticsStudentDto(st.Id, st.StudentName, st.SchoolRollNumber ?? st.RollNumber ?? "",
                    a[0], a[1], a[2], a[3], a[4], a[5], Pct(a[1], a[2], a[3]));
            })
            .OrderBy(r => r.RollNumber).ThenBy(r => r.StudentName)
            .ToList();

        var subjectRows = perSubject
            .Select(kv => new HwAnalyticsSubjectDto(kv.Key, kv.Value[0], kv.Value[1], kv.Value[2], kv.Value[3], kv.Value[4], Pct(kv.Value[1], kv.Value[2], kv.Value[3])))
            .OrderBy(r => r.Subject)
            .ToList();

        int totAssigned = studentRows.Sum(r => r.Assigned), totDone = studentRows.Sum(r => r.Completed),
            totPartial = studentRows.Sum(r => r.Partial), totNot = studentRows.Sum(r => r.NotDone),
            totPending = studentRows.Sum(r => r.Pending), totAbs = studentRows.Sum(r => r.AbsentExcused);
        var checkedPct = totAssigned == 0 ? 0 : Math.Round((totAssigned - totPending) * 100.0 / totAssigned, 1);

        return Ok(new HwAnalyticsDto(fromDate, toDate,
            new HwAnalyticsSummaryDto(totAssigned, totDone, totPartial, totNot, totPending, totAbs, Pct(totDone, totPartial, totNot), checkedPct),
            studentRows, subjectRows));
    }


    private static readonly HashSet<string> AllowedHwStatuses = new(StringComparer.OrdinalIgnoreCase)
        { "Pending", "Completed", "Partial", "NotDone" };

    private static string NormalizeHwStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return "Pending";
        var match = AllowedHwStatuses.FirstOrDefault(s => s.Equals(status.Trim(), StringComparison.OrdinalIgnoreCase));
        return match ?? "Pending";
    }

    /// <summary>
    /// Cleans one student's C.W./H.W. list: drops empty points, stamps the assigning teacher,
    /// validates H.W. status and records who checked it and when (only when status really changed).
    /// </summary>
    private static List<DailySubjectTaskItem> NormalizeDiaryTasks(
        List<DailySubjectTaskItem>? incoming,
        string? existingJson,
        bool isHomework,
        Teacher? currentTeacher,
        Dictionary<string, (Guid TeacherId, string Name)> subjectTeacherMap,
        string? checkerName,
        DateTime now)
    {
        var result = new List<DailySubjectTaskItem>();
        if (incoming == null) return result;

        var previous = new List<DailySubjectTaskItem>();
        if (!string.IsNullOrWhiteSpace(existingJson))
        {
            try { previous = JsonSerializer.Deserialize<List<DailySubjectTaskItem>>(existingJson) ?? new(); } catch { }
        }

        foreach (var t in incoming)
        {
            if (string.IsNullOrWhiteSpace(t.Task)) continue;
            var subject = (t.Subject ?? string.Empty).Trim();
            var task = t.Task.Trim();

            var prev = previous.FirstOrDefault(p =>
                string.Equals((p.Subject ?? string.Empty).Trim(), subject, StringComparison.OrdinalIgnoreCase) &&
                string.Equals((p.Task ?? string.Empty).Trim(), task, StringComparison.OrdinalIgnoreCase));

            Guid? teacherId = null;
            string? teacherName = null;
            if (!string.IsNullOrWhiteSpace(t.TeacherName)) { teacherId = t.TeacherId; teacherName = t.TeacherName; }
            else if (subjectTeacherMap.TryGetValue(subject, out var st)) { teacherId = st.TeacherId; teacherName = st.Name; }
            else if (currentTeacher != null) { teacherId = currentTeacher.Id; teacherName = currentTeacher.FullName; }
            else if (!string.IsNullOrWhiteSpace(checkerName)) { teacherName = checkerName; }
            else if (prev != null && !string.IsNullOrWhiteSpace(prev.TeacherName)) { teacherId = prev.TeacherId; teacherName = prev.TeacherName; }

            string? status = null;
            string? remark = string.IsNullOrWhiteSpace(t.StatusRemark) ? null : t.StatusRemark.Trim();
            DateTime? checkedAt = null;
            string? checkedBy = null;
            if (isHomework)
            {
                status = NormalizeHwStatus(t.Status);
                var prevStatus = NormalizeHwStatus(prev?.Status);
                if (status == "Pending")
                {
                    checkedAt = null; checkedBy = null;
                }
                else if (prev != null && status == prevStatus && prev.CheckedAt.HasValue)
                {
                    checkedAt = prev.CheckedAt; checkedBy = prev.CheckedByName;
                }
                else
                {
                    checkedAt = now; checkedBy = checkerName;
                }
            }
            else
            {
                status = string.IsNullOrWhiteSpace(t.Status) ? null : t.Status.Trim();
            }

            result.Add(new DailySubjectTaskItem(subject, task, teacherId, teacherName, status, remark, checkedAt, checkedBy));
        }
        return result;
    }

    private async Task<Student?> ResolveCurrentStudentAsync()
    {
        var userId = _currentUser.UserId;
        var tenantId = _currentUser.TenantId;

        // 1. Direct link by UserId
        var student = await _db.Students.AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId && s.TenantId == tenantId);

        // 2. Direct link by ParentUserId
        if (student == null)
        {
            student = await _db.Students.AsNoTracking()
                .FirstOrDefaultAsync(s => s.ParentUserId == userId && s.TenantId == tenantId);
        }

        // 3. Fallback: match by user's phone or FullName
        if (student == null)
        {
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user != null)
            {
                student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s =>
                    s.TenantId == tenantId && (
                        (!string.IsNullOrEmpty(user.PhoneNumber) && (s.ParentWhatsAppPhone == user.PhoneNumber || s.EmergencyContactPhone == user.PhoneNumber)) ||
                        (!string.IsNullOrEmpty(user.FullName) && s.StudentName == user.FullName)
                    ));
            }
        }

        return student;
    }

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, List<string>> _transliterationCache = new(StringComparer.OrdinalIgnoreCase);
    private static readonly HttpClient _transliterationHttpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };

    [HttpGet("transliterate")]
    [AllowAnonymous]
    public async Task<IActionResult> Transliterate([FromQuery] string text, [FromQuery] int num = 4)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return Ok(new { success = true, result = "", candidates = Array.Empty<string>() });
        }

        var trimmed = text.Trim();
        if (_transliterationCache.TryGetValue(trimmed, out var cachedCandidates))
        {
            return Ok(new { success = true, result = cachedCandidates.FirstOrDefault() ?? trimmed, candidates = cachedCandidates });
        }

        try
        {
            var url = $"https://inputtools.google.com/request?text={Uri.EscapeDataString(trimmed)}&itc=hi-t-i0-und&num={num}&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage";
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

            var resp = await _transliterationHttpClient.SendAsync(req);
            if (resp.IsSuccessStatusCode)
            {
                var jsonStr = await resp.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(jsonStr);
                var root = doc.RootElement;
                if (root.ValueKind == JsonValueKind.Array && root.GetArrayLength() >= 2)
                {
                    var status = root[0].GetString();
                    if (status == "SUCCESS")
                    {
                        var dataArray = root[1];
                        if (dataArray.GetArrayLength() > 0)
                        {
                            var firstEntry = dataArray[0];
                            if (firstEntry.GetArrayLength() >= 2)
                            {
                                var candidatesElement = firstEntry[1];
                                var list = new List<string>();
                                foreach (var c in candidatesElement.EnumerateArray())
                                {
                                    var val = c.GetString();
                                    if (!string.IsNullOrEmpty(val)) list.Add(val);
                                }
                                if (list.Count > 0)
                                {
                                    _transliterationCache.TryAdd(trimmed, list);
                                    return Ok(new { success = true, result = list[0], candidates = list });
                                }
                            }
                        }
                    }
                }
            }
        }
        catch
        {
            // Fallback gracefully on timeout/network issue
        }

        return Ok(new { success = true, result = trimmed, candidates = new[] { trimmed } });
    }
}

