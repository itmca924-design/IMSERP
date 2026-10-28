import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRadioModule } from '@angular/material/radio';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDividerModule } from '@angular/material/divider';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { InventoryItem, CreateOutwardDto, StudentLookupItem, StaffLookupItem } from '../inventory.models';
import { InventoryService } from '../inventory.service';
import { SchoolService, SchoolClassDto } from '../../../core/services/school.service';

export interface InventoryOutwardDialogData {
  items: InventoryItem[];
  branchId?: string;
  presetIssueType?: 'StudentKitSale' | 'StaffDepartmentIssue';
}

@Component({
  selector: 'app-inventory-outward-dialog',
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
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatRadioModule,
    MatAutocompleteModule,
    MatDividerModule
  ],
  template: `
    <div class="dialog-container">
      <!-- Strict ERP Light-Blue Gradient Header -->
      <div class="dialog-header">
        <div class="dialog-header-left">
          <div class="header-icon-box">
            <mat-icon>outbox</mat-icon>
          </div>
          <div class="header-title-wrap">
            <h2>Stock Outward / Issue & Student Kit Distribution</h2>
            <p>Issue stationery, uniforms, books, or lab consumables with live stock deduction</p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="onCancel()" type="button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-body">
          <!-- Issue Mode Selector -->
          <div class="mode-selector-wrap">
            <span class="mode-label">Distribution Mode:</span>
            <mat-radio-group formControlName="issueType" class="mode-radios" (change)="onModeChange()">
              <mat-radio-button value="StudentKitSale" color="primary">
                <strong>Student Kit Sale / Issue</strong> (Uniform, Books, Stationery kit)
              </mat-radio-button>
              <mat-radio-button value="StaffDepartmentIssue" color="primary">
                <strong>Staff & Dept Issue</strong> (Pens, Chalk, Registers, Lab items)
              </mat-radio-button>
            </mat-radio-group>
          </div>

          <!-- Recipient Section -->
          <div class="section-title">
            <mat-icon>person</mat-icon>
            <span>Recipient Details</span>
          </div>

          <!-- If Student Kit Sale: 50% Class-wise Dropdowns + 50% Quick Search Box -->
          <div *ngIf="isStudentMode()" class="student-picker-container">
            <div class="student-picker-grid">
              <!-- 50%: Class-wise Student Dropdowns (Class + Student) -->
              <div class="class-student-pair">
                <mat-form-field appearance="outline" class="class-field" subscriptSizing="dynamic">
                  <mat-label>Select Class</mat-label>
                  <mat-select [formControl]="selectedClassCtrl" (selectionChange)="onClassChange($event.value)" placeholder="Choose Class">
                    <mat-option [value]="null">-- Select Class --</mat-option>
                    <mat-option *ngFor="let c of classesList" [value]="c.id">
                      {{ c.name }}
                    </mat-option>
                  </mat-select>
                  <mat-icon matPrefix class="picker-prefix-icon">school</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="student-select-field" subscriptSizing="dynamic">
                  <mat-label>Select Student</mat-label>
                  <mat-select
                    [formControl]="selectedClassStudentCtrl"
                    (selectionChange)="onClassStudentChange($event.value)"
                    [disabled]="!selectedClassCtrl.value || loadingClassStudents"
                    placeholder="Choose Student">
                    <mat-option *ngIf="loadingClassStudents" disabled>
                      Loading students...
                    </mat-option>
                    <mat-option *ngIf="!loadingClassStudents && selectedClassCtrl.value && classStudents.length === 0" disabled>
                      No students found
                    </mat-option>
                    <mat-option *ngFor="let s of classStudents" [value]="s">
                      Roll {{ s.rollNumber || '-' }} — {{ s.fullName }} <span *ngIf="s.sectionName" class="sec-text">({{ s.sectionName }})</span>
                    </mat-option>
                  </mat-select>
                  <mat-icon matPrefix class="picker-prefix-icon">person</mat-icon>
                </mat-form-field>
              </div>

              <!-- 50%: Quick Search Student (Name or Roll No) -->
              <div class="search-box-field-wrap">
                <mat-form-field appearance="outline" class="w-full" subscriptSizing="dynamic">
                  <mat-label>Search Student (Name or Roll No)</mat-label>
                  <input
                    matInput
                    placeholder="Type name, roll no, or phone..."
                    [formControl]="studentSearchCtrl"
                    [matAutocomplete]="studentAuto" />
                  <mat-icon matPrefix class="picker-prefix-icon">search</mat-icon>
                  <mat-spinner matSuffix *ngIf="searchingStudents" diameter="18"></mat-spinner>
                  <button type="button" matSuffix *ngIf="studentSearchCtrl.value && !searchingStudents" (click)="clearStudentSearchInput($event)" class="clear-search-btn" matTooltip="Clear search">
                    <mat-icon>close</mat-icon>
                  </button>
                  <mat-autocomplete #studentAuto="matAutocomplete" (optionSelected)="onStudentSelectedFromSearch($event.option.value)">
                    <mat-option *ngFor="let s of studentSearchResults" [value]="s">
                      <strong>{{ s.fullName }}</strong> | Roll: {{ s.rollNumber }} | Class: {{ s.className || 'N/A' }} {{ s.sectionName || '' }}
                    </mat-option>
                  </mat-autocomplete>
                </mat-form-field>
              </div>
            </div>

            <!-- Selected Student Pill -->
            <div *ngIf="selectedStudent" class="selected-student-pill">
              <mat-icon class="check-icon">check_circle</mat-icon>
              <div class="pill-info">
                <span class="st-name">{{ selectedStudent.fullName }}</span>
                <span class="st-meta">Roll No: <strong>{{ selectedStudent.rollNumber }}</strong> | Class: <strong>{{ selectedStudent.className || 'N/A' }} {{ selectedStudent.sectionName || '' }}</strong></span>
              </div>
              <button mat-icon-button type="button" (click)="clearSelectedStudent()" class="clear-st-btn" matTooltip="Deselect Student">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>

          <!-- If Staff/Dept Issue -->
          <div *ngIf="!isStudentMode()" class="staff-issue-block">
            <div class="form-grid top-grid">
              <!-- Dropdown for Teacher / Staff / HR -->
              <mat-form-field appearance="outline" class="staff-select-field">
                <mat-label>Issued To (Select Staff / Teacher / HR / Person)*</mat-label>
                <mat-select
                  [formControl]="selectedStaffCtrl"
                  (selectionChange)="onStaffSelected($event.value)"
                  placeholder="Select Staff, Teacher, or HR">
                  
                  <mat-select-trigger *ngIf="selectedStaff && !isManualStaffMode">
                    <div class="select-trigger-val">
                      <span class="trigger-name"><strong>{{ selectedStaff.fullName }}</strong> ({{ selectedStaff.employeeCode }})</span>
                      <span class="staff-role-badge" [ngClass]="getStaffBadgeClass(selectedStaff)">{{ getStaffRoleLabel(selectedStaff) }}</span>
                    </div>
                  </mat-select-trigger>

                  <mat-option [value]="'__MANUAL__'">
                    <div class="staff-option-row manual-opt">
                      <mat-icon class="opt-prefix-icon">person_add</mat-icon>
                      <span><strong>+ Other / External Person</strong> (Type Name Manually)</span>
                    </div>
                  </mat-option>
                  <mat-divider></mat-divider>

                  <!-- Teaching Staff (Teachers / Faculty) -->
                  <mat-optgroup label="Teaching Faculty (Teachers)" *ngIf="teachingStaff.length > 0">
                    <mat-option *ngFor="let s of teachingStaff" [value]="s">
                      <div class="staff-option-row">
                        <div class="staff-info-col">
                          <span class="st-fullname"><strong>{{ s.fullName }}</strong> ({{ s.employeeCode }})</span>
                          <span class="st-sub" *ngIf="s.designation || s.department">
                            {{ s.designation || 'Teacher' }} <span *ngIf="s.department">• {{ s.department }}</span>
                          </span>
                        </div>
                        <span class="staff-role-badge badge-teacher">Teacher</span>
                      </div>
                    </mat-option>
                  </mat-optgroup>

                  <!-- Non-Teaching Staff (HR, Admin, Accounts, Lab, Support) -->
                  <mat-optgroup label="Non-Teaching & Management (HR, Admin, Accounts, Staff)" *ngIf="nonTeachingStaff.length > 0">
                    <mat-option *ngFor="let s of nonTeachingStaff" [value]="s">
                      <div class="staff-option-row">
                        <div class="staff-info-col">
                          <span class="st-fullname"><strong>{{ s.fullName }}</strong> ({{ s.employeeCode }})</span>
                          <span class="st-sub" *ngIf="s.designation || s.department">
                            {{ s.designation || 'Staff' }} <span *ngIf="s.department">• {{ s.department }}</span>
                          </span>
                        </div>
                        <span class="staff-role-badge" [ngClass]="getStaffBadgeClass(s)">{{ getStaffRoleLabel(s) }}</span>
                      </div>
                    </mat-option>
                  </mat-optgroup>
                </mat-select>
                <mat-icon matPrefix class="picker-prefix-icon">badge</mat-icon>
                <mat-error *ngIf="form.get('issuedToName')?.hasError('required')">
                  Recipient is required
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Department / Classroom / Lab</mat-label>
                <input matInput formControlName="departmentOrClass" placeholder="e.g. Physics Lab, Staff Room, Class 10-A" />
                <mat-icon matPrefix class="picker-prefix-icon">meeting_room</mat-icon>
              </mat-form-field>
            </div>

            <!-- Manual Name Input if '__MANUAL__' selected -->
            <div *ngIf="isManualStaffMode" class="manual-name-row">
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Recipient Name (Staff / Person)*</mat-label>
                <input matInput formControlName="issuedToName" placeholder="Enter recipient person's name..." />
                <mat-icon matPrefix class="picker-prefix-icon">person</mat-icon>
                <mat-error *ngIf="form.get('issuedToName')?.hasError('required')">
                  Recipient name is required
                </mat-error>
              </mat-form-field>
            </div>

            <!-- Selected Staff Pill -->
            <div *ngIf="selectedStaff && !isManualStaffMode" class="selected-staff-pill">
              <mat-icon class="badge-icon">badge</mat-icon>
              <div class="pill-info">
                <div class="pill-top">
                  <span class="st-name">{{ selectedStaff.fullName }}</span>
                  <span class="st-code">({{ selectedStaff.employeeCode }})</span>
                  <span class="staff-role-badge" [ngClass]="getStaffBadgeClass(selectedStaff)">{{ getStaffRoleLabel(selectedStaff) }}</span>
                </div>
                <span class="st-meta" *ngIf="selectedStaff.department || selectedStaff.designation">
                  {{ selectedStaff.designation || 'Staff' }} <span *ngIf="selectedStaff.department">• {{ selectedStaff.department }}</span>
                </span>
              </div>
              <button mat-icon-button type="button" (click)="clearSelectedStaff()" class="clear-st-btn" matTooltip="Clear Selection">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>

          <!-- Date & Payment Row -->
          <div class="form-grid meta-grid">
            <mat-form-field appearance="outline">
              <mat-label>Issue Date</mat-label>
              <input matInput type="date" formControlName="issueDate" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Payment / Cost Treatment</mat-label>
              <mat-select formControlName="paymentStatus">
                <mat-option value="Free/Complimentary">Free / Institute Internal Issue</mat-option>
                <mat-option value="Paid">Paid by Student (Cash / UPI)</mat-option>
                <mat-option value="AddedToFeeBill">Charge to Student Fee Card</mat-option>
                <mat-option value="Unpaid">Unpaid / Due</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" *ngIf="form.get('paymentStatus')?.value === 'Paid'">
              <mat-label>Payment Mode</mat-label>
              <mat-select formControlName="paymentMode">
                <mat-option value="Cash">Cash</mat-option>
                <mat-option value="UPI">UPI / Dynamic QR</mat-option>
                <mat-option value="Bank">Bank Transfer</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Dynamic Item Rows Section -->
          <div class="items-header-row">
            <div class="section-title">
              <mat-icon>inventory_2</mat-icon>
              <span>Items to Issue</span>
            </div>
            <button mat-stroked-button color="primary" type="button" (click)="addItemRow()" class="add-row-btn">
              <mat-icon>add</mat-icon>
              <span>Add Item</span>
            </button>
          </div>

          <div formArrayName="items" class="items-table-wrapper">
            <div class="item-line-card" *ngFor="let line of itemRows.controls; let i = index" [formGroupName]="i">
              <div class="line-index-badge">#{{ i + 1 }}</div>

              <!-- Item selection -->
              <div class="item-select-wrap">
                <mat-form-field appearance="outline" class="w-full">
                  <mat-label>Select Item</mat-label>
                  <mat-select formControlName="itemId" (selectionChange)="onItemSelect(i, $event.value)">
                    <mat-option *ngFor="let itm of data.items" [value]="itm.id" [disabled]="itm.currentStock <= 0">
                      <strong>{{ itm.itemName }}</strong> ({{ itm.itemCode }})
                      <span [ngClass]="getStockBadgeClass(itm.currentStock, itm.minStockAlertLevel)">
                        — Stock: {{ itm.currentStock }} {{ itm.unitOfMeasurement }}
                      </span>
                    </mat-option>
                  </mat-select>
                  <mat-hint *ngIf="getSelectedLineItem(i) as selItm" class="stock-avail-hint">
                    Available in store: <strong>{{ selItm.currentStock }} {{ selItm.unitOfMeasurement }}</strong>
                    <span *ngIf="selItm.rackOrLocation" class="rack-hint">Rack: {{ selItm.rackOrLocation }}</span>
                  </mat-hint>
                </mat-form-field>
              </div>

              <!-- Quantity -->
              <mat-form-field appearance="outline" class="qty-field">
                <mat-label>Qty</mat-label>
                <input matInput type="number" formControlName="quantity" min="1" (input)="computeTotals()" />
                <mat-error *ngIf="line.get('quantity')?.hasError('exceedsStock')">
                  Exceeds stock!
                </mat-error>
              </mat-form-field>

              <!-- Unit Selling/Issue Price -->
              <mat-form-field appearance="outline" class="rate-field">
                <mat-label>Rate (₹)</mat-label>
                <input matInput type="number" formControlName="unitPrice" min="0" step="0.5" (input)="computeTotals()" />
              </mat-form-field>

              <!-- Line Total Computed -->
              <div class="line-total-box">
                <span class="sub-label">Total</span>
                <span class="val">₹{{ getLineTotal(i) | number:'1.2-2' }}</span>
              </div>

              <!-- Remove button -->
              <button mat-icon-button color="warn" type="button" (click)="removeItemRow(i)" [disabled]="itemRows.length === 1" matTooltip="Remove Line">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
          </div>

          <!-- Bottom Remarks & Grand Total -->
          <div class="summary-section">
            <mat-form-field appearance="outline" class="remarks-field">
              <mat-label>Remarks / Purpose of Issue</mat-label>
              <textarea matInput formControlName="remarks" rows="2" [placeholder]="remarksPlaceholder"></textarea>
            </mat-form-field>

            <div class="totals-card">
              <div class="total-row">
                <span>Total Items:</span>
                <strong>{{ itemRows.length }} Line(s)</strong>
              </div>
              <div class="total-row net-row">
                <span>Total Issue Value:</span>
                <strong class="net-val">₹{{ grandTotal | number:'1.2-2' }}</strong>
              </div>
            </div>
          </div>
        </mat-dialog-content>

        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onCancel()" [disabled]="submitting">
            Cancel
          </button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting || hasStockErrors() || itemRows.length === 0">
            <mat-spinner diameter="18" *ngIf="submitting" class="spinner-btn"></mat-spinner>
            <span>Confirm & Issue Items</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 92vh;
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
    .close-btn { color: #64748b; &:hover { color: #1e293b; } }
    .dialog-body {
      padding: 16px 20px;
      max-height: 70vh;
      overflow-y: auto;
    }
    .mode-selector-wrap {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 14px;
      .mode-label { font-weight: 600; color: #1e3a8a; font-size: 0.88rem; }
      .mode-radios { display: flex; gap: 20px; }
    }
    .section-title {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #1e3a8a;
      font-weight: 600;
      font-size: 0.92rem;
      margin-bottom: 8px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
    }
    .top-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1.2fr 1.5fr 1.2fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    .student-picker-container {
      margin-bottom: 14px;
    }
    .student-picker-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      align-items: start;
    }
    .class-student-pair {
      display: grid;
      grid-template-columns: 1fr 1.3fr;
      gap: 10px;
      align-items: center;
      mat-form-field {
        width: 100%;
      }
    }
    .search-box-field-wrap {
      width: 100%;
      mat-form-field {
        width: 100%;
      }
      ::ng-deep .mat-mdc-form-field-icon-suffix {
        align-self: center !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 100% !important;
        padding-right: 6px !important;
      }
    }
    .picker-prefix-icon {
      color: #3b82f6;
      font-size: 20px;
      width: 20px;
      height: 20px;
      margin-right: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
    }
    .sec-text {
      color: #64748b;
      font-size: 0.8rem;
    }
    .clear-search-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: transparent;
      border: none;
      outline: none;
      cursor: pointer;
      width: 26px !important;
      height: 26px !important;
      padding: 0 !important;
      margin: 0 !important;
      border-radius: 50%;
      vertical-align: middle;
      transition: background-color 0.15s ease, color 0.15s ease;
      mat-icon {
        font-size: 18px !important;
        width: 18px !important;
        height: 18px !important;
        line-height: 18px !important;
        color: #94a3b8;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      &:hover {
        background: #fee2e2;
        mat-icon {
          color: #dc2626;
        }
      }
    }
    .selected-student-pill {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 10px;
      margin-bottom: 8px;
      .check-icon { color: #16a34a; font-size: 22px; width: 22px; height: 22px; }
      .pill-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        .st-name { font-weight: 700; color: #166534; font-size: 0.95rem; }
        .st-meta { font-size: 0.8rem; color: #15803d; }
      }
      .clear-st-btn { color: #94a3b8; &:hover { color: #dc2626; } }
    }
    .staff-issue-block {
      margin-bottom: 12px;
    }
    .manual-name-row {
      margin-top: -6px;
      margin-bottom: 8px;
    }
    .staff-option-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 12px;
      padding: 4px 0;
      &.manual-opt {
        color: #2563eb;
        display: flex;
        align-items: center;
        gap: 8px;
        .opt-prefix-icon {
          color: #2563eb;
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }
    }
    .staff-info-col {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
      .st-fullname {
        color: #0f172a;
        font-size: 0.9rem;
      }
      .st-sub {
        font-size: 0.76rem;
        color: #64748b;
      }
    }
    .select-trigger-val {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      .trigger-name {
        color: #0f172a;
        font-size: 0.9rem;
      }
    }
    .staff-role-badge {
      display: inline-flex;
      align-items: center;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .badge-teacher {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }
    .badge-hr {
      background: #faf5ff;
      color: #7e22ce;
      border: 1px solid #e9d5ff;
    }
    .badge-accounts {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }
    .badge-admin {
      background: #f0f9ff;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }
    .badge-lab {
      background: #fffbeb;
      color: #b45309;
      border: 1px solid #fde68a;
    }
    .badge-library {
      background: #f0fdfa;
      color: #0f766e;
      border: 1px solid #99f6e4;
    }
    .badge-mgmt {
      background: #fff1f2;
      color: #be123c;
      border: 1px solid #fecdd3;
    }
    .badge-staff {
      background: #f8fafc;
      color: #475569;
      border: 1px solid #cbd5e1;
    }
    .selected-staff-pill {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 4px;
      margin-bottom: 8px;
      .badge-icon {
        color: #16a34a;
        font-size: 22px;
        width: 22px;
        height: 22px;
      }
      .pill-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        .pill-top {
          display: flex;
          align-items: center;
          gap: 8px;
          .st-name {
            font-weight: 700;
            color: #166534;
            font-size: 0.95rem;
          }
          .st-code {
            font-size: 0.82rem;
            color: #15803d;
          }
        }
        .st-meta {
          font-size: 0.78rem;
          color: #15803d;
        }
      }
      .clear-st-btn {
        color: #94a3b8;
        &:hover {
          color: #dc2626;
        }
      }
    }
    .items-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px dashed #cbd5e1;
      padding-top: 14px;
      margin-bottom: 10px;
    }
    .items-table-wrapper {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 16px;
    }
    .item-line-card {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .line-index-badge {
      font-size: 0.75rem;
      font-weight: 700;
      color: #64748b;
      background: #e2e8f0;
      padding: 4px 8px;
      border-radius: 6px;
      margin-top: 12px;
    }
    .item-select-wrap {
      flex: 3;
      min-width: 280px;
    }
    .w-full {
      width: 100%;
    }
    .stock-avail-hint {
      display: inline-flex !important;
      align-items: center;
      gap: 5px;
      font-size: 0.78rem !important;
      color: #475569 !important;
      padding-top: 4px;
      strong {
        color: #15803d;
        font-weight: 700;
      }
      .rack-hint {
        color: #475569;
        background: #e2e8f0;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 0.72rem;
        font-style: normal;
        margin-left: 2px;
      }
    }
    .qty-field {
      flex: 1;
      min-width: 90px;
    }
    .rate-field {
      flex: 1;
      min-width: 90px;
    }
    .line-total-box {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      min-width: 90px;
      padding-right: 6px;
      margin-top: 10px;
      .sub-label { font-size: 0.7rem; color: #64748b; text-transform: uppercase; }
      .val { font-weight: 700; color: #0f172a; font-size: 0.95rem; }
    }
    .badge-in-stock { color: #16a34a; font-size: 0.8rem; }
    .badge-low-stock { color: #d97706; font-size: 0.8rem; font-weight: 600; }
    .badge-out-stock { color: #dc2626; font-size: 0.8rem; font-weight: 700; }
    .summary-section {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 16px;
      border-top: 1px solid #e2e8f0;
      padding-top: 14px;
      align-items: flex-start;
    }
    .remarks-field { width: 100%; }
    .totals-card {
      background: #f1f5f9;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .total-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.88rem;
      color: #334155;
    }
    .net-row {
      border-top: 1px solid #cbd5e1;
      padding-top: 6px;
      margin-top: 4px;
      font-size: 1rem;
      font-weight: 700;
      color: #1e3a8a;
    }
    .net-val { font-size: 1.15rem; color: #2563eb; }
    .dialog-actions {
      padding: 12px 20px 16px;
      border-top: 1px solid #f1f5f9;
      gap: 8px;
    }
    .w-full { width: 100%; }
    @media (max-width: 900px) {
      .student-picker-grid { grid-template-columns: 1fr; gap: 10px; }
      .class-student-pair { grid-template-columns: 1fr 1fr; }
      .top-grid, .meta-grid { grid-template-columns: 1fr; }
      .item-line-card { flex-wrap: wrap; }
      .summary-section { grid-template-columns: 1fr; }
    }
    @media (max-width: 600px) {
      .dialog-header {
        padding: 10px 14px;
      }
      .dialog-header-left {
        gap: 8px;
        min-width: 0;
        flex: 1;
      }
      .header-icon-box {
        width: 32px;
        height: 32px;
        min-width: 32px;
        border-radius: 8px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
      .header-title-wrap {
        min-width: 0;
        flex: 1;
      }
      .header-title-wrap h2 {
        font-size: 0.92rem;
        line-height: 1.25;
      }
      .header-title-wrap p {
        font-size: 0.7rem;
        line-height: 1.2;
      }
      .dialog-body {
        padding: 10px 12px;
        max-height: 72vh;
      }
      .mode-selector-wrap {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 8px 10px;
        margin-bottom: 10px;
      }
      .mode-radios {
        flex-direction: column;
        gap: 6px;
        width: 100%;
      }
      .mode-radios mat-radio-button {
        width: 100%;
        font-size: 0.78rem;
        line-height: 1.3;
      }
      .class-student-pair {
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .student-picker-grid {
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .top-grid, .meta-grid {
        grid-template-columns: 1fr;
        gap: 8px;
        margin-bottom: 8px;
      }
      .item-line-card {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 8px 10px;
      }
      .line-index-badge {
        grid-column: span 2;
        width: fit-content;
        margin: 0;
      }
      .item-select-wrap {
        grid-column: span 2;
        width: 100%;
        min-width: 100%;
      }
      .qty-field {
        grid-column: 1;
        min-width: 0;
        width: 100%;
      }
      .rate-field {
        grid-column: 2;
        min-width: 0;
        width: 100%;
      }
      .line-total-box {
        grid-column: 1;
        align-items: flex-start;
        margin-top: 0;
      }
      .item-line-card > button {
        grid-column: 2;
        justify-self: flex-end;
      }
      .summary-section {
        grid-template-columns: 1fr;
        gap: 10px;
      }
      .dialog-actions {
        padding: 10px 12px 14px;
        gap: 8px;
      }
      .dialog-actions button {
        font-size: 0.82rem;
        height: 38px;
      }
    }
  `]
})
export class InventoryOutwardDialogComponent implements OnInit {
  form!: FormGroup;
  studentSearchCtrl = this.fb.control('');
  studentSearchResults: StudentLookupItem[] = [];
  selectedStudent: StudentLookupItem | null = null;
  submitting = false;
  grandTotal = 0;

