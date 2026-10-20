using IMSERP.Application.DTOs;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using IMSERP.Domain.Enums;
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
    public async Task<IActionResult> GetVendors(
        [FromQuery] Guid? branchId = null,
        [FromQuery] string? search = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 0,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDescending = false)
    {
        var effBranchId = GetEffectiveBranchId(branchId);
        var query = _db.InventoryVendors.AsNoTracking().AsQueryable();

        if (effBranchId.HasValue)
            query = query.Where(v => v.BranchId == null || v.BranchId == effBranchId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(v =>
                v.VendorName.ToLower().Contains(term) ||
                (v.ContactPerson != null && v.ContactPerson.ToLower().Contains(term)) ||
                (v.Phone != null && v.Phone.ToLower().Contains(term)) ||
                (v.Email != null && v.Email.ToLower().Contains(term)) ||
                (v.Gstin != null && v.Gstin.ToLower().Contains(term)) ||
                (v.Pan != null && v.Pan.ToLower().Contains(term)) ||
                (v.Address != null && v.Address.ToLower().Contains(term)));
        }

        var totalCount = await query.CountAsync();

        // Apply Sorting on entity fields
        query = (sortBy?.Trim().ToLowerInvariant()) switch
        {
            "name" or "vendorname" => sortDescending ? query.OrderByDescending(v => v.VendorName) : query.OrderBy(v => v.VendorName),
            "contact" or "contactperson" => sortDescending ? query.OrderByDescending(v => v.ContactPerson) : query.OrderBy(v => v.ContactPerson),
            "phone" => sortDescending ? query.OrderByDescending(v => v.Phone) : query.OrderBy(v => v.Phone),
            "email" => sortDescending ? query.OrderByDescending(v => v.Email) : query.OrderBy(v => v.Email),
            "gstin" => sortDescending ? query.OrderByDescending(v => v.Gstin) : query.OrderBy(v => v.Gstin),
            _ => query.OrderBy(v => v.VendorName)
        };

        if (pageSize > 0)
        {
            if (pageNumber < 1) pageNumber = 1;
            query = query.Skip((pageNumber - 1) * pageSize).Take(pageSize);
        }

        var vendors = await query.ToListAsync();
        var vendorIds = vendors.Select(v => v.Id).ToList();

        var inwardTotals = await _db.InventoryInwards
            .AsNoTracking()
            .Where(i => i.VendorId.HasValue && vendorIds.Contains(i.VendorId.Value))
            .GroupBy(i => i.VendorId!.Value)
            .Select(g => new { VendorId = g.Key, Total = g.Sum(x => x.NetAmount) })
            .ToDictionaryAsync(x => x.VendorId, x => x.Total);

        var payments = await _db.InventoryVendorPayments
            .AsNoTracking()
            .Where(p => vendorIds.Contains(p.VendorId))
            .ToListAsync();

        var paymentTotals = payments
            .Where(p => !string.Equals(p.PaymentType, "Refund", StringComparison.OrdinalIgnoreCase))
            .GroupBy(p => p.VendorId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        var refundTotals = payments
            .Where(p => string.Equals(p.PaymentType, "Refund", StringComparison.OrdinalIgnoreCase))
            .GroupBy(p => p.VendorId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

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
            var refunded = refundTotals.GetValueOrDefault(v.Id, 0);
            var returned = returnTotals.GetValueOrDefault(v.Id, 0);
            var netPaid = paid - refunded;
            var balanceDue = purchased - netPaid - returned;

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
                balanceDue,
                refunded
            );
        }).ToList();

        if (pageSize > 0)
        {
            return Ok(new PagedResult<InventoryVendorDto>(result, totalCount, pageNumber, pageSize));
        }

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
    public async Task<IActionResult> GetItems(
        [FromQuery] string? search = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] string? itemType = null,
        [FromQuery] bool? lowStockOnly = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] bool activeOnly = true,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 0,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDescending = false)
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

        var totalCount = await query.CountAsync();

        // Apply Sorting
        query = (sortBy?.Trim().ToLowerInvariant()) switch
        {
            "code" or "itemcode" => sortDescending ? query.OrderByDescending(i => i.ItemCode) : query.OrderBy(i => i.ItemCode),
            "name" or "itemname" => sortDescending ? query.OrderByDescending(i => i.ItemName) : query.OrderBy(i => i.ItemName),
            "category" or "categoryname" => sortDescending ? query.OrderByDescending(i => i.Category != null ? i.Category.Name : "") : query.OrderBy(i => i.Category != null ? i.Category.Name : ""),
            "type" or "itemtype" => sortDescending ? query.OrderByDescending(i => i.ItemType) : query.OrderBy(i => i.ItemType),
            "uom" or "unitofmeasurement" => sortDescending ? query.OrderByDescending(i => i.UnitOfMeasurement) : query.OrderBy(i => i.UnitOfMeasurement),
            "stock" or "currentstock" => sortDescending ? query.OrderByDescending(i => i.CurrentStock) : query.OrderBy(i => i.CurrentStock),
            "purchaseprice" or "purchaserate" => sortDescending ? query.OrderByDescending(i => i.PurchasePrice) : query.OrderBy(i => i.PurchasePrice),
            "sellingprice" or "rate" => sortDescending ? query.OrderByDescending(i => i.SellingPrice) : query.OrderBy(i => i.SellingPrice),
            "minstockalertlevel" or "alertlevel" => sortDescending ? query.OrderByDescending(i => i.MinStockAlertLevel) : query.OrderBy(i => i.MinStockAlertLevel),
            "rack" or "rackorlocation" => sortDescending ? query.OrderByDescending(i => i.RackOrLocation) : query.OrderBy(i => i.RackOrLocation),
            _ => query.OrderBy(i => i.Category != null ? i.Category.Name : "").ThenBy(i => i.ItemName)
        };

        if (pageSize > 0)
        {
            if (pageNumber < 1) pageNumber = 1;
            query = query.Skip((pageNumber - 1) * pageSize).Take(pageSize);
        }

        var items = await query
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

        if (pageSize > 0)
        {
            return Ok(new PagedResult<InventoryItemDto>(items, totalCount, pageNumber, pageSize));
        }

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
    public async Task<IActionResult> GetInwards(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] Guid? vendorId = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] string? search = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 0,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDescending = false)
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

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(i =>
                i.InwardNumber.ToLower().Contains(term) ||
                (i.InvoiceBillNumber != null && i.InvoiceBillNumber.ToLower().Contains(term)) ||
                (i.Vendor != null && i.Vendor.VendorName.ToLower().Contains(term)) ||
                (i.Remarks != null && i.Remarks.ToLower().Contains(term)) ||
                i.Items.Any(line => line.Item != null && line.Item.ItemName.ToLower().Contains(term)));
        }

        var totalCount = await query.CountAsync();

        // Apply Sorting
        query = (sortBy?.Trim().ToLowerInvariant()) switch
        {
            "inwardnumber" or "number" => sortDescending ? query.OrderByDescending(i => i.InwardNumber) : query.OrderBy(i => i.InwardNumber),
            "date" or "inwarddate" => sortDescending ? query.OrderByDescending(i => i.InwardDate) : query.OrderBy(i => i.InwardDate),
            "invoice" or "invoicebillnumber" => sortDescending ? query.OrderByDescending(i => i.InvoiceBillNumber) : query.OrderBy(i => i.InvoiceBillNumber),
            "vendor" or "vendorname" => sortDescending ? query.OrderByDescending(i => i.Vendor != null ? i.Vendor.VendorName : "") : query.OrderBy(i => i.Vendor != null ? i.Vendor.VendorName : ""),
            "amount" or "netamount" => sortDescending ? query.OrderByDescending(i => i.NetAmount) : query.OrderBy(i => i.NetAmount),
            "status" or "paymentstatus" => sortDescending ? query.OrderByDescending(i => i.PaymentStatus) : query.OrderBy(i => i.PaymentStatus),
            "mode" or "paymentmode" => sortDescending ? query.OrderByDescending(i => i.PaymentMode) : query.OrderBy(i => i.PaymentMode),
            _ => query.OrderByDescending(i => i.InwardDate)
        };

        if (pageSize > 0)
        {
            if (pageNumber < 1) pageNumber = 1;
            query = query.Skip((pageNumber - 1) * pageSize).Take(pageSize);
        }

        var inwards = await query
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

        if (pageSize > 0)
        {
            return Ok(new PagedResult<InventoryInwardDto>(inwards, totalCount, pageNumber, pageSize));
        }

        return Ok(inwards);
    }

    private static string GetCurrentFinancialYearCode()
    {
        var now = DateTime.UtcNow;
        int startYear = now.Month >= 4 ? now.Year : now.Year - 1;
        int endYear = startYear + 1;
        return $"{startYear % 100:D2}{endYear % 100:D2}";
    }

    private static string FormatBillNumber(string? prefix, int number, int padding, bool includeFy)
    {
        var cleanPrefix = string.IsNullOrWhiteSpace(prefix) ? "BILL-" : prefix.Trim();
        var numStr = number.ToString().PadLeft(Math.Max(1, padding), '0');
        if (includeFy)
        {
            var fy = GetCurrentFinancialYearCode();
            return $"{cleanPrefix}{fy}-{numStr}";
        }
        return $"{cleanPrefix}{numStr}";
    }

    [HttpGet("bill-sequence")]
    public async Task<ActionResult<InventoryBillSequenceDto>> GetBillSequence([FromQuery] Guid? branchId = null)
    {
        var tenantId = GetEffectiveTenantId();
        var effBranchId = GetEffectiveBranchId(branchId);

        var seq = await _db.InventoryBillSequences
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && (s.BranchId == null || s.BranchId == effBranchId));

        if (seq == null)
        {
            seq = new InventoryBillSequence
            {
                TenantId = tenantId,
                BranchId = effBranchId,
                Prefix = "BILL-",
                NextNumber = 1,
                PaddingDigits = 4,
                IncludeFinancialYear = true,
                UpdatedAt = DateTime.UtcNow
            };
            _db.InventoryBillSequences.Add(seq);
            await _db.SaveChangesAsync();
        }

        var preview = FormatBillNumber(seq.Prefix, seq.NextNumber, seq.PaddingDigits, seq.IncludeFinancialYear);
        return Ok(new InventoryBillSequenceDto(
            seq.Id,
            seq.Prefix,
            seq.NextNumber,
            seq.PaddingDigits,
            seq.IncludeFinancialYear,
            preview
        ));
    }

    [HttpPost("bill-sequence")]
    public async Task<ActionResult<InventoryBillSequenceDto>> UpdateBillSequence([FromBody] UpdateInventoryBillSequenceDto dto)
    {
        var tenantId = GetEffectiveTenantId();
        var effBranchId = GetEffectiveBranchId(dto.BranchId);

        var seq = await _db.InventoryBillSequences
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && (s.BranchId == null || s.BranchId == effBranchId));

        if (seq == null)
        {
            seq = new InventoryBillSequence
            {
                TenantId = tenantId,
                BranchId = effBranchId
            };
            _db.InventoryBillSequences.Add(seq);
        }

        seq.Prefix = string.IsNullOrWhiteSpace(dto.Prefix) ? "BILL-" : dto.Prefix.Trim();
        seq.NextNumber = Math.Max(1, dto.NextNumber);
        seq.PaddingDigits = Math.Clamp(dto.PaddingDigits, 1, 8);
        seq.IncludeFinancialYear = dto.IncludeFinancialYear;
        seq.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        var preview = FormatBillNumber(seq.Prefix, seq.NextNumber, seq.PaddingDigits, seq.IncludeFinancialYear);
        return Ok(new InventoryBillSequenceDto(
            seq.Id,
            seq.Prefix,
            seq.NextNumber,
            seq.PaddingDigits,
            seq.IncludeFinancialYear,
            preview
        ));
    }

    [HttpPost("inwards")]
    public async Task<IActionResult> CreateInward([FromBody] CreateInwardDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest("At least one item line is required for stock inward.");

        var tenantId = GetEffectiveTenantId();
        var branchId = dto.BranchId ?? _currentUser.BranchId;
        var inwardNumber = $"GRN-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(100, 999)}";

        // Auto-assign or sync with Bill Sequencer
        var seq = await _db.InventoryBillSequences
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && (s.BranchId == null || s.BranchId == branchId));

        if (seq == null)
        {
            seq = new InventoryBillSequence
            {
                TenantId = tenantId,
                BranchId = branchId,
                Prefix = "BILL-",
                NextNumber = 1,
                PaddingDigits = 4,
                IncludeFinancialYear = true,
                UpdatedAt = DateTime.UtcNow
            };
            _db.InventoryBillSequences.Add(seq);
        }

        string billNumber = dto.InvoiceBillNumber?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(billNumber))
        {
            billNumber = FormatBillNumber(seq.Prefix, seq.NextNumber, seq.PaddingDigits, seq.IncludeFinancialYear);
        }

        // Always advance sequencer counter in DB so the next inward gets the subsequent number
        seq.NextNumber++;
        seq.UpdatedAt = DateTime.UtcNow;

        decimal totalAmount = 0;

        var inward = new InventoryInward
        {
            TenantId = tenantId,
            BranchId = branchId,
            VendorId = dto.VendorId,
            InwardNumber = inwardNumber,
            InvoiceBillNumber = billNumber,
            InwardDate = dto.InwardDate.HasValue
                ? (dto.InwardDate.Value.TimeOfDay.TotalSeconds > 0 ? dto.InwardDate.Value : dto.InwardDate.Value.Date.Add(DateTime.UtcNow.TimeOfDay))
                : DateTime.UtcNow,
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

        return Ok(new { message = "Stock inward saved and item quantities updated successfully.", inwardNumber, invoiceBillNumber = billNumber });
    }

    // =========================================================================
    // 6. Stock Outward & Distribution (Staff Issue + Student Kit Sales)
    // =========================================================================

    [HttpGet("outwards")]
    public async Task<IActionResult> GetOutwards(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] string? issueType = null,
        [FromQuery] Guid? studentId = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] string? search = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 0,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDescending = false)
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

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(o =>
                o.IssueNumber.ToLower().Contains(term) ||
                o.IssuedToName.ToLower().Contains(term) ||
                (o.DepartmentOrClass != null && o.DepartmentOrClass.ToLower().Contains(term)) ||
                (o.Remarks != null && o.Remarks.ToLower().Contains(term)) ||
                (o.Student != null && (o.Student.StudentName.ToLower().Contains(term) || o.Student.RollNumber.ToLower().Contains(term))) ||
                o.Items.Any(line => line.Item != null && line.Item.ItemName.ToLower().Contains(term)));
        }

        var totalCount = await query.CountAsync();

        // Apply Sorting
        query = (sortBy?.Trim().ToLowerInvariant()) switch
        {
            "issuenumber" or "number" => sortDescending ? query.OrderByDescending(o => o.IssueNumber) : query.OrderBy(o => o.IssueNumber),
            "date" or "issuedate" => sortDescending ? query.OrderByDescending(o => o.IssueDate) : query.OrderBy(o => o.IssueDate),
            "type" or "issuetype" => sortDescending ? query.OrderByDescending(o => o.IssueType) : query.OrderBy(o => o.IssueType),
            "name" or "recipient" or "issuedtoname" => sortDescending ? query.OrderByDescending(o => o.IssuedToName) : query.OrderBy(o => o.IssuedToName),
            "class" or "dept" or "departmentorclass" => sortDescending ? query.OrderByDescending(o => o.DepartmentOrClass) : query.OrderBy(o => o.DepartmentOrClass),
            "amount" or "totalamount" => sortDescending ? query.OrderByDescending(o => o.TotalAmount) : query.OrderBy(o => o.TotalAmount),
            "status" or "paymentstatus" => sortDescending ? query.OrderByDescending(o => o.PaymentStatus) : query.OrderBy(o => o.PaymentStatus),
            _ => query.OrderByDescending(o => o.IssueDate)
        };

        if (pageSize > 0)
        {
            if (pageNumber < 1) pageNumber = 1;
            query = query.Skip((pageNumber - 1) * pageSize).Take(pageSize);
        }

        var outwards = await query
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

        if (pageSize > 0)
        {
            return Ok(new PagedResult<InventoryOutwardDto>(outwards, totalCount, pageNumber, pageSize));
        }

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

        // If marked as 'AddedToFeeBill' or 'Unpaid' for a student, auto-generate a pending FeeInvoice attached to the student
        if ((dto.PaymentStatus == "AddedToFeeBill" || dto.PaymentStatus == "Unpaid") && dto.StudentId.HasValue && totalAmount > 0)
        {
            var student = await _db.Students
                .Include(s => s.Class)
                .Include(s => s.Section)
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == dto.StudentId.Value && s.TenantId == tenantId);

            var storeInvoice = new FeeInvoice
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BranchId = outward.BranchId ?? student?.BranchId,
                StudentId = dto.StudentId.Value,
                InvoiceNumber = $"INV-STK-{DateTime.UtcNow:yyyyMMddHHmmss}",
                Title = $"Store Issue - Uniform & Stationery ({issueNumber})",
                InvoiceCategory = "Inventory",
                TotalAmount = totalAmount,
                PaidAmount = 0,
                DueDate = (dto.IssueDate ?? DateTime.UtcNow).AddDays(15),
                Status = InvoiceStatus.Pending,
                ClassId = student?.ClassId,
                SectionId = student?.SectionId,
                ClassName = student?.Class?.Name,
                SectionName = student?.Section?.Name,
                CreatedAt = DateTime.UtcNow
            };

            foreach (var oi in outward.Items)
            {
                var invItem = await _db.InventoryItems.FindAsync(oi.ItemId);
                storeInvoice.Items.Add(new FeeInvoiceItem
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    InvoiceId = storeInvoice.Id,
                    HeadName = invItem?.ItemName ?? "Store Item",
                    Amount = oi.TotalAmount,
                    PaidAmount = 0,
                    CreatedAt = DateTime.UtcNow
                });
            }

            _db.FeeInvoices.Add(storeInvoice);
        }

        await _db.SaveChangesAsync();

        return Ok(new { message = "Stock issued / distributed successfully.", issueNumber });
    }

    [HttpPost("outwards/{id}/cancel")]
    public async Task<IActionResult> CancelOutward(Guid id, [FromBody] CancelOutwardDto? dto = null)
    {
        var tenantId = GetEffectiveTenantId();
        var outward = await _db.InventoryOutwards
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id && o.TenantId == tenantId);

        if (outward == null)
            return NotFound(new { message = "Stock outward issue record not found." });

        if (outward.PaymentStatus == "Cancelled")
            return BadRequest(new { message = "This outward distribution is already marked as Cancelled." });

        // 1. Restore stock in inventory
        foreach (var lineItem in outward.Items)
        {
            var invItem = await _db.InventoryItems.FindAsync(lineItem.ItemId);
            if (invItem != null)
            {
                var stockBefore = invItem.CurrentStock;
                invItem.CurrentStock += lineItem.Quantity;
                invItem.UpdatedAt = DateTime.UtcNow;

                _db.InventoryStockAdjustments.Add(new InventoryStockAdjustment
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = outward.BranchId,
                    ItemId = invItem.Id,
                    AdjustmentType = "PhysicalAuditCorrection",
                    PreviousStock = stockBefore,
                    AdjustedQuantity = lineItem.Quantity,
                    NewStock = invItem.CurrentStock,
                    Reason = $"Restored via Outward Issue Cancellation ({outward.IssueNumber})",
                    AdjustedAt = DateTime.UtcNow,
                    AdjustedBy = _currentUser.UserId
                });
            }
        }

        // 2. Mark outward as cancelled
        outward.PaymentStatus = "Cancelled";
        outward.Remarks = string.IsNullOrWhiteSpace(outward.Remarks)
            ? $"[CANCELLED & STOCK RESTORED on {DateTime.UtcNow:yyyy-MM-dd}] Reason: {dto?.Reason ?? "Cancelled by user"}"
            : $"{outward.Remarks} [CANCELLED & STOCK RESTORED on {DateTime.UtcNow:yyyy-MM-dd}: {dto?.Reason ?? "Cancelled"}]";

        // 3. If student had a pending kit FeeInvoice, cancel it
        if (outward.StudentId.HasValue)
        {
            var kitInvoices = await _db.FeeInvoices
                .Where(i => i.StudentId == outward.StudentId.Value &&
                            i.TenantId == tenantId &&
                            i.InvoiceCategory == "Inventory" &&
                            i.Status == InvoiceStatus.Pending &&
                            (i.Title.Contains(outward.IssueNumber) || i.InvoiceNumber.Contains(outward.IssueNumber) || i.Title.Contains("Admission Books")))
                .ToListAsync();

            foreach (var inv in kitInvoices)
            {
                inv.Status = InvoiceStatus.Cancelled;
                inv.CancellationReason = $"Outward issue cancelled: {outward.IssueNumber}";
                inv.CancelledAt = DateTime.UtcNow;
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = $"Stock outward {outward.IssueNumber} cancelled and items restored to inventory successfully." });
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
        [FromQuery] DateTime? endDate = null,
        [FromQuery] string? search = null,
        [FromQuery] string? entryType = null,
        [FromQuery] string? paymentMode = null,
        [FromQuery] string? sortBy = "date",
        [FromQuery] string? sortDirection = "desc",
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] Guid? branchId = null)
    {
        var effBranchId = GetEffectiveBranchId(branchId);
        var vendor = await _db.InventoryVendors.AsNoTracking().FirstOrDefaultAsync(v => v.Id == id);
        if (vendor == null)
            return NotFound("Vendor not found.");

        // Optimized direct SQL Aggregates for Lifetime Totals (sub-millisecond indexed queries)
        var totalPurchased = await _db.InventoryInwards
            .AsNoTracking()
            .Where(i => i.VendorId == id && (!effBranchId.HasValue || i.BranchId == null || i.BranchId == effBranchId.Value))
            .SumAsync(i => (decimal?)i.NetAmount) ?? 0m;

        var totalPaid = await _db.InventoryVendorPayments
            .AsNoTracking()
            .Where(p => p.VendorId == id && (!effBranchId.HasValue || p.BranchId == null || p.BranchId == effBranchId.Value) && p.PaymentType != "Refund")
            .SumAsync(p => (decimal?)p.Amount) ?? 0m;

        var totalRefunds = await _db.InventoryVendorPayments
            .AsNoTracking()
            .Where(p => p.VendorId == id && (!effBranchId.HasValue || p.BranchId == null || p.BranchId == effBranchId.Value) && p.PaymentType == "Refund")
            .SumAsync(p => (decimal?)p.Amount) ?? 0m;

        var totalReturns = await _db.InventoryPurchaseReturns
            .AsNoTracking()
            .Where(r => r.VendorId == id && (!effBranchId.HasValue || r.BranchId == null || r.BranchId == effBranchId.Value))
            .SumAsync(r => (decimal?)r.TotalAmount) ?? 0m;

        var balanceDue = totalPurchased - totalPaid + totalRefunds - totalReturns;

        // Optimized lean projections for transactions (no heavy entity graphs)
        var allInwards = await _db.InventoryInwards
            .AsNoTracking()
            .Where(i => i.VendorId == id && (!effBranchId.HasValue || i.BranchId == null || i.BranchId == effBranchId.Value))
            .Select(i => new {
                i.Id,
                Date = i.InwardDate,
                i.InwardNumber,
                i.InvoiceBillNumber,
                ItemsSummary = i.Items.Select(it => (it.Item != null ? it.Item.ItemName : "Item") + " x" + it.Quantity).ToList(),
                Debit = 0m,
                Credit = i.NetAmount,
                i.PaymentMode,
                i.Remarks,
                i.CreatedAt
            })
            .ToListAsync();

        var allPayments = await _db.InventoryVendorPayments
            .AsNoTracking()
            .Where(p => p.VendorId == id && (!effBranchId.HasValue || p.BranchId == null || p.BranchId == effBranchId.Value))
            .Select(p => new {
                p.Id,
                Date = p.PaymentDate,
                p.PaymentType,
                p.VoucherNumber,
                p.ReferenceNumber,
                p.Amount,
                p.PaymentMode,
                p.Remarks,
                p.CreatedAt
            })
            .ToListAsync();

        var allReturns = await _db.InventoryPurchaseReturns
            .AsNoTracking()
            .Where(r => r.VendorId == id && (!effBranchId.HasValue || r.BranchId == null || r.BranchId == effBranchId.Value))
            .Select(r => new {
                r.Id,
                Date = r.ReturnDate,
                ReferenceNumber = r.DebitNoteNumber ?? r.ReturnNumber,
                r.TotalAmount,
                ItemsSummary = r.Items.Select(it => (it.Item != null ? it.Item.ItemName : "Item") + " x" + it.Quantity).ToList(),
                r.Remarks,
                r.CreatedAt
            })
            .ToListAsync();

        static DateTime ResolveTransactionDateTime(DateTime date, DateTime? createdAt)
        {
            DateTime resolved;
            if (date.TimeOfDay.TotalSeconds > 0)
            {
                resolved = date;
            }
            else if (createdAt.HasValue)
            {
                resolved = date.Date.Add(createdAt.Value.TimeOfDay);
            }
            else
            {
                resolved = date;
            }

            return DateTime.SpecifyKind(resolved, DateTimeKind.Utc);
        }

        var rawEntries = new List<VendorLedgerRawEntry>(allInwards.Count + allPayments.Count + allReturns.Count);

        foreach (var inw in allInwards)
        {
            var itemsSummary = inw.ItemsSummary.Count > 0
                ? string.Join(", ", inw.ItemsSummary)
                : "Inventory Goods Received";

            rawEntries.Add(new VendorLedgerRawEntry(
                inw.Id,
                ResolveTransactionDateTime(inw.Date, inw.CreatedAt),
                "InwardPurchase",
                inw.InwardNumber,
                inw.InvoiceBillNumber,
                $"Bill/GRN: {inw.InvoiceBillNumber ?? inw.InwardNumber} — {itemsSummary}",
                0m,
                inw.Credit,
                inw.PaymentMode,
                inw.Remarks,
                inw.CreatedAt
            ));
        }

        foreach (var pay in allPayments)
        {
            var isRefund = string.Equals(pay.PaymentType, "Refund", StringComparison.OrdinalIgnoreCase);
            if (isRefund)
            {
                rawEntries.Add(new VendorLedgerRawEntry(
                    pay.Id,
                    ResolveTransactionDateTime(pay.Date, pay.CreatedAt),
                    "VendorRefund",
                    pay.VoucherNumber,
                    null,
                    $"Vendor Refund Received via {pay.PaymentMode} {(string.IsNullOrWhiteSpace(pay.ReferenceNumber) ? "" : $"[Ref/UTR: {pay.ReferenceNumber}]")}".Trim(),
                    0m,
                    pay.Amount,
                    pay.PaymentMode,
                    pay.Remarks,
                    pay.CreatedAt
                ));
            }
            else
            {
                rawEntries.Add(new VendorLedgerRawEntry(
                    pay.Id,
                    ResolveTransactionDateTime(pay.Date, pay.CreatedAt),
                    "VendorPayment",
                    pay.VoucherNumber,
                    null,
                    $"Payment Made via {pay.PaymentMode} {(string.IsNullOrWhiteSpace(pay.ReferenceNumber) ? "" : $"[Ref/UTR: {pay.ReferenceNumber}]")}".Trim(),
                    pay.Amount,
                    0m,
                    pay.PaymentMode,
                    pay.Remarks,
                    pay.CreatedAt
                ));
            }
        }

        foreach (var ret in allReturns)
        {
            var returnItems = ret.ItemsSummary.Count > 0
                ? string.Join(", ", ret.ItemsSummary)
                : "Items Returned";

            rawEntries.Add(new VendorLedgerRawEntry(
                ret.Id,
                ResolveTransactionDateTime(ret.Date, ret.CreatedAt),
                "PurchaseReturn",
                ret.ReferenceNumber,
                null,
                $"Debit Note: {ret.ReferenceNumber} — {returnItems}",
                ret.TotalAmount,
                0m,
                null,
                ret.Remarks,
                ret.CreatedAt
            ));
        }

        // 1. Sort chronologically to compute true running balances
        var chronological = rawEntries
            .OrderBy(e => e.Date)
            .ThenBy(e => e.CreatedAt ?? DateTime.MinValue)
            .ThenBy(e => e.Id)
            .ToList();

        decimal running = 0m;
        var allComputed = new List<VendorLedgerEntryDto>(chronological.Count);
        foreach (var e in chronological)
        {
            running += (e.Credit - e.Debit);
            allComputed.Add(new VendorLedgerEntryDto(
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

        // 2. Server-side Filtering
        IEnumerable<VendorLedgerEntryDto> query = allComputed;

        if (startDate.HasValue)
            query = query.Where(e => e.Date >= startDate.Value.Date);

        if (endDate.HasValue)
            query = query.Where(e => e.Date <= endDate.Value.Date.AddDays(1).AddTicks(-1));

        if (!string.IsNullOrWhiteSpace(entryType) && !string.Equals(entryType, "ALL", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(e => string.Equals(e.EntryType, entryType, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(paymentMode) && !string.Equals(paymentMode, "ALL", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(e => string.Equals(e.PaymentMode, paymentMode, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(e =>
                (e.ReferenceNumber != null && e.ReferenceNumber.Contains(term, StringComparison.OrdinalIgnoreCase)) ||
                (e.BillNumber != null && e.BillNumber.Contains(term, StringComparison.OrdinalIgnoreCase)) ||
                (e.Description != null && e.Description.Contains(term, StringComparison.OrdinalIgnoreCase)) ||
                (e.Remarks != null && e.Remarks.Contains(term, StringComparison.OrdinalIgnoreCase)) ||
                (e.PaymentMode != null && e.PaymentMode.Contains(term, StringComparison.OrdinalIgnoreCase))
            );
        }

        var totalCount = query.Count();

        // 3. Server-side Header Sorting
        var isDesc = string.Equals(sortDirection, "desc", StringComparison.OrdinalIgnoreCase);
        query = (sortBy?.ToLower()) switch
        {
            "date" => isDesc ? query.OrderByDescending(e => e.Date) : query.OrderBy(e => e.Date),
            "entrytype" or "type" => isDesc ? query.OrderByDescending(e => e.EntryType) : query.OrderBy(e => e.EntryType),
            "referencenumber" or "ref" or "vouchernumber" => isDesc ? query.OrderByDescending(e => e.ReferenceNumber) : query.OrderBy(e => e.ReferenceNumber),
            "description" or "particulars" => isDesc ? query.OrderByDescending(e => e.Description) : query.OrderBy(e => e.Description),
            "debit" => isDesc ? query.OrderByDescending(e => e.Debit) : query.OrderBy(e => e.Debit),
            "credit" => isDesc ? query.OrderByDescending(e => e.Credit) : query.OrderBy(e => e.Credit),
            "runningbalance" or "balance" => isDesc ? query.OrderByDescending(e => e.RunningBalance) : query.OrderBy(e => e.RunningBalance),
            _ => isDesc ? query.OrderByDescending(e => e.Date) : query.OrderBy(e => e.Date)
        };

        // 4. Server-side Pagination
        if (pageNumber < 1) pageNumber = 1;
        if (pageSize < 1) pageSize = 10;
        if (pageSize > 500) pageSize = 500;

        var pagedEntries = query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        if (totalPages < 1) totalPages = 1;

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
            pagedEntries,
            totalRefunds,
            totalCount,
            pageNumber,
            pageSize,
            totalPages
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

        var isRefund = string.Equals(dto.PaymentType, "Refund", StringComparison.OrdinalIgnoreCase);
        var prefix = isRefund ? "VR" : "VP";
        var voucherNo = $"{prefix}-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(100, 999)}";

        var payment = new InventoryVendorPayment
        {
            TenantId = GetEffectiveTenantId(),
            BranchId = dto.BranchId ?? _currentUser.BranchId,
            VendorId = dto.VendorId,
            VoucherNumber = voucherNo,
            PaymentDate = dto.PaymentDate.TimeOfDay.TotalSeconds > 0
                ? dto.PaymentDate
                : dto.PaymentDate.Date.Add(DateTime.UtcNow.TimeOfDay),
            Amount = dto.Amount,
            PaymentMode = dto.PaymentMode ?? "Cash",
            PaymentType = isRefund ? "Refund" : "Disbursement",
            ReferenceNumber = dto.ReferenceNumber?.Trim(),
            BankName = dto.BankName?.Trim(),
            Remarks = dto.Remarks?.Trim(),
            CreatedBy = _currentUser.UserId
        };

        _db.InventoryVendorPayments.Add(payment);
        await _db.SaveChangesAsync();

        var msg = isRefund
            ? $"Vendor refund voucher {voucherNo} for ₹{dto.Amount} successfully recorded and credited to account."
            : "Vendor payment recorded successfully.";

        return Ok(new { message = msg, voucherNumber = voucherNo });
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
                p.CreatedAt,
                p.PaymentType
            ))
            .ToListAsync();

        return Ok(list);
    }

    // =========================================================================
    // 9. Purchase Returns (Debit Notes)
    // =========================================================================

    [HttpGet("purchase-returns")]
    public async Task<IActionResult> GetPurchaseReturns(
        [FromQuery] Guid? vendorId = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] string? search = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 0,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDescending = false)
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

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            q = q.Where(r =>
                r.ReturnNumber.ToLower().Contains(term) ||
                r.DebitNoteNumber.ToLower().Contains(term) ||
                (r.Vendor != null && r.Vendor.VendorName.ToLower().Contains(term)) ||
                (r.Remarks != null && r.Remarks.ToLower().Contains(term)) ||
                r.Items.Any(line => line.Item != null && line.Item.ItemName.ToLower().Contains(term)));
        }

        var totalCount = await q.CountAsync();

        q = (sortBy?.Trim().ToLowerInvariant()) switch
        {
            "returndate" or "date" => sortDescending ? q.OrderByDescending(r => r.ReturnDate) : q.OrderBy(r => r.ReturnDate),
            "debitnote" or "debitnotenumber" or "code" => sortDescending ? q.OrderByDescending(r => r.DebitNoteNumber) : q.OrderBy(r => r.DebitNoteNumber),
            "vendor" or "vendorname" => sortDescending ? q.OrderByDescending(r => r.Vendor != null ? r.Vendor.VendorName : "") : q.OrderBy(r => r.Vendor != null ? r.Vendor.VendorName : ""),
            "amount" or "totalamount" => sortDescending ? q.OrderByDescending(r => r.TotalAmount) : q.OrderBy(r => r.TotalAmount),
            "status" or "refundstatus" => sortDescending ? q.OrderByDescending(r => r.RefundStatus) : q.OrderBy(r => r.RefundStatus),
            _ => q.OrderByDescending(r => r.ReturnDate)
        };

        if (pageSize > 0)
        {
            if (pageNumber < 1) pageNumber = 1;
            q = q.Skip((pageNumber - 1) * pageSize).Take(pageSize);
        }

        var list = await q
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

        if (pageSize > 0)
        {
            return Ok(new PagedResult<InventoryPurchaseReturnDto>(list, totalCount, pageNumber, pageSize));
        }

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
    public async Task<IActionResult> GetSaleReturns(
        [FromQuery] Guid? studentId = null,
        [FromQuery] Guid? branchId = null,
        [FromQuery] string? search = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 0,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDescending = false)
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

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            q = q.Where(r =>
                r.ReturnNumber.ToLower().Contains(term) ||
                r.ReturnedByName.ToLower().Contains(term) ||
                (r.DepartmentOrClass != null && r.DepartmentOrClass.ToLower().Contains(term)) ||
                (r.Remarks != null && r.Remarks.ToLower().Contains(term)) ||
                r.Items.Any(line => line.Item != null && line.Item.ItemName.ToLower().Contains(term)));
        }

        var totalCount = await q.CountAsync();

        q = (sortBy?.Trim().ToLowerInvariant()) switch
        {
            "returndate" or "date" => sortDescending ? q.OrderByDescending(r => r.ReturnDate) : q.OrderBy(r => r.ReturnDate),
            "returnnumber" or "number" or "code" => sortDescending ? q.OrderByDescending(r => r.ReturnNumber) : q.OrderBy(r => r.ReturnNumber),
            "name" or "returnedby" or "returnedbyname" => sortDescending ? q.OrderByDescending(r => r.ReturnedByName) : q.OrderBy(r => r.ReturnedByName),
            "class" or "dept" or "departmentorclass" => sortDescending ? q.OrderByDescending(r => r.DepartmentOrClass) : q.OrderBy(r => r.DepartmentOrClass),
            "amount" or "totalamount" => sortDescending ? q.OrderByDescending(r => r.TotalAmount) : q.OrderBy(r => r.TotalAmount),
            "status" or "refundstatus" => sortDescending ? q.OrderByDescending(r => r.RefundStatus) : q.OrderBy(r => r.RefundStatus),
            _ => q.OrderByDescending(r => r.ReturnDate)
        };

        if (pageSize > 0)
        {
            if (pageNumber < 1) pageNumber = 1;
            q = q.Skip((pageNumber - 1) * pageSize).Take(pageSize);
        }

        var list = await q
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

        if (pageSize > 0)
        {
            return Ok(new PagedResult<InventorySaleReturnDto>(list, totalCount, pageNumber, pageSize));
        }

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
    decimal BalanceDue = 0,
    decimal TotalRefunds = 0
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
    List<VendorLedgerEntryDto> Entries,
    decimal TotalRefunds = 0,
    int TotalCount = 0,
    int PageNumber = 1,
    int PageSize = 10,
    int TotalPages = 1
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
    string? Remarks,
    DateTime? CreatedAt = null
);

public record RecordVendorPaymentDto(
    Guid VendorId,
    DateTime PaymentDate,
    decimal Amount,
    string PaymentMode,
    string? ReferenceNumber,
    string? BankName,
    string? Remarks,
    Guid? BranchId,
    string? PaymentType = "Disbursement"
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
    DateTime CreatedAt,
    string PaymentType = "Disbursement"
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

public record CancelOutwardDto(
    string? Reason
);

public record InventoryBillSequenceDto(
    Guid Id,
    string Prefix,
    int NextNumber,
    int PaddingDigits,
    bool IncludeFinancialYear,
    string NextBillNumberPreview
);

public record UpdateInventoryBillSequenceDto(
    string Prefix,
    int NextNumber,
    int PaddingDigits,
    bool IncludeFinancialYear,
    Guid? BranchId
);


