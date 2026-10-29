using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FeesController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly IWhatsAppService _whatsAppService;
    private readonly ICurrentUserService _currentUser;

    public FeesController(IIMSERPDbContext dbContext, IWhatsAppService whatsAppService, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _whatsAppService = whatsAppService;
        _currentUser = currentUser;
    }

    [HttpGet("invoices/paged")]
    public async Task<ActionResult<PagedResultDto<FeeInvoicePagedItemDto>>> GetInvoicesPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? searchTerm = null,
        [FromQuery] Guid? batchId = null,
        [FromQuery] Guid? classId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? sortBy = "createdAt",
        [FromQuery] bool sortDescending = true)
    {
        var roleClaim = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value?.ToLower() ?? "";
        if (roleClaim.Contains("parent") || roleClaim.Contains("student"))
        {
            return Forbid();
        }

        var tenantId = _currentUser.TenantId;
        // Base query: include navigation properties needed for filtering/sorting.
        // Do NOT eagerly include Items here — they are projected via Select() below,
        // which allows EF Core to use AsSplitQuery() and avoid a Cartesian product.
        var query = _dbContext.FeeInvoices
            .AsNoTracking()
            .Where(i => i.TenantId == tenantId)
            .Include(i => i.Branch)
            .Include(i => i.Student)
                .ThenInclude(s => s.Branch)
            .Include(i => i.Student)
                .ThenInclude(s => s.Batch)
                    .ThenInclude(b => b.Branch)
            .Include(i => i.Student)
                .ThenInclude(s => s.Class)
            .Include(i => i.Student)
                .ThenInclude(s => s.Section)
            .AsSplitQuery()
            .AsQueryable();



        // Filtering
        if (batchId.HasValue && batchId != Guid.Empty)
        {
            query = query.Where(i => i.Student != null && i.Student.BatchId == batchId.Value);
        }

        if (classId.HasValue && classId != Guid.Empty)
        {
            query = query.Where(i => i.ClassId.HasValue ? i.ClassId == classId.Value : (i.Student != null && i.Student.ClassId == classId.Value));
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<InvoiceStatus>(status, true, out var invoiceStatus))
        {
            query = query.Where(i => i.Status == invoiceStatus);
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(i =>
                (i.Student != null && i.Student.StudentName.ToLower().Contains(term)) ||
                (i.Student != null && i.Student.RollNumber.ToLower().Contains(term)) ||
                (i.Student != null && i.Student.ParentWhatsAppPhone.Contains(term)) ||
                i.InvoiceNumber.ToLower().Contains(term) ||
                i.Title.ToLower().Contains(term) ||
                i.Items.Any(it => it.HeadName.ToLower().Contains(term))
            );
        }

        // Sorting: latest created invoices and newly admitted students always appear first at the top
        query = (sortBy?.ToLower()) switch
        {
            "studentname" => sortDescending ? query.OrderByDescending(i => i.Student!.StudentName) : query.OrderBy(i => i.Student!.StudentName),
            "invoicenumber" => sortDescending ? query.OrderByDescending(i => i.InvoiceNumber) : query.OrderBy(i => i.InvoiceNumber),
            "totalamount" => sortDescending ? query.OrderByDescending(i => i.TotalAmount) : query.OrderBy(i => i.TotalAmount),
            "dueamount" => sortDescending ? query.OrderByDescending(i => i.TotalAmount - i.PaidAmount) : query.OrderBy(i => i.TotalAmount - i.PaidAmount),
            "status" => sortDescending ? query.OrderByDescending(i => i.Status) : query.OrderBy(i => i.Status),
            "duedate" => sortDescending
                ? query.OrderByDescending(i => i.DueDate)
                       .ThenByDescending(i => i.CreatedAt)
                       .ThenByDescending(i => i.Student!.JoiningDate)
                       .ThenByDescending(i => i.Student!.RollNumber)
                : query.OrderBy(i => i.DueDate)
                       .ThenBy(i => i.CreatedAt),
            _ => sortDescending
                ? query.OrderByDescending(i => i.CreatedAt)
                       .ThenByDescending(i => i.Student!.JoiningDate)
                       .ThenByDescending(i => i.Student!.RollNumber)
                : query.OrderBy(i => i.CreatedAt)
                       .ThenBy(i => i.Student!.JoiningDate)
        };

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new FeeInvoicePagedItemDto(
                i.Id,
                i.StudentId,
                i.Student != null ? i.Student.StudentName : "",
                i.Student != null ? i.Student.RollNumber : "",
                i.Student != null && i.Student.Batch != null ? i.Student.Batch.Name : "",
                i.Student != null ? i.Student.ParentWhatsAppPhone : "",
                i.InvoiceNumber,
                i.Title,
                i.TotalAmount,
                i.PaidAmount,
                i.Status == InvoiceStatus.Cancelled ? 0m : (i.TotalAmount - i.PaidAmount),
                i.DueDate,
                i.Status.ToString(),
                i.CancellationReason,
                i.CancelledAt,
                i.Items.Select(it => new FeeInvoiceItemDto(it.Id, it.InvoiceId, it.FeeHeadId, it.HeadName, it.Amount, it.PaidAmount, it.Description)).ToList(),
                i.ClassName ?? (i.Student != null && i.Student.Class != null ? i.Student.Class.Name : null),
                i.SectionName ?? (i.Student != null && i.Student.Section != null ? i.Student.Section.Name : null),
                i.Student != null && i.Student.IsSchoolStudent,
                i.Student != null && i.Student.IsCoachingStudent,
                i.Student != null && i.Student.Class != null ? i.Student.Class.Name : null,
                i.Student != null && i.Student.Section != null ? i.Student.Section.Name : null,
                i.Branch != null ? i.Branch.Name : (i.Student != null && i.Student.Branch != null ? i.Student.Branch.Name : (i.Student != null && i.Student.Batch != null && i.Student.Batch.Branch != null ? i.Student.Batch.Branch.Name : null))
            ))
            .ToListAsync();

        return Ok(new PagedResultDto<FeeInvoicePagedItemDto>(items, totalCount, pageNumber, pageSize));
    }

    [HttpGet("my-ledger")]
    public async Task<ActionResult<StudentLedgerDto>> GetMyLedger()
    {
        var userId = _currentUser.UserId;
        var tenantId = _currentUser.TenantId;

        // 1. Direct link by UserId (Student)
        var student = await _dbContext.Students.AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId && s.TenantId == tenantId);

        // 2. Direct link by ParentUserId (Parent)
        if (student == null)
        {
            student = await _dbContext.Students.AsNoTracking()
                .FirstOrDefaultAsync(s => s.ParentUserId == userId && s.TenantId == tenantId);
        }

        // 3. Fallback: match by user's phone or name
        if (student == null)
        {
            var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user != null)
            {
                student = await _dbContext.Students.AsNoTracking().FirstOrDefaultAsync(s =>
                    s.TenantId == tenantId && (
                        (!string.IsNullOrEmpty(user.PhoneNumber) && (s.ParentWhatsAppPhone == user.PhoneNumber || s.EmergencyContactPhone == user.PhoneNumber)) ||
                        (!string.IsNullOrEmpty(user.FullName) && s.StudentName == user.FullName)
                    ));
            }
        }

        // 4. Fallback for staff/admin preview: first active student
        if (student == null)
        {
            student = await _dbContext.Students.AsNoTracking()
                .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.IsActive);
        }

        if (student == null) return NotFound(new { message = "No student record associated with this account." });

        return await GetStudentLedger(student.Id);
    }

    [HttpGet("student-ledger/{studentId}")]
    public async Task<ActionResult<StudentLedgerDto>> GetStudentLedger(Guid studentId)
    {
        var student = await _dbContext.Students
            .AsNoTracking()
            .Include(s => s.Branch)
            .Include(s => s.Batch)
                .ThenInclude(b => b!.Branch)
            .FirstOrDefaultAsync(s => s.Id == studentId);

        if (student == null) return NotFound("Student not found");

        var roleClaim = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value?.ToLower() ?? "";
        if (roleClaim.Contains("parent") || roleClaim.Contains("student"))
        {
            var isOwn = student.UserId == _currentUser.UserId || student.ParentUserId == _currentUser.UserId;
            if (!isOwn)
            {
                var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);
                if (user != null && !string.IsNullOrEmpty(user.PhoneNumber) && (student.ParentWhatsAppPhone == user.PhoneNumber || student.EmergencyContactPhone == user.PhoneNumber))
                {
                    isOwn = true;
                }
            }
            if (!isOwn) return Forbid();
        }

        var ledgerBranchName = student.Branch?.Name ?? student.Batch?.Branch?.Name;
        if (string.IsNullOrEmpty(ledgerBranchName))
        {
            var mainBr = await _dbContext.Branches.AsNoTracking()
                .Where(b => b.TenantId == student.TenantId && b.IsActive)
                .OrderByDescending(b => b.IsMainBranch)
                .FirstOrDefaultAsync();
            ledgerBranchName = mainBr?.Name;
        }

        var invoices = await _dbContext.FeeInvoices
            .AsNoTracking()
            .Include(i => i.Items)
            .Where(i => i.StudentId == studentId)
            .OrderBy(i => i.DueDate)
            .ToListAsync();

        // Separate active and cancelled invoices for correct calculation
        var activeInvoices = invoices.Where(i => i.Status != InvoiceStatus.Cancelled).ToList();
        var cancelledInvoices = invoices.Where(i => i.Status == InvoiceStatus.Cancelled).ToList();

        var invoiceIds = invoices.Select(i => i.Id).ToList();

        var payments = await _dbContext.FeePayments
            .AsNoTracking()
            .Where(p => invoiceIds.Contains(p.InvoiceId))
            .OrderByDescending(p => p.PaymentDate)
            .ToListAsync();

        var paymentsMap = payments.ToDictionary(p => p.Id, p => invoices.FirstOrDefault(i => i.Id == p.InvoiceId)?.InvoiceNumber ?? "");

        var invoiceDtos = invoices.Select(i => new StudentLedgerInvoiceItemDto(
            i.Id,
            i.InvoiceNumber,
            i.Title,
            i.TotalAmount,
            i.PaidAmount,
            i.Status == InvoiceStatus.Cancelled ? 0m : (i.TotalAmount - i.PaidAmount),
            i.DueDate,
            i.Status.ToString(),
            i.CancellationReason,
            i.CancelledAt,
            i.Items.Select(it => new FeeInvoiceItemDto(it.Id, it.InvoiceId, it.FeeHeadId, it.HeadName, it.Amount, it.PaidAmount, it.Description)).ToList()
        )).ToList();

        var activePayments = payments.Where(p => !p.IsReversed).ToList();
        var reversedPayments = payments.Where(p => p.IsReversed).ToList();

        var paymentDtos = activePayments.Select(p => new StudentLedgerPaymentItemDto(
            p.Id,
            p.ReceiptNumber,
            paymentsMap.TryGetValue(p.Id, out var invNo) ? invNo : "",
            p.AmountPaid,
            p.Mode,
            p.TransactionRef,
            p.Remarks,
            DateTime.SpecifyKind(p.PaymentDate, DateTimeKind.Utc),
            p.IsReversed,
            p.ReversedAt.HasValue ? DateTime.SpecifyKind(p.ReversedAt.Value, DateTimeKind.Utc) : null,
            p.ReversedBy,
            p.ReversalReason,
            p.ReversalType,
            p.RefundMode,
            p.RefundRecipient,
            p.RefundReference
        )).ToList();

        var reversedPaymentDtos = reversedPayments.Select(p => new StudentLedgerPaymentItemDto(
            p.Id,
            p.ReceiptNumber,
            paymentsMap.TryGetValue(p.Id, out var invNo) ? invNo : "",
            p.AmountPaid,
            p.Mode,
            p.TransactionRef,
            p.Remarks,
            DateTime.SpecifyKind(p.PaymentDate, DateTimeKind.Utc),
            p.IsReversed,
            p.ReversedAt.HasValue ? DateTime.SpecifyKind(p.ReversedAt.Value, DateTimeKind.Utc) : null,
            p.ReversedBy,
            p.ReversalReason,
            p.ReversalType,
            p.RefundMode,
            p.RefundRecipient,
            p.RefundReference
        )).ToList();

        // Calculations exclude Cancelled invoices — cancelled invoices show in ledger but don't affect totals
        var totalCharged = activeInvoices.Sum(i => i.TotalAmount);
        var totalPaid = activeInvoices.Sum(i => i.PaidAmount);
        var totalDue = totalCharged - totalPaid;

        var pendingLibFine = await _dbContext.LibraryCirculations
            .Where(c => c.StudentId == studentId && c.FineStatus == "Pending")
            .SumAsync(c => c.FineAmount);

        return Ok(new StudentLedgerDto(
            student.Id,
            student.StudentName,
            student.RollNumber,
            student.Batch != null ? student.Batch.Name : "",
            student.ParentName,
            student.ParentWhatsAppPhone,
            student.Batch != null ? student.Batch.StandardMonthlyFee : 3500m,
            totalCharged,
            totalPaid,
            totalDue,
            invoiceDtos,
            paymentDtos,
            pendingLibFine,
            ledgerBranchName,
            reversedPaymentDtos
        ));
    }

    [HttpGet("student-fee-card/{studentId}")]
    public async Task<ActionResult<StudentFeeCardDto>> GetStudentFeeCard(Guid studentId, [FromQuery] int? sessionStartYear)
    {
        var student = await _dbContext.Students
            .AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Branch)
            .Include(s => s.Batch)
                .ThenInclude(b => b!.Branch)
            .FirstOrDefaultAsync(s => s.Id == studentId);

        if (student == null) return NotFound("Student not found");

        var card = await BuildFeeCardForStudentAsync(student, sessionStartYear);
        return Ok(card);
    }

    [HttpGet("student-fee-cards-by-class")]
    public async Task<ActionResult<List<StudentFeeCardDto>>> GetStudentFeeCardsByClass(
        [FromQuery] Guid? classId,
        [FromQuery] Guid? sectionId,
        [FromQuery] Guid? batchId,
        [FromQuery] int? sessionStartYear)
    {
        var query = _dbContext.Students
            .AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Branch)
            .Include(s => s.Batch)
                .ThenInclude(b => b!.Branch)
            .Where(s => s.IsActive != false);

        if (classId.HasValue && classId.Value != Guid.Empty)
        {
            query = query.Where(s => s.ClassId == classId.Value);
        }
        if (sectionId.HasValue && sectionId.Value != Guid.Empty)
        {
            query = query.Where(s => s.SectionId == sectionId.Value);
        }
        if (batchId.HasValue && batchId.Value != Guid.Empty)
        {
            query = query.Where(s => s.BatchId == batchId.Value);
        }

        var students = await query
            .OrderBy(s => !string.IsNullOrEmpty(s.CoachingRollNumber) && batchId.HasValue ? s.CoachingRollNumber : s.RollNumber)
            .ThenBy(s => s.StudentName)
            .ToListAsync();
        var cards = new List<StudentFeeCardDto>();
        foreach (var s in students)
        {
            cards.Add(await BuildFeeCardForStudentAsync(s, sessionStartYear));
        }
        return Ok(cards);
    }

    private class MonthInvoiceAllocation
    {
        public FeeInvoice Invoice { get; set; } = null!;
        public FeePayment? Payment { get; set; }
        public decimal GrossPayable { get; set; }
        public decimal MonthConcession { get; set; }
        public decimal Payable { get; set; }
        public decimal Paid { get; set; }
        public decimal Balance { get; set; }
        public string Status { get; set; } = "Due";
        public decimal OneTimeCharges { get; set; }
        public string? OneTimeChargesNote { get; set; }
        public string Remarks { get; set; } = "";
        public int MonthIndexInCycle { get; set; }
        public int TotalCycleMonths { get; set; }
        public string? BillingCycleTag { get; set; }
    }

    private async Task<StudentFeeCardDto> BuildFeeCardForStudentAsync(Student student, int? sessionStartYear)
    {
        var now = DateTime.UtcNow;
        int startYear = sessionStartYear ?? (now.Month >= 4 ? now.Year : now.Year - 1);
        string sessionName = $"{startYear}-{startYear + 1}";

        var tenant = await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == student.TenantId);
        var branchName = student.Branch?.Name ?? student.Batch?.Branch?.Name;

        var invoices = await _dbContext.FeeInvoices
            .AsNoTracking()
            .Include(i => i.Items)
                .ThenInclude(it => it.FeeHead)
            .Where(i => i.StudentId == student.Id && i.Status != InvoiceStatus.Cancelled)
            .ToListAsync();

        var invoiceIds = invoices.Select(i => i.Id).ToList();

        var payments = await _dbContext.FeePayments
            .AsNoTracking()
            .Where(p => invoiceIds.Contains(p.InvoiceId))
            .OrderByDescending(p => p.PaymentDate)
            .ToListAsync();

        var monthsList = new List<FeeCardMonthEntryDto>();
        decimal schoolMonthlyRate = 0m;
        decimal coachingMonthlyRate = 0m;
        decimal transportMonthlyRate = 0m;
        decimal hostelMonthlyRate = 0m;
        decimal libraryMonthlyRate = 0m;

        if (student.IsSchoolStudent && student.ClassId.HasValue)
        {
            schoolMonthlyRate = await _dbContext.ClassFeeStructures
                .AsNoTracking()
                .Include(c => c.FeeHead)
                .Where(c => c.ClassId == student.ClassId.Value && c.IsActive)
                .Where(c => c.FeeHead != null && 
                            c.FeeHead.Frequency == "Monthly" && 
                            c.FeeHead.Category != "OneTime")
                .SumAsync(c => c.Amount);
        }

        if (student.IsCoachingStudent && student.BatchId.HasValue)
        {
            coachingMonthlyRate = student.Batch?.StandardMonthlyFee ?? 0m;
            if (coachingMonthlyRate == 0m)
            {
                coachingMonthlyRate = await _dbContext.ClassFeeStructures
                    .AsNoTracking()
                    .Include(c => c.FeeHead)
                    .Where(c => c.BatchId == student.BatchId.Value && c.IsActive)
                    .Where(c => c.FeeHead != null && 
                                c.FeeHead.Frequency == "Monthly" && 
                                c.FeeHead.Category != "OneTime")
                    .SumAsync(c => c.Amount);
            }
        }

        if (student.IsTransportStudent)
        {
            var transAlloc = await _dbContext.TransportAllocations
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.StudentId == student.Id && t.Status == "Active");
            if (transAlloc != null && !transAlloc.IsFreeAllocation && transAlloc.MonthlyFare > 0)
            {
                transportMonthlyRate = transAlloc.MonthlyFare;
            }
        }

        if (student.IsHostelStudent)
        {
            var hostelAlloc = await _dbContext.HostelAllocations
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.StudentId == student.Id && a.Status == "Active");
            if (hostelAlloc != null)
            {
                hostelMonthlyRate = hostelAlloc.MonthlyRent + (hostelAlloc.IsMessIncluded ? hostelAlloc.MonthlyMessFee : 0m);
            }
        }

        if (student.IsLibraryMember && student.MonthlyLibraryFee > 0)
        {
            libraryMonthlyRate = student.MonthlyLibraryFee;
        }

        decimal monthlyFeeRate = schoolMonthlyRate + coachingMonthlyRate + transportMonthlyRate + hostelMonthlyRate + libraryMonthlyRate;

        var monthlyItemsList = new List<string>();
        if (schoolMonthlyRate > 0) monthlyItemsList.Add($"School Tuition Fee: ₹{schoolMonthlyRate:N0}");
        if (coachingMonthlyRate > 0) monthlyItemsList.Add($"Coaching Fee: ₹{coachingMonthlyRate:N0}");
        if (transportMonthlyRate > 0) monthlyItemsList.Add($"Transport Fee: ₹{transportMonthlyRate:N0}");
        if (hostelMonthlyRate > 0) monthlyItemsList.Add($"Hostel / Accommodation Fee: ₹{hostelMonthlyRate:N0}");
        if (libraryMonthlyRate > 0) monthlyItemsList.Add($"Library Fee: ₹{libraryMonthlyRate:N0}");
        string? monthlyBreakdownNote = monthlyItemsList.Any()
            ? string.Join("\n", monthlyItemsList.Select((item, idx) => $"{idx + 1}. {item}"))
            : null;

        // Automated Sibling Discount & Concession Detection for Recurring Monthly Fees
        var sessionStart = new DateTime(startYear, 4, 1);
        var sessionEnd = new DateTime(startYear + 1, 3, 31);

        var studentSib = await _dbContext.StudentSiblings
            .AsNoTracking()
            .Where(s => s.DiscountPercent > 0 && s.StudentId == student.Id)
            .OrderByDescending(s => s.DiscountPercent)
            .FirstOrDefaultAsync();

        var activeConcession = await _dbContext.StudentFeeConcessions
            .AsNoTracking()
            .Where(c => c.TenantId == student.TenantId &&
                        c.StudentId == student.Id &&
                        c.Status == "Active" &&
                        c.ApplicableFrom <= sessionEnd &&
                        (c.ApplicableTo == null || c.ApplicableTo >= sessionStart))
            .OrderByDescending(c => c.DiscountValue)
            .FirstOrDefaultAsync();

        decimal grossMonthlyFeeRate = monthlyFeeRate;
        decimal recurringMonthlyConcession = 0m;

        if (studentSib != null && studentSib.DiscountPercent > 0)
        {
            recurringMonthlyConcession = Math.Round(grossMonthlyFeeRate * (studentSib.DiscountPercent / 100m), 2);
        }
        else if (activeConcession != null)
        {
            if (activeConcession.DiscountMode == "Percentage")
            {
                recurringMonthlyConcession = Math.Round(grossMonthlyFeeRate * (activeConcession.DiscountValue / 100m), 2);
            }
            else
            {
                recurringMonthlyConcession = Math.Min(grossMonthlyFeeRate, activeConcession.DiscountValue);
            }
        }

        decimal netMonthlyFeeRate = Math.Max(0m, grossMonthlyFeeRate - recurringMonthlyConcession);

        DateTime joinRefDate = student.JoiningDate != default 
            ? student.JoiningDate 
            : new DateTime(startYear, 4, 1);

        // Dynamic Admission Cutoff Rule from AutomationSettings
        var autoSettings = await _dbContext.AutomationSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == student.TenantId);
        int cutoffDay = autoSettings?.AdmissionCutoffDay ?? 20;
        string rolloverPolicy = autoSettings?.AdmissionRolloverPolicy ?? "NextMonthFull";

        // If admission takes place after cutoff day (e.g. Day 21-31), and no invoice was intentionally billed for that joining month,
        // the remaining days are treated as orientation/grace period, and regular monthly billing starts from the 1st of the next month.
        bool hasInvoiceInJoiningMonth = invoices.Any(iv => iv.DueDate.Year == joinRefDate.Year && iv.DueDate.Month == joinRefDate.Month);
        DateTime studentEnrollmentStart;
        if (joinRefDate.Day > cutoffDay && rolloverPolicy == "NextMonthFull" && !hasInvoiceInJoiningMonth)
        {
            studentEnrollmentStart = new DateTime(joinRefDate.Year, joinRefDate.Month, 1).AddMonths(1);
        }
        else
        {
            studentEnrollmentStart = new DateTime(joinRefDate.Year, joinRefDate.Month, 1);
        }

        var currentMonthStart = new DateTime(now.Year, now.Month, 1);

        // Multi-Month Invoicing Distribution Engine:
        // Seamlessly maps Monthly, Quarterly (3m), Half-Yearly (6m), and Yearly (12m) invoices across their
        // covered passbook months. Places one-time charges (Registration/Admission/Kit) in the first month,
        // distributes recurring tuition evenly, and prevents skipping middle months or double-counting totals.
        var invoiceAllocationsByMonth = new Dictionary<(int Year, int Month), List<MonthInvoiceAllocation>>();

        foreach (var inv in invoices.OrderBy(iv => iv.DueDate).ThenBy(iv => iv.CreatedAt))
        {
            int invStartYear = inv.DueDate.Year;
            int invStartMonth = inv.DueDate.Month;
            int cycleMonths = 1;

            if (!string.IsNullOrEmpty(inv.InvoiceNumber))
            {
                var match = System.Text.RegularExpressions.Regex.Match(
                    inv.InvoiceNumber,
                    @"^INV-(?:HOSTEL-)?(\d{4})(\d{2})([QHY])?-",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                if (match.Success)
                {
                    invStartYear = int.Parse(match.Groups[1].Value);
                    invStartMonth = int.Parse(match.Groups[2].Value);
                    string code = match.Groups[3].Value.ToUpperInvariant();
                    cycleMonths = code switch
                    {
                        "Q" => 3,
                        "H" => 6,
                        "Y" => 12,
                        _ => 1
                    };
                }
            }

            if (cycleMonths == 1 && !string.IsNullOrEmpty(inv.Title))
            {
                if (inv.Title.Contains("Quarterly", StringComparison.OrdinalIgnoreCase) || inv.Title.Contains("3 Mos", StringComparison.OrdinalIgnoreCase))
                    cycleMonths = 3;
                else if (inv.Title.Contains("Half-Yearly", StringComparison.OrdinalIgnoreCase) || inv.Title.Contains("6 Mos", StringComparison.OrdinalIgnoreCase))
                    cycleMonths = 6;
                else if (inv.Title.Contains("Yearly", StringComparison.OrdinalIgnoreCase) || inv.Title.Contains("Annual", StringComparison.OrdinalIgnoreCase))
                    cycleMonths = 12;
            }

            bool IsRecurringMonthlyHead(FeeInvoiceItem it)
            {
                if (it.FeeHead != null)
                {
                    if (it.FeeHead.Frequency == "Monthly" || it.FeeHead.Frequency == "Quarterly")
                    {
                        return it.FeeHead.Category != "OneTime" && it.FeeHead.Category != "Admission" && it.FeeHead.Category != "Supplies";
                    }
                    return false;
                }
                if (!string.IsNullOrEmpty(it.HeadName))
                {
                    var name = it.HeadName;
                    if (name.Contains("Tuition", StringComparison.OrdinalIgnoreCase) ||
                        name.Contains("Transport", StringComparison.OrdinalIgnoreCase) ||
                        name.Contains("Hostel", StringComparison.OrdinalIgnoreCase) ||
                        name.Contains("Mess", StringComparison.OrdinalIgnoreCase) ||
                        name.Contains("Library", StringComparison.OrdinalIgnoreCase) ||
                        name.Contains("Coaching Fee", StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }
                }
                return false;
            }

            var otItems = inv.Items?.Where(it => it.Amount > 0 && !IsRecurringMonthlyHead(it)).ToList() ?? new List<FeeInvoiceItem>();

            decimal totalOneTime = otItems.Sum(it => it.Amount);
            string? oneTimeNote = inv.Items != null && inv.Items.Any()
                ? string.Join("\n", inv.Items
                    .Where(it => it.Amount > 0)
                    .OrderByDescending(it => IsRecurringMonthlyHead(it))
                    .ThenBy(it => it.HeadName)
                    .Select((it, idx) => $"{idx + 1}. {it.HeadName}: ₹{it.Amount:N0}"))
                : (otItems.Any() ? string.Join("\n", otItems.Select((it, idx) => $"{idx + 1}. {it.HeadName}: ₹{it.Amount:N0}")) : null);

            decimal invConcession = inv.Items?.Where(it => it.Amount < 0).Sum(it => -it.Amount) ?? 0m;
            decimal totalInvoicePayable = inv.TotalAmount;
            decimal totalInvoicePaid = inv.PaidAmount;

            // Recurring amount is total invoice minus one-time heads
            decimal totalRecurring = Math.Max(0m, totalInvoicePayable - totalOneTime);
            decimal baseMonthlyRecurring = cycleMonths > 0 ? Math.Round(totalRecurring / cycleMonths, 2) : totalRecurring;
            decimal lastMonthlyRecurring = cycleMonths > 1 ? (totalRecurring - (baseMonthlyRecurring * (cycleMonths - 1))) : baseMonthlyRecurring;

            decimal baseMonthlyConcession = cycleMonths > 0 ? Math.Round(invConcession / cycleMonths, 2) : invConcession;
            decimal lastMonthlyConcession = cycleMonths > 1 ? (invConcession - (baseMonthlyConcession * (cycleMonths - 1))) : baseMonthlyConcession;

            var pmt = payments.FirstOrDefault(p => p.InvoiceId == inv.Id);
            decimal remainingPaidToDistribute = totalInvoicePaid;

            DateTime cycleStart = new DateTime(invStartYear, invStartMonth, 1);
            string cycleLabel = cycleMonths switch
            {
                3 => "Quarterly",
                6 => "Half-Yearly",
                12 => "Yearly",
                _ => "Monthly"
            };

            for (int m = 1; m <= cycleMonths; m++)
            {
                DateTime coveredMonthDate = cycleStart.AddMonths(m - 1);
                var key = (coveredMonthDate.Year, coveredMonthDate.Month);

                decimal monthlyRecurring = (m == cycleMonths) ? lastMonthlyRecurring : baseMonthlyRecurring;
                decimal monthlyConcession = (m == cycleMonths) ? lastMonthlyConcession : baseMonthlyConcession;

                // Month 1 carries the one-time charges; subsequent months carry only recurring monthly fee
                decimal monthOneTime = (m == 1) ? totalOneTime : 0m;
                string? monthOneTimeNote = (m == 1) ? oneTimeNote : null;

                decimal monthGrossPayable = monthlyRecurring + monthOneTime + monthlyConcession;
                decimal monthPayable = monthlyRecurring + monthOneTime;

                // Distribute payments FIFO across the cycle months
                decimal monthPaid = Math.Min(monthPayable, remainingPaidToDistribute);
                remainingPaidToDistribute = Math.Max(0m, remainingPaidToDistribute - monthPaid);
                decimal monthBalance = Math.Max(0m, monthPayable - monthPaid);

                string monthStatus;
                if (monthPaid >= monthPayable && monthPayable > 0)
                    monthStatus = "Paid";
                else if (monthPaid > 0 && monthPaid < monthPayable)
                    monthStatus = "PartiallyPaid";
                else if (inv.DueDate < now && monthPaid == 0)
                    monthStatus = "Overdue";
                else if (monthPaid == 0)
                    monthStatus = "Due";
                else
                    monthStatus = inv.Status.ToString();

                if (!string.IsNullOrWhiteSpace(inv.CancellationReason) && inv.CancellationReason.Contains("[BALANCE WAIVED & SETTLED]"))
                {
                    monthStatus = "Settled";
                }

                string monthRemarks;
                if (!string.IsNullOrWhiteSpace(inv.CancellationReason))
                {
                    monthRemarks = inv.CancellationReason;
                }
                else if (m == 1 && monthOneTime > 0)
                {
                    monthRemarks = cycleMonths > 1
                        ? $"Mo ₹{monthlyRecurring:N0} + One-Time: ₹{monthOneTime:N0} ({monthOneTimeNote}) [{cycleLabel}]"
                        : $"Monthly: ₹{monthlyRecurring:N0} + One-Time: ₹{monthOneTime:N0} ({monthOneTimeNote})";
                }
                else if (cycleMonths > 1)
                {
                    monthRemarks = $"Covered under {cycleLabel} Invoice ({inv.InvoiceNumber})";
                }
                else if (!string.IsNullOrWhiteSpace(pmt?.Remarks))
                {
                    monthRemarks = pmt.Remarks;
                }
                else
                {
                    monthRemarks = inv.Title;
                }

                if (!invoiceAllocationsByMonth.ContainsKey(key))
                {
                    invoiceAllocationsByMonth[key] = new List<MonthInvoiceAllocation>();
                }

                invoiceAllocationsByMonth[key].Add(new MonthInvoiceAllocation
                {
                    Invoice = inv,
                    Payment = pmt,
                    GrossPayable = monthGrossPayable,
                    MonthConcession = monthlyConcession,
                    Payable = monthPayable,
                    Paid = monthPaid,
                    Balance = monthBalance,
                    Status = monthStatus,
                    OneTimeCharges = monthOneTime,
                    OneTimeChargesNote = monthOneTimeNote,
                    Remarks = monthRemarks,
                    MonthIndexInCycle = m,
                    TotalCycleMonths = cycleMonths,
                    BillingCycleTag = cycleMonths > 1 ? cycleLabel : null
                });
            }
        }

        for (int i = 1; i <= 12; i++)
        {
            int calMonth = i <= 9 ? i + 3 : i - 9;
            int calYear = i <= 9 ? startYear : startYear + 1;
            var monthDate = new DateTime(calYear, calMonth, 1);
            string monthName = monthDate.ToString("MMMM yyyy");
            string monthShort = monthDate.ToString("MMM yyyy");

            var key = (calYear, calMonth);
            if (invoiceAllocationsByMonth.TryGetValue(key, out var allocations) && allocations.Count > 0)
            {
                decimal grossPayable = allocations.Sum(a => a.GrossPayable);
                decimal monthConcession = allocations.Sum(a => a.MonthConcession);
                decimal payable = allocations.Sum(a => a.Payable);
                decimal paid = allocations.Sum(a => a.Paid);
                decimal balance = allocations.Sum(a => a.Balance);
                decimal oneTimeCharges = allocations.Sum(a => a.OneTimeCharges);
                string? oneTimeChargesNote = string.Join("\n", allocations.Where(a => !string.IsNullOrEmpty(a.OneTimeChargesNote)).Select(a => a.OneTimeChargesNote));
                if (string.IsNullOrWhiteSpace(oneTimeChargesNote))
                {
                    oneTimeChargesNote = monthlyBreakdownNote;
                }

                string status;
                if (balance <= 0 && payable > 0) status = "Paid";
                else if (paid > 0 && balance > 0) status = "PartiallyPaid";
                else if (allocations.Any(a => a.Status == "Settled")) status = "Settled";
                else if (allocations.Any(a => a.Status == "Overdue")) status = "Overdue";
                else status = "Due";

                string invoiceNumber = string.Join(", ", allocations.Select(a => a.Invoice.InvoiceNumber).Distinct());
                string? receiptNumber = string.Join(", ", allocations.Where(a => a.Payment != null && !string.IsNullOrEmpty(a.Payment.ReceiptNumber)).Select(a => a.Payment!.ReceiptNumber).Distinct());
                if (string.IsNullOrWhiteSpace(receiptNumber)) receiptNumber = null;

                DateTime? paymentDate = allocations.Where(a => a.Payment != null).OrderByDescending(a => a.Payment!.PaymentDate).FirstOrDefault()?.Payment?.PaymentDate;
                var paymentObj = allocations.FirstOrDefault(a => a.Payment != null)?.Payment;
                string? paymentMode = paymentObj == null ? null : FormatPaymentMode(paymentObj.Mode);
                string remarks = string.Join(" | ", allocations.Select(a => a.Remarks).Distinct());
                string? billingCycleTag = allocations.FirstOrDefault(a => !string.IsNullOrEmpty(a.BillingCycleTag))?.BillingCycleTag;

                monthsList.Add(new FeeCardMonthEntryDto(
                    i,
                    monthName,
                    monthShort,
                    calMonth,
                    calYear,
                    status,
                    grossPayable,
                    monthConcession,
                    payable,
                    paid,
                    balance,
                    invoiceNumber,
                    receiptNumber,
                    paymentDate.HasValue ? DateTime.SpecifyKind(paymentDate.Value, DateTimeKind.Utc) : null,
                    paymentMode,
                    remarks,
                    oneTimeCharges,
                    oneTimeChargesNote,
                    billingCycleTag
                ));
            }
            else if (monthDate < studentEnrollmentStart)
            {
                // Month prior to student admission — no fees applicable for pre-admission period
                monthsList.Add(new FeeCardMonthEntryDto(
                    i,
                    monthName,
                    monthShort,
                    calMonth,
                    calYear,
                    "N/A",
                    0m,
                    0m,
                    0m,
                    0m,
                    0m,
                    null,
                    null,
                    null,
                    null,
                    "Pre-Admission (पूर्व नामांकन)"
                ));
            }
            else
            {
                bool isFuture = monthDate > currentMonthStart;
                string status = isFuture ? "Upcoming" : "Due";
                decimal balanceDue = isFuture ? 0m : netMonthlyFeeRate;

                monthsList.Add(new FeeCardMonthEntryDto(
                    i,
                    monthName,
                    monthShort,
                    calMonth,
                    calYear,
                    status,
                    grossMonthlyFeeRate,
                    recurringMonthlyConcession,
                    netMonthlyFeeRate,
                    0m,
                    balanceDue,
                    null,
                    null,
                    null,
                    null,
                    null,
                    0m,
                    monthlyBreakdownNote
                ));
            }
        }

        decimal totalAnnualFee = monthsList.Sum(m => m.AmountPayable);
        decimal totalConcession = monthsList.Sum(m => m.ConcessionAmount);
        decimal totalPaid = monthsList.Sum(m => m.AmountPaid);
        decimal totalBalanceDue = monthsList.Sum(m => m.BalanceDue);

        decimal pendingLibFine = await _dbContext.LibraryCirculations
            .Where(c => c.StudentId == student.Id && c.FineStatus == "Pending")
            .SumAsync(c => c.FineAmount);

        decimal totalOneTimeFee = monthsList.Sum(m => m.OneTimeCharges);

        return new StudentFeeCardDto(
            student.Id,
            student.StudentName,
            student.AdmissionNumber,
            student.RollNumber,
            student.Class?.Name,
            student.Section?.Name,
            student.Batch?.Name,
            student.Gender,
            student.JoiningDate,
            student.ParentName,
            student.MotherName,
            student.ParentWhatsAppPhone,
            student.EmergencyContactPhone,
            student.Address,
            student.ProfilePhoto,
            netMonthlyFeeRate > 0 ? netMonthlyFeeRate : grossMonthlyFeeRate,
            sessionName,
            tenant?.Name ?? "Institute Management ERP",
            tenant?.Address ?? "",
            tenant?.ContactPhone,
            null,
            tenant?.ProfilePhoto,
            branchName,
            monthsList,
            totalAnnualFee,
            totalConcession,
            totalPaid,
            totalBalanceDue,
            pendingLibFine,
            student.SchoolRollNumber,
            student.CoachingRollNumber,
            student.IsSchoolStudent,
            student.IsCoachingStudent,
            totalOneTimeFee,
            student.CoachingJoiningDate
        );
    }

    private static string FormatPaymentMode(PaymentMode mode)
    {
        return (int)mode switch
        {
            0 => "Cash",
            1 => "UPI",
            2 => "Bank Transfer",
            3 => "Cheque",
            4 => "Card",
            5 => "Net Banking",
            _ => mode.ToString() == "0" ? "Cash" : mode.ToString()
        };
    }

    [HttpGet("student/{studentId:guid}/library-dues")]
    public async Task<ActionResult<StudentLibraryDuesDto>> GetStudentLibraryDues(Guid studentId)
    {
        var now = DateTime.UtcNow;

        // 1. Pending fines from already-returned books
        var returnedPendingList = await _dbContext.LibraryCirculations
            .AsNoTracking()
            .Include(c => c.BookCopy)
                .ThenInclude(bc => bc!.Book)
            .Where(c => c.StudentId == studentId && c.FineStatus == "Pending" && c.FineAmount > 0)
            .OrderBy(c => c.DueDate)
            .ToListAsync();

        var pendingItems = returnedPendingList.Select(c => new StudentPendingFineItemDto(
            c.Id,
            c.BookCopy?.AccessionNumber ?? "N/A",
            c.BookCopy?.Book?.Title ?? "Book",
            c.OverdueDays,
            c.FineAmount,
            c.DueDate,
            c.ReturnDate
        )).ToList();

        // 2. Active borrowed books that have passed due date (Unreturned Overdue Books)
        var activeOverdueList = await _dbContext.LibraryCirculations
            .AsNoTracking()
            .Include(c => c.BookCopy)
                .ThenInclude(bc => bc!.Book)
            .Where(c => c.StudentId == studentId
                     && (c.Status == "Issued" || c.Status == "Overdue")
                     && c.DueDate.Date < now.Date
                     && c.FineStatus != "Paid")
            .OrderBy(c => c.DueDate)
            .ToListAsync();

        foreach (var active in activeOverdueList)
        {
            int overdueDays = (int)(now.Date - active.DueDate.Date).TotalDays;
            decimal finePerDay = active.FinePerDay > 0 ? active.FinePerDay : 2.0m;
            decimal calculatedFine = overdueDays * finePerDay;

            pendingItems.Add(new StudentPendingFineItemDto(
                active.Id,
                active.BookCopy?.AccessionNumber ?? "N/A",
                active.BookCopy?.Book?.Title ?? "Book",
                overdueDays,
                calculatedFine,
                active.DueDate,
                null // Still with student
            ));
        }

        var totalPendingFine = pendingItems.Sum(x => x.FineAmount);

        return Ok(new StudentLibraryDuesDto(
            studentId,
            totalPendingFine,
            pendingItems.Count,
            pendingItems,
            activeOverdueList.Count
        ));
    }

    [HttpPost("collect-fifo")]
    public async Task<ActionResult<FeePaymentReceiptDto>> CollectFeeFifo([FromBody] CollectFifoFeeDto dto)
    {
        var roleClaim = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value?.ToLower() ?? "";
        if (roleClaim.Contains("parent") || roleClaim.Contains("student"))
        {
            return Forbid();
        }

        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<ActionResult<FeePaymentReceiptDto>>(async () =>
        {
            var now = DateTime.UtcNow;
            using var transaction = await _dbContext.Database.BeginTransactionAsync();

            var student = await _dbContext.Students
                .Include(s => s.Branch)
                .Include(s => s.Class)
                .Include(s => s.Section)
                .Include(s => s.Batch)
                    .ThenInclude(b => b!.Branch)
                .FirstOrDefaultAsync(s => s.Id == dto.StudentId);

            if (student == null) return NotFound("Student not found");

            // Fetch unpaid/partial invoices chronologically (FIFO by DueDate) — skip Cancelled
            var unpaidInvoices = await _dbContext.FeeInvoices
                .Include(i => i.Items)
                .Where(i => i.StudentId == dto.StudentId
                         && i.Status != InvoiceStatus.Paid
                         && i.Status != InvoiceStatus.Cancelled)
                .OrderBy(i => i.DueDate)
                .ToListAsync();

            if (dto.ItemPayments != null && dto.ItemPayments.Count > 0)
            {
                var selectedItemIds = dto.ItemPayments.Select(p => p.ItemId).ToHashSet();
                unpaidInvoices = unpaidInvoices
                    .OrderByDescending(i => i.Items != null && i.Items.Any(it => selectedItemIds.Contains(it.Id)))
                    .ThenBy(i => i.DueDate)
                    .ToList();
            }

            // Check student's pending library fines (Both returned pending & active unreturned overdue)
            var pendingLibCirculations = await _dbContext.LibraryCirculations
                .Include(c => c.BookCopy)
                    .ThenInclude(bc => bc!.Book)
                .Where(c => c.StudentId == dto.StudentId
                         && (
                             (c.FineStatus == "Pending" && c.FineAmount > 0) ||
                             ((c.Status == "Issued" || c.Status == "Overdue") && c.DueDate.Date < now.Date && c.FineStatus != "Paid")
                         ))
                .OrderBy(c => c.DueDate)
                .ToListAsync();

            List<LibraryCirculation> selectedCirculations = new();
            decimal libraryFineToCollect = 0;

            if (dto.IncludeLibraryFine && pendingLibCirculations.Count > 0)
            {
                if (dto.LibraryCirculationIds != null && dto.LibraryCirculationIds.Count > 0)
                {
                    selectedCirculations = pendingLibCirculations
                        .Where(c => dto.LibraryCirculationIds.Contains(c.Id))
                        .ToList();
                }
                else
                {
                    selectedCirculations = pendingLibCirculations;
                }

                foreach (var circ in selectedCirculations)
                {
                    if (circ.Status == "Issued" || circ.Status == "Overdue")
                    {
                        int overdueDays = (int)(now.Date - circ.DueDate.Date).TotalDays;
                        decimal finePerDay = circ.FinePerDay > 0 ? circ.FinePerDay : 2.0m;
                        circ.OverdueDays = overdueDays;
                        circ.FineAmount = overdueDays * finePerDay;
                    }
                }

                libraryFineToCollect = selectedCirculations.Sum(c => c.FineAmount);
            }

            if (unpaidInvoices.Count == 0 && libraryFineToCollect == 0)
            {
                return BadRequest(new { message = "This student has zero outstanding due fees or library fines!" });
            }

            decimal totalAmountPaid = dto.AmountPaid;
            decimal finePaidNow = 0;
            decimal tuitionToAllocate = totalAmountPaid;

            if (libraryFineToCollect > 0)
            {
                finePaidNow = Math.Min(totalAmountPaid, libraryFineToCollect);
                tuitionToAllocate = totalAmountPaid - finePaidNow;
            }

            var receiptNo = "REC-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss");
            FeePayment? lastPayment = null;
            decimal tuitionAllocatedTotal = 0;
            var allocatedInvoicesList = new List<(FeeInvoice Invoice, decimal AllocatedAmount)>();

            if (tuitionToAllocate > 0 && unpaidInvoices.Count > 0)
            {
                decimal remainingTuition = tuitionToAllocate;
                foreach (var inv in unpaidInvoices)
                {
                    if (remainingTuition <= 0) break;

                    decimal invoiceDue = inv.TotalAmount - inv.PaidAmount;
                    decimal allocateForThisInv = Math.Min(remainingTuition, invoiceDue);
                    if (allocateForThisInv <= 0) continue;

                    inv.PaidAmount += allocateForThisInv;
                    tuitionAllocatedTotal += allocateForThisInv;
                    if (inv.PaidAmount >= inv.TotalAmount)
                    {
                        inv.Status = InvoiceStatus.Paid;
                    }
                    else
                    {
                        inv.Status = InvoiceStatus.Partial;
                    }

                    // Update invoice items' PaidAmount as well
                    if (inv.Items != null && inv.Items.Count > 0)
                    {
                        var itemPaymentDict = (dto.ItemPayments != null && dto.ItemPayments.Count > 0)
                            ? dto.ItemPayments.ToDictionary(p => p.ItemId, p => p.Amount)
                            : null;

                        if (itemPaymentDict != null && inv.Items.Any(it => itemPaymentDict.ContainsKey(it.Id)))
                        {
                            foreach (var it in inv.Items)
                            {
                                if (itemPaymentDict.TryGetValue(it.Id, out var itPaidAmt) && itPaidAmt > 0)
                                {
                                    it.PaidAmount += itPaidAmt;
                                }
                            }
                        }
                        else
                        {
                            decimal itemRemaining = allocateForThisInv;
                            foreach (var it in inv.Items)
                            {
                                if (itemRemaining <= 0) break;
                                decimal itemDue = it.Amount - it.PaidAmount;
                                if (itemDue <= 0) continue;
                                decimal itemAlloc = Math.Min(itemRemaining, itemDue);
                                it.PaidAmount += itemAlloc;
                                itemRemaining -= itemAlloc;
                            }
                        }
                    }

                    remainingTuition -= allocateForThisInv;
                    allocatedInvoicesList.Add((inv, allocateForThisInv));

                    var payment = new FeePayment
                    {
                        TenantId = _currentUser.TenantId,
                        BranchId = inv.BranchId ?? student.BranchId ?? _currentUser.BranchId,
                        InvoiceId = inv.Id,
                        ReceiptNumber = receiptNo,
                        AmountPaid = allocateForThisInv,
                        Mode = dto.Mode,
                        TransactionRef = dto.TransactionRef,
                        Remarks = dto.Remarks,
                        PaymentDate = DateTime.UtcNow
                    };

                    _dbContext.FeePayments.Add(payment);
                    lastPayment = payment;
                }
            }

            if (finePaidNow > 0)
            {
                foreach (var circ in selectedCirculations)
                {
                    circ.FineStatus = "Paid";
                    circ.FinePaymentReceiptNumber = receiptNo;
                    circ.FinePaidAt = DateTime.UtcNow;
                }
            }

            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            // Calculate remaining total outstanding balance — exclude Cancelled invoices
            var totalOutstandingDue = await _dbContext.FeeInvoices
                .Where(i => i.StudentId == dto.StudentId && i.Status != InvoiceStatus.Cancelled)
                .SumAsync(i => i.TotalAmount - i.PaidAmount);

            var remainingPendingLibFine = await _dbContext.LibraryCirculations
                .Where(c => c.StudentId == dto.StudentId && c.FineStatus == "Pending")
                .SumAsync(c => c.FineAmount);

            var pendingArrearsInvoices = await _dbContext.FeeInvoices
                .AsNoTracking()
                .Where(i => i.StudentId == dto.StudentId 
                         && i.Status != InvoiceStatus.Paid 
                         && i.Status != InvoiceStatus.Cancelled
                         && (i.TotalAmount - i.PaidAmount) > 0)
                .OrderBy(i => i.DueDate)
                .ToListAsync();

            var pendingArrears = pendingArrearsInvoices
                .Select(i => new FeeReceiptArrearDto(
                    i.DueDate.ToString("MMMM yyyy"),
                    i.InvoiceNumber,
                    i.Title ?? "Fee Bill",
                    i.TotalAmount - i.PaidAmount
                ))
                .ToList();

            decimal totalDemandBeforePayment = dto.AmountPaid + totalOutstandingDue;

            // Construct Line Items for Receipt with actual Fee Heads
            var lineItems = new List<FeeReceiptLineItemDto>();
            if (tuitionAllocatedTotal > 0)
            {
                var itemPaymentDict = dto.ItemPayments != null && dto.ItemPayments.Count > 0
                    ? dto.ItemPayments.ToDictionary(p => p.ItemId, p => p.Amount)
                    : null;

                foreach (var (inv, allocAmt) in allocatedInvoicesList)
                {
                    if (inv.Items != null && inv.Items.Count > 0)
                    {
                        if (itemPaymentDict != null && inv.Items.Any(it => itemPaymentDict.ContainsKey(it.Id)))
                        {
                            foreach (var it in inv.Items)
                            {
                                if (itemPaymentDict.TryGetValue(it.Id, out var itPaidAmt) && itPaidAmt > 0)
                                {
                                    lineItems.Add(new FeeReceiptLineItemDto(
                                        lineItems.Count + 1,
                                        it.HeadName,
                                        FormatReceiptItemSubtitle(it.HeadName, inv.Title, it.Description),
                                        inv.InvoiceNumber,
                                        itPaidAmt
                                    ));
                                }
                            }
                        }
                        else
                        {
                            decimal remainingInvAlloc = allocAmt;
                            var itemsList = inv.Items.Where(it => it.Amount > 0).ToList();
                            decimal totalPositiveAmt = itemsList.Sum(it => it.Amount);
                            for (int idx = 0; idx < itemsList.Count; idx++)
                            {
                                var it = itemsList[idx];
                                decimal itShare;
                                if (idx == itemsList.Count - 1)
                                {
                                    itShare = remainingInvAlloc;
                                }
                                else
                                {
                                    itShare = totalPositiveAmt > 0
                                        ? Math.Round(allocAmt * (it.Amount / totalPositiveAmt), 2)
                                        : it.Amount;
                                    if (itShare > remainingInvAlloc) itShare = remainingInvAlloc;
                                }
                                remainingInvAlloc -= itShare;

                                if (itShare > 0)
                                {
                                    lineItems.Add(new FeeReceiptLineItemDto(
                                        lineItems.Count + 1,
                                        it.HeadName,
                                        FormatReceiptItemSubtitle(it.HeadName, inv.Title, it.Description),
                                        inv.InvoiceNumber,
                                        itShare
                                    ));
                                }
                            }
                        }
                    }
                    else
                    {
                        lineItems.Add(new FeeReceiptLineItemDto(
                            lineItems.Count + 1,
                            inv.Title ?? "Tuition & Coaching Fee Settlement",
                            dto.Remarks ?? "Standard Tuition Fee installment",
                            inv.InvoiceNumber,
                            allocAmt
                        ));
                    }
                }
            }

            string? libraryFineParticulars = null;
            if (finePaidNow > 0)
            {
                var bookTitles = string.Join(", ", selectedCirculations.Select(c => c.BookCopy?.Book?.Title ?? c.BookCopy?.AccessionNumber ?? "Book"));
                var refAcc = string.Join(", ", selectedCirculations.Select(c => c.BookCopy?.AccessionNumber ?? "ACC"));
                libraryFineParticulars = $"Late Return Fine ({bookTitles})";
                lineItems.Add(new FeeReceiptLineItemDto(
                    lineItems.Count + 1,
                    "Library Overdue Fine Settlement",
                    libraryFineParticulars,
                    refAcc,
                    finePaidNow
                ));
            }

            var autoSettings = await _dbContext.AutomationSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);
            bool isWhatsAppReceiptActive = autoSettings?.WhatsAppFeeReceiptsEnabled ?? true;

            if (dto.SendWhatsAppReceipt && isWhatsAppReceiptActive && student != null)
            {
                await _whatsAppService.SendFeeReceiptAsync(
                    _currentUser.TenantId,
                    student.ParentWhatsAppPhone,
                    student.StudentName,
                    receiptNo,
                    dto.AmountPaid,
                    totalOutstandingDue + remainingPendingLibFine
                );
            }

            // Resolve hostel bed info for the receipt
            var hostelAlloc = await _dbContext.HostelAllocations
                .AsNoTracking()
                .Include(a => a.Bed)
                    .ThenInclude(b => b!.Room)
                        .ThenInclude(r => r!.Hostel)
                .Where(a => a.StudentId == dto.StudentId && a.Status == "Active")
                .FirstOrDefaultAsync();

            string? hostelInfo = hostelAlloc != null
                ? $"{hostelAlloc.Bed?.Room?.Hostel?.Name} - Rm {hostelAlloc.Bed?.Room?.RoomNumber} (Bed {hostelAlloc.Bed?.BedCode})"
                : null;

            string? collectBranchName = student.Branch?.Name ?? student.Batch?.Branch?.Name;
            if (string.IsNullOrEmpty(collectBranchName))
            {
                var mainBr = await _dbContext.Branches.AsNoTracking()
                    .Where(b => b.TenantId == student.TenantId && b.IsActive)
                    .OrderByDescending(b => b.IsMainBranch)
                    .FirstOrDefaultAsync();
                collectBranchName = mainBr?.Name;
            }

            var tenant = await _dbContext.Tenants.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == student.TenantId);

            int recStartYear = DateTime.UtcNow.Month >= 4 ? DateTime.UtcNow.Year : DateTime.UtcNow.Year - 1;
            string academicSession = $"{recStartYear}-{recStartYear + 1}";

            var paidPeriods = allocatedInvoicesList
                .Select(x => !string.IsNullOrWhiteSpace(x.Invoice.Title) ? x.Invoice.Title : x.Invoice.DueDate.ToString("MMMM yyyy"))
                .Distinct()
                .ToList();
            if (paidPeriods.Count == 0 && unpaidInvoices.Count > 0)
            {
                paidPeriods = unpaidInvoices
                    .Select(x => !string.IsNullOrWhiteSpace(x.Title) ? x.Title : x.DueDate.ToString("MMMM yyyy"))
                    .Distinct()
                    .ToList();
            }
            string feePeriod = paidPeriods.Count > 0 ? string.Join(", ", paidPeriods) : DateTime.UtcNow.ToString("MMMM yyyy");

            return Ok(new FeePaymentReceiptDto(
                lastPayment?.Id ?? (selectedCirculations.FirstOrDefault()?.Id ?? Guid.NewGuid()),
                receiptNo,
                student.StudentName,
                student.RollNumber,
                student.Batch?.Name ?? "",
                student.ParentName,
                student.ParentWhatsAppPhone,
                unpaidInvoices.Count > 1 ? "FIFO Multi-Invoice Settlement" : (unpaidInvoices.FirstOrDefault()?.InvoiceNumber ?? "Library Fine Settlement"),
                dto.AmountPaid,
                totalOutstandingDue,
                DateTime.UtcNow,
                dto.Mode,
                dto.TransactionRef,
                dto.Remarks,
                tuitionAllocatedTotal,
                finePaidNow,
                libraryFineParticulars,
                remainingPendingLibFine,
                lineItems,
                hostelInfo,
                collectBranchName,
                student.Class?.Name,
                student.Section?.Name,
                tenant?.Name,
                tenant?.ProfilePhoto,
                tenant?.ContactPhone,
                tenant?.Address,
                student.Id,
                unpaidInvoices.FirstOrDefault()?.Id,
                academicSession,
                pendingArrears,
                totalDemandBeforePayment,
                feePeriod,
                tenant?.OfficialSeal,
                tenant?.DigitalSignature
            ));
        });
    }

    [HttpGet("receipt/{receiptNumber}")]
    [HttpGet("public-receipt/{receiptNumber}")]
    [AllowAnonymous]
    public async Task<ActionResult<FeePaymentReceiptDto>> GetReceiptByNumber(string receiptNumber)
    {
        var payments = await _dbContext.FeePayments
            .AsNoTracking()
            .Include(p => p.Branch)
            .Include(p => p.Invoice)
                .ThenInclude(i => i!.Branch)
            .Include(p => p.Invoice)
                .ThenInclude(i => i!.Items)
            .Include(p => p.Invoice)
                .ThenInclude(i => i!.Student)
                    .ThenInclude(s => s!.Branch)
            .Include(p => p.Invoice)
                .ThenInclude(i => i!.Student)
                    .ThenInclude(s => s!.Batch)
                        .ThenInclude(b => b!.Branch)
            .Include(p => p.Invoice)
                .ThenInclude(i => i!.Student)
                    .ThenInclude(s => s!.Class)
            .Include(p => p.Invoice)
                .ThenInclude(i => i!.Student)
                    .ThenInclude(s => s!.Section)
            .Where(p => p.ReceiptNumber == receiptNumber)
            .ToListAsync();

        var circulations = await _dbContext.LibraryCirculations
            .AsNoTracking()
            .Include(c => c.BookCopy)
                .ThenInclude(bc => bc!.Book)
            .Include(c => c.Student)
                .ThenInclude(s => s!.Batch)
            .Include(c => c.Student)
                .ThenInclude(s => s!.Class)
            .Include(c => c.Student)
                .ThenInclude(s => s!.Section)
            .Where(c => c.FinePaymentReceiptNumber == receiptNumber)
            .ToListAsync();

        if (payments.Count == 0 && circulations.Count == 0) return NotFound("Receipt not found");

        var firstPayment = payments.FirstOrDefault();
        var student = firstPayment?.Invoice?.Student ?? circulations.FirstOrDefault()?.Student;

        decimal totalTuitionPaid = payments.Sum(p => p.AmountPaid);
        decimal totalFinePaid = circulations.Sum(c => c.FineAmount);
        decimal grandTotalPaid = totalTuitionPaid + totalFinePaid;

        var remainingDue = student != null
            ? await _dbContext.FeeInvoices
                .Where(i => i.StudentId == student.Id && i.Status != InvoiceStatus.Cancelled)
                .SumAsync(i => i.TotalAmount - i.PaidAmount)
            : 0m;

        var remainingLibFine = student != null
            ? await _dbContext.LibraryCirculations
                .Where(c => c.StudentId == student.Id && c.FineStatus == "Pending")
                .SumAsync(c => c.FineAmount)
            : 0m;

        var pendingArrearsInvoices = student != null
            ? await _dbContext.FeeInvoices
                .AsNoTracking()
                .Where(i => i.StudentId == student.Id 
                         && i.Status != InvoiceStatus.Paid 
                         && i.Status != InvoiceStatus.Cancelled
                         && (i.TotalAmount - i.PaidAmount) > 0)
                .OrderBy(i => i.DueDate)
                .ToListAsync()
            : new List<FeeInvoice>();

        var pendingArrears = pendingArrearsInvoices
            .Select(i => new FeeReceiptArrearDto(
                i.DueDate.ToString("MMMM yyyy"),
                i.InvoiceNumber,
                i.Title ?? "Fee Bill",
                i.TotalAmount - i.PaidAmount
            ))
            .ToList();

        decimal totalDemandBeforePayment = grandTotalPaid + remainingDue;

        var lineItems = new List<FeeReceiptLineItemDto>();
        if (totalTuitionPaid > 0)
        {
            foreach (var p in payments)
            {
                if (p.Invoice?.Items != null && p.Invoice.Items.Count > 0)
                {
                    decimal remainingAlloc = p.AmountPaid;
                    var itemsList = p.Invoice.Items.Where(it => it.Amount > 0).ToList();
                    decimal totalPositiveAmt = itemsList.Sum(it => it.Amount);
                    for (int idx = 0; idx < itemsList.Count; idx++)
                    {
                        var it = itemsList[idx];
                        decimal itShare;
                        if (idx == itemsList.Count - 1)
                        {
                            itShare = remainingAlloc;
                        }
                        else
                        {
                            itShare = totalPositiveAmt > 0
                                ? Math.Round(p.AmountPaid * (it.Amount / totalPositiveAmt), 2)
                                : it.Amount;
                            if (itShare > remainingAlloc) itShare = remainingAlloc;
                        }
                        remainingAlloc -= itShare;

                        if (itShare > 0)
                        {
                            lineItems.Add(new FeeReceiptLineItemDto(
                                lineItems.Count + 1,
                                it.HeadName,
                                FormatReceiptItemSubtitle(it.HeadName, p.Invoice.Title, it.Description),
                                p.Invoice.InvoiceNumber,
                                itShare
                            ));
                        }
                    }
                }
                else
                {
                    lineItems.Add(new FeeReceiptLineItemDto(
                        lineItems.Count + 1,
                        p.Invoice?.Title ?? "Tuition & Coaching Fee Settlement",
                        p.Remarks ?? "Monthly Tuition Fee installment",
                        p.Invoice?.InvoiceNumber ?? "Tuition Fee",
                        p.AmountPaid
                    ));
                }
            }
        }

        if (totalFinePaid > 0)
        {
            var bookTitles = string.Join(", ", circulations.Select(c => c.BookCopy?.Book?.Title ?? c.BookCopy?.AccessionNumber ?? "Book"));
            var refAcc = string.Join(", ", circulations.Select(c => c.BookCopy?.AccessionNumber ?? "ACC"));
            lineItems.Add(new FeeReceiptLineItemDto(
                lineItems.Count + 1,
                "Library Overdue Fine Settlement",
                $"Late Return Fine ({bookTitles})",
                refAcc,
                totalFinePaid
            ));
        }

        // Resolve hostel bed info for the receipt
        string? receiptHostelInfo = null;
        if (student != null)
        {
            var receiptHostelAlloc = await _dbContext.HostelAllocations
                .AsNoTracking()
                .Include(a => a.Bed)
                    .ThenInclude(b => b!.Room)
                        .ThenInclude(r => r!.Hostel)
                .Where(a => a.StudentId == student.Id && a.Status == "Active")
                .FirstOrDefaultAsync();

            receiptHostelInfo = receiptHostelAlloc != null
                ? $"{receiptHostelAlloc.Bed?.Room?.Hostel?.Name} - Rm {receiptHostelAlloc.Bed?.Room?.RoomNumber} (Bed {receiptHostelAlloc.Bed?.BedCode})"
                : null;
        }

        var tenantId = student?.TenantId ?? firstPayment?.TenantId ?? circulations.FirstOrDefault()?.TenantId ?? _currentUser.TenantId;
        var tenant = tenantId != Guid.Empty
            ? await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId)
            : null;

        DateTime refDt = firstPayment?.PaymentDate ?? DateTime.UtcNow;
        int rcptStartYear = refDt.Month >= 4 ? refDt.Year : refDt.Year - 1;
        string academicSession = $"{rcptStartYear}-{rcptStartYear + 1}";

        var receiptPeriods = payments
            .Select(p => p.Invoice != null ? (!string.IsNullOrWhiteSpace(p.Invoice.Title) ? p.Invoice.Title : p.Invoice.DueDate.ToString("MMMM yyyy")) : null)
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Distinct()
            .ToList();
        string feePeriodRec = receiptPeriods.Count > 0 ? string.Join(", ", receiptPeriods) : (firstPayment?.PaymentDate ?? DateTime.UtcNow).ToString("MMMM yyyy");

        return Ok(new FeePaymentReceiptDto(
            firstPayment?.Id ?? (circulations.FirstOrDefault()?.Id ?? Guid.NewGuid()),
            receiptNumber,
            student?.StudentName ?? "",
            student?.RollNumber ?? "",
            student?.Batch?.Name ?? "",
            student?.ParentName ?? "",
            student?.ParentWhatsAppPhone ?? "",
            payments.Count > 1 ? "FIFO Multi-Invoice Settlement" : (firstPayment?.Invoice?.InvoiceNumber ?? "Library Fine Settlement"),
            grandTotalPaid,
            remainingDue,
            firstPayment != null ? DateTime.SpecifyKind(firstPayment.PaymentDate, DateTimeKind.Utc) : (circulations.FirstOrDefault()?.FinePaidAt ?? DateTime.UtcNow),
            firstPayment?.Mode ?? PaymentMode.Cash,
            firstPayment?.TransactionRef,
            firstPayment?.Remarks,
            totalTuitionPaid,
            totalFinePaid,
            totalFinePaid > 0 ? string.Join(", ", circulations.Select(c => $"{c.BookCopy?.Book?.Title} ({c.BookCopy?.AccessionNumber})")) : null,
            remainingLibFine,
            lineItems,
            receiptHostelInfo,
            firstPayment?.Branch?.Name ?? firstPayment?.Invoice?.Branch?.Name ?? student?.Branch?.Name ?? student?.Batch?.Branch?.Name ?? (await _dbContext.Branches.AsNoTracking().Where(b => b.TenantId == (student != null ? student.TenantId : _currentUser.TenantId) && b.IsActive).OrderByDescending(b => b.IsMainBranch).FirstOrDefaultAsync())?.Name,
            student?.Class?.Name,
            student?.Section?.Name,
            tenant?.Name,
            tenant?.ProfilePhoto,
            tenant?.ContactPhone,
            tenant?.Address,
            student?.Id,
            firstPayment?.InvoiceId,
            academicSession,
            pendingArrears,
            totalDemandBeforePayment,
            feePeriodRec,
            tenant?.OfficialSeal,
            tenant?.DigitalSignature
        ));
    }

    private static string FormatReceiptItemSubtitle(string headName, string? invoiceTitle, string? itemDescription = null)
    {
        if (!string.IsNullOrWhiteSpace(itemDescription))
        {
            var desc = itemDescription.Trim();
            // Suppress internal system tags like Coaching:<guid>, School:<guid>, or raw GUIDs
            if (desc.StartsWith("Coaching:", StringComparison.OrdinalIgnoreCase) ||
                desc.StartsWith("School:", StringComparison.OrdinalIgnoreCase))
            {
                var afterColon = desc.Substring(desc.IndexOf(':') + 1).Trim();
                if (Guid.TryParse(afterColon, out _) || afterColon.Length >= 32)
                {
                    desc = null;
                }
            }
            else if (Guid.TryParse(desc, out _))
            {
                desc = null;
            }
            else if (desc.Equals("LateFeeFine", StringComparison.OrdinalIgnoreCase))
            {
                desc = "Late Payment Penalty";
            }

            if (!string.IsNullOrWhiteSpace(desc))
                return desc;
        }

        if (!string.IsNullOrWhiteSpace(invoiceTitle) && !invoiceTitle.Equals(headName, StringComparison.OrdinalIgnoreCase))
            return invoiceTitle;

        return "";
    }

    [HttpGet("due-slip/{studentId}")]
    public async Task<ActionResult<FeeDueSlipDto>> GetDueSlip(Guid studentId, [FromQuery] Guid? invoiceId = null)
    {
        var student = await _dbContext.Students
            .AsNoTracking()
            .Include(s => s.Branch)
            .Include(s => s.Batch)
                .ThenInclude(b => b!.Branch)
            .FirstOrDefaultAsync(s => s.Id == studentId);

        if (student == null) return NotFound("Student not found");

        var query = _dbContext.FeeInvoices
            .AsNoTracking()
            .Include(i => i.Items)
            .Where(i => i.StudentId == studentId && i.Status != InvoiceStatus.Cancelled && i.TotalAmount > i.PaidAmount);

        if (invoiceId.HasValue && invoiceId.Value != Guid.Empty)
        {
            query = query.Where(i => i.Id == invoiceId.Value);
        }

        var dueInvoices = await query.OrderBy(i => i.DueDate).ToListAsync();

        var items = dueInvoices.Select(i => new FeeDueSlipItemDto(
            i.Id,
            i.InvoiceNumber,
            i.Title,
            i.DueDate,
            i.TotalAmount,
            i.PaidAmount,
            i.TotalAmount - i.PaidAmount,
            i.Items.Select(it => new FeeInvoiceItemDto(it.Id, it.InvoiceId, it.FeeHeadId, it.HeadName, it.Amount, it.PaidAmount, it.Description)).ToList()
        )).ToList();

        var totalDue = items.Sum(i => i.DueAmount);

        var pendingLibFine = await _dbContext.LibraryCirculations
            .Where(c => c.StudentId == studentId && c.FineStatus == "Pending")
            .SumAsync(c => c.FineAmount);

        var activeOverdueCount = await _dbContext.LibraryCirculations
            .CountAsync(c => c.StudentId == studentId && (c.Status == "Issued" || c.Status == "Overdue") && c.DueDate < DateTime.UtcNow);

        // Resolve hostel bed info for the due slip
        var dueSlipHostelAlloc = await _dbContext.HostelAllocations
            .AsNoTracking()
            .Include(a => a.Bed)
                .ThenInclude(b => b!.Room)
                    .ThenInclude(r => r!.Hostel)
            .Where(a => a.StudentId == studentId && a.Status == "Active")
            .FirstOrDefaultAsync();

        string? dueSlipHostelInfo = dueSlipHostelAlloc != null
            ? $"{dueSlipHostelAlloc.Bed?.Room?.Hostel?.Name} - Rm {dueSlipHostelAlloc.Bed?.Room?.RoomNumber} (Bed {dueSlipHostelAlloc.Bed?.BedCode})"
            : null;

        string? dueSlipBranch = student?.Branch?.Name ?? student?.Batch?.Branch?.Name;
        if (string.IsNullOrEmpty(dueSlipBranch) && student != null)
        {
            var mainBr = await _dbContext.Branches.AsNoTracking()
                .Where(b => b.TenantId == student.TenantId && b.IsActive)
                .OrderByDescending(b => b.IsMainBranch)
                .FirstOrDefaultAsync();
            dueSlipBranch = mainBr?.Name;
        }

        return Ok(new FeeDueSlipDto(
            student.Id,
            student.StudentName,
            student.RollNumber,
            student.Batch?.Name ?? "",
            student.ParentName,
            student.ParentWhatsAppPhone,
            totalDue,
            DateTime.UtcNow,
            items,
            pendingLibFine,
            activeOverdueCount,
            dueSlipHostelInfo,
            dueSlipBranch
        ));
    }

    [HttpPost("send-reminder/{invoiceId}")]
    public async Task<ActionResult> SendWhatsAppReminder(Guid invoiceId)
    {
        var invoice = await _dbContext.FeeInvoices
            .Include(i => i.Student)
            .FirstOrDefaultAsync(i => i.Id == invoiceId);

        if (invoice == null || invoice.Student == null) return NotFound("Invoice or Student not found");

        await _whatsAppService.SendFeeReminderAsync(
            _currentUser.TenantId,
            invoice.Student.ParentWhatsAppPhone,
            invoice.Student.StudentName,
            invoice.InvoiceNumber,
            invoice.DueAmount,
            invoice.DueDate
        );

        return Ok(new { message = "WhatsApp Fee Reminder dispatched successfully!" });
    }

    [HttpGet("pending-invoicing-students")]
    public async Task<ActionResult<IEnumerable<PendingInvoicingStudentDto>>> GetPendingInvoicingStudents(
        [FromQuery] int? month = null,
        [FromQuery] int? year = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] bool? newAdmissionsOnly = null)
    {
        var targetMonth = month ?? DateTime.UtcNow.Month;
        var targetYear = year ?? DateTime.UtcNow.Year;
        var tenantId = _currentUser.TenantId;
        var targetBranchId = branchId ?? _currentUser.BranchId;

        // Window for the target month
        var periodStart = new DateTime(targetYear, targetMonth, 1);
        var periodEnd = periodStart.AddMonths(1).AddDays(-1);

        // Broad window for candidate active invoices that could cover target month (up to 12 months prior for yearly/half-yearly/quarterly)
        var windowStart = periodStart.AddMonths(-12);
        var windowEnd = periodEnd.AddMonths(1);

        var candidateInvoices = await _dbContext.FeeInvoices
            .AsNoTracking()
            .Where(i => i.TenantId == tenantId &&
                        i.Status != InvoiceStatus.Cancelled &&
                        i.InvoiceCategory != "Inventory" &&
                        ((i.DueDate >= windowStart && i.DueDate <= windowEnd) ||
                         (i.CreatedAt >= windowStart && i.CreatedAt <= windowEnd)))
            .Select(i => new { i.StudentId, i.InvoiceNumber, i.Title, i.DueDate })
            .ToListAsync();

        var invoicedStudentIds = candidateInvoices
            .Where(i => FeeInvoice.CheckCoversPeriod(i.InvoiceNumber, i.Title, i.DueDate, targetYear, targetMonth))
            .Select(i => i.StudentId)
            .Distinct()
            .ToHashSet();

        // All students who have at least one active non-cancelled, non-inventory fee invoice
        var studentsWithAnyActiveInvoice = await _dbContext.FeeInvoices
            .AsNoTracking()
            .Where(i => i.TenantId == tenantId &&
                        i.Status != InvoiceStatus.Cancelled &&
                        i.InvoiceCategory != "Inventory")
            .Select(i => i.StudentId)
            .Distinct()
            .ToHashSetAsync();

        // Active students who had already joined by this billing period (using stream-specific effective DOJ)
        var studentsQuery = _dbContext.Students
            .AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Batch)
            .Where(s => s.TenantId == tenantId && s.IsActive &&
                ((s.IsCoachingStudent && !s.IsSchoolStudent && s.CoachingJoiningDate != null)
                    ? s.CoachingJoiningDate.Value.Date <= periodEnd.Date
                    : s.JoiningDate.Date <= periodEnd.Date));

        if (targetBranchId.HasValue && targetBranchId.Value != Guid.Empty)
        {
            studentsQuery = studentsQuery.Where(s => s.BranchId == targetBranchId.Value || (s.Batch != null && s.Batch.BranchId == targetBranchId.Value));
        }

        bool isNewAdmissionsMode = newAdmissionsOnly.GetValueOrDefault(true);
        if (isNewAdmissionsMode)
        {
            // For New Admissions awaiting invoicing: ONLY return students who have NEVER had an active fee invoice generated!
            studentsQuery = studentsQuery.Where(s => !studentsWithAnyActiveInvoice.Contains(s.Id));
        }
        else
        {
            // For upcoming billing cycle: exclude students who have an invoice covering target month
            studentsQuery = studentsQuery.Where(s => !invoicedStudentIds.Contains(s.Id));
        }

        var pendingStudents = await studentsQuery
            .OrderByDescending(s => (s.IsCoachingStudent && !s.IsSchoolStudent && s.CoachingJoiningDate != null) ? s.CoachingJoiningDate.Value : s.JoiningDate)
            .Select(s => new PendingInvoicingStudentDto(
                s.Id,
                s.StudentName,
                s.RollNumber,
                s.AdmissionNumber,
                s.ClassId,
                s.Class != null ? s.Class.Name : null,
                s.BatchId,
                s.Batch != null ? s.Batch.Name : null,
                (s.IsCoachingStudent && !s.IsSchoolStudent && s.CoachingJoiningDate != null) ? s.CoachingJoiningDate.Value : s.JoiningDate,
                s.Batch != null ? s.Batch.StandardMonthlyFee : 3500m,
                false,
                null
            ))
            .ToListAsync();

        if (pendingStudents.Count > 0)
        {
            var pIds = pendingStudents.Select(p => p.StudentId).ToList();
            var kitOutwards = await _dbContext.InventoryOutwards
                .AsNoTracking()
                .Where(o => o.TenantId == tenantId && o.StudentId.HasValue && pIds.Contains(o.StudentId.Value))
                .Select(o => new { o.StudentId, o.PaymentStatus })
                .ToListAsync();

            var kitLookup = kitOutwards
                .GroupBy(o => o.StudentId!.Value)
                .ToDictionary(g => g.Key, g => g.First().PaymentStatus);

            pendingStudents = pendingStudents.Select(p => kitLookup.TryGetValue(p.StudentId, out var status)
                ? p with { HasAdmissionKit = true, KitStatus = status }
                : p
            ).ToList();
        }

        return Ok(pendingStudents);
    }

    [HttpPost("generate-monthly-invoices")]
    public async Task<ActionResult<GenerateMonthlyInvoicesResultDto>> GenerateMonthlyInvoices([FromBody] GenerateMonthlyInvoicesRequestDto dto)
    {
        var roleClaim = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value?.ToLower() ?? "";
        if (roleClaim.Contains("parent") || roleClaim.Contains("student"))
        {
            return Forbid();
        }

        if (dto.Year < 2020 || dto.Year > 2050 || dto.Month < 1 || dto.Month > 12)
        {
            return BadRequest("Invalid year or month.");
        }

        var studentsQuery = _dbContext.Students
            .Include(s => s.Batch)
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Where(s => s.IsActive)
            .AsQueryable();

        if (dto.StudentId.HasValue && dto.StudentId != Guid.Empty)
        {
            studentsQuery = studentsQuery.Where(s => s.Id == dto.StudentId.Value);
        }

        if (dto.ClassId.HasValue && dto.ClassId != Guid.Empty)
        {
            studentsQuery = studentsQuery.Where(s => s.ClassId == dto.ClassId.Value);
        }

        if (dto.BatchId.HasValue && dto.BatchId != Guid.Empty)
        {
            studentsQuery = studentsQuery.Where(s => s.BatchId == dto.BatchId.Value);
        }

        if (dto.BranchId.HasValue && dto.BranchId != Guid.Empty)
        {
            studentsQuery = studentsQuery.Where(s => s.BranchId == dto.BranchId.Value || (s.Batch != null && s.Batch.BranchId == dto.BranchId.Value));
        }

        var students = await studentsQuery.ToListAsync();
        if (students.Count == 0)
        {
            return Ok(new GenerateMonthlyInvoicesResultDto(0, 0, "No active students found for the selected criteria."));
        }

        // Map per-student billing cycle overrides if any
        var overridesLookup = dto.StudentCycleOverrides?
            .GroupBy(o => o.StudentId)
            .ToDictionary(g => g.Key, g => g.Last())
            ?? new Dictionary<Guid, StudentBillingCycleOverrideDto>();

        // Build overall search window for candidate existing invoices
        var basePeriodStart = new DateTime(dto.Year, dto.Month, 1);
        int maxCycleMonths = overridesLookup.Any()
            ? Math.Max((int)dto.BillingCycle, overridesLookup.Values.Max(c => (int)c.BillingCycle))
            : (int)dto.BillingCycle;
        var maxPeriodEnd = basePeriodStart.AddMonths(maxCycleMonths).AddDays(-1);

        // Broaden duplicate-check search window for new admissions joining earlier in session
        var earliestAdmission = students.Where(s => s.JoiningDate > DateTime.MinValue).Select(s => s.JoiningDate).DefaultIfEmpty(basePeriodStart).Min();
        var effectiveWindowStart = earliestAdmission < basePeriodStart ? earliestAdmission : basePeriodStart;
        var windowStart = effectiveWindowStart.AddMonths(-12);
        var windowEnd = maxPeriodEnd.AddMonths(1);
        var candidateExistingInvoices = await _dbContext.FeeInvoices
            .AsNoTracking()
            .Where(i => i.TenantId == _currentUser.TenantId &&
                        i.Status != InvoiceStatus.Cancelled &&
                        i.InvoiceCategory != "Inventory" &&
                       ((i.DueDate >= windowStart && i.DueDate <= windowEnd) ||
                        (i.CreatedAt >= windowStart && i.CreatedAt <= windowEnd)))
            .Select(i => new { i.StudentId, i.ClassId, i.InvoiceNumber, i.Title, i.DueDate })
            .ToListAsync();

        // Load active class / batch fee structures
        var classIds = students.Where(s => s.ClassId.HasValue).Select(s => s.ClassId!.Value).Distinct().ToList();
        var batchIds = students.Where(s => s.BatchId.HasValue).Select(s => s.BatchId!.Value).Distinct().ToList();

        var feeStructures = await _dbContext.ClassFeeStructures
            .AsNoTracking()
            .Include(cfs => cfs.FeeHead)
            .Where(cfs => cfs.IsActive &&
                ((cfs.ClassId.HasValue && classIds.Contains(cfs.ClassId.Value)) ||
                 (cfs.BatchId.HasValue && batchIds.Contains(cfs.BatchId.Value))))
            .ToListAsync();

        // ── Validation Guard: If specific class requested, ensure fee matrix is configured ──
        if (dto.ClassId.HasValue && dto.ClassId.Value != Guid.Empty)
        {
            bool hasClassStructure = feeStructures.Any(cfs => cfs.ClassId == dto.ClassId.Value && cfs.IsActive && cfs.Amount > 0);
            if (!hasClassStructure)
            {
                var targetClass = await _dbContext.SchoolClasses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == dto.ClassId.Value);
                return BadRequest(new { message = $"Cannot generate invoices: Fee structure has not been configured in Fee Matrix for '{targetClass?.Name ?? "Selected Class"}'. Please configure and save the Fee Structure Matrix first." });
            }
        }

        // ── Validation Guard: If specific coaching batch requested, ensure fee is configured ──
        if (dto.BatchId.HasValue && dto.BatchId.Value != Guid.Empty)
        {
            var targetBatch = await _dbContext.Batches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == dto.BatchId.Value);
            bool hasBatchMatrixStructure = feeStructures.Any(cfs => cfs.BatchId == dto.BatchId.Value && cfs.IsActive && cfs.Amount > 0);
            bool hasBatchStandardFee = (targetBatch?.StandardMonthlyFee ?? 0) > 0;
            if (!hasBatchMatrixStructure && !hasBatchStandardFee)
            {
                return BadRequest(new { message = $"Cannot generate invoices: Neither standard monthly fee nor fee structure matrix has been configured for Coaching Batch '{targetBatch?.Name ?? "Selected Batch"}'. Please configure the batch fee first." });
            }
        }

        // ── Hostel Fee Engine ────────────────────────────────────────────────
        // Load all active hostel allocations for these students (bulk, pre-loop)
        var studentIds = students.Select(s => s.Id).ToList();
        var activeAllocations = await _dbContext.HostelAllocations
            .AsNoTracking()
            .Include(a => a.Bed)
                .ThenInclude(b => b!.Room)
                    .ThenInclude(r => r!.Hostel)
            .Where(a => a.Status == "Active" && a.MemberType == "Student" && a.StudentId.HasValue && studentIds.Contains(a.StudentId!.Value))
            .ToListAsync();

        // Key: StudentId → HostelAllocation (one active allocation per student)
        var allocationByStudent = activeAllocations
            .Where(a => a.StudentId.HasValue)
            .GroupBy(a => a.StudentId!.Value)
            .ToDictionary(g => g.Key, g => g.First());

        // Resolve Standard & Residential FeeHead IDs by Code (HOSTEL / MESS / COACH / TUI / LIB / TRANS / ATTN_FINE)
        var standardHeads = await _dbContext.FeeHeads
            .AsNoTracking()
            .Where(h => h.IsActive && (h.Code == "HOSTEL" || h.Code == "MESS" || h.Code == "COACH" || h.Code == "TUI" || h.Code == "LIB" || h.Code == "TRANS" || h.Code == "ATTN_FINE"))
            .ToListAsync();

        var hostelFeeHeadId = standardHeads.FirstOrDefault(h => h.Code == "HOSTEL")?.Id;
        var messFeeHeadId   = standardHeads.FirstOrDefault(h => h.Code == "MESS")?.Id;
        var coachFeeHead    = standardHeads.FirstOrDefault(h => h.Code == "COACH");
        var tuiFeeHead      = standardHeads.FirstOrDefault(h => h.Code == "TUI");
        var libFeeHeadId    = standardHeads.FirstOrDefault(h => h.Code == "LIB")?.Id;
        var transFeeHeadId  = standardHeads.FirstOrDefault(h => h.Code == "TRANS")?.Id;
        var attnFineFeeHead = standardHeads.FirstOrDefault(h => h.Code == "ATTN_FINE");
        if (attnFineFeeHead == null)
        {
            var existingHead = await _dbContext.FeeHeads.FirstOrDefaultAsync(h => h.TenantId == _currentUser.TenantId && h.Code == "ATTN_FINE");
            if (existingHead == null)
            {
                existingHead = new FeeHead
                {
                    TenantId = _currentUser.TenantId,
                    BranchId = _currentUser.BranchId,
                    Name = "Attendance Absence Fine",
                    Code = "ATTN_FINE",
                    Description = "Attendance Absence Penalty",
                    Category = "Fine",
                    Frequency = "Monthly",
                    IsActive = true
                };
                _dbContext.FeeHeads.Add(existingHead);
                await _dbContext.SaveChangesAsync();
            }
            attnFineFeeHead = existingHead;
        }

        // Dynamic Attendance Absence Fine Policy Settings (100% UI Configurable, Zero Hardcoding)
        var attSettings = await _dbContext.AttendanceSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(st => st.TenantId == _currentUser.TenantId);
        bool fineEnabled = attSettings?.EnableStudentAbsenceFine ?? true;
        int fineThreshold = (attSettings != null && attSettings.AbsenceFineDaysThreshold > 0) ? attSettings.AbsenceFineDaysThreshold : 3;
        decimal fineUnitAmount = (attSettings != null && attSettings.AbsenceFineAmount >= 0) ? attSettings.AbsenceFineAmount : 10.00m;
        string fineMode = attSettings?.AbsenceFineMode ?? "PerBlock"; // "PerBlock" (e.g. ₹10 per 3 days) or "Flat" (e.g. ₹10 once threshold met)

        // Bulk Pre-fetch student absent counts for the billing month window
        var studentAbsences = new Dictionary<Guid, int>();
        if (fineEnabled && fineUnitAmount > 0 && fineThreshold > 0)
        {
            var absencesList = await _dbContext.StudentAttendances
                .AsNoTracking()
                .Where(a => a.TenantId == _currentUser.TenantId &&
                            studentIds.Contains(a.StudentId) &&
                            a.AttendanceDate >= basePeriodStart &&
                            a.AttendanceDate <= maxPeriodEnd &&
                            a.Status == TeacherAttendanceStatus.Absent)
                .GroupBy(a => a.StudentId)
                .Select(g => new { StudentId = g.Key, AbsentCount = g.Count() })
                .ToListAsync();

            studentAbsences = absencesList.ToDictionary(a => a.StudentId, a => a.AbsentCount);
        }

        // Load active transport allocations for these students (bulk, pre-loop)
        var activeTransportAllocations = await _dbContext.TransportAllocations
            .AsNoTracking()
            .Include(a => a.Stop)
            .Where(a => a.Status == "Active" && a.MemberType == "Student" && a.StudentId.HasValue && studentIds.Contains(a.StudentId!.Value))
            .ToListAsync();
        var transportByStudent = activeTransportAllocations
            .Where(a => a.StudentId.HasValue)
            .GroupBy(a => a.StudentId!.Value)
            .ToDictionary(g => g.Key, g => g.First());

        // ── Load Tenant Automation & Admission Billing Settings ──
        var autoSettings = await _dbContext.AutomationSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == _currentUser.TenantId);
        int cutoffDay = autoSettings?.AdmissionCutoffDay ?? 20;
        string rolloverPolicy = autoSettings?.AdmissionRolloverPolicy ?? "NextMonthFull";
        int fyStartMonth = autoSettings?.FinancialYearStartMonth ?? 4;

        // ── Academic Session Window (April 1 to March 31 in Indian Curriculum) ──
        int sessionStartYear = (dto.Month >= fyStartMonth) ? dto.Year : (dto.Year - 1);
        var sessionStartDate = new DateTime(sessionStartYear, fyStartMonth, 1);
        var sessionEndDate = sessionStartDate.AddYears(1).AddDays(-1).Add(new TimeSpan(23, 59, 59));

        // Pre-load all FeeHeadIds previously billed to these students in the current academic session (exclude Inventory kits!)
        var billedHeadsInSession = await _dbContext.FeeInvoiceItems
            .AsNoTracking()
            .Where(it => studentIds.Contains(it.Invoice!.StudentId) &&
                         it.Invoice!.Status != InvoiceStatus.Cancelled &&
                         it.Invoice.InvoiceCategory != "Inventory" &&
                         it.Invoice.DueDate >= sessionStartDate && it.Invoice.DueDate <= sessionEndDate &&
                         it.FeeHeadId.HasValue)
            .Select(it => new { it.Invoice!.StudentId, it.FeeHeadId!.Value })
            .ToListAsync();

        var billedHeadsLookup = billedHeadsInSession
            .GroupBy(x => x.StudentId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Value).ToHashSet());

        // Pre-load all OneTime fee items previously billed across the student's lifetime (pure DB Frequency == OneTime)
        var lifetimeOneTimeBilled = await _dbContext.FeeInvoiceItems
            .AsNoTracking()
            .Where(it => studentIds.Contains(it.Invoice!.StudentId) &&
                         it.Invoice!.Status != InvoiceStatus.Cancelled &&
                         it.Invoice.InvoiceCategory != "Inventory" &&
                         it.FeeHeadId.HasValue &&
                         (it.FeeHead!.Frequency == "OneTime" || it.FeeHead.Category == "OneTime"))
            .Select(it => new { 
                it.Invoice!.StudentId, 
                it.FeeHeadId!.Value,
                Description = it.Description ?? "",
                IsCoaching = (it.Description != null && it.Description.StartsWith("Coaching:")) ||
                             (it.FeeHead != null && it.FeeHead.ApplicableTo == "Coaching")
            })
            .ToListAsync();

        var lifetimeSchoolOneTimeSet = lifetimeOneTimeBilled
            .Where(x => !x.IsCoaching)
            .GroupBy(x => x.StudentId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Value).ToHashSet());

        var lifetimeCoachingOneTimeSet = lifetimeOneTimeBilled
            .Where(x => x.IsCoaching)
            .GroupBy(x => x.StudentId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Value).ToHashSet());

        // Students who already have at least one active invoice in this academic session (exclude Inventory kits!)
        var studentIdsWithSessionInvoice = await _dbContext.FeeInvoices
            .AsNoTracking()
            .Where(i => studentIds.Contains(i.StudentId) &&
                         i.Status != InvoiceStatus.Cancelled &&
                         i.InvoiceCategory != "Inventory" &&
                         i.DueDate >= sessionStartDate && i.DueDate <= sessionEndDate)
            .Select(i => i.StudentId)
            .Distinct()
            .ToListAsync();
        var studentsWithPriorInvoiceSet = studentIdsWithSessionInvoice.ToHashSet();

        // Students who already have at least one coaching item billed in this academic session (pure DB ApplicableTo / Description / FeeHeadId)
        var studentIdsWithSessionCoachingInvoice = await _dbContext.FeeInvoiceItems
            .AsNoTracking()
            .Where(it => studentIds.Contains(it.Invoice!.StudentId) &&
                         it.Invoice!.Status != InvoiceStatus.Cancelled &&
                         it.Invoice.InvoiceCategory != "Inventory" &&
                         it.Invoice.DueDate >= sessionStartDate && it.Invoice.DueDate <= sessionEndDate &&
                         ((it.Description != null && it.Description.StartsWith("Coaching:")) ||
                          (it.FeeHead != null && it.FeeHead.ApplicableTo == "Coaching") ||
                          (coachFeeHead != null && it.FeeHeadId == coachFeeHead.Id)))
            .Select(it => it.Invoice!.StudentId)
            .Distinct()
            .ToListAsync();
        var studentsWithPriorCoachingInvoiceSet = studentIdsWithSessionCoachingInvoice.ToHashSet();
        // ────────────────────────────────────────────────────────────────────

        // ── Load Active Fee Concessions & Sibling Discounts for Target Students ──
        var activeConcessions = await _dbContext.StudentFeeConcessions
            .AsNoTracking()
            .Include(c => c.FeeHead)
            .Where(c => c.Status == "Active" &&
                        c.ApplicableFrom <= maxPeriodEnd &&
                        (c.ApplicableTo == null || c.ApplicableTo >= basePeriodStart) &&
                        studentIds.Contains(c.StudentId))
            .ToListAsync();
        var concessionsByStudent = activeConcessions
            .GroupBy(c => c.StudentId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var siblingLinks = await _dbContext.StudentSiblings
            .AsNoTracking()
            .Where(s => s.DiscountPercent > 0 && studentIds.Contains(s.StudentId))
            .ToListAsync();
        var siblingLinksByStudent = siblingLinks
            .GroupBy(s => s.StudentId)
            .ToDictionary(g => g.Key, g => g.ToList());

        // ── Inventory Kit Auto-Safeguard (Zero Manual Memory Needed) ──
        // Pre-load all students who have already received an Admission Kit from store/inventory
        var studentsWithKitOutward = await _dbContext.InventoryOutwards
            .AsNoTracking()
            .Where(o => o.TenantId == _currentUser.TenantId &&
                        o.StudentId.HasValue &&
                        studentIds.Contains(o.StudentId.Value) &&
                        o.IssueType == "StudentKitSale")
            .Select(o => o.StudentId!.Value)
            .Distinct()
            .ToListAsync();

        var studentsWithKitInvoice = await _dbContext.FeeInvoices
            .AsNoTracking()
            .Where(i => i.TenantId == _currentUser.TenantId &&
                        studentIds.Contains(i.StudentId) &&
                        i.Status != InvoiceStatus.Cancelled &&
                        i.InvoiceCategory == "Inventory")
            .Select(i => i.StudentId)
            .Distinct()
            .ToListAsync();

        var studentsWithKitSet = studentsWithKitOutward.Concat(studentsWithKitInvoice).ToHashSet();

        // Pre-load all pending unbilled Admission Kit outwards marked 'AddedToFeeBill'
        var pendingKitOutwards = await _dbContext.InventoryOutwards
            .Include(o => o.Items)
                .ThenInclude(oi => oi.Item)
            .Where(o => o.TenantId == _currentUser.TenantId &&
                        o.StudentId.HasValue &&
                        studentIds.Contains(o.StudentId.Value) &&
                        o.PaymentStatus == "AddedToFeeBill")
            .ToListAsync();

        var pendingKitsByStudent = pendingKitOutwards
            .GroupBy(o => o.StudentId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        var defaultPeriodStart = new DateTime(dto.Year, dto.Month, 1);
        var defaultPeriodEnd = defaultPeriodStart.AddMonths((int)dto.BillingCycle).AddDays(-1);
        string defaultPeriodLabel = (int)dto.BillingCycle == 1
            ? defaultPeriodStart.ToString("MMMM yyyy", System.Globalization.CultureInfo.InvariantCulture)
            : $"{defaultPeriodStart:MMMM yyyy} – {defaultPeriodEnd:MMMM yyyy}";

        var newInvoices = new List<FeeInvoice>();
        int skippedCount = 0;
        var skipReasonsEn = new List<string>();
        var skipReasonsHi = new List<string>();
        var random = new Random();

        foreach (var s in students)
        {
            // Per-student billing cycle (custom override or default)
            var hasOverride = overridesLookup.TryGetValue(s.Id, out var customOverride);
            var studentCycle = hasOverride ? customOverride!.BillingCycle : dto.BillingCycle;
            int studentCycleMonths = (int)studentCycle;

            // Determine starting billing period for this student
            int studentStartYear = dto.Year;
            int studentStartMonth = dto.Month;

            bool isNewAdmission = !studentsWithPriorInvoiceSet.Contains(s.Id);

            var effectiveSchoolDate = s.JoiningDate;
            var effectiveCoachingDate = s.CoachingJoiningDate ?? s.JoiningDate;

            var effectiveEarliestDate = (s.IsSchoolStudent && s.IsCoachingStudent)
                ? (effectiveSchoolDate < effectiveCoachingDate ? effectiveSchoolDate : effectiveCoachingDate)
                : (s.IsCoachingStudent ? effectiveCoachingDate : effectiveSchoolDate);

            if (hasOverride && customOverride!.StartMonth.HasValue && customOverride.StartYear.HasValue)
            {
                studentStartMonth = customOverride.StartMonth.Value;
                studentStartYear = customOverride.StartYear.Value;
            }
            else if (dto.AutoBillNewAdmissionsFromDoj && isNewAdmission && effectiveEarliestDate > DateTime.MinValue && effectiveEarliestDate.Year <= dto.Year)
            {
                // Dynamic Admission Cutoff Rule (Day 1 to CutoffDay = Same Month; Day > CutoffDay = Next Month)
                if (effectiveEarliestDate.Day > cutoffDay && rolloverPolicy == "NextMonthFull")
                {
                    var rollDate = new DateTime(effectiveEarliestDate.Year, effectiveEarliestDate.Month, 1).AddMonths(1);
                    studentStartMonth = rollDate.Month;
                    studentStartYear = rollDate.Year;
                }
                else
                {
                    studentStartMonth = effectiveEarliestDate.Month;
                    studentStartYear = effectiveEarliestDate.Year;
                }
            }
            else if (isNewAdmission && effectiveEarliestDate > DateTime.MinValue && effectiveEarliestDate.Year == dto.Year && effectiveEarliestDate.Month == dto.Month)
            {
                // Even if AutoBillNewAdmissionsFromDoj is unchecked, if target month is student's joining month and they joined after cutoffDay:
                // Their billing must NOT begin in this month; it rolls over to next month!
                if (effectiveEarliestDate.Day > cutoffDay && rolloverPolicy == "NextMonthFull")
                {
                    if (dto.StudentId.HasValue && dto.StudentId.Value == s.Id)
                    {
                        // Targeted single student invoice: automatically roll over to next month!
                        var rollDate = new DateTime(effectiveEarliestDate.Year, effectiveEarliestDate.Month, 1).AddMonths(1);
                        studentStartMonth = rollDate.Month;
                        studentStartYear = rollDate.Year;
                    }
                    else
                    {
                        var rollDate = new DateTime(effectiveEarliestDate.Year, effectiveEarliestDate.Month, 1).AddMonths(1);
                        string rollMonthName = rollDate.ToString("MMMM yyyy", System.Globalization.CultureInfo.InvariantCulture);
                        string targetMonthName = new DateTime(dto.Year, dto.Month, 1).ToString("MMMM yyyy", System.Globalization.CultureInfo.InvariantCulture);
                        skipReasonsEn.Add($"{s.StudentName} (Roll: {s.RollNumber ?? "N/A"}): Admitted on {effectiveEarliestDate:dd MMM yyyy} (after the {cutoffDay}th monthly cutoff). {targetMonthName} tuition is waived as orientation period; billing begins in {rollMonthName}. (Please select Month: {rollDate:MMMM} to generate).");
                        skipReasonsHi.Add($"{s.StudentName} (Roll: {s.RollNumber ?? "N/A"}): एडमिशन {effectiveEarliestDate:dd MMM yyyy} को हुआ ({cutoffDay} तारीख कट-ऑफ के बाद)। {targetMonthName} की फीस वेव (माफ़) है; बिलिंग {rollMonthName} से शुरू होगी। (कृपया इनवॉइस बनाने हेतु महीना: {rollDate:MMMM} चुनें)।");
                        skippedCount++;
                        continue;
                    }
                }
            }

            var studentPeriodStart = new DateTime(studentStartYear, studentStartMonth, 1);
            var studentPeriodEnd = studentPeriodStart.AddMonths(studentCycleMonths).AddDays(-1);

            string studentCycleLabel = studentCycle switch
            {
                BillingCycle.Quarterly   => "Quarterly",
                BillingCycle.HalfYearly  => "Half-Yearly",
                BillingCycle.Yearly      => "Yearly",
                _                        => "Monthly"
            };

            string studentPeriodLabel = studentCycleMonths == 1
                ? studentPeriodStart.ToString("MMMM yyyy", System.Globalization.CultureInfo.InvariantCulture)
                : $"{studentPeriodStart:MMMM yyyy} – {studentPeriodEnd:MMMM yyyy}";

            var studentCycleSuffix = studentCycle switch
            {
                BillingCycle.Quarterly  => "Q",
                BillingCycle.HalfYearly => "H",
                BillingCycle.Yearly     => "Y",
                _                       => ""
            };

            // Safeguard 1: Past-Month Invoicing Shield
            // If student took admission AFTER this billing window ends, they were not enrolled yet!
            // e.g. A student admitted on 10 October 2026 cannot be billed for April/May/June/July/August/September 2026.
            if (effectiveEarliestDate.Date > studentPeriodEnd.Date)
            {
                skipReasonsEn.Add($"{s.StudentName} (Roll: {s.RollNumber ?? "N/A"}): Admitted on {effectiveEarliestDate:dd MMM yyyy}, which is after {studentPeriodLabel}. Cannot bill prior to admission date.");
                skipReasonsHi.Add($"{s.StudentName} (Roll: {s.RollNumber ?? "N/A"}): एडमिशन {effectiveEarliestDate:dd MMM yyyy} को हुआ, जो {studentPeriodLabel} के बाद है। एडमिशन से पहले के महीने का बिल नहीं बन सकता।");
                skippedCount++;
                continue;
            }

            // Safeguard 2: Duplicate Invoicing Shield for this specific student's month / window
            bool alreadyBilled = candidateExistingInvoices.Any(e =>
                e.StudentId == s.Id &&
                (e.ClassId == null || s.ClassId == null || e.ClassId == s.ClassId) &&
                FeeInvoice.CheckCoversPeriod(e.InvoiceNumber, e.Title, e.DueDate, studentStartYear, studentStartMonth));
            if (alreadyBilled)
            {
                skipReasonsEn.Add($"{s.StudentName} (Roll: {s.RollNumber ?? "N/A"}): Active invoice for {defaultPeriodLabel} already exists.");
                skipReasonsHi.Add($"{s.StudentName} (Roll: {s.RollNumber ?? "N/A"}): {defaultPeriodLabel} का इनवॉइस पहले से बना हुआ है।");
                skippedCount++;
                continue;
            }

            var schoolStructures = new List<ClassFeeStructure>();
            var coachingStructures = new List<ClassFeeStructure>();

            if (s.IsSchoolStudent && s.ClassId.HasValue && effectiveSchoolDate.Date <= studentPeriodEnd.Date)
            {
                schoolStructures = feeStructures
                    .Where(cfs => cfs.ClassId.HasValue && cfs.ClassId == s.ClassId.Value &&
                                  (cfs.FeeHead == null || cfs.FeeHead.ApplicableTo == "School" || cfs.FeeHead.ApplicableTo == "Both"))
                    .ToList();
            }

            if (s.IsCoachingStudent && effectiveCoachingDate.Date <= studentPeriodEnd.Date)
            {
                coachingStructures = feeStructures
                    .Where(cfs =>
                        (s.BatchId.HasValue && cfs.BatchId == s.BatchId.Value) ||
                        (!s.IsSchoolStudent && s.ClassId.HasValue && cfs.ClassId == s.ClassId.Value && cfs.FeeHead != null && (cfs.FeeHead.ApplicableTo == "Coaching" || cfs.FeeHead.ApplicableTo == "Both"))
                    )
                    .Where(cfs => cfs.FeeHead == null || cfs.FeeHead.ApplicableTo == "Coaching" || cfs.FeeHead.ApplicableTo == "Both")
                    .GroupBy(cfs => cfs.FeeHeadId)
                    .Select(g => g.OrderByDescending(cfs => cfs.BatchId.HasValue ? 1 : 0).First())
                    .ToList();
            }

            var alreadyBilledHeadIds = billedHeadsLookup.GetValueOrDefault(s.Id) ?? new HashSet<Guid>();
            var schoolBilledOneTime = lifetimeSchoolOneTimeSet.GetValueOrDefault(s.Id) ?? new HashSet<Guid>();
            var coachingBilledOneTime = lifetimeCoachingOneTimeSet.GetValueOrDefault(s.Id) ?? new HashSet<Guid>();

            // School admission checks
            bool hasPriorSchoolInvoice = studentsWithPriorInvoiceSet.Contains(s.Id);
            bool isSchoolAdmissionMonth = (effectiveSchoolDate >= studentPeriodStart && effectiveSchoolDate <= studentPeriodEnd);
            bool isRolledOverSchoolMonth = (effectiveSchoolDate.Day > cutoffDay && rolloverPolicy == "NextMonthFull" &&
                effectiveSchoolDate.AddMonths(1) >= studentPeriodStart && effectiveSchoolDate.AddMonths(1) <= studentPeriodEnd && !hasPriorSchoolInvoice);
            bool isFirstSchoolInvoice = !hasPriorSchoolInvoice || isSchoolAdmissionMonth || isRolledOverSchoolMonth;

            var applicableSchoolHeads = new List<ClassFeeStructure>();
            foreach (var cfs in schoolStructures)
            {
                bool isOneTime = cfs.FeeHead != null && (cfs.FeeHead.Frequency == "OneTime" || cfs.FeeHead.Category == "OneTime");
                bool isAnnual = cfs.FeeHead != null && cfs.FeeHead.Frequency == "Annual";

                if (isOneTime)
                {
                    if (schoolBilledOneTime.Contains(cfs.FeeHeadId)) continue;
                    if (!isFirstSchoolInvoice) continue;
                }

                if (isAnnual && alreadyBilledHeadIds.Contains(cfs.FeeHeadId)) continue;

                bool isMonthly = cfs.FeeHead != null && cfs.FeeHead.Frequency == "Monthly";
                bool isTermWiseOrAdHoc = cfs.FeeHead != null && (cfs.FeeHead.Frequency == "TermWise" || cfs.FeeHead.Frequency == "AdHoc");

                if (isMonthly || cfs.ApplicableMonth == studentStartMonth)
                {
                    applicableSchoolHeads.Add(cfs);
                }
                else if (isOneTime || isAnnual)
                {
                    if (isFirstSchoolInvoice && !alreadyBilledHeadIds.Contains(cfs.FeeHeadId) && !schoolBilledOneTime.Contains(cfs.FeeHeadId))
                    {
                        applicableSchoolHeads.Add(cfs);
                    }
                }
                else if (isTermWiseOrAdHoc)
                {
                    if (cfs.ApplicableMonth == null && (isFirstSchoolInvoice || !alreadyBilledHeadIds.Contains(cfs.FeeHeadId)))
                    {
                        applicableSchoolHeads.Add(cfs);
                    }
                }
            }
            applicableSchoolHeads = applicableSchoolHeads.GroupBy(h => h.FeeHeadId).Select(g => g.First()).ToList();

            // Coaching registration checks
            bool hasPriorCoachingInvoice = studentsWithPriorCoachingInvoiceSet.Contains(s.Id);
            bool isCoachingAdmissionMonth = (effectiveCoachingDate >= studentPeriodStart && effectiveCoachingDate <= studentPeriodEnd);
            bool isRolledOverCoachingMonth = (effectiveCoachingDate.Day > cutoffDay && rolloverPolicy == "NextMonthFull" &&
                effectiveCoachingDate.AddMonths(1) >= studentPeriodStart && effectiveCoachingDate.AddMonths(1) <= studentPeriodEnd && !hasPriorCoachingInvoice);
            bool isFirstCoachingInvoice = !hasPriorCoachingInvoice || isCoachingAdmissionMonth || isRolledOverCoachingMonth;

            var applicableCoachingHeads = new List<ClassFeeStructure>();
            foreach (var cfs in coachingStructures)
            {
                bool isOneTime = cfs.FeeHead != null && (cfs.FeeHead.Frequency == "OneTime" || cfs.FeeHead.Category == "OneTime");
                bool isAnnual = cfs.FeeHead != null && cfs.FeeHead.Frequency == "Annual";

                if (isOneTime)
                {
                    if (coachingBilledOneTime.Contains(cfs.FeeHeadId)) continue;
                    if (!isFirstCoachingInvoice) continue;
                }

                if (isAnnual && alreadyBilledHeadIds.Contains(cfs.FeeHeadId)) continue;

                bool isCoachingMonthly = cfs.FeeHead != null && cfs.FeeHead.Frequency == "Monthly";
                bool isCoachingTermOrAdHoc = cfs.FeeHead != null && (cfs.FeeHead.Frequency == "TermWise" || cfs.FeeHead.Frequency == "AdHoc");

                if (isCoachingMonthly || cfs.ApplicableMonth == studentStartMonth)
                {
                    applicableCoachingHeads.Add(cfs);
                }
                else if (isOneTime || isAnnual)
                {
                    if (isFirstCoachingInvoice && !alreadyBilledHeadIds.Contains(cfs.FeeHeadId) && !coachingBilledOneTime.Contains(cfs.FeeHeadId))
                    {
                        applicableCoachingHeads.Add(cfs);
                    }
                }
                else if (isCoachingTermOrAdHoc)
                {
                    if (cfs.ApplicableMonth == null && (isFirstCoachingInvoice || !alreadyBilledHeadIds.Contains(cfs.FeeHeadId)))
                    {
                        applicableCoachingHeads.Add(cfs);
                    }
                }
            }
            applicableCoachingHeads = applicableCoachingHeads.GroupBy(h => h.FeeHeadId).Select(g => g.First()).ToList();

            var invoiceItems = new List<FeeInvoiceItem>();
            decimal totalAmount = 0;

            // Detect any shared fee heads between School and Coaching in this invoice to differentiate smoothly
            var sharedFeeHeadIds = applicableSchoolHeads.Select(h => h.FeeHeadId)
                .Intersect(applicableCoachingHeads.Select(h => h.FeeHeadId))
                .ToHashSet();

            if (applicableSchoolHeads.Count > 0 || applicableCoachingHeads.Count > 0)
            {
                // Add School items
                foreach (var head in applicableSchoolHeads)
                {
                    // Fail-Safe 1: Skip HOSTEL, MESS, and TRANS from class matrix because residential and
                    // transport charges are dynamically and exclusively computed from student's active
                    // HostelBed and TransportAllocation (prevents accidental double-charging or charging non-bus commuters).
                    if (head.FeeHead != null && (head.FeeHead.Code == "HOSTEL" || head.FeeHead.Code == "MESS" || head.FeeHead.Code == "TRANS"))
                    {
                        continue;
                    }

                    // Optional Library Safeguard: If student did not opt into library, never charge LIB from matrix
                    if (head.FeeHead != null && head.FeeHead.Code == "LIB" && !s.IsLibraryMember)
                    {
                        continue;
                    }

                    // Fail-Safe 2: Skip non-positive amounts (e.g. ₹0 fee heads) so no empty invoice items are generated
                    if (head.Amount <= 0)
                    {
                        continue;
                    }

                    bool isRecurring = head.FeeHead == null || head.FeeHead.Frequency == "Monthly" || head.FeeHead.Frequency == "Quarterly";
                    decimal headAmount = isRecurring ? (head.Amount * studentCycleMonths) : head.Amount;
                    totalAmount += headAmount;

                    string headName = sharedFeeHeadIds.Contains(head.FeeHeadId)
                        ? $"{head.FeeHead?.Name ?? "Fee Head"} ({s.Class?.Name ?? "School"})"
                        : (head.FeeHead?.Name ?? "Fee Head");

                    invoiceItems.Add(new FeeInvoiceItem
                    {
                        TenantId = _currentUser.TenantId,
                        FeeHeadId = head.FeeHeadId,
                        HeadName = headName,
                        Amount = headAmount,
                        PaidAmount = 0,
                        Description = $"School:{head.FeeHeadId}"
                    });
                }

                // Add Coaching items
                foreach (var head in applicableCoachingHeads)
                {
                    if (head.Amount <= 0)
                    {
                        continue;
                    }

                    bool isRecurring = head.FeeHead == null || head.FeeHead.Frequency == "Monthly" || head.FeeHead.Frequency == "Quarterly";
                    decimal headAmount = isRecurring ? (head.Amount * studentCycleMonths) : head.Amount;
                    totalAmount += headAmount;

                    string headName = sharedFeeHeadIds.Contains(head.FeeHeadId)
                        ? $"{head.FeeHead?.Name ?? "Fee Head"} ({s.Batch?.Name ?? "Coaching"})"
                        : (head.FeeHead?.Name ?? "Fee Head");

                    invoiceItems.Add(new FeeInvoiceItem
                    {
                        TenantId = _currentUser.TenantId,
                        FeeHeadId = head.FeeHeadId,
                        HeadName = headName,
                        Amount = headAmount,
                        PaidAmount = 0,
                        Description = $"Coaching:{head.FeeHeadId}"
                    });
                }
            }
            else
            {
                // Fallback: If no fee structure is configured in ClassFeeStructures
                if (s.IsSchoolStudent && s.IsCoachingStudent)
                {
                    // Dual-enrolled: School + Coaching
                    var schoolRate = 2500m * studentCycleMonths;
                    totalAmount += schoolRate;
                    invoiceItems.Add(new FeeInvoiceItem
                    {
                        TenantId = _currentUser.TenantId,
                        FeeHeadId = tuiFeeHead?.Id,
                        HeadName = tuiFeeHead?.Name ?? "School Tuition Fee",
                        Amount = schoolRate,
                        PaidAmount = 0,
                        Description = $"School:{tuiFeeHead?.Id}"
                    });

                    var coachingRate = (s.Batch?.StandardMonthlyFee ?? 1500m) * studentCycleMonths;
                    totalAmount += coachingRate;
                    invoiceItems.Add(new FeeInvoiceItem
                    {
                        TenantId = _currentUser.TenantId,
                        FeeHeadId = coachFeeHead?.Id,
                        HeadName = coachFeeHead?.Name ?? $"{s.Batch?.Name ?? "Coaching"} Tuition Fee",
                        Amount = coachingRate,
                        PaidAmount = 0,
                        Description = $"Coaching:{coachFeeHead?.Id}"
                    });
                }
                else if (s.IsCoachingStudent && !s.IsSchoolStudent)
                {
                    if (s.Batch?.StandardMonthlyFee > 0)
                    {
                        var fallbackHeadName = coachFeeHead?.Name ?? $"{s.Batch?.Name ?? "Coaching"} Tuition Fee";
                        var fallbackHeadId = coachFeeHead?.Id;
                        var monthlyRate = s.Batch.StandardMonthlyFee;
                        var coachingTotal = monthlyRate * studentCycleMonths;
                        totalAmount = coachingTotal;
                        invoiceItems.Add(new FeeInvoiceItem
                        {
                            TenantId = _currentUser.TenantId,
                            FeeHeadId = fallbackHeadId,
                            HeadName = fallbackHeadName,
                            Amount = coachingTotal,
                            PaidAmount = 0,
                            Description = $"Coaching:{fallbackHeadId}"
                        });
                    }
                    else
                    {
                        skipReasonsEn.Add($"{s.StudentName} (Roll: {s.RollNumber ?? "N/A"}): Standard monthly fee is ₹0 or not configured for coaching batch '{s.Batch?.Name ?? "General"}'. Please configure fees in Fee Matrix.");
                        skipReasonsHi.Add($"{s.StudentName} (Roll: {s.RollNumber ?? "N/A"}): कोचिंग बैच '{s.Batch?.Name ?? "General"}' की मासिक फीस सेट नहीं है। कृपया Fee Matrix में फीस सेट करें।");
                        skippedCount++;
                        continue;
                    }
                }
                else
                {
                    // Guard: Unconfigured school class fee structure — skip
                    skipReasonsEn.Add($"{s.StudentName} (Roll: {s.RollNumber ?? "N/A"}): No fee matrix structure configured for Class '{s.Class?.Name ?? "School"}'. Please configure fees in Fee Matrix.");
                    skipReasonsHi.Add($"{s.StudentName} (Roll: {s.RollNumber ?? "N/A"}): कक्षा '{s.Class?.Name ?? "School"}' का फीस स्ट्रक्चर Fee Matrix में सेट नहीं है। कृपया Fee Matrix में फीस सेट करें।");
                    skippedCount++;
                    continue;
                }
            }

            // Dual-enrollment safeguard: ensure Coaching Fee is present if student is enrolled in a Coaching Batch
            bool hasCoachingHead = invoiceItems.Any(i =>
                (i.Description != null && i.Description.StartsWith("Coaching:")) ||
                (coachFeeHead != null && i.FeeHeadId == coachFeeHead.Id));
            if (s.BatchId.HasValue && s.IsCoachingStudent && !hasCoachingHead && (s.Batch?.StandardMonthlyFee ?? 0) > 0 && effectiveCoachingDate.Date <= studentPeriodEnd.Date)
            {
                var coachingRate = (s.Batch?.StandardMonthlyFee ?? 0) * studentCycleMonths;
                if (coachingRate > 0)
                {
                    totalAmount += coachingRate;
                    invoiceItems.Add(new FeeInvoiceItem
                    {
                        TenantId = _currentUser.TenantId,
                        FeeHeadId = coachFeeHead?.Id,
                        HeadName = coachFeeHead?.Name ?? $"{s.Batch?.Name ?? "Coaching"} Tuition Fee",
                        Amount = coachingRate,
                        PaidAmount = 0,
                        Description = $"Coaching:{coachFeeHead?.Id}"
                    });
                }
            }

            // Dual-enrollment safeguard: ensure School Tuition Fee is present ONLY if student is explicitly enrolled in School
            bool hasSchoolHead = invoiceItems.Any(i =>
                (i.Description != null && i.Description.StartsWith("School:")) ||
                (tuiFeeHead != null && i.FeeHeadId == tuiFeeHead.Id));
            if (s.IsSchoolStudent && s.ClassId.HasValue && !hasSchoolHead && effectiveSchoolDate.Date <= studentPeriodEnd.Date)
            {
                var schoolFee = feeStructures.FirstOrDefault(cfs => cfs.ClassId == s.ClassId.Value && cfs.FeeHead != null && (cfs.FeeHead.Frequency == "Monthly" || cfs.ApplicableMonth == null) && (cfs.FeeHead.Code == "TUI" || cfs.FeeHead.ApplicableTo == "School"))?.Amount ?? 0m;
                if (schoolFee > 0)
                {
                    var schoolRate = schoolFee * studentCycleMonths;
                    totalAmount += schoolRate;
                    invoiceItems.Add(new FeeInvoiceItem
                    {
                        TenantId = _currentUser.TenantId,
                        FeeHeadId = tuiFeeHead?.Id,
                        HeadName = tuiFeeHead?.Name ?? "School Tuition Fee",
                        Amount = schoolRate,
                        PaidAmount = 0,
                        Description = $"School:{tuiFeeHead?.Id}"
                    });
                }
            }

            // ── Inject Hostel Charges (if this student has an active bed allocation) ──
            if (allocationByStudent.TryGetValue(s.Id, out var allocation))
            {
                var bedLabel  = allocation.Bed?.BedCode ?? "Bed";
                var roomLabel = allocation.Bed?.Room?.RoomNumber ?? "Room";
                var hostelLabel = allocation.Bed?.Room?.Hostel?.Name ?? "Hostel";

                if (allocation.MonthlyRent > 0)
                {
                    decimal rentAmount = allocation.MonthlyRent * studentCycleMonths;
                    totalAmount += rentAmount;
                    invoiceItems.Add(new FeeInvoiceItem
                    {
                        TenantId  = _currentUser.TenantId,
                        FeeHeadId = hostelFeeHeadId,
                        HeadName  = $"Hostel / Accommodation Fee (Rm {roomLabel} - Bed {bedLabel})",
                        Amount    = rentAmount,
                        PaidAmount = 0
                    });
                }

                if (allocation.IsMessIncluded && allocation.MonthlyMessFee > 0)
                {
                    decimal messAmount = allocation.MonthlyMessFee * studentCycleMonths;
                    totalAmount += messAmount;
                    invoiceItems.Add(new FeeInvoiceItem
                    {
                        TenantId  = _currentUser.TenantId,
                        FeeHeadId = messFeeHeadId,
                        HeadName  = $"Mess & Dining Fee ({allocation.MessPlan})",
                        Amount    = messAmount,
                        PaidAmount = 0
                    });
                }
            }
            // ─────────────────────────────────────────────────────────────────────

            // ── Inject Optional Library / Reading Room Fee (if opted-in by this student) ──
            if (s.IsLibraryMember && s.MonthlyLibraryFee > 0)
            {
                decimal libAmount = s.MonthlyLibraryFee * studentCycleMonths;
                totalAmount += libAmount;
                invoiceItems.Add(new FeeInvoiceItem
                {
                    TenantId   = _currentUser.TenantId,
                    FeeHeadId  = libFeeHeadId,
                    HeadName   = $"Library & Reading Room ({s.LibraryMembershipType ?? "Membership"})",
                    Amount     = libAmount,
                    PaidAmount = 0
                });
            }

            // ── Inject Transport Fee (if student has active transport allocation) ──
            if (s.IsTransportStudent && transportByStudent.TryGetValue(s.Id, out var transportAlloc) && transportAlloc.MonthlyFare > 0 && !transportAlloc.IsFreeAllocation)
            {
                decimal transAmount = transportAlloc.MonthlyFare * studentCycleMonths;
                totalAmount += transAmount;
                invoiceItems.Add(new FeeInvoiceItem
                {
                    TenantId   = _currentUser.TenantId,
                    FeeHeadId  = transFeeHeadId,
                    HeadName   = $"Transport Fee ({transportAlloc.Stop?.StopName ?? "Bus"})",
                    Amount     = transAmount,
                    PaidAmount = 0
                });
            }

            // ── Inject Dynamic Attendance Absence Fine (UI Configurable: PerBlock or Flat) ──
            if (fineEnabled && fineUnitAmount > 0 && fineThreshold > 0 && studentAbsences.TryGetValue(s.Id, out int absentDays) && absentDays >= fineThreshold)
            {
                decimal calculatedFine = 0;

                if (string.Equals(fineMode, "Flat", StringComparison.OrdinalIgnoreCase))
                {
                    // Option 1: Flat Fine once threshold met (e.g. 3+ days = flat ₹10)
                    calculatedFine = fineUnitAmount;
                }
                else
                {
                    // Option 2: Dynamic Multiplied Slab (e.g. every 3 days absent = ₹10, 6 days = ₹20, 9 days = ₹30)
                    int blocks = absentDays / fineThreshold;
                    calculatedFine = blocks * fineUnitAmount;
                }

                string headName = attnFineFeeHead?.Name ?? "Attendance Absence Fine";
                string fineDescription = $"Attendance Absence Penalty (Absent: {absentDays} days)";

                if (calculatedFine > 0)
                {
                    totalAmount += calculatedFine;
                    invoiceItems.Add(new FeeInvoiceItem
                    {
                        TenantId = _currentUser.TenantId,
                        FeeHeadId = attnFineFeeHead?.Id,
                        HeadName = headName,
                        Description = fineDescription,
                        Amount = calculatedFine,
                        PaidAmount = 0
                    });
                }
            }

            // ── Inject Admission Kit Items (Physical Kit items issued from store with 'Added to Fee Bill') ──
            if (pendingKitsByStudent.TryGetValue(s.Id, out var kitOutwardsForStudent))
            {
                foreach (var outward in kitOutwardsForStudent)
                {
                    foreach (var oi in outward.Items)
                    {
                        var kitItemName = oi.Item?.ItemName ?? "Admission Kit Item";
                        var lineAmount = oi.TotalAmount;
                        if (lineAmount > 0)
                        {
                            totalAmount += lineAmount;
                            invoiceItems.Add(new FeeInvoiceItem
                            {
                                TenantId = _currentUser.TenantId,
                                HeadName = $"Kit: {kitItemName}",
                                Amount = lineAmount,
                                PaidAmount = 0,
                                Description = "InventoryKit"
                            });
                        }
                    }

                    // Mark outward as billed in fee invoice
                    outward.PaymentStatus = "BilledInFeeInvoice";
                    outward.Remarks = string.IsNullOrEmpty(outward.Remarks)
                        ? "Billed in Student Fee Invoice"
                        : $"{outward.Remarks} | Billed in Student Fee Invoice";
                }
            }

            // ── Automated Concession & Sibling Discount Engine ──
            decimal totalConcessionAmount = 0;
            var concessionReasons = new List<string>();
            bool siblingConcessionApplied = false;

            // Dynamic academic base: recurring academic heads configured in this student's own
            // School Class / Coaching Batch fee matrix + system-resolved TUI / COACH heads.
            // Residential, transport, library, fines and kit lines are never discounted here.
            var excludedHeadIds = new HashSet<Guid>(new[] { hostelFeeHeadId, messFeeHeadId, transFeeHeadId, libFeeHeadId, attnFineFeeHead?.Id }
                .Where(x => x.HasValue).Select(x => x!.Value));
            var academicHeadIds = schoolStructures.Concat(coachingStructures)
                .Where(cfs => cfs.FeeHead == null || cfs.FeeHead.Frequency == "Monthly" || cfs.FeeHead.Frequency == "Quarterly")
                .Select(cfs => cfs.FeeHeadId)
                .Where(id => !excludedHeadIds.Contains(id))
                .ToHashSet();
            if (coachFeeHead != null) academicHeadIds.Add(coachFeeHead.Id);
            if (tuiFeeHead != null) academicHeadIds.Add(tuiFeeHead.Id);

            decimal GetAcademicBaseAmount()
            {
                var academicItems = invoiceItems.Where(it => it.Amount > 0 && it.FeeHeadId.HasValue && academicHeadIds.Contains(it.FeeHeadId.Value)).ToList();
                if (academicItems.Any()) return academicItems.Sum(it => it.Amount);
                // Legacy fallback for items generated without a linked fee head
                var legacyItems = invoiceItems.Where(it => it.Amount > 0 && !it.FeeHeadId.HasValue &&
                    it.Description != "InventoryKit").ToList();
                return legacyItems.Any() ? legacyItems.Sum(it => it.Amount) : 0m;
            }

            // 1. Explicit Student Concessions (Merit, Staff Ward, RTE, etc.)
            if (concessionsByStudent.TryGetValue(s.Id, out var studentConcessions))
            {
                foreach (var conc in studentConcessions)
                {
                    decimal discount = 0;
                    if (conc.DiscountMode == "Percentage")
                    {
                        if (conc.FeeHeadId.HasValue)
                        {
                            var targetItems = invoiceItems.Where(it => it.FeeHeadId == conc.FeeHeadId.Value);
                            var baseAmt = targetItems.Sum(it => it.Amount);
                            discount = Math.Round(baseAmt * (conc.DiscountValue / 100m), 2);
                        }
                        else
                        {
                            var baseAmt = GetAcademicBaseAmount();
                            discount = Math.Round(baseAmt * (conc.DiscountValue / 100m), 2);
                        }
                    }
                    else
                    {
                        discount = Math.Min(conc.DiscountValue, totalAmount);
                    }

                    if (discount > 0)
                    {
                        if (string.Equals(conc.ConcessionType, "SiblingDiscount", StringComparison.OrdinalIgnoreCase))
                            siblingConcessionApplied = true;
                        totalConcessionAmount += discount;
                        var label = $"{conc.Title} ({(conc.DiscountMode == "Percentage" ? $"{conc.DiscountValue}%" : $"₹{conc.DiscountValue}")})";
                        concessionReasons.Add(label);

                        invoiceItems.Add(new FeeInvoiceItem
                        {
                            TenantId = _currentUser.TenantId,
                            FeeHeadId = conc.FeeHeadId,
                            HeadName = $"🎁 Concession: {label}",
                            Amount = -discount,
                            PaidAmount = 0
                        });
                    }
                }
            }

            // 2. Automatic Sibling Discount (if not already granted via explicit concession)
            if (siblingLinksByStudent.TryGetValue(s.Id, out var sibLinks) && !siblingConcessionApplied)
            {
                var bestSibLink = sibLinks.OrderByDescending(x => x.DiscountPercent).First();
                if (bestSibLink.DiscountPercent > 0)
                {
                    var baseAmt = GetAcademicBaseAmount();
                    var sibDiscount = Math.Round(baseAmt * (bestSibLink.DiscountPercent / 100m), 2);

                    if (sibDiscount > 0)
                    {
                        totalConcessionAmount += sibDiscount;
                        var label = $"Sibling Discount ({bestSibLink.DiscountPercent}% - {bestSibLink.Relationship})";
                        concessionReasons.Add(label);

                        invoiceItems.Add(new FeeInvoiceItem
                        {
                            TenantId = _currentUser.TenantId,
                            FeeHeadId = null,
                            HeadName = $"🎁 Sibling Concession: {bestSibLink.DiscountPercent}% Off",
                            Amount = -sibDiscount,
                            PaidAmount = 0
                        });
                    }
                }
            }

            var netTotalAmount = Math.Max(0, totalAmount - totalConcessionAmount);

            var invoice = new FeeInvoice
            {
                TenantId      = _currentUser.TenantId,
                BranchId      = s.BranchId ?? s.Batch?.BranchId ?? _currentUser.BranchId,
                StudentId     = s.Id,
                ClassId       = s.ClassId,
                ClassName     = s.Class?.Name,
                SectionId     = s.SectionId,
                SectionName   = s.Section?.Name,
                InvoiceNumber = $"INV-{studentStartYear}{studentStartMonth:D2}{studentCycleSuffix}-{random.Next(100, 999)}",
                Title         = $"{studentPeriodLabel} Fee ({studentCycleLabel})",
                InvoiceCategory = (s.IsSchoolStudent && s.IsCoachingStudent) ? "Integrated" :
                                  (s.IsSchoolStudent) ? "School" :
                                  (s.IsCoachingStudent || s.BatchId.HasValue) ? "Coaching" : "General",
                TotalAmount   = netTotalAmount,
                ConcessionAmount = totalConcessionAmount,
                ConcessionReason = concessionReasons.Any() ? string.Join("; ", concessionReasons) : null,
                PaidAmount    = 0,
                DueDate       = (studentStartYear == dto.Year && studentStartMonth == dto.Month)
                    ? dto.DueDate
                    : new DateTime(studentStartYear, studentStartMonth, Math.Min(10, DateTime.DaysInMonth(studentStartYear, studentStartMonth))),
                Status        = InvoiceStatus.Pending,
                CreatedAt     = DateTime.UtcNow,
                Items         = invoiceItems
            };

            newInvoices.Add(invoice);
        }

        if (newInvoices.Count > 0)
        {
            _dbContext.FeeInvoices.AddRange(newInvoices);
            await _dbContext.SaveChangesAsync();
        }

        string defaultCycleLabel = dto.BillingCycle switch
        {
            BillingCycle.Quarterly   => "Quarterly",
            BillingCycle.HalfYearly  => "Half-Yearly",
            BillingCycle.Yearly      => "Yearly",
            _                        => "Monthly"
        };

        string msg;
        string? msgHi = null;
        string invoiceWord = newInvoices.Count == 1 ? "invoice" : "invoices";
        string invoiceWordHi = "इनवॉइस";

        var totalConcessionsApplied = newInvoices.Sum(i => i.ConcessionAmount);
        var concessionSuffix = totalConcessionsApplied > 0
            ? $" (₹{totalConcessionsApplied:N2} in automatic sibling discounts & fee concessions applied!)"
            : "";
        var concessionSuffixHi = totalConcessionsApplied > 0
            ? $" (₹{totalConcessionsApplied:N2} ऑटोमैटिक छूट/कंसेशन लागू किया गया!)"
            : "";

        if (newInvoices.Count == 1 && dto.StudentId.HasValue)
        {
            var inv = newInvoices[0];
            var st = students.FirstOrDefault(x => x.Id == inv.StudentId);
            string studentName = st?.StudentName ?? "Student";

            // Extract period from invoice Title e.g. "November 2026 Fee (Monthly)" -> "November 2026"
            string invPeriod = inv.Title.Contains(" Fee")
                ? inv.Title.Substring(0, inv.Title.IndexOf(" Fee"))
                : defaultPeriodLabel;

            bool wasRolledOver = !invPeriod.Contains(defaultPeriodLabel, StringComparison.OrdinalIgnoreCase);
            string rolloverNote = wasRolledOver
                ? $" (billed from {invPeriod} as per admission cutoff policy)"
                : "";
            string rolloverNoteHi = wasRolledOver
                ? $" (एडमिशन कट-ऑफ नीति अनुसार {invPeriod} से बिलिंग)"
                : "";

            msg = $"Successfully generated {defaultCycleLabel} invoice for {studentName} for {invPeriod}{rolloverNote}.{concessionSuffix}";
            msgHi = $"{studentName} के लिए {invPeriod} का {defaultCycleLabel} इनवॉइस सफलतापूर्वक बनाया गया{rolloverNoteHi}।{concessionSuffixHi}";
        }
        else if (newInvoices.Count > 0 && skippedCount == 0)
        {
            msg = $"Successfully generated {newInvoices.Count} {defaultCycleLabel} {invoiceWord} for {defaultPeriodLabel}.{concessionSuffix}";
            msgHi = $"{defaultPeriodLabel} के लिए {newInvoices.Count} {defaultCycleLabel} {invoiceWordHi} सफलतापूर्वक बनाए गए।{concessionSuffixHi}";
        }
        else if (newInvoices.Count > 0 && skippedCount > 0)
        {
            msg = $"Successfully generated {newInvoices.Count} {defaultCycleLabel} {invoiceWord} for {defaultPeriodLabel}. ({skippedCount} already existed or outside enrollment window and were skipped).{concessionSuffix}";
            msgHi = $"{defaultPeriodLabel} के लिए {newInvoices.Count} {defaultCycleLabel} {invoiceWordHi} सफलतापूर्वक बनाए गए। ({skippedCount} छात्र पहले से बने होने या कट-ऑफ के कारण स्किप हुए)।{concessionSuffixHi}";
        }
        else if (newInvoices.Count == 0 && skippedCount > 0)
        {
            var summaryListEn = skipReasonsEn.Take(4).ToList();
            var summaryListHi = skipReasonsHi.Take(4).ToList();
            if (skipReasonsEn.Count > 4)
            {
                summaryListEn.Add($"...and {skipReasonsEn.Count - 4} more student(s)");
                summaryListHi.Add($"...और {skipReasonsHi.Count - 4} अन्य छात्र");
            }
            string reasonDetailsEn = summaryListEn.Any()
                ? "\n\nReason Details:\n• " + string.Join("\n• ", summaryListEn)
                : "";
            string reasonDetailsHi = summaryListHi.Any()
                ? "\n\nकारण विवरण:\n• " + string.Join("\n• ", summaryListHi)
                : "";
            msg = $"0 invoices generated ({skippedCount} student(s) skipped for {defaultPeriodLabel}):{reasonDetailsEn}";
            msgHi = $"कोई इनवॉइस जनरेट नहीं हुआ ({defaultPeriodLabel} के लिए {skippedCount} छात्र स्किप हुए):{reasonDetailsHi}";
        }
        else
        {
            msg = $"No eligible students found matching the selected scope for {defaultPeriodLabel}.";
            msgHi = $"{defaultPeriodLabel} के लिए चयनित स्कोप में कोई पात्र छात्र नहीं मिला।";
        }

        return Ok(new GenerateMonthlyInvoicesResultDto(
            newInvoices.Count,
            skippedCount,
            msg,
            msgHi
        ));
    }

    [HttpPost("cancel-invoice/{invoiceId}")]
    public async Task<ActionResult> CancelInvoice(Guid invoiceId, [FromBody] CancelInvoiceDto dto)
    {
        var invoice = await _dbContext.FeeInvoices
            .Include(i => i.Student)
            .Include(i => i.Items)
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.Id == invoiceId);

        if (invoice == null) return NotFound("Invoice not found.");

        if (invoice.Status == InvoiceStatus.Cancelled)
            return BadRequest(new { message = "This invoice is already cancelled." });

        bool isStudentLeft = !string.IsNullOrWhiteSpace(dto.Reason) &&
            (dto.Reason.Contains("Student Left", StringComparison.OrdinalIgnoreCase) ||
             dto.Reason.Contains("Discontinued", StringComparison.OrdinalIgnoreCase) ||
             dto.Reason.Contains("Course Discontinuation", StringComparison.OrdinalIgnoreCase));

        // CASE 1: No payment received yet -> Standard void/cancellation
        if (invoice.PaidAmount <= 0)
        {
            invoice.Status = InvoiceStatus.Cancelled;
            invoice.CancellationReason = string.IsNullOrWhiteSpace(dto.Reason) ? "No reason provided" : dto.Reason.Trim();
            invoice.CancelledAt = DateTime.UtcNow;

            if (isStudentLeft && invoice.Student != null)
            {
                invoice.Student.IsActive = false;
                invoice.Student.LeavingDate = DateTime.UtcNow;
                invoice.Student.LeavingReason = invoice.CancellationReason;
            }

            await _dbContext.SaveChangesAsync();

            return Ok(new
            {
                message = $"Invoice {invoice.InvoiceNumber} has been cancelled successfully.",
                action = "VoidOnly",
                invoiceId = invoice.Id,
                reason = invoice.CancellationReason,
                cancelledAt = invoice.CancelledAt
            });
        }

        // CASE 2: Partial or Full payment recorded -> Must choose between RefundAndCancel vs WaiveAndClose
        if (string.IsNullOrWhiteSpace(dto.PartialAction))
        {
            return BadRequest(new { message = "This invoice has payments recorded. Please specify an action: 'RefundAndCancel' (reverses payments and voids invoice) or 'WaiveAndClose' (retains collected fee and waives remaining balance)." });
        }

        if (dto.PartialAction.Equals("RefundAndCancel", StringComparison.OrdinalIgnoreCase))
        {
            var payments = await _dbContext.FeePayments
                .Where(p => p.InvoiceId == invoice.Id)
                .ToListAsync();

            decimal refundedTotal = invoice.PaidAmount;
            int receiptCount = payments.Count;

            var receiptNumbers = payments.Select(p => p.ReceiptNumber).Where(r => !string.IsNullOrEmpty(r)).ToList();
            if (receiptNumbers.Any())
            {
                var associatedCircs = await _dbContext.LibraryCirculations
                    .Where(c => c.FinePaymentReceiptNumber != null && receiptNumbers.Contains(c.FinePaymentReceiptNumber))
                    .ToListAsync();

                foreach (var circ in associatedCircs)
                {
                    circ.FineStatus = "Pending";
                    circ.FinePaymentReceiptNumber = null;
                    circ.FinePaidAt = null;
                }
            }

            // Soft-reverse fee payment records so audit trail is preserved in Reversed & Refunded History
            string cleanReason = string.IsNullOrWhiteSpace(dto.Reason) ? "Administrative Cancellation" : dto.Reason.Trim();
            foreach (var p in payments)
            {
                p.IsReversed = true;
                p.ReversedAt = DateTime.UtcNow;
                p.ReversedBy = User?.Identity?.Name ?? _currentUser.Username ?? "Admin";
                p.ReversalType = "RefundToParent";
                p.ReversalReason = $"Invoice {invoice.InvoiceNumber} cancelled & refunded: {cleanReason}";
                p.RefundMode = p.Mode == PaymentMode.Cash ? "Cash" : (p.Mode == PaymentMode.UPI ? "UPI" : "Bank Transfer");
                p.RefundRecipient = invoice.Student != null ? $"{invoice.Student.ParentName ?? invoice.Student.StudentName} (Parent)" : "Parent";
            }

            // Reset invoice items paid amounts
            if (invoice.Items != null)
            {
                foreach (var it in invoice.Items)
                {
                    it.PaidAmount = 0m;
                }
            }

            invoice.PaidAmount = 0m;
            invoice.Status = InvoiceStatus.Cancelled;
            invoice.CancelledAt = DateTime.UtcNow;
            invoice.CancellationReason = $"[REFUNDED & VOIDED] {cleanReason} (Reversed ₹{refundedTotal:N2} across {receiptCount} receipt(s))";

            if (isStudentLeft && invoice.Student != null)
            {
                invoice.Student.IsActive = false;
                invoice.Student.LeavingDate = DateTime.UtcNow;
                invoice.Student.LeavingReason = invoice.CancellationReason;
            }

            await _dbContext.SaveChangesAsync();

            return Ok(new
            {
                message = $"Invoice {invoice.InvoiceNumber} cancelled. ₹{refundedTotal:N2} payment(s) reversed and removed from Day Book.",
                action = "RefundAndCancel",
                invoiceId = invoice.Id,
                refundedAmount = refundedTotal,
                reason = invoice.CancellationReason,
                cancelledAt = invoice.CancelledAt
            });
        }
        else if (dto.PartialAction.Equals("WaiveAndClose", StringComparison.OrdinalIgnoreCase))
        {
            decimal originalTotal = invoice.TotalAmount;
            decimal retainedPaid = invoice.PaidAmount;
            decimal waivedBalance = Math.Max(0m, originalTotal - retainedPaid);

            // Adjust invoice items: each item amount becomes equal to what was paid for it
            if (invoice.Items != null && invoice.Items.Any())
            {
                foreach (var it in invoice.Items)
                {
                    it.Amount = it.PaidAmount;
                }
            }

            invoice.TotalAmount = retainedPaid;
            invoice.Status = InvoiceStatus.Paid; // Fully settled
            invoice.CancelledAt = DateTime.UtcNow;
            string cleanReason = string.IsNullOrWhiteSpace(dto.Reason) ? "Management Concession / Discontinuation" : dto.Reason.Trim();
            invoice.CancellationReason = $"[BALANCE WAIVED & SETTLED] Retained ₹{retainedPaid:N2} collected. Waived pending balance ₹{waivedBalance:N2}. Reason: {cleanReason}";

            if (isStudentLeft && invoice.Student != null)
            {
                invoice.Student.IsActive = false;
                invoice.Student.LeavingDate = DateTime.UtcNow;
                invoice.Student.LeavingReason = invoice.CancellationReason;
            }

            await _dbContext.SaveChangesAsync();

            return Ok(new
            {
                message = $"Invoice {invoice.InvoiceNumber} settled successfully. Retained ₹{retainedPaid:N2} collected; waived remaining balance of ₹{waivedBalance:N2}.",
                action = "WaiveAndClose",
                invoiceId = invoice.Id,
                retainedAmount = retainedPaid,
                waivedAmount = waivedBalance,
                reason = invoice.CancellationReason,
                cancelledAt = invoice.CancelledAt
            });
        }
        else
        {
            return BadRequest(new { message = $"Unrecognized partial action '{dto.PartialAction}'. Supported actions are 'RefundAndCancel' and 'WaiveAndClose'." });
        }
    }

    [HttpPost("invoices/{invoiceId}/items")]
    public async Task<ActionResult> AddInvoiceItem(Guid invoiceId, [FromBody] AddFeeInvoiceItemDto dto)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.HeadName) || dto.Amount <= 0)
        {
            return BadRequest(new { message = "Valid fee head name and amount greater than 0 are required." });
        }

        var invoice = await _dbContext.FeeInvoices
            .IgnoreQueryFilters()
            .Include(i => i.Items)
            .FirstOrDefaultAsync(i => i.Id == invoiceId && i.TenantId == _currentUser.TenantId);

        if (invoice == null) return NotFound("Invoice not found.");

        if (invoice.Status == InvoiceStatus.Cancelled)
            return BadRequest(new { message = "Cannot modify a cancelled invoice." });

        var newItem = new FeeInvoiceItem
        {
            TenantId = _currentUser.TenantId,
            InvoiceId = invoice.Id,
            FeeHeadId = dto.FeeHeadId,
            HeadName = dto.HeadName.Trim(),
            Amount = dto.Amount,
            PaidAmount = 0
        };

        invoice.Items.Add(newItem);
        invoice.TotalAmount = invoice.Items.Sum(x => x.Amount);

        if (invoice.PaidAmount >= invoice.TotalAmount && invoice.TotalAmount > 0)
            invoice.Status = InvoiceStatus.Paid;
        else if (invoice.PaidAmount > 0)
            invoice.Status = InvoiceStatus.Partial;
        else
            invoice.Status = InvoiceStatus.Pending;

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = $"Successfully added {newItem.HeadName} (₹{newItem.Amount:F2}) to invoice {invoice.InvoiceNumber}.",
            itemId = newItem.Id,
            invoiceTotal = invoice.TotalAmount,
            dueAmount = invoice.DueAmount
        });
    }

    [HttpDelete("invoices/{invoiceId}/items/{itemId}")]
    public async Task<ActionResult> DeleteInvoiceItem(Guid invoiceId, Guid itemId)
    {
        var invoice = await _dbContext.FeeInvoices
            .IgnoreQueryFilters()
            .Include(i => i.Items)
            .FirstOrDefaultAsync(i => i.Id == invoiceId && i.TenantId == _currentUser.TenantId);

        if (invoice == null) return NotFound("Invoice not found.");

        if (invoice.Status == InvoiceStatus.Cancelled)
            return BadRequest(new { message = "Cannot modify a cancelled invoice." });

        var item = invoice.Items.FirstOrDefault(it => it.Id == itemId);
        if (item == null) return NotFound("Invoice item not found.");

        if (item.PaidAmount > 0)
            return BadRequest(new { message = "Cannot delete a fee item that has already received payments." });

        invoice.Items.Remove(item);
        _dbContext.FeeInvoiceItems.Remove(item);
        invoice.TotalAmount = invoice.Items.Sum(x => x.Amount);

        if (invoice.PaidAmount >= invoice.TotalAmount && invoice.TotalAmount > 0)
            invoice.Status = InvoiceStatus.Paid;
        else if (invoice.PaidAmount > 0)
            invoice.Status = InvoiceStatus.Partial;
        else
            invoice.Status = InvoiceStatus.Pending;

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = $"Item {item.HeadName} removed successfully.",
            invoiceTotal = invoice.TotalAmount,
            dueAmount = invoice.DueAmount
        });
    }

    [HttpPut("invoices/{invoiceId}/items")]
    public async Task<ActionResult> UpdateInvoiceItems(Guid invoiceId, [FromBody] UpdateInvoiceHeadsRequestDto dto)
    {
        if (dto == null || dto.Items == null || dto.Items.Count == 0)
            return BadRequest(new { message = "At least one fee head is required." });

        var invoice = await _dbContext.FeeInvoices
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(i => i.Id == invoiceId && i.TenantId == _currentUser.TenantId);

        if (invoice == null) return NotFound("Invoice not found.");

        if (invoice.Status == InvoiceStatus.Cancelled)
            return BadRequest(new { message = "Cannot modify a cancelled invoice." });

        if (invoice.PaidAmount > 0)
            return BadRequest(new { message = "Invoice has recorded payments. Please use the Add Item or Reverse Payment feature instead." });

        // Remove existing items cleanly
        var existingItems = await _dbContext.FeeInvoiceItems
            .IgnoreQueryFilters()
            .Where(it => it.InvoiceId == invoiceId)
            .ToListAsync();

        _dbContext.FeeInvoiceItems.RemoveRange(existingItems);
        await _dbContext.SaveChangesAsync();

        // Add new items
        var newItems = new List<FeeInvoiceItem>();
        foreach (var itemDto in dto.Items)
        {
            if (itemDto.Amount > 0 && !string.IsNullOrWhiteSpace(itemDto.HeadName))
            {
                newItems.Add(new FeeInvoiceItem
                {
                    TenantId = _currentUser.TenantId,
                    InvoiceId = invoice.Id,
                    FeeHeadId = itemDto.FeeHeadId,
                    HeadName = itemDto.HeadName.Trim(),
                    Amount = itemDto.Amount,
                    PaidAmount = 0
                });
            }
        }

        if (newItems.Count > 0)
        {
            await _dbContext.FeeInvoiceItems.AddRangeAsync(newItems);
        }

        invoice.TotalAmount = newItems.Sum(x => x.Amount);
        invoice.Status = InvoiceStatus.Pending;

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = $"Invoice {invoice.InvoiceNumber} items updated successfully.",
            invoiceTotal = invoice.TotalAmount,
            dueAmount = invoice.DueAmount
        });
    }

    [HttpDelete("payment/{paymentId}")]
    public async Task<ActionResult<ReversePaymentResponseDto>> ReversePayment(Guid paymentId, [FromBody] ReversePaymentDto? dto = null)
    {
        // Load payment with its invoice and items
        var payment = await _dbContext.FeePayments
            .Include(p => p.Invoice)
                .ThenInclude(i => i!.Items)
            .FirstOrDefaultAsync(p => p.Id == paymentId);

        if (payment == null)
            return NotFound(new { message = "Payment record not found." });

        if (payment.IsReversed)
            return BadRequest(new { message = "This payment receipt has already been reversed." });

        var invoice = payment.Invoice;
        if (invoice == null)
            return NotFound(new { message = "Associated invoice not found." });

        if (invoice.Status == InvoiceStatus.Cancelled)
            return BadRequest(new { message = "Cannot reverse a payment on a cancelled invoice." });

        // Deduct this payment's amount from invoice
        invoice.PaidAmount -= payment.AmountPaid;

        // Guard against negative (shouldn't happen, but safety net)
        if (invoice.PaidAmount < 0) invoice.PaidAmount = 0;

        // Also revert PaidAmount on invoice items
        if (invoice.Items != null && invoice.Items.Count > 0)
        {
            decimal remainingReverse = payment.AmountPaid;
            foreach (var it in invoice.Items.OrderByDescending(x => x.PaidAmount))
            {
                if (remainingReverse <= 0) break;
                decimal itReverse = Math.Min(remainingReverse, it.PaidAmount);
                it.PaidAmount -= itReverse;
                remainingReverse -= itReverse;
            }
        }

        // Recalculate invoice status
        if (invoice.PaidAmount <= 0)
            invoice.Status = InvoiceStatus.Pending;
        else if (invoice.PaidAmount >= invoice.TotalAmount)
            invoice.Status = InvoiceStatus.Paid;
        else
            invoice.Status = InvoiceStatus.Partial;

        // Soft reversal with complete audit trail
        payment.IsReversed = true;
        payment.ReversedAt = DateTime.UtcNow;
        payment.ReversedBy = User?.Identity?.Name ?? _currentUser.Username ?? "Admin";
        payment.ReversalReason = dto?.Reason ?? "Payment reversed by admin";
        payment.ReversalType = dto?.ReversalType ?? "ClericalCorrection";
        payment.RefundMode = dto?.RefundMode ?? (payment.Mode == PaymentMode.Cash ? "Cash" : "Bank Transfer");
        payment.RefundRecipient = dto?.RefundRecipient;
        payment.RefundReference = dto?.RefundReference;

        // Also revert any associated library circulations paid in this receipt
        var associatedCircs = await _dbContext.LibraryCirculations
            .Where(c => c.FinePaymentReceiptNumber == payment.ReceiptNumber)
            .ToListAsync();

        foreach (var circ in associatedCircs)
        {
            circ.FineStatus = "Pending";
            circ.FinePaymentReceiptNumber = null;
            circ.FinePaidAt = null;
        }

        await _dbContext.SaveChangesAsync();

        string actionDesc = payment.ReversalType == "RefundToParent"
            ? $"₹{payment.AmountPaid:N2} marked as refunded to {payment.RefundRecipient ?? "parent"} via {payment.RefundMode}."
            : "Clerical entry corrected/voided without refund.";

        return Ok(new ReversePaymentResponseDto(
            $"Payment {payment.ReceiptNumber} reversed successfully. {actionDesc} Invoice {invoice.InvoiceNumber} balance restored to due.",
            invoice.InvoiceNumber,
            invoice.PaidAmount,
            invoice.TotalAmount - invoice.PaidAmount,
            invoice.Status.ToString()
        ));
    }

    // ─── Fee Heads Master Endpoints ──────────────────────────────────────────

    [HttpGet("heads/paged")]
    public async Task<ActionResult<PagedResultDto<FeeHeadDto>>> GetFeeHeadsPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? category = null,
        [FromQuery] string? frequency = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] string? sortBy = "sortOrder",
        [FromQuery] bool sortDescending = false)
    {
        var query = _dbContext.FeeHeads.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(h => h.Name.ToLower().Contains(term) ||
                                     h.Code.ToLower().Contains(term) ||
                                     (h.Description != null && h.Description.ToLower().Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(category) && category != "All")
        {
            query = query.Where(h => h.Category.ToLower() == category.Trim().ToLower());
        }

        if (!string.IsNullOrWhiteSpace(frequency) && frequency != "All")
        {
            query = query.Where(h => h.Frequency.ToLower() == frequency.Trim().ToLower());
        }

        if (isActive.HasValue)
        {
            query = query.Where(h => h.IsActive == isActive.Value);
        }

        // Sorting
        query = (sortBy?.ToLower(), sortDescending) switch
        {
            ("name", false) => query.OrderBy(h => h.Name),
            ("name", true) => query.OrderByDescending(h => h.Name),
            ("code", false) => query.OrderBy(h => h.Code),
            ("code", true) => query.OrderByDescending(h => h.Code),
            ("category", false) => query.OrderBy(h => h.Category).ThenBy(h => h.SortOrder),
            ("category", true) => query.OrderByDescending(h => h.Category).ThenBy(h => h.SortOrder),
            ("frequency", false) => query.OrderBy(h => h.Frequency).ThenBy(h => h.SortOrder),
            ("frequency", true) => query.OrderByDescending(h => h.Frequency).ThenBy(h => h.SortOrder),
            ("isactive", false) => query.OrderBy(h => h.IsActive).ThenBy(h => h.SortOrder),
            ("isactive", true) => query.OrderByDescending(h => h.IsActive).ThenBy(h => h.SortOrder),
            ("sortorder", true) => query.OrderByDescending(h => h.SortOrder).ThenBy(h => h.Name),
            _ => query.OrderBy(h => h.SortOrder).ThenBy(h => h.Name)
        };

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(h => new FeeHeadDto(
                h.Id,
                h.Name,
                h.Code,
                h.Category,
                h.Frequency,
                h.Description,
                h.IsActive,
                h.IsDefault,
                h.SortOrder,
                h.ApplicableTo ?? "Both"
            ))
            .ToListAsync();

        return Ok(new PagedResultDto<FeeHeadDto>(items, totalCount, pageNumber, pageSize));
    }

    [HttpGet("heads")]
    public async Task<ActionResult<IEnumerable<FeeHeadDto>>> GetFeeHeads([FromQuery] bool activeOnly = true)
    {
        var query = _dbContext.FeeHeads.AsNoTracking().AsQueryable();

        if (activeOnly)
            query = query.Where(h => h.IsActive);

        var list = await query
            .OrderBy(h => h.SortOrder)
            .ThenBy(h => h.Name)
            .Select(h => new FeeHeadDto(
                h.Id,
                h.Name,
                h.Code,
                h.Category,
                h.Frequency,
                h.Description,
                h.IsActive,
                h.IsDefault,
                h.SortOrder,
                h.ApplicableTo ?? "Both"
            ))
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost("heads")]
    public async Task<ActionResult<FeeHeadDto>> SaveFeeHead([FromBody] CreateFeeHeadDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.Code))
            return BadRequest("Name and Code are required.");

        var trimmedCode = dto.Code.Trim().ToUpper();
        var existing = await _dbContext.FeeHeads
            .FirstOrDefaultAsync(h => h.Code.ToUpper() == trimmedCode);

        if (existing != null)
        {
            existing.Name = dto.Name.Trim();
            existing.Category = string.IsNullOrWhiteSpace(dto.Category) ? "Academic" : dto.Category.Trim();
            existing.Frequency = string.IsNullOrWhiteSpace(dto.Frequency) ? "Monthly" : dto.Frequency.Trim();
            existing.Description = dto.Description?.Trim();
            existing.SortOrder = dto.SortOrder;
            existing.IsActive = dto.IsActive;
            existing.IsDefault = dto.IsDefault;
            existing.ApplicableTo = string.IsNullOrWhiteSpace(dto.ApplicableTo) ? "Both" : dto.ApplicableTo.Trim();
            await _dbContext.SaveChangesAsync();

            return Ok(new FeeHeadDto(
                existing.Id,
                existing.Name,
                existing.Code,
                existing.Category,
                existing.Frequency,
                existing.Description,
                existing.IsActive,
                existing.IsDefault,
                existing.SortOrder,
                existing.ApplicableTo
            ));
        }

        var newHead = new FeeHead
        {
            TenantId = _currentUser.TenantId,
            BranchId = _currentUser.BranchId,
            Name = dto.Name.Trim(),
            Code = trimmedCode,
            Category = string.IsNullOrWhiteSpace(dto.Category) ? "Academic" : dto.Category.Trim(),
            Frequency = string.IsNullOrWhiteSpace(dto.Frequency) ? "Monthly" : dto.Frequency.Trim(),
            Description = dto.Description?.Trim(),
            IsActive = dto.IsActive,
            IsDefault = dto.IsDefault,
            SortOrder = dto.SortOrder,
            ApplicableTo = string.IsNullOrWhiteSpace(dto.ApplicableTo) ? "Both" : dto.ApplicableTo.Trim()
        };

        _dbContext.FeeHeads.Add(newHead);
        await _dbContext.SaveChangesAsync();

        return Ok(new FeeHeadDto(
            newHead.Id,
            newHead.Name,
            newHead.Code,
            newHead.Category,
            newHead.Frequency,
            newHead.Description,
            newHead.IsActive,
            newHead.IsDefault,
            newHead.SortOrder,
            newHead.ApplicableTo
        ));
    }

    [HttpPut("heads/{id:guid}")]
    public async Task<ActionResult<FeeHeadDto>> UpdateFeeHead(Guid id, [FromBody] UpdateFeeHeadDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.Code))
            return BadRequest("Name and Code are required.");

        var head = await _dbContext.FeeHeads.FindAsync(id);
        if (head == null) return NotFound("Fee head not found.");

        var trimmedCode = dto.Code.Trim().ToUpper();
        var duplicate = await _dbContext.FeeHeads
            .AnyAsync(h => h.Id != id && h.Code.ToUpper() == trimmedCode);
        if (duplicate)
            return BadRequest($"A fee head with code '{trimmedCode}' already exists.");

        head.Name = dto.Name.Trim();
        head.Code = trimmedCode;
        head.Category = string.IsNullOrWhiteSpace(dto.Category) ? "Academic" : dto.Category.Trim();
        head.Frequency = string.IsNullOrWhiteSpace(dto.Frequency) ? "Monthly" : dto.Frequency.Trim();
        head.Description = dto.Description?.Trim();
        head.IsActive = dto.IsActive;
        head.IsDefault = dto.IsDefault;
        head.SortOrder = dto.SortOrder;
        head.ApplicableTo = string.IsNullOrWhiteSpace(dto.ApplicableTo) ? "Both" : dto.ApplicableTo.Trim();

        await _dbContext.SaveChangesAsync();

        return Ok(new FeeHeadDto(
            head.Id,
            head.Name,
            head.Code,
            head.Category,
            head.Frequency,
            head.Description,
            head.IsActive,
            head.IsDefault,
            head.SortOrder,
            head.ApplicableTo
        ));
    }

    [HttpPatch("heads/{id:guid}/toggle-status")]
    public async Task<ActionResult> ToggleFeeHeadStatus(Guid id)
    {
        var head = await _dbContext.FeeHeads.FindAsync(id);
        if (head == null) return NotFound("Fee head not found.");

        head.IsActive = !head.IsActive;
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = $"Fee head '{head.Name}' is now {(head.IsActive ? "Active" : "Inactive")}.", isActive = head.IsActive });
    }

    [HttpDelete("heads/{id:guid}")]
    public async Task<ActionResult> DeleteFeeHead(Guid id)
    {
        var head = await _dbContext.FeeHeads.FindAsync(id);
        if (head == null) return NotFound("Fee head not found.");

        // Check if head is referenced by class structures or fee invoice items
        var inStructures = await _dbContext.ClassFeeStructures.AnyAsync(s => s.FeeHeadId == id);
        var inInvoices = await _dbContext.FeeInvoiceItems.AnyAsync(i => i.FeeHeadId == id);

        if (inStructures || inInvoices)
        {
            // Soft-deactivate if in use
            head.IsActive = false;
            await _dbContext.SaveChangesAsync();
            return Ok(new { 
                message = "Fee head is referenced by fee structures or student invoices. It has been deactivated instead of permanently deleted to preserve financial audit trail.",
                deactivated = true 
            });
        }

        _dbContext.FeeHeads.Remove(head);
        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "Fee head deleted permanently.", deactivated = false });
    }

    // ─── Class / Batch Fee Structure Matrix Endpoints ───────────────────────

    [HttpGet("structures")]
    public async Task<ActionResult<IEnumerable<ClassFeeStructureItemDto>>> GetClassFeeStructures(
        [FromQuery] Guid? classId = null,
        [FromQuery] Guid? batchId = null)
    {
        var query = _dbContext.ClassFeeStructures
            .AsNoTracking()
            .Include(s => s.FeeHead)
            .Include(s => s.Class)
            .Include(s => s.Batch)
            .AsQueryable();

        if (classId.HasValue && classId.Value != Guid.Empty)
            query = query.Where(s => s.ClassId == classId.Value);

        if (batchId.HasValue && batchId.Value != Guid.Empty)
            query = query.Where(s => s.BatchId == batchId.Value);

        var list = await query
            .OrderBy(s => s.FeeHead != null ? s.FeeHead.SortOrder : 0)
            .Select(s => new ClassFeeStructureItemDto(
                s.Id,
                s.ClassId,
                s.Class != null ? s.Class.Name : null,
                s.BatchId,
                s.Batch != null ? s.Batch.Name : null,
                s.FeeHeadId,
                s.FeeHead != null ? s.FeeHead.Name : "N/A",
                s.FeeHead != null ? s.FeeHead.Code : "N/A",
                s.FeeHead != null ? s.FeeHead.Category : "Academic",
                s.FeeHead != null ? s.FeeHead.Frequency : "Monthly",
                s.Amount,
                s.ApplicableMonth,
                s.IsActive,
                s.FeeHead != null ? (s.FeeHead.ApplicableTo ?? "Both") : "Both"
            ))
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost("structures")]
    public async Task<ActionResult> SaveClassFeeStructures([FromBody] SaveClassFeeStructureBatchDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest("No fee structure items provided.");

        foreach (var item in dto.Items)
        {
            var effectiveAmount = item.IsActive ? item.Amount : 0m;

            if (item.Id.HasValue && item.Id.Value != Guid.Empty)
            {
                var existing = await _dbContext.ClassFeeStructures.FindAsync(item.Id.Value);
                if (existing != null)
                {
                    existing.Amount = effectiveAmount;
                    existing.ApplicableMonth = item.ApplicableMonth;
                    existing.IsActive = item.IsActive;
                    continue;
                }
            }

            var duplicate = await _dbContext.ClassFeeStructures
                .FirstOrDefaultAsync(s => s.FeeHeadId == item.FeeHeadId &&
                    ((dto.ClassId.HasValue && s.ClassId == dto.ClassId.Value) ||
                     (dto.BatchId.HasValue && s.BatchId == dto.BatchId.Value)));

            if (duplicate != null)
            {
                duplicate.Amount = effectiveAmount;
                duplicate.ApplicableMonth = item.ApplicableMonth;
                duplicate.IsActive = item.IsActive;
            }
            else
            {
                var newStructure = new ClassFeeStructure
                {
                    TenantId = _currentUser.TenantId,
                    BranchId = _currentUser.BranchId,
                    ClassId = dto.ClassId,
                    BatchId = dto.BatchId,
                    FeeHeadId = item.FeeHeadId,
                    Amount = effectiveAmount,
                    ApplicableMonth = item.ApplicableMonth,
                    IsActive = item.IsActive
                };
                _dbContext.ClassFeeStructures.Add(newStructure);
            }
        }

        // Bidirectional sync: If saving structure for a coaching batch, update Batch.StandardMonthlyFee
        if (dto.BatchId.HasValue && dto.BatchId.Value != Guid.Empty)
        {
            var targetBatch = await _dbContext.Batches.FirstOrDefaultAsync(b => b.Id == dto.BatchId.Value && b.TenantId == _currentUser.TenantId);
            if (targetBatch != null)
            {
                var coachingHeads = await _dbContext.FeeHeads
                    .AsNoTracking()
                    .Where(h => h.TenantId == _currentUser.TenantId && h.IsActive &&
                                (h.Code == "COACH" || h.Code == "COACHING" || h.Code == "TUI-FEE" || h.Code == "TUI" || h.ApplicableTo == "Coaching"))
                    .Select(h => h.Id)
                    .ToListAsync();

                var coachItem = dto.Items.FirstOrDefault(i => coachingHeads.Contains(i.FeeHeadId) && i.IsActive);
                if (coachItem != null)
                {
                    targetBatch.StandardMonthlyFee = coachItem.Amount;
                }
                else
                {
                    var anyMonthly = dto.Items.FirstOrDefault(i => i.IsActive && i.Amount > 0 && i.ApplicableMonth == null);
                    if (anyMonthly != null)
                    {
                        targetBatch.StandardMonthlyFee = anyMonthly.Amount;
                    }
                }
            }
        }

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "Class fee structures saved successfully." });
    }

    // =========================================================================
    // DYNAMIC BHARAT UPI QR & ONLINE FEE COLLECTION ENDPOINTS
    // =========================================================================

    [HttpGet("invoices/{invoiceId}/upi-intent")]
    [AllowAnonymous]
    public async Task<ActionResult<UpiIntentResponseDto>> GetInvoiceUpiIntent(Guid invoiceId)
    {
        var invoice = await _dbContext.FeeInvoices
            .AsNoTracking()
            .Include(i => i.Branch)
            .Include(i => i.Student)
                .ThenInclude(s => s!.Branch)
            .Include(i => i.Student)
                .ThenInclude(s => s!.Class)
            .Include(i => i.Student)
                .ThenInclude(s => s!.Section)
            .Include(i => i.Student)
                .ThenInclude(s => s!.Batch)
            .FirstOrDefaultAsync(i => i.Id == invoiceId);

        if (invoice == null) return NotFound("Invoice not found.");
        if (invoice.Status == InvoiceStatus.Cancelled)
            return BadRequest(new { message = "This invoice has been cancelled." });

        var tenant = await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == invoice.TenantId);
        var branch = invoice.Branch ?? invoice.Student?.Branch;

        string payeeUpiId = !string.IsNullOrWhiteSpace(branch?.UpiId)
            ? branch.UpiId.Trim()
            : (!string.IsNullOrWhiteSpace(tenant?.UpiId) ? tenant.UpiId.Trim() : "imserp.fees@sbi");

        string payeeName = !string.IsNullOrWhiteSpace(branch?.UpiMerchantName)
            ? branch.UpiMerchantName.Trim()
            : (!string.IsNullOrWhiteSpace(tenant?.UpiMerchantName) ? tenant.UpiMerchantName.Trim() : (tenant?.Name ?? "Institute Management ERP"));

        string? merchantCode = tenant?.UpiMerchantCode ?? "8211";

        decimal dueAmount = invoice.TotalAmount - invoice.PaidAmount;
        if (dueAmount < 0) dueAmount = 0;

        string studentName = invoice.Student?.StudentName ?? "Student";
        string formattedAmount = dueAmount.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture);
        string encodedPayee = Uri.EscapeDataString(payeeName);
        string transactionNote = Uri.EscapeDataString($"Fee {invoice.InvoiceNumber} {studentName}");

        // NPCI Standard Bharat UPI Intent URI
        string upiIntentUri = $"upi://pay?pa={payeeUpiId}&pn={encodedPayee}&am={formattedAmount}&cu=INR&tn={transactionNote}&tr={invoice.InvoiceNumber}&mc={merchantCode}";

        // Specific App Deep Links for instant 1-tap mobile opening
        string gpayUri = $"gpay://upi/pay?pa={payeeUpiId}&pn={encodedPayee}&am={formattedAmount}&cu=INR&tn={transactionNote}&tr={invoice.InvoiceNumber}";
        string phonepeUri = $"phonepe://pay?pa={payeeUpiId}&pn={encodedPayee}&am={formattedAmount}&cu=INR&tn={transactionNote}&tr={invoice.InvoiceNumber}";
        string paytmUri = $"paytmmp://pay?pa={payeeUpiId}&pn={encodedPayee}&am={formattedAmount}&cu=INR&tn={transactionNote}&tr={invoice.InvoiceNumber}";
        string bhimUri = $"bhim://pay?pa={payeeUpiId}&pn={encodedPayee}&am={formattedAmount}&cu=INR&tn={transactionNote}&tr={invoice.InvoiceNumber}";

        var dto = new UpiIntentResponseDto(
            invoice.Id,
            invoice.InvoiceNumber,
            invoice.StudentId,
            studentName,
            invoice.Student?.SchoolRollNumber ?? invoice.Student?.RollNumber,
            invoice.Student?.Class?.Name ?? invoice.ClassName,
            invoice.Student?.Section?.Name ?? invoice.SectionName,
            invoice.Student?.Batch?.Name,
            invoice.TotalAmount,
            invoice.PaidAmount,
            dueAmount,
            payeeUpiId,
            payeeName,
            merchantCode,
            upiIntentUri,
            gpayUri,
            phonepeUri,
            paytmUri,
            bhimUri,
            branch?.Name,
            tenant?.Name ?? "Institute Management ERP",
            tenant?.ProfilePhoto
        );

        return Ok(dto);
    }

    [HttpPost("invoices/{invoiceId}/upi-collect")]
    [AllowAnonymous]
    public async Task<ActionResult<FeePaymentReceiptDto>> CollectInvoiceUpiPayment(
        Guid invoiceId,
        [FromBody] CollectUpiPaymentRequestDto dto)
    {
        if (dto == null || dto.Amount <= 0)
            return BadRequest(new { message = "Payment amount must be greater than zero." });

        if (string.IsNullOrWhiteSpace(dto.UpiRrn) || dto.UpiRrn.Trim().Length < 6)
            return BadRequest(new { message = "A valid 12-digit UPI Reference Number / UTR is required." });

        string cleanUtr = dto.UpiRrn.Trim();

        var isDuplicateUtr = await _dbContext.FeePayments
            .AnyAsync(p => (p.UpiRrn == cleanUtr || p.TransactionRef == cleanUtr) && p.OnlinePaymentStatus == "Completed");

        if (isDuplicateUtr)
        {
            return Conflict(new { message = $"Payment with UPI Reference ID / UTR '{cleanUtr}' has already been processed and verified. Please check payment history." });
        }

        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<ActionResult<FeePaymentReceiptDto>>(async () =>
        {
            using var transaction = await _dbContext.Database.BeginTransactionAsync();

            var invoice = await _dbContext.FeeInvoices
                .Include(i => i.Items)
                .Include(i => i.Branch)
                .Include(i => i.Student)
                    .ThenInclude(s => s!.Branch)
                .Include(i => i.Student)
                    .ThenInclude(s => s!.Class)
                .Include(i => i.Student)
                    .ThenInclude(s => s!.Section)
                .Include(i => i.Student)
                    .ThenInclude(s => s!.Batch)
                .FirstOrDefaultAsync(i => i.Id == invoiceId);

            if (invoice == null) return NotFound(new { message = "Invoice not found." });
            if (invoice.Status == InvoiceStatus.Cancelled)
                return BadRequest(new { message = "This invoice has been cancelled and cannot accept payments." });

            decimal currentDue = invoice.TotalAmount - invoice.PaidAmount;
            if (currentDue <= 0)
                return BadRequest(new { message = "This invoice is already fully paid." });

            decimal payAmount = Math.Min(dto.Amount, currentDue);
            var receiptNo = "REC-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss");

            invoice.PaidAmount += payAmount;
            invoice.Status = invoice.PaidAmount >= invoice.TotalAmount ? InvoiceStatus.Paid : InvoiceStatus.Partial;

            decimal itemRemaining = payAmount;
            if (invoice.Items != null && invoice.Items.Count > 0)
            {
                foreach (var it in invoice.Items)
                {
                    if (itemRemaining <= 0) break;
                    decimal itDue = it.Amount - it.PaidAmount;
                    if (itDue <= 0) continue;
                    decimal itAlloc = Math.Min(itemRemaining, itDue);
                    it.PaidAmount += itAlloc;
                    itemRemaining -= itAlloc;
                }
            }

            var student = invoice.Student;
            var payment = new FeePayment
            {
                TenantId = invoice.TenantId,
                BranchId = invoice.BranchId ?? student?.BranchId,
                InvoiceId = invoice.Id,
                ReceiptNumber = receiptNo,
                AmountPaid = payAmount,
                Mode = PaymentMode.UPI,
                TransactionRef = cleanUtr,
                UpiRrn = cleanUtr,
                PayerVpa = dto.PayerVpa?.Trim(),
                PayerName = dto.PayerName?.Trim() ?? student?.ParentName ?? student?.StudentName,
                PayerPhone = dto.PayerPhone?.Trim() ?? student?.ParentWhatsAppPhone,
                OnlinePaymentStatus = "Completed",
                VerifiedBy = User.Identity?.Name ?? "UPI-SelfService",
                VerifiedAt = DateTime.UtcNow,
                PaymentDate = DateTime.UtcNow,
                Remarks = !string.IsNullOrWhiteSpace(dto.Remarks)
                    ? dto.Remarks.Trim()
                    : $"Online Dynamic UPI Settlement (UTR: {cleanUtr})"
            };

            _dbContext.FeePayments.Add(payment);

            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            var tenant = await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == invoice.TenantId);
            var branch = invoice.Branch ?? student?.Branch;

            decimal totalRemainingDue = student != null
                ? await _dbContext.FeeInvoices
                    .Where(i => i.StudentId == student.Id && i.Status != InvoiceStatus.Cancelled)
                    .SumAsync(i => i.TotalAmount - i.PaidAmount)
                : 0m;

            var lineItems = new List<FeeReceiptLineItemDto>();
            if (invoice.Items != null && invoice.Items.Count > 0)
            {
                foreach (var it in invoice.Items)
                {
                    lineItems.Add(new FeeReceiptLineItemDto(
                        lineItems.Count + 1,
                        it.HeadName,
                        "Online UPI Fee Settlement",
                        invoice.InvoiceNumber,
                        it.Amount
                    ));
                }
            }
            else
            {
                lineItems.Add(new FeeReceiptLineItemDto(
                    1,
                    invoice.Title,
                    "Online UPI Fee Settlement",
                    invoice.InvoiceNumber,
                    payAmount
                ));
            }

            var receiptDto = new FeePaymentReceiptDto(
                payment.Id,
                receiptNo,
                student?.StudentName ?? "Student",
                student?.SchoolRollNumber ?? student?.RollNumber ?? "N/A",
                student?.Batch?.Name ?? "General",
                student?.ParentName ?? "Parent/Guardian",
                student?.ParentWhatsAppPhone ?? "",
                invoice.InvoiceNumber,
                payAmount,
                totalRemainingDue,
                payment.PaymentDate,
                PaymentMode.UPI,
                cleanUtr,
                payment.Remarks,
                payAmount,
                0m,
                null,
                0m,
                lineItems,
                null,
                branch?.Name,
                student?.Class?.Name ?? invoice.ClassName,
                student?.Section?.Name ?? invoice.SectionName,
                tenant?.Name ?? "Institute Management ERP",
                tenant?.ProfilePhoto,
                tenant?.ContactPhone,
                tenant?.Address,
                student?.Id ?? invoice.StudentId,
                invoice.Id,
                null,
                null,
                0m,
                null,
                tenant?.OfficialSeal,
                tenant?.DigitalSignature
            );

            var targetWhatsApp = !string.IsNullOrWhiteSpace(dto.PayerPhone)
                ? dto.PayerPhone.Trim()
                : student?.ParentWhatsAppPhone;

            if (dto.SendWhatsAppReceipt && !string.IsNullOrWhiteSpace(targetWhatsApp))
            {
                try
                {
                    await _whatsAppService.SendFeeReceiptAsync(
                        invoice.TenantId,
                        targetWhatsApp,
                        student?.StudentName ?? "Student",
                        receiptNo,
                        payAmount,
                        totalRemainingDue
                    );
                }
                catch { }
            }

            return Ok(receiptDto);
        });
    }

    [HttpPost("student/{studentId}/upi-collect-fifo")]
    [AllowAnonymous]
    public async Task<ActionResult<FeePaymentReceiptDto>> CollectStudentFifoUpiPayment(
        Guid studentId,
        [FromBody] CollectStudentFifoUpiPaymentRequestDto dto)
    {
        if (dto == null || dto.Amount <= 0)
            return BadRequest(new { message = "Payment amount must be greater than zero." });

        if (string.IsNullOrWhiteSpace(dto.UpiRrn) || dto.UpiRrn.Trim().Length < 6)
            return BadRequest(new { message = "A valid 12-digit UPI Reference Number / UTR is required." });

        string cleanUtr = dto.UpiRrn.Trim();

        var isDuplicateUtr = await _dbContext.FeePayments
            .AnyAsync(p => (p.UpiRrn == cleanUtr || p.TransactionRef == cleanUtr) && p.OnlinePaymentStatus == "Completed");

        if (isDuplicateUtr)
        {
            return Conflict(new { message = $"Payment with UPI Reference ID / UTR '{cleanUtr}' has already been processed and verified." });
        }

        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<ActionResult<FeePaymentReceiptDto>>(async () =>
        {
            using var transaction = await _dbContext.Database.BeginTransactionAsync();

            var student = await _dbContext.Students
                .Include(s => s.Branch)
                .Include(s => s.Class)
                .Include(s => s.Section)
                .Include(s => s.Batch)
                .FirstOrDefaultAsync(s => s.Id == studentId);

            if (student == null) return NotFound(new { message = "Student not found." });

            var unpaidInvoices = await _dbContext.FeeInvoices
                .Include(i => i.Items)
                .Where(i => i.StudentId == studentId && i.Status != InvoiceStatus.Paid && i.Status != InvoiceStatus.Cancelled)
                .OrderBy(i => i.DueDate)
                .ToListAsync();

            decimal totalAmountPaid = dto.Amount;
            decimal finePaidNow = 0;
            string? libraryFineParticulars = null;
            var selectedCirculations = new List<LibraryCirculation>();

            if (dto.IncludeLibraryFine)
            {
                var pendingLibCirculations = await _dbContext.LibraryCirculations
                    .Include(c => c.BookCopy).ThenInclude(bc => bc!.Book)
                    .Where(c => c.StudentId == studentId && (c.FineStatus == "Pending" && c.FineAmount > 0))
                    .OrderBy(c => c.DueDate)
                    .ToListAsync();

                decimal totalFines = pendingLibCirculations.Sum(c => c.FineAmount);
                if (totalFines > 0)
                {
                    finePaidNow = Math.Min(totalAmountPaid, totalFines);
                    selectedCirculations = pendingLibCirculations;
                    libraryFineParticulars = $"Library Fines Paid (₹{finePaidNow:N2})";
                }
            }

            decimal tuitionToAllocate = totalAmountPaid - finePaidNow;
            if (unpaidInvoices.Count == 0 && finePaidNow == 0)
            {
                return BadRequest(new { message = "This student has zero outstanding due fees or fines." });
            }

            var receiptNo = "REC-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss");
            decimal tuitionAllocatedTotal = 0;
            var allocatedInvoicesList = new List<(FeeInvoice Invoice, decimal AllocatedAmount)>();
            FeePayment? lastPayment = null;

            if (tuitionToAllocate > 0 && unpaidInvoices.Count > 0)
            {
                decimal remainingTuition = tuitionToAllocate;
                foreach (var inv in unpaidInvoices)
                {
                    if (remainingTuition <= 0) break;
                    decimal invoiceDue = inv.TotalAmount - inv.PaidAmount;
                    decimal allocateForThisInv = Math.Min(remainingTuition, invoiceDue);
                    if (allocateForThisInv <= 0) continue;

                    inv.PaidAmount += allocateForThisInv;
                    tuitionAllocatedTotal += allocateForThisInv;
                    inv.Status = inv.PaidAmount >= inv.TotalAmount ? InvoiceStatus.Paid : InvoiceStatus.Partial;

                    decimal itemRemaining = allocateForThisInv;
                    if (inv.Items != null && inv.Items.Count > 0)
                    {
                        foreach (var it in inv.Items)
                        {
                            if (itemRemaining <= 0) break;
                            decimal itDue = it.Amount - it.PaidAmount;
                            if (itDue <= 0) continue;
                            decimal itAlloc = Math.Min(itemRemaining, itDue);
                            it.PaidAmount += itAlloc;
                            itemRemaining -= itAlloc;
                        }
                    }

                    remainingTuition -= allocateForThisInv;
                    allocatedInvoicesList.Add((inv, allocateForThisInv));

                    var payment = new FeePayment
                    {
                        TenantId = student.TenantId,
                        BranchId = inv.BranchId ?? student.BranchId,
                        InvoiceId = inv.Id,
                        ReceiptNumber = receiptNo,
                        AmountPaid = allocateForThisInv,
                        Mode = PaymentMode.UPI,
                        TransactionRef = cleanUtr,
                        UpiRrn = cleanUtr,
                        PayerVpa = dto.PayerVpa?.Trim(),
                        PayerName = dto.PayerName?.Trim() ?? student.ParentName ?? student.StudentName,
                        PayerPhone = dto.PayerPhone?.Trim() ?? student.ParentWhatsAppPhone,
                        OnlinePaymentStatus = "Completed",
                        VerifiedBy = User.Identity?.Name ?? "UPI-FIFO-Self",
                        VerifiedAt = DateTime.UtcNow,
                        PaymentDate = DateTime.UtcNow,
                        Remarks = !string.IsNullOrWhiteSpace(dto.Remarks) ? dto.Remarks.Trim() : $"Online UPI FIFO Settlement (UTR: {cleanUtr})"
                    };

                    _dbContext.FeePayments.Add(payment);
                    lastPayment = payment;
                }
            }

            if (finePaidNow > 0)
            {
                foreach (var circ in selectedCirculations)
                {
                    circ.FineStatus = "Paid";
                    circ.FinePaymentReceiptNumber = receiptNo;
                    circ.FinePaidAt = DateTime.UtcNow;
                }
            }

            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            var tenant = await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == student.TenantId);
            var branch = student.Branch;

            decimal remainingTotalDue = await _dbContext.FeeInvoices
                .Where(i => i.StudentId == student.Id && i.Status != InvoiceStatus.Cancelled)
                .SumAsync(i => i.TotalAmount - i.PaidAmount);

            var lineItems = new List<FeeReceiptLineItemDto>();
            foreach (var item in allocatedInvoicesList)
            {
                lineItems.Add(new FeeReceiptLineItemDto(
                    lineItems.Count + 1,
                    item.Invoice.Title,
                    "Online UPI Fee Settlement",
                    item.Invoice.InvoiceNumber,
                    item.AllocatedAmount
                ));
            }

            var receiptDto = new FeePaymentReceiptDto(
                lastPayment?.Id ?? Guid.NewGuid(),
                receiptNo,
                student.StudentName,
                student.SchoolRollNumber ?? student.RollNumber ?? "N/A",
                student.Batch?.Name ?? "General",
                student.ParentName ?? "Parent/Guardian",
                student.ParentWhatsAppPhone ?? "",
                allocatedInvoicesList.Count > 0 ? allocatedInvoicesList[0].Invoice.InvoiceNumber : "N/A",
                totalAmountPaid,
                remainingTotalDue,
                DateTime.UtcNow,
                PaymentMode.UPI,
                cleanUtr,
                dto.Remarks ?? $"UPI Online Payment (UTR: {cleanUtr})",
                tuitionAllocatedTotal,
                finePaidNow,
                libraryFineParticulars,
                0m,
                lineItems,
                null,
                branch?.Name,
                student.Class?.Name,
                student.Section?.Name,
                tenant?.Name ?? "Institute Management ERP",
                tenant?.ProfilePhoto,
                tenant?.ContactPhone,
                tenant?.Address,
                student.Id,
                allocatedInvoicesList.Count > 0 ? allocatedInvoicesList[0].Invoice.Id : (Guid?)null,
                null,
                null,
                0m,
                null,
                tenant?.OfficialSeal,
                tenant?.DigitalSignature
            );

            var targetWhatsAppFifo = !string.IsNullOrWhiteSpace(dto.PayerPhone)
                ? dto.PayerPhone.Trim()
                : student.ParentWhatsAppPhone;

            if (dto.SendWhatsAppReceipt && !string.IsNullOrWhiteSpace(targetWhatsAppFifo))
            {
                try
                {
                    await _whatsAppService.SendFeeReceiptAsync(
                        student.TenantId,
                        targetWhatsAppFifo,
                        student.StudentName,
                        receiptNo,
                        totalAmountPaid,
                        remainingTotalDue
                    );
                }
                catch { }
            }

            return Ok(receiptDto);
        });
    }

    [HttpGet("upi-settings")]
    public async Task<ActionResult<UpiPaymentSettingsDto>> GetUpiSettings([FromQuery] Guid? branchId = null)
    {
        var tenantId = _currentUser.TenantId;
        var tenant = await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId);
        if (tenant == null) return NotFound("Tenant not found.");

        var targetBranchId = branchId ?? _currentUser.BranchId;
        Branch? branch = null;
        if (targetBranchId.HasValue && targetBranchId != Guid.Empty)
        {
            branch = await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == targetBranchId.Value && b.TenantId == tenantId);
        }

        string effectiveUpiId = !string.IsNullOrWhiteSpace(branch?.UpiId)
            ? branch.UpiId.Trim()
            : (!string.IsNullOrWhiteSpace(tenant.UpiId) ? tenant.UpiId.Trim() : "imserp.fees@sbi");

        string effectiveMerchantName = !string.IsNullOrWhiteSpace(branch?.UpiMerchantName)
            ? branch.UpiMerchantName.Trim()
            : (!string.IsNullOrWhiteSpace(tenant.UpiMerchantName) ? tenant.UpiMerchantName.Trim() : (tenant.Name ?? "Institute Management ERP"));

        string? effectiveBankName = !string.IsNullOrWhiteSpace(branch?.BankName)
            ? branch.BankName.Trim()
            : (!string.IsNullOrWhiteSpace(tenant.BankName) ? tenant.BankName.Trim() : null);

        string? effectiveAccountNumber = !string.IsNullOrWhiteSpace(branch?.BankAccountNumber)
            ? branch.BankAccountNumber.Trim()
            : (!string.IsNullOrWhiteSpace(tenant.BankAccountNumber) ? tenant.BankAccountNumber.Trim() : null);

        string? effectiveIfsc = !string.IsNullOrWhiteSpace(branch?.BankIfscCode)
            ? branch.BankIfscCode.Trim()
            : (!string.IsNullOrWhiteSpace(tenant.BankIfscCode) ? tenant.BankIfscCode.Trim() : null);

        string? effectiveHolder = !string.IsNullOrWhiteSpace(branch?.BankAccountHolderName)
            ? branch.BankAccountHolderName.Trim()
            : (!string.IsNullOrWhiteSpace(tenant.BankAccountHolderName) ? tenant.BankAccountHolderName.Trim() : null);

        string? effectiveAccountType = !string.IsNullOrWhiteSpace(branch?.BankAccountType)
            ? branch.BankAccountType.Trim()
            : (!string.IsNullOrWhiteSpace(tenant.BankAccountType) ? tenant.BankAccountType.Trim() : "Current");

        string? effectiveBranchLocation = !string.IsNullOrWhiteSpace(branch?.BankBranch)
            ? branch.BankBranch.Trim()
            : (!string.IsNullOrWhiteSpace(tenant.BankBranch) ? tenant.BankBranch.Trim() : null);

        return Ok(new UpiPaymentSettingsDto(
            tenant.UpiId,
            tenant.UpiMerchantName,
            tenant.UpiMerchantCode ?? "8211",
            tenant.UpiQrEnabled,
            tenant.UpiAutoVerify,
            branch?.UpiId,
            branch?.UpiMerchantName,
            effectiveUpiId,
            effectiveMerchantName,
            effectiveBankName,
            effectiveAccountNumber,
            effectiveIfsc,
            effectiveHolder,
            effectiveAccountType,
            effectiveBranchLocation
        ));
    }

    [HttpPut("upi-settings")]
    public async Task<ActionResult> UpdateUpiSettings([FromBody] UpdateUpiPaymentSettingsDto dto)
    {
        var roleClaim = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value?.ToLower() ?? "";
        if (roleClaim.Contains("parent") || roleClaim.Contains("student"))
        {
            return Forbid();
        }

        var tenantId = _currentUser.TenantId;
        var tenant = await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId);
        if (tenant == null) return NotFound("Tenant not found.");

        if (dto.ApplyToBranchOnly && dto.BranchId.HasValue && dto.BranchId.Value != Guid.Empty)
        {
            var branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Id == dto.BranchId.Value && b.TenantId == tenantId);
            if (branch == null) return NotFound("Branch not found.");
            branch.UpiId = dto.UpiId?.Trim();
            branch.UpiMerchantName = dto.UpiMerchantName?.Trim();
            if (dto.BankName != null) branch.BankName = string.IsNullOrWhiteSpace(dto.BankName) ? null : dto.BankName.Trim();
            if (dto.BankAccountNumber != null) branch.BankAccountNumber = string.IsNullOrWhiteSpace(dto.BankAccountNumber) ? null : dto.BankAccountNumber.Trim();
            if (dto.BankIfscCode != null) branch.BankIfscCode = string.IsNullOrWhiteSpace(dto.BankIfscCode) ? null : dto.BankIfscCode.Trim().ToUpper();
            if (dto.BankAccountHolderName != null) branch.BankAccountHolderName = string.IsNullOrWhiteSpace(dto.BankAccountHolderName) ? null : dto.BankAccountHolderName.Trim();
            if (dto.BankAccountType != null) branch.BankAccountType = string.IsNullOrWhiteSpace(dto.BankAccountType) ? "Current" : dto.BankAccountType.Trim();
            if (dto.BankBranch != null) branch.BankBranch = string.IsNullOrWhiteSpace(dto.BankBranch) ? null : dto.BankBranch.Trim();
        }
        else
        {
            tenant.UpiId = dto.UpiId?.Trim();
            tenant.UpiMerchantName = dto.UpiMerchantName?.Trim();
            tenant.UpiMerchantCode = !string.IsNullOrWhiteSpace(dto.UpiMerchantCode) ? dto.UpiMerchantCode.Trim() : "8211";
            tenant.UpiQrEnabled = dto.UpiQrEnabled;
            tenant.UpiAutoVerify = dto.UpiAutoVerify;
            if (dto.BankName != null) tenant.BankName = string.IsNullOrWhiteSpace(dto.BankName) ? null : dto.BankName.Trim();
            if (dto.BankAccountNumber != null) tenant.BankAccountNumber = string.IsNullOrWhiteSpace(dto.BankAccountNumber) ? null : dto.BankAccountNumber.Trim();
            if (dto.BankIfscCode != null) tenant.BankIfscCode = string.IsNullOrWhiteSpace(dto.BankIfscCode) ? null : dto.BankIfscCode.Trim().ToUpper();
            if (dto.BankAccountHolderName != null) tenant.BankAccountHolderName = string.IsNullOrWhiteSpace(dto.BankAccountHolderName) ? null : dto.BankAccountHolderName.Trim();
            if (dto.BankAccountType != null) tenant.BankAccountType = string.IsNullOrWhiteSpace(dto.BankAccountType) ? "Current" : dto.BankAccountType.Trim();
            if (dto.BankBranch != null) tenant.BankBranch = string.IsNullOrWhiteSpace(dto.BankBranch) ? null : dto.BankBranch.Trim();
        }

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "UPI Payment Gateway & Settlement Bank settings saved successfully." });
    }

    [HttpGet("online-upi-transactions")]
    public async Task<ActionResult<PagedResultDto<OnlineUpiTransactionItemDto>>> GetOnlineUpiTransactions(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 15,
        [FromQuery] string? searchTerm = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null)
    {
        var roleClaim = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value?.ToLower() ?? "";
        if (roleClaim.Contains("parent") || roleClaim.Contains("student"))
        {
            return Forbid();
        }

        var tenantId = _currentUser.TenantId;
        var query = _dbContext.FeePayments
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.Mode == PaymentMode.UPI)
            .Include(p => p.Branch)
            .Include(p => p.Invoice)
                .ThenInclude(i => i!.Student)
                    .ThenInclude(s => s!.Class)
            .Include(p => p.Invoice)
                .ThenInclude(i => i!.Student)
                    .ThenInclude(s => s!.Section)
            .Include(p => p.Invoice)
                .ThenInclude(i => i!.Student)
                    .ThenInclude(s => s!.Batch)
            .AsQueryable();

        var effectiveBranchId = branchId ?? _currentUser.BranchId;
        if (effectiveBranchId.HasValue && effectiveBranchId.Value != Guid.Empty)
        {
            query = query.Where(p => p.BranchId == effectiveBranchId.Value ||
                                     (p.Invoice != null && p.Invoice.BranchId == effectiveBranchId.Value) ||
                                     (p.Invoice != null && p.Invoice.Student != null && p.Invoice.Student.BranchId == effectiveBranchId.Value));
        }

        if (fromDate.HasValue)
        {
            query = query.Where(p => p.PaymentDate >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            var endOfDay = toDate.Value.Date.AddDays(1).AddTicks(-1);
            query = query.Where(p => p.PaymentDate <= endOfDay);
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(p =>
                (p.UpiRrn != null && p.UpiRrn.ToLower().Contains(term)) ||
                (p.TransactionRef != null && p.TransactionRef.ToLower().Contains(term)) ||
                p.ReceiptNumber.ToLower().Contains(term) ||
                (p.Invoice != null && p.Invoice.InvoiceNumber.ToLower().Contains(term)) ||
                (p.PayerName != null && p.PayerName.ToLower().Contains(term)) ||
                (p.PayerPhone != null && p.PayerPhone.Contains(term)) ||
                (p.Invoice != null && p.Invoice.Student != null && (
                    p.Invoice.Student.StudentName.ToLower().Contains(term) ||
                    p.Invoice.Student.RollNumber.ToLower().Contains(term) ||
                    (p.Invoice.Student.SchoolRollNumber != null && p.Invoice.Student.SchoolRollNumber.ToLower().Contains(term))
                ))
            );
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(p => p.PaymentDate)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new OnlineUpiTransactionItemDto(
                p.Id,
                p.InvoiceId,
                p.Invoice != null ? p.Invoice.InvoiceNumber : "N/A",
                p.ReceiptNumber,
                p.Invoice != null ? p.Invoice.StudentId : Guid.Empty,
                p.Invoice != null && p.Invoice.Student != null ? p.Invoice.Student.StudentName : "Student",
                p.Invoice != null && p.Invoice.Student != null ? (p.Invoice.Student.SchoolRollNumber ?? p.Invoice.Student.RollNumber) : null,
                p.Invoice != null && p.Invoice.Student != null && p.Invoice.Student.Class != null ? p.Invoice.Student.Class.Name : null,
                p.Invoice != null && p.Invoice.Student != null && p.Invoice.Student.Section != null ? p.Invoice.Student.Section.Name : null,
                p.Invoice != null && p.Invoice.Student != null && p.Invoice.Student.Batch != null ? p.Invoice.Student.Batch.Name : null,
                p.Branch != null ? p.Branch.Name : (p.Invoice != null && p.Invoice.Branch != null ? p.Invoice.Branch.Name : null),
                p.AmountPaid,
                p.UpiRrn ?? p.TransactionRef,
                p.PayerVpa,
                p.PayerName,
                p.PayerPhone,
                p.OnlinePaymentStatus ?? "Completed",
                p.PaymentDate,
                p.VerifiedBy,
                p.VerifiedAt
            ))
            .ToListAsync();

        return Ok(new PagedResultDto<OnlineUpiTransactionItemDto>(items, totalCount, pageNumber, pageSize));
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TestsController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly IWhatsAppService _whatsAppService;
    private readonly ICurrentUserService _currentUser;

    public TestsController(IIMSERPDbContext dbContext, IWhatsAppService whatsAppService, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _whatsAppService = whatsAppService;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TestDto>>> GetTests(
        [FromQuery] Guid? batchId = null,
        [FromQuery] Guid? classId = null,
        [FromQuery] Guid? sectionId = null,
        [FromQuery] string? category = null,
        [FromQuery] string? batchScope = null)
    {
        var query = _dbContext.Tests.AsNoTracking()
            .Include(t => t.Batch)
            .Include(t => t.Class)
            .Include(t => t.Section)
            .Include(t => t.EvaluatorTeacher)
            .AsQueryable();

        if (category?.ToLower() == "school")
        {
            query = query.Where(t => t.ClassId.HasValue);
        }
        else if (category?.ToLower() == "coaching")
        {
            query = query.Where(t => t.BatchId.HasValue);
        }

        if (!string.IsNullOrWhiteSpace(batchScope) && !batchScope.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            if (batchScope.Equals("combined", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(t => t.BatchId.HasValue &&
                    (t.Batch.ClassId == null ||
                     t.Batch.Name.Contains("Combined") ||
                     t.Batch.Name.Contains("To") ||
                     t.Batch.Name.Contains("to") ||
                     t.Batch.Name.Contains("Foundation")));
            }
            else if (batchScope.Equals("single", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(t => !t.BatchId.HasValue ||
                    (t.Batch.ClassId != null &&
                     !t.Batch.Name.Contains("Combined") &&
                     !t.Batch.Name.Contains("To") &&
                     !t.Batch.Name.Contains("to") &&
                     !t.Batch.Name.Contains("Foundation")));
            }
        }

        if (batchId.HasValue && batchId != Guid.Empty)
        {
            query = query.Where(t => t.BatchId == batchId);
        }

        if (classId.HasValue && classId != Guid.Empty)
        {
            query = query.Where(t => t.ClassId == classId);
        }

        if (sectionId.HasValue && sectionId != Guid.Empty)
        {
            query = query.Where(t => t.SectionId == sectionId);
        }

        var isTeacher = _currentUser.UserRole.Contains("Teacher", StringComparison.OrdinalIgnoreCase) ||
                        _currentUser.UserRole.Contains("Faculty", StringComparison.OrdinalIgnoreCase);

        if (isTeacher)
        {
            var user = await _dbContext.Users.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);
            var linkedTeacher = await _dbContext.Teachers.AsNoTracking().FirstOrDefaultAsync(t =>
                t.TenantId == _currentUser.TenantId && (t.UserId == _currentUser.UserId || (user != null && user.Email != null && t.Email == user.Email) || (user != null && user.FullName != null && t.FullName == user.FullName)));

            if (linkedTeacher != null)
            {
                var assignedBatchIds = await _dbContext.TeacherBatchAssignments
                    .Where(a => a.TeacherId == linkedTeacher.Id && a.IsActive && a.BatchId.HasValue)
                    .Select(a => a.BatchId!.Value)
                    .ToListAsync();

                var assignedClassIds = await _dbContext.TeacherBatchAssignments
                    .Where(a => a.TeacherId == linkedTeacher.Id && a.IsActive && a.ClassId.HasValue)
                    .Select(a => a.ClassId!.Value)
                    .ToListAsync();

                var classTeacherSectionClassIds = await _dbContext.SchoolSections
                    .Where(s => s.ClassTeacherId == linkedTeacher.Id && s.IsActive)
                    .Select(s => s.ClassId)
                    .ToListAsync();

                var combinedClassIds = assignedClassIds.Concat(classTeacherSectionClassIds).Distinct().ToList();

                query = query.Where(t => t.EvaluatorTeacherId == linkedTeacher.Id ||
                                         (t.BatchId.HasValue && assignedBatchIds.Contains(t.BatchId.Value)) ||
                                         (t.ClassId.HasValue && combinedClassIds.Contains(t.ClassId.Value)));
            }
        }

        var rawList = await query.Select(t => new
        {
            t.Id,
            t.BatchId,
            BatchName = t.Batch != null ? t.Batch.Name :
                        t.Class != null ? (t.Section != null ? $"{t.Class.Name} ({t.Section.Name})" : t.Class.Name) : "General",
            t.Title,
            t.Subject,
            t.MaxMarks,
            t.TestDate,
            EvaluatedCount = t.MarksList.Count,
            t.ClassId,
            ClassName = t.Class != null ? t.Class.Name : null,
            t.SectionId,
            SectionName = t.Section != null ? t.Section.Name : null,
            t.EvaluatorTeacherId,
            EvaluatorTeacherName = t.EvaluatorTeacher != null ? t.EvaluatorTeacher.FullName : null,
            EvaluatorTeacherPhone = t.EvaluatorTeacher != null ? t.EvaluatorTeacher.PhoneNumber : null,
            EvaluationStatus = t.EvaluationStatus ?? "Scheduled",
            t.EvaluationDueDate,
            t.TotalCopiesIssued,
            t.CopiesSubmittedDate,
            t.IsMarksLocked,
            t.MarksLockedAt,
            t.MarksLockedBy,
            t.EvaluationRemarks
        }).ToListAsync();

        var list = rawList.Select(t => new TestDto(
            t.Id,
            t.BatchId,
            t.BatchName,
            t.Title,
            t.Subject,
            t.MaxMarks,
            DateTime.SpecifyKind(t.TestDate, DateTimeKind.Utc),
            t.EvaluatedCount,
            t.ClassId,
            t.ClassName,
            t.SectionId,
            t.SectionName,
            t.EvaluatorTeacherId,
            t.EvaluatorTeacherName,
            t.EvaluatorTeacherPhone,
            t.EvaluationStatus,
            t.EvaluationDueDate,
            t.TotalCopiesIssued,
            t.CopiesSubmittedDate,
            t.IsMarksLocked,
            t.MarksLockedAt,
            t.MarksLockedBy,
            t.EvaluationRemarks
        )).ToList();

        return Ok(list);
    }

    [HttpGet("paged")]
    public async Task<ActionResult<PagedResultDto<TestDto>>> GetTestsPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? searchTerm = null,
        [FromQuery] Guid? batchId = null,
        [FromQuery] Guid? classId = null,
        [FromQuery] Guid? sectionId = null,
        [FromQuery] string? category = null, // "school", "coaching", or "all"
        [FromQuery] string? batchScope = null, // "single", "combined", or "all"
        [FromQuery] string? sortBy = "testDate",
        [FromQuery] bool sortDescending = true)
    {
        var query = _dbContext.Tests.AsNoTracking()
            .Include(t => t.Batch)
            .Include(t => t.Class)
            .Include(t => t.Section)
            .Include(t => t.EvaluatorTeacher)
            .AsQueryable();

        if (category?.ToLower() == "school")
        {
            query = query.Where(t => t.ClassId.HasValue);
        }
        else if (category?.ToLower() == "coaching")
        {
            query = query.Where(t => t.BatchId.HasValue);
        }

        if (!string.IsNullOrWhiteSpace(batchScope) && !batchScope.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            if (batchScope.Equals("combined", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(t => t.BatchId.HasValue &&
                    (t.Batch.ClassId == null ||
                     t.Batch.Name.Contains("Combined") ||
                     t.Batch.Name.Contains("To") ||
                     t.Batch.Name.Contains("to") ||
                     t.Batch.Name.Contains("Foundation")));
            }
            else if (batchScope.Equals("single", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(t => !t.BatchId.HasValue ||
                    (t.Batch.ClassId != null &&
                     !t.Batch.Name.Contains("Combined") &&
                     !t.Batch.Name.Contains("To") &&
                     !t.Batch.Name.Contains("to") &&
                     !t.Batch.Name.Contains("Foundation")));
            }
        }

        if (batchId.HasValue && batchId != Guid.Empty)
            query = query.Where(t => t.BatchId == batchId);

        if (classId.HasValue && classId != Guid.Empty)
            query = query.Where(t => t.ClassId == classId);

        if (sectionId.HasValue && sectionId != Guid.Empty)
            query = query.Where(t => t.SectionId == sectionId);

        var isTeacher = _currentUser.UserRole.Contains("Teacher", StringComparison.OrdinalIgnoreCase) ||
                        _currentUser.UserRole.Contains("Faculty", StringComparison.OrdinalIgnoreCase);

        if (isTeacher)
        {
            var user = await _dbContext.Users.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);
            var linkedTeacher = await _dbContext.Teachers.AsNoTracking().FirstOrDefaultAsync(t =>
                t.TenantId == _currentUser.TenantId && (t.UserId == _currentUser.UserId || (user != null && user.Email != null && t.Email == user.Email) || (user != null && user.FullName != null && t.FullName == user.FullName)));

            if (linkedTeacher != null)
            {
                var assignedBatchIds = await _dbContext.TeacherBatchAssignments
                    .Where(a => a.TeacherId == linkedTeacher.Id && a.IsActive && a.BatchId.HasValue)
                    .Select(a => a.BatchId!.Value)
                    .ToListAsync();

                var assignedClassIds = await _dbContext.TeacherBatchAssignments
                    .Where(a => a.TeacherId == linkedTeacher.Id && a.IsActive && a.ClassId.HasValue)
                    .Select(a => a.ClassId!.Value)
                    .ToListAsync();

                var classTeacherSectionClassIds = await _dbContext.SchoolSections
                    .Where(s => s.ClassTeacherId == linkedTeacher.Id && s.IsActive)
                    .Select(s => s.ClassId)
                    .ToListAsync();

                var combinedClassIds = assignedClassIds.Concat(classTeacherSectionClassIds).Distinct().ToList();

                query = query.Where(t => t.EvaluatorTeacherId == linkedTeacher.Id ||
                                         (t.BatchId.HasValue && assignedBatchIds.Contains(t.BatchId.Value)) ||
                                         (t.ClassId.HasValue && combinedClassIds.Contains(t.ClassId.Value)));
            }
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(t =>
                t.Title.ToLower().Contains(term) ||
                t.Subject.ToLower().Contains(term) ||
                (t.Batch != null && t.Batch.Name.ToLower().Contains(term)) ||
                (t.Class != null && t.Class.Name.ToLower().Contains(term)));
        }

        query = sortBy?.ToLower() switch
        {
            "title" => sortDescending ? query.OrderByDescending(t => t.Title) : query.OrderBy(t => t.Title),
            "subject" => sortDescending ? query.OrderByDescending(t => t.Subject) : query.OrderBy(t => t.Subject),
            "maxmarks" => sortDescending ? query.OrderByDescending(t => t.MaxMarks) : query.OrderBy(t => t.MaxMarks),
            "batchname" => sortDescending 
                ? query.OrderByDescending(t => t.Batch != null ? t.Batch.Name : (t.Class != null ? t.Class.Name : "")) 
                : query.OrderBy(t => t.Batch != null ? t.Batch.Name : (t.Class != null ? t.Class.Name : "")),
            _ => sortDescending ? query.OrderByDescending(t => t.TestDate) : query.OrderBy(t => t.TestDate)
        };

        var totalCount = await query.CountAsync();
        var rawItems = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new
            {
                t.Id,
                t.BatchId,
                BatchName = t.Batch != null ? t.Batch.Name :
                            t.Class != null ? (t.Section != null ? $"{t.Class.Name} ({t.Section.Name})" : t.Class.Name) : "General",
                t.Title,
                t.Subject,
                t.MaxMarks,
                t.TestDate,
                EvaluatedCount = t.MarksList.Count,
                t.ClassId,
                ClassName = t.Class != null ? t.Class.Name : null,
                t.SectionId,
                SectionName = t.Section != null ? t.Section.Name : null,
                t.EvaluatorTeacherId,
                EvaluatorTeacherName = t.EvaluatorTeacher != null ? t.EvaluatorTeacher.FullName : null,
                EvaluatorTeacherPhone = t.EvaluatorTeacher != null ? t.EvaluatorTeacher.PhoneNumber : null,
                EvaluationStatus = t.EvaluationStatus ?? "Scheduled",
                t.EvaluationDueDate,
                t.TotalCopiesIssued,
                t.CopiesSubmittedDate,
                t.IsMarksLocked,
                t.MarksLockedAt,
                t.MarksLockedBy,
                t.EvaluationRemarks
            }).ToListAsync();

        var items = rawItems.Select(t => new TestDto(
            t.Id,
            t.BatchId,
            t.BatchName,
            t.Title,
            t.Subject,
            t.MaxMarks,
            DateTime.SpecifyKind(t.TestDate, DateTimeKind.Utc),
            t.EvaluatedCount,
            t.ClassId,
            t.ClassName,
            t.SectionId,
            t.SectionName,
            t.EvaluatorTeacherId,
            t.EvaluatorTeacherName,
            t.EvaluatorTeacherPhone,
            t.EvaluationStatus,
            t.EvaluationDueDate,
            t.TotalCopiesIssued,
            t.CopiesSubmittedDate,
            t.IsMarksLocked,
            t.MarksLockedAt,
            t.MarksLockedBy,
            t.EvaluationRemarks
        )).ToList();

        return Ok(new PagedResultDto<TestDto>(items, totalCount, pageNumber, pageSize));
    }

    [HttpPost]
    public async Task<ActionResult<TestDto>> CreateTest([FromBody] CreateTestDto dto)
    {
        var batch = await _dbContext.Batches.FindAsync(dto.BatchId);
        var targetBranchId = batch?.BranchId ?? _currentUser.BranchId;

        var test = new Test
        {
            TenantId = _currentUser.TenantId,
            BranchId = targetBranchId,
            BatchId = dto.BatchId,
            Title = dto.Title,
            Subject = dto.Subject,
            MaxMarks = dto.MaxMarks,
            PassingMarks = dto.PassingMarks > 0 ? dto.PassingMarks : 33,
            TestDate = dto.TestDate
        };

        _dbContext.Tests.Add(test);
        await _dbContext.SaveChangesAsync();

        return Ok(new TestDto(test.Id, test.BatchId, batch?.Name ?? "", test.Title, test.Subject, test.MaxMarks, DateTime.SpecifyKind(test.TestDate, DateTimeKind.Utc), 0));
    }

    [HttpPost("bulk")]
    public async Task<ActionResult<List<TestDto>>> CreateBulkTests([FromBody] List<CreateTestDto> dtos)
    {
        if (dtos == null || dtos.Count == 0)
            return BadRequest(new { message = "No exams provided." });

        if (dtos.Count > 20)
            return BadRequest(new { message = "Maximum 20 exams can be scheduled at once." });

        var strategy = _dbContext.Database.CreateExecutionStrategy();
        try
        {
            var result = await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _dbContext.Database.BeginTransactionAsync();

                var batchIds = dtos.Where(d => d.BatchId.HasValue).Select(d => d.BatchId!.Value).Distinct().ToList();
                var batches = await _dbContext.Batches
                    .Where(b => batchIds.Contains(b.Id))
                    .ToDictionaryAsync(b => b.Id, b => b);

                var classIds = dtos.Where(d => d.ClassId.HasValue).Select(d => d.ClassId!.Value).Distinct().ToList();
                var classes = await _dbContext.SchoolClasses
                    .Where(c => classIds.Contains(c.Id))
                    .ToDictionaryAsync(c => c.Id, c => c);

                var sectionIds = dtos.Where(d => d.SectionId.HasValue).Select(d => d.SectionId!.Value).Distinct().ToList();
                var sections = await _dbContext.SchoolSections
                    .Where(s => sectionIds.Contains(s.Id))
                    .ToDictionaryAsync(s => s.Id, s => s);

                var tenantId = _currentUser.TenantId != Guid.Empty
                    ? _currentUser.TenantId
                    : Guid.Parse("11111111-1111-1111-1111-111111111111");

                var tests = dtos.Select(dto => new Test
                {
                    TenantId = tenantId,
                    BranchId = (dto.BatchId.HasValue && batches.TryGetValue(dto.BatchId.Value, out var b) ? b.BranchId : null) ??
                               (dto.ClassId.HasValue && classes.TryGetValue(dto.ClassId.Value, out var c) ? c.BranchId : null) ??
                               _currentUser.BranchId,
                    BatchId = dto.BatchId,
                    ClassId = dto.ClassId,
                    SectionId = dto.SectionId,
                    Title = string.IsNullOrWhiteSpace(dto.Title) ? "Untitled Exam" : dto.Title.Trim(),
                    Subject = string.IsNullOrWhiteSpace(dto.Subject) ? "General" : dto.Subject.Trim(),
                    MaxMarks = dto.MaxMarks > 0 ? dto.MaxMarks : 100,
                    PassingMarks = dto.PassingMarks > 0 ? dto.PassingMarks : 33,
                    TestDate = dto.TestDate != default ? dto.TestDate : DateTime.UtcNow,
                    EvaluationStatus = "Scheduled"
                }).ToList();

                _dbContext.Tests.AddRange(tests);
                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync();

                return tests.Select(t => new TestDto(
                    t.Id,
                    t.BatchId,
                    t.BatchId.HasValue && batches.ContainsKey(t.BatchId.Value) ? batches[t.BatchId.Value].Name :
                    (t.ClassId.HasValue && classes.ContainsKey(t.ClassId.Value) ? 
                        (t.SectionId.HasValue && sections.ContainsKey(t.SectionId.Value) ? $"{classes[t.ClassId.Value].Name} ({sections[t.SectionId.Value].Name})" : classes[t.ClassId.Value].Name) : ""),
                    t.Title,
                    t.Subject,
                    t.MaxMarks,
                    DateTime.SpecifyKind(t.TestDate, DateTimeKind.Utc),
                    0,
                    t.ClassId,
                    t.ClassId.HasValue && classes.ContainsKey(t.ClassId.Value) ? classes[t.ClassId.Value].Name : null,
                    t.SectionId,
                    t.SectionId.HasValue && sections.ContainsKey(t.SectionId.Value) ? sections[t.SectionId.Value].Name : null
                )).ToList();
            });

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to schedule exams. Please try again.", detail = ex.Message });
        }
    }

    [HttpGet("{testId}/marks")]
    public async Task<ActionResult<List<StudentMarksEntryItem>>> GetTestMarks(Guid testId)
    {
        var marks = await _dbContext.TestMarks
            .AsNoTracking()
            .Where(m => m.TestId == testId)
            .Include(m => m.Student).ThenInclude(s => s!.Class)
            .Include(m => m.Student).ThenInclude(s => s!.Section)
            .Include(m => m.Student).ThenInclude(s => s!.Batch)
            .Select(m => new StudentMarksEntryItem(
                m.StudentId,
                m.Student != null ? m.Student.StudentName : "",
                m.Student != null ? m.Student.RollNumber : "",
                m.MarksObtained,
                m.IsAbsent,
                m.Remarks ?? "",
                m.Student != null && m.Student.Class != null ? m.Student.Class.Name : "",
                m.Student != null && m.Student.Section != null ? m.Student.Section.Name : "",
                m.Student != null && m.Student.Batch != null ? m.Student.Batch.Name : "",
                m.Student != null && m.Student.IsSchoolStudent,
                m.Student != null && m.Student.IsCoachingStudent,
                (m.Student != null && m.Student.IsSchoolStudent && m.Student.IsCoachingStudent) ? "School + Coaching" :
                (m.Student != null && m.Student.IsSchoolStudent) ? "School" :
                (m.Student != null && m.Student.IsCoachingStudent) ? "Coaching" : "General"
            ))
            .ToListAsync();

        return Ok(marks);
    }

    [HttpDelete("{testId}")]
    public async Task<ActionResult> DeleteTest(Guid testId)
    {
        var isPrivilegedAdmin = _currentUser.UserRole.Contains("Admin", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("Principal", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("Director", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("SuperAdmin", StringComparison.OrdinalIgnoreCase);

        if (!isPrivilegedAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only administrators can delete examination sessions." });
        }

        var test = await _dbContext.Tests.FirstOrDefaultAsync(t => t.Id == testId);
        if (test == null) return NotFound("Test not found");

        if (test.IsMarksLocked)
        {
            return BadRequest(new { message = "Cannot delete an examination session that is officially approved and locked. Unlock marks first if deletion is required." });
        }

        var strategy = _dbContext.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            using var transaction = await _dbContext.Database.BeginTransactionAsync();

            var marks = await _dbContext.TestMarks.Where(m => m.TestId == testId).ToListAsync();
            _dbContext.TestMarks.RemoveRange(marks);
            _dbContext.Tests.Remove(test);

            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();
        });

        return Ok(new { message = "Test and associated marks deleted successfully." });
    }

    [HttpGet("{testId}/report")]
    public async Task<ActionResult<TestReportCardDto>> GetReportCard(Guid testId)
    {
        var test = await _dbContext.Tests
            .AsNoTracking()
            .Include(t => t.Batch)
            .Include(t => t.Branch)
            .Include(t => t.MarksList)
                .ThenInclude(m => m.Student)
                    .ThenInclude(s => s!.Class)
            .Include(t => t.MarksList)
                .ThenInclude(m => m.Student)
                    .ThenInclude(s => s!.Section)
            .Include(t => t.MarksList)
                .ThenInclude(m => m.Student)
                    .ThenInclude(s => s!.Batch)
            .FirstOrDefaultAsync(t => t.Id == testId);
        if (test == null) return NotFound("Test not found");

        var rankedList = test.MarksList
            .OrderByDescending(m => m.MarksObtained)
            .Select((m, index) =>
            {
                var s = m.Student;
                var isSchool = s?.IsSchoolStudent ?? false;
                var isCoaching = s?.IsCoachingStudent ?? false;
                string enrollmentType = (isSchool && isCoaching) ? "School + Coaching" :
                                        isSchool ? "School" :
                                        isCoaching ? "Coaching" : "General";

                var displayRoll = !string.IsNullOrWhiteSpace(s?.SchoolRollNumber)
                    ? s.SchoolRollNumber
                    : (!string.IsNullOrWhiteSpace(s?.RollNumber)
                        ? s.RollNumber
                        : (!string.IsNullOrWhiteSpace(s?.AdmissionNumber) ? s.AdmissionNumber : "—"));

                return new StudentRankItem(
                    m.StudentId,
                    s?.StudentName ?? "",
                    displayRoll,
                    m.MarksObtained,
                    test.MaxMarks > 0 ? (m.MarksObtained / test.MaxMarks) * 100 : 0,
                    index + 1,
                    m.IsAbsent,
                    m.Remarks ?? "",
                    s?.ParentWhatsAppPhone ?? "",
                    s?.ParentName ?? "",
                    s?.Class?.Name ?? "",
                    s?.Section?.Name ?? "",
                    s?.Batch?.Name ?? test.Batch?.Name ?? "",
                    isSchool,
                    isCoaching,
                    enrollmentType,
                    s?.SchoolRollNumber ?? "",
                    s?.CoachingRollNumber ?? ""
                );
            }).ToList();

        return Ok(new TestReportCardDto(
            test.Id,
            test.Title,
            test.Subject,
            test.MaxMarks,
            rankedList,
            test.Batch?.Name ?? "",
            test.Branch?.Name ?? "",
            test.TestDate
        ));
    }

    [HttpGet("{testId}/admit-cards")]
    public async Task<ActionResult<ExamAdmitCardDto>> GetAdmitCards(Guid testId)
    {
        var test = await _dbContext.Tests
            .AsNoTracking()
            .Include(t => t.Batch)
            .Include(t => t.Class)
            .Include(t => t.Section)
            .Include(t => t.Branch)
            .FirstOrDefaultAsync(t => t.Id == testId);

        if (test == null) return NotFound("Test not found");

        var studentsQuery = _dbContext.Students
            .AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .Where(s => s.IsActive);

        if (test.BatchId.HasValue && test.BatchId.Value != Guid.Empty)
        {
            studentsQuery = studentsQuery.Where(s => s.BatchId == test.BatchId.Value);
        }
        else if (test.ClassId.HasValue && test.ClassId.Value != Guid.Empty)
        {
            studentsQuery = studentsQuery.Where(s => s.ClassId == test.ClassId.Value);
            if (test.SectionId.HasValue && test.SectionId.Value != Guid.Empty)
            {
                studentsQuery = studentsQuery.Where(s => s.SectionId == test.SectionId.Value);
            }
        }
        else
        {
            studentsQuery = studentsQuery.Where(s => false);
        }

        var students = await studentsQuery
            .OrderBy(s => s.RollNumber)
            .ToListAsync();

        var studentIds = students.Select(s => s.Id).ToList();

        var duesMap = await _dbContext.FeeInvoices
            .AsNoTracking()
            .Where(i => studentIds.Contains(i.StudentId) && i.Status != InvoiceStatus.Cancelled)
            .GroupBy(i => i.StudentId)
            .Select(g => new
            {
                StudentId = g.Key,
                TotalDue = g.Sum(i => i.TotalAmount - i.PaidAmount)
            })
            .ToDictionaryAsync(x => x.StudentId, x => x.TotalDue);

        var examDateUtc = DateTime.SpecifyKind(test.TestDate, DateTimeKind.Utc);
        var branchName = test.Branch?.Name ?? "Main Campus";

        TimeZoneInfo istZone;
        try
        {
            istZone = TimeZoneInfo.FindSystemTimeZoneById(OperatingSystem.IsWindows() ? "India Standard Time" : "Asia/Kolkata");
        }
        catch
        {
            istZone = TimeZoneInfo.CreateCustomTimeZone("IST", TimeSpan.FromHours(5.5), "India Standard Time", "IST");
        }

        var examDateIst = TimeZoneInfo.ConvertTimeFromUtc(examDateUtc, istZone);
        var reportingTime = examDateIst.AddMinutes(-15).ToString("hh:mm tt");

        string targetGroupName = test.Batch?.Name ??
            (test.Class != null
                ? (test.Section != null ? $"{test.Class.Name} ({test.Section.Name})" : test.Class.Name)
                : "General");

        var studentCards = students.Select(s =>
        {
            var due = duesMap.TryGetValue(s.Id, out var d) ? d : 0m;
            var isFeeCleared = due <= 0;
            var displayRoll = !string.IsNullOrWhiteSpace(s.SchoolRollNumber)
                ? s.SchoolRollNumber
                : (!string.IsNullOrWhiteSpace(s.RollNumber)
                    ? s.RollNumber
                    : (!string.IsNullOrWhiteSpace(s.AdmissionNumber) ? s.AdmissionNumber : "001"));
            var examRoll = $"EXAM-{displayRoll}";

            string studentGroupName = s.Batch?.Name ??
                (s.Class != null
                    ? (s.Section != null ? $"{s.Class.Name} - {s.Section.Name}" : s.Class.Name)
                    : targetGroupName);

            return new StudentAdmitCardItemDto(
                s.Id,
                s.StudentName,
                displayRoll,
                studentGroupName,
                s.ParentName ?? "",
                s.ParentWhatsAppPhone ?? "",
                s.ProfilePhoto,
                due,
                isFeeCleared,
                examRoll,
                branchName,
                reportingTime,
                "1 Hour 30 Mins"
            );
        }).ToList();

        return Ok(new ExamAdmitCardDto(
            test.Id,
            test.Title,
            test.Subject,
            examDateUtc,
            test.MaxMarks,
            targetGroupName,
            branchName,
            studentCards
        ));
    }

    [HttpPost("bulk-marks")]
    public async Task<ActionResult> SaveBulkMarks([FromBody] BulkSaveMarksDto dto)
    {
        var test = await _dbContext.Tests.FirstOrDefaultAsync(t => t.Id == dto.TestId);
        if (test == null) return NotFound("Test not found");

        var isPrivilegedAdmin = _currentUser.UserRole.Contains("Admin", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("Principal", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("Director", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("SuperAdmin", StringComparison.OrdinalIgnoreCase);

        if (test.IsMarksLocked && !isPrivilegedAdmin)
        {
            return BadRequest(new { message = "Marks for this exam have been officially approved and locked by the Principal/Administrator. Editing is prohibited." });
        }

        if (!isPrivilegedAdmin)
        {
            if (!test.EvaluatorTeacherId.HasValue)
            {
                return BadRequest(new { message = "Answer sheets bundle has not yet been assigned by the administrator / exam coordinator." });
            }

            var user = await _dbContext.Users.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(u => u.Id == _currentUser.UserId);
            var linkedTeacher = await _dbContext.Teachers.AsNoTracking().FirstOrDefaultAsync(t =>
                t.TenantId == _currentUser.TenantId && (t.UserId == _currentUser.UserId || (user != null && user.Email != null && t.Email == user.Email) || (user != null && user.FullName != null && t.FullName == user.FullName)));

            if (linkedTeacher != null && test.EvaluatorTeacherId.Value != linkedTeacher.Id)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "You are not designated as the evaluator teacher for this exam bundle." });
            }
        }

        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<ActionResult>(async () =>
        {
            using var transaction = await _dbContext.Database.BeginTransactionAsync();

            var existing = await _dbContext.TestMarks.Where(m => m.TestId == dto.TestId).ToListAsync();
            _dbContext.TestMarks.RemoveRange(existing);
            await _dbContext.SaveChangesAsync();

            var sorted = dto.MarksList.OrderByDescending(m => m.IsAbsent ? -1 : m.MarksObtained).ToList();

            var entities = new List<TestMarks>();
            int currentRank = 1;

            var tenantId = _currentUser.TenantId != Guid.Empty ? _currentUser.TenantId : test.TenantId;

            foreach (var item in sorted)
            {
                var entity = new TestMarks
                {
                    TenantId = tenantId,
                    TestId = dto.TestId,
                    StudentId = item.StudentId,
                    MarksObtained = item.IsAbsent ? 0 : item.MarksObtained,
                    IsAbsent = item.IsAbsent,
                    Remarks = item.Remarks,
                    Rank = item.IsAbsent ? 0 : currentRank
                };

                entities.Add(entity);

                if (!item.IsAbsent) currentRank++;
            }

            if (dto.NotifyParentsViaWhatsApp)
            {
                var studentResults = new List<(string Name, decimal Marks, int Rank, bool Absent)>();

                foreach (var item in sorted)
                {
                    var entity = entities.First(e => e.StudentId == item.StudentId);
                    var student = await _dbContext.Students.FindAsync(item.StudentId);
                    if (student != null)
                    {
                        studentResults.Add((student.StudentName, item.MarksObtained, entity.Rank, item.IsAbsent));

                        if (!string.IsNullOrEmpty(student.ParentWhatsAppPhone))
                        {
                            await _whatsAppService.SendTestMarksReportAsync(
                                tenantId,
                                student.ParentWhatsAppPhone,
                                student.StudentName,
                                test.Title,
                                item.MarksObtained,
                                test.MaxMarks,
                                entity.Rank
                            );
                        }
                    }
                }

                // Automated Class WhatsApp Group Result Announcement
                var testClass = test.ClassId.HasValue ? await _dbContext.SchoolClasses.FindAsync(test.ClassId.Value) : null;
                var testBatch = test.BatchId.HasValue ? await _dbContext.Batches.FindAsync(test.BatchId.Value) : null;
                var groupTitle = testClass?.Name ?? testBatch?.Name ?? "Class Group";

                var sb = new System.Text.StringBuilder();
                sb.AppendLine($"📢 *AUTOMATED CLASS TEST RESULT: {test.Title.ToUpper()}*");
                sb.AppendLine($"• Subject: *{test.Subject}*");
                sb.AppendLine($"• Class / Batch: *{groupTitle}*");
                sb.AppendLine($"• Max Marks: *{test.MaxMarks}*");
                sb.AppendLine();
                sb.AppendLine($"🏆 *Class Scorecard / Leaderboard:*");

                foreach (var r in studentResults.OrderBy(s => s.Absent ? 1 : 0).ThenBy(s => s.Rank))
                {
                    if (r.Absent)
                        sb.AppendLine($"• {r.Name}: _ABSENT_");
                    else
                        sb.AppendLine($"• Rank #{r.Rank}: {r.Name} — *{r.Marks}/{test.MaxMarks}*");
                }

                sb.AppendLine();
                sb.AppendLine($"Congratulations to all students! Detailed report cards have been dispatched to parents.");

                _dbContext.WhatsAppLogs.Add(new WhatsAppLog
                {
                    TenantId = tenantId,
                    RecipientPhone = "CLASS-WHATSAPP-GROUP",
                    StudentName = groupTitle,
                    MessageType = MessageType.Announcement,
                    Content = sb.ToString().TrimEnd(),
                    Status = "Delivered",
                    SentAt = DateTime.UtcNow
                });
            }

            _dbContext.TestMarks.AddRange(entities);

            if (test.EvaluationStatus == "Scheduled" || test.EvaluationStatus == "CopiesUnderEvaluation" || test.EvaluationStatus == "EvaluationCompleted" || test.EvaluationStatus == "NeedsRevision")
            {
                test.EvaluationStatus = "MarksEntered";
            }

            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new { message = $"Successfully saved marks for {entities.Count} students.", whatsappSent = dto.NotifyParentsViaWhatsApp });
        });
    }

    [HttpPut("{testId}/evaluation-workflow")]
    public async Task<ActionResult<object>> UpdateEvaluationWorkflow(Guid testId, [FromBody] UpdateTestEvaluationWorkflowDto dto)
    {
        var test = await _dbContext.Tests.FirstOrDefaultAsync(t => t.Id == testId);
        if (test == null) return NotFound(new { message = "Test not found." });

        var isPrivilegedAdmin = _currentUser.UserRole.Contains("Admin", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("Principal", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("Director", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("SuperAdmin", StringComparison.OrdinalIgnoreCase);

        if (!isPrivilegedAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only administrators and exam coordinators can assign copy bundles to faculty." });
        }

        if (test.IsMarksLocked)
        {
            return BadRequest(new { message = "Exam marks are locked. Cannot alter evaluation assignments." });
        }

        if (dto.EvaluatorTeacherId.HasValue && dto.EvaluatorTeacherId.Value != Guid.Empty)
        {
            var teacher = await _dbContext.Teachers.FindAsync(dto.EvaluatorTeacherId.Value);
            if (teacher == null) return NotFound(new { message = "Assigned teacher not found." });

            var isFnFSettled = await _dbContext.TeacherFnFSettlements.AnyAsync(s => s.TeacherId == dto.EvaluatorTeacherId.Value && (s.Status == "Settled" || s.Status == "Approved" || s.Status == "Completed"));
            if (isFnFSettled)
            {
                return BadRequest(new { message = $"Cannot assign copies to '{teacher.FullName}'. This faculty member has already completed Full & Final (FNF) settlement." });
            }
        }

        if (dto.EvaluationDueDate.HasValue && test.TestDate != default)
        {
            var examDateUtc = DateTime.SpecifyKind(test.TestDate, DateTimeKind.Utc).Date;
            var dueDateUtc = DateTime.SpecifyKind(dto.EvaluationDueDate.Value, DateTimeKind.Utc).Date;
            if (dueDateUtc < examDateUtc)
            {
                return BadRequest(new { message = $"Evaluation due date cannot be earlier than the examination date ({examDateUtc:yyyy-MM-dd})." });
            }
        }

        test.EvaluatorTeacherId = dto.EvaluatorTeacherId ?? test.EvaluatorTeacherId;

        if (!string.IsNullOrWhiteSpace(dto.EvaluationStatus))
        {
            var st = dto.EvaluationStatus.Trim();
            if (st.Equals("Evaluating", StringComparison.OrdinalIgnoreCase))
                test.EvaluationStatus = "CopiesUnderEvaluation";
            else if (st.Equals("CopiesReturned", StringComparison.OrdinalIgnoreCase))
                test.EvaluationStatus = "EvaluationCompleted";
            else
                test.EvaluationStatus = st;
        }
        else
        {
            test.EvaluationStatus = test.EvaluationStatus ?? "Scheduled";
        }

        test.EvaluationDueDate = dto.EvaluationDueDate ?? test.EvaluationDueDate;
        test.TotalCopiesIssued = dto.TotalCopiesIssued ?? test.TotalCopiesIssued;
        test.CopiesSubmittedDate = dto.CopiesSubmittedDate ?? test.CopiesSubmittedDate;
        test.EvaluationRemarks = dto.EvaluationRemarks ?? test.EvaluationRemarks;

        if (dto.CopiesSubmittedDate.HasValue && (test.EvaluationStatus == "CopiesUnderEvaluation" || test.EvaluationStatus == "Scheduled" || test.EvaluationStatus == "Evaluating"))
        {
            test.EvaluationStatus = "EvaluationCompleted";
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "Evaluation bundle workflow updated successfully.",
            evaluationStatus = test.EvaluationStatus,
            evaluatorTeacherId = test.EvaluatorTeacherId,
            totalCopiesIssued = test.TotalCopiesIssued,
            evaluationDueDate = test.EvaluationDueDate,
            copiesSubmittedDate = test.CopiesSubmittedDate
        });
    }

    [HttpPut("{testId}/submit-for-approval")]
    public async Task<ActionResult<object>> SubmitForApproval(Guid testId)
    {
        var test = await _dbContext.Tests.Include(t => t.MarksList).FirstOrDefaultAsync(t => t.Id == testId);
        if (test == null) return NotFound(new { message = "Test not found." });

        if (test.MarksList.Count == 0)
        {
            return BadRequest(new { message = "Cannot submit for approval without entering student marks first." });
        }

        if (test.IsMarksLocked)
        {
            return BadRequest(new { message = "Marks are already locked and approved." });
        }

        test.EvaluationStatus = "SubmittedForApproval";
        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "Marks submitted to Principal / Exam Cell for final verification and approval.",
            evaluationStatus = test.EvaluationStatus
        });
    }

    [HttpPut("{testId}/approve-and-lock")]
    public async Task<ActionResult<object>> ApproveAndLockMarks(Guid testId, [FromBody] ApproveAndLockTestMarksDto dto)
    {
        var isPrivilegedAdmin = _currentUser.UserRole.Contains("Admin", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("Principal", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("Director", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("SuperAdmin", StringComparison.OrdinalIgnoreCase);

        if (!isPrivilegedAdmin)
        {
            return StatusCode(403, new { message = "Unauthorized: Only Principal or Institute Administrator can officially approve and lock examination results." });
        }

        var test = await _dbContext.Tests.Include(t => t.MarksList).FirstOrDefaultAsync(t => t.Id == testId);
        if (test == null) return NotFound(new { message = "Test not found." });

        if (test.MarksList.Count == 0)
        {
            return BadRequest(new { message = "Cannot approve an exam with zero student marks." });
        }

        test.IsMarksLocked = true;
        test.EvaluationStatus = "MarksLocked";
        test.MarksLockedBy = User?.Identity?.Name ?? _currentUser.UserRole ?? "Principal / Admin";
        test.MarksLockedAt = DateTime.UtcNow;

        if (!string.IsNullOrWhiteSpace(dto?.Remarks))
        {
            test.EvaluationRemarks = string.IsNullOrWhiteSpace(test.EvaluationRemarks)
                ? $"Approved by {test.MarksLockedBy}: {dto.Remarks}"
                : $"{test.EvaluationRemarks} | Approved: {dto.Remarks}";
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "Examination marks verified, officially approved, and locked. Results are now finalized.",
            evaluationStatus = test.EvaluationStatus,
            isMarksLocked = test.IsMarksLocked,
            lockedBy = test.MarksLockedBy,
            lockedAt = test.MarksLockedAt
        });
    }

    [HttpPut("{testId}/unlock-marks")]
    public async Task<ActionResult<object>> UnlockMarks(Guid testId, [FromBody] RejectTestMarksDto dto)
    {
        var isPrivilegedAdmin = _currentUser.UserRole.Contains("Admin", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("Principal", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("Director", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("SuperAdmin", StringComparison.OrdinalIgnoreCase);

        if (!isPrivilegedAdmin)
        {
            return StatusCode(403, new { message = "Unauthorized: Only Principal or Administrator can unlock officially approved marks." });
        }

        var test = await _dbContext.Tests.FirstOrDefaultAsync(t => t.Id == testId);
        if (test == null) return NotFound(new { message = "Test not found." });

        test.IsMarksLocked = false;
        test.EvaluationStatus = "NeedsRevision";
        test.MarksLockedBy = null;
        test.MarksLockedAt = null;

        if (!string.IsNullOrWhiteSpace(dto?.Reason))
        {
            test.EvaluationRemarks = string.IsNullOrWhiteSpace(test.EvaluationRemarks)
                ? $"Unlocked for revision: {dto.Reason}"
                : $"{test.EvaluationRemarks} | Unlocked: {dto.Reason}";
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "Exam marks unlocked for revision.",
            evaluationStatus = test.EvaluationStatus,
            isMarksLocked = test.IsMarksLocked
        });
    }

    [HttpPut("{testId}/reject-revision")]
    public async Task<ActionResult<object>> RejectForRevision(Guid testId, [FromBody] RejectTestMarksDto dto)
    {
        var isPrivilegedAdmin = _currentUser.UserRole.Contains("Admin", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("Principal", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("Director", StringComparison.OrdinalIgnoreCase) ||
                                _currentUser.UserRole.Contains("SuperAdmin", StringComparison.OrdinalIgnoreCase);

        if (!isPrivilegedAdmin)
        {
            return StatusCode(403, new { message = "Unauthorized: Only Principal or Administrator can reject marks for revision." });
        }

        var test = await _dbContext.Tests.FirstOrDefaultAsync(t => t.Id == testId);
        if (test == null) return NotFound(new { message = "Test not found." });

        test.EvaluationStatus = "NeedsRevision";
        test.IsMarksLocked = false;
        test.EvaluationRemarks = !string.IsNullOrWhiteSpace(dto.Reason)
            ? $"Revision Requested: {dto.Reason}"
            : "Revision requested by Exam Cell / Principal.";

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "Marks returned to evaluator teacher for re-checking / revision.",
            evaluationStatus = test.EvaluationStatus,
            evaluationRemarks = test.EvaluationRemarks
        });
    }

    [HttpGet("{testId}/award-sheet")]
    public async Task<ActionResult<TestAwardSheetDto>> GetAwardSheet(Guid testId)
    {
        var test = await _dbContext.Tests
            .AsNoTracking()
            .Include(t => t.Batch)
            .Include(t => t.Class)
            .Include(t => t.Section)
            .Include(t => t.EvaluatorTeacher)
            .FirstOrDefaultAsync(t => t.Id == testId);

        if (test == null) return NotFound(new { message = "Test not found." });

        List<TestAwardSheetItemDto> studentItems;

        if (test.BatchId.HasValue && test.BatchId.Value != Guid.Empty)
        {
            studentItems = await _dbContext.Students
                .AsNoTracking()
                .Where(s => s.BatchId == test.BatchId.Value && s.IsActive)
                .OrderBy(s => s.RollNumber)
                .Select(s => new TestAwardSheetItemDto(
                    s.Id,
                    s.RollNumber,
                    s.StudentName,
                    test.Batch != null ? test.Batch.Name : "Batch"
                ))
                .ToListAsync();
        }
        else if (test.ClassId.HasValue && test.ClassId.Value != Guid.Empty)
        {
            var q = _dbContext.Students.AsNoTracking().Where(s => s.ClassId == test.ClassId.Value && s.IsActive);
            if (test.SectionId.HasValue && test.SectionId.Value != Guid.Empty)
                q = q.Where(s => s.SectionId == test.SectionId.Value);

            studentItems = await q
                .OrderBy(s => s.RollNumber)
                .Select(s => new TestAwardSheetItemDto(
                    s.Id,
                    s.RollNumber,
                    s.StudentName,
                    test.Class != null ? test.Class.Name : "Class"
                ))
                .ToListAsync();
        }
        else
        {
            studentItems = new List<TestAwardSheetItemDto>();
        }

        var batchOrClassName = test.Batch != null ? test.Batch.Name :
                               test.Class != null ? (test.Section != null ? $"{test.Class.Name} - {test.Section.Name}" : test.Class.Name) : "General";

        var result = new TestAwardSheetDto(
            test.Id,
            test.Title,
            test.Subject,
            test.MaxMarks,
            test.TestDate,
            batchOrClassName,
            test.EvaluatorTeacher?.FullName ?? "Unassigned",
            test.EvaluatorTeacher?.PhoneNumber ?? "N/A",
            test.EvaluationDueDate,
            test.TotalCopiesIssued ?? studentItems.Count,
            studentItems
        );

        return Ok(result);
    }
}
