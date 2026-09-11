import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatBadgeModule } from '@angular/material/badge';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';


interface TeacherDto {
  id: string; employeeCode: string; fullName: string; fatherName?: string;
  gender: string; dateOfBirth?: string; qualification?: string; specialization?: string;
  experienceYears: number; phoneNumber: string; whatsAppPhone?: string;
  email?: string; address?: string; photoUrl?: string;
  joiningDate: string; leavingDate?: string; isActive: boolean;
  createdAt: string; assignedBatchCount: number;
}
interface BatchAssignmentDto {
  id: string; teacherId: string; teacherName: string; batchId: string;
  batchName: string; subject: string; daysOfWeek?: string; timeSlot?: string;
  isActive: boolean; assignedAt: string;
}
interface AttendanceDto {
  id: string; teacherId: string; teacherName: string; employeeCode: string;
  attendanceDate: string; status: string; checkInTime?: string; checkOutTime?: string; remarks?: string;
}
interface AttendanceSummaryDto {
  presentDays: number; absentDays: number; lateDays: number; halfDays: number;
  holidayDays: number; totalWorkingDays: number; attendancePercentage: number;
}
interface SalaryDto {
  id: string; teacherId: string; teacherName: string;
  basicSalary: number; hra: number; otherAllowances: number; grossSalary: number;
  pfDeduction: number; tdsDeduction: number; otherDeductions: number; netSalary: number;
  effectiveFrom: string; effectiveTo?: string; isActive: boolean;
}
interface SalaryPaymentDto {
  id: string; teacherId: string; teacherName: string; employeeCode: string;
  paymentMonth: number; paymentYear: number; monthName: string; paymentDate: string;
  grossAmount: number; deductions: number; advanceAdjusted: number; netPaid: number;
  paymentMode: string; transactionRef?: string; receiptNumber: string;
  presentDays: number; absentDays: number; remarks?: string;
}
interface AdvanceDto {
  id: string; teacherId: string; teacherName: string; employeeCode: string;
  amount: number; requestDate: string; approvedDate?: string; reason?: string;
  status: string; adjustedInMonth?: number; adjustedInYear?: number;
}
interface LeaveDto {
  id: string; teacherId: string; teacherName: string; employeeCode: string;
  leaveType: string; fromDate: string; toDate: string; totalDays: number;
  reason?: string; status: string; approvedBy?: string; approvedAt?: string;
  rejectionReason?: string; createdAt: string;
}
interface BatchDto { id: string; name: string; subject: string; academicYear: string; standardMonthlyFee: number; studentCount: number; }

