using System.Text;
using IMSERP.Application.Interfaces;
using IMSERP.Infrastructure.Persistence;
using IMSERP.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// 1. Infrastructure Services
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IWhatsAppService, WhatsAppService>();
builder.Services.AddScoped<IPasswordHasherService, PasswordHasherService>();
builder.Services.AddScoped<IAutomationService, AutomationService>();
builder.Services.AddScoped<IFeeRecoveryAgentService, FeeRecoveryAgentService>();
builder.Services.AddHostedService<InstituteAutomationBackgroundService>();

// 2. DbContext Configuration (SQL Server Database: IMSERP)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddDbContext<IMSERPDbContext>(options =>
{
    if (!string.IsNullOrEmpty(connectionString))
    {
        options.UseSqlServer(connectionString, sqlOptions =>
        {
            sqlOptions.CommandTimeout(60);
            sqlOptions.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(10),
                errorNumbersToAdd: null);
        });
    }
    else
    {
        options.UseInMemoryDatabase("IMSERPCoaching_Db");
    }
});

builder.Services.AddScoped<IIMSERPDbContext>(provider => provider.GetRequiredService<IMSERPDbContext>());

// 3. JWT Authentication
var secretKey = builder.Configuration["Jwt:Key"] ?? "SuperSecretKeyForIMSERPCoachingSaaSApp123456!";
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey))
    };
    options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return System.Threading.Tasks.Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

// SignalR & Presence Tracking
builder.Services.AddSignalR();
builder.Services.AddSingleton<IMSERP.API.Services.PresenceTracker>();

