import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { InventoryItem, CreateStockAdjustmentDto } from '../inventory.models';

export interface InventoryAdjustDialogData {
  item: InventoryItem;
}

@Component({
  selector: 'app-inventory-adjust-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dialog-container">
      <!-- Strict ERP Light-Blue Gradient Header -->
      <div class="dialog-header">
        <div class="dialog-header-left">
          <div class="header-icon-box">
            <mat-icon>tune</mat-icon>
          </div>
          <div class="header-title-wrap">
            <h2>Adjust Physical Stock</h2>
            <p>{{ data.item.itemName }} ({{ data.item.itemCode }})</p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="onCancel()" type="button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-body">
          <!-- Current Stock Banner -->
          <div class="stock-banner">
            <div class="banner-item">
              <span class="label">Current Recorded Stock:</span>
              <strong class="val">{{ data.item.currentStock }} {{ data.item.unitOfMeasurement }}</strong>
            </div>
            <div class="banner-item">
              <span class="label">Reorder Level:</span>
              <span class="val-sub">{{ data.item.minStockAlertLevel }} {{ data.item.unitOfMeasurement }}</span>
            </div>
            <div class="banner-item" *ngIf="data.item.rackOrLocation">
              <span class="label">Location:</span>
              <span class="val-sub">{{ data.item.rackOrLocation }}</span>
            </div>
          </div>

          <div class="form-grid">
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Adjustment Reason / Type</mat-label>
              <mat-select formControlName="adjustmentType">
                <mat-option value="PhysicalAuditCorrection">Physical Audit / Count Correction</mat-option>
                <mat-option value="DamagedLoss">Damaged / Broken / Expired Stock</mat-option>
                <mat-option value="FoundExcess">Found Extra / Excess Stock</mat-option>
                <mat-option value="ReturnToVendor">Defective Returned to Vendor</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Adjust Quantity (+ or -)</mat-label>
              <input matInput type="number" formControlName="adjustedQuantity" (input)="computeNewStock()" />
              <mat-hint>e.g. +5 to increase, -3 to write off</mat-hint>
              <mat-error *ngIf="form.get('adjustedQuantity')?.hasError('required')">
                Adjustment quantity is required
              </mat-error>
            </mat-form-field>

            <!-- New Stock Preview -->
            <div class="new-stock-preview">
              <span class="preview-label">New Resulting Stock:</span>
              <strong [ngClass]="newStock >= 0 ? 'text-success' : 'text-danger'">
                {{ newStock }} {{ data.item.unitOfMeasurement }}
              </strong>
            </div>

            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Audit Remarks / Reason Details</mat-label>
              <textarea matInput formControlName="reason" rows="2" placeholder="e.g. Monthly stock take verified by store incharge"></textarea>
              <mat-error *ngIf="form.get('reason')?.hasError('required')">
                Please provide an audit reason
              </mat-error>
            </mat-form-field>
          </div>
        </mat-dialog-content>

        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onCancel()" [disabled]="submitting">
            Cancel
          </button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting || newStock < 0">
            <mat-spinner diameter="18" *ngIf="submitting" class="spinner-btn"></mat-spinner>
            <span>Confirm Adjustment</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
  styles: [`
    .dialog-container { display: flex; flex-direction: column; max-height: 90vh; }
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
    .dialog-header-left { display: flex; align-items: center; gap: 12px; }
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
    .header-title-wrap p { color: #3b82f6; margin: 2px 0 0; font-size: 0.82rem; }
    .close-btn { color: #64748b; &:hover { color: #1e293b; } }
    .dialog-body { padding: 18px 20px; }
    .stock-banner {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 24px;
      margin-bottom: 16px;
      .banner-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
        .label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 600; }
        .val { font-size: 1.1rem; color: #1e3a8a; font-weight: 700; }
        .val-sub { font-size: 0.9rem; color: #334155; }
      }
    }
    .form-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; align-items: center; }
    .col-span-2 { grid-column: span 2; }
    .new-stock-preview {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-top: 4px;
      margin-bottom: 8px;
      .preview-label { font-size: 0.75rem; color: #64748b; }
      strong { font-size: 1.15rem; }
      .text-success { color: #16a34a; }
      .text-danger { color: #dc2626; }
    }
    .dialog-actions { padding: 12px 20px 16px; border-top: 1px solid #f1f5f9; gap: 8px; }
  `]
})
export class InventoryAdjustDialogComponent implements OnInit {
  form!: FormGroup;
  submitting = false;
  newStock = 0;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<InventoryAdjustDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: InventoryAdjustDialogData
  ) {}

  ngOnInit(): void {
    this.newStock = this.data.item.currentStock;
    this.form = this.fb.group({
      adjustmentType: ['PhysicalAuditCorrection', [Validators.required]],
      adjustedQuantity: [0, [Validators.required]],
      reason: ['', [Validators.required, Validators.maxLength(500)]]
    });
  }

  computeNewStock(): void {
    const adj = Number(this.form.get('adjustedQuantity')?.value) || 0;
    this.newStock = this.data.item.currentStock + adj;
  }

  onSubmit(): void {
    if (this.form.invalid || this.newStock < 0) return;

    const val = this.form.value;
    const result: CreateStockAdjustmentDto = {
      itemId: this.data.item.id,
      adjustmentType: val.adjustmentType,
      adjustedQuantity: Number(val.adjustedQuantity) || 0,
      reason: val.reason.trim()
    };

    this.dialogRef.close(result);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
