import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

const API_BASE = 'http://localhost:5000/api';

export interface AdmissionEnquiryDto {
  id: string;
  tenantId: string;
  branchId?: string;
  enquiryNumber: string;
  studentName: string;
  parentName: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  interestedClassId?: string;
  interestedClassName?: string;
  interestedBatchId?: string;
  interestedBatchName?: string;
  enquiryDate: string;
  followUpDate?: string;
  source: string;
  status: string;
  priority: string;
  remarks?: string;
  convertedStudentId?: string;
  convertedAt?: string;
  createdBy?: string;
  createdAt: string;
}

export interface EnquiryStatsDto {
  totalEnquiries: number;
  newEnquiries: number;
  followUpPending: number;
  demoOrVisit: number;
  admittedConverted: number;
  lostDropped: number;
  conversionRate: number;
}

@Component({
  selector: 'app-admission-enquiries',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule, MatProgressBarModule,
    MatMenuModule, MatDividerModule
  ],
  template: `
    <div class="crm-page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>contact_phone</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Admission Enquiries & Prospectus CRM</h1>
            <p class="page-subtitle">
              Manage prospective student enquiries, follow-up call schedules, demo visits & 1-click admission conversions
            </p>
          </div>
        </div>

        <div class="header-actions">
          <button mat-stroked-button class="refresh-btn" (click)="loadEnquiries()" [disabled]="loading">
            <mat-icon [class.spin]="loading">refresh</mat-icon>
            <span>Refresh</span>
          </button>
          <button mat-raised-button class="create-btn" (click)="openEnquiryDialog()">
            <mat-icon>person_add</mat-icon>
            <span>New Enquiry</span>
          </button>
        </div>
      </div>

      <!-- Stats Bar -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon-wrap blue"><mat-icon>contact_phone</mat-icon></div>
          <div class="stat-details">
            <div class="stat-value">{{stats.totalEnquiries}}</div>
            <div class="stat-label">Total Enquiries</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrap amber"><mat-icon>fiber_new</mat-icon></div>
          <div class="stat-details">
            <div class="stat-value">{{stats.newEnquiries}}</div>
            <div class="stat-label">New Leads</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrap red"><mat-icon>phone_callback</mat-icon></div>
          <div class="stat-details">
            <div class="stat-value">{{stats.followUpPending}}</div>
            <div class="stat-label">Follow-up Due</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrap purple"><mat-icon>door_front</mat-icon></div>
          <div class="stat-details">
            <div class="stat-value">{{stats.demoOrVisit}}</div>
            <div class="stat-label">Demos / Visits</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrap green"><mat-icon>how_to_reg</mat-icon></div>
          <div class="stat-details">
            <div class="stat-value">{{stats.admittedConverted}} <small>({{stats.conversionRate}}%)</small></div>
            <div class="stat-label">Admitted / Converted</div>
          </div>
        </div>
      </div>

      <!-- Filter Card -->
      <div class="filter-card">
        <div class="filter-row">
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Pipeline Status</mat-label>
            <mat-select [(ngModel)]="filterStatus" (selectionChange)="loadEnquiries()">
              <mat-option value="">All Statuses</mat-option>
              <mat-option value="New">New Enquiry</mat-option>
              <mat-option value="Contacted">Contacted / Follow-up</mat-option>
              <mat-option value="Demo / Visit">Demo / Campus Visit</mat-option>
              <mat-option value="Admitted">Admitted / Enrolled</mat-option>
              <mat-option value="Lost">Lost / Dropped</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Lead Source</mat-label>
            <mat-select [(ngModel)]="filterSource" (selectionChange)="loadEnquiries()">
              <mat-option value="">All Sources</mat-option>
              <mat-option value="Walk-in">Walk-in</mat-option>
              <mat-option value="Phone">Phone Enquiry</mat-option>
              <mat-option value="Website">Website</mat-option>
              <mat-option value="Referral">Word of Mouth / Referral</mat-option>
              <mat-option value="Social Media">Social Media</mat-option>
              <mat-option value="Newspaper">Newspaper / Banner</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Priority</mat-label>
            <mat-select [(ngModel)]="filterPriority" (selectionChange)="loadEnquiries()">
              <mat-option value="">All Priorities</mat-option>
              <mat-option value="High">🔥 High Priority</mat-option>
              <mat-option value="Medium">⚡ Medium</mat-option>
              <mat-option value="Low">💤 Low</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field search-field">
            <mat-label>Search Name, Phone, Number</mat-label>
            <input matInput [(ngModel)]="searchTerm" placeholder="Search..." (keyup.enter)="loadEnquiries()">
          </mat-form-field>

          <div class="view-toggle">
            <button mat-icon-button [class.active-view]="viewMode==='kanban'" (click)="viewMode='kanban'" matTooltip="Pipeline Kanban">
              <mat-icon>view_column</mat-icon>
            </button>
            <button mat-icon-button [class.active-view]="viewMode==='table'" (click)="viewMode='table'" matTooltip="Table List">
              <mat-icon>format_list_bulleted</mat-icon>
            </button>
          </div>
        </div>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!loading && filteredItems.length === 0">
        <div class="empty-icon-wrap"><mat-icon>contact_phone</mat-icon></div>
        <h3>No Enquiries Found</h3>
        <p>No student admission enquiries match the current filters. Click "New Enquiry" to register a lead.</p>
        <button mat-raised-button class="create-btn" (click)="openEnquiryDialog()">
          <mat-icon>add</mat-icon> Register First Enquiry
        </button>
      </div>

      <!-- PIPELINE KANBAN VIEW -->
      <div class="kanban-board" *ngIf="!loading && viewMode==='kanban' && filteredItems.length > 0">
        <!-- New Column -->
        <div class="kanban-col">
          <div class="kanban-col-hdr new-hdr">
            <span>New Leads</span>
            <span class="count-badge">{{getStageItems('New').length}}</span>
          </div>
          <div class="kanban-cards">
            <div class="enquiry-card" *ngFor="let e of getStageItems('New')">
              <ng-container *ngTemplateOutlet="cardContent; context:{e: e}"></ng-container>
            </div>
            <div class="kanban-empty" *ngIf="getStageItems('New').length === 0">No new leads</div>
          </div>
        </div>

        <!-- Contacted / Follow-up Column -->
        <div class="kanban-col">
          <div class="kanban-col-hdr contacted-hdr">
            <span>Contacted / Follow-up</span>
            <span class="count-badge">{{getStageItems('Contacted').length}}</span>
          </div>
          <div class="kanban-cards">
            <div class="enquiry-card" *ngFor="let e of getStageItems('Contacted')">
              <ng-container *ngTemplateOutlet="cardContent; context:{e: e}"></ng-container>
            </div>
            <div class="kanban-empty" *ngIf="getStageItems('Contacted').length === 0">No follow-ups</div>
          </div>
        </div>

        <!-- Demo / Campus Visit Column -->
        <div class="kanban-col">
          <div class="kanban-col-hdr demo-hdr">
            <span>Demo / Campus Visit</span>
            <span class="count-badge">{{getStageItems('Demo / Visit').length}}</span>
          </div>
          <div class="kanban-cards">
            <div class="enquiry-card" *ngFor="let e of getStageItems('Demo / Visit')">
              <ng-container *ngTemplateOutlet="cardContent; context:{e: e}"></ng-container>
            </div>
            <div class="kanban-empty" *ngIf="getStageItems('Demo / Visit').length === 0">No campus demos</div>
          </div>
        </div>

        <!-- Admitted Column -->
        <div class="kanban-col">
          <div class="kanban-col-hdr admitted-hdr">
            <span>Admitted / Enrolled 🎉</span>
            <span class="count-badge">{{getStageItems('Admitted').length}}</span>
          </div>
          <div class="kanban-cards">
            <div class="enquiry-card" *ngFor="let e of getStageItems('Admitted')">
              <ng-container *ngTemplateOutlet="cardContent; context:{e: e}"></ng-container>
            </div>
            <div class="kanban-empty" *ngIf="getStageItems('Admitted').length === 0">No converted admissions</div>
          </div>
        </div>
      </div>

      <!-- Reusable Card Template -->
      <ng-template #cardContent let-e="e">
        <div class="card-top">
          <span class="enq-num">{{e.enquiryNumber}}</span>
          <span class="prio-tag" [ngClass]="e.priority.toLowerCase()">{{e.priority}}</span>
        </div>

        <div class="student-name">{{e.studentName}}</div>
        <div class="parent-line" *ngIf="e.parentName">
          <mat-icon class="ic-inline">people</mat-icon> {{e.parentName}}
        </div>

        <div class="phone-line">
          <a [href]="'tel:' + e.phone" class="phone-link">
            <mat-icon class="ic-inline">phone</mat-icon> {{e.phone}}
          </a>
          <a [href]="'https://wa.me/91' + e.phone" target="_blank" class="wa-btn" matTooltip="Open WhatsApp">
            <mat-icon class="ic-wa">chat</mat-icon>
          </a>
        </div>

        <div class="class-line" *ngIf="e.interestedClassName">
          <mat-icon class="ic-inline">school</mat-icon> Class: <strong>{{e.interestedClassName}}</strong>
        </div>

        <div class="follow-up-bar" *ngIf="e.followUpDate" [class.due]="isFollowUpOverdue(e.followUpDate)">
          <mat-icon class="ic-inline">alarm</mat-icon>
          <span>Follow-up: <strong>{{e.followUpDate | date:'dd MMM yyyy'}}</strong></span>
        </div>

        <div class="follow-up-bar" *ngIf="e.createdAt" style="background:#f1f5f9; color:#475569; margin-top:4px;">
          <mat-icon class="ic-inline">schedule</mat-icon>
          <span>Registered: <strong>{{e.createdAt | date:'dd MMM yyyy, hh:mm a'}}</strong></span>
        </div>

        <div class="remarks-box" *ngIf="e.remarks">"{{e.remarks}}"</div>

        <!-- Quick Stage Progression Bar -->
        <div class="stage-flow-bar" *ngIf="e.status !== 'Admitted'">
          <!-- If New: Quick advance to Contacted -->
          <button mat-button class="stage-step-btn btn-contact" *ngIf="e.status === 'New'" (click)="moveStage(e, 'Contacted')" matTooltip="Move to Contacted / Follow-up">
            <mat-icon>phone_in_talk</mat-icon>
            <span>Mark Contacted ➔</span>
          </button>

          <!-- If Contacted: Quick advance to Demo / Visit -->
          <button mat-button class="stage-step-btn btn-demo" *ngIf="e.status === 'Contacted'" (click)="moveStage(e, 'Demo / Visit')" matTooltip="Move to Demo / Campus Visit">
            <mat-icon>school</mat-icon>
            <span>Schedule Demo ➔</span>
          </button>

          <!-- If Demo: Quick convert to Admission -->
          <button mat-button class="stage-step-btn btn-admit" *ngIf="e.status === 'Demo / Visit' || e.status === 'Demo'" (click)="openConvertDialog(e)" matTooltip="Complete Student Admission">
            <mat-icon>how_to_reg</mat-icon>
            <span>Admit Student ➔</span>
          </button>

          <!-- Change Stage Dropdown Button -->
          <button mat-icon-button class="stage-menu-btn" [matMenuTriggerFor]="stageMenu" [matMenuTriggerData]="{ item: e }" matTooltip="Change Pipeline Stage">
            <mat-icon>swap_horiz</mat-icon>
          </button>
        </div>

        <div class="stage-flow-bar admitted-bar" *ngIf="e.status === 'Admitted'">
          <div class="admitted-indicator">
            <mat-icon>verified</mat-icon>
            <span>Enrolled Student</span>
          </div>
          <button mat-icon-button class="stage-menu-btn" [matMenuTriggerFor]="stageMenu" [matMenuTriggerData]="{ item: e }" matTooltip="Change Stage">
            <mat-icon>swap_horiz</mat-icon>
          </button>
        </div>

        <div class="card-bottom">
          <span class="source-tag">{{e.source}}</span>

          <div class="card-actions">
            <button mat-icon-button (click)="openEnquiryDialog(e)" matTooltip="Edit Enquiry">
              <mat-icon class="card-action-ic edit">edit</mat-icon>
            </button>
            <button mat-raised-button class="convert-mini-btn" *ngIf="e.status !== 'Admitted'" (click)="openConvertDialog(e)" matTooltip="Convert to Student Admission">
              <mat-icon>how_to_reg</mat-icon> Admit
            </button>
            <button mat-icon-button (click)="deleteEnquiry(e)" matTooltip="Delete">
              <mat-icon class="card-action-ic delete">delete</mat-icon>
            </button>
          </div>
        </div>
      </ng-template>

      <!-- Stage Change Dropdown Menu -->
      <mat-menu #stageMenu="matMenu">
        <ng-template matMenuContent let-item="item">
          <div class="menu-hdr">Change Pipeline Stage:</div>
          <button mat-menu-item (click)="moveStage(item, 'New')" [disabled]="item.status === 'New'">
            <mat-icon style="color:#2563eb">fiber_new</mat-icon>
            <span>1. New Leads</span>
          </button>
          <button mat-menu-item (click)="moveStage(item, 'Contacted')" [disabled]="item.status === 'Contacted'">
            <mat-icon style="color:#d97706">phone_in_talk</mat-icon>
            <span>2. Contacted / Follow-up</span>
          </button>
          <button mat-menu-item (click)="moveStage(item, 'Demo / Visit')" [disabled]="item.status === 'Demo / Visit' || item.status === 'Demo'">
            <mat-icon style="color:#7c3aed">school</mat-icon>
            <span>3. Demo / Campus Visit</span>
          </button>
          <mat-divider></mat-divider>
          <button mat-menu-item (click)="openConvertDialog(item)">
            <mat-icon style="color:#16a34a">how_to_reg</mat-icon>
            <span>4. Admit / Enroll Student 🎓</span>
          </button>
          <mat-divider></mat-divider>
          <button mat-menu-item (click)="moveStage(item, 'Lost')" [disabled]="item.status === 'Lost'">
            <mat-icon style="color:#ef4444">cancel</mat-icon>
            <span>Mark as Lost / Dropped</span>
          </button>
        </ng-template>
      </mat-menu>

      <!-- TABLE VIEW -->
      <div class="enq-table-wrap" *ngIf="!loading && viewMode==='table' && filteredItems.length > 0">
        <table class="enq-table">
          <thead>
            <tr>
              <th>Enq #</th>
              <th>Student & Parent</th>
              <th>Phone</th>
              <th>Interested Class</th>
              <th>Source</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Registered (IST)</th>
              <th>Follow-up Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let e of filteredItems">
              <td><strong>{{e.enquiryNumber}}</strong></td>
              <td>
                <div class="tbl-name">{{e.studentName}}</div>
                <div class="tbl-sub" *ngIf="e.parentName">Parent: {{e.parentName}}</div>
              </td>
              <td>
                <div class="tbl-phone">
                  <a [href]="'tel:' + e.phone">{{e.phone}}</a>
                  <a [href]="'https://wa.me/91' + e.phone" target="_blank" class="wa-icon-link">
                    <mat-icon class="ic-wa">chat</mat-icon>
                  </a>
                </div>
              </td>
              <td>{{e.interestedClassName || e.interestedBatchName || '—'}}</td>
              <td><span class="source-tag">{{e.source}}</span></td>
              <td><span class="prio-tag" [ngClass]="e.priority.toLowerCase()">{{e.priority}}</span></td>
              <td>
                <button mat-button class="tbl-status-btn" [matMenuTriggerFor]="stageMenu" [matMenuTriggerData]="{ item: e }" matTooltip="Click to change pipeline stage">
                  <span class="status-pill" [ngClass]="getStatusClass(e.status)">{{e.status}} ▾</span>
                </button>
              </td>
              <td>{{e.createdAt | date:'dd MMM yyyy, hh:mm a'}}</td>
              <td>
                <span [class.overdue-text]="isFollowUpOverdue(e.followUpDate)">
                  {{e.followUpDate ? (e.followUpDate | date:'dd MMM yyyy') : '—'}}
                </span>
              </td>
              <td>
                <div class="tbl-actions">
                  <button mat-icon-button (click)="openEnquiryDialog(e)" matTooltip="Edit">
                    <mat-icon class="card-action-ic edit">edit</mat-icon>
                  </button>
                  <button mat-raised-button class="convert-mini-btn" *ngIf="e.status !== 'Admitted'" (click)="openConvertDialog(e)" matTooltip="Convert to Admission">
                    <mat-icon>how_to_reg</mat-icon> Admit
                  </button>
                  <button mat-icon-button (click)="deleteEnquiry(e)" matTooltip="Delete">
                    <mat-icon class="card-action-ic delete">delete</mat-icon>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .crm-page-container { padding: 24px; display: flex; flex-direction: column; gap: 20px; background: #f8fafc; min-height: 100vh; }
    .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; background: #fff; padding: 20px 24px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-icon-box { width: 48px; height: 48px; border-radius: 12px; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); }
    .page-title { margin: 0; font-size: 20px; font-weight: 800; color: #1e3a8a; }
    .page-subtitle { margin: 4px 0 0; font-size: 13px; color: #64748b; }
    .header-actions { display: flex; gap: 12px; align-items: center; }
    .create-btn { background: #2563eb !important; color: #fff !important; font-weight: 700; padding: 0 20px; height: 42px; border-radius: 8px; }
    .refresh-btn { border-color: #cbd5e1; color: #475569; height: 42px; border-radius: 8px; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* Stats */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
    .stat-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; display: flex; align-items: center; gap: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .stat-icon-wrap { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .stat-icon-wrap.blue { background: #eff6ff; color: #2563eb; }
    .stat-icon-wrap.amber { background: #fffbeb; color: #d97706; }
    .stat-icon-wrap.red { background: #fef2f2; color: #dc2626; }
    .stat-icon-wrap.purple { background: #faf5ff; color: #9333ea; }
    .stat-icon-wrap.green { background: #f0fdf4; color: #16a34a; }
    .stat-value { font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.1; }
    .stat-value small { font-size: 12px; color: #16a34a; font-weight: 600; }
    .stat-label { font-size: 12px; font-weight: 600; color: #64748b; margin-top: 2px; }

    /* Filter Card */
    .filter-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .filter-row { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
    .filter-field { flex: 1; min-width: 160px; }
    .search-field { flex: 1.5; }
    .filter-field ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    .view-toggle { display: flex; gap: 4px; background: #f1f5f9; padding: 4px; border-radius: 8px; border: 1px solid #cbd5e1; }
    .view-toggle button { color: #64748b; border-radius: 6px; }
    .active-view { background: #fff !important; color: #2563eb !important; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

    /* Kanban Board */
    .kanban-board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; align-items: start; }
    @media (max-width: 1100px) { .kanban-board { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 650px) { .kanban-board { grid-template-columns: 1fr; } }

    .kanban-col { background: #f1f5f9; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; display: flex; flex-direction: column; }
    .kanban-col-hdr { padding: 12px 16px; font-size: 13px; font-weight: 800; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid transparent; }
    .new-hdr { background: #eff6ff; color: #1d4ed8; border-color: #3b82f6; }
    .contacted-hdr { background: #fffbeb; color: #b45309; border-color: #f59e0b; }
    .demo-hdr { background: #faf5ff; color: #7e22ce; border-color: #a855f7; }
    .admitted-hdr { background: #ecfdf5; color: #047857; border-color: #10b981; }
    .count-badge { background: rgba(0,0,0,0.08); padding: 2px 8px; border-radius: 12px; font-size: 11px; }

    .kanban-cards { padding: 12px; display: flex; flex-direction: column; gap: 12px; min-height: 250px; }
    .kanban-empty { text-align: center; color: #94a3b8; font-size: 12px; padding: 40px 10px; }

    /* Enquiry Card */
    .enquiry-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 8px; transition: transform 0.15s, box-shadow 0.15s; }
    .enquiry-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: #cbd5e1; }
    .card-top { display: flex; justify-content: space-between; align-items: center; }
    .enq-num { font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 0.5px; }
    .prio-tag { font-size: 9.5px; font-weight: 800; padding: 2px 7px; border-radius: 4px; text-transform: uppercase; }
    .prio-tag.high { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .prio-tag.medium { background: #fffbeb; color: #d97706; border: 1px solid #fef3c7; }
    .prio-tag.low { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }

    .student-name { font-size: 15px; font-weight: 800; color: #0f172a; }
    .parent-line, .phone-line, .class-line { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #475569; }
    .ic-inline { font-size: 15px; width: 15px; height: 15px; color: #64748b; }
    .phone-link { color: #2563eb; text-decoration: none; font-weight: 600; }
    .phone-link:hover { text-decoration: underline; }
    .wa-btn { display: inline-flex; align-items: center; color: #16a34a; margin-left: 6px; }
    .ic-wa { font-size: 16px; width: 16px; height: 16px; color: #16a34a; }

    .follow-up-bar { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #d97706; background: #fffbeb; padding: 4px 8px; border-radius: 6px; }
    .follow-up-bar.due { color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; }
    .overdue-text { color: #dc2626; font-weight: 700; }

    .remarks-box { font-size: 11px; color: #64748b; font-style: italic; background: #f8fafc; padding: 4px 8px; border-radius: 4px; }
    .card-bottom { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 8px; margin-top: 4px; }
    .source-tag { font-size: 10px; font-weight: 700; color: #475569; background: #f1f5f9; padding: 2px 7px; border-radius: 4px; border: 1px solid #e2e8f0; }
    .card-actions { display: flex; align-items: center; gap: 4px; }
    .card-action-ic { font-size: 16px; width: 16px; height: 16px; }
    .card-action-ic.edit { color: #2563eb; }
    .card-action-ic.delete { color: #ef4444; }
    .convert-mini-btn { background: #16a34a !important; color: #fff !important; font-size: 11px; font-weight: 700; height: 26px; line-height: 26px; padding: 0 8px; border-radius: 4px; }
    .convert-mini-btn mat-icon { font-size: 14px; width: 14px; height: 14px; margin-right: 2px; }

    /* Table styles */
    .enq-table-wrap { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .enq-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    .enq-table th { background: #f8fafc; color: #475569; font-weight: 700; padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .enq-table td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: middle; }
    .enq-table tr:hover { background: #f8fafc; }
    .tbl-name { font-weight: 700; color: #0f172a; }
    .tbl-sub { font-size: 11px; color: #64748b; }
    .tbl-phone { display: flex; align-items: center; gap: 6px; }
    .tbl-actions { display: flex; align-items: center; gap: 4px; }
    .status-pill { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; display: inline-block; }
    .status-new { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .status-contacted { background: #fffbeb; color: #b45309; border: 1px solid #fef3c7; }
    .status-demo { background: #faf5ff; color: #7e22ce; border: 1px solid #f3e8ff; }
    .status-admitted { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .status-lost { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }

    /* Stage Flow Bar on Card */
    .stage-flow-bar { display: flex; align-items: center; justify-content: space-between; gap: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px 6px; margin-top: 4px; }
    .stage-step-btn { 
      flex: 1; 
      height: 28px !important; 
      line-height: 28px !important; 
      font-size: 11px !important; 
      font-weight: 700 !important; 
      border-radius: 6px !important; 
      padding: 0 8px !important; 
      display: inline-flex !important; 
      align-items: center !important; 
      justify-content: center !important; 
      gap: 5px !important; 
      white-space: nowrap !important;
      overflow: hidden !important;
    }
    .stage-step-btn mat-icon { font-size: 14px !important; width: 14px !important; height: 14px !important; line-height: 14px !important; margin: 0 !important; flex-shrink: 0; }
    .stage-step-btn span { white-space: nowrap !important; }
    
    .btn-contact { background: #fffbeb !important; color: #b45309 !important; border: 1px solid #fde68a !important; }
    .btn-contact:hover { background: #fef3c7 !important; border-color: #fcd34d !important; }
    
    .btn-demo { background: #faf5ff !important; color: #7e22ce !important; border: 1px solid #e9d5ff !important; }
    .btn-demo:hover { background: #f3e8ff !important; border-color: #d8b4fe !important; }
    
    .btn-admit { background: #ecfdf5 !important; color: #047857 !important; border: 1px solid #a7f3d0 !important; }
    .btn-admit:hover { background: #d1fae5 !important; border-color: #6ee7b7 !important; }

    .stage-menu-btn { 
      width: 28px !important; 
      height: 28px !important; 
      min-width: 28px !important; 
      padding: 0 !important; 
      margin: 0 !important;
      display: inline-flex !important; 
      align-items: center !important; 
      justify-content: center !important; 
      color: #64748b !important; 
      border-radius: 6px !important; 
      background: transparent;
      box-sizing: border-box !important;
      --mdc-icon-button-state-layer-size: 28px !important;
      --mdc-icon-button-icon-size: 18px !important;
    }
    .stage-menu-btn .mat-mdc-button-touch-target { display: none !important; }
    .stage-menu-btn .mat-mdc-button-persistent-ripple { border-radius: 6px !important; }
    .stage-menu-btn mat-icon { 
      font-size: 18px !important; 
      width: 18px !important; 
      height: 18px !important; 
      line-height: 18px !important; 
      margin: 0 !important; 
      padding: 0 !important;
      display: flex !important; 
      align-items: center !important; 
      justify-content: center !important; 
      position: relative !important;
      z-index: 1 !important;
    }
    .stage-menu-btn:hover { color: #1e293b !important; background: #e2e8f0 !important; }

    .admitted-bar { background: #ecfdf5; border-color: #a7f3d0; }
    .admitted-indicator { display: flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; color: #047857; }
    .admitted-indicator mat-icon { font-size: 15px; width: 15px; height: 15px; color: #10b981; }

    .tbl-status-btn { padding: 0 !important; min-width: unset !important; line-height: normal !important; height: auto !important; }
    .menu-hdr { padding: 8px 16px 4px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }

    /* Empty state */
    .empty-state { background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 60px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .empty-icon-wrap { width: 64px; height: 64px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; }
    .empty-icon-wrap mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .empty-state h3 { margin: 0; font-size: 18px; color: #1e293b; font-weight: 700; }
    .empty-state p { margin: 0; font-size: 13px; color: #64748b; max-width: 400px; }
  `]
})
export class AdmissionEnquiriesComponent implements OnInit {
  enquiries: AdmissionEnquiryDto[] = [];
  classes: any[] = [];
  batches: any[] = [];

