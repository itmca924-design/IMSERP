import { Component, OnInit, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { QuickSettingsService } from '../../core/services/quick-settings.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-fee-policy-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  template: `
    <div class="policy-modal-container">
      <!-- Strict IMSERP UI Header Standard: Light blue gradient header -->
      <header class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>gavel</mat-icon>
          </div>
          <div class="header-titles">
            <h2 class="main-title">Fee Late Fine Policy &amp; Receipt Notes</h2>
            <p class="subtitle">
              Configure <strong>Monthly Late Fine rules</strong>, due cutoffs, and <strong>Dynamic Bilingual Footer Notes</strong> for receipts &amp; due slips.
            </p>
          </div>
        </div>
        <button class="close-btn" (click)="dialogRef.close()" aria-label="Close dialog" mat-icon-button [disabled]="saving() || runningJob()">
          <mat-icon>close</mat-icon>
        </button>
      </header>

      @if (saving() || runningJob()) {
        <mat-progress-bar mode="indeterminate" class="dialog-loader"></mat-progress-bar>
      }

      <form [formGroup]="policyForm" (ngSubmit)="onSavePolicy()" class="policy-form">
        <div class="form-body">
          <!-- CARD 1: MONTHLY LATE FINE POLICY -->
          <div class="policy-card" [class.card-active]="policyForm.get('enableLateFine')?.value">
            <div class="card-header-row">
              <div class="card-title-group">
                <div class="badge-icon fine-badge">
                  <mat-icon>update</mat-icon>
                </div>
                <div>
                  <h3 class="card-title">Monthly Student Late Fine Policy</h3>
                  <p class="card-subtitle">Auto-calculate &amp; apply overdue fee penalty across receipts, due slips &amp; online portal.</p>
                  <div class="applicable-tags">
                    <span class="app-tag school"><mat-icon>school</mat-icon> School Classes</span>
                    <span class="app-tag coaching"><mat-icon>menu_book</mat-icon> Coaching Batches</span>
                    <span class="app-tag hybrid"><mat-icon>auto_awesome</mat-icon> Hybrid Students</span>
                  </div>
                </div>
              </div>
              <div class="toggle-control-box">
                <mat-slide-toggle formControlName="enableLateFine" color="primary">
                  <span class="toggle-state-text font-bold">
                    {{ policyForm.get('enableLateFine')?.value ? 'Late Fine Active' : 'Fine Disabled' }}
                  </span>
                </mat-slide-toggle>
              </div>
            </div>

            @if (policyForm.get('enableLateFine')?.value) {
              <div class="card-body-content">
                <!-- Quick Timing & Rule Presets -->
                <div class="preset-strip">
                  <span class="preset-label">Quick Presets:</span>
                  <button type="button" class="preset-chip" (click)="applyPreset(10, 'MonthlySlab', 50, 0)">
                    Standard: 10th Due • ₹50/mo Slab
                  </button>
                  <button type="button" class="preset-chip" (click)="applyPreset(10, 'Flat', 100, 0)">
                    10th Due • Flat ₹100 Fine
                  </button>
                  <button type="button" class="preset-chip" (click)="applyPreset(15, 'MonthlySlab', 100, 0)">
                    15th Due • ₹100/mo Slab
                  </button>
                </div>

                <div class="fields-grid">
                  <!-- Calculation Mode -->
                  <mat-form-field appearance="outline" class="col-full">
                    <mat-label>Late Fine Calculation Mode</mat-label>
                    <mat-select formControlName="lateFineMode">
                      <mat-option value="MonthlySlab">
                        <strong>Dynamic Monthly Slab:</strong> Overdue hone par har mahine ₹{{ policyForm.get('lateFineAmount')?.value || 50 }} multiply hoga (1m = ₹{{ policyForm.get('lateFineAmount')?.value || 50 }}, 2m = ₹{{ (policyForm.get('lateFineAmount')?.value || 50) * 2 }}, 3m = ₹{{ (policyForm.get('lateFineAmount')?.value || 50) * 3 }})
                      </mat-option>
                      <mat-option value="Flat">
                        <strong>Flat Fine (एकमुश्त):</strong> Overdue hone par flat ₹{{ policyForm.get('lateFineAmount')?.value || 50 }} ek bar add hoga
                      </mat-option>
                      <mat-option value="PerDay">
                        <strong>Per Day Fine (प्रतिदिन):</strong> Cutoff date ke baad har din ₹{{ policyForm.get('lateFineAmount')?.value || 10 }}/day judega
                      </mat-option>
                    </mat-select>
                    <mat-icon matPrefix>calculate</mat-icon>
                    <mat-hint>Choose whether penalty multiplies monthly, daily, or remains fixed.</mat-hint>
                  </mat-form-field>

                  <!-- Due Cutoff Day (10th) -->
                  <mat-form-field appearance="outline" class="col-half">
                    <mat-label>Monthly Fee Due Date (Cutoff Day)</mat-label>
                    <input matInput type="number" min="1" max="28" formControlName="dueCutoffDay" required>
                    <mat-icon matPrefix>event_available</mat-icon>
                    <mat-hint>e.g. 10th of every month (डिफ़ॉल्ट 10 तारीख)</mat-hint>
                  </mat-form-field>

                  <!-- Fine Amount (₹) -->
                  <mat-form-field appearance="outline" class="col-half">
                    <mat-label>Fine Amount (₹)</mat-label>
                    <input matInput type="number" min="1" max="5000" formControlName="lateFineAmount" required>
                    <mat-icon matPrefix>currency_rupee</mat-icon>
                    <mat-hint>Penalty amount in Rupees (e.g. ₹50)</mat-hint>
                  </mat-form-field>

                  <!-- Grace Days -->
                  <mat-form-field appearance="outline" class="col-full">
                    <mat-label>Grace Period Days (Cutoff ke baad chhoot ke din)</mat-label>
                    <input matInput type="number" min="0" max="15" formControlName="graceDays">
                    <mat-icon matPrefix>timer</mat-icon>
                    <mat-hint>0 = Fine applies immediately after {{ policyForm.get('dueCutoffDay')?.value || 10 }}th. 5 = Fine starts on {{ (policyForm.get('dueCutoffDay')?.value || 10) + 5 }}th.</mat-hint>
                  </mat-form-field>

                  <!-- Live Rule Preview Box (matching Attendance Policy screenshot) -->
                  <div class="col-full rule-live-preview">
                    <div class="preview-badge">
                      <mat-icon>verified</mat-icon>
                      <strong>Live Rule Preview (School, Coaching &amp; Hybrid):</strong>
                    </div>
                    <div class="preview-text">
                      @if (policyForm.get('lateFineMode')?.value === 'MonthlySlab') {
                        <span>
                          Agar student/parent har mahine ki <strong>{{ policyForm.get('dueCutoffDay')?.value || 10 }} tarikh</strong> tak fees jama nahi karta hai (aur {{ policyForm.get('graceDays')?.value || 0 }} din grace bitne par), toh aane wale mahine ke bill v dues me <strong>₹{{ policyForm.get('lateFineAmount')?.value || 50 }}</strong> late fine judega. Agar 2 mahine unpaid raha toh <strong>₹{{ (policyForm.get('lateFineAmount')?.value || 50) * 2 }}</strong>, aur 3 mahine par <strong>₹{{ (policyForm.get('lateFineAmount')?.value || 50) * 3 }}</strong> auto-add hoga.
                        </span>
                      }
                      @if (policyForm.get('lateFineMode')?.value === 'Flat') {
                        <span>
                          Agar student/parent har mahine ki <strong>{{ policyForm.get('dueCutoffDay')?.value || 10 }} tarikh</strong> tak fees jama nahi karta hai, toh overdue invoice par flat <strong>₹{{ policyForm.get('lateFineAmount')?.value || 50 }}</strong> late fine ek bar auto-add hoga.
                        </span>
                      }
                      @if (policyForm.get('lateFineMode')?.value === 'PerDay') {
                        <span>
                          Agar student/parent <strong>{{ policyForm.get('dueCutoffDay')?.value || 10 }} tarikh</strong> tak fees jama nahi karta hai, toh due date ke baad pratidin <strong>₹{{ policyForm.get('lateFineAmount')?.value || 10 }}/din</strong> late fine auto-add hoga.
                        </span>
                      }
                    </div>
                  </div>

                  <!-- Instant Action: Run Late Fee Auto-Compute Now -->
                  <div class="col-full compute-now-strip">
                    <div class="strip-text">
                      <mat-icon>auto_mode</mat-icon>
                      <span>Apply this fine policy to existing overdue student invoices immediately:</span>
                    </div>
                    <button
                      type="button"
                      class="compute-btn"
                      (click)="onRunLateFeeComputeNow()"
                      [disabled]="runningJob() || saving()"
                      mat-stroked-button>
                      <mat-icon [class.spinning]="runningJob()">{{ runningJob() ? 'sync' : 'bolt' }}</mat-icon>
                      <span>{{ runningJob() ? 'Applying Fine Rules...' : 'Run Late Fee Auto-Compute Now' }}</span>
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- CARD 2: DYNAMIC BILINGUAL RECEIPT & DUE SLIP FOOTER NOTES -->
          <div class="policy-card notes-card">
            <div class="card-header-row">
              <div class="card-title-group">
                <div class="badge-icon notes-badge">
                  <mat-icon>speaker_notes</mat-icon>
                </div>
                <div>
                  <h3 class="card-title">Dynamic Receipt &amp; Due Slip Footer Notes</h3>
                  <p class="card-subtitle">Custom official terms &amp; conditions in English and Hindi (100% Dynamic, Zero Hardcoding).</p>
                </div>
              </div>
            </div>

            <div class="card-body-content">
              <!-- Visibility Toggles -->
              <div class="visibility-toggles-row">
                <mat-slide-toggle formControlName="showFooterNoteOnReceipt" color="primary">
                  <span>Show on Paid Fee Receipts</span>
                </mat-slide-toggle>
                <mat-slide-toggle formControlName="showFooterNoteOnDueSlip" color="primary">
                  <span>Show on Fee Due Slips / Demand Notes</span>
                </mat-slide-toggle>
              </div>

              <!-- English Note Textarea -->
              <mat-form-field appearance="outline" class="w-100 field-block">
                <mat-label>English Footer Note (अंग्रेज़ी नोट)</mat-label>
                <textarea
                  matInput
                  rows="2"
                  formControlName="receiptFooterNoteEnglish"
                  placeholder="e.g. Fees once paid are non-refundable. Please keep this receipt safe for future academic reference."
                  maxlength="500"></textarea>
                <mat-icon matPrefix>translate</mat-icon>
                <mat-hint align="end">{{ (policyForm.get('receiptFooterNoteEnglish')?.value || '').length }} / 500</mat-hint>
              </mat-form-field>

              <!-- Hindi Note Textarea -->
              <mat-form-field appearance="outline" class="w-100 field-block">
                <mat-label>Hindi Footer Note (हिंदी नोट)</mat-label>
                <textarea
                  matInput
                  rows="2"
                  formControlName="receiptFooterNoteHindi"
                  placeholder="उदा. जमा किया गया शुल्क किसी भी परिस्थिति में वापस नहीं होगा। विलंब शुल्क से बचने हेतु 10 तारीख तक शुल्क जमा करें।"
                  maxlength="500"></textarea>
                <mat-icon matPrefix>edit_note</mat-icon>
                <mat-hint align="end">{{ (policyForm.get('receiptFooterNoteHindi')?.value || '').length }} / 500</mat-hint>
              </mat-form-field>

              <!-- Live Receipt Footer Preview -->
              <div class="receipt-preview-wrapper">
                <div class="preview-header-label">
                  <mat-icon>receipt</mat-icon>
                  <span>Live Receipt &amp; Slip Footer Print Preview:</span>
                </div>
                <div class="mock-receipt-footer">
                  @if (policyForm.get('receiptFooterNoteEnglish')?.value) {
                    <div class="note-line en-line">
                      <strong class="tag-en">Note:</strong> {{ policyForm.get('receiptFooterNoteEnglish')?.value }}
                    </div>
                  }
                  @if (policyForm.get('receiptFooterNoteHindi')?.value) {
                    <div class="note-line hi-line">
                      <strong class="tag-hi">नोट:</strong> {{ policyForm.get('receiptFooterNoteHindi')?.value }}
                    </div>
                  }
                  <div class="mock-computer-gen">
                    <span>Official Computer-Generated Document • Student Copy • IMSERP Management Suite</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Dialog Footer Actions -->
        <footer class="dialog-footer">
          <div class="footer-left">
            <span class="auto-save-hint">
              <mat-icon>security</mat-icon> 100% Multi-Tenant &amp; Branch Isolated
            </span>
          </div>
          <div class="footer-actions">
            <button
              type="button"
              mat-button
              class="cancel-btn"
              (click)="dialogRef.close()"
              [disabled]="saving() || runningJob()">
              Cancel
            </button>
            <button
              type="submit"
              mat-flat-button
              color="primary"
              class="save-btn"
              [disabled]="saving() || runningJob() || policyForm.invalid">
              <mat-icon>{{ saving() ? 'sync' : 'save' }}</mat-icon>
              <span>{{ saving() ? 'Saving Policies...' : 'Save Policy & Notes' }}</span>
            </button>
          </div>
        </footer>
      </form>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .policy-modal-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-sizing: border-box;
      width: 100%;
    }

    /* Strict IMSERP UI Header Rule matching generate-invoices-dialog */
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .header-icon-box {
      width: 44px;
      height: 44px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
      flex-shrink: 0;
    }

    .header-icon-box mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .header-titles .main-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: #1e3a8a;
      line-height: 1.25;
    }

    .header-titles .subtitle {
      margin: 3px 0 0;
      font-size: 0.8rem;
      color: #3b82f6;
    }

    .header-titles .subtitle strong {
      color: #1e40af;
    }

    .close-btn {
      color: #64748b;
      transition: color 0.2s ease;
    }

    .close-btn:hover {
      color: #1e293b;
    }

    .dialog-loader {
      height: 3px;
    }

    /* Form Layout */
    .policy-form {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow-y: auto;
    }

    .form-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      box-sizing: border-box;
    }

    /* Cards */
    .policy-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #ffffff;
      padding: 18px;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .policy-card.card-active {
      border-color: #93c5fd;
      box-shadow: 0 4px 12px -2px rgba(59, 130, 246, 0.08);
    }

    .card-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
    }

    .card-title-group {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      flex: 1;
      min-width: 260px;
    }

    .badge-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .fine-badge {
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
    }

    .notes-badge {
      background: #f0fdf4;
      color: #16a34a;
      border: 1px solid #bbf7d0;
    }

    .card-title {
      margin: 0;
      font-size: 1.02rem;
      font-weight: 700;
      color: #0f172a;
    }

    .card-subtitle {
      margin: 3px 0 0;
      font-size: 0.78rem;
      color: #64748b;
    }

    .applicable-tags {
      display: flex;
      gap: 6px;
      margin-top: 8px;
      flex-wrap: wrap;
    }

    .app-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.68rem;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 4px;
    }

    .app-tag mat-icon {
      font-size: 13px;
      width: 13px;
      height: 13px;
    }

    .app-tag.school {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }

    .app-tag.coaching {
      background: #faf5ff;
      color: #7e22ce;
      border: 1px solid #e9d5ff;
    }

    .app-tag.hybrid {
      background: #f0fdf4;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }

    .toggle-state-text {
      font-size: 0.85rem;
      color: #1e3a8a;
      margin-left: 6px;
    }

    .card-body-content {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px dashed #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Preset Strip */
    .preset-strip {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      background: #f8fafc;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #f1f5f9;
    }

    .preset-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: #475569;
    }

    .preset-chip {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 600;
      color: #1e293b;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .preset-chip:hover {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #1d4ed8;
    }

    /* Fields Grid */
    .fields-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .col-full {
      grid-column: 1 / -1;
    }

    .col-half {
      grid-column: span 1;
    }

    .w-100 {
      width: 100%;
    }

    /* Live Rule Preview Box */
    .rule-live-preview {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .preview-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #1e3a8a;
      font-size: 0.8rem;
    }

    .preview-badge mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2563eb;
    }

    .preview-text {
      font-size: 0.82rem;
      color: #1e40af;
      line-height: 1.45;
    }

    .preview-text strong {
      color: #0f172a;
      font-weight: 700;
    }

    /* Compute Now Action Strip */
    .compute-now-strip {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    .strip-text {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.78rem;
      color: #475569;
      font-weight: 500;
    }

    .strip-text mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #3b82f6;
    }

    .compute-btn {
      font-size: 0.76rem !important;
      font-weight: 600 !important;
      border-color: #3b82f6 !important;
      color: #1d4ed8 !important;
      background: #ffffff !important;
      border-radius: 6px !important;
    }

    .compute-btn:hover {
      background: #eff6ff !important;
    }

    /* Visibility Toggles */
    .visibility-toggles-row {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      background: #f8fafc;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    /* Mock Receipt Footer Preview */
    .receipt-preview-wrapper {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .preview-header-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      color: #334155;
    }

    .preview-header-label mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #0284c7;
    }

    .mock-receipt-footer {
      background: #ffffff;
      border: 1px dashed #94a3b8;
      border-radius: 6px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .note-line {
      font-size: 0.76rem;
      line-height: 1.35;
    }

    .en-line {
      color: #1e293b;
    }

    .hi-line {
      color: #334155;
    }

    .tag-en {
      color: #1d4ed8;
      font-weight: 700;
      margin-right: 4px;
    }

    .tag-hi {
      color: #b91c1c;
      font-weight: 700;
      margin-right: 4px;
    }

    .mock-computer-gen {
      border-top: 1px solid #e2e8f0;
      margin-top: 4px;
      padding-top: 4px;
      text-align: center;
      font-size: 0.65rem;
      color: #94a3b8;
    }

    /* Footer */
    .dialog-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      position: sticky;
      bottom: 0;
      z-index: 10;
      flex-wrap: wrap;
      gap: 12px;
    }

    .auto-save-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      color: #64748b;
      font-weight: 500;
    }

    .auto-save-hint mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #10b981;
    }

    .footer-actions {
      display: flex;
      gap: 10px;
    }

    .cancel-btn {
      color: #64748b !important;
      font-weight: 600 !important;
    }

    .save-btn {
      background: #2563eb !important;
      color: #ffffff !important;
      font-weight: 600 !important;
      border-radius: 8px !important;
      padding: 0 20px !important;
    }

    .spinning {
      animation: spin 1.2s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Responsive Design Across All Devices */
    @media (max-width: 640px) {
      .dialog-header {
        padding: 12px 14px;
      }
      .header-icon-box {
        width: 36px;
        height: 36px;
      }
      .header-titles .main-title {
        font-size: 1rem;
      }
      .form-body {
        padding: 12px;
        gap: 14px;
      }
      .fields-grid {
        grid-template-columns: 1fr;
      }
      .col-half {
        grid-column: span 1;
      }
      .card-header-row {
        flex-direction: column;
      }
      .dialog-footer {
        padding: 10px 14px;
      }
      .footer-actions {
        width: 100%;
        justify-content: flex-end;
      }
    }
  `]
})
export class FeePolicyDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<FeePolicyDialogComponent>);
  private fb = inject(FormBuilder);
  private quickSettingsService = inject(QuickSettingsService);
  private confirmDialog = inject(ConfirmDialogService);

  readonly saving = signal<boolean>(false);
  readonly runningJob = signal<boolean>(false);

  policyForm!: FormGroup;

  ngOnInit(): void {
    const s = this.quickSettingsService;
    const b = s.backendSettings();

    this.policyForm = this.fb.group({
      enableLateFine: [s.lateFeeCalc()],
      dueCutoffDay: [s.lateFineDueCutoffDay() || 10, [Validators.required, Validators.min(1), Validators.max(28)]],
      lateFineMode: [s.lateFineMode() || 'MonthlySlab', Validators.required],
      lateFineAmount: [s.lateFineAmount() >= 0 ? s.lateFineAmount() : 50, [Validators.required, Validators.min(0)]],
      graceDays: [s.lateFeeGraceDays() >= 0 ? s.lateFeeGraceDays() : 0, [Validators.min(0), Validators.max(30)]],
      receiptFooterNoteEnglish: [s.receiptFooterNoteEnglish() || ''],
      receiptFooterNoteHindi: [s.receiptFooterNoteHindi() || ''],
      showFooterNoteOnReceipt: [s.showFooterNoteOnReceipt()],
      showFooterNoteOnDueSlip: [s.showFooterNoteOnDueSlip()]
    });
  }

  applyPreset(cutoffDay: number, mode: 'MonthlySlab' | 'Flat' | 'PerDay', amount: number, grace: number): void {
    this.policyForm.patchValue({
      dueCutoffDay: cutoffDay,
      lateFineMode: mode,
      lateFineAmount: amount,
      graceDays: grace
    });
  }

  onRunLateFeeComputeNow(): void {
    if (!this.policyForm.get('enableLateFine')?.value) {
      this.confirmDialog.alert(
        'Late Fine Policy is Disabled',
        'Please enable the "Late Fine Active" toggle above before running late fee computation.'
      );
      return;
    }

    this.confirmDialog.confirm(
      'Run Late Fee Computation?',
      'This will evaluate all overdue student invoices against your configured cutoff policy and apply late fine penalties. Proceed?'
    ).subscribe(confirmed => {
      if (!confirmed) return;

      this.runningJob.set(true);
      // Save current policy first, then run job
      this.quickSettingsService.updateFeePolicySettings({
        lateFeeAutoComputeEnabled: this.policyForm.value.enableLateFine,
        lateFineMode: this.policyForm.value.lateFineMode,
        lateFineDueCutoffDay: this.policyForm.value.dueCutoffDay,
        lateFineAmount: this.policyForm.value.lateFineAmount,
        lateFeeGraceDays: this.policyForm.value.graceDays,
        receiptFooterNoteEnglish: this.policyForm.value.receiptFooterNoteEnglish,
        receiptFooterNoteHindi: this.policyForm.value.receiptFooterNoteHindi,
        showFooterNoteOnReceipt: this.policyForm.value.showFooterNoteOnReceipt,
        showFooterNoteOnDueSlip: this.policyForm.value.showFooterNoteOnDueSlip
      }).subscribe({
        next: () => {
          this.quickSettingsService.runJob('late-fee').subscribe({
            next: (res) => {
              this.runningJob.set(false);
              this.confirmDialog.alert(
                res.success ? 'Late Fee Computation Completed' : 'Job Status',
                res.message || 'Late fine policy successfully evaluated across overdue student invoices.'
              );
            },
            error: (err) => {
              this.runningJob.set(false);
              this.confirmDialog.alert('Calculation Error', 'Failed to execute late fee auto-computation: ' + (err?.error?.message || err?.message || 'Server error'));
            }
          });
        },
        error: (err) => {
          this.runningJob.set(false);
          this.confirmDialog.alert('Save Error', 'Failed to save policy settings before computation: ' + (err?.error?.message || err?.message));
        }
      });
    });
  }

  onSavePolicy(): void {
    if (this.policyForm.invalid) return;

    this.saving.set(true);
    const formVal = this.policyForm.value;

    this.quickSettingsService.updateFeePolicySettings({
      lateFeeAutoComputeEnabled: formVal.enableLateFine,
      lateFineMode: formVal.lateFineMode,
      lateFineDueCutoffDay: formVal.dueCutoffDay,
      lateFineAmount: formVal.lateFineAmount,
      lateFeeGraceDays: formVal.graceDays,
      receiptFooterNoteEnglish: formVal.receiptFooterNoteEnglish,
      receiptFooterNoteHindi: formVal.receiptFooterNoteHindi,
      showFooterNoteOnReceipt: formVal.showFooterNoteOnReceipt,
      showFooterNoteOnDueSlip: formVal.showFooterNoteOnDueSlip
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirmDialog.alert(
          'Settings Saved Successfully',
          'Fee late fine rules and dynamic receipt footer notes have been updated and are active across all branches.'
        );
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.saving.set(false);
        this.confirmDialog.alert(
          'Save Error',
          'Could not save fee policy settings: ' + (err?.error?.message || err?.message || 'Server error')
        );
      }
    });
  }
}
