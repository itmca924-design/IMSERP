namespace IMSERP.API.Helpers;

public static class IstTimeZoneHelper
{
    private static readonly Lazy<TimeZoneInfo> _istZone = new(() =>
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(OperatingSystem.IsWindows() ? "India Standard Time" : "Asia/Kolkata");
        }
        catch
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");
            }
            catch
            {
                try
                {
                    return TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
                }
                catch
                {
                    return TimeZoneInfo.CreateCustomTimeZone("IST", TimeSpan.FromHours(5.5), "India Standard Time", "IST");
                }
            }
        }
    });

    public static TimeZoneInfo Zone => _istZone.Value;

    public static DateTime UtcToIst(DateTime utc)
    {
        var specifiedUtc = utc.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(utc, DateTimeKind.Utc) : utc.ToUniversalTime();
        return TimeZoneInfo.ConvertTimeFromUtc(specifiedUtc, Zone);
    }

    public static DateTime NowIst => UtcToIst(DateTime.UtcNow);
}

