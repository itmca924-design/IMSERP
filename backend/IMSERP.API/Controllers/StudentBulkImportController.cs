using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Xml.Linq;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

public record BulkColumnMappingDto(
    string ExcelHeader,
    string TargetType, // "Standard" | "CustomExisting" | "CreateCustom" | "Ignore"
    string TargetKey,
    string? CustomFieldLabel = null,
    string? CustomFieldDataType = "Text"
);

public record BulkImportExecuteRequestDto(
    Guid? BranchId,
    bool IsSchoolStudent,
    bool IsCoachingStudent,
    bool AutoCreateClassesAndSections,
    string DuplicateStrategy, // "Skip" | "UpdateMissing"
    bool DryRun,
    List<BulkColumnMappingDto> ColumnMappings,
    List<Dictionary<string, string>> Rows
);

public record BulkImportRowResultDto(
    int RowNumber,
    string StudentName,
    string ParentName,
    string ClassName,
    string SectionName,
    string Phone,
    string Status, // "New" | "Duplicate" | "Updated" | "Inserted" | "Skipped" | "Error"
    string? Reason,
    string? AdmissionNumber = null
);

[ApiController]
[Route("api/students/bulk-import")]
[Authorize]
public class StudentBulkImportController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;

    public StudentBulkImportController(IIMSERPDbContext dbContext, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    [HttpPost("parse")]
    [RequestSizeLimit(25 * 1024 * 1024)]
    public async Task<IActionResult> ParseExcelFile([FromForm] IFormFile file, [FromForm] string? sheetName = null)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Please upload a valid .xlsx or .csv file." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx" && ext != ".csv")
            return BadRequest(new { message = "Only .xlsx (Excel) and .csv files are supported. If you have an older .xls file, please Save As .xlsx in Excel." });

        List<string> sheetNames = new();
        string selectedSheet = "";
        List<string> headers = new();
        List<Dictionary<string, string>> rows = new();

        try
        {
            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            ms.Position = 0;

            if (ext == ".csv")
            {
                sheetNames.Add("CSV Sheet");
                selectedSheet = "CSV Sheet";
                (headers, rows) = ParseCsv(ms);
            }
            else
            {
                (sheetNames, selectedSheet, headers, rows) = ParseXlsx(ms, sheetName);
            }
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Failed to parse file: {ex.Message}" });
        }

        if (headers.Count == 0)
            return BadRequest(new { message = "No header columns found in the selected sheet." });

        var tenantId = _currentUser.TenantId;
        var existingCustomFields = await _dbContext.CustomFieldDefinitions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(f => f.TenantId == tenantId && f.EntityType == "Student" && f.IsActive)
            .OrderBy(f => f.SortOrder)
            .Select(f => new
            {
                f.Id,
                f.FieldKey,
                f.FieldLabel,
                f.DataType
            })
            .ToListAsync();

        var suggestedMappings = headers.Select(h => SuggestMapping(h, existingCustomFields.Select(x => (x.FieldKey, x.FieldLabel, x.DataType)).ToList())).ToList();

        return Ok(new
        {
            fileName = file.FileName,
            sheetNames,
            selectedSheet,
            headers,
            totalRows = rows.Count,
            rows,
            existingCustomFields,
            suggestedMappings
        });
    }

    [HttpPost("execute")]
    public async Task<IActionResult> ExecuteBulkImport([FromBody] BulkImportExecuteRequestDto dto)
    {
        if (dto == null || dto.Rows == null || dto.Rows.Count == 0)
            return BadRequest(new { message = "No rows provided for import." });

        var tenantId = _currentUser.TenantId;
        Guid? targetBranchId = dto.BranchId ?? _currentUser.BranchId;
        if (targetBranchId == null)
        {
            targetBranchId = await _dbContext.Branches
                .IgnoreQueryFilters()
                .Where(b => b.TenantId == tenantId && b.IsActive)
                .OrderByDescending(b => b.IsMainBranch)
                .Select(b => (Guid?)b.Id)
                .FirstOrDefaultAsync();
        }

        var strategy = string.Equals(dto.DuplicateStrategy, "UpdateMissing", StringComparison.OrdinalIgnoreCase)
            ? "UpdateMissing"
            : "Skip";

        // 1. Load existing students for duplicate detection
        var existingStudents = await _dbContext.Students
            .IgnoreQueryFilters()
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Where(s => s.TenantId == tenantId && !s.IsDeleted)
            .ToListAsync();

        var existingByAdmNo = new Dictionary<string, Student>(StringComparer.OrdinalIgnoreCase);
        var existingByNameFatherClass = new Dictionary<string, Student>(StringComparer.OrdinalIgnoreCase);
        var existingByNamePhone = new Dictionary<string, Student>(StringComparer.OrdinalIgnoreCase);

        foreach (var es in existingStudents)
        {
            if (!string.IsNullOrWhiteSpace(es.AdmissionNumber))
                existingByAdmNo.TryAdd(es.AdmissionNumber.Trim(), es);

            var nName = NormalizeName(es.StudentName);
            var nParent = NormalizeParentName(es.ParentName);
            var nClass = NormalizeName(es.Class?.Name);
            var nPhone = ExtractPrimaryPhone10(es.ParentWhatsAppPhone);

            if (!string.IsNullOrEmpty(nName) && !string.IsNullOrEmpty(nParent))
            {
                existingByNameFatherClass.TryAdd($"{nName}|{nParent}|{nClass}", es);
                existingByNameFatherClass.TryAdd($"{nName}|{nParent}|", es);
            }
            if (!string.IsNullOrEmpty(nName) && nPhone.Length == 10)
            {
                existingByNamePhone.TryAdd($"{nName}|{nPhone}", es);
            }
        }

        // 2. Load existing Classes & Sections
        var existingClasses = await _dbContext.SchoolClasses
            .IgnoreQueryFilters()
            .Include(c => c.Sections)
            .Where(c => c.TenantId == tenantId && c.IsActive)
            .ToListAsync();

        var classMap = new Dictionary<string, SchoolClass>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in existingClasses)
        {
            var nNameKey = NormalizeName(c.Name);
            if (!string.IsNullOrEmpty(nNameKey)) classMap.TryAdd(nNameKey, c);
            var nCodeKey = NormalizeName(c.Code);
            if (!string.IsNullOrEmpty(nCodeKey)) classMap.TryAdd(nCodeKey, c);
        }

        // 3. Load existing Custom Field Definitions
        var existingCustomDefs = await _dbContext.CustomFieldDefinitions
            .IgnoreQueryFilters()
            .Where(f => f.TenantId == tenantId && f.EntityType == "Student")
            .ToListAsync();
        var customDefByKey = existingCustomDefs
            .GroupBy(f => f.FieldKey, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        // Identify new custom fields to create
        var newCustomFieldsToCreate = new List<string>();
        var activeMappings = (dto.ColumnMappings ?? new List<BulkColumnMappingDto>())
            .Where(m => !string.Equals(m.TargetType, "Ignore", StringComparison.OrdinalIgnoreCase))
            .ToList();

        int maxCustomSort = existingCustomDefs.Any() ? existingCustomDefs.Max(f => f.SortOrder) : 0;

        foreach (var map in activeMappings.Where(m => string.Equals(m.TargetType, "CreateCustom", StringComparison.OrdinalIgnoreCase)))
        {
            var label = !string.IsNullOrWhiteSpace(map.CustomFieldLabel) ? map.CustomFieldLabel!.Trim() : map.ExcelHeader.Trim();
            var slug = CustomFieldsController.GenerateSlugKey(!string.IsNullOrWhiteSpace(map.TargetKey) ? map.TargetKey : label);
            if (string.IsNullOrEmpty(slug)) continue;

            if (!customDefByKey.TryGetValue(slug, out var existingDef))
            {
                newCustomFieldsToCreate.Add(label);
                if (!dto.DryRun)
                {
                    var newDef = new CustomFieldDefinition
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        BranchId = null,
                        EntityType = "Student",
                        FieldKey = slug,
                        FieldLabel = label,
                        DataType = string.IsNullOrWhiteSpace(map.CustomFieldDataType) ? "Text" : map.CustomFieldDataType!,
                        IsRequired = false,
                        ShowInTable = true,
                        SortOrder = ++maxCustomSort,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _dbContext.CustomFieldDefinitions.Add(newDef);
                    customDefByKey[slug] = newDef;
                }
            }
            else if (!existingDef.IsActive && !dto.DryRun)
            {
                existingDef.IsActive = true;
                existingDef.FieldLabel = label;
                existingDef.UpdatedAt = DateTime.UtcNow;
            }
        }

        // Prepare Year-Wise DB Max admission number tracker (Option 1: ADM-{Year}-{Max+1})
        var allTenantAdmNumbers = await _dbContext.Students
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.AdmissionNumber != null)
            .Select(s => s.AdmissionNumber!)
            .ToListAsync();

        var maxAdmSeqByYear = new Dictionary<int, int>();
        var admRegex = new Regex(@"^ADM-(\d{4})-(\d+)$", RegexOptions.IgnoreCase);
        foreach (var existingCode in allTenantAdmNumbers)
        {
            var m = admRegex.Match(existingCode.Trim());
            if (m.Success && int.TryParse(m.Groups[1].Value, out var yr) && int.TryParse(m.Groups[2].Value, out var seq))
            {
                if (!maxAdmSeqByYear.TryGetValue(yr, out var cur) || seq > cur)
                    maxAdmSeqByYear[yr] = seq;
            }
        }

        // Track Class-Wise DB MAX roll numbers (1, 2, 3... per Class across all sections)
        var rollCounterByClass = new Dictionary<Guid, int>();
        foreach (var es in existingStudents)
        {
            if (es.ClassId.HasValue)
            {
                var rNum = 0;
                int.TryParse(es.SchoolRollNumber ?? es.RollNumber, out rNum);
                if (!rollCounterByClass.TryGetValue(es.ClassId.Value, out var cur) || rNum > cur)
                    rollCounterByClass[es.ClassId.Value] = rNum;
            }
        }

        var newClassesToCreate = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var seenInUpload = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var rowResults = new List<BulkImportRowResultDto>();

        int newCount = 0;
        int duplicateCount = 0;
        int updatedCount = 0;
        int skippedCount = 0;
        int errorCount = 0;

        // Smart Sibling-Row Auto-Splitter: automatically splits combined rows like
        // Name="Ayansh / Aaradhya", Sec="A / B", DOB="16/05/21 / 23/03/19", AdmNo="00150 / 00152"
        // into clean individual student rows for both DryRun preview and actual import.
        var expandedRows = ExpandCombinedSiblingRows(dto.Rows, activeMappings);

        for (int i = 0; i < expandedRows.Count; i++)
        {
            var (excelRowNum, rawRow) = expandedRows[i];

            string GetStd(string key)
            {
                var m = activeMappings.FirstOrDefault(x => string.Equals(x.TargetType, "Standard", StringComparison.OrdinalIgnoreCase) && string.Equals(x.TargetKey, key, StringComparison.OrdinalIgnoreCase));
                if (m == null) return "";
                return rawRow.TryGetValue(m.ExcelHeader, out var val) ? (val ?? "").Trim() : "";
            }

            var studentName = GetStd("studentName");
            var parentName = GetStd("parentName");
            var motherName = GetStd("motherName");
            var className = GetStd("className");
            var sectionName = GetStd("sectionName");
            var rollNo = GetStd("rollNumber");
            var admNo = CleanAdmissionNumber(GetStd("admissionNumber"));
            var dobStr = GetStd("dateOfBirth");
            var dojStr = GetStd("joiningDate");
            var address = GetStd("address");
            var bloodGroup = GetStd("bloodGroup");
            var rawPhone = GetStd("parentWhatsAppPhone");
            var rawAltPhone = GetStd("emergencyContactPhone");
            var gender = GetStd("gender");
            var aadhaar = GetStd("aadhaarNumber");
            var category = GetStd("category");
            var religion = GetStd("religion");
            var prevSchool = GetStd("previousSchoolName");

            if (string.IsNullOrWhiteSpace(studentName))
            {
                errorCount++;
                rowResults.Add(new BulkImportRowResultDto(excelRowNum, "", parentName, className, sectionName, rawPhone, "Error", "Student Name is empty"));
                continue;
            }

            // Parse single or multiple phone numbers in Contact No cell (e.g. "8210104270, 8235569210")
            var extractedPhones = ExtractAllPhones10(rawPhone);
            var primaryPhone10 = extractedPhones.Count > 0 ? extractedPhones[0] : "";
            var altPhone10 = !string.IsNullOrWhiteSpace(rawAltPhone)
                ? ExtractPrimaryPhone10(rawAltPhone)
                : (extractedPhones.Count > 1 ? extractedPhones[1] : "");

            var formattedPrimaryPhone = primaryPhone10.Length == 10 ? $"+91{primaryPhone10}" : rawPhone;
            var formattedAltPhone = altPhone10.Length == 10 ? $"+91{altPhone10}" : (string.IsNullOrWhiteSpace(rawAltPhone) ? null : rawAltPhone);

            // Parse dates safely with valid ERP bounds (DOJ: 2010..NextYear, DOB: 1950..Today)
            DateTime? parsedDob = TryParseFlexibleDate(dobStr, 1950, DateTime.UtcNow.Year);
            DateTime? parsedDoj = TryParseFlexibleDate(dojStr, 2010, DateTime.UtcNow.Year + 1);

            // Collect custom fields for this row
            var rowCustomDict = new Dictionary<string, string>();
            foreach (var map in activeMappings.Where(m =>
                string.Equals(m.TargetType, "CustomExisting", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(m.TargetType, "CreateCustom", StringComparison.OrdinalIgnoreCase)))
            {
                var label = !string.IsNullOrWhiteSpace(map.CustomFieldLabel) ? map.CustomFieldLabel!.Trim() : map.ExcelHeader.Trim();
                var slug = CustomFieldsController.GenerateSlugKey(!string.IsNullOrWhiteSpace(map.TargetKey) ? map.TargetKey : label);
                if (string.IsNullOrEmpty(slug)) continue;
                if (rawRow.TryGetValue(map.ExcelHeader, out var cVal) && !string.IsNullOrWhiteSpace(cVal))
                {
                    rowCustomDict[slug] = cVal.Trim();
                }
            }

            // ── Multi-Layered Duplicate Detection ──
            var nName = NormalizeName(studentName);
            var nParent = NormalizeParentName(parentName);
            var nClass = NormalizeName(className);

            Student? matchedExisting = null;
            string? dupReason = null;

            if (!string.IsNullOrWhiteSpace(admNo) && existingByAdmNo.TryGetValue(admNo, out var byAdm))
            {
                matchedExisting = byAdm;
                dupReason = $"Matched existing Adm No '{byAdm.AdmissionNumber}' ({byAdm.StudentName})";
            }
            else if (!string.IsNullOrEmpty(nParent) && existingByNameFatherClass.TryGetValue($"{nName}|{nParent}|{nClass}", out var byNfc))
            {
                matchedExisting = byNfc;
                dupReason = $"Matched existing student '{byNfc.StudentName}' (Name + Father + Class)";
            }
            else if (!string.IsNullOrEmpty(nParent) && string.IsNullOrEmpty(nClass) && existingByNameFatherClass.TryGetValue($"{nName}|{nParent}|", out var byNf))
            {
                matchedExisting = byNf;
                dupReason = $"Matched existing student '{byNf.StudentName}' (Name + Father)";
            }
            else if (primaryPhone10.Length == 10 && existingByNamePhone.TryGetValue($"{nName}|{primaryPhone10}", out var byNp))
            {
                matchedExisting = byNp;
                dupReason = $"Matched existing student '{byNp.StudentName}' (Name + Mobile)";
            }

            // Also detect duplicates inside the uploaded Excel file itself
            var uploadKey = $"{nName}|{nParent}|{nClass}|{primaryPhone10}";
            if (matchedExisting == null && seenInUpload.Contains(uploadKey))
            {
                duplicateCount++;
                skippedCount++;
                rowResults.Add(new BulkImportRowResultDto(excelRowNum, studentName, parentName, className, sectionName, formattedPrimaryPhone, "Skipped", "Duplicate row inside uploaded Excel file"));
                continue;
            }
            seenInUpload.Add(uploadKey);

            if (matchedExisting != null)
            {
                duplicateCount++;
                if (strategy == "UpdateMissing")
                {
                    updatedCount++;
                    if (!dto.DryRun)
                    {
                        if (string.IsNullOrWhiteSpace(matchedExisting.MotherName) && !string.IsNullOrWhiteSpace(motherName)) matchedExisting.MotherName = motherName;
                        if (!matchedExisting.DateOfBirth.HasValue && parsedDob.HasValue) matchedExisting.DateOfBirth = parsedDob;
                        if (string.IsNullOrWhiteSpace(matchedExisting.BloodGroup) && !string.IsNullOrWhiteSpace(bloodGroup)) matchedExisting.BloodGroup = bloodGroup;
                        if (string.IsNullOrWhiteSpace(matchedExisting.Address) && !string.IsNullOrWhiteSpace(address)) matchedExisting.Address = address;
                        if (string.IsNullOrWhiteSpace(matchedExisting.ParentWhatsAppPhone) && !string.IsNullOrWhiteSpace(formattedPrimaryPhone)) matchedExisting.ParentWhatsAppPhone = formattedPrimaryPhone;
                        if (string.IsNullOrWhiteSpace(matchedExisting.EmergencyContactPhone) && !string.IsNullOrWhiteSpace(formattedAltPhone)) matchedExisting.EmergencyContactPhone = formattedAltPhone;
                        if (string.IsNullOrWhiteSpace(matchedExisting.AadhaarNumber) && !string.IsNullOrWhiteSpace(aadhaar)) matchedExisting.AadhaarNumber = aadhaar;

                        if (rowCustomDict.Count > 0)
                        {
                            var existingJsonDict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                            if (!string.IsNullOrWhiteSpace(matchedExisting.CustomFieldsJson))
                            {
                                try
                                {
                                    var parsed = JsonSerializer.Deserialize<Dictionary<string, string>>(matchedExisting.CustomFieldsJson);
                                    if (parsed != null)
                                    {
                                        foreach (var kv in parsed) existingJsonDict[kv.Key] = kv.Value;
                                    }
                                }
                                catch { }
                            }
                            foreach (var kv in rowCustomDict)
                            {
                                if (!existingJsonDict.ContainsKey(kv.Key) || string.IsNullOrWhiteSpace(existingJsonDict[kv.Key]))
                                    existingJsonDict[kv.Key] = kv.Value;
                            }
                            matchedExisting.CustomFieldsJson = JsonSerializer.Serialize(existingJsonDict);
                        }
                    }

                    rowResults.Add(new BulkImportRowResultDto(
                        excelRowNum, studentName, parentName, className, sectionName, formattedPrimaryPhone,
                        dto.DryRun ? "Duplicate" : "Updated",
                        $"{dupReason} — Missing fields will be updated"));
                }
                else
                {
                    skippedCount++;
                    rowResults.Add(new BulkImportRowResultDto(
                        excelRowNum, studentName, parentName, className, sectionName, formattedPrimaryPhone,
                        dto.DryRun ? "Duplicate" : "Skipped",
                        $"{dupReason} — Skipped"));
                }
                continue;
            }

            // Resolve or Auto-Create Class & Section
            Guid? resolvedClassId = null;
            Guid? resolvedSectionId = null;

            if (!string.IsNullOrWhiteSpace(className))
            {
                if (!classMap.TryGetValue(nClass, out var clsObj))
                {
                    if (dto.AutoCreateClassesAndSections)
                    {
                        newClassesToCreate.Add(className);
                        if (!dto.DryRun)
                        {
                            clsObj = new SchoolClass
                            {
                                Id = Guid.NewGuid(),
                                TenantId = tenantId,
                                BranchId = targetBranchId,
                                Name = className.Trim(),
                                IsActive = true
                            };
                            _dbContext.SchoolClasses.Add(clsObj);
                            classMap[nClass] = clsObj;
                        }
                    }
                }

                if (clsObj != null)
                {
                    resolvedClassId = clsObj.Id;
                    if (!string.IsNullOrWhiteSpace(sectionName))
                    {
                        var normSec = NormalizeName(sectionName);
                        var secObj = clsObj.Sections.FirstOrDefault(s => s.IsActive && NormalizeName(s.Name) == normSec);
                        if (secObj == null && dto.AutoCreateClassesAndSections)
                        {
                            newClassesToCreate.Add($"{className} - Sec {sectionName}");
                            if (!dto.DryRun)
                            {
                                secObj = new SchoolSection
                                {
                                    Id = Guid.NewGuid(),
                                    TenantId = tenantId,
                                    BranchId = targetBranchId,
                                    ClassId = clsObj.Id,
                                    Name = sectionName.Trim(),
                                    IsActive = true
                                };
                                _dbContext.SchoolSections.Add(secObj);
                                clsObj.Sections.Add(secObj);
                            }
                        }
                        resolvedSectionId = secObj?.Id;
                    }
                }
            }

            newCount++;
            int admYear = parsedDoj?.Year ?? DateTime.UtcNow.Year;
            string finalAdmNo;
            if (!string.IsNullOrWhiteSpace(admNo))
            {
                finalAdmNo = admNo;
            }
            else
            {
                int nextSeqForYear = (maxAdmSeqByYear.TryGetValue(admYear, out var curMax) ? curMax : 0) + 1;
                maxAdmSeqByYear[admYear] = nextSeqForYear;
                finalAdmNo = $"ADM-{admYear}-{nextSeqForYear:D4}";
            }

            if (!dto.DryRun)
            {
                string finalRollNo = rollNo;
                if (string.IsNullOrWhiteSpace(finalRollNo) && resolvedClassId.HasValue)
                {
                    var nextRoll = (rollCounterByClass.TryGetValue(resolvedClassId.Value, out var cur) ? cur : 0) + 1;
                    rollCounterByClass[resolvedClassId.Value] = nextRoll;
                    finalRollNo = nextRoll.ToString();
                }
                if (string.IsNullOrWhiteSpace(finalRollNo)) finalRollNo = finalAdmNo;

                var newStudent = new Student
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = targetBranchId,
                    ClassId = resolvedClassId,
                    SectionId = resolvedSectionId,
                    IsSchoolStudent = dto.IsSchoolStudent,
                    IsCoachingStudent = dto.IsCoachingStudent,
                    AdmissionNumber = finalAdmNo,
                    SchoolRollNumber = dto.IsSchoolStudent ? finalRollNo : null,
                    CoachingRollNumber = dto.IsCoachingStudent ? finalRollNo : null,
                    RollNumber = finalRollNo,
                    StudentName = studentName,
                    ParentName = string.IsNullOrWhiteSpace(parentName) ? "Guardian" : parentName,
                    MotherName = string.IsNullOrWhiteSpace(motherName) ? null : motherName,
                    ParentWhatsAppPhone = formattedPrimaryPhone,
                    EmergencyContactPhone = formattedAltPhone,
                    Gender = NormalizeGender(gender),
                    DateOfBirth = parsedDob,
                    JoiningDate = parsedDoj ?? DateTime.UtcNow,
                    BloodGroup = string.IsNullOrWhiteSpace(bloodGroup) ? null : bloodGroup,
                    Address = string.IsNullOrWhiteSpace(address) ? null : address,
                    AadhaarNumber = string.IsNullOrWhiteSpace(aadhaar) ? null : aadhaar,
                    Category = string.IsNullOrWhiteSpace(category) ? "General" : category,
                    Religion = string.IsNullOrWhiteSpace(religion) ? null : religion,
                    PreviousSchoolName = string.IsNullOrWhiteSpace(prevSchool) ? null : prevSchool,
                    CustomFieldsJson = rowCustomDict.Count > 0 ? JsonSerializer.Serialize(rowCustomDict) : null,
                    IsActive = true,
                    IsDeleted = false
                };

                _dbContext.Students.Add(newStudent);
            }

            rowResults.Add(new BulkImportRowResultDto(
                excelRowNum, studentName, parentName, className, sectionName, formattedPrimaryPhone,
                dto.DryRun ? "New" : "Inserted",
                null,
                finalAdmNo));
        }

        if (!dto.DryRun)
        {
            await _dbContext.SaveChangesAsync();
        }

        return Ok(new
        {
            dryRun = dto.DryRun,
            totalRows = expandedRows.Count,
            newCount,
            duplicateCount,
            updatedCount,
            skippedCount,
            errorCount,
            newClassesToCreate = newClassesToCreate.OrderBy(x => x).ToList(),
            newCustomFieldsToCreate = newCustomFieldsToCreate.Distinct().ToList(),
            rowResults
        });
    }

    // ─── Native Zero-Dependency XLSX Parser (System.IO.Compression + XDocument) ───
    private static (List<string> SheetNames, string SelectedSheet, List<string> Headers, List<Dictionary<string, string>> Rows) ParseXlsx(Stream stream, string? requestedSheet)
    {
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);

        // 1. Read shared strings
        var sharedStrings = new List<string>();
        var ssEntry = archive.GetEntry("xl/sharedStrings.xml");
        if (ssEntry != null)
        {
            using var s = ssEntry.Open();
            var doc = XDocument.Load(s);
            XNamespace ns = doc.Root?.Name.Namespace ?? XNamespace.None;
            foreach (var si in doc.Descendants(ns + "si"))
            {
                var text = string.Concat(si.Descendants(ns + "t").Select(t => t.Value));
                sharedStrings.Add(text);
            }
        }

        // 2. Read workbook sheets & relationships
        var sheetInfos = new List<(string Name, string TargetPath)>();
        var wbEntry = archive.GetEntry("xl/workbook.xml");
        var relsEntry = archive.GetEntry("xl/_rels/workbook.xml.rels");
        var relMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        if (relsEntry != null)
        {
            using var rs = relsEntry.Open();
            var rDoc = XDocument.Load(rs);
            foreach (var rel in rDoc.Descendants().Where(e => e.Name.LocalName == "Relationship"))
            {
                var id = rel.Attribute("Id")?.Value;
                var target = rel.Attribute("Target")?.Value;
                if (!string.IsNullOrEmpty(id) && !string.IsNullOrEmpty(target))
                {
                    var normTarget = target.StartsWith("/") ? target.TrimStart('/') : (target.StartsWith("xl/", StringComparison.OrdinalIgnoreCase) ? target : $"xl/{target.TrimStart('/')}");
                    relMap[id] = normTarget;
                }
            }
        }

        if (wbEntry != null)
        {
            using var ws = wbEntry.Open();
            var wDoc = XDocument.Load(ws);
            XNamespace rNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
            foreach (var sheet in wDoc.Descendants().Where(e => e.Name.LocalName == "sheet"))
            {
                var name = sheet.Attribute("name")?.Value ?? "Sheet1";
                var rId = sheet.Attribute(rNs + "id")?.Value;
                if (!string.IsNullOrEmpty(rId) && relMap.TryGetValue(rId, out var path))
                {
                    sheetInfos.Add((name, path));
                }
            }
        }

        if (sheetInfos.Count == 0)
        {
            var fallback = archive.Entries.FirstOrDefault(e => e.FullName.StartsWith("xl/worksheets/sheet", StringComparison.OrdinalIgnoreCase) && e.FullName.EndsWith(".xml", StringComparison.OrdinalIgnoreCase));
            if (fallback != null) sheetInfos.Add(("Sheet1", fallback.FullName));
        }

        if (sheetInfos.Count == 0)
            throw new InvalidOperationException("No worksheets found inside the Excel file.");

        var chosen = !string.IsNullOrWhiteSpace(requestedSheet)
            ? sheetInfos.FirstOrDefault(s => string.Equals(s.Name, requestedSheet.Trim(), StringComparison.OrdinalIgnoreCase))
            : sheetInfos[0];
        if (string.IsNullOrEmpty(chosen.TargetPath)) chosen = sheetInfos[0];

        var sheetEntry = archive.GetEntry(chosen.TargetPath)
            ?? archive.Entries.FirstOrDefault(e => string.Equals(e.FullName, chosen.TargetPath, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException($"Worksheet '{chosen.Name}' could not be opened.");

        // Read style number formats so we know which numeric cells are Excel Dates
        var dateStyleIndices = ReadDateStyleIndices(archive);

        using var sheetStream = sheetEntry.Open();
        var sheetDoc = XDocument.Load(sheetStream);
        XNamespace sNs = sheetDoc.Root?.Name.Namespace ?? XNamespace.None;

        var rawGrid = new List<Dictionary<int, string>>();
        foreach (var rowEl in sheetDoc.Descendants(sNs + "row"))
        {
            var rowCells = new Dictionary<int, string>();
            int colFallback = 0;
            foreach (var c in rowEl.Elements(sNs + "c"))
            {
                var cellRef = c.Attribute("r")?.Value;
                int colIdx = !string.IsNullOrEmpty(cellRef) ? ColumnRefToIndex(cellRef) : colFallback;
                colFallback = colIdx + 1;

                var type = c.Attribute("t")?.Value;
                var styleAttr = c.Attribute("s")?.Value;
                int.TryParse(styleAttr, out var styleIdx);

                string val = "";
                if (type == "s")
                {
                    var vText = c.Element(sNs + "v")?.Value;
                    if (int.TryParse(vText, out var ssIdx) && ssIdx >= 0 && ssIdx < sharedStrings.Count)
                        val = sharedStrings[ssIdx];
                }
                else if (type == "inlineStr")
                {
                    val = string.Concat(c.Descendants(sNs + "t").Select(t => t.Value));
                }
                else if (type == "str" || type == "b")
                {
                    val = c.Element(sNs + "v")?.Value ?? "";
                }
                else
                {
                    var vText = c.Element(sNs + "v")?.Value ?? "";
                    if (!string.IsNullOrEmpty(vText) && dateStyleIndices.Contains(styleIdx) && double.TryParse(vText, NumberStyles.Any, CultureInfo.InvariantCulture, out var serial) && serial >= 18264 && serial <= 55000)
                    {
                        var dt = DateTime.FromOADate(serial);
                        val = dt.ToString("dd/MM/yyyy");
                    }
                    else
                    {
                        val = vText;
                    }
                }

                rowCells[colIdx] = val.Trim();
            }

            if (rowCells.Values.Any(v => !string.IsNullOrWhiteSpace(v)))
                rawGrid.Add(rowCells);
        }

        if (rawGrid.Count == 0)
            return (sheetInfos.Select(s => s.Name).ToList(), chosen.Name, new List<string>(), new List<Dictionary<string, string>>());

        // First non-empty row with >= 2 filled columns is treated as header row
        int headerRowIndex = rawGrid.FindIndex(r => r.Values.Count(v => !string.IsNullOrWhiteSpace(v)) >= 2);
        if (headerRowIndex < 0) headerRowIndex = 0;

        var headerMap = new Dictionary<int, string>();
        var headers = new List<string>();
        var seenHeaders = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var kv in rawGrid[headerRowIndex].OrderBy(x => x.Key))
        {
            if (string.IsNullOrWhiteSpace(kv.Value)) continue;
            var hName = kv.Value.Trim();
            if (seenHeaders.Contains(hName))
            {
                int suffix = 2;
                while (seenHeaders.Contains($"{hName} ({suffix})")) suffix++;
                hName = $"{hName} ({suffix})";
            }
            seenHeaders.Add(hName);
            headerMap[kv.Key] = hName;
            headers.Add(hName);
        }

        var rows = new List<Dictionary<string, string>>();
        for (int r = headerRowIndex + 1; r < rawGrid.Count; r++)
        {
            var dict = new Dictionary<string, string>();
            bool anyNonEmpty = false;
            foreach (var hkv in headerMap)
            {
                var cellVal = rawGrid[r].TryGetValue(hkv.Key, out var v) ? v : "";
                dict[hkv.Value] = cellVal;
                if (!string.IsNullOrWhiteSpace(cellVal)) anyNonEmpty = true;
            }
            if (anyNonEmpty) rows.Add(dict);
        }

        return (sheetInfos.Select(s => s.Name).ToList(), chosen.Name, headers, rows);
    }

    private static HashSet<int> ReadDateStyleIndices(ZipArchive archive)
    {
        var dateStyles = new HashSet<int>();
        var stylesEntry = archive.GetEntry("xl/styles.xml");
        if (stylesEntry == null) return dateStyles;
        try
        {
            using var s = stylesEntry.Open();
            var doc = XDocument.Load(s);
            XNamespace ns = doc.Root?.Name.Namespace ?? XNamespace.None;

            var customDateNumFmts = new HashSet<int>();
            foreach (var nf in doc.Descendants(ns + "numFmt"))
            {
                if (int.TryParse(nf.Attribute("numFmtId")?.Value, out var id))
                {
                    var code = (nf.Attribute("formatCode")?.Value ?? "").ToLowerInvariant();
                    if ((code.Contains("yy") || code.Contains("dd") || code.Contains("mm")) && !code.Contains("hh:mm") && !code.Contains("#"))
                        customDateNumFmts.Add(id);
                }
            }

            var cellXfs = doc.Descendants(ns + "cellXfs").FirstOrDefault();
            if (cellXfs != null)
            {
                int idx = 0;
                foreach (var xf in cellXfs.Elements(ns + "xf"))
                {
                    if (int.TryParse(xf.Attribute("numFmtId")?.Value, out var fmtId))
                    {
                        if ((fmtId >= 14 && fmtId <= 22) || (fmtId >= 45 && fmtId <= 47) || customDateNumFmts.Contains(fmtId))
                            dateStyles.Add(idx);
                    }
                    idx++;
                }
            }
        }
        catch { }
        return dateStyles;
    }

    private static int ColumnRefToIndex(string cellRef)
    {
        int col = 0;
        foreach (var ch in cellRef)
        {
            if (ch >= 'A' && ch <= 'Z') col = col * 26 + (ch - 'A' + 1);
            else if (ch >= 'a' && ch <= 'z') col = col * 26 + (ch - 'a' + 1);
            else break;
        }
        return Math.Max(0, col - 1);
    }

    private static (List<string> Headers, List<Dictionary<string, string>> Rows) ParseCsv(Stream stream)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
        var lines = new List<List<string>>();
        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            lines.Add(SplitCsvLine(line));
        }

        if (lines.Count == 0) return (new List<string>(), new List<Dictionary<string, string>>());

        var headers = lines[0].Select(h => h.Trim()).Where(h => !string.IsNullOrEmpty(h)).ToList();
        var rows = new List<Dictionary<string, string>>();
        for (int i = 1; i < lines.Count; i++)
        {
            var dict = new Dictionary<string, string>();
            bool any = false;
            for (int c = 0; c < headers.Count; c++)
            {
                var v = c < lines[i].Count ? lines[i][c].Trim() : "";
                dict[headers[c]] = v;
                if (!string.IsNullOrEmpty(v)) any = true;
            }
            if (any) rows.Add(dict);
        }
        return (headers, rows);
    }

    private static List<string> SplitCsvLine(string line)
    {
        var result = new List<string>();
        var current = new StringBuilder();
        bool inQuotes = false;
        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];
            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"') { current.Append('"'); i++; }
                else inQuotes = !inQuotes;
            }
            else if (c == ',' && !inQuotes)
            {
                result.Add(current.ToString());
                current.Clear();
            }
            else current.Append(c);
        }
        result.Add(current.ToString());
        return result;
    }

    private static BulkColumnMappingDto SuggestMapping(string header, List<(string FieldKey, string FieldLabel, string DataType)> existingCustomFields)
    {
        var h = Regex.Replace(header.Trim().ToLowerInvariant(), @"[^a-z0-9]+", " ").Trim();

        // Standard column fuzzy matching
        if (h is "name" or "student name" or "student" or "full name" or "pupil name")
            return new BulkColumnMappingDto(header, "Standard", "studentName");
        if (h is "father s name" or "fathers name" or "father name" or "father" or "parent name" or "guardian name" or "guardian")
            return new BulkColumnMappingDto(header, "Standard", "parentName");
        if (h is "mother s name" or "mothers name" or "mother name" or "mother")
            return new BulkColumnMappingDto(header, "Standard", "motherName");
        if (h is "class" or "class name" or "std" or "standard" or "grade")
            return new BulkColumnMappingDto(header, "Standard", "className");
        if (h is "sec" or "section" or "section name")
            return new BulkColumnMappingDto(header, "Standard", "sectionName");
        if (h is "roll" or "roll no" or "roll number" or "rollno")
            return new BulkColumnMappingDto(header, "Standard", "rollNumber");
        if (h is "adm no" or "admission no" or "admission number" or "sr no" or "reg no" or "registration no")
            return new BulkColumnMappingDto(header, "Standard", "admissionNumber");
        if (h is "date of birth" or "dob" or "birth date" or "d o b")
            return new BulkColumnMappingDto(header, "Standard", "dateOfBirth");
        if (h is "date of admission" or "admission date" or "doa" or "joining date" or "doj" or "date of joining")
            return new BulkColumnMappingDto(header, "Standard", "joiningDate");
        if (h is "local address" or "address" or "residential address" or "present address" or "current address")
            return new BulkColumnMappingDto(header, "Standard", "address");
        if (h is "blood group" or "blood" or "blood grp")
            return new BulkColumnMappingDto(header, "Standard", "bloodGroup");
        if (h is "contact no" or "contact" or "contact number" or "mobile" or "mobile no" or "phone" or "phone no" or "whatsapp" or "father mobile" or "parent phone")
            return new BulkColumnMappingDto(header, "Standard", "parentWhatsAppPhone");
        if (h is "alternate phone" or "alt phone" or "alternate contact" or "emergency phone" or "emergency contact")
            return new BulkColumnMappingDto(header, "Standard", "emergencyContactPhone");
        if (h is "gender" or "sex")
            return new BulkColumnMappingDto(header, "Standard", "gender");
        if (h is "aadhaar" or "aadhar" or "aadhaar no" or "aadhar no" or "aadhaar number")
            return new BulkColumnMappingDto(header, "Standard", "aadhaarNumber");
        if (h is "category" or "caste")
            return new BulkColumnMappingDto(header, "Standard", "category");
        if (h is "religion")
            return new BulkColumnMappingDto(header, "Standard", "religion");
        if (h is "previous school" or "previous school name" or "last school")
            return new BulkColumnMappingDto(header, "Standard", "previousSchoolName");

        // Ignore S.No / Sr.No column by default
        if (h is "s no" or "sl no" or "serial no" or "sno" or "sr")
            return new BulkColumnMappingDto(header, "Ignore", "");

        // Check existing tenant custom fields
        var slug = CustomFieldsController.GenerateSlugKey(header);
        var existingCustom = existingCustomFields.FirstOrDefault(cf =>
            string.Equals(cf.FieldKey, slug, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(cf.FieldLabel.Trim(), header.Trim(), StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrEmpty(existingCustom.FieldKey))
        {
            return new BulkColumnMappingDto(header, "CustomExisting", existingCustom.FieldKey, existingCustom.FieldLabel, existingCustom.DataType);
        }

        // Unmatched column -> suggest auto-creating as Custom Field!
        var inferredType = h.Contains("address") ? "Textarea"
            : (h.Contains("date") ? "Date" : "Text");
        return new BulkColumnMappingDto(header, "CreateCustom", slug, header.Trim(), inferredType);
    }

    private static string NormalizeName(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return "";
        return Regex.Replace(s.Trim().ToLowerInvariant(), @"\s+", " ");
    }

    private static string NormalizeParentName(string? s)
    {
        var n = NormalizeName(s);
        n = Regex.Replace(n, @"^(mr\.?|mrs\.?|ms\.?|shri\.?|sri\.?|late\.?|md\.?)\s+", "", RegexOptions.IgnoreCase);
        return n.Trim();
    }

    private static List<string> ExtractAllPhones10(string? raw)
    {
        var res = new List<string>();
        if (string.IsNullOrWhiteSpace(raw)) return res;
        var parts = Regex.Split(raw, @"[,/;\|\n]+");
        foreach (var p in parts)
        {
            var digits = Regex.Replace(p, @"\D", "");
            if (digits.Length > 10) digits = digits.Substring(digits.Length - 10);
            if (digits.Length == 10 && !res.Contains(digits)) res.Add(digits);
        }
        return res;
    }

    private static string ExtractPrimaryPhone10(string? raw)
    {
        var list = ExtractAllPhones10(raw);
        return list.Count > 0 ? list[0] : "";
    }

    private static List<(int ExcelRowNum, Dictionary<string, string> Row)> ExpandCombinedSiblingRows(
        List<Dictionary<string, string>> rows,
        List<BulkColumnMappingDto> activeMappings)
    {
        string? FindHeader(string stdKey) =>
            activeMappings.FirstOrDefault(x =>
                string.Equals(x.TargetType, "Standard", StringComparison.OrdinalIgnoreCase) &&
                string.Equals(x.TargetKey, stdKey, StringComparison.OrdinalIgnoreCase))?.ExcelHeader;

        var nameHeader = FindHeader("studentName");
        var secHeader = FindHeader("sectionName");
        var classHeader = FindHeader("className");
        var dobHeader = FindHeader("dateOfBirth");
        var dojHeader = FindHeader("joiningDate");
        var admHeader = FindHeader("admissionNumber");
        var rollHeader = FindHeader("rollNumber");
        var genderHeader = FindHeader("gender");

        var dateSplitRegex = new Regex(@"(?<=\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})\s*/\s*(?=\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})", RegexOptions.Compiled);
        var expanded = new List<(int ExcelRowNum, Dictionary<string, string> Row)>(rows.Count);

        for (int i = 0; i < rows.Count; i++)
        {
            int excelRowNum = i + 2;
            var rawRow = rows[i];

            if (string.IsNullOrWhiteSpace(nameHeader) || !rawRow.TryGetValue(nameHeader, out var rawName) || string.IsNullOrWhiteSpace(rawName) || !rawName.Contains('/'))
            {
                expanded.Add((excelRowNum, rawRow));
                continue;
            }

            // Split combined sibling names like "Ayansh / Aaradhya" (ignore short abbreviations like S/O, C/O)
            var nameParts = rawName.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(p => p.Length >= 2 && Regex.IsMatch(p, @"[A-Za-z\u0900-\u097F]{2,}"))
                .ToList();

            if (nameParts.Count < 2)
            {
                expanded.Add((excelRowNum, rawRow));
                continue;
            }

            List<string> SplitSimple(string? header)
            {
                if (string.IsNullOrWhiteSpace(header) || !rawRow.TryGetValue(header, out var v) || string.IsNullOrWhiteSpace(v))
                    return new List<string>();
                return v.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            }

            List<string> SplitDates(string? header)
            {
                if (string.IsNullOrWhiteSpace(header) || !rawRow.TryGetValue(header, out var v) || string.IsNullOrWhiteSpace(v))
                    return new List<string>();
                return dateSplitRegex.Split(v.Trim())
                    .Select(p => p.Trim())
                    .Where(p => !string.IsNullOrWhiteSpace(p))
                    .ToList();
            }

            var secParts = SplitSimple(secHeader);
            var classParts = SplitSimple(classHeader);
            var admParts = SplitSimple(admHeader);
            var rollParts = SplitSimple(rollHeader);
            var genderParts = SplitSimple(genderHeader);
            var dobParts = SplitDates(dobHeader);
            var dojParts = SplitDates(dojHeader);

            for (int k = 0; k < nameParts.Count; k++)
            {
                var cloned = new Dictionary<string, string>(rawRow, StringComparer.OrdinalIgnoreCase);
                cloned[nameHeader] = nameParts[k];

                if (!string.IsNullOrWhiteSpace(secHeader) && secParts.Count > 0)
                    cloned[secHeader] = k < secParts.Count ? secParts[k] : secParts[0];

                if (!string.IsNullOrWhiteSpace(classHeader) && classParts.Count > 0)
                    cloned[classHeader] = k < classParts.Count ? classParts[k] : classParts[0];

                if (!string.IsNullOrWhiteSpace(admHeader) && admParts.Count > 0)
                    cloned[admHeader] = k < admParts.Count ? admParts[k] : "";

                if (!string.IsNullOrWhiteSpace(rollHeader) && rollParts.Count > 0)
                    cloned[rollHeader] = k < rollParts.Count ? rollParts[k] : "";

                if (!string.IsNullOrWhiteSpace(genderHeader) && genderParts.Count > 0)
                    cloned[genderHeader] = k < genderParts.Count ? genderParts[k] : genderParts[0];

                if (!string.IsNullOrWhiteSpace(dobHeader) && dobParts.Count > 0)
                    cloned[dobHeader] = k < dobParts.Count ? dobParts[k] : "";

                if (!string.IsNullOrWhiteSpace(dojHeader) && dojParts.Count > 0)
                    cloned[dojHeader] = k < dojParts.Count ? dojParts[k] : dojParts[0];

                expanded.Add((excelRowNum, cloned));
            }
        }

        return expanded;
    }

    private static string CleanAdmissionNumber(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "";

        var parts = raw.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var part in parts)
        {
            var cleaned = part.Trim();
            if (string.IsNullOrWhiteSpace(cleaned)) continue;

            // Ignore dummy placeholders like "0", "00", "000", "-", "NA", "N/A", "Nil", "None"
            if (Regex.IsMatch(cleaned, @"^0+$") ||
                Regex.IsMatch(cleaned, @"^[-–—_\.]+$") ||
                cleaned.Equals("na", StringComparison.OrdinalIgnoreCase) ||
                cleaned.Equals("n/a", StringComparison.OrdinalIgnoreCase) ||
                cleaned.Equals("nil", StringComparison.OrdinalIgnoreCase) ||
                cleaned.Equals("none", StringComparison.OrdinalIgnoreCase) ||
                cleaned.Equals("null", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            return cleaned;
        }

        return "";
    }

    private static DateTime? TryParseFlexibleDate(string? raw, int minYear = 1950, int maxYear = 2050)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var s = raw.Trim();

        // Handle plain 4-digit year entered in Excel (e.g. "2023", "2024", "2025") -> treat as 01-Apr-YYYY (academic session start)
        if (Regex.IsMatch(s, @"^\d{4}$") && int.TryParse(s, out var plainYear) && plainYear >= minYear && plainYear <= maxYear)
        {
            return new DateTime(plainYear, 4, 1);
        }

        // Excel serial date fallback: real dates 1950..2050 are between 18264 and 55000 (never treat 4-digit years like 2023 as 1905!)
        if (double.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var serial) && serial >= 18264 && serial <= 55000)
        {
            try
            {
                var dtSerial = DateTime.FromOADate(serial);
                if (dtSerial.Year >= minYear && dtSerial.Year <= maxYear) return dtSerial;
            }
            catch { }
        }

        string[] formats =
        {
            "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy",
            "dd/MM/yy", "d/M/yy", "dd-MM-yy", "d-M-yy",
            "yyyy-MM-dd", "yyyy/MM/dd", "dd.MM.yyyy", "d.M.yyyy",
            "dd MMM yyyy", "d MMM yyyy"
        };

        if (DateTime.TryParseExact(s, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt) && dt.Year >= minYear && dt.Year <= maxYear)
            return dt;

        if (DateTime.TryParse(s, CultureInfo.GetCultureInfo("en-IN"), DateTimeStyles.None, out var dtIn) && dtIn.Year >= minYear && dtIn.Year <= maxYear)
            return dtIn;

        return null;
    }

    private static string NormalizeGender(string? raw)
    {
        var g = (raw ?? "").Trim().ToLowerInvariant();
        if (g.StartsWith("f")) return "Female";
        if (g.StartsWith("o")) return "Other";
        return "Male";
    }

    // ─── Native Zero-Dependency .xlsx Excel Export (Standard + Dynamic Custom Fields) ───
    [HttpGet("export-excel")]
    public async Task<IActionResult> ExportStudentsExcel(
        [FromQuery] string? search = null,
        [FromQuery] string? stream = null,
        [FromQuery] Guid? classId = null,
        [FromQuery] Guid? sectionId = null,
        [FromQuery] Guid? batchId = null,
        [FromQuery] string? status = null)
    {
        var tenantId = _currentUser.TenantId;
        var branchId = _currentUser.BranchId;

        var query = _dbContext.Students
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(s => s.Class)
            .Include(s => s.Section)
            .Include(s => s.Batch)
            .Include(s => s.TransportAllocation)
                .ThenInclude(t => t!.Route)
            .Include(s => s.TransportAllocation)
                .ThenInclude(t => t!.Stop)
            .Where(s => s.TenantId == tenantId && !s.IsDeleted);

        if (branchId.HasValue)
            query = query.Where(s => s.BranchId == null || s.BranchId == branchId.Value);

        if (classId.HasValue)
            query = query.Where(s => s.ClassId == classId.Value);

        if (sectionId.HasValue)
            query = query.Where(s => s.SectionId == sectionId.Value);

        if (batchId.HasValue)
            query = query.Where(s => s.BatchId == batchId.Value);

        if (!string.IsNullOrWhiteSpace(stream) && !string.Equals(stream, "all", StringComparison.OrdinalIgnoreCase))
        {
            var st = stream.Trim().ToLowerInvariant();
            if (st == "school") query = query.Where(s => s.IsSchoolStudent);
            else if (st == "coaching") query = query.Where(s => s.IsCoachingStudent);
            else if (st == "dual") query = query.Where(s => s.IsSchoolStudent && s.IsCoachingStudent);
            else if (st == "hostel") query = query.Where(s => s.IsHostelStudent);
            else if (st == "library") query = query.Where(s => s.IsLibraryMember);
            else if (st == "transport") query = query.Where(s => s.IsTransportStudent);
        }

        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var st = status.Trim().ToLowerInvariant();
            if (st == "active") query = query.Where(s => s.IsActive);
            else if (st == "inactive" || st == "left") query = query.Where(s => !s.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLowerInvariant();
            query = query.Where(s =>
                (s.StudentName != null && s.StudentName.ToLower().Contains(q)) ||
                (s.ParentName != null && s.ParentName.ToLower().Contains(q)) ||
                (s.MotherName != null && s.MotherName.ToLower().Contains(q)) ||
                (s.AdmissionNumber != null && s.AdmissionNumber.ToLower().Contains(q)) ||
                (s.RollNumber != null && s.RollNumber.ToLower().Contains(q)) ||
                (s.SchoolRollNumber != null && s.SchoolRollNumber.ToLower().Contains(q)) ||
                (s.ParentWhatsAppPhone != null && s.ParentWhatsAppPhone.ToLower().Contains(q)) ||
                (s.Class != null && s.Class.Name.ToLower().Contains(q)));
        }

        var students = await query
            .OrderBy(s => s.Class != null ? s.Class.Name : "ZZZ")
            .ThenBy(s => s.Section != null ? s.Section.Name : "ZZZ")
            .ThenBy(s => s.StudentName)
            .ToListAsync();

        var customDefs = await _dbContext.CustomFieldDefinitions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(f => f.TenantId == tenantId && f.EntityType == "Student" && f.IsActive)
            .OrderBy(f => f.SortOrder)
            .ThenBy(f => f.CreatedAt)
            .ToListAsync();

        var headers = new List<string>
        {
            "S.No",
            "Admission No",
            "School Roll No",
            "Student Name",
            "Gender",
            "Date of Birth",
            "Date of Admission",
            "Class",
            "Section",
            "Stream",
            "Batch",
            "Father's / Guardian Name",
            "Mother's Name",
            "WhatsApp / Primary Phone",
            "Alternate / Emergency Phone",
            "Local / Residential Address",
            "Blood Group",
            "Category",
            "Religion",
            "Aadhaar Number",
            "PEN Number",
            "APAAR ID",
            "Transport",
            "Hostel",
            "Status"
        };

        foreach (var cf in customDefs)
            headers.Add(cf.FieldLabel);

        var dataRows = new List<List<string>>();
        int sno = 1;
        foreach (var s in students)
        {
            var streamLabel = s.IsSchoolStudent && s.IsCoachingStudent ? "School + Coaching"
                : (s.IsSchoolStudent ? "School Only" : "Coaching Only");

            var transportLabel = s.IsTransportStudent
                ? (s.TransportAllocation?.Route != null
                    ? $"Yes ({s.TransportAllocation.Route.RouteName}{(s.TransportAllocation.Stop != null ? " - " + s.TransportAllocation.Stop.StopName : "")})"
                    : "Yes")
                : "No";

            var customMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (!string.IsNullOrWhiteSpace(s.CustomFieldsJson))
            {
                try
                {
                    using var jdoc = JsonDocument.Parse(s.CustomFieldsJson);
                    foreach (var prop in jdoc.RootElement.EnumerateObject())
                    {
                        customMap[prop.Name] = prop.Value.ValueKind == JsonValueKind.True ? "Yes"
                            : prop.Value.ValueKind == JsonValueKind.False ? "No"
                            : prop.Value.ToString();
                    }
                }
                catch { }
            }

            var row = new List<string>
            {
                (sno++).ToString(),
                s.AdmissionNumber ?? "",
                s.SchoolRollNumber ?? s.RollNumber ?? "",
                s.StudentName ?? "",
                s.Gender ?? "",
                s.DateOfBirth.HasValue ? s.DateOfBirth.Value.ToString("dd-MM-yyyy") : "",
                s.JoiningDate.ToString("dd-MM-yyyy"),
                s.Class?.Name ?? "",
                s.Section?.Name ?? "",
                streamLabel,
                s.Batch?.Name ?? "",
                s.ParentName ?? "",
                s.MotherName ?? "",
                s.ParentWhatsAppPhone ?? "",
                s.EmergencyContactPhone ?? "",
                s.Address ?? "",
                s.BloodGroup ?? "",
                s.Category ?? "",
                s.Religion ?? "",
                s.AadhaarNumber ?? "",
                s.PenNumber ?? "",
                s.ApaarId ?? "",
                transportLabel,
                s.IsHostelStudent ? "Yes" : "No",
                s.IsActive ? "Active" : (string.IsNullOrWhiteSpace(s.TCNumber) ? "Inactive / Left" : $"Left ({s.TCNumber})")
            };

            foreach (var cf in customDefs)
            {
                customMap.TryGetValue(cf.FieldKey, out var cfVal);
                row.Add(cfVal ?? "");
            }

            dataRows.Add(row);
        }

        var xlsxBytes = BuildSimpleXlsxBytes("Students Directory", headers, dataRows);
        var istNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(OperatingSystem.IsWindows() ? "India Standard Time" : "Asia/Kolkata"));
        var fileName = $"Students_Directory_{istNow:yyyy-MM-dd}.xlsx";

        return File(xlsxBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }

    private static byte[] BuildSimpleXlsxBytes(string sheetName, List<string> headers, List<List<string>> rows)
    {
        using var ms = new MemoryStream();
        using (var archive = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            WriteZipEntry(archive, "[Content_Types].xml",
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
                "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
                "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
                "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>" +
                "<Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>" +
                "<Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>" +
                "</Types>");

            WriteZipEntry(archive, "_rels/.rels",
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
                "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>" +
                "</Relationships>");

            WriteZipEntry(archive, "xl/workbook.xml",
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">" +
                $"<sheets><sheet name=\"{XmlEscape(sheetName)}\" sheetId=\"1\" r:id=\"rId1\"/></sheets>" +
                "</workbook>");

            WriteZipEntry(archive, "xl/_rels/workbook.xml.rels",
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
                "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>" +
                "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>" +
                "</Relationships>");

            // Style 0 = normal cell, Style 1 = bold white header on #1E3A8A blue background
            WriteZipEntry(archive, "xl/styles.xml",
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" +
                "<fonts count=\"2\">" +
                "<font><sz val=\"10\"/><name val=\"Calibri\"/></font>" +
                "<font><b/><sz val=\"10\"/><color rgb=\"FFFFFFFF\"/><name val=\"Calibri\"/></font>" +
                "</fonts>" +
                "<fills count=\"3\">" +
                "<fill><patternFill patternType=\"none\"/></fill>" +
                "<fill><patternFill patternType=\"gray125\"/></fill>" +
                "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF1E3A8A\"/><bgColor indexed=\"64\"/></patternFill></fill>" +
                "</fills>" +
                "<borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders>" +
                "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>" +
                "<cellXfs count=\"2\">" +
                "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>" +
                "<xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"0\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\"/>" +
                "</cellXfs>" +
                "</styleSheet>");

            // Compute auto column widths
            var colWidths = new int[headers.Count];
            for (int c = 0; c < headers.Count; c++)
                colWidths[c] = Math.Max(12, Math.Min(42, headers[c].Length + 4));
            foreach (var r in rows.Take(200))
            {
                for (int c = 0; c < Math.Min(r.Count, headers.Count); c++)
                {
                    int len = (r[c]?.Length ?? 0) + 3;
                    if (len > colWidths[c]) colWidths[c] = Math.Min(45, len);
                }
            }

            var sb = new StringBuilder();
            sb.Append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
            sb.Append("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">");
            sb.Append("<cols>");
            for (int c = 0; c < colWidths.Length; c++)
                sb.Append($"<col min=\"{c + 1}\" max=\"{c + 1}\" width=\"{colWidths[c]}\" customWidth=\"1\"/>");
            sb.Append("</cols><sheetData>");

            // Header row
            sb.Append("<row r=\"1\" ht=\"22\" customHeight=\"1\">");
            for (int c = 0; c < headers.Count; c++)
            {
                var cellRef = $"{IndexToColLetters(c)}1";
                sb.Append($"<c r=\"{cellRef}\" t=\"inlineStr\" s=\"1\"><is><t>{XmlEscape(headers[c])}</t></is></c>");
            }
            sb.Append("</row>");

            // Data rows
            for (int rIdx = 0; rIdx < rows.Count; rIdx++)
            {
                int excelRow = rIdx + 2;
                sb.Append($"<row r=\"{excelRow}\">");
                var row = rows[rIdx];
                for (int c = 0; c < headers.Count; c++)
                {
                    var val = c < row.Count ? (row[c] ?? "") : "";
                    var cellRef = $"{IndexToColLetters(c)}{excelRow}";
                    sb.Append($"<c r=\"{cellRef}\" t=\"inlineStr\"><is><t>{XmlEscape(val)}</t></is></c>");
                }
                sb.Append("</row>");
            }

            sb.Append("</sheetData></worksheet>");
            WriteZipEntry(archive, "xl/worksheets/sheet1.xml", sb.ToString());
        }

        return ms.ToArray();
    }

    private static void WriteZipEntry(ZipArchive archive, string path, string content)
    {
        var entry = archive.CreateEntry(path, CompressionLevel.Fastest);
        using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
        writer.Write(content);
    }

    private static string IndexToColLetters(int index)
    {
        var result = "";
        int n = index + 1;
        while (n > 0)
        {
            int rem = (n - 1) % 26;
            result = (char)('A' + rem) + result;
            n = (n - 1) / 26;
        }
        return result;
    }

    private static string XmlEscape(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        // Strip invalid XML 1.0 control chars
        var sb = new StringBuilder(value.Length);
        foreach (var ch in value)
        {
            if (ch == '\t' || ch == '\n' || ch == '\r' || (ch >= 0x20 && ch <= 0xD7FF) || (ch >= 0xE000 && ch <= 0xFFFD))
            {
                switch (ch)
                {
                    case '&': sb.Append("&amp;"); break;
                    case '<': sb.Append("&lt;"); break;
                    case '>': sb.Append("&gt;"); break;
                    case '"': sb.Append("&quot;"); break;
                    case '\'': sb.Append("&apos;"); break;
                    default: sb.Append(ch); break;
                }
            }
        }
        return sb.ToString();
    }
}
