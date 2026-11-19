import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
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
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
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
    MatPaginatorModule,
    MatSortModule,
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

      <!-- Single Prominent Loading Bar (AGENTS.md Strict Single Loader Rule) -->
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

          <!-- Step 3: Server-side Search Filter with Clear Button -->
          <mat-form-field appearance="outline" class="filter-control search-control">
            <mat-label>Search Student (Name / Roll / Phone)</mat-label>
            <mat-icon matPrefix class="search-icon">search</mat-icon>
            <input matInput formControlName="searchTerm" placeholder="Type to search on server..." />
            @if (filterForm.get('searchTerm')?.value) {
              <button matSuffix mat-icon-button type="button" (click)="clearSearch()" matTooltip="Clear search">
                <mat-icon>close</mat-icon>
              </button>
            }
          </mat-form-field>
        </form>

        <!-- Selected Batch Meta Details Strip -->
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
              <span>Total Batch Strength: <strong>{{ allocatedTotalCount }}</strong></span>
            </div>
          </div>
        }
      </mat-card>

      <!-- Main Dual-Tab Workspace -->
      @if (selectedBatchId) {
        <mat-card class="workspace-card mat-elevation-z1">
          <mat-tab-group [(selectedIndex)]="activeTabIndex" (selectedIndexChange)="onTabChange($event)" animationDuration="200ms">
            <!-- TAB 1: Active Allocated Batch Roster -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-icon">how_to_reg</mat-icon>
                <span>Allocated Students</span>
                <span class="tab-count-badge">{{ allocatedTotalCount }}</span>
              </ng-template>

              <div class="tab-content">
                <div class="tab-actions-bar">
                  <div class="tab-subtext">
                    Showing students enrolled in <strong>{{ selectedBatch?.name }}</strong> (Page {{ allocatedPageIndex + 1 }} of {{ getTotalPages(allocatedTotalCount, allocatedPageSize) }}).
                  </div>
                  <button mat-button class="re-sequence-btn" (click)="openRollSequencer()">
                    <mat-icon>format_list_numbered</mat-icon> Re-Sequence Roll Numbers
                  </button>
                </div>

                @if (!loading && allocatedStudents.length === 0) {
                  <div class="empty-state">
                    <mat-icon>person_off</mat-icon>
                    <h3>No Students Allocated Matching Criteria</h3>
                    <p>Switch to "Available Students" tab to assign students or clear search filters.</p>
                    <button mat-flat-button color="primary" (click)="activeTabIndex = 1">
                      <mat-icon>add</mat-icon> Allocate Students Now
                    </button>
                  </div>
                } @else {
                  <div class="table-responsive">
                    <table mat-table [dataSource]="allocatedStudents" matSort (matSortChange)="onAllocatedSortChange($event)" class="erp-table resizable-table">
                      <!-- Roll No Column -->
                      <ng-container matColumnDef="rollNo">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header="rollno" [style.width.px]="allocatedColWidths['rollNo']" class="resizable-header">
                          <div class="header-inner">Roll No</div>
                          <div class="col-resizer" (mousedown)="startResize($event, 'rollNo', 'allocated')"></div>
                        </th>
                        <td mat-cell *matCellDef="let s">
                          <span class="roll-badge">{{ s.coachingRollNumber || s.rollNumber || '—' }}</span>
                        </td>
                      </ng-container>

                      <!-- Student Name Column -->
                      <ng-container matColumnDef="studentName">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header="studentname" [style.width.px]="allocatedColWidths['studentName']" class="resizable-header">
                          <div class="header-inner">Student Name & Details</div>
                          <div class="col-resizer" (mousedown)="startResize($event, 'studentName', 'allocated')"></div>
                        </th>
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

                      <!-- Guardian / Father Column -->
                      <ng-container matColumnDef="fatherName">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header="fathername" [style.width.px]="allocatedColWidths['fatherName']" class="resizable-header">
                          <div class="header-inner">Guardian / Father</div>
                          <div class="col-resizer" (mousedown)="startResize($event, 'fatherName', 'allocated')"></div>
                        </th>
                        <td mat-cell *matCellDef="let s">
                          {{ s.fatherName || '—' }}
                        </td>
                      </ng-container>

                      <!-- Contact Column -->
                      <ng-container matColumnDef="contact">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header="contact" [style.width.px]="allocatedColWidths['contact']" class="resizable-header">
                          <div class="header-inner">Contact Phone</div>
                          <div class="col-resizer" (mousedown)="startResize($event, 'contact', 'allocated')"></div>
                        </th>
                        <td mat-cell *matCellDef="let s">
                          <div class="contact-box">
                            <mat-icon class="phone-icon">call</mat-icon>
                            <span>{{ s.parentWhatsAppPhone || s.mobileNumber || '—' }}</span>
                          </div>
                        </td>
                      </ng-container>

                      <!-- Actions Column -->
                      <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef [style.width.px]="allocatedColWidths['actions']" class="resizable-header text-right">
                          <div class="header-inner">Actions</div>
                        </th>
                        <td mat-cell *matCellDef="let s" class="text-right">
                          <button mat-button class="remove-btn" (click)="removeStudentFromBatch(s)" matTooltip="Remove student from this batch">
                            <mat-icon>person_remove</mat-icon> Remove
                          </button>
                        </td>
                      </ng-container>

                      <tr mat-header-row *matHeaderRowDef="allocatedColumns"></tr>
                      <tr mat-row *matRowDef="let row; columns: allocatedColumns;"></tr>
                    </table>
                  </div>

                  <!-- Server-side Paginator -->
                  <mat-paginator
                    [length]="allocatedTotalCount"
                    [pageSize]="allocatedPageSize"
                    [pageSizeOptions]="[10, 25, 50, 100]"
                    [pageIndex]="allocatedPageIndex"
                    (page)="onAllocatedPageChange($event)"
                    showFirstLastButtons
                    class="erp-paginator">
                  </mat-paginator>
                }
              </div>
            </mat-tab>

            <!-- TAB 2: Unallocated / Available Students to Add -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-icon">person_add</mat-icon>
                <span>Available Students</span>
                <span class="tab-count-badge unassigned">{{ availableTotalCount }}</span>
              </ng-template>

              <div class="tab-content">
                <div class="tab-actions-bar available-bar">
                  <div class="selection-counter">
                    <mat-checkbox [checked]="isAllAvailableSelected()" [indeterminate]="isSomeAvailableSelected()" (change)="toggleSelectAllAvailable($event.checked)">
                      Select All on this page
                    </mat-checkbox>
                    <span class="selected-badge">
                      <strong>{{ selectedStudentIds.size }}</strong> student(s) selected
                    </span>
                  </div>

                  <button mat-flat-button color="primary" class="allocate-btn" [disabled]="selectedStudentIds.size === 0 || assigning" (click)="allocateSelectedStudents()">
                    <mat-icon>add_task</mat-icon> Allocate {{ selectedStudentIds.size }} Student(s) to {{ selectedBatch?.name }}
                  </button>
                </div>

                @if (!loading && availableStudents.length === 0) {
                  <div class="empty-state">
                    <mat-icon>check_circle</mat-icon>
                    <h3>All Students are Allocated</h3>
                    <p>There are no unassigned coaching students matching the current filters.</p>
                  </div>
                } @else {
                  <div class="table-responsive">
                    <table mat-table [dataSource]="availableStudents" matSort (matSortChange)="onAvailableSortChange($event)" class="erp-table resizable-table">
                      <!-- Checkbox Column -->
                      <ng-container matColumnDef="select">
                        <th mat-header-cell *matHeaderCellDef [style.width.px]="availableColWidths['select']" class="resizable-header text-center">
                          <mat-checkbox [checked]="isAllAvailableSelected()" [indeterminate]="isSomeAvailableSelected()" (change)="toggleSelectAllAvailable($event.checked)"></mat-checkbox>
                        </th>
                        <td mat-cell *matCellDef="let s" class="text-center">
                          <mat-checkbox [checked]="selectedStudentIds.has(s.id)" (change)="toggleStudentSelection(s.id, $event.checked)"></mat-checkbox>
                        </td>
                      </ng-container>

                      <!-- Roll No Column -->
                      <ng-container matColumnDef="rollNo">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header="rollno" [style.width.px]="availableColWidths['rollNo']" class="resizable-header">
                          <div class="header-inner">Roll No</div>
                          <div class="col-resizer" (mousedown)="startResize($event, 'rollNo', 'available')"></div>
                        </th>
                        <td mat-cell *matCellDef="let s">
                          <span class="roll-badge">{{ s.rollNumber || s.coachingRollNumber || '—' }}</span>
                        </td>
                      </ng-container>

                      <!-- Student Name Column -->
                      <ng-container matColumnDef="studentName">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header="studentname" [style.width.px]="availableColWidths['studentName']" class="resizable-header">
                          <div class="header-inner">Student Name</div>
                          <div class="col-resizer" (mousedown)="startResize($event, 'studentName', 'available')"></div>
                        </th>
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

                      <!-- Father Name Column -->
                      <ng-container matColumnDef="fatherName">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header="fathername" [style.width.px]="availableColWidths['fatherName']" class="resizable-header">
                          <div class="header-inner">Father Name</div>
                          <div class="col-resizer" (mousedown)="startResize($event, 'fatherName', 'available')"></div>
                        </th>
                        <td mat-cell *matCellDef="let s">
                          {{ s.fatherName || '—' }}
                        </td>
                      </ng-container>

                      <!-- Contact Column -->
                      <ng-container matColumnDef="contact">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header="contact" [style.width.px]="availableColWidths['contact']" class="resizable-header">
                          <div class="header-inner">Contact Phone</div>
                          <div class="col-resizer" (mousedown)="startResize($event, 'contact', 'available')"></div>
                        </th>
                        <td mat-cell *matCellDef="let s">
                          <div class="contact-box">
                            <mat-icon class="phone-icon">call</mat-icon>
                            <span>{{ s.parentWhatsAppPhone || s.mobileNumber || '—' }}</span>
                          </div>
                        </td>
                      </ng-container>

                      <!-- Current Batch Column -->
                      <ng-container matColumnDef="currentBatch">
                        <th mat-header-cell *matHeaderCellDef [style.width.px]="availableColWidths['currentBatch']" class="resizable-header">
                          <div class="header-inner">Current Batch</div>
                          <div class="col-resizer" (mousedown)="startResize($event, 'currentBatch', 'available')"></div>
                        </th>
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

                  <!-- Server-side Paginator -->
                  <mat-paginator
                    [length]="availableTotalCount"
                    [pageSize]="availablePageSize"
                    [pageSizeOptions]="[10, 25, 50, 100]"
                    [pageIndex]="availablePageIndex"
                    (page)="onAvailablePageChange($event)"
                    showFirstLastButtons
                    class="erp-paginator">
                  </mat-paginator>
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
      height: 4px;
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
      font-size: 0.75rem;
      font-weight: 700;
      margin-left: 8px;
      background: #dbeafe;
      color: #1e40af;
    }

    .tab-count-badge.unassigned {
      background: #fef3c7;
      color: #92400e;
    }

    .tab-content {
      padding: 20px 24px;
    }

    .tab-actions-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }

    .tab-subtext {
      font-size: 0.88rem;
      color: #64748b;
    }

    .re-sequence-btn {
      color: #2563eb;
      font-weight: 600;
      border: 1px dashed #bfdbfe;
      background: #eff6ff;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      &:hover { background: #dbeafe; }
    }

    .available-bar {
      background: #f8fafc;
      padding: 12px 16px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
    }

    .selection-counter {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .selected-badge {
      font-size: 0.85rem;
      color: #334155;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 4px 10px;
      border-radius: 6px;
    }

    .allocate-btn {
      font-weight: 600;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .table-responsive {
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .erp-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .resizable-table th.mat-header-cell {
      position: relative;
      background: #f8fafc;
      color: #475569;
      font-weight: 700;
      font-size: 0.80rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid #cbd5e1;
      padding: 12px 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      user-select: none;
    }

    .header-inner {
      display: inline-block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .col-resizer {
      position: absolute;
      top: 0;
      right: 0;
      width: 6px;
      height: 100%;
      cursor: col-resize;
      user-select: none;
      z-index: 2;
      background: transparent;
      transition: background 0.15s ease;
      &:hover, &.resizing {
        background: #2563eb;
      }
    }

    .erp-table td.mat-cell {
      padding: 12px 14px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
      font-size: 0.88rem;
      vertical-align: middle;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .erp-table tr.mat-row:hover {
      background: #f8fafc;
    }

    .text-center {
      text-align: center;
    }

    .text-right {
      text-align: right;
    }

    .roll-badge {
      display: inline-block;
      padding: 4px 8px;
      background: #eff6ff;
      color: #1d4ed8;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.82rem;
      border: 1px solid #dbeafe;
    }

    .student-info-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .avatar-box {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
    }

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-initials {
      color: #ffffff;
      font-weight: 700;
      font-size: 0.85rem;
    }

    .info-texts {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .name-text {
      font-weight: 600;
      color: #0f172a;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sub-text {
      font-size: 0.76rem;
      color: #64748b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .contact-box {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #334155;
    }

    .phone-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #10b981;
    }

    .remove-btn {
      color: #dc2626;
      font-weight: 600;
      font-size: 0.82rem;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      &:hover { background: #fef2f2; }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .other-batch-tag {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      background: #e0f2fe;
      color: #0369a1;
      font-size: 0.78rem;
      font-weight: 600;
      border: 1px solid #bae6fd;
    }

    .unassigned-tag {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      background: #fef3c7;
      color: #92400e;
      font-size: 0.78rem;
      font-weight: 600;
      border: 1px solid #fde68a;
    }

    .erp-paginator {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      background: #f8fafc;
      border-radius: 10px;
      border: 1px dashed #cbd5e1;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #94a3b8; }
      h3 { font-size: 1.15rem; color: #334155; margin: 12px 0 4px; }
      p { color: #64748b; font-size: 0.88rem; margin: 0 0 16px; }
    }

    .notice-card {
      text-align: center;
      padding: 56px 24px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      .notice-icon { font-size: 54px; width: 54px; height: 54px; color: #3b82f6; }
      h3 { font-size: 1.25rem; color: #1e3a8a; margin: 16px 0 6px; font-weight: 700; }
      p { color: #64748b; font-size: 0.92rem; max-width: 520px; margin: 0 auto; }
    }
  `]
})
export class CoachingBatchAllocationComponent implements OnInit, OnDestroy {
  classes: ClassOption[] = [];
  allBatches: BatchDto[] = [];
  filteredBatches: BatchDto[] = [];
  selectedBatch: BatchDto | null = null;
  selectedBatchId: string = '';

  filterForm: FormGroup;
  loading: boolean = false;
  assigning: boolean = false;
  activeTabIndex: number = 0;

  // Tab 1: Allocated Students state
  allocatedStudents: StudentRow[] = [];
  allocatedTotalCount: number = 0;
  allocatedPageIndex: number = 0;
  allocatedPageSize: number = 10;
  allocatedSortBy: string = 'rollno';
  allocatedSortDesc: boolean = false;
  allocatedColumns: string[] = ['rollNo', 'studentName', 'fatherName', 'contact', 'actions'];
  allocatedColWidths: Record<string, number> = {
    rollNo: 130,
    studentName: 320,
    fatherName: 220,
    contact: 190,
    actions: 140
  };

  // Tab 2: Available Students state
  availableStudents: StudentRow[] = [];
  availableTotalCount: number = 0;
  availablePageIndex: number = 0;
  availablePageSize: number = 10;
  availableSortBy: string = 'studentname';
  availableSortDesc: boolean = false;
  selectedStudentIds = new Set<string>();
  availableColumns: string[] = ['select', 'rollNo', 'studentName', 'fatherName', 'contact', 'currentBatch'];
  availableColWidths: Record<string, number> = {
    select: 60,
    rollNo: 120,
    studentName: 300,
    fatherName: 210,
    contact: 180,
    currentBatch: 180
  };

  private searchSub?: Subscription;

  // Column Resizing state
  private resizingCol: string | null = null;
  private resizingTarget: 'allocated' | 'available' = 'allocated';
  private startX: number = 0;
  private startWidth: number = 0;
  private onMouseMoveBound = this.onMouseMove.bind(this);
  private onMouseUpBound = this.onMouseUp.bind(this);

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

    // Debounced server-side search input listener
    this.searchSub = this.filterForm.get('searchTerm')?.valueChanges
      .pipe(
        debounceTime(350),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.allocatedPageIndex = 0;
        this.availablePageIndex = 0;
        if (this.selectedBatchId) {
          if (this.activeTabIndex === 0) {
            this.loadBatchRoster();
          } else {
            this.loadAvailableStudents();
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    window.removeEventListener('mousemove', this.onMouseMoveBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);
  }

  clearSearch(): void {
    this.filterForm.patchValue({ searchTerm: '' });
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
    this.allocatedTotalCount = 0;
    this.availableStudents = [];
    this.availableTotalCount = 0;
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
    this.allocatedPageIndex = 0;
    this.availablePageIndex = 0;

    if (batchId) {
      this.loadBatchRoster();
      this.loadAvailableStudents();
    }
    this.cdr.markForCheck();
  }

  onTabChange(tabIndex: number): void {
    this.activeTabIndex = tabIndex;
    if (!this.selectedBatchId) return;
    if (tabIndex === 0) {
      this.loadBatchRoster();
    } else {
      this.loadAvailableStudents();
    }
  }

  // Server-side fetch for Allocated Students
  loadBatchRoster(): void {
    if (!this.selectedBatchId) return;

    this.loading = true;
    const term = (this.filterForm.get('searchTerm')?.value || '').trim();
    const pageNum = this.allocatedPageIndex + 1;
    const pageSize = this.allocatedPageSize;
    let url = `${environment.apiUrl}/students/paged?batchId=${this.selectedBatchId}&pageNumber=${pageNum}&pageSize=${pageSize}&sortBy=${this.allocatedSortBy}&sortDescending=${this.allocatedSortDesc}&status=active`;
    if (term) {
      url += `&searchTerm=${encodeURIComponent(term)}`;
    }

    this.http.get<any>(url).subscribe({
      next: res => {
        this.allocatedStudents = (res.items || []).map((s: any) => this.mapStudent(s));
        this.allocatedTotalCount = res.totalCount || 0;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Server-side fetch for Available Students (Coaching students not in this batch)
  loadAvailableStudents(): void {
    if (!this.selectedBatchId) return;

    this.loading = true;
    const classId = this.filterForm.get('classId')?.value || (this.selectedBatch?.classId ?? '');
    const term = (this.filterForm.get('searchTerm')?.value || '').trim();
    const pageNum = this.availablePageIndex + 1;
    const pageSize = this.availablePageSize;

    let url = `${environment.apiUrl}/students/paged?stream=coaching&excludeBatchId=${this.selectedBatchId}&pageNumber=${pageNum}&pageSize=${pageSize}&sortBy=${this.availableSortBy}&sortDescending=${this.availableSortDesc}&status=active`;
    if (classId) {
      url += `&classId=${classId}`;
    }
    if (term) {
      url += `&searchTerm=${encodeURIComponent(term)}`;
    }

    this.http.get<any>(url).subscribe({
      next: res => {
        this.availableStudents = (res.items || []).map((s: any) => this.mapStudent(s));
        this.availableTotalCount = res.totalCount || 0;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private mapStudent(s: any): StudentRow {
    return {
      id: s.id,
      studentName: s.studentName,
      rollNumber: s.rollNumber,
      coachingRollNumber: s.coachingRollNumber,
      admissionNumber: s.admissionNumber,
      fatherName: s.parentName || s.fatherName,
      mobileNumber: s.mobileNumber,
      parentWhatsAppPhone: s.parentWhatsAppPhone,
      batchId: s.batchId,
      batchName: s.batchName,
      classId: s.classId,
      className: s.className,
      profilePhoto: s.profilePhoto
    };
  }

  // Sorting Handlers
  onAllocatedSortChange(sort: Sort): void {
    this.allocatedSortBy = sort.active || 'rollno';
    this.allocatedSortDesc = sort.direction === 'desc';
    this.allocatedPageIndex = 0;
    this.loadBatchRoster();
  }

  onAvailableSortChange(sort: Sort): void {
    this.availableSortBy = sort.active || 'studentname';
    this.availableSortDesc = sort.direction === 'desc';
    this.availablePageIndex = 0;
    this.loadAvailableStudents();
  }

  // Pagination Handlers
  onAllocatedPageChange(e: PageEvent): void {
    this.allocatedPageIndex = e.pageIndex;
    this.allocatedPageSize = e.pageSize;
    this.loadBatchRoster();
  }

  onAvailablePageChange(e: PageEvent): void {
    this.availablePageIndex = e.pageIndex;
    this.availablePageSize = e.pageSize;
    this.loadAvailableStudents();
  }

  getTotalPages(total: number, size: number): number {
    return Math.max(1, Math.ceil(total / (size || 10)));
  }

  // Column Resizing Logic
  startResize(event: MouseEvent, column: string, target: 'allocated' | 'available'): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizingCol = column;
    this.resizingTarget = target;
    this.startX = event.pageX;

    const widths = target === 'allocated' ? this.allocatedColWidths : this.availableColWidths;
    this.startWidth = widths[column] || 150;

    window.addEventListener('mousemove', this.onMouseMoveBound);
    window.addEventListener('mouseup', this.onMouseUpBound);
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.resizingCol) return;
    const delta = event.pageX - this.startX;
    const newWidth = Math.max(70, this.startWidth + delta);

    if (this.resizingTarget === 'allocated') {
      this.allocatedColWidths[this.resizingCol] = newWidth;
    } else {
      this.availableColWidths[this.resizingCol] = newWidth;
    }
    this.cdr.markForCheck();
  }

  private onMouseUp(): void {
    this.resizingCol = null;
    window.removeEventListener('mousemove', this.onMouseMoveBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);
  }

  // Selection & Batch Action Handlers
  toggleStudentSelection(studentId: string, checked: boolean): void {
    if (checked) {
      this.selectedStudentIds.add(studentId);
    } else {
      this.selectedStudentIds.delete(studentId);
    }
    this.cdr.markForCheck();
  }

  isAllAvailableSelected(): boolean {
    return this.availableStudents.length > 0 && this.availableStudents.every(s => this.selectedStudentIds.has(s.id));
  }

  isSomeAvailableSelected(): boolean {
    return this.selectedStudentIds.size > 0 && !this.isAllAvailableSelected();
  }

  toggleSelectAllAvailable(checked: boolean): void {
    if (checked) {
      this.availableStudents.forEach(s => this.selectedStudentIds.add(s.id));
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
          this.loadBatchRoster();
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
          this.loadBatchRoster();
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
        this.loadBatchRoster();
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
