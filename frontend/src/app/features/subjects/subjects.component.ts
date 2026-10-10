import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import {
  SubjectDto,
  SubjectsService,
  ClassSubjectDto,
  ClassSubjectSummaryDto,
  AllocateClassSubjectItemDto
} from '../../core/services/subjects.service';
import { SchoolService, SchoolClassDto } from '../../core/services/school.service';
import { SubjectDialogComponent } from './subject-dialog.component';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

interface ClassSubjectRowState {
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  isSelected: boolean;
  isCompulsory: boolean;
  totalMarks: number;
  passingMarks: number;
  teacherId?: string | null;
}

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
    MatTooltipModule,
    MatTabsModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatMenuModule
  ],
  template: `
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>menu_book</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Subject Master & Class Curriculum</h1>
            <p class="page-subtitle">Manage global subject catalog and configure class-wise curriculum & subject allocations (Play Group to Class 12th).</p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-raised-button color="primary" class="add-btn" *ngIf="activeTabIndex === 0" (click)="openSubjectModal()">
            <mat-icon>add</mat-icon>
            <span>Add New Subject</span>
          </button>
          <button mat-raised-button color="primary" class="add-btn" *ngIf="activeTabIndex === 1" (click)="saveClassAllocation()" [disabled]="savingAllocation || !selectedClass">
            <mat-icon>{{ savingAllocation ? 'hourglass_empty' : 'save' }}</mat-icon>
            <span>Save Allocation for {{ selectedClass?.className || 'Class' }}</span>
          </button>
        </div>
      </div>

      <!-- Main Tabs -->
      <mat-card class="main-tab-card mat-elevation-z1">
        <mat-tab-group [(selectedIndex)]="activeTabIndex" (selectedIndexChange)="onTabChange($event)" class="custom-tabs">
          
          <!-- TAB 1: Global Subjects Catalog -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">library_books</mat-icon>
              <span>All Subjects Catalog</span>
              <span class="tab-badge" *ngIf="totalCount > 0">{{ totalCount }}</span>
            </ng-template>

            <div class="tab-content">
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

                <div class="spacer"></div>
                <button mat-stroked-button color="primary" (click)="loadSubjects()">
                  <mat-icon>refresh</mat-icon> Refresh Catalog
                </button>
              </div>

              <!-- Loader -->
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
                    <th mat-header-cell *matHeaderCellDef mat-sort-header="description"> Description / Syllabus Notes </th>
                    <td mat-cell *matCellDef="let element">
                      <span class="desc-text">{{ element.description || '—' }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header="status"> Status </th>
                    <td mat-cell *matCellDef="let element">
                      <span [ngClass]="element.isActive ? 'active-text' : 'inactive-text'">
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
                      <div class="empty-state">
                        <mat-icon class="empty-icon">search_off</mat-icon>
                        <p>No subjects found matching your criteria.</p>
                      </div>
                    </td>
                  </tr>
                </table>
              </div>

              <mat-paginator 
                [length]="totalCount"
                [pageSize]="pageSize"
                [pageIndex]="pageIndex"
                [pageSizeOptions]="[5, 10, 20, 50]"
                (page)="onPageChange($event)"
                showFirstLastButtons>
              </mat-paginator>
            </div>
          </mat-tab>

          <!-- TAB 2: Class-Wise Subject Allocation -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">class</mat-icon>
              <span>Class-Wise Curriculum Mapping</span>
              <span class="tab-badge blue" *ngIf="classSummaries.length > 0">{{ classSummaries.length }} Classes</span>
            </ng-template>

            <div class="tab-content allocation-layout">
              <!-- Left Sidebar: Class Selector -->
              <div class="classes-sidebar">
                <div class="sidebar-header">
                  <div class="sidebar-title">
                    <mat-icon>school</mat-icon>
                    <span>Select Class</span>
                  </div>
                  <span class="sidebar-count">{{ classSummaries.length }} Total</span>
                </div>

                <div class="classes-list">
                  <div 
                    class="class-item" 
                    *ngFor="let c of classSummaries" 
                    [class.active-class]="selectedClass?.classId === c.classId"
                    (click)="selectClass(c)">
                    <div class="class-item-main">
                      <div class="class-item-name">{{ c.className }}</div>
                      <div class="class-item-code" *ngIf="c.classCode">{{ c.classCode }}</div>
                    </div>
                    <span class="assigned-pill" [class.has-subjects]="c.assignedSubjectsCount > 0">
                      {{ c.assignedSubjectsCount }} Subject{{ c.assignedSubjectsCount === 1 ? '' : 's' }}
                    </span>
                  </div>

                  <div class="empty-classes" *ngIf="classSummaries.length === 0 && !loadingAllocation">
                    <p>No active classes found.</p>
                  </div>
                </div>
              </div>

              <!-- Right Panel: Subject Checklist & Configuration for Selected Class -->
              <div class="allocation-panel">
                <div class="panel-header-bar" *ngIf="selectedClass">
                  <div class="ph-title-wrap">
                    <div class="ph-icon-box">
                      <mat-icon>tune</mat-icon>
                    </div>
                    <div>
                      <h2 class="ph-headline">Curriculum for <strong>{{ selectedClass.className }}</strong></h2>
                      <p class="ph-subheadline">
                        <span>Select the subjects taught in this class, assign respective subject teachers, and set passing benchmarks.</span>
                      </p>
                    </div>
                  </div>

                  <div class="ph-actions-wrap">
                    <!-- Copy from Class Dropdown -->
                    <button mat-stroked-button [matMenuTriggerFor]="copyMenu" class="copy-btn" [disabled]="classSummaries.length <= 1">
                      <mat-icon>content_copy</mat-icon>
                      <span>Copy From Class</span>
                      <mat-icon>arrow_drop_down</mat-icon>
                    </button>
                    <mat-menu #copyMenu="matMenu">
                      <div class="menu-header">Copy Subject Setup From:</div>
                      <ng-container *ngFor="let other of classSummaries">
                        <button mat-menu-item *ngIf="other.classId !== selectedClass.classId && other.assignedSubjectsCount > 0" (click)="copyFromClass(other)">
                          <mat-icon>school</mat-icon>
                          <span>{{ other.className }} ({{ other.assignedSubjectsCount }} Subjects)</span>
                        </button>
                      </ng-container>
                    </mat-menu>

                    <!-- Save Allocation Button -->
                    <button mat-raised-button color="primary" class="save-alloc-btn" (click)="saveClassAllocation()" [disabled]="savingAllocation">
                      <mat-icon>{{ savingAllocation ? 'hourglass_empty' : 'check_circle' }}</mat-icon>
                      <span>{{ savingAllocation ? 'Saving...' : 'Save Allocation' }}</span>
                    </button>
                  </div>
                </div>

                <!-- Stats summary banner for selected class -->
                <div class="selection-meta-bar" *ngIf="selectedClass">
                  <div class="meta-pill">
                    <strong>{{ selectedSubjectsCount }}</strong> / {{ subjectRows.length }} Subjects Selected
                  </div>
                  <div class="meta-pill text-blue">
                    <strong>{{ compulsorySubjectsCount }}</strong> Compulsory Subjects
                  </div>
                  <div class="meta-actions">
                    <button type="button" class="quick-link-btn" (click)="selectAllSubjects(true)">Select All</button>
                    <span class="sep">&bull;</span>
                    <button type="button" class="quick-link-btn" (click)="selectAllSubjects(false)">Deselect All</button>
                  </div>
                </div>

                <!-- Allocation Loader -->
                <mat-progress-bar mode="indeterminate" *ngIf="loadingAllocation" class="grid-loader"></mat-progress-bar>

                <!-- Subject Rows Checklist Table -->
                <div class="subject-rows-table-wrap" *ngIf="!loadingAllocation && selectedClass">
                  <table class="alloc-table">
                    <thead>
                      <tr>
                        <th style="width: 44px; text-align: center;">Active</th>
                        <th style="width: 28%;">Subject Name</th>
                        <th style="width: 32%;">Assigned Subject Teacher (कक्षा विषय शिक्षक)</th>
                        <th style="width: 16%;">Subject Type</th>
                        <th style="width: 12%;">Max Marks</th>
                        <th style="width: 12%;">Pass Marks</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of subjectRows" [class.row-selected]="row.isSelected">
                        <td style="text-align: center;">
                          <mat-checkbox 
                            [(ngModel)]="row.isSelected" 
                            color="primary"
                            (change)="onRowToggle(row)">
                          </mat-checkbox>
                        </td>
                        <td>
                          <div class="subj-name-cell" (click)="row.isSelected = !row.isSelected">
                            <strong>{{ row.subjectName }}</strong>
                            <span class="subj-code-tag" *ngIf="row.subjectCode">{{ row.subjectCode }}</span>
                          </div>
                        </td>
                        <td>
                          <mat-form-field appearance="outline" class="dense-field teacher-select-field">
                            <mat-select [(ngModel)]="row.teacherId" [disabled]="!row.isSelected" placeholder="-- Unassigned / General --">
                              <mat-option [value]="null">-- Unassigned / General --</mat-option>
                              <mat-option *ngFor="let t of teachers" [value]="t.id">
                                👨‍🏫 {{ t.fullName }} ({{ t.employeeCode }})
                              </mat-option>
                            </mat-select>
                          </mat-form-field>
                        </td>
                        <td>
                          <mat-slide-toggle 
                            [(ngModel)]="row.isCompulsory" 
                            color="primary" 
                            [disabled]="!row.isSelected">
                            <span class="toggle-label">{{ row.isCompulsory ? 'Compulsory' : 'Optional' }}</span>
                          </mat-slide-toggle>
                        </td>
                        <td>
                          <input 
                            type="number" 
                            [(ngModel)]="row.totalMarks" 
                            class="marks-input" 
                            [disabled]="!row.isSelected" 
                            min="1" />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            [(ngModel)]="row.passingMarks" 
                            class="marks-input" 
                            [disabled]="!row.isSelected" 
                            min="1" />
                        </td>
                      </tr>

                      <tr *ngIf="subjectRows.length === 0">
                        <td colspan="6" class="empty-alloc-msg">
                          No subjects defined in catalog. Please add subjects in Tab 1 first.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Footer Save Bar -->
                <div class="allocation-footer-bar" *ngIf="selectedClass && subjectRows.length > 0">
                  <div class="footer-hint">
                    <mat-icon>info</mat-icon>
                    <span>Allocating subjects here dynamically filters subjects in School Exams, Routine Timetable, and Homework modules.</span>
                  </div>
                  <button mat-raised-button color="primary" class="save-alloc-btn" (click)="saveClassAllocation()" [disabled]="savingAllocation">
                    <mat-icon>{{ savingAllocation ? 'hourglass_empty' : 'save' }}</mat-icon>
                    <span>Save Allocation for {{ selectedClass.className }}</span>
                  </button>
                </div>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .header-icon-box {
      width: 44px;
      height: 44px;
      background: #2563eb;
      color: #fff;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      flex-shrink: 0;
    }
    .page-title {
      font-size: 1.4rem;
      font-weight: 700;
      margin: 0;
      color: #1e3a8a;
    }
    .page-subtitle {
      color: #64748b;
      margin: 2px 0 0 0;
      font-size: 0.88rem;
    }
    .add-btn {
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .main-tab-card {
      border-radius: 10px;
      overflow: hidden;
      background: #ffffff;
    }

    /* Custom Tabs Styling */
    .custom-tabs ::ng-deep .mat-mdc-tab-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }
    .tab-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 8px;
    }
    .tab-badge {
      margin-left: 8px;
      background: #e2e8f0;
      color: #334155;
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 12px;
      font-weight: 700;
    }
    .tab-badge.blue {
      background: #2563eb;
      color: #ffffff;
    }

    /* Tab 1 Filter Bar */
    .tab-content {
      padding: 16px 20px;
    }
    .filter-toolbar {
      display: flex;
      gap: 16px;
      align-items: center;
      margin-bottom: 12px;
      flex-wrap: wrap;

      .search-field {
        width: 320px;
      }
      .status-filter {
        width: 180px;
      }
      .spacer {
        flex: 1;
      }
    }
    .grid-loader {
      margin-bottom: 8px;
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
      color: #64748b;
      font-size: 0.88rem;
    }
    .active-text {
      color: #16a34a;
      font-weight: 600;
    }
    .inactive-text {
      color: #dc2626;
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

    /* TAB 2: Class Allocation Layout */
    .allocation-layout {
      display: flex;
      gap: 20px;
      padding: 16px 20px 24px 20px;
      align-items: flex-start;
    }

    /* Left Sidebar: Classes */
    .classes-sidebar {
      width: 280px;
      flex-shrink: 0;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .sidebar-header {
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sidebar-title {
      font-weight: 700;
      font-size: 13px;
      color: #1e3a8a;
      display: flex;
      align-items: center;
      gap: 6px;
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #2563eb;
      }
    }
    .sidebar-count {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
    }
    .classes-list {
      display: flex;
      flex-direction: column;
      max-height: 600px;
      overflow-y: auto;
    }
    .class-item {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      transition: all 0.15s ease;
      &:hover {
        background: #f1f5f9;
      }
      &.active-class {
        background: #eff6ff;
        border-left: 4px solid #2563eb;
        .class-item-name {
          color: #1e40af;
          font-weight: 700;
        }
      }
    }
    .class-item-name {
      font-size: 13px;
      font-weight: 600;
      color: #334155;
    }
    .class-item-code {
      font-size: 11px;
      color: #64748b;
    }
    .assigned-pill {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      background: #e2e8f0;
      color: #64748b;
      font-weight: 600;
      &.has-subjects {
        background: #dbeafe;
        color: #1e40af;
      }
    }
    .empty-classes {
      padding: 24px;
      text-align: center;
      color: #94a3b8;
      font-size: 13px;
    }

    /* Right Panel: Subject Checklist Table */
    .allocation-panel {
      flex: 1;
      min-width: 0;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .panel-header-bar {
      padding: 16px 20px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .ph-title-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .ph-icon-box {
      width: 38px;
      height: 38px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #2563eb;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ph-headline {
      margin: 0;
      font-size: 16px;
      color: #1e3a8a;
      strong {
        color: #2563eb;
      }
    }
    .ph-subheadline {
      margin: 2px 0 0 0;
      font-size: 12px;
      color: #64748b;
    }
    .ph-actions-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .copy-btn {
      font-size: 12px;
      color: #475569;
    }
    .menu-header {
      padding: 8px 16px;
      font-size: 11px;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
    }

    .selection-meta-bar {
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 12px;
      color: #475569;
    }
    .meta-pill {
      background: #fff;
      border: 1px solid #cbd5e1;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      &.text-blue {
        color: #1d4ed8;
        border-color: #93c5fd;
        background: #eff6ff;
      }
    }
    .meta-actions {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }
    .quick-link-btn {
      background: none;
      border: none;
      color: #2563eb;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      padding: 0;
      &:hover {
        text-decoration: underline;
      }
    }
    .sep {
      color: #94a3b8;
    }

    /* Allocation Table */
    .subject-rows-table-wrap {
      overflow-x: auto;
    }
    .alloc-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      th {
        background: #f8fafc;
        border-bottom: 1px solid #cbd5e1;
        padding: 10px 14px;
        text-align: left;
        font-weight: 700;
        color: #334155;
        font-size: 12px;
      }
      td {
        padding: 8px 14px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: middle;
      }
      tr:hover td {
        background: #fafafa;
      }
      tr.row-selected td {
        background: #f0fdf4;
      }
    }
    .subj-name-cell {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
      strong {
        color: #1e293b;
      }
    }
    .subj-code-tag {
      background: #e2e8f0;
      color: #475569;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 700;
    }
    .teacher-select-field {
      width: 100%;
      max-width: 260px;
    }
    .dense-field ::ng-deep .mat-mdc-text-field-wrapper {
      padding-top: 0;
      padding-bottom: 0;
      height: 38px;
    }
    .dense-field ::ng-deep .mat-mdc-form-field-infix {
      padding-top: 8px;
      padding-bottom: 8px;
      min-height: 38px;
    }
    .toggle-label {
      font-size: 11px;
      font-weight: 600;
      color: #475569;
    }
    .marks-input {
      width: 60px;
      height: 32px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0 8px;
      font-size: 13px;
      font-weight: 600;
      text-align: center;
      &:focus {
        border-color: #2563eb;
        outline: none;
      }
      &:disabled {
        background: #f8fafc;
        color: #94a3b8;
      }
    }
    .empty-alloc-msg {
      padding: 30px;
      text-align: center;
      color: #94a3b8;
      font-style: italic;
    }

    .allocation-footer-bar {
      padding: 14px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .footer-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #64748b;
      font-size: 12px;
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #2563eb;
      }
    }
    .save-alloc-btn {
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
    }
  `]
})
export class SubjectsComponent implements OnInit {
  activeTabIndex = 0;

