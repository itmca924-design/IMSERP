import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule, AbstractControl, ValidationErrors, FormControl } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { CoachingService } from '../../core/services/coaching.service';
import { SchoolService, SchoolClassDto, SchoolSectionDto } from '../../core/services/school.service';
import { HostelService, HostelDto, HostelBedDto } from '../../core/services/hostel.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { LibraryService, LibraryMembershipPlanDto } from '../../core/services/library.service';
import { StudentLeavingDialogComponent } from './student-leaving-dialog.component';
import { StudentReadmissionDialogComponent } from './student-readmission-dialog.component';
import { ManageLibraryPlansDialogComponent } from '../library/manage-library-plans-dialog.component';
import { StudentIdCardDialogComponent } from './student-id-card-dialog.component';
import { StudentBonafideDialogComponent } from './student-bonafide-dialog.component';
import { StudentProfile360DialogComponent } from './student-profile-360-dialog.component';
import { StudentRollSequencerDialogComponent } from './student-roll-sequencer-dialog.component';
import { StudentPortalLoginDialogComponent } from './student-portal-login-dialog.component';
import { AuthService } from '../../core/services/auth.service';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryItem } from '../inventory/inventory.models';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';
import { environment } from '../../../environments/environment';

const API_BASE = environment.apiBaseUrl;

