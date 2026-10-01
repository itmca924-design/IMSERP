import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { 
  CoachingService, 
  Student360Data, 
  StudentAchievementDto,
  StudentWeeklyTimetableDto 
} from '../../core/services/coaching.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ApplyStudentRegularizationDialogComponent, StudentAttendanceRegularizationDto } from './student-regularization-dialog.component';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';

const API_BASE = 'http://localhost:5000';

@Component({
  selector: 'app-my-student-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    IstDatetimeDirective
  ],
  template: `
    <div class="my-profile-container">
      
      <!-- Top Breadcrumb & Portal Bar -->
      <div class="portal-header-bar">
        <div class="header-left">
          <div class="portal-badge-icon">
            <mat-icon>military_tech</mat-icon>
          </div>
          <div>
            <h1 class="portal-title">My Student 360° Profile &amp; Wall of Fame</h1>
            <p class="portal-subtitle">Student Self-Service Portal &bull; Verified Academic, Health, Honors &amp; Growth Dossier</p>
          </div>
        </div>
        <div class="header-actions" *ngIf="data360">
          <a mat-stroked-button class="print-medical-btn" routerLink="/students/timetable" style="color: #0ea5e9; border-color: #bae6fd;">
            <mat-icon>calendar_view_week</mat-icon> Class Timetable &amp; Routine
          </a>
          <button mat-stroked-button class="print-medical-btn" (click)="openRegularizationDialog()" style="color: #2563eb; border-color: #bfdbfe;">
            <mat-icon>edit_calendar</mat-icon> Request Regularization
          </button>
          <button mat-stroked-button class="print-medical-btn" (click)="showPrintMedicalCard = true">
            <mat-icon>badge</mat-icon> Pocket Medical Card
          </button>
          <button mat-raised-button color="primary" class="primary-gradient-btn" (click)="activeTabIndex = 0">
            <mat-icon>emoji_events</mat-icon> View Wall of Fame
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div class="loading-state-box" *ngIf="loading">
        <mat-spinner diameter="44"></mat-spinner>
        <p>Loading your verified student dossier...</p>
      </div>

      <!-- Main Profile Content -->
      <div class="profile-content-wrap" *ngIf="!loading && data360">
        
        <!-- Hero Identity Banner -->
        <div class="hero-identity-card">
          <div class="hero-identity-row">
            <div class="avatar-wrap">
              <img *ngIf="data360.student.profilePhoto" [src]="getPhotoUrl(data360.student.profilePhoto)" [alt]="data360.student.studentName" />
              <div *ngIf="!data360.student.profilePhoto" class="avatar-fallback">
                {{ getInitials(data360.student.studentName) }}
              </div>
            </div>

            <div class="hero-details">
              <div class="hero-name-row">
                <h2 class="student-name">{{ data360.student.studentName }}</h2>
                <span class="active-badge" [class.inactive]="!data360.student.isActive">
                  {{ data360.student.isActive ? 'Active Student' : 'Inactive' }}
                </span>
                <span class="star-badge" *ngIf="data360.performanceAlert?.isStarPerformer">
                  <mat-icon>hotel_class</mat-icon> Star Scholar
                </span>
              </div>

              <div class="hero-meta-grid">
                <div class="meta-pill"><mat-icon>school</mat-icon> Class: <strong>{{ data360.student.className || 'General' }}{{ data360.student.sectionName ? ' - ' + data360.student.sectionName : '' }}</strong></div>
                <div class="meta-pill"><mat-icon>pin</mat-icon> Roll No: <strong>{{ data360.student.rollNumber }}</strong></div>
                <div class="meta-pill" *ngIf="data360.student.admissionNumber"><mat-icon>badge</mat-icon> Adm No: <strong>{{ data360.student.admissionNumber }}</strong></div>
                <div class="meta-pill" *ngIf="data360.student.branchName"><mat-icon>store</mat-icon> Campus: <strong>{{ data360.student.branchName }}</strong></div>
                <div class="meta-pill" *ngIf="data360.student.bloodGroup"><mat-icon>bloodtype</mat-icon> Blood: <strong class="blood-text">{{ data360.student.bloodGroup }}</strong></div>
                <div class="meta-pill" *ngIf="data360.student.parentName"><mat-icon>family_restroom</mat-icon> Guardian: <strong>{{ data360.student.parentName }}</strong></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 📊 FEATURE 5: SMART PERFORMANCE RADAR & EARLY WARNING BANNER -->
        <div class="performance-radar-banner" *ngIf="data360.performanceAlert">
          <div class="radar-status-col">
            <div class="badge-icon-circle" [class.star]="data360.performanceAlert.isStarPerformer" [class.warning]="data360.performanceAlert.hasAttendanceWarning || data360.performanceAlert.hasExamWarning">
              <mat-icon>{{ data360.performanceAlert.isStarPerformer ? 'workspace_premium' : (data360.performanceAlert.hasAttendanceWarning || data360.performanceAlert.hasExamWarning ? 'priority_high' : 'verified') }}</mat-icon>
            </div>
            <div>
              <div class="radar-badge-label">Academic Evaluation:</div>
              <h4 class="radar-badge-title">{{ data360.performanceAlert.performanceBadgeText }}</h4>
            </div>
          </div>

          <div class="radar-insights-col">
            <div class="insight-group" *ngIf="data360.performanceAlert.strongSubjects?.length">
              <span class="insight-label"><mat-icon>trending_up</mat-icon> Strong Aptitudes:</span>
              <div class="tag-row">
                <span class="subject-tag strong" *ngFor="let s of data360.performanceAlert.strongSubjects">{{ s }}</span>
              </div>
            </div>

            <div class="insight-group" *ngIf="data360.performanceAlert.weakSubjects?.length">
              <span class="insight-label"><mat-icon>flag</mat-icon> Focus Needed:</span>
              <div class="tag-row">
                <span class="subject-tag weak" *ngFor="let s of data360.performanceAlert.weakSubjects">{{ s }}</span>
              </div>
            </div>

            <div class="alert-message-box" *ngIf="data360.performanceAlert.attendanceAlertMessage">
              <mat-icon>warning</mat-icon>
              <span>{{ data360.performanceAlert.attendanceAlertMessage }}</span>
            </div>
          </div>
        </div>

        <!-- Tabbed Sections Navigation -->
        <div class="tabs-wrapper">
          <mat-tab-group [(selectedIndex)]="activeTabIndex" animationDuration="250ms">

            <!-- TAB: 📅 CLASS TIMETABLE & ROUTINE -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-icon">calendar_view_week</mat-icon> Timetable &amp; Routine
              </ng-template>
              <div class="tab-body-container">
                <div class="section-title-bar">
                  <div>
                    <h3 class="sec-title">Today's Class Schedule &amp; Routine ({{ timetableMiniData?.todayDayOfWeek || 'Today' }})</h3>
                    <p class="sec-sub">Live periods, classroom allocation, assigned faculty and proxy notices</p>
                  </div>
                  <div class="sec-actions">
                    <a mat-raised-button color="primary" class="primary-gradient-btn" routerLink="/students/timetable">
                      <mat-icon>open_in_new</mat-icon> Full Timetable Portal
                    </a>
                  </div>
                </div>

                <!-- Timetable Mini Content -->
                <div class="mini-timetable-container">
                  <div class="mini-periods-grid" *ngIf="timetableMiniData?.todayPeriods?.length">
                    <div 
                      class="mini-period-card" 
                      *ngFor="let s of timetableMiniData?.todayPeriods" 
                      [class.live-card]="s.isLiveNow"
                      [class.completed-card]="s.isCompleted"
                      [class.proxy-card]="s.isSubstituted">
                      <div class="mpc-top">
                        <span class="mpc-pnum">P{{ s.periodNumber }}</span>
                        <span class="mpc-time">{{ s.timeSlot }}</span>
                        <span class="mpc-live-tag" *ngIf="s.isLiveNow">● LIVE</span>
                        <span class="mpc-proxy-tag" *ngIf="s.isSubstituted">PROXY</span>
                      </div>
                      <h4 class="mpc-subject">{{ s.subject }}</h4>
                      <div class="mpc-meta">
                        <span class="mpc-teacher"><mat-icon>person</mat-icon> {{ s.teacherName }}</span>
                        <span class="mpc-room"><mat-icon>meeting_room</mat-icon> Room {{ s.roomNumber }}</span>
                      </div>
                      <div class="mpc-sub-notice" *ngIf="s.isSubstituted">
                        <small>Proxy: <strong>{{ s.substituteTeacherName }}</strong></small>
                      </div>
                    </div>
                  </div>

                  <div class="empty-state-card" *ngIf="!timetableMiniData?.todayPeriods?.length">
                    <mat-icon class="empty-icon">calendar_month</mat-icon>
                    <h4>No Classes Scheduled Today</h4>
                    <p>No lectures are scheduled for today. You can view the master schedule for the full week.</p>
                    <a mat-stroked-button color="primary" routerLink="/students/timetable" style="margin-top: 10px;">
                      <mat-icon>grid_view</mat-icon> Open Full Routine Matrix
                    </a>
                  </div>
                </div>
              </div>
            </mat-tab>

            <!-- TAB 1: 🏆 WALL OF FAME (Feature 1) -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-icon">emoji_events</mat-icon> Wall of Fame ({{ data360.achievements?.length || 0 }})
              </ng-template>
              <div class="tab-body-container">
                <div class="section-title-bar">
                  <div>
                    <h3 class="sec-title">Honors, Medals &amp; Merit Accolades</h3>
                    <p class="sec-sub">Official awards, Olympiad distinctions, sports recognitions and co-curricular accomplishments</p>
                  </div>
                </div>

                <!-- Achievements Grid -->
                <div class="achievement-grid" *ngIf="data360.achievements?.length">
                  <div class="honor-card" *ngFor="let ach of data360.achievements" [ngClass]="(ach.category || 'other').toLowerCase()">
                    <div class="honor-top">
                      <div class="honor-badge-icon" [ngClass]="(ach.category || 'other').toLowerCase()">
                        <mat-icon>{{ getAchievementIcon(ach.category) }}</mat-icon>
                      </div>
                      <div class="honor-titles">
                        <div class="honor-title">{{ ach.title }}</div>
                        <div class="honor-meta">
                          <span class="honor-category-tag" [ngClass]="(ach.category || 'other').toLowerCase()">{{ ach.category }}</span>
                          <span class="level-tag" *ngIf="ach.level || ach.awardLevel">{{ ach.level || ach.awardLevel }}</span>
                          <span class="pos-tag" *ngIf="ach.position">🏆 {{ ach.position }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="honor-body">
                      <div class="honor-info-line" *ngIf="ach.issuedBy || ach.awardedBy">
                        <span class="meta-label">Organized By:</span>
                        <span class="meta-text">{{ ach.issuedBy || ach.awardedBy }}</span>
                      </div>
                      <div class="honor-info-line">
                        <span class="meta-label">Award Date:</span>
                        <span class="meta-text">{{ (ach.awardedDate || ach.awardDate) | date:'dd MMM yyyy' }}</span>
                      </div>
                      <div class="honor-info-line" *ngIf="ach.certificateNumber">
                        <span class="meta-label">Certificate No:</span>
                        <span class="meta-text font-mono">{{ ach.certificateNumber }}</span>
                      </div>
                      <p class="honor-remarks" *ngIf="ach.remarks || ach.description">{{ ach.remarks || ach.description }}</p>
                    </div>
                    <div class="honor-footer">
                      <button mat-stroked-button class="print-cert-btn" (click)="printCertificate(ach)" matTooltip="Generate &amp; Print Official Certificate of Merit">
                        <mat-icon>print</mat-icon> Print Official Certificate
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Empty State -->
                <div class="empty-state-card" *ngIf="!data360.achievements?.length">
                  <mat-icon class="empty-icon">workspace_premium</mat-icon>
                  <h4>No Awards Recorded Yet</h4>
                  <p>Keep participating in school events, Olympiads and sports. All institutional honors will appear here!</p>
                </div>
              </div>
            </mat-tab>

            <!-- TAB 2: 🩺 HEALTH & MEDICAL PROFILE (Feature 4) -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-icon">medical_services</mat-icon> Health &amp; Medical
              </ng-template>
              <div class="tab-body-container">
                <div class="section-title-bar">
                  <div>
                    <h3 class="sec-title">Student Health &amp; Emergency Medical Profile</h3>
                    <p class="sec-sub">Growth vitals, BMI evaluation scale, clinical notes, and emergency medical contacts</p>
                  </div>
                  <button mat-stroked-button class="print-medical-btn" (click)="showPrintMedicalCard = true">
                    <mat-icon>badge</mat-icon> Print Pocket Medical Card
                  </button>
                </div>

                <div class="health-cards-grid">
                  <!-- Physical Growth & BMI -->
                  <div class="health-card">
                    <div class="card-head">
                      <mat-icon class="head-icon">accessibility_new</mat-icon>
                      <h4>Physical Growth &amp; BMI Tracker</h4>
                    </div>
                    <div class="vitals-row">
                      <div class="vital-item">
                        <span class="v-lbl">Height</span>
                        <span class="v-val">{{ (data360.healthRecord?.heightCm || data360.healthProfile?.heightCm) ? ((data360.healthRecord?.heightCm || data360.healthProfile?.heightCm) + ' cm') : 'Not Recorded' }}</span>
                      </div>
                      <div class="vital-item">
                        <span class="v-lbl">Weight</span>
                        <span class="v-val">{{ (data360.healthRecord?.weightKg || data360.healthProfile?.weightKg) ? ((data360.healthRecord?.weightKg || data360.healthProfile?.weightKg) + ' kg') : 'Not Recorded' }}</span>
                      </div>
                      <div class="vital-item highlight">
                        <span class="v-lbl">BMI Score</span>
                        <span class="v-val">{{ (data360.healthRecord?.bmi || data360.healthProfile?.bmi) ? ((data360.healthRecord?.bmi || data360.healthProfile?.bmi) | number:'1.1-1') : 'N/A' }}</span>
                      </div>
                    </div>

                    <!-- BMI Category Meter -->
                    <div class="bmi-meter-wrap" *ngIf="data360.healthRecord?.bmiCategory || data360.healthProfile?.bmiCategory">
                      <div class="meter-bar">
                        <div class="meter-seg under" [class.current]="(data360.healthRecord?.bmiCategory || data360.healthProfile?.bmiCategory) === 'Underweight'">Underweight (&lt;18.5)</div>
                        <div class="meter-seg normal" [class.current]="(data360.healthRecord?.bmiCategory || data360.healthProfile?.bmiCategory) === 'Normal'">Healthy (18.5 - 24.9)</div>
                        <div class="meter-seg over" [class.current]="(data360.healthRecord?.bmiCategory || data360.healthProfile?.bmiCategory) === 'Overweight'">Overweight (25 - 29.9)</div>
                        <div class="meter-seg obese" [class.current]="(data360.healthRecord?.bmiCategory || data360.healthProfile?.bmiCategory) === 'Obese'">Obese (&ge;30)</div>
                      </div>
                      <div class="bmi-result-txt">
                        Growth Evaluation: <strong [ngClass]="(data360.healthRecord?.bmiCategory || data360.healthProfile?.bmiCategory || '').toLowerCase()">{{ data360.healthRecord?.bmiCategory || data360.healthProfile?.bmiCategory }}</strong>
                      </div>
                    </div>
                  </div>

                  <!-- Medical Alerts & Allergies -->
                  <div class="health-card danger-card">
                    <div class="card-head">
                      <mat-icon class="head-icon red">warning</mat-icon>
                      <h4>Critical Medical Alerts &amp; Allergies</h4>
                    </div>
                    <div class="alerts-content">
                      <div class="alert-box" [class.has-allergy]="data360.healthRecord?.knownAllergies || data360.healthProfile?.knownAllergies">
                        <div class="alert-title"><mat-icon>coronavirus</mat-icon> Known Allergies</div>
                        <p>{{ data360.healthRecord?.knownAllergies || data360.healthProfile?.knownAllergies || 'No known allergies reported.' }}</p>
                      </div>
                      <div class="alert-box" [class.has-condition]="data360.healthRecord?.chronicConditions || data360.healthProfile?.chronicConditions">
                        <div class="alert-title"><mat-icon>healing</mat-icon> Chronic Medical Conditions</div>
                        <p>{{ data360.healthRecord?.chronicConditions || data360.healthProfile?.chronicConditions || 'None reported.' }}</p>
                      </div>
                      <div class="alert-box" *ngIf="data360.healthRecord?.regularMedications || data360.healthProfile?.regularMedications">
                        <div class="alert-title"><mat-icon>medication</mat-icon> Regular Medications / Inhalers</div>
                        <p>{{ data360.healthRecord?.regularMedications || data360.healthProfile?.regularMedications }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Clinical Details & Doctor Contact -->
                  <div class="health-card">
                    <div class="card-head">
                      <mat-icon class="head-icon blue">local_hospital</mat-icon>
                      <h4>Clinical Vitals &amp; Doctor Contacts</h4>
                    </div>
                    <div class="clinical-rows">
                      <div class="c-row">
                        <span class="c-lbl">Blood Group:</span>
                        <strong class="c-val blood-tag">{{ data360.healthRecord?.bloodGroup || data360.healthProfile?.bloodGroup || data360.student.bloodGroup || 'Not Tested' }}</strong>
                      </div>
                      <div class="c-row">
                        <span class="c-lbl">Vision Assessment:</span>
                        <span class="c-val">Left: {{ data360.healthRecord?.visionLeft || data360.healthProfile?.visionLeft || '6/6' }} &bull; Right: {{ data360.healthRecord?.visionRight || data360.healthProfile?.visionRight || '6/6' }}</span>
                      </div>
                      <div class="c-row">
                        <span class="c-lbl">Last Campus Checkup:</span>
                        <span class="c-val">{{ (data360.healthRecord?.lastCheckupDate || data360.healthProfile?.lastCheckupDate) ? ((data360.healthRecord?.lastCheckupDate || data360.healthProfile?.lastCheckupDate) | date:'dd MMM yyyy') : 'No checkup recorded' }}</span>
                      </div>
                      <div class="c-row" *ngIf="data360.healthRecord?.emergencyDoctorName || data360.healthProfile?.emergencyDoctorName">
                        <span class="c-lbl">Pediatrician / Doctor:</span>
                        <span class="c-val">{{ data360.healthRecord?.emergencyDoctorName || data360.healthProfile?.emergencyDoctorName }}</span>
                      </div>
                      <div class="c-row" *ngIf="data360.healthRecord?.emergencyDoctorPhone || data360.healthProfile?.emergencyDoctorPhone">
                        <span class="c-lbl">Emergency Doctor Phone:</span>
                        <a [href]="'tel:' + (data360.healthRecord?.emergencyDoctorPhone || data360.healthProfile?.emergencyDoctorPhone)" class="c-val phone-link">
                          <mat-icon>phone</mat-icon> {{ data360.healthRecord?.emergencyDoctorPhone || data360.healthProfile?.emergencyDoctorPhone }}
                        </a>
                      </div>
                    </div>
                    <div class="doc-notes-block" *ngIf="data360.healthRecord?.doctorNotes || data360.healthRecord?.doctorRemarks || data360.healthProfile?.doctorRemarks">
                      <div class="notes-heading">Physician's Guidance / Dietary Notes:</div>
                      <p>{{ data360.healthRecord?.doctorNotes || data360.healthRecord?.doctorRemarks || data360.healthProfile?.doctorRemarks }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </mat-tab>

            <!-- TAB 3: ⚠️ CONDUCT & DISCIPLINE (Feature 2) -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-icon">gavel</mat-icon> Conduct &amp; Discipline ({{ data360.disciplinaryRecords?.length || 0 }})
              </ng-template>
              <div class="tab-body-container">
                <div class="section-title-bar">
                  <div>
                    <h3 class="sec-title">Student Behavior &amp; Conduct Diary</h3>
                    <p class="sec-sub">Official record of positive commendations, exemplary conduct, and advisory notices</p>
                  </div>
                </div>

                <div class="conduct-list" *ngIf="data360.disciplinaryRecords?.length">
                  <div class="conduct-item" *ngFor="let rec of data360.disciplinaryRecords" [ngClass]="(rec.incidentType || 'minor').toLowerCase()">
                    <div class="type-pill-icon" [ngClass]="(rec.incidentType || 'minor').toLowerCase()">
                      <mat-icon *ngIf="rec.incidentType === 'PositiveCommendation'">thumb_up</mat-icon>
                      <mat-icon *ngIf="rec.incidentType !== 'PositiveCommendation'">report_problem</mat-icon>
                    </div>
                    <div class="conduct-main">
                      <div class="conduct-top-row">
                        <h4 class="rec-title">{{ rec.title }}</h4>
                        <div class="rec-tags">
                          <span class="severity-tag" [ngClass]="(rec.severity || 'low').toLowerCase()">{{ rec.severity }}</span>
                          <span class="status-tag" [ngClass]="(rec.status || (rec.isResolved ? 'resolved' : 'open')).toLowerCase()">
                            {{ rec.status || (rec.isResolved ? 'Resolved' : 'Open') }}
                          </span>
                        </div>
                      </div>
                      <p class="rec-desc">{{ rec.description }}</p>
                      <div class="rec-meta-row">
                        <span class="meta-item"><mat-icon>calendar_today</mat-icon> {{ rec.incidentDate | date:'dd MMM yyyy' }}</span>
                        <span class="meta-item" *ngIf="rec.reportedByName || rec.reportedBy"><mat-icon>person</mat-icon> Reported By: {{ rec.reportedByName || rec.reportedBy }}</span>
                        <span class="meta-item parent-notif" [class.notified]="rec.parentNotified">
                          <mat-icon>{{ rec.parentNotified ? 'notifications_active' : 'notifications_off' }}</mat-icon>
                          {{ rec.parentNotified ? 'Parent Formally Notified' : 'Internal Note' }}
                        </span>
                      </div>
                      <div class="outcome-box" *ngIf="rec.actionTaken">
                        <strong>Outcome / Commendation:</strong> {{ rec.actionTaken }}
                      </div>
                    </div>
                  </div>
                </div>

                <div class="empty-state-card" *ngIf="!data360.disciplinaryRecords?.length">
                  <mat-icon class="empty-icon text-success">verified</mat-icon>
                  <h4>Clean Conduct Sheet</h4>
                  <p>Exemplary institutional behavior! No disciplinary infractions recorded.</p>
                </div>
              </div>
            </mat-tab>

            <!-- TAB 4: 👨‍👩‍👧 PTM & PARENT FEEDBACK (Feature 3) -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-icon">record_voice_over</mat-icon> PTM Desk ({{ data360.ptmRecords?.length || 0 }})
              </ng-template>
              <div class="tab-body-container">
                <div class="section-title-bar">
                  <div>
                    <h3 class="sec-title">Parent-Teacher Meeting &amp; Feedback Journal</h3>
                    <p class="sec-sub">Summary of conferences, faculty guidance, parent feedback, and agreed action plans</p>
                  </div>
                </div>

                <div class="ptm-timeline" *ngIf="data360.ptmRecords?.length">
                  <div class="ptm-card" *ngFor="let ptm of data360.ptmRecords">
                    <div class="ptm-card-header">
                      <div class="ptm-header-left">
                        <div class="ptm-date-badge">
                          <span class="ptm-day">{{ (ptm.meetingDate || ptm.ptmDate) | date:'dd' }}</span>
                          <span class="ptm-mon">{{ (ptm.meetingDate || ptm.ptmDate) | date:'MMM yyyy' }}</span>
                        </div>
                        <div class="ptm-meta-block">
                          <div class="ptm-attendee">Met with: <strong>{{ ptm.attendedByParentName || ptm.parentAttended }}</strong></div>
                          <div class="ptm-teacher" *ngIf="ptm.teacherName">Conducted by: <strong>{{ ptm.teacherName }}</strong></div>
                        </div>
                      </div>
                      <div class="ptm-header-right">
                        <span class="satisfaction-badge" [ngClass]="(ptm.satisfactionRating || 'satisfied').toLowerCase()">
                          {{ formatRating(ptm.satisfactionRating) }}
                        </span>
                      </div>
                    </div>
                    <div class="ptm-card-body">
                      <div class="ptm-section" *ngIf="ptm.discussionSummary || ptm.childStrengths">
                        <div class="ptm-sec-title"><mat-icon>forum</mat-icon> Agenda &amp; Discussion Summary</div>
                        <p class="ptm-sec-text">{{ ptm.discussionSummary || ptm.childStrengths }}</p>
                      </div>
                      <div class="ptm-dual-row">
                        <div class="ptm-box teacher-box" *ngIf="ptm.teacherRemarks">
                          <div class="box-title"><mat-icon>school</mat-icon> Teacher's Guidance &amp; Remarks</div>
                          <p>{{ ptm.teacherRemarks }}</p>
                        </div>
                        <div class="ptm-box parent-box" *ngIf="ptm.parentFeedback">
                          <div class="box-title"><mat-icon>family_restroom</mat-icon> Parent's Feedback / Concerns</div>
                          <p>{{ ptm.parentFeedback }}</p>
                        </div>
                      </div>
                      <div class="ptm-action-points" *ngIf="ptm.actionPoints || ptm.areasOfImprovement">
                        <mat-icon>checklist</mat-icon>
                        <div><strong>Agreed Action Commitments / Areas for Growth:</strong> {{ ptm.actionPoints || ptm.areasOfImprovement }}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="empty-state-card" *ngIf="!data360.ptmRecords?.length">
                  <mat-icon class="empty-icon">groups</mat-icon>
                  <h4>No PTM Logs Recorded Yet</h4>
                  <p>Parent-Teacher conferences will be logged here with discussion notes and guidance.</p>
                </div>
              </div>
            </mat-tab>

            <!-- TAB 5: 💰 FEE LEDGER & INVOICES -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-icon">payments</mat-icon> Fee Ledger
              </ng-template>
              <div class="tab-body-container">
                <div class="section-title-bar">
                  <div>
                    <h3 class="sec-title">Institutional Fee Ledger &amp; Due Invoices</h3>
                    <p class="sec-sub">Summary of invoiced fees, payment status, receipts, and balance dues</p>
                  </div>
                </div>

                <div class="fee-metrics-row">
                  <div class="metric-card total">
                    <span class="m-lbl">Total Billed</span>
                    <span class="m-val">₹{{ data360.feeSummary.totalInvoiced | number:'1.2-2' }}</span>
                  </div>
                  <div class="metric-card paid">
                    <span class="m-lbl">Total Paid</span>
                    <span class="m-val">₹{{ data360.feeSummary.totalPaid | number:'1.2-2' }}</span>
                  </div>
                  <div class="metric-card due" [class.has-due]="data360.feeSummary.totalPending > 0">
                    <span class="m-lbl">Pending Dues</span>
                    <span class="m-val">₹{{ data360.feeSummary.totalPending | number:'1.2-2' }}</span>
                  </div>
                </div>

                <div class="invoice-table-wrap" *ngIf="data360.feeSummary.recentInvoices?.length">
                  <table class="custom-table">
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Paid</th>
                        <th>Balance</th>
                        <th>Due Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let inv of data360.feeSummary.recentInvoices">
                        <td class="font-mono"><strong>{{ inv.invoiceNumber }}</strong></td>
                        <td>{{ inv.title }}</td>
                        <td>₹{{ inv.totalAmount | number:'1.2-2' }}</td>
                        <td class="text-success">₹{{ inv.paidAmount | number:'1.2-2' }}</td>
                        <td [class.text-danger]="inv.balanceAmount > 0">₹{{ inv.balanceAmount | number:'1.2-2' }}</td>
                        <td>{{ inv.dueDate | date:'dd MMM yyyy' }}</td>
                        <td>
                          <span class="inv-status-pill" [ngClass]="inv.status.toLowerCase()">{{ inv.status }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </mat-tab>

            <!-- TAB 6: 📅 ATTENDANCE SUMMARY -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-icon">event_available</mat-icon> Attendance Log
              </ng-template>
              <div class="tab-body-container">
                <div class="section-title-bar">
                  <div>
                    <h3 class="sec-title">Student Attendance &amp; Punch Records</h3>
                    <p class="sec-sub">Attendance compliance percentage and recent biometric/manual classroom records</p>
                  </div>
                </div>

                <div class="att-metrics-row">
                  <div class="att-card" [class.warning]="data360.attendanceSummary.attendancePercentage < 75">
                    <span class="a-lbl">Cumulative Rate</span>
                    <span class="a-val">{{ data360.attendanceSummary.attendancePercentage | number:'1.1-1' }}%</span>
                    <span class="a-sub">{{ data360.attendanceSummary.attendancePercentage >= 75 ? 'Healthy Compliance' : 'Below 75% Threshold' }}</span>
                  </div>
                  <div class="att-card">
                    <span class="a-lbl">Total Days</span>
                    <span class="a-val">{{ data360.attendanceSummary.totalRecordedDays }}</span>
                    <span class="a-sub">Recorded Working Days</span>
                  </div>
                  <div class="att-card text-success">
                    <span class="a-lbl">Present Days</span>
                    <span class="a-val">{{ data360.attendanceSummary.presentDays }}</span>
                    <span class="a-sub">Full Day Present</span>
                  </div>
                  <div class="att-card text-danger">
                    <span class="a-lbl">Absent Days</span>
                    <span class="a-val">{{ data360.attendanceSummary.absentDays }}</span>
                    <span class="a-sub">Unexcused Absences</span>
                  </div>
                </div>

                <div class="recent-punches-wrap" *ngIf="data360.attendanceSummary.recentLogs?.length">
                  <h4 class="sub-heading">Recent Daily Attendance Logs:</h4>
                  <div class="punch-chips-row">
                    <div class="punch-chip" *ngFor="let p of data360.attendanceSummary.recentLogs" [ngClass]="p.status.toLowerCase()">
                      <span class="date">{{ p.date | date:'dd MMM' }}</span>
                      <span class="st">{{ p.status }}</span>
                    </div>
                  </div>
                </div>

                <!-- Regularization Requests Section -->
                <div class="regularization-requests-wrap">
                  <div class="reg-section-header">
                    <div class="reg-title-group">
                      <mat-icon class="reg-sec-icon">rule_folder</mat-icon>
                      <div>
                        <h4 class="sub-heading" style="margin-bottom: 2px;">My Attendance Regularization &amp; OD Requests</h4>
                        <p class="reg-sub-desc">Status of your submitted attendance dispute, On-Duty (OD), and medical leave regularizations</p>
                      </div>
                    </div>
                    <button mat-stroked-button class="apply-reg-btn" (click)="openRegularizationDialog()">
                      <mat-icon>add_circle</mat-icon> Request Regularization
                    </button>
                  </div>

                  <!-- Loading state -->
                  <div class="reg-mini-loader" *ngIf="loadingRegularizations">
                    <mat-spinner diameter="24"></mat-spinner>
                    <span>Loading your requests...</span>
                  </div>

                  <!-- Empty state -->
                  <div class="reg-empty-strip" *ngIf="!loadingRegularizations && myRegularizations.length === 0">
                    <mat-icon>task_alt</mat-icon>
                    <div>
                      <strong>No Regularization Requests</strong>
                      <p>You have not submitted any attendance regularization requests yet. If you were absent due to an event, sports, or illness, you can submit a request above.</p>
                    </div>
                  </div>

                  <!-- Requests Cards / Table -->
                  <div class="reg-cards-list" *ngIf="!loadingRegularizations && myRegularizations.length > 0">
                    <div class="reg-item-card" *ngFor="let reg of myRegularizations" [ngClass]="reg.status.toLowerCase()">
                      <div class="reg-card-left">
                        <div class="reg-status-icon" [ngClass]="reg.status.toLowerCase()">
                          <mat-icon *ngIf="reg.status === 'Pending'">hourglass_top</mat-icon>
                          <mat-icon *ngIf="reg.status === 'Approved'">check_circle</mat-icon>
                          <mat-icon *ngIf="reg.status === 'Rejected'">cancel</mat-icon>
                        </div>
                        <div class="reg-main-info">
                          <div class="reg-date-row">
                            <span class="reg-for-date">Attendance Date: <strong>{{ reg.attendanceDate | date:'dd MMMM yyyy (EEEE)' }}</strong></span>
                            <span class="reg-cat-pill" [ngClass]="reg.reasonCategory.toLowerCase()">
                              {{ getCategoryLabel(reg.reasonCategory) }}
                            </span>
                            <span class="reg-req-status">Requested: <strong>{{ reg.requestedStatus }}</strong></span>
                          </div>
                          <p class="reg-reason-text">"{{ reg.reason }}"</p>
                          <div class="reg-proof-link" *ngIf="reg.attachmentUrl">
                            <a [href]="reg.attachmentUrl" target="_blank">
                              <mat-icon>attachment</mat-icon> View Attached Document / Proof
                            </a>
                          </div>
                          <!-- Teacher review info -->
                          <div class="reg-review-info" *ngIf="reg.status !== 'Pending'">
                            <span class="reviewer-txt">
                              <strong>Reviewed by:</strong> {{ reg.reviewedBy || 'Class Teacher' }} on <span [appIstDatetime]="reg.reviewedAt" format="datetime"></span>
                            </span>
                            <span class="teacher-remarks" *ngIf="reg.reviewRemarks">
                              <strong>Teacher Remarks:</strong> {{ reg.reviewRemarks }}
                            </span>
                          </div>
                          <div class="reg-pending-note" *ngIf="reg.status === 'Pending'">
                            <mat-icon>schedule</mat-icon>
                            <span>Awaiting review and approval from your Class Teacher.</span>
                          </div>
                        </div>
                      </div>

                      <div class="reg-card-right">
                        <span class="reg-badge" [ngClass]="reg.status.toLowerCase()">
                          {{ reg.status === 'Pending' ? 'Pending Review' : reg.status }}
                        </span>
                        <small class="reg-applied-time" [appIstDatetime]="reg.createdAt" prefix="Applied on "></small>
                        <button mat-icon-button color="warn" *ngIf="reg.status === 'Pending'" (click)="cancelMyRegularization(reg)" matTooltip="Cancel this request">
                          <mat-icon>delete_outline</mat-icon>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </mat-tab>

            <!-- TAB 7: 📚 LIBRARY & FACILITIES -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-icon">local_library</mat-icon> Library &amp; Facilities
              </ng-template>
              <div class="tab-body-container">
                <div class="facility-grid">
                  <!-- Library Card -->
                  <div class="fac-card">
                    <div class="fac-head">
                      <mat-icon>book</mat-icon>
                      <h4>Library Membership &amp; Issued Books</h4>
                    </div>
                    <div class="fac-body">
                      <div class="fac-info">Membership: <strong>{{ data360.library.isMember ? ('Active (' + (data360.library.membershipPlan || 'Standard') + ')') : 'No Membership' }}</strong></div>
                      <div class="fac-info" *ngIf="data360.library.libraryCardNumber">Card No: <strong>{{ data360.library.libraryCardNumber }}</strong></div>
                      
                      <div class="books-table-wrap" *ngIf="data360.library.issuedBooks?.length">
                        <table class="custom-table compact">
                          <thead>
                            <tr>
                              <th>Book Title</th>
                              <th>Issue Date</th>
                              <th>Due Date</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr *ngFor="let b of data360.library.issuedBooks">
                              <td>{{ b.bookTitle }}</td>
                              <td>{{ b.issueDate | date:'dd MMM yyyy' }}</td>
                              <td>{{ b.dueDate | date:'dd MMM yyyy' }}</td>
                              <td><span class="badge" [class.danger]="b.isOverdue">{{ b.isOverdue ? 'Overdue' : 'Active' }}</span></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div class="empty-sub" *ngIf="!data360.library.issuedBooks?.length">
                        No library books currently issued.
                      </div>
                    </div>
                  </div>

                  <!-- Campus Facilities -->
                  <div class="fac-card">
                    <div class="fac-head">
                      <mat-icon>apartment</mat-icon>
                      <h4>Hostel &amp; Transport Allotment</h4>
                    </div>
                    <div class="fac-body">
                      <div class="fac-row">
                        <span class="lbl"><mat-icon>hotel</mat-icon> Hostel:</span>
                        <span class="val">{{ data360.facilities.hasHostel ? (data360.facilities.hostelName + ' &bull; Room ' + data360.facilities.roomNumber + ' &bull; Bed ' + data360.facilities.bedCode) : 'Day Scholar (Not Enrolled)' }}</span>
                      </div>
                      <div class="fac-row">
                        <span class="lbl"><mat-icon>directions_bus</mat-icon> Transport:</span>
                        <span class="val">{{ data360.facilities.hasTransport ? ('Enrolled for Institute Bus Transport (' + (data360.facilities.routeName || 'Active Route') + ')') : 'Self Conveyance / Pedestrian' }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </mat-tab>

          </mat-tab-group>
        </div>

      </div>

      <!-- 🏆 PRINTABLE MERIT CERTIFICATE MODAL OVERLAY (Feature 1) -->
      <div class="cert-modal-backdrop" *ngIf="activeCertificateModal" (click)="activeCertificateModal = null">
        <div class="cert-dialog-window" (click)="$event.stopPropagation()">
          <div class="cert-modal-top-bar">
            <span>Certificate of Merit &amp; Excellence Preview</span>
            <div class="top-bar-actions">
              <button mat-raised-button color="primary" class="primary-gradient-btn" (click)="triggerPrint()">
                <mat-icon>print</mat-icon> Print Certificate
              </button>
              <button mat-icon-button (click)="activeCertificateModal = null">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>

          <div class="printable-certificate-sheet" id="printCertificateArea">
            <div class="cert-inner-border">
              <div class="cert-header">
                <div class="cert-seal-icon">🏆</div>
                <h1 class="cert-school-name">{{ data360?.student?.branchName || 'INTERNATIONAL ACADEMY OF EXCELLENCE' }}</h1>
                <h3 class="cert-heading">CERTIFICATE OF MERIT &amp; ACHIEVEMENT</h3>
                <div class="cert-ribbon-sub">This accolade is proudly conferred upon</div>
              </div>

              <div class="cert-recipient-name">{{ data360?.student?.studentName }}</div>
              
              <div class="cert-recipient-meta">
                Class: <strong>{{ data360?.student?.className }}</strong> &bull; 
                Roll No: <strong>{{ data360?.student?.rollNumber }}</strong> &bull; 
                Admission No: <strong>{{ data360?.student?.admissionNumber || 'N/A' }}</strong>
              </div>

              <p class="cert-citation">
                in proud recognition of outstanding dedication, exemplary talent and securing
                <span class="cert-pos-highlight">{{ activeCertificateModal.position || 'Merit Position' }}</span>
                in <strong class="cert-event-title">{{ activeCertificateModal.title }}</strong> 
                held at the <strong>{{ activeCertificateModal.level || activeCertificateModal.awardLevel || 'Institutional' }}</strong> level.
              </p>

              <div class="cert-signatures-row">
                <div class="cert-sign-col">
                  <div class="cert-sign-line"></div>
                  <span class="cert-sign-role">Class Teacher / Event Incharge</span>
                </div>
                <div class="cert-seal-stamp">
                  <div class="stamp-circle">
                    <span>INSTITUTE SEAL</span>
                    <small>{{ (activeCertificateModal.awardedDate || activeCertificateModal.awardDate) | date:'yyyy' }}</small>
                  </div>
                  <div class="cert-date-text">Date: {{ (activeCertificateModal.awardedDate || activeCertificateModal.awardDate) | date:'dd MMM yyyy' }}</div>
                </div>
                <div class="cert-sign-col">
                  <div class="cert-sign-line"></div>
                  <span class="cert-sign-role">Principal / Director</span>
                </div>
              </div>

              <div class="cert-certno" *ngIf="activeCertificateModal.certificateNumber">
                Cert No: {{ activeCertificateModal.certificateNumber }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 🩺 PRINTABLE POCKET EMERGENCY MEDICAL CARD MODAL (Feature 4) -->
      <div class="cert-modal-backdrop" *ngIf="showPrintMedicalCard" (click)="showPrintMedicalCard = false">
        <div class="medical-dialog-window" (click)="$event.stopPropagation()">
          <div class="cert-modal-top-bar">
            <span>Student Emergency Medical Pocket Card Preview</span>
            <div class="top-bar-actions">
              <button mat-raised-button color="primary" class="primary-gradient-btn" (click)="triggerPrint()">
                <mat-icon>print</mat-icon> Print ID Card
              </button>
              <button mat-icon-button (click)="showPrintMedicalCard = false">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>

          <div class="printable-medical-card" id="printMedicalCardArea">
            <div class="med-card-header">
              <div class="med-cross"><mat-icon>local_hospital</mat-icon></div>
              <div class="med-head-title">
                <h4>EMERGENCY MEDICAL IDENTITY CARD</h4>
                <span>{{ data360?.student?.branchName || 'School & Coaching Institution' }}</span>
              </div>
            </div>

            <div class="med-card-body">
              <div class="med-profile-row">
                <div class="med-photo-box">
                  <img *ngIf="data360?.student?.profilePhoto" [src]="getPhotoUrl(data360?.student?.profilePhoto)" />
                  <div *ngIf="!data360?.student?.profilePhoto" class="med-photo-fallback">
                    {{ getInitials(data360?.student?.studentName || 'S') }}
                  </div>
                </div>
                <div class="med-details-box">
                  <div class="med-name">{{ data360?.student?.studentName }}</div>
                  <div class="med-line">Class: <strong>{{ data360?.student?.className }}{{ data360?.student?.sectionName ? ' - ' + data360?.student?.sectionName : '' }}</strong> &bull; Roll: <strong>{{ data360?.student?.rollNumber }}</strong></div>
                  <div class="med-line">DOB: <strong>{{ data360?.student?.dateOfBirth ? (data360!.student.dateOfBirth | date:'dd-MM-yyyy') : 'N/A' }}</strong> &bull; Blood: <strong class="blood-highlight">{{ data360?.healthRecord?.bloodGroup || data360?.healthProfile?.bloodGroup || data360?.student?.bloodGroup || 'N/A' }}</strong></div>
                </div>
              </div>

              <div class="med-alert-box red" *ngIf="data360?.healthRecord?.knownAllergies || data360?.healthProfile?.knownAllergies">
                <strong>CRITICAL ALLERGIES:</strong> {{ data360?.healthRecord?.knownAllergies || data360?.healthProfile?.knownAllergies }}
              </div>
              <div class="med-alert-box amber" *ngIf="data360?.healthRecord?.chronicConditions || data360?.healthProfile?.chronicConditions">
                <strong>CHRONIC CONDITIONS:</strong> {{ data360?.healthRecord?.chronicConditions || data360?.healthProfile?.chronicConditions }}
              </div>

              <div class="med-contacts-grid">
                <div class="contact-entry">
                  <span class="label">Father / Guardian:</span>
                  <strong>{{ data360?.student?.parentName || 'N/A' }}</strong>
                  <div class="phone" *ngIf="data360?.student?.parentWhatsAppPhone">{{ data360?.student?.parentWhatsAppPhone }}</div>
                </div>
                <div class="contact-entry">
                  <span class="label">Pediatrician / Emergency Doc:</span>
                  <strong>{{ data360?.healthRecord?.emergencyDoctorName || data360?.healthProfile?.emergencyDoctorName || 'School Infirmary' }}</strong>
                  <div class="phone">{{ data360?.healthRecord?.emergencyDoctorPhone || data360?.healthProfile?.emergencyDoctorPhone || '+91 98765 43210' }}</div>
                </div>
              </div>

              <div class="med-footer-note">
                <span>In case of severe allergic reaction or sudden collapse, immediately contact doctor or campus infirmary.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .my-profile-container {
      font-family: 'Inter', sans-serif;
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 0 0 40px;
      width: 100%;
      box-sizing: border-box;
    }

    /* ── STRICT UI RULE: Light Blue Gradient Header ── */
    .portal-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 0;
      box-shadow: 0 1px 3px rgba(37, 99, 235, 0.08);
      flex-wrap: wrap;
      gap: 16px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .portal-badge-icon {
      width: 48px;
      height: 48px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .portal-badge-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }
    .portal-title {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 700;
      color: #1e3a8a;
    }
    .portal-subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.85rem;
      color: #3b82f6;
    }
    .header-actions {
      display: flex;
      gap: 0.75rem;
    }
    .primary-gradient-btn {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
      color: #ffffff !important;
      font-weight: 600 !important;
      border-radius: 8px !important;
    }
    .print-medical-btn {
      border-color: #2563eb !important;
      color: #1e40af !important;
      font-weight: 600 !important;
      border-radius: 8px !important;
      background: #ffffff !important;
    }

    /* ── Hero Identity Card ── */
    .hero-identity-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }
    .hero-identity-row {
      display: flex;
      gap: 1.5rem;
      align-items: center;
    }
    .avatar-wrap {
      width: 80px;
      height: 80px;
      border-radius: 14px;
      overflow: hidden;
      border: 3px solid #dbeafe;
      background: #eff6ff;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .avatar-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .avatar-fallback {
      font-size: 2rem;
      font-weight: 700;
      color: #2563eb;
    }
    .hero-details {
      flex: 1;
    }
    .hero-name-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
      flex-wrap: wrap;
    }
    .student-name {
      margin: 0;
      font-size: 1.4rem;
      font-weight: 800;
      color: #0f172a;
    }
    .active-badge {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 20px;
      background: #dcfce7;
      color: #15803d;
    }
    .active-badge.inactive {
      background: #fee2e2;
      color: #b91c1c;
    }
    .star-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 20px;
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .star-badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .hero-meta-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
    }
    .meta-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.85rem;
      color: #475569;
    }
    .meta-pill mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #3b82f6;
    }
    .blood-text {
      color: #dc2626 !important;
    }

    /* ── Performance Radar Banner ── */
    .performance-radar-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 0;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .radar-status-col {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }
    .badge-icon-circle {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #16a34a;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .badge-icon-circle.star {
      background: #eab308;
    }
    .badge-icon-circle.warning {
      background: #ea580c;
    }
    .radar-badge-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #15803d;
      font-weight: 700;
    }
    .radar-badge-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 800;
      color: #14532d;
    }
    .radar-insights-col {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      flex-wrap: wrap;
    }
    .insight-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .insight-label {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.8rem;
      font-weight: 700;
      color: #334155;
    }
    .insight-label mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .tag-row {
      display: flex;
      gap: 0.35rem;
    }
    .subject-tag {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
    }
    .subject-tag.strong {
      background: #bbf7d0;
      color: #14532d;
    }
    .subject-tag.weak {
      background: #fed7aa;
      color: #9a3412;
    }
    .alert-message-box {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #fee2e2;
      color: #991b1b;
      padding: 0.3rem 0.6rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .alert-message-box mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    /* ── Tabs Wrapper ── */
    .tabs-wrapper {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      overflow: hidden;
    }
    .tab-icon {
      margin-right: 0.4rem;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .tab-body-container {
      padding: 1.5rem;
    }
    .section-title-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #f1f5f9;
    }
    .sec-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: #0f172a;
    }
    .sec-sub {
      margin: 0.25rem 0 0;
      font-size: 0.825rem;
      color: #64748b;
    }

    /* ── Wall of Fame Cards ── */
    .achievement-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.25rem;
    }
    .honor-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .honor-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
    }
    .honor-card.academic { border-top: 4px solid #2563eb; }
    .honor-card.sports { border-top: 4px solid #16a34a; }
    .honor-card.cultural { border-top: 4px solid #9333ea; }
    .honor-card.olympiad { border-top: 4px solid #d97706; }
    .honor-top {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .honor-badge-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #eff6ff;
      color: #2563eb;
      flex-shrink: 0;
    }
    .honor-badge-icon.sports { background: #f0fdf4; color: #16a34a; }
    .honor-badge-icon.cultural { background: #faf5ff; color: #9333ea; }
    .honor-badge-icon.olympiad { background: #fefce8; color: #d97706; }
    .honor-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.3;
    }
    .honor-meta {
      display: flex;
      gap: 0.35rem;
      margin-top: 0.35rem;
      flex-wrap: wrap;
    }
    .honor-category-tag {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      background: #eff6ff;
      color: #2563eb;
    }
    .level-tag, .pos-tag {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      background: #f1f5f9;
      color: #334155;
    }
    .pos-tag {
      background: #fef3c7;
      color: #92400e;
      font-weight: 700;
    }
    .honor-body {
      flex: 1;
      margin-bottom: 1rem;
    }
    .honor-info-line {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      margin-bottom: 0.3rem;
      color: #64748b;
    }
    .meta-text {
      color: #1e293b;
      font-weight: 600;
    }
    .honor-remarks {
      margin: 0.5rem 0 0;
      font-size: 0.8rem;
      color: #475569;
      font-style: italic;
      line-height: 1.4;
    }
    .honor-footer {
      border-top: 1px solid #f1f5f9;
      padding-top: 0.75rem;
    }
    .print-cert-btn {
      width: 100%;
      border-color: #bfdbfe !important;
      color: #1e40af !important;
      font-weight: 600 !important;
      border-radius: 6px !important;
      background: #eff6ff !important;
    }

    /* ── Health Cards ── */
    .health-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.5rem;
    }
    .health-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.25rem;
    }
    .card-head {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #f1f5f9;
    }
    .card-head h4 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
      color: #0f172a;
    }
    .head-icon {
      color: #2563eb;
    }
    .head-icon.red { color: #dc2626; }
    .head-icon.blue { color: #0284c7; }
    .vitals-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }
    .vital-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.75rem 0.5rem;
      text-align: center;
      display: flex;
      flex-direction: column;
    }
    .vital-item.highlight {
      background: #eff6ff;
      border-color: #bfdbfe;
    }
    .v-lbl {
      font-size: 0.75rem;
      color: #64748b;
      font-weight: 600;
    }
    .v-val {
      font-size: 1.15rem;
      font-weight: 800;
      color: #0f172a;
      margin-top: 0.2rem;
    }
    .vital-item.highlight .v-val {
      color: #1e40af;
    }

    /* BMI Meter */
    .meter-bar {
      display: grid;
      grid-template-columns: 1fr 1.2fr 1fr 0.8fr;
      gap: 2px;
      background: #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }
    .meter-seg {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.35rem 0.2rem;
      text-align: center;
      color: #ffffff;
      opacity: 0.45;
      transition: opacity 0.2s;
    }
    .meter-seg.under { background: #3b82f6; }
    .meter-seg.normal { background: #16a34a; }
    .meter-seg.over { background: #f97316; }
    .meter-seg.obese { background: #dc2626; }
    .meter-seg.current {
      opacity: 1;
      box-shadow: 0 0 0 2px #0f172a inset;
    }
    .bmi-result-txt {
      font-size: 0.825rem;
      color: #334155;
      text-align: center;
      margin-top: 0.5rem;
    }
    .bmi-result-txt strong.normal { color: #16a34a; }
    .bmi-result-txt strong.underweight { color: #2563eb; }
    .bmi-result-txt strong.overweight { color: #ea580c; }
    .bmi-result-txt strong.obese { color: #dc2626; }

    /* Allergies & Alerts */
    .alerts-content {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .alert-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.75rem;
    }
    .alert-box.has-allergy {
      background: #fef2f2;
      border-color: #fecaca;
    }
    .alert-box.has-condition {
      background: #fffbeb;
      border-color: #fef3c7;
    }
    .alert-title {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 0.25rem;
      color: #64748b;
    }
    .alert-box.has-allergy .alert-title { color: #dc2626; }
    .alert-box.has-condition .alert-title { color: #b45309; }
    .alert-box p {
      margin: 0;
      font-size: 0.85rem;
      color: #1e293b;
      font-weight: 500;
    }

    /* Clinical rows */
    .clinical-rows {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .c-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      padding-bottom: 0.4rem;
      border-bottom: 1px dashed #f1f5f9;
    }
    .c-lbl { color: #64748b; }
    .c-val { color: #0f172a; font-weight: 600; }
    .blood-tag {
      background: #fee2e2;
      color: #991b1b;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
    }
    .phone-link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: #2563eb !important;
      text-decoration: none;
    }
    .doc-notes-block {
      margin-top: 1rem;
      background: #f8fafc;
      border-radius: 8px;
      padding: 0.75rem;
      border-left: 3px solid #2563eb;
    }
    .notes-heading {
      font-size: 0.75rem;
      font-weight: 700;
      color: #475569;
      margin-bottom: 0.25rem;
    }
    .doc-notes-block p {
      margin: 0;
      font-size: 0.8rem;
      color: #334155;
    }

    /* ── Conduct List ── */
    .conduct-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .conduct-item {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1rem;
      display: flex;
      gap: 1rem;
    }
    .conduct-item.positivecommendation {
      border-left: 4px solid #16a34a;
      background: #fcfdfc;
    }
    .type-pill-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .type-pill-icon.positivecommendation {
      background: #dcfce7;
      color: #16a34a;
    }
    .conduct-main {
      flex: 1;
    }
    .conduct-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.35rem;
    }
    .rec-title {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
      color: #0f172a;
    }
    .rec-tags {
      display: flex;
      gap: 0.35rem;
    }
    .severity-tag, .status-tag {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      background: #f1f5f9;
      color: #334155;
    }
    .severity-tag.commendation { background: #dcfce7; color: #16a34a; }
    .status-tag.resolved { background: #dbeafe; color: #1e40af; }
    .rec-desc {
      margin: 0 0 0.5rem;
      font-size: 0.85rem;
      color: #475569;
      line-height: 1.4;
    }
    .rec-meta-row {
      display: flex;
      gap: 1rem;
      font-size: 0.75rem;
      color: #64748b;
      flex-wrap: wrap;
    }
    .meta-item {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    .meta-item mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .parent-notif.notified { color: #16a34a; font-weight: 600; }
    .outcome-box {
      margin-top: 0.5rem;
      background: #eff6ff;
      border-radius: 6px;
      padding: 0.4rem 0.6rem;
      font-size: 0.8rem;
      color: #1e40af;
    }

    /* ── PTM Timeline ── */
    .ptm-timeline {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .ptm-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }
    .ptm-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      padding: 0.85rem 1.25rem;
      border-bottom: 1px solid #e2e8f0;
    }
    .ptm-header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .ptm-date-badge {
      background: #2563eb;
      color: #ffffff;
      border-radius: 8px;
      padding: 0.25rem 0.6rem;
      text-align: center;
      display: flex;
      flex-direction: column;
    }
    .ptm-day { font-size: 1.1rem; font-weight: 800; line-height: 1; }
    .ptm-mon { font-size: 0.65rem; text-transform: uppercase; font-weight: 600; }
    .ptm-attendee { font-size: 0.9rem; color: #1e293b; }
    .ptm-teacher { font-size: 0.8rem; color: #64748b; }
    .satisfaction-badge {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 20px;
      background: #dcfce7;
      color: #15803d;
    }
    .ptm-card-body {
      padding: 1.25rem;
    }
    .ptm-sec-title {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.8rem;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      margin-bottom: 0.25rem;
    }
    .ptm-sec-title mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }
    .ptm-sec-text { margin: 0 0 1rem; font-size: 0.875rem; color: #1e293b; line-height: 1.4; }
    .ptm-dual-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .ptm-box {
      border-radius: 8px;
      padding: 0.85rem;
    }
    .ptm-box.teacher-box { background: #eff6ff; border-left: 3px solid #3b82f6; }
    .ptm-box.parent-box { background: #fdf4ff; border-left: 3px solid #d946ef; }
    .box-title {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.75rem;
      font-weight: 700;
      color: #334155;
      margin-bottom: 0.25rem;
    }
    .box-title mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .ptm-box p { margin: 0; font-size: 0.825rem; color: #1e293b; line-height: 1.35; }
    .ptm-action-points {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 0.75rem;
      font-size: 0.85rem;
      color: #166534;
    }
    .ptm-action-points mat-icon { font-size: 18px; width: 18px; height: 18px; color: #16a34a; }

    /* ── Fee Metrics & Table ── */
    .fee-metrics-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .metric-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1rem;
      text-align: center;
    }
    .metric-card.paid { border-left: 4px solid #16a34a; }
    .metric-card.due.has-due { border-left: 4px solid #dc2626; }
    .m-lbl { font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase; }
    .m-val { display: block; font-size: 1.35rem; font-weight: 800; color: #0f172a; margin-top: 0.25rem; }
    .metric-card.paid .m-val { color: #15803d; }
    .metric-card.due.has-due .m-val { color: #b91c1c; }
    .custom-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    .custom-table th {
      background: #f8fafc;
      color: #475569;
      font-weight: 700;
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    .custom-table td {
      padding: 0.75rem;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
    }
    .inv-status-pill {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background: #f1f5f9;
    }
    .inv-status-pill.paid { background: #dcfce7; color: #15803d; }
    .inv-status-pill.partial { background: #fef3c7; color: #92400e; }
    .inv-status-pill.pending { background: #fee2e2; color: #b91c1c; }

    /* ── Attendance Metrics ── */
    .att-metrics-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .att-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1rem;
      text-align: center;
      border-left: 4px solid #2563eb;
    }
    .att-card.warning { border-left-color: #dc2626; }
    .a-lbl { font-size: 0.75rem; color: #64748b; font-weight: 600; }
    .a-val { display: block; font-size: 1.4rem; font-weight: 800; color: #0f172a; margin-top: 0.25rem; }
    .a-sub { font-size: 0.7rem; color: #64748b; }
    .recent-punches-wrap {
      background: #f8fafc;
      border-radius: 10px;
      padding: 1rem;
    }
    .sub-heading { margin: 0 0 0.75rem; font-size: 0.9rem; font-weight: 700; color: #334155; }
    .punch-chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .punch-chip {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 0.35rem 0.6rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-size: 0.75rem;
    }
    .punch-chip.present { border-color: #86efac; background: #f0fdf4; color: #166534; font-weight: 700; }
    .punch-chip.absent { border-color: #fca5a5; background: #fef2f2; color: #991b1b; font-weight: 700; }
    .punch-chip.late { border-color: #fde047; background: #fefce8; color: #854d0e; font-weight: 700; }

    /* ── Regularization Requests Section ── */
    .regularization-requests-wrap {
      margin-top: 1.5rem;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .reg-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #f1f5f9;
      .reg-title-group {
        display: flex;
        align-items: center;
        gap: 10px;
        .reg-sec-icon {
          color: #2563eb;
          font-size: 28px;
          width: 28px;
          height: 28px;
        }
      }
      .reg-sub-desc {
        margin: 0;
        font-size: 0.78rem;
        color: #64748b;
      }
      .apply-reg-btn {
        color: #2563eb;
        border-color: #bfdbfe;
        background: #eff6ff;
        font-weight: 600;
        font-size: 0.82rem;
        &:hover {
          background: #dbeafe;
        }
      }
    }
    .reg-mini-loader {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px;
      color: #64748b;
      font-size: 0.85rem;
    }
    .reg-empty-strip {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      color: #64748b;
      mat-icon { font-size: 26px; width: 26px; height: 26px; color: #94a3b8; }
      strong { color: #334155; font-size: 0.88rem; display: block; margin-bottom: 2px; }
      p { margin: 0; font-size: 0.8rem; }
    }
    .reg-cards-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .reg-item-card {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding: 14px 16px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      transition: all 0.2s ease;
      &.pending {
        border-left: 4px solid #f59e0b;
        background: #fffdf5;
      }
      &.approved {
        border-left: 4px solid #10b981;
        background: #f0fdf4;
      }
      &.rejected {
        border-left: 4px solid #ef4444;
        background: #fef2f2;
      }
      .reg-card-left {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        flex: 1;
        .reg-status-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
          &.pending { background: #fef3c7; color: #b45309; }
          &.approved { background: #dcfce7; color: #15803d; }
          &.rejected { background: #fee2e2; color: #b91c1c; }
        }
        .reg-main-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          .reg-date-row {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
            font-size: 0.85rem;
            .reg-for-date { color: #1e293b; }
            .reg-cat-pill {
              font-size: 0.72rem;
              font-weight: 600;
              padding: 2px 7px;
              border-radius: 9999px;
              background: #eff6ff;
              color: #1d4ed8;
              &.onduty { background: #fef3c7; color: #92400e; }
              &.medical { background: #fee2e2; color: #991b1b; }
              &.rollcallerror { background: #e0f2fe; color: #0369a1; }
              &.punchmiss { background: #f3e8ff; color: #6b21a8; }
            }
            .reg-req-status { font-size: 0.78rem; color: #15803d; }
          }
          .reg-reason-text {
            margin: 2px 0 0;
            font-size: 0.86rem;
            color: #334155;
            font-style: italic;
          }
          .reg-proof-link {
            a {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              font-size: 0.78rem;
              color: #2563eb;
              font-weight: 600;
              text-decoration: none;
              mat-icon { font-size: 15px; width: 15px; height: 15px; }
              &:hover { text-decoration: underline; }
            }
          }
          .reg-review-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
            margin-top: 4px;
            font-size: 0.78rem;
            color: #059669;
            .teacher-remarks { color: #1e293b; font-weight: 500; }
          }
          .reg-pending-note {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 0.75rem;
            color: #b45309;
            mat-icon { font-size: 14px; width: 14px; height: 14px; }
          }
        }
      }
      .reg-card-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        flex-shrink: 0;
        .reg-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          &.pending { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
          &.approved { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
          &.rejected { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
        }
        .reg-applied-time { font-size: 0.72rem; color: #94a3b8; }
      }
    }

    /* ── Facilities ── */
    .facility-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.25rem;
    }
    .fac-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1.25rem;
    }
    .fac-head {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
      color: #2563eb;
    }
    .fac-head h4 { margin: 0; font-size: 0.95rem; font-weight: 700; color: #0f172a; }
    .fac-row {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      font-size: 0.85rem;
    }
    .fac-row .lbl {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: #64748b;
      min-width: 100px;
    }
    .fac-row .lbl mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* Empty Card */
    .empty-state-card {
      text-align: center;
      padding: 3rem 1.5rem;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 12px;
    }
    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #94a3b8;
      margin-bottom: 0.5rem;
    }
    .empty-state-card h4 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: #334155;
    }
    .empty-state-card p {
      margin: 0.25rem 0 0;
      font-size: 0.85rem;
      color: #64748b;
    }

    /* ── STRICT UI RULE: Printable Certificate Modal Overlay ── */
    .cert-modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .cert-dialog-window, .medical-dialog-window {
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      max-width: 820px;
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    }
    .cert-modal-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      color: #1e3a8a;
      font-weight: 700;
      font-size: 1rem;
    }
    .top-bar-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Certificate Paper Sheet */
    .printable-certificate-sheet {
      padding: 2.5rem;
      background: #fffdfa;
      overflow-y: auto;
    }
    .cert-inner-border {
      border: 3px double #b45309;
      padding: 2rem 2.5rem;
      text-align: center;
      position: relative;
      background: #ffffff;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    }
    .cert-seal-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .cert-school-name {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: 0.05em;
    }
    .cert-heading {
      margin: 0.5rem 0;
      font-size: 1.15rem;
      font-weight: 800;
      color: #b45309;
      letter-spacing: 0.1em;
    }
    .cert-ribbon-sub {
      font-size: 0.85rem;
      color: #64748b;
      font-style: italic;
      margin-bottom: 1rem;
    }
    .cert-recipient-name {
      font-size: 1.85rem;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 2px solid #b45309;
      display: inline-block;
      padding: 0 1.5rem 0.25rem;
      margin-bottom: 0.75rem;
    }
    .cert-recipient-meta {
      font-size: 0.85rem;
      color: #475569;
      margin-bottom: 1.25rem;
    }
    .cert-citation {
      font-size: 0.95rem;
      color: #334155;
      line-height: 1.6;
      max-width: 600px;
      margin: 0 auto 2rem;
    }
    .cert-pos-highlight {
      font-weight: 800;
      color: #b45309;
    }
    .cert-event-title {
      color: #1e3a8a;
    }
    .cert-signatures-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 2rem;
      padding: 0 1rem;
    }
    .cert-sign-col {
      width: 180px;
      text-align: center;
    }
    .cert-sign-line {
      border-bottom: 1.5px solid #64748b;
      margin-bottom: 0.35rem;
    }
    .cert-sign-role {
      font-size: 0.75rem;
      color: #475569;
      font-weight: 600;
    }
    .cert-seal-stamp {
      text-align: center;
    }
    .stamp-circle {
      width: 80px;
      height: 80px;
      border: 2px dashed #b45309;
      border-radius: 50%;
      margin: 0 auto 0.25rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #b45309;
      font-size: 0.65rem;
      font-weight: 800;
    }
    .cert-date-text {
      font-size: 0.75rem;
      color: #64748b;
    }
    .cert-certno {
      margin-top: 1rem;
      font-size: 0.7rem;
      color: #94a3b8;
      font-family: monospace;
    }

    /* ── Printable Pocket Medical Card ── */
    .printable-medical-card {
      padding: 1.5rem;
      background: #ffffff;
    }
    .med-card-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
    }
    .med-cross {
      width: 36px;
      height: 36px;
      background: #dc2626;
      color: #ffffff;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .med-head-title h4 { margin: 0; font-size: 0.95rem; font-weight: 800; color: #1e3a8a; }
    .med-head-title span { font-size: 0.75rem; color: #3b82f6; }
    .med-profile-row {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
      align-items: center;
    }
    .med-photo-box {
      width: 64px;
      height: 64px;
      border-radius: 10px;
      background: #f1f5f9;
      overflow: hidden;
      flex-shrink: 0;
      border: 2px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .med-photo-box img { width: 100%; height: 100%; object-fit: cover; }
    .med-photo-fallback { font-size: 1.5rem; font-weight: 800; color: #2563eb; }
    .med-name { font-size: 1.15rem; font-weight: 800; color: #0f172a; margin-bottom: 0.25rem; }
    .med-line { font-size: 0.8rem; color: #475569; }
    .blood-highlight { color: #dc2626; font-size: 0.9rem; }
    .med-alert-box {
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
      font-size: 0.8rem;
      margin-bottom: 0.5rem;
    }
    .med-alert-box.red { background: #fee2e2; border: 1px solid #fecaca; color: #991b1b; }
    .med-alert-box.amber { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; }
    .med-contacts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-top: 1rem;
      background: #f8fafc;
      padding: 0.75rem;
      border-radius: 8px;
    }
    .contact-entry { font-size: 0.8rem; }
    .contact-entry .label { font-size: 0.7rem; color: #64748b; display: block; }
    .contact-entry strong { color: #0f172a; }
    .contact-entry .phone { color: #2563eb; font-weight: 600; margin-top: 0.15rem; }
    .med-footer-note {
      margin-top: 0.75rem;
      font-size: 0.7rem;
      color: #94a3b8;
      text-align: center;
      font-style: italic;
    }

    /* Embedded Timetable Mini Cards */
    .mini-timetable-container {
      margin-top: 1rem;
    }
    .mini-periods-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 1rem;
    }
    .mini-period-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      transition: all 0.15s;
    }
    .mini-period-card:hover {
      border-color: #cbd5e1;
      box-shadow: 0 4px 12px rgba(0,0,0,0.04);
    }
    .mini-period-card.live-card {
      border-color: #10b981;
      background: #f0fdf4;
      box-shadow: 0 4px 14px rgba(16,185,129,0.15);
    }
    .mini-period-card.completed-card {
      opacity: 0.75;
      background: #f8fafc;
    }
    .mini-period-card.proxy-card {
      border-left: 4px solid #f59e0b;
    }
    .mpc-top {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .mpc-pnum {
      font-size: 0.95rem;
      font-weight: 800;
      color: #0f172a;
    }
    .mpc-time {
      font-size: 0.75rem;
      color: #64748b;
      margin-right: auto;
    }
    .mpc-live-tag {
      font-size: 0.65rem;
      font-weight: 800;
      background: #dcfce7;
      color: #15803d;
      padding: 1px 6px;
      border-radius: 4px;
    }
    .mpc-proxy-tag {
      font-size: 0.65rem;
      font-weight: 800;
      background: #fef3c7;
      color: #b45309;
      padding: 1px 6px;
      border-radius: 4px;
    }
    .mpc-subject {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 800;
      color: #1e3a8a;
    }
    .mpc-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
      color: #475569;
    }
    .mpc-teacher, .mpc-room {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .mpc-teacher mat-icon, .mpc-room mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: #64748b;
    }
    .mpc-sub-notice {
      background: #fffbeb;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 0.75rem;
      color: #92400e;
    }

    @media print {
      body * { visibility: hidden; }
      #printCertificateArea, #printCertificateArea *,
      #printMedicalCardArea, #printMedicalCardArea * {
        visibility: visible;
      }
      #printCertificateArea, #printMedicalCardArea {
        position: absolute;
        left: 0; top: 0;
        width: 100%;
      }
    }
  `]
})
export class MyStudentProfileComponent implements OnInit {
  data360: Student360Data | null = null;
  loading = true;
  activeTabIndex = 0;

