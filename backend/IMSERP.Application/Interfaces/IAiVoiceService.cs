namespace IMSERP.Application.Interfaces;

public interface IAiVoiceService
{
    /// <summary>
    /// Generates dynamic Hindi speech audio bytes for a personalized fee dues reminder.
    /// </summary>
    Task<byte[]> GenerateDuesReminderVoiceAsync(
        string parentName,
        string studentName,
        string className,
        decimal dueAmount,
        string monthName,
        int dueDay,
        string instituteName,
        string voiceGender = "Female",
        string outputFormat = "audio-24khz-48kbitrate-mono-mp3",
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Generates natural speech audio bytes from arbitrary text in Hindi or English using Edge Neural TTS.
    /// </summary>
    Task<byte[]> SynthesizeSpeechAsync(
        string text,
        string voiceName = "hi-IN-SwaraNeural",
        string outputFormat = "audio-24khz-48kbitrate-mono-mp3",
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Constructs respectful and natural Hindi script for fee reminder.
    /// </summary>
    string BuildHindiScript(
        string parentName,
        string studentName,
        string className,
        decimal dueAmount,
        string monthName,
        int dueDay,
        string instituteName
    );
}
