import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { API_BASE, TeacherDto, BatchDto, TeacherSubstitutionDto, CreateTeacherSubstitutionDto } from './teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-teacher-substitution',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatChipsModule, MatProgressBarModule, MatTooltipModule
  ],
  template: `
<div class="page-container">
  <!-- Page Header -->
  <div class="page-header">
    <div class="header-left">
      <div class="header-icon-box">
        <mat-icon>swap_horiz</mat-icon>
      </div>
      <div>
        <h1 class="page-title">Proxy &amp; Teacher Substitution</h1>
        <p class="page-subtitle">शिक्षक प्रतिस्थापन रजिस्टर — अनुपस्थित शिक्षक के स्थान पर प्रॉक्सी क्लास असाइन करें।</p>
      </div>
    </div>
    <div class="header-actions">
      <a mat-stroked-button routerLink="/teachers" class="back-btn">
        <mat-icon>arrow_back</mat-icon> Teachers
      </a>
      <button mat-raised-button color="primary" class="primary-btn" (click)="openCreateModal()">
        <mat-icon>add_task</mat-icon> Assign Proxy Teacher
      </button>
    </div>
  </div>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <!-- Metrics / Counter Cards -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-icon assigned-icon"><mat-icon>schedule</mat-icon></div>
      <div class="stat-info">
        <div class="stat-value">{{getPendingCount()}}</div>
        <div class="stat-label">Active / Assigned Today</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon completed-icon"><mat-icon>check_circle</mat-icon></div>
      <div class="stat-info">
        <div class="stat-value">{{getCompletedCount()}}</div>
        <div class="stat-label">Completed Classes</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon total-icon"><mat-icon>history_edu</mat-icon></div>
      <div class="stat-info">
        <div class="stat-value">{{substitutions.length}}</div>
        <div class="stat-label">Total Recorded Substitutions</div>
      </div>
    </div>
  </div>

  <!-- Filters & Search Bar -->
  <mat-card class="filter-card mat-elevation-z1">
    <div class="filter-row">
      <mat-form-field appearance="outline" class="filter-item">
        <mat-label>Date Filter</mat-label>
        <input matInput type="date" [(ngModel)]="selectedDate" (ngModelChange)="loadSubstitutions()">
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-item">
        <mat-label>Status Filter</mat-label>
        <mat-select [(ngModel)]="selectedStatus" (selectionChange)="loadSubstitutions()">
          <mat-option value="">All Statuses</mat-option>
          <mat-option value="Assigned">Assigned / Active</mat-option>
          <mat-option value="Completed">Completed</mat-option>
          <mat-option value="Cancelled">Cancelled</mat-option>
        </mat-select>
      </mat-form-field>

      <button mat-button color="primary" (click)="resetFilters()">
        <mat-icon>refresh</mat-icon> Reset Today
      </button>
    </div>
  </mat-card>

  <!-- Substitutions List Grid -->
  <div class="sub-grid" *ngIf="!loading && substitutions.length > 0">
    <mat-card class="sub-card mat-elevation-z2" *ngFor="let s of substitutions">
      <div class="sub-card-header">
        <div class="time-badge">
          <mat-icon>access_time</mat-icon>
          <span>{{s.timeSlot}}</span>
        </div>
        <span class="status-chip" [ngClass]="'status-' + s.status.toLowerCase()">
          {{s.status}}
        </span>
      </div>

      <div class="sub-teachers-flow">
        <!-- Original Teacher (Absent) -->
        <div class="teacher-block absent-block">
          <div class="role-tag tag-absent">अनुपस्थित (Absent)</div>
          <div class="teacher-name-row">
            <mat-icon class="flow-avatar">person_off</mat-icon>
            <div>
              <div class="t-name">{{s.originalTeacherName}}</div>
              <div class="t-code">{{s.originalTeacherCode}}</div>
            </div>
          </div>
        </div>

        <div class="flow-arrow">
          <mat-icon>arrow_forward</mat-icon>
          <span class="sub-tag">Substituted By</span>
        </div>

        <!-- Proxy Teacher -->
        <div class="teacher-block proxy-block">
          <div class="role-tag tag-proxy">प्रॉक्सी (Substitute)</div>
          <div class="teacher-name-row">
            <mat-icon class="flow-avatar proxy-avatar">school</mat-icon>
            <div>
              <div class="t-name">{{s.substituteTeacherName}}</div>
              <div class="t-code">{{s.substituteTeacherCode}}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="sub-details">
        <div class="detail-pill" *ngIf="s.classSectionName">
          <mat-icon>meeting_room</mat-icon> Class: <strong>{{s.classSectionName}}</strong>
        </div>
        <div class="detail-pill" *ngIf="s.batchName">
          <mat-icon>class</mat-icon> Batch: <strong>{{s.batchName}}</strong>
        </div>
        <div class="detail-pill" *ngIf="s.subjectName">
          <mat-icon>menu_book</mat-icon> Subject: <strong>{{s.subjectName}}</strong>
        </div>
        <div class="detail-pill" *ngIf="s.roomNumber">
          <mat-icon>room</mat-icon> Room: <strong>{{s.roomNumber}}</strong>
        </div>
        <div class="detail-pill" *ngIf="s.proxyAllowance > 0">
          <mat-icon>payments</mat-icon> Proxy Allowance: <strong>₹{{s.proxyAllowance}}</strong>
        </div>
      </div>

      <div class="topic-box" *ngIf="s.topicToCover">
        <div class="topic-label"><mat-icon>assignment</mat-icon> Topic / Lesson Instructions:</div>
        <div class="topic-content">{{s.topicToCover}}</div>
      </div>

      <div class="reason-text" *ngIf="s.reason">
        <em>Absence Reason: {{s.reason}}</em>
      </div>

      <div class="sub-footer">
        <span class="date-text"><mat-icon>calendar_today</mat-icon> {{s.substitutionDate | date:'dd MMM yyyy'}}</span>
        <div class="action-btns">
          <button mat-stroked-button color="primary" size="small" *ngIf="s.status === 'Assigned'" (click)="updateStatus(s, 'Completed')">
            <mat-icon>check_circle</mat-icon> Done
          </button>
          <button mat-icon-button color="warn" matTooltip="Cancel Proxy" *ngIf="s.status === 'Assigned'" (click)="updateStatus(s, 'Cancelled')">
            <mat-icon>cancel</mat-icon>
          </button>
          <button mat-icon-button color="warn" matTooltip="Delete Record" (click)="deleteSubstitution(s.id)">
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      </div>
    </mat-card>
  </div>

  <!-- Empty State -->
  <mat-card class="empty-card mat-elevation-z1" *ngIf="!loading && substitutions.length === 0">
    <mat-icon class="empty-icon">event_available</mat-icon>
    <h3>No Substitutions for this Date</h3>
    <p>No proxy teacher substitutions recorded for the selected date. Click below to assign a substitute teacher.</p>
    <button mat-stroked-button color="primary" (click)="openCreateModal()">
      <mat-icon>add_task</mat-icon> Assign Proxy Now
    </button>
  </mat-card>
</div>

<!-- ============================================================== -->
<!-- MODAL: ASSIGN PROXY TEACHER (Strict Light-Blue Gradient Header) -->
<!-- ============================================================== -->
<div class="modal-backdrop" *ngIf="showCreateModal" (click)="closeCreateModal()">
  <div class="modal-container" (click)="$event.stopPropagation()">
    <!-- Header adhering strictly to AGENTS.md rule -->
    <div class="modal-header">
      <div class="header-left-box">
        <div class="header-icon">
          <mat-icon>swap_horiz</mat-icon>
        </div>
        <div>
          <h2 class="modal-title">Assign Proxy / Substitute Teacher</h2>
          <p class="modal-subtitle">शिक्षक प्रतिस्थापन — अनुपस्थित क्लास के लिए प्रॉक्सी असाइन करें।</p>
        </div>
      </div>
      <button mat-icon-button (click)="closeCreateModal()" class="close-btn">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div class="modal-body">
      <div class="form-grid">
        <!-- Date -->
        <mat-form-field appearance="outline" class="col-full">
          <mat-label>Substitution Date *</mat-label>
          <input matInput type="date" [(ngModel)]="newForm.substitutionDate">
        </mat-form-field>

        <!-- Absent Regular Teacher -->
        <mat-form-field appearance="outline" class="col-half">
          <mat-label>Absent Teacher (अनुपस्थित) *</mat-label>
          <mat-select [(ngModel)]="newForm.originalTeacherId" (selectionChange)="onOriginalTeacherChange()">
            <mat-option *ngFor="let t of teachers" [value]="t.id">
              {{t.fullName}} ({{t.employeeCode}}) — {{t.specialization || 'Faculty'}}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Substitute Proxy Teacher -->
        <mat-form-field appearance="outline" class="col-half">
          <mat-label>Substitute Teacher (प्रॉक्सी) *</mat-label>
          <mat-select [(ngModel)]="newForm.substituteTeacherId">
            <mat-option *ngFor="let t of getAvailableSubstituteTeachers()" [value]="t.id">
              {{t.fullName}} ({{t.employeeCode}}) — {{t.specialization || 'Faculty'}}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Stream Type Selector: School vs Coaching -->
        <div class="col-full target-toggle-box">
          <label class="toggle-label">क्लास या बैच चुनें (Class or Batch Stream):</label>
          <div class="toggle-pills">
            <button type="button" class="pill-btn" [class.active]="streamType === 'School'" (click)="setStreamType('School')">
              <mat-icon>school</mat-icon> School Class &amp; Section
            </button>
            <button type="button" class="pill-btn" [class.active]="streamType === 'Coaching'" (click)="setStreamType('Coaching')">
              <mat-icon>class</mat-icon> Coaching Batch
            </button>
          </div>
        </div>

        <!-- If School Class Stream -->
        <ng-container *ngIf="streamType === 'School'">
          <mat-form-field appearance="outline" class="col-half">
            <mat-label>School Class (कक्षा)</mat-label>
            <mat-select [(ngModel)]="selectedClassId" (selectionChange)="onSchoolClassChange()">
              <mat-option [value]="''">-- Select School Class --</mat-option>
              <mat-option *ngFor="let c of schoolClasses" [value]="c.id">
                {{c.name}}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="col-half">
            <mat-label>Section (सेक्शन)</mat-label>
            <mat-select [(ngModel)]="newForm.classSectionId" (selectionChange)="onSchoolSectionChange()" [disabled]="!selectedClassId">
              <mat-option [value]="undefined">-- Select Section --</mat-option>
              <mat-option *ngFor="let sec of availableSections" [value]="sec.id">
                Section {{sec.name}} {{ sec.roomNumber ? '(' + sec.roomNumber + ')' : '' }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </ng-container>

        <!-- If Coaching Batch Stream -->
        <ng-container *ngIf="streamType === 'Coaching'">
          <mat-form-field appearance="outline" class="col-full">
            <mat-label>Coaching Batch</mat-label>
            <mat-select [(ngModel)]="newForm.batchId">
              <mat-option [value]="undefined">-- Select Coaching Batch --</mat-option>
              <mat-option *ngFor="let b of batches" [value]="b.id">{{b.name}}</mat-option>
            </mat-select>
          </mat-form-field>
        </ng-container>

        <!-- Time Slot / Period -->
        <mat-form-field appearance="outline" class="col-half">
          <mat-label>Period / Time Slot *</mat-label>
          <input matInput [(ngModel)]="newForm.timeSlot" placeholder="e.g. Period 1 (08:30 AM - 09:15 AM)">
        </mat-form-field>

        <!-- Room Number bound to DB -->
        <mat-form-field appearance="outline" class="col-half">
          <mat-label>Room Number (कमरा)</mat-label>
          <mat-select [(ngModel)]="newForm.roomNumber">
            <mat-option [value]="''">-- No Room / Default --</mat-option>
            <mat-option *ngFor="let rm of rooms" [value]="rm.roomNumber">
              {{rm.roomNumber}} {{ rm.floor ? '(Floor: ' + rm.floor + ')' : '' }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Subject bound to DB -->
        <mat-form-field appearance="outline" class="col-half">
          <mat-label>Subject Name (विषय) *</mat-label>
          <mat-select [(ngModel)]="newForm.subjectId" (selectionChange)="onSubjectSelect($event.value)">
            <mat-option [value]="undefined">-- Select Subject --</mat-option>
            <mat-option *ngFor="let sub of subjects" [value]="sub.id">
              {{sub.name}} {{ sub.code ? '(' + sub.code + ')' : '' }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Absence Reason -->
        <mat-form-field appearance="outline" class="col-half">
          <mat-label>Reason for Absence</mat-label>
          <mat-select [(ngModel)]="newForm.reason">
            <mat-option value="Casual Leave (CL)">Casual Leave (CL)</mat-option>
            <mat-option value="Sick / Medical Leave">Sick / Medical Leave</mat-option>
            <mat-option value="Official Duty / Training">Official Duty / Training</mat-option>
            <mat-option value="Personal Emergency">Personal Emergency</mat-option>
            <mat-option value="Late / Delayed">Late / Delayed</mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Proxy Allowance -->
        <mat-form-field appearance="outline" class="col-full">
          <mat-label>Proxy Allowance (₹)</mat-label>
          <input matInput type="number" [(ngModel)]="newForm.proxyAllowance" placeholder="0">
        </mat-form-field>

        <!-- Topic to Cover -->
        <mat-form-field appearance="outline" class="col-full">
          <mat-label>Topic to Cover / Teacher Instructions</mat-label>
          <textarea matInput rows="2" [(ngModel)]="newForm.topicToCover" placeholder="e.g. Chapter 4 Quadratic Equations Exercise 4.2 practice and notebook checking"></textarea>
        </mat-form-field>
      </div>
    </div>

    <div class="modal-footer">
      <button mat-button (click)="closeCreateModal()">Cancel</button>
      <button mat-raised-button color="primary" class="primary-btn" [disabled]="saving || !newForm.originalTeacherId || !newForm.substituteTeacherId || !newForm.timeSlot" (click)="saveSubstitution()">
        <mat-icon *ngIf="!saving">check</mat-icon>
        <span>{{saving ? 'Saving...' : 'Confirm &amp; Assign Proxy'}}</span>
      </button>
    </div>
  </div>
</div>
  `,
  styles: [`
    .page-container {
      padding: 24px;
      max-width: 1300px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      gap: 16px;
      flex-wrap: wrap;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .header-icon-box {
      width: 48px;
      height: 48px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
    }

    .page-title {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: #1e3a8a;
    }

    .page-subtitle {
      margin: 4px 0 0;
      font-size: 13px;
      color: #64748b;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      border: 1px solid #e2e8f0;
    }

    .stat-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .assigned-icon { background: #eff6ff; color: #2563eb; }
    .completed-icon { background: #f0fdf4; color: #16a34a; }
    .total-icon { background: #f8fafc; color: #475569; }

    .stat-value {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
    }

    .stat-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }

    .filter-card {
      padding: 14px 20px;
      margin-bottom: 20px;
      border-radius: 12px;
      background: #ffffff;
    }

    .filter-row {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .filter-item {
      width: 200px;
    }

    .sub-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 18px;
    }

    .sub-card {
      padding: 18px;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .sub-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .time-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
      color: #1e3a8a;
      background: #eff6ff;
      padding: 4px 10px;
      border-radius: 6px;
    }

    .time-badge mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .status-chip {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      text-transform: uppercase;
    }

    .status-assigned { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
    .status-completed { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
    .status-cancelled { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }

    .sub-teachers-flow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8fafc;
      padding: 12px;
      border-radius: 10px;
      gap: 8px;
    }

    .teacher-block {
      flex: 1;
    }

    .role-tag {
      font-size: 10px;
      font-weight: 700;
      margin-bottom: 4px;
      text-transform: uppercase;
    }

    .tag-absent { color: #dc2626; }
    .tag-proxy { color: #16a34a; }

    .teacher-name-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .flow-avatar {
      color: #dc2626;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .proxy-avatar {
      color: #16a34a;
    }

    .t-name {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
    }

    .t-code {
      font-size: 11px;
      color: #64748b;
    }

    .flow-arrow {
      display: flex;
      flex-direction: column;
      align-items: center;
      color: #94a3b8;
    }

    .flow-arrow mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .sub-tag {
      font-size: 9px;
      font-weight: 600;
      white-space: nowrap;
    }

    .sub-details {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .detail-pill {
      font-size: 11px;
      color: #475569;
      background: #f1f5f9;
      padding: 4px 8px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .detail-pill mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: #64748b;
    }

    .topic-box {
      background: #fffbeb;
      border-left: 3px solid #f59e0b;
      padding: 8px 10px;
      border-radius: 4px;
      font-size: 12px;
    }

    .topic-label {
      font-weight: 700;
      color: #92400e;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 2px;
    }

    .topic-label mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .topic-content {
      color: #78350f;
    }

    .reason-text {
      font-size: 11px;
      color: #64748b;
    }

    .sub-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 8px;
      border-top: 1px solid #f1f5f9;
      margin-top: auto;
    }

    .date-text {
      font-size: 12px;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .date-text mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .action-btns {
      display: flex;
      gap: 4px;
    }

    .empty-card {
      text-align: center;
      padding: 48px;
      border-radius: 12px;
    }

    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #94a3b8;
      margin-bottom: 12px;
    }

    /* ========================================================= */
    /* MODAL STYLES (Strict Light-Blue Gradient Header Compliance */
    /* ========================================================= */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .modal-container {
      background: #ffffff;
      border-radius: 16px;
      width: 100%;
      max-width: 680px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      overflow: hidden;
      animation: modalFadeIn 0.2s ease-out;
    }

    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }

    .modal-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-left-box {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon {
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }

    .modal-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #1e3a8a;
    }

    .modal-subtitle {
      margin: 2px 0 0;
      font-size: 12px;
      color: #3b82f6;
    }

    .close-btn {
      color: #64748b;
    }

    .close-btn:hover {
      color: #1e293b;
    }

    .modal-body {
      padding: 20px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .col-full {
      grid-column: span 2;
    }

    .target-toggle-box {
      margin-bottom: 2px;
    }
    .toggle-label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      color: #475569;
      margin-bottom: 6px;
    }
    .toggle-pills {
      display: flex;
      gap: 10px;
    }
    .pill-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 16px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      color: #475569;
      font-size: 0.84rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; }
      &:hover { background: #f8fafc; border-color: #94a3b8; }
      &.active {
        background: #eff6ff;
        border-color: #2563eb;
        color: #1e40af;
        mat-icon { color: #2563eb; }
      }
    }

    .modal-footer {
      padding: 14px 20px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
  `]
})
export class TeacherSubstitutionComponent implements OnInit {
  substitutions: TeacherSubstitutionDto[] = [];
  teachers: TeacherDto[] = [];
  batches: BatchDto[] = [];
  schoolClasses: any[] = [];
  subjects: any[] = [];
  rooms: any[] = [];

