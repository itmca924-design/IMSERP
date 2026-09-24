import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FinanceService, AccountLedgerDto, CreateAccountLedgerDto, UpdateAccountLedgerDto, AccountType, AccountSubType } from '../../core/services/finance.service';
import { BranchService } from '../../core/services/branch.service';

export interface LedgerDialogData {
  ledger?: AccountLedgerDto;
  defaultType?: AccountType;
}

@Component({
  selector: 'app-ledger-dialog',
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
    MatProgressBarModule
  ],
  template: `
<div class="ledger-modal-container">
  <!-- Strictly compliant light-blue gradient header (AGENTS.md) -->
  <div class="modal-header">
    <div class="header-left">
      <div class="header-icon-box">
        <mat-icon>{{ isEdit ? 'edit_note' : 'account_tree' }}</mat-icon>
      </div>
      <div>
        <h2 class="modal-title">{{ isEdit ? 'Update Account Ledger' : 'Create New Account Ledger' }}</h2>
        <p class="modal-subtitle">खाता बही मास्टर &bull; <strong>{{ isEdit ? data.ledger?.accountCode : 'Institutional Chart of Accounts' }}</strong></p>
      </div>
    </div>
    <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
      <mat-icon>close</mat-icon>
    </button>
  </div>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <div class="modal-body">
    <div class="form-grid">
      <!-- Account Code -->
      <mat-form-field appearance="outline">
        <mat-label>Account Code *</mat-label>
        <input matInput [(ngModel)]="accountCode" [disabled]="isEdit" placeholder="e.g. FA-BUS01, BANK-SBI" required>
        <mat-icon matPrefix>tag</mat-icon>
      </mat-form-field>

      <!-- Account Name -->
      <mat-form-field appearance="outline">
        <mat-label>Account / Ledger Name *</mat-label>
        <input matInput [(ngModel)]="accountName" placeholder="e.g. School Bus 42-Seater, SBI Current A/c" required>
        <mat-icon matPrefix>badge</mat-icon>
      </mat-form-field>

      <!-- Account Type -->
      <mat-form-field appearance="outline">
        <mat-label>Classification / Type *</mat-label>
        <mat-select [(ngModel)]="accountType" (selectionChange)="onTypeChange()" required>
          <mat-option [value]="1">Asset (परिसंपत्ति)</mat-option>
          <mat-option [value]="2">Liability (देयता)</mat-option>
          <mat-option [value]="3">Equity &amp; Capital (पूंजी कोष)</mat-option>
        </mat-select>
        <mat-icon matPrefix>category</mat-icon>
      </mat-form-field>

      <!-- Sub Type -->
      <mat-form-field appearance="outline">
        <mat-label>Subcategory *</mat-label>
        <mat-select [(ngModel)]="subType" required>
          <ng-container *ngIf="accountType === 1">
            <mat-option [value]="1">Current Asset (Cash, Bank, Advance)</mat-option>
            <mat-option [value]="2">Fixed Asset (Building, Buses, Equipment)</mat-option>
          </ng-container>
          <ng-container *ngIf="accountType === 2">
            <mat-option [value]="3">Current Liability (Caution Money, Payable)</mat-option>
            <mat-option [value]="4">Long-Term Liability (Bank Loan, EMI)</mat-option>
          </ng-container>
          <ng-container *ngIf="accountType === 3">
            <mat-option [value]="5">Capital Fund / Promoters Equity</mat-option>
          </ng-container>
        </mat-select>
        <mat-icon matPrefix>account_tree</mat-icon>
      </mat-form-field>

      <!-- Opening Balance -->
      <mat-form-field appearance="outline">
        <mat-label>Opening Balance (₹)</mat-label>
        <input matInput type="number" [(ngModel)]="openingBalance" placeholder="0.00">
        <span matPrefix class="currency-prefix">₹&nbsp;</span>
      </mat-form-field>

      <!-- Branch (Optional) -->
      <mat-form-field appearance="outline" *ngIf="branches.length > 0">
        <mat-label>Campus / Branch</mat-label>
        <mat-select [(ngModel)]="selectedBranchId">
          <mat-option [value]="null">Main / All Campuses</mat-option>
          <mat-option *ngFor="let b of branches" [value]="b.id">
            {{ b.name }}
          </mat-option>
        </mat-select>
        <mat-icon matPrefix>apartment</mat-icon>
      </mat-form-field>

      <!-- Description -->
      <mat-form-field appearance="outline" class="col-span-2">
        <mat-label>Description &amp; Depreciation / Valuation Details</mat-label>
        <textarea matInput [(ngModel)]="description" rows="2" placeholder="Asset purchase details, model number, loan tenure or ledger details..."></textarea>
      </mat-form-field>
    </div>

    <div class="alert-error" *ngIf="errorMessage">
      <mat-icon>error_outline</mat-icon>
      <span>{{ errorMessage }}</span>
    </div>
  </div>

  <div class="modal-footer">
    <button mat-button (click)="dialogRef.close()" [disabled]="loading">Cancel</button>
    <button mat-raised-button color="primary" (click)="saveLedger()" [disabled]="loading || !isValid()">
      <mat-icon>{{ isEdit ? 'save' : 'check_circle' }}</mat-icon>
      <span>{{ isEdit ? 'Save Changes' : 'Create Ledger' }}</span>
    </button>
  </div>
</div>
  `,
  styles: [`
    .ledger-modal-container {
      width: 100%;
      min-width: 580px;
      max-width: 660px;
    }

    /* Strict Header (AGENTS.md) */
    .modal-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon-box {
      width: 42px;
      height: 42px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }

    .modal-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #1e3a8a;
    }

    .modal-subtitle {
      margin: 2px 0 0;
      font-size: 12px;
      color: #3b82f6;

      strong {
        color: #1e40af;
      }
    }

    .close-btn {
      color: #64748b;
      &:hover { color: #1e293b; }
    }

    .modal-body {
      padding: 20px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .col-span-2 {
      grid-column: span 2;
    }

    .currency-prefix {
      font-weight: 700;
      color: #2563eb;
    }

    .alert-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      border-radius: 8px;
      margin-top: 12px;
      font-size: 13px;
    }

    .modal-footer {
      padding: 14px 20px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      background: #f8fafc;
    }
  `]
})
export class LedgerDialogComponent implements OnInit {
  isEdit = false;
  loading = false;
  errorMessage = '';

