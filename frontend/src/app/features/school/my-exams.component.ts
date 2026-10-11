import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import {
  SchoolService,
  StudentMyExamsDto,
  StudentMyExamItemDto,
  ConsolidatedStudentResultDto,
  SchoolExamDto
} from '../../core/services/school.service';
import { AuthService } from '../../core/services/auth.service';
import { SchoolReportCardDialogComponent } from './school-report-card-dialog.component';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';

@Component({
  selector: 'app-my-exams',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTabsModule,
    MatTableModule,
    MatTooltipModule,
    MatChipsModule,
    MatDialogModule,
    MatSelectModule,
    MatFormFieldModule,
    IstDatetimeDirective
  ],
  template: `
    <div class="my-exams-page">
      <!-- Standardized Dialog/Page Top Header (Strict IMSERP UI Rule: Light blue gradient header) -->
      <div class="page-top-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>event_available</mat-icon>
          </div>
          <div class="header-text-group">
            <h2 class="main-title">My Exams, Datesheet &amp; Results</h2>
            <p class="subtitle">
              Comprehensive exam datesheet, subject timetables, marksheet, and admit card for
              <strong>{{ myData?.student?.studentName || 'Student' }}</strong>.
            </p>
          </div>
        </div>

        <div class="header-action-buttons">
          <button
            mat-stroked-button
            class="datesheet-slip-btn"
            (click)="printDatesheet()"
            matTooltip="Print or download exam datesheet timetable as PDF">
            <mat-icon>print</mat-icon>
            <span>Print Datesheet (समय-सारणी)</span>
          </button>

          <button
            mat-stroked-button
            class="admit-card-btn"
            (click)="openAdmitCardDialog()"
            matTooltip="View and print candidate admit card / hall ticket">
            <mat-icon>badge</mat-icon>
            <span>Admit Card (प्रवेश पत्र)</span>
          </button>

          <button
            mat-raised-button
            class="report-card-btn"
            (click)="openReportCardDialog()"
            matTooltip="View full formal marksheet / report card">
            <mat-icon>assessment</mat-icon>
            <span>View Marksheet (अंक-तालिका)</span>
          </button>
        </div>
      </div>

      <!-- Loading Bar -->
      <mat-progress-bar mode="indeterminate" *ngIf="loading" class="page-loader"></mat-progress-bar>

      <div class="page-content-wrap" *ngIf="myData && !loading">
        <!-- Student Information Card & Academic Performance Metrics Row -->
        <mat-card class="student-kpi-card mat-elevation-z1">
          <div class="card-inner-grid">
            <!-- Student Meta Details -->
            <div class="student-profile-summary">
              <div class="student-avatar-box">
                <mat-icon>school</mat-icon>
              </div>
              <div class="student-details">
                <div class="st-name-row">
                  <h3 class="st-name">{{ myData.student.studentName }}</h3>
                  <span class="st-status-chip">Enrolled</span>
                </div>
                <div class="st-tags-row">
                  <span class="st-tag">Roll: <strong>{{ myData.student.schoolRollNumber || myData.student.rollNumber || 'N/A' }}</strong></span>
                  <span class="dot">•</span>
                  <span class="st-tag">Class: <strong>{{ myData.student.className }}</strong>
                    <span *ngIf="myData.student.sectionName"> - {{ myData.student.sectionName }}</span>
                  </span>
                  <span class="dot" *ngIf="myData.student.batchName">•</span>
                  <span class="st-tag" *ngIf="myData.student.batchName">Batch: <strong>{{ myData.student.batchName }}</strong></span>
                  <span class="dot" *ngIf="myData.student.branchName">•</span>
                  <span class="st-tag branch" *ngIf="myData.student.branchName">🏛️ {{ myData.student.branchName }}</span>
                </div>
                <div class="parent-contact-row" *ngIf="myData.student.parentName || myData.student.parentWhatsAppPhone">
                  <mat-icon class="contact-icon">family_restroom</mat-icon>
                  <span>Parent / Guardian: <strong>{{ myData.student.parentName || 'Guardian' }}</strong></span>
                  <span class="wa-num" *ngIf="myData.student.parentWhatsAppPhone">(WA: {{ myData.student.parentWhatsAppPhone }})</span>
                </div>
              </div>
            </div>

            <!-- 4 Academic Performance Metrics -->
            <div class="financial-kpis-grid">
              <div class="kpi-box total">
                <span class="kpi-label">Total Exams</span>
                <strong class="kpi-value">{{ myData.summary.totalExams }}</strong>
                <span class="kpi-sub">In selected session</span>
              </div>

              <div class="kpi-box upcoming">
                <span class="kpi-label">Upcoming Exams</span>
                <strong class="kpi-value text-primary">{{ myData.summary.upcomingExams }}</strong>
                <span class="kpi-sub text-primary">Pending to be conducted</span>
              </div>

              <div class="kpi-box evaluated">
                <span class="kpi-label">Evaluated / Result</span>
                <strong class="kpi-value text-info">{{ myData.summary.evaluatedExams }}</strong>
                <span class="kpi-sub text-info">Papers marked</span>
              </div>

              <div class="kpi-box balance" [class.has-due]="myData.summary.failedExamsCount > 0">
                <span class="kpi-label">Overall Score &amp; Grade</span>
                <strong class="kpi-value" [class.text-danger]="myData.summary.failedExamsCount > 0" [class.text-success]="myData.summary.failedExamsCount === 0 && myData.summary.evaluatedExams > 0">
                  {{ myData.summary.evaluatedExams > 0 ? (myData.summary.overallPercentage + '% (' + myData.summary.overallGrade + ')') : 'Awaiting Results' }}
                </strong>
                <span class="kpi-sub text-success" *ngIf="myData.summary.evaluatedExams > 0 && myData.summary.failedExamsCount === 0">Passed 🎉</span>
                <span class="kpi-sub text-danger" *ngIf="myData.summary.failedExamsCount > 0">Need improvement in {{ myData.summary.failedExamsCount }} paper(s)</span>
                <span class="kpi-sub" *ngIf="myData.summary.evaluatedExams === 0">Datesheet active</span>
              </div>
            </div>
          </div>
        </mat-card>

        <!-- Filters Bar: Session & Exam Type Selection -->
        <mat-card class="filters-card mat-elevation-z1">
          <div class="filters-wrap">
            <div class="filter-item">
              <mat-form-field appearance="outline" class="dense-field">
                <mat-label>Academic Session</mat-label>
                <mat-select [(ngModel)]="selectedSession" (selectionChange)="onFilterChanged()">
                  <mat-option *ngFor="let s of myData.availableSessions" [value]="s">{{ s }}</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="filter-item">
              <mat-form-field appearance="outline" class="dense-field">
                <mat-label>Exam Type</mat-label>
                <mat-select [(ngModel)]="selectedExamType" (selectionChange)="onFilterChanged()">
                  <mat-option value="All">All Exam Types (समस्त परीक्षाएं)</mat-option>
                  <mat-option *ngFor="let t of myData.availableExamTypes" [value]="t">{{ t }}</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="filter-item search-box">
              <span class="filter-count-chip">
                <mat-icon>playlist_add_check</mat-icon>
                <span>Showing {{ filteredExams.length }} of {{ myData.exams.length }} papers</span>
              </span>
            </div>
          </div>
        </mat-card>

        <!-- Exam Tabs: 1. Datesheet & Timetable, 2. Results & Marksheet, 3. Admit Card Hall Ticket -->
        <mat-card class="statement-card mat-elevation-z1">
          <mat-tab-group class="statement-tabs" animationDuration="0ms">
            <!-- Tab 1: Datesheet & Exam Timetable -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-label-icon">calendar_month</mat-icon>
                <span>Exam Datesheet &amp; Schedule ({{ myData.exams.length }})</span>
              </ng-template>

              <div class="tab-body-wrap">
                <div class="datesheet-intro-banner">
                  <div class="banner-badge">
                    <mat-icon>notification_important</mat-icon>
                  </div>
                  <div class="banner-content">
                    <h4>Official Examination Timetable &amp; Schedule</h4>
                    <p>All exams are scheduled according to Indian Standard Time (IST). Please arrive at the examination hall at least 15 minutes before paper commencement with your official Admit Card.</p>
                  </div>
                  <button mat-raised-button color="primary" class="datesheet-action-btn" (click)="printDatesheet()">
                    <mat-icon>print</mat-icon>
                    <span>Print Datesheet</span>
                  </button>
                </div>

                <div class="table-responsive" *ngIf="filteredExams.length > 0">
                  <table class="passbook-table datesheet-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Subject</th>
                        <th>Exam Title / Paper</th>
                        <th>Exam Date &amp; Day (IST)</th>
                        <th>Max Marks</th>
                        <th>Pass Marks</th>
                        <th>Status</th>
                        <th>Days Status</th>
                        <th>Invigilator / Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let ex of filteredExams; let i = index" [class.today-row]="ex.daysRemaining === 0" [class.past-row]="ex.daysRemaining < 0">
                        <td class="bold-num">{{ i + 1 }}</td>
                        <td>
                          <div class="subject-box">
                            <span class="sub-name">{{ ex.subject }}</span>
                            <small class="exam-type-tag">{{ ex.examType }}</small>
                          </div>
                        </td>
                        <td>
                          <div class="title-cell">
                            <strong>{{ ex.title }}</strong>
                          </div>
                        </td>
                        <td>
                          <div class="date-cell">
                            <span class="d-date">{{ ex.testDate | date:'dd MMM yyyy':'Asia/Kolkata' }}</span>
                            <small class="d-day">{{ ex.testDate | date:'EEEE':'Asia/Kolkata' }}</small>
                          </div>
                        </td>
                        <td class="num-cell"><strong>{{ ex.maxMarks }}</strong></td>
                        <td class="num-cell">{{ ex.passingMarks }}</td>
                        <td>
                          <span class="status-badge" [ngClass]="getExamStatusClass(ex)">
                            {{ getExamStatusLabel(ex) }}
                          </span>
                        </td>
                        <td>
                          <span class="countdown-chip" [ngClass]="getCountdownClass(ex)">
                            {{ getCountdownLabel(ex) }}
                          </span>
                        </td>
                        <td>
                          <span class="remarks-text">{{ ex.remarks || ex.evaluatorTeacherName || 'Standard Syllabus' }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div class="empty-state-card" *ngIf="filteredExams.length === 0">
                  <mat-icon class="large-icon">event_busy</mat-icon>
                  <h3>No Exams Found</h3>
                  <p>No exams match the selected session or exam type filter.</p>
                </div>
              </div>
            </mat-tab>

            <!-- Tab 2: Marksheet & Results -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-label-icon">assessment</mat-icon>
                <span>Marksheet &amp; Results</span>
              </ng-template>

              <div class="tab-body-wrap">
                <div class="results-header-bar">
                  <div class="res-summary-box">
                    <span class="res-label">Overall Result Status:</span>
                    <strong class="res-badge" [ngClass]="myData.summary.resultStatus.toLowerCase()">
                      {{ myData.summary.resultStatus }}
                    </strong>
                    <span class="res-divider">•</span>
                    <span class="res-label">Total Marks:</span>
                    <strong class="res-val">{{ myData.summary.totalMarksObtained }} / {{ myData.summary.totalMaxMarks }}</strong>
                    <span class="res-divider">•</span>
                    <span class="res-label">Percentage:</span>
                    <strong class="res-val">{{ myData.summary.overallPercentage }}%</strong>
                    <span class="res-divider">•</span>
                    <span class="res-label">Grade:</span>
                    <strong class="grade-chip">{{ myData.summary.overallGrade }}</strong>
                  </div>

                  <button mat-raised-button color="primary" class="print-result-btn" (click)="openReportCardDialog()">
                    <mat-icon>print</mat-icon>
                    <span>Print Formal Marksheet</span>
                  </button>
                </div>

                <div class="table-responsive" *ngIf="filteredExams.length > 0">
                  <table class="passbook-table marks-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Subject</th>
                        <th>Exam Type</th>
                        <th>Date (IST)</th>
                        <th>Max Marks</th>
                        <th>Pass Marks</th>
                        <th>Marks Obtained</th>
                        <th>Percentage</th>
                        <th>Grade</th>
                        <th>Result</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let ex of filteredExams; let i = index">
                        <td class="bold-num">{{ i + 1 }}</td>
                        <td>
                          <strong class="sub-name">{{ ex.subject }}</strong>
                        </td>
                        <td>{{ ex.examType }}</td>
                        <td>
                          <span>{{ ex.testDate | date:'dd MMM yyyy':'Asia/Kolkata' }}</span>
                        </td>
                        <td class="num-cell">{{ ex.maxMarks }}</td>
                        <td class="num-cell">{{ ex.passingMarks }}</td>
                        <td class="num-cell marks-cell">
                          <strong *ngIf="ex.marksObtained !== null && !ex.isAbsent" [class.text-danger]="ex.isPassed === false" [class.text-success]="ex.isPassed === true">
                            {{ ex.marksObtained }}
                          </strong>
                          <span *ngIf="ex.isAbsent" class="text-danger bold">ABSENT</span>
                          <span *ngIf="ex.marksObtained === null && !ex.isAbsent" class="text-muted italic">Under Evaluation</span>
                        </td>
                        <td class="num-cell">
                          <span *ngIf="ex.percentage !== null">{{ ex.percentage }}%</span>
                          <span *ngIf="ex.percentage === null" class="text-muted">-</span>
                        </td>
                        <td>
                          <span class="grade-pill" *ngIf="ex.grade"
                            [class.grade-a-plus]="ex.grade === 'A+'"
                            [class.grade-a]="ex.grade === 'A'"
                            [class.grade-b-plus]="ex.grade === 'B+'"
                            [class.grade-b]="ex.grade === 'B'"
                            [class.grade-c]="ex.grade === 'C'"
                            [class.grade-d]="ex.grade === 'D'"
                            [class.grade-f]="ex.grade === 'F'"
                            [class.grade-abs]="ex.grade === 'ABS'">
                            {{ ex.grade }}
                          </span>
                          <span *ngIf="!ex.grade" class="text-muted">-</span>
                        </td>
                        <td>
                          <span class="result-pill" *ngIf="ex.isPassed !== null" [ngClass]="ex.isPassed ? 'pass' : 'fail'">
                            {{ ex.isPassed ? 'Passed' : 'Needs Re-Exam' }}
                          </span>
                          <span *ngIf="ex.isPassed === null" class="text-muted italic">Pending</span>
                        </td>
                        <td>
                          <small class="feedback-text">{{ ex.remarks || '-' }}</small>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div class="empty-state-card" *ngIf="filteredExams.length === 0">
                  <mat-icon class="large-icon">hourglass_empty</mat-icon>
                  <h3>No Results Available</h3>
                  <p>Examination evaluation is currently in progress or no exams were found for this criteria.</p>
                </div>
              </div>
            </mat-tab>

            <!-- Tab 3: Admit Card Preview & Hall Ticket -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-label-icon">badge</mat-icon>
                <span>Admit Card &amp; Hall Ticket</span>
              </ng-template>

              <div class="tab-body-wrap">
                <div class="admit-card-preview-shell" id="admitCardPrintSection">
                  <div class="admit-card-paper">
                    <!-- Institute Header -->
                    <div class="hall-ticket-header">
                      <div class="inst-brand">
                        <h2>{{ myData.student.branchName || 'Jnandeep Campus' }}</h2>
                        <p class="inst-sub">Official Examination Admit Card &amp; Hall Ticket</p>
                        <span class="session-badge">ACADEMIC SESSION: {{ selectedSession }}</span>
                      </div>
                      <div class="hall-ticket-badge">
                        <mat-icon>school</mat-icon>
                      </div>
                    </div>

                    <div class="admit-meta-grid">
                      <div class="meta-col">
                        <div class="meta-row"><span class="m-lbl">Candidate Name:</span> <strong class="m-val">{{ myData.student.studentName }}</strong></div>
                        <div class="meta-row"><span class="m-lbl">Class &amp; Section:</span> <strong class="m-val">{{ myData.student.className }} <span *ngIf="myData.student.sectionName">({{ myData.student.sectionName }})</span></strong></div>
                        <div class="meta-row"><span class="m-lbl">Roll Number:</span> <strong class="m-val">{{ myData.student.schoolRollNumber || myData.student.rollNumber || 'N/A' }}</strong></div>
                        <div class="meta-row"><span class="m-lbl">Admission No:</span> <strong class="m-val">{{ myData.student.admissionNumber || 'N/A' }}</strong></div>
                      </div>

                      <div class="meta-col">
                        <div class="meta-row"><span class="m-lbl">Father's Name:</span> <strong class="m-val">{{ myData.student.fatherName || myData.student.parentName || 'N/A' }}</strong></div>
                        <div class="meta-row"><span class="m-lbl">Examination Center:</span> <strong class="m-val">{{ myData.student.branchName || 'Main Campus Hall' }}</strong></div>
                        <div class="meta-row"><span class="m-lbl">Contact Phone:</span> <strong class="m-val">{{ myData.student.parentWhatsAppPhone || 'N/A' }}</strong></div>
                        <div class="meta-row"><span class="m-lbl">Gender / DOB:</span> <strong class="m-val">{{ myData.student.gender || 'N/A' }} <span *ngIf="myData.student.dateOfBirth">| {{ myData.student.dateOfBirth | date:'dd-MMM-yyyy' }}</span></strong></div>
                      </div>

                      <div class="photo-placeholder-box">
                        <div class="photo-inner">
                          <mat-icon>person</mat-icon>
                          <span>Candidate Photo</span>
                        </div>
                      </div>
                    </div>

                    <!-- Scheduled Papers Table on Admit Card -->
                    <div class="admit-papers-section">
                      <h5 class="papers-title">Schedule of Examinations &amp; Subject Papers</h5>
                      <table class="admit-table">
                        <thead>
                          <tr>
                            <th>Sl No</th>
                            <th>Subject Name</th>
                            <th>Date (IST)</th>
                            <th>Exam Day</th>
                            <th>Max Marks</th>
                            <th>Candidate Sign</th>
                            <th>Invigilator Sign</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr *ngFor="let ex of filteredExams; let i = index">
                            <td>{{ i + 1 }}</td>
                            <td><strong>{{ ex.subject }}</strong> ({{ ex.examType }})</td>
                            <td><span>{{ ex.testDate | date:'dd-MM-yyyy':'Asia/Kolkata' }}</span></td>
                            <td><span>{{ ex.testDate | date:'EEEE':'Asia/Kolkata' }}</span></td>
                            <td>{{ ex.maxMarks }}</td>
                            <td class="sign-space"></td>
                            <td class="sign-space"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <!-- Instructions & Signatures -->
                    <div class="admit-instructions-block">
                      <h6>Candidate Guidelines &amp; Hall Instructions:</h6>
                      <ol>
                        <li>Candidate must carry this Admit Card to every examination session. Entry without Admit Card will strictly be prohibited.</li>
                        <li>Possession of calculators, smartphones, electronic devices, or unauthorized papers inside the examination hall is treated as unfair means.</li>
                        <li>Candidate should report to the allotted examination hall at least 15 minutes before paper commencement.</li>
                      </ol>
                    </div>

                    <div class="signatures-row">
                      <div class="sign-box">
                        <div class="sign-line"></div>
                        <span>Candidate Signature</span>
                      </div>
                      <div class="sign-box">
                        <div class="sign-line"></div>
                        <span>Class Teacher Signature</span>
                      </div>
                      <div class="sign-box">
                        <div class="sign-line"></div>
                        <span>Principal / Exam Controller</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="admit-bottom-actions">
                  <button mat-raised-button color="primary" class="print-admit-btn" (click)="openAdmitCardDialog()">
                    <mat-icon>print</mat-icon>
                    <span>Print Official Admit Card (प्रवेश पत्र प्रिंट करें)</span>
                  </button>
                </div>
              </div>
            </mat-tab>
          </mat-tab-group>
        </mat-card>
      </div>

      <!-- Error / Empty State if no student record mapped -->
      <div class="empty-profile-box" *ngIf="!myData && !loading">
        <mat-icon class="large-icon">contact_support</mat-icon>
        <h3>No Student Examination Record Linked</h3>
        <p>This parent account is not currently linked to an active student examination profile. Please contact the school or coaching administration office.</p>
      </div>
    </div>
  `,
  styles: [`
    .my-exams-page {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: 100%;
      box-sizing: border-box;
    }

    /* Strict IMSERP UI Header Guideline */
    .page-top-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 14px;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      box-shadow: 0 2px 8px -2px rgba(37, 99, 235, 0.1);
      flex-wrap: wrap;

      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;

        .header-icon-box {
          background: #2563eb;
          color: #ffffff;
          border-radius: 10px;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

          mat-icon {
            font-size: 24px;
            width: 24px;
            height: 24px;
          }
        }

        .header-text-group {
          .main-title {
            color: #1e3a8a;
            font-weight: 700;
            font-size: 1.25rem;
            margin: 0 0 2px 0;
          }

          .subtitle {
            color: #3b82f6;
            margin: 0;
            font-size: 0.85rem;

            strong {
              color: #1e40af;
            }
          }
        }
      }

      .header-action-buttons {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;

        .datesheet-slip-btn {
          border-color: #93c5fd;
          color: #1d4ed8;
          background: #f0fdf4;
          font-weight: 600;
          height: 38px;

          mat-icon {
            color: #16a34a;
            margin-right: 4px;
          }
        }

        .admit-card-btn {
          border-color: #cbd5e1;
          color: #334155;
          background: #ffffff;
          font-weight: 600;
          height: 38px;

          mat-icon {
            color: #475569;
            margin-right: 4px;
          }
        }

        .report-card-btn {
          background: #2563eb;
          color: #ffffff;
          font-weight: 600;
          height: 38px;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);

          mat-icon {
            margin-right: 4px;
          }
        }
      }
    }

    .page-loader {
      border-radius: 4px;
    }

    .page-content-wrap {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: 100%;
    }

    .student-kpi-card {
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 18px 20px;

      .card-inner-grid {
        display: grid;
        grid-template-columns: 1fr 1.6fr;
        gap: 24px;
        align-items: center;

        @media (max-width: 1024px) {
          grid-template-columns: 1fr;
        }
      }

      .student-profile-summary {
        display: flex;
        align-items: center;
        gap: 16px;

        .student-avatar-box {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

          mat-icon {
            font-size: 32px;
            width: 32px;
            height: 32px;
          }
        }

        .student-details {
          .st-name-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 4px;

            .st-name {
              margin: 0;
              font-size: 1.15rem;
              font-weight: 700;
              color: #0f172a;
            }

            .st-status-chip {
              background: #dcfce7;
              color: #166534;
              font-size: 0.72rem;
              font-weight: 700;
              padding: 2px 8px;
              border-radius: 999px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
          }

          .st-tags-row {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
            font-size: 0.83rem;
            color: #475569;
            margin-bottom: 6px;

            strong {
              color: #0f172a;
            }

            .dot {
              color: #94a3b8;
            }

            .branch {
              color: #1d4ed8;
              font-weight: 600;
            }
          }

          .parent-contact-row {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.8rem;
            color: #64748b;

            .contact-icon {
              font-size: 16px;
              width: 16px;
              height: 16px;
              color: #94a3b8;
            }

            strong {
              color: #1e293b;
            }

            .wa-num {
              color: #16a34a;
              font-weight: 600;
            }
          }
        }
      }

      .financial-kpis-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;

        @media (max-width: 768px) {
          grid-template-columns: repeat(2, 1fr);
        }

        .kpi-box {
          border-radius: 10px;
          padding: 12px 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 2px;

          .kpi-label {
            font-size: 0.75rem;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.4px;
          }

          .kpi-value {
            font-size: 1.15rem;
            font-weight: 800;
            color: #0f172a;
          }

          .kpi-sub {
            font-size: 0.72rem;
            color: #94a3b8;
          }

          &.upcoming {
            background: #eff6ff;
            border-color: #bfdbfe;
            .kpi-value { color: #1d4ed8; }
          }

          &.evaluated {
            background: #f0fdf4;
            border-color: #bbf7d0;
            .kpi-value { color: #15803d; }
          }

          &.balance {
            background: #f8fafc;
            border-color: #cbd5e1;

            &.has-due {
              background: #fef2f2;
              border-color: #fecaca;
              .kpi-value { color: #dc2626; }
            }
          }
        }
      }
    }

    .filters-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 12px 16px;

      .filters-wrap {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;

        .dense-field {
          width: 220px;
          ::ng-deep .mat-mdc-form-field-subscript-wrapper {
            display: none;
          }
          ::ng-deep .mat-mdc-text-field-wrapper {
            height: 44px;
            background: #f8fafc;
          }
        }

        .search-box {
          margin-left: auto;
          .filter-count-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 0.85rem;
            font-weight: 600;
            color: #475569;
            background: #f1f5f9;
            padding: 6px 12px;
            border-radius: 8px;

            mat-icon {
              font-size: 18px;
              width: 18px;
              height: 18px;
              color: #2563eb;
            }
          }
        }
      }
    }

    .statement-card {
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      overflow: hidden;

      .statement-tabs {
        ::ng-deep .mat-mdc-tab-header {
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .tab-label-icon {
          margin-right: 6px;
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      .tab-body-wrap {
        padding: 18px 20px;

        @media (max-width: 768px) {
          padding: 12px 10px;
        }
      }
    }

    .datesheet-intro-banner {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 14px;

      .banner-badge {
        width: 38px;
        height: 38px;
        border-radius: 8px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }

      .banner-content {
        flex: 1;
        h4 { margin: 0 0 2px 0; font-size: 0.95rem; color: #1e3a8a; font-weight: 700; }
        p { margin: 0; font-size: 0.8rem; color: #3b82f6; }
      }

      .datesheet-action-btn {
        background: #2563eb;
        color: #ffffff;
        font-weight: 600;
        height: 36px;
        flex-shrink: 0;
      }
    }

    .table-responsive {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .passbook-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;

      thead th {
        background: #f1f5f9;
        color: #334155;
        font-weight: 700;
        padding: 10px 14px;
        text-align: left;
        border-bottom: 2px solid #cbd5e1;
        white-space: nowrap;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      tbody td {
        padding: 12px 14px;
        border-bottom: 1px solid #e2e8f0;
        color: #1e293b;
        vertical-align: middle;
      }

      tbody tr:hover {
        background: #f8fafc;
      }

      tbody tr.today-row {
        background: #fefce8;
        border-left: 4px solid #eab308;
      }

      tbody tr.past-row {
        opacity: 0.88;
      }

      .bold-num {
        font-weight: 700;
        color: #64748b;
      }

      .num-cell {
        text-align: right;
      }

      .subject-box {
        .sub-name {
          font-weight: 700;
          color: #0f172a;
          font-size: 0.9rem;
          display: block;
        }
        .exam-type-tag {
          color: #64748b;
          font-size: 0.75rem;
        }
      }

      .date-cell {
        display: flex;
        flex-direction: column;
        .d-date { font-weight: 700; color: #0f172a; }
        .d-day { color: #64748b; font-size: 0.75rem; }
      }

      .status-badge {
        display: inline-block;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 0.73rem;
        font-weight: 700;

        &.scheduled { background: #e0f2fe; color: #0369a1; }
        &.evaluated { background: #dcfce7; color: #15803d; }
        &.today { background: #fef08a; color: #854d0e; }
        &.completed { background: #f1f5f9; color: #475569; }
      }

      .countdown-chip {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.72rem;
        font-weight: 600;

        &.urgent { background: #fee2e2; color: #b91c1c; font-weight: 700; }
        &.soon { background: #fef3c7; color: #b45309; }
        &.normal { background: #f1f5f9; color: #64748b; }
      }

      .grade-pill {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-weight: 800;
        font-size: 0.75rem;
        background: #f1f5f9;
        color: #334155;

        &.grade-a, &.grade-a-plus { background: #dcfce7; color: #166534; }
        &.grade-b, &.grade-b-plus { background: #e0f2fe; color: #0369a1; }
        &.grade-c { background: #fef9c3; color: #854d0e; }
        &.grade-d { background: #ffedd5; color: #c2410c; }
        &.grade-f, &.grade-abs { background: #fee2e2; color: #b91c1c; }
      }

      .result-pill {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 0.73rem;

        &.pass { background: #dcfce7; color: #15803d; }
        &.fail { background: #fee2e2; color: #b91c1c; }
      }
    }

    .results-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;

      .res-summary-box {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        font-size: 0.85rem;

        .res-label { color: #64748b; font-weight: 600; }
        .res-val { color: #0f172a; }
        .res-divider { color: #cbd5e1; }
        .grade-chip {
          background: #dcfce7;
          color: #15803d;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .res-badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 700;

          &.passed { background: #dcfce7; color: #166534; }
          &.compartment { background: #fef3c7; color: #92400e; }
          &.failed { background: #fee2e2; color: #991b1b; }
          &.scheduled { background: #e0f2fe; color: #075985; }
        }
      }

      .print-result-btn {
        background: #2563eb;
        color: #ffffff;
        font-weight: 600;
      }
    }

    /* Admit Card Hall Ticket Styling */
    .admit-card-preview-shell {
      background: #f1f5f9;
      padding: 20px;
      border-radius: 12px;
      display: flex;
      justify-content: center;

      .admit-card-paper {
        background: #ffffff;
        width: 100%;
        max-width: 900px;
        border: 2px solid #0f172a;
        padding: 24px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.08);
      }

      .hall-ticket-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2px solid #0f172a;
        padding-bottom: 12px;
        margin-bottom: 16px;

        .inst-brand {
          h2 { margin: 0; font-size: 1.4rem; color: #0f172a; font-weight: 800; text-transform: uppercase; }
          .inst-sub { margin: 2px 0 6px 0; color: #475569; font-size: 0.85rem; font-weight: 600; }
          .session-badge {
            display: inline-block;
            background: #0f172a;
            color: #ffffff;
            font-size: 0.72rem;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 4px;
            letter-spacing: 0.5px;
          }
        }

        .hall-ticket-badge {
          width: 50px;
          height: 50px;
          border-radius: 10px;
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          display: flex;
          align-items: center;
          justify-content: center;

          mat-icon { font-size: 32px; width: 32px; height: 32px; }
        }
      }

      .admit-meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 140px;
        gap: 16px;
        border-bottom: 1px solid #cbd5e1;
        padding-bottom: 16px;
        margin-bottom: 16px;

        @media (max-width: 768px) {
          grid-template-columns: 1fr;
        }

        .meta-col {
          display: flex;
          flex-direction: column;
          gap: 6px;

          .meta-row {
            font-size: 0.82rem;
            .m-lbl { color: #64748b; display: inline-block; min-width: 120px; }
            .m-val { color: #0f172a; font-weight: 700; }
          }
        }

        .photo-placeholder-box {
          border: 1px dashed #94a3b8;
          border-radius: 8px;
          height: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;

          .photo-inner {
            display: flex;
            flex-direction: column;
            align-items: center;
            color: #94a3b8;
            font-size: 0.72rem;
            gap: 4px;

            mat-icon { font-size: 36px; width: 36px; height: 36px; }
          }
        }
      }

      .admit-papers-section {
        margin-bottom: 16px;

        .papers-title {
          font-size: 0.9rem;
          color: #0f172a;
          margin: 0 0 8px 0;
          font-weight: 700;
        }

        .admit-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;

          th, td {
            border: 1px solid #cbd5e1;
            padding: 8px 10px;
            text-align: left;
          }

          th { background: #f1f5f9; font-weight: 700; }
          .sign-space { width: 90px; }
        }
      }

      .admit-instructions-block {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px 14px;
        margin-bottom: 24px;

        h6 { margin: 0 0 4px 0; font-size: 0.78rem; font-weight: 700; color: #334155; }
        ol {
          margin: 0;
          padding-left: 18px;
          font-size: 0.75rem;
          color: #475569;
          li { margin-bottom: 2px; }
        }
      }

      .signatures-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        padding-top: 10px;

        .sign-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;

          .sign-line {
            width: 160px;
            border-bottom: 1px solid #475569;
          }

          span {
            font-size: 0.75rem;
            font-weight: 600;
            color: #334155;
          }
        }
      }
    }

    .admit-bottom-actions {
      display: flex;
      justify-content: center;
      margin-top: 16px;

      .print-admit-btn {
        background: #2563eb;
        color: #ffffff;
        font-weight: 700;
        height: 42px;
        padding: 0 24px;
      }
    }

    .empty-state-card, .empty-profile-box {
      text-align: center;
      padding: 48px 24px;
      color: #64748b;

      .large-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #94a3b8;
        margin-bottom: 12px;
      }

      h3 { margin: 0 0 8px 0; color: #1e293b; font-size: 1.15rem; font-weight: 700; }
      p { margin: 0 auto; max-width: 480px; font-size: 0.88rem; line-height: 1.5; }
    }
  `]
})
export class MyExamsComponent implements OnInit {
  myData: StudentMyExamsDto | null = null;
  filteredExams: StudentMyExamItemDto[] = [];
  loading = false;

