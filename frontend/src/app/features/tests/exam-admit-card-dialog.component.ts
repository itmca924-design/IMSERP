import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CoachingService, ExamAdmitCardDto, StudentAdmitCardItemDto } from '../../core/services/coaching.service';
import { AuthService } from '../../core/services/auth.service';

export interface ExamAdmitCardDialogData {
  testId: string;
  testTitle?: string;
}

@Component({
  selector: 'app-exam-admit-card-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatChipsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatSlideToggleModule
  ],
  template: `
    <div class="admit-modal-container">
      <!-- Modal Top Action Header -->
      <div class="modal-actions no-print">
        <div class="modal-title">
          <div class="title-badge">
            <mat-icon>confirmation_number</mat-icon>
          </div>
          <div class="title-text-group">
            <div class="title-row">
              <span class="main-title">Exam Admit Cards &amp; Hall Tickets</span>
              <span class="exam-title-badge" *ngIf="data.testTitle">{{ data.testTitle }}</span>
            </div>
            <span class="sub-title">परीक्षा प्रवेश पत्र &bull; Official Examination Controller</span>
          </div>
        </div>

        <div class="btn-group">
          <!-- Policy Switch (Routine / Weekly vs Strict Fee Policy) -->
          <div class="sharp-toggle-chip" 
               [class.chip-weekly]="allowAllStudents" 
               [class.chip-strict]="!allowAllStudents"
               (click)="allowAllStudents = !allowAllStudents"
               [matTooltip]="allowAllStudents ? 'Routine Mode: All students can sit (Click to switch to Strict)' : 'Strict Mode: Dues pending students held (Click to switch to Routine)'">
            <span class="indicator-dot"></span>
            <span class="chip-text">{{ allowAllStudents ? 'Weekly Mode' : 'Strict Fee Check' }}</span>
            <mat-icon class="toggle-icon">swap_horiz</mat-icon>
          </div>

          <!-- Dues on Print Switch -->
          <div class="sharp-toggle-chip" 
               *ngIf="allowAllStudents"
               [class.chip-due-on]="showDueNoticeOnPrint"
               [class.chip-due-off]="!showDueNoticeOnPrint"
               (click)="showDueNoticeOnPrint = !showDueNoticeOnPrint"
               [matTooltip]="showDueNoticeOnPrint ? 'Fee due printed on card (Click to hide)' : 'Fee due hidden from card (Click to show)'">
            <mat-icon class="chip-icon">{{ showDueNoticeOnPrint ? 'receipt_long' : 'visibility_off' }}</mat-icon>
            <span class="chip-text">{{ showDueNoticeOnPrint ? 'Fee on Card: Show' : 'Fee on Card: Hide' }}</span>
          </div>

          <div class="header-divider"></div>

          <button mat-flat-button class="header-action-btn wa-btn" (click)="shareWhatsApp()" [disabled]="!activeStudent" matTooltip="Send Admit Card on Parent WhatsApp">
            <svg class="wa-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            <span>WhatsApp</span>
          </button>

          <button mat-flat-button class="header-action-btn print-btn" (click)="printAdmitCard()" [disabled]="filteredStudents.length === 0" matTooltip="Print Hall Ticket">
            <mat-icon>print</mat-icon>
            <span>{{ printAllBatchMode ? 'Print All (' + filteredStudents.length + ')' : 'Print Current' }}</span>
          </button>

          <button mat-icon-button class="header-close-btn" (click)="dialogRef.close()" matTooltip="Close (Esc)">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Controls & Candidate Switcher Strip -->
      <div class="controls-strip no-print" *ngIf="!loading && admitCardData">
        <div class="strip-left">
          <!-- Student Selector -->
          <mat-form-field appearance="outline" class="student-select-field" subscriptSizing="dynamic">
            <mat-label>Select Candidate</mat-label>
            <mat-select [(ngModel)]="selectedStudentId" (selectionChange)="onStudentSelect($event.value)">
              <mat-option *ngFor="let s of filteredStudents" [value]="s.studentId">
                {{ s.rollNumber }} &bull; {{ s.studentName }} {{ !s.isFeeCleared ? '(Due: ₹' + s.outstandingDue + ')' : '' }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Search Filter -->
          <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
            <mat-label>Quick Search...</mat-label>
            <input matInput [(ngModel)]="searchQuery" (input)="applyFilter()" placeholder="Name / Roll No">
            <mat-icon matPrefix>search</mat-icon>
          </mat-form-field>
        </div>

        <div class="strip-right">
          <!-- Fee Filter Pills -->
          <div class="fee-filter-group">
            <button class="filter-pill" [class.active]="feeFilter === 'ALL'" (click)="setFeeFilter('ALL')">
              All ({{ admitCardData.students.length }})
            </button>
            <button class="filter-pill cleared" [class.active]="feeFilter === 'CLEARED'" (click)="setFeeFilter('CLEARED')">
              Fee Cleared ({{ countCleared }})
            </button>
            <button class="filter-pill dues" [class.active]="feeFilter === 'DUES'" (click)="setFeeFilter('DUES')">
              Dues Pending ({{ countDues }})
            </button>
          </div>

          <!-- Print Mode Selector -->
          <button class="print-mode-btn" [class.active]="printAllBatchMode" (click)="togglePrintAllMode()" matTooltip="Switch between printing single student or all batch hall tickets">
            <mat-icon>{{ printAllBatchMode ? 'layers' : 'person' }}</mat-icon>
            <span>{{ printAllBatchMode ? 'Mode: All Batch' : 'Mode: Single' }}</span>
          </button>
        </div>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <!-- Empty State -->
      <div class="empty-box no-print" *ngIf="!loading && filteredStudents.length === 0">
        <mat-icon class="empty-icon">person_off</mat-icon>
        <h4>No Candidates Found</h4>
        <p>No active students match your selected search or fee status filter.</p>
        <button mat-stroked-button color="primary" (click)="resetFilters()">Reset Filter</button>
      </div>

      <!-- Printable Area -->
      <div class="admit-paper-scroll" id="admit-paper-container" *ngIf="!loading && admitCardData && filteredStudents.length > 0">

        <!-- When in Single Mode: Render activeStudent -->
        <ng-container *ngIf="!printAllBatchMode && activeStudent">
          <div class="hall-ticket-paper" id="hall-ticket-paper">
            <ng-container *ngTemplateOutlet="admitCardCardTpl; context: { student: activeStudent }"></ng-container>
          </div>
        </ng-container>

        <!-- When in Batch Mode: Render all filtered students with page-break-after -->
        <ng-container *ngIf="printAllBatchMode">
          <div class="batch-print-wrapper" id="hall-ticket-paper">
            <div *ngFor="let st of filteredStudents; let last = last" class="hall-ticket-paper" [class.page-break]="!last">
              <ng-container *ngTemplateOutlet="admitCardCardTpl; context: { student: st }"></ng-container>
            </div>
          </div>
        </ng-container>

      </div>

      <!-- Reusable Single Admit Card Template -->
      <ng-template #admitCardCardTpl let-student="student">
        <div class="ticket-border">
          <!-- Header -->
          <div class="ticket-header">
            <div class="inst-info">
              <div class="logo-mark" [class.has-img]="logoUrl && !logoFailed">
                <img *ngIf="logoUrl && !logoFailed" [src]="logoUrl" (error)="logoFailed = true" alt="Logo" class="inst-logo-img">
                <mat-icon *ngIf="!logoUrl || logoFailed">school</mat-icon>
              </div>
              <div class="inst-details">
                <h2 class="inst-name">{{ instituteName }}</h2>
                <p class="inst-sub">Center for Academic Excellence & Competitive Coaching</p>
                <p class="inst-branch" *ngIf="admitCardData?.branchName">
                  Center / Campus: <strong>{{ admitCardData?.branchName }}</strong> &bull; Examination Division
                </p>
              </div>
            </div>

            <div class="admit-badge-block">
              <span class="badge-title">EXAM ADMIT CARD</span>
              <span class="badge-sub">परीक्षा प्रवेश पत्र (हॉल टिकट)</span>
              <span class="copy-tag">STUDENT ORIGINAL COPY</span>
            </div>
          </div>

          <!-- Exam Details Strip -->
          <div class="exam-strip">
            <div class="strip-item">
              <span class="lbl">Examination:</span>
              <span class="val highlight">{{ admitCardData?.examTitle }}</span>
            </div>
            <div class="strip-item">
              <span class="lbl">Subject:</span>
              <span class="val">{{ admitCardData?.subject }}</span>
            </div>
            <div class="strip-item">
              <span class="lbl">Exam Date &amp; Time:</span>
              <span class="val highlight">{{ formatToIST(admitCardData?.examDate) }}, {{ getExamTimeIST(admitCardData?.examDate) }}</span>
            </div>
            <div class="strip-item">
              <span class="lbl">Reporting Time (IST):</span>
              <span class="val text-danger">{{ getReportingTimeIST(admitCardData?.examDate, student.reportingTime) }} <small class="prior-hint">(15m prior)</small></span>
            </div>
            <div class="strip-item">
              <span class="lbl">Duration / Max:</span>
              <span class="val">{{ student.examDuration }} &bull; {{ admitCardData?.maxMarks }} Marks</span>
            </div>
          </div>

          <!-- Candidate Details & Photo Area -->
          <div class="candidate-box">
            <div class="candidate-info-grid">
              <div class="info-row">
                <span class="k">Candidate Name:</span>
                <span class="v name-highlight">{{ student.studentName }}</span>
              </div>
              <div class="info-row">
                <span class="k">Exam Roll No:</span>
                <span class="v roll-highlight">{{ student.examRollNumber }}</span>
              </div>
              <div class="info-row">
                <span class="k">Class / Batch:</span>
                <span class="v">{{ student.batchName }}</span>
              </div>
              <div class="info-row">
                <span class="k">Admission Roll No:</span>
                <span class="v">{{ student.rollNumber }}</span>
              </div>
              <div class="info-row">
                <span class="k">Father / Guardian:</span>
                <span class="v">{{ student.parentName }}</span>
              </div>
              <div class="info-row">
                <span class="k">Emergency Contact:</span>
                <span class="v">{{ student.parentWhatsAppPhone }}</span>
              </div>
              <div class="info-row">
                <span class="k">Exam Center:</span>
                <span class="v">{{ student.centerName }}</span>
              </div>

              <!-- Fee Clearance Notice -->
              <div class="info-row fee-status-row">
                <span class="k">Fee Status:</span>
                <span class="v">
                  <span class="fee-pill cleared" *ngIf="student.isFeeCleared">
                    <mat-icon>verified</mat-icon> CLEARED &bull; VERIFIED
                  </span>
                  <span class="fee-pill dues" *ngIf="!student.isFeeCleared && allowAllStudents && showDueNoticeOnPrint">
                    <mat-icon>info</mat-icon> PROVISIONAL (Due: ₹{{ student.outstandingDue | number:'1.2-2' }})
                  </span>
                  <span class="fee-pill cleared" *ngIf="!student.isFeeCleared && allowAllStudents && !showDueNoticeOnPrint">
                    <mat-icon>verified</mat-icon> ELIGIBLE &bull; WEEKLY TEST PASS
                  </span>
                  <span class="fee-pill dues-blocked" *ngIf="!student.isFeeCleared && !allowAllStudents">
                    <mat-icon>warning</mat-icon> DUES PENDING (Clearance Required)
                  </span>
                </span>
              </div>
            </div>

            <!-- Student Photo Frame -->
            <div class="photo-frame">
              <img *ngIf="student.photoUrl" [src]="student.photoUrl" alt="Candidate Photo" class="photo-img">
              <div *ngIf="!student.photoUrl" class="photo-placeholder">
                <mat-icon>person</mat-icon>
                <span>AFFIX PASSPORT<br>PHOTO HERE</span>
              </div>
              <span class="photo-label">CANDIDATE</span>
            </div>
          </div>

          <!-- Official Candidate Instructions -->
          <div class="instructions-box">
            <span class="inst-heading">Important Instructions for Candidates / महत्वपूर्ण निर्देश:</span>
            <ol>
              <li>Candidate must be seated in the examination hall at least <strong>15 minutes</strong> prior to the reporting time.</li>
              <li>This Admit Card and Institute Student ID Card must be placed on the desk during the entire examination.</li>
              <li>Electronic devices (smartphones, smartwatches, calculators) and unauthorized study notes are <strong>strictly prohibited</strong>.</li>
              <li>Use of unfair means will result in immediate disqualification and disciplinary cancellation of registration.</li>
            </ol>
          </div>

          <!-- Signatures & Verification Strip -->
          <div class="signatures-strip">
            <div class="sig-box">
              <div class="sig-line"></div>
              <span class="sig-title">Candidate's Signature</span>
              <small class="sig-sub">(परीक्षार्थी के हस्ताक्षर)</small>
            </div>

            <div class="sig-box center-seal">
              <div class="seal-stamp">
                <mat-icon>verified</mat-icon>
                <span>IMS-ERP EXAM CONTROLLER</span>
                <small>AUTHORIZED &bull; VERIFIED</small>
              </div>
            </div>

            <div class="sig-box">
              <div class="sig-line"></div>
              <span class="sig-title">Center Superintendent</span>
              <small class="sig-sub">Signature & Seal (केंद्राधीक्षक)</small>
            </div>
          </div>

          <!-- Ticket Footer -->
          <div class="ticket-footer">
            <span>Computer-generated examination hall ticket issued via IMSERP Enterprise Coaching Management System.</span>
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      margin: 0;
      padding: 0;
    }

    .admit-modal-container {
      width: 100%;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }

    /* ── Modal Actions Header ── */
    .modal-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 20px;
      background: #090d16;
      color: #ffffff;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      flex-shrink: 0;
      gap: 16px;

      .modal-title {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;

        .title-badge {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
          border: 1px solid rgba(255, 255, 255, 0.25);
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          flex-shrink: 0;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
        }

        .title-text-group {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;

          .title-row {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: nowrap;
          }

          .main-title {
            font-weight: 700;
            font-size: 0.98rem;
            color: #ffffff;
            letter-spacing: -0.015em;
            white-space: nowrap;
          }

          .exam-title-badge {
            display: inline-block;
            font-size: 0.72rem;
            font-weight: 600;
            color: #93c5fd;
            background: rgba(59, 130, 246, 0.15);
            border: 1px solid rgba(96, 165, 250, 0.3);
            padding: 1px 8px;
            border-radius: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 220px;
          }

          .sub-title {
            font-size: 0.72rem;
            color: #94a3b8;
            font-weight: 500;
            white-space: nowrap;
          }
        }
      }

      .btn-group {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;

        .sharp-toggle-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 32px;
          padding: 0 10px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          user-select: none;
          transition: all 0.15s ease;
          border: 1px solid transparent;
          white-space: nowrap;

          .indicator-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            flex-shrink: 0;
          }

          .toggle-icon {
            font-size: 15px;
            width: 15px;
            height: 15px;
            opacity: 0.7;
          }

          .chip-icon {
            font-size: 15px;
            width: 15px;
            height: 15px;
          }

          &.chip-weekly {
            background: rgba(16, 185, 129, 0.12);
            border-color: rgba(16, 185, 129, 0.35);
            color: #34d399;
            .indicator-dot {
              background: #10b981;
              box-shadow: 0 0 6px #10b981;
            }
            &:hover {
              background: rgba(16, 185, 129, 0.2);
              border-color: rgba(16, 185, 129, 0.55);
            }
          }

          &.chip-strict {
            background: rgba(245, 158, 11, 0.12);
            border-color: rgba(245, 158, 11, 0.4);
            color: #fbbf24;
            .indicator-dot {
              background: #f59e0b;
              box-shadow: 0 0 6px #f59e0b;
            }
            &:hover {
              background: rgba(245, 158, 11, 0.2);
              border-color: rgba(245, 158, 11, 0.6);
            }
          }

          &.chip-due-on {
            background: rgba(99, 102, 241, 0.12);
            border-color: rgba(99, 102, 241, 0.35);
            color: #a5b4fc;
            &:hover {
              background: rgba(99, 102, 241, 0.2);
            }
          }

          &.chip-due-off {
            background: rgba(148, 163, 184, 0.08);
            border-color: rgba(148, 163, 184, 0.22);
            color: #94a3b8;
            &:hover {
              background: rgba(148, 163, 184, 0.15);
            }
          }
        }

        .header-divider {
          width: 1px;
          height: 22px;
          background: rgba(255, 255, 255, 0.12);
          margin: 0 2px;
          flex-shrink: 0;
        }

        .header-action-btn {
          height: 32px !important;
          padding: 0 12px !important;
          border-radius: 6px !important;
          font-size: 0.78rem !important;
          font-weight: 600 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          letter-spacing: 0.01em !important;
          flex-shrink: 0 !important;
          transition: all 0.15s ease !important;

          mat-icon { font-size: 16px; width: 16px; height: 16px; }

          &.wa-btn {
            background: #16a34a !important;
            border: 1px solid #22c55e !important;
            color: #ffffff !important;
            box-shadow: 0 1px 4px rgba(22, 163, 74, 0.3);
            .wa-icon { width: 15px; height: 15px; fill: #ffffff; }
            &:hover:not(:disabled) {
              background: #15803d !important;
              border-color: #16a34a !important;
              transform: translateY(-1px);
              box-shadow: 0 2px 8px rgba(22, 163, 74, 0.4);
            }
          }

          &.print-btn {
            background: #2563eb !important;
            border: 1px solid #3b82f6 !important;
            color: #ffffff !important;
            box-shadow: 0 1px 4px rgba(37, 99, 235, 0.3);
            &:hover:not(:disabled) {
              background: #1d4ed8 !important;
              border-color: #2563eb !important;
              transform: translateY(-1px);
              box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
            }
          }
        }

        .header-close-btn {
          color: #cbd5e1 !important;
          width: 32px !important;
          height: 32px !important;
          min-width: 32px !important;
          padding: 0 !important;
          border-radius: 6px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          background: rgba(255, 255, 255, 0.05) !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-shrink: 0 !important;
          transition: all 0.15s ease !important;

          mat-icon { font-size: 18px; width: 18px; height: 18px; }

          &:hover {
            color: #ffffff !important;
            background: #ef4444 !important;
            border-color: #ef4444 !important;
          }
        }
      }
    }

    /* ── Controls & Filter Strip ── */
    .controls-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
      gap: 10px;

      .strip-left {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1 1 480px;

        .student-select-field {
          width: 250px;
          font-size: 0.84rem;
        }
        .search-field {
          width: 280px;
          flex: 1 1 240px;
          max-width: 340px;
          font-size: 0.84rem;
        }
      }

      .strip-right {
        display: flex;
        align-items: center;
        gap: 10px;

        .fee-filter-group {
          display: flex;
          background: #e2e8f0;
          padding: 2px;
          border-radius: 6px;

          .filter-pill {
            background: transparent;
            border: none;
            padding: 4px 10px;
            font-size: 0.74rem;
            font-weight: 600;
            color: #475569;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.15s ease;

            &.active {
              background: #ffffff;
              color: #0f172a;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            &.cleared.active { color: #16a34a; font-weight: 700; }
            &.dues.active { color: #dc2626; font-weight: 700; }
          }
        }

        .print-mode-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 5px 12px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 0.74rem;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }

          &.active {
            background: #eff6ff;
            border-color: #3b82f6;
            color: #2563eb;
            font-weight: 700;
          }
        }
      }
    }

    /* ── Printable Paper Container ── */
    .admit-paper-scroll {
      padding: 16px 20px;
      max-height: calc(88vh - 110px);
      overflow-y: auto;
      background: #f1f5f9;

      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 #f1f5f9;
      &::-webkit-scrollbar { width: 6px; }
      &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    }

    .hall-ticket-paper {
      max-width: 800px;
      margin: 0 auto 16px auto;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      border-radius: 6px;
      padding: 18px 24px;
      box-sizing: border-box;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      line-height: 1.4;
    }

    .ticket-border {
      border: 2px solid #0284c7;
      border-radius: 6px;
      padding: 16px 18px;
    }

    /* ── Ticket Header ── */
    .ticket-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 12px;
      border-bottom: 2px solid #0284c7;

      .inst-info {
        display: flex;
        align-items: center;
        gap: 14px;

        .logo-mark {
          width: 50px;
          height: 50px;
          border-radius: 10px;
          background: linear-gradient(135deg, #0284c7, #0369a1);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;

          &.has-img {
            background: #ffffff;
            border: 1px solid #bae6fd;
            padding: 2px;
          }

          .inst-logo-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }

          mat-icon { font-size: 28px; width: 28px; height: 28px; }
        }

        .inst-details {
          .inst-name {
            margin: 0;
            font-size: 1.35rem;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.01em;
          }
          .inst-sub {
            margin: 2px 0 0 0;
            font-size: 0.8rem;
            color: #475569;
          }
          .inst-branch {
            margin: 2px 0 0 0;
            font-size: 0.74rem;
            color: #0284c7;
            font-weight: 600;
          }
        }
      }

      .admit-badge-block {
        display: flex;
        flex-direction: column;
        align-items: flex-end;

        .badge-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: #0284c7;
          letter-spacing: 0.04em;
        }
        .badge-sub {
          font-size: 0.78rem;
          color: #64748b;
          font-weight: 600;
        }
        .copy-tag {
          margin-top: 3px;
          font-size: 0.65rem;
          font-weight: 700;
          background: #e0f2fe;
          color: #0369a1;
          padding: 2px 6px;
          border-radius: 3px;
          letter-spacing: 0.04em;
        }
      }
    }

    /* ── Exam Strip ── */
    .exam-strip {
      display: grid;
      grid-template-columns: 1.3fr 0.9fr 1.35fr 1.15fr 1fr;
      gap: 10px;
      padding: 8px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin: 12px 0;

      .strip-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
        .lbl { font-size: 0.68rem; color: #64748b; font-weight: 600; text-transform: uppercase; }
        .val {
          font-size: 0.84rem;
          font-weight: 700;
          color: #0f172a;
          &.highlight { color: #0284c7; }
          .prior-hint {
            font-size: 0.72rem;
            color: #b91c1c;
            font-weight: 600;
            margin-left: 2px;
          }
        }
      }
    }

    /* ── Candidate Box ── */
    .candidate-box {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin-bottom: 12px;

      .candidate-info-grid {
        flex: 1;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 16px;

        .info-row {
          display: flex;
          font-size: 0.84rem;
          .k { width: 140px; color: #64748b; font-weight: 500; flex-shrink: 0; }
          .v {
            color: #0f172a;
            font-weight: 600;
            &.name-highlight { font-size: 0.95rem; font-weight: 800; color: #0f172a; }
            &.roll-highlight { font-size: 0.95rem; font-weight: 800; color: #0284c7; }
          }

          &.fee-status-row {
            grid-column: 1 / -1;
            align-items: center;
          }
        }
      }

      .fee-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.72rem;
        font-weight: 700;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }

        &.cleared {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }
        &.dues {
          background: #fef3c7;
          color: #b45309;
          border: 1px solid #fde68a;
        }
        &.dues-blocked {
          background: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }
      }

      .photo-frame {
        width: 105px;
        height: 125px;
        border: 1.5px dashed #94a3b8;
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #f8fafc;
        flex-shrink: 0;
        position: relative;
        overflow: hidden;

        .photo-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .photo-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          color: #94a3b8;
          mat-icon { font-size: 32px; width: 32px; height: 32px; margin-bottom: 4px; }
          span { font-size: 0.58rem; font-weight: 700; line-height: 1.2; }
        }

        .photo-label {
          position: absolute;
          bottom: 0;
          width: 100%;
          background: rgba(15, 23, 42, 0.75);
          color: #ffffff;
          font-size: 0.58rem;
          font-weight: 700;
          text-align: center;
          padding: 2px 0;
          letter-spacing: 0.05em;
        }
      }
    }

    /* ── Instructions ── */
    .instructions-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 12px;

      .inst-heading {
        font-size: 0.74rem;
        font-weight: 700;
        color: #334155;
        display: block;
        margin-bottom: 4px;
      }
      ol {
        margin: 0 0 0 16px;
        padding: 0;
        font-size: 0.72rem;
        color: #475569;
        li { margin-bottom: 2px; }
      }
    }

    /* ── Signatures ── */
    .signatures-strip {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 18px;
      margin-bottom: 8px;

      .sig-box {
        width: 175px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;

        .sig-line {
          width: 100%;
          height: 1px;
          background: #475569;
          margin-bottom: 4px;
        }
        .sig-title {
          font-size: 0.75rem;
          font-weight: 700;
          color: #334155;
        }
        .sig-sub {
          font-size: 0.65rem;
          color: #64748b;
        }

        &.center-seal {
          width: 220px;
          .seal-stamp {
            border: 1.5px dashed #0284c7;
            border-radius: 6px;
            padding: 4px 10px;
            background: #f0f9ff;
            color: #0284c7;
            font-size: 0.68rem;
            font-weight: 800;
            display: flex;
            flex-direction: column;
            align-items: center;
            mat-icon { font-size: 16px; width: 16px; height: 16px; margin-bottom: 2px; }
            small { font-size: 0.6rem; color: #0369a1; font-weight: 600; }
          }
        }
      }
    }

    /* ── Ticket Footer ── */
    .ticket-footer {
      text-align: center;
      font-size: 0.66rem;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
    }

    .empty-box {
      text-align: center;
      padding: 40px 20px;
      color: #64748b;
      .empty-icon { font-size: 48px; width: 48px; height: 48px; color: #94a3b8; }
      h4 { margin: 8px 0 4px 0; color: #0f172a; }
      p { margin: 0 0 14px 0; font-size: 0.85rem; }
    }

    /* ── Responsive & Print Media ── */
    @media (max-width: 768px) {
      .modal-actions {
        padding: 8px 12px;
        .policy-toggle-pill { display: none; }
      }
      .controls-strip {
        flex-direction: column;
        align-items: stretch;
        .strip-left, .strip-right {
          width: 100%;
          flex-wrap: wrap;
        }
        .student-select-field, .search-field {
          width: 100%;
        }
      }
      .exam-strip {
        grid-template-columns: 1fr 1fr;
      }
      .candidate-box {
        flex-direction: column-reverse;
        align-items: center;
        .candidate-info-grid {
          grid-template-columns: 1fr;
        }
      }
      .signatures-strip {
        flex-direction: column;
        gap: 14px;
        align-items: center;
        .sig-box { width: 100%; }
      }
    }

    @media print {
      .no-print { display: none !important; }
      .admit-paper-scroll {
        padding: 0 !important;
        max-height: none !important;
        overflow: visible !important;
        background: #ffffff !important;
      }
      .hall-ticket-paper {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      .ticket-border {
        border: 2px solid #000000 !important;
      }
      .page-break {
        page-break-after: always !important;
        break-after: page !important;
      }
      @page {
        margin: 10mm;
        size: A4 portrait;
      }
    }
  `]
})
export class ExamAdmitCardDialogComponent implements OnInit {
  loading = true;
  admitCardData?: ExamAdmitCardDto;