  // Class-wise Student Selection
  classesList: SchoolClassDto[] = [];
  selectedClassCtrl = this.fb.control<string | null>(null);
  selectedClassStudentCtrl = this.fb.control<StudentLookupItem | null>(null);
  classStudents: StudentLookupItem[] = [];
  loadingClassStudents = false;
  searchingStudents = false;

  // Staff / Teacher / HR Selection
  staffList: StaffLookupItem[] = [];
  teachingStaff: StaffLookupItem[] = [];
  nonTeachingStaff: StaffLookupItem[] = [];
  selectedStaff: StaffLookupItem | null = null;
  selectedStaffCtrl = this.fb.control<StaffLookupItem | string | null>(null);
  isManualStaffMode = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<InventoryOutwardDialogComponent>,
    private readonly inventoryService: InventoryService,
    private readonly schoolService: SchoolService,
    @Inject(MAT_DIALOG_DATA) public readonly data: InventoryOutwardDialogData
  ) {}

  get itemRows(): FormArray {
    return this.form.get('items') as FormArray;
  }

  isStudentMode(): boolean {
    return this.form.get('issueType')?.value === 'StudentKitSale';
  }

  ngOnInit(): void {
    const today = new Date().toISOString().substring(0, 10);
    const initialMode = this.data.presetIssueType || 'StudentKitSale';

    this.form = this.fb.group({
      issueType: [initialMode, [Validators.required]],
      studentId: [null],
      issuedToName: ['', [Validators.required]],
      departmentOrClass: [''],
      issueDate: [today, [Validators.required]],
      paymentStatus: [initialMode === 'StudentKitSale' ? 'Paid' : 'Free/Complimentary', [Validators.required]],
      paymentMode: ['Cash'],
      remarks: [''],
      items: this.fb.array([])
    });

    // Load active school classes for class-wise student dropdown
    this.schoolService.getClasses(true).subscribe({
      next: (classes) => {
        this.classesList = classes || [];
      },
      error: (err) => console.error('Failed to load school classes', err)
    });

    // Load active staff and teachers for Staff & Dept Issue mode
    this.inventoryService.getStaffLookup(this.data.branchId).subscribe({
      next: (staff) => {
        this.staffList = staff || [];
        this.teachingStaff = this.staffList.filter(s => s.staffType === 'Teaching');
        this.nonTeachingStaff = this.staffList.filter(s => s.staffType !== 'Teaching');
      },
      error: (err) => console.error('Failed to load staff list', err)
    });

    // Setup student search debounce (supports searching inside selected class or all classes)
    this.studentSearchCtrl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || typeof query !== 'string' || query.trim().length < 2) {
          this.searchingStudents = false;
          return of([]);
        }
        this.searchingStudents = true;
        // Search globally across branch so quick search is completely separate and independent
        return this.inventoryService.searchStudents(query, this.data.branchId, undefined);
      })
    ).subscribe({
      next: (results) => {
        this.studentSearchResults = results;
        this.searchingStudents = false;
      },
      error: () => {
        this.searchingStudents = false;
      }
    });

    // Add first item line
    this.addItemRow();
  }

  onClassChange(classId: string | null): void {
    this.selectedClassStudentCtrl.setValue(null);
    this.classStudents = [];
    if (!classId) return;

    this.loadingClassStudents = true;
    this.inventoryService.searchStudents(undefined, this.data.branchId, classId).subscribe({
      next: (students) => {
        this.classStudents = students || [];
        this.loadingClassStudents = false;
        if (this.selectedStudent) {
          const match = this.classStudents.find(s => s.id === this.selectedStudent?.id);
          if (match) {
            this.selectedClassStudentCtrl.setValue(match, { emitEvent: false });
          }
        }
      },
      error: () => {
        this.loadingClassStudents = false;
      }
    });
  }

  onClassStudentChange(student: StudentLookupItem | null): void {
    if (student) {
      this.selectedStudent = student;
      this.form.patchValue({
        studentId: student.id,
        issuedToName: student.fullName,
        departmentOrClass: `Class ${student.className || 'N/A'} ${student.sectionName || ''}`.trim()
      });
      // Do NOT set studentSearchCtrl - user will search separately if needed
    }
  }

  get remarksPlaceholder(): string {
    const now = new Date();
    const curYear = now.getFullYear();
    const startYear = now.getMonth() >= 3 ? curYear : curYear - 1;
    return `e.g. Annual Kit issue for Session ${startYear}-${String(startYear + 1).slice(-2)}`;
  }

  clearStudentSearchInput(event?: Event): void {
    if (event) event.stopPropagation();
    this.studentSearchCtrl.setValue('');
    this.studentSearchResults = [];
  }

  onStaffSelected(val: StaffLookupItem | string | null): void {
    if (val === '__MANUAL__') {
      this.isManualStaffMode = true;
      this.selectedStaff = null;
      this.form.get('issuedToName')?.setValue('');
    } else if (val && typeof val === 'object') {
      this.isManualStaffMode = false;
      this.selectedStaff = val;
      this.form.get('issuedToName')?.setValue(val.fullName);

      let deptStr = '';
      if (val.department && val.designation) {
        deptStr = `${val.department} (${val.designation})`;
      } else if (val.department) {
        deptStr = val.department;
      } else if (val.designation) {
        deptStr = val.designation;
      }
      if (deptStr) {
        this.form.get('departmentOrClass')?.setValue(deptStr);
      }
    } else {
      this.selectedStaff = null;
      this.isManualStaffMode = false;
      this.form.get('issuedToName')?.setValue('');
    }
  }

  clearSelectedStaff(): void {
    this.selectedStaff = null;
    this.selectedStaffCtrl.setValue(null);
    this.isManualStaffMode = false;
    this.form.get('issuedToName')?.setValue('');
    this.form.get('departmentOrClass')?.setValue('');
  }

  getStaffRoleLabel(s: StaffLookupItem): string {
    const d = (s.designation || '').toLowerCase();
    const dept = (s.department || '').toLowerCase();

    if (d.includes('hr') || dept.includes('hr')) return 'HR';
    if (d.includes('account') || dept.includes('finance') || dept.includes('account')) return 'Accounts';
    if (d.includes('admin') || dept.includes('admin') || d.includes('reception') || d.includes('front desk')) return 'Admin';
    if (d.includes('lab') || dept.includes('lab')) return 'Lab Staff';
    if (d.includes('library') || dept.includes('library')) return 'Library';
    if (d.includes('principal') || d.includes('director') || d.includes('hod')) return 'Management';
    if (s.staffType === 'Teaching' || d.includes('teacher') || d.includes('faculty') || d.includes('tgt') || d.includes('pgt') || d.includes('prt')) return 'Teacher';
    return s.designation || 'Staff';
  }

  getStaffBadgeClass(s: StaffLookupItem): string {
    const role = this.getStaffRoleLabel(s).toLowerCase();
    if (role.includes('hr')) return 'badge-hr';
    if (role.includes('accounts')) return 'badge-accounts';
    if (role.includes('admin')) return 'badge-admin';
    if (role.includes('lab')) return 'badge-lab';
    if (role.includes('library')) return 'badge-library';
    if (role.includes('teacher')) return 'badge-teacher';
    if (role.includes('management')) return 'badge-mgmt';
    return 'badge-staff';
  }

  onModeChange(): void {
    const mode = this.form.get('issueType')?.value;
    if (mode === 'StudentKitSale') {
      this.form.patchValue({
        paymentStatus: 'Paid',
        paymentMode: 'Cash'
      });
      if (this.selectedStudent) {
        this.form.patchValue({
          studentId: this.selectedStudent.id,
          issuedToName: this.selectedStudent.fullName,
          departmentOrClass: `Class ${this.selectedStudent.className || 'N/A'} ${this.selectedStudent.sectionName || ''}`.trim()
        });
      } else {
        this.form.get('studentId')?.setValue(null);
        this.form.get('issuedToName')?.setValue('');
        this.form.get('departmentOrClass')?.setValue('');
      }
    } else {
      this.form.patchValue({
        paymentStatus: 'Free/Complimentary',
        paymentMode: null,
        studentId: null
      });
      if (this.selectedStaff && !this.isManualStaffMode) {
        this.form.get('issuedToName')?.setValue(this.selectedStaff.fullName);
        const deptStr = this.selectedStaff.department && this.selectedStaff.designation
          ? `${this.selectedStaff.department} (${this.selectedStaff.designation})`
          : (this.selectedStaff.department || this.selectedStaff.designation || '');
        this.form.get('departmentOrClass')?.setValue(deptStr);
      } else if (!this.isManualStaffMode) {
        this.form.get('issuedToName')?.setValue('');
        this.form.get('departmentOrClass')?.setValue('');
      }
    }
    this.computeTotals();
  }

  onStudentSelectedFromSearch(student: StudentLookupItem): void {
    this.selectedStudent = student;
    this.form.patchValue({
      studentId: student.id,
      issuedToName: student.fullName,
      departmentOrClass: `Class ${student.className || 'N/A'} ${student.sectionName || ''}`.trim()
    });
    // Clear search input so user can search separately whenever needed
    this.studentSearchCtrl.setValue('', { emitEvent: false });
    this.studentSearchResults = [];

    // Sync class dropdown and class students if available
    const targetClassId = student.classId || this.classesList.find(c => c.name.toLowerCase() === student.className?.toLowerCase())?.id;
    if (targetClassId && this.selectedClassCtrl.value !== targetClassId) {
      this.selectedClassCtrl.setValue(targetClassId, { emitEvent: false });
      this.loadingClassStudents = true;
      this.inventoryService.searchStudents(undefined, this.data.branchId, targetClassId).subscribe({
        next: (students) => {
          this.classStudents = students || [];
          this.loadingClassStudents = false;
          const match = this.classStudents.find(s => s.id === student.id);
          this.selectedClassStudentCtrl.setValue(match || student, { emitEvent: false });
        },
        error: () => {
          this.loadingClassStudents = false;
        }
      });
    } else if (targetClassId && this.selectedClassCtrl.value === targetClassId) {
      const match = this.classStudents.find(s => s.id === student.id);
      this.selectedClassStudentCtrl.setValue(match || student, { emitEvent: false });
    }
  }

  clearSelectedStudent(): void {
    this.selectedStudent = null;
    this.studentSearchCtrl.setValue('', { emitEvent: false });
    this.studentSearchResults = [];
    this.selectedClassStudentCtrl.setValue(null);
    this.form.patchValue({
      studentId: null,
      issuedToName: '',
      departmentOrClass: ''
    });
  }

  addItemRow(): void {
    // Pick first item that has positive stock
    const availableItem = this.data.items.find(i => i.currentStock > 0) || (this.data.items.length > 0 ? this.data.items[0] : null);
    const row = this.fb.group({
      itemId: [availableItem?.id || '', [Validators.required]],
      quantity: [1, [Validators.required, Validators.min(0.01)]],
      unitPrice: [this.isStudentMode() ? (availableItem?.sellingPrice || 0) : 0, [Validators.min(0)]],
      remarks: ['']
    });
    this.itemRows.push(row);
    this.validateRowStock(this.itemRows.length - 1);
    this.computeTotals();
  }

  removeItemRow(index: number): void {
    if (this.itemRows.length > 1) {
      this.itemRows.removeAt(index);
      this.computeTotals();
    }
  }

  onItemSelect(index: number, itemId: string): void {
    const found = this.data.items.find(i => i.id === itemId);
    if (found) {
      const row = this.itemRows.at(index);
      row.patchValue({
        unitPrice: this.isStudentMode() ? (found.sellingPrice || 0) : 0
      });
      this.validateRowStock(index);
      this.computeTotals();
    }
  }

  getSelectedLineItem(index: number): InventoryItem | undefined {
    const itemId = this.itemRows.at(index)?.get('itemId')?.value;
    return this.data.items.find(i => i.id === itemId);
  }

  validateRowStock(index: number): void {
    const row = this.itemRows.at(index);
    const item = this.getSelectedLineItem(index);
    const qty = Number(row.get('quantity')?.value) || 0;

    if (item && qty > item.currentStock) {
      row.get('quantity')?.setErrors({ exceedsStock: true });
    } else {
      const errs = row.get('quantity')?.errors;
      if (errs && errs['exceedsStock']) {
        delete errs['exceedsStock'];
        row.get('quantity')?.setErrors(Object.keys(errs).length ? errs : null);
      }
    }
  }

  hasStockErrors(): boolean {
    for (let i = 0; i < this.itemRows.length; i++) {
      if (this.itemRows.at(i).get('quantity')?.hasError('exceedsStock')) {
        return true;
      }
    }
    return false;
  }

  getLineTotal(index: number): number {
    const row = this.itemRows.at(index);
    const qty = Number(row.get('quantity')?.value) || 0;
    const price = Number(row.get('unitPrice')?.value) || 0;
    return qty * price;
  }

  computeTotals(): void {
    let sum = 0;
    for (let i = 0; i < this.itemRows.length; i++) {
      this.validateRowStock(i);
      sum += this.getLineTotal(i);
    }
    this.grandTotal = sum;
  }

  getStockBadgeClass(stock: number, minLevel: number): string {
    if (stock <= 0) return 'badge-out-stock';
    if (stock <= minLevel) return 'badge-low-stock';
    return 'badge-in-stock';
  }

  onSubmit(): void {
    if (this.form.invalid || this.hasStockErrors() || this.itemRows.length === 0) return;

    const val = this.form.value;
    const lines = val.items.map((row: any) => ({
      itemId: row.itemId,
      quantity: Number(row.quantity) || 1,
      unitPrice: Number(row.unitPrice) || 0,
      remarks: row.remarks?.trim() || undefined
    }));

    const result: CreateOutwardDto = {
      issueType: val.issueType,
      studentId: val.studentId || undefined,
      issuedToName: val.issuedToName.trim(),
      departmentOrClass: val.departmentOrClass?.trim() || undefined,
      issueDate: val.issueDate,
      paymentStatus: val.paymentStatus,
      paymentMode: val.paymentMode || undefined,
      remarks: val.remarks?.trim() || undefined,
      branchId: this.data.branchId,
      items: lines
    };

    this.dialogRef.close(result);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