  selectedSession = '2025-2026';
  selectedExamType = 'All';

  constructor(
    private schoolService: SchoolService,
    private authService: AuthService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadMyExams();
  }

  loadMyExams(): void {
    this.loading = true;
    this.schoolService.getMyExams(this.selectedSession, this.selectedExamType).subscribe({
      next: (data) => {
        this.loading = false;
        this.myData = data;
        if (data.student?.academicYear) {
          this.selectedSession = data.student.academicYear;
        }
        this.filterExams();
      },
      error: (err) => {
        this.loading = false;
        console.error('Failed to load my-exams:', err);
      }
    });
  }

  onFilterChanged(): void {
    this.loadMyExams();
  }

  private filterExams(): void {
    if (!this.myData) {
      this.filteredExams = [];
      return;
    }
    let list = this.myData.exams || [];
    if (this.selectedExamType && this.selectedExamType !== 'All') {
      list = list.filter(e => e.examType === this.selectedExamType);
    }
    this.filteredExams = list;
  }

  getExamStatusClass(ex: StudentMyExamItemDto): string {
    if (ex.isAbsent || ex.marksObtained !== null) return 'evaluated';
    if (ex.daysRemaining === 0) return 'today';
    if (ex.daysRemaining < 0) return 'completed';
    return 'scheduled';
  }

