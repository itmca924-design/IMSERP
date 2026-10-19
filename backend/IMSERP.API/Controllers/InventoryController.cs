using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InventoryController : ControllerBase
{
    private readonly IIMSERPDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public InventoryController(IIMSERPDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    private Guid GetEffectiveTenantId() => _currentUser.TenantId;
    private Guid? GetEffectiveBranchId(Guid? requestedBranchId = null) =>
        requestedBranchId.HasValue && requestedBranchId.Value != Guid.Empty
            ? requestedBranchId
            : _currentUser.BranchId;

    // =========================================================================
    // 1. Dashboard & KPI Metrics
    // =========================================================================

    [HttpGet("dashboard")]
    public async Task<ActionResult<InventoryDashboardDto>> GetDashboardMetrics([FromQuery] Guid? branchId = null)
    {
        var tenantId = GetEffectiveTenantId();
        var effBranchId = GetEffectiveBranchId(branchId);

        var itemsQuery = _db.InventoryItems.AsNoTracking().Where(i => i.IsActive);
        if (effBranchId.HasValue)
        {
            itemsQuery = itemsQuery.Where(i => i.BranchId == null || i.BranchId == effBranchId);
        }

        var totalItems = await itemsQuery.CountAsync();
        var stockValuation = await itemsQuery.SumAsync(i => (decimal?)(i.PurchasePrice * i.CurrentStock)) ?? 0;
        var lowStockCount = await itemsQuery.CountAsync(i => i.CurrentStock <= i.MinStockAlertLevel);
        var outOfStockCount = await itemsQuery.CountAsync(i => i.CurrentStock <= 0);

        var firstDayOfMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var inwardsQuery = _db.InventoryInwards.AsNoTracking().Where(inw => inw.InwardDate >= firstDayOfMonth);
        if (effBranchId.HasValue)
            inwardsQuery = inwardsQuery.Where(inw => inw.BranchId == null || inw.BranchId == effBranchId);

        var inwardsThisMonth = await inwardsQuery.SumAsync(inw => (decimal?)inw.NetAmount) ?? 0;
        var inwardCountThisMonth = await inwardsQuery.CountAsync();

        var outwardsQuery = _db.InventoryOutwards.AsNoTracking().Where(o => o.IssueDate >= firstDayOfMonth);
        if (effBranchId.HasValue)
            outwardsQuery = outwardsQuery.Where(o => o.BranchId == null || o.BranchId == effBranchId);

        var outwardCountThisMonth = await outwardsQuery.CountAsync();
        var outwardSalesThisMonth = await outwardsQuery.SumAsync(o => (decimal?)o.TotalAmount) ?? 0;

        // Top low-stock items for alert preview
        var lowStockItems = await itemsQuery
            .Where(i => i.CurrentStock <= i.MinStockAlertLevel)
            .OrderBy(i => i.CurrentStock)
            .Take(10)
            .Select(i => new InventoryItemSummaryDto(
                i.Id,
                i.ItemCode,
                i.ItemName,
                i.Category != null ? i.Category.Name : "General",
                i.ItemType,
                i.UnitOfMeasurement,
                i.CurrentStock,
                i.MinStockAlertLevel,
                i.PurchasePrice,
                i.SellingPrice,
                i.RackOrLocation
            ))
            .ToListAsync();

        return Ok(new InventoryDashboardDto(
            totalItems,
            stockValuation,
            lowStockCount,
            outOfStockCount,
            inwardCountThisMonth,
            inwardsThisMonth,
            outwardCountThisMonth,
            outwardSalesThisMonth,
            lowStockItems
        ));
    }

    // =========================================================================
    // 2. Categories Master CRUD
    // =========================================================================

    [HttpGet("categories")]
    public async Task<ActionResult<IEnumerable<InventoryCategoryDto>>> GetCategories([FromQuery] Guid? branchId = null)
    {
        var effBranchId = GetEffectiveBranchId(branchId);
        var query = _db.InventoryCategories
            .AsNoTracking()
            .Include(c => c.Items)
            .AsQueryable();

        if (effBranchId.HasValue)
            query = query.Where(c => c.BranchId == null || c.BranchId == effBranchId);

        var categories = await query
            .OrderBy(c => c.Name)
            .Select(c => new InventoryCategoryDto(
                c.Id,
                c.Name,
                c.Code,
                c.Description,
                c.IsActive,
                c.Items.Count(i => i.IsActive),
                c.BranchId
            ))
            .ToListAsync();

        return Ok(categories);
    }

    [HttpPost("categories")]
    public async Task<ActionResult<InventoryCategoryDto>> CreateCategory([FromBody] CreateUpdateCategoryDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.Code))
            return BadRequest("Category name and code are required.");

        var tenantId = GetEffectiveTenantId();
        var codeUpper = dto.Code.Trim().ToUpperInvariant();

        var exists = await _db.InventoryCategories
            .AnyAsync(c => c.TenantId == tenantId && c.Code.ToUpper() == codeUpper);
        if (exists)
            return BadRequest($"Category with code '{codeUpper}' already exists.");

        var category = new InventoryCategory
        {
            TenantId = tenantId,
            BranchId = dto.BranchId ?? _currentUser.BranchId,
            Name = dto.Name.Trim(),
            Code = codeUpper,
            Description = dto.Description?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.InventoryCategories.Add(category);
        await _db.SaveChangesAsync();

        return Ok(new InventoryCategoryDto(
            category.Id,
            category.Name,
            category.Code,
            category.Description,
            category.IsActive,
            0,
            category.BranchId
        ));
    }

    [HttpPut("categories/{id}")]
    public async Task<IActionResult> UpdateCategory(Guid id, [FromBody] CreateUpdateCategoryDto dto)
    {
        var category = await _db.InventoryCategories.FindAsync(id);
        if (category == null)
            return NotFound("Category not found.");

        category.Name = dto.Name.Trim();
        category.Description = dto.Description?.Trim();
        category.BranchId = dto.BranchId;
        category.IsActive = dto.IsActive;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Category updated successfully." });
    }

    [HttpDelete("categories/{id}")]
    public async Task<IActionResult> DeleteCategory(Guid id)
    {
        var category = await _db.InventoryCategories
            .Include(c => c.Items)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category == null)
            return NotFound("Category not found.");

        if (category.Items.Any(i => i.IsActive))
            return BadRequest("Cannot delete category containing active items. Please reassign or delete items first.");

        _db.InventoryCategories.Remove(category);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Category deleted successfully." });
    }

    // =========================================================================
    // 3. Vendors Master CRUD
    // =========================================================================

    [HttpGet("vendors")]
    public async Task<ActionResult<IEnumerable<InventoryVendorDto>>> GetVendors([FromQuery] Guid? branchId = null)
    {
        var effBranchId = GetEffectiveBranchId(branchId);
        var query = _db.InventoryVendors.AsNoTracking().AsQueryable();

        if (effBranchId.HasValue)
            query = query.Where(v => v.BranchId == null || v.BranchId == effBranchId);

        var vendors = await query
            .OrderBy(v => v.VendorName)
            .ToListAsync();

        var vendorIds = vendors.Select(v => v.Id).ToList();

        var inwardTotals = await _db.InventoryInwards
            .AsNoTracking()
            .Where(i => i.VendorId.HasValue && vendorIds.Contains(i.VendorId.Value))
            .GroupBy(i => i.VendorId!.Value)
            .Select(g => new { VendorId = g.Key, Total = g.Sum(x => x.NetAmount) })
            .ToDictionaryAsync(x => x.VendorId, x => x.Total);

        var paymentTotals = await _db.InventoryVendorPayments
            .AsNoTracking()
            .Where(p => vendorIds.Contains(p.VendorId))
            .GroupBy(p => p.VendorId)
            .Select(g => new { VendorId = g.Key, Total = g.Sum(x => x.Amount) })
            .ToDictionaryAsync(x => x.VendorId, x => x.Total);

        var returnTotals = await _db.InventoryPurchaseReturns
            .AsNoTracking()
            .Where(r => vendorIds.Contains(r.VendorId))
            .GroupBy(r => r.VendorId)
            .Select(g => new { VendorId = g.Key, Total = g.Sum(x => x.TotalAmount) })
            .ToDictionaryAsync(x => x.VendorId, x => x.Total);

        var result = vendors.Select(v =>
        {
            var purchased = inwardTotals.GetValueOrDefault(v.Id, 0);
            var paid = paymentTotals.GetValueOrDefault(v.Id, 0);
            var returned = returnTotals.GetValueOrDefault(v.Id, 0);
            var balanceDue = purchased - paid - returned;

            return new InventoryVendorDto(
                v.Id,
                v.VendorName,
                v.ContactPerson,
                v.Phone,
                v.Email,
                v.Address,
                v.Gstin,
                v.Pan,
                v.PaymentTerms,
                v.BankDetails,
                v.IsActive,
                v.BranchId,
                purchased,
                paid,
                returned,
                balanceDue
            );
        }).ToList();

        return Ok(result);
    }

    [HttpPost("vendors")]
    public async Task<ActionResult<InventoryVendorDto>> CreateVendor([FromBody] CreateUpdateVendorDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.VendorName))
            return BadRequest("Vendor name is required.");

        var vendor = new InventoryVendor
        {
            TenantId = GetEffectiveTenantId(),
            BranchId = dto.BranchId ?? _currentUser.BranchId,
            VendorName = dto.VendorName.Trim(),
            ContactPerson = dto.ContactPerson?.Trim(),
            Phone = dto.Phone?.Trim(),
            Email = dto.Email?.Trim(),
            Address = dto.Address?.Trim(),
            Gstin = dto.Gstin?.Trim(),
            Pan = dto.Pan?.Trim(),
            PaymentTerms = dto.PaymentTerms?.Trim(),
            BankDetails = dto.BankDetails?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.InventoryVendors.Add(vendor);
        await _db.SaveChangesAsync();

        return Ok(new InventoryVendorDto(
            vendor.Id,
            vendor.VendorName,
            vendor.ContactPerson,
            vendor.Phone,
            vendor.Email,
            vendor.Address,
            vendor.Gstin,
            vendor.Pan,
            vendor.PaymentTerms,
            vendor.BankDetails,
            vendor.IsActive,
            vendor.BranchId
        ));
    }

    [HttpPut("vendors/{id}")]
    public async Task<IActionResult> UpdateVendor(Guid id, [FromBody] CreateUpdateVendorDto dto)
    {
        var vendor = await _db.InventoryVendors.FindAsync(id);
        if (vendor == null)
            return NotFound("Vendor not found.");

        vendor.VendorName = dto.VendorName.Trim();
        vendor.ContactPerson = dto.ContactPerson?.Trim();
        vendor.Phone = dto.Phone?.Trim();
        vendor.Email = dto.Email?.Trim();
        vendor.Address = dto.Address?.Trim();
        vendor.Gstin = dto.Gstin?.Trim();
        vendor.Pan = dto.Pan?.Trim();
        vendor.PaymentTerms = dto.PaymentTerms?.Trim();
        vendor.BankDetails = dto.BankDetails?.Trim();
        vendor.BranchId = dto.BranchId;
        vendor.IsActive = dto.IsActive;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Vendor updated successfully." });
    }

    [HttpDelete("vendors/{id}")]
    public async Task<IActionResult> DeleteVendor(Guid id)
    {
        var vendor = await _db.InventoryVendors.FindAsync(id);
        if (vendor == null)
            return NotFound("Vendor not found.");

        var hasInwards = await _db.InventoryInwards.AnyAsync(i => i.VendorId == id);
        if (hasInwards)
            return BadRequest("Cannot delete vendor with purchase/inward transaction history. You can mark vendor inactive instead.");

        _db.InventoryVendors.Remove(vendor);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Vendor deleted successfully." });
    }

    // =========================================================================
    // 4. Inventory Items Master CRUD
    // =========================================================================

    [HttpGet("items")]
    public async Task<ActionResult<IEnumerable<InventoryItemDto>>> GetItems(
        [FromQuery] string? search = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] string? itemType = null,
        [FromQuery] bool? lowStockOnly = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] bool activeOnly = true)
    {
        var effBranchId = GetEffectiveBranchId(branchId);
        var query = _db.InventoryItems
            .AsNoTracking()
            .Include(i => i.Category)
            .AsQueryable();

        if (activeOnly)
            query = query.Where(i => i.IsActive);

        if (effBranchId.HasValue)
            query = query.Where(i => i.BranchId == null || i.BranchId == effBranchId);

        if (categoryId.HasValue && categoryId.Value != Guid.Empty)
            query = query.Where(i => i.CategoryId == categoryId.Value);

        if (!string.IsNullOrWhiteSpace(itemType) && itemType != "All")
            query = query.Where(i => i.ItemType == itemType);

        if (lowStockOnly == true)
            query = query.Where(i => i.CurrentStock <= i.MinStockAlertLevel);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(i =>
                i.ItemName.ToLower().Contains(term) ||
                i.ItemCode.ToLower().Contains(term) ||
                (i.RackOrLocation != null && i.RackOrLocation.ToLower().Contains(term)) ||
                (i.Description != null && i.Description.ToLower().Contains(term)));
        }

        var items = await query
            .OrderBy(i => i.Category != null ? i.Category.Name : "")
            .ThenBy(i => i.ItemName)
            .Select(i => new InventoryItemDto(
                i.Id,
                i.CategoryId,
                i.Category != null ? i.Category.Name : "General",
                i.ItemCode,
                i.ItemName,
                i.ItemType,
                i.UnitOfMeasurement,
                i.PurchasePrice,
                i.SellingPrice,
                i.CurrentStock,
                i.MinStockAlertLevel,
                i.RackOrLocation,
                i.Description,
                i.IsActive,
                i.BranchId,
                i.CreatedAt,
                i.UpdatedAt
            ))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("items")]
    public async Task<ActionResult<InventoryItemDto>> CreateItem([FromBody] CreateUpdateItemDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ItemName))
            return BadRequest("Item name is required.");

        var tenantId = GetEffectiveTenantId();
        var code = string.IsNullOrWhiteSpace(dto.ItemCode)
            ? $"ITM-{DateTime.UtcNow:yyMM}-{new Random().Next(1000, 9999)}"
            : dto.ItemCode.Trim().ToUpperInvariant();

        var exists = await _db.InventoryItems
            .AnyAsync(i => i.TenantId == tenantId && i.ItemCode.ToUpper() == code);
        if (exists)
            return BadRequest($"An item with code '{code}' already exists. Please choose a unique item code.");

        var item = new InventoryItem
        {
            TenantId = tenantId,
            BranchId = dto.BranchId ?? _currentUser.BranchId,
            CategoryId = dto.CategoryId,
            ItemCode = code,
            ItemName = dto.ItemName.Trim(),
            ItemType = string.IsNullOrWhiteSpace(dto.ItemType) ? "Consumable" : dto.ItemType.Trim(),
            UnitOfMeasurement = string.IsNullOrWhiteSpace(dto.UnitOfMeasurement) ? "Pcs" : dto.UnitOfMeasurement.Trim(),
            PurchasePrice = Math.Max(0, dto.PurchasePrice),
            SellingPrice = Math.Max(0, dto.SellingPrice),
            CurrentStock = Math.Max(0, dto.InitialStock),
            MinStockAlertLevel = Math.Max(0, dto.MinStockAlertLevel),
            RackOrLocation = dto.RackOrLocation?.Trim(),
            Description = dto.Description?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.InventoryItems.Add(item);

        // Record initial stock adjustment if initial stock is greater than 0
        if (dto.InitialStock > 0)
        {
            _db.InventoryStockAdjustments.Add(new InventoryStockAdjustment
            {
                TenantId = tenantId,
                BranchId = item.BranchId,
                ItemId = item.Id,
                AdjustmentType = "InitialStockOpening",
                PreviousStock = 0,
                AdjustedQuantity = dto.InitialStock,
                NewStock = dto.InitialStock,
                Reason = "Opening stock at item creation",
                AdjustedAt = DateTime.UtcNow,
                AdjustedBy = _currentUser.UserId
            });
        }

        await _db.SaveChangesAsync();

        var category = await _db.InventoryCategories.FindAsync(item.CategoryId);

        return Ok(new InventoryItemDto(
            item.Id,
            item.CategoryId,
            category?.Name ?? "General",
            item.ItemCode,
            item.ItemName,
            item.ItemType,
            item.UnitOfMeasurement,
            item.PurchasePrice,
            item.SellingPrice,
            item.CurrentStock,
            item.MinStockAlertLevel,
            item.RackOrLocation,
            item.Description,
            item.IsActive,
            item.BranchId,
            item.CreatedAt,
            item.UpdatedAt
        ));
    }

    [HttpPut("items/{id}")]
    public async Task<IActionResult> UpdateItem(Guid id, [FromBody] CreateUpdateItemDto dto)
    {
        var item = await _db.InventoryItems.FindAsync(id);
        if (item == null)
            return NotFound("Item not found.");

        item.CategoryId = dto.CategoryId;
        item.ItemName = dto.ItemName.Trim();
        item.ItemType = dto.ItemType;
        item.UnitOfMeasurement = dto.UnitOfMeasurement;
        item.PurchasePrice = Math.Max(0, dto.PurchasePrice);
        item.SellingPrice = Math.Max(0, dto.SellingPrice);
        item.MinStockAlertLevel = Math.Max(0, dto.MinStockAlertLevel);
        item.RackOrLocation = dto.RackOrLocation?.Trim();
        item.Description = dto.Description?.Trim();
        item.BranchId = dto.BranchId;
        item.IsActive = dto.IsActive;
        item.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Item updated successfully." });
    }

    [HttpDelete("items/{id}")]
    public async Task<IActionResult> DeleteItem(Guid id)
    {
        var item = await _db.InventoryItems.FindAsync(id);
        if (item == null)
            return NotFound("Item not found.");

        var hasInwards = await _db.InventoryInwardItems.AnyAsync(ii => ii.ItemId == id);
        var hasOutwards = await _db.InventoryOutwardItems.AnyAsync(oi => oi.ItemId == id);

        if (hasInwards || hasOutwards)
        {
            // Soft delete
            item.IsActive = false;
            item.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { message = "Item has transaction history and was marked inactive instead of permanently deleted." });
        }

        _db.InventoryItems.Remove(item);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Item deleted successfully." });
    }

    // =========================================================================
    // 5. Stock Inward (Purchases / GRN)
    // =========================================================================

    [HttpGet("inwards")]
    public async Task<ActionResult<IEnumerable<InventoryInwardDto>>> GetInwards(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] Guid? vendorId = null,
        [FromQuery] Guid? branchId = null)
    {
        var effBranchId = GetEffectiveBranchId(branchId);
        var query = _db.InventoryInwards
            .AsNoTracking()
            .Include(i => i.Vendor)
            .Include(i => i.Items)
                .ThenInclude(ii => ii.Item)
            .AsQueryable();

        if (effBranchId.HasValue)
            query = query.Where(i => i.BranchId == null || i.BranchId == effBranchId);

        if (vendorId.HasValue && vendorId.Value != Guid.Empty)
            query = query.Where(i => i.VendorId == vendorId.Value);

        if (startDate.HasValue)
            query = query.Where(i => i.InwardDate >= startDate.Value.Date);

        if (endDate.HasValue)
            query = query.Where(i => i.InwardDate <= endDate.Value.Date.AddDays(1).AddTicks(-1));

        var inwards = await query
            .OrderByDescending(i => i.InwardDate)
            .Select(i => new InventoryInwardDto(
                i.Id,
                i.InwardNumber,
                i.InvoiceBillNumber,
                i.InwardDate,
                i.VendorId,
                i.Vendor != null ? i.Vendor.VendorName : "Direct Purchase",
                i.TotalAmount,
                i.DiscountAmount,
                i.TaxAmount,
                i.NetAmount,
                i.PaymentStatus,
                i.PaymentMode,
                i.Remarks,
                i.BranchId,
                i.CreatedAt,
                i.Items.Select(it => new InventoryInwardItemDto(
                    it.Id,
                    it.ItemId,
                    it.Item != null ? it.Item.ItemName : "",
                    it.Item != null ? it.Item.ItemCode : "",
                    it.Quantity,
                    it.UnitPrice,
                    it.TotalAmount,
                    it.BatchOrSerialNo,
                    it.Remarks
                )).ToList()
            ))
            .ToListAsync();

        return Ok(inwards);
    }

    [HttpPost("inwards")]
    public async Task<IActionResult> CreateInward([FromBody] CreateInwardDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest("At least one item line is required for stock inward.");

        var tenantId = GetEffectiveTenantId();
        var inwardNumber = $"GRN-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(100, 999)}";

        decimal totalAmount = 0;

        var inward = new InventoryInward
        {
            TenantId = tenantId,
            BranchId = dto.BranchId ?? _currentUser.BranchId,
            VendorId = dto.VendorId,
            InwardNumber = inwardNumber,
            InvoiceBillNumber = dto.InvoiceBillNumber?.Trim(),
            InwardDate = dto.InwardDate ?? DateTime.UtcNow,
            DiscountAmount = Math.Max(0, dto.DiscountAmount),
            TaxAmount = Math.Max(0, dto.TaxAmount),
            PaymentStatus = string.IsNullOrWhiteSpace(dto.PaymentStatus) ? "Paid" : dto.PaymentStatus.Trim(),
            PaymentMode = string.IsNullOrWhiteSpace(dto.PaymentMode) ? "Cash" : dto.PaymentMode.Trim(),
            Remarks = dto.Remarks?.Trim(),
            CreatedBy = _currentUser.UserId,
            CreatedAt = DateTime.UtcNow
        };

        foreach (var row in dto.Items)
        {
            if (row.Quantity <= 0)
                continue;

            var item = await _db.InventoryItems.FindAsync(row.ItemId);
            if (item == null)
                return BadRequest($"Item with ID '{row.ItemId}' not found.");

            var lineTotal = row.Quantity * row.UnitPrice;
            totalAmount += lineTotal;

            // Increment current physical stock
            item.CurrentStock += row.Quantity;
            item.PurchasePrice = row.UnitPrice > 0 ? row.UnitPrice : item.PurchasePrice;
            item.UpdatedAt = DateTime.UtcNow;

            inward.Items.Add(new InventoryInwardItem
            {
                TenantId = tenantId,
                BranchId = inward.BranchId,
                InwardId = inward.Id,
                ItemId = item.Id,
                Quantity = row.Quantity,
                UnitPrice = row.UnitPrice,
                TotalAmount = lineTotal,
                BatchOrSerialNo = row.BatchOrSerialNo?.Trim(),
                Remarks = row.Remarks?.Trim()
            });
        }

        inward.TotalAmount = totalAmount;
        inward.NetAmount = Math.Max(0, totalAmount - inward.DiscountAmount + inward.TaxAmount);

        _db.InventoryInwards.Add(inward);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Stock inward saved and item quantities updated successfully.", inwardNumber });
    }

    // =========================================================================
    // 6. Stock Outward & Distribution (Staff Issue + Student Kit Sales)
    // =========================================================================

    [HttpGet("outwards")]
    public async Task<ActionResult<IEnumerable<InventoryOutwardDto>>> GetOutwards(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] string? issueType = null,
        [FromQuery] Guid? studentId = null,
        [FromQuery] Guid? branchId = null)
    {
        var effBranchId = GetEffectiveBranchId(branchId);
        var query = _db.InventoryOutwards
            .AsNoTracking()
            .Include(o => o.Student)
            .Include(o => o.Items)
                .ThenInclude(oi => oi.Item)
            .AsQueryable();

        if (effBranchId.HasValue)
            query = query.Where(o => o.BranchId == null || o.BranchId == effBranchId);

        if (!string.IsNullOrWhiteSpace(issueType) && issueType != "All")
            query = query.Where(o => o.IssueType == issueType);

        if (studentId.HasValue && studentId.Value != Guid.Empty)
            query = query.Where(o => o.StudentId == studentId.Value);

        if (startDate.HasValue)
            query = query.Where(o => o.IssueDate >= startDate.Value.Date);

        if (endDate.HasValue)
            query = query.Where(o => o.IssueDate <= endDate.Value.Date.AddDays(1).AddTicks(-1));

        var outwards = await query
            .OrderByDescending(o => o.IssueDate)
            .Select(o => new InventoryOutwardDto(
                o.Id,
                o.IssueNumber,
                o.IssueDate,
                o.IssueType,
                o.StudentId,
                o.Student != null ? o.Student.StudentName : null,
                o.Student != null ? o.Student.RollNumber : null,
                o.IssuedToName,
                o.DepartmentOrClass,
                o.TotalAmount,
                o.PaymentStatus,
                o.PaymentMode,
                o.Remarks,
                o.BranchId,
                o.CreatedAt,
                o.Items.Select(it => new InventoryOutwardItemDto(
                    it.Id,
                    it.ItemId,
                    it.Item != null ? it.Item.ItemName : "",
                    it.Item != null ? it.Item.ItemCode : "",
                    it.Quantity,
                    it.UnitPrice,
                    it.TotalAmount,
                    it.Remarks
                )).ToList()
            ))
            .ToListAsync();

        return Ok(outwards);
    }

    [HttpPost("outwards")]
    public async Task<IActionResult> CreateOutward([FromBody] CreateOutwardDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest("At least one item is required for stock issue/distribution.");

        if (string.IsNullOrWhiteSpace(dto.IssuedToName))
            return BadRequest("Recipient name (Student or Staff/Department) is required.");

        var tenantId = GetEffectiveTenantId();
        var issueNumber = $"ISS-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(100, 999)}";

        // Pre-validate stock for ALL lines before making any changes
        foreach (var row in dto.Items)
        {
            if (row.Quantity <= 0)
                continue;

            var itm = await _db.InventoryItems.FindAsync(row.ItemId);
            if (itm == null)
                return BadRequest($"Item with ID '{row.ItemId}' not found.");

            if (itm.CurrentStock < row.Quantity)
            {
                return BadRequest($"Insufficient stock for '{itm.ItemName}' (Code: {itm.ItemCode}). Available: {itm.CurrentStock} {itm.UnitOfMeasurement}, Requested: {row.Quantity} {itm.UnitOfMeasurement}.");
            }
        }

        decimal totalAmount = 0;

        var outward = new InventoryOutward
        {
            TenantId = tenantId,
            BranchId = dto.BranchId ?? _currentUser.BranchId,
            IssueNumber = issueNumber,
            IssueDate = dto.IssueDate ?? DateTime.UtcNow,
            IssueType = string.IsNullOrWhiteSpace(dto.IssueType) ? "StaffDepartmentIssue" : dto.IssueType.Trim(),
            StudentId = dto.StudentId,
            IssuedToName = dto.IssuedToName.Trim(),
            DepartmentOrClass = dto.DepartmentOrClass?.Trim(),
            PaymentStatus = string.IsNullOrWhiteSpace(dto.PaymentStatus) ? "Free/Complimentary" : dto.PaymentStatus.Trim(),
            PaymentMode = dto.PaymentMode?.Trim(),
            Remarks = dto.Remarks?.Trim(),
            CreatedBy = _currentUser.UserId,
            CreatedAt = DateTime.UtcNow
        };

        foreach (var row in dto.Items)
        {
            if (row.Quantity <= 0)
                continue;

            var item = await _db.InventoryItems.FindAsync(row.ItemId)!;
            var lineTotal = row.Quantity * row.UnitPrice;
            totalAmount += lineTotal;

            // Deduct stock
            item!.CurrentStock -= row.Quantity;
            item.UpdatedAt = DateTime.UtcNow;

            outward.Items.Add(new InventoryOutwardItem
            {
                TenantId = tenantId,
                BranchId = outward.BranchId,
                OutwardId = outward.Id,
                ItemId = item.Id,
                Quantity = row.Quantity,
                UnitPrice = row.UnitPrice,
                TotalAmount = lineTotal,
                Remarks = row.Remarks?.Trim()
            });
        }

        outward.TotalAmount = totalAmount;

        _db.InventoryOutwards.Add(outward);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Stock issued / distributed successfully.", issueNumber });
    }

    // =========================================================================
    // 7. Stock Audit & Adjustments
    // =========================================================================

    [HttpGet("adjustments")]
    public async Task<ActionResult<IEnumerable<InventoryStockAdjustmentDto>>> GetAdjustments(
        [FromQuery] Guid? itemId = null,
        [FromQuery] Guid? branchId = null)
    {
        var effBranchId = GetEffectiveBranchId(branchId);
        var query = _db.InventoryStockAdjustments
            .AsNoTracking()
            .Include(a => a.Item)
            .AsQueryable();

        if (effBranchId.HasValue)
            query = query.Where(a => a.BranchId == null || a.BranchId == effBranchId);

        if (itemId.HasValue && itemId.Value != Guid.Empty)
            query = query.Where(a => a.ItemId == itemId.Value);

        var list = await query
            .OrderByDescending(a => a.AdjustedAt)
            .Take(100)
            .Select(a => new InventoryStockAdjustmentDto(
                a.Id,
                a.ItemId,
                a.Item != null ? a.Item.ItemName : "",
                a.Item != null ? a.Item.ItemCode : "",
                a.AdjustmentType,
                a.PreviousStock,
                a.AdjustedQuantity,
                a.NewStock,
                a.Reason,
                a.AdjustedAt
            ))
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost("adjustments")]
    public async Task<IActionResult> CreateAdjustment([FromBody] CreateStockAdjustmentDto dto)
    {
        var item = await _db.InventoryItems.FindAsync(dto.ItemId);
        if (item == null)
            return NotFound("Item not found.");

        var prevStock = item.CurrentStock;
        var newStock = Math.Max(0, prevStock + dto.AdjustedQuantity);

        item.CurrentStock = newStock;
        item.UpdatedAt = DateTime.UtcNow;

        var adj = new InventoryStockAdjustment
        {
            TenantId = GetEffectiveTenantId(),
            BranchId = item.BranchId,
            ItemId = item.Id,
            AdjustmentType = string.IsNullOrWhiteSpace(dto.AdjustmentType) ? "PhysicalAuditCorrection" : dto.AdjustmentType.Trim(),
            PreviousStock = prevStock,
            AdjustedQuantity = dto.AdjustedQuantity,
            NewStock = newStock,
            Reason = dto.Reason?.Trim(),
            AdjustedAt = DateTime.UtcNow,
            AdjustedBy = _currentUser.UserId
        };

        _db.InventoryStockAdjustments.Add(adj);
        await _db.SaveChangesAsync();

        return Ok(new { message = $"Stock adjusted successfully. New stock: {newStock} {item.UnitOfMeasurement}." });
    }

    // =========================================================================
    // 8. Student Quick Lookup Helper (For Fast Kit / Uniform / Stationary Sales)
    // =========================================================================

    [HttpGet("students-lookup")]
    public async Task<ActionResult<IEnumerable<StudentLookupDto>>> SearchStudents(
        [FromQuery] string? query = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] Guid? classId = null)
    {
        if (string.IsNullOrWhiteSpace(query) && !classId.HasValue)
            return Ok(Enumerable.Empty<StudentLookupDto>());

        var effBranchId = GetEffectiveBranchId(branchId);

        var q = _db.Students
            .AsNoTracking()
            .Where(s => s.IsActive);

        if (effBranchId.HasValue)
            q = q.Where(s => s.BranchId == null || s.BranchId == effBranchId);

        if (classId.HasValue)
            q = q.Where(s => s.ClassId == classId.Value);

        if (!string.IsNullOrWhiteSpace(query) && query.Trim().Length >= 2)
        {
            var term = query.Trim().ToLower();
            q = q.Where(s => s.StudentName.ToLower().Contains(term) ||
                             s.RollNumber.ToLower().Contains(term) ||
                             (s.AdmissionNumber != null && s.AdmissionNumber.ToLower().Contains(term)) ||
                             (s.ParentWhatsAppPhone != null && s.ParentWhatsAppPhone.Contains(term)));
        }

        var list = await q
            .OrderBy(s => s.RollNumber)
            .ThenBy(s => s.StudentName)
            .Take(classId.HasValue && string.IsNullOrWhiteSpace(query) ? 300 : 25)
            .Select(s => new StudentLookupDto(
                s.Id,
                s.StudentName,
                s.RollNumber,
                s.AdmissionNumber ?? string.Empty,
                s.ParentWhatsAppPhone,
                s.Class != null ? s.Class.Name : null,
                s.Section != null ? s.Section.Name : null,
                s.ClassId
            ))
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("staff-lookup")]
    public async Task<ActionResult<IEnumerable<StaffLookupDto>>> GetStaffLookup([FromQuery] Guid? branchId = null)
    {
        var effBranchId = GetEffectiveBranchId(branchId);

        var q = _db.Teachers
            .AsNoTracking()
            .Where(t => t.IsActive);

        if (effBranchId.HasValue)
            q = q.Where(t => t.BranchId == null || t.BranchId == effBranchId);

        var list = await q
            .OrderBy(t => t.StaffType)
            .ThenBy(t => t.FullName)
            .Select(t => new StaffLookupDto(
                t.Id,
                t.EmployeeCode,
                t.FullName,
                t.StaffType.ToString(),
                t.Designation,
                t.Department,
                t.BranchId
            ))
            .ToListAsync();

        return Ok(list);
    }

    // =========================================================================
    // 8. Vendor Ledger & Vendor Payments
    // =========================================================================

    [HttpGet("vendors/{id}/ledger")]
    public async Task<ActionResult<VendorLedgerSummaryDto>> GetVendorLedger(
        Guid id,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        var vendor = await _db.InventoryVendors.AsNoTracking().FirstOrDefaultAsync(v => v.Id == id);
        if (vendor == null)
            return NotFound("Vendor not found.");

        var allInwards = await _db.InventoryInwards.AsNoTracking()
            .Where(i => i.VendorId == id)
            .Include(i => i.Items).ThenInclude(it => it.Item)
            .ToListAsync();

        var allPayments = await _db.InventoryVendorPayments.AsNoTracking()
            .Where(p => p.VendorId == id)
            .ToListAsync();

        var allReturns = await _db.InventoryPurchaseReturns.AsNoTracking()
            .Where(r => r.VendorId == id)
            .Include(r => r.Items).ThenInclude(it => it.Item)
            .ToListAsync();

        var totalPurchased = allInwards.Sum(i => i.NetAmount);
        var totalPaid = allPayments.Sum(p => p.Amount);
        var totalReturns = allReturns.Sum(r => r.TotalAmount);
        var balanceDue = totalPurchased - totalPaid - totalReturns;

        var rawEntries = new List<VendorLedgerRawEntry>();

        foreach (var inw in allInwards)
        {
            var itemsSummary = inw.Items != null && inw.Items.Count > 0
                ? string.Join(", ", inw.Items.Select(it => $"{it.Item?.ItemName ?? "Item"} x{it.Quantity}"))
                : "Inventory Goods Received";

            rawEntries.Add(new VendorLedgerRawEntry(
                inw.Id,
                inw.InwardDate,
                "InwardPurchase",
                inw.InwardNumber,
                inw.InvoiceBillNumber,
                $"Bill/GRN: {inw.InvoiceBillNumber ?? inw.InwardNumber} — {itemsSummary}",
                0,
                inw.NetAmount,
                inw.PaymentMode,
                inw.Remarks
            ));
        }

        foreach (var pay in allPayments)
        {
            rawEntries.Add(new VendorLedgerRawEntry(
                pay.Id,
                pay.PaymentDate,
                "VendorPayment",
                pay.VoucherNumber,
                null,
                $"Payment Made via {pay.PaymentMode} {(string.IsNullOrWhiteSpace(pay.ReferenceNumber) ? "" : $"[Ref/UTR: {pay.ReferenceNumber}]")}".Trim(),
                pay.Amount,
                0,
                pay.PaymentMode,
                pay.Remarks
            ));
        }

        foreach (var ret in allReturns)
        {
            var returnItems = ret.Items != null && ret.Items.Count > 0
                ? string.Join(", ", ret.Items.Select(it => $"{it.Item?.ItemName ?? "Item"} x{it.Quantity}"))
                : "Items Returned";

            rawEntries.Add(new VendorLedgerRawEntry(
                ret.Id,
                ret.ReturnDate,
                "PurchaseReturn",
                ret.DebitNoteNumber ?? ret.ReturnNumber,
                null,
                $"Debit Note: {ret.DebitNoteNumber ?? ret.ReturnNumber} — {returnItems}",
                ret.TotalAmount,
                0,
                null,
                ret.Remarks
            ));
        }

        var sorted = rawEntries.OrderBy(e => e.Date).ToList();

        decimal running = 0;
        var computedEntries = new List<VendorLedgerEntryDto>();
        foreach (var e in sorted)
        {
            running += (e.Credit - e.Debit);
            computedEntries.Add(new VendorLedgerEntryDto(
                e.Id,
                e.Date,
                e.EntryType,
                e.ReferenceNumber,
                e.BillNumber,
                e.Description,
                e.Debit,
                e.Credit,
                running,
                e.PaymentMode,
                e.Remarks
            ));
        }

        if (startDate.HasValue)
            computedEntries = computedEntries.Where(e => e.Date >= startDate.Value.Date).ToList();
        if (endDate.HasValue)
            computedEntries = computedEntries.Where(e => e.Date <= endDate.Value.Date.AddDays(1).AddTicks(-1)).ToList();

        return Ok(new VendorLedgerSummaryDto(
            vendor.Id,
            vendor.VendorName,
            vendor.ContactPerson,
            vendor.Phone,
            vendor.Email,
            vendor.Address,
            vendor.Gstin,
            vendor.Pan,
            vendor.PaymentTerms,
            vendor.BankDetails,
            totalPurchased,
            totalPaid,
            totalReturns,
            balanceDue,
            computedEntries
        ));
    }

    [HttpPost("vendors/payments")]
    public async Task<IActionResult> RecordVendorPayment([FromBody] RecordVendorPaymentDto dto)
    {
        if (dto.Amount <= 0)
            return BadRequest("Payment amount must be greater than 0.");

        var vendor = await _db.InventoryVendors.FindAsync(dto.VendorId);
        if (vendor == null)
            return NotFound("Vendor not found.");

        var voucherNo = $"VP-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(100, 999)}";

        var payment = new InventoryVendorPayment
        {
            TenantId = GetEffectiveTenantId(),
            BranchId = dto.BranchId ?? _currentUser.BranchId,
            VendorId = dto.VendorId,
            VoucherNumber = voucherNo,
            PaymentDate = dto.PaymentDate,
            Amount = dto.Amount,
            PaymentMode = dto.PaymentMode ?? "Cash",
            ReferenceNumber = dto.ReferenceNumber?.Trim(),
            BankName = dto.BankName?.Trim(),
            Remarks = dto.Remarks?.Trim(),
            CreatedBy = _currentUser.UserId
        };

        _db.InventoryVendorPayments.Add(payment);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Vendor payment recorded successfully.", voucherNumber = voucherNo });
    }

    [HttpGet("vendors/payments")]
    public async Task<ActionResult<IEnumerable<VendorPaymentDto>>> GetVendorPayments(
        [FromQuery] Guid? vendorId = null,
        [FromQuery] Guid? branchId = null)
    {
        var effBranchId = GetEffectiveBranchId(branchId);
        var q = _db.InventoryVendorPayments
            .AsNoTracking()
            .Include(p => p.Vendor)
            .AsQueryable();

        if (effBranchId.HasValue)
            q = q.Where(p => p.BranchId == null || p.BranchId == effBranchId);

        if (vendorId.HasValue && vendorId.Value != Guid.Empty)
            q = q.Where(p => p.VendorId == vendorId.Value);

        var list = await q
            .OrderByDescending(p => p.PaymentDate)
            .Select(p => new VendorPaymentDto(
                p.Id,
                p.VendorId,
                p.Vendor != null ? p.Vendor.VendorName : "Unknown Vendor",
                p.VoucherNumber,
                p.PaymentDate,
                p.Amount,
                p.PaymentMode,
                p.ReferenceNumber,
                p.BankName,
                p.Remarks,
                p.BranchId,
                p.CreatedAt
            ))
            .ToListAsync();

        return Ok(list);
    }

    // =========================================================================
    // 9. Purchase Returns (Debit Notes)
    // =========================================================================

    [HttpGet("purchase-returns")]
    public async Task<ActionResult<IEnumerable<InventoryPurchaseReturnDto>>> GetPurchaseReturns(
        [FromQuery] Guid? vendorId = null,
        [FromQuery] Guid? branchId = null)
    {
        var effBranchId = GetEffectiveBranchId(branchId);
        var q = _db.InventoryPurchaseReturns
            .AsNoTracking()
            .Include(r => r.Vendor)
            .Include(r => r.Items).ThenInclude(i => i.Item)
            .AsQueryable();

        if (effBranchId.HasValue)
            q = q.Where(r => r.BranchId == null || r.BranchId == effBranchId);

        if (vendorId.HasValue && vendorId.Value != Guid.Empty)
            q = q.Where(r => r.VendorId == vendorId.Value);

        var list = await q
            .OrderByDescending(r => r.ReturnDate)
            .Select(r => new InventoryPurchaseReturnDto(
                r.Id,
                r.VendorId,
                r.Vendor != null ? r.Vendor.VendorName : "Unknown Vendor",
                r.InwardId,
                r.ReturnNumber,
                r.DebitNoteNumber,
                r.ReturnDate,
                r.TotalAmount,
                r.RefundStatus,
                r.Remarks,
                r.BranchId,
                r.CreatedAt,
                r.Items.Select(it => new PurchaseReturnItemLineDetailDto(
                    it.Id,
                    it.ItemId,
                    it.Item != null ? it.Item.ItemName : "",
                    it.Item != null ? it.Item.ItemCode : "",
                    it.Quantity,
                    it.UnitPrice,
                    it.TotalAmount,
                    it.Reason
                )).ToList()
            ))
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost("purchase-returns")]
    public async Task<IActionResult> CreatePurchaseReturn([FromBody] CreatePurchaseReturnDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest("At least one item is required for purchase return.");

        var vendor = await _db.InventoryVendors.FindAsync(dto.VendorId);
        if (vendor == null)
            return NotFound("Vendor not found.");

        var rand = new Random().Next(100, 999);
        var returnNo = $"PR-{DateTime.UtcNow:yyyyMMdd}-{rand}";
        var debitNoteNo = $"DN-{DateTime.UtcNow:yyyyMMdd}-{rand}";

        decimal totalAmount = 0;
        var pReturn = new InventoryPurchaseReturn
        {
            TenantId = GetEffectiveTenantId(),
            BranchId = dto.BranchId ?? _currentUser.BranchId,
            VendorId = dto.VendorId,
            InwardId = dto.InwardId,
            ReturnNumber = returnNo,
            DebitNoteNumber = debitNoteNo,
            ReturnDate = dto.ReturnDate,
            RefundStatus = "AdjustedInLedger",
            Remarks = dto.Remarks?.Trim(),
            CreatedBy = _currentUser.UserId
        };

        foreach (var line in dto.Items)
        {
            var item = await _db.InventoryItems.FindAsync(line.ItemId);
            if (item == null)
                return BadRequest($"Item ID '{line.ItemId}' not found.");

            if (line.Quantity <= 0)
                return BadRequest($"Return quantity for item '{item.ItemName}' must be greater than 0.");

            var lineTotal = line.Quantity * line.UnitPrice;
            totalAmount += lineTotal;

            pReturn.Items.Add(new InventoryPurchaseReturnItem
            {
                TenantId = GetEffectiveTenantId(),
                BranchId = dto.BranchId ?? _currentUser.BranchId,
                ItemId = line.ItemId,
                Quantity = line.Quantity,
                UnitPrice = line.UnitPrice,
                TotalAmount = lineTotal,
                Reason = line.Reason?.Trim()
            });

            var prevStock = item.CurrentStock;
            item.CurrentStock -= line.Quantity;
            item.UpdatedAt = DateTime.UtcNow;

            _db.InventoryStockAdjustments.Add(new InventoryStockAdjustment
            {
                TenantId = GetEffectiveTenantId(),
                BranchId = dto.BranchId ?? _currentUser.BranchId,
                ItemId = item.Id,
                AdjustmentType = "ReturnToVendor",
                PreviousStock = prevStock,
                AdjustedQuantity = -line.Quantity,
                NewStock = item.CurrentStock,
                Reason = $"Debit Note {debitNoteNo} to {vendor.VendorName}: {line.Reason ?? "Returned to vendor"}",
                AdjustedAt = DateTime.UtcNow,
                AdjustedBy = _currentUser.UserId
            });
        }

        pReturn.TotalAmount = totalAmount;
        _db.InventoryPurchaseReturns.Add(pReturn);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Purchase return recorded & Debit Note generated successfully.", returnNumber = returnNo, debitNoteNumber = debitNoteNo });
    }

    // =========================================================================
    // 10. Sale Returns (Kit Return from Student or Staff)
    // =========================================================================

    [HttpGet("sale-returns")]
    public async Task<ActionResult<IEnumerable<InventorySaleReturnDto>>> GetSaleReturns(
        [FromQuery] Guid? studentId = null,
        [FromQuery] Guid? branchId = null)
    {
        var effBranchId = GetEffectiveBranchId(branchId);
        var q = _db.InventorySaleReturns
            .AsNoTracking()
            .Include(r => r.Student)
            .Include(r => r.Items).ThenInclude(i => i.Item)
            .AsQueryable();

        if (effBranchId.HasValue)
            q = q.Where(r => r.BranchId == null || r.BranchId == effBranchId);

        if (studentId.HasValue && studentId.Value != Guid.Empty)
            q = q.Where(r => r.StudentId == studentId.Value);

        var list = await q
            .OrderByDescending(r => r.ReturnDate)
            .Select(r => new InventorySaleReturnDto(
                r.Id,
                r.OutwardId,
                r.StudentId,
                r.ReturnedByName,
                r.DepartmentOrClass,
                r.ReturnNumber,
                r.ReturnDate,
                r.TotalAmount,
                r.RefundStatus,
                r.RefundPaymentMode,
                r.Remarks,
                r.BranchId,
                r.CreatedAt,
                r.Items.Select(it => new SaleReturnItemLineDetailDto(
                    it.Id,
                    it.ItemId,
                    it.Item != null ? it.Item.ItemName : "",
                    it.Item != null ? it.Item.ItemCode : "",
                    it.Quantity,
                    it.UnitPrice,
                    it.TotalAmount,
                    it.Condition,
                    it.Reason
                )).ToList()
            ))
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost("sale-returns")]
    public async Task<IActionResult> CreateSaleReturn([FromBody] CreateSaleReturnDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest("At least one item is required for sale return.");

        var returnNo = $"SR-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(100, 999)}";

        decimal totalAmount = 0;
        var sReturn = new InventorySaleReturn
        {
            TenantId = GetEffectiveTenantId(),
            BranchId = dto.BranchId ?? _currentUser.BranchId,
            OutwardId = dto.OutwardId,
            StudentId = dto.StudentId,
            ReturnedByName = dto.ReturnedByName.Trim(),
            DepartmentOrClass = dto.DepartmentOrClass?.Trim(),
            ReturnNumber = returnNo,
            ReturnDate = dto.ReturnDate,
            RefundStatus = dto.RefundStatus ?? "NoRefund",
            RefundPaymentMode = dto.RefundPaymentMode,
            Remarks = dto.Remarks?.Trim(),
            CreatedBy = _currentUser.UserId
        };

        foreach (var line in dto.Items)
        {
            var item = await _db.InventoryItems.FindAsync(line.ItemId);
            if (item == null)
                return BadRequest($"Item ID '{line.ItemId}' not found.");

            if (line.Quantity <= 0)
                return BadRequest($"Return quantity for item '{item.ItemName}' must be greater than 0.");

            var lineTotal = line.Quantity * line.UnitPrice;
            totalAmount += lineTotal;

            sReturn.Items.Add(new InventorySaleReturnItem
            {
                TenantId = GetEffectiveTenantId(),
                BranchId = dto.BranchId ?? _currentUser.BranchId,
                ItemId = line.ItemId,
                Quantity = line.Quantity,
                UnitPrice = line.UnitPrice,
                TotalAmount = lineTotal,
                Condition = line.Condition ?? "Good/Resellable",
                Reason = line.Reason?.Trim()
            });

            if (line.Condition == "Good/Resellable")
            {
                var prevStock = item.CurrentStock;
                item.CurrentStock += line.Quantity;
                item.UpdatedAt = DateTime.UtcNow;

                _db.InventoryStockAdjustments.Add(new InventoryStockAdjustment
                {
                    TenantId = GetEffectiveTenantId(),
                    BranchId = dto.BranchId ?? _currentUser.BranchId,
                    ItemId = item.Id,
                    AdjustmentType = "StudentKitReturn",
                    PreviousStock = prevStock,
                    AdjustedQuantity = line.Quantity,
                    NewStock = item.CurrentStock,
                    Reason = $"Kit Return {returnNo} from {dto.ReturnedByName}: {line.Reason ?? "Returned in good condition"}",
                    AdjustedAt = DateTime.UtcNow,
                    AdjustedBy = _currentUser.UserId
                });
            }
        }

        sReturn.TotalAmount = totalAmount;
        _db.InventorySaleReturns.Add(sReturn);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Kit / Sale return recorded successfully.", returnNumber = returnNo });
    }
}

