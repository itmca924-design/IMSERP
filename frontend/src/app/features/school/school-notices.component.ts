import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
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
import { AuthService } from '../../core/services/auth.service';
import { TenantService, TenantDto } from '../../core/services/tenant.service';
import { BatchesService, BatchDto } from '../../core/services/batches.service';
import { environment } from '../../../environments/environment';
import { POSTER_ASSETS } from './poster-assets';
import html2canvas from 'html2canvas';

const API_BASE = environment.apiUrl;

export interface SchoolNoticeDto {
  id: string;
  tenantId: string;
  branchId?: string;
  noticeNumber: string;
  title: string;
  content: string;
  category: string;
  targetAudience: string;
  classId?: string;
  className?: string;
  batchId?: string;
  batchName?: string;
  batchShift?: string;
  priority: string;
  publishDate: string;
  expiryDate?: string;
  attachmentUrl?: string;
  isPinned: boolean;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoticeStatsDto {
  totalNotices: number;
  urgentNotices: number;
  pinnedNotices: number;
  activeCirculars: number;
  studentNotices: number;
  staffNotices: number;
}

@Component({
  selector: 'app-school-notices',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule, MatProgressBarModule,
    MatMenuModule, MatDividerModule
  ],
  template: `
    <div class="notices-page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>campaign</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Digital Notice Board & Circulars Hub</h1>
            <p class="page-subtitle">
              Publish and broadcast official school circulars, academic notices, urgent alerts, and event updates
            </p>
          </div>
        </div>

        <div class="header-actions">
          <button mat-raised-button class="create-btn" (click)="openNoticeDialog()">
            <mat-icon>post_add</mat-icon>
            <span>Publish Circular</span>
          </button>
          <button mat-stroked-button class="refresh-btn" (click)="loadNotices()" [disabled]="loading">
            <mat-icon [class.spin]="loading">refresh</mat-icon>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <!-- Stats Bar -->
      <div class="stats-grid">
        <div class="stat-card stat-total">
          <div class="stat-icon-wrap"><mat-icon>campaign</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{stats.totalNotices}}</span>
            <span class="stat-lbl">Total Circulars</span>
          </div>
        </div>

        <div class="stat-card stat-urgent">
          <div class="stat-icon-wrap"><mat-icon>crisis_alert</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{stats.urgentNotices}}</span>
            <span class="stat-lbl">Urgent Alerts</span>
          </div>
        </div>

        <div class="stat-card stat-pinned">
          <div class="stat-icon-wrap"><mat-icon>push_pin</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{stats.pinnedNotices}}</span>
            <span class="stat-lbl">Pinned to Top</span>
          </div>
        </div>

        <div class="stat-card stat-students">
          <div class="stat-icon-wrap"><mat-icon>groups</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{stats.studentNotices}}</span>
            <span class="stat-lbl">Student / Parent Broadcasts</span>
          </div>
        </div>
      </div>

      <!-- Controls & Filter Strip -->
      <div class="controls-card">
        <div class="filter-row">
          <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic">
            <mat-label>Category</mat-label>
            <mat-select [(ngModel)]="filterCategory" (selectionChange)="loadNotices()">
              <mat-option value="">All Categories</mat-option>
              <mat-option value="Weekly Exam Test">📝 Weekly Exam Test (साप्ताहिक परीक्षा)</mat-option>
              <mat-option value="Academic">📚 Academic</mat-option>
              <mat-option value="Administrative">🏛️ Administrative</mat-option>
              <mat-option value="Holiday">🌴 Holiday & Vacation</mat-option>
              <mat-option value="Examination">📝 Examination</mat-option>
              <mat-option value="Event">🎉 School Event</mat-option>
              <mat-option value="Fee Reminder">💰 Fee Reminder</mat-option>
              <mat-option value="Emergency">🚨 Emergency / Weather</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic">
            <mat-label>Target Audience</mat-label>
            <mat-select [(ngModel)]="filterAudience" (selectionChange)="onAudienceFilterChange()">
              <mat-option value="">All Audiences</mat-option>
              <mat-option value="All">👥 Everyone (All)</mat-option>
              <mat-option value="Students">🎓 Students & Parents</mat-option>
              <mat-option value="Teachers">👨‍🏫 Teachers & Staff</mat-option>
              <mat-option value="Parents">👨‍👩‍👦 Parents Only</mat-option>
              <mat-option value="SpecificClass">🏫 Specific Class</mat-option>
              <mat-option value="SpecificBatch">🎯 Coaching Batch (विशिष्ट बैच)</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic" *ngIf="filterAudience === 'SpecificClass' || filterAudience === 'SpecificBatch'">
            <mat-label>{{ filterAudience === 'SpecificBatch' ? 'Academic Class (कक्षा)' : 'Class' }}</mat-label>
            <mat-select [(ngModel)]="filterClassId" (selectionChange)="onClassFilterChange()">
              <mat-option value="">All Classes</mat-option>
              <mat-option *ngFor="let c of classes" [value]="c.id">{{c.name}}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic" *ngIf="filterAudience === 'SpecificBatch'">
            <mat-label>Coaching Batch</mat-label>
            <mat-select [(ngModel)]="filterBatchId" (selectionChange)="loadNotices()">
              <mat-option value="">All Batches</mat-option>
              <mat-option *ngFor="let b of filteredFilterBatches" [value]="b.id">
                {{b.name}} <span *ngIf="b.subject || b.courseName">({{b.subject || b.courseName}})</span>
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic">
            <mat-label>Priority</mat-label>
            <mat-select [(ngModel)]="filterPriority" (selectionChange)="loadNotices()">
              <mat-option value="">All Priorities</mat-option>
              <mat-option value="Urgent">🔥 Urgent Only</mat-option>
              <mat-option value="High">⚡ High Priority</mat-option>
              <mat-option value="Normal">ℹ️ Normal</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field search-field" subscriptSizing="dynamic">
            <mat-label>Search Title, Circular #, Words</mat-label>
            <input matInput [(ngModel)]="searchTerm" placeholder="Search..." (keyup.enter)="loadNotices()">
          </mat-form-field>

          <button mat-button class="chip-filter" [class.active-chip]="filterPinnedOnly" (click)="togglePinnedFilter()">
            <mat-icon>{{filterPinnedOnly ? 'push_pin' : 'push_pin'}}</mat-icon>
            <span>Pinned Only</span>
          </button>

          <div class="view-toggle">
            <button type="button" class="toggle-btn" [class.active-view]="viewMode==='grid'" (click)="viewMode='grid'" matTooltip="Notice Board Grid">
              <svg class="toggle-svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <rect x="3" y="3" width="8" height="8" rx="1.5" />
                <rect x="13" y="3" width="8" height="8" rx="1.5" />
                <rect x="3" y="13" width="8" height="8" rx="1.5" />
                <rect x="13" y="13" width="8" height="8" rx="1.5" />
              </svg>
            </button>
            <button type="button" class="toggle-btn" [class.active-view]="viewMode==='table'" (click)="viewMode='table'" matTooltip="Table List">
              <svg class="toggle-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="9" y1="6" x2="21" y2="6"></line>
                <line x1="9" y1="12" x2="21" y2="12"></line>
                <line x1="9" y1="18" x2="21" y2="18"></line>
                <circle cx="4.5" cy="6" r="1.5" fill="currentColor" stroke="none"></circle>
                <circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none"></circle>
                <circle cx="4.5" cy="18" r="1.5" fill="currentColor" stroke="none"></circle>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Connection Error Alert -->
      <div class="conn-error-banner" *ngIf="!loading && hasConnectionError">
        <div class="err-info">
          <mat-icon class="err-ic">cloud_off</mat-icon>
          <div class="err-text">
            <strong>Backend Connection Offline</strong>
            <span>Unable to reach backend API. If the server is restarting, please retry in a moment.</span>
          </div>
        </div>
        <button mat-raised-button class="retry-btn" (click)="loadNotices()">
          <mat-icon>refresh</mat-icon> Reconnect Now
        </button>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!loading && !hasConnectionError && filteredNotices.length === 0">
        <div class="empty-icon-wrap"><mat-icon>campaign</mat-icon></div>
        <h3>No Notices or Circulars Found</h3>
        <p>No circulars match your current filters. Click "Publish Circular" to issue your first official announcement.</p>
        <button mat-raised-button class="create-btn" (click)="openNoticeDialog()">
          <mat-icon>post_add</mat-icon> Issue First Notice
        </button>
      </div>

      <!-- NOTICE BOARD GRID VIEW -->
      <div class="notices-grid" *ngIf="!loading && viewMode==='grid' && filteredNotices.length > 0">
        <div class="notice-card" *ngFor="let n of filteredNotices" [class.pinned-card]="n.isPinned" [class.urgent-card]="n.priority === 'Urgent'">
          <!-- Pinned Ribbon -->
          <div class="pin-indicator" *ngIf="n.isPinned" matTooltip="Pinned to top of Notice Board">
            <mat-icon>push_pin</mat-icon>
            <span>PINNED</span>
          </div>

          <!-- Card Top Bar -->
          <div class="card-meta-top">
            <span class="cir-num">{{n.noticeNumber}}</span>
            <div class="badge-cluster">
              <span class="cat-pill">{{n.category}}</span>
              <span class="priority-pill" [ngClass]="n.priority.toLowerCase()">{{n.priority}}</span>
            </div>
          </div>

          <!-- Notice Title -->
          <h3 class="notice-title" (click)="viewNotice(n)">{{n.title}}</h3>

          <!-- Audience & Target -->
          <div class="audience-row">
            <span class="audience-chip" [ngClass]="getAudienceClass(n.targetAudience)">
              <mat-icon class="chip-ic">{{getAudienceIcon(n.targetAudience)}}</mat-icon>
              <span>{{getAudienceText(n)}}</span>
            </span>
          </div>

          <!-- Snippet -->
          <p class="notice-snippet">{{getDisplayContent(n)}}</p>

          <!-- Attachment tag -->
          <div class="attachment-line" *ngIf="n.attachmentUrl">
            <mat-icon class="ic-att">attach_file</mat-icon>
            <a [href]="n.attachmentUrl" target="_blank" class="att-link">View Attached Circular Document</a>
          </div>

          <!-- Dates Bar -->
          <div class="dates-bar">
            <div class="date-item">
              <mat-icon class="ic-date">schedule</mat-icon>
              <span>Published: <strong>{{formatToIST(n.publishDate)}}</strong></span>
            </div>
            <div class="date-item expiry" *ngIf="n.expiryDate">
              <mat-icon class="ic-date">event_busy</mat-icon>
              <span>Expires: <strong>{{n.expiryDate | date:'dd MMM yyyy'}}</strong></span>
            </div>
          </div>

          <!-- Card Action Footer -->
          <div class="card-footer">
            <div class="card-footer-btns">
              <button mat-stroked-button class="view-btn" (click)="viewNotice(n)">
                <mat-icon>visibility</mat-icon>
                <span>View Circular</span>
              </button>
              <button mat-stroked-button class="wa-btn" (click)="shareNoticeWhatsApp(n)" matTooltip="Share on WhatsApp">
                <mat-icon class="wa-icon">chat</mat-icon>
                <span>WhatsApp</span>
              </button>
            </div>

            <div class="card-actions">
              <button mat-icon-button (click)="togglePin(n)" [matTooltip]="n.isPinned ? 'Unpin Notice' : 'Pin to Top'" [class.pinned-active]="n.isPinned">
                <mat-icon class="card-action-ic">{{n.isPinned ? 'push_pin' : 'push_pin'}}</mat-icon>
              </button>
              <button mat-icon-button (click)="openNoticeDialog(n)" matTooltip="Edit Circular">
                <mat-icon class="card-action-ic edit">edit</mat-icon>
              </button>
              <button mat-icon-button (click)="deleteNotice(n)" matTooltip="Delete">
                <mat-icon class="card-action-ic delete">delete</mat-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- TABLE VIEW -->
      <div class="notices-table-wrap" *ngIf="!loading && viewMode==='table' && filteredNotices.length > 0">
        <table class="notices-table">
          <thead>
            <tr>
              <th>Cir #</th>
              <th>Title & Subject</th>
              <th>Category</th>
              <th>Audience</th>
              <th>Priority</th>
              <th>Publish Date (IST)</th>
              <th>Expiry</th>
              <th>Pinned</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let n of filteredNotices" [class.pinned-tr]="n.isPinned">
              <td><strong>{{n.noticeNumber}}</strong></td>
              <td>
                <div class="tbl-title" (click)="viewNotice(n)">{{n.title}}</div>
                <div class="tbl-sub">{{getDisplayContent(n) | slice:0:70}}...</div>
              </td>
              <td><span class="cat-pill">{{n.category}}</span></td>
              <td>
                <span class="audience-chip" [ngClass]="getAudienceClass(n.targetAudience)">
                  {{getAudienceText(n)}}
                </span>
              </td>
              <td><span class="priority-pill" [ngClass]="n.priority.toLowerCase()">{{n.priority}}</span></td>
              <td><strong>{{formatToIST(n.publishDate)}}</strong></td>
              <td>{{n.expiryDate ? (n.expiryDate | date:'dd MMM yyyy') : '—'}}</td>
              <td>
                <mat-icon *ngIf="n.isPinned" style="color:#d97706; font-size:18px;">push_pin</mat-icon>
                <span *ngIf="!n.isPinned" style="color:#94a3b8;">—</span>
              </td>
              <td>
                <div class="tbl-actions">
                  <button mat-icon-button (click)="viewNotice(n)" matTooltip="View Full Circular">
                    <mat-icon class="card-action-ic view">visibility</mat-icon>
                  </button>
                  <button mat-icon-button (click)="shareNoticeWhatsApp(n)" matTooltip="Share on WhatsApp" class="wa-tbl-btn">
                    <mat-icon class="card-action-ic wa-ic">chat</mat-icon>
                  </button>
                  <button mat-icon-button (click)="togglePin(n)" [matTooltip]="n.isPinned ? 'Unpin' : 'Pin to Top'">
                    <mat-icon class="card-action-ic" [style.color]="n.isPinned ? '#d97706' : '#64748b'">push_pin</mat-icon>
                  </button>
                  <button mat-icon-button (click)="openNoticeDialog(n)" matTooltip="Edit">
                    <mat-icon class="card-action-ic edit">edit</mat-icon>
                  </button>
                  <button mat-icon-button (click)="deleteNotice(n)" matTooltip="Delete">
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
    .notices-page-container { padding: 0 0 40px; display: flex; flex-direction: column; gap: 20px; box-sizing: border-box; width: 100%; }
    .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; background: #fff; padding: 20px 24px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-icon-box { background: #2563eb; color: #fff; border-radius: 12px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); }
    .header-icon-box mat-icon { font-size: 26px; width: 26px; height: 26px; }
    .page-title { margin: 0; font-size: 20px; font-weight: 800; color: #1e3a8a; }
    .page-subtitle { margin: 4px 0 0; font-size: 13px; color: #64748b; }
    .header-actions { display: flex; align-items: center; gap: 10px; }
    .refresh-btn { color: #475569; }
    .create-btn { background: #2563eb !important; color: #fff !important; font-weight: 700; border-radius: 8px; }
    .spin { animation: spin 1s infinite linear; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; width: 100%; box-sizing: border-box; }
    .stat-card { background: #fff; border-radius: 12px; padding: 18px 20px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 16px; min-width: 0; }
    .stat-icon-wrap { width: 46px; height: 46px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .stat-icon-wrap mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .stat-total .stat-icon-wrap { background: #eff6ff; color: #2563eb; }
    .stat-urgent .stat-icon-wrap { background: #fef2f2; color: #dc2626; }
    .stat-pinned .stat-icon-wrap { background: #fffbeb; color: #d97706; }
    .stat-students .stat-icon-wrap { background: #ecfdf5; color: #059669; }
    .stat-info { min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
    .stat-val { font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1; }
    .stat-lbl { font-size: 12px; color: #64748b; margin-top: 4px; display: block; font-weight: 600; line-height: 1.25; word-break: break-word; }

    /* Controls Strip */
    .controls-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .filter-row { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
    .filter-field { width: 170px; }
    .search-field { flex: 1; min-width: 220px; }
    .chip-filter { border: 1px solid #cbd5e1; border-radius: 8px; color: #64748b; font-weight: 600; height: 42px; display: flex; align-items: center; gap: 6px; }
    .chip-filter.active-chip { background: #fffbeb; border-color: #f59e0b; color: #b45309; }
    .view-toggle { 
      display: inline-flex; 
      align-items: center; 
      gap: 3px; 
      background: #f8fafc; 
      border: 1.5px solid #94a3b8; 
      border-radius: 8px; 
      padding: 3px; 
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    .toggle-btn { 
      width: 34px !important; 
      height: 34px !important; 
      min-width: 34px !important; 
      padding: 0 !important; 
      margin: 0 !important;
      display: inline-flex !important; 
      align-items: center !important; 
      justify-content: center !important; 
      border-radius: 6px !important; 
      border: 1px solid transparent !important;
      background: transparent;
      color: #334155; 
      cursor: pointer;
      transition: all 0.15s ease-in-out;
    }
    .toggle-btn:hover:not(.active-view) {
      background: #e2e8f0;
      color: #0f172a;
    }
    .toggle-btn.active-view { 
      background: #2563eb !important; 
      color: #ffffff !important; 
      border-color: #1d4ed8 !important;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.35) !important; 
    }
    .toggle-svg {
      display: block;
      width: 18px;
      height: 18px;
    }

    /* Notice Grid */
    .notices-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }
    .notice-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 10px; position: relative; transition: transform 0.15s, box-shadow 0.15s; }
    .notice-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.08); border-color: #cbd5e1; }
    .pinned-card { border-color: #fde68a; background: #fffdfa; }
    .urgent-card { border-left: 4px solid #dc2626; }
    .pin-indicator { position: absolute; top: -8px; right: 16px; background: #d97706; color: #fff; font-size: 9.5px; font-weight: 800; padding: 2px 8px; border-radius: 10px; display: flex; align-items: center; gap: 3px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); }
    .pin-indicator mat-icon { font-size: 11px; width: 11px; height: 11px; }

    .card-meta-top { display: flex; justify-content: space-between; align-items: center; }
    .cir-num { font-size: 11px; font-weight: 800; color: #64748b; letter-spacing: 0.5px; }
    .badge-cluster { display: flex; align-items: center; gap: 6px; }
    .cat-pill { font-size: 10px; font-weight: 700; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; border: 1px solid #e2e8f0; }
    .priority-pill { font-size: 9.5px; font-weight: 800; padding: 2px 7px; border-radius: 4px; text-transform: uppercase; }
    .priority-pill.urgent { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .priority-pill.high { background: #fffbeb; color: #d97706; border: 1px solid #fef3c7; }
    .priority-pill.normal { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }

    .notice-title { margin: 2px 0 0; font-size: 16px; font-weight: 800; color: #0f172a; cursor: pointer; line-height: 1.35; }
    .notice-title:hover { color: #2563eb; text-decoration: underline; }

    .audience-row { display: flex; align-items: center; }
    .audience-chip { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px; }
    .chip-ic { font-size: 13px; width: 13px; height: 13px; }
    .aud-all { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .aud-students { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
    .aud-teachers { background: #faf5ff; color: #6b21a8; border: 1px solid #e9d5ff; }
    .aud-parents { background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; }
    .aud-class { background: #fefce8; color: #854d0e; border: 1px solid #fef08a; }
    .aud-batch { background: #fdf2f8; color: #9d174d; border: 1px solid #fbcfe8; }

    .notice-snippet { margin: 0; font-size: 13px; color: #475569; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

    .attachment-line { display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: #2563eb; background: #eff6ff; padding: 4px 8px; border-radius: 6px; border: 1px solid #bfdbfe; }
    .ic-att { font-size: 14px; width: 14px; height: 14px; color: #2563eb; }
    .att-link { color: #2563eb; text-decoration: none; font-weight: 600; }
    .att-link:hover { text-decoration: underline; }

    .dates-bar { display: flex; flex-direction: column; gap: 4px; background: #f8fafc; padding: 6px 10px; border-radius: 6px; font-size: 11px; color: #64748b; }
    .date-item { display: flex; align-items: center; gap: 6px; }
    .ic-date { font-size: 13px; width: 13px; height: 13px; color: #94a3b8; }
    .date-item.expiry { color: #dc2626; }

    .card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 10px; margin-top: 2px; }
    .card-footer-btns { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .view-btn { font-size: 11.5px; font-weight: 700; height: 30px; line-height: 30px; padding: 0 10px; border-color: #cbd5e1; color: #1e3a8a; }
    .view-btn mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 4px; }
    .wa-btn {
      font-size: 11.5px;
      font-weight: 700;
      height: 30px;
      line-height: 30px;
      padding: 0 10px;
      border-color: #86efac !important;
      color: #15803d !important;
      background: #f0fdf4 !important;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .wa-btn:hover { background: #dcfce7 !important; border-color: #22c55e !important; }
    .wa-btn mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 2px; color: #16a34a; }
    .card-actions { display: flex; align-items: center; gap: 4px; }
    .card-actions button[mat-icon-button] { width: 28px !important; height: 28px !important; min-width: 28px !important; padding: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; }
    .card-action-ic { font-size: 16px !important; width: 16px !important; height: 16px !important; line-height: 16px !important; margin: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; color: #64748b; }
    .card-action-ic.edit { color: #2563eb; }
    .card-action-ic.delete { color: #ef4444; }
    .card-action-ic.view { color: #059669; }
    .card-action-ic.wa-ic { color: #16a34a !important; }
    .pinned-active { color: #d97706 !important; }

    /* Table styles */
    .notices-table-wrap { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .notices-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    .notices-table th { background: #f8fafc; color: #475569; font-weight: 700; padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .notices-table td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: middle; }
    .notices-table tr:hover { background: #f8fafc; }
    .pinned-tr { background: #fffdfa; }
    .tbl-title { font-weight: 700; color: #0f172a; cursor: pointer; }
    .tbl-title:hover { color: #2563eb; text-decoration: underline; }
    .tbl-sub { font-size: 11px; color: #64748b; }
    .tbl-actions { display: flex; align-items: center; gap: 4px; }

    /* Connection Error State */
    .conn-error-banner { background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 12px; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.06); }
    .err-info { display: flex; align-items: center; gap: 14px; }
    .err-ic { font-size: 32px; width: 32px; height: 32px; color: #dc2626; }
    .err-text { display: flex; flex-direction: column; gap: 2px; }
    .err-text strong { font-size: 15px; color: #991b1b; }
    .err-text span { font-size: 13px; color: #b91c1c; }
    .retry-btn { background: #dc2626 !important; color: #fff !important; font-weight: 700; border-radius: 8px; }

    /* Responsive Media Queries */
    @media (max-width: 1024px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
    }

    @media (max-width: 768px) {
      .notices-page-container { padding: 0 0 40px; gap: 14px; }
      .page-header { padding: 14px 16px; flex-direction: column; align-items: stretch; gap: 12px; }
      .header-actions { width: 100%; display: flex; flex-direction: row; align-items: center; gap: 8px; }
      .filter-row { flex-direction: column; align-items: stretch; gap: 12px; }
      .filter-field, .search-field { flex: none !important; width: 100% !important; min-width: 100% !important; margin-bottom: 0; }
      .controls-card { padding: 14px; }
      .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; width: 100%; box-sizing: border-box; }
      .stat-card { padding: 10px 10px; gap: 8px; border-radius: 10px; min-width: 0; box-sizing: border-box; }
      .stat-icon-wrap { width: 34px; height: 34px; min-width: 34px; border-radius: 8px; flex-shrink: 0; mat-icon { font-size: 18px; width: 18px; height: 18px; } }
      .stat-info { min-width: 0; overflow: hidden; }
      .stat-val { font-size: 1.2rem; font-weight: 800; line-height: 1; }
      .stat-lbl { font-size: 0.65rem; margin-top: 2px; line-height: 1.2; word-break: break-word; }
      .notices-grid { grid-template-columns: 1fr; gap: 12px; }
      .notices-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .notices-table { min-width: 820px; }
      .notices-table th { white-space: nowrap; }
      .dates-bar { font-size: 12px; }
    }

    @media (max-width: 640px) {
      .header-left {
        gap: 10px;
        width: 100%;
        box-sizing: border-box;
      }

      .header-icon-box {
        width: 38px;
        height: 38px;
        min-width: 38px;
        border-radius: 10px;
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }

      .page-title {
        font-size: 1.15rem;
        line-height: 1.25;
      }

      .page-subtitle {
        font-size: 0.72rem;
        line-height: 1.25;
        margin-top: 2px;
      }

      .create-btn {
        flex: 1 1 auto;
        width: auto !important;
        justify-content: center;
        font-size: 0.8rem;
        height: 38px;
        font-weight: 600;
        border-radius: 8px;
        padding: 0 12px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; }
        span { white-space: nowrap; }
      }

      .refresh-btn {
        position: static !important;
        flex: 0 0 38px !important;
        min-width: 38px !important;
        width: 38px !important;
        max-width: 38px !important;
        height: 38px !important;
        padding: 0 !important;
        border-radius: 8px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: #f1f5f9 !important;
        border: 1px solid #e2e8f0 !important;
        span { display: none !important; }
        mat-icon { margin: 0 !important; font-size: 20px !important; width: 20px !important; height: 20px !important; }
      }

      .chip-filter {
        width: 100%;
        justify-content: center;
      }

      .view-toggle {
        align-self: flex-start;
      }
    }
  `]
})
export class SchoolNoticesComponent implements OnInit {
  notices: SchoolNoticeDto[] = [];
  classes: any[] = [];
  batches: BatchDto[] = [];
  loading = false;
  hasConnectionError = false;
  viewMode: 'grid' | 'table' = 'grid';

