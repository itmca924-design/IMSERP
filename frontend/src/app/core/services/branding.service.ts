import { Injectable, inject, effect } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { AuthService, LoginResponse } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class BrandingService {
  private titleService = inject(Title);
  private authService = inject(AuthService);

  private readonly DEFAULT_TITLE = 'School ERP - Unified Education Management';
  private readonly DEFAULT_SHORT_TITLE = 'School ERP';
  private readonly DEFAULT_FAVICON = 'favicon.svg';
  private readonly DEFAULT_APPLE_ICON = 'assets/icons/apple-touch-icon.png';
  private readonly DEFAULT_DESCRIPTION = 'Enterprise ERP solution for School Classes, Coaching Batches, Hybrid Admissions, Fee Collections, and Student Portals.';

  constructor() {
    // Synchronously apply initial branding from storage if available
    this.applyTenantBranding(this.authService.currentUser());

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
   * Applies the multitenant company name to the browser tab title,
   * the company logo to the browser favicon, apple-touch-icon,
   * mobile meta tags, and progressive web app (PWA) installation manifest.
   */
  async applyTenantBranding(user: LoginResponse | null): Promise<void> {
    if (typeof document === 'undefined') return;

    const companyName = user?.instituteName?.trim() || this.authService.getInstituteName() || '';
    const logoUrl = this.authService.getInstituteLogoUrl();

    // 1. Dynamic Tab Title
    if (companyName) {
      this.titleService.setTitle(`${companyName} - School ERP`);
    } else {
      this.titleService.setTitle(this.DEFAULT_TITLE);
    }

    // 2. Dynamic Meta Tags
    this.updateMetaTags(companyName);

    // 3. Dynamic Icons for Desktop, Android, and iOS
    // Standard HTTP URLs served by Service Worker Cache (required by W3C & Chromium PWA specs)
    const icon192Url = '/__tenant_icon_192.png';
    const maskable192Url = '/__tenant_icon_maskable_192.png';
    const icon512Url = '/__tenant_icon_512.png';
    const maskable512Url = '/__tenant_icon_maskable_512.png';

    let faviconDataUrl: string | null = null;

    if (logoUrl) {
      try {
        const [blob192, blobMask192, blob512, blobMask512] = await Promise.all([
          this.generateSquareIconBlob(logoUrl, 192, false),
          this.generateSquareIconBlob(logoUrl, 192, true, '#ffffff'),
          this.generateSquareIconBlob(logoUrl, 512, false),
          this.generateSquareIconBlob(logoUrl, 512, true, '#ffffff')
        ]);

        if (typeof window !== 'undefined' && 'caches' in window) {
          const cache = await window.caches.open('imserp-dynamic-branding');
          const cacheHeader = {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          };

          if (blob192) {
            await cache.put(icon192Url, new Response(blob192, { headers: cacheHeader }));
          }
          if (blobMask192) {
            await cache.put(maskable192Url, new Response(blobMask192, { headers: cacheHeader }));
          }
          if (blob512) {
            await cache.put(icon512Url, new Response(blob512, { headers: cacheHeader }));
          }
          if (blobMask512) {
            await cache.put(maskable512Url, new Response(blobMask512, { headers: cacheHeader }));
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

    // Dynamic Apple Touch Icon for iOS Safari & Mobile Home Screen (MUST be valid HTTP URL)
    this.setAppleTouchIcon(logoUrl || icon192Url);

    // 4. Construct Full Dynamic Manifest with valid HTTP URLs
    const dynamicManifest = {
      name: companyName ? `${companyName} - School ERP` : this.DEFAULT_TITLE,
      short_name: companyName || this.DEFAULT_SHORT_TITLE,
      description: `${companyName || 'Campus'} Enterprise ERP solution for School Classes, Coaching Batches, Hybrid Admissions, Fee Collections, and Student Portals.`,
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
        const manifestResponse = new Response(JSON.stringify(dynamicManifest, null, 2), {
          headers: {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
        await cache.put(new Request('/__tenant_manifest_data__'), manifestResponse.clone());
        await cache.put(new Request('/manifest.webmanifest'), manifestResponse.clone());
        await cache.put(new Request('/manifest.json'), manifestResponse.clone());
      } catch (e) {
        console.warn('[BrandingService] Direct cache storage warning:', e);
      }
    }

    // 6. Update Web App Manifest link in DOM
    this.updatePwaManifest(user);

    // 7. Notify active Service Worker
    this.notifyServiceWorker(user, logoUrl, dynamicManifest, {
      icon192: icon192Url,
      icon512: icon512Url,
      maskable192: maskable192Url,
      maskable512: maskable512Url
    });
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
   * Dynamically sets apple-touch-icon for iOS and desktop PWA shortcuts.
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
  }

  /**
   * Dynamically updates browser/PWA meta tags for mobile and desktop.
   */
  private updateMetaTags(companyName: string): void {
    if (typeof document === 'undefined') return;

    let titleMeta = document.querySelector("meta[name='apple-mobile-web-app-title']") as HTMLMetaElement;
    if (!titleMeta) {
      titleMeta = document.createElement('meta');
      titleMeta.name = 'apple-mobile-web-app-title';
      document.head.appendChild(titleMeta);
    }
    titleMeta.content = companyName ? `${companyName} ERP` : this.DEFAULT_SHORT_TITLE;

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
  private updatePwaManifest(user: LoginResponse | null): void {
    if (typeof document === 'undefined') return;

    let manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.id = 'app-manifest';
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }

    // Cache-busting parameter with tenant code so browser immediately refreshes manifest when tenant changes
    const tenantParam = user?.tenantCode ? `?tenant=${encodeURIComponent(user.tenantCode)}&t=${Date.now()}` : `?t=${Date.now()}`;
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
    icons?: { icon192?: string; icon512?: string; maskable192?: string; maskable512?: string }
  ): void {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const payload = {
      instituteName: user?.instituteName?.trim() || this.authService.getInstituteName() || null,
      tenantCode: user?.tenantCode?.trim() || null,
      tenantId: user?.tenantId || null,
      logoUrl: logoUrl || null,
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