  filteredStudents: StudentAdmitCardItemDto[] = [];
  selectedStudentId = '';
  searchQuery = '';
  feeFilter: 'ALL' | 'CLEARED' | 'DUES' = 'ALL';

  // Policy Switch: Allow all students (Weekly/Routine Mode) vs Strict Fee Check
  allowAllStudents = true;
  showDueNoticeOnPrint = true;
  printAllBatchMode = false;

  constructor(
    public dialogRef: MatDialogRef<ExamAdmitCardDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ExamAdmitCardDialogData,
    private coachingService: CoachingService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadAdmitCards();
  }

  logoFailed = false;

  get logoUrl(): string | null {
    return this.authService.getInstituteLogoUrl();
  }

  get instituteName(): string {
    return this.authService.currentUser()?.instituteName || 'Apex Coaching Academy';
  }

  get activeStudent(): StudentAdmitCardItemDto | undefined {
    return this.filteredStudents.find(s => s.studentId === this.selectedStudentId) || this.filteredStudents[0];
  }

  get countCleared(): number {
    return this.admitCardData?.students.filter(s => s.isFeeCleared).length || 0;
  }

  get countDues(): number {
    return this.admitCardData?.students.filter(s => !s.isFeeCleared).length || 0;
  }

  loadAdmitCards(): void {
    this.loading = true;
    this.coachingService.getTestAdmitCards(this.data.testId).subscribe({
      next: (res) => {
        this.admitCardData = res;
        this.applyFilter();
        if (this.filteredStudents.length > 0) {
          this.selectedStudentId = this.filteredStudents[0].studentId;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load admit cards:', err);
        this.loading = false;
      }
    });
  }

  applyFilter(): void {
    if (!this.admitCardData) return;

    let list = [...this.admitCardData.students];

    // Filter by fee status
    if (this.feeFilter === 'CLEARED') {
      list = list.filter(s => s.isFeeCleared);
    } else if (this.feeFilter === 'DUES') {
      list = list.filter(s => !s.isFeeCleared);
    }

    // Filter by search term
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(s =>
        s.studentName.toLowerCase().includes(q) ||
        s.rollNumber.toLowerCase().includes(q) ||
        s.examRollNumber.toLowerCase().includes(q)
      );
    }

    this.filteredStudents = list;
    if (this.filteredStudents.length > 0 && !this.filteredStudents.some(s => s.studentId === this.selectedStudentId)) {
      this.selectedStudentId = this.filteredStudents[0].studentId;
    }
  }

