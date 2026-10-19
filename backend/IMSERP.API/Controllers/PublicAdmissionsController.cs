using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/public/admissions")]
[AllowAnonymous]
public class PublicAdmissionsController : ControllerBase
{
    private readonly IIMSERPDbContext _db;

    public PublicAdmissionsController(IIMSERPDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Fetches public institute details, available campuses/branches, and classes for public admissions.
    /// </summary>
    [HttpGet("institute-details")]
    public async Task<ActionResult<PublicInstituteDetailsDto>> GetInstituteDetails([FromQuery] string? tenantCode, [FromQuery] Guid? tenantId)
    {
        Tenant? tenant = null;

        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == tenantId.Value && t.IsActive);
        }
        else if (!string.IsNullOrWhiteSpace(tenantCode))
        {
            var code = tenantCode.Trim().ToUpperInvariant();
            tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Code.ToUpper() == code && t.IsActive);
        }

        // If not found or not specified, fall back to the first non-system active tenant
        if (tenant == null)
        {
            tenant = await _db.Tenants.IgnoreQueryFilters()
                .Where(t => t.IsActive && t.Code != "SYSTEM")
                .OrderBy(t => t.CreatedAt)
                .FirstOrDefaultAsync();
        }

        if (tenant == null)
        {
            return NotFound(new { message = "Institute details could not be found." });
        }

        var branches = await _db.Branches.IgnoreQueryFilters()
            .Where(b => b.TenantId == tenant.Id && b.IsActive)
            .OrderBy(b => b.Name)
            .Select(b => new PublicBranchDto(
                b.Id,
                b.Name,
                b.Code,
                b.Address,
                b.ContactPhone
            ))
            .ToListAsync();

        var classes = await _db.SchoolClasses.IgnoreQueryFilters()
            .Where(c => c.TenantId == tenant.Id && c.IsActive)
            .OrderBy(c => c.Name)
            .Select(c => new PublicClassDto(
                c.Id,
                c.Name,
                c.BranchId
            ))
            .ToListAsync();

        var batches = await _db.Batches.IgnoreQueryFilters()
            .Where(b => b.TenantId == tenant.Id)
            .OrderBy(b => b.Name)
            .Select(b => new PublicBatchDto(
                b.Id,
                b.Name,
                b.Subject,
                b.StandardMonthlyFee,
                b.BranchId
            ))
            .ToListAsync();

        var currentYear = DateTime.UtcNow.Year;
        var academicYears = new List<string>
        {
            $"{currentYear}-{currentYear + 1}",
            $"{currentYear + 1}-{currentYear + 2}"
        };

        var details = new PublicInstituteDetailsDto(
            tenant.Id,
            tenant.Name,
            tenant.Code,
            tenant.Address,
            tenant.ContactPhone,
            tenant.ProfilePhoto,
            branches,
            classes,
            batches,
            academicYears
        );

        return Ok(details);
    }

    /// <summary>
    /// Submits a public admission application from the online portal form.
    /// </summary>
    [HttpPost("apply")]
    public async Task<ActionResult<PublicAdmissionResponseDto>> SubmitApplication([FromBody] PublicAdmissionApplicationDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.StudentName))
            return BadRequest(new { message = "Student full name is required." });

        if (string.IsNullOrWhiteSpace(dto.ParentName))
            return BadRequest(new { message = "Parent or guardian name is required." });

        if (string.IsNullOrWhiteSpace(dto.Phone))
            return BadRequest(new { message = "Contact phone number is required." });

        var cleanPhone = new string(dto.Phone.Where(char.IsDigit).ToArray());
        if (cleanPhone.Length < 10)
            return BadRequest(new { message = "Please enter a valid 10-digit mobile number." });

        // Resolve Tenant
        Tenant? tenant = null;
        if (dto.TenantId.HasValue && dto.TenantId.Value != Guid.Empty)
        {
            tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == dto.TenantId.Value && t.IsActive);
        }
        else if (!string.IsNullOrWhiteSpace(dto.TenantCode))
        {
            var code = dto.TenantCode.Trim().ToUpperInvariant();
            tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Code.ToUpper() == code && t.IsActive);
        }

        if (tenant == null)
        {
            tenant = await _db.Tenants.IgnoreQueryFilters()
                .Where(t => t.IsActive && t.Code != "SYSTEM")
                .OrderBy(t => t.CreatedAt)
                .FirstOrDefaultAsync();
        }

        if (tenant == null)
            return BadRequest(new { message = "Unable to determine institute context for admission." });

        // Resolve Branch
        Guid? branchId = dto.BranchId;
        Branch? branch = null;
        if (branchId.HasValue)
        {
            branch = await _db.Branches.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.Id == branchId.Value && b.TenantId == tenant.Id);
        }
        if (branch == null)
        {
            branch = await _db.Branches.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.TenantId == tenant.Id && b.IsActive);
            branchId = branch?.Id;
        }

        // Generate serial Application Number: APP-2026-0001
        var year = DateTime.UtcNow.Year;
        var existingCount = await _db.AdmissionEnquiries.IgnoreQueryFilters()
            .CountAsync(e => e.TenantId == tenant.Id && e.EnquiryDate.Year == year);

        var appNumber = $"APP-{year}-{(existingCount + 1):D4}";

        // Resolve Class Name
        string className = dto.InterestedClassName ?? string.Empty;
        if (string.IsNullOrWhiteSpace(className) && dto.InterestedClassId.HasValue)
        {
            var cls = await _db.SchoolClasses.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == dto.InterestedClassId.Value);
            className = cls?.Name ?? string.Empty;
        }

        // Resolve Batch Name
        string? batchName = dto.InterestedBatchName;
        if (string.IsNullOrWhiteSpace(batchName) && dto.InterestedBatchId.HasValue)
        {
            var bt = await _db.Batches.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.Id == dto.InterestedBatchId.Value);
            batchName = bt?.Name;
        }

        var isCoaching = string.Equals(dto.AdmissionStream, "Coaching", StringComparison.OrdinalIgnoreCase);

        var enquiry = new AdmissionEnquiry
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            BranchId = branchId,
            EnquiryNumber = appNumber,
            ApplicationNumber = appNumber,
            StudentName = dto.StudentName.Trim(),
            ParentName = dto.ParentName.Trim(),
            MotherName = dto.MotherName?.Trim(),
            FatherOccupation = dto.FatherOccupation?.Trim(),
            Phone = cleanPhone,
            AlternatePhone = dto.AlternatePhone?.Trim(),
            Email = dto.Email?.Trim(),
            Address = dto.Address?.Trim(),
            City = dto.City?.Trim(),
            State = dto.State?.Trim(),
            Pincode = dto.Pincode?.Trim(),
            DateOfBirth = dto.DateOfBirth,
            Gender = !string.IsNullOrWhiteSpace(dto.Gender) ? dto.Gender : "Male",
            BloodGroup = dto.BloodGroup?.Trim(),
            Category = !string.IsNullOrWhiteSpace(dto.Category) ? dto.Category.Trim() : "General",
            AadhaarNumber = dto.AadhaarNumber?.Trim(),
            AdmissionStream = isCoaching ? "Coaching" : "School",
            InterestedClassId = !isCoaching ? dto.InterestedClassId : null,
            InterestedClassName = !isCoaching ? className : null,
            InterestedBatchId = isCoaching ? dto.InterestedBatchId : null,
            InterestedBatchName = isCoaching ? (batchName ?? dto.InterestedClassName) : null,
            AcademicYear = !string.IsNullOrWhiteSpace(dto.AcademicYear) ? dto.AcademicYear : $"{year}-{year + 1}",
            PreviousSchoolName = dto.PreviousSchoolName?.Trim(),
            PreviousMarks = dto.PreviousMarks?.Trim(),
            RequiresTransport = dto.RequiresTransport,
            RequiresHostel = dto.RequiresHostel,
            EnquiryDate = DateTime.UtcNow,
            Source = "Online Portal",
            Status = "New",
            Priority = "High",
            Remarks = dto.Remarks?.Trim(),
            CreatedBy = "Public Online Portal",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.AdmissionEnquiries.Add(enquiry);
        await _db.SaveChangesAsync();

        var response = new PublicAdmissionResponseDto(
            Success: true,
            ApplicationNumber: appNumber,
            StudentName: enquiry.StudentName,
            SubmissionDate: DateTime.UtcNow.AddHours(5).AddMinutes(30).ToString("dd MMM yyyy, hh:mm tt") + " IST",
            InstituteName: tenant.Name,
            BranchName: branch?.Name,
            Message: "Your admission application has been successfully submitted! Please save your Application Number for future reference. Our admissions office will verify your details and contact you shortly."
        );

        return Ok(response);
    }

    /// <summary>
    /// Allows parents to track application status using Application Number and Contact Phone.
    /// </summary>
    [HttpGet("status/{applicationNumber}")]
    public async Task<ActionResult<ApplicationTrackingResultDto>> TrackStatus(string applicationNumber, [FromQuery] string phone)
    {
        if (string.IsNullOrWhiteSpace(applicationNumber) || string.IsNullOrWhiteSpace(phone))
            return BadRequest(new { message = "Application number and phone number are required." });

        var cleanPhone = new string(phone.Where(char.IsDigit).ToArray());
        var cleanApp = applicationNumber.Trim().ToUpperInvariant();

        var enquiry = await _db.AdmissionEnquiries.IgnoreQueryFilters()
            .Include(e => e.Branch)
            .FirstOrDefaultAsync(e =>
                (e.EnquiryNumber.ToUpper() == cleanApp || (e.ApplicationNumber != null && e.ApplicationNumber.ToUpper() == cleanApp)) &&
                e.Phone.Contains(cleanPhone));

        if (enquiry == null)
        {
            return NotFound(new ApplicationTrackingResultDto(
                Found: false,
                ApplicationNumber: applicationNumber,
                StudentName: null,
                ParentName: null,
                Phone: null,
                ClassName: null,
                BranchName: null,
                Status: "Not Found",
                ApplicationDate: null,
                Remarks: "No application found with matching application number and registered mobile number."
            ));
        }

        return Ok(new ApplicationTrackingResultDto(
            Found: true,
            ApplicationNumber: enquiry.ApplicationNumber ?? enquiry.EnquiryNumber,
            StudentName: enquiry.StudentName,
            ParentName: enquiry.ParentName,
            Phone: enquiry.Phone,
            ClassName: enquiry.InterestedClassName,
            BranchName: enquiry.Branch?.Name,
            Status: enquiry.Status,
            ApplicationDate: enquiry.EnquiryDate,
            Remarks: enquiry.Remarks
        ));
    }
}