@Component({
  selector: 'app-teachers',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule, MatTabsModule,
    MatChipsModule, MatTooltipModule, MatProgressSpinnerModule,
    MatProgressBarModule, MatDialogModule, MatBadgeModule
  ],
  template: `
<div class="page-container">
  <div class="page-header">
    <div>
      <h1 class="page-title">Teacher Management</h1>
      <p class="page-subtitle">Faculty profiles, attendance, salary, leaves & batch assignments.</p>
    </div>
    <button mat-raised-button color="primary" (click)="openAddTeacher()" *ngIf="!showForm && !selectedTeacher">
      <mat-icon>person_add</mat-icon> Add Teacher
    </button>
  </div>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <!-- ── ADD / EDIT FORM ─────────────────────────────── -->
  <mat-card class="form-card mat-elevation-z3" *ngIf="showForm">
    <div class="form-card-header">
      <h2><mat-icon color="primary">{{editingId ? 'edit' : 'person_add'}}</mat-icon>
        {{editingId ? 'Edit Teacher' : 'Add New Teacher'}}
      </h2>
      <button mat-icon-button (click)="cancelForm()"><mat-icon>close</mat-icon></button>
    </div>
    <form [formGroup]="teacherForm" (ngSubmit)="saveTeacher()">
      <div class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>Employee Code *</mat-label>
          <input matInput formControlName="employeeCode" placeholder="TCH-003">
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
        <mat-form-field appearance="outline">
          <mat-label>Phone Number *</mat-label>
          <input matInput formControlName="phoneNumber">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>WhatsApp Number</mat-label>
          <input matInput formControlName="whatsAppPhone">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email">
        </mat-form-field>
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

  <!-- ── TEACHER DETAIL PANEL ────────────────────────── -->
  <div class="detail-layout" *ngIf="selectedTeacher && !showForm">
    <!-- Left: Profile Card -->
    <mat-card class="profile-card mat-elevation-z3">
      <div class="profile-avatar">
        <div class="avatar-circle">{{getInitials(selectedTeacher.fullName)}}</div>
        <span class="emp-code-badge">{{selectedTeacher.employeeCode}}</span>
        <span class="status-chip" [class.active]="selectedTeacher.isActive" [class.inactive]="!selectedTeacher.isActive">
          {{selectedTeacher.isActive ? 'Active' : 'Inactive'}}
        </span>
      </div>
      <h3 class="teacher-name">{{selectedTeacher.fullName}}</h3>
      <p class="teacher-spec">{{selectedTeacher.specialization || 'No Specialization'}}</p>
      <div class="profile-detail-row"><mat-icon>school</mat-icon><span>{{selectedTeacher.qualification || '—'}}</span></div>
      <div class="profile-detail-row"><mat-icon>phone</mat-icon><span>{{selectedTeacher.phoneNumber}}</span></div>
      <div class="profile-detail-row" *ngIf="selectedTeacher.email"><mat-icon>email</mat-icon><span>{{selectedTeacher.email}}</span></div>
      <div class="profile-detail-row"><mat-icon>work</mat-icon><span>{{selectedTeacher.experienceYears}} yrs experience</span></div>
      <div class="profile-detail-row"><mat-icon>calendar_today</mat-icon><span>Joined: {{selectedTeacher.joiningDate | date:'dd MMM yyyy'}}</span></div>
      <div class="profile-detail-row" *ngIf="selectedTeacher.address"><mat-icon>location_on</mat-icon><span>{{selectedTeacher.address}}</span></div>
      <div class="profile-stats">
        <div class="stat-box"><span class="stat-val">{{selectedTeacher.assignedBatchCount}}</span><span class="stat-lbl">Batches</span></div>
        <div class="stat-box"><span class="stat-val">{{attendanceSummary?.attendancePercentage || 0}}%</span><span class="stat-lbl">Attendance</span></div>
        <div class="stat-box"><span class="stat-val">{{pendingLeaveCount}}</span><span class="stat-lbl">Leaves Pending</span></div>
      </div>
      <div class="profile-actions">
        <button mat-stroked-button color="primary" (click)="editTeacher(selectedTeacher)"><mat-icon>edit</mat-icon> Edit</button>
        <button mat-stroked-button color="warn" (click)="deleteTeacher(selectedTeacher.id)"><mat-icon>delete</mat-icon> Remove</button>
        <button mat-stroked-button (click)="selectedTeacher = null"><mat-icon>arrow_back</mat-icon> Back</button>
      </div>
    </mat-card>

    <!-- Right: Tabs -->
    <mat-card class="detail-tabs-card mat-elevation-z2">
      <mat-tab-group animationDuration="200ms" (selectedTabChange)="onTabChange($event)">

        <!-- Tab 1: Batch Assignments -->
        <mat-tab label="Batch Assignments">
          <div class="tab-content">
            <div class="tab-toolbar">
              <h3>Assigned Batches</h3>
              <button mat-raised-button color="primary" size="small" (click)="showAssignForm = !showAssignForm">
                <mat-icon>add</mat-icon> Assign Batch
              </button>
            </div>
            <div class="assign-form" *ngIf="showAssignForm">
              <mat-form-field appearance="outline">
                <mat-label>Select Batch</mat-label>
                <mat-select [(ngModel)]="newAssignment.batchId">
                  <mat-option *ngFor="let b of batches" [value]="b.id">{{b.name}}</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Subject</mat-label>
                <input matInput [(ngModel)]="newAssignment.subject" placeholder="e.g. Physics">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Days (Mon,Wed,Fri)</mat-label>
                <input matInput [(ngModel)]="newAssignment.daysOfWeek">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Time Slot</mat-label>
                <input matInput [(ngModel)]="newAssignment.timeSlot" placeholder="08:00-09:30">
              </mat-form-field>
              <div class="assign-actions">
                <button mat-button (click)="showAssignForm = false">Cancel</button>
                <button mat-raised-button color="primary" (click)="assignBatch()">Assign</button>
              </div>
            </div>
            <div class="batch-assignment-grid">
              <div class="assignment-card" *ngFor="let a of batchAssignments">
                <div class="assignment-header">
                  <mat-icon color="primary">class</mat-icon>
                  <strong>{{a.batchName}}</strong>
                  <span class="subj-chip">{{a.subject}}</span>
                </div>
                <div class="assignment-meta" *ngIf="a.daysOfWeek">
                  <mat-icon>date_range</mat-icon> {{a.daysOfWeek}}
                </div>
                <div class="assignment-meta" *ngIf="a.timeSlot">
                  <mat-icon>schedule</mat-icon> {{a.timeSlot}}
                </div>
                <button mat-icon-button color="warn" class="remove-btn" (click)="removeBatchAssignment(a.id)" matTooltip="Remove Assignment">
                  <mat-icon>remove_circle_outline</mat-icon>
                </button>
              </div>
              <div class="empty-state" *ngIf="batchAssignments.length === 0">
                <mat-icon>class</mat-icon>
                <p>No batches assigned yet.</p>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Tab 2: Attendance -->
        <mat-tab label="Attendance">
          <div class="tab-content">
            <div class="tab-toolbar">
              <h3>Monthly Attendance</h3>
              <div class="month-selector">
                <mat-form-field appearance="outline" style="width:120px">
                  <mat-label>Month</mat-label>
                  <mat-select [(ngModel)]="attMonth" (ngModelChange)="loadAttendance()">
                    <mat-option *ngFor="let m of months; let i = index" [value]="i+1">{{m}}</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" style="width:100px">
                  <mat-label>Year</mat-label>
                  <mat-select [(ngModel)]="attYear" (ngModelChange)="loadAttendance()">
                    <mat-option *ngFor="let y of years" [value]="y">{{y}}</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
            </div>
            <!-- Summary Cards -->
            <div class="att-summary" *ngIf="attendanceSummary">
              <div class="att-chip present"><span>{{attendanceSummary.presentDays}}</span><small>Present</small></div>
              <div class="att-chip absent"><span>{{attendanceSummary.absentDays}}</span><small>Absent</small></div>
              <div class="att-chip late"><span>{{attendanceSummary.lateDays}}</span><small>Late</small></div>
              <div class="att-chip half"><span>{{attendanceSummary.halfDays}}</span><small>Half Day</small></div>
              <div class="att-chip pct"><span>{{attendanceSummary.attendancePercentage}}%</span><small>Attendance</small></div>
            </div>
            <!-- Attendance Table -->
            <table class="att-table" *ngIf="attendanceRecords.length > 0">
              <thead><tr><th>Date</th><th>Status</th><th>Check In</th><th>Check Out</th><th>Remarks</th></tr></thead>
              <tbody>
                <tr *ngFor="let a of attendanceRecords">
                  <td>{{a.attendanceDate | date:'EEE, dd MMM'}}</td>
                  <td><span class="status-badge" [ngClass]="a.status.toLowerCase()">{{a.status}}</span></td>
                  <td>{{a.checkInTime || '—'}}</td>
                  <td>{{a.checkOutTime || '—'}}</td>
                  <td>{{a.remarks || '—'}}</td>
                </tr>
              </tbody>
            </table>
            <div class="empty-state" *ngIf="attendanceRecords.length === 0 && !loading">
              <mat-icon>event_busy</mat-icon>
              <p>No attendance records for this month.</p>
            </div>
          </div>
        </mat-tab>

        <!-- Tab 3: Salary -->
        <mat-tab label="Salary & Payments">
          <div class="tab-content">
            <!-- Salary Structure -->
            <div class="section-header">
              <h3>Salary Structure</h3>
              <button mat-stroked-button color="primary" (click)="showSalaryForm = !showSalaryForm">
                <mat-icon>{{salaryStructure ? 'edit' : 'add'}}</mat-icon>
                {{salaryStructure ? 'Update Structure' : 'Set Salary'}}
              </button>
            </div>
            <form [formGroup]="salaryForm" (ngSubmit)="saveSalaryStructure()" *ngIf="showSalaryForm">
              <div class="form-grid compact">
                <mat-form-field appearance="outline"><mat-label>Basic Salary ₹</mat-label><input matInput type="number" formControlName="basicSalary"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>HRA ₹</mat-label><input matInput type="number" formControlName="hra"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Other Allowances ₹</mat-label><input matInput type="number" formControlName="otherAllowances"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>PF Deduction ₹</mat-label><input matInput type="number" formControlName="pfDeduction"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>TDS Deduction ₹</mat-label><input matInput type="number" formControlName="tdsDeduction"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Other Deductions ₹</mat-label><input matInput type="number" formControlName="otherDeductions"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Effective From</mat-label><input matInput type="date" formControlName="effectiveFrom"></mat-form-field>
              </div>
              <div class="form-actions">
                <button mat-button type="button" (click)="showSalaryForm=false">Cancel</button>
                <button mat-raised-button color="primary" type="submit">Save Salary Structure</button>
              </div>
            </form>
            <div class="salary-structure-card" *ngIf="salaryStructure && !showSalaryForm">
              <div class="sal-row earnings"><span>Basic Salary</span><span>₹{{salaryStructure.basicSalary | number}}</span></div>
              <div class="sal-row earnings"><span>HRA</span><span>₹{{salaryStructure.hra | number}}</span></div>
              <div class="sal-row earnings"><span>Other Allowances</span><span>₹{{salaryStructure.otherAllowances | number}}</span></div>
              <div class="sal-row gross"><span>Gross Salary</span><span>₹{{salaryStructure.grossSalary | number}}</span></div>
              <div class="sal-row deduction"><span>PF Deduction</span><span>-₹{{salaryStructure.pfDeduction | number}}</span></div>
              <div class="sal-row deduction"><span>TDS</span><span>-₹{{salaryStructure.tdsDeduction | number}}</span></div>
              <div class="sal-row deduction"><span>Other Deductions</span><span>-₹{{salaryStructure.otherDeductions | number}}</span></div>
              <div class="sal-row net"><span>Net Salary</span><span>₹{{salaryStructure.netSalary | number}}</span></div>
              <small class="eff-from">Effective from: {{salaryStructure.effectiveFrom | date:'dd MMM yyyy'}}</small>
            </div>

            <!-- Payment History -->
            <div class="section-header" style="margin-top:24px">
              <h3>Payment History</h3>
              <button mat-stroked-button color="primary" (click)="showPaymentForm = !showPaymentForm">
                <mat-icon>add</mat-icon> Record Payment
              </button>
            </div>
            <form [formGroup]="paymentForm" (ngSubmit)="recordPayment()" *ngIf="showPaymentForm">
              <div class="form-grid compact">
                <mat-form-field appearance="outline"><mat-label>Month</mat-label>
                  <mat-select formControlName="paymentMonth">
                    <mat-option *ngFor="let m of months; let i=index" [value]="i+1">{{m}}</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Year</mat-label><input matInput type="number" formControlName="paymentYear"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Gross Amount ₹</mat-label><input matInput type="number" formControlName="grossAmount"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Deductions ₹</mat-label><input matInput type="number" formControlName="deductions"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Advance Adjusted ₹</mat-label><input matInput type="number" formControlName="advanceAdjusted"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Net Paid ₹</mat-label><input matInput type="number" formControlName="netPaid"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Payment Mode</mat-label>
                  <mat-select formControlName="paymentMode">
                    <mat-option value="Cash">Cash</mat-option>
                    <mat-option value="BankTransfer">Bank Transfer</mat-option>
                    <mat-option value="UPI">UPI</mat-option>
                    <mat-option value="Cheque">Cheque</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Present Days</mat-label><input matInput type="number" formControlName="presentDays"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Absent Days</mat-label><input matInput type="number" formControlName="absentDays"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Transaction Ref</mat-label><input matInput formControlName="transactionRef"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Payment Date</mat-label><input matInput type="date" formControlName="paymentDate"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Remarks</mat-label><input matInput formControlName="remarks"></mat-form-field>
              </div>
              <div class="form-actions">
                <button mat-button type="button" (click)="showPaymentForm=false">Cancel</button>
                <button mat-raised-button color="primary" type="submit" [disabled]="paymentForm.invalid">Record Payment</button>
              </div>
            </form>
            <table class="att-table" *ngIf="salaryPayments.length > 0">
              <thead><tr><th>Month</th><th>Gross</th><th>Deductions</th><th>Advance Adj.</th><th>Net Paid</th><th>Mode</th><th>Receipt</th></tr></thead>
              <tbody>
                <tr *ngFor="let p of salaryPayments">
                  <td>{{p.monthName}}</td>
                  <td>₹{{p.grossAmount | number}}</td>
                  <td>₹{{p.deductions | number}}</td>
                  <td>₹{{p.advanceAdjusted | number}}</td>
                  <td><strong>₹{{p.netPaid | number}}</strong></td>
                  <td>{{p.paymentMode}}</td>
                  <td><span class="receipt-tag">{{p.receiptNumber}}</span></td>
                </tr>
              </tbody>
            </table>
            <div class="empty-state" *ngIf="salaryPayments.length === 0 && !showPaymentForm">
              <mat-icon>payments</mat-icon><p>No salary payments recorded yet.</p>
            </div>

            <!-- Advances -->
            <div class="section-header" style="margin-top:24px">
              <h3>Salary Advances</h3>
              <button mat-stroked-button (click)="showAdvanceForm = !showAdvanceForm"><mat-icon>add</mat-icon> Request Advance</button>
            </div>
            <div class="advance-form" *ngIf="showAdvanceForm">
              <mat-form-field appearance="outline"><mat-label>Amount ₹</mat-label><input matInput type="number" [(ngModel)]="newAdvance.amount"></mat-form-field>
              <mat-form-field appearance="outline" style="flex:2"><mat-label>Reason</mat-label><input matInput [(ngModel)]="newAdvance.reason"></mat-form-field>
              <button mat-raised-button color="primary" (click)="requestAdvance()">Submit</button>
            </div>
            <table class="att-table" *ngIf="advances.length > 0">
              <thead><tr><th>Date</th><th>Amount</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                <tr *ngFor="let a of advances">
                  <td>{{a.requestDate | date:'dd MMM yyyy'}}</td>
                  <td>₹{{a.amount | number}}</td>
                  <td>{{a.reason || '—'}}</td>
                  <td><span class="status-badge" [ngClass]="a.status.toLowerCase()">{{a.status}}</span></td>
                  <td>
                    <button mat-icon-button color="primary" *ngIf="a.status==='Pending'" (click)="approveAdvance(a.id, true)" matTooltip="Approve"><mat-icon>check_circle</mat-icon></button>
                    <button mat-icon-button color="warn" *ngIf="a.status==='Pending'" (click)="approveAdvance(a.id, false)" matTooltip="Reject"><mat-icon>cancel</mat-icon></button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="empty-state" *ngIf="advances.length === 0 && !showAdvanceForm">
              <mat-icon>account_balance_wallet</mat-icon><p>No advances on record.</p>
            </div>
          </div>
        </mat-tab>

        <!-- Tab 4: Leave Management -->
        <mat-tab label="Leaves">
          <div class="tab-content">
            <div class="tab-toolbar">
              <h3>Leave Applications</h3>
              <button mat-raised-button color="primary" (click)="showLeaveForm = !showLeaveForm"><mat-icon>add</mat-icon> Apply Leave</button>
            </div>
            <form [formGroup]="leaveForm" (ngSubmit)="applyLeave()" *ngIf="showLeaveForm">
              <div class="form-grid compact">
                <mat-form-field appearance="outline"><mat-label>Leave Type</mat-label>
                  <mat-select formControlName="leaveType">
                    <mat-option value="CasualLeave">Casual Leave</mat-option>
                    <mat-option value="SickLeave">Sick Leave</mat-option>
                    <mat-option value="EarnedLeave">Earned Leave</mat-option>
                    <mat-option value="UnpaidLeave">Unpaid Leave</mat-option>
                    <mat-option value="EmergencyLeave">Emergency Leave</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline"><mat-label>From Date</mat-label><input matInput type="date" formControlName="fromDate"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>To Date</mat-label><input matInput type="date" formControlName="toDate"></mat-form-field>
                <mat-form-field appearance="outline" class="full-width"><mat-label>Reason</mat-label><input matInput formControlName="reason"></mat-form-field>
              </div>
              <div class="form-actions">
                <button mat-button type="button" (click)="showLeaveForm=false">Cancel</button>
                <button mat-raised-button color="primary" type="submit" [disabled]="leaveForm.invalid">Apply Leave</button>
              </div>
            </form>
            <table class="att-table" *ngIf="leaves.length > 0">
              <thead><tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                <tr *ngFor="let l of leaves">
                  <td>{{l.leaveType | titlecase}}</td>
                  <td>{{l.fromDate | date:'dd MMM'}}</td>
                  <td>{{l.toDate | date:'dd MMM yyyy'}}</td>
                  <td>{{l.totalDays}}</td>
                  <td>{{l.reason || '—'}}</td>
                  <td><span class="status-badge" [ngClass]="l.status.toLowerCase()">{{l.status}}</span></td>
                  <td>
                    <button mat-icon-button color="primary" *ngIf="l.status==='Pending'" (click)="approveLeave(l.id, true)" matTooltip="Approve"><mat-icon>check_circle</mat-icon></button>
                    <button mat-icon-button color="warn" *ngIf="l.status==='Pending'" (click)="approveLeave(l.id, false)" matTooltip="Reject"><mat-icon>cancel</mat-icon></button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="empty-state" *ngIf="leaves.length === 0 && !showLeaveForm">
              <mat-icon>beach_access</mat-icon><p>No leave applications found.</p>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-card>
  </div>

  <!-- ── TEACHER LIST ─────────────────────────────────── -->
  <div *ngIf="!selectedTeacher && !showForm">
    <!-- Search & Filter Bar -->
    <mat-card class="filter-bar mat-elevation-z1">
      <mat-form-field appearance="outline" class="search-field">
        <mat-label>Search teachers...</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [(ngModel)]="searchTerm" (ngModelChange)="onSearch()" placeholder="Name, code, specialization...">
        <button mat-icon-button matSuffix *ngIf="searchTerm" (click)="searchTerm=''; loadTeachers()"><mat-icon>clear</mat-icon></button>
      </mat-form-field>
      <mat-form-field appearance="outline" style="width:160px">
        <mat-label>Status</mat-label>
        <mat-select [(ngModel)]="filterActive" (ngModelChange)="loadTeachers()">
          <mat-option [value]="null">All Teachers</mat-option>
          <mat-option [value]="true">Active Only</mat-option>
          <mat-option [value]="false">Inactive Only</mat-option>
        </mat-select>
      </mat-form-field>
    </mat-card>

    <!-- Teachers Grid -->
    <div class="teachers-grid">
      <mat-card class="teacher-card mat-elevation-z2" *ngFor="let t of teachers" (click)="selectTeacher(t)">
        <div class="card-avatar">{{getInitials(t.fullName)}}</div>
        <div class="card-body">
          <div class="card-top">
            <span class="emp-code">{{t.employeeCode}}</span>
            <span class="active-dot" [class.active]="t.isActive" [class.inactive]="!t.isActive"></span>
          </div>
          <h4 class="teacher-card-name">{{t.fullName}}</h4>
          <p class="teacher-spec-small">{{t.specialization || 'No Specialization'}}</p>
          <p class="teacher-qual">{{t.qualification || ''}}</p>
          <div class="card-meta">
            <span><mat-icon>class</mat-icon>{{t.assignedBatchCount}} Batches</span>
            <span><mat-icon>work_history</mat-icon>{{t.experienceYears}}y exp</span>
          </div>
          <div class="card-phone"><mat-icon>phone</mat-icon>{{t.phoneNumber}}</div>
        </div>
      </mat-card>
      <div class="teachers-empty" *ngIf="teachers.length === 0 && !loading">
        <mat-icon>person_off</mat-icon>
        <p>No teachers found. Click "Add Teacher" to get started.</p>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination" *ngIf="totalCount > pageSize">
      <button mat-icon-button [disabled]="pageNumber === 1" (click)="changePage(-1)"><mat-icon>chevron_left</mat-icon></button>
      <span>Page {{pageNumber}} of {{totalPages}}</span>
      <button mat-icon-button [disabled]="pageNumber >= totalPages" (click)="changePage(1)"><mat-icon>chevron_right</mat-icon></button>
    </div>
  </div>
</div>
  `,
  styles: [`
    .page-container { display:flex; flex-direction:column; gap:20px; }
    .page-header { display:flex; justify-content:space-between; align-items:center; }
    .page-title { font-size:1.5rem; font-weight:700; margin:0; color:#1976d2; }
    .page-subtitle { color:#666; margin:4px 0 0; font-size:.9rem; }

    /* Form Card */
    .form-card { padding:24px; border-radius:12px; }
    .form-card-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; h2 { display:flex; align-items:center; gap:8px; font-size:1.2rem; font-weight:700; margin:0; } }
    .form-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px,1fr)); gap:0 16px; }
    .form-grid.compact { grid-template-columns:repeat(auto-fill, minmax(180px,1fr)); }
    .full-width { grid-column:1/-1; }
    .form-actions { display:flex; justify-content:flex-end; gap:12px; margin-top:8px; }

    /* Detail Layout */
    .detail-layout { display:flex; gap:20px; align-items:flex-start; }
    .profile-card { width:280px; flex-shrink:0; padding:24px; border-radius:12px; display:flex; flex-direction:column; align-items:center; text-align:center; }
    .profile-avatar { display:flex; flex-direction:column; align-items:center; gap:8px; margin-bottom:12px; }
    .avatar-circle { width:80px; height:80px; border-radius:50%; background:linear-gradient(135deg,#1976d2,#42a5f5); color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.8rem; font-weight:700; }
    .emp-code-badge { background:#e3f2fd; color:#1565c0; padding:2px 10px; border-radius:12px; font-size:.78rem; font-weight:700; }
    .status-chip { padding:2px 10px; border-radius:12px; font-size:.75rem; font-weight:600; &.active{background:#e8f5e9;color:#2e7d32;} &.inactive{background:#ffebee;color:#c62828;} }
    .teacher-name { font-size:1.1rem; font-weight:700; margin:4px 0 2px; color:#1e293b; }
    .teacher-spec { font-size:.85rem; color:#1976d2; font-weight:600; margin:0 0 16px; }
    .profile-detail-row { display:flex; align-items:center; gap:8px; font-size:.82rem; color:#475569; margin-bottom:6px; width:100%; text-align:left; mat-icon{font-size:16px;width:16px;height:16px;color:#94a3b8;} }
    .profile-stats { display:flex; gap:12px; margin:16px 0; width:100%; }
    .stat-box { flex:1; background:#f8fafc; border-radius:8px; padding:10px 4px; text-align:center; .stat-val{display:block;font-size:1.2rem;font-weight:700;color:#1976d2;} .stat-lbl{font-size:.7rem;color:#64748b;} }
    .profile-actions { display:flex; flex-direction:column; gap:8px; width:100%; margin-top:8px; button{width:100%;} }
    .detail-tabs-card { flex:1; border-radius:12px; padding:0; overflow:hidden; }
    .tab-content { padding:20px; }
    .tab-toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; h3{margin:0;font-weight:700;} }
    .section-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; h3{margin:0;font-weight:700;} }

    /* Batch Assignments */
    .assign-form { display:flex; flex-wrap:wrap; gap:12px; background:#f8fafc; padding:16px; border-radius:8px; margin-bottom:16px; }
    .assign-actions { display:flex; gap:8px; align-items:center; align-self:flex-end; }
    .batch-assignment-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }
    .assignment-card { border:1px solid #e2e8f0; border-radius:8px; padding:14px; position:relative; background:#fff; }
    .assignment-header { display:flex; align-items:center; gap:6px; margin-bottom:8px; mat-icon{font-size:18px;} }
    .subj-chip { background:#e3f2fd; color:#1565c0; font-size:.72rem; padding:2px 8px; border-radius:10px; font-weight:600; }
    .assignment-meta { display:flex; align-items:center; gap:4px; font-size:.8rem; color:#64748b; margin-bottom:4px; mat-icon{font-size:14px;width:14px;height:14px;} }
    .remove-btn { position:absolute; top:8px; right:8px; }

    /* Attendance */
    .month-selector { display:flex; gap:8px; }
    .att-summary { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:20px; }
    .att-chip { text-align:center; padding:12px 20px; border-radius:10px; min-width:80px;
      span{display:block;font-size:1.4rem;font-weight:700;} small{font-size:.72rem;color:#64748b;}
      &.present{background:#e8f5e9;span{color:#2e7d32;}} &.absent{background:#ffebee;span{color:#c62828;}}
      &.late{background:#fff3e0;span{color:#e65100;}} &.half{background:#f3e5f5;span{color:#6a1b9a;}}
      &.pct{background:#e3f2fd;span{color:#1565c0;}} }
    .att-table { width:100%; border-collapse:collapse; font-size:.85rem;
      th,td{padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:left;}
      th{background:#f8fafc;font-weight:600;color:#64748b;font-size:.78rem;}
      tr:last-child td{border-bottom:none;} }
    .status-badge { padding:3px 10px; border-radius:10px; font-size:.75rem; font-weight:600;
      &.present{background:#e8f5e9;color:#2e7d32;} &.absent{background:#ffebee;color:#c62828;}
      &.late{background:#fff3e0;color:#e65100;} &.halfday{background:#f3e5f5;color:#6a1b9a;}
      &.pending{background:#fff8e1;color:#f57f17;} &.approved{background:#e8f5e9;color:#2e7d32;}
      &.rejected{background:#ffebee;color:#c62828;} &.adjusted{background:#e3f2fd;color:#1565c0;} }

    /* Salary */
    .salary-structure-card { border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
    .sal-row { display:flex; justify-content:space-between; padding:10px 16px; font-size:.88rem;
      &.earnings{background:#f8fafc; color:#334155;}
      &.gross{background:#e3f2fd; font-weight:700; color:#1565c0;}
      &.deduction{background:#fff8f8; color:#c62828;}
      &.net{background:#e8f5e9; font-weight:700; font-size:1rem; color:#2e7d32;} }
    .eff-from { display:block; text-align:right; padding:6px 16px; font-size:.75rem; color:#94a3b8; }
    .receipt-tag { background:#e3f2fd; color:#1565c0; font-size:.72rem; padding:2px 8px; border-radius:8px; font-weight:600; }
    .advance-form { display:flex; gap:12px; align-items:center; flex-wrap:wrap; background:#f8fafc; padding:16px; border-radius:8px; margin-bottom:16px; }

    /* Teacher List */
    .filter-bar { padding:16px; border-radius:10px; display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
    .search-field { flex:1; min-width:260px; }
    .teachers-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:16px; }
    .teacher-card { border-radius:12px; cursor:pointer; transition:all .2s ease; padding:0; overflow:hidden;
      &:hover{transform:translateY(-3px);box-shadow:0 8px 20px rgba(0,0,0,.12)!important;} }
    .card-avatar { height:80px; background:linear-gradient(135deg,#1976d2,#42a5f5); color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.8rem; font-weight:700; }
    .card-body { padding:16px; }
    .card-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
    .emp-code { font-size:.78rem; font-weight:700; color:#1976d2; background:#e3f2fd; padding:2px 8px; border-radius:8px; }
    .active-dot { width:10px; height:10px; border-radius:50%; &.active{background:#4caf50;} &.inactive{background:#f44336;} }
    .teacher-card-name { font-size:1rem; font-weight:700; margin:0 0 2px; color:#1e293b; }
    .teacher-spec-small { font-size:.8rem; color:#1976d2; font-weight:600; margin:0 0 2px; }
    .teacher-qual { font-size:.75rem; color:#64748b; margin:0 0 10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .card-meta { display:flex; gap:12px; font-size:.78rem; color:#64748b; margin-bottom:6px; span{display:flex;align-items:center;gap:3px;} mat-icon{font-size:14px;width:14px;height:14px;} }
    .card-phone { font-size:.8rem; color:#475569; display:flex; align-items:center; gap:4px; mat-icon{font-size:14px;width:14px;height:14px;color:#94a3b8;} }
    .teachers-empty { grid-column:1/-1; display:flex; flex-direction:column; align-items:center; padding:60px; color:#94a3b8; mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px;} }
    .empty-state { display:flex; flex-direction:column; align-items:center; padding:40px; color:#94a3b8; mat-icon{font-size:40px;width:40px;height:40px;margin-bottom:8px;} p{margin:0;} }
    .pagination { display:flex; justify-content:center; align-items:center; gap:16px; margin-top:8px; span{font-size:.9rem;color:#64748b;} }
  `]
})
export class TeachersComponent implements OnInit {
  private api = 'http://localhost:5000/api';