export class DateRangeInstantErrorMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: any | null): boolean {
    const isControlInvalid = !!(control && control.invalid && (control.dirty || control.touched || control.value));
    const isCrossConflict = !!(control?.hasError('dojBeforeDob') || (form && form.hasError && form.hasError('dojBeforeDob')));
    return isControlInvalid || isCrossConflict;
  }
}

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatDialogModule,
    MatMenuModule,
    MatDividerModule,
    IstDatetimeDirective
  ],
  template: `
    <div class="students-wrapper">
      <div class="header-actions">
        <div>
          <h2>Student Directory &amp; Admissions</h2>
          <p *ngIf="authService.hasSchoolModule() && authService.hasCoachingModule()">Unified admissions for School &amp; Coaching. School students can seamlessly enroll into evening coaching batches.</p>
          <p *ngIf="authService.hasSchoolModule() && !authService.hasCoachingModule()">Comprehensive school student admissions, academic class assignments, and student directory.</p>
          <p *ngIf="!authService.hasSchoolModule() && authService.hasCoachingModule()">Manage student admissions, batch enrollments, and coaching tuition records.</p>
        </div>
        <div class="header-btns">
          <a *ngIf="authService.hasSchoolModule() && !authService.isTeacher()" mat-stroked-button routerLink="/students/promotion" class="promotion-link-btn">
            <mat-icon>trending_up</mat-icon>
            <span>Promote Students</span>
          </a>

          <!-- Quick Operations Dropdown -->
          <button mat-stroked-button [matMenuTriggerFor]="quickActionsMenu" class="more-actions-btn" matTooltip="Student Leaves, Gate Passes, Classes &amp; Roll Sequencer">
            <mat-icon style="color:#0284c7;">tune</mat-icon>
            <span>More Actions</span>
            <mat-icon style="font-size:18px; width:18px; height:18px; margin-left:2px;">arrow_drop_down</mat-icon>
          </button>
          <mat-menu #quickActionsMenu="matMenu" class="student-quick-menu">
            <a mat-menu-item routerLink="/students/leaves">
              <mat-icon style="color:#d97706;">event_busy</mat-icon>
              <span>Student Leaves</span>
            </a>
            <a mat-menu-item routerLink="/students/gate-pass">
              <mat-icon style="color:#0284c7;">meeting_room</mat-icon>
              <span>Gate Passes</span>
            </a>
            <mat-divider *ngIf="authService.hasSchoolModule() && !authService.isTeacher()"></mat-divider>
            <a *ngIf="authService.hasSchoolModule() && !authService.isTeacher()" mat-menu-item routerLink="/school/classes">
              <mat-icon style="color:#2563eb;">domain</mat-icon>
              <span>Classes &amp; Sections</span>
            </a>
            <button *ngIf="authService.hasSchoolModule() && !authService.isTeacher()" mat-menu-item (click)="openRollSequencer()">
              <mat-icon style="color:#7c3aed;">format_list_numbered</mat-icon>
              <span>Roll No. Sequencer</span>
            </button>
          </mat-menu>

          <button *ngIf="!authService.isTeacher()" mat-raised-button color="primary" class="add-btn" (click)="toggleForm()">
            <mat-icon>{{ showForm ? 'close' : 'person_add' }}</mat-icon>
            <span>{{ showForm ? 'Cancel' : (isEditMode ? 'Edit Student' : 'New Admission') }}</span>
          </button>
        </div>
      </div>

      <!-- Add/Edit Student Form Card -->
      <mat-card *ngIf="showForm" class="form-card mat-elevation-z2">
        <mat-card-content>
          <div class="form-title">
            <mat-icon color="primary">{{ isEditMode ? 'edit' : 'person_add' }}</mat-icon>
            <span>{{ isEditMode ? 'Edit Student Record' : 'New Student Admission &amp; Enrollment' }}</span>
          </div>

          <form [formGroup]="studentForm" (ngSubmit)="onSubmitStudent()" class="form-grid">

            <!-- Profile Photo Upload (full-width, centered) -->
            <div class="photo-upload-area full-span">
              <div class="photo-preview-wrap">
                <div class="photo-circle" (click)="triggerFileInput()">
                  <img *ngIf="photoPreview" [src]="photoPreview" alt="Preview" class="photo-img" />
                  <div *ngIf="!photoPreview" class="photo-placeholder">
                    <mat-icon class="photo-placeholder-icon">add_a_photo</mat-icon>
                    <span>Upload Photo</span>
                  </div>
                </div>
                <div class="photo-actions">
                  <button mat-stroked-button type="button" color="primary" (click)="triggerFileInput()">
                    <mat-icon>upload</mat-icon> {{ photoPreview ? 'Change Photo' : 'Upload Photo' }}
                  </button>
                  <button mat-icon-button type="button" color="warn" *ngIf="photoPreview" (click)="removePhoto()" matTooltip="Remove photo">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
              <input #fileInput type="file" accept="image/*" style="display:none" (change)="onFileSelected($event)" />
            </div>

            <!-- Enrollment Streams Selector Box -->
            <div class="stream-selector-box full-span">
              <div class="stream-selector-title">
                <mat-icon color="primary">hub</mat-icon>
                <span>Select Enrollment Stream(s)</span>
              </div>
              <div class="stream-checkboxes">
                <mat-checkbox *ngIf="authService.hasSchoolModule()" formControlName="isSchoolStudent" (change)="onStreamCheckChanged()" color="primary">
                  <span class="chk-label">🏫 <strong>School Enrollment</strong> (Class, Section, Admission No)</span>
                </mat-checkbox>
                <mat-checkbox *ngIf="authService.hasCoachingModule()" formControlName="isCoachingStudent" (change)="onStreamCheckChanged()" color="primary">
                  <span class="chk-label">🎯 <strong>Coaching Enrollment</strong> (Batch, Monthly Tuition Fee)</span>
                </mat-checkbox>
                <mat-checkbox *ngIf="authService.hasHostelModule()" formControlName="isHostelStudent" (change)="onHostelCheckChanged()" color="accent">
                  <span class="chk-label">🏨 <strong>Hostel Resident (Optional)</strong> (Room &amp; Bed Allotment)</span>
                </mat-checkbox>
                <mat-checkbox *ngIf="authService.hasLibraryModule()" formControlName="isLibraryMember" (change)="onLibraryCheckChanged()" color="primary">
                  <span class="chk-label">📚 <strong>Library Membership (Optional)</strong> (Books &amp; Reading Shifts)</span>
                </mat-checkbox>
                <mat-checkbox *ngIf="authService.hasInventoryModule()" formControlName="isIssueAdmissionKit" (change)="onKitCheckChanged()" color="primary">
                  <span class="chk-label">🎒 <strong>Admission Kit Issuance</strong> (Uniform, Books, Stationery)</span>
                </mat-checkbox>
              </div>
              <div class="stream-hint-kit-info" *ngIf="studentForm.value.isIssueAdmissionKit">
                <mat-icon>verified</mat-icon>
                <span><strong>Smart ERP Rule Active:</strong> Physical kit items are issued directly from Store Stock. The system will <u>automatically protect</u> this student from duplicate Books/Uniform charges in Fee Matrix.</span>
              </div>
              <div class="stream-hint-warn" *ngIf="!studentForm.value.isSchoolStudent && !studentForm.value.isCoachingStudent && (authService.hasSchoolModule() || authService.hasCoachingModule())">
                <mat-icon>warning_amber</mat-icon>
                <span>Please select at least one stream ({{ authService.hasSchoolModule() && authService.hasCoachingModule() ? 'School, Coaching, or both' : (authService.hasSchoolModule() ? 'School' : 'Coaching') }}).</span>
              </div>
            </div>

            <!-- School Section Details (if School is checked) -->
            <ng-container *ngIf="studentForm.value.isSchoolStudent">
              <div class="section-divider-box full-span school-sect">
                <mat-icon>domain</mat-icon>
                <span>School Academic Assignment</span>
              </div>

              <mat-form-field appearance="outline">
                <mat-label>Admission / SR Number</mat-label>
                <input matInput formControlName="admissionNumber" [readonly]="true" style="cursor:default;color:#1e40af;font-weight:600;" />
                <mat-icon matSuffix matTooltip="Auto-generated on admission">lock</mat-icon>
                <mat-hint>Auto-generated Institutional Admission / SR Number</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Admission / Joining Date *</mat-label>
                <input matInput type="date" formControlName="joiningDate" [min]="minDoj" [max]="maxDoj" [errorStateMatcher]="dateErrorMatcher" />
                <mat-icon matSuffix>event</mat-icon>
                <mat-hint>Allowed range: 01/01/2010 to {{ maxDoj }}</mat-hint>
                <mat-error *ngIf="studentForm.get('joiningDate')?.hasError('required')">Admission date is required</mat-error>
                <mat-error *ngIf="studentForm.get('joiningDate')?.hasError('futureDate')">Admission date cannot be more than 1 year in advance (Max: {{ maxDoj }})</mat-error>
                <mat-error *ngIf="studentForm.get('joiningDate')?.hasError('invalidRange')">Date must be between 01/01/2010 and {{ maxDoj }}</mat-error>
                <mat-error *ngIf="studentForm.hasError('dojBeforeDob') || studentForm.get('joiningDate')?.hasError('dojBeforeDob')">Admission date must be strictly after Date of Birth</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>School Class</mat-label>
                <mat-select formControlName="classId" (selectionChange)="onClassSelectionChange($event.value)" panelClass="batch-filter-panel">
                  <mat-option *ngFor="let c of schoolClasses" [value]="c.id">
                    {{ c.name }}
                  </mat-option>
                </mat-select>
                <mat-error *ngIf="studentForm.get('classId')?.hasError('required')">School Class is required</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Class Section</mat-label>
                <mat-select formControlName="sectionId" panelClass="batch-filter-panel">
                  <mat-option *ngFor="let s of formSections" [value]="s.id">
                    Section {{ s.name }} (Cap: {{ s.maxCapacity }}{{ s.roomNumber ? ' • Room ' + s.roomNumber : '' }})
                  </mat-option>
                </mat-select>
                <mat-hint *ngIf="formSections.length === 0 && studentForm.value.classId">No sections configured for this class</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>School Roll Number</mat-label>
                <input matInput formControlName="schoolRollNumber" [readonly]="true" style="cursor:default;color:#1e40af;font-weight:600;" />
                <mat-icon matSuffix matTooltip="Auto-generated based on class">lock</mat-icon>
                <mat-hint *ngIf="!isEditMode">Auto-generated when class is selected (starts from 1 per class)</mat-hint>
              </mat-form-field>
            </ng-container>

            <!-- Coaching Section Details (if Coaching is checked) -->
            <ng-container *ngIf="studentForm.value.isCoachingStudent">
              <div class="section-divider-box full-span coaching-sect">
                <mat-icon>school</mat-icon>
                <span>Coaching Batch &amp; Fee Assignment</span>
              </div>

              <mat-form-field appearance="outline" *ngIf="!studentForm.value.isSchoolStudent">
                <mat-label>Admission / Joining Date *</mat-label>
                <input matInput type="date" formControlName="joiningDate" [min]="minDoj" [max]="maxDoj" [errorStateMatcher]="dateErrorMatcher" />
                <mat-icon matSuffix>event</mat-icon>
                <mat-hint>Allowed range: 01/01/2010 to {{ maxDoj }}</mat-hint>
                <mat-error *ngIf="studentForm.get('joiningDate')?.hasError('required')">Admission date is required</mat-error>
                <mat-error *ngIf="studentForm.get('joiningDate')?.hasError('futureDate')">Admission date cannot be more than 1 year in advance (Max: {{ maxDoj }})</mat-error>
                <mat-error *ngIf="studentForm.get('joiningDate')?.hasError('invalidRange')">Date must be between 01/01/2010 and {{ maxDoj }}</mat-error>
                <mat-error *ngIf="studentForm.hasError('dojBeforeDob') || studentForm.get('joiningDate')?.hasError('dojBeforeDob')">Admission date must be strictly after Date of Birth</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Coaching Batch</mat-label>
                <mat-select formControlName="batchId" panelClass="batch-filter-panel">
                  <mat-option *ngFor="let b of batches" [value]="b.id">
                    {{ b.name }} (₹{{ b.standardMonthlyFee }}/mo)
                  </mat-option>
                </mat-select>
                <mat-error *ngIf="studentForm.get('batchId')?.hasError('required')">Batch selection is required for coaching</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Coaching Roll Number</mat-label>
                <input matInput formControlName="rollNumber" [readonly]="true" placeholder="Select batch first..." style="cursor: default;" />
                <mat-icon matSuffix *ngIf="!rollNumberLoading" matTooltip="Auto-generated based on batch">lock</mat-icon>
                <mat-progress-bar mode="indeterminate" *ngIf="rollNumberLoading" style="position:absolute;bottom:0;left:0;right:0;"></mat-progress-bar>
                <mat-hint *ngIf="!isEditMode">Auto-generated when batch is selected</mat-hint>
                <mat-error *ngIf="studentForm.get('rollNumber')?.hasError('required')">Roll number is required</mat-error>
              </mat-form-field>
            </ng-container>

            <!-- Hostel Residential Details (if Hostel is checked) -->
            <ng-container *ngIf="studentForm.value.isHostelStudent">
              <div class="section-divider-box full-span hostel-sect">
                <mat-icon>apartment</mat-icon>
                <span>Hostel Residential &amp; Bed Assignment (Optional Facility)</span>
              </div>

              <mat-form-field appearance="outline">
                <mat-label>Hostel Building / Block</mat-label>
                <mat-select formControlName="hostelId" (selectionChange)="onHostelBuildingChange($event.value)" panelClass="batch-filter-panel">
                  <mat-option *ngFor="let h of hostelsList" [value]="h.id">
                    {{ h.name }} ({{ h.hostelType }}) - {{ h.availableBeds }} beds vacant
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Select Available Bed</mat-label>
                <mat-select formControlName="hostelBedId" (selectionChange)="onBedSelectionChange($event.value)" panelClass="batch-filter-panel">
                  <mat-option *ngFor="let b of availableBedsList" [value]="b.id">
                    Room {{ b.roomNumber }} - Bed {{ b.bedCode }} (₹{{ b.monthlyRent | number }}/mo)
                  </mat-option>
                </mat-select>
                <mat-hint *ngIf="selectedBedRent">Monthly Bed Rent: ₹{{ selectedBedRent | number }}</mat-hint>
              </mat-form-field>
            </ng-container>

            <!-- Library Membership Details (if Library is checked) -->
            <ng-container *ngIf="studentForm.value.isLibraryMember">
              <div class="section-divider-box full-span library-sect">
                <mat-icon>local_library</mat-icon>
                <span>Library Facility &amp; Reading Room Details (Optional Facility)</span>
              </div>

              <mat-form-field appearance="outline">
                <mat-label>Membership Type / Shift</mat-label>
                <mat-select formControlName="libraryMembershipType" (selectionChange)="onLibraryPlanSelectionChange($event.value)" panelClass="batch-filter-panel">
                  <mat-option *ngFor="let plan of libraryPlans" [value]="plan.planName">
                    {{ plan.planName }} {{ plan.monthlyFee > 0 ? '(₹' + (plan.monthlyFee | number) + '/mo)' : '(Free / ₹0)' }}
                  </mat-option>
                </mat-select>
                <button mat-icon-button matSuffix type="button" (click)="openManagePlansModal(); $event.stopPropagation()" matTooltip="Configure Shifts & Pricing">
                  <mat-icon color="primary" style="font-size: 20px; width: 20px; height: 20px;">settings</mat-icon>
                </button>
                <button mat-icon-button matSuffix type="button" (click)="loadLibraryPlans(); $event.stopPropagation()" matTooltip="Refresh Shifts List">
                  <mat-icon style="font-size: 18px; width: 18px; height: 18px; color: #64748b;">refresh</mat-icon>
                </button>
                <mat-hint>Select lending or coaching self-study shift</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Library Card / Barcode No.</mat-label>
                <input matInput formControlName="libraryCardNumber" placeholder="e.g. LIB-2026-1045" />
                <button mat-icon-button matSuffix type="button" (click)="autoGenerateLibraryCard()" matTooltip="Auto-generate Library Card Number">
                  <mat-icon color="primary">autorenew</mat-icon>
                </button>
                <mat-hint>Library card or barcode identifier</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Max Book Borrow Limit</mat-label>
                <input matInput type="number" formControlName="maxLibraryBooks" min="1" max="10" />
                <mat-hint>Max books student can hold at a time (Default: 2)</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Monthly Library Fee (₹)</mat-label>
                <input matInput type="number" formControlName="monthlyLibraryFee" min="0" />
                <mat-hint>Keep ₹0 for free lending, or set monthly reading fee</mat-hint>
              </mat-form-field>
            </ng-container>

            <!-- Admission Kit Section (if Admission Kit is checked) -->
            <!-- Admission Kit Section (if Admission Kit is checked) -->
            <ng-container *ngIf="studentForm.value.isIssueAdmissionKit">
              <div class="section-divider-box full-span kit-sect">
                <mat-icon>inventory_2</mat-icon>
                <span>Admission Kit Issuance (Books, Uniform, Stationery Distribution)</span>
              </div>

              <!-- ERP Auto-Safeguard Notice Card -->
              <div class="full-span kit-guidance-card" *ngIf="!isEditMode || !studentExistingKitOutward">
                <div class="guidance-icon-box">
                  <mat-icon>shield</mat-icon>
                </div>
                <div class="guidance-content">
                  <div class="guidance-title">ERP Auto-Protection Rule: Zero Double-Billing Guarantee</div>
                  <p class="guidance-desc">
                    Physical uniform, books &amp; stationery items selected below will be distributed from store inventory and billed directly via Store Outward / Kit Invoice.
                    <strong>You do not need to check Books/Uniform in Fee Matrix</strong> — the invoicing engine automatically skips those heads for students who receive a kit.
                  </p>
                </div>
              </div>

              <!-- Existing Kit Banner in Edit Mode -->
              <div class="full-span existing-kit-alert-box" *ngIf="isEditMode && studentExistingKitOutward">
                <div class="kit-alert-left">
                  <mat-icon class="kit-alert-icon">check_circle</mat-icon>
                  <div>
                    <strong class="kit-alert-title">Kit Distributed to Student (Slip: {{ studentExistingKitOutward.issueNumber }})</strong>
                    <div class="kit-alert-meta">
                      <span>Issued on: <strong [appIstDatetime]="studentExistingKitOutward.issueDate" format="date"></strong></span>
                      <span class="meta-sep">•</span>
                      <span>Payment Status: <strong class="badge-status-kit">{{ studentExistingKitOutward.paymentStatus }}</strong></span>
                      <span class="meta-sep" *ngIf="studentExistingKitOutward.paymentMode">•</span>
                      <span *ngIf="studentExistingKitOutward.paymentMode">Mode: <strong>{{ studentExistingKitOutward.paymentMode }}</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Payment Handling (only if not already issued) -->
              <mat-form-field appearance="outline" *ngIf="!isEditMode || !studentExistingKitOutward">
                <mat-label>Kit Payment Status</mat-label>
                <mat-select formControlName="kitPaymentStatus">
                  <mat-option value="AddedToFeeBill">Added to Student Fee Bill (Pending Invoice)</mat-option>
                  <mat-option value="Paid">Paid at Counter (Instant Cash/UPI)</mat-option>
                  <mat-option value="Free/Complimentary">Free / Complimentary Kit (₹0)</mat-option>
                </mat-select>
                <mat-hint>Choose how kit cost is collected</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" *ngIf="(!isEditMode || !studentExistingKitOutward) && studentForm.value.kitPaymentStatus === 'Paid'">
                <mat-label>Counter Payment Mode</mat-label>
                <mat-select formControlName="kitPaymentMode">
                  <mat-option value="Cash">Cash</mat-option>
                  <mat-option value="UPI">UPI / QR Code</mat-option>
                  <mat-option value="Card">Debit / Credit Card</mat-option>
                  <mat-option value="BankTransfer">Direct Bank Transfer</mat-option>
                </mat-select>
                <mat-hint>Payment received at reception counter</mat-hint>
              </mat-form-field>

              <!-- Selected Kit Items Table / Line Builder -->
              <div class="full-span admission-kit-panel">
                <div class="kit-panel-header">
                  <div class="kit-header-left">
                    <mat-icon class="kit-header-icon" color="primary">inventory_2</mat-icon>
                    <div>
                      <span class="panel-title">{{ isEditMode && studentExistingKitOutward ? 'Kit Items Distributed to Student' : 'Kit Items to Issue from Store' }}</span>
                      <p class="panel-subtitle">{{ isEditMode && studentExistingKitOutward ? 'Items previously issued to this student from inventory stock' : 'Select items below to distribute to student upon admission' }}</p>
                    </div>
                  </div>
                  <div class="add-item-controls">
                    <mat-form-field appearance="outline" class="item-picker-field" subscriptSizing="dynamic">
                      <mat-label>Select Item to Add</mat-label>
                      <mat-select [(value)]="selectedKitItemId" placeholder="Choose uniform, book, bag..." panelClass="batch-filter-panel">
                        <mat-option *ngFor="let it of availableInventoryItems" [value]="it.id" [disabled]="it.currentStock <= 0">
                          {{ it.itemName }} (₹{{ it.sellingPrice | number:'1.2-2' }}) — Stock: {{ it.currentStock }} {{ it.unitOfMeasurement }}
                        </mat-option>
                      </mat-select>
                    </mat-form-field>
                    <button mat-raised-button color="primary" type="button" (click)="addSelectedKitItem()" [disabled]="!selectedKitItemId">
                      <mat-icon>add</mat-icon> Add to Kit
                    </button>
                  </div>
                </div>

                <div class="table-responsive kit-items-table" *ngIf="admissionKitRows.length > 0; else noKitItemsSelected">
                  <table class="kit-table">
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th class="text-center" style="width: 100px;">Qty</th>
                        <th class="text-right" style="width: 140px;">Unit Price (₹)</th>
                        <th class="text-right" style="width: 140px;">Total (₹)</th>
                        <th class="text-center" style="width: 130px;">Status</th>
                        <th class="text-center" style="width: 80px;">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of admissionKitRows; let idx = index" [class.existing-row]="row.isExistingIssue">
                        <td>
                          <div class="item-name-cell">
                            <span class="item-main-title">{{ row.itemName }}</span>
                            <span class="code-pill">{{ row.itemCode }}</span>
                          </div>
                        </td>
                        <td class="text-center">
                          <span *ngIf="row.isExistingIssue" class="qty-badge font-bold">{{ row.quantity }}</span>
                          <input *ngIf="!row.isExistingIssue" type="number" class="kit-qty-input" [(ngModel)]="row.quantity" [ngModelOptions]="{standalone: true}" (input)="recalculateKitTotal()" min="1" [max]="row.maxStock" />
                        </td>
                        <td class="text-right">
                          <span *ngIf="row.isExistingIssue" class="price-val">₹{{ row.unitPrice | number:'1.2-2' }}</span>
                          <input *ngIf="!row.isExistingIssue" type="number" class="kit-price-input" [(ngModel)]="row.unitPrice" [ngModelOptions]="{standalone: true}" (input)="recalculateKitTotal()" min="0" />
                        </td>
                        <td class="text-right row-total-val font-bold text-primary">₹{{ (row.quantity * row.unitPrice) | number:'1.2-2' }}</td>
                        <td class="text-center">
                          <span *ngIf="row.isExistingIssue" class="badge-issued-item">
                            <mat-icon class="badge-mini-icon">check_circle</mat-icon> Distributed
                          </span>
                          <span *ngIf="!row.isExistingIssue" class="badge-new-item">
                            <mat-icon class="badge-mini-icon">add_circle</mat-icon> New Line
                          </span>
                        </td>
                        <td class="text-center">
                          <button *ngIf="!row.isExistingIssue" mat-icon-button color="warn" type="button" (click)="removeKitItem(idx)" matTooltip="Remove Line">
                            <mat-icon>delete</mat-icon>
                          </button>
                          <span *ngIf="row.isExistingIssue" class="check-icon-wrap" matTooltip="Already distributed to student">
                            <mat-icon class="check-icon-dimmed">check_circle</mat-icon>
                          </span>
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colspan="3" class="total-label">Total Kit Value:</td>
                        <td class="total-val">₹{{ totalKitPayable | number:'1.2-2' }}</td>
                        <td colspan="2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <ng-template #noKitItemsSelected>
                  <div class="empty-kit-banner">
                    <mat-icon>info</mat-icon>
                    <span *ngIf="isEditMode">No kit items found for this student.</span>
                    <span *ngIf="!isEditMode">Select items from inventory above to build the student's admission kit. Stock will be auto-deducted upon saving admission.</span>
                  </div>
                </ng-template>
              </div>
            </ng-container>

            <!-- Personal Information Section -->
            <div class="section-divider-box full-span info-sect">
              <mat-icon>person</mat-icon>
              <span>Student Personal &amp; Family Information</span>
            </div>

            <mat-form-field appearance="outline">
              <mat-label>Student Full Name</mat-label>
              <input matInput formControlName="studentName" placeholder="e.g. Rahul Sharma" />
              <mat-error *ngIf="studentForm.get('studentName')?.hasError('required')">Student name is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Gender</mat-label>
              <mat-select formControlName="gender">
                <mat-option value="Male">Male</mat-option>
                <mat-option value="Female">Female</mat-option>
                <mat-option value="Other">Other</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Date of Birth</mat-label>
              <input matInput type="date" formControlName="dateOfBirth"
                [min]="minDob"
                [max]="maxDob"
                [errorStateMatcher]="dateErrorMatcher" />
              <mat-hint *ngIf="getNepAgeAdvisory() as advisory">
                <span class="age-pill-inline" [ngClass]="'age-pill-' + advisory.type" [matTooltip]="advisory.message">
                  <mat-icon *ngIf="advisory.type === 'success'">check_circle</mat-icon>
                  <mat-icon *ngIf="advisory.type === 'warning'">warning</mat-icon>
                  <mat-icon *ngIf="advisory.type === 'info'">info</mat-icon>
                  <span>{{ advisory.badge }}</span>
                </span>
              </mat-hint>
              <mat-hint *ngIf="!getNepAgeAdvisory()">DD/MM/YYYY • Allowed: 01/01/1950 to Today</mat-hint>
              <mat-error *ngIf="studentForm.get('dateOfBirth')?.hasError('futureDate')">Date of birth cannot be in the future (Max: Today)</mat-error>
              <mat-error *ngIf="studentForm.get('dateOfBirth')?.hasError('tooOld')">Please enter a valid date of birth (1950 to Today)</mat-error>
              <mat-error *ngIf="studentForm.hasError('dojBeforeDob') || studentForm.get('dateOfBirth')?.hasError('dojBeforeDob')">Date of birth must be before Admission date</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Blood Group</mat-label>
              <mat-select formControlName="bloodGroup">
                <mat-option value="">Not Specified</mat-option>
                <mat-option value="A+">A+</mat-option>
                <mat-option value="A-">A-</mat-option>
                <mat-option value="B+">B+</mat-option>
                <mat-option value="B-">B-</mat-option>
                <mat-option value="O+">O+</mat-option>
                <mat-option value="O-">O-</mat-option>
                <mat-option value="AB+">AB+</mat-option>
                <mat-option value="AB-">AB-</mat-option>
              </mat-select>
              <mat-hint>Optional medical record</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Father / Guardian Name</mat-label>
              <input matInput formControlName="parentName" placeholder="e.g. Suresh Sharma" />
              <mat-error *ngIf="studentForm.get('parentName')?.hasError('required')">Father/Guardian name is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Mother Name (Optional)</mat-label>
              <input matInput formControlName="motherName" placeholder="e.g. Sunita Sharma" />
            </mat-form-field>

            <div class="phone-address-row full-span">
              <div class="phone-field-wrap">
                <mat-form-field appearance="outline" class="full-width-field" [class.sibling-field-active]="!!siblingInfo">
                  <mat-label>Parent WhatsApp Phone Number (Optional)</mat-label>
                  <span matPrefix class="phone-prefix">+91&nbsp;</span>
                  <input
                    matInput
                    type="tel"
                    formControlName="parentWhatsAppPhone"
                    placeholder="98765 43210"
                    maxlength="11"
                    (input)="onPhoneInput($event)"
                  />
                  <mat-icon matSuffix color="primary" *ngIf="!phoneCheckLoading && !siblingInfo">chat</mat-icon>
                  <mat-icon matSuffix class="sibling-suffix-icon" [class.warning]="!isParentNameMatching" *ngIf="!phoneCheckLoading && siblingInfo" [matTooltip]="isParentNameMatching ? 'Family / Sibling Linked' : 'Different Parent Name'">{{ isParentNameMatching ? 'family_restroom' : 'warning_amber' }}</mat-icon>
                  <mat-spinner matSuffix diameter="18" *ngIf="phoneCheckLoading" style="margin-right:6px"></mat-spinner>
                  <mat-error *ngIf="studentForm.get('parentWhatsAppPhone')?.hasError('duplicate')">
                    {{ phoneDuplicateError }}
                  </mat-error>
                  <mat-error *ngIf="studentForm.get('parentWhatsAppPhone')?.hasError('invalidPhone') && !studentForm.get('parentWhatsAppPhone')?.hasError('duplicate')">
                    Please enter a valid 10-digit mobile number (e.g. 98765 43210)
                  </mat-error>
                </mat-form-field>

                <!-- Smart Sibling / Parent Validation Info Card -->
                <div class="sibling-detected-box" [class.warning]="!isParentNameMatching" *ngIf="siblingInfo">
                  <div class="sibling-header">
                    <div class="sibling-badge-icon" [class.warning]="!isParentNameMatching">
                      <mat-icon>{{ isParentNameMatching ? 'family_restroom' : 'warning_amber' }}</mat-icon>
                    </div>
                    <div class="sibling-details">
                      <div class="sibling-title-row">
                        <span class="sibling-title" [class.warning-title]="!isParentNameMatching">
                          {{ isParentNameMatching ? 'Sibling / Family Member Detected' : 'Notice: Different Parent Name Detected' }}
                        </span>
                        <span class="sibling-status-pill" [class.warning-pill]="!isParentNameMatching">
                          {{ isParentNameMatching ? 'Sibling Verified ✓' : 'Verify Parent / Number ⚠️' }}
                        </span>
                      </div>
                      <p class="sibling-desc">
                        Mobile number is registered to student <strong>{{ siblingInfo.studentName }}</strong>
                        <span *ngIf="siblingInfo.parentName"> with Parent: <strong>{{ siblingInfo.parentName }}</strong></span>.
                        <span *ngIf="!isParentNameMatching && currentEnteredParentName">
                          (You entered Parent: <strong>"{{ currentEnteredParentName }}"</strong>)
                        </span>
                      </p>

                      <!-- Quick Action if Parent Name differs -->
                      <div class="sibling-action-row" *ngIf="!isParentNameMatching && siblingInfo.parentName">
                        <button type="button" mat-stroked-button class="btn-copy-parent" (click)="useLinkedParentName()">
                          <mat-icon>how_to_reg</mat-icon> Set Parent as "{{ siblingInfo.parentName }}"
                        </button>
                        <span class="differ-note">If {{ currentEnteredParentName }} is a guardian/relative or shared phone, you can still save.</span>
                      </div>

                      <!-- Quick Action if Address differs or can be copied -->
                      <div class="sibling-action-row" *ngIf="siblingInfo.address && studentForm.get('address')?.value !== siblingInfo.address">
                        <button type="button" mat-stroked-button class="btn-copy-parent" (click)="useLinkedAddress()">
                          <mat-icon>home</mat-icon> Set Address from Sibling
                        </button>
                      </div>

                      <div class="sibling-tags">
                        <span class="sibling-tag branch" *ngIf="siblingInfo.branchName">
                          <mat-icon>domain</mat-icon>
                          <span>Branch: {{ siblingInfo.branchName }}</span>
                        </span>
                        <span class="sibling-tag batch" *ngIf="siblingInfo.batchName">
                          <mat-icon>school</mat-icon>
                          <span>Batch: {{ siblingInfo.batchName }}</span>
                        </span>
                        <span class="sibling-tag address" *ngIf="siblingInfo.address" [matTooltip]="siblingInfo.address">
                          <mat-icon>home</mat-icon>
                          <span>Address: {{ siblingInfo.address }}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <mat-form-field appearance="outline" class="address-field">
                <mat-label>Residential Address</mat-label>
                <mat-icon matPrefix style="color:#64748b;margin-right:4px;font-size:18px;width:18px;height:18px;">home</mat-icon>
                <input matInput formControlName="address" placeholder="e.g. Flat 302, Green Park Apartments, New Delhi" />
              </mat-form-field>
            </div>

            <!-- Government Compliance & Student Identifiers (UDISE+ / NEP 2020) -->
            <div class="section-divider-box full-span compliance-sect">
              <mat-icon>verified_user</mat-icon>
              <span>Government Compliance &amp; Student Identifiers (UDISE+ / NEP)</span>
            </div>

            <mat-form-field appearance="outline">
              <mat-label>Social Category / Quota</mat-label>
              <mat-select formControlName="category">
                <mat-option value="General">General</mat-option>
                <mat-option value="OBC">OBC (Other Backward Class)</mat-option>
                <mat-option value="SC">SC (Scheduled Caste)</mat-option>
                <mat-option value="ST">ST (Scheduled Tribe)</mat-option>
                <mat-option value="EWS">EWS / RTE (25% Quota)</mat-option>
              </mat-select>
              <mat-hint>RTE / Govt scholarship &amp; fee category</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>UDISE+ PEN (Permanent Education No)</mat-label>
              <input matInput formControlName="penNumber" placeholder="e.g. 11-digit Central PEN" maxlength="20" />
              <mat-icon matSuffix color="primary">badge</mat-icon>
              <mat-hint>Central Govt UDISE+ Student ID</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>APAAR ID (One Nation One Student ID)</mat-label>
              <input matInput formControlName="apaarId" placeholder="e.g. 12-digit APAAR ID" maxlength="20" />
              <mat-icon matSuffix color="primary">fingerprint</mat-icon>
              <mat-hint>Ministry of Education APAAR ID</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Student Aadhaar Number</mat-label>
              <input matInput formControlName="aadhaarNumber" placeholder="XXXX-XXXX-XXXX" maxlength="16" />
              <mat-icon matSuffix color="primary">credit_card</mat-icon>
              <mat-hint>Optional / Required for Govt benefits</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Religion</mat-label>
              <mat-select formControlName="religion">
                <mat-option value="">Not Specified</mat-option>
                <mat-option value="Hindu">Hindu</mat-option>
                <mat-option value="Muslim">Muslim</mat-option>
                <mat-option value="Christian">Christian</mat-option>
                <mat-option value="Sikh">Sikh</mat-option>
                <mat-option value="Jain">Jain</mat-option>
                <mat-option value="Buddhist">Buddhist</mat-option>
                <mat-option value="Other">Other</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Previous School & Emergency Contacts -->
            <div class="section-divider-box full-span history-sect">
              <mat-icon>history_edu</mat-icon>
              <span>Previous Academic History &amp; Emergency Contact</span>
            </div>

            <mat-form-field appearance="outline">
              <mat-label>Previous School Name (If Transfer)</mat-label>
              <input matInput formControlName="previousSchoolName" placeholder="e.g. St. Xavier High School" />
              <mat-icon matSuffix style="color:#64748b">school</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Previous Board / Affiliation</mat-label>
              <mat-select formControlName="previousBoard">
                <mat-option value="">None / Fresh Admission</mat-option>
                <mat-option value="CBSE">CBSE</mat-option>
                <mat-option value="ICSE">ICSE / ISC</mat-option>
                <mat-option value="State Board">State Board</mat-option>
                <mat-option value="IB / Cambridge">IB / Cambridge</mat-option>
                <mat-option value="Other">Other</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Emergency Contact Person</mat-label>
              <input matInput formControlName="emergencyContactName" placeholder="e.g. Uncle, Grandparent, Doctor" />
              <mat-icon matSuffix style="color:#64748b">contact_emergency</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Emergency Contact Phone</mat-label>
              <input matInput type="tel" formControlName="emergencyContactPhone" placeholder="10-digit mobile number" maxlength="15" />
              <mat-icon matSuffix style="color:#64748b">phone</mat-icon>
            </mat-form-field>

            <!-- Live Form Validation Summary Banner -->
            <div class="form-validation-notice full-span" *ngIf="getFormValidationErrorsList().length > 0 && (studentForm.dirty || studentForm.touched)">
              <div class="notice-header">
                <mat-icon>warning</mat-icon>
                <span>Please address the following required details to save:</span>
              </div>
              <ul class="notice-list">
                <li *ngFor="let err of getFormValidationErrorsList()">{{ err }}</li>
              </ul>
            </div>

            <div class="form-actions full-span">
              <button mat-button type="button" (click)="toggleForm()" [disabled]="saving">Cancel</button>
              <button mat-raised-button color="primary" type="submit" [disabled]="saving || phoneCheckLoading">
                <span>{{ isEditMode ? 'Update Student Record' : 'Confirm Admission' }}</span>
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Students Directory View -->
      <div *ngIf="!showForm" class="directory-container">
        
        <!-- Stream Switcher Tabs -->
        <div class="stream-switcher-bar">
          <button type="button" class="stream-tab" [class.active]="selectedStreamFilter === 'all'" (click)="setStreamFilter('all')">
            <mat-icon>dashboard</mat-icon>
            <span>All Enrolled</span>
            <span class="tab-count">{{ totalCount }}</span>
          </button>
          <button *ngIf="authService.hasSchoolModule()" type="button" class="stream-tab school-tab" [class.active]="selectedStreamFilter === 'school'" (click)="setStreamFilter('school')">
            <mat-icon>domain</mat-icon>
            <span>School Students</span>
          </button>
          <button *ngIf="authService.hasCoachingModule()" type="button" class="stream-tab coaching-tab" [class.active]="selectedStreamFilter === 'coaching'" (click)="setStreamFilter('coaching')">
            <mat-icon>school</mat-icon>
            <span>Coaching Batches</span>
          </button>
          <button *ngIf="authService.hasHostelModule()" type="button" class="stream-tab hostel-tab" [class.active]="selectedStreamFilter === 'hostel'" (click)="setStreamFilter('hostel')">
            <mat-icon>apartment</mat-icon>
            <span>Hostel Residents</span>
          </button>
          <button *ngIf="authService.hasLibraryModule()" type="button" class="stream-tab library-tab" [class.active]="selectedStreamFilter === 'library'" (click)="setStreamFilter('library')">
            <mat-icon>local_library</mat-icon>
            <span>Library Members</span>
          </button>
          <button *ngIf="authService.hasHostelModule()" type="button" class="stream-tab dayscholar-tab" [class.active]="selectedStreamFilter === 'dayscholar'" (click)="setStreamFilter('dayscholar')">
            <mat-icon>directions_walk</mat-icon>
            <span>Day Scholars</span>
          </button>
        </div>

        <mat-card class="table-card mat-elevation-z2">
          <!-- Filter Toolbar -->
          <div class="filter-toolbar">
            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Search Students...</mat-label>
              <input
                matInput
                [(ngModel)]="searchTerm"
                (keyup.enter)="onSearch()"
                placeholder="Search by Roll No, Name, Phone, SR No, Lib Card..."
              />
              <button mat-icon-button matSuffix (click)="onSearch()" aria-label="Search">
                <mat-icon>search</mat-icon>
              </button>
            </mat-form-field>

            <!-- School Class Filter -->
            <mat-form-field appearance="outline" class="filter-select" *ngIf="authService.hasSchoolModule() && selectedStreamFilter !== 'coaching'">
              <mat-label>Filter by School Class</mat-label>
              <mat-select [(ngModel)]="selectedClassFilter" (selectionChange)="onClassFilterChange()" panelClass="batch-filter-panel">
                <mat-option value="">All School Classes</mat-option>
                <mat-option *ngFor="let c of schoolClasses" [value]="c.id">
                  {{ c.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Coaching Batch Filter -->
            <mat-form-field appearance="outline" class="filter-select" *ngIf="authService.hasCoachingModule() && selectedStreamFilter !== 'school'">
              <mat-label>Filter by Coaching Batch</mat-label>
              <mat-select [(ngModel)]="selectedBatchFilter" (selectionChange)="onFilterChange()" panelClass="batch-filter-panel">
                <mat-option value="">All Academic Batches</mat-option>
                <mat-option *ngFor="let b of batches" [value]="b.id">
                  {{ b.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Section Filter -->
            <mat-form-field appearance="outline" class="filter-select section-select" *ngIf="authService.hasSchoolModule() && selectedClassFilter && selectedStreamFilter !== 'coaching'">
              <mat-label>Filter by Section</mat-label>
              <mat-select [(ngModel)]="selectedSectionFilter" (selectionChange)="onFilterChange()" panelClass="batch-filter-panel">
                <mat-option value="">All Sections</mat-option>
                <mat-option *ngFor="let s of filterSections" [value]="s.id">
                  Section {{ s.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Enrollment Status Filter -->
            <mat-form-field appearance="outline" class="filter-select status-select">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="selectedStatusFilter" (selectionChange)="onFilterChange()" panelClass="batch-filter-panel">
                <mat-option value="all">All Records</mat-option>
                <mat-option value="active">Active Enrolled</mat-option>
                <mat-option value="left">Left / TC Issued</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <mat-progress-bar mode="indeterminate" *ngIf="loading" class="grid-loader"></mat-progress-bar>

          <mat-card-content class="table-container">
            <table mat-table [dataSource]="students" matSort (matSortChange)="onSortChange($event)" class="full-width">

              <!-- Photo Column -->
              <ng-container matColumnDef="photo">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let s" class="photo-cell">
                  <div class="avatar-wrap">
                    <img *ngIf="s.profilePhoto" [src]="getPhotoUrl(s.profilePhoto)" alt="{{ s.studentName }}" class="avatar-img" />
                    <div *ngIf="!s.profilePhoto" class="avatar-initials">{{ getInitials(s.studentName) }}</div>
                  </div>
                </td>
              </ng-container>

              <!-- Roll Number / Identifiers -->
              <ng-container matColumnDef="rollNumber">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="rollNumber">Identifiers</th>
                <td mat-cell *matCellDef="let s">
                  <div class="id-stack">
                    <div class="school-adm-pill" *ngIf="s.admissionNumber">
                      <span class="lbl">Adm:</span> <strong>{{ s.admissionNumber }}</strong>
                    </div>
                    <div class="school-adm-pill" *ngIf="!s.admissionNumber && (s.admissionNo || s.rollNumber || s.coachingRollNumber)">
                      <span class="lbl">Adm:</span> <strong>{{ s.admissionNo || s.rollNumber || s.coachingRollNumber }}</strong>
                    </div>
                    <div class="school-adm-date-pill" *ngIf="s.joiningDate">
                      <span class="lbl">DOJ:</span> <strong>{{ s.joiningDate | date:'dd MMM yyyy':'Asia/Kolkata' }}</strong>
                    </div>
                    <div class="lib-card-pill" *ngIf="s.isLibraryMember && s.libraryCardNumber">
                      <span class="lbl">Lib:</span> <strong>{{ s.libraryCardNumber }}</strong>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Student Name -->
              <ng-container matColumnDef="studentName">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="studentName">Student Name</th>
                <td mat-cell *matCellDef="let s">
                  <div class="name-cell-wrap">
                    <div class="name-row-header">
                      <span class="student-name-text student-name-clickable" (click)="openStudent360(s)" matTooltip="Click to open Student 360° Dossier & KYC Vault">{{ s.studentName }}</span>
                      <span class="slc-badge-pill" *ngIf="s.isActive === false && isStudentPassedOut(s)" matTooltip="Terminal Pass-Out Alumnus - SLC: {{ s.tcNumber || 'Issued' }}">
                        <mat-icon class="tc-icon-mini">school</mat-icon>
                        <span>{{ s.tcNumber || 'SLC' }}</span>
                      </span>
                      <span class="tc-badge-pill" *ngIf="s.isActive === false && !isStudentPassedOut(s)" matTooltip="Left School - TC: {{ s.tcNumber || 'Issued' }}">
                        <mat-icon class="tc-icon-mini">assignment_turned_in</mat-icon>
                        <span>{{ s.tcNumber || 'Left' }}</span>
                      </span>
                    </div>
                    <div class="student-meta-sub" *ngIf="s.gender || s.dateOfBirth">
                      <span>{{ s.gender }}</span>
                      <span *ngIf="s.gender && s.dateOfBirth">&bull;</span>
                      <span *ngIf="s.dateOfBirth">{{ s.dateOfBirth | date:'dd MMM yyyy' }}</span>
                      <span *ngIf="s.bloodGroup" class="bg-badge">{{ s.bloodGroup }}</span>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Stream / Enrollment Badges -->
              <ng-container matColumnDef="enrollment">
                <th mat-header-cell *matHeaderCellDef>Stream</th>
                <td mat-cell *matCellDef="let s">
                  <div class="stream-badge-stack">
                    <span class="badge-pill dual" *ngIf="s.isSchoolStudent && s.isCoachingStudent">
                      <mat-icon>verified</mat-icon> School + Coaching
                    </span>
                    <span class="badge-pill school" *ngIf="s.isSchoolStudent && !s.isCoachingStudent">
                      <mat-icon>domain</mat-icon> School Only
                    </span>
                    <span class="badge-pill coaching" *ngIf="!s.isSchoolStudent && s.isCoachingStudent">
                      <mat-icon>school</mat-icon> Coaching Only
                    </span>
                    <span class="badge-pill hostel" *ngIf="s.isHostelStudent">
                      <mat-icon>apartment</mat-icon> Hosteler
                    </span>
                    <span class="badge-pill dayscholar" *ngIf="!s.isHostelStudent">
                      <mat-icon>directions_walk</mat-icon> Day Scholar
                    </span>
                    <span class="badge-pill library" *ngIf="s.isLibraryMember">
                      <mat-icon>local_library</mat-icon> Library Member
                    </span>
                  </div>
                </td>
              </ng-container>

              <!-- Academic Allocation: Class & Batch -->
              <ng-container matColumnDef="batchOrClass">
                <th mat-header-cell *matHeaderCellDef>Academic</th>
                <td mat-cell *matCellDef="let s">
                  <div class="academic-stack">
                    <div class="school-alloc" *ngIf="s.isSchoolStudent">
                      <mat-icon class="icon-school">domain</mat-icon>
                      <span><strong>{{ s.className || 'Class' }}</strong> - Sec {{ s.sectionName || 'A' }}</span>
                    </div>
                    <div class="teacher-alloc" *ngIf="s.isSchoolStudent && s.classTeacherName" [matTooltip]="'Class Teacher: ' + s.classTeacherName + (s.classTeacherPhone ? ' (📞 ' + s.classTeacherPhone + ')' : '')">
                      <mat-icon class="icon-teacher">supervisor_account</mat-icon>
                      <span>CT: <strong>{{ s.classTeacherName }}</strong></span>
                    </div>
                    <div class="coaching-alloc" *ngIf="s.isCoachingStudent">
                      <mat-icon class="icon-coaching">school</mat-icon>
                      <span>{{ s.batchName || 'Coaching Batch' }}</span>
                    </div>
                    <div class="hostel-alloc" *ngIf="s.isHostelStudent">
                      <mat-icon class="icon-hostel">hotel</mat-icon>
                      <span>{{ s.hostelName || 'Hostel' }} - Rm {{ s.roomNumber || '' }} ({{ s.bedCode || 'Bed' }})</span>
                    </div>
                    <div class="library-alloc" *ngIf="s.isLibraryMember">
                      <mat-icon class="icon-library">local_library</mat-icon>
                      <span>{{ s.libraryMembershipType || 'Standard Lending' }} (Limit: {{ s.maxLibraryBooks || 2 }}{{ s.monthlyLibraryFee > 0 ? ' • ₹' + s.monthlyLibraryFee + '/mo' : '' }})</span>
                    </div>
                    <div class="kit-alloc" *ngIf="s.hasAdmissionKit" [matTooltip]="'Admission Kit Issued' + (s.kitStatus ? ' (' + s.kitStatus + ')' : '')">
                      <mat-icon class="icon-kit">inventory_2</mat-icon>
                      <span>Kit Issued{{ s.kitStatus ? ' • ' + s.kitStatus : '' }}</span>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Parent Info -->
              <ng-container matColumnDef="parentName">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="parentName">Guardian</th>
                <td mat-cell *matCellDef="let s">
                  <div class="parent-cell-wrap">
                    <span class="father-name">{{ s.parentName }}</span>
                    <small *ngIf="s.motherName" class="mother-name">M: {{ s.motherName }}</small>
                  </div>
                </td>
              </ng-container>

              <!-- WhatsApp Phone -->
              <ng-container matColumnDef="parentWhatsAppPhone">
                <th mat-header-cell *matHeaderCellDef>WhatsApp Phone</th>
                <td mat-cell *matCellDef="let s">
                  <span class="wa-phone" *ngIf="s.parentWhatsAppPhone">
                    <mat-icon class="wa-icon">chat</mat-icon>
                    {{ formatDisplayPhone(s.parentWhatsAppPhone) }}
                  </span>
                  <span *ngIf="!s.parentWhatsAppPhone" class="text-muted">-</span>
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="text-right">Actions</th>
                <td mat-cell *matCellDef="let s" class="text-right">
                  <div class="action-buttons">
                    <!-- Primary 1: Student 360° Profile & KYC Dossier -->
                    <button
                      mat-icon-button
                      class="btn-profile-360"
                      (click)="openStudent360(s)"
                      matTooltip="Student 360° Dossier &amp; KYC Vault">
                      <mat-icon>account_circle</mat-icon>
                    </button>

                    <!-- Primary 2: Edit Student Record -->
                    <button mat-icon-button color="primary" (click)="editStudent(s)" matTooltip="Edit Student">
                      <mat-icon>edit</mat-icon>
                    </button>

                    <!-- Primary 3: More Actions Dropdown Menu (⋮) -->
                    <button mat-icon-button [matMenuTriggerFor]="studentActionMenu" matTooltip="More Actions">
                      <mat-icon>more_vert</mat-icon>
                    </button>

                    <mat-menu #studentActionMenu="matMenu" xPosition="before" class="student-actions-dropdown">
                      <!-- 1-Click Coaching Enrollment Button for School Students -->
                      <button
                        mat-menu-item
                        *ngIf="authService.hasCoachingModule() && s.isSchoolStudent && !s.isCoachingStudent && s.isActive !== false"
                        (click)="openEnrollCoachingModal(s)">
                        <mat-icon style="color: #7c3aed;">add_task</mat-icon>
                        <span>Enroll in Coaching Batch</span>
                      </button>

                      <!-- School Student: Print ID Card -->
                      <button
                        mat-menu-item
                        *ngIf="s.isSchoolStudent && s.isActive !== false"
                        (click)="openIdCardDialog(s)">
                        <mat-icon style="color: #0284c7;">badge</mat-icon>
                        <span>Print Student ID Card</span>
                      </button>

                      <!-- School Student: Bonafide / Character Certificate -->
                      <button
                        mat-menu-item
                        *ngIf="s.isSchoolStudent"
                        (click)="openBonafideDialog(s)">
                        <mat-icon style="color: #b45309;">workspace_premium</mat-icon>
                        <span>Bonafide Certificate</span>
                      </button>

                      <!-- School Student: Academic Marksheet & Report Card -->
                      <a
                        mat-menu-item
                        *ngIf="s.isSchoolStudent && s.classId"
                        [routerLink]="['/school/exams']"
                        [queryParams]="{classId: s.classId}">
                        <mat-icon style="color: #2563eb;">analytics</mat-icon>
                        <span>Exams &amp; Marksheets</span>
                      </a>

                      <!-- Student & Parent Portal Logins Action Button -->
                      <button
                        mat-menu-item
                        (click)="openPortalLogins(s)">
                        <mat-icon style="color: #4f46e5;">vpn_key</mat-icon>
                        <span>Portal Logins (Access Keys)</span>
                      </button>

                      <!-- Active Student: Mark Attendance -->
                      <a
                        mat-menu-item
                        [routerLink]="['/students/attendance']"
                        [queryParams]="{studentId: s.id}"
                        *ngIf="s.isActive !== false">
                        <mat-icon style="color: #059669;">event_available</mat-icon>
                        <span>View / Mark Attendance</span>
                      </a>

                      <mat-divider></mat-divider>

                      <!-- Active Student: Mark Left / Issue TC Button -->
                      <button
                        mat-menu-item
                        *ngIf="s.isActive !== false"
                        (click)="openStudentLeavingModal(s)">
                        <mat-icon style="color: #ea580c;">exit_to_app</mat-icon>
                        <span>Student Leaving / Issue TC</span>
                      </button>

                      <!-- Left Student: View/Print Certificate (SLC / TC) -->
                      <button
                        mat-menu-item
                        *ngIf="s.isActive === false"
                        (click)="openStudentLeavingModal(s, true)">
                        <mat-icon style="color: #0284c7;">{{ isStudentPassedOut(s) ? 'workspace_premium' : 'description' }}</mat-icon>
                        <span>{{ isStudentPassedOut(s) ? 'Print SLC Certificate' : 'Print Transfer Certificate (TC)' }}</span>
                      </button>

                      <!-- Re-Admit Button: ONLY for mid-session left students -->
                      <button
                        mat-menu-item
                        *ngIf="s.isActive === false && !isStudentPassedOut(s)"
                        (click)="openReAdmitModal(s)">
                        <mat-icon style="color: #16a34a;">replay</mat-icon>
                        <span>Re-Admit Student</span>
                      </button>

                      <mat-divider></mat-divider>

                      <!-- Delete Student -->
                      <button
                        mat-menu-item
                        (click)="deleteStudent(s)">
                        <mat-icon style="color: #dc2626;">delete</mat-icon>
                        <span style="color: #dc2626;">Delete Student</span>
                      </button>
                    </mat-menu>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

              <tr class="mat-row" *matNoDataRow>
                <td class="mat-cell empty-cell" [attr.colspan]="displayedColumns.length">
                  <div class="empty-state" *ngIf="!loading">
                    <mat-icon class="empty-icon">people</mat-icon>
                    <p>No student records found matching your filter criteria.</p>
                  </div>
                </td>
              </tr>
            </table>
          </mat-card-content>

          <mat-paginator
            [length]="totalCount"
            [pageSize]="pageSize"
            [pageSizeOptions]="[10, 25, 50, 100]"
            [pageIndex]="pageIndex"
            (page)="onPageChange($event)"
            showFirstLastButtons>
          </mat-paginator>
        </mat-card>
      </div>

      <!-- 1-Click Coaching Enrollment Modal for School Students -->
      <div class="enroll-modal-backdrop" *ngIf="enrollCoachingModalOpen" (click)="closeEnrollCoachingModal()">
        <div class="enroll-modal-card mat-elevation-z8" (click)="$event.stopPropagation()">
          <div class="ecc-header">
            <div class="ecc-header-left">
              <div class="ecc-icon-wrap">
                <mat-icon>school</mat-icon>
              </div>
              <div class="ecc-title">
                <h3>Enroll School Student into Coaching</h3>
                <p>Instantly enroll <strong>{{ enrollingStudent?.studentName }}</strong> into an evening coaching batch.</p>
              </div>
            </div>
            <button mat-icon-button class="close-btn" (click)="closeEnrollCoachingModal()"><mat-icon>close</mat-icon></button>
          </div>

          <div class="ecc-body">
            <div class="student-pill-banner">
              <div class="spb-name">{{ enrollingStudent?.studentName }}</div>
              <div class="spb-meta">
                <span>🏫 Class: <strong>{{ enrollingStudent?.className }} - {{ enrollingStudent?.sectionName }}</strong></span>
                <span>SR No: <strong>{{ enrollingStudent?.admissionNumber || 'N/A' }}</strong></span>
                <span>Parent: <strong>{{ enrollingStudent?.parentName }}</strong></span>
              </div>
            </div>

            <div class="ecc-form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Select Coaching Batch</mat-label>
                <mat-select [(ngModel)]="enrollingBatchId" (selectionChange)="onEnrollingBatchChange($event.value)">
                  <mat-option *ngFor="let b of batches" [value]="b.id">
                    {{ b.name }} (Standard Fee: ₹{{ b.standardMonthlyFee }}/mo)
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Batch-wise Coaching Roll Number</mat-label>
                <input matInput [(ngModel)]="enrollingCoachingRollNumber" placeholder="Auto-generating..." readonly />
                <mat-icon matSuffix *ngIf="!enrollingRollNumberLoading" style="color: #64748b; font-size: 20px; width: 20px; height: 20px;">lock</mat-icon>
                <mat-spinner matSuffix diameter="18" *ngIf="enrollingRollNumberLoading"></mat-spinner>
                <mat-hint>Auto-generated batch roll sequence for this coaching batch.</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Custom Monthly Fee (₹) [Optional]</mat-label>
                <input matInput type="number" [(ngModel)]="enrollingCustomFee" placeholder="Leave blank to use standard fee" />
                <mat-hint>Overrides default monthly fee for this school student.</mat-hint>
              </mat-form-field>
            </div>
          </div>

          <div class="ecc-actions">
            <button mat-button type="button" (click)="closeEnrollCoachingModal()" [disabled]="enrollingLoading">Cancel</button>
            <button mat-raised-button color="primary" (click)="confirmEnrollCoaching()" [disabled]="!enrollingBatchId || enrollingLoading">
              <mat-spinner diameter="18" *ngIf="enrollingLoading" style="display:inline-block; margin-right:6px;"></mat-spinner>
              <span>Confirm &amp; Enroll into Coaching</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .students-wrapper {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
    .header-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      h2 { margin: 0; font-size: 1.5rem; color: #1976d2; font-weight: 700; }
      p { margin: 4px 0 0 0; color: #64748b; font-size: 0.9rem; }
    }
    .header-btns {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;

      a, button {
        white-space: nowrap !important;
        flex-shrink: 0;

        span {
          white-space: nowrap !important;
        }

        ::ng-deep .mdc-button__label {
          white-space: nowrap !important;
          display: inline-flex;
          align-items: center;
        }
      }
    }
    .more-actions-btn {
      color: #334155 !important;
      border-color: #cbd5e1 !important;
      background: #f8fafc;
      font-weight: 600;
      height: 38px;
      line-height: 38px;
      border-radius: 8px;
      white-space: nowrap !important;
      mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; }
      &:hover { background: #f1f5f9; border-color: #94a3b8 !important; }
    }
    .promotion-link-btn {
      color: #059669 !important;
      border-color: #a7f3d0 !important;
      background: #ecfdf5;
      font-weight: 600;
      height: 38px;
      line-height: 38px;
      border-radius: 8px;
      white-space: nowrap !important;
      mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; }
      &:hover { background: #d1fae5; }
    }
    .add-btn {
      height: 38px;
      line-height: 38px;
      border-radius: 8px;
      font-weight: 600;
      white-space: nowrap !important;
      mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; }
    }
    .classes-link-btn {
      color: #2563eb !important;
      border-color: #93c5fd !important;
      mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; }
    }

    /* Stream Switcher Tabs */
    .stream-switcher-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 2px;
      overflow-x: auto;
      flex-wrap: nowrap;
      padding-bottom: 6px;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      max-width: 100%;

      &::-webkit-scrollbar {
        height: 4px;
      }
      &::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }
    }
    .stream-tab {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 9px 18px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      border-radius: 24px;
      font-size: 0.88rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: all 0.2s ease;

      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; }

      .tab-count {
        background: #f1f5f9;
        color: #475569;
        font-size: 0.76rem;
        padding: 2px 7px;
        border-radius: 12px;
        font-weight: 700;
      }

      &:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }

      &.active {
        background: #1e3a8a;
        color: #ffffff;
        border-color: #1e3a8a;
        box-shadow: 0 4px 12px rgba(30, 58, 138, 0.2);

        mat-icon { color: #ffffff; }
        .tab-count { background: rgba(255,255,255,0.25); color: #ffffff; }
      }

      &.school-tab.active {
        background: #0284c7;
        border-color: #0284c7;
        box-shadow: 0 4px 12px rgba(2, 132, 199, 0.2);
      }

      &.coaching-tab.active {
        background: #7c3aed;
        border-color: #7c3aed;
        box-shadow: 0 4px 12px rgba(124, 58, 237, 0.2);
      }
      &.hostel-tab.active {
        background: #7e22ce;
        border-color: #7e22ce;
        box-shadow: 0 4px 12px rgba(126, 34, 206, 0.2);
      }
      &.library-tab.active {
        background: #0f766e;
        border-color: #0f766e;
        box-shadow: 0 4px 12px rgba(15, 118, 110, 0.2);
      }
      &.dayscholar-tab.active {
        background: #475569;
        border-color: #475569;
        box-shadow: 0 4px 12px rgba(71, 85, 105, 0.2);
      }
    }

    /* Form Styles */
    .form-card {
      border-radius: 10px;
      .form-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1.15rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 12px;
      }
    }
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 14px;
      align-items: start;
    }
    .full-span { grid-column: span 2; }

    /* Stream Selector Box inside Form */
    .stream-selector-box {
      background: #f8fafc;
      border: 1.5px dashed #cbd5e1;
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .stream-selector-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
        font-size: 0.95rem;
        color: #1e293b;
      }
      .stream-checkboxes {
        display: flex;
        gap: 24px;
        flex-wrap: wrap;

        .chk-label {
          font-size: 0.9rem;
          color: #334155;
        }
      }
      .stream-hint-warn {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #dc2626;
        font-size: 0.82rem;
        font-weight: 600;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
      .stream-hint-kit-info {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 8px;
        color: #1e40af;
        font-size: 0.8rem;
        font-weight: 500;
        margin-top: 4px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; flex-shrink: 0; }
        strong { font-weight: 700; color: #1e3a8a; }
        u { text-decoration-color: #3b82f6; }
      }
    }

    .kit-guidance-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
      border: 1px solid #bbf7d0;
      border-left: 4px solid #16a34a;
      border-radius: 8px;
      margin-top: 6px;
      margin-bottom: 6px;

      .guidance-icon-box {
        background: #16a34a;
        color: #ffffff;
        border-radius: 8px;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }

      .guidance-content {
        flex: 1;
        .guidance-title {
          font-size: 0.88rem;
          font-weight: 700;
          color: #14532d;
          margin-bottom: 3px;
        }
        .guidance-desc {
          margin: 0;
          font-size: 0.8rem;
          color: #166534;
          line-height: 1.45;
          strong { color: #0f172a; font-weight: 700; }
        }
      }
    }

    .section-divider-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.88rem;
      margin-top: 6px;

      mat-icon { font-size: 18px; width: 18px; height: 18px; }

      &.school-sect {
        background: #f0fdf4;
        color: #15803d;
        border-left: 4px solid #16a34a;
      }
      &.coaching-sect {
        background: #faf5ff;
        color: #7c3aed;
        border-left: 4px solid #9333ea;
      }
      &.info-sect {
        background: #f1f5f9;
        color: #334155;
        border-left: 4px solid #64748b;
      }
      &.hostel-sect {
        background: #fdf4ff;
        color: #86198f;
        border-left: 4px solid #c026d3;
      }
      &.library-sect {
        background: #f0fdfa;
        color: #0f766e;
        border-left: 4px solid #14b8a6;
      }
      &.compliance-sect {
        background: #eff6ff;
        color: #1e40af;
        border-left: 4px solid #2563eb;
      }
      &.history-sect {
        background: #fdf2f8;
        color: #9d174d;
        border-left: 4px solid #db2777;
      }
      &.kit-sect {
        background: #eef2ff;
        color: #3730a3;
        border-left: 4px solid #6366f1;
      }
    }

    .admission-kit-panel {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 16px 20px;
      margin-top: 6px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

      .kit-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 16px;

        .kit-header-left {
          display: flex;
          align-items: center;
          gap: 12px;

          .kit-header-icon {
            color: #2563eb;
            font-size: 26px;
            width: 26px;
            height: 26px;
          }

          .panel-title {
            font-weight: 700;
            color: #0f172a;
            font-size: 0.98rem;
          }

          .panel-subtitle {
            font-size: 0.8rem;
            color: #64748b;
            margin: 2px 0 0;
          }
        }

        .add-item-controls {
          display: flex;
          align-items: center;
          gap: 10px;

          .item-picker-field {
            width: 320px;
          }
        }
      }

      .kit-items-table {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

        table.kit-table {
          width: 100%;
          border-collapse: collapse;
          white-space: nowrap;

          thead {
            background: #f8fafc;
            border-bottom: 2px solid #cbd5e1;

            th {
              padding: 11px 16px;
              font-size: 0.78rem;
              font-weight: 700;
              color: #475569;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              text-align: left;
              border-bottom: 1px solid #cbd5e1;

              &.text-center { text-align: center; }
              &.text-right { text-align: right; }
            }
          }

          tbody {
            tr {
              border-bottom: 1px solid #f1f5f9;
              transition: background-color 0.15s ease;

              &:hover {
                background: #f8fafc;
              }

              &.existing-row {
                background: #fcfdff;
              }

              td {
                padding: 12px 16px;
                font-size: 0.88rem;
                color: #1e293b;
                vertical-align: middle;
                border-bottom: 1px solid #f1f5f9;

                &.text-center { text-align: center; }
                &.text-right { text-align: right; }

                .item-name-cell {
                  display: flex;
                  align-items: center;
                  gap: 8px;

                  .item-main-title {
                    font-weight: 600;
                    color: #0f172a;
                    font-size: 0.9rem;
                  }

                  .code-pill {
                    font-family: monospace;
                    font-size: 0.76rem;
                    font-weight: 700;
                    background: #eff6ff;
                    color: #1e40af;
                    padding: 2px 7px;
                    border-radius: 4px;
                    border: 1px solid #bfdbfe;
                  }
                }

                .qty-badge {
                  display: inline-block;
                  font-weight: 700;
                  color: #0f172a;
                  font-size: 0.92rem;
                }

                .price-val {
                  color: #475569;
                  font-weight: 600;
                  font-size: 0.88rem;
                }

                .row-total-val {
                  font-weight: 700;
                  color: #1e40af;
                  font-size: 0.92rem;
                }

                .badge-issued-item {
                  display: inline-flex;
                  align-items: center;
                  gap: 4px;
                  font-size: 0.75rem;
                  font-weight: 700;
                  background: #ecfdf5;
                  color: #047857;
                  padding: 3px 10px;
                  border-radius: 12px;
                  border: 1px solid #a7f3d0;

                  .badge-mini-icon {
                    font-size: 14px;
                    width: 14px;
                    height: 14px;
                    line-height: 14px;
                  }
                }

                .badge-new-item {
                  display: inline-flex;
                  align-items: center;
                  gap: 4px;
                  font-size: 0.75rem;
                  font-weight: 700;
                  background: #eff6ff;
                  color: #1d4ed8;
                  padding: 3px 10px;
                  border-radius: 12px;
                  border: 1px solid #bfdbfe;

                  .badge-mini-icon {
                    font-size: 14px;
                    width: 14px;
                    height: 14px;
                    line-height: 14px;
                  }
                }

                .check-icon-wrap {
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                }

                .check-icon-dimmed {
                  font-size: 20px;
                  width: 20px;
                  height: 20px;
                  color: #10b981;
                  vertical-align: middle;
                }
              }
            }
          }

          tfoot {
            background: #f8fafc;
            border-top: 2px solid #cbd5e1;

            tr {
              td {
                padding: 12px 16px;
                vertical-align: middle;

                &.total-label {
                  text-align: right;
                  font-weight: 700;
                  color: #334155;
                  font-size: 0.84rem;
                  text-transform: uppercase;
                  letter-spacing: 0.03em;
                }

                &.total-val {
                  text-align: right;
                  font-weight: 800;
                  color: #1e40af;
                  font-size: 1.08rem;
                }
              }
            }
          }
        }
      }
    }

    .kit-qty-input, .kit-price-input {
      width: 80px;
      padding: 6px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.88rem;
      font-weight: 600;
      outline: none;
      text-align: right;
      &:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
      }
    }

    .empty-kit-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #f1f5f9;
      border-radius: 8px;
      color: #475569;
      font-size: 0.85rem;
    }

    .existing-kit-alert-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 12px;
      .kit-alert-left {
        display: flex;
        align-items: center;
        gap: 12px;
        .kit-alert-icon { color: #2563eb; font-size: 24px; width: 24px; height: 24px; }
        .kit-alert-title { color: #1e3a8a; font-size: 0.95rem; font-weight: 700; }
        .kit-alert-meta {
          font-size: 0.82rem;
          color: #3b82f6;
          margin-top: 2px;
          .meta-sep { margin: 0 6px; color: #94a3b8; }
          .badge-status-kit { color: #1e40af; font-weight: 700; }
        }
      }
    }

    /* Live Auto-Age & NEP Advisory Inline Badge */
    .age-pill-inline {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1.2;
      cursor: help;

      mat-icon {
        font-size: 13px;
        width: 13px;
        height: 13px;
        line-height: 13px;
      }

      &.age-pill-success {
        color: #15803d;
      }
      &.age-pill-warning {
        color: #b45309;
      }
      &.age-pill-info {
        color: #1d4ed8;
      }
    }
    .age-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.01em;

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      &.age-pill-success {
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
      }
      &.age-pill-warning {
        background: #fffbeb;
        color: #92400e;
        border: 1px solid #fde68a;
      }
      &.age-pill-info {
        background: #eff6ff;
        color: #1e40af;
        border: 1px solid #bfdbfe;
      }
    }
    .nep-advisory-note {
      font-size: 0.74rem;
      color: #b45309;
      font-weight: 500;
      line-height: 1.25;
    }

    .form-validation-notice {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-left: 4px solid #ef4444;
      border-radius: 8px;
      padding: 12px 16px;
      margin-top: 10px;
      margin-bottom: 6px;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .notice-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        color: #991b1b;
        font-size: 0.9rem;

        mat-icon {
          color: #ef4444;
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }

      .notice-list {
        margin: 0;
        padding-left: 24px;
        font-size: 0.85rem;
        color: #b91c1c;

        li {
          margin-bottom: 4px;
          line-height: 1.4;
        }
      }
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 8px;
    }

    /* Photo Upload */
    .photo-upload-area {
      display: flex;
      justify-content: center;
      padding: 4px 0;
    }
    .photo-preview-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .photo-circle {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      border: 2px dashed #2563eb;
      overflow: hidden;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #eff6ff;
      &:hover { border-color: #1d4ed8; }
    }
    .photo-img { width: 100%; height: 100%; object-fit: cover; }
    .photo-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      color: #2563eb;
      font-size: 0.72rem;
      font-weight: 600;
    }
    .photo-placeholder-icon { font-size: 26px; width: 26px; height: 26px; }
    .photo-actions { display: flex; align-items: center; gap: 6px; }

    /* Directory Table */
    .directory-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 100%;
      max-width: 100%;
      min-width: 0;
    }
    .table-card {
      border-radius: 10px;
      overflow: hidden;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }
    .filter-toolbar {
      padding: 16px 16px 4px 16px;
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;

      .search-field {
        flex: 1 1 240px;
        min-width: 180px;
      }
      .filter-select {
        flex: 1 1 180px;
        min-width: 140px;
      }
      .section-select {
        flex: 1 1 140px;
        min-width: 120px;
      }
      .status-select {
        flex: 1 1 140px;
        min-width: 120px;
        max-width: 160px;
      }
    }
    .table-container {
      padding: 0;
      width: 100%;
      max-width: 100%;
      overflow-x: auto !important;
      -webkit-overflow-scrolling: touch;
      display: block;

      &::-webkit-scrollbar {
        height: 6px;
      }
      &::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }
      &::-webkit-scrollbar-track {
        background: #f1f5f9;
      }
    }
    .full-width {
      width: 100%;
      min-width: 860px;

      tr.mat-mdc-row {
        height: auto !important;
      }

      td.mat-mdc-cell {
        padding-top: 6px !important;
        padding-bottom: 6px !important;
        vertical-align: middle;
      }

      th.mat-mdc-header-cell {
        padding-top: 8px !important;
        padding-bottom: 8px !important;
        font-weight: 700;
      }
    }
    .photo-cell { width: 48px; padding-right: 0 !important; }
    .avatar-wrap {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      overflow: hidden;
      background: #e2e8f0;
    }
    .avatar-img { width: 100%; height: 100%; object-fit: cover; }
    .avatar-initials {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #2563eb;
      color: #fff;
      font-weight: 700;
      font-size: 0.8rem;
    }

    /* Identifiers Column */
    .id-stack {
      display: flex;
      flex-direction: column;
      gap: 3px;

      .coaching-roll-pill {
        font-size: 0.82rem;
        color: #1e293b;
        .lbl { font-size: 0.72rem; color: #64748b; }
      }
      .school-adm-pill {
        font-size: 0.8rem;
        color: #0369a1;
        background: #f0f9ff;
        padding: 1px 6px;
        border-radius: 4px;
        width: fit-content;
        .lbl { font-size: 0.7rem; color: #0284c7; }
      }
      .school-roll-pill {
        font-size: 0.75rem;
        color: #64748b;
        .lbl { font-size: 0.7rem; color: #94a3b8; }
      }
      .school-adm-date-pill {
        font-size: 0.75rem;
        color: #475569;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        .lbl { font-size: 0.7rem; color: #64748b; font-weight: 500; }
        strong { font-weight: 600; color: #1e293b; }
      }
      .lib-card-pill {
        font-size: 0.78rem;
        color: #0f766e;
        background: #f0fdfa;
        padding: 1px 6px;
        border-radius: 4px;
        width: fit-content;
        border: 1px solid #ccfbf1;
        .lbl { font-size: 0.7rem; color: #0d9488; }
      }
    }

    /* Student Name Column */
    .name-cell-wrap {
      display: flex;
      flex-direction: column;
      gap: 2px;
      .student-name-text { font-weight: 600; color: #0f172a; font-size: 0.92rem; }
      .student-meta-sub {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.75rem;
        color: #64748b;
        .bg-badge {
          background: #fee2e2;
          color: #b91c1c;
          padding: 0 5px;
          border-radius: 4px;
          font-weight: 700;
          font-size: 0.68rem;
        }
      }
    }

    /* Stream Badges */
    .stream-badge-stack {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.74rem;
      font-weight: 700;
      width: fit-content;

      mat-icon { font-size: 13px; width: 13px; height: 13px; }

      &.dual {
        background: #fdf4ff;
        color: #a21caf;
        border: 1px solid #f0abfc;
      }
      &.school {
        background: #f0fdf4;
        color: #15803d;
        border: 1px solid #bbf7d0;
      }
      &.coaching {
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
      }
      &.hostel {
        background: #faf5ff;
        color: #7e22ce;
        border: 1px solid #d8b4fe;
      }
      &.dayscholar {
        background: #f8fafc;
        color: #475569;
        border: 1px solid #cbd5e1;
      }
      &.library {
        background: #f0fdfa;
        color: #0f766e;
        border: 1px solid #99f6e4;
      }
    }

    /* Academic Allocations */
    .academic-stack {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 0.82rem;

      .school-alloc {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #047857;
        .icon-school { font-size: 14px; width: 14px; height: 14px; color: #10b981; }
      }
      .teacher-alloc {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #1d4ed8;
        font-size: 0.76rem;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 4px;
        padding: 1px 6px;
        width: fit-content;
        .icon-teacher { font-size: 13px; width: 13px; height: 13px; color: #2563eb; }
      }
      .coaching-alloc {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #4338ca;
        .icon-coaching { font-size: 14px; width: 14px; height: 14px; color: #6366f1; }
      }
      .hostel-alloc {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #7e22ce;
        .icon-hostel { font-size: 14px; width: 14px; height: 14px; color: #a855f7; }
      }
      .library-alloc {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #0f766e;
        .icon-library { font-size: 14px; width: 14px; height: 14px; color: #14b8a6; }
      }
      .kit-alloc {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: #0369a1;
        font-size: 0.74rem;
        font-weight: 600;
        background: #e0f2fe;
        border: 1px solid #bae6fd;
        border-radius: 4px;
        padding: 1px 6px;
        width: fit-content;
        .icon-kit { font-size: 13px; width: 13px; height: 13px; color: #0284c7; }
      }
    }

    /* Parent Info */
    .parent-cell-wrap {
      display: flex;
      flex-direction: column;
      font-size: 0.85rem;
      color: #1e293b;
      .mother-name { font-size: 0.72rem; color: #64748b; }
    }

    .mat-column-parentWhatsAppPhone {
      white-space: nowrap !important;
      min-width: 145px;
    }

    .wa-phone {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #16a34a;
      font-weight: 600;
      font-size: 0.83rem;
      white-space: nowrap !important;
      letter-spacing: 0.2px;
      .wa-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #16a34a;
        flex-shrink: 0;
        vertical-align: middle;
      }
    }

    .mat-column-actions {
      width: 125px !important;
      min-width: 125px !important;
      text-align: right;
      white-space: nowrap;
    }

    .action-buttons {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 2px;
    }

    .btn-quick-coaching {
      height: 30px !important;
      line-height: 28px !important;
      font-size: 0.75rem !important;
      padding: 0 10px !important;
      color: #7c3aed !important;
      border-color: #c4b5fd !important;
      background: #faf5ff !important;
      font-weight: 600 !important;

      mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 3px; }
      &:hover { background: #f3e8ff !important; }
    }

    .btn-tc-action {
      color: #ea580c !important;
      &:hover { background: #fff7ed !important; }
    }
    .btn-tc-print {
      color: #0284c7 !important;
      &:hover { background: #f0f9ff !important; }
    }
    .btn-tc-readmit {
      color: #16a34a !important;
      &:hover { background: #f0fdf4 !important; }
    }
    .btn-profile-360 {
      color: #2563eb !important;
      &:hover { background: #eff6ff !important; }
    }
    .student-name-clickable {
      cursor: pointer;
      color: #1e40af;
      transition: color 0.15s ease;
      &:hover {
        color: #2563eb;
        text-decoration: underline;
      }
    }

    .name-row-header {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .tc-badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 10px;
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fca5a5;

      .tc-icon-mini {
        font-size: 12px;
        width: 12px;
        height: 12px;
      }
    }

    .slc-badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 10px;
      background: #ede9fe;
      color: #6d28d9;
      border: 1px solid #ddd6fe;

      .tc-icon-mini {
        font-size: 12px;
        width: 12px;
        height: 12px;
      }
    }

    .status-select {
      max-width: 160px;
    }

    .empty-cell { text-align: center; padding: 36px 0; }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      color: #94a3b8;
      .empty-icon { font-size: 42px; width: 42px; height: 42px; }
      p { margin-top: 8px; font-size: 0.9rem; }
    }

    /* ── Sibling notification card inside form ── */
    .sibling-detected-box {
      margin-top: 6px;
      padding: 10px 14px;
      border-radius: 8px;
      background: #f0fdf4;
      border: 1px solid #86efac;
      &.warning { background: #fffbeb; border-color: #fde68a; }

      .sibling-header { display: flex; gap: 10px; align-items: flex-start; }
      .sibling-badge-icon {
        color: #16a34a;
        &.warning { color: #d97706; }
      }
      .sibling-details {
        flex: 1;
        .sibling-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 700;
          font-size: 0.85rem;
          color: #15803d;
          .warning-title { color: #b45309; }
          .sibling-status-pill {
            font-size: 0.72rem;
            padding: 2px 8px;
            border-radius: 12px;
            background: #dcfce7;
            color: #15803d;
            &.warning-pill { background: #fef3c7; color: #b45309; }
          }
        }
        .sibling-desc { margin: 4px 0; font-size: 0.8rem; color: #334155; }
        .sibling-action-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
          .btn-copy-parent { font-size: 0.75rem; height: 28px; line-height: 26px; }
          .differ-note { font-size: 0.72rem; color: #64748b; }
        }
        .sibling-tags {
          display: flex;
          gap: 6px;
          margin-top: 6px;
          .sibling-tag {
            font-size: 0.72rem;
            padding: 2px 6px;
            border-radius: 4px;
            display: inline-flex;
            align-items: center;
            gap: 3px;
            mat-icon { font-size: 13px; width: 13px; height: 13px; }
            &.branch { background: #e0f2fe; color: #0284c7; }
            &.batch { background: #f3e8ff; color: #7e22ce; }
            &.address { background: #ecfdf5; color: #059669; }
          }
        }
      }
    }

    /* ── Phone + Address two-column row ── */
    .phone-address-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      align-items: start;
    }
    .phone-field-wrap {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .full-width-field { width: 100%; }
    .address-field { width: 100%; }

    /* ── Quick Coaching Enrollment Modal ── */
    .enroll-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .enroll-modal-card {
      background: #ffffff;
      border-radius: 14px;
      width: 100%;
      max-width: 640px;
      overflow: hidden;
      animation: modalPop 0.2s ease-out;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);

      .ecc-header {
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        padding: 18px 24px;
        border-bottom: 1px solid #bfdbfe;
        display: flex;
        justify-content: space-between;
        align-items: center;

        .ecc-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .ecc-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: #2563eb;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
          mat-icon { font-size: 24px; width: 24px; height: 24px; }
        }

        .ecc-title {
          h3 { margin: 0; font-size: 1.18rem; color: #1e3a8a; font-weight: 700; line-height: 1.3; }
          p { margin: 3px 0 0 0; color: #3b82f6; font-size: 0.82rem; strong { color: #1e40af; } }
        }

        .close-btn {
          color: #64748b;
          &:hover { color: #1e293b; }
        }
      }

      .ecc-body {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;

        .student-pill-banner {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          padding: 12px 16px;
          .spb-name { font-size: 1.05rem; font-weight: 700; color: #1e40af; }
          .spb-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            font-size: 0.82rem;
            color: #1e3a8a;
            margin-top: 4px;
          }
        }

        .ecc-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
      }

      .ecc-actions {
        padding: 12px 20px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    }

    @keyframes modalPop {
      from { transform: scale(0.94); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    /* Responsive Media Queries */
    @media (max-width: 1150px) {
      .header-actions {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }
      .header-btns {
        width: 100%;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;

        a, button {
          white-space: nowrap !important;
          flex-shrink: 0;

          span {
            white-space: nowrap !important;
          }
        }
      }
    }

    @media (max-width: 768px) {
      .header-actions {
        h2 { font-size: 1.25rem; }
        p { font-size: 0.82rem; }
      }

      .header-btns {
        gap: 8px;
        width: 100%;

        a, button {
          font-size: 0.8rem !important;
          padding: 0 10px !important;
          height: 34px !important;
          line-height: 34px !important;
          white-space: nowrap !important;

          span {
            white-space: nowrap !important;
          }

          mat-icon {
            font-size: 16px !important;
            width: 16px !important;
            height: 16px !important;
            margin-right: 3px !important;
          }
        }

        .promotion-link-btn,
        .more-actions-btn {
          flex: 1 1 auto;
          min-width: 0;
          justify-content: center;
          white-space: nowrap !important;
        }

        .add-btn {
          flex: 1 1 100%;
          justify-content: center;
          height: 36px !important;
          line-height: 36px !important;
          white-space: nowrap !important;
        }
      }

      .form-grid {
        grid-template-columns: 1fr !important;
      }
      .full-span {
        grid-column: span 1 !important;
      }

      .filter-toolbar {
        padding: 12px 12px 2px 12px;
        gap: 8px;

        .search-field,
        .filter-select,
        .section-select,
        .status-select {
          flex: 1 1 100% !important;
          min-width: 100% !important;
          max-width: 100% !important;
        }
      }
    }

    @media (max-width: 520px) {
      .header-btns {
        gap: 6px;

        a, button {
          font-size: 0.74rem !important;
          padding: 0 6px !important;
          white-space: nowrap !important;

          span {
            white-space: nowrap !important;
          }
        }

        .promotion-link-btn,
        .more-actions-btn {
          flex: 1 1 calc(50% - 4px);
          justify-content: center;
          white-space: nowrap !important;
        }

        .add-btn {
          flex: 1 1 100%;
          justify-content: center;
          white-space: nowrap !important;
        }
      }
    }
  `]
})
export class StudentsComponent implements OnInit, OnDestroy {
  displayedColumns = ['photo', 'rollNumber', 'studentName', 'enrollment', 'batchOrClass', 'parentName', 'parentWhatsAppPhone', 'actions'];
  students: any[] = [];
  batches: any[] = [];
  schoolClasses: SchoolClassDto[] = [];
  formSections: SchoolSectionDto[] = [];
  filterSections: SchoolSectionDto[] = [];

