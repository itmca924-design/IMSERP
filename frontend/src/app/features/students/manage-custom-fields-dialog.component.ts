import { Component, Inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CustomFieldsService, CustomFieldDefinitionDto, SaveCustomFieldRequestDto } from '../../core/services/custom-fields.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

export interface ManageCustomFieldsDialogData {
  entityType?: string;
}

@Component({
  selector: 'app-manage-custom-fields-dialog',
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
    <div class="cf-dialog-shell">
      <!-- Standard Light-Blue Gradient Header -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>tune</mat-icon>
          </div>
          <div class="header-titles">
            <h2>Manage Dynamic Custom Fields ({{ entityType }})</h2>
            <p class="subtitle">Add custom admission columns like <strong>Permanent Address</strong>, <strong>Height</strong>, <strong>House</strong> — 100% isolated for your institute.</p>
          </div>
        </div>
        <button type="button" class="close-btn" (click)="closeDialog()" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        @if (isLoading) {
          <div class="single-loader">
            <mat-spinner diameter="38"></mat-spinner>
            <span>Loading custom fields...</span>
          </div>
        } @else {
          <!-- Add / Edit Custom Field Form -->
          <form [formGroup]="fieldForm" (ngSubmit)="saveField()" class="cf-form-card">
            <div class="cf-form-title">
              <mat-icon>{{ editingId ? 'edit' : 'add_circle' }}</mat-icon>
              <span>{{ editingId ? 'Edit Custom Field' : 'Add New Custom Field' }}</span>
            </div>

            <div class="cf-form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Field Label (e.g. Permanent Address, Height)</mat-label>
                <input matInput formControlName="fieldLabel" placeholder="Enter column / field display name" maxlength="120" />
                @if (fieldForm.get('fieldLabel')?.hasError('required') && fieldForm.get('fieldLabel')?.touched) {
                  <mat-error>Field Label is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Input Data Type</mat-label>
                <mat-select formControlName="dataType">
                  <mat-option value="Text">Text (Single Line)</mat-option>
                  <mat-option value="Textarea">Long Text / Address</mat-option>
                  <mat-option value="Number">Number (e.g. Height, Weight)</mat-option>
                  <mat-option value="Date">Date (DD-MM-YYYY)</mat-option>
                  <mat-option value="Dropdown">Dropdown List</mat-option>
                  <mat-option value="Checkbox">Yes / No Checkbox</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Placeholder / Hint (Optional)</mat-label>
                <input matInput formControlName="placeholder" placeholder="e.g. Enter height in cm or feet" maxlength="200" />
              </mat-form-field>

              @if (fieldForm.get('dataType')?.value === 'Dropdown') {
                <mat-form-field appearance="outline" class="full-span">
                  <mat-label>Dropdown Options (Comma Separated)</mat-label>
                  <input matInput formControlName="dropdownOptionsText" placeholder="e.g. Red House, Blue House, Green House, Yellow House" />
                  <mat-hint>Separate each option with a comma (,)</mat-hint>
                </mat-form-field>
              }
            </div>

            <div class="cf-toggles-row">
              <mat-checkbox formControlName="isRequired" color="primary">
                Mandatory on Admission Form
              </mat-checkbox>
              <mat-checkbox formControlName="showInTable" color="primary">
                Show Badge in Students Directory Table
              </mat-checkbox>
            </div>

            <div class="cf-form-actions">
              @if (editingId) {
                <button type="button" mat-stroked-button (click)="cancelEdit()">Cancel Edit</button>
              }
              <button type="submit" mat-flat-button color="primary" [disabled]="isSaving || fieldForm.invalid">
                <mat-icon>{{ editingId ? 'save' : 'add' }}</mat-icon>
                <span>{{ editingId ? 'Update Field' : 'Add Custom Field' }}</span>
              </button>
            </div>
          </form>

          <!-- Configured Fields List -->
          <div class="cf-list-card">
            <div class="cf-list-header">
              <strong>Configured Custom Fields ({{ fields.length }})</strong>
              <span class="hint-txt">These appear automatically in Admission Form, Edit Student, and Excel Bulk Import.</span>
            </div>

            @if (fields.length === 0) {
              <div class="empty-state">
                <mat-icon>post_add</mat-icon>
                <p>No custom fields added yet. Add fields like <strong>Permanent Address</strong> or <strong>Height</strong> above.</p>
              </div>
            } @else {
              <div class="table-responsive">
                <table class="cf-table">
                  <thead>
                    <tr>
                      <th>Label &amp; Key</th>
                      <th>Type</th>
                      <th>Required</th>
                      <th>In Table</th>
                      <th style="width: 110px; text-align: center;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (f of fields; track f.id) {
                      <tr>
                        <td>
                          <div class="f-label">{{ f.fieldLabel }}</div>
                          <div class="f-key">Key: <code>{{ f.fieldKey }}</code></div>
                        </td>
                        <td>
                          <span class="type-pill">{{ f.dataType }}</span>
                          @if (f.dataType === 'Dropdown' && f.dropdownOptions?.length) {
                            <div class="opts-sub">{{ f.dropdownOptions.join(', ') }}</div>
                          }
                        </td>
                        <td>
                          <span class="bool-pill" [class.yes]="f.isRequired">{{ f.isRequired ? 'Required' : 'Optional' }}</span>
                        </td>
                        <td>
                          <span class="bool-pill" [class.yes]="f.showInTable">{{ f.showInTable ? 'Visible' : 'Form Only' }}</span>
                        </td>
                        <td style="text-align: center;">
                          <button type="button" mat-icon-button color="primary" (click)="startEdit(f)" matTooltip="Edit Field">
                            <mat-icon>edit</mat-icon>
                          </button>
                          <button type="button" mat-icon-button color="warn" (click)="deleteField(f)" matTooltip="Remove Field">
                            <mat-icon>delete_outline</mat-icon>
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }
      </div>

      <div class="dialog-footer">
        <button type="button" mat-flat-button color="primary" (click)="closeDialog()">Done</button>
      </div>
    </div>
  `,
  styles: [`
    .cf-dialog-shell {
      display: flex;
      flex-direction: column;
      max-height: 88vh;
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
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .header-icon-box {
      width: 42px;
      height: 42px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .header-titles h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      color: #1e3a8a;
    }
    .header-titles .subtitle {
      margin: 2px 0 0;
      font-size: 12px;
      color: #3b82f6;
    }
    .header-titles .subtitle strong {
      color: #1e40af;
    }
    .close-btn {
      background: rgba(255, 255, 255, 0.75);
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      cursor: pointer;
    }
    .close-btn:hover { color: #1e293b; background: #ffffff; }

    .dialog-body {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .single-loader {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 48px 20px;
      color: #475569;
      font-weight: 600;
    }
    .cf-form-card, .cf-list-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
    }
    .cf-form-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: #1e3a8a;
      margin-bottom: 12px;
    }
    .cf-form-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px 14px;
    }
    .cf-form-grid .full-span {
      grid-column: 1 / -1;
    }
    .cf-toggles-row {
      display: flex;
      flex-wrap: wrap;
      gap: 18px;
      margin: 6px 0 12px;
    }
    .cf-form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .cf-list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .cf-list-header strong {
      font-size: 14px;
      color: #0f172a;
    }
    .hint-txt {
      font-size: 11.5px;
      color: #64748b;
    }
    .empty-state {
      text-align: center;
      padding: 28px 16px;
      color: #64748b;
    }
    .empty-state mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: #94a3b8;
    }
    .table-responsive {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .cf-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 540px;
    }
    .cf-table th {
      text-align: left;
      font-size: 11.5px;
      font-weight: 700;
      color: #475569;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 8px 10px;
      white-space: nowrap;
    }
    .cf-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 12.5px;
      vertical-align: middle;
    }
    .f-label {
      font-weight: 700;
      color: #0f172a;
    }
    .f-key {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    .f-key code {
      background: #f1f5f9;
      padding: 1px 5px;
      border-radius: 4px;
      color: #334155;
    }
    .type-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 11px;
      font-weight: 700;
    }
    .opts-sub {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 2px;
      max-width: 180px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bool-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      background: #f1f5f9;
      color: #64748b;
    }
    .bool-pill.yes {
      background: #dcfce7;
      color: #166534;
    }
    .dialog-footer {
      padding: 12px 20px;
      border-top: 1px solid #e2e8f0;
      background: #ffffff;
      display: flex;
      justify-content: flex-end;
      flex-shrink: 0;
    }
    @media (max-width: 768px) {
      .cf-form-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ManageCustomFieldsDialogComponent implements OnInit {
  entityType = 'Student';
  fields: CustomFieldDefinitionDto[] = [];
  isLoading = false;
  isSaving = false;
  editingId: string | null = null;
  hasChanges = false;
  fieldForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private customFieldsService: CustomFieldsService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    public dialogRef: MatDialogRef<ManageCustomFieldsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ManageCustomFieldsDialogData | null
  ) {
    this.entityType = data?.entityType || 'Student';
    this.fieldForm = this.fb.group({
      fieldLabel: new FormControl('', [Validators.required, Validators.maxLength(120)]),
      dataType: new FormControl('Text', [Validators.required]),
      placeholder: new FormControl(''),
      dropdownOptionsText: new FormControl(''),
      isRequired: new FormControl(false),
      showInTable: new FormControl(true)
    });
  }

  ngOnInit(): void {
    this.loadFields();
  }

  loadFields(): void {
    this.isLoading = true;
    this.cdr.markForCheck();
    this.customFieldsService.getCustomFields(this.entityType, false).subscribe({
      next: (res) => {
        this.fields = res || [];
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  saveField(): void {
    if (this.fieldForm.invalid) {
      this.fieldForm.markAllAsTouched();
      return;
    }

    const v = this.fieldForm.value;
    const opts = v.dataType === 'Dropdown'
      ? String(v.dropdownOptionsText || '').split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const payload: SaveCustomFieldRequestDto = {
      entityType: this.entityType,
      fieldLabel: (v.fieldLabel || '').trim(),
      dataType: v.dataType || 'Text',
      placeholder: (v.placeholder || '').trim() || null,
      dropdownOptions: opts,
      isRequired: !!v.isRequired,
      showInTable: !!v.showInTable,
      isActive: true
    };

    this.isSaving = true;
    this.cdr.markForCheck();

    const obs = this.editingId
      ? this.customFieldsService.updateCustomField(this.editingId, payload)
      : this.customFieldsService.createCustomField(payload);

    obs.subscribe({
      next: () => {
        this.isSaving = false;
        this.hasChanges = true;
        this.cancelEdit();
        this.loadFields();
      },
      error: (err) => {
        this.isSaving = false;
        this.cdr.markForCheck();
        this.confirmDialog.alert('Save Failed', err?.error?.message || 'Could not save custom field.', 'danger');
      }
    });
  }

  startEdit(f: CustomFieldDefinitionDto): void {
    this.editingId = f.id;
    this.fieldForm.patchValue({
      fieldLabel: f.fieldLabel,
      dataType: f.dataType || 'Text',
      placeholder: f.placeholder || '',
      dropdownOptionsText: (f.dropdownOptions || []).join(', '),
      isRequired: !!f.isRequired,
      showInTable: !!f.showInTable
    });
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editingId = null;
    this.fieldForm.reset({
      fieldLabel: '',
      dataType: 'Text',
      placeholder: '',
      dropdownOptionsText: '',
      isRequired: false,
      showInTable: true
    });
    this.cdr.markForCheck();
  }

  deleteField(f: CustomFieldDefinitionDto): void {
    this.confirmDialog.confirm(
      'Remove Custom Field?',
      `Are you sure you want to remove "${f.fieldLabel}" from the ${this.entityType} form? Existing saved values will remain safely preserved in history.`,
      'Remove',
      'Cancel',
      'danger'
    ).subscribe((confirmed) => {
      if (!confirmed) return;
      this.customFieldsService.deleteCustomField(f.id).subscribe({
        next: () => {
          this.hasChanges = true;
          this.loadFields();
        },
        error: (err) => {
          this.confirmDialog.alert('Delete Failed', err?.error?.message || 'Failed to remove custom field.', 'danger');
        }
      });
    });
  }

  closeDialog(): void {
    this.dialogRef.close(this.hasChanges);
  }
}
