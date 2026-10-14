import { Injectable, signal, computed, effect } from '@angular/core';
import { SupportedLanguage, EN_TRANSLATIONS, HI_TRANSLATIONS } from '../i18n/translations';

const STORAGE_KEY = 'imserp_lang';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private readonly defaultLang: SupportedLanguage = 'en';

  readonly currentLang = signal<SupportedLanguage>(this.getInitialLanguage());

  readonly isHindi = computed(() => this.currentLang() === 'hi');
  readonly isEnglish = computed(() => this.currentLang() === 'en');

  constructor() {
    // Keep html lang attribute in sync with currentLang signal
    effect(() => {
      const lang = this.currentLang();
      try {
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('lang', lang);
        }
      } catch {}
    });

    // Sync Google Translate cookie on boot
    const initial = this.currentLang();
    if (initial === 'hi') {
      try {
        const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `googtrans=/en/hi; expires=${expires}; path=/;`;
      } catch {}
    }
  }

  private getInitialLanguage(): SupportedLanguage {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as SupportedLanguage;
      if (saved === 'hi' || saved === 'en') {
        return saved;
      }
    } catch {}
    return this.defaultLang;
  }

  setLanguage(lang: SupportedLanguage): void {
    if (this.currentLang() === lang) return;
    this.currentLang.set(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
    this.syncGoogleTranslate(lang);
  }

  syncGoogleTranslate(lang: SupportedLanguage): void {
    if (typeof document === 'undefined') return;

    try {
      const targetVal = lang === 'hi' ? '/en/hi' : '/en/en';
      const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();

      // Write cookie to root
      document.cookie = `googtrans=${targetVal}; expires=${expires}; path=/;`;
      if (window.location.hostname && window.location.hostname !== 'localhost') {
        document.cookie = `googtrans=${targetVal}; expires=${expires}; path=/; domain=.${window.location.hostname};`;
      }

      // Check if Google Translate combo select exists in DOM
      const combo = document.querySelector<HTMLSelectElement>('.goog-te-combo');
      if (combo) {
        combo.value = lang;
        combo.dispatchEvent(new Event('change'));
      } else {
        // If Google Translate element isn't in DOM yet, reload with cookie active
        setTimeout(() => {
          const combo2 = document.querySelector<HTMLSelectElement>('.goog-te-combo');
          if (combo2) {
            combo2.value = lang;
            combo2.dispatchEvent(new Event('change'));
          } else {
            window.location.reload();
          }
        }, 150);
      }
    } catch (e) {
      console.warn('Google Translate sync exception:', e);
    }
  }

  toggleLanguage(): void {
    const nextLang = this.currentLang() === 'en' ? 'hi' : 'en';
    this.setLanguage(nextLang);
  }

  translate(keyOrText: string, params?: Record<string, any>): string {
    if (!keyOrText) return '';

    const lang = this.currentLang();
    let text = '';

    if (lang === 'hi') {
      text = HI_TRANSLATIONS[keyOrText] || HI_TRANSLATIONS[keyOrText.trim()] || '';
      if (!text) {
        // Fallback to English dictionary or key itself
        text = EN_TRANSLATIONS[keyOrText] || keyOrText;
      }
    } else {
      text = EN_TRANSLATIONS[keyOrText] || EN_TRANSLATIONS[keyOrText.trim()] || keyOrText;
    }

    if (params && Object.keys(params).length > 0) {
      for (const [paramKey, paramVal] of Object.entries(params)) {
        text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramVal));
      }
    }

    return text;
  }

  t(keyOrText: string, params?: Record<string, any>): string {
    return this.translate(keyOrText, params);
  }
}
