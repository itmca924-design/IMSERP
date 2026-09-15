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
        else
        {
            Console.WriteLine("[Database] IMSERP Database ensured and ready.");
        }
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
