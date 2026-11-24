using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace IMSERP.BiometricBridge;

public sealed class BridgeConfig
{
    public string ErpWebhookUrl { get; set; } = "";
    public string WebhookKey { get; set; } = "";
    public string TenantId { get; set; } = "";
    public string DeviceName { get; set; } = "Hikvision Attendance Terminal";
    public string DeviceSerialNumber { get; set; } = "";
    public string DeviceIp { get; set; } = "192.168.1.2";
    public int DevicePort { get; set; } = 80;
    public string DeviceUsername { get; set; } = "admin";
    public string DevicePassword { get; set; } = "";
    public int PollIntervalSeconds { get; set; } = 5;
    public int LookbackDays { get; set; } = 2;
}

public sealed class BridgeState
{
    public long LastHikvisionSerialNo { get; set; } = 0;
    public string? LastSyncedDateIso { get; set; }
    public HashSet<string> RecentEventIds { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public sealed class HeartbeatPayload
{
    public string serialNumber { get; set; } = "";
    public bool heartbeat { get; set; } = true;
}

public sealed class PunchPayload
{
    public string serialNumber { get; set; } = "";
    public string employeeNoString { get; set; } = "";
    public string cardNo { get; set; } = "";
    public string dateTime { get; set; } = "";
    public string deviceEventId { get; set; } = "";
}

[JsonSourceGenerationOptions(WriteIndented = true, PropertyNameCaseInsensitive = true)]
[JsonSerializable(typeof(BridgeConfig))]
[JsonSerializable(typeof(BridgeState))]
[JsonSerializable(typeof(HeartbeatPayload))]
[JsonSerializable(typeof(PunchPayload))]
internal partial class BridgeJsonContext : JsonSerializerContext
{
}

public static class Program
{
    private static readonly string AppDir = AppContext.BaseDirectory;
    private static readonly string ConfigPath = Path.Combine(AppDir, "bridge-config.json");
    private static readonly string StatePath = Path.Combine(AppDir, "bridge-state.json");
    private static readonly JsonSerializerOptions PrettyJson = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true,
        TypeInfoResolver = BridgeJsonContext.Default
    };

    public static async Task Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        Console.Title = "IMSERP Biometric Live Sync Bridge";

        PrintBanner();

        var config = LoadOrCreateConfig();
        if (string.IsNullOrWhiteSpace(config.ErpWebhookUrl) || string.IsNullOrWhiteSpace(config.WebhookKey))
        {
            LogError("bridge-config.json is missing ErpWebhookUrl or WebhookKey.");
            LogInfo("Please download the pre-configured Bridge ZIP from your ERP Biometric Devices page.");
            WaitExit();
            return;
        }

        // First-time setup: ask for Hikvision Device IP / Admin Password if not saved yet
        if (string.IsNullOrWhiteSpace(config.DeviceIp))
        {
            Console.Write("Enter Hikvision Device Local IP (e.g. 192.168.1.2): ");
            config.DeviceIp = (Console.ReadLine() ?? "").Trim();
            SaveConfig(config);
        }

        if (string.IsNullOrWhiteSpace(config.DevicePassword))
        {
            Console.WriteLine();
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"First-Time Setup for {config.DeviceName} ({config.DeviceIp}):");
            Console.ResetColor();
            Console.Write($"Enter Hikvision Admin Password (username: {config.DeviceUsername}): ");
            config.DevicePassword = ReadPassword();
            Console.WriteLine();
            if (string.IsNullOrWhiteSpace(config.DevicePassword))
            {
                LogError("Password cannot be empty. Restart the bridge and enter the Hikvision admin password.");
                WaitExit();
                return;
            }
            SaveConfig(config);
            LogOk("Device password saved locally in bridge-config.json (you won't be asked again).");
        }

        var state = LoadState();

        using var cts = new CancellationTokenSource();
        Console.CancelKeyPress += (_, e) =>
        {
            e.Cancel = true;
            LogWarn("Stopping IMSERP Biometric Bridge...");
            cts.Cancel();
        };

        using var erpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
        using var deviceClient = CreateDeviceHttpClient(config);

        LogInfo($"ERP Cloud Endpoint : {config.ErpWebhookUrl}");
        LogInfo($"Hikvision Terminal : http://{config.DeviceIp}:{config.DevicePort} (Serial: {config.DeviceSerialNumber})");
        LogInfo($"Sync Interval      : Every {Math.Max(3, config.PollIntervalSeconds)} seconds");
        Console.WriteLine("------------------------------------------------------------------");

        // Verify device info over LAN ISAPI
        await VerifyHikvisionDeviceAsync(deviceClient, config, cts.Token);

        // Send initial heartbeat to ERP so device status becomes Online immediately
        await SendHeartbeatAsync(erpClient, config, cts.Token);

