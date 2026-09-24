import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { HttpClient } from '@angular/common/http';
import { SchoolService, SchoolClassDto, SchoolSectionDto, UnifiedStatsDto } from '../../core/services/school.service';
import { RoomService, RoomDto } from '../../core/services/room.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { QuickClassTeacherDialogComponent } from './quick-class-teacher-dialog.component';

@Component({
  selector: 'app-school-classes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatDialogModule
  ],
  template: `
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">
            <mat-icon class="title-icon">school</mat-icon>
            School Classes &amp; Sections Master
          </h1>
          <p class="page-subtitle">
            Configure academic classes (Nursery to 12th) and their sections. Students in these classes can seamlessly enroll in evening coaching batches.
          </p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button color="primary" class="action-btn" (click)="openAddSectionDrawer()">
            <mat-icon>add_box</mat-icon>
            <span>Add Section</span>
          </button>
          <button mat-raised-button color="primary" class="action-btn primary" (click)="openAddClassDrawer()">
            <mat-icon>add</mat-icon>
            <span>Add New Class</span>
          </button>
        </div>
      </div>

      <!-- Unified Stats Cards -->
      <div class="stats-grid">
        <mat-card class="stat-card classes mat-elevation-z1">
          <div class="stat-icon"><mat-icon>menu_book</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ classes.length }}</span>
            <span class="stat-lbl">Active Classes</span>
          </div>
        </mat-card>

        <mat-card class="stat-card sections mat-elevation-z1">
          <div class="stat-icon"><mat-icon>meeting_room</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ getTotalSections() }}</span>
            <span class="stat-lbl">Total Sections</span>
          </div>
        </mat-card>

        <mat-card class="stat-card school-students mat-elevation-z1">
          <div class="stat-icon"><mat-icon>badge</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ stats?.totalSchoolStudents || 0 }}</span>
            <span class="stat-lbl">School Students</span>
          </div>
        </mat-card>

        <mat-card class="stat-card dual-students mat-elevation-z1">
          <div class="stat-icon"><mat-icon>auto_awesome</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ stats?.dualEnrolledStudents || 0 }}</span>
            <span class="stat-lbl">Dual Enrolled (School + Coaching)</span>
          </div>
        </mat-card>
      </div>

      <!-- Class Drawer Modal -->
      <mat-card class="form-drawer mat-elevation-z3" [class.edit-mode-active]="isEditingClass" id="class-form-drawer" *ngIf="showClassDrawer">
        <div class="drawer-header">
          <div class="drawer-title">
            <div class="drawer-icon-wrap" [class.is-edit]="isEditingClass">
              <mat-icon>{{ isEditingClass ? 'edit_note' : 'add_circle' }}</mat-icon>
            </div>
            <div>
              <div class="drawer-headline">
                <strong>{{ isEditingClass ? 'Edit School Class' : 'Create New School Class' }}</strong>
                <span class="editing-chip" *ngIf="isEditingClass">
                  <span class="pulse-dot"></span>
                  Editing: {{ classFormData.name }}
                </span>
              </div>
              <small>{{ isEditingClass ? 'Update class title, code, and display order' : 'e.g. Nursery, UKG, Class 1st, Class 8th, Class 10th' }}</small>
            </div>
          </div>
          <button mat-icon-button (click)="closeClassDrawer()" matTooltip="Close Edit Form">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="f-flex-2">
            <mat-label>Class Name *</mat-label>
            <input matInput [(ngModel)]="classFormData.name" placeholder="e.g. Class 8th, Class 10th" required />
          </mat-form-field>

          <mat-form-field appearance="outline" class="f-flex-1">
            <mat-label>Class Code (Optional)</mat-label>
            <input matInput [(ngModel)]="classFormData.code" placeholder="e.g. C08, C10" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="f-flex-1">
            <mat-label>Display Order</mat-label>
            <input matInput type="number" [(ngModel)]="classFormData.displayOrder" />
          </mat-form-field>
        </div>

        <div class="drawer-footer">
          <mat-slide-toggle [(ngModel)]="classFormData.isActive" color="primary" *ngIf="isEditingClass">
            Active Status
          </mat-slide-toggle>
          <div class="btn-group">
            <button mat-button (click)="closeClassDrawer()">Cancel</button>
            <button mat-raised-button color="primary" (click)="saveClass()" [disabled]="!classFormData.name || saving">
              <mat-icon>{{ saving ? 'hourglass_empty' : 'save' }}</mat-icon>
              {{ isEditingClass ? 'Update Class' : 'Save Class' }}
            </button>
          </div>
        </div>
      </mat-card>

      <!-- Section Drawer Modal -->
      <mat-card class="form-drawer mat-elevation-z3" [class.edit-mode-active]="isEditingSection" id="section-form-drawer" *ngIf="showSectionDrawer">
        <div class="drawer-header">
          <div class="drawer-title">
            <div class="drawer-icon-wrap" [class.is-edit]="isEditingSection">
              <mat-icon>{{ isEditingSection ? 'edit_note' : 'view_stream' }}</mat-icon>
            </div>
            <div>
              <div class="drawer-headline">
                <strong>{{ isEditingSection ? 'Edit Section Details' : 'Add Section to Class' }}</strong>
                <span class="editing-chip" *ngIf="isEditingSection">
                  <span class="pulse-dot"></span>
                  Editing: {{ sectionFormData.name }} {{ editingParentClassName ? '(' + editingParentClassName + ')' : '' }}
                </span>
              </div>
              <small>{{ isEditingSection ? 'Update section name, capacity, classroom allocation, or class teacher' : 'e.g. Section A, Section B, Commerce, Science' }}</small>
            </div>
          </div>
          <button mat-icon-button (click)="closeSectionDrawer()" matTooltip="Close Edit Form">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="f-flex-2" *ngIf="!isEditingSection">
            <mat-label>Assign to Class *</mat-label>
            <mat-select [(ngModel)]="sectionFormData.classId" required>
              <mat-option *ngFor="let c of classes" [value]="c.id">{{ c.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="f-flex-1">
            <mat-label>Section Name *</mat-label>
            <input matInput [(ngModel)]="sectionFormData.name" placeholder="e.g. A, B, C, Rose" required />
          </mat-form-field>

          <mat-form-field appearance="outline" class="f-flex-1">
            <mat-label>Max Capacity</mat-label>
            <input matInput type="number" [(ngModel)]="sectionFormData.maxCapacity" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="f-flex-2">
            <mat-label>Allocated Classroom</mat-label>
            <mat-select [(ngModel)]="sectionFormData.roomId">
              <mat-option [value]="null">-- None / General --</mat-option>
              <mat-option *ngFor="let r of rooms" [value]="r.id">
                {{ r.roomNumber }} (Cap: {{ r.capacity }})
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="f-flex-2">
            <mat-label>Class Teacher (कक्षा अध्यापक)</mat-label>
            <mat-select [(ngModel)]="sectionFormData.classTeacherId">
              <mat-option [value]="null">-- None / Unassigned --</mat-option>
              <mat-option *ngFor="let t of teachers" [value]="t.id">
                👨‍🏫 {{ t.fullName }} ({{ t.employeeCode }})
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="drawer-footer">
          <mat-slide-toggle [(ngModel)]="sectionFormData.isActive" color="primary" *ngIf="isEditingSection">
            Active Status
          </mat-slide-toggle>
          <div class="btn-group">
            <button mat-button (click)="closeSectionDrawer()">Cancel</button>
            <button mat-raised-button color="primary" (click)="saveSection()" [disabled]="!sectionFormData.name || saving">
              <mat-icon>{{ saving ? 'hourglass_empty' : 'save' }}</mat-icon>
              {{ isEditingSection ? 'Update Section' : 'Save Section' }}
            </button>
          </div>
        </div>
      </mat-card>

      <!-- Main Class Cards Grid -->
      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <div class="classes-container" *ngIf="!loading && classes.length > 0">
        <mat-card class="class-card mat-elevation-z1" *ngFor="let c of classes">
          <div class="class-card-header">
            <div class="class-title-wrap">
              <div class="class-badge">
                <mat-icon>school</mat-icon>
              </div>
              <div class="class-title-info">
                <h3 class="class-name">{{ c.name }}</h3>
                <span class="class-code" *ngIf="c.code">Code: {{ c.code }}</span>
              </div>
            </div>

            <div class="class-actions">
              <button mat-icon-button class="action-btn-circle add-btn" matTooltip="Add Section to this Class" (click)="quickAddSection(c)">
                <mat-icon>add</mat-icon>
              </button>
              <button mat-icon-button class="action-btn-circle edit-btn" matTooltip="Edit Class" (click)="editClass(c)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button class="action-btn-circle delete-btn" matTooltip="Delete Class" (click)="deleteClass(c)">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
          </div>

          <div class="class-meta-bar">
            <span class="meta-tag students-tag">
              <mat-icon>groups</mat-icon>
              <span>{{ c.studentCount }} Student{{ c.studentCount === 1 ? '' : 's' }}</span>
            </span>
            <span class="meta-tag sections-tag">
              <mat-icon>layers</mat-icon>
              <span>{{ c.sections?.length || 0 }} Section{{ (c.sections?.length || 0) === 1 ? '' : 's' }}</span>
            </span>
          </div>

          <!-- Sections List in Class -->
          <div class="sections-list">
            <div class="section-pill" *ngFor="let s of c.sections">
              <div class="sec-details">
                <div class="sec-title-row">
                  <span class="sec-name">{{ s.name.startsWith('Section') ? s.name : 'Section ' + s.name }}</span>
                  <span class="sec-capacity-chip">
                    <mat-icon class="capacity-icon">person_outline</mat-icon>
                    <span>{{ s.studentCount }} / {{ s.maxCapacity }} Seats</span>
                  </span>
                </div>

                <div class="sec-tags-row">
                  <span class="sec-room-tag" *ngIf="s.roomNumber">
                    <mat-icon>meeting_room</mat-icon>
                    <span>Room {{ s.roomNumber }}</span>
                  </span>
                  <div class="sec-teacher-tag clickable-tag" (click)="openQuickAssignTeacher(s, c)" [class.unassigned]="!s.classTeacherName" [matTooltip]="s.classTeacherName ? 'Class Teacher: ' + s.classTeacherName + ' (Click to change)' : 'Click to Assign Class Teacher'">
                    <mat-icon>{{ s.classTeacherName ? 'supervisor_account' : 'person_add' }}</mat-icon>
                    <span>{{ s.classTeacherName || 'Assign Class Teacher' }}</span>
                    <mat-icon class="quick-caret">arrow_drop_down</mat-icon>
                  </div>
                </div>
              </div>

              <div class="sec-actions">
                <button mat-icon-button class="mini-action-btn edit-sec" (click)="editSection(s)" matTooltip="Edit Section">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button class="mini-action-btn delete-sec" (click)="deleteSection(s)" matTooltip="Delete Section">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
            </div>

            <div class="no-sections" *ngIf="!c.sections || c.sections.length === 0">
              <mat-icon class="empty-icon">add_circle_outline</mat-icon>
              <span>No sections yet. Click '+' to add Section A.</span>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!loading && classes.length === 0">
        <mat-icon>school</mat-icon>
        <h3>No School Classes Declared</h3>
        <p>Set up your institution's school classes (e.g. Class 1st to 12th) to begin enrolling school students and linking them with coaching batches.</p>
        <button mat-raised-button color="primary" (click)="openAddClassDrawer()">
          <mat-icon>add</mat-icon>
          <span>Declare First Class</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .page-container { display: flex; flex-direction: column; gap: 20px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; }
    .page-title {
      font-size: 1.5rem; font-weight: 700; margin: 0; color: #0f172a; display: flex; align-items: center; gap: 10px;
      .title-icon { color: #2563eb; font-size: 1.7rem; width: 1.7rem; height: 1.7rem; }
    }
    .page-subtitle { color: #64748b; margin: 4px 0 0; font-size: 0.88rem; max-width: 820px; }
    .header-actions { display: flex; align-items: center; gap: 10px; }
    .action-btn { font-weight: 600; border-radius: 8px; }

    /* Modern Material 3 Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; }
    .stat-card {
      background: #ffffff !important; border-radius: 14px !important; padding: 16px 18px !important;
      display: flex; align-items: center; gap: 14px;
      border: 1px solid #e2e8f0 !important;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02) !important;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;

      &:hover {
        transform: translateY(-3px);
        box-shadow: 0 10px 20px -5px rgba(15, 23, 42, 0.08) !important;
        border-color: #cbd5e1 !important;
      }

      .stat-icon {
        width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        mat-icon { font-size: 24px; width: 24px; height: 24px; color: #ffffff; }
      }
      .stat-info {
        .stat-val { display: block; font-size: 1.6rem; font-weight: 800; color: #0f172a; line-height: 1.1; letter-spacing: -0.02em; }
        .stat-lbl { font-size: 0.76rem; font-weight: 600; color: #64748b; margin-top: 2px; display: block; }
      }

      &.classes .stat-icon { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25); }
      &.sections .stat-icon { background: linear-gradient(135deg, #d946ef 0%, #a21caf 100%); box-shadow: 0 4px 10px rgba(217, 70, 239, 0.25); }
      &.school-students .stat-icon { background: linear-gradient(135deg, #10b981 0%, #047857 100%); box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25); }
      &.dual-students .stat-icon { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 4px 10px rgba(245, 158, 11, 0.25); }
    }

    /* Drawers */
    .form-drawer {
      padding: 20px !important; border-radius: 16px !important; border: 1px solid #cbd5e1 !important; background: #ffffff !important;
      display: flex; flex-direction: column; gap: 16px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;

      &.edit-mode-active {
        border: 2px solid #2563eb !important;
        background: linear-gradient(180deg, #f8faff 0%, #ffffff 100%) !important;
        box-shadow: 0 14px 30px -4px rgba(37, 99, 235, 0.2), 0 4px 12px -2px rgba(37, 99, 235, 0.08) !important;
        animation: drawerPulse 0.35s ease-out;
      }

      .drawer-header {
        display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 14px;
        .drawer-title {
          display: flex; align-items: center; gap: 12px;
          .drawer-icon-wrap {
            width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
            background: #eff6ff; color: #2563eb;
            mat-icon { font-size: 22px; width: 22px; height: 22px; }
            &.is-edit {
              background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff;
              box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);
            }
          }
          .drawer-headline {
            display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
            strong { font-size: 1.1rem; color: #0f172a; display: block; font-weight: 700; }
            .editing-chip {
              display: inline-flex; align-items: center; gap: 6px;
              background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;
              font-size: 0.76rem; font-weight: 700; padding: 2px 10px; border-radius: 20px;
              .pulse-dot {
                width: 8px; height: 8px; border-radius: 50%; background: #2563eb;
                box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7);
                animation: dotPulse 1.6s infinite;
              }
            }
          }
          small { color: #64748b; font-size: 0.82rem; margin-top: 2px; display: block; }
        }
      }
      .form-row { display: flex; flex-wrap: wrap; gap: 14px; }
      .f-flex-1 { flex: 1; min-width: 140px; }
      .f-flex-2 { flex: 2; min-width: 220px; }
      .drawer-footer {
        display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 14px;
        .btn-group { display: flex; gap: 10px; }
      }
    }

    /* Responsive Material 3 Classes Cards Grid */
    .classes-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
      gap: 20px;
      align-items: stretch;
    }

    .class-card {
      background: #ffffff !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 16px !important;
      padding: 18px !important;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02) !important;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
      display: flex !important;
      flex-direction: column !important;

      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 14px 28px -6px rgba(15, 23, 42, 0.08), 0 6px 12px -4px rgba(15, 23, 42, 0.04) !important;
        border-color: #cbd5e1 !important;
      }
      
      .class-card-header {
        display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;
        .class-title-wrap {
          display: flex; align-items: center; gap: 12px;
          .class-badge {
            width: 44px; height: 44px; border-radius: 12px;
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            color: #2563eb;
            border: 1px solid #bfdbfe;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 3px 8px -1px rgba(37, 99, 235, 0.15);
            flex-shrink: 0;
            mat-icon { font-size: 24px; width: 24px; height: 24px; }
          }
          .class-title-info {
            .class-name { margin: 0; font-size: 1.15rem; font-weight: 700; color: #0f172a; line-height: 1.25; }
            .class-code { display: inline-block; font-size: 0.72rem; font-weight: 600; color: #475569; background: #f1f5f9; padding: 2px 7px; border-radius: 6px; margin-top: 3px; }
          }
        }
        .class-actions {
          display: flex;
          align-items: center;
          gap: 6px;

          .action-btn-circle {
            width: 32px !important;
            height: 32px !important;
            min-width: 32px !important;
            padding: 0 !important;
            border-radius: 50% !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;

            ::ng-deep .mat-mdc-button-touch-target { display: none !important; }
            ::ng-deep .mat-mdc-button-persistent-ripple,
            ::ng-deep .mat-ripple { border-radius: 50% !important; }

            mat-icon { font-size: 18px !important; width: 18px !important; height: 18px !important; line-height: 18px !important; }

            &.add-btn {
              color: #2563eb; background: #eff6ff;
              &:hover { background: #dbeafe !important; transform: scale(1.08); }
            }
            &.edit-btn {
              color: #475569; background: #f8fafc; border: 1px solid #e2e8f0;
              &:hover { background: #f1f5f9 !important; color: #0f172a; transform: scale(1.08); }
            }
            &.delete-btn {
              color: #ef4444; background: #fef2f2;
              &:hover { background: #fee2e2 !important; color: #dc2626; transform: scale(1.08); }
            }
          }
        }
      }

      .class-meta-bar {
        display: flex; justify-content: space-between; align-items: center;
        padding: 7px 12px; background: #f8fafc; border-radius: 10px; border: 1px solid #f1f5f9; margin-bottom: 14px;
        .meta-tag {
          display: inline-flex; align-items: center; gap: 5px; font-size: 0.78rem; font-weight: 600;
          &.students-tag {
            color: #475569;
            mat-icon { font-size: 16px; width: 16px; height: 16px; color: #64748b; }
          }
          &.sections-tag {
            color: #2563eb; background: #ffffff; padding: 2px 8px; border-radius: 8px; border: 1px solid #e2e8f0;
            font-size: 0.74rem; font-weight: 700;
            mat-icon { font-size: 15px; width: 15px; height: 15px; color: #2563eb; }
          }
        }
      }

      .sections-list {
        display: flex; flex-direction: column; gap: 9px; flex: 1;
        .section-pill {
          display: flex; justify-content: space-between; align-items: center; padding: 9px 12px;
          background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.02);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

          &:hover {
            border-color: #93c5fd;
            background: #fbfdff;
            box-shadow: 0 4px 10px rgba(37, 99, 235, 0.06);
            transform: translateY(-1px);
          }

          .sec-details {
            display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 0;

            .sec-title-row {
              display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
              .sec-name { font-weight: 700; font-size: 0.9rem; color: #0f172a; line-height: 1.2; }
              .sec-capacity-chip {
                font-size: 0.71rem; font-weight: 600; color: #475569; background: #f1f5f9; padding: 2px 7px;
                border-radius: 6px; display: inline-flex; align-items: center; gap: 3px;
                .capacity-icon { font-size: 13px; width: 13px; height: 13px; line-height: 13px; color: #64748b; }
              }
            }

            .sec-tags-row {
              display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
              .sec-room-tag {
                display: inline-flex; align-items: center; gap: 3px; font-size: 0.71rem; font-weight: 500;
                color: #64748b; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 1px 6px;
                mat-icon { font-size: 13px; width: 13px; height: 13px; line-height: 13px; }
              }
              .sec-teacher-tag {
                display: inline-flex; align-items: center; gap: 4px; font-size: 0.71rem; font-weight: 600;
                color: #1d4ed8; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 1px 7px;
                mat-icon { font-size: 13px; width: 13px; height: 13px; line-height: 13px; }
                &.unassigned { color: #854d0e; background: #fefce8; border-color: #fef08a; }
                &.clickable-tag {
                  cursor: pointer;
                  transition: all 0.15s ease;
                  user-select: none;
                  &:hover {
                    background: #dbeafe;
                    border-color: #93c5fd;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.15);
                  }
                  &.unassigned:hover {
                    background: #fef08a;
                    border-color: #fde047;
                    color: #713f12;
                  }
                  .quick-caret {
                    font-size: 14px;
                    width: 14px;
                    height: 14px;
                    line-height: 14px;
                    margin-left: -2px;
                    opacity: 0.7;
                  }
                }
              }
            }
          }

          .sec-actions {
            display: flex; align-items: center; gap: 3px; margin-left: 8px; flex-shrink: 0;

            .mini-action-btn {
              width: 28px !important; height: 28px !important; min-width: 28px !important;
              padding: 0 !important; border-radius: 50% !important;
              display: inline-flex !important; align-items: center !important; justify-content: center !important;
              transition: all 0.15s ease !important;

              ::ng-deep .mat-mdc-button-touch-target { display: none !important; }
              ::ng-deep .mat-mdc-button-persistent-ripple,
              ::ng-deep .mat-ripple { border-radius: 50% !important; }

              mat-icon { font-size: 16px !important; width: 16px !important; height: 16px !important; line-height: 16px !important; }

              &.edit-sec {
                color: #64748b;
                &:hover { background-color: #f1f5f9 !important; color: #0f172a; }
              }
              &.delete-sec {
                color: #f87171;
                &:hover { background-color: #fee2e2 !important; color: #dc2626; }
              }
            }
          }
        }
        .no-sections {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          color: #94a3b8; font-size: 0.8rem; font-style: italic; padding: 14px 10px;
          background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px;
          .empty-icon { font-size: 18px; width: 18px; height: 18px; color: #94a3b8; }
        }
      }
    }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 20px;
      mat-icon { font-size: 60px; width: 60px; height: 60px; color: #cbd5e1; margin-bottom: 12px; }
      h3 { margin: 0 0 6px; font-size: 1.2rem; color: #1e293b; }
      p { margin: 0 0 20px; color: #64748b; font-size: 0.9rem; max-width: 480px; }
    }

    /* Responsive Media Queries */
    @media (max-width: 1024px) {
      .classes-container {
        grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
        gap: 16px;
      }
    }

    @media (max-width: 768px) {
      .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }
      .header-actions {
        width: 100%;
        display: flex;
        gap: 10px;
        button { flex: 1; }
      }
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      .classes-container {
        grid-template-columns: 1fr;
        gap: 14px;
      }
    }

    @media (max-width: 480px) {
      .stats-grid {
        grid-template-columns: 1fr;
        gap: 10px;
      }
      .class-card {
        padding: 14px !important;
      }
      .section-pill {
        padding: 8px 10px;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
      .sec-actions {
        align-self: flex-end;
        margin-left: 0 !important;
      }
    }

    @keyframes drawerPulse {
      0% { transform: translateY(-8px); opacity: 0.7; }
      100% { transform: translateY(0); opacity: 1; }
    }

    @keyframes dotPulse {
      0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7); }
      70% { box-shadow: 0 0 0 6px rgba(37, 99, 235, 0); }
      100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
    }
  `]
})
export class SchoolClassesComponent implements OnInit {
  classes: SchoolClassDto[] = [];
  rooms: RoomDto[] = [];
  teachers: any[] = [];
  stats: UnifiedStatsDto | null = null;
  loading = false;
  saving = false;

