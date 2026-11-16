import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    const errorStr = (error?.message || error?.toString() || '').toLowerCase();

    // Catch dynamic chunk loading failure due to new version deployment
    if (
      errorStr.includes('failed to fetch dynamically imported module') ||
      errorStr.includes('loading chunk') ||
      errorStr.includes('chunkloaderror') ||
      errorStr.includes('cannot find module')
    ) {
      const lastReload = Number(sessionStorage.getItem('chunk_reload_timestamp') || '0');
      const now = Date.now();
      // Throttle: only auto-reload once within 20 seconds to prevent endless reload loops
      if (now - lastReload > 20000) {
        sessionStorage.setItem('chunk_reload_timestamp', now.toString());
        console.warn('[IMSERP] New deployment detected or chunk mismatch. Auto-reloading to fetch latest assets...');
        window.location.reload();
        return;
      }
    }

    console.error('[IMSERP Global Error]', error);
  }
}