  teachers: TeacherDto[] = [];
  selectedTeacher: TeacherDto | null = null;
  batches: BatchDto[] = [];

  // List state
  loading = false;
  saving = false;
  searchTerm = '';
  filterActive: boolean | null = null;
  pageNumber = 1;
  pageSize = 12;
  totalCount = 0;
  get totalPages() { return Math.ceil(this.totalCount / this.pageSize); }

  // Forms
  showForm = false;
  editingId: string | null = null;
  teacherForm!: FormGroup;

  // Detail tab state
  batchAssignments: BatchAssignmentDto[] = [];
  attendanceRecords: AttendanceDto[] = [];
  attendanceSummary: AttendanceSummaryDto | null = null;
  salaryStructure: SalaryDto | null = null;
  salaryPayments: SalaryPaymentDto[] = [];
  advances: AdvanceDto[] = [];
  leaves: LeaveDto[] = [];
  pendingLeaveCount = 0;

  attMonth = new Date().getMonth() + 1;
  attYear = new Date().getFullYear();
  months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  years = [2024, 2025, 2026, 2027];

  // Sub-forms
  showAssignForm = false;
  newAssignment: any = { batchId: '', subject: '', daysOfWeek: '', timeSlot: '' };
  showSalaryForm = false;
  salaryForm!: FormGroup;
  showPaymentForm = false;
  paymentForm!: FormGroup;
  showAdvanceForm = false;
  newAdvance: any = { amount: 0, reason: '' };
  showLeaveForm = false;
  leaveForm!: FormGroup;

