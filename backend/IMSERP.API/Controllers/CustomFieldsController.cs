using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using IMSERP.Application.Interfaces;
using IMSERP.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IMSERP.API.Controllers;

public record CustomFieldDefinitionDto(
    Guid Id,
    string EntityType,
    string FieldKey,
    string FieldLabel,
    string DataType,
    List<string> DropdownOptions,
    string? Placeholder,
    bool IsRequired,
    bool ShowInTable,
    int SortOrder,
    bool IsActive
);

public record SaveCustomFieldRequestDto(
    string EntityType,
    string FieldLabel,
    string? FieldKey = null,
    string DataType = "Text",
    List<string>? DropdownOptions = null,
    string? Placeholder = null,
    bool IsRequired = false,
    bool ShowInTable = false,
    int SortOrder = 0,
    bool IsActive = true
);

[ApiController]
[Route("api/custom-fields")]
[Authorize]
public class CustomFieldsController : ControllerBase
{
    private readonly IIMSERPDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;

    private static readonly HashSet<string> AllowedDataTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Text", "Textarea", "Number", "Date", "Dropdown", "Checkbox"
    };

    public CustomFieldsController(IIMSERPDbContext dbContext, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<List<CustomFieldDefinitionDto>>> GetCustomFields(
        [FromQuery] string entityType = "Student",
        [FromQuery] bool includeInactive = false)
    {
        var tenantId = _currentUser.TenantId;
        var normEntity = string.IsNullOrWhiteSpace(entityType) ? "Student" : entityType.Trim();

        var query = _dbContext.CustomFieldDefinitions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(f => f.TenantId == tenantId && f.EntityType == normEntity);

        if (!includeInactive)
        {
            query = query.Where(f => f.IsActive);
        }

        var list = await query
            .OrderBy(f => f.SortOrder)
            .ThenBy(f => f.CreatedAt)
            .ToListAsync();

        return Ok(list.Select(MapToDto).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<CustomFieldDefinitionDto>> CreateCustomField([FromBody] SaveCustomFieldRequestDto dto)
    {
        var tenantId = _currentUser.TenantId;
        if (string.IsNullOrWhiteSpace(dto.FieldLabel))
            return BadRequest(new { message = "Field Label is required." });

        var normEntity = string.IsNullOrWhiteSpace(dto.EntityType) ? "Student" : dto.EntityType.Trim();
        var dataType = AllowedDataTypes.Contains(dto.DataType ?? "") ? dto.DataType!.Trim() : "Text";
        var fieldKey = GenerateSlugKey(!string.IsNullOrWhiteSpace(dto.FieldKey) ? dto.FieldKey! : dto.FieldLabel);

        if (string.IsNullOrWhiteSpace(fieldKey))
            return BadRequest(new { message = "Could not derive a valid field key from label." });

        var existing = await _dbContext.CustomFieldDefinitions
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(f => f.TenantId == tenantId && f.EntityType == normEntity && f.FieldKey == fieldKey);

        if (existing != null)
        {
            if (!existing.IsActive)
            {
                existing.FieldLabel = dto.FieldLabel.Trim();
                existing.DataType = dataType;
                existing.DropdownOptionsJson = SerializeOptions(dto.DropdownOptions);
                existing.Placeholder = dto.Placeholder?.Trim();
                existing.IsRequired = dto.IsRequired;
                existing.ShowInTable = dto.ShowInTable;
                existing.SortOrder = dto.SortOrder;
                existing.IsActive = true;
                existing.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();
                return Ok(MapToDto(existing));
            }
            return BadRequest(new { message = $"A custom field with key '{fieldKey}' already exists for {normEntity}." });
        }

        var maxOrder = await _dbContext.CustomFieldDefinitions
            .IgnoreQueryFilters()
            .Where(f => f.TenantId == tenantId && f.EntityType == normEntity)
            .Select(f => (int?)f.SortOrder)
            .MaxAsync() ?? 0;

        var entity = new CustomFieldDefinition
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = null, // Tenant-wide custom fields so all branches share the same admission schema
            EntityType = normEntity,
            FieldKey = fieldKey,
            FieldLabel = dto.FieldLabel.Trim(),
            DataType = dataType,
            DropdownOptionsJson = SerializeOptions(dto.DropdownOptions),
            Placeholder = dto.Placeholder?.Trim(),
            IsRequired = dto.IsRequired,
            ShowInTable = dto.ShowInTable,
            SortOrder = dto.SortOrder > 0 ? dto.SortOrder : maxOrder + 1,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.CustomFieldDefinitions.Add(entity);
        await _dbContext.SaveChangesAsync();

        return Ok(MapToDto(entity));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<CustomFieldDefinitionDto>> UpdateCustomField(Guid id, [FromBody] SaveCustomFieldRequestDto dto)
    {
        var tenantId = _currentUser.TenantId;
        var entity = await _dbContext.CustomFieldDefinitions
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(f => f.Id == id && f.TenantId == tenantId);

        if (entity == null)
            return NotFound(new { message = "Custom field definition not found." });

        if (!string.IsNullOrWhiteSpace(dto.FieldLabel))
            entity.FieldLabel = dto.FieldLabel.Trim();

        if (!string.IsNullOrWhiteSpace(dto.DataType) && AllowedDataTypes.Contains(dto.DataType))
            entity.DataType = dto.DataType.Trim();

        entity.DropdownOptionsJson = SerializeOptions(dto.DropdownOptions);
        entity.Placeholder = dto.Placeholder?.Trim();
        entity.IsRequired = dto.IsRequired;
        entity.ShowInTable = dto.ShowInTable;
        entity.SortOrder = dto.SortOrder;
        entity.IsActive = dto.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        return Ok(MapToDto(entity));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCustomField(Guid id)
    {
        var tenantId = _currentUser.TenantId;
        var entity = await _dbContext.CustomFieldDefinitions
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(f => f.Id == id && f.TenantId == tenantId);

        if (entity == null)
            return NotFound(new { message = "Custom field definition not found." });

        // Soft deactivate so historical JSON data on students is never lost
        entity.IsActive = false;
        entity.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        return Ok(new { success = true });
    }

    public static string GenerateSlugKey(string input)
    {
        var cleaned = Regex.Replace((input ?? "").Trim().ToLowerInvariant(), @"[^a-z0-9]+", "_").Trim('_');
        if (cleaned.Length > 80) cleaned = cleaned.Substring(0, 80).TrimEnd('_');
        return cleaned;
    }

    private static string? SerializeOptions(List<string>? options)
    {
        if (options == null || options.Count == 0) return null;
        var cleaned = options.Select(o => o?.Trim()).Where(o => !string.IsNullOrWhiteSpace(o)).Distinct().ToList();
        return cleaned.Count > 0 ? JsonSerializer.Serialize(cleaned) : null;
    }

    private static CustomFieldDefinitionDto MapToDto(CustomFieldDefinition f)
    {
        var opts = new List<string>();
        if (!string.IsNullOrWhiteSpace(f.DropdownOptionsJson))
        {
            try
            {
                opts = JsonSerializer.Deserialize<List<string>>(f.DropdownOptionsJson) ?? new List<string>();
            }
            catch { }
        }

        return new CustomFieldDefinitionDto(
            f.Id,
            f.EntityType,
            f.FieldKey,
            f.FieldLabel,
            f.DataType,
            opts,
            f.Placeholder,
            f.IsRequired,
            f.ShowInTable,
            f.SortOrder,
            f.IsActive
        );
    }
}