// 4. Controllers & OpenAPI
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// 5. CORS for Angular Material UI
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.SetIsOriginAllowed(origin => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Ensure Database, Tables & Valid Hashed Passwords on startup
using (var scope = app.Services.CreateScope())
{
    try
    {
        var context = scope.ServiceProvider.GetRequiredService<IMSERPDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasherService>();
        
        context.Database.EnsureCreated();

        // Payslip snapshot columns on TeacherSalaryPayments
        try
        {
            context.Database.ExecuteSqlRaw(@"
                IF OBJECT_ID('TeacherSalaryPayments') IS NOT NULL
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TeacherSalaryPayments') AND name = 'WorkingDays') ALTER TABLE TeacherSalaryPayments ADD WorkingDays INT NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TeacherSalaryPayments') AND name = 'HalfDays') ALTER TABLE TeacherSalaryPayments ADD HalfDays INT NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TeacherSalaryPayments') AND name = 'LateDays') ALTER TABLE TeacherSalaryPayments ADD LateDays INT NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TeacherSalaryPayments') AND name = 'PaidLeaveDays') ALTER TABLE TeacherSalaryPayments ADD PaidLeaveDays INT NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TeacherSalaryPayments') AND name = 'UnpaidLeaveDays') ALTER TABLE TeacherSalaryPayments ADD UnpaidLeaveDays INT NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TeacherSalaryPayments') AND name = 'LopDays') ALTER TABLE TeacherSalaryPayments ADD LopDays DECIMAL(18,2) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TeacherSalaryPayments') AND name = 'PerDayRate') ALTER TABLE TeacherSalaryPayments ADD PerDayRate DECIMAL(18,2) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TeacherSalaryPayments') AND name = 'BasicSalary') ALTER TABLE TeacherSalaryPayments ADD BasicSalary DECIMAL(18,2) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TeacherSalaryPayments') AND name = 'HRA') ALTER TABLE TeacherSalaryPayments ADD HRA DECIMAL(18,2) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TeacherSalaryPayments') AND name = 'OtherAllowances') ALTER TABLE TeacherSalaryPayments ADD OtherAllowances DECIMAL(18,2) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TeacherSalaryPayments') AND name = 'AttendanceDeduction') ALTER TABLE TeacherSalaryPayments ADD AttendanceDeduction DECIMAL(18,2) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TeacherSalaryPayments') AND name = 'PFDeduction') ALTER TABLE TeacherSalaryPayments ADD PFDeduction DECIMAL(18,2) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TeacherSalaryPayments') AND name = 'TDSDeduction') ALTER TABLE TeacherSalaryPayments ADD TDSDeduction DECIMAL(18,2) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TeacherSalaryPayments') AND name = 'OtherStatutoryDeduction') ALTER TABLE TeacherSalaryPayments ADD OtherStatutoryDeduction DECIMAL(18,2) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TeacherSalaryPayments') AND name = 'HostelDeduction') ALTER TABLE TeacherSalaryPayments ADD HostelDeduction DECIMAL(18,2) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TeacherSalaryPayments') AND name = 'TransportDeduction') ALTER TABLE TeacherSalaryPayments ADD TransportDeduction DECIMAL(18,2) NULL;
                END");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Startup] TeacherSalaryPayments snapshot columns patch failed: {ex.Message}");
        }

        // Batch Shift & Timings columns on Batches
        try
        {
            context.Database.ExecuteSqlRaw(@"
                IF OBJECT_ID('Batches') IS NOT NULL
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Batches') AND name = 'Shift')
                        ALTER TABLE Batches ADD Shift NVARCHAR(30) NULL;

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Batches') AND name = 'StartTime')
                        ALTER TABLE Batches ADD StartTime NVARCHAR(10) NULL;

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Batches') AND name = 'EndTime')
                        ALTER TABLE Batches ADD EndTime NVARCHAR(10) NULL;

                    EXEC sp_executesql N'
                        UPDATE Batches
                        SET
                            Shift = CASE
                                WHEN Shift IS NULL AND (Name LIKE N''%Morning%'' OR Name LIKE N''%6th To 10th%'') THEN N''Morning''
                                WHEN Shift IS NULL AND Name LIKE N''%Evening%'' THEN N''Evening''
                                ELSE Shift
                            END,
                            StartTime = CASE
                                WHEN (StartTime IS NULL OR StartTime = '''') AND (Name LIKE N''%Morning%'' OR Name LIKE N''%6th To 10th%'') THEN N''05:00''
                                WHEN (StartTime IS NULL OR StartTime = '''') AND Name LIKE N''%Evening%'' THEN N''16:00''
                                WHEN (StartTime IS NULL OR StartTime = '''') THEN N''07:00''
                                ELSE StartTime
                            END,
                            EndTime = CASE
                                WHEN (EndTime IS NULL OR EndTime = '''') AND (Name LIKE N''%Morning%'' OR Name LIKE N''%6th To 10th%'') THEN N''07:30''
                                WHEN (EndTime IS NULL OR EndTime = '''') AND Name LIKE N''%Evening%'' THEN N''19:00''
                                WHEN (EndTime IS NULL OR EndTime = '''') THEN N''10:00''
                                ELSE EndTime
                            END
                        WHERE Shift IS NULL
                           OR StartTime IS NULL
                           OR StartTime = ''''
                           OR EndTime IS NULL
                           OR EndTime = '''';';
                END");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Startup] Batches Shift/Timing columns patch failed: {ex.Message}");
        }

        // SchoolNotices BatchId, BatchName & BranchId columns
        try
        {
            context.Database.ExecuteSqlRaw(@"
                IF OBJECT_ID('SchoolNotices') IS NOT NULL
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SchoolNotices') AND name = 'BranchId')
                        ALTER TABLE SchoolNotices ADD BranchId UNIQUEIDENTIFIER NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SchoolNotices') AND name = 'BatchId')
                        ALTER TABLE SchoolNotices ADD BatchId UNIQUEIDENTIFIER NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SchoolNotices') AND name = 'BatchName')
                        ALTER TABLE SchoolNotices ADD BatchName NVARCHAR(200) NULL;
                END
                ELSE
                BEGIN
                    CREATE TABLE SchoolNotices (
                        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                        TenantId UNIQUEIDENTIFIER NOT NULL,
                        BranchId UNIQUEIDENTIFIER NULL,
                        NoticeNumber NVARCHAR(50) NOT NULL DEFAULT '',
                        Title NVARCHAR(250) NOT NULL DEFAULT '',
                        Content NVARCHAR(MAX) NOT NULL DEFAULT '',
                        Category NVARCHAR(100) NOT NULL DEFAULT 'Academic',
                        TargetAudience NVARCHAR(100) NOT NULL DEFAULT 'All',
                        ClassId UNIQUEIDENTIFIER NULL,
                        ClassName NVARCHAR(150) NULL,
                        BatchId UNIQUEIDENTIFIER NULL,
                        BatchName NVARCHAR(200) NULL,
                        Priority NVARCHAR(50) NOT NULL DEFAULT 'Normal',
                        PublishDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        ExpiryDate DATETIME2 NULL,
                        AttachmentUrl NVARCHAR(MAX) NULL,
                        IsPinned BIT NOT NULL DEFAULT 0,
                        IsActive BIT NOT NULL DEFAULT 1,
                        CreatedBy NVARCHAR(150) NULL,
                        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                    );
                END");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Startup] SchoolNotices columns patch failed: {ex.Message}");
        }

        // Student Absence Fine columns on AttendanceSettings
        try
        {
            context.Database.ExecuteSqlRaw(@"
                IF OBJECT_ID('AttendanceSettings') IS NOT NULL
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AttendanceSettings') AND name = 'EnableStudentAbsenceFine')
                        ALTER TABLE AttendanceSettings ADD EnableStudentAbsenceFine BIT NOT NULL DEFAULT 1;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AttendanceSettings') AND name = 'AbsenceFineDaysThreshold')
                        ALTER TABLE AttendanceSettings ADD AbsenceFineDaysThreshold INT NOT NULL DEFAULT 3;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AttendanceSettings') AND name = 'AbsenceFineAmount')
                        ALTER TABLE AttendanceSettings ADD AbsenceFineAmount DECIMAL(18,2) NOT NULL DEFAULT 10.00;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AttendanceSettings') AND name = 'AbsenceFineMode')
                        ALTER TABLE AttendanceSettings ADD AbsenceFineMode NVARCHAR(50) NOT NULL DEFAULT 'PerBlock';
                END");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Startup] AttendanceSettings absence fine columns patch failed: {ex.Message}");
        }

        if (!string.IsNullOrEmpty(connectionString))
        {
            try
            {
                context.Database.ExecuteSqlRaw(@"
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SchoolClasses') AND name = 'AcademicScope')
                        ALTER TABLE SchoolClasses ADD AcademicScope NVARCHAR(50) NOT NULL DEFAULT 'Both';

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'HasSchoolModule')
                        ALTER TABLE Tenants ADD HasSchoolModule BIT NOT NULL DEFAULT 1;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'HasCoachingModule')
                        ALTER TABLE Tenants ADD HasCoachingModule BIT NOT NULL DEFAULT 1;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'HasHostelModule')
                        ALTER TABLE Tenants ADD HasHostelModule BIT NOT NULL DEFAULT 1;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'HasLibraryModule')
                        ALTER TABLE Tenants ADD HasLibraryModule BIT NOT NULL DEFAULT 1;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'HasTransportModule')
                        ALTER TABLE Tenants ADD HasTransportModule BIT NOT NULL DEFAULT 1;

                    -- TransportAttendances Live Boarding & Tracking Columns
                    IF OBJECT_ID('TransportAttendances') IS NOT NULL
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TransportAttendances') AND name = 'Status')
                            ALTER TABLE TransportAttendances ADD [Status] NVARCHAR(50) NOT NULL DEFAULT 'Pending';
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TransportAttendances') AND name = 'DroppedAt')
                            ALTER TABLE TransportAttendances ADD [DroppedAt] DATETIME2 NULL;
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TransportAttendances') AND name = 'Remarks')
                            ALTER TABLE TransportAttendances ADD [Remarks] NVARCHAR(255) NULL;
                    END

                    -- UPI Dynamic QR & Online Fee Collection Columns
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'UpiId')
                        ALTER TABLE Tenants ADD UpiId NVARCHAR(150) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'UpiMerchantName')
                        ALTER TABLE Tenants ADD UpiMerchantName NVARCHAR(200) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'UpiMerchantCode')
                        ALTER TABLE Tenants ADD UpiMerchantCode NVARCHAR(20) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'UpiQrEnabled')
                        ALTER TABLE Tenants ADD UpiQrEnabled BIT NOT NULL DEFAULT 1;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'UpiAutoVerify')
                        ALTER TABLE Tenants ADD UpiAutoVerify BIT NOT NULL DEFAULT 1;

                    -- Company Settlement Bank Account Columns
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'BankName')
                        ALTER TABLE Tenants ADD BankName NVARCHAR(150) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'BankAccountNumber')
                        ALTER TABLE Tenants ADD BankAccountNumber NVARCHAR(50) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'BankIfscCode')
                        ALTER TABLE Tenants ADD BankIfscCode NVARCHAR(20) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'BankAccountHolderName')
                        ALTER TABLE Tenants ADD BankAccountHolderName NVARCHAR(200) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'BankAccountType')
                        ALTER TABLE Tenants ADD BankAccountType NVARCHAR(50) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'BankBranch')
                        ALTER TABLE Tenants ADD BankBranch NVARCHAR(150) NULL;

                    -- Institute / Tenant profile & contact columns
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'Email')
                        ALTER TABLE Tenants ADD Email NVARCHAR(150) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'City')
                        ALTER TABLE Tenants ADD City NVARCHAR(100) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'State')
                        ALTER TABLE Tenants ADD State NVARCHAR(100) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'Pincode')
                        ALTER TABLE Tenants ADD Pincode NVARCHAR(20) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'Website')
                        ALTER TABLE Tenants ADD Website NVARCHAR(200) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'AffiliationNumber')
                        ALTER TABLE Tenants ADD AffiliationNumber NVARCHAR(100) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'EstablishedYear')
                        ALTER TABLE Tenants ADD EstablishedYear NVARCHAR(20) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'OfficialSeal')
                        ALTER TABLE Tenants ADD OfficialSeal NVARCHAR(MAX) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'DigitalSignature')
                        ALTER TABLE Tenants ADD DigitalSignature NVARCHAR(MAX) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'OfficialSealsJson')
                        ALTER TABLE Tenants ADD OfficialSealsJson NVARCHAR(MAX) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'DigitalSignaturesJson')
                        ALTER TABLE Tenants ADD DigitalSignaturesJson NVARCHAR(MAX) NULL;

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Branches') AND name = 'UpiId')
                        ALTER TABLE Branches ADD UpiId NVARCHAR(150) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Branches') AND name = 'UpiMerchantName')
                        ALTER TABLE Branches ADD UpiMerchantName NVARCHAR(200) NULL;

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Branches') AND name = 'BankName')
                        ALTER TABLE Branches ADD BankName NVARCHAR(150) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Branches') AND name = 'BankAccountNumber')
                        ALTER TABLE Branches ADD BankAccountNumber NVARCHAR(50) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Branches') AND name = 'BankIfscCode')
                        ALTER TABLE Branches ADD BankIfscCode NVARCHAR(20) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Branches') AND name = 'BankAccountHolderName')
                        ALTER TABLE Branches ADD BankAccountHolderName NVARCHAR(200) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Branches') AND name = 'BankAccountType')
                        ALTER TABLE Branches ADD BankAccountType NVARCHAR(50) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Branches') AND name = 'BankBranch')
                        ALTER TABLE Branches ADD BankBranch NVARCHAR(150) NULL;

                    -- Branch contact & location columns
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Branches') AND name = 'Email')
                        ALTER TABLE Branches ADD Email NVARCHAR(150) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Branches') AND name = 'City')
                        ALTER TABLE Branches ADD City NVARCHAR(100) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Branches') AND name = 'State')
                        ALTER TABLE Branches ADD State NVARCHAR(100) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Branches') AND name = 'Pincode')
                        ALTER TABLE Branches ADD Pincode NVARCHAR(20) NULL;

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeePayments') AND name = 'UpiRrn')
                        ALTER TABLE FeePayments ADD UpiRrn NVARCHAR(100) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeePayments') AND name = 'PayerVpa')
                        ALTER TABLE FeePayments ADD PayerVpa NVARCHAR(100) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeePayments') AND name = 'PayerName')
                        ALTER TABLE FeePayments ADD PayerName NVARCHAR(200) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeePayments') AND name = 'PayerPhone')
                        ALTER TABLE FeePayments ADD PayerPhone NVARCHAR(50) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeePayments') AND name = 'OnlinePaymentStatus')
                        ALTER TABLE FeePayments ADD OnlinePaymentStatus NVARCHAR(50) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeePayments') AND name = 'VerifiedBy')
                        ALTER TABLE FeePayments ADD VerifiedBy NVARCHAR(100) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeePayments') AND name = 'VerifiedAt')
                        ALTER TABLE FeePayments ADD VerifiedAt DATETIME2 NULL;

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeeInvoiceItems') AND name = 'Description')
                        ALTER TABLE FeeInvoiceItems ADD Description NVARCHAR(300) NULL;

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'ActiveSessionId')
                        ALTER TABLE Users ADD ActiveSessionId NVARCHAR(100) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'LastActiveAt')
                        ALTER TABLE Users ADD LastActiveAt DATETIME2 NULL;

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'LeavingDate')
                        ALTER TABLE Students ADD LeavingDate DATETIME2 NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'LeavingReason')
                        ALTER TABLE Students ADD LeavingReason NVARCHAR(MAX) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'TCNumber')
                        ALTER TABLE Students ADD TCNumber NVARCHAR(MAX) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'AadhaarNumber')
                        ALTER TABLE Students ADD AadhaarNumber NVARCHAR(50) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'PenNumber')
                        ALTER TABLE Students ADD PenNumber NVARCHAR(50) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'ApaarId')
                        ALTER TABLE Students ADD ApaarId NVARCHAR(50) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'Category')
                        ALTER TABLE Students ADD Category NVARCHAR(50) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'Religion')
                        ALTER TABLE Students ADD Religion NVARCHAR(50) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'EmergencyContactName')
                        ALTER TABLE Students ADD EmergencyContactName NVARCHAR(100) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'EmergencyContactPhone')
                        ALTER TABLE Students ADD EmergencyContactPhone NVARCHAR(50) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'PreviousSchoolName')
                        ALTER TABLE Students ADD PreviousSchoolName NVARCHAR(200) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'PreviousBoard')
                        ALTER TABLE Students ADD PreviousBoard NVARCHAR(50) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'IsDeleted')
                        ALTER TABLE Students ADD IsDeleted BIT NOT NULL DEFAULT 0;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'DeletedAt')
                        ALTER TABLE Students ADD DeletedAt DATETIME2 NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'DeletedBy')
                        ALTER TABLE Students ADD DeletedBy UNIQUEIDENTIFIER NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'CoachingJoiningDate')
                        ALTER TABLE Students ADD CoachingJoiningDate DATETIME2 NULL;

                    -- Tests table schema updates for School Examination support
                    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tests') AND name = 'BatchId' AND is_nullable = 0)
                        ALTER TABLE Tests ALTER COLUMN BatchId UNIQUEIDENTIFIER NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tests') AND name = 'ClassId')
                        ALTER TABLE Tests ADD ClassId UNIQUEIDENTIFIER NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tests') AND name = 'SectionId')
                        ALTER TABLE Tests ADD SectionId UNIQUEIDENTIFIER NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tests') AND name = 'ExamType')
                        ALTER TABLE Tests ADD ExamType NVARCHAR(MAX) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tests') AND name = 'AcademicYear')
                        ALTER TABLE Tests ADD AcademicYear NVARCHAR(MAX) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tests') AND name = 'PassingMarks')
                        ALTER TABLE Tests ADD PassingMarks DECIMAL(18,2) NOT NULL DEFAULT 33;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tests') AND name = 'EvaluatorTeacherId')
                        ALTER TABLE Tests ADD EvaluatorTeacherId UNIQUEIDENTIFIER NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tests') AND name = 'EvaluationStatus')
                        ALTER TABLE Tests ADD EvaluationStatus NVARCHAR(50) NOT NULL DEFAULT 'Scheduled';
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tests') AND name = 'EvaluationDueDate')
                        ALTER TABLE Tests ADD EvaluationDueDate DATETIME2 NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tests') AND name = 'TotalCopiesIssued')
                        ALTER TABLE Tests ADD TotalCopiesIssued INT NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tests') AND name = 'CopiesSubmittedDate')
                        ALTER TABLE Tests ADD CopiesSubmittedDate DATETIME2 NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tests') AND name = 'IsMarksLocked')
                        ALTER TABLE Tests ADD IsMarksLocked BIT NOT NULL DEFAULT 0;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tests') AND name = 'MarksLockedAt')
                        ALTER TABLE Tests ADD MarksLockedAt DATETIME2 NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tests') AND name = 'MarksLockedBy')
                        ALTER TABLE Tests ADD MarksLockedBy NVARCHAR(150) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tests') AND name = 'EvaluationRemarks')
                        ALTER TABLE Tests ADD EvaluationRemarks NVARCHAR(MAX) NULL;
                    ELSE
                        ALTER TABLE Tests ALTER COLUMN EvaluationRemarks NVARCHAR(MAX) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeeInvoices') AND name = 'ClassId')
                        ALTER TABLE FeeInvoices ADD ClassId UNIQUEIDENTIFIER NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeeInvoices') AND name = 'SectionId')
                        ALTER TABLE FeeInvoices ADD SectionId UNIQUEIDENTIFIER NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeeInvoices') AND name = 'ClassName')
                        ALTER TABLE FeeInvoices ADD ClassName NVARCHAR(100) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeeInvoices') AND name = 'SectionName')
                        ALTER TABLE FeeInvoices ADD SectionName NVARCHAR(50) NULL;

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('StudentAttendances') AND name = 'CheckInTime')
                        ALTER TABLE StudentAttendances ADD CheckInTime NVARCHAR(20) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('StudentAttendances') AND name = 'CheckOutTime')
                        ALTER TABLE StudentAttendances ADD CheckOutTime NVARCHAR(20) NULL;

                    IF OBJECT_ID('dbo.AttendanceSettings', 'U') IS NOT NULL
                    BEGIN
                        IF COL_LENGTH('dbo.AttendanceSettings', 'BranchId') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [BranchId] UNIQUEIDENTIFIER NULL;
                        IF COL_LENGTH('dbo.AttendanceSettings', 'HostelMode') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [HostelMode] NVARCHAR(20) NOT NULL CONSTRAINT [DF_AttendanceSettings_HostelMode] DEFAULT ('Both');
                        IF COL_LENGTH('dbo.AttendanceSettings', 'TeacherShiftStartTime') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [TeacherShiftStartTime] NVARCHAR(20) NOT NULL CONSTRAINT [DF_AttendanceSettings_TeacherShiftStartTime] DEFAULT ('08:00');
                        IF COL_LENGTH('dbo.AttendanceSettings', 'TeacherShiftEndTime') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [TeacherShiftEndTime] NVARCHAR(20) NOT NULL CONSTRAINT [DF_AttendanceSettings_TeacherShiftEndTime] DEFAULT ('17:00');
                        IF COL_LENGTH('dbo.AttendanceSettings', 'TeacherGracePeriodMinutes') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [TeacherGracePeriodMinutes] INT NOT NULL CONSTRAINT [DF_AttendanceSettings_TeacherGracePeriodMinutes] DEFAULT (15);
                        IF COL_LENGTH('dbo.AttendanceSettings', 'TeacherHalfDayThresholdMinutes') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [TeacherHalfDayThresholdMinutes] INT NOT NULL CONSTRAINT [DF_AttendanceSettings_TeacherHalfDayThresholdMinutes] DEFAULT (240);
                        IF COL_LENGTH('dbo.AttendanceSettings', 'TeacherAllowedLateDaysPerMonth') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [TeacherAllowedLateDaysPerMonth] INT NOT NULL CONSTRAINT [DF_AttendanceSettings_TeacherAllowedLateDaysPerMonth] DEFAULT (3);
                        IF COL_LENGTH('dbo.AttendanceSettings', 'StudentShiftStartTime') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [StudentShiftStartTime] NVARCHAR(20) NOT NULL CONSTRAINT [DF_AttendanceSettings_StudentShiftStartTime] DEFAULT ('08:00');
                        IF COL_LENGTH('dbo.AttendanceSettings', 'StudentShiftEndTime') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [StudentShiftEndTime] NVARCHAR(20) NOT NULL CONSTRAINT [DF_AttendanceSettings_StudentShiftEndTime] DEFAULT ('14:00');
                        IF COL_LENGTH('dbo.AttendanceSettings', 'StudentGracePeriodMinutes') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [StudentGracePeriodMinutes] INT NOT NULL CONSTRAINT [DF_AttendanceSettings_StudentGracePeriodMinutes] DEFAULT (15);
                        IF COL_LENGTH('dbo.AttendanceSettings', 'StudentHalfDayThresholdMinutes') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [StudentHalfDayThresholdMinutes] INT NOT NULL CONSTRAINT [DF_AttendanceSettings_StudentHalfDayThresholdMinutes] DEFAULT (240);
                        IF COL_LENGTH('dbo.AttendanceSettings', 'StudentAllowedLateDaysPerMonth') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [StudentAllowedLateDaysPerMonth] INT NOT NULL CONSTRAINT [DF_AttendanceSettings_StudentAllowedLateDaysPerMonth] DEFAULT (3);
                        IF COL_LENGTH('dbo.AttendanceSettings', 'TeacherWeeklyOffPattern') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [TeacherWeeklyOffPattern] NVARCHAR(50) NOT NULL CONSTRAINT [DF_AttendanceSettings_TeacherWeeklyOffPattern] DEFAULT ('SundayOnly');
                        IF COL_LENGTH('dbo.AttendanceSettings', 'StudentWeeklyOffPattern') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [StudentWeeklyOffPattern] NVARCHAR(50) NOT NULL CONSTRAINT [DF_AttendanceSettings_StudentWeeklyOffPattern] DEFAULT ('SundayOnly');
                        IF COL_LENGTH('dbo.AttendanceSettings', 'CoachingMode') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [CoachingMode] NVARCHAR(50) NOT NULL CONSTRAINT [DF_AttendanceSettings_CoachingMode] DEFAULT ('Both');
                        IF COL_LENGTH('dbo.AttendanceSettings', 'CoachingWeeklyOffPattern') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [CoachingWeeklyOffPattern] NVARCHAR(50) NOT NULL CONSTRAINT [DF_AttendanceSettings_CoachingWeeklyOffPattern] DEFAULT ('SundayOnly');
                        IF COL_LENGTH('dbo.AttendanceSettings', 'CoachingMorningStartTime') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [CoachingMorningStartTime] NVARCHAR(20) NOT NULL CONSTRAINT [DF_AttendanceSettings_CoachingMorningStartTime] DEFAULT ('07:00');
                        IF COL_LENGTH('dbo.AttendanceSettings', 'CoachingMorningEndTime') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [CoachingMorningEndTime] NVARCHAR(20) NOT NULL CONSTRAINT [DF_AttendanceSettings_CoachingMorningEndTime] DEFAULT ('10:00');
                        IF COL_LENGTH('dbo.AttendanceSettings', 'CoachingMorningGraceMinutes') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [CoachingMorningGraceMinutes] INT NOT NULL CONSTRAINT [DF_AttendanceSettings_CoachingMorningGraceMinutes] DEFAULT (15);
                        IF COL_LENGTH('dbo.AttendanceSettings', 'CoachingEveningStartTime') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [CoachingEveningStartTime] NVARCHAR(20) NOT NULL CONSTRAINT [DF_AttendanceSettings_CoachingEveningStartTime] DEFAULT ('16:00');
                        IF COL_LENGTH('dbo.AttendanceSettings', 'CoachingEveningEndTime') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [CoachingEveningEndTime] NVARCHAR(20) NOT NULL CONSTRAINT [DF_AttendanceSettings_CoachingEveningEndTime] DEFAULT ('19:00');
                        IF COL_LENGTH('dbo.AttendanceSettings', 'CoachingEveningGraceMinutes') IS NULL
                            ALTER TABLE [dbo].[AttendanceSettings] ADD [CoachingEveningGraceMinutes] INT NOT NULL CONSTRAINT [DF_AttendanceSettings_CoachingEveningGraceMinutes] DEFAULT (15);
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StudentPromotionHistories')
                    BEGIN
                        CREATE TABLE StudentPromotionHistories (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            StudentId UNIQUEIDENTIFIER NOT NULL,
                            FromClassId UNIQUEIDENTIFIER NOT NULL,
                            FromSectionId UNIQUEIDENTIFIER NULL,
                            FromRollNumber NVARCHAR(MAX) NULL,
                            FromAcademicYear NVARCHAR(MAX) NOT NULL,
                            ToClassId UNIQUEIDENTIFIER NOT NULL,
                            ToSectionId UNIQUEIDENTIFIER NULL,
                            ToRollNumber NVARCHAR(MAX) NULL,
                            ToAcademicYear NVARCHAR(MAX) NOT NULL,
                            ResultStatus NVARCHAR(MAX) NOT NULL,
                            PromotionDate DATETIME2 NOT NULL,
                            PromotedBy NVARCHAR(MAX) NULL,
                            Remarks NVARCHAR(MAX) NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ExamSettings')
                    BEGIN
                        CREATE TABLE ExamSettings (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            PassingPercentage DECIMAL(5,2) NOT NULL DEFAULT 33.00,
                            MaxCompartmentSubjects INT NOT NULL DEFAULT 2,
                            AllowGraceMarks BIT NOT NULL DEFAULT 1,
                            MaxGraceMarks INT NOT NULL DEFAULT 5,
                            SchoolAffiliationNumber NVARCHAR(MAX) NULL,
                            PrincipalSignTitle NVARCHAR(MAX) NULL,
                            ClassTeacherSignTitle NVARCHAR(MAX) NULL,
                            ResultDeclarationNote NVARCHAR(MAX) NULL,
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END
                    ELSE
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ExamSettings') AND name = 'ActiveAcademicYear')
                        BEGIN
                            ALTER TABLE ExamSettings ADD ActiveAcademicYear NVARCHAR(50) NOT NULL DEFAULT '2025-2026';
                            ALTER TABLE ExamSettings ADD NextAcademicYear NVARCHAR(50) NOT NULL DEFAULT '2026-2027';
                            ALTER TABLE ExamSettings ADD AvailableAcademicYears NVARCHAR(MAX) NOT NULL DEFAULT '2024-2025,2025-2026,2026-2027,2027-2028';
                            ALTER TABLE ExamSettings ADD AvailableExamTypes NVARCHAR(MAX) NOT NULL DEFAULT 'Unit Test 1,Unit Test 2,Quarterly Exam,Half Yearly Exam,Pre-Board Exam,Annual Exam';
                            ALTER TABLE ExamSettings ADD EvaluationDueDays INT NOT NULL DEFAULT 7;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ExamSettings') AND name = 'OfficialSealUrl')
                            ALTER TABLE ExamSettings ADD OfficialSealUrl NVARCHAR(MAX) NULL;
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ExamSettings') AND name = 'PrincipalSignatureUrl')
                            ALTER TABLE ExamSettings ADD PrincipalSignatureUrl NVARCHAR(MAX) NULL;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AutomationSettings')
                    BEGIN
                        CREATE TABLE AutomationSettings (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            WhatsAppFeeReceiptsEnabled BIT NOT NULL DEFAULT 1,
                            DailyAbsenteeAlertEnabled BIT NOT NULL DEFAULT 1,
                            DailyAbsenteeAlertTime NVARCHAR(10) NOT NULL DEFAULT '10:30',
                            LastAbsenteeAlertDate DATETIME2 NULL,
                            FeeDueRemindersEnabled BIT NOT NULL DEFAULT 1,
                            FeeDueDaysPrior INT NOT NULL DEFAULT 3,
                            LastFeeReminderDate DATETIME2 NULL,
                            BiometricSyncEnabled BIT NOT NULL DEFAULT 1,
                            LastBiometricSyncAt DATETIME2 NULL,
                            LateFeeAutoComputeEnabled BIT NOT NULL DEFAULT 1,
                            LateFeeDailyRate DECIMAL(18,2) NOT NULL DEFAULT 10,
                            LateFeeGraceDays INT NOT NULL DEFAULT 5,
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'AutoPilotFeeInvoicingEnabled' AND object_id = OBJECT_ID('AutomationSettings'))
                    BEGIN
                        ALTER TABLE AutomationSettings ADD AutoPilotFeeInvoicingEnabled BIT NOT NULL DEFAULT 0;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'AutoPilotInvoicingDayOfMonth' AND object_id = OBJECT_ID('AutomationSettings'))
                    BEGIN
                        ALTER TABLE AutomationSettings ADD AutoPilotInvoicingDayOfMonth INT NOT NULL DEFAULT 25;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'LastAutoPilotInvoicingRun' AND object_id = OBJECT_ID('AutomationSettings'))
                    BEGIN
                        ALTER TABLE AutomationSettings ADD LastAutoPilotInvoicingRun DATETIME2 NULL;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'AdmissionCutoffDay' AND object_id = OBJECT_ID('AutomationSettings'))
                    BEGIN
                        ALTER TABLE AutomationSettings ADD AdmissionCutoffDay INT NOT NULL DEFAULT 20;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'AdmissionRolloverPolicy' AND object_id = OBJECT_ID('AutomationSettings'))
                    BEGIN
                        ALTER TABLE AutomationSettings ADD AdmissionRolloverPolicy NVARCHAR(50) NOT NULL DEFAULT 'NextMonthFull';
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'FinancialYearStartMonth' AND object_id = OBJECT_ID('AutomationSettings'))
                    BEGIN
                        ALTER TABLE AutomationSettings ADD FinancialYearStartMonth INT NOT NULL DEFAULT 4;
                    END

                    -- Teacher Module Hybrid School & Login Migrations
                    IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SchoolSections') AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'ClassTeacherId' AND object_id = OBJECT_ID('SchoolSections'))
                    BEGIN
                        ALTER TABLE SchoolSections ADD ClassTeacherId UNIQUEIDENTIFIER NULL;
                    END

                    IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Teachers') AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'UserId' AND object_id = OBJECT_ID('Teachers'))
                    BEGIN
                        ALTER TABLE Teachers ADD UserId UNIQUEIDENTIFIER NULL;
                    END

                    IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TeacherBatchAssignments')
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'ClassId' AND object_id = OBJECT_ID('TeacherBatchAssignments'))
                        BEGIN
                            ALTER TABLE TeacherBatchAssignments ADD ClassId UNIQUEIDENTIFIER NULL;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'SectionId' AND object_id = OBJECT_ID('TeacherBatchAssignments'))
                        BEGIN
                            ALTER TABLE TeacherBatchAssignments ADD SectionId UNIQUEIDENTIFIER NULL;
                        END
                        ALTER TABLE TeacherBatchAssignments ALTER COLUMN BatchId UNIQUEIDENTIFIER NULL;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TeacherFnFSettlements')
                    BEGIN
                        CREATE TABLE TeacherFnFSettlements (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            TeacherId UNIQUEIDENTIFIER NOT NULL,
                            ResignationDate DATETIME2 NOT NULL,
                            LastWorkingDate DATETIME2 NOT NULL,
                            ReasonForLeaving NVARCHAR(MAX) NOT NULL,
                            Remarks NVARCHAR(MAX) NULL,
                            AcademicClearance BIT NOT NULL DEFAULT 1,
                            LibraryClearance BIT NOT NULL DEFAULT 1,
                            AssetClearance BIT NOT NULL DEFAULT 1,
                            HostelClearance BIT NOT NULL DEFAULT 1,
                            AllClearancesApproved BIT NOT NULL DEFAULT 1,
                            ClearanceApprovedBy NVARCHAR(MAX) NULL,
                            WorkingDaysInFinalMonth INT NOT NULL DEFAULT 0,
                            PerDaySalaryRate DECIMAL(18,2) NOT NULL DEFAULT 0,
                            UnpaidSalary DECIMAL(18,2) NOT NULL DEFAULT 0,
                            EarnedLeaveEncashment DECIMAL(18,2) NOT NULL DEFAULT 0,
                            GratuityOrBonus DECIMAL(18,2) NOT NULL DEFAULT 0,
                            OtherAdditions DECIMAL(18,2) NOT NULL DEFAULT 0,
                            TotalEarnings DECIMAL(18,2) NOT NULL DEFAULT 0,
                            PendingAdvanceDeduction DECIMAL(18,2) NOT NULL DEFAULT 0,
                            NoticeShortfallDeduction DECIMAL(18,2) NOT NULL DEFAULT 0,
                            LibraryDuesDeduction DECIMAL(18,2) NOT NULL DEFAULT 0,
                            AssetLossDeduction DECIMAL(18,2) NOT NULL DEFAULT 0,
                            OtherDeductions DECIMAL(18,2) NOT NULL DEFAULT 0,
                            TotalDeductions DECIMAL(18,2) NOT NULL DEFAULT 0,
                            NetPayableAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
                            Status NVARCHAR(MAX) NOT NULL DEFAULT 'Settled',
                            SettlementDate DATETIME2 NULL,
                            PaymentMode NVARCHAR(MAX) NULL,
                            PaymentReference NVARCHAR(MAX) NULL,
                            SettlementVoucherNo NVARCHAR(MAX) NOT NULL DEFAULT '',
                            RelievingLetterIssued BIT NOT NULL DEFAULT 1,
                            ExperienceCertificateIssued BIT NOT NULL DEFAULT 1,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StaffPromotionIncrements')
                    BEGIN
                        CREATE TABLE StaffPromotionIncrements (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            TeacherId UNIQUEIDENTIFIER NOT NULL,
                            Type NVARCHAR(50) NOT NULL DEFAULT 'PromotionAndIncrement',
                            OldDesignation NVARCHAR(150) NOT NULL,
                            NewDesignation NVARCHAR(150) NOT NULL,
                            OldDepartment NVARCHAR(150) NULL,
                            NewDepartment NVARCHAR(150) NULL,
                            OldBasicSalary DECIMAL(18,2) NOT NULL DEFAULT 0,
                            NewBasicSalary DECIMAL(18,2) NOT NULL DEFAULT 0,
                            OldHRA DECIMAL(18,2) NOT NULL DEFAULT 0,
                            NewHRA DECIMAL(18,2) NOT NULL DEFAULT 0,
                            OldOtherAllowances DECIMAL(18,2) NOT NULL DEFAULT 0,
                            NewOtherAllowances DECIMAL(18,2) NOT NULL DEFAULT 0,
                            OldGrossSalary DECIMAL(18,2) NOT NULL DEFAULT 0,
                            NewGrossSalary DECIMAL(18,2) NOT NULL DEFAULT 0,
                            IncrementPercentage DECIMAL(18,2) NULL,
                            IncrementAmount DECIMAL(18,2) NULL,
                            EffectiveDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            Reason NVARCHAR(MAX) NULL,
                            Remarks NVARCHAR(MAX) NULL,
                            ApprovedBy NVARCHAR(150) NULL,
                            ApprovalDate DATETIME2 NULL,
                            Status NVARCHAR(50) NOT NULL DEFAULT 'Approved',
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TeacherSubstitutions')
                    BEGIN
                        CREATE TABLE TeacherSubstitutions (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            SubstitutionDate DATETIME2 NOT NULL,
                            OriginalTeacherId UNIQUEIDENTIFIER NOT NULL,
                            SubstituteTeacherId UNIQUEIDENTIFIER NOT NULL,
                            BatchId UNIQUEIDENTIFIER NULL,
                            ClassSectionId UNIQUEIDENTIFIER NULL,
                            SubjectId UNIQUEIDENTIFIER NULL,
                            SubjectName NVARCHAR(MAX) NULL,
                            TimeSlot NVARCHAR(MAX) NOT NULL DEFAULT '',
                            RoomNumber NVARCHAR(MAX) NULL,
                            TopicToCover NVARCHAR(MAX) NULL,
                            Reason NVARCHAR(MAX) NULL,
                            Status NVARCHAR(MAX) NOT NULL DEFAULT 'Assigned',
                            ProxyAllowance DECIMAL(18,2) NOT NULL DEFAULT 0,
                            Remarks NVARCHAR(MAX) NULL,
                            AssignedBy NVARCHAR(MAX) NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TeacherLessonPlans')
                    BEGIN
                        CREATE TABLE TeacherLessonPlans (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            TeacherId UNIQUEIDENTIFIER NOT NULL,
                            PlanDate DATETIME2 NOT NULL,
                            BatchId UNIQUEIDENTIFIER NULL,
                            ClassSectionId UNIQUEIDENTIFIER NULL,
                            SubjectId UNIQUEIDENTIFIER NULL,
                            SubjectName NVARCHAR(MAX) NOT NULL DEFAULT '',
                            ChapterTopic NVARCHAR(MAX) NOT NULL DEFAULT '',
                            LearningObjectives NVARCHAR(MAX) NULL,
                            TeachingMethodology NVARCHAR(MAX) NULL,
                            HomeworkAssigned NVARCHAR(MAX) NULL,
                            Status NVARCHAR(MAX) NOT NULL DEFAULT 'Completed',
                            CompletionPercentage NVARCHAR(MAX) NULL,
                            StudentResponse NVARCHAR(MAX) NULL,
                            Remarks NVARCHAR(MAX) NULL,
                            PrincipalFeedback NVARCHAR(MAX) NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TeacherDocuments')
                    BEGIN
                        CREATE TABLE TeacherDocuments (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            TeacherId UNIQUEIDENTIFIER NOT NULL,
                            DocumentType NVARCHAR(MAX) NOT NULL DEFAULT 'Aadhaar',
                            Title NVARCHAR(MAX) NOT NULL DEFAULT '',
                            DocumentNumber NVARCHAR(MAX) NULL,
                            FileUrl NVARCHAR(MAX) NULL,
                            FileName NVARCHAR(MAX) NULL,
                            VerificationStatus NVARCHAR(MAX) NOT NULL DEFAULT 'Pending',
                            VerifiedBy NVARCHAR(MAX) NULL,
                            VerifiedAt DATETIME2 NULL,
                            ExpiryDate DATETIME2 NULL,
                            Remarks NVARCHAR(MAX) NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StudentDocuments')
                    BEGIN
                        CREATE TABLE StudentDocuments (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            StudentId UNIQUEIDENTIFIER NOT NULL,
                            DocumentType NVARCHAR(MAX) NOT NULL DEFAULT 'Aadhaar',
                            Title NVARCHAR(MAX) NOT NULL DEFAULT '',
                            DocumentNumber NVARCHAR(MAX) NULL,
                            FileUrl NVARCHAR(MAX) NULL,
                            FileName NVARCHAR(MAX) NULL,
                            VerificationStatus NVARCHAR(MAX) NOT NULL DEFAULT 'Verified',
                            VerifiedBy NVARCHAR(MAX) NULL,
                            VerifiedAt DATETIME2 NULL,
                            Remarks NVARCHAR(MAX) NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StudentAchievements')
                    BEGIN
                        CREATE TABLE StudentAchievements (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            StudentId UNIQUEIDENTIFIER NOT NULL,
                            Title NVARCHAR(200) NOT NULL,
                            Category NVARCHAR(100) NOT NULL DEFAULT 'Academic',
                            AwardLevel NVARCHAR(100) NOT NULL DEFAULT 'School',
                            AwardDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            BadgeIcon NVARCHAR(100) NOT NULL DEFAULT 'emoji_events',
                            CertificateNumber NVARCHAR(100) NULL,
                            Description NVARCHAR(MAX) NULL,
                            AwardedBy NVARCHAR(200) NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StudentDisciplinaryRecords')
                    BEGIN
                        CREATE TABLE StudentDisciplinaryRecords (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            StudentId UNIQUEIDENTIFIER NOT NULL,
                            IncidentDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            IncidentType NVARCHAR(100) NOT NULL DEFAULT 'Warning',
                            Severity NVARCHAR(50) NOT NULL DEFAULT 'Low',
                            Title NVARCHAR(200) NOT NULL,
                            Description NVARCHAR(MAX) NOT NULL,
                            ActionTaken NVARCHAR(MAX) NULL,
                            ReportedBy NVARCHAR(200) NULL,
                            ParentNotified BIT NOT NULL DEFAULT 0,
                            IsResolved BIT NOT NULL DEFAULT 1,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StudentPtmRecords')
                    BEGIN
                        CREATE TABLE StudentPtmRecords (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            StudentId UNIQUEIDENTIFIER NOT NULL,
                            PtmDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            TeacherName NVARCHAR(200) NOT NULL,
                            TeacherRemarks NVARCHAR(MAX) NOT NULL,
                            ParentFeedback NVARCHAR(MAX) NULL,
                            ChildStrengths NVARCHAR(MAX) NULL,
                            AreasOfImprovement NVARCHAR(MAX) NULL,
                            ParentAttended NVARCHAR(50) NOT NULL DEFAULT 'Both',
                            FollowUpRequired BIT NOT NULL DEFAULT 0,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StudentHealthRecords')
                    BEGIN
                        CREATE TABLE StudentHealthRecords (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            StudentId UNIQUEIDENTIFIER NOT NULL,
                            HeightCm DECIMAL(6,2) NULL,
                            WeightKg DECIMAL(6,2) NULL,
                            Bmi DECIMAL(5,2) NULL,
                            BmiCategory NVARCHAR(50) NULL,
                            VisionLeft NVARCHAR(50) NULL,
                            VisionRight NVARCHAR(50) NULL,
                            BloodGroup NVARCHAR(10) NULL,
                            KnownAllergies NVARCHAR(MAX) NULL,
                            ChronicConditions NVARCHAR(MAX) NULL,
                            RegularMedications NVARCHAR(MAX) NULL,
                            EmergencyDoctorName NVARCHAR(200) NULL,
                            EmergencyDoctorPhone NVARCHAR(50) NULL,
                            LastCheckupDate DATETIME2 NULL,
                            DoctorRemarks NVARCHAR(MAX) NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    -- Finance & Accounting Tables
                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ExpenseCategories')
                    BEGIN
                        CREATE TABLE ExpenseCategories (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            Name NVARCHAR(150) NOT NULL,
                            Code NVARCHAR(50) NOT NULL,
                            Description NVARCHAR(500) NULL,
                            IsActive BIT NOT NULL DEFAULT 1,
                            SortOrder INT NOT NULL DEFAULT 0,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ExpenseVouchers')
                    BEGIN
                        CREATE TABLE ExpenseVouchers (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            VoucherNo NVARCHAR(50) NOT NULL,
                            ExpenseDate DATETIME2 NOT NULL,
                            ExpenseCategoryId UNIQUEIDENTIFIER NOT NULL,
                            Title NVARCHAR(200) NOT NULL,
                            Amount DECIMAL(18,2) NOT NULL,
                            PaymentMode INT NOT NULL DEFAULT 1,
                            VendorName NVARCHAR(200) NULL,
                            BillInvoiceNo NVARCHAR(100) NULL,
                            Description NVARCHAR(MAX) NULL,
                            ReceiptAttachmentUrl NVARCHAR(500) NULL,
                            CreatedByUserId UNIQUEIDENTIFIER NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AccountLedgers')
                    BEGIN
                        CREATE TABLE AccountLedgers (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            AccountCode NVARCHAR(50) NOT NULL,
                            AccountName NVARCHAR(150) NOT NULL,
                            AccountType INT NOT NULL,
                            SubType INT NOT NULL,
                            OpeningBalance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
                            CurrentBalance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
                            Description NVARCHAR(500) NULL,
                            IsActive BIT NOT NULL DEFAULT 1,
                            IsDefault BIT NOT NULL DEFAULT 0,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    -- School Events, Functions & Celebrations Tables
                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SchoolEvents')
                    BEGIN
                        CREATE TABLE SchoolEvents (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            Title NVARCHAR(200) NOT NULL,
                            Category NVARCHAR(50) NOT NULL DEFAULT 'Cultural',
                            StartDate DATETIME2 NOT NULL,
                            EndDate DATETIME2 NULL,
                            StartTime NVARCHAR(50) NULL,
                            EndTime NVARCHAR(50) NULL,
                            Venue NVARCHAR(200) NULL,
                            Description NVARCHAR(MAX) NULL,
                            TargetAudience NVARCHAR(100) NOT NULL DEFAULT 'All',
                            BannerUrl NVARCHAR(MAX) NULL,
                            AttachmentPdfUrl NVARCHAR(MAX) NULL,
                            ChiefGuestName NVARCHAR(150) NULL,
                            CoordinatorName NVARCHAR(150) NULL,
                            Status NVARCHAR(50) NOT NULL DEFAULT 'Upcoming',
                            IsActive BIT NOT NULL DEFAULT 1,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EventPhotos')
                    BEGIN
                        CREATE TABLE EventPhotos (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            EventId UNIQUEIDENTIFIER NOT NULL,
                            PhotoUrl NVARCHAR(MAX) NOT NULL,
                            Caption NVARCHAR(250) NULL,
                            UploadedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    -- Option B: Digital Homework & Diary Table
                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StudentHomeworks')
                    BEGIN
                        CREATE TABLE StudentHomeworks (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            ClassId UNIQUEIDENTIFIER NULL,
                            SectionId UNIQUEIDENTIFIER NULL,
                            BatchId UNIQUEIDENTIFIER NULL,
                            SubjectId UNIQUEIDENTIFIER NULL,
                            SubjectName NVARCHAR(150) NOT NULL DEFAULT '',
                            TeacherId UNIQUEIDENTIFIER NULL,
                            TeacherName NVARCHAR(150) NULL,
                            Title NVARCHAR(250) NOT NULL,
                            Description NVARCHAR(MAX) NOT NULL,
                            AssignedDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            DueDate DATETIME2 NOT NULL,
                            AttachmentUrl NVARCHAR(MAX) NULL,
                            AttachmentFileName NVARCHAR(250) NULL,
                            Status NVARCHAR(50) NOT NULL DEFAULT 'Active',
                            EstimatedMinutes INT NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('StudentHomeworks') AND name = 'AttachmentFileName')
                    BEGIN
                        ALTER TABLE StudentHomeworks ADD AttachmentFileName NVARCHAR(250) NULL;
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StudentHomeworkSubmissions')
                    BEGIN
                        CREATE TABLE StudentHomeworkSubmissions (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            HomeworkId UNIQUEIDENTIFIER NOT NULL,
                            StudentId UNIQUEIDENTIFIER NOT NULL,
                            SubmissionDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            StudentRemarks NVARCHAR(MAX) NULL,
                            SubmissionFileUrl NVARCHAR(MAX) NOT NULL,
                            SubmissionFileName NVARCHAR(250) NOT NULL,
                            Status NVARCHAR(50) NOT NULL DEFAULT 'Submitted',
                            TeacherRemarks NVARCHAR(MAX) NULL,
                            GradeOrMarks NVARCHAR(50) NULL,
                            ReviewedAt DATETIME2 NULL,
                            ReviewedByTeacherId UNIQUEIDENTIFIER NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    -- Daily Student Classwork & Homework Diary Table
                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DailyStudentDiaries')
                    BEGIN
                        CREATE TABLE DailyStudentDiaries (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            StudentId UNIQUEIDENTIFIER NOT NULL,
                            ClassId UNIQUEIDENTIFIER NULL,
                            SectionId UNIQUEIDENTIFIER NULL,
                            DiaryDate DATETIME2 NOT NULL,
                            ClassWorkJson NVARCHAR(MAX) NULL,
                            HomeWorkJson NVARCHAR(MAX) NULL,
                            IsAbsent BIT NOT NULL DEFAULT 0,
                            TeacherRemarks NVARCHAR(500) NULL,
                            TeacherId UNIQUEIDENTIFIER NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );

                        CREATE INDEX IX_DailyStudentDiaries_Tenant_Date_Class ON DailyStudentDiaries (TenantId, DiaryDate, ClassId);
                        CREATE INDEX IX_DailyStudentDiaries_Student_Date ON DailyStudentDiaries (TenantId, StudentId, DiaryDate);
                    END

                    -- Daily Student Good Manners & Behaviour Table
                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DailyStudentBehaviours')
                    BEGIN
                        CREATE TABLE DailyStudentBehaviours (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            StudentId UNIQUEIDENTIFIER NOT NULL,
                            ClassId UNIQUEIDENTIFIER NULL,
                            SectionId UNIQUEIDENTIFIER NULL,
                            RecordDate DATETIME2 NOT NULL,
                            UniformCleanliness NVARCHAR(50) NOT NULL DEFAULT 'NeatAndClean',
                            DisciplineConduct NVARCHAR(50) NOT NULL DEFAULT 'Disciplined',
                            PolitenessRespect NVARCHAR(50) NOT NULL DEFAULT 'PoliteAndRespectful',
                            BooksAndDiary NVARCHAR(50) NOT NULL DEFAULT 'BroughtAll',
                            StarRating INT NOT NULL DEFAULT 5,
                            BadgesJson NVARCHAR(MAX) NULL,
                            TeacherRemarks NVARCHAR(500) NULL,
                            TeacherId UNIQUEIDENTIFIER NULL,
                            IsAbsent BIT NOT NULL DEFAULT 0,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );

                        CREATE INDEX IX_DailyStudentBehaviours_Tenant_Branch_Date_Class ON DailyStudentBehaviours (TenantId, BranchId, RecordDate, ClassId);
                        CREATE INDEX IX_DailyStudentBehaviours_Student_Date ON DailyStudentBehaviours (TenantId, StudentId, RecordDate);
                    END

                    -- Monthly Student Performance & Evaluation Table
                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StudentMonthlyEvaluations')
                    BEGIN
                        CREATE TABLE StudentMonthlyEvaluations (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            StudentId UNIQUEIDENTIFIER NOT NULL,
                            ClassId UNIQUEIDENTIFIER NULL,
                            SectionId UNIQUEIDENTIFIER NULL,
                            [Month] INT NOT NULL,
                            [Year] INT NOT NULL,
                            AttendancePercent DECIMAL(5, 2) NOT NULL DEFAULT 0,
                            HwCompletionPercent DECIMAL(5, 2) NOT NULL DEFAULT 0,
                            BehaviourAvgStars DECIMAL(3, 2) NOT NULL DEFAULT 5.0,
                            AcademicTestPercent DECIMAL(5, 2) NOT NULL DEFAULT 0,
                            OverallGrade NVARCHAR(10) NOT NULL DEFAULT 'A',
                            TeacherRemarks NVARCHAR(500) NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );

                        CREATE INDEX IX_StudentMonthlyEvaluations_Tenant_Branch_Month_Year ON StudentMonthlyEvaluations (TenantId, BranchId, [Month], [Year], ClassId);
                        CREATE INDEX IX_StudentMonthlyEvaluations_Student_Month_Year ON StudentMonthlyEvaluations (TenantId, StudentId, [Month], [Year]);
                    END

                    -- Option C: Admission Enquiry & CRM Table
                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AdmissionEnquiries')
                    BEGIN
                        CREATE TABLE AdmissionEnquiries (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            EnquiryNumber NVARCHAR(50) NOT NULL,
                            StudentName NVARCHAR(150) NOT NULL,
                            ParentName NVARCHAR(150) NOT NULL,
                            Phone NVARCHAR(50) NOT NULL,
                            AlternatePhone NVARCHAR(50) NULL,
                            Email NVARCHAR(150) NULL,
                            InterestedClassId UNIQUEIDENTIFIER NULL,
                            InterestedClassName NVARCHAR(150) NULL,
                            InterestedBatchId UNIQUEIDENTIFIER NULL,
                            InterestedBatchName NVARCHAR(150) NULL,
                            EnquiryDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            FollowUpDate DATETIME2 NULL,
                            Source NVARCHAR(50) NOT NULL DEFAULT 'Walk-in',
                            Status NVARCHAR(50) NOT NULL DEFAULT 'New',
                            Priority NVARCHAR(50) NOT NULL DEFAULT 'Medium',
                            Remarks NVARCHAR(MAX) NULL,
                            ConvertedStudentId UNIQUEIDENTIFIER NULL,
                            ConvertedAt DATETIME2 NULL,
                            CreatedBy NVARCHAR(150) NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END
                    -- Front Desk: Visitor Book
                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'VisitorLogs')
                    BEGIN
                        CREATE TABLE VisitorLogs (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            VisitorNumber NVARCHAR(50) NOT NULL DEFAULT '',
                            VisitorType NVARCHAR(50) NOT NULL DEFAULT 'Visitor',
                            VisitorName NVARCHAR(150) NOT NULL,
                            Organization NVARCHAR(150) NULL,
                            ContactNumber NVARCHAR(50) NULL,
                            Email NVARCHAR(150) NULL,
                            IdProofType NVARCHAR(50) NULL,
                            IdProofNumber NVARCHAR(100) NULL,
                            PersonToMeet NVARCHAR(150) NULL,
                            DepartmentToVisit NVARCHAR(100) NULL,
                            StudentId UNIQUEIDENTIFIER NULL,
                            StudentName NVARCHAR(150) NULL,
                            StudentClass NVARCHAR(100) NULL,
                            Purpose NVARCHAR(500) NOT NULL DEFAULT '',
                            CheckInTime DATETIME2 NOT NULL DEFAULT GETDATE(),
                            CheckOutTime DATETIME2 NULL,
                            Status NVARCHAR(50) NOT NULL DEFAULT 'Active',
                            NumberOfVisitors INT NULL DEFAULT 1,
                            VehicleNumber NVARCHAR(50) NULL,
                            PhotoUrl NVARCHAR(MAX) NULL,
                            BadgeNumber NVARCHAR(50) NULL,
                            MaterialCarried NVARCHAR(500) NULL,
                            Remarks NVARCHAR(MAX) NULL,
                            ReceivedBy NVARCHAR(150) NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
                        );
                    END

                    -- Front Desk: Student Gate Pass
                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StudentGatePasses')
                    BEGIN
                        CREATE TABLE StudentGatePasses (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            GatePassNumber NVARCHAR(50) NOT NULL DEFAULT '',
                            StudentId UNIQUEIDENTIFIER NOT NULL,
                            Reason NVARCHAR(MAX) NOT NULL DEFAULT '',
                            ReasonCategory NVARCHAR(100) NOT NULL DEFAULT 'Early Pickup',
                            OutDateTime DATETIME2 NOT NULL DEFAULT GETDATE(),
                            ExpectedReturnTime DATETIME2 NULL,
                            ActualReturnTime DATETIME2 NULL,
                            Status NVARCHAR(50) NOT NULL DEFAULT 'Pending',
                            ParentGuardianName NVARCHAR(150) NULL,
                            ParentContactNumber NVARCHAR(50) NULL,
                            ParentRelation NVARCHAR(100) NULL,
                            ApprovedBy NVARCHAR(150) NULL,
                            ApprovedAt DATETIME2 NULL,
                            ApprovalRemarks NVARCHAR(MAX) NULL,
                            SecurityGuardName NVARCHAR(150) NULL,
                            Remarks NVARCHAR(MAX) NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
                        );
                    END

                    -- Teacher Attendance Regularization & Leave Policy Migration
                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TeacherAttendanceRegularizations')
                    BEGIN
                        CREATE TABLE TeacherAttendanceRegularizations (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            TeacherId UNIQUEIDENTIFIER NOT NULL,
                            AttendanceDate DATETIME2 NOT NULL,
                            RequestedStatus INT NOT NULL DEFAULT 1,
                            RequestedCheckIn NVARCHAR(10) NULL,
                            RequestedCheckOut NVARCHAR(10) NULL,
                            Reason NVARCHAR(MAX) NOT NULL DEFAULT '',
                            AttachmentUrl NVARCHAR(500) NULL,
                            Status INT NOT NULL DEFAULT 1,
                            ReviewedBy NVARCHAR(150) NULL,
                            ReviewedAt DATETIME2 NULL,
                            ReviewRemarks NVARCHAR(MAX) NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END

                    -- Student Attendance Regularization Migration
                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StudentAttendanceRegularizations')
                    BEGIN
                        CREATE TABLE StudentAttendanceRegularizations (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            StudentId UNIQUEIDENTIFIER NOT NULL,
                            ClassId UNIQUEIDENTIFIER NULL,
                            SectionId UNIQUEIDENTIFIER NULL,
                            AttendanceDate DATETIME2 NOT NULL,
                            RequestedStatus INT NOT NULL DEFAULT 1,
                            ReasonCategory NVARCHAR(50) NOT NULL DEFAULT 'OnDuty',
                            Reason NVARCHAR(MAX) NOT NULL DEFAULT '',
                            AttachmentUrl NVARCHAR(500) NULL,
                            Status INT NOT NULL DEFAULT 1,
                            ReviewedBy NVARCHAR(150) NULL,
                            ReviewedAt DATETIME2 NULL,
                            ReviewRemarks NVARCHAR(MAX) NULL,
                            AppliedBy NVARCHAR(100) NOT NULL DEFAULT 'Student',
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );

                        CREATE INDEX IX_StudentAttendanceRegularizations_Student_Date ON StudentAttendanceRegularizations (TenantId, StudentId, AttendanceDate);
                        CREATE INDEX IX_StudentAttendanceRegularizations_Status ON StudentAttendanceRegularizations (TenantId, Status);
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_StudentAttendances_Tenant_Date_Student' AND object_id = OBJECT_ID('StudentAttendances'))
                    BEGIN
                        CREATE NONCLUSTERED INDEX IX_StudentAttendances_Tenant_Date_Student 
                        ON StudentAttendances (TenantId, AttendanceDate, StudentId) 
                        INCLUDE (Status, CheckInTime, CheckOutTime);
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Students_Tenant_Class_Active' AND object_id = OBJECT_ID('Students'))
                    BEGIN
                        CREATE NONCLUSTERED INDEX IX_Students_Tenant_Class_Active 
                        ON Students (TenantId, ClassId, IsActive, IsSchoolStudent) 
                        INCLUDE (StudentName, SchoolRollNumber, AdmissionNumber, SectionId, JoiningDate);
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Students_Tenant_Batch_Active' AND object_id = OBJECT_ID('Students'))
                    BEGIN
                        CREATE NONCLUSTERED INDEX IX_Students_Tenant_Batch_Active 
                        ON Students (TenantId, BatchId, IsActive) 
                        INCLUDE (StudentName, RollNumber, JoiningDate);
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LeaveAndAttendancePolicies')
                    BEGIN
                        CREATE TABLE LeaveAndAttendancePolicies (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            AnnualCasualLeaveQuota DECIMAL(5,2) NOT NULL DEFAULT 12.00,
                            AnnualSickLeaveQuota DECIMAL(5,2) NOT NULL DEFAULT 10.00,
                            AnnualEarnedLeaveQuota DECIMAL(5,2) NOT NULL DEFAULT 15.00,
                            LeaveAccrualFrequency NVARCHAR(50) NOT NULL DEFAULT 'Monthly',
                            MonthlyCasualLeaveAccrual DECIMAL(5,2) NOT NULL DEFAULT 1.00,
                            MaxRegularizationDaysBackdated INT NOT NULL DEFAULT 15,
                            MaxRegularizationPerMonth INT NOT NULL DEFAULT 3,
                            AutoCancelLeaveOnBiometricPunch BIT NOT NULL DEFAULT 1,
                            AllowFullDayLeaveIfMarkedPresent BIT NOT NULL DEFAULT 0,
                            ExcludeHolidaysFromLeaveCount BIT NOT NULL DEFAULT 1,
                            ExcludeSundaysFromLeaveCount BIT NOT NULL DEFAULT 1,
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                    END
                    ELSE
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'ExcludeHolidaysFromLeaveCount' AND object_id = OBJECT_ID('LeaveAndAttendancePolicies'))
                        BEGIN
                            ALTER TABLE LeaveAndAttendancePolicies ADD ExcludeHolidaysFromLeaveCount BIT NOT NULL DEFAULT 1;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'ExcludeSundaysFromLeaveCount' AND object_id = OBJECT_ID('LeaveAndAttendancePolicies'))
                        BEGIN
                            ALTER TABLE LeaveAndAttendancePolicies ADD ExcludeSundaysFromLeaveCount BIT NOT NULL DEFAULT 1;
                        END
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StaffAppraisalPolicies')
                    BEGIN
                        CREATE TABLE StaffAppraisalPolicies (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            MinServiceMonthsForIncrement INT NOT NULL DEFAULT 12,
                            EnforceDryPromotionInProbation BIT NOT NULL DEFAULT 1,
                            AllowSpecialBypass BIT NOT NULL DEFAULT 1,
                            BypassApprovalRole NVARCHAR(MAX) NULL,
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                        CREATE INDEX IX_StaffAppraisalPolicies_TenantId ON StaffAppraisalPolicies (TenantId);
                    END

                    -- TeacherLeaves Cancellation, Revocation & DeductibleDays Columns
                    IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TeacherLeaves')
                    BEGIN
                        ALTER TABLE TeacherLeaves ALTER COLUMN Status NVARCHAR(50) NOT NULL;
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'DeductibleDays' AND object_id = OBJECT_ID('TeacherLeaves'))
                        BEGIN
                            ALTER TABLE TeacherLeaves ADD DeductibleDays DECIMAL(5,2) NOT NULL DEFAULT 0;
                            EXEC('UPDATE TeacherLeaves SET DeductibleDays = DATEDIFF(day, FromDate, ToDate) + 1 WHERE DeductibleDays = 0;');
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'IsCancellationRequested' AND object_id = OBJECT_ID('TeacherLeaves'))
                        BEGIN
                            ALTER TABLE TeacherLeaves ADD IsCancellationRequested BIT NOT NULL DEFAULT 0;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'IsPartialCancellation' AND object_id = OBJECT_ID('TeacherLeaves'))
                        BEGIN
                            ALTER TABLE TeacherLeaves ADD IsPartialCancellation BIT NOT NULL DEFAULT 0;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'CancellationFromDate' AND object_id = OBJECT_ID('TeacherLeaves'))
                        BEGIN
                            ALTER TABLE TeacherLeaves ADD CancellationFromDate DATETIME2 NULL;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'CancellationToDate' AND object_id = OBJECT_ID('TeacherLeaves'))
                        BEGIN
                            ALTER TABLE TeacherLeaves ADD CancellationToDate DATETIME2 NULL;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'CancellationReason' AND object_id = OBJECT_ID('TeacherLeaves'))
                        BEGIN
                            ALTER TABLE TeacherLeaves ADD CancellationReason NVARCHAR(MAX) NULL;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'CancellationRequestedAt' AND object_id = OBJECT_ID('TeacherLeaves'))
                        BEGIN
                            ALTER TABLE TeacherLeaves ADD CancellationRequestedAt DATETIME2 NULL;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'CancellationReviewedBy' AND object_id = OBJECT_ID('TeacherLeaves'))
                        BEGIN
                            ALTER TABLE TeacherLeaves ADD CancellationReviewedBy NVARCHAR(150) NULL;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'CancellationReviewedAt' AND object_id = OBJECT_ID('TeacherLeaves'))
                        BEGIN
                            ALTER TABLE TeacherLeaves ADD CancellationReviewedAt DATETIME2 NULL;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'CancellationReviewRemarks' AND object_id = OBJECT_ID('TeacherLeaves'))
                        BEGIN
                            ALTER TABLE TeacherLeaves ADD CancellationReviewRemarks NVARCHAR(MAX) NULL;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'IsCancellationApproved' AND object_id = OBJECT_ID('TeacherLeaves'))
                        BEGIN
                            ALTER TABLE TeacherLeaves ADD IsCancellationApproved BIT NULL;
                        END
                    END

                    -- StudentLeaves Cancellation & Revocation Columns
                    IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StudentLeaves')
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'IsCancellationRequested' AND object_id = OBJECT_ID('StudentLeaves'))
                        BEGIN
                            ALTER TABLE StudentLeaves ADD IsCancellationRequested BIT NOT NULL DEFAULT 0;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'IsPartialCancellation' AND object_id = OBJECT_ID('StudentLeaves'))
                        BEGIN
                            ALTER TABLE StudentLeaves ADD IsPartialCancellation BIT NOT NULL DEFAULT 0;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'CancellationFromDate' AND object_id = OBJECT_ID('StudentLeaves'))
                        BEGIN
                            ALTER TABLE StudentLeaves ADD CancellationFromDate DATETIME2 NULL;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'CancellationToDate' AND object_id = OBJECT_ID('StudentLeaves'))
                        BEGIN
                            ALTER TABLE StudentLeaves ADD CancellationToDate DATETIME2 NULL;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'CancellationReason' AND object_id = OBJECT_ID('StudentLeaves'))
                        BEGIN
                            ALTER TABLE StudentLeaves ADD CancellationReason NVARCHAR(MAX) NULL;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'CancellationRequestedAt' AND object_id = OBJECT_ID('StudentLeaves'))
                        BEGIN
                            ALTER TABLE StudentLeaves ADD CancellationRequestedAt DATETIME2 NULL;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'CancellationReviewedBy' AND object_id = OBJECT_ID('StudentLeaves'))
                        BEGIN
                            ALTER TABLE StudentLeaves ADD CancellationReviewedBy NVARCHAR(150) NULL;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'CancellationReviewedAt' AND object_id = OBJECT_ID('StudentLeaves'))
                        BEGIN
                            ALTER TABLE StudentLeaves ADD CancellationReviewedAt DATETIME2 NULL;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'CancellationReviewRemarks' AND object_id = OBJECT_ID('StudentLeaves'))
                        BEGIN
                            ALTER TABLE StudentLeaves ADD CancellationReviewRemarks NVARCHAR(MAX) NULL;
                        END
                        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'IsCancellationApproved' AND object_id = OBJECT_ID('StudentLeaves'))
                        BEGIN
                            ALTER TABLE StudentLeaves ADD IsCancellationApproved BIT NULL;
                        END
                    END

                    -- Study Material & Question Bank Repository (Digital Notes & PYQ)
                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StudyMaterials')
                    BEGIN
                        CREATE TABLE StudyMaterials (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            Title NVARCHAR(300) NOT NULL,
                            Description NVARCHAR(MAX) NULL,
                            TargetScope NVARCHAR(50) NOT NULL DEFAULT 'Both', -- Both | School | Coaching
                            ClassId UNIQUEIDENTIFIER NULL,
                            SectionId UNIQUEIDENTIFIER NULL,
                            BatchId UNIQUEIDENTIFIER NULL,
                            SubjectId UNIQUEIDENTIFIER NULL,
                            Subject NVARCHAR(150) NOT NULL DEFAULT '',
                            MaterialType NVARCHAR(50) NOT NULL DEFAULT 'Notes', -- Notes | PYQ | QuestionBank | FormulaSheet | SamplePaper | Syllabus
                            ChapterName NVARCHAR(200) NULL,
                            Topic NVARCHAR(200) NULL,
                            AcademicYear NVARCHAR(50) NULL,
                            TargetExam NVARCHAR(100) NULL,
                            ExamYear NVARCHAR(50) NULL,
                            HasSolutions BIT NOT NULL DEFAULT 0,
                            DifficultyLevel NVARCHAR(50) NULL,
                            FileUrl NVARCHAR(1000) NOT NULL,
                            FileName NVARCHAR(300) NOT NULL,
                            FileSizeBytes BIGINT NOT NULL DEFAULT 0,
                            FileFormat NVARCHAR(50) NOT NULL DEFAULT 'pdf',
                            ExternalLink NVARCHAR(1000) NULL,
                            SolutionFileUrl NVARCHAR(1000) NULL,
                            SolutionFileName NVARCHAR(300) NULL,
                            UploadedByName NVARCHAR(150) NOT NULL DEFAULT '',
                            UploadedByUserId UNIQUEIDENTIFIER NULL,
                            DownloadCount INT NOT NULL DEFAULT 0,
                            ViewCount INT NOT NULL DEFAULT 0,
                            IsPublished BIT NOT NULL DEFAULT 1,
                            IsFeatured BIT NOT NULL DEFAULT 0,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );

                        CREATE INDEX IX_StudyMaterials_Tenant_Scope ON StudyMaterials (TenantId, TargetScope, MaterialType, IsPublished);
                        CREATE INDEX IX_StudyMaterials_Class_Batch ON StudyMaterials (TenantId, ClassId, BatchId);
                        CREATE INDEX IX_StudyMaterials_Subject ON StudyMaterials (TenantId, Subject);
                        CREATE INDEX IX_StudyMaterials_CreatedAt ON StudyMaterials (TenantId, CreatedAt DESC);
                    END

                    -- Multi-Tenant & Branch-Wise Chat System Tables
                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChatConversations')
                    BEGIN
                        CREATE TABLE ChatConversations (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            ConversationType INT NOT NULL DEFAULT 1,
                            ClassId UNIQUEIDENTIFIER NULL,
                            SectionId UNIQUEIDENTIFIER NULL,
                            Title NVARCHAR(200) NOT NULL DEFAULT '',
                            Description NVARCHAR(500) NULL,
                            LastMessageContent NVARCHAR(500) NULL,
                            LastMessageAt DATETIME2 NULL,
                            LastMessageSenderId UNIQUEIDENTIFIER NULL,
                            LastMessageSenderName NVARCHAR(150) NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            CreatedByUserId UNIQUEIDENTIFIER NOT NULL,
                            IsActive BIT NOT NULL DEFAULT 1
                        );
                        CREATE INDEX IX_ChatConversations_Tenant_Branch ON ChatConversations (TenantId, BranchId);
                        CREATE INDEX IX_ChatConversations_Class_Section ON ChatConversations (TenantId, ClassId, SectionId);
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChatParticipants')
                    BEGIN
                        CREATE TABLE ChatParticipants (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            ConversationId UNIQUEIDENTIFIER NOT NULL,
                            UserId UNIQUEIDENTIFIER NOT NULL,
                            RoleInChat NVARCHAR(50) NOT NULL DEFAULT 'Member',
                            LastReadMessageId UNIQUEIDENTIFIER NULL,
                            UnreadCount INT NOT NULL DEFAULT 0,
                            JoinedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            IsMuted BIT NOT NULL DEFAULT 0
                        );
                        CREATE INDEX IX_ChatParticipants_User ON ChatParticipants (TenantId, UserId);
                        CREATE INDEX IX_ChatParticipants_Conv_User ON ChatParticipants (TenantId, ConversationId, UserId);
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChatMessages')
                    BEGIN
                        CREATE TABLE ChatMessages (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            ConversationId UNIQUEIDENTIFIER NOT NULL,
                            SenderUserId UNIQUEIDENTIFIER NOT NULL,
                            SenderName NVARCHAR(150) NOT NULL DEFAULT '',
                            SenderRole NVARCHAR(50) NOT NULL DEFAULT '',
                            Content NVARCHAR(MAX) NOT NULL DEFAULT '',
                            MessageType NVARCHAR(50) NOT NULL DEFAULT 'Text',
                            AttachmentUrl NVARCHAR(1000) NULL,
                            AttachmentFileName NVARCHAR(300) NULL,
                            FileSizeBytes BIGINT NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            IsDeleted BIT NOT NULL DEFAULT 0
                        );
                        CREATE INDEX IX_ChatMessages_Conv_Created ON ChatMessages (TenantId, ConversationId, CreatedAt);
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'FeeRecoveryPlans')
                    BEGIN
                        CREATE TABLE FeeRecoveryPlans (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            StudentId UNIQUEIDENTIFIER NOT NULL,
                            InvoiceId UNIQUEIDENTIFIER NULL,
                            TotalOverdueAmount DECIMAL(18, 2) NOT NULL DEFAULT 0,
                            DaysOverdue INT NOT NULL DEFAULT 0,
                            RiskLevel INT NOT NULL DEFAULT 1,
                            Status INT NOT NULL DEFAULT 1,
                            RecommendedChannel INT NOT NULL DEFAULT 1,
                            RecommendedTone NVARCHAR(100) NOT NULL DEFAULT 'Gentle',
                            GeneratedMessage NVARCHAR(MAX) NOT NULL DEFAULT '',
                            AiRationale NVARCHAR(MAX) NULL,
                            FollowUpCount INT NOT NULL DEFAULT 0,
                            LastFollowUpAt DATETIME2 NULL,
                            NextFollowUpScheduledAt DATETIME2 NULL,
                            ResolutionNotes NVARCHAR(MAX) NULL,
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                            UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                        CREATE INDEX IX_FeeRecoveryPlans_Tenant_Risk ON FeeRecoveryPlans (TenantId, RiskLevel, Status);
                        CREATE INDEX IX_FeeRecoveryPlans_Student ON FeeRecoveryPlans (TenantId, StudentId);
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'FeePromisesToPay')
                    BEGIN
                        CREATE TABLE FeePromisesToPay (
                            Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                            TenantId UNIQUEIDENTIFIER NOT NULL,
                            BranchId UNIQUEIDENTIFIER NULL,
                            StudentId UNIQUEIDENTIFIER NOT NULL,
                            RecoveryPlanId UNIQUEIDENTIFIER NULL,
                            InvoiceId UNIQUEIDENTIFIER NULL,
                            PromisedAmount DECIMAL(18, 2) NOT NULL DEFAULT 0,
                            PromisedDate DATETIME2 NOT NULL,
                            ContactPerson NVARCHAR(200) NOT NULL DEFAULT '',
                            ContactPhone NVARCHAR(50) NOT NULL DEFAULT '',
                            Notes NVARCHAR(MAX) NULL,
                            IsKept BIT NOT NULL DEFAULT 0,
                            IsBroken BIT NOT NULL DEFAULT 0,
                            SettledAt DATETIME2 NULL,
                            SettledAmount DECIMAL(18, 2) NULL,
                            RecordedByName NVARCHAR(150) NOT NULL DEFAULT 'Accounts',
                            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                        );
                        CREATE INDEX IX_FeePromisesToPay_Tenant_Date ON FeePromisesToPay (TenantId, PromisedDate);
                        CREATE INDEX IX_FeePromisesToPay_Student ON FeePromisesToPay (TenantId, StudentId);
                    END

                    -- Seed 'Campus Chat' Menu Item & Role Permissions
                    IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE RouteUrl = '/chat')
                    BEGIN
                        DECLARE @ChatMenuId UNIQUEIDENTIFIER = NEWID();
                        INSERT INTO MenuItems (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module, IsActive)
                        VALUES (@ChatMenuId, 'Campus Chat', '/chat', 'forum', NULL, 15, 'Communication', 1);

                        IF EXISTS (SELECT 1 FROM Roles)
                        BEGIN
                            INSERT INTO RolePermissions (Id, RoleId, MenuItemId, CanView, CanCreate, CanEdit, CanDelete)
                            SELECT NEWID(), r.Id, @ChatMenuId, 1, 1, 1, 1
                            FROM Roles r;
                        END
                    END

                    -- Seed 'Smart Fee Recovery Agent (AI)' Menu Item & Role Permissions under Finance
                    IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE RouteUrl = '/finance/fee-recovery-agent')
                    BEGIN
                        DECLARE @FinParentId UNIQUEIDENTIFIER = (
                            SELECT TOP 1 Id FROM MenuItems 
                            WHERE (Title = 'Finance & Accounts' OR Module = 'Finance') AND ParentId IS NULL
                            ORDER BY SortOrder
                        );
                        DECLARE @RecoveryMenuId UNIQUEIDENTIFIER = NEWID();

                        INSERT INTO MenuItems (Id, Title, RouteUrl, Icon, ParentId, SortOrder, Module, IsActive)
                        VALUES (@RecoveryMenuId, 'Smart Fee Recovery Agent (AI)', '/finance/fee-recovery-agent', 'psychology', @FinParentId, 6, 'Finance', 1);

                        IF EXISTS (SELECT 1 FROM Roles)
                        BEGIN
                            INSERT INTO RolePermissions (Id, RoleId, MenuItemId, CanView, CanCreate, CanEdit, CanDelete)
                            SELECT NEWID(), r.Id, @RecoveryMenuId, 1, 1, 1, 1
                            FROM Roles r
                            WHERE r.Name LIKE '%Admin%' OR r.Name LIKE '%Super%' OR r.Name LIKE '%Accountant%' OR r.Name LIKE '%Manager%' OR r.Name LIKE '%Principal%' OR r.Name LIKE '%Director%';
                        END
                    END

                    -- Critical Performance Indexes for Fast Menu Routing & User Lookups
                    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RolePermissions_RoleId_CanView' AND object_id = OBJECT_ID('RolePermissions'))
                    BEGIN
                        CREATE NONCLUSTERED INDEX IX_RolePermissions_RoleId_CanView ON RolePermissions(RoleId, CanView) INCLUDE (MenuItemId);
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MenuItems_IsActive_SortOrder' AND object_id = OBJECT_ID('MenuItems'))
                    BEGIN
                        CREATE NONCLUSTERED INDEX IX_MenuItems_IsActive_SortOrder ON MenuItems(IsActive, SortOrder);
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_RoleId' AND object_id = OBJECT_ID('Users'))
                    BEGIN
                        CREATE NONCLUSTERED INDEX IX_Users_RoleId ON Users(RoleId);
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_TenantId' AND object_id = OBJECT_ID('Users'))
                    BEGIN
                        CREATE NONCLUSTERED INDEX IX_Users_TenantId ON Users(TenantId);
                    END

                    -- Performance Indexes for Subjects & Curriculum Mapping
                    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Subjects_TenantId_IsActive_Name' AND object_id = OBJECT_ID('Subjects'))
                    BEGIN
                        CREATE NONCLUSTERED INDEX IX_Subjects_TenantId_IsActive_Name ON Subjects(TenantId, IsActive, Name);
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ClassSubjects_Tenant_Class' AND object_id = OBJECT_ID('ClassSubjects'))
                    BEGIN
                        CREATE NONCLUSTERED INDEX IX_ClassSubjects_Tenant_Class ON ClassSubjects(TenantId, ClassId) INCLUDE (SubjectId, TeacherId, DisplayOrder);
                    END

                    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SchoolClasses_Tenant_Active_Display' AND object_id = OBJECT_ID('SchoolClasses'))
                    BEGIN
                        CREATE NONCLUSTERED INDEX IX_SchoolClasses_Tenant_Active_Display ON SchoolClasses(TenantId, IsActive, DisplayOrder) INCLUDE (Name, Code);
                    END
                ");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Database Migration Warning] {ex.Message}");
            }
        }

        var users = context.Users.ToList();
        bool updated = false;

        foreach (var u in users)
        {
            if (u.Username.ToLower() == "admin" && !hasher.VerifyPassword("admin123", u.PasswordHash))
            {
                u.PasswordHash = hasher.HashPassword("admin123");
                updated = true;
            }
            else if (u.Username.ToLower() == "teacher" && !hasher.VerifyPassword("teacher123", u.PasswordHash))
            {
                u.PasswordHash = hasher.HashPassword("teacher123");
                updated = true;
            }
            else if (u.Username.ToLower() == "accountant" && !hasher.VerifyPassword("account123", u.PasswordHash))
            {
                u.PasswordHash = hasher.HashPassword("account123");
                updated = true;
            }
            else if (u.Username.ToLower() == "superadmin" && !hasher.VerifyPassword("password123", u.PasswordHash))
            {
                u.PasswordHash = hasher.HashPassword("password123");
                updated = true;
            }
        }

        if (updated)
        {
            context.SaveChanges();
            Console.WriteLine("[Database] Demo user passwords automatically hashed and saved to SQL Server.");
        }

        // Auto-seed Standard Roles ('Institute Admin', 'Accountant', 'Teacher', 'HR', 'Front Desk / Receptionist') for every tenant
        var allTenantIds = context.Tenants.Select(t => t.Id).ToList();
        foreach (var tenantId in allTenantIds)
        {
            // 1. Institute Admin
            if (!context.Roles.Any(r => r.TenantId == tenantId && r.Name == "Institute Admin"))
            {
                var role = new IMSERP.Domain.Entities.RoleEntity
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Name = "Institute Admin",
                    Description = "Principal / Center Director — full administrative access to master setup, academics, faculty, finance, attendance and institute settings.",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                context.Roles.Add(role);
                context.SaveChanges();

                var allMenus = context.MenuItems.Where(m => m.IsActive).ToList();
                foreach (var m in allMenus)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        MenuItemId = m.Id,
                        CanView = true, CanCreate = true, CanEdit = true, CanDelete = true
                    });
                }
                context.SaveChanges();
            }

            // 2. Accountant
            if (!context.Roles.Any(r => r.TenantId == tenantId && r.Name == "Accountant"))
            {
                var role = new IMSERP.Domain.Entities.RoleEntity
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Name = "Accountant",
                    Description = "Accounts & Fee Manager — handles student fee collection, invoice receipts, fee heads master, expense vouchers, accounting ledger and financial reports.",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                context.Roles.Add(role);
                context.SaveChanges();

                var accRoutes = new[] { "/dashboard", "/school/classes", "/batches", "/students", "/fees", "/fee-heads", "/whatsapp", "/finance/profit-loss", "/finance/balance-sheet", "/finance/day-book", "/finance/expenses", "/finance/chart-of-accounts", "/attendance/reports" };
                var accMenus = context.MenuItems.Where(m => accRoutes.Contains(m.RouteUrl)).ToList();
                foreach (var m in accMenus)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(), RoleId = role.Id, MenuItemId = m.Id,
                        CanView = true, CanCreate = true, CanEdit = true, CanDelete = true
                    });
                }
                context.SaveChanges();
            }

            // 3. Teacher
            if (!context.Roles.Any(r => r.TenantId == tenantId && r.Name == "Teacher"))
            {
                var role = new IMSERP.Domain.Entities.RoleEntity
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Name = "Teacher",
                    Description = "Faculty Member — batch lecture assignments, daily lesson diary, faculty attendance, student test marks, exam management and proxy substitution.",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                context.Roles.Add(role);
                context.SaveChanges();

                var teacherRoutes = new[] { "/dashboard", "/school/classes", "/batches", "/rooms", "/subjects", "/students", "/students/attendance", "/holidays", "/attendance/reports", "/teachers/assignments", "/teachers/attendance", "/teachers/substitution", "/teachers/lesson-plans", "/teachers/reports", "/school/exams", "/tests" };
                var teacherMenus = context.MenuItems.Where(m => teacherRoutes.Contains(m.RouteUrl)).ToList();
                foreach (var m in teacherMenus)
                {
                    bool canCreate = m.RouteUrl == "/teachers/lesson-plans" || m.RouteUrl == "/tests" || m.RouteUrl == "/teachers/attendance" || m.RouteUrl == "/students/attendance";
                    bool canEdit = canCreate || m.RouteUrl == "/school/exams" || m.RouteUrl == "/teachers/substitution";
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(), RoleId = role.Id, MenuItemId = m.Id,
                        CanView = true, CanCreate = canCreate, CanEdit = canEdit, CanDelete = false
                    });
                }
                context.SaveChanges();
            }

            // 4. HR
            if (!context.Roles.Any(r => r.TenantId == tenantId && r.Name == "HR"))
            {
                var hrRole = new IMSERP.Domain.Entities.RoleEntity
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Name = "HR",
                    Description = "Human Resources — manages teacher profiles, attendance, leaves, salary, advances, FNF and payroll processing.",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                context.Roles.Add(hrRole);
                context.SaveChanges();

                var hrAllowedRoutes = new[]
                {
                    "/teachers", "/teachers/assignments", "/teachers/attendance",
                    "/teachers/salary", "/teachers/payments", "/teachers/advances",
                    "/teachers/leaves", "/teachers/reports", "/teachers/fnf",
                    "/teachers/promotions",
                    "/teachers/substitution", "/teachers/lesson-plans",
                    "/dashboard", "/attendance/reports",
                    "/attendance/permissions/manual", "/attendance/permissions/correction"
                };

                var hrMenuItems = context.MenuItems.Where(m => hrAllowedRoutes.Contains(m.RouteUrl)).ToList();
                foreach (var menuItem in hrMenuItems)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(), RoleId = hrRole.Id, MenuItemId = menuItem.Id,
                        CanView = true, CanCreate = true, CanEdit = true, CanDelete = true
                    });
                }
                context.SaveChanges();
            }

            // 5. Front Desk / Receptionist
            if (!context.Roles.Any(r => r.TenantId == tenantId && r.Name == "Front Desk / Receptionist"))
            {
                var role = new IMSERP.Domain.Entities.RoleEntity
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Name = "Front Desk / Receptionist",
                    Description = "Front Desk & Admissions — student inquiries, new admission registration, fee desk collection, WhatsApp notices and attendance verification.",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                context.Roles.Add(role);
                context.SaveChanges();

                var fdRoutes = new[] { "/dashboard", "/school/classes", "/batches", "/students", "/holidays", "/fees", "/whatsapp", "/attendance/reports" };
                var fdMenus = context.MenuItems.Where(m => fdRoutes.Contains(m.RouteUrl)).ToList();
                foreach (var m in fdMenus)
                {
                    bool canCreate = m.RouteUrl == "/students" || m.RouteUrl == "/fees" || m.RouteUrl == "/whatsapp";
                    bool canEdit = m.RouteUrl == "/students" || m.RouteUrl == "/fees";
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(), RoleId = role.Id, MenuItemId = m.Id,
                        CanView = true, CanCreate = canCreate, CanEdit = canEdit, CanDelete = false
                    });
                }
                context.SaveChanges();
            }
        }

        // Auto-seed 'Subscription & Plan' MenuItem under Admin Settings
        var adminSettingsParent = context.MenuItems.FirstOrDefault(m => m.Title == "Admin Settings" && m.ParentId == null);
        if (adminSettingsParent != null)
        {
            var subMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/subscription");
            if (subMenu == null)
            {
                context.MenuItems.Add(new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = "Subscription & Plan",
                    RouteUrl = "/subscription",
                    Icon = "workspace_premium",
                    ParentId = adminSettingsParent.Id,
                    SortOrder = 5,
                    Module = "Admin",
                    IsActive = true
                });
                context.SaveChanges();
                Console.WriteLine("[Database] Auto-seeded 'Subscription & Plan' under Admin Settings.");
            }

            var bioMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/attendance/devices");
            if (bioMenu != null && bioMenu.ParentId != adminSettingsParent.Id)
            {
                bioMenu.ParentId = adminSettingsParent.Id;
                bioMenu.SortOrder = 3;
                context.SaveChanges();
            }

            // Auto-seed 'Academic & Exam Workflow' MenuItem under Admin Settings
            var workflowMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/admin/academic-workflow");
            if (workflowMenu == null)
            {
                workflowMenu = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = "Academic & Exam Workflow",
                    RouteUrl = "/admin/academic-workflow",
                    Icon = "tune",
                    ParentId = adminSettingsParent.Id,
                    SortOrder = 6,
                    Module = "Admin",
                    IsActive = true
                };
                context.MenuItems.Add(workflowMenu);
                context.SaveChanges();

                var allRoles = context.Roles.ToList();
                foreach (var role in allRoles)
                {
                    if (role.Name.Contains("Admin", StringComparison.OrdinalIgnoreCase) || 
                        role.Name.Contains("Director", StringComparison.OrdinalIgnoreCase) || 
                        role.Name.Contains("Principal", StringComparison.OrdinalIgnoreCase))
                    {
                        if (!context.RolePermissions.Any(rp => rp.RoleId == role.Id && rp.MenuItemId == workflowMenu.Id))
                        {
                            context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                            {
                                Id = Guid.NewGuid(),
                                RoleId = role.Id,
                                MenuItemId = workflowMenu.Id,
                                CanView = true,
                                CanCreate = true,
                                CanEdit = true,
                                CanDelete = true
                            });
                        }
                    }
                }
                context.SaveChanges();
                Console.WriteLine("[Database] Auto-seeded 'Academic & Exam Workflow' under Admin Settings.");
            }
        }

        // Auto-seed 'Classes & Sections' MenuItem under Master Management
        var masterMenu = context.MenuItems.FirstOrDefault(m => m.Title == "Master Management" && m.ParentId == null);
        if (masterMenu != null)
        {
            var schoolMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/school/classes");
            if (schoolMenu == null)
            {
                var newMenu = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = "Classes & Sections",
                    RouteUrl = "/school/classes",
                    Icon = "domain",
                    ParentId = masterMenu.Id,
                    SortOrder = 1,
                    Module = "Master",
                    IsActive = true
                };
                context.MenuItems.Add(newMenu);
                context.SaveChanges();

                var roles = context.Roles.ToList();
                foreach (var role in roles)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        MenuItemId = newMenu.Id,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    });
                }
                context.SaveChanges();
                Console.WriteLine("[Database] Auto-seeded 'Classes & Sections' menu item under Master Management.");
            }
        }

        // Auto-seed 'Fee Heads Master' MenuItem under Academic Operations
        var academicMenu = context.MenuItems.FirstOrDefault(m => m.Title == "Academic Operations" && m.ParentId == null);
        if (academicMenu != null)
        {
            var feeHeadMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/fee-heads");
            if (feeHeadMenu == null)
            {
                var newFeeHeadMenu = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = "Fee Heads Master",
                    RouteUrl = "/fee-heads",
                    Icon = "account_tree",
                    ParentId = academicMenu.Id,
                    SortOrder = 2,
                    Module = "Academic",
                    IsActive = true
                };
                context.MenuItems.Add(newFeeHeadMenu);
                context.SaveChanges();

                var roles = context.Roles.ToList();
                foreach (var role in roles)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        MenuItemId = newFeeHeadMenu.Id,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    });
                }
                context.SaveChanges();
                Console.WriteLine("[Database] Auto-seeded 'Fee Heads Master' menu item under Academic Operations.");
            }

            // Auto-seed 'Student Promotion' MenuItem under Academic Operations
            var promoMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/students/promotion");
            if (promoMenu == null)
            {
                var newPromoMenu = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = "Student Promotion",
                    RouteUrl = "/students/promotion",
                    Icon = "trending_up",
                    ParentId = academicMenu.Id,
                    SortOrder = 9,
                    Module = "Academic",
                    IsActive = true
                };
                context.MenuItems.Add(newPromoMenu);
                context.SaveChanges();

                var roles = context.Roles.ToList();
                foreach (var role in roles)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        MenuItemId = newPromoMenu.Id,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    });
                }
                context.SaveChanges();
                Console.WriteLine("[Database] Auto-seeded 'Student Promotion' menu item under Academic Operations.");
            }

            // Auto-seed 'School Examinations' MenuItem under Academic Operations
            var schoolExamMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/school/exams");
            if (schoolExamMenu == null)
            {
                var newSchoolExamMenu = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = "School Examinations",
                    RouteUrl = "/school/exams",
                    Icon = "assignment",
                    ParentId = academicMenu.Id,
                    SortOrder = 3,
                    Module = "Academic",
                    IsActive = true
                };
                context.MenuItems.Add(newSchoolExamMenu);
                context.SaveChanges();

                var roles = context.Roles.ToList();
                foreach (var role in roles)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        MenuItemId = newSchoolExamMenu.Id,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    });
                }
                context.SaveChanges();
                Console.WriteLine("[Database] Auto-seeded 'School Examinations' menu item under Academic Operations.");
            }

            // Auto-seed 'Homework & Daily Diary' MenuItem under Academic Operations
            var homeworkMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/school/homework");
            if (homeworkMenu == null)
            {
                var newHomeworkMenu = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = "Homework & Daily Diary",
                    RouteUrl = "/school/homework",
                    Icon = "assignment_turned_in",
                    ParentId = academicMenu.Id,
                    SortOrder = 3,
                    Module = "Academic",
                    IsActive = true
                };
                context.MenuItems.Add(newHomeworkMenu);
                context.SaveChanges();

                var roles = context.Roles.ToList();
                foreach (var role in roles)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        MenuItemId = newHomeworkMenu.Id,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    });
                }
                context.SaveChanges();
                Console.WriteLine("[Database] Auto-seeded 'Homework & Daily Diary' menu item under Academic Operations.");
            }

            // Auto-seed 'Notice Board & Circulars' MenuItem under Academic Operations
            var noticeMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/school/notices");
            if (noticeMenu == null)
            {
                var newNoticeMenu = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = "Notice Board & Circulars",
                    RouteUrl = "/school/notices",
                    Icon = "campaign",
                    ParentId = academicMenu.Id,
                    SortOrder = 4,
                    Module = "Academic",
                    IsActive = true
                };
                context.MenuItems.Add(newNoticeMenu);
                context.SaveChanges();

                var roles = context.Roles.ToList();
                foreach (var role in roles)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        MenuItemId = newNoticeMenu.Id,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    });
                }
                context.SaveChanges();
                Console.WriteLine("[Database] Auto-seeded 'Notice Board & Circulars' menu item under Academic Operations.");
            }

            // Auto-seed 'Good Manners & Behaviour' MenuItem under Academic Operations
            var mannersMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/school/good-manners");
            if (mannersMenu == null)
            {
                var newMannersMenu = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = "Good Manners & Behaviour",
                    RouteUrl = "/school/good-manners",
                    Icon = "hotel_class",
                    ParentId = academicMenu.Id,
                    SortOrder = 5,
                    Module = "Academic",
                    IsActive = true
                };
                context.MenuItems.Add(newMannersMenu);
                context.SaveChanges();

                var roles = context.Roles.ToList();
                foreach (var role in roles)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        MenuItemId = newMannersMenu.Id,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    });
                }
                context.SaveChanges();
                Console.WriteLine("[Database] Auto-seeded 'Good Manners & Behaviour' menu item under Academic Operations.");
            }

            // Auto-seed 'Monthly Student Performance' MenuItem under Academic Operations
            var monthlyPerfMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/school/monthly-performance");
            if (monthlyPerfMenu == null)
            {
                var newMonthlyPerfMenu = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = "Monthly Student Performance",
                    RouteUrl = "/school/monthly-performance",
                    Icon = "insights",
                    ParentId = academicMenu.Id,
                    SortOrder = 6,
                    Module = "Academic",
                    IsActive = true
                };
                context.MenuItems.Add(newMonthlyPerfMenu);
                context.SaveChanges();

                var roles = context.Roles.ToList();
                foreach (var role in roles)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        MenuItemId = newMonthlyPerfMenu.Id,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    });
                }
                context.SaveChanges();
                Console.WriteLine("[Database] Auto-seeded 'Monthly Student Performance' menu item under Academic Operations.");
            }
        }

        // Auto-seed 'Admission Enquiries' MenuItem under Master Management
        if (masterMenu != null)
        {
            var enquiryMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/students/enquiries");
            if (enquiryMenu == null)
            {
                var newEnquiryMenu = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = "Admission Enquiries",
                    RouteUrl = "/students/enquiries",
                    Icon = "contact_phone",
                    ParentId = masterMenu.Id,
                    SortOrder = 6,
                    Module = "Master",
                    IsActive = true
                };
                context.MenuItems.Add(newEnquiryMenu);
                context.SaveChanges();

                var roles = context.Roles.ToList();
                foreach (var role in roles)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        MenuItemId = newEnquiryMenu.Id,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    });
                }
                context.SaveChanges();
                Console.WriteLine("[Database] Auto-seeded 'Admission Enquiries' menu item under Master Management.");
            }
        }

        // Auto-seed 'Exit & FNF Settlement' MenuItem under HRMS & Staff / Teacher Module
        var teacherMenu = context.MenuItems.FirstOrDefault(m => (m.Title == "HRMS & Staff" || m.Title == "Teacher Module") && m.ParentId == null)
            ?? context.MenuItems.FirstOrDefault(m => m.Module == "Teachers" && m.ParentId == null);
        if (teacherMenu != null)
        {
            var fnfMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/teachers/fnf");
            if (fnfMenu == null)
            {
                var newFnfMenu = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = "Exit & FNF Settlement",
                    RouteUrl = "/teachers/fnf",
                    Icon = "exit_to_app",
                    ParentId = teacherMenu.Id,
                    SortOrder = 9,
                    Module = "Teachers",
                    IsActive = true
                };
                context.MenuItems.Add(newFnfMenu);
                context.SaveChanges();

                var roles = context.Roles.ToList();
                foreach (var role in roles)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        MenuItemId = newFnfMenu.Id,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    });
                }
                context.SaveChanges();
                Console.WriteLine("[Database] Auto-seeded 'Exit & FNF Settlement' menu item under Teacher Module.");
            }

            // Auto-seed 'Proxy & Substitution' MenuItem under Teacher Module
            var subMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/teachers/substitution");
            if (subMenu == null)
            {
                var newSubMenu = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = "Proxy & Substitution",
                    RouteUrl = "/teachers/substitution",
                    Icon = "swap_horiz",
                    ParentId = teacherMenu.Id,
                    SortOrder = 10,
                    Module = "Teachers",
                    IsActive = true
                };
                context.MenuItems.Add(newSubMenu);
                context.SaveChanges();

                var roles = context.Roles.ToList();
                foreach (var role in roles)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        MenuItemId = newSubMenu.Id,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    });
                }
                context.SaveChanges();
                Console.WriteLine("[Database] Auto-seeded 'Proxy & Substitution' menu item under Teacher Module.");
            }

            // Auto-seed 'Daily Lesson Diary' MenuItem under Teacher Module
            var diaryMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/teachers/lesson-plans");
            if (diaryMenu == null)
            {
                var newDiaryMenu = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = "Daily Lesson Diary",
                    RouteUrl = "/teachers/lesson-plans",
                    Icon = "menu_book",
                    ParentId = teacherMenu.Id,
                    SortOrder = 11,
                    Module = "Teachers",
                    IsActive = true
                };
                context.MenuItems.Add(newDiaryMenu);
                context.SaveChanges();

                var roles = context.Roles.ToList();
                foreach (var role in roles)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        MenuItemId = newDiaryMenu.Id,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    });
                }
                context.SaveChanges();
                Console.WriteLine("[Database] Auto-seeded 'Daily Lesson Diary' menu item under Teacher Module.");
            }

            // Auto-seed 'Promotions & Appraisals' MenuItem under Teacher Module
            var promoMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/teachers/promotions");
            if (promoMenu == null)
            {
                var newPromoMenu = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = "Promotions & Appraisals",
                    RouteUrl = "/teachers/promotions",
                    Icon = "military_tech",
                    ParentId = teacherMenu.Id,
                    SortOrder = 8,
                    Module = "Teachers",
                    IsActive = true
                };
                context.MenuItems.Add(newPromoMenu);
                context.SaveChanges();

                var roles = context.Roles.ToList();
                foreach (var role in roles)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        MenuItemId = newPromoMenu.Id,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    });
                }
                context.SaveChanges();
                Console.WriteLine("[Database] Auto-seeded 'Promotions & Appraisals' menu item under Teacher Module.");
            }
        }

        // Auto-seed 'Transport & Fleet' MenuItem under Academic Operations
        if (academicMenu != null)
        {
            var transportMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/transport");
            if (transportMenu == null)
            {
                var newTransportMenu = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = "Transport & Fleet",
                    RouteUrl = "/transport",
                    Icon = "directions_bus",
                    ParentId = academicMenu.Id,
                    SortOrder = 8,
                    Module = "Academic",
                    IsActive = true
                };
                context.MenuItems.Add(newTransportMenu);
                context.SaveChanges();

                var roles = context.Roles.ToList();
                foreach (var role in roles)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        MenuItemId = newTransportMenu.Id,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    });
                }
                context.SaveChanges();
                Console.WriteLine("[Database] Auto-seeded 'Transport & Fleet' menu item under Academic Operations.");
            }

            var noticesMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/school/notices");
            if (noticesMenu == null)
            {
                var newNoticesMenu = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = "Notice Board & Circulars",
                    RouteUrl = "/school/notices",
                    Icon = "campaign",
                    ParentId = academicMenu.Id,
                    SortOrder = 4,
                    Module = "Academic",
                    IsActive = true
                };
                context.MenuItems.Add(newNoticesMenu);
                context.SaveChanges();

                var roles = context.Roles.ToList();
                foreach (var role in roles)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        MenuItemId = newNoticesMenu.Id,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    });
                }
                context.SaveChanges();
            }

            var attendanceParent = context.MenuItems.FirstOrDefault(m => m.Title == "Attendance Management" && m.ParentId == null);
            if (attendanceParent != null)
            {
                var studentLeavesMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/students/leaves");
                if (studentLeavesMenu == null)
                {
                    var newLeavesMenu = new IMSERP.Domain.Entities.MenuItem
                    {
                        Id = Guid.NewGuid(),
                        Title = "Student Leaves & Linkage",
                        RouteUrl = "/students/leaves",
                        Icon = "event_busy",
                        ParentId = attendanceParent.Id,
                        SortOrder = 4,
                        Module = "Attendance",
                        IsActive = true
                    };
                    context.MenuItems.Add(newLeavesMenu);
                    context.SaveChanges();

                    var roles = context.Roles.ToList();
                    foreach (var role in roles)
                    {
                        context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                        {
                            Id = Guid.NewGuid(),
                            RoleId = role.Id,
                            MenuItemId = newLeavesMenu.Id,
                            CanView = true,
                            CanCreate = true,
                            CanEdit = true,
                            CanDelete = true
                        });
                    }
                    context.SaveChanges();
                }
            }
        }

        // Auto-seed 'Finance & Accounts' parent menu and submenus
        var financeParent = context.MenuItems.FirstOrDefault(m => m.Title == "Finance & Accounts" && m.ParentId == null);
        if (financeParent == null)
        {
            financeParent = new IMSERP.Domain.Entities.MenuItem
            {
                Id = Guid.NewGuid(),
                Title = "Finance & Accounts",
                RouteUrl = null,
                Icon = "account_balance",
                ParentId = null,
                SortOrder = 6,
                Module = "Finance",
                IsActive = true
            };
            context.MenuItems.Add(financeParent);
            context.SaveChanges();

            var roles = context.Roles.ToList();
            foreach (var role in roles)
            {
                context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                {
                    Id = Guid.NewGuid(),
                    RoleId = role.Id,
                    MenuItemId = financeParent.Id,
                    CanView = true,
                    CanCreate = true,
                    CanEdit = true,
                    CanDelete = true
                });
            }
            context.SaveChanges();
            Console.WriteLine("[Database] Auto-seeded 'Finance & Accounts' parent menu.");
        }

        var financeSubmenus = new[]
        {
            new { Title = "Profit & Loss", Route = "/finance/profit-loss", Icon = "query_stats", Order = 1 },
            new { Title = "Balance Sheet", Route = "/finance/balance-sheet", Icon = "account_balance_wallet", Order = 2 },
            new { Title = "Day Book", Route = "/finance/day-book", Icon = "auto_stories", Order = 3 },
            new { Title = "Expense Vouchers", Route = "/finance/expenses", Icon = "receipt_long", Order = 4 },
            new { Title = "Chart of Accounts", Route = "/finance/chart-of-accounts", Icon = "account_tree", Order = 5 },
            new { Title = "Smart Fee Recovery Agent (AI)", Route = "/finance/fee-recovery-agent", Icon = "psychology", Order = 6 }
        };

        foreach (var sub in financeSubmenus)
        {
            var existingSub = context.MenuItems.FirstOrDefault(m => m.RouteUrl == sub.Route);
            if (existingSub == null)
            {
                var newSub = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.NewGuid(),
                    Title = sub.Title,
                    RouteUrl = sub.Route,
                    Icon = sub.Icon,
                    ParentId = financeParent.Id,
                    SortOrder = sub.Order,
                    Module = "Finance",
                    IsActive = true
                };
                context.MenuItems.Add(newSub);
                context.SaveChanges();

                var roles = context.Roles.ToList();
                foreach (var role in roles)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        MenuItemId = newSub.Id,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    });
                }
                context.SaveChanges();
                Console.WriteLine($"[Database] Auto-seeded '{sub.Title}' under Finance & Accounts.");
            }
        }

        // Auto-seed 'Front Desk' parent menu and submenus (Visitor Book & Student Gate Pass)
        var frontDeskParent = context.MenuItems.FirstOrDefault(m => m.Title == "Front Desk" && m.ParentId == null);
        if (frontDeskParent == null)
        {
            frontDeskParent = new IMSERP.Domain.Entities.MenuItem
            {
                Id        = Guid.NewGuid(),
                Title     = "Front Desk",
                RouteUrl  = null,
                Icon      = "sensor_door",
                ParentId  = null,
                SortOrder = 9,
                Module    = "FrontDesk",
                IsActive  = true
            };
            context.MenuItems.Add(frontDeskParent);
            context.SaveChanges();

            var allRoles = context.Roles.ToList();
            foreach (var role in allRoles)
            {
                context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                {
                    Id = Guid.NewGuid(), RoleId = role.Id, MenuItemId = frontDeskParent.Id,
                    CanView = true, CanCreate = true, CanEdit = true, CanDelete = true
                });
            }
            context.SaveChanges();
            Console.WriteLine("[Database] Auto-seeded 'Front Desk' parent menu.");
        }

        var frontDeskSubmenus = new[]
        {
            new { Title = "Visitor Book",           Route = "/front-desk/visitors",   Icon = "badge",           Order = 1 },
            new { Title = "Student Gate Pass",      Route = "/front-desk/gate-passes", Icon = "exit_to_app",     Order = 2 },
            new { Title = "Infirmary & Sick Bay",   Route = "/front-desk/infirmary",   Icon = "local_hospital",  Order = 3 },
            new { Title = "PTM Scheduler",          Route = "/front-desk/ptm",         Icon = "calendar_month",  Order = 4 },
            new { Title = "Grievance Helpdesk",     Route = "/front-desk/grievances",  Icon = "support_agent",   Order = 5 }
        };

        foreach (var sub in frontDeskSubmenus)
        {
            var existingSub = context.MenuItems.FirstOrDefault(m => m.RouteUrl == sub.Route);
            if (existingSub == null)
            {
                var newSub = new IMSERP.Domain.Entities.MenuItem
                {
                    Id        = Guid.NewGuid(),
                    Title     = sub.Title,
                    RouteUrl  = sub.Route,
                    Icon      = sub.Icon,
                    ParentId  = frontDeskParent.Id,
                    SortOrder = sub.Order,
                    Module    = "FrontDesk",
                    IsActive  = true
                };
                context.MenuItems.Add(newSub);
                context.SaveChanges();

                var allRoles = context.Roles.ToList();
                foreach (var role in allRoles)
                {
                    context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                    {
                        Id = Guid.NewGuid(), RoleId = role.Id, MenuItemId = newSub.Id,
                        CanView = true, CanCreate = true, CanEdit = true, CanDelete = true
                    });
                }
                context.SaveChanges();
                Console.WriteLine($"[Database] Auto-seeded '{sub.Title}' under Front Desk.");
            }
        }

        // Backfill: grant existing Teacher roles access to /students/attendance (roll call)
        {
            var studAttMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/students/attendance");
            if (studAttMenu != null)
            {
                var teacherRoles = context.Roles.Where(r => r.Name == "Teacher" || r.Name == "Teacher / Faculty" || r.Name == "Faculty / Teacher").ToList();
                foreach (var tRole in teacherRoles)
                {
                    bool alreadyGranted = context.RolePermissions.Any(rp => rp.RoleId == tRole.Id && rp.MenuItemId == studAttMenu.Id);
                    if (!alreadyGranted)
                    {
                        context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                        {
                            Id = Guid.NewGuid(),
                            RoleId = tRole.Id,
                            MenuItemId = studAttMenu.Id,
                            CanView = true,
                            CanCreate = true,
                            CanEdit = true,
                            CanDelete = false
                        });
                        Console.WriteLine($"[Database] Backfill: granted Teacher role '{tRole.Id}' access to /students/attendance.");
                    }
                    else
                    {
                        // Ensure existing permissions are enabled (in case they were set to false)
                        var existing = context.RolePermissions.First(rp => rp.RoleId == tRole.Id && rp.MenuItemId == studAttMenu.Id);
                        if (!existing.CanView || !existing.CanCreate)
                        {
                            existing.CanView = true;
                            existing.CanCreate = true;
                            existing.CanEdit = true;
                            Console.WriteLine($"[Database] Backfill: updated Teacher role '{tRole.Name}' permissions for /students/attendance.");
                        }
                    }
                }
                context.SaveChanges();
            }

            // Ensure 'Student Fee Card' menu item exists and has default role permissions
            var feeCardMenu = context.MenuItems.FirstOrDefault(m => m.RouteUrl == "/fees/fee-card");
            if (feeCardMenu == null)
            {
                var academicParent = context.MenuItems.FirstOrDefault(m => m.Title == "Academic Operations" || m.Id == Guid.Parse("00000000-0000-0000-0000-000000000004"));
                feeCardMenu = new IMSERP.Domain.Entities.MenuItem
                {
                    Id = Guid.Parse("FEE00000-0000-0000-0000-0000000000FC"),
                    Title = "Student Fee Card",
                    RouteUrl = "/fees/fee-card",
                    Icon = "contact_page",
                    Module = "Academic",
                    SortOrder = 2,
                    ParentId = academicParent?.Id ?? Guid.Parse("00000000-0000-0000-0000-000000000004"),
                    IsActive = true
                };
                context.MenuItems.Add(feeCardMenu);
                context.SaveChanges();

                var allRolesList = context.Roles.ToList();
                foreach (var r in allRolesList)
                {
                    bool isAdmin = r.Name.Contains("Admin", StringComparison.OrdinalIgnoreCase) ||
                                  r.Name.Contains("Director", StringComparison.OrdinalIgnoreCase) ||
                                  r.Name.Contains("Principal", StringComparison.OrdinalIgnoreCase) ||
                                  r.Name.Contains("Accountant", StringComparison.OrdinalIgnoreCase) ||
                                  r.Name.Contains("Manager", StringComparison.OrdinalIgnoreCase);

                    bool isReceptionistOrStaff = r.Name.Contains("Receptionist", StringComparison.OrdinalIgnoreCase) ||
                                                r.Name.Contains("Front Desk", StringComparison.OrdinalIgnoreCase) ||
                                                r.Name.Contains("Cashier", StringComparison.OrdinalIgnoreCase) ||
                                                r.Name.Contains("Teacher", StringComparison.OrdinalIgnoreCase);

                    if (!context.RolePermissions.Any(rp => rp.RoleId == r.Id && rp.MenuItemId == feeCardMenu.Id))
                    {
                        context.RolePermissions.Add(new IMSERP.Domain.Entities.RolePermission
                        {
                            Id = Guid.NewGuid(),
                            RoleId = r.Id,
                            MenuItemId = feeCardMenu.Id,
                            CanView = isAdmin || isReceptionistOrStaff,
                            CanCreate = isAdmin,
                            CanEdit = isAdmin,
                            CanDelete = isAdmin
                        });
                    }
                }
                context.SaveChanges();
                Console.WriteLine("[Database] Auto-seeded 'Student Fee Card' menu item and role permissions.");
            }
        }

        Console.WriteLine("[Database] IMSERP Database ensured and ready.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Database Warning] Could not connect to SQL Server: {ex.Message}");
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

