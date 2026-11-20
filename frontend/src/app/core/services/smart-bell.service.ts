import { Injectable, signal, computed, inject } from '@angular/core';
import { SchoolService, SchoolPeriodSlotDto, SmartBellSettingDto } from './school.service';
import { RoomService, RoomDto } from './room.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class SmartBellService {
  private readonly schoolService = inject(SchoolService);
  private readonly roomService = inject(RoomService);
  private readonly authService = inject(AuthService);

  readonly settings = signal<SmartBellSettingDto>({
    isEnabled: true,
    preBellWarningMinutes: 2,
    voiceAnnouncementEnabled: true,
    voiceLanguage: 'hi-IN',
    bellType: 'ElectricGong',
    bellDurationSeconds: 3,
    lunchBellDurationSeconds: 8,
    dismissalBellDurationSeconds: 12,
    volume: 100,
    broadcastMode: 'AllCall',
    silentOnHolidays: true,
    warningTemplateHi: 'ध्यान दें: {periodName} समाप्त होने में {remainingMinutes} मिनट शेष हैं। कृपया अपना व्याख्यान समेटें।',
    warningTemplateEn: 'Attention: {periodName} is ending in {remainingMinutes} minutes. Please wrap up the lesson.',
    periodOverTemplateHi: '{periodName} का समय समाप्त हो चुका है।',
    periodOverTemplateEn: '{periodName} has concluded.'
  });

  readonly periodSlots = signal<SchoolPeriodSlotDto[]>([]);
  readonly activeRooms = signal<RoomDto[]>([]);

  readonly currentSlot = signal<SchoolPeriodSlotDto | null>(null);
  readonly nextSlot = signal<SchoolPeriodSlotDto | null>(null);
  readonly remainingSeconds = signal<number>(0);
  readonly isWarningAnnounced = signal<boolean>(false);
  readonly isBellFired = signal<boolean>(false);
  readonly isPlayingAudio = signal<boolean>(false);
  readonly isSpeaking = signal<boolean>(false);

  readonly remainingMinutesFormatted = computed(() => {
    const s = this.remainingSeconds();
    if (s <= 0) return '00:00';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  });

  private timerRef: any = null;
  private audioCtx: AudioContext | null = null;
  private lastAnnouncedSlotId: string | null = null;

  constructor() {
    this.initService();
  }

  private initService(): void {
    this.refreshSettings();
    this.refreshPeriodSlots();
    this.refreshRooms();

    // Start 5-second interval loop for zero-touch precision monitoring
    if (typeof window !== 'undefined') {
      this.timerRef = setInterval(() => this.tick(), 5000);
      // Run first tick after 1s
      setTimeout(() => this.tick(), 1000);
    }
  }

  refreshSettings(): void {
    const branchId = this.authService.selectedBranchId() || null;
    this.schoolService.getSmartBellSettings(branchId).subscribe({
      next: (s) => {
        if (s) {
          this.settings.set(s);
        }
      },
      error: () => {}
    });
  }

  refreshPeriodSlots(): void {
    const branchId = this.authService.selectedBranchId() || undefined;
    this.schoolService.getPeriodSlots(branchId, true).subscribe({
      next: (slots) => {
        if (slots) {
          this.periodSlots.set(slots);
          this.tick();
        }
      },
      error: () => {}
    });
  }

  refreshRooms(): void {
    const branchId = this.authService.selectedBranchId() || undefined;
    this.roomService.getRooms(branchId).subscribe({
      next: (rooms) => {
        if (rooms) {
          this.activeRooms.set(rooms.filter(r => r.isActive));
        }
      },
      error: () => {}
    });
  }

  /**
   * Main IST clock tick matching timetable period slots
   */
  tick(): void {
    const s = this.settings();
    if (!s.isEnabled) {
      this.currentSlot.set(null);
      this.nextSlot.set(null);
      this.remainingSeconds.set(0);
      return;
    }

    const slots = this.periodSlots();
    if (!slots || slots.length === 0) return;

    // Get current Indian Standard Time (IST)
    const now = new Date();
    // Convert to IST minutes from midnight
    const istOffset = 5.5 * 60; // IST is UTC + 5:30
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60;
    const currentIstMinutes = (utcMinutes + istOffset) % (24 * 60);

    let active: SchoolPeriodSlotDto | null = null;
    let next: SchoolPeriodSlotDto | null = null;
    let secLeft = 0;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const startMin = this.parseTimeToMinutes(slot.startTime);
      const endMin = this.parseTimeToMinutes(slot.endTime);

      if (startMin <= endMin) {
        if (currentIstMinutes >= startMin && currentIstMinutes < endMin) {
          active = slot;
          secLeft = Math.round((endMin - currentIstMinutes) * 60);
          next = slots[i + 1] || null;
          break;
        } else if (currentIstMinutes < startMin && !next) {
          next = slot;
        }
      }
    }

    // Reset warning state if slot changed
    if (active?.id !== this.lastAnnouncedSlotId) {
      this.lastAnnouncedSlotId = active ? active.id : null;
      this.isWarningAnnounced.set(false);
      this.isBellFired.set(false);
    }

    this.currentSlot.set(active);
    this.nextSlot.set(next);
    this.remainingSeconds.set(secLeft);

    if (!active) return;

    const warnMinutes = s.preBellWarningMinutes || 2;
    const warnSecondsThreshold = warnMinutes * 60;

    // 1. Pre-Bell Agentic AI Voice Warning
    if (s.voiceAnnouncementEnabled && !this.isWarningAnnounced() && secLeft <= warnSecondsThreshold && secLeft > 10) {
      this.isWarningAnnounced.set(true);
      this.announcePreBellWarning(active, warnMinutes);
    }

    // 2. Period Ending Final Bell
    if (!this.isBellFired() && secLeft <= 5) {
      this.isBellFired.set(true);
      this.triggerPeriodEndBell(active);
    }
  }

  private parseTimeToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const clean = timeStr.trim();
    // Handles formats: "09:00 AM", "9:00 AM", "14:30", "09:00"
    const match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return 0;

    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const modifier = match[3] ? match[3].toUpperCase() : null;

    if (modifier === 'PM' && h < 12) h += 12;
    if (modifier === 'AM' && h === 12) h = 0;

    return h * 60 + m;
  }

  /**
   * Pre-Bell Voice Warning via Speech Synthesis
   */
  announcePreBellWarning(slot: SchoolPeriodSlotDto, remainingMinutes: number): void {
    const s = this.settings();
    const lang = s.voiceLanguage || 'hi-IN';
    const isHi = lang.startsWith('hi');

    let template = isHi ? s.warningTemplateHi : s.warningTemplateEn;
    if (!template) {
      template = isHi
        ? 'ध्यान दें: {periodName} समाप्त होने में {remainingMinutes} मिनट शेष हैं। कृपया अपना व्याख्यान समेटें।'
        : 'Attention: {periodName} is ending in {remainingMinutes} minutes. Please wrap up the lesson.';
    }

    const message = template
      .replace(/{periodName}/g, slot.name)
      .replace(/{remainingMinutes}/g, remainingMinutes.toString());

    // Play gentle attention chime first, then speak
    this.playMelodicChime(0.6);
    setTimeout(() => {
      this.speakText(message, lang, (s.volume || 100) / 100);
    }, 1200);

    this.dispatchToSpeakers('warning', slot, message);
  }

  /**
   * Period End Bell & Announcement
   */
  triggerPeriodEndBell(slot: SchoolPeriodSlotDto): void {
    const s = this.settings();
    let duration = s.bellDurationSeconds || 3;
    if (slot.isBreak || slot.slotType === 'Break') {
      duration = s.lunchBellDurationSeconds || 8;
    }

    this.playBell(s.bellType || 'ElectricGong', duration, (s.volume || 100) / 100);

    if (s.voiceAnnouncementEnabled) {
      const lang = s.voiceLanguage || 'hi-IN';
      const isHi = lang.startsWith('hi');
      let template = isHi ? s.periodOverTemplateHi : s.periodOverTemplateEn;
      if (!template) {
        template = isHi ? '{periodName} का समय समाप्त हो चुका है।' : '{periodName} has concluded.';
      }
      const message = template.replace(/{periodName}/g, slot.name);

      setTimeout(() => {
        this.speakText(message, lang, (s.volume || 100) / 100);
      }, (duration + 0.5) * 1000);
    }

    this.dispatchToSpeakers('bell', slot, slot.name);
  }

  /**
   * Dispatch trigger to classroom Wi-Fi IP speakers
   */
  private dispatchToSpeakers(action: 'warning' | 'bell', slot: SchoolPeriodSlotDto, payload: string): void {
    const s = this.settings();
    if (s.broadcastMode !== 'RoomSpeakers') return;

    const roomsWithSpeakers = this.activeRooms().filter(r => !!r.speakerIp);
    for (const room of roomsWithSpeakers) {
      // Trigger via local IP speaker HTTP endpoint
      try {
        const url = `http://${room.speakerIp}:${room.speakerPort || 80}/api/play?action=${action}&name=${encodeURIComponent(slot.name)}`;
        fetch(url, { method: 'GET', mode: 'no-cors' }).catch(() => {});
      } catch {}
    }
  }

  /**
   * Realistic Web Audio API Synthesizer (Electric Gong, Brass Bell, Melodic Chime)
   */
  playBell(bellType: string, durationSeconds: number = 3, volume: number = 1.0): void {
    if (bellType === 'BrassBell') {
      this.playBrassBell(durationSeconds, volume);
    } else if (bellType === 'MelodicChime') {
      this.playMelodicChime(volume);
    } else {
      this.playElectricGong(durationSeconds, volume);
    }
  }

  playElectricGong(durationSeconds: number = 3, volume: number = 1.0): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      this.isPlayingAudio.set(true);

      const strikes = Math.max(1, Math.floor(durationSeconds / 1.5));
      for (let s = 0; s < strikes; s++) {
        const startTime = ctx.currentTime + (s * 1.4);

        // Multiple harmonious frequencies for realistic electric bell
        const freqs = [440, 880, 1320, 1760];
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = idx === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, startTime);

          const strikeVol = (volume * 0.4) / (idx + 1);
          gain.gain.setValueAtTime(strikeVol, startTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.2);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 1.2);
        });
      }

      setTimeout(() => this.isPlayingAudio.set(false), durationSeconds * 1000);
    } catch (e) {
      console.warn('AudioContext playback error:', e);
      this.isPlayingAudio.set(false);
    }
  }

  playBrassBell(durationSeconds: number = 4, volume: number = 1.0): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      this.isPlayingAudio.set(true);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5

      gain.gain.setValueAtTime(volume * 0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationSeconds);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + durationSeconds);

      setTimeout(() => this.isPlayingAudio.set(false), durationSeconds * 1000);
    } catch {
      this.isPlayingAudio.set(false);
    }
  }

  playMelodicChime(volume: number = 1.0): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      this.isPlayingAudio.set(true);

      // Westminster style 3-note chime (G4, C5, E5)
      const notes = [392.00, 523.25, 659.25];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + (i * 0.35);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(volume * 0.4, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.8);
      });

      setTimeout(() => this.isPlayingAudio.set(false), 1500);
    } catch {
      this.isPlayingAudio.set(false);
    }
  }

  /**
   * Agentic AI Web Speech API Synthesis
   */
  speakText(text: string, lang: string = 'hi-IN', volume: number = 1.0): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported in this browser.');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.volume = Math.min(1.0, Math.max(0.0, volume));
      utterance.rate = 0.95; // slightly deliberate for clear classroom PA broadcast
      utterance.pitch = 1.0;

      // Select matching voice if available
      const voices = window.speechSynthesis.getVoices();
      const matched = voices.find(v => v.lang.toLowerCase().replace('_', '-') === lang.toLowerCase().replace('_', '-'));
      if (matched) {
        utterance.voice = matched;
      }

      this.isSpeaking.set(true);
      utterance.onend = () => this.isSpeaking.set(false);
      utterance.onerror = () => this.isSpeaking.set(false);

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
      this.isSpeaking.set(false);
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }
}
