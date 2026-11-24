import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import {
  PrincipalBriefingService,
  PrincipalMorningBriefingDto,
  BriefingBirthdayItemDto,
  SendBirthdayWishRequestDto
} from '../../core/services/principal-briefing.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-principal-briefing',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatChipsModule,
    MatDividerModule
  ],
  template: `
    <div class="page-container">
      <!-- Header Deck -->
      <div class="page-header-deck no-print">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>campaign</mat-icon>
          </div>
          <div class="header-titles">
            <div class="title-row">
              <h1 class="page-title">Principal AI Morning Briefing Desk</h1>
              <span class="briefing-badge">
                <span class="live-pulse"></span>
                Daily Operational Radar
              </span>
            </div>
            <p class="page-subtitle">
              Executive morning intelligence synthesizing daily revenue velocity, student and staff attendance anomalies, unassigned substitutions, and actionable priorities.
            </p>
          </div>
        </div>

        <div class="header-action-buttons">
          <button
            class="voice-briefing-btn"
            [class.playing]="isPlayingVoice"
            (click)="toggleVoiceBriefing('Hindi')"
            [disabled]="loading"
            mat-flat-button
            color="primary">
            <mat-icon>{{ isPlayingVoice ? 'pause' : 'volume_up' }}</mat-icon>
            <span>{{ isPlayingVoice ? 'Pause Voice' : 'Play Hindi Audio Briefing' }}</span>
          </button>

          <button
            class="en-voice-btn"
            (click)="toggleVoiceBriefing('English')"
            [disabled]="loading"
            mat-stroked-button>
            <mat-icon>record_voice_over</mat-icon>
            <span>English Audio</span>
          </button>

          <button class="print-btn" (click)="printBriefing()" [disabled]="loading" mat-stroked-button>
            <mat-icon>print</mat-icon>
            <span>Print Sheet</span>
          </button>

          <button class="refresh-btn" (click)="loadBriefing()" [disabled]="loading" mat-icon-button matTooltip="Refresh Daily Briefing">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </div>

      <!-- Single Prominent Loader (Strict Rule) -->
      @if (loading) {
        <mat-progress-bar mode="indeterminate" class="page-loader"></mat-progress-bar>
      }

      <!-- AI Spoken Script Banner (Voice Playing Deck) -->
      @if (briefing) {
        <mat-card class="voice-player-deck mat-elevation-z1 no-print" [class.active-speaker]="isPlayingVoice">
          <div class="voice-deck-content">
            <div class="speaker-avatar">
              <mat-icon>{{ isPlayingVoice ? 'graphic_eq' : 'headset_mic' }}</mat-icon>
            </div>
            <div class="voice-meta">
              <div class="voice-top-line">
                <span class="speaker-name">AI Executive Briefing Assistant (Swara / Madhur)</span>
                <span class="date-chip">{{ briefing.briefingDateIstFormatted }}</span>
                @if (isPlayingVoice) {
                  <span class="speaking-indicator">
                    <span class="bar bar1"></span>
                    <span class="bar bar2"></span>
                    <span class="bar bar3"></span>
                    Speaking...
                  </span>
                }
              </div>
              <p class="voice-transcript">
                "{{ currentVoiceLang === 'Hindi' ? briefing.aiSpokenScriptHindi : briefing.aiSpokenScriptEnglish }}"
              </p>
            </div>
          </div>
        </mat-card>

        <!-- Printable Executive Briefing Document -->
        <div class="briefing-document" id="printable-briefing">
          
          <!-- Document Header for Print -->
          <div class="doc-header only-print">
            <h1 class="inst-name">{{ briefing.instituteName }}</h1>
            <p class="inst-sub">EXECUTIVE DAILY MORNING BRIEFING • {{ briefing.briefingDateIstFormatted }}</p>
            <hr />
          </div>

          <!-- Quadrant Grid -->
          <div class="quadrant-grid">

            <!-- QUADRANT 1: FINANCIAL VELOCITY -->
            <mat-card class="briefing-card finance-card mat-elevation-z1">
              <div class="card-header">
                <div class="hdr-left">
                  <div class="card-icon-box green">
                    <mat-icon>account_balance_wallet</mat-icon>
                  </div>
                  <div>
                    <h3 class="card-title">Financial Velocity</h3>
                    <span class="card-sub">Today's Collections &amp; Realized Cash</span>
                  </div>
                </div>
                <span class="kpi-pill success">{{ briefing.financials.receiptsIssuedTodayCount }} Receipts</span>
              </div>

              <div class="card-body">
                <div class="big-metric-row">
                  <span class="metric-label">Today's Collection</span>
                  <span class="metric-val green">₹{{ briefing.financials.todayCollection | number:'1.0-0' }}</span>
                </div>

                <div class="finance-breakdown-grid">
                  <div class="breakdown-item">
                    <span class="bd-label">Cash Collected:</span>
                    <strong class="bd-val">₹{{ briefing.financials.todayCash | number:'1.0-0' }}</strong>
                  </div>
                  <div class="breakdown-item">
                    <span class="bd-label">Online / UPI:</span>
                    <strong class="bd-val">₹{{ briefing.financials.todayOnlineOrUpi | number:'1.0-0' }}</strong>
                  </div>
                  <div class="breakdown-item">
                    <span class="bd-label">Cheque / Bank:</span>
                    <strong class="bd-val">₹{{ briefing.financials.todayChequeOrOther | number:'1.0-0' }}</strong>
                  </div>
                  <div class="breakdown-item">
                    <span class="bd-label">Today's Expenses:</span>
                    <strong class="bd-val expense">₹{{ briefing.financials.todayExpense | number:'1.0-0' }}</strong>
                  </div>
                </div>

                <mat-divider></mat-divider>

                <div class="mtd-row">
                  <div class="mtd-meta">
                    <span class="mtd-label">Month-to-Date Realized:</span>
                    <strong class="mtd-val">₹{{ briefing.financials.monthToDateCollection | number:'1.0-0' }}</strong>
                  </div>
                  <a routerLink="/fees" class="quick-link no-print">
                    <span>Fee Desk</span>
                    <mat-icon>chevron_right</mat-icon>
                  </a>
                </div>
              </div>
            </mat-card>

            <!-- QUADRANT 2: ATTENDANCE PULSE -->
            <mat-card class="briefing-card attendance-card mat-elevation-z1">
              <div class="card-header">
                <div class="hdr-left">
                  <div class="card-icon-box blue">
                    <mat-icon>groups</mat-icon>
                  </div>
                  <div>
                    <h3 class="card-title">Student Attendance Pulse</h3>
                    <span class="card-sub">Universal Student Roster Presence</span>
                  </div>
                </div>
                <span class="kpi-pill info" [class.danger]="briefing.attendance.attendancePercentage < 75">
                  {{ briefing.attendance.attendancePercentage }}% Attendance
                </span>
              </div>

              <div class="card-body">
                <div class="attendance-counters">
                  <div class="att-counter-box present">
                    <span class="cnt-num">{{ briefing.attendance.presentStudents }}</span>
                    <span class="cnt-label">Present</span>
                  </div>
                  <div class="att-counter-box absent">
                    <span class="cnt-num">{{ briefing.attendance.absentStudents }}</span>
                    <span class="cnt-label">Absent</span>
                  </div>
                  <div class="att-counter-box late">
                    <span class="cnt-num">{{ briefing.attendance.lateStudents }}</span>
                    <span class="cnt-label">Late / Grace</span>
                  </div>
                  <div class="att-counter-box total">
                    <span class="cnt-num">{{ briefing.attendance.totalStudents }}</span>
                    <span class="cnt-label">Total Enrolled</span>
                  </div>
                </div>

                @if (briefing.attendance.lowAttendanceAlerts.length > 0) {
                  <div class="alerts-box">
                    <div class="alert-title">
                      <mat-icon>warning</mat-icon>
                      <span>Attendance Dips Detected:</span>
                    </div>
                    <ul class="alert-list">
                      @for (alert of briefing.attendance.lowAttendanceAlerts; track alert) {
                        <li>{{ alert }}</li>
                      }
                    </ul>
                  </div>
                }

                <div class="card-footer-link no-print">
                  <a routerLink="/students/attendance" class="quick-link">
                    <span>Open Attendance Register</span>
                    <mat-icon>chevron_right</mat-icon>
                  </a>
                </div>
              </div>
            </mat-card>

            <!-- QUADRANT 3: STAFF PRESENCE & SUBSTITUTIONS -->
            <mat-card class="briefing-card staff-card mat-elevation-z1">
              <div class="card-header">
                <div class="hdr-left">
                  <div class="card-icon-box purple">
                    <mat-icon>badge</mat-icon>
                  </div>
                  <div>
                    <h3 class="card-title">Staff Presence &amp; Leaves</h3>
                    <span class="card-sub">Faculty Availability &amp; Class Coverage</span>
                  </div>
                </div>
                <span class="kpi-pill" [class.warning]="briefing.staff.absentStaff > 0">
                  {{ briefing.staff.presentStaff }} of {{ briefing.staff.totalStaff }} Present
                </span>
              </div>

              <div class="card-body">
                @if (briefing.staff.absentTeachers.length === 0) {
                  <div class="clean-status-box">
                    <mat-icon class="ok-icon">verified</mat-icon>
                    <strong>100% Faculty Present Today</strong>
                    <p>No teachers are on leave or absent today. All periods have assigned teachers.</p>
                  </div>
                } @else {
                  <div class="absent-staff-list">
                    <div class="list-title">Teachers on Approved Leave / Absent:</div>
                    @for (t of briefing.staff.absentTeachers; track t.teacherId) {
                      <div class="absent-item">
                        <div class="t-info">
                          <span class="t-name">{{ t.teacherName }}</span>
                          <span class="t-desig">({{ t.designation }})</span>
                        </div>
                        <div class="t-leave-tag">
                          <span>{{ t.leaveTypeOrStatus }}</span>
                          <span class="periods-impact">{{ t.affectedPeriodsCount }} periods affected</span>
                        </div>
                      </div>
                    }
                  </div>
                }

                <div class="card-footer-link no-print">
                  <a routerLink="/teachers/substitution" class="quick-link">
                    <span>Manage Teacher Substitutions</span>
                    <mat-icon>chevron_right</mat-icon>
                  </a>
                </div>
              </div>
            </mat-card>

            <!-- QUADRANT 4: ACTION PRIORITIES & CELEBRATIONS -->
            <mat-card class="briefing-card action-card mat-elevation-z1">
              <div class="card-header">
                <div class="hdr-left">
                  <div class="card-icon-box amber">
                    <mat-icon>notifications_active</mat-icon>
                  </div>
                  <div>
                    <h3 class="card-title">Action Priorities &amp; Birthdays</h3>
                    <span class="card-sub">Pending Approvals &amp; Celebrations</span>
                  </div>
                </div>
                <span class="kpi-pill amber">{{ briefing.actionItems.length }} Priorities</span>
              </div>

              <div class="card-body">
                <!-- Action Priorities -->
                @if (briefing.actionItems.length > 0) {
                  <div class="action-items-list">
                    @for (act of briefing.actionItems; track act.title) {
                      <div class="action-item-row" [ngClass]="act.severity.toLowerCase()">
                        <div class="act-main">
                          <span class="act-title">{{ act.title }}</span>
                          <span class="act-desc">{{ act.description }}</span>
                        </div>
                        <a [routerLink]="act.actionUrl" class="act-btn no-print" mat-button>
                          <span>Review</span>
                          <mat-icon>open_in_new</mat-icon>
                        </a>
                      </div>
                    }
                  </div>
                }

                <!-- Today's Birthdays -->
                @if (briefing.birthdaysToday.length > 0) {
                  <div class="birthdays-section">
                    <div class="bday-hdr">
                      <mat-icon>cake</mat-icon>
                      <strong>Today's Birthdays ({{ briefing.birthdaysToday.length }})</strong>
                    </div>
                    <div class="bday-list">
                      @for (b of briefing.birthdaysToday; track b.id) {
                        <div class="bday-item">
                          <div class="bday-avatar">
                            <mat-icon>{{ b.role === 'Student' ? 'school' : 'person' }}</mat-icon>
                          </div>
                          <div class="bday-meta">
                            <span class="bday-name">{{ b.name }}</span>
                            <span class="bday-sub">{{ b.role }}: {{ b.classOrDesignation }}</span>
                          </div>
                          @if (b.phone) {
                            <button
                              class="bday-wa-btn no-print"
                              (click)="sendBirthdayWish(b)"
                              matTooltip="Send WhatsApp Birthday Greeting"
                              mat-icon-button>
                              <mat-icon>chat</mat-icon>
                            </button>
                          }
                        </div>
                      }
                    </div>
                  </div>
                } @else {
                  <div class="no-bday-note">
                    <mat-icon>celebration</mat-icon>
                    <span>No student or staff birthdays scheduled today.</span>
                  </div>
                }

              </div>
            </mat-card>

          </div>
        </div>
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

    /* Page Header */
    .page-header-deck {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;

      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;

        .header-icon-box {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 6px 12px -2px rgba(2, 132, 199, 0.3);

          mat-icon { font-size: 28px; width: 28px; height: 28px; }
        }

        .header-titles {
          .title-row {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;

            .page-title {
              margin: 0;
              font-size: 1.35rem;
              font-weight: 700;
              color: #0f172a;
              letter-spacing: -0.02em;
            }

            .briefing-badge {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 3px 10px;
              background: #f0f9ff;
              border: 1px solid #bae6fd;
              border-radius: 14px;
              font-size: 0.72rem;
              font-weight: 700;
              color: #0284c7;

              .live-pulse {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #0284c7;
                box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.2);
              }
            }
          }

          .page-subtitle {
            margin: 4px 0 0;
            font-size: 0.82rem;
            color: #64748b;
            max-width: 900px;
            line-height: 1.4;
          }
        }
      }

      .header-action-buttons {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;

        .voice-briefing-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 700;
          border-radius: 8px;
          background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);

          &.playing {
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          }
        }

        .en-voice-btn, .print-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          border-radius: 8px;
          color: #334155;
        }
      }
    }

    .page-loader {
      border-radius: 4px;
    }

    /* Voice Player Banner */
    .voice-player-deck {
      border-radius: 12px;
      padding: 16px 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      transition: all 0.2s ease;

      &.active-speaker {
        background: #f0fdf4;
        border-color: #86efac;
        box-shadow: 0 8px 20px -4px rgba(22, 163, 74, 0.15);
      }

      .voice-deck-content {
        display: flex;
        align-items: flex-start;
        gap: 16px;

        .speaker-avatar {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          mat-icon { font-size: 24px; width: 24px; height: 24px; }
        }

        .voice-meta {
          flex: 1 1 auto;

          .voice-top-line {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 6px;

            .speaker-name {
              font-weight: 700;
              font-size: 0.88rem;
              color: #1e293b;
            }

            .date-chip {
              font-size: 0.72rem;
              font-weight: 600;
              padding: 2px 8px;
              border-radius: 10px;
              background: #f1f5f9;
              color: #475569;
            }

            .speaking-indicator {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              font-size: 0.75rem;
              font-weight: 700;
              color: #16a34a;

              .bar {
                width: 3px;
                background: #16a34a;
                border-radius: 2px;
                animation: soundWave 0.8s infinite ease-in-out alternate;
              }
              .bar1 { height: 10px; animation-delay: 0.1s; }
              .bar2 { height: 14px; animation-delay: 0.3s; }
              .bar3 { height: 8px; animation-delay: 0.2s; }
            }
          }

          .voice-transcript {
            margin: 0;
            font-size: 0.84rem;
            color: #475569;
            line-height: 1.5;
            font-style: italic;
          }
        }
      }
    }

    @keyframes soundWave {
      0% { transform: scaleY(0.4); }
      100% { transform: scaleY(1); }
    }

    /* Quadrant Grid */
    .quadrant-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;

      @media (max-width: 960px) {
        grid-template-columns: 1fr;
      }
    }

    .briefing-card {
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;

        .hdr-left {
          display: flex;
          align-items: center;
          gap: 12px;

          .card-icon-box {
            width: 42px;
            height: 42px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            mat-icon { font-size: 22px; width: 22px; height: 22px; }

            &.green { background: #dcfce7; color: #166534; }
            &.blue { background: #dbeafe; color: #1e40af; }
            &.purple { background: #f3e8ff; color: #7e22ce; }
            &.amber { background: #fef3c7; color: #92400e; }
          }

          .card-title {
            margin: 0;
            font-size: 1.05rem;
            font-weight: 700;
            color: #1e293b;
          }

          .card-sub {
            font-size: 0.74rem;
            color: #64748b;
          }
        }

        .kpi-pill {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          background: #f1f5f9;
          color: #475569;

          &.success { background: #dcfce7; color: #166534; }
          &.info { background: #dbeafe; color: #1e40af; }
          &.warning { background: #fef3c7; color: #92400e; }
          &.danger { background: #fee2e2; color: #991b1b; }
          &.amber { background: #fff7ed; color: #c2410c; }
        }
      }

      .card-body {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
    }

    /* Financial Card Styles */
    .big-metric-row {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .metric-label {
        font-size: 0.74rem;
        font-weight: 600;
        text-transform: uppercase;
        color: #64748b;
      }

      .metric-val {
        font-size: 1.8rem;
        font-weight: 800;
        color: #0f172a;

        &.green { color: #16a34a; }
      }
    }

    .finance-breakdown-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;

      .breakdown-item {
        background: #f8fafc;
        border-radius: 8px;
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 2px;

        .bd-label { font-size: 0.72rem; color: #64748b; }
        .bd-val { font-size: 0.95rem; color: #1e293b; }
        .expense { color: #dc2626; }
      }
    }

    .mtd-row {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .mtd-meta {
        font-size: 0.82rem;
        color: #475569;
        strong { color: #0f172a; margin-left: 4px; }
      }
    }

    /* Attendance Counters */
    .attendance-counters {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;

      .att-counter-box {
        border-radius: 8px;
        padding: 10px 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;

        .cnt-num { font-size: 1.3rem; font-weight: 800; line-height: 1.2; }
        .cnt-label { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; margin-top: 2px; }

        &.present { background: #f0fdf4; color: #166534; }
        &.absent { background: #fef2f2; color: #991b1b; }
        &.late { background: #fffbeb; color: #92400e; }
        &.total { background: #f8fafc; color: #334155; }
      }
    }

    .alerts-box {
      background: #fff1f2;
      border: 1px solid #fecdd3;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 0.78rem;

      .alert-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
        color: #9f1239;
        margin-bottom: 4px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; color: #e11d48; }
      }

      .alert-list {
        margin: 0;
        padding-left: 20px;
        color: #881337;
        li { margin-bottom: 2px; }
      }
    }

    /* Staff Card */
    .clean-status-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      color: #166534;

      .ok-icon { font-size: 28px; width: 28px; height: 28px; }
      p { margin: 0; font-size: 0.78rem; color: #15803d; }
    }

    .absent-staff-list {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .list-title { font-size: 0.76rem; font-weight: 600; color: #64748b; }

      .absent-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 0.8rem;

        .t-info {
          display: flex;
          align-items: center;
          gap: 6px;
          .t-name { font-weight: 700; color: #1e293b; }
          .t-desig { color: #64748b; font-size: 0.74rem; }
        }

        .t-leave-tag {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #dc2626;
          font-weight: 600;
          font-size: 0.74rem;

          .periods-impact {
            background: #fee2e2;
            padding: 1px 6px;
            border-radius: 4px;
          }
        }
      }
    }

    /* Action Items */
    .action-items-list {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .action-item-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 0.8rem;

        &.critical { background: #fef2f2; border: 1px solid #fecdd3; .act-title { color: #991b1b; } }
        &.warning { background: #fffbeb; border: 1px solid #fef3c7; .act-title { color: #92400e; } }
        &.info { background: #f0f9ff; border: 1px solid #bae6fd; .act-title { color: #0369a1; } }

        .act-main {
          display: flex;
          flex-direction: column;
          gap: 2px;
          .act-title { font-weight: 700; }
          .act-desc { font-size: 0.74rem; color: #64748b; }
        }

        .act-btn {
          font-size: 0.72rem;
          font-weight: 600;
          mat-icon { font-size: 14px; width: 14px; height: 14px; margin-left: 2px; }
        }
      }
    }

    /* Birthdays */
    .birthdays-section {
      background: #faf5ff;
      border: 1px solid #e9d5ff;
      border-radius: 8px;
      padding: 10px 14px;

      .bday-hdr {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #7e22ce;
        font-size: 0.82rem;
        margin-bottom: 8px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }

      .bday-list {
        display: flex;
        flex-direction: column;
        gap: 6px;

        .bday-item {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #ffffff;
          padding: 6px 10px;
          border-radius: 6px;

          .bday-avatar {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: #f3e8ff;
            color: #7e22ce;
            display: flex;
            align-items: center;
            justify-content: center;
            mat-icon { font-size: 16px; width: 16px; height: 16px; }
          }

          .bday-meta {
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
            .bday-name { font-size: 0.8rem; font-weight: 700; color: #1e293b; }
            .bday-sub { font-size: 0.7rem; color: #64748b; }
          }

          .bday-wa-btn {
            color: #16a34a;
            mat-icon { font-size: 18px; width: 18px; height: 18px; }
          }
        }
      }
    }

    .no-bday-note {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.76rem;
      color: #94a3b8;
      padding: 4px 0;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    .quick-link {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 0.78rem;
      font-weight: 600;
      color: #2563eb;
      text-decoration: none;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { text-decoration: underline; }
    }

    .card-footer-link {
      display: flex;
      justify-content: flex-end;
      padding-top: 4px;
    }

    /* Print only headers */
    .only-print { display: none; }

    @media print {
      .no-print { display: none !important; }
      .only-print { display: block !important; }

      .page-container { padding: 0 !important; }
      .quadrant-grid { grid-template-columns: 1fr 1fr !important; gap: 14px !important; }
      .briefing-card { border: 1px solid #cbd5e1 !important; box-shadow: none !important; padding: 14px !important; }

      .doc-header {
        text-align: center;
        margin-bottom: 20px;
        .inst-name { margin: 0; font-size: 1.4rem; font-weight: 900; }
        .inst-sub { margin: 4px 0 0; font-size: 0.8rem; font-weight: 700; }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrincipalBriefingComponent implements OnInit, OnDestroy {
  private briefingService = inject(PrincipalBriefingService);
  private authService = inject(AuthService);
  private confirmDialog = inject(ConfirmDialogService);
  private cdr = inject(ChangeDetectorRef);

  loading = true;
  briefing: PrincipalMorningBriefingDto | null = null;

  isPlayingVoice = false;
  currentVoiceLang: 'Hindi' | 'English' = 'Hindi';
  private speechUtterance: SpeechSynthesisUtterance | null = null;

  ngOnInit(): void {
    this.loadBriefing();
  }

  ngOnDestroy(): void {
    this.stopVoice();
  }

  loadBriefing(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const activeBranchId = this.authService.selectedBranchId();

    this.briefingService.getTodayBriefing(activeBranchId).subscribe({
      next: (data) => {
        this.briefing = data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.cdr.markForCheck();
        this.confirmDialog.alert('Briefing Error', err?.error?.message || err?.message || 'Failed to aggregate daily briefing.', 'danger');
      }
    });
  }

  toggleVoiceBriefing(lang: 'Hindi' | 'English'): void {
    if (this.isPlayingVoice && this.currentVoiceLang === lang) {
      this.stopVoice();
      return;
    }

    this.stopVoice();
    this.currentVoiceLang = lang;

    if (!('speechSynthesis' in window)) {
      this.confirmDialog.alert('Audio Unsupported', 'Speech synthesis is not supported on this browser device.', 'warning');
      return;
    }

    const script = lang === 'Hindi'
      ? (this.briefing?.aiSpokenScriptHindi || '')
      : (this.briefing?.aiSpokenScriptEnglish || '');

    if (!script) return;

    this.speechUtterance = new SpeechSynthesisUtterance(script);
    this.speechUtterance.lang = lang === 'Hindi' ? 'hi-IN' : 'en-IN';
    this.speechUtterance.rate = 0.95;
    this.speechUtterance.pitch = 1.0;

    // Try finding natural voice
    const voices = window.speechSynthesis.getVoices();
    if (lang === 'Hindi') {
      const hiVoice = voices.find(v => v.lang.includes('hi') || v.name.includes('Hindi') || v.name.includes('Swara') || v.name.includes('Madhur'));
      if (hiVoice) this.speechUtterance.voice = hiVoice;
    } else {
      const enVoice = voices.find(v => v.lang.includes('en-IN') || v.name.includes('India'));
      if (enVoice) this.speechUtterance.voice = enVoice;
    }

    this.speechUtterance.onstart = () => {
      this.isPlayingVoice = true;
      this.cdr.markForCheck();
    };

    this.speechUtterance.onend = () => {
      this.isPlayingVoice = false;
      this.cdr.markForCheck();
    };

    this.speechUtterance.onerror = () => {
      this.isPlayingVoice = false;
      this.cdr.markForCheck();
    };

    window.speechSynthesis.speak(this.speechUtterance);
  }

  stopVoice(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isPlayingVoice = false;
    this.cdr.markForCheck();
  }

  sendBirthdayWish(item: BriefingBirthdayItemDto): void {
    if (!item.phone) {
      this.confirmDialog.alert('No Phone', 'No contact phone number is available for this recipient.', 'warning');
      return;
    }

    this.confirmDialog.confirm(
      'Send Birthday Greetings',
      `Dispatch WhatsApp birthday wishes to ${item.name} (${item.phone})?`,
      'Send WhatsApp',
      'Cancel',
      'info'
    ).subscribe((confirmed) => {
      if (!confirmed) return;

      this.briefingService.sendBirthdayWish({
        recipientId: item.id,
        recipientName: item.name,
        phone: item.phone!,
        role: item.role
      }).subscribe({
        next: (res) => {
          // Open direct WhatsApp web link
          const cleanedPhone = item.phone!.replace(/\D/g, '');
          const waUrl = `https://wa.me/91${cleanedPhone.startsWith('91') ? cleanedPhone.slice(2) : cleanedPhone}?text=${encodeURIComponent(res.message)}`;
          window.open(waUrl, '_blank');

          this.confirmDialog.alert('Birthday Greeting Sent', `Birthday wish logged and WhatsApp window opened for ${item.name}.`, 'success');
        },
        error: (err) => {
          this.confirmDialog.alert('Dispatch Error', err?.error?.message || err?.message || 'Failed to send wish.', 'danger');
        }
      });
    });
  }

  printBriefing(): void {
    window.print();
  }
}