  showForm = false;
  isEditMode = false;
  selectedStudent: any = null;
  saving = false;
  loading = false;
  rollNumberLoading = false;
  phoneCheckLoading = false;
  phoneDuplicateError = '';
  siblingInfo: {
    studentName: string | null;
    parentName: string | null;
    motherName?: string | null;
    address?: string | null;
    batchName: string | null;
    branchName: string | null;
  } | null = null;

  totalCount = 0;
  pageSize = 10;
  pageIndex = 0;
  searchTerm = '';
  sortBy = 'rollNumber';
  sortDescending = false;

  selectedStreamFilter = 'all'; // 'all', 'school', 'coaching', 'hostel', 'dayscholar'
  selectedStatusFilter = 'all'; // 'all', 'active', 'left'
  selectedBatchFilter = '';
  selectedClassFilter = '';
  selectedSectionFilter = '';

  /** Hostel Support */
  hostelsList: HostelDto[] = [];
  availableBedsList: HostelBedDto[] = [];
  selectedBedRent: number | null = null;

  /** Library Membership Support */
  libraryPlans: LibraryMembershipPlanDto[] = [];

  /** Inventory Admission Kit Support */
  availableInventoryItems: InventoryItem[] = [];
  selectedKitItemId: string = '';
  admissionKitRows: {
    itemId: string;
    itemName: string;
    itemCode: string;
    quantity: number;
    unitPrice: number;
    maxStock: number;
    isExistingIssue?: boolean;
    outwardId?: string;
    issueNumber?: string;
  }[] = [];
  totalKitPayable = 0;
  studentExistingKitOutward: any = null;
  loadingKitDetails = false;

