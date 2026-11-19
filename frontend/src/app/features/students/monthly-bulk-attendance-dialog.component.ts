import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { SchoolService, SchoolClassDto, SchoolSectionDto, MonthlyAttendancePreviewDto } from '../../core/services/school.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';

export interface MonthlyBulkAttendanceDialogData {
  classId: string;
  className: string;
  sectionId?: string;
  sectionName?: string;
  schoolClasses?: SchoolClassDto[];
  classSections?: SchoolSectionDto[];
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
}

@Component({
  selector: 'app-monthly-bulk-attendance-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatRadioModule
  ],
  template: `
    <div class="monthly-bulk-modal">
      <!-- Standard Light Blue Gradient Dialog Header (Strict ERP Rule) -->
      <div class="dialog-header">
        <div class="dialog-icon-box">
          <mat-icon>auto_mode</mat-icon>
        </div>
        <div class="dialog-title-group">
          <h2 class="dialog-title">Monthly Bulk Attendance Generator</h2>
          <span class="dialog-subtitle">
            <strong>{{ currentClassName }}</strong>
            @if (currentSectionName) {
              &bull; <span>Section {{ currentSectionName }}</span>
            }
            &bull; <span>Institute: <strong>{{ instituteName }}</strong></span>
          </span>
        </div>
        <button mat-icon-button (click)="closeDialog()" class="dialog-close-btn" matTooltip="Close Dialog" [disabled]="isGenerating">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Top Progress Loader -->
      @if (isLoadingPreview || isGenerating) {
        <mat-progress-bar mode="indeterminate" class="dialog-loader"></mat-progress-bar>
      }

      <div class="dialog-body">
        <!-- Configuration Deck (Google Material 3 Outline Form) -->
        <div class="config-deck">
          <div class="config-row-primary">
            <!-- School Class (Locked or Selectable) -->
            <mat-form-field appearance="outline" class="form-item class-field" subscriptSizing="dynamic">
              <mat-label>School Class</mat-label>
              <mat-select [(ngModel)]="selectedClassId" (selectionChange)="onScopeOrPeriodChanged()" [disabled]="isGenerating">
                @for (c of availableClasses; track c.id) {
                  <mat-option [value]="c.id">{{ c.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <!-- Section Selector -->
            <mat-form-field appearance="outline" class="form-item section-field" subscriptSizing="dynamic">
              <mat-label>Section</mat-label>
              <mat-select [(ngModel)]="selectedSectionId" (selectionChange)="onScopeOrPeriodChanged()" [disabled]="isGenerating">
                <mat-option value="">All Sections</mat-option>
                @for (sec of availableSections; track sec.id) {
                  <mat-option [value]="sec.id">Section {{ sec.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <!-- Target Month -->
            <mat-form-field appearance="outline" class="form-item month-field" subscriptSizing="dynamic">
              <mat-label>Month</mat-label>
              <mat-select [(ngModel)]="selectedMonth" (selectionChange)="onScopeOrPeriodChanged()" [disabled]="isGenerating">
                @for (m of monthsList; track m.value) {
                  <mat-option [value]="m.value">{{ m.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <!-- Target Year -->
            <mat-form-field appearance="outline" class="form-item year-field" subscriptSizing="dynamic">
              <mat-label>Year</mat-label>
              <mat-select [(ngModel)]="selectedYear" (selectionChange)="onScopeOrPeriodChanged()" [disabled]="isGenerating">
                @for (y of yearsList; track y) {
                  <mat-option [value]="y">{{ y }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Parameters Row: Status, In/Out Times, Safety Toggles -->
          <div class="config-row-secondary">
            <!-- Attendance Status with Clean Material Trigger -->
            <mat-form-field appearance="outline" class="form-item status-field" subscriptSizing="dynamic">
              <mat-label>Attendance Status</mat-label>
              <mat-select [(ngModel)]="targetStatus" [disabled]="isGenerating">
                <mat-select-trigger>
                  <div class="status-trigger-badge" [ngClass]="targetStatus.toLowerCase()">
                    <mat-icon>{{ getStatusIcon(targetStatus) }}</mat-icon>
                    <span>{{ getStatusLabel(targetStatus) }}</span>
                  </div>
                </mat-select-trigger>
                <mat-option value="Present">
                  <div class="status-opt present"><mat-icon>check_circle</mat-icon> <span>Present (उपस्थित)</span></div>
                </mat-option>
                <mat-option value="Late">
                  <div class="status-opt late"><mat-icon>schedule</mat-icon> <span>Late (देरी से)</span></div>
                </mat-option>
                <mat-option value="HalfDay">
                  <div class="status-opt halfday"><mat-icon>hourglass_bottom</mat-icon> <span>Half-Day (आधा दिन)</span></div>
                </mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Unified Timings Card -->
            <div class="timing-unified-card">
              <div class="timing-field">
                <label>Check-In</label>
                <input type="time" [(ngModel)]="checkInTime" [disabled]="isGenerating" title="Default Check-In Time">
              </div>
              <div class="timing-sep">➔</div>
              <div class="timing-field">
                <label>Check-Out</label>
                <input type="time" [(ngModel)]="checkOutTime" [disabled]="isGenerating" title="Default Check-Out Time">
              </div>
            </div>

            <!-- Smart Safety Toggle Cards (Edge-to-Edge, Balanced) -->
            <div class="safety-toggle-card" [class.active]="excludeSundays" (click)="!isGenerating && toggleSundays()">
              <div class="toggle-icon-wrap sunday">
                <mat-icon>wb_sunny</mat-icon>
              </div>
              <div class="toggle-text-wrap">
                <span class="toggle-title">Skip Sundays</span>
                <span class="toggle-sub">{{ previewData ? previewData.sundaysCount + ' Sundays' : 'Sundays off' }}</span>
              </div>
              <div class="toggle-check" [class.checked]="excludeSundays">
                <mat-icon>{{ excludeSundays ? 'check_box' : 'check_box_outline_blank' }}</mat-icon>
              </div>
            </div>

            <div class="safety-toggle-card" [class.active]="excludeHolidays" (click)="!isGenerating && toggleHolidays()">
              <div class="toggle-icon-wrap holiday">
                <mat-icon>celebration</mat-icon>
              </div>
              <div class="toggle-text-wrap">
                <span class="toggle-title">Skip Holidays</span>
                <span class="toggle-sub">{{ previewData ? previewData.holidaysCount + ' Holidays' : 'Official off' }}</span>
              </div>
              <div class="toggle-check" [class.checked]="excludeHolidays">
                <mat-icon>{{ excludeHolidays ? 'check_box' : 'check_box_outline_blank' }}</mat-icon>
              </div>
            </div>
          </div>
        </div>

        <!-- 4-Pillar KPI Analytics Matrix (Material 3 Cards) -->
        @if (previewData) {
          <div class="analytics-kpi-grid">
            <div class="kpi-card students">
              <div class="kpi-icon-box">
                <mat-icon>groups</mat-icon>
              </div>
              <div class="kpi-data">
                <span class="kpi-label">Active Students</span>
                <span class="kpi-value">{{ previewData.totalStudents }}</span>
                <span class="kpi-sub">Enrolled in class</span>
              </div>
            </div>

            <div class="kpi-card working-days">
              <div class="kpi-icon-box">
                <mat-icon>calendar_today</mat-icon>
              </div>
              <div class="kpi-data">
                <span class="kpi-label">Working Days</span>
                <span class="kpi-value">{{ previewData.workingDaysCount }} <small>/ {{ previewData.totalDaysInMonth }}</small></span>
                <span class="kpi-sub">{{ previewData.sundaysCount }} Sundays, {{ previewData.holidaysCount }} Holidays</span>
              </div>
            </div>

            <div class="kpi-card expected-records">
              <div class="kpi-icon-box">
                <mat-icon>receipt_long</mat-icon>
              </div>
              <div class="kpi-data">
                <span class="kpi-label">Total Records</span>
                <span class="kpi-value">{{ previewData.expectedRecords }}</span>
                <span class="kpi-sub">{{ previewData.workingDaysCount }} days &times; {{ previewData.totalStudents }} students</span>
              </div>
            </div>

            <div class="kpi-card existing-records">
              <div class="kpi-icon-box">
                <mat-icon>verified</mat-icon>
              </div>
              <div class="kpi-data">
                <span class="kpi-label">Already Logged</span>
                <span class="kpi-value">{{ previewData.existingRecordsCount }}</span>
                <span class="kpi-sub">
                  {{ previewData.existingRecordsCount > 0 ? (generationMode === 'FillMissingOnly' ? 'Preserved (Safe)' : 'Will be updated') : 'No past logs' }}
                </span>
              </div>
            </div>
          </div>
        }

        <!-- Generation Strategy Mode Selector (Google Material 3 Styled Selection Deck) -->
        <div class="strategy-selector-section">
          <div class="section-heading">
            <mat-icon>tune</mat-icon>
            <span>Generation Strategy (कार्यप्रणाली चुनें):</span>
          </div>

          <div class="strategy-cards">
            <!-- Mode 1: Safe Missing Days Only -->
            <div class="strategy-card" 
                 [class.selected]="generationMode === 'FillMissingOnly'"
                 (click)="!isGenerating && (generationMode = 'FillMissingOnly')">
              <div class="strategy-radio">
                <div class="radio-circle" [class.checked]="generationMode === 'FillMissingOnly'"></div>
              </div>
              <div class="strategy-content">
                <div class="strategy-title-row">
                  <mat-icon class="icon-safe">shield</mat-icon>
                  <strong>Fill Missing Days Only (सुरक्षित / Safe)</strong>
                  <span class="badge-recommended">Recommended</span>
                </div>
                <p>
                  पहले से दर्ज की गई हाजिरी (Manual या Biometric) सुरक्षित रहेगी। केवल उन तारीखों पर अटेंडेंस बनेगी जहाँ कोई रिकॉर्ड मौजूद नहीं है।
                </p>
              </div>
            </div>

            <!-- Mode 2: Overwrite Entire Month -->
            <div class="strategy-card" 
                 [class.selected]="generationMode === 'Overwrite'"
                 (click)="!isGenerating && (generationMode = 'Overwrite')">
              <div class="strategy-radio">
                <div class="radio-circle" [class.checked]="generationMode === 'Overwrite'"></div>
              </div>
              <div class="strategy-content">
                <div class="strategy-title-row">
                  <mat-icon class="icon-overwrite">published_with_changes</mat-icon>
                  <strong>Overwrite Entire Month (पुनर्लेखन / Reset)</strong>
                  <span class="badge-overwrite">Full Overwrite</span>
                </div>
                <p>
                  इस माह के सभी कार्य दिवसों की हाजिरी को नए स्टेटस ({{ targetStatus }}) और समय ({{ checkInTime }} - {{ checkOutTime }}) के साथ अपडेट कर दिया जाएगा।
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Visual Mini Calendar Preview (Google Material Matrix) -->
        @if (previewData && previewData.days && previewData.days.length > 0) {
          <div class="calendar-preview-section">
            <div class="calendar-header-row">
              <div class="cal-title">
                <mat-icon>event_repeat</mat-icon>
                <span>Month Working Days Matrix: <strong>{{ previewData.monthName }}</strong></span>
              </div>
              <div class="cal-legend">
                <span class="legend-item"><span class="dot working"></span> Working ({{ previewData.workingDaysCount }})</span>
                <span class="legend-item"><span class="dot sunday"></span> Sunday ({{ previewData.sundaysCount }})</span>
                <span class="legend-item"><span class="dot holiday"></span> Holiday ({{ previewData.holidaysCount }})</span>
                @if (previewData.futureDaysCount > 0) {
                  <span class="legend-item"><span class="dot future"></span> Future ({{ previewData.futureDaysCount }})</span>
                }
              </div>
            </div>

            <div class="calendar-cells-grid">
              @for (day of previewData.days; track day.dateStr) {
                <div class="cal-day-cell" 
                     [class.sunday]="day.isSunday"
                     [class.holiday]="day.isHoliday"
                     [class.future]="day.isFuture"
                     [class.working]="day.isWorkingDay"
                     [matTooltip]="getDayTooltip(day)">
                  <div class="day-number">{{ day.dayNumber }}</div>
                  <div class="day-dow">{{ day.dayOfWeek }}</div>
                  <div class="day-pill">
                    @if (day.isSunday) {
                      <span>Sun</span>
                    } @else if (day.isHoliday) {
                      <span class="holiday-tag">Holiday</span>
                    } @else if (day.isFuture) {
                      <span>Future</span>
                    } @else {
                      @if (day.existingCount > 0) {
                        <span class="logged-tag">&check; {{ day.existingCount }}</span>
                      } @else {
                        <span class="working-tag">Gen</span>
                      }
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Operation Summary Alert Box -->
        @if (generationResult) {
          <div class="result-alert-box success">
            <mat-icon>task_alt</mat-icon>
            <div class="result-text">
              <h4>{{ generationResult.message }}</h4>
              <p>
                <strong>{{ generationResult.createdCount }}</strong> new records created &bull;
                <strong>{{ generationResult.updatedCount }}</strong> records updated &bull;
                <strong>{{ generationResult.preservedCount }}</strong> existing records preserved &bull;
                Total Students: <strong>{{ generationResult.totalStudents }}</strong> &bull;
                Working Days: <strong>{{ generationResult.workingDays }}</strong>
              </p>
            </div>
          </div>
        }
      </div>

      <!-- Action Footer -->
      <div class="dialog-actions">
        <button mat-button type="button" class="btn-cancel" (click)="closeDialog()" [disabled]="isGenerating">
          Cancel
        </button>
        <button mat-flat-button color="primary" type="button" class="btn-generate" (click)="confirmAndGenerate()" [disabled]="isGenerating || !previewData || previewData.totalStudents === 0 || previewData.workingDaysCount === 0">
          @if (isGenerating) {
            <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
            <span>Generating Monthly Attendance...</span>
          } @else {
            <span class="btn-content-wrap">
              <mat-icon>bolt</mat-icon>
              <span>Generate Monthly Attendance ({{ previewData?.expectedRecords || 0 }} Records)</span>
            </span>
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .monthly-bulk-modal {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 100%;
      min-height: 0;
      width: 100%;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 45px -10px rgba(15, 23, 42, 0.25);
    }

    /* Standard Dialog Header */
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 24px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      flex-shrink: 0;
    }

    .dialog-icon-box {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #2563eb;
      color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }

    .dialog-icon-box mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .dialog-title-group {
      flex: 1;
      min-width: 0;
    }

    .dialog-title {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: #1e3a8a;
      letter-spacing: -0.01em;
      line-height: 1.25;
    }

    .dialog-subtitle {
      font-size: 0.85rem;
      color: #3b82f6;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-top: 3px;
    }

    .dialog-subtitle strong {
      color: #1e40af;
    }

    .dialog-close-btn {
      color: #64748b;
      transition: color 0.15s ease;
    }

    .dialog-close-btn:hover {
      color: #1e293b;
    }

    .dialog-loader {
      height: 3px;
      flex-shrink: 0;
    }

    /* Dialog Body */
    .dialog-body {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    /* Configuration Deck */
    .config-deck {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .config-row-primary {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1.2fr 0.8fr;
      gap: 12px;
      align-items: center;
    }

    .config-row-secondary {
      display: grid;
      grid-template-columns: 1.3fr 1.3fr 1fr 1fr;
      gap: 12px;
      align-items: stretch;
    }

    .status-field {
      width: 100%;
    }

    .status-trigger-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      font-size: 0.88rem;
    }

    .status-trigger-badge mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .status-trigger-badge.present,
    .status-opt.present { color: #16a34a; }
    
    .status-trigger-badge.late,
    .status-opt.late { color: #d97706; }
    
    .status-trigger-badge.halfday,
    .status-opt.halfday { color: #9333ea; }

    .status-opt {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }

    /* Unified Timings Card */
    .timing-unified-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 4px 12px;
      height: 48px;
      box-sizing: border-box;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    }

    .timing-field {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .timing-field label {
      font-size: 0.65rem;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      line-height: 1;
      margin-bottom: 2px;
    }

    .timing-field input {
      border: none;
      background: transparent;
      font-size: 0.88rem;
      font-weight: 700;
      color: #0f172a;
      padding: 0;
      outline: none;
      width: 100%;
    }

    .timing-sep {
      font-size: 0.75rem;
      color: #94a3b8;
      font-weight: bold;
      flex-shrink: 0;
    }

    /* Safety Toggle Cards */
    .safety-toggle-card {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      padding: 4px 10px;
      height: 48px;
      box-sizing: border-box;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    }

    .safety-toggle-card:hover {
      border-color: #93c5fd;
      background: #f8fafc;
    }

    .safety-toggle-card.active {
      border-color: #2563eb;
      background: #eff6ff;
    }

    .toggle-icon-wrap {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .toggle-icon-wrap.sunday {
      background: #fef3c7;
      color: #b45309;
    }

    .toggle-icon-wrap.holiday {
      background: #fee2e2;
      color: #b91c1c;
    }

    .toggle-icon-wrap mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .toggle-text-wrap {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .toggle-title {
      font-size: 0.76rem;
      font-weight: 700;
      color: #1e293b;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .toggle-sub {
      font-size: 0.65rem;
      color: #64748b;
      line-height: 1.1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .toggle-check {
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .toggle-check.checked {
      color: #2563eb;
    }

    .toggle-check mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* KPI Grid */
    .analytics-kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .kpi-card:hover {
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.07);
    }

    .kpi-icon-box {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .kpi-card.students .kpi-icon-box { background: #dbeafe; color: #1d4ed8; }
    .kpi-card.working-days .kpi-icon-box { background: #dcfce7; color: #15803d; }
    .kpi-card.expected-records .kpi-icon-box { background: #fef3c7; color: #b45309; }
    .kpi-card.existing-records .kpi-icon-box { background: #ede9fe; color: #6d28d9; }

    .kpi-data {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .kpi-label {
      font-size: 0.72rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .kpi-value {
      font-size: 1.35rem;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
    }

    .kpi-value small {
      font-size: 0.85rem;
      font-weight: 500;
      color: #64748b;
    }

    .kpi-sub {
      font-size: 0.73rem;
      color: #64748b;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Strategy Selector Section */
    .strategy-selector-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .section-heading {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.88rem;
      font-weight: 700;
      color: #1e293b;
    }

    .section-heading mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2563eb;
    }

    .strategy-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .strategy-card {
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .strategy-card:hover {
      border-color: #93c5fd;
      background: #f8fafc;
    }

    .strategy-card.selected {
      border-color: #2563eb;
      background: #eff6ff;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.12);
    }

    .strategy-radio {
      padding-top: 2px;
    }

    .radio-circle {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .radio-circle.checked {
      border-color: #2563eb;
      background: #2563eb;
      box-shadow: inset 0 0 0 3px #ffffff;
    }

    .strategy-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .strategy-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.88rem;
      color: #0f172a;
    }

    .strategy-title-row mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .icon-safe { color: #16a34a; }
    .icon-overwrite { color: #dc2626; }

    .badge-recommended {
      background: #dcfce7;
      color: #166534;
      font-size: 0.68rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .badge-overwrite {
      background: #fee2e2;
      color: #991b1b;
      font-size: 0.68rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .strategy-content p {
      margin: 0;
      font-size: 0.78rem;
      color: #64748b;
      line-height: 1.35;
    }

    /* Calendar Preview Matrix */
    .calendar-preview-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .calendar-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }

    .cal-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      color: #334155;
    }

    .cal-title mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2563eb;
    }

    .cal-legend {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.74rem;
      color: #64748b;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .dot.working { background: #16a34a; }
    .dot.sunday { background: #94a3b8; }
    .dot.holiday { background: #f59e0b; }
    .dot.future { background: #cbd5e1; }

    .calendar-cells-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 6px;
    }

    .cal-day-cell {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 6px 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      text-align: center;
      transition: all 0.12s ease;
    }

    .cal-day-cell.working {
      border-color: #bbf7d0;
      background: #f0fdf4;
    }

    .cal-day-cell.sunday {
      background: #f1f5f9;
      border-color: #e2e8f0;
      opacity: 0.7;
    }

    .cal-day-cell.holiday {
      background: #fef3c7;
      border-color: #fde68a;
    }

    .cal-day-cell.future {
      background: #fafafa;
      border-style: dashed;
      opacity: 0.6;
    }

    .day-number {
      font-size: 0.85rem;
      font-weight: 700;
      color: #0f172a;
    }

    .day-dow {
      font-size: 0.65rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
    }

    .day-pill {
      font-size: 0.62rem;
      font-weight: 600;
      padding: 1px 4px;
      border-radius: 4px;
      margin-top: 2px;
    }

    .working-tag {
      background: #dcfce7;
      color: #15803d;
    }

    .logged-tag {
      background: #dbeafe;
      color: #1e40af;
      font-weight: 700;
    }

    .holiday-tag {
      background: #fef3c7;
      color: #b45309;
    }

    /* Success Result Box */
    .result-alert-box {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 18px;
      border-radius: 10px;
    }

    .result-alert-box.success {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
    }

    .result-alert-box mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: #059669;
    }

    .result-text h4 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
    }

    .result-text p {
      margin: 4px 0 0;
      font-size: 0.8rem;
    }

    /* Action Footer */
    .dialog-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .btn-cancel {
      color: #475569;
      font-weight: 600;
    }

    .btn-generate {
      background: #2563eb !important;
      color: #ffffff !important;
      font-weight: 700;
      border-radius: 8px;
      padding: 0 22px;
      height: 42px;
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-content-wrap {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-generate:hover:not([disabled]) {
      background: #1d4ed8 !important;
    }

    .btn-generate[disabled] {
      opacity: 0.6;
    }

    .btn-spinner {
      margin-right: 6px;
    }

    @media (max-width: 900px) {
      .config-row-primary {
        grid-template-columns: 1fr 1fr;
      }
      .config-row-secondary {
        grid-template-columns: 1fr 1fr;
      }
      .analytics-kpi-grid {
        grid-template-columns: 1fr 1fr;
      }
      .strategy-cards {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 600px) {
      .config-row-primary {
        grid-template-columns: 1fr;
      }
      .config-row-secondary {
        grid-template-columns: 1fr;
      }
      .analytics-kpi-grid {
        grid-template-columns: 1fr;
      }
      .calendar-cells-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }
  `]
})
export class MonthlyBulkAttendanceDialogComponent implements OnInit {
  selectedClassId: string = '';
  selectedSectionId: string = '';
  selectedMonth: number = 1;
  selectedYear: number = 2026;
  targetStatus: string = 'Present';
  checkInTime: string = '08:00';
  checkOutTime: string = '14:00';
  excludeSundays: boolean = true;
  excludeHolidays: boolean = true;
  generationMode: 'FillMissingOnly' | 'Overwrite' = 'FillMissingOnly';

