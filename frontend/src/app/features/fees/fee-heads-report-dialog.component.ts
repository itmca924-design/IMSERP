import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FeesService, FeeHead } from '../../core/services/fees.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';

export interface FeeHeadsReportDialogData {
  initialCategory?: string;
  initialFrequency?: string;
}

@Component({
  selector: 'app-fee-heads-report-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatProgressBarModule,
    IstDatetimeDirective
],
  template: `
    <div class="report-modal-container">
      <!-- ─── Top Control Bar (Screen Only) ───────────────────────────────── -->
      <div class="modal-top-bar no-print">
        <div class="header-row">
          <div class="dialog-header-info">
            <div class="header-icon-box">
              <mat-icon>account_tree</mat-icon>
            </div>
            <div class="header-title-group">
              <h2 class="main-title">Fee Heads Master Catalog (फ़ीस हेड सूची)</h2>
              <p class="sub-title">
                Complete billing heads catalog &bull;
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
            <span>Print Catalog</span>
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
    
      <!-- ─── Filter Bar (Screen Only) ────────────────────────────────────── -->
      <div class="filter-strip no-print">
        <div class="filter-group">
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Category Filter</mat-label>
            <mat-select [(ngModel)]="selectedCategory" (selectionChange)="applyFilters()">
              <mat-option value="ALL">All Categories (सभी)</mat-option>
              @for (cat of categories; track cat) {
                <mat-option [value]="cat">{{ cat }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
    
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Frequency Filter</mat-label>
            <mat-select [(ngModel)]="selectedFrequency" (selectionChange)="applyFilters()">
              <mat-option value="ALL">All Frequencies (सभी)</mat-option>
              <mat-option value="Monthly">Monthly</mat-option>
              <mat-option value="OneTime">One Time</mat-option>
              <mat-option value="TermWise">Term Wise</mat-option>
              <mat-option value="Annual">Annual</mat-option>
            </mat-select>
          </mat-form-field>
    
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Status</mat-label>
            <mat-select [(ngModel)]="selectedStatus" (selectionChange)="applyFilters()">
              <mat-option value="ALL">All Status</mat-option>
              <mat-option value="ACTIVE">Active Only</mat-option>
              <mat-option value="INACTIVE">Inactive Only</mat-option>
            </mat-select>
          </mat-form-field>
    
          <mat-form-field appearance="outline" class="filter-field search-field">
            <mat-label>Quick Search</mat-label>
            <input matInput [(ngModel)]="searchKeyword" (ngModelChange)="applyFilters()" placeholder="Search Code, Name..." />
            <mat-icon matPrefix>search</mat-icon>
          </mat-form-field>
        </div>
    
        <div class="count-badge">
          Showing <strong>{{ filteredHeads.length }}</strong> of {{ allHeads.length }} Heads
        </div>
      </div>
    
      <!-- Single Progress Bar -->
      @if (loading) {
        <mat-progress-bar mode="indeterminate" class="loading-bar"></mat-progress-bar>
      }
    
      <!-- ─── Printable Document Area ──────────────────────────────────────── -->
      <div class="printable-document" id="printableFeeHeads">
    
        <!-- Official Institute Header -->
        <div class="doc-header">
          @if (instituteLogo) {
            <div class="inst-logo-wrap">
              <img [src]="instituteLogo" alt="Institute Logo" class="inst-logo" />
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
          <div class="doc-title-text">OFFICIAL MASTER FEE HEADS &amp; BILLING SCHEDULE</div>
          <div class="doc-title-hi">आधिकारिक शुल्क मद एवं बिलिंग आवृत्ति कैटलॉग</div>
        </div>
    
        <!-- Meta Summary Strip -->
        <div class="doc-meta-strip">
          <div class="meta-item">
            <span class="lbl">Report Date:</span>
            <span class="val" [appIstDatetime]="nowDate" [format]="'date'"></span>
          </div>
          <div class="meta-item">
            <span class="lbl">Campus / Branch:</span>
            <span class="val">{{ branchName }}</span>
          </div>
          <div class="meta-item">
            <span class="lbl">Total Heads:</span>
            <span class="val"><strong>{{ filteredHeads.length }}</strong></span>
          </div>
          <div class="meta-item">
            <span class="lbl">Recurring Monthly:</span>
            <span class="val">{{ monthlyRecurringCount }}</span>
          </div>
        </div>
    
        <!-- Fee Heads Table in Responsive Scroll Container -->
        <div class="heads-table-wrap">
          <div class="mobile-scroll-hint no-print">
            <mat-icon>swipe</mat-icon>
            <span>Swipe sideways to view all columns &bull; विवरण दाएं-बाएं स्क्रॉल करें</span>
          </div>
          <table class="report-table">
            <thead>
              <tr>
                <th class="th-sno">#</th>
                <th class="th-code">Head Code</th>
                <th class="th-name">Fee Head Particulars</th>
                <th class="th-cat">Category</th>
                <th class="th-freq">Frequency</th>
                <th class="th-scope">Scope</th>
                <th class="th-status">Status</th>
                <th class="th-desc">Description / Purpose</th>
              </tr>
            </thead>
            <tbody>
              @for (h of filteredHeads; track h; let i = $index) {
                <tr>
                  <td class="td-sno">{{ i + 1 }}</td>
                  <td class="td-code"><span class="code-badge">{{ h.code }}</span></td>
                  <td class="td-name">
                    <span class="head-title">{{ h.name }}</span>
                    @if (h.isDefault) {
                      <span class="preset-tag">PRESET</span>
                    }
                  </td>
                  <td class="td-cat">
                    <span class="cat-pill cat-{{ h.category.toLowerCase() }}">{{ h.category }}</span>
                  </td>
                  <td class="td-freq">
                    <span class="freq-pill freq-{{ h.frequency.toLowerCase() }}">{{ h.frequency }}</span>
                  </td>
                  <td class="td-scope">{{ h.applicableTo || 'Both' }}</td>
                  <td class="td-status">
                    <span class="status-badge" [class.active]="h.isActive">{{ h.isActive ? 'Active' : 'Inactive' }}</span>
                  </td>
                  <td class="td-desc">{{ h.description || '—' }}</td>
                </tr>
              }
              @if (filteredHeads.length === 0) {
                <tr>
                  <td colspan="8" class="empty-cell">No fee heads match the selected filters.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
    
        <!-- Signatures & Verification Stamp Block -->
        <div class="doc-footer-block">
          <div class="footer-note">
            <p><strong>Note:</strong> This master fee head schedule governs all invoicing and ledger entries across the academic year. Any modification requires authorization from the Finance Controller / Management.</p>
            <p class="gen-time">Generated on: <span [appIstDatetime]="nowDate" [format]="'datetime'"></span> (IST Asia/Kolkata)</p>
          </div>
    
          <div class="auth-signatures-group">
            <!-- Prepared By -->
            <div class="sig-card">
              <div class="sig-space"></div>
              <div class="sig-line"></div>
              <span class="sig-title">Accounts Officer / Accountant</span>
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

    .report-modal-container {
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

    /* ─── Filter Strip ─────────────────────────────────────────────────── */
    .filter-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 24px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;

      .filter-group {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        flex: 1;

        .filter-field {
          width: 170px;
          margin-bottom: -1.25em;
          ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
        }

        .search-field {
          width: 200px;
        }
      }

      .count-badge {
        font-size: 0.82rem;
        color: #64748b;
        background: #f1f5f9;
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

        .filter-group {
          flex-direction: column;
          align-items: stretch;
          width: 100%;
          gap: 10px;

          .filter-field,
          .search-field {
            width: 100% !important;
            margin-bottom: 0;
          }
        }

        .count-badge {
          width: 100%;
          text-align: center;
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
      padding: 36px 40px;
      background: #ffffff;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      width: 92%;
      max-width: 1040px;
      box-sizing: border-box;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;

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
      padding-bottom: 16px;
      border-bottom: 2px solid #0f172a;

      .inst-logo-wrap {
        width: 72px;
        height: 72px;
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
          font-size: 1.5rem;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .inst-sub, .inst-address, .inst-contact {
          margin: 3px 0 0;
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
      padding: 10px 16px;
      margin: 16px 0 12px;
      border-radius: 6px;
      .doc-title-text {
        font-size: 1.05rem;
        font-weight: 800;
        letter-spacing: 1.2px;
      }
      .doc-title-hi {
        font-size: 0.78rem;
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
      padding: 8px 14px;
      background: #f1f5f9;
      border-radius: 6px;
      margin-bottom: 16px;
      border: 1px solid #e2e8f0;
      flex-wrap: wrap;
      gap: 8px;

      .meta-item {
        font-size: 0.8rem;
        .lbl { color: #64748b; margin-right: 4px; }
        .val { color: #0f172a; font-weight: 600; }
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

    /* ─── Table Styling ────────────────────────────────────────────────── */
    .heads-table-wrap {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      margin-bottom: 20px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }

    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;

      thead {
        background: #f8fafc;
        tr th {
          padding: 10px 8px;
          text-align: left;
          font-weight: 700;
          color: #1e293b;
          border: 1px solid #cbd5e1;
          white-space: nowrap;
          text-transform: uppercase;
          font-size: 0.72rem;
          letter-spacing: 0.5px;
        }
        .th-sno { width: 34px; text-align: center; }
        .th-code { width: 90px; }
        .th-name { width: 220px; }
        .th-cat { width: 100px; }
        .th-freq { width: 90px; }
        .th-scope { width: 75px; text-align: center; }
        .th-status { width: 70px; text-align: center; }
        .th-desc { min-width: 160px; }
      }

      tbody {
        tr {
          &:nth-child(even) { background: #fafafa; }
          &:hover { background: #f0fdf4; }

          td {
            padding: 8px 8px;
            border: 1px solid #e2e8f0;
            color: #334155;
            vertical-align: middle;
            white-space: nowrap;
          }

          .td-sno { text-align: center; font-weight: 600; color: #64748b; }
          .td-code {
            .code-badge {
              font-family: monospace;
              font-size: 0.76rem;
              font-weight: 700;
              background: #eff6ff;
              color: #1d4ed8;
              padding: 2px 6px;
              border-radius: 4px;
              border: 1px solid #bfdbfe;
            }
          }
          .td-name {
            .head-title { font-weight: 600; color: #0f172a; }
            .preset-tag {
              display: inline-block;
              margin-left: 6px;
              font-size: 0.62rem;
              font-weight: 700;
              background: #f1f5f9;
              color: #475569;
              padding: 1px 4px;
              border-radius: 3px;
              border: 1px solid #cbd5e1;
            }
          }
          .td-cat {
            .cat-pill {
              font-size: 0.72rem;
              padding: 2px 8px;
              border-radius: 12px;
              font-weight: 600;
              background: #f1f5f9;
              color: #475569;
              &.cat-academic { background: #eff6ff; color: #1e40af; }
              &.cat-fine { background: #fef2f2; color: #b91c1c; }
              &.cat-transport { background: #fffbeb; color: #b45309; }
              &.cat-residential { background: #f5f3ff; color: #6d28d9; }
            }
          }
          .td-freq {
            .freq-pill {
              font-size: 0.72rem;
              padding: 2px 8px;
              border-radius: 12px;
              font-weight: 600;
              background: #f1f5f9;
              color: #475569;
              &.freq-monthly { background: #ecfdf5; color: #047857; }
              &.freq-onetime { background: #fef3c7; color: #92400e; }
              &.freq-termwise { background: #f3e8ff; color: #6b21a8; }
              &.freq-annual { background: #e0e7ff; color: #3730a3; }
            }
          }
          .td-scope { text-align: center; font-size: 0.75rem; color: #64748b; }
          .td-status {
            text-align: center;
            .status-badge {
              font-size: 0.7rem;
              font-weight: 600;
              color: #94a3b8;
              &.active { color: #16a34a; }
            }
          }
          .td-desc {
            font-size: 0.76rem;
            color: #64748b;
          }
        }
        .empty-cell {
          text-align: center;
          padding: 24px;
          color: #94a3b8;
          font-style: italic;
        }
      }
    }

    /* ─── Footer Signatures & Stamp ────────────────────────────────────── */
    .doc-footer-block {
      margin-top: 32px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 20px;
      page-break-inside: avoid;

      .footer-note {
        flex: 1;
        max-width: 440px;
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
            height: 52px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            margin-bottom: 4px;

            .sig-image {
              max-height: 50px;
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
          width: 72px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;

          .seal-image {
            width: 64px;
            height: 64px;
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
      .report-modal-container {
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
        padding: 10mm 12mm !important;
      }
      @page {
        size: portrait;
        margin: 10mm;
      }
    }
  `]
})
export class FeeHeadsReportDialogComponent implements OnInit {
  allHeads: FeeHead[] = [];
  filteredHeads: FeeHead[] = [];
  categories: string[] = [];