  setFeeFilter(filter: 'ALL' | 'CLEARED' | 'DUES'): void {
    this.feeFilter = filter;
    this.applyFilter();
  }

  onStudentSelect(studentId: string): void {
    this.selectedStudentId = studentId;
  }

  togglePrintAllMode(): void {
    this.printAllBatchMode = !this.printAllBatchMode;
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.feeFilter = 'ALL';
    this.applyFilter();
  }

  formatToIST(dateVal?: string | Date): string {
    if (!dateVal) return '-';
    let str = String(dateVal).trim();
    if (!str.endsWith('Z') && !str.includes('+') && str.includes('T')) {
      str += 'Z';
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return String(dateVal);

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(d);
  }

  getReportingTimeIST(dateVal?: string | Date, fallback?: string): string {
    if (!dateVal) return fallback || '15 Mins Prior';
    let str = String(dateVal).trim();
    if (!str.endsWith('Z') && !str.includes('+') && str.includes('T')) {
      str += 'Z';
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return fallback || '15 Mins Prior';

    // 15 minutes before the exam time in Indian Standard Time (IST)
    const repDate = new Date(d.getTime() - 15 * 60 * 1000);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(repDate).toUpperCase();
  }

  getExamTimeIST(dateVal?: string | Date): string {
    if (!dateVal) return '-';
    let str = String(dateVal).trim();
    if (!str.endsWith('Z') && !str.includes('+') && str.includes('T')) {
      str += 'Z';
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return '-';

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d).toUpperCase();
  }

  printAdmitCard(): void {
    const el = document.getElementById('hall-ticket-paper');
    if (!el) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=950,height=750');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Admit Card - ${this.admitCardData?.examTitle || 'Exam Hall Ticket'}</title>
          <style>
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 12px; color: #0f172a; }
            .hall-ticket-paper { max-width: 800px; margin: 0 auto 20px auto; }
            .ticket-border { border: 2px solid #0284c7; border-radius: 6px; padding: 16px 18px; }
            .ticket-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #0284c7; }
            .inst-info { display: flex; align-items: center; gap: 14px; }
            .logo-mark { width: 46px; height: 46px; border-radius: 8px; background: #0284c7; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; overflow: hidden; flex-shrink: 0; }
            .logo-mark.has-img { background: #fff; border: 1px solid #bae6fd; padding: 2px; }
            .inst-logo-img { width: 100%; height: 100%; object-fit: contain; }
            .inst-name { margin: 0; font-size: 1.35rem; font-weight: 800; color: #0f172a; }
            .inst-sub { margin: 2px 0 0 0; font-size: 0.8rem; color: #475569; }
            .inst-branch { margin: 2px 0 0 0; font-size: 0.74rem; color: #0284c7; font-weight: 600; }
            .admit-badge-block { display: flex; flex-direction: column; align-items: flex-end; }
            .badge-title { font-size: 1.15rem; font-weight: 800; color: #0284c7; }
            .badge-sub { font-size: 0.78rem; color: #64748b; font-weight: 600; }
            .copy-tag { margin-top: 3px; font-size: 0.65rem; font-weight: 700; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 3px; }
            .exam-strip { display: grid; grid-template-columns: 1.3fr 0.9fr 1.35fr 1.15fr 1fr; gap: 8px; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin: 12px 0; }
            .strip-item .lbl { font-size: 0.68rem; color: #64748b; font-weight: 600; text-transform: uppercase; }
            .strip-item .val { font-size: 0.85rem; font-weight: 700; color: #0f172a; }
            .candidate-box { display: flex; justify-content: space-between; gap: 16px; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 12px; }
            .candidate-info-grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
            .info-row { display: flex; font-size: 0.84rem; }
            .info-row .k { width: 140px; color: #64748b; font-weight: 500; }
            .info-row .v { color: #0f172a; font-weight: 600; }
            .photo-frame { width: 100px; height: 120px; border: 1.5px dashed #94a3b8; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; font-size: 0.6rem; color: #94a3b8; text-align: center; }
            .instructions-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 0.72rem; }
            .instructions-box ol { margin: 4px 0 0 16px; padding: 0; }
            .signatures-strip { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 18px; margin-bottom: 8px; }
            .sig-box { width: 175px; text-align: center; font-size: 0.75rem; font-weight: 700; }
            .sig-line { width: 100%; height: 1px; background: #475569; margin-bottom: 4px; }
            .seal-stamp { border: 1.5px dashed #0284c7; border-radius: 6px; padding: 4px 10px; background: #f0f9ff; color: #0284c7; font-size: 0.68rem; font-weight: 800; text-align: center; }
            .ticket-footer { text-align: center; font-size: 0.66rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px; }
            .fee-pill { padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; }
            .fee-pill.cleared { background: #dcfce7; color: #15803d; }
            .fee-pill.dues { background: #fef3c7; color: #b45309; }
            .page-break { page-break-after: always; break-after: page; }
            @page { margin: 10mm; size: A4 portrait; }
          </style>
        </head>
        <body>
          ${el.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }

  shareWhatsApp(): void {
    const st = this.activeStudent;
    if (!st || !st.parentWhatsAppPhone) return;

    const rawPhone = st.parentWhatsAppPhone.replace(/\D/g, '');
    const formattedPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;

    const feeNote = st.isFeeCleared
      ? `✅ *Fee Status*: Cleared & Verified`
      : `⚠️ *Fee Status*: Pending (₹${st.outstandingDue})`;

    const textMsg = `*EXAMINATION ADMIT CARD / HALL TICKET*\n` +
      `*Institute*: ${this.instituteName}\n` +
      `*Exam*: ${this.admitCardData?.examTitle || 'Test'}\n` +
      `*Subject*: ${this.admitCardData?.subject || 'All'}\n` +
      `*Exam Date & Time*: ${this.formatToIST(this.admitCardData?.examDate)}, ${this.getExamTimeIST(this.admitCardData?.examDate)}\n` +
      `*Reporting Time (IST)*: ${this.getReportingTimeIST(this.admitCardData?.examDate, st.reportingTime)} (15 mins prior)\n\n` +
      `*Candidate Name*: ${st.studentName}\n` +
      `*Exam Roll No*: ${st.examRollNumber}\n` +
      `*Class/Batch*: ${st.batchName}\n` +
      `*Center*: ${st.centerName}\n` +
      `${this.allowAllStudents && !st.isFeeCleared ? '' : feeNote + '\n'}\n` +
      `*Instructions*: Please report at least 15 minutes before the exam time with your student ID card. All electronic gadgets are strictly prohibited.\n\n` +
      `Best wishes from *${this.instituteName}*!`;

    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(textMsg)}`;
    window.open(waUrl, '_blank');
  }
}