  // TAB 1: Catalog
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

  // TAB 2: Class Allocation
  classSummaries: ClassSubjectSummaryDto[] = [];
  selectedClass: ClassSubjectSummaryDto | null = null;
  subjectRows: ClassSubjectRowState[] = [];
  allActiveSubjects: SubjectDto[] = [];
  teachers: any[] = [];
  loadingAllocation = false;
  savingAllocation = false;
  targetAutoSelectClassId: string | null = null;

  constructor(
    private subjectsService: SubjectsService,
    private schoolService: SchoolService,
    private confirmDialog: ConfirmDialogService,
    private dialog: MatDialog,
    private http: HttpClient,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['tab'] !== undefined) {
        this.activeTabIndex = Number(params['tab']);
      }
      if (params['classId']) {
        this.targetAutoSelectClassId = params['classId'];
      }
    });

    this.loadSubjects();
    this.loadClassAllocationMasters();
  }

  onTabChange(index: number): void {
    this.activeTabIndex = index;
    if (index === 1) {
      this.loadClassAllocationMasters();
    } else {
      this.loadSubjects();
    }
  }

  // ── Tab 1 Methods ──────────────────────────────────────────

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
        // Refresh catalog for allocation tab as well
        this.subjectsService.getSubjects(true).subscribe(subs => this.allActiveSubjects = subs || []);
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

  // ── Tab 2 Allocation Methods ────────────────────────────────

  loadClassAllocationMasters(): void {
    this.loadingAllocation = true;

    // Load active subjects catalog
    this.subjectsService.getSubjects(true).subscribe({
      next: (subs) => {
        this.allActiveSubjects = subs || [];
      }
    });

    // Load teaching staff
    this.http.get<any[]>('http://localhost:5000/api/teachers?activeOnly=true&staffType=Teaching').subscribe({
      next: (teachers) => {
        this.teachers = teachers || [];
      },
      error: () => this.teachers = []
    });

    // Load active school classes
    this.schoolService.getClasses(true).subscribe({
      next: (schoolClasses) => {
        const clsList = schoolClasses || [];
        if (clsList.length > 0) {
          this.classSummaries = clsList.map(c => ({
            classId: c.id,
            className: c.name,
            classCode: c.code,
            displayOrder: c.displayOrder,
            assignedSubjectsCount: 0,
            subjectNames: []
          }));

          // Auto select immediately
          this.autoSelectClass();
        }

        // Load class subject summaries for counts
        this.subjectsService.getClassSubjectSummaries().subscribe({
          next: (summaries) => {
            const sumMap = new Map<string, ClassSubjectSummaryDto>();
            (summaries || []).forEach(s => sumMap.set(s.classId.toLowerCase(), s));

            if (this.classSummaries.length === 0 && (summaries || []).length > 0) {
              this.classSummaries = summaries;
            } else {
              this.classSummaries.forEach(cs => {
                const found = sumMap.get(cs.classId.toLowerCase());
                if (found) {
                  cs.assignedSubjectsCount = found.assignedSubjectsCount;
                  cs.subjectNames = found.subjectNames;
                }
              });
            }
            this.loadingAllocation = false;
            this.autoSelectClass();
          },
          error: () => {
            this.loadingAllocation = false;
            this.autoSelectClass();
          }
        });
      },
      error: () => {
        this.subjectsService.getClassSubjectSummaries().subscribe({
          next: (summaries) => {
            this.classSummaries = summaries || [];
            this.loadingAllocation = false;
            this.autoSelectClass();
          },
          error: () => {
            this.loadingAllocation = false;
          }
        });
      }
    });
  }

  autoSelectClass(): void {
    if (this.classSummaries.length === 0) return;
    let match: ClassSubjectSummaryDto | undefined;
    if (this.targetAutoSelectClassId) {
      match = this.classSummaries.find(c => c.classId.toLowerCase() === this.targetAutoSelectClassId?.toLowerCase());
      this.targetAutoSelectClassId = null;
    }
    if (!match && this.selectedClass) {
      match = this.classSummaries.find(c => c.classId.toLowerCase() === this.selectedClass?.classId.toLowerCase());
    }
    this.selectClass(match || this.classSummaries[0]);
  }

  selectClass(c: ClassSubjectSummaryDto): void {
    this.selectedClass = c;
    this.loadingAllocation = true;

    const buildRows = (allocated: ClassSubjectDto[]) => {
      const allocMap = new Map<string, ClassSubjectDto>();
      (allocated || []).forEach(a => allocMap.set((a.subjectId || '').toLowerCase(), a));

      this.subjectRows = this.allActiveSubjects.map(sub => {
        const existing = allocMap.get(sub.id.toLowerCase());
        return {
          subjectId: sub.id,
          subjectName: sub.name,
          subjectCode: sub.code,
          isSelected: !!existing,
          isCompulsory: existing ? existing.isCompulsory : true,
          totalMarks: existing ? existing.totalMarks : 100,
          passingMarks: existing ? existing.passingMarks : 33,
          teacherId: existing?.teacherId || null
        };
      });

      // Sort so selected subjects appear at the top, followed by alphabetical
      this.subjectRows.sort((a, b) => {
        if (a.isSelected && !b.isSelected) return -1;
        if (!a.isSelected && b.isSelected) return 1;
        return a.subjectName.localeCompare(b.subjectName);
      });

      this.loadingAllocation = false;
    };

    if (this.allActiveSubjects.length === 0) {
      this.subjectsService.getSubjects(true).subscribe({
        next: (subs) => {
          this.allActiveSubjects = subs || [];
          this.subjectsService.getClassSubjects(c.classId).subscribe({
            next: (allocated) => buildRows(allocated || []),
            error: () => buildRows([])
          });
        },
        error: () => {
          this.subjectsService.getClassSubjects(c.classId).subscribe({
            next: (allocated) => buildRows(allocated || []),
            error: () => buildRows([])
          });
        }
      });
    } else {
      this.subjectsService.getClassSubjects(c.classId).subscribe({
        next: (allocated) => buildRows(allocated || []),
        error: () => buildRows([])
      });
    }
  }

  onRowToggle(row: ClassSubjectRowState): void {
    if (!row.isSelected) {
      row.teacherId = null;
    }
  }

  selectAllSubjects(select: boolean): void {
    this.subjectRows.forEach(r => r.isSelected = select);
  }

  get selectedSubjectsCount(): number {
    return this.subjectRows.filter(r => r.isSelected).length;
  }

  get compulsorySubjectsCount(): number {
    return this.subjectRows.filter(r => r.isSelected && r.isCompulsory).length;
  }

  saveClassAllocation(): void {
    if (!this.selectedClass) return;

    this.savingAllocation = true;
    const selectedRows = this.subjectRows.filter(r => r.isSelected);

    const payload: AllocateClassSubjectItemDto[] = selectedRows.map((r, index) => ({
      subjectId: r.subjectId,
      teacherId: r.teacherId || null,
      isCompulsory: r.isCompulsory,
      totalMarks: r.totalMarks > 0 ? r.totalMarks : 100,
      passingMarks: r.passingMarks > 0 ? r.passingMarks : 33,
      displayOrder: index + 1
    }));

    this.subjectsService.allocateClassSubjects(this.selectedClass.classId, payload).subscribe({
      next: (res) => {
        this.savingAllocation = false;
        this.confirmDialog.alert(
          'Allocation Saved 🎉',
          `Successfully allocated ${payload.length} subjects for ${this.selectedClass?.className}!`,
          'success'
        );

        // Update local summary count
        if (this.selectedClass) {
          this.selectedClass.assignedSubjectsCount = payload.length;
          const target = this.classSummaries.find(x => x.classId === this.selectedClass?.classId);
          if (target) {
            target.assignedSubjectsCount = payload.length;
          }
        }
      },
      error: (err) => {
        this.savingAllocation = false;
        this.confirmDialog.alert(
          'Save Failed',
          err?.error?.message || 'Failed to save subject allocation for this class.',
          'danger'
        );
      }
    });
  }

  copyFromClass(sourceClass: ClassSubjectSummaryDto): void {
    if (!this.selectedClass) return;

    this.confirmDialog.confirm(
      'Copy Subject Setup',
      `Copy all ${sourceClass.assignedSubjectsCount} subjects from "${sourceClass.className}" to "${this.selectedClass.className}"? This will replace any existing subjects in ${this.selectedClass.className}.`,
      'Copy Subjects',
      'Cancel',
      'warning'
    ).subscribe(ok => {
      if (!ok) return;

      this.loadingAllocation = true;
      this.subjectsService.copyClassSubjects(this.selectedClass!.classId, sourceClass.classId).subscribe({
        next: (allocated) => {
          this.loadingAllocation = false;
          this.confirmDialog.alert(
            'Copied Successfully 🎉',
            `Copied ${allocated.length} subjects from "${sourceClass.className}" to "${this.selectedClass?.className}"!`,
            'success'
          );
          // Reload allocation view
          this.selectClass(this.selectedClass!);
          // Update summary
          const target = this.classSummaries.find(x => x.classId === this.selectedClass?.classId);
          if (target) target.assignedSubjectsCount = allocated.length;
        },
        error: (err) => {
          this.loadingAllocation = false;
          this.confirmDialog.alert('Copy Failed', err?.error?.message || 'Failed to copy subjects.', 'danger');
        }
      });
    });
  }
}
