using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SchoolController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IWhatsAppService _whatsAppService;

    public SchoolController(IIMSERPDbContext db, ICurrentUserService currentUser, IWhatsAppService whatsAppService)
    {
        _db = db;
        _currentUser = currentUser;
        _whatsAppService = whatsAppService;
    }

    #region Classes Management

    [HttpGet("classes")]
    public async Task<ActionResult<IEnumerable<SchoolClassDto>>> GetClasses([FromQuery] bool activeOnly = false)
    {
        var query = _db.SchoolClasses.AsNoTracking();
        if (activeOnly)
        {
            query = query.Where(c => c.IsActive);
        }

        var classes = await query
            .OrderBy(c => c.DisplayOrder)
            .ThenBy(c => c.Name)
            .Select(c => new SchoolClassDto(
                c.Id,
                c.TenantId,
                c.Name,
                c.Code,
                c.DisplayOrder,
                c.IsActive,
                c.CreatedAt,
                c.BranchId,
                c.Sections.Count,
                _db.Students.Count(s => s.ClassId == c.Id && s.IsActive),
                c.Sections.OrderBy(s => s.Name).Select(s => new SchoolSectionDto(
                    s.Id,
                    s.TenantId,
                    s.ClassId,
                    c.Name,
                    s.Name,
                    s.MaxCapacity,
                    s.RoomId,
                    s.Room != null ? s.Room.RoomNumber : null,
                    s.IsActive,
                    s.CreatedAt,
                    s.BranchId,
                    _db.Students.Count(st => st.SectionId == s.Id && st.IsActive),
                    s.ClassTeacherId,
                    s.ClassTeacher != null ? s.ClassTeacher.FullName : null,
                    s.ClassTeacher != null ? s.ClassTeacher.EmployeeCode : null,
                    s.ClassTeacher != null ? s.ClassTeacher.PhoneNumber : null
                )).ToList()
            ))
            .ToListAsync();

        return Ok(classes);
    }

    [HttpGet("classes/{id}")]
    public async Task<ActionResult<SchoolClassDto>> GetClassById(Guid id)
    {
        var c = await _db.SchoolClasses
            .Include(x => x.Sections)
                .ThenInclude(sec => sec.Room)
            .Include(x => x.Sections)
                .ThenInclude(sec => sec.ClassTeacher)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (c == null) return NotFound();

        var dto = new SchoolClassDto(
            c.Id,
            c.TenantId,
            c.Name,
            c.Code,
            c.DisplayOrder,
            c.IsActive,
            c.CreatedAt,
            c.BranchId,
            c.Sections.Count,
            await _db.Students.CountAsync(s => s.ClassId == c.Id && s.IsActive),
            c.Sections.OrderBy(s => s.Name).Select(s => new SchoolSectionDto(
                s.Id,
                s.TenantId,
                s.ClassId,
                c.Name,
                s.Name,
                s.MaxCapacity,
                s.RoomId,
                s.Room?.RoomNumber,
                s.IsActive,
                s.CreatedAt,
                s.BranchId,
                _db.Students.Count(st => st.SectionId == s.Id && st.IsActive),
                s.ClassTeacherId,
                s.ClassTeacher != null ? s.ClassTeacher.FullName : null,
                s.ClassTeacher != null ? s.ClassTeacher.EmployeeCode : null,
                s.ClassTeacher != null ? s.ClassTeacher.PhoneNumber : null
            )).ToList()
        );

        return Ok(dto);
    }

    [HttpPost("classes")]
    public async Task<ActionResult<SchoolClassDto>> CreateClass([FromBody] CreateSchoolClassDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { message = "Class name is required." });
        }

        var newClass = new SchoolClass
        {
            TenantId = _currentUser.TenantId,
            BranchId = dto.BranchId ?? _currentUser.BranchId,
            Name = dto.Name.Trim(),
            Code = dto.Code?.Trim(),
            DisplayOrder = dto.DisplayOrder,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.SchoolClasses.Add(newClass);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetClassById), new { id = newClass.Id }, new SchoolClassDto(
            newClass.Id,
            newClass.TenantId,
            newClass.Name,
            newClass.Code,
            newClass.DisplayOrder,
            newClass.IsActive,
            newClass.CreatedAt,
            newClass.BranchId,
            0,
            0,
            new List<SchoolSectionDto>()
        ));
    }

    [HttpPut("classes/{id}")]
    public async Task<IActionResult> UpdateClass(Guid id, [FromBody] UpdateSchoolClassDto dto)
    {
        var c = await _db.SchoolClasses.FindAsync(id);
        if (c == null) return NotFound();

        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { message = "Class name is required." });
        }

        c.Name = dto.Name.Trim();
        c.Code = dto.Code?.Trim();
        c.DisplayOrder = dto.DisplayOrder;
        c.IsActive = dto.IsActive;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("classes/{id}")]
    public async Task<IActionResult> DeleteClass(Guid id)
    {
        var c = await _db.SchoolClasses.Include(x => x.Sections).FirstOrDefaultAsync(x => x.Id == id);
        if (c == null) return NotFound();

        var studentCount = await _db.Students.CountAsync(s => s.ClassId == id);
        if (studentCount > 0)
        {
            return BadRequest(new { message = $"Cannot delete class with {studentCount} active students. Please transfer or reassign students first." });
        }

        _db.SchoolClasses.Remove(c);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Sections Management

    [HttpGet("sections")]
    public async Task<ActionResult<IEnumerable<SchoolSectionDto>>> GetSections([FromQuery] Guid? classId = null)
    {
        var query = _db.SchoolSections
            .Include(s => s.Class)
            .Include(s => s.Room)
            .Include(s => s.ClassTeacher)
            .AsNoTracking();
        if (classId.HasValue && classId.Value != Guid.Empty)
        {
            query = query.Where(s => s.ClassId == classId.Value);
        }

        var sections = await query
            .OrderBy(s => s.Class != null ? s.Class.DisplayOrder : 0)
            .ThenBy(s => s.Name)
            .Select(s => new SchoolSectionDto(
                s.Id,
                s.TenantId,
                s.ClassId,
                s.Class != null ? s.Class.Name : null,
                s.Name,
                s.MaxCapacity,
                s.RoomId,
                s.Room != null ? s.Room.RoomNumber : null,
                s.IsActive,
                s.CreatedAt,
                s.BranchId,
                _db.Students.Count(st => st.SectionId == s.Id && st.IsActive),
                s.ClassTeacherId,
                s.ClassTeacher != null ? s.ClassTeacher.FullName : null,
                s.ClassTeacher != null ? s.ClassTeacher.EmployeeCode : null,
                s.ClassTeacher != null ? s.ClassTeacher.PhoneNumber : null
            ))
            .ToListAsync();

        return Ok(sections);
    }

    [HttpPost("sections")]
    public async Task<ActionResult<SchoolSectionDto>> CreateSection([FromBody] CreateSchoolSectionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { message = "Section name is required." });
        }

        var parentClass = await _db.SchoolClasses.FindAsync(dto.ClassId);
        if (parentClass == null)
        {
            return BadRequest(new { message = "Selected class not found." });
        }

        var section = new SchoolSection
        {
            TenantId = _currentUser.TenantId,
            BranchId = dto.BranchId ?? _currentUser.BranchId,
            ClassId = dto.ClassId,
            Name = dto.Name.Trim(),
            MaxCapacity = dto.MaxCapacity > 0 ? dto.MaxCapacity : 45,
            RoomId = dto.RoomId,
            ClassTeacherId = dto.ClassTeacherId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.SchoolSections.Add(section);
        await _db.SaveChangesAsync();

        string? roomNumber = null;
        if (section.RoomId.HasValue)
        {
            var room = await _db.Rooms.FindAsync(section.RoomId.Value);
            roomNumber = room?.RoomNumber;
        }

        string? classTeacherName = null;
        string? classTeacherCode = null;
        string? classTeacherPhone = null;
        if (section.ClassTeacherId.HasValue)
        {
            var teacher = await _db.Teachers.FindAsync(section.ClassTeacherId.Value);
            classTeacherName = teacher?.FullName;
            classTeacherCode = teacher?.EmployeeCode;
            classTeacherPhone = teacher?.PhoneNumber;
        }

        return Ok(new SchoolSectionDto(
            section.Id,
            section.TenantId,
            section.ClassId,
            parentClass.Name,
            section.Name,
            section.MaxCapacity,
            section.RoomId,
            roomNumber,
            section.IsActive,
            section.CreatedAt,
            section.BranchId,
            0,
            section.ClassTeacherId,
            classTeacherName,
            classTeacherCode,
            classTeacherPhone
        ));
    }

    [HttpPut("sections/{id}")]
    public async Task<IActionResult> UpdateSection(Guid id, [FromBody] UpdateSchoolSectionDto dto)
    {
        var section = await _db.SchoolSections.FindAsync(id);
        if (section == null) return NotFound();

        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { message = "Section name is required." });
        }

        section.Name = dto.Name.Trim();
        section.MaxCapacity = dto.MaxCapacity > 0 ? dto.MaxCapacity : 45;
        section.RoomId = dto.RoomId;
        section.ClassTeacherId = dto.ClassTeacherId;
        section.IsActive = dto.IsActive;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("sections/{id}")]
    public async Task<IActionResult> DeleteSection(Guid id)
    {
        var section = await _db.SchoolSections.FindAsync(id);
        if (section == null) return NotFound();

        var studentCount = await _db.Students.CountAsync(s => s.SectionId == id);
        if (studentCount > 0)
        {
            return BadRequest(new { message = $"Cannot delete section with {studentCount} assigned students. Please reassign students first." });
        }

        _db.SchoolSections.Remove(section);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("class-teachers-matrix")]
    public async Task<ActionResult<IEnumerable<ClassTeacherMatrixItemDto>>> GetClassTeachersMatrix()
    {
        var classes = await _db.SchoolClasses
            .Include(c => c.Sections)
                .ThenInclude(s => s.ClassTeacher)
            .OrderBy(c => c.DisplayOrder)
            .ThenBy(c => c.Name)
            .ToListAsync();

        var studentCounts = await _db.Students
            .Where(st => st.SectionId.HasValue && st.IsActive)
            .GroupBy(st => st.SectionId!.Value)
            .Select(g => new { SectionId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SectionId, x => x.Count);

        var sectionAssignments = await _db.TeacherBatchAssignments
            .Where(a => a.SectionId.HasValue && a.IsActive)
            .Select(a => new { a.SectionId, a.Subject })
            .ToListAsync();

        var subjectsBySection = sectionAssignments
            .GroupBy(a => a.SectionId!.Value)
            .ToDictionary(
                g => g.Key,
                g => g.Select(x => x.Subject).Where(s => !string.IsNullOrWhiteSpace(s)).Distinct().ToList()
            );

        var periodCountsBySection = sectionAssignments
            .GroupBy(a => a.SectionId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());

        var matrix = new List<ClassTeacherMatrixItemDto>();
        foreach (var c in classes)
        {
            foreach (var s in c.Sections.OrderBy(s => s.Name))
            {
                var studentCount = studentCounts.GetValueOrDefault(s.Id, 0);
                var assignedSubjects = subjectsBySection.GetValueOrDefault(s.Id, new List<string>());
                var periodsCount = periodCountsBySection.GetValueOrDefault(s.Id, 0);

                matrix.Add(new ClassTeacherMatrixItemDto(
                    s.Id,
                    s.Name,
                    c.Id,
                    c.Name,
                    s.MaxCapacity,
                    studentCount,
                    s.ClassTeacherId,
                    s.ClassTeacher?.FullName,
                    s.ClassTeacher?.EmployeeCode,
                    s.ClassTeacher?.PhoneNumber,
                    s.IsActive,
                    assignedSubjects,
                    periodsCount
                ));
            }
        }
        return Ok(matrix);
    }

    [HttpGet("sections/{sectionId}/routine")]
    public async Task<ActionResult<IEnumerable<SectionPeriodRoutineDto>>> GetSectionRoutine(Guid sectionId)
    {
        var section = await _db.SchoolSections
            .Include(s => s.Class)
            .FirstOrDefaultAsync(s => s.Id == sectionId);
        if (section == null) return NotFound(new { message = "Section not found." });

        var assignments = await _db.TeacherBatchAssignments
            .Include(a => a.Teacher)
            .Where(a => a.SectionId == sectionId && a.IsActive)
            .OrderBy(a => a.TimeSlot)
            .ThenBy(a => a.Subject)
            .ToListAsync();

        var list = assignments.Select(a => new SectionPeriodRoutineDto(
            a.Id,
            section.Id,
            section.Name,
            section.ClassId,
            section.Class?.Name ?? "Class",
            a.TeacherId,
            a.Teacher?.FullName ?? "Unknown",
            a.Teacher?.EmployeeCode ?? "N/A",
            a.Teacher?.PhoneNumber,
            a.Subject,
            a.DaysOfWeek,
            a.TimeSlot,
            section.ClassTeacherId == a.TeacherId,
            a.AssignedAt
        )).ToList();

        return Ok(list);
    }

    [HttpPost("sections/{sectionId}/routine")]
    public async Task<ActionResult<SectionPeriodRoutineDto>> AddSectionPeriod(Guid sectionId, [FromBody] CreateSectionPeriodRequestDto dto)
    {
        var section = await _db.SchoolSections
            .Include(s => s.Class)
            .FirstOrDefaultAsync(s => s.Id == sectionId);
        if (section == null) return NotFound(new { message = "Section not found." });

        var teacher = await _db.Teachers.FindAsync(dto.TeacherId);
        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        var isFnFSettled = await _db.TeacherFnFSettlements.AnyAsync(s => s.TeacherId == dto.TeacherId && s.Status == "Settled");
        if (!teacher.IsActive || isFnFSettled)
        {
            return BadRequest(new { message = $"Cannot assign period to {teacher.FullName}: Faculty member is inactive or offboarded (FnF settled)." });
        }

        // Clash Detection: Check if another teacher is already scheduled in this section at this time slot
        if (!dto.AllowClashOverride && !string.IsNullOrWhiteSpace(dto.TimeSlot) && !string.IsNullOrWhiteSpace(dto.DaysOfWeek))
        {
            var newDays = dto.DaysOfWeek.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var existingSectionPeriods = await _db.TeacherBatchAssignments
                .Include(a => a.Teacher)
                .Where(a => a.SectionId == sectionId && a.IsActive && a.TimeSlot == dto.TimeSlot.Trim() && (!dto.ReplaceExistingAssignmentId.HasValue || a.Id != dto.ReplaceExistingAssignmentId.Value))
                .ToListAsync();

            foreach (var existing in existingSectionPeriods)
            {
                if (!string.IsNullOrWhiteSpace(existing.DaysOfWeek))
                {
                    var existingDays = existing.DaysOfWeek.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                    var commonDays = newDays.Intersect(existingDays, StringComparer.OrdinalIgnoreCase).ToList();
                    if (commonDays.Any())
                    {
                        var assignedTeacherName = existing.Teacher?.FullName ?? "Unknown Faculty";
                        var msg = existing.TeacherId != dto.TeacherId
                            ? $"इस Class में इस समय ({existing.TimeSlot}) पर पहले से ही दूसरे अध्यापक {assignedTeacherName} ({existing.Subject}) को assign किया जा चुका है।"
                            : $"इस Class में इस समय ({existing.TimeSlot}) पर {assignedTeacherName} पहले से ही {existing.Subject} पढ़ा रहे हैं।";

                        return Conflict(new {
                            message = msg,
                            existingAssignmentId = existing.Id,
                            existingTeacherName = assignedTeacherName,
                            existingSubject = existing.Subject,
                            requiresOverride = false,
                            canReplace = existing.TeacherId != dto.TeacherId
                        });
                    }
                }
            }

            // Clash Detection 2: Check if teacher has an existing overlapping assignment elsewhere
            var existingTeacherAssignments = await _db.TeacherBatchAssignments
                .Include(a => a.Batch)
                .Include(a => a.Class)
                .Include(a => a.Section)
                .Where(a => a.TeacherId == dto.TeacherId && a.IsActive && a.TimeSlot == dto.TimeSlot.Trim() && (!dto.ReplaceExistingAssignmentId.HasValue || a.Id != dto.ReplaceExistingAssignmentId.Value))
                .ToListAsync();

            foreach (var existing in existingTeacherAssignments)
            {
                if (!string.IsNullOrWhiteSpace(existing.DaysOfWeek))
                {
                    var existingDays = existing.DaysOfWeek.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                    var commonDays = newDays.Intersect(existingDays, StringComparer.OrdinalIgnoreCase).ToList();
                    if (commonDays.Any())
                    {
                        var targetName = existing.Batch != null ? existing.Batch.Name : $"{existing.Class?.Name} - {existing.Section?.Name}";
                        return Conflict(new {
                            message = $"Schedule Clash: {teacher.FullName} is already scheduled for {targetName} ({existing.Subject}) on {string.Join(", ", commonDays)} at {existing.TimeSlot}.",
                            clashDetails = $"Occupied by {targetName}",
                            requiresOverride = true
                        });
                    }
                }
            }
        }

        TeacherBatchAssignment assignment;
        if (dto.ReplaceExistingAssignmentId.HasValue)
        {
            assignment = await _db.TeacherBatchAssignments.FindAsync(dto.ReplaceExistingAssignmentId.Value)
                ?? new TeacherBatchAssignment { TenantId = _currentUser.TenantId, ClassId = section.ClassId, SectionId = section.Id, IsActive = true };

            assignment.TeacherId = dto.TeacherId;
            assignment.Subject = dto.Subject.Trim();
            assignment.DaysOfWeek = dto.DaysOfWeek?.Trim();
            assignment.TimeSlot = dto.TimeSlot?.Trim();
            assignment.AssignedAt = DateTime.UtcNow;

            if (assignment.Id == Guid.Empty)
            {
                _db.TeacherBatchAssignments.Add(assignment);
            }
        }
        else
        {
            assignment = new TeacherBatchAssignment
            {
                TenantId = _currentUser.TenantId,
                TeacherId = dto.TeacherId,
                ClassId = section.ClassId,
                SectionId = section.Id,
                Subject = dto.Subject.Trim(),
                DaysOfWeek = dto.DaysOfWeek?.Trim(),
                TimeSlot = dto.TimeSlot?.Trim(),
                IsActive = true,
                AssignedAt = DateTime.UtcNow
            };
            _db.TeacherBatchAssignments.Add(assignment);
        }

        await _db.SaveChangesAsync();

        var resultDto = new SectionPeriodRoutineDto(
            assignment.Id,
            section.Id,
            section.Name,
            section.ClassId,
            section.Class?.Name ?? "Class",
            teacher.Id,
            teacher.FullName,
            teacher.EmployeeCode,
            teacher.PhoneNumber,
            assignment.Subject,
            assignment.DaysOfWeek,
            assignment.TimeSlot,
            section.ClassTeacherId == teacher.Id,
            assignment.AssignedAt
        );

        return Ok(resultDto);
    }

    [HttpPut("sections/routine/{assignmentId}")]
    public async Task<ActionResult<SectionPeriodRoutineDto>> UpdateSectionPeriod(Guid assignmentId, [FromBody] CreateSectionPeriodRequestDto dto)
    {
        var assignment = await _db.TeacherBatchAssignments
            .Include(a => a.Section)
                .ThenInclude(s => s.Class)
            .FirstOrDefaultAsync(a => a.Id == assignmentId);

        if (assignment == null) return NotFound(new { message = "Period assignment not found." });

        var teacher = await _db.Teachers.FindAsync(dto.TeacherId);
        if (teacher == null) return NotFound(new { message = "Teacher not found." });

        var isFnFSettled = await _db.TeacherFnFSettlements.AnyAsync(s => s.TeacherId == dto.TeacherId && s.Status == "Settled");
        if (!teacher.IsActive || isFnFSettled)
        {
            return BadRequest(new { message = $"Cannot assign period to {teacher.FullName}: Faculty member is inactive or offboarded (FnF settled)." });
        }

        assignment.TeacherId = dto.TeacherId;
        assignment.Subject = dto.Subject.Trim();
        assignment.DaysOfWeek = dto.DaysOfWeek?.Trim();
        assignment.TimeSlot = dto.TimeSlot?.Trim();
        assignment.AssignedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        var isClassTeacher = assignment.Section?.ClassTeacherId == teacher.Id;
        return Ok(new SectionPeriodRoutineDto(
            assignment.Id,
            assignment.SectionId ?? Guid.Empty,
            assignment.Section?.Name ?? "Section",
            assignment.ClassId ?? Guid.Empty,
            assignment.Section?.Class?.Name ?? "Class",
            teacher.Id,
            teacher.FullName,
            teacher.EmployeeCode,
            teacher.PhoneNumber,
            assignment.Subject,
            assignment.DaysOfWeek,
            assignment.TimeSlot,
            isClassTeacher,
            assignment.AssignedAt
        ));
    }

    [HttpDelete("sections/routine/{assignmentId}")]
    public async Task<IActionResult> RemoveSectionPeriod(Guid assignmentId)
    {
        var assignment = await _db.TeacherBatchAssignments.FindAsync(assignmentId);
        if (assignment == null) return NotFound(new { message = "Period assignment not found." });

        _db.TeacherBatchAssignments.Remove(assignment);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("sections/{id}/class-teacher")]
    public async Task<IActionResult> QuickAssignClassTeacher(Guid id, [FromBody] QuickAssignClassTeacherDto dto)
    {
        var section = await _db.SchoolSections
            .Include(s => s.Class)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (section == null) return NotFound(new { message = "Section not found." });

        if (dto.ClassTeacherId.HasValue)
        {
            var teacher = await _db.Teachers.FindAsync(dto.ClassTeacherId.Value);
            if (teacher == null) return NotFound(new { message = "Teacher not found." });

            var isFnFSettled = await _db.TeacherFnFSettlements.AnyAsync(s => s.TeacherId == dto.ClassTeacherId.Value && s.Status == "Settled");
            if (!teacher.IsActive || isFnFSettled)
            {
                return BadRequest(new { message = $"Cannot assign {teacher.FullName}: Faculty member is inactive or offboarded (FnF settled)." });
            }

            // Check if teacher is already assigned to another active section
            var existingAssignment = await _db.SchoolSections
                .Include(s => s.Class)
                .FirstOrDefaultAsync(s => s.ClassTeacherId == dto.ClassTeacherId.Value && s.Id != id && s.IsActive);

            if (existingAssignment != null)
            {
                if (!dto.ForceReassign)
                {
                    return Conflict(new {
                        message = $"{teacher.FullName} is already assigned as Class Teacher for {existingAssignment.Class?.Name} - {existingAssignment.Name}.",
                        alreadyAssignedSectionId = existingAssignment.Id,
                        alreadyAssignedSectionName = $"{existingAssignment.Class?.Name} - {existingAssignment.Name}",
                        teacherName = teacher.FullName,
                        requiresConfirmation = true
                    });
                }
                else
                {
                    // Reassign: Clear old assignment
                    existingAssignment.ClassTeacherId = null;
                }
            }

            section.ClassTeacherId = dto.ClassTeacherId.Value;
        }
        else
        {
            section.ClassTeacherId = null;
        }

        await _db.SaveChangesAsync();

        var updatedTeacher = section.ClassTeacherId.HasValue ? await _db.Teachers.FindAsync(section.ClassTeacherId.Value) : null;
        return Ok(new {
            sectionId = section.Id,
            sectionName = section.Name,
            className = section.Class?.Name,
            classTeacherId = section.ClassTeacherId,
            classTeacherName = updatedTeacher?.FullName,
            classTeacherEmployeeCode = updatedTeacher?.EmployeeCode,
            classTeacherPhone = updatedTeacher?.PhoneNumber,
            message = section.ClassTeacherId.HasValue
                ? $"Assigned {updatedTeacher?.FullName} as Class Teacher for {section.Class?.Name} - {section.Name}."
                : $"Unassigned Class Teacher for {section.Class?.Name} - {section.Name}."
        });
    }

    #endregion

    #region School + Coaching Integration & Dual Enrollment

    [HttpGet("students/search")]
    public async Task<ActionResult<IEnumerable<object>>> SearchSchoolStudents([FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2)
        {
            return Ok(new List<object>());
        }

        var q = query.Trim().ToLower();
        var students = await _db.Students
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .Where(s => s.IsActive && (
                s.StudentName.ToLower().Contains(q) ||
                (s.AdmissionNumber != null && s.AdmissionNumber.ToLower().Contains(q)) ||
                (s.RollNumber.ToLower().Contains(q)) ||
                (s.ParentWhatsAppPhone.Contains(q))
            ))
            .Take(15)
            .Select(s => new
            {
                s.Id,
                s.StudentName,
                s.ParentName,
                s.ParentWhatsAppPhone,
                s.Address,
                s.ProfilePhoto,
                s.AdmissionNumber,
                s.SchoolRollNumber,
                s.CoachingRollNumber,
                s.IsSchoolStudent,
                s.IsCoachingStudent,
                ClassId = s.ClassId,
                ClassName = s.Class != null ? s.Class.Name : null,
                SectionId = s.SectionId,
                SectionName = s.Section != null ? s.Section.Name : null,
                BatchId = s.BatchId,
                BatchName = s.Batch != null ? s.Batch.Name : null
            })
            .ToListAsync();

        return Ok(students);
    }

    [HttpPost("students/enroll-coaching")]
    public async Task<ActionResult<object>> EnrollSchoolStudentInCoaching([FromBody] EnrollSchoolStudentInCoachingDto dto)
    {
        var student = await _db.Students
            .Include(s => s.Class)
            .Include(s => s.Section)
            .FirstOrDefaultAsync(s => s.Id == dto.StudentId);

        if (student == null)
        {
            return NotFound(new { message = "Student not found." });
        }

        var batch = await _db.Batches.FindAsync(dto.BatchId);
        if (batch == null)
        {
            return BadRequest(new { message = "Selected coaching batch not found." });
        }

        // Assign coaching batch and mark as coaching student
        student.BatchId = dto.BatchId;
        student.IsCoachingStudent = true;

        // Preserve school roll number if currently in RollNumber
        if (string.IsNullOrWhiteSpace(student.SchoolRollNumber) && !string.IsNullOrWhiteSpace(student.RollNumber) && !student.RollNumber.StartsWith("CH"))
        {
            student.SchoolRollNumber = student.RollNumber;
        }

        if (!string.IsNullOrWhiteSpace(dto.CoachingRollNumber))
        {
            student.CoachingRollNumber = dto.CoachingRollNumber.Trim();
        }
        else
        {
            // Build batch-wise roll number using AcademicYear (e.g. "2026-2027" => "2027")
            var ayParts = batch.AcademicYear?.Split('-');
            var ayShort = ayParts != null && ayParts.Length >= 2
                ? ayParts[^1].Trim()
                : (batch.AcademicYear ?? DateTime.UtcNow.Year.ToString());

            // Anti-duplicate: find existing roll numbers in this batch to determine max sequence
            var existingRolls = await _db.Students
                .AsNoTracking()
                .Where(s => s.BatchId == dto.BatchId && s.Id != student.Id)
                .Select(s => new { s.RollNumber, s.CoachingRollNumber })
                .ToListAsync();

            int maxSeq = 0;
            foreach (var item in existingRolls)
            {
                var rollStr = !string.IsNullOrWhiteSpace(item.CoachingRollNumber) ? item.CoachingRollNumber : item.RollNumber;
                if (!string.IsNullOrWhiteSpace(rollStr))
                {
                    var dashIndex = rollStr.LastIndexOf('-');
                    if (dashIndex >= 0 && dashIndex < rollStr.Length - 1)
                    {
                        if (int.TryParse(rollStr.Substring(dashIndex + 1), out int parsedNum))
                        {
                            if (parsedNum > maxSeq) maxSeq = parsedNum;
                        }
                    }
                }
            }

            int nextSeq = Math.Max(maxSeq + 1, existingRolls.Count + 1);
            var rollNumber = $"CH{ayShort}-{nextSeq:D3}";

            // Guarantee uniqueness across the whole tenant
            while (await _db.Students.AsNoTracking().AnyAsync(s => (s.RollNumber == rollNumber || s.CoachingRollNumber == rollNumber) && s.Id != student.Id))
            {
                nextSeq++;
                rollNumber = $"CH{ayShort}-{nextSeq:D3}";
            }

            student.CoachingRollNumber = rollNumber;
        }



        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"Student '{student.StudentName}' successfully enrolled into coaching batch '{batch.Name}'.",
            studentId = student.Id,
            studentName = student.StudentName,
            batchId = batch.Id,
            batchName = batch.Name,
            coachingRollNumber = student.CoachingRollNumber,
            isSchoolStudent = student.IsSchoolStudent,
            isCoachingStudent = student.IsCoachingStudent
        });
    }

    [HttpGet("stats")]
    public async Task<ActionResult<object>> GetUnifiedStats()
    {
        var totalSchoolStudents = await _db.Students.CountAsync(s => s.IsActive && s.IsSchoolStudent);
        var totalCoachingStudents = await _db.Students.CountAsync(s => s.IsActive && s.IsCoachingStudent);
        var dualEnrolledStudents = await _db.Students.CountAsync(s => s.IsActive && s.IsSchoolStudent && s.IsCoachingStudent);
        var totalClasses = await _db.SchoolClasses.CountAsync(c => c.IsActive);
        var totalBatches = await _db.Batches.CountAsync();

        return Ok(new
        {
            TotalSchoolStudents = totalSchoolStudents,
            TotalCoachingStudents = totalCoachingStudents,
            DualEnrolledStudents = dualEnrolledStudents,
            TotalClasses = totalClasses,
            TotalBatches = totalBatches
        });
    }

    #endregion

    #region Student Promotion & Academic Transition

    [HttpGet("promotions/class-exams")]
    public async Task<ActionResult<List<ClassExamDto>>> GetClassExams(
        [FromQuery] Guid classId,
        [FromQuery] string? academicYear)
    {
        if (classId == Guid.Empty)
            return BadRequest(new { message = "ClassId is required." });

        var query = _db.Tests
            .AsNoTracking()
            .Include(t => t.MarksList)
            .Where(t => t.ClassId == classId);

        if (!string.IsNullOrWhiteSpace(academicYear))
        {
            query = query.Where(t => t.AcademicYear == academicYear);
        }

        var exams = await query
            .OrderByDescending(t => t.TestDate)
            .Select(t => new ClassExamDto(
                t.Id,
                t.Title,
                t.Subject,
                t.ExamType,
                t.AcademicYear,
                t.MaxMarks,
                t.PassingMarks,
                t.TestDate,
                t.MarksList.Count
            ))
            .ToListAsync();

        return Ok(exams);
    }

    [HttpGet("promotions/candidates")]
    public async Task<ActionResult<List<PromotionCandidateDto>>> GetPromotionCandidates(
        [FromQuery] Guid fromClassId,
        [FromQuery] Guid? fromSectionId,
        [FromQuery] string? academicYear,
        [FromQuery] Guid? examId,
        [FromQuery] decimal? passingPercentage = null)
    {
        if (fromClassId == Guid.Empty)
            return BadRequest(new { message = "FromClassId is required." });

        var setting = await _db.ExamSettings.FirstOrDefaultAsync();
        decimal effectivePassingPct = passingPercentage.HasValue && passingPercentage.Value > 0
            ? passingPercentage.Value
            : (setting?.PassingPercentage ?? 33m);
        int effectiveCompartmentMax = setting?.MaxCompartmentSubjects ?? 2;
        bool allowGrace = setting?.AllowGraceMarks ?? true;
        int maxGrace = setting?.MaxGraceMarks ?? 5;

        var query = _db.Students
            .AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .Include(s => s.FeeInvoices)
            .Include(s => s.Attendances)
            .Where(s => s.IsActive && s.IsSchoolStudent && s.ClassId == fromClassId);

        if (fromSectionId.HasValue && fromSectionId.Value != Guid.Empty)
        {
            query = query.Where(s => s.SectionId == fromSectionId.Value);
        }

        var students = await query
            .OrderBy(s => s.SchoolRollNumber != null && s.SchoolRollNumber != "" ? s.SchoolRollNumber : s.RollNumber)
            .ThenBy(s => s.StudentName)
            .ToListAsync();

        // Exam evaluation logic
        List<Test> evaluatedTests = new();
        if (examId.HasValue && examId.Value != Guid.Empty)
        {
            var test = await _db.Tests
                .AsNoTracking()
                .Include(t => t.MarksList)
                .FirstOrDefaultAsync(t => t.Id == examId.Value);
            if (test != null) evaluatedTests.Add(test);
        }
        else if (!string.IsNullOrWhiteSpace(academicYear))
        {
            evaluatedTests = await _db.Tests
                .AsNoTracking()
                .Include(t => t.MarksList)
                .Where(t => t.ClassId == fromClassId && t.AcademicYear == academicYear)
                .ToListAsync();
        }
        else
        {
            evaluatedTests = await _db.Tests
                .AsNoTracking()
                .Include(t => t.MarksList)
                .Where(t => t.ClassId == fromClassId)
                .OrderByDescending(t => t.TestDate)
                .Take(5)
                .ToListAsync();
        }

        var result = students.Select(s =>
        {
            var totalDues = s.FeeInvoices.Sum(f => f.TotalAmount - f.PaidAmount);
            var totalAttendances = s.Attendances.Count;
            var presentAttendances = s.Attendances.Count(a => a.Status == TeacherAttendanceStatus.Present);
            var attPct = totalAttendances > 0 ? (int)Math.Round((double)presentAttendances / totalAttendances * 100) : 100;

            // Compute exam marks for student
            decimal? examMarksObtained = null;
            decimal? examMaxMarks = null;
            decimal? examPercentage = null;
            string? examResultStatus = null;
            string? examGrade = null;
            string suggestedStatus = "Promoted";

            if (evaluatedTests.Any())
            {
                var studentMarks = evaluatedTests
                    .SelectMany(t => t.MarksList.Where(m => m.StudentId == s.Id).Select(m => new { Test = t, Mark = m }))
                    .ToList();

                if (studentMarks.Any())
                {
                    decimal totalMax = studentMarks.Sum(x => x.Test.MaxMarks);
                    decimal totalObt = studentMarks.Where(x => !x.Mark.IsAbsent).Sum(x => x.Mark.MarksObtained);
                    bool hasAbsent = studentMarks.Any(x => x.Mark.IsAbsent);
                    int failedSubjects = 0;
                    decimal totalDeficit = 0;

                    foreach (var sm in studentMarks)
                    {
                        decimal testPass = sm.Test.PassingMarks > 0 ? sm.Test.PassingMarks : Math.Round(sm.Test.MaxMarks * (effectivePassingPct / 100m), 1);
                        if (sm.Mark.IsAbsent || sm.Mark.MarksObtained < testPass)
                        {
                            failedSubjects++;
                            if (!sm.Mark.IsAbsent)
                            {
                                totalDeficit += (testPass - sm.Mark.MarksObtained);
                            }
                        }
                    }

                    examMarksObtained = totalObt;
                    examMaxMarks = totalMax;
                    examPercentage = totalMax > 0 ? Math.Round((totalObt / totalMax) * 100, 1) : 0;

                    // Determine grade
                    if (examPercentage >= 90) examGrade = "A+";
                    else if (examPercentage >= 80) examGrade = "A";
                    else if (examPercentage >= 70) examGrade = "B";
                    else if (examPercentage >= 60) examGrade = "C";
                    else if (examPercentage >= effectivePassingPct) examGrade = "D";
                    else examGrade = "F";

                    if (hasAbsent && totalObt == 0)
                    {
                        examResultStatus = "Absent";
                        suggestedStatus = "Detained";
                    }
                    else if (failedSubjects == 0 && examPercentage >= effectivePassingPct)
                    {
                        examResultStatus = "Passed";
                        suggestedStatus = "Promoted";
                    }
                    else if (failedSubjects <= effectiveCompartmentMax && failedSubjects > 0)
                    {
                        if (allowGrace && failedSubjects == 1 && totalDeficit > 0 && totalDeficit <= maxGrace)
                        {
                            examResultStatus = "Passed with Grace";
                            suggestedStatus = "Passed with Grace";
                        }
                        else
                        {
                            examResultStatus = "Compartment";
                            suggestedStatus = "Detained";
                        }
                    }
                    else
                    {
                        examResultStatus = "Failed";
                        suggestedStatus = "Detained";
                    }
                }
                else
                {
                    examResultStatus = "No Exam Record";
                    suggestedStatus = "Promoted";
                }
            }
            else
            {
                examResultStatus = "No Exam Record";
                suggestedStatus = "Promoted";
            }


            return new PromotionCandidateDto(
                s.Id,
                s.StudentName,
                s.AdmissionNumber ?? "N/A",
                s.RollNumber,
                s.SchoolRollNumber,
                s.CoachingRollNumber,
                s.ClassId ?? Guid.Empty,
                s.Class?.Name ?? "Class",
                s.SectionId,
                s.Section?.Name,
                s.ParentName,
                s.ParentWhatsAppPhone,
                s.Gender,
                s.ProfilePhoto,
                totalDues,
                attPct,
                s.IsCoachingStudent,
                s.BatchId,
                s.Batch?.Name,
                examMarksObtained,
                examMaxMarks,
                examPercentage,
                examResultStatus,
                examGrade,
                suggestedStatus
            );
        }).ToList();

        return Ok(result);
    }

    [HttpPost("promotions/execute")]
    public async Task<ActionResult<PromotionExecutionResultDto>> ExecutePromotion([FromBody] ExecutePromotionRequestDto dto)
    {
        if (dto.FromClassId == Guid.Empty || dto.ToClassId == Guid.Empty)
            return BadRequest(new { message = "FromClassId and ToClassId are required." });

        if (dto.Promotions == null || dto.Promotions.Count == 0)
            return BadRequest(new { message = "No students selected for promotion." });

        var fromClass = await _db.SchoolClasses.FindAsync(dto.FromClassId);
        var toClass = await _db.SchoolClasses.FindAsync(dto.ToClassId);

        if (fromClass == null || toClass == null)
            return BadRequest(new { message = "Invalid source or destination class." });

        int fromRank = GetClassRank(fromClass);
        int toRank = GetClassRank(toClass);
        if (toRank <= fromRank)
        {
            return BadRequest(new { message = $"Destination class '{toClass.Name}' must be a higher grade than source class '{fromClass.Name}'. Promoting into the same or a lower class is not permitted." });
        }

        int promotedCount = 0;
        int detainedCount = 0;
        var promotedIds = new List<Guid>();

        foreach (var item in dto.Promotions)
        {
            var student = await _db.Students
                .Include(s => s.Class)
                .Include(s => s.Section)
                .FirstOrDefaultAsync(s => s.Id == item.StudentId);

            if (student == null) continue;

            var oldClassId = student.ClassId ?? dto.FromClassId;
            var oldSectionId = student.SectionId;
            var oldRollNumber = !string.IsNullOrWhiteSpace(student.SchoolRollNumber) ? student.SchoolRollNumber : student.RollNumber;

            var history = new StudentPromotionHistory
            {
                TenantId = _currentUser.TenantId,
                BranchId = student.BranchId,
                StudentId = student.Id,
                FromClassId = oldClassId,
                FromSectionId = oldSectionId,
                FromRollNumber = oldRollNumber,
                FromAcademicYear = !string.IsNullOrWhiteSpace(dto.FromAcademicYear) ? dto.FromAcademicYear : "2025-2026",
                ToClassId = dto.ToClassId,
                ToSectionId = dto.ToSectionId,
                ToRollNumber = item.NewRollNumber,
                ToAcademicYear = !string.IsNullOrWhiteSpace(dto.ToAcademicYear) ? dto.ToAcademicYear : "2026-2027",
                ResultStatus = item.ResultStatus ?? "Promoted",
                PromotionDate = DateTime.UtcNow,
                PromotedBy = User.Identity?.Name ?? _currentUser.UserRole ?? "Administrator",
                Remarks = !string.IsNullOrWhiteSpace(item.Remarks) ? item.Remarks : $"Promoted from {fromClass.Name} to {toClass.Name}",
                ExamPercentage = item.ExamPercentage,
                ExamTotalMarks = item.ExamTotalMarks,
                ExamGrade = item.ExamGrade,
                ExamResultStatus = item.ExamResultStatus
            };

            _db.StudentPromotionHistories.Add(history);

            if (item.ResultStatus == "Promoted" || item.ResultStatus == "Passed with Grace" || item.ResultStatus == "Double Promoted")
            {
                student.ClassId = dto.ToClassId;
                student.SectionId = dto.ToSectionId;

                if (!string.IsNullOrWhiteSpace(item.NewRollNumber))
                {
                    student.SchoolRollNumber = item.NewRollNumber.Trim();
                    if (!student.IsCoachingStudent || string.IsNullOrWhiteSpace(student.CoachingRollNumber))
                    {
                        student.RollNumber = item.NewRollNumber.Trim();
                    }
                }

                promotedCount++;
                promotedIds.Add(student.Id);
            }
            else if (item.ResultStatus == "Detained")
            {
                detainedCount++;
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new PromotionExecutionResultDto(
            dto.Promotions.Count,
            promotedCount,
            detainedCount,
            $"Promotion successfully executed! {promotedCount} student(s) promoted to {toClass.Name}, {detainedCount} detained.",
            promotedIds
        ));
    }

    [HttpGet("promotions/history")]
    public async Task<ActionResult<object>> GetPromotionHistory(
        [FromQuery] Guid? classId,
        [FromQuery] string? academicYear,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = _db.StudentPromotionHistories
            .AsNoTracking()
            .Include(p => p.Student)
            .Include(p => p.FromClass)
            .Include(p => p.FromSection)
            .Include(p => p.ToClass)
            .Include(p => p.ToSection)
            .AsQueryable();

        if (classId.HasValue && classId.Value != Guid.Empty)
        {
            query = query.Where(p => p.FromClassId == classId.Value || p.ToClassId == classId.Value);
        }

        if (!string.IsNullOrWhiteSpace(academicYear))
        {
            query = query.Where(p => p.ToAcademicYear == academicYear || p.FromAcademicYear == academicYear);
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(p => p.PromotionDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new StudentPromotionHistoryDto(
                p.Id,
                p.StudentId,
                p.Student != null ? p.Student.StudentName : "Unknown",
                p.Student != null ? (p.Student.AdmissionNumber ?? "N/A") : "N/A",
                p.FromClassId,
                p.FromClass != null ? p.FromClass.Name : "Class",
                p.FromSectionId,
                p.FromSection != null ? p.FromSection.Name : null,
                p.FromRollNumber,
                p.FromAcademicYear,
                p.ToClassId,
                p.ToClass != null ? p.ToClass.Name : "Class",
                p.ToSectionId,
                p.ToSection != null ? p.ToSection.Name : null,
                p.ToRollNumber,
                p.ToAcademicYear,
                p.ResultStatus,
                p.PromotionDate,
                p.PromotedBy,
                p.Remarks,
                p.ExamPercentage,
                p.ExamTotalMarks,
                p.ExamGrade
            ))
            .ToListAsync();

        return Ok(new
        {
            totalCount,
            page,
            pageSize,
            items
        });
    }

    [HttpPost("promotions/revert")]
    public async Task<ActionResult<object>> RevertPromotion([FromBody] List<Guid> historyIds)
    {
        if (historyIds == null || historyIds.Count == 0)
            return BadRequest(new { message = "No promotion records specified for reversion." });

        int revertedCount = 0;
        foreach (var id in historyIds)
        {
            var history = await _db.StudentPromotionHistories
                .Include(h => h.Student)
                .FirstOrDefaultAsync(h => h.Id == id);

            if (history == null || history.Student == null) continue;

            history.Student.ClassId = history.FromClassId;
            history.Student.SectionId = history.FromSectionId;
            if (!string.IsNullOrWhiteSpace(history.FromRollNumber))
            {
                history.Student.SchoolRollNumber = history.FromRollNumber;
                if (!history.Student.IsCoachingStudent || string.IsNullOrWhiteSpace(history.Student.CoachingRollNumber))
                {
                    history.Student.RollNumber = history.FromRollNumber;
                }
            }

            _db.StudentPromotionHistories.Remove(history);
            revertedCount++;
        }

        await _db.SaveChangesAsync();

        return Ok(new { message = $"Successfully reverted {revertedCount} promotion record(s)." });
    }

    #endregion

    #region School Examinations & Marks Entry

    [HttpGet("exams")]
    public async Task<ActionResult<object>> GetSchoolExams(
        [FromQuery] Guid? classId,
        [FromQuery] Guid? sectionId,
        [FromQuery] string? academicYear,
        [FromQuery] string? examType,
        [FromQuery] string? searchTerm,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = _db.Tests
            .AsNoTracking()
            .Include(t => t.Class)
            .Include(t => t.Section)
            .Include(t => t.MarksList)
            .Where(t => t.ClassId != null);

        if (classId.HasValue && classId != Guid.Empty)
            query = query.Where(t => t.ClassId == classId.Value);

        if (sectionId.HasValue && sectionId != Guid.Empty)
            query = query.Where(t => t.SectionId == sectionId.Value);

        if (!string.IsNullOrWhiteSpace(academicYear))
            query = query.Where(t => t.AcademicYear == academicYear);

        if (!string.IsNullOrWhiteSpace(examType))
            query = query.Where(t => t.ExamType == examType);

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(t => t.Title.ToLower().Contains(term) || t.Subject.ToLower().Contains(term));
        }

        var totalCount = await query.CountAsync();

        var classIds = await query.Select(t => t.ClassId!.Value).Distinct().ToListAsync();
        var studentCounts = await _db.Students
            .AsNoTracking()
            .Where(s => s.ClassId != null && classIds.Contains(s.ClassId.Value) && s.IsActive && s.IsSchoolStudent)
            .GroupBy(s => new { ClassId = s.ClassId!.Value, SectionId = s.SectionId })
            .Select(g => new { g.Key.ClassId, g.Key.SectionId, Count = g.Count() })
            .ToListAsync();

        var exams = await query
            .OrderByDescending(t => t.TestDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = exams.Select(t =>
        {
            int totalInClass = 0;
            if (t.SectionId.HasValue)
            {
                totalInClass = studentCounts.FirstOrDefault(x => x.ClassId == t.ClassId!.Value && x.SectionId == t.SectionId.Value)?.Count ?? 0;
            }
            else
            {
                totalInClass = studentCounts.Where(x => x.ClassId == t.ClassId!.Value).Sum(x => x.Count);
            }

            return new SchoolExamDto(
                t.Id,
                t.Title,
                t.Subject,
                t.ExamType,
                t.AcademicYear,
                t.ClassId!.Value,
                t.Class?.Name ?? "Class",
                t.SectionId,
                t.Section?.Name,
                t.MaxMarks,
                t.PassingMarks,
                t.TestDate,
                totalInClass,
                t.MarksList.Count
            );
        }).ToList();

        return Ok(new
        {
            totalCount,
            page,
            pageSize,
            items
        });
    }

    [HttpPost("exams/bulk")]
    public async Task<ActionResult<List<SchoolExamDto>>> CreateBulkSchoolExams([FromBody] CreateBulkSchoolExamsDto dto)
    {
        if (dto.ClassId == Guid.Empty)
            return BadRequest(new { message = "ClassId is required." });

        if (dto.Exams == null || dto.Exams.Count == 0)
            return BadRequest(new { message = "No exam items specified." });

        var schoolClass = await _db.SchoolClasses.FindAsync(dto.ClassId);
        if (schoolClass == null)
            return BadRequest(new { message = "Invalid class specified." });

        var session = !string.IsNullOrWhiteSpace(dto.AcademicYear) ? dto.AcademicYear : "2025-2026";
        var examType = !string.IsNullOrWhiteSpace(dto.ExamType) ? dto.ExamType : "Annual Exam";

        var entities = dto.Exams.Select(item => new Test
        {
            TenantId = _currentUser.TenantId,
            BranchId = schoolClass.BranchId ?? _currentUser.BranchId,
            ClassId = dto.ClassId,
            SectionId = dto.SectionId,
            Title = string.IsNullOrWhiteSpace(item.Title) ? $"{examType} - {item.Subject}" : item.Title.Trim(),
            Subject = item.Subject.Trim(),
            ExamType = examType,
            AcademicYear = session,
            MaxMarks = item.MaxMarks > 0 ? item.MaxMarks : 100,
            PassingMarks = item.PassingMarks > 0 ? item.PassingMarks : 33,
            TestDate = item.TestDate != default ? item.TestDate : DateTime.UtcNow
        }).ToList();

        _db.Tests.AddRange(entities);
        await _db.SaveChangesAsync();

        var result = entities.Select(t => new SchoolExamDto(
            t.Id,
            t.Title,
            t.Subject,
            t.ExamType,
            t.AcademicYear,
            t.ClassId!.Value,
            schoolClass.Name,
            t.SectionId,
            null,
            t.MaxMarks,
            t.PassingMarks,
            t.TestDate,
            0,
            0
        )).ToList();

        return Ok(result);
    }

    [HttpGet("exams/{id}/marks")]
    public async Task<ActionResult<List<SchoolExamMarksItemDto>>> GetSchoolExamMarks(Guid id)
    {
        var test = await _db.Tests
            .AsNoTracking()
            .Include(t => t.Class)
            .Include(t => t.Section)
            .Include(t => t.MarksList)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (test == null)
            return NotFound(new { message = "Exam not found." });

        var studentsQuery = _db.Students
            .AsNoTracking()
            .Where(s => s.IsActive && s.IsSchoolStudent && s.ClassId == test.ClassId);

        if (test.SectionId.HasValue && test.SectionId != Guid.Empty)
        {
            studentsQuery = studentsQuery.Where(s => s.SectionId == test.SectionId.Value);
        }

        var students = await studentsQuery
            .OrderBy(s => s.SchoolRollNumber != null && s.SchoolRollNumber != "" ? s.SchoolRollNumber : s.RollNumber)
            .ThenBy(s => s.StudentName)
            .ToListAsync();

        var marksMap = test.MarksList.ToDictionary(m => m.StudentId, m => m);

        var result = students.Select(s =>
        {
            marksMap.TryGetValue(s.Id, out var existingMark);
            var obtained = existingMark?.MarksObtained ?? 0;
            var isAbsent = existingMark?.IsAbsent ?? false;
            var pct = test.MaxMarks > 0 ? Math.Round((obtained / test.MaxMarks) * 100, 1) : 0;
            var isPassed = !isAbsent && (obtained >= test.PassingMarks || pct >= (test.PassingMarks > 0 && test.PassingMarks <= 100 ? test.PassingMarks : 33));

            return new SchoolExamMarksItemDto(
                s.Id,
                s.StudentName,
                s.RollNumber,
                s.SchoolRollNumber,
                s.AdmissionNumber ?? "N/A",
                s.Gender,
                obtained,
                isAbsent,
                existingMark?.Remarks,
                pct,
                isPassed
            );
        }).ToList();

        return Ok(result);
    }

    [HttpPost("exams/bulk-marks")]
    public async Task<ActionResult<object>> SaveSchoolExamMarks([FromBody] SaveSchoolExamMarksDto dto)
    {
        var test = await _db.Tests.FirstOrDefaultAsync(t => t.Id == dto.ExamId);
        if (test == null)
            return NotFound(new { message = "Exam not found." });

        var existingMarks = await _db.TestMarks.Where(m => m.TestId == dto.ExamId).ToListAsync();
        _db.TestMarks.RemoveRange(existingMarks);

        int rank = 1;
        var sorted = dto.MarksList
            .OrderByDescending(m => m.IsAbsent ? -1 : m.MarksObtained)
            .ToList();

        foreach (var item in sorted)
        {
            var mark = new TestMarks
            {
                TenantId = _currentUser.TenantId,
                TestId = dto.ExamId,
                StudentId = item.StudentId,
                MarksObtained = item.IsAbsent ? 0 : item.MarksObtained,
                IsAbsent = item.IsAbsent,
                Remarks = item.Remarks,
                Rank = item.IsAbsent ? 9999 : rank++
            };
            _db.TestMarks.Add(mark);
        }

        await _db.SaveChangesAsync();

        return Ok(new { message = $"Successfully saved marks for {dto.MarksList.Count} student(s)!" });
    }

    [HttpGet("exams/class-multi-marks")]
    public async Task<ActionResult<ClassMultiSubjectMatrixDto>> GetClassMultiSubjectMarks(
        [FromQuery] Guid classId,
        [FromQuery] string academicYear,
        [FromQuery] string examType,
        [FromQuery] Guid? sectionId = null)
    {
        if (classId == Guid.Empty)
            return BadRequest(new { message = "ClassId is required." });

        var schoolClass = await _db.SchoolClasses.FindAsync(classId);
        if (schoolClass == null)
            return BadRequest(new { message = "Class not found." });

        var testsQuery = _db.Tests
            .AsNoTracking()
            .Include(t => t.MarksList)
            .Where(t => t.ClassId == classId && t.AcademicYear == academicYear && t.ExamType == examType);

        if (sectionId.HasValue && sectionId != Guid.Empty)
        {
            testsQuery = testsQuery.Where(t => t.SectionId == null || t.SectionId == sectionId.Value);
        }

        var tests = await testsQuery.OrderBy(t => t.Subject).ToListAsync();

        var subjects = tests.Select(t => new ClassExamSubjectHeaderDto(
            t.Id,
            t.Subject,
            t.MaxMarks,
            t.PassingMarks
        )).ToList();

        var studentsQuery = _db.Students
            .AsNoTracking()
            .Where(s => s.ClassId == classId && s.IsActive && s.IsSchoolStudent);

        if (sectionId.HasValue && sectionId != Guid.Empty)
        {
            studentsQuery = studentsQuery.Where(s => s.SectionId == sectionId.Value);
        }

        var students = await studentsQuery
            .OrderBy(s => s.SchoolRollNumber != null && s.SchoolRollNumber != "" ? s.SchoolRollNumber : s.RollNumber)
            .ThenBy(s => s.StudentName)
            .ToListAsync();

        var studentRows = students.Select(s =>
        {
            var cellMarks = tests.Select(t =>
            {
                var mark = t.MarksList.FirstOrDefault(m => m.StudentId == s.Id);
                return new ClassStudentMarksCellDto(
                    t.Id,
                    mark?.MarksObtained,
                    mark?.IsAbsent ?? false,
                    mark?.Remarks
                );
            }).ToList();

            return new ClassStudentMultiSubjectRowDto(
                s.Id,
                s.StudentName,
                s.AdmissionNumber ?? s.RollNumber,
                s.SchoolRollNumber ?? s.RollNumber,
                cellMarks
            );
        }).ToList();

        return Ok(new ClassMultiSubjectMatrixDto(
            schoolClass.Id,
            schoolClass.Name,
            academicYear,
            examType,
            subjects,
            studentRows
        ));
    }

    [HttpPost("exams/class-multi-marks")]
    public async Task<ActionResult<object>> SaveClassMultiSubjectMarks([FromBody] SaveClassMultiSubjectMarksDto dto)
    {
        if (dto.ClassId == Guid.Empty || dto.Rows == null || dto.Rows.Count == 0)
            return BadRequest(new { message = "No student rows provided to save." });

        var distinctExamIds = dto.Rows
            .SelectMany(r => r.SubjectMarks)
            .Select(m => m.ExamId)
            .Distinct()
            .ToList();

        var tests = await _db.Tests.Where(t => distinctExamIds.Contains(t.Id)).ToListAsync();
        if (tests.Count == 0)
            return BadRequest(new { message = "No valid exam tests found for the provided IDs." });

        var existingMarks = await _db.TestMarks
            .Where(m => distinctExamIds.Contains(m.TestId))
            .ToListAsync();

        foreach (var row in dto.Rows)
        {
            foreach (var cell in row.SubjectMarks)
            {
                var existing = existingMarks.FirstOrDefault(m => m.TestId == cell.ExamId && m.StudentId == row.StudentId);
                if (existing != null)
                {
                    existing.MarksObtained = cell.IsAbsent ? 0 : (cell.MarksObtained ?? 0);
                    existing.IsAbsent = cell.IsAbsent;
                    existing.Remarks = cell.Remarks;
                }
                else if (cell.MarksObtained.HasValue || cell.IsAbsent)
                {
                    var newMark = new TestMarks
                    {
                        TenantId = _currentUser.TenantId,
                        TestId = cell.ExamId,
                        StudentId = row.StudentId,
                        MarksObtained = cell.IsAbsent ? 0 : (cell.MarksObtained ?? 0),
                        IsAbsent = cell.IsAbsent,
                        Remarks = cell.Remarks,
                        Rank = 0
                    };
                    _db.TestMarks.Add(newMark);
                    existingMarks.Add(newMark);
                }
            }
        }

        // Recalculate ranks per exam
        foreach (var examId in distinctExamIds)
        {
            var examMarks = existingMarks
                .Where(m => m.TestId == examId)
                .OrderByDescending(m => m.IsAbsent ? -1 : m.MarksObtained)
                .ToList();

            int rank = 1;
            foreach (var em in examMarks)
            {
                em.Rank = em.IsAbsent ? 9999 : rank++;
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new { message = $"Successfully saved marks for {dto.Rows.Count} student(s) across {distinctExamIds.Count} subjects!" });
    }

    #region Exam Settings & Evaluation Configuration

    [HttpGet("exam-settings")]
    public async Task<ActionResult<ExamSettingDto>> GetExamSettings()
    {
        var setting = await _db.ExamSettings.FirstOrDefaultAsync();
        if (setting == null)
        {
            setting = new ExamSetting
            {
                TenantId = _currentUser.TenantId,
                BranchId = _currentUser.BranchId,
                PassingPercentage = 33m,
                MaxCompartmentSubjects = 2,
                AllowGraceMarks = true,
                MaxGraceMarks = 5,
                SchoolAffiliationNumber = "CBSE/STATE-AFF-2025",
                PrincipalSignTitle = "Principal / Headmaster",
                ClassTeacherSignTitle = "Class Teacher",
                ResultDeclarationNote = "Continuous and Comprehensive Evaluation Scheme"
            };
            _db.ExamSettings.Add(setting);
            await _db.SaveChangesAsync();
        }

        return Ok(new ExamSettingDto(
            setting.Id,
            setting.PassingPercentage,
            setting.MaxCompartmentSubjects,
            setting.AllowGraceMarks,
            setting.MaxGraceMarks,
            setting.SchoolAffiliationNumber,
            setting.PrincipalSignTitle,
            setting.ClassTeacherSignTitle,
            setting.ResultDeclarationNote
        ));
    }

    [HttpPut("exam-settings")]
    public async Task<ActionResult<ExamSettingDto>> UpdateExamSettings([FromBody] UpdateExamSettingDto dto)
    {
        var setting = await _db.ExamSettings.FirstOrDefaultAsync();
        if (setting == null)
        {
            setting = new ExamSetting
            {
                TenantId = _currentUser.TenantId,
                BranchId = _currentUser.BranchId
            };
            _db.ExamSettings.Add(setting);
        }

        setting.PassingPercentage = dto.PassingPercentage > 0 ? dto.PassingPercentage : 33m;
        setting.MaxCompartmentSubjects = dto.MaxCompartmentSubjects >= 0 ? dto.MaxCompartmentSubjects : 2;
        setting.AllowGraceMarks = dto.AllowGraceMarks;
        setting.MaxGraceMarks = dto.MaxGraceMarks >= 0 ? dto.MaxGraceMarks : 5;
        setting.SchoolAffiliationNumber = !string.IsNullOrWhiteSpace(dto.SchoolAffiliationNumber) ? dto.SchoolAffiliationNumber : "CBSE/STATE-AFF-2025";
        setting.PrincipalSignTitle = !string.IsNullOrWhiteSpace(dto.PrincipalSignTitle) ? dto.PrincipalSignTitle : "Principal / Headmaster";
        setting.ClassTeacherSignTitle = !string.IsNullOrWhiteSpace(dto.ClassTeacherSignTitle) ? dto.ClassTeacherSignTitle : "Class Teacher";
        setting.ResultDeclarationNote = !string.IsNullOrWhiteSpace(dto.ResultDeclarationNote) ? dto.ResultDeclarationNote : "Continuous and Comprehensive Evaluation Scheme";
        setting.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(new ExamSettingDto(
            setting.Id,
            setting.PassingPercentage,
            setting.MaxCompartmentSubjects,
            setting.AllowGraceMarks,
            setting.MaxGraceMarks,
            setting.SchoolAffiliationNumber,
            setting.PrincipalSignTitle,
            setting.ClassTeacherSignTitle,
            setting.ResultDeclarationNote
        ));
    }

    [HttpPost("exams/whatsapp-result")]
    public async Task<ActionResult> SendExamResultWhatsApp([FromBody] SendAnnualResultWhatsAppDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.RecipientPhone))
            return BadRequest(new { message = "Recipient phone number is required." });

        var sent = await _whatsAppService.SendAnnualExamReportAsync(
            _currentUser.TenantId,
            dto.RecipientPhone,
            dto.StudentName,
            dto.ExamTitle,
            dto.AcademicYear,
            dto.TotalObtained,
            dto.TotalMax,
            dto.Percentage,
            dto.Grade,
            dto.ResultStatus,
            dto.Rank
        );

        if (sent)
            return Ok(new { message = $"Annual exam report sent to {dto.RecipientPhone} successfully! 📱" });

        return BadRequest(new { message = "Failed to send WhatsApp message." });
    }

    #endregion

    [HttpGet("exams/consolidated-results")]
    public async Task<ActionResult<ConsolidatedClassResultDto>> GetConsolidatedResults(
        [FromQuery] Guid classId,
        [FromQuery] string academicYear,
        [FromQuery] string? examType = "Annual Exam",
        [FromQuery] Guid? sectionId = null,
        [FromQuery] decimal? passingPercentage = null,
        [FromQuery] int? maxCompartmentSubjects = null,
        [FromQuery] bool? allowGraceMarks = null,
        [FromQuery] int? maxGraceMarks = null)
    {
        if (classId == Guid.Empty)
            return BadRequest(new { message = "ClassId is required." });

        var schoolClass = await _db.SchoolClasses.FindAsync(classId);
        if (schoolClass == null)
            return BadRequest(new { message = "Class not found." });

        // Retrieve or initialize saved Exam Settings
        var setting = await _db.ExamSettings.FirstOrDefaultAsync();
        if (setting == null)
        {
            setting = new ExamSetting
            {
                TenantId = _currentUser.TenantId,
                BranchId = _currentUser.BranchId,
                PassingPercentage = 33m,
                MaxCompartmentSubjects = 2,
                AllowGraceMarks = true,
                MaxGraceMarks = 5,
                SchoolAffiliationNumber = "CBSE/STATE-AFF-2025",
                PrincipalSignTitle = "Principal / Headmaster",
                ClassTeacherSignTitle = "Class Teacher",
                ResultDeclarationNote = "Continuous and Comprehensive Evaluation Scheme"
            };
            _db.ExamSettings.Add(setting);
            await _db.SaveChangesAsync();
        }

        // Apply dynamic query overrides if user changed them in the UI
        decimal effectivePassingPct = passingPercentage.HasValue && passingPercentage.Value > 0 
            ? passingPercentage.Value 
            : setting.PassingPercentage;

        int effectiveCompartmentMax = maxCompartmentSubjects.HasValue && maxCompartmentSubjects.Value >= 0 
            ? maxCompartmentSubjects.Value 
            : setting.MaxCompartmentSubjects;

        bool effectiveAllowGrace = allowGraceMarks.HasValue 
            ? allowGraceMarks.Value 
            : setting.AllowGraceMarks;

        int effectiveMaxGrace = maxGraceMarks.HasValue && maxGraceMarks.Value >= 0 
            ? maxGraceMarks.Value 
            : setting.MaxGraceMarks;

        var testsQuery = _db.Tests
            .AsNoTracking()
            .Include(t => t.MarksList)
            .Where(t => t.ClassId == classId && t.AcademicYear == academicYear);

        if (!string.IsNullOrWhiteSpace(examType))
        {
            testsQuery = testsQuery.Where(t => t.ExamType == examType);
        }

        if (sectionId.HasValue && sectionId != Guid.Empty)
        {
            testsQuery = testsQuery.Where(t => t.SectionId == null || t.SectionId == sectionId.Value);
        }

        var tests = await testsQuery.OrderBy(t => t.Subject).ToListAsync();
        var subjects = tests.Select(t => t.Subject).Distinct().ToList();

        var studentsQuery = _db.Students
            .AsNoTracking()
            .Include(s => s.Section).ThenInclude(sec => sec!.ClassTeacher)
            .Include(s => s.Attendances)
            .Where(s => s.ClassId == classId && s.IsActive && s.IsSchoolStudent);

        if (sectionId.HasValue && sectionId != Guid.Empty)
        {
            studentsQuery = studentsQuery.Where(s => s.SectionId == sectionId.Value);
        }

        var students = await studentsQuery
            .OrderBy(s => s.SchoolRollNumber != null && s.SchoolRollNumber != "" ? s.SchoolRollNumber : s.RollNumber)
            .ThenBy(s => s.StudentName)
            .ToListAsync();

        decimal totalMaxMarksAll = tests.Sum(t => t.MaxMarks);
        int passedCount = 0;
        int compartmentCount = 0;
        int failedCount = 0;

        // Preliminary computation to calculate student scores for ranking
        var evaluatedStudents = students.Select(s =>
        {
            var subjectMarks = new Dictionary<string, decimal?>();
            var subjectDetails = new List<ConsolidatedSubjectDetailDto>();
            decimal studentTotalObtained = 0;
            bool hasAbsent = false;
            int failedSubjects = 0;
            decimal totalDeficitForGrace = 0;

            foreach (var test in tests)
            {
                var mark = test.MarksList.FirstOrDefault(m => m.StudentId == s.Id);
                decimal testPassMark = test.PassingMarks > 0 ? test.PassingMarks : Math.Round(test.MaxMarks * (effectivePassingPct / 100m), 1);
                
                if (mark != null)
                {
                    if (mark.IsAbsent)
                    {
                        hasAbsent = true;
                        failedSubjects++;
                        subjectMarks[test.Subject] = null;
                        subjectDetails.Add(new ConsolidatedSubjectDetailDto(
                            test.Subject,
                            test.MaxMarks,
                            testPassMark,
                            null,
                            true,
                            "F",
                            false
                        ));
                    }
                    else
                    {
                        subjectMarks[test.Subject] = mark.MarksObtained;
                        studentTotalObtained += mark.MarksObtained;
                        bool isSubjectPassed = mark.MarksObtained >= testPassMark;

                        if (!isSubjectPassed)
                        {
                            failedSubjects++;
                            totalDeficitForGrace += (testPassMark - mark.MarksObtained);
                        }

                        decimal subPct = test.MaxMarks > 0 ? Math.Round((mark.MarksObtained / test.MaxMarks) * 100, 1) : 0;
                        string subGrade;
                        if (subPct >= 90) subGrade = "A+";
                        else if (subPct >= 80) subGrade = "A";
                        else if (subPct >= 70) subGrade = "B";
                        else if (subPct >= 60) subGrade = "C";
                        else if (subPct >= effectivePassingPct) subGrade = "D";
                        else subGrade = "F";

                        subjectDetails.Add(new ConsolidatedSubjectDetailDto(
                            test.Subject,
                            test.MaxMarks,
                            testPassMark,
                            mark.MarksObtained,
                            false,
                            subGrade,
                            isSubjectPassed
                        ));
                    }
                }
                else
                {
                    // Not appeared / unrecorded
                    subjectMarks[test.Subject] = null;
                    failedSubjects++;
                    subjectDetails.Add(new ConsolidatedSubjectDetailDto(
                        test.Subject,
                        test.MaxMarks,
                        testPassMark,
                        null,
                        true,
                        "-",
                        false
                    ));
                }
            }

            decimal pct = totalMaxMarksAll > 0 ? Math.Round((studentTotalObtained / totalMaxMarksAll) * 100, 1) : 0;
            string grade;
            if (pct >= 90) grade = "A+";
            else if (pct >= 80) grade = "A";
            else if (pct >= 70) grade = "B";
            else if (pct >= 60) grade = "C";
            else if (pct >= effectivePassingPct) grade = "D";
            else grade = "F";

            string status;
            string promotionVerdict;

            if (hasAbsent && studentTotalObtained == 0)
            {
                status = "Absent";
                promotionVerdict = "Detained in Current Grade";
                failedCount++;
            }
            else if (failedSubjects == 0 && pct >= effectivePassingPct)
            {
                status = "Passed";
                promotionVerdict = "Promote to Next Grade";
                passedCount++;
            }
            else if (failedSubjects <= effectiveCompartmentMax && failedSubjects > 0)
            {
                if (effectiveAllowGrace && failedSubjects == 1 && totalDeficitForGrace > 0 && totalDeficitForGrace <= effectiveMaxGrace)
                {
                    status = "Passed with Grace";
                    promotionVerdict = "Promote to Next Grade";
                    passedCount++;
                }
                else
                {
                    status = "Compartment";
                    promotionVerdict = "Eligible for Compartment Exam";
                    compartmentCount++;
                }
            }
            else
            {
                status = "Failed";
                promotionVerdict = "Detained in Current Grade";
                failedCount++;
            }

            // Attendance calculation
            int totalAttDays = s.Attendances.Count > 0 ? s.Attendances.Count : 220;
            int presentAttDays = s.Attendances.Count > 0 ? s.Attendances.Count(a => a.Status == TeacherAttendanceStatus.Present) : 206;
            decimal attPct = totalAttDays > 0 ? Math.Round(((decimal)presentAttDays / totalAttDays) * 100, 1) : 93.6m;

            return new
            {
                Student = s,
                SubjectMarks = subjectMarks,
                SubjectDetails = subjectDetails,
                TotalObtained = studentTotalObtained,
                TotalMax = totalMaxMarksAll,
                Percentage = pct,
                Grade = grade,
                ResultStatus = status,
                PromotionVerdict = promotionVerdict,
                FailedSubjectCount = failedSubjects,
                AttendancePct = attPct,
                PresentDays = presentAttDays,
                TotalDays = totalAttDays
            };
        }).ToList();

        // Calculate Rank based on TotalObtained (descending) for appearing students
        var scoreRankings = evaluatedStudents
            .Where(x => x.TotalObtained > 0 && x.ResultStatus != "Absent")
            .OrderByDescending(x => x.TotalObtained)
            .Select((item, index) => new { item.Student.Id, Rank = index + 1 })
            .ToDictionary(x => x.Id, x => x.Rank);

        var studentResults = evaluatedStudents.Select(item =>
        {
            scoreRankings.TryGetValue(item.Student.Id, out int studentRank);
            var roll = !string.IsNullOrWhiteSpace(item.Student.SchoolRollNumber) 
                ? item.Student.SchoolRollNumber 
                : (!string.IsNullOrWhiteSpace(item.Student.RollNumber) ? item.Student.RollNumber : "N/A");

            return new ConsolidatedStudentResultDto(
                item.Student.Id,
                item.Student.StudentName,
                roll,
                item.Student.AdmissionNumber ?? "N/A",
                item.SubjectMarks,
                item.TotalObtained,
                item.TotalMax,
                item.Percentage,
                item.Grade,
                item.ResultStatus,
                studentRank > 0 ? studentRank : 0,
                item.FailedSubjectCount,
                item.PromotionVerdict,
                item.AttendancePct,
                item.PresentDays,
                item.TotalDays,
                item.Student.ParentName,
                null,
                item.Student.DateOfBirth.HasValue ? item.Student.DateOfBirth.Value.ToString("dd MMM yyyy") : null,
                item.Student.Gender,
                item.Student.ParentWhatsAppPhone,
                item.Student.Section?.Name,
                item.SubjectDetails,
                item.Student.Section?.ClassTeacher?.FullName
            );
        }).ToList();

        var settingsDto = new ExamSettingDto(
            setting.Id,
            effectivePassingPct,
            effectiveCompartmentMax,
            effectiveAllowGrace,
            effectiveMaxGrace,
            setting.SchoolAffiliationNumber,
            setting.PrincipalSignTitle,
            setting.ClassTeacherSignTitle,
            setting.ResultDeclarationNote
        );

        return Ok(new ConsolidatedClassResultDto(
            classId,
            schoolClass.Name,
            academicYear,
            examType ?? "Annual Exam",
            subjects,
            effectivePassingPct,
            students.Count,
            passedCount,
            compartmentCount,
            failedCount,
            settingsDto,
            studentResults
        ));
    }


    [HttpDelete("exams/{id}")]
    public async Task<ActionResult> DeleteSchoolExam(Guid id)
    {
        var test = await _db.Tests.FirstOrDefaultAsync(t => t.Id == id);
        if (test == null)
            return NotFound(new { message = "Exam not found." });

        var marks = await _db.TestMarks.Where(m => m.TestId == id).ToListAsync();
        _db.TestMarks.RemoveRange(marks);
        _db.Tests.Remove(test);

        await _db.SaveChangesAsync();

        return Ok(new { message = "School exam and associated marks deleted successfully." });
    }

    private static int GetClassRank(SchoolClass? cls)
    {
        if (cls == null) return 0;
        var name = (cls.Name ?? "").ToLower().Trim();
        if (name.Contains("play") || name.Contains("pg")) return -3;
        if (name.Contains("nursery")) return -2;
        if (name.Contains("lkg")) return -1;
        if (name.Contains("ukg") || name.Contains("kg")) return 0;
        if (name.Contains("10+2") || name.Contains("12")) return 12;
        if (name.Contains("10+1") || name.Contains("11")) return 11;
        var match = System.Text.RegularExpressions.Regex.Match(name, @"\d+");
        if (match.Success && int.TryParse(match.Value, out int num))
            return num;
        return cls.DisplayOrder;
    }

    #endregion
}

