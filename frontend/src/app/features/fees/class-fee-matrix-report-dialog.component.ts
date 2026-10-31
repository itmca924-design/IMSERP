import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FeesService, FeeHead, ClassFeeStructureItem } from '../../core/services/fees.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';
import { environment } from '../../../environments/environment';

export interface ClassFeeMatrixReportDialogData {
  initialTargetType?: 'class' | 'batch';
  initialClassId?: string;
  initialBatchId?: string;
}

interface TargetItem {
  id: string;
  name: string;
  code?: string;
}

interface MatrixColumn {
  id: string;
  code: string;
  name: string;
  category: string;
  frequency: string;
}

interface ConsolidatedMatrixRow {
  targetId: string;
  targetName: string;
  amounts: { [feeHeadId: string]: number };
  totalMonthly: number;
  totalAnnualExtras: number;
  grandAnnualEstimate: number;
}

@Component({
  selector: 'app-class-fee-matrix-report-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressBarModule,
    IstDatetimeDirective
  ],
  template: `
    <div class="matrix-modal-container">
      <!-- ─── Top Control Bar (Screen Only) ───────────────────────────────── -->
      <div class="modal-top-bar no-print">
        <div class="header-row">
          <div class="dialog-header-info">
            <div class="header-icon-box">
              <mat-icon>grid_view</mat-icon>
            </div>
            <div class="header-title-group">
              <h2 class="main-title">Class Fee Matrix &amp; Schedule (कक्षा-वार फ़ीस)</h2>
              <p class="sub-title">
                Fee matrix across classes &bull;
                <strong>{{ instituteName }}</strong>
              </p>
            </div>
          </div>
          <!-- Close button on Mobile sits in the top row -->
          <button mat-icon-button class="close-btn close-btn-mobile" (click)="dialogRef.close()" matTooltip="Close Window">
            <mat-icon>close</mat-icon>
          </button>
        </div>
    
        <div class="top-actions">
          <button mat-flat-button color="primary" class="action-btn print-btn" (click)="printReport()">
            <mat-icon>print</mat-icon>
            <span>Print Report</span>
          </button>
          <button mat-stroked-button class="action-btn excel-btn" (click)="exportToCsv()" matTooltip="Download as Excel/CSV">
            <mat-icon>download</mat-icon>
            <span>Export CSV</span>
          </button>
          <!-- Close button on Desktop sits with action buttons -->
          <button mat-icon-button class="close-btn close-btn-desktop" (click)="dialogRef.close()" matTooltip="Close Window">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>
    
      <!-- ─── Filter & View Switcher Strip (Screen Only) ───────────────────── -->
      <div class="control-strip no-print">
        <div class="control-row-left">
          <!-- Scope Switcher: School vs Coaching -->
          @if (hasSchoolModule && hasCoachingModule) {
            <div class="pill-group scope-pills">
              <button type="button"
                class="scope-pill"
                [class.active]="targetType === 'class'"
                (click)="setTargetType('class')">
                <mat-icon>school</mat-icon>
                <span>School Classes</span>
                <span class="badge">{{ schoolClasses.length }}</span>
              </button>
              <button type="button"
                class="scope-pill"
                [class.active]="targetType === 'batch'"
                (click)="setTargetType('batch')">
                <mat-icon>groups</mat-icon>
                <span>Coaching Batches</span>
                <span class="badge">{{ coachingBatches.length }}</span>
              </button>
            </div>
          }
    
          <!-- View Mode: Consolidated Matrix vs Single Class Notice -->
          <div class="pill-group view-pills">
            <button type="button"
              class="view-pill"
              [class.active]="viewMode === 'consolidated'"
              (click)="viewMode = 'consolidated'">
              <mat-icon>table_chart</mat-icon>
              <span class="desktop-text">Consolidated Matrix (पूरा स्कूल तालिका)</span>
              <span class="mobile-text">Matrix Grid (तालिका)</span>
            </button>
            <button type="button"
              class="view-pill"
              [class.active]="viewMode === 'single'"
              (click)="viewMode = 'single'">
              <mat-icon>receipt_long</mat-icon>
              <span class="desktop-text">Class Fee Notice (कक्षा फ़ीस नोटिस)</span>
              <span class="mobile-text">Class Notice (नोटिस)</span>
            </button>
          </div>
    
          <!-- Class Dropdown (for Single Class Notice, or optional filter for Consolidated) -->
          @if (viewMode === 'single' || targets.length > 0) {
            <mat-form-field appearance="outline" class="select-field">
              <mat-label>{{ targetType === 'class' ? 'Select Class' : 'Select Batch' }}</mat-label>
              <mat-select [(ngModel)]="selectedTargetId" (selectionChange)="onTargetChange()">
                @if (viewMode === 'consolidated') {
                  <mat-option value="ALL">All {{ targetType === 'class' ? 'Classes' : 'Batches' }} (Consolidated)</mat-option>
                }
                @for (t of targets; track t) {
                  <mat-option [value]="t.id">{{ t.name }} {{ t.code ? '(' + t.code + ')' : '' }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }
        </div>
    
        @if (viewMode === 'consolidated') {
          <div class="status-summary">
            Active Classes: <strong>{{ matrixRows.length }}</strong> &bull; Columns: <strong>{{ matrixColumns.length }} Fee Heads</strong>
          </div>
        }
      </div>
    
      <!-- Single Progress Bar -->
      @if (loading) {
        <mat-progress-bar mode="indeterminate" class="loading-bar"></mat-progress-bar>
      }
    
      <!-- ─── Printable Document ───────────────────────────────────────────── -->
      <div class="printable-document" [class.landscape-doc]="viewMode === 'consolidated'">
    
        <!-- Official Institute Letterhead -->
        <div class="doc-header">
          @if (instituteLogo) {
            <div class="inst-logo-wrap">
              <img [src]="instituteLogo" alt="Logo" class="inst-logo" />
            </div>
          }
          <div class="inst-text-wrap">
            <h1 class="inst-name">{{ instituteName }}</h1>
            @if (affiliationNumber) {
              <p class="inst-sub">
                Affiliation / Reg. No.: <strong>{{ affiliationNumber }}</strong>
              </p>
            }
            @if (campusAddress) {
              <p class="inst-address">{{ campusAddress }}</p>
            }
            @if (contactInfo) {
              <p class="inst-contact">{{ contactInfo }}</p>
            }
          </div>
        </div>
    
        <!-- Document Title Banner -->
        <div class="doc-title-banner">
          @if (viewMode === 'consolidated') {
            <div class="doc-title-text">
              CONSOLIDATED {{ targetType === 'class' ? 'SCHOOL CLASSES' : 'COACHING BATCHES' }} FEE STRUCTURE MATRIX
            </div>
          }
          @if (viewMode === 'single') {
            <div class="doc-title-text">
              OFFICIAL FEE SCHEDULE NOTICE &bull; {{ currentTargetName }}
            </div>
          }
          <div class="doc-title-hi">
            {{ viewMode === 'consolidated' ? 'कक्षा-वार समेकित शुल्क संरचना तालिका' : 'कक्षावार अधिकृत शुल्क विवरण एवं नियम' }}
          </div>
        </div>
    
        <!-- Meta Summary Strip -->
        <div class="doc-meta-strip">
          <div class="meta-item">
            <span class="lbl">Academic Session:</span>
            <span class="val"><strong>{{ academicSession }}</strong></span>
          </div>
          <div class="meta-item">
            <span class="lbl">Campus / Branch:</span>
            <span class="val">{{ branchName }}</span>
          </div>
          @if (viewMode === 'single') {
            <div class="meta-item">
              <span class="lbl">{{ targetType === 'class' ? 'Class' : 'Batch' }}:</span>
              <span class="val highlighted"><strong>{{ currentTargetName }}</strong></span>
            </div>
          }
          <div class="meta-item">
            <span class="lbl">Effective Date:</span>
            <span class="val" [appIstDatetime]="nowDate" [format]="'date'"></span>
          </div>
        </div>
    
        <!-- ══════════ VIEW 1: CONSOLIDATED MATRIX TABLE (A4 Landscape) ══════════ -->
        @if (viewMode === 'consolidated') {
          <div class="consolidated-table-wrap">
            <div class="mobile-scroll-hint no-print">
              <mat-icon>swipe</mat-icon>
              <span>Swipe sideways to view all columns &bull; तालिका दाएं-बाएं स्क्रॉल करें</span>
            </div>
            <table class="matrix-table">
              <thead>
                <tr>
                  <th class="th-sno">#</th>
                  <th class="th-target">{{ targetType === 'class' ? 'Class Name' : 'Batch Name' }}</th>
                  @for (col of matrixColumns; track col) {
                    <th class="th-head-col">
                      <div class="head-col-title" [matTooltip]="col.name">{{ col.name }}</div>
                      <div class="head-col-meta">({{ col.code }} &bull; {{ col.frequency }})</div>
                    </th>
                  }
                  <th class="th-monthly-tot">Total Monthly (₹)</th>
                  <th class="th-annual-extras">Annual Extras (₹)</th>
                  <th class="th-grand-tot">Grand Annual Est. (₹)</th>
                </tr>
              </thead>
              <tbody>
                @for (r of matrixRows; track r; let idx = $index) {
                  <tr>
                    <td class="td-sno">{{ idx + 1 }}</td>
                    <td class="td-target">
                      <strong>{{ r.targetName }}</strong>
                    </td>
                    @for (col of matrixColumns; track col) {
                      <td class="td-amt">
                        @if (r.amounts[col.id] > 0) {
                          <span>₹{{ r.amounts[col.id] | number:'1.2-2' }}</span>
                        }
                        @if (!r.amounts[col.id] || r.amounts[col.id] === 0) {
                          <span class="nil-dash">—</span>
                        }
                      </td>
                    }
                    <td class="td-monthly-tot">
                      <strong>₹{{ r.totalMonthly | number:'1.2-2' }}</strong>
                    </td>
                    <td class="td-annual-extras">
                      <span>₹{{ r.totalAnnualExtras | number:'1.2-2' }}</span>
                    </td>
                    <td class="td-grand-tot">
                      <strong class="grand-num">₹{{ r.grandAnnualEstimate | number:'1.2-2' }}</strong>
                    </td>
                  </tr>
                }
                @if (matrixRows.length === 0) {
                  <tr>
                    <td [attr.colspan]="matrixColumns.length + 5" class="empty-cell">
                      No fee structure configured for the selected classes.
                    </td>
                  </tr>
                }
              </tbody>
              <!-- Footer Row for Column Sums -->
              @if (matrixRows.length > 0) {
                <tfoot>
                  <tr class="tfoot-row">
                    <td colspan="2" class="td-tot-label">Consolidated Total / Average:</td>
                    @for (col of matrixColumns; track col) {
                      <td class="td-tot-amt">
                        ₹{{ getColumnTotal(col.id) | number:'1.2-2' }}
                      </td>
                    }
                    <td class="td-monthly-tot">
                      ₹{{ getMonthlySumTotal() | number:'1.2-2' }}
                    </td>
                    <td class="td-annual-extras">
                      ₹{{ getAnnualExtrasSumTotal() | number:'1.2-2' }}
                    </td>
                    <td class="td-grand-tot">
                      <strong>₹{{ getGrandAnnualSumTotal() | number:'1.2-2' }}</strong>
                    </td>
                  </tr>
                </tfoot>
              }
            </table>
          </div>
        }
    
        <!-- ══════════ VIEW 2: SINGLE CLASS NOTICE / BREAKDOWN (A4 Portrait) ══════════ -->
        @if (viewMode === 'single') {
          <div class="single-class-notice-wrap">
            <div class="single-target-banner">
              <span class="target-badge">{{ targetType === 'class' ? 'Class' : 'Batch' }}: <strong>{{ currentTargetName }}</strong></span>
              <span class="target-desc">Approved Fee Schedule for Academic Year {{ academicSession }}</span>
            </div>
            <div class="single-table-wrap">
              <div class="mobile-scroll-hint no-print">
                <mat-icon>swipe</mat-icon>
                <span>Swipe sideways if columns overflow &bull; विवरण दाएं-बाएं स्क्रॉल करें</span>
              </div>
              <table class="single-breakdown-table">
                <thead>
                  <tr>
                    <th class="th-sno">#</th>
                    <th class="th-code">Code</th>
                    <th class="th-pname">Fee Head Particulars</th>
                    <th class="th-pcat">Category</th>
                    <th class="th-pfreq">Frequency</th>
                    <th class="th-pmonth">Due / Applicable Month</th>
                    <th class="th-pamt">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of singleClassItems; track item; let idx = $index) {
                    <tr>
                      <td class="td-sno">{{ idx + 1 }}</td>
                      <td class="td-code"><span class="code-badge">{{ item.feeHeadCode }}</span></td>
                      <td class="td-pname"><strong>{{ item.feeHeadName }}</strong></td>
                      <td class="td-pcat"><span class="cat-tag">{{ item.category }}</span></td>
                      <td class="td-pfreq"><span class="freq-tag">{{ item.frequency }}</span></td>
                      <td class="td-pmonth">{{ getMonthName(item.applicableMonth) }}</td>
                      <td class="td-pamt"><strong>₹{{ item.amount | number:'1.2-2' }}</strong></td>
                    </tr>
                  }
                  @if (singleClassItems.length === 0) {
                    <tr>
                      <td colspan="7" class="empty-cell">No fee heads mapped to this class yet.</td>
                    </tr>
                  }
                </tbody>
                @if (singleClassItems.length > 0) {
                  <tfoot>
                    <tr class="single-sum-row">
                      <td colspan="6" class="sum-lbl">Total Recurring Monthly Billing (मासिक शुल्क):</td>
                      <td class="sum-amt">₹{{ singleMonthlyTotal | number:'1.2-2' }} / month</td>
                    </tr>
                    <tr class="single-sum-row extras-row">
                      <td colspan="6" class="sum-lbl">Annual / One-Time / Term Extras (वार्षिक अन्य शुल्क):</td>
                      <td class="sum-amt">₹{{ singleAnnualExtras | number:'1.2-2' }}</td>
                    </tr>
                    <tr class="single-sum-row grand-row">
                      <td colspan="6" class="sum-lbl">Estimated Annual Investment (कुल वार्षिक अनुमानित):</td>
                      <td class="sum-amt grand-val">₹{{ (singleMonthlyTotal * 12 + singleAnnualExtras) | number:'1.2-2' }}</td>
                    </tr>
                  </tfoot>
                }
              </table>
            </div>
            <!-- Payment Rules & Settlement Details -->
            @if (bankAccountInfo || upiInfo) {
              <div class="billing-rules-box">
                <h4 class="rules-title"><mat-icon>payment</mat-icon> Authorized Mode of Payment:</h4>
                <div class="payment-credentials-row">
                  @if (bankAccountInfo) {
                    <div class="cred-cell">
                      <span class="cred-lbl">Bank Settlement Account:</span>
                      <span class="cred-val">{{ bankAccountInfo }}</span>
                    </div>
                  }
                  @if (upiInfo) {
                    <div class="cred-cell">
                      <span class="cred-lbl">Official UPI ID:</span>
                      <span class="cred-val">{{ upiInfo }}</span>
                    </div>
                  }
                </div>
                <p class="rules-note">&bull; Fees must be deposited on or before the due date specified on the monthly invoice. Late fee fine is applicable thereafter as per institute policy.</p>
              </div>
            }
          </div>
        }
    
        <!-- ─── Signatures & Verification Stamp Block ───────────────────────── -->
        <div class="doc-footer-block">
          <div class="footer-note">
            <p><strong>Verification Statement:</strong> The above fee structure has been reviewed and ratified by the Management and Finance Committee. Any unauthorized alteration renders this schedule void.</p>
            <p class="gen-time">Generated on: <span [appIstDatetime]="nowDate" [format]="'datetime'"></span> (IST Asia/Kolkata)</p>
          </div>
    
          <div class="auth-signatures-group">
            <!-- Prepared By -->
            <div class="sig-card">
              <div class="sig-space"></div>
              <div class="sig-line"></div>
              <span class="sig-title">Accounts / Billing Officer</span>
              <span class="sig-subtitle">Prepared &amp; Verified</span>
            </div>
    
            <!-- Official Seal (Stamp) -->
            @if (officialSealUrl) {
              <div class="seal-card">
                <img [src]="officialSealUrl" alt="Official Seal" class="seal-image" />
                <span class="seal-label">Official Seal</span>
              </div>
            }
    
            <!-- Controller / Principal Sign -->
            <div class="sig-card controller-card">
              <div class="sig-space">
                @if (digitalSignatureUrl) {
                  <img [src]="digitalSignatureUrl" alt="Signature" class="sig-image" />
                }
              </div>
              <div class="sig-line"></div>
              <span class="sig-title">Principal / Director</span>
              <span class="sig-subtitle">Authorized Signatory</span>
            </div>
          </div>
        </div>
    
      </div>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .matrix-modal-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      overflow-y: auto;
      background: #f8fafc;
      color: #0f172a;

      @media (max-width: 640px) {
        max-height: 100vh;
        height: 100vh;
      }
    }

    /* ─── Light Blue Gradient Header ────────────────────────────────────── */
    .modal-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 24px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      position: sticky;
      top: 0;
      z-index: 10;

      .header-row {
        display: flex;
        align-items: center;
        gap: 14px;
        flex: 1;
        min-width: 0;
      }

      .dialog-header-info {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
        flex: 1;
      }

      .header-icon-box {
        background: #2563eb;
        color: #ffffff;
        width: 44px;
        height: 44px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
        flex-shrink: 0;
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }

      .header-title-group {
        min-width: 0;
        .main-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.3;
          word-break: break-word;
        }
        .sub-title {
          margin: 3px 0 0;
          font-size: 0.8rem;
          color: #3b82f6;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          strong { color: #1e40af; font-weight: 600; }
        }
      }

      .close-btn-mobile {
        display: none;
      }

      .close-btn-desktop {
        display: inline-flex;
      }

      .top-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;

        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          border-radius: 8px;
          padding: 0 16px;
          height: 38px;
          white-space: nowrap;
        }

        .print-btn {
          background: #2563eb;
          color: #ffffff;
          &:hover { background: #1d4ed8; }
        }

        .excel-btn {
          border-color: #cbd5e1;
          color: #334155;
          background: #ffffff;
          &:hover { background: #f1f5f9; }
        }

        .close-btn {
          color: #64748b;
          &:hover { color: #1e293b; background: rgba(0,0,0,0.05); }
        }
      }

      @media (max-width: 640px) {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
        padding: 12px 14px;

        .header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          width: 100%;
          gap: 8px;
        }

        .header-icon-box {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
        }

        .header-title-group {
          .main-title {
            font-size: 0.96rem;
            line-height: 1.25;
          }
          .sub-title {
            font-size: 0.72rem;
            white-space: normal;
            line-height: 1.2;
          }
        }

        .close-btn-mobile {
          display: inline-flex;
          color: #64748b;
          margin: -6px -6px 0 0;
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
        }

        .close-btn-desktop {
          display: none !important;
        }

        .top-actions {
          width: 100%;
          display: flex;
          gap: 8px;

          .action-btn {
            flex: 1;
            justify-content: center;
            padding: 0 8px;
            font-size: 0.8rem;
            height: 36px;
            gap: 4px;
            mat-icon { font-size: 18px; width: 18px; height: 18px; }
          }
        }
      }
    }

    /* ─── Control Strip ────────────────────────────────────────────────── */
    .control-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 24px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;

      .control-row-left {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
        flex: 1;
        min-width: 0;
      }

      .pill-group {
        display: inline-flex;
        background: #f1f5f9;
        padding: 3px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;

        button {
          border: none;
          background: transparent;
          font-size: 0.8rem;
          font-weight: 600;
          color: #64748b;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
          white-space: nowrap;

          mat-icon { font-size: 17px; width: 17px; height: 17px; }

          .badge {
            background: #cbd5e1;
            color: #0f172a;
            font-size: 0.68rem;
            padding: 1px 6px;
            border-radius: 10px;
          }

          &.active {
            background: #ffffff;
            color: #2563eb;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            .badge { background: #2563eb; color: #ffffff; }
          }
        }
      }

      .view-pills button.active {
        color: #0f172a;
      }

      .mobile-text { display: none; }
      .desktop-text { display: inline; }

      .select-field {
        width: 220px;
        margin-bottom: -1.25em;
        ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
      }

      .status-summary {
        font-size: 0.82rem;
        color: #64748b;
        background: #f8fafc;
        padding: 6px 12px;
        border-radius: 20px;
        border: 1px solid #e2e8f0;
        white-space: nowrap;
        strong { color: #0f172a; }
      }

      @media (max-width: 768px) {
        padding: 10px 14px;
        flex-direction: column;
        align-items: stretch;
        gap: 10px;

        .control-row-left {
          flex-direction: column;
          align-items: stretch;
          width: 100%;
          gap: 10px;
        }

        .pill-group {
          display: flex;
          width: 100%;
          box-sizing: border-box;

          button {
            flex: 1;
            justify-content: center;
            padding: 6px 6px;
            font-size: 0.76rem;
            gap: 4px;
            mat-icon { font-size: 16px; width: 16px; height: 16px; }
          }
        }

        .mobile-text { display: inline; }
        .desktop-text { display: none; }

        .select-field {
          width: 100% !important;
          margin-bottom: 0;
        }

        .status-summary {
          width: 100%;
          text-align: center;
          white-space: normal;
          font-size: 0.74rem;
          padding: 5px 8px;
          box-sizing: border-box;
        }
      }
    }

    .loading-bar { height: 3px; }

    /* ─── Mobile Horizontal Scroll Indicator ───────────────────────────── */
    .mobile-scroll-hint {
      display: none;
      @media (max-width: 768px) {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: #eff6ff;
        color: #2563eb;
        font-size: 0.72rem;
        font-weight: 600;
        padding: 6px 10px;
        border-radius: 6px;
        margin-bottom: 8px;
        border: 1px dashed #bfdbfe;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
    }

    /* ─── Printable Document ───────────────────────────────────────────── */
    .printable-document {
      margin: 20px auto;
      padding: 32px 36px;
      background: #ffffff;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      width: 94%;
      max-width: 1080px;
      box-sizing: border-box;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;

      &.landscape-doc {
        max-width: 1280px;
        width: 96%;
      }

      @media (max-width: 768px) {
        width: 100% !important;
        max-width: 100% !important;
        margin: 6px 0 !important;
        padding: 12px 10px !important;
        border-radius: 0 !important;
        border-left: none !important;
        border-right: none !important;
        box-shadow: none !important;
      }
    }

    .doc-header {
      display: flex;
      align-items: center;
      gap: 20px;
      padding-bottom: 14px;
      border-bottom: 2px solid #0f172a;

      .inst-logo-wrap {
        width: 68px;
        height: 68px;
        border-radius: 8px;
        overflow: hidden;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        img { width: 100%; height: 100%; object-fit: contain; }
      }

      .inst-text-wrap {
        flex: 1;
        .inst-name {
          margin: 0;
          font-size: 1.45rem;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .inst-sub, .inst-address, .inst-contact {
          margin: 2px 0 0;
          font-size: 0.82rem;
          color: #475569;
        }
      }

      @media (max-width: 640px) {
        flex-direction: column;
        text-align: center;
        gap: 8px;
        padding-bottom: 10px;

        .inst-logo-wrap {
          width: 50px;
          height: 50px;
          margin: 0 auto;
        }

        .inst-name {
          font-size: 1.15rem !important;
          letter-spacing: 0;
        }

        .inst-sub, .inst-address, .inst-contact {
          font-size: 0.72rem !important;
        }
      }
    }

    .doc-title-banner {
      background: #0f172a;
      color: #ffffff;
      text-align: center;
      padding: 9px 16px;
      margin: 14px 0 10px;
      border-radius: 6px;
      .doc-title-text {
        font-size: 1rem;
        font-weight: 800;
        letter-spacing: 1px;
      }
      .doc-title-hi {
        font-size: 0.76rem;
        opacity: 0.88;
        margin-top: 2px;
      }

      @media (max-width: 640px) {
        padding: 7px 8px;
        margin: 10px 0 8px;

        .doc-title-text {
          font-size: 0.85rem !important;
          letter-spacing: 0.5px;
          line-height: 1.25;
        }
        .doc-title-hi {
          font-size: 0.68rem !important;
        }
      }
    }

    .doc-meta-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 14px;
      background: #f1f5f9;
      border-radius: 6px;
      margin-bottom: 14px;
      border: 1px solid #e2e8f0;
      flex-wrap: wrap;
      gap: 8px;

      .meta-item {
        font-size: 0.8rem;
        .lbl { color: #64748b; margin-right: 4px; }
        .val { color: #0f172a; font-weight: 600; }
        .highlighted { color: #2563eb; }
      }

      @media (max-width: 640px) {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 10px;
        padding: 8px 10px;
        margin-bottom: 10px;

        .meta-item {
          font-size: 0.72rem;
          .lbl { display: block; font-size: 0.65rem; color: #64748b; margin-bottom: 1px; }
          .val { font-size: 0.74rem; font-weight: 700; word-break: break-word; }
        }
      }
    }

    /* ─── Consolidated Table Styling ───────────────────────────────────── */
    .consolidated-table-wrap,
    .single-table-wrap {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      margin-bottom: 20px;
      width: 100%;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }

    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;

      thead {
        background: #f8fafc;
        tr th {
          padding: 8px 6px;
          border: 1px solid #cbd5e1;
          color: #0f172a;
          font-weight: 700;
          text-align: center;
          vertical-align: middle;
          white-space: nowrap;
        }

        .th-sno { width: 30px; }
        .th-target { width: 140px; text-align: left; padding-left: 8px; }
        .th-head-col {
          min-width: 95px;
          .head-col-title { font-size: 0.75rem; font-weight: 700; }
          .head-col-meta { font-size: 0.65rem; color: #64748b; font-weight: normal; }
        }
        .th-monthly-tot { background: #ecfdf5; color: #047857; min-width: 105px; font-weight: 800; }
        .th-annual-extras { background: #fdf4ff; color: #86198f; min-width: 105px; }
        .th-grand-tot { background: #eff6ff; color: #1e40af; min-width: 120px; font-weight: 800; }
      }

      tbody {
        tr {
          &:nth-child(even) { background: #fafafa; }
          &:hover { background: #f0fdf4; }

          td {
            padding: 7px 6px;
            border: 1px solid #e2e8f0;
            text-align: center;
            vertical-align: middle;
            color: #334155;
          }

          .td-sno { font-weight: 600; color: #64748b; }
          .td-target { text-align: left; padding-left: 8px; color: #0f172a; white-space: nowrap; }
          .td-amt { font-family: 'Segoe UI', monospace; font-size: 0.76rem; }
          .nil-dash { color: #cbd5e1; }

          .td-monthly-tot { background: #f0fdf4; color: #15803d; font-weight: 700; }
          .td-annual-extras { background: #faf5ff; color: #7e22ce; }
          .td-grand-tot { background: #eff6ff; color: #1d4ed8; font-weight: 800; }
        }
      }

      tfoot {
        .tfoot-row {
          background: #0f172a;
          color: #ffffff;
          td {
            padding: 8px 6px;
            font-weight: 700;
            text-align: center;
            border: 1px solid #334155;
          }
          .td-tot-label { text-align: right; padding-right: 12px; font-weight: 800; letter-spacing: 0.5px; }
          .td-monthly-tot { background: #166534; color: #ffffff; }
          .td-annual-extras { background: #581c87; color: #ffffff; }
          .td-grand-tot { background: #1e3a8a; color: #ffffff; font-size: 0.85rem; }
        }
      }

      .empty-cell {
        text-align: center;
        padding: 30px;
        color: #94a3b8;
        font-style: italic;
      }
    }

    /* ─── Single Class Notice Styling ──────────────────────────────────── */
    .single-class-notice-wrap {
      margin-bottom: 24px;

      .single-target-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 6px;
        margin-bottom: 12px;

        .target-badge {
          font-size: 0.95rem;
          color: #1e40af;
          strong { font-size: 1.1rem; }
        }
        .target-desc {
          font-size: 0.8rem;
          color: #3b82f6;
        }

        @media (max-width: 640px) {
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 8px 12px;
        }
      }

      .single-breakdown-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;

        thead tr th {
          background: #f8fafc;
          padding: 9px 10px;
          border: 1px solid #cbd5e1;
          color: #0f172a;
          font-weight: 700;
          text-align: left;
          white-space: nowrap;
        }
        .th-sno { width: 36px; text-align: center; }
        .th-code { width: 85px; }
        .th-pcat { width: 100px; }
        .th-pfreq { width: 95px; }
        .th-pmonth { width: 140px; }
        .th-pamt { width: 120px; text-align: right; }

        tbody tr {
          &:nth-child(even) { background: #fafafa; }
          td {
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
            color: #334155;
            white-space: nowrap;
          }
          .td-sno { text-align: center; color: #64748b; }
          .td-code .code-badge {
            font-family: monospace;
            font-size: 0.74rem;
            font-weight: 700;
            background: #eff6ff;
            color: #1d4ed8;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid #bfdbfe;
          }
          .cat-tag, .freq-tag {
            font-size: 0.72rem;
            padding: 2px 8px;
            border-radius: 10px;
            background: #f1f5f9;
            color: #475569;
          }
          .td-pamt { text-align: right; color: #0f172a; }
        }

        tfoot {
          .single-sum-row {
            td {
              padding: 9px 12px;
              border: 1px solid #e2e8f0;
              white-space: nowrap;
            }
            .sum-lbl { text-align: right; font-weight: 600; color: #475569; }
            .sum-amt { text-align: right; font-weight: 700; color: #0f172a; }

            &.extras-row {
              background: #faf5ff;
              .sum-lbl { color: #6b21a8; }
              .sum-amt { color: #6b21a8; }
            }

            &.grand-row {
              background: #eff6ff;
              .sum-lbl { color: #1e40af; font-weight: 800; font-size: 0.88rem; }
              .sum-amt.grand-val { color: #1d4ed8; font-weight: 800; font-size: 1rem; }
            }
          }
        }
      }

      .billing-rules-box {
        margin-top: 16px;
        padding: 12px 16px;
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        border-radius: 6px;

        .rules-title {
          margin: 0 0 8px;
          font-size: 0.85rem;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 6px;
          mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
        }

        .payment-credentials-row {
          display: flex;
          gap: 24px;
          margin-bottom: 8px;
          flex-wrap: wrap;

          .cred-cell {
            font-size: 0.8rem;
            .cred-lbl { color: #64748b; margin-right: 6px; }
            .cred-val { font-weight: 700; color: #0f172a; }
          }
        }

        .rules-note {
          margin: 0;
          font-size: 0.74rem;
          color: #64748b;
          line-height: 1.4;
        }

        @media (max-width: 640px) {
          padding: 10px 12px;
          .payment-credentials-row {
            flex-direction: column;
            gap: 6px;
          }
        }
      }
    }

    /* ─── Signatures & Verification Block ──────────────────────────────── */
    .doc-footer-block {
      margin-top: 28px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 20px;
      page-break-inside: avoid;

      .footer-note {
        flex: 1;
        max-width: 480px;
        p {
          margin: 0;
          font-size: 0.72rem;
          color: #64748b;
          line-height: 1.4;
        }
        .gen-time {
          margin-top: 6px;
          color: #94a3b8;
          font-size: 0.68rem;
        }
      }

      .auth-signatures-group {
        display: flex;
        align-items: flex-end;
        gap: 28px;

        .sig-card {
          width: 160px;
          text-align: center;

          .sig-space {
            height: 48px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            margin-bottom: 4px;

            .sig-image {
              max-height: 46px;
              max-width: 140px;
              object-fit: contain;
            }
          }

          .sig-line {
            width: 100%;
            height: 1px;
            background: #0f172a;
            margin-bottom: 4px;
          }

          .sig-title {
            display: block;
            font-size: 0.78rem;
            font-weight: 700;
            color: #0f172a;
          }

          .sig-subtitle {
            display: block;
            font-size: 0.68rem;
            color: #64748b;
          }
        }

        .seal-card {
          width: 68px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;

          .seal-image {
            width: 60px;
            height: 60px;
            object-fit: contain;
          }

          .seal-label {
            font-size: 0.65rem;
            color: #64748b;
            margin-top: 2px;
            text-transform: uppercase;
          }
        }
      }

      @media (max-width: 640px) {
        margin-top: 18px;
        flex-direction: column-reverse;
        align-items: center;
        gap: 16px;

        .footer-note {
          max-width: 100%;
          text-align: center;
          p { font-size: 0.7rem; }
          .gen-time { font-size: 0.65rem; }
        }

        .auth-signatures-group {
          width: 100%;
          justify-content: space-around;
          gap: 12px;

          .sig-card {
            width: 120px;
            .sig-space { height: 40px; }
            .sig-title { font-size: 0.72rem; }
            .sig-subtitle { font-size: 0.64rem; }
          }

          .seal-card {
            width: 52px;
            .seal-image { width: 46px; height: 46px; }
            .seal-label { font-size: 0.6rem; }
          }
        }
      }
    }

    /* ─── Print Media Styles ───────────────────────────────────────────── */
    @media print {
      body * {
        visibility: hidden;
      }
      .no-print {
        display: none !important;
      }
      .printable-document, .printable-document * {
        visibility: visible;
      }
      .matrix-modal-container {
        position: fixed;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: transparent !important;
        overflow: visible !important;
      }
      .printable-document {
        box-shadow: none !important;
        border: none !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 6mm 8mm !important;
      }
      @page {
        size: landscape;
        margin: 8mm;
      }
    }
  `]
})
export class ClassFeeMatrixReportDialogComponent implements OnInit {
  targetType: 'class' | 'batch' = 'class';
  viewMode: 'consolidated' | 'single' = 'consolidated';