  filterCategory = '';
  filterAudience = '';
  filterClassId = '';
  filterBatchId = '';
  filterPriority = '';
  searchTerm = '';
  filterPinnedOnly = false;

  stats: NoticeStatsDto = {
    totalNotices: 0,
    urgentNotices: 0,
    pinnedNotices: 0,
    activeCirculars: 0,
    studentNotices: 0,
    staffNotices: 0
  };

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
    private batchesService: BatchesService,
    public authService: AuthService
  ) {}

  formatToIST(dateVal: string | Date | undefined): string {
    if (!dateVal) return '—';
    try {
      let s = String(dateVal);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        s += 'T00:00:00';
      }
      const d = new Date(s);
      if (isNaN(d.getTime())) return String(dateVal);

      const formatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      const parts = formatter.formatToParts(d);
      let day = '', month = '', year = '', hour = '', minute = '', dayPeriod = '';
      for (const p of parts) {
        if (p.type === 'day') day = p.value;
        else if (p.type === 'month') month = p.value.slice(0, 3);
        else if (p.type === 'year') year = p.value;
        else if (p.type === 'hour') hour = p.value;
        else if (p.type === 'minute') minute = p.value;
        else if (p.type === 'dayPeriod') dayPeriod = p.value.toUpperCase();
      }
      return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod} IST`;
    } catch {
      return String(dateVal);
    }
  }

  ngOnInit(): void {
    this.loadClasses();
    this.loadBatches();
    this.loadNotices();
  }

  get filteredFilterBatches(): BatchDto[] {
    if (!this.filterClassId) return this.batches;
    return this.batches.filter(b => b.classId === this.filterClassId || !b.classId);
  }

  onClassFilterChange(): void {
    if (this.filterAudience === 'SpecificBatch') {
      this.filterBatchId = '';
    }
    this.loadNotices();
  }

  loadClasses(): void {
    this.http.get<any[]>(`${API_BASE}/school/classes`).subscribe({
      next: r => this.classes = r,
      error: () => this.classes = []
    });
  }

  loadBatches(): void {
    this.batchesService.getBatches().subscribe({
      next: b => this.batches = b || [],
      error: () => this.batches = []
    });
  }

  onAudienceFilterChange(): void {
    this.filterClassId = '';
    this.filterBatchId = '';
    this.loadNotices();
  }

  loadStats(): void {
    this.http.get<NoticeStatsDto>(`${API_BASE}/notices/stats`).subscribe({
      next: s => this.stats = s,
      error: () => {}
    });
  }

  loadNotices(): void {
    this.loading = true;
    let url = `${API_BASE}/notices`;
    const params: string[] = [];
    if (this.filterCategory) params.push(`category=${encodeURIComponent(this.filterCategory)}`);
    if (this.filterAudience) params.push(`targetAudience=${encodeURIComponent(this.filterAudience)}`);
    if (this.filterClassId) params.push(`classId=${this.filterClassId}`);
    if (this.filterBatchId) params.push(`batchId=${this.filterBatchId}`);
    if (this.filterPriority) params.push(`priority=${encodeURIComponent(this.filterPriority)}`);
    if (this.filterPinnedOnly) params.push(`isPinned=true`);
    if (this.searchTerm.trim()) params.push(`search=${encodeURIComponent(this.searchTerm.trim())}`);
    if (params.length > 0) url += '?' + params.join('&');

    this.http.get<SchoolNoticeDto[]>(url).subscribe({
      next: r => {
        this.notices = r;
        this.loading = false;
        this.hasConnectionError = false;
        this.loadStats();
      },
      error: () => {
        this.notices = [];
        this.loading = false;
        this.hasConnectionError = true;
      }
    });
  }

  get filteredNotices(): SchoolNoticeDto[] {
    return this.notices;
  }

  togglePinnedFilter(): void {
    this.filterPinnedOnly = !this.filterPinnedOnly;
    this.loadNotices();
  }

  togglePin(n: SchoolNoticeDto): void {
    this.http.put<any>(`${API_BASE}/notices/${n.id}/pin`, {}).subscribe({
      next: res => {
        n.isPinned = res.isPinned;
        this.loadNotices();
      },
      error: () => this.confirmDialog.alert('Error', 'Failed to update pin status.', 'danger')
    });
  }

  getAudienceClass(aud: string): string {
    switch (aud) {
      case 'All': return 'aud-all';
      case 'Students': return 'aud-students';
      case 'Teachers': return 'aud-teachers';
      case 'Parents': return 'aud-parents';
      case 'SpecificClass': return 'aud-class';
      case 'SpecificBatch': return 'aud-batch';
      default: return 'aud-all';
    }
  }

  getAudienceIcon(aud: string): string {
    switch (aud) {
      case 'All': return 'groups';
      case 'Students': return 'school';
      case 'Teachers': return 'person_outline';
      case 'Parents': return 'family_restroom';
      case 'SpecificClass': return 'meeting_room';
      case 'SpecificBatch': return 'class';
      default: return 'groups';
    }
  }

  getAudienceText(n: SchoolNoticeDto): string {
    if (n.targetAudience === 'SpecificClass') {
      return n.className ? `Class: ${n.className}` : 'Specific Class';
    }
    if (n.targetAudience === 'SpecificBatch') {
      return n.batchName ? `Batch: ${n.batchName}` : 'Coaching Batch';
    }
    switch (n.targetAudience) {
      case 'All': return 'Everyone (All)';
      case 'Students': return 'Students & Parents';
      case 'Teachers': return 'Teachers & Staff';
      case 'Parents': return 'Parents Only';
      default: return n.targetAudience;
    }
  }

  viewNotice(item: SchoolNoticeDto): void {
    this.dialog.open(ViewNoticeDialogComponent, {
      width: '980px',
      maxWidth: '96vw',
      panelClass: 'no-overflow-dialog',
      autoFocus: false,
      data: { notice: item }
    });
  }

  getDisplayContent(n: SchoolNoticeDto): string {
    if (!n) return '';
    const c = (n.content || '').trim();
    const t = (n.title || '').trim();
    if (!c || c.toLowerCase() === t.toLowerCase() || (c.length < 25 && (c.toLowerCase().includes('exam') || c.toLowerCase().includes('test')))) {
      return 'सभी छात्र-छात्राएँ निर्धारित तिथि को अपने-अपने कक्ष में समय पर उपस्थित रहें और पूर्ण तैयारी के साथ परीक्षा में शामिल हों।';
    }
    return n.content;
  }

  shareNoticeWhatsApp(n: SchoolNoticeDto): void {
    const institute = this.authService.getInstituteName() || this.authService.currentUser()?.instituteName || 'Institution';
    const dateStr = n.publishDate ? n.publishDate.slice(0, 10) : '';
    let batchDisplay = n.batchName || (n.targetAudience === 'SpecificClass' ? (n.className || 'Class Students') : 'All Students');
    if (n.batchName && !n.batchName.toLowerCase().includes('shift')) {
      if (/morning/i.test(n.batchName)) batchDisplay += ' (Morning Shift)';
      else if (/evening/i.test(n.batchName)) batchDisplay += ' (Evening Shift)';
      else if (/afternoon/i.test(n.batchName)) batchDisplay += ' (Afternoon Shift)';
    }

    const userName = this.authService.currentUser()?.fullName;
    const signOff = userName ? `${userName} (Academic Notice Desk)` : 'Academic Notice Desk';
    const bodyContent = this.getDisplayContent(n);

    const text =
`📢 *NOTICE* - ${institute.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━
👥 *Dear Student* : प्रिय विद्यार्थियों,
🏫 *Batch* : ${batchDisplay}
📝 *Subject* : ${n.title || 'Notice'}
📅 *Date* : ${dateStr}
━━━━━━━━━━━━━━━━━━━━━━
👉 *${bodyContent}*

🌸 *Thank You*
— ${signOff}`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  openNoticeDialog(item?: SchoolNoticeDto): void {
    const ref = this.dialog.open(NoticeFormDialogComponent, {
      width: '940px',
      maxWidth: '96vw',
      panelClass: 'no-overflow-dialog',
      disableClose: false,
      autoFocus: false,
      data: {
        notice: item,
        classes: this.classes,
        batches: this.batches
      }
    });

    ref.afterClosed().subscribe((res: any) => {
      if (!res) return;
      this.loadNotices();
      if (res.action === 'created') {
        this.confirmDialog.alert(
          'Circular Published 🎉',
          `Notice #${res.noticeNumber} "${res.title}" published successfully!`,
          'success'
        );
      } else if (res.action === 'updated') {
        this.confirmDialog.alert(
          'Notice Updated 🎉',
          `Notice "${res.title}" updated successfully!`,
          'success'
        );
      }
    });
  }

  deleteNotice(n: SchoolNoticeDto): void {
    this.confirmDialog.confirm(
      'Delete Notice Circular',
      `Are you sure you want to permanently delete circular #${n.noticeNumber} "${n.title}"?`,
      'Delete Circular',
      'Cancel',
      'danger'
    ).subscribe(ok => {
      this.http.delete(`${API_BASE}/notices/${n.id}`).subscribe({
        next: () => {
          this.loadNotices();
          this.confirmDialog.alert('Circular Deleted', 'The notice record has been removed.', 'success');
        },
        error: () => this.confirmDialog.alert('Error', 'Failed to delete notice.', 'danger')
      });
    });
  }
}

