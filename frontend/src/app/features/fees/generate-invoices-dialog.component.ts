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

export interface GenerateInvoicesDialogData {
  batches: BatchDto[];
  defaultBatchId?: string;
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
          <h2 mat-dialog-title class="main-title">Generate Monthly Fee Invoices</h2>
          <p class="subtitle">Bulk-bill tuition fees for enrolled students for the upcoming cycle.</p>
        </div>
        <button mat-icon-button type="button" class="close-btn" (click)="onCancel()" [disabled]="saving">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-content">

          <!-- Information Callout -->
          <div class="info-callout">
            <mat-icon class="info-icon">info</mat-icon>
            <div class="info-text">
              <strong>Smart Auto-Billing Engine:</strong> Invoices are generated using each student's assigned batch fee rate. Any student who already has an invoice for the selected month is <strong>automatically skipped</strong> to avoid duplicate billing.
            </div>
          </div>

          <div class="form-grid">
            <!-- Billing Month -->
            <mat-form-field appearance="outline" class="field-month">
              <mat-label>Billing Month *</mat-label>
              <mat-select formControlName="month" (selectionChange)="onMonthYearChange()">
                <mat-option *ngFor="let m of months" [value]="m.value">
                  {{ m.name }}
                </mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">calendar_month</mat-icon>
              <mat-error *ngIf="form.get('month')?.hasError('required')">Month is required</mat-error>
            </mat-form-field>

            <!-- Billing Year -->
            <mat-form-field appearance="outline" class="field-year">
              <mat-label>Year *</mat-label>
              <mat-select formControlName="year" (selectionChange)="onMonthYearChange()">
                <mat-option *ngFor="let y of years" [value]="y">
                  {{ y }}
                </mat-option>
              </mat-select>
              <mat-error *ngIf="form.get('year')?.hasError('required')">Year is required</mat-error>
            </mat-form-field>

            <!-- Target Batch -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Target Academic Batch *</mat-label>
              <mat-select formControlName="batchId" panelClass="smart-batch-panel">
                <mat-option value="">✨ All Active Academic Batches (All Students)</mat-option>
                <mat-option *ngFor="let b of data.batches" [value]="b.id">
                  {{ b.name }} (Fee: ₹{{ b.standardMonthlyFee | number:'1.2-2' }}/mo)
                </mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">groups</mat-icon>
            </mat-form-field>

            <!-- Due Date -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Payment Due Date *</mat-label>
              <input matInput type="date" formControlName="dueDate" />
              <mat-icon matSuffix color="primary">event</mat-icon>
              <mat-hint>Parents will see this due date on invoices and WhatsApp notifications</mat-hint>
              <mat-error *ngIf="form.get('dueDate')?.hasError('required')">Due Date is required</mat-error>
            </mat-form-field>
          </div>

          <!-- Live Preview Summary Card -->
          <div class="preview-box">
            <div class="preview-item">
              <span class="preview-label">Billing Cycle:</span>
              <strong class="preview-val">{{ getSelectedMonthName() }} {{ form.get('year')?.value }}</strong>
            </div>
            <div class="preview-item">
              <span class="preview-label">Target Audience:</span>
              <span class="preview-val highlight">{{ getSelectedBatchName() }}</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">Initial Invoice Status:</span>
              <span class="status-pill pending">Pending (FIFO Payable)</span>
            </div>
          </div>

