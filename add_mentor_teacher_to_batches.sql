-- Add MentorTeacherId column to Batches table for Coaching Batch In-charge / Mentor parity
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[Batches]') 
    AND name = 'MentorTeacherId'
)
BEGIN
    ALTER TABLE [dbo].[Batches] ADD [MentorTeacherId] UNIQUEIDENTIFIER NULL;
    ALTER TABLE [dbo].[Batches] ADD CONSTRAINT [FK_Batches_MentorTeacher] FOREIGN KEY ([MentorTeacherId]) REFERENCES [dbo].[Teachers]([Id]) ON DELETE SET NULL;
    PRINT 'Added MentorTeacherId to Batches table successfully.';
END
ELSE
BEGIN
    PRINT 'MentorTeacherId already exists in Batches table.';
END
GO