  selectedCategory = 'ALL';
  selectedFrequency = 'ALL';
  selectedStatus = 'ACTIVE';
  searchKeyword = '';

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

  monthlyRecurringCount = 0;

  constructor(
    public dialogRef: MatDialogRef<FeeHeadsReportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeeHeadsReportDialogData,
    private feesService: FeesService,
    private authService: AuthService,
    private tenantService: TenantService
  ) {}

  ngOnInit(): void {
    if (this.data?.initialCategory) this.selectedCategory = this.data.initialCategory;
    if (this.data?.initialFrequency) this.selectedFrequency = this.data.initialFrequency;

    this.loadTenantInfo();
    this.loadFeeHeads();
  }

  private loadTenantInfo(): void {
    const user = this.authService.currentUser();
    this.instituteName = this.authService.getInstituteName() || 'Institution';
    this.instituteLogo = this.authService.getInstituteLogoUrl();
    this.officialSealUrl = this.authService.getOfficialSealUrl();
    this.digitalSignatureUrl = this.authService.getDigitalSignatureUrl();
    this.branchName = user?.branchName || 'Main Campus';

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
        }
      },
      error: () => {}
    });
  }

  loadFeeHeads(): void {
    this.loading = true;
    this.feesService.getFeeHeads(false).subscribe({
      next: (heads) => {
        this.allHeads = heads || [];
        const catSet = new Set<string>();
        this.allHeads.forEach(h => { if (h.category) catSet.add(h.category); });
        this.categories = Array.from(catSet).sort();
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load fee heads for report', err);
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    let list = [...this.allHeads];

    if (this.selectedCategory !== 'ALL') {
      list = list.filter(h => h.category?.toLowerCase() === this.selectedCategory.toLowerCase());
    }

    if (this.selectedFrequency !== 'ALL') {
      list = list.filter(h => h.frequency?.toLowerCase() === this.selectedFrequency.toLowerCase());
    }

    if (this.selectedStatus === 'ACTIVE') {
      list = list.filter(h => h.isActive);
    } else if (this.selectedStatus === 'INACTIVE') {
      list = list.filter(h => !h.isActive);
    }

    const q = (this.searchKeyword || '').trim().toLowerCase();
    if (q) {
      list = list.filter(h =>
        h.name.toLowerCase().includes(q) ||
        h.code.toLowerCase().includes(q) ||
        (h.description && h.description.toLowerCase().includes(q))
      );
    }

    this.filteredHeads = list;
    this.monthlyRecurringCount = this.filteredHeads.filter(h => h.frequency?.toLowerCase() === 'monthly').length;
  }

  printReport(): void {
    window.print();
  }

  exportToCsv(): void {
    if (this.filteredHeads.length === 0) return;

    const headers = ['S.No', 'Head Code', 'Fee Head Name', 'Category', 'Frequency', 'Scope', 'Status', 'Description'];
    const rows = this.filteredHeads.map((h, idx) => [
      idx + 1,
      `"${h.code}"`,
      `"${h.name}"`,
      `"${h.category}"`,
      `"${h.frequency}"`,
      `"${h.applicableTo || 'Both'}"`,
      `"${h.isActive ? 'Active' : 'Inactive'}"`,
      `"${(h.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Fee_Heads_Master_Catalog_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
