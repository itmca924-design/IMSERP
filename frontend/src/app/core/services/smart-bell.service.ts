import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SchoolService, SchoolPeriodSlotDto, SmartBellSettingDto } from './school.service';
import { RoomService, RoomDto } from './room.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class SmartBellService {
  private readonly http = inject(HttpClient);
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
    periodOverTemplateEn: '{periodName} has concluded.',
    isAssemblyEnabled: true,
    assemblyStartTime: '08:45 AM',
    assemblyDurationMinutes: 15,
    assemblyWarningLeadMinutes: 5,
    assemblyDaysOfWeek: 'Mon,Tue,Wed,Thu,Fri,Sat',
    assemblyWarningTemplateHi: 'ध्यान दें: सभी शिक्षक एवं विद्यार्थीगण, प्रातःकालीन प्रार्थना सभा के लिए कृपया मुख्य प्रांगण में एकत्रित हों।',
    assemblyWarningTemplateEn: 'Attention: All teachers and students, please assemble in the main hall or ground for morning prayer assembly.',
    assemblyDismissalTemplateHi: 'प्रार्थना सभा संपन्न हुई। सभी विद्यार्थी कतारबद्ध होकर अनुशासित रूप से अपनी कक्षाओं में प्रस्थान करें।',
    assemblyDismissalTemplateEn: 'Morning prayer has concluded. Students, please proceed to your respective classrooms in an orderly queue.',
    emergencySirenEnabled: true,
    isPhysicalRelayEnabled: false,
    physicalRelayWebhookUrl: null,
    physicalRelayPulseSeconds: 3,
    divisionScope: 'All'
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

  // 🌅 Morning Assembly Status Signals
  readonly isAssemblyLive = signal<boolean>(false);
  readonly isAssemblyUpcoming = signal<boolean>(false);
  readonly assemblyCountdownSeconds = signal<number>(0);

  // 🚨 Emergency Siren Status
  readonly isEmergencyActive = signal<boolean>(false);

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
  private isAssemblyWarningAnnounced = false;
  private isAssemblyBellFired = false;
  private isAssemblyDismissed = false;
  private lastAssemblyDateStr: string = '';
  private emergencyOscillator: OscillatorNode | null = null;

  constructor() {
    this.initService();
  }

  private initService(): void {
    this.refreshSettings();
    this.refreshPeriodSlots();
    this.refreshRooms();

    // Start 1-second interval loop for zero-touch precision countdown & bell monitoring
    if (typeof window !== 'undefined') {
      this.timerRef = setInterval(() => this.tick(), 1000);
      setTimeout(() => this.tick(), 200);

      // Global browser interaction listeners to unlock AudioContext and SpeechSynthesis on valid user gestures (click/pointerup)
      const unlockAudio = () => {
        try {
          if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
          }
          if ('speechSynthesis' in window && window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        } catch {}
      };

      window.addEventListener('click', unlockAudio, { passive: true, once: true });
      window.addEventListener('pointerup', unlockAudio, { passive: true, once: true });
      window.addEventListener('keydown', unlockAudio, { passive: true, once: true });
    }
  }

  refreshSettings(branchId?: string | null): void {
    const bId = branchId !== undefined ? (branchId || null) : (this.authService.selectedBranchId() || null);
    this.schoolService.getSmartBellSettings(bId).subscribe({
      next: (s) => {
        if (s) {
          this.settings.set(s);
        }
      },
      error: () => {}
    });
  }

  refreshPeriodSlots(branchId?: string | null): void {
    const bId = branchId !== undefined ? (branchId || undefined) : (this.authService.selectedBranchId() || undefined);
    this.schoolService.getPeriodSlots(bId, true).subscribe({
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

    // 🌅 Check Morning Assembly Routine
    this.checkAssemblyRoutine(now, currentIstMinutes, s);

    let active: SchoolPeriodSlotDto | null = null;
    let next: SchoolPeriodSlotDto | null = null;
    let secLeft = 0;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot.isActive) continue;
      const startMin = this.parseTimeToMinutes(slot.startTime);
      const endMin = this.parseTimeToMinutes(slot.endTime);

      if (startMin < endMin) {
        if (currentIstMinutes >= startMin && currentIstMinutes < endMin) {
          active = slot;
          secLeft = Math.max(0, Math.round((endMin - currentIstMinutes) * 60));
          next = slots[i + 1] || null;
          break;
        } else if (currentIstMinutes < startMin && !next) {
          next = slot;
        }
      }
    }

    const previousActive = this.currentSlot();

    // If active slot just changed or current period expired
    if (active?.id !== this.lastAnnouncedSlotId) {
      // If previous slot was running and its period-end bell had not fired yet, fire it now!
      if (previousActive && previousActive.id === this.lastAnnouncedSlotId && !this.isBellFired()) {
        this.isBellFired.set(true);
        this.triggerPeriodEndBell(previousActive);
      }
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

    // 2. Period Ending Final Bell (when 2 seconds or less remain)
    if (!this.isBellFired() && secLeft <= 2) {
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
    this.ensureAudioContext().then(ctx => {
      if (ctx) this.playMelodicChime(ctx, 0.6);
    });
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
    this.triggerPhysicalRelay(duration);

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
   * 🌅 Morning Assembly Routine Engine
   */
  private checkAssemblyRoutine(now: Date, currentIstMinutes: number, s: SmartBellSettingDto): void {
    if (!s.isAssemblyEnabled || !s.assemblyStartTime) {
      this.isAssemblyLive.set(false);
      this.isAssemblyUpcoming.set(false);
      return;
    }

    const istOffset = 5.5 * 3600 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentDay = dayNames[istDate.getUTCDay()];
    const todayDateStr = istDate.toISOString().slice(0, 10);

    // Reset daily flags on new calendar date
    if (this.lastAssemblyDateStr !== todayDateStr) {
      this.lastAssemblyDateStr = todayDateStr;
      this.isAssemblyWarningAnnounced = false;
      this.isAssemblyBellFired = false;
      this.isAssemblyDismissed = false;
      this.isAssemblyLive.set(false);
      this.isAssemblyUpcoming.set(false);
    }

    const activeDays = (s.assemblyDaysOfWeek || 'Mon,Tue,Wed,Thu,Fri,Sat')
      .split(',')
      .map(d => d.trim().toLowerCase());

    if (!activeDays.includes(currentDay.toLowerCase())) {
      this.isAssemblyLive.set(false);
      this.isAssemblyUpcoming.set(false);
      return;
    }

    const assemblyStartMin = this.parseTimeToMinutes(s.assemblyStartTime);
    const durationMin = s.assemblyDurationMinutes || 15;
    const assemblyEndMin = assemblyStartMin + durationMin;
    const leadMin = s.assemblyWarningLeadMinutes || 5;
    const calloutStartMin = assemblyStartMin - leadMin;

    // 1. Callout Warning Window (e.g. 5 mins before assembly)
    if (currentIstMinutes >= calloutStartMin && currentIstMinutes < assemblyStartMin) {
      this.isAssemblyUpcoming.set(true);
      this.isAssemblyLive.set(false);
      const secUntil = Math.max(0, Math.round((assemblyStartMin - currentIstMinutes) * 60));
      this.assemblyCountdownSeconds.set(secUntil);

      if (s.voiceAnnouncementEnabled && !this.isAssemblyWarningAnnounced) {
        this.isAssemblyWarningAnnounced = true;
        this.announceAssemblyCallout(s, leadMin);
      }
    }
    // 2. Assembly In Progress
    else if (currentIstMinutes >= assemblyStartMin && currentIstMinutes < assemblyEndMin) {
      this.isAssemblyUpcoming.set(false);
      this.isAssemblyLive.set(true);
      const secLeft = Math.max(0, Math.round((assemblyEndMin - currentIstMinutes) * 60));
      this.assemblyCountdownSeconds.set(secLeft);

      if (!this.isAssemblyBellFired) {
        this.isAssemblyBellFired = true;
        this.triggerAssemblyStartBell(s);
      }
    }
    // 3. Assembly Conclusion & Dispersal
    else if (currentIstMinutes >= assemblyEndMin && currentIstMinutes < (assemblyEndMin + 2)) {
      if (!this.isAssemblyDismissed && this.isAssemblyBellFired) {
        this.isAssemblyDismissed = true;
        this.isAssemblyLive.set(false);
        this.triggerAssemblyConclusion(s);
      }
    } else {
      this.isAssemblyLive.set(false);
      this.isAssemblyUpcoming.set(false);
    }
  }

  announceAssemblyCallout(s: SmartBellSettingDto, leadMinutes: number): void {
    const lang = s.voiceLanguage || 'hi-IN';
    const isHi = lang.startsWith('hi');
    let template = isHi ? s.assemblyWarningTemplateHi : s.assemblyWarningTemplateEn;
    if (!template) {
      template = isHi
        ? 'ध्यान दें: सभी शिक्षक एवं विद्यार्थीगण, प्रातःकालीन प्रार्थना सभा के लिए कृपया मुख्य प्रांगण में एकत्रित हों।'
        : 'Attention: All teachers and students, please assemble in the main hall or ground for morning prayer assembly.';
    }

    const instName = this.authService.getInstituteName() || 'विद्यालय';
    const message = template
      .replace(/{instituteName}/g, instName)
      .replace(/{leadMinutes}/g, leadMinutes.toString());

    this.ensureAudioContext().then(ctx => {
      if (ctx) this.playMelodicChime(ctx, 0.7);
    });
    setTimeout(() => {
      this.speakText(message, lang, (s.volume || 100) / 100);
    }, 1200);

    this.triggerPhysicalRelay(2);
  }

  triggerAssemblyStartBell(s: SmartBellSettingDto): void {
    this.playBell(s.bellType || 'ElectricGong', 4, (s.volume || 100) / 100);
    this.triggerPhysicalRelay(4);
  }

  triggerAssemblyConclusion(s: SmartBellSettingDto): void {
    const lang = s.voiceLanguage || 'hi-IN';
    const isHi = lang.startsWith('hi');
    let template = isHi ? s.assemblyDismissalTemplateHi : s.assemblyDismissalTemplateEn;
    if (!template) {
      template = isHi
        ? 'प्रार्थना सभा संपन्न हुई। सभी विद्यार्थी कतारबद्ध होकर अनुशासित रूप से अपनी कक्षाओं में प्रस्थान करें।'
        : 'Morning prayer has concluded. Students, please proceed to your respective classrooms in an orderly queue.';
    }

    this.playBell(s.bellType || 'ElectricGong', 3, (s.volume || 100) / 100);
    this.triggerPhysicalRelay(3);

    if (s.voiceAnnouncementEnabled) {
      setTimeout(() => {
        this.speakText(template, lang, (s.volume || 100) / 100);
      }, 3500);
    }
  }

  /**
   * 🚨 One-Click Manual Bell & Emergency Siren Triggers
   */
  triggerManualBell(seconds: number = 3): void {
    const s = this.settings();
    this.playBell(s.bellType || 'ElectricGong', seconds, (s.volume || 100) / 100);
    this.triggerPhysicalRelay(seconds);
  }

  triggerEmergencySiren(): void {
    this.isEmergencyActive.set(true);
    const s = this.settings();
    const vol = (s.volume || 100) / 100;

    this.ensureAudioContext().then(ctx => {
      if (ctx) {
        this.playEmergencySirenSound(ctx, 12, vol);
      }
    });

    const lang = s.voiceLanguage || 'hi-IN';
    const msg = lang.startsWith('hi')
      ? 'आपातकालीन चेतावनी: कृपया शांत रहें और तुरंत निकटतम सुरक्षित निकासी द्वार की ओर प्रस्थान करें।'
      : 'Emergency Alert: Please remain calm and proceed immediately to the nearest safe emergency exit.';
    
    setTimeout(() => {
      this.speakText(msg, lang, vol);
    }, 4000);

    this.triggerPhysicalRelay(10);
  }

  stopEmergencySiren(): void {
    this.isEmergencyActive.set(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.emergencyOscillator) {
      try {
        this.emergencyOscillator.stop();
        this.emergencyOscillator.disconnect();
      } catch {}
      this.emergencyOscillator = null;
    }
    this.isPlayingAudio.set(false);
  }

  playEmergencySirenSound(ctx: AudioContext, durationSeconds: number = 10, volume: number = 1.0): void {
    try {
      this.isPlayingAudio.set(true);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(volume * 0.6, ctx.currentTime);

      const cycles = Math.floor(durationSeconds / 1.2);
      for (let i = 0; i < cycles; i++) {
        const t = ctx.currentTime + (i * 1.2);
        osc.frequency.setValueAtTime(500, t);
        osc.frequency.linearRampToValueAtTime(950, t + 0.6);
        osc.frequency.linearRampToValueAtTime(500, t + 1.2);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + durationSeconds);
      this.emergencyOscillator = osc;

      setTimeout(() => {
        this.isPlayingAudio.set(false);
        this.isEmergencyActive.set(false);
      }, durationSeconds * 1000);
    } catch {
      this.isPlayingAudio.set(false);
    }
  }

  /**
   * 🔌 Physical IoT Wi-Fi Relay Switch Webhook Trigger
   */
  triggerPhysicalRelay(durationSeconds: number = 3): void {
    const s = this.settings();
    if (!s.isPhysicalRelayEnabled || !s.physicalRelayWebhookUrl) return;

    try {
      let url = s.physicalRelayWebhookUrl.trim();
      url = url.replace('{pulse}', durationSeconds.toString());
      this.http.get(url, { responseType: 'text' }).subscribe({
        next: () => console.log(`[SmartBell IoT Relay] Fired pulse ${durationSeconds}s`),
        error: (err) => console.warn('[SmartBell IoT Relay Warning]', err?.message || err)
      });
    } catch (e) {
      console.warn('[SmartBell IoT Relay Exception]', e);
    }
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
  async playBell(bellType: string, durationSeconds: number = 3, volume: number = 1.0): Promise<void> {
    const ctx = await this.ensureAudioContext();
    if (!ctx) return;

    if (bellType === 'BrassBell') {
      this.playBrassBell(ctx, durationSeconds, volume);
    } else if (bellType === 'MelodicChime') {
      this.playMelodicChime(ctx, volume);
    } else {
      this.playElectricGong(ctx, durationSeconds, volume);
    }
  }

  playElectricGong(ctx: AudioContext, durationSeconds: number = 3, volume: number = 1.0): void {
    try {
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

  playBrassBell(ctx: AudioContext, durationSeconds: number = 4, volume: number = 1.0): void {
    try {
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

  playMelodicChime(ctx: AudioContext, volume: number = 1.0): void {
    try {
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
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
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

  async ensureAudioContext(): Promise<AudioContext | null> {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {}
    }
    return this.audioCtx;
  }

  private getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }
}
