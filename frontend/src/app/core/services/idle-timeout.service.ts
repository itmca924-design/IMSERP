import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AuthService } from './auth.service';
import { IdleWarningDialogComponent } from '../components/idle-warning-dialog.component';
import { fromEvent, merge, Subscription, debounceTime } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class IdleTimeoutService implements OnDestroy {
  // Inactivity threshold: 14 minutes before warning popup
  private readonly IDLE_TIMEOUT_MS = 14 * 60 * 1000;
  // Warning countdown duration: 60 seconds
  private readonly WARNING_SECONDS = 60;

  private idleTimer: any;
  private heartbeatTimer: any;
  private eventSubscription?: Subscription;
  private dialogRef?: MatDialogRef<IdleWarningDialogComponent>;
  private isMonitoring = false;

  constructor(
    private authService: AuthService,
    private dialog: MatDialog,
    private ngZone: NgZone
  ) {}

  startMonitoring(): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // Check if session has already lapsed while app was inactive or sleeping
    const lastActiveStr = localStorage.getItem('imserp_last_activity');
    if (lastActiveStr && !this.authService.isRememberMe()) {
      const elapsed = Date.now() - parseInt(lastActiveStr, 10);
      if (elapsed >= (this.IDLE_TIMEOUT_MS + this.WARNING_SECONDS * 1000)) {
        this.stopMonitoring();
        this.authService.logout('idle_timeout');
        return;
      } else if (elapsed >= this.IDLE_TIMEOUT_MS) {
        this.showWarningDialog();
      }
    }

    // Set initial activity
    this.authService.updateLastActivity();

    // Listen to user interaction outside Angular Zone to prevent change detection thrashing
    this.ngZone.runOutsideAngular(() => {
      const userActivityEvents = merge(
        fromEvent(document, 'mousemove'),
        fromEvent(document, 'keydown'),
        fromEvent(document, 'click'),
        fromEvent(document, 'scroll'),
        fromEvent(document, 'touchstart')
      ).pipe(
        debounceTime(1000) // Debounce events to once per second
      );

      this.eventSubscription = userActivityEvents.subscribe(() => {
        // Only reset if warning dialog is not currently open
        if (!this.dialogRef) {
          this.authService.updateLastActivity();
          this.resetTimer();
        }
      });

      // Detect when laptop wakes up from sleep or user focuses tab
      fromEvent(window, 'focus').subscribe(() => this.checkInactivityOnWake());
      fromEvent(document, 'visibilitychange').subscribe(() => {
        if (!document.hidden) {
          this.checkInactivityOnWake();
        }
      });

      // Background heartbeat check every 15 seconds (detects laptop wake even without focus)
      this.heartbeatTimer = setInterval(() => {
        this.checkInactivityOnWake();
      }, 15000);
    });

    this.resetTimer();
  }

  private checkInactivityOnWake(): void {
    if (!this.authService.isLoggedIn()) {
      this.stopMonitoring();
      return;
    }

    // If user selected Remember Me, let standard token interceptor handle long sessions
    if (this.authService.isRememberMe()) {
      return;
    }

    const lastActiveStr = localStorage.getItem('imserp_last_activity');
    if (!lastActiveStr) return;

    const elapsed = Date.now() - parseInt(lastActiveStr, 10);
    if (elapsed >= (this.IDLE_TIMEOUT_MS + this.WARNING_SECONDS * 1000) && !this.dialogRef) {
      this.ngZone.run(() => {
        this.stopMonitoring();
        this.authService.logout('idle_timeout');
      });
    } else if (elapsed >= this.IDLE_TIMEOUT_MS && !this.dialogRef) {
      this.ngZone.run(() => {
        this.showWarningDialog();
      });
    }
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    this.clearTimer();

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
      this.eventSubscription = undefined;
    }

    if (this.dialogRef) {
      this.dialogRef.close();
      this.dialogRef = undefined;
    }

    try {
      this.dialog.closeAll();
    } catch (e) {
      console.warn('Could not close dialogs in stopMonitoring:', e);
    }
  }

  private resetTimer(): void {
    this.clearTimer();
    this.idleTimer = setTimeout(() => {
      this.ngZone.run(() => {
        this.showWarningDialog();
      });
    }, this.IDLE_TIMEOUT_MS);
  }

  private clearTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
  }

  private showWarningDialog(): void {
    // If not logged in or dialog already open, do nothing
    if (!this.authService.isLoggedIn() || this.dialogRef) return;

    this.dialogRef = this.dialog.open(IdleWarningDialogComponent, {
      width: '460px',
      maxWidth: '94vw',
      disableClose: true,
      data: { seconds: this.WARNING_SECONDS }
    });

    this.dialogRef.afterClosed().subscribe((result: string) => {
      this.dialogRef = undefined;

      if (result === 'stay') {
        this.authService.updateLastActivity();
        // Refresh token to keep security session valid and reset idle timer
        this.authService.refreshToken().subscribe({
          next: () => this.resetTimer(),
          error: () => this.resetTimer()
        });
      } else {
        // Logout immediately
        this.stopMonitoring();
        this.authService.logout('idle_timeout');
      }
    });
  }

  ngOnDestroy(): void {
    this.stopMonitoring();
  }
}