  timetableMiniData: StudentWeeklyTimetableDto | null = null;
  activeCertificateModal: StudentAchievementDto | null = null;
  showPrintMedicalCard = false;

  // Regularization requests
  myRegularizations: StudentAttendanceRegularizationDto[] = [];
  loadingRegularizations = false;

  constructor(
    private coachingService: CoachingService,
    public authService: AuthService,
    private confirmDialog: ConfirmDialogService,
    private dialog: MatDialog,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadProfile();
    this.loadMyRegularizations();
    this.loadMiniTimetable();
  }

  loadMiniTimetable(): void {
    this.coachingService.getMyTimetable().subscribe({
      next: (res) => {
        this.timetableMiniData = res;
      },
      error: () => {}
    });
  }

  loadProfile(): void {
    this.loading = true;
    this.coachingService.getMyStudentProfile360().subscribe({
      next: (res) => {
        this.data360 = res;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.confirmDialog.alert('Error', 'Could not load your student 360 profile.', 'danger');
      }
    });
  }

  loadMyRegularizations(): void {
    this.loadingRegularizations = true;
    this.http.get<StudentAttendanceRegularizationDto[]>(`${API_BASE}/api/student-regularizations`).subscribe({
      next: (list) => {
        this.myRegularizations = list || [];
        this.loadingRegularizations = false;
      },
      error: () => {
        this.myRegularizations = [];
        this.loadingRegularizations = false;
      }
    });
  }