  constructor(private http: HttpClient, private fb: FormBuilder, private confirmDialog: ConfirmDialogService) {}

  ngOnInit() {
    this.initForms();
    this.loadTeachers();
    this.loadBatches();
  }

  initForms() {
    const today = new Date().toISOString().split('T')[0];
    this.teacherForm = this.fb.group({
      employeeCode: ['', Validators.required],
      fullName: ['', Validators.required],
      fatherName: [''], gender: ['Male', Validators.required],
      dateOfBirth: [''], qualification: [''], specialization: [''],
      experienceYears: [0], phoneNumber: ['', Validators.required],
      whatsAppPhone: [''], email: [''], address: [''], joiningDate: [today, Validators.required]
    });
    this.salaryForm = this.fb.group({
      basicSalary: [0, Validators.required], hra: [0], otherAllowances: [0],
      pfDeduction: [0], tdsDeduction: [0], otherDeductions: [0],
      effectiveFrom: [today, Validators.required]
    });
    this.paymentForm = this.fb.group({
      paymentMonth: [new Date().getMonth()+1, Validators.required],
      paymentYear: [new Date().getFullYear(), Validators.required],
      grossAmount: [0, Validators.required], deductions: [0],
      advanceAdjusted: [0], netPaid: [0, Validators.required],
      paymentMode: ['Cash'], transactionRef: [''],
      presentDays: [0], absentDays: [0], remarks: [''],
      paymentDate: [today]
    });
    this.leaveForm = this.fb.group({
      leaveType: ['CasualLeave', Validators.required],
      fromDate: ['', Validators.required], toDate: ['', Validators.required], reason: ['']
    });
  }

