import { Component, OnInit, OnDestroy, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { AuthService, BranchInfo } from '../core/services/auth.service';
import { MenuService, MenuItem } from '../core/services/menu.service';
import { IdleTimeoutService } from '../core/services/idle-timeout.service';
import { API_BASE, HolidayDto } from '../features/teachers/teacher.models';
import { FooterComponent } from './footer/footer.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatExpansionModule,
    MatDividerModule,
    MatMenuModule,
    MatTooltipModule,
    FooterComponent
  ],
  template: `
    <mat-sidenav-container class="sidenav-container">
      <mat-sidenav
        #drawer
        class="sidenav"
        [mode]="isMobile() ? 'over' : 'side'"
        [opened]="!isMobile()">

        <div class="brand-section">
          <div class="brand-logo-badge" *ngIf="!currentUser()?.profilePhoto">
            <mat-icon class="brand-icon">school</mat-icon>
          </div>
          <img *ngIf="currentUser()?.profilePhoto" [src]="getPhotoUrl(currentUser()?.profilePhoto)" class="brand-logo-img" alt="Logo">
          <div class="brand-titles">
            <span class="brand-name">{{ currentUser()?.instituteName || 'Apex Coaching Academy' }}</span>
            <span class="brand-sub">{{ currentUser()?.tenantCode || 'APEX' }} &bull; Multi-Tenant SaaS</span>
          </div>
          <button *ngIf="isMobile()" mat-icon-button class="close-drawer-btn" (click)="drawer.close()">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="nav-container">
          <mat-accordion class="menu-accordion" [multi]="false">
            <ng-container *ngFor="let item of menuTree()">
              <!-- Item with sub-menus (e.g. Master Management, Admin Settings) -->
              <mat-expansion-panel *ngIf="item.children && item.children.length > 0" class="mat-elevation-z0" [expanded]="false">
                <mat-expansion-panel-header [matTooltip]="item.title" matTooltipPosition="right">
                  <mat-panel-title class="accordion-title">
                    <span class="menu-icon-badge" [ngClass]="'badge-' + ((item.module || '') | lowercase)">
                      <mat-icon class="menu-icon">{{ item.icon || 'category' }}</mat-icon>
                    </span>
                    <span class="module-title">{{ item.title }}</span>
                  </mat-panel-title>
                </mat-expansion-panel-header>

                <div class="sub-nav-wrapper">
                  <mat-nav-list class="sub-nav-list">
                    <a *ngFor="let sub of item.children"
                       mat-list-item
                       [routerLink]="sub.routeUrl"
                       routerLinkActive="active-link"
                       [matTooltip]="sub.title"
                       matTooltipPosition="right"
                       (click)="onNavClick(drawer)">
                      <mat-icon matListItemIcon class="sub-icon">{{ sub.icon || 'star' }}</mat-icon>
                      <span matListItemTitle class="sub-title-text">{{ sub.title }}</span>
                    </a>
                  </mat-nav-list>
                </div>
              </mat-expansion-panel>

              <!-- Direct item without children (e.g. Dashboard) -->
              <div *ngIf="!item.children || item.children.length === 0" class="direct-nav-item">
                <a class="direct-nav-link"
                   [routerLink]="item.routeUrl"
                   routerLinkActive="active-link"
                   [routerLinkActiveOptions]="{ exact: item.routeUrl === '/' || item.routeUrl === '/dashboard' }"
                   [matTooltip]="item.title"
                   matTooltipPosition="right"
                   (click)="onNavClick(drawer)">
                  <span class="menu-icon-badge badge-main">
                    <mat-icon>{{ item.icon || 'space_dashboard' }}</mat-icon>
                  </span>
                  <span class="direct-title-text">{{ item.title }}</span>
                </a>
              </div>
            </ng-container>
          </mat-accordion>
        </div>

        <div class="sidebar-calendar">
          <div class="calendar-title-row">
            <strong><mat-icon>event</mat-icon> Holiday Calendar</strong>
            <span>{{ calendarYear }}</span>
          </div>
          <div class="calendar-controls">
            <button mat-icon-button type="button" (click)="changeCalendarMonth(-1)" matTooltip="Previous month">
              <mat-icon>chevron_left</mat-icon>
            </button>
            <strong>{{ calendarMonths[calendarMonth] }}</strong>
            <button mat-icon-button type="button" (click)="changeCalendarMonth(1)" matTooltip="Next month">
              <mat-icon>chevron_right</mat-icon>
            </button>
          </div>
          <div class="calendar-weekdays">
            <span *ngFor="let day of calendarWeekdays">{{ day }}</span>
          </div>
          <div class="calendar-grid">
            <span *ngFor="let blank of calendarLeadingBlanks"></span>
            <button
              *ngFor="let day of calendarDays"
              type="button"
              class="calendar-day"
              [class.today]="day.isToday"
              [class.saturday]="day.isSaturday"
              [class.sunday]="day.isSunday"
              [class.holiday]="day.holiday"
              [matTooltip]="getCalendarDayTooltip(day)"
              matTooltipPosition="right">
              {{ day.day }}
            </button>
          </div>
          <div class="calendar-legend">
            <span><i class="holiday-dot"></i> Holiday</span>
            <span><i class="sunday-dot"></i> Sun</span>
            <span><i class="saturday-dot"></i> Sat</span>
          </div>
        </div>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar color="primary" class="header-toolbar">
          <button type="button" mat-icon-button (click)="drawer.toggle()" class="menu-toggle-btn" aria-label="Toggle navigation">
            <mat-icon>menu</mat-icon>
          </button>

          <span class="app-header-title">Coaching Dashboard</span>
          <div class="header-tools">
            <div class="header-search" [class.open]="headerSearchFocused">
              <mat-icon>search</mat-icon>
              <input type="search" placeholder="Search pages..." [value]="headerSearch" (input)="onHeaderSearch($event)" (focus)="headerSearchFocused = true" (blur)="closeHeaderSearch()" aria-label="Search pages">
              <div class="search-results" *ngIf="headerSearchFocused && headerSearchResults.length > 0">
                <a *ngFor="let result of headerSearchResults" [routerLink]="result.route" (mousedown)="$event.preventDefault()" (click)="headerSearch = ''; headerSearchFocused = false">
                  <mat-icon>{{ result.icon }}</mat-icon><span>{{ result.title }}</span>
                </a>
              </div>
            </div>

            <button mat-icon-button [matMenuTriggerFor]="notificationMenu" class="header-tool-button" matTooltip="Notifications" aria-label="Notifications">
              <mat-icon>notifications_none</mat-icon><span class="notification-dot"></span>
            </button>
            <mat-menu #notificationMenu="matMenu" xPosition="before">
              <div class="menu-section-title">Notifications</div>
              <button mat-menu-item routerLink="/holidays"><mat-icon color="primary">event</mat-icon><span>View Holiday Calendar</span></button>
              <button mat-menu-item routerLink="/fees"><mat-icon color="warn">payments</mat-icon><span>Review Fee Collection</span></button>
              <button mat-menu-item routerLink="/attendance/reports"><mat-icon color="accent">summarize</mat-icon><span>Open Attendance Reports</span></button>
            </mat-menu>

            <button mat-stroked-button [matMenuTriggerFor]="quickActionsMenu" class="quick-actions-button" matTooltip="Quick actions">
              <mat-icon>bolt</mat-icon><span>Quick Actions</span>
            </button>
            <mat-menu #quickActionsMenu="matMenu" xPosition="before">
              <div class="menu-section-title">Quick Actions</div>
              <button mat-menu-item routerLink="/students"><mat-icon>person_add</mat-icon><span>Add Student</span></button>
              <button mat-menu-item routerLink="/teachers"><mat-icon>badge</mat-icon><span>Add Teacher</span></button>
              <button mat-menu-item routerLink="/attendance/reports"><mat-icon>summarize</mat-icon><span>Attendance Reports</span></button>
              <button mat-menu-item routerLink="/fees"><mat-icon>payments</mat-icon><span>Open Fee Collection</span></button>
            </mat-menu>
          </div>
          <span class="spacer"></span>

          <!-- Branch Switcher Dropdown Button -->
          <button mat-stroked-button [matMenuTriggerFor]="branchMenu" class="branch-selector-button" *ngIf="branches.length > 0" [matTooltip]="'Branch: ' + getCurrentBranchLabel()">
            <span class="branch-btn-content">
              <mat-icon class="branch-btn-icon">storefront</mat-icon>
              <span class="branch-name-full">{{ getCurrentBranchLabel() }}</span>
              <span class="branch-name-short">{{ getCurrentBranchCode() }}</span>
              <mat-icon class="dropdown-chevron">expand_more</mat-icon>
            </span>
          </button>

          <mat-menu #branchMenu="matMenu" xPosition="before" class="branch-dropdown-panel">
            <div class="menu-section-title">Active Branch Scope</div>
            <button mat-menu-item (click)="onSelectBranch(null)" [class.active-branch-item]="!selectedBranchId()">
              <mat-icon [color]="!selectedBranchId() ? 'primary' : ''">corporate_fare</mat-icon>
              <span>All Branches / Head Office</span>
              <mat-icon *ngIf="!selectedBranchId()" class="branch-check-icon">check</mat-icon>
            </button>
            <mat-divider></mat-divider>
            <button mat-menu-item *ngFor="let b of branches" (click)="onSelectBranch(b.id)" [class.active-branch-item]="selectedBranchId() === b.id">
              <mat-icon [color]="selectedBranchId() === b.id ? 'primary' : ''">store</mat-icon>
              <span>{{ b.name }} ({{ b.code }})</span>
              <mat-icon *ngIf="selectedBranchId() === b.id" class="branch-check-icon">check</mat-icon>
            </button>
          </mat-menu>
          
          <!-- User Account Menu Trigger Button -->
          <button mat-icon-button [matMenuTriggerFor]="accountMenu" class="account-btn" matTooltip="My Profile &amp; Settings">
            <mat-icon class="account-icon">account_circle</mat-icon>
          </button>

          <!-- Account Dropdown Menu -->
          <mat-menu #accountMenu="matMenu" xPosition="before" class="account-dropdown-panel">
            <div class="account-menu-header" (click)="$event.stopPropagation()">
              <div class="user-avatar-circle">
                <mat-icon>person</mat-icon>
              </div>
              <div class="user-info-text">
                <span class="user-name">{{ currentUser()?.fullName || currentUser()?.username || 'Administrator' }}</span>
                <span class="user-role">{{ currentUser()?.role || 'Admin' }} &bull; {{ getCurrentBranchLabel() }}</span>
                <span class="user-inst">{{ currentUser()?.instituteName || 'Apex Coaching Academy' }}</span>
              </div>
            </div>

            <mat-divider></mat-divider>

            <button mat-menu-item routerLink="/users">
              <mat-icon color="primary">manage_accounts</mat-icon>
              <span>User Profile &amp; Staff</span>
            </button>

            <button mat-menu-item routerLink="/rooms">
              <mat-icon style="color: #0284c7;">meeting_room</mat-icon>
              <span>Classrooms Master</span>
            </button>

            <button mat-menu-item routerLink="/roles">
              <mat-icon style="color: #6366f1;">admin_panel_settings</mat-icon>
              <span>Roles &amp; Permissions</span>
            </button>

            <button mat-menu-item routerLink="/admin/tenants">
              <mat-icon style="color: #059669;">corporate_fare</mat-icon>
              <span>Institutes &amp; Tenants</span>
            </button>

            <mat-divider></mat-divider>

            <button mat-menu-item (click)="logout()" class="logout-item">
              <mat-icon color="warn">logout</mat-icon>
              <span class="text-warn">Logout</span>
            </button>
          </mat-menu>
        </mat-toolbar>

        <main class="main-content">
          <router-outlet></router-outlet>
        </main>

        <!-- Global ERP Footer Component -->
        <app-footer></app-footer>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .sidenav-container {
      height: 100vh;
    }
    .sidenav {
      width: 295px !important;
      background-color: #0b1329 !important;
      border-right: 1px solid #1e293b;
      display: flex;
      flex-direction: column;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.25);
    }
    .brand-section {
      padding: 16px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      position: relative;
      background: #080d1a;
      border-bottom: 1px solid #1e293b;

      .brand-logo-img {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        object-fit: cover;
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
        flex-shrink: 0;
      }

      .brand-logo-badge {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px rgba(37, 99, 235, 0.45);
        flex-shrink: 0;

        .brand-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
          color: #ffffff;
        }
      }
      .brand-titles {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow: hidden;

        .brand-name {
          font-weight: 700;
          font-size: 0.98rem;
          color: #f8fafc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.01em;
        }
        .brand-sub {
          font-size: 0.7rem;
          color: #38bdf8;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
      }
      .close-drawer-btn {
        margin-left: auto;
        color: #94a3b8;
      }
    }
    .nav-container {
      flex: 1;
      overflow-y: auto;
      padding: 10px 8px;

      &::-webkit-scrollbar {
        width: 4px;
      }
      &::-webkit-scrollbar-track {
        background: transparent;
      }
      &::-webkit-scrollbar-thumb {
        background: #1e293b;
        border-radius: 2px;
      }
    }
    .menu-accordion {
      display: block;
      width: 100%;
      overflow: hidden;

      ::ng-deep .mat-expansion-panel-body {
        padding: 0 !important;
      }

      ::ng-deep mat-expansion-panel {
        background: transparent !important;
        box-shadow: none !important;
        margin: 0 0 4px 0 !important;
        border-radius: 8px !important;
        transition: background-color 180ms ease;

        &:hover {
          background: rgba(255, 255, 255, 0.04) !important;
        }

        &.mat-expanded {
          background: rgba(255, 255, 255, 0.02) !important;
        }
      }

      ::ng-deep mat-expansion-panel-header {
        height: 44px !important;
        padding: 0 12px !important;
        border-radius: 8px !important;
        background: transparent !important;
        transition: background-color 180ms ease;

        &:hover {
          background: rgba(255, 255, 255, 0.06) !important;
        }

        .mat-expansion-indicator::after {
          color: #94a3b8 !important;
        }
      }

      .accordion-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
        color: #e2e8f0;
        font-size: 0.88rem;

        .module-title {
          letter-spacing: 0.01em;
        }
      }
    }

    .menu-icon-badge {
      width: 28px;
      height: 28px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      .menu-icon, mat-icon {
        font-size: 17px;
        width: 17px;
        height: 17px;
        color: #ffffff;
      }

      &.badge-main {
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.35);
      }
      &.badge-master {
        background: linear-gradient(135deg, #06b6d4 0%, #0284c7 100%);
        box-shadow: 0 2px 8px rgba(6, 182, 212, 0.35);
      }
      &.badge-teachers {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);
      }
      &.badge-academic {
        background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
        box-shadow: 0 2px 8px rgba(168, 85, 247, 0.35);
      }
      &.badge-admin {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35);
      }
    }

    .sub-nav-wrapper {
      margin-left: 20px;
      padding-left: 10px;
      border-left: 2px solid rgba(255, 255, 255, 0.08);
      margin-top: 2px;
      margin-bottom: 6px;
    }

    .sub-nav-list {
      padding: 0;

      a[mat-list-item] {
        height: 38px;
        min-height: 38px;
        border-radius: 7px;
        margin: 2px 0;
        padding: 0 10px;
        transition: all 180ms ease;

        .sub-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #64748b;
          margin-right: 10px;
          transition: transform 180ms ease, color 180ms ease;
        }

        .sub-title-text {
          font-size: 0.84rem;
          font-weight: 500;
          color: #cbd5e1;
          letter-spacing: 0.01em;
          white-space: nowrap !important;
          overflow: visible !important;
          text-overflow: clip !important;
        }

        &:hover {
          background: rgba(255, 255, 255, 0.06);
          transform: translateX(3px);

          .sub-title-text {
            color: #ffffff;
          }
          .sub-icon {
            color: #38bdf8;
            transform: scale(1.1);
          }
        }

        &.active-link {
          background: linear-gradient(90deg, rgba(56, 189, 248, 0.18) 0%, rgba(56, 189, 248, 0.04) 100%) !important;
          border-left: 3px solid #38bdf8;
          box-shadow: none;

          .sub-title-text {
            color: #38bdf8 !important;
            font-weight: 600;
          }
          .sub-icon {
            color: #38bdf8 !important;
          }
        }
      }
    }

    .direct-nav-item {
      margin: 0 0 4px 0;

      .direct-nav-link {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 44px;
        padding: 0 12px;
        border-radius: 8px;
        text-decoration: none;
        box-sizing: border-box;
        cursor: pointer;
        transition: background-color 180ms ease, transform 180ms ease;

        .direct-title-text {
          font-size: 0.88rem;
          font-weight: 600;
          color: #e2e8f0;
          letter-spacing: 0.01em;
          white-space: nowrap !important;
          overflow: visible !important;
          text-overflow: clip !important;
        }

        &:hover {
          background: rgba(255, 255, 255, 0.06);
          transform: translateX(3px);
          .direct-title-text { color: #ffffff; }
        }

        &.active-link {
          background: linear-gradient(90deg, rgba(59, 130, 246, 0.22) 0%, rgba(59, 130, 246, 0.06) 100%) !important;
          border-left: 3px solid #38bdf8;
          padding-left: 9px;

          .direct-title-text {
            color: #38bdf8 !important;
            font-weight: 700;
          }
        }
      }
    }

    /* Angular Material MDC overrides to eliminate truncation */
    ::ng-deep .mat-mdc-list-item {
      .mdc-list-item__primary-text {
        overflow: visible !important;
        text-overflow: clip !important;
        white-space: nowrap !important;
      }
    }

    .user-footer {
      display: none;
    }

    .sidebar-calendar {
      border-top: 1px solid #1e293b;
      padding: 12px 14px;
      background: #080d1a;
      flex-shrink: 0;

      .calendar-title-row, .calendar-controls, .calendar-weekdays, .calendar-legend {
        display: flex;
        align-items: center;
      }
      .calendar-title-row {
        justify-content: space-between;
        color: #f1f5f9;
        font-size: 0.78rem;
        margin-bottom: 6px;
        strong { display: flex; align-items: center; gap: 6px; font-weight: 600; }
        mat-icon { color: #38bdf8; font-size: 17px; width: 17px; height: 17px; }
        span { color: #94a3b8; font-weight: 600; }
      }
      .calendar-controls {
        justify-content: space-between;
        color: #cbd5e1;
        font-size: 0.78rem;
        margin-bottom: 4px;
        button { width: 24px; height: 24px; line-height: 24px; padding: 0; color: #94a3b8; }
        button:hover { color: #ffffff; background: rgba(255, 255, 255, 0.08); }
        mat-icon { font-size: 18px; width: 18px; height: 18px; line-height: 18px; }
      }
      .calendar-weekdays, .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 3px;
      }
      .calendar-weekdays {
        margin: 4px 0 3px;
        text-align: center;
        color: #64748b;
        font-size: 0.62rem;
        font-weight: 700;
      }
      .calendar-day {
        min-width: 0;
        height: 25px;
        border: 1px solid transparent;
        border-radius: 5px;
        background: #111a2e;
        color: #cbd5e1;
        font-size: 0.68rem;
        cursor: default;
        padding: 0;
        transition: background 0.15s ease;

        &.today { border-color: #38bdf8; background: #0c4a6e; color: #38bdf8; font-weight: 800; }
        &.holiday { background: #78350f; color: #fde68a; border-color: #f59e0b; font-weight: 700; }
        &.sunday { background: #450a0a; color: #fca5a5; }
        &.saturday { background: #1e1b4b; color: #c7d2fe; }
        &.holiday.sunday, &.holiday.saturday { border-width: 2px; }
      }
      .calendar-legend {
        gap: 10px;
        margin-top: 8px;
        color: #94a3b8;
        font-size: 0.62rem;
        span { display: inline-flex; align-items: center; gap: 4px; }
        i { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .holiday-dot { background: #f59e0b; }
        .sunday-dot { background: #ef4444; }
        .saturday-dot { background: #818cf8; }
      }
    }
    .header-toolbar {
      background: linear-gradient(90deg, #0b1329 0%, #1e3a8a 100%) !important;
      border-bottom: 1px solid #1e293b;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 14px;
      flex-shrink: 0;
      z-index: 10;
      overflow: visible;
      flex-wrap: nowrap;

      @media (max-width: 600px) {
        padding: 0 6px;
        gap: 3px;
      }

      .menu-toggle-btn {
        flex-shrink: 0;
        color: #ffffff;
      }

      .app-header-title {
        font-weight: 600;
        font-size: 1.05rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex-shrink: 1;

        @media (max-width: 1200px) {
          max-width: 180px;
          font-size: 0.92rem;
        }

        @media (max-width: 900px) {
          display: none !important;
        }
      }
    }
    .header-tools {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: 10px;
      flex-shrink: 0;

      @media (max-width: 900px) {
        margin-left: 0;
        gap: 3px;
      }
    }
    .header-search {
      position: relative;
      display: flex;
      align-items: center;
      width: 180px;
      height: 34px;
      padding: 0 10px;
      gap: 7px;
      border: 1px solid rgba(255,255,255,.35);
      border-radius: 18px;
      background: rgba(255,255,255,.12);
      transition: width 180ms ease, background 180ms ease;
      flex-shrink: 0;

      @media (max-width: 800px) {
        width: 34px;
        padding: 0 8px;
        input {
          display: none;
        }
      }
    }
    .header-search.open {
      width: 230px;
      background: #fff;
      color: #334155;

      @media (max-width: 600px) {
        position: absolute;
        left: 50px;
        right: 50px;
        width: auto;
        z-index: 50;
      }
      input {
        display: block !important;
      }
    }
    .header-search > mat-icon { font-size:18px; width:18px; height:18px; color:inherit; flex-shrink: 0; }
    .header-search input { width:100%; border:0; outline:0; background:transparent; color:inherit; font:inherit; font-size:.78rem; }
    .header-search input::placeholder { color:rgba(255,255,255,.82); }
    .header-search.open input::placeholder { color:#94a3b8; }
    .search-results { position:absolute; top:40px; left:0; right:0; z-index:20; padding:5px; background:#fff; border:1px solid #e2e8f0; border-radius:8px; box-shadow:0 8px 22px rgba(15,23,42,.16); }
    .search-results a { display:flex; align-items:center; gap:8px; padding:8px; border-radius:5px; color:#334155; text-decoration:none; font-size:.78rem; }
    .search-results a:hover { background:#eff6ff; color:#2563eb; }
    .search-results mat-icon { font-size:18px; width:18px; height:18px; color:#2563eb; }
    .header-tool-button { position:relative; color:#fff; flex-shrink: 0; }
    .notification-dot { position:absolute; top:9px; right:9px; width:6px; height:6px; border-radius:50%; background:#fbbf24; border:1px solid #3f51b5; }
    .quick-actions-button {
      height: 34px;
      color: #fff;
      border-color: rgba(255,255,255,.5);
      font-size: .76rem;
      flex-shrink: 0;

      @media (max-width: 992px) {
        span { display: none; }
        min-width: 36px;
        padding: 0 8px;
      }
      @media (max-width: 650px) {
        display: none !important;
      }
    }
    .quick-actions-button mat-icon { font-size:17px; width:17px; height:17px; margin-right:3px; }
    .menu-section-title { padding:10px 16px 6px; color:#64748b; font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
    .spacer {
      flex: 1 1 auto;
      min-width: 8px;
    }
    .branch-selector-button {
      height: 38px;
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.4);
      background: rgba(255, 255, 255, 0.14);
      border-radius: 8px;
      padding: 0 10px !important;
      margin-right: 8px;
      font-size: 0.84rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      flex-shrink: 0;

      &:hover {
        background: rgba(255, 255, 255, 0.24);
        border-color: rgba(255, 255, 255, 0.75);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }

      ::ng-deep .mdc-button__label {
        display: inline-flex !important;
        align-items: center !important;
        height: 100% !important;
        padding: 0 !important;
      }

      .branch-btn-content {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .branch-btn-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #93c5fd;
        margin: 0 !important;
        flex-shrink: 0;
      }

      .branch-name-full {
        max-width: 320px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 500;
        margin: 0;
        line-height: normal;

        @media (max-width: 1200px) {
          max-width: 200px;
        }
        @media (max-width: 768px) {
          display: none !important;
        }
      }

      .branch-name-short {
        display: none;
        font-weight: 600;
        font-size: 0.75rem;
        letter-spacing: 0.5px;
        margin: 0;
        line-height: normal;

        @media (max-width: 768px) {
          display: inline-block !important;
        }
        @media (max-width: 400px) {
          display: none !important;
        }
      }

      .dropdown-chevron {
        font-size: 18px;
        width: 18px;
        height: 18px;
        opacity: 0.85;
        margin: 0 !important;
        flex-shrink: 0;
      }

      @media (max-width: 680px) {
        height: 34px;
        padding: 0 6px !important;
        margin-right: 4px;

        .branch-btn-content {
          gap: 4px;
        }
      }
    }

    ::ng-deep .branch-dropdown-panel {
      min-width: 300px !important;
      max-width: 400px !important;
      border-radius: 10px !important;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25) !important;

      .mat-mdc-menu-item {
        font-size: 0.85rem !important;
        height: 44px !important;
      }
    }

    .branch-check-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2563eb;
      margin-left: auto;
    }
    .active-branch-item {
      background-color: #eff6ff !important;
      font-weight: 600;
      color: #1d4ed8;
    }
    .whatsapp-status-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      background-color: rgba(255,255,255,0.2);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.78rem;

      .wa-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #4ade80;
      }
      .wa-text {
        @media (max-width: 680px) {
          display: none;
        }
      }
    }
    .account-btn {
      color: #ffffff;
      margin-left: 8px;
      transition: transform 0.15s ease, background-color 0.15s ease;

      &:hover {
        transform: scale(1.08);
        background-color: rgba(255, 255, 255, 0.15);
      }

      .account-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }
    }
    mat-sidenav-content {
      display: flex;
      flex-direction: column;
      height: 100vh;
      max-height: 100vh;
      overflow: hidden !important;
    }
    .main-content {
      padding: 24px;
      background-color: #f8fafc;
      flex: 1 1 0;
      min-height: 0;
      overflow-y: auto;

      @media (max-width: 768px) {
        padding: 12px;
      }
    }
    app-footer {
      flex-shrink: 0;
      z-index: 10;
    }
  `]
})
export class LayoutComponent implements OnInit {
  currentUser = this.authService.currentUser;
  menuTree = signal<MenuItem[]>([]);
  isMobile = signal<boolean>(false);
  headerSearch = '';
  headerSearchFocused = false;
  headerSearchResults: Array<{ title: string; route: string; icon: string }> = [];
  private readonly searchablePages = [
    { title: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
    { title: 'Students', route: '/students', icon: 'people' },
    { title: 'Student Attendance', route: '/students/attendance', icon: 'event_available' },
    { title: 'Batches', route: '/batches', icon: 'class' },
    { title: 'Subjects', route: '/subjects', icon: 'menu_book' },
    { title: 'Holiday Calendar', route: '/holidays', icon: 'event' },
    { title: 'Teacher Profiles', route: '/teachers', icon: 'badge' },
    { title: 'Teacher Attendance', route: '/teachers/attendance', icon: 'event_available' },
    { title: 'Attendance Reports', route: '/attendance/reports', icon: 'summarize' },
    { title: 'Biometric Devices', route: '/attendance/devices', icon: 'fingerprint' },
    { title: 'Fee Collection', route: '/fees', icon: 'payments' },
    { title: 'Tests & Report Cards', route: '/tests', icon: 'assignment' },
    { title: 'Classrooms (Rooms)', route: '/rooms', icon: 'meeting_room' },
    { title: 'Roles & Permissions', route: '/roles', icon: 'admin_panel_settings' },
    { title: 'Institutes & Tenants', route: '/admin/tenants', icon: 'corporate_fare' }
  ];
  selectedBranchId = this.authService.selectedBranchId;

  get branches(): BranchInfo[] {
    return this.currentUser()?.branches || [];
  }

  getCurrentBranchLabel(): string {
    const selectedId = this.selectedBranchId();
    if (selectedId) {
      const b = this.branches.find(x => x.id === selectedId);
      if (b) return `${b.name} (${b.code})`;
    }
    return this.currentUser()?.branchName || 'All Branches / Head Office';
  }

  getCurrentBranchCode(): string {
    const selectedId = this.selectedBranchId();
    if (selectedId) {
      const b = this.branches.find(x => x.id === selectedId);
      if (b) return b.code || b.name.substring(0, 4).toUpperCase();
    }
    return this.currentUser()?.branchName ? 'MAIN' : 'ALL';
  }

  onSelectBranch(branchId: string | null): void {
    this.authService.switchBranch(branchId);
    window.location.reload();
  }
  calendarMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  calendarWeekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  calendarMonth = new Date().getMonth();
  calendarYear = new Date().getFullYear();
  calendarLeadingBlanks: number[] = [];
  calendarDays: Array<{ day: number; date: string; isToday: boolean; isSaturday: boolean; isSunday: boolean; holiday?: HolidayDto }> = [];
  calendarHolidays: HolidayDto[] = [];

  @ViewChild('drawer') drawer!: MatSidenav;

  constructor(
    private authService: AuthService,
    private menuService: MenuService,
    private idleTimeout: IdleTimeoutService,
    private breakpointObserver: BreakpointObserver
  ) { }

  onHeaderSearch(event: Event): void {
    this.headerSearch = (event.target as HTMLInputElement).value;
    const query = this.headerSearch.trim().toLowerCase();
    this.headerSearchResults = query
      ? this.searchablePages.filter(page => page.title.toLowerCase().includes(query)).slice(0, 6)
      : [];
  }

  closeHeaderSearch(): void {
    setTimeout(() => this.headerSearchFocused = false, 120);
  }

  ngOnInit(): void {
    this.breakpointObserver.observe(['(max-width: 960px)']).subscribe((result) => {
      this.isMobile.set(result.matches);
    });

    this.loadMenu();
    this.loadCalendarHolidays();
    this.idleTimeout.startMonitoring();
  }

  ngOnDestroy(): void {
    this.idleTimeout.stopMonitoring();
  }

  changeCalendarMonth(offset: number): void {
    const next = new Date(this.calendarYear, this.calendarMonth + offset, 1);
    this.calendarMonth = next.getMonth();
    this.calendarYear = next.getFullYear();
    this.loadCalendarHolidays();
  }

  loadCalendarHolidays(): void {
    this.menuService.getHolidayCalendar(this.calendarYear, this.calendarMonth + 1).subscribe({
      next: holidays => {
        this.calendarHolidays = holidays || [];
        this.buildCalendar();
      },
      error: () => {
        this.calendarHolidays = [];
        this.buildCalendar();
      }
    });
  }

  buildCalendar(): void {
    const firstDay = new Date(this.calendarYear, this.calendarMonth, 1);
    const daysInMonth = new Date(this.calendarYear, this.calendarMonth + 1, 0).getDate();
    const today = new Date();
    this.calendarLeadingBlanks = Array.from({ length: firstDay.getDay() }, (_, index) => index);
    this.calendarDays = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = `${this.calendarYear}-${String(this.calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObject = new Date(this.calendarYear, this.calendarMonth, day);
      return {
        day,
        date,
        isToday: today.getFullYear() === this.calendarYear && today.getMonth() === this.calendarMonth && today.getDate() === day,
        isSaturday: dateObject.getDay() === 6,
        isSunday: dateObject.getDay() === 0,
        holiday: this.calendarHolidays.find(holiday => date >= holiday.startDate.split('T')[0] && date <= holiday.endDate.split('T')[0])
      };
    });
  }

  getCalendarDayTooltip(day: { date: string; isSaturday: boolean; isSunday: boolean; holiday?: HolidayDto }): string {
    const parts: string[] = [];
    if (day.holiday) {
      parts.push(`${day.holiday.title} (${day.holiday.holidayType})`);
      if (day.holiday.description) parts.push(day.holiday.description);
      parts.push(`From ${this.formatCalendarDate(day.holiday.startDate)} to ${this.formatCalendarDate(day.holiday.endDate)}`);
    }
    if (day.isSunday) parts.push('Sunday Weekly Off');
    if (day.isSaturday) parts.push('Saturday');
    return parts.length > 0 ? parts.join(' | ') : this.formatCalendarDate(day.date);
  }

  formatCalendarDate(value: string): string {
    const date = new Date(`${value.split('T')[0]}T00:00:00`);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getPhotoUrl(photo?: string | null): string {
    if (!photo) return '';
    if (photo.startsWith('/uploads/')) {
      return `http://localhost:5000${photo}`;
    }
    return photo;
  }

