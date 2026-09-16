import { Component, OnInit, ViewChild } from '@angular/core';
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
import { BatchDto, BatchesService } from '../../core/services/batches.service';
import { BatchDialogComponent } from './batch-dialog.component';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-batches',
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
          <h1 class="page-title">Batches Master Directory</h1>
          <p class="page-subtitle">Manage academic batches, fee structures, and assigned students with server-side sorting & filtering.</p>
        </div>
        <button mat-raised-button color="primary" class="add-btn" (click)="openBatchModal()">
          <mat-icon>add</mat-icon>
          <span>Create New Batch</span>
        </button>
      </div>

      <mat-card class="table-card mat-elevation-z2">
        <div class="filter-toolbar">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search Batches...</mat-label>
            <input matInput [(ngModel)]="searchTerm" (keyup.enter)="onSearch()" placeholder="Search by batch name, subject or session" />
            <button *ngIf="searchTerm" matSuffix mat-icon-button aria-label="Clear" (click)="clearSearch()">
              <mat-icon>close</mat-icon>
            </button>
            <button matSuffix mat-icon-button (click)="onSearch()">
              <mat-icon>search</mat-icon>
            </button>
          </mat-form-field>

          <mat-form-field appearance="outline" class="session-filter">
            <mat-label>Session Filter</mat-label>
            <mat-select [(ngModel)]="academicYearFilter" (selectionChange)="onSessionFilterChange()">
              <mat-option value="">All Sessions</mat-option>
              <mat-option value="2026-2027">2026-2027</mat-option>
              <mat-option value="2025-2026">2025-2026</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-progress-bar mode="indeterminate" *ngIf="loading" class="grid-loader"></mat-progress-bar>

        <div class="table-responsive">
          <table mat-table [dataSource]="batches" matSort (matSortChange)="onSortChange($event)" class="mat-elevation-z0 full-width-table">
            
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="name"> Batch Name </th>
              <td mat-cell *matCellDef="let element">
                <span class="batch-name-cell">{{ element.name }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="branchName">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="branch"> Branch Campus </th>
              <td mat-cell *matCellDef="let element">
                <span class="branch-tag">
                  <mat-icon class="inline-icon">store</mat-icon>
                  {{ element.branchName || 'Main Branch' }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="roomName">
              <th mat-header-cell *matHeaderCellDef> Classroom </th>
              <td mat-cell *matCellDef="let element">
                <span class="room-tag" *ngIf="element.roomNumber">
                  <mat-icon class="inline-icon">meeting_room</mat-icon>
                  {{ formatRoomDisplay(element.roomNumber) }}
                </span>
                <span class="unassigned-tag" *ngIf="!element.roomNumber">Unassigned</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="subject">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="subject"> Subjects Covered </th>
              <td mat-cell *matCellDef="let element">
                <mat-chip-set>
                  <mat-chip-option *ngFor="let s of getSubjectChips(element.subject)" [selectable]="false" selected color="primary" class="subject-badge-chip">
                    {{ s }}
                  </mat-chip-option>
                </mat-chip-set>
              </td>
            </ng-container>

            <ng-container matColumnDef="academicYear">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="academicYear"> Academic Session </th>
              <td mat-cell *matCellDef="let element">
                <mat-chip-option [selectable]="false" selected color="primary" class="year-chip">
                  {{ element.academicYear }}
                </mat-chip-option>
              </td>
            </ng-container>

            <ng-container matColumnDef="standardMonthlyFee">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="fee"> Monthly Fee (₹) </th>
              <td mat-cell *matCellDef="let element">
                <strong class="fee-text">₹{{ element.standardMonthlyFee | number:'1.2-2' }}</strong>
              </td>
            </ng-container>

            <ng-container matColumnDef="studentCount">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="students"> Active Students </th>
              <td mat-cell *matCellDef="let element">
                <mat-chip-option [selectable]="false" class="student-chip">
                  <mat-icon class="chip-icon">people</mat-icon>
                  {{ element.studentCount }} Enrolled
                </mat-chip-option>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-right"> Actions </th>
              <td mat-cell *matCellDef="let element" class="text-right">
                <button mat-icon-button color="primary" (click)="openBatchModal(element)" matTooltip="Edit Batch">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deleteBatch(element)" matTooltip="Delete Batch">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell empty-cell" [attr.colspan]="displayedColumns.length">
                <div class="empty-state" *ngIf="!loading">
                  <mat-icon class="empty-icon">class</mat-icon>
                  <p>No batches found matching your search criteria.</p>
                </div>
              </td>
            </tr>
          </table>
        </div>

        <mat-paginator
          [length]="totalCount"
          [pageSize]="pageSize"
          [pageSizeOptions]="[5, 10, 20, 50]"
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
      position: relative;
    }
    .filter-toolbar {
      padding: 16px 20px 0 20px;
      display: flex;
      gap: 16px;
      align-items: center;

      .search-field {
        width: 320px;
      }
      .session-filter {
        width: 180px;
      }
    }
    .grid-loader {
      margin-top: 4px;
    }
    .full-width-table {
      width: 100%;
    }
    .batch-name-cell {
      font-weight: 600;
      color: #2c3e50;
    }
    .subject-badge-chip {
      font-size: 0.75rem;
      height: 24px;
    }
    .fee-text {
      color: #2e7d32;
    }
    .year-chip {
      font-size: 0.75rem;
      height: 24px;
    }
    .student-chip {
      font-size: 0.75rem;
      height: 24px;
      .chip-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        margin-right: 4px;
      }
    }
    .branch-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8rem;
      font-weight: 500;
      color: #0369a1;
      background: #e0f2fe;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .room-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8rem;
      font-weight: 500;
      color: #047857;
      background: #d1fae5;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .unassigned-tag {
      font-size: 0.75rem;
      color: #94a3b8;
      font-style: italic;
    }
    .inline-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
    }
    .text-right {
      text-align: right;
    }
    .empty-cell {
      padding: 30px;
      text-align: center;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      color: #888;
      .empty-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 8px;
      }
    }
  `]
})
export class BatchesComponent implements OnInit {
  displayedColumns: string[] = ['name', 'branchName', 'roomName', 'subject', 'academicYear', 'standardMonthlyFee', 'studentCount', 'actions'];
  batches: BatchDto[] = [];
  
  loading = false;
  totalCount = 0;
  pageSize = 10;
  pageIndex = 0;
  searchTerm = '';
  sortBy = 'name';
  sortDescending = false;
  academicYearFilter = '';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private batchesService: BatchesService,
    private confirmDialog: ConfirmDialogService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadBatches();
  }

  loadBatches(): void {
    this.loading = true;
    this.batchesService.getBatchesPaged(
      this.pageIndex + 1,
      this.pageSize,
      this.searchTerm,
      this.sortBy,
      this.sortDescending,
      this.academicYearFilter
    ).subscribe({
      next: (res) => {
        this.batches = res.items;
        this.totalCount = res.totalCount;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        console.error('Error loading paged batches:', err);
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadBatches();
  }

  onSortChange(sort: Sort): void {
    this.sortBy = sort.active || 'name';
    this.sortDescending = sort.direction === 'desc';
    this.pageIndex = 0;
    this.loadBatches();
  }

  onSessionFilterChange(): void {
    this.pageIndex = 0;
    this.loadBatches();
  }

  onSearch(): void {
    this.pageIndex = 0;
    this.loadBatches();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.pageIndex = 0;
    this.loadBatches();
  }

  openBatchModal(batch?: BatchDto): void {
    const dialogRef = this.dialog.open(BatchDialogComponent, {
      width: '560px',
      data: batch ? { ...batch } : undefined
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadBatches();
        this.confirmDialog.alert('Batch Saved', 'Academic batch saved successfully!', 'success');
      }
    });
  }

  getSubjectChips(subjectStr?: string): string[] {
    if (!subjectStr) return [];
    return subjectStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  formatRoomDisplay(roomNumber?: string | null): string {
    if (!roomNumber) return '';
    const trimmed = roomNumber.trim();
    if (trimmed.toLowerCase().startsWith('room')) {
      return trimmed;
    }
    return `Room ${trimmed}`;
  }

  deleteBatch(batch: BatchDto): void {
    this.confirmDialog.danger(
      'Delete Academic Batch',
      `Are you sure you want to delete batch "${batch.name}"? This action cannot be undone.`,
      'Delete Batch'
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.loading = true;
        this.batchesService.deleteBatch(batch.id).subscribe({
          next: () => {
            this.loadBatches();
            this.confirmDialog.alert('Deleted', `Batch "${batch.name}" has been deleted.`, 'success');
          },
          error: (err) => {
            this.loading = false;
            this.confirmDialog.alert('Delete Failed', err?.error?.message || 'Failed to delete batch.', 'danger');
          }
        });
      }
    });
  }
}
