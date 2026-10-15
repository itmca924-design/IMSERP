import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { AuthService } from './auth.service';
import { ConfirmDialogService } from './confirm-dialog.service';
import { environment } from '../../../environments/environment';

export interface ActiveUserDto {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  tenantId: string;
  branchId?: string | null;
  branchName?: string | null;
  lastActiveAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class PresenceService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private confirmDialog = inject(ConfirmDialogService);
  private router = inject(Router);

  private hubConnection: HubConnection | null = null;
  private isTerminated = false;

  readonly activeUsersCount = signal<number>(1);
  readonly activeUsers = signal<ActiveUserDto[]>([]);
  readonly isConnected = signal<boolean>(false);

  init(): void {
    const token = this.authService.getToken();
    if (!token || !this.authService.isLoggedIn()) {
      return;
    }

    if (this.hubConnection && this.hubConnection.state === 'Connected') {
      return;
    }

    this.isTerminated = false;
    this.createHubConnection(token);
  }

  private createHubConnection(token: string): void {
    const hubUrl = `${environment.apiBaseUrl}/hubs/presence`;

    try {
      this.hubConnection = new HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => this.authService.getToken() || token
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
        .configureLogging(LogLevel.None)
        .build();

      // Listen for ForceLogout pushed when same account logs in elsewhere
      this.hubConnection.on('ForceLogout', (data: { title?: string; message?: string }) => {
        this.handleForceLogout(data?.message || 'Your account was logged in from another browser or device. For security reasons, this session has been terminated.');
      });

      // Listen for real-time count updates
      this.hubConnection.on('ActiveUsersUpdated', () => {
        this.refreshActiveUsers();
      });

      this.hubConnection.start()
        .then(() => {
          this.isConnected.set(true);
          this.refreshActiveUsers();
        })
        .catch(() => {
          this.isConnected.set(false);
          // Fallback to initial HTTP poll if websocket couldn't connect
          this.refreshActiveUsers();
        });

      this.hubConnection.onreconnected(() => {
        this.isConnected.set(true);
        this.refreshActiveUsers();
      });

      this.hubConnection.onclose(() => {
        this.isConnected.set(false);
      });
    } catch {
      this.isConnected.set(false);
      this.refreshActiveUsers();
    }
  }

  refreshActiveUsers(branchId?: string | null): void {
    const bId = branchId !== undefined ? branchId : this.authService.selectedBranchId();
    let url = `${environment.apiBaseUrl}/api/presence/active-users`;
    if (bId) {
      url += `?branchId=${bId}`;
    }

    this.http.get<{ totalActive: number; users: ActiveUserDto[] }>(url).subscribe({
      next: res => {
        this.activeUsersCount.set(res.totalActive || 1);
        this.activeUsers.set(res.users || []);
      },
      error: () => {}
    });
  }

  handleForceLogout(message: string): void {
    if (this.isTerminated) return;
    this.isTerminated = true;

    this.stopConnection();

    // Strict UI Standard: Pure Angular Material Dialog
    this.confirmDialog.alert(
      'Session Terminated',
      message || 'Your account was logged in from another device or browser. For security reasons, this session has been terminated.',
      'warning',
      {
        titleEn: 'Session Terminated',
        titleHi: 'सत्र समाप्त',
        messageEn: message || 'Your account was logged in from another device or browser. For security reasons, this session has been terminated.',
        messageHi: 'आपका खाता किसी अन्य डिवाइस या ब्राउज़र से लॉगिन किया गया है। यह सत्र समाप्त कर दिया गया है।',
        confirmTextEn: 'Go to Login',
        confirmTextHi: 'लॉगिन पर जाएं'
      }
    ).subscribe(() => {
      this.authService.logout('kicked_out');
      this.router.navigate(['/login']);
    });
  }

  stopConnection(): void {
    if (this.hubConnection) {
      this.hubConnection.stop().catch(() => {});
      this.hubConnection = null;
      this.isConnected.set(false);
    }
  }
}
