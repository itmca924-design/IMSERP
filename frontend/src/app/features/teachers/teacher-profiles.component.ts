import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { API_BASE, TeacherDto } from './teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { TeacherIdCardDialogComponent } from './teacher-id-card-dialog.component';
import { TeacherDocumentsDialogComponent } from './teacher-documents-dialog.component';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-teacher-profiles',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatSelectModule, MatAutocompleteModule, MatProgressBarModule,
    MatProgressSpinnerModule, MatTooltipModule, MatDividerModule, MatDialogModule
  ],
  template: `
<div class="page-container">
  <div class="page-header">
    <div class="header-titles">
      <h1 class="page-title"><mat-icon>groups</mat-icon> Staff &amp; Faculty Profiles</h1>
      <p class="page-subtitle">Manage complete faculty and administrative staff directory — add, update, and monitor credentials.</p>
    </div>
    <div class="header-actions-row">
      <button mat-stroked-button color="primary" (click)="openBulkIdCards()" *ngIf="!showForm && canManageStaff">
        <mat-icon>badge</mat-icon> Staff ID Cards
      </button>
      <a mat-stroked-button color="warn" [routerLink]="['/teachers/fnf']" *ngIf="!showForm && canManageStaff">
        <mat-icon>exit_to_app</mat-icon> Exit &amp; FNF
      </a>
      <button mat-raised-button color="primary" (click)="openAddForm()" *ngIf="!showForm && canManageStaff">
        <mat-icon>person_add</mat-icon> Add Staff / Teacher
      </button>
    </div>
  </div>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <!-- ── ADD / EDIT FORM ── -->
  <mat-card class="form-card mat-elevation-z3" *ngIf="showForm">
    <div class="form-header">
      <h2><mat-icon color="primary">{{editingId ? 'edit' : 'person_add'}}</mat-icon>
        {{editingId ? 'Edit Staff / Faculty Details' : 'Add New Staff / Faculty Member'}}
      </h2>
      <button mat-icon-button (click)="cancelForm()"><mat-icon>close</mat-icon></button>
    </div>
    <form [formGroup]="teacherForm" (ngSubmit)="saveTeacher()">
      <div class="form-grid">

        <!-- ── SECTION 1: ROLE, CLASSIFICATION & EMPLOYMENT ── -->
        <div class="form-section-title">
          <mat-icon>badge</mat-icon>
          <span>Staff Classification &amp; Employment Details (पद, श्रेणी एवं रोजगार विवरण)</span>
        </div>

        <!-- Classification -->
        <mat-form-field appearance="outline">
          <mat-label>Staff Classification *</mat-label>
          <mat-select formControlName="staffType" (selectionChange)="onStaffTypeChange($event.value)">
            <mat-option [value]="1">Teaching Faculty (Teacher / Lecturer)</mat-option>
            <mat-option [value]="2">Administrative &amp; Management (Admin / Principal)</mat-option>
            <mat-option [value]="3">HR &amp; Operations</mat-option>
            <mat-option [value]="4">Accounts &amp; Finance (Accountant / Cashier)</mat-option>
            <mat-option [value]="5">Support &amp; Facility Staff (Librarian / Lab / Front Office)</mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Employee Code – Auto Generated (Approach 1: Category Specific) -->
        <mat-form-field appearance="outline">
          <mat-label>Employee Code *</mat-label>
          <input matInput formControlName="employeeCode" [readonly]="editingId || !allowManualCode" [class.readonly-field]="editingId || !allowManualCode">
          <button mat-icon-button matSuffix type="button" *ngIf="!editingId && !codeLoading"
            (click)="toggleCustomCode()"
            [matTooltip]="allowManualCode ? 'Reset to category auto-code' : 'Click to enter custom code'">
            <mat-icon style="font-size:18px;color:#2563eb">{{allowManualCode ? 'autorenew' : 'edit'}}</mat-icon>
          </button>
          <mat-icon matSuffix *ngIf="editingId" matTooltip="Employee code cannot be changed after creation" style="color:#64748b;font-size:16px">lock</mat-icon>
          <mat-spinner matSuffix diameter="16" *ngIf="codeLoading"></mat-spinner>
          <mat-hint *ngIf="!editingId && !allowManualCode">Auto-generated series</mat-hint>
          <mat-hint *ngIf="!editingId && allowManualCode" style="color:#2563eb;font-weight:600">Custom code mode</mat-hint>
          <mat-hint *ngIf="editingId">Locked: permanent employee ID</mat-hint>
        </mat-form-field>

        <!-- Full Name -->
        <mat-form-field appearance="outline">
          <mat-label>Full Name *</mat-label>
          <input matInput formControlName="fullName" placeholder="e.g. Ramesh Kumar Sharma">
        </mat-form-field>

        <!-- Department (with smooth Material autocomplete) -->
        <mat-form-field appearance="outline">
          <mat-label>Department *</mat-label>
          <input matInput formControlName="department" [matAutocomplete]="deptAuto" placeholder="e.g. Science, Accounts, HR, Admin">
          <mat-icon matSuffix style="color:#64748b;font-size:18px">apartment</mat-icon>
          <mat-autocomplete #deptAuto="matAutocomplete">
            <mat-option *ngFor="let d of filteredDepartments" [value]="d">{{ d }}</mat-option>
          </mat-autocomplete>
          <mat-hint>Select or type department</mat-hint>
        </mat-form-field>

        <!-- Designation (with smooth Material autocomplete) -->
        <mat-form-field appearance="outline">
          <mat-label>Designation *</mat-label>
          <input matInput formControlName="designation" [matAutocomplete]="desigAuto" placeholder="e.g. PGT Physics, Accountant, HR Manager">
          <mat-icon matSuffix style="color:#64748b;font-size:18px">work_outline</mat-icon>
          <mat-autocomplete #desigAuto="matAutocomplete">
            <mat-option *ngFor="let des of filteredDesignations" [value]="des">{{ des }}</mat-option>
          </mat-autocomplete>
          <mat-hint>Official post / title</mat-hint>
        </mat-form-field>

        <!-- Employment Type -->
        <mat-form-field appearance="outline">
          <mat-label>Employment Type</mat-label>
          <mat-select formControlName="employmentType">
            <mat-option value="Permanent">Permanent (Regular)</mat-option>
            <mat-option value="Probation">On Probation</mat-option>
            <mat-option value="Contractual">Contractual</mat-option>
            <mat-option value="Visiting">Visiting / Guest Faculty</mat-option>
            <mat-option value="Part-Time">Part-Time</mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Joining Date with range validation -->
        <mat-form-field appearance="outline">
          <mat-label>Joining Date *</mat-label>
          <input matInput type="date" formControlName="joiningDate" [min]="minDoj" [max]="maxDoj" (change)="validateDateRanges()">
          <mat-hint>Official date of joining</mat-hint>
          <mat-error *ngIf="teacherForm.get('joiningDate')?.hasError('beforeAdult')">Cannot be before 18th birthday</mat-error>
          <mat-error *ngIf="teacherForm.get('joiningDate')?.hasError('futureTooFar')">Cannot exceed 90 days in future</mat-error>
        </mat-form-field>

        <!-- Biometric User ID -->
        <mat-form-field appearance="outline">
          <mat-label>Biometric Machine Punch ID</mat-label>
          <input matInput formControlName="biometricUserId" placeholder="e.g. 102 or BIO-040">
          <mat-icon matSuffix matTooltip="Device ID on Fingerprint / Facial Attendance Machine" style="color:#64748b;font-size:16px">fingerprint</mat-icon>
          <mat-hint>Links biometric punch records</mat-hint>
        </mat-form-field>

        <!-- ── SECTION 2: PERSONAL & CONTACT DETAILS ── -->
        <div class="form-section-title">
          <mat-icon>person</mat-icon>
          <span>Personal, Contact &amp; Qualification Details (व्यक्तिगत एवं संपर्क विवरण)</span>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Father's / Spouse's Name</mat-label>
          <input matInput formControlName="fatherName">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Gender *</mat-label>
          <mat-select formControlName="gender">
            <mat-option value="Male">Male</mat-option>
            <mat-option value="Female">Female</mat-option>
            <mat-option value="Other">Other</mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Date of Birth with range validation -->
        <mat-form-field appearance="outline">
          <mat-label>Date of Birth</mat-label>
          <input matInput type="date" formControlName="dateOfBirth" [min]="minDob" [max]="maxDob" (change)="validateDateRanges()">
          <mat-hint>Min age 18 years</mat-hint>
          <mat-error *ngIf="teacherForm.get('dateOfBirth')?.hasError('underage')">Staff must be at least 18 years old</mat-error>
          <mat-error *ngIf="teacherForm.get('dateOfBirth')?.hasError('tooOld')">Please enter a valid DOB</mat-error>
        </mat-form-field>

        <!-- Blood Group -->
        <mat-form-field appearance="outline">
          <mat-label>Blood Group</mat-label>
          <mat-select formControlName="bloodGroup">
            <mat-option value="">-- Not Specified --</mat-option>
            <mat-option value="A+">A+</mat-option>
            <mat-option value="A-">A-</mat-option>
            <mat-option value="B+">B+</mat-option>
            <mat-option value="B-">B-</mat-option>
            <mat-option value="O+">O+</mat-option>
            <mat-option value="O-">O-</mat-option>
            <mat-option value="AB+">AB+</mat-option>
            <mat-option value="AB-">AB-</mat-option>
          </mat-select>
          <mat-hint>For Staff ID Card</mat-hint>
        </mat-form-field>

        <!-- Phone with inline duplicate check -->
        <div class="field-with-hint">
          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>Primary Phone Number *</mat-label>
            <input matInput formControlName="phoneNumber" maxlength="12" (blur)="checkDuplicate('phone')">
            <mat-icon matSuffix *ngIf="phoneDupChecking" style="font-size:16px">hourglass_empty</mat-icon>
            <mat-icon matSuffix *ngIf="!phoneDupChecking && phoneDuplicate" color="warn" style="font-size:16px">warning</mat-icon>
            <mat-icon matSuffix *ngIf="!phoneDupChecking && !phoneDuplicate && teacherForm.get('phoneNumber')?.value"
              style="font-size:16px;color:#2e7d32">check_circle</mat-icon>
            <mat-hint>10-digit mobile number</mat-hint>
          </mat-form-field>
          <div class="dup-warning" *ngIf="phoneDuplicate">
            <mat-icon>warning</mat-icon>Phone number already taken!
          </div>
        </div>

        <!-- WhatsApp with inline duplicate check & copy button -->
        <div class="field-with-hint">
          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>WhatsApp Number</mat-label>
            <input matInput formControlName="whatsAppPhone" maxlength="12" (blur)="checkDuplicate('whatsApp')">
            <button mat-icon-button matSuffix type="button" (click)="copyPhoneToWhatsApp()" matTooltip="Same as Phone Number">
              <mat-icon style="font-size:16px;color:#2563eb">content_copy</mat-icon>
            </button>
            <mat-icon matSuffix *ngIf="whatsAppDupChecking" style="font-size:16px">hourglass_empty</mat-icon>
            <mat-icon matSuffix *ngIf="!whatsAppDupChecking && whatsAppDuplicate" color="warn" style="font-size:16px">warning</mat-icon>
            <mat-icon matSuffix *ngIf="!whatsAppDupChecking && !whatsAppDuplicate && teacherForm.get('whatsAppPhone')?.value"
              style="font-size:16px;color:#2e7d32">check_circle</mat-icon>
            <mat-hint>WhatsApp payslip &amp; updates</mat-hint>
          </mat-form-field>
          <div class="dup-warning" *ngIf="whatsAppDuplicate">
            <mat-icon>warning</mat-icon> WhatsApp Number already taken!
          </div>
        </div>

        <!-- Email with inline duplicate check -->
        <div class="field-with-hint">
          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>Email Address</mat-label>
            <input matInput type="email" formControlName="email" (blur)="checkDuplicate('email')">
            <mat-icon matSuffix *ngIf="emailDupChecking" style="font-size:16px">hourglass_empty</mat-icon>
            <mat-icon matSuffix *ngIf="!emailDupChecking && emailDuplicate" color="warn" style="font-size:16px">warning</mat-icon>
            <mat-icon matSuffix *ngIf="!emailDupChecking && !emailDuplicate && teacherForm.get('email')?.value"
              style="font-size:16px;color:#2e7d32">check_circle</mat-icon>
            <mat-hint>Official or personal email</mat-hint>
          </mat-form-field>
          <div class="dup-warning" *ngIf="emailDuplicate">
            <mat-icon>warning</mat-icon> Yeh Email ID pehle se registered hai!
          </div>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Emergency Contact Person</mat-label>
          <input matInput formControlName="emergencyContactName" placeholder="e.g. Suman Sharma (Spouse)">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Emergency Contact Phone</mat-label>
          <input matInput formControlName="emergencyContactPhone" maxlength="12" placeholder="e.g. 9811223344">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Qualification</mat-label>
          <input matInput formControlName="qualification" placeholder="e.g. M.Sc, B.Ed, M.Tech, MBA, Graduate">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Subject Specialization</mat-label>
          <input matInput formControlName="specialization" placeholder="Physics, Mathematics, Accounts...">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Total Experience (Years)</mat-label>
          <input matInput type="number" formControlName="experienceYears" min="0">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Residential Address</mat-label>
          <input matInput formControlName="address" placeholder="Full residential / permanent address">
        </mat-form-field>

        <!-- ── SECTION 3: BANK DETAILS & TAX / PAYROLL IDENTIFIERS ── -->
        <div class="form-section-title">
          <mat-icon>account_balance</mat-icon>
          <span>Bank &amp; Statutory Details (बैंक खाता व वेतन विवरण — For Salary &amp; Payroll)</span>
        </div>

        <!-- Bank Name with smooth Material autocomplete -->
        <mat-form-field appearance="outline">
          <mat-label>Bank Name</mat-label>
          <input matInput formControlName="bankName" [matAutocomplete]="bankAuto" placeholder="e.g. State Bank of India, HDFC Bank">
          <mat-icon matSuffix style="color:#64748b;font-size:18px">account_balance</mat-icon>
          <mat-autocomplete #bankAuto="matAutocomplete">
            <mat-option *ngFor="let b of filteredBanks" [value]="b">{{ b }}</mat-option>
          </mat-autocomplete>
          <mat-hint>Select or type bank name</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Bank Account Number</mat-label>
          <input matInput formControlName="bankAccountNumber" placeholder="e.g. 302918239401">
          <mat-hint>Account for salary credit</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Bank IFSC Code</mat-label>
          <input matInput formControlName="bankIfscCode" placeholder="e.g. SBIN0001234" maxlength="11" style="text-transform:uppercase">
          <mat-hint>11-character IFSC</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Bank Account Holder Name</mat-label>
          <input matInput formControlName="bankAccountHolder" placeholder="Name as per bank passbook">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>PAN Card Number</mat-label>
          <input matInput formControlName="panNumber" placeholder="e.g. ABCDE1234F" maxlength="10" style="text-transform:uppercase">
          <mat-hint>Required for TDS tax deduction</mat-hint>
          <mat-error *ngIf="teacherForm.get('panNumber')?.hasError('pattern')">Invalid PAN format (e.g. ABCDE1234F)</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Aadhaar Card Number</mat-label>
          <input matInput formControlName="aadhaarNumber" placeholder="e.g. 123456789012" maxlength="12">
          <mat-hint>12-digit Aadhaar UID</mat-hint>
          <mat-error *ngIf="teacherForm.get('aadhaarNumber')?.hasError('pattern')">Must be 12 numeric digits</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>PF / UAN Number</mat-label>
          <input matInput formControlName="uanNumber" placeholder="e.g. 100928374650">
          <mat-hint>Required for PF deduction</mat-hint>
        </mat-form-field>

        <!-- Profile Photo Row: URL or File Upload (Clean & Responsive) -->
        <div class="photo-upload-row full-width">
          <div class="photo-preview-box">
            <img *ngIf="teacherForm.get('photoUrl')?.value && !previewImgError"
                 [src]="getPhotoUrl(teacherForm.get('photoUrl')?.value)"
                 class="form-avatar-preview"
                 (error)="previewImgError = true"
                 (load)="previewImgError = false"
                 alt="Preview">
            <div *ngIf="!teacherForm.get('photoUrl')?.value || previewImgError" class="form-avatar-placeholder">
              <mat-icon>person</mat-icon>
            </div>
          </div>
          <div class="photo-field-wrapper">
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Profile Photo (URL or File)</mat-label>
              <input matInput formControlName="photoUrl" placeholder="Paste image link or choose image file below" (input)="previewImgError = false">
              <mat-icon matPrefix style="color:#64748b;margin-right:6px">photo_camera</mat-icon>
              <button mat-icon-button matSuffix *ngIf="teacherForm.get('photoUrl')?.value" type="button" (click)="teacherForm.patchValue({photoUrl: ''})">
                <mat-icon style="font-size:16px">clear</mat-icon>
              </button>
            </mat-form-field>
            <div class="photo-btn-group">
              <input #formFileInput type="file" accept="image/*" (change)="onFileSelected($event)" style="display:none">
              <button mat-stroked-button type="button" color="primary" class="upload-pic-btn" (click)="formFileInput.click()">
                <mat-icon>cloud_upload</mat-icon> Upload Photo
              </button>
              <span class="upload-note">Supports JPG, PNG, WebP (Max 2MB)</span>
            </div>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button mat-button type="button" (click)="cancelForm()">Cancel</button>
        <button mat-raised-button color="primary" type="submit" [disabled]="teacherForm.invalid || saving || hasDuplicates">
          <mat-spinner diameter="18" *ngIf="saving" style="display:inline-block;margin-right:6px"></mat-spinner>
          <mat-icon *ngIf="!saving">save</mat-icon>
          {{saving ? 'Saving...' : (editingId ? 'Update Staff Member' : 'Add Staff Member')}}
        </button>
      </div>
    </form>
  </mat-card>

  <!-- ── SEARCH & FILTER ── -->
  <mat-card class="filter-card mat-elevation-z1" *ngIf="!showForm">
    <div class="filter-heading">
      <div class="filter-title"><mat-icon>filter_list</mat-icon><strong>Staff &amp; Faculty Directory</strong></div>
      <span class="total-count">{{totalCount}} members</span>
    </div>
    <div class="filter-controls">
      <mat-form-field appearance="outline" class="search-field">
        <mat-label>Search staff / faculty members...</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [(ngModel)]="searchTerm" (ngModelChange)="onSearch()" placeholder="Name, code, designation, department...">
        <button mat-icon-button matSuffix *ngIf="searchTerm" (click)="searchTerm=''; loadTeachers()">
          <mat-icon>clear</mat-icon>
        </button>
      </mat-form-field>
      <mat-form-field appearance="outline" class="staff-filter-field">
        <mat-label>Staff Type</mat-label>
        <mat-select [(ngModel)]="filterStaffType" (ngModelChange)="loadTeachers()">
          <mat-option value="All">All Staff &amp; Faculty</mat-option>
          <mat-option value="Teaching">Teaching Faculty</mat-option>
          <mat-option value="NonTeaching">Non-Teaching Staff</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="status-field">
        <mat-label>Status</mat-label>
        <mat-select [(ngModel)]="filterActive" (ngModelChange)="loadTeachers()">
          <mat-option [value]="null">All Status</mat-option>
          <mat-option [value]="true">Active Only</mat-option>
          <mat-option [value]="false">Inactive Only</mat-option>
        </mat-select>
      </mat-form-field>
    </div>
  </mat-card>

  <!-- ── SELECTED TEACHER PROFILE VIEW ── -->
  <div class="profile-view" *ngIf="selectedTeacher && !showForm">
    <mat-card class="profile-card mat-elevation-z3">
      <div class="profile-top">
        <div class="avatar-circle-wrapper">
          <div class="avatar-circle" (click)="selectedTeacher.photoUrl && openPhotoPreview(selectedTeacher.photoUrl, selectedTeacher.fullName)" [style.cursor]="selectedTeacher.photoUrl ? 'pointer' : 'default'" [matTooltip]="selectedTeacher.photoUrl ? 'Click to view full photo' : ''">
            <img *ngIf="selectedTeacher.photoUrl && !imgLoadErrors[selectedTeacher.id]"
                 [src]="getPhotoUrl(selectedTeacher.photoUrl)"
                 [alt]="selectedTeacher.fullName"
                 class="avatar-img"
                 (error)="imgLoadErrors[selectedTeacher.id] = true">
            <span *ngIf="!selectedTeacher.photoUrl || imgLoadErrors[selectedTeacher.id]">
              {{getInitials(selectedTeacher.fullName)}}
            </span>
          </div>
          <button mat-mini-fab color="primary" class="avatar-quick-upload-btn" *ngIf="canManageStaff && selectedTeacher.isActive" (click)="quickAvatarInput.click()" matTooltip="Upload / Update Profile Photo">
            <mat-icon style="font-size:16px;width:16px;height:16px;line-height:16px;">camera_alt</mat-icon>
          </button>
          <input #quickAvatarInput type="file" accept="image/*" (change)="onQuickAvatarSelected($event, selectedTeacher)" style="display:none">
        </div>
        <div class="profile-info">
          <div class="profile-title-row">
            <h2>{{selectedTeacher.fullName}}</h2>
            <div class="badges-row">
              <span class="emp-badge">{{selectedTeacher.employeeCode}}</span>
              <span class="staff-type-pill" [class.non-teach]="!isTeachingStaff(selectedTeacher)">
                <mat-icon>{{ isTeachingStaff(selectedTeacher) ? 'school' : 'badge' }}</mat-icon>
                {{ isTeachingStaff(selectedTeacher) ? 'Faculty' : 'Non-Teaching' }}
              </span>
              <span class="status-chip" [class.active]="selectedTeacher.isActive" [class.inactive]="!selectedTeacher.isActive">
                {{selectedTeacher.isActive ? 'Active' : 'Inactive'}}
              </span>
            </div>
          </div>
          <div class="profile-meta-row">
            <span class="spec-text" *ngIf="isTeachingStaff(selectedTeacher)">
              {{selectedTeacher.specialization || 'Teaching Faculty'}}
            </span>
            <span class="spec-text non-teach-text" *ngIf="!isTeachingStaff(selectedTeacher)">
              <strong>{{selectedTeacher.designation || 'Staff Member'}}</strong>
              <span *ngIf="selectedTeacher.department"> &bull; {{selectedTeacher.department}}</span>
            </span>
            <span class="qual-badge" *ngIf="selectedTeacher.qualification">&bull; {{selectedTeacher.qualification}}</span>
          </div>
        </div>
        <button mat-icon-button (click)="selectedTeacher = null" class="close-profile" matTooltip="Close Profile Card">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Relieved / Offboarded Faculty Notice Banner -->
      <div class="relieved-banner" *ngIf="!selectedTeacher.isActive">
        <div class="banner-left">
          <div class="lock-icon-box"><mat-icon>verified_user</mat-icon></div>
          <div class="banner-content">
            <span class="banner-title">Staff Member Offboarded &amp; Relieved</span>
            <span class="banner-sub">Full &amp; Final Settlement (FNF) has been finalized. ERP portal login, monthly payroll, and operational allocations are deactivated.</span>
          </div>
        </div>
        <a mat-flat-button color="primary" class="banner-btn" [routerLink]="['/teachers/fnf']" [queryParams]="{viewSettlementTeacherId: selectedTeacher.id}">
          <mat-icon>receipt_long</mat-icon> View FNF Statement &amp; Certificate
        </a>
      </div>

      <mat-divider></mat-divider>

      <div class="profile-details-grid">
        <div class="detail-block">
          <span class="block-title"><mat-icon>contact_phone</mat-icon> Contact &amp; Personal</span>
          <div class="detail-row"><mat-icon>phone</mat-icon><span><strong>Phone:</strong> {{selectedTeacher.phoneNumber}}</span></div>
          <div class="detail-row" *ngIf="selectedTeacher.whatsAppPhone"><mat-icon style="color:#25d366">chat</mat-icon><span><strong>WhatsApp:</strong> {{selectedTeacher.whatsAppPhone}}</span></div>
          <div class="detail-row" *ngIf="selectedTeacher.email"><mat-icon>email</mat-icon><span><strong>Email:</strong> {{selectedTeacher.email}}</span></div>
          <div class="detail-row" *ngIf="selectedTeacher.bloodGroup"><mat-icon style="color:#dc2626">water_drop</mat-icon><span><strong>Blood Group:</strong> {{selectedTeacher.bloodGroup}}</span></div>
          <div class="detail-row" *ngIf="selectedTeacher.emergencyContactPhone"><mat-icon>emergency</mat-icon><span><strong>Emergency:</strong> {{selectedTeacher.emergencyContactName}} ({{selectedTeacher.emergencyContactPhone}})</span></div>
          <div class="detail-row" *ngIf="selectedTeacher.address"><mat-icon>location_on</mat-icon><span><strong>Address:</strong> {{selectedTeacher.address}}</span></div>
        </div>

        <div class="detail-block">
          <span class="block-title"><mat-icon>work</mat-icon> Employment &amp; Biometrics</span>
          <div class="detail-row"><mat-icon>badge</mat-icon><span><strong>Employment:</strong> {{selectedTeacher.employmentType || 'Permanent'}}</span></div>
          <div class="detail-row"><mat-icon>calendar_today</mat-icon><span><strong>Joined:</strong> {{selectedTeacher.joiningDate | date:'dd MMM yyyy'}}</span></div>
          <div class="detail-row"><mat-icon>history_edu</mat-icon><span><strong>Experience:</strong> {{selectedTeacher.experienceYears}} years</span></div>
          <div class="detail-row" *ngIf="selectedTeacher.dateOfBirth"><mat-icon>cake</mat-icon><span><strong>DOB:</strong> {{selectedTeacher.dateOfBirth | date:'dd MMM yyyy'}}</span></div>
          <div class="detail-row" *ngIf="selectedTeacher.biometricUserId"><mat-icon>fingerprint</mat-icon><span><strong>Biometric ID:</strong> {{selectedTeacher.biometricUserId}}</span></div>
        </div>

        <div class="detail-block">
          <span class="block-title"><mat-icon>account_balance</mat-icon> Bank &amp; Statutory (Payroll)</span>
          <div class="detail-row" *ngIf="selectedTeacher.bankName"><mat-icon>account_balance</mat-icon><span><strong>Bank:</strong> {{selectedTeacher.bankName}}</span></div>
          <div class="detail-row" *ngIf="selectedTeacher.bankAccountNumber"><mat-icon>credit_card</mat-icon><span><strong>A/C No:</strong> {{selectedTeacher.bankAccountNumber}}</span></div>
          <div class="detail-row" *ngIf="selectedTeacher.bankIfscCode"><mat-icon>tag</mat-icon><span><strong>IFSC:</strong> {{selectedTeacher.bankIfscCode}}</span></div>
          <div class="detail-row" *ngIf="selectedTeacher.panNumber"><mat-icon>receipt</mat-icon><span><strong>PAN:</strong> {{selectedTeacher.panNumber}}</span></div>
          <div class="detail-row" *ngIf="selectedTeacher.aadhaarNumber"><mat-icon>verified</mat-icon><span><strong>Aadhaar:</strong> {{selectedTeacher.aadhaarNumber}}</span></div>
          <div class="detail-row" *ngIf="selectedTeacher.uanNumber"><mat-icon>savings</mat-icon><span><strong>UAN / PF:</strong> {{selectedTeacher.uanNumber}}</span></div>
          <div class="detail-row no-bank" *ngIf="!selectedTeacher.bankAccountNumber && !selectedTeacher.panNumber">
            <mat-icon style="color:#94a3b8">info</mat-icon>
            <span style="color:#64748b;font-style:italic">Bank &amp; PAN not configured yet. Click Edit to update.</span>
          </div>
        </div>
      </div>

      <mat-divider></mat-divider>

      <!-- Quick Navigation to Sub-Pages -->
      <div class="quick-nav">
        <p class="quick-nav-title">Directly Jaao →</p>
        <div class="quick-nav-grid">
          <a mat-stroked-button *ngIf="isTeachingStaff(selectedTeacher)" [routerLink]="['/teachers/assignments']" [queryParams]="{teacherId: selectedTeacher.id}">
            <mat-icon>class</mat-icon> Batch Assignments
          </a>
          <a mat-stroked-button [routerLink]="['/teachers/attendance']" [queryParams]="{teacherId: selectedTeacher.id}">
            <mat-icon>event_available</mat-icon> Attendance
          </a>
          <!-- Salary Structure: Admin/HR only -->
          <a mat-stroked-button *ngIf="canManageStaff" [routerLink]="['/teachers/salary']" [queryParams]="{teacherId: selectedTeacher.id}">
            <mat-icon>account_balance_wallet</mat-icon> Salary Structure
          </a>
          <a mat-stroked-button [routerLink]="['/teachers/payments']" [queryParams]="{teacherId: selectedTeacher.id}">
            <mat-icon>payments</mat-icon> Salary Payments
          </a>
          <a mat-stroked-button [routerLink]="['/teachers/advances']" [queryParams]="{teacherId: selectedTeacher.id}">
            <mat-icon>currency_rupee</mat-icon> Advances
          </a>
          <a mat-stroked-button [routerLink]="['/teachers/leaves']" [queryParams]="{teacherId: selectedTeacher.id}">
            <mat-icon>beach_access</mat-icon> Leave Management
          </a>
          <a mat-stroked-button *ngIf="isTeachingStaff(selectedTeacher)" [routerLink]="['/teachers/substitution']">
            <mat-icon>swap_horiz</mat-icon> Proxy &amp; Substitution
          </a>
          <a mat-stroked-button *ngIf="isTeachingStaff(selectedTeacher)" [routerLink]="['/teachers/lesson-plans']" [queryParams]="{teacherId: selectedTeacher.id}">
            <mat-icon>menu_book</mat-icon> Lesson Diary
          </a>
          <!-- Transport Pass: shown if transport module is on -->
          <a mat-stroked-button *ngIf="authService.hasTransportModule()" [routerLink]="['/transport']" style="color: #2563eb; border-color: #93c5fd;">
            <mat-icon style="color: #2563eb;">directions_bus</mat-icon> Transport Pass
          </a>
          <!-- Staff Quarters: Admin/HR only -->
          <a mat-stroked-button *ngIf="canManageStaff && authService.hasHostelModule()" [routerLink]="['/hostel']" style="color: #4f46e5; border-color: #c7d2fe;">
            <mat-icon style="color: #4f46e5;">apartment</mat-icon> Staff Quarters
          </a>
          <!-- Library Account: shown if library module is on -->
          <a mat-stroked-button *ngIf="authService.hasLibraryModule()" [routerLink]="['/library/circulation']" [queryParams]="{teacherId: selectedTeacher.id}" style="color: #059669; border-color: #a7f3d0;">
            <mat-icon style="color: #059669;">local_library</mat-icon> Library Account
          </a>
          <!-- Exit/FNF: Admin/HR only -->
          <a mat-stroked-button *ngIf="canManageStaff && selectedTeacher.isActive" [routerLink]="['/teachers/fnf']" [queryParams]="{teacherId: selectedTeacher.id}" style="color: #dc2626; border-color: #fca5a5;">
            <mat-icon style="color: #dc2626;">exit_to_app</mat-icon> Exit / FNF
          </a>
          <!-- Relieved/Inactive Teacher: View Settled FNF Statement -->
          <a mat-stroked-button *ngIf="canManageStaff && !selectedTeacher.isActive" [routerLink]="['/teachers/fnf']" [queryParams]="{viewSettlementTeacherId: selectedTeacher.id}" style="color: #1e40af; border-color: #93c5fd; background: #eff6ff;">
            <mat-icon style="color: #2563eb;">receipt_long</mat-icon> FNF Statement
          </a>
        </div>
      </div>

      <mat-divider></mat-divider>

      <div class="profile-actions">
        <div class="account-actions-group">
          <div class="user-account-badge" *ngIf="selectedTeacher.hasLoginAccount">
            <mat-icon>verified_user</mat-icon>
            <span>ERP Login {{ selectedTeacher.isActive ? 'Active' : 'Locked' }}: <strong>&#64;{{selectedTeacher.username}}</strong></span>
          </div>
          <!-- Only Admin/HR can create new login accounts -->
          <button mat-stroked-button color="accent" *ngIf="canManageStaff && selectedTeacher.isActive && !selectedTeacher.hasLoginAccount" (click)="openCreateAccountDialog(selectedTeacher)">
            <mat-icon>person_add_alt</mat-icon> Create ERP Login
          </button>
        </div>
        <!-- Staff ID Card: everyone can print their own -->
        <button mat-stroked-button color="primary" *ngIf="selectedTeacher.isActive" (click)="openSingleIdCard(selectedTeacher)">
          <mat-icon>badge</mat-icon> Staff ID Card
        </button>
        <!-- KYC & Docs: visible to all, but full management only for Admin/HR -->
        <button mat-stroked-button color="accent" *ngIf="selectedTeacher.isActive" (click)="openDocumentsModal(selectedTeacher)">
          <mat-icon>folder_shared</mat-icon> KYC &amp; Docs
        </button>

        <!-- Exit / FNF Settlement: Admin/HR only -->
        <a mat-stroked-button color="warn" *ngIf="canManageStaff && selectedTeacher.isActive" [routerLink]="['/teachers/fnf']" [queryParams]="{teacherId: selectedTeacher.id}">
          <mat-icon>exit_to_app</mat-icon> Exit / FNF Settlement
        </a>

        <!-- Offboarded / Relieved Teacher: View FNF Statement & Certificate -->
        <a mat-stroked-button style="color: #1e40af; border-color: #93c5fd; background: #eff6ff;" *ngIf="canManageStaff && !selectedTeacher.isActive" [routerLink]="['/teachers/fnf']" [queryParams]="{viewSettlementTeacherId: selectedTeacher.id}">
          <mat-icon style="color: #2563eb;">receipt_long</mat-icon> View FNF Statement
        </a>

        <!-- Edit Profile: Admin/HR only -->
        <button mat-raised-button color="primary" *ngIf="canManageStaff && selectedTeacher.isActive" (click)="editTeacher(selectedTeacher)">
          <mat-icon>edit</mat-icon> Edit Profile
        </button>
        <!-- Remove: Admin only (not HR) -->
        <button mat-raised-button color="warn" *ngIf="authService.isAdmin() && selectedTeacher.isActive" (click)="deleteTeacher(selectedTeacher.id)">
          <mat-icon>delete</mat-icon> Remove
        </button>
      </div>
    </mat-card>
  </div>

  <!-- ── TEACHER GRID ── -->
  <div class="teachers-grid" *ngIf="!showForm">
    <mat-card class="teacher-card mat-elevation-z2"
      *ngFor="let t of teachers"
      [class.selected-card]="selectedTeacher?.id === t.id"
      (click)="selectTeacher(t)">
      <div class="card-avatar" [class.has-photo]="!!t.photoUrl && !imgLoadErrors[t.id]">
        <img *ngIf="t.photoUrl && !imgLoadErrors[t.id]"
             [src]="getPhotoUrl(t.photoUrl)"
             [alt]="t.fullName"
             class="card-photo-img"
             (error)="imgLoadErrors[t.id] = true">
        <div *ngIf="!t.photoUrl || imgLoadErrors[t.id]" class="card-initials-badge">
          {{getInitials(t.fullName)}}
        </div>
        <button mat-icon-button class="card-photo-zoom-btn"
                *ngIf="t.photoUrl && !imgLoadErrors[t.id]"
                (click)="$event.stopPropagation(); openPhotoPreview(t.photoUrl, t.fullName)"
                matTooltip="View Full Photo">
          <mat-icon style="font-size:16px;width:16px;height:16px;line-height:16px;">zoom_in</mat-icon>
        </button>
      </div>
      <div class="card-body">
        <div class="card-top">
          <span class="emp-code">{{t.employeeCode}}</span>
          <span class="staff-mini-pill" [class.non-teach]="!isTeachingStaff(t)">
            {{ isTeachingStaff(t) ? 'Faculty' : (t.designation || 'Staff') }}
          </span>
          <span class="login-badge-chip" *ngIf="t.hasLoginAccount" [matTooltip]="'ERP Login Active (@' + (t.username || '') + ')'">
            <mat-icon>vpn_key</mat-icon>
          </span>
          <span class="active-dot" [class.active]="t.isActive" [class.inactive]="!t.isActive"></span>
        </div>
        <h4>{{t.fullName}}</h4>
        <p class="spec" *ngIf="isTeachingStaff(t)">{{t.specialization || 'Teaching Faculty'}}</p>
        <p class="spec non-teach-spec" *ngIf="!isTeachingStaff(t)">{{t.designation || 'Staff'}} <span *ngIf="t.department">({{t.department}})</span></p>
        <p class="qual">{{t.qualification || ''}}</p>
        <div class="card-meta">
          <span *ngIf="isTeachingStaff(t)"><mat-icon>class</mat-icon>{{t.assignedBatchCount}} Batches</span>
          <span *ngIf="!isTeachingStaff(t)"><mat-icon>apartment</mat-icon>{{t.department || 'Staff'}}</span>
          <span><mat-icon>work_history</mat-icon>{{t.experienceYears}}y exp</span>
        </div>
        <div class="card-phone"><mat-icon>phone</mat-icon>{{t.phoneNumber}}</div>
      </div>
    </mat-card>

    <div class="empty-state" *ngIf="teachers.length === 0 && !loading">
      <mat-icon>person_off</mat-icon>
      <p>No staff or faculty records found. Click "Add Staff / Teacher" above to get started.</p>
    </div>
  </div>

  <!-- Pagination -->
  <div class="pagination" *ngIf="totalCount > pageSize && !showForm">
    <button mat-icon-button [disabled]="pageNumber === 1" (click)="changePage(-1)">
      <mat-icon>chevron_left</mat-icon>
    </button>
    <span>Page {{pageNumber}} of {{totalPages}}</span>
    <button mat-icon-button [disabled]="pageNumber >= totalPages" (click)="changePage(1)">
      <mat-icon>chevron_right</mat-icon>
    </button>
  </div>

  <!-- Create Teacher Login Modal -->
  <div class="account-drawer-overlay" *ngIf="showAccountModal">
    <mat-card class="account-drawer-card mat-elevation-z4">
      <div class="account-drawer-header">
        <div class="hdr-icon"><mat-icon>lock_person</mat-icon></div>
        <div class="hdr-text">
          <h3>Create Staff ERP Login</h3>
          <p>Set up portal login credentials for <strong>{{accountTeacher?.fullName}}</strong></p>
        </div>
        <button mat-icon-button (click)="closeAccountModal()"><mat-icon>close</mat-icon></button>
      </div>
      <div class="account-drawer-body">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Assign Portal Role *</mat-label>
          <mat-select [(ngModel)]="accountFormData.roleId">
            <mat-option *ngFor="let r of systemRoles" [value]="r.id">{{r.name}}</mat-option>
          </mat-select>
          <mat-hint>Determines page permissions &amp; accessible ERP modules</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width" style="margin-top: 10px;">
          <mat-label>Login Username *</mat-label>
          <input matInput [(ngModel)]="accountFormData.username" placeholder="e.g. rahul.sharma" />
          <mat-hint>Staff member will use this to sign into IMSERP</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width" style="margin-top: 10px;">
          <mat-label>Initial Password *</mat-label>
          <input matInput type="text" [(ngModel)]="accountFormData.password" placeholder="e.g. Staff@123" />
          <mat-hint>User can change this after logging in</mat-hint>
        </mat-form-field>
      </div>
      <div class="account-drawer-footer">
        <button mat-button (click)="closeAccountModal()">Cancel</button>
        <button mat-raised-button color="primary" [disabled]="!accountFormData.username || !accountFormData.password || accountSaving" (click)="saveAccount()">
          <mat-icon>{{ accountSaving ? 'hourglass_empty' : 'check_circle' }}</mat-icon>
          {{ accountSaving ? 'Creating...' : 'Create Account' }}
        </button>
      </div>
    </mat-card>
  </div>

  <!-- Full Photo Preview Lightbox Dialog -->
  <div class="photo-lightbox-backdrop" *ngIf="previewPhotoUrl" (click)="previewPhotoUrl = null">
    <div class="photo-lightbox-modal" (click)="$event.stopPropagation()">
      <div class="lightbox-header">
        <div class="lightbox-title-box">
          <mat-icon>account_circle</mat-icon>
          <span>{{previewPhotoTitle || 'Profile Photo'}}</span>
        </div>
        <button mat-icon-button (click)="previewPhotoUrl = null" class="lightbox-close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="lightbox-body">
        <img [src]="getPhotoUrl(previewPhotoUrl)" [alt]="previewPhotoTitle" class="lightbox-full-img">
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .page-container { display:flex; flex-direction:column; gap:20px; }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: nowrap;
    }
    .header-titles {
      flex: 1;
      min-width: 0;
    }
    .header-actions-row {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      white-space: nowrap;
      flex-wrap: nowrap;
    }
    .page-title { font-size:1.5rem; font-weight:700; margin:0; color:#1976d2; display:flex; align-items:center; gap:8px;
      mat-icon { font-size:1.5rem; width:1.5rem; height:1.5rem; } }
    .page-subtitle { color:#666; margin:4px 0 0; font-size:.9rem; }
    .form-card { padding:24px; border-radius:12px; }
    .form-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;
      h2 { display:flex; align-items:center; gap:8px; font-size:1.1rem; font-weight:700; margin:0; } }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      column-gap: 16px;
      row-gap: 14px;
    }
    .form-grid mat-form-field {
      width: 100%;
    }
    .form-grid mat-form-field .mat-mdc-form-field-subscript-wrapper {
      padding: 0 4px;
      margin-top: 2px;
      min-height: 18px;
    }
    .form-grid mat-hint {
      font-size: 0.72rem;
      color: #64748b;
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .full-width { grid-column: 1 / -1; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; }
    .filter-card { padding: 14px 18px 8px; border-radius: 10px; display: flex; flex-direction: column; gap: 6px; }
    .filter-heading { display: flex; align-items: center; justify-content: space-between; min-height: 24px; }
    .filter-title { display: flex; align-items: center; gap: 7px; color: #1e3a8a; font-size: .9rem; }
    .filter-title mat-icon { font-size: 19px; width: 19px; height: 19px; color: #2563eb; }
    .total-count { color: #64748b; font-size: .78rem; font-weight: 600; margin-left: auto; }
    .filter-controls { display: grid; grid-template-columns: minmax(240px, 1fr) 200px 160px; gap: 14px; align-items: center; }
    .search-field, .staff-filter-field, .status-field { width: 100%; }
    /* Profile View */
    .profile-view { margin-bottom: 24px; }
    .profile-card {
      padding: 24px;
      border-radius: 14px;
      border: 1px solid #bfdbfe;
      background: #ffffff;
      box-shadow: 0 4px 16px -2px rgba(37, 99, 235, 0.08) !important;
    }
    .profile-top {
      display: flex;
      align-items: center;
      gap: 20px;
      position: relative;
    }
    .avatar-circle-wrapper {
      position: relative;
      display: inline-block;
      flex-shrink: 0;
    }
    .avatar-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.8rem;
      font-weight: 700;
      overflow: hidden;
      border: 3px solid #dbeafe;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
    }
    .avatar-quick-upload-btn {
      position: absolute; bottom: -2px; right: -2px; width: 28px !important; height: 28px !important;
      background: #2563eb !important; color: #ffffff !important; border-radius: 50%;
      border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 15px; width: 15px; height: 15px; line-height: 15px; }
      &:hover { background: #1d4ed8 !important; }
    }
    .avatar-img {
      width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block;
    }
    .photo-upload-row {
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 8px 0 14px;
      padding: 14px 18px;
      background: #f8fafc;
      border: 1.5px dashed #bfdbfe;
      border-radius: 12px;
      transition: border-color 0.2s ease;
      &:hover { border-color: #3b82f6; }
    }
    .photo-preview-box {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      overflow: hidden;
      border: 2px solid #93c5fd;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(37,99,235,0.15);
    }
    .form-avatar-preview { width: 100%; height: 100%; object-fit: cover; }
    .form-avatar-placeholder { color: #94a3b8; display: flex; align-items: center; justify-content: center; mat-icon { font-size: 32px; width: 32px; height: 32px; } }
    .photo-field-wrapper {
      flex: 1;
      min-width: 0;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .photo-btn-group {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .upload-pic-btn {
      font-size: 0.82rem;
      height: 34px;
      line-height: 34px;
      padding: 0 14px;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .upload-note {
      font-size: 0.74rem;
      color: #64748b;
    }
    .profile-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .profile-title-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      h2 {
        margin: 0;
        font-size: 1.35rem;
        font-weight: 700;
        color: #0f172a;
      }
    }
    .badges-row {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .profile-meta-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .qual-badge {
      font-size: 0.85rem;
      color: #64748b;
      font-weight: 500;
    }
    .emp-badge { background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe; padding:3px 10px; border-radius:12px; font-size:.78rem; font-weight:700; }
    .status-chip { padding:3px 10px; border-radius:12px; font-size:.75rem; font-weight:600;
      &.active{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;} &.inactive{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;} }
    .staff-type-pill {
      display: inline-flex; align-items: center; gap: 4px;
      background: #eff6ff; color: #1d4ed8; padding: 3px 10px; border-radius: 12px;
      border: 1px solid #bfdbfe;
      font-size: .75rem; font-weight: 600;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &.non-teach { background: #faf5ff; color: #7e22ce; border-color: #e9d5ff; }
    }
    .staff-mini-pill {
      font-size: .7rem; font-weight: 600; color: #0284c7; background: #f0f9ff;
      padding: 1px 6px; border-radius: 6px; border: 1px solid #bae6fd;
      &.non-teach { color: #6d28d9; background: #f5f3ff; border-color: #ddd6fe; }
    }
    .non-teach-text { color: #4338ca !important; }
    .non-teach-spec { color: #6d28d9 !important; font-weight: 600; }
    .spec-text { color:#1e40af; font-weight:600; font-size:.9rem; margin:0; }
    .qual-text { color:#64748b; font-size:.82rem; margin:0; }
    .close-profile {
      margin-left: auto;
      align-self: flex-start;
      color: #64748b;
      background: #f8fafc;
      border-radius: 8px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      &:hover {
        background: #fee2e2;
        color: #ef4444;
      }
    }
    .relieved-banner {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-left: 4px solid #2563eb;
      border-radius: 10px;
      padding: 12px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin: 16px 0 10px;
      flex-wrap: wrap;
    }
    .banner-left { display: flex; align-items: center; gap: 12px; }
    .lock-icon-box {
      background: #2563eb; color: #ffffff; border-radius: 8px;
      width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      flex-shrink: 0;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }
    .banner-content { display: flex; flex-direction: column; gap: 2px; }
    .banner-title { color: #1e3a8a; font-weight: 700; font-size: 0.92rem; }
    .banner-sub { color: #3b82f6; font-size: 0.8rem; }
    .banner-btn { white-space: nowrap; }
    .form-section-title {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.95rem;
      font-weight: 700;
      color: #1e40af;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      padding: 9px 14px;
      border-radius: 8px;
      margin: 14px 0 6px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: #2563eb; }
    }
    .profile-details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      padding: 16px 0;
    }
    .detail-block {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .block-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      font-weight: 700;
      color: #1e40af;
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 6px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }
    }
    .detail-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.83rem;
      color: #334155;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; flex-shrink: 0; }
    }
    .quick-nav { padding:16px 0; }
    .quick-nav-title { font-size:.8rem; font-weight:700; color:#64748b; margin:0 0 12px; text-transform:uppercase; letter-spacing:.5px; }
    .quick-nav-grid { display:flex; flex-wrap:wrap; gap:8px;
      a { display:flex; align-items:center; gap:6px; font-size:.82rem;
        mat-icon{font-size:16px;width:16px;height:16px;} } }
    .profile-actions { display:flex; align-items:center; gap:12px; margin-top:16px; flex-wrap:wrap; }
    .account-actions-group { display:flex; align-items:center; gap:8px; margin-right:auto; }
    .user-account-badge {
      display:inline-flex; align-items:center; gap:6px; background:#eff6ff; color:#1d4ed8;
      border:1px solid #bfdbfe; border-radius:8px; padding:6px 12px; font-size:0.84rem;
      mat-icon { font-size:18px; width:18px; height:18px; color:#2563eb; }
    }
    .login-badge-chip {
      display:inline-flex; align-items:center; justify-content:center;
      color:#2563eb; background:#eff6ff; border-radius:4px; padding:1px 4px;
      mat-icon { font-size:14px; width:14px; height:14px; line-height:14px; }
    }

    /* Modal Styling - AGENTS.md light-blue gradient header rule */
    .account-drawer-overlay {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(2px);
      z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;
    }
    .account-drawer-card {
      width: 100%; max-width: 480px; border-radius: 12px; overflow: hidden; padding: 0 !important;
      background: #ffffff; border: 1px solid #bfdbfe; box-shadow: 0 12px 24px -4px rgba(37,99,235,0.15);
    }
    .account-drawer-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe; padding: 16px 20px;
      display: flex; align-items: center; gap: 12px;
      .hdr-icon {
        background: #2563eb; color: #ffffff; border-radius: 10px;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
        width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
        mat-icon { font-size: 22px; width: 22px; height: 22px; }
      }
      .hdr-text {
        flex: 1;
        h3 { color: #1e3a8a; font-weight: 700; margin: 0; font-size: 1.05rem; }
        p { color: #3b82f6; margin: 2px 0 0; font-size: 0.8rem; }
      }
    }
    .account-drawer-body { padding: 20px 24px; display:flex; flex-direction:column; gap:8px; }
    .account-drawer-footer {
      padding: 12px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: flex-end; gap: 10px;
    }
    /* Teacher Grid */
    .teachers-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:16px; }
    .teacher-card {
      border-radius: 14px;
      cursor: pointer;
      transition: all .2s ease;
      padding: 0;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      &:hover {
        transform: translateY(-3px);
        box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.15) !important;
        border-color: #bfdbfe;
      }
      &.selected-card {
        border: 2px solid #2563eb;
        box-shadow: 0 8px 20px -3px rgba(37, 99, 235, 0.2) !important;
      }
    }
    .card-avatar {
      height: 140px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
      border-bottom: 1px solid #bfdbfe;
      &.has-photo {
        background: #f8fafc;
      }
    }
    .card-photo-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      display: block;
      transition: transform 0.25s ease;
    }
    .teacher-card:hover .card-photo-img {
      transform: scale(1.04);
    }
    .card-initials-badge {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%);
      border: 3px solid #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.6rem;
      font-weight: 700;
      color: #ffffff;
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.28);
    }
    .card-photo-zoom-btn {
      position: absolute; top: 8px; right: 8px; width: 28px !important; height: 28px !important;
      background: rgba(15, 23, 42, 0.6) !important; color: #ffffff !important; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; opacity: 0;
      transition: opacity 0.2s ease, background 0.2s ease;
      mat-icon { font-size: 16px; width: 16px; height: 16px; line-height: 16px; }
      &:hover { background: rgba(37, 99, 235, 0.9) !important; }
    }
    .teacher-card:hover .card-photo-zoom-btn {
      opacity: 1;
    }
    .photo-lightbox-backdrop {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(3px);
      z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 24px;
    }
    .photo-lightbox-modal {
      background: #ffffff; border-radius: 12px; overflow: hidden; max-width: 480px; width: 100%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.25); border: 1px solid #bfdbfe;
    }
    .lightbox-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe; padding: 12px 18px;
      display: flex; align-items: center; justify-content: space-between;
      .lightbox-title-box {
        display: flex; align-items: center; gap: 8px; color: #1e3a8a; font-weight: 700; font-size: 0.95rem;
        mat-icon { color: #2563eb; font-size: 20px; width: 20px; height: 20px; }
      }
      .lightbox-close-btn { color: #64748b; &:hover { color: #1e293b; } }
    }
    .lightbox-body {
      padding: 16px; display: flex; align-items: center; justify-content: center; background: #0f172a;
      .lightbox-full-img { max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 6px; }
    }
    .card-body { padding:14px; }
    .card-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
    .emp-code { font-size:.78rem; font-weight:700; color:#1976d2; background:#e3f2fd; padding:2px 8px; border-radius:8px; }
    .active-dot { width:10px; height:10px; border-radius:50%; &.active{background:#4caf50;} &.inactive{background:#f44336;} }
    h4 { font-size:1rem; font-weight:700; margin:0 0 2px; color:#1e293b; }
    .spec { font-size:.8rem; color:#1976d2; font-weight:600; margin:0 0 2px; }
    .qual { font-size:.75rem; color:#64748b; margin:0 0 10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .card-meta { display:flex; gap:12px; font-size:.78rem; color:#64748b; margin-bottom:6px;
      span{display:flex;align-items:center;gap:3px;} mat-icon{font-size:14px;width:14px;height:14px;} }
    .card-phone { font-size:.8rem; color:#475569; display:flex; align-items:center; gap:4px;
      mat-icon{font-size:14px;width:14px;height:14px;color:#94a3b8;} }
    .empty-state { grid-column:1/-1; display:flex; flex-direction:column; align-items:center; padding:60px; color:#94a3b8;
      mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px;} }
    .pagination { display:flex; justify-content:center; align-items:center; gap:16px; margin-top:8px;
      span{font-size:.9rem;color:#64748b;} }
    .readonly-field { background:#f8fafc; cursor:not-allowed; color:#64748b; }
    .field-with-hint { display:flex; flex-direction:column; gap:2px; }
    .dup-warning { display:flex; align-items:center; gap:4px; font-size:.78rem; color:#c62828;
      font-weight:600; padding:2px 4px;
      mat-icon{font-size:14px;width:14px;height:14px;} }

    /* =========================================================
       RESPONSIVE DESIGN BREAKPOINTS ACROSS ALL MODES & DEVICES
       ========================================================= */
    @media (max-width: 1200px) {
      .form-grid { grid-template-columns: repeat(3, 1fr) !important; }
    }
    @media (max-width: 900px) {
      .page-header {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 12px;
      }
      .header-actions-row {
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        button { flex: 1 1 auto; justify-content: center; }
      }
      .filter-controls {
        grid-template-columns: 1fr 1fr !important;
        gap: 10px;
        .search-field { grid-column: 1 / -1; }
      }
      .form-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .profile-top {
        gap: 16px;
      }
    }
    @media (max-width: 640px) {
      .form-card { padding: 16px !important; }
      .filter-card { padding: 12px !important; }
      .filter-controls {
        grid-template-columns: 1fr !important;
        gap: 6px;
        .search-field { grid-column: 1; }
      }
      .form-grid {
        grid-template-columns: 1fr !important;
        row-gap: 12px;
      }
      .form-actions {
        flex-direction: column-reverse;
        gap: 8px;
        button { width: 100%; }
      }
      .photo-upload-row {
        flex-direction: column !important;
        align-items: stretch !important;
        padding: 14px !important;
        gap: 12px;
      }
      .photo-preview-box {
        margin: 0 auto;
        width: 72px;
        height: 72px;
      }
      .photo-btn-group {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        .upload-pic-btn {
          width: 100%;
          justify-content: center;
        }
        .upload-note {
          text-align: center;
          display: block;
        }
      }
      .profile-card { padding: 16px !important; }
      .profile-top {
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 14px;
      }
      .profile-title-row, .badges-row, .profile-meta-row {
        justify-content: center;
      }
      .profile-actions {
        flex-direction: column;
        align-items: stretch;
        button, a { width: 100%; justify-content: center; }
        .account-actions-group { width: 100%; }
      }
      .close-profile {
        position: absolute;
        top: 0;
        right: 0;
      }
      .teachers-grid {
        grid-template-columns: 1fr !important;
      }
      .relieved-banner {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
        .banner-btn { width: 100%; }
      }
      .account-drawer-card {
        max-width: 100% !important;
        margin: 10px;
      }
      .account-drawer-footer {
        flex-direction: column-reverse;
        button { width: 100%; }
      }
    }

    /* =========================================================
       SMOOTH DROPDOWN PANEL ANIMATIONS (SELECT & AUTOCOMPLETE)
       ========================================================= */
    ::ng-deep .mat-mdc-autocomplete-panel,
    ::ng-deep .mat-mdc-select-panel {
      border-radius: 12px !important;
      box-shadow: 0 16px 36px -4px rgba(37, 99, 235, 0.2), 0 4px 12px -2px rgba(15, 23, 42, 0.08) !important;
      border: 1px solid #bfdbfe !important;
      background: #ffffff !important;
      padding: 6px !important;
      animation: smoothPanelSlide 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important;
      transform-origin: top center !important;
    }

    @keyframes smoothPanelSlide {
      0% {
        opacity: 0;
        transform: translateY(-8px) scale(0.97);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    ::ng-deep .mat-mdc-option {
      border-radius: 8px !important;
      margin-bottom: 2px !important;
      font-size: 0.86rem !important;
      min-height: 40px !important;
      transition: background 0.15s ease, color 0.15s ease !important;
      &:hover {
        background: #eff6ff !important;
        color: #1d4ed8 !important;
      }
      &.mdc-list-item--selected:not(.mdc-list-item--disabled) {
        background: #dbeafe !important;
        color: #1e40af !important;
        font-weight: 600 !important;
      }
    }
  `]
})
export class TeacherProfilesComponent implements OnInit {
  private api = API_BASE;
  teachers: TeacherDto[] = [];
  selectedTeacher: TeacherDto | null = null;
  loading = false; saving = false; codeLoading = false;
  allowManualCode = false;
  searchTerm = ''; filterActive: boolean | null = null;
  filterStaffType: 'All' | 'Teaching' | 'NonTeaching' = 'All';
  pageNumber = 1; pageSize = 12; totalCount = 0;
  showForm = false; editingId: string | null = null;
  teacherForm!: FormGroup;
  imgLoadErrors: { [id: string]: boolean } = {};
  previewImgError = false;
  previewPhotoUrl: string | null = null;
  previewPhotoTitle = '';

