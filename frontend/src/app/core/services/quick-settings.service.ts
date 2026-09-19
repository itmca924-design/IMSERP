import { Injectable, signal, effect } from '@angular/core';

export type ErpThemeMode = 'light' | 'dark' | 'auto';
export type ErpAccentColor = 'indigo' | 'emerald' | 'blue' | 'purple' | 'amber' | 'rose' | 'teal' | 'cyan' | 'orange' | 'lime' | 'crimson' | 'slate';
export type ErpDensity = 'comfortable' | 'compact';

export interface ErpSettingsState {
  theme: ErpThemeMode;
  accent: ErpAccentColor;
  academicSession: string;
  density: ErpDensity;
  whatsappFeeAlerts: boolean;
  absentSmsAlerts: boolean;
  dueFeeReminders: boolean;
  biometricSync: boolean;
  lateFeeCalc: boolean;
  soundEffects: boolean;
  autoRefreshInterval: number; // in seconds, 0 = off
}

const STORAGE_KEY = 'imserp_quick_settings_v1';

const DEFAULT_SETTINGS: ErpSettingsState = {
  theme: 'light',
  accent: 'indigo',
  academicSession: '2026-2027',
  density: 'comfortable',
  whatsappFeeAlerts: true,
  absentSmsAlerts: true,
  dueFeeReminders: true,
  biometricSync: true,
  lateFeeCalc: true,
  soundEffects: true,
  autoRefreshInterval: 0
};

@Injectable({
  providedIn: 'root'
})
export class QuickSettingsService {
  // Drawer open/close state
  readonly isDrawerOpen = signal<boolean>(false);

  // Settings signals
  readonly theme = signal<ErpThemeMode>(DEFAULT_SETTINGS.theme);
  readonly accent = signal<ErpAccentColor>(DEFAULT_SETTINGS.accent);
  readonly academicSession = signal<string>(DEFAULT_SETTINGS.academicSession);
  readonly density = signal<ErpDensity>(DEFAULT_SETTINGS.density);
  readonly whatsappFeeAlerts = signal<boolean>(DEFAULT_SETTINGS.whatsappFeeAlerts);
  readonly absentSmsAlerts = signal<boolean>(DEFAULT_SETTINGS.absentSmsAlerts);
  readonly dueFeeReminders = signal<boolean>(DEFAULT_SETTINGS.dueFeeReminders);
  readonly biometricSync = signal<boolean>(DEFAULT_SETTINGS.biometricSync);
  readonly lateFeeCalc = signal<boolean>(DEFAULT_SETTINGS.lateFeeCalc);
  readonly soundEffects = signal<boolean>(DEFAULT_SETTINGS.soundEffects);
  readonly autoRefreshInterval = signal<number>(DEFAULT_SETTINGS.autoRefreshInterval);

  constructor() {
    this.loadFromStorage();

    // Setup effect to persist and apply DOM classes whenever settings change
    effect(() => {
      const state: ErpSettingsState = {
        theme: this.theme(),
        accent: this.accent(),
        academicSession: this.academicSession(),
        density: this.density(),
        whatsappFeeAlerts: this.whatsappFeeAlerts(),
        absentSmsAlerts: this.absentSmsAlerts(),
        dueFeeReminders: this.dueFeeReminders(),
        biometricSync: this.biometricSync(),
        lateFeeCalc: this.lateFeeCalc(),
        soundEffects: this.soundEffects(),
        autoRefreshInterval: this.autoRefreshInterval()
      };
      this.saveToStorage(state);
      this.applyToDom(state);
    });
  }

  toggleDrawer(open?: boolean): void {
    if (typeof open === 'boolean') {
      this.isDrawerOpen.set(open);
    } else {
      this.isDrawerOpen.update(v => !v);
    }

    if (this.isDrawerOpen() && this.soundEffects()) {
      this.playChime(640, 0.08, 'sine');
    }
  }

  setTheme(mode: ErpThemeMode): void {
    this.theme.set(mode);
    if (this.soundEffects()) this.playChime(800, 0.06);
  }

  setAccent(color: ErpAccentColor): void {
    this.accent.set(color);
    if (this.soundEffects()) this.playChime(900, 0.06);
  }

  setAcademicSession(session: string): void {
    this.academicSession.set(session);
    if (this.soundEffects()) this.playChime(520, 0.1);
  }

  setDensity(density: ErpDensity): void {
    this.density.set(density);
  }

  toggleWhatsappFee(val?: boolean): void {
    this.whatsappFeeAlerts.update(v => typeof val === 'boolean' ? val : !v);
  }

