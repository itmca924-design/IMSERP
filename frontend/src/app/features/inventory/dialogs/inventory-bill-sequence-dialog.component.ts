import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { InventoryBillSequenceDto, UpdateInventoryBillSequenceDto } from '../inventory.models';
import { InventoryService } from '../inventory.service';

export interface InventoryBillSequenceDialogData {
  sequence: InventoryBillSequenceDto;
  branchId?: string;
}

@Component({
  selector: 'app-inventory-bill-sequence-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule
],
  template: `
    <div class="dialog-container">
      <!-- Strict ERP Light-Blue Gradient Header -->
      <div class="dialog-header">
        <div class="dialog-header-left">
          <div class="header-icon-box">
            <mat-icon>tag</mat-icon>
          </div>
          <div class="header-title-wrap">
            <h2>Vendor Invoice &amp; Bill Number Sequencer</h2>
            <p>Configure prefix, digit padding, starting counter, and dynamic financial year format</p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="onCancel()" type="button">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-body">
          <!-- Live Preview Banner -->
          <div class="preview-banner">
            <div class="preview-info">
              <span class="preview-lbl">LIVE PREVIEW OF NEXT GENERATED BILL #</span>
              <span class="preview-code">{{ livePreview }}</span>
            </div>
            <mat-icon class="preview-icon">auto_awesome</mat-icon>
          </div>
    
          <div class="form-grid">
            <!-- Prefix -->
            <mat-form-field appearance="outline">
              <mat-label>Bill Prefix</mat-label>
              <input matInput formControlName="prefix" placeholder="e.g. BILL-, INV-, PUR-" />
              <mat-hint>Letters or code preceding number</mat-hint>
            </mat-form-field>
    
            <!-- Next Counter -->
            <mat-form-field appearance="outline">
              <mat-label>Next Sequence Number</mat-label>
              <input matInput type="number" min="1" formControlName="nextNumber" />
              <mat-hint>Counter starts from this integer</mat-hint>
            </mat-form-field>
    
            <!-- Padding Digits -->
            <mat-form-field appearance="outline">
              <mat-label>Digit Padding</mat-label>
              <mat-select formControlName="paddingDigits">
                <mat-option [value]="3">3 Digits (e.g. 001)</mat-option>
                <mat-option [value]="4">4 Digits (e.g. 0001)</mat-option>
                <mat-option [value]="5">5 Digits (e.g. 00001)</mat-option>
                <mat-option [value]="6">6 Digits (e.g. 000001)</mat-option>
              </mat-select>
              <mat-hint>Leading zeros formatting</mat-hint>
            </mat-form-field>
    
            <!-- Include Financial Year Toggle -->
            <div class="toggle-card">
              <mat-slide-toggle formControlName="includeFinancialYear" color="primary">
                <span class="toggle-title">Include Financial Year (FY)</span>
              </mat-slide-toggle>
              <span class="toggle-sub">Auto-injects dynamic session code (e.g. {{ currentFyCode }} for current session)</span>
            </div>
          </div>
        </mat-dialog-content>
    
        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onCancel()" [disabled]="saving">
            Cancel
          </button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving">
            @if (saving) {
              <mat-spinner diameter="18" class="spinner-btn"></mat-spinner>
            }
            <span>Save Sequence Settings</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      width: 100%;
    }
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
    }
    .dialog-header-left {
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
    }
    .header-title-wrap h2 {
      color: #1e3a8a;
      font-weight: 700;
      margin: 0;
      font-size: 1.15rem;
    }
    .header-title-wrap p {
      color: #3b82f6;
      margin: 2px 0 0;
      font-size: 0.82rem;
    }
    .close-btn { color: #64748b; }
    .close-btn:hover { color: #1e293b; }

    .dialog-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .preview-banner {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1px solid #86efac;
      border-radius: 10px;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .preview-info {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .preview-lbl {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #166534;
    }
    .preview-code {
      font-size: 20px;
      font-weight: 800;
      font-family: monospace, monospace;
      color: #14532d;
    }
    .preview-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #16a34a;
      opacity: 0.8;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 600px) {
      .form-grid { grid-template-columns: 1fr; }
    }

    .toggle-card {
      display: flex;
      flex-direction: column;
      justify-content: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      gap: 4px;
    }
    .toggle-title {
      font-weight: 600;
      font-size: 13px;
      color: #1e293b;
    }
    .toggle-sub {
      font-size: 11px;
      color: #64748b;
    }

    .dialog-actions {
      padding: 12px 20px 16px;
      border-top: 1px solid #f1f5f9;
      gap: 8px;
    }
    .spinner-btn { display: inline-block; margin-right: 6px; }
  `]
})
export class InventoryBillSequenceDialogComponent implements OnInit {
  form!: FormGroup;
  saving = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<InventoryBillSequenceDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: InventoryBillSequenceDialogData,
    private readonly inventoryService: InventoryService
  ) {}

  ngOnInit(): void {
    const s = this.data.sequence;
    this.form = this.fb.group({
      prefix: [s.prefix || 'BILL-', [Validators.required]],
      nextNumber: [s.nextNumber || 1, [Validators.required, Validators.min(1)]],
      paddingDigits: [s.paddingDigits || 4, [Validators.required]],
      includeFinancialYear: [s.includeFinancialYear !== false]
    });
  }

  get currentFyCode(): string {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const startYear = month >= 4 ? year : year - 1;
    const endYear = startYear + 1;
    return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
  }

  get livePreview(): string {
    const val = this.form?.value;
    if (!val) return 'BILL-0001';
    const prefix = val.prefix?.trim() || 'BILL-';
    const num = val.nextNumber || 1;
    const pad = val.paddingDigits || 4;
    const numStr = String(num).padStart(pad, '0');
    if (val.includeFinancialYear) {
      return `${prefix}${this.currentFyCode}-${numStr}`;
    }
    return `${prefix}${numStr}`;
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving) return;

    this.saving = true;
    const dto: UpdateInventoryBillSequenceDto = {
      prefix: this.form.value.prefix?.trim() || 'BILL-',
      nextNumber: Number(this.form.value.nextNumber) || 1,
      paddingDigits: Number(this.form.value.paddingDigits) || 4,
      includeFinancialYear: !!this.form.value.includeFinancialYear,
      branchId: this.data.branchId
    };

    this.inventoryService.updateBillSequence(dto).subscribe({
      next: (res) => {
        this.saving = false;
        this.dialogRef.close(res);
      },
      error: () => {
        this.saving = false;
        // Close with local fallback if offline
        this.dialogRef.close({
          id: this.data.sequence.id,
          prefix: dto.prefix,
          nextNumber: dto.nextNumber,
          paddingDigits: dto.paddingDigits,
          includeFinancialYear: dto.includeFinancialYear,
          nextBillNumberPreview: this.livePreview
        });
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