  streamType: 'School' | 'Coaching' = 'School';
  selectedClassId: string = '';
  availableSections: any[] = [];

  loading = false;
  saving = false;

  selectedDate: string = new Date().toISOString().substring(0, 10);
  selectedStatus: string = '';

  showCreateModal = false;
  newForm: CreateTeacherSubstitutionDto = {
    substitutionDate: new Date().toISOString().substring(0, 10),
    originalTeacherId: '',
    substituteTeacherId: '',
    timeSlot: 'Period 1 (08:30 AM - 09:15 AM)',
    proxyAllowance: 0,
    reason: 'Casual Leave (CL)',
    roomNumber: '',
    subjectName: ''
  };

  constructor(
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    this.loadTeachers();
    this.loadBatches();
    this.loadSchoolClasses();
    this.loadSubjects();
    this.loadRooms();
    this.loadSubstitutions();
  }

  loadTeachers() {
    this.http.get<TeacherDto[]>(`${API_BASE}/teachers`).subscribe({
      next: res => this.teachers = res.filter(t => t.isActive),
      error: () => {}
    });
  }

  loadBatches() {
    this.http.get<BatchDto[]>(`${API_BASE}/batches`).subscribe({
      next: res => this.batches = res,
      error: () => {}
    });
  }

  loadSchoolClasses() {
    this.http.get<any[]>(`${API_BASE}/school/classes?activeOnly=true`).subscribe({
      next: res => this.schoolClasses = res || [],
      error: () => this.schoolClasses = []
    });
  }