  availableClasses: SchoolClassDto[] = [];
  availableSections: SchoolSectionDto[] = [];

  monthsList = [
    { value: 1, name: 'January (जनवरी)' },
    { value: 2, name: 'February (फरवरी)' },
    { value: 3, name: 'March (मार्च)' },
    { value: 4, name: 'April (अप्रैल)' },
    { value: 5, name: 'May (मई)' },
    { value: 6, name: 'June (जून)' },
    { value: 7, name: 'July (जुलाई)' },
    { value: 8, name: 'August (अगस्त)' },
    { value: 9, name: 'September (सितंबर)' },
    { value: 10, name: 'October (अक्टूबर)' },
    { value: 11, name: 'November (नवंबर)' },
    { value: 12, name: 'December (दिसंबर)' }
  ];

  yearsList: number[] = [];

  previewData: MonthlyAttendancePreviewDto | null = null;
  isLoadingPreview: boolean = false;
  isGenerating: boolean = false;
  generationResult: any = null;

  constructor(
    private dialogRef: MatDialogRef<MonthlyBulkAttendanceDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MonthlyBulkAttendanceDialogData,
    private schoolService: SchoolService,
    private confirmDialog: ConfirmDialogService,
    private auth: AuthService
  ) {
    const today = new Date();
    this.selectedYear = today.getFullYear();
    this.selectedMonth = today.getMonth() + 1;
    this.yearsList = [this.selectedYear - 1, this.selectedYear, this.selectedYear + 1];

    if (data.classId) {
      this.selectedClassId = data.classId;
    }
    if (data.sectionId) {
      this.selectedSectionId = data.sectionId;
    }
    if (data.schoolClasses) {
      this.availableClasses = data.schoolClasses;
    }
    if (data.classSections) {
      this.availableSections = data.classSections;
    }
    if (data.defaultCheckInTime) {
      this.checkInTime = data.defaultCheckInTime;
    }
    if (data.defaultCheckOutTime) {
      this.checkOutTime = data.defaultCheckOutTime;
    }
  }

