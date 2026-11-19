import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { BatchesService, BatchDto } from '../../core/services/batches.service';
import { CoachingService } from '../../core/services/coaching.service';
import { SchoolService } from '../../core/services/school.service';
import { SectionRoutineDialogComponent } from '../school/section-routine-dialog.component';
import { environment } from '../../../environments/environment';

export interface ClassOption {
  id: string;
  name: string;
}

export interface RoutineSlot {
  id: string;
  dayOfWeek?: string;
  daysOfWeek?: string;
  periodNumber?: number;
  periodName?: string;
  timeSlot?: string;
  startTime?: string;
  endTime?: string;
  subjectName: string;
  teacherName?: string;
  teacherCode?: string;
  roomNumber?: string;
}

@Component({
  selector: 'app-coaching-timetable',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatDialogModule
  ],
  template: `
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="title-area">
          <div class="header-icon-box">
            <mat-icon>calendar_view_week</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Batch Timetable & Routine (बैच समय सारणी)</h1>
            <p class="page-subtitle">Manage weekly class routine, periods, subjects, and faculty lecture schedules with Class ➔ Batch cascade.</p>
          </div>
        </div>
        <div class="header-actions">
          @if (selectedBatch) {
            <button mat-flat-button color="primary" class="action-btn" (click)="openRoutineEditor()">
              <mat-icon>edit_calendar</mat-icon> Edit Batch Routine
            </button>
          }
        </div>
      </div>

      <!-- Single Prominent Loading Bar -->
      @if (loading) {
        <mat-progress-bar mode="indeterminate" class="global-loader"></mat-progress-bar>
      }

      <!-- Cascading Filter Deck (Class ➔ Batches) -->
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
                <mat-option disabled>No batches available for selected class</mat-option>
              }
              @for (b of filteredBatches; track b.id) {
                <mat-option [value]="b.id">
                  <strong>{{ b.name }}</strong> ({{ b.subject || 'All Subjects' }} • {{ b.shift || 'General' }})
                </mat-option>
              }
            </mat-select>
          </mat-form-field>

          <!-- Day Filter -->
          <mat-form-field appearance="outline" class="filter-control day-control">
            <mat-label>Day of Week</mat-label>
            <mat-select formControlName="dayOfWeek" (selectionChange)="onDayFilterChange()">
              <mat-option value="">All Days (Mon - Sun)</mat-option>
              @for (d of daysOfWeek; track d) {
                <mat-option [value]="d">{{ d }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </form>

        <!-- Selected Batch Meta Details -->
        @if (selectedBatch) {
          <div class="batch-meta-strip">
            <div class="meta-pill">
              <mat-icon>class</mat-icon>
              <span>Batch: <strong>{{ selectedBatch.name }}</strong></span>
            </div>
            @if (selectedBatch.mentorTeacherName) {
              <div class="meta-pill mentor-pill">
                <mat-icon>person</mat-icon>
                <span>Mentor: <strong>{{ selectedBatch.mentorTeacherName }}</strong></span>
              </div>
            }
            <div class="meta-pill">
              <mat-icon>schedule</mat-icon>
              <span>Shift: <strong>{{ selectedBatch.shift || 'General' }}</strong> ({{ selectedBatch.startTime || '08:00' }} - {{ selectedBatch.endTime || '12:00' }})</span>
            </div>
            <div class="meta-pill count-pill">
              <mat-icon>view_agenda</mat-icon>
              <span>Total Periods Scheduled: <strong>{{ routineSlots.length }}</strong></span>
            </div>
          </div>
        }
      </mat-card>

      <!-- Routine Workspace: Weekly Schedule View -->
      @if (selectedBatchId) {
        @if (displayDays.length === 0 || routineSlots.length === 0) {
          <mat-card class="notice-card mat-elevation-z1">
            <mat-icon class="notice-icon">event_busy</mat-icon>
            <h3>No Timetable Configured for {{ selectedBatch?.name }}</h3>
            <p>You can set up weekly lecture schedules, assign faculty, and define subject periods for this batch.</p>
            <button mat-flat-button color="primary" (click)="openRoutineEditor()">
              <mat-icon>add</mat-icon> Create Batch Routine
            </button>
          </mat-card>
        } @else {
          <div class="weekly-schedule-container">
            @for (day of displayDays; track day) {
              <mat-card class="day-card mat-elevation-z1" [class.is-sunday-card]="day === 'Sunday' && getSlotsForDay(day).length === 0">
                <div class="day-header">
                  <div class="day-title">
                    <mat-icon class="day-icon" [class.sun-ic]="day === 'Sunday'">{{ day === 'Sunday' ? 'weekend' : 'today' }}</mat-icon>
                    <h3>
                      {{ day }}
                      @if (day === 'Sunday') {
                        <span class="hindi-day">(रविवार)</span>
                      }
                    </h3>
                  </div>
                  @if (day === 'Sunday' && getSlotsForDay(day).length === 0) {
                    <span class="day-count-badge weekly-off-badge">
                      <mat-icon class="badge-mini-ic">beach_access</mat-icon> Weekly Off (साप्ताहिक अवकाश)
                    </span>
                  } @else {
                    <span class="day-count-badge">{{ getSlotsForDay(day).length }} {{ getSlotsForDay(day).length === 1 ? 'Period' : 'Periods' }}</span>
                  }
                </div>

                <div class="slots-grid">
                  @if (getSlotsForDay(day).length === 0) {
                    @if (day === 'Sunday') {
                      <div class="no-slot-box sunday-off-box">
                        <div class="sunday-off-content">
                          <div class="off-icon-circle">
                            <mat-icon>beach_access</mat-icon>
                          </div>
                          <div class="off-text-wrap">
                            <h4>Sunday — Weekly Off (साप्ताहिक अवकाश)</h4>
                            <p>No regular classes scheduled on Sundays. Any special doubt sessions, mock tests, or extra lectures will automatically display here when scheduled.</p>
                          </div>
                        </div>
                      </div>
                    } @else {
                      <div class="no-slot-box">
                        <mat-icon>event_note</mat-icon>
                        <span>No periods scheduled for {{ day }}</span>
                      </div>
                    }
                  } @else {
                    @for (slot of getSlotsForDay(day); track slot.id; let idx = $index) {
                      <div class="slot-item-card">
                        <div class="slot-time-strip">
                          <span class="slot-period-tag">P{{ slot.periodNumber || (idx + 1) }}</span>
                          <span class="slot-time-text">{{ slot.timeSlot || (slot.startTime ? (slot.startTime + ' - ' + slot.endTime) : 'Scheduled') }}</span>
                        </div>
                        <div class="slot-body">
                          <h4 class="slot-subject">{{ slot.subjectName }}</h4>
                          <div class="slot-faculty">
                            <mat-icon>school</mat-icon>
                            <span>{{ slot.teacherName || 'Faculty Assigned' }}</span>
                            @if (slot.teacherCode) {
                              <small class="t-code">({{ slot.teacherCode }})</small>
                            }
                          </div>
                          @if (slot.daysOfWeek) {
                            <div class="slot-days-tag">
                              <mat-icon>date_range</mat-icon>
                              <span>{{ slot.daysOfWeek }}</span>
                            </div>
                          }
                          @if (slot.roomNumber) {
                            <div class="slot-room">
                              <mat-icon>meeting_room</mat-icon>
                              <span>Room: {{ slot.roomNumber }}</span>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  }
                </div>
              </mat-card>
            }
          </div>
        }
      } @else {
        <mat-card class="notice-card mat-elevation-z1">
          <mat-icon class="notice-icon">touch_app</mat-icon>
          <h3>Please Select an Academic Class and Coaching Batch</h3>
          <p>Select a coaching batch from the filter deck above to view or customize its weekly timetable schedule.</p>
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
      mat-icon { margin-right: 6px; }
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

    .day-control {
      flex: 1 1 200px;
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

    .mentor-pill {
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

    .weekly-schedule-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .day-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 16px 20px;
      transition: all 0.2s ease;

      &.is-sunday-card {
        border-color: #fed7aa;
        background: #fffdfb;
      }
    }

    .day-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }

    .day-title {
      display: flex;
      align-items: center;
      gap: 8px;
      h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
        color: #1e3a8a;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .day-icon {
        color: #2563eb;
        font-size: 20px;
        width: 20px;
        height: 20px;
        &.sun-ic { color: #ea580c; }
      }
      .hindi-day {
        font-size: 0.84rem;
        font-weight: 600;
        color: #ea580c;
      }
    }

    .day-count-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 12px;
      background: #f1f5f9;
      color: #475569;
      font-size: 0.76rem;
      font-weight: 600;
      border: 1px solid #cbd5e1;

      &.weekly-off-badge {
        background: #fff7ed;
        color: #c2410c;
        border-color: #fed7aa;
        font-weight: 700;
      }

      .badge-mini-ic {
        font-size: 14px;
        width: 14px;
        height: 14px;
        margin-right: 4px;
        color: #ea580c;
      }
    }

    .slots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 420px));
      gap: 16px;
      width: 100%;
      box-sizing: border-box;
    }

    .slot-item-card {
      border-radius: 12px;
      border: 1.5px solid #e2e8f0;
      background: #ffffff;
      overflow: hidden;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

      &:hover {
        border-color: #93c5fd;
        box-shadow: 0 4px 10px -1px rgba(37, 99, 235, 0.12);
        transform: translateY(-1px);
      }
    }

    .slot-time-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 14px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }

    .slot-period-tag {
      font-weight: 800;
      font-size: 0.78rem;
      color: #1e40af;
      background: #ffffff;
      padding: 2px 8px;
      border-radius: 6px;
      border: 1px solid #bfdbfe;
      box-shadow: 0 1px 2px rgba(30, 64, 175, 0.08);
    }

    .slot-time-text {
      font-size: 0.82rem;
      font-weight: 700;
      color: #1e40af;
      letter-spacing: 0.2px;
    }

    .slot-body {
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .slot-subject {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.3;
    }

    .slot-faculty {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.86rem;
      font-weight: 600;
      color: #334155;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; flex-shrink: 0; }
    }

    .t-code {
      color: #64748b;
      font-size: 0.78rem;
      font-weight: 500;
      margin-left: 4px;
    }

    .slot-days-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #e2e8f0;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.76rem;
      font-weight: 600;
      width: fit-content;
      margin-top: 2px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: #2563eb; }
    }

    .slot-room {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      color: #64748b;
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: #64748b; }
    }

    .no-slot-box {
      grid-column: 1 / -1;
      padding: 20px;
      text-align: center;
      color: #94a3b8;
      font-size: 0.84rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }

    .sunday-off-box {
      grid-column: 1 / -1;
      background: linear-gradient(135deg, #fff7ed 0%, #fff1f2 100%) !important;
      border: 1.5px dashed #fed7aa !important;
      border-radius: 12px;
      padding: 18px 22px !important;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      text-align: left;
    }

    .sunday-off-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .off-icon-circle {
      width: 46px;
      height: 46px;
      border-radius: 12px;
      background: #ffedd5;
      color: #ea580c;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 4px rgba(234, 88, 12, 0.15);
      mat-icon { font-size: 26px; width: 26px; height: 26px; }
    }

    .off-text-wrap {
      display: flex;
      flex-direction: column;
      gap: 4px;
      h4 {
        margin: 0;
        font-size: 0.98rem;
        font-weight: 700;
        color: #9a3412;
      }
      p {
        margin: 0;
        font-size: 0.82rem;
        color: #7c2d12;
        opacity: 0.88;
        line-height: 1.4;
      }
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
      p { font-size: 0.88rem; max-width: 500px; margin: 0 auto 16px; line-height: 1.5; }
    }

    @media (max-width: 768px) {
      .filter-control {
        flex: 1 1 100%;
      }
      .slots-grid {
        grid-template-columns: 1fr;
      }
      .sunday-off-content {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachingTimetableComponent implements OnInit {
  filterForm: FormGroup;
  classes: ClassOption[] = [];
  allBatches: BatchDto[] = [];
  filteredBatches: BatchDto[] = [];
  selectedBatch: BatchDto | null = null;
  selectedBatchId: string = '';

  daysOfWeek: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  routineSlots: RoutineSlot[] = [];
  loading = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private batchesService: BatchesService,
    private schoolService: SchoolService,
    private coachingService: CoachingService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {
    this.filterForm = this.fb.group({
      classId: [''],
      batchId: [''],
      dayOfWeek: ['']
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
    this.routineSlots = [];
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
    if (batchId) {
      this.loadRoutine(batchId);
    } else {
      this.routineSlots = [];
    }
    this.cdr.markForCheck();
  }

  onDayFilterChange(): void {
    this.cdr.markForCheck();
  }

  private dayAbbrMap: { [key: string]: string } = {
    mon: 'monday',
    monday: 'monday',
    som: 'monday',
    somwar: 'monday',
    tue: 'tuesday',
    tuesday: 'tuesday',
    mangal: 'tuesday',
    mangalwar: 'tuesday',
    wed: 'wednesday',
    wednesday: 'wednesday',
    budh: 'wednesday',
    budhwar: 'wednesday',
    thu: 'thursday',
    thursday: 'thursday',
    guru: 'thursday',
    guruwar: 'thursday',
    brihaspati: 'thursday',
    fri: 'friday',
    friday: 'friday',
    shukra: 'friday',
    shukrawar: 'friday',
    sat: 'saturday',
    saturday: 'saturday',
    shani: 'saturday',
    shaniwar: 'saturday',
    sun: 'sunday',
    sunday: 'sunday',
    ravi: 'sunday',
    raviwar: 'sunday'
  };

  loadRoutine(batchId: string): void {
    this.loading = true;
    this.batchesService.getBatchRoutine(batchId).subscribe({
      next: (res: any[]) => {
        this.routineSlots = (res || []).map((r: any, idx: number) => {
          const timeSlotStr = r.timeSlot || (r.startTime && r.endTime ? `${r.startTime} - ${r.endTime}` : (r.startTime || ''));
          return {
            id: r.id,
            daysOfWeek: r.daysOfWeek || r.dayOfWeek || 'All Days',
            dayOfWeek: r.dayOfWeek,
            periodNumber: r.periodNumber || (idx + 1),
            periodName: r.periodName,
            timeSlot: timeSlotStr,
            startTime: r.startTime,
            endTime: r.endTime,
            subjectName: r.subject || r.subjectName || 'Subject',
            teacherName: r.teacherName || r.teacherFullName,
            teacherCode: r.teacherEmployeeCode,
            roomNumber: r.roomNumber
          };
        });
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get displayDays(): string[] {
    const selectedDay = this.filterForm.get('dayOfWeek')?.value;
    if (selectedDay) {
      return [selectedDay];
    }
    return this.daysOfWeek;
  }

  getSlotsForDay(day: string): RoutineSlot[] {
    return this.routineSlots
      .filter(s => this.slotMatchesDay(s.daysOfWeek || s.dayOfWeek, day))
      .sort((a, b) => this.compareTimeSlots(a.timeSlot, b.timeSlot));
  }

  slotMatchesDay(daysOfWeekStr?: string, day?: string): boolean {
    if (!day) return false;
    const targetDay = day.trim().toLowerCase();
    if (!daysOfWeekStr || !daysOfWeekStr.trim()) return true;

    const raw = daysOfWeekStr.trim().toLowerCase();

    // Universal matches
    if (raw.includes('all') || raw.includes('daily') || raw === 'everyday') {
      return true;
    }

    // Mon - Sat range
    if (raw.includes('mon') && raw.includes('sat') && (raw.includes('-') || raw.includes('to'))) {
      return targetDay !== 'sunday';
    }

    // Mon - Fri range
    if (raw.includes('mon') && raw.includes('fri') && (raw.includes('-') || raw.includes('to'))) {
      return targetDay !== 'saturday' && targetDay !== 'sunday';
    }

    // Split by comma, slash, semicolon, or whitespace
    const tokens = raw.split(/[,/;\s]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
    for (const token of tokens) {
      const mapped = this.dayAbbrMap[token] || (token.length >= 3 ? this.dayAbbrMap[token.substring(0, 3)] : null);
      if (mapped === targetDay || token === targetDay || (token.length >= 3 && targetDay.startsWith(token.substring(0, 3)))) {
        return true;
      }
    }
    return false;
  }

  compareTimeSlots(slotA?: string, slotB?: string): number {
    if (!slotA && !slotB) return 0;
    if (!slotA) return 1;
    if (!slotB) return -1;
    return slotA.localeCompare(slotB);
  }

  openRoutineEditor(): void {
    if (!this.selectedBatch) return;

    this.coachingService.getTeachers().subscribe({
      next: teachersList => {
        const dialogRef = this.dialog.open(SectionRoutineDialogComponent, {
          width: '1180px',
          maxWidth: '96vw',
          maxHeight: '92vh',
          panelClass: 'erp-custom-dialog',
          autoFocus: false,
          data: {
            batchId: this.selectedBatch!.id,
            batchName: this.selectedBatch!.name,
            classId: this.selectedBatch!.classId,
            className: this.selectedBatch!.className,
            branchId: this.selectedBatch!.branchId,
            mentorTeacherId: this.selectedBatch!.mentorTeacherId,
            mentorTeacherName: this.selectedBatch!.mentorTeacherName,
            batchSubjects: this.selectedBatch!.subject,
            teachers: teachersList || []
          }
        });

        dialogRef.afterClosed().subscribe(() => {
          if (this.selectedBatchId) {
            this.loadRoutine(this.selectedBatchId);
          }
        });
      },
      error: () => {}
    });
  }
}