  getInitials(name: string) { return name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase(); }

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

  loadBatches() {
    this.http.get<BatchDto[]>(`${this.api}/batches`).subscribe(b => this.batches = b);
  }

  onSearch() { this.pageNumber = 1; this.loadTeachers(); }
  changePage(dir: number) { this.pageNumber += dir; this.loadTeachers(); }

  openAddTeacher() {
    this.editingId = null; this.showForm = true; this.selectedTeacher = null;
    this.teacherForm.reset({ gender: 'Male', experienceYears: 0, joiningDate: new Date().toISOString().split('T')[0] });
  }

  editTeacher(t: TeacherDto) {
    this.editingId = t.id; this.showForm = true;
    this.teacherForm.patchValue({ ...t, joiningDate: t.joiningDate?.split('T')[0], dateOfBirth: t.dateOfBirth?.split('T')[0] });
  }

  cancelForm() { this.showForm = false; this.editingId = null; }

  saveTeacher() {
    if (this.teacherForm.invalid) return;
    this.saving = true;
    const val = this.teacherForm.value;
    const req = this.editingId
      ? this.http.put<TeacherDto>(`${this.api}/teachers/${this.editingId}`, val)
      : this.http.post<TeacherDto>(`${this.api}/teachers`, val);
    req.subscribe({
      next: () => {
        this.saving = false;
        this.cancelForm();
        this.loadTeachers();
        this.confirmDialog.alert('Success', 'Teacher saved successfully!', 'success');
      },
      error: (e) => {
        this.saving = false;
        this.confirmDialog.alert('Error', e?.error?.message || 'Error saving teacher.', 'danger');
      }
    });
  }

