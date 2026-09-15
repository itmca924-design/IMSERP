import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UserDto, UsersService } from '../../core/services/users.service';
import { UserDialogComponent } from './user-dialog.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatDialogModule,
    MatProgressBarModule,
    MatCardModule,
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">System Users & Role Assignment</h1>
          <p class="page-subtitle">Create user logins, assign dynamic roles, and map menu permissions from DB.</p>
        </div>
        <button mat-raised-button color="primary" class="add-btn" (click)="openUserModal()">
          <mat-icon>person_add</mat-icon>
          <span>Create New User</span>
        </button>
      </div>

      <mat-card class="table-card mat-elevation-z2">
        <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

        <div class="table-responsive">
          <table mat-table [dataSource]="users" class="mat-elevation-z0 full-width-table">
            
            <ng-container matColumnDef="username">
              <th mat-header-cell *matHeaderCellDef> Username </th>
              <td mat-cell *matCellDef="let element">
                <span class="user-name-cell">{{ element.username }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="fullName">
              <th mat-header-cell *matHeaderCellDef> Full Name </th>
              <td mat-cell *matCellDef="let element"> {{ element.fullName }} </td>
            </ng-container>

            <ng-container matColumnDef="roleName">
              <th mat-header-cell *matHeaderCellDef> Assigned Role </th>
              <td mat-cell *matCellDef="let element">
                <mat-chip-option [selectable]="false" selected color="accent" class="role-chip">
                  <mat-icon class="chip-icon">admin_panel_settings</mat-icon>
                  {{ element.roleName }}
                </mat-chip-option>
              </td>
            </ng-container>

            <ng-container matColumnDef="branchName">
              <th mat-header-cell *matHeaderCellDef> Assigned Branch </th>
              <td mat-cell *matCellDef="let element">
                <span class="branch-tag" *ngIf="element.branchName">
                  <mat-icon class="inline-icon">store</mat-icon>
                  {{ element.branchName }}
                </span>
                <span class="head-office-tag" *ngIf="!element.branchName">
                  <mat-icon class="inline-icon">corporate_fare</mat-icon>
                  All Branches (HQ)
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="contact">
              <th mat-header-cell *matHeaderCellDef> Contact Info </th>
              <td mat-cell *matCellDef="let element">
                <div class="contact-info">
                  <span>{{ element.email || '-' }}</span>
                  <small class="muted">{{ element.phoneNumber }}</small>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef> Status </th>
              <td mat-cell *matCellDef="let element">
                <span [class.active-text]="element.isActive" [class.inactive-text]="!element.isActive">
                  {{ element.isActive ? 'Active' : 'Disabled' }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-right"> Actions </th>
              <td mat-cell *matCellDef="let element" class="text-right">
                <button mat-icon-button color="primary" (click)="openUserModal(element)" matTooltip="Edit User & Role">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deleteUser(element)" matTooltip="Delete User Account">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      .page-title {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0;
        color: #1976d2;
      }
      .page-subtitle {
        color: #666;
        margin: 4px 0 0 0;
        font-size: 0.9rem;
      }
    }
    .table-card {
      border-radius: 8px;
      overflow: hidden;
    }
    .full-width-table {
      width: 100%;
    }
    .user-name-cell {
      font-weight: 600;
      color: #2c3e50;
    }
    .role-chip {
      font-size: 0.75rem;
      height: 24px;
      .chip-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        margin-right: 4px;
      }
    }
    .contact-info {
      display: flex;
      flex-direction: column;
      font-size: 0.85rem;
      .muted {
        color: #888;
      }
    }
    .active-text {
      color: #2e7d32;
      font-weight: 600;
    }
    .inactive-text {
      color: #c62828;
    }
    .branch-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.78rem;
      font-weight: 500;
      color: #0369a1;
      background: #e0f2fe;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .head-office-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.78rem;
      font-weight: 500;
      color: #475569;
      background: #f1f5f9;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .inline-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
    }
    .text-right {
      text-align: right;
    }
  `]
})
export class UsersComponent implements OnInit {
  displayedColumns: string[] = ['username', 'fullName', 'roleName', 'branchName', 'contact', 'status', 'actions'];
  users: UserDto[] = [];
  loading = false;

  constructor(private usersService: UsersService, private dialog: MatDialog) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.usersService.getUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        console.error('Error fetching users:', err);
      }
    });
  }

  openUserModal(user?: UserDto): void {
    const dialogRef = this.dialog.open(UserDialogComponent, {
      width: '560px',
      data: user ? { ...user } : undefined
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.loadUsers();
      }
    });
  }

  deleteUser(user: UserDto): void {
    if (confirm(`Are you sure you want to delete user account "${user.username}"?`)) {
      this.loading = true;
      this.usersService.deleteUser(user.id).subscribe({
        next: () => {
          this.loadUsers();
        },
        error: (err) => {
          this.loading = false;
          alert(err?.error?.message || 'Error deleting user.');
        }
      });
    }
  }
}