  ngOnInit(): void {
    if (this.availableClasses.length === 0) {
      this.schoolService.getClasses(true, 'school').subscribe({
        next: classes => {
          this.availableClasses = classes;
          if (!this.selectedClassId && classes.length > 0) {
            this.selectedClassId = classes[0].id;
          }
          this.loadPreview();
        },
        error: () => this.loadPreview()
      });
    } else {
      this.loadPreview();
    }
  }

  get instituteName(): string {
    return this.auth.getInstituteName() || 'IMSERP Campus';
  }

  get currentClassName(): string {
    const c = this.availableClasses.find(x => x.id === this.selectedClassId);
    return c?.name || this.data.className || 'Selected Class';
  }

  get currentSectionName(): string | null {
    if (!this.selectedSectionId) return null;
    const s = this.availableSections.find(x => x.id === this.selectedSectionId);
    return s?.name || this.data.sectionName || null;
  }

  onScopeOrPeriodChanged(): void {
    this.generationResult = null;
    this.loadPreview();
  }

  loadPreview(): void {
    if (!this.selectedClassId) return;

    this.isLoadingPreview = true;
    this.schoolService.getMonthlyAttendancePreview(
      this.selectedClassId,
      this.selectedSectionId || null,
      this.selectedYear,
      this.selectedMonth
    ).subscribe({
      next: preview => {
        this.previewData = preview;
        this.isLoadingPreview = false;
      },
      error: err => {
        this.isLoadingPreview = false;
      }
    });
  }

