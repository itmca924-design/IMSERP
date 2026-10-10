import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { SchoolService, SchoolPeriodSlotDto, CreateSchoolPeriodSlotDto, BulkSaveSchoolPeriodSlotsDto } from '../../core/services/school.service';
import { BranchService, BranchDto } from '../../core/services/branch.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

interface PeriodEditorRow {
  id?: string;
  name: string;
  startTime: string;
  endTime: string;
  timeSlot: string;
  isBreak: boolean;
  displayOrder: number;
  isActive: boolean;
}

@Component({
  selector: 'app-period-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatChipsModule
  ],
  template: `
    <div class="page-container">
      <!-- Standard Light Blue Header matching Project Rules -->
      <div class="page-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>alarm_on</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Period & Bell Timings Master (पीरियड व समय प्रबंधन)</h1>
            <p class="page-subtitle">
              Configure daily school timetable timings, period durations, recess intervals, and branch-specific bell schedules.
            </p>
          </div>
        </div>
        <div class="header-actions">
          <div class="branch-selector-wrap">
            <mat-select
              [(ngModel)]="selectedBranchId"
              (selectionChange)="onBranchChange()"
              panelClass="branch-select-panel"
              class="branch-mat-select"
              disableOptionCentering>
              <mat-select-trigger>
                <div class="trigger-row">
                  <span class="branch-label">Institute / Branch:</span>
                  <span class="trigger-icon">{{ effectiveBranchId ? '🏫' : '🏢' }}</span>
                  <span class="trigger-name">{{ currentBranchDisplayName }}</span>
                </div>
              </mat-select-trigger>

              <mat-option value="ALL">
                <span class="opt-icon">🏢</span>
                <span class="opt-title">All Branches (Default / Main Campus)</span>
                <span class="opt-badge">Default</span>
              </mat-option>
              <mat-option *ngFor="let b of branches" [value]="b.id">
                <span class="opt-icon">🏫</span>
                <span class="opt-title">{{ b.name }}</span>
                <span class="opt-badge">{{ b.code }}</span>
              </mat-option>
            </mat-select>
          </div>

          <button mat-flat-button color="primary" class="btn-save-master" (click)="saveSlots()" [disabled]="saving || loading">
            <mat-icon>{{ saving ? 'hourglass_empty' : 'save' }}</mat-icon>
            {{ saving ? 'Saving...' : 'Save Schedule' }}
          </button>
        </div>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <div class="page-content" *ngIf="!loading">
        <!-- ⚡ 1-Click Smart Timetable Generator Card -->
        <mat-card class="generator-card mat-elevation-z1">
          <div class="gen-header">
            <div class="gen-title-wrap">
              <span class="gen-badge">⚡ Quick Generator</span>
              <h3 class="gen-title">1-Click Bell Schedule Generator (जादुई ऑटो-जनरेटर)</h3>
              <p class="gen-sub">Automatically calculate period timings by setting start time, duration, and lunch break.</p>
            </div>
            <div class="quick-presets">
              <span class="preset-label">Season Presets:</span>
              <button type="button" class="preset-btn" (click)="applyPreset('summer')">☀️ Summer (07:30 AM)</button>
              <button type="button" class="preset-btn" (click)="applyPreset('standard')">🏫 Standard (08:00 AM)</button>
              <button type="button" class="preset-btn" (click)="applyPreset('winter')">❄️ Winter (09:00 AM)</button>
            </div>
          </div>

          <div class="gen-inputs-grid">
            <div class="gen-field">
              <label class="g-label">School Start Time</label>
              <input type="time" 
                     [(ngModel)]="genStartTime24" 
                     (change)="onGenTimeChange()" 
                     class="g-input time-single-input" />
            </div>

            <div class="gen-field">
              <label class="g-label">Period Duration</label>
              <select [(ngModel)]="genDuration" class="g-select">
                <option [value]="35">35 Minutes</option>
                <option [value]="40">40 Minutes</option>
                <option [value]="45">45 Minutes</option>
                <option [value]="50">50 Minutes</option>
                <option [value]="60">60 Minutes</option>
              </select>
            </div>

            <div class="gen-field">
              <label class="g-label">Total Teaching Periods</label>
              <select [(ngModel)]="genTotalPeriods" class="g-select">
                <option [value]="5">5 Periods</option>
                <option [value]="6">6 Periods</option>
                <option [value]="7">7 Periods</option>
                <option [value]="8">8 Periods</option>
                <option [value]="9">9 Periods</option>
                <option [value]="10">10 Periods</option>
              </select>
            </div>

            <div class="gen-field">
              <label class="g-label">Lunch / Recess After</label>
              <select [(ngModel)]="genBreakAfter" class="g-select">
                <option [value]="3">After Period 3</option>
                <option [value]="4">After Period 4</option>
                <option [value]="5">After Period 5</option>
                <option [value]="0">No Lunch Break</option>
              </select>
            </div>

            <div class="gen-field" *ngIf="genBreakAfter > 0">
              <label class="g-label">Break Duration</label>
              <select [(ngModel)]="genBreakDuration" class="g-select">
                <option [value]="15">15 Minutes</option>
                <option [value]="20">20 Minutes</option>
                <option [value]="30">30 Minutes</option>
                <option [value]="45">45 Minutes</option>
              </select>
            </div>

            <div class="gen-action-col">
              <label class="g-label">&nbsp;</label>
              <button type="button" class="btn-run-generator" (click)="generateSchedule()">
                <mat-icon>auto_awesome</mat-icon> Generate Schedule
              </button>
            </div>
          </div>
        </mat-card>

        <!-- Live Timings Summary Pill Bar -->
        <div class="summary-bar">
          <div class="summary-pill primary-pill">
            <mat-icon>schedule</mat-icon>
            <span>School Timing: <strong>{{ computedSchoolHours }}</strong></span>
          </div>
          <div class="summary-pill">
            <mat-icon>menu_book</mat-icon>
            <span>Teaching Periods: <strong>{{ teachingPeriodCount }}</strong></span>
          </div>
          <div class="summary-pill">
            <mat-icon>restaurant</mat-icon>
            <span>Breaks / Recess: <strong>{{ breakCount }}</strong></span>
          </div>
          <div class="summary-pill branch-pill">
            <mat-icon>domain</mat-icon>
            <span>Scope: <strong>{{ currentScopeText }}</strong></span>
          </div>
        </div>

        <!-- Period Slots Master Table Card -->
        <mat-card class="slots-table-card mat-elevation-z1">
          <div class="table-header-row">
            <div>
              <h3 class="table-title">Configured Period Slots ({{ rows.length }})</h3>
              <p class="table-subtitle">Review, fine-tune individual slot times, or add custom periods.</p>
            </div>
            <button type="button" class="btn-add-row" (click)="addNewRow()">
              <mat-icon>add_circle_outline</mat-icon> + Add Custom Slot (कस्टम स्लॉट जोड़ें)
            </button>
          </div>

          <div class="table-responsive">
            <table class="slots-table">
              <thead>
                <tr>
                  <th style="width: 50px; text-align: center;"># Order</th>
                  <th style="min-width: 200px;">Slot / Period Name</th>
                  <th style="width: 140px;">Start Time</th>
                  <th style="width: 140px;">End Time</th>
                  <th style="min-width: 170px;">Formatted Time Slot</th>
                  <th style="width: 120px; text-align: center;">Type</th>
                  <th style="width: 80px; text-align: center;">Status</th>
                  <th style="width: 110px; text-align: center;">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of rows; let i = index" [class.is-break-row]="row.isBreak">
                  <td style="text-align: center;">
                    <div class="order-badge" [class.break-order]="row.isBreak">{{ i + 1 }}</div>
                  </td>
                  <td>
                    <div class="name-cell">
                      <div class="slot-icon-box" [class.is-break]="row.isBreak">
                        <mat-icon>{{ row.isBreak ? 'free_breakfast' : 'schedule' }}</mat-icon>
                      </div>
                      <input type="text" [(ngModel)]="row.name" class="row-input" placeholder="e.g. Period 1" (change)="updateRowTimeSlot(row)" />
                    </div>
                  </td>
                  <td>
                    <input type="time" 
                           [value]="to24(row.startTime)" 
                           (change)="onRowStartTimeChange(row, $any($event.target).value)" 
                           class="row-time-input" 
                           title="Click clock icon to pick Start Time" />
                  </td>
                  <td>
                    <input type="time" 
                           [value]="to24(row.endTime)" 
                           (change)="onRowEndTimeChange(row, $any($event.target).value)" 
                           class="row-time-input" 
                           title="Click clock icon to pick End Time" />
                  </td>
                  <td>
                    <span class="preview-slot-pill" [class.break-pill]="row.isBreak">
                      {{ row.timeSlot }}
                    </span>
                  </td>
                  <td style="text-align: center;">
                    <button type="button" class="type-toggle-btn" [class.btn-break]="row.isBreak" (click)="row.isBreak = !row.isBreak" matTooltip="Click to toggle Teaching vs Break">
                      <mat-icon>{{ row.isBreak ? 'restaurant' : 'school' }}</mat-icon>
                      <span>{{ row.isBreak ? 'Break' : 'Teaching' }}</span>
                    </button>
                  </td>
                  <td style="text-align: center;">
                    <mat-slide-toggle [(ngModel)]="row.isActive" color="primary"></mat-slide-toggle>
                  </td>
                  <td style="text-align: center;">
                    <div class="action-btns">
                      <button type="button" class="btn-icon-move" (click)="moveRow(i, -1)" [disabled]="i === 0" matTooltip="Move Up">
                        <mat-icon>arrow_upward</mat-icon>
                      </button>
                      <button type="button" class="btn-icon-move" (click)="moveRow(i, 1)" [disabled]="i === rows.length - 1" matTooltip="Move Down">
                        <mat-icon>arrow_downward</mat-icon>
                      </button>
                      <button type="button" class="btn-icon-del" (click)="deleteRow(i)" matTooltip="Remove Slot">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </div>
                  </td>
                </tr>

                <tr *ngIf="rows.length === 0">
                  <td colspan="8" class="empty-cell">
                    <mat-icon class="empty-icon">schedule</mat-icon>
                    <p>No period slots configured yet. Use the 1-Click Generator above to create your schedule!</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="table-footer">
            <button mat-button class="btn-reset" (click)="loadSlots()">
              <mat-icon>refresh</mat-icon> Reset / Reload
            </button>
            <button mat-flat-button color="primary" class="btn-save-master-bottom" (click)="saveSlots()" [disabled]="saving || rows.length === 0">
              <mat-icon>save</mat-icon> Save Bell Schedule
            </button>
          </div>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: 100%;
      box-sizing: border-box;
    }

    /* Strict Light Blue Header matching RULE */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 14px;
      padding: 18px 24px;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.05);

      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
      }

      .header-icon-box {
        background: #2563eb;
        color: #ffffff;
        border-radius: 10px;
        box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }

      .page-title {
        color: #1e3a8a;
        font-weight: 700;
        font-size: 1.25rem;
        margin: 0 0 2px 0;
      }

      .page-subtitle {
        color: #3b82f6;
        font-size: 0.85rem;
        margin: 0;
        font-weight: 500;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
        margin-left: auto;
      }
    }

    .branch-selector-wrap {
      display: flex;
      align-items: center;
      background: #ffffff;
      padding: 0 12px;
      height: 40px;
      box-sizing: border-box;
      border-radius: 8px;
      border: 1px solid #bfdbfe;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
      transition: all 0.2s ease;
      min-width: 360px;

      &:hover {
        border-color: #93c5fd;
      }

      &:focus-within {
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
      }

      .branch-mat-select {
        width: 100%;
        display: flex;
        align-items: center;
        cursor: pointer;

        .mat-mdc-select-trigger {
          display: flex;
          align-items: center;
          height: 38px;
          width: 100%;
          min-width: 0;
        }

        .mat-mdc-select-value {
          font-size: 0.85rem;
          font-weight: 600;
          color: #1e293b;
          min-width: 0;
          width: 100%;
          overflow: hidden;
        }

        .trigger-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          width: 100%;
          overflow: hidden;

          .branch-label {
            font-size: 0.82rem;
            font-weight: 700;
            color: #1e40af;
            white-space: nowrap;
            line-height: 1;
            flex-shrink: 0;
          }

          .trigger-icon {
            font-size: 0.95rem;
            line-height: 1;
            flex-shrink: 0;
          }

          .trigger-name {
            font-size: 0.85rem;
            font-weight: 600;
            color: #1e293b;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 0;
            flex: 1 1 auto;
          }
        }

        .mat-mdc-select-arrow-wrapper {
          transform: translateY(0);
          flex-shrink: 0;
          margin-left: 8px;
          .mat-mdc-select-arrow {
            color: #2563eb;
          }
        }
      }
    }

    ::ng-deep .branch-select-panel {
      width: 100% !important;
      min-width: 100% !important;
      max-width: calc(100vw - 28px) !important;
      box-sizing: border-box !important;
      border-radius: 12px !important;
      border: 1px solid #bfdbfe !important;
      background: #ffffff !important;
      box-shadow: 0 12px 30px -4px rgba(37, 99, 235, 0.15), 0 4px 12px -2px rgba(15, 23, 42, 0.08) !important;
      padding: 6px !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      margin-top: 4px !important;
      animation: panelFadeIn 0.15s ease-out !important;

      .mat-pseudo-checkbox {
        display: none !important;
      }

      .mat-mdc-option {
        min-height: 42px !important;
        padding: 0 14px !important;
        border-radius: 8px !important;
        margin-bottom: 3px !important;
        transition: all 0.15s ease !important;
        box-sizing: border-box !important;
        max-width: 100% !important;

        .mdc-list-item__primary-text {
          font-size: 0.86rem !important;
          color: #1e293b !important;
          font-weight: 600 !important;
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          width: 100% !important;
          min-width: 0 !important;
          overflow: hidden !important;
        }

        .opt-icon {
          font-size: 1rem;
          line-height: 1;
          flex-shrink: 0;
        }

        .opt-title {
          flex: 1 1 auto;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .opt-badge {
          margin-left: auto;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          flex-shrink: 0;
        }

        &:hover:not(.mdc-list-item--disabled) {
          background-color: #f1f5f9 !important;
        }

        &.mdc-list-item--selected:not(.mdc-list-item--disabled) {
          background-color: #eff6ff !important;
          .mdc-list-item__primary-text {
            color: #1e40af !important;
            font-weight: 700 !important;
          }
          .opt-badge {
            background: #2563eb;
            color: #ffffff;
            border-color: #2563eb;
          }
        }
      }
    }

    @keyframes panelFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .btn-save-master {
      background: #2563eb !important;
      color: #ffffff !important;
      font-weight: 700 !important;
      border-radius: 8px;
      padding: 0 20px;
      height: 40px;
      white-space: nowrap !important;
      flex-shrink: 0;
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px;
    }

    /* Generator Card */
    .generator-card {
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 20px;
      margin-bottom: 18px;
    }

    .gen-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .gen-badge {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 700;
      color: #2563eb;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 2px 8px;
      border-radius: 6px;
      margin-bottom: 4px;
    }

    .gen-title {
      margin: 0 0 2px 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
    }

    .gen-sub {
      margin: 0;
      font-size: 0.8rem;
      color: #64748b;
    }

    .quick-presets {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;

      .preset-label {
        font-size: 0.78rem;
        font-weight: 600;
        color: #64748b;
      }

      .preset-btn {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 0.75rem;
        font-weight: 600;
        color: #334155;
        cursor: pointer;
        transition: all 0.2s;
        &:hover {
          background: #eff6ff;
          border-color: #93c5fd;
          color: #1d4ed8;
        }
      }
    }

    .gen-inputs-grid {
      display: flex;
      flex-wrap: nowrap;
      gap: 12px;
      align-items: flex-start;
      background: #f8fafc;
      padding: 16px;
      border-radius: 10px;
      border: 1px solid #f1f5f9;
      overflow-x: auto;
    }

    .gen-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1 1 0;
      min-width: 120px;

      .g-label {
        font-size: 0.78rem;
        font-weight: 700;
        color: #475569;
        white-space: nowrap;
        height: 18px;
        line-height: 18px;
        display: block;
      }

      .g-input, .g-select {
        height: 38px;
        padding: 0 10px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 0.85rem;
        color: #1e293b;
        background: #ffffff;
        outline: none;
        width: 100%;
        box-sizing: border-box;
        transition: border 0.2s;
        &:focus { border-color: #2563eb; }
      }
    }

    .time-single-input {
      font-weight: 600;
      color: #0f172a;
      cursor: pointer;
    }

    .gen-action-col {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex-shrink: 0;

      .g-label {
        height: 18px;
        line-height: 18px;
        display: block;
      }
    }

    .btn-run-generator {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 38px;
      background: #16a34a;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.88rem;
      cursor: pointer;
      transition: all 0.2s;
      padding: 0 18px;
      white-space: nowrap !important;
      box-shadow: 0 2px 4px rgba(22, 163, 74, 0.2);
      &:hover { background: #15803d; }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .row-time-input {
      height: 36px;
      padding: 0 10px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.88rem;
      font-weight: 600;
      color: #0f172a;
      background: #ffffff;
      cursor: pointer;
      outline: none;
      transition: all 0.2s;
      width: 130px;
      box-sizing: border-box;

      &:focus {
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
      }
    }

    /* Summary Bar */
    .summary-bar {
      display: flex;
      gap: 10px;
      margin-bottom: 18px;
      flex-wrap: wrap;
    }

    .summary-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.8rem;
      color: #475569;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);

      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #64748b; }
      strong { color: #0f172a; }

      &.primary-pill {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #1e40af;
        mat-icon { color: #2563eb; }
        strong { color: #1e3a8a; }
      }

      &.branch-pill {
        margin-left: auto;
        background: #faf5ff;
        border-color: #e9d5ff;
        color: #6b21a8;
        mat-icon { color: #9333ea; }
        strong { color: #581c87; }
      }
    }

    /* Table Card */
    .slots-table-card {
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 20px;
    }

    .table-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      .table-title {
        margin: 0 0 2px 0;
        font-size: 1.05rem;
        font-weight: 700;
        color: #0f172a;
      }
      .table-subtitle {
        margin: 0;
        font-size: 0.78rem;
        color: #64748b;
      }
    }

    .btn-add-row {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      font-weight: 700;
      font-size: 0.82rem;
      border-radius: 6px;
      padding: 6px 14px;
      cursor: pointer;
      transition: all 0.2s;
      &:hover { background: #dbeafe; }
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
    }

    .table-responsive {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
    }

    .slots-table {
      width: 100%;
      min-width: 900px;
      border-collapse: collapse;

      th {
        background: #f8fafc;
        padding: 10px 12px;
        font-size: 0.75rem;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 2px solid #e2e8f0;
      }

      td {
        padding: 9px 12px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: middle;
      }

      tr:hover td {
        background: #fbfdff;
      }

      tr.is-break-row td {
        background: #fffbeb;
      }
    }

    .order-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 6px;
      background: #e2e8f0;
      color: #334155;
      font-weight: 700;
      font-size: 0.78rem;

      &.break-order {
        background: #fef3c7;
        color: #92400e;
      }
    }

    .name-cell {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .slot-icon-box {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        line-height: 18px;
      }

      &.is-break {
        background: #fef3c7;
        color: #b45309;
        border-color: #fde68a;
      }
    }

    .row-input {
      flex: 1;
      min-width: 0;
      height: 36px;
      padding: 0 10px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.86rem;
      color: #1e293b;
      outline: none;
      transition: all 0.2s;
      &:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15); }
    }

    .preview-slot-pill {
      display: inline-block;
      font-family: monospace;
      font-size: 0.8rem;
      font-weight: 700;
      color: #1e40af;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 3px 10px;
      border-radius: 6px;

      &.break-pill {
        background: #fef3c7;
        border-color: #fde68a;
        color: #92400e;
      }
    }

    .type-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 3px 10px;
      font-size: 0.75rem;
      font-weight: 700;
      color: #475569;
      cursor: pointer;
      transition: all 0.2s;

      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #2563eb; }

      &.btn-break {
        background: #fef3c7;
        border-color: #fde68a;
        color: #92400e;
        mat-icon { color: #d97706; }
      }
    }

    .action-btns {
      display: flex;
      justify-content: center;
      gap: 4px;
    }

    .btn-icon-move, .btn-icon-del {
      background: transparent;
      border: none;
      border-radius: 4px;
      padding: 3px;
      cursor: pointer;
      color: #64748b;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      &:hover { background: #f1f5f9; color: #0f172a; }
      &:disabled { opacity: 0.3; cursor: not-allowed; }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .btn-icon-del:hover {
      background: #fee2e2 !important;
      color: #dc2626 !important;
    }

    .table-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid #f1f5f9;
    }

    .btn-save-master-bottom {
      background: #2563eb !important;
      color: #ffffff !important;
      font-weight: 700 !important;
      border-radius: 8px;
      padding: 0 24px;
      height: 42px;
    }

    .empty-cell {
      text-align: center;
      padding: 40px 10px;
      color: #94a3b8;
      .empty-icon { font-size: 36px; width: 36px; height: 36px; color: #cbd5e1; margin-bottom: 8px; }
      p { margin: 0; font-size: 0.85rem; }
    }

    /* ====================================================
       RESPONSIVE BREAKPOINTS (Desktop, Tablet, Mobile)
       ==================================================== */
    @media (max-width: 1100px) {
      .gen-inputs-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
        align-items: flex-start;
      }
      .gen-action-col {
        grid-column: 1 / -1;
        .btn-run-generator {
          width: 100%;
        }
      }
    }

    @media (max-width: 960px) {
      .page-header {
        flex-direction: column;
        align-items: stretch;
        padding: 16px;
        gap: 14px;

        .header-left {
          width: 100%;
        }

        .header-actions {
          width: 100%;
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
          margin-left: 0;
        }

        .branch-selector-wrap {
          width: 100%;
          box-sizing: border-box;
          min-width: 0;
          padding: 0 10px;

          .branch-mat-select {
            width: 100%;
          }
        }

        .btn-save-master {
          width: 100%;
          justify-content: center;
        }
      }

      .table-header-row {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;

        .btn-add-row {
          width: 100%;
          justify-content: center;
        }
      }
    }

    @media (max-width: 768px) {
      .generator-card, .slots-table-card {
        padding: 14px;
      }

      .gen-header {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }

      .quick-presets {
        width: 100%;
        .preset-btn {
          flex: 1 1 auto;
          text-align: center;
        }
      }

      .summary-bar {
        gap: 8px;
        .summary-pill {
          flex: 1 1 auto;
          justify-content: center;
          &.branch-pill {
            margin-left: 0;
          }
        }
      }

      .table-footer {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;

        .btn-reset, .btn-save-master-bottom {
          width: 100%;
          justify-content: center;
        }
      }
    }

    @media (max-width: 480px) {
      .page-header {
        padding: 12px;

        .header-left {
          gap: 10px;
        }

        .header-icon-box {
          width: 38px;
          height: 38px;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
        }

        .page-title {
          font-size: 1.05rem;
        }

        .page-subtitle {
          font-size: 0.78rem;
        }

        .branch-selector-wrap {
          padding: 0 8px;
          gap: 6px;

          .branch-label {
            font-size: 0.74rem;
          }

          .branch-mat-select {
            .trigger-row {
              .trigger-name {
                font-size: 0.78rem;
              }
            }
          }
        }
      }

      .gen-inputs-grid {
        grid-template-columns: 1fr;
      }

      .table-responsive {
        margin: 0 -14px;
        width: calc(100% + 28px);
      }
    }
  `]
})
export class PeriodSettingsComponent implements OnInit {
  loading = false;
  saving = false;

