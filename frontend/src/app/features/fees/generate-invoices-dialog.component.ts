import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FeesService, GenerateInvoicesResult } from '../../core/services/fees.service';
import { BatchDto } from '../../core/services/batches.service';
import { SchoolClassDto } from '../../core/services/school.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

export interface GenerateInvoicesDialogData {
  batches: BatchDto[];
  classes?: SchoolClassDto[];
  defaultBatchId?: string;
  defaultClassId?: string;
  targetStudentId?: string;
  targetStudentName?: string;
  targetRollNumber?: string;
  defaultMonth?: number;
  defaultYear?: number;
}

interface BillingCycleOption {
  value: number;
  label: string;
  icon: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

@Component({
  selector: 'app-generate-invoices-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dialog-wrapper">
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>post_add</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">Generate Fee Invoices</h2>
          <p class="subtitle">Bulk-bill tuition fees across any billing cycle.</p>
        </div>
        <button mat-icon-button type="button" class="close-btn" (click)="onCancel()" [disabled]="saving">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-content">

          <!-- Target Student Card (if opened for a specific student) -->
          <div *ngIf="data.targetStudentName" class="target-student-card">
            <div class="card-icon-pill">
              <mat-icon>person</mat-icon>
            </div>
            <div class="card-content">
              <div class="st-main">
                <span class="st-role-badge">NEW ADMISSION</span>
                <strong class="st-name">{{ data.targetStudentName }}</strong>
                <span class="st-roll">({{ data.targetRollNumber }})</span>
              </div>
              <div class="st-sub-details">
                <span *ngIf="getSelectedTargetClassName()" class="sub-pill school">
                  🏫 {{ getSelectedTargetClassName() }}
                </span>
                <span *ngIf="getSelectedTargetBatchName()" class="sub-pill batch">
                  🎯 {{ getSelectedTargetBatchName() }}
                </span>
              </div>
            </div>
          </div>

          <!-- Info Callout -->
          <div class="info-callout" *ngIf="!data.targetStudentName">
            <mat-icon class="info-icon">auto_awesome</mat-icon>
            <div class="info-text">
              <strong>Smart Auto-Billing Engine:</strong> Invoices use each student's batch fee rate multiplied by the selected cycle. Students who already have an invoice for the selected period are <strong>automatically skipped</strong>.
            </div>
          </div>

          <!-- Billing Cycle Selector -->
          <div class="section-label">
            <mat-icon class="section-icon">autorenew</mat-icon>
            <span>Billing Cycle</span>
          </div>
          <div class="cycle-grid">
            <button
              *ngFor="let c of billingCycles"
              type="button"
              class="cycle-tile"
              [class.selected]="selectedCycle === c.value"
              [style.--cycle-color]="c.color"
              [style.--cycle-bg]="c.bgColor"
              [style.--cycle-border]="c.borderColor"
              (click)="selectCycle(c.value)"
            >
              <mat-icon class="cycle-icon">{{ c.icon }}</mat-icon>
              <span class="cycle-label">{{ c.label }}</span>
              <span class="cycle-desc">{{ c.description }}</span>
            </button>
          </div>

          <!-- Period & Batch -->
          <div class="section-label">
            <mat-icon class="section-icon">calendar_month</mat-icon>
            <span>Period &amp; Scope</span>
          </div>
          <div class="form-grid">
            <mat-form-field appearance="outline" class="field-month">
              <mat-label>Starting Month *</mat-label>
              <mat-select formControlName="month" (selectionChange)="onMonthYearChange()">
                <mat-option *ngFor="let m of months" [value]="m.value">{{ m.name }}</mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">calendar_month</mat-icon>
              <mat-error *ngIf="form.get('month')?.hasError('required')">Month is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="field-year">
              <mat-label>Year *</mat-label>
              <mat-select formControlName="year" (selectionChange)="onMonthYearChange()">
                <mat-option *ngFor="let y of years" [value]="y">{{ y }}</mat-option>
              </mat-select>
              <mat-error *ngIf="form.get('year')?.hasError('required')">Year is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Target School Class</mat-label>
              <mat-select formControlName="classId" panelClass="smart-batch-panel">
                <mat-option value="">✨ All School Classes (Or Coaching Only)</mat-option>
                <mat-option *ngFor="let c of data.classes" [value]="c.id">
                  🏫 {{ c.name }}
                </mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">school</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Target Coaching Batch</mat-label>
              <mat-select formControlName="batchId" panelClass="smart-batch-panel">
                <mat-option value="">✨ All Coaching Batches (Or School Only)</mat-option>
                <mat-option *ngFor="let b of data.batches" [value]="b.id">
                  🎯 {{ b.name }} (₹{{ b.standardMonthlyFee | number:'1.0-0' }}/mo)
                </mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">groups</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Payment Due Date *</mat-label>
              <input matInput type="date" formControlName="dueDate" />
              <mat-icon matSuffix color="primary">event</mat-icon>
              <mat-hint>Parents will see this date on invoices and WhatsApp notifications</mat-hint>
              <mat-error *ngIf="form.get('dueDate')?.hasError('required')">Due Date is required</mat-error>
            </mat-form-field>
          </div>

          <!-- Live Preview -->
          <div class="preview-box">
            <div class="preview-header">
              <mat-icon class="preview-header-icon">receipt_long</mat-icon>
              <span>Invoice Preview</span>
            </div>
            <div class="preview-body">
              <div class="preview-item">
                <span class="preview-label">Billing Cycle:</span>
                <span
                  class="cycle-badge"
                  [style.background]="getSelectedCycleOption()?.bgColor"
                  [style.color]="getSelectedCycleOption()?.color"
                  [style.border-color]="getSelectedCycleOption()?.borderColor"
                >{{ getSelectedCycleOption()?.label }}</span>
              </div>
              <div class="preview-item">
                <span class="preview-label">Period Covered:</span>
                <strong class="preview-val">{{ getPeriodLabel() }}</strong>
              </div>
              <div class="preview-item">
                <span class="preview-label">Target Audience:</span>
                <span class="preview-val highlight">{{ getSelectedScopeLabel() }}</span>
              </div>
              <div class="preview-item" *ngIf="getSelectedBatch()">
                <span class="preview-label">Amount / Student:</span>
                <strong class="preview-val amount">₹{{ getInvoiceAmount() | number:'1.0-0' }}</strong>
              </div>
              <div class="preview-item">
                <span class="preview-label">Initial Status:</span>
                <span class="status-pill pending">Pending (FIFO Payable)</span>
              </div>
            </div>
          </div>

        </mat-dialog-content>

        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onCancel()" [disabled]="saving">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving" class="submit-btn">
            <mat-spinner diameter="18" *ngIf="saving" class="btn-spinner"></mat-spinner>
            <mat-icon *ngIf="!saving">rocket_launch</mat-icon>
            <span>{{ saving ? 'Generating...' : (data.targetStudentName ? 'Generate Invoice for ' + data.targetStudentName : 'Generate Invoices') }}</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      padding: 0;
      box-sizing: border-box;
      min-width: 500px;
      max-width: 580px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px 24px 16px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;

      .header-icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }

      .header-titles {
        flex: 1 1 auto;
        .main-title {
          margin: 0;
          font-size: 1.18rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.3;
        }
        .subtitle {
          margin: 3px 0 0;
          font-size: 0.79rem;
          color: #3b82f6;
        }
      }

      .close-btn { color: #64748b; }
    }

    .dialog-content {
      padding: 16px 24px;
      max-height: 75vh;
      overflow-y: auto;
    }

    .target-student-card {
      background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
      border: 1.5px solid #93c5fd;
      border-radius: 10px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;

      .card-icon-pill {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: #3b82f6;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }

      .card-content {
        display: flex;
        flex-direction: column;
        gap: 3px;

        .st-main {
          display: flex;
          align-items: center;
          gap: 8px;

          .st-role-badge {
            font-size: 0.65rem;
            font-weight: 700;
            background: #dbeafe;
            color: #1d4ed8;
            padding: 1px 6px;
            border-radius: 4px;
            letter-spacing: 0.5px;
          }

          .st-name {
            font-size: 0.95rem;
            font-weight: 700;
            color: #0f172a;
          }

          .st-roll {
            font-size: 0.8rem;
            color: #64748b;
          }
        }

        .st-sub-details {
          display: flex;
          align-items: center;
          gap: 6px;

          .sub-pill {
            font-size: 0.75rem;
            padding: 1px 8px;
            border-radius: 4px;
            font-weight: 500;

            &.school {
              background: #e0f2fe;
              color: #0369a1;
              border: 1px solid #bae6fd;
            }

            &.batch {
              background: #ede9fe;
              color: #6d28d9;
              border: 1px solid #ddd6fe;
            }
          }
        }
      }
    }

    .info-callout {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 13px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;

      .info-icon { color: #16a34a; font-size: 18px; width: 18px; height: 18px; margin-top: 1px; flex-shrink: 0; }
      .info-text { font-size: 0.79rem; color: #166534; line-height: 1.45; strong { font-weight: 700; } }
    }

    .section-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      margin-bottom: -4px;

      .section-icon { font-size: 15px; width: 15px; height: 15px; color: #94a3b8; }
    }

    .cycle-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 9px;
    }

    .cycle-tile {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 10px 5px 8px;
      border: 2px solid #e2e8f0;
      border-radius: 10px;
      background: #f8fafc;
      cursor: pointer;
      transition: all 0.18s ease;
      outline: none;
      user-select: none;

      .cycle-icon { font-size: 22px; width: 22px; height: 22px; color: #94a3b8; transition: color 0.18s; }
      .cycle-label { font-size: 0.74rem; font-weight: 700; color: #64748b; transition: color 0.18s; }
      .cycle-desc  { font-size: 0.65rem; color: #94a3b8; text-align: center; line-height: 1.3; }

      &:hover:not(.selected) {
        border-color: var(--cycle-border, #93c5fd);
        background: var(--cycle-bg, #eff6ff);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        .cycle-icon, .cycle-label { color: var(--cycle-color, #2563eb); }
      }

      &.selected {
        border-color: var(--cycle-border, #3b82f6);
        background: var(--cycle-bg, #eff6ff);
        transform: translateY(-1px);
        box-shadow: 0 0 0 3px rgba(147,197,253,0.35);
        .cycle-icon { color: var(--cycle-color, #2563eb); }
        .cycle-label { color: var(--cycle-color, #2563eb); font-weight: 800; }
        .cycle-desc  { color: var(--cycle-color, #2563eb); opacity: 0.75; }
      }
    }

    .form-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      .field-month { flex: 1 1 210px; }
      .field-year  { flex: 0 0 105px; }
      .full-width  { width: 100%; flex: 1 1 100%; }
    }

    .preview-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;

      .preview-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: #f1f5f9;
        border-bottom: 1px solid #e2e8f0;
        font-size: 0.73rem;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        .preview-header-icon { font-size: 14px; width: 14px; height: 14px; color: #94a3b8; }
      }

      .preview-body {
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .preview-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.82rem;
        .preview-label { color: #64748b; }
        .preview-val {
          color: #0f172a;
          font-weight: 600;
          &.highlight { color: #2563eb; }
          &.amount { color: #059669; font-size: 0.95rem; }
        }
      }

      .cycle-badge {
        display: inline-block;
        padding: 2px 9px;
        border-radius: 20px;
        border: 1px solid transparent;
        font-size: 0.72rem;
        font-weight: 700;
      }

      .status-pill {
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 0.71rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        &.pending { background: #fef3c7; color: #b45309; }
      }
    }

    .dialog-actions {
      padding: 13px 24px 20px;
      border-top: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      gap: 10px;

      .submit-btn {
        height: 42px;
        font-weight: 600;
        padding: 0 20px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .btn-spinner { margin-right: 4px; }
    }

    @media (max-width: 600px) {
      .dialog-wrapper { min-width: 100% !important; }
      .cycle-grid { grid-template-columns: repeat(2, 1fr); }
      .form-grid {
        flex-direction: column;
        .field-month, .field-year, .full-width { width: 100% !important; flex: 1 1 100% !important; }
      }
    }
  `]
})
export class GenerateInvoicesDialogComponent implements OnInit {
  form: FormGroup;
  saving = false;
  selectedCycle = 1;

  billingCycles: BillingCycleOption[] = [
    { value: 1,  label: 'Monthly',     icon: 'calendar_view_month', description: '1 month',   color: '#2563eb', bgColor: '#eff6ff', borderColor: '#93c5fd' },
    { value: 3,  label: 'Quarterly',   icon: 'view_week',           description: '3 months',  color: '#7c3aed', bgColor: '#f5f3ff', borderColor: '#c4b5fd' },
    { value: 6,  label: 'Half-Yearly', icon: 'date_range',          description: '6 months',  color: '#d97706', bgColor: '#fffbeb', borderColor: '#fcd34d' },
    { value: 12, label: 'Yearly',      icon: 'event_available',     description: '12 months', color: '#059669', bgColor: '#f0fdf4', borderColor: '#6ee7b7' }
  ];

  months = [
    { value: 1, name: 'January' }, { value: 2, name: 'February' }, { value: 3, name: 'March' },
    { value: 4, name: 'April' },   { value: 5, name: 'May' },      { value: 6, name: 'June' },
    { value: 7, name: 'July' },    { value: 8, name: 'August' },   { value: 9, name: 'September' },
    { value: 10, name: 'October' },{ value: 11, name: 'November' },{ value: 12, name: 'December' }
  ];

  years: number[] = [];

  constructor(
    private fb: FormBuilder,
    private feesService: FeesService,
    private confirmDialog: ConfirmDialogService,
    private dialogRef: MatDialogRef<GenerateInvoicesDialogComponent, GenerateInvoicesResult | null>,
    @Inject(MAT_DIALOG_DATA) public data: GenerateInvoicesDialogData
  ) {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const defaultMonth = data?.defaultMonth ?? (currentMonth === 12 ? 1 : currentMonth + 1);
    const defaultYear  = data?.defaultYear ?? (currentMonth === 12 ? today.getFullYear() + 1 : today.getFullYear());
    this.years = [defaultYear - 1, defaultYear, defaultYear + 1];
    const defaultDueDate = `${defaultYear}-${String(defaultMonth).padStart(2, '0')}-10`;
    this.form = this.fb.group({
      month:   [defaultMonth,              [Validators.required]],
      year:    [defaultYear,               [Validators.required]],
      classId: [data?.defaultClassId || ''],
      batchId: [data?.defaultBatchId || ''],
      dueDate: [defaultDueDate,            [Validators.required]]
    });
  }

  getSelectedTargetClassName(): string {
    const classId = this.form?.get('classId')?.value || this.data?.defaultClassId;
    return this.data?.classes?.find(c => c.id === classId)?.name || '';
  }

  getSelectedTargetBatchName(): string {
    const batchId = this.form?.get('batchId')?.value || this.data?.defaultBatchId;
    return this.data?.batches?.find(b => b.id === batchId)?.name || '';
  }

  ngOnInit(): void {}

  selectCycle(value: number): void { this.selectedCycle = value; }

  onMonthYearChange(): void {
    const month = this.form.get('month')?.value;
    const year  = this.form.get('year')?.value;
    if (month && year) {
      this.form.get('dueDate')?.setValue(`${year}-${String(month).padStart(2, '0')}-10`);
    }
  }

  getSelectedCycleOption(): BillingCycleOption | undefined {
    return this.billingCycles.find(c => c.value === this.selectedCycle);
  }

  getPeriodLabel(): string {
    const month = this.form.get('month')?.value;
    const year  = this.form.get('year')?.value;
    if (!month || !year) return '';
    const start = new Date(year, month - 1, 1);
    if (this.selectedCycle === 1) {
      return start.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    }
    const endDate = new Date(year, month - 1 + this.selectedCycle, 0);
    const s = start.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    const e = endDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
  }

  getSelectedScopeLabel(): string {
    const classId = this.form.get('classId')?.value;
    const batchId = this.form.get('batchId')?.value;
    const c = classId ? this.data.classes?.find(x => x.id === classId) : null;
    const b = batchId ? this.data.batches?.find(x => x.id === batchId) : null;
    if (c && b) return `🏫 ${c.name} + 🎯 ${b.name}`;
    if (c) return `🏫 ${c.name} (School)`;
    if (b) return `🎯 ${b.name} (Coaching)`;
    return '✨ All Students (Universal)';
  }

  getSelectedBatch(): BatchDto | undefined {
    const batchId = this.form.get('batchId')?.value;
    if (!batchId) return undefined;
    return this.data.batches.find(x => x.id === batchId);
  }

  getInvoiceAmount(): number {
    const batch = this.getSelectedBatch();
    return batch ? batch.standardMonthlyFee * this.selectedCycle : 0;
  }

  onCancel(): void { this.dialogRef.close(null); }

  onSubmit(): void {
    if (this.form.invalid || this.saving) return;
    this.saving = true;
    const val = this.form.value;
    this.feesService.generateMonthlyInvoices({
      year:         Number(val.year),
      month:        Number(val.month),
      classId:      val.classId ? val.classId : null,
      batchId:      val.batchId ? val.batchId : null,
      studentId:    this.data?.targetStudentId || null,
      dueDate:      val.dueDate,
      billingCycle: this.selectedCycle
    }).subscribe({
      next: res => { this.saving = false; this.dialogRef.close(res); },
      error: err => {
        this.saving = false;
        console.error('Failed to generate invoices', err);
        this.confirmDialog.alert('Generation Failed', err.error?.message || err.message || 'Failed to generate invoices', 'danger');
      }
    });
  }
}

