-- ============================================================================
-- SQL Script: Set Working Passwords for Demo Users in IMSERP Database
-- Database: IMSERP
-- ============================================================================

USE [IMSERP];
GO

-- Set Passwords for Demo Accounts
-- Username: admin       -> Password: admin123
-- Username: teacher     -> Password: teacher123
-- Username: accountant  -> Password: account123

UPDATE [dbo].[Users] SET [PasswordHash] = 'admin123' WHERE [Username] = 'admin';
UPDATE [dbo].[Users] SET [PasswordHash] = 'teacher123' WHERE [Username] = 'teacher';
UPDATE [dbo].[Users] SET [PasswordHash] = 'account123' WHERE [Username] = 'accountant';

PRINT 'Demo passwords reset successfully.';
GO

SELECT [Username], [FullName], [PasswordHash], [Role], [IsActive] FROM [dbo].[Users];
GO