// =========================================================================
// Create / Edit Notice Form Dialog (Strict AGENTS.md light-blue header)
// =========================================================================

@Component({
  selector: 'app-notice-form-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule
  ],
  template: `
    <div class="notice-dialog-wrap">
      <!-- Strict AGENTS.md Light-Blue Gradient Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box" [class.weekly-icon]="form.get('category')?.value === 'Weekly Exam Test'">
            <mat-icon>{{ form.get('category')?.value === 'Weekly Exam Test' ? 'assignment_turned_in' : (isEdit ? 'edit_note' : 'post_add') }}</mat-icon>
          </div>
          <div class="header-titles">
            <h2 class="modal-title">
              {{ isEdit ? 'Edit School Circular' : (form.get('category')?.value === 'Weekly Exam Test' ? 'Publish Weekly Exam Test Notice' : 'Publish New Circular / Notice') }}
            </h2>
            <p class="modal-subtitle">
              <strong style="color:#1e40af">{{ isEdit ? editNoticeNumber : (form.get('category')?.value === 'Weekly Exam Test' ? 'Weekly Coaching Test' : 'Official Institutional Notice') }}</strong>
              <span> &bull; {{ form.get('category')?.value === 'Weekly Exam Test' ? 'Broadcast weekly test schedule with batch & shift' : 'Broadcast academic & admin announcements' }}</span>
            </p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close(false)" class="close-btn" type="button" matTooltip="Close (Esc)">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Form Body with Reactive Forms -->
      <form [formGroup]="form" (ngSubmit)="saveNotice()" class="dialog-form-container">
        <div class="modal-body">
          <!-- Notice Title -->
          <mat-form-field appearance="outline" class="full-field">
            <mat-label>Notice / Circular Title (परिपत्र का शीर्षक) *</mat-label>
            <input matInput formControlName="title" placeholder="e.g. Weekly Test Exam (साप्ताहिक परीक्षा) / Term 1 Schedule" />
            <mat-icon matSuffix color="primary">title</mat-icon>
            <mat-error *ngIf="form.get('title')?.hasError('required')">Notice title is required</mat-error>
          </mat-form-field>

          <!-- 3-Column Grid: Category, Priority, Target Audience -->
          <div class="form-grid-3">
            <mat-form-field appearance="outline" class="form-field">
              <mat-label>Notice Category *</mat-label>
              <mat-select formControlName="category" (selectionChange)="onCategoryChange()">
                <mat-option value="Weekly Exam Test">📝 Weekly Exam Test (साप्ताहिक परीक्षा)</mat-option>
                <mat-option value="Academic">📚 Academic</mat-option>
                <mat-option value="Administrative">🏛️ Administrative</mat-option>
                <mat-option value="Holiday">🌴 Holiday & Vacation</mat-option>
                <mat-option value="Examination">📝 Examination</mat-option>
                <mat-option value="Event">🎉 School Event</mat-option>
                <mat-option value="Fee Reminder">💰 Fee Reminder</mat-option>
                <mat-option value="Emergency">🚨 Emergency / Weather Alert</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="form-field">
              <mat-label>Priority Level</mat-label>
              <mat-select formControlName="priority">
                <mat-option value="Urgent">🔥 Urgent Announcement</mat-option>
                <mat-option value="High">⚡ High Priority</mat-option>
                <mat-option value="Normal">ℹ️ Normal</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="form-field">
              <mat-label>Target Audience (लक्षित समूह) *</mat-label>
              <mat-select formControlName="targetAudience" (selectionChange)="onAudienceSelect()">
                <mat-option value="SpecificBatch">🎯 Coaching Batch (विशिष्ट बैच)</mat-option>
                <mat-option value="SpecificClass">🏫 Specific School Class</mat-option>
                <mat-option value="All">👥 Everyone (Students, Parents & Staff)</mat-option>
                <mat-option value="Students">🎓 Students & Parents</mat-option>
                <mat-option value="Teachers">👨‍🏫 Teaching Faculty & Staff</mat-option>
                <mat-option value="Parents">👨‍👩‍👦 Parents Only</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- School Class Selection (when SpecificClass) -->
          <div class="full-field" *ngIf="form.get('targetAudience')?.value === 'SpecificClass'">
            <mat-form-field appearance="outline" class="full-field">
              <mat-label>Select School Class *</mat-label>
              <mat-select formControlName="classId" (selectionChange)="onClassSelect()">
                <mat-option *ngFor="let c of classesList" [value]="c.id">{{ c.name }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Coaching Batch Scope & Selector Deck (when SpecificBatch) -->
          <div class="batch-scope-toggle-deck" *ngIf="form.get('targetAudience')?.value === 'SpecificBatch'">
            <div class="scope-deck-header">
              <div class="scope-deck-left">
                <mat-icon class="deck-icon">tune</mat-icon>
                <span class="scope-deck-title">Batch Architecture / Scope (बैच का प्रकार):</span>
              </div>
              <span class="scope-deck-hint">Filter batches by single class or combined foundation groups</span>
            </div>

            <div class="scope-toggle-pills">
              <button
                type="button"
                class="scope-pill-btn"
                [class.active]="batchScope === 'single'"
                (click)="setBatchScope('single')"
              >
                <mat-icon>school</mat-icon>
                <div class="pill-texts">
                  <span class="pill-main">Single Class Batch (एकल कक्षा)</span>
                  <span class="pill-sub">Specific Class (e.g. Class 5th Special)</span>
                </div>
              </button>

              <button
                type="button"
                class="scope-pill-btn"
                [class.active]="batchScope === 'combined'"
                (click)="setBatchScope('combined')"
              >
                <mat-icon>layers</mat-icon>
                <div class="pill-texts">
                  <span class="pill-main">Combined / Multi-Class (संयुक्त कक्षा)</span>
                  <span class="pill-sub">Foundation (1st to 5th Combined)</span>
                </div>
              </button>

              <button
                type="button"
                class="scope-pill-btn"
                [class.active]="batchScope === 'all'"
                (click)="setBatchScope('all')"
              >
                <mat-icon>view_list</mat-icon>
                <div class="pill-texts">
                  <span class="pill-main">All Batches (सभी बैच)</span>
                  <span class="pill-sub">Consolidated View</span>
                </div>
              </button>
            </div>

            <!-- Selection Controls Row -->
            <!-- In Single Class Mode: Academic Class selector first! -->
            <div class="scope-selection-grid" *ngIf="batchScope === 'single'">
              <mat-form-field appearance="outline" class="form-field">
                <mat-label>Academic Class (कक्षा चुनें) *</mat-label>
                <mat-select [formControl]="filterCoachingClassCtrl" (selectionChange)="onCoachingClassChange()" panelClass="notice-batch-select-panel" [panelWidth]="null">
                  <mat-option *ngIf="activeClasses.length === 0" disabled>
                    No classes with coaching batches found
                  </mat-option>
                  <mat-option *ngFor="let c of activeClasses" [value]="c.id">
                    {{ c.name }}
                  </mat-option>
                </mat-select>
                <mat-hint *ngIf="!filterCoachingClassCtrl.value">Select class to view its coaching batches</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" class="form-field">
                <mat-label>Select Coaching Batch *</mat-label>
                <mat-select formControlName="batchId" (selectionChange)="onBatchSelect()" panelClass="notice-batch-select-panel" [panelWidth]="null">
                  <mat-option *ngIf="availableBatches.length === 0" disabled>
                    {{ !filterCoachingClassCtrl.value ? 'Please choose class first' : 'No coaching batches found for selected class' }}
                  </mat-option>
                  <mat-option *ngFor="let b of availableBatches" [value]="b.id">
                    <div class="batch-opt-item">
                      <span class="b-opt-name">{{ b.name }}</span>
                      <div class="b-opt-tags">
                        <span class="shift-pill" [ngClass]="getBatchShift(b).toLowerCase()" *ngIf="getBatchShift(b)">
                          {{ getBatchShift(b) === 'Morning' ? '☀️' : (getBatchShift(b) === 'Evening' ? '🌇' : '🕒') }} {{ getBatchShift(b) }} Shift
                        </span>
                        <span class="scope-tag" [ngClass]="isCombinedBatch(b) ? 'is-comb' : 'is-single'">
                          {{ isCombinedBatch(b) ? 'Combined' : 'Single' }}
                        </span>
                      </div>
                    </div>
                  </mat-option>
                </mat-select>
                <mat-hint *ngIf="selectedBatchDisplay">Selected: <strong>{{ selectedBatchDisplay }}</strong></mat-hint>
              </mat-form-field>
            </div>

            <!-- In Combined Mode: Info Banner + Combined Batches -->
            <div class="scope-selection-combined" *ngIf="batchScope === 'combined'">
              <div class="combined-info-pill">
                <mat-icon>info</mat-icon>
                <span>Showing combined foundation batches covering multi-class ranges</span>
              </div>

              <mat-form-field appearance="outline" class="full-field">
                <mat-label>Select Combined Batch *</mat-label>
                <mat-select formControlName="batchId" (selectionChange)="onBatchSelect()" panelClass="notice-batch-select-panel" [panelWidth]="null">
                  <mat-option *ngIf="availableBatches.length === 0" disabled>
                    No combined batches found
                  </mat-option>
                  <mat-option *ngFor="let b of availableBatches" [value]="b.id">
                    <div class="batch-opt-item">
                      <span class="b-opt-name">{{ b.name }}</span>
                      <div class="b-opt-tags">
                        <span class="shift-pill" [ngClass]="getBatchShift(b).toLowerCase()" *ngIf="getBatchShift(b)">
                          {{ getBatchShift(b) === 'Morning' ? '☀️' : (getBatchShift(b) === 'Evening' ? '🌇' : '🕒') }} {{ getBatchShift(b) }} Shift
                        </span>
                        <span class="scope-tag is-comb">Combined</span>
                      </div>
                    </div>
                  </mat-option>
                </mat-select>
                <mat-hint *ngIf="selectedBatchDisplay">Selected: <strong>{{ selectedBatchDisplay }}</strong></mat-hint>
              </mat-form-field>
            </div>

            <!-- In All Batches Mode -->
            <div class="scope-selection-all" *ngIf="batchScope === 'all'">
              <mat-form-field appearance="outline" class="full-field">
                <mat-label>Select Any Coaching Batch *</mat-label>
                <mat-select formControlName="batchId" (selectionChange)="onBatchSelect()" panelClass="notice-batch-select-panel" [panelWidth]="null">
                  <mat-option *ngIf="availableBatches.length === 0" disabled>
                    No coaching batches available
                  </mat-option>
                  <mat-option *ngFor="let b of availableBatches" [value]="b.id">
                    <div class="batch-opt-item">
                      <span class="b-opt-name">{{ b.name }}</span>
                      <div class="b-opt-tags">
                        <span class="shift-pill" [ngClass]="getBatchShift(b).toLowerCase()" *ngIf="getBatchShift(b)">
                          {{ getBatchShift(b) === 'Morning' ? '☀️' : (getBatchShift(b) === 'Evening' ? '🌇' : '🕒') }} {{ getBatchShift(b) }} Shift
                        </span>
                        <span class="scope-tag" [ngClass]="isCombinedBatch(b) ? 'is-comb' : 'is-single'">
                          {{ isCombinedBatch(b) ? 'Combined' : 'Single' }}
                        </span>
                      </div>
                    </div>
                  </mat-option>
                </mat-select>
                <mat-hint *ngIf="selectedBatchDisplay">Selected: <strong>{{ selectedBatchDisplay }}</strong></mat-hint>
              </mat-form-field>
            </div>
          </div>

          <!-- Dates Row (Publish Date, Time, Expiry Date) -->
          <div class="form-grid-dates">
            <mat-form-field appearance="outline" class="form-field">
              <mat-label>Publish Date *</mat-label>
              <input matInput type="date" formControlName="publishDate" (change)="validateDates()" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="form-field">
              <mat-label>Publish Time (IST)</mat-label>
              <input matInput type="time" formControlName="publishTime" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="form-field">
              <mat-label>Expiry Date (Optional)</mat-label>
              <input matInput type="date" formControlName="expiryDate" [min]="form.get('publishDate')?.value" (change)="validateDates()" />
            </mat-form-field>
          </div>

          <!-- Date Error Alert -->
          <div class="date-error-banner" *ngIf="dateError">
            <mat-icon>error</mat-icon>
            <span>{{ dateError }}</span>
          </div>

          <!-- Circular Body Content -->
          <mat-form-field appearance="outline" class="full-field">
            <mat-label>Official Circular Content (परिपत्र विवरण) *</mat-label>
            <textarea matInput formControlName="content" rows="4" placeholder="Enter complete circular text, instructions, timings, requirements..."></textarea>
            <mat-error *ngIf="form.get('content')?.hasError('required')">Content text is required</mat-error>
          </mat-form-field>

          <!-- Attachment Link -->
          <mat-form-field appearance="outline" class="full-field">
            <mat-label>Attachment Document / PDF Link (वैकल्पिक लिंक)</mat-label>
            <input matInput formControlName="attachmentUrl" placeholder="https://... (Optional circular PDF / scan document)" />
            <mat-icon matSuffix color="primary">attach_file</mat-icon>
          </mat-form-field>

          <!-- Pin Notice Checkbox -->
          <div class="checkbox-row">
            <label class="custom-chk-label">
              <input type="checkbox" formControlName="isPinned" class="custom-chk" />
              <span>📌 Pin this notice to the top of the Notice Board</span>
            </label>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button mat-button type="button" (click)="dialogRef.close(false)" class="cancel-btn">Cancel</button>
          <button mat-raised-button color="primary" type="submit" class="save-btn" [disabled]="saving || form.invalid || !!dateError">
            <mat-icon>{{ isEdit ? 'save' : 'send' }}</mat-icon>
            <span>{{ isEdit ? 'Save Changes' : 'Publish Notice' }}</span>
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .notice-dialog-wrap {
      display: flex;
      flex-direction: column;
      background: #ffffff;
      border-radius: 14px;
      overflow: hidden;
      width: 100%;
      box-sizing: border-box;
    }

    /* Strict AGENTS.md Light-Blue Gradient Header */
    .modal-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-sizing: border-box;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
      flex: 1;
    }

    .header-icon-box {
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .header-icon-box.weekly-icon {
      background: #059669;
      box-shadow: 0 4px 6px -1px rgba(5,150,105,0.25);
    }
    .header-icon-box mat-icon { font-size: 24px; width: 24px; height: 24px; }

    .header-titles {
      min-width: 0;
      flex: 1;
    }

    .modal-title {
      color: #1e3a8a;
      font-weight: 700;
      margin: 0;
      font-size: 1.15rem;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .modal-subtitle {
      color: #3b82f6;
      margin: 3px 0 0;
      font-size: 0.8rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .close-btn { color: #64748b; flex-shrink: 0; }
    .close-btn:hover { color: #1e293b; }

    .dialog-form-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      box-sizing: border-box;
    }

    /* Modal Body with internal scrolling */
    .modal-body {
      padding: 22px 26px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      max-height: calc(88vh - 140px);
      overflow-y: auto;
      overflow-x: hidden;
      box-sizing: border-box;
      background: #ffffff;
    }

    .full-field {
      width: 100%;
      box-sizing: border-box;
    }

    /* 3-Column Responsive Grid */
    .form-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      width: 100%;
      box-sizing: border-box;
    }

    .form-field {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }

    /* Batch Architecture Scope Deck */
    .batch-scope-toggle-deck {
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 100%;
      box-sizing: border-box;
    }

    .scope-deck-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }
    .scope-deck-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .deck-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2563eb;
    }
    .scope-deck-title {
      font-size: 12px;
      font-weight: 800;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .scope-deck-hint {
      font-size: 11.5px;
      color: #64748b;
    }

    .scope-toggle-pills {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      width: 100%;
      box-sizing: border-box;
    }

    .scope-pill-btn {
      width: 100%;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      cursor: pointer;
      text-align: left;
      transition: all 0.15s ease-in-out;
      min-width: 0;
    }
    .scope-pill-btn:hover {
      border-color: #3b82f6;
      background: #eff6ff;
    }
    .scope-pill-btn.active {
      background: #eff6ff;
      border-color: #2563eb;
      box-shadow: 0 0 0 1px #2563eb;
    }
    .scope-pill-btn mat-icon {
      color: #2563eb;
      font-size: 22px;
      width: 22px;
      height: 22px;
      flex-shrink: 0;
    }
    .pill-texts {
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow: hidden;
    }
    .pill-main {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pill-sub {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .scope-selection-grid,
    .scope-selection-combined {
      display: grid;
      grid-template-columns: 1fr 1.6fr;
      gap: 14px;
      width: 100%;
      box-sizing: border-box;
      align-items: start;
    }
    .scope-selection-combined {
      align-items: center;
    }
    .scope-selection-all {
      display: grid;
      grid-template-columns: 1fr;
      width: 100%;
      box-sizing: border-box;
    }

    .combined-info-pill {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      color: #1e40af;
      font-weight: 600;
      box-sizing: border-box;
      width: 100%;
    }
    .combined-info-pill mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; flex-shrink: 0; }

    .batch-opt-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      width: 100%;
      min-width: 520px;
      box-sizing: border-box;
    }
    .b-opt-name {
      font-weight: 600;
      color: #1e293b;
      font-size: 13.5px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1 1 auto;
      min-width: 0;
    }
    .b-opt-tags {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .shift-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 12px;
      text-transform: capitalize;
      flex-shrink: 0;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .shift-pill.morning { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
    .shift-pill.evening { background: #ffedd5; color: #9a3412; border: 1px solid #fdba74; }
    .shift-pill.afternoon { background: #e0f2fe; color: #075985; border: 1px solid #7dd3fc; }
    .scope-tag {
      font-size: 10.5px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      background: #f1f5f9;
      color: #475569;
      flex-shrink: 0;
      white-space: nowrap;
      letter-spacing: 0.3px;
    }
    .scope-tag.is-comb { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
    .scope-tag.is-single { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }

    /* Dates Grid */
    .form-grid-dates {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      width: 100%;
      box-sizing: border-box;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      padding: 4px 0;
    }
    .custom-chk-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      cursor: pointer;
    }
    .custom-chk {
      width: 18px;
      height: 18px;
      accent-color: #2563eb;
      cursor: pointer;
    }

    .date-error-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #fef2f2;
      border: 1.5px solid #fecaca;
      border-radius: 8px;
      padding: 10px 14px;
      color: #991b1b;
      font-size: 13px;
      font-weight: 600;
      box-sizing: border-box;
      width: 100%;
    }
    .date-error-banner mat-icon { font-size: 20px; width: 20px; height: 20px; color: #dc2626; flex-shrink: 0; }

    /* Modal Footer */
    .modal-footer {
      padding: 14px 26px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      box-sizing: border-box;
    }
    .cancel-btn { color: #64748b; }
    .save-btn {
      background: #2563eb !important;
      color: #ffffff !important;
      font-weight: 700;
      border-radius: 8px;
      height: 42px;
      padding: 0 22px;
    }

    /* Responsiveness — Breakpoints ensure components never distort / "kabhi nahi fatenge" */
    @media (max-width: 820px) {
      .modal-body { padding: 18px 20px; }
      .form-grid-3 { grid-template-columns: 1fr; }
    }

    @media (max-width: 720px) {
      .scope-toggle-pills { grid-template-columns: 1fr; }
      .form-grid-dates { grid-template-columns: 1fr; }
    }

    @media (max-width: 640px) {
      .modal-header { padding: 14px 16px; }
      .modal-body { padding: 14px 16px; }
      .modal-footer { padding: 12px 16px; }
      .scope-selection-grid,
      .scope-selection-combined { grid-template-columns: 1fr; }
    }
  `]
})
export class NoticeFormDialogComponent implements OnInit {
  isEdit = false;
  saving = false;
  editNoticeNumber = '';
  editNoticeId = '';
  dateError = '';

