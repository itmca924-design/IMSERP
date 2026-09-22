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

@Component({
  selector: 'app-teacher-profiles',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatSelectModule, MatProgressBarModule,
    MatProgressSpinnerModule, MatTooltipModule, MatDividerModule, MatDialogModule
  ],
  template: `
<div class="page-container">
  <div class="page-header">
    <div>
      <h1 class="page-title"><mat-icon>person</mat-icon> Teacher Profiles</h1>
      <p class="page-subtitle">Sab teachers ki profile — add, edit, aur manage karo.</p>
    </div>
    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
      <button mat-stroked-button color="primary" (click)="openBulkIdCards()" *ngIf="!showForm">
        <mat-icon>badge</mat-icon> Staff ID Cards
      </button>
      <a mat-stroked-button color="warn" [routerLink]="['/teachers/fnf']" *ngIf="!showForm">
        <mat-icon>exit_to_app</mat-icon> Exit & FNF
      </a>
      <button mat-raised-button color="primary" (click)="openAddForm()" *ngIf="!showForm">
        <mat-icon>person_add</mat-icon> Add Teacher
      </button>
    </div>
  </div>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <!-- ── ADD / EDIT FORM ── -->
  <mat-card class="form-card mat-elevation-z3" *ngIf="showForm">
    <div class="form-header">
      <h2><mat-icon color="primary">{{editingId ? 'edit' : 'person_add'}}</mat-icon>
        {{editingId ? 'Teacher Edit Karo' : 'Naya Teacher Add Karo'}}
      </h2>
      <button mat-icon-button (click)="cancelForm()"><mat-icon>close</mat-icon></button>
    </div>
    <form [formGroup]="teacherForm" (ngSubmit)="saveTeacher()">
      <div class="form-grid">
        <!-- Employee Code – Auto Generated, Readonly -->
        <mat-form-field appearance="outline">
          <mat-label>Employee Code</mat-label>
          <input matInput formControlName="employeeCode" readonly class="readonly-field">
          <mat-icon matSuffix *ngIf="!codeLoading" matTooltip="Auto-generated, edit not allowed"
            style="color:#64748b;font-size:16px">lock</mat-icon>
          <mat-spinner matSuffix diameter="16" *ngIf="codeLoading"></mat-spinner>
          <mat-hint>Auto-generated hai – {{editingId ? 'edit mein nahi badlega' : 'save hone pe lock ho jata hai'}}</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Full Name *</mat-label>
          <input matInput formControlName="fullName">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Father's Name</mat-label>
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
        <mat-form-field appearance="outline">
          <mat-label>Date of Birth</mat-label>
          <input matInput type="date" formControlName="dateOfBirth">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Qualification</mat-label>
          <input matInput formControlName="qualification" placeholder="M.Sc Physics, B.Ed">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Specialization</mat-label>
          <input matInput formControlName="specialization" placeholder="Physics, Math...">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Experience (Years)</mat-label>
          <input matInput type="number" formControlName="experienceYears" min="0">
        </mat-form-field>
        <!-- Phone with inline duplicate check -->
        <div class="field-with-hint">
          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>Phone Number *</mat-label>
            <input matInput formControlName="phoneNumber"
              (blur)="checkDuplicate('phone')">
            <mat-icon matSuffix *ngIf="phoneDupChecking" style="font-size:16px">hourglass_empty</mat-icon>
            <mat-icon matSuffix *ngIf="!phoneDupChecking && phoneDuplicate" color="warn" style="font-size:16px">warning</mat-icon>
            <mat-icon matSuffix *ngIf="!phoneDupChecking && !phoneDuplicate && teacherForm.get('phoneNumber')?.value"
              style="font-size:16px;color:#2e7d32">check_circle</mat-icon>
          </mat-form-field>
          <div class="dup-warning" *ngIf="phoneDuplicate">
            <mat-icon>warning</mat-icon> Yeh phone number pehle se registered hai!
          </div>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>WhatsApp Number</mat-label>
          <input matInput formControlName="whatsAppPhone">
        </mat-form-field>
        <!-- Email with inline duplicate check -->
        <div class="field-with-hint">
          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email"
              (blur)="checkDuplicate('email')">
            <mat-icon matSuffix *ngIf="emailDupChecking" style="font-size:16px">hourglass_empty</mat-icon>
            <mat-icon matSuffix *ngIf="!emailDupChecking && emailDuplicate" color="warn" style="font-size:16px">warning</mat-icon>
            <mat-icon matSuffix *ngIf="!emailDupChecking && !emailDuplicate && teacherForm.get('email')?.value"
              style="font-size:16px;color:#2e7d32">check_circle</mat-icon>
          </mat-form-field>
          <div class="dup-warning" *ngIf="emailDuplicate">
            <mat-icon>warning</mat-icon> Yeh email pehle se registered hai!
          </div>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Joining Date *</mat-label>
          <input matInput type="date" formControlName="joiningDate">
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Address</mat-label>
          <input matInput formControlName="address">
        </mat-form-field>
      </div>
      <div class="form-actions">
        <button mat-button type="button" (click)="cancelForm()">Cancel</button>
        <button mat-raised-button color="primary" type="submit" [disabled]="teacherForm.invalid || saving">
          <mat-spinner diameter="18" *ngIf="saving" style="display:inline-block;margin-right:6px"></mat-spinner>
          <mat-icon *ngIf="!saving">save</mat-icon>
          {{saving ? 'Saving...' : (editingId ? 'Update Teacher' : 'Add Teacher')}}
        </button>
      </div>
    </form>
  </mat-card>

  <!-- ── SEARCH & FILTER ── -->
  <mat-card class="filter-card mat-elevation-z1" *ngIf="!showForm">
    <div class="filter-heading">
      <div class="filter-title"><mat-icon>filter_list</mat-icon><strong>Teacher Directory</strong></div>
      <span class="total-count">{{totalCount}} teachers</span>
    </div>
    <div class="filter-controls">
      <mat-form-field appearance="outline" class="search-field">
        <mat-label>Teachers search karo...</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [(ngModel)]="searchTerm" (ngModelChange)="onSearch()" placeholder="Name, code, specialization...">
        <button mat-icon-button matSuffix *ngIf="searchTerm" (click)="searchTerm=''; loadTeachers()">
          <mat-icon>clear</mat-icon>
        </button>
      </mat-form-field>
      <mat-form-field appearance="outline" class="status-field">
        <mat-label>Status</mat-label>
        <mat-select [(ngModel)]="filterActive" (ngModelChange)="loadTeachers()">
          <mat-option [value]="null">Sab Teachers</mat-option>
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
        <div class="avatar-circle">{{getInitials(selectedTeacher.fullName)}}</div>
        <div class="profile-info">
          <h2>{{selectedTeacher.fullName}}</h2>
          <span class="emp-badge">{{selectedTeacher.employeeCode}}</span>
          <span class="status-chip" [class.active]="selectedTeacher.isActive" [class.inactive]="!selectedTeacher.isActive">
            {{selectedTeacher.isActive ? 'Active' : 'Inactive'}}
          </span>
          <p class="spec-text">{{selectedTeacher.specialization || 'No Specialization'}}</p>
          <p class="qual-text">{{selectedTeacher.qualification || ''}}</p>
        </div>
        <button mat-icon-button (click)="selectedTeacher = null" class="close-profile">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-divider></mat-divider>

      <div class="profile-details">
        <div class="detail-row"><mat-icon>phone</mat-icon><span>{{selectedTeacher.phoneNumber}}</span></div>
        <div class="detail-row" *ngIf="selectedTeacher.email"><mat-icon>email</mat-icon><span>{{selectedTeacher.email}}</span></div>
        <div class="detail-row"><mat-icon>work</mat-icon><span>{{selectedTeacher.experienceYears}} years experience</span></div>
        <div class="detail-row"><mat-icon>calendar_today</mat-icon><span>Joined: {{selectedTeacher.joiningDate | date:'dd MMM yyyy'}}</span></div>
        <div class="detail-row" *ngIf="selectedTeacher.address"><mat-icon>location_on</mat-icon><span>{{selectedTeacher.address}}</span></div>
      </div>

      <mat-divider></mat-divider>

      <!-- Quick Navigation to Sub-Pages -->
      <div class="quick-nav">
        <p class="quick-nav-title">Directly Jaao →</p>
        <div class="quick-nav-grid">
          <a mat-stroked-button [routerLink]="['/teachers/assignments']" [queryParams]="{teacherId: selectedTeacher.id}">
            <mat-icon>class</mat-icon> Batch Assignments
          </a>
          <a mat-stroked-button [routerLink]="['/teachers/attendance']" [queryParams]="{teacherId: selectedTeacher.id}">
            <mat-icon>event_available</mat-icon> Attendance
          </a>
          <a mat-stroked-button [routerLink]="['/teachers/salary']" [queryParams]="{teacherId: selectedTeacher.id}">
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
          <a mat-stroked-button [routerLink]="['/teachers/substitution']">
            <mat-icon>swap_horiz</mat-icon> Proxy &amp; Substitution
          </a>
          <a mat-stroked-button [routerLink]="['/teachers/lesson-plans']" [queryParams]="{teacherId: selectedTeacher.id}">
            <mat-icon>menu_book</mat-icon> Lesson Diary
          </a>
          <a mat-stroked-button [routerLink]="['/transport']" style="color: #2563eb; border-color: #93c5fd;">
            <mat-icon style="color: #2563eb;">directions_bus</mat-icon> Transport Pass
          </a>
          <a mat-stroked-button [routerLink]="['/hostel']" style="color: #4f46e5; border-color: #c7d2fe;">
            <mat-icon style="color: #4f46e5;">apartment</mat-icon> Staff Quarters
          </a>
          <a mat-stroked-button [routerLink]="['/library/circulation']" style="color: #059669; border-color: #a7f3d0;">
            <mat-icon style="color: #059669;">local_library</mat-icon> Library Account
          </a>
          <a mat-stroked-button [routerLink]="['/teachers/fnf']" [queryParams]="{teacherId: selectedTeacher.id}" style="color: #dc2626; border-color: #fca5a5;">
            <mat-icon style="color: #dc2626;">exit_to_app</mat-icon> Exit / FNF
          </a>
        </div>
      </div>

      <mat-divider></mat-divider>

      <div class="profile-actions">
        <div class="account-actions-group">
          <div class="user-account-badge" *ngIf="selectedTeacher.hasLoginAccount">
            <mat-icon>verified_user</mat-icon>
            <span>ERP Login Active: <strong>&#64;{{selectedTeacher.username}}</strong></span>
          </div>
          <button mat-stroked-button color="accent" *ngIf="!selectedTeacher.hasLoginAccount" (click)="openCreateAccountDialog(selectedTeacher)">
            <mat-icon>person_add_alt</mat-icon> Create ERP Login
          </button>
        </div>
        <button mat-stroked-button color="primary" (click)="openSingleIdCard(selectedTeacher)">
          <mat-icon>badge</mat-icon> Staff ID Card
        </button>
        <button mat-stroked-button color="accent" (click)="openDocumentsModal(selectedTeacher)">
          <mat-icon>folder_shared</mat-icon> KYC &amp; Docs
        </button>
        <a mat-stroked-button color="warn" [routerLink]="['/teachers/fnf']" [queryParams]="{teacherId: selectedTeacher.id}">
          <mat-icon>exit_to_app</mat-icon> Exit / FNF Settlement
        </a>
        <button mat-raised-button color="primary" (click)="editTeacher(selectedTeacher)">
          <mat-icon>edit</mat-icon> Edit Profile
        </button>
        <button mat-raised-button color="warn" (click)="deleteTeacher(selectedTeacher.id)">
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
      <div class="card-avatar">{{getInitials(t.fullName)}}</div>
      <div class="card-body">
        <div class="card-top">
          <span class="emp-code">{{t.employeeCode}}</span>
          <span class="login-badge-chip" *ngIf="t.hasLoginAccount" [matTooltip]="'ERP Login Active (@' + (t.username || '') + ')'">
            <mat-icon>vpn_key</mat-icon>
          </span>
          <span class="active-dot" [class.active]="t.isActive" [class.inactive]="!t.isActive"></span>
        </div>
        <h4>{{t.fullName}}</h4>
        <p class="spec">{{t.specialization || 'No Specialization'}}</p>
        <p class="qual">{{t.qualification || ''}}</p>
        <div class="card-meta">
          <span><mat-icon>class</mat-icon>{{t.assignedBatchCount}} Batches</span>
          <span><mat-icon>work_history</mat-icon>{{t.experienceYears}}y exp</span>
        </div>
        <div class="card-phone"><mat-icon>phone</mat-icon>{{t.phoneNumber}}</div>
      </div>
    </mat-card>

    <div class="empty-state" *ngIf="teachers.length === 0 && !loading">
      <mat-icon>person_off</mat-icon>
      <p>Koi teacher nahi mila. "Add Teacher" click karo.</p>
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
          <h3>Create Teacher ERP Login</h3>
          <p>Set up portal login credentials for <strong>{{accountTeacher?.fullName}}</strong></p>
        </div>
        <button mat-icon-button (click)="closeAccountModal()"><mat-icon>close</mat-icon></button>
      </div>
      <div class="account-drawer-body">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Login Username *</mat-label>
          <input matInput [(ngModel)]="accountFormData.username" placeholder="e.g. rahul.sharma" />
          <mat-hint>Teacher will use this to sign into IMSERP</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width" style="margin-top: 14px;">
          <mat-label>Initial Password *</mat-label>
          <input matInput type="text" [(ngModel)]="accountFormData.password" placeholder="e.g. Teacher@123" />
          <mat-hint>Teacher can change this after logging in</mat-hint>
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
</div>
  `,
  styles: [`
    .page-container { display:flex; flex-direction:column; gap:20px; }
    .page-header { display:flex; justify-content:space-between; align-items:center; }
    .page-title { font-size:1.5rem; font-weight:700; margin:0; color:#1976d2; display:flex; align-items:center; gap:8px;
      mat-icon { font-size:1.5rem; width:1.5rem; height:1.5rem; } }
    .page-subtitle { color:#666; margin:4px 0 0; font-size:.9rem; }
    .form-card { padding:24px; border-radius:12px; }
    .form-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;
      h2 { display:flex; align-items:center; gap:8px; font-size:1.1rem; font-weight:700; margin:0; } }
    .form-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:0 16px; }
    .full-width { grid-column:1/-1; }
    .form-actions { display:flex; justify-content:flex-end; gap:12px; margin-top:8px; }
    .filter-card { padding:14px 18px 8px; border-radius:10px; display:flex; flex-direction:column; gap:6px; }
    .filter-heading { display:flex; align-items:center; justify-content:space-between; min-height:24px; }
    .filter-title { display:flex; align-items:center; gap:7px; color:#1e3a8a; font-size:.9rem; }
    .filter-title mat-icon { font-size:19px; width:19px; height:19px; color:#2563eb; }
    .total-count { color:#64748b; font-size:.78rem; font-weight:600; }
    .filter-controls { display:grid; grid-template-columns:minmax(260px, 1fr) 180px; gap:14px; align-items:center; }
    .search-field, .status-field { width:100%; }

    @media (max-width: 640px) {
      .filter-controls { grid-template-columns:1fr; gap:4px; }
    }
    .total-count { font-size:.85rem; color:#64748b; margin-left:auto; }
    /* Profile View */
    .profile-view { }
    .profile-card { padding:24px; border-radius:12px; }
    .profile-top { display:flex; align-items:flex-start; gap:20px; margin-bottom:16px; position:relative; }
    .avatar-circle { width:72px; height:72px; border-radius:50%; background:linear-gradient(135deg,#1976d2,#42a5f5);
      color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.6rem; font-weight:700; flex-shrink:0; }
    .profile-info { flex:1; h2{margin:0 0 6px;font-size:1.2rem;font-weight:700;} }
    .emp-badge { background:#e3f2fd; color:#1565c0; padding:2px 10px; border-radius:12px; font-size:.78rem; font-weight:700; }
    .status-chip { padding:2px 10px; border-radius:12px; font-size:.75rem; font-weight:600; margin-left:6px;
      &.active{background:#e8f5e9;color:#2e7d32;} &.inactive{background:#ffebee;color:#c62828;} }
    .spec-text { color:#1976d2; font-weight:600; font-size:.88rem; margin:8px 0 2px; }
    .qual-text { color:#64748b; font-size:.82rem; margin:0; }
    .close-profile { margin-left:auto; }
    .profile-details { display:flex; flex-wrap:wrap; gap:8px 24px; padding:16px 0; }
    .detail-row { display:flex; align-items:center; gap:6px; font-size:.84rem; color:#475569;
      mat-icon{font-size:16px;width:16px;height:16px;color:#94a3b8;} }
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
    .teacher-card { border-radius:12px; cursor:pointer; transition:all .2s ease; padding:0; overflow:hidden;
      &:hover { transform:translateY(-3px); box-shadow:0 8px 20px rgba(0,0,0,.12)!important; }
      &.selected-card { border:2px solid #1976d2; } }
    .card-avatar { height:72px; background:linear-gradient(135deg,#1976d2,#42a5f5); color:#fff;
      display:flex; align-items:center; justify-content:center; font-size:1.6rem; font-weight:700; }
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
  `]
})
export class TeacherProfilesComponent implements OnInit {
  private api = API_BASE;
  teachers: TeacherDto[] = [];
  selectedTeacher: TeacherDto | null = null;
  loading = false; saving = false; codeLoading = false;
  searchTerm = ''; filterActive: boolean | null = null;
  pageNumber = 1; pageSize = 12; totalCount = 0;
  showForm = false; editingId: string | null = null;
  teacherForm!: FormGroup;