  toggleAbsentSms(val?: boolean): void {
    this.absentSmsAlerts.update(v => typeof val === 'boolean' ? val : !v);
  }

  toggleDueFeeReminders(val?: boolean): void {
    this.dueFeeReminders.update(v => typeof val === 'boolean' ? val : !v);
  }

  toggleBiometricSync(val?: boolean): void {
    this.biometricSync.update(v => typeof val === 'boolean' ? val : !v);
  }

  toggleLateFeeCalc(val?: boolean): void {
    this.lateFeeCalc.update(v => typeof val === 'boolean' ? val : !v);
  }

  toggleSoundEffects(val?: boolean): void {
    this.soundEffects.update(v => typeof val === 'boolean' ? val : !v);
  }

  setAutoRefreshInterval(sec: number): void {
    this.autoRefreshInterval.set(sec);
  }

  resetToDefaults(): void {
    this.theme.set(DEFAULT_SETTINGS.theme);
    this.accent.set(DEFAULT_SETTINGS.accent);
    this.academicSession.set(DEFAULT_SETTINGS.academicSession);
    this.density.set(DEFAULT_SETTINGS.density);
    this.whatsappFeeAlerts.set(DEFAULT_SETTINGS.whatsappFeeAlerts);
    this.absentSmsAlerts.set(DEFAULT_SETTINGS.absentSmsAlerts);
    this.dueFeeReminders.set(DEFAULT_SETTINGS.dueFeeReminders);
    this.biometricSync.set(DEFAULT_SETTINGS.biometricSync);
    this.lateFeeCalc.set(DEFAULT_SETTINGS.lateFeeCalc);
    this.soundEffects.set(DEFAULT_SETTINGS.soundEffects);
    this.autoRefreshInterval.set(DEFAULT_SETTINGS.autoRefreshInterval);
  }

  /**
   * Play a clean, subtle synthesizer audio chime via Web Audio API
   */
  playChime(freq = 587.33, duration = 0.12, type: OscillatorType = 'sine'): void {
    if (!this.soundEffects()) return;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.35, audioCtx.currentTime + duration);

      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {
      // Audio context might be restricted before user gesture
    }
  }

  clearLocalCacheAndReload(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.includes('token') && !key.includes('auth') && !key.includes('user')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
      window.location.reload();
    } catch (e) {
      window.location.reload();
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ErpSettingsState>;

      if (parsed.theme) this.theme.set(parsed.theme);
      if (parsed.accent) this.accent.set(parsed.accent);
      if (parsed.academicSession) this.academicSession.set(parsed.academicSession);
      if (parsed.density) this.density.set(parsed.density);
      if (typeof parsed.whatsappFeeAlerts === 'boolean') this.whatsappFeeAlerts.set(parsed.whatsappFeeAlerts);
      if (typeof parsed.absentSmsAlerts === 'boolean') this.absentSmsAlerts.set(parsed.absentSmsAlerts);
      if (typeof parsed.dueFeeReminders === 'boolean') this.dueFeeReminders.set(parsed.dueFeeReminders);
      if (typeof parsed.biometricSync === 'boolean') this.biometricSync.set(parsed.biometricSync);
      if (typeof parsed.lateFeeCalc === 'boolean') this.lateFeeCalc.set(parsed.lateFeeCalc);
      if (typeof parsed.soundEffects === 'boolean') this.soundEffects.set(parsed.soundEffects);
      if (typeof parsed.autoRefreshInterval === 'number') this.autoRefreshInterval.set(parsed.autoRefreshInterval);
    } catch {
      // Ignore storage parse issues
    }
  }

  private saveToStorage(state: ErpSettingsState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable or quota exceeded
    }
  }

  private applyToDom(state: ErpSettingsState): void {
    if (typeof document === 'undefined') return;
    const body = document.body;

    // Theme mode
    const isDark = state.theme === 'dark' || 
      (state.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      body.classList.add('erp-dark-theme');
    } else {
      body.classList.remove('erp-dark-theme');
    }

    // Density
    if (state.density === 'compact') {
      body.classList.add('erp-compact');
    } else {
      body.classList.remove('erp-compact');
    }

    // Accent Palette — remove all, then apply selected
    const accents: ErpAccentColor[] = [
      'indigo', 'emerald', 'blue', 'purple', 'amber',
      'rose', 'teal', 'cyan', 'orange', 'lime', 'crimson', 'slate'
    ];
    accents.forEach(a => body.classList.remove(`theme-${a}`));
    body.classList.add(`theme-${state.accent}`);
  }
}
