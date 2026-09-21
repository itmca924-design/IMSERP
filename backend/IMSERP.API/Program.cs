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
