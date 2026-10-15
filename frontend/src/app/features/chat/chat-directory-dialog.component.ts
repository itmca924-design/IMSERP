import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ChatService, ChatDirectoryUser } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-chat-directory-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dialog-wrapper">
      <!-- Strict Light Blue Header matching AGENTS.md rule -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-wrap">
            <mat-icon>group_add</mat-icon>
          </div>
          <div class="header-titles">
            <h2 mat-dialog-title class="main-title">Campus Directory & Peer Chat</h2>
            <p class="subtitle">Connect with classmates, campus students, or faculty teachers</p>
          </div>
        </div>

        <button type="button" class="sharp-close-btn" (click)="closeDialog()" aria-label="Close dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        <!-- Controls & Search -->
        <div class="directory-controls">
          <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
            <mat-icon matPrefix>search</mat-icon>
            <input 
              matInput 
              [formControl]="searchControl" 
              placeholder="Search by name, roll number, or username...">
            <button 
              *ngIf="searchControl.value" 
              mat-icon-button 
              matSuffix 
              type="button" 
              (click)="searchControl.setValue('')">
              <mat-icon>close</mat-icon>
            </button>
          </mat-form-field>

          <mat-button-toggle-group 
            [formControl]="filterControl" 
            class="directory-filter-toggle"
            aria-label="Directory Filter">
            <mat-button-toggle value="all">All</mat-button-toggle>
            <ng-container *ngIf="isStudentOrParent()">
              <mat-button-toggle value="same_class">Classmates</mat-button-toggle>
              <mat-button-toggle value="other_classes">Other Classes</mat-button-toggle>
            </ng-container>
            <ng-container *ngIf="!isStudentOrParent()">
              <mat-button-toggle value="students">Students</mat-button-toggle>
            </ng-container>
            <mat-button-toggle value="teachers">Faculty & Staff</mat-button-toggle>
          </mat-button-toggle-group>
        </div>

        <!-- Users List -->
        <div class="user-list-container">
          <div *ngIf="loading()" class="loading-state">
            <mat-spinner diameter="32"></mat-spinner>
            <span>Loading campus directory...</span>
          </div>

          <div *ngIf="!loading() && users().length === 0" class="empty-state">
            <mat-icon class="empty-icon">search_off</mat-icon>
            <h3>No users found</h3>
            <p>Try refining your search keyword or selecting a different filter tab.</p>
          </div>

          <div *ngIf="!loading() && users().length > 0" class="user-grid">
            <div *ngFor="let u of users()" class="user-card">
              <div class="avatar-wrap">
                <div class="user-avatar" [class.teacher]="u.userRole === 'Teacher' || u.userRole === 'Principal'">
                  {{ getInitials(u.fullName) }}
                </div>
                <span class="presence-dot" [class.online]="u.isOnline" [title]="u.isOnline ? 'Online now' : 'Offline'"></span>
              </div>

              <div class="user-info">
                <div class="name-row">
                  <strong class="user-name">{{ u.fullName }}</strong>
                  <span class="role-badge" [ngClass]="getRoleBadgeClass(u.userRole, u.isSameClass)">
                    {{ getRoleBadgeLabel(u) }}
                  </span>
                </div>

                <div class="user-meta">
                  <span *ngIf="u.className" class="meta-pill class-pill">
                    🏫 {{ u.className }}<span *ngIf="u.sectionName">-{{ u.sectionName }}</span>
                  </span>
                  <span *ngIf="u.rollNumber" class="meta-pill roll-pill">
                    Roll: {{ u.rollNumber }}
                  </span>
                  <span *ngIf="u.designation" class="meta-pill teacher-pill">
                    🎓 {{ u.designation }}
                  </span>
                </div>
              </div>

              <button 
                mat-flat-button 
                color="primary" 
                class="start-chat-btn"
                [disabled]="startingChat() === u.userId"
                (click)="onSelectUser(u)">
                <mat-icon *ngIf="startingChat() !== u.userId">chat</mat-icon>
                <mat-spinner *ngIf="startingChat() === u.userId" diameter="16"></mat-spinner>
                <span>Message</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      width: 100%;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      max-height: 85vh;
    }

    /* Strict Light Blue Header matching AGENTS.md rule */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1.5px solid #bfdbfe;
      padding: 12px 14px 12px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
      }

      .header-icon-wrap {
        width: 38px;
        height: 38px;
        border-radius: 8px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);

        mat-icon {
          font-size: 22px;
          width: 22px;
          height: 22px;
        }
      }

      .header-titles {
        .main-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.25;
        }
        .subtitle {
          margin: 2px 0 0;
          font-size: 0.78rem;
          color: #2563eb;
          font-weight: 500;
        }
      }

      .sharp-close-btn {
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        color: #1e3a8a;
        background: #ffffff;
        border: 1.5px solid #bfdbfe;
        cursor: pointer;
        transition: all 0.15s ease-in-out;
        box-shadow: 0 1px 2px rgba(30, 58, 138, 0.08);

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          font-weight: 700;
        }

        &:hover {
          background: #fee2e2;
          border-color: #ef4444;
          color: #dc2626;
        }
      }
    }

    .dialog-body {
      padding: 16px 20px 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .directory-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;

      .search-field {
        flex: 1 1 280px;
        min-width: 240px;
      }

      .directory-filter-toggle {
        border-radius: 8px;
        overflow: hidden;
      }
    }

    .user-list-container {
      min-height: 260px;
      max-height: 52vh;
      overflow-y: auto;
      padding-right: 4px;
    }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;
      color: #64748b;
      gap: 10px;

      .empty-icon {
        font-size: 44px;
        width: 44px;
        height: 44px;
        color: #94a3b8;
      }

      h3 {
        margin: 0;
        color: #1e293b;
        font-size: 1rem;
        font-weight: 600;
      }

      p {
        margin: 0;
        font-size: 0.85rem;
        color: #64748b;
        max-width: 320px;
      }
    }

    .user-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .user-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      transition: all 0.15s ease-in-out;

      &:hover {
        background: #f0f7ff;
        border-color: #bfdbfe;
        transform: translateY(-1px);
        box-shadow: 0 2px 6px rgba(37, 99, 235, 0.08);
      }

      .avatar-wrap {
        position: relative;
        flex-shrink: 0;

        .user-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: #ffffff;
          font-weight: 700;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);

          &.teacher {
            background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
            box-shadow: 0 2px 4px rgba(124, 58, 237, 0.2);
          }
        }

        .presence-dot {
          position: absolute;
          bottom: 1px;
          right: 1px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #94a3b8;
          border: 2px solid #ffffff;

          &.online {
            background: #22c55e;
          }
        }
      }

      .user-info {
        flex: 1;
        min-width: 0;

        .name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;

          .user-name {
            font-size: 0.94rem;
            color: #0f172a;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .role-badge {
            font-size: 0.68rem;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 4px;
            letter-spacing: 0.02em;

            &.same-class {
              background: #dbeafe;
              color: #1e40af;
              border: 1px solid #bfdbfe;
            }
            &.other-class {
              background: #f1f5f9;
              color: #475569;
              border: 1px solid #e2e8f0;
            }
            &.teacher {
              background: #f3e8ff;
              color: #6b21a8;
              border: 1px solid #d8b4fe;
            }
          }
        }

        .user-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 3px;
          flex-wrap: wrap;

          .meta-pill {
            font-size: 0.72rem;
            color: #475569;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            padding: 1px 6px;
            border-radius: 4px;
          }
        }
      }

      .start-chat-btn {
        flex-shrink: 0;
        height: 34px;
        padding: 0 14px;
        border-radius: 6px;
        font-size: 0.82rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    }

    @media (max-width: 640px) {
      .directory-controls {
        flex-direction: column;
        align-items: stretch;
      }
      .user-card {
        flex-wrap: wrap;
        .start-chat-btn {
          width: 100%;
          justify-content: center;
          margin-top: 4px;
        }
      }
    }
  `]
})
export class ChatDirectoryDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<ChatDirectoryDialogComponent>);
  private chatService = inject(ChatService);
  private authService = inject(AuthService);

  readonly isStudentOrParent = signal<boolean>(this.authService.isStudentOrParent());
  readonly searchControl = new FormControl('');
  readonly filterControl = new FormControl('all');

  readonly users = signal<ChatDirectoryUser[]>([]);
  readonly loading = signal<boolean>(false);
  readonly startingChat = signal<string | null>(null);

  ngOnInit(): void {
    this.loadUsers();

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.loadUsers());

    this.filterControl.valueChanges.subscribe(() => this.loadUsers());
  }

  loadUsers(): void {
    this.loading.set(true);
    const search = this.searchControl.value || '';
    const filter = this.filterControl.value || 'all';

    this.chatService.getDirectory(search, filter).subscribe({
      next: (res) => {
        this.users.set(res || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSelectUser(user: ChatDirectoryUser): void {
    this.startingChat.set(user.userId);
    this.chatService.startDirectChat(user.userId).subscribe({
      next: (res) => {
        this.startingChat.set(null);
        this.dialogRef.close({ conversationId: res.conversationId });
      },
      error: () => this.startingChat.set(null)
    });
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  getInitials(name?: string | null): string {
    if (!name) return 'U';
    const clean = name.replace(/[()[\]{}_/\\-]/g, ' ').replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const parts = clean.split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  getRoleBadgeLabel(u: ChatDirectoryUser): string {
    if (u.userRole === 'Teacher' || u.userRole === 'Principal') return 'Faculty';
    if (u.isSameClass) return 'Classmate';
    return 'Student';
  }

  getRoleBadgeClass(role: string, isSameClass: boolean): string {
    if (role === 'Teacher' || role === 'Principal') return 'teacher';
    if (isSameClass) return 'same-class';
    return 'other-class';
  }
}