  /** 1-Click Coaching Enrollment Dialog */
  enrollCoachingModalOpen = false;
  enrollingStudent: any = null;
  enrollingBatchId = '';
  enrollingCoachingRollNumber = '';
  enrollingRollNumberLoading = false;
  enrollingCustomFee: number | null = null;
  enrollingLoading = false;

  /** Photo handling */
  photoPreview: string | null = null;
  private selectedPhotoData: string | null = null;

  /** Date Range Bounds for DOB and DOJ */
  minDob = '1950-01-01';
  maxDob: string = '';
  minDoj = '2010-01-01';
  maxDoj: string = '';
  dateErrorMatcher = new DateRangeInstantErrorMatcher();

  studentForm: FormGroup;
  private batchIdSub?: Subscription;
  private phoneSub?: Subscription;
  private studentNameSub?: Subscription;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('fileInput') fileInput: any;

  constructor(
    private coachingService: CoachingService,
    private schoolService: SchoolService,
    private hostelService: HostelService,
    private libraryService: LibraryService,
    private confirmDialog: ConfirmDialogService,
    private dialog: MatDialog,
    private fb: FormBuilder,
    private router: Router,
    public authService: AuthService,
    private inventoryService: InventoryService
  ) {
    const hasSchool = this.authService.hasSchoolModule();
    const hasCoaching = this.authService.hasCoachingModule();
    // Default: School enrollment is CHECKED, Coaching is UNCHECKED
    const initSchool = hasSchool;
    const initCoaching = hasSchool ? false : hasCoaching;

    const today = new Date();
    this.maxDob = this.formatDateForInput(today);
    const nextYear = new Date();
    nextYear.setFullYear(today.getFullYear() + 1);
    this.maxDoj = this.formatDateForInput(nextYear);

    this.studentForm = this.fb.group({
      isSchoolStudent: [initSchool],
      isCoachingStudent: [initCoaching],
      isHostelStudent: [false],
      hostelId: [''],
      hostelBedId: [''],
      isLibraryMember: [false],
      libraryCardNumber: [''],
      libraryMembershipType: ['Standard Book Lending'],
      maxLibraryBooks: [2],
      monthlyLibraryFee: [0],
      isIssueAdmissionKit: [false],
      kitPaymentStatus: ['AddedToFeeBill'],
      kitPaymentMode: ['Cash'],
      classId: [initSchool ? '' : ''],
      sectionId: [''],
      admissionNumber: [''],
      joiningDate: [
        this.formatDateForInput(new Date()),
        [
          Validators.required,
          (c: AbstractControl): ValidationErrors | null => {
            if (!c.value) return null;
            const d = new Date(c.value);
            if (isNaN(d.getTime())) return { invalidRange: true };
            if (d < new Date('2010-01-01')) return { invalidRange: true };
            const maxD = new Date();
            maxD.setFullYear(maxD.getFullYear() + 1);
            if (d > maxD) return { futureDate: true };
            return null;
          }
        ]
      ],
      schoolRollNumber: [''],
      batchId: ['', initCoaching ? [Validators.required] : []],
      rollNumber: ['', initCoaching ? [Validators.required] : []],
      studentName: ['', Validators.required],
      gender: ['Male'],
      dateOfBirth: [
        '',
        [
          (c: AbstractControl): ValidationErrors | null => {
            if (!c.value) return null;
            const d = new Date(c.value);
            if (isNaN(d.getTime())) return { invalidRange: true };
            const todayDate = new Date();
            if (d > todayDate) return { futureDate: true };
            if (d < new Date('1950-01-01')) return { tooOld: true };
            return null;
          }
        ]
      ],
      motherName: [''],
      bloodGroup: [''],
      parentName: ['', Validators.required],
      parentWhatsAppPhone: [''],
      address: [''],
      aadhaarNumber: [''],
      penNumber: [''],
      apaarId: [''],
      category: ['General'],
      religion: [''],
      emergencyContactName: [''],
      emergencyContactPhone: [''],
      previousSchoolName: [''],
      previousBoard: ['']
    }, {
      validators: [
        (group: AbstractControl): ValidationErrors | null => {
          const dobCtrl = group.get('dateOfBirth');
          const dojCtrl = group.get('joiningDate');
          const dobVal = dobCtrl?.value;
          const dojVal = dojCtrl?.value;
          if (dobVal && dojVal) {
            const dob = new Date(dobVal);
            const doj = new Date(dojVal);
            if (!isNaN(dob.getTime()) && !isNaN(doj.getTime()) && doj <= dob) {
              if (dobCtrl && !dobCtrl.hasError('dojBeforeDob')) {
                dobCtrl.setErrors({ ...(dobCtrl.errors || {}), dojBeforeDob: true });
              }
              if (dojCtrl && !dojCtrl.hasError('dojBeforeDob')) {
                dojCtrl.setErrors({ ...(dojCtrl.errors || {}), dojBeforeDob: true });
              }
              return { dojBeforeDob: true };
            }
          }
          if (dobCtrl?.hasError('dojBeforeDob')) {
            const errors = { ...dobCtrl.errors };
            delete errors['dojBeforeDob'];
            dobCtrl.setErrors(Object.keys(errors).length ? errors : null);
          }
          if (dojCtrl?.hasError('dojBeforeDob')) {
            const errors = { ...dojCtrl.errors };
            delete errors['dojBeforeDob'];
            dojCtrl.setErrors(Object.keys(errors).length ? errors : null);
          }
          return null;
        }
      ]
    });

    this.studentForm.get('joiningDate')?.valueChanges.subscribe(() => {
      this.studentForm.updateValueAndValidity({ emitEvent: false });
    });
    this.studentForm.get('dateOfBirth')?.valueChanges.subscribe(() => {
      this.studentForm.updateValueAndValidity({ emitEvent: false });
    });
  }