  loading = false;
  viewMode: 'kanban' | 'table' = 'kanban';

  filterStatus = '';
  filterSource = '';
  filterPriority = '';
  searchTerm = '';

  stats: EnquiryStatsDto = {
    totalEnquiries: 0,
    newEnquiries: 0,
    followUpPending: 0,
    demoOrVisit: 0,
    admittedConverted: 0,
    lostDropped: 0,
    conversionRate: 0
  };

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadClasses();
    this.loadBatches();
    this.loadStats();
    this.loadEnquiries();
  }

  loadClasses(): void {
    this.http.get<any[]>(`${API_BASE}/school/classes`).subscribe({
      next: r => this.classes = r,
      error: () => this.classes = []
    });
  }

  loadBatches(): void {
    this.http.get<any[]>(`${API_BASE}/batches`).subscribe({
      next: r => this.batches = r,
      error: () => this.batches = []
    });
  }

  loadStats(): void {
    this.http.get<EnquiryStatsDto>(`${API_BASE}/enquiries/stats`).subscribe({
      next: s => this.stats = s,
      error: () => {}
    });
  }

  loadEnquiries(): void {
    this.loading = true;
    let url = `${API_BASE}/enquiries`;
    const params: string[] = [];
    if (this.filterStatus) params.push(`status=${this.filterStatus}`);
    if (this.filterSource) params.push(`source=${this.filterSource}`);
    if (this.filterPriority) params.push(`priority=${this.filterPriority}`);
    if (params.length > 0) url += '?' + params.join('&');

    this.http.get<AdmissionEnquiryDto[]>(url).subscribe({
      next: r => {
        this.enquiries = r;
        this.loading = false;
        this.loadStats();
      },
      error: () => {
        this.enquiries = [];
        this.loading = false;
      }
    });
  }

  get filteredItems(): AdmissionEnquiryDto[] {
    if (!this.searchTerm.trim()) return this.enquiries;
    const s = this.searchTerm.toLowerCase().trim();
    return this.enquiries.filter(e =>
      e.studentName.toLowerCase().includes(s) ||
      e.parentName.toLowerCase().includes(s) ||
      e.phone.includes(s) ||
      e.enquiryNumber.toLowerCase().includes(s)
    );
  }

  getStageItems(stage: string): AdmissionEnquiryDto[] {
    return this.filteredItems.filter(e => {
      if (stage === 'New') return e.status === 'New';
      if (stage === 'Contacted') return e.status === 'Contacted';
      if (stage === 'Demo / Visit') return e.status === 'Demo / Visit' || e.status === 'Demo';
      if (stage === 'Admitted') return e.status === 'Admitted';
      return false;
    });
  }

  isFollowUpOverdue(fDate?: string): boolean {
    if (!fDate) return false;
    const d = new Date(fDate).setHours(23, 59, 59, 999);
    return d <= Date.now();
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'New': return 'status-new';
      case 'Contacted': return 'status-contacted';
      case 'Demo / Visit': return 'status-demo';
      case 'Admitted': return 'status-admitted';
      case 'Lost': return 'status-lost';
      default: return 'status-new';
    }
  }

  openEnquiryDialog(item?: AdmissionEnquiryDto): void {
    const ref = this.dialog.open(EnquiryFormDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      disableClose: false,
      data: {
        enquiry: item,
        classes: this.classes,
        batches: this.batches
      }
    });

    ref.afterClosed().subscribe((res: any) => {
      if (!res) return;
      this.loadEnquiries();
      if (res.action === 'created') {
        this.confirmDialog.alert(
          'Enquiry Registered 🎉',
          `Enquiry #${res.enquiryNumber} for "${res.studentName}" registered successfully!`,
          'success'
        );
      } else if (res.action === 'updated') {
        this.confirmDialog.alert(
          'Enquiry Updated 🎉',
          `Enquiry details for "${res.studentName}" updated successfully!`,
          'success'
        );
      }
    });
  }

  openConvertDialog(item: AdmissionEnquiryDto): void {
    const ref = this.dialog.open(ConvertEnquiryDialogComponent, {
      width: '520px',
      maxWidth: '95vw',
      disableClose: false,
      data: {
        enquiry: item,
        classes: this.classes,
        batches: this.batches
      }
    });

    ref.afterClosed().subscribe((res: any) => {
      if (!res) return;
      this.loadEnquiries();
      this.confirmDialog.alert(
        'Admission Successful 🎉',
        `Student "${res.studentName}" has been successfully enrolled! Admission No: ${res.admissionNumber || 'Generated'}.`,
        'success'
      );
    });
  }

  deleteEnquiry(e: AdmissionEnquiryDto): void {
    this.confirmDialog.confirm(
      'Delete Enquiry Record',
      `Are you sure you want to permanently delete enquiry #${e.enquiryNumber} for "${e.studentName}"?`,
      'Delete Enquiry',
      'Cancel',
      'danger'
    ).subscribe(ok => {
      if (!ok) return;
      this.http.delete(`${API_BASE}/enquiries/${e.id}`).subscribe({
        next: () => {
          this.loadEnquiries();
          this.confirmDialog.alert('Enquiry Deleted', 'The enquiry record has been deleted.', 'success');
        },
        error: () => this.confirmDialog.alert('Error', 'Failed to delete enquiry.', 'danger')
      });
    });
  }

  moveStage(e: AdmissionEnquiryDto, newStage: string): void {
    if (e.status === newStage) return;
    if (newStage === 'Admitted') {
      this.openConvertDialog(e);
      return;
    }

    const payload = {
      studentName: e.studentName,
      parentName: e.parentName,
      phone: e.phone,
      alternatePhone: e.alternatePhone,
      email: e.email,
      interestedClassId: e.interestedClassId,
      interestedClassName: e.interestedClassName,
      interestedBatchId: e.interestedBatchId,
      interestedBatchName: e.interestedBatchName,
      followUpDate: e.followUpDate,
      source: e.source,
      status: newStage,
      priority: e.priority,
      remarks: e.remarks
    };

    this.http.put(`${API_BASE}/enquiries/${e.id}`, payload).subscribe({
      next: () => {
        e.status = newStage;
        this.loadStats();
        this.confirmDialog.alert(
          'Pipeline Stage Updated 🎉',
          `"${e.studentName}" has been moved to "${newStage}" stage!`,
          'success'
        );
      },
      error: () => this.confirmDialog.alert('Error', 'Failed to update pipeline stage.', 'danger')
    });
  }
}

