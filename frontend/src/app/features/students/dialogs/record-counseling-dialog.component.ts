import { Component, Inject, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StudentDropoutRiskItemDto, StudentRetentionService, StudentRetentionInterventionDto } from '../../../core/services/student-retention.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

export interface RecordCounselingDialogData {
  student: StudentDropoutRiskItemDto;
}

@Component({
  selector: 'app-record-counseling-dialog',
  standalone: true,
  imports: [
    CommonModule,
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
          <mat-icon>support_agent</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">Record Student Counseling Intervention</h2>
          <p class="subtitle">Log parent meeting, telephonic counseling & early intervention outcome for <strong>{{ data.student.studentName }}</strong>.</p>
        </div>
        <button type="button" class="close-btn" (click)="onCancel()" [disabled]="saving" mat-icon-button>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Student Mini Profile Card -->
      <div class="student-mini-banner">
        <div class="student-avatar-box">
          <mat-icon>school</mat-icon>
        </div>
        <div class="student-info-meta">
          <div class="name-row">
            <span class="st-name">{{ data.student.studentName }}</span>
            <span class="st-roll">(Roll: {{ data.student.rollNumber || 'N/A' }} | Adm: {{ data.student.admissionNumber || 'N/A' }})</span>
            <span class="risk-badge" [ngClass]="data.student.riskLevel.toLowerCase()">
              {{ data.student.riskScore }}% {{ data.student.riskLevel }} Risk
            </span>
          </div>
          <div class="details-row">
            <span><strong>Class/Batch:</strong> {{ data.student.className || data.student.batchName || 'General' }}</span>
            <span>•</span>
            <span><strong>Parent:</strong> {{ data.student.parentName }} ({{ data.student.parentPhone }})</span>
            <span>•</span>
            <span><strong>Attendance:</strong> {{ data.student.attendancePercentage }}%</span>
            <span>•</span>
            <span><strong>Overdue:</strong> ₹{{ data.student.overdueFeeAmount | number:'1.0-0' }} ({{ data.student.overdueFeeDays }}d)</span>
          </div>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-content">
          <div class="form-grid">

            <!-- Intervention Type -->
            <mat-form-field appearance="outline" class="col-half">
              <mat-label>Intervention Channel / Type</mat-label>
              <mat-select formControlName="interventionType">
                <mat-option value="ParentCounseling">🤝 In-Person Parent Meeting</mat-option>
                <mat-option value="TelephonicOutreach">📞 Telephonic Counseling</mat-option>
                <mat-option value="HomeVisit">🏡 Home Visit</mat-option>
                <mat-option value="AcademicGuidance">📖 Special Academic Guidance</mat-option>
                <mat-option value="FinancialReliefReview">💰 Financial Relief & EMI Discussion</mat-option>
                <mat-option value="WhatsAppCheckIn">💬 Empathetic WhatsApp Check-in</mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">hub</mat-icon>
            </mat-form-field>

            <!-- Counselor Name -->
            <mat-form-field appearance="outline" class="col-half">
              <mat-label>Counselor / Faculty Name</mat-label>
              <input matInput formControlName="counselorName" placeholder="e.g. Principal / Class Teacher" />
              <mat-icon matSuffix color="primary">person</mat-icon>
            </mat-form-field>

            <!-- Primary Reason for Risk -->
            <mat-form-field appearance="outline" class="col-half">
              <mat-label>Identified Root Cause (मूल कारण)</mat-label>
              <mat-select formControlName="reasonForRisk">
                <mat-option value="AcademicDifficulties">📉 Academic Struggle / Learning Difficulty</mat-option>
                <mat-option value="FinancialDistress">💳 Family Financial Difficulty / Fee Overdue</mat-option>
                <mat-option value="IrregularityAbsence">⏰ Chronic Irregularity / Long Distance Travel</mat-option>
                <mat-option value="HealthOrMedical">🏥 Health / Medical Issue</mat-option>
                <mat-option value="FamilyIssues">🏠 Family / Domestic Challenge</mat-option>
                <mat-option value="LackOfMotivation">🎯 Lack of Student Motivation / Peer Distraction</mat-option>
                <mat-option value="RelocationRelocating">🚚 Family Relocation / Shifting Town</mat-option>
                <mat-option value="Other">❓ Other Circumstances</mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">psychology</mat-icon>
            </mat-form-field>

            <!-- Outcome Status -->
            <mat-form-field appearance="outline" class="col-half">
              <mat-label>Counseling Outcome (अंतिम परिणाम)</mat-label>
              <mat-select formControlName="outcomeStatus">
                <mat-option value="Retained">✅ Successfully Retained (विद्यार्थी सुरक्षित)</mat-option>
                <mat-option value="UnderMonitoring">⏳ Under Active Monitoring (निगरानी में)</mat-option>
                <mat-option value="FinancialReliefGiven">💵 Financial Relief / Concession Approved</mat-option>
                <mat-option value="TcRequested">⚠️ Parent Requested TC / Transfer</mat-option>
                <mat-option value="Irresponsive">❌ Parent Unreachable / No Response</mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">task_alt</mat-icon>
            </mat-form-field>

            <!-- Next Follow-up Date -->
            <mat-form-field appearance="outline" class="col-half">
              <mat-label>Next Follow-Up Date (अगली समीक्षा तारीख)</mat-label>
              <input matInput type="date" formControlName="nextFollowUpDate" />
              <mat-icon matSuffix color="primary">event</mat-icon>
            </mat-form-field>

            <!-- Parent Feedback -->
            <mat-form-field appearance="outline" class="col-full">
              <mat-label>Parent / Guardian Feedback (अभिभावक का पक्ष)</mat-label>
              <textarea matInput rows="3" formControlName="parentFeedback" placeholder="What did the parent explain? Any commitments made?"></textarea>
              <mat-icon matSuffix color="primary">record_voice_over</mat-icon>
            </mat-form-field>

            <!-- Action Notes -->
            <mat-form-field appearance="outline" class="col-full">
              <mat-label>Remedial Action Taken & Internal Notes (कदम व आंतरिक निर्देश)</mat-label>
              <textarea matInput rows="2" formControlName="actionNotes" placeholder="e.g. Assigned remedial classes; Allowed 2-part fee payment; Follow-up in 10 days."></textarea>
              <mat-icon matSuffix color="primary">edit_note</mat-icon>
            </mat-form-field>

          </div>
        </mat-dialog-content>

        <mat-dialog-actions align="end" class="dialog-actions">
          <button type="button" (click)="onCancel()" [disabled]="saving" mat-button class="cancel-btn">
            Cancel
          </button>
          <button type="submit" [disabled]="form.invalid || saving" mat-flat-button color="primary" class="submit-btn">
            @if (saving) {
              <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
            } @else {
              <mat-icon>save</mat-icon>
            }
            <span>{{ saving ? 'Saving Intervention...' : 'Record Intervention' }}</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
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
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px 24px 14px;
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
          font-size: 1.15rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.3;
        }
        .subtitle {
          margin: 3px 0 0;
          font-size: 0.8rem;
          color: #3b82f6;
          strong { color: #1e40af; }
        }
      }

      .close-btn { color: #64748b; &:hover { color: #1e293b; } }
    }

    .student-mini-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 24px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;

      .student-avatar-box {
        width: 38px;
        height: 38px;
        border-radius: 8px;
        background: #e0e7ff;
        color: #4338ca;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .student-info-meta {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: 2px;

        .name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;

          .st-name {
            font-size: 0.95rem;
            font-weight: 700;
            color: #0f172a;
          }
          .st-roll {
            font-size: 0.8rem;
            color: #64748b;
          }
          .risk-badge {
            font-size: 0.72rem;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 12px;
            text-transform: uppercase;
            letter-spacing: 0.3px;

            &.critical { background: #fee2e2; color: #991b1b; }
            &.moderate { background: #fef3c7; color: #92400e; }
            &.safe { background: #dcfce7; color: #166534; }
          }
        }

        .details-row {
          font-size: 0.78rem;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;

          strong { color: #334155; }
        }
      }
    }

    form {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
    }

    .dialog-content {
      padding: 18px 24px;
      overflow-y: auto;
      flex: 1 1 auto;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;

      .col-half {
        grid-column: span 1;
        width: 100%;
      }

      .col-full {
        grid-column: span 2;
        width: 100%;
      }

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
        .col-half {
          grid-column: span 1;
        }
        .col-full {
          grid-column: span 1;
        }
      }
    }

    .dialog-actions {
      padding: 14px 24px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      display: flex;
      justify-content: flex-end;
      gap: 10px;

      .cancel-btn {
        color: #64748b;
      }

      .submit-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecordCounselingDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private retentionService = inject(StudentRetentionService);
  private authService = inject(AuthService);
  private dialogRef = inject(MatDialogRef<RecordCounselingDialogComponent>);
  private confirmDialog = inject(ConfirmDialogService);

  @Inject(MAT_DIALOG_DATA) public data!: RecordCounselingDialogData;

  form!: FormGroup;
  saving = false;

  ngOnInit(): void {
    const currentUserName = this.authService.currentUser()?.fullName || this.authService.currentUser()?.username || 'Class Counselor';

    // Default follow up date: 7 days from now
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const yyyy = nextWeek.getFullYear();
    const mm = String(nextWeek.getMonth() + 1).padStart(2, '0');
    const dd = String(nextWeek.getDate()).padStart(2, '0');
    const defaultDateStr = `${yyyy}-${mm}-${dd}`;

    this.form = this.fb.group({
      interventionType: ['ParentCounseling', Validators.required],
      counselorName: [currentUserName, Validators.required],
      reasonForRisk: [this.determineDefaultRiskReason(), Validators.required],
      outcomeStatus: ['UnderMonitoring', Validators.required],
      nextFollowUpDate: [defaultDateStr],
      parentFeedback: ['', [Validators.required, Validators.minLength(5)]],
      actionNotes: ['']
    });
  }

  private determineDefaultRiskReason(): string {
    const s = this.data.student;
    if (s.attendancePercentage < 65 || s.consecutiveAbsentDays >= 3) return 'IrregularityAbsence';
    if (s.overdueFeeAmount > 2000) return 'FinancialDistress';
    if (s.latestTestPercentage !== undefined && s.latestTestPercentage < 40) return 'AcademicDifficulties';
    return 'Other';
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving) return;

    this.saving = true;
    const fv = this.form.value;

    this.retentionService.recordIntervention({
      studentId: this.data.student.studentId,
      interventionType: fv.interventionType,
      counselorName: fv.counselorName,
      reasonForRisk: fv.reasonForRisk,
      outcomeStatus: fv.outcomeStatus,
      nextFollowUpDate: fv.nextFollowUpDate ? fv.nextFollowUpDate : undefined,
      parentFeedback: fv.parentFeedback,
      actionNotes: fv.actionNotes
    }).subscribe({
      next: (res: StudentRetentionInterventionDto) => {
        this.saving = false;
        this.confirmDialog.alert(
          'Intervention Recorded',
          `Successfully recorded counseling intervention for ${this.data.student.studentName}. Outcome logged as: ${res.outcomeStatus}.`,
          'success'
        );
        this.dialogRef.close(res);
      },
      error: (err: any) => {
        this.saving = false;
        this.confirmDialog.alert(
          'Recording Failed',
          err?.error?.message || err?.message || 'Unable to save counseling intervention. Please try again.',
          'danger'
        );
      }
    });
  }
}