  ngOnInit(): void {
    if (this.authService.isStudentOrParent()) {
      this.router.navigate(['/students/my-profile']);
      return;
    }

    if (this.authService.hasCoachingModule()) {
      this.coachingService.getBatches().subscribe(b => this.batches = b || []);
    }
    if (this.authService.hasSchoolModule()) {
      this.schoolService.getClasses(false).subscribe(c => this.schoolClasses = c || []);
    }
    if (this.authService.hasHostelModule()) {
      this.hostelService.getHostels().subscribe(h => this.hostelsList = h || []);
    }
    if (this.authService.hasLibraryModule()) {
      this.loadLibraryPlans();
    }

    if (!this.authService.hasCoachingModule() && this.authService.hasSchoolModule()) {
      this.selectedStreamFilter = 'school';
    }

    this.loadStudents();
    this.setupBatchIdWatcher();
  }

  loadLibraryPlans(): void {
    this.libraryService.getMembershipPlans().subscribe({
      next: (plans) => {
        this.libraryPlans = plans || [];
      },
      error: (err) => console.error('Error loading library membership plans:', err)
    });
  }

  openManagePlansModal(): void {
    const dialogRef = this.dialog.open(ManageLibraryPlansDialogComponent, {
      width: '840px',
      maxWidth: '96vw',
      disableClose: false,
      panelClass: 'custom-dialog-container'
    });

    dialogRef.afterClosed().subscribe(() => {
      this.loadLibraryPlans();
    });
  }

