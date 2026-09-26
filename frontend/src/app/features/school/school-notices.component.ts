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
          <button mat-stroked-button class="refresh-btn" (click)="loadNotices()" [disabled]="loading">
            <mat-icon [class.spin]="loading">refresh</mat-icon>
            <span>Refresh</span>
          </button>
          <button mat-raised-button class="create-btn" (click)="openNoticeDialog()">
            <mat-icon>post_add</mat-icon>
            <span>Publish Circular</span>
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
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Category</mat-label>
            <mat-select [(ngModel)]="filterCategory" (selectionChange)="loadNotices()">
              <mat-option value="">All Categories</mat-option>
              <mat-option value="Academic">📚 Academic</mat-option>
              <mat-option value="Administrative">🏛️ Administrative</mat-option>
              <mat-option value="Holiday">🌴 Holiday & Vacation</mat-option>
              <mat-option value="Examination">📝 Examination</mat-option>
              <mat-option value="Event">🎉 School Event</mat-option>
              <mat-option value="Fee Reminder">💰 Fee Reminder</mat-option>
              <mat-option value="Emergency">🚨 Emergency / Weather</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Target Audience</mat-label>
            <mat-select [(ngModel)]="filterAudience" (selectionChange)="loadNotices()">
              <mat-option value="">All Audiences</mat-option>
              <mat-option value="All">👥 Everyone (All)</mat-option>
              <mat-option value="Students">🎓 Students & Parents</mat-option>
              <mat-option value="Teachers">👨‍🏫 Teachers & Staff</mat-option>
              <mat-option value="Parents">👨‍👩‍👦 Parents Only</mat-option>
              <mat-option value="SpecificClass">🏫 Specific Class</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field" *ngIf="filterAudience === 'SpecificClass'">
            <mat-label>Class</mat-label>
            <mat-select [(ngModel)]="filterClassId" (selectionChange)="loadNotices()">
              <mat-option value="">All Classes</mat-option>
              <mat-option *ngFor="let c of classes" [value]="c.id">{{c.name}}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Priority</mat-label>
            <mat-select [(ngModel)]="filterPriority" (selectionChange)="loadNotices()">
              <mat-option value="">All Priorities</mat-option>
              <mat-option value="Urgent">🔥 Urgent Only</mat-option>
              <mat-option value="High">⚡ High Priority</mat-option>
              <mat-option value="Normal">ℹ️ Normal</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field search-field">
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

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <!-- Connection Error Alert -->
      <div class="conn-error-banner" *ngIf="!loading && hasConnectionError">
        <div class="err-info">
          <mat-icon class="err-ic">cloud_off</mat-icon>
          <div class="err-text">
            <strong>Backend Connection Offline (Port 5000)</strong>
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
          <p class="notice-snippet">{{n.content}}</p>

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
            <button mat-stroked-button class="view-btn" (click)="viewNotice(n)">
              <mat-icon>visibility</mat-icon>
              <span>View Circular</span>
            </button>

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
                <div class="tbl-sub">{{n.content | slice:0:70}}...</div>
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
    .notices-page-container { padding: 24px; display: flex; flex-direction: column; gap: 20px; background: #f8fafc; min-height: 100vh; }
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
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .stat-card { background: #fff; border-radius: 12px; padding: 18px 20px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 16px; }
    .stat-icon-wrap { width: 46px; height: 46px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .stat-icon-wrap mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .stat-total .stat-icon-wrap { background: #eff6ff; color: #2563eb; }
    .stat-urgent .stat-icon-wrap { background: #fef2f2; color: #dc2626; }
    .stat-pinned .stat-icon-wrap { background: #fffbeb; color: #d97706; }
    .stat-students .stat-icon-wrap { background: #ecfdf5; color: #059669; }
    .stat-val { font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1; }
    .stat-lbl { font-size: 12px; color: #64748b; margin-top: 4px; display: block; font-weight: 600; }

    /* Controls Strip */
    .controls-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .filter-row { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
    .filter-field { width: 170px; margin-bottom: -1.25em; }
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
    .view-btn { font-size: 11.5px; font-weight: 700; height: 30px; line-height: 30px; padding: 0 10px; border-color: #cbd5e1; color: #1e3a8a; }
    .view-btn mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 4px; }
    .card-actions { display: flex; align-items: center; gap: 4px; }
    .card-actions button[mat-icon-button] { width: 28px !important; height: 28px !important; min-width: 28px !important; padding: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; }
    .card-action-ic { font-size: 16px !important; width: 16px !important; height: 16px !important; line-height: 16px !important; margin: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; color: #64748b; }
    .card-action-ic.edit { color: #2563eb; }
    .card-action-ic.delete { color: #ef4444; }
    .card-action-ic.view { color: #059669; }
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
    @media (max-width: 768px) {
      .notices-page-container { padding: 12px; gap: 14px; }
      .page-header { padding: 14px; flex-direction: column; align-items: flex-start; gap: 14px; }
      .header-actions { width: 100%; display: flex; justify-content: space-between; }
      .filter-row { flex-direction: column; align-items: stretch; gap: 10px; }
      .filter-field { width: 100% !important; min-width: 100% !important; }
      .search-field { width: 100% !important; }
      .controls-card { padding: 14px; }
      .stats-grid { grid-template-columns: 1fr; }
      .dates-bar { font-size: 12px; }
    }
  `]
})
export class SchoolNoticesComponent implements OnInit {
  notices: SchoolNoticeDto[] = [];
  classes: any[] = [];
  loading = false;
  hasConnectionError = false;
  viewMode: 'grid' | 'table' = 'grid';

  filterCategory = '';
  filterAudience = '';
  filterClassId = '';
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
    private confirmDialog: ConfirmDialogService
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
    this.loadStats();
    this.loadNotices();
  }

  loadClasses(): void {
    this.http.get<any[]>(`${API_BASE}/school/classes`).subscribe({
      next: r => this.classes = r,
      error: () => this.classes = []
    });
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
      default: return 'groups';
    }
  }

  getAudienceText(n: SchoolNoticeDto): string {
    if (n.targetAudience === 'SpecificClass') {
      return n.className ? `Class: ${n.className}` : 'Specific Class';
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
      width: '680px',
      maxWidth: '95vw',
      data: { notice: item }
    });
  }

  openNoticeDialog(item?: SchoolNoticeDto): void {
    const ref = this.dialog.open(NoticeFormDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      disableClose: false,
      data: {
        notice: item,
        classes: this.classes
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
      if (!ok) return;
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
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule
  ],
  template: `
    <div class="notice-dialog-wrap">
      <!-- Strict AGENTS.md Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>{{isEdit ? 'edit_note' : 'post_add'}}</mat-icon>
          </div>
          <div>
            <h2 class="modal-title">{{isEdit ? 'Edit School Circular' : 'Publish New Circular / Notice'}}</h2>
            <p class="modal-subtitle">
              <strong style="color:#1e40af">{{isEdit ? model.noticeNumber : 'Official Institutional Notice'}}</strong>
              <span> &bull; Broadcast academic & admin announcements</span>
            </p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close(false)" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Form Body -->
      <div class="modal-body">
        <mat-form-field appearance="outline" class="full-field">
          <mat-label>Notice / Circular Title (परिपत्र का शीर्षक)</mat-label>
          <input matInput [(ngModel)]="model.title" placeholder="e.g. Schedule for Term 1 Exams / Winter Vacation Notice" required />
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Notice Category</mat-label>
            <mat-select [(ngModel)]="model.category">
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
            <mat-select [(ngModel)]="model.priority">
              <mat-option value="Normal">ℹ️ Normal</mat-option>
              <mat-option value="High">⚡ High Priority</mat-option>
              <mat-option value="Urgent">🔥 Urgent Announcement</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Target Audience (लक्षित समूह)</mat-label>
            <mat-select [(ngModel)]="model.targetAudience" (selectionChange)="onAudienceSelect()">
              <mat-option value="All">👥 Everyone (Students, Parents & Staff)</mat-option>
              <mat-option value="Students">🎓 Students & Parents</mat-option>
              <mat-option value="Teachers">👨‍🏫 Teaching Faculty & Staff</mat-option>
              <mat-option value="Parents">👨‍👩‍👦 Parents Only</mat-option>
              <mat-option value="SpecificClass">🏫 Specific Class</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field" *ngIf="model.targetAudience === 'SpecificClass'">
            <mat-label>Select Specific Class</mat-label>
            <mat-select [(ngModel)]="model.classId" (selectionChange)="onClassSelect()">
              <mat-option *ngFor="let c of data.classes" [value]="c.id">{{c.name}}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Publish Date</mat-label>
            <input matInput type="date" [(ngModel)]="publishDateStr" (change)="validateDates()" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Publish Time (IST)</mat-label>
            <input matInput type="time" [(ngModel)]="publishTimeStr" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Expiry Date (Optional)</mat-label>
            <input matInput type="date" [(ngModel)]="expiryDateStr" [min]="publishDateStr" (change)="validateDates()" />
          </mat-form-field>
        </div>

        <!-- Date Validation Alert -->
        <div class="date-error-banner" *ngIf="dateError">
          <mat-icon>error</mat-icon>
          <span>{{ dateError }}</span>
        </div>

        <mat-form-field appearance="outline" class="full-field">
          <mat-label>Official Circular Content (परिपत्र विवरण)</mat-label>
          <textarea matInput [(ngModel)]="model.content" rows="4" placeholder="Enter complete circular text, instructions, timings, requirements..." required></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-field">
          <mat-label>Attachment Document / PDF Link (वैकल्पिक लिंक)</mat-label>
          <input matInput [(ngModel)]="model.attachmentUrl" placeholder="https://... (Optional circular PDF / scan document)" />
        </mat-form-field>

        <div class="checkbox-row">
          <label class="custom-chk-label">
            <input type="checkbox" [(ngModel)]="model.isPinned" class="custom-chk" />
            <span>📌 Pin this notice to the top of the Notice Board</span>
          </label>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button mat-button (click)="dialogRef.close(false)" class="cancel-btn">Cancel</button>
        <button mat-raised-button class="save-btn" (click)="saveNotice()" [disabled]="saving || !model.title || !model.content || !!dateError">
          <mat-icon>{{isEdit ? 'save' : 'send'}}</mat-icon>
          <span>{{isEdit ? 'Save Changes' : 'Publish Notice'}}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .notice-dialog-wrap { display: flex; flex-direction: column; background: #fff; border-radius: 12px; overflow: hidden; }
    .modal-header { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-bottom: 1px solid #bfdbfe; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .header-icon-box { background: #2563eb; color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
    .modal-title { color: #1e3a8a; font-weight: 700; margin: 0; font-size: 18px; }
    .modal-subtitle { color: #3b82f6; margin: 3px 0 0; font-size: 12px; }
    .close-btn { color: #64748b; }
    .close-btn:hover { color: #1e293b; }

    .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 14px; max-height: 72vh; overflow-y: auto; }
    .form-row { display: flex; gap: 14px; }
    .form-field { flex: 1; }
    .full-field { width: 100%; }
    .checkbox-row { display: flex; align-items: center; padding: 4px 0; }
    .custom-chk-label { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #1e293b; cursor: pointer; }
    .custom-chk { width: 18px; height: 18px; accent-color: #2563eb; cursor: pointer; }

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
      animation: fadeIn 0.2s ease-in-out;
    }
    .date-error-banner mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #dc2626;
      flex-shrink: 0;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .modal-footer { padding: 14px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px; }
    .cancel-btn { color: #64748b; }
    .save-btn { background: #2563eb !important; color: #fff !important; font-weight: 700; }
  `]
})
export class NoticeFormDialogComponent implements OnInit {
  isEdit = false;
  saving = false;
  publishDateStr = '';
  publishTimeStr = '';
  expiryDateStr = '';
  dateError = '';

  model: any = {
    title: '',
    content: '',
    category: 'Academic',
    targetAudience: 'All',
    classId: null,
    className: '',
    priority: 'Normal',
    publishDate: '',
    expiryDate: null,
    attachmentUrl: '',
    isPinned: false
  };

  constructor(
    public dialogRef: MatDialogRef<NoticeFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const now = new Date();
    this.publishDateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    this.publishTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    if (this.data?.notice) {
      this.isEdit = true;
      const n = this.data.notice;
      this.model = { ...n };
      if (n.publishDate) {
        this.publishDateStr = n.publishDate.slice(0, 10);
        if (n.publishDate.length >= 16) {
          this.publishTimeStr = n.publishDate.slice(11, 16);
        }
      }
      if (n.expiryDate) this.expiryDateStr = n.expiryDate.slice(0, 10);
    }
    this.validateDates();
  }

  validateDates(): void {
    if (this.publishDateStr && this.expiryDateStr) {
      if (this.expiryDateStr < this.publishDateStr) {
        this.dateError = 'Expiry Date must be greater than or equal to Publish Date (Expiry Date, Publish Date se pehle nahi ho sakti).';
        return;
      }
    }
    this.dateError = '';
  }

  onAudienceSelect(): void {
    if (this.model.targetAudience !== 'SpecificClass') {
      this.model.classId = null;
      this.model.className = '';
    }
  }

  onClassSelect(): void {
    const c = this.data.classes?.find((x: any) => x.id === this.model.classId);
    this.model.className = c ? c.name : '';
  }

  saveNotice(): void {
    this.validateDates();
    if (this.dateError) {
      return;
    }

    this.saving = true;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const time = this.publishTimeStr ? `${this.publishTimeStr}:00` : `${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
    const dateStr = this.publishDateStr ? this.publishDateStr : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const payload = {
      ...this.model,
      publishDate: `${dateStr}T${time}`,
      expiryDate: this.expiryDateStr ? `${this.expiryDateStr}T23:59:59` : null
    };

    if (this.isEdit) {
      this.http.put(`${API_BASE}/notices/${this.model.id}`, payload).subscribe({
        next: () => {
          this.saving = false;
          this.dialogRef.close({ action: 'updated', title: this.model.title });
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
      <!-- Strict AGENTS.md Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>article</mat-icon>
          </div>
          <div>
            <h2 class="modal-title">Official Institutional Circular</h2>
            <p class="modal-subtitle">
              <strong style="color:#1e40af">{{data.notice.noticeNumber}}</strong>
              <span> &bull; {{data.notice.category}} Notice</span>
            </p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-stroked-button class="print-btn" (click)="printNotice()">
            <mat-icon>print</mat-icon> Print Circular
          </button>
          <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Printable Letterhead Paper -->
      <div class="circular-paper" id="printable-circular">
        <!-- School Letterhead Header -->
        <div class="paper-header">
          <div class="school-seal"><mat-icon>school</mat-icon></div>
          <div class="school-meta">
            <h1 class="school-name">APEX SCHOOL & ACADEMY</h1>
            <p class="school-tagline">CBSE Affiliation No. 330892 &bull; Excellence in Unified Education</p>
            <p class="school-addr">Main Campus &bull; Patna, Bihar &bull; Contact: +91 9540553975 &bull; info&#64;apexschool.edu</p>
          </div>
        </div>

        <div class="decorative-divider"></div>

        <!-- Reference & Date Line -->
        <div class="ref-date-row">
          <span class="ref-no">Ref No: <strong>{{data.notice.noticeNumber}}</strong></span>
          <span class="pub-date">Dated: <strong>{{data.notice.publishDate | date:'dd MMMM yyyy'}}</strong></span>
        </div>

        <!-- Circular Banner -->
        <div class="cir-banner">
          <span class="cir-badge" [class.urgent-badge]="data.notice.priority === 'Urgent'">
            {{data.notice.priority === 'Urgent' ? 'URGENT CIRCULAR' : 'OFFICIAL CIRCULAR'}}
          </span>
          <h2 class="paper-title">{{data.notice.title}}</h2>
          <div class="paper-audience">
            Target Audience: <strong>{{getAudienceDesc(data.notice)}}</strong>
          </div>
        </div>

        <!-- Body Content -->
        <div class="paper-body">
          <p class="greeting-line">Dear Parents, Students and Staff members,</p>
          <div class="body-paragraphs">
            {{data.notice.content}}
          </div>
          <p class="closing-line">
            Your kind cooperation and adherence to the above circular is solicited.
          </p>
        </div>

        <!-- Attachment Link if any -->
        <div class="paper-att-box" *ngIf="data.notice.attachmentUrl">
          <mat-icon>attach_file</mat-icon>
          <span>Attached Document: <a [href]="data.notice.attachmentUrl" target="_blank">{{data.notice.attachmentUrl}}</a></span>
        </div>

        <!-- Signature Block -->
        <div class="sign-block">
          <div class="sign-box">
            <div class="sign-line"></div>
            <span class="sign-title">Issued By: Academic Office</span>
            <span class="sign-sub">Apex School Academy</span>
          </div>
          <div class="sign-box">
            <div class="seal-placeholder">OFFICIAL<br>INSTITUTION<br>SEAL</div>
            <div class="sign-line"></div>
            <span class="sign-title">Principal / Director</span>
            <span class="sign-sub">Authorized Signatory</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .view-dialog-wrap { display: flex; flex-direction: column; background: #f1f5f9; border-radius: 12px; overflow: hidden; max-height: 90vh; }
    .modal-header { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-bottom: 1px solid #bfdbfe; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .header-icon-box { background: #2563eb; color: #ffffff; border-radius: 10px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; }
    .modal-title { color: #1e3a8a; font-weight: 700; margin: 0; font-size: 17px; }
    .modal-subtitle { color: #3b82f6; margin: 2px 0 0; font-size: 11.5px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }
    .print-btn { background: #2563eb; color: #fff; font-weight: 700; border-radius: 6px; }
    .close-btn { color: #64748b; }

    /* Paper Styling */
    .circular-paper { background: #fff; margin: 20px; padding: 36px 40px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow-y: auto; border: 1px solid #e2e8f0; font-family: 'Times New Roman', Georgia, serif; color: #1e293b; }
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

    .sign-block { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; padding-top: 20px; font-family: sans-serif; }
    .sign-box { display: flex; flex-direction: column; align-items: center; width: 200px; text-align: center; }
    .seal-placeholder { width: 70px; height: 70px; border-radius: 50%; border: 2px dashed #94a3b8; color: #94a3b8; font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; line-height: 1.2; text-align: center; }
    .sign-line { width: 140px; height: 1px; background: #64748b; margin-bottom: 6px; }
    .sign-title { font-size: 12px; font-weight: 700; color: #0f172a; }
    .sign-sub { font-size: 10.5px; color: #64748b; }
  `]
})
export class ViewNoticeDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ViewNoticeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { notice: SchoolNoticeDto }
  ) {}

  getAudienceDesc(n: SchoolNoticeDto): string {
    if (n.targetAudience === 'SpecificClass') return `Class: ${n.className || 'Selected Class'}`;
    if (n.targetAudience === 'All') return 'All Students, Parents & Staff';
    if (n.targetAudience === 'Students') return 'Students & Parents';
    if (n.targetAudience === 'Teachers') return 'Teachers & Academic Staff';
    if (n.targetAudience === 'Parents') return 'Parents';
    return n.targetAudience;
  }

  printNotice(): void {
    const printContent = document.getElementById('printable-circular');
    if (!printContent) return;
    const win = window.open('', '', 'width=800,height=900');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Circular - ${this.data.notice.noticeNumber}</title>
          <style>
            body { font-family: 'Times New Roman', Georgia, serif; margin: 30px; color: #000; }
            .school-name { font-size: 22px; font-weight: bold; text-align: center; margin: 0; }
            .school-tagline, .school-addr { font-size: 11px; text-align: center; margin: 3px 0; color: #333; }
            .decorative-divider { border-bottom: 2px solid #000; margin: 15px 0; }
            .ref-date-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 15px; }
            .cir-banner { text-align: center; margin: 20px 0; border: 1px solid #ccc; padding: 10px; }
            .cir-badge { font-weight: bold; font-size: 12px; }
            .paper-title { font-size: 17px; font-weight: bold; text-decoration: underline; margin: 5px 0; }
            .paper-body { font-size: 14px; line-height: 1.6; margin: 20px 0; text-align: justify; }
            .sign-block { display: flex; justify-content: space-between; margin-top: 60px; }
            .sign-box { text-align: center; }
            .sign-line { width: 140px; border-bottom: 1px solid #000; margin: 0 auto 6px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    win.document.close();
  }
}