  deleteTeacher(id: string) {
    this.confirmDialog.danger('Delete Teacher', 'Are you sure you want to remove this teacher?').subscribe(confirmed => {
      if (!confirmed) return;
      this.http.delete(`${this.api}/teachers/${id}`).subscribe({
        next: () => {
          this.selectedTeacher = null;
          this.loadTeachers();
          this.confirmDialog.alert('Teacher Removed', 'Teacher removed successfully.', 'info');
        },
        error: e => this.confirmDialog.alert('Error', e?.error?.message || 'Failed to remove teacher.', 'danger')
      });
    });
  }

  selectTeacher(t: TeacherDto) {
    this.selectedTeacher = t;
    this.showAssignForm = false; this.showSalaryForm = false; this.showPaymentForm = false;
    this.showLeaveForm = false; this.showAdvanceForm = false;
    this.loadBatchAssignments(t.id);
    this.loadAttendance();
    this.loadSalary(t.id);
    this.loadSalaryPayments(t.id);
    this.loadAdvances(t.id);
    this.loadLeaves(t.id);
  }

  onTabChange(e: any) {
    if (!this.selectedTeacher) return;
    if (e.index === 1) this.loadAttendance();
    if (e.index === 2) { this.loadSalary(this.selectedTeacher.id); this.loadSalaryPayments(this.selectedTeacher.id); this.loadAdvances(this.selectedTeacher.id); }
    if (e.index === 3) this.loadLeaves(this.selectedTeacher.id);
  }

