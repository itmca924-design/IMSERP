using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.API.Helpers;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
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
}