// =========================================================================
// Enquiry Form Dialog Component (Strict AGENTS.md light-blue header)
// =========================================================================

@Component({
  selector: 'app-enquiry-form-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule
  ],
  template: `
    <div class="enq-dialog-wrap">
      <!-- Strict AGENTS.md Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>{{isEdit ? 'edit_note' : 'person_add'}}</mat-icon>
          </div>
          <div>
            <h2 class="modal-title">{{isEdit ? 'Edit Admission Enquiry' : 'New Admission Enquiry'}}</h2>
            <p class="modal-subtitle">
              <strong style="color:#1e40af">{{isEdit ? model.enquiryNumber : 'Prospective Lead Registration'}}</strong>
              <span> &bull; Record student interest, follow-up & source</span>
            </p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close(false)" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Form Body -->
      <div class="modal-body">
        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Student Name (विद्यार्थी का नाम)</mat-label>
            <input matInput [(ngModel)]="model.studentName" placeholder="Full Name" required />
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Parent / Guardian Name</mat-label>
            <input matInput [(ngModel)]="model.parentName" placeholder="Father/Mother Name" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Mobile / WhatsApp Phone</mat-label>
            <input matInput [(ngModel)]="model.phone" placeholder="10-digit number" required />
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Alternate Phone (Optional)</mat-label>
            <input matInput [(ngModel)]="model.alternatePhone" placeholder="Optional" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Interested Class (कक्षा)</mat-label>
            <mat-select [(ngModel)]="model.interestedClassId" (selectionChange)="onClassSelect()">
              <mat-option value="">Not Applicable</mat-option>
              <mat-option *ngFor="let c of data.classes" [value]="c.id">{{c.name}}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Interested Batch (Coaching)</mat-label>
            <mat-select [(ngModel)]="model.interestedBatchId" (selectionChange)="onBatchSelect()">
              <mat-option value="">Not Applicable</mat-option>
              <mat-option *ngFor="let b of data.batches" [value]="b.id">{{b.name}}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Lead Source (माध्यम)</mat-label>
            <mat-select [(ngModel)]="model.source">
              <mat-option value="Walk-in">Walk-in (कार्यालय आगमन)</mat-option>
              <mat-option value="Phone">Phone Enquiry</mat-option>
              <mat-option value="Website">Website Form</mat-option>
              <mat-option value="Referral">Word of Mouth / Referral</mat-option>
              <mat-option value="Social Media">Social Media (FB / IG / WA)</mat-option>
              <mat-option value="Newspaper">Newspaper / Hoarding</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Priority Level</mat-label>
            <mat-select [(ngModel)]="model.priority">
              <mat-option value="High">🔥 High Priority (Ready to join)</mat-option>
              <mat-option value="Medium">⚡ Medium (Exploring options)</mat-option>
              <mat-option value="Low">💤 Low (General enquiry)</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Pipeline Stage (चरण)</mat-label>
            <mat-select [(ngModel)]="model.status">
              <mat-option value="New">🆕 New Enquiry</mat-option>
              <mat-option value="Contacted">📞 Contacted / Follow-up</mat-option>
              <mat-option value="Demo / Visit">🏫 Demo / Campus Visit</mat-option>
              <mat-option value="Admitted" *ngIf="isEdit">🎓 Admitted / Enrolled</mat-option>
              <mat-option value="Lost" *ngIf="isEdit">❌ Lost / Dropped</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Next Follow-Up Date</mat-label>
            <input matInput type="date" [(ngModel)]="followUpDateStr" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-field">
          <mat-label>Enquiry Remarks / Notes (टिप्पणी)</mat-label>
          <textarea matInput [(ngModel)]="model.remarks" rows="3" placeholder="Student previous marks, specific requirements, parent expectations..."></textarea>
        </mat-form-field>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button mat-button (click)="dialogRef.close(false)" class="cancel-btn">Cancel</button>
        <button mat-raised-button class="save-btn" (click)="saveEnquiry()" [disabled]="saving || !model.studentName || !model.phone">
          <mat-icon>{{isEdit ? 'save' : 'check'}}</mat-icon>
          <span>{{isEdit ? 'Save Changes' : 'Register Enquiry'}}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .enq-dialog-wrap { display: flex; flex-direction: column; background: #fff; border-radius: 12px; overflow: hidden; }
    .modal-header { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-bottom: 1px solid #bfdbfe; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .header-icon-box { background: #2563eb; color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
    .modal-title { color: #1e3a8a; font-weight: 700; margin: 0; font-size: 18px; }
    .modal-subtitle { color: #3b82f6; margin: 3px 0 0; font-size: 12px; }
    .close-btn { color: #64748b; }
    .close-btn:hover { color: #1e293b; }

    .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 14px; max-height: 70vh; overflow-y: auto; }
    .form-row { display: flex; gap: 14px; }
    .form-field { flex: 1; }
    .full-field { width: 100%; }
    .modal-footer { padding: 14px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px; }
    .cancel-btn { color: #64748b; }
    .save-btn { background: #2563eb !important; color: #fff !important; font-weight: 700; }
  `]
})
export class EnquiryFormDialogComponent implements OnInit {
  isEdit = false;
  saving = false;
  followUpDateStr = '';