  ngOnDestroy(): void {
    this.batchIdSub?.unsubscribe();
    this.phoneSub?.unsubscribe();
    this.studentNameSub?.unsubscribe();
  }

  onStreamCheckChanged(): void {
    const isSchool = this.studentForm.get('isSchoolStudent')?.value;
    const isCoaching = this.studentForm.get('isCoachingStudent')?.value;
    const batchCtrl = this.studentForm.get('batchId');
    const rollCtrl = this.studentForm.get('rollNumber');
    const classCtrl = this.studentForm.get('classId');

    if (isCoaching) {
      batchCtrl?.setValidators([Validators.required]);
      rollCtrl?.setValidators([Validators.required]);
    } else {
      batchCtrl?.clearValidators();
      rollCtrl?.clearValidators();
      batchCtrl?.setValue('');
      rollCtrl?.setValue('');
    }
    batchCtrl?.updateValueAndValidity();
    rollCtrl?.updateValueAndValidity();

    if (isSchool) {
      classCtrl?.setValidators([Validators.required]);
    } else {
      classCtrl?.clearValidators();
      classCtrl?.setValue('');
      this.studentForm.get('sectionId')?.setValue('');
      this.studentForm.get('admissionNumber')?.setValue('', { emitEvent: false });
      this.studentForm.get('schoolRollNumber')?.setValue('', { emitEvent: false });
      this.formSections = [];
    }
    classCtrl?.updateValueAndValidity();
  }

  onClassSelectionChange(classId: string): void {
    const selected = this.schoolClasses.find(c => c.id === classId);
    this.formSections = selected?.sections || [];
    const firstSection = this.formSections.length > 0 ? this.formSections[0] : null;
    this.studentForm.get('sectionId')?.setValue(firstSection ? firstSection.id : '');

    if (!this.isEditMode && classId) {
      // Auto-generate Admission/SR Number
      if (!this.studentForm.get('admissionNumber')?.value) {
        this.coachingService.getNextAdmissionNumber().subscribe({
          next: (res) => this.studentForm.get('admissionNumber')?.setValue(res.admissionNumber, { emitEvent: false }),
          error: () => { }
        });
      }
      // Auto-generate School Roll Number
      this.coachingService.getNextSchoolRollNumber(classId).subscribe({
        next: (res) => this.studentForm.get('schoolRollNumber')?.setValue(res.schoolRollNumber, { emitEvent: false }),
        error: () => { }
      });
    }
  }

  autoGenerateSchoolRollNumber(classId: string): void {
    if (!this.isEditMode && classId) {
      this.coachingService.getNextSchoolRollNumber(classId).subscribe({
        next: (res) => this.studentForm.get('schoolRollNumber')?.setValue(res.schoolRollNumber, { emitEvent: false }),
        error: () => { }
      });
    }
  }

  onHostelCheckChanged(): void {
    const isHostel = this.studentForm.get('isHostelStudent')?.value;
    if (isHostel) {
      if (this.hostelsList.length === 0) {
        this.hostelService.getHostels().subscribe(h => {
          this.hostelsList = h || [];
          if (this.hostelsList.length > 0) {
            this.studentForm.patchValue({ hostelId: this.hostelsList[0].id });
            this.onHostelBuildingChange(this.hostelsList[0].id);
          }
        });
      } else if (!this.studentForm.get('hostelId')?.value && this.hostelsList.length > 0) {
        this.studentForm.patchValue({ hostelId: this.hostelsList[0].id });
        this.onHostelBuildingChange(this.hostelsList[0].id);
      }
    } else {
      this.studentForm.patchValue({ hostelId: '', hostelBedId: '' });
      this.availableBedsList = [];
      this.selectedBedRent = null;
    }
  }

  onHostelBuildingChange(hostelId: string): void {
    if (!hostelId) {
      this.availableBedsList = [];
      this.selectedBedRent = null;
      return;
    }
    this.hostelService.getAvailableBeds(hostelId).subscribe(beds => {
      this.availableBedsList = beds || [];
      if (this.availableBedsList.length > 0) {
        this.studentForm.patchValue({ hostelBedId: this.availableBedsList[0].id });
        this.selectedBedRent = this.availableBedsList[0].monthlyRent;
      } else {
        this.studentForm.patchValue({ hostelBedId: '' });
        this.selectedBedRent = null;
      }
    });
  }

  onBedSelectionChange(bedId: string): void {
    const bed = this.availableBedsList.find(b => b.id === bedId);
    this.selectedBedRent = bed ? bed.monthlyRent : null;
  }

  onLibraryCheckChanged(): void {
    const isLib = this.studentForm.get('isLibraryMember')?.value;
    if (isLib) {
      if (!this.studentForm.get('libraryCardNumber')?.value) {
        this.autoGenerateLibraryCard();
      }
      const currentType = this.studentForm.get('libraryMembershipType')?.value;
      if (this.libraryPlans && this.libraryPlans.length > 0) {
        let matched = this.libraryPlans.find(p => p.planName === currentType);
        if (!matched) {
          matched = this.libraryPlans[0];
        }
        this.studentForm.patchValue({
          libraryMembershipType: matched.planName,
          maxLibraryBooks: matched.maxBooks || 2,
          monthlyLibraryFee: matched.monthlyFee ?? 0
        });
      } else {
        if (!this.studentForm.get('maxLibraryBooks')?.value) {
          this.studentForm.patchValue({ maxLibraryBooks: 2 });
        }
        if (!this.studentForm.get('libraryMembershipType')?.value) {
          this.studentForm.patchValue({ libraryMembershipType: 'Standard Book Lending' });
        }
        if (this.studentForm.get('monthlyLibraryFee')?.value === null || this.studentForm.get('monthlyLibraryFee')?.value === undefined) {
          this.studentForm.patchValue({ monthlyLibraryFee: 0 });
        }
      }
    }
  }

  onLibraryPlanSelectionChange(selectedPlanName: string): void {
    const plan = this.libraryPlans.find(p => p.planName === selectedPlanName);
    if (plan) {
      this.studentForm.patchValue({
        monthlyLibraryFee: plan.monthlyFee,
        maxLibraryBooks: plan.maxBooks || 2
      });
    }
  }

  autoGenerateLibraryCard(): void {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    this.studentForm.patchValue({ libraryCardNumber: `LIB-${year}-${rand}` });
  }

  // ── Inventory Admission Kit Helpers ──────────────────────
  onKitCheckChanged(): void {
    const isKit = this.studentForm.get('isIssueAdmissionKit')?.value;
    if (isKit && this.availableInventoryItems.length === 0) {
      this.loadInventoryItems();
    }
  }

  loadInventoryItems(): void {
    const branchId = this.authService.selectedBranchId() || undefined;
    this.inventoryService.getItems({ activeOnly: true, branchId }).subscribe({
      next: (items) => {
        this.availableInventoryItems = items || [];
      },
      error: () => {}
    });
  }

  addSelectedKitItem(): void {
    if (!this.selectedKitItemId) return;
    const item = this.availableInventoryItems.find(i => i.id === this.selectedKitItemId);
    if (!item) return;

    const existing = this.admissionKitRows.find(r => r.itemId === item.id);
    if (existing) {
      if (existing.quantity < item.currentStock) {
        existing.quantity += 1;
      }
    } else {
      this.admissionKitRows.push({
        itemId: item.id,
        itemName: item.itemName,
        itemCode: item.itemCode,
        quantity: 1,
        unitPrice: item.sellingPrice || 0,
        maxStock: item.currentStock
      });
    }
    this.selectedKitItemId = '';
    this.recalculateKitTotal();
  }

  removeKitItem(idx: number): void {
    this.admissionKitRows.splice(idx, 1);
    this.recalculateKitTotal();
  }

  recalculateKitTotal(): void {
    this.totalKitPayable = this.admissionKitRows.reduce((sum, r) => sum + (r.quantity * r.unitPrice), 0);
  }

  // ── Sibling & Parent Smart Match Helpers ─────────────────

  get isParentNameMatching(): boolean {
    if (!this.siblingInfo || !this.siblingInfo.parentName) return true;
    const currentParent = (this.studentForm?.get('parentName')?.value || '').trim().toLowerCase();
    const linkedParent = (this.siblingInfo.parentName || '').trim().toLowerCase();
    if (!currentParent) return true;
    return currentParent === linkedParent;
  }

  get currentEnteredParentName(): string {
    return (this.studentForm?.get('parentName')?.value || '').trim();
  }

  useLinkedParentName(): void {
    if (this.siblingInfo?.parentName) {
      const parentCtrl = this.studentForm?.get('parentName');
      if (parentCtrl) {
        parentCtrl.setValue(this.siblingInfo.parentName);
        parentCtrl.markAsDirty();
      }
    }
  }

  useLinkedAddress(): void {
    if (this.siblingInfo?.address) {
      const addrCtrl = this.studentForm?.get('address');
      if (addrCtrl) {
        addrCtrl.setValue(this.siblingInfo.address);
        addrCtrl.markAsDirty();
      }
    }
  }

  // ── Photo helpers ────────────────────────────────────────

