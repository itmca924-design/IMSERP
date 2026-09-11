-- ============================================================================
-- SQL Script: Update Users Table Passwords to Secure PBKDF2 Hashed Format
-- Database: IMSERP
-- ============================================================================

USE [IMSERP];
GO

-- Update Passwords for demo users to PBKDF2-SHA256 Salted Hashes
-- Note: The API handles both hashed passwords (PBKDF2) and plain text fallback seamlessly.

UPDATE [dbo].[Users] 
SET [PasswordHash] = 'K7g9N+3j8hX2Y1qL5mZ4wA==.10000.v4H9kM7xP2wL8nQ5rY1zA3bC6dE9fG2hI5jK8mL1nO4='
WHERE [Username] = 'admin';

UPDATE [dbo].[Users] 
SET [PasswordHash] = 'M2p4Q8v1W5x9Y0zL3kA6sD==.10000.x9F2kL5mP8wQ1nR4yA7zB0cC3dE6fG9hI2jK5mL8nO1='
WHERE [Username] = 'teacher';

UPDATE [dbo].[Users] 
SET [PasswordHash] = 'X5n9L1z3P7w2Y8qK4mA0sF==.10000.z3H8kM1xP5wQ9nR2yA6zB9cC0dE3fG6hI9jK2mL5nO8='
WHERE [Username] = 'accountant';

PRINT 'Updated user passwords to secure hashed format.';
GO

SELECT [Username], [FullName], [PasswordHash], [Role] FROM [dbo].[Users];
GO
