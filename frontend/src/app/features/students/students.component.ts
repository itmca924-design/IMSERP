import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
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
import { CoachingService } from '../../core/services/coaching.service';
import { SchoolService, SchoolClassDto, SchoolSectionDto } from '../../core/services/school.service';
import { HostelService, HostelDto, HostelBedDto } from '../../core/services/hostel.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { LibraryService, LibraryMembershipPlanDto } from '../../core/services/library.service';
import { StudentLeavingDialogComponent } from './student-leaving-dialog.component';
import { StudentReadmissionDialogComponent } from './student-readmission-dialog.component';
import { ManageLibraryPlansDialogComponent } from '../library/manage-library-plans-dialog.component';

const API_BASE = 'http://localhost:5000';

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
    MatDialogModule
  ],
  template: `
    <div class="students-wrapper">
      <div class="header-actions">
        <div>
          <h2>Student Directory &amp; Admissions</h2>
          <p>Unified admissions for School &amp; Coaching. School students can seamlessly enroll into evening coaching batches.</p>
        </div>
        <div class="header-btns">
          <a mat-stroked-button routerLink="/school/classes" class="classes-link-btn">
            <mat-icon>domain</mat-icon> Classes &amp; Sections
          </a>
          <button mat-raised-button color="primary" class="add-btn" (click)="toggleForm()">
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
                <mat-checkbox formControlName="isSchoolStudent" (change)="onStreamCheckChanged()" color="primary">
                  <span class="chk-label">🏫 <strong>School Enrollment</strong> (Class, Section, Admission No)</span>
                </mat-checkbox>
                <mat-checkbox formControlName="isCoachingStudent" (change)="onStreamCheckChanged()" color="primary">
                  <span class="chk-label">🎯 <strong>Coaching Enrollment</strong> (Batch, Monthly Tuition Fee)</span>
                </mat-checkbox>
                <mat-checkbox formControlName="isHostelStudent" (change)="onHostelCheckChanged()" color="accent">
                  <span class="chk-label">🏨 <strong>Hostel Resident (Optional)</strong> (Room &amp; Bed Allotment)</span>
                </mat-checkbox>
                <mat-checkbox formControlName="isLibraryMember" (change)="onLibraryCheckChanged()" color="primary">
                  <span class="chk-label">📚 <strong>Library Membership (Optional)</strong> (Books &amp; Reading Shifts)</span>
                </mat-checkbox>
              </div>
              <div class="stream-hint-warn" *ngIf="!studentForm.value.isSchoolStudent && !studentForm.value.isCoachingStudent">
                <mat-icon>warning_amber</mat-icon>
                <span>Please select at least one stream (School, Coaching, or both).</span>
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
                min="1900-01-01"
                max="2099-12-31" />
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

                      <div class="sibling-tags">
                        <span class="sibling-tag branch" *ngIf="siblingInfo.branchName">
                          <mat-icon>domain</mat-icon>
                          <span>Branch: {{ siblingInfo.branchName }}</span>
                        </span>
                        <span class="sibling-tag batch" *ngIf="siblingInfo.batchName">
                          <mat-icon>school</mat-icon>
                          <span>Batch: {{ siblingInfo.batchName }}</span>
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

            <div class="form-actions full-span">
              <button mat-button type="button" (click)="toggleForm()" [disabled]="saving">Cancel</button>
              <button mat-raised-button color="primary" type="submit" [disabled]="studentForm.invalid || saving || (!studentForm.value.isSchoolStudent && !studentForm.value.isCoachingStudent) || !!phoneDuplicateError || phoneCheckLoading">
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
          <button type="button" class="stream-tab school-tab" [class.active]="selectedStreamFilter === 'school'" (click)="setStreamFilter('school')">
            <mat-icon>domain</mat-icon>
            <span>School Students</span>
          </button>
          <button type="button" class="stream-tab coaching-tab" [class.active]="selectedStreamFilter === 'coaching'" (click)="setStreamFilter('coaching')">
            <mat-icon>school</mat-icon>
            <span>Coaching Batches</span>
          </button>
          <button type="button" class="stream-tab hostel-tab" [class.active]="selectedStreamFilter === 'hostel'" (click)="setStreamFilter('hostel')">
            <mat-icon>apartment</mat-icon>
            <span>Hostel Residents</span>
          </button>
          <button type="button" class="stream-tab library-tab" [class.active]="selectedStreamFilter === 'library'" (click)="setStreamFilter('library')">
            <mat-icon>local_library</mat-icon>
            <span>Library Members</span>
          </button>
          <button type="button" class="stream-tab dayscholar-tab" [class.active]="selectedStreamFilter === 'dayscholar'" (click)="setStreamFilter('dayscholar')">
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
            <mat-form-field appearance="outline" class="filter-select" *ngIf="selectedStreamFilter !== 'coaching'">
              <mat-label>Filter by School Class</mat-label>
              <mat-select [(ngModel)]="selectedClassFilter" (selectionChange)="onClassFilterChange()" panelClass="batch-filter-panel">
                <mat-option value="">All School Classes</mat-option>
                <mat-option *ngFor="let c of schoolClasses" [value]="c.id">
                  {{ c.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Coaching Batch Filter -->
            <mat-form-field appearance="outline" class="filter-select" *ngIf="selectedStreamFilter !== 'school'">
              <mat-label>Filter by Coaching Batch</mat-label>
              <mat-select [(ngModel)]="selectedBatchFilter" (selectionChange)="onFilterChange()" panelClass="batch-filter-panel">
                <mat-option value="">All Academic Batches</mat-option>
                <mat-option *ngFor="let b of batches" [value]="b.id">
                  {{ b.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Section Filter -->
            <mat-form-field appearance="outline" class="filter-select section-select" *ngIf="selectedClassFilter && selectedStreamFilter !== 'coaching'">
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
                    <div class="coaching-roll-pill" *ngIf="s.isCoachingStudent && (s.coachingRollNumber || s.rollNumber)">
                      <span class="lbl">Roll:</span> <strong>{{ s.coachingRollNumber || s.rollNumber }}</strong>
                    </div>
                    <div class="school-adm-pill" *ngIf="s.isSchoolStudent && s.admissionNumber">
                      <span class="lbl">Adm:</span> <strong>{{ s.admissionNumber }}</strong>
                    </div>
                    <div class="school-roll-pill" *ngIf="s.isSchoolStudent && s.schoolRollNumber">
                      <span class="lbl">Sec Roll:</span> {{ s.schoolRollNumber }}
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
                      <span class="student-name-text">{{ s.studentName }}</span>
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
                <th mat-header-cell *matHeaderCellDef>Academic &amp; Facilities</th>
                <td mat-cell *matCellDef="let s">
                  <div class="academic-stack">
                    <div class="school-alloc" *ngIf="s.isSchoolStudent">
                      <mat-icon class="icon-school">domain</mat-icon>
                      <span><strong>{{ s.className || 'Class' }}</strong> - Sec {{ s.sectionName || 'A' }}</span>
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
                  </div>
                </td>
              </ng-container>

              <!-- Parent Info -->
              <ng-container matColumnDef="parentName">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="parentName">Parent / Guardian</th>
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
                    {{ s.parentWhatsAppPhone }}
                  </span>
                  <span *ngIf="!s.parentWhatsAppPhone" class="text-muted">-</span>
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="text-right">Actions</th>
                <td mat-cell *matCellDef="let s" class="text-right">
                  <div class="action-buttons">
                    <!-- 1-Click Coaching Enrollment Button for School Students -->
                    <button
                      mat-stroked-button
                      color="primary"
                      class="btn-quick-coaching"
                      *ngIf="s.isSchoolStudent && !s.isCoachingStudent && s.isActive !== false"
                      (click)="openEnrollCoachingModal(s)"
                      matTooltip="Enroll this school student into Coaching batch">
                      <mat-icon>add_task</mat-icon>
                      <span>+ Coaching</span>
                    </button>

                    <!-- Active Student: Mark Left / Issue TC Button -->
                    <button
                      mat-icon-button
                      class="btn-tc-action"
                      *ngIf="s.isActive !== false"
                      (click)="openStudentLeavingModal(s)"
                      matTooltip="Student Leaving / Issue Transfer Certificate (TC)">
                      <mat-icon>exit_to_app</mat-icon>
                    </button>

                    <!-- Left Student: View/Print Certificate (SLC / TC) -->
                    <button
                      mat-icon-button
                      class="btn-tc-print"
                      *ngIf="s.isActive === false"
                      (click)="openStudentLeavingModal(s, true)"
                      [matTooltip]="isStudentPassedOut(s) ? 'View & Print School Leaving Certificate (SLC)' : 'View & Print Transfer Certificate (TC)'">
                      <mat-icon>{{ isStudentPassedOut(s) ? 'workspace_premium' : 'description' }}</mat-icon>
                    </button>
                    <!-- Re-Admit Button: ONLY for mid-session left students -->
                    <button
                      mat-icon-button
                      class="btn-tc-readmit"
                      *ngIf="s.isActive === false && !isStudentPassedOut(s)"
                      (click)="openReAdmitModal(s)"
                      matTooltip="Re-Admit Student (Structured Workflow)">
                      <mat-icon>replay</mat-icon>
                    </button>
                    <!-- Disabled icon button for passed-out alumni wrapped in span for hover tooltip -->
                    <span
                      *ngIf="s.isActive === false && isStudentPassedOut(s)"
                      matTooltip="Passed-Out Alumnus: Re-admission not permitted (Register fresh admission for higher class)"
                      style="display: inline-block;">
                      <button
                        mat-icon-button
                        disabled
                        style="pointer-events: none;">
                        <mat-icon style="color: #cbd5e1;">block</mat-icon>
                      </button>
                    </span>

                    <!-- Active Student: Mark Attendance (Hidden for Left / TC students) -->
                    <a mat-icon-button color="primary" [routerLink]="['/students/attendance']" [queryParams]="{studentId: s.id}" matTooltip="Student Attendance" *ngIf="s.isActive !== false">
                      <mat-icon>event_available</mat-icon>
                    </a>
                    <button mat-icon-button color="primary" (click)="editStudent(s)" matTooltip="Edit Student">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button color="warn" (click)="deleteStudent(s)" matTooltip="Delete Student">
                      <mat-icon>delete</mat-icon>
                    </button>
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
            <div class="ecc-title">
              <mat-icon color="primary">school</mat-icon>
              <div>
                <h3>Enroll School Student into Coaching</h3>
                <p>Instantly enroll {{ enrollingStudent?.studentName }} into an evening coaching batch.</p>
              </div>
            </div>
            <button mat-icon-button (click)="closeEnrollCoachingModal()"><mat-icon>close</mat-icon></button>
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
                <mat-select [(ngModel)]="enrollingBatchId">
                  <mat-option *ngFor="let b of batches" [value]="b.id">
                    {{ b.name }} (Standard Fee: ₹{{ b.standardMonthlyFee }}/mo)
                  </mat-option>
                </mat-select>
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
      flex-wrap: wrap;
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
    .directory-container { display: flex; flex-direction: column; gap: 10px; }
    .table-card { border-radius: 10px; overflow: hidden; }
    .filter-toolbar {
      padding: 16px 20px 4px 20px;
      display: flex;
      gap: 14px;
      align-items: center;
      flex-wrap: wrap;

      .search-field { width: 280px; }
      .filter-select { width: 240px; }
      .section-select { width: 180px; }
    }
    .table-container { padding: 0; }
    .full-width { width: 100%; }
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
    }

    /* Parent Info */
    .parent-cell-wrap {
      display: flex;
      flex-direction: column;
      font-size: 0.85rem;
      color: #1e293b;
      .mother-name { font-size: 0.72rem; color: #64748b; }
    }

    .wa-phone {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: #16a34a;
      font-weight: 600;
      font-size: 0.85rem;
      .wa-icon { font-size: 16px; width: 16px; height: 16px; color: #16a34a; }
    }

    .action-buttons {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
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
      max-width: 520px;
      overflow: hidden;
      animation: modalPop 0.2s ease-out;

      .ecc-header {
        background: #f8fafc;
        padding: 16px 20px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;

        .ecc-title {
          display: flex;
          align-items: center;
          gap: 12px;
          mat-icon { font-size: 28px; width: 28px; height: 28px; }
          h3 { margin: 0; font-size: 1.1rem; color: #1e293b; font-weight: 700; }
          p { margin: 2px 0 0 0; color: #64748b; font-size: 0.82rem; }
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

  /** 1-Click Coaching Enrollment Dialog */
  enrollCoachingModalOpen = false;
  enrollingStudent: any = null;
  enrollingBatchId = '';
  enrollingCustomFee: number | null = null;
  enrollingLoading = false;

  /** Photo handling */
  photoPreview: string | null = null;
  private selectedPhotoData: string | null = null;

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
    private fb: FormBuilder
  ) {
    this.studentForm = this.fb.group({
      isSchoolStudent: [false],
      isCoachingStudent: [true],
      isHostelStudent: [false],
      hostelId: [''],
      hostelBedId: [''],
      isLibraryMember: [false],
      libraryCardNumber: [''],
      libraryMembershipType: ['Standard Book Lending'],
      maxLibraryBooks: [2],
      monthlyLibraryFee: [0],
      classId: [''],
      sectionId: [''],
      admissionNumber: [''],
      schoolRollNumber: [''],
      batchId: ['', Validators.required],
      rollNumber: ['', Validators.required],
      studentName: ['', Validators.required],
      gender: ['Male'],
      dateOfBirth: [''],
      motherName: [''],
      bloodGroup: [''],
      parentName: ['', Validators.required],
      parentWhatsAppPhone: [''],
      address: ['']
    });
  }

  ngOnInit(): void {
    this.coachingService.getBatches().subscribe(b => this.batches = b || []);
    this.schoolService.getClasses(false).subscribe(c => this.schoolClasses = c || []);
    this.hostelService.getHostels().subscribe(h => this.hostelsList = h || []);
    this.loadLibraryPlans();
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
                  batchName: res.batchName,
                  branchName: res.branchName
                };
                const parentCtrl = this.studentForm.get('parentName');
                if (parentCtrl && !parentCtrl.value && res.parentName) {
                  parentCtrl.setValue(res.parentName);
                  parentCtrl.markAsDirty();
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

  // ── Add / Edit Form Actions ──────────────────────────────

  toggleForm(): void {
    this.showForm = !this.showForm;
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
      this.studentForm.reset({
        isSchoolStudent: false,
        isCoachingStudent: true,
        isHostelStudent: false,
        isLibraryMember: false,
        libraryCardNumber: '',
        libraryMembershipType: 'Standard Book Lending',
        maxLibraryBooks: 2,
        monthlyLibraryFee: 0,
        gender: 'Male'
      });
      this.loadStudents();
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
      address: student.address || ''
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

  onSubmitStudent(): void {
    if (this.studentForm.invalid) return;
    const formVal = this.studentForm.value;

    if (!formVal.isSchoolStudent && !formVal.isCoachingStudent) {
      this.confirmDialog.alert('Stream Required', 'Please select at least one enrollment stream (School or Coaching).', 'warning');
      return;
    }

    this.saving = true;
    const cleanPhone = formVal.parentWhatsAppPhone ? formVal.parentWhatsAppPhone.replace(/\s+/g, '') : '';
    const payload = {
      ...formVal,
      isHostelStudent: !!formVal.isHostelStudent,
      hostelBedId: formVal.isHostelStudent && formVal.hostelBedId ? formVal.hostelBedId : null,
      isLibraryMember: !!formVal.isLibraryMember,
      libraryCardNumber: formVal.isLibraryMember ? (formVal.libraryCardNumber || null) : null,
      libraryMembershipType: formVal.isLibraryMember ? (formVal.libraryMembershipType || 'Standard Book Lending') : null,
      maxLibraryBooks: formVal.isLibraryMember ? (formVal.maxLibraryBooks || 2) : 2,
      monthlyLibraryFee: formVal.isLibraryMember ? (formVal.monthlyLibraryFee || 0) : 0,
      batchId: formVal.isCoachingStudent && formVal.batchId ? formVal.batchId : null,
      rollNumber: formVal.isCoachingStudent ? formVal.rollNumber : (formVal.schoolRollNumber || formVal.admissionNumber || 'SCH'),
      classId: formVal.isSchoolStudent && formVal.classId ? formVal.classId : null,
      sectionId: formVal.isSchoolStudent && formVal.sectionId ? formVal.sectionId : null,
      parentWhatsAppPhone: cleanPhone,
      profilePhoto: this.selectedPhotoData
        ?? (this.isEditMode && this.selectedStudent?.profilePhoto ? this.selectedStudent.profilePhoto : null)
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
          this.confirmDialog.alert('Update Failed', err?.error?.message || 'Failed to update student.', 'danger');
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
          this.confirmDialog.alert('Admission Failed', err?.error?.message || 'Failed to enroll student.', 'danger');
        }
      });
    }
  }

  deleteStudent(student: any): void {
    this.confirmDialog.danger(
      'Delete Student Record',
      `Are you sure you want to delete student "${student.studentName}"? This action cannot be undone.`,
      'Delete Record'
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.loading = true;
        this.coachingService.deleteStudent(student.id).subscribe({
          next: () => {
            this.loadStudents();
            this.confirmDialog.alert('Deleted', `Student "${student.studentName}" has been deleted.`, 'success');
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
    this.enrollCoachingModalOpen = true;
  }

  closeEnrollCoachingModal(): void {
    this.enrollCoachingModalOpen = false;
    this.enrollingStudent = null;
    this.enrollingBatchId = '';
    this.enrollingCustomFee = null;
  }

  confirmEnrollCoaching(): void {
    if (!this.enrollingStudent || !this.enrollingBatchId) return;

    this.enrollingLoading = true;
    this.schoolService.enrollSchoolStudentInCoaching({
      studentId: this.enrollingStudent.id,
      batchId: this.enrollingBatchId,
      customMonthlyFee: this.enrollingCustomFee || undefined
    }).subscribe({
      next: (res: any) => {
        this.enrollingLoading = false;
        const studentName = this.enrollingStudent.studentName;
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
  }
}