  filterCoachingClassCtrl = new FormControl('');
  batchScope: 'single' | 'combined' | 'all' = 'all';

  batchesList: any[] = [];
  classesList: any[] = [];

  selectedBatchDisplay = '';
  batchName = '';
  batchShift = '';
  className = '';

  form: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<NoticeFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: FormBuilder,
    private http: HttpClient,
    private batchesService: BatchesService
  ) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    this.form = this.fb.group({
      title: ['Weekly Test Exam (साप्ताहिक परीक्षा)', [Validators.required]],
      category: ['Weekly Exam Test', [Validators.required]],
      priority: ['Urgent'],
      targetAudience: ['SpecificBatch', [Validators.required]],
      classId: [null],
      batchId: [null],
      publishDate: [todayStr, [Validators.required]],
      publishTime: [timeStr],
      expiryDate: [null],
      content: ['सभी छात्र-छात्राएँ निर्धारित तिथि को अपने-अपने कक्ष में समय पर उपस्थित रहें और पूर्ण तैयारी के साथ परीक्षा में शामिल हों।', [Validators.required]],
      attachmentUrl: [''],
      isPinned: [false]
    });
  }

  isCombinedBatch(b: any): boolean {
    if (!b) return false;
    if (!b.classId) return true;
    return !!(b.name && b.name.match(/class\s*\d+.*(?:to|-).*\d+/i));
  }

  getBatchShift(b: any): string {
    if (!b) return '';
    if (b.shift) return b.shift;
    const text = ((b.name || '') + ' ' + (b.subject || '')).toLowerCase();
    if (text.includes('morning')) return 'Morning';
    if (text.includes('evening')) return 'Evening';
    if (text.includes('afternoon')) return 'Afternoon';
    return '';
  }

  batchBelongsToClass(b: any, c: any): boolean {
    if (!b || !c) return false;
    if (b.classId && c.id && b.classId.toLowerCase() === c.id.toLowerCase()) return true;
    if (b.className && c.name && b.className.toLowerCase().trim() === c.name.toLowerCase().trim()) return true;

    const cName = (c.name || '').toLowerCase().trim();
    const bName = (b.name || '').toLowerCase().trim();
    if (!cName || !bName) return false;

    // Direct substring match: e.g. "class 5th" inside "class 5th – morning coaching hindi batch"
    if (bName.includes(cName)) {
      return true;
    }

    // Extract digits or roman numerals (e.g. "5th" or "5" from "Class 5th")
    const match = cName.match(/(\d+(?:st|nd|rd|th)?|[ivx]+)/i);
    if (match && match[1]) {
      const numPattern = new RegExp(`\\bclass\\s*${match[1]}\\b`, 'i');
      if (numPattern.test(bName)) return true;
    }

    return false;
  }

  get activeClasses(): any[] {
    const all = this.batchesList && this.batchesList.length > 0 ? this.batchesList : (this.data?.batches || []);
    // For single class scope, check batches that are single class
    const singleBatches = all.filter((b: any) => !this.isCombinedBatch(b));

    const withData = this.classesList.filter((c: any) => {
      return singleBatches.some((b: any) => this.batchBelongsToClass(b, c));
    });

    if (withData.length > 0) {
      return withData;
    }

    // Fallback if no single batches found, check if any batches exist for classes
    const anyWithData = this.classesList.filter((c: any) => {
      return all.some((b: any) => this.batchBelongsToClass(b, c));
    });

    return anyWithData;
  }

  setBatchScope(scope: 'single' | 'combined' | 'all'): void {
    this.batchScope = scope;
    if (scope === 'single') {
      if (!this.filterCoachingClassCtrl.value && this.activeClasses.length > 0) {
        this.filterCoachingClassCtrl.setValue(this.activeClasses[0].id);
      }
    }
    const currentBatchId = this.form.get('batchId')?.value;
    if (currentBatchId) {
      const stillValid = this.availableBatches.some((b: any) => b.id === currentBatchId);
      if (!stillValid) {
        this.form.patchValue({ batchId: null });
        this.batchName = '';
        this.batchShift = '';
        this.selectedBatchDisplay = '';
      }
    }
  }

  get availableBatches(): any[] {
    const all = this.batchesList && this.batchesList.length > 0 ? this.batchesList : (this.data?.batches || []);

    if (this.batchScope === 'combined') {
      return all.filter((b: any) => this.isCombinedBatch(b));
    }

    if (this.batchScope === 'single') {
      const singleBatches = all.filter((b: any) => !this.isCombinedBatch(b));
      const chosenClassId = this.filterCoachingClassCtrl.value;
      if (!chosenClassId) {
        return [];
      }
      const selectedClass = this.classesList.find((c: any) => c.id === chosenClassId);
      if (!selectedClass) {
        return [];
      }

      // Return strictly matching batches. NEVER return other classes' batches!
      return singleBatches.filter((b: any) => this.batchBelongsToClass(b, selectedClass));
    }

    // All batches mode
    return all;
  }

  ngOnInit(): void {
    // Load master lists
    this.classesList = this.data?.classes || [];
    this.batchesList = this.data?.batches || [];

    if (this.classesList.length === 0) {
      this.http.get<any[]>(`${API_BASE}/school/classes`).subscribe({
        next: c => {
          this.classesList = c || [];
          if (this.batchScope === 'single' && !this.filterCoachingClassCtrl.value && this.activeClasses.length > 0) {
            this.filterCoachingClassCtrl.setValue(this.activeClasses[0].id);
            this.onCoachingClassChange();
          }
        },
        error: () => this.classesList = []
      });
    }

    if (this.batchesList.length === 0) {
      this.batchesService.getBatches().subscribe({
        next: b => {
          this.batchesList = b || [];
          if (this.batchScope === 'single' && !this.filterCoachingClassCtrl.value && this.activeClasses.length > 0) {
            this.filterCoachingClassCtrl.setValue(this.activeClasses[0].id);
            this.onCoachingClassChange();
          }
        },
        error: () => this.batchesList = []
      });
    } else {
      if (this.batchScope === 'single' && !this.filterCoachingClassCtrl.value && this.activeClasses.length > 0) {
        this.filterCoachingClassCtrl.setValue(this.activeClasses[0].id);
        this.onCoachingClassChange();
      }
    }

    if (this.data?.notice) {
      const n = this.data.notice;
      this.isEdit = !!n.id;
      this.editNoticeId = n.id || '';
      this.editNoticeNumber = n.noticeNumber || '';

      const pad = (n: number) => n.toString().padStart(2, '0');
      let pubDate = '';
      let pubTime = '';
      if (n.publishDate) {
        pubDate = n.publishDate.slice(0, 10);
        if (n.publishDate.length >= 16) {
          pubTime = n.publishDate.slice(11, 16);
        }
      }
      let expDate = n.expiryDate ? n.expiryDate.slice(0, 10) : null;

      this.form.patchValue({
        title: n.title || '',
        category: n.category || 'Weekly Exam Test',
        priority: n.priority || 'Urgent',
        targetAudience: n.targetAudience || 'SpecificBatch',
        classId: n.classId || null,
        batchId: n.batchId || null,
        publishDate: pubDate || this.form.get('publishDate')?.value,
        publishTime: pubTime || this.form.get('publishTime')?.value,
        expiryDate: expDate,
        content: n.content || '',
        attachmentUrl: n.attachmentUrl || '',
        isPinned: !!n.isPinned
      });

      this.className = n.className || '';
      this.batchName = n.batchName || '';
      this.batchShift = n.batchShift || '';

      if (n.batchId) {
        const found = (this.batchesList || []).find((b: any) => b.id === n.batchId);
        if (found) {
          this.batchScope = this.isCombinedBatch(found) ? 'combined' : 'single';
          if (found.classId) {
            this.filterCoachingClassCtrl.setValue(found.classId);
          }
          const shift = this.getBatchShift(found);
          this.batchShift = shift;
          this.selectedBatchDisplay = `${found.name}${shift ? ' • [' + shift + ' Shift]' : ''}`;
        }
      }
    }
  }

  onCategoryChange(): void {
    const cat = this.form.get('category')?.value;
    if (cat === 'Weekly Exam Test') {
      const curTitle = this.form.get('title')?.value;
      if (!curTitle || curTitle === 'Weekly Test Exam (साप्ताहिक परीक्षा)' || curTitle.trim() === '') {
        this.form.patchValue({ title: 'Weekly Test Exam (साप्ताहिक परीक्षा)' });
      }
      const curContent = this.form.get('content')?.value;
      if (!curContent || curContent.length < 15) {
        this.form.patchValue({
          content: 'सभी छात्र-छात्राएँ निर्धारित तिथि को अपने-अपने कक्ष में समय पर उपस्थित रहें और पूर्ण तैयारी के साथ परीक्षा में शामिल हों।'
        });
      }
      this.form.patchValue({
        priority: 'Urgent',
        targetAudience: 'SpecificBatch'
      });
    }
  }

  validateDates(): void {
    const pub = this.form.get('publishDate')?.value;
    const exp = this.form.get('expiryDate')?.value;
    if (pub && exp && exp < pub) {
      this.dateError = 'Expiry Date must be greater than or equal to Publish Date (Expiry Date, Publish Date se pehle nahi ho sakti).';
    } else {
      this.dateError = '';
    }
  }

  onAudienceSelect(): void {
    const aud = this.form.get('targetAudience')?.value;
    if (aud !== 'SpecificClass') {
      this.form.patchValue({ classId: null });
      this.className = '';
    }
    if (aud !== 'SpecificBatch') {
      this.form.patchValue({ batchId: null });
      this.batchName = '';
      this.batchShift = '';
      this.filterCoachingClassCtrl.setValue('');
      this.selectedBatchDisplay = '';
    }
  }

  onClassSelect(): void {
    const cid = this.form.get('classId')?.value;
    const c = this.classesList?.find((x: any) => x.id === cid);
    this.className = c ? c.name : '';
  }

  onBatchSelect(): void {
    const bid = this.form.get('batchId')?.value;
    const all = this.batchesList && this.batchesList.length > 0 ? this.batchesList : (this.data?.batches || []);
    const b = all.find((x: any) => x.id === bid);
    if (b) {
      this.batchName = b.name;
      const shift = this.getBatchShift(b);
      this.batchShift = shift;
      if (b.classId && !this.filterCoachingClassCtrl.value) {
        this.filterCoachingClassCtrl.setValue(b.classId);
      }
      this.selectedBatchDisplay = `${b.name}${shift ? ' • [' + shift + ' Shift]' : ''}`;
    } else {
      this.batchName = '';
      this.batchShift = '';
      this.selectedBatchDisplay = '';
    }
  }

  onCoachingClassChange(): void {
    const bid = this.form.get('batchId')?.value;
    if (bid) {
      const stillValid = this.availableBatches.some((b: any) => b.id === bid);
      if (!stillValid) {
        this.form.patchValue({ batchId: null });
        this.batchName = '';
        this.batchShift = '';
        this.selectedBatchDisplay = '';
      }
    }
    // Auto-select when exactly 1 batch exists for this class
    if (!this.form.get('batchId')?.value && this.availableBatches.length === 1) {
      this.form.patchValue({ batchId: this.availableBatches[0].id });
      this.onBatchSelect();
    }
  }

  saveNotice(): void {
    this.validateDates();
    if (this.dateError || this.form.invalid) {
      return;
    }

    this.saving = true;
    const raw = this.form.value;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const time = raw.publishTime ? `${raw.publishTime}:00` : `${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
    const dateStr = raw.publishDate ? raw.publishDate : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const payload: any = {
      ...raw,
      className: this.className,
      batchName: this.batchName,
      batchShift: this.batchShift,
      publishDate: `${dateStr}T${time}`,
      expiryDate: raw.expiryDate ? `${raw.expiryDate}T23:59:59` : null
    };

    if (this.isEdit) {
      this.http.put(`${API_BASE}/notices/${this.editNoticeId}`, payload).subscribe({
        next: () => {
          this.saving = false;
          this.dialogRef.close({ action: 'updated', title: payload.title });
        },
        error: () => this.saving = false
      });
    } else {
      this.http.post<any>(`${API_BASE}/notices`, payload).subscribe({
        next: (created) => {
          this.saving = false;
          this.dialogRef.close({ action: 'created', noticeNumber: created.noticeNumber, title: created.title });
        },
        error: () => this.saving = false
      });
    }
  }
}

// =========================================================================
// Official Printable View Notice Dialog (Strict AGENTS.md light-blue header)
// =========================================================================

@Component({
  selector: 'app-view-notice-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="view-dialog-wrap">
      <!-- Strict AGENTS.md Header: Clean Single Row with pinned close button -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>campaign</mat-icon>
          </div>
          <div class="header-titles">
            <div class="title-row">
              <h2 class="modal-title">Official Circular &amp; Notice Preview</h2>
              <span class="notice-badge">{{ data.notice.noticeNumber }}</span>
              <span class="category-badge">{{ data.notice.category }} Notice</span>
            </div>
            <p class="modal-subtitle">
              <span>Date: <strong>{{ getDisplayDate(data.notice.publishDate) }}</strong></span>
              <span class="meta-dot">&bull;</span>
              <span>Time: <strong>{{ formatISTTime(data.notice.publishDate) }}</strong></span>
              <span class="meta-dot">&bull;</span>
              <span>Audience: <strong>{{ getAudienceDesc(data.notice) }}</strong></span>
            </p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn" matTooltip="Close (Esc)">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Dedicated Sub-Header Executive Control Toolbar -->
      <div class="preview-toolbar">
        <div class="toolbar-left">
          <div class="view-switch-deck" role="tablist" aria-label="Notice Preview Mode">
            <button
              type="button"
              class="view-switch-btn"
              [class.active]="previewMode === 'poster'"
              (click)="previewMode = 'poster'"
              role="tab"
              [attr.aria-selected]="previewMode === 'poster'"
              matTooltip="View full colorful WhatsApp notice card"
            >
              <mat-icon>palette</mat-icon>
              <span>WhatsApp Poster</span>
            </button>
            <button
              type="button"
              class="view-switch-btn"
              [class.active]="previewMode === 'letterhead'"
              (click)="previewMode = 'letterhead'"
              role="tab"
              [attr.aria-selected]="previewMode === 'letterhead'"
              matTooltip="View official letterhead circular document"
            >
              <mat-icon>description</mat-icon>
              <span>Official Letterhead</span>
            </button>
          </div>
        </div>

        <div class="toolbar-right">
          <!-- 1-Click WhatsApp Share with Visual Poster Image -->
          <button mat-raised-button class="wa-action-btn" (click)="shareOnWhatsApp()" [disabled]="sharingWhatsApp" matTooltip="Copy &amp; share visual poster on WhatsApp">
            <mat-icon class="wa-btn-icon" *ngIf="!sharingWhatsApp">chat</mat-icon>
            <mat-icon class="spin-icon" *ngIf="sharingWhatsApp">autorenew</mat-icon>
            <span>{{ sharingWhatsApp ? 'Capturing...' : 'Share on WhatsApp' }}</span>
          </button>

          <!-- Explicit Save Image Button (Optional Manual Download) -->
          <button mat-stroked-button class="save-img-btn" (click)="downloadPosterImage()" [disabled]="downloadingPoster" matTooltip="Save HD Poster Image (PNG)">
            <mat-icon class="save-icon" *ngIf="!downloadingPoster">file_download</mat-icon>
            <mat-icon class="spin-icon" *ngIf="downloadingPoster">autorenew</mat-icon>
            <span>{{ downloadingPoster ? 'Saving...' : 'Save Poster' }}</span>
          </button>

          <button mat-stroked-button class="print-btn" (click)="printNotice()" matTooltip="Print or Save as PDF">
            <mat-icon>print</mat-icon>
            <span>Print Circular</span>
          </button>
        </div>
      </div>

      <!-- Content Area -->
      <div class="view-dialog-body">

        <!-- Interactive WhatsApp Guide Banner when poster is copied to clipboard -->
        <div class="whatsapp-ready-strip" *ngIf="posterCopied">
          <div class="ready-icon-wrap">
            <mat-icon>check_circle</mat-icon>
          </div>
          <div class="ready-info">
            <span class="ready-title">🎨 पोस्टर इमेज क्लिपबोर्ड पर कॉपी हो गई है! (Poster Copied)</span>
            <span class="ready-desc">WhatsApp चैट में जाकर सिर्फ <strong>Ctrl + V</strong> (Paste) दबाएँ — पूरा रंगीन पोस्टर तुरंत अटैच हो जाएगा!</span>
          </div>
          <button mat-flat-button class="open-wa-strip-btn" (click)="openWhatsAppChat()" matTooltip="Open WhatsApp Web">
            <mat-icon>launch</mat-icon>
            <span>Open WhatsApp Web</span>
          </button>
          <button mat-icon-button (click)="posterCopied = false" class="dismiss-strip-btn" matTooltip="Dismiss">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <!-- VIEW 1: WhatsApp Graphic Poster (Matching Screenshot 4) -->
        <div class="poster-container" *ngIf="previewMode === 'poster'" id="printable-poster">
          <div class="whatsapp-poster-card">
            <!-- Director Header Banner -->
            <div class="poster-director-strip">
              <div class="director-avatar-wrap">
                <img *ngIf="directorPhoto" [src]="directorPhoto" class="director-avatar-img" alt="Authority" />
                <mat-icon *ngIf="!directorPhoto">account_circle</mat-icon>
              </div>
              <div class="director-meta">
                <span class="director-name">{{ directorName }}</span>
                <span class="director-title">{{ directorTitle }}</span>
              </div>
            </div>

            <!-- Poster Top Banner with Scenic Campus Illustration -->
            <div class="poster-crest-header" [style.backgroundImage]="'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.85) 60%, #ffffff 100%), url(' + posterAssets.campus + ')'">
              <div class="campus-header-overlay"></div>
              
              <div class="campus-header-top-row">
                <!-- Circular Campus Logo Badge -->
                <div class="campus-logo-badge">
                  <img *ngIf="instituteLogo" [src]="instituteLogo" class="crest-logo-img" alt="Logo" />
                  <mat-icon *ngIf="!instituteLogo">school</mat-icon>
                </div>

                <!-- Campus Center Titles -->
                <div class="campus-title-block">
                  <h1 class="poster-campus-title">{{ instituteName }}</h1>
                  <div class="poster-addr-pill" *ngIf="branchAddress">
                    <span>{{ branchAddress }}</span>
                  </div>
                  <div class="poster-scope-pill" *ngIf="campusScopeTag">
                    <span>{{ campusScopeTag }}</span>
                  </div>
                </div>
              </div>

              <!-- 3D Ribbon Banner: NOTICE with Megaphone & Books Stack -->
              <div class="poster-notice-banner-row">
                <!-- 3D Megaphone -->
                <div class="poster-megaphone-wrap">
                  <span class="megaphone-emoji">📢</span>
                </div>

                <!-- 3D NOTICE Ribbon Banner -->
                <div class="ribbon-3d-wrapper">
                  <div class="ribbon-tail tail-left"></div>
                  <div class="ribbon-main-banner">
                    <span class="sparkle-star">✦</span>
                    <span class="ribbon-title-text">NOTICE</span>
                    <span class="sparkle-star">✦</span>
                  </div>
                  <div class="ribbon-tail tail-right"></div>
                </div>

                <!-- 3D Mini Stack of Books -->
                <div class="mini-books-stack">
                  <div class="mini-book-spine spine-blue"><span>DISCIPLINE</span></div>
                  <div class="mini-book-spine spine-red"><span>STUDY</span></div>
                  <div class="mini-book-spine spine-green"><span>SUCCESS</span></div>
                  <div class="mini-book-spine spine-purple"><span>BRIGHT FUTURE</span></div>
                </div>
              </div>
            </div>

            <!-- Hanging Board Red Pins -->
            <div class="board-hanging-pins">
              <div class="pin-unit pin-left"><div class="pin-head"></div><div class="pin-cord"></div></div>
              <div class="pin-unit pin-right"><div class="pin-head"></div><div class="pin-cord"></div></div>
            </div>

            <!-- Main Notice Key Details Rows -->
            <div class="poster-details-table">
              <!-- Dear Student Row -->
              <div class="poster-row">
                <div class="poster-cell-label bg-blue">
                  <span class="cell-ico">👥</span>
                  <span class="cell-lbl">Dear Student</span>
                  <span class="cell-sep">:</span>
                </div>
                <div class="poster-cell-value">
                  <span class="val-pill pill-cyan">प्रिय विद्यार्थियों,</span>
                </div>
              </div>

              <!-- Batch Row -->
              <div class="poster-row">
                <div class="poster-cell-label bg-green">
                  <span class="cell-ico">👥</span>
                  <span class="cell-lbl">Batch</span>
                  <span class="cell-sep">:</span>
                </div>
                <div class="poster-cell-value">
                  <span class="val-pill pill-yellow">
                    {{ getDisplayBatchWithShift(data.notice) }}
                  </span>
                </div>
              </div>

              <!-- Subject Row -->
              <div class="poster-row">
                <div class="poster-cell-label bg-red">
                  <span class="cell-ico">📝</span>
                  <span class="cell-lbl">Subject</span>
                  <span class="cell-sep">:</span>
                </div>
                <div class="poster-cell-value">
                  <span class="val-pill pill-pink">
                    {{ data.notice.title || 'Weekly Test Exam' }}
                  </span>
                </div>
              </div>

              <!-- Date Row -->
              <div class="poster-row">
                <div class="poster-cell-label bg-purple">
                  <span class="cell-ico">📅</span>
                  <span class="cell-lbl">Date</span>
                  <span class="cell-sep">:</span>
                </div>
                <div class="poster-cell-value">
                  <span class="val-pill pill-purple">
                    {{ getDisplayDate(data.notice.publishDate) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Announcement Content Body Callout -->
            <div class="poster-content-box">
              <div class="hand-icon">👉</div>
              <div class="content-hindi-text">
                {{ getDisplayContent(data.notice) }}
              </div>
            </div>

            <!-- Rich Footer Banner with 3D Cartoon Kids & Books Stack -->
            <div class="poster-footer-composite">
              <!-- Left: 3D Cartoon School Students thumbs up -->
              <div class="footer-kids-col">
                <img [src]="posterAssets.kids" class="footer-kids-img" alt="Students" />
              </div>

              <!-- Center: Red Brush-Stroke Thank You & Motto -->
              <div class="footer-center-col">
                <div class="brush-thank-you-wrap">
                  <div class="brush-thank-you-btn">
                    <span class="thank-you-burst">✨</span>
                    <span class="thank-you-script">Thank You</span>
                  </div>
                </div>
                <div class="footer-motto-strip">
                  <span class="motto-chip c-blue">STUDY</span>
                  <span class="motto-dot">&bull;</span>
                  <span class="motto-chip c-red">PRACTICE</span>
                  <span class="motto-dot">&bull;</span>
                  <span class="motto-chip c-yellow">IMPROVE</span>
                  <span class="motto-dot">&bull;</span>
                  <span class="motto-chip c-green">ACHIEVE</span>
                </div>
                <div class="footer-time-overlay">
                  {{ formatISTTime(data.notice.publishDate) }}
                </div>
              </div>

              <!-- Right: 3D Study Books on Desk with Pen Holder -->
              <div class="footer-books-col">
                <img [src]="posterAssets.books" class="footer-books-img" alt="Study Books" />
              </div>
            </div>
          </div>
        </div>

        <!-- VIEW 2: Printable Letterhead Paper -->
        <div class="letterhead-container" *ngIf="previewMode === 'letterhead'">
          <div class="circular-paper" id="printable-circular">
            <!-- School Letterhead Header -->
            <div class="paper-header">
              <div class="school-seal">
                <img *ngIf="instituteLogo" [src]="instituteLogo" class="paper-logo-img" alt="Logo" />
                <mat-icon *ngIf="!instituteLogo">school</mat-icon>
              </div>
              <div class="school-meta">
                <h1 class="school-name">{{ instituteName }}</h1>
                <p class="school-tagline">{{ campusTagline }}</p>
                <p class="school-addr" *ngIf="branchAddress">{{ branchAddress }}</p>
                <p class="school-contact" *ngIf="contactInfo">{{ contactInfo }}</p>
              </div>
            </div>

            <div class="decorative-divider"></div>

            <!-- Reference & Date Line -->
            <div class="ref-date-row">
              <span class="ref-no">Ref No: <strong>{{ data.notice.noticeNumber }}</strong></span>
              <span class="pub-date">Dated: <strong>{{ data.notice.publishDate | date:'dd MMMM yyyy' }}</strong></span>
            </div>

            <!-- Circular Banner -->
            <div class="cir-banner">
              <span class="cir-badge" [class.urgent-badge]="data.notice.priority === 'Urgent'">
                {{ data.notice.priority === 'Urgent' ? 'URGENT CIRCULAR' : 'OFFICIAL CIRCULAR' }}
              </span>
              <h2 class="paper-title">{{ data.notice.title }}</h2>
              <div class="paper-audience">
                Target Audience: <strong>{{ getAudienceDesc(data.notice) }}</strong>
              </div>
            </div>

            <!-- Body Content -->
            <div class="paper-body">
              <p class="greeting-line">Dear Parents, Students and Faculty members,</p>
              <div class="body-paragraphs">
                {{ getDisplayContent(data.notice) }}
              </div>
              <p class="closing-line">
                Your kind cooperation and strict adherence to the schedule above is solicited.
              </p>
            </div>

            <!-- Attachment Link if any -->
            <div class="paper-att-box" *ngIf="data.notice.attachmentUrl">
              <mat-icon>attach_file</mat-icon>
              <span>Attached Document: <a [href]="data.notice.attachmentUrl" target="_blank">{{ data.notice.attachmentUrl }}</a></span>
            </div>

            <!-- Signature Block (3-Column Layout: Academic Office, Official Seal, Signatory) -->
            <div class="sign-block">
              <div class="sign-box sign-left">
                <div class="sign-line"></div>
                <span class="sign-title">Issued By: Academic Office</span>
                <span class="sign-sub">{{ instituteName }}</span>
              </div>
              <div class="sign-box sign-center">
                <div class="seal-img-wrap" *ngIf="officialSealUrl">
                  <img [src]="officialSealUrl" class="official-seal-img" alt="Official Seal" />
                </div>
                <div class="seal-placeholder" *ngIf="!officialSealUrl">OFFICIAL<br>INSTITUTION<br>SEAL</div>
              </div>
              <div class="sign-box sign-right">
                <div class="sig-img-wrap" *ngIf="digitalSignatureUrl">
                  <img [src]="digitalSignatureUrl" class="digital-sig-img" alt="Signature" />
                </div>
                <div class="sign-line"></div>
                <span class="sign-title">{{ directorName }}</span>
                <span class="sign-sub">{{ directorTitle }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .view-dialog-wrap { display: flex; flex-direction: column; background: #ffffff; border-radius: 14px; overflow: hidden; width: 100%; box-sizing: border-box; }
    
    /* Strict AGENTS.md Header */
    .modal-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      box-sizing: border-box;
    }
    .header-left { display: flex; align-items: center; gap: 14px; min-width: 0; flex: 1; }
    .header-icon-box { background: #2563eb; color: #ffffff; border-radius: 10px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); flex-shrink: 0; }
    .header-icon-box mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .header-titles { min-width: 0; flex: 1; }
    .title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .modal-title { color: #1e3a8a; font-weight: 700; margin: 0; font-size: 1.15rem; line-height: 1.3; white-space: nowrap; }
    .notice-badge { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px; letter-spacing: 0.5px; }
    .category-badge { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; }
    .modal-subtitle { color: #3b82f6; margin: 4px 0 0; font-size: 0.8rem; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .modal-subtitle strong { color: #1e40af; }
    .meta-dot { color: #93c5fd; font-weight: bold; }
    .close-btn { color: #64748b; flex-shrink: 0; }
    .close-btn:hover { color: #1e293b; }

    /* Sub-Header Executive Control Toolbar */
    .preview-toolbar {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-sizing: border-box;
    }
    .toolbar-left {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }
    .view-switch-deck {
      display: inline-flex;
      align-items: center;
      background: #e2e8f0;
      border: 1px solid #cbd5e1;
      border-radius: 9px;
      padding: 3px;
      gap: 3px;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    .view-switch-btn {
      border: none;
      background: transparent;
      padding: 6px 14px;
      border-radius: 7px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      color: #475569;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
      white-space: nowrap;
    }
    .view-switch-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .view-switch-btn:hover { color: #0f172a; background: rgba(255, 255, 255, 0.5); }
    .view-switch-btn.active {
      background: #ffffff;
      color: #2563eb;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
    }
    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: nowrap;
    }
    .wa-action-btn {
      background: #16a34a !important;
      color: #ffffff !important;
      font-weight: 700;
      border-radius: 8px;
      font-size: 12px;
      height: 36px;
      padding: 0 14px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 4px rgba(22, 163, 74, 0.2);
      transition: all 0.15s ease-in-out;
      white-space: nowrap;
    }
    .wa-action-btn:hover {
      background: #15803d !important;
      box-shadow: 0 4px 6px rgba(22, 163, 74, 0.3);
    }
    .wa-btn-icon { font-size: 18px; width: 18px; height: 18px; }
    .spin-icon { font-size: 18px; width: 18px; height: 18px; animation: spin-anim 1s linear infinite; }
    @keyframes spin-anim { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .save-img-btn {
      font-size: 12px;
      font-weight: 700;
      height: 36px;
      border-radius: 8px;
      color: #0f766e;
      border: 1.5px solid #99f6e4;
      background: #f0fdfa;
      padding: 0 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease-in-out;
      white-space: nowrap;
    }
    .save-img-btn:hover {
      background: #ccfbf1;
      border-color: #5eead4;
      color: #115e59;
    }
    .save-icon { font-size: 18px; width: 18px; height: 18px; color: #0d9488; }
    .print-btn {
      font-size: 12px;
      font-weight: 700;
      height: 36px;
      border-radius: 8px;
      color: #1e3a8a;
      border: 1.5px solid #cbd5e1;
      background: #ffffff;
      padding: 0 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease-in-out;
      white-space: nowrap;
    }
    .print-btn:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }

    .whatsapp-ready-strip {
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      border: 1.5px solid #6ee7b7;
      border-radius: 12px;
      padding: 12px 18px;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      gap: 14px;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.12);
      animation: fadeInDown 0.25s ease-out;
    }
    @keyframes fadeInDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    .ready-icon-wrap { width: 38px; height: 38px; border-radius: 50%; background: #10b981; color: #ffffff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3); }
    .ready-icon-wrap mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .ready-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .ready-title { font-size: 13.5px; font-weight: 800; color: #065f46; }
    .ready-desc { font-size: 12px; color: #047857; line-height: 1.4; }
    .ready-desc strong { color: #064e3b; background: #a7f3d0; padding: 1px 6px; border-radius: 4px; }
    .open-wa-strip-btn { background: #25d366 !important; color: #ffffff !important; font-weight: 800; border-radius: 8px; font-size: 12px; height: 36px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(37, 211, 102, 0.3); flex-shrink: 0; white-space: nowrap; }
    .open-wa-strip-btn:hover { background: #1ebc57 !important; }
    .dismiss-strip-btn { color: #059669; flex-shrink: 0; }

    .view-dialog-body { overflow-y: auto; max-height: calc(88vh - 120px); padding: 22px 24px; box-sizing: border-box; background: #f1f5f9; }

    /* ========================================================================= */
    /* POSTER VIEW (MATCHING SCREENSHOT 4)                                       */
    /* ========================================================================= */
    .poster-container { display: flex; justify-content: center; width: 100%; box-sizing: border-box; }
    .whatsapp-poster-card {
      width: 100%;
      max-width: 660px;
      margin: 0 auto;
      background: #fefce8;
      border: 3px solid #22c55e;
      border-radius: 18px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
      box-sizing: border-box;
    }

    .poster-director-strip {
      background: #ffffff;
      padding: 10px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 2px solid #bbf7d0;
    }
    .director-avatar-wrap {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #dcfce7;
      color: #15803d;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .director-avatar-wrap mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .director-meta { display: flex; flex-direction: column; min-width: 0; }
    .director-name { font-size: 15px; font-weight: 800; color: #b91c1c; }
    .director-title { font-size: 10.5px; font-weight: 700; color: #475569; letter-spacing: 0.5px; }

    .poster-crest-header {
      position: relative;
      background-size: cover;
      background-position: center top;
      background-repeat: no-repeat;
      padding: 16px 14px 10px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-sizing: border-box;
      border-bottom: 2px solid #fed7aa;
      overflow: hidden;
    }
    .campus-header-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.85) 60%, #ffffff 100%);
      pointer-events: none;
    }
    .campus-header-top-row {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      width: 100%;
      margin-bottom: 6px;
    }
    .campus-logo-badge {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: #ffffff;
      border: 3px solid #eab308;
      box-shadow: 0 4px 10px rgba(0,0,0,0.22);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }
    .crest-logo-img { width: 100%; height: 100%; object-fit: contain; }
    .campus-logo-badge mat-icon { font-size: 30px; width: 30px; height: 30px; color: #2563eb; }
    .campus-title-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 0;
    }
    .poster-campus-title {
      margin: 0;
      font-family: 'Montserrat', Arial, sans-serif;
      font-size: clamp(20px, 3.2vw, 26px);
      font-weight: 900;
      color: #b91c1c;
      letter-spacing: 1px;
      text-transform: uppercase;
      text-shadow: 2px 2px 0 #ffffff, -1px -1px 0 #ffffff, 1px -1px 0 #ffffff, -1px 1px 0 #ffffff, 0 3px 6px rgba(0,0,0,0.25);
      line-height: 1.25;
      word-break: break-word;
    }
    .poster-addr-pill {
      margin-top: 4px;
      background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
      color: #ffffff;
      border: 1.5px solid #ffffff;
      box-shadow: 0 2px 5px rgba(30, 58, 138, 0.35);
      border-radius: 14px;
      padding: 3px 16px;
      font-size: 12px;
      font-weight: 700;
      word-break: break-word;
    }
    .poster-scope-pill {
      margin-top: 4px;
      display: inline-block;
      background: linear-gradient(135deg, #fef08a 0%, #fde047 100%);
      color: #713f12;
      border: 1px solid #eab308;
      box-shadow: 0 2px 4px rgba(234, 179, 8, 0.25);
      border-radius: 12px;
      padding: 2.5px 14px;
      font-size: 11px;
      font-weight: 800;
    }

    .poster-notice-banner-row {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin: 10px 0 2px;
      width: 100%;
    }
    .poster-megaphone-wrap {
      font-size: 34px;
      line-height: 1;
      filter: drop-shadow(0 3px 5px rgba(0,0,0,0.25));
      animation: megaphone-pulse 2.5s ease-in-out infinite alternate;
    }
    @keyframes megaphone-pulse {
      0% { transform: rotate(-8deg) scale(1); }
      100% { transform: rotate(4deg) scale(1.06); }
    }
    .ribbon-3d-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ribbon-main-banner {
      background: linear-gradient(180deg, #ef4444 0%, #dc2626 50%, #991b1b 100%);
      color: #fef08a;
      padding: 6px 36px;
      border-radius: 14px;
      box-shadow: 0 5px 14px rgba(185, 28, 28, 0.45), inset 0 2px 0 rgba(255,255,255,0.4);
      display: flex;
      align-items: center;
      gap: 8px;
      border: 2px solid #fee2e2;
      position: relative;
      z-index: 2;
    }
    .ribbon-title-text {
      font-family: Arial, 'Impact', sans-serif;
      font-size: clamp(24px, 3.8vw, 30px);
      font-weight: 900;
      letter-spacing: 3px;
      color: #fef08a;
      text-shadow: 0 2px 0 #ca8a04, 0 3px 0 #854d0e, 0 5px 4px rgba(0,0,0,0.4);
    }
    .sparkle-star { font-size: 16px; color: #ffffff; text-shadow: 0 0 6px #fde047; }
    .ribbon-tail {
      position: absolute;
      top: 8px;
      width: 22px;
      height: 30px;
      background: #7f1d1d;
      z-index: 1;
    }
    .ribbon-tail.tail-left {
      left: -12px;
      clip-path: polygon(100% 0, 0 50%, 100% 100%);
    }
    .ribbon-tail.tail-right {
      right: -12px;
      clip-path: polygon(0 0, 100% 50%, 0 100%);
    }

    .mini-books-stack {
      display: flex;
      flex-direction: column;
      gap: 2px;
      background: #f8fafc;
      padding: 3px 5px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 3px 6px rgba(0,0,0,0.12);
    }
    .mini-book-spine {
      font-size: 7.5px;
      font-weight: 900;
      color: #ffffff;
      padding: 1px 5px;
      border-radius: 2px;
      text-align: center;
      letter-spacing: 0.4px;
      line-height: 1.1;
    }
    .spine-blue { background: #0284c7; }
    .spine-red { background: #dc2626; }
    .spine-green { background: #16a34a; }
    .spine-purple { background: #7c3aed; }

    .board-hanging-pins {
      display: flex;
      justify-content: space-between;
      padding: 0 40px;
      margin-top: 4px;
      margin-bottom: -10px;
      position: relative;
      z-index: 3;
    }
    .pin-unit { display: flex; flex-direction: column; align-items: center; }
    .pin-head {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #ef4444 0%, #991b1b 100%);
      border: 1.5px solid #fee2e2;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    .pin-cord { width: 2px; height: 10px; background: #cbd5e1; }

    .poster-details-table {
      margin: 10px 18px 8px;
      background: #ffffff;
      border-radius: 12px;
      border: 2px solid #fed7aa;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.04);
      box-sizing: border-box;
    }
    .poster-row {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
    }
    .poster-cell-label {
      width: 140px;
      padding: 7px 12px;
      border-radius: 8px;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 800;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .poster-cell-label.bg-blue { background: #0284c7; }
    .poster-cell-label.bg-green { background: #16a34a; }
    .poster-cell-label.bg-red { background: #dc2626; }
    .poster-cell-label.bg-purple { background: #7c3aed; }
    .cell-ico { font-size: 14px; }
    .cell-lbl { flex: 1; white-space: nowrap; }
    .cell-sep { font-weight: 900; }

    .poster-cell-value {
      flex: 1;
      min-width: 0;
    }
    .val-pill {
      display: inline-block;
      padding: 7px 16px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 14.5px;
      line-height: 1.35;
      border: 1.5px solid transparent;
      word-break: break-word;
    }
    .pill-cyan { background: #e0f2fe; color: #0369a1; border-color: #bae6fd; font-size: 15px; }
    .pill-yellow { background: #fef08a; color: #92400e; border-color: #fde047; font-size: 15px; }
    .pill-pink { background: #fce7f3; color: #9d174d; border-color: #fbcfe8; font-size: 15px; }
    .pill-purple { background: #ede9fe; color: #5b21b6; border-color: #ddd6fe; font-size: 15px; }

    .poster-content-box {
      margin: 4px 18px 12px;
      background: #fffbeb;
      border: 2px dashed #f59e0b;
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
      box-sizing: border-box;
    }
    .hand-icon { font-size: 22px; flex-shrink: 0; }
    .content-hindi-text {
      font-size: 14.5px;
      font-weight: 700;
      color: #1e293b;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .poster-footer-composite {
      position: relative;
      background: linear-gradient(180deg, #ffffff 0%, #fffbeb 40%, #fef3c7 70%, #d97706 95%, #92400e 100%);
      border-top: 2px solid #fde68a;
      padding: 8px 12px 10px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      overflow: hidden;
      box-sizing: border-box;
    }
    .footer-kids-col {
      width: 140px;
      flex-shrink: 0;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    .footer-kids-img {
      width: 100%;
      max-width: 135px;
      height: auto;
      object-fit: contain;
      filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2));
      transform: translateY(4px);
    }
    .footer-center-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 0 6px 4px;
      z-index: 2;
    }
    .brush-thank-you-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .brush-thank-you-btn {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%);
      color: #ffffff;
      padding: 7px 26px;
      border-radius: 28px;
      box-shadow: 0 4px 10px rgba(220,38,38,0.4), inset 0 2px 0 rgba(255,255,255,0.4);
      border: 2px solid #fee2e2;
      position: relative;
    }
    .thank-you-script {
      font-family: 'Brush Script MT', 'Dancing Script', cursive, sans-serif;
      font-size: 25px;
      font-weight: 900;
      letter-spacing: 1px;
      color: #ffffff;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
    }
    .thank-you-burst {
      position: absolute;
      top: -6px;
      right: -8px;
      font-size: 15px;
    }
    .footer-motto-strip {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.8px;
      color: #78350f;
      background: rgba(255,255,255,0.9);
      padding: 2.5px 12px;
      border-radius: 10px;
      border: 1px solid #fde68a;
    }
    .motto-chip { font-weight: 900; }
    .c-blue { color: #0284c7; }
    .c-red { color: #dc2626; }
    .c-yellow { color: #d97706; }
    .c-green { color: #16a34a; }
    .motto-dot { color: #94a3b8; font-size: 12px; }
    .footer-time-overlay {
      font-size: 11px;
      font-weight: 800;
      color: #ffffff;
      text-shadow: 0 1px 2px rgba(0,0,0,0.85);
    }
    .footer-books-col {
      width: 140px;
      flex-shrink: 0;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
    }
    .footer-books-img {
      width: 100%;
      max-width: 135px;
      height: auto;
      object-fit: contain;
      filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2));
      transform: translateY(4px);
    }

    /* ========================================================================= */
    /* LETTERHEAD VIEW                                                           */
    /* ========================================================================= */
    .letterhead-container { display: flex; justify-content: center; width: 100%; box-sizing: border-box; }
    .circular-paper {
      background: #fff;
      padding: 36px 40px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      border: 1px solid #e2e8f0;
      font-family: 'Times New Roman', Georgia, serif;
      color: #1e293b;
      width: 100%;
      max-width: 780px;
      margin: 0 auto;
      box-sizing: border-box;
    }
    .paper-header { display: flex; align-items: center; justify-content: center; gap: 16px; text-align: center; }
    .school-seal { width: 52px; height: 52px; border-radius: 50%; background: #eff6ff; color: #1e3a8a; border: 2px solid #1e3a8a; display: flex; align-items: center; justify-content: center; }
    .school-seal mat-icon { font-size: 30px; width: 30px; height: 30px; }
    .school-name { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 1.5px; color: #1e3a8a; font-family: sans-serif; }
    .school-tagline { margin: 3px 0 0; font-size: 11px; color: #475569; font-family: sans-serif; font-weight: 600; }
    .school-addr { margin: 3px 0 0; font-size: 11px; color: #64748b; font-family: sans-serif; }
    .decorative-divider { height: 3px; background: linear-gradient(90deg, #1e3a8a, #3b82f6, #1e3a8a); margin: 16px 0 14px; border-radius: 2px; }
    .ref-date-row { display: flex; justify-content: space-between; font-size: 13px; font-family: sans-serif; margin-bottom: 20px; color: #334155; }
    .cir-banner { text-align: center; margin-bottom: 24px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
    .cir-badge { display: inline-block; font-size: 11px; font-weight: 800; font-family: sans-serif; background: #2563eb; color: #fff; padding: 3px 12px; border-radius: 12px; letter-spacing: 1px; margin-bottom: 6px; }
    .cir-badge.urgent-badge { background: #dc2626; }
    .paper-title { margin: 4px 0 6px; font-size: 18px; font-weight: 800; color: #0f172a; text-decoration: underline; font-family: sans-serif; }
    .paper-audience { font-size: 12px; color: #475569; font-family: sans-serif; }
    .paper-body { font-size: 14.5px; line-height: 1.7; color: #1e293b; margin-bottom: 28px; }
    .greeting-line { font-weight: 700; margin-bottom: 12px; }
    .body-paragraphs { white-space: pre-wrap; margin-bottom: 16px; text-align: justify; }
    .closing-line { font-style: italic; color: #475569; font-size: 13px; }
    .paper-att-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px 12px; font-size: 12px; font-family: sans-serif; display: flex; align-items: center; gap: 8px; margin-bottom: 24px; }
    .paper-att-box mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }
    .director-avatar-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
    .crest-logo-img { width: 100%; height: 100%; border-radius: 50%; object-fit: contain; background: #fff; }
    .paper-logo-img { width: 100%; height: 100%; border-radius: 50%; object-fit: contain; }
    .school-contact { margin: 2px 0 0; font-size: 11px; color: #475569; font-family: sans-serif; font-weight: 500; }
    .seal-img-wrap { width: 70px; height: 70px; margin: 0 auto 4px; display: flex; align-items: center; justify-content: center; }
    .seal-img-wrap img.official-seal-img, img.official-seal-img { max-width: 70px !important; max-height: 70px !important; object-fit: contain; }
    .sig-img-wrap { height: 38px; margin: 0 auto 4px; display: flex; align-items: center; justify-content: center; }
    .sig-img-wrap img.digital-sig-img, img.digital-sig-img { max-height: 38px !important; max-width: 125px !important; object-fit: contain; }
    .sign-block { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; padding-top: 10px; font-family: sans-serif; width: 100%; }
    .sign-box { display: flex; flex-direction: column; align-items: center; width: 160px; text-align: center; }
    .sign-center { justify-content: flex-end; }
    .seal-placeholder { width: 65px; height: 65px; border-radius: 50%; border: 1.5px dashed #94a3b8; color: #94a3b8; font-size: 8.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; line-height: 1.2; text-align: center; }
    .sign-line { width: 130px; height: 1.5px; background: #64748b; margin-bottom: 4px; }
    .sign-title { font-size: 11.5px; font-weight: 700; color: #0f172a; }
    .sign-sub { font-size: 10px; color: #64748b; }

    @media (max-width: 860px) {
      .preview-toolbar {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
        padding: 10px 16px;
      }
      .toolbar-left {
        width: 100%;
      }
      .view-switch-deck {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
      .view-switch-btn {
        justify-content: center;
        width: 100%;
        padding: 7px 10px;
      }
      .toolbar-right {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .wa-action-btn {
        flex: 1.3;
        justify-content: center;
        padding: 0 10px;
      }
      .save-img-btn {
        flex: 1;
        justify-content: center;
        padding: 0 10px;
      }
      .print-btn {
        flex: 1;
        justify-content: center;
        padding: 0 10px;
      }
    }

    @media (max-width: 600px) {
      .modal-header {
        padding: 12px 14px;
        gap: 10px;
      }
      .header-icon-box {
        width: 38px;
        height: 38px;
      }
      .modal-title {
        font-size: 0.95rem;
        white-space: normal;
      }
      .modal-subtitle {
        font-size: 0.72rem;
      }
      .preview-toolbar {
        padding: 8px 12px;
        gap: 8px;
      }
      .toolbar-right {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .wa-action-btn,
      .save-img-btn,
      .print-btn {
        width: 100%;
        height: 38px;
        justify-content: center;
        font-size: 12px;
      }
      .view-dialog-body {
        padding: 12px 8px;
      }
      .poster-row {
        flex-direction: column;
        align-items: stretch;
        gap: 6px;
      }
      .poster-cell-label,
      .poster-cell-value,
      .val-pill {
        width: 100%;
        box-sizing: border-box;
      }
      .poster-campus-title { font-size: 18px; }
      .poster-notice-banner-row { gap: 6px; }
      .poster-megaphone-wrap { font-size: 26px; }
      .ribbon-main-banner { padding: 5px 20px; }
      .ribbon-title-text { font-size: 20px; letter-spacing: 1.5px; }
      .poster-footer-composite { padding: 6px 8px 8px; }
      .footer-kids-col,
      .footer-books-col { width: 85px; }
      .footer-kids-img,
      .footer-books-img { max-width: 80px; }
      .thank-you-script { font-size: 18px; }
      .brush-thank-you-btn { padding: 5px 14px; }
      .circular-paper { padding: 18px 14px; }
      .sign-block {
        flex-direction: column;
        align-items: center;
        gap: 18px;
      }
    }
  `]
})
export class ViewNoticeDialogComponent implements OnInit {
  previewMode: 'poster' | 'letterhead' = 'poster';
  instituteName = '';
  directorName = '';
  directorTitle = '';
  branchAddress = '';
  contactInfo = '';
  instituteLogo: string | null = null;
  officialSealUrl: string | null = null;
  digitalSignatureUrl: string | null = null;
  directorPhoto: string | null = null;
  hasSchoolModule = true;
  hasCoachingModule = true;
  posterAssets = POSTER_ASSETS;
  sharingWhatsApp = false;
  posterCopied = false;
  downloadingPoster = false;