  loadSubjects() {
    this.http.get<any[]>(`${API_BASE}/subjects?activeOnly=true`).subscribe({
      next: res => this.subjects = res || [],
      error: () => this.subjects = []
    });
  }

  loadRooms() {
    this.http.get<any[]>(`${API_BASE}/rooms`).subscribe({
      next: res => this.rooms = (res || []).filter((r: any) => r.isActive !== false),
      error: () => this.rooms = []
    });
  }

  setStreamType(type: 'School' | 'Coaching') {
    this.streamType = type;
    if (type === 'School') {
      this.newForm.batchId = undefined;
    } else {
      this.newForm.classSectionId = undefined;
      this.selectedClassId = '';
      this.availableSections = [];
    }
  }

  onSchoolClassChange() {
    this.newForm.classSectionId = undefined;
    const cls = this.schoolClasses.find(c => c.id === this.selectedClassId);
    this.availableSections = cls?.sections || [];
    if (this.availableSections.length === 1) {
      this.newForm.classSectionId = this.availableSections[0].id;
      this.onSchoolSectionChange();
    }
  }

  onSchoolSectionChange() {
    const sec = this.availableSections.find(s => s.id === this.newForm.classSectionId);
    if (sec && sec.roomNumber && !this.newForm.roomNumber) {
      this.newForm.roomNumber = sec.roomNumber;
    }
  }