  getDayTooltip(day: any): string {
    if (day.isSunday) return `${day.dateStr} (${day.dayOfWeek}): Sunday (Off)`;
    if (day.isHoliday) return `${day.dateStr} (${day.dayOfWeek}): Holiday - ${day.holidayName || 'Declared Holiday'}`;
    if (day.isFuture) return `${day.dateStr} (${day.dayOfWeek}): Future Date (Skipped)`;
    if (day.existingCount > 0) return `${day.dateStr}: Working Day (${day.existingCount} records already logged)`;
    return `${day.dateStr}: Working Day (To be generated)`;
  }

  getStatusIcon(status: string): string {
    if (status === 'Late') return 'schedule';
    if (status === 'HalfDay') return 'hourglass_bottom';
    return 'check_circle';
  }

  getStatusLabel(status: string): string {
    if (status === 'Late') return 'Late (देरी से)';
    if (status === 'HalfDay') return 'Half-Day (आधा दिन)';
    return 'Present (उपस्थित)';
  }

  toggleSundays(): void {
    this.excludeSundays = !this.excludeSundays;
    this.onScopeOrPeriodChanged();
  }

  toggleHolidays(): void {
    this.excludeHolidays = !this.excludeHolidays;
    this.onScopeOrPeriodChanged();
  }

