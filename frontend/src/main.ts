import { provideZoneChangeDetection } from "@angular/core";
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// ── Auto-Recovery for Stale Dynamic Import Chunks across Deployments ──
if (typeof window !== 'undefined') {
  const handleChunkError = (rawMsg: string) => {
    if (!rawMsg) return;
    if (
      rawMsg.includes('Failed to fetch dynamically imported module') ||
      rawMsg.includes('Loading chunk') ||
      rawMsg.includes('Failed to load module script')
    ) {
      const lockKey = 'imserp_chunk_reload_timestamp';
      const lastReload = sessionStorage.getItem(lockKey);
      const now = Date.now();
      // Debounce reload: allow at most once every 10 seconds to avoid infinite reload loop if truly offline
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem(lockKey, now.toString());
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((regs) => {
            regs.forEach((r) => r.update());
          });
        }
        window.location.reload();
      }
    }
  };

  window.addEventListener('error', (event) => {
    handleChunkError(event.message || '');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = (reason && (reason.message || reason.toString())) || '';
    handleChunkError(msg);
  });
}

// ── Global Accessibility Warning Filter ──
// Suppress benign console warnings without intrusive DOM prototype monkey-patching
if (typeof window !== 'undefined' && typeof console !== 'undefined') {
  const origWarn = console.warn;
  console.warn = function (...args: any[]) {
    if (typeof args[0] === 'string' && (
      args[0].includes('Blocked aria-hidden on an element because its descendant retained focus') ||
      args[0].includes('sanitizing HTML stripped some content')
    )) {
      return;
    }
    origWarn.apply(console, args);
  };
}

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [provideZoneChangeDetection(), ...appConfig.providers]
})
  .then(() => {
    // ── Progressive Web App (PWA) Service Worker Registration ──
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registerSW = () => {
        let refreshing = false;
        // Only trigger reload if page was ALREADY controlled by an older worker
        const hadController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (hadController && !refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });

        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker registered with scope:', registration.scope);
            return registration.update();
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }
  })
  .catch((err) => {
    console.error('[Angular Bootstrap Error]:', err);
  });
