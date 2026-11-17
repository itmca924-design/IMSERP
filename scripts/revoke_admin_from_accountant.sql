SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

UPDATE rp
SET CanView = 0, CanCreate = 0, CanEdit = 0, CanDelete = 0
FROM RolePermissions rp
JOIN Roles r ON rp.RoleId = r.Id
JOIN MenuItems m ON rp.MenuItemId = m.Id
WHERE r.Name = 'Accountant'
  AND (m.RouteUrl LIKE '%role%' OR m.Title LIKE '%Admin%' OR m.Module = 'Admin' OR m.ParentId IN (SELECT Id FROM MenuItems WHERE Title LIKE '%Admin%'));
GO