  getExamStatusLabel(ex: StudentMyExamItemDto): string {
    if (ex.isAbsent) return 'Absent Recorded';
    if (ex.marksObtained !== null) return 'Marks Published';
    if (ex.daysRemaining === 0) return 'Today\'s Exam';
    if (ex.daysRemaining < 0) return 'Conducted';
    return 'Upcoming Scheduled';
  }

  getCountdownClass(ex: StudentMyExamItemDto): string {
    if (ex.daysRemaining === 0) return 'urgent';
    if (ex.daysRemaining > 0 && ex.daysRemaining <= 3) return 'soon';
    return 'normal';
  }

  getCountdownLabel(ex: StudentMyExamItemDto): string {
    if (ex.daysRemaining < 0) return `${Math.abs(ex.daysRemaining)} day(s) ago`;
    if (ex.daysRemaining === 0) return 'Happening Today';
    if (ex.daysRemaining === 1) return 'Tomorrow';
    return `In ${ex.daysRemaining} days`;
  }

  openAdmitCardDialog(): void {
    if (this.myData?.consolidatedResult) {
      this.dialog.open(SchoolReportCardDialogComponent, {
        width: '96vw',
        maxWidth: '1280px',
        height: '92vh',
        maxHeight: '94vh',
        panelClass: 'custom-dialog-container',
        data: {
          mode: 'single',
          initialView: 'admit_card',
          className: this.myData.student.className,
          academicYear: this.selectedSession,
          examType: this.selectedExamType !== 'All' ? this.selectedExamType : 'Annual Exam',
          student: this.myData.consolidatedResult,
          subjects: this.myData.exams.map(e => e.subject),
          exams: this.convertToSchoolExamDtos(this.myData.exams)
        }
      });
    } else {
      // Print directly via native print window of the embedded hall ticket
      this.printAdmitCardElement();
    }
  }