  // Batch assignments
  loadBatchAssignments(id: string) {
    this.http.get<BatchAssignmentDto[]>(`${this.api}/teachers/${id}/batch-assignments`).subscribe(r => this.batchAssignments = r);
  }
  assignBatch() {
    if (!this.selectedTeacher || !this.newAssignment.batchId) return;
    this.http.post<BatchAssignmentDto>(`${this.api}/teachers/batch-assignments`, { teacherId: this.selectedTeacher.id, ...this.newAssignment }).subscribe({
      next: () => {
        this.showAssignForm = false;
        this.newAssignment = {batchId:'',subject:'',daysOfWeek:'',timeSlot:''};
        this.loadBatchAssignments(this.selectedTeacher!.id);
        this.confirmDialog.alert('Batch Assigned', 'Batch assigned successfully!', 'success');
      },
      error: e => this.confirmDialog.alert('Error', e?.error?.message || 'Failed to assign batch.', 'danger')
    });
  }
  removeBatchAssignment(id: string) {
    this.confirmDialog.danger('Remove Batch', 'Are you sure you want to unassign this batch?').subscribe(confirmed => {
      if (!confirmed) return;
      this.http.delete(`${this.api}/teachers/batch-assignments/${id}`).subscribe({
        next: () => {
          this.loadBatchAssignments(this.selectedTeacher!.id);
          this.confirmDialog.alert('Unassigned', 'Batch assignment removed.', 'info');
        },
        error: e => this.confirmDialog.alert('Error', e?.error?.message || 'Failed to remove batch assignment.', 'danger')
      });
    });
  }

