import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { HttpClient } from '@angular/common/http';
import { BatchesService, BatchDto } from '../../core/services/batches.service';
import { SchoolService } from '../../core/services/school.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { StudentRollSequencerDialogComponent } from '../students/student-roll-sequencer-dialog.component';
import { environment } from '../../../environments/environment';

export interface ClassOption {
  id: string;
  name: string;
}

export interface StudentRow {
  id: string;
  studentName: string;
  rollNumber?: string;
  coachingRollNumber?: string;
  admissionNumber?: string;
  fatherName?: string;
  mobileNumber?: string;
  parentWhatsAppPhone?: string;
  batchId?: string;
  batchName?: string;
  classId?: string;
  className?: string;
  profilePhoto?: string;
  photoFailed?: boolean;
}

@Component({
  selector: 'app-coaching-batch-allocation',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatCheckboxModule,
    MatTabsModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressBarModule,
    RouterModule
  ],
  template: `
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="title-area">
          <div class="header-icon-box">
            <mat-icon>group_add</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Student Batch Allocation (कोचिंग बैच आवंटन)</h1>
            <p class="page-subtitle">Assign students to coaching batches, manage roll sequences, and organize coaching cohorts with Class ➔ Batch cascade.</p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-button class="action-btn outline-btn" (click)="openRollSequencer()">
            <mat-icon>format_list_numbered</mat-icon> Auto-Sequence Rolls
          </button>
          <a mat-flat-button color="primary" class="action-btn" routerLink="/batches">
            <mat-icon>category</mat-icon> Manage Batches Master
          </a>
        </div>
      </div>

      <!-- Single Prominent Loading Bar -->
      @if (loading) {
        <mat-progress-bar mode="indeterminate" class="global-loader"></mat-progress-bar>
      }

      <!-- Control / Filter Deck (Class ➔ Batches ➔ Students Cascade) -->
      <mat-card class="filter-card mat-elevation-z1">
        <form [formGroup]="filterForm" class="filter-form">
          <!-- Step 1: Class Selector -->
          <mat-form-field appearance="outline" class="filter-control">
            <mat-label>Academic Class (कक्षा)</mat-label>
            <mat-select formControlName="classId" (selectionChange)="onClassChange($event.value)">
              <mat-option value="">-- All Classes (सभी कक्षाएं) --</mat-option>
              @for (c of classes; track c.id) {
                <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <!-- Step 2: Cascading Batch Selector -->
          <mat-form-field appearance="outline" class="filter-control highlight-control">
            <mat-label>Coaching Batch (बैच चयन) *</mat-label>
            <mat-select formControlName="batchId" (selectionChange)="onBatchChange($event.value)">
              @if (filteredBatches.length === 0) {
                <mat-option disabled>No batches found for selected class</mat-option>
              }
              @for (b of filteredBatches; track b.id) {
                <mat-option [value]="b.id">
                  <strong>{{ b.name }}</strong> ({{ b.subject || 'All Subjects' }} • {{ b.studentCount || 0 }} Students)
                </mat-option>
              }
            </mat-select>
          </mat-form-field>

          <!-- Search Filter -->
          <mat-form-field appearance="outline" class="filter-control search-control">
            <mat-label>Search Student (Name / Roll / Phone)</mat-label>
            <mat-icon matPrefix class="search-icon">search</mat-icon>
            <input matInput formControlName="searchTerm" placeholder="Type to filter list..." (input)="applySearchFilter()" />
          </mat-form-field>
        </form>

        <!-- Selected Batch Meta Details Pill -->
        @if (selectedBatch) {
          <div class="batch-meta-strip">
            <div class="meta-pill">
              <mat-icon>class</mat-icon>
              <span>Batch: <strong>{{ selectedBatch.name }}</strong></span>
            </div>
            @if (selectedBatch.className) {
              <div class="meta-pill class-pill">
                <mat-icon>school</mat-icon>
                <span>Class: <strong>{{ selectedBatch.className }}</strong></span>
              </div>
            }
            <div class="meta-pill">
              <mat-icon>schedule</mat-icon>
              <span>Shift: <strong>{{ selectedBatch.shift || 'General' }}</strong> ({{ selectedBatch.startTime || '08:00' }} - {{ selectedBatch.endTime || '12:00' }})</span>
            </div>
            <div class="meta-pill fee-pill">
              <mat-icon>payments</mat-icon>
              <span>Fee: <strong>₹{{ selectedBatch.standardMonthlyFee || 0 }} / mo</strong></span>
            </div>
            <div class="meta-pill count-pill">
              <mat-icon>people</mat-icon>
              <span>Current Strength: <strong>{{ allocatedStudents.length }}</strong></span>
            </div>
          </div>
        }
      </mat-card>

      <!-- Main Dual-Tab Workspace -->
      @if (selectedBatchId) {
        <mat-card class="workspace-card mat-elevation-z1">
          <mat-tab-group [(selectedIndex)]="activeTabIndex" animationDuration="200ms">
            <!-- TAB 1: Active Allocated Batch Roster -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-icon">how_to_reg</mat-icon>
                <span>Allocated Students</span>
                <span class="tab-count-badge">{{ filteredAllocated.length }}</span>
              </ng-template>

              <div class="tab-content">
                <div class="tab-actions-bar">
                  <div class="tab-subtext">
                    Showing students currently enrolled in <strong>{{ selectedBatch?.name }}</strong>.
                  </div>
                  <button mat-button class="re-sequence-btn" (click)="openRollSequencer()">
                    <mat-icon>format_list_numbered</mat-icon> Re-Sequence Roll Numbers
                  </button>
                </div>

                @if (filteredAllocated.length === 0) {
                  <div class="empty-state">
                    <mat-icon>person_off</mat-icon>
                    <h3>No Students Allocated Yet</h3>
                    <p>Switch to "Available Students" tab to assign students to this coaching batch.</p>
                    <button mat-flat-button color="primary" (click)="activeTabIndex = 1">
                      <mat-icon>add</mat-icon> Allocate Students Now
                    </button>
                  </div>
                } @else {
                  <div class="table-responsive">
                    <table mat-table [dataSource]="filteredAllocated" class="erp-table">
                      <!-- Roll No -->
                      <ng-container matColumnDef="rollNo">
                        <th mat-header-cell *matHeaderCellDef style="width: 100px;">Roll No</th>
                        <td mat-cell *matCellDef="let s">
                          <span class="roll-badge">{{ s.coachingRollNumber || s.rollNumber || '—' }}</span>
                        </td>
                      </ng-container>

                      <!-- Student Info -->
                      <ng-container matColumnDef="studentName">
                        <th mat-header-cell *matHeaderCellDef>Student Name & Details</th>
                        <td mat-cell *matCellDef="let s">
                          <div class="student-info-cell">
                            <div class="avatar-box" [style.background]="!s.profilePhoto || s.photoFailed ? getAvatarBg(s.studentName) : '#f1f5f9'">
                              @if (s.profilePhoto && !s.photoFailed) {
                                <img [src]="getPhotoUrl(s.profilePhoto)" (error)="s.photoFailed = true" [alt]="s.studentName" class="avatar-img" />
                              } @else {
                                <span class="avatar-initials">{{ getInitials(s.studentName) }}</span>
                              }
                            </div>
                            <div class="info-texts">
                              <span class="name-text">{{ s.studentName }}</span>
                              <span class="sub-text">Adm No: {{ s.admissionNumber || 'N/A' }} • Class: {{ s.className || 'Coaching' }}</span>
                            </div>
                          </div>
                        </td>
                      </ng-container>

                      <!-- Father Name -->
                      <ng-container matColumnDef="fatherName">
                        <th mat-header-cell *matHeaderCellDef>Guardian / Father</th>
                        <td mat-cell *matCellDef="let s">
                          {{ s.fatherName || '—' }}
                        </td>
                      </ng-container>

                      <!-- Contact -->
                      <ng-container matColumnDef="contact">
                        <th mat-header-cell *matHeaderCellDef>Contact Phone</th>
                        <td mat-cell *matCellDef="let s">
                          <div class="contact-box">
                            <mat-icon class="phone-icon">call</mat-icon>
                            <span>{{ s.parentWhatsAppPhone || s.mobileNumber || '—' }}</span>
                          </div>
                        </td>
                      </ng-container>

                      <!-- Actions -->
                      <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef style="width: 180px; text-align: right;">Actions</th>
                        <td mat-cell *matCellDef="let s" style="text-align: right;">
                          <button mat-button class="remove-btn" (click)="removeStudentFromBatch(s)" matTooltip="Remove student from this batch">
                            <mat-icon>person_remove</mat-icon> Remove
                          </button>
                        </td>
                      </ng-container>

                      <tr mat-header-row *matHeaderRowDef="allocatedColumns"></tr>
                      <tr mat-row *matRowDef="let row; columns: allocatedColumns;"></tr>
                    </table>
                  </div>
                }
              </div>
            </mat-tab>

            <!-- TAB 2: Unallocated / Available Students to Add -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-icon">person_add</mat-icon>
                <span>Available Students</span>
                <span class="tab-count-badge unassigned">{{ filteredAvailable.length }}</span>
              </ng-template>

              <div class="tab-content">
                <div class="tab-actions-bar available-bar">
                  <div class="selection-counter">
                    <mat-checkbox [checked]="isAllAvailableSelected()" [indeterminate]="isSomeAvailableSelected()" (change)="toggleSelectAllAvailable($event.checked)">
                      Select All
                    </mat-checkbox>
                    <span class="selected-badge">
                      <strong>{{ selectedStudentIds.size }}</strong> student(s) selected
                    </span>
                  </div>

                  <button mat-flat-button color="primary" class="allocate-btn" [disabled]="selectedStudentIds.size === 0 || assigning" (click)="allocateSelectedStudents()">
                    <mat-icon>add_task</mat-icon> Allocate {{ selectedStudentIds.size }} Student(s) to {{ selectedBatch?.name }}
                  </button>
                </div>

                @if (filteredAvailable.length === 0) {
                  <div class="empty-state">
                    <mat-icon>check_circle</mat-icon>
                    <h3>All Students are Allocated</h3>
                    <p>There are no unassigned coaching students matching the current filters.</p>
                  </div>
                } @else {
                  <div class="table-responsive">
                    <table mat-table [dataSource]="filteredAvailable" class="erp-table">
                      <!-- Checkbox Column -->
                      <ng-container matColumnDef="select">
                        <th mat-header-cell *matHeaderCellDef style="width: 50px;">
                          <mat-checkbox [checked]="isAllAvailableSelected()" [indeterminate]="isSomeAvailableSelected()" (change)="toggleSelectAllAvailable($event.checked)"></mat-checkbox>
                        </th>
                        <td mat-cell *matCellDef="let s">
                          <mat-checkbox [checked]="selectedStudentIds.has(s.id)" (change)="toggleStudentSelection(s.id, $event.checked)"></mat-checkbox>
                        </td>
                      </ng-container>

                      <!-- Roll No -->
                      <ng-container matColumnDef="rollNo">
                        <th mat-header-cell *matHeaderCellDef style="width: 100px;">Roll No</th>
                        <td mat-cell *matCellDef="let s">
                          <span class="roll-badge">{{ s.rollNumber || s.coachingRollNumber || '—' }}</span>
                        </td>
                      </ng-container>

                      <!-- Student Name -->
                      <ng-container matColumnDef="studentName">
                        <th mat-header-cell *matHeaderCellDef>Student Name</th>
                        <td mat-cell *matCellDef="let s">
                          <div class="student-info-cell">
                            <div class="avatar-box" [style.background]="!s.profilePhoto || s.photoFailed ? getAvatarBg(s.studentName) : '#f1f5f9'">
                              @if (s.profilePhoto && !s.photoFailed) {
                                <img [src]="getPhotoUrl(s.profilePhoto)" (error)="s.photoFailed = true" [alt]="s.studentName" class="avatar-img" />
                              } @else {
                                <span class="avatar-initials">{{ getInitials(s.studentName) }}</span>
                              }
                            </div>
                            <div class="info-texts">
                              <span class="name-text">{{ s.studentName }}</span>
                              <span class="sub-text">Adm No: {{ s.admissionNumber || 'N/A' }} • Class: {{ s.className || 'General' }}</span>
                            </div>
                          </div>
                        </td>
                      </ng-container>

                      <!-- Father Name -->
                      <ng-container matColumnDef="fatherName">
                        <th mat-header-cell *matHeaderCellDef>Father Name</th>
                        <td mat-cell *matCellDef="let s">
                          {{ s.fatherName || '—' }}
                        </td>
                      </ng-container>

                      <!-- Contact -->
                      <ng-container matColumnDef="contact">
                        <th mat-header-cell *matHeaderCellDef>Contact Phone</th>
                        <td mat-cell *matCellDef="let s">
                          <div class="contact-box">
                            <mat-icon class="phone-icon">call</mat-icon>
                            <span>{{ s.parentWhatsAppPhone || s.mobileNumber || '—' }}</span>
                          </div>
                        </td>
                      </ng-container>

                      <!-- Current Batch -->
                      <ng-container matColumnDef="currentBatch">
                        <th mat-header-cell *matHeaderCellDef>Current Batch</th>
                        <td mat-cell *matCellDef="let s">
                          @if (s.batchName) {
                            <span class="other-batch-tag">{{ s.batchName }}</span>
                          } @else {
                            <span class="unassigned-tag">Unassigned</span>
                          }
                        </td>
                      </ng-container>

                      <tr mat-header-row *matHeaderRowDef="availableColumns"></tr>
                      <tr mat-row *matRowDef="let row; columns: availableColumns;"></tr>
                    </table>
                  </div>
                }
              </div>
            </mat-tab>
          </mat-tab-group>
        </mat-card>
      } @else {
        <mat-card class="notice-card mat-elevation-z1">
          <mat-icon class="notice-icon">touch_app</mat-icon>
          <h3>Please Select a Coaching Batch</h3>
          <p>Choose an Academic Class and Coaching Batch from the filter deck above to view allocated students and assign new candidates.</p>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .page-container {
      padding: 0 0 40px;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      background: #ffffff;
      padding: 18px 24px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }

    .title-area {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-icon-box {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
      mat-icon { font-size: 26px; width: 26px; height: 26px; }
    }

    .page-title {
      font-size: 1.4rem;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0;
    }

    .page-subtitle {
      font-size: 0.86rem;
      color: #64748b;
      margin: 3px 0 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .action-btn {
      font-weight: 600;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .outline-btn {
      border: 1px solid #cbd5e1;
      color: #334155;
      background: #f8fafc;
    }

    .global-loader {
      border-radius: 4px;
      overflow: hidden;
    }

    .filter-card {
      padding: 18px 22px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .filter-form {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
    }

    .filter-control {
      flex: 1 1 240px;
      min-width: 220px;
    }

    .highlight-control {
      flex: 1 1 300px;
    }

    .search-control {
      flex: 1 1 280px;
    }

    .search-icon {
      color: #64748b;
      margin-right: 6px;
    }

    .batch-meta-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px dashed #e2e8f0;
    }

    .meta-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f1f5f9;
      color: #334155;
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 0.82rem;
      border: 1px solid #e2e8f0;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }
    }

    .fee-pill {
      background: #ecfdf5;
      border-color: #a7f3d0;
      color: #065f46;
      mat-icon { color: #059669; }
    }

    .count-pill {
      background: #eff6ff;
      border-color: #bfdbfe;
      color: #1e40af;
      mat-icon { color: #2563eb; }
    }

    .workspace-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      overflow: hidden;
    }

    .tab-icon {
      margin-right: 6px;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .tab-count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.72rem;
      font-weight: 700;
      margin-left: 8px;
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
    }

    .tab-count-badge.unassigned {
      background: #fef3c7;
      color: #b45309;
      border-color: #fde68a;
    }

    .tab-content {
      padding: 20px;
    }

    .tab-actions-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }

    .tab-actions-bar.available-bar {
      background: #f8fafc;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .selection-counter {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .selected-badge {
      font-size: 0.84rem;
      color: #475569;
      strong { color: #2563eb; font-weight: 700; }
    }

    .allocate-btn {
      font-weight: 600;
      border-radius: 8px;
      mat-icon { margin-right: 6px; }
    }

    .table-responsive {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .erp-table {
      width: 100%;
      background: #ffffff;
      border-collapse: collapse;

      th {
        background: #f8fafc;
        color: #475569;
        font-weight: 600;
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        padding: 12px 16px;
        border-bottom: 1px solid #e2e8f0;
        white-space: nowrap;
      }

      td {
        padding: 12px 16px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.88rem;
        color: #1e293b;
        white-space: nowrap;
      }

      tr:hover td {
        background: #f8fafc;
      }
    }

    .student-info-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .avatar-box {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      color: #64748b;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      border: 1.5px solid #ffffff;

      .avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .avatar-initials {
        font-size: 13px;
        font-weight: 700;
        color: #ffffff;
        letter-spacing: 0.5px;
        user-select: none;
        text-transform: uppercase;
      }
    }

    .info-texts {
      display: flex;
      flex-direction: column;
    }

    .name-text {
      font-weight: 600;
      color: #0f172a;
    }

    .sub-text {
      font-size: 0.74rem;
      color: #64748b;
    }

    .roll-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 700;
      font-size: 0.82rem;
      border: 1px solid #bfdbfe;
    }

    .contact-box {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #475569;
      .phone-icon { font-size: 14px; width: 14px; height: 14px; color: #16a34a; }
    }

    .remove-btn {
      color: #dc2626;
      font-size: 0.8rem;
      mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 2px; }
      &:hover { background: #fef2f2; }
    }

    .other-batch-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      background: #f1f5f9;
      color: #475569;
      font-size: 0.76rem;
      border: 1px solid #cbd5e1;
    }

    .unassigned-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      background: #fef3c7;
      color: #92400e;
      font-size: 0.76rem;
      border: 1px solid #fde68a;
    }

    .empty-state {
      padding: 40px 20px;
      text-align: center;
      color: #64748b;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #94a3b8; margin-bottom: 8px; }
      h3 { font-size: 1.1rem; color: #1e293b; margin: 0 0 4px; }
      p { font-size: 0.86rem; margin: 0 0 16px; }
    }

    .notice-card {
      padding: 48px 24px;
      text-align: center;
      border-radius: 12px;
      border: 1px dashed #cbd5e1;
      background: #f8fafc;
      color: #64748b;
      .notice-icon { font-size: 48px; width: 48px; height: 48px; color: #3b82f6; margin-bottom: 8px; }
      h3 { font-size: 1.15rem; color: #1e3a8a; margin: 0 0 6px; font-weight: 700; }
      p { font-size: 0.88rem; max-width: 500px; margin: 0 auto; line-height: 1.5; }
    }

    @media (max-width: 768px) {
      .page-header {
        flex-direction: column;
        align-items: flex-start;
      }
      .header-actions {
        width: 100%;
        justify-content: flex-start;
      }
      .filter-control {
        flex: 1 1 100%;
        min-width: 100%;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachingBatchAllocationComponent implements OnInit {
  filterForm: FormGroup;
  classes: ClassOption[] = [];
  allBatches: BatchDto[] = [];
  filteredBatches: BatchDto[] = [];
  selectedBatch: BatchDto | null = null;
  selectedBatchId: string = '';

  allocatedStudents: StudentRow[] = [];
  filteredAllocated: StudentRow[] = [];
  availableStudents: StudentRow[] = [];
  filteredAvailable: StudentRow[] = [];

  selectedStudentIds = new Set<string>();
  activeTabIndex = 0;
  loading = false;
  assigning = false;

  allocatedColumns: string[] = ['rollNo', 'studentName', 'fatherName', 'contact', 'actions'];
  availableColumns: string[] = ['select', 'rollNo', 'studentName', 'fatherName', 'contact', 'currentBatch'];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private batchesService: BatchesService,
    private schoolService: SchoolService,
    private confirmDialog: ConfirmDialogService,
    private auth: AuthService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {
    this.filterForm = this.fb.group({
      classId: [''],
      batchId: [''],
      searchTerm: ['']
    });
  }

  ngOnInit(): void {
    this.loadClasses();
    this.loadBatches();
  }

  loadClasses(): void {
    this.schoolService.getClasses(true, 'Coaching').subscribe({
      next: res => {
        this.classes = (res || []).map(c => ({ id: c.id, name: c.name }));
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  loadBatches(): void {
    this.loading = true;
    this.batchesService.getBatches().subscribe({
      next: batches => {
        this.allBatches = batches || [];
        this.filterBatchesByClass();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onClassChange(classId: string): void {
    this.filterBatchesByClass();
    this.filterForm.patchValue({ batchId: '' });
    this.selectedBatchId = '';
    this.selectedBatch = null;
    this.allocatedStudents = [];
    this.filteredAllocated = [];
    this.availableStudents = [];
    this.filteredAvailable = [];
    this.selectedStudentIds.clear();
    this.cdr.markForCheck();
  }

  filterBatchesByClass(): void {
    const selectedClassId = this.filterForm.get('classId')?.value;
    if (!selectedClassId) {
      this.filteredBatches = [...this.allBatches];
    } else {
      this.filteredBatches = this.allBatches.filter(b => b.classId === selectedClassId || !b.classId);
    }
  }

  onBatchChange(batchId: string): void {
    this.selectedBatchId = batchId;
    this.selectedBatch = this.allBatches.find(b => b.id === batchId) || null;
    this.selectedStudentIds.clear();
    if (batchId) {
      this.loadBatchRoster(batchId);
      this.loadAvailableStudents();
    }
    this.cdr.markForCheck();
  }

  loadBatchRoster(batchId: string): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/students/paged?batchId=${batchId}&pageSize=500`).subscribe({
      next: res => {
        this.allocatedStudents = (res.items || []).map((s: any) => this.mapStudent(s));
        this.applySearchFilter();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadAvailableStudents(): void {
    const classId = this.filterForm.get('classId')?.value || (this.selectedBatch?.classId ?? '');
    let url = `${environment.apiUrl}/students/paged?isCoachingStudent=true&pageSize=500`;
    if (classId) {
      url += `&classId=${classId}`;
    }

    this.http.get<any>(url).subscribe({
      next: res => {
        const items = res.items || [];
        // Filter students not in the currently selected batch
        this.availableStudents = items
          .filter((s: any) => s.batchId !== this.selectedBatchId)
          .map((s: any) => this.mapStudent(s));
        this.applySearchFilter();
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  private mapStudent(s: any): StudentRow {
    return {
      id: s.id,
      studentName: s.studentName,
      rollNumber: s.rollNumber,
      coachingRollNumber: s.coachingRollNumber,
      admissionNumber: s.admissionNumber,
      fatherName: s.fatherName,
      mobileNumber: s.mobileNumber,
      parentWhatsAppPhone: s.parentWhatsAppPhone,
      batchId: s.batchId,
      batchName: s.batchName,
      classId: s.classId,
      className: s.className,
      profilePhoto: s.profilePhoto
    };
  }

  applySearchFilter(): void {
    const term = (this.filterForm.get('searchTerm')?.value || '').trim().toLowerCase();
    if (!term) {
      this.filteredAllocated = [...this.allocatedStudents];
      this.filteredAvailable = [...this.availableStudents];
    } else {
      const match = (s: StudentRow) =>
        (s.studentName || '').toLowerCase().includes(term) ||
        (s.rollNumber || '').toLowerCase().includes(term) ||
        (s.coachingRollNumber || '').toLowerCase().includes(term) ||
        (s.admissionNumber || '').toLowerCase().includes(term) ||
        (s.fatherName || '').toLowerCase().includes(term) ||
        (s.mobileNumber || '').toLowerCase().includes(term);

      this.filteredAllocated = this.allocatedStudents.filter(match);
      this.filteredAvailable = this.availableStudents.filter(match);
    }
    this.cdr.markForCheck();
  }

  toggleStudentSelection(studentId: string, checked: boolean): void {
    if (checked) {
      this.selectedStudentIds.add(studentId);
    } else {
      this.selectedStudentIds.delete(studentId);
    }
    this.cdr.markForCheck();
  }

  isAllAvailableSelected(): boolean {
    return this.filteredAvailable.length > 0 && this.filteredAvailable.every(s => this.selectedStudentIds.has(s.id));
  }

  isSomeAvailableSelected(): boolean {
    return this.selectedStudentIds.size > 0 && !this.isAllAvailableSelected();
  }

  toggleSelectAllAvailable(checked: boolean): void {
    if (checked) {
      this.filteredAvailable.forEach(s => this.selectedStudentIds.add(s.id));
    } else {
      this.selectedStudentIds.clear();
    }
    this.cdr.markForCheck();
  }

  allocateSelectedStudents(): void {
    if (!this.selectedBatchId || this.selectedStudentIds.size === 0) return;

    const ids = Array.from(this.selectedStudentIds);
    this.confirmDialog.confirm(
      'Confirm Batch Allocation',
      `Are you sure you want to allocate ${ids.length} selected student(s) to batch '${this.selectedBatch?.name}'?`,
      'Allocate',
      'Cancel'
    ).subscribe(confirmed => {
      if (!confirmed) return;

      this.assigning = true;
      this.batchesService.allocateStudents(this.selectedBatchId, ids).subscribe({
        next: res => {
          this.assigning = false;
          this.confirmDialog.alert('Batch Allocation Success', res?.message || 'Students successfully allocated to batch.', 'success');
          this.selectedStudentIds.clear();
          this.loadBatchRoster(this.selectedBatchId);
          this.loadAvailableStudents();
          this.activeTabIndex = 0;
          this.cdr.markForCheck();
        },
        error: err => {
          this.assigning = false;
          this.confirmDialog.alert('Allocation Failed', err.error?.message || 'Failed to allocate students to batch.', 'warning');
          this.cdr.markForCheck();
        }
      });
    });
  }

  removeStudentFromBatch(s: StudentRow): void {
    this.confirmDialog.confirm(
      'Remove Student from Batch',
      `Are you sure you want to remove '${s.studentName}' from batch '${this.selectedBatch?.name}'? The student will become unassigned.`,
      'Remove',
      'Cancel'
    ).subscribe(confirmed => {
      if (!confirmed) return;

      this.batchesService.removeStudent(this.selectedBatchId, s.id).subscribe({
        next: () => {
          this.confirmDialog.alert('Removed', `'${s.studentName}' has been removed from this batch.`, 'success');
          this.loadBatchRoster(this.selectedBatchId);
          this.loadAvailableStudents();
          this.cdr.markForCheck();
        },
        error: err => {
          this.confirmDialog.alert('Error', err.error?.message || 'Failed to remove student from batch.', 'warning');
        }
      });
    });
  }

  openRollSequencer(): void {
    const dialogRef = this.dialog.open(StudentRollSequencerDialogComponent, {
      width: '940px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'erp-custom-dialog',
      disableClose: false,
      data: {
        selectedBatchId: this.selectedBatchId || undefined,
        selectedClassId: this.filterForm.get('classId')?.value || undefined,
        initialScope: 'coaching',
        allowedScopes: ['coaching']
      }
    });

    dialogRef.afterClosed().subscribe((changed: boolean) => {
      if (changed && this.selectedBatchId) {
        this.loadBatchRoster(this.selectedBatchId);
      }
    });
  }

  getPhotoUrl(path?: string | null): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `${environment.apiBaseUrl}${clean}`;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  getAvatarBg(name: string): string {
    if (!name) return '#64748b';
    const colors = [
      '#2563eb', '#4f46e5', '#7c3aed', '#059669', '#0891b2', 
      '#d97706', '#dc2626', '#db2777', '#0284c7', '#16a34a'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }
}