  openReportCardDialog(): void {
    if (this.myData?.consolidatedResult) {
      this.dialog.open(SchoolReportCardDialogComponent, {
        width: '96vw',
        maxWidth: '1280px',
        height: '92vh',
        maxHeight: '94vh',
        panelClass: 'custom-dialog-container',
        data: {
          mode: 'single',
          initialView: 'marksheet',
          className: this.myData.student.className,
          academicYear: this.selectedSession,
          examType: this.selectedExamType !== 'All' ? this.selectedExamType : 'Annual Exam',
          student: this.myData.consolidatedResult,
          subjects: this.myData.exams.map(e => e.subject),
          exams: this.convertToSchoolExamDtos(this.myData.exams)
        }
      });
    } else {
      window.print();
    }
  }

  printDatesheet(): void {
    if (!this.myData) return;

    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) return;

    const student = this.myData.student;
    const examsHtml = this.filteredExams.map((ex, i) => `
      <tr>
        <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${i + 1}</td>
        <td style="border:1px solid #cbd5e1; padding:8px;"><strong>${ex.subject}</strong><br><small style="color:#64748b;">${ex.examType}</small></td>
        <td style="border:1px solid #cbd5e1; padding:8px;">${ex.title}</td>
        <td style="border:1px solid #cbd5e1; padding:8px;"><strong>${new Date(ex.testDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' })}</strong></td>
        <td style="border:1px solid #cbd5e1; padding:8px; text-align:right;">${ex.maxMarks}</td>
        <td style="border:1px solid #cbd5e1; padding:8px; text-align:right;">${ex.passingMarks}</td>
        <td style="border:1px solid #cbd5e1; padding:8px;">${ex.remarks || 'Standard'}</td>
      </tr>
    `).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Exam Datesheet - ${student.studentName}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #0f172a; margin: 0; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .header h2 { margin: 0; font-size: 22px; text-transform: uppercase; }
          .header p { margin: 4px 0 0; color: #475569; font-size: 14px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
          th { background: #f1f5f9; padding: 10px; border: 1px solid #cbd5e1; text-align: left; }
          .footer { display: flex; justify-content: space-between; margin-top: 40px; font-size: 13px; }
          .sign-box { border-top: 1px solid #0f172a; width: 180px; text-align: center; padding-top: 6px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${student.branchName || 'Jnandeep Campus'}</h2>
          <p>Official Examination Datesheet &amp; Schedule (${this.selectedSession})</p>
        </div>
        <div class="meta-grid">
          <div><strong>Candidate Name:</strong> ${student.studentName}</div>
          <div><strong>Class &amp; Section:</strong> ${student.className} ${student.sectionName ? '(' + student.sectionName + ')' : ''}</div>
          <div><strong>Roll Number:</strong> ${student.schoolRollNumber || student.rollNumber || 'N/A'}</div>
          <div><strong>Admission Number:</strong> ${student.admissionNumber || 'N/A'}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Subject</th>
              <th>Exam Title</th>
              <th>Date &amp; Day (IST)</th>
              <th style="text-align:right;">Max</th>
              <th style="text-align:right;">Pass</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${examsHtml}
          </tbody>
        </table>
        <div class="footer">
          <div class="sign-box">Candidate Signature</div>
          <div class="sign-box">Class Teacher Signature</div>
          <div class="sign-box">Exam Controller / Principal</div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  private printAdmitCardElement(): void {
    const el = document.getElementById('admitCardPrintSection');
    if (!el) return;

    const printWin = window.open('', '_blank', 'width=950,height=750');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admit Card - ${this.myData?.student.studentName || 'Student'}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #0f172a; margin: 0; background: #fff; }
          .admit-card-preview-shell { background: #fff !important; padding: 0 !important; }
          .admit-card-paper { border: 2px solid #000; padding: 24px; }
          .hall-ticket-header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
          .inst-brand h2 { margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; }
          .session-badge { background: #000; color: #fff; padding: 2px 8px; font-size: 11px; border-radius: 4px; }
          .admit-meta-grid { display: grid; grid-template-columns: 1fr 1fr 120px; gap: 12px; border-bottom: 1px solid #ccc; padding-bottom: 14px; margin-bottom: 14px; font-size: 12px; }
          .meta-col { display: flex; flex-direction: column; gap: 4px; }
          .photo-placeholder-box { border: 1px dashed #666; height: 120px; display: flex; align-items: center; justify-content: center; font-size: 11px; }
          .admit-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
          .admit-table th, .admit-table td { border: 1px solid #999; padding: 6px 8px; }
          .admit-table th { background: #eee; }
          .admit-instructions-block { font-size: 11px; background: #f9f9f9; padding: 8px 12px; border: 1px solid #ddd; margin-bottom: 24px; }
          .signatures-row { display: flex; justify-content: space-between; margin-top: 30px; font-size: 12px; }
          .sign-box { text-align: center; }
          .sign-line { border-bottom: 1px solid #000; width: 150px; margin-bottom: 4px; }
        </style>
      </head>
      <body>
        ${el.innerHTML}
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  private convertToSchoolExamDtos(exams: StudentMyExamItemDto[]): SchoolExamDto[] {
    return exams.map(e => ({
      id: e.id,
      title: e.title,
      subject: e.subject,
      examType: e.examType,
      academicYear: e.academicYear,
      classId: this.myData?.student.classId || '',
      className: this.myData?.student.className || '',
      sectionId: this.myData?.student.sectionId || undefined,
      sectionName: this.myData?.student.sectionName || undefined,
      maxMarks: e.maxMarks,
      passingMarks: e.passingMarks,
      testDate: e.testDate,
      totalStudents: 1,
      evaluatedStudents: e.marksObtained !== null ? 1 : 0,
      evaluationStatus: e.evaluationStatus,
      isMarksLocked: e.isMarksLocked,
      evaluationRemarks: e.remarks || undefined
    }));
  }
}
