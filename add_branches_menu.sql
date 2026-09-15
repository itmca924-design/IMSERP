DECLARE @BranchesMenuId UNIQUEIDENTIFIER = '10000000-0000-0000-0000-000000000028';
DECLARE @MasterParentId UNIQUEIDENTIFIER = NULL;

SELECT TOP 1 @MasterParentId = [Id]
FROM [dbo].[MenuItems]
WHERE [Title] = 'Master Management' AND [ParentId] IS NULL;

IF @MasterParentId IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [dbo].[MenuItems] WHERE [Id] = @BranchesMenuId OR [RouteUrl] = '/branches')
    BEGIN
        INSERT INTO [dbo].[MenuItems] ([Id], [Title], [RouteUrl], [Icon], [ParentId], [SortOrder], [Module], [IsActive])
        VALUES (@BranchesMenuId, N'Branches Master', N'/branches', N'store', @MasterParentId, 1, N'Master', 1);
        PRINT 'Branches Master menu inserted.';
    END
    ELSE
    BEGIN
        UPDATE [dbo].[MenuItems]
        SET [Title] = N'Branches Master',
            [RouteUrl] = N'/branches',
            [Icon] = N'store',
            [ParentId] = @MasterParentId,
            [SortOrder] = 1,
            [Module] = N'Master',
            [IsActive] = 1
        WHERE [Id] = @BranchesMenuId OR [RouteUrl] = '/branches';
    END

    -- Grant permissions to Admin roles if any
    INSERT INTO [dbo].[RolePermissions] ([Id], [RoleId], [MenuItemId], [CanView], [CanCreate], [CanEdit], [CanDelete])
    SELECT NEWID(), r.[Id], @BranchesMenuId, 1, 1, 1, 1
    FROM [dbo].[Roles] r
    WHERE r.[Name] LIKE '%Admin%'
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[RolePermissions] rp
          WHERE rp.[RoleId] = r.[Id] AND rp.[MenuItemId] = @BranchesMenuId
      );
END
GO