  selectedTargetId = 'ALL';
  currentTargetName = 'All Classes';

  hasSchoolModule = true;
  hasCoachingModule = false;

  schoolClasses: TargetItem[] = [];
  coachingBatches: TargetItem[] = [];
  targets: TargetItem[] = [];

  allFeeHeads: FeeHead[] = [];
  allStructures: ClassFeeStructureItem[] = [];

  matrixColumns: MatrixColumn[] = [];
  matrixRows: ConsolidatedMatrixRow[] = [];
  singleClassItems: ClassFeeStructureItem[] = [];
  singleMonthlyTotal = 0;
  singleAnnualExtras = 0;

  loading = false;
  nowDate = new Date();

  instituteName = '';
  instituteLogo: string | null = null;
  affiliationNumber: string | null = null;
  campusAddress: string | null = null;
  contactInfo: string | null = null;
  branchName = 'Main Campus';
  officialSealUrl: string | null = null;
  digitalSignatureUrl: string | null = null;
  academicSession = 'Current Session';
  bankAccountInfo: string | null = null;
  upiInfo: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<ClassFeeMatrixReportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ClassFeeMatrixReportDialogData,
    private feesService: FeesService,
    private authService: AuthService,
    private tenantService: TenantService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.hasSchoolModule = this.authService.hasSchoolModule();
    this.hasCoachingModule = this.authService.hasCoachingModule();

