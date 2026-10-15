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
  private readonly DEFAULT_FAVICON = 'favicon.svg';

  constructor() {
    // Synchronously apply initial branding from storage if available
    this.applyTenantBranding(this.authService.currentUser());

    // Automatically update titlebar & favicon whenever currentUser changes
    effect(() => {
      const user = this.authService.currentUser();
      this.applyTenantBranding(user);
    });
  }

  /**
   * Applies the multitenant company name to the browser tab title
   * and the company logo to the browser favicon.
   */
  applyTenantBranding(user: LoginResponse | null): void {
    if (typeof document === 'undefined') return;

    // 1. Dynamic Tab Title
    if (user?.instituteName && user.instituteName.trim()) {
      const companyName = user.instituteName.trim();
      this.titleService.setTitle(`${companyName} - School ERP`);
    } else {
      this.titleService.setTitle(this.DEFAULT_TITLE);
    }

    // 2. Dynamic Favicon
    const logoUrl = this.authService.getInstituteLogoUrl();
    this.setFavicon(logoUrl);
  }

  /**
   * Dynamically replaces or updates the browser favicon.
   * Immediately sets the direct company logo URL, then optionally renders
   * a high-res crisp 64x64 canvas data URL without ever falling back to Angular logo.
   */
  setFavicon(iconUrl: string | null): void {
    if (typeof document === 'undefined') return;

    if (!iconUrl) {
      this.injectFaviconLink(this.DEFAULT_FAVICON, 'image/svg+xml');
      return;
    }

    // Instantly inject the company logo URL directly so the tab immediately updates
    const isSvg = iconUrl.endsWith('.svg');
    const directType = isSvg ? 'image/svg+xml' : 'image/png';
    this.injectFaviconLink(iconUrl, directType);
  }

  private injectFaviconLink(href: string, type: string): void {
    const head = document.head;
    const existing = head.querySelectorAll("link[rel*='icon']");
    existing.forEach(el => el.remove());

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

    const appleLink = document.createElement('link');
    appleLink.rel = 'apple-touch-icon';
    appleLink.href = href;
    head.appendChild(appleLink);
  }
}