  showClassDrawer = false;
  isEditingClass = false;
  editingClassId: string | null = null;
  classFormData: any = {
    name: '',
    code: '',
    displayOrder: 0,
    isActive: true
  };

  showSectionDrawer = false;
  isEditingSection = false;
  editingSectionId: string | null = null;
  editingParentClassName = '';
  sectionFormData: any = {
    classId: '',
    name: '',
    maxCapacity: 45,
    roomId: null,
    classTeacherId: null,
    isActive: true
  };

  private scrollToDrawer(): void {
    setTimeout(() => {
      // 1. Scroll window
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // 2. Scroll MatSidenavContent
      const sidenavContent = document.querySelector('mat-sidenav-content');
      if (sidenavContent) {
        sidenavContent.scrollTo({ top: 0, behavior: 'smooth' });
      }
      // 3. Scroll specific drawer element into view
      const drawer = document.getElementById('section-form-drawer') || 
                     document.getElementById('class-form-drawer') || 
                     document.querySelector('.form-drawer');
      if (drawer) {
        drawer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  }

  constructor(
    private schoolService: SchoolService,
    private roomService: RoomService,
    private confirmDialog: ConfirmDialogService,
    private dialog: MatDialog,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.loadRooms();
    this.loadTeachers();
    this.loadStats();
  }

  loadTeachers(): void {
    this.http.get<any[]>('http://localhost:5000/api/teachers?activeOnly=true').subscribe({
      next: (res) => this.teachers = res || [],
      error: () => this.teachers = []
    });
  }

  openQuickAssignTeacher(section: SchoolSectionDto, parentClass: SchoolClassDto): void {
    const dialogRef = this.dialog.open(QuickClassTeacherDialogComponent, {
      width: '500px',
      data: {
        sectionId: section.id,
        sectionName: section.name,
        className: parentClass.name,
        currentClassTeacherId: section.classTeacherId,
        currentClassTeacherName: section.classTeacherName,
        teachers: this.teachers
      }
    });

    dialogRef.afterClosed().subscribe(res => {
      if (res?.success) {
        section.classTeacherId = res.classTeacherId;
        section.classTeacherName = res.classTeacherName;
        this.loadData();
      }
    });
  }

  loadData(): void {
    this.loading = true;
    this.schoolService.getClasses(false).subscribe({
      next: (res) => {
        const list = res || [];
        // Ensure sections in every class are always sequenced A, B, C, D...
        list.forEach(c => {
          if (c.sections && c.sections.length > 0) {
            c.sections.sort((a, b) => {
              const nameA = (a.name || '').replace(/^Section\s*/i, '').trim();
              const nameB = (b.name || '').replace(/^Section\s*/i, '').trim();
              return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
            });
          }
        });
        this.classes = list;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.classes = [];
      }
    });
  }

  loadRooms(): void {
    this.roomService.getRooms().subscribe({
      next: (res) => {
        this.rooms = (res || []).filter(r => r.isActive);
      }
    });
  }

  loadStats(): void {
    this.schoolService.getUnifiedStats().subscribe({
      next: (res) => {
        this.stats = res;
      }
    });
  }

  getTotalSections(): number {
    return this.classes.reduce((acc, c) => acc + (c.sections?.length || 0), 0);
  }

  openAddClassDrawer(): void {
    this.isEditingClass = false;
    this.editingClassId = null;
    this.classFormData = {
      name: '',
      code: '',
      displayOrder: this.classes.length + 1,
      isActive: true
    };
    this.showClassDrawer = true;
    this.scrollToDrawer();
  }

  editClass(c: SchoolClassDto): void {
    this.isEditingClass = true;
    this.editingClassId = c.id;
    this.classFormData = {
      name: c.name,
      code: c.code || '',
      displayOrder: c.displayOrder,
      isActive: c.isActive
    };
    this.showClassDrawer = true;
    this.scrollToDrawer();
  }

  closeClassDrawer(): void {
    this.showClassDrawer = false;
    this.isEditingClass = false;
    this.editingClassId = null;
  }

  saveClass(): void {
    if (!this.classFormData.name) return;
    this.saving = true;

    if (this.isEditingClass && this.editingClassId) {
      this.schoolService.updateClass(this.editingClassId, this.classFormData).subscribe({
        next: () => {
          this.saving = false;
          this.closeClassDrawer();
          this.loadData();
          this.confirmDialog.alert('Class Updated', 'School class updated successfully.', 'success');
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert('Error', err?.error?.message || 'Failed to update class.', 'danger');
        }
      });
    } else {
      this.schoolService.createClass(this.classFormData).subscribe({
        next: () => {
          this.saving = false;
          this.closeClassDrawer();
          this.loadData();
          this.confirmDialog.alert('Class Added', 'New school class created successfully.', 'success');
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert('Error', err?.error?.message || 'Failed to add class.', 'danger');
        }
      });
    }
  }

  deleteClass(c: SchoolClassDto): void {
    this.confirmDialog.danger(
      'Delete School Class',
      `Are you sure you want to delete "${c.name}"? This action cannot be undone.`,
      'Delete'
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.schoolService.deleteClass(c.id).subscribe({
          next: () => {
            this.loadData();
            this.confirmDialog.alert('Deleted', 'School class removed.', 'success');
          },
          error: (err) => {
            this.confirmDialog.alert('Error', err?.error?.message || 'Failed to delete class.', 'danger');
          }
        });
      }
    });
  }

  openAddSectionDrawer(classId?: string): void {
    this.isEditingSection = false;
    this.editingSectionId = null;
    const parentClass = this.classes.find(c => c.id === classId);
    this.editingParentClassName = parentClass?.name || '';
    this.sectionFormData = {
      classId: classId || (this.classes.length > 0 ? this.classes[0].id : ''),
      name: '',
      maxCapacity: 45,
      roomId: null,
      classTeacherId: null,
      isActive: true
    };
    this.showSectionDrawer = true;
    this.scrollToDrawer();
  }

  quickAddSection(c: SchoolClassDto): void {
    this.openAddSectionDrawer(c.id);
  }

  editSection(s: SchoolSectionDto): void {
    const parentClass = this.classes.find(c => c.id === s.classId);
    this.editingParentClassName = parentClass?.name || '';
    this.isEditingSection = true;
    this.editingSectionId = s.id;
    this.sectionFormData = {
      classId: s.classId,
      name: s.name,
      maxCapacity: s.maxCapacity,
      roomId: s.roomId || null,
      classTeacherId: s.classTeacherId || null,
      isActive: s.isActive
    };
    this.showSectionDrawer = true;
    this.scrollToDrawer();
  }

  closeSectionDrawer(): void {
    this.showSectionDrawer = false;
    this.isEditingSection = false;
    this.editingSectionId = null;
    this.editingParentClassName = '';
  }

  saveSection(): void {
    if (!this.sectionFormData.name) return;
    this.saving = true;

    if (this.isEditingSection && this.editingSectionId) {
      this.schoolService.updateSection(this.editingSectionId, this.sectionFormData).subscribe({
        next: () => {
          this.saving = false;
          const assignedTeacher = this.teachers.find(t => t.id === this.sectionFormData.classTeacherId);
          const teacherMsg = assignedTeacher 
            ? ` with Class Teacher (${assignedTeacher.fullName})` 
            : ' (Class Teacher unassigned)';
          const secName = this.sectionFormData.name;
          this.closeSectionDrawer();
          this.loadData();
          this.confirmDialog.alert('Section Updated', `Section "${secName}" updated successfully${teacherMsg}.`, 'success');
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert('Error', err?.error?.message || 'Failed to update section.', 'danger');
        }
      });
    } else {
      this.schoolService.createSection(this.sectionFormData).subscribe({
        next: () => {
          this.saving = false;
          const secName = this.sectionFormData.name;
          this.closeSectionDrawer();
          this.loadData();
          this.confirmDialog.alert('Section Added', `New section "${secName}" assigned to class successfully.`, 'success');
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert('Error', err?.error?.message || 'Failed to add section.', 'danger');
        }
      });
    }
  }

  deleteSection(s: SchoolSectionDto): void {
    this.confirmDialog.danger(
      'Delete Section',
      `Are you sure you want to delete Section "${s.name}"?`,
      'Delete'
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.schoolService.deleteSection(s.id).subscribe({
          next: () => {
            this.loadData();
            this.confirmDialog.alert('Deleted', 'Section removed.', 'success');
          },
          error: (err) => {
            this.confirmDialog.alert('Error', err?.error?.message || 'Failed to delete section.', 'danger');
          }
        });
      }
    });
  }
}
