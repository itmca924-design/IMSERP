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

    [HttpGet("profit-loss")]
    public async Task<ActionResult<ProfitLossReportDto>> GetProfitLoss(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] string? financialYear = null,
        [FromQuery] Guid? branchId = null)
    {
        var tenantId = _currentUser.TenantId;
        DateTime start;
        DateTime end;

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
            // Default to current Indian Financial Year (April 1 to March 31)
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

        // 2. Query Direct Incomes from Fee Payments
        var feePaymentsQuery = _dbContext.FeePayments
            .AsNoTracking()
            .Include(p => p.Invoice)
                .ThenInclude(i => i!.Items)
            .Where(p => p.TenantId == tenantId && p.PaymentDate >= start && p.PaymentDate <= end);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            feePaymentsQuery = feePaymentsQuery.Where(p => p.BranchId == branchId.Value || (p.Invoice != null && p.Invoice.BranchId == branchId.Value));
        }

        var feePayments = await feePaymentsQuery.ToListAsync();
        decimal totalDirectIncome = feePayments.Sum(p => p.AmountPaid);

        // Group Incomes by Fee Head or Category
        var incomeMap = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);

        foreach (var p in feePayments)
        {
            if (p.Invoice?.Items != null && p.Invoice.Items.Count > 0)
            {
                decimal invoiceTotal = p.Invoice.TotalAmount > 0 ? p.Invoice.TotalAmount : 1m;
                foreach (var item in p.Invoice.Items)
                {
                    string head = string.IsNullOrWhiteSpace(item.HeadName) ? "General Tuition Fee" : item.HeadName.Trim();
                    decimal proportionalAmount = Math.Round((item.Amount / invoiceTotal) * p.AmountPaid, 2);
                    if (incomeMap.ContainsKey(head))
                        incomeMap[head] += proportionalAmount;
                    else
                        incomeMap[head] = proportionalAmount;
                }
            }
            else
            {
                string cat = p.Invoice?.InvoiceCategory ?? "Academic Fees";
                if (incomeMap.ContainsKey(cat))
                    incomeMap[cat] += p.AmountPaid;
                else
                    incomeMap[cat] = p.AmountPaid;
            }
        }

        if (incomeMap.Count == 0 && totalDirectIncome > 0)
        {
            incomeMap["Academic Tuition Fee"] = totalDirectIncome;
        }

        var incomeSummaryList = incomeMap.Select(kv => new IncomeHeadSummaryDto(
            Category: "Academic & Institutional Fees",
            HeadName: kv.Key,
            Amount: kv.Value,
            PercentageOfTotal: totalDirectIncome > 0 ? Math.Round((kv.Value / totalDirectIncome) * 100m, 1) : 0m
        )).OrderByDescending(x => x.Amount).ToList();

        // 3. Query Payroll Expenses from TeacherSalaryPayments
        var salaryPaymentsQuery = _dbContext.TeacherSalaryPayments
            .AsNoTracking()
            .Include(s => s.Teacher)
            .Where(s => s.TenantId == tenantId && s.PaymentDate >= start && s.PaymentDate <= end);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            salaryPaymentsQuery = salaryPaymentsQuery.Where(s => s.Teacher != null && s.Teacher.BranchId == branchId.Value);
        }

        var salaryPayments = await salaryPaymentsQuery.ToListAsync();
        decimal totalPayrollExpense = salaryPayments.Sum(s => s.NetPaid);

        // 4. Query Operating Expenses from ExpenseVouchers
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
                HeadName: "Faculty & Staff Salaries",
                Amount: totalPayrollExpense,
                PercentageOfTotal: totalExpense > 0 ? Math.Round((totalPayrollExpense / totalExpense) * 100m, 1) : 0m,
                IsPayroll: true
            ));
        }

        var groupedVouchers = vouchers
            .GroupBy(v => v.Category != null ? v.Category.Name : "General Expenses")
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

        // 5. Monthly Surplus Trend (12 Months)
        var monthlyTrends = new List<MonthlySurplusTrendDto>();
        var curMonth = new DateTime(start.Year, start.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        while (curMonth <= end)
        {
            int year = curMonth.Year;
            int month = curMonth.Month;
            string monthLabel = curMonth.ToString("MMM yyyy", CultureInfo.InvariantCulture);

            decimal monthIncome = feePayments
                .Where(p => p.PaymentDate.Year == year && p.PaymentDate.Month == month)
                .Sum(p => p.AmountPaid);

            decimal monthPayroll = salaryPayments
                .Where(s => s.PaymentDate.Year == year && s.PaymentDate.Month == month)
                .Sum(s => s.NetPaid);

            decimal monthOpex = vouchers
                .Where(v => v.ExpenseDate.Year == year && v.ExpenseDate.Month == month)
                .Sum(v => v.Amount);

            decimal monthExpense = monthPayroll + monthOpex;
            decimal monthSurplus = monthIncome - monthExpense;

            monthlyTrends.Add(new MonthlySurplusTrendDto(
                MonthName: monthLabel,
                Month: month,
                Year: year,
                TotalIncome: monthIncome,
                TotalExpense: monthExpense,
                NetSurplus: monthSurplus
            ));

            curMonth = curMonth.AddMonths(1);
        }

        // 6. Net Profit / Loss Calculation
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
            MonthlyTrends: monthlyTrends
        );

        return Ok(report);
    }

    // =========================================================================
    // 2. BALANCE SHEET (STATEMENT OF FINANCIAL POSITION)
    // =========================================================================

    [HttpGet("balance-sheet")]
    public async Task<ActionResult<BalanceSheetReportDto>> GetBalanceSheet(
        [FromQuery] DateTime? asOfDate = null,
        [FromQuery] Guid? branchId = null)
    {
        var tenantId = _currentUser.TenantId;
        DateTime cutoff = asOfDate.HasValue 
            ? DateTime.SpecifyKind(asOfDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc)
            : DateTime.UtcNow;

        string branchName = "All Branches Consolidated";
        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            var branch = await _dbContext.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == branchId.Value);
            if (branch != null) branchName = branch.Name;
        }

        // ─── A. CURRENT ASSETS ──────────────────────────────────────────
        // 1. Cash In Hand Calculation (Opening + Cash Collections - Cash Salaries - Cash Expenses)
        var cashFeeCollected = await _dbContext.FeePayments
            .Where(p => p.TenantId == tenantId && p.Mode == PaymentMode.Cash && p.PaymentDate <= cutoff && (!branchId.HasValue || p.BranchId == branchId.Value))
            .SumAsync(p => (decimal?)p.AmountPaid) ?? 0m;

        var cashSalariesPaid = await _dbContext.TeacherSalaryPayments
            .Include(s => s.Teacher)
            .Where(s => s.TenantId == tenantId && s.PaymentMode == SalaryPaymentMode.Cash && s.PaymentDate <= cutoff && (!branchId.HasValue || (s.Teacher != null && s.Teacher.BranchId == branchId.Value)))
            .SumAsync(s => (decimal?)s.NetPaid) ?? 0m;

        var cashExpensesPaid = await _dbContext.ExpenseVouchers
            .Where(v => v.TenantId == tenantId && v.PaymentMode == ExpensePaymentMode.Cash && v.ExpenseDate <= cutoff && (!branchId.HasValue || v.BranchId == branchId.Value))
            .SumAsync(v => (decimal?)v.Amount) ?? 0m;

        var cashLedger = await _dbContext.AccountLedgers
            .FirstOrDefaultAsync(l => l.TenantId == tenantId && l.AccountCode == "CASH-MAIN");
        decimal cashOpening = cashLedger?.OpeningBalance ?? 0m;
        decimal cashInHandBalance = Math.Max(0m, cashOpening + cashFeeCollected - cashSalariesPaid - cashExpensesPaid);

        // 2. Bank Accounts Calculation
        var bankFeeCollected = await _dbContext.FeePayments
            .Where(p => p.TenantId == tenantId && p.Mode != PaymentMode.Cash && p.PaymentDate <= cutoff && (!branchId.HasValue || p.BranchId == branchId.Value))
            .SumAsync(p => (decimal?)p.AmountPaid) ?? 0m;

        var bankSalariesPaid = await _dbContext.TeacherSalaryPayments
            .Include(s => s.Teacher)
            .Where(s => s.TenantId == tenantId && s.PaymentMode != SalaryPaymentMode.Cash && s.PaymentDate <= cutoff && (!branchId.HasValue || (s.Teacher != null && s.Teacher.BranchId == branchId.Value)))
            .SumAsync(s => (decimal?)s.NetPaid) ?? 0m;

        var bankExpensesPaid = await _dbContext.ExpenseVouchers
            .Where(v => v.TenantId == tenantId && v.PaymentMode != ExpensePaymentMode.Cash && v.ExpenseDate <= cutoff && (!branchId.HasValue || v.BranchId == branchId.Value))
            .SumAsync(v => (decimal?)v.Amount) ?? 0m;

        var bankLedger = await _dbContext.AccountLedgers
            .FirstOrDefaultAsync(l => l.TenantId == tenantId && l.AccountCode == "BANK-MAIN");
        decimal bankOpening = bankLedger?.OpeningBalance ?? 0m;
        decimal bankAccountsBalance = Math.Max(0m, bankOpening + bankFeeCollected - bankSalariesPaid - bankExpensesPaid);

        // 3. Accounts Receivable (Student Fee Dues up to cutoff)
        var feeDuesQuery = _dbContext.FeeInvoices
            .Where(i => i.TenantId == tenantId && i.CreatedAt <= cutoff && i.Status != InvoiceStatus.Paid && i.Status != InvoiceStatus.Cancelled);
        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            feeDuesQuery = feeDuesQuery.Where(i => i.BranchId == branchId.Value);
        }
        decimal accountsReceivable = await feeDuesQuery.SumAsync(i => (decimal?)(i.TotalAmount - i.PaidAmount)) ?? 0m;

        // 4. Staff Salary Advances Receivable (Advances approved but not yet adjusted)
        var advancesQuery = _dbContext.TeacherSalaryAdvances
            .Include(a => a.Teacher)
            .Where(a => a.TenantId == tenantId && a.Status == AdvanceStatus.Approved && a.RequestDate <= cutoff);
        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            advancesQuery = advancesQuery.Where(a => a.Teacher != null && a.Teacher.BranchId == branchId.Value);
        }
        decimal staffAdvances = await advancesQuery.SumAsync(a => (decimal?)a.Amount) ?? 0m;

        var currentAssetItems = new List<BalanceSheetItemDto>
        {
            new BalanceSheetItemDto("CA-CASH", "Cash in Hand (Counter Float)", cashInHandBalance, "Liquid Cash", true, "Cash drawer balance after fee receipts & cash expenses"),
            new BalanceSheetItemDto("CA-BANK", "Bank Accounts Balance (Current & Savings)", bankAccountsBalance, "Bank Balances", true, "Primary bank balance after online fees, payroll & vouchers"),
            new BalanceSheetItemDto("CA-FEES", "Accounts Receivable (Student Fee Dues)", accountsReceivable, "Receivables", true, "Outstanding student fee invoices dues"),
            new BalanceSheetItemDto("CA-ADV", "Staff Advances Receivable", staffAdvances, "Advances", true, "Unadjusted salary advances disbursed to faculty/staff")
        };

        // Other configured Current Assets in AccountLedgers
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
        // Compute Current Period Net Profit up to cutoff date
        var totalIncomeAllTime = await _dbContext.FeePayments
            .Where(p => p.TenantId == tenantId && p.PaymentDate <= cutoff && (!branchId.HasValue || p.BranchId == branchId.Value))
            .SumAsync(p => (decimal?)p.AmountPaid) ?? 0m;

        var totalSalariesAllTime = await _dbContext.TeacherSalaryPayments
            .Include(s => s.Teacher)
            .Where(s => s.TenantId == tenantId && s.PaymentDate <= cutoff && (!branchId.HasValue || (s.Teacher != null && s.Teacher.BranchId == branchId.Value)))
            .SumAsync(s => (decimal?)s.NetPaid) ?? 0m;

        var totalExpensesAllTime = await _dbContext.ExpenseVouchers
            .Where(v => v.TenantId == tenantId && v.ExpenseDate <= cutoff && (!branchId.HasValue || v.BranchId == branchId.Value))
            .SumAsync(v => (decimal?)v.Amount) ?? 0m;

        decimal netProfitSurplus = totalIncomeAllTime - (totalSalariesAllTime + totalExpensesAllTime);

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
            Title: "Net Profit / Surplus (Transferred from P&L)",
            Amount: netProfitSurplus,
            Category: "Reserves & Surplus",
            IsDynamic: true,
            Note: "Accumulated net surplus from academic fee revenues after payroll & operating costs"
        ));

        // Auto-balance adjustment item if needed for capital balancing
        decimal preliminaryLiabilities = currentLiabilitiesGroup.TotalAmount + longTermLiabilitiesGroup.TotalAmount;
        decimal preliminaryEquity = equityItems.Sum(x => x.Amount);
        decimal initialDifference = totalAssets - (preliminaryLiabilities + preliminaryEquity);

        // If capital is 0 and there is initial difference, reflect in Institute Capital / Corpus Fund
        var capitalItem = equityItems.FirstOrDefault(e => e.Code == "EQ-CAPITAL");
        if (capitalItem != null && capitalItem.Amount == 0 && initialDifference > 0)
        {
            equityItems.Remove(capitalItem);
            equityItems.Insert(0, capitalItem with { Amount = initialDifference, Note = "Initial balancing capital / corpus fund" });
        }

        var equityGroup = new BalanceSheetGroupDto("Capital Fund & Reserves", equityItems.Sum(x => x.Amount), equityItems);
        decimal totalLiabilitiesAndEquity = currentLiabilitiesGroup.TotalAmount + longTermLiabilitiesGroup.TotalAmount + equityGroup.TotalAmount;
        decimal finalDifference = Math.Round(totalAssets - totalLiabilitiesAndEquity, 2);
        bool isBalanced = Math.Abs(finalDifference) < 0.01m;

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
            CurrentPeriodProfit: netProfitSurplus
        );

        return Ok(report);
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
        var feeQueryMonth = _dbContext.FeePayments.Where(p => p.TenantId == tenantId && p.PaymentDate >= startOfMonth);
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
        var cashCollected = await _dbContext.FeePayments.Where(p => p.TenantId == tenantId && p.Mode == PaymentMode.Cash && (!branchId.HasValue || p.BranchId == branchId.Value)).SumAsync(p => (decimal?)p.AmountPaid) ?? 0m;
        var cashSalaries = await _dbContext.TeacherSalaryPayments.Include(s => s.Teacher).Where(s => s.TenantId == tenantId && s.PaymentMode == SalaryPaymentMode.Cash && (!branchId.HasValue || (s.Teacher != null && s.Teacher.BranchId == branchId.Value))).SumAsync(s => (decimal?)s.NetPaid) ?? 0m;
        var cashExpenses = await _dbContext.ExpenseVouchers.Where(v => v.TenantId == tenantId && v.PaymentMode == ExpensePaymentMode.Cash && (!branchId.HasValue || v.BranchId == branchId.Value)).SumAsync(v => (decimal?)v.Amount) ?? 0m;
        var cashLedger = await _dbContext.AccountLedgers.FirstOrDefaultAsync(l => l.TenantId == tenantId && l.AccountCode == "CASH-MAIN");
        decimal cashBalance = Math.Max(0m, (cashLedger?.OpeningBalance ?? 0m) + cashCollected - cashSalaries - cashExpenses);

        var bankCollected = await _dbContext.FeePayments.Where(p => p.TenantId == tenantId && p.Mode != PaymentMode.Cash && (!branchId.HasValue || p.BranchId == branchId.Value)).SumAsync(p => (decimal?)p.AmountPaid) ?? 0m;
        var bankSalaries = await _dbContext.TeacherSalaryPayments.Include(s => s.Teacher).Where(s => s.TenantId == tenantId && s.PaymentMode != SalaryPaymentMode.Cash && (!branchId.HasValue || (s.Teacher != null && s.Teacher.BranchId == branchId.Value))).SumAsync(s => (decimal?)s.NetPaid) ?? 0m;
        var bankExpenses = await _dbContext.ExpenseVouchers.Where(v => v.TenantId == tenantId && v.PaymentMode != ExpensePaymentMode.Cash && (!branchId.HasValue || v.BranchId == branchId.Value)).SumAsync(v => (decimal?)v.Amount) ?? 0m;
        var bankLedger = await _dbContext.AccountLedgers.FirstOrDefaultAsync(l => l.TenantId == tenantId && l.AccountCode == "BANK-MAIN");
        decimal bankBalance = Math.Max(0m, (bankLedger?.OpeningBalance ?? 0m) + bankCollected - bankSalaries - bankExpenses);

        // Current FY Revenue & Expenses
        var fyIncome = await _dbContext.FeePayments.Where(p => p.TenantId == tenantId && p.PaymentDate >= startOfFy && (!branchId.HasValue || p.BranchId == branchId.Value)).SumAsync(p => (decimal?)p.AmountPaid) ?? 0m;
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
}
