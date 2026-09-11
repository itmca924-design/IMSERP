import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CoachingService } from '../../core/services/coaching.service';

@Component({
  selector: 'app-whatsapp',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <div class="whatsapp-wrapper">
      <div class="header-actions">
        <div>
          <h2>WhatsApp Parent Notification Audit Logs</h2>
          <p>Track delivery status, IST timestamps, and exact message contents sent to parents.</p>
        </div>
      </div>

      <mat-card class="table-card mat-elevation-z2">
        <div class="filter-toolbar">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search WhatsApp Logs...</mat-label>
            <input
              matInput
              [(ngModel)]="searchTerm"
              (keyup.enter)="onSearch()"
              placeholder="Search by Student, Phone, Content..."
            />
            <button mat-icon-button matSuffix (click)="onSearch()" aria-label="Search">
              <mat-icon>search</mat-icon>
            </button>
          </mat-form-field>

          <mat-form-field appearance="outline" class="type-filter">
            <mat-label>Filter by Message Type</mat-label>
            <mat-select [(ngModel)]="selectedTypeFilter" (selectionChange)="onTypeFilterChange()">
              <mat-option value="">All Message Types</mat-option>
              <mat-option value="FeeReceipt">Fee Payment Receipt</mat-option>
              <mat-option value="FeeReminder">Fee Due Reminder</mat-option>
              <mat-option value="TestMarks">Test Marks Report</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-progress-bar mode="indeterminate" *ngIf="loading" class="grid-loader"></mat-progress-bar>

        <mat-card-content class="table-container">
          <table mat-table [dataSource]="logs" matSort (matSortChange)="onSortChange($event)" class="full-width">
            
            <!-- Time Dispatched (Formatted in IST +05:30) -->
            <ng-container matColumnDef="sentAt">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="sentAt">Time Dispatched (IST)</th>
              <td mat-cell *matCellDef="let log" class="time-cell">
                <span class="ist-time-text">
                  <mat-icon class="clock-icon">schedule</mat-icon>
                  {{ log.sentAt | date:'MMM d, y, hh:mm:ss a':'++0530' }}
                </span>
              </td>
            </ng-container>

            <!-- Student Name -->
            <ng-container matColumnDef="studentName">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="studentName">Student</th>
              <td mat-cell *matCellDef="let log">
                <strong>{{ log.studentName }}</strong>
              </td>
            </ng-container>

            <!-- Parent Phone -->
            <ng-container matColumnDef="recipientPhone">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="recipientPhone">Parent Phone</th>
              <td mat-cell *matCellDef="let log">
                <span class="wa-phone">
                  <mat-icon class="wa-icon">chat</mat-icon>
                  {{ log.recipientPhone }}
                </span>
              </td>
            </ng-container>

            <!-- Message Type -->
            <ng-container matColumnDef="messageType">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="messageType">Message Type</th>
              <td mat-cell *matCellDef="let log">
                <span [class]="getBadgeClass(log.messageType)">
                  {{ formatMessageType(log.messageType) }}
                </span>
              </td>
            </ng-container>

            <!-- Message Content -->
            <ng-container matColumnDef="content">
              <th mat-header-cell *matHeaderCellDef>Message Content</th>
              <td mat-cell *matCellDef="let log">
                <div class="msg-content">{{ log.content }}</div>
              </td>
            </ng-container>

            <!-- Status -->
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="status">Status</th>
              <td mat-cell *matCellDef="let log">
                <span class="status-badge delivered">
                  <mat-icon class="check-icon">done_all</mat-icon>
                  {{ log.status }}
                </span>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell empty-cell" [attr.colspan]="displayedColumns.length">
                <div class="empty-state" *ngIf="!loading">
                  <mat-icon class="empty-icon">chat</mat-icon>
                  <p>No WhatsApp dispatch logs found matching your filter criteria.</p>
                </div>
              </td>
            </tr>
          </table>
        </mat-card-content>

        <mat-paginator
          [length]="totalCount"
          [pageSize]="pageSize"
          [pageSizeOptions]="[5, 10, 20, 50]"
          [pageIndex]="pageIndex"
          (page)="onPageChange($event)"
          showFirstLastButtons>
        </mat-paginator>
      </mat-card>
    </div>
  `,
  styles: [`
    .whatsapp-wrapper {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .header-actions {
      h2 { margin: 0; font-size: 1.5rem; color: #128c7e; font-weight: 700; }
      p { margin: 4px 0 0 0; color: #666; font-size: 0.9rem; }
    }
    .table-card {
      border-radius: 8px;
      overflow: hidden;
      position: relative;
    }
    .filter-toolbar {
      padding: 16px 20px 0 20px;
      display: flex;
      gap: 16px;
      align-items: center;

      .search-field { width: 340px; }
      .type-filter { width: 240px; }
    }
    .grid-loader { margin-top: 4px; }
    .table-container { padding: 0; }
    .full-width { width: 100%; }

    .time-cell {
      white-space: nowrap;
    }
    .ist-time-text {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85rem;
      color: #334155;
      font-weight: 500;

      .clock-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #0284c7;
      }
    }

    .wa-phone {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      color: #128c7e;
      white-space: nowrap;
      .wa-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .msg-content {
      max-width: 420px;
      white-space: pre-wrap;
      font-size: 0.84rem;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
      border-radius: 6px;
      color: #1e293b;
      line-height: 1.4;
    }

    .type-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;

      &.receipt { background-color: #dcfce7; color: #15803d; }
      &.reminder { background-color: #fef3c7; color: #b45309; }
      &.marks { background-color: #e0f2fe; color: #0369a1; }
      &.general { background-color: #f1f5f9; color: #475569; }
    }

    .status-badge.delivered {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background-color: #dcfce7;
      color: #166534;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.78rem;
      font-weight: 600;
      white-space: nowrap;

      .check-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #16a34a;
      }
    }

    .empty-cell { padding: 40px; text-align: center; }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      color: #94a3b8;
      .empty-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 8px; }
    }
  `]
})
export class WhatsAppLogsComponent implements OnInit {
  logs: any[] = [];
  displayedColumns = ['sentAt', 'studentName', 'recipientPhone', 'messageType', 'content', 'status'];

  loading = false;
  totalCount = 0;
  pageSize = 10;
  pageIndex = 0;
  searchTerm = '';
  selectedTypeFilter = '';
  sortBy = 'sentAt';
  sortDescending = true;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(private coachingService: CoachingService) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.loading = true;
    this.coachingService.getWhatsAppLogsPaged(
      this.pageIndex + 1,
      this.pageSize,
      this.searchTerm,
      this.selectedTypeFilter,
      this.sortBy,
      this.sortDescending
    ).subscribe({
      next: (res) => {
        this.logs = res.items;
        this.totalCount = res.totalCount;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        console.error('Error fetching paged WhatsApp logs:', err);
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadLogs();
  }

  onSortChange(sort: Sort): void {
    this.sortBy = sort.active || 'sentAt';
    this.sortDescending = sort.direction === 'desc';
    this.pageIndex = 0;
    this.loadLogs();
  }

  onTypeFilterChange(): void {
    this.pageIndex = 0;
    this.loadLogs();
  }

  onSearch(): void {
    this.pageIndex = 0;
    this.loadLogs();
  }

  formatMessageType(typeStr: string): string {
    switch (typeStr) {
      case 'FeeReceipt': return 'Fee Payment Receipt';
      case 'FeeReminder': return 'Fee Due Reminder';
      case 'TestMarks': return 'Test Marks Report';
      default: return typeStr || 'Notification';
    }
  }

  getBadgeClass(typeStr: string): string {
    switch (typeStr) {
      case 'FeeReceipt': return 'type-badge receipt';
      case 'FeeReminder': return 'type-badge reminder';
      case 'TestMarks': return 'type-badge marks';
      default: return 'type-badge general';
    }
  }
}
