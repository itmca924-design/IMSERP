import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { InventoryVendor, CreateUpdateVendorDto } from '../inventory.models';

export interface InventoryVendorDialogData {
  isEdit: boolean;
  vendor?: InventoryVendor;
  branchId?: string;
}

@Component({
  selector: 'app-inventory-vendor-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule
],
  template: `
    <div class="dialog-container">
      <!-- Strict ERP Light-Blue Gradient Header -->
      <div class="dialog-header">
        <div class="dialog-header-left">
          <div class="header-icon-box">
            <mat-icon>{{ data.isEdit ? 'storefront' : 'add_business' }}</mat-icon>
          </div>
          <div class="header-title-wrap">
            <h2>{{ data.isEdit ? 'Edit Vendor / Supplier' : 'Add New Vendor / Supplier' }}</h2>
            <p>{{ data.isEdit ? 'Update vendor profile, GSTIN, and payment terms' : 'Register a new vendor for purchasing stationery, uniforms, books or lab assets' }}</p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="onCancel()" type="button">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-body">
          <div class="form-grid">
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Vendor / Business Name</mat-label>
              <input matInput formControlName="vendorName" placeholder="e.g. Apex Stationers & Uniform Suppliers" />
              @if (form.get('vendorName')?.hasError('required')) {
                <mat-error>
                  Vendor name is required
                </mat-error>
              }
            </mat-form-field>
    
            <mat-form-field appearance="outline">
              <mat-label>Contact Person</mat-label>
              <input matInput formControlName="contactPerson" placeholder="e.g. Rakesh Agarwal" />
            </mat-form-field>
    
            <mat-form-field appearance="outline">
              <mat-label>Phone / Mobile</mat-label>
              <input matInput formControlName="phone" placeholder="e.g. 9876543210" />
            </mat-form-field>
    
            <mat-form-field appearance="outline">
              <mat-label>Email Address</mat-label>
              <input matInput type="email" formControlName="email" placeholder="e.g. vendor@gmail.com" />
            </mat-form-field>
    
            <mat-form-field appearance="outline">
              <mat-label>GSTIN Number</mat-label>
              <input matInput formControlName="gstin" placeholder="15-digit GSTIN" />
            </mat-form-field>
    
            <mat-form-field appearance="outline">
              <mat-label>PAN Card Number</mat-label>
              <input matInput formControlName="pan" placeholder="10-digit PAN" />
            </mat-form-field>
    
            <mat-form-field appearance="outline">
              <mat-label>Payment Terms</mat-label>
              <input matInput formControlName="paymentTerms" placeholder="e.g. Net 15 Days, Immediate Cash, 50% Advance" />
            </mat-form-field>
    
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Shop / Office Address</mat-label>
              <input matInput formControlName="address" placeholder="Commercial Complex, Road, City" />
            </mat-form-field>
    
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Bank Details / UPI ID</mat-label>
              <input matInput formControlName="bankDetails" placeholder="Bank Name, A/C No, IFSC, UPI VPA" />
            </mat-form-field>
          </div>
        </mat-dialog-content>
    
        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onCancel()" [disabled]="submitting">
            Cancel
          </button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting">
            @if (submitting) {
              <mat-spinner diameter="18" class="spinner-btn"></mat-spinner>
            }
            <span>{{ data.isEdit ? 'Update Vendor' : 'Save Vendor' }}</span>
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
      max-height: 90vh;
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
    .close-btn {
      color: #64748b;
      &:hover {
        color: #1e293b;
      }
    }
    .dialog-body {
      padding: 20px;
      max-height: 65vh;
      overflow-y: auto;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .col-span-2 {
      grid-column: span 2;
    }
    .dialog-actions {
      padding: 12px 20px 16px;
      border-top: 1px solid #f1f5f9;
      gap: 8px;
    }
    .spinner-btn {
      display: inline-block;
      margin-right: 8px;
    }
    @media (max-width: 600px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
      .col-span-2 {
        grid-column: span 1;
      }
    }
  `]
})
export class InventoryVendorDialogComponent implements OnInit {
  form!: FormGroup;
  submitting = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<InventoryVendorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: InventoryVendorDialogData
  ) {}

  ngOnInit(): void {
    const v = this.data.vendor;
    this.form = this.fb.group({
      vendorName: [v?.vendorName || v?.name || '', [Validators.required, Validators.maxLength(150)]],
      contactPerson: [v?.contactPerson || ''],
      phone: [v?.phone || ''],
      email: [v?.email || '', [Validators.email]],
      address: [v?.address || ''],
      gstin: [v?.gstin || ''],
      pan: [v?.pan || ''],
      paymentTerms: [v?.paymentTerms || ''],
      bankDetails: [v?.bankDetails || '']
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const val = this.form.value;
    const result: CreateUpdateVendorDto = {
      vendorName: val.vendorName.trim(),
      contactPerson: val.contactPerson?.trim() || undefined,
      phone: val.phone?.trim() || undefined,
      email: val.email?.trim() || undefined,
      address: val.address?.trim() || undefined,
      gstin: val.gstin?.trim() || undefined,
      pan: val.pan?.trim() || undefined,
      paymentTerms: val.paymentTerms?.trim() || undefined,
      bankDetails: val.bankDetails?.trim() || undefined,
      isActive: true,
      branchId: this.data.branchId
    };

    this.dialogRef.close(result);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