  // Attendance
  loadAttendance() {
    if (!this.selectedTeacher) return;
    const id = this.selectedTeacher.id;
    this.http.get<AttendanceDto[]>(`${this.api}/teachers/${id}/attendance`, { params: { month: this.attMonth, year: this.attYear } }).subscribe(r => this.attendanceRecords = r);
    this.http.get<AttendanceSummaryDto>(`${this.api}/teachers/${id}/attendance/summary`, { params: { month: this.attMonth, year: this.attYear } }).subscribe(r => this.attendanceSummary = r);
  }

  // Salary
  loadSalary(id: string) {
    this.http.get<SalaryDto>(`${this.api}/teachers/${id}/salary`).subscribe({ next: r => this.salaryStructure = r, error: () => this.salaryStructure = null });
  }
  saveSalaryStructure() {
    if (!this.selectedTeacher || this.salaryForm.invalid) return;
    this.http.post<SalaryDto>(`${this.api}/teachers/${this.selectedTeacher.id}/salary`, this.salaryForm.value).subscribe({
      next: r => {
        this.salaryStructure = r;
        this.showSalaryForm = false;
        this.confirmDialog.alert('Salary Structure', 'Salary structure updated successfully!', 'success');
      },
      error: e => this.confirmDialog.alert('Error', e?.error?.message || 'Failed to update salary structure.', 'danger')
    });
  }
  loadSalaryPayments(id: string) {
    this.http.get<SalaryPaymentDto[]>(`${this.api}/teachers/${id}/salary-payments`).subscribe(r => this.salaryPayments = r);
  }
  recordPayment() {
    if (!this.selectedTeacher || this.paymentForm.invalid) return;
    this.http.post<SalaryPaymentDto>(`${this.api}/teachers/salary-payments`, { teacherId: this.selectedTeacher.id, ...this.paymentForm.value }).subscribe({
      next: () => {
        this.showPaymentForm = false;
        this.loadSalaryPayments(this.selectedTeacher!.id);
        this.confirmDialog.alert('Payment Recorded', 'Payment recorded successfully!', 'success');
      },
      error: e => this.confirmDialog.alert('Error', e?.error?.message || 'Error recording payment.', 'danger')
    });
  }

  // Advances
  loadAdvances(id: string) { this.http.get<AdvanceDto[]>(`${this.api}/teachers/${id}/advances`).subscribe(r => this.advances = r); }
  requestAdvance() {
    if (!this.selectedTeacher || !this.newAdvance.amount) return;
    this.http.post<AdvanceDto>(`${this.api}/teachers/advances`, { teacherId: this.selectedTeacher.id, ...this.newAdvance }).subscribe({
      next: () => {
        this.showAdvanceForm = false;
        this.newAdvance = {amount:0,reason:''};
        this.loadAdvances(this.selectedTeacher!.id);
        this.confirmDialog.alert('Advance Requested', 'Advance requested successfully!', 'success');
      },
      error: e => this.confirmDialog.alert('Error', e?.error?.message || 'Failed to request advance.', 'danger')
    });
  }
  approveAdvance(id: string, approve: boolean) {
    this.confirmDialog.confirm(
      approve ? 'Approve Advance' : 'Reject Advance',
      `Are you sure you want to ${approve ? 'approve' : 'reject'} this advance request?`,
      approve ? 'Approve' : 'Reject',
      'Cancel',
      approve ? 'info' : 'warning'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.http.put(`${this.api}/teachers/advances/${id}/approve`, { approve }).subscribe({
        next: () => {
          this.loadAdvances(this.selectedTeacher!.id);
          this.confirmDialog.alert(approve ? 'Advance Approved' : 'Advance Rejected', `Advance request has been ${approve ? 'approved' : 'rejected'}.`, 'info');
        },
        error: e => this.confirmDialog.alert('Error', e?.error?.message || 'Failed to update advance.', 'danger')
      });
    });
  }

  // Leaves
  loadLeaves(id: string) {
    this.http.get<LeaveDto[]>(`${this.api}/teachers/${id}/leaves`).subscribe(r => { this.leaves = r; this.pendingLeaveCount = r.filter(l=>l.status==='Pending').length; });
  }
  applyLeave() {
    if (!this.selectedTeacher || this.leaveForm.invalid) return;
    this.http.post<LeaveDto>(`${this.api}/teachers/leaves`, { teacherId: this.selectedTeacher.id, ...this.leaveForm.value }).subscribe({
      next: () => {
        this.showLeaveForm = false;
        this.leaveForm.reset({leaveType:'CasualLeave'});
        this.loadLeaves(this.selectedTeacher!.id);
        this.confirmDialog.alert('Leave Applied', 'Leave applied successfully!', 'success');
      },
      error: e => this.confirmDialog.alert('Error', e?.error?.message || 'Failed to submit leave.', 'danger')
    });
  }
  approveLeave(id: string, approve: boolean) {
    this.confirmDialog.confirm(
      approve ? 'Approve Leave' : 'Reject Leave',
      `Are you sure you want to ${approve ? 'approve' : 'reject'} this leave request?`,
      approve ? 'Approve' : 'Reject',
      'Cancel',
      approve ? 'info' : 'warning'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.http.put(`${this.api}/teachers/leaves/${id}/approve`, { approve, rejectionReason: approve ? null : 'Not approved' }).subscribe({
        next: () => {
          this.loadLeaves(this.selectedTeacher!.id);
          this.confirmDialog.alert(approve ? 'Leave Approved' : 'Leave Rejected', `Leave application has been ${approve ? 'approved' : 'rejected'}.`, 'info');
        },
        error: e => this.confirmDialog.alert('Error', e?.error?.message || 'Failed to update leave.', 'danger')
      });
    });
  }
}