// Global Aborted / Cancelled Socket Resilience Middleware:
// Catches BadHttpRequestException and OperationCanceledException when clients (browsers, devices, mobile apps)
// disconnect, cancel, or reload pages mid-flight. Prevents Visual Studio debugger from halting on aborted connections.
app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Microsoft.AspNetCore.Server.Kestrel.Core.BadHttpRequestException)
    {
        if (!context.Response.HasStarted)
        {
            try { context.Response.StatusCode = StatusCodes.Status400BadRequest; } catch { }
        }
    }
    catch (OperationCanceledException)
    {
        // Gracefully ignore client-aborted requests
    }
});

app.UseCors("AllowAngular");

// Rewrite /api/uploads/* to /uploads/* so Nginx /api proxy serves static uploads seamlessly,
// and gracefully handle missing upload images without throwing 404 console errors.
var transparentPng1x1 = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");
app.Use(async (context, next) =>
{
    var reqPath = context.Request.Path.Value ?? string.Empty;
    if (reqPath.StartsWith("/api/uploads/", StringComparison.OrdinalIgnoreCase))
    {
        context.Request.Path = reqPath.Substring(4); // "/uploads/..."
        reqPath = context.Request.Path.Value ?? string.Empty;
    }

    if (reqPath.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
    {
        var webRoot = app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
        var relPath = reqPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var fullFilePath = Path.Combine(webRoot, relPath);
        if (!File.Exists(fullFilePath))
        {
            var ext = Path.GetExtension(fullFilePath).ToLowerInvariant();
            if (ext == ".png" || ext == ".jpg" || ext == ".jpeg" || ext == ".webp" || ext == ".gif" || ext == ".svg")
            {
                context.Response.StatusCode = StatusCodes.Status200OK;
                context.Response.ContentType = "image/png";
                context.Response.Headers["Cache-Control"] = "no-cache";
                await context.Response.Body.WriteAsync(transparentPng1x1);
                return;
            }
        }
    }

    await next();
});

app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["Cache-Control"] = "public,max-age=2592000";
        var origin = ctx.Context.Request.Headers.Origin.ToString();
        if (!string.IsNullOrEmpty(origin))
        {
            ctx.Context.Response.Headers["Access-Control-Allow-Origin"] = origin;
            ctx.Context.Response.Headers["Access-Control-Allow-Credentials"] = "true";
        }
        else
        {
            ctx.Context.Response.Headers["Access-Control-Allow-Origin"] = "*";
        }
        ctx.Context.Response.Headers["Access-Control-Allow-Methods"] = "GET, HEAD, OPTIONS";
        ctx.Context.Response.Headers["Access-Control-Allow-Headers"] = "*";
    }
});
app.UseAuthentication();
app.UseAuthorization();

