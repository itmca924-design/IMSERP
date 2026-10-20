import { Component, OnInit, OnDestroy, signal, effect, ViewChild, inject } from '@angular/core';
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
import { UsersService } from '../core/services/users.service';
import { MenuService, MenuItem } from '../core/services/menu.service';
import { TenantService } from '../core/services/tenant.service';
import { BranchService } from '../core/services/branch.service';
import { IdleTimeoutService } from '../core/services/idle-timeout.service';
import { TranslationService } from '../core/services/translation.service';
import { API_BASE, HolidayDto } from '../features/teachers/teacher.models';
import { FooterComponent } from './footer/footer.component';
import { QuickSettingsDrawerComponent } from './quick-settings-drawer/quick-settings-drawer.component';
import { PresenceService } from '../core/services/presence.service';
import { ChatService } from '../core/services/chat.service';
import { environment } from '../../environments/environment';

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
    FooterComponent,
    QuickSettingsDrawerComponent
  ],
  template: `
    <mat-sidenav-container class="sidenav-container">
      <mat-sidenav
        #drawer
        class="sidenav"
        [mode]="isMobile() ? 'over' : 'side'"
        [opened]="!isMobile()">

        <div class="brand-section">
          <img *ngIf="getInstituteLogoUrl() && !logoImgFailed()"
               [src]="getInstituteLogoUrl()" 
               (error)="logoImgFailed.set(true)"
               class="brand-logo-img" 
               alt="Institute Logo">
          <div *ngIf="!getInstituteLogoUrl() || logoImgFailed()" class="brand-fallback-icon">
            <mat-icon>account_balance</mat-icon>
          </div>
          <div class="brand-titles">
            <span class="brand-name" [matTooltip]="currentUser()?.instituteName || 'Institute Management ERP'">{{ currentUser()?.instituteName || 'Institute Management ERP' }}</span>
            <span class="brand-sub">{{ getTenantModuleBadge() }}</span>
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

          <span class="app-header-title">{{ getHeaderTitle() }}</span>
          <div class="header-tools">
            <div class="header-search" [class.open]="headerSearchFocused">
              <mat-icon>search</mat-icon>
              <input type="search" placeholder="Search pages" [value]="headerSearch" (input)="onHeaderSearch($event)" (focus)="onSearchFocus()" (blur)="closeHeaderSearch()" aria-label="Search pages">
              <div class="search-results" *ngIf="headerSearchFocused && headerSearchResults.length > 0">
                <a *ngFor="let result of headerSearchResults" [routerLink]="result.route" (mousedown)="$event.preventDefault()" (click)="headerSearch = ''; headerSearchFocused = false">
                  <mat-icon>{{ result.icon }}</mat-icon><span>{{ result.title }}</span>
                </a>
              </div>
            </div>

            <!-- Real-time Multi-tenant Branch-wise Active Users Live Button -->
            <button mat-stroked-button [matMenuTriggerFor]="activeUsersMenu" class="active-users-pill-btn" [matTooltip]="presenceService.activeUsersCount() + ' user(s) currently active in ' + getCurrentBranchLabel()" aria-label="Active Users">
              <span class="active-pulse-dot"></span>
              <mat-icon class="active-icon">group</mat-icon>
              <span class="active-count">{{ presenceService.activeUsersCount() }}</span>
              <span class="active-text">Online</span>
            </button>
            <mat-menu #activeUsersMenu="matMenu" xPosition="before" class="active-users-menu-panel">
              <div class="active-menu-header">
                <div class="title-row">
                  <span class="live-dot"></span>
                  <strong>Active Sessions ({{ presenceService.activeUsersCount() }})</strong>
                </div>
                <span class="branch-tag">{{ getCurrentBranchCode() }}</span>
              </div>
              <div class="active-menu-branch-scope">
                <mat-icon>storefront</mat-icon>
                <span>{{ getCurrentBranchLabel() }}</span>
              </div>
              <mat-divider></mat-divider>
              <div class="active-users-scroll-container">
                <div class="active-user-item-row" *ngFor="let u of presenceService.activeUsers()">
                  <div class="user-avatar-circle">{{ getInitials(u.fullName) }}</div>
                  <div class="user-details">
                    <div class="name-line">
                      <span class="user-name">{{ u.fullName }}</span>
                      <span class="self-badge" *ngIf="u.userId === currentUser()?.userId">You</span>
                    </div>
                    <div class="sub-line">
                      <span class="role-pill">{{ u.role }}</span>
                      <span class="branch-info" *ngIf="u.branchName">&bull; {{ u.branchName }}</span>
                    </div>
                  </div>
                  <span class="live-badge"><span class="dot"></span> Live</span>
                </div>
                <div class="no-other-users" *ngIf="presenceService.activeUsers().length === 0">
                  <mat-icon>person</mat-icon>
                  <span>1 active user online (You)</span>
                </div>
              </div>
            </mat-menu>

            <button mat-icon-button routerLink="/chat" class="header-tool-button" matTooltip="Campus & Class Chat" aria-label="Campus & Class Chat">
              <mat-icon>forum</mat-icon>
              <span class="chat-unread-badge" *ngIf="chatService.totalUnreadCount() > 0">
                {{ chatService.totalUnreadCount() > 99 ? '99+' : chatService.totalUnreadCount() }}
              </span>
            </button>

            <button mat-icon-button [matMenuTriggerFor]="notificationMenu" class="header-tool-button" matTooltip="Notifications" aria-label="Notifications">
              <mat-icon>notifications_none</mat-icon><span class="notification-dot"></span>
            </button>
            <mat-menu #notificationMenu="matMenu" xPosition="before">
              <div class="menu-section-title">Notifications</div>
              <div class="notification-active-users-card" [matMenuTriggerFor]="activeUsersMenu">
                <div class="pulse-indicator"></div>
                <div class="text-content">
                  <strong>{{ presenceService.activeUsersCount() }} Active Users in Branch</strong>
                  <small>{{ getCurrentBranchLabel() }}</small>
                </div>
                <mat-icon class="chevron">chevron_right</mat-icon>
              </div>
              <mat-divider></mat-divider>
              <button mat-menu-item routerLink="/fees" *ngIf="isRoutePermitted('/fees') && isUpcomingBillingWindowActive()">
                <mat-icon style="color: #2563eb;">calendar_month</mat-icon>
                <span>Upcoming Fee Invoicing Alert ({{ getUpcomingBillingCycleLabel() }})</span>
              </button>
              <button mat-menu-item routerLink="/holidays"><mat-icon color="primary">event</mat-icon><span>View Holidays</span></button>
              <button mat-menu-item routerLink="/fees" *ngIf="isRoutePermitted('/fees')"><mat-icon color="warn">payments</mat-icon><span>Review Overdue Fees</span></button>
              <button mat-menu-item routerLink="/attendance/reports" *ngIf="isRoutePermitted('/attendance/reports')"><mat-icon color="accent">summarize</mat-icon><span>Open Attendance Reports</span></button>
              <button mat-menu-item routerLink="/school/notices" *ngIf="isRoutePermitted('/school/notices')"><mat-icon color="primary">campaign</mat-icon><span>School Notices</span></button>
            </mat-menu>

            <button mat-stroked-button [matMenuTriggerFor]="quickActionsMenu" class="quick-actions-button" matTooltip="Quick Actions">
              <mat-icon>bolt</mat-icon><span>Quick Actions</span>
            </button>
            <mat-menu #quickActionsMenu="matMenu" xPosition="before" class="quick-actions-menu">
              <div class="menu-section-title">
                <mat-icon style="font-size:16px; width:16px; height:16px; margin-right:4px; vertical-align:middle;">bolt</mat-icon>
                <span>Quick Actions ({{ currentUser()?.role || 'User' }})</span>
              </div>
              <button mat-menu-item *ngFor="let a of dynamicQuickActions" [routerLink]="a.route">
                <mat-icon [style.color]="a.color">{{ a.icon }}</mat-icon>
                <span>{{ a.title }}</span>
              </button>
              <div *ngIf="dynamicQuickActions.length === 0" style="padding: 10px 16px; font-size: 12px; color: #64748b;">
                No quick actions configured for your role
              </div>
            </mat-menu>
          </div>
          <span class="spacer"></span>

          <!-- Branch Switcher Dropdown Button (Only for Admins) -->
          <button mat-stroked-button [matMenuTriggerFor]="branchMenu" class="branch-selector-button" *ngIf="branches.length > 0 && canSwitchBranches" [matTooltip]="'Branch: ' + getCurrentBranchLabel()">
            <span class="branch-btn-content">
              <mat-icon class="branch-btn-icon">storefront</mat-icon>
              <span class="branch-name-full">{{ getCurrentBranchLabel() }}</span>
              <span class="branch-name-short">{{ getCurrentBranchCode() }}</span>
              <mat-icon class="dropdown-chevron">expand_more</mat-icon>
            </span>
          </button>

          <!-- Branch Locked Badge for Staff / Teachers -->
          <div class="branch-locked-badge" *ngIf="branches.length > 0 && !canSwitchBranches" [matTooltip]="'Assigned Branch: ' + getCurrentBranchLabel()">
            <mat-icon class="branch-btn-icon">storefront</mat-icon>
            <span class="branch-name-full">{{ getCurrentBranchLabel() }}</span>
            <span class="branch-name-short">{{ getCurrentBranchCode() }}</span>
            <mat-icon class="lock-icon">lock</mat-icon>
          </div>

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
            <div class="header-avatar-circle" *ngIf="getUserPhoto() && !userAvatarFailed()">
              <img [src]="getPhotoUrl(getUserPhoto())" [alt]="currentUser()?.fullName" class="header-avatar-img" (error)="onUserAvatarError()" />
            </div>
            <div class="header-avatar-circle header-avatar-initials" *ngIf="(!getUserPhoto() || userAvatarFailed()) && currentUser()?.fullName">
              <span>{{ getUserInitials() }}</span>
            </div>
            <mat-icon *ngIf="(!getUserPhoto() || userAvatarFailed()) && !currentUser()?.fullName" class="account-icon">account_circle</mat-icon>
          </button>

          <!-- Account Dropdown Menu -->
          <mat-menu #accountMenu="matMenu" xPosition="before" class="account-dropdown-panel">
            <div class="account-menu-header" (click)="$event.stopPropagation()">
              <div class="user-avatar-circle">
                <img *ngIf="getUserPhoto() && !userAvatarFailed()" [src]="getPhotoUrl(getUserPhoto())" [alt]="currentUser()?.fullName" class="menu-avatar-img" (error)="onUserAvatarError()" />
                <span *ngIf="(!getUserPhoto() || userAvatarFailed()) && currentUser()?.fullName" class="avatar-initials-text">{{ getUserInitials() }}</span>
                <mat-icon *ngIf="(!getUserPhoto() || userAvatarFailed()) && !currentUser()?.fullName">person</mat-icon>
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

    <!-- Floating Settings Gear & Quick Settings Drawer -->
    <app-quick-settings-drawer></app-quick-settings-drawer>
  `,
  styles: [`
    .sidenav-container {
      height: 100vh;
    }
    .sidenav {
      width: 300px !important;
      background-color: #0b1329 !important;
      border-right: 1px solid #1e293b;
      display: flex;
      flex-direction: column;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.25);

      ::ng-deep .mat-drawer-inner-container {
        scrollbar-width: thin !important;
        scrollbar-color: transparent transparent !important;
        transition: scrollbar-color 0.25s ease !important;

        &::-webkit-scrollbar {
          width: 6px !important;
        }
        &::-webkit-scrollbar-track {
          background: transparent !important;
        }
        &::-webkit-scrollbar-button {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        &::-webkit-scrollbar-thumb {
          background: transparent !important;
          border-radius: 6px !important;
          transition: background-color 0.25s ease !important;
        }
      }

      &:hover {
        ::ng-deep .mat-drawer-inner-container {
          scrollbar-color: rgba(148, 163, 184, 0.4) transparent !important;

          &::-webkit-scrollbar-thumb {
            background: rgba(148, 163, 184, 0.4) !important;

            &:hover {
              background: rgba(148, 163, 184, 0.7) !important;
            }
          }
        }
      }
    }
    .brand-section {
      padding: 14px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      position: relative;
      background: #080d1a;
      border-bottom: 1px solid #1e293b;
      flex-shrink: 0;

      .brand-logo-img {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: contain;
        border: none;
        box-shadow: none;
        flex-shrink: 0;
        background: transparent !important;
        filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.45));
      }

      .brand-logo-badge {
        width: 38px;
        height: 38px;
        border-radius: 9px;
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px rgba(37, 99, 235, 0.45);
        flex-shrink: 0;

        .brand-icon {
          font-size: 22px;
          width: 22px;
          height: 22px;
          color: #ffffff;
        }
      }
      .brand-titles {
        display: flex;
        flex-direction: column;
        justify-content: center;
        flex: 1;
        min-width: 0;
        overflow: hidden;

        .brand-name {
          font-weight: 700;
          font-size: 0.93rem;
          color: #f8fafc;
          white-space: nowrap !important;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.01em;
          line-height: 1.25;
        }
        .brand-sub {
          font-size: 0.67rem;
          color: #38bdf8;
          font-weight: 600;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          white-space: nowrap !important;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.25;
          margin-top: 2px;
        }
      }
      .close-drawer-btn {
        margin-left: auto;
        color: #94a3b8;
        flex-shrink: 0;
      }
    }
    .nav-container {
      flex: 1;
      overflow-y: auto;
      padding: 10px 8px;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;

      &::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
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

      background: linear-gradient(135deg, #06b6d4 0%, #0284c7 100%);
      box-shadow: 0 2px 8px rgba(6, 182, 212, 0.35);

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
      &.badge-attendance {
        background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
        box-shadow: 0 2px 8px rgba(244, 63, 94, 0.35);
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
    .chat-unread-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      min-width: 17px;
      height: 17px;
      padding: 0 4px;
      border-radius: 9px;
      background: #ef4444;
      color: #ffffff;
      font-size: 0.65rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
      border: 1.5px solid #ffffff;
      line-height: 1;
    }
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
    /* Real-time Multi-tenant Branch-wise Active Users Badge & Dropdown */
    .active-users-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 34px !important;
      padding: 0 10px !important;
      border-radius: 18px !important;
      background: rgba(16, 185, 129, 0.16) !important;
      border: 1px solid rgba(52, 211, 153, 0.45) !important;
      color: #ffffff !important;
      font-size: 0.8rem !important;
      font-weight: 600 !important;
      cursor: pointer;
      transition: all 0.2s ease !important;
      flex-shrink: 0;

      &:hover {
        background: rgba(16, 185, 129, 0.28) !important;
        border-color: rgba(52, 211, 153, 0.75) !important;
        box-shadow: 0 0 12px rgba(16, 185, 129, 0.35) !important;
      }

      .active-pulse-dot {
        width: 8px;
        height: 8px;
        background: #10b981;
        border-radius: 50%;
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
        animation: activePulse 1.8s infinite;
      }

      .active-icon {
        font-size: 16px !important;
        width: 16px !important;
        height: 16px !important;
        line-height: 16px !important;
        color: #6ee7b7 !important;
        margin: 0 !important;
      }

      .active-count {
        font-size: 0.84rem !important;
        font-weight: 700 !important;
        color: #ffffff !important;
      }

      .active-text {
        font-size: 0.72rem !important;
        font-weight: 500 !important;
        color: #a7f3d0 !important;
      }

      @media (max-width: 650px) {
        padding: 0 6px !important;
        .active-text { display: none; }
      }
    }

    @keyframes activePulse {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      }
      70% {
        transform: scale(1.1);
        box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
      }
    }

    /* Active Users Dropdown Menu */
    ::ng-deep .active-users-menu-panel {
      min-width: 290px !important;
      max-width: 340px !important;
      border-radius: 12px !important;
      border: 1px solid #bfdbfe !important;
      box-shadow: 0 14px 30px rgba(15, 23, 42, 0.18) !important;
      overflow: hidden !important;

      .active-menu-header {
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        padding: 12px 14px 6px;
        display: flex;
        align-items: center;
        justify-content: space-between;

        .title-row {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #1e3a8a;
          font-size: 0.88rem;

          .live-dot {
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            display: inline-block;
          }
        }

        .branch-tag {
          font-size: 0.7rem;
          font-weight: 700;
          color: #1d4ed8;
          background: #dbeafe;
          padding: 2px 7px;
          border-radius: 6px;
          border: 1px solid #bfdbfe;
        }
      }

      .active-menu-branch-scope {
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        padding: 0 14px 10px;
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.75rem;
        color: #2563eb;
        font-weight: 600;

        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
          line-height: 14px;
        }
      }

      .active-users-scroll-container {
        max-height: 260px;
        overflow-y: auto;
        padding: 6px 0;

        .active-user-item-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          transition: background 0.15s ease;

          &:hover {
            background: #f8fafc;
          }

          .user-avatar-circle {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
            color: #ffffff;
            font-size: 0.76rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 5px rgba(37, 99, 235, 0.2);
          }

          .user-details {
            flex: 1;
            min-width: 0;

            .name-line {
              display: flex;
              align-items: center;
              gap: 5px;

              .user-name {
                font-size: 0.82rem;
                font-weight: 600;
                color: #1e293b;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }

              .self-badge {
                font-size: 0.65rem;
                font-weight: 700;
                color: #2563eb;
                background: #eff6ff;
                padding: 1px 5px;
                border-radius: 4px;
                border: 1px solid #bfdbfe;
              }
            }

            .sub-line {
              font-size: 0.72rem;
              color: #64748b;
              display: flex;
              align-items: center;
              gap: 4px;
              margin-top: 1px;

              .role-pill {
                font-weight: 600;
                color: #475569;
              }

              .branch-info {
                color: #94a3b8;
              }
            }
          }

          .live-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 0.68rem;
            font-weight: 700;
            color: #059669;
            background: #ecfdf5;
            padding: 2px 7px;
            border-radius: 10px;
            border: 1px solid #a7f3d0;

            .dot {
              width: 5px;
              height: 5px;
              background: #10b981;
              border-radius: 50%;
            }
          }
        }

        .no-other-users {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 16px;
          color: #64748b;
          font-size: 0.8rem;
          justify-content: center;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            color: #94a3b8;
          }
        }
      }
    }

    .notification-active-users-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      cursor: pointer;
      transition: background 0.2s ease;

      &:hover {
        background: #bbf7d0;
      }

      .pulse-indicator {
        width: 10px;
        height: 10px;
        background: #16a34a;
        border-radius: 50%;
        animation: activePulse 1.8s infinite;
        flex-shrink: 0;
      }

      .text-content {
        flex: 1;
        display: flex;
        flex-direction: column;

        strong {
          color: #166534;
          font-size: 0.82rem;
          font-weight: 700;
        }

        small {
          color: #15803d;
          font-size: 0.72rem;
        }
      }

      .chevron {
        color: #16a34a;
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .quick-actions-button mat-icon { font-size:17px; width:17px; height:17px; margin-right:3px; }
    .header-lang-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 10px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.16);
      border: 1px solid rgba(255, 255, 255, 0.35);
      color: #ffffff;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      outline: none;
      transition: all 0.2s ease;
      flex-shrink: 0;

      &:hover {
        background: rgba(255, 255, 255, 0.28);
        border-color: rgba(255, 255, 255, 0.65);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
      }

      .lang-flag-badge {
        font-size: 1rem;
        line-height: 1;
      }

      .lang-code-text {
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.2px;
      }
    }
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

    .branch-locked-badge {
      height: 36px;
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.25);
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 0 12px;
      margin-right: 8px;
      font-size: 0.84rem;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;

      .branch-btn-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #93c5fd;
      }

      .branch-name-full {
        max-width: 240px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        @media (max-width: 900px) { display: none; }
      }

      .branch-name-short {
        display: none;
        font-weight: 700;
        letter-spacing: 0.05em;
        @media (max-width: 900px) { display: inline-block; }
      }

      .lock-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: #e2e8f0;
        opacity: 0.85;
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
      padding: 0 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
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

      .header-avatar-circle {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid rgba(255, 255, 255, 0.9);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);

        .header-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        &.header-avatar-initials {
          color: #ffffff;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
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
  readonly translationService = inject(TranslationService);
  readonly presenceService = inject(PresenceService);
  readonly chatService = inject(ChatService);
  currentUser = this.authService.currentUser;

  getInitials(name?: string | null): string {
    if (!name) return 'U';
    const clean = name.replace(/[()[\]{}_-]/g, ' ').replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const parts = clean.split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  menuTree = signal<MenuItem[]>([]);
  isMobile = signal<boolean>(false);
  headerSearch = '';
  headerSearchFocused = false;
  headerSearchResults: Array<{ title: string; route: string; icon: string }> = [];
  private readonly searchablePages = [
    { title: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
    { title: 'My 360° Profile & Wall of Fame', route: '/students/my-profile', icon: 'military_tech' },
    { title: 'Class Timetable & Routine', route: '/students/timetable', icon: 'calendar_view_week' },
    { title: 'Classes & Sections (School)', route: '/school/classes', icon: 'domain' },
    { title: 'Period & Bell Timings Master', route: '/school/period-settings', icon: 'alarm_on' },
    { title: 'Students', route: '/students', icon: 'people' },
    { title: 'Student Attendance', route: '/students/attendance', icon: 'event_available' },
    { title: 'Batches', route: '/batches', icon: 'class' },
    { title: 'Subjects', route: '/subjects', icon: 'menu_book' },
    { title: 'Holiday Calendar', route: '/holidays', icon: 'event' },
    { title: 'Events & Celebrations', route: '/events', icon: 'celebration' },
    { title: 'Teacher Profiles', route: '/teachers', icon: 'badge' },
    { title: 'Teacher Reports', route: '/teachers/reports', icon: 'assessment' },
    { title: 'Teacher Attendance', route: '/teachers/attendance', icon: 'event_available' },
    { title: 'Attendance Reports', route: '/attendance/reports', icon: 'summarize' },
    { title: 'Biometric Devices', route: '/attendance/devices', icon: 'fingerprint' },
    { title: 'Shift & Policy Settings', route: '/attendance/settings', icon: 'settings_suggest' },
    { title: 'Fee Collection', route: '/fees', icon: 'payments' },
    { title: 'School Examinations & Marks', route: '/school/exams', icon: 'assignment' },
    { title: 'Student Promotion', route: '/students/promotion', icon: 'trending_up' },
    { title: 'Tests & Report Cards', route: '/tests', icon: 'quiz' },
    { title: 'Library Books Catalog', route: '/library/books', icon: 'local_library' },
    { title: 'Book Issue & Return Desk', route: '/library/circulation', icon: 'sync_alt' },
    { title: 'Library Shifts & Plans', route: '/library/plans', icon: 'schedule' },
    { title: 'Classrooms (Rooms)', route: '/rooms', icon: 'meeting_room' },
    { title: 'Branches Master', route: '/branches', icon: 'store' },
    { title: 'School Notices & Circulars', route: '/school/notices', icon: 'campaign' },
    { title: 'Transport & Fleet Management', route: '/transport', icon: 'directions_bus' },
    { title: 'Day Book (Daily Cash & Bank Journal)', route: '/finance/day-book', icon: 'auto_stories' },
    { title: 'Profit & Loss Statement', route: '/finance/profit-loss', icon: 'query_stats' },
    { title: 'Balance Sheet', route: '/finance/balance-sheet', icon: 'account_balance_wallet' },
    { title: 'Expense Vouchers', route: '/finance/expenses', icon: 'receipt_long' },
    { title: 'Chart of Accounts', route: '/finance/chart-of-accounts', icon: 'account_tree' },
    { title: 'Roles & Permissions', route: '/roles', icon: 'admin_panel_settings' },
    { title: 'Institutes & Tenants', route: '/admin/tenants', icon: 'corporate_fare' },
    { title: 'Subscription & Plan', route: '/subscription', icon: 'workspace_premium' },
    { title: 'Study Material & Question Bank Repository (Notes & PYQ)', route: '/study-materials', icon: 'auto_stories' },
    { title: 'Campus & Class Chat', route: '/chat', icon: 'forum' }
  ];

  readonly allQuickActionCatalog: Array<{ title: string; route: string; icon: string; color: string; roles?: string[] }> = [
    // Teacher / Faculty specific actions
    { title: 'Mark Daily Attendance', route: '/students/attendance', icon: 'how_to_reg', color: '#0284c7', roles: ['Teacher', 'Faculty', 'Teacher / Faculty', 'ClassTeacher'] },
    { title: 'Homework & Daily Diary', route: '/school/homework', icon: 'auto_stories', color: '#2563eb', roles: ['Teacher', 'Faculty', 'Teacher / Faculty', 'ClassTeacher'] },
    { title: 'School Examinations & Marks', route: '/school/exams', icon: 'assignment', color: '#7c3aed', roles: ['Teacher', 'Faculty', 'Teacher / Faculty', 'ClassTeacher'] },
    { title: 'Apply Leave Application', route: '/teachers/leaves', icon: 'event_busy', color: '#d97706', roles: ['Teacher', 'Faculty', 'Teacher / Faculty', 'ClassTeacher'] },
    { title: 'Request Salary Advance', route: '/teachers/advances', icon: 'account_balance_wallet', color: '#059669', roles: ['Teacher', 'Faculty', 'Teacher / Faculty', 'ClassTeacher'] },
    { title: 'Batch Assignments', route: '/teachers/assignments', icon: 'assignment_ind', color: '#4f46e5', roles: ['Teacher', 'Faculty', 'Teacher / Faculty', 'ClassTeacher'] },
    { title: 'Upload Notes & PYQs', route: '/study-materials', icon: 'auto_stories', color: '#8b5cf6', roles: ['Teacher', 'Faculty', 'Teacher / Faculty', 'ClassTeacher'] },

    // Student / Parent specific actions
    { title: 'My 360° Profile', route: '/students/my-profile', icon: 'military_tech', color: '#2563eb', roles: ['Student', 'Parent'] },
    { title: 'Class Timetable & Routine', route: '/students/timetable', icon: 'calendar_view_week', color: '#0ea5e9', roles: ['Student', 'Parent'] },
    { title: 'Download Notes & PYQ Bank', route: '/study-materials', icon: 'auto_stories', color: '#8b5cf6', roles: ['Student', 'Parent'] },
    { title: 'My Attendance Calendar', route: '/students/attendance', icon: 'calendar_month', color: '#0284c7', roles: ['Student', 'Parent'] },
    { title: 'My Homework Diary', route: '/school/homework', icon: 'auto_stories', color: '#7c3aed', roles: ['Student', 'Parent'] },
    { title: 'My Exam Results & Datesheet', route: '/my-exams', icon: 'assignment_turned_in', color: '#d97706', roles: ['Student', 'Parent'] },
    { title: 'Fee Receipts & Dues', route: '/my-fees', icon: 'receipt_long', color: '#059669', roles: ['Student', 'Parent'] },

    // Accountant actions
    { title: 'Day Book (Daily Cash Journal)', route: '/finance/day-book', icon: 'auto_stories', color: '#0ea5e9', roles: ['Accountant'] },
    { title: 'Fee Collection Desk', route: '/fees', icon: 'payments', color: '#059669', roles: ['Accountant'] },
    { title: 'Record Expense Voucher', route: '/finance/expenses', icon: 'receipt_long', color: '#d97706', roles: ['Accountant'] },
    { title: 'Profit & Loss Statement', route: '/finance/profit-loss', icon: 'query_stats', color: '#2563eb', roles: ['Accountant'] },
    { title: 'Balance Sheet', route: '/finance/balance-sheet', icon: 'account_balance_wallet', color: '#7c3aed', roles: ['Accountant'] },

    // Librarian actions
    { title: 'Book Issue & Return Desk', route: '/library/circulation', icon: 'sync_alt', color: '#2563eb', roles: ['Librarian'] },
    { title: 'Search Books Catalog', route: '/library/books', icon: 'local_library', color: '#059669', roles: ['Librarian'] },
    { title: 'Library Shifts & Plans', route: '/library/plans', icon: 'schedule', color: '#d97706', roles: ['Librarian'] },

    // Admin / Management / SuperAdmin actions
    { title: 'Register New Student', route: '/students', icon: 'person_add', color: '#2563eb', roles: ['SuperAdmin', 'InstituteAdmin', 'Admin'] },
    { title: 'Add Faculty / Staff', route: '/teachers', icon: 'badge', color: '#7c3aed', roles: ['SuperAdmin', 'InstituteAdmin', 'Admin'] },
    { title: 'Collect Student Fees', route: '/fees', icon: 'payments', color: '#059669', roles: ['SuperAdmin', 'InstituteAdmin', 'Admin'] },
    { title: 'Schedule School Exams', route: '/school/exams', icon: 'assignment', color: '#d97706', roles: ['SuperAdmin', 'InstituteAdmin', 'Admin'] },
    { title: 'Attendance Reports', route: '/attendance/reports', icon: 'summarize', color: '#4f46e5', roles: ['SuperAdmin', 'InstituteAdmin', 'Admin'] },
    { title: 'Mark Daily Attendance', route: '/students/attendance', icon: 'how_to_reg', color: '#0284c7', roles: ['SuperAdmin', 'InstituteAdmin', 'Admin'] },
    { title: 'Study Material & PYQs', route: '/study-materials', icon: 'auto_stories', color: '#8b5cf6', roles: ['SuperAdmin', 'InstituteAdmin', 'Admin'] },

    // Common fallback actions if permitted
    { title: 'School Notices & Circulars', route: '/school/notices', icon: 'campaign', color: '#0891b2' },
    { title: 'Holiday Calendar', route: '/holidays', icon: 'event', color: '#e11d48' }
  ];

  isRoutePermitted(route?: string | null): boolean {
    if (!route) return false;
    if (this.authService.isSuperAdmin()) return true;

    const target = route.trim().toLowerCase().split('?')[0];

    const checkList = (items: MenuItem[]): boolean => {
      for (const item of items) {
        if (item.routeUrl) {
          const itemRoute = item.routeUrl.trim().toLowerCase().split('?')[0];
          if (itemRoute === target || target.startsWith(itemRoute + '/')) {
            return true;
          }
        }
        if (item.children && item.children.length > 0) {
          if (checkList(item.children)) return true;
        }
      }
      return false;
    };

    return checkList(this.menuTree());
  }

  isUpcomingBillingWindowActive(): boolean {
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return today.getDate() > (lastDayOfMonth - 7);
  }

  getUpcomingBillingCycleLabel(): string {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return nextMonth.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
  }

  get permittedSearchablePages(): Array<{ title: string; route: string; icon: string }> {
    const list: Array<{ title: string; route: string; icon: string }> = [];
    const seen = new Set<string>();

    const traverse = (items: MenuItem[]) => {
      for (const item of items) {
        if (item.routeUrl) {
          const norm = item.routeUrl.trim().toLowerCase().split('?')[0];
          if (!seen.has(norm)) {
            seen.add(norm);
            list.push({
              title: item.title,
              route: item.routeUrl,
              icon: item.icon || 'arrow_forward'
            });
          }
        }
        if (item.children && item.children.length > 0) {
          traverse(item.children);
        }
      }
    };
    traverse(this.menuTree());

    for (const p of this.searchablePages) {
      const norm = p.route.trim().toLowerCase().split('?')[0];
      if (!seen.has(norm) && this.isRoutePermitted(norm)) {
        seen.add(norm);
        list.push(p);
      }
    }

    return list;
  }

  get dynamicQuickActions(): Array<{ title: string; route: string; icon: string; color: string }> {
    const userRole = this.currentUser()?.role || '';
    const userRoleLower = userRole.toLowerCase();

    // 1. Filter catalog items matching user role (or generic) AND permitted in menu
    const matched = this.allQuickActionCatalog.filter(action => {
      if (action.roles && action.roles.length > 0) {
        const roleMatches = action.roles.some(r => r.toLowerCase() === userRoleLower || userRoleLower.includes(r.toLowerCase()));
        if (!roleMatches) return false;
      }
      return this.isRoutePermitted(action.route);
    });

    if (matched.length > 0) {
      return matched.slice(0, 6);
    }

    // 2. Fallback: If no catalog action matched (e.g. custom role), pull top 5 permitted pages directly from menuTree!
    const fallbackList: Array<{ title: string; route: string; icon: string; color: string }> = [];
    const colors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#0284c7', '#0891b2'];
    let cIdx = 0;
    for (const p of this.permittedSearchablePages) {
      if (p.route !== '/dashboard') {
        fallbackList.push({
          title: p.title,
          route: p.route,
          icon: p.icon || 'bolt',
          color: colors[cIdx % colors.length]
        });
        cIdx++;
        if (fallbackList.length >= 6) break;
      }
    }
    return fallbackList;
  }
  selectedBranchId = this.authService.selectedBranchId;
  activeBranches = signal<BranchInfo[]>(this.currentUser()?.branches || []);

  get canSwitchBranches(): boolean {
    const role = this.currentUser()?.role;
    return role === 'SuperAdmin' || role === 'InstituteAdmin';
  }

  toggleLanguage(): void {
    this.translationService.toggleLanguage();
  }

  get branches(): BranchInfo[] {
    const list = this.activeBranches();
    if (list && list.length > 0) return list;
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

  logoImgFailed = signal(false);
  headerLogoFailed = signal(false);
  userAvatarFailed = signal(false);
  private rawMenu: MenuItem[] = [];

  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private tenantService: TenantService,
    private branchService: BranchService,
    private menuService: MenuService,
    private idleTimeout: IdleTimeoutService,
    private breakpointObserver: BreakpointObserver
  ) {
    effect(() => {
      const user = this.currentUser();
      if (user?.profilePhoto) {
        this.logoImgFailed.set(false);
        this.headerLogoFailed.set(false);
      }
      if (user?.userProfilePhoto) {
        this.userAvatarFailed.set(false);
      }
    }, { allowSignalWrites: true });

    effect(() => {
      // Reactively re-filter menu when any module license is toggled
      this.authService.hasSchoolModule();
      this.authService.hasCoachingModule();
      this.authService.hasHostelModule();
      this.authService.hasLibraryModule();
      this.authService.hasTransportModule();

      if (this.rawMenu && this.rawMenu.length > 0) {
        let filtered = this.filterMenuByModules(this.rawMenu);
        if (this.authService.isStudentOrParent()) {
          filtered = this.adjustStudentMenu(filtered);
        }
        this.menuTree.set(filtered);
      }
    }, { allowSignalWrites: true });
  }

  getInstituteLogoUrl(): string | null {
    return this.authService.getInstituteLogoUrl();
  }

  onLogoImgError(): void {
    this.logoImgFailed.set(true);
  }

  loadCurrentTenant(): void {
    this.tenantService.getCurrentTenant().subscribe({
      next: (t) => {
        if (t) {
          this.logoImgFailed.set(false);
          this.headerLogoFailed.set(false);
          this.authService.updateTenantProfile(t.profilePhoto, t.name, t.code);
          this.authService.updateTenantModules({
            hasSchoolModule: t.hasSchoolModule,
            hasCoachingModule: t.hasCoachingModule,
            hasHostelModule: t.hasHostelModule,
            hasLibraryModule: t.hasLibraryModule,
            hasTransportModule: t.hasTransportModule,
            licensedModules: t.licensedModules
          });
          this.loadMenu();
        }
      },
      error: () => {}
    });
  }

  onHeaderSearch(event: Event): void {
    this.headerSearch = (event.target as HTMLInputElement).value;
    const query = this.headerSearch.trim().toLowerCase();
    this.headerSearchResults = query
      ? this.permittedSearchablePages.filter(page => {
          return page.title.toLowerCase().includes(query) || page.route.toLowerCase().includes(query);
        }).slice(0, 8)
      : this.permittedSearchablePages.slice(0, 6);
  }

  onSearchFocus(): void {
    this.headerSearchFocused = true;
    const query = this.headerSearch.trim().toLowerCase();
    this.headerSearchResults = query
      ? this.permittedSearchablePages.filter(page => {
          return page.title.toLowerCase().includes(query) || page.route.toLowerCase().includes(query);
        }).slice(0, 8)
      : this.permittedSearchablePages.slice(0, 6);
  }

  closeHeaderSearch(): void {
    setTimeout(() => this.headerSearchFocused = false, 200);
  }

  loadHeaderBranches(): void {
    if (!this.canSwitchBranches) return;
    this.branchService.getAllBranches().subscribe({
      next: (list) => {
        if (list && list.length > 0) {
          const branchInfos: BranchInfo[] = list.map(b => ({
            id: b.id,
            tenantId: b.tenantId,
            name: b.name,
            code: b.code,
            address: b.address,
            contactPhone: b.contactPhone,
            isMainBranch: b.isMainBranch,
            isActive: b.isActive,
            createdAt: b.createdAt
          }));
          this.activeBranches.set(branchInfos);
          this.authService.updateBranches(branchInfos);
        }
      },
      error: () => {}
    });
  }

  ngOnInit(): void {
    this.breakpointObserver.observe(['(max-width: 960px)']).subscribe((result) => {
      this.isMobile.set(result.matches);
    });

    this.loadCurrentTenant();
    this.loadUserProfile();
    this.loadHeaderBranches();
    this.branchService.branchesChanged.subscribe(() => {
      this.loadHeaderBranches();
    });
    this.loadMenu();
    this.loadCalendarHolidays();
    this.idleTimeout.startMonitoring();
    this.presenceService.init();
    this.chatService.initHub();
    this.chatService.loadConversations().subscribe({ error: () => {} });
  }

  ngOnDestroy(): void {
    this.idleTimeout.stopMonitoring();
    this.presenceService.stopConnection();
    this.chatService.stopHub();
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
    return this.authService.resolveLogoUrl(photo) || '';
  }

  getUserPhoto(): string | null {
    const user = this.currentUser();
    if (!user) return null;
    return user.userProfilePhoto || null;
  }

  getUserInitials(): string {
    const raw = this.currentUser()?.fullName || this.currentUser()?.username || '';
    if (!raw) return 'U';
    const cleaned = raw.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
    const parts = cleaned.split(/\s+/).filter(p => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return raw.slice(0, 2).toUpperCase();
  }

  onUserAvatarError(): void {
    this.userAvatarFailed.set(true);
  }

  loadUserProfile(): void {
    if (this.authService.isLoggedIn()) {
      this.usersService.getCurrentUserProfile().subscribe({
        next: (profile) => {
          if (profile && profile.profilePhoto) {
            this.userAvatarFailed.set(false);
            this.authService.updateUserProfilePhoto(profile.profilePhoto);
          }
        },
        error: () => {}
      });
    }
  }

  onNavClick(drawer: MatSidenav): void {
    if (this.isMobile()) {
      drawer.close();
    }
  }

  getTenantModuleBadge(): string {
    const s = this.authService.hasSchoolModule();
    const c = this.authService.hasCoachingModule();
    const h = this.authService.hasHostelModule();
    const l = this.authService.hasLibraryModule();
    const t = this.authService.hasTransportModule();

    const parts: string[] = [];
    if (s && c) parts.push('School + Coaching');
    else if (s) parts.push('School Edition');
    else if (c) parts.push('Coaching Edition');
    else parts.push('ERP Suite');

    if (h) parts.push('Hostel');
    if (l) parts.push('Library');
    if (t) parts.push('Transport');

    return parts.join(' • ');
  }

  getHeaderTitle(): string {
    const s = this.authService.hasSchoolModule();
    const c = this.authService.hasCoachingModule();
    if (s && c) return 'School + Coaching ERP';
    if (s && !c) return 'School ERP • Management System';
    if (!s && c) return 'School ERP • Coaching & Tuitions';
    return 'School ERP • Enterprise System';
  }

  filterMenuByModules(menu: MenuItem[]): MenuItem[] {
    const isSuperAdmin = this.authService.isSuperAdmin();
    const isAdmin = this.authService.isAdmin();
    const isAccountant = this.authService.isAccountant();
    const canAccessFinance = isAdmin || isAccountant;
    const hasSchool = this.authService.hasSchoolModule();
    const hasCoaching = this.authService.hasCoachingModule();
    const hasHostel = this.authService.hasHostelModule();
    const hasLibrary = this.authService.hasLibraryModule();
    const hasTransport = this.authService.hasTransportModule();

    const isRouteAllowed = (url?: string): boolean => {
      if (!url) return true;
      const lower = url.toLowerCase();

      // Quick Settings tabs are drawer permission items, NEVER sidebar navigation items
      if (lower.startsWith('/settings/quick')) {
        return false;
      }

      // Only SuperAdmin can see Subscription & Plan in sidebar menu
      if (!isSuperAdmin && lower === '/subscription') {
        return false;
      }

      // Finance & Accounts is strictly restricted to Admin & Accountant roles
      if (!canAccessFinance && lower.includes('/finance')) {
        return false;
      }

      if (!hasSchool && !hasCoaching && lower.includes('/school/homework')) {
        return false;
      }
      if (!hasSchool && (lower.includes('/school/classes') || lower.includes('/school/exams') || lower.includes('/students/promotion') || lower.includes('/school/notices'))) {
        return false;
      }
      if (!hasCoaching && lower === '/batches') {
        return false;
      }
      if (!hasSchool && !hasCoaching && lower === '/tests') {
        return false;
      }
      if (!hasHostel && lower.includes('/hostel')) {
        return false;
      }
      if (!hasLibrary && lower.includes('/library')) {
        return false;
      }
      if (!hasTransport && lower.includes('/transport')) {
        return false;
      }
      return true;
    };

    return (menu || [])
      .filter(item => item.module !== 'Quick Settings' && (!item.routeUrl || !item.routeUrl.toLowerCase().startsWith('/settings/quick')))
      .map(item => {
        if (item.children && item.children.length > 0) {
          const children = item.children.filter(c => isRouteAllowed(c.routeUrl));
          return { ...item, children };
        }
        return item;
      })
      .filter(item => {
        if (!item.children || item.children.length === 0) {
          return isRouteAllowed(item.routeUrl);
        }
        return item.children.length > 0;
      });
  }

  loadMenu(): void {
    this.menuService.getMyMenu().subscribe({
      next: (menu) => {
        if (menu && menu.length > 0) {
          menu = this.adjustAdminWorkflowMenu(menu);
          this.rawMenu = menu;
          let filtered = this.filterMenuByModules(menu);
          if (this.authService.isStudentOrParent()) {
            filtered = this.adjustStudentMenu(filtered);
          }
          this.menuTree.set(filtered);
        } else {
          this.fallbackMenu();
        }
      },
      error: () => {
        this.fallbackMenu();
      }
    });
  }

  private adjustAdminWorkflowMenu(menu: MenuItem[]): MenuItem[] {
    if (!menu || menu.length === 0) return menu;
    if (this.authService.isStudentOrParent()) {
      return menu;
    }

    const workflowItemAdmin: MenuItem = {
      id: 'admin-academic-workflow',
      title: 'Academic & Exam Workflow',
      routeUrl: '/admin/academic-workflow',
      icon: 'tune',
      sortOrder: 6,
      module: 'Admin',
      isActive: true,
      children: []
    };

    const workflowItemAcademic: MenuItem = {
      id: 'academic-workflow-link',
      title: 'Academic & Exam Workflow',
      routeUrl: '/admin/academic-workflow',
      icon: 'tune',
      sortOrder: 5.5,
      module: 'Academic',
      isActive: true,
      children: []
    };

    const timetableItemAcademic: MenuItem = {
      id: 'academic-timetable-link',
      title: 'Class Timetable & Routine',
      routeUrl: '/students/timetable',
      icon: 'calendar_view_week',
      sortOrder: 3.5,
      module: 'Academic',
      isActive: true,
      children: []
    };

    const timetableItemMaster: MenuItem = {
      id: 'master-timetable-link',
      title: 'Class Timetable & Routine',
      routeUrl: '/students/timetable',
      icon: 'calendar_view_week',
      sortOrder: 5.5,
      module: 'Master',
      isActive: true,
      children: []
    };

    const timetableItemFaculty: MenuItem = {
      id: 'faculty-timetable-link',
      title: 'Class Timetable & Routine',
      routeUrl: '/students/timetable',
      icon: 'calendar_view_week',
      sortOrder: 3.5,
      module: 'Teachers',
      isActive: true,
      children: []
    };

    const studyMaterialsItemAcademic: MenuItem = {
      id: 'academic-study-materials-link',
      title: 'Study Material & PYQ Bank',
      routeUrl: '/study-materials',
      icon: 'auto_stories',
      sortOrder: 3.8,
      module: 'Academic',
      isActive: true,
      children: []
    };

    const studyMaterialsItemFaculty: MenuItem = {
      id: 'faculty-study-materials-link',
      title: 'Study Material & PYQs',
      routeUrl: '/study-materials',
      icon: 'auto_stories',
      sortOrder: 3.8,
      module: 'Teachers',
      isActive: true,
      children: []
    };

    const studyMaterialsItemMaster: MenuItem = {
      id: 'master-study-materials-link',
      title: 'Study Material & PYQ Bank',
      routeUrl: '/study-materials',
      icon: 'auto_stories',
      sortOrder: 5.8,
      module: 'Master',
      isActive: true,
      children: []
    };

    const teachersMasterItem: MenuItem = {
      id: 'master-teachers-link',
      title: 'Teachers Master',
      routeUrl: '/teachers',
      icon: 'groups',
      sortOrder: 5.2,
      module: 'Master',
      isActive: true,
      children: []
    };

    const testsItemAcademic: MenuItem = {
      id: 'academic-tests-link',
      title: 'Test Exams & Marks Entry',
      routeUrl: '/tests',
      icon: 'quiz',
      sortOrder: 4.2,
      module: 'Academic',
      isActive: true,
      children: []
    };

    const testsItemFaculty: MenuItem = {
      id: 'faculty-tests-link',
      title: 'Test Exams & Marks Entry',
      routeUrl: '/tests',
      icon: 'quiz',
      sortOrder: 3.2,
      module: 'Teachers',
      isActive: true,
      children: []
    };

    let updated = (menu || []).map(item => {
      const copy = { ...item, children: item.children ? [...item.children] : [] };

      // 1. Inject into Admin Settings
      const isAdminSettings = (copy.title && copy.title.toLowerCase().includes('admin')) ||
                              copy.id === '6' ||
                              (copy.module && copy.module.toLowerCase() === 'admin');
      if (isAdminSettings) {
        if (!copy.children.some(c => c.routeUrl === '/admin/academic-workflow')) {
          copy.children.push(workflowItemAdmin);
        }
      }

      // 2. Also inject into Academic Operations
      const isAcademic = (copy.title && copy.title.toLowerCase().includes('academic')) ||
                         copy.id === '5' ||
                         (copy.module && copy.module.toLowerCase() === 'academic');
      if (isAcademic) {
        if (!copy.children.some(c => c.routeUrl === '/admin/academic-workflow')) {
          const promoIdx = copy.children.findIndex(c => c.routeUrl === '/students/promotion' || c.routeUrl === '/school/exams');
          if (promoIdx >= 0) {
            copy.children.splice(promoIdx + 1, 0, workflowItemAcademic);
          } else {
            copy.children.push(workflowItemAcademic);
          }
        }
        if (!copy.children.some(c => c.routeUrl === '/tests')) {
          const examIdx = copy.children.findIndex(c => c.routeUrl === '/school/exams' || c.routeUrl === '/admin/academic-workflow');
          if (examIdx >= 0) {
            copy.children.splice(examIdx + 1, 0, testsItemAcademic);
          } else {
            copy.children.push(testsItemAcademic);
          }
        }
        if (!copy.children.some(c => c.routeUrl === '/students/timetable')) {
          const hwIdx = copy.children.findIndex(c => c.routeUrl === '/school/homework');
          if (hwIdx >= 0) {
            copy.children.splice(hwIdx + 1, 0, timetableItemAcademic);
          } else {
            copy.children.push(timetableItemAcademic);
          }
        }
        if (!copy.children.some(c => c.routeUrl === '/study-materials')) {
          const ttIdx = copy.children.findIndex(c => c.routeUrl === '/students/timetable');
          if (ttIdx >= 0) {
            copy.children.splice(ttIdx + 1, 0, studyMaterialsItemAcademic);
          } else {
            copy.children.push(studyMaterialsItemAcademic);
          }
        }
      }

      // 3. Inject into Master Management / Student Center
      const isMaster = (copy.title && copy.title.toLowerCase().includes('master')) ||
                       (copy.title && copy.title.toLowerCase().includes('student center')) ||
                       copy.id === '2' ||
                       (copy.module && copy.module.toLowerCase() === 'master');
      if (isMaster) {
        if (!copy.children.some(c => c.routeUrl === '/students/timetable')) {
          const stuIdx = copy.children.findIndex(c => c.routeUrl === '/students' || c.routeUrl === '/students/my-profile');
          if (stuIdx >= 0) {
            copy.children.splice(stuIdx + 1, 0, timetableItemMaster);
          } else {
            copy.children.push(timetableItemMaster);
          }
        }
        if (!copy.children.some(c => c.routeUrl === '/study-materials')) {
          const ttIdx = copy.children.findIndex(c => c.routeUrl === '/students/timetable');
          if (ttIdx >= 0) {
            copy.children.splice(ttIdx + 1, 0, studyMaterialsItemMaster);
          } else {
            copy.children.push(studyMaterialsItemMaster);
          }
        }
        if (!copy.children.some(c => c.routeUrl === '/teachers') && !this.authService.isStudentOrParent()) {
          const stuIdx = copy.children.findIndex(c => c.routeUrl === '/students');
          if (stuIdx >= 0) {
            copy.children.splice(stuIdx + 1, 0, teachersMasterItem);
          } else {
            copy.children.push(teachersMasterItem);
          }
        }
      }

      // 4. Inject into Faculty Operations (right after Homework / Lesson Plan)
      const isFaculty = (copy.title && copy.title.toLowerCase().includes('faculty')) ||
                        (copy.title && copy.title.toLowerCase().includes('teacher')) ||
                        copy.id === '4b' ||
                        copy.id === '4' ||
                        (copy.module && copy.module.toLowerCase() === 'teachers');
      if (isFaculty) {
        if (!copy.children.some(c => c.routeUrl === '/tests')) {
          const diaryIdx = copy.children.findIndex(c => c.routeUrl === '/teachers/lesson-plans' || c.routeUrl === '/teachers/assignments');
          if (diaryIdx >= 0) {
            copy.children.splice(diaryIdx + 1, 0, testsItemFaculty);
          } else {
            copy.children.push(testsItemFaculty);
          }
        }
        if (!copy.children.some(c => c.routeUrl === '/students/timetable')) {
          const subIdx = copy.children.findIndex(c => c.routeUrl === '/teachers/substitution');
          if (subIdx >= 0) {
            copy.children.splice(subIdx + 1, 0, timetableItemFaculty);
          } else {
            copy.children.push(timetableItemFaculty);
          }
        }
        if (!copy.children.some(c => c.routeUrl === '/study-materials')) {
          const ttIdx = copy.children.findIndex(c => c.routeUrl === '/students/timetable');
          if (ttIdx >= 0) {
            copy.children.splice(ttIdx + 1, 0, studyMaterialsItemFaculty);
          } else {
            copy.children.push(studyMaterialsItemFaculty);
          }
        }
      }

      return copy;
    });

    // 5. If Admin Settings group did not exist at all, add it if user has admin privileges
    const hasAdminSettings = updated.some(item =>
      (item.title && item.title.toLowerCase().includes('admin')) ||
      item.id === '6' ||
      (item.module && item.module.toLowerCase() === 'admin')
    );

    if (!hasAdminSettings && this.authService.isAdmin()) {
      updated.push({
        id: '6',
        title: 'Admin Settings',
        routeUrl: '',
        icon: 'settings',
        sortOrder: 6,
        module: 'Admin',
        isActive: true,
        children: [workflowItemAdmin]
      });
    }

    return updated;
  }

  private adjustStudentMenu(menu: MenuItem[]): MenuItem[] {
    const myProfileItem: MenuItem = {
      id: 'my-student-360',
      title: 'My 360° Profile & Wall of Fame',
      routeUrl: '/students/my-profile',
      icon: 'military_tech',
      sortOrder: 2,
      module: 'Master',
      isActive: true,
      children: []
    };

    let found = false;
    const updated = (menu || []).map(m => {
      if (m.children && m.children.length > 0) {
        const newChildren = m.children
          .filter(c => c.routeUrl !== '/fee-heads')
          .map(c => {
            if (c.routeUrl === '/students' || c.routeUrl === '/students/my-profile') {
              found = true;
              return { ...c, title: 'My 360° Profile & Wall of Fame', routeUrl: '/students/my-profile', icon: 'military_tech' };
            }
            if (c.routeUrl === '/fees') {
              return { ...c, title: 'My Fee Ledger & Receipts', routeUrl: '/my-fees', icon: 'receipt_long' };
            }
            if (c.routeUrl === '/school/exams') {
              return { ...c, title: 'My Exams & Datesheet', routeUrl: '/my-exams', icon: 'event_available' };
            }
            return c;
          });
        return { ...m, children: newChildren };
      }
      if (m.routeUrl === '/students' || m.routeUrl === '/students/my-profile') {
        found = true;
        return { ...m, title: 'My 360° Profile & Wall of Fame', routeUrl: '/students/my-profile', icon: 'military_tech' };
      }
      if (m.routeUrl === '/fees') {
        return { ...m, title: 'My Fee Ledger & Receipts', routeUrl: '/my-fees', icon: 'receipt_long' };
      }
      if (m.routeUrl === '/school/exams') {
        return { ...m, title: 'My Exams & Datesheet', routeUrl: '/my-exams', icon: 'event_available' };
      }
      return m;
    });

    if (!found) {
      updated.splice(1, 0, myProfileItem);
    }
    return updated;
  }

  private fallbackMenu(): void {
    const isAdmin = this.authService.isAdmin();
    const isAccountant = this.authService.isAccountant();
    const isStudentOrParent = this.authService.isStudentOrParent();
    const canAccessFinance = isAdmin || isAccountant;

    const rawItems: MenuItem[] = [
      { id: '1', title: 'Dashboard', routeUrl: '/dashboard', icon: 'dashboard', sortOrder: 1, module: 'Main', isActive: true, children: [] },
      {
        id: '2', title: isStudentOrParent ? 'My Student Center' : 'Master Management', routeUrl: '', icon: 'category', sortOrder: 2, module: 'Master', isActive: true,
        children: [
          ...(isStudentOrParent ? [
            { id: '24my', title: 'My 360° Profile & Wall of Fame', routeUrl: '/students/my-profile', icon: 'military_tech', sortOrder: 1, module: 'Master', isActive: true, children: [] },
            { id: '24tt', title: 'Class Timetable & Routine', routeUrl: '/students/timetable', icon: 'calendar_view_week', sortOrder: 2, module: 'Master', isActive: true, children: [] },
            { id: '24sm', title: 'Study Material & PYQ Bank', routeUrl: '/study-materials', icon: 'auto_stories', sortOrder: 3, module: 'Master', isActive: true, children: [] }
          ] : [
            { id: '20', title: 'Classes & Sections', routeUrl: '/school/classes', icon: 'domain', sortOrder: 1, module: 'Master', isActive: true, children: [] },
            { id: '20pt', title: 'Period & Bell Timings', routeUrl: '/school/period-settings', icon: 'alarm_on', sortOrder: 1.5, module: 'Master', isActive: true, children: [] },
            { id: '21', title: 'Batches Master', routeUrl: '/batches', icon: 'class', sortOrder: 2, module: 'Master', isActive: true, children: [] },
            { id: '22', title: 'Classrooms Master', routeUrl: '/rooms', icon: 'meeting_room', sortOrder: 3, module: 'Master', isActive: true, children: [] },
            { id: '23', title: 'Subject Master', routeUrl: '/subjects', icon: 'menu_book', sortOrder: 4, module: 'Master', isActive: true, children: [] },
            { id: '24', title: 'Students Master', routeUrl: '/students', icon: 'people', sortOrder: 5, module: 'Master', isActive: true, children: [] },
            { id: '24tm', title: 'Teachers Master', routeUrl: '/teachers', icon: 'groups', sortOrder: 5.2, module: 'Master', isActive: true, children: [] },
            { id: '24tt', title: 'Class Timetable & Routine', routeUrl: '/students/timetable', icon: 'calendar_view_week', sortOrder: 5.5, module: 'Master', isActive: true, children: [] },
            { id: '241', title: 'Admission Enquiries', routeUrl: '/students/enquiries', icon: 'contact_phone', sortOrder: 6, module: 'Master', isActive: true, children: [] },
            { id: '25', title: 'Holiday Master', routeUrl: '/holidays', icon: 'event', sortOrder: 7, module: 'Master', isActive: true, children: [] },
            { id: '26', title: 'Events & Celebrations', routeUrl: '/events', icon: 'celebration', sortOrder: 8, module: 'Master', isActive: true, children: [] }
          ])
        ]
      },
      {
        id: '3', title: 'Attendance Management', routeUrl: '', icon: 'event_available', sortOrder: 3, module: 'Attendance', isActive: true,
        children: [
          { id: '301', title: 'Student Attendance', routeUrl: '/students/attendance', icon: 'how_to_reg', sortOrder: 1, module: 'Attendance', isActive: true, children: [] },
          { id: '3011', title: 'Student Leaves', routeUrl: '/students/leaves', icon: 'event_busy', sortOrder: 2, module: 'Attendance', isActive: true, children: [] },
          { id: '3012', title: 'Student Gate Pass', routeUrl: '/students/gate-pass', icon: 'badge', sortOrder: 3, module: 'Attendance', isActive: true, children: [] },
          { id: '302', title: 'Teacher Attendance', routeUrl: '/teachers/attendance', icon: 'co_present', sortOrder: 4, module: 'Attendance', isActive: true, children: [] },
          { id: '303', title: 'Attendance Reports', routeUrl: '/attendance/reports', icon: 'summarize', sortOrder: 5, module: 'Attendance', isActive: true, children: [] },
          { id: '304', title: 'Biometric Devices', routeUrl: '/attendance/devices', icon: 'fingerprint', sortOrder: 6, module: 'Attendance', isActive: true, children: [] },
          { id: '305', title: 'Shift & Policy Settings', routeUrl: '/attendance/settings', icon: 'settings_suggest', sortOrder: 7, module: 'Attendance', isActive: true, children: [] }
        ]
      },
      {
        id: '4', title: 'HRMS & Staff', routeUrl: '', icon: 'badge', sortOrder: 4, module: 'Teachers', isActive: true,
        children: [
          { id: '41', title: 'Staff Directory', routeUrl: '/teachers', icon: 'groups', sortOrder: 1, module: 'Teachers', isActive: true, children: [] },
          { id: '44', title: 'Salary Structure', routeUrl: '/teachers/salary', icon: 'account_balance_wallet', sortOrder: 2, module: 'Teachers', isActive: true, children: [] },
          { id: '45', title: 'Salary Payments', routeUrl: '/teachers/payments', icon: 'payments', sortOrder: 3, module: 'Teachers', isActive: true, children: [] },
          { id: '46', title: 'Salary Advances', routeUrl: '/teachers/advances', icon: 'currency_rupee', sortOrder: 4, module: 'Teachers', isActive: true, children: [] },
          { id: '47', title: 'Leave Management', routeUrl: '/teachers/leaves', icon: 'beach_access', sortOrder: 5, module: 'Teachers', isActive: true, children: [] },
          { id: '48', title: 'Payroll & Staff Reports', routeUrl: '/teachers/reports', icon: 'summarize', sortOrder: 6, module: 'Teachers', isActive: true, children: [] },
          { id: '410p', title: 'Promotions & Appraisals', routeUrl: '/teachers/promotions', icon: 'military_tech', sortOrder: 7, module: 'Teachers', isActive: true, children: [] },
          { id: '49', title: 'Exit & FNF Settlement', routeUrl: '/teachers/fnf', icon: 'exit_to_app', sortOrder: 8, module: 'Teachers', isActive: true, children: [] }
        ]
      },
      {
        id: '4b', title: 'Faculty Operations', routeUrl: '', icon: 'school', sortOrder: 5, module: 'Teachers', isActive: true,
        children: [
          { id: '42', title: 'Batch Assignments', routeUrl: '/teachers/assignments', icon: 'class', sortOrder: 1, module: 'Teachers', isActive: true, children: [] },
          { id: '410', title: 'Proxy & Substitution', routeUrl: '/teachers/substitution', icon: 'swap_horiz', sortOrder: 2, module: 'Teachers', isActive: true, children: [] },
          { id: '411tt', title: 'Class Timetable & Routine', routeUrl: '/students/timetable', icon: 'calendar_view_week', sortOrder: 2.5, module: 'Teachers', isActive: true, children: [] },
          { id: '411', title: 'Daily Lesson Diary', routeUrl: '/teachers/lesson-plans', icon: 'menu_book', sortOrder: 3, module: 'Teachers', isActive: true, children: [] },
          { id: '412', title: 'Faculty Workload', routeUrl: '/teachers/reports', icon: 'analytics', sortOrder: 4, module: 'Teachers', isActive: true, children: [] }
        ]
      },
      {
        id: '5', title: 'Academic Operations', routeUrl: '', icon: 'school', sortOrder: 5, module: 'Academic', isActive: true,
        children: [
          ...(isStudentOrParent ? [
            { id: '51my', title: 'My Fee Ledger & Receipts', routeUrl: '/my-fees', icon: 'receipt_long', sortOrder: 1, module: 'Academic', isActive: true, children: [] },
            { id: '51myfc', title: 'My Fee Card', routeUrl: '/fees/fee-card', icon: 'contact_page', sortOrder: 1.5, module: 'Academic', isActive: true, children: [] }
          ] : [
            { id: '51', title: 'Fee Collection', routeUrl: '/fees', icon: 'payments', sortOrder: 1, module: 'Academic', isActive: true, children: [] },
            { id: '51fc', title: 'Student Fee Card', routeUrl: '/fees/fee-card', icon: 'contact_page', sortOrder: 1.5, module: 'Academic', isActive: true, children: [] },
            { id: '511', title: 'Fee Heads Master', routeUrl: '/fee-heads', icon: 'account_tree', sortOrder: 2, module: 'Academic', isActive: true, children: [] }
          ]),
          { id: '512', title: 'Homework & Daily Diary', routeUrl: '/school/homework', icon: 'menu_book', sortOrder: 3, module: 'Academic', isActive: true, children: [] },
          { id: '512tt', title: 'Class Timetable & Routine', routeUrl: '/students/timetable', icon: 'calendar_view_week', sortOrder: 3.5, module: 'Academic', isActive: true, children: [] },
          { id: '512sm', title: 'Study Material & PYQ Bank', routeUrl: '/study-materials', icon: 'auto_stories', sortOrder: 3.8, module: 'Academic', isActive: true, children: [] },
          ...(isStudentOrParent ? [
            { id: '52my', title: 'My Exams & Datesheet', routeUrl: '/my-exams', icon: 'event_available', sortOrder: 4, module: 'Academic', isActive: true, children: [] }
          ] : [
            { id: '52', title: 'School Examinations', routeUrl: '/school/exams', icon: 'assignment', sortOrder: 4, module: 'Academic', isActive: true, children: [] },
            { id: '521', title: 'Student Promotion', routeUrl: '/students/promotion', icon: 'trending_up', sortOrder: 5, module: 'Academic', isActive: true, children: [] },
            { id: '5211', title: 'Academic & Exam Workflow', routeUrl: '/admin/academic-workflow', icon: 'tune', sortOrder: 5.5, module: 'Academic', isActive: true, children: [] },
            { id: '522', title: 'Tests & Report Cards', routeUrl: '/tests', icon: 'quiz', sortOrder: 6, module: 'Academic', isActive: true, children: [] }
          ]),
          { id: '523', title: 'School Notices', routeUrl: '/school/notices', icon: 'campaign', sortOrder: 7, module: 'Academic', isActive: true, children: [] },
          { id: '53', title: 'WhatsApp Logs', routeUrl: '/whatsapp', icon: 'chat', sortOrder: 8, module: 'Academic', isActive: true, children: [] },
          { id: '53chat', title: 'Campus & Class Chat', routeUrl: '/chat', icon: 'forum', sortOrder: 8.5, module: 'Academic', isActive: true, children: [] },
          { id: '54', title: 'Library Books', routeUrl: '/library/books', icon: 'local_library', sortOrder: 9, module: 'Academic', isActive: true, children: [] },
          { id: '55', title: 'Issue & Return Desk', routeUrl: '/library/circulation', icon: 'sync_alt', sortOrder: 10, module: 'Academic', isActive: true, children: [] },
          { id: '551', title: 'Library Shifts & Plans', routeUrl: '/library/plans', icon: 'schedule', sortOrder: 11, module: 'Academic', isActive: true, children: [] },
          { id: '56', title: 'Hostel Management', routeUrl: '/hostel', icon: 'apartment', sortOrder: 12, module: 'Academic', isActive: true, children: [] },
          { id: '561', title: 'Transport & Fleet', routeUrl: '/transport', icon: 'directions_bus', sortOrder: 13, module: 'Academic', isActive: true, children: [] },
          { id: '57', title: 'Front Desk & Visitors', routeUrl: '/front-desk/visitors', icon: 'transfer_within_a_station', sortOrder: 14, module: 'Academic', isActive: true, children: [] },
          { id: '571', title: 'Infirmary & Sick Bay', routeUrl: '/front-desk/infirmary', icon: 'local_hospital', sortOrder: 14.2, module: 'Academic', isActive: true, children: [] },
          { id: '572', title: 'PTM Scheduler', routeUrl: '/front-desk/ptm', icon: 'calendar_month', sortOrder: 14.4, module: 'Academic', isActive: true, children: [] },
          { id: '573', title: 'Grievance Helpdesk', routeUrl: '/front-desk/grievances', icon: 'support_agent', sortOrder: 14.6, module: 'Academic', isActive: true, children: [] }
        ]
      },
      ...(canAccessFinance ? [{
        id: '5f', title: 'Finance & Accounts', routeUrl: '', icon: 'account_balance', sortOrder: 5.5, module: 'Finance', isActive: true,
        children: [
          { id: '5f0', title: 'Day Book (दैनिक बही)', routeUrl: '/finance/day-book', icon: 'auto_stories', sortOrder: 0.5, module: 'Finance', isActive: true, children: [] },
          { id: '5f1', title: 'Profit & Loss', routeUrl: '/finance/profit-loss', icon: 'query_stats', sortOrder: 1, module: 'Finance', isActive: true, children: [] },
          { id: '5f2', title: 'Balance Sheet', routeUrl: '/finance/balance-sheet', icon: 'account_balance_wallet', sortOrder: 2, module: 'Finance', isActive: true, children: [] },
          { id: '5f3', title: 'Expense Vouchers', routeUrl: '/finance/expenses', icon: 'receipt_long', sortOrder: 3, module: 'Finance', isActive: true, children: [] },
          { id: '5f4', title: 'Chart of Accounts', routeUrl: '/finance/chart-of-accounts', icon: 'account_tree', sortOrder: 4, module: 'Finance', isActive: true, children: [] }
        ]
      }] : []),
      {
        id: '6', title: 'Admin Settings', routeUrl: '', icon: 'settings', sortOrder: 6, module: 'Admin', isActive: true,
        children: [
          { id: '61', title: 'Roles & Permissions', routeUrl: '/roles', icon: 'admin_panel_settings', sortOrder: 1, module: 'Admin', isActive: true, children: [] },
          { id: '62', title: 'User Management', routeUrl: '/users', icon: 'person_add', sortOrder: 2, module: 'Admin', isActive: true, children: [] },
          { id: '63', title: 'Biometric Devices', routeUrl: '/attendance/devices', icon: 'fingerprint', sortOrder: 3, module: 'Admin', isActive: true, children: [] },
          { id: '64', title: 'Institutes & Tenants', routeUrl: '/admin/tenants', icon: 'corporate_fare', sortOrder: 4, module: 'Admin', isActive: true, children: [] },
          { id: '65', title: 'Subscription & Plan', routeUrl: '/subscription', icon: 'workspace_premium', sortOrder: 5, module: 'Admin', isActive: true, children: [] },
          { id: '66', title: 'Academic & Exam Workflow', routeUrl: '/admin/academic-workflow', icon: 'tune', sortOrder: 6, module: 'Admin', isActive: true, children: [] }
        ]
      }
    ];
    this.menuTree.set(this.filterMenuByModules(rawItems));
  }

  logout() {
    this.authService.logout();
  }
}