  // Suggestions for Autocomplete
  bankList: string[] = [
    'State Bank of India (SBI)', 'HDFC Bank', 'ICICI Bank', 'Punjab National Bank (PNB)',
    'Bank of Baroda', 'Axis Bank', 'Canara Bank', 'Union Bank of India',
    'Kotak Mahindra Bank', 'IndusInd Bank', 'Bank of India', 'Indian Bank',
    'Central Bank of India', 'IDBI Bank', 'Yes Bank', 'Federal Bank'
  ];
  departmentList: string[] = [
    'Science Department', 'Mathematics Department', 'Humanities & Arts', 'Commerce & Economics',
    'Computer Science & IT', 'Primary Wing', 'Secondary Wing', 'Administration & Management',
    'Human Resources', 'Accounts & Finance', 'Library Division', 'Front Office & Reception',
    'Transport & Fleet', 'Hostel & Maintenance'
  ];
  designationList: string[] = [
    'PGT (Post Graduate Teacher)', 'TGT (Trained Graduate Teacher)', 'PRT (Primary Teacher)',
    'Head of Department (HOD)', 'Senior Lecturer / Faculty', 'Assistant Teacher',
    'Principal', 'Vice Principal', 'Academic Coordinator',
    'HR Manager', 'Chief Accountant', 'Accountant', 'Cashier / Billing Clerk',
    'Front Desk Executive', 'Librarian', 'Lab Assistant', 'IT Administrator',
    'Transport Supervisor', 'Security / Guard', 'Peon / Attendant'
  ];