        var lastHeartbeatUtc = DateTime.UtcNow;
        var pollDelay = TimeSpan.FromSeconds(Math.Clamp(config.PollIntervalSeconds, 3, 60));

        while (!cts.IsCancellationRequested)
        {
            try
            {
                await PollAndSyncEventsAsync(deviceClient, erpClient, config, state, cts.Token);

                if ((DateTime.UtcNow - lastHeartbeatUtc).TotalSeconds >= 60)
                {
                    await SendHeartbeatAsync(erpClient, config, cts.Token);
                    lastHeartbeatUtc = DateTime.UtcNow;
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                LogWarn($"Sync cycle warning: {ex.Message}");
            }

            try
            {
                await Task.Delay(pollDelay, cts.Token);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        LogInfo("IMSERP Biometric Bridge stopped cleanly.");
    }

    private static HttpClient CreateDeviceHttpClient(BridgeConfig config)
    {
        var handler = new HttpClientHandler
        {
            Credentials = new NetworkCredential(config.DeviceUsername, config.DevicePassword),
            PreAuthenticate = false,
            ServerCertificateCustomValidationCallback = (_, _, _, _) => true
        };
        return new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(15) };
    }

    private static async Task VerifyHikvisionDeviceAsync(HttpClient deviceClient, BridgeConfig config, CancellationToken ct)
    {
        var url = $"http://{config.DeviceIp}:{config.DevicePort}/ISAPI/System/deviceInfo";
        try
        {
            using var resp = await deviceClient.GetAsync(url, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);

            if (resp.StatusCode == HttpStatusCode.Unauthorized)
            {
                LogError("Hikvision rejected username/password (401 Unauthorized).");
                LogWarn("Please edit bridge-config.json -> clear DevicePassword -> restart this bridge to re-enter password.");
                return;
            }

            if (resp.IsSuccessStatusCode)
            {
                var model = ExtractXmlTag(body, "model") ?? "Hikvision Terminal";
                var serial = ExtractXmlTag(body, "serialNumber");
                LogOk($"Connected to local Hikvision machine: {model} (Serial: {serial ?? config.DeviceSerialNumber})");

                if (string.IsNullOrWhiteSpace(config.DeviceSerialNumber) && !string.IsNullOrWhiteSpace(serial))
                {
                    config.DeviceSerialNumber = serial;
                    SaveConfig(config);
                }
            }
            else
            {
                LogWarn($"Device info returned HTTP {(int)resp.StatusCode}. Will keep polling ISAPI events.");
            }
        }
        catch (Exception ex)
        {
            LogWarn($"Could not reach {config.DeviceIp}:{config.DevicePort} right now ({ex.Message}). Make sure this PC and the biometric machine are on the same Wi-Fi/LAN. Will keep retrying...");
        }
    }

    private static async Task SendHeartbeatAsync(HttpClient erpClient, BridgeConfig config, CancellationToken ct)
    {
        try
        {
            var url = BuildWebhookUrl(config);
            var payload = JsonSerializer.Serialize(new HeartbeatPayload
            {
                serialNumber = config.DeviceSerialNumber,
                heartbeat = true
            }, BridgeJsonContext.Default.HeartbeatPayload);

            using var req = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json")
            };
            req.Headers.Add("X-Biometric-Webhook-Key", config.WebhookKey);

            using var resp = await erpClient.SendAsync(req, ct);
            if (resp.IsSuccessStatusCode)
            {
                LogOk("Cloud ERP Heartbeat OK -> Device marked Online.");
            }
            else
            {
                var err = await resp.Content.ReadAsStringAsync(ct);
                LogWarn($"Cloud ERP Heartbeat HTTP {(int)resp.StatusCode}: {err}");
            }
        }
        catch (Exception ex)
        {
            LogWarn($"Cloud ERP Heartbeat failed ({ex.Message}). Will retry automatically.");
        }
    }

