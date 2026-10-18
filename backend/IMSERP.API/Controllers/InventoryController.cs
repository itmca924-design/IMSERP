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
            .Select(v => new InventoryVendorDto(
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
                v.BranchId
            ))
            .ToListAsync();

        return Ok(vendors);
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
    Guid? BranchId
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
