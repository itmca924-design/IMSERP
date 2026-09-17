import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  isLoading = signal<boolean>(false);
  loadingMessage = signal<string>('Processing, please wait...');

  private activeRequests = 0;
  private safetyTimer: any;

  show(message: string = 'Loading, please wait...'): void {
    this.activeRequests++;
    this.loadingMessage.set(message);
    this.isLoading.set(true);

    // Safety fallback: auto hide after 15 seconds to prevent permanent UI lock in case of network freeze
    if (this.safetyTimer) clearTimeout(this.safetyTimer);
    this.safetyTimer = setTimeout(() => {
      if (this.isLoading()) {
        this.forceHide();
      }
    }, 15000);
  }

  hide(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    if (this.activeRequests === 0) {
      this.isLoading.set(false);
      if (this.safetyTimer) {
        clearTimeout(this.safetyTimer);
        this.safetyTimer = undefined;
      }
    }
  }

  forceHide(): void {
    this.activeRequests = 0;
    this.isLoading.set(false);
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = undefined;
    }
  }
}
