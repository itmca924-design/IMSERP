using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/infirmary")]
[Authorize]
public class InfirmaryController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public InfirmaryController(IIMSERPDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet("visits")]
    public async Task<ActionResult<IEnumerable<InfirmaryVisitDto>>> GetVisits(
        [FromQuery] Guid? branchId,
        [FromQuery] string? patientType,
        [FromQuery] string? severity,
        [FromQuery] string? status,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? searchTerm)
    {
        var tenantId = _currentUser.TenantId;
        var query = _db.InfirmaryVisits
            .AsNoTracking()
            .Include(v => v.Branch)
            .Where(v => v.TenantId == tenantId);

        var activeBranch = branchId ?? _currentUser.BranchId;
        if (activeBranch.HasValue)
        {
            query = query.Where(v => v.BranchId == activeBranch.Value);
        }

        if (!string.IsNullOrWhiteSpace(patientType) && patientType != "All")
        {
            query = query.Where(v => v.PatientType == patientType);
        }

        if (!string.IsNullOrWhiteSpace(severity) && severity != "All")
        {
            query = query.Where(v => v.Severity == severity);
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
        {
            query = query.Where(v => v.Status == status);
        }

        if (startDate.HasValue)
        {
            query = query.Where(v => v.VisitDate >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            var endOfDay = endDate.Value.Date.AddDays(1).AddTicks(-1);
            query = query.Where(v => v.VisitDate <= endOfDay);
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var s = searchTerm.Trim().ToLower();
            query = query.Where(v =>
                v.PatientName.ToLower().Contains(s) ||
                v.VisitNumber.ToLower().Contains(s) ||
                (v.ChiefComplaints != null && v.ChiefComplaints.ToLower().Contains(s)) ||
                (v.ClassOrDesignation != null && v.ClassOrDesignation.ToLower().Contains(s)) ||
                (v.ContactPhone != null && v.ContactPhone.Contains(s)));
        }

        var list = await query
            .OrderByDescending(v => v.VisitDate)
            .ToListAsync();

        var result = list.Select(v => new InfirmaryVisitDto(
            v.Id,
            v.TenantId,
            v.BranchId,
            v.Branch?.Name,
            v.VisitNumber,
            v.PatientType,
            v.StudentId,
            v.StaffId,
            v.PatientName,
            v.ClassOrDesignation,
            v.ContactPhone,
            v.VisitDate,
            v.ChiefComplaints,
            v.SymptomsList,
            v.TemperatureF,
            v.PulseBpm,
            v.BloodPressure,
            v.SpO2,
            v.Severity,
            v.BedRestRequired,
            v.BedNumber,
            v.AdmittedAt,
            v.DischargedAt,
            v.BedStatus,
            v.Diagnosis,
            v.TreatmentGiven,
            DeserializeMedicines(v.MedicinesDispensedJson),
            v.ParentContacted,
            v.ParentContactedAt,
            v.ParentNotificationNotes,
            v.ReferredToHospital,
            v.HospitalName,
            v.SentHome,
            v.AccompaniedBy,
            v.AttendingStaffName,
            v.Status,
            v.Remarks,
            v.CreatedAt
        )).ToList();

        return Ok(result);
    }

    [HttpGet("visits/{id}")]
    public async Task<ActionResult<InfirmaryVisitDto>> GetVisitById(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var v = await _db.InfirmaryVisits
            .AsNoTracking()
            .Include(x => x.Branch)
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);

        if (v == null) return NotFound(new { message = "Infirmary visit record not found." });

        return Ok(new InfirmaryVisitDto(
            v.Id,
            v.TenantId,
            v.BranchId,
            v.Branch?.Name,
            v.VisitNumber,
            v.PatientType,
            v.StudentId,
            v.StaffId,
            v.PatientName,
            v.ClassOrDesignation,
            v.ContactPhone,
            v.VisitDate,
            v.ChiefComplaints,
            v.SymptomsList,
            v.TemperatureF,
            v.PulseBpm,
            v.BloodPressure,
            v.SpO2,
            v.Severity,
            v.BedRestRequired,
            v.BedNumber,
            v.AdmittedAt,
            v.DischargedAt,
            v.BedStatus,
            v.Diagnosis,
            v.TreatmentGiven,
            DeserializeMedicines(v.MedicinesDispensedJson),
            v.ParentContacted,
            v.ParentContactedAt,
            v.ParentNotificationNotes,
            v.ReferredToHospital,
            v.HospitalName,
            v.SentHome,
            v.AccompaniedBy,
            v.AttendingStaffName,
            v.Status,
            v.Remarks,
            v.CreatedAt
        ));
    }

    [HttpGet("stats")]
    public async Task<ActionResult<InfirmaryStatsDto>> GetStats([FromQuery] Guid? branchId)
    {
        var tenantId = _currentUser.TenantId;
        var query = _db.InfirmaryVisits.AsNoTracking().Where(v => v.TenantId == tenantId);

        var activeBranch = branchId ?? _currentUser.BranchId;
        if (activeBranch.HasValue)
        {
            query = query.Where(v => v.BranchId == activeBranch.Value);
        }

        var now = DateTime.UtcNow;
        var today = now.Date;
        var firstDayOfMonth = new DateTime(now.Year, now.Month, 1);

        var todayVisits = await query.CountAsync(v => v.VisitDate >= today && v.VisitDate < today.AddDays(1));
        var occupiedBeds = await query.CountAsync(v => v.BedRestRequired && v.BedStatus == "Occupied");
        var severeReferred = await query.CountAsync(v => (v.Severity == "Severe" || v.ReferredToHospital) && v.VisitDate >= firstDayOfMonth);
        var studentVisits = await query.CountAsync(v => v.PatientType == "Student" && v.VisitDate >= firstDayOfMonth);
        var staffVisits = await query.CountAsync(v => v.PatientType == "Staff" && v.VisitDate >= firstDayOfMonth);

        // Compute total medicine units dispensed this month
        var visitsWithMeds = await query
            .Where(v => v.VisitDate >= firstDayOfMonth && !string.IsNullOrEmpty(v.MedicinesDispensedJson))
            .Select(v => v.MedicinesDispensedJson)
            .ToListAsync();

        decimal totalUnits = 0;
        foreach (var json in visitsWithMeds)
        {
            var meds = DeserializeMedicines(json);
            if (meds != null)
            {
                totalUnits += meds.Sum(m => m.Quantity);
            }
        }

        return Ok(new InfirmaryStatsDto(
            todayVisits,
            occupiedBeds,
            severeReferred,
            totalUnits,
            studentVisits,
            staffVisits
        ));
    }

    [HttpPost("visits")]
    public async Task<ActionResult<InfirmaryVisitDto>> CreateVisit([FromBody] CreateInfirmaryVisitDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var branchId = dto.BranchId ?? _currentUser.BranchId;

        if (string.IsNullOrWhiteSpace(dto.PatientName))
            return BadRequest(new { message = "Patient name is required." });

        if (string.IsNullOrWhiteSpace(dto.ChiefComplaints))
            return BadRequest(new { message = "Chief complaint / symptoms are required." });

        var now = DateTime.UtcNow;
        var year = now.Year;
        var visitCount = await _db.InfirmaryVisits
            .CountAsync(v => v.TenantId == tenantId && v.VisitDate.Year == year);

        var visitNumber = $"INF-{year}-{(visitCount + 1):D4}";

        string? medsJson = null;
        if (dto.MedicinesDispensed != null && dto.MedicinesDispensed.Count > 0)
        {
            medsJson = JsonSerializer.Serialize(dto.MedicinesDispensed);
        }

        var bedStatus = dto.BedRestRequired ? "Occupied" : "NotAssigned";
        var admittedAt = dto.BedRestRequired ? (dto.AdmittedAt ?? now) : (DateTime?)null;

        var visit = new InfirmaryVisit
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            VisitNumber = visitNumber,
            PatientType = !string.IsNullOrWhiteSpace(dto.PatientType) ? dto.PatientType : "Student",
            StudentId = dto.StudentId,
            StaffId = dto.StaffId,
            PatientName = dto.PatientName.Trim(),
            ClassOrDesignation = dto.ClassOrDesignation?.Trim(),
            ContactPhone = dto.ContactPhone?.Trim(),
            VisitDate = dto.VisitDate ?? now,
            ChiefComplaints = dto.ChiefComplaints.Trim(),
            SymptomsList = dto.SymptomsList?.Trim(),
            TemperatureF = dto.TemperatureF,
            PulseBpm = dto.PulseBpm,
            BloodPressure = dto.BloodPressure?.Trim(),
            SpO2 = dto.SpO2,
            Severity = !string.IsNullOrWhiteSpace(dto.Severity) ? dto.Severity : "Mild",
            BedRestRequired = dto.BedRestRequired,
            BedNumber = dto.BedNumber?.Trim(),
            AdmittedAt = admittedAt,
            BedStatus = bedStatus,
            Diagnosis = dto.Diagnosis?.Trim(),
            TreatmentGiven = dto.TreatmentGiven?.Trim(),
            MedicinesDispensedJson = medsJson,
            ParentContacted = dto.ParentContacted,
            ParentContactedAt = dto.ParentContacted ? (dto.ParentContactedAt ?? now) : null,
            ParentNotificationNotes = dto.ParentNotificationNotes?.Trim(),
            ReferredToHospital = dto.ReferredToHospital,
            HospitalName = dto.HospitalName?.Trim(),
            SentHome = dto.SentHome,
            AccompaniedBy = dto.AccompaniedBy?.Trim(),
            AttendingStaffName = dto.AttendingStaffName?.Trim(),
            Status = !string.IsNullOrWhiteSpace(dto.Status) ? dto.Status : (dto.BedRestRequired ? "UnderObservation" : "Recovered"),
            Remarks = dto.Remarks?.Trim(),
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.InfirmaryVisits.Add(visit);

        // ─── Inventory Module Deep Integration: Auto Deduct Stock & Record Outward ───────────
        if (dto.MedicinesDispensed != null && dto.MedicinesDispensed.Count > 0)
        {
            var outwardCount = await _db.InventoryOutwards
                .CountAsync(o => o.TenantId == tenantId && o.IssueDate.Year == year);
            var issueNum = $"OUT-MED-{year}-{(outwardCount + 1):D4}";

            var outward = new InventoryOutward
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BranchId = branchId,
                IssueNumber = issueNum,
                IssueDate = now,
                IssueType = "StaffDepartmentIssue",
                StudentId = visit.StudentId,
                IssuedToName = $"Infirmary: {visit.PatientName} ({visit.PatientType})",
                DepartmentOrClass = "Infirmary / Sick Bay",
                PaymentStatus = "Free/Complimentary",
                Remarks = $"First-Aid medicine dispensation for Infirmary Visit {visitNumber}: {visit.ChiefComplaints}",
                CreatedAt = now
            };

            decimal totalOutwardAmount = 0;
            foreach (var med in dto.MedicinesDispensed)
            {
                var item = await _db.InventoryItems.FirstOrDefaultAsync(i => i.Id == med.ItemId && i.TenantId == tenantId);
                if (item != null)
                {
                    item.CurrentStock = Math.Max(0, item.CurrentStock - med.Quantity);
                    item.UpdatedAt = now;

                    var price = item.PurchasePrice > 0 ? item.PurchasePrice : item.SellingPrice;
                    var itemTotal = price * med.Quantity;
                    totalOutwardAmount += itemTotal;

                    var outwardItem = new InventoryOutwardItem
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        BranchId = branchId,
                        OutwardId = outward.Id,
                        ItemId = item.Id,
                        Quantity = med.Quantity,
                        UnitPrice = price,
                        TotalAmount = itemTotal,
                        Remarks = med.Dosage
                    };
                    outward.Items.Add(outwardItem);
                }
            }
            outward.TotalAmount = totalOutwardAmount;

            _db.InventoryOutwards.Add(outward);
        }

        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetVisitById), new { id = visit.Id }, new InfirmaryVisitDto(
            visit.Id,
            visit.TenantId,
            visit.BranchId,
            null,
            visit.VisitNumber,
            visit.PatientType,
            visit.StudentId,
            visit.StaffId,
            visit.PatientName,
            visit.ClassOrDesignation,
            visit.ContactPhone,
            visit.VisitDate,
            visit.ChiefComplaints,
            visit.SymptomsList,
            visit.TemperatureF,
            visit.PulseBpm,
            visit.BloodPressure,
            visit.SpO2,
            visit.Severity,
            visit.BedRestRequired,
            visit.BedNumber,
            visit.AdmittedAt,
            visit.DischargedAt,
            visit.BedStatus,
            visit.Diagnosis,
            visit.TreatmentGiven,
            dto.MedicinesDispensed,
            visit.ParentContacted,
            visit.ParentContactedAt,
            visit.ParentNotificationNotes,
            visit.ReferredToHospital,
            visit.HospitalName,
            visit.SentHome,
            visit.AccompaniedBy,
            visit.AttendingStaffName,
            visit.Status,
            visit.Remarks,
            visit.CreatedAt
        ));
    }

    [HttpPut("visits/{id}")]
    public async Task<IActionResult> UpdateVisit(Guid id, [FromBody] UpdateInfirmaryVisitDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var visit = await _db.InfirmaryVisits.FirstOrDefaultAsync(v => v.Id == id && v.TenantId == tenantId);
        if (visit == null) return NotFound(new { message = "Infirmary visit not found." });

        if (dto.ChiefComplaints != null) visit.ChiefComplaints = dto.ChiefComplaints.Trim();
        if (dto.SymptomsList != null) visit.SymptomsList = dto.SymptomsList.Trim();
        if (dto.TemperatureF.HasValue) visit.TemperatureF = dto.TemperatureF;
        if (dto.PulseBpm.HasValue) visit.PulseBpm = dto.PulseBpm;
        if (dto.BloodPressure != null) visit.BloodPressure = dto.BloodPressure.Trim();
        if (dto.SpO2.HasValue) visit.SpO2 = dto.SpO2;
        if (dto.Severity != null) visit.Severity = dto.Severity;

        if (dto.BedRestRequired.HasValue)
        {
            visit.BedRestRequired = dto.BedRestRequired.Value;
            if (dto.BedRestRequired.Value && visit.BedStatus == "NotAssigned")
            {
                visit.BedStatus = "Occupied";
                visit.AdmittedAt ??= DateTime.UtcNow;
            }
        }

        if (dto.BedNumber != null) visit.BedNumber = dto.BedNumber.Trim();
        if (dto.AdmittedAt.HasValue) visit.AdmittedAt = dto.AdmittedAt;
        if (dto.DischargedAt.HasValue) visit.DischargedAt = dto.DischargedAt;
        if (dto.BedStatus != null) visit.BedStatus = dto.BedStatus;

        if (dto.Diagnosis != null) visit.Diagnosis = dto.Diagnosis.Trim();
        if (dto.TreatmentGiven != null) visit.TreatmentGiven = dto.TreatmentGiven.Trim();

        if (dto.MedicinesDispensed != null)
        {
            visit.MedicinesDispensedJson = JsonSerializer.Serialize(dto.MedicinesDispensed);
        }

        if (dto.ParentContacted.HasValue)
        {
            visit.ParentContacted = dto.ParentContacted.Value;
            if (dto.ParentContacted.Value && !visit.ParentContactedAt.HasValue)
            {
                visit.ParentContactedAt = DateTime.UtcNow;
            }
        }

        if (dto.ParentNotificationNotes != null) visit.ParentNotificationNotes = dto.ParentNotificationNotes.Trim();
        if (dto.ReferredToHospital.HasValue) visit.ReferredToHospital = dto.ReferredToHospital.Value;
        if (dto.HospitalName != null) visit.HospitalName = dto.HospitalName.Trim();
        if (dto.SentHome.HasValue) visit.SentHome = dto.SentHome.Value;
        if (dto.AccompaniedBy != null) visit.AccompaniedBy = dto.AccompaniedBy.Trim();
        if (dto.AttendingStaffName != null) visit.AttendingStaffName = dto.AttendingStaffName.Trim();
        if (dto.Status != null) visit.Status = dto.Status;
        if (dto.Remarks != null) visit.Remarks = dto.Remarks.Trim();

        visit.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Infirmary visit record updated successfully." });
    }

    [HttpPut("visits/{id}/discharge")]
    public async Task<IActionResult> DischargePatient(Guid id, [FromBody] DischargeInfirmaryVisitDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var visit = await _db.InfirmaryVisits.FirstOrDefaultAsync(v => v.Id == id && v.TenantId == tenantId);
        if (visit == null) return NotFound(new { message = "Infirmary visit not found." });

        var now = DateTime.UtcNow;
        visit.DischargedAt = dto.DischargedAt ?? now;
        visit.BedStatus = "Discharged";
        visit.Status = !string.IsNullOrWhiteSpace(dto.Status) ? dto.Status : "Discharged";
        if (!string.IsNullOrWhiteSpace(dto.Remarks))
        {
            visit.Remarks = (visit.Remarks + "\n" + dto.Remarks).Trim();
        }
        visit.UpdatedAt = now;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Patient discharged from sick bay successfully." });
    }

    [HttpDelete("visits/{id}")]
    public async Task<IActionResult> DeleteVisit(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var visit = await _db.InfirmaryVisits.FirstOrDefaultAsync(v => v.Id == id && v.TenantId == tenantId);
        if (visit == null) return NotFound(new { message = "Infirmary visit not found." });

        _db.InfirmaryVisits.Remove(visit);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Infirmary visit record deleted successfully." });
    }

    private static List<DispensedMedicineDto>? DeserializeMedicines(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<List<DispensedMedicineDto>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch
        {
            return null;
        }
    }
}