  onSubjectSelect(subId: string) {
    const sub = this.subjects.find(s => s.id === subId);
    if (sub) {
      this.newForm.subjectId = sub.id;
      this.newForm.subjectName = sub.name;
    } else {
      this.newForm.subjectId = undefined;
      this.newForm.subjectName = '';
    }
  }

  loadSubstitutions() {
    this.loading = true;
    let url = `${API_BASE}/teachers/substitutions?`;
    if (this.selectedDate) url += `date=${this.selectedDate}&`;
    if (this.selectedStatus) url += `status=${this.selectedStatus}&`;

    this.http.get<TeacherSubstitutionDto[]>(url).subscribe({
      next: res => {
        this.substitutions = res;
        this.loading = false;
      },
      error: () => {
        this.substitutions = [];
        this.loading = false;
      }
    });
  }

  resetFilters() {
    this.selectedDate = new Date().toISOString().substring(0, 10);
    this.selectedStatus = '';
    this.loadSubstitutions();
  }

  getPendingCount(): number {
    return this.substitutions.filter(s => s.status === 'Assigned').length;
  }

  getCompletedCount(): number {
    return this.substitutions.filter(s => s.status === 'Completed').length;
  }

  getAvailableSubstituteTeachers(): TeacherDto[] {
    return this.teachers.filter(t => t.id !== this.newForm.originalTeacherId);
  }

