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
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { BatchDto, BatchesService } from '../../core/services/batches.service';
import { BatchDialogComponent } from './batch-dialog.component';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { StudentRollSequencerDialogComponent } from '../students/student-roll-sequencer-dialog.component';
import { QuickBatchMentorDialogComponent } from './quick-batch-mentor-dialog.component';
import { SectionRoutineDialogComponent } from '../school/section-routine-dialog.component';
import { CoachingService } from '../../core/services/coaching.service';

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
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Coaching Batches Directory</h1>
          <p class="page-subtitle">Manage coaching batches, schedules, fee structures, and assigned students.</p>
        </div>
        <div class="header-btns">
          <button mat-stroked-button color="primary" class="sequence-btn" (click)="openRollSequencer()">
            <mat-icon>format_list_numbered</mat-icon>
            <span>Sequence Roll Nos</span>
          </button>
          <button mat-raised-button color="primary" class="add-btn" (click)="openBatchModal()">
            <mat-icon>add</mat-icon>
            <span>Create New Batch</span>
          </button>
        </div>
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

          <!-- Single / Combined scope toggle -->
          <div class="scope-filter-toggle">
            <button type="button"
                    class="scope-filter-btn"
                    [class.active]="batchScopeFilter === 'all'"
                    (click)="batchScopeFilter = 'all'">
              <mat-icon>apps</mat-icon>
              <span>All</span>
              <span class="scope-pill">{{ batches.length }}</span>
            </button>
            <button type="button"
                    class="scope-filter-btn"
                    [class.active]="batchScopeFilter === 'single'"
                    (click)="batchScopeFilter = 'single'">
              <mat-icon>school</mat-icon>
              <span>Single Class</span>
              <span class="scope-pill">{{ singleClassBatchCount }}</span>
            </button>
            <button type="button"
                    class="scope-filter-btn"
                    [class.active]="batchScopeFilter === 'combined'"
                    (click)="batchScopeFilter = 'combined'">
              <mat-icon>layers</mat-icon>
              <span>Multi-Class</span>
              <span class="scope-pill">{{ combinedBatchCount }}</span>
            </button>
          </div>
        </div>

        <mat-progress-bar mode="indeterminate" *ngIf="loading" class="grid-loader"></mat-progress-bar>

        <div class="table-responsive">
          <table mat-table [dataSource]="filteredBatchView" matSort (matSortChange)="onSortChange($event)" class="mat-elevation-z0 full-width-table">
            
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="name"> Batch Name </th>
              <td mat-cell *matCellDef="let element">
                <span class="batch-name-cell">{{ element.name }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="className">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="class"> Class / Grade </th>
              <td mat-cell *matCellDef="let element">
                <span class="class-tag" *ngIf="element.className && !isCombinedBatch(element)">
                  <mat-icon class="inline-icon">school</mat-icon>
                  {{ element.className }}
                </span>
                <span class="multi-class-tag" *ngIf="isCombinedBatch(element)">
                  <mat-icon class="inline-icon">layers</mat-icon>
                  {{ getBatchClassDisplay(element) }}
                </span>
                <span class="unassigned-tag" *ngIf="!element.className && !isCombinedBatch(element)">General</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="mentor">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="mentor"> Batch Mentor / In-charge </th>
              <td mat-cell *matCellDef="let element">
                <div class="mentor-cell" *ngIf="element.mentorTeacherName">
                  <div class="mentor-avatar">
                    <mat-icon>person</mat-icon>
                  </div>
                  <div class="mentor-details">
                    <strong class="mentor-name">{{ element.mentorTeacherName }}</strong>
                    <span class="mentor-sub" *ngIf="element.mentorTeacherPhone">{{ element.mentorTeacherPhone }}</span>
                  </div>
                  <button mat-icon-button class="quick-assign-btn" (click)="openQuickMentorModal(element)" matTooltip="Change Batch Mentor">
                    <mat-icon>edit</mat-icon>
                  </button>
                </div>
                <button *ngIf="!element.mentorTeacherName" mat-stroked-button class="assign-mentor-btn" (click)="openQuickMentorModal(element)" matTooltip="Assign designated mentor for this batch">
                  <mat-icon>person_add</mat-icon>
                  <span>Assign Mentor</span>
                </button>
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
              <th mat-header-cell *matHeaderCellDef class="text-right action-th-col">
                <mat-icon class="header-action-icon" matTooltip="Batch Actions">settings</mat-icon>
              </th>
              <td mat-cell *matCellDef="let element" class="text-right action-td-col">
                <div class="row-actions-group">
                  <button mat-icon-button class="routine-quick-btn" (click)="openBatchRoutine(element)" matTooltip="Configure Timetable & Lecture Routine (रूटीन व टाइमिंग सेट करें)">
                    <mat-icon>calendar_view_week</mat-icon>
                  </button>
                  <button mat-icon-button [matMenuTriggerFor]="batchMenu" class="action-menu-btn" matTooltip="More Actions">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                </div>

                <mat-menu #batchMenu="matMenu" xPosition="before" class="batch-action-menu">
                  <button mat-menu-item (click)="openBatchRoutine(element)">
                    <mat-icon color="primary">calendar_view_week</mat-icon>
                    <span>Batch Timetable & Routine</span>
                  </button>
                  <button mat-menu-item (click)="openQuickMentorModal(element)">
                    <mat-icon color="primary">person</mat-icon>
                    <span>Assign / Change Mentor</span>
                  </button>
                  <button mat-menu-item (click)="openRollSequencer(element)">
                    <mat-icon color="primary">format_list_numbered</mat-icon>
                    <span>Sequence Roll Numbers</span>
                  </button>
                  <button mat-menu-item (click)="openBatchModal(element)">
                    <mat-icon color="primary">edit</mat-icon>
                    <span>Edit Batch</span>
                  </button>
                  <mat-divider></mat-divider>
                  <button mat-menu-item (click)="deleteBatch(element)" class="delete-menu-item">
                    <mat-icon color="warn">delete</mat-icon>
                    <span class="text-warn">Delete Batch</span>
                  </button>
                </mat-menu>
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
      .header-btns {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
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
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;

      .search-field {
        width: 300px;
        flex-shrink: 0;
      }
      .session-filter {
        width: 160px;
        flex-shrink: 0;
      }
    }
    .scope-filter-toggle {
      display: flex;
      gap: 4px;
      background: #f1f5f9;
      border-radius: 10px;
      padding: 3px;
      align-items: center;

      .scope-filter-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 12px;
        border: 1.5px solid transparent;
        border-radius: 7px;
        background: transparent;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 600;
        color: #64748b;
        transition: all 0.15s ease;
        white-space: nowrap;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }

        .scope-pill {
          background: #cbd5e1;
          color: #475569;
          padding: 1px 6px;
          border-radius: 10px;
          font-size: 0.7rem;
          font-weight: 700;
        }

        &:hover {
          background: #e2e8f0;
          color: #334155;
        }

        &.active {
          background: #ffffff;
          border-color: #2563eb;
          color: #1e40af;
          box-shadow: 0 1px 3px rgba(37,99,235,0.15);

          mat-icon { color: #2563eb; }

          .scope-pill {
            background: #dbeafe;
            color: #1d4ed8;
          }
        }
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
    .class-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #6d28d9;
      background: #f5f3ff;
      border: 1px solid #ddd6fe;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .multi-class-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #047857;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      padding: 3px 8px;
      border-radius: 6px;
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
    .action-th-col {
      width: 60px;
      text-align: right;
      padding-right: 14px;
      .header-action-icon {
        font-size: 19px;
        width: 19px;
        height: 19px;
        color: #64748b;
        vertical-align: middle;
      }
    }
    .row-actions-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .routine-quick-btn {
      color: #2563eb;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      width: 32px;
      height: 32px;
      line-height: 32px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      mat-icon { font-size: 18px; width: 18px; height: 18px; line-height: 18px; }
      &:hover {
        background: #2563eb;
        color: #ffffff;
        box-shadow: 0 2px 6px rgba(37,99,235,0.3);
      }
    }
    .action-menu-btn {
      color: #64748b;
      &:hover {
        color: #1e293b;
        background-color: #f1f5f9;
      }
    }
    .text-warn {
      color: #ef4444;
      font-weight: 500;
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
    .mentor-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .mentor-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .mentor-details {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
    }
    .mentor-name {
      font-size: 0.84rem;
      font-weight: 600;
      color: #0f172a;
      white-space: nowrap;
    }
    .mentor-sub {
      font-size: 0.72rem;
      color: #64748b;
      white-space: nowrap;
    }
    .quick-assign-btn {
      width: 26px;
      height: 26px;
      line-height: 26px;
      color: #64748b;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { color: #2563eb; }
    }
    .assign-mentor-btn {
      font-size: 0.74rem;
      font-weight: 600;
      color: #2563eb;
      border-color: #bfdbfe !important;
      background: #eff6ff !important;
      padding: 0 10px;
      height: 28px;
      line-height: 28px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { background: #dbeafe !important; }
    }
  `]
})
export class BatchesComponent implements OnInit {
  displayedColumns: string[] = ['name', 'className', 'mentor', 'branchName', 'roomName', 'subject', 'academicYear', 'studentCount', 'actions'];
  batches: BatchDto[] = [];
  batchScopeFilter: 'all' | 'single' | 'combined' = 'all';

  get filteredBatchView(): BatchDto[] {
    if (this.batchScopeFilter === 'all') return this.batches;
    if (this.batchScopeFilter === 'single') return this.batches.filter(b => !this.isCombinedBatch(b));
    return this.batches.filter(b => this.isCombinedBatch(b));
  }

  get singleClassBatchCount(): number {
    return this.batches.filter(b => !this.isCombinedBatch(b)).length;
  }

  get combinedBatchCount(): number {
    return this.batches.filter(b => this.isCombinedBatch(b)).length;
  }
  
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
    private coachingService: CoachingService,
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
      width: '880px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      data: batch ? { ...batch } : undefined
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadBatches();
        this.confirmDialog.alert('Batch Saved', 'Academic batch saved successfully!', 'success');
      }
    });
  }

  openRollSequencer(batch?: BatchDto): void {
    const dialogRef = this.dialog.open(StudentRollSequencerDialogComponent, {
      width: '940px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'cert-modal-container',
      disableClose: false,
      data: {
        batches: this.batches,
        selectedBatchId: batch ? batch.id : undefined,
        selectedClassId: batch ? (batch.classId || undefined) : undefined,
        initialScope: 'coaching'
      }
    });

    dialogRef.afterClosed().subscribe((changed) => {
      if (changed) {
        this.loadBatches();
      }
    });
  }

  openQuickMentorModal(batch: BatchDto): void {
    const dialogRef = this.dialog.open(QuickBatchMentorDialogComponent, {
      width: '540px',
      maxWidth: '96vw',
      panelClass: 'erp-custom-dialog',
      autoFocus: false,
      data: {
        batchId: batch.id,
        batchName: batch.name,
        className: batch.className,
        currentMentorTeacherId: batch.mentorTeacherId,
        currentMentorTeacherName: batch.mentorTeacherName
      }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadBatches();
      }
    });
  }

  openBatchRoutine(batch: BatchDto): void {
    this.coachingService.getTeachers().subscribe({
      next: (teachersList) => {
        this.dialog.open(SectionRoutineDialogComponent, {
          width: '1180px',
          maxWidth: '96vw',
          maxHeight: '92vh',
          panelClass: 'erp-custom-dialog',
          autoFocus: false,
          data: {
            batchId: batch.id,
            batchName: batch.name,
            classId: batch.classId,
            className: batch.className,
            branchId: batch.branchId,
            mentorTeacherId: batch.mentorTeacherId,
            mentorTeacherName: batch.mentorTeacherName,
            batchSubjects: batch.subject,
            teachers: teachersList || []
          }
        });
      },
      error: () => {
        this.dialog.open(SectionRoutineDialogComponent, {
          width: '1180px',
          maxWidth: '96vw',
          maxHeight: '92vh',
          panelClass: 'erp-custom-dialog',
          autoFocus: false,
          data: {
            batchId: batch.id,
            batchName: batch.name,
            classId: batch.classId,
            className: batch.className,
            branchId: batch.branchId,
            mentorTeacherId: batch.mentorTeacherId,
            mentorTeacherName: batch.mentorTeacherName,
            batchSubjects: batch.subject,
            teachers: []
          }
        });
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

  isCombinedBatch(b: any): boolean {
    if (!b?.classId) return true;
    return !!(b?.name && b.name.match(/class\s*\d+.*(?:to|-).*\d+/i));
  }

  getBatchClassDisplay(b: any): string {
    const rangeMatch = (b?.name || '').match(/class\s*(\d+)(?:st|nd|rd|th)?\s*(?:to|-)\s*(?:class\s*)?(\d+)(?:st|nd|rd|th)?/i);
    if (rangeMatch) {
      return `Combined (${rangeMatch[1]}th - ${rangeMatch[2]}th)`;
    }
    return b?.className || 'Combined (All Classes)';
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
