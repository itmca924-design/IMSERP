import { Component, OnInit, signal, ViewChild } from '@angular/core';
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
import { AuthService } from '../core/services/auth.service';
import { MenuService, MenuItem } from '../core/services/menu.service';
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
          <mat-icon color="primary" class="brand-icon">school</mat-icon>
          <div class="brand-titles">
            <span class="brand-name">{{ currentUser()?.instituteName || 'Apex Coaching' }}</span>
            <span class="brand-sub">Vertical Micro-SaaS</span>
          </div>
          <button *ngIf="isMobile()" mat-icon-button class="close-drawer-btn" (click)="drawer.close()">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <mat-divider></mat-divider>

        <div class="nav-container">
          <mat-accordion class="menu-accordion" [multi]="false">
            <ng-container *ngFor="let item of menuTree()">
              <!-- Item with sub-menus (e.g. Master Management, Admin Settings) -->
              <mat-expansion-panel *ngIf="item.children && item.children.length > 0" class="mat-elevation-z0" [expanded]="false">
                <mat-expansion-panel-header [matTooltip]="item.title" matTooltipPosition="right">
                  <mat-panel-title class="accordion-title">
                    <mat-icon class="menu-icon">{{ item.icon || 'category' }}</mat-icon>
                    <span>{{ item.title }}</span>
                  </mat-panel-title>
                </mat-expansion-panel-header>

                <mat-nav-list class="sub-nav-list">
                  <a *ngFor="let sub of item.children"
                     mat-list-item
                     [routerLink]="sub.routeUrl"
                     routerLinkActive="active-link"
                     [matTooltip]="sub.title"
                     matTooltipPosition="right"
                     (click)="onNavClick(drawer)">
                    <mat-icon matListItemIcon class="sub-icon">{{ sub.icon || 'star' }}</mat-icon>
                    <span matListItemTitle>{{ sub.title }}</span>
                  </a>
                </mat-nav-list>
              </mat-expansion-panel>

              <!-- Direct item without children (e.g. Dashboard) -->
              <mat-nav-list *ngIf="!item.children || item.children.length === 0" class="direct-nav-list">
                <a mat-list-item
                   [routerLink]="item.routeUrl"
                   routerLinkActive="active-link"
                   [matTooltip]="item.title"
                   matTooltipPosition="right"
                   (click)="onNavClick(drawer)">
                  <mat-icon matListItemIcon>{{ item.icon || 'folder' }}</mat-icon>
                  <span matListItemTitle>{{ item.title }}</span>
                </a>
              </mat-nav-list>
            </ng-container>
          </mat-accordion>
        </div>

        <div class="user-footer">
          <div class="user-details">
            <span class="user-name">{{ currentUser()?.fullName }}</span>
            <mat-chip-option [selectable]="false" color="accent" selected class="role-chip">
              {{ currentUser()?.role }}
            </mat-chip-option>
          </div>
          <button mat-icon-button color="warn" (click)="logout()" title="Logout">
            <mat-icon>logout</mat-icon>
          </button>
        </div>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar color="primary" class="header-toolbar">
          <button type="button" mat-icon-button (click)="drawer.toggle()" aria-label="Toggle navigation">
            <mat-icon>menu</mat-icon>
          </button>

          <span class="app-header-title">Coaching Management Dashboard</span>
          
          <span class="spacer"></span>
          
          <a
            routerLink="/whatsapp"
            class="whatsapp-status-badge"
            title="WhatsApp Gateway Active — Click to view live delivery logs">
            <mat-icon class="wa-icon">check_circle</mat-icon>
            <span class="wa-text">WhatsApp Gateway Active</span>
          </a>

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
                <span class="user-role">{{ currentUser()?.role || 'Admin' }}</span>
                <span class="user-inst">{{ currentUser()?.instituteName || 'Apex Coaching Academy' }}</span>
              </div>
            </div>

            <mat-divider></mat-divider>

            <button mat-menu-item routerLink="/users">
              <mat-icon color="primary">manage_accounts</mat-icon>
              <span>User Profile &amp; Staff</span>
            </button>

            <button mat-menu-item routerLink="/roles">
              <mat-icon style="color: #6366f1;">admin_panel_settings</mat-icon>
              <span>Roles &amp; Permissions</span>
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
      width: 280px;
      background-color: #ffffff;
      border-right: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
    }
    .brand-section {
      padding: 16px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      position: relative;

      .brand-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
      }
      .brand-titles {
        display: flex;
        flex-direction: column;
        flex: 1;
        .brand-name {
          font-weight: 700;
          font-size: 1rem;
          color: #1976d2;
        }
        .brand-sub {
          font-size: 0.75rem;
          color: #64748b;
        }
      }
      .close-drawer-btn {
        margin-left: auto;
      }
    }
    .nav-container {
      flex: 1;
      overflow-y: auto;
      padding-top: 8px;
    }
    .menu-accordion {
      display: block;
      width: 100%;
      mat-expansion-panel {
        background: transparent;
        box-shadow: none !important;
        margin: 0 !important;
        border-radius: 0 !important;
      }
      .accordion-title {
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 600;
        color: #334155;

        .menu-icon {
          color: #1976d2;
        }
      }
    }
    .sub-nav-list {
      padding-left: 12px;
      padding-top: 0;

      .sub-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }
    .direct-nav-list, .sub-nav-list {
      .active-link {
        background-color: #e0f2fe !important;
        color: #0284c7 !important;
        font-weight: 600;

        mat-icon {
          color: #0284c7 !important;
        }
      }
    }
    .user-footer {
      padding: 16px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;

      .user-details {
        display: flex;
        flex-direction: column;
        gap: 4px;
        .user-name {
          font-weight: 600;
          font-size: 0.88rem;
        }
        .role-chip {
          font-size: 0.7rem;
          height: 20px;
        }
      }
    }
    .header-toolbar {
      box-shadow: 0 2px 4px rgba(0,0,0,0.06);
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      flex-shrink: 0;
      z-index: 10;

      .app-header-title {
        font-weight: 600;
        font-size: 1.1rem;

        @media (max-width: 600px) {
          font-size: 0.95rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 180px;
        }
      }
    }
    .spacer {
      flex: 1 1 auto;
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

  @ViewChild('drawer') drawer!: MatSidenav;

  constructor(
    private authService: AuthService,
    private menuService: MenuService,
    private breakpointObserver: BreakpointObserver
  ) {}

  ngOnInit(): void {
    this.breakpointObserver.observe(['(max-width: 960px)']).subscribe((result) => {
      this.isMobile.set(result.matches);
    });

    this.loadMenu();
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
          { id: '22', title: 'Subject Master', routeUrl: '/subjects', icon: 'menu_book', sortOrder: 2, module: 'Master', isActive: true, children: [] },
          { id: '23', title: 'Students Master', routeUrl: '/students', icon: 'people', sortOrder: 3, module: 'Master', isActive: true, children: [] },
          { id: '24', title: 'Holiday Master', routeUrl: '/holidays', icon: 'event', sortOrder: 4, module: 'Master', isActive: true, children: [] }
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
          { id: '52', title: 'User Management', routeUrl: '/users', icon: 'person_add', sortOrder: 2, module: 'Admin', isActive: true, children: [] }
        ]
      }
    ]);
  }

  logout() {
    this.authService.logout();
  }
}
