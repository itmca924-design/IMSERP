using System.Security.Cryptography;
using IMSERP.Application.Interfaces;

namespace IMSERP.Infrastructure.Services;

public class PasswordHasherService : IPasswordHasherService
{
    private const int SaltSize = 16; // 128-bit salt
    private const int KeySize = 32;  // 256-bit hash key
    private const int Iterations = 210000;
    private static readonly HashAlgorithmName HashAlgorithm = HashAlgorithmName.SHA256;

    public string HashPassword(string password)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);
        byte[] hash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            Iterations,
            HashAlgorithm,
            KeySize);

        return $"{Convert.ToBase64String(salt)}.{Iterations}.{Convert.ToBase64String(hash)}";
    }

    public bool VerifyPassword(string password, string hashedPassword)
    {
        if (string.IsNullOrEmpty(hashedPassword) || string.IsNullOrEmpty(password)) return false;

        try
        {
            var parts = hashedPassword.Split('.', 3);
            if (parts.Length != 3) return false;

            byte[] salt = Convert.FromBase64String(parts[0]);
            if (!int.TryParse(parts[1], out int iterations) || iterations < 1 || iterations > Iterations * 10)
            {
                return false;
            }

            byte[] hash = Convert.FromBase64String(parts[2]);

            byte[] inputHash = Rfc2898DeriveBytes.Pbkdf2(
                password,
                salt,
                iterations,
                HashAlgorithm,
                hash.Length);

            return CryptographicOperations.FixedTimeEquals(hash, inputHash);
        }
        catch
        {
            return false;
        }
    }

    public bool NeedsRehash(string hashedPassword)
    {
        var parts = hashedPassword.Split('.', 3);
        return parts.Length != 3 ||
               !int.TryParse(parts[1], out int iterations) ||
               iterations < Iterations;
    }
}
