using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Infrastructure.Persistence;
using IMSERP.API.Services;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[SkipMenuPermission]
public class MasterImportController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public MasterImportController(IIMSERPDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    #region 1. ACADEMIC CLASSES & SECTIONS IMPORT

    /// <summary>
    /// Download standard CSV/Excel template for Academic Classes
    /// </summary>
    [HttpGet("classes/template")]
    [AllowAnonymous]
    public IActionResult DownloadClassesTemplate()
    {
        var sb = new StringBuilder();
        sb.AppendLine("ClassName,ClassCode,AcademicScope,DisplayOrder");
        sb.AppendLine("Play Group,PG,Both,1");
        sb.AppendLine("Nursery,NUR,Both,2");
        sb.AppendLine("LKG,LKG,Both,3");
        sb.AppendLine("UKG,UKG,Both,4");
        sb.AppendLine("Class 1,CLS01,Both,5");
        sb.AppendLine("Class 2,CLS02,Both,6");
        sb.AppendLine("Class 3,CLS03,Both,7");
        sb.AppendLine("Class 4,CLS04,Both,8");
        sb.AppendLine("Class 5,CLS05,Both,9");
        sb.AppendLine("Class 6,CLS06,Both,10");
        sb.AppendLine("Class 7,CLS07,Both,11");
        sb.AppendLine("Class 8,CLS08,Both,12");
        sb.AppendLine("Class 9,CLS09,Both,13");
        sb.AppendLine("Class 10,CLS10,Both,14");
        sb.AppendLine("Class 11,CLS11,Both,15");
        sb.AppendLine("Class 12,CLS12,Both,16");

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", "IMSERP_Classes_Master_Template.csv");
    }

    /// <summary>
    /// Preview and pre-validate Classes & Sections Excel/CSV upload
    /// </summary>
    [HttpPost("classes/preview")]
    public async Task<ActionResult<ClassImportPreviewResponseDto>> PreviewClassesImport([FromForm] IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "No file uploaded. Please upload a valid .xlsx or .csv file." });
        }

        var rows = ParseUploadedFile(file);
        if (rows.Count == 0)
        {
            return BadRequest(new { message = "The uploaded file contains no data rows or could not be parsed." });
        }

        var tenantId = _currentUser.TenantId;
        var existingClasses = await _db.SchoolClasses
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId)
            .ToListAsync();

        var existingNames = existingClasses.Select(c => c.Name.Trim().ToLowerInvariant()).ToHashSet();
        var existingCodes = existingClasses.Where(c => !string.IsNullOrWhiteSpace(c.Code))
            .Select(c => c.Code!.Trim().ToLowerInvariant()).ToHashSet();

        var previewItems = new List<ClassImportItemDto>();
        int rowIdx = 1;
        var seenNamesInFile = new HashSet<string>();
        var seenCodesInFile = new HashSet<string>();

        foreach (var r in rows)
        {
            rowIdx++;
            string className = GetVal(r, "ClassName", "Class", "Name");
            string classCode = GetVal(r, "ClassCode", "Code", "ShortCode");
            string scope = GetVal(r, "AcademicScope", "Scope", "Division");
            string orderStr = GetVal(r, "DisplayOrder", "Order", "SortOrder");

            if (string.IsNullOrWhiteSpace(scope)) scope = "Both";
            if (!int.TryParse(orderStr, out int displayOrder)) displayOrder = previewItems.Count + 1;

            var item = new ClassImportItemDto
            {
                RowNumber = rowIdx,
                ClassName = className,
                ClassCode = string.IsNullOrWhiteSpace(classCode) ? null : classCode.ToUpperInvariant(),
                AcademicScope = NormalizeScope(scope),
                DisplayOrder = displayOrder,
                AutoSections = new List<string> { "A", "B" },
                IsValid = true,
                Status = "New"
            };

            if (string.IsNullOrWhiteSpace(className))
            {
                item.IsValid = false;
                item.Status = "Error";
                item.ErrorMessage = "Class Name is mandatory.";
            }
            else
            {
                var lowerName = className.Trim().ToLowerInvariant();
                var lowerCode = string.IsNullOrWhiteSpace(classCode) ? null : classCode.Trim().ToLowerInvariant();

                if (seenNamesInFile.Contains(lowerName))
                {
                    item.IsValid = false;
                    item.Status = "Error";
                    item.ErrorMessage = $"Duplicate class '{className}' found multiple times in this file.";
                }
                else if (lowerCode != null && seenCodesInFile.Contains(lowerCode))
                {
                    item.IsValid = false;
                    item.Status = "Error";
                    item.ErrorMessage = $"Duplicate class code '{classCode}' found multiple times in this file.";
                }
                else
                {
                    seenNamesInFile.Add(lowerName);
                    if (lowerCode != null) seenCodesInFile.Add(lowerCode);

                    if (existingNames.Contains(lowerName))
                    {
                        item.Status = "Existing";
                        item.ErrorMessage = $"Class '{className}' already exists in your institute.";
                    }
                    else if (lowerCode != null && existingCodes.Contains(lowerCode))
                    {
                        item.Status = "Existing";
                        item.ErrorMessage = $"Class Code '{classCode}' already exists in your institute.";
                    }
                }
            }

            previewItems.Add(item);
        }

        var resp = new ClassImportPreviewResponseDto
        {
            TotalRows = previewItems.Count,
            ValidRows = previewItems.Count(i => i.IsValid),
            ErrorRows = previewItems.Count(i => !i.IsValid),
            Items = previewItems
        };

        return Ok(resp);
    }

    /// <summary>
    /// Confirm and transactional bulk save classes with Section A and Section B auto-creation
    /// </summary>
    [HttpPost("classes/confirm")]
    public async Task<ActionResult<object>> ConfirmClassesImport([FromBody] ConfirmClassImportRequestDto request)
    {
        if (request?.Items == null || request.Items.Count == 0)
        {
            return BadRequest(new { message = "No valid class records submitted for import." });
        }

        var tenantId = _currentUser.TenantId;
        var branchId = _currentUser.BranchId;

        if (!branchId.HasValue || branchId.Value == Guid.Empty)
        {
            branchId = await _db.Branches
                .Where(b => b.TenantId == tenantId && b.IsActive)
                .Select(b => (Guid?)b.Id)
                .FirstOrDefaultAsync();
        }

        var existingClasses = await _db.SchoolClasses
            .Include(c => c.Sections)
            .Where(c => c.TenantId == tenantId)
            .ToListAsync();

        var existingDict = existingClasses
            .Where(c => !string.IsNullOrWhiteSpace(c.Name))
            .GroupBy(c => c.Name.Trim().ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.First());

        var existingByCode = existingClasses
            .Where(c => !string.IsNullOrWhiteSpace(c.Code))
            .GroupBy(c => c.Code!.Trim().ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.First());

        int createdClassesCount = 0;
        int updatedClassesCount = 0;
        int skippedClassesCount = 0;
        int sectionsCreatedCount = 0;

        foreach (var item in request.Items.Where(i => i.IsValid))
        {
            var lowerName = item.ClassName.Trim().ToLowerInvariant();
            var lowerCode = string.IsNullOrWhiteSpace(item.ClassCode) ? null : item.ClassCode.Trim().ToLowerInvariant();

            SchoolClass? existing = null;
            if (existingDict.TryGetValue(lowerName, out var byName))
            {
                existing = byName;
            }
            else if (lowerCode != null && existingByCode.TryGetValue(lowerCode, out var byCode))
            {
                existing = byCode;
            }

            if (existing != null)
            {
                if (request.UpdateExisting)
                {
                    existing.Name = item.ClassName.Trim();
                    if (!string.IsNullOrWhiteSpace(item.ClassCode)) existing.Code = item.ClassCode.Trim().ToUpperInvariant();
                    existing.AcademicScope = item.AcademicScope;
                    existing.DisplayOrder = item.DisplayOrder;
                    updatedClassesCount++;

                    // Ensure Section C is completely removed from database if present
                    var secCToRemove = (existing.Sections ?? new List<SchoolSection>())
                        .Where(s => s.Name != null && (s.Name.Trim().Equals("C", StringComparison.OrdinalIgnoreCase) || s.Name.Trim().Equals("Section C", StringComparison.OrdinalIgnoreCase) || s.Name.Trim().Equals("SEC-C", StringComparison.OrdinalIgnoreCase)))
                        .ToList();
                    if (secCToRemove.Count > 0)
                    {
                        _db.SchoolSections.RemoveRange(secCToRemove);
                    }

                    // Ensure Section A and Section B exist for this class
                    var secNames = (existing.Sections ?? new List<SchoolSection>())
                        .Where(s => !string.IsNullOrWhiteSpace(s.Name))
                        .Select(s => s.Name.Trim().ToUpperInvariant())
                        .ToHashSet();

                    if (!secNames.Contains("A"))
                    {
                        var newSecA = new SchoolSection
                        {
                            TenantId = tenantId,
                            BranchId = branchId,
                            ClassId = existing.Id,
                            Name = "A",
                            MaxCapacity = 45,
                            IsActive = true,
                            CreatedAt = DateTime.UtcNow
                        };
                        _db.SchoolSections.Add(newSecA);
                        existing.Sections?.Add(newSecA);
                        sectionsCreatedCount++;
                    }
                    if (!secNames.Contains("B"))
                    {
                        var newSecB = new SchoolSection
                        {
                            TenantId = tenantId,
                            BranchId = branchId,
                            ClassId = existing.Id,
                            Name = "B",
                            MaxCapacity = 45,
                            IsActive = true,
                            CreatedAt = DateTime.UtcNow
                        };
                        _db.SchoolSections.Add(newSecB);
                        existing.Sections?.Add(newSecB);
                        sectionsCreatedCount++;
                    }
                }
                else
                {
                    // Strictly skip duplicates when UpdateExisting is false
                    skippedClassesCount++;
                }
            }
            else
            {
                // Create brand new class
                var newClass = new SchoolClass
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = branchId,
                    Name = item.ClassName.Trim(),
                    Code = item.ClassCode?.Trim()?.ToUpperInvariant(),
                    DisplayOrder = item.DisplayOrder,
                    AcademicScope = item.AcademicScope,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };

                _db.SchoolClasses.Add(newClass);
                existingDict[lowerName] = newClass;
                if (!string.IsNullOrWhiteSpace(newClass.Code))
                {
                    existingByCode[newClass.Code.ToLowerInvariant()] = newClass;
                }
                createdClassesCount++;

                // Auto-create Section A and Section B
                var secA = new SchoolSection
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = branchId,
                    ClassId = newClass.Id,
                    Name = "A",
                    MaxCapacity = 45,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                var secB = new SchoolSection
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = branchId,
                    ClassId = newClass.Id,
                    Name = "B",
                    MaxCapacity = 45,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };

                _db.SchoolSections.AddRange(secA, secB);
                sectionsCreatedCount += 2;
            }
        }

        try
        {
            await _db.SaveChangesAsync();
            string msg = request.UpdateExisting
                ? $"Successfully configured {createdClassesCount} new classes, updated {updatedClassesCount} classes, and initialized {sectionsCreatedCount} sections."
                : $"Successfully configured {createdClassesCount} new classes and {sectionsCreatedCount} sections. {skippedClassesCount} existing classes were skipped to prevent duplicates.";

            return Ok(new
            {
                success = true,
                createdClassesCount,
                updatedClassesCount,
                skippedClassesCount,
                sectionsCreatedCount,
                message = msg
            });
        }
        catch (DbUpdateException dbEx)
        {
            var inner = dbEx.InnerException?.Message ?? dbEx.Message;
            return BadRequest(new { message = $"Database constraint failure: {inner}" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Import save failed: {ex.Message}" });
        }
    }

    #endregion

    #region 2. FEE HEADS MASTER IMPORT

    /// <summary>
    /// Download standard CSV/Excel template for Fee Heads Master aligned with ERP database catalog
    /// </summary>
    [HttpGet("fee-heads/template")]
    [AllowAnonymous]
    public IActionResult DownloadFeeHeadsTemplate()
    {
        var sb = new StringBuilder();
        sb.AppendLine("FeeHeadName,ShortCode,Category,Frequency,ApplicableTo,SortOrder,Description");
        sb.AppendLine("School Tuition Fee,TUI,Academic,Monthly,School,10,Monthly Academic Tuition Fee");
        sb.AppendLine("Coaching Tuition Fee,COACH,Academic,Monthly,Coaching,15,Monthly Coaching Batch Academic Tuition Fee");
        sb.AppendLine("Admission & Registration Fee,ADM,Academic,OneTime,Both,20,One-Time admission charge and student kit");
        sb.AppendLine("School Examination Fee,EXAM,Academic,TermWise,Both,30,Terminal and half-yearly examination charges");
        sb.AppendLine("Annual Development Charge,ANNUAL,Infrastructure,Annual,Both,40,Campus infrastructure & annual maintenance");
        sb.AppendLine("Computer & Smart Lab Fee,COMP,Academic,Monthly,Both,50,Interactive smart board and IT computer lab");
        sb.AppendLine("Sports & Physical Activity,SPORT,Activities,Annual,School,60,Sports coaching, physical equipment and games");
        sb.AppendLine("Library & Reading Room Fee,LIB,Academic,Monthly,Both,65,Library subscription, journals and reading room");
        sb.AppendLine("Transport Bus Fee,TRANS,Transport,Monthly,Both,70,Monthly bus conveyance & stoppage charges");
        sb.AppendLine("Hostel & Accommodation Fee,HOSTEL,Residential,Monthly,Both,75,Hostel boarding and room accommodation charges");
        sb.AppendLine("Mess & Dining Fee,MESS,Residential,Monthly,Both,80,Hostel mess meals, breakfast and dining charges");
        sb.AppendLine("Attendance Absence Fine,ATTN_FINE,Fine,Monthly,Both,90,Fine levied for unauthorized absence without leave");
        sb.AppendLine("Late Payment Penalty Fine,LATE_FEE,Fine,Monthly,Both,100,Late payment penalty charge on overdue invoice");

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", "IMSERP_Fee_Heads_Master_Template.csv");
    }

    /// <summary>
    /// Preview and pre-validate Fee Heads Excel/CSV upload
    /// </summary>
    [HttpPost("fee-heads/preview")]
    public async Task<ActionResult<FeeHeadImportPreviewResponseDto>> PreviewFeeHeadsImport([FromForm] IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "No file uploaded. Please upload a valid .xlsx or .csv file." });
        }

        var rows = ParseUploadedFile(file);
        if (rows.Count == 0)
        {
            return BadRequest(new { message = "The uploaded file contains no data rows or could not be parsed." });
        }

        var tenantId = _currentUser.TenantId;
        var existingHeads = await _db.FeeHeads
            .AsNoTracking()
            .Where(f => f.TenantId == tenantId)
            .ToListAsync();

        var existingNames = existingHeads.Select(f => f.Name.Trim().ToLowerInvariant()).ToHashSet();
        var existingCodes = existingHeads.Select(f => f.Code.Trim().ToLowerInvariant()).ToHashSet();

        var previewItems = new List<FeeHeadImportItemDto>();
        int rowIdx = 1;
        var seenCodesInFile = new HashSet<string>();
        var seenNamesInFile = new HashSet<string>();

        foreach (var r in rows)
        {
            rowIdx++;
            string name = GetVal(r, "FeeHeadName", "HeadName", "Name", "FeeHead");
            string code = GetVal(r, "ShortCode", "Code");
            string category = GetVal(r, "Category", "FeeCategory");
            string frequency = GetVal(r, "Frequency", "BillingFrequency");
            string applicableTo = GetVal(r, "ApplicableTo", "Scope", "Division");
            string sortOrderStr = GetVal(r, "SortOrder", "Order");
            string desc = GetVal(r, "Description", "Desc", "BillingNote");

            if (string.IsNullOrWhiteSpace(code) && !string.IsNullOrWhiteSpace(name))
            {
                code = new string(name.Where(char.IsLetterOrDigit).Take(6).ToArray()).ToUpperInvariant();
            }

            if (!int.TryParse(sortOrderStr, out int sortOrder)) sortOrder = (previewItems.Count + 1) * 10;

            var item = new FeeHeadImportItemDto
            {
                RowNumber = rowIdx,
                FeeHeadName = name,
                ShortCode = code?.Trim().ToUpperInvariant() ?? "",
                Category = NormalizeCategory(category),
                Frequency = NormalizeFrequency(frequency),
                ApplicableTo = NormalizeScope(applicableTo),
                SortOrder = sortOrder,
                Description = string.IsNullOrWhiteSpace(desc) ? null : desc.Trim(),
                IsValid = true,
                Status = "New"
            };

            if (string.IsNullOrWhiteSpace(name))
            {
                item.IsValid = false;
                item.Status = "Error";
                item.ErrorMessage = "Fee Head Name is mandatory.";
            }
            else if (string.IsNullOrWhiteSpace(code))
            {
                item.IsValid = false;
                item.Status = "Error";
                item.ErrorMessage = "Unique Short Code is mandatory.";
            }
            else
            {
                var lowerCode = code.Trim().ToLowerInvariant();
                var lowerName = name.Trim().ToLowerInvariant();

                if (seenCodesInFile.Contains(lowerCode))
                {
                    item.IsValid = false;
                    item.Status = "Error";
                    item.ErrorMessage = $"Duplicate Short Code '{code}' appears multiple times in file.";
                }
                else if (seenNamesInFile.Contains(lowerName))
                {
                    item.IsValid = false;
                    item.Status = "Error";
                    item.ErrorMessage = $"Duplicate Fee Head '{name}' appears multiple times in file.";
                }
                else
                {
                    seenCodesInFile.Add(lowerCode);
                    seenNamesInFile.Add(lowerName);

                    if (existingCodes.Contains(lowerCode))
                    {
                        item.Status = "Existing";
                        item.ErrorMessage = $"Short Code '{code}' already exists in your catalog.";
                    }
                    else if (existingNames.Contains(lowerName))
                    {
                        item.Status = "Existing";
                        item.ErrorMessage = $"Fee Head '{name}' already exists in your catalog.";
                    }
                }
            }

            previewItems.Add(item);
        }

        var resp = new FeeHeadImportPreviewResponseDto
        {
            TotalRows = previewItems.Count,
            ValidRows = previewItems.Count(i => i.IsValid),
            ErrorRows = previewItems.Count(i => !i.IsValid),
            Items = previewItems
        };

        return Ok(resp);
    }

    /// <summary>
    /// Confirm and transactional bulk save Fee Heads Master with duplicate prevention
    /// </summary>
    [HttpPost("fee-heads/confirm")]
    public async Task<ActionResult<object>> ConfirmFeeHeadsImport([FromBody] ConfirmFeeHeadImportRequestDto request)
    {
        if (request?.Items == null || request.Items.Count == 0)
        {
            return BadRequest(new { message = "No valid fee head records submitted for import." });
        }

        var tenantId = _currentUser.TenantId;
        var branchId = _currentUser.BranchId;

        if (!branchId.HasValue || branchId.Value == Guid.Empty)
        {
            branchId = await _db.Branches
                .Where(b => b.TenantId == tenantId && b.IsActive)
                .Select(b => (Guid?)b.Id)
                .FirstOrDefaultAsync();
        }

        var existingHeads = await _db.FeeHeads
            .Where(f => f.TenantId == tenantId)
            .ToListAsync();

        var existingByCode = existingHeads
            .Where(f => !string.IsNullOrWhiteSpace(f.Code))
            .GroupBy(f => f.Code.Trim().ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.First());

        var existingByName = existingHeads
            .Where(f => !string.IsNullOrWhiteSpace(f.Name))
            .GroupBy(f => f.Name.Trim().ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.First());

        int createdCount = 0;
        int updatedCount = 0;
        int skippedCount = 0;

        foreach (var item in request.Items.Where(i => i.IsValid))
        {
            var lowerCode = item.ShortCode.Trim().ToLowerInvariant();
            var lowerName = item.FeeHeadName.Trim().ToLowerInvariant();

            FeeHead? existing = null;
            if (existingByCode.TryGetValue(lowerCode, out var byCode))
            {
                existing = byCode;
            }
            else if (existingByName.TryGetValue(lowerName, out var byName))
            {
                existing = byName;
            }

            if (existing != null)
            {
                if (request.UpdateExisting)
                {
                    existing.Name = item.FeeHeadName.Trim();
                    existing.Code = item.ShortCode.Trim().ToUpperInvariant();
                    existing.Category = item.Category;
                    existing.Frequency = item.Frequency;
                    existing.ApplicableTo = item.ApplicableTo;
                    existing.SortOrder = item.SortOrder;
                    if (!string.IsNullOrWhiteSpace(item.Description))
                    {
                        existing.Description = item.Description.Trim();
                    }
                    updatedCount++;
                }
                else
                {
                    // Strictly skip duplicates to avoid multiple entries in DB
                    skippedCount++;
                }
            }
            else
            {
                var newHead = new FeeHead
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = branchId,
                    Name = item.FeeHeadName.Trim(),
                    Code = item.ShortCode.Trim().ToUpperInvariant(),
                    Category = item.Category,
                    Frequency = item.Frequency,
                    ApplicableTo = item.ApplicableTo,
                    SortOrder = item.SortOrder,
                    Description = item.Description,
                    IsActive = true,
                    IsDefault = false,
                    CreatedAt = DateTime.UtcNow
                };

                _db.FeeHeads.Add(newHead);
                existingByCode[lowerCode] = newHead;
                existingByName[lowerName] = newHead;
                createdCount++;
            }
        }

        try
        {
            await _db.SaveChangesAsync();
            string msg = request.UpdateExisting
                ? $"Successfully saved {createdCount} new Fee Heads and updated {updatedCount} existing heads."
                : $"Successfully saved {createdCount} new Fee Heads. {skippedCount} existing heads were skipped to avoid duplicates.";

            return Ok(new
            {
                success = true,
                createdCount,
                updatedCount,
                skippedCount,
                message = msg
            });
        }
        catch (DbUpdateException dbEx)
        {
            var inner = dbEx.InnerException?.Message ?? dbEx.Message;
            return BadRequest(new { message = $"Database constraint failure: {inner}" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Import save failed: {ex.Message}" });
        }
    }

    #endregion

    #region 3. UNIVERSAL SPREADSHEET PARSER (XLSX & CSV)

    private List<Dictionary<string, string>> ParseUploadedFile(IFormFile file)
    {
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        using var stream = file.OpenReadStream();

        if (ext == ".xlsx")
        {
            return ParseXlsxStream(stream);
        }
        else
        {
            // Default to CSV parser
            return ParseCsvStream(stream);
        }
    }

    private List<Dictionary<string, string>> ParseXlsxStream(Stream stream)
    {
        var result = new List<Dictionary<string, string>>();

        try
        {
            using var archive = new ZipArchive(stream, ZipArchiveMode.Read, true);

            // 1. Read shared strings if present
            var sharedStrings = new List<string>();
            var sharedEntry = archive.GetEntry("xl/sharedStrings.xml");
            if (sharedEntry != null)
            {
                using var sStream = sharedEntry.Open();
                var sDoc = XDocument.Load(sStream);
                XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
                foreach (var si in sDoc.Descendants(ns + "si"))
                {
                    var text = string.Concat(si.Descendants(ns + "t").Select(t => t.Value));
                    sharedStrings.Add(text);
                }
            }

            // 2. Read first worksheet
            var sheetEntry = archive.GetEntry("xl/worksheets/sheet1.xml")
                             ?? archive.Entries.FirstOrDefault(e => e.FullName.StartsWith("xl/worksheets/sheet", StringComparison.OrdinalIgnoreCase));

            if (sheetEntry == null) return result;

            using var wStream = sheetEntry.Open();
            var wDoc = XDocument.Load(wStream);
            XNamespace wns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

            var rows = wDoc.Descendants(wns + "row").OrderBy(r => (int?)r.Attribute("r") ?? 0).ToList();
            if (rows.Count < 2) return result;

            // Header row
            var headerMap = new Dictionary<int, string>();
            var headerRow = rows[0];
            foreach (var c in headerRow.Descendants(wns + "c"))
            {
                string rAttr = (string?)c.Attribute("r") ?? "";
                int colIdx = GetColumnIndexFromCellRef(rAttr);
                string val = GetCellValue(c, wns, sharedStrings);
                if (!string.IsNullOrWhiteSpace(val))
                {
                    headerMap[colIdx] = NormalizeHeaderKey(val);
                }
            }

            // Data rows
            for (int i = 1; i < rows.Count; i++)
            {
                var rowElem = rows[i];
                var rowData = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

                foreach (var c in rowElem.Descendants(wns + "c"))
                {
                    string rAttr = (string?)c.Attribute("r") ?? "";
                    int colIdx = GetColumnIndexFromCellRef(rAttr);
                    if (headerMap.TryGetValue(colIdx, out var headerKey))
                    {
                        string val = GetCellValue(c, wns, sharedStrings);
                        rowData[headerKey] = val;
                    }
                }

                if (rowData.Values.Any(v => !string.IsNullOrWhiteSpace(v)))
                {
                    result.Add(rowData);
                }
            }
        }
        catch
        {
            // Fallback gracefully
        }

        return result;
    }

    private static string GetCellValue(XElement cell, XNamespace ns, List<string> sharedStrings)
    {
        string? tAttr = (string?)cell.Attribute("t");
        var valElem = cell.Element(ns + "v");
        string rawVal = valElem?.Value ?? string.Empty;

        if (tAttr == "s" && int.TryParse(rawVal, out int strIdx) && strIdx >= 0 && strIdx < sharedStrings.Count)
        {
            return sharedStrings[strIdx].Trim();
        }

        if (tAttr == "inlineStr")
        {
            var isElem = cell.Element(ns + "is");
            return string.Concat(isElem?.Descendants(ns + "t").Select(t => t.Value) ?? Array.Empty<string>()).Trim();
        }

        return rawVal.Trim();
    }

    private static int GetColumnIndexFromCellRef(string cellRef)
    {
        var letters = new string(cellRef.TakeWhile(char.IsLetter).ToArray());
        if (string.IsNullOrEmpty(letters)) return 0;

        int index = 0;
        foreach (char c in letters.ToUpperInvariant())
        {
            if (c >= 'A' && c <= 'Z')
            {
                index = index * 26 + (c - 'A' + 1);
            }
        }
        return index - 1; // 0-based index
    }

    private List<Dictionary<string, string>> ParseCsvStream(Stream stream)
    {
        var result = new List<Dictionary<string, string>>();
        using var reader = new StreamReader(stream, Encoding.UTF8, true);

        string? headerLine = reader.ReadLine();
        if (string.IsNullOrWhiteSpace(headerLine)) return result;

        var headers = SplitCsvLine(headerLine).Select(NormalizeHeaderKey).ToList();

        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            var values = SplitCsvLine(line);
            var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            for (int i = 0; i < headers.Count; i++)
            {
                string val = i < values.Count ? values[i].Trim() : string.Empty;
                row[headers[i]] = val;
            }

            if (row.Values.Any(v => !string.IsNullOrWhiteSpace(v)))
            {
                result.Add(row);
            }
        }

        return result;
    }

    private static List<string> SplitCsvLine(string line)
    {
        var list = new List<string>();
        bool inQuotes = false;
        var current = new StringBuilder();

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];
            if (c == '\"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '\"')
                {
                    current.Append('\"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                list.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }
        list.Add(current.ToString());
        return list;
    }

    private static string NormalizeHeaderKey(string key)
    {
        return Regex.Replace(key.Trim(), @"[^a-zA-Z0-9]", "");
    }

    private static string GetVal(Dictionary<string, string> dict, params string[] possibleKeys)
    {
        foreach (var k in possibleKeys)
        {
            var normalized = NormalizeHeaderKey(k);
            foreach (var kvp in dict)
            {
                if (string.Equals(NormalizeHeaderKey(kvp.Key), normalized, StringComparison.OrdinalIgnoreCase))
                {
                    return kvp.Value?.Trim() ?? string.Empty;
                }
            }
        }
        return string.Empty;
    }

    private static string NormalizeScope(string? scope)
    {
        if (string.IsNullOrWhiteSpace(scope)) return "Both";
        var s = scope.Trim().ToLowerInvariant();
        if (s.Contains("coach")) return "Coaching";
        if (s.Contains("school")) return "School";
        return "Both";
    }

    private static string NormalizeCategory(string? cat)
    {
        if (string.IsNullOrWhiteSpace(cat)) return "Academic";
        var c = cat.Trim().ToLowerInvariant();
        if (c.Contains("infra")) return "Infrastructure";
        if (c.Contains("activ") || c.Contains("sport")) return "Activities";
        if (c.Contains("suppl") || c.Contains("book")) return "Supplies";
        if (c.Contains("resid") || c.Contains("hostel") || c.Contains("mess")) return "Residential";
        if (c.Contains("trans") || c.Contains("bus")) return "Transport";
        if (c.Contains("fine")) return "Fine";
        return "Academic";
    }

    private static string NormalizeFrequency(string? freq)
    {
        if (string.IsNullOrWhiteSpace(freq)) return "Monthly";
        var f = freq.Trim().ToLowerInvariant();
        if (f.Contains("quarter")) return "Quarterly";
        if (f.Contains("term") || f.Contains("exam")) return "TermWise";
        if (f.Contains("annu") || f.Contains("year")) return "Annual";
        if (f.Contains("one") || f.Contains("admis")) return "OneTime";
        return "Monthly";
    }

    #endregion
}

#region DTOs

public class ClassImportItemDto
{
    public int RowNumber { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public string? ClassCode { get; set; }
    public string AcademicScope { get; set; } = "Both";
    public int DisplayOrder { get; set; }
    public bool IsValid { get; set; }
    public string Status { get; set; } = "New";
    public string? ErrorMessage { get; set; }
    public List<string> AutoSections { get; set; } = new() { "A", "B" };
}

public class ClassImportPreviewResponseDto
{
    public int TotalRows { get; set; }
    public int ValidRows { get; set; }
    public int ErrorRows { get; set; }
    public List<ClassImportItemDto> Items { get; set; } = new();
}

public class ConfirmClassImportRequestDto
{
    public bool UpdateExisting { get; set; } = false;
    public List<ClassImportItemDto> Items { get; set; } = new();
}

public class FeeHeadImportItemDto
{
    public int RowNumber { get; set; }
    public string FeeHeadName { get; set; } = string.Empty;
    public string ShortCode { get; set; } = string.Empty;
    public string Category { get; set; } = "Academic";
    public string Frequency { get; set; } = "Monthly";
    public string ApplicableTo { get; set; } = "Both";
    public int SortOrder { get; set; }
    public string? Description { get; set; }
    public bool IsValid { get; set; }
    public string Status { get; set; } = "New";
    public string? ErrorMessage { get; set; }
}

public class FeeHeadImportPreviewResponseDto
{
    public int TotalRows { get; set; }
    public int ValidRows { get; set; }
    public int ErrorRows { get; set; }
    public List<FeeHeadImportItemDto> Items { get; set; } = new();
}

public class ConfirmFeeHeadImportRequestDto
{
    public bool UpdateExisting { get; set; } = false;
    public List<FeeHeadImportItemDto> Items { get; set; } = new();
}

#endregion