    if (this.data?.initialTargetType) {
      this.targetType = this.data.initialTargetType;
    } else if (!this.hasSchoolModule && this.hasCoachingModule) {
      this.targetType = 'batch';
    }

    this.loadTenantInfo();
    this.loadData();
  }

  private loadTenantInfo(): void {
    const user = this.authService.currentUser();
    this.instituteName = this.authService.getInstituteName() || 'Institution';
    this.instituteLogo = this.authService.getInstituteLogoUrl();
    this.officialSealUrl = this.authService.getOfficialSealUrl();
    this.digitalSignatureUrl = this.authService.getDigitalSignatureUrl();
    this.branchName = user?.branchName || 'Main Campus';

    // Current Academic Session Year
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const startYear = currentMonth >= 4 ? currentYear : currentYear - 1;
    this.academicSession = `${startYear}-${startYear + 1}`;

    this.tenantService.getCurrentTenant().subscribe({
      next: (t) => {
        if (t) {
          if (t.name) this.instituteName = t.name;
          if (t.profilePhoto) this.instituteLogo = this.authService.resolveLogoUrl(t.profilePhoto);
          if (t.officialSeal) this.officialSealUrl = this.authService.resolveLogoUrl(t.officialSeal);
          if (t.digitalSignature) this.digitalSignatureUrl = this.authService.resolveLogoUrl(t.digitalSignature);
          this.affiliationNumber = t.affiliationNumber || null;
          this.campusAddress = t.address || (t.city ? `${t.city}, ${t.state || ''}` : null);
          this.contactInfo = [t.contactPhone, t.email].filter(Boolean).join(' • ');

          if (t.bankName && t.bankAccountNumber) {
            this.bankAccountInfo = `${t.bankName} • A/C: ${t.bankAccountNumber} • IFSC: ${t.bankIfscCode || 'N/A'}`;
          }
          if (t.upiId) {
            this.upiInfo = `${t.upiId} (${t.upiMerchantName || this.instituteName})`;
          }
        }
      },
      error: () => {}
    });
  }

  setTargetType(type: 'class' | 'batch'): void {
    this.targetType = type;
    this.selectedTargetId = 'ALL';
    this.updateTargetList();
    this.buildMatrix();
  }

  loadData(): void {
    this.loading = true;

    // Load Classes, Batches, Fee Heads, and Class Fee Structures concurrently
    const classes$ = this.http.get<any[]>(`${environment.apiUrl}/school/classes?activeOnly=true`);
    const batches$ = this.http.get<any[]>(`${environment.apiUrl}/batches?activeOnly=true`);
    const heads$ = this.feesService.getFeeHeads(true);
    const structures$ = this.feesService.getClassFeeStructures();

    classes$.subscribe({
      next: (classes) => {
        this.schoolClasses = (classes || []).map(c => ({ id: c.id, name: c.name, code: c.code }));
        this.updateTargetList();
        this.tryBuild();
      },
      error: () => this.tryBuild()
    });

    batches$.subscribe({
      next: (batches) => {
        this.coachingBatches = (batches || []).map(b => ({ id: b.id, name: b.name, code: b.code }));
        this.updateTargetList();
        this.tryBuild();
      },
      error: () => this.tryBuild()
    });

    heads$.subscribe({
      next: (heads) => {
        this.allFeeHeads = heads || [];
        this.tryBuild();
      },
      error: () => this.tryBuild()
    });

    structures$.subscribe({
      next: (structs) => {
        this.allStructures = structs || [];
        this.tryBuild();
      },
      error: () => this.tryBuild()
    });
  }

  private pendingRequests = 4;
  private tryBuild(): void {
    this.pendingRequests--;
    if (this.pendingRequests <= 0) {
      this.loading = false;
      this.updateTargetList();
      if (this.data?.initialClassId && this.targetType === 'class') {
        this.selectedTargetId = this.data.initialClassId;
      } else if (this.data?.initialBatchId && this.targetType === 'batch') {
        this.selectedTargetId = this.data.initialBatchId;
      }
      this.buildMatrix();
    }
  }

  updateTargetList(): void {
    this.targets = this.targetType === 'class' ? this.schoolClasses : this.coachingBatches;
  }

  onTargetChange(): void {
    if (this.selectedTargetId !== 'ALL') {
      const match = this.targets.find(t => t.id === this.selectedTargetId);
      this.currentTargetName = match ? match.name : 'Selected';
    } else {
      this.currentTargetName = this.targetType === 'class' ? 'All Classes' : 'All Batches';
    }
    this.buildMatrix();
  }

  buildMatrix(): void {
    const isClass = this.targetType === 'class';
    const activeTargets = this.selectedTargetId === 'ALL'
      ? this.targets
      : this.targets.filter(t => t.id === this.selectedTargetId);

    // Filter structures for relevant target type
    const relevantStructs = this.allStructures.filter(s =>
      isClass ? (!!s.classId && !s.batchId) : !!s.batchId
    );

    // Identify which Fee Heads have active configured amounts > 0
    const usedHeadIds = new Set<string>();
    relevantStructs.forEach(s => {
      if (s.amount > 0 && s.feeHeadId) {
        usedHeadIds.add(s.feeHeadId);
      }
    });

    // Columns: Fee Heads that are active and have amounts configured
    this.matrixColumns = this.allFeeHeads
      .filter(h => usedHeadIds.has(h.id))
      .map(h => ({
        id: h.id,
        code: h.code,
        name: h.name,
        category: h.category,
        frequency: h.frequency
      }));

    // If no heads used yet, show first few fee heads as fallback
    if (this.matrixColumns.length === 0) {
      this.matrixColumns = this.allFeeHeads.slice(0, 5).map(h => ({
        id: h.id,
        code: h.code,
        name: h.name,
        category: h.category,
        frequency: h.frequency
      }));
    }

    // Build Rows
    this.matrixRows = activeTargets.map(target => {
      const targetStructs = relevantStructs.filter(s =>
        isClass ? s.classId === target.id : s.batchId === target.id
      );

      const amounts: { [headId: string]: number } = {};
      let totalMonthly = 0;
      let totalAnnualExtras = 0;

      targetStructs.forEach(s => {
        amounts[s.feeHeadId] = s.amount;
        const freq = (s.frequency || '').toLowerCase();
        if (freq === 'monthly') {
          totalMonthly += s.amount;
        } else {
          totalAnnualExtras += s.amount;
        }
      });

      const grandAnnualEstimate = (totalMonthly * 12) + totalAnnualExtras;

      return {
        targetId: target.id,
        targetName: target.name,
        amounts,
        totalMonthly,
        totalAnnualExtras,
        grandAnnualEstimate
      };
    });

    // Single Class breakdown items
    if (this.selectedTargetId !== 'ALL') {
      this.singleClassItems = relevantStructs
        .filter(s => (isClass ? s.classId === this.selectedTargetId : s.batchId === this.selectedTargetId) && s.amount > 0)
        .sort((a, b) => (a.feeHeadName || '').localeCompare(b.feeHeadName || ''));
      
      this.singleMonthlyTotal = this.singleClassItems
        .filter(i => (i.frequency || '').toLowerCase() === 'monthly')
        .reduce((sum, i) => sum + i.amount, 0);

      this.singleAnnualExtras = this.singleClassItems
        .filter(i => (i.frequency || '').toLowerCase() !== 'monthly')
        .reduce((sum, i) => sum + i.amount, 0);
    } else if (this.targets.length > 0) {
      const first = this.targets[0];
      this.singleClassItems = relevantStructs
        .filter(s => (isClass ? s.classId === first.id : s.batchId === first.id) && s.amount > 0);
      this.currentTargetName = first.name;
      this.singleMonthlyTotal = this.singleClassItems
        .filter(i => (i.frequency || '').toLowerCase() === 'monthly')
        .reduce((sum, i) => sum + i.amount, 0);
      this.singleAnnualExtras = this.singleClassItems
        .filter(i => (i.frequency || '').toLowerCase() !== 'monthly')
        .reduce((sum, i) => sum + i.amount, 0);
    }
  }

  getColumnTotal(feeHeadId: string): number {
    return this.matrixRows.reduce((sum, r) => sum + (r.amounts[feeHeadId] || 0), 0);
  }

  getMonthlySumTotal(): number {
    return this.matrixRows.reduce((sum, r) => sum + r.totalMonthly, 0);
  }

  getAnnualExtrasSumTotal(): number {
    return this.matrixRows.reduce((sum, r) => sum + r.totalAnnualExtras, 0);
  }

  getGrandAnnualSumTotal(): number {
    return this.matrixRows.reduce((sum, r) => sum + r.grandAnnualEstimate, 0);
  }

  getMonthName(monthNum?: number | null): string {
    if (!monthNum) return 'Recurring Every Month';
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[monthNum - 1] || `Month ${monthNum}`;
  }

  printReport(): void {
    window.print();
  }

  exportToCsv(): void {
    if (this.viewMode === 'consolidated') {
      if (this.matrixRows.length === 0) return;

      const headers = [
        '#',
        this.targetType === 'class' ? 'Class Name' : 'Batch Name',
        ...this.matrixColumns.map(c => `"${c.name} (${c.code})"`) ,
        'Total Monthly (₹)',
        'Annual Extras (₹)',
        'Grand Annual Estimate (₹)'
      ];

      const rows = this.matrixRows.map((r, idx) => [
        idx + 1,
        `"${r.targetName}"`,
        ...this.matrixColumns.map(c => r.amounts[c.id] || 0),
        r.totalMonthly,
        r.totalAnnualExtras,
        r.grandAnnualEstimate
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Fee_Structure_Matrix_${this.targetType}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      if (this.singleClassItems.length === 0) return;

      const headers = ['#', 'Fee Head Code', 'Particulars', 'Category', 'Frequency', 'Applicable Month', 'Amount (₹)'];
      const rows = this.singleClassItems.map((item, idx) => [
        idx + 1,
        `"${item.feeHeadCode}"`,
        `"${item.feeHeadName}"`,
        `"${item.category}"`,
        `"${item.frequency}"`,
        `"${this.getMonthName(item.applicableMonth)}"`,
        item.amount
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Fee_Schedule_${this.currentTargetName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}
