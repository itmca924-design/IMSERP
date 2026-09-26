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

        // If no invoices exist yet, auto-seed default invoices for active students starting from their Joining Date
        if (!await query.AnyAsync())
        {
            var students = await _dbContext.Students.Include(s => s.Batch).ToListAsync();
            var random = new Random();
            var sampleInvoices = new List<FeeInvoice>();

            foreach (var s in students)
            {
                var feeRate = s.Batch?.StandardMonthlyFee ?? 3500m;
                var joinMonth = s.JoiningDate.Month;
                var joinYear = s.JoiningDate.Year;

                var inv = new FeeInvoice
                {
                    TenantId = _currentUser.TenantId,
                    StudentId = s.Id,
                    InvoiceNumber = $"INV-{joinYear}{joinMonth:D2}-{random.Next(100, 999)}",
                    Title = $"{s.JoiningDate:MMMM yyyy} Tuition Fee",
                    TotalAmount = feeRate,
                    PaidAmount = 0,
                    DueDate = new DateTime(joinYear, joinMonth, Math.Min(10, DateTime.DaysInMonth(joinYear, joinMonth))),
                    Status = InvoiceStatus.Pending,
                    CreatedAt = s.JoiningDate
                };
                inv.Items.Add(new FeeInvoiceItem
                {
                    TenantId = _currentUser.TenantId,
                    HeadName = "Tuition Fee",
                    Amount = feeRate,
                    PaidAmount = 0
                });
                sampleInvoices.Add(inv);
            }

            if (sampleInvoices.Count > 0)
            {
                _dbContext.FeeInvoices.AddRange(sampleInvoices);
                await _dbContext.SaveChangesAsync();
                query = _dbContext.FeeInvoices
                    .AsNoTracking()
                    .Where(i => i.TenantId == tenantId)
                    .Include(i => i.Student)
                        .ThenInclude(s => s.Batch)
                    .Include(i => i.Student)
                        .ThenInclude(s => s.Class)
                    .Include(i => i.Student)
                        .ThenInclude(s => s.Section)
                    .AsSplitQuery()
                    .AsQueryable();
            }
        }

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
                i.Items.Select(it => new FeeInvoiceItemDto(it.Id, it.InvoiceId, it.FeeHeadId, it.HeadName, it.Amount, it.PaidAmount)).ToList(),
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
            i.Items.Select(it => new FeeInvoiceItemDto(it.Id, it.InvoiceId, it.FeeHeadId, it.HeadName, it.Amount, it.PaidAmount)).ToList()
        )).ToList();

        var paymentDtos = payments.Select(p => new StudentLedgerPaymentItemDto(
            p.Id,
            p.ReceiptNumber,
            paymentsMap.TryGetValue(p.Id, out var invNo) ? invNo : "",
            p.AmountPaid,
            p.Mode,
            p.TransactionRef,
            p.Remarks,
            DateTime.SpecifyKind(p.PaymentDate, DateTimeKind.Utc)
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
            ledgerBranchName
        ));
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
        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<ActionResult<FeePaymentReceiptDto>>(async () =>
        {
            var now = DateTime.UtcNow;
            using var transaction = await _dbContext.Database.BeginTransactionAsync();

            var student = await _dbContext.Students
                .Include(s => s.Branch)
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
                        if (dto.ItemPayments != null && dto.ItemPayments.Count > 0)
                        {
                            var itemPaymentDict = dto.ItemPayments.ToDictionary(p => p.ItemId, p => p.Amount);
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
                        if (itemPaymentDict != null)
                        {
                            foreach (var it in inv.Items)
                            {
                                if (itemPaymentDict.TryGetValue(it.Id, out var itPaidAmt) && itPaidAmt > 0)
                                {
                                    lineItems.Add(new FeeReceiptLineItemDto(
                                        lineItems.Count + 1,
                                        it.HeadName,
                                        inv.Title,
                                        inv.InvoiceNumber,
                                        itPaidAmt
                                    ));
                                }
                            }
                        }
                        else
                        {
                            decimal remainingInvAlloc = allocAmt;
                            var itemsList = inv.Items.ToList();
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
                                    itShare = inv.TotalAmount > 0
                                        ? Math.Round(allocAmt * (it.Amount / inv.TotalAmount), 2)
                                        : it.Amount;
                                    if (itShare > remainingInvAlloc) itShare = remainingInvAlloc;
                                }
                                remainingInvAlloc -= itShare;

                                if (itShare > 0)
                                {
                                    lineItems.Add(new FeeReceiptLineItemDto(
                                        lineItems.Count + 1,
                                        it.HeadName,
                                        inv.Title,
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
                collectBranchName
            ));
        });
    }

    [HttpGet("receipt/{receiptNumber}")]
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
            .Where(p => p.ReceiptNumber == receiptNumber)
            .ToListAsync();

        var circulations = await _dbContext.LibraryCirculations
            .AsNoTracking()
            .Include(c => c.BookCopy)
                .ThenInclude(bc => bc!.Book)
            .Include(c => c.Student)
                .ThenInclude(s => s!.Batch)
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

        var lineItems = new List<FeeReceiptLineItemDto>();
        if (totalTuitionPaid > 0)
        {
            foreach (var p in payments)
            {
                if (p.Invoice?.Items != null && p.Invoice.Items.Count > 0)
                {
                    decimal remainingAlloc = p.AmountPaid;
                    var itemsList = p.Invoice.Items.ToList();
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
                            itShare = p.Invoice.TotalAmount > 0
                                ? Math.Round(p.AmountPaid * (it.Amount / p.Invoice.TotalAmount), 2)
                                : it.Amount;
                            if (itShare > remainingAlloc) itShare = remainingAlloc;
                        }
                        remainingAlloc -= itShare;

                        if (itShare > 0)
                        {
                            lineItems.Add(new FeeReceiptLineItemDto(
                                lineItems.Count + 1,
                                it.HeadName,
                                p.Invoice.Title,
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
            firstPayment?.Branch?.Name ?? firstPayment?.Invoice?.Branch?.Name ?? student?.Branch?.Name ?? student?.Batch?.Branch?.Name ?? (await _dbContext.Branches.AsNoTracking().Where(b => b.TenantId == (student != null ? student.TenantId : _currentUser.TenantId) && b.IsActive).OrderByDescending(b => b.IsMainBranch).FirstOrDefaultAsync())?.Name
        ));
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
            i.Items.Select(it => new FeeInvoiceItemDto(it.Id, it.InvoiceId, it.FeeHeadId, it.HeadName, it.Amount, it.PaidAmount)).ToList()
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
        [FromQuery] int? year = null)
    {
        var targetMonth = month ?? DateTime.UtcNow.Month;
        var targetYear = year ?? DateTime.UtcNow.Year;
        var tenantId = _currentUser.TenantId;

        // Window for the target month
        var periodStart = new DateTime(targetYear, targetMonth, 1);
        var periodEnd = periodStart.AddMonths(1).AddDays(-1);

        // Student IDs that already have an invoice for this month
        var invoicedStudentIds = await _dbContext.FeeInvoices
            .Where(i => i.TenantId == tenantId &&
                        i.DueDate >= periodStart && i.DueDate <= periodEnd &&
                        i.Status != InvoiceStatus.Cancelled)
            .Select(i => i.StudentId)
            .Distinct()
            .ToListAsync();

        // Active students who DO NOT have an invoice for this month
        var pendingStudents = await _dbContext.Students
            .AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Batch)
            .Where(s => s.TenantId == tenantId && s.IsActive && !invoicedStudentIds.Contains(s.Id))
            .OrderByDescending(s => s.JoiningDate)
            .Select(s => new PendingInvoicingStudentDto(
                s.Id,
                s.StudentName,
                s.RollNumber,
                s.AdmissionNumber,
                s.ClassId,
                s.Class != null ? s.Class.Name : null,
                s.BatchId,
                s.Batch != null ? s.Batch.Name : null,
                s.JoiningDate,
                s.Batch != null ? s.Batch.StandardMonthlyFee : 3500m
            ))
            .ToListAsync();

        return Ok(pendingStudents);
    }

    [HttpPost("generate-monthly-invoices")]
    public async Task<ActionResult<GenerateMonthlyInvoicesResultDto>> GenerateMonthlyInvoices([FromBody] GenerateMonthlyInvoicesRequestDto dto)
    {
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

        var students = await studentsQuery.ToListAsync();
        if (students.Count == 0)
        {
            return Ok(new GenerateMonthlyInvoicesResultDto(0, 0, "No active students found for the selected criteria."));
        }

        // Determine cycle length in months (enum value equals month multiplier)
        int cycleMonths = (int)dto.BillingCycle;

        // Build period start/end for the invoice window
        var periodStart = new DateTime(dto.Year, dto.Month, 1);
        var periodEnd = periodStart.AddMonths(cycleMonths).AddDays(-1);

        // Build a readable title for the billing cycle period
        string cycleLabel = dto.BillingCycle switch
        {
            BillingCycle.Quarterly   => "Quarterly",
            BillingCycle.HalfYearly  => "Half-Yearly",
            BillingCycle.Yearly      => "Yearly",
            _                        => "Monthly"
        };

        string periodLabel = cycleMonths == 1
            ? periodStart.ToString("MMMM yyyy", System.Globalization.CultureInfo.InvariantCulture)
            : $"{periodStart:MMMM yyyy} – {periodEnd:MMMM yyyy}";

        // Duplicate check: find all active invoices within the current billing window (ignore cancelled invoices)
        // Check StudentId + ClassId so that promoting a student to a higher class allows fresh billing for the new class
        var existingStudentInvoices = await _dbContext.FeeInvoices
            .Where(i => i.DueDate >= periodStart && i.DueDate <= periodEnd && i.Status != InvoiceStatus.Cancelled)
            .Select(i => new { i.StudentId, i.ClassId })
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

        // Resolve Standard & Residential FeeHead IDs by Code (HOSTEL / MESS / COACH / TUI / LIB / TRANS)
        var standardHeads = await _dbContext.FeeHeads
            .AsNoTracking()
            .Where(h => h.IsActive && (h.Code == "HOSTEL" || h.Code == "MESS" || h.Code == "COACH" || h.Code == "TUI" || h.Code == "LIB" || h.Code == "TRANS"))
            .ToListAsync();

        var hostelFeeHeadId = standardHeads.FirstOrDefault(h => h.Code == "HOSTEL")?.Id;
        var messFeeHeadId   = standardHeads.FirstOrDefault(h => h.Code == "MESS")?.Id;
        var coachFeeHead    = standardHeads.FirstOrDefault(h => h.Code == "COACH");
        var tuiFeeHead      = standardHeads.FirstOrDefault(h => h.Code == "TUI");
        var libFeeHeadId    = standardHeads.FirstOrDefault(h => h.Code == "LIB")?.Id;
        var transFeeHeadId  = standardHeads.FirstOrDefault(h => h.Code == "TRANS")?.Id;

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
        // ────────────────────────────────────────────────────────────────────

        var newInvoices = new List<FeeInvoice>();
        int skippedCount = 0;
        var random = new Random();

        foreach (var s in students)
        {
            bool alreadyBilled = existingStudentInvoices.Any(e => e.StudentId == s.Id && (e.ClassId == null || e.ClassId == s.ClassId));
            if (alreadyBilled)
            {
                skippedCount++;
                continue;
            }

            var studentStructures = feeStructures
                .Where(cfs => (s.ClassId.HasValue && cfs.ClassId == s.ClassId.Value) ||
                              (s.BatchId.HasValue && cfs.BatchId == s.BatchId.Value))
                .ToList();

            var applicableHeads = studentStructures
                .Where(cfs => cfs.ApplicableMonth == null || cfs.ApplicableMonth == dto.Month)
                .ToList();

            var invoiceItems = new List<FeeInvoiceItem>();
            decimal totalAmount = 0;

            if (applicableHeads.Count > 0)
            {
                foreach (var head in applicableHeads)
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
                    decimal headAmount = isRecurring ? (head.Amount * cycleMonths) : head.Amount;
                    totalAmount += headAmount;

                    invoiceItems.Add(new FeeInvoiceItem
                    {
                        TenantId = _currentUser.TenantId,
                        FeeHeadId = head.FeeHeadId,
                        HeadName = head.FeeHead?.Name ?? "Fee Head",
                        Amount = headAmount,
                        PaidAmount = 0
                    });
                }
            }
            else
            {
                // Fallback: If no fee structure is configured in ClassFeeStructures
                if (s.ClassId.HasValue && s.BatchId.HasValue)
                {
                    // Dual-enrolled: School + Coaching
                    var schoolRate = 2500m * cycleMonths;
                    totalAmount += schoolRate;
                    invoiceItems.Add(new FeeInvoiceItem
                    {
                        TenantId = _currentUser.TenantId,
                        FeeHeadId = tuiFeeHead?.Id,
                        HeadName = tuiFeeHead?.Name ?? "School Tuition Fee",
                        Amount = schoolRate,
                        PaidAmount = 0
                    });

                    var coachingRate = (s.Batch?.StandardMonthlyFee ?? 1500m) * cycleMonths;
                    totalAmount += coachingRate;
                    invoiceItems.Add(new FeeInvoiceItem
                    {
                        TenantId = _currentUser.TenantId,
                        FeeHeadId = coachFeeHead?.Id,
                        HeadName = coachFeeHead?.Name ?? "Coaching Fee",
                        Amount = coachingRate,
                        PaidAmount = 0
                    });
                }
                else
                {
                    var isCoaching = s.BatchId.HasValue && !s.ClassId.HasValue;
                    var fallbackHeadName = isCoaching ? (coachFeeHead?.Name ?? "Coaching Fee") : (tuiFeeHead?.Name ?? "School Tuition Fee");
                    var fallbackHeadId = isCoaching ? coachFeeHead?.Id : tuiFeeHead?.Id;
                    var monthlyRate = s.Batch?.StandardMonthlyFee ?? 3500m;
                    totalAmount = monthlyRate * cycleMonths;
                    invoiceItems.Add(new FeeInvoiceItem
                    {
                        TenantId = _currentUser.TenantId,
                        FeeHeadId = fallbackHeadId,
                        HeadName = fallbackHeadName,
                        Amount = totalAmount,
                        PaidAmount = 0
                    });
                }
            }

            // Dual-enrollment safeguard: ensure Coaching Fee is present if student is enrolled in a Coaching Batch
            bool hasCoachingHead = invoiceItems.Any(i => i.HeadName.Contains("Coaching", StringComparison.OrdinalIgnoreCase));
            if (s.BatchId.HasValue && !hasCoachingHead && (s.Batch?.StandardMonthlyFee ?? 0) > 0)
            {
                var coachingRate = (s.Batch?.StandardMonthlyFee ?? 0) * cycleMonths;
                if (coachingRate > 0)
                {
                    totalAmount += coachingRate;
                    invoiceItems.Add(new FeeInvoiceItem
                    {
                        TenantId = _currentUser.TenantId,
                        FeeHeadId = coachFeeHead?.Id,
                        HeadName = coachFeeHead?.Name ?? "Coaching Fee",
                        Amount = coachingRate,
                        PaidAmount = 0
                    });
                }
            }

            // Dual-enrollment safeguard: ensure School Tuition Fee is present if student is enrolled in a School Class
            bool hasSchoolHead = invoiceItems.Any(i => i.HeadName.Contains("Tuition", StringComparison.OrdinalIgnoreCase) || i.HeadName.Contains("School", StringComparison.OrdinalIgnoreCase));
            if (s.ClassId.HasValue && !hasSchoolHead)
            {
                var schoolRate = 2500m * cycleMonths;
                totalAmount += schoolRate;
                invoiceItems.Add(new FeeInvoiceItem
                {
                    TenantId = _currentUser.TenantId,
                    FeeHeadId = tuiFeeHead?.Id,
                    HeadName = tuiFeeHead?.Name ?? "School Tuition Fee",
                    Amount = schoolRate,
                    PaidAmount = 0
                });
            }

            // ── Inject Hostel Charges (if this student has an active bed allocation) ──
            if (allocationByStudent.TryGetValue(s.Id, out var allocation))
            {
                var bedLabel  = allocation.Bed?.BedCode ?? "Bed";
                var roomLabel = allocation.Bed?.Room?.RoomNumber ?? "Room";
                var hostelLabel = allocation.Bed?.Room?.Hostel?.Name ?? "Hostel";

                if (allocation.MonthlyRent > 0)
                {
                    decimal rentAmount = allocation.MonthlyRent * cycleMonths;
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
                    decimal messAmount = allocation.MonthlyMessFee * cycleMonths;
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
                decimal libAmount = s.MonthlyLibraryFee * cycleMonths;
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
                decimal transAmount = transportAlloc.MonthlyFare * cycleMonths;
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

            // Unique invoice number encodes the cycle type
            var cycleSuffix = dto.BillingCycle switch
            {
                BillingCycle.Quarterly  => "Q",
                BillingCycle.HalfYearly => "H",
                BillingCycle.Yearly     => "Y",
                _                       => ""
            };

            var invoice = new FeeInvoice
            {
                TenantId      = _currentUser.TenantId,
                BranchId      = s.BranchId ?? s.Batch?.BranchId ?? _currentUser.BranchId,
                StudentId     = s.Id,
                ClassId       = s.ClassId,
                ClassName     = s.Class?.Name,
                SectionId     = s.SectionId,
                SectionName   = s.Section?.Name,
                InvoiceNumber = $"INV-{dto.Year}{dto.Month:D2}{cycleSuffix}-{random.Next(100, 999)}",
                Title         = $"{periodLabel} Fee ({cycleLabel})",
                TotalAmount   = totalAmount,
                PaidAmount    = 0,
                DueDate       = dto.DueDate,
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

        string msg;
        string invoiceWord = newInvoices.Count == 1 ? "invoice" : "invoices";

        if (newInvoices.Count > 0 && skippedCount == 0)
        {
            msg = $"Successfully generated {newInvoices.Count} {cycleLabel} {invoiceWord} for {periodLabel}.";
        }
        else if (newInvoices.Count > 0 && skippedCount > 0)
        {
            msg = $"Successfully generated {newInvoices.Count} {cycleLabel} {invoiceWord} for {periodLabel}. ({skippedCount} already existed and were skipped).";
        }
        else
        {
            msg = $"All enrolled students already have {cycleLabel} invoices for {periodLabel}. No new invoices were needed.";
        }

        return Ok(new GenerateMonthlyInvoicesResultDto(
            newInvoices.Count,
            skippedCount,
            msg
        ));
    }

    [HttpPost("cancel-invoice/{invoiceId}")]
    public async Task<ActionResult> CancelInvoice(Guid invoiceId, [FromBody] CancelInvoiceDto dto)
    {
        var invoice = await _dbContext.FeeInvoices
            .Include(i => i.Student)
            .FirstOrDefaultAsync(i => i.Id == invoiceId);

        if (invoice == null) return NotFound("Invoice not found.");

        if (invoice.Status == InvoiceStatus.Paid)
            return BadRequest(new { message = "A fully paid invoice cannot be cancelled. Reverse the payment first if needed." });

        if (invoice.Status == InvoiceStatus.Cancelled)
            return BadRequest(new { message = "This invoice is already cancelled." });

        if (invoice.PaidAmount > 0)
            return BadRequest(new { message = "This invoice has partial payment recorded and cannot be cancelled directly. Please contact admin for reversal." });

        invoice.Status = InvoiceStatus.Cancelled;
        invoice.CancellationReason = string.IsNullOrWhiteSpace(dto.Reason) ? "No reason provided" : dto.Reason.Trim();
        invoice.CancelledAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = $"Invoice {invoice.InvoiceNumber} has been cancelled successfully.",
            invoiceId = invoice.Id,
            reason = invoice.CancellationReason,
            cancelledAt = invoice.CancelledAt
        });
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

        // Hard delete the payment record
        _dbContext.FeePayments.Remove(payment);

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

        return Ok(new ReversePaymentResponseDto(
            $"Payment {payment.ReceiptNumber} has been reversed successfully. Invoice {invoice.InvoiceNumber} updated.",
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

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "Class fee structures saved successfully." });
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
    public async Task<ActionResult<IEnumerable<TestDto>>> GetTests([FromQuery] Guid? batchId)
    {
        var query = _dbContext.Tests.AsNoTracking()
            .Include(t => t.Batch)
            .Include(t => t.Class)
            .Include(t => t.Section)
            .AsQueryable();

        if (batchId.HasValue && batchId != Guid.Empty)
        {
            query = query.Where(t => t.BatchId == batchId);
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
            SectionName = t.Section != null ? t.Section.Name : null
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
            t.SectionName
        )).ToList();

        return Ok(list);
    }

    [HttpGet("paged")]
    public async Task<ActionResult<PagedResultDto<TestDto>>> GetTestsPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? searchTerm = null,
        [FromQuery] Guid? batchId = null,
        [FromQuery] string? sortBy = "testDate",
        [FromQuery] bool sortDescending = true)
    {
        var query = _dbContext.Tests.AsNoTracking()
            .Include(t => t.Batch)
            .Include(t => t.Class)
            .Include(t => t.Section)
            .AsQueryable();

        if (batchId.HasValue && batchId != Guid.Empty)
            query = query.Where(t => t.BatchId == batchId);

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
                SectionName = t.Section != null ? t.Section.Name : null
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
            t.SectionName
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

                var batchIds = dtos.Select(d => d.BatchId).Distinct().ToList();
                var batches = await _dbContext.Batches
                    .Where(b => batchIds.Contains(b.Id))
                    .ToDictionaryAsync(b => b.Id, b => b);

                var tenantId = _currentUser.TenantId != Guid.Empty
                    ? _currentUser.TenantId
                    : Guid.Parse("11111111-1111-1111-1111-111111111111");

                var tests = dtos.Select(dto => new Test
                {
                    TenantId = tenantId,
                    BranchId = (dto.BatchId.HasValue && batches.TryGetValue(dto.BatchId.Value, out var b) ? b.BranchId : null) ?? _currentUser.BranchId,
                    BatchId = dto.BatchId,
                    Title = string.IsNullOrWhiteSpace(dto.Title) ? "Untitled Exam" : dto.Title.Trim(),
                    Subject = string.IsNullOrWhiteSpace(dto.Subject) ? "General" : dto.Subject.Trim(),
                    MaxMarks = dto.MaxMarks > 0 ? dto.MaxMarks : 100,
                    TestDate = dto.TestDate != default ? dto.TestDate : DateTime.UtcNow
                }).ToList();

                _dbContext.Tests.AddRange(tests);
                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync();

                return tests.Select(t => new TestDto(
                    t.Id,
                    t.BatchId,
                    t.BatchId.HasValue && batches.ContainsKey(t.BatchId.Value) ? batches[t.BatchId.Value].Name : "",
                    t.Title,
                    t.Subject,
                    t.MaxMarks,
                    DateTime.SpecifyKind(t.TestDate, DateTimeKind.Utc),
                    0
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
        var test = await _dbContext.Tests.FirstOrDefaultAsync(t => t.Id == testId);
        if (test == null) return NotFound("Test not found");

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

                return new StudentRankItem(
                    m.StudentId,
                    s?.StudentName ?? "",
                    s?.RollNumber ?? "",
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
            .Include(t => t.Branch)
            .FirstOrDefaultAsync(t => t.Id == testId);

        if (test == null) return NotFound("Test not found");

        var students = await _dbContext.Students
            .AsNoTracking()
            .Where(s => s.BatchId == test.BatchId && s.IsActive)
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

        var studentCards = students.Select(s =>
        {
            var due = duesMap.TryGetValue(s.Id, out var d) ? d : 0m;
            var isFeeCleared = due <= 0;
            var examRoll = $"EXAM-{s.RollNumber}";

            return new StudentAdmitCardItemDto(
                s.Id,
                s.StudentName,
                s.RollNumber,
                test.Batch?.Name ?? "",
                s.ParentName,
                s.ParentWhatsAppPhone,
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
            test.Batch?.Name ?? "",
            branchName,
            studentCards
        ));
    }

    [HttpPost("bulk-marks")]
    public async Task<ActionResult> SaveBulkMarks([FromBody] BulkSaveMarksDto dto)
    {
        var test = await _dbContext.Tests.FirstOrDefaultAsync(t => t.Id == dto.TestId);
        if (test == null) return NotFound("Test not found");

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

                if (dto.NotifyParentsViaWhatsApp)
                {
                    var student = await _dbContext.Students.FindAsync(item.StudentId);
                    if (student != null && !string.IsNullOrEmpty(student.ParentWhatsAppPhone))
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

            _dbContext.TestMarks.AddRange(entities);
            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new { message = $"Successfully saved marks for {entities.Count} students.", whatsappSent = dto.NotifyParentsViaWhatsApp });
        });
    }
}