  constructor(
    public dialogRef: MatDialogRef<ViewNoticeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { notice: SchoolNoticeDto },
    private authService: AuthService,
    private tenantService: TenantService,
    private confirmDialog: ConfirmDialogService
  ) {
    this.initDynamicDetails();
  }

  ngOnInit(): void {
    // Live multi-tenant synchronization from backend
    this.tenantService.getCurrentTenant().subscribe({
      next: (t) => {
        if (!t) return;
        if (t.name) this.instituteName = t.name;
        if (t.profilePhoto) this.instituteLogo = this.authService.resolveLogoUrl(t.profilePhoto);
        if (t.officialSeal) this.officialSealUrl = this.authService.resolveLogoUrl(t.officialSeal);
        if (t.digitalSignature) this.digitalSignatureUrl = this.authService.resolveLogoUrl(t.digitalSignature);

        if (t.hasSchoolModule !== undefined) this.hasSchoolModule = t.hasSchoolModule;
        if (t.hasCoachingModule !== undefined) this.hasCoachingModule = t.hasCoachingModule;

        if (!this.branchAddress) {
          const parts = [t.address, t.city, t.state ? (t.pincode ? `${t.state} - ${t.pincode}` : t.state) : t.pincode].filter(Boolean);
          if (parts.length > 0) {
            this.branchAddress = parts.join(', ');
          }
        }
        const contacts = [t.contactPhone, t.email].filter(Boolean);
        if (contacts.length > 0) {
          this.contactInfo = contacts.join(' • ');
        }
      },
      error: () => {}
    });
  }