  // Duplicate check state
  phoneDuplicate = false; phoneDupChecking = false;
  emailDuplicate = false; emailDupChecking = false;

  get totalPages() { return Math.ceil(this.totalCount / this.pageSize); }
  get hasDuplicates() { return this.phoneDuplicate || this.emailDuplicate; }

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private confirmDialog: ConfirmDialogService,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.initForm();
    this.loadTeachers();
  }

  initForm() {
    const today = new Date().toISOString().split('T')[0];
    this.teacherForm = this.fb.group({
      employeeCode: [{ value: '', disabled: false }, Validators.required],
      fullName: ['', Validators.required],
      fatherName: [''], gender: ['Male', Validators.required],
      dateOfBirth: [''], qualification: [''], specialization: [''],
      experienceYears: [0], phoneNumber: ['', Validators.required],
      whatsAppPhone: [''], email: [''], address: [''], joiningDate: [today, Validators.required]
    });
  }

  getInitials(name: string) { return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase(); }

  loadTeachers() {
    this.loading = true;
    let params = new HttpParams()
      .set('pageNumber', this.pageNumber).set('pageSize', this.pageSize)
      .set('searchTerm', this.searchTerm).set('sortBy', 'fullName');
    if (this.filterActive !== null) params = params.set('isActive', this.filterActive);
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

  openAddForm() {
    this.editingId = null; this.showForm = true; this.selectedTeacher = null;
    this.phoneDuplicate = false; this.emailDuplicate = false;
    this.teacherForm.reset({ gender: 'Male', experienceYears: 0, joiningDate: new Date().toISOString().split('T')[0] });
    // Auto-generate employee code from backend
    this.codeLoading = true;
    this.http.get<{ code: string }>(`${this.api}/teachers/next-employee-code`).subscribe({
      next: r => { this.teacherForm.patchValue({ employeeCode: r.code }); this.codeLoading = false; },
      error: () => {
        this.codeLoading = false;
        this.confirmDialog.alert('Employee Code', 'Auto code generation failed. Please enter code manually.', 'warning');
      }
    });
  }

  editTeacher(t: TeacherDto) {
    this.editingId = t.id; this.showForm = true;
    this.phoneDuplicate = false; this.emailDuplicate = false;
    this.teacherForm.patchValue({ ...t, joiningDate: t.joiningDate?.split('T')[0], dateOfBirth: t.dateOfBirth?.split('T')[0] });
  }

  cancelForm() { this.showForm = false; this.editingId = null; this.phoneDuplicate = false; this.emailDuplicate = false; }

  /** Called on blur of phone/email fields */
  checkDuplicate(field: 'phone' | 'email') {
    const phone = field === 'phone' ? this.teacherForm.get('phoneNumber')?.value : null;
    const email = field === 'email' ? this.teacherForm.get('email')?.value : null;
    if (!phone && !email) return;

    if (field === 'phone') this.phoneDupChecking = true;
    if (field === 'email') this.emailDupChecking = true;

    const params: any = {};
    if (phone) params.phone = phone;
    if (email) params.email = email;
    if (this.editingId) params.excludeId = this.editingId;

    this.http.get<{ phoneExists: boolean; emailExists: boolean }>(
      `${this.api}/teachers/check-duplicate`, { params }
    ).subscribe({
      next: r => {
        if (field === 'phone') { this.phoneDuplicate = r.phoneExists; this.phoneDupChecking = false; }
        if (field === 'email') { this.emailDuplicate = r.emailExists; this.emailDupChecking = false; }
      },
      error: () => { this.phoneDupChecking = false; this.emailDupChecking = false; }
    });
  }

  saveTeacher() {
    if (this.teacherForm.invalid || this.hasDuplicates) {
      if (this.hasDuplicates) {
        this.confirmDialog.alert('Duplicate Information', 'Duplicate phone or email address already exists. Please fix it before proceeding.', 'warning');
      }
      return;
    }
    this.saving = true;
    const val = this.teacherForm.getRawValue(); // includes readonly employeeCode
    const req = this.editingId
      ? this.http.put<TeacherDto>(`${this.api}/teachers/${this.editingId}`, val)
      : this.http.post<TeacherDto>(`${this.api}/teachers`, val);
    req.subscribe({
      next: () => {
        this.saving = false;
        this.cancelForm();
        this.loadTeachers();
        this.confirmDialog.alert('Success', 'Faculty profile saved successfully!', 'success');
      },
      error: e => {
        this.saving = false;
        this.confirmDialog.alert('Error', e?.error?.message || 'Error saving faculty profile.', 'danger');
      }
    });
  }

  // ── Account Modal Properties ──
  showAccountModal = false;
  accountSaving = false;
  accountTeacher: TeacherDto | null = null;
  accountFormData = { username: '', password: '' };

  openCreateAccountDialog(t: TeacherDto) {
    this.accountTeacher = t;
    const cleanPrefix = t.fullName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanEmp = t.employeeCode.toLowerCase().replace(/[^a-z0-9]/g, '');
    this.accountFormData = {
      username: `${cleanPrefix}.${cleanEmp}`,
      password: `Teach@${new Date().getFullYear()}`
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