  accountCode = '';
  accountName = '';
  accountType: AccountType = AccountType.Asset;
  subType: AccountSubType = AccountSubType.CurrentAsset;
  openingBalance = 0;
  description = '';
  selectedBranchId: string | null = null;
  branches: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<LedgerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: LedgerDialogData,
    private financeService: FinanceService,
    private branchService: BranchService
  ) {}

  ngOnInit(): void {
    this.branchService.getBranches().subscribe({
      next: (b) => (this.branches = b || []),
      error: () => {}
    });

    if (this.data.ledger) {
      this.isEdit = true;
      const l = this.data.ledger;
      this.accountCode = l.accountCode;
      this.accountName = l.accountName;
      this.accountType = l.accountType;
      this.subType = l.subType;
      this.openingBalance = l.openingBalance;
      this.description = l.description || '';
      this.selectedBranchId = l.branchId || null;
    } else if (this.data.defaultType) {
      this.accountType = this.data.defaultType;
      this.onTypeChange();
    }
  }

  onTypeChange(): void {
    if (this.accountType === AccountType.Asset) {
      this.subType = AccountSubType.CurrentAsset;
    } else if (this.accountType === AccountType.Liability) {
      this.subType = AccountSubType.CurrentLiability;
    } else if (this.accountType === AccountType.Equity) {
      this.subType = AccountSubType.Capital;
    }
  }

  isValid(): boolean {
    return !!this.accountCode.trim() && !!this.accountName.trim();
  }

  saveLedger(): void {
    if (!this.isValid()) return;

    this.loading = true;
    this.errorMessage = '';

    if (this.isEdit && this.data.ledger) {
      const dto: UpdateAccountLedgerDto = {
        accountCode: this.accountCode.trim().toUpperCase(),
        accountName: this.accountName.trim(),
        accountType: this.accountType,
        subType: this.subType,
        openingBalance: Number(this.openingBalance || 0),
        description: this.description ? this.description.trim() : undefined,
        isActive: true
      };

      this.financeService.updateAccountLedger(this.data.ledger.id, dto).subscribe({
        next: (saved) => {
          this.loading = false;
          this.dialogRef.close(saved);
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err.error?.message || 'Failed to update ledger.';
        }
      });
    } else {
      const dto: CreateAccountLedgerDto = {
        accountCode: this.accountCode.trim().toUpperCase(),
        accountName: this.accountName.trim(),
        accountType: this.accountType,
        subType: this.subType,
        openingBalance: Number(this.openingBalance || 0),
        description: this.description ? this.description.trim() : undefined,
        branchId: this.selectedBranchId
      };

      this.financeService.createAccountLedger(dto).subscribe({
        next: (created) => {
          this.loading = false;
          this.dialogRef.close(created);
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err.error?.message || 'Failed to create ledger.';
        }
      });
    }
  }
}
