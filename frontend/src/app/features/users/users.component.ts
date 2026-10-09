import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { UserDto, UsersService } from '../../core/services/users.service';
import { RoleDto, RolesService } from '../../core/services/roles.service';
import { BranchDto, BranchService } from '../../core/services/branch.service';
import { UserDialogComponent } from './user-dialog.component';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
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
          <h1 class="page-title">
            <mat-icon class="title-icon">manage_accounts</mat-icon>
            System Users &amp; Role Assignment
          </h1>
          <p class="page-subtitle">Create user logins, assign dynamic roles, and map menu permissions from DB with server-side controls.</p>
        </div>
        <button mat-raised-button color="primary" class="add-btn" (click)="openUserModal()">
          <mat-icon>person_add</mat-icon>
          <span>Create New User</span>
        </button>
      </div>

      <mat-card class="table-card mat-elevation-z2">
        <!-- Filter & Search Toolbar -->
        <div class="filter-toolbar">
          <div class="toolbar-left">
            <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
              <mat-label>Search Users...</mat-label>
              <input
                matInput
                [(ngModel)]="searchTerm"
                (ngModelChange)="onSearchInput($event)"
                (keyup.enter)="loadUsers()"
                placeholder="Username, Name, Email, Phone..." />
              <button *ngIf="searchTerm" matSuffix mat-icon-button aria-label="Clear Search" (click)="clearSearch()">
                <mat-icon>close</mat-icon>
              </button>
              <button matSuffix mat-icon-button (click)="loadUsers()" matTooltip="Search">
                <mat-icon>search</mat-icon>
              </button>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-select" subscriptSizing="dynamic">
              <mat-label>Filter by Role</mat-label>
              <mat-select [(ngModel)]="roleFilter" (selectionChange)="onFilterChange()">
                <mat-option value="">All Roles</mat-option>
                <mat-option *ngFor="let r of roles" [value]="r.id">
                  {{ r.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-select" subscriptSizing="dynamic">
              <mat-label>Campus / Branch</mat-label>
              <mat-select [(ngModel)]="branchFilter" (selectionChange)="onFilterChange()">
                <mat-option value="">All Campuses</mat-option>
                <mat-option value="00000000-0000-0000-0000-000000000000">🏢 All Branches (HQ)</mat-option>
                <mat-option *ngFor="let b of branches" [value]="b.id">
                  🏫 {{ b.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="status-select" subscriptSizing="dynamic">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="statusFilter" (selectionChange)="onFilterChange()">
                <mat-option [value]="null">All Statuses</mat-option>
                <mat-option [value]="true">Active Only</mat-option>
                <mat-option [value]="false">Disabled Only</mat-option>
              </mat-select>
            </mat-form-field>

            <button
              mat-stroked-button
              color="warn"
              class="reset-btn"
              *ngIf="hasActiveFilters()"
              (click)="resetFilters()"
              matTooltip="Reset search and filters">
              <mat-icon>restart_alt</mat-icon>
              <span>Reset</span>
            </button>
          </div>

          <div class="toolbar-right" *ngIf="!loading">
            <span class="user-count-chip">
              <mat-icon class="chip-count-icon">people</mat-icon>
              <strong>{{ totalCount }}</strong> {{ totalCount === 1 ? 'User' : 'Users' }}
            </span>
          </div>
        </div>

        <!-- Server-side Operation Progress Loader -->
        <mat-progress-bar mode="indeterminate" *ngIf="loading" class="grid-loader"></mat-progress-bar>

        <div class="table-responsive" [class.loading-dimmed]="loading">
          <table
            mat-table
            [dataSource]="users"
            matSort
            (matSortChange)="onSortChange($event)"
            class="mat-elevation-z0 full-width-table">

            <!-- Username Column -->
            <ng-container matColumnDef="username">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="username"> Username </th>
              <td mat-cell *matCellDef="let element">
                <span class="user-name-cell">{{ element.username }}</span>
              </td>
            </ng-container>

            <!-- Full Name Column -->
            <ng-container matColumnDef="fullName">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="fullName"> Full Name </th>
              <td mat-cell *matCellDef="let element">
                <strong>{{ element.fullName }}</strong>
              </td>
            </ng-container>

            <!-- Assigned Role Column -->
            <ng-container matColumnDef="roleName">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="roleName"> Assigned Role </th>
              <td mat-cell *matCellDef="let element">
                <mat-chip-option [selectable]="false" selected color="accent" class="role-chip">
                  <mat-icon class="chip-icon">admin_panel_settings</mat-icon>
                  {{ element.roleName }}
                </mat-chip-option>
              </td>
            </ng-container>

            <!-- Assigned Branch Column -->
            <ng-container matColumnDef="branchName">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="branchName"> Assigned Branch </th>
              <td mat-cell *matCellDef="let element">
                <span class="branch-tag" *ngIf="element.branchName" [title]="element.branchName">
                  <mat-icon class="inline-icon">store</mat-icon>
                  <span class="branch-text">{{ element.branchName }}</span>
                </span>
                <span class="head-office-tag" *ngIf="!element.branchName" title="All Branches (HQ)">
                  <mat-icon class="inline-icon">corporate_fare</mat-icon>
                  <span class="branch-text">All Branches (HQ)</span>
                </span>
              </td>
            </ng-container>

            <!-- Contact Info Column -->
            <ng-container matColumnDef="contact">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="contact"> Contact Info </th>
              <td mat-cell *matCellDef="let element">
                <div class="contact-info">
                  <span>{{ element.email || '—' }}</span>
                  <small class="muted">{{ element.phoneNumber || '—' }}</small>
                </div>
              </td>
            </ng-container>

            <!-- Status Column -->
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="status"> Status </th>
              <td mat-cell *matCellDef="let element">
                <span [class.active-text]="element.isActive" [class.inactive-text]="!element.isActive">
                  <mat-icon class="status-dot-icon">{{ element.isActive ? 'check_circle' : 'cancel' }}</mat-icon>
                  {{ element.isActive ? 'Active' : 'Disabled' }}
                </span>
              </td>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-right"> Actions </th>
              <td mat-cell *matCellDef="let element" class="text-right">
                <button
                  mat-icon-button
                  color="primary"
                  (click)="openUserModal(element)"
                  [disabled]="loading"
                  matTooltip="Edit User &amp; Role">
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  mat-icon-button
                  color="warn"
                  (click)="deleteUser(element)"
                  [disabled]="loading"
                  matTooltip="Delete User Account">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

            <!-- No Data Empty State -->
            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell empty-cell" [attr.colspan]="displayedColumns.length">
                <div class="empty-state" *ngIf="!loading">
                  <mat-icon class="empty-icon">manage_search</mat-icon>
                  <h3>No System Users Found</h3>
                  <p>No user accounts matched your search keyword or selected filter criteria.</p>
                  <button mat-stroked-button color="primary" (click)="resetFilters()" *ngIf="hasActiveFilters()">
                    <mat-icon>filter_alt_off</mat-icon> Clear Filters &amp; Reload
                  </button>
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Server-side Pagination -->
        <mat-paginator
          [length]="totalCount"
          [pageSize]="pageSize"
          [pageSizeOptions]="[5, 10, 25, 50]"
          [pageIndex]="pageIndex"
          (page)="onPageChange($event)"
          showFirstLastButtons>
        </mat-paginator>
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
      flex-wrap: wrap;
      gap: 12px;
      .page-title {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0;
        color: #1976d2;
        display: flex;
        align-items: center;
        gap: 8px;
        .title-icon {
          font-size: 1.6rem;
          width: 1.6rem;
          height: 1.6rem;
        }
      }
      .page-subtitle {
        color: #64748b;
        margin: 4px 0 0 0;
        font-size: 0.9rem;
      }
    }
    .table-card {
      border-radius: 12px;
      overflow: hidden;
      position: relative;
      border: 1px solid #e2e8f0;
    }
    .filter-toolbar {
      padding: 16px 20px 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 14px;
      background: #fafbfc;
      border-bottom: 1px solid #f1f5f9;

      .toolbar-left {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        flex: 1;
      }

      .search-field {
        width: 280px;
        min-width: 220px;
      }
      .filter-select {
        width: 190px;
        min-width: 160px;
      }
      .status-select {
        width: 140px;
        min-width: 120px;
      }
      .reset-btn {
        height: 42px;
        border-radius: 8px;
        font-weight: 600;
      }
      .toolbar-right {
        margin-left: auto;
      }
      .user-count-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #eff6ff;
        color: #1e40af;
        border: 1px solid #bfdbfe;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 0.82rem;
        font-weight: 500;
        .chip-count-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #2563eb;
        }
      }
    }
    .grid-loader {
      height: 4px;
    }
    .table-responsive {
      width: 100%;
      overflow-x: auto;
      transition: opacity 0.2s ease-in-out;
      &.loading-dimmed {
        opacity: 0.55;
        pointer-events: none;
      }
    }
    .full-width-table {
      width: 100%;
      min-width: 880px;
    }
    .mat-column-branchName {
      min-width: 170px;
    }
    .user-name-cell {
      font-weight: 700;
      color: #1e293b;
      font-family: monospace;
      font-size: 0.92rem;
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
        color: #64748b;
      }
    }
    .active-text {
      color: #16a34a;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      .status-dot-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }
    .inactive-text {
      color: #dc2626;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      .status-dot-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }
    .branch-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      font-weight: 500;
      color: #0369a1;
      background: #e0f2fe;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid #bae6fd;
      line-height: 1.35;
      max-width: 100%;
      box-sizing: border-box;
    }
    .head-office-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      font-weight: 500;
      color: #475569;
      background: #f1f5f9;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      line-height: 1.35;
      max-width: 100%;
      box-sizing: border-box;
    }
    .inline-icon {
      font-size: 16px !important;
      width: 16px !important;
      height: 16px !important;
      line-height: 16px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      flex-shrink: 0 !important;
      vertical-align: middle !important;
      color: #0284c7;
    }
    .head-office-tag .inline-icon {
      color: #64748b;
    }
    .branch-text {
      flex: 1;
      min-width: 0;
    }
    .text-right {
      text-align: right;
    }
    .empty-cell {
      padding: 50px 20px !important;
      text-align: center;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #64748b;
      .empty-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #94a3b8;
      }
      h3 {
        margin: 0;
        color: #1e293b;
        font-size: 1.15rem;
        font-weight: 700;
      }
      p {
        margin: 0 0 8px 0;
        font-size: 0.88rem;
        color: #64748b;
      }
    }

    @media (max-width: 900px) {
      .filter-toolbar {
        padding: 12px 14px;
        .toolbar-left {
          width: 100%;
        }
        .search-field, .filter-select, .status-select {
          width: 100%;
        }
        .reset-btn {
          width: 100%;
        }
      }
    }
  `]
})
export class UsersComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = ['username', 'fullName', 'roleName', 'branchName', 'contact', 'status', 'actions'];
  users: UserDto[] = [];
  roles: RoleDto[] = [];
  branches: BranchDto[] = [];
  
  loading = false;
  totalCount = 0;
  pageSize = 10;
  pageIndex = 0;
  
  searchTerm = '';
  sortBy = 'username';
  sortDescending = false;
  statusFilter: boolean | null = null;
  roleFilter = '';
  branchFilter = '';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  constructor(
    private usersService: UsersService,
    private rolesService: RolesService,
    private branchService: BranchService,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadRoles();
    this.loadBranches();
    this.loadUsers();

    // Debounce search input for seamless real-time server querying
    this.searchSub = this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe(() => {
      this.pageIndex = 0;
      this.loadUsers();
    });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  loadRoles(): void {
    this.rolesService.getRoles().subscribe({
      next: (data) => {
        this.roles = data || [];
      },
      error: (err) => console.error('Error fetching roles for user filter:', err)
    });
  }

  loadBranches(): void {
    this.branchService.getBranches().subscribe({
      next: (data) => {
        this.branches = data || [];
      },
      error: (err) => console.error('Error fetching branches for user filter:', err)
    });
  }

  loadUsers(): void {
    this.loading = true;
    this.usersService.getUsersPaged(
      this.pageIndex + 1,
      this.pageSize,
      this.searchTerm,
      this.sortBy,
      this.sortDescending,
      this.statusFilter,
      this.roleFilter || null,
      this.branchFilter || null
    ).subscribe({
      next: (res) => {
        this.users = res.items || [];
        this.totalCount = res.totalCount || 0;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        console.error('Error fetching paged users:', err);
      }
    });
  }

  onSearchInput(value: string): void {
    this.searchSubject.next(value);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.pageIndex = 0;
    this.loadUsers();
  }

  onFilterChange(): void {
    this.pageIndex = 0;
    this.loadUsers();
  }

  onSortChange(sort: Sort): void {
    this.sortBy = sort.active || 'username';
    this.sortDescending = sort.direction === 'desc';
    this.pageIndex = 0;
    this.loadUsers();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadUsers();
  }

  hasActiveFilters(): boolean {
    return !!(this.searchTerm.trim() || this.roleFilter || this.branchFilter || this.statusFilter !== null);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.roleFilter = '';
    this.branchFilter = '';
    this.statusFilter = null;
    this.pageIndex = 0;
    this.loadUsers();
  }

  openUserModal(user?: UserDto): void {
    const dialogRef = this.dialog.open(UserDialogComponent, {
      width: '600px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      autoFocus: false,
      data: user ? { ...user } : undefined
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.loadUsers();
      }
    });
  }

  deleteUser(user: UserDto): void {
    this.confirmDialog.danger(
      'Delete User Account',
      `Are you sure you want to delete user account "${user.username}"? This action cannot be undone.`,
      'Delete Account'
    ).subscribe((confirmed) => {
      if (!confirmed) return;
      this.loading = true;
      this.usersService.deleteUser(user.id).subscribe({
        next: () => {
          this.loadUsers();
        },
        error: (err) => {
          this.loading = false;
          this.confirmDialog.alert('Delete Failed', err?.error?.message || 'Error deleting user.', 'danger');
        }
      });
    });
  }
}
