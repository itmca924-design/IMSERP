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
  applyTenantBranding(user: LoginResponse | null): void {
    if (typeof document === 'undefined') return;

    const companyName = user?.instituteName?.trim() || '';
    const logoUrl = this.authService.getInstituteLogoUrl();

    // 1. Dynamic Tab Title
    if (companyName) {
      this.titleService.setTitle(`${companyName} - School ERP`);
    } else {
      this.titleService.setTitle(this.DEFAULT_TITLE);
    }

    // 2. Dynamic Favicon
    this.setFavicon(logoUrl);

    // 3. Dynamic Apple Touch Icon
    this.setAppleTouchIcon(logoUrl);

    // 4. Dynamic Meta Tags
    this.updateMetaTags(companyName);

    // 5. Dynamic Web App Manifest & Service Worker Sync
    this.updatePwaManifest(user, logoUrl);
    this.notifyServiceWorker(user, logoUrl);
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
  private updatePwaManifest(user: LoginResponse | null, logoUrl: string | null): void {
    if (typeof document === 'undefined') return;

    let manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.id = 'app-manifest';
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }

    // Cache-busting parameter with tenant code so browser immediately refreshes manifest when tenant changes
    const tenantParam = user?.tenantCode ? `?tenant=${encodeURIComponent(user.tenantCode)}&t=${Date.now()}` : '';
    manifestLink.href = `manifest.webmanifest${tenantParam}`;
  }

  /**
   * Notifies the active Service Worker of current tenant branding
   * so sw.js dynamically intercepts /manifest.webmanifest and returns
   * the tenant's exact company name and logo for PWA installation.
   */
  private notifyServiceWorker(user: LoginResponse | null, logoUrl: string | null): void {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const payload = {
      instituteName: user?.instituteName?.trim() || null,
      tenantCode: user?.tenantCode?.trim() || null,
      tenantId: user?.tenantId || null,
      logoUrl: logoUrl || null
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
