namespace IMSERP.Domain.Enums;

public enum UserRole
{
    SuperAdmin = 1,
    InstituteAdmin = 2,
    Teacher = 3,
    Accountant = 4,
    Parent = 5,
    Student = 6
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
    Announcement = 4
}

// Teacher Module Enums
public enum TeacherAttendanceStatus
{
    Present = 1,
    Absent = 2,
    Late = 3,
    HalfDay = 4,
    Holiday = 5,
    WeekOff = 6
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

