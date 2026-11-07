import { Component, Inject, OnInit, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FeesService, GenerateInvoicesResult } from '../../core/services/fees.service';
import { CoachingService } from '../../core/services/coaching.service';
import { BatchDto } from '../../core/services/batches.service';
import { SchoolClassDto } from '../../core/services/school.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { QuickSettingsService } from '../../core/services/quick-settings.service';

export interface GenerateInvoicesDialogData {
  batches: BatchDto[];
  classes?: SchoolClassDto[];
  defaultBatchId?: string;
  defaultClassId?: string;
  targetStudentId?: string;
  targetStudentName?: string;
  targetRollNumber?: string;
  targetJoiningDate?: string;
  targetCoachingJoiningDate?: string | null;
  isSchoolStudent?: boolean;
  isCoachingStudent?: boolean;
  defaultMonth?: number;
  defaultYear?: number;
}

interface BillingCycleOption {
  value: number;
  label: string;
  icon: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

@Component({
  selector: 'app-generate-invoices-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-wrapper">
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>post_add</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">
            Generate {{ hasSchoolModule && hasCoachingModule ? 'School & Coaching' : (hasCoachingModule ? 'Coaching' : 'School') }} Invoices
          </h2>
          <p class="subtitle">Bulk-bill {{ hasSchoolModule && hasCoachingModule ? 'class and batch' : (hasCoachingModule ? 'batch' : 'class') }} tuition fees across any billing cycle.</p>
        </div>
        <button type="button" class="close-btn" (click)="onCancel()" [disabled]="saving" mat-icon-button>
          <mat-icon>close</mat-icon>
        </button>
      </div>
    
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-content">
    
          <!-- Target Student Card (if opened for a specific student) -->
          @if (data.targetStudentName) {
            <div class="target-student-card">
              <div class="card-icon-pill">
                <mat-icon>person</mat-icon>
              </div>
              <div class="card-content">
                <div class="st-main">
                  @if (isHybridStudent) {
                    <span class="st-role-badge hybrid">HYBRID ADMISSION</span>
                  } @else {
                    <span class="st-role-badge">NEW ADMISSION</span>
                  }
                  <strong class="st-name">{{ data.targetStudentName }}</strong>
                  <span class="st-roll">({{ data.targetRollNumber }})</span>
                </div>
                <div class="st-sub-details">
                  @if (isHybridStudent) {
                    <span class="sub-pill hybrid-tag">
                      ⚡ School + Coaching
                    </span>
                  }
                  @if (getSelectedTargetClassName()) {
                    <span class="sub-pill school">
                      🏫 {{ getSelectedTargetClassName() }}
                    </span>
                  }
                  @if (getSelectedTargetBatchName()) {
                    <span class="sub-pill batch">
                      🎯 {{ getSelectedTargetBatchName() }}
                    </span>
                  }
                  @if (isHybridStudent && targetSchoolJoiningDate) {
                    <span class="sub-pill doj school-doj">
                      🏫 School DOJ: {{ targetSchoolJoiningDate | date:'dd MMM yyyy' }}
                    </span>
                  }
                  @if (isHybridStudent && targetCoachingJoiningDate) {
                    <span class="sub-pill doj coaching-doj">
                      🎯 Coach DOJ: {{ targetCoachingJoiningDate | date:'dd MMM yyyy' }}
                    </span>
                  }
                  @if (!isHybridStudent && (data.targetJoiningDate || data.targetCoachingJoiningDate)) {
                    <span class="sub-pill doj">
                      📅 Admission: {{ (data.targetJoiningDate || data.targetCoachingJoiningDate) | date:'dd MMM yyyy' }}
                    </span>
                  }
                </div>
                <div class="st-hint">
                  <mat-icon class="hint-icon">auto_awesome</mat-icon>
                  @if (isCutoffRolledOver()) {
                    <span>
                      Admitted on <strong>{{ getSelectedStudentJoiningDate() | date:'dd MMM yyyy' }}</strong> (after Day {{ cutoffDay }} Cutoff). First billing begins in <strong>{{ getNextRolledOverMonthName() }}</strong>.
                      <br>
                      <small style="color: #1e40af; font-weight: 600;">(एडमिशन {{ cutoffDay }} तारीख कट-ऑफ के बाद हुआ, इसलिए पहली बिलिंग {{ getNextRolledOverMonthName() }} से शुरू होगी।)</small>
                    </span>
                  }
                  @if (!isCutoffRolledOver()) {
                    @if (isHybridStudent && hasDifferentStreamDates) {
                      <span>
                        <strong>⚡ Dual-Stream Admission:</strong> Starting billing month is <strong>{{ getMonthName($safeNavigationMigration(form.get('month')?.value)) }} {{ form.get('year')?.value }}</strong>. Active streams (School/Coaching) for this cycle will be combined into a single unified receipt.
                      </span>
                    } @else {
                      <span>
                        Starting month auto-filled to <strong>{{ getMonthName($safeNavigationMigration(form.get('month')?.value)) }} {{ form.get('year')?.value }}</strong> from admission date. Select your billing cycle (Monthly, Quarterly, etc.).
                      </span>
                    }
                  }
                </div>
              </div>
            </div>
          }
    
            <!-- Recommended Workflow Callout (Only in bulk mode; single student gets compact hint) -->
            @if (!data.targetStudentName) {
              <div class="workflow-guide-callout">
                <div class="guide-icon-pill">
                  <mat-icon>lightbulb</mat-icon>
                </div>
                <div class="guide-body">
                  <div class="guide-header">
                    <strong>Recommended Billing Sequence</strong>
                    <span class="guide-pro-badge">PRO TIP</span>
                  </div>
                  <p class="guide-text">
                    If student(s) require <strong>Transport (Bus Pass)</strong>, <strong>Hostel</strong>, or <strong>Library</strong> facilities, please assign them first in their respective modules. The system will automatically bundle those monthly charges with the <strong>Tuition Fee</strong> into a single combined invoice.
                  </p>
                  <div class="guide-foot">
                    <span>Note: If no extra facilities are needed, you may safely proceed with generating tuition invoices below.</span>
                  </div>
                </div>
              </div>
            }
            @if (data.targetStudentName) {
              <div class="single-student-facility-hint">
                <mat-icon class="hint-ic">info_outline</mat-icon>
                <span>Active <strong>Transport, Hostel, or Library</strong> monthly charges for {{ data.targetStudentName }} will be bundled automatically into this invoice.</span>
              </div>
            }
    
            <!-- Auto-Pilot Mode Guidance Callout -->
            @if (settingsService.autoPilotInvoicing() && !data.targetStudentName) {
              <div class="autopilot-banner-callout">
                <div class="autopilot-icon-pill">
                  <mat-icon>smart_toy</mat-icon>
                </div>
                <div class="autopilot-body">
                  <div class="autopilot-header">
                    <strong>Auto-Pilot Active (Scheduled for 25th of month)</strong>
                    <span class="autopilot-badge">🤖 AUTO-PILOT ON</span>
                  </div>
                  <p class="autopilot-desc">
                    Regular monthly batch billing will automatically execute on the <strong>25th of the month</strong>.
                    You can safely use this manual dialog anytime for <strong>New Admissions</strong>, late joiners, or custom billing cycles.
                  </p>
                  <div class="autopilot-foot">
                    <mat-icon class="shield-icon">verified_user</mat-icon>
                    <span><strong>Zero-Duplicate Shield:</strong> Students who already have an invoice for this period are automatically skipped.</span>
                  </div>
                </div>
              </div>
            }
    
            <!-- Info Callout -->
            @if (!data.targetStudentName && !settingsService.autoPilotInvoicing()) {
              <div class="info-callout">
                <mat-icon class="info-icon">auto_awesome</mat-icon>
                <div class="info-text">
                  <strong>Smart Auto-Billing Engine:</strong> Invoices use each student's batch fee rate multiplied by the selected cycle. Students who already have an invoice for the selected period are <strong>automatically skipped</strong>.
                </div>
              </div>
            }
    
            <!-- Billing Cycle Selector -->
            <div class="section-label">
              <mat-icon class="section-icon">autorenew</mat-icon>
              <span>Billing Cycle</span>
            </div>
            <div class="cycle-grid">
              @for (c of billingCycles; track c) {
                <button
                  type="button"
                  class="cycle-tile"
                  [class.selected]="selectedCycle === c.value"
                  [style.--cycle-color]="c.color"
                  [style.--cycle-bg]="c.bgColor"
                  [style.--cycle-border]="c.borderColor"
                  (click)="selectCycle(c.value)">
                  <mat-icon class="cycle-icon">{{ c.icon }}</mat-icon>
                  <span class="cycle-label">{{ c.label }}</span>
                  <span class="cycle-desc">{{ c.description }}</span>
                </button>
              }
            </div>
    
            <!-- Period & Batch -->
            <div class="section-label">
              <mat-icon class="section-icon">calendar_month</mat-icon>
              <span>Period &amp; Scope</span>
            </div>
            <div class="form-grid">
              <mat-form-field appearance="outline" class="field-month">
                <mat-label>Starting Month</mat-label>
                <mat-select formControlName="month" (selectionChange)="onMonthYearChange()">
                  @for (m of months; track m) {
                    <mat-option [value]="m.value">{{ m.name }}</mat-option>
                  }
                </mat-select>
                <mat-icon matSuffix color="primary">calendar_month</mat-icon>
                @if (isPreAdmissionMonthSelected()) {
                  <mat-hint style="color: #dc2626; font-weight: 600;">
                    ⚠️ Prior to admission (DOJ: {{ getSelectedStudentJoiningDate() | date:'dd MMM yyyy' }})
                  </mat-hint>
                }
                @if (!isPreAdmissionMonthSelected() && isTargetStudent) {
                  <mat-hint style="font-weight: 500;">
                    @if (isJoiningMonthAfterCutoffSelected()) {
                      <span style="color: #d97706;">
                        ⚠️ Joined after Day {{ cutoffDay }} ({{ getSelectedStudentJoiningDate() | date:'dd MMM' }}). Policy: will generate for {{ getNextRolledOverMonthName() }}.
                      </span>
                    }
                    @if (isRolledOverMonthSelected()) {
                      <span style="color: #2563eb;">
                        ✨ Billing begins from {{ getMonthName($safeNavigationMigration(form.get('month')?.value)) }} (DOJ: {{ getSelectedStudentJoiningDate() | date:'dd MMM' }}, after Day {{ cutoffDay }} cutoff)
                      </span>
                    }
                    @if (!isJoiningMonthAfterCutoffSelected() && !isRolledOverMonthSelected()) {
                      @if (isHybridStudent && hasDifferentStreamDates) {
                        <span style="color: #2563eb;">
                          👤 Hybrid DOJ: 🏫 School {{ targetSchoolJoiningDate | date:'dd MMM yyyy' }} • 🎯 Coaching {{ targetCoachingJoiningDate | date:'dd MMM yyyy' }}
                        </span>
                      } @else {
                        <span style="color: #2563eb;">
                          👤 Target student admission date: {{ getSelectedStudentJoiningDate() | date:'dd MMM yyyy' }}
                        </span>
                      }
                    }
                  </mat-hint>
                }
                @if (form.get('month')?.hasError('required')) {
                  <mat-error>Month is required</mat-error>
                }
              </mat-form-field>
    
              <mat-form-field appearance="outline" class="field-year">
                <mat-label>Year</mat-label>
                <mat-select formControlName="year" (selectionChange)="onMonthYearChange()">
                  @for (y of years; track y) {
                    <mat-option [value]="y">{{ y }}</mat-option>
                  }
                </mat-select>
                <mat-icon matSuffix color="primary">calendar_today</mat-icon>
                @if (form.get('year')?.hasError('required')) {
                  <mat-error>Year is required</mat-error>
                }
              </mat-form-field>
    
              <!-- Target Scope Mode Selector (Universal vs By School Class vs By Coaching Batch) -->
              @if (!data.targetStudentName && (hasSchoolModule || hasCoachingModule)) {
                <div class="scope-mode-box full-width">
                  <div class="scope-mode-label">Target Audience Scope</div>
                  <div class="scope-pills-row">
                    <button
                      type="button"
                      class="scope-pill-btn"
                      [class.active]="scopeMode === 'all'"
                      (click)="setScopeMode('all')" matButton="filled">
                      <mat-icon class="pill-ic">public</mat-icon>
                      <span>All Students (Universal)</span>
                    </button>
                    @if (hasSchoolModule) {
                      <button
                        type="button"
                        class="scope-pill-btn"
                        [class.active]="scopeMode === 'school'"
                        (click)="setScopeMode('school')" matButton="filled">
                        <mat-icon class="pill-ic">school</mat-icon>
                        <span>By School Class</span>
                      </button>
                    }
                    @if (hasCoachingModule) {
                      <button
                        type="button"
                        class="scope-pill-btn"
                        [class.active]="scopeMode === 'coaching'"
                        (click)="setScopeMode('coaching')" matButton="filled">
                        <mat-icon class="pill-ic">groups</mat-icon>
                        <span>By Coaching Batch</span>
                      </button>
                    }
                  </div>
                  <!-- Universal Bulk Mode Informational Callout -->
                  @if (scopeMode === 'all') {
                    <div class="universal-scope-callout">
                      <mat-icon class="uni-ic">auto_awesome</mat-icon>
                      <span><strong>Universal Bulk Billing Active:</strong> Invoices will be generated across all active school classes and coaching batches. Zero manual filtering needed.</span>
                    </div>
                  }
                </div>
              }
    
              <!-- Target School Class (Shown ONLY if 'By School Class' is active) -->
              @if (!data.targetStudentName && scopeMode === 'school' && hasSchoolModule) {
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Target School Class</mat-label>
                  <mat-select formControlName="classId" panelClass="smart-batch-panel invoice-dialog-select-panel" (selectionChange)="onClassSelectionChange($event.value)">
                    <mat-option value="">✨ All School Classes</mat-option>
                    @for (c of data.classes; track c) {
                      <mat-option [value]="c.id">
                        🏫 {{ c.name }}
                      </mat-option>
                    }
                  </mat-select>
                  <mat-icon matSuffix color="primary">school</mat-icon>
                </mat-form-field>
              }
    
              @if (scopeMode === 'school' && selectedClassWarning) {
                <div class="class-structure-warning-pill full-width">
                  <mat-icon class="warn-icon">warning</mat-icon>
                  <span>{{ selectedClassWarning }}</span>
                </div>
              }
              @if (scopeMode === 'school' && selectedClassFeeInfo !== null) {
                <div class="class-structure-success-pill full-width">
                  <mat-icon class="ok-icon">check_circle</mat-icon>
                  <span>Configured Matrix Fee: <strong>₹{{ selectedClassFeeInfo | number:'1.2-2' }}/mo</strong></span>
                </div>
              }
    
              <!-- Target Student for School Class (Optional - Defaults to All) -->
              @if (!data.targetStudentName && scopeMode === 'school' && form.get('classId')?.value && classStudents.length > 0) {
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Target Student (Optional - Defaults to All)</mat-label>
                  <mat-select formControlName="studentId" panelClass="smart-batch-panel invoice-dialog-select-panel" (closed)="studentSearchQuery = ''" (opened)="focusSearchInput()">
                    <!-- Sticky Search Box inside dropdown -->
                    <div class="dropdown-header-container" (click)="$event.stopPropagation()" (mousedown)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
                      <div class="dropdown-search-box">
                        <mat-icon class="search-box-icon">search</mat-icon>
                        <input
                          #classStudentSearchInput
                          type="text"
                          class="search-inner-input"
                          placeholder="Search student in class..."
                          [(ngModel)]="studentSearchQuery"
                          [ngModelOptions]="{standalone: true}"
                          (click)="$event.stopPropagation()"
                          (mousedown)="$event.stopPropagation()"
                          (keydown)="$event.stopPropagation()"
                          (input)="$event.stopPropagation()"
                          />
                        @if (studentSearchQuery) {
                          <button
                            type="button"
                            class="clear-mini-btn"
                            (click)="studentSearchQuery = ''; $event.stopPropagation()"
                            (mousedown)="$event.stopPropagation()" mat-icon-button>
                            <mat-icon>close</mat-icon>
                          </button>
                        }
                      </div>
                    </div>
                    <mat-option value="">✨ All Students in Class ({{ classStudents.length }} {{ classStudents.length === 1 ? 'Student' : 'Students' }})</mat-option>
                    @for (s of filteredClassStudents; track s) {
                      <mat-option [value]="s.id">
                        👤 {{ s.studentName }} {{ (s.schoolRollNumber || s.rollNumber) ? ' • Roll: ' + (s.schoolRollNumber || s.rollNumber) : '' }}
                      </mat-option>
                    }
                    @if (filteredClassStudents.length === 0 && studentSearchQuery) {
                      <mat-option disabled class="no-results-option">
                        No students match "{{ studentSearchQuery }}"
                      </mat-option>
                    }
                  </mat-select>
                  <mat-icon matSuffix color="primary">person</mat-icon>
                  @if (!form.get('studentId')?.value) {
                    <mat-hint>Will generate invoice for all {{ classStudents.length }} students</mat-hint>
                  }
                  @if (form.get('studentId')?.value) {
                    <mat-hint>Generating invoice for single selected student only</mat-hint>
                  }
                </mat-form-field>
              }
    
              <!-- Target Academic Class Filter (When 'By Coaching Batch' is active) -->
              @if (!data.targetStudentName && scopeMode === 'coaching' && hasSchoolModule) {
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Filter by Academic Class (Optional)</mat-label>
                  <mat-select [value]="coachingClassFilter" (selectionChange)="onCoachingClassFilterChange($event.value)" panelClass="smart-batch-panel invoice-dialog-select-panel">
                    <mat-option value="">✨ All Academic Classes</mat-option>
                    @for (c of data.classes; track c) {
                      <mat-option [value]="c.id">
                        🏫 {{ c.name }}
                      </mat-option>
                    }
                  </mat-select>
                  <mat-icon matSuffix color="primary">school</mat-icon>
                </mat-form-field>
              }
    
              <!-- Target Coaching Batch (Shown ONLY if 'By Coaching Batch' is active) -->
              @if (!data.targetStudentName && scopeMode === 'coaching' && hasCoachingModule) {
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Target Coaching Batch</mat-label>
                  <mat-select formControlName="batchId" panelClass="smart-batch-panel invoice-dialog-select-panel" (selectionChange)="onBatchSelectionChange($event.value)">
                    <mat-option value="">✨ All Coaching Batches {{ coachingClassFilter ? '(for selected class)' : '' }}</mat-option>
                    @for (b of filteredCoachingBatches; track b) {
                      <mat-option [value]="b.id">
                        🎯 {{ b.name }} (₹{{ b.standardMonthlyFee | number:'1.0-0' }}/mo){{ b.className ? ' [' + b.className + ']' : '' }} • {{ b.studentCount || 0 }} {{ (b.studentCount === 1) ? 'student' : 'students' }}
                      </mat-option>
                    }
                  </mat-select>
                  <mat-icon matSuffix color="primary">groups</mat-icon>
                </mat-form-field>
              }
    
              @if (scopeMode === 'coaching' && selectedBatchFeeInfo !== null) {
                <div class="class-structure-success-pill full-width">
                  <mat-icon class="ok-icon">check_circle</mat-icon>
                  <span>Configured Matrix Fee: <strong>₹{{ selectedBatchFeeInfo | number:'1.2-2' }}/mo</strong></span>
                </div>
              }
              @if (scopeMode === 'coaching' && selectedBatchFeeInfo === null && selectedBatchStandardFee !== null) {
                <div class="class-structure-success-pill full-width">
                  <mat-icon class="ok-icon">check_circle</mat-icon>
                  <span>Standard Batch Fee: <strong>₹{{ selectedBatchStandardFee | number:'1.2-2' }}/mo</strong></span>
                </div>
              }
              @if (scopeMode === 'coaching' && selectedBatchWarning) {
                <div class="class-structure-warning-pill full-width">
                  <mat-icon class="warn-icon">warning</mat-icon>
                  <span>{{ selectedBatchWarning }}</span>
                </div>
              }
    
              <!-- Target Student for Coaching Batch (Optional - Defaults to All) -->
              @if (!data.targetStudentName && scopeMode === 'coaching' && form.get('batchId')?.value && batchStudents.length > 0) {
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Target Student (Optional - Defaults to All)</mat-label>
                  <mat-select formControlName="studentId" panelClass="smart-batch-panel invoice-dialog-select-panel" (closed)="studentSearchQuery = ''" (opened)="focusSearchInput()">
                    <!-- Sticky Search Box inside dropdown -->
                    <div class="dropdown-header-container" (click)="$event.stopPropagation()" (mousedown)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
                      <div class="dropdown-search-box">
                        <mat-icon class="search-box-icon">search</mat-icon>
                        <input
                          #coachingStudentSearchInput
                          type="text"
                          class="search-inner-input"
                          placeholder="Search student in batch..."
                          [(ngModel)]="studentSearchQuery"
                          [ngModelOptions]="{standalone: true}"
                          (click)="$event.stopPropagation()"
                          (mousedown)="$event.stopPropagation()"
                          (keydown)="$event.stopPropagation()"
                          (input)="$event.stopPropagation()"
                          />
                        @if (studentSearchQuery) {
                          <button
                            type="button"
                            class="clear-mini-btn"
                            (click)="studentSearchQuery = ''; $event.stopPropagation()"
                            (mousedown)="$event.stopPropagation()" mat-icon-button>
                            <mat-icon>close</mat-icon>
                          </button>
                        }
                      </div>
                    </div>
                    <mat-option value="">✨ All Students in Batch ({{ batchStudents.length }} {{ batchStudents.length === 1 ? 'Student' : 'Students' }})</mat-option>
                    @for (s of filteredBatchStudents; track s) {
                      <mat-option [value]="s.id">
                        👤 {{ s.studentName }} {{ (s.coachingRollNumber || s.rollNumber) ? ' • Roll: ' + (s.coachingRollNumber || s.rollNumber) : '' }}
                      </mat-option>
                    }
                    @if (filteredBatchStudents.length === 0 && studentSearchQuery) {
                      <mat-option disabled class="no-results-option">
                        No students match "{{ studentSearchQuery }}"
                      </mat-option>
                    }
                  </mat-select>
                  <mat-icon matSuffix color="primary">person</mat-icon>
                  @if (!form.get('studentId')?.value) {
                    <mat-hint>Will generate invoice for all {{ batchStudents.length }} students in this batch</mat-hint>
                  }
                  @if (form.get('studentId')?.value) {
                    <mat-hint>Generating invoice for single selected student only</mat-hint>
                  }
                </mat-form-field>
              }
    
              @if (!data.targetStudentName && scopeMode === 'coaching' && form.get('batchId')?.value && !loadingBatchStudents && batchStudents.length === 0) {
                <div class="class-structure-warning-pill full-width">
                  <mat-icon class="warn-icon">info</mat-icon>
                  <span>No active students currently enrolled in this batch.</span>
                </div>
              }
    
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Payment Due Date</mat-label>
                <input matInput type="date" formControlName="dueDate" />
                <mat-icon matSuffix color="primary">event</mat-icon>
                <mat-hint>Parents will see this date on invoices and WhatsApp notifications</mat-hint>
                @if (form.get('dueDate')?.hasError('required')) {
                  <mat-error>Due Date is required</mat-error>
                }
              </mat-form-field>
            </div>
    
            <!-- Pre-Admission Warning Callout (Single student selected & pre-admission month chosen) -->
            @if (isPreAdmissionMonthSelected()) {
              <div class="pre-admission-warning-callout">
                <div class="warn-icon-wrap">
                  <mat-icon>gpp_maybe</mat-icon>
                </div>
                <div class="warn-body">
                  <div class="warn-header">
                    <strong>Pre-Admission Shield Active</strong>
                    <span class="warn-badge">BLOCKED</span>
                  </div>
                  <p class="warn-desc">
                    <strong>{{ getSelectedStudentName() }}</strong> was admitted on
                    <strong>{{ getSelectedStudentJoiningDate() | date:'dd MMM yyyy' }}</strong>.
                    Invoices cannot be generated for <strong>{{ getPeriodLabel() }}</strong> because this period falls before their date of admission.
                  </p>
                  <div class="warn-hint">
                    💡 <strong>Suggested Action:</strong> Choose <strong>{{ getSelectedStudentJoiningDate() | date:'MMMM yyyy' }}</strong> or a subsequent billing cycle.
                  </div>
                </div>
              </div>
            }

            <!-- Partial Stream Hybrid Notice (When one stream is active and the other is future) -->
            @if (!isPreAdmissionMonthSelected() && isPartialStreamActive()) {
              @if (getPartialStreamInfo(); as info) {
                <div class="partial-stream-callout">
                  <div class="stream-icon-wrap">
                    <mat-icon>alt_route</mat-icon>
                  </div>
                  <div class="stream-body">
                    <div class="stream-header">
                      <strong>Dual-Stream Hybrid Timeline</strong>
                      <span class="stream-badge">{{ info.activeStream | uppercase }} ONLY</span>
                    </div>
                    <p class="stream-desc">
                      <strong>{{ getSelectedStudentName() }}</strong> joined <strong>{{ info.activeStream }}</strong> on <strong>{{ info.activeDoj | date:'dd MMM yyyy' }}</strong> (Active).
                      Admission in <strong>{{ info.inactiveStream }}</strong> is on <strong>{{ info.inactiveDoj | date:'dd MMM yyyy' }}</strong>.
                      For <strong>{{ getPeriodLabel() }}</strong>, only <strong>{{ info.activeStream }}</strong> fee will be billed ({{ info.inactiveStream }} fee is ₹0).
                    </p>
                  </div>
                </div>
              }
            }

            <!-- Cutoff Admission Policy Callout (Single student selected & joining month chosen when DOJ > cutoffDay) -->
            @if (isJoiningMonthAfterCutoffSelected()) {
              <div class="cutoff-policy-callout">
                <div class="policy-icon-wrap">
                  <mat-icon>verified</mat-icon>
                </div>
                <div class="policy-body">
                  <div class="policy-header">
                    <strong>{{ getInstitutePolicyName() }} Admission Policy</strong>
                    <span class="policy-badge">ORIENTATION GRACE PERIOD</span>
                  </div>
                  <p class="policy-desc">
                    <strong>{{ getSelectedStudentName() }}</strong> was admitted on
                    <strong>{{ getSelectedStudentJoiningDate() | date:'dd MMM yyyy' }}</strong> (after Day {{ cutoffDay }} cutoff).
                    As per institute policy, <strong>{{ getSelectedStudentJoiningDate() | date:'MMMM yyyy' }}</strong> tuition fee is waived as an orientation period.
                    The generated invoice will automatically start from <strong>{{ getNextRolledOverMonthName() }}</strong>.
                  </p>
                </div>
              </div>
            }
    
            <!-- Live Preview -->
            <div class="preview-box">
              <div class="preview-header">
                <mat-icon class="preview-header-icon">receipt_long</mat-icon>
                <span>Invoice Preview</span>
              </div>
              <div class="preview-body">
                <div class="preview-item">
                  <span class="preview-label">Billing Cycle:</span>
                  <span
                    class="cycle-badge"
                    [style.background]="getSelectedCycleOption()?.bgColor"
                    [style.color]="getSelectedCycleOption()?.color"
                    [style.border-color]="getSelectedCycleOption()?.borderColor"
                  >{{ getSelectedCycleOption()?.label }}</span>
                </div>
                <div class="preview-item">
                  <span class="preview-label">Period Covered:</span>
                  <strong class="preview-val">{{ getEffectivePeriodLabel() }}</strong>
                </div>
                <div class="preview-item">
                  <span class="preview-label">Target Audience:</span>
                  <span class="preview-val highlight">{{ getSelectedScopeLabel() }}</span>
                </div>
                @if (getSelectedBatch()) {
                  <div class="preview-item">
                    <span class="preview-label">Amount / Student:</span>
                    <strong class="preview-val amount">₹{{ getInvoiceAmount() | number:'1.0-0' }}</strong>
                  </div>
                }
                <div class="preview-item">
                  <span class="preview-label">Initial Status:</span>
                  @if (!isPreAdmissionMonthSelected()) {
                    <span class="status-pill pending">Pending (FIFO Payable)</span>
                  }
                  @if (isPreAdmissionMonthSelected()) {
                    <span class="status-pill preadmission">🚫 Blocked (Pre-Admission)</span>
                  }
                </div>
              </div>
            </div>
    
          </mat-dialog-content>
    
          <mat-dialog-actions align="end" class="dialog-actions">
            <button type="button" (click)="onCancel()" [disabled]="saving" matButton="filled" class="app-button-cancel">Cancel</button>
            <button color="primary" type="submit"
              [disabled]="form.invalid || saving || isPreAdmissionMonthSelected()"
              [class.btn-blocked]="isPreAdmissionMonthSelected()"
              class="submit-btn" matButton="filled">
              @if (saving) {
                <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
              }
              @if (!saving && !isPreAdmissionMonthSelected()) {
                <mat-icon>rocket_launch</mat-icon>
              }
              @if (!saving && isPreAdmissionMonthSelected()) {
                <mat-icon>block</mat-icon>
              }
              <span>
                {{ saving ? 'Generating...' :
                (isPreAdmissionMonthSelected() ? 'Cannot Bill Pre-Admission Period' :
                (getSelectedStudentName() ? 'Generate ' + (getSelectedCycleOption()?.label || 'Monthly') + ' Invoice for ' + getSelectedStudentName() : 'Generate ' + (getSelectedCycleOption()?.label || 'Monthly') + ' Invoices')) }}
              </span>
            </button>
          </mat-dialog-actions>
        </form>
      </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      overflow: hidden;
    }

    .dialog-wrapper {
      padding: 0;
      box-sizing: border-box;
      width: 100%;
      max-width: 100%;
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
      overflow: hidden;
    }

    form {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
      overflow: hidden;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px 24px 16px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;

      .header-icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }

      .header-titles {
        flex: 1 1 auto;
        .main-title {
          margin: 0;
          font-size: 1.18rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.3;
        }
        .subtitle {
          margin: 3px 0 0;
          font-size: 0.79rem;
          color: #3b82f6;
        }
      }

      .close-btn { color: #64748b; }
    }

    .dialog-content {
      padding: 16px 24px 20px;
      flex: 1 1 auto;
      min-height: 0;
      max-height: calc(88vh - 140px);
      overflow-y: auto;
      box-sizing: border-box;
    }

    .single-student-facility-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.74rem;
      color: #1e40af;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 6px 12px;
      border-radius: 8px;
      margin-bottom: 2px;
      .hint-ic {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #2563eb;
        flex-shrink: 0;
      }
      strong { color: #1e3a8a; }
    }

    .target-student-card {
      background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
      border: 1.5px solid #93c5fd;
      border-radius: 10px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;

      .card-icon-pill {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: #3b82f6;
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

      .card-content {
        display: flex;
        flex-direction: column;
        gap: 3px;

        .st-main {
          display: flex;
          align-items: center;
          gap: 8px;

          .st-role-badge {
            font-size: 0.65rem;
            font-weight: 700;
            background: #dbeafe;
            color: #1d4ed8;
            padding: 1px 6px;
            border-radius: 4px;
            letter-spacing: 0.5px;

            &.hybrid {
              background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
              color: #ffffff;
            }
          }

          .st-name {
            font-size: 0.95rem;
            font-weight: 700;
            color: #0f172a;
          }

          .st-roll {
            font-size: 0.8rem;
            color: #64748b;
          }
        }

        .st-sub-details {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          row-gap: 4px;

          .sub-pill {
            font-size: 0.75rem;
            padding: 1px 8px;
            border-radius: 4px;
            font-weight: 500;

            &.school {
              background: #e0f2fe;
              color: #0369a1;
              border: 1px solid #bae6fd;
            }

            &.batch {
              background: #f3e8ff;
              color: #6b21a8;
              border: 1px solid #e9d5ff;
            }

            &.hybrid-tag {
              background: #fdf4ff;
              color: #7e22ce;
              border: 1px solid #f5d0fe;
              font-weight: 700;
            }

            &.school-doj {
              background: #eff6ff;
              color: #1d4ed8;
              border: 1px solid #bfdbfe;
              font-weight: 600;
            }

            &.coaching-doj {
              background: #f0fdf4;
              color: #15803d;
              border: 1px solid #bbf7d0;
              font-weight: 600;
            }

            &.doj {
              background: #fef3c7;
              color: #b45309;
              border: 1px solid #fde68a;
              font-weight: 600;
            }
          }
        }

        .st-hint {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.74rem;
          color: #1e40af;
          background: #eff6ff;
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid #bfdbfe;
          margin-top: 4px;
          .hint-icon { font-size: 15px; width: 15px; height: 15px; color: #2563eb; flex-shrink: 0; }
        }
      }
    }

    .autopilot-banner-callout {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      background: linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%);
      border: 1px solid #c7d2fe;
      border-left: 4px solid #6366f1;
      border-radius: 8px;
      margin-bottom: 8px;

      .autopilot-icon-pill {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: #4f46e5;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 2px 6px -1px rgba(79, 70, 229, 0.3);
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }

      .autopilot-body {
        flex: 1;

        .autopilot-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          strong {
            color: #312e81;
            font-size: 0.84rem;
            font-weight: 700;
          }
          .autopilot-badge {
            background: #e0e7ff;
            color: #4338ca;
            font-size: 0.65rem;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 4px;
            letter-spacing: 0.04em;
          }
        }

        .autopilot-desc {
          font-size: 0.78rem;
          color: #3730a3;
          line-height: 1.45;
          margin: 0 0 6px 0;
          strong {
            font-weight: 600;
            color: #1e1b4b;
          }
        }

        .autopilot-foot {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.74rem;
          color: #065f46;
          background: #ecfdf5;
          padding: 4px 8px;
          border-radius: 6px;
          border: 1px solid #a7f3d0;
          .shield-icon { font-size: 14px; width: 14px; height: 14px; color: #059669; }
          strong { font-weight: 700; }
        }
      }
    }

    .workflow-guide-callout {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      background: linear-gradient(135deg, #eff6ff 0%, #f0fdfa 100%);
      border: 1px solid #bfdbfe;
      border-left: 4px solid #2563eb;
      border-radius: 8px;
      margin-bottom: 8px;

      .guide-icon-pill {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 2px 6px -1px rgba(37, 99, 235, 0.3);
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }

      .guide-body {
        flex: 1;

        .guide-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          strong {
            color: #1e3a8a;
            font-size: 0.84rem;
            font-weight: 700;
          }
          .guide-pro-badge {
            background: #dbeafe;
            color: #1d4ed8;
            font-size: 0.65rem;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 4px;
            letter-spacing: 0.04em;
          }
        }

        .guide-text {
          font-size: 0.78rem;
          color: #1e40af;
          line-height: 1.45;
          margin: 0 0 6px 0;
          strong {
            font-weight: 600;
            color: #0f172a;
          }
        }

        .guide-foot {
          font-size: 0.73rem;
          color: #64748b;
          font-style: italic;
          line-height: 1.4;
        }
      }
    }

    .info-callout {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 13px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;

      .info-icon { color: #16a34a; font-size: 18px; width: 18px; height: 18px; margin-top: 1px; flex-shrink: 0; }
      .info-text { font-size: 0.79rem; color: #166534; line-height: 1.45; strong { font-weight: 700; } }
    }

    .section-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.76rem;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      margin-top: 14px;
      margin-bottom: 8px;

      .section-icon { font-size: 15px; width: 15px; height: 15px; color: #94a3b8; }
    }

    .cycle-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }

    .cycle-tile {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      padding: 12px 6px 10px;
      min-height: 80px;
      box-sizing: border-box;
      border: 2px solid #e2e8f0;
      border-radius: 10px;
      background: #f8fafc;
      cursor: pointer;
      transition: all 0.18s ease;
      outline: none;
      user-select: none;

      .cycle-icon { font-size: 22px; width: 22px; height: 22px; color: #94a3b8; transition: color 0.18s; margin-bottom: 2px; }
      .cycle-label { font-size: 0.78rem; font-weight: 700; color: #64748b; transition: color 0.18s; white-space: nowrap; }
      .cycle-desc  { font-size: 0.67rem; color: #94a3b8; text-align: center; line-height: 1.3; }

      &:hover:not(.selected) {
        border-color: var(--cycle-border, #93c5fd);
        background: var(--cycle-bg, #eff6ff);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        .cycle-icon, .cycle-label { color: var(--cycle-color, #2563eb); }
      }

      &.selected {
        border-color: #2563eb !important;
        background: #eff6ff !important;
        transform: translateY(-1px);
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25) !important;
        .cycle-icon { color: #2563eb !important; }
        .cycle-label { color: #1e40af !important; font-weight: 800; }
        .cycle-desc  { color: #2563eb !important; font-weight: 600; }
      }
    }

    .form-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      .field-month { flex: 1 1 260px; min-width: 220px; }
      .field-year  { flex: 0 0 150px; min-width: 140px; }
      .full-width  {
        width: 100%;
        flex: 1 1 100%;
        mat-select {
          width: 100%;
          display: block;
        }
      }

      .class-structure-warning-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        margin-top: -4px;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        color: #b91c1c;
        font-size: 0.8rem;
        font-weight: 500;
        .warn-icon { font-size: 16px; width: 16px; height: 16px; color: #dc2626; flex-shrink: 0; }
      }

      .class-structure-success-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        margin-top: -4px;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 8px;
        color: #15803d;
        font-size: 0.8rem;
        font-weight: 500;
        .ok-icon { font-size: 16px; width: 16px; height: 16px; color: #16a34a; flex-shrink: 0; }
      }
    }

    /* Scope Mode Selector */
    .scope-mode-box {
      margin-bottom: 2px;
      .scope-mode-label {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #475569;
        margin-bottom: 6px;
      }
      .scope-pills-row {
        display: flex;
        gap: 6px;
        background: #f1f5f9;
        padding: 4px;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
      }
      .scope-pill-btn {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px 10px;
        border: none;
        background: transparent;
        color: #64748b;
        font-size: 0.8rem;
        font-weight: 600;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;

        .pill-ic {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #94a3b8;
          transition: color 0.2s ease;
        }

        &:hover:not(.active) {
          color: #1e293b;
          background: rgba(255, 255, 255, 0.6);
        }

        &.active {
          background: #ffffff;
          color: #2563eb;
          font-weight: 700;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
          .pill-ic { color: #2563eb; }
        }
      }

      .universal-scope-callout {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 12px;
        margin-top: 8px;
        background: linear-gradient(135deg, #eff6ff 0%, #f0fdfa 100%);
        border: 1px solid #bfdbfe;
        border-left: 3px solid #2563eb;
        border-radius: 8px;
        font-size: 0.77rem;
        color: #1e40af;
        line-height: 1.45;

        .uni-ic {
          font-size: 17px;
          width: 17px;
          height: 17px;
          color: #2563eb;
          flex-shrink: 0;
        }
        strong {
          color: #0f172a;
        }
      }
    }

    .preview-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;

      .preview-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: #f1f5f9;
        border-bottom: 1px solid #e2e8f0;
        font-size: 0.73rem;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        .preview-header-icon { font-size: 14px; width: 14px; height: 14px; color: #94a3b8; }
      }

      .preview-body {
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .preview-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.82rem;
        .preview-label { color: #64748b; }
        .preview-val {
          color: #0f172a;
          font-weight: 600;
          &.highlight { color: #2563eb; }
          &.amount { color: #059669; font-size: 0.95rem; }
        }
      }

      .cycle-badge {
        display: inline-block;
        padding: 2px 9px;
        border-radius: 20px;
        border: 1px solid transparent;
        font-size: 0.72rem;
        font-weight: 700;
      }

      .status-pill {
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 0.71rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        &.pending { background: #fef3c7; color: #b45309; }
        &.preadmission { background: #fee2e2; color: #b91c1c; border: 1px solid #fecdd3; }
      }
    }

    .cutoff-policy-callout {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1px solid #bbf7d0;
      border-left: 4px solid #16a34a;
      border-radius: 8px;
      margin-bottom: 12px;
      animation: fadeInWarning 0.22s ease-in-out;

      .policy-icon-wrap {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: #16a34a;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 2px 6px -1px rgba(22, 163, 74, 0.35);
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }

      .policy-body {
        flex: 1;
        .policy-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          strong {
            color: #14532d;
            font-size: 0.84rem;
            font-weight: 700;
          }
          .policy-badge {
            background: #bbf7d0;
            color: #15803d;
            font-size: 0.65rem;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 4px;
            letter-spacing: 0.04em;
          }
        }
        .policy-desc {
          font-size: 0.78rem;
          color: #166534;
          line-height: 1.45;
          margin: 0;
          strong {
            font-weight: 700;
            color: #14532d;
          }
        }
      }
    }

    .pre-admission-warning-callout {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      background: linear-gradient(135deg, #fff1f2 0%, #fee2e2 100%);
      border: 1px solid #fecdd3;
      border-left: 4px solid #e11d48;
      border-radius: 8px;
      margin-bottom: 12px;
      animation: fadeInWarning 0.22s ease-in-out;

      .warn-icon-wrap {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: #e11d48;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 2px 6px -1px rgba(225, 29, 72, 0.35);
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }

      .warn-body {
        flex: 1;

        .warn-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          strong {
            color: #9f1239;
            font-size: 0.84rem;
            font-weight: 700;
          }
          .warn-badge {
            background: #ffe4e6;
            color: #be123c;
            font-size: 0.65rem;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 4px;
            letter-spacing: 0.04em;
          }
        }

        .warn-desc {
          font-size: 0.78rem;
          color: #881337;
          line-height: 1.45;
          margin: 0 0 6px 0;
          strong {
            font-weight: 700;
            color: #4c0519;
          }
        }

        .warn-hint {
          font-size: 0.73rem;
          color: #9f1239;
          line-height: 1.4;
          background: rgba(255, 255, 255, 0.7);
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px dashed #f43f5e;
          strong {
            font-weight: 700;
            color: #881337;
          }
        }
      }
    }

    .partial-stream-callout {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-left: 4px solid #2563eb;
      border-radius: 8px;
      margin-bottom: 12px;
      animation: fadeInWarning 0.22s ease-in-out;

      .stream-icon-wrap {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 2px 6px -1px rgba(37, 99, 235, 0.35);
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }

      .stream-body {
        flex: 1;

        .stream-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          strong {
            color: #1e3a8a;
            font-size: 0.84rem;
            font-weight: 700;
          }
          .stream-badge {
            background: #2563eb;
            color: #ffffff;
            font-size: 0.65rem;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 4px;
            letter-spacing: 0.04em;
          }
        }

        .stream-desc {
          font-size: 0.78rem;
          color: #1e40af;
          line-height: 1.45;
          margin: 0;
          strong {
            font-weight: 700;
            color: #0f172a;
          }
        }
      }
    }

    @keyframes fadeInWarning {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .dialog-actions {
      padding: 12px 24px 16px;
      border-top: 1px solid #e2e8f0;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      flex-shrink: 0;
      box-sizing: border-box;

      .submit-btn {
        height: 42px;
        font-weight: 600;
        padding: 0 20px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        &.btn-blocked {
          opacity: 0.6;
          cursor: not-allowed !important;
        }
      }
      .btn-spinner { margin-right: 4px; }
    }

    @media (max-width: 600px) {
      .dialog-wrapper { min-width: 100% !important; }
      .cycle-grid { grid-template-columns: repeat(2, 1fr); }
      .form-grid {
        flex-direction: column;
        .field-month, .field-year, .full-width { width: 100% !important; flex: 1 1 100% !important; }
      }
    }

    ::ng-deep .cdk-overlay-pane.invoice-dialog-select-panel,
    ::ng-deep .cdk-overlay-pane:has(.invoice-dialog-select-panel) {
      min-width: min(720px, calc(100vw - 48px)) !important;
      width: 100% !important;
      max-width: min(780px, calc(100vw - 32px)) !important;
    }

    ::ng-deep .mat-mdc-select-panel.invoice-dialog-select-panel,
    ::ng-deep .smart-batch-panel {
      min-width: 100% !important;
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;

      .dropdown-header-container,
      .dropdown-search-option {
        position: sticky !important;
        top: 0 !important;
        z-index: 100 !important;
        background: #ffffff !important;
        padding: 10px 14px !important;
        height: auto !important;
        border-bottom: 1px solid #e2e8f0 !important;
        cursor: default !important;
        opacity: 1 !important;
        line-height: normal !important;
        display: block !important;
        pointer-events: auto !important;
        user-select: auto !important;

        .dropdown-search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8fafc;
          border: 1.5px solid #cbd5e1;
          border-radius: 10px;
          padding: 8px 12px;
          width: 100%;
          box-sizing: border-box;
          pointer-events: auto !important;
          cursor: text !important;
          transition: border-color 0.2s, box-shadow 0.2s;

          &:focus-within {
            border-color: #2563eb;
            background: #ffffff;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
          }

          .search-box-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
            color: #64748b;
            flex-shrink: 0;
            pointer-events: none;
          }

          .search-inner-input {
            border: none;
            outline: none;
            background: transparent;
            font-size: 0.9rem;
            color: #0f172a;
            width: 100%;
            min-width: 0;
            flex: 1;
            font-family: inherit;
            pointer-events: auto !important;
            cursor: text !important;
            user-select: text !important;

            &::placeholder {
              color: #94a3b8;
              font-size: 0.88rem;
            }
          }

          .clear-mini-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            color: #94a3b8;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2px;
            width: 24px;
            height: 24px;
            pointer-events: auto !important;
            mat-icon { font-size: 16px; width: 16px; height: 16px; }
            &:hover { color: #475569; }
          }
        }
      }

      .mat-mdc-option {
        min-height: 44px !important;
        padding: 0 16px !important;

        .mdc-list-item__primary-text {
          width: 100% !important;
          display: block !important;
          font-size: 0.9rem;
          color: #1e293b;
        }

        &:hover:not(.mat-mdc-option-disabled) {
          background-color: #f1f5f9 !important;
        }

        &.mat-mdc-option-active {
          background-color: #eff6ff !important;
        }
      }

      .no-results-option {
        font-style: italic;
        color: #94a3b8;
        text-align: center;
        height: 44px;
        padding: 12px 16px !important;
      }
    }
  `]
})
export class GenerateInvoicesDialogComponent implements OnInit {
  @ViewChild('coachingStudentSearchInput') coachingStudentSearchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('classStudentSearchInput') classStudentSearchInput?: ElementRef<HTMLInputElement>;

  focusSearchInput(): void {
    setTimeout(() => {
      if (this.coachingStudentSearchInput?.nativeElement) {
        this.coachingStudentSearchInput.nativeElement.focus();
      } else if (this.classStudentSearchInput?.nativeElement) {
        this.classStudentSearchInput.nativeElement.focus();
      }
    }, 100);
  }

  form: FormGroup;
  saving = false;
  selectedCycle = 1;
  scopeMode: 'all' | 'school' | 'coaching' = 'all';

  billingCycles: BillingCycleOption[] = [
    { value: 1,  label: 'Monthly',     icon: 'calendar_view_month', description: '1 month',   color: '#2563eb', bgColor: '#eff6ff', borderColor: '#93c5fd' },
    { value: 3,  label: 'Quarterly',   icon: 'view_week',           description: '3 months',  color: '#7c3aed', bgColor: '#f5f3ff', borderColor: '#c4b5fd' },
    { value: 6,  label: 'Half-Yearly', icon: 'date_range',          description: '6 months',  color: '#d97706', bgColor: '#fffbeb', borderColor: '#fcd34d' },
    { value: 12, label: 'Yearly',      icon: 'event_available',     description: '12 months', color: '#059669', bgColor: '#f0fdf4', borderColor: '#6ee7b7' }
  ];

  months = [
    { value: 1, name: 'January' }, { value: 2, name: 'February' }, { value: 3, name: 'March' },
    { value: 4, name: 'April' },   { value: 5, name: 'May' },      { value: 6, name: 'June' },
    { value: 7, name: 'July' },    { value: 8, name: 'August' },   { value: 9, name: 'September' },
    { value: 10, name: 'October' },{ value: 11, name: 'November' },{ value: 12, name: 'December' }
  ];

  years: number[] = [];

  constructor(
    private fb: FormBuilder,
    private feesService: FeesService,
    private coachingService: CoachingService,
    private confirmDialog: ConfirmDialogService,
    private authService: AuthService,
    public settingsService: QuickSettingsService,
    private dialogRef: MatDialogRef<GenerateInvoicesDialogComponent, GenerateInvoicesResult | null>,
    @Inject(MAT_DIALOG_DATA) public data: GenerateInvoicesDialogData
  ) {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const defaultMonth = data?.defaultMonth ?? currentMonth;
    const defaultYear  = data?.defaultYear ?? today.getFullYear();
    this.years = [defaultYear - 1, defaultYear, defaultYear + 1];
    const defaultDueDate = `${defaultYear}-${String(defaultMonth).padStart(2, '0')}-10`;

    if (data?.defaultBatchId) {
      this.scopeMode = 'coaching';
    } else if (data?.defaultClassId) {
      this.scopeMode = 'school';
    } else {
      this.scopeMode = 'all';
    }

    this.form = this.fb.group({
      month:   [defaultMonth, [Validators.required]],
      year:    [defaultYear,  [Validators.required]],
      classId: [data?.defaultClassId || ''],
      batchId: [data?.defaultBatchId || ''],
      studentId: [data?.targetStudentId || ''],
      dueDate: [defaultDueDate,            [Validators.required]]
    });
  }

  batchStudents: any[] = [];
  loadingBatchStudents: boolean = false;
  classStudents: any[] = [];
  loadingClassStudents: boolean = false;
  studentSearchQuery: string = '';

  get filteredClassStudents(): any[] {
    if (!this.studentSearchQuery || !this.studentSearchQuery.trim()) {
      return this.classStudents;
    }
    const q = this.studentSearchQuery.trim().toLowerCase();
    return (this.classStudents || []).filter(s =>
      (s.studentName && s.studentName.toLowerCase().includes(q)) ||
      (s.schoolRollNumber && s.schoolRollNumber.toLowerCase().includes(q)) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(q)) ||
      (s.admissionNumber && s.admissionNumber.toLowerCase().includes(q))
    );
  }

  get filteredBatchStudents(): any[] {
    if (!this.studentSearchQuery || !this.studentSearchQuery.trim()) {
      return this.batchStudents;
    }
    const q = this.studentSearchQuery.trim().toLowerCase();
    return (this.batchStudents || []).filter(s =>
      (s.studentName && s.studentName.toLowerCase().includes(q)) ||
      (s.coachingRollNumber && s.coachingRollNumber.toLowerCase().includes(q)) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(q)) ||
      (s.admissionNumber && s.admissionNumber.toLowerCase().includes(q))
    );
  }

  selectedClassWarning: string = '';
  selectedClassFeeInfo: number | null = null;
  checkingClassStructure: boolean = false;

  coachingClassFilter: string = '';
  selectedBatchWarning: string = '';
  selectedBatchFeeInfo: number | null = null;
  selectedBatchStandardFee: number | null = null;

  get filteredCoachingBatches(): any[] {
    if (!this.coachingClassFilter) return this.data.batches || [];
    return (this.data.batches || []).filter(b => b.classId === this.coachingClassFilter || !b.classId);
  }

  get isTargetStudent(): boolean {
    return !!this.data?.targetStudentName || !!this.form?.get('studentId')?.value;
  }
  get hasSchoolModule(): boolean { return this.authService.hasSchoolModule(); }
  get hasCoachingModule(): boolean { return this.authService.hasCoachingModule(); }

  get cutoffDay(): number {
    return this.settingsService.admissionCutoffDay() || 20;
  }

  isCutoffRolledOver(): boolean {
    const jd = this.getSelectedStudentJoiningDate();
    if (!jd) return false;
    return jd.getDate() > this.cutoffDay;
  }

  get isHybridStudent(): boolean {
    const student = this.getSelectedStudent();
    if (student) {
      const isSchool = student.isSchoolStudent || !!student.classId;
      const isCoach = student.isCoachingStudent || !!student.batchId;
      if (isSchool && isCoach) return true;
      if (student.joiningDate && student.coachingJoiningDate) return true;
    }
    return !!((this.data?.isSchoolStudent && this.data?.isCoachingStudent) ||
              (this.data?.targetJoiningDate && this.data?.targetCoachingJoiningDate && this.data.targetJoiningDate !== this.data.targetCoachingJoiningDate));
  }

  get targetSchoolJoiningDate(): Date | null {
    const student = this.getSelectedStudent();
    const str = student?.joiningDate || this.data?.targetJoiningDate;
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  get targetCoachingJoiningDate(): Date | null {
    const student = this.getSelectedStudent();
    const str = student?.coachingJoiningDate || this.data?.targetCoachingJoiningDate;
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  get hasDifferentStreamDates(): boolean {
    const s = this.targetSchoolJoiningDate;
    const c = this.targetCoachingJoiningDate;
    if (!s || !c) return false;
    return s.getTime() !== c.getTime();
  }

  getInstitutePolicyName(): string {
    return this.authService.getInstituteName() || 'Institute';
  }

  isJoiningMonthAfterCutoffSelected(): boolean {
    const jd = this.getSelectedStudentJoiningDate();
    if (!jd || jd.getDate() <= this.cutoffDay) return false;
    const m = Number(this.form?.get('month')?.value);
    const y = Number(this.form?.get('year')?.value);
    return m === (jd.getMonth() + 1) && y === jd.getFullYear();
  }

  isRolledOverMonthSelected(): boolean {
    const jd = this.getSelectedStudentJoiningDate();
    if (!jd || jd.getDate() <= this.cutoffDay) return false;
    const m = Number(this.form?.get('month')?.value);
    const y = Number(this.form?.get('year')?.value);
    const rollDate = new Date(jd.getFullYear(), jd.getMonth() + 1, 1);
    return m === (rollDate.getMonth() + 1) && y === rollDate.getFullYear();
  }

  getNextRolledOverMonthName(): string {
    const jd = this.getSelectedStudentJoiningDate();
    if (!jd) return '';
    const nextDate = new Date(jd.getFullYear(), jd.getMonth() + 1, 1);
    return nextDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  getEffectivePeriodLabel(): string {
    const month = Number(this.form.get('month')?.value);
    const year  = Number(this.form.get('year')?.value);
    if (!month || !year) return '';

    let start = new Date(year, month - 1, 1);
    const isRolledOver = this.isJoiningMonthAfterCutoffSelected();

    if (isRolledOver) {
      start = new Date(year, month, 1);
    }

    if (this.selectedCycle === 1) {
      const label = start.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      return isRolledOver ? `${label} (Auto-Rollover)` : label;
    }

    const endDate = new Date(start.getFullYear(), start.getMonth() + this.selectedCycle, 0);
    const s = start.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    const e = endDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    const range = `${s} – ${e}`;
    return isRolledOver ? `${range} (Auto-Rollover)` : range;
  }

  getSelectedTargetClassName(): string {
    const classId = this.form?.get('classId')?.value || this.data?.defaultClassId;
    return this.data?.classes?.find(c => c.id === classId)?.name || '';
  }

  getSelectedTargetBatchName(): string {
    const batchId = this.form?.get('batchId')?.value || this.data?.defaultBatchId;
    return this.data?.batches?.find(b => b.id === batchId)?.name || '';
  }

  ngOnInit(): void {
    if (this.scopeMode === 'coaching' && this.form.get('batchId')?.value) {
      this.onBatchSelectionChange(this.form.get('batchId')?.value);
    } else if (this.form.get('classId')?.value) {
      this.onClassSelectionChange(this.form.get('classId')?.value);
    }
  }

  onCoachingClassFilterChange(classId: string): void {
    this.coachingClassFilter = classId || '';
    const currentBatchId = this.form.get('batchId')?.value;
    if (currentBatchId && this.coachingClassFilter) {
      const currentBatch = this.data.batches?.find(b => b.id === currentBatchId);
      if (currentBatch && currentBatch.classId !== this.coachingClassFilter) {
        this.form.get('batchId')?.setValue('');
        this.onBatchSelectionChange('');
      }
    }
  }

  onBatchSelectionChange(batchId: string): void {
    this.selectedBatchWarning = '';
    this.selectedBatchFeeInfo = null;
    this.selectedBatchStandardFee = null;
    this.batchStudents = [];
    this.form.patchValue({ studentId: '' });
    if (!batchId) return;

    const batch = this.data.batches?.find(b => b.id === batchId);
    if (batch?.standardMonthlyFee) {
      this.selectedBatchStandardFee = batch.standardMonthlyFee;
    }

    this.loadingBatchStudents = true;
    this.coachingService.getStudents(batchId).subscribe({
      next: (students) => {
        this.loadingBatchStudents = false;
        this.batchStudents = students || [];
      },
      error: () => {
        this.loadingBatchStudents = false;
        this.batchStudents = [];
      }
    });

    this.feesService.getClassFeeStructures(undefined, batchId).subscribe({
      next: (structs) => {
        const active = (structs || []).filter(s => s.isActive && s.amount > 0);
        if (active.length > 0) {
          this.selectedBatchFeeInfo = active.reduce((sum, s) => sum + s.amount, 0);
        }
      },
      error: () => {}
    });
  }

  onClassSelectionChange(classId: string): void {
    this.selectedClassWarning = '';
    this.selectedClassFeeInfo = null;
    this.classStudents = [];
    this.form.patchValue({ studentId: '' });
    if (!classId) return;

    this.loadingClassStudents = true;
    this.coachingService.getStudents(undefined, classId).subscribe({
      next: (students) => {
        this.loadingClassStudents = false;
        this.classStudents = students || [];
      },
      error: () => {
        this.loadingClassStudents = false;
        this.classStudents = [];
      }
    });

    this.checkingClassStructure = true;
    this.feesService.getClassFeeStructures(classId).subscribe({
      next: (structs) => {
        this.checkingClassStructure = false;
        const active = structs.filter(s => s.isActive && s.amount > 0);
        if (active.length === 0) {
          const className = this.data.classes?.find(c => c.id === classId)?.name || 'This Class';
          this.selectedClassWarning = `⚠️ No fee structure saved in Fee Matrix for '${className}'! Please configure and save Fee Matrix first.`;
        } else {
          this.selectedClassFeeInfo = active.reduce((sum, s) => sum + s.amount, 0);
        }
      },
      error: () => {
        this.checkingClassStructure = false;
      }
    });
  }

  selectCycle(value: number): void {
    this.selectedCycle = value;
  }

  onMonthYearChange(): void {
    const month = this.form.get('month')?.value;
    const year  = this.form.get('year')?.value;
    if (month && year) {
      this.form.get('dueDate')?.setValue(`${year}-${String(month).padStart(2, '0')}-10`);
    }
  }

  getMonthName(monthNum: number): string {
    return this.months.find(m => m.value === Number(monthNum))?.name || '';
  }

  getSelectedCycleOption(): BillingCycleOption | undefined {
    return this.billingCycles.find(c => c.value === this.selectedCycle);
  }

  getPeriodLabel(): string {
    const month = this.form.get('month')?.value;
    const year  = this.form.get('year')?.value;
    if (!month || !year) return '';
    const start = new Date(year, month - 1, 1);
    if (this.selectedCycle === 1) {
      return start.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    }
    const endDate = new Date(year, month - 1 + this.selectedCycle, 0);
    const s = start.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    const e = endDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
  }

  getSelectedScopeLabel(): string {
    if (this.data?.targetStudentName) {
      return `👤 ${this.data.targetStudentName}`;
    }
    const selectedStudentId = this.form.get('studentId')?.value;
    if (this.scopeMode === 'school') {
      const classId = this.form.get('classId')?.value;
      const c = classId ? this.data.classes?.find(x => x.id === classId) : null;
      if (selectedStudentId) {
        const st = this.classStudents.find(s => s.id === selectedStudentId);
        return `👤 ${st?.studentName || 'Selected Student'} • ${c?.name || 'School Class'}`;
      }
      return c ? `🏫 ${c.name} (${this.classStudents.length} Students)` : '🏫 All School Classes';
    }
    if (this.scopeMode === 'coaching') {
      const batchId = this.form.get('batchId')?.value;
      const b = batchId ? this.data.batches?.find(x => x.id === batchId) : null;
      if (selectedStudentId) {
        const st = this.batchStudents.find(s => s.id === selectedStudentId);
        return `👤 ${st?.studentName || 'Selected Student'} • ${b?.name || 'Coaching Batch'}`;
      }
      return b ? `🎯 ${b.name} (${this.batchStudents.length} Students)` : '🎯 All Coaching Batches';
    }
    return '✨ All Students (Universal Bulk)';
  }

  setScopeMode(mode: 'all' | 'school' | 'coaching'): void {
    this.scopeMode = mode;
    this.form.get('studentId')?.setValue('');
    if (mode === 'all') {
      this.form.get('classId')?.setValue('');
      this.form.get('batchId')?.setValue('');
      this.selectedClassWarning = '';
      this.selectedClassFeeInfo = null;
      this.batchStudents = [];
      this.classStudents = [];
    } else if (mode === 'school') {
      this.form.get('batchId')?.setValue('');
      this.batchStudents = [];
    } else if (mode === 'coaching') {
      this.form.get('classId')?.setValue('');
      this.classStudents = [];
    }
  }

  getSelectedBatch(): BatchDto | undefined {
    if (this.scopeMode !== 'coaching') return undefined;
    const batchId = this.form.get('batchId')?.value;
    if (!batchId) return undefined;
    return this.data.batches.find(x => x.id === batchId);
  }

  getInvoiceAmount(): number {
    const batch = this.getSelectedBatch();
    return batch ? batch.standardMonthlyFee * this.selectedCycle : 0;
  }

  onCancel(): void { this.dialogRef.close(null); }

  getSelectedStudent(): any | null {
    const selectedStudentId = this.form?.get('studentId')?.value;
    if (selectedStudentId) {
      const fromBatch = this.batchStudents.find(s => s.id === selectedStudentId);
      if (fromBatch) return fromBatch;
      const fromClass = this.classStudents.find(s => s.id === selectedStudentId);
      if (fromClass) return fromClass;
    }
    return null;
  }

  getSelectedStudentJoiningDate(): Date | null {
    const student = this.getSelectedStudent();

    let dSchool: Date | null = null;
    let dCoach: Date | null = null;

    const schoolStr = student?.joiningDate || this.data?.targetJoiningDate;
    if (schoolStr) {
      const d = new Date(schoolStr);
      if (!isNaN(d.getTime())) dSchool = d;
    }

    const coachStr = student?.coachingJoiningDate || this.data?.targetCoachingJoiningDate;
    if (coachStr) {
      const d = new Date(coachStr);
      if (!isNaN(d.getTime())) dCoach = d;
    }

    const isSchool = student?.isSchoolStudent ?? this.data?.isSchoolStudent ?? !!student?.classId;
    const isCoach = student?.isCoachingStudent ?? this.data?.isCoachingStudent ?? !!student?.batchId;

    if (isSchool && isCoach) {
      if (dSchool && dCoach) {
        return dSchool.getTime() <= dCoach.getTime() ? dSchool : dCoach;
      }
      return dCoach || dSchool || null;
    }

    if (isCoach && !isSchool) {
      return dCoach || dSchool || null;
    }

    return dSchool || dCoach || null;
  }

  isPartialStreamActive(): boolean {
    if (!this.isHybridStudent) return false;
    const dSchool = this.targetSchoolJoiningDate;
    const dCoach = this.targetCoachingJoiningDate;
    if (!dSchool || !dCoach || dSchool.getTime() === dCoach.getTime()) return false;

    const month = Number(this.form?.get('month')?.value);
    const year = Number(this.form?.get('year')?.value);
    if (!month || !year) return false;

    const periodEnd = new Date(year, month - 1 + this.selectedCycle, 0, 23, 59, 59, 999);
    const schoolActive = dSchool.getTime() <= periodEnd.getTime();
    const coachActive = dCoach.getTime() <= periodEnd.getTime();

    return (schoolActive && !coachActive) || (!schoolActive && coachActive);
  }

  getPartialStreamInfo(): { activeStream: string; inactiveStream: string; activeDoj: Date; inactiveDoj: Date } | null {
    const dSchool = this.targetSchoolJoiningDate;
    const dCoach = this.targetCoachingJoiningDate;
    if (!dSchool || !dCoach) return null;

    const month = Number(this.form?.get('month')?.value);
    const year = Number(this.form?.get('year')?.value);
    if (!month || !year) return null;

    const periodEnd = new Date(year, month - 1 + this.selectedCycle, 0, 23, 59, 59, 999);
    const schoolActive = dSchool.getTime() <= periodEnd.getTime();
    const coachActive = dCoach.getTime() <= periodEnd.getTime();

    if (!schoolActive && coachActive) {
      return {
        activeStream: 'Coaching',
        inactiveStream: 'School',
        activeDoj: dCoach,
        inactiveDoj: dSchool
      };
    }
    if (schoolActive && !coachActive) {
      return {
        activeStream: 'School',
        inactiveStream: 'Coaching',
        activeDoj: dSchool,
        inactiveDoj: dCoach
      };
    }
    return null;
  }

  getSelectedStudentName(): string {
    if (this.data?.targetStudentName) {
      return this.data.targetStudentName;
    }
    const student = this.getSelectedStudent();
    return student?.studentName || '';
  }

  isPreAdmissionMonthSelected(): boolean {
    const joiningDate = this.getSelectedStudentJoiningDate();
    if (!joiningDate) return false;

    const month = Number(this.form?.get('month')?.value);
    const year = Number(this.form?.get('year')?.value);
    if (!month || !year) return false;

    // Period End: last millisecond of the selected billing period
    const periodEnd = new Date(year, month - 1 + this.selectedCycle, 0, 23, 59, 59, 999);
    const dojStart = new Date(joiningDate.getFullYear(), joiningDate.getMonth(), joiningDate.getDate(), 0, 0, 0, 0);

    return dojStart.getTime() > periodEnd.getTime();
  }

  getPreAdmissionWarningMessage(): string {
    const joiningDate = this.getSelectedStudentJoiningDate();
    const studentName = this.getSelectedStudentName() || 'This student';
    if (!joiningDate) return '';
    const formattedDoj = joiningDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const period = this.getPeriodLabel();
    return `${studentName} was admitted on ${formattedDoj}. Invoices cannot be generated for ${period} because it falls before the student's admission date.`;
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving) return;

    if (this.isPreAdmissionMonthSelected()) {
      this.confirmDialog.alert('Pre-Admission Period', this.getPreAdmissionWarningMessage(), 'danger');
      return;
    }

    if (this.scopeMode === 'school' && this.selectedClassWarning) {
      this.confirmDialog.alert('Fee Matrix Required', this.selectedClassWarning, 'danger');
      return;
    }

    const val = this.form.getRawValue();
    const period = this.getPeriodLabel();
    const cycleLabel = this.getSelectedCycleOption()?.label || 'Monthly';
    const targetName = this.data.targetStudentName || this.getSelectedStudentName();

    const title = targetName
      ? `Generate ${cycleLabel} Invoice for ${targetName}?`
      : `Confirm ${cycleLabel} Invoice Generation`;

    let message = targetName
      ? `Are you sure you want to generate a ${cycleLabel} fee invoice for ${targetName} for ${period}?`
      : `Are you sure you want to generate ${cycleLabel} fee invoices for ${this.getSelectedScopeLabel()} (${period})? (Duplicate invoices will be safely skipped automatically).`;

    // Strict Policy Check: ONLY when student joined AFTER cutoff day (DOJ > cutoffDay, e.g. Day 20)
    const joiningDate = this.getSelectedStudentJoiningDate();
    if (targetName && joiningDate && joiningDate.getDate() > this.cutoffDay) {
      const dojDay = joiningDate.getDate();
      const dojMonth = joiningDate.getMonth() + 1;
      const dojYear = joiningDate.getFullYear();
      const selMonth = Number(val.month);
      const selYear = Number(val.year);

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const dojMonthName = monthNames[joiningDate.getMonth()];
      const nextMonthDate = new Date(dojYear, dojMonth, 1);
      const nextMonthName = monthNames[nextMonthDate.getMonth()];
      const nextYear = nextMonthDate.getFullYear();
      const instName = this.getInstitutePolicyName();

      let rolledOverPeriod = `${nextMonthName} ${nextYear}`;
      if (this.selectedCycle > 1) {
        const endDate = new Date(nextYear, nextMonthDate.getMonth() + this.selectedCycle, 0);
        rolledOverPeriod = `${nextMonthDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' })} – ${endDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' })}`;
      }

      if (selMonth === dojMonth && selYear === dojYear) {
        // User selected admission month: bill automatically rolls over to next month
        message = `Are you sure you want to generate a ${cycleLabel} fee invoice for ${targetName} for ${rolledOverPeriod}?\n\n📌 Note (${instName} Admission Policy):\n${targetName} was admitted on ${dojDay} ${dojMonthName} ${dojYear} (after Day ${this.cutoffDay} cutoff). ${dojMonthName} tuition fee is waived as an orientation grace period, so billing automatically starts from ${rolledOverPeriod}.`;
      } else if (selMonth === nextMonthDate.getMonth() + 1 && selYear === nextYear) {
        // User selected the rolled-over month directly
        message = `Are you sure you want to generate a ${cycleLabel} fee invoice for ${targetName} for ${rolledOverPeriod}?\n\n📌 Note (${instName} Admission Policy):\nSince ${targetName} was admitted on ${dojDay} ${dojMonthName} ${dojYear} (after Day ${this.cutoffDay} cutoff), fee billing begins from ${rolledOverPeriod}.`;
      }
    }

    const confirmBtn = targetName ? `Yes, Generate ${cycleLabel}` : `Yes, Generate ${cycleLabel} Invoices`;

    this.confirmDialog.confirm(
      title,
      message,
      confirmBtn,
      'Cancel',
      'info'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.executeInvoiceGeneration(val);
    });
  }

  private executeInvoiceGeneration(val: any): void {
    this.saving = true;
    const targetClassId = (this.scopeMode === 'school' && val.classId) ? val.classId : null;
    const targetBatchId = (this.scopeMode === 'coaching' && val.batchId) ? val.batchId : null;
    const targetStudentId = val.studentId || this.data?.targetStudentId || null;

    this.feesService.generateMonthlyInvoices({
      year:         Number(val.year),
      month:        Number(val.month),
      classId:      targetClassId,
      batchId:      targetBatchId,
      studentId:    targetStudentId,
      dueDate:      val.dueDate,
      billingCycle: this.selectedCycle,
      branchId:     this.authService.selectedBranchId() || null,
      autoBillNewAdmissionsFromDoj: true
    }).subscribe({
      next: res => { this.saving = false; this.dialogRef.close(res); },
      error: err => {
        this.saving = false;
        console.error('Failed to generate invoices', err);
        this.confirmDialog.alert('Generation Failed', err.error?.message || err.message || 'Failed to generate invoices', 'danger');
      }
    });
  }
}

