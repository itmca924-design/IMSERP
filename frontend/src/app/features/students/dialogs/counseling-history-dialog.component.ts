import { Component, Inject, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StudentDropoutRiskItemDto, StudentRetentionService, StudentRetentionInterventionDto } from '../../../core/services/student-retention.service';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';

export interface CounselingHistoryDialogData {
  student: StudentDropoutRiskItemDto;
}

@Component({
  selector: 'app-counseling-history-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    LocalDatetimePipe
  ],
  template: `
    <div class="dialog-wrapper">
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>history_edu</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">Intervention & Counseling History</h2>
          <p class="subtitle">Complete audit timeline of early warnings, counseling sessions and retention actions for <strong>{{ data.student.studentName }}</strong>.</p>
        </div>
        <button type="button" class="close-btn" (click)="onClose()" mat-icon-button>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Student Mini Summary -->
      <div class="student-mini-strip">
        <div class="strip-item">
          <span class="label">Student Name:</span>
          <span class="val bold">{{ data.student.studentName }}</span>
        </div>
        <div class="strip-item">
          <span class="label">Roll / Adm:</span>
          <span class="val">{{ data.student.rollNumber || '—' }} / {{ data.student.admissionNumber || '—' }}</span>
        </div>
        <div class="strip-item">
          <span class="label">Class/Batch:</span>
          <span class="val">{{ data.student.className || data.student.batchName || 'General' }}</span>
        </div>
        <div class="strip-item">
          <span class="label">Current Risk:</span>
          <span class="risk-tag" [ngClass]="data.student.riskLevel.toLowerCase()">
            {{ data.student.riskScore }}% ({{ data.student.riskLevel }})
          </span>
        </div>
      </div>

      <mat-dialog-content class="dialog-content">
        @if (loading) {
          <div class="loading-state">
            <mat-spinner diameter="36"></mat-spinner>
            <p>Loading historical intervention records...</p>
          </div>
        } @else if (interventions.length === 0) {
          <div class="empty-state">
            <mat-icon class="empty-icon">history_toggle_off</mat-icon>
            <h3>No Prior Counseling Logs</h3>
            <p>No interventions have been recorded for this student yet. Use the "Record Counseling" button to log the first meeting.</p>
          </div>
        } @else {
          <div class="timeline">
            @for (item of interventions; track item.id; let i = $index) {
              <div class="timeline-item">
                <div class="timeline-marker">
                  <div class="marker-dot" [ngClass]="getOutcomeClass(item.outcomeStatus)">
                    <mat-icon class="marker-icon">{{ getOutcomeIcon(item.outcomeStatus) }}</mat-icon>
                  </div>
                  @if (i < interventions.length - 1) {
                    <div class="marker-line"></div>
                  }
                </div>
                <div class="timeline-card">
                  <div class="card-top">
                    <div class="meta-left">
                      <span class="channel-pill">{{ formatInterventionType(item.interventionType) }}</span>
                      <span class="outcome-pill" [ngClass]="getOutcomeClass(item.outcomeStatus)">
                        {{ formatOutcome(item.outcomeStatus) }}
                      </span>
                    </div>
                    <span class="date-badge">
                      <mat-icon>calendar_today</mat-icon>
                      {{ item.interventionDate | localDatetime:'datetime' }}
                    </span>
                  </div>

                  <div class="counselor-row">
                    <mat-icon class="counselor-ic">person</mat-icon>
                    <span>Counselor: <strong>{{ item.counselorName }}</strong></span>
                    <span class="sep">•</span>
                    <span>Cause: <strong>{{ formatReason(item.reasonForRisk) }}</strong></span>
                  </div>

                  @if (item.parentFeedback) {
                    <div class="feedback-box">
                      <div class="feedback-label">
                        <mat-icon>chat</mat-icon> Parent / Guardian Response:
                      </div>
                      <p class="feedback-text">{{ item.parentFeedback }}</p>
                    </div>
                  }

                  @if (item.actionNotes) {
                    <div class="action-box">
                      <div class="action-label">
                        <mat-icon>task</mat-icon> Action Taken / Internal Notes:
                      </div>
                      <p class="action-text">{{ item.actionNotes }}</p>
                    </div>
                  }

                  @if (item.nextFollowUpDate) {
                    <div class="followup-alert">
                      <mat-icon>alarm</mat-icon>
                      <span>Scheduled Next Follow-Up: <strong>{{ item.nextFollowUpDate | localDatetime:'date' }}</strong></span>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button (click)="onClose()" class="close-btn-bottom">Close</button>
      </mat-dialog-actions>
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

    .student-mini-strip {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 24px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;

      .strip-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
        color: #64748b;

        .label { font-weight: 500; }
        .val { color: #1e293b; }
        .bold { font-weight: 700; color: #0f172a; }

        .risk-tag {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 10px;
          text-transform: uppercase;

          &.critical { background: #fee2e2; color: #991b1b; }
          &.moderate { background: #fef3c7; color: #92400e; }
          &.safe { background: #dcfce7; color: #166534; }
        }
      }
    }

    .dialog-content {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1 1 auto;
    }

    .loading-state, .empty-state {
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: #64748b;

      mat-spinner { margin-bottom: 16px; }
      .empty-icon { font-size: 48px; width: 48px; height: 48px; color: #cbd5e1; margin-bottom: 12px; }
      h3 { margin: 0 0 6px; font-size: 1.1rem; color: #334155; }
      p { margin: 0; font-size: 0.85rem; max-width: 400px; line-height: 1.4; }
    }

    .timeline {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .timeline-item {
      display: flex;
      gap: 16px;
    }

    .timeline-marker {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 32px;
      flex-shrink: 0;

      .marker-dot {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        .marker-icon { font-size: 18px; width: 18px; height: 18px; color: #ffffff; }

        &.retained { background: #16a34a; }
        &.monitoring { background: #f59e0b; }
        &.relief { background: #2563eb; }
        &.tc { background: #dc2626; }
        &.unresponsive { background: #64748b; }
      }

      .marker-line {
        flex: 1 1 auto;
        width: 2px;
        background: #e2e8f0;
        margin: 6px 0;
      }
    }

    .timeline-card {
      flex: 1 1 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      display: flex;
      flex-direction: column;
      gap: 10px;

      .card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;

        .meta-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .channel-pill {
          font-size: 0.72rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 6px;
          background: #f1f5f9;
          color: #475569;
        }

        .outcome-pill {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 6px;

          &.retained { background: #dcfce7; color: #166534; }
          &.monitoring { background: #fef3c7; color: #92400e; }
          &.relief { background: #dbeafe; color: #1e40af; }
          &.tc { background: #fee2e2; color: #991b1b; }
          &.unresponsive { background: #f1f5f9; color: #475569; }
        }

        .date-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          color: #64748b;
          mat-icon { font-size: 14px; width: 14px; height: 14px; }
        }
      }

      .counselor-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
        color: #475569;
        flex-wrap: wrap;

        .counselor-ic { font-size: 16px; width: 16px; height: 16px; color: #64748b; }
        .sep { color: #cbd5e1; }
        strong { color: #1e293b; }
      }

      .feedback-box, .action-box {
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 0.8rem;

        .feedback-label, .action-label {
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 600;
          margin-bottom: 4px;
          mat-icon { font-size: 14px; width: 14px; height: 14px; }
        }

        p { margin: 0; line-height: 1.4; }
      }

      .feedback-box {
        background: #f8fafc;
        border-left: 3px solid #3b82f6;
        .feedback-label { color: #1d4ed8; }
        .feedback-text { color: #334155; }
      }

      .action-box {
        background: #f0fdf4;
        border-left: 3px solid #16a34a;
        .action-label { color: #15803d; }
        .action-text { color: #166534; }
      }

      .followup-alert {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: #fffbeb;
        border: 1px dashed #fcd34d;
        border-radius: 6px;
        font-size: 0.78rem;
        color: #92400e;
        mat-icon { font-size: 15px; width: 15px; height: 15px; }
      }
    }

    .dialog-actions {
      padding: 12px 24px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;

      .close-btn-bottom { color: #64748b; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CounselingHistoryDialogComponent implements OnInit {
  private retentionService = inject(StudentRetentionService);
  private dialogRef = inject(MatDialogRef<CounselingHistoryDialogComponent>);

  public data: CounselingHistoryDialogData = inject(MAT_DIALOG_DATA);

  loading = true;
  interventions: StudentRetentionInterventionDto[] = [];

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    if (!this.data?.student?.studentId) {
      this.loading = false;
      return;
    }
    this.loading = true;
    this.retentionService.getInterventions(this.data.student.studentId).subscribe({
      next: (list: StudentRetentionInterventionDto[]) => {
        this.interventions = list || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onClose(): void {
    this.dialogRef.close();
  }

  getOutcomeClass(status: string): string {
    switch (status) {
      case 'Retained': return 'retained';
      case 'UnderMonitoring': return 'monitoring';
      case 'FinancialReliefGiven': return 'relief';
      case 'TcRequested': return 'tc';
      default: return 'unresponsive';
    }
  }

  getOutcomeIcon(status: string): string {
    switch (status) {
      case 'Retained': return 'check';
      case 'UnderMonitoring': return 'pending';
      case 'FinancialReliefGiven': return 'currency_rupee';
      case 'TcRequested': return 'warning';
      default: return 'help_outline';
    }
  }

  formatOutcome(status: string): string {
    switch (status) {
      case 'Retained': return 'Retained (सुरक्षित)';
      case 'UnderMonitoring': return 'Under Monitoring';
      case 'FinancialReliefGiven': return 'Financial Relief Given';
      case 'TcRequested': return 'TC Requested';
      case 'Irresponsive': return 'No Response';
      default: return status;
    }
  }

  formatInterventionType(type: string): string {
    switch (type) {
      case 'ParentCounseling': return '🤝 Parent Meeting';
      case 'TelephonicOutreach': return '📞 Telephonic Call';
      case 'HomeVisit': return '🏡 Home Visit';
      case 'AcademicGuidance': return '📖 Academic Help';
      case 'FinancialReliefReview': return '💰 Fee Relief';
      case 'WhatsAppOutreach': return '💬 WhatsApp Outreach';
      default: return type;
    }
  }

  formatReason(reason: string): string {
    switch (reason) {
      case 'AcademicDifficulties': return 'Academic Difficulties';
      case 'FinancialDistress': return 'Financial Distress';
      case 'IrregularityAbsence': return 'Irregularity / Absence';
      case 'HealthOrMedical': return 'Medical / Health';
      case 'FamilyIssues': return 'Family Issues';
      case 'LackOfMotivation': return 'Lack of Motivation';
      case 'RelocationRelocating': return 'Relocation';
      default: return reason || 'General Monitoring';
    }
  }
}
