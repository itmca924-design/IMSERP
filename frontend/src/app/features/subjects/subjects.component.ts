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
import { SubjectDto, SubjectsService } from '../../core/services/subjects.service';
import { SubjectDialogComponent } from './subject-dialog.component';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-subjects',
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
          <h1 class="page-title">Subject Master Directory</h1>
          <p class="page-subtitle">Configure academic subjects (Physics, Chemistry, Math, etc.) with server-side sorting & filtering.</p>
        </div>
        <button mat-raised-button color="primary" class="add-btn" (click)="openSubjectModal()">
          <mat-icon>add</mat-icon>
          <span>Add New Subject</span>
        </button>
      </div>

      <mat-card class="table-card mat-elevation-z2">
        <div class="filter-toolbar">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search Subjects...</mat-label>
            <input matInput [(ngModel)]="searchTerm" (keyup.enter)="onSearch()" placeholder="Search by name, code or description" />
            <button *ngIf="searchTerm" matSuffix mat-icon-button aria-label="Clear" (click)="clearSearch()">
              <mat-icon>close</mat-icon>
            </button>
            <button matSuffix mat-icon-button (click)="onSearch()">
              <mat-icon>search</mat-icon>
            </button>
          </mat-form-field>

          <mat-form-field appearance="outline" class="status-filter">
            <mat-label>Status Filter</mat-label>
            <mat-select [(ngModel)]="statusFilter" (selectionChange)="onStatusFilterChange()">
              <mat-option [value]="null">All Statuses</mat-option>
              <mat-option [value]="true">Active Only</mat-option>
              <mat-option [value]="false">Inactive Only</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Server-side Operation Progress Loader -->
        <mat-progress-bar mode="indeterminate" *ngIf="loading" class="grid-loader"></mat-progress-bar>

        <div class="table-responsive">
          <table mat-table [dataSource]="subjects" matSort (matSortChange)="onSortChange($event)" class="mat-elevation-z0 full-width-table">
            
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="name"> Subject Name </th>
              <td mat-cell *matCellDef="let element">
                <div class="subject-title">
                  <mat-icon color="primary" class="book-icon">menu_book</mat-icon>
                  <strong>{{ element.name }}</strong>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="code">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="code"> Subject Code </th>
              <td mat-cell *matCellDef="let element">
                <mat-chip-option [selectable]="false" selected color="accent" class="code-chip">
                  {{ element.code || 'GEN' }}
                </mat-chip-option>
              </td>
            </ng-container>

            <ng-container matColumnDef="description">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="description"> Description </th>
              <td mat-cell *matCellDef="let element">
                <span class="desc-text">{{ element.description || 'Standard Coaching Curriculum' }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="status"> Status </th>
              <td mat-cell *matCellDef="let element">
                <span [class.active-text]="element.isActive" [class.inactive-text]="!element.isActive">
                  {{ element.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-right"> Actions </th>
              <td mat-cell *matCellDef="let element" class="text-right">
                <button mat-icon-button color="primary" (click)="openSubjectModal(element)" matTooltip="Edit Subject">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deleteSubject(element)" matTooltip="Delete Subject">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell empty-cell" [attr.colspan]="displayedColumns.length">
                <div class="empty-state" *ngIf="!loading">
                  <mat-icon class="empty-icon">menu_book</mat-icon>
                  <p>No subjects found matching your filter criteria.</p>
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
      .status-filter {
        width: 180px;
      }
    }
    .grid-loader {
      margin-top: 4px;
    }
    .full-width-table {
      width: 100%;
    }
    .subject-title {
      display: flex;
      align-items: center;
      gap: 10px;
      .book-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }
    .code-chip {
      font-size: 0.75rem;
      height: 22px;
    }
    .desc-text {
      color: #666;
      font-size: 0.88rem;
    }
    .active-text {
      color: #2e7d32;
      font-weight: 600;
    }
    .inactive-text {
      color: #c62828;
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
export class SubjectsComponent implements OnInit {
  displayedColumns: string[] = ['name', 'code', 'description', 'status', 'actions'];
  subjects: SubjectDto[] = [];
  
  loading = false;
  totalCount = 0;
  pageSize = 10;
  pageIndex = 0;
  searchTerm = '';
  sortBy = 'name';
  sortDescending = false;
  statusFilter: boolean | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private subjectsService: SubjectsService,
    private confirmDialog: ConfirmDialogService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadSubjects();
  }

  loadSubjects(): void {
    this.loading = true;
    this.subjectsService.getSubjectsPaged(
      this.pageIndex + 1,
      this.pageSize,
      this.searchTerm,
      this.sortBy,
      this.sortDescending,
      this.statusFilter
    ).subscribe({
      next: (res) => {
        this.subjects = res.items;
        this.totalCount = res.totalCount;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        console.error('Error loading paged subjects:', err);
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadSubjects();
  }

  onSortChange(sort: Sort): void {
    this.sortBy = sort.active || 'name';
    this.sortDescending = sort.direction === 'desc';
    this.pageIndex = 0;
    this.loadSubjects();
  }

  onStatusFilterChange(): void {
    this.pageIndex = 0;
    this.loadSubjects();
  }

  onSearch(): void {
    this.pageIndex = 0;
    this.loadSubjects();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.pageIndex = 0;
    this.loadSubjects();
  }

  openSubjectModal(subject?: SubjectDto): void {
    const dialogRef = this.dialog.open(SubjectDialogComponent, {
      width: '540px',
      maxWidth: '96vw',
      data: subject ? { ...subject } : undefined
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.loadSubjects();
        this.confirmDialog.alert('Subject Saved', 'Subject details saved successfully!', 'success');
      }
    });
  }

  deleteSubject(subject: SubjectDto): void {
    this.confirmDialog.danger(
      'Delete Subject',
      `Are you sure you want to delete subject "${subject.name}"? This action cannot be undone.`,
      'Delete Subject'
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.loading = true;
        this.subjectsService.deleteSubject(subject.id).subscribe({
          next: () => {
            this.loadSubjects();
            this.confirmDialog.alert('Deleted', `Subject "${subject.name}" has been deleted.`, 'success');
          },
          error: (err) => {
            this.loading = false;
            this.confirmDialog.alert('Delete Failed', err?.error?.message || 'Error deleting subject.', 'danger');
          }
        });
      }
    });
  }
}
