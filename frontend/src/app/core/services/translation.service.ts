import { Injectable, signal, computed, effect } from '@angular/core';

export type SupportedLanguage = 'en' | 'hi';

const STORAGE_KEY = 'imserp_lang';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private readonly defaultLang: SupportedLanguage = 'en';

  readonly currentLang = signal<SupportedLanguage>('en');

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

    // Always boot cleanly in English on application load
    try {
      localStorage.setItem(STORAGE_KEY, 'en');
    } catch {}
    this.syncGoogleTranslate('en');
  }

  setLanguage(lang: SupportedLanguage): void {
    this.currentLang.set(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
    this.syncGoogleTranslate(lang);
  }

  syncGoogleTranslate(lang: SupportedLanguage, retryCount = 0): void {
    if (typeof document === 'undefined') return;

    try {
      const isHindi = lang === 'hi';
      const hostname = window.location.hostname;

      // 1. Sync cookies across root and domain paths
      if (isHindi) {
        const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `googtrans=/en/hi; expires=${expires}; path=/;`;
        if (hostname && hostname !== 'localhost') {
          document.cookie = `googtrans=/en/hi; expires=${expires}; path=/; domain=.${hostname};`;
          document.cookie = `googtrans=/en/hi; expires=${expires}; path=/; domain=${hostname};`;
        }
      } else {
        // Complete clear of translation cookie for English
        const past = 'Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = `googtrans=; expires=${past}; path=/;`;
        document.cookie = `googtrans=/en/en; path=/;`;
        if (hostname && hostname !== 'localhost') {
          document.cookie = `googtrans=; expires=${past}; path=/; domain=.${hostname};`;
          document.cookie = `googtrans=; expires=${past}; path=/; domain=${hostname};`;
          document.cookie = `googtrans=/en/en; path=/; domain=.${hostname};`;
        }
      }

      // 2. Select language in Google's combo dropdown
      const combo = document.querySelector<HTMLSelectElement>('.goog-te-combo');
      if (combo) {
        if (isHindi) {
          combo.value = 'hi';
        } else {
          // In Google Translate, setting combo value to '' (index 0) triggers restoration to pageLanguage
          combo.value = '';
          combo.selectedIndex = 0;

          // Trigger Google's original text restoration button if present in any frame
          try {
            const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe');
            iframes.forEach(f => {
              try {
                const btn = f.contentDocument?.querySelector<HTMLElement>('.goog-close-link, [id$=".restore"]');
                if (btn) btn.click();
              } catch {}
            });
            document.documentElement.classList.remove('translated-ltr', 'translated-rtl');
          } catch {}
        }

        // Fire standard change events
        combo.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof (combo as any).onchange === 'function') {
          (combo as any).onchange();
        }
        return;
      }

      // 3. If Google widget is still initializing, retry smoothly up to 15 times (1.5 seconds)
      if (retryCount < 15) {
        setTimeout(() => this.syncGoogleTranslate(lang, retryCount + 1), 100);
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
    return keyOrText || '';
  }

  t(keyOrText: string, params?: Record<string, any>): string {
    return keyOrText || '';
  }
}