  private initDynamicDetails(): void {
    // 1. Dynamic Institute Name
    this.instituteName = this.authService.getInstituteName() || this.authService.currentUser()?.instituteName || '';

    // 2. Dynamic Institute Assets
    this.instituteLogo = this.authService.getInstituteLogoUrl();
    this.officialSealUrl = this.authService.getOfficialSealUrl();
    this.digitalSignatureUrl = this.authService.getDigitalSignatureUrl();

    // 3. Current User & Signatory Info
    const user = this.authService.currentUser();
    this.directorPhoto = this.authService.resolveLogoUrl(user?.userProfilePhoto || user?.profilePhoto);

    if (user?.fullName) {
      this.directorName = user.fullName;
    } else {
      this.directorName = 'Authorized Signatory';
    }

    const role = (user?.role || '').toLowerCase();
    if (role.includes('admin') || role.includes('owner') || role.includes('superadmin')) {
      this.directorTitle = 'DIRECTOR & ADMINISTRATOR';
    } else if (role.includes('principal')) {
      this.directorTitle = 'PRINCIPAL';
    } else if (role.includes('teacher') || role.includes('faculty')) {
      this.directorTitle = 'ACADEMIC INCHARGE';
    } else {
      this.directorTitle = 'AUTHORIZED SIGNATORY';
    }

    // 4. Module Configuration
    this.hasSchoolModule = this.authService.hasSchoolModule();
    this.hasCoachingModule = this.authService.hasCoachingModule();

    // 5. Active Branch / Campus Address
    const activeBranchId = this.authService.selectedBranchId() || user?.branchId;
    const branch = user?.branches?.find(b => b.id === activeBranchId);
    if (branch) {
      const parts = [branch.address, branch.city, branch.state ? (branch.pincode ? `${branch.state} - ${branch.pincode}` : branch.state) : branch.pincode].filter(Boolean);
      if (parts.length > 0) {
        this.branchAddress = parts.join(', ');
      } else if (branch.name && !branch.name.toLowerCase().includes('main branch')) {
        this.branchAddress = branch.name;
      }
    }
  }

