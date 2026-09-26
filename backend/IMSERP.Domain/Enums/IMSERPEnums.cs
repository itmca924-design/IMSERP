namespace IMSERP.Domain.Enums;

public enum UserRole
{
    SuperAdmin = 1,
    InstituteAdmin = 2,
    Teacher = 3,
    Accountant = 4,
    Parent = 5,
    Student = 6,
    HR = 7
}

public enum PaymentMode
{
    Cash = 1,
    UPI = 2,
    Card = 3,
    NetBanking = 4
}

public enum InvoiceStatus
{
    Pending = 1,
    Partial = 2,
    Paid = 3,
    Overdue = 4,
    Cancelled = 5
}

public enum MessageType
{
    FeeReceipt = 1,
    FeeReminder = 2,
    TestMarks = 3,
    Announcement = 4,
    SalarySlip = 5
}

// Teacher / Staff Module Enums
public enum StaffType
{
    Teaching = 1,
    NonTeaching = 2
}

public enum TeacherAttendanceStatus
{
    Present = 1,
    Absent = 2,
    Late = 3,
    HalfDay = 4,
    Holiday = 5,
    WeekOff = 6,
    Leave = 7
}

public enum LeaveType
{
    CasualLeave = 1,
    SickLeave = 2,
    EarnedLeave = 3,
    UnpaidLeave = 4,
    MaternityLeave = 5,
    EmergencyLeave = 6
}

public enum LeaveStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3,
    Cancelled = 4
}

public enum AdvanceStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3,
    Adjusted = 4
}

public enum SalaryPaymentMode
{
    Cash = 1,
    BankTransfer = 2,
    UPI = 3,
    Cheque = 4
}

public enum Gender
{
    Male = 1,
    Female = 2,
    Other = 3
}

public enum BillingCycle
{
    Monthly = 1,
    Quarterly = 3,
    HalfYearly = 6,
    Yearly = 12
}

// ─── Finance, Balance Sheet & Accounting Enums ─────────────────
public enum AccountType
{
    Asset = 1,
    Liability = 2,
    Equity = 3,
    Income = 4,
    Expense = 5
}

public enum AccountSubType
{
    CurrentAsset = 1,
    FixedAsset = 2,
    CurrentLiability = 3,
    LongTermLiability = 4,
    Capital = 5
}

public enum ExpensePaymentMode
{
    Cash = 1,
    UPI = 2,
    BankTransfer = 3,
    Cheque = 4,
    Card = 5
}

