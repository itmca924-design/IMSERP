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
  // Warning countdown duration
  private readonly WARNING_SECONDS = 60;

  private idleTimer: any;
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

    // Listen to user interaction outside Angular Zone to prevent high CPU / change detection thrashing
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
          this.resetTimer();
        }
      });
    });

    this.resetTimer();
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    this.clearTimer();

    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
      this.eventSubscription = undefined;
    }

    if (this.dialogRef) {
      this.dialogRef.close();
      this.dialogRef = undefined;
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
      width: '420px',
      disableClose: true,
      data: { seconds: this.WARNING_SECONDS }
    });

    this.dialogRef.afterClosed().subscribe((result: string) => {
      this.dialogRef = undefined;

      if (result === 'stay') {
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