  branches: BranchDto[] = [];
  selectedBranchId: string = 'ALL';

  get effectiveBranchId(): string | null {
    return (!this.selectedBranchId || this.selectedBranchId === 'ALL') ? null : this.selectedBranchId;
  }

  rows: PeriodEditorRow[] = [];

  // Generator inputs
  genStartTime = '08:00 AM';
  genStartTime24 = '08:00';
  genDuration = 45;
  genTotalPeriods = 8;
  genBreakAfter = 4;
  genBreakDuration = 30;

  constructor(
    private schoolService: SchoolService,
    private branchService: BranchService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadBranches();
    this.loadSlots();
  }

  loadBranches(): void {
    this.branchService.getAllBranches().subscribe({
      next: (b) => this.branches = b || [],
      error: () => this.branches = []
    });
  }

  onBranchChange(): void {
    this.loadSlots();
  }

  loadSlots(): void {
    this.loading = true;
    this.schoolService.getPeriodSlots(this.effectiveBranchId, false).subscribe({
      next: (slots) => {
        this.loading = false;
        if (slots && slots.length > 0) {
          this.rows = slots.map((s, index) => ({
            id: s.id,
            name: s.name,
            startTime: s.startTime,
            endTime: s.endTime,
            timeSlot: s.timeSlot,
            isBreak: s.isBreak,
            displayOrder: s.displayOrder || (index + 1),
            isActive: s.isActive
          }));
        } else {
          // Default initial rows if DB is totally empty
          this.applyPreset('standard', false);
        }
      },
      error: () => {
        this.loading = false;
        this.applyPreset('standard', false);
      }
    });
  }

