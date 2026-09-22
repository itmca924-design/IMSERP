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

// 2. DbContext Configuration (SQL Server Database: IMSERP)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddDbContext<IMSERPDbContext>(options =>
{
    if (!string.IsNullOrEmpty(connectionString))
    {
        options.UseSqlServer(connectionString, sqlOptions =>
        {
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
});

builder.Services.AddAuthorization();

// 4. Controllers & OpenAPI
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// 5. CORS for Angular Material UI
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200", "http://localhost:4201", "https://localhost:4200")
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

        if (!string.IsNullOrEmpty(connectionString))
        {
            try
            {
                context.Database.ExecuteSqlRaw(@"
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'LeavingDate')
                        ALTER TABLE Students ADD LeavingDate DATETIME2 NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'LeavingReason')
                        ALTER TABLE Students ADD LeavingReason NVARCHAR(MAX) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Students') AND name = 'TCNumber')
                        ALTER TABLE Students ADD TCNumber NVARCHAR(MAX) NULL;

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
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeeInvoices') AND name = 'ClassId')
                        ALTER TABLE FeeInvoices ADD ClassId UNIQUEIDENTIFIER NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeeInvoices') AND name = 'SectionId')
                        ALTER TABLE FeeInvoices ADD SectionId UNIQUEIDENTIFIER NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeeInvoices') AND name = 'ClassName')
                        ALTER TABLE FeeInvoices ADD ClassName NVARCHAR(100) NULL;
                    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FeeInvoices') AND name = 'SectionName')
                        ALTER TABLE FeeInvoices ADD SectionName NVARCHAR(50) NULL;

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
        }

        if (updated)
        {
            context.SaveChanges();
            Console.WriteLine("[Database] Demo user passwords automatically hashed and saved to SQL Server.");
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
        }

        // Auto-seed 'Exit & FNF Settlement' MenuItem under Teacher Module
        var teacherMenu = context.MenuItems.FirstOrDefault(m => m.Title == "Teacher Module" && m.ParentId == null);
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

app.UseCors("AllowAngular");
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Cache-Control", "public,max-age=2592000");
    }
});
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
