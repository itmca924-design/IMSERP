import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EventsService, SchoolEvent } from '../../core/services/events.service';
import { EventFormDialogComponent } from './event-form-dialog.component';
import { EventGalleryDialogComponent } from './event-gallery-dialog.component';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="events-page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>celebration</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Events, Functions & Celebrations</h1>
            <p class="page-subtitle">
              Manage annual day, 15 Aug, 26 Jan, farewell party, sports meets, circulars & photo galleries
            </p>
          </div>
        </div>

        <div class="header-actions">
          <button mat-stroked-button class="refresh-btn" (click)="loadEvents()" [disabled]="loading">
            <mat-icon [class.spin]="loading">refresh</mat-icon>
            <span>Refresh</span>
          </button>
          <button mat-raised-button color="primary" class="create-btn" (click)="openCreateDialog()">
            <mat-icon>add_circle</mat-icon>
            <span>Schedule New Event</span>
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="kpi-grid">
        <div class="kpi-card total">
          <div class="kpi-icon"><mat-icon>event_note</mat-icon></div>
          <div class="kpi-info">
            <span class="kpi-num">{{ totalEvents }}</span>
            <span class="kpi-label">Total Events</span>
          </div>
        </div>

        <div class="kpi-card national">
          <div class="kpi-icon"><mat-icon>flag</mat-icon></div>
          <div class="kpi-info">
            <span class="kpi-num">{{ nationalCount }}</span>
            <span class="kpi-label">National Festivals</span>
          </div>
        </div>

        <div class="kpi-card cultural">
          <div class="kpi-icon"><mat-icon>theater_comedy</mat-icon></div>
          <div class="kpi-info">
            <span class="kpi-num">{{ culturalCount }}</span>
            <span class="kpi-label">Cultural & Farewells</span>
          </div>
        </div>

        <div class="kpi-card gallery">
          <div class="kpi-icon"><mat-icon>collections</mat-icon></div>
          <div class="kpi-info">
            <span class="kpi-num">{{ totalPhotosCount }}</span>
            <span class="kpi-label">Memories & Photos</span>
          </div>
        </div>
      </div>

      <!-- Filter & Search Toolbar -->
      <div class="toolbar-card">
        <div class="category-chips">
          <button
            type="button"
            class="chip-tab"
            [class.active]="selectedCategory === ''"
            (click)="setCategory('')"
          >
            All Events ({{ events.length }})
          </button>
          <button
            type="button"
            class="chip-tab national-tab"
            [class.active]="selectedCategory === 'National'"
            (click)="setCategory('National')"
          >
            🇮🇳 National ({{ getCategoryCount('National') }})
          </button>
          <button
            type="button"
            class="chip-tab cultural-tab"
            [class.active]="selectedCategory === 'Cultural'"
            (click)="setCategory('Cultural')"
          >
            🎭 Cultural & Farewell ({{ getCategoryCount('Cultural') }})
          </button>
          <button
            type="button"
            class="chip-tab sports-tab"
            [class.active]="selectedCategory === 'Sports'"
            (click)="setCategory('Sports')"
          >
            🏆 Sports ({{ getCategoryCount('Sports') }})
          </button>
          <button
            type="button"
            class="chip-tab ptm-tab"
            [class.active]="selectedCategory === 'PTM'"
            (click)="setCategory('PTM')"
          >
            🤝 PTM ({{ getCategoryCount('PTM') }})
          </button>
          <button
            type="button"
            class="chip-tab academic-tab"
            [class.active]="selectedCategory === 'Academic'"
            (click)="setCategory('Academic')"
          >
            📚 Academic Fair ({{ getCategoryCount('Academic') }})
          </button>
        </div>

        <div class="search-row">
          <div class="search-input-box">
            <mat-icon class="search-icon">search</mat-icon>
            <input
              type="text"
              placeholder="Search by event title, venue, chief guest or coordinator..."
              [(ngModel)]="searchQuery"
              (input)="onSearchChange()"
            />
            <button *ngIf="searchQuery" class="clear-btn" (click)="searchQuery = ''; onSearchChange()">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="status-dropdown">
            <mat-select [(ngModel)]="selectedStatus" (selectionChange)="onSearchChange()">
              <mat-option value="">All Statuses</mat-option>
              <mat-option value="Scheduled">Scheduled</mat-option>
              <mat-option value="Ongoing">Ongoing</mat-option>
              <mat-option value="Completed">Completed</mat-option>
            </mat-select>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div class="loading-state" *ngIf="loading">
        <mat-spinner diameter="40"></mat-spinner>
        <span>Loading events & celebrations...</span>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!loading && filteredEvents.length === 0">
        <div class="empty-icon-wrap">
          <mat-icon>celebration</mat-icon>
        </div>
        <h3 class="empty-title">No Events Found</h3>
        <p class="empty-sub">
          {{ searchQuery || selectedCategory ? 'No events matched your current filters.' : 'Get started by scheduling your first school function or celebration!' }}
        </p>
        <button mat-raised-button color="primary" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon>
          <span>Schedule School Event</span>
        </button>
      </div>

      <!-- Events Cards Grid -->
      <div class="events-grid" *ngIf="!loading && filteredEvents.length > 0">
        <div class="event-card" *ngFor="let ev of filteredEvents">
          <!-- Card Banner Area -->
          <div class="card-banner" [style.background-image]="ev.bannerUrl ? 'url(' + ev.bannerUrl + ')' : getFallbackGradient(ev.category)">
            <div class="banner-overlay"></div>
            
            <div class="banner-top-badges">
              <span class="category-pill" [ngClass]="ev.category.toLowerCase()">
                {{ getCategoryEmoji(ev.category) }} {{ ev.category }}
              </span>
              <span class="status-pill" [ngClass]="ev.status.toLowerCase()">
                {{ ev.status }}
              </span>
            </div>

            <div class="date-badge-overlay">
              <span class="month-text">{{ ev.startDate | date:'MMM' | uppercase }}</span>
              <span class="day-text">{{ ev.startDate | date:'dd' }}</span>
            </div>
          </div>

          <!-- Card Body -->
          <div class="card-body">
            <div class="card-title-row">
              <h3 class="event-title" [title]="ev.title">{{ ev.title }}</h3>
            </div>

            <!-- Meta details (Time, Venue, Target Audience) -->
            <div class="meta-list">
              <div class="meta-item" *ngIf="ev.startTime">
                <mat-icon class="meta-icon">schedule</mat-icon>
                <span>{{ ev.startTime }} <span *ngIf="ev.endTime">- {{ ev.endTime }}</span></span>
              </div>
              <div class="meta-item" *ngIf="ev.venue">
                <mat-icon class="meta-icon">place</mat-icon>
                <span [title]="ev.venue">{{ ev.venue }}</span>
              </div>
              <div class="meta-item" *ngIf="ev.targetAudience">
                <mat-icon class="meta-icon">groups</mat-icon>
                <span>{{ ev.targetAudience }}</span>
              </div>
              <div class="meta-item" *ngIf="ev.chiefGuestName">
                <mat-icon class="meta-icon guest-icon">star</mat-icon>
                <span>Chief Guest: <strong>{{ ev.chiefGuestName }}</strong></span>
              </div>
              <div class="meta-item" *ngIf="ev.coordinatorName">
                <mat-icon class="meta-icon">person_outline</mat-icon>
                <span>In-Charge: <strong>{{ ev.coordinatorName }}</strong></span>
              </div>
              <div class="meta-item" *ngIf="ev.branchName">
                <mat-icon class="meta-icon">apartment</mat-icon>
                <span>Branch: <strong>{{ ev.branchName }}</strong></span>
              </div>
            </div>

            <p class="event-desc" *ngIf="ev.description" [title]="ev.description">
              {{ ev.description }}
            </p>

            <!-- Attachment Circular Link (if present) -->
            <div class="circular-attachment" *ngIf="ev.attachmentPdfUrl">
              <a [href]="ev.attachmentPdfUrl" target="_blank" class="circular-link" download>
                <mat-icon class="pdf-icon">picture_as_pdf</mat-icon>
                <span>Download Circular / Notice PDF</span>
                <mat-icon class="ext-icon">open_in_new</mat-icon>
              </a>
            </div>
          </div>

          <!-- Card Actions Footer -->
          <div class="card-footer">
            <button
              mat-stroked-button
              class="gallery-btn"
              (click)="openGalleryDialog(ev)"
              matTooltip="View & upload event photo memories"
            >
              <mat-icon>photo_library</mat-icon>
              <span>Memories ({{ ev.photosCount }})</span>
            </button>

            <div class="action-buttons">
              <button mat-icon-button class="edit-btn" (click)="openEditDialog(ev)" matTooltip="Edit Event">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button class="del-btn" (click)="deleteEvent(ev)" matTooltip="Delete Event">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .events-page-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
      box-sizing: border-box;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 16px;

      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;

        .header-icon-box {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(37,99,235,0.25);

          mat-icon { font-size: 28px; width: 28px; height: 28px; }
        }

        .page-title {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.3px;
        }

        .page-subtitle {
          margin: 4px 0 0;
          font-size: 0.85rem;
          color: #64748b;
        }
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;

        .refresh-btn {
          border-color: #cbd5e1;
          color: #475569;
          font-weight: 600;
        }

        .create-btn {
          background: #2563eb;
          color: #ffffff;
          font-weight: 600;
          box-shadow: 0 4px 8px rgba(37,99,235,0.3);
          border-radius: 8px;
        }
      }
    }

    .spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* KPI Summary */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 22px;

      .kpi-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 14px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);

        .kpi-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;

          mat-icon { font-size: 24px; width: 24px; height: 24px; }
        }

        .kpi-info {
          display: flex;
          flex-direction: column;

          .kpi-num {
            font-size: 1.45rem;
            font-weight: 800;
            color: #0f172a;
            line-height: 1.2;
          }

          .kpi-label {
            font-size: 0.76rem;
            color: #64748b;
            font-weight: 600;
            margin-top: 2px;
          }
        }

        &.total .kpi-icon { background: #eff6ff; color: #2563eb; }
        &.national .kpi-icon { background: #fff7ed; color: #ea580c; }
        &.cultural .kpi-icon { background: #fdf2f8; color: #db2777; }
        &.gallery .kpi-icon { background: #f0fdf4; color: #16a34a; }
      }
    }

    /* Toolbar */
    .toolbar-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 22px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);

      .category-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 14px;
        padding-bottom: 12px;
        border-bottom: 1px solid #f1f5f9;

        .chip-tab {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.79rem;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s ease;

          &:hover {
            border-color: #cbd5e1;
            background: #f1f5f9;
          }

          &.active {
            background: #2563eb;
            color: #ffffff;
            border-color: #2563eb;
            box-shadow: 0 2px 4px rgba(37,99,235,0.25);
          }

          &.national-tab.active { background: #ea580c; border-color: #ea580c; }
          &.cultural-tab.active { background: #db2777; border-color: #db2777; }
          &.sports-tab.active { background: #16a34a; border-color: #16a34a; }
          &.ptm-tab.active { background: #0284c7; border-color: #0284c7; }
          &.academic-tab.active { background: #7c3aed; border-color: #7c3aed; }
        }
      }

      .search-row {
        display: flex;
        gap: 12px;
        align-items: center;

        .search-input-box {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 12px;

          .search-icon { color: #94a3b8; font-size: 20px; width: 20px; height: 20px; }

          input {
            flex: 1;
            border: none;
            background: transparent;
            font-size: 0.86rem;
            color: #0f172a;
            outline: none;
          }

          .clear-btn {
            border: none;
            background: none;
            cursor: pointer;
            color: #94a3b8;
            padding: 0;
            display: flex;

            mat-icon { font-size: 16px; width: 16px; height: 16px; }
            &:hover { color: #dc2626; }
          }
        }

        .status-dropdown {
          width: 160px;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          border-radius: 8px;
          padding: 7px 12px;
          font-size: 0.84rem;
        }
      }
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      gap: 14px;
      color: #64748b;
      font-size: 0.9rem;
    }

    .empty-state {
      background: #ffffff;
      border: 1px dashed #cbd5e1;
      border-radius: 12px;
      padding: 48px 24px;
      text-align: center;

      .empty-icon-wrap {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: #eff6ff;
        color: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;

        mat-icon { font-size: 32px; width: 32px; height: 32px; }
      }

      .empty-title {
        font-size: 1.15rem;
        font-weight: 700;
        color: #1e293b;
        margin: 0 0 6px;
      }

      .empty-sub {
        font-size: 0.85rem;
        color: #64748b;
        margin: 0 0 18px;
      }
    }

    /* Events Grid */
    .events-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;

      .event-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 2px 4px rgba(0,0,0,0.04);
        display: flex;
        flex-direction: column;
        transition: transform 0.2s ease, box-shadow 0.2s ease;

        &:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.08);
        }

        .card-banner {
          position: relative;
          height: 140px;
          background-size: cover;
          background-position: center;

          .banner-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%);
          }

          .banner-top-badges {
            position: absolute;
            top: 10px;
            left: 12px;
            right: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;

            .category-pill {
              font-size: 0.7rem;
              font-weight: 700;
              padding: 3px 10px;
              border-radius: 12px;
              background: rgba(255,255,255,0.92);
              color: #0f172a;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);

              &.national { color: #c2410c; background: #fff7ed; }
              &.cultural { color: #be185d; background: #fdf2f8; }
              &.sports { color: #15803d; background: #f0fdf4; }
              &.ptm { color: #0369a1; background: #f0f9ff; }
              &.academic { color: #6d28d9; background: #f5f3ff; }
            }

            .status-pill {
              font-size: 0.68rem;
              font-weight: 700;
              padding: 2px 8px;
              border-radius: 10px;
              text-transform: uppercase;
              letter-spacing: 0.5px;

              &.scheduled { background: #dbeafe; color: #1e40af; }
              &.ongoing { background: #fef08a; color: #854d0e; }
              &.completed { background: #dcfce7; color: #166534; }
              &.cancelled { background: #fee2e2; color: #991b1b; }
            }
          }

          .date-badge-overlay {
            position: absolute;
            bottom: 10px;
            left: 12px;
            background: rgba(255,255,255,0.95);
            border-radius: 8px;
            padding: 4px 8px;
            text-align: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            display: flex;
            flex-direction: column;
            line-height: 1;

            .month-text {
              font-size: 0.62rem;
              font-weight: 800;
              color: #dc2626;
              letter-spacing: 0.5px;
            }

            .day-text {
              font-size: 1.15rem;
              font-weight: 800;
              color: #0f172a;
              margin-top: 2px;
            }
          }
        }

        .card-body {
          padding: 14px 16px;
          flex: 1;
          display: flex;
          flex-direction: column;

          .card-title-row {
            margin-bottom: 10px;

            .event-title {
              margin: 0;
              font-size: 1.05rem;
              font-weight: 700;
              color: #0f172a;
              line-height: 1.35;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
          }

          .meta-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 12px;

            .meta-item {
              display: flex;
              align-items: center;
              gap: 6px;
              font-size: 0.77rem;
              color: #475569;

              .meta-icon {
                font-size: 16px;
                width: 16px;
                height: 16px;
                color: #64748b;
                flex-shrink: 0;

                &.guest-icon { color: #f59e0b; }
              }

              span {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
            }
          }

          .event-desc {
            font-size: 0.77rem;
            color: #64748b;
            line-height: 1.45;
            margin: 0 0 12px;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          .circular-attachment {
            margin-top: auto;
            padding-top: 8px;

            .circular-link {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              font-size: 0.74rem;
              font-weight: 600;
              color: #dc2626;
              background: #fef2f2;
              border: 1px solid #fecaca;
              border-radius: 6px;
              padding: 5px 10px;
              text-decoration: none;
              transition: background 0.15s ease;

              &:hover {
                background: #fee2e2;
              }

              .pdf-icon { font-size: 16px; width: 16px; height: 16px; }
              .ext-icon { font-size: 14px; width: 14px; height: 14px; color: #991b1b; }
            }
          }
        }

        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 14px;
          background: #f8fafc;
          border-top: 1px solid #f1f5f9;

          .gallery-btn {
            border-color: #cbd5e1;
            color: #0284c7;
            font-size: 0.75rem;
            font-weight: 600;
            height: 32px;
            display: inline-flex;
            align-items: center;
            gap: 4px;

            mat-icon { font-size: 16px; width: 16px; height: 16px; }
          }

          .action-buttons {
            display: flex;
            align-items: center;

            .edit-btn { color: #64748b; &:hover { color: #2563eb; } }
            .del-btn { color: #64748b; &:hover { color: #dc2626; } }
          }
        }
      }
    }
  `]
})
export class EventsComponent implements OnInit {
  events: SchoolEvent[] = [];
  filteredEvents: SchoolEvent[] = [];
  loading = false;

  selectedCategory = '';
  selectedStatus = '';
  searchQuery = '';

  constructor(
    private eventsService: EventsService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.loading = true;
    this.eventsService.getEventsPaged(1, 100, this.searchQuery, this.selectedCategory, this.selectedStatus).subscribe({
      next: (res) => {
        this.loading = false;
        this.events = res.items || [];
        this.applyLocalFilters();
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  setCategory(category: string): void {
    this.selectedCategory = category;
    this.applyLocalFilters();
  }

  onSearchChange(): void {
    this.applyLocalFilters();
  }

  applyLocalFilters(): void {
    let result = [...this.events];

    if (this.selectedCategory) {
      result = result.filter(e => e.category.toLowerCase() === this.selectedCategory.toLowerCase());
    }

    if (this.selectedStatus) {
      result = result.filter(e => e.status.toLowerCase() === this.selectedStatus.toLowerCase());
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.venue && e.venue.toLowerCase().includes(q)) ||
        (e.chiefGuestName && e.chiefGuestName.toLowerCase().includes(q)) ||
        (e.coordinatorName && e.coordinatorName.toLowerCase().includes(q))
      );
    }

    this.filteredEvents = result;
  }

  get totalEvents(): number {
    return this.events.length;
  }

  get nationalCount(): number {
    return this.events.filter(e => e.category === 'National').length;
  }

  get culturalCount(): number {
    return this.events.filter(e => e.category === 'Cultural' || e.category === 'Celebration').length;
  }

  get totalPhotosCount(): number {
    return this.events.reduce((acc, curr) => acc + (curr.photosCount || 0), 0);
  }

  getCategoryCount(category: string): number {
    return this.events.filter(e => e.category.toLowerCase() === category.toLowerCase()).length;
  }

  getCategoryEmoji(category: string): string {
    switch (category) {
      case 'National': return '🇮🇳';
      case 'Cultural': return '🎭';
      case 'Sports': return '🏆';
      case 'PTM': return '🤝';
      case 'Academic': return '📚';
      case 'Celebration': return '💐';
      default: return '🎉';
    }
  }

  getFallbackGradient(category: string): string {
    switch (category) {
      case 'National': return 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #15803d 100%)';
      case 'Cultural': return 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)';
      case 'Sports': return 'linear-gradient(135deg, #10b981 0%, #047857 100%)';
      case 'PTM': return 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)';
      case 'Academic': return 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)';
      default: return 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
    }
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(EventFormDialogComponent, {
      width: '640px',
      data: {}
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadEvents();
      }
    });
  }

  openEditDialog(event: SchoolEvent): void {
    const dialogRef = this.dialog.open(EventFormDialogComponent, {
      width: '640px',
      data: { event }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadEvents();
      }
    });
  }

  openGalleryDialog(event: SchoolEvent): void {
    const dialogRef = this.dialog.open(EventGalleryDialogComponent, {
      width: '760px',
      data: { event }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && typeof result.photosCount === 'number') {
        event.photosCount = result.photosCount;
      }
    });
  }

  deleteEvent(event: SchoolEvent): void {
    if (!confirm(`Are you sure you want to delete "${event.title}"?`)) return;

    this.eventsService.deleteEvent(event.id).subscribe({
      next: () => {
        this.events = this.events.filter(e => e.id !== event.id);
        this.applyLocalFilters();
      },
      error: (err) => {
        alert('Failed to delete event: ' + (err.error?.message || err.message));
      }
    });
  }
}
