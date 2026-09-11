import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CoachingService } from '../../core/services/coaching.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="students-wrapper">
      <div class="header-actions">
        <div>
          <h2>Student Directory & Batches</h2>
          <p>Onboard students, manage parent WhatsApp details, and assign academic batches with server-side pagination.</p>
        </div>
        <button mat-raised-button color="primary" class="add-btn" (click)="toggleForm()">
          <mat-icon>{{ showForm ? 'close' : 'person_add' }}</mat-icon>
          <span>{{ showForm ? 'Cancel' : (isEditMode ? 'Edit Student' : 'Add New Student') }}</span>
        </button>
      </div>

      <!-- Add/Edit Student Form Card -->
      <mat-card *ngIf="showForm" class="form-card mat-elevation-z2">
        <mat-card-content>
          <div class="form-title">
            <mat-icon color="primary">{{ isEditMode ? 'edit' : 'person_add' }}</mat-icon>
            <span>{{ isEditMode ? 'Edit Student Details' : 'Register New Student' }}</span>
          </div>

          <form [formGroup]="studentForm" (ngSubmit)="onSubmitStudent()" class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Academic Batch</mat-label>
              <mat-select formControlName="batchId" panelClass="batch-filter-panel">
                <mat-option *ngFor="let b of batches" [value]="b.id">
                  {{ b.name }} (₹{{ b.standardMonthlyFee }}/mo)
                </mat-option>
              </mat-select>
              <mat-error *ngIf="studentForm.get('batchId')?.hasError('required')">Batch selection is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Roll Number</mat-label>
              <input matInput formControlName="rollNumber" [readonly]="true" placeholder="Select a batch first..." style="cursor: default;" />
              <mat-icon matSuffix *ngIf="!rollNumberLoading" matTooltip="Auto-generated based on batch">lock</mat-icon>
              <mat-progress-bar mode="indeterminate" *ngIf="rollNumberLoading" style="position:absolute;bottom:0;left:0;right:0;"></mat-progress-bar>
              <mat-hint *ngIf="!isEditMode">Auto-generated when batch is selected</mat-hint>
              <mat-error *ngIf="studentForm.get('rollNumber')?.hasError('required')">Roll number is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Student Full Name</mat-label>
              <input matInput formControlName="studentName" placeholder="e.g. Rahul Sharma" />
              <mat-error *ngIf="studentForm.get('studentName')?.hasError('required')">Student name is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Parent / Guardian Name</mat-label>
              <input matInput formControlName="parentName" placeholder="e.g. Suresh Sharma" />
              <mat-error *ngIf="studentForm.get('parentName')?.hasError('required')">Parent name is required</mat-error>
            </mat-form-field>

            <div class="phone-field-wrap">
              <mat-form-field appearance="outline" class="full-width-field">
                <mat-label>Parent WhatsApp Phone Number</mat-label>
                <input matInput formControlName="parentWhatsAppPhone" placeholder="e.g. 9876543210" />
                <mat-icon matSuffix color="primary" *ngIf="!phoneCheckLoading">chat</mat-icon>
                <mat-spinner matSuffix diameter="20" *ngIf="phoneCheckLoading" style="margin-right:4px"></mat-spinner>
                <mat-error *ngIf="studentForm.get('parentWhatsAppPhone')?.hasError('required')">WhatsApp Phone number is required</mat-error>
              </mat-form-field>
              <div class="phone-duplicate-error" *ngIf="phoneDuplicateError">
                <mat-icon class="dup-icon">warning</mat-icon>
                <span>{{ phoneDuplicateError }}</span>
              </div>
            </div>

            <mat-form-field appearance="outline" class="full-span">
              <mat-label>Residential Address</mat-label>
              <input matInput formControlName="address" placeholder="e.g. Flat 302, Green Park Apartments, New Delhi" />
            </mat-form-field>

            <div class="form-actions full-span">
              <button mat-button type="button" (click)="toggleForm()" [disabled]="saving">Cancel</button>
              <button mat-raised-button color="primary" type="submit" [disabled]="studentForm.invalid || saving || !!phoneDuplicateError || phoneCheckLoading">
                <span>{{ isEditMode ? 'Update Student' : 'Save Student' }}</span>
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Students Table Card (Only shown when form is closed) -->
      <mat-card *ngIf="!showForm" class="table-card mat-elevation-z2">
        <div class="filter-toolbar">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search Students...</mat-label>
            <input
              matInput
              [(ngModel)]="searchTerm"
              (keyup.enter)="onSearch()"
              placeholder="Search by Roll No, Name, Phone..."
            />
            <button mat-icon-button matSuffix (click)="onSearch()" aria-label="Search">
              <mat-icon>search</mat-icon>
            </button>
          </mat-form-field>

          <mat-form-field appearance="outline" class="batch-filter">
            <mat-label>Filter by Batch</mat-label>
            <mat-select [(ngModel)]="selectedBatchFilter" (selectionChange)="onBatchFilterChange()" panelClass="batch-filter-panel">
              <mat-option value="">All Academic Batches</mat-option>
              <mat-option *ngFor="let b of batches" [value]="b.id">
                {{ b.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-progress-bar mode="indeterminate" *ngIf="loading" class="grid-loader"></mat-progress-bar>

        <mat-card-content class="table-container">
          <table mat-table [dataSource]="students" matSort (matSortChange)="onSortChange($event)" class="full-width">
            <ng-container matColumnDef="rollNumber">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="rollNumber">Roll No</th>
              <td mat-cell *matCellDef="let s"><strong>{{ s.rollNumber }}</strong></td>
            </ng-container>

            <ng-container matColumnDef="studentName">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="studentName">Student Name</th>
              <td mat-cell *matCellDef="let s">
                <span class="student-name-cell">{{ s.studentName }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="batchName">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="batchName">Assigned Batch</th>
              <td mat-cell *matCellDef="let s">{{ s.batchName }}</td>
            </ng-container>

            <ng-container matColumnDef="parentName">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="parentName">Parent Name</th>
              <td mat-cell *matCellDef="let s">{{ s.parentName }}</td>
            </ng-container>

            <ng-container matColumnDef="parentWhatsAppPhone">
              <th mat-header-cell *matHeaderCellDef>WhatsApp Phone</th>
              <td mat-cell *matCellDef="let s">
                <span class="wa-phone">
                  <mat-icon class="wa-icon">chat</mat-icon>
                  {{ s.parentWhatsAppPhone }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="joiningDate">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="joiningDate">Joining Date</th>
              <td mat-cell *matCellDef="let s">{{ s.joiningDate | date:'mediumDate' }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-right">Actions</th>
              <td mat-cell *matCellDef="let s" class="text-right">
                <div class="action-buttons">
                  <button mat-icon-button color="primary" (click)="editStudent(s)" matTooltip="Edit Student">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="deleteStudent(s)" matTooltip="Delete Student">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell empty-cell" [attr.colspan]="displayedColumns.length">
                <div class="empty-state" *ngIf="!loading">
                  <mat-icon class="empty-icon">people</mat-icon>
                  <p>No student records found matching your filter criteria.</p>
                </div>
              </td>
            </tr>
          </table>
        </mat-card-content>

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
    .students-wrapper {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .header-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      h2 { margin: 0; font-size: 1.5rem; color: #1976d2; font-weight: 700; }
      p { margin: 4px 0 0 0; color: #666; font-size: 0.9rem; }
    }
    .form-card {
      border-radius: 8px;
      .form-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 12px;
      }
    }
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 16px;
    }
    .full-span { grid-column: span 2; }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 8px;
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

      .search-field { width: 320px; }
      .batch-filter { width: 420px; }
    }
    .grid-loader { margin-top: 4px; }
    .table-container { padding: 0; }
    .full-width { width: 100%; }
    .student-name-cell { font-weight: 600; color: #2c3e50; }
    .wa-phone {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      color: #128c7e;
      .wa-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .text-right { text-align: right; }
    .action-buttons {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      white-space: nowrap;
    }
    .empty-cell { padding: 30px; text-align: center; }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      color: #888;
      .empty-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 8px; }
    }
    .phone-field-wrap {
      display: flex;
      flex-direction: column;
      gap: 0;
      .full-width-field { width: 100%; }
    }
    .phone-duplicate-error {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #d32f2f;
      font-size: 0.78rem;
      font-weight: 500;
      margin-top: -10px;
      padding: 4px 14px 6px 14px;
      background: #fdecea;
      border-radius: 0 0 6px 6px;
      border: 1px solid #f5c6cb;
      border-top: none;
      .dup-icon { font-size: 16px; width: 16px; height: 16px; color: #d32f2f; }
    }
  `]
})
export class StudentsComponent implements OnInit, OnDestroy {
  displayedColumns = ['rollNumber', 'studentName', 'batchName', 'parentName', 'parentWhatsAppPhone', 'joiningDate', 'actions'];
  students: any[] = [];
  batches: any[] = [];

  showForm = false;
  isEditMode = false;
  selectedStudent: any = null;
  saving = false;
  loading = false;
  rollNumberLoading = false;
  phoneCheckLoading = false;
  phoneDuplicateError = '';

  totalCount = 0;
  pageSize = 10;
  pageIndex = 0;
  searchTerm = '';
  sortBy = 'rollNumber';
  sortDescending = false;
  selectedBatchFilter = '';

  studentForm: FormGroup;
  private batchIdSub?: Subscription;
  private phoneSub?: Subscription;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private coachingService: CoachingService,
    private confirmDialog: ConfirmDialogService,
    private fb: FormBuilder
  ) {
    this.studentForm = this.fb.group({
      batchId: ['', Validators.required],
      rollNumber: ['', Validators.required],
      studentName: ['', Validators.required],
      parentName: ['', Validators.required],
      parentWhatsAppPhone: ['', Validators.required],
      address: ['']
    });
  }

  ngOnInit(): void {
    this.coachingService.getBatches().subscribe(b => this.batches = b);
    this.loadStudents();
    this.setupBatchIdWatcher();
  }

  ngOnDestroy(): void {
    this.batchIdSub?.unsubscribe();
    this.phoneSub?.unsubscribe();
  }

  private setupBatchIdWatcher(): void {
    this.batchIdSub = this.studentForm.get('batchId')!.valueChanges.subscribe((batchId: string) => {
      if (!this.isEditMode && batchId) {
        this.rollNumberLoading = true;
        this.studentForm.get('rollNumber')!.setValue('', { emitEvent: false });
        this.coachingService.getNextRollNumber(batchId).subscribe({
          next: (res) => {
            this.studentForm.get('rollNumber')!.setValue(res.rollNumber, { emitEvent: false });
            this.rollNumberLoading = false;
          },
          error: () => {
            this.rollNumberLoading = false;
          }
        });
      } else if (!batchId) {
        this.studentForm.get('rollNumber')!.setValue('', { emitEvent: false });
      }
    });

    // Phone duplicate watcher
    this.phoneSub = this.studentForm.get('parentWhatsAppPhone')!.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe((phone: string) => {
      this.phoneDuplicateError = '';
      if (!phone || phone.trim().length < 10) return;
      this.phoneCheckLoading = true;
      const excludeId = this.isEditMode && this.selectedStudent ? this.selectedStudent.id : undefined;
      this.coachingService.checkPhoneDuplicate(phone.trim(), excludeId).subscribe({
        next: (res) => {
          this.phoneCheckLoading = false;
          if (res.isDuplicate) {
            this.phoneDuplicateError = `Already registered to: ${res.studentName} (${res.batchName})`;
          }
        },
        error: () => { this.phoneCheckLoading = false; }
      });
    });
  }

  loadStudents(): void {
    this.loading = true;
    this.coachingService.getStudentsPaged(
      this.pageIndex + 1,
      this.pageSize,
      this.searchTerm,
      this.sortBy,
      this.sortDescending,
      this.selectedBatchFilter
    ).subscribe({
      next: (res) => {
        this.students = res.items;
        this.totalCount = res.totalCount;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        console.error('Error loading paged students:', err);
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadStudents();
  }

  onSortChange(sort: Sort): void {
    this.sortBy = sort.active || 'rollNumber';
    this.sortDescending = sort.direction === 'desc';
    this.pageIndex = 0;
    this.loadStudents();
  }

  onBatchFilterChange(): void {
    this.pageIndex = 0;
    this.loadStudents();
  }

  onSearch(): void {
    this.pageIndex = 0;
    this.loadStudents();
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.isEditMode = false;
      this.selectedStudent = null;
      this.rollNumberLoading = false;
      this.phoneDuplicateError = '';
      this.phoneCheckLoading = false;
      this.studentForm.reset();
      this.loadStudents();
    }
  }

  editStudent(student: any): void {
    this.selectedStudent = student;
    this.isEditMode = true;
    this.showForm = true;
    this.studentForm.patchValue({
      batchId: student.batchId,
      rollNumber: student.rollNumber,
      studentName: student.studentName,
      parentName: student.parentName,
      parentWhatsAppPhone: student.parentWhatsAppPhone,
      address: student.address || ''
    });
  }

  onSubmitStudent(): void {
    if (this.studentForm.invalid) return;

    this.saving = true;
    const formVal = this.studentForm.value;

    if (this.isEditMode && this.selectedStudent) {
      this.coachingService.updateStudent(this.selectedStudent.id, formVal).subscribe({
        next: () => {
          this.saving = false;
          this.showForm = false;
          this.isEditMode = false;
          this.selectedStudent = null;
          this.studentForm.reset();
          this.loadStudents();
          this.confirmDialog.alert('Student Updated', 'Student record updated successfully!', 'success');
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert('Update Failed', err?.error?.message || 'Failed to update student.', 'danger');
        }
      });
    } else {
      this.coachingService.createStudent(formVal).subscribe({
        next: () => {
          this.saving = false;
          this.showForm = false;
          this.studentForm.reset();
          this.loadStudents();
          this.confirmDialog.alert('Student Created', 'New student onboarding & initial invoice created successfully!', 'success');
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert('Registration Failed', err?.error?.message || 'Failed to create student.', 'danger');
        }
      });
    }
  }

  deleteStudent(student: any): void {
    this.confirmDialog.danger(
      'Delete Student Record',
      `Are you sure you want to delete student "${student.studentName}" (${student.rollNumber})? This action cannot be undone.`,
      'Delete Record'
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.loading = true;
        this.coachingService.deleteStudent(student.id).subscribe({
          next: () => {
            this.loadStudents();
            this.confirmDialog.alert('Deleted', `Student "${student.studentName}" has been deleted.`, 'success');
          },
          error: (err) => {
            this.loading = false;
            this.confirmDialog.alert('Delete Failed', err?.error?.message || 'Failed to delete student.', 'danger');
          }
        });
      }
    });
  }
}