        </mat-dialog-content>

        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onCancel()" [disabled]="saving">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving" class="submit-btn">
            <mat-spinner diameter="20" *ngIf="saving" class="btn-spinner"></mat-spinner>
            <mat-icon *ngIf="!saving">rocket_launch</mat-icon>
            <span>{{ saving ? 'Generating...' : 'Generate Invoices' }}</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      padding: 0;
      box-sizing: border-box;
      min-width: 460px;
      max-width: 540px;
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
        box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }

      .header-titles {
        flex: 1 1 auto;
        .main-title {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.3;
        }
        .subtitle {
          margin: 4px 0 0;
          font-size: 0.82rem;
          color: #3b82f6;
        }
      }

      .close-btn {
        color: #64748b;
      }
    }

    .dialog-content {
      padding: 20px 24px 10px !important;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .info-callout {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;

      .info-icon {
        color: #16a34a;
        font-size: 20px;
        width: 20px;
        height: 20px;
        margin-top: 1px;
        flex-shrink: 0;
      }
      .info-text {
        font-size: 0.82rem;
        color: #166534;
        line-height: 1.45;
        strong { font-weight: 700; }
      }
    }

    .form-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;

      .field-month {
        flex: 1 1 240px;
      }
      .field-year {
        flex: 0 0 120px;
      }
      .full-width {
        width: 100%;
        flex: 1 1 100%;
      }
    }

    .preview-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .preview-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.84rem;

        .preview-label { color: #64748b; }
        .preview-val {
          color: #0f172a;
          font-weight: 600;
          &.highlight { color: #2563eb; }
        }
      }

      .status-pill {
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.02em;

        &.pending {
          background: #fef3c7;
          color: #b45309;
        }
      }
    }

    .dialog-actions {
      padding: 16px 24px 20px;
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

      .btn-spinner {
        margin-right: 4px;
      }
    }

    @media (max-width: 600px) {
      .dialog-wrapper {
        min-width: 100% !important;
      }
      .form-grid {
        flex-direction: column;
        .field-month, .field-year, .full-width {
          width: 100% !important;
          flex: 1 1 100% !important;
        }
      }
    }
  `]
})
export class GenerateInvoicesDialogComponent implements OnInit {
  form: FormGroup;
  saving = false;

  months = [
    { value: 1, name: 'January' },
    { value: 2, name: 'February' },
    { value: 3, name: 'March' },
    { value: 4, name: 'April' },
    { value: 5, name: 'May' },
    { value: 6, name: 'June' },
    { value: 7, name: 'July' },
    { value: 8, name: 'August' },
    { value: 9, name: 'September' },
    { value: 10, name: 'October' },
    { value: 11, name: 'November' },
    { value: 12, name: 'December' }
  ];

  years: number[] = [];

  constructor(
    private fb: FormBuilder,
    private feesService: FeesService,
    private dialogRef: MatDialogRef<GenerateInvoicesDialogComponent, GenerateInvoicesResult | null>,
    @Inject(MAT_DIALOG_DATA) public data: GenerateInvoicesDialogData
  ) {
    const today = new Date();
    // Default to next month (or October 2026 if current year is 2026 and month is Sept)
    const currentMonth = today.getMonth() + 1;
    const defaultMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const defaultYear = currentMonth === 12 ? today.getFullYear() + 1 : today.getFullYear();

    this.years = [defaultYear - 1, defaultYear, defaultYear + 1];

    const defaultDueDate = `${defaultYear}-${String(defaultMonth).padStart(2, '0')}-10`;

    this.form = this.fb.group({
      month: [defaultMonth, [Validators.required]],
      year: [defaultYear, [Validators.required]],
      batchId: [data?.defaultBatchId || ''],
      dueDate: [defaultDueDate, [Validators.required]]
    });
  }

  ngOnInit(): void {}

  onMonthYearChange(): void {
    const month = this.form.get('month')?.value;
    const year = this.form.get('year')?.value;
    if (month && year) {
      const formattedDate = `${year}-${String(month).padStart(2, '0')}-10`;
      this.form.get('dueDate')?.setValue(formattedDate);
    }
  }

  getSelectedMonthName(): string {
    const monthVal = this.form.get('month')?.value;
    const m = this.months.find(x => x.value === monthVal);
    return m ? m.name : '';
  }

  getSelectedBatchName(): string {
    const batchId = this.form.get('batchId')?.value;
    if (!batchId) return 'All Active Batches (All Enrolled Students)';
    const b = this.data.batches.find(x => x.id === batchId);
    return b ? b.name : 'Selected Batch';
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving) return;

    this.saving = true;
    const val = this.form.value;

    const payload = {
      year: Number(val.year),
      month: Number(val.month),
      batchId: val.batchId ? val.batchId : null,
      dueDate: val.dueDate
    };

    this.feesService.generateMonthlyInvoices(payload).subscribe({
      next: res => {
        this.saving = false;
        this.dialogRef.close(res);
      },
      error: err => {
        this.saving = false;
        console.error('Failed to generate monthly invoices', err);
        alert(err.error?.message || err.message || 'Failed to generate monthly invoices');
      }
    });
  }
}
