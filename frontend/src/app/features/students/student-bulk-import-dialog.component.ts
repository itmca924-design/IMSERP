import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { environment } from '../../../environments/environment';

interface BulkColumnMapping {
  excelHeader: string;
  targetType: 'Standard' | 'CustomExisting' | 'CreateCustom' | 'Ignore';
  targetKey: string;
  customFieldLabel?: string;
  customFieldDataType?: string;
}

interface ParsedExcelResponse {
  fileName: string;
  sheetNames: string[];
  selectedSheet: string;
  headers: string[];
  totalRows: number;
  rows: Array<Record<string, string>>;
  existingCustomFields: Array<{ id: string; fieldKey: string; fieldLabel: string; dataType: string }>;
  suggestedMappings: BulkColumnMapping[];
}

interface BulkImportExecuteResponse {
  dryRun: boolean;
  totalRows: number;
  newCount: number;
  duplicateCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  newClassesToCreate: string[];
  newCustomFieldsToCreate: string[];
  rowResults: Array<{
    rowNumber: number;
    studentName: string;
    parentName: string;
    className: string;
    sectionName: string;
    phone: string;
    status: string;
    reason?: string;
    admissionNumber?: string;
  }>;
}

@Component({
  selector: 'app-student-bulk-import-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="bi-dialog-shell">
      <!-- Standard Light-Blue Gradient Header -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>upload_file</mat-icon>
          </div>
          <div class="header-titles">
            <h2>Smart Excel Bulk Student Import</h2>
            <p class="subtitle">Upload any school <strong>.xlsx / .csv</strong> — auto-maps columns, creates missing <strong>Custom Fields</strong>, and protects existing records from duplicates.</p>
          </div>
        </div>
        <button type="button" class="close-btn" (click)="closeDialog()" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Stepper Strip -->
      <div class="stepper-strip">
        <div class="step-pill" [class.active]="step === 1" [class.done]="step > 1">
          <span class="num">1</span>
          <span>Upload Excel / CSV</span>
        </div>
        <mat-icon class="step-arr">chevron_right</mat-icon>
        <div class="step-pill" [class.active]="step === 2" [class.done]="step > 2">
          <span class="num">2</span>
          <span>Map Columns &amp; Duplicate Rules</span>
        </div>
        <mat-icon class="step-arr">chevron_right</mat-icon>
        <div class="step-pill" [class.active]="step === 3">
          <span class="num">3</span>
          <span>Dry-Run Preview &amp; Import</span>
        </div>
      </div>

      <div class="dialog-body">
        @if (isLoading) {
          <div class="single-loader">
            <mat-spinner diameter="42"></mat-spinner>
            <span>{{ loadingText }}</span>
          </div>
        } @else {
          <!-- STEP 1: Upload File -->
          @if (step === 1) {
            <div class="upload-zone-card">
              <div class="upload-icon-circle">
                <mat-icon>table_view</mat-icon>
              </div>
              <h3>Select Student Ledger Excel (.xlsx) or CSV (.csv)</h3>
              <p>Works directly with your existing school sheets — no fixed template needed! Dual phone numbers, mixed dates (DD/MM/YY &amp; DD/MM/YYYY), and extra columns like <strong>Permanent Address</strong> or <strong>Height</strong> are handled automatically.</p>

              <input #excelFileInput type="file" accept=".xlsx,.csv" style="display:none" (change)="onFileSelected($event)" />
              <button type="button" mat-flat-button color="primary" class="upload-cta" (click)="excelFileInput.click()">
                <mat-icon>cloud_upload</mat-icon>
                <span>Choose Excel (.xlsx) or CSV File</span>
              </button>

              <div class="dup-info-box">
                <mat-icon>verified_user</mat-icon>
                <div>
                  <strong>Smart Duplicate Protection (Existing Records Safe):</strong>
                  Checks existing students by <em>Admission No</em>, <em>Name + Father's Name + Class</em>, and <em>Name + Mobile No</em>. Siblings with the same mobile number are NEVER blocked because their student names differ!
                </div>
              </div>
            </div>
          }

          <!-- STEP 2: Column Mapping & Options -->
          @if (step === 2 && parsedData) {
            <form [formGroup]="optionsForm" class="options-card">
              <div class="file-meta-bar">
                <div class="file-chip">
                  <mat-icon>description</mat-icon>
                  <strong>{{ parsedData.fileName }}</strong>
                  <span class="row-count-pill">{{ parsedData.totalRows }} Students Found</span>
                </div>

                @if (parsedData.sheetNames.length > 1) {
                  <mat-form-field appearance="outline" class="sheet-select-field">
                    <mat-label>Excel Worksheet</mat-label>
                    <mat-select formControlName="selectedSheet" (selectionChange)="onSheetChanged($event.value)">
                      @for (sn of parsedData.sheetNames; track sn) {
                        <mat-option [value]="sn">{{ sn }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                }
              </div>

              <div class="options-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Duplicate Record Handling (Existing Students)</mat-label>
                  <mat-select formControlName="duplicateStrategy">
                    <mat-option value="Skip">Skip Duplicates (Keep existing records untouched — Recommended)</mat-option>
                    <mat-option value="UpdateMissing">Update Missing Fields on Existing Records (No duplicates created)</mat-option>
                  </mat-select>
                </mat-form-field>

                <div class="checks-stack">
                  <mat-checkbox formControlName="autoCreateClassesAndSections" color="primary">
                    Auto-create missing Classes &amp; Sections (e.g. Play Group - B)
                  </mat-checkbox>
                  <div class="stream-checks">
                    @if (authService.hasSchoolModule()) {
                      <mat-checkbox formControlName="isSchoolStudent" color="primary">Enroll in School</mat-checkbox>
                    }
                    @if (authService.hasCoachingModule()) {
                      <mat-checkbox formControlName="isCoachingStudent" color="primary">Enroll in Coaching</mat-checkbox>
                    }
                  </div>
                </div>
              </div>
            </form>

            <div class="mapping-card">
              <div class="mapping-header">
                <strong>Column Mapping ({{ parsedData.headers.length }} Excel Columns Detected)</strong>
                <span class="hint">Unmatched columns like <em>Permanent Address</em> or <em>Height</em> are auto-set to <strong>➕ Create as Custom Field</strong>.</span>
              </div>

              <div class="table-responsive">
                <table class="map-table" [formGroup]="mappingForm">
                  <thead>
                    <tr>
                      <th style="width: 22%;">Excel Column Header</th>
                      <th style="width: 28%;">Sample Values (Rows 1–2)</th>
                      <th style="width: 34%;">Map To ERP Field</th>
                      <th style="width: 16%;">Custom Field Type</th>
                    </tr>
                  </thead>
                  <tbody formArrayName="mappings">
                    @for (ctrl of mappingArray.controls; track $index; let i = $index) {
                      <tr [formGroupName]="i" [class.create-custom-row]="ctrl.get('mapChoice')?.value === 'CREATE_CUSTOM'">
                        <td>
                          <div class="excel-col-name">{{ ctrl.get('excelHeader')?.value }}</div>
                        </td>
                        <td>
                          <div class="sample-vals">{{ getSampleValues(ctrl.get('excelHeader')?.value) }}</div>
                        </td>
                        <td>
                          <mat-form-field appearance="outline" class="compact-field">
                            <mat-select formControlName="mapChoice">
                              <mat-option value="IGNORE">⛔ Ignore / Skip Column</mat-option>
                              <mat-option value="CREATE_CUSTOM">➕ Auto-Create as Custom Field</mat-option>
                              <mat-optgroup label="Standard Student Fields">
                                @for (sf of standardFields; track sf.key) {
                                  <mat-option [value]="'STD:' + sf.key">{{ sf.label }}</mat-option>
                                }
                              </mat-optgroup>
                              @if (parsedData.existingCustomFields.length > 0) {
                                <mat-optgroup label="Existing Institute Custom Fields">
                                  @for (cf of parsedData.existingCustomFields; track cf.fieldKey) {
                                    <mat-option [value]="'CF:' + cf.fieldKey">✨ {{ cf.fieldLabel }}</mat-option>
                                  }
                                </mat-optgroup>
                              }
                            </mat-select>
                          </mat-form-field>
                        </td>
                        <td>
                          @if (ctrl.get('mapChoice')?.value === 'CREATE_CUSTOM') {
                            <mat-form-field appearance="outline" class="compact-field">
                              <mat-select formControlName="customFieldDataType">
                                <mat-option value="Text">Text</mat-option>
                                <mat-option value="Textarea">Long Text / Address</mat-option>
                                <mat-option value="Number">Number</mat-option>
                                <mat-option value="Date">Date</mat-option>
                              </mat-select>
                            </mat-form-field>
                          } @else {
                            <span class="mapped-tag" [class.ignored]="ctrl.get('mapChoice')?.value === 'IGNORE'">
                              {{ ctrl.get('mapChoice')?.value === 'IGNORE' ? 'Skipped' : 'Mapped' }}
                            </span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- STEP 3: Dry-Run Preview & Final Import -->
          @if (step === 3 && previewResult) {
            <div class="kpi-grid">
              <div class="kpi-card blue">
                <span class="lbl">TOTAL EXCEL ROWS</span>
                <strong class="val">{{ previewResult.totalRows }}</strong>
              </div>
              <div class="kpi-card green">
                <span class="lbl">NEW STUDENTS TO ADD</span>
                <strong class="val">{{ previewResult.newCount }}</strong>
              </div>
              <div class="kpi-card amber">
                <span class="lbl">DUPLICATES DETECTED</span>
                <strong class="val">{{ previewResult.duplicateCount }}</strong>
                <small>{{ optionsForm.value.duplicateStrategy === 'UpdateMissing' ? 'Will enrich missing fields' : 'Will be skipped safely' }}</small>
              </div>
              <div class="kpi-card red">
                <span class="lbl">ERRORS / BLANK ROWS</span>
                <strong class="val">{{ previewResult.errorCount }}</strong>
              </div>
            </div>

            @if (previewResult.newCustomFieldsToCreate.length > 0 || previewResult.newClassesToCreate.length > 0) {
              <div class="auto-create-banner">
                @if (previewResult.newCustomFieldsToCreate.length > 0) {
                  <div><strong>✨ New Custom Fields to Auto-Create:</strong> {{ previewResult.newCustomFieldsToCreate.join(', ') }}</div>
                }
                @if (previewResult.newClassesToCreate.length > 0) {
                  <div><strong>🏫 New Classes / Sections to Auto-Create:</strong> {{ previewResult.newClassesToCreate.join(', ') }}</div>
                }
              </div>
            }

            <div class="preview-card">
              <div class="mapping-header">
                <strong>Row-by-Row Validation &amp; Duplicate Check Preview</strong>
                <span class="hint">Showing {{ previewResult.rowResults.length }} rows</span>
              </div>
              <div class="table-responsive" style="max-height: 320px; overflow-y: auto;">
                <table class="map-table">
                  <thead>
                    <tr>
                      <th style="width: 60px;">Row #</th>
                      <th>Generated Adm No</th>
                      <th>Student Name</th>
                      <th>Father's Name</th>
                      <th>Class / Sec</th>
                      <th>Primary Phone</th>
                      <th>Status &amp; Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of previewResult.rowResults; track r.rowNumber) {
                      <tr>
                        <td>{{ r.rowNumber }}</td>
                        <td><code style="font-size:11px;font-weight:700;color:#1e40af;background:#eff6ff;padding:2px 6px;border-radius:4px;">{{ r.admissionNumber || '—' }}</code></td>
                        <td><strong>{{ r.studentName || '—' }}</strong></td>
                        <td>{{ r.parentName || '—' }}</td>
                        <td>{{ r.className }}{{ r.sectionName ? ' - ' + r.sectionName : '' }}</td>
                        <td>{{ r.phone || '—' }}</td>
                        <td>
                          <span class="status-pill" [ngClass]="r.status.toLowerCase()">{{ r.status }}</span>
                          @if (r.reason) {
                            <div class="reason-txt">{{ r.reason }}</div>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        }
      </div>

      <!-- Sticky Footer -->
      <div class="dialog-footer">
        <div class="footer-left">
          @if (step > 1 && !isLoading) {
            <button type="button" mat-stroked-button (click)="step = step - 1">
              <mat-icon>arrow_back</mat-icon>
              <span>Back</span>
            </button>
          }
        </div>
        <div class="footer-right">
          <button type="button" mat-stroked-button (click)="closeDialog()">Cancel</button>
          @if (step === 2 && !isLoading) {
            <button type="button" mat-flat-button color="primary" (click)="runDryRunPreview()">
              <mat-icon>fact_check</mat-icon>
              <span>Preview &amp; Check Duplicates</span>
            </button>
          }
          @if (step === 3 && !isLoading && previewResult) {
            <button type="button" mat-flat-button color="primary"
              [disabled]="previewResult.newCount === 0 && previewResult.updatedCount === 0"
              (click)="confirmAndExecuteImport()">
              <mat-icon>cloud_done</mat-icon>
              <span>Confirm &amp; Import ({{ previewResult.newCount }} New{{ previewResult.updatedCount > 0 ? ', ' + previewResult.updatedCount + ' Update' : '' }})</span>
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bi-dialog-shell {
      display: flex;
      flex-direction: column;
      height: 88vh;
      max-height: 92vh;
      background: #f8fafc;
      overflow: hidden;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 16px 22px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      flex-shrink: 0;
    }
    .header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .header-icon-box {
      width: 42px; height: 42px; background: #2563eb; color: #ffffff;
      border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .header-titles h2 { margin: 0; font-size: 17px; font-weight: 700; color: #1e3a8a; }
    .header-titles .subtitle { margin: 2px 0 0; font-size: 12px; color: #3b82f6; }
    .header-titles .subtitle strong { color: #1e40af; }
    .close-btn {
      background: rgba(255, 255, 255, 0.75); border: 1px solid #bfdbfe; border-radius: 8px;
      width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;
      color: #64748b; cursor: pointer;
    }
    .close-btn:hover { color: #1e293b; background: #ffffff; }

    .stepper-strip {
      display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px;
      padding: 10px 18px; background: #ffffff; border-bottom: 1px solid #e2e8f0; flex-shrink: 0;
    }
    .step-pill {
      display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px;
      border-radius: 999px; font-size: 12px; font-weight: 600; color: #64748b; background: #f1f5f9;
    }
    .step-pill .num {
      width: 20px; height: 20px; border-radius: 50%; background: #cbd5e1; color: #334155;
      display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800;
    }
    .step-pill.active { background: #eff6ff; color: #1d4ed8; border: 1px solid #93c5fd; }
    .step-pill.active .num { background: #2563eb; color: #ffffff; }
    .step-pill.done { background: #ecfdf5; color: #047857; }
    .step-pill.done .num { background: #059669; color: #ffffff; }
    .step-arr { color: #94a3b8; font-size: 18px; width: 18px; height: 18px; }

    .dialog-body {
      flex: 1 1 auto; overflow-y: auto; padding: 16px 20px;
      display: flex; flex-direction: column; gap: 14px;
    }
    .single-loader {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 12px; padding: 64px 20px; color: #334155; font-weight: 600;
    }
    .upload-zone-card {
      background: #ffffff; border: 2px dashed #93c5fd; border-radius: 14px;
      padding: 36px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px;
    }
    .upload-icon-circle {
      width: 60px; height: 60px; border-radius: 50%; background: #eff6ff; color: #2563eb;
      display: flex; align-items: center; justify-content: center;
    }
    .upload-icon-circle mat-icon { font-size: 30px; width: 30px; height: 30px; }
    .upload-zone-card h3 { margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; }
    .upload-zone-card p { margin: 0; max-width: 640px; font-size: 13px; color: #475569; line-height: 1.5; }
    .upload-cta { height: 42px; padding: 0 22px; font-weight: 700; border-radius: 8px; }
    .dup-info-box {
      margin-top: 10px; max-width: 680px; text-align: left;
      display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px;
      background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; font-size: 12px; color: #166534;
    }
    .dup-info-box mat-icon { color: #16a34a; flex-shrink: 0; }

    .options-card, .mapping-card, .preview-card {
      background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px;
    }
    .file-meta-bar {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
      margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px dashed #e2e8f0;
    }
    .file-chip { display: inline-flex; align-items: center; gap: 8px; color: #0f172a; font-size: 13px; }
    .file-chip mat-icon { color: #2563eb; }
    .row-count-pill {
      padding: 2px 10px; border-radius: 999px; background: #eff6ff; color: #1d4ed8; font-size: 11.5px; font-weight: 700;
    }
    .sheet-select-field { min-width: 210px; }
    :host ::ng-deep .sheet-select-field .mat-mdc-form-field-subscript-wrapper,
    :host ::ng-deep .compact-field .mat-mdc-form-field-subscript-wrapper { display: none !important; }
    .options-grid {
      display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px 18px; align-items: center;
    }
    .checks-stack { display: flex; flex-direction: column; gap: 4px; }
    .stream-checks { display: flex; flex-wrap: wrap; gap: 14px; }

    .mapping-header {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;
    }
    .mapping-header strong { font-size: 13.5px; color: #0f172a; }
    .mapping-header .hint { font-size: 11.5px; color: #64748b; }

    .table-responsive { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .map-table { width: 100%; border-collapse: collapse; min-width: 680px; }
    .map-table th {
      text-align: left; font-size: 11px; font-weight: 800; color: #475569;
      background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 10px; white-space: nowrap;
    }
    .map-table td {
      padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-size: 12.5px; vertical-align: middle;
    }
    .create-custom-row { background: #f0fdfa; }
    .excel-col-name { font-weight: 700; color: #0f172a; }
    .sample-vals { font-size: 11.5px; color: #64748b; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .compact-field { width: 100%; }
    .mapped-tag {
      display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;
      background: #dcfce7; color: #166534;
    }
    .mapped-tag.ignored { background: #f1f5f9; color: #64748b; }

    .kpi-grid {
      display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;
    }
    .kpi-card {
      background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px;
      display: flex; flex-direction: column; gap: 2px;
    }
    .kpi-card .lbl { font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 0.04em; }
    .kpi-card .val { font-size: 22px; font-weight: 800; }
    .kpi-card small { font-size: 10.5px; color: #64748b; }
    .kpi-card.blue { background: #eff6ff; border-color: #bfdbfe; }
    .kpi-card.blue .val { color: #1d4ed8; }
    .kpi-card.green { background: #ecfdf5; border-color: #a7f3d0; }
    .kpi-card.green .val { color: #047857; }
    .kpi-card.amber { background: #fffbeb; border-color: #fde68a; }
    .kpi-card.amber .val { color: #b45309; }
    .kpi-card.red { background: #fef2f2; border-color: #fecaca; }
    .kpi-card.red .val { color: #b91c1c; }

    .auto-create-banner {
      background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px; padding: 10px 14px;
      font-size: 12.5px; color: #115e59; display: flex; flex-direction: column; gap: 4px;
    }
    .status-pill {
      display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 800; text-transform: uppercase;
    }
    .status-pill.new, .status-pill.inserted { background: #dcfce7; color: #166534; }
    .status-pill.duplicate, .status-pill.skipped { background: #fef3c7; color: #92400e; }
    .status-pill.updated { background: #dbeafe; color: #1e40af; }
    .status-pill.error { background: #fee2e2; color: #991b1b; }
    .reason-txt { font-size: 11px; color: #64748b; margin-top: 2px; }

    .dialog-footer {
      padding: 12px 20px; border-top: 1px solid #e2e8f0; background: #ffffff;
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0;
    }
    .footer-right { display: flex; gap: 10px; flex-wrap: wrap; }

    @media (max-width: 768px) {
      .options-grid { grid-template-columns: 1fr; }
      .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `]
})
export class StudentBulkImportDialogComponent implements OnInit {
  step = 1;
  isLoading = false;
  loadingText = 'Reading Excel file...';
  selectedFile: File | null = null;
  parsedData: ParsedExcelResponse | null = null;
  previewResult: BulkImportExecuteResponse | null = null;
  importCompleted = false;

  optionsForm: FormGroup;
  mappingForm: FormGroup;

  readonly standardFields = [
    { key: 'studentName', label: 'Student Name *' },
    { key: 'parentName', label: "Father's / Guardian Name" },
    { key: 'motherName', label: "Mother's Name" },
    { key: 'className', label: 'Class (e.g. Play Group, Nursery)' },
    { key: 'sectionName', label: 'Section (e.g. A, B)' },
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'admissionNumber', label: 'Admission / SR Number' },
    { key: 'dateOfBirth', label: 'Date of Birth (DOB)' },
    { key: 'joiningDate', label: 'Date of Admission / Joining' },
    { key: 'address', label: 'Local / Residential Address' },
    { key: 'bloodGroup', label: 'Blood Group' },
    { key: 'parentWhatsAppPhone', label: 'Contact / Mobile No (Auto-splits 2 nos.)' },
    { key: 'emergencyContactPhone', label: 'Alternate / Emergency Phone' },
    { key: 'gender', label: 'Gender' },
    { key: 'aadhaarNumber', label: 'Aadhaar Number' },
    { key: 'category', label: 'Category / Quota' },
    { key: 'religion', label: 'Religion' },
    { key: 'previousSchoolName', label: 'Previous School Name' }
  ];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    public authService: AuthService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    public dialogRef: MatDialogRef<StudentBulkImportDialogComponent>
  ) {
    this.optionsForm = this.fb.group({
      selectedSheet: new FormControl(''),
      duplicateStrategy: new FormControl('Skip'),
      autoCreateClassesAndSections: new FormControl(true),
      isSchoolStudent: new FormControl(this.authService.hasSchoolModule()),
      isCoachingStudent: new FormControl(!this.authService.hasSchoolModule() && this.authService.hasCoachingModule())
    });

    this.mappingForm = this.fb.group({
      mappings: this.fb.array([])
    });
  }

  ngOnInit(): void {}

  get mappingArray(): FormArray {
    return this.mappingForm.get('mappings') as FormArray;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    this.selectedFile = file;
    this.parseFile(file);
    input.value = '';
  }

  onSheetChanged(sheetName: string): void {
    if (!this.selectedFile) return;
    this.parseFile(this.selectedFile, sheetName);
  }

  private parseFile(file: File, sheetName?: string): void {
    this.isLoading = true;
    this.loadingText = 'Parsing Excel & detecting columns...';
    this.cdr.markForCheck();

    const fd = new FormData();
    fd.append('file', file);
    if (sheetName) fd.append('sheetName', sheetName);

    this.http.post<ParsedExcelResponse>(`${environment.apiUrl}/students/bulk-import/parse`, fd).subscribe({
      next: (res) => {
        this.parsedData = res;
        this.optionsForm.patchValue({ selectedSheet: res.selectedSheet }, { emitEvent: false });
        this.buildMappingControls(res.suggestedMappings || []);
        this.step = 2;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.cdr.markForCheck();
        this.confirmDialog.alert('Upload Failed', err?.error?.message || 'Could not parse the uploaded file.', 'danger');
      }
    });
  }

  private buildMappingControls(suggested: BulkColumnMapping[]): void {
    this.mappingArray.clear();
    for (const m of suggested) {
      let choice = 'IGNORE';
      if (m.targetType === 'Standard') choice = `STD:${m.targetKey}`;
      else if (m.targetType === 'CustomExisting') choice = `CF:${m.targetKey}`;
      else if (m.targetType === 'CreateCustom') choice = 'CREATE_CUSTOM';

      this.mappingArray.push(this.fb.group({
        excelHeader: new FormControl(m.excelHeader),
        mapChoice: new FormControl(choice),
        customFieldDataType: new FormControl(m.customFieldDataType || 'Text')
      }));
    }
  }

  getSampleValues(header: string): string {
    if (!this.parsedData?.rows?.length) return '—';
    const samples = this.parsedData.rows
      .slice(0, 3)
      .map(r => (r[header] || '').trim())
      .filter(Boolean);
    return samples.length > 0 ? samples.slice(0, 2).join(' | ') : '(blank)';
  }

  private buildExecutePayload(dryRun: boolean): any {
    const opt = this.optionsForm.value;
    const mappings: BulkColumnMapping[] = this.mappingArray.controls.map(c => {
      const excelHeader = c.get('excelHeader')?.value || '';
      const choice: string = c.get('mapChoice')?.value || 'IGNORE';
      const customType: string = c.get('customFieldDataType')?.value || 'Text';

      if (choice.startsWith('STD:')) {
        return { excelHeader, targetType: 'Standard', targetKey: choice.substring(4) };
      }
      if (choice.startsWith('CF:')) {
        return { excelHeader, targetType: 'CustomExisting', targetKey: choice.substring(3) };
      }
      if (choice === 'CREATE_CUSTOM') {
        return {
          excelHeader,
          targetType: 'CreateCustom',
          targetKey: '',
          customFieldLabel: excelHeader,
          customFieldDataType: customType
        };
      }
      return { excelHeader, targetType: 'Ignore', targetKey: '' };
    });

    const activeBranchId = this.authService.selectedBranchId() || this.authService.currentUser()?.branchId || null;

    return {
      branchId: activeBranchId,
      isSchoolStudent: !!opt.isSchoolStudent,
      isCoachingStudent: !!opt.isCoachingStudent,
      autoCreateClassesAndSections: !!opt.autoCreateClassesAndSections,
      duplicateStrategy: opt.duplicateStrategy || 'Skip',
      dryRun,
      columnMappings: mappings,
      rows: this.parsedData?.rows || []
    };
  }

  runDryRunPreview(): void {
    const payload = this.buildExecutePayload(true);
    const hasNameMapped = payload.columnMappings.some((m: BulkColumnMapping) => m.targetType === 'Standard' && m.targetKey === 'studentName');
    if (!hasNameMapped) {
      this.confirmDialog.alert('Student Name Required', 'Please map at least one Excel column to "Student Name *" before continuing.', 'warning');
      return;
    }

    this.isLoading = true;
    this.loadingText = 'Validating rows & checking existing records for duplicates...';
    this.cdr.markForCheck();

    this.http.post<BulkImportExecuteResponse>(`${environment.apiUrl}/students/bulk-import/execute`, payload).subscribe({
      next: (res) => {
        this.previewResult = res;
        this.step = 3;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.cdr.markForCheck();
        this.confirmDialog.alert('Validation Failed', err?.error?.message || 'Dry-run validation failed.', 'danger');
      }
    });
  }

  confirmAndExecuteImport(): void {
    const payload = this.buildExecutePayload(false);
    this.isLoading = true;
    this.loadingText = 'Importing students, creating custom fields & syncing classes...';
    this.cdr.markForCheck();

    this.http.post<BulkImportExecuteResponse>(`${environment.apiUrl}/students/bulk-import/execute`, payload).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.importCompleted = true;
        this.cdr.markForCheck();
        const summaryHtml = `
          <div style="line-height:1.6;">
            <div><strong>✅ New Students Imported:</strong> ${res.newCount}</div>
            ${res.updatedCount > 0 ? `<div><strong>🔄 Existing Students Enriched:</strong> ${res.updatedCount}</div>` : ''}
            ${res.skippedCount > 0 ? `<div><strong>🛡️ Duplicates Safely Skipped:</strong> ${res.skippedCount}</div>` : ''}
            ${res.newCustomFieldsToCreate.length > 0 ? `<div><strong>✨ Custom Fields Created:</strong> ${res.newCustomFieldsToCreate.join(', ')}</div>` : ''}
            ${res.newClassesToCreate.length > 0 ? `<div><strong>🏫 Classes / Sections Created:</strong> ${res.newClassesToCreate.join(', ')}</div>` : ''}
          </div>
        `;
        this.confirmDialog.alert('Bulk Import Successful!', summaryHtml, 'success').subscribe(() => {
          this.dialogRef.close(true);
        });
      },
      error: (err) => {
        this.isLoading = false;
        this.cdr.markForCheck();
        this.confirmDialog.alert('Import Failed', err?.error?.message || 'An error occurred while importing students.', 'danger');
      }
    });
  }

  closeDialog(): void {
    this.dialogRef.close(this.importCompleted);
  }
}