  model: any = {
    studentName: '',
    parentName: '',
    phone: '',
    alternatePhone: '',
    email: '',
    interestedClassId: '',
    interestedClassName: '',
    interestedBatchId: '',
    interestedBatchName: '',
    source: 'Walk-in',
    status: 'New',
    priority: 'Medium',
    remarks: ''
  };

  constructor(
    public dialogRef: MatDialogRef<EnquiryFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    if (this.data?.enquiry) {
      this.isEdit = true;
      const e = this.data.enquiry;
      this.model = { ...e };
      if (e.followUpDate) {
        this.followUpDateStr = e.followUpDate.slice(0, 10);
      }
    } else {
      // Default follow up after 2 days
      const d = new Date();
      d.setDate(d.getDate() + 2);
      const pad = (n: number) => n.toString().padStart(2, '0');
      this.followUpDateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
  }

  onClassSelect(): void {
    const c = this.data.classes?.find((x: any) => x.id === this.model.interestedClassId);
    this.model.interestedClassName = c ? c.name : '';
  }

  onBatchSelect(): void {
    const b = this.data.batches?.find((x: any) => x.id === this.model.interestedBatchId);
    this.model.interestedBatchName = b ? b.name : '';
  }

  saveEnquiry(): void {
    this.saving = true;
    const payload = {
      ...this.model,
      followUpDate: this.followUpDateStr ? (this.followUpDateStr + 'T00:00:00') : null
    };

    if (this.isEdit) {
      this.http.put(`${API_BASE}/enquiries/${this.model.id}`, payload).subscribe({
        next: () => {
          this.saving = false;
          this.dialogRef.close({
            action: 'updated',
            studentName: this.model.studentName,
            enquiryNumber: this.model.enquiryNumber
          });
        },
        error: () => {
          this.saving = false;
          this.confirmDialog.alert('Save Failed', 'Failed to update enquiry details.', 'danger');
        }
      });
    } else {
      this.http.post<any>(`${API_BASE}/enquiries`, payload).subscribe({
        next: (res) => {
          this.saving = false;
          this.dialogRef.close({
            action: 'created',
            studentName: this.model.studentName,
            enquiryNumber: res?.enquiryNumber || 'ENQ'
          });
        },
        error: () => {
          this.saving = false;
          this.confirmDialog.alert('Registration Failed', 'Failed to register new enquiry.', 'danger');
        }
      });
    }
  }
}

// =========================================================================
// Convert Enquiry to Student Admission Dialog (Strict AGENTS.md light-blue header)
// =========================================================================

@Component({
  selector: 'app-convert-enquiry-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule
  ],
  template: `
    <div class="convert-dialog-wrap">
      <!-- Strict AGENTS.md Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>how_to_reg</mat-icon>
          </div>
          <div>
            <h2 class="modal-title">Convert to Student Admission</h2>
            <p class="modal-subtitle">
              <strong style="color:#1e40af">{{data.enquiry.studentName}}</strong>
              <span> &bull; {{data.enquiry.enquiryNumber}}</span>
            </p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close(false)" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="modal-body">
        <div class="summary-box">
          <div><strong>Student:</strong> {{data.enquiry.studentName}}</div>
          <div><strong>Parent:</strong> {{data.enquiry.parentName || '—'}}</div>
          <div><strong>Phone:</strong> {{data.enquiry.phone}}</div>
        </div>

        <mat-form-field appearance="outline" class="full-field">
          <mat-label>Admission Number (Leave blank to auto-generate)</mat-label>
          <input matInput [(ngModel)]="model.admissionNumber" placeholder="e.g. ADM-2026-0045" />
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>School Class (कक्षा)</mat-label>
            <mat-select [(ngModel)]="model.classId" (selectionChange)="onClassSelect()">
              <mat-option value="">Not a School Student</mat-option>
              <mat-option *ngFor="let c of data.classes" [value]="c.id">{{c.name}}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field" *ngIf="availableSections.length > 0">
            <mat-label>Section (वर्ग)</mat-label>
            <mat-select [(ngModel)]="model.sectionId">
              <mat-option value="">Select Section</mat-option>
              <mat-option *ngFor="let s of availableSections" [value]="s.id">{{s.name}}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Coaching Batch</mat-label>
            <mat-select [(ngModel)]="model.batchId">
              <mat-option value="">Not a Coaching Student</mat-option>
              <mat-option *ngFor="let b of data.batches" [value]="b.id">{{b.name}}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Gender</mat-label>
            <mat-select [(ngModel)]="model.gender">
              <mat-option value="Male">Male</mat-option>
              <mat-option value="Female">Female</mat-option>
              <mat-option value="Other">Other</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-field">
          <mat-label>Date of Birth</mat-label>
          <input matInput type="date" [(ngModel)]="dobStr" />
        </mat-form-field>
      </div>

      <div class="modal-footer">
        <button mat-button (click)="dialogRef.close(false)" class="cancel-btn">Cancel</button>
        <button mat-raised-button class="admit-btn" (click)="confirmConvert()" [disabled]="converting">
          <mat-icon>check_circle</mat-icon>
          <span>Confirm Admission</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .convert-dialog-wrap { display: flex; flex-direction: column; background: #fff; border-radius: 12px; overflow: hidden; }
    .modal-header { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-bottom: 1px solid #bfdbfe; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .header-icon-box { background: #2563eb; color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
    .modal-title { color: #1e3a8a; font-weight: 700; margin: 0; font-size: 18px; }
    .modal-subtitle { color: #3b82f6; margin: 3px 0 0; font-size: 12px; }
    .close-btn { color: #64748b; }
    .close-btn:hover { color: #1e293b; }

    .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
    .summary-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #1e3a8a; line-height: 1.6; }
    .form-row { display: flex; gap: 14px; }
    .form-field { flex: 1; }
    .full-field { width: 100%; }
    .modal-footer { padding: 14px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px; }
    .cancel-btn { color: #64748b; }
    .admit-btn { background: #16a34a !important; color: #fff !important; font-weight: 700; }
  `]
})
export class ConvertEnquiryDialogComponent implements OnInit {
  converting = false;
  availableSections: any[] = [];
  dobStr = '';

