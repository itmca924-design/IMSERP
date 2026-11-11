using System.Buffers.Binary;
using System.Net.WebSockets;
using System.Security;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using IMSERP.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace IMSERP.Infrastructure.Services;

public class AiHindiVoiceService : IAiVoiceService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<AiHindiVoiceService> _logger;

    private const string TrustedToken = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    private const string EdgeWssBase = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=" + TrustedToken;
    private const string EdgeOrigin = "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold";
    private const string EdgeUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0";

    private static readonly uint[] MixFirstWord = [0xCF98B111, 0x87085B9F, 0x12CEB96D, 0x257E1D83];
    private static readonly uint[] MixSecondWord = [0xA27416F5, 0xD38396FF, 0x7C932B89, 0xBFA49F69];

    public AiHindiVoiceService(
        HttpClient httpClient,
        ILogger<AiHindiVoiceService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<byte[]> GenerateDuesReminderVoiceAsync(
        string parentName,
        string studentName,
        string className,
        decimal dueAmount,
        string monthName,
        int dueDay,
        string instituteName,
        string voiceGender = "Female",
        string outputFormat = "audio-24khz-48kbitrate-mono-mp3",
        CancellationToken cancellationToken = default)
    {
        var script = BuildHindiScript(parentName, studentName, className, dueAmount, monthName, dueDay, instituteName);
        var voiceName = voiceGender?.Equals("Male", StringComparison.OrdinalIgnoreCase) == true
            ? "hi-IN-MadhurNeural"
            : "hi-IN-SwaraNeural";

        return await SynthesizeSpeechAsync(script, voiceName, outputFormat, cancellationToken);
    }

    public string BuildHindiScript(
        string parentName,
        string studentName,
        string className,
        decimal dueAmount,
        string monthName,
        int dueDay,
        string instituteName)
    {
        var cleanParent = !string.IsNullOrWhiteSpace(parentName) ? parentName.Trim() : "अभिभावक";
        var cleanStudent = !string.IsNullOrWhiteSpace(studentName) ? studentName.Trim() : "आपके बच्चे";
        var cleanInst = PhoneticNormalize(instituteName);
        var cleanClass = FormatClassForHindiSpeech(className);

        var (hindiMonth, yearStr) = ParseHindiMonthAndYear(monthName);

        var classPhrase = !string.IsNullOrWhiteSpace(cleanClass) ? $", {cleanClass}," : "";
        var amountText = dueAmount > 0 ? $"रुपये {dueAmount:N0}" : "बकाया शुल्क";

        return $"नमस्ते {cleanParent} जी! {cleanInst} से सादर अनुरोध है। आपके सुपुत्र या सुपुत्री {cleanStudent}{classPhrase} की फीस {amountText} देय है। फीस जमा करने की नियत तारीख {dueDay} {hindiMonth} {yearStr} है। कृपया समय पर फीस जमा कराकर सहयोग प्रदान करें। धन्यवाद!";
    }

    private static (string MonthHindi, string Year) ParseHindiMonthAndYear(string? rawMonth)
    {
        var currentYear = DateTime.UtcNow.AddHours(5.5).Year.ToString();
        if (string.IsNullOrWhiteSpace(rawMonth))
            return ("वर्तमान", currentYear);

        var text = rawMonth.Trim();
        var yearMatch = Regex.Match(text, @"\b(20\d{2})\b");
        var year = yearMatch.Success ? yearMatch.Groups[1].Value : currentYear;
        var monthPart = Regex.Replace(text, @"\b20\d{2}\b", "").Trim('-', ' ', ',');

        var monthHindi = monthPart.ToLowerInvariant() switch
        {
            "january" or "jan" => "जनवरी",
            "february" or "feb" => "फ़रवरी",
            "march" or "mar" => "मार्च",
            "april" or "apr" => "अप्रैल",
            "may" => "मई",
            "june" or "jun" => "जून",
            "july" or "jul" => "जुलाई",
            "august" or "aug" => "अगस्त",
            "september" or "sep" or "sept" => "सितंबर",
            "october" or "oct" => "अक्टूबर",
            "november" or "nov" => "नवंबर",
            "december" or "dec" => "दिसंबर",
            _ => !string.IsNullOrWhiteSpace(monthPart) ? monthPart : "वर्तमान"
        };

        return (monthHindi, year);
    }

    public static string PhoneticNormalize(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "ज्ञानदीप कैंपस";

        var normalized = text.Trim();
        // Specifically fix Jnandeep -> ज्ञानदीप (Gyandeep)
        normalized = Regex.Replace(normalized, @"\bJnandeep\b", "ज्ञानदीप", RegexOptions.IgnoreCase);
        normalized = Regex.Replace(normalized, @"\bJnan\b", "ज्ञान", RegexOptions.IgnoreCase);
        normalized = Regex.Replace(normalized, @"\bCampus\b", "कैंपस", RegexOptions.IgnoreCase);
        normalized = Regex.Replace(normalized, @"\bAcademy\b", "एकेडमी", RegexOptions.IgnoreCase);
        normalized = Regex.Replace(normalized, @"\bSchool\b", "स्कूल", RegexOptions.IgnoreCase);
        normalized = Regex.Replace(normalized, @"\bCoaching\b", "कोचिंग", RegexOptions.IgnoreCase);
        normalized = Regex.Replace(normalized, @"\bInstitute\b", "इंस्टीट्यूट", RegexOptions.IgnoreCase);

        return normalized;
    }

    public static string FormatClassForHindiSpeech(string? className)
    {
        if (string.IsNullOrWhiteSpace(className)) return "";
        var c = className.Trim();

        c = Regex.Replace(c, @"^Class\s*", "", RegexOptions.IgnoreCase);
        c = Regex.Replace(c, @"^कक्षा\s*", "", RegexOptions.IgnoreCase);

        c = Regex.Replace(c, @"\b1st\b", "1", RegexOptions.IgnoreCase);
        c = Regex.Replace(c, @"\b2nd\b", "2", RegexOptions.IgnoreCase);
        c = Regex.Replace(c, @"\b3rd\b", "3", RegexOptions.IgnoreCase);
        c = Regex.Replace(c, @"\b([0-9]+)th\b", "$1", RegexOptions.IgnoreCase);

        return $"कक्षा {c}";
    }

    public async Task<byte[]> SynthesizeSpeechAsync(
        string text,
        string voiceName = "hi-IN-SwaraNeural",
        string outputFormat = "audio-24khz-48kbitrate-mono-mp3",
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new ArgumentException("Text cannot be empty for voice synthesis.", nameof(text));
        }

        try
        {
            _logger.LogInformation("🎙️ [AI Voice Engine] Synthesizing speech via Edge Neural TTS v2 for voice: {Voice}", voiceName);
            var audioBytes = await SynthesizeViaEdgeWebSocketAsync(text, voiceName, outputFormat, cancellationToken);
            if (audioBytes != null && audioBytes.Length > 0)
            {
                _logger.LogInformation("✅ [AI Voice Engine] Speech synthesis completed. Generated {Size} bytes for {Voice}.", audioBytes.Length, voiceName);
                return audioBytes;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "⚠️ [AI Voice Engine] Edge Neural TTS v2 error for {Voice}. Switching to fallback speech synthesizer...", voiceName);
        }

        // Secondary resilient fallback
        return await SynthesizeViaFallbackRestAsync(text, cancellationToken);
    }

    private static uint SwapHalves(uint value) => (value << 16) | (value >> 16);

    private static uint SwapTerm(uint word, uint key, uint swappedWord, uint swappedSum, uint swappedProduct)
    {
        uint sum = (word * key) + (SwapHalves(word) * swappedWord);
        uint product = SwapHalves(sum) * swappedSum;
        return (SwapHalves(product) * swappedProduct) + product;
    }

    private static uint SwapAndMultiply(uint value, uint[] multipliers)
    {
        foreach (var multiplier in multipliers)
        {
            value = SwapHalves(value) * multiplier;
        }
        return value;
    }

    private static byte[] Cs64(byte[] message, byte[] digest)
    {
        uint firstKey = BitConverter.ToUInt32(digest, 0) | 1u;
        uint secondKey = BitConverter.ToUInt32(digest, 4) | 1u;

        int paddedLen = ((message.Length + 7) / 8) * 8;
        byte[] padded = new byte[paddedLen];
        Array.Copy(message, padded, message.Length);

        uint swapSum = 0;
        uint lastSwap = 0;
        uint mix = 0;
        uint mixSum = 0;

        for (int offset = 0; offset < paddedLen; offset += 8)
        {
            uint firstWord = BitConverter.ToUInt32(padded, offset);
            uint secondWord = BitConverter.ToUInt32(padded, offset + 4);

            uint firstSwap = SwapTerm(firstWord, firstKey, 0xEF0569FB, 0x76F50F34, 0xC3EFEA97);
            lastSwap = SwapTerm(secondWord, secondKey, 0xC31713DB, 0x1881CE3C, 0x35BD1EC9);

            swapSum += firstSwap + lastSwap;

            mix = SwapAndMultiply((mix + firstWord) * firstKey, MixFirstWord);
            mixSum += mix;

            mix = SwapAndMultiply((mix + secondWord) * secondKey, MixSecondWord);
            mixSum += mix;
        }

        byte[] checksum = new byte[8];
        BinaryPrimitives.WriteUInt32LittleEndian(checksum.AsSpan(0, 4), lastSwap ^ mix);
        BinaryPrimitives.WriteUInt32LittleEndian(checksum.AsSpan(4, 4), swapSum ^ mixSum);
        return checksum;
    }

    private static string GenerateSecMsGecV2()
    {
        var unixTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var ticks = unixTime + 11644473600L;
        var rounded = ticks - (ticks % 300L);
        var windowsTicks = rounded * 10000000L;
        var ticksAndToken = $"{windowsTicks}{TrustedToken}";

        const string edgeCopyright = "Copyright (C) Microsoft Corporation. All rights reserved.";
        byte[] message = Encoding.UTF8.GetBytes(edgeCopyright + ticksAndToken);
        byte[] digest = SHA256.HashData(message);
        byte[] checksum = Cs64(message, digest);

        return $"{Convert.ToHexString(checksum)}-{Convert.ToHexString(digest)}";
    }

    private async Task<byte[]> SynthesizeViaEdgeWebSocketAsync(
        string text,
        string voiceName,
        string outputFormat,
        CancellationToken cancellationToken)
    {
        using var ws = new ClientWebSocket();
        ws.Options.SetRequestHeader("Origin", EdgeOrigin);
        ws.Options.SetRequestHeader("User-Agent", EdgeUserAgent);
        ws.Options.SetRequestHeader("Pragma", "no-cache");
        ws.Options.SetRequestHeader("Cache-Control", "no-cache");

        var connId = Guid.NewGuid().ToString("N");
        var secMsGec = GenerateSecMsGecV2();
        var uri = new Uri($"{EdgeWssBase}&ConnectionId={connId}&Sec-MS-GEC={secMsGec}&Sec-MS-GEC-Version=2-143.0.3650.96");

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(TimeSpan.FromSeconds(15)); // 15 sec safety timeout

        await ws.ConnectAsync(uri, cts.Token);

        // 1. Send speech.config
        var configPayload = new
        {
            context = new
            {
                synthesis = new
                {
                    audio = new
                    {
                        metadataoptions = new
                        {
                            sentenceBoundaryEnabled = "false",
                            wordBoundaryEnabled = "false"
                        },
                        outputFormat = outputFormat
                    }
                }
            }
        };

        var configJson = JsonSerializer.Serialize(configPayload);
        var configMsg = $"Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{configJson}";
        var configBytes = Encoding.UTF8.GetBytes(configMsg);
        await ws.SendAsync(new ArraySegment<byte>(configBytes), WebSocketMessageType.Text, true, cts.Token);

        // 2. Send SSML
        var reqId = Guid.NewGuid().ToString("N");
        var escapedText = SecurityElement.Escape(text);
        var ssml = $"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='hi-IN'>" +
                   $"<voice name='{voiceName}'><prosody rate='+0%' pitch='+0%'>{escapedText}</prosody></voice></speak>";
        var ssmlMsg = $"X-RequestId:{reqId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n{ssml}";
        var ssmlBytes = Encoding.UTF8.GetBytes(ssmlMsg);
        await ws.SendAsync(new ArraySegment<byte>(ssmlBytes), WebSocketMessageType.Text, true, cts.Token);

        // 3. Receive audio stream
        using var ms = new MemoryStream();
        var buffer = new byte[8192];

        while (ws.State == WebSocketState.Open && !cts.Token.IsCancellationRequested)
        {
            var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), cts.Token);

            if (result.MessageType == WebSocketMessageType.Close)
            {
                break;
            }

            if (result.MessageType == WebSocketMessageType.Text)
            {
                var textMsg = Encoding.UTF8.GetString(buffer, 0, result.Count);
                if (textMsg.Contains("Path:turn.end", StringComparison.OrdinalIgnoreCase))
                {
                    break;
                }
            }
            else if (result.MessageType == WebSocketMessageType.Binary && result.Count > 2)
            {
                var headerLen = (buffer[0] << 8) | buffer[1];
                var audioStart = 2 + headerLen;

                if (result.Count > audioStart)
                {
                    var audioLength = result.Count - audioStart;
                    ms.Write(buffer, audioStart, audioLength);
                }
            }
        }

        try
        {
            if (ws.State == WebSocketState.Open)
            {
                await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Done", CancellationToken.None);
            }
        }
        catch { }

        return ms.ToArray();
    }

    private async Task<byte[]> SynthesizeViaFallbackRestAsync(string text, CancellationToken cancellationToken)
    {
        _logger.LogInformation("🔄 [AI Voice Engine] Invoking resilient audio fallback synthesizer for Hindi text...");
        var cleanText = text.Length > 200 ? text.Substring(0, 197) + "..." : text;
        var encoded = Uri.EscapeDataString(cleanText);
        var url = $"https://translate.google.com/translate_tts?ie=UTF-8&tl=hi&client=tw-ob&q={encoded}";

        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.UserAgent.ParseAdd(EdgeUserAgent);

        var response = await _httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        var audioBytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
        _logger.LogInformation("✅ [AI Voice Engine] Fallback audio generated successfully ({Size} bytes).", audioBytes.Length);
        return audioBytes;
    }
}