  confirmAndGenerate(): void {
    if (!this.selectedClassId || !this.previewData) return;

    if (this.previewData.totalStudents === 0) {
      this.confirmDialog.alert('No Students Found', 'There are no active enrolled students found in this class/section.', 'warning');
      return;
    }

    if (this.previewData.workingDaysCount === 0) {
      this.confirmDialog.alert('No Working Days', 'No eligible working days found in this month range.', 'warning');
      return;
    }

    const modeText = this.generationMode === 'FillMissingOnly'
      ? 'Fill Missing Days Only (Preserving existing attendance)'
      : 'Overwrite Entire Month (Updating all working days)';

    const confirmMsg = `Are you sure you want to generate monthly bulk attendance for "${this.currentClassName}"?\n\n` +
      `• Target Month: ${this.previewData.monthName}\n` +
      `• Working Days: ${this.previewData.workingDaysCount} days\n` +
      `• Students: ${this.previewData.totalStudents}\n` +
      `• Total Records: ~${this.previewData.expectedRecords}\n` +
      `• Mode: ${modeText}\n` +
      `• Status: ${this.targetStatus} (${this.checkInTime} - ${this.checkOutTime})`;

    this.confirmDialog.confirm('Generate Monthly Attendance', confirmMsg, 'Generate Now', 'Cancel').subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.executeGeneration();
      }
    });
  }

  private executeGeneration(): void {
    this.isGenerating = true;
    this.generationResult = null;

    const payload = {
      classId: this.selectedClassId,
      sectionId: this.selectedSectionId || null,
      year: this.selectedYear,
      month: this.selectedMonth,
      mode: this.generationMode,
      status: this.targetStatus,
      remarks: 'Monthly Bulk Roll Call',
      checkInTime: this.checkInTime || '08:00',
      checkOutTime: this.checkOutTime || '14:00',
      excludeSundays: this.excludeSundays,
      excludeHolidays: this.excludeHolidays
    };

    this.schoolService.saveMonthlyBulkAttendance(payload).subscribe({
      next: (res: any) => {
        this.isGenerating = false;
        this.generationResult = res;
        this.loadPreview();
        this.confirmDialog.alert(
          'Attendance Generated Successfully',
          res?.message || `Monthly bulk attendance generated: ${res.createdCount} created, ${res.updatedCount} updated, ${res.preservedCount} preserved.`,
          'success'
        );
      },
      error: err => {
        this.isGenerating = false;
        this.confirmDialog.alert(
          'Generation Failed',
          err?.error?.message || 'Failed to generate monthly bulk attendance. Please check permissions.',
          'danger'
        );
      }
    });
  }

  closeDialog(): void {
    this.dialogRef.close({ refreshed: !!this.generationResult });
  }
}
