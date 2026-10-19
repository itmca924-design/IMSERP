using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FinanceController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;

    public FinanceController(IIMSERPDbContext dbContext, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    // =========================================================================
    // 1. PROFIT & LOSS STATEMENT (INCOME & EXPENDITURE)
    // =========================================================================

    // =========================================================================
    // 1. PROFIT & LOSS STATEMENT (INCOME & EXPENDITURE)
    // =========================================================================

    [HttpGet("profit-loss")]
    public async Task<ActionResult<ProfitLossReportDto>> GetProfitLoss(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] string? financialYear = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] string? academicScope = "All")
    {
        var tenantId = _currentUser.TenantId;
        DateTime start;
        DateTime end;
        string scope = string.IsNullOrWhiteSpace(academicScope) ? "All" : academicScope.Trim();

        // 1. Determine Date Range
        if (!string.IsNullOrWhiteSpace(financialYear) && financialYear.Contains('-'))
        {
            var parts = financialYear.Split('-');
            if (int.TryParse(parts[0], out int startYear) && int.TryParse(parts[1], out int endYear))
            {
                start = new DateTime(startYear, 4, 1, 0, 0, 0, DateTimeKind.Utc);
                end = new DateTime(endYear, 3, 31, 23, 59, 59, DateTimeKind.Utc);
            }
            else
            {
                var now = DateTime.UtcNow;
                int currentYear = now.Month >= 4 ? now.Year : now.Year - 1;
                start = new DateTime(currentYear, 4, 1, 0, 0, 0, DateTimeKind.Utc);
                end = new DateTime(currentYear + 1, 3, 31, 23, 59, 59, DateTimeKind.Utc);
                financialYear = $"{currentYear}-{currentYear + 1}";
            }
        }
        else if (fromDate.HasValue && toDate.HasValue)
        {
            start = DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Utc);
            end = DateTime.SpecifyKind(toDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
            financialYear = $"{start.Year}-{end.Year}";
        }
        else
        {
            var now = DateTime.UtcNow;
            int currentYear = now.Month >= 4 ? now.Year : now.Year - 1;
            start = new DateTime(currentYear, 4, 1, 0, 0, 0, DateTimeKind.Utc);
            end = new DateTime(currentYear + 1, 3, 31, 23, 59, 59, DateTimeKind.Utc);
            financialYear = $"{currentYear}-{currentYear + 1}";
        }

        // Branch Details
        string branchName = "All Branches Consolidated";
        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            var branch = await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == branchId.Value);
            if (branch != null) branchName = branch.Name;
        }

        // 2. Query Fee Payments with Scope & Branch Filters
        var feePaymentsQuery = _dbContext.FeePayments
            .AsNoTracking()
            .Include(p => p.Invoice)
                .ThenInclude(i => i!.Items)
            .Include(p => p.Invoice)
                .ThenInclude(i => i!.Student)
            .Where(p => p.TenantId == tenantId && !p.IsReversed && p.PaymentDate >= start && p.PaymentDate <= end);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            feePaymentsQuery = feePaymentsQuery.Where(p => p.BranchId == branchId.Value || (p.Invoice != null && p.Invoice.BranchId == branchId.Value));
        }

        if (scope.Equals("School", StringComparison.OrdinalIgnoreCase))
        {
            feePaymentsQuery = feePaymentsQuery.Where(p => p.Invoice != null && (
                p.Invoice.InvoiceCategory == "School" ||
                p.Invoice.InvoiceCategory == "Integrated" ||
                (p.Invoice.InvoiceCategory != "Coaching" && (p.Invoice.ClassId != null || (p.Invoice.Student != null && (p.Invoice.Student.IsSchoolStudent || p.Invoice.Student.ClassId != null))))
            ));
        }
        else if (scope.Equals("Coaching", StringComparison.OrdinalIgnoreCase))
        {
            feePaymentsQuery = feePaymentsQuery.Where(p => p.Invoice != null && (
                p.Invoice.InvoiceCategory == "Coaching" ||
                p.Invoice.InvoiceCategory == "Integrated" ||
                (p.Invoice.InvoiceCategory != "School" && (p.Invoice.Student != null && (p.Invoice.Student.IsCoachingStudent || p.Invoice.Student.BatchId != null)))
            ));
        }

        var feePayments = await feePaymentsQuery.ToListAsync();
        decimal realizedFeeCollections = feePayments.Sum(p => p.AmountPaid);

        // 3. Query Invoices Billed in This Period for Accrual Revenue & Receivables
        var periodInvoicesQuery = _dbContext.FeeInvoices
            .AsNoTracking()
            .Include(i => i.Items)
            .Include(i => i.Student)
            .Where(i => i.TenantId == tenantId && i.CreatedAt >= start && i.CreatedAt <= end && i.Status != InvoiceStatus.Cancelled);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            periodInvoicesQuery = periodInvoicesQuery.Where(i => i.BranchId == branchId.Value);
        }

        if (scope.Equals("School", StringComparison.OrdinalIgnoreCase))
        {
            periodInvoicesQuery = periodInvoicesQuery.Where(i => 
                i.InvoiceCategory == "School" || 
                i.InvoiceCategory == "Integrated" ||
                (i.InvoiceCategory != "Coaching" && (i.ClassId != null || (i.Student != null && (i.Student.IsSchoolStudent || i.Student.ClassId != null))))
            );
        }
        else if (scope.Equals("Coaching", StringComparison.OrdinalIgnoreCase))
        {
            periodInvoicesQuery = periodInvoicesQuery.Where(i => 
                i.InvoiceCategory == "Coaching" || 
                i.InvoiceCategory == "Integrated" ||
                (i.InvoiceCategory != "School" && (i.Student != null && (i.Student.IsCoachingStudent || i.Student.BatchId != null)))
            );
        }

        var periodInvoices = await periodInvoicesQuery.ToListAsync();
        decimal totalBilledPeriodInvoices = periodInvoices.Sum(i => i.TotalAmount);
        decimal accruedFeeReceivables = Math.Max(0m, periodInvoices.Sum(i => i.TotalAmount - i.PaidAmount));

        // 4. Query Library Fines Collected in Period
        decimal libraryFinesIncome = 0m;
        if (!scope.Equals("Coaching", StringComparison.OrdinalIgnoreCase))
        {
            var libFinesQuery = _dbContext.LibraryCirculations
                .AsNoTracking()
                .Where(c => c.TenantId == tenantId && c.FineStatus == "Paid" && c.FineAmount > 0 &&
                            ((c.FinePaidAt.HasValue && c.FinePaidAt.Value >= start && c.FinePaidAt.Value <= end) ||
                             (!c.FinePaidAt.HasValue && c.CreatedAt >= start && c.CreatedAt <= end)));

            if (branchId.HasValue && branchId.Value != Guid.Empty)
            {
                libFinesQuery = libFinesQuery.Where(c => c.BranchId == branchId.Value);
            }

            libraryFinesIncome = await libFinesQuery.SumAsync(c => (decimal?)c.FineAmount) ?? 0m;
        }

        decimal totalRealizedCollections = realizedFeeCollections + libraryFinesIncome;
        // Total Direct Earned Income (Accrual basis: Total Billed Fees + Library fines collected)
        // If no invoices were generated yet but payments exist, ensure totalDirectIncome >= realizedCollections
        decimal totalDirectIncome = Math.Max(totalRealizedCollections, totalBilledPeriodInvoices + libraryFinesIncome);

        // 5. Intelligent Multi-Division Income Head Categorization
        var incomeMap = new Dictionary<string, (decimal Amount, string Category, string Division)>(StringComparer.OrdinalIgnoreCase);

        // Process from period invoices items (or fee payments if no invoice items)
        if (periodInvoices.Count > 0)
        {
            foreach (var inv in periodInvoices)
            {
                string division = (inv.ClassId.HasValue && inv.Student?.BatchId != null) ? "Integrated Division" :
                                  (inv.ClassId.HasValue || (inv.Student?.IsSchoolStudent ?? false) || inv.InvoiceCategory == "School") ? "School Division" :
                                  (inv.Student?.IsCoachingStudent ?? true || inv.InvoiceCategory == "Coaching") ? "Coaching Division" : "Institutional";

                if (inv.Items != null && inv.Items.Count > 0)
                {
                    foreach (var item in inv.Items)
                    {
                        string head = string.IsNullOrWhiteSpace(item.HeadName) ? "Tuition Fee" : item.HeadName.Trim();
                        string category = CategorizeIncomeHead(head, division);

                        if (incomeMap.TryGetValue(head, out var val))
                            incomeMap[head] = (val.Amount + item.Amount, category, division);
                        else
                            incomeMap[head] = (item.Amount, category, division);
                    }
                }
                else
                {
                    string head = !string.IsNullOrWhiteSpace(inv.Title) ? inv.Title : $"{division} Academic Fee";
                    string category = CategorizeIncomeHead(head, division);
                    if (incomeMap.TryGetValue(head, out var val))
                        incomeMap[head] = (val.Amount + inv.TotalAmount, category, division);
                    else
                        incomeMap[head] = (inv.TotalAmount, category, division);
                }
            }
        }
        else
        {
            // Fallback from fee payments
            foreach (var p in feePayments)
            {
                string division = (p.Invoice?.ClassId != null || (p.Invoice?.Student?.IsSchoolStudent ?? false)) ? "School Division" : "Coaching Division";
                if (p.Invoice?.Items != null && p.Invoice.Items.Count > 0)
                {
                    decimal invTotal = p.Invoice.TotalAmount > 0 ? p.Invoice.TotalAmount : 1m;
                    foreach (var it in p.Invoice.Items)
                    {
                        string head = string.IsNullOrWhiteSpace(it.HeadName) ? "Tuition Fee" : it.HeadName.Trim();
                        decimal proportional = Math.Round((it.Amount / invTotal) * p.AmountPaid, 2);
                        string category = CategorizeIncomeHead(head, division);
                        if (incomeMap.TryGetValue(head, out var val))
                            incomeMap[head] = (val.Amount + proportional, category, division);
                        else
                            incomeMap[head] = (proportional, category, division);
                    }
                }
                else
                {
                    string head = p.Invoice?.InvoiceCategory ?? "Academic Fees";
                    string category = CategorizeIncomeHead(head, division);
                    if (incomeMap.TryGetValue(head, out var val))
                        incomeMap[head] = (val.Amount + p.AmountPaid, category, division);
                    else
                        incomeMap[head] = (p.AmountPaid, category, division);
                }
            }
        }

        // Add Library Fines to income breakdown if collected
        if (libraryFinesIncome > 0)
        {
            incomeMap["Library Overdue Fines & Late Return Charges"] = (
                libraryFinesIncome,
                "Library & Resource Center",
                "Learning Resource"
            );
        }

        if (incomeMap.Count == 0 && totalDirectIncome > 0)
        {
            incomeMap["Academic Tuition Fee"] = (totalDirectIncome, "Academic Fees", "General Institutional");
        }

        decimal sumIncomeMap = incomeMap.Values.Sum(x => x.Amount);
        var incomeSummaryList = incomeMap.Select(kv => new IncomeHeadSummaryDto(
            Category: kv.Value.Category,
            HeadName: kv.Key,
            Amount: kv.Value.Amount,
            PercentageOfTotal: sumIncomeMap > 0 ? Math.Round((kv.Value.Amount / sumIncomeMap) * 100m, 1) : 0m,
            Division: kv.Value.Division
        )).OrderByDescending(x => x.Amount).ToList();

        // 6. Query Payroll Expenses from TeacherSalaryPayments
        var salaryPaymentsQuery = _dbContext.TeacherSalaryPayments
            .AsNoTracking()
            .Include(s => s.Teacher)
            .Where(s => s.TenantId == tenantId && s.PaymentDate >= start && s.PaymentDate <= end);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            salaryPaymentsQuery = salaryPaymentsQuery.Where(s => s.Teacher != null && s.Teacher.BranchId == branchId.Value);
        }

        if (scope.Equals("School", StringComparison.OrdinalIgnoreCase))
        {
            salaryPaymentsQuery = salaryPaymentsQuery.Where(s => s.Teacher != null && s.Teacher.Department != "Coaching");
        }
        else if (scope.Equals("Coaching", StringComparison.OrdinalIgnoreCase))
        {
            salaryPaymentsQuery = salaryPaymentsQuery.Where(s => s.Teacher != null && s.Teacher.Department == "Coaching");
        }

        var salaryPayments = await salaryPaymentsQuery.ToListAsync();
        // GrossAmount is the real economic payroll expense incurred by the institution
        decimal totalPayrollExpense = salaryPayments.Sum(s => s.GrossAmount > 0 ? s.GrossAmount : s.NetPaid);

        // 7. Query Operating Expenses from ExpenseVouchers
        var vouchersQuery = _dbContext.ExpenseVouchers
            .AsNoTracking()
            .Include(v => v.Category)
            .Where(v => v.TenantId == tenantId && v.ExpenseDate >= start && v.ExpenseDate <= end);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            vouchersQuery = vouchersQuery.Where(v => v.BranchId == branchId.Value);
        }

        var vouchers = await vouchersQuery.ToListAsync();
        decimal totalOperatingExpense = vouchers.Sum(v => v.Amount);
        decimal totalExpense = totalPayrollExpense + totalOperatingExpense;

        // Group Expenses
        var expenseSummaryList = new List<ExpenseHeadSummaryDto>();

        if (totalPayrollExpense > 0)
        {
            expenseSummaryList.Add(new ExpenseHeadSummaryDto(
                Category: "Payroll & Human Resources",
                HeadName: "Faculty & Staff Gross Salaries (incl. statutory withholdings)",
                Amount: totalPayrollExpense,
                PercentageOfTotal: totalExpense > 0 ? Math.Round((totalPayrollExpense / totalExpense) * 100m, 1) : 0m,
                IsPayroll: true
            ));
        }

        var groupedVouchers = vouchers
            .GroupBy(v => v.Category != null ? v.Category.Name : "General Operating Expenses")
            .OrderByDescending(g => g.Sum(x => x.Amount));

        foreach (var g in groupedVouchers)
        {
            decimal sum = g.Sum(x => x.Amount);
            expenseSummaryList.Add(new ExpenseHeadSummaryDto(
                Category: "Operational Expenses",
                HeadName: g.Key,
                Amount: sum,
                PercentageOfTotal: totalExpense > 0 ? Math.Round((sum / totalExpense) * 100m, 1) : 0m,
                IsPayroll: false
            ));
        }

        // 8. Monthly Surplus Trend (12 Months)
        var monthlyTrends = new List<MonthlySurplusTrendDto>();
        var curMonth = new DateTime(start.Year, start.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        while (curMonth <= end)
        {
            int yr = curMonth.Year;
            int mo = curMonth.Month;
            string monthLabel = curMonth.ToString("MMM yyyy", CultureInfo.InvariantCulture);

            decimal monthBilled = periodInvoices
                .Where(i => i.CreatedAt.Year == yr && i.CreatedAt.Month == mo)
                .Sum(i => i.TotalAmount);

            decimal monthRealized = feePayments
                .Where(p => p.PaymentDate.Year == yr && p.PaymentDate.Month == mo)
                .Sum(p => p.AmountPaid);

            decimal monthIncome = Math.Max(monthRealized, monthBilled);

            decimal monthPayroll = salaryPayments
                .Where(s => s.PaymentDate.Year == yr && s.PaymentDate.Month == mo)
                .Sum(s => s.GrossAmount > 0 ? s.GrossAmount : s.NetPaid);

            decimal monthOpex = vouchers
                .Where(v => v.ExpenseDate.Year == yr && v.ExpenseDate.Month == mo)
                .Sum(v => v.Amount);

            decimal monthExpense = monthPayroll + monthOpex;
            decimal monthSurplus = monthIncome - monthExpense;

            monthlyTrends.Add(new MonthlySurplusTrendDto(
                MonthName: monthLabel,
                Month: mo,
                Year: yr,
                TotalIncome: monthIncome,
                TotalExpense: monthExpense,
                NetSurplus: monthSurplus,
                RealizedCollections: monthRealized
            ));

            curMonth = curMonth.AddMonths(1);
        }

        // 9. Net Profit / Loss Calculation
        decimal netProfitOrLoss = totalDirectIncome - totalExpense;
        decimal profitMargin = totalDirectIncome > 0 ? Math.Round((netProfitOrLoss / totalDirectIncome) * 100m, 1) : 0m;
        bool isSurplus = netProfitOrLoss >= 0;

        var report = new ProfitLossReportDto(
            FromDate: start,
            ToDate: end,
            FinancialYear: financialYear,
            BranchId: branchId,
            BranchName: branchName,
            TotalDirectIncome: totalDirectIncome,
            TotalPayrollExpense: totalPayrollExpense,
            TotalOperatingExpense: totalOperatingExpense,
            TotalExpense: totalExpense,
            NetProfitOrLoss: netProfitOrLoss,
            ProfitMarginPercentage: profitMargin,
            IsSurplus: isSurplus,
            Incomes: incomeSummaryList,
            Expenses: expenseSummaryList,
            MonthlyTrends: monthlyTrends,
            AcademicScope: scope,
            RealizedCashCollections: totalRealizedCollections,
            AccruedFeeReceivables: accruedFeeReceivables,
            LibraryFinesIncome: libraryFinesIncome
        );

        return Ok(report);
    }

    // =========================================================================
    // 2. BALANCE SHEET (STATEMENT OF FINANCIAL POSITION)
    // =========================================================================

    [HttpGet("balance-sheet")]
    public async Task<ActionResult<BalanceSheetReportDto>> GetBalanceSheet(
        [FromQuery] DateTime? asOfDate = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] string? academicScope = "All")
    {
        var tenantId = _currentUser.TenantId;
        DateTime cutoff = asOfDate.HasValue 
            ? DateTime.SpecifyKind(asOfDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc)
            : DateTime.UtcNow;
        string scope = string.IsNullOrWhiteSpace(academicScope) ? "All" : academicScope.Trim();

        string branchName = "All Branches Consolidated";
        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            var branch = await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == branchId.Value);
            if (branch != null) branchName = branch.Name;
        }

        // ─── A. CURRENT ASSETS ──────────────────────────────────────────
        // 1. Fee Payments Received up to cutoff
        var feePaymentsBase = _dbContext.FeePayments
            .AsNoTracking()
            .Include(p => p.Invoice)
                .ThenInclude(i => i!.Student)
            .Where(p => p.TenantId == tenantId && !p.IsReversed && p.PaymentDate <= cutoff);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            feePaymentsBase = feePaymentsBase.Where(p => p.BranchId == branchId.Value || (p.Invoice != null && p.Invoice.BranchId == branchId.Value));
        }

        if (scope.Equals("School", StringComparison.OrdinalIgnoreCase))
        {
            feePaymentsBase = feePaymentsBase.Where(p => p.Invoice != null && (
                p.Invoice.InvoiceCategory == "School" ||
                p.Invoice.InvoiceCategory == "Integrated" ||
                (p.Invoice.InvoiceCategory != "Coaching" && (p.Invoice.ClassId != null || (p.Invoice.Student != null && (p.Invoice.Student.IsSchoolStudent || p.Invoice.Student.ClassId != null))))
            ));
        }
        else if (scope.Equals("Coaching", StringComparison.OrdinalIgnoreCase))
        {
            feePaymentsBase = feePaymentsBase.Where(p => p.Invoice != null && (
                p.Invoice.InvoiceCategory == "Coaching" ||
                p.Invoice.InvoiceCategory == "Integrated" ||
                (p.Invoice.InvoiceCategory != "School" && (p.Invoice.Student != null && (p.Invoice.Student.IsCoachingStudent || p.Invoice.Student.BatchId != null)))
            ));
        }

        var feePaymentsCutoff = await feePaymentsBase.ToListAsync();
        decimal cashFeeCollected = feePaymentsCutoff.Where(p => p.Mode == PaymentMode.Cash).Sum(p => p.AmountPaid);
        decimal bankFeeCollected = feePaymentsCutoff.Where(p => p.Mode != PaymentMode.Cash).Sum(p => p.AmountPaid);

        // 2. Library Fines Received up to cutoff
        var libFinesCutoff = await _dbContext.LibraryCirculations
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.FineStatus == "Paid" && c.FineAmount > 0 &&
                        ((c.FinePaidAt.HasValue && c.FinePaidAt.Value <= cutoff) || (!c.FinePaidAt.HasValue && c.CreatedAt <= cutoff)) &&
                        (!branchId.HasValue || c.BranchId == branchId.Value))
            .ToListAsync();
        decimal cashLibFines = libFinesCutoff.Sum(c => c.FineAmount); // Library counter collected cash

        // 3. Salaries Paid up to cutoff
        var salariesBase = _dbContext.TeacherSalaryPayments
            .AsNoTracking()
            .Include(s => s.Teacher)
            .Where(s => s.TenantId == tenantId && s.PaymentDate <= cutoff);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            salariesBase = salariesBase.Where(s => s.Teacher != null && s.Teacher.BranchId == branchId.Value);
        }

        var salariesCutoff = await salariesBase.ToListAsync();
        decimal cashSalariesPaid = salariesCutoff.Where(s => s.PaymentMode == SalaryPaymentMode.Cash).Sum(s => s.NetPaid);
        decimal bankSalariesPaid = salariesCutoff.Where(s => s.PaymentMode != SalaryPaymentMode.Cash).Sum(s => s.NetPaid);
        decimal totalAdvancesAdjustedInSalaries = salariesCutoff.Sum(s => s.AdvanceAdjusted);
        decimal totalStatutoryDeductions = salariesCutoff.Sum(s =>
        {
            decimal itemized = (s.PFDeduction ?? 0m) + (s.TDSDeduction ?? 0m) + (s.OtherStatutoryDeduction ?? 0m);
            return itemized > 0 ? itemized : s.Deductions;
        });

        // 4. Staff Salary Advances Disbursed up to cutoff
        var advancesBase = _dbContext.TeacherSalaryAdvances
            .AsNoTracking()
            .Include(a => a.Teacher)
            .Where(a => a.TenantId == tenantId && (a.ApprovedDate ?? a.RequestDate) <= cutoff && (a.Status == AdvanceStatus.Approved || a.Status == AdvanceStatus.Adjusted));

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            advancesBase = advancesBase.Where(a => a.Teacher != null && a.Teacher.BranchId == branchId.Value);
        }

        var advancesCutoff = await advancesBase.ToListAsync();
        decimal totalAdvancesDisbursed = advancesCutoff.Sum(a => a.Amount);
        decimal remainingStaffAdvances = Math.Max(0m, totalAdvancesDisbursed - totalAdvancesAdjustedInSalaries);

        // 5. Operating Expenses up to cutoff
        var vouchersBase = _dbContext.ExpenseVouchers
            .AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.ExpenseDate <= cutoff);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            vouchersBase = vouchersBase.Where(v => v.BranchId == branchId.Value);
        }

        var vouchersCutoff = await vouchersBase.ToListAsync();
        decimal cashExpensesPaid = vouchersCutoff.Where(v => v.PaymentMode == ExpensePaymentMode.Cash).Sum(v => v.Amount);
        decimal bankExpensesPaid = vouchersCutoff.Where(v => v.PaymentMode != ExpensePaymentMode.Cash).Sum(v => v.Amount);

        // 6. Cash In Hand & Bank Accounts Balances
        var cashLedger = await _dbContext.AccountLedgers.FirstOrDefaultAsync(l => l.TenantId == tenantId && l.AccountCode == "CASH-MAIN");
        decimal cashOpening = cashLedger?.OpeningBalance ?? 0m;
        // Advances disbursed in cash reduce counter cash
        decimal cashInHandBalance = Math.Max(0m, cashOpening + cashFeeCollected + cashLibFines - cashSalariesPaid - totalAdvancesDisbursed - cashExpensesPaid);

        var bankLedger = await _dbContext.AccountLedgers.FirstOrDefaultAsync(l => l.TenantId == tenantId && l.AccountCode == "BANK-MAIN");
        decimal bankOpening = bankLedger?.OpeningBalance ?? 0m;
        decimal bankAccountsBalance = Math.Max(0m, bankOpening + bankFeeCollected - bankSalariesPaid - bankExpensesPaid);

        // 7. Accounts Receivable (Historically Accurate Student Fee Dues as of Cutoff)
        var feeInvoicesBase = _dbContext.FeeInvoices
            .AsNoTracking()
            .Include(i => i.Student)
            .Include(i => i.Payments)
            .Where(i => i.TenantId == tenantId && i.CreatedAt <= cutoff && i.Status != InvoiceStatus.Cancelled);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            feeInvoicesBase = feeInvoicesBase.Where(i => i.BranchId == branchId.Value);
        }

        if (scope.Equals("School", StringComparison.OrdinalIgnoreCase))
        {
            feeInvoicesBase = feeInvoicesBase.Where(i => 
                i.InvoiceCategory == "School" || 
                i.InvoiceCategory == "Integrated" ||
                (i.InvoiceCategory != "Coaching" && (i.ClassId != null || (i.Student != null && (i.Student.IsSchoolStudent || i.Student.ClassId != null))))
            );
        }
        else if (scope.Equals("Coaching", StringComparison.OrdinalIgnoreCase))
        {
            feeInvoicesBase = feeInvoicesBase.Where(i => 
                i.InvoiceCategory == "Coaching" || 
                i.InvoiceCategory == "Integrated" ||
                (i.InvoiceCategory != "School" && (i.Student != null && (i.Student.IsCoachingStudent || i.Student.BatchId != null)))
            );
        }

        var cutoffInvoices = await feeInvoicesBase.ToListAsync();
        decimal accountsReceivable = 0m;
        foreach (var inv in cutoffInvoices)
        {
            decimal paidOnOrBeforeCutoff = inv.Payments != null ? inv.Payments.Where(p => p.PaymentDate <= cutoff).Sum(p => p.AmountPaid) : 0m;
            decimal dueAtCutoff = Math.Max(0m, inv.TotalAmount - paidOnOrBeforeCutoff);
            accountsReceivable += dueAtCutoff;
        }

        var currentAssetItems = new List<BalanceSheetItemDto>
        {
            new BalanceSheetItemDto("CA-CASH", "Cash in Hand (Counter Float & Drawer)", cashInHandBalance, "Liquid Cash", true, "Cash drawer balance after fee receipts, advances & cash expenses"),
            new BalanceSheetItemDto("CA-BANK", "Bank Accounts Balance (Current & Savings)", bankAccountsBalance, "Bank Balances", true, "Primary bank balance after online fees, payroll & vouchers"),
            new BalanceSheetItemDto("CA-FEES", "Accounts Receivable (Student Fee Dues)", accountsReceivable, "Receivables", true, "Historically verified student fee dues outstanding as of cutoff"),
            new BalanceSheetItemDto("CA-ADV", "Staff Advances Receivable", remainingStaffAdvances, "Advances", true, "Unadjusted salary advances disbursed to faculty & staff")
        };

        // Custom Current Assets from AccountLedgers
        var customCurrentAssets = await _dbContext.AccountLedgers
            .Where(l => l.TenantId == tenantId && l.IsActive && l.AccountType == AccountType.Asset && l.SubType == AccountSubType.CurrentAsset && l.AccountCode != "CASH-MAIN" && l.AccountCode != "BANK-MAIN")
            .ToListAsync();
        foreach (var l in customCurrentAssets)
        {
            currentAssetItems.Add(new BalanceSheetItemDto(l.AccountCode, l.AccountName, l.CurrentBalance > 0 ? l.CurrentBalance : l.OpeningBalance, "Other Current Assets", false, l.Description));
        }

        var currentAssetsGroup = new BalanceSheetGroupDto("Current Assets", currentAssetItems.Sum(x => x.Amount), currentAssetItems);

        // ─── B. FIXED ASSETS ────────────────────────────────────────────
        var fixedAssetLedgers = await _dbContext.AccountLedgers
            .Where(l => l.TenantId == tenantId && l.IsActive && l.AccountType == AccountType.Asset && l.SubType == AccountSubType.FixedAsset)
            .OrderBy(l => l.AccountCode)
            .ToListAsync();

        var fixedAssetItems = fixedAssetLedgers.Select(l => new BalanceSheetItemDto(
            Code: l.AccountCode,
            Title: l.AccountName,
            Amount: l.CurrentBalance > 0 ? l.CurrentBalance : l.OpeningBalance,
            Category: "Tangible Fixed Assets",
            IsDynamic: false,
            Note: l.Description
        )).ToList();

        var fixedAssetsGroup = new BalanceSheetGroupDto("Fixed Assets (Net of Depreciation)", fixedAssetItems.Sum(x => x.Amount), fixedAssetItems);
        decimal totalAssets = currentAssetsGroup.TotalAmount + fixedAssetsGroup.TotalAmount;

        // ─── C. CURRENT LIABILITIES ─────────────────────────────────────
        var currentLiabilityLedgers = await _dbContext.AccountLedgers
            .Where(l => l.TenantId == tenantId && l.IsActive && l.AccountType == AccountType.Liability && l.SubType == AccountSubType.CurrentLiability)
            .ToListAsync();

        var currentLiabilityItems = currentLiabilityLedgers.Select(l => new BalanceSheetItemDto(
            Code: l.AccountCode,
            Title: l.AccountName,
            Amount: l.CurrentBalance > 0 ? l.CurrentBalance : l.OpeningBalance,
            Category: "Current Liabilities",
            IsDynamic: false,
            Note: l.Description
        )).ToList();

        // Add Statutory Payroll Withholdings (TDS/PF/ESI) deducted from salaries but pending remittance
        if (totalStatutoryDeductions > 0 && !currentLiabilityItems.Any(i => i.Code.Contains("TDS") || i.Code.Contains("STATUTORY")))
        {
            currentLiabilityItems.Add(new BalanceSheetItemDto(
                Code: "CL-STATUTORY",
                Title: "Statutory Payroll Liabilities (TDS/PF/ESI Withheld)",
                Amount: totalStatutoryDeductions,
                Category: "Current Liabilities",
                IsDynamic: true,
                Note: "TDS, Provident Fund & statutory deductions withheld from faculty salaries pending government remittance"
            ));
        }

        var currentLiabilitiesGroup = new BalanceSheetGroupDto("Current Liabilities", currentLiabilityItems.Sum(x => x.Amount), currentLiabilityItems);

        // ─── D. LONG-TERM LIABILITIES ───────────────────────────────────
        var longTermLiabilityLedgers = await _dbContext.AccountLedgers
            .Where(l => l.TenantId == tenantId && l.IsActive && l.AccountType == AccountType.Liability && l.SubType == AccountSubType.LongTermLiability)
            .ToListAsync();

        var longTermLiabilityItems = longTermLiabilityLedgers.Select(l => new BalanceSheetItemDto(
            Code: l.AccountCode,
            Title: l.AccountName,
            Amount: l.CurrentBalance > 0 ? l.CurrentBalance : l.OpeningBalance,
            Category: "Long-Term Borrowings",
            IsDynamic: false,
            Note: l.Description
        )).ToList();

        var longTermLiabilitiesGroup = new BalanceSheetGroupDto("Long-Term Liabilities", longTermLiabilityItems.Sum(x => x.Amount), longTermLiabilityItems);

        // ─── E. CAPITAL & EQUITY ────────────────────────────────────────
        // Operational Accrual Surplus up to cutoff date:
        // Revenue (Cash + Bank fees + Library fines + Accounts Receivable) - Gross Salaries - Operating Expenses
        decimal totalAccrualRevenueAllTime = (cashFeeCollected + bankFeeCollected + cashLibFines) + accountsReceivable;
        decimal totalGrossSalariesAllTime = (cashSalariesPaid + bankSalariesPaid) + totalAdvancesAdjustedInSalaries + totalStatutoryDeductions;
        decimal totalExpensesAllTime = cashExpensesPaid + bankExpensesPaid;
        decimal netProfitSurplus = totalAccrualRevenueAllTime - (totalGrossSalariesAllTime + totalExpensesAllTime);

        var capitalLedgers = await _dbContext.AccountLedgers
            .Where(l => l.TenantId == tenantId && l.IsActive && l.AccountType == AccountType.Equity)
            .ToListAsync();

        var equityItems = capitalLedgers.Select(l => new BalanceSheetItemDto(
            Code: l.AccountCode,
            Title: l.AccountName,
            Amount: l.CurrentBalance > 0 ? l.CurrentBalance : l.OpeningBalance,
            Category: "Capital Fund",
            IsDynamic: false,
            Note: l.Description
        )).ToList();

        // Add Net Profit from Income Statement to Equity
        equityItems.Add(new BalanceSheetItemDto(
            Code: "EQ-RETAINED",
            Title: "Accumulated Net Operating Surplus (from P&L)",
            Amount: netProfitSurplus,
            Category: "Reserves & Surplus",
            IsDynamic: true,
            Note: "Accumulated net surplus from academic operations after payroll & operating costs"
        ));

        // Exact Trial Balance Reconciliation of Initial Opening Equity
        decimal preliminaryLiabilities = currentLiabilitiesGroup.TotalAmount + longTermLiabilitiesGroup.TotalAmount;
        decimal preliminaryEquity = equityItems.Sum(x => x.Amount);
        decimal initialDifference = totalAssets - (preliminaryLiabilities + preliminaryEquity);

        // If institution hasn't configured manual opening capital ledgers, reflect initial opening net assets
        var capitalItem = equityItems.FirstOrDefault(e => e.Code == "EQ-CAPITAL");
        if (capitalItem != null && capitalItem.Amount == 0 && Math.Abs(initialDifference) > 0.001m)
        {
            equityItems.Remove(capitalItem);
            equityItems.Insert(0, capitalItem with { Amount = initialDifference, Note = "Initial opening corpus & net worth balancing reserve" });
        }
        else if (capitalItem == null && Math.Abs(initialDifference) > 0.001m)
        {
            equityItems.Insert(0, new BalanceSheetItemDto(
                "EQ-CORPUS",
                "Corpus Fund / Institutional Net Worth Reserve",
                initialDifference,
                "Capital Fund",
                true,
                "Balancing reserve representing initial institutional equity"
            ));
        }

        var equityGroup = new BalanceSheetGroupDto("Capital Fund & Reserves", equityItems.Sum(x => x.Amount), equityItems);
        decimal totalLiabilitiesAndEquity = currentLiabilitiesGroup.TotalAmount + longTermLiabilitiesGroup.TotalAmount + equityGroup.TotalAmount;
        decimal finalDifference = Math.Round(totalAssets - totalLiabilitiesAndEquity, 2);
        bool isBalanced = Math.Abs(finalDifference) < 0.05m;

        var report = new BalanceSheetReportDto(
            AsOfDate: cutoff,
            BranchId: branchId,
            BranchName: branchName,
            CurrentAssets: currentAssetsGroup,
            FixedAssets: fixedAssetsGroup,
            TotalAssets: totalAssets,
            CurrentLiabilities: currentLiabilitiesGroup,
            LongTermLiabilities: longTermLiabilitiesGroup,
            EquityAndCapital: equityGroup,
            TotalLiabilitiesAndEquity: totalLiabilitiesAndEquity,
            Difference: finalDifference,
            IsBalanced: isBalanced,
            CurrentPeriodProfit: netProfitSurplus,
            AcademicScope: scope,
            RealizedCashBalance: cashInHandBalance + bankAccountsBalance,
            AccountsReceivableTotal: accountsReceivable,
            StaffAdvancesTotal: remainingStaffAdvances
        );

        return Ok(report);
    }

    private static string CategorizeIncomeHead(string headName, string division)
    {
        string h = headName.ToLowerInvariant();
        if (h.Contains("transport") || h.Contains("bus") || h.Contains("van") || h.Contains("conveyance") || h.Contains("route"))
            return "Fleet & Transportation Services";
        if (h.Contains("hostel") || h.Contains("mess") || h.Contains("boarding") || h.Contains("room rent") || h.Contains("dining"))
            return "Residential & Dining Services";
        if (h.Contains("library") || h.Contains("book") || h.Contains("fine"))
            return "Library & Learning Resources";
        if (h.Contains("coaching") || h.Contains("neet") || h.Contains("jee") || h.Contains("foundation") || h.Contains("test series") || h.Contains("dpp") || h.Contains("material"))
            return "Coaching & Competitive Programs";
        if (h.Contains("admission") || h.Contains("registration") || h.Contains("prospectus"))
            return "Admission & Enrollment Fees";
        if (h.Contains("exam") || h.Contains("assessment") || h.Contains("test"))
            return "Examinations & Certifications";
        if (h.Contains("annual") || h.Contains("development") || h.Contains("sports") || h.Contains("activity") || h.Contains("lab"))
            return "Institutional Development & Activities";
        
        return division.Contains("Coaching") ? "Coaching Academic Programs" : "School Academic Curriculum";
    }

    // =========================================================================
    // 3. EXPENSE VOUCHER MANAGEMENT
    // =========================================================================

    [HttpGet("expenses/paged")]
    public async Task<ActionResult<PagedExpenseResultDto>> GetExpensesPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 15,
        [FromQuery] string? searchTerm = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] ExpensePaymentMode? paymentMode = null,
        [FromQuery] string? sortBy = "date",
        [FromQuery] bool sortDescending = true)
    {
        var tenantId = _currentUser.TenantId;
        var query = _dbContext.ExpenseVouchers
            .AsNoTracking()
            .Where(v => v.TenantId == tenantId);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            query = query.Where(v => v.BranchId == branchId.Value);
        }

        if (categoryId.HasValue && categoryId.Value != Guid.Empty)
        {
            query = query.Where(v => v.ExpenseCategoryId == categoryId.Value);
        }

        if (paymentMode.HasValue)
        {
            query = query.Where(v => v.PaymentMode == paymentMode.Value);
        }

        if (fromDate.HasValue)
        {
            var start = DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Utc);
            query = query.Where(v => v.ExpenseDate >= start);
        }

        if (toDate.HasValue)
        {
            var end = DateTime.SpecifyKind(toDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
            query = query.Where(v => v.ExpenseDate <= end);
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            string term = searchTerm.Trim().ToLower();
            query = query.Where(v =>
                v.VoucherNo.ToLower().Contains(term) ||
                v.Title.ToLower().Contains(term) ||
                (v.VendorName != null && v.VendorName.ToLower().Contains(term)) ||
                (v.BillInvoiceNo != null && v.BillInvoiceNo.ToLower().Contains(term)) ||
                (v.Category != null && v.Category.Name.ToLower().Contains(term))
            );
        }

        // Query Optimization: Compute Count, Total Filtered Amount, Cash, Bank in a single SQL query
        var stats = await query
            .GroupBy(x => 1)
            .Select(g => new {
                TotalCount = g.Count(),
                TotalAmount = g.Sum(x => x.Amount),
                CashAmount = g.Sum(x => x.PaymentMode == ExpensePaymentMode.Cash ? x.Amount : 0m),
                BankAmount = g.Sum(x => x.PaymentMode != ExpensePaymentMode.Cash ? x.Amount : 0m)
            })
            .FirstOrDefaultAsync();

        int totalCount = stats?.TotalCount ?? 0;
        decimal totalFilteredAmount = stats?.TotalAmount ?? 0m;
        decimal totalCashAmount = stats?.CashAmount ?? 0m;
        decimal totalBankAmount = stats?.BankAmount ?? 0m;
        int totalPages = pageSize > 0 ? (int)Math.Ceiling(totalCount / (double)pageSize) : 1;

        // Server-Side Dynamic Sorting
        IOrderedQueryable<ExpenseVoucher> orderedQuery = (sortBy?.ToLower()) switch
        {
            "voucherno" => sortDescending ? query.OrderByDescending(v => v.VoucherNo) : query.OrderBy(v => v.VoucherNo),
            "title" => sortDescending ? query.OrderByDescending(v => v.Title) : query.OrderBy(v => v.Title),
            "amount" => sortDescending ? query.OrderByDescending(v => v.Amount) : query.OrderBy(v => v.Amount),
            "mode" => sortDescending ? query.OrderByDescending(v => v.PaymentMode) : query.OrderBy(v => v.PaymentMode),
            "category" => sortDescending ? query.OrderByDescending(v => v.Category != null ? v.Category.Name : "") : query.OrderBy(v => v.Category != null ? v.Category.Name : ""),
            _ => sortDescending ? query.OrderByDescending(v => v.ExpenseDate).ThenByDescending(v => v.CreatedAt) 
                                : query.OrderBy(v => v.ExpenseDate).ThenBy(v => v.CreatedAt)
        };

        // Server-Side Skip & Take with Projection
        var items = await orderedQuery
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(v => new ExpenseVoucherDto(
                v.Id,
                v.TenantId,
                v.BranchId,
                v.Branch != null ? v.Branch.Name : null,
                v.VoucherNo,
                v.ExpenseDate,
                v.ExpenseCategoryId,
                v.Category != null ? v.Category.Name : "General",
                v.Category != null ? v.Category.Code : "GEN",
                v.Title,
                v.Amount,
                v.PaymentMode,
                v.VendorName,
                v.BillInvoiceNo,
                v.Description,
                v.ReceiptAttachmentUrl,
                v.CreatedByUserId,
                v.CreatedByUser != null ? v.CreatedByUser.FullName : null,
                v.CreatedAt
            ))
            .ToListAsync();

        return Ok(new PagedExpenseResultDto(
            items,
            totalCount,
            pageNumber,
            pageSize,
            totalPages,
            totalFilteredAmount,
            totalCashAmount,
            totalBankAmount
        ));
    }

    [HttpGet("expenses/{id:guid}")]
    public async Task<ActionResult<ExpenseVoucherDto>> GetExpenseById(Guid id)
    {
        var v = await _dbContext.ExpenseVouchers
            .AsNoTracking()
            .Include(x => x.Category)
            .Include(x => x.Branch)
            .Include(x => x.CreatedByUser)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (v == null) return NotFound(new { message = "Expense voucher not found" });

        return Ok(new ExpenseVoucherDto(
            v.Id,
            v.TenantId,
            v.BranchId,
            v.Branch?.Name,
            v.VoucherNo,
            v.ExpenseDate,
            v.ExpenseCategoryId,
            v.Category?.Name ?? "General",
            v.Category?.Code ?? "GEN",
            v.Title,
            v.Amount,
            v.PaymentMode,
            v.VendorName,
            v.BillInvoiceNo,
            v.Description,
            v.ReceiptAttachmentUrl,
            v.CreatedByUserId,
            v.CreatedByUser?.FullName,
            v.CreatedAt
        ));
    }

    [HttpPost("expenses")]
    public async Task<ActionResult<ExpenseVoucherDto>> CreateExpense([FromBody] CreateExpenseVoucherDto dto)
    {
        if (dto.Amount <= 0) return BadRequest(new { message = "Expense amount must be greater than zero." });

        var tenantId = _currentUser.TenantId;
        var now = DateTime.UtcNow;

        // Auto-generate voucher number: EXP-yyyyMM-XXXX
        int countToday = await _dbContext.ExpenseVouchers.CountAsync(v => v.TenantId == tenantId && v.CreatedAt.Year == now.Year && v.CreatedAt.Month == now.Month);
        string voucherNo = $"EXP-{now.Year}{now.Month:D2}-{(countToday + 1):D4}";

        var voucher = new ExpenseVoucher
        {
            TenantId = tenantId,
            BranchId = dto.BranchId ?? _currentUser.BranchId,
            VoucherNo = voucherNo,
            ExpenseDate = DateTime.SpecifyKind(dto.ExpenseDate, DateTimeKind.Utc),
            ExpenseCategoryId = dto.ExpenseCategoryId,
            Title = dto.Title.Trim(),
            Amount = dto.Amount,
            PaymentMode = dto.PaymentMode,
            VendorName = dto.VendorName?.Trim(),
            BillInvoiceNo = dto.BillInvoiceNo?.Trim(),
            Description = dto.Description?.Trim(),
            ReceiptAttachmentUrl = dto.ReceiptAttachmentUrl,
            CreatedByUserId = _currentUser.UserId,
            CreatedAt = now
        };

        _dbContext.ExpenseVouchers.Add(voucher);
        await _dbContext.SaveChangesAsync();

        var loaded = await _dbContext.ExpenseVouchers
            .Include(x => x.Category)
            .Include(x => x.Branch)
            .Include(x => x.CreatedByUser)
            .FirstAsync(x => x.Id == voucher.Id);

        return Ok(new ExpenseVoucherDto(
            loaded.Id,
            loaded.TenantId,
            loaded.BranchId,
            loaded.Branch?.Name,
            loaded.VoucherNo,
            loaded.ExpenseDate,
            loaded.ExpenseCategoryId,
            loaded.Category?.Name ?? "General",
            loaded.Category?.Code ?? "GEN",
            loaded.Title,
            loaded.Amount,
            loaded.PaymentMode,
            loaded.VendorName,
            loaded.BillInvoiceNo,
            loaded.Description,
            loaded.ReceiptAttachmentUrl,
            loaded.CreatedByUserId,
            loaded.CreatedByUser?.FullName,
            loaded.CreatedAt
        ));
    }

    [HttpPut("expenses/{id:guid}")]
    public async Task<ActionResult<ExpenseVoucherDto>> UpdateExpense(Guid id, [FromBody] UpdateExpenseVoucherDto dto)
    {
        var voucher = await _dbContext.ExpenseVouchers
            .Include(x => x.Category)
            .Include(x => x.Branch)
            .Include(x => x.CreatedByUser)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (voucher == null) return NotFound(new { message = "Expense voucher not found" });

        voucher.ExpenseDate = DateTime.SpecifyKind(dto.ExpenseDate, DateTimeKind.Utc);
        voucher.ExpenseCategoryId = dto.ExpenseCategoryId;
        voucher.Title = dto.Title.Trim();
        voucher.Amount = dto.Amount;
        voucher.PaymentMode = dto.PaymentMode;
        voucher.VendorName = dto.VendorName?.Trim();
        voucher.BillInvoiceNo = dto.BillInvoiceNo?.Trim();
        voucher.Description = dto.Description?.Trim();
        voucher.ReceiptAttachmentUrl = dto.ReceiptAttachmentUrl;
        if (dto.BranchId.HasValue) voucher.BranchId = dto.BranchId.Value;

        await _dbContext.SaveChangesAsync();

        return Ok(new ExpenseVoucherDto(
            voucher.Id,
            voucher.TenantId,
            voucher.BranchId,
            voucher.Branch?.Name,
            voucher.VoucherNo,
            voucher.ExpenseDate,
            voucher.ExpenseCategoryId,
            voucher.Category?.Name ?? "General",
            voucher.Category?.Code ?? "GEN",
            voucher.Title,
            voucher.Amount,
            voucher.PaymentMode,
            voucher.VendorName,
            voucher.BillInvoiceNo,
            voucher.Description,
            voucher.ReceiptAttachmentUrl,
            voucher.CreatedByUserId,
            voucher.CreatedByUser?.FullName,
            voucher.CreatedAt
        ));
    }

    [HttpDelete("expenses/{id:guid}")]
    public async Task<IActionResult> DeleteExpense(Guid id)
    {
        var voucher = await _dbContext.ExpenseVouchers.FirstOrDefaultAsync(x => x.Id == id);
        if (voucher == null) return NotFound(new { message = "Expense voucher not found" });

        _dbContext.ExpenseVouchers.Remove(voucher);
        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "Expense voucher deleted successfully" });
    }

    // =========================================================================
    // 4. EXPENSE CATEGORIES
    // =========================================================================

    [HttpGet("expense-categories")]
    public async Task<ActionResult<List<ExpenseCategoryDto>>> GetExpenseCategories()
    {
        var tenantId = _currentUser.TenantId;
        var categories = await _dbContext.ExpenseCategories
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.IsActive)
            .Include(c => c.Vouchers)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .Select(c => new ExpenseCategoryDto(
                c.Id,
                c.TenantId,
                c.BranchId,
                c.Name,
                c.Code,
                c.Description,
                c.IsActive,
                c.SortOrder,
                c.Vouchers.Count,
                c.Vouchers.Sum(v => v.Amount)
            ))
            .ToListAsync();

        return Ok(categories);
    }

    [HttpPost("expense-categories")]
    public async Task<ActionResult<ExpenseCategoryDto>> CreateExpenseCategory([FromBody] CreateExpenseCategoryDto dto)
    {
        var tenantId = _currentUser.TenantId;
        bool exists = await _dbContext.ExpenseCategories.AnyAsync(c => c.TenantId == tenantId && c.Code.ToLower() == dto.Code.Trim().ToLower());
        if (exists) return BadRequest(new { message = $"Category with code '{dto.Code}' already exists." });

        var category = new ExpenseCategory
        {
            TenantId = tenantId,
            BranchId = dto.BranchId,
            Name = dto.Name.Trim(),
            Code = dto.Code.Trim().ToUpper(),
            Description = dto.Description?.Trim(),
            SortOrder = dto.SortOrder,
            IsActive = true
        };

        _dbContext.ExpenseCategories.Add(category);
        await _dbContext.SaveChangesAsync();

        return Ok(new ExpenseCategoryDto(
            category.Id,
            category.TenantId,
            category.BranchId,
            category.Name,
            category.Code,
            category.Description,
            category.IsActive,
            category.SortOrder,
            0,
            0m
        ));
    }

    // =========================================================================
    // 5. CHART OF ACCOUNTS / ACCOUNT LEDGERS
    // =========================================================================

    [HttpGet("ledgers/paged")]
    public async Task<ActionResult<PagedLedgerResultDto>> GetAccountLedgersPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 15,
        [FromQuery] string? searchTerm = null,
        [FromQuery] AccountType? accountType = null,
        [FromQuery] AccountSubType? subType = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] string? sortBy = "code",
        [FromQuery] bool sortDescending = false)
    {
        var tenantId = _currentUser.TenantId;
        var baseLedgersQuery = _dbContext.AccountLedgers
            .AsNoTracking()
            .Where(l => l.TenantId == tenantId);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            baseLedgersQuery = baseLedgersQuery.Where(l => l.BranchId == branchId.Value);
        }

        // Query Optimization: Single aggregate query for overall portfolio valuations & category counts
        var stats = await baseLedgersQuery
            .GroupBy(x => 1)
            .Select(g => new {
                AssetValuation = g.Sum(l => l.AccountType == AccountType.Asset ? (l.CurrentBalance > 0 ? l.CurrentBalance : l.OpeningBalance) : 0m),
                LiabilityValuation = g.Sum(l => l.AccountType == AccountType.Liability ? (l.CurrentBalance > 0 ? l.CurrentBalance : l.OpeningBalance) : 0m),
                EquityValuation = g.Sum(l => l.AccountType == AccountType.Equity ? (l.CurrentBalance > 0 ? l.CurrentBalance : l.OpeningBalance) : 0m),
                AssetCount = g.Count(l => l.AccountType == AccountType.Asset),
                LiabilityCount = g.Count(l => l.AccountType == AccountType.Liability),
                EquityCount = g.Count(l => l.AccountType == AccountType.Equity)
            })
            .FirstOrDefaultAsync();

        decimal totalAssets = stats?.AssetValuation ?? 0m;
        decimal totalLiabilities = stats?.LiabilityValuation ?? 0m;
        decimal totalEquity = stats?.EquityValuation ?? 0m;
        int assetCount = stats?.AssetCount ?? 0;
        int liabilityCount = stats?.LiabilityCount ?? 0;
        int equityCount = stats?.EquityCount ?? 0;

        // Apply filters
        var filteredQuery = baseLedgersQuery;

        if (accountType.HasValue)
        {
            filteredQuery = filteredQuery.Where(l => l.AccountType == accountType.Value);
        }

        if (subType.HasValue)
        {
            filteredQuery = filteredQuery.Where(l => l.SubType == subType.Value);
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            string term = searchTerm.Trim().ToLower();
            filteredQuery = filteredQuery.Where(l =>
                l.AccountCode.ToLower().Contains(term) ||
                l.AccountName.ToLower().Contains(term) ||
                (l.Description != null && l.Description.ToLower().Contains(term))
            );
        }

        // Filtered totals
        var filteredStats = await filteredQuery
            .GroupBy(x => 1)
            .Select(g => new {
                Count = g.Count(),
                TotalBalance = g.Sum(l => (l.CurrentBalance > 0 ? l.CurrentBalance : l.OpeningBalance))
            })
            .FirstOrDefaultAsync();

        int totalCount = filteredStats?.Count ?? 0;
        decimal totalFilteredBalance = filteredStats?.TotalBalance ?? 0m;
        int totalPages = pageSize > 0 ? (int)Math.Ceiling(totalCount / (double)pageSize) : 1;

        // Dynamic Server-Side Sorting
        IOrderedQueryable<AccountLedger> orderedQuery = (sortBy?.ToLower()) switch
        {
            "code" => sortDescending ? filteredQuery.OrderByDescending(l => l.AccountCode) : filteredQuery.OrderBy(l => l.AccountCode),
            "name" => sortDescending ? filteredQuery.OrderByDescending(l => l.AccountName) : filteredQuery.OrderBy(l => l.AccountName),
            "subtype" => sortDescending ? filteredQuery.OrderByDescending(l => l.SubType) : filteredQuery.OrderBy(l => l.SubType),
            "balance" => sortDescending ? filteredQuery.OrderByDescending(l => (l.CurrentBalance > 0 ? l.CurrentBalance : l.OpeningBalance)) 
                                        : filteredQuery.OrderBy(l => (l.CurrentBalance > 0 ? l.CurrentBalance : l.OpeningBalance)),
            _ => sortDescending ? filteredQuery.OrderByDescending(l => l.AccountType).ThenByDescending(l => l.AccountCode)
                                : filteredQuery.OrderBy(l => l.AccountType).ThenBy(l => l.AccountCode)
        };

        // Paged items projection
        var items = await orderedQuery
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new AccountLedgerDto(
                l.Id,
                l.TenantId,
                l.BranchId,
                l.Branch != null ? l.Branch.Name : null,
                l.AccountCode,
                l.AccountName,
                l.AccountType,
                l.SubType,
                l.OpeningBalance,
                l.CurrentBalance,
                l.Description,
                l.IsActive,
                l.IsDefault
            ))
            .ToListAsync();

        return Ok(new PagedLedgerResultDto(
            items,
            totalCount,
            pageNumber,
            pageSize,
            totalPages,
            totalFilteredBalance,
            totalAssets,
            totalLiabilities,
            totalEquity,
            assetCount,
            liabilityCount,
            equityCount
        ));
    }

    [HttpGet("ledgers")]
    public async Task<ActionResult<List<AccountLedgerDto>>> GetAccountLedgers(
        [FromQuery] AccountType? type = null,
        [FromQuery] AccountSubType? subtype = null)
    {
        var tenantId = _currentUser.TenantId;
        var query = _dbContext.AccountLedgers
            .AsNoTracking()
            .Include(l => l.Branch)
            .Where(l => l.TenantId == tenantId);

        if (type.HasValue) query = query.Where(l => l.AccountType == type.Value);
        if (subtype.HasValue) query = query.Where(l => l.SubType == subtype.Value);

        var list = await query
            .OrderBy(l => l.AccountType)
            .ThenBy(l => l.SubType)
            .ThenBy(l => l.AccountName)
            .Select(l => new AccountLedgerDto(
                l.Id,
                l.TenantId,
                l.BranchId,
                l.Branch != null ? l.Branch.Name : null,
                l.AccountCode,
                l.AccountName,
                l.AccountType,
                l.SubType,
                l.OpeningBalance,
                l.CurrentBalance,
                l.Description,
                l.IsActive,
                l.IsDefault
            ))
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost("ledgers")]
    public async Task<ActionResult<AccountLedgerDto>> CreateAccountLedger([FromBody] CreateAccountLedgerDto dto)
    {
        var tenantId = _currentUser.TenantId;
        bool exists = await _dbContext.AccountLedgers.AnyAsync(l => l.TenantId == tenantId && l.AccountCode.ToLower() == dto.AccountCode.Trim().ToLower());
        if (exists) return BadRequest(new { message = $"Ledger code '{dto.AccountCode}' already exists." });

        var ledger = new AccountLedger
        {
            TenantId = tenantId,
            BranchId = dto.BranchId,
            AccountCode = dto.AccountCode.Trim().ToUpper(),
            AccountName = dto.AccountName.Trim(),
            AccountType = dto.AccountType,
            SubType = dto.SubType,
            OpeningBalance = dto.OpeningBalance,
            CurrentBalance = dto.OpeningBalance,
            Description = dto.Description?.Trim(),
            IsActive = true,
            IsDefault = false
        };

        _dbContext.AccountLedgers.Add(ledger);
        await _dbContext.SaveChangesAsync();

        return Ok(new AccountLedgerDto(
            ledger.Id,
            ledger.TenantId,
            ledger.BranchId,
            null,
            ledger.AccountCode,
            ledger.AccountName,
            ledger.AccountType,
            ledger.SubType,
            ledger.OpeningBalance,
            ledger.CurrentBalance,
            ledger.Description,
            ledger.IsActive,
            ledger.IsDefault
        ));
    }

    [HttpPut("ledgers/{id:guid}")]
    public async Task<ActionResult<AccountLedgerDto>> UpdateAccountLedger(Guid id, [FromBody] UpdateAccountLedgerDto dto)
    {
        var ledger = await _dbContext.AccountLedgers.FirstOrDefaultAsync(l => l.Id == id);
        if (ledger == null) return NotFound(new { message = "Ledger not found" });

        ledger.AccountName = dto.AccountName.Trim();
        ledger.AccountType = dto.AccountType;
        ledger.SubType = dto.SubType;
        ledger.OpeningBalance = dto.OpeningBalance;
        ledger.CurrentBalance = dto.OpeningBalance;
        ledger.Description = dto.Description?.Trim();
        ledger.IsActive = dto.IsActive;

        await _dbContext.SaveChangesAsync();

        return Ok(new AccountLedgerDto(
            ledger.Id,
            ledger.TenantId,
            ledger.BranchId,
            null,
            ledger.AccountCode,
            ledger.AccountName,
            ledger.AccountType,
            ledger.SubType,
            ledger.OpeningBalance,
            ledger.CurrentBalance,
            ledger.Description,
            ledger.IsActive,
            ledger.IsDefault
        ));
    }

    [HttpDelete("ledgers/{id:guid}")]
    public async Task<IActionResult> DeleteAccountLedger(Guid id)
    {
        var ledger = await _dbContext.AccountLedgers.FirstOrDefaultAsync(l => l.Id == id);
        if (ledger == null) return NotFound(new { message = "Ledger not found" });
        if (ledger.IsDefault) return BadRequest(new { message = "Default system ledgers cannot be deleted." });

        _dbContext.AccountLedgers.Remove(ledger);
        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "Account ledger deleted successfully" });
    }

    // =========================================================================
    // 6. FINANCE DASHBOARD OVERVIEW KPIS
    // =========================================================================

    [HttpGet("summary")]
    public async Task<ActionResult<FinanceDashboardKpiDto>> GetFinanceSummary([FromQuery] Guid? branchId = null)
    {
        var tenantId = _currentUser.TenantId;
        var now = DateTime.UtcNow;
        var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        int currentFyYear = now.Month >= 4 ? now.Year : now.Year - 1;
        var startOfFy = new DateTime(currentFyYear, 4, 1, 0, 0, 0, DateTimeKind.Utc);

        // This Month Incomes
        var feeQueryMonth = _dbContext.FeePayments.Where(p => p.TenantId == tenantId && !p.IsReversed && p.PaymentDate >= startOfMonth);
        if (branchId.HasValue && branchId.Value != Guid.Empty) feeQueryMonth = feeQueryMonth.Where(p => p.BranchId == branchId.Value);
        decimal incomeThisMonth = await feeQueryMonth.SumAsync(p => (decimal?)p.AmountPaid) ?? 0m;

        // This Month Expenses
        var salaryQueryMonth = _dbContext.TeacherSalaryPayments.Include(s => s.Teacher).Where(s => s.TenantId == tenantId && s.PaymentDate >= startOfMonth);
        if (branchId.HasValue && branchId.Value != Guid.Empty) salaryQueryMonth = salaryQueryMonth.Where(s => s.Teacher != null && s.Teacher.BranchId == branchId.Value);
        decimal salaryThisMonth = await salaryQueryMonth.SumAsync(s => (decimal?)s.NetPaid) ?? 0m;

        var opexQueryMonth = _dbContext.ExpenseVouchers.Where(v => v.TenantId == tenantId && v.ExpenseDate >= startOfMonth);
        if (branchId.HasValue && branchId.Value != Guid.Empty) opexQueryMonth = opexQueryMonth.Where(v => v.BranchId == branchId.Value);
        decimal opexThisMonth = await opexQueryMonth.SumAsync(v => (decimal?)v.Amount) ?? 0m;

        decimal expenseThisMonth = salaryThisMonth + opexThisMonth;
        decimal netSurplusThisMonth = incomeThisMonth - expenseThisMonth;

        // Total Outstanding Dues
        var duesQuery = _dbContext.FeeInvoices.Where(i => i.TenantId == tenantId && i.Status != InvoiceStatus.Paid && i.Status != InvoiceStatus.Cancelled);
        if (branchId.HasValue && branchId.Value != Guid.Empty) duesQuery = duesQuery.Where(i => i.BranchId == branchId.Value);
        decimal totalDues = await duesQuery.SumAsync(i => (decimal?)(i.TotalAmount - i.PaidAmount)) ?? 0m;

        // Cash & Bank Balances
        var cashCollected = await _dbContext.FeePayments.Where(p => p.TenantId == tenantId && !p.IsReversed && p.Mode == PaymentMode.Cash && (!branchId.HasValue || p.BranchId == branchId.Value)).SumAsync(p => (decimal?)p.AmountPaid) ?? 0m;
        var cashRefunds = await _dbContext.FeePayments.Where(p => p.TenantId == tenantId && p.IsReversed && p.ReversalType == "RefundToParent" && (p.RefundMode == "Cash" || p.Mode == PaymentMode.Cash) && (!branchId.HasValue || p.BranchId == branchId.Value)).SumAsync(p => (decimal?)p.AmountPaid) ?? 0m;
        var cashLibFines = await _dbContext.LibraryCirculations.Where(c => c.TenantId == tenantId && c.FineStatus == "Paid" && (!branchId.HasValue || c.BranchId == branchId.Value)).SumAsync(c => (decimal?)c.FineAmount) ?? 0m;
        var cashSalaries = await _dbContext.TeacherSalaryPayments.Include(s => s.Teacher).Where(s => s.TenantId == tenantId && s.PaymentMode == SalaryPaymentMode.Cash && (!branchId.HasValue || (s.Teacher != null && s.Teacher.BranchId == branchId.Value))).SumAsync(s => (decimal?)s.NetPaid) ?? 0m;
        var cashAdvances = await _dbContext.TeacherSalaryAdvances.Include(a => a.Teacher).Where(a => a.TenantId == tenantId && (a.Status == AdvanceStatus.Approved || a.Status == AdvanceStatus.Adjusted) && (!branchId.HasValue || (a.Teacher != null && a.Teacher.BranchId == branchId.Value))).SumAsync(a => (decimal?)a.Amount) ?? 0m;
        var cashExpenses = await _dbContext.ExpenseVouchers.Where(v => v.TenantId == tenantId && v.PaymentMode == ExpensePaymentMode.Cash && (!branchId.HasValue || v.BranchId == branchId.Value)).SumAsync(v => (decimal?)v.Amount) ?? 0m;
        var cashLedger = await _dbContext.AccountLedgers.FirstOrDefaultAsync(l => l.TenantId == tenantId && l.AccountCode == "CASH-MAIN");
        decimal cashBalance = Math.Max(0m, (cashLedger?.OpeningBalance ?? 0m) + cashCollected + cashLibFines - cashSalaries - cashAdvances - cashExpenses - cashRefunds);

        var bankCollected = await _dbContext.FeePayments.Where(p => p.TenantId == tenantId && !p.IsReversed && p.Mode != PaymentMode.Cash && (!branchId.HasValue || p.BranchId == branchId.Value)).SumAsync(p => (decimal?)p.AmountPaid) ?? 0m;
        var bankRefunds = await _dbContext.FeePayments.Where(p => p.TenantId == tenantId && p.IsReversed && p.ReversalType == "RefundToParent" && (p.RefundMode != "Cash" && p.Mode != PaymentMode.Cash) && (!branchId.HasValue || p.BranchId == branchId.Value)).SumAsync(p => (decimal?)p.AmountPaid) ?? 0m;
        var bankSalaries = await _dbContext.TeacherSalaryPayments.Include(s => s.Teacher).Where(s => s.TenantId == tenantId && s.PaymentMode != SalaryPaymentMode.Cash && (!branchId.HasValue || (s.Teacher != null && s.Teacher.BranchId == branchId.Value))).SumAsync(s => (decimal?)s.NetPaid) ?? 0m;
        var bankExpenses = await _dbContext.ExpenseVouchers.Where(v => v.TenantId == tenantId && v.PaymentMode != ExpensePaymentMode.Cash && (!branchId.HasValue || v.BranchId == branchId.Value)).SumAsync(v => (decimal?)v.Amount) ?? 0m;
        var bankLedger = await _dbContext.AccountLedgers.FirstOrDefaultAsync(l => l.TenantId == tenantId && l.AccountCode == "BANK-MAIN");
        decimal bankBalance = Math.Max(0m, (bankLedger?.OpeningBalance ?? 0m) + bankCollected - bankSalaries - bankExpenses - bankRefunds);

        // Current FY Revenue & Expenses
        var fyIncome = await _dbContext.FeePayments.Where(p => p.TenantId == tenantId && !p.IsReversed && p.PaymentDate >= startOfFy && (!branchId.HasValue || p.BranchId == branchId.Value)).SumAsync(p => (decimal?)p.AmountPaid) ?? 0m;
        var fySalaries = await _dbContext.TeacherSalaryPayments.Include(s => s.Teacher).Where(s => s.TenantId == tenantId && s.PaymentDate >= startOfFy && (!branchId.HasValue || (s.Teacher != null && s.Teacher.BranchId == branchId.Value))).SumAsync(s => (decimal?)s.NetPaid) ?? 0m;
        var fyExpenses = await _dbContext.ExpenseVouchers.Where(v => v.TenantId == tenantId && v.ExpenseDate >= startOfFy && (!branchId.HasValue || v.BranchId == branchId.Value)).SumAsync(v => (decimal?)v.Amount) ?? 0m;
        decimal fyTotalExpense = fySalaries + fyExpenses;
        decimal fySurplus = fyIncome - fyTotalExpense;

        return Ok(new FinanceDashboardKpiDto(
            incomeThisMonth,
            expenseThisMonth,
            netSurplusThisMonth,
            totalDues,
            cashBalance,
            bankBalance,
            fyIncome,
            fyTotalExpense,
            fySurplus
        ));
    }

    // =========================================================================
    // 7. DAY BOOK (दैनिक रोकड़ / रोजनामचा बही / Daily Cash & Bank Journal)
    // =========================================================================

    [HttpGet("daybook")]
    public async Task<ActionResult<DayBookReportDto>> GetDayBook(
        [FromQuery] DateTime? date = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] string? voucherType = null,
        [FromQuery] string? paymentMode = null,
        [FromQuery] string? academicScope = "All",
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? sortBy = "timestamp",
        [FromQuery] bool sortDescending = false,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 25)
    {
        var tenantId = _currentUser.TenantId;
        string scope = string.IsNullOrWhiteSpace(academicScope) ? "All" : academicScope.Trim();

        // 1. Determine Date Range in IST (Asia/Kolkata +05:30)
        TimeZoneInfo istTz;
        try { istTz = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time"); }
        catch { istTz = TimeZoneInfo.CreateCustomTimeZone("IST", TimeSpan.FromHours(5.5), "IST", "IST"); }

        DateTime nowIst = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istTz);
        DateTime targetStartIst;
        DateTime targetEndIst;

        if (fromDate.HasValue && toDate.HasValue)
        {
            targetStartIst = fromDate.Value.Date;
            targetEndIst = toDate.Value.Date.AddDays(1).AddTicks(-1);
        }
        else if (date.HasValue)
        {
            targetStartIst = date.Value.Date;
            targetEndIst = date.Value.Date.AddDays(1).AddTicks(-1);
        }
        else
        {
            targetStartIst = nowIst.Date;
            targetEndIst = nowIst.Date.AddDays(1).AddTicks(-1);
        }

        DateTime startUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(targetStartIst, DateTimeKind.Unspecified), istTz);
        DateTime endUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(targetEndIst, DateTimeKind.Unspecified), istTz);

        // Branch Name
        string branchName = "All Campuses Consolidated";
        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            var b = await _dbContext.Branches.FirstOrDefaultAsync(x => x.Id == branchId.Value);
            if (b != null) branchName = b.Name;
        }

        // 2. Opening Balance Calculation (Cash & Bank before startUtc)
        var cashLedger = await _dbContext.AccountLedgers.FirstOrDefaultAsync(l => l.TenantId == tenantId && l.AccountCode == "CASH-MAIN");
        var bankLedger = await _dbContext.AccountLedgers.FirstOrDefaultAsync(l => l.TenantId == tenantId && l.AccountCode == "BANK-MAIN");
        decimal cashOpening = cashLedger?.OpeningBalance ?? 0m;
        decimal bankOpening = bankLedger?.OpeningBalance ?? 0m;

        // Inflows prior to startUtc
        var priorFees = _dbContext.FeePayments.Where(p => p.TenantId == tenantId && !p.IsReversed && p.PaymentDate < startUtc);
        if (branchId.HasValue && branchId.Value != Guid.Empty) priorFees = priorFees.Where(p => p.BranchId == branchId.Value);
        decimal priorFeeCollected = await priorFees.SumAsync(p => (decimal?)p.AmountPaid) ?? 0m;

        var priorFines = _dbContext.LibraryCirculations.Where(c => c.TenantId == tenantId && c.FineStatus == "Paid" && (c.FinePaidAt ?? c.ReturnDate ?? c.IssueDate) < startUtc);
        if (branchId.HasValue && branchId.Value != Guid.Empty) priorFines = priorFines.Where(c => c.BranchId == branchId.Value);
        decimal priorLibFines = await priorFines.SumAsync(c => (decimal?)c.FineAmount) ?? 0m;

        // Outflows prior to startUtc
        var priorSalaries = _dbContext.TeacherSalaryPayments.Include(s => s.Teacher).Where(s => s.TenantId == tenantId && s.PaymentDate < startUtc);
        if (branchId.HasValue && branchId.Value != Guid.Empty) priorSalaries = priorSalaries.Where(s => s.Teacher != null && s.Teacher.BranchId == branchId.Value);
        decimal priorSalariesPaid = await priorSalaries.SumAsync(s => (decimal?)s.NetPaid) ?? 0m;

        var priorAdvances = _dbContext.TeacherSalaryAdvances.Include(a => a.Teacher).Where(a => a.TenantId == tenantId && (a.Status == AdvanceStatus.Approved || a.Status == AdvanceStatus.Adjusted) && (a.ApprovedDate ?? a.RequestDate) < startUtc);
        if (branchId.HasValue && branchId.Value != Guid.Empty) priorAdvances = priorAdvances.Where(a => a.Teacher != null && a.Teacher.BranchId == branchId.Value);
        decimal priorAdvancesDisbursed = await priorAdvances.SumAsync(a => (decimal?)a.Amount) ?? 0m;

        var priorVouchers = _dbContext.ExpenseVouchers.Where(v => v.TenantId == tenantId && v.ExpenseDate < startUtc);
        if (branchId.HasValue && branchId.Value != Guid.Empty) priorVouchers = priorVouchers.Where(v => v.BranchId == branchId.Value);
        decimal priorExpensesPaid = await priorVouchers.SumAsync(v => (decimal?)v.Amount) ?? 0m;

        var priorRefunds = _dbContext.FeePayments.Where(p => p.TenantId == tenantId && p.IsReversed && p.ReversalType == "RefundToParent" && (p.ReversedAt ?? p.PaymentDate) < startUtc);
        if (branchId.HasValue && branchId.Value != Guid.Empty) priorRefunds = priorRefunds.Where(p => p.BranchId == branchId.Value);
        decimal priorRefundsPaid = await priorRefunds.SumAsync(p => (decimal?)p.AmountPaid) ?? 0m;

        decimal openingBalance = Math.Max(0m, cashOpening + bankOpening + priorFeeCollected + priorLibFines - priorSalariesPaid - priorAdvancesDisbursed - priorExpensesPaid - priorRefundsPaid);

        // 3. Transactions Query within [startUtc, endUtc]
        var transactions = new List<DayBookTransactionDto>();

        // (A) Fee Payments (Receipts)
        var feeQuery = _dbContext.FeePayments
            .AsNoTracking()
            .Include(p => p.Invoice)
                .ThenInclude(i => i!.Student)
            .Include(p => p.Invoice)
                .ThenInclude(i => i!.Class)
            .Where(p => p.TenantId == tenantId && !p.IsReversed && p.PaymentDate >= startUtc && p.PaymentDate <= endUtc);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            feeQuery = feeQuery.Where(p => p.BranchId == branchId.Value);
        }

        var feeList = await feeQuery.ToListAsync();
        foreach (var p in feeList)
        {
            var inv = p.Invoice;
            var stu = inv?.Student;

            string division = "General";
            if (!string.IsNullOrWhiteSpace(inv?.InvoiceCategory))
            {
                division = inv.InvoiceCategory;
            }
            else if (stu != null)
            {
                if (stu.IsSchoolStudent && stu.IsCoachingStudent) division = "Integrated";
                else if (stu.IsSchoolStudent || stu.ClassId != null) division = "School";
                else if (stu.IsCoachingStudent || stu.BatchId != null) division = "Coaching";
            }

            // Scope filter
            if (scope.Equals("School", StringComparison.OrdinalIgnoreCase) && division.Equals("Coaching", StringComparison.OrdinalIgnoreCase))
                continue;
            if (scope.Equals("Coaching", StringComparison.OrdinalIgnoreCase) && division.Equals("School", StringComparison.OrdinalIgnoreCase))
                continue;

            string modeStr = p.Mode switch
            {
                PaymentMode.Cash => "Cash",
                PaymentMode.UPI => "UPI / Online",
                PaymentMode.NetBanking => "Bank Transfer",
                PaymentMode.Card => "Bank Transfer",
                _ => "UPI / Online"
            };

            string studentInfo = stu != null ? $"{stu.StudentName} (Roll: {stu.RollNumber ?? stu.AdmissionNumber ?? "N/A"})" : "Student";
            string classOrBatch = inv?.ClassName != null ? $"Class: {inv.ClassName}" : (inv?.Class != null ? $"Class: {inv.Class.Name}" : "Academic");
            string particulars = $"{studentInfo} • {classOrBatch} Fee Settlement";

            transactions.Add(new DayBookTransactionDto
            {
                Id = p.Id.ToString(),
                Timestamp = p.PaymentDate,
                VoucherNumber = !string.IsNullOrWhiteSpace(p.ReceiptNumber) ? p.ReceiptNumber : $"REC-{p.PaymentDate:yyyyMMdd}-{p.Id.ToString()[..6].ToUpper()}",
                VoucherType = "Receipt",
                AccountHead = "Student Tuition & Academic Fees",
                Particulars = particulars,
                Division = division,
                PaymentMode = modeStr,
                ReferenceNumber = p.TransactionRef,
                DebitAmount = 0m,
                CreditAmount = p.AmountPaid,
                PayeeOrPayerName = stu?.StudentName ?? stu?.ParentName,
                Remarks = p.Remarks
            });
        }

        // (A.1) Fee Refunds to Parents (Outflows / Debit)
        var refundQuery = _dbContext.FeePayments
            .AsNoTracking()
            .Include(p => p.Invoice).ThenInclude(i => i!.Student)
            .Include(p => p.Invoice).ThenInclude(i => i!.Class)
            .Where(p => p.TenantId == tenantId && p.IsReversed && p.ReversalType == "RefundToParent" && (p.ReversedAt ?? p.PaymentDate) >= startUtc && (p.ReversedAt ?? p.PaymentDate) <= endUtc);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            refundQuery = refundQuery.Where(p => p.BranchId == branchId.Value);
        }

        var refundList = await refundQuery.ToListAsync();
        foreach (var p in refundList)
        {
            var inv = p.Invoice;
            var stu = inv?.Student;
            string studentInfo = stu != null ? $"{stu.StudentName} (Roll: {stu.RollNumber ?? stu.AdmissionNumber ?? "N/A"})" : "Student";
            string refundTo = !string.IsNullOrWhiteSpace(p.RefundRecipient) ? p.RefundRecipient : (stu?.ParentName ?? studentInfo);
            string modeStr = !string.IsNullOrWhiteSpace(p.RefundMode) ? p.RefundMode : (p.Mode == PaymentMode.Cash ? "Cash" : "Bank Transfer");

            transactions.Add(new DayBookTransactionDto
            {
                Id = p.Id.ToString(),
                Timestamp = p.ReversedAt ?? p.PaymentDate,
                VoucherNumber = $"REF-{p.ReceiptNumber}",
                VoucherType = "Payment",
                AccountHead = "Student Fee Refund (शुल्क वापसी)",
                Particulars = $"Fee Refund of {p.ReceiptNumber} to {refundTo} • {p.ReversalReason ?? "Payment reversed by admin"}",
                Division = "General",
                PaymentMode = modeStr,
                ReferenceNumber = p.RefundReference ?? p.TransactionRef,
                DebitAmount = p.AmountPaid,
                CreditAmount = 0m,
                PayeeOrPayerName = refundTo,
                Remarks = $"Reversed by {p.ReversedBy ?? "Admin"}"
            });
        }

        // (B) Library Overdue Fines (Receipts)
        var fineQuery = _dbContext.LibraryCirculations
            .AsNoTracking()
            .Include(c => c.Student)
            .Include(c => c.BookCopy)
                .ThenInclude(bc => bc!.Book)
            .Where(c => c.TenantId == tenantId && c.FineStatus == "Paid" && c.FineAmount > 0 &&
                   (c.FinePaidAt ?? c.ReturnDate ?? c.IssueDate) >= startUtc &&
                   (c.FinePaidAt ?? c.ReturnDate ?? c.IssueDate) <= endUtc);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            fineQuery = fineQuery.Where(c => c.BranchId == branchId.Value);
        }

        var fineList = await fineQuery.ToListAsync();
        foreach (var f in fineList)
        {
            DateTime fineDate = f.FinePaidAt ?? f.ReturnDate ?? f.IssueDate;
            string bookTitle = f.BookCopy?.Book?.Title ?? "Library Book";
            string studentName = f.Student?.StudentName ?? "Student";

            transactions.Add(new DayBookTransactionDto
            {
                Id = f.Id.ToString(),
                Timestamp = fineDate,
                VoucherNumber = !string.IsNullOrWhiteSpace(f.FinePaymentReceiptNumber) ? f.FinePaymentReceiptNumber : $"LIB-FINE-{f.Id.ToString()[..8].ToUpper()}",
                VoucherType = "Receipt",
                AccountHead = "Library Fines & Clearance",
                Particulars = $"{studentName} • Late Return Fine for '{bookTitle}'",
                Division = "General",
                PaymentMode = "Cash",
                DebitAmount = 0m,
                CreditAmount = f.FineAmount,
                PayeeOrPayerName = studentName,
                Remarks = f.Remarks ?? "Library clearance fine"
            });
        }

        // (C) Operating Expense Vouchers (Payments)
        var expenseQuery = _dbContext.ExpenseVouchers
            .AsNoTracking()
            .Include(v => v.Category)
            .Include(v => v.CreatedByUser)
            .Where(v => v.TenantId == tenantId && v.ExpenseDate >= startUtc && v.ExpenseDate <= endUtc);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            expenseQuery = expenseQuery.Where(v => v.BranchId == branchId.Value);
        }

        var expenseList = await expenseQuery.ToListAsync();
        foreach (var v in expenseList)
        {
            string modeStr = v.PaymentMode switch
            {
                ExpensePaymentMode.Cash => "Cash",
                ExpensePaymentMode.UPI => "UPI / Online",
                ExpensePaymentMode.BankTransfer => "Bank Transfer",
                ExpensePaymentMode.Cheque => "Cheque",
                _ => "Cash"
            };

            string payee = !string.IsNullOrWhiteSpace(v.VendorName) ? v.VendorName : (!string.IsNullOrWhiteSpace(v.Title) ? v.Title : "Vendor / Supplier");
            string catName = v.Category?.Name ?? "Operational Expense";
            string desc = !string.IsNullOrWhiteSpace(v.Description) ? $" - {v.Description}" : "";

            transactions.Add(new DayBookTransactionDto
            {
                Id = v.Id.ToString(),
                Timestamp = v.ExpenseDate,
                VoucherNumber = !string.IsNullOrWhiteSpace(v.VoucherNo) ? v.VoucherNo : $"EXP-{v.ExpenseDate:yyyyMMdd}-{v.Id.ToString()[..6].ToUpper()}",
                VoucherType = "Payment",
                AccountHead = catName,
                Particulars = $"{v.Title} • Payee: {payee}{desc}",
                Division = "General",
                PaymentMode = modeStr,
                ReferenceNumber = v.BillInvoiceNo,
                DebitAmount = v.Amount,
                CreditAmount = 0m,
                PayeeOrPayerName = payee,
                Remarks = v.Description,
                CreatedBy = v.CreatedByUser?.FullName
            });
        }

        // (D) Faculty & Staff Salary Payments (Payments)
        var salaryQuery = _dbContext.TeacherSalaryPayments
            .AsNoTracking()
            .Include(s => s.Teacher)
            .Where(s => s.TenantId == tenantId && s.PaymentDate >= startUtc && s.PaymentDate <= endUtc);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            salaryQuery = salaryQuery.Where(s => s.Teacher != null && s.Teacher.BranchId == branchId.Value);
        }

        var salaryList = await salaryQuery.ToListAsync();
        foreach (var s in salaryList)
        {
            string modeStr = s.PaymentMode switch
            {
                SalaryPaymentMode.Cash => "Cash",
                SalaryPaymentMode.BankTransfer => "Bank Transfer",
                SalaryPaymentMode.Cheque => "Cheque",
                SalaryPaymentMode.UPI => "UPI / Online",
                _ => "Bank Transfer"
            };

            string teacherName = s.Teacher != null ? $"{s.Teacher.FullName} ({s.Teacher.Designation ?? "Staff"})" : "Faculty Member";
            string monthYear = new DateTime(s.PaymentYear, s.PaymentMonth, 1).ToString("MMM yyyy");
            string vNo = !string.IsNullOrWhiteSpace(s.ReceiptNumber) ? s.ReceiptNumber : $"SAL-{s.PaymentYear}{s.PaymentMonth:D2}-{s.Id.ToString()[..6].ToUpper()}";

            transactions.Add(new DayBookTransactionDto
            {
                Id = s.Id.ToString(),
                Timestamp = s.PaymentDate,
                VoucherNumber = vNo,
                VoucherType = "Payment",
                AccountHead = "Faculty & Staff Payroll",
                Particulars = $"{teacherName} • Salary Disbursal for {monthYear}",
                Division = "General",
                PaymentMode = modeStr,
                ReferenceNumber = s.TransactionRef,
                DebitAmount = s.NetPaid,
                CreditAmount = 0m,
                PayeeOrPayerName = s.Teacher?.FullName,
                Remarks = s.Remarks
            });
        }

        // (E) Teacher Salary Advances Disbursed (Payments)
        var advQuery = _dbContext.TeacherSalaryAdvances
            .AsNoTracking()
            .Include(a => a.Teacher)
            .Where(a => a.TenantId == tenantId &&
                   (a.Status == AdvanceStatus.Approved || a.Status == AdvanceStatus.Adjusted) &&
                   (a.ApprovedDate ?? a.RequestDate) >= startUtc &&
                   (a.ApprovedDate ?? a.RequestDate) <= endUtc);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            advQuery = advQuery.Where(a => a.Teacher != null && a.Teacher.BranchId == branchId.Value);
        }

        var advList = await advQuery.ToListAsync();
        foreach (var a in advList)
        {
            DateTime advDate = a.ApprovedDate ?? a.RequestDate;
            string teacherName = a.Teacher?.FullName ?? "Staff Member";
            string reason = !string.IsNullOrWhiteSpace(a.Reason) ? a.Reason : "Personal/Urgent";

            transactions.Add(new DayBookTransactionDto
            {
                Id = a.Id.ToString(),
                Timestamp = advDate,
                VoucherNumber = $"ADV-{advDate:yyyyMMdd}-{a.Id.ToString()[..6].ToUpper()}",
                VoucherType = "Payment",
                AccountHead = "Staff Salary Advance",
                Particulars = $"{teacherName} • Salary Advance Disbursed ({reason})",
                Division = "General",
                PaymentMode = "Cash",
                DebitAmount = a.Amount,
                CreditAmount = 0m,
                PayeeOrPayerName = teacherName,
                Remarks = a.Reason
            });
        }

        // (E.1) Inventory Supplier Payments & Vendor Refunds
        var vPayQuery = _dbContext.InventoryVendorPayments
            .AsNoTracking()
            .Include(p => p.Vendor)
            .Where(p => p.TenantId == tenantId && p.PaymentDate >= startUtc && p.PaymentDate <= endUtc);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            vPayQuery = vPayQuery.Where(p => p.BranchId == branchId.Value);
        }

        var vPayList = await vPayQuery.ToListAsync();
        foreach (var p in vPayList)
        {
            var isRefund = string.Equals(p.PaymentType, "Refund", StringComparison.OrdinalIgnoreCase);
            var vendorName = p.Vendor?.VendorName ?? "Inventory Supplier";

            transactions.Add(new DayBookTransactionDto
            {
                Id = p.Id.ToString(),
                Timestamp = p.PaymentDate,
                VoucherNumber = p.VoucherNumber,
                VoucherType = isRefund ? "Receipt" : "Payment",
                AccountHead = isRefund ? "Vendor Refund (सप्लायर रिफंड)" : "Inventory Supplier Payment",
                Particulars = isRefund
                    ? $"{vendorName} • Refund Received ({p.PaymentMode}) {(string.IsNullOrWhiteSpace(p.ReferenceNumber) ? "" : $"[Ref: {p.ReferenceNumber}]")}".Trim()
                    : $"{vendorName} • Supplier Payment ({p.PaymentMode}) {(string.IsNullOrWhiteSpace(p.ReferenceNumber) ? "" : $"[Ref: {p.ReferenceNumber}]")}".Trim(),
                Division = "General",
                PaymentMode = p.PaymentMode,
                ReferenceNumber = p.ReferenceNumber,
                DebitAmount = isRefund ? 0m : p.Amount,
                CreditAmount = isRefund ? p.Amount : 0m,
                PayeeOrPayerName = vendorName,
                Remarks = p.Remarks
            });
        }

        // 4. Calculate Running Balance & Aggregates chronologically across all transactions for this day/scope
        transactions = transactions.OrderBy(t => t.Timestamp).ToList();

        decimal running = openingBalance;
        decimal totalInflow = 0m;
        decimal totalOutflow = 0m;
        decimal cashInflow = 0m;
        decimal bankInflow = 0m;
        decimal cashOutflow = 0m;
        decimal bankOutflow = 0m;
        int receiptCount = 0;
        int paymentCount = 0;

        foreach (var t in transactions)
        {
            if (t.VoucherType == "Receipt")
            {
                totalInflow += t.CreditAmount;
                receiptCount++;
                if (t.PaymentMode == "Cash") cashInflow += t.CreditAmount;
                else bankInflow += t.CreditAmount;
                running += t.CreditAmount;
            }
            else
            {
                totalOutflow += t.DebitAmount;
                paymentCount++;
                if (t.PaymentMode == "Cash") cashOutflow += t.DebitAmount;
                else bankOutflow += t.DebitAmount;
                running -= t.DebitAmount;
            }

            t.RunningBalance = running;
        }

        decimal netDailyChange = totalInflow - totalOutflow;
        decimal closingBalance = running;

        // 5. Server-Side Filtering (Voucher Type & Payment Mode)
        var filteredList = transactions.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(voucherType) && !voucherType.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            filteredList = filteredList.Where(t => t.VoucherType.Equals(voucherType, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(paymentMode) && !paymentMode.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            if (paymentMode.Equals("Cash", StringComparison.OrdinalIgnoreCase))
                filteredList = filteredList.Where(t => t.PaymentMode == "Cash");
            else if (paymentMode.Equals("Online", StringComparison.OrdinalIgnoreCase) || paymentMode.Equals("UPI", StringComparison.OrdinalIgnoreCase))
                filteredList = filteredList.Where(t => t.PaymentMode.Contains("UPI", StringComparison.OrdinalIgnoreCase) || t.PaymentMode.Contains("Online", StringComparison.OrdinalIgnoreCase));
            else if (paymentMode.Equals("Bank", StringComparison.OrdinalIgnoreCase) || paymentMode.Equals("BankTransfer", StringComparison.OrdinalIgnoreCase))
                filteredList = filteredList.Where(t => t.PaymentMode.Contains("Bank", StringComparison.OrdinalIgnoreCase));
            else if (paymentMode.Equals("Cheque", StringComparison.OrdinalIgnoreCase))
                filteredList = filteredList.Where(t => t.PaymentMode.Contains("Cheque", StringComparison.OrdinalIgnoreCase));
        }

        // 6. Server-Side Searching
        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            string term = searchTerm.Trim();
            filteredList = filteredList.Where(t =>
                (t.VoucherNumber != null && t.VoucherNumber.Contains(term, StringComparison.OrdinalIgnoreCase)) ||
                (t.Particulars != null && t.Particulars.Contains(term, StringComparison.OrdinalIgnoreCase)) ||
                (t.AccountHead != null && t.AccountHead.Contains(term, StringComparison.OrdinalIgnoreCase)) ||
                (t.PayeeOrPayerName != null && t.PayeeOrPayerName.Contains(term, StringComparison.OrdinalIgnoreCase)) ||
                (t.ReferenceNumber != null && t.ReferenceNumber.Contains(term, StringComparison.OrdinalIgnoreCase)) ||
                (t.Remarks != null && t.Remarks.Contains(term, StringComparison.OrdinalIgnoreCase))
            );
        }

        var matchingTransactions = filteredList.ToList();
        int totalFilteredCount = matchingTransactions.Count;

        // 7. Server-Side Sorting
        string sortCol = (sortBy ?? "timestamp").Trim().ToLowerInvariant();
        IEnumerable<DayBookTransactionDto> sortedTransactions = sortCol switch
        {
            "timestamp" => sortDescending ? matchingTransactions.OrderByDescending(t => t.Timestamp) : matchingTransactions.OrderBy(t => t.Timestamp),
            "vouchernumber" => sortDescending ? matchingTransactions.OrderByDescending(t => t.VoucherNumber) : matchingTransactions.OrderBy(t => t.VoucherNumber),
            "vouchertype" => sortDescending ? matchingTransactions.OrderByDescending(t => t.VoucherType) : matchingTransactions.OrderBy(t => t.VoucherType),
            "accounthead" => sortDescending ? matchingTransactions.OrderByDescending(t => t.AccountHead) : matchingTransactions.OrderBy(t => t.AccountHead),
            "particulars" => sortDescending ? matchingTransactions.OrderByDescending(t => t.Particulars) : matchingTransactions.OrderBy(t => t.Particulars),
            "paymentmode" => sortDescending ? matchingTransactions.OrderByDescending(t => t.PaymentMode) : matchingTransactions.OrderBy(t => t.PaymentMode),
            "debitamount" => sortDescending ? matchingTransactions.OrderByDescending(t => t.DebitAmount) : matchingTransactions.OrderBy(t => t.DebitAmount),
            "creditamount" => sortDescending ? matchingTransactions.OrderByDescending(t => t.CreditAmount) : matchingTransactions.OrderBy(t => t.CreditAmount),
            "runningbalance" => sortDescending ? matchingTransactions.OrderByDescending(t => t.RunningBalance) : matchingTransactions.OrderBy(t => t.RunningBalance),
            _ => sortDescending ? matchingTransactions.OrderByDescending(t => t.Timestamp) : matchingTransactions.OrderBy(t => t.Timestamp)
        };

        // 8. Server-Side Pagination
        int safePageSize = pageSize <= 0 ? 25 : Math.Min(pageSize, 500);
        int safePageNumber = pageNumber <= 0 ? 1 : pageNumber;
        int totalPages = (int)Math.Ceiling((double)totalFilteredCount / safePageSize);

        var pagedTransactions = sortedTransactions
            .Skip((safePageNumber - 1) * safePageSize)
            .Take(safePageSize)
            .ToList();

        var report = new DayBookReportDto(
            targetStartIst,
            targetStartIst,
            targetEndIst,
            branchId,
            branchName,
            openingBalance,
            totalInflow,
            totalOutflow,
            netDailyChange,
            closingBalance,
            cashInflow,
            bankInflow,
            cashOutflow,
            bankOutflow,
            transactions.Count,
            receiptCount,
            paymentCount,
            pagedTransactions,
            scope,
            safePageNumber,
            safePageSize,
            totalFilteredCount,
            totalPages
        );

        return Ok(report);
    }
}