  onOriginalTeacherChange() {
    if (this.newForm.substituteTeacherId === this.newForm.originalTeacherId) {
      this.newForm.substituteTeacherId = '';
    }
  }

  openCreateModal() {
    this.streamType = 'School';
    this.selectedClassId = '';
    this.availableSections = [];
    this.newForm = {
      substitutionDate: this.selectedDate || new Date().toISOString().substring(0, 10),
      originalTeacherId: '',
      substituteTeacherId: '',
      timeSlot: 'Period 1 (08:30 AM - 09:15 AM)',
      proxyAllowance: 0,
      reason: 'Casual Leave (CL)',
      roomNumber: '',
      subjectName: ''
    };
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  saveSubstitution() {
    if (!this.newForm.originalTeacherId || !this.newForm.substituteTeacherId || !this.newForm.timeSlot) {
      this.confirmDialog.alert('Required Fields', 'Please fill in all mandatory fields (Absent Teacher, Substitute Teacher, Period).', 'warning');
      return;
    }

    this.saving = true;
    this.http.post<TeacherSubstitutionDto>(`${API_BASE}/teachers/substitutions`, this.newForm).subscribe({
      next: () => {
        this.saving = false;
        this.showCreateModal = false;
        this.confirmDialog.alert('Proxy Assigned', 'Proxy teacher assigned successfully!', 'success');
        this.loadSubstitutions();
      },
      error: err => {
        this.saving = false;
        this.confirmDialog.alert('Assignment Failed', err.error?.message || 'Error assigning proxy teacher.', 'danger');
      }
    });
  }

  updateStatus(sub: TeacherSubstitutionDto, newStatus: string) {
    this.http.put(`${API_BASE}/teachers/substitutions/${sub.id}`, { status: newStatus }).subscribe({
      next: () => {
        this.confirmDialog.alert('Status Updated', `Status updated to "${newStatus}" successfully.`, 'success');
        this.loadSubstitutions();
      },
      error: () => this.confirmDialog.alert('Error', 'Failed to update status. Please try again.', 'danger')
    });
  }

  deleteSubstitution(id: string) {
    this.confirmDialog.danger('Delete Substitution Record?', 'Are you sure you want to delete this proxy substitution record?').subscribe(ok => {
      if (!ok) return;

      this.http.delete(`${API_BASE}/teachers/substitutions/${id}`).subscribe({
        next: () => {
          this.confirmDialog.alert('Deleted', 'Proxy substitution record deleted successfully.', 'success');
          this.loadSubstitutions();
        },
        error: () => this.confirmDialog.alert('Error', 'Failed to delete record.', 'danger')
      });
    });
  }
}