// Fallback HTTP Middleware: Verifies SessionId against active session to prevent stale concurrent usage
app.Use(async (context, next) =>
{
    if (context.User?.Identity?.IsAuthenticated == true)
    {
        var tokenSessionId = context.User.FindFirst("sessionId")?.Value;
        var userIdStr = context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

        if (!string.IsNullOrEmpty(tokenSessionId) && Guid.TryParse(userIdStr, out var userId))
        {
            var presenceTracker = context.RequestServices.GetRequiredService<IMSERP.API.Services.PresenceTracker>();
            var activeSession = presenceTracker.GetActiveSession(userId);

            if (!string.IsNullOrEmpty(activeSession) && activeSession != tokenSessionId)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.Headers["X-Session-Terminated"] = "true";
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new
                {
                    error = "SessionTerminated",
                    message = "Your account has been logged in from another browser or device. For security reasons, this session has been terminated."
                });
                return;
            }
        }
    }

    try
    {
        await next();
    }
    catch (Microsoft.AspNetCore.Server.Kestrel.Core.BadHttpRequestException)
    {
        // Gracefully absorb aborted/cancelled requests when client disconnects, cancels, or reloads page mid-flight
        if (!context.Response.HasStarted)
        {
            try { context.Response.StatusCode = StatusCodes.Status400BadRequest; } catch { }
        }
    }
    catch (OperationCanceledException)
    {
        // Gracefully absorb cancellations when browser closes socket or navigation cancels request
    }
});

app.MapControllers();
app.MapHub<IMSERP.API.Hubs.PresenceHub>("/hubs/presence");
app.MapHub<IMSERP.API.Hubs.ChatHub>("/hubs/chat");

app.Run();
