import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FeeRecoveryPlanItemDto } from '../../../core/services/fee-recovery-agent.service';

export interface RecordPromiseDialogData {
  plan: FeeRecoveryPlanItemDto;
}

@Component({
  selector: 'app-record-promise-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  template: `
    <div class="dialog-container">
      <!-- Strict light-blue gradient header matching AGENTS.md rule -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>event_available</mat-icon>
          </div>
          <div>
            <h2 class="main-title">Record Promise to Pay (PTP)</h2>
            <p class="subtitle">
              Parent payment commitment for <strong>{{ data.plan.studentName }}</strong> (Due: ₹{{ data.plan.totalOverdueAmount | number:'1.0-0' }})
            </p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="dialog-form">
        <mat-dialog-content class="dialog-content">
          <div class="form-grid">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Promised Amount (₹)</mat-label>
              <input matInput type="number" formControlName="promisedAmount" min="1" [max]="data.plan.totalOverdueAmount" placeholder="Enter amount" />
              <mat-icon matPrefix>currency_rupee</mat-icon>
              <mat-error *ngIf="form.get('promisedAmount')?.hasError('required')">Amount is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Promised Date</mat-label>
              <input matInput [matDatepicker]="picker" formControlName="promisedDate" [min]="minDate" placeholder="Choose date" />
              <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
              <mat-error *ngIf="form.get('promisedDate')?.hasError('required')">Promised date is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Contact Person (Parent / Guardian)</mat-label>
              <input matInput formControlName="contactPerson" placeholder="e.g. Father (Rajesh Kumar)" />
              <mat-icon matPrefix>person</mat-icon>
              <mat-error *ngIf="form.get('contactPerson')?.hasError('required')">Contact person is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Contact Phone Number</mat-label>
              <input matInput formControlName="contactPhone" placeholder="e.g. 9876543210" />
              <mat-icon matPrefix>phone</mat-icon>
              <mat-error *ngIf="form.get('contactPhone')?.hasError('required')">Phone number is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width remarks-field">
              <mat-label>Conversation Notes / Parent Remarks</mat-label>
              <textarea matInput formControlName="notes" rows="3" placeholder="e.g. Spoke to father, promised payment upon salary disbursement on 5th Nov."></textarea>
              <mat-icon matPrefix>comment</mat-icon>
            </mat-form-field>
          </div>
        </mat-dialog-content>

        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close()" class="cancel-btn">
            Cancel
          </button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid" class="save-btn">
            <mat-icon>check_circle</mat-icon>
            <span>Save Commitment</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      background: #ffffff;
      border-radius: 14px;
      overflow: hidden;
    }

    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .header-icon-box {
        background: #2563eb;
        color: #ffffff;
        border-radius: 10px;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        mat-icon {
          font-size: 22px;
          width: 22px;
          height: 22px;
        }
      }

      .main-title {
        color: #1e3a8a;
        font-weight: 700;
        font-size: 1.15rem;
        margin: 0 0 2px 0;
      }

      .subtitle {
        color: #3b82f6;
        font-size: 0.8rem;
        margin: 0;

        strong {
          color: #1e40af;
        }
      }

      .close-btn {
        color: #64748b;
        &:hover { color: #1e293b; }
      }
    }

    .dialog-form {
      display: flex;
      flex-direction: column;
    }

    .dialog-content {
      padding: 18px 20px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;

      .full-width {
        width: 100%;
      }

      .remarks-field {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 600px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
    }

    .dialog-actions {
      padding: 12px 20px 16px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      gap: 10px;

      button {
        border-radius: 8px;
        font-weight: 600;
        height: 38px;
      }

      .save-btn {
        background: #2563eb;
        color: #ffffff;
      }
    }
  `]
})
export class RecordPromiseDialogComponent implements OnInit {
  form!: FormGroup;
  minDate = new Date();

  constructor(
    public dialogRef: MatDialogRef<RecordPromiseDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RecordPromiseDialogData,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    const defaultPromiseDate = new Date();
    defaultPromiseDate.setDate(defaultPromiseDate.getDate() + 7);

    this.form = this.fb.group({
      promisedAmount: [this.data.plan.totalOverdueAmount, [Validators.required, Validators.min(1)]],
      promisedDate: [defaultPromiseDate, Validators.required],
      contactPerson: [this.data.plan.parentName || 'Parent / Guardian', Validators.required],
      contactPhone: [this.data.plan.parentPhone || '', Validators.required],
      notes: ['']
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value);
  }
}

