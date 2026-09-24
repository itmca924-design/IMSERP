import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { QuickSettingsService, ErpThemeMode, ErpAccentColor, ErpDensity } from '../../core/services/quick-settings.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
  selector: 'app-quick-settings-drawer',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    TranslatePipe
  ],
  templateUrl: './quick-settings-drawer.component.html',
  styleUrls: ['./quick-settings-drawer.component.scss']
})
export class QuickSettingsDrawerComponent {
  readonly settingsService = inject(QuickSettingsService);
  readonly authService = inject(AuthService);
  readonly translationService = inject(TranslationService);

  activeTab: 'general' | 'automation' | 'appearance' | 'shortcuts' = 'general';

  readonly academicSessions = ['2026-2027', '2025-2026', '2027-2028'];

  readonly accentOptions: { id: ErpAccentColor; name: string; hex: string }[] = [
    { id: 'indigo',  name: 'Royal Indigo',    hex: '#4f46e5' },
    { id: 'emerald', name: 'Emerald Green',   hex: '#059669' },
    { id: 'blue',    name: 'Sky Blue',        hex: '#0284c7' },
    { id: 'purple',  name: 'Vibrant Purple',  hex: '#7c3aed' },
    { id: 'amber',   name: 'Sunset Amber',    hex: '#d97706' },
    { id: 'rose',    name: 'Rose Pink',       hex: '#e11d48' },
    { id: 'teal',    name: 'Deep Teal',       hex: '#0d9488' },
    { id: 'cyan',    name: 'Electric Cyan',   hex: '#0891b2' },
    { id: 'orange',  name: 'Vivid Orange',    hex: '#ea580c' },
    { id: 'lime',    name: 'Fresh Lime',      hex: '#65a30d' },
    { id: 'crimson', name: 'Crimson Red',     hex: '#dc2626' },
    { id: 'slate',   name: 'Cool Slate',      hex: '#475569' }
  ];

  @HostListener('window:keydown.escape')
  handleEscape(): void {
    if (this.settingsService.isDrawerOpen()) {
      this.settingsService.toggleDrawer(false);
    }
  }

  onToggleDrawer(): void {
    this.settingsService.toggleDrawer();
  }

  onCloseDrawer(): void {
    this.settingsService.toggleDrawer(false);
  }

  setTheme(theme: ErpThemeMode): void {
    this.settingsService.setTheme(theme);
  }

  setAccent(accent: ErpAccentColor): void {
    this.settingsService.setAccent(accent);
  }

  setDensity(density: ErpDensity): void {
    this.settingsService.setDensity(density);
  }

  setAcademicSession(session: string): void {
    this.settingsService.setAcademicSession(session);
  }

  setLanguage(lang: 'en' | 'hi'): void {
    this.translationService.setLanguage(lang);
  }

  toggleLanguage(): void {
    this.translationService.toggleLanguage();
  }

  resetDefaults(): void {
    this.settingsService.resetToDefaults();
  }

  clearCacheAndReload(): void {
    if (confirm('Clear local cache and refresh IMSERP? Unsaved form drafts may be reset.')) {
      this.settingsService.clearLocalCacheAndReload();
    }
  }

  runningJob: string | null = null;
  jobMessage: string | null = null;
  jobSuccess: boolean = true;

  onRunJob(jobName: string, event: MouseEvent): void {
    event.stopPropagation();
    this.runningJob = jobName;
    this.jobMessage = null;

    this.settingsService.runJob(jobName).subscribe({
      next: (res) => {
        this.runningJob = null;
        this.jobSuccess = res.success;
        this.jobMessage = res.message;
        setTimeout(() => {
          if (this.jobMessage === res.message) this.jobMessage = null;
        }, 6000);
      },
      error: (err) => {
        this.runningJob = null;
        this.jobSuccess = false;
        this.jobMessage = err.error?.message || 'Automation trigger failed.';
        setTimeout(() => {
          this.jobMessage = null;
        }, 6000);
      }
    });
  }

  playTestChime(): void {
    this.settingsService.playChime(640, 0.15, 'triangle');
  }
}
