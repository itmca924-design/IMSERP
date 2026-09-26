namespace IMSERP.API.Helpers;

public static class ImageStorageHelper
{
    public static string? SaveBase64Image(string? photoData, string subFolder, string identifier, string contentRootPath)
    {
        if (string.IsNullOrWhiteSpace(photoData)) return null;

        // If it's already a relative path or an external URL, keep it
        if (!photoData.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
        {
            return photoData;
        }

        try
        {
            var commaIndex = photoData.IndexOf(',');
            if (commaIndex == -1) return null;

            var header = photoData.Substring(0, commaIndex).ToLowerInvariant();
            var base64 = photoData.Substring(commaIndex + 1);

            var ext = "png";
            if (header.Contains("jpeg") || header.Contains("jpg")) ext = "jpg";
            else if (header.Contains("webp")) ext = "webp";
            else if (header.Contains("svg")) ext = "svg";

            var bytes = Convert.FromBase64String(base64);

            var uploadsFolder = Path.Combine(contentRootPath, "wwwroot", "uploads", subFolder);
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            var fileName = $"{identifier}_{DateTime.UtcNow.Ticks}.{ext}";
            var fullPath = Path.Combine(uploadsFolder, fileName);

            // Clean up any old files with this identifier in the folder
            try
            {
                var existingFiles = Directory.GetFiles(uploadsFolder, $"{identifier}_*");
                foreach (var f in existingFiles)
                {
                    try { File.Delete(f); } catch { }
                }
            }
            catch { }

            File.WriteAllBytes(fullPath, bytes);

            return $"/uploads/{subFolder}/{fileName}";
        }
        catch (Exception)
        {
            return null;
        }
    }

    public static string? SaveBase64File(string? fileData, string subFolder, string identifier, string contentRootPath)
    {
        if (string.IsNullOrWhiteSpace(fileData)) return null;

        // If it's already a relative path or an external URL, keep it
        if (!fileData.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            return fileData;
        }

        try
        {
            var commaIndex = fileData.IndexOf(',');
            if (commaIndex == -1) return null;

            var header = fileData.Substring(0, commaIndex).ToLowerInvariant();
            var base64 = fileData.Substring(commaIndex + 1);

            var ext = "bin";
            if (header.Contains("pdf")) ext = "pdf";
            else if (header.Contains("jpeg") || header.Contains("jpg")) ext = "jpg";
            else if (header.Contains("png")) ext = "png";
            else if (header.Contains("webp")) ext = "webp";
            else if (header.Contains("word") || header.Contains("docx")) ext = "docx";
            else if (header.Contains("text") || header.Contains("plain")) ext = "txt";

            var bytes = Convert.FromBase64String(base64);

            var uploadsFolder = Path.Combine(contentRootPath, "wwwroot", "uploads", subFolder);
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            var fileName = $"{identifier}_{DateTime.UtcNow.Ticks}.{ext}";
            var fullPath = Path.Combine(uploadsFolder, fileName);

            File.WriteAllBytes(fullPath, bytes);

            return $"/uploads/{subFolder}/{fileName}";
        }
        catch (Exception)
        {
            return null;
        }
    }
}