    private static async Task PollAndSyncEventsAsync(
        HttpClient deviceClient,
        HttpClient erpClient,
        BridgeConfig config,
        BridgeState state,
        CancellationToken ct)
    {
        var istOffset = TimeSpan.FromHours(5.5);
        var nowIst = DateTimeOffset.UtcNow.ToOffset(istOffset);
        var lookback = Math.Clamp(config.LookbackDays, 1, 14);
        var startIst = new DateTimeOffset(nowIst.Date.AddDays(-lookback + 1), istOffset);
        var endIst = nowIst.AddMinutes(5);

        string startStr = startIst.ToString("yyyy-MM-ddTHH:mm:ss+05:30");
        string endStr = endIst.ToString("yyyy-MM-ddTHH:mm:ss+05:30");

        int position = 0;
        const int pageSize = 30;
        int syncedInCycle = 0;

        while (!ct.IsCancellationRequested)
        {
            var acsUrl = $"http://{config.DeviceIp}:{config.DevicePort}/ISAPI/AccessControl/AcsEvent?format=json";
            var searchPayload =
                $$"""
                {
                  "AcsEventCond": {
                    "searchID": "imserp-{{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}}",
                    "searchResultPosition": {{position}},
                    "maxResults": {{pageSize}},
                    "major": 5,
                    "minor": 0,
                    "startTime": "{{startStr}}",
                    "endTime": "{{endStr}}"
                  }
                }
                """;

            using var req = new HttpRequestMessage(HttpMethod.Post, acsUrl)
            {
                Content = new StringContent(searchPayload, Encoding.UTF8, "application/json")
            };

            using var resp = await deviceClient.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
            {
                if (resp.StatusCode == HttpStatusCode.Unauthorized)
                {
                    LogError("Hikvision 401 Unauthorized while polling events. Verify DevicePassword in bridge-config.json.");
                }
                return;
            }

            var json = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);

            if (!doc.RootElement.TryGetProperty("AcsEvent", out var acsEvent))
            {
                return;
            }

            int numOfMatches = acsEvent.TryGetProperty("numOfMatches", out var nm) && nm.TryGetInt32(out var n) ? n : 0;
            string statusStr = acsEvent.TryGetProperty("responseStatusStrg", out var rs) ? (rs.GetString() ?? "") : "";

            if (acsEvent.TryGetProperty("InfoList", out var infoList) && infoList.ValueKind == JsonValueKind.Array)
            {
                foreach (var evt in infoList.EnumerateArray())
                {
                    string empNo = GetJsonString(evt, "employeeNoString") ?? GetJsonString(evt, "employeeNo") ?? "";
                    string cardNo = GetJsonString(evt, "cardNo") ?? "";
                    if (string.IsNullOrWhiteSpace(empNo) && string.IsNullOrWhiteSpace(cardNo))
                    {
                        continue; // Non-user event (e.g. door sensor or unrecognized scan)
                    }

                    long evtSerial = evt.TryGetProperty("serialNo", out var sn) && sn.TryGetInt64(out var s) ? s : 0;
                    string evtTime = GetJsonString(evt, "time") ?? nowIst.ToString("yyyy-MM-ddTHH:mm:ss+05:30");
                    string name = GetJsonString(evt, "name") ?? "";

                    string uniqueEventId = evtSerial > 0
                        ? $"HIK-{config.DeviceSerialNumber}-{evtSerial}"
                        : $"HIK-{config.DeviceSerialNumber}-{empNo}-{cardNo}-{evtTime}";

                    if (state.RecentEventIds.Contains(uniqueEventId))
                    {
                        continue;
                    }

                    bool pushed = await PushPunchToErpAsync(erpClient, config, empNo, cardNo, evtTime, uniqueEventId, name, ct);
                    if (pushed)
                    {
                        state.RecentEventIds.Add(uniqueEventId);
                        if (evtSerial > state.LastHikvisionSerialNo)
                        {
                            state.LastHikvisionSerialNo = evtSerial;
                        }
                        state.LastSyncedDateIso = DateTime.UtcNow.ToString("O");
                        syncedInCycle++;

                        // Keep state set bounded to latest 5000 IDs
                        if (state.RecentEventIds.Count > 5000)
                        {
                            state.RecentEventIds = state.RecentEventIds.TakeLast(3000).ToHashSet(StringComparer.OrdinalIgnoreCase);
                        }
                        SaveState(state);
                    }
                }
            }

            if (string.Equals(statusStr, "MORE", StringComparison.OrdinalIgnoreCase) && numOfMatches > 0)
            {
                position += numOfMatches;
            }
            else
            {
                break;
            }
        }