  triggerFileInput(): void {
    this.fileInput?.nativeElement?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreview = reader.result as string;
      this.selectedPhotoData = reader.result as string;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  removePhoto(): void {
    this.photoPreview = null;
    this.selectedPhotoData = null;
  }

  getPhotoUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${API_BASE}${path}`;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  // ── Watchers ─────────────────────────────────────────────

  private setupBatchIdWatcher(): void {
    this.batchIdSub = this.studentForm.get('batchId')!.valueChanges.subscribe((batchId: string) => {
      if (!this.isEditMode && batchId && this.studentForm.value.isCoachingStudent) {
        this.rollNumberLoading = true;
        this.studentForm.get('rollNumber')!.setValue('', { emitEvent: false });
        this.coachingService.getNextRollNumber(batchId).subscribe({
          next: (res) => {
            this.studentForm.get('rollNumber')!.setValue(res.rollNumber, { emitEvent: false });
            this.rollNumberLoading = false;
          },
          error: () => {
            this.rollNumberLoading = false;
          }
        });
      } else if (!batchId) {
        this.studentForm.get('rollNumber')!.setValue('', { emitEvent: false });
      }
    });

    // Phone duplicate & sibling watcher
    this.phoneSub = this.studentForm.get('parentWhatsAppPhone')!.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe((phone: string) => {
      const control = this.studentForm.get('parentWhatsAppPhone');
      if (!control) return;

      const rawDigits = (phone || '').replace(/\D/g, '');
      if (!rawDigits) {
        this.phoneDuplicateError = '';
        this.siblingInfo = null;
        if (control.hasError('duplicate')) {
          const errors = { ...control.errors };
          delete errors['duplicate'];
          control.setErrors(Object.keys(errors).length ? errors : null);
        }
        return;
      }

      if (rawDigits.length === 10 && /^[6-9]\d{9}$/.test(rawDigits)) {
        this.phoneCheckLoading = true;
        const excludeId = this.isEditMode && this.selectedStudent ? this.selectedStudent.id : undefined;
        const currentStudentName = (this.studentForm.get('studentName')?.value || '').trim();

        this.coachingService.checkPhoneDuplicate(rawDigits, excludeId, currentStudentName).subscribe({
          next: (res) => {
            this.phoneCheckLoading = false;
            if (res.isFound) {
              if (res.isDuplicate) {
                this.phoneDuplicateError = `Duplicate Entry: "${res.studentName}" is already registered in ${res.batchName || 'another batch'}.`;
                this.siblingInfo = null;
                control.setErrors({ ...control.errors, duplicate: true });
                control.markAsTouched();
              } else {
                this.phoneDuplicateError = '';
                this.siblingInfo = {
                  studentName: res.studentName,
                  parentName: res.parentName,
                  motherName: res.motherName,
                  address: res.address,
                  batchName: res.batchName,
                  branchName: res.branchName
                };
                const parentCtrl = this.studentForm.get('parentName');
                if (parentCtrl && !parentCtrl.value && res.parentName) {
                  parentCtrl.setValue(res.parentName);
                  parentCtrl.markAsDirty();
                }
                const motherCtrl = this.studentForm.get('motherName');
                if (motherCtrl && !motherCtrl.value && res.motherName) {
                  motherCtrl.setValue(res.motherName);
                  motherCtrl.markAsDirty();
                }
                const addressCtrl = this.studentForm.get('address');
                if (addressCtrl && (!addressCtrl.value || !addressCtrl.value.trim()) && res.address) {
                  addressCtrl.setValue(res.address);
                  addressCtrl.markAsDirty();
                }
                if (control.hasError('duplicate')) {
                  const errors = { ...control.errors };
                  delete errors['duplicate'];
                  control.setErrors(Object.keys(errors).length ? errors : null);
                }
              }
            } else {
              this.phoneDuplicateError = '';
              this.siblingInfo = null;
              if (control.hasError('duplicate')) {
                const errors = { ...control.errors };
                delete errors['duplicate'];
                control.setErrors(Object.keys(errors).length ? errors : null);
              }
            }
          },
          error: () => {
            this.phoneCheckLoading = false;
          }
        });
      }
    });

    this.studentNameSub = this.studentForm.get('studentName')!.valueChanges.pipe(
      debounceTime(300)
    ).subscribe((name: string) => {
      if (this.siblingInfo && name) {
        if (this.siblingInfo.studentName?.trim().toLowerCase() === name.trim().toLowerCase()) {
          this.phoneDuplicateError = `Duplicate Entry: "${this.siblingInfo.studentName}" is already registered in ${this.siblingInfo.batchName || 'another batch'}.`;
          const control = this.studentForm.get('parentWhatsAppPhone');
          if (control) {
            control.setErrors({ ...control.errors, duplicate: true });
            control.markAsTouched();
          }
        } else {
          this.phoneDuplicateError = '';
          const control = this.studentForm.get('parentWhatsAppPhone');
          if (control && control.hasError('duplicate')) {
            const errors = { ...control.errors };
            delete errors['duplicate'];
            control.setErrors(Object.keys(errors).length ? errors : null);
          }
        }
      }
    });
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let rawDigits = input.value.replace(/\D/g, '');

    if (rawDigits.length === 12 && rawDigits.startsWith('91')) {
      rawDigits = rawDigits.substring(2);
    }
    if (rawDigits.length > 10) {
      rawDigits = rawDigits.substring(0, 10);
    }

    let formatted = rawDigits;
    if (rawDigits.length > 5) {
      formatted = `${rawDigits.substring(0, 5)} ${rawDigits.substring(5)}`;
    }

    input.value = formatted;
    this.studentForm.get('parentWhatsAppPhone')?.setValue(formatted, { emitEvent: true });
    this.validatePhoneNumber(rawDigits);
  }

  validatePhoneNumber(rawDigits: string): void {
    const control = this.studentForm.get('parentWhatsAppPhone');
    if (!control) return;

    if (!rawDigits) {
      this.phoneDuplicateError = '';
      if (control.hasError('invalidPhone') || control.hasError('duplicate')) {
        const errors = { ...control.errors };
        delete errors['invalidPhone'];
        delete errors['duplicate'];
        control.setErrors(Object.keys(errors).length ? errors : null);
      }
      return;
    }

    const isValid = /^[6-9]\d{9}$/.test(rawDigits);
    if (!isValid) {
      control.setErrors({ ...control.errors, invalidPhone: true });
    } else {
      if (control.hasError('invalidPhone')) {
        const errors = { ...control.errors };
        delete errors['invalidPhone'];
        control.setErrors(Object.keys(errors).length ? errors : null);
      }
    }
  }

  // ── Stream & Filter Controls ─────────────────────────────

  setStreamFilter(stream: string): void {
    this.selectedStreamFilter = stream;
    this.pageIndex = 0;
    this.loadStudents();
  }

  onFilterChange(): void {
    this.pageIndex = 0;
    this.loadStudents();
  }

  onClassFilterChange(): void {
    const cls = this.schoolClasses.find(c => c.id === this.selectedClassFilter);
    this.filterSections = cls?.sections || [];
    this.selectedSectionFilter = '';
    this.pageIndex = 0;
    this.loadStudents();
  }

  onSearch(): void {
    this.pageIndex = 0;
    this.loadStudents();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadStudents();
  }

  onSortChange(sort: Sort): void {
    this.sortBy = sort.active || 'rollNumber';
    this.sortDescending = sort.direction === 'desc';
    this.pageIndex = 0;
    this.loadStudents();
  }

  // ── Load Students ────────────────────────────────────────

  loadStudents(): void {
    this.loading = true;
    this.coachingService.getStudentsPaged(
      this.pageIndex + 1,
      this.pageSize,
      this.searchTerm,
      this.sortBy,
      this.sortDescending,
      this.selectedBatchFilter,
      this.selectedStreamFilter === 'all' ? undefined : this.selectedStreamFilter,
      this.selectedClassFilter || undefined,
      this.selectedSectionFilter || undefined,
      this.selectedStatusFilter === 'all' ? undefined : this.selectedStatusFilter
    ).subscribe({
      next: (res) => {
        this.students = res.items || [];
        this.totalCount = res.totalCount || 0;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        console.error('Error loading paged students:', err);
      }
    });
  }

  // ── Student Leaving / TC Workflow ─────────────────────────

  openStudentLeavingModal(student: any, isViewOnly: boolean = false): void {
    const dialogRef = this.dialog.open(StudentLeavingDialogComponent, {
      width: '820px',
      maxWidth: '95vw',
      disableClose: false,
      data: { student, isViewOnly }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res?.updated) {
        this.loadStudents();
      } else if (res?.openReAdmit && res?.student) {
        this.openReAdmitModal(res.student);
      }
    });
  }

  isStudentPassedOut(student: any): boolean {
    const reason = student?.leavingReason;
    return !!(reason && (reason.includes('Passed Out') || reason.includes('Completed')));
  }

  openReAdmitModal(student: any): void {
    if (this.isStudentPassedOut(student)) {
      this.confirmDialog.alert(
        'Re-Admission Not Permitted',
        'This student has passed out / graduated from the terminal class. They cannot be re-admitted to the same class. Please register a fresh admission for the higher class or stream.',
        'info'
      );
      return;
    }

    const dialogRef = this.dialog.open(StudentReadmissionDialogComponent, {
      width: '660px',
      maxWidth: '95vw',
      disableClose: false,
      data: { student }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res?.reAdmitted) {
        this.loadStudents();
      }
    });
  }

  // ── Student ID Card Studio ─────────────────────────────────

  openIdCardDialog(student: any): void {
    this.dialog.open(StudentIdCardDialogComponent, {
      width: '1100px',
      maxWidth: '97vw',
      maxHeight: '92vh',
      panelClass: 'idcard-modal-container',
      disableClose: false,
      data: {
        studentId: student.id,
        studentName: student.studentName,
        classId: student.classId,
        sectionId: student.sectionId,
        className: student.className,
        schoolClasses: this.schoolClasses
      }
    });
  }

  // ── Bonafide / Character Certificate Generator ─────────────

  openBonafideDialog(student: any): void {
    this.dialog.open(StudentBonafideDialogComponent, {
      width: '840px',
      maxWidth: '97vw',
      maxHeight: '92vh',
      panelClass: 'cert-modal-container',
      disableClose: false,
      data: { student }
    });
  }

  // ── Class Roll Number Re-Sequencer Dialog ───────────────────
  openRollSequencer(): void {
    const dialogRef = this.dialog.open(StudentRollSequencerDialogComponent, {
      width: '900px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'cert-modal-container',
      disableClose: false,
      data: {
        schoolClasses: this.schoolClasses,
        selectedClassId: this.selectedClassFilter,
        selectedSectionId: this.selectedSectionFilter
      }
    });

    dialogRef.afterClosed().subscribe((changed) => {
      if (changed) {
        this.loadStudents();
      }
    });
  }

  // ── Student 360° Dossier & KYC Vault ───────────────────────
  openStudent360(student: any): void {
    this.dialog.open(StudentProfile360DialogComponent, {
      width: '1040px',
      maxWidth: '97vw',
      maxHeight: '94vh',
      panelClass: 'student-360-modal-container',
      disableClose: false,
      data: {
        studentId: student.id,
        studentName: student.studentName,
        studentData: student
      }
    });
  }

  // ── Student & Parent Portal Logins Dialog ──────────────────
  openPortalLogins(student: any): void {
    const dialogRef = this.dialog.open(StudentPortalLoginDialogComponent, {
      width: '820px',
      maxWidth: '96vw',
      panelClass: 'portal-login-modal-container',
      disableClose: false,
      data: {
        studentId: student.id,
        studentName: student.studentName,
        admissionNumber: student.admissionNumber,
        rollNumber: student.rollNumber,
        profilePhoto: student.profilePhoto
      }
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        student.hasStudentAccount = res.hasStudentAccount;
        student.hasParentAccount = res.hasParentAccount;
      }
    });
  }

  // ── Add / Edit Form Actions ──────────────────────────────

  toggleForm(): void {
    this.showForm = !this.showForm;
    const hasSchool = this.authService.hasSchoolModule();
    const hasCoaching = this.authService.hasCoachingModule();
    const initSchool = hasSchool;
    const initCoaching = hasSchool ? false : hasCoaching;

    if (!this.showForm) {
      this.isEditMode = false;
      this.selectedStudent = null;
      this.rollNumberLoading = false;
      this.phoneDuplicateError = '';
      this.siblingInfo = null;
      this.phoneCheckLoading = false;
      this.photoPreview = null;
      this.selectedPhotoData = null;
      this.formSections = [];
      this.admissionKitRows = [];
      this.selectedKitItemId = '';
      this.totalKitPayable = 0;
      this.studentForm.reset({
        isSchoolStudent: initSchool,
        isCoachingStudent: initCoaching,
        joiningDate: this.formatDateForInput(new Date()),
        isHostelStudent: false,
        isLibraryMember: false,
        libraryCardNumber: '',
        libraryMembershipType: 'Standard Book Lending',
        maxLibraryBooks: 2,
        monthlyLibraryFee: 0,
        isIssueAdmissionKit: false,
        kitPaymentStatus: 'AddedToFeeBill',
        kitPaymentMode: 'Cash',
        gender: 'Male'
      });
      this.onStreamCheckChanged();
      this.loadStudents();
    } else if (!this.isEditMode) {
      this.studentForm.patchValue({
        isSchoolStudent: initSchool,
        isCoachingStudent: initCoaching
      });
      this.onStreamCheckChanged();
    }
  }

  editStudent(student: any): void {
    this.selectedStudent = student;
    this.isEditMode = true;
    this.showForm = true;
    this.siblingInfo = null;
    this.phoneDuplicateError = '';
    this.photoPreview = student.profilePhoto ? this.getPhotoUrl(student.profilePhoto) : null;
    this.selectedPhotoData = null;
    this.admissionKitRows = [];
    this.selectedKitItemId = '';
    this.totalKitPayable = 0;
    this.studentExistingKitOutward = null;

    if (this.authService.hasInventoryModule()) {
      this.loadInventoryItems();
      if (student?.id) {
        this.loadingKitDetails = true;
        this.inventoryService.getOutwards({ studentId: student.id }).subscribe({
          next: (outwards) => {
            this.loadingKitDetails = false;
            const activeOutwards = (outwards || []).filter(o => o.paymentStatus !== 'Cancelled');
            if (activeOutwards.length > 0) {
              this.studentExistingKitOutward = activeOutwards[0];
              this.studentForm.patchValue({
                isIssueAdmissionKit: true,
                kitPaymentStatus: activeOutwards[0].paymentStatus,
                kitPaymentMode: activeOutwards[0].paymentMode || 'Cash'
              });
              this.admissionKitRows = [];
              for (const out of activeOutwards) {
                for (const it of out.items) {
                  this.admissionKitRows.push({
                    itemId: it.itemId,
                    itemName: it.itemName,
                    itemCode: it.itemCode,
                    quantity: it.quantity,
                    unitPrice: it.unitPrice,
                    maxStock: 9999,
                    isExistingIssue: true,
                    outwardId: out.id,
                    issueNumber: out.issueNumber
                  });
                }
              }
              this.recalculateKitTotal();
            } else {
              this.studentForm.patchValue({ isIssueAdmissionKit: false });
            }
          },
          error: () => {
            this.loadingKitDetails = false;
          }
        });
      }
    }

    let formattedPhone = student.parentWhatsAppPhone || '';
    const raw = formattedPhone.replace(/\D/g, '');
    const cleanDigits = (raw.length === 12 && raw.startsWith('91')) ? raw.substring(2) : raw;
    if (cleanDigits.length === 10) {
      formattedPhone = `${cleanDigits.substring(0, 5)} ${cleanDigits.substring(5)}`;
    }

    if (student.classId) {
      const cls = this.schoolClasses.find(c => c.id === student.classId);
      this.formSections = cls?.sections || [];
    } else {
      this.formSections = [];
    }

    this.studentForm.patchValue({
      isSchoolStudent: !!student.isSchoolStudent,
      isCoachingStudent: student.isCoachingStudent !== false,
      isHostelStudent: !!student.isHostelStudent,
      hostelId: student.hostelId || '',
      hostelBedId: student.hostelBedId || '',
      isLibraryMember: !!student.isLibraryMember,
      libraryCardNumber: student.libraryCardNumber || '',
      libraryMembershipType: student.libraryMembershipType || 'Standard Book Lending',
      maxLibraryBooks: student.maxLibraryBooks ?? 2,
      monthlyLibraryFee: student.monthlyLibraryFee ?? 0,
      classId: student.classId || '',
      sectionId: student.sectionId || '',
      admissionNumber: student.admissionNumber || '',
      joiningDate: this.formatDateForInput(student.joiningDate || new Date()),
      schoolRollNumber: student.schoolRollNumber || '',
      batchId: student.batchId || '',
      rollNumber: student.coachingRollNumber || student.rollNumber || '',
      studentName: student.studentName,
      gender: student.gender || 'Male',
      dateOfBirth: this.formatDateForInput(student.dateOfBirth),
      motherName: student.motherName || '',
      bloodGroup: student.bloodGroup || '',
      parentName: student.parentName,
      parentWhatsAppPhone: formattedPhone,
      address: student.address || '',
      aadhaarNumber: student.aadhaarNumber || '',
      penNumber: student.penNumber || '',
      apaarId: student.apaarId || '',
      category: student.category || 'General',
      religion: student.religion || '',
      emergencyContactName: student.emergencyContactName || '',
      emergencyContactPhone: student.emergencyContactPhone || '',
      previousSchoolName: student.previousSchoolName || '',
      previousBoard: student.previousBoard || ''
    });

    this.onStreamCheckChanged();

    if (student.isHostelStudent) {
      const bindHostelAndBeds = () => {
        let targetHostelId = student.hostelId;
        if (!targetHostelId && student.hostelName && this.hostelsList.length > 0) {
          const matched = this.hostelsList.find(h => h.name?.toLowerCase().trim() === student.hostelName?.toLowerCase().trim());
          if (matched) targetHostelId = matched.id;
        }
        if (!targetHostelId && this.hostelsList.length > 0) {
          targetHostelId = this.hostelsList[0].id;
        }

        this.studentForm.patchValue({
          hostelId: targetHostelId || '',
          hostelBedId: student.hostelBedId || ''
        });

        if (targetHostelId) {
          this.hostelService.getAvailableBeds(targetHostelId, student.hostelBedId).subscribe(beds => {
            this.availableBedsList = beds || [];
            if (student.hostelBedId && !this.availableBedsList.some(b => b.id === student.hostelBedId)) {
              this.availableBedsList.unshift({
                id: student.hostelBedId,
                roomId: '',
                roomNumber: student.roomNumber || '',
                hostelId: targetHostelId,
                hostelName: student.hostelName || '',
                bedCode: student.bedCode || '',
                status: 'Occupied',
                monthlyRent: 0
              } as any);
            }
            this.studentForm.patchValue({
              hostelId: targetHostelId,
              hostelBedId: student.hostelBedId || ''
            });
            const currentBed = this.availableBedsList.find(b => b.id === student.hostelBedId);
            this.selectedBedRent = currentBed ? currentBed.monthlyRent : null;
          });
        }
      };

      if (this.hostelsList.length === 0) {
        this.hostelService.getHostels().subscribe(h => {
          this.hostelsList = h || [];
          bindHostelAndBeds();
        });
      } else {
        bindHostelAndBeds();
      }
    } else {
      this.studentForm.patchValue({ hostelId: '', hostelBedId: '' });
      this.availableBedsList = [];
      this.selectedBedRent = null;
    }
  }

  isDuplicateRoll(schoolRoll?: string | null, admNo?: string | null): boolean {
    if (!schoolRoll) return true;
    const cleanRoll = String(schoolRoll).replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();
    if (!cleanRoll) return true;
    if (cleanRoll.startsWith('adm')) return true;
    if (!admNo) return false;
    const cleanAdm = String(admNo).replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();
    return cleanRoll === cleanAdm || cleanRoll.includes(cleanAdm) || cleanAdm.includes(cleanRoll);
  }

  private formatDateForInput(dateVal: any): string {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  }

  formatDisplayPhone(phone: string | null | undefined): string {
    if (!phone) return '-';
    const clean = phone.replace(/\s+/g, '');
    const digits = clean.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+91\u00A0${digits.substring(0, 5)}\u00A0${digits.substring(5)}`;
    } else if (digits.length === 12 && digits.startsWith('91')) {
      const main = digits.substring(2);
      return `+91\u00A0${main.substring(0, 5)}\u00A0${main.substring(5)}`;
    }
    return phone.startsWith('+') ? phone : '+91\u00A0' + phone;
  }

  getCalculatedAge(): { years: number; months: number; displayText: string } | null {
    const dobVal = this.studentForm.get('dateOfBirth')?.value;
    if (!dobVal) return null;
    const birthDate = new Date(dobVal);
    if (isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    if (today.getDate() < birthDate.getDate()) {
      months--;
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    if (years < 0) return null;

    let displayText = '';
    if (years === 0) {
      displayText = `${months} Month${months !== 1 ? 's' : ''}`;
    } else if (months === 0) {
      displayText = `${years} Yr${years !== 1 ? 's' : ''}`;
    } else {
      displayText = `${years} Yrs ${months} Mos`;
    }

    return { years, months, displayText };
  }

  getNepAgeAdvisory(): { type: 'success' | 'warning' | 'info'; message: string; badge: string } | null {
    const age = this.getCalculatedAge();
    if (!age) return null;

    const classId = this.studentForm.get('classId')?.value;
    const isSchool = this.studentForm.get('isSchoolStudent')?.value;
    if (!isSchool || !classId) {
      return {
        type: 'info',
        badge: `Age: ${age.displayText}`,
        message: `Calculated age: ${age.displayText}`
      };
    }

    const selectedClass = this.schoolClasses.find(c => c.id === classId);
    if (!selectedClass) {
      return {
        type: 'info',
        badge: `Age: ${age.displayText}`,
        message: `Calculated age: ${age.displayText}`
      };
    }

    const name = (selectedClass.name || '').toLowerCase();
    let minAge = 0;
    let maxTypicalAge = 0;

    if (name.includes('nursery') || name.includes('pre-kg') || name.includes('play')) {
      minAge = 3; maxTypicalAge = 4;
    } else if (name.includes('lkg') || name.includes('kg-1') || name.includes('kg 1') || name.includes('lower kg')) {
      minAge = 4; maxTypicalAge = 5;
    } else if (name.includes('ukg') || name.includes('kg-2') || name.includes('kg 2') || name.includes('upper kg') || name.includes('prep')) {
      minAge = 5; maxTypicalAge = 6;
    } else if (name.includes('10') || (name.includes('x') && !name.includes('xi') && !name.includes('xii'))) {
      minAge = 15; maxTypicalAge = 16;
    } else if (name.includes('11') || name.includes('xi')) {
      minAge = 16; maxTypicalAge = 17;
    } else if (name.includes('12') || name.includes('xii')) {
      minAge = 17; maxTypicalAge = 18;
    } else {
      const match = name.match(/\b([1-9])\b/);
      if (match) {
        const gradeNum = parseInt(match[1], 10);
        minAge = 5 + gradeNum;
        maxTypicalAge = minAge + 1;
      }
    }

    if (minAge > 0) {
      if (age.years < minAge) {
        return {
          type: 'warning',
          badge: `Age: ${age.displayText} • NEP Advisory ⚠️`,
          message: `NEP 2020 guideline recommends min ${minAge} yrs for ${selectedClass.name} (Student is ${age.displayText}). Non-blocking: Allowed with school discretion.`
        };
      } else if (age.years > maxTypicalAge + 1) {
        return {
          type: 'info',
          badge: `Age: ${age.displayText} • Verified ✓`,
          message: `Student age is ${age.displayText} (Typical age for ${selectedClass.name} is ${minAge}-${maxTypicalAge} yrs).`
        };
      } else {
        return {
          type: 'success',
          badge: `Age: ${age.displayText} • NEP Compliant ✓`,
          message: `Compliant with NEP 2020 age criteria for ${selectedClass.name} (Min ${minAge} yrs).`
        };
      }
    }

    return {
      type: 'info',
      badge: `Age: ${age.displayText}`,
      message: `Calculated age: ${age.displayText}`
    };
  }

  getFormValidationErrorsList(): string[] {
    const errors: string[] = [];
    const f = this.studentForm;
    if (!f) return errors;

    if (f.hasError('dojBeforeDob') || f.get('joiningDate')?.hasError('dojBeforeDob') || f.get('dateOfBirth')?.hasError('dojBeforeDob')) {
      const doj = f.get('joiningDate')?.value || '';
      const dob = f.get('dateOfBirth')?.value || '';
      errors.push(`Date Range Conflict: Admission Date (${doj}) must be strictly after Date of Birth (${dob}).`);
    }

    const doj = f.get('joiningDate');
    if (doj?.hasError('required')) errors.push('Admission / Joining Date is required.');
    if (doj?.hasError('futureDate')) errors.push(`Admission Date cannot be more than 1 year in advance (Max: ${this.maxDoj}).`);
    if (doj?.hasError('invalidRange')) errors.push(`Admission Date must be on or after 01/01/2010 (up to ${this.maxDoj}).`);

    const dob = f.get('dateOfBirth');
    if (dob?.hasError('futureDate')) errors.push('Date of Birth cannot be in the future (Max: Today).');
    if (dob?.hasError('tooOld')) errors.push('Date of Birth must be on or after 01/01/1950.');

    if (f.get('studentName')?.hasError('required')) errors.push('Student Full Name is required.');
    if (f.value.isSchoolStudent && f.get('classId')?.hasError('required')) errors.push('School Class selection is required.');
    if (f.value.isCoachingStudent && f.get('batchId')?.hasError('required')) errors.push('Coaching Batch selection is required.');
    if (f.get('parentName')?.hasError('required')) errors.push('Father / Guardian Name is required.');

    if (!f.value.isSchoolStudent && !f.value.isCoachingStudent) {
      errors.push('Please select at least one stream (School or Coaching).');
    }

    if (this.phoneDuplicateError) {
      errors.push(this.phoneDuplicateError);
    }

    return errors;
  }

  highlightInvalidFields(): void {
    if (typeof document === 'undefined') return;
    setTimeout(() => {
      const firstInvalid = document.querySelector('.mat-form-field.mat-form-field-invalid, .mat-form-field.ng-invalid, input.ng-invalid');
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = firstInvalid.querySelector('input, select, mat-select') as HTMLElement;
        input?.focus();
      }
    }, 100);
  }

  onSubmitStudent(): void {
    if (this.studentForm.hasError('dojBeforeDob') || this.studentForm.get('joiningDate')?.hasError('dojBeforeDob') || this.studentForm.get('dateOfBirth')?.hasError('dojBeforeDob')) {
      const doj = this.studentForm.get('joiningDate')?.value;
      const dob = this.studentForm.get('dateOfBirth')?.value;
      this.confirmDialog.alert(
        'Date Range Conflict',
        `<div><strong>Admission / Joining Date (${doj || 'not set'}) must be strictly after Date of Birth (${dob || 'not set'}).</strong></div><ul><li>Please adjust the Date of Birth to be before the Admission Date.</li></ul>`,
        'warning'
      );
      this.highlightInvalidFields();
      return;
    }

    if (this.studentForm.invalid) {
      this.studentForm.markAllAsTouched();
      const errorList = this.getFormValidationErrorsList();
      const bulletListHtml = errorList.map(err => `<li>${err}</li>`).join('');
      const message = errorList.length > 0
        ? `<div><strong>Please resolve the following required fields / validation errors:</strong></div><ul>${bulletListHtml}</ul>`
        : 'Please check the highlighted fields and date validations.';
      this.confirmDialog.alert('Form Validation Required', message, 'warning');
      this.highlightInvalidFields();
      return;
    }
    const formVal = this.studentForm.value;

    if (!formVal.isSchoolStudent && !formVal.isCoachingStudent) {
      this.confirmDialog.alert('Stream Required', 'Please select at least one enrollment stream (School or Coaching).', 'warning');
      return;
    }

    if (formVal.isIssueAdmissionKit) {
      // Auto-add selected item if user selected one from dropdown but didn't click '+ Add to Kit'
      if (this.selectedKitItemId && this.admissionKitRows.length === 0) {
        this.addSelectedKitItem();
      }
      if (this.admissionKitRows.length === 0) {
        this.confirmDialog.alert(
          'Admission Kit Required',
          'You selected Admission Kit Issuance, but no items have been added to the kit.\n\nPlease select an item from inventory and click "+ Add to Kit", or uncheck Admission Kit Issuance.',
          'warning'
        );
        return;
      }
    }

    this.saving = true;
    let cleanPhone = formVal.parentWhatsAppPhone ? formVal.parentWhatsAppPhone.replace(/\s+/g, '') : '';
    if (cleanPhone) {
      const rawDigits = cleanPhone.replace(/\D/g, '');
      if (rawDigits.length === 10) {
        cleanPhone = '+91' + rawDigits;
      } else if (rawDigits.length === 12 && rawDigits.startsWith('91')) {
        cleanPhone = '+' + rawDigits;
      }
    }
    const payload = {
      ...formVal,
      isSchoolStudent: !!formVal.isSchoolStudent,
      isCoachingStudent: !!formVal.isCoachingStudent,
      branchId: (this.isEditMode && this.selectedStudent?.branchId) ? this.selectedStudent.branchId : (this.authService.selectedBranchId() || null),
      isHostelStudent: !!formVal.isHostelStudent,
      hostelBedId: formVal.isHostelStudent && formVal.hostelBedId ? formVal.hostelBedId : null,
      isLibraryMember: !!formVal.isLibraryMember,
      libraryCardNumber: formVal.isLibraryMember ? (formVal.libraryCardNumber || null) : null,
      libraryMembershipType: formVal.isLibraryMember ? (formVal.libraryMembershipType || 'Standard Book Lending') : null,
      maxLibraryBooks: formVal.isLibraryMember ? (formVal.maxLibraryBooks || 2) : 2,
      monthlyLibraryFee: formVal.isLibraryMember ? (formVal.monthlyLibraryFee || 0) : 0,
      isIssueAdmissionKit: !!formVal.isIssueAdmissionKit,
      kitPaymentStatus: formVal.isIssueAdmissionKit ? formVal.kitPaymentStatus : null,
      kitPaymentMode: formVal.isIssueAdmissionKit ? formVal.kitPaymentMode : null,
      admissionKitItems: (formVal.isIssueAdmissionKit && this.admissionKitRows.some(r => !r.isExistingIssue))
        ? this.admissionKitRows.filter(r => !r.isExistingIssue).map(r => ({
            itemId: r.itemId,
            quantity: r.quantity,
            unitPrice: r.unitPrice
          }))
        : null,
      batchId: formVal.isCoachingStudent && formVal.batchId ? formVal.batchId : null,
      rollNumber: formVal.isCoachingStudent ? formVal.rollNumber : (formVal.schoolRollNumber || formVal.admissionNumber || 'SCH'),
      schoolRollNumber: formVal.schoolRollNumber ? formVal.schoolRollNumber.trim() : null,
      coachingRollNumber: formVal.coachingRollNumber ? formVal.coachingRollNumber.trim() : null,
      admissionNumber: formVal.admissionNumber ? formVal.admissionNumber.trim() : null,
      classId: formVal.isSchoolStudent && formVal.classId ? formVal.classId : null,
      sectionId: formVal.isSchoolStudent && formVal.sectionId ? formVal.sectionId : null,
      dateOfBirth: formVal.dateOfBirth && typeof formVal.dateOfBirth === 'string' && formVal.dateOfBirth.trim() ? new Date(formVal.dateOfBirth).toISOString() : null,
      motherName: formVal.motherName ? formVal.motherName.trim() : null,
      bloodGroup: formVal.bloodGroup ? formVal.bloodGroup.trim() : null,
      address: formVal.address ? formVal.address.trim() : null,
      joiningDate: formVal.joiningDate ? new Date(formVal.joiningDate).toISOString() : new Date().toISOString(),
      parentWhatsAppPhone: cleanPhone,
      aadhaarNumber: formVal.aadhaarNumber ? formVal.aadhaarNumber.trim() : null,
      penNumber: formVal.penNumber ? formVal.penNumber.trim() : null,
      apaarId: formVal.apaarId ? formVal.apaarId.trim() : null,
      category: formVal.category || 'General',
      religion: formVal.religion || null,
      emergencyContactName: formVal.emergencyContactName ? formVal.emergencyContactName.trim() : null,
      emergencyContactPhone: formVal.emergencyContactPhone ? formVal.emergencyContactPhone.trim() : null,
      previousSchoolName: formVal.previousSchoolName ? formVal.previousSchoolName.trim() : null,
      previousBoard: formVal.previousBoard || null,
      profilePhoto: this.selectedPhotoData
        ?? (this.isEditMode && this.selectedStudent?.profilePhoto ? this.selectedStudent.profilePhoto : null)
    };

    const parseErrorMsg = (err: any, fallback: string): string => {
      if (err?.error?.message) return err.error.message;
      if (err?.error?.errors && typeof err.error.errors === 'object') {
        const msgs: string[] = [];
        for (const key of Object.keys(err.error.errors)) {
          const val = err.error.errors[key];
          if (Array.isArray(val)) msgs.push(...val);
          else if (typeof val === 'string') msgs.push(val);
        }
        if (msgs.length > 0) return msgs.join('\n');
      }
      if (err?.error?.title) return err.error.title;
      if (err?.message) return err.message;
      return fallback;
    };

    if (this.isEditMode && this.selectedStudent) {
      this.coachingService.updateStudent(this.selectedStudent.id, payload).subscribe({
        next: () => {
          this.saving = false;
          this.showForm = false;
          this.isEditMode = false;
          this.selectedStudent = null;
          this.photoPreview = null;
          this.selectedPhotoData = null;
          this.studentForm.reset();
          this.loadStudents();
          this.confirmDialog.alert('Student Updated', 'Student record updated successfully!', 'success');
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert('Update Failed', parseErrorMsg(err, 'Failed to update student.'), 'danger');
        }
      });
    } else {
      this.coachingService.createStudent(payload).subscribe({
        next: () => {
          this.saving = false;
          this.showForm = false;
          this.photoPreview = null;
          this.selectedPhotoData = null;
          this.studentForm.reset();
          this.loadStudents();
          this.confirmDialog.alert('Admission Confirmed', 'New student registered and enrolled successfully!', 'success');
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert('Admission Failed', parseErrorMsg(err, 'Failed to enroll student.'), 'danger');
        }
      });
    }
  }

  deleteStudent(student: any): void {
    this.confirmDialog.danger(
      'Delete / Revoke Student Admission',
      `Are you sure you want to delete / archive student "${student.studentName}"?\n\n• Hostel beds and transport bus seats will be immediately freed up for other students.\n• Historical fee receipts, vouchers, and audit trails will remain safely preserved for financial compliance.`,
      'Delete & Revoke Admission'
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.loading = true;
        this.coachingService.deleteStudent(student.id).subscribe({
          next: () => {
            this.loadStudents();
            this.confirmDialog.alert('Admission Revoked', `Student "${student.studentName}" has been removed from active roster. Allocated hostel beds and transport seats have been released.`, 'success');
          },
          error: (err) => {
            this.loading = false;
            this.confirmDialog.alert('Delete Failed', err?.error?.message || 'Failed to delete student.', 'danger');
          }
        });
      }
    });
  }

  // ── 1-Click Coaching Enrollment for School Students ──────

  openEnrollCoachingModal(student: any): void {
    this.enrollingStudent = student;
    this.enrollingBatchId = this.batches.length > 0 ? this.batches[0].id : '';
    this.enrollingCustomFee = null;
    this.enrollingCoachingRollNumber = '';
    this.enrollCoachingModalOpen = true;
    if (this.enrollingBatchId) {
      this.fetchEnrollingCoachingRoll(this.enrollingBatchId);
    }
  }

  onEnrollingBatchChange(batchId: string): void {
    this.enrollingBatchId = batchId;
    if (batchId) {
      this.fetchEnrollingCoachingRoll(batchId);
    } else {
      this.enrollingCoachingRollNumber = '';
    }
  }

  fetchEnrollingCoachingRoll(batchId: string): void {
    this.enrollingRollNumberLoading = true;
    this.coachingService.getNextRollNumber(batchId).subscribe({
      next: (res) => {
        this.enrollingRollNumberLoading = false;
        this.enrollingCoachingRollNumber = res.rollNumber;
      },
      error: () => {
        this.enrollingRollNumberLoading = false;
      }
    });
  }

  closeEnrollCoachingModal(): void {
    this.enrollCoachingModalOpen = false;
    this.enrollingStudent = null;
    this.enrollingBatchId = '';
    this.enrollingCoachingRollNumber = '';
    this.enrollingCustomFee = null;
  }

  confirmEnrollCoaching(): void {
    if (!this.enrollingStudent || !this.enrollingBatchId) return;

    const studentName = this.enrollingStudent.studentName;
    const batch = this.batches.find(b => b.id === this.enrollingBatchId);
    const batchName = batch ? batch.name : 'Selected Batch';
    const rollText = this.enrollingCoachingRollNumber
      ? `Coaching Roll: ${this.enrollingCoachingRollNumber}`
      : 'Auto-generated Batch Roll';
    const feeText = (this.enrollingCustomFee != null && this.enrollingCustomFee > 0)
      ? `Custom Fee: ₹${this.enrollingCustomFee}/month`
      : `Standard Fee: ₹${batch?.standardMonthlyFee || 0}/month`;

    this.confirmDialog.confirm(
      'Confirm Coaching Enrollment',
      `Are you sure you want to enroll student "${studentName}" into coaching batch "${batchName}"?\n• ${rollText}\n• ${feeText}`,
      'Confirm & Enroll',
      'Cancel',
      'info'
    ).subscribe((confirmed) => {
      if (!confirmed) return;

      this.enrollingLoading = true;
      this.schoolService.enrollSchoolStudentInCoaching({
        studentId: this.enrollingStudent.id,
        batchId: this.enrollingBatchId,
        coachingRollNumber: this.enrollingCoachingRollNumber || undefined,
        customMonthlyFee: this.enrollingCustomFee || undefined
      }).subscribe({
        next: (res: any) => {
          this.enrollingLoading = false;
          this.closeEnrollCoachingModal();
          this.confirmDialog.alert(
            'Enrolled into Coaching!',
            `Student "${studentName}" has been successfully enrolled into ${res.batchName} with Coaching Roll Number: ${res.coachingRollNumber}. Initial monthly fee invoice created.`,
            'success'
          );
          this.loadStudents();
        },
        error: (err: any) => {
          this.enrollingLoading = false;
          this.confirmDialog.alert('Enrollment Failed', err?.error?.message || 'Failed to enroll student into coaching batch.', 'danger');
        }
      });
    });
  }
}
