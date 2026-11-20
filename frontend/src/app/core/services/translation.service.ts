import { Injectable, signal, computed, effect } from '@angular/core';

export type SupportedLanguage = 'en' | 'hi';

const STORAGE_KEY = 'imserp_lang';

export function clearAllGoogleTransCookies(): void {
  if (typeof document === 'undefined') return;
  try {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    const domains: string[] = ['', hostname, `.${hostname}`];
    if (parts.length > 2) {
      const rootDomain = parts.slice(-2).join('.');
      domains.push(rootDomain, `.${rootDomain}`);
    }
    const paths = ['/', '', '/coaching', '/school', '/dashboard'];
    const names = ['googtrans', '_googtrans', 'googtrans_en'];
    const past = 'Thu, 01 Jan 1970 00:00:00 GMT; max-age=0;';

    domains.forEach(d => {
      paths.forEach(p => {
        names.forEach(name => {
          let str = `${name}=; expires=${past}`;
          if (p) str += ` path=${p};`;
          if (d) str += ` domain=${d};`;
          document.cookie = str;
        });
      });
    });

    document.documentElement.classList.remove('translated-ltr', 'translated-rtl');
    document.body?.classList.remove('translated-ltr', 'translated-rtl');
  } catch (e) {
    console.warn('Error clearing googtrans cookies:', e);
  }
}

export function setHindiGoogleTransCookie(): void {
  if (typeof document === 'undefined') return;
  try {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();

    document.cookie = `googtrans=/en/hi; expires=${expires}; path=/;`;
    if (hostname && hostname !== 'localhost') {
      document.cookie = `googtrans=/en/hi; expires=${expires}; path=/; domain=.${hostname};`;
      document.cookie = `googtrans=/en/hi; expires=${expires}; path=/; domain=${hostname};`;
      if (parts.length > 2) {
        const rootDomain = parts.slice(-2).join('.');
        document.cookie = `googtrans=/en/hi; expires=${expires}; path=/; domain=.${rootDomain};`;
        document.cookie = `googtrans=/en/hi; expires=${expires}; path=/; domain=${rootDomain};`;
      }
    }
  } catch (e) {
    console.warn('Error setting googtrans cookie:', e);
  }
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private readonly defaultLang: SupportedLanguage = 'en';

  readonly currentLang = signal<SupportedLanguage>('en');

  readonly isHindi = computed(() => this.currentLang() === 'hi');
  readonly isEnglish = computed(() => this.currentLang() === 'en');

  constructor() {
    let saved: SupportedLanguage = 'en';
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(STORAGE_KEY);
        if (val === 'hi') {
          saved = 'hi';
        }
      }
    } catch {}

    this.currentLang.set(saved);

    // Keep html lang attribute in sync with currentLang signal
    effect(() => {
      const lang = this.currentLang();
      try {
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('lang', lang);
        }
      } catch {}
    });

    // Synchronize Google Translate with saved language on initial load
    if (saved === 'hi') {
      this.applyTranslation('hi');
    } else {
      clearAllGoogleTransCookies();
    }
  }

  setLanguage(lang: SupportedLanguage): void {
    if (this.currentLang() === lang) {
      return;
    }

    this.currentLang.set(lang);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, lang);
      }
    } catch {}

    this.applyTranslation(lang);
  }

  toggleLanguage(): void {
    const nextLang = this.currentLang() === 'en' ? 'hi' : 'en';
    this.setLanguage(nextLang);
  }

  applyTranslation(lang: SupportedLanguage, retryCount = 0): void {
    if (typeof document === 'undefined') return;

    try {
      const isHindi = lang === 'hi';

      if (isHindi) {
        setHindiGoogleTransCookie();
      } else {
        clearAllGoogleTransCookies();
      }

      // Ensure Google Translate script is injected if not already
      if (!document.getElementById('google-translate-script')) {
        const s = document.createElement('script');
        s.id = 'google-translate-script';
        s.type = 'text/javascript';
        s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        s.async = true;
        document.body.appendChild(s);
      }

      const combo = document.querySelector<HTMLSelectElement>('.goog-te-combo');
      if (combo) {
        if (isHindi) {
          combo.value = 'hi';
        } else {
          combo.value = '';
          combo.selectedIndex = 0;

          try {
            const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe');
            iframes.forEach(f => {
              try {
                const btn = f.contentDocument?.querySelector<HTMLElement>('.goog-close-link, [id$=".restore"]');
                if (btn) btn.click();
              } catch {}
            });
          } catch {}

          document.documentElement.classList.remove('translated-ltr', 'translated-rtl');
          document.body?.classList.remove('translated-ltr', 'translated-rtl');
        }

        combo.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof (combo as any).onchange === 'function') {
          (combo as any).onchange();
        }
        return;
      }

      // Retry up to 30 times (every 100ms for 3.0s) while Google Translate initializes
      if (retryCount < 30) {
        setTimeout(() => this.applyTranslation(lang, retryCount + 1), 100);
      }
    } catch (e) {
      console.warn('Google Translate sync exception:', e);
    }
  }

  translate(keyOrText: string, params?: Record<string, any>): string {
    return keyOrText || '';
  }

  t(keyOrText: string, params?: Record<string, any>): string {
    return keyOrText || '';
  }
}
