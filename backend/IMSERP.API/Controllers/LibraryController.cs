using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LibraryController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public LibraryController(IIMSERPDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    // =========================================================================
    // 1. Books Catalog Master
    // =========================================================================

    [HttpGet("books")]
    public async Task<ActionResult<IEnumerable<LibraryBookDto>>> GetBooks(
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? category = null,
        [FromQuery] string? classId = null,
        [FromQuery] string? subject = null,
        [FromQuery] bool activeOnly = true)
    {
        var query = _db.LibraryBooks
            .AsNoTracking()
            .Include(b => b.Class)
            .Include(b => b.Copies)
            .AsQueryable();

        if (activeOnly)
            query = query.Where(b => b.IsActive);

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(b => b.Title.ToLower().Contains(term) ||
                                     b.Author.ToLower().Contains(term) ||
                                     (b.ISBN != null && b.ISBN.ToLower().Contains(term)) ||
                                     b.Copies.Any(c => c.AccessionNumber.ToLower().Contains(term) || (c.RackLocation != null && c.RackLocation.ToLower().Contains(term))));
        }

        if (!string.IsNullOrWhiteSpace(category) && category != "All")
            query = query.Where(b => b.Category == category);

        if (!string.IsNullOrWhiteSpace(classId) && Guid.TryParse(classId, out var parsedClassId))
            query = query.Where(b => b.ClassId == parsedClassId);

        if (!string.IsNullOrWhiteSpace(subject) && subject != "All")
            query = query.Where(b => b.Subject == subject);

        var list = await query
            .OrderBy(b => b.Title)
            .Select(b => new LibraryBookDto(
                b.Id,
                b.TenantId,
                b.BranchId,
                b.Title,
                b.Author,
                b.Publisher,
                b.Edition,
                b.ISBN,
                b.Category,
                b.Subject,
                b.ClassId,
                b.Class != null ? b.Class.Name : null,
                b.Description,
                b.Copies.Count(c => c.IsActive),
                b.Copies.Count(c => c.IsActive && c.Status == "Available"),
                b.Copies.Count(c => c.IsActive && (c.Status == "Issued" || c.Status == "Overdue")),
                b.CreatedAt,
                b.IsActive,
                b.Copies.Where(c => c.IsActive).Select(c => new BookCopyDto(
                    c.Id,
                    c.TenantId,
                    c.BranchId,
                    c.BookId,
                    b.Title,
                    b.Author,
                    c.AccessionNumber,
                    c.Barcode,
                    c.RackLocation,
                    c.Price,
                    c.Status,
                    c.ConditionNotes,
                    c.CreatedAt,
                    c.IsActive
                )).ToList()
            ))
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("books/{id:guid}")]
    public async Task<ActionResult<LibraryBookDto>> GetBookById(Guid id)
    {
        var b = await _db.LibraryBooks
            .AsNoTracking()
            .Include(x => x.Class)
            .Include(x => x.Copies)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (b == null)
            return NotFound(new { message = "Book title not found." });

        var dto = new LibraryBookDto(
            b.Id,
            b.TenantId,
            b.BranchId,
            b.Title,
            b.Author,
            b.Publisher,
            b.Edition,
            b.ISBN,
            b.Category,
            b.Subject,
            b.ClassId,
            b.Class != null ? b.Class.Name : null,
            b.Description,
            b.Copies.Count(c => c.IsActive),
            b.Copies.Count(c => c.IsActive && c.Status == "Available"),
            b.Copies.Count(c => c.IsActive && (c.Status == "Issued" || c.Status == "Overdue")),
            b.CreatedAt,
            b.IsActive,
            b.Copies.Where(c => c.IsActive).Select(c => new BookCopyDto(
                c.Id,
                c.TenantId,
                c.BranchId,
                c.BookId,
                b.Title,
                b.Author,
                c.AccessionNumber,
                c.Barcode,
                c.RackLocation,
                c.Price,
                c.Status,
                c.ConditionNotes,
                c.CreatedAt,
                c.IsActive
            )).ToList()
        );

        return Ok(dto);
    }

    [HttpPost("books")]
    public async Task<ActionResult<LibraryBookDto>> CreateBook([FromBody] CreateLibraryBookDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(new { message = "Book title is required." });

        if (string.IsNullOrWhiteSpace(dto.Author))
            return BadRequest(new { message = "Book author is required." });

        var book = new LibraryBook
        {
            Id = Guid.NewGuid(),
            TenantId = _currentUser.TenantId,
            BranchId = _currentUser.BranchId,
            Title = dto.Title.Trim(),
            Author = dto.Author.Trim(),
            Publisher = dto.Publisher?.Trim(),
            Edition = dto.Edition?.Trim(),
            ISBN = dto.ISBN?.Trim(),
            Category = string.IsNullOrWhiteSpace(dto.Category) ? "General" : dto.Category.Trim(),
            Subject = dto.Subject?.Trim(),
            ClassId = dto.ClassId,
            Description = dto.Description?.Trim(),
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _db.LibraryBooks.Add(book);

        // Auto-generate physical copies if requested
        if (dto.InitialCopiesCount > 0)
        {
            var existingCopiesCount = await _db.BookCopies.CountAsync();
            for (int i = 1; i <= dto.InitialCopiesCount; i++)
            {
                var copy = new BookCopy
                {
                    Id = Guid.NewGuid(),
                    TenantId = _currentUser.TenantId,
                    BranchId = _currentUser.BranchId,
                    BookId = book.Id,
                    AccessionNumber = $"ACC-{(existingCopiesCount + i):D5}",
                    Barcode = $"ACC-{(existingCopiesCount + i):D5}",
                    RackLocation = dto.InitialRackLocation?.Trim() ?? "General Shelf",
                    Price = dto.InitialPrice > 0 ? dto.InitialPrice : 0,
                    Status = "Available",
                    CreatedAt = DateTime.UtcNow,
                    IsActive = true
                };
                _db.BookCopies.Add(copy);
            }
        }

        await _db.SaveChangesAsync();
        return await GetBookById(book.Id);
    }

    [HttpPut("books/{id:guid}")]
    public async Task<ActionResult> UpdateBook(Guid id, [FromBody] UpdateLibraryBookDto dto)
    {
        var book = await _db.LibraryBooks.FindAsync(id);
        if (book == null)
            return NotFound(new { message = "Book title not found." });

        book.Title = dto.Title.Trim();
        book.Author = dto.Author.Trim();
        book.Publisher = dto.Publisher?.Trim();
        book.Edition = dto.Edition?.Trim();
        book.ISBN = dto.ISBN?.Trim();
        book.Category = string.IsNullOrWhiteSpace(dto.Category) ? "General" : dto.Category.Trim();
        book.Subject = dto.Subject?.Trim();
        book.ClassId = dto.ClassId;
        book.Description = dto.Description?.Trim();
        book.IsActive = dto.IsActive;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Book details updated successfully." });
    }

    [HttpDelete("books/{id:guid}")]
    public async Task<ActionResult> DeleteBook(Guid id)
    {
        var book = await _db.LibraryBooks.Include(b => b.Copies).FirstOrDefaultAsync(b => b.Id == id);
        if (book == null)
            return NotFound(new { message = "Book title not found." });

        var hasIssuedCopies = book.Copies.Any(c => c.Status == "Issued" || c.Status == "Overdue");
        if (hasIssuedCopies)
            return BadRequest(new { message = "Cannot delete book. Some copies of this title are currently issued to students or faculty." });

        _db.LibraryBooks.Remove(book);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Book and copies deleted successfully." });
    }

    // =========================================================================
    // 2. Physical Copies & Accessions
    // =========================================================================

    [HttpGet("copies/lookup")]
    public async Task<ActionResult<BookCopyDto>> LookupCopy([FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query))
            return BadRequest(new { message = "Accession number or barcode is required." });

        var term = query.Trim();
        var copy = await _db.BookCopies
            .AsNoTracking()
            .Include(c => c.Book)
            .FirstOrDefaultAsync(c => c.AccessionNumber == term || c.Barcode == term);

        if (copy == null)
            return NotFound(new { message = $"No book found with Accession No / Barcode '{term}'." });

        var dto = new BookCopyDto(
            copy.Id,
            copy.TenantId,
            copy.BranchId,
            copy.BookId,
            copy.Book != null ? copy.Book.Title : "Unknown Title",
            copy.Book != null ? copy.Book.Author : "Unknown Author",
            copy.AccessionNumber,
            copy.Barcode,
            copy.RackLocation,
            copy.Price,
            copy.Status,
            copy.ConditionNotes,
            copy.CreatedAt,
            copy.IsActive
        );

        return Ok(dto);
    }

    [HttpPost("copies")]
    public async Task<ActionResult<BookCopyDto>> CreateCopy([FromBody] CreateBookCopyDto dto)
    {
        var book = await _db.LibraryBooks.FindAsync(dto.BookId);
        if (book == null)
            return NotFound(new { message = "Book not found." });

        var exists = await _db.BookCopies.AnyAsync(c => c.AccessionNumber == dto.AccessionNumber.Trim());
        if (exists)
            return BadRequest(new { message = $"Accession Number '{dto.AccessionNumber}' already exists." });

        var copy = new BookCopy
        {
            Id = Guid.NewGuid(),
            TenantId = _currentUser.TenantId,
            BranchId = _currentUser.BranchId,
            BookId = dto.BookId,
            AccessionNumber = dto.AccessionNumber.Trim(),
            Barcode = string.IsNullOrWhiteSpace(dto.Barcode) ? dto.AccessionNumber.Trim() : dto.Barcode.Trim(),
            RackLocation = dto.RackLocation?.Trim() ?? "General Shelf",
            Price = dto.Price,
            Status = "Available",
            ConditionNotes = dto.ConditionNotes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _db.BookCopies.Add(copy);
        await _db.SaveChangesAsync();

        return Ok(new BookCopyDto(
            copy.Id,
            copy.TenantId,
            copy.BranchId,
            copy.BookId,
            book.Title,
            book.Author,
            copy.AccessionNumber,
            copy.Barcode,
            copy.RackLocation,
            copy.Price,
            copy.Status,
            copy.ConditionNotes,
            copy.CreatedAt,
            copy.IsActive
        ));
    }

    [HttpPut("copies/{id:guid}")]
    public async Task<ActionResult> UpdateCopy(Guid id, [FromBody] UpdateBookCopyDto dto)
    {
        var copy = await _db.BookCopies.FindAsync(id);
        if (copy == null)
            return NotFound(new { message = "Copy not found." });

        copy.AccessionNumber = dto.AccessionNumber.Trim();
        copy.Barcode = dto.Barcode?.Trim();
        copy.RackLocation = dto.RackLocation?.Trim();
        copy.Price = dto.Price;
        copy.Status = dto.Status;
        copy.ConditionNotes = dto.ConditionNotes?.Trim();
        copy.IsActive = dto.IsActive;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Copy updated successfully." });
    }

    [HttpDelete("copies/{id:guid}")]
    public async Task<ActionResult> DeleteCopy(Guid id)
    {
        var copy = await _db.BookCopies.FindAsync(id);
        if (copy == null)
            return NotFound(new { message = "Copy not found." });

        if (copy.Status == "Issued" || copy.Status == "Overdue")
            return BadRequest(new { message = "Cannot delete copy while it is currently issued." });

        _db.BookCopies.Remove(copy);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Copy removed successfully." });
    }

    // =========================================================================
    // 3. Circulation: Fast Issue, Return, & Renewal
    // =========================================================================

    [HttpPost("circulation/issue")]
    public async Task<ActionResult> IssueBook([FromBody] IssueBookDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.AccessionNumber))
            return BadRequest(new { message = "Accession number is required." });

        if (!dto.StudentId.HasValue && !dto.TeacherId.HasValue)
            return BadRequest(new { message = "Student or Faculty selection is required." });

        var copy = await _db.BookCopies
            .Include(c => c.Book)
            .FirstOrDefaultAsync(c => c.AccessionNumber == dto.AccessionNumber.Trim());

        if (copy == null)
            return NotFound(new { message = $"Book copy with Accession '{dto.AccessionNumber}' not found." });

        if (copy.Status != "Available")
            return BadRequest(new { message = $"Book is currently '{copy.Status}' and cannot be issued." });

        var settings = await _db.LibrarySettings.FirstOrDefaultAsync() ?? new LibrarySetting();

        int dueDays = dto.CustomDueDays.HasValue && dto.CustomDueDays > 0 
            ? dto.CustomDueDays.Value 
            : (dto.MemberType == "Teacher" ? settings.TeacherIssueDays : settings.StudentIssueDays);

        // Check active borrowings limit
        if (dto.MemberType == "Teacher" && dto.TeacherId.HasValue)
        {
            var activeLoans = await _db.LibraryCirculations
                .CountAsync(c => c.TeacherId == dto.TeacherId.Value && (c.Status == "Issued" || c.Status == "Overdue"));

            if (activeLoans >= settings.MaxBooksPerTeacher)
                return BadRequest(new { message = $"Faculty member has already borrowed maximum allowed books ({settings.MaxBooksPerTeacher})." });
        }
        else if (dto.StudentId.HasValue)
        {
            var activeLoans = await _db.LibraryCirculations
                .CountAsync(c => c.StudentId == dto.StudentId.Value && (c.Status == "Issued" || c.Status == "Overdue"));

            if (activeLoans >= settings.MaxBooksPerStudent)
                return BadRequest(new { message = $"Student has already reached maximum borrowing limit ({settings.MaxBooksPerStudent} books)." });

            // Check if student has pending overdue books
            var hasOverdue = await _db.LibraryCirculations
                .AnyAsync(c => c.StudentId == dto.StudentId.Value && c.DueDate < DateTime.UtcNow && c.Status == "Issued");

            if (hasOverdue)
                return BadRequest(new { message = "Student has overdue book(s) pending return. Please return overdue books before new issue." });
        }

        var circulation = new LibraryCirculation
        {
            Id = Guid.NewGuid(),
            TenantId = _currentUser.TenantId,
            BranchId = _currentUser.BranchId,
            BookCopyId = copy.Id,
            StudentId = dto.StudentId,
            TeacherId = dto.TeacherId,
            MemberType = dto.MemberType,
            IssueDate = DateTime.UtcNow,
            DueDate = DateTime.UtcNow.AddDays(dueDays),
            Status = "Issued",
            FinePerDay = settings.DailyFineRate,
            Remarks = dto.Remarks?.Trim(),
            IssuedByUserId = _currentUser.UserId,
            CreatedAt = DateTime.UtcNow
        };

        copy.Status = "Issued";

        _db.LibraryCirculations.Add(circulation);
        await _db.SaveChangesAsync();

        return Ok(new { 
            message = $"Book '{copy.Book?.Title}' successfully issued!", 
            accessionNumber = copy.AccessionNumber,
            dueDate = circulation.DueDate
        });
    }

    [HttpPost("circulation/return")]
    public async Task<ActionResult> ReturnBook([FromBody] ReturnBookDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.AccessionNumber))
            return BadRequest(new { message = "Accession number is required." });

        var copy = await _db.BookCopies
            .Include(c => c.Book)
            .FirstOrDefaultAsync(c => c.AccessionNumber == dto.AccessionNumber.Trim());

        if (copy == null)
            return NotFound(new { message = $"Book copy '{dto.AccessionNumber}' not found." });

        var circulation = await _db.LibraryCirculations
            .Include(c => c.Student)
            .Include(c => c.Teacher)
            .Where(c => c.BookCopyId == copy.Id && (c.Status == "Issued" || c.Status == "Overdue"))
            .OrderByDescending(c => c.IssueDate)
            .FirstOrDefaultAsync();

        if (circulation == null)
            return BadRequest(new { message = $"No active issue record found for book copy '{dto.AccessionNumber}'." });

        var now = DateTime.UtcNow;
        circulation.ReturnDate = now;
        circulation.Status = "Returned";
        circulation.ReceivedByUserId = _currentUser.UserId;

        // If fine was already settled (e.g. collected at Fee Counter while active)
        if (circulation.FineStatus == "Paid" && (!dto.CollectedFineAmount.HasValue || dto.CollectedFineAmount.Value == 0))
        {
            copy.Status = "Available";
            if (!string.IsNullOrWhiteSpace(dto.Remarks))
                circulation.Remarks = (circulation.Remarks != null ? circulation.Remarks + " | " : "") + dto.Remarks.Trim();

            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = $"Book '{copy.Book?.Title}' returned to shelf. Late fine was already settled under fee receipt {circulation.FinePaymentReceiptNumber}.",
                accessionNumber = copy.AccessionNumber,
                overdueDays = circulation.OverdueDays,
                fineAmount = circulation.FineAmount,
                fineStatus = "Paid"
            });
        }

        // Calculate Overdue & Fine
        if (now.Date > circulation.DueDate.Date)
        {
            int overdueDays = (int)(now.Date - circulation.DueDate.Date).TotalDays;
            circulation.OverdueDays = overdueDays;
            circulation.FineAmount = (dto.CollectedFineAmount.HasValue && dto.CollectedFineAmount.Value > 0)
                ? dto.CollectedFineAmount.Value
                : (overdueDays * circulation.FinePerDay);
            circulation.FineStatus = string.IsNullOrWhiteSpace(dto.FinePaymentStatus) ? "Pending" : dto.FinePaymentStatus;
        }
        else if (dto.CollectedFineAmount.HasValue && dto.CollectedFineAmount.Value > 0)
        {
            circulation.OverdueDays = 0;
            circulation.FineAmount = dto.CollectedFineAmount.Value;
            circulation.FineStatus = string.IsNullOrWhiteSpace(dto.FinePaymentStatus) ? "Pending" : dto.FinePaymentStatus;
        }
        else
        {
            circulation.OverdueDays = 0;
            circulation.FineAmount = 0;
            circulation.FineStatus = "None";
        }

        if (dto.FinePaymentStatus == "Paid" && circulation.FineAmount > 0)
        {
            circulation.FineStatus = "Paid";
        }

        if (!string.IsNullOrWhiteSpace(dto.Remarks))
            circulation.Remarks = (circulation.Remarks != null ? circulation.Remarks + " | " : "") + dto.Remarks.Trim();

        copy.Status = "Available";

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"Book '{copy.Book?.Title}' successfully returned to inventory.",
            accessionNumber = copy.AccessionNumber,
            overdueDays = circulation.OverdueDays,
            fineAmount = circulation.FineAmount,
            fineStatus = circulation.FineStatus
        });
    }

    [HttpGet("circulation/active")]
    public async Task<ActionResult<IEnumerable<LibraryCirculationDto>>> GetActiveCirculations(
        [FromQuery] bool overdueOnly = false,
        [FromQuery] string? searchTerm = null)
    {
        var query = _db.LibraryCirculations
            .AsNoTracking()
            .Include(c => c.BookCopy)
                .ThenInclude(bc => bc!.Book)
            .Include(c => c.Student)
                .ThenInclude(s => s!.Class)
            .Include(c => c.Student)
                .ThenInclude(s => s!.Batch)
            .Include(c => c.Teacher)
            .Where(c => c.Status == "Issued" || c.Status == "Overdue")
            .AsQueryable();

        var now = DateTime.UtcNow;

        if (overdueOnly)
            query = query.Where(c => c.DueDate < now);

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(c => 
                (c.BookCopy != null && c.BookCopy.AccessionNumber.ToLower().Contains(term)) ||
                (c.BookCopy != null && c.BookCopy.Book != null && c.BookCopy.Book.Title.ToLower().Contains(term)) ||
                (c.Student != null && c.Student.StudentName.ToLower().Contains(term)) ||
                (c.Student != null && c.Student.RollNumber.ToLower().Contains(term)) ||
                (c.Student != null && c.Student.AdmissionNumber != null && c.Student.AdmissionNumber.ToLower().Contains(term)) ||
                (c.Teacher != null && c.Teacher.FullName.ToLower().Contains(term))
            );
        }

        var list = await query
            .OrderBy(c => c.DueDate)
            .ToListAsync();

        var result = list.Select(c =>
        {
            bool isOverdue = c.DueDate.Date < now.Date;
            int overdueDays = isOverdue ? (int)(now.Date - c.DueDate.Date).TotalDays : 0;
            decimal calculatedFine = overdueDays * c.FinePerDay;

            return new LibraryCirculationDto(
                c.Id,
                c.BookCopyId,
                c.BookCopy?.AccessionNumber ?? "N/A",
                c.BookCopy?.Book?.Title ?? "N/A",
                c.BookCopy?.Book?.Author ?? "N/A",
                c.BookCopy?.RackLocation,
                c.StudentId,
                c.Student?.StudentName,
                c.Student?.CoachingRollNumber ?? c.Student?.RollNumber,
                c.Student?.AdmissionNumber,
                c.Student?.Class?.Name,
                c.Student?.Batch?.Name,
                c.Student?.ParentWhatsAppPhone,
                c.TeacherId,
                c.Teacher?.FullName,
                c.Teacher?.EmployeeCode,
                c.MemberType,
                c.IssueDate,
                c.DueDate,
                c.ReturnDate,
                isOverdue ? "Overdue" : c.Status,
                overdueDays,
                c.FinePerDay,
                calculatedFine,
                c.FineStatus,
                c.Remarks
            );
        }).ToList();

        return Ok(result);
    }

    [HttpGet("circulation/history")]
    public async Task<ActionResult<IEnumerable<LibraryCirculationDto>>> GetCirculationHistory([FromQuery] int take = 50)
    {
        var now = DateTime.UtcNow;
        var list = await _db.LibraryCirculations
            .AsNoTracking()
            .Include(c => c.BookCopy)
                .ThenInclude(bc => bc!.Book)
            .Include(c => c.Student)
            .Include(c => c.Teacher)
            .Where(c => c.Status == "Returned")
            .OrderByDescending(c => c.ReturnDate)
            .Take(take)
            .Select(c => new LibraryCirculationDto(
                c.Id,
                c.BookCopyId,
                c.BookCopy != null ? c.BookCopy.AccessionNumber : "N/A",
                c.BookCopy != null && c.BookCopy.Book != null ? c.BookCopy.Book.Title : "N/A",
                c.BookCopy != null && c.BookCopy.Book != null ? c.BookCopy.Book.Author : "N/A",
                c.BookCopy != null ? c.BookCopy.RackLocation : null,
                c.StudentId,
                c.Student != null ? c.Student.StudentName : null,
                c.Student != null ? c.Student.RollNumber : null,
                c.Student != null ? c.Student.AdmissionNumber : null,
                null,
                null,
                c.Student != null ? c.Student.ParentWhatsAppPhone : null,
                c.TeacherId,
                c.Teacher != null ? c.Teacher.FullName : null,
                c.Teacher != null ? c.Teacher.EmployeeCode : null,
                c.MemberType,
                c.IssueDate,
                c.DueDate,
                c.ReturnDate,
                c.Status,
                c.OverdueDays,
                c.FinePerDay,
                c.FineAmount,
                c.FineStatus,
                c.Remarks
            ))
            .ToListAsync();

        return Ok(list);
    }

    // =========================================================================
    // 4. Library KPI Dashboard & Settings
    // =========================================================================

    [HttpGet("stats")]
    public async Task<ActionResult<LibraryStatsDto>> GetStats()
    {
        var totalTitles = await _db.LibraryBooks.CountAsync(b => b.IsActive);
        var totalCopies = await _db.BookCopies.CountAsync(c => c.IsActive);
        var availableCopies = await _db.BookCopies.CountAsync(c => c.IsActive && c.Status == "Available");
        var issuedCopies = await _db.BookCopies.CountAsync(c => c.IsActive && (c.Status == "Issued" || c.Status == "Overdue"));

        var now = DateTime.UtcNow;
        var overdueCount = await _db.LibraryCirculations.CountAsync(c => (c.Status == "Issued" || c.Status == "Overdue") && c.DueDate < now);

        var finesCollected = await _db.LibraryCirculations
            .Where(c => c.FineStatus == "Paid")
            .SumAsync(c => (decimal?)c.FineAmount) ?? 0;

        var finesPending = await _db.LibraryCirculations
            .Where(c => c.FineStatus == "Pending")
            .SumAsync(c => (decimal?)c.FineAmount) ?? 0;

        return Ok(new LibraryStatsDto(
            totalTitles,
            totalCopies,
            availableCopies,
            issuedCopies,
            overdueCount,
            finesCollected,
            finesPending
        ));
    }

    [HttpGet("settings")]
    public async Task<ActionResult<LibrarySettingDto>> GetSettings()
    {
        var s = await _db.LibrarySettings.FirstOrDefaultAsync();
        if (s == null)
        {
            s = new LibrarySetting
            {
                Id = Guid.NewGuid(),
                TenantId = _currentUser.TenantId,
                BranchId = _currentUser.BranchId
            };
            _db.LibrarySettings.Add(s);
            await _db.SaveChangesAsync();
        }

        return Ok(new LibrarySettingDto(
            s.Id,
            s.MaxBooksPerStudent,
            s.MaxBooksPerTeacher,
            s.StudentIssueDays,
            s.TeacherIssueDays,
            s.DailyFineRate,
            s.AllowFineWaiver
        ));
    }

    [HttpPut("settings")]
    public async Task<ActionResult> UpdateSettings([FromBody] UpdateLibrarySettingDto dto)
    {
        var s = await _db.LibrarySettings.FirstOrDefaultAsync();
        if (s == null)
        {
            s = new LibrarySetting
            {
                Id = Guid.NewGuid(),
                TenantId = _currentUser.TenantId,
                BranchId = _currentUser.BranchId
            };
            _db.LibrarySettings.Add(s);
        }

        s.MaxBooksPerStudent = dto.MaxBooksPerStudent;
        s.MaxBooksPerTeacher = dto.MaxBooksPerTeacher;
        s.StudentIssueDays = dto.StudentIssueDays;
        s.TeacherIssueDays = dto.TeacherIssueDays;
        s.DailyFineRate = dto.DailyFineRate;
        s.AllowFineWaiver = dto.AllowFineWaiver;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Library settings updated successfully." });
    }
}
