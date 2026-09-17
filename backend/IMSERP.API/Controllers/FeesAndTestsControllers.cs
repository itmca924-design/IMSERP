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
        [FromQuery] string? status = null,
        [FromQuery] string? sortBy = "dueDate",
        [FromQuery] bool sortDescending = true)
    {
        var query = _dbContext.FeeInvoices
            .AsNoTracking()
            .Include(i => i.Student)
            .ThenInclude(s => s.Batch)
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

                // Current Month Invoice (from Joining Date)
                sampleInvoices.Add(new FeeInvoice
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
                });
            }

            if (sampleInvoices.Count > 0)
            {
                _dbContext.FeeInvoices.AddRange(sampleInvoices);
                await _dbContext.SaveChangesAsync();
                query = _dbContext.FeeInvoices
                    .AsNoTracking()
                    .Include(i => i.Student)
                    .ThenInclude(s => s.Batch)
                    .AsQueryable();
            }
        }

        // Filtering
        if (batchId.HasValue && batchId != Guid.Empty)
        {
            query = query.Where(i => i.Student != null && i.Student.BatchId == batchId.Value);
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
                i.Title.ToLower().Contains(term)
            );
        }

        // Sorting
        query = (sortBy?.ToLower()) switch
        {
            "studentname" => sortDescending ? query.OrderByDescending(i => i.Student!.StudentName) : query.OrderBy(i => i.Student!.StudentName),
            "invoicenumber" => sortDescending ? query.OrderByDescending(i => i.InvoiceNumber) : query.OrderBy(i => i.InvoiceNumber),
            "totalamount" => sortDescending ? query.OrderByDescending(i => i.TotalAmount) : query.OrderBy(i => i.TotalAmount),
            "dueamount" => sortDescending ? query.OrderByDescending(i => i.TotalAmount - i.PaidAmount) : query.OrderBy(i => i.TotalAmount - i.PaidAmount),
            "status" => sortDescending ? query.OrderByDescending(i => i.Status) : query.OrderBy(i => i.Status),
            _ => sortDescending ? query.OrderByDescending(i => i.DueDate) : query.OrderBy(i => i.DueDate)
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
                i.TotalAmount - i.PaidAmount,
                i.DueDate,
                i.Status.ToString()
            ))
            .ToListAsync();

        return Ok(new PagedResultDto<FeeInvoicePagedItemDto>(items, totalCount, pageNumber, pageSize));
    }

    [HttpGet("student-ledger/{studentId}")]
    public async Task<ActionResult<StudentLedgerDto>> GetStudentLedger(Guid studentId)
    {
        var student = await _dbContext.Students
            .AsNoTracking()
            .Include(s => s.Batch)
            .FirstOrDefaultAsync(s => s.Id == studentId);

        if (student == null) return NotFound("Student not found");

        var invoices = await _dbContext.FeeInvoices
            .AsNoTracking()
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
            i.TotalAmount - i.PaidAmount,
            i.DueDate,
            i.Status.ToString()
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
            paymentDtos
        ));
    }

    [HttpPost("collect-fifo")]
    public async Task<ActionResult<FeePaymentReceiptDto>> CollectFeeFifo([FromBody] CollectFifoFeeDto dto)
    {
        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<ActionResult<FeePaymentReceiptDto>>(async () =>
        {
            using var transaction = await _dbContext.Database.BeginTransactionAsync();

            var student = await _dbContext.Students
                .Include(s => s.Batch)
                .FirstOrDefaultAsync(s => s.Id == dto.StudentId);

            if (student == null) return NotFound("Student not found");

            // Fetch unpaid/partial invoices chronologically (FIFO by DueDate) — skip Cancelled
            var unpaidInvoices = await _dbContext.FeeInvoices
                .Where(i => i.StudentId == dto.StudentId
                         && i.Status != InvoiceStatus.Paid
                         && i.Status != InvoiceStatus.Cancelled)
                .OrderBy(i => i.DueDate)
                .ToListAsync();

            if (unpaidInvoices.Count == 0)
            {
                return BadRequest(new { message = "This student has zero outstanding due fees!" });
            }

            decimal remainingToAllocate = dto.AmountPaid;
            var receiptNo = "REC-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss");
            FeePayment? lastPayment = null;

            foreach (var inv in unpaidInvoices)
            {
                if (remainingToAllocate <= 0) break;

                decimal invoiceDue = inv.TotalAmount - inv.PaidAmount;
                decimal allocateForThisInv = Math.Min(remainingToAllocate, invoiceDue);

                inv.PaidAmount += allocateForThisInv;
                if (inv.PaidAmount >= inv.TotalAmount)
                {
                    inv.Status = InvoiceStatus.Paid;
                }
                else
                {
                    inv.Status = InvoiceStatus.Partial;
                }

                remainingToAllocate -= allocateForThisInv;

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

            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            // Calculate remaining total outstanding balance — exclude Cancelled invoices
            var totalOutstandingDue = await _dbContext.FeeInvoices
                .Where(i => i.StudentId == dto.StudentId && i.Status != InvoiceStatus.Cancelled)
                .SumAsync(i => i.TotalAmount - i.PaidAmount);

            if (dto.SendWhatsAppReceipt && student != null)
            {
                await _whatsAppService.SendFeeReceiptAsync(
                    _currentUser.TenantId,
                    student.ParentWhatsAppPhone,
                    student.StudentName,
                    receiptNo,
                    dto.AmountPaid,
                    totalOutstandingDue
                );
            }

            return Ok(new FeePaymentReceiptDto(
                lastPayment?.Id ?? Guid.NewGuid(),
                receiptNo,
                student.StudentName,
                student.RollNumber,
                student.Batch?.Name ?? "",
                student.ParentName,
                student.ParentWhatsAppPhone,
                "FIFO Multi-Invoice Settlement",
                dto.AmountPaid,
                totalOutstandingDue,
                DateTime.UtcNow,
                dto.Mode,
                dto.TransactionRef,
                dto.Remarks
            ));
        });
    }

    [HttpGet("receipt/{receiptNumber}")]
    public async Task<ActionResult<FeePaymentReceiptDto>> GetReceiptByNumber(string receiptNumber)
    {
        var payment = await _dbContext.FeePayments
            .AsNoTracking()
            .Include(p => p.Invoice)
                .ThenInclude(i => i!.Student)
                    .ThenInclude(s => s!.Batch)
            .FirstOrDefaultAsync(p => p.ReceiptNumber == receiptNumber);

        if (payment == null) return NotFound("Receipt not found");

        var student = payment.Invoice?.Student;
        var remainingDue = student != null
            ? await _dbContext.FeeInvoices
                .Where(i => i.StudentId == student.Id && i.Status != InvoiceStatus.Cancelled)
                .SumAsync(i => i.TotalAmount - i.PaidAmount)
            : 0m;

        return Ok(new FeePaymentReceiptDto(
            payment.Id,
            payment.ReceiptNumber,
            student?.StudentName ?? "",
            student?.RollNumber ?? "",
            student?.Batch?.Name ?? "",
            student?.ParentName ?? "",
            student?.ParentWhatsAppPhone ?? "",
            payment.Invoice?.InvoiceNumber ?? "",
            payment.AmountPaid,
            remainingDue,
            DateTime.SpecifyKind(payment.PaymentDate, DateTimeKind.Utc),
            payment.Mode,
            payment.TransactionRef,
            payment.Remarks
        ));
    }

    [HttpGet("due-slip/{studentId}")]
    public async Task<ActionResult<FeeDueSlipDto>> GetDueSlip(Guid studentId, [FromQuery] Guid? invoiceId = null)
    {
        var student = await _dbContext.Students
            .AsNoTracking()
            .Include(s => s.Batch)
            .FirstOrDefaultAsync(s => s.Id == studentId);

        if (student == null) return NotFound("Student not found");

        var query = _dbContext.FeeInvoices
            .AsNoTracking()
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
            i.TotalAmount - i.PaidAmount
        )).ToList();

        var totalDue = items.Sum(i => i.DueAmount);

        return Ok(new FeeDueSlipDto(
            student.Id,
            student.StudentName,
            student.RollNumber,
            student.Batch?.Name ?? "",
            student.ParentName,
            student.ParentWhatsAppPhone,
            totalDue,
            DateTime.UtcNow,
            items
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

    [HttpPost("generate-monthly-invoices")]
    public async Task<ActionResult<GenerateMonthlyInvoicesResultDto>> GenerateMonthlyInvoices([FromBody] GenerateMonthlyInvoicesRequestDto dto)
    {
        if (dto.Year < 2020 || dto.Year > 2050 || dto.Month < 1 || dto.Month > 12)
        {
            return BadRequest("Invalid year or month.");
        }

        var studentsQuery = _dbContext.Students
            .Include(s => s.Batch)
            .AsQueryable();

        if (dto.BatchId.HasValue && dto.BatchId != Guid.Empty)
        {
            studentsQuery = studentsQuery.Where(s => s.BatchId == dto.BatchId.Value);
        }

        var students = await studentsQuery.ToListAsync();
        if (students.Count == 0)
        {
            return Ok(new GenerateMonthlyInvoicesResultDto(0, 0, "No active students found for the selected batch."));
        }

        var targetMonthDate = new DateTime(dto.Year, dto.Month, 1);
        var monthName = targetMonthDate.ToString("MMMM yyyy", System.Globalization.CultureInfo.InvariantCulture);

        var existingInvoices = await _dbContext.FeeInvoices
            .Where(i => i.DueDate.Year == dto.Year && i.DueDate.Month == dto.Month)
            .Select(i => i.StudentId)
            .ToListAsync();

        var existingStudentIds = new HashSet<Guid>(existingInvoices);
        var newInvoices = new List<FeeInvoice>();
        int skippedCount = 0;
        var random = new Random();

        foreach (var s in students)
        {
            if (existingStudentIds.Contains(s.Id))
            {
                skippedCount++;
                continue;
            }

            var feeRate = s.Batch?.StandardMonthlyFee ?? 3500m;
            var invoice = new FeeInvoice
            {
                TenantId = _currentUser.TenantId,
                BranchId = s.BranchId ?? s.Batch?.BranchId ?? _currentUser.BranchId,
                StudentId = s.Id,
                InvoiceNumber = $"INV-{dto.Year}{dto.Month:D2}-{random.Next(100, 999)}",
                Title = $"{monthName} Tuition Fee",
                TotalAmount = feeRate,
                PaidAmount = 0,
                DueDate = dto.DueDate,
                Status = InvoiceStatus.Pending,
                CreatedAt = DateTime.UtcNow
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
            msg = $"Successfully generated {newInvoices.Count} {invoiceWord} for {monthName}.";
        }
        else if (newInvoices.Count > 0 && skippedCount > 0)
        {
            msg = $"Successfully generated {newInvoices.Count} {invoiceWord} for {monthName}. ({skippedCount} already existed and were skipped).";
        }
        else
        {
            msg = $"All enrolled students already have invoices for {monthName}. No new invoices were needed.";
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
        var query = _dbContext.Tests.AsNoTracking().Include(t => t.Batch).AsQueryable();

        if (batchId.HasValue && batchId != Guid.Empty)
        {
            query = query.Where(t => t.BatchId == batchId);
        }

        var rawList = await query.Select(t => new
        {
            t.Id,
            t.BatchId,
            BatchName = t.Batch != null ? t.Batch.Name : "",
            t.Title,
            t.Subject,
            t.MaxMarks,
            t.TestDate,
            EvaluatedCount = t.MarksList.Count
        }).ToListAsync();

        var list = rawList.Select(t => new TestDto(
            t.Id,
            t.BatchId,
            t.BatchName,
            t.Title,
            t.Subject,
            t.MaxMarks,
            DateTime.SpecifyKind(t.TestDate, DateTimeKind.Utc),
            t.EvaluatedCount
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
        var query = _dbContext.Tests.AsNoTracking().Include(t => t.Batch).AsQueryable();

        if (batchId.HasValue && batchId != Guid.Empty)
            query = query.Where(t => t.BatchId == batchId);

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.Trim().ToLower();
            query = query.Where(t =>
                t.Title.ToLower().Contains(term) ||
                t.Subject.ToLower().Contains(term) ||
                (t.Batch != null && t.Batch.Name.ToLower().Contains(term)));
        }

        query = sortBy?.ToLower() switch
        {
            "title" => sortDescending ? query.OrderByDescending(t => t.Title) : query.OrderBy(t => t.Title),
            "subject" => sortDescending ? query.OrderByDescending(t => t.Subject) : query.OrderBy(t => t.Subject),
            "maxmarks" => sortDescending ? query.OrderByDescending(t => t.MaxMarks) : query.OrderBy(t => t.MaxMarks),
            "batchname" => sortDescending ? query.OrderByDescending(t => t.Batch!.Name) : query.OrderBy(t => t.Batch!.Name),
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
                BatchName = t.Batch != null ? t.Batch.Name : "",
                t.Title,
                t.Subject,
                t.MaxMarks,
                t.TestDate,
                EvaluatedCount = t.MarksList.Count
            }).ToListAsync();

        var items = rawItems.Select(t => new TestDto(
            t.Id,
            t.BatchId,
            t.BatchName,
            t.Title,
            t.Subject,
            t.MaxMarks,
            DateTime.SpecifyKind(t.TestDate, DateTimeKind.Utc),
            t.EvaluatedCount
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
                    BranchId = (batches.TryGetValue(dto.BatchId, out var b) ? b.BranchId : null) ?? _currentUser.BranchId,
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
                    batches.TryGetValue(t.BatchId, out var b) ? b.Name : "",
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
            .Include(m => m.Student)
            .Select(m => new StudentMarksEntryItem(
                m.StudentId,
                m.Student != null ? m.Student.StudentName : "",
                m.Student != null ? m.Student.RollNumber : "",
                m.MarksObtained,
                m.IsAbsent,
                m.Remarks ?? ""
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
        var test = await _dbContext.Tests.Include(t => t.MarksList).ThenInclude(m => m.Student).FirstOrDefaultAsync(t => t.Id == testId);
        if (test == null) return NotFound("Test not found");

        var rankedList = test.MarksList
            .OrderByDescending(m => m.MarksObtained)
            .Select((m, index) => new StudentRankItem(
                m.StudentId,
                m.Student?.StudentName ?? "",
                m.Student?.RollNumber ?? "",
                m.MarksObtained,
                test.MaxMarks > 0 ? (m.MarksObtained / test.MaxMarks) * 100 : 0,
                index + 1,
                m.IsAbsent,
                m.Remarks ?? ""
            )).ToList();

        return Ok(new TestReportCardDto(test.Id, test.Title, test.Subject, test.MaxMarks, rankedList));
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