  getCategoryLabel(cat: string): string {
    switch (cat) {
      case 'OnDuty': return '🏆 On-Duty (OD)';
      case 'Medical': return '🩺 Medical';
      case 'RollCallError': return '📋 Roll Call Error';
      case 'PunchMiss': return '⏱️ RFID Miss';
      default: return '📝 ' + cat;
    }
  }

  cancelMyRegularization(reg: StudentAttendanceRegularizationDto): void {
    if (!confirm(`Are you sure you want to cancel the regularization request for ${reg.attendanceDate}?`)) return;
    this.http.delete(`${API_BASE}/api/student-regularizations/${reg.id}`).subscribe({
      next: () => {
        this.loadMyRegularizations();
        this.confirmDialog.alert('Cancelled', 'Your regularization request has been cancelled.', 'info');
      },
      error: (err) => {
        this.confirmDialog.alert('Error', err.error?.message || 'Could not cancel request.', 'danger');
      }
    });
  }

  openRegularizationDialog(): void {
    if (!this.data360?.student) return;
    const s = this.data360.student;
    const dialogRef = this.dialog.open(ApplyStudentRegularizationDialogComponent, {
      width: '650px',
      data: {
        studentId: s.id,
        studentName: s.studentName,
        rollNumber: s.rollNumber,
        className: s.className,
        sectionName: s.sectionName
      }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.confirmDialog.alert('Request Submitted', 'Your attendance regularization request has been submitted to your Class Teacher for review.', 'info');
        this.loadMyRegularizations();
      }
    });
  }

  printCertificate(ach: StudentAchievementDto): void {
    this.activeCertificateModal = ach;
  }

  triggerPrint(): void {
    window.print();
  }

  getAchievementIcon(cat?: string): string {
    switch (cat) {
      case 'Sports': return 'sports_soccer';
      case 'Cultural': return 'palette';
      case 'Olympiad': return 'military_tech';
      case 'Leadership': return 'groups';
      case 'Academic': return 'school';
      default: return 'emoji_events';
    }
  }

  formatRating(rating?: string): string {
    if (!rating) return '🟢 Verified Interaction';
    switch (rating) {
      case 'HighlySatisfied': return '🟢 Highly Satisfied';
      case 'Satisfied': return '🔵 Satisfied';
      case 'NeedsImprovement': return '🟠 Needs Improvement';
      case 'Dissatisfied': return '🔴 Dissatisfied';
      default: return rating;
    }
  }

  getPhotoUrl(photo?: string | null): string {
    if (!photo) return '';
    if (photo.startsWith('http') || photo.startsWith('data:')) return photo;
    return `${API_BASE}${photo.startsWith('/') ? '' : '/'}${photo}`;
  }

  getInitials(name?: string): string {
    if (!name) return 'S';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }
}