// =========================================================================
// INVENTORY DTOs
// =========================================================================

public record InventoryDashboardDto(
    int TotalItemsCount,
    decimal TotalStockValuation,
    int LowStockCount,
    int OutOfStockCount,
    int InwardCountThisMonth,
    decimal InwardsAmountThisMonth,
    int OutwardCountThisMonth,
    decimal OutwardSalesThisMonth,
    List<InventoryItemSummaryDto> LowStockPreview
);

public record InventoryItemSummaryDto(
    Guid Id,
    string ItemCode,
    string ItemName,
    string CategoryName,
    string ItemType,
    string UnitOfMeasurement,
    decimal CurrentStock,
    decimal MinStockAlertLevel,
    decimal PurchasePrice,
    decimal SellingPrice,
    string? RackOrLocation
);

public record InventoryCategoryDto(
    Guid Id,
    string Name,
    string Code,
    string? Description,
    bool IsActive,
    int ActiveItemsCount,
    Guid? BranchId
);

public record CreateUpdateCategoryDto(
    string Name,
    string Code,
    string? Description,
    bool IsActive,
    Guid? BranchId
);

public record InventoryVendorDto(
    Guid Id,
    string VendorName,
    string? ContactPerson,
    string? Phone,
    string? Email,
    string? Address,
    string? Gstin,
    string? Pan,
    string? PaymentTerms,
    string? BankDetails,
    bool IsActive,
    Guid? BranchId,
    decimal TotalPurchased = 0,
    decimal TotalPaid = 0,
    decimal TotalReturns = 0,
    decimal BalanceDue = 0
);