        if (syncedInCycle > 0)
        {
            LogOk($"Synced {syncedInCycle} new attendance punch(es) to Cloud ERP.");
        }
    }

    private static async Task<bool> PushPunchToErpAsync(
        HttpClient erpClient,
        BridgeConfig config,
        string employeeNo,
        string cardNo,
        string eventTime,
        string deviceEventId,
        string deviceUserName,
        CancellationToken ct)
    {
        try
        {
            var url = BuildWebhookUrl(config);
            var payload = JsonSerializer.Serialize(new PunchPayload
            {
                serialNumber = config.DeviceSerialNumber,
                employeeNoString = employeeNo,
                cardNo = cardNo,
                dateTime = eventTime,
                deviceEventId = deviceEventId
            }, BridgeJsonContext.Default.PunchPayload);

            using var req = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json")
            };
            req.Headers.Add("X-Biometric-Webhook-Key", config.WebhookKey);

            using var resp = await erpClient.SendAsync(req, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);

            if (resp.IsSuccessStatusCode)
            {
                LogPunch($"ID={(!string.IsNullOrWhiteSpace(employeeNo) ? employeeNo : cardNo)} {(string.IsNullOrWhiteSpace(deviceUserName) ? "" : $"({deviceUserName}) ")}@ {eventTime} -> Synced OK");
                return true;
            }

            LogWarn($"ERP rejected punch ID={employeeNo} (HTTP {(int)resp.StatusCode}): {body}");
            // Do not endlessly retry 400/404 unmapped user errors
            return (int)resp.StatusCode >= 400 && (int)resp.StatusCode < 500 && resp.StatusCode != HttpStatusCode.TooManyRequests;
        }
        catch (Exception ex)
        {
            LogWarn($"Network error pushing punch ID={employeeNo}: {ex.Message} (will retry next cycle)");
            return false;
        }
    }

    private static string BuildWebhookUrl(BridgeConfig config)
    {
        var baseUrl = config.ErpWebhookUrl.Trim();
        var sep = baseUrl.Contains('?') ? "&" : "?";
        var sb = new StringBuilder(baseUrl);
        if (!string.IsNullOrWhiteSpace(config.TenantId))
        {
            sb.Append($"{sep}tenantId={Uri.EscapeDataString(config.TenantId)}");
            sep = "&";
        }
        if (!string.IsNullOrWhiteSpace(config.DeviceSerialNumber))
        {
            sb.Append($"{sep}serialNumber={Uri.EscapeDataString(config.DeviceSerialNumber)}");
        }
        return sb.ToString();
    }

    private static string? GetJsonString(JsonElement elem, string prop)
    {
        if (!elem.TryGetProperty(prop, out var val)) return null;
        return val.ValueKind switch
        {
            JsonValueKind.String => val.GetString(),
            JsonValueKind.Number => val.GetRawText(),
            _ => null
        };
    }

    private static string? ExtractXmlTag(string xml, string tag)
    {
        var m = Regex.Match(xml, $@"<{tag}>([^<]+)</{tag}>", RegexOptions.IgnoreCase);
        return m.Success ? m.Groups[1].Value.Trim() : null;
    }

    private static BridgeConfig LoadOrCreateConfig()
    {
        if (File.Exists(ConfigPath))
        {
            try
            {
                var json = File.ReadAllText(ConfigPath);
                return JsonSerializer.Deserialize(json, BridgeJsonContext.Default.BridgeConfig) ?? new BridgeConfig();
            }
            catch (Exception ex)
            {
                LogWarn($"Could not parse bridge-config.json: {ex.Message}");
            }
        }
        return new BridgeConfig();
    }

    private static void SaveConfig(BridgeConfig config)
    {
        var json = JsonSerializer.Serialize(config, BridgeJsonContext.Default.BridgeConfig);
        File.WriteAllText(ConfigPath, json, Encoding.UTF8);
    }

    private static BridgeState LoadState()
    {
        if (File.Exists(StatePath))
        {
            try
            {
                var json = File.ReadAllText(StatePath);
                return JsonSerializer.Deserialize(json, BridgeJsonContext.Default.BridgeState) ?? new BridgeState();
            }
            catch { }
        }
        return new BridgeState();
    }

    private static void SaveState(BridgeState state)
    {
        try
        {
            var json = JsonSerializer.Serialize(state, BridgeJsonContext.Default.BridgeState);
            File.WriteAllText(StatePath, json, Encoding.UTF8);
        }
        catch { }
    }

    private static string ReadPassword()
    {
        var sb = new StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter) break;
            if (key.Key == ConsoleKey.Backspace && sb.Length > 0)
            {
                sb.Length--;
                Console.Write("\b \b");
            }
            else if (!char.IsControl(key.KeyChar))
            {
                sb.Append(key.KeyChar);
                Console.Write("*");
            }
        }
        return sb.ToString();
    }

    private static void PrintBanner()
    {
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine("==================================================================");
        Console.WriteLine("   IMSERP BIOMETRIC LIVE SYNC BRIDGE (Hikvision ISAPI -> Cloud)   ");
        Console.WriteLine("==================================================================");
        Console.ResetColor();
    }

    private static void LogInfo(string msg) => Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [INFO]  {msg}");

    private static void LogOk(string msg)
    {
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [OK]    {msg}");
        Console.ResetColor();
    }

    private static void LogPunch(string msg)
    {
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [PUNCH] {msg}");
        Console.ResetColor();
    }

    private static void LogWarn(string msg)
    {
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [WARN]  {msg}");
        Console.ResetColor();
    }

    private static void LogError(string msg)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [ERROR] {msg}");
        Console.ResetColor();
    }

    private static void WaitExit()
    {
        Console.WriteLine("\nPress any key to exit...");
        Console.ReadKey(true);
    }
}