  get campusScopeTag(): string {
    if (this.hasSchoolModule && this.hasCoachingModule) {
      return 'School & Coaching Integrated Campus';
    }
    if (this.hasCoachingModule && !this.hasSchoolModule) {
      return 'Coaching & Competitive Examinations Center';
    }
    if (this.hasSchoolModule && !this.hasCoachingModule) {
      return 'School Academic Excellence Campus';
    }
    return '';
  }

  get campusTagline(): string {
    if (this.hasSchoolModule && this.hasCoachingModule) {
      return 'School & Coaching Integrated Campus • Unified ERP System';
    }
    if (this.hasCoachingModule && !this.hasSchoolModule) {
      return 'Coaching & Competitive Examinations Center • Unified ERP System';
    }
    if (this.hasSchoolModule && !this.hasCoachingModule) {
      return 'Academic Excellence & Board Preparation • Unified ERP System';
    }
    return 'Academic Excellence • Unified ERP System';
  }

  getAudienceDesc(n: SchoolNoticeDto): string {
    if (n.targetAudience === 'SpecificClass') return `Class: ${n.className || 'Selected Class'}`;
    if (n.targetAudience === 'SpecificBatch') return `Coaching Batch: ${n.batchName || 'Selected Batch'}`;
    if (n.targetAudience === 'All') return 'All Students, Parents & Staff';
    if (n.targetAudience === 'Students') return 'Students & Parents';
    if (n.targetAudience === 'Teachers') return 'Teachers & Academic Staff';
    if (n.targetAudience === 'Parents') return 'Parents';
    return n.targetAudience;
  }

  getDisplayBatchWithShift(n: SchoolNoticeDto): string {
    if (!n.batchName) {
      if (n.targetAudience === 'SpecificClass') return n.className ? `${n.className} Special Batch` : 'Class Batch';
      return 'Morning batch';
    }
    const name = n.batchName;
    if (/morning/i.test(name)) return name;
    if (/evening/i.test(name)) return name;
    if (/afternoon/i.test(name)) return name;
    if (n.batchShift) return `${name} (${n.batchShift} batch)`;
    return `${name} (Regular batch)`;
  }

  getDisplayDate(dateVal: string | undefined): string {
    if (!dateVal) return '28-10-2026';
    const s = dateVal.slice(0, 10);
    const parts = s.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return s;
  }