  get filteredBanks(): string[] {
    const q = (this.teacherForm?.get('bankName')?.value || '').toLowerCase().trim();
    if (!q) return this.bankList;
    return this.bankList.filter(b => b.toLowerCase().includes(q));
  }
  get filteredDepartments(): string[] {
    const q = (this.teacherForm?.get('department')?.value || '').toLowerCase().trim();
    if (!q) return this.departmentList;
    return this.departmentList.filter(d => d.toLowerCase().includes(q));
  }
  get filteredDesignations(): string[] {
    const q = (this.teacherForm?.get('designation')?.value || '').toLowerCase().trim();
    if (!q) return this.designationList;
    return this.designationList.filter(d => d.toLowerCase().includes(q));
  }

  // Duplicate check state
  phoneDuplicate = false; phoneDupChecking = false;
  whatsAppDuplicate = false; whatsAppDupChecking = false;
  emailDuplicate = false; emailDupChecking = false;
  systemRoles: any[] = [];

  get totalPages() { return Math.ceil(this.totalCount / this.pageSize); }
  get hasDuplicates() { return this.phoneDuplicate || this.whatsAppDuplicate || this.emailDuplicate; }

  // Date Range Validation Getters
  get maxDob(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split('T')[0];
  }

  get minDob(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 75);
    return d.toISOString().split('T')[0];
  }

  get maxDoj(): string {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().split('T')[0];
  }

  get minDoj(): string {
    const dobVal = this.teacherForm?.get('dateOfBirth')?.value;
    if (dobVal) {
      const d = new Date(dobVal);
      d.setFullYear(d.getFullYear() + 18);
      return d.toISOString().split('T')[0];
    }
    return '1990-01-01';
  }

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private confirmDialog: ConfirmDialogService,
    private dialog: MatDialog,
    public authService: AuthService
  ) { }

  /** True when the logged-in user is only a Teacher (self-service mode) */
  get isTeacherRole(): boolean { return this.authService.isTeacher(); }

  /** True when Admin or HR — full staff management is allowed */
  get canManageStaff(): boolean { return this.authService.canManageStaff(); }

  isTeachingStaff(t: TeacherDto | null): boolean {
    if (!t) return false;
    return t.staffType !== 'NonTeaching' && t.staffType !== 2;
  }

  ngOnInit() {
    this.initForm();
    this.loadTeachers();
    this.loadRoles();
  }

  loadRoles() {
    this.http.get<any[]>(`${this.api}/roles`).subscribe({
      next: r => this.systemRoles = r || [],
      error: () => this.systemRoles = []
    });
  }

  initForm() {
    const today = new Date().toISOString().split('T')[0];
    this.teacherForm = this.fb.group({
      staffType: [1, Validators.required],
      employeeCode: [{ value: '', disabled: false }, Validators.required],
      fullName: ['', Validators.required],
      department: [''],
      designation: [''],
      employmentType: ['Permanent'],
      fatherName: [''],
      gender: ['Male', Validators.required],
      dateOfBirth: [''],
      bloodGroup: [''],
      qualification: [''],
      specialization: [''],
      experienceYears: [0, [Validators.min(0)]],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{10,12}$/)]],
      whatsAppPhone: ['', [Validators.pattern(/^[0-9]{10,12}$/)]],
      email: ['', [Validators.email]],
      emergencyContactName: [''],
      emergencyContactPhone: ['', [Validators.pattern(/^[0-9]{10,12}$/)]],
      address: [''],
      photoUrl: [''],
      joiningDate: [today, Validators.required],
      biometricUserId: [''],
      // Bank & Payroll Details
      bankName: [''],
      bankAccountNumber: [''],
      bankIfscCode: [''],
      bankAccountHolder: [''],
      panNumber: ['', [Validators.pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i)]],
      aadhaarNumber: ['', [Validators.pattern(/^[0-9]{12}$/)]],
      uanNumber: ['']
    });
  }

  validateDateRanges(): boolean {
    const dobVal = this.teacherForm.get('dateOfBirth')?.value;
    const dojVal = this.teacherForm.get('joiningDate')?.value;

    let isValid = true;

    // Validate DOB (must be at least 18 years old)
    if (dobVal) {
      const dob = new Date(dobVal);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
      }

      if (age < 18) {
        this.teacherForm.get('dateOfBirth')?.setErrors({ underage: true });
        isValid = false;
      } else if (age > 80) {
        this.teacherForm.get('dateOfBirth')?.setErrors({ tooOld: true });
        isValid = false;
      } else {
        if (this.teacherForm.get('dateOfBirth')?.hasError('underage') || this.teacherForm.get('dateOfBirth')?.hasError('tooOld')) {
          this.teacherForm.get('dateOfBirth')?.setErrors(null);
        }
      }
    }

    // Validate DOJ (cannot be before 18th birthday)
    if (dojVal) {
      const doj = new Date(dojVal);
      if (dobVal) {
        const dob = new Date(dobVal);
        dob.setFullYear(dob.getFullYear() + 18);
        if (doj < dob) {
          this.teacherForm.get('joiningDate')?.setErrors({ beforeAdult: true });
          isValid = false;
        }
      }
      const maxFuture = new Date();
      maxFuture.setDate(maxFuture.getDate() + 90);
      if (doj > maxFuture) {
        this.teacherForm.get('joiningDate')?.setErrors({ futureTooFar: true });
        isValid = false;
      }
    }

    return isValid;
  }

  copyPhoneToWhatsApp() {
    const ph = this.teacherForm.get('phoneNumber')?.value;
    if (ph) {
      this.teacherForm.patchValue({ whatsAppPhone: ph });
      this.checkDuplicate('whatsApp');
    }
  }

  getInitials(name: string): string {
    if (!name) return 'ST';
    const clean = name.replace(/[()[\]{}_-]/g, ' ').replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const parts = clean.split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 0) return 'ST';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  getPhotoUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    return `http://localhost:5000${url.startsWith('/') ? '' : '/'}${url}`;
  }

  openPhotoPreview(url: string, title: string) {
    this.previewPhotoUrl = url;
    this.previewPhotoTitle = title;
  }

  onFileSelected(event: any) {
    const file = event.target?.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.confirmDialog.alert('Image Size', 'Image file size must be less than 2MB.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.previewImgError = false;
      this.teacherForm.patchValue({ photoUrl: e.target.result });
    };
    reader.readAsDataURL(file);
  }

  onQuickAvatarSelected(event: any, teacher: TeacherDto) {
    const file = event.target?.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.confirmDialog.alert('Image Size', 'Image file size must be less than 2MB.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const base64 = e.target.result;
      const payload: any = {
        employeeCode: teacher.employeeCode,
        fullName: teacher.fullName,
        fatherName: teacher.fatherName,
        gender: teacher.gender || 'Male',
        dateOfBirth: teacher.dateOfBirth,
        qualification: teacher.qualification,
        specialization: teacher.specialization,
        experienceYears: teacher.experienceYears,
        phoneNumber: teacher.phoneNumber,
        whatsAppPhone: teacher.whatsAppPhone,
        email: teacher.email,
        address: teacher.address,
        photoUrl: base64,
        joiningDate: teacher.joiningDate,
        isActive: teacher.isActive,
        branchId: teacher.branchId,
        staffType: (teacher.staffType === 'NonTeaching' || teacher.staffType === 2) ? 'NonTeaching' : 'Teaching',
        department: teacher.department,
        designation: teacher.designation,
        bankName: teacher.bankName,
        bankAccountNumber: teacher.bankAccountNumber,
        bankIfscCode: teacher.bankIfscCode,
        bankAccountHolder: teacher.bankAccountHolder,
        panNumber: teacher.panNumber,
        aadhaarNumber: teacher.aadhaarNumber,
        uanNumber: teacher.uanNumber,
        employmentType: teacher.employmentType,
        bloodGroup: teacher.bloodGroup,
        emergencyContactName: teacher.emergencyContactName,
        emergencyContactPhone: teacher.emergencyContactPhone,
        biometricUserId: teacher.biometricUserId
      };
      this.http.put<TeacherDto>(`${this.api}/teachers/${teacher.id}`, payload).subscribe({
        next: (updated) => {
          teacher.photoUrl = updated.photoUrl;
          delete this.imgLoadErrors[teacher.id];
          const idx = this.teachers.findIndex(t => t.id === teacher.id);
          if (idx !== -1) {
            this.teachers[idx].photoUrl = updated.photoUrl;
          }
          this.confirmDialog.alert('Profile Photo', 'Profile photo updated successfully!', 'success');
        },
        error: () => {
          this.confirmDialog.alert('Upload Failed', 'Failed to update profile photo.', 'danger');
        }
      });
    };
    reader.readAsDataURL(file);
  }

  loadTeachers() {
    this.loading = true;
    let params = new HttpParams()
      .set('pageNumber', this.pageNumber).set('pageSize', this.pageSize)
      .set('searchTerm', this.searchTerm).set('sortBy', 'fullName');
    if (this.filterActive !== null) params = params.set('isActive', this.filterActive);
    if (this.filterStaffType && this.filterStaffType !== 'All') {
      params = params.set('staffType', this.filterStaffType);
    }
    this.http.get<any>(`${this.api}/teachers/paged`, { params }).subscribe({
      next: r => { this.teachers = r.items; this.totalCount = r.totalCount; this.loading = false; },
      error: () => this.loading = false
    });
  }

  onSearch() { this.pageNumber = 1; this.loadTeachers(); }
  changePage(dir: number) { this.pageNumber += dir; this.loadTeachers(); }

  selectTeacher(t: TeacherDto) {
    this.selectedTeacher = this.selectedTeacher?.id === t.id ? null : t;
  }

  onStaffTypeChange(type: number) {
    if (!this.editingId && !this.allowManualCode) {
      this.generateEmployeeCode(type);
    }
  }

  toggleCustomCode() {
    if (this.editingId) return;
    this.allowManualCode = !this.allowManualCode;
    if (!this.allowManualCode) {
      const type = this.teacherForm.get('staffType')?.value || 1;
      this.generateEmployeeCode(type);
    }
  }

  generateEmployeeCode(typeVal: number) {
    if (this.editingId) return;
    this.codeLoading = true;
    this.http.get<{ code: string }>(`${this.api}/teachers/next-employee-code?staffType=${typeVal}`).subscribe({
      next: r => { this.teacherForm.patchValue({ employeeCode: r.code }); this.codeLoading = false; },
      error: () => {
        this.codeLoading = false;
        this.confirmDialog.alert('Employee Code', 'Auto code generation failed. Please enter code manually.', 'warning');
      }
    });
  }

  openAddForm() {
    this.editingId = null; this.showForm = true; this.selectedTeacher = null;
    this.phoneDuplicate = false; this.whatsAppDuplicate = false; this.emailDuplicate = false;
    this.previewImgError = false;
    this.allowManualCode = false;
    this.teacherForm.reset({
      staffType: 1,
      gender: 'Male',
      employmentType: 'Permanent',
      experienceYears: 0,
      photoUrl: '',
      joiningDate: new Date().toISOString().split('T')[0]
    });
    this.generateEmployeeCode(1);
  }

  editTeacher(t: TeacherDto) {
    this.editingId = t.id; this.showForm = true;
    this.phoneDuplicate = false; this.whatsAppDuplicate = false; this.emailDuplicate = false;
    this.previewImgError = false;
    this.allowManualCode = false;
    this.teacherForm.patchValue({
      ...t,
      staffType: (t.staffType === 'NonTeaching' || t.staffType === 2) ? 2 : 1,
      department: t.department || '',
      designation: t.designation || '',
      employmentType: t.employmentType || 'Permanent',
      bloodGroup: t.bloodGroup || '',
      emergencyContactName: t.emergencyContactName || '',
      emergencyContactPhone: t.emergencyContactPhone || '',
      biometricUserId: t.biometricUserId || '',
      bankName: t.bankName || '',
      bankAccountNumber: t.bankAccountNumber || '',
      bankIfscCode: t.bankIfscCode || '',
      bankAccountHolder: t.bankAccountHolder || '',
      panNumber: t.panNumber || '',
      aadhaarNumber: t.aadhaarNumber || '',
      uanNumber: t.uanNumber || '',
      photoUrl: t.photoUrl || '',
      joiningDate: t.joiningDate?.split('T')[0],
      dateOfBirth: t.dateOfBirth?.split('T')[0]
    });
  }

  cancelForm() {
    this.showForm = false;
    this.editingId = null;
    this.phoneDuplicate = false;
    this.whatsAppDuplicate = false;
    this.emailDuplicate = false;
    this.previewImgError = false;
  }

  /** Called on blur of phone, whatsApp, or email fields */
  checkDuplicate(field: 'phone' | 'whatsApp' | 'email') {
    const phone = this.teacherForm.get('phoneNumber')?.value?.trim();
    const whatsApp = this.teacherForm.get('whatsAppPhone')?.value?.trim();
    const email = this.teacherForm.get('email')?.value?.trim();

    if (field === 'phone' && !phone) { this.phoneDuplicate = false; return; }
    if (field === 'whatsApp' && !whatsApp) { this.whatsAppDuplicate = false; return; }
    if (field === 'email' && !email) { this.emailDuplicate = false; return; }

    if (field === 'phone') this.phoneDupChecking = true;
    if (field === 'whatsApp') this.whatsAppDupChecking = true;
    if (field === 'email') this.emailDupChecking = true;

    let params = new HttpParams();
    if (field === 'phone' && phone) params = params.set('phone', phone);
    if (field === 'whatsApp' && whatsApp) params = params.set('whatsApp', whatsApp);
    if (field === 'email' && email) params = params.set('email', email);
    if (this.editingId) params = params.set('excludeId', this.editingId);

    this.http.get<{ phoneExists: boolean; emailExists: boolean; whatsAppExists?: boolean }>(
      `${this.api}/teachers/check-duplicate`, { params }
    ).subscribe({
      next: r => {
        if (field === 'phone') { this.phoneDuplicate = !!r.phoneExists; this.phoneDupChecking = false; }
        if (field === 'whatsApp') { this.whatsAppDuplicate = !!r.whatsAppExists; this.whatsAppDupChecking = false; }
        if (field === 'email') { this.emailDuplicate = !!r.emailExists; this.emailDupChecking = false; }
      },
      error: () => {
        this.phoneDupChecking = false;
        this.whatsAppDupChecking = false;
        this.emailDupChecking = false;
      }
    });
  }

  saveTeacher() {
    if (!this.validateDateRanges()) {
      this.confirmDialog.alert('Date Range Invalid', 'Please check Date of Birth (must be 18+ years) and Joining Date.', 'warning');
      return;
    }

    if (this.teacherForm.invalid || this.hasDuplicates) {
      if (this.hasDuplicates) {
        this.confirmDialog.alert('Duplicate Information', 'Phone, WhatsApp, or Email address is already registered with another staff member.', 'warning');
      }
      return;
    }

    this.saving = true;
    const val = { ...this.teacherForm.getRawValue() }; // includes readonly employeeCode
    val.staffType = val.staffType == 1 ? 'Teaching' : 'NonTeaching';
    if (val.bankIfscCode) val.bankIfscCode = val.bankIfscCode.trim().toUpperCase();
    if (val.panNumber) val.panNumber = val.panNumber.trim().toUpperCase();

    const req = this.editingId
      ? this.http.put<TeacherDto>(`${this.api}/teachers/${this.editingId}`, val)
      : this.http.post<TeacherDto>(`${this.api}/teachers`, val);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.cancelForm();
        this.loadTeachers();
        this.confirmDialog.alert('Success', 'Staff / Faculty profile saved successfully!', 'success');
      },
      error: e => {
        this.saving = false;
        this.confirmDialog.alert('Error', e?.error?.message || 'Error saving profile.', 'danger');
      }
    });
  }

  // ── Account Modal Properties ──
  showAccountModal = false;
  accountSaving = false;
  accountTeacher: TeacherDto | null = null;
  accountFormData: { username: string; password: string; roleId?: string } = { username: '', password: '', roleId: '' };

  openCreateAccountDialog(t: TeacherDto) {
    this.accountTeacher = t;
    const cleanPrefix = t.fullName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanEmp = t.employeeCode.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Pick suitable default role
    let defaultRoleId = '';
    const isNonTeaching = t.staffType === 'NonTeaching' || t.staffType === 2;
    if (this.systemRoles.length > 0) {
      if (isNonTeaching) {
        const deptOrDesig = `${t.department || ''} ${t.designation || ''}`.toLowerCase();
        let matched = this.systemRoles.find(r => r.name.toLowerCase().includes('accountant') && deptOrDesig.includes('account'));
        if (!matched) matched = this.systemRoles.find(r => r.name.toLowerCase().includes('hr') && deptOrDesig.includes('hr'));
        if (!matched) matched = this.systemRoles.find(r => r.name.toLowerCase().includes('admin') && deptOrDesig.includes('admin'));
        if (!matched) matched = this.systemRoles.find(r => r.name.toLowerCase().includes('staff') || r.name.toLowerCase().includes('manager'));
        defaultRoleId = (matched || this.systemRoles[0]).id;
      } else {
        const teacherRole = this.systemRoles.find(r => r.name.toLowerCase().includes('teacher') || r.name.toLowerCase().includes('faculty'));
        defaultRoleId = (teacherRole || this.systemRoles[0]).id;
      }
    }

    this.accountFormData = {
      username: `${cleanPrefix}.${cleanEmp}`,
      password: `Staff@${new Date().getFullYear()}`,
      roleId: defaultRoleId
    };
    this.showAccountModal = true;
  }

  closeAccountModal() {
    this.showAccountModal = false;
    this.accountTeacher = null;
  }

  saveAccount() {
    if (!this.accountTeacher || !this.accountFormData.username || !this.accountFormData.password) return;
    this.accountSaving = true;

    this.http.post<any>(`${this.api}/teachers/${this.accountTeacher.id}/create-user`, this.accountFormData).subscribe({
      next: (res) => {
        this.accountSaving = false;
        if (this.accountTeacher) {
          this.accountTeacher.hasLoginAccount = true;
          this.accountTeacher.username = this.accountFormData.username;
        }
        if (this.selectedTeacher && this.selectedTeacher.id === this.accountTeacher?.id) {
          this.selectedTeacher.hasLoginAccount = true;
          this.selectedTeacher.username = this.accountFormData.username;
        }
        this.closeAccountModal();
        this.loadTeachers();
        this.confirmDialog.alert('Account Created', `Login account created successfully for @${this.accountFormData.username}!`, 'success');
      },
      error: (err) => {
        this.accountSaving = false;
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to create user account.', 'danger');
      }
    });
  }

  openBulkIdCards() {
    this.dialog.open(TeacherIdCardDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      data: {}
    });
  }

  openSingleIdCard(teacher: TeacherDto) {
    this.dialog.open(TeacherIdCardDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      data: { teacherId: teacher.id, teacherName: teacher.fullName }
    });
  }

  openDocumentsModal(teacher: TeacherDto) {
    this.dialog.open(TeacherDocumentsDialogComponent, {
      width: '750px',
      maxWidth: '95vw',
      data: { teacherId: teacher.id, teacherName: teacher.fullName, employeeCode: teacher.employeeCode }
    });
  }

  deleteTeacher(id: string) {
    this.confirmDialog.danger('Delete Teacher', 'Are you sure you want to remove this teacher profile?').subscribe(confirmed => {
      if (!confirmed) return;
      this.http.delete(`${this.api}/teachers/${id}`).subscribe({
        next: () => {
          this.selectedTeacher = null;
          this.loadTeachers();
          this.confirmDialog.alert('Teacher Removed', 'Teacher profile removed successfully.', 'info');
        },
        error: e => this.confirmDialog.alert('Error', e?.error?.message || 'Failed to remove teacher.', 'danger')
      });
    });
  }
}
