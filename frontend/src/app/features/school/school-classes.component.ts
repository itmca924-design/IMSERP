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
import { SchoolService, SchoolClassDto, SchoolSectionDto, UnifiedStatsDto } from '../../core/services/school.service';
import { RoomService, RoomDto } from '../../core/services/room.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

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
    MatSlideToggleModule
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
        <div class="stat-card classes">
          <div class="stat-icon"><mat-icon>menu_book</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ classes.length }}</span>
            <span class="stat-lbl">Active Classes</span>
          </div>
        </div>

        <div class="stat-card sections">
          <div class="stat-icon"><mat-icon>meeting_room</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ getTotalSections() }}</span>
            <span class="stat-lbl">Total Sections</span>
          </div>
        </div>

        <div class="stat-card school-students">
          <div class="stat-icon"><mat-icon>badge</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ stats?.totalSchoolStudents || 0 }}</span>
            <span class="stat-lbl">School Students</span>
          </div>
        </div>

        <div class="stat-card dual-students">
          <div class="stat-icon"><mat-icon>auto_awesome</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ stats?.dualEnrolledStudents || 0 }}</span>
            <span class="stat-lbl">Dual Enrolled (School + Coaching)</span>
          </div>
        </div>
      </div>

      <!-- Class Drawer Modal -->
      <mat-card class="form-drawer mat-elevation-z2" *ngIf="showClassDrawer">
        <div class="drawer-header">
          <div class="drawer-title">
            <mat-icon color="primary">{{ isEditingClass ? 'edit' : 'add_circle' }}</mat-icon>
            <div>
              <strong>{{ isEditingClass ? 'Edit School Class' : 'Create New School Class' }}</strong>
              <small>e.g. Nursery, UKG, Class 1st, Class 8th, Class 10th</small>
            </div>
          </div>
          <button mat-icon-button (click)="closeClassDrawer()">
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
      <mat-card class="form-drawer mat-elevation-z2" *ngIf="showSectionDrawer">
        <div class="drawer-header">
          <div class="drawer-title">
            <mat-icon color="accent">{{ isEditingSection ? 'edit' : 'view_stream' }}</mat-icon>
            <div>
              <strong>{{ isEditingSection ? 'Edit Section' : 'Add Section to Class' }}</strong>
              <small>e.g. Section A, Section B, Commerce, Science</small>
            </div>
          </div>
          <button mat-icon-button (click)="closeSectionDrawer()">
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
        <div class="class-card" *ngFor="let c of classes">
          <div class="class-card-header">
            <div class="class-title-wrap">
              <div class="class-badge">
                <mat-icon>school</mat-icon>
              </div>
              <div>
                <h3 class="class-name">{{ c.name }}</h3>
                <span class="class-code" *ngIf="c.code">Code: {{ c.code }}</span>
              </div>
            </div>

            <div class="class-actions">
              <button mat-icon-button color="primary" matTooltip="Add Section" (click)="quickAddSection(c)">
                <mat-icon>add_circle_outline</mat-icon>
              </button>
              <button mat-icon-button color="primary" matTooltip="Edit Class" (click)="editClass(c)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" matTooltip="Delete Class" (click)="deleteClass(c)">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
          </div>

          <div class="class-meta-bar">
            <span class="meta-tag">
              <mat-icon>groups</mat-icon>
              {{ c.studentCount }} Student{{ c.studentCount === 1 ? '' : 's' }}
            </span>
            <span class="meta-tag">
              <mat-icon>view_module</mat-icon>
              {{ c.sections?.length || 0 }} Section{{ (c.sections?.length || 0) === 1 ? '' : 's' }}
            </span>
          </div>

          <!-- Sections List in Class -->
          <div class="sections-list">
            <div class="section-pill" *ngFor="let s of c.sections">
              <div class="sec-details">
                <span class="sec-name">{{ s.name.startsWith('Section') ? s.name : 'Section ' + s.name }}</span>
                <small class="sec-meta">
                  {{ s.studentCount }} / {{ s.maxCapacity }} Students
                  <span *ngIf="s.roomNumber"> &bull; Room {{ s.roomNumber }}</span>
                </small>
              </div>
              <div class="sec-actions">
                <button mat-icon-button class="mini-btn" (click)="editSection(s)" matTooltip="Edit Section">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button class="mini-btn text-danger" (click)="deleteSection(s)" matTooltip="Delete Section">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
            </div>

            <div class="no-sections" *ngIf="!c.sections || c.sections.length === 0">
              <small>No sections declared yet. Click '+' to add Section A.</small>
            </div>
          </div>
        </div>
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

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .stat-card {
      background: #ffffff; border-radius: 12px; padding: 16px 18px; display: flex; align-items: center; gap: 14px;
      border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      .stat-icon {
        width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }
      .stat-info {
        .stat-val { display: block; font-size: 1.55rem; font-weight: 800; color: #0f172a; line-height: 1.1; }
        .stat-lbl { font-size: 0.76rem; font-weight: 600; color: #64748b; }
      }
      &.classes .stat-icon { background: #eff6ff; color: #2563eb; }
      &.sections .stat-icon { background: #fdf4ff; color: #c026d3; }
      &.school-students .stat-icon { background: #ecfdf5; color: #059669; }
      &.dual-students .stat-icon { background: #fff7ed; color: #ea580c; }
    }

    /* Drawers */
    .form-drawer {
      padding: 20px; border-radius: 12px; border: 1px solid #cbd5e1; background: #ffffff;
      display: flex; flex-direction: column; gap: 16px;
      .drawer-header {
        display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;
        .drawer-title {
          display: flex; align-items: center; gap: 10px;
          strong { font-size: 1.05rem; color: #0f172a; display: block; }
          small { color: #64748b; font-size: 0.82rem; }
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

    /* Classes Cards */
    .classes-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }
    .class-card {
      background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03); transition: transform 0.15s ease, box-shadow 0.15s ease;
      &:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
      
      .class-card-header {
        display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
        .class-title-wrap {
          display: flex; align-items: center; gap: 12px;
          .class-badge {
            width: 40px; height: 40px; border-radius: 10px; background: #eff6ff; color: #2563eb;
            display: flex; align-items: center; justify-content: center;
            mat-icon { font-size: 22px; width: 22px; height: 22px; }
          }
          .class-name { margin: 0; font-size: 1.15rem; font-weight: 700; color: #0f172a; }
          .class-code { font-size: 0.74rem; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 1px 6px; border-radius: 4px; }
        }
        .class-actions {
          display: flex;
          align-items: center;
          gap: 4px;

          button {
            width: 32px !important;
            height: 32px !important;
            min-width: 32px !important;
            padding: 0 !important;
            border-radius: 50% !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-shadow: none !important;
            overflow: hidden !important;
            position: relative !important;
            transition: background-color 0.15s ease, transform 0.1s ease !important;

            ::ng-deep .mat-mdc-button-touch-target {
              display: none !important;
            }

            ::ng-deep .mat-mdc-button-persistent-ripple,
            ::ng-deep .mat-ripple {
              border-radius: 50% !important;
            }

            mat-icon {
              font-size: 18px !important;
              width: 18px !important;
              height: 18px !important;
              line-height: 18px !important;
            }

            &:hover {
              background-color: #f1f5f9 !important;
            }
          }
        }
      }

      .class-meta-bar {
        display: flex; gap: 14px; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; margin-bottom: 14px;
        .meta-tag {
          display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; font-weight: 600; color: #475569;
          mat-icon { font-size: 16px; width: 16px; height: 16px; color: #64748b; }
        }
      }

      .sections-list {
        display: flex; flex-direction: column; gap: 8px;
        .section-pill {
          display: flex; justify-content: space-between; align-items: center; padding: 8px 12px;
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
          .sec-details {
            .sec-name { font-weight: 700; font-size: 0.88rem; color: #1e293b; display: block; }
            .sec-meta { font-size: 0.74rem; color: #64748b; }
          }
          .sec-actions {
            display: flex;
            align-items: center;
            gap: 4px;

            .mini-btn {
              width: 28px !important;
              height: 28px !important;
              min-width: 28px !important;
              padding: 0 !important;
              border-radius: 50% !important;
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              box-shadow: none !important;
              overflow: hidden !important;
              position: relative !important;
              transition: background-color 0.15s ease, transform 0.1s ease !important;

              ::ng-deep .mat-mdc-button-touch-target {
                display: none !important;
              }

              ::ng-deep .mat-mdc-button-persistent-ripple,
              ::ng-deep .mat-ripple {
                border-radius: 50% !important;
              }

              mat-icon {
                font-size: 16px !important;
                width: 16px !important;
                height: 16px !important;
                line-height: 16px !important;
                color: #64748b;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
              }

              &:hover {
                background-color: #e2e8f0 !important;
                mat-icon {
                  color: #0f172a;
                }
              }

              &.text-danger {
                mat-icon {
                  color: #ef4444;
                }
                &:hover {
                  background-color: #fee2e2 !important;
                  mat-icon {
                    color: #dc2626;
                  }
                }
              }
            }
          }
        }
        .no-sections { color: #94a3b8; font-size: 0.8rem; font-style: italic; padding: 6px 0; }
      }
    }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 20px;
      mat-icon { font-size: 60px; width: 60px; height: 60px; color: #cbd5e1; margin-bottom: 12px; }
      h3 { margin: 0 0 6px; font-size: 1.2rem; color: #1e293b; }
      p { margin: 0 0 20px; color: #64748b; font-size: 0.9rem; max-width: 480px; }
    }
  `]
})
export class SchoolClassesComponent implements OnInit {
  classes: SchoolClassDto[] = [];
  rooms: RoomDto[] = [];
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
  sectionFormData: any = {
    classId: '',
    name: '',
    maxCapacity: 45,
    roomId: null,
    isActive: true
  };

  constructor(
    private schoolService: SchoolService,
    private roomService: RoomService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.loadRooms();
    this.loadStats();
  }

  loadData(): void {
    this.loading = true;
    this.schoolService.getClasses(false).subscribe({
      next: (res) => {
        this.classes = res || [];
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
    this.sectionFormData = {
      classId: classId || (this.classes.length > 0 ? this.classes[0].id : ''),
      name: '',
      maxCapacity: 45,
      roomId: null,
      isActive: true
    };
    this.showSectionDrawer = true;
  }

  quickAddSection(c: SchoolClassDto): void {
    this.openAddSectionDrawer(c.id);
  }

  editSection(s: SchoolSectionDto): void {
    this.isEditingSection = true;
    this.editingSectionId = s.id;
    this.sectionFormData = {
      classId: s.classId,
      name: s.name,
      maxCapacity: s.maxCapacity,
      roomId: s.roomId || null,
      isActive: s.isActive
    };
    this.showSectionDrawer = true;
  }

  closeSectionDrawer(): void {
    this.showSectionDrawer = false;
    this.isEditingSection = false;
    this.editingSectionId = null;
  }

  saveSection(): void {
    if (!this.sectionFormData.name) return;
    this.saving = true;

    if (this.isEditingSection && this.editingSectionId) {
      this.schoolService.updateSection(this.editingSectionId, this.sectionFormData).subscribe({
        next: () => {
          this.saving = false;
          this.closeSectionDrawer();
          this.loadData();
          this.confirmDialog.alert('Section Updated', 'Section updated successfully.', 'success');
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
          this.closeSectionDrawer();
          this.loadData();
          this.confirmDialog.alert('Section Added', 'New section assigned to class successfully.', 'success');
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
