import { Component, Inject, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { FinanceService, ExpenseVoucherDto, ExpenseCategoryDto, CreateExpenseVoucherDto, UpdateExpenseVoucherDto, ExpensePaymentMode } from '../../core/services/finance.service';
import { BranchService } from '../../core/services/branch.service';
import { AiErpCopilotService } from '../../core/services/ai-erp-copilot.service';

export interface ExpenseDialogData {
  voucher?: ExpenseVoucherDto;
  categories: ExpenseCategoryDto[];
}

@Component({
  selector: 'app-expense-dialog',
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
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  template: `
<div class="expense-modal-container">
  <!-- Strictly compliant light-blue gradient header (AGENTS.md) -->
  <div class="modal-header">
    <div class="header-left">
      <div class="header-icon-box">
        <mat-icon>{{ isEdit ? 'edit_note' : 'receipt_long' }}</mat-icon>
      </div>
      <div>
        <h2 class="modal-title">{{ isEdit ? 'Update Expense Voucher' : 'Record New Expense Voucher' }}</h2>
        <p class="modal-subtitle">खर्च वाउचर प्रविष्टि &bull; <strong>{{ isEdit ? data.voucher?.voucherNo : 'New General / Operating Expense' }}</strong></p>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      @if (!isEdit) {
        <button type="button" 
          class="ai-toggle-action-btn" 
          [class.active]="isAiExpenseOpen" 
          (click)="toggleAiExpensePanel()" 
          [matTooltip]="isAiExpenseOpen ? 'Hide Voice Voucher Assistant' : 'Open Voice Voucher Assistant'">
          <mat-icon>{{ isAiExpenseOpen ? 'visibility_off' : 'psychology' }}</mat-icon>
          <span>{{ isAiExpenseOpen ? 'Hide Voice' : '✨ AI Expense' }}</span>
          @if (!isAiExpenseOpen) {
            <span class="ai-pill-tag">Voice</span>
          }
        </button>
      }
      <button (click)="dialogRef.close()" class="close-btn" mat-icon-button>
        <mat-icon>close</mat-icon>
      </button>
    </div>
  </div>

  @if (loading) {
    <mat-progress-bar mode="indeterminate"></mat-progress-bar>
  }

  <div class="modal-body">
    <!-- Agentic AI Smart Expense Voucher Copilot -->
    @if (isAiExpenseOpen && !isEdit) {
      <div class="ai-copilot-card">
        <div class="ai-copilot-header">
          <div class="ai-copilot-title-group">
            <div class="ai-avatar-icon">
              <mat-icon>receipt_long</mat-icon>
            </div>
            <div class="ai-title-text">
              <div class="ai-main-title-row">
                <h4>Agentic AI Expense Voucher Copilot</h4>
                <span class="ai-pill-active">⚡ Instant Voice &amp; Auto-Fill</span>
              </div>
              <p>खर्च बोलें या लिखें — जैसे "Generator diesel 1500 cash" या "Stationery register 650 UPI paid to Ratan", AI फॉर्म तुरंत भर देगा।</p>
            </div>
          </div>
          <div class="ai-header-controls">
            <button type="button" class="ai-minimize-btn" (click)="toggleAiExpensePanel()" matTooltip="Hide Copilot">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>

        @if (isAiExpenseListening) {
          <div class="ai-listening-bar">
            <div class="ai-wave-wrap">
              <mat-icon class="ai-wave-icon">graphic_eq</mat-icon>
              <div class="ai-listening-text">
                <span>AI सुन रहा है... ({{ aiExpenseSpeechLang === 'hi-IN' ? 'Listening in Hindi / Hinglish' : 'Listening in English' }})</span>
                <span class="ai-mic-hint">बोलिए: "खर्च का नाम, राशि, माध्यम (Cash/UPI), और वेंडर का नाम..."</span>
              </div>
            </div>
            <button type="button" class="ai-stop-btn" (click)="toggleAiExpenseSpeech()">
              <mat-icon>mic_off</mat-icon>
              <span>Stop</span>
            </button>
          </div>
        }

        <div class="ai-input-wrap">
          <textarea
            class="ai-textarea"
            rows="2"
            [(ngModel)]="aiExpensePromptText"
            (input)="onAiExpensePromptInput()"
            (keydown.enter)="$event.preventDefault(); processAiExpenseCommand()"
            placeholder="यहाँ बोलें या टाइप करें... (उदा: 'Generator diesel 1500 cash' या 'Printer cartridge 1200 UPI paid to Computer World')"></textarea>

          <div class="ai-footer-bar">
            <div class="ai-footer-left">
              <button type="button" class="ai-mic-btn" [class.listening]="isAiExpenseListening" (click)="toggleAiExpenseSpeech()">
                <mat-icon>{{ isAiExpenseListening ? 'mic' : 'mic_none' }}</mat-icon>
                <span>{{ isAiExpenseListening ? 'Stop Mic' : 'Start Voice' }}</span>
              </button>
              <button type="button" class="ai-lang-pill-btn" (click)="toggleAiExpenseLang()" matTooltip="Switch Language">
                <mat-icon>language</mat-icon>
                <span>{{ aiExpenseSpeechLang === 'hi-IN' ? 'हिंदी (Hindi)' : 'English' }}</span>
              </button>
            </div>
            <div class="ai-footer-right">
              @if (aiExpensePromptText) {
                <button type="button" class="ai-clear-btn" (click)="clearAiExpense()">Clear</button>
              }
              <button
                type="button"
                class="ai-submit-action-btn"
                [disabled]="!aiExpensePromptText.trim()"
                (click)="processAiExpenseCommand()">
                <mat-icon>auto_awesome</mat-icon>
                <span>Auto-Fill Voucher (फॉर्म भरें)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <div class="form-grid">
      <!-- Title -->
      <mat-form-field appearance="outline" class="col-span-2">
        <mat-label>Expense Title / Purpose *</mat-label>
        <input matInput [(ngModel)]="title" placeholder="e.g. Electricity Bill - Main Campus, Bus Diesel, Printer Cartridges" required>
        <mat-icon matPrefix>description</mat-icon>
      </mat-form-field>

      <!-- Category -->
      <mat-form-field appearance="outline">
        <mat-label>Expense Category *</mat-label>
        <mat-select [(ngModel)]="selectedCategoryId" required>
          @for (cat of categories; track cat) {
            <mat-option [value]="cat.id">
              {{ cat.name }} ({{ cat.code }})
            </mat-option>
          }
        </mat-select>
        <mat-icon matPrefix>category</mat-icon>
      </mat-form-field>

      <!-- Amount -->
      <mat-form-field appearance="outline">
        <mat-label>Amount (₹) *</mat-label>
        <input matInput type="number" [(ngModel)]="amount" min="1" placeholder="0.00" required>
        <span matPrefix class="currency-prefix">₹&nbsp;</span>
      </mat-form-field>

      <!-- Expense Date -->
      <mat-form-field appearance="outline">
        <mat-label>Expense Date *</mat-label>
        <input matInput [matDatepicker]="picker" [(ngModel)]="expenseDate" required>
        <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
        <mat-datepicker #picker></mat-datepicker>
      </mat-form-field>

      <!-- Payment Mode -->
      <mat-form-field appearance="outline">
        <mat-label>Payment Mode *</mat-label>
        <mat-select [(ngModel)]="paymentMode" required>
          <mat-option [value]="1">Cash</mat-option>
          <mat-option [value]="2">UPI / QR</mat-option>
          <mat-option [value]="3">Bank Transfer (NEFT/IMPS)</mat-option>
          <mat-option [value]="4">Cheque</mat-option>
          <mat-option [value]="5">Card</mat-option>
        </mat-select>
        <mat-icon matPrefix>payments</mat-icon>
      </mat-form-field>

      <!-- Branch (if branches exist) -->
      @if (branches.length > 0) {
        <mat-form-field appearance="outline">
          <mat-label>Campus / Branch</mat-label>
          <mat-select [(ngModel)]="selectedBranchId">
            <mat-option [value]="null">Main Branch / Default</mat-option>
            @for (b of branches; track b) {
              <mat-option [value]="b.id">
                {{ b.name }}
              </mat-option>
            }
          </mat-select>
          <mat-icon matPrefix>apartment</mat-icon>
        </mat-form-field>
      }

      <!-- Vendor Name -->
      <mat-form-field appearance="outline">
        <mat-label>Vendor / Payee Name</mat-label>
        <input matInput [(ngModel)]="vendorName" placeholder="e.g. State Electricity Board, Bharat Petroleum, ABC Stationery">
        <mat-icon matPrefix>store</mat-icon>
      </mat-form-field>

      <!-- Bill / Invoice No -->
      <mat-form-field appearance="outline">
        <mat-label>Bill / Invoice Reference #</mat-label>
        <input matInput [(ngModel)]="billInvoiceNo" placeholder="e.g. BILL-98231, REC-4410">
        <mat-icon matPrefix>tag</mat-icon>
      </mat-form-field>

      <!-- Receipt Attachment URL -->
      <mat-form-field appearance="outline" class="col-span-2">
        <mat-label>Receipt / Document URL (Optional)</mat-label>
        <input matInput [(ngModel)]="receiptAttachmentUrl" placeholder="https://... or link to bill scan">
        <mat-icon matPrefix>link</mat-icon>
      </mat-form-field>

      <!-- Remarks / Description -->
      <mat-form-field appearance="outline" class="col-span-2">
        <mat-label>Description / Additional Notes</mat-label>
        <textarea matInput [(ngModel)]="description" rows="2" placeholder="Itemized breakdown, approval notes or reason..."></textarea>
      </mat-form-field>
    </div>

    @if (errorMessage) {
      <div class="alert-error">
        <mat-icon>error_outline</mat-icon>
        <span>{{ errorMessage }}</span>
      </div>
    }
  </div>

  <div class="modal-footer">
    <button (click)="dialogRef.close()" [disabled]="loading" matButton="filled" class="app-button-cancel">Cancel</button>
    <button color="primary" (click)="saveExpense()" [disabled]="loading || !isValid()" matButton="filled" [class.app-button-update]="isEdit" [class.app-button-save]="!(isEdit)">
      <mat-icon>{{ isEdit ? 'save' : 'check_circle' }}</mat-icon>
      <span>{{ isEdit ? 'Save Changes' : 'Save Expense Voucher' }}</span>
    </button>
  </div>
</div>
`,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .expense-modal-container {
      width: 100%;
      max-width: 720px;
      box-sizing: border-box;

      @media (min-width: 641px) {
        min-width: 580px;
      }

      @media (max-width: 640px) {
        min-width: 0 !important;
        width: 100% !important;

        .modal-header {
          padding: 12px 14px;
          flex-wrap: wrap;
          gap: 10px;

          .header-left {
            gap: 10px;

            .header-icon-box {
              width: 36px;
              height: 36px;
              mat-icon { font-size: 18px; width: 18px; height: 18px; }
            }

            .modal-title { font-size: 1rem; }
            .modal-subtitle { font-size: 0.74rem; }
          }
        }

        .modal-body {
          padding: 14px 12px;
        }

        .form-grid {
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .col-span-2 {
          grid-column: span 1;
        }

        .modal-footer {
          padding: 12px 14px;
          flex-direction: column-reverse;
          button {
            width: 100%;
            justify-content: center;
          }
        }
      }
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
      max-height: 72vh;
      overflow-y: auto;
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
export class ExpenseDialogComponent implements OnInit, OnDestroy {
  isEdit = false;
  loading = false;
  errorMessage = '';

  // Agentic AI Expense Voucher Copilot Properties (defaults to hidden on open)
  isAiExpenseOpen = false;
  isAiExpenseListening = false;
  aiExpensePromptText = '';
  aiExpenseSpeechLang = 'hi-IN';
  private aiExpenseSub?: Subscription;

  title = '';
  selectedCategoryId = '';
  amount: number | null = null;
  expenseDate: Date = new Date();
  paymentMode: ExpensePaymentMode = ExpensePaymentMode.Cash;
  vendorName = '';
  billInvoiceNo = '';
  receiptAttachmentUrl = '';
  description = '';
  selectedBranchId: string | null = null;

  categories: ExpenseCategoryDto[] = [];
  branches: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<ExpenseDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ExpenseDialogData,
    private financeService: FinanceService,
    private branchService: BranchService,
    private aiCopilotService: AiErpCopilotService
  ) {}

  ngOnInit(): void {
    this.categories = this.data.categories || [];
    if (this.categories.length > 0 && !this.selectedCategoryId) {
      this.selectedCategoryId = this.categories[0].id;
    }

    this.branchService.getBranches().subscribe({
      next: (b) => (this.branches = b || []),
      error: () => {}
    });

    if (this.data.voucher) {
      this.isEdit = true;
      const v = this.data.voucher;
      this.title = v.title;
      this.selectedCategoryId = v.expenseCategoryId;
      this.amount = v.amount;
      this.expenseDate = new Date(v.expenseDate);
      this.paymentMode = v.paymentMode;
      this.vendorName = v.vendorName || '';
      this.billInvoiceNo = v.billInvoiceNo || '';
      this.receiptAttachmentUrl = v.receiptAttachmentUrl || '';
      this.description = v.description || '';
      this.selectedBranchId = v.branchId || null;
    }

    this.aiExpenseSub = this.aiCopilotService.getSpeechTranscript().subscribe(text => {
      if (this.isAiExpenseListening) {
        this.aiExpensePromptText = text;
      }
    });
  }

  ngOnDestroy(): void {
    this.aiExpenseSub?.unsubscribe();
    if (this.isAiExpenseListening) {
      this.aiCopilotService.stopListening();
    }
  }

  // ════════════════════════════════════════════════════════════
  // AGENTIC AI EXPENSE VOUCHER COPILOT METHODS
  // ════════════════════════════════════════════════════════════
  toggleAiExpensePanel(): void {
    this.isAiExpenseOpen = !this.isAiExpenseOpen;
    if (!this.isAiExpenseOpen) {
      this.clearAiExpense();
    }
  }

  onAiExpensePromptInput(): void {
    if (!this.aiExpensePromptText?.trim() && this.isAiExpenseListening) {
      this.aiCopilotService.restartListening(this.aiExpenseSpeechLang);
    }
  }

  clearAiExpense(): void {
    this.aiExpensePromptText = '';
    this.aiCopilotService.stopListening();
    this.isAiExpenseListening = false;
  }

  toggleAiExpenseSpeech(): void {
    if (!this.aiCopilotService.isSpeechSupported()) {
      return;
    }
    if (this.isAiExpenseListening) {
      this.aiCopilotService.stopListening();
      this.isAiExpenseListening = false;
    } else {
      this.isAiExpenseListening = true;
      this.aiCopilotService.startListening(this.aiExpenseSpeechLang);
    }
  }

  toggleAiExpenseLang(): void {
    this.aiExpenseSpeechLang = this.aiExpenseSpeechLang === 'hi-IN' ? 'en-IN' : 'hi-IN';
    if (this.isAiExpenseListening) {
      this.aiCopilotService.restartWithLanguage(this.aiExpenseSpeechLang);
    }
  }

  processAiExpenseCommand(): void {
    const raw = (this.aiExpensePromptText || '').trim();
    if (!raw) return;

    const parsed = this.aiCopilotService.parseExpenseCommand(raw, this.categories);
    if (parsed.title) this.title = parsed.title;
    if (parsed.amount) this.amount = parsed.amount;
    if (parsed.categoryId) this.selectedCategoryId = parsed.categoryId;
    if (parsed.paymentMode) this.paymentMode = parsed.paymentMode;
    if (parsed.paidTo) this.vendorName = parsed.paidTo;

    if (this.isAiExpenseListening) {
      this.aiCopilotService.stopListening();
      this.isAiExpenseListening = false;
    }
  }

  isValid(): boolean {
    return !!this.title.trim() && !!this.selectedCategoryId && !!this.amount && this.amount > 0 && !!this.expenseDate;
  }

  saveExpense(): void {
    if (!this.isValid()) return;

    this.loading = true;
    this.errorMessage = '';

    if (this.isEdit && this.data.voucher) {
      const dto: UpdateExpenseVoucherDto = {
        title: this.title.trim(),
        expenseCategoryId: this.selectedCategoryId,
        amount: Number(this.amount),
        expenseDate: this.expenseDate.toISOString(),
        paymentMode: this.paymentMode,
        vendorName: this.vendorName ? this.vendorName.trim() : undefined,
        billInvoiceNo: this.billInvoiceNo ? this.billInvoiceNo.trim() : undefined,
        receiptAttachmentUrl: this.receiptAttachmentUrl ? this.receiptAttachmentUrl.trim() : undefined,
        description: this.description ? this.description.trim() : undefined,
        branchId: this.selectedBranchId
      };

      this.financeService.updateExpense(this.data.voucher.id, dto).subscribe({
        next: (saved) => {
          this.loading = false;
          this.dialogRef.close(saved);
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err.error?.message || 'Failed to update expense voucher.';
        }
      });
    } else {
      const dto: CreateExpenseVoucherDto = {
        title: this.title.trim(),
        expenseCategoryId: this.selectedCategoryId,
        amount: Number(this.amount),
        expenseDate: this.expenseDate.toISOString(),
        paymentMode: this.paymentMode,
        vendorName: this.vendorName ? this.vendorName.trim() : undefined,
        billInvoiceNo: this.billInvoiceNo ? this.billInvoiceNo.trim() : undefined,
        receiptAttachmentUrl: this.receiptAttachmentUrl ? this.receiptAttachmentUrl.trim() : undefined,
        description: this.description ? this.description.trim() : undefined,
        branchId: this.selectedBranchId
      };

      this.financeService.createExpense(dto).subscribe({
        next: (created) => {
          this.loading = false;
          this.dialogRef.close(created);
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err.error?.message || 'Failed to create expense voucher.';
        }
      });
    }
  }
}
