-- ============================================================================
-- Migration: Segregate School Tuition Fee (TUI) and Coaching Fee (COACH)
-- ============================================================================

PRINT 'Starting FeeHeads and ClassFeeStructures segregation migration...';

-- 1. Update FeeHeads table: Name & ApplicableTo
UPDATE [dbo].[FeeHeads]
SET [Name] = 'School Tuition Fee',
    [ApplicableTo] = 'School'
WHERE [Code] = 'TUI';

UPDATE [dbo].[FeeHeads]
SET [Name] = 'Coaching Fee',
    [ApplicableTo] = 'Coaching'
WHERE [Code] = 'COACH';

PRINT '>> Updated FeeHeads: TUI -> School Tuition Fee (School), COACH -> Coaching Fee (Coaching).';

-- 2. Migrate existing batch-level ClassFeeStructures that used TUI to COACH
-- Case A: Batch already has COACH row. If TUI row has active amount and COACH doesn't, sync to COACH.
UPDATE cfs_coach
SET cfs_coach.[Amount] = cfs_tui.[Amount],
    cfs_coach.[IsActive] = cfs_tui.[IsActive]
FROM [dbo].[ClassFeeStructures] cfs_coach
JOIN [dbo].[FeeHeads] fh_coach ON cfs_coach.[FeeHeadId] = fh_coach.[Id] AND fh_coach.[Code] = 'COACH'
JOIN [dbo].[ClassFeeStructures] cfs_tui ON cfs_tui.[BatchId] = cfs_coach.[BatchId]
JOIN [dbo].[FeeHeads] fh_tui ON cfs_tui.[FeeHeadId] = fh_tui.[Id] AND fh_tui.[Code] = 'TUI'
WHERE cfs_coach.[BatchId] IS NOT NULL
  AND cfs_tui.[Amount] > 0
  AND (cfs_coach.[Amount] = 0 OR cfs_coach.[IsActive] = 0);

-- Delete TUI rows for batches where a COACH row already exists
DELETE cfs_tui
FROM [dbo].[ClassFeeStructures] cfs_tui
JOIN [dbo].[FeeHeads] fh_tui ON cfs_tui.[FeeHeadId] = fh_tui.[Id] AND fh_tui.[Code] = 'TUI'
WHERE cfs_tui.[BatchId] IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM [dbo].[ClassFeeStructures] cfs_coach
      JOIN [dbo].[FeeHeads] fh_coach ON cfs_coach.[FeeHeadId] = fh_coach.[Id] AND fh_coach.[Code] = 'COACH'
      WHERE cfs_coach.[BatchId] = cfs_tui.[BatchId]
  );

-- Case B: Batch has TUI row but NO COACH row yet. Point TUI row directly to COACH FeeHeadId.
UPDATE cfs
SET cfs.[FeeHeadId] = fh_coach.[Id]
FROM [dbo].[ClassFeeStructures] cfs
JOIN [dbo].[FeeHeads] fh_tui ON cfs.[FeeHeadId] = fh_tui.[Id] AND fh_tui.[Code] = 'TUI'
JOIN [dbo].[FeeHeads] fh_coach ON fh_coach.[TenantId] = cfs.[TenantId] AND fh_coach.[Code] = 'COACH'
WHERE cfs.[BatchId] IS NOT NULL;

PRINT '>> Cleaned up batch-level fee structures: All batches now exclusively point to COACH FeeHead.';

-- Verification queries
SELECT [Code], [Name], [ApplicableTo], COUNT(*) AS [TenantCount]
FROM [dbo].[FeeHeads]
WHERE [Code] IN ('TUI', 'COACH')
GROUP BY [Code], [Name], [ApplicableTo];

SELECT fh.[Code], fh.[Name], COUNT(*) AS [BatchStructureCount]
FROM [dbo].[ClassFeeStructures] cfs
JOIN [dbo].[FeeHeads] fh ON cfs.[FeeHeadId] = fh.[Id]
WHERE cfs.[BatchId] IS NOT NULL AND fh.[Code] IN ('TUI', 'COACH')
GROUP BY fh.[Code], fh.[Name];
GO
