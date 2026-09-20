import { Component, Inject, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FeesService, FeeInvoicePagedItem, FeeHead } from '../../core/services/fees.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

export interface EditInvoiceDialogData {
  invoice: FeeInvoicePagedItem;
  standardMonthlyFee?: number;
}

interface EditableInvoiceItem {
  id?: string;
  feeHeadId?: string;
  headName: string;
  amount: number;
  paidAmount: number;
  isNew?: boolean;
}

@Component({
  selector: 'app-edit-invoice-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="edit-dialog-wrapper">
      <!-- Header -->
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>edit_note</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">Manage Invoice Fee Heads</h2>
          <p class="subtitle">Add, adjust, or remove line items on {{ data.invoice.invoiceNumber }}</p>
        </div>
        <button mat-icon-button type="button" class="close-btn" (click)="onClose()" [disabled]="saving">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content class="dialog-content">
        <!-- Student Info Header -->
        <div class="student-banner">
          <div class="banner-left">
            <div class="st-name-row">
              <strong class="st-name">{{ data.invoice.studentName }}</strong>
              <span class="st-roll">({{ data.invoice.rollNumber }})</span>
            </div>
            <div class="st-meta-row">
              <span *ngIf="data.invoice.className" class="badge-tag school">
                🏫 {{ data.invoice.className }}<span *ngIf="data.invoice.sectionName"> ({{ data.invoice.sectionName }})</span>
              </span>
              <span *ngIf="data.invoice.className && data.invoice.batchName" class="badge-sep">•</span>
              <span *ngIf="data.invoice.batchName" class="badge-tag batch">
                🎯 {{ data.invoice.batchName }}
              </span>
            </div>
          </div>
          <div class="banner-right">
            <span class="due-label">Total Fee Amount:</span>
            <strong class="total-due-val">₹{{ totalComputedAmount | number:'1.2-2' }}</strong>
          </div>
        </div>

        <!-- Current Line Items -->
        <div class="section-title-row">
          <div class="title-with-icon">
            <mat-icon class="section-icon">format_list_bulleted</mat-icon>
            <span class="section-title">Invoice Fee Heads ({{ items.length }})</span>
          </div>
          <span class="paid-badge" *ngIf="data.invoice.paidAmount > 0">
            Already Paid: ₹{{ data.invoice.paidAmount | number:'1.2-2' }}
          </span>
        </div>

        <div class="items-table-card">
          <table class="items-table" *ngIf="items.length > 0">
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>Fee Head Particulars</th>
                <th class="text-right" style="width: 140px;">Amount (₹)</th>
                <th class="text-center" style="width: 70px;">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let it of items; let idx = index" [class.is-new-row]="it.isNew">
                <td class="idx-col">{{ idx + 1 }}</td>
                <td>
                  <div class="head-particulars">
                    <strong>{{ it.headName }}</strong>
                    <span *ngIf="it.paidAmount > 0" class="mini-paid-tag">Paid: ₹{{ it.paidAmount | number:'1.2-2' }}</span>
                    <span *ngIf="it.isNew" class="mini-new-tag">New</span>
                  </div>
                </td>
                <td class="text-right">
                  <input
                    type="number"
                    class="item-amount-input"
                    [(ngModel)]="it.amount"
                    (ngModelChange)="onAmountChange()"
                    [disabled]="it.paidAmount > 0 || saving"
                    min="1"
                  />
                </td>
                <td class="text-center">
                  <button
                    mat-icon-button
                    type="button"
                    class="delete-item-btn"
                    [disabled]="it.paidAmount > 0 || saving"
                    (click)="removeItem(idx)"
                    [matTooltip]="it.paidAmount > 0 ? 'Cannot remove already paid item' : 'Remove this fee head'"
                  >
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <div *ngIf="items.length === 0" class="no-items-state">
            <mat-icon>receipt</mat-icon>
            <p>No fee heads on this invoice. Add at least one head below.</p>
          </div>
        </div>

        <!-- Add New Fee Head Form -->
        <div class="add-head-section">
          <div class="section-title-row">
            <div class="title-with-icon">
              <mat-icon class="section-icon add-icon">add_circle</mat-icon>
              <span class="section-title">Add New Fee Head</span>
            </div>
          </div>

          <form [formGroup]="addForm" (ngSubmit)="onAddHead()" class="add-head-form">
            <mat-form-field appearance="outline" class="head-select-field">
              <mat-label>Select Fee Head</mat-label>
              <mat-select
                formControlName="feeHeadId"
                panelClass="wide-fee-head-select-panel"
                (openedChange)="onFeeHeadDropdownOpened($event)"
                (selectionChange)="onFeeHeadSelected($event.value)"
              >
                <!-- Display trigger for selected fee head -->
                <mat-select-trigger>
                  <span *ngIf="getSelectedFeeHeadName()" class="selected-head-trigger-text">
                    {{ getSelectedFeeHeadName() }}
                  </span>
                </mat-select-trigger>

                <!-- Search Input Option (Sticky Header) -->
                <mat-option disabled class="select-search-option">
                  <div class="select-search-wrap" (click)="$event.stopPropagation()" (mousedown)="$event.stopPropagation()">
                    <mat-icon class="search-box-icon">search</mat-icon>
                    <input
                      #feeHeadSearchInput
                      type="text"
                      class="select-search-input"
                      placeholder="Search fee heads by name, code, category..."
                      [value]="feeHeadSearchText"
                      (input)="filterFeeHeads($event)"
                      (click)="$event.stopPropagation()"
                      (mousedown)="$event.stopPropagation()"
                      (keydown)="$event.stopPropagation()"
                      (keyup)="$event.stopPropagation()"
                    />
                    <button
                      mat-icon-button
                      type="button"
                      class="clear-search-btn"
                      *ngIf="feeHeadSearchText"
                      (click)="clearFeeHeadSearch($event)"
                      (mousedown)="$event.stopPropagation()"
                      matTooltip="Clear search"
                    >
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                </mat-option>

                <!-- Filtered Fee Heads -->
                <mat-option *ngFor="let fh of filteredFeeHeads" [value]="fh.id">
                  <div class="fh-option-row">
                    <div class="fh-left-col">
                      <strong class="fh-main-name">{{ fh.name }}</strong>
                      <span class="fh-code-chip" *ngIf="fh.code">{{ fh.code }}</span>
                    </div>
                    <div class="fh-chips">
                      <span class="fh-cat-chip">{{ fh.category }}</span>
                      <span class="fh-freq-chip">{{ fh.frequency }}</span>
                    </div>
                  </div>
                </mat-option>

                <!-- No Results State -->
                <mat-option disabled *ngIf="filteredFeeHeads.length === 0" class="no-heads-option">
                  <div class="no-heads-wrap">
                    <mat-icon>search_off</mat-icon>
                    <span>No fee head matching "{{ feeHeadSearchText }}"</span>
                  </div>
                </mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">tune</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="head-name-field" *ngIf="isCustomHead">
              <mat-label>Particulars Name</mat-label>
              <input matInput formControlName="customName" placeholder="e.g. Coaching Fee" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="amount-field">
              <mat-label>Amount (₹)</mat-label>
              <input matInput type="number" formControlName="amount" min="1" />
              <span matPrefix class="currency-prefix">₹&nbsp;</span>
            </mat-form-field>

            <button
              mat-raised-button
              color="accent"
              type="submit"
              class="add-btn"
              [disabled]="addForm.invalid || saving"
            >
              <mat-icon>add</mat-icon>
              <span>Add Head</span>
            </button>
          </form>
        </div>
      </mat-dialog-content>

      <!-- Actions -->
      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button type="button" (click)="onClose()" [disabled]="saving">Cancel</button>
        <button
          mat-raised-button
          color="primary"
          type="button"
          (click)="onSaveChanges()"
          [disabled]="items.length === 0 || saving"
          class="save-btn"
        >
          <mat-spinner diameter="18" *ngIf="saving" class="btn-spinner"></mat-spinner>
          <mat-icon *ngIf="!saving">check_circle</mat-icon>
          <span>{{ saving ? 'Saving Changes...' : 'Save & Update Invoice' }}</span>
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .edit-dialog-wrapper {
      padding: 0;
      box-sizing: border-box;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: linear-gradient(135deg, #f8fafc 0%, #ede9fe 100%);
      border-bottom: 1px solid #ddd6fe;

      .header-icon-wrap {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        background: #7c3aed;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-right: 12px;

        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }

      .header-titles {
        flex: 1;
        .main-title {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: #1e1b4b;
        }
        .subtitle {
          margin: 2px 0 0;
          font-size: 0.82rem;
          color: #6d28d9;
        }
      }

      .close-btn { color: #64748b; }
    }

    .dialog-content {
      padding: 16px 24px;
      max-height: 75vh;
      overflow-y: auto;
    }

    .student-banner {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      .banner-left {
        display: flex;
        flex-direction: column;
        gap: 3px;

        .st-name-row {
          display: flex;
          align-items: center;
          gap: 6px;

          .st-name {
            font-size: 1rem;
            color: #0f172a;
          }
          .st-roll {
            font-size: 0.82rem;
            color: #64748b;
          }
        }

        .st-meta-row {
          display: flex;
          align-items: center;
          gap: 6px;

          .badge-tag {
            font-size: 0.76rem;
            padding: 1px 7px;
            border-radius: 4px;
            font-weight: 600;

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

          .badge-sep {
            color: #cbd5e1;
            font-weight: bold;
          }
        }
      }

      .banner-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;

        .due-label {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748b;
          font-weight: 600;
        }

        .total-due-val {
          font-size: 1.25rem;
          font-weight: 800;
          color: #059669;
        }
      }
    }

    .section-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;

      .title-with-icon {
        display: flex;
        align-items: center;
        gap: 6px;

        .section-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #7c3aed;

          &.add-icon { color: #059669; }
        }

        .section-title {
          font-size: 0.9rem;
          font-weight: 700;
          color: #1e293b;
        }
      }

      .paid-badge {
        font-size: 0.76rem;
        background: #dcfce7;
        color: #15803d;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 600;
        border: 1px solid #bbf7d0;
      }
    }

    .items-table-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 18px;

      .items-table {
        width: 100%;
        border-collapse: collapse;

        thead {
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;

          th {
            padding: 8px 12px;
            font-size: 0.75rem;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
        }

        tbody {
          tr {
            border-bottom: 1px solid #f1f5f9;
            transition: background 0.1s ease;

            &:last-child { border-bottom: none; }
            &:hover { background: #faf5ff; }
            &.is-new-row { background: #f0fdf4; }

            td {
              padding: 8px 12px;
              font-size: 0.85rem;
              color: #1e293b;
            }

            .idx-col {
              color: #94a3b8;
              font-weight: 600;
            }

            .head-particulars {
              display: flex;
              align-items: center;
              gap: 8px;

              .mini-paid-tag {
                font-size: 0.7rem;
                background: #e0e7ff;
                color: #3730a3;
                padding: 1px 5px;
                border-radius: 3px;
              }

              .mini-new-tag {
                font-size: 0.7rem;
                background: #dcfce7;
                color: #166534;
                padding: 1px 5px;
                border-radius: 3px;
                font-weight: 700;
              }
            }

            .item-amount-input {
              width: 100px;
              padding: 4px 8px;
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              text-align: right;
              font-weight: 700;
              font-size: 0.9rem;
              color: #0f172a;

              &:focus {
                outline: none;
                border-color: #7c3aed;
                box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15);
              }
            }

            .delete-item-btn {
              color: #ef4444;
              width: 32px;
              height: 32px;
              line-height: 32px;

              &:disabled { color: #cbd5e1; }
              &:not(:disabled):hover { background: #fee2e2; }
            }
          }
        }
      }

      .no-items-state {
        padding: 24px;
        text-align: center;
        color: #94a3b8;
        mat-icon { font-size: 36px; width: 36px; height: 36px; margin-bottom: 4px; }
        p { margin: 0; font-size: 0.85rem; }
      }
    }

    .add-head-section {
      background: #faf5ff;
      border: 1px dashed #c4b5fd;
      border-radius: 8px;
      padding: 14px 16px 8px;

      .add-head-form {
        display: flex;
        gap: 14px;
        align-items: flex-start;
        flex-wrap: wrap;

        .head-select-field {
          flex: 3;
          min-width: 380px;
        }

        .head-name-field {
          flex: 2;
          min-width: 180px;
        }

        .amount-field {
          width: 140px;
          min-width: 130px;
        }

        .currency-prefix {
          font-weight: 700;
          color: #64748b;
        }

        .add-btn {
          height: 52px;
          margin-top: 4px;
          font-weight: 700;
          padding: 0 20px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
      }
    }

    ::ng-deep .wide-fee-head-select-panel {
      min-width: 460px !important;
      max-width: 620px !important;
      max-height: 400px !important;

      .mat-mdc-option {
        padding: 8px 16px !important;
        min-height: 44px !important;
      }

      .select-search-option {
        position: sticky !important;
        top: 0 !important;
        z-index: 99 !important;
        background: #ffffff !important;
        border-bottom: 1px solid #e2e8f0;
        padding: 6px 12px !important;
        height: auto !important;
        min-height: 50px !important;
        cursor: default !important;
        opacity: 1 !important;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);

        .mdc-list-item__primary-text {
          width: 100% !important;
        }

        &:hover, &:focus {
          background: #ffffff !important;
        }
      }

      .select-search-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        background: #f8fafc;
        border: 1.5px solid #cbd5e1;
        border-radius: 8px;
        padding: 4px 10px;
        box-sizing: border-box;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;

        &:focus-within {
          border-color: #7c3aed;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
        }

        .search-box-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #7c3aed;
          flex-shrink: 0;
        }

        .select-search-input {
          flex: 1 1 auto;
          border: none;
          background: transparent;
          font-size: 0.88rem;
          outline: none;
          color: #0f172a;
          width: 100%;
          pointer-events: auto !important;
          cursor: text !important;
          padding: 3px 0;

          &::placeholder {
            color: #94a3b8;
          }
        }

        .clear-search-btn {
          width: 22px;
          height: 22px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;

          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
            color: #94a3b8;

            &:hover {
              color: #ef4444;
            }
          }
        }
      }

      .no-heads-option {
        pointer-events: none;
        opacity: 0.85 !important;
        min-height: 48px !important;

        .no-heads-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #94a3b8;
          font-size: 0.86rem;
          font-style: italic;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            color: #cbd5e1;
          }
        }
      }
    }

    .selected-head-trigger-text {
      font-weight: 600;
      color: #0f172a;
    }

    .fh-option-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 14px;

      .fh-left-col {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .fh-main-name {
        font-weight: 600;
        color: #0f172a;
        font-size: 0.9rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .fh-code-chip {
        font-size: 0.7rem;
        font-weight: 700;
        color: #7c3aed;
        background: #f5f3ff;
        border: 1px solid #ddd6fe;
        padding: 1px 6px;
        border-radius: 4px;
        flex-shrink: 0;
      }

      .fh-chips {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;

        .fh-cat-chip {
          font-size: 0.72rem;
          background: #eff6ff;
          color: #2563eb;
          padding: 1px 7px;
          border-radius: 4px;
          border: 1px solid #bfdbfe;
        }

        .fh-freq-chip {
          font-size: 0.72rem;
          background: #f1f5f9;
          color: #475569;
          padding: 1px 7px;
          border-radius: 4px;
        }
      }
    }

    .dialog-actions {
      padding: 12px 24px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;

      .save-btn {
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    }
  `]
})
export class EditInvoiceDialogComponent implements OnInit {
  @ViewChild('feeHeadSearchInput') feeHeadSearchInput?: ElementRef<HTMLInputElement>;

  items: EditableInvoiceItem[] = [];
  availableFeeHeads: FeeHead[] = [];
  filteredFeeHeads: FeeHead[] = [];
  feeHeadSearchText = '';

  addForm: FormGroup;
  isCustomHead = false;
  saving = false;

  get totalComputedAmount(): number {
    return this.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  }

  constructor(
    private fb: FormBuilder,
    private feesService: FeesService,
    private confirmDialog: ConfirmDialogService,
    private dialogRef: MatDialogRef<EditInvoiceDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: EditInvoiceDialogData
  ) {
    this.addForm = this.fb.group({
      feeHeadId: ['', [Validators.required]],
      customName: [''],
      amount: [1000, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    // Populate existing items from invoice
    if (this.data.invoice.items && this.data.invoice.items.length > 0) {
      this.items = this.data.invoice.items.map(it => ({
        id: it.id,
        feeHeadId: it.feeHeadId,
        headName: it.headName,
        amount: it.amount,
        paidAmount: it.paidAmount || 0,
        isNew: false
      }));
    } else {
      // Fallback row if invoice had no child items
      this.items = [{
        feeHeadId: undefined,
        headName: this.data.invoice.title || 'Tuition Fee',
        amount: this.data.invoice.totalAmount,
        paidAmount: this.data.invoice.paidAmount || 0,
        isNew: false
      }];
    }

    // Load available active fee heads for dropdown
    this.feesService.getFeeHeads(true).subscribe({
      next: (heads) => {
        this.availableFeeHeads = heads || [];
        this.filteredFeeHeads = [...this.availableFeeHeads];
      },
      error: (err) => console.error('Failed to load fee heads', err)
    });
  }

  onFeeHeadDropdownOpened(isOpen: boolean): void {
    if (isOpen) {
      setTimeout(() => {
        if (this.feeHeadSearchInput?.nativeElement) {
          this.feeHeadSearchInput.nativeElement.focus();
        }
      }, 120);
    } else {
      this.feeHeadSearchText = '';
      this.filteredFeeHeads = [...this.availableFeeHeads];
    }
  }

  filterFeeHeads(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.feeHeadSearchText = input ? input.value : '';
    this.applyFeeHeadFilter();
  }

  clearFeeHeadSearch(event: Event): void {
    event.stopPropagation();
    this.feeHeadSearchText = '';
    this.applyFeeHeadFilter();
    setTimeout(() => {
      this.feeHeadSearchInput?.nativeElement?.focus();
    }, 50);
  }

  applyFeeHeadFilter(): void {
    const q = (this.feeHeadSearchText || '').trim().toLowerCase();
    if (!q) {
      this.filteredFeeHeads = [...this.availableFeeHeads];
      return;
    }
    this.filteredFeeHeads = this.availableFeeHeads.filter(h => {
      const nameMatch = h.name && h.name.toLowerCase().includes(q);
      const codeMatch = h.code && h.code.toLowerCase().includes(q);
      const catMatch = h.category && h.category.toLowerCase().includes(q);
      const freqMatch = h.frequency && h.frequency.toLowerCase().includes(q);
      const descMatch = h.description && h.description.toLowerCase().includes(q);
      return Boolean(nameMatch || codeMatch || catMatch || freqMatch || descMatch);
    });
  }

  getSelectedFeeHeadName(): string {
    const id = this.addForm?.get('feeHeadId')?.value;
    if (!id) return '';
    const head = this.availableFeeHeads.find(h => h.id === id);
    return head ? head.name : '';
  }

  onFeeHeadSelected(feeHeadId: string): void {
    const selected = this.availableFeeHeads.find(h => h.id === feeHeadId);
    if (selected) {
      // If selected head is Coaching Fee and student has a batch with standardMonthlyFee, suggest it
      if (selected.code === 'COACH' && this.data.standardMonthlyFee) {
        this.addForm.get('amount')?.setValue(this.data.standardMonthlyFee);
      } else if (selected.code === 'COACH') {
        this.addForm.get('amount')?.setValue(1200);
      }
    }
  }

  onAmountChange(): void {
    // Triggers recalculation via getter
  }

  removeItem(index: number): void {
    const it = this.items[index];
    if (it.paidAmount > 0) return;
    this.items.splice(index, 1);
  }

  onAddHead(): void {
    if (this.addForm.invalid) return;
    const val = this.addForm.value;
    const selectedHead = this.availableFeeHeads.find(h => h.id === val.feeHeadId);
    const headName = selectedHead ? selectedHead.name : val.customName;
    const amount = Number(val.amount);

    if (!headName || amount <= 0) return;

    this.items.push({
      feeHeadId: val.feeHeadId || undefined,
      headName: headName,
      amount: amount,
      paidAmount: 0,
      isNew: true
    });

    // Reset add form
    this.addForm.reset({
      feeHeadId: '',
      customName: '',
      amount: 1000
    });
    this.feeHeadSearchText = '';
    this.filteredFeeHeads = [...this.availableFeeHeads];
  }

  onSaveChanges(): void {
    if (this.items.length === 0 || this.saving) return;

    this.saving = true;
    const payload = this.items.map(it => ({
      feeHeadId: it.feeHeadId,
      headName: it.headName,
      amount: Number(it.amount)
    }));

    this.feesService.updateInvoiceItems(this.data.invoice.id, payload).subscribe({
      next: (res) => {
        this.saving = false;
        this.confirmDialog.alert(
          'Invoice Updated',
          res.message || `Invoice ${this.data.invoice.invoiceNumber} fee heads updated successfully.`,
          'success'
        );
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.saving = false;
        console.error('Failed to update invoice items', err);
        this.confirmDialog.alert(
          'Update Failed',
          err.error?.message || err.message || 'Failed to update invoice items.',
          'danger'
        );
      }
    });
  }

  onClose(): void {
    this.dialogRef.close(false);
  }
}