public record CreateUpdateVendorDto(
    string VendorName,
    string? ContactPerson,
    string? Phone,
    string? Email,
    string? Address,
    string? Gstin,
    string? Pan,
    string? PaymentTerms,
    string? BankDetails,
    bool IsActive,
    Guid? BranchId
);

public record InventoryItemDto(
    Guid Id,
    Guid CategoryId,
    string CategoryName,
    string ItemCode,
    string ItemName,
    string ItemType,
    string UnitOfMeasurement,
    decimal PurchasePrice,
    decimal SellingPrice,
    decimal CurrentStock,
    decimal MinStockAlertLevel,
    string? RackOrLocation,
    string? Description,
    bool IsActive,
    Guid? BranchId,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record CreateUpdateItemDto(
    Guid CategoryId,
    string? ItemCode,
    string ItemName,
    string ItemType,
    string UnitOfMeasurement,
    decimal PurchasePrice,
    decimal SellingPrice,
    decimal InitialStock,
    decimal MinStockAlertLevel,
    string? RackOrLocation,
    string? Description,
    bool IsActive,
    Guid? BranchId
);

public record InventoryInwardDto(
    Guid Id,
    string InwardNumber,
    string? InvoiceBillNumber,
    DateTime InwardDate,
    Guid? VendorId,
    string VendorName,
    decimal TotalAmount,
    decimal DiscountAmount,
    decimal TaxAmount,
    decimal NetAmount,
    string PaymentStatus,
    string PaymentMode,
    string? Remarks,
    Guid? BranchId,
    DateTime CreatedAt,
    List<InventoryInwardItemDto> Items
);

public record InventoryInwardItemDto(
    Guid Id,
    Guid ItemId,
    string ItemName,
    string ItemCode,
    decimal Quantity,
    decimal UnitPrice,
    decimal TotalAmount,
    string? BatchOrSerialNo,
    string? Remarks
);

public record CreateInwardDto(
    Guid? VendorId,
    string? InvoiceBillNumber,
    DateTime? InwardDate,
    decimal DiscountAmount,
    decimal TaxAmount,
    string PaymentStatus,
    string PaymentMode,
    string? Remarks,
    Guid? BranchId,
    List<CreateInwardItemLineDto> Items
);

public record CreateInwardItemLineDto(
    Guid ItemId,
    decimal Quantity,
    decimal UnitPrice,
    string? BatchOrSerialNo,
    string? Remarks
);

public record InventoryOutwardDto(
    Guid Id,
    string IssueNumber,
    DateTime IssueDate,
    string IssueType,
    Guid? StudentId,
    string? StudentName,
    string? StudentRollNo,
    string IssuedToName,
    string? DepartmentOrClass,
    decimal TotalAmount,
    string PaymentStatus,
    string? PaymentMode,
    string? Remarks,
    Guid? BranchId,
    DateTime CreatedAt,
    List<InventoryOutwardItemDto> Items
);

public record InventoryOutwardItemDto(
    Guid Id,
    Guid ItemId,
    string ItemName,
    string ItemCode,
    decimal Quantity,
    decimal UnitPrice,
    decimal TotalAmount,
    string? Remarks
);

public record CreateOutwardDto(
    string IssueType,
    Guid? StudentId,
    string IssuedToName,
    string? DepartmentOrClass,
    DateTime? IssueDate,
    string PaymentStatus,
    string? PaymentMode,
    string? Remarks,
    Guid? BranchId,
    List<CreateOutwardItemLineDto> Items
);

public record CreateOutwardItemLineDto(
    Guid ItemId,
    decimal Quantity,
    decimal UnitPrice,
    string? Remarks
);

public record InventoryStockAdjustmentDto(
    Guid Id,
    Guid ItemId,
    string ItemName,
    string ItemCode,
    string AdjustmentType,
    decimal PreviousStock,
    decimal AdjustedQuantity,
    decimal NewStock,
    string? Reason,
    DateTime AdjustedAt
);

public record CreateStockAdjustmentDto(
    Guid ItemId,
    string AdjustmentType,
    decimal AdjustedQuantity,
    string? Reason
);

public record StudentLookupDto(
    Guid Id,
    string FullName,
    string RollNumber,
    string AdmissionNumber,
    string? PhoneNumber,
    string? ClassName,
    string? SectionName,
    Guid? ClassId = null
);

public record StaffLookupDto(
    Guid Id,
    string EmployeeCode,
    string FullName,
    string StaffType,
    string? Designation,
    string? Department,
    Guid? BranchId
);

public record VendorLedgerSummaryDto(
    Guid VendorId,
    string VendorName,
    string? ContactPerson,
    string? Phone,
    string? Email,
    string? Address,
    string? Gstin,
    string? Pan,
    string? PaymentTerms,
    string? BankDetails,
    decimal TotalPurchased,
    decimal TotalPaid,
    decimal TotalReturns,
    decimal BalanceDue,
    List<VendorLedgerEntryDto> Entries
);

public record VendorLedgerEntryDto(
    Guid Id,
    DateTime Date,
    string EntryType,
    string ReferenceNumber,
    string? BillNumber,
    string Description,
    decimal Debit,
    decimal Credit,
    decimal RunningBalance,
    string? PaymentMode,
    string? Remarks
);

public record VendorLedgerRawEntry(
    Guid Id,
    DateTime Date,
    string EntryType,
    string ReferenceNumber,
    string? BillNumber,
    string Description,
    decimal Debit,
    decimal Credit,
    string? PaymentMode,
    string? Remarks
);

public record RecordVendorPaymentDto(
    Guid VendorId,
    DateTime PaymentDate,
    decimal Amount,
    string PaymentMode,
    string? ReferenceNumber,
    string? BankName,
    string? Remarks,
    Guid? BranchId
);

public record VendorPaymentDto(
    Guid Id,
    Guid VendorId,
    string VendorName,
    string VoucherNumber,
    DateTime PaymentDate,
    decimal Amount,
    string PaymentMode,
    string? ReferenceNumber,
    string? BankName,
    string? Remarks,
    Guid? BranchId,
    DateTime CreatedAt
);

public record InventoryPurchaseReturnDto(
    Guid Id,
    Guid VendorId,
    string VendorName,
    Guid? InwardId,
    string ReturnNumber,
    string? DebitNoteNumber,
    DateTime ReturnDate,
    decimal TotalAmount,
    string RefundStatus,
    string? Remarks,
    Guid? BranchId,
    DateTime CreatedAt,
    List<PurchaseReturnItemLineDetailDto> Items
);

public record PurchaseReturnItemLineDetailDto(
    Guid Id,
    Guid ItemId,
    string ItemName,
    string ItemCode,
    decimal Quantity,
    decimal UnitPrice,
    decimal TotalAmount,
    string? Reason
);

public record CreatePurchaseReturnDto(
    Guid VendorId,
    Guid? InwardId,
    DateTime ReturnDate,
    string? Remarks,
    Guid? BranchId,
    List<PurchaseReturnItemLineDto> Items
);

public record PurchaseReturnItemLineDto(
    Guid ItemId,
    decimal Quantity,
    decimal UnitPrice,
    string? Reason
);

public record InventorySaleReturnDto(
    Guid Id,
    Guid? OutwardId,
    Guid? StudentId,
    string ReturnedByName,
    string? DepartmentOrClass,
    string ReturnNumber,
    DateTime ReturnDate,
    decimal TotalAmount,
    string RefundStatus,
    string? RefundPaymentMode,
    string? Remarks,
    Guid? BranchId,
    DateTime CreatedAt,
    List<SaleReturnItemLineDetailDto> Items
);

public record SaleReturnItemLineDetailDto(
    Guid Id,
    Guid ItemId,
    string ItemName,
    string ItemCode,
    decimal Quantity,
    decimal UnitPrice,
    decimal TotalAmount,
    string Condition,
    string? Reason
);

public record CreateSaleReturnDto(
    Guid? OutwardId,
    Guid? StudentId,
    string ReturnedByName,
    string? DepartmentOrClass,
    DateTime ReturnDate,
    string RefundStatus,
    string? RefundPaymentMode,
    string? Remarks,
    Guid? BranchId,
    List<SaleReturnItemLineDto> Items
);

public record SaleReturnItemLineDto(
    Guid ItemId,
    decimal Quantity,
    decimal UnitPrice,
    string Condition,
    string? Reason
);