  onNavClick(drawer: MatSidenav): void {
    if (this.isMobile()) {
      drawer.close();
    }
  }

  loadMenu(): void {
    this.menuService.getMyMenu().subscribe({
      next: (menu) => {
        if (menu && menu.length > 0) {
          this.menuTree.set(menu);
        } else {
          this.fallbackMenu();
        }
      },
      error: () => {
        this.fallbackMenu();
      }
    });
  }

  private fallbackMenu(): void {
    this.menuTree.set([
      { id: '1', title: 'Dashboard', routeUrl: '/dashboard', icon: 'dashboard', sortOrder: 1, module: 'Main', isActive: true, children: [] },
      {
        id: '2', title: 'Master Management', routeUrl: '', icon: 'category', sortOrder: 2, module: 'Master', isActive: true,
        children: [
          { id: '21', title: 'Batches Master', routeUrl: '/batches', icon: 'class', sortOrder: 1, module: 'Master', isActive: true, children: [] },
          { id: '22', title: 'Classrooms Master', routeUrl: '/rooms', icon: 'meeting_room', sortOrder: 2, module: 'Master', isActive: true, children: [] },
          { id: '23', title: 'Subject Master', routeUrl: '/subjects', icon: 'menu_book', sortOrder: 3, module: 'Master', isActive: true, children: [] },
          { id: '24', title: 'Students Master', routeUrl: '/students', icon: 'people', sortOrder: 4, module: 'Master', isActive: true, children: [] },
          { id: '25', title: 'Holiday Master', routeUrl: '/holidays', icon: 'event', sortOrder: 5, module: 'Master', isActive: true, children: [] }
        ]
      },
      {
        id: '3', title: 'Teacher Module', routeUrl: '', icon: 'person', sortOrder: 3, module: 'Teachers', isActive: true,
        children: [
          { id: '31', title: 'Teacher Profiles', routeUrl: '/teachers', icon: 'badge', sortOrder: 1, module: 'Teachers', isActive: true, children: [] },
          { id: '32', title: 'Batch Assignments', routeUrl: '/teachers/assignments', icon: 'class', sortOrder: 2, module: 'Teachers', isActive: true, children: [] },
          { id: '33', title: 'Attendance', routeUrl: '/teachers/attendance', icon: 'event_available', sortOrder: 3, module: 'Teachers', isActive: true, children: [] },
          { id: '34', title: 'Salary Structure', routeUrl: '/teachers/salary', icon: 'account_balance_wallet', sortOrder: 4, module: 'Teachers', isActive: true, children: [] },
          { id: '35', title: 'Salary Payments', routeUrl: '/teachers/payments', icon: 'payments', sortOrder: 5, module: 'Teachers', isActive: true, children: [] },
          { id: '36', title: 'Salary Advances', routeUrl: '/teachers/advances', icon: 'currency_rupee', sortOrder: 6, module: 'Teachers', isActive: true, children: [] },
          { id: '37', title: 'Leave Management', routeUrl: '/teachers/leaves', icon: 'beach_access', sortOrder: 7, module: 'Teachers', isActive: true, children: [] }
        ]
      },
      {
        id: '4', title: 'Academic Operations', routeUrl: '', icon: 'school', sortOrder: 4, module: 'Academic', isActive: true,
        children: [
          { id: '41', title: 'Fee Collection', routeUrl: '/fees', icon: 'payments', sortOrder: 1, module: 'Academic', isActive: true, children: [] },
          { id: '42', title: 'Tests & Report Cards', routeUrl: '/tests', icon: 'assignment', sortOrder: 2, module: 'Academic', isActive: true, children: [] },
          { id: '43', title: 'WhatsApp Logs', routeUrl: '/whatsapp', icon: 'chat', sortOrder: 3, module: 'Academic', isActive: true, children: [] }
        ]
      },
      {
        id: '5', title: 'Admin Settings', routeUrl: '', icon: 'settings', sortOrder: 5, module: 'Admin', isActive: true,
        children: [
          { id: '51', title: 'Roles & Permissions', routeUrl: '/roles', icon: 'admin_panel_settings', sortOrder: 1, module: 'Admin', isActive: true, children: [] },
          { id: '52', title: 'User Management', routeUrl: '/users', icon: 'person_add', sortOrder: 2, module: 'Admin', isActive: true, children: [] },
          { id: '53', title: 'Biometric Devices', routeUrl: '/attendance/devices', icon: 'fingerprint', sortOrder: 3, module: 'Admin', isActive: true, children: [] },
          { id: '54', title: 'Institutes & Tenants', routeUrl: '/admin/tenants', icon: 'corporate_fare', sortOrder: 4, module: 'Admin', isActive: true, children: [] }
        ]
      }
    ]);
  }

  logout() {
    this.authService.logout();
  }
}