  formatISTTime(dateVal: string | undefined): string {
    if (!dateVal) return '09:57 PM';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '09:57 PM';
      return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '09:57 PM';
    }
  }

  getDisplayContent(n: SchoolNoticeDto): string {
    if (!n) return '';
    const c = (n.content || '').trim();
    const t = (n.title || '').trim();
    if (!c || c.toLowerCase() === t.toLowerCase() || (c.length < 25 && (c.toLowerCase().includes('exam') || c.toLowerCase().includes('test')))) {
      return 'सभी छात्र-छात्राएँ निर्धारित तिथि को अपने-अपने कक्ष में समय पर उपस्थित रहें और पूर्ण तैयारी के साथ परीक्षा में शामिल हों।';
    }
    return n.content;
  }

  buildWhatsAppText(): string {
    const n = this.data.notice;
    const institute = this.instituteName || 'Notice';
    const dateStr = this.getDisplayDate(n.publishDate);
    const batchDisplay = this.getDisplayBatchWithShift(n);
    const bodyContent = this.getDisplayContent(n);

    return `📢 *OFFICIAL CIRCULAR* - ${institute.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━
👥 *Dear Student* : प्रिय विद्यार्थियों,
🏫 *Batch* : ${batchDisplay}
📝 *Subject* : ${n.title || 'Notice'}
📅 *Date* : ${dateStr}
━━━━━━━━━━━━━━━━━━━━━━
👉 *${bodyContent}*

🌸 *Thank You*
— ${this.directorName} (${this.directorTitle})`;
  }

  openWhatsAppChat(): void {
    const waText = this.buildWhatsAppText();
    const url = `https://web.whatsapp.com/send?text=${encodeURIComponent(waText)}`;
    window.open(url, '_blank');
  }

  async downloadPosterImage(): Promise<void> {
    if (this.downloadingPoster) return;
    this.downloadingPoster = true;

    const n = this.data.notice;
    if (this.previewMode !== 'poster') {
      this.previewMode = 'poster';
      await new Promise(r => setTimeout(r, 120));
    }

    const cardEl = (document.querySelector('.whatsapp-poster-card') || document.querySelector('#printable-poster')) as HTMLElement;
    if (!cardEl || typeof html2canvas === 'undefined') {
      this.downloadingPoster = false;
      return;
    }

    try {
      const canvas = await html2canvas(cardEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
      if (blob) {
        const fileName = `Notice_${n.noticeNumber || 'Circular'}.png`;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      }
    } catch (err) {
      console.error('Error saving poster image:', err);
    } finally {
      this.downloadingPoster = false;
    }
  }

  async shareOnWhatsApp(): Promise<void> {
    if (this.sharingWhatsApp) return;
    this.sharingWhatsApp = true;

    const n = this.data.notice;
    const institute = this.instituteName || 'Notice';
    const waText = this.buildWhatsAppText();

    // Ensure poster is active in DOM
    if (this.previewMode !== 'poster') {
      this.previewMode = 'poster';
      await new Promise(r => setTimeout(r, 120));
    }

    const cardEl = (document.querySelector('.whatsapp-poster-card') || document.querySelector('#printable-poster')) as HTMLElement;

    if (cardEl && typeof html2canvas !== 'undefined') {
      try {
        const canvas = await html2canvas(cardEl, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        });

        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));

        if (blob) {
          const fileName = `Notice_${n.noticeNumber || 'Circular'}.png`;
          const file = new File([blob], fileName, { type: 'image/png' });

          // 1. Mobile Web Share API: directly shares image file to WhatsApp!
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: `${institute} - ${n.title}`,
                text: waText
              });
              this.sharingWhatsApp = false;
              return;
            } catch {
              // User dismissed mobile share sheet, proceed to desktop clipboard flow
            }
          }

          // 2. Desktop: Copy the poster image to Clipboard
          let copiedToClipboard = false;
          if (navigator.clipboard && (window as any).ClipboardItem) {
            try {
              window.focus();
              const item = new (window as any).ClipboardItem({ 'image/png': blob });
              await navigator.clipboard.write([item]);
              copiedToClipboard = true;
            } catch (clipErr) {
              console.warn('Clipboard write warning:', clipErr);
            }
          }

          this.posterCopied = true;
          this.sharingWhatsApp = false;

          // 3. Inform user with prominent, bilingual confirmation dialog
          const dialogMessage = copiedToClipboard
            ? `🎨 रंगीन पोस्टर इमेज आपके क्लिपबोर्ड पर कॉपी हो गई है!\n\n` +
              `📋 WhatsApp Web में भेजने का 2-Step तरीका:\n` +
              `1️⃣ नीचे "Open WhatsApp Web" पर क्लिक करें।\n` +
              `2️⃣ WhatsApp चैट खुलते ही केवल Ctrl + V (Paste) दबाएँ — पूरा रंगीन पोस्टर तुरंत अटैच हो जाएगा!\n` +
              `3️⃣ फिर Send बटन दबा दें।`
            : `पोस्टर इमेज तैयार है!\nWhatsApp Web चैट में Ctrl + V (Paste) दबाकर इमेज सेंड करें।`;

          this.confirmDialog.confirm(
            'WhatsApp Poster Ready! 🎨',
            dialogMessage,
            'Open WhatsApp Web',
            'Done',
            'success'
          ).subscribe(proceed => {
            if (proceed) {
              this.openWhatsAppChat();
            }
          });

          return;
        }
      } catch (err) {
        console.error('Error generating poster canvas:', err);
      }
    }

    // Fallback if canvas generation fails
    this.openWhatsAppChat();
    this.sharingWhatsApp = false;
  }

  printNotice(): void {
    const elId = this.previewMode === 'poster' ? 'printable-poster' : 'printable-circular';
    const printContent = document.getElementById(elId);
    if (!printContent) return;
    const win = window.open('', '', 'width=850,height=950');
    if (!win) return;

    const isPoster = this.previewMode === 'poster';

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Circular - ${this.data.notice.noticeNumber || 'Notice'} - ${this.instituteName}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: ${isPoster ? '6mm 8mm' : '8mm 12mm'};
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            body {
              display: flex;
              justify-content: center;
              padding: ${isPoster ? '4px 0' : '8px 0'};
            }
            .print-wrapper {
              width: 100%;
              max-width: ${isPoster ? '560px' : '720px'};
              margin: 0 auto;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: avoid !important;
              break-after: avoid !important;
            }

            /* ============================================================= */
            /* LETTERHEAD DOCUMENT PRINT STYLING (Strictly 1 Single Page)   */
            /* ============================================================= */
            .circular-paper {
              font-family: 'Times New Roman', Georgia, serif;
              padding: 14px 20px;
              width: 100%;
              max-width: 720px;
              margin: 0 auto;
              box-sizing: border-box;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .paper-header {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 14px;
              margin-bottom: 6px;
              text-align: center;
            }
            .school-seal {
              width: 48px;
              height: 48px;
              border-radius: 50%;
              border: 1.5px solid #1e3a8a;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              flex-shrink: 0;
            }
            .school-seal mat-icon { font-size: 28px; width: 28px; height: 28px; color: #1e3a8a; }
            .paper-logo-img { width: 100%; height: 100%; object-fit: contain; }
            .school-meta { flex: 1; text-align: center; }
            .school-name { font-size: 20px; font-weight: 900; margin: 0; color: #1e3a8a; font-family: sans-serif; letter-spacing: 0.5px; }
            .school-tagline { font-size: 10.5px; margin: 2px 0 0; color: #475569; font-family: sans-serif; font-weight: 600; }
            .school-addr, .school-contact { font-size: 10px; margin: 1px 0 0; color: #64748b; font-family: sans-serif; }
            .decorative-divider { height: 2px; background: #1e3a8a; margin: 8px 0; }
            .ref-date-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; font-family: sans-serif; color: #334155; }
            .cir-banner { text-align: center; margin: 6px 0 10px; border: 1px solid #cbd5e1; padding: 6px 10px; background: #f8fafc; border-radius: 6px; }
            .cir-badge { display: inline-block; font-size: 10px; font-weight: 800; background: #2563eb; color: #fff; padding: 2px 10px; border-radius: 10px; margin-bottom: 2px; font-family: sans-serif; }
            .cir-badge.urgent-badge { background: #dc2626; }
            .paper-title { font-size: 15px; font-weight: 800; margin: 2px 0; text-decoration: underline; font-family: sans-serif; color: #0f172a; }
            .paper-audience { font-size: 11px; color: #475569; font-family: sans-serif; }
            .paper-body { font-size: 13.5px; line-height: 1.55; margin: 10px 0 14px; color: #1e293b; text-align: justify; }
            .greeting-line { font-weight: 700; margin-bottom: 6px; }
            .body-paragraphs { white-space: pre-wrap; margin-bottom: 8px; }
            .closing-line { font-style: italic; color: #475569; font-size: 11.5px; }
            .paper-att-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 5px 8px; font-size: 10.5px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; font-family: sans-serif; }
            
            /* 3-Column Signature Block */
            .sign-block {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: 18px;
              padding-top: 8px;
              width: 100%;
              font-family: sans-serif;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .sign-box {
              width: 160px;
              text-align: center;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .sign-center { justify-content: flex-end; }
            .seal-img-wrap {
              width: 68px;
              height: 68px;
              margin: 0 auto 3px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .seal-img-wrap img.official-seal-img, img.official-seal-img {
              max-width: 68px !important;
              max-height: 68px !important;
              object-fit: contain !important;
            }
            .seal-placeholder {
              width: 62px;
              height: 62px;
              border-radius: 50%;
              border: 1.5px dashed #94a3b8;
              font-size: 8px;
              font-weight: 700;
              color: #94a3b8;
              display: flex;
              align-items: center;
              justify-content: center;
              line-height: 1.2;
              text-align: center;
              margin-bottom: 3px;
            }
            .sig-img-wrap {
              height: 36px;
              margin: 0 auto 3px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .sig-img-wrap img.digital-sig-img, img.digital-sig-img {
              max-height: 36px !important;
              max-width: 120px !important;
              object-fit: contain !important;
            }
            .sign-line {
              width: 125px;
              height: 1px;
              background: #334155;
              margin-bottom: 3px;
            }
            .sign-title { font-size: 11px; font-weight: 700; color: #0f172a; }
            .sign-sub { font-size: 9.5px; color: #64748b; }

            /* ============================================================= */
            /* WHATSAPP POSTER PRINT STYLING (Strictly 1 Single Page)       */
            /* ============================================================= */
            .poster-container {
              width: 100%;
              max-width: 550px;
              margin: 0 auto;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .whatsapp-poster-card {
              width: 100%;
              max-width: 540px;
              margin: 0 auto;
              background: #ffffff;
              border-radius: 14px;
              border: 2px solid #22c55e;
              box-shadow: none;
              overflow: hidden;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .poster-director-strip {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 8px 14px;
              background: #ffffff;
              border-bottom: 2px solid #bbf7d0;
            }
            .director-avatar-wrap {
              width: 34px;
              height: 34px;
              border-radius: 50%;
              overflow: hidden;
              background: #dcfce7;
              border: 1.5px solid #22c55e;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .director-avatar-img { width: 100%; height: 100%; object-fit: cover; }
            .director-meta { display: flex; flex-direction: column; }
            .director-name { font-size: 14px; font-weight: 800; color: #b91c1c; }
            .director-title { font-size: 10px; font-weight: 700; color: #475569; }

            .poster-crest-header {
              position: relative;
              background-size: cover;
              background-position: center top;
              background-repeat: no-repeat;
              padding: 12px 12px 8px;
              text-align: center;
              display: flex;
              flex-direction: column;
              align-items: center;
              border-bottom: 2px solid #fed7aa;
              overflow: hidden;
            }
            .campus-header-overlay {
              position: absolute;
              inset: 0;
              background: linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.85) 60%, #ffffff 100%);
              pointer-events: none;
            }
            .campus-header-top-row {
              position: relative;
              z-index: 2;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
              width: 100%;
              margin-bottom: 4px;
            }
            .campus-logo-badge {
              width: 52px;
              height: 52px;
              border-radius: 50%;
              background: #ffffff;
              border: 2.5px solid #eab308;
              box-shadow: 0 3px 8px rgba(0,0,0,0.2);
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              flex-shrink: 0;
            }
            .crest-logo-img { width: 100%; height: 100%; object-fit: contain; }
            .campus-title-block {
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .poster-campus-title {
              margin: 0;
              font-family: Arial, sans-serif;
              font-size: 22px;
              font-weight: 900;
              color: #b91c1c;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              text-shadow: 2px 2px 0 #ffffff, -1px -1px 0 #ffffff, 1px -1px 0 #ffffff, -1px 1px 0 #ffffff;
              line-height: 1.2;
            }
            .poster-addr-pill {
              margin-top: 3px;
              background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
              color: #ffffff;
              border: 1.5px solid #ffffff;
              box-shadow: 0 2px 4px rgba(30, 58, 138, 0.3);
              border-radius: 12px;
              padding: 2.5px 14px;
              font-size: 11px;
              font-weight: 700;
            }
            .poster-scope-pill {
              margin-top: 3px;
              display: inline-block;
              background: linear-gradient(135deg, #fef08a 0%, #fde047 100%);
              color: #713f12;
              border: 1px solid #eab308;
              box-shadow: 0 2px 4px rgba(234, 179, 8, 0.25);
              border-radius: 10px;
              padding: 2px 12px;
              font-size: 10.5px;
              font-weight: 800;
            }

            .poster-notice-banner-row {
              position: relative;
              z-index: 2;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
              margin: 8px 0 2px;
              width: 100%;
            }
            .poster-megaphone-wrap {
              font-size: 30px;
              line-height: 1;
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));
            }
            .ribbon-3d-wrapper {
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .ribbon-main-banner {
              background: linear-gradient(180deg, #ef4444 0%, #dc2626 50%, #991b1b 100%);
              color: #fef08a;
              padding: 5px 30px;
              border-radius: 12px;
              box-shadow: 0 4px 10px rgba(185, 28, 28, 0.4);
              display: flex;
              align-items: center;
              gap: 6px;
              border: 2px solid #fee2e2;
              position: relative;
              z-index: 2;
            }
            .ribbon-title-text {
              font-family: Arial, 'Impact', sans-serif;
              font-size: 25px;
              font-weight: 900;
              letter-spacing: 2px;
              color: #fef08a;
              text-shadow: 0 2px 0 #ca8a04, 0 3px 0 #854d0e;
            }
            .sparkle-star { font-size: 14px; color: #ffffff; }
            .mini-books-stack {
              display: flex;
              flex-direction: column;
              gap: 1.5px;
              background: #f8fafc;
              padding: 2.5px 4px;
              border-radius: 5px;
              border: 1px solid #cbd5e1;
            }
            .mini-book-spine {
              font-size: 7px;
              font-weight: 900;
              color: #ffffff;
              padding: 1px 4px;
              border-radius: 2px;
              text-align: center;
              letter-spacing: 0.3px;
              line-height: 1.1;
            }
            .spine-blue { background: #0284c7; }
            .spine-red { background: #dc2626; }
            .spine-green { background: #16a34a; }
            .spine-purple { background: #7c3aed; }

            .board-hanging-pins {
              display: flex;
              justify-content: space-between;
              padding: 0 36px;
              margin-top: 3px;
              margin-bottom: -8px;
              position: relative;
              z-index: 3;
            }
            .pin-unit { display: flex; flex-direction: column; align-items: center; }
            .pin-head {
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: radial-gradient(circle at 35% 35%, #ef4444 0%, #991b1b 100%);
              border: 1.5px solid #fee2e2;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
            .pin-cord { width: 2px; height: 8px; background: #cbd5e1; }

            .poster-details-table {
              margin: 8px 14px 6px;
              background: #ffffff;
              border-radius: 10px;
              border: 2px solid #fed7aa;
              padding: 10px 12px;
              display: flex;
              flex-direction: column;
              gap: 8px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.04);
            }
            .poster-row {
              display: flex;
              align-items: center;
              gap: 10px;
              width: 100%;
            }
            .poster-cell-label {
              width: 130px;
              padding: 6px 10px;
              border-radius: 7px;
              color: #ffffff;
              display: flex;
              align-items: center;
              gap: 5px;
              font-size: 12px;
              font-weight: 800;
              flex-shrink: 0;
            }
            .poster-cell-label.bg-blue { background: #0284c7; }
            .poster-cell-label.bg-green { background: #16a34a; }
            .poster-cell-label.bg-red { background: #dc2626; }
            .poster-cell-label.bg-purple { background: #7c3aed; }
            .cell-lbl { flex: 1; white-space: nowrap; }
            .cell-sep { font-weight: 900; }
            .poster-cell-value { flex: 1; min-width: 0; }
            .val-pill {
              display: inline-block;
              padding: 6px 14px;
              border-radius: 7px;
              font-weight: 800;
              font-size: 13.5px;
              line-height: 1.3;
              border: 1.5px solid transparent;
            }
            .pill-cyan { background: #e0f2fe; color: #0369a1; border-color: #bae6fd; }
            .pill-yellow { background: #fef08a; color: #92400e; border-color: #fde047; }
            .pill-pink { background: #fce7f3; color: #9d174d; border-color: #fbcfe8; }
            .pill-purple { background: #ede9fe; color: #5b21b6; border-color: #ddd6fe; }

            .poster-content-box {
              margin: 4px 14px 10px;
              background: #fffbeb;
              border: 2px dashed #f59e0b;
              border-radius: 10px;
              padding: 10px 14px;
              display: flex;
              align-items: flex-start;
              gap: 10px;
            }
            .hand-icon { font-size: 20px; flex-shrink: 0; }
            .content-hindi-text {
              font-size: 13.5px;
              font-weight: 700;
              color: #1e293b;
              line-height: 1.55;
              white-space: pre-wrap;
            }

            .poster-footer-composite {
              position: relative;
              background: linear-gradient(180deg, #ffffff 0%, #fffbeb 40%, #fef3c7 70%, #d97706 95%, #92400e 100%);
              border-top: 2px solid #fde68a;
              padding: 6px 10px 8px;
              display: flex;
              align-items: flex-end;
              justify-content: space-between;
              overflow: hidden;
            }
            .footer-kids-col {
              width: 120px;
              flex-shrink: 0;
              display: flex;
              align-items: flex-end;
              justify-content: center;
            }
            .footer-kids-img {
              width: 100%;
              max-width: 115px;
              height: auto;
              object-fit: contain;
              transform: translateY(3px);
            }
            .footer-center-col {
              flex: 1;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 5px;
              padding: 0 4px 3px;
              z-index: 2;
            }
            .brush-thank-you-btn {
              background: linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%);
              color: #ffffff;
              padding: 6px 22px;
              border-radius: 25px;
              box-shadow: 0 3px 8px rgba(220,38,38,0.4);
              border: 2px solid #fee2e2;
              position: relative;
            }
            .thank-you-script {
              font-family: 'Brush Script MT', 'Dancing Script', cursive, sans-serif;
              font-size: 22px;
              font-weight: 900;
              color: #ffffff;
            }
            .thank-you-burst {
              position: absolute;
              top: -5px;
              right: -6px;
              font-size: 13px;
            }
            .footer-motto-strip {
              display: flex;
              align-items: center;
              gap: 4px;
              font-size: 9px;
              font-weight: 900;
              letter-spacing: 0.6px;
              color: #78350f;
              background: rgba(255,255,255,0.9);
              padding: 2px 10px;
              border-radius: 8px;
              border: 1px solid #fde68a;
            }
            .motto-chip { font-weight: 900; }
            .c-blue { color: #0284c7; }
            .c-red { color: #dc2626; }
            .c-yellow { color: #d97706; }
            .c-green { color: #16a34a; }
            .motto-dot { color: #94a3b8; font-size: 10px; }
            .footer-time-overlay {
              font-size: 10px;
              font-weight: 800;
              color: #ffffff;
              text-shadow: 0 1px 2px rgba(0,0,0,0.85);
            }
            .footer-books-col {
              width: 120px;
              flex-shrink: 0;
              display: flex;
              align-items: flex-end;
              justify-content: flex-end;
            }
            .footer-books-img {
              width: 100%;
              max-width: 115px;
              height: auto;
              object-fit: contain;
              transform: translateY(3px);
            }
          </style>
        </head>
        <body>
          <div class="print-wrapper">
            ${printContent.innerHTML}
          </div>
          <script>
            window.addEventListener('load', () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 400);
            });
          </script>
        </body>
      </html>
    `);
    win.document.close();
  }
}
