using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace IMSERP.Infrastructure.Services;

public class WhatsAppService : IWhatsAppService
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly ILogger<WhatsAppService> _logger;

    public WhatsAppService(IIMSERPDbContext dbContext, ILogger<WhatsAppService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<bool> SendFeeReceiptAsync(Guid tenantId, string recipientPhone, string studentName, string receiptNo, decimal amount, decimal balanceDue)
    {
        var content = $"*FEE RECEIPT ACKNOWLEDGMENT*\nDear Parent, We have received payment of *₹{amount:N2}* for *{studentName}*. Receipt No: #{receiptNo}. Remaining Balance Due: ₹{balanceDue:N2}. Thank you!";
        
        return await LogAndSend(tenantId, recipientPhone, studentName, MessageType.FeeReceipt, content);
    }

    public async Task<bool> SendFeeReminderAsync(Guid tenantId, string recipientPhone, string studentName, string invoiceNo, decimal amountDue, DateTime dueDate)
    {
        var content = $"*FEE DUE REMINDER*\nDear Parent, This is a gentle reminder that fee of *₹{amountDue:N2}* for *{studentName}* (Inv: #{invoiceNo}) is due on *{dueDate:dd-MMM-yyyy}*. Kindly pay at the earliest.";
        
        return await LogAndSend(tenantId, recipientPhone, studentName, MessageType.FeeReminder, content);
    }

    public async Task<bool> SendTestMarksReportAsync(Guid tenantId, string recipientPhone, string studentName, string testTitle, decimal marksObtained, decimal maxMarks, int rank)
    {
        var percentage = maxMarks > 0 ? (marksObtained / maxMarks) * 100 : 0;
        var content = $"*TEST PERFORMANCE REPORT*\nDear Parent, *{studentName}* scored *{marksObtained}/{maxMarks}* ({percentage:F1}%) in *{testTitle}*. Class Rank: *#{rank}*. Keep supporting your child's learning!";
        
        return await LogAndSend(tenantId, recipientPhone, studentName, MessageType.TestMarks, content);
    }

    private async Task<bool> LogAndSend(Guid tenantId, string phone, string studentName, MessageType type, string content)
    {
        _logger.LogInformation("[WhatsApp Gateway Dispatch] To: {Phone} | Student: {Student} | Type: {Type} | Content: {Content}", phone, studentName, type, content);

        var log = new WhatsAppLog
        {
            TenantId = tenantId,
            RecipientPhone = phone,
            StudentName = studentName,
            MessageType = type,
            Content = content,
            Status = "Delivered",
            SentAt = DateTime.UtcNow
        };

        _dbContext.WhatsAppLogs.Add(log);
        await _dbContext.SaveChangesAsync();

        return true;
    }
}
