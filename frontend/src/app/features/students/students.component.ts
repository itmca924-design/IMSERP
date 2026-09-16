import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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

const API_BASE = 'http://localhost:5000';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
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
          <h2>Student Directory &amp; Batches</h2>
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

            <!-- Profile Photo Upload (full-width, centered) -->
            <div class="photo-upload-area full-span">
              <div class="photo-preview-wrap">
                <div class="photo-circle" (click)="triggerFileInput()">
                  <img *ngIf="photoPreview" [src]="photoPreview" alt="Preview" class="photo-img" />
                  <div *ngIf="!photoPreview" class="photo-placeholder">
                    <mat-icon class="photo-placeholder-icon">add_a_photo</mat-icon>
                    <span>Upload Photo</span>
                  </div>
                </div>
                <div class="photo-actions">
                  <button mat-stroked-button type="button" color="primary" (click)="triggerFileInput()">
                    <mat-icon>upload</mat-icon> {{ photoPreview ? 'Change Photo' : 'Upload Photo' }}
                  </button>
                  <button mat-icon-button type="button" color="warn" *ngIf="photoPreview" (click)="removePhoto()" matTooltip="Remove photo">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
              <input #fileInput type="file" accept="image/*" style="display:none" (change)="onFileSelected($event)" />
            </div>

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
              <mat-form-field appearance="outline" class="full-width-field" [class.sibling-field-active]="!!siblingInfo">
                <mat-label>Parent WhatsApp Phone Number (Optional)</mat-label>
                <span matPrefix class="phone-prefix">+91 &nbsp;</span>
                <input
                  matInput
                  type="tel"
                  formControlName="parentWhatsAppPhone"
                  placeholder="98765 43210"
                  maxlength="11"
                  (input)="onPhoneInput($event)"
                />
                <mat-icon matSuffix color="primary" *ngIf="!phoneCheckLoading && !siblingInfo">chat</mat-icon>
                <mat-icon matSuffix class="sibling-suffix-icon" [class.warning]="!isParentNameMatching" *ngIf="!phoneCheckLoading && siblingInfo" [matTooltip]="isParentNameMatching ? 'Family / Sibling Linked' : 'Different Parent Name'">{{ isParentNameMatching ? 'family_restroom' : 'warning_amber' }}</mat-icon>
                <mat-spinner matSuffix diameter="18" *ngIf="phoneCheckLoading" style="margin-right:6px"></mat-spinner>
                <mat-error *ngIf="studentForm.get('parentWhatsAppPhone')?.hasError('duplicate')">
                  {{ phoneDuplicateError }}
                </mat-error>
                <mat-error *ngIf="studentForm.get('parentWhatsAppPhone')?.hasError('invalidPhone') && !studentForm.get('parentWhatsAppPhone')?.hasError('duplicate')">
                  Please enter a valid 10-digit mobile number (e.g. 98765 43210)
                </mat-error>
              </mat-form-field>

              <!-- Smart Sibling / Parent Validation Info Card -->
              <div class="sibling-detected-box" [class.warning]="!isParentNameMatching" *ngIf="siblingInfo">
                <div class="sibling-header">
                  <div class="sibling-badge-icon" [class.warning]="!isParentNameMatching">
                    <mat-icon>{{ isParentNameMatching ? 'family_restroom' : 'warning_amber' }}</mat-icon>
                  </div>
                  <div class="sibling-details">
                    <div class="sibling-title-row">
                      <span class="sibling-title" [class.warning-title]="!isParentNameMatching">
                        {{ isParentNameMatching ? 'Sibling / Family Member Detected' : 'Notice: Different Parent Name Detected' }}
                      </span>
                      <span class="sibling-status-pill" [class.warning-pill]="!isParentNameMatching">
                        {{ isParentNameMatching ? 'Sibling Verified ✓' : 'Verify Parent / Number ⚠️' }}
                      </span>
                    </div>
                    <p class="sibling-desc">
                      Mobile number is registered to student <strong>{{ siblingInfo.studentName }}</strong>
                      <span *ngIf="siblingInfo.parentName"> with Parent: <strong>{{ siblingInfo.parentName }}</strong></span>.
                      <span *ngIf="!isParentNameMatching && currentEnteredParentName">
                        (You entered Parent: <strong>"{{ currentEnteredParentName }}"</strong>)
                      </span>
                    </p>

                    <!-- Quick Action if Parent Name differs -->
                    <div class="sibling-action-row" *ngIf="!isParentNameMatching && siblingInfo.parentName">
                      <button type="button" mat-stroked-button class="btn-copy-parent" (click)="useLinkedParentName()">
                        <mat-icon>how_to_reg</mat-icon> Set Parent as "{{ siblingInfo.parentName }}"
                      </button>
                      <span class="differ-note">If {{ currentEnteredParentName }} is a guardian/relative or shared phone, you can still save.</span>
                    </div>

                    <div class="sibling-tags">
                      <span class="sibling-tag branch" *ngIf="siblingInfo.branchName">
                        <mat-icon>domain</mat-icon>
                        <span>Branch: {{ siblingInfo.branchName }}</span>
                      </span>
                      <span class="sibling-tag batch" *ngIf="siblingInfo.batchName">
                        <mat-icon>school</mat-icon>
                        <span>Batch: {{ siblingInfo.batchName }}</span>
                      </span>
                    </div>
                  </div>
                </div>
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

            <!-- Photo column -->
            <ng-container matColumnDef="photo">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let s" class="photo-cell">
                <div class="avatar-wrap">
                  <img *ngIf="s.profilePhoto" [src]="getPhotoUrl(s.profilePhoto)" alt="{{ s.studentName }}" class="avatar-img" />
                  <div *ngIf="!s.profilePhoto" class="avatar-initials">{{ getInitials(s.studentName) }}</div>
                </div>
              </td>
            </ng-container>

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
                  <a mat-icon-button color="primary" [routerLink]="['/students/attendance']" [queryParams]="{studentId: s.id}" matTooltip="Student Attendance">
                    <mat-icon>event_available</mat-icon>
                  </a>
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

    /* ── Photo upload area ── */
    .photo-upload-area {
      display: flex;
      justify-content: center;
      padding: 8px 0 4px 0;
    }
    .photo-preview-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .photo-circle {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      border: 2px dashed #1976d2;
      overflow: hidden;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f0f4ff;
      transition: border-color 0.2s, box-shadow 0.2s;
      &:hover {
        border-color: #1565c0;
        box-shadow: 0 0 0 3px rgba(25,118,210,0.15);
      }
    }
    .photo-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }
    .photo-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      color: #1976d2;
      font-size: 0.72rem;
      font-weight: 500;
    }
    .photo-placeholder-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }
    .photo-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* ── Table ── */
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

    /* Avatar */
    .photo-cell { padding-right: 0 !important; width: 52px; }
    .avatar-wrap {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
    }
    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .avatar-initials {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1976d2, #42a5f5);
      color: #fff;
      font-weight: 700;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

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
      .phone-prefix {
        color: #64748b;
        font-weight: 600;
        font-size: 0.95rem;
        user-select: none;
      }
      .sibling-suffix-icon {
        color: #059669 !important;
        &.warning {
          color: #d97706 !important;
        }
      }
    }

    .sibling-detected-box {
      margin-top: -10px;
      margin-bottom: 12px;
      padding: 12px 16px;
      border-radius: 10px;
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfeff 100%);
      border: 1px solid #86efac;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.08);
      transition: all 0.25s ease;

      &.warning {
        background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
        border: 1px solid #fcd34d;
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.1);

        .sibling-badge-icon {
          background: #f59e0b;
        }

        .sibling-title.warning-title {
          color: #92400e;
        }

        .sibling-status-pill.warning-pill {
          background: #fef3c7;
          color: #b45309;
          border: 1px solid #fde68a;
        }
      }

      .sibling-header {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }

      .sibling-badge-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: #10b981;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }

      .sibling-details {
        flex: 1;

        .sibling-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;

          .sibling-title {
            font-size: 0.88rem;
            font-weight: 700;
            color: #065f46;
          }

          .sibling-status-pill {
            font-size: 0.72rem;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 12px;
            background: #dcfce7;
            color: #15803d;
            border: 1px solid #bbf7d0;
          }
        }

        .sibling-desc {
          margin: 4px 0 8px 0;
          font-size: 0.82rem;
          color: #334155;

          strong {
            color: #0f172a;
          }
        }

        .sibling-action-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 6px 0 8px 0;
          flex-wrap: wrap;

          .btn-copy-parent {
            font-size: 0.78rem;
            height: 30px;
            line-height: 28px;
            color: #92400e !important;
            background: #ffffff !important;
            border-color: #f59e0b !important;
            font-weight: 600;
            border-radius: 6px;
            display: inline-flex;
            align-items: center;
            gap: 4px;

            mat-icon {
              font-size: 16px;
              width: 16px;
              height: 16px;
              color: #f59e0b;
            }

            &:hover {
              background: #fef3c7 !important;
            }
          }

          .differ-note {
            font-size: 0.78rem;
            color: #92400e;
            font-weight: 500;
          }
        }

        .sibling-tags {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;

          .sibling-tag {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 600;

            mat-icon {
              font-size: 14px;
              width: 14px;
              height: 14px;
            }

            &.branch {
              background: #e0f2fe;
              color: #0369a1;
            }

            &.batch {
              background: #ede9fe;
              color: #6d28d9;
            }
          }
        }
      }
    }
  `]
})
export class StudentsComponent implements OnInit, OnDestroy {
  displayedColumns = ['photo', 'rollNumber', 'studentName', 'batchName', 'parentName', 'parentWhatsAppPhone', 'joiningDate', 'actions'];
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
  siblingInfo: {
    studentName: string | null;
    parentName: string | null;
    batchName: string | null;
    branchName: string | null;
  } | null = null;

  totalCount = 0;
  pageSize = 10;
  pageIndex = 0;
  searchTerm = '';
  sortBy = 'rollNumber';
  sortDescending = false;
  selectedBatchFilter = '';

  /** Base64 data-URL for preview; null = no photo selected */
  photoPreview: string | null = null;
  /** Raw base64 data-URL to send to the server */
  private selectedPhotoData: string | null = null;

  studentForm: FormGroup;
  private batchIdSub?: Subscription;
  private phoneSub?: Subscription;
  private studentNameSub?: Subscription;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('fileInput') fileInput: any;

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
      parentWhatsAppPhone: [''],
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
    this.studentNameSub?.unsubscribe();
  }

  // ── Sibling & Parent Smart Match Helpers ─────────────────

  get isParentNameMatching(): boolean {
    if (!this.siblingInfo || !this.siblingInfo.parentName) return true;
    const currentParent = (this.studentForm?.get('parentName')?.value || '').trim().toLowerCase();
    const linkedParent = (this.siblingInfo.parentName || '').trim().toLowerCase();
    if (!currentParent) return true;
    return currentParent === linkedParent;
  }

  get currentEnteredParentName(): string {
    return (this.studentForm?.get('parentName')?.value || '').trim();
  }

  useLinkedParentName(): void {
    if (this.siblingInfo?.parentName) {
      const parentCtrl = this.studentForm?.get('parentName');
      if (parentCtrl) {
        parentCtrl.setValue(this.siblingInfo.parentName);
        parentCtrl.markAsDirty();
      }
    }
  }

  // ── Photo helpers ────────────────────────────────────────

  triggerFileInput(): void {
    this.fileInput?.nativeElement?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreview = reader.result as string;
      this.selectedPhotoData = reader.result as string;
    };
    reader.readAsDataURL(file);
    // Reset file input so the same file can be re-selected
    input.value = '';
  }

  removePhoto(): void {
    this.photoPreview = null;
    this.selectedPhotoData = null;
  }

  /** Returns the full URL for a stored photo path */
  getPhotoUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${API_BASE}${path}`;
  }

  /** Returns two-letter initials for the avatar fallback */
  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  // ── Watchers ─────────────────────────────────────────────

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

    // Phone duplicate & sibling watcher
    this.phoneSub = this.studentForm.get('parentWhatsAppPhone')!.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe((phone: string) => {
      const control = this.studentForm.get('parentWhatsAppPhone');
      if (!control) return;

      const rawDigits = (phone || '').replace(/\D/g, '');
      if (!rawDigits) {
        this.phoneDuplicateError = '';
        this.siblingInfo = null;
        if (control.hasError('duplicate')) {
          const errors = { ...control.errors };
          delete errors['duplicate'];
          control.setErrors(Object.keys(errors).length ? errors : null);
        }
        return;
      }

      if (rawDigits.length === 10 && /^[6-9]\d{9}$/.test(rawDigits)) {
        this.phoneCheckLoading = true;
        const excludeId = this.isEditMode && this.selectedStudent ? this.selectedStudent.id : undefined;
        const currentStudentName = (this.studentForm.get('studentName')?.value || '').trim();

        this.coachingService.checkPhoneDuplicate(rawDigits, excludeId, currentStudentName).subscribe({
          next: (res) => {
            this.phoneCheckLoading = false;
            if (res.isFound) {
              if (res.isDuplicate) {
                // Exact same student name + phone -> duplicate entry error
                this.phoneDuplicateError = `Duplicate Entry: "${res.studentName}" is already registered in ${res.batchName || 'another batch'}.`;
                this.siblingInfo = null;
                control.setErrors({ ...control.errors, duplicate: true });
                control.markAsTouched();
              } else {
                // Different student name + phone -> Sibling / Family match!
                this.phoneDuplicateError = '';
                this.siblingInfo = {
                  studentName: res.studentName,
                  parentName: res.parentName,
                  batchName: res.batchName,
                  branchName: res.branchName
                };
                // Auto-fill Parent Name if empty
                const parentCtrl = this.studentForm.get('parentName');
                if (parentCtrl && !parentCtrl.value && res.parentName) {
                  parentCtrl.setValue(res.parentName);
                  parentCtrl.markAsDirty();
                }
                // Clear duplicate error from control so form is VALID
                if (control.hasError('duplicate')) {
                  const errors = { ...control.errors };
                  delete errors['duplicate'];
                  control.setErrors(Object.keys(errors).length ? errors : null);
                }
              }
            } else {
              this.phoneDuplicateError = '';
              this.siblingInfo = null;
              if (control.hasError('duplicate')) {
                const errors = { ...control.errors };
                delete errors['duplicate'];
                control.setErrors(Object.keys(errors).length ? errors : null);
              }
            }
          },
          error: () => {
            this.phoneCheckLoading = false;
          }
        });
      }
    });

    // Watch student name changes to dynamically distinguish duplicate vs sibling
    this.studentNameSub = this.studentForm.get('studentName')!.valueChanges.pipe(
      debounceTime(300)
    ).subscribe((name: string) => {
      if (this.siblingInfo && name) {
        if (this.siblingInfo.studentName?.trim().toLowerCase() === name.trim().toLowerCase()) {
          this.phoneDuplicateError = `Duplicate Entry: "${this.siblingInfo.studentName}" is already registered in ${this.siblingInfo.batchName || 'another batch'}.`;
          const control = this.studentForm.get('parentWhatsAppPhone');
          if (control) {
            control.setErrors({ ...control.errors, duplicate: true });
            control.markAsTouched();
          }
        } else {
          this.phoneDuplicateError = '';
          const control = this.studentForm.get('parentWhatsAppPhone');
          if (control && control.hasError('duplicate')) {
            const errors = { ...control.errors };
            delete errors['duplicate'];
            control.setErrors(Object.keys(errors).length ? errors : null);
          }
        }
      }
    });
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let rawDigits = input.value.replace(/\D/g, '');

    if (rawDigits.length === 12 && rawDigits.startsWith('91')) {
      rawDigits = rawDigits.substring(2);
    }
    if (rawDigits.length > 10) {
      rawDigits = rawDigits.substring(0, 10);
    }

    let formatted = rawDigits;
    if (rawDigits.length > 5) {
      formatted = `${rawDigits.substring(0, 5)} ${rawDigits.substring(5)}`;
    }

    input.value = formatted;
    this.studentForm.get('parentWhatsAppPhone')?.setValue(formatted, { emitEvent: true });
    this.validatePhoneNumber(rawDigits);
  }

  validatePhoneNumber(rawDigits: string): void {
    const control = this.studentForm.get('parentWhatsAppPhone');
    if (!control) return;

    if (!rawDigits) {
      this.phoneDuplicateError = '';
      if (control.hasError('invalidPhone') || control.hasError('duplicate')) {
        const errors = { ...control.errors };
        delete errors['invalidPhone'];
        delete errors['duplicate'];
        control.setErrors(Object.keys(errors).length ? errors : null);
      }
      return;
    }

    const isValid = /^[6-9]\d{9}$/.test(rawDigits);
    if (!isValid) {
      control.setErrors({ ...control.errors, invalidPhone: true });
    } else {
      if (control.hasError('invalidPhone')) {
        const errors = { ...control.errors };
        delete errors['invalidPhone'];
        control.setErrors(Object.keys(errors).length ? errors : null);
      }
    }
  }

  // ── CRUD ─────────────────────────────────────────────────

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
      this.siblingInfo = null;
      this.phoneCheckLoading = false;
      this.photoPreview = null;
      this.selectedPhotoData = null;
      this.studentForm.reset();
      this.loadStudents();
    }
  }

  editStudent(student: any): void {
    this.selectedStudent = student;
    this.isEditMode = true;
    this.showForm = true;
    this.siblingInfo = null;
    this.phoneDuplicateError = '';
    // Show existing photo (from server path)
    this.photoPreview = student.profilePhoto ? this.getPhotoUrl(student.profilePhoto) : null;
    this.selectedPhotoData = null; // no new photo selected yet

    let formattedPhone = student.parentWhatsAppPhone || '';
    const raw = formattedPhone.replace(/\D/g, '');
    const cleanDigits = (raw.length === 12 && raw.startsWith('91')) ? raw.substring(2) : raw;
    if (cleanDigits.length === 10) {
      formattedPhone = `${cleanDigits.substring(0, 5)} ${cleanDigits.substring(5)}`;
    }

    this.studentForm.patchValue({
      batchId: student.batchId,
      rollNumber: student.rollNumber,
      studentName: student.studentName,
      parentName: student.parentName,
      parentWhatsAppPhone: formattedPhone,
      address: student.address || ''
    });
  }

  onSubmitStudent(): void {
    if (this.studentForm.invalid) return;

    this.saving = true;
    const formVal = this.studentForm.value;
    const cleanPhone = formVal.parentWhatsAppPhone ? formVal.parentWhatsAppPhone.replace(/\s+/g, '') : '';
    const payload = {
      ...formVal,
      parentWhatsAppPhone: cleanPhone,
      // Send new base64 photo if user picked one; otherwise send existing path (edit) or null (create)
      profilePhoto: this.selectedPhotoData
        ?? (this.isEditMode && this.selectedStudent?.profilePhoto ? this.selectedStudent.profilePhoto : null)
    };

    if (this.isEditMode && this.selectedStudent) {
      this.coachingService.updateStudent(this.selectedStudent.id, payload).subscribe({
        next: () => {
          this.saving = false;
          this.showForm = false;
          this.isEditMode = false;
          this.selectedStudent = null;
          this.photoPreview = null;
          this.selectedPhotoData = null;
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
      this.coachingService.createStudent(payload).subscribe({
        next: () => {
          this.saving = false;
          this.showForm = false;
          this.photoPreview = null;
          this.selectedPhotoData = null;
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