  model: any = {
    admissionNumber: '',
    classId: '',
    sectionId: '',
    batchId: '',
    gender: 'Male',
    dateOfBirth: null
  };

  constructor(
    public dialogRef: MatDialogRef<ConvertEnquiryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    const e = this.data.enquiry;
    this.model.classId = e.interestedClassId || '';
    this.model.batchId = e.interestedBatchId || '';
    this.onClassSelect();
  }

  onClassSelect(): void {
    const c = this.data.classes?.find((x: any) => x.id === this.model.classId);
    this.availableSections = c?.sections || [];
    if (this.availableSections.length > 0) {
      this.model.sectionId = this.availableSections[0].id;
    }
  }

  confirmConvert(): void {
    this.converting = true;
    const payload = {
      admissionNumber: this.model.admissionNumber || null,
      classId: this.model.classId || null,
      sectionId: this.model.sectionId || null,
      batchId: this.model.batchId || null,
      gender: this.model.gender,
      dateOfBirth: this.dobStr ? this.dobStr + 'T00:00:00' : null
    };

    this.http.post(`${API_BASE}/enquiries/${this.data.enquiry.id}/convert`, payload).subscribe({
      next: (res: any) => {
        this.converting = false;
        this.dialogRef.close({
          studentName: this.data.enquiry.studentName,
          admissionNumber: res.admissionNumber
        });
      },
      error: (err: any) => {
        this.converting = false;
        this.confirmDialog.alert('Conversion Failed', err.error?.message || 'Failed to convert enquiry to admission.', 'danger');
      }
    });
  }
}
