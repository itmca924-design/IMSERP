import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  isLoading = signal<boolean>(false);
  loadingMessage = signal<string>('Processing, please wait...');

  private activeRequests = 0;

  show(message: string = 'Loading, please wait...'): void {
    this.activeRequests++;
    this.loadingMessage.set(message);
    this.isLoading.set(true);
  }

  hide(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    if (this.activeRequests === 0) {
      this.isLoading.set(false);
    }
  }

  forceHide(): void {
    this.activeRequests = 0;
    this.isLoading.set(false);
  }
}
