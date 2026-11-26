import { Component, Inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

export interface CoachingExamSeatingDialogData {
  testId: string;
  title: string;
  subject: string;
  batchName?: string;
  testDate?: string;
  canEdit: boolean;
  divisionMode?: 'school' | 'coaching';
}

interface SeatRow {
  id: string;
  hallAllocationId: string;
  roomId?: string;
  roomName: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  parentPhone?: string;
  seatNumber: string;
  benchNumber: number;
  attendanceStatus: 'Scheduled' | 'Present' | 'Absent' | string;
}

interface HallRow {
  id: string;
  roomId?: string;
  roomName: string;
  capacity: number;
  invigilatorTeacherId?: string;
  invigilatorName?: string;
  examStartTime?: string;
  examEndTime?: string;
}

@Component({
  selector: 'app-coaching-exam-seating-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="seating-dialog">
      <!-- Strict Light-Blue Gradient ERP Dialog Header -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>event_seat</mat-icon>
          </div>
          <div class="header-titles">
            <div class="title-row">
              <h2 class="dialog-title">Exam Hall, Seating Plan &amp; Invigilator Allocation</h2>
              @if (seats.length > 0) {
                <span class="allocated-badge">{{ seats.length }} Seats Allocated</span>
              }
            </div>
            <p class="dialog-subtitle">
              Exam: <strong>{{ data.title }}</strong>
              @if (data.batchName) { &bull; {{ data.divisionMode === 'school' ? 'Class' : 'Batch' }}: <strong>{{ data.batchName }}</strong> }
              &bull; Enrolled Students: <strong>{{ enrolledCount }}</strong>
            </p>
          </div>
        </div>
        <button type="button" mat-icon-button class="close-btn" [disabled]="loading" (click)="close()" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Single Prominent Overlay Loader (AGENTS.md Strict Single Loader Rule) -->
      @if (loading) {
        <div class="overlay-loader">
          <div class="overlay-card">
            <mat-spinner diameter="40"></mat-spinner>
            <div class="overlay-text">{{ loadingMessage || 'Processing exam seating...' }}</div>
          </div>
        </div>
      }

      <!-- Tabs -->
      <div class="studio-tabs">
        <button type="button" class="studio-tab" [class.active]="activeTab === 'halls'" (click)="activeTab = 'halls'">
          <mat-icon>meeting_room</mat-icon>
          <span>1. Hall &amp; Invigilator Setup</span>
        </button>
        <button type="button" class="studio-tab" [class.active]="activeTab === 'seats'" [disabled]="seats.length === 0" (click)="activeTab = 'seats'">
          <mat-icon>fact_check</mat-icon>
          <span>2. Seating &amp; Hall Attendance ({{ seats.length }})</span>
        </button>
        <button type="button" class="studio-tab" [class.active]="activeTab === 'print'" [disabled]="seats.length === 0" (click)="activeTab = 'print'">
          <mat-icon>print</mat-icon>
          <span>3. Print Charts &amp; Attendance Sheets</span>
        </button>
      </div>

      <mat-dialog-content class="dialog-body">
        <!-- TAB 1: HALL & INVIGILATOR SETUP -->
        @if (activeTab === 'halls') {
          <form [formGroup]="setupForm" class="setup-layout">
            <div class="capacity-banner" [class.insufficient]="totalHallCapacity < enrolledCount">
              <div class="cap-left">
                <mat-icon>{{ totalHallCapacity >= enrolledCount ? 'check_circle' : 'warning' }}</mat-icon>
                <span>
                  Enrolled Students: <strong>{{ enrolledCount }}</strong> &bull;
                  Selected Hall Capacity: <strong>{{ totalHallCapacity }}</strong>
                  @if (totalHallCapacity < enrolledCount) {
                    (Add {{ enrolledCount - totalHallCapacity }} more seats)
                  } @else {
                    (Ready for Auto-Allocation &amp; Admit Card Sync)
                  }
                </span>
              </div>
              <button type="button" mat-stroked-button color="primary" (click)="addHallRow()" [disabled]="!data.canEdit">
                <mat-icon>add</mat-icon> Add Exam Hall
              </button>
            </div>

            <div class="meta-grid">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Exam Start Time</mat-label>
                <input matInput type="time" formControlName="examStartTime" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Exam End Time</mat-label>
                <input matInput type="time" formControlName="examEndTime" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Seat Allocation Order</mat-label>
                <mat-select formControlName="orderBy">
                  <mat-option value="RollNo">{{ data.divisionMode === 'school' ? 'School Roll No Order (Recommended)' : 'Coaching Roll No Order (Recommended)' }}</mat-option>
                  <mat-option value="Name">Alphabetical (Student Name)</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div formArrayName="halls" class="halls-list">
              @for (ctrl of hallsArray.controls; track $index; let idx = $index) {
                <div [formGroupName]="idx" class="hall-row-card">
                  <div class="hall-badge">H{{ idx + 1 }}</div>

                  @if (rooms.length > 0) {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="f-room-pick">
                      <mat-label>Pick Room Master (Optional)</mat-label>
                      <mat-select formControlName="roomId" (selectionChange)="onRoomPicked(idx, $event.value)">
                        <mat-option [value]="''">-- Custom Hall Name --</mat-option>
                        @for (r of rooms; track r.id) {
                          <mat-option [value]="r.id">{{ r.roomNumber }} (Cap: {{ r.capacity }})</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  }

                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="f-room-name">
                    <mat-label>Hall / Room Name *</mat-label>
                    <input matInput formControlName="roomName" placeholder="e.g., Hall A / Room 101" />
                  </mat-form-field>

                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="f-cap">
                    <mat-label>Seats *</mat-label>
                    <input matInput type="number" formControlName="capacity" min="1" max="500" />
                  </mat-form-field>

                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="f-invig">
                    <mat-label>Invigilator Teacher</mat-label>
                    <mat-select formControlName="invigilatorTeacherId" (selectionChange)="onInvigilatorPicked(idx, $event.value)">
                      <mat-option [value]="''">-- Unassigned --</mat-option>
                      @for (t of teachers; track t.id) {
                        <mat-option [value]="t.id">{{ t.fullName }} ({{ t.employeeCode }})</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  @if (hallsArray.length > 1 && data.canEdit) {
                    <button type="button" mat-icon-button color="warn" (click)="removeHallRow(idx)" matTooltip="Remove Hall">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  }
                </div>
              }
            </div>

            <div class="action-bar-right">
              <button
                type="button"
                mat-flat-button
                color="primary"
                class="allocate-btn"
                [disabled]="loading || !data.canEdit || enrolledCount === 0 || totalHallCapacity < enrolledCount"
                (click)="autoAllocate()">
                <mat-icon>auto_fix_high</mat-icon>
                <span>{{ seats.length > 0 ? 'Re-Allocate Seats & Sync Admit Cards' : 'Auto-Allocate Seats & Sync Admit Cards' }}</span>
              </button>
            </div>
          </form>
        }

        <!-- TAB 2: SEATING PLAN & HALL ATTENDANCE -->
        @if (activeTab === 'seats') {
          <div class="seats-layout">
            <div class="att-toolbar">
              <div class="att-stats">
                <span class="stat-chip total">Total: {{ seats.length }}</span>
                <span class="stat-chip present">Present: {{ presentSeatCount }}</span>
                <span class="stat-chip absent">Absent: {{ absentSeatCount }}</span>
              </div>
              @if (data.canEdit) {
                <div class="att-btns">
                  <button type="button" mat-stroked-button (click)="markAllExamStatus('Present')">
                    <mat-icon>done_all</mat-icon> Mark All Present
                  </button>
                  <button type="button" mat-flat-button color="primary" (click)="saveExamAttendance()" [disabled]="loading">
                    <mat-icon>save</mat-icon> Save Attendance &amp; Sync Copy Bundle
                  </button>
                </div>
              }
            </div>

            @for (group of groupedByHall; track group.roomName) {
              <div class="hall-group-card">
                <div class="hall-group-head">
                  <div>
                    <strong>{{ group.roomName }}</strong>
                    <span class="hall-sub"> &bull; {{ group.seats.length }} Students</span>
                    @if (group.invigilatorName) {
                      <span class="hall-sub"> &bull; Invigilator: <strong>{{ group.invigilatorName }}</strong></span>
                    }
                  </div>
                </div>

                <div class="table-responsive">
                  <table class="seat-table">
                    <thead>
                      <tr>
                        <th>Seat No</th>
                        <th>Bench</th>
                        <th>{{ data.divisionMode === 'school' ? 'Roll / Adm No' : 'Coaching Roll' }}</th>
                        <th>Student Name</th>
                        <th>Exam Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (s of group.seats; track s.studentId) {
                        <tr>
                          <td><span class="seat-pill">{{ s.seatNumber }}</span></td>
                          <td>Bench #{{ s.benchNumber }}</td>
                          <td><code>{{ s.rollNumber || '—' }}</code></td>
                          <td><strong>{{ s.studentName }}</strong></td>
                          <td>
                            <div class="att-toggle-group">
                              <button
                                type="button"
                                class="att-btn"
                                [disabled]="!data.canEdit"
                                [class.active-present]="s.attendanceStatus === 'Present'"
                                (click)="setSeatAttendance(s, 'Present')">Present</button>
                              <button
                                type="button"
                                class="att-btn"
                                [disabled]="!data.canEdit"
                                [class.active-absent]="s.attendanceStatus === 'Absent'"
                                (click)="setSeatAttendance(s, 'Absent')">Absent</button>
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </div>
        }

        <!-- TAB 3: PRINTABLE SEATING CHART & HALL ATTENDANCE SHEET -->
        @if (activeTab === 'print') {
          <div class="print-cards-grid">
            <div class="print-option-card">
              <div class="po-icon blue"><mat-icon>grid_view</mat-icon></div>
              <h3>Notice Board Seating Chart (A4)</h3>
              <p>Room-wise seat allocation list with Seat No, Coaching Roll, Student Name, and Invigilator duty for pasting on Notice Board &amp; Room Doors.</p>
              <button type="button" mat-flat-button color="primary" (click)="printSeatingDocument(false)">
                <mat-icon>print</mat-icon> Print Seating Chart
              </button>
            </div>

            <div class="print-option-card">
              <div class="po-icon green"><mat-icon>edit_document</mat-icon></div>
              <h3>Room-Wise Exam Attendance Sheet (A4)</h3>
              <p>Invigilator signature sheet with Seat No, Roll No, Student Name, Answer Sheet Booklet No, and Student Signature box (1 page per Hall).</p>
              <button type="button" mat-flat-button color="primary" (click)="printSeatingDocument(true)">
                <mat-icon>print</mat-icon> Print Attendance Sheet
              </button>
            </div>
          </div>

          <div class="admit-sync-note">
            <mat-icon>confirmation_number</mat-icon>
            <span><strong>Admit Cards Auto-Synced:</strong> Hall Name &amp; Seat Number are automatically embedded when you click <em>Generate Admit Cards</em> from the Tests action menu!</span>
          </div>
        }
      </mat-dialog-content>

      <div class="dialog-footer">
        <span class="footer-note">
          <mat-icon>sync</mat-icon> Synced with Admit Cards &amp; Copy Bundle Handover
        </span>
        <button type="button" mat-stroked-button [disabled]="loading" (click)="close()">Close</button>
      </div>
    </div>
  `,
  styles: [`
    .seating-dialog {
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 90vh;
      background: #f8fafc;
    }

    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header-icon-box {
      width: 42px; height: 42px; border-radius: 10px;
      background: #2563eb; color: #ffffff;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
    }
    .title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .dialog-title { margin: 0; font-size: 1.1rem; font-weight: 700; color: #1e3a8a; }
    .dialog-subtitle { margin: 2px 0 0; font-size: 0.8rem; color: #3b82f6; strong { color: #1e40af; } }
    .allocated-badge {
      background: #dcfce7; color: #15803d; font-size: 0.72rem; font-weight: 700;
      padding: 2px 10px; border-radius: 12px;
    }
    .close-btn { color: #64748b; &:hover { color: #1e293b; } }

    .overlay-loader {
      position: absolute; inset: 0; z-index: 50;
      background: rgba(248, 250, 252, 0.85); backdrop-filter: blur(2px);
      display: flex; align-items: center; justify-content: center;
    }
    .overlay-card {
      background: #ffffff; border: 1px solid #bfdbfe; border-radius: 14px;
      padding: 24px 32px; display: flex; flex-direction: column; align-items: center; gap: 12px;
      box-shadow: 0 12px 30px rgba(30, 58, 138, 0.16);
    }
    .overlay-text { font-size: 0.9rem; font-weight: 600; color: #1e3a8a; }

    .studio-tabs {
      display: flex; gap: 6px; padding: 10px 20px 0;
      background: #ffffff; border-bottom: 1px solid #e2e8f0; overflow-x: auto;
    }
    .studio-tab {
      display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px;
      border: none; border-bottom: 2.5px solid transparent; background: transparent;
      color: #64748b; font-size: 0.84rem; font-weight: 600; cursor: pointer; white-space: nowrap;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &.active { color: #1d4ed8; border-bottom-color: #2563eb; }
      &:disabled { opacity: 0.45; cursor: not-allowed; }
    }

    .dialog-body {
      flex: 1; overflow-y: auto; padding: 18px 20px !important; margin: 0 !important; max-height: none !important;
    }

    .setup-layout, .seats-layout { display: flex; flex-direction: column; gap: 14px; }
    .capacity-banner {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
      padding: 10px 14px; border-radius: 10px;
      background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; font-size: 0.84rem;
      &.insufficient { background: #fffbeb; border-color: #fde68a; color: #92400e; }
      .cap-left { display: flex; align-items: center; gap: 8px; }
    }
    .meta-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;
    }
    .halls-list { display: flex; flex-direction: column; gap: 10px; }
    .hall-row-card {
      background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;
      display: flex; align-items: center; flex-wrap: wrap; gap: 10px;
    }
    .hall-badge {
      background: #1e3a8a; color: #ffffff; font-weight: 700; font-size: 0.78rem;
      width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .f-room-pick { flex: 1 1 180px; }
    .f-room-name { flex: 1 1 180px; }
    .f-cap { width: 100px; }
    .f-invig { flex: 1 1 200px; }

    .action-bar-right { display: flex; justify-content: flex-end; }
    .allocate-btn { height: 42px; padding: 0 20px; border-radius: 10px; font-weight: 700; }

    .att-toolbar {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
      background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px;
    }
    .att-stats, .att-btns { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    .stat-chip {
      padding: 4px 10px; border-radius: 8px; font-size: 0.78rem; font-weight: 700;
      &.total { background: #f1f5f9; color: #334155; }
      &.present { background: #dcfce7; color: #15803d; }
      &.absent { background: #fee2e2; color: #b91c1c; }
    }

    .hall-group-card {
      background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;
    }
    .hall-group-head {
      background: #eff6ff; border-bottom: 1px solid #bfdbfe; padding: 10px 14px;
      font-size: 0.88rem; color: #1e3a8a;
      .hall-sub { font-size: 0.8rem; color: #3b82f6; }
    }
    .table-responsive { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .seat-table {
      width: 100%; border-collapse: collapse; font-size: 0.84rem;
      th, td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; text-align: left; white-space: nowrap; }
      th { background: #f8fafc; font-weight: 700; color: #475569; font-size: 0.78rem; text-transform: uppercase; }
    }
    .seat-pill {
      background: #dbeafe; color: #1e40af; font-weight: 700; font-size: 0.76rem;
      padding: 2px 9px; border-radius: 6px;
    }
    .att-toggle-group { display: inline-flex; gap: 6px; }
    .att-btn {
      padding: 4px 12px; border-radius: 6px; border: 1px solid #cbd5e1;
      background: #ffffff; color: #475569; font-size: 0.76rem; font-weight: 600; cursor: pointer;
      &.active-present { background: #16a34a; border-color: #16a34a; color: #ffffff; }
      &.active-absent { background: #dc2626; border-color: #dc2626; color: #ffffff; }
      &:disabled { opacity: 0.6; cursor: not-allowed; }
    }

    .print-cards-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;
    }
    .print-option-card {
      background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;
      display: flex; flex-direction: column; gap: 10px;
      h3 { margin: 0; font-size: 1rem; color: #1e3a8a; }
      p { margin: 0; font-size: 0.82rem; color: #64748b; line-height: 1.5; flex: 1; }
    }
    .po-icon {
      width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
      &.blue { background: #eff6ff; color: #2563eb; }
      &.green { background: #f0fdf4; color: #16a34a; }
    }
    .admit-sync-note {
      margin-top: 16px; display: flex; align-items: center; gap: 10px; padding: 12px 14px;
      background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; color: #1e40af; font-size: 0.82rem;
    }

    .dialog-footer {
      padding: 10px 20px; background: #ffffff; border-top: 1px solid #e2e8f0;
      display: flex; align-items: center; justify-content: space-between;
    }
    .footer-note {
      display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem; color: #64748b;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }
    }
  `]
})
export class CoachingExamSeatingDialogComponent implements OnInit {
  activeTab: 'halls' | 'seats' | 'print' = 'halls';
  private _loading = false;
  get loading(): boolean { return this._loading; }
  set loading(val: boolean) {
    this._loading = val;
    if (this.dialogRef) this.dialogRef.disableClose = val;
  }
  loadingMessage = '';
  changed = false;

  enrolledCount = 0;
  rooms: any[] = [];
  teachers: any[] = [];
  halls: HallRow[] = [];
  seats: SeatRow[] = [];

  setupForm: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<CoachingExamSeatingDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CoachingExamSeatingDialogData,
    private fb: FormBuilder,
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.setupForm = this.fb.group({
      examStartTime: ['09:00'],
      examEndTime: ['10:30'],
      orderBy: ['RollNo'],
      halls: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.loadSeating();
  }

  get hallsArray(): FormArray {
    return this.setupForm.get('halls') as FormArray;
  }

  get totalHallCapacity(): number {
    return this.hallsArray.controls.reduce((sum, c) => sum + (Number(c.get('capacity')?.value) || 0), 0);
  }

  get presentSeatCount(): number {
    return this.seats.filter(s => s.attendanceStatus === 'Present').length;
  }

  get absentSeatCount(): number {
    return this.seats.filter(s => s.attendanceStatus === 'Absent').length;
  }

  get groupedByHall(): { roomName: string; invigilatorName: string; seats: SeatRow[] }[] {
    const map = new Map<string, SeatRow[]>();
    for (const s of this.seats) {
      if (!map.has(s.roomName)) map.set(s.roomName, []);
      map.get(s.roomName)!.push(s);
    }
    return Array.from(map.entries()).map(([roomName, list]) => {
      const hallMeta = this.halls.find(h => h.roomName === roomName);
      return { roomName, invigilatorName: hallMeta?.invigilatorName || '', seats: list };
    });
  }

  loadSeating(): void {
    this.loading = true;
    this.loadingMessage = 'Loading exam halls & seating plan...';
    this.http.get<any>(`${environment.apiUrl}/coaching-ai-exam/tests/${this.data.testId}/seating`).subscribe({
      next: res => {
        this.loading = false;
        this.loadingMessage = '';
        this.enrolledCount = res?.enrolledCount || 0;
        this.rooms = res?.rooms || [];
        this.teachers = (res?.teachers || []).filter((t: any) => {
          const st = String(t.staffType || '').toLowerCase();
          if (st && st !== 'teaching' && st !== '1') return false;
          const meta = `${t.fullName || ''} ${t.department || ''} ${t.designation || ''} ${t.employeeCode || ''}`;
          return !/\b(accountant|accounts|acc-|clerk|peon|driver|guard|security|librarian|helper|sweeper|reception|warden|supervisor)\b/i.test(meta);
        });
        this.halls = res?.halls || [];
        this.seats = res?.seats || [];

        this.hallsArray.clear();
        if (this.halls.length > 0) {
          this.setupForm.patchValue({
            examStartTime: this.halls[0].examStartTime || '09:00',
            examEndTime: this.halls[0].examEndTime || '10:30'
          });
          for (const h of this.halls) {
            this.hallsArray.push(this.createHallGroup(h));
          }
          if (this.seats.length > 0) this.activeTab = 'seats';
        } else {
          this.addHallRow();
        }
        this.cdr.markForCheck();
      },
      error: err => {
        this.loading = false;
        this.loadingMessage = '';
        this.confirmDialog.alert('Load Failed', err?.error?.message || 'Could not load seating data.', 'warning');
        this.cdr.markForCheck();
      }
    });
  }

  private createHallGroup(h?: Partial<HallRow>): FormGroup {
    const defaultCap = Math.max(30, this.enrolledCount || 30);
    return this.fb.group({
      roomId: [h?.roomId || ''],
      roomName: [h?.roomName || `Exam Hall ${this.hallsArray.length + 1}`, Validators.required],
      capacity: [h?.capacity || defaultCap, [Validators.required, Validators.min(1)]],
      invigilatorTeacherId: [h?.invigilatorTeacherId || ''],
      invigilatorName: [h?.invigilatorName || '']
    });
  }

  addHallRow(): void {
    this.hallsArray.push(this.createHallGroup());
    this.cdr.markForCheck();
  }

  removeHallRow(index: number): void {
    this.hallsArray.removeAt(index);
    this.cdr.markForCheck();
  }

  onRoomPicked(index: number, roomId: string): void {
    const grp = this.hallsArray.at(index) as FormGroup;
    const found = this.rooms.find(r => r.id === roomId);
    if (found) {
      grp.patchValue({ roomName: found.roomNumber, capacity: found.capacity || 30 });
    }
  }

  onInvigilatorPicked(index: number, teacherId: string): void {
    const grp = this.hallsArray.at(index) as FormGroup;
    const found = this.teachers.find(t => t.id === teacherId);
    grp.patchValue({ invigilatorName: found ? found.fullName : '' });
  }

  autoAllocate(): void {
    const val = this.setupForm.value;
    const payload = {
      examStartTime: val.examStartTime,
      examEndTime: val.examEndTime,
      orderBy: val.orderBy,
      halls: (val.halls || []).map((h: any) => ({
        roomId: h.roomId || null,
        roomName: h.roomName,
        capacity: Number(h.capacity) || 30,
        invigilatorTeacherId: h.invigilatorTeacherId || null,
        invigilatorName: h.invigilatorName || null
      }))
    };

    this.loading = true;
    this.loadingMessage = 'Allocating exam seats & syncing Admit Cards...';
    this.cdr.markForCheck();

    this.http.post<any>(`${environment.apiUrl}/coaching-ai-exam/tests/${this.data.testId}/seating/auto-allocate`, payload).subscribe({
      next: res => {
        this.loading = false;
        this.loadingMessage = '';
        this.changed = true;
        this.confirmDialog.alert('Seating Allocated', res?.message || 'Seats allocated successfully.', 'success');
        this.loadSeating();
      },
      error: err => {
        this.loading = false;
        this.loadingMessage = '';
        this.confirmDialog.alert('Allocation Notice', err?.error?.message || 'Could not allocate seats.', 'warning');
        this.cdr.markForCheck();
      }
    });
  }

  setSeatAttendance(s: SeatRow, status: 'Present' | 'Absent'): void {
    s.attendanceStatus = status;
    this.cdr.markForCheck();
  }

  markAllExamStatus(status: 'Present' | 'Absent'): void {
    this.seats.forEach(s => s.attendanceStatus = status);
    this.cdr.markForCheck();
  }

  saveExamAttendance(): void {
    this.loading = true;
    this.loadingMessage = 'Saving exam hall attendance & syncing Copy Bundle count...';
    this.cdr.markForCheck();

    const payload = {
      syncCopyBundleCount: true,
      items: this.seats.map(s => ({
        studentId: s.studentId,
        attendanceStatus: s.attendanceStatus === 'Absent' ? 'Absent' : 'Present'
      }))
    };

    this.http.put<any>(`${environment.apiUrl}/coaching-ai-exam/tests/${this.data.testId}/seating/attendance`, payload).subscribe({
      next: res => {
        this.loading = false;
        this.loadingMessage = '';
        this.changed = true;
        this.confirmDialog.alert('Exam Attendance Saved', `${res?.message || 'Saved!'} Copy Bundle count auto-synced to ${res?.presentCount || 0} copies.`, 'success');
        this.cdr.markForCheck();
      },
      error: err => {
        this.loading = false;
        this.loadingMessage = '';
        this.confirmDialog.alert('Save Failed', err?.error?.message || 'Failed to save attendance.', 'warning');
        this.cdr.markForCheck();
      }
    });
  }

  printSeatingDocument(attendanceSheetMode: boolean): void {
    const win = window.open('', '_blank', 'width=920,height=1050');
    if (!win) {
      this.confirmDialog.alert('Popup Blocked', 'Please allow popups to print the seating document.', 'warning');
      return;
    }

    const instName = this.authService.getInstituteName() || 'Institute Examination Cell';
    const logoUrl = this.authService.getInstituteLogoUrl() || '';
    const logoHtml = logoUrl ? `<img src="${logoUrl}" style="height:48px;object-fit:contain;" />` : '';
    const title = attendanceSheetMode ? 'EXAM HALL ATTENDANCE & SIGNATURE SHEET' : 'OFFICIAL EXAM SEATING CHART';

    const pagesHtml = this.groupedByHall.map((g, gIdx) => {
      const rows = g.seats.map((s, idx) => `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td style="text-align:center;font-weight:700;">${this.esc(s.seatNumber)}</td>
          <td style="text-align:center;">${this.esc(s.rollNumber || '—')}</td>
          <td><strong>${this.esc(s.studentName)}</strong></td>
          ${attendanceSheetMode ? '<td></td><td></td><td></td>' : `<td style="text-align:center;">Bench #${s.benchNumber}</td>`}
        </tr>`).join('');

      return `
        <div style="${gIdx > 0 ? 'page-break-before:always;' : ''}">
          <div style="display:flex;align-items:center;justify-content:center;gap:12px;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:10px;text-align:center;">
            ${logoHtml}
            <div>
              <div style="font-size:18px;font-weight:800;text-transform:uppercase;">${this.esc(instName)}</div>
              <div style="font-size:13px;font-weight:700;color:#1e3a8a;margin-top:2px;">${title}</div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:12.5px;background:#f8fafc;border:1px solid #cbd5e1;padding:7px 10px;margin-bottom:10px;">
            <span><strong>Exam:</strong> ${this.esc(this.data.title)}</span>
            <span><strong>Batch:</strong> ${this.esc(this.data.batchName || '')}</span>
            <span><strong>Hall / Room:</strong> ${this.esc(g.roomName)}</span>
            <span><strong>Invigilator:</strong> ${this.esc(g.invigilatorName || '________________')}</span>
            <span><strong>Students:</strong> ${g.seats.length}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
            <thead>
              <tr style="background:#eff6ff;">
                <th style="border:1px solid #94a3b8;padding:6px;width:40px;">S.No</th>
                <th style="border:1px solid #94a3b8;padding:6px;width:85px;">Seat No</th>
                <th style="border:1px solid #94a3b8;padding:6px;width:120px;">Roll No</th>
                <th style="border:1px solid #94a3b8;padding:6px;text-align:left;">Student Name</th>
                ${attendanceSheetMode
                  ? '<th style="border:1px solid #94a3b8;padding:6px;width:90px;">P / A</th><th style="border:1px solid #94a3b8;padding:6px;width:100px;">Copy No.</th><th style="border:1px solid #94a3b8;padding:6px;width:140px;">Student Signature</th>'
                  : '<th style="border:1px solid #94a3b8;padding:6px;width:100px;">Bench</th>'}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${attendanceSheetMode ? `
            <div style="display:flex;justify-content:space-between;margin-top:34px;font-size:12.5px;">
              <span>Total Present: ______ &nbsp;&nbsp; Total Absent: ______</span>
              <span>Invigilator Signature: ______________________</span>
            </div>` : ''}
        </div>`;
    }).join('');

    win.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; }
          td { border: 1px solid #cbd5e1; padding: 6px 8px; }
        </style>
      </head>
      <body>${pagesHtml}<script>window.onload = function(){ window.print(); };</script></body>
      </html>
    `);
    win.document.close();
  }

  private esc(s: string): string {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  close(): void {
    if (this.loading) return;
    this.dialogRef.close({ changed: this.changed });
  }
}