  applyPreset(preset: 'summer' | 'standard' | 'winter', showAlert: boolean = true): void {
    if (preset === 'summer') {
      this.genStartTime = '07:30 AM';
      this.genStartTime24 = '07:30';
      this.genDuration = 40;
      this.genTotalPeriods = 7;
      this.genBreakAfter = 4;
      this.genBreakDuration = 20;
    } else if (preset === 'winter') {
      this.genStartTime = '09:00 AM';
      this.genStartTime24 = '09:00';
      this.genDuration = 45;
      this.genTotalPeriods = 8;
      this.genBreakAfter = 4;
      this.genBreakDuration = 30;
    } else {
      this.genStartTime = '08:00 AM';
      this.genStartTime24 = '08:00';
      this.genDuration = 45;
      this.genTotalPeriods = 8;
      this.genBreakAfter = 4;
      this.genBreakDuration = 30;
    }
    this.generateSchedule(showAlert);
  }

  to24(time12: string): string {
    if (!time12) return '08:00';
    const clean = time12.trim();
    if (/^\d{2}:\d{2}$/.test(clean)) return clean;
    const { hours, minutes } = this.parseTimeStr(clean);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  to12(time24: string): string {
    if (!time24) return '';
    const parts = time24.split(':');
    if (parts.length < 2) return time24;
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${m} ${period}`;
  }

  onGenTimeChange(): void {
    if (this.genStartTime24) {
      this.genStartTime = this.to12(this.genStartTime24);
    }
  }

  onRowStartTimeChange(row: PeriodEditorRow, val24: string): void {
    if (!val24) return;
    row.startTime = this.to12(val24);
    this.updateRowTimeSlot(row);
  }

  onRowEndTimeChange(row: PeriodEditorRow, val24: string): void {
    if (!val24) return;
    row.endTime = this.to12(val24);
    this.updateRowTimeSlot(row);
  }

  generateSchedule(showAlert: boolean = true): void {
    // Generate locally for snappy UI response
    const startParts = this.parseTimeStr(this.genStartTime);
    let curDate = new Date();
    curDate.setHours(startParts.hours, startParts.minutes, 0, 0);

    const generated: PeriodEditorRow[] = [];
    let periodNum = 1;
    let order = 1;

    for (let i = 1; i <= this.genTotalPeriods; i++) {
      const pStart = new Date(curDate);
      curDate.setMinutes(curDate.getMinutes() + Number(this.genDuration));
      const pEnd = new Date(curDate);

      const sStr = this.formatTimeStr(pStart);
      const eStr = this.formatTimeStr(pEnd);

      generated.push({
        name: `Period ${periodNum}`,
        startTime: sStr,
        endTime: eStr,
        timeSlot: `${sStr} - ${eStr}`,
        isBreak: false,
        displayOrder: order++,
        isActive: true
      });

      periodNum++;

      if (this.genBreakAfter > 0 && i === Number(this.genBreakAfter) && this.genBreakDuration > 0) {
        const bStart = new Date(curDate);
        curDate.setMinutes(curDate.getMinutes() + Number(this.genBreakDuration));
        const bEnd = new Date(curDate);

        const bsStr = this.formatTimeStr(bStart);
        const beStr = this.formatTimeStr(bEnd);

        generated.push({
          name: 'Recess / Lunch Break',
          startTime: bsStr,
          endTime: beStr,
          timeSlot: `${bsStr} - ${beStr}`,
          isBreak: true,
          displayOrder: order++,
          isActive: true
        });
      }
    }

    this.rows = generated;

    if (showAlert) {
      const lastRow = generated[generated.length - 1];
      const recessInfoEn = this.genBreakAfter > 0 ? `${this.genBreakDuration} mins recess break` : 'No recess break';
      const recessInfoHi = this.genBreakAfter > 0 ? `${this.genBreakDuration} मिनट का लंच/रिसेस ब्रेक` : 'कोई ब्रेक नहीं';

      this.confirmDialog.bilingualAlert({
        titleEn: 'Schedule Generated Successfully!',
        titleHi: 'शेड्यूल सफलतापूर्वक तैयार किया गया!',
        messageEn: `
          <div style="font-weight: 600; color: #1e3a8a; margin-bottom: 8px;">
            Daily School Timings: <strong>${this.genStartTime}</strong> to <strong>${lastRow?.endTime || ''}</strong>
          </div>
          <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
            <span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 2px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">
              Total Slots: ${generated.length}
            </span>
            <span style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 2px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">
              Teaching: ${this.genTotalPeriods} Periods
            </span>
            <span style="background: #fefce8; color: #a16207; border: 1px solid #fef08a; padding: 2px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">
              Recess: ${recessInfoEn}
            </span>
          </div>
          <p style="margin: 0; color: #475569; line-height: 1.6;">
            All ${generated.length} period slots have been calculated. Please review the timings in the table below and click <strong>'Save Schedule'</strong> to apply changes to the database.
          </p>
        `,
        messageHi: `
          <div style="font-weight: 600; color: #1e3a8a; margin-bottom: 8px;">
            दैनिक स्कूल समय: <strong>${this.genStartTime}</strong> से <strong>${lastRow?.endTime || ''}</strong> तक
          </div>
          <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
            <span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 2px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">
              कुल स्लॉट्स: ${generated.length}
            </span>
            <span style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 2px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">
              पढ़ाई के पीरियड: ${this.genTotalPeriods}
            </span>
            <span style="background: #fefce8; color: #a16207; border: 1px solid #fef08a; padding: 2px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">
              इंटरवल/लंच: ${recessInfoHi}
            </span>
          </div>
          <p style="margin: 0; color: #475569; line-height: 1.6;">
            कुल ${generated.length} पीरियड स्लॉट्स सफलतापूर्वक जनरेट कर लिए गए हैं। कृपया नीचे दी गई तालिका में समय की समीक्षा करें और डेटाबेस में सुरक्षित करने के लिए <strong>'Save Schedule'</strong> बटन पर क्लिक करें।
          </p>
        `,
        type: 'success'
      });
    }
  }

  addNewRow(): void {
    const last = this.rows[this.rows.length - 1];
    let startStr = '08:00 AM';
    let endStr = '08:45 AM';

    if (last && last.endTime) {
      startStr = last.endTime;
      const parsed = this.parseTimeStr(startStr);
      const d = new Date();
      d.setHours(parsed.hours, parsed.minutes + 45, 0, 0);
      endStr = this.formatTimeStr(d);
    }

    const nextNum = this.rows.filter(r => !r.isBreak).length + 1;
    this.rows.push({
      name: `Period ${nextNum}`,
      startTime: startStr,
      endTime: endStr,
      timeSlot: `${startStr} - ${endStr}`,
      isBreak: false,
      displayOrder: this.rows.length + 1,
      isActive: true
    });
  }

  updateRowTimeSlot(row: PeriodEditorRow): void {
    if (row.startTime && row.endTime) {
      row.timeSlot = `${row.startTime.trim()} - ${row.endTime.trim()}`;
    }
  }

  moveRow(index: number, delta: number): void {
    const newIdx = index + delta;
    if (newIdx < 0 || newIdx >= this.rows.length) return;
    const temp = this.rows[index];
    this.rows[index] = this.rows[newIdx];
    this.rows[newIdx] = temp;
    this.rows.forEach((r, idx) => r.displayOrder = idx + 1);
  }

  deleteRow(index: number): void {
    this.rows.splice(index, 1);
    this.rows.forEach((r, idx) => r.displayOrder = idx + 1);
  }

  saveSlots(): void {
    if (this.rows.length === 0) {
      this.confirmDialog.bilingualAlert({
        titleEn: 'No Slots Configured',
        titleHi: 'कोई स्लॉट नहीं मिला',
        messageEn: 'Please add or generate at least one period slot before saving.',
        messageHi: 'कृपया शेड्यूल सहेजने से पहले कम से कम एक पीरियड स्लॉट जोड़ें या जनरेट करें।',
        type: 'warning'
      });
      return;
    }

    this.saving = true;
    const targetBranchId = this.effectiveBranchId;
    const payload: BulkSaveSchoolPeriodSlotsDto = {
      branchId: targetBranchId,
      slots: this.rows.map((r, idx) => ({
        branchId: targetBranchId,
        name: r.name.trim(),
        startTime: r.startTime.trim(),
        endTime: r.endTime.trim(),
        timeSlot: r.timeSlot.trim(),
        isBreak: r.isBreak,
        displayOrder: idx + 1,
        isActive: r.isActive
      }))
    };

    this.schoolService.bulkSavePeriodSlots(payload).subscribe({
      next: (saved) => {
        this.saving = false;
        const count = saved?.length || this.rows.length;
        const scope = this.currentScopeText;
        this.confirmDialog.bilingualAlert({
          titleEn: 'Schedule Saved Successfully!',
          titleHi: 'शेड्यूल सफलतापूर्वक सहेजा गया!',
          messageEn: `
            <div style="font-weight: 600; color: #166534; margin-bottom: 8px;">
              ${count} Period Slots Saved to Database
            </div>
            <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
              <span style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 2px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">
                Campus: ${scope}
              </span>
              <span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 2px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">
                Hours: ${this.computedSchoolHours}
              </span>
            </div>
            <p style="margin: 0; color: #475569; line-height: 1.6;">
              The bell schedule and period slot timings have been securely saved. These updated timings will now automatically reflect across class routines, timetables, and teacher allocations.
            </p>
          `,
          messageHi: `
            <div style="font-weight: 600; color: #166534; margin-bottom: 8px;">
              कुल ${count} पीरियड स्लॉट्स डेटाबेस में सुरक्षित सहेजे गए
            </div>
            <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
              <span style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 2px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">
                कैंपस: ${scope}
              </span>
              <span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 2px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">
                स्कूल समय: ${this.computedSchoolHours}
              </span>
            </div>
            <p style="margin: 0; color: #475569; line-height: 1.6;">
              कुल ${count} पीरियड स्लॉट्स सफलतापूर्वक सहेज लिए गए हैं। अब क्लास रूटीन और टाइम-टेबल बनाते समय यह नया समय स्वचालित रूप से प्रदर्शित और लागू रहेगा।
            </p>
          `,
          type: 'success'
        });
        this.loadSlots();
      },
      error: (err) => {
        this.saving = false;
        this.confirmDialog.bilingualAlert({
          titleEn: 'Save Failed',
          titleHi: 'सहेजना विफल रहा',
          messageEn: err.error?.message || 'Failed to save period slots to the database. Please try again.',
          messageHi: err.error?.message || 'पीरियड स्लॉट्स डेटाबेस में सहेजने में त्रुटि हुई। कृपया पुनः प्रयास करें।',
          type: 'danger'
        });
      }
    });
  }

  get teachingPeriodCount(): number {
    return this.rows.filter(r => !r.isBreak && r.isActive).length;
  }

  get breakCount(): number {
    return this.rows.filter(r => r.isBreak && r.isActive).length;
  }

  get computedSchoolHours(): string {
    if (this.rows.length === 0) return 'Not configured';
    const first = this.rows[0];
    const last = this.rows[this.rows.length - 1];
    return `${first.startTime} to ${last.endTime}`;
  }

  get currentScopeText(): string {
    const bId = this.effectiveBranchId;
    if (!bId) return 'All Branches (Default)';
    const b = this.branches.find(x => x.id === bId);
    return b ? `${b.name} (${b.code})` : 'Specific Branch';
  }

  get currentBranchDisplayName(): string {
    const bId = this.effectiveBranchId;
    if (!bId) return 'All Branches (Default / Main Campus)';
    const b = this.branches.find(x => x.id === bId);
    return b ? `${b.name} (${b.code})` : 'All Branches (Default / Main Campus)';
  }

  private parseTimeStr(tStr: string): { hours: number; minutes: number } {
    const s = (tStr || '08:00 AM').trim().toUpperCase();
    const isPM = s.includes('PM');
    const isAM = s.includes('AM');
    const cleaned = s.replace('AM', '').replace('PM', '').trim();
    const [hStr, mStr] = cleaned.split(':');
    let hours = parseInt(hStr || '8', 10);
    const minutes = parseInt(mStr || '0', 10);

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    return { hours, minutes };
  }

  private formatTimeStr(date: Date): string {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 => 12
    const hStr = hours < 10 ? '0' + hours : `${hours}`;
    const mStr = minutes < 10 ? '0' + minutes : `${minutes}`;
    return `${hStr}:${mStr} ${ampm}`;
  }
}
