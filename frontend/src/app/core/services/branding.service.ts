import { Injectable, inject, effect } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { AuthService, LoginResponse } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BrandingService {
  private titleService = inject(Title);
  private authService = inject(AuthService);

  private readonly DEFAULT_TITLE = 'SMSERP';
  private readonly DEFAULT_SHORT_TITLE = 'SMSERP';
  private readonly DEFAULT_FAVICON = 'favicon.svg';
  private readonly DEFAULT_APPLE_ICON = 'assets/icons/apple-touch-icon.png';
  private readonly DEFAULT_DESCRIPTION = 'Enterprise ERP solution for School Classes, Coaching Batches, Hybrid Admissions, Fee Collections, and Student Portals.';

  constructor() {
    // Synchronously apply initial branding from storage or domain
    this.initBranding();

    // Automatically update titlebar, favicon, PWA manifest, and app icons whenever currentUser changes
    effect(() => {
      const user = this.authService.currentUser();
      this.applyTenantBranding(user);
    });

    // Also notify Service Worker as soon as it becomes ready
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        this.notifyServiceWorker(this.authService.currentUser(), this.authService.getInstituteLogoUrl());
      }).catch(() => {});
    }
  }

  /**
   * Initializes branding on page boot, resolving from active session,
   * persisted storage, or domain host before login.
   */
  private initBranding(): void {
    const user = this.authService.currentUser();
    this.applyTenantBranding(user);

    if (!user && typeof window !== 'undefined') {
      const code = this.authService.getLastTenantCode() || this.extractTenantFromHost();
      if (code && (!this.authService.getInstituteName() || !this.authService.getInstituteLogoUrl())) {
        this.fetchPublicBranding(code);
      }
    }
  }

  /**
   * Automatically extracts tenant code from domain hostname (e.g. jnandeep.in -> JNANDEEP).
   */
  extractTenantFromHost(): string {
    if (typeof window === 'undefined') return '';
    const host = window.location.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return '';
    const parts = host.split('.');
    if (parts.length >= 2) {
      const sub = parts[0];
      if (sub !== 'www' && sub !== 'app' && sub !== 'erp' && sub !== 'admin' && sub !== 'mail') {
        return sub.toUpperCase();
      }
    }
    return '';
  }

  /**
   * Fetches public branding details for unauthenticated / login screen visitors.
   */
  private fetchPublicBranding(code: string): void {
    if (typeof window === 'undefined' || !code) return;
    fetch(`/api/auth/public-branding?code=${encodeURIComponent(code)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.found) {
          if (data.instituteName && !sessionStorage.getItem('instituteName') && !localStorage.getItem('instituteName')) {
            try { sessionStorage.setItem('instituteName', data.instituteName); } catch (_) {}
          }
          if (data.logoUrl && !sessionStorage.getItem('profilePhoto') && !localStorage.getItem('profilePhoto')) {
            try { sessionStorage.setItem('profilePhoto', data.logoUrl); } catch (_) {}
          }
          this.applyTenantBranding(this.authService.currentUser());
        }
      })
      .catch(() => {});
  }

  /**
   * Applies the multitenant company name to the browser tab title,
   * the company logo to the browser favicon, apple-touch-icon,
   * mobile meta tags, and progressive web app (PWA) installation manifest.
   */
  async applyTenantBranding(user: LoginResponse | null): Promise<void> {
    if (typeof document === 'undefined') return;

    const companyName = user?.instituteName?.trim() || this.authService.getInstituteName() || '';
    const tenantCode = (user?.tenantCode || this.authService.getLastTenantCode() || this.extractTenantFromHost() || '').trim().toUpperCase();
    
    // Strict Dynamic Short Name: Exactly matches tenant company code (e.g. 'JNANDEEP') for mobile home screen icon label
    const shortName = tenantCode || (companyName.length > 12 ? companyName.split(' ')[0] : companyName) || this.DEFAULT_SHORT_TITLE;
    const logoUrl = this.authService.getInstituteLogoUrl();

    // 1. Dynamic Tab & Window Title (Strictly Tenant Short Name e.g. 'JNANDEEP')
    this.titleService.setTitle(shortName);

    // 2. Dynamic Meta Tags (sets apple-mobile-web-app-title to exact shortName e.g. JNANDEEP)
    this.updateMetaTags(companyName, shortName);

    // 3. Dynamic Icons for Desktop, Android, and iOS
    // Standard HTTP URLs served by Service Worker Cache (required by W3C & Chromium PWA specs)
    const icon192Url = '/__tenant_icon_192.png';
    const maskable192Url = '/__tenant_icon_maskable_192.png';
    const icon512Url = '/__tenant_icon_512.png';
    const maskable512Url = '/__tenant_icon_maskable_512.png';

    let faviconDataUrl: string | null = null;
    let appleTouchDataUrl: string | null = null;

    if (logoUrl) {
      try {
        const [blob192, blobMask192, blob512, blobMask512, blobApple, appleData] = await Promise.all([
          this.generateSquareIconBlob(logoUrl, 192, false),
          this.generateSquareIconBlob(logoUrl, 192, true, '#ffffff'),
          this.generateSquareIconBlob(logoUrl, 512, false),
          this.generateSquareIconBlob(logoUrl, 512, true, '#ffffff'),
          this.generateSquareIconBlob(logoUrl, 180, true, '#ffffff'),
          this.generateSquareIconDataUrl(logoUrl, 180, true, '#ffffff')
        ]);

        appleTouchDataUrl = appleData;

        if (typeof window !== 'undefined' && 'caches' in window) {
          const cache = await window.caches.open('imserp-dynamic-branding');
          const cacheHeader = {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          };

          if (blob192) {
            await cache.put(icon192Url, new Response(blob192, { headers: cacheHeader }));
            await cache.put('/assets/icons/icon-192x192.png', new Response(blob192, { headers: cacheHeader }));
          }
          if (blobMask192) {
            await cache.put(maskable192Url, new Response(blobMask192, { headers: cacheHeader }));
            await cache.put('/assets/icons/icon-maskable-192x192.png', new Response(blobMask192, { headers: cacheHeader }));
          }
          if (blob512) {
            await cache.put(icon512Url, new Response(blob512, { headers: cacheHeader }));
            await cache.put('/assets/icons/icon-512x512.png', new Response(blob512, { headers: cacheHeader }));
          }
          if (blobMask512) {
            await cache.put(maskable512Url, new Response(blobMask512, { headers: cacheHeader }));
            await cache.put('/assets/icons/icon-maskable-512x512.png', new Response(blobMask512, { headers: cacheHeader }));
          }
          if (blobApple) {
            await cache.put('/__tenant_apple_touch_icon.png', new Response(blobApple, { headers: cacheHeader }));
            await cache.put('/apple-touch-icon.png', new Response(blobApple, { headers: cacheHeader }));
            await cache.put('/apple-touch-icon-precomposed.png', new Response(blobApple, { headers: cacheHeader }));
          }

          // Direct fetch fallback if canvas was tainted or delayed
          if (!blob192) {
            try {
              const directRes = await fetch(logoUrl);
              if (directRes.ok) {
                const directBlob = await directRes.blob();
                if (directBlob) {
                  await cache.put(icon192Url, new Response(directBlob, { headers: cacheHeader }));
                  await cache.put('/assets/icons/icon-192x192.png', new Response(directBlob, { headers: cacheHeader }));
                  await cache.put(icon512Url, new Response(directBlob, { headers: cacheHeader }));
                  await cache.put('/assets/icons/icon-512x512.png', new Response(directBlob, { headers: cacheHeader }));
                }
              }
            } catch (_) {}
          }
        }

        // Generate favicon preview
        faviconDataUrl = await this.generateSquareIconDataUrl(logoUrl, 192, false);
      } catch (err) {
        console.warn('[BrandingService] Error preparing dynamic PWA icon blobs:', err);
      }
    }

    // Dynamic Favicon
    this.setFavicon(faviconDataUrl || logoUrl || this.DEFAULT_FAVICON);

    // Dynamic Apple Touch Icon for iOS Safari & Mobile Home Screen (MUST have solid background so iOS doesn't render transparent pixels black)
    this.setAppleTouchIcon(appleTouchDataUrl || logoUrl || this.DEFAULT_APPLE_ICON);

    // 4. Construct Full Dynamic Manifest with valid HTTP URLs
    // Strict App Name & Short Name: Exactly matches tenant code (e.g. 'JNANDEEP') for desktop shortcut & window title
    const dynamicManifest = {
      name: shortName,
      short_name: shortName,
      description: `${companyName || shortName} Enterprise ERP Portal`,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
      background_color: '#ffffff',
      theme_color: '#2563eb',
      orientation: 'any',
      lang: 'en-IN',
      dir: 'ltr',
      categories: ['education', 'business', 'productivity'],
      icons: logoUrl ? [
        {
          src: '/assets/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/assets/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/assets/icons/icon-maskable-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable'
        },
        {
          src: '/assets/icons/icon-maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        },
        {
          src: icon192Url,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: maskable192Url,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable'
        },
        {
          src: icon512Url,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: maskable512Url,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        },
        {
          src: logoUrl,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: logoUrl,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        }
      ] : [
        {
          src: 'assets/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: 'assets/icons/icon-maskable-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable'
        },
        {
          src: 'assets/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: 'assets/icons/icon-maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ],
      shortcuts: [
        {
          name: 'Dashboard',
          short_name: 'Dashboard',
          description: 'Executive Overview & Insights',
          url: '/dashboard',
          icons: [{ src: logoUrl ? icon192Url : 'assets/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }]
        },
        {
          name: 'Attendance',
          short_name: 'Attendance',
          description: 'Daily Student & Teacher Attendance',
          url: '/student-attendance',
          icons: [{ src: logoUrl ? icon192Url : 'assets/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }]
        },
        {
          name: 'Fees Collection',
          short_name: 'Fees',
          description: 'Collect Fees & Instant Receipt',
          url: '/fees',
          icons: [{ src: logoUrl ? icon192Url : 'assets/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }]
        },
        {
          name: 'Student Directory',
          short_name: 'Students',
          description: 'Search & View Enrolled Students',
          url: '/students',
          icons: [{ src: logoUrl ? icon192Url : 'assets/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }]
        }
      ]
    };

    // 5. Store manifest directly into CacheStorage
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await window.caches.open('imserp-dynamic-branding');
        const code = (user?.tenantCode || shortName || this.authService.getLastTenantCode() || this.extractTenantFromHost() || '').trim();
        const tenantParam = code ? `?tenant=${encodeURIComponent(code)}` : '';
        const manifestResponse = new Response(JSON.stringify(dynamicManifest, null, 2), {
          headers: {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
        await cache.put(new Request('/__tenant_manifest_data__'), manifestResponse.clone());
        await cache.put(new Request('/manifest.webmanifest'), manifestResponse.clone());
        if (tenantParam) {
          await cache.put(new Request(`/manifest.webmanifest${tenantParam}`), manifestResponse.clone());
        }
        await cache.put(new Request('/manifest.json'), manifestResponse.clone());
      } catch (e) {
        console.warn('[BrandingService] Direct cache storage warning:', e);
      }
    }

    // 6. Update Web App Manifest link in DOM
    this.updatePwaManifest(user, shortName, dynamicManifest);

    // 7. Notify active Service Worker
    this.notifyServiceWorker(user, logoUrl, dynamicManifest, {
      icon192: icon192Url,
      icon512: icon512Url,
      maskable192: maskable192Url,
      maskable512: maskable512Url
    }, shortName);
  }

  /**
   * Generates a square high-resolution PNG Blob from an image URL.
   * Ensures the icon meets 100% of PWA criteria on Android, Windows, Mac, and iOS.
   */
  private generateSquareIconBlob(
    imageUrl: string,
    size: number,
    isMaskable: boolean = false,
    bgColor: string = '#ffffff'
  ): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        resolve(null);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      const timer = setTimeout(() => {
        // Fallback: fetch directly as blob
        fetch(imageUrl)
          .then((r) => (r.ok ? r.blob() : null))
          .then(resolve)
          .catch(() => resolve(null));
      }, 3500);

      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }

          if (isMaskable) {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, size, size);
          } else {
            ctx.clearRect(0, 0, size, size);
          }

          const scale = isMaskable ? 0.78 : 0.94;
          const targetArea = size * scale;
          const offset = (size - targetArea) / 2;

          const w = img.naturalWidth || img.width || size;
          const h = img.naturalHeight || img.height || size;
          const aspect = w / h;

          let dw = targetArea;
          let dh = targetArea;
          let dx = offset;
          let dy = offset;

          if (aspect > 1) {
            dh = targetArea / aspect;
            dy = offset + (targetArea - dh) / 2;
          } else {
            dw = targetArea * aspect;
            dx = offset + (targetArea - dw) / 2;
          }

          ctx.drawImage(img, dx, dy, dw, dh);
          canvas.toBlob((blob) => resolve(blob), 'image/png');
        } catch (e) {
          fetch(imageUrl)
            .then((r) => (r.ok ? r.blob() : null))
            .then(resolve)
            .catch(() => resolve(null));
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        fetch(imageUrl)
          .then((r) => (r.ok ? r.blob() : null))
          .then(resolve)
          .catch(() => resolve(null));
      };

      img.src = imageUrl;
    });
  }

  /**
   * Generates a square high-resolution PNG data URL (primarily for browser tab favicon).
   */
  private generateSquareIconDataUrl(
    imageUrl: string,
    size: number,
    isMaskable: boolean = false,
    bgColor: string = '#ffffff'
  ): Promise<string> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        resolve(imageUrl);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      const timer = setTimeout(() => {
        resolve(imageUrl);
      }, 2500);

      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(imageUrl);
            return;
          }

          if (isMaskable) {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, size, size);
          } else {
            ctx.clearRect(0, 0, size, size);
          }

          const scale = isMaskable ? 0.78 : 0.94;
          const targetArea = size * scale;
          const offset = (size - targetArea) / 2;

          const w = img.naturalWidth || img.width || size;
          const h = img.naturalHeight || img.height || size;
          const aspect = w / h;

          let dw = targetArea;
          let dh = targetArea;
          let dx = offset;
          let dy = offset;

          if (aspect > 1) {
            dh = targetArea / aspect;
            dy = offset + (targetArea - dh) / 2;
          } else {
            dw = targetArea * aspect;
            dx = offset + (targetArea - dw) / 2;
          }

          ctx.drawImage(img, dx, dy, dw, dh);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          resolve(imageUrl);
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve(imageUrl);
      };

      img.src = imageUrl;
    });
  }

  /**
   * Dynamically replaces or updates the browser favicon.
   */
  setFavicon(iconUrl: string | null): void {
    if (typeof document === 'undefined') return;

    if (!iconUrl) {
      this.injectFaviconLink(this.DEFAULT_FAVICON, 'image/svg+xml');
      return;
    }

    const isSvg = iconUrl.toLowerCase().endsWith('.svg');
    const directType = isSvg ? 'image/svg+xml' : 'image/png';
    this.injectFaviconLink(iconUrl, directType);
  }

  /**
   * Dynamically sets apple-touch-icon for iOS Safari and mobile home screens.
   * Ensures high-resolution 180x180 solid-white background icon is bound
   * so iOS never fills transparent pixels with black.
   */
  setAppleTouchIcon(iconUrl: string | null): void {
    if (typeof document === 'undefined') return;

    const targetUrl = iconUrl || this.DEFAULT_APPLE_ICON;

    let appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
    if (!appleLink) {
      appleLink = document.createElement('link');
      appleLink.id = 'app-apple-touch-icon';
      appleLink.rel = 'apple-touch-icon';
      document.head.appendChild(appleLink);
    }
    appleLink.href = targetUrl;

    let precomposedLink = document.querySelector("link[rel='apple-touch-icon-precomposed']") as HTMLLinkElement;
    if (!precomposedLink) {
      precomposedLink = document.createElement('link');
      precomposedLink.id = 'app-apple-touch-icon-precomposed';
      precomposedLink.rel = 'apple-touch-icon-precomposed';
      document.head.appendChild(precomposedLink);
    }
    precomposedLink.href = targetUrl;
  }

  /**
   * Dynamically updates browser/PWA meta tags for mobile home screens.
   * Strictly sets apple-mobile-web-app-title to the exact tenant shortName (e.g. 'JNANDEEP').
   */
  private updateMetaTags(companyName: string, shortName: string): void {
    if (typeof document === 'undefined') return;

    const displayShortTitle = (shortName || companyName || this.DEFAULT_SHORT_TITLE).trim();

    let titleMeta = document.querySelector("meta[name='apple-mobile-web-app-title']") as HTMLMetaElement;
    if (!titleMeta) {
      titleMeta = document.createElement('meta');
      titleMeta.name = 'apple-mobile-web-app-title';
      document.head.appendChild(titleMeta);
    }
    titleMeta.content = displayShortTitle;

    let appNameMeta = document.querySelector("meta[name='application-name']") as HTMLMetaElement;
    if (!appNameMeta) {
      appNameMeta = document.createElement('meta');
      appNameMeta.name = 'application-name';
      document.head.appendChild(appNameMeta);
    }
    appNameMeta.content = displayShortTitle;

    let descMeta = document.querySelector("meta[name='description']") as HTMLMetaElement;
    if (!descMeta) {
      descMeta = document.createElement('meta');
      descMeta.name = 'description';
      document.head.appendChild(descMeta);
    }
    descMeta.content = companyName
      ? `${companyName} Enterprise ERP solution for School Classes, Coaching Batches, Attendance, Fees, and Student Portals.`
      : this.DEFAULT_DESCRIPTION;
  }

  /**
   * Updates the Web App Manifest link in the DOM with the active tenant context.
   */
  private updatePwaManifest(user: LoginResponse | null, shortName?: string, dynamicManifest?: any): void {
    if (typeof document === 'undefined') return;

    let manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.id = 'app-manifest';
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }

    const code = (user?.tenantCode || shortName || this.authService.getLastTenantCode() || this.extractTenantFromHost() || '').trim();
    const tenantParam = code ? `?tenant=${encodeURIComponent(code)}&t=${Date.now()}` : `?t=${Date.now()}`;
    manifestLink.href = `manifest.webmanifest${tenantParam}`;
  }

  /**
   * Notifies the active Service Worker of current tenant branding
   * so sw.js dynamically intercepts /manifest.webmanifest and returns
   * the tenant's exact company name and logo for PWA installation.
   */
  private notifyServiceWorker(
    user: LoginResponse | null,
    logoUrl: string | null,
    dynamicManifest?: any,
    icons?: { icon192?: string; icon512?: string; maskable192?: string; maskable512?: string },
    shortName?: string
  ): void {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const payload = {
      instituteName: user?.instituteName?.trim() || this.authService.getInstituteName() || null,
      tenantCode: user?.tenantCode?.trim() || this.authService.getLastTenantCode() || this.extractTenantFromHost() || null,
      shortName: shortName || user?.tenantCode?.trim() || this.authService.getLastTenantCode() || null,
      tenantId: user?.tenantId || null,
      logoUrl: logoUrl || null,
      apiBaseUrl: environment.apiBaseUrl,
      dynamicManifest: dynamicManifest || null,
      icon192: icons?.icon192 || null,
      icon512: icons?.icon512 || null,
      maskable192: icons?.maskable192 || null,
      maskable512: icons?.maskable512 || null
    };

    try {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SET_TENANT_BRANDING',
          payload
        });
      }

      navigator.serviceWorker.ready.then((reg) => {
        if (reg.active) {
          reg.active.postMessage({
            type: 'SET_TENANT_BRANDING',
            payload
          });
        }
      }).catch(() => {});
    } catch (e) {
      console.warn('[BrandingService] Could not post branding to service worker:', e);
    }
  }

  private injectFaviconLink(href: string, type: string): void {
    const head = document.head;
    const existing = head.querySelectorAll("link[rel*='icon']");
    existing.forEach(el => {
      if (el.getAttribute('rel') !== 'apple-touch-icon') {
        el.remove();
      }
    });

    const link = document.createElement('link');
    link.id = 'app-dynamic-favicon';
    link.rel = 'icon';
    link.type = type;
    link.href = href;
    head.appendChild(link);

    const shortcutLink = document.createElement('link');
    shortcutLink.rel = 'shortcut icon';
    shortcutLink.type = type;
    shortcutLink.href = href;
    head.appendChild(shortcutLink);
  }
}
