import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute } from '@angular/router';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

const API_BASE = 'http://localhost:5000/api';

// ─── Interfaces ───────────────────────────────────────────────────

export interface VisitorLogDto {
  id: string;
  visitorNumber: string;
  visitorType: string;
  visitorName: string;
  organization?: string;
  contactNumber?: string;
  email?: string;
  idProofType?: string;
  idProofNumber?: string;
  personToMeet?: string;
  departmentToVisit?: string;
  studentId?: string;
  studentName?: string;
  studentClass?: string;
  purpose: string;
  checkInTime: string;
  checkOutTime?: string;
  status: 'Active' | 'CheckedOut' | 'Overstay';
  numberOfVisitors?: number;
  vehicleNumber?: string;
  badgeNumber?: string;
  materialCarried?: string;
  remarks?: string;
  receivedBy?: string;
  createdAt: string;
}

export interface StudentGatePassDto {
  id: string;
  gatePassNumber: string;
  studentId: string;
  studentName: string;
  className?: string;
  sectionName?: string;
  rollNumber?: string;
  reason: string;
  reasonCategory: string;
  outDateTime: string;
  expectedReturnTime?: string;
  actualReturnTime?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Returned' | 'Expired';
  parentGuardianName?: string;
  parentContactNumber?: string;
  parentRelation?: string;
  approvedBy?: string;
  approvedAt?: string;
  approvalRemarks?: string;
  securityGuardName?: string;
  remarks?: string;
  createdAt: string;
}

export interface FrontDeskStats {
  totalVisitorsToday: number;
  activeVisitors: number;
  checkedOutToday: number;
  gatePassesToday: number;
  pendingGatePasses: number;
  approvedGatePassesToday: number;
}

export interface StudentItem {
  id: string;
  studentName: string;
  rollNumber?: string;
  className?: string;
  sectionName?: string;
}

// ═══════════════════════════════════════════════════════════════════
// VISITOR CHECK-IN DIALOG
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-visitor-checkin-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatDividerModule],
  template: `
    <div class="fd-dialog">
      <div class="fd-dialog-header">
        <div class="fd-dialog-icon"><mat-icon>badge</mat-icon></div>
        <div class="fd-dialog-title-group">
          <h2 class="fd-dialog-title">Visitor Check-In</h2>
          <span class="fd-dialog-sub">Register a new visitor arriving at campus</span>
        </div>
        <button mat-icon-button class="fd-dialog-close" (click)="cancel()"><mat-icon>close</mat-icon></button>
      </div>

      <div class="fd-dialog-body">
        <div class="fd-form-row">
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>Visitor Type *</mat-label>
            <mat-select [(ngModel)]="form.visitorType" required>
              <mat-option *ngFor="let t of visitorTypes" [value]="t">{{t}}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>Visitor Name *</mat-label>
            <input matInput [(ngModel)]="form.visitorName" placeholder="Full name" required />
            <mat-icon matPrefix>person</mat-icon>
          </mat-form-field>
        </div>
        <div class="fd-form-row">
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>Organization / School</mat-label>
            <input matInput [(ngModel)]="form.organization" placeholder="Company or institution" />
            <mat-icon matPrefix>business</mat-icon>
          </mat-form-field>
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>Contact Number</mat-label>
            <input matInput [(ngModel)]="form.contactNumber" placeholder="Mobile number" />
            <mat-icon matPrefix>phone</mat-icon>
          </mat-form-field>
        </div>
        <div class="fd-form-row">
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>ID Proof Type</mat-label>
            <mat-select [(ngModel)]="form.idProofType">
              <mat-option value="">None</mat-option>
              <mat-option *ngFor="let p of idProofTypes" [value]="p">{{p}}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>ID Proof Number</mat-label>
            <input matInput [(ngModel)]="form.idProofNumber" placeholder="e.g. XXXX-XXXX-XXXX" />
          </mat-form-field>
        </div>
        <div class="fd-form-row">
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>Person to Meet</mat-label>
            <input matInput [(ngModel)]="form.personToMeet" placeholder="Teacher / Principal / Admin" />
            <mat-icon matPrefix>record_voice_over</mat-icon>
          </mat-form-field>
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>Department</mat-label>
            <input matInput [(ngModel)]="form.departmentToVisit" placeholder="e.g. Science Dept." />
            <mat-icon matPrefix>domain</mat-icon>
          </mat-form-field>
        </div>
        <div class="fd-form-row" *ngIf="form.visitorType === 'Parent'">
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>Student Name</mat-label>
            <input matInput [(ngModel)]="form.studentName" placeholder="Ward's name" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>Student Class</mat-label>
            <input matInput [(ngModel)]="form.studentClass" placeholder="e.g. Class 5A" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="fd-field-full">
          <mat-label>Purpose of Visit *</mat-label>
          <textarea matInput [(ngModel)]="form.purpose" rows="2" placeholder="Describe the reason for visit" required></textarea>
        </mat-form-field>
        <div class="fd-form-row">
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>No. of Visitors</mat-label>
            <input matInput type="number" [(ngModel)]="form.numberOfVisitors" min="1" />
            <mat-icon matPrefix>group</mat-icon>
          </mat-form-field>
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>Vehicle Number</mat-label>
            <input matInput [(ngModel)]="form.vehicleNumber" placeholder="e.g. UP32 AB 1234" />
            <mat-icon matPrefix>directions_car</mat-icon>
          </mat-form-field>
        </div>
        <div class="fd-form-row">
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>Badge Number</mat-label>
            <input matInput [(ngModel)]="form.badgeNumber" placeholder="Visitor badge ID" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>Received By</mat-label>
            <input matInput [(ngModel)]="form.receivedBy" placeholder="Staff name" />
            <mat-icon matPrefix>how_to_reg</mat-icon>
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="fd-field-full">
          <mat-label>Material / Items Carried</mat-label>
          <input matInput [(ngModel)]="form.materialCarried" placeholder="e.g. Laptop bag, Documents" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="fd-field-full">
          <mat-label>Remarks</mat-label>
          <input matInput [(ngModel)]="form.remarks" placeholder="Any additional notes" />
        </mat-form-field>
      </div>

      <div class="fd-dialog-footer">
        <button mat-stroked-button (click)="cancel()">Cancel</button>
        <button mat-flat-button color="primary" (click)="save()" [disabled]="saving || !form.visitorName || !form.purpose">
          <mat-icon>{{saving ? 'hourglass_empty' : 'how_to_reg'}}</mat-icon>
          {{saving ? 'Checking In...' : 'Check In Visitor'}}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .fd-dialog { min-width: 700px; max-width: 780px; }
    .fd-dialog-header {
      display: flex; align-items: center; gap: 14px; padding: 22px 24px 16px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }
    .fd-dialog-icon {
      background: #2563eb; color: #fff; border-radius: 10px; width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }
    .fd-dialog-title { color: #1e3a8a; font-weight: 700; font-size: 1.1rem; margin: 0; }
    .fd-dialog-sub { color: #3b82f6; font-size: 0.8rem; }
    .fd-dialog-title-group { flex: 1; }
    .fd-dialog-close { color: #64748b; margin-left: auto; }
    .fd-dialog-close:hover { color: #1e293b; }
    .fd-dialog-body { padding: 20px 24px; max-height: 60vh; overflow-y: auto; }
    .fd-dialog-footer { display: flex; gap: 12px; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid #e2e8f0; }
    .fd-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 4px; }
    .fd-field { width: 100%; }
    .fd-field-full { width: 100%; display: block; margin-bottom: 4px; }
    mat-form-field { margin-bottom: 8px; }
  `]
})
export class VisitorCheckInDialogComponent {
  saving = false;
  visitorTypes = ['Visitor', 'Parent', 'Vendor', 'Official', 'Contractor', 'Delivery', 'Other'];
  idProofTypes = ['Aadhaar', 'PAN', 'Driving License', 'Voter ID', 'Passport'];

  form: any = {
    visitorType: 'Visitor',
    visitorName: '',
    organization: '',
    contactNumber: '',
    idProofType: '',
    idProofNumber: '',
    personToMeet: '',
    departmentToVisit: '',
    studentName: '',
    studentClass: '',
    purpose: '',
    numberOfVisitors: 1,
    vehicleNumber: '',
    badgeNumber: '',
    receivedBy: '',
    materialCarried: '',
    remarks: ''
  };

  constructor(
    private dialogRef: MatDialogRef<VisitorCheckInDialogComponent>,
    private http: HttpClient
  ) {}

  save() {
    if (!this.form.visitorName || !this.form.purpose) return;
    this.saving = true;
    this.http.post(`${API_BASE}/front-desk/visitors`, this.form).subscribe({
      next: (res) => { this.saving = false; this.dialogRef.close(res); },
      error: () => { this.saving = false; }
    });
  }

  cancel() { this.dialogRef.close(null); }
}

// ═══════════════════════════════════════════════════════════════════
// GATE PASS DIALOG
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-gate-pass-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <div class="fd-dialog">
      <div class="fd-dialog-header">
        <div class="fd-dialog-icon"><mat-icon>exit_to_app</mat-icon></div>
        <div class="fd-dialog-title-group">
          <h2 class="fd-dialog-title">Issue Student Gate Pass</h2>
          <span class="fd-dialog-sub">Authorize a student to leave campus early</span>
        </div>
        <button mat-icon-button class="fd-dialog-close" (click)="cancel()"><mat-icon>close</mat-icon></button>
      </div>

      <div class="fd-dialog-body">
        <mat-form-field appearance="outline" class="fd-field-full">
          <mat-label>Select Student *</mat-label>
          <mat-select [(ngModel)]="form.studentId" required>
            <mat-option *ngFor="let s of data.students" [value]="s.id">
              {{s.studentName}} — {{s.className}} {{s.sectionName}} | Roll: {{s.rollNumber || 'N/A'}}
            </mat-option>
          </mat-select>
          <mat-icon matPrefix>school</mat-icon>
        </mat-form-field>

        <div class="fd-form-row">
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>Reason Category</mat-label>
            <mat-select [(ngModel)]="form.reasonCategory">
              <mat-option *ngFor="let r of reasonCategories" [value]="r">{{r}}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>Expected Return Time</mat-label>
            <input matInput type="datetime-local" [(ngModel)]="form.expectedReturnTime" />
            <mat-icon matPrefix>schedule</mat-icon>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="fd-field-full">
          <mat-label>Reason for Early Exit *</mat-label>
          <textarea matInput [(ngModel)]="form.reason" rows="2" placeholder="Explain why the student is leaving" required></textarea>
        </mat-form-field>

        <div class="fd-form-row">
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>Parent / Guardian Name</mat-label>
            <input matInput [(ngModel)]="form.parentGuardianName" placeholder="Who is picking up" />
            <mat-icon matPrefix>person</mat-icon>
          </mat-form-field>
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>Parent Contact Number</mat-label>
            <input matInput [(ngModel)]="form.parentContactNumber" placeholder="Mobile" />
            <mat-icon matPrefix>phone</mat-icon>
          </mat-form-field>
        </div>

        <div class="fd-form-row">
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>Relation to Student</mat-label>
            <mat-select [(ngModel)]="form.parentRelation">
              <mat-option value="Father">Father</mat-option>
              <mat-option value="Mother">Mother</mat-option>
              <mat-option value="Guardian">Guardian</mat-option>
              <mat-option value="Elder Sibling">Elder Sibling</mat-option>
              <mat-option value="Other">Other</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="fd-field">
            <mat-label>Security Guard</mat-label>
            <input matInput [(ngModel)]="form.securityGuardName" placeholder="On duty guard name" />
            <mat-icon matPrefix>security</mat-icon>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="fd-field-full">
          <mat-label>Remarks</mat-label>
          <input matInput [(ngModel)]="form.remarks" placeholder="Additional notes" />
        </mat-form-field>
      </div>

      <div class="fd-dialog-footer">
        <button mat-stroked-button (click)="cancel()">Cancel</button>
        <button mat-flat-button color="primary" (click)="save()" [disabled]="saving || !form.studentId || !form.reason">
          <mat-icon>{{saving ? 'hourglass_empty' : 'exit_to_app'}}</mat-icon>
          {{saving ? 'Issuing...' : 'Issue Gate Pass'}}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .fd-dialog { min-width: 620px; max-width: 700px; }
    .fd-dialog-header {
      display: flex; align-items: center; gap: 14px; padding: 22px 24px 16px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }
    .fd-dialog-icon {
      background: #2563eb; color: #fff; border-radius: 10px; width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }
    .fd-dialog-title { color: #1e3a8a; font-weight: 700; font-size: 1.1rem; margin: 0; }
    .fd-dialog-sub { color: #3b82f6; font-size: 0.8rem; }
    .fd-dialog-title-group { flex: 1; }
    .fd-dialog-close { color: #64748b; margin-left: auto; }
    .fd-dialog-body { padding: 20px 24px; max-height: 55vh; overflow-y: auto; }
    .fd-dialog-footer { display: flex; gap: 12px; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid #e2e8f0; }
    .fd-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .fd-field { width: 100%; }
    .fd-field-full { width: 100%; display: block; margin-bottom: 4px; }
    mat-form-field { margin-bottom: 8px; }
  `]
})
export class GatePassDialogComponent {
  saving = false;
  reasonCategories = ['Medical Emergency', 'Family Emergency', 'Early Pickup', 'Event', 'Other'];

  form: any = {
    studentId: null,
    reason: '',
    reasonCategory: 'Early Pickup',
    expectedReturnTime: null,
    parentGuardianName: '',
    parentContactNumber: '',
    parentRelation: 'Father',
    securityGuardName: '',
    remarks: ''
  };

  constructor(
    private dialogRef: MatDialogRef<GatePassDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { students: StudentItem[] },
    private http: HttpClient
  ) {}

  save() {
    if (!this.form.studentId || !this.form.reason) return;
    this.saving = true;
    this.http.post(`${API_BASE}/front-desk/gate-passes`, this.form).subscribe({
      next: (res) => { this.saving = false; this.dialogRef.close(res); },
      error: () => { this.saving = false; }
    });
  }

  cancel() { this.dialogRef.close(null); }
}

// ═══════════════════════════════════════════════════════════════════
// APPROVE / REJECT GATE PASS DIALOG
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-approve-gatepass-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule],
  template: `
    <div class="fd-dialog-sm">
      <div class="fd-dialog-header">
        <div class="fd-dialog-icon" [style.background]="data.action === 'Approve' ? '#16a34a' : '#dc2626'">
          <mat-icon>{{data.action === 'Approve' ? 'check_circle' : 'cancel'}}</mat-icon>
        </div>
        <div class="fd-dialog-title-group">
          <h2 class="fd-dialog-title">{{data.action}} Gate Pass</h2>
          <span class="fd-dialog-sub">{{data.gatePassNumber}} — {{data.studentName}}</span>
        </div>
        <button mat-icon-button class="fd-dialog-close" (click)="cancel()"><mat-icon>close</mat-icon></button>
      </div>
      <div class="fd-dialog-body">
        <mat-form-field appearance="outline" class="fd-field-full">
          <mat-label>Remarks (optional)</mat-label>
          <textarea matInput [(ngModel)]="remarks" rows="3" placeholder="Enter approval / rejection reason..."></textarea>
        </mat-form-field>
      </div>
      <div class="fd-dialog-footer">
        <button mat-stroked-button (click)="cancel()">Cancel</button>
        <button mat-flat-button [color]="data.action === 'Approve' ? 'primary' : 'warn'" (click)="confirm()" [disabled]="saving">
          <mat-icon>{{data.action === 'Approve' ? 'check' : 'block'}}</mat-icon>
          {{saving ? 'Processing...' : data.action}}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .fd-dialog-sm { min-width: 460px; }
    .fd-dialog-header {
      display: flex; align-items: center; gap: 14px; padding: 20px 24px 14px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }
    .fd-dialog-icon {
      color: #fff; border-radius: 10px; width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15);
    }
    .fd-dialog-title { color: #1e3a8a; font-weight: 700; font-size: 1.05rem; margin: 0; }
    .fd-dialog-sub { color: #3b82f6; font-size: 0.8rem; }
    .fd-dialog-title-group { flex: 1; }
    .fd-dialog-close { color: #64748b; margin-left: auto; }
    .fd-dialog-body { padding: 18px 24px; }
    .fd-dialog-footer { display: flex; gap: 12px; justify-content: flex-end; padding: 14px 24px; border-top: 1px solid #e2e8f0; }
    .fd-field-full { width: 100%; display: block; }
  `]
})
export class ApproveGatePassDialogComponent {
  saving = false;
  remarks = '';

  constructor(
    private dialogRef: MatDialogRef<ApproveGatePassDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { id: string; action: string; gatePassNumber: string; studentName: string },
    private http: HttpClient
  ) {}

  confirm() {
    this.saving = true;
    this.http.put(`${API_BASE}/front-desk/gate-passes/${this.data.id}/approve`, {
      action: this.data.action,
      approvalRemarks: this.remarks
    }).subscribe({
      next: () => { this.saving = false; this.dialogRef.close(true); },
      error: () => { this.saving = false; }
    });
  }

  cancel() { this.dialogRef.close(false); }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN VISITORS COMPONENT
// ═══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-visitors',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule,
    MatProgressBarModule, MatDividerModule, MatTabsModule
  ],
  template: `
    <div class="fd-page">

      <!-- ── Page Header ── -->
      <div class="page-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>sensor_door</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Front Desk — Visitor Book & Gate Pass</h1>
            <p class="page-subtitle">
              Track campus visitors with check-in/out logs and issue student early-exit gate passes
            </p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-stroked-button class="refresh-btn" (click)="loadAll()" [disabled]="loading">
            <mat-icon [class.spin]="loading">refresh</mat-icon>
            <span>Refresh</span>
          </button>
          <button mat-flat-button class="btn-visitor" (click)="openVisitorDialog()">
            <mat-icon>how_to_reg</mat-icon>
            <span>Check In Visitor</span>
          </button>
          <button mat-flat-button class="btn-gatepass" (click)="openGatePassDialog()">
            <mat-icon>exit_to_app</mat-icon>
            <span>Issue Gate Pass</span>
          </button>
        </div>
      </div>

      <mat-progress-bar *ngIf="loading" mode="indeterminate" class="fd-loader"></mat-progress-bar>

      <!-- ── Stats Cards ── -->
      <div class="stats-grid">
        <div class="stat-card stat-blue">
          <mat-icon class="stat-icon">groups</mat-icon>
          <div class="stat-body">
            <div class="stat-num">{{stats.totalVisitorsToday}}</div>
            <div class="stat-label">Visitors Today</div>
          </div>
        </div>
        <div class="stat-card stat-green">
          <mat-icon class="stat-icon">sensors</mat-icon>
          <div class="stat-body">
            <div class="stat-num">{{stats.activeVisitors}}</div>
            <div class="stat-label">Currently Inside</div>
          </div>
        </div>
        <div class="stat-card stat-slate">
          <mat-icon class="stat-icon">logout</mat-icon>
          <div class="stat-body">
            <div class="stat-num">{{stats.checkedOutToday}}</div>
            <div class="stat-label">Checked Out</div>
          </div>
        </div>
        <div class="stat-card stat-orange">
          <mat-icon class="stat-icon">exit_to_app</mat-icon>
          <div class="stat-body">
            <div class="stat-num">{{stats.gatePassesToday}}</div>
            <div class="stat-label">Gate Passes Today</div>
          </div>
        </div>
        <div class="stat-card stat-amber">
          <mat-icon class="stat-icon">pending_actions</mat-icon>
          <div class="stat-body">
            <div class="stat-num">{{stats.pendingGatePasses}}</div>
            <div class="stat-label">Pending Approvals</div>
          </div>
        </div>
        <div class="stat-card stat-teal">
          <mat-icon class="stat-icon">check_circle</mat-icon>
          <div class="stat-body">
            <div class="stat-num">{{stats.approvedGatePassesToday}}</div>
            <div class="stat-label">Approved Today</div>
          </div>
        </div>
      </div>

      <!-- ── Tabs ── -->
      <mat-tab-group [(selectedIndex)]="activeTab" class="fd-tabs" animationDuration="200ms">

        <!-- ═══ TAB 1: VISITOR BOOK ═══ -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">badge</mat-icon>
            Visitor Book
          </ng-template>

          <!-- Filters -->
          <div class="filter-bar">
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Date</mat-label>
              <input matInput type="date" [(ngModel)]="visitorDate" (change)="loadVisitors()" />
              <mat-icon matPrefix>today</mat-icon>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="visitorStatus" (selectionChange)="loadVisitors()">
                <mat-option value="All">All</mat-option>
                <mat-option value="Active">Active (Inside)</mat-option>
                <mat-option value="CheckedOut">Checked Out</mat-option>
                <mat-option value="Overstay">Overstay</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Visitor Type</mat-label>
              <mat-select [(ngModel)]="visitorType" (selectionChange)="loadVisitors()">
                <mat-option value="All">All Types</mat-option>
                <mat-option *ngFor="let t of visitorTypes" [value]="t">{{t}}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-search">
              <mat-label>Search</mat-label>
              <input matInput [(ngModel)]="visitorSearch" (input)="loadVisitors()" placeholder="Name, org, pass no..." />
              <mat-icon matPrefix>search</mat-icon>
            </mat-form-field>
          </div>

          <!-- Visitor Table -->
          <div class="fd-table-wrap" *ngIf="visitors.length > 0; else noVisitors">
            <table class="fd-table">
              <thead>
                <tr>
                  <th>Pass #</th>
                  <th>Name & Type</th>
                  <th>Purpose</th>
                  <th>Person to Meet</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let v of visitors" [class.row-active]="v.status === 'Active'">
                  <td>
                    <span class="pass-num">{{v.visitorNumber}}</span>
                    <div class="visitor-org" *ngIf="v.organization">{{v.organization}}</div>
                  </td>
                  <td>
                    <div class="visitor-name">{{v.visitorName}}</div>
                    <span class="type-badge type-{{v.visitorType.toLowerCase()}}">{{v.visitorType}}</span>
                    <div class="visitor-phone" *ngIf="v.contactNumber">
                      <mat-icon style="font-size:11px; width:11px; height:11px;">phone</mat-icon>
                      {{v.contactNumber}}
                    </div>
                  </td>
                  <td>
                    <div class="purpose-text">{{v.purpose | slice:0:60}}{{v.purpose.length > 60 ? '...' : ''}}</div>
                  </td>
                  <td>
                    <div *ngIf="v.personToMeet">{{v.personToMeet}}</div>
                    <div class="dept-text" *ngIf="v.departmentToVisit">{{v.departmentToVisit}}</div>
                    <span class="na-text" *ngIf="!v.personToMeet">—</span>
                  </td>
                  <td>
                    <div class="time-primary">{{v.checkInTime | date:'hh:mm a'}}</div>
                    <div class="time-date">{{v.checkInTime | date:'dd MMM'}}</div>
                  </td>
                  <td>
                    <div class="time-primary" *ngIf="v.checkOutTime">{{v.checkOutTime | date:'hh:mm a'}}</div>
                    <span class="na-text" *ngIf="!v.checkOutTime">—</span>
                  </td>
                  <td>
                    <span class="duration-text">{{getDuration(v.checkInTime, v.checkOutTime)}}</span>
                  </td>
                  <td>
                    <span class="status-badge status-{{v.status.toLowerCase()}}">
                      <mat-icon>{{v.status === 'Active' ? 'sensors' : v.status === 'CheckedOut' ? 'check_circle' : 'warning'}}</mat-icon>
                      {{v.status === 'CheckedOut' ? 'Out' : v.status}}
                    </span>
                  </td>
                  <td>
                    <div class="action-btns">
                      <button mat-icon-button color="primary" [disabled]="v.status === 'CheckedOut'"
                        (click)="checkOutVisitor(v)" matTooltip="Check Out Visitor">
                        <mat-icon>logout</mat-icon>
                      </button>
                      <button mat-icon-button color="warn"
                        (click)="deleteVisitor(v)" matTooltip="Delete Record">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ng-template #noVisitors>
            <div class="empty-state">
              <mat-icon>badge</mat-icon>
              <p>No visitors found for the selected criteria.</p>
              <button mat-stroked-button (click)="openVisitorDialog()">
                <mat-icon>add</mat-icon> Check In First Visitor
              </button>
            </div>
          </ng-template>
        </mat-tab>

        <!-- ═══ TAB 2: STUDENT GATE PASS ═══ -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">exit_to_app</mat-icon>
            Student Gate Pass
            <span class="pending-chip" *ngIf="stats.pendingGatePasses > 0">{{stats.pendingGatePasses}}</span>
          </ng-template>

          <!-- Filters -->
          <div class="filter-bar">
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Date</mat-label>
              <input matInput type="date" [(ngModel)]="gatePassDate" (change)="loadGatePasses()" />
              <mat-icon matPrefix>today</mat-icon>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="gatePassStatus" (selectionChange)="loadGatePasses()">
                <mat-option value="All">All</mat-option>
                <mat-option value="Pending">Pending</mat-option>
                <mat-option value="Approved">Approved</mat-option>
                <mat-option value="Rejected">Rejected</mat-option>
                <mat-option value="Returned">Returned</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-search">
              <mat-label>Search</mat-label>
              <input matInput [(ngModel)]="gatePassSearch" (input)="loadGatePasses()" placeholder="Student name, pass no..." />
              <mat-icon matPrefix>search</mat-icon>
            </mat-form-field>
          </div>

          <!-- Gate Pass Table -->
          <div class="fd-table-wrap" *ngIf="gatePasses.length > 0; else noPasses">
            <table class="fd-table">
              <thead>
                <tr>
                  <th>Pass #</th>
                  <th>Student</th>
                  <th>Reason</th>
                  <th>Parent / Guardian</th>
                  <th>Out Time</th>
                  <th>Expected Return</th>
                  <th>Status</th>
                  <th>Approved By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let g of gatePasses">
                  <td><span class="pass-num">{{g.gatePassNumber}}</span></td>
                  <td>
                    <div class="student-name">{{g.studentName}}</div>
                    <div class="student-meta">
                      {{g.className}} {{g.sectionName}}
                      <span *ngIf="g.rollNumber"> | Roll: {{g.rollNumber}}</span>
                    </div>
                  </td>
                  <td>
                    <span class="reason-badge">{{g.reasonCategory}}</span>
                    <div class="reason-text">{{g.reason | slice:0:50}}{{g.reason.length > 50 ? '...' : ''}}</div>
                  </td>
                  <td>
                    <div *ngIf="g.parentGuardianName">{{g.parentGuardianName}}</div>
                    <div class="dept-text" *ngIf="g.parentRelation">{{g.parentRelation}}</div>
                    <div class="visitor-phone" *ngIf="g.parentContactNumber">
                      <mat-icon style="font-size:11px; width:11px; height:11px;">phone</mat-icon>
                      {{g.parentContactNumber}}
                    </div>
                    <span class="na-text" *ngIf="!g.parentGuardianName">—</span>
                  </td>
                  <td>
                    <div class="time-primary">{{g.outDateTime | date:'hh:mm a'}}</div>
                    <div class="time-date">{{g.outDateTime | date:'dd MMM'}}</div>
                  </td>
                  <td>
                    <div class="time-primary" *ngIf="g.expectedReturnTime">{{g.expectedReturnTime | date:'hh:mm a'}}</div>
                    <div class="time-date" *ngIf="g.actualReturnTime" style="color:#16a34a;">
                      Ret: {{g.actualReturnTime | date:'hh:mm a'}}
                    </div>
                    <span class="na-text" *ngIf="!g.expectedReturnTime">—</span>
                  </td>
                  <td>
                    <span class="status-badge gp-status-{{g.status.toLowerCase()}}">
                      <mat-icon>{{getGpIcon(g.status)}}</mat-icon>
                      {{g.status}}
                    </span>
                  </td>
                  <td>
                    <div *ngIf="g.approvedBy" class="approver-text">{{g.approvedBy}}</div>
                    <div *ngIf="g.approvedAt" class="time-date">{{g.approvedAt | date:'hh:mm a'}}</div>
                    <span class="na-text" *ngIf="!g.approvedBy">—</span>
                  </td>
                  <td>
                    <div class="action-btns">
                      <button mat-icon-button style="color:#16a34a;" *ngIf="g.status === 'Pending'"
                        (click)="approveGatePass(g, 'Approve')" matTooltip="Approve">
                        <mat-icon>check_circle</mat-icon>
                      </button>
                      <button mat-icon-button color="warn" *ngIf="g.status === 'Pending'"
                        (click)="approveGatePass(g, 'Reject')" matTooltip="Reject">
                        <mat-icon>cancel</mat-icon>
                      </button>
                      <button mat-icon-button style="color:#2563eb;" *ngIf="g.status === 'Approved'"
                        (click)="markReturn(g)" matTooltip="Mark Student Returned">
                        <mat-icon>keyboard_return</mat-icon>
                      </button>
                      <button mat-icon-button color="warn"
                        (click)="deleteGatePass(g)" matTooltip="Delete">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ng-template #noPasses>
            <div class="empty-state">
              <mat-icon>exit_to_app</mat-icon>
              <p>No gate passes found for the selected criteria.</p>
              <button mat-stroked-button (click)="openGatePassDialog()">
                <mat-icon>add</mat-icon> Issue First Gate Pass
              </button>
            </div>
          </ng-template>
        </mat-tab>

      </mat-tab-group>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    .fd-page {
      font-family: 'Inter', sans-serif;
      background: #f8fafc;
      min-height: 100vh;
      padding: 0 0 40px;
    }

    /* ── Page Header ── */
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 24px 28px; background: #fff;
      border-bottom: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,.06);
    }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-icon-box {
      width: 52px; height: 52px; border-radius: 14px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(37,99,235,.3);
      color: #fff;
    }
    .page-title { font-size: 1.3rem; font-weight: 700; color: #0f172a; margin: 0; }
    .page-subtitle { font-size: 0.82rem; color: #64748b; margin: 2px 0 0; }
    .header-actions { display: flex; gap: 10px; align-items: center; }
    .refresh-btn { color: #64748b !important; border-color: #e2e8f0 !important; }
    .btn-visitor { background: linear-gradient(135deg, #0891b2, #0e7490) !important; color: #fff !important; }
    .btn-gatepass { background: linear-gradient(135deg, #2563eb, #1d4ed8) !important; color: #fff !important; }

    .fd-loader { margin: 0; }

    /* ── Stats ── */
    .stats-grid {
      display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px;
      padding: 20px 28px 0;
    }
    .stat-card {
      background: #fff; border-radius: 14px; padding: 18px 16px;
      display: flex; align-items: center; gap: 14px;
      box-shadow: 0 1px 6px rgba(0,0,0,.06); border: 1px solid #e2e8f0;
      transition: transform .2s, box-shadow .2s;
    }
    .stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,.1); }
    .stat-icon { font-size: 32px; width: 32px; height: 32px; }
    .stat-num { font-size: 1.8rem; font-weight: 700; line-height: 1; }
    .stat-label { font-size: 0.72rem; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: .3px; }
    .stat-blue .stat-icon  { color: #2563eb; }  .stat-blue .stat-num  { color: #2563eb; }
    .stat-green .stat-icon { color: #16a34a; }  .stat-green .stat-num { color: #16a34a; }
    .stat-slate .stat-icon { color: #475569; }  .stat-slate .stat-num { color: #475569; }
    .stat-orange .stat-icon { color: #ea580c; } .stat-orange .stat-num { color: #ea580c; }
    .stat-amber .stat-icon  { color: #d97706; } .stat-amber .stat-num  { color: #d97706; }
    .stat-teal .stat-icon   { color: #0891b2; } .stat-teal .stat-num   { color: #0891b2; }

    /* ── Tabs ── */
    .fd-tabs { margin: 20px 28px 0; background: #fff; border-radius: 14px; box-shadow: 0 1px 6px rgba(0,0,0,.06); overflow: hidden; }
    .tab-icon { font-size: 18px; margin-right: 6px; vertical-align: middle; }
    .pending-chip {
      background: #ef4444; color: #fff; font-size: 10px; font-weight: 700;
      border-radius: 10px; padding: 1px 6px; margin-left: 6px;
    }

    /* ── Filter Bar ── */
    .filter-bar {
      display: flex; gap: 12px; align-items: center; padding: 16px 20px 4px;
      flex-wrap: wrap;
    }
    .filter-field { width: 160px; }
    .filter-search { flex: 1; min-width: 220px; }

    /* ── Table ── */
    .fd-table-wrap { padding: 0 20px 20px; overflow-x: auto; }
    .fd-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
    .fd-table th {
      padding: 10px 12px; text-align: left;
      background: #f1f5f9; color: #475569;
      font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: .3px;
      border-bottom: 2px solid #e2e8f0; white-space: nowrap;
    }
    .fd-table td { padding: 12px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .fd-table tr:hover td { background: #f8fafc; }
    .fd-table tr.row-active td { background: #f0fdf4; }

    .pass-num { font-weight: 700; color: #2563eb; font-size: 0.8rem; font-family: monospace; }
    .visitor-org { font-size: 0.72rem; color: #64748b; margin-top: 2px; }
    .visitor-name { font-weight: 600; color: #0f172a; }
    .visitor-phone { font-size: 0.72rem; color: #64748b; display: flex; align-items: center; gap: 2px; margin-top: 2px; }
    .student-name { font-weight: 600; color: #0f172a; }
    .student-meta { font-size: 0.72rem; color: #64748b; margin-top: 2px; }
    .purpose-text { color: #334155; }
    .dept-text { font-size: 0.72rem; color: #64748b; }
    .approver-text { font-weight: 500; color: #0f172a; font-size: 0.8rem; }
    .na-text { color: #94a3b8; font-size: 0.8rem; }
    .time-primary { font-weight: 600; color: #0f172a; }
    .time-date { font-size: 0.72rem; color: #64748b; }
    .duration-text { font-size: 0.8rem; color: #475569; }
    .reason-text { font-size: 0.75rem; color: #64748b; margin-top: 2px; }

    /* ── Type Badge ── */
    .type-badge {
      display: inline-block; font-size: 0.68rem; font-weight: 600; padding: 1px 7px;
      border-radius: 10px; margin-top: 3px; text-transform: uppercase; letter-spacing: .3px;
    }
    .type-visitor    { background: #dbeafe; color: #1d4ed8; }
    .type-parent     { background: #d1fae5; color: #065f46; }
    .type-vendor     { background: #fef3c7; color: #92400e; }
    .type-official   { background: #ede9fe; color: #5b21b6; }
    .type-contractor { background: #fee2e2; color: #991b1b; }
    .type-delivery   { background: #e0f2fe; color: #0c4a6e; }
    .type-other      { background: #f1f5f9; color: #475569; }

    /* ── Reason Badge ── */
    .reason-badge {
      display: inline-block; font-size: 0.68rem; font-weight: 600; padding: 1px 7px;
      border-radius: 10px; background: #ede9fe; color: #5b21b6; margin-bottom: 3px;
    }

    /* ── Status Badge ── */
    .status-badge {
      display: inline-flex; align-items: center; gap: 3px; font-size: 0.72rem;
      font-weight: 600; padding: 3px 8px; border-radius: 20px; white-space: nowrap;
    }
    .status-badge mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .status-active   { background: #d1fae5; color: #065f46; }
    .status-checkedout { background: #e2e8f0; color: #475569; }
    .status-overstay { background: #fee2e2; color: #991b1b; }

    .gp-status-pending  { background: #fef3c7; color: #92400e; }
    .gp-status-approved { background: #d1fae5; color: #065f46; }
    .gp-status-rejected { background: #fee2e2; color: #991b1b; }
    .gp-status-returned { background: #dbeafe; color: #1d4ed8; }
    .gp-status-expired  { background: #f1f5f9; color: #475569; }

    /* ── Action Buttons ── */
    .action-btns { display: flex; gap: 2px; }

    /* ── Empty State ── */
    .empty-state {
      text-align: center; padding: 60px 20px; color: #94a3b8;
    }
    .empty-state mat-icon { font-size: 56px; width: 56px; height: 56px; display: block; margin: 0 auto 12px; opacity: .4; }
    .empty-state p { margin: 0 0 16px; font-size: 1rem; }

    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .spin { animation: spin 1s linear infinite; }
  `]
})
export class VisitorsComponent implements OnInit {

  // ── State ─────────────────────────────────────────────────────
  loading = false;
  activeTab = 0;

  // Stats
  stats: FrontDeskStats = {
    totalVisitorsToday: 0, activeVisitors: 0, checkedOutToday: 0,
    gatePassesToday: 0, pendingGatePasses: 0, approvedGatePassesToday: 0
  };

  // Visitors
  visitors: VisitorLogDto[] = [];
  visitorDate = new Date().toISOString().split('T')[0];
  visitorStatus = 'All';
  visitorType = 'All';
  visitorSearch = '';
  visitorTypes = ['Visitor', 'Parent', 'Vendor', 'Official', 'Contractor', 'Delivery', 'Other'];

  // Gate Passes
  gatePasses: StudentGatePassDto[] = [];
  gatePassDate = '';
  gatePassStatus = 'All';
  gatePassSearch = '';

  // Students (for gate pass dialog dropdown)
  students: StudentItem[] = [];

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private confirm: ConfirmDialogService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Auto-switch to Gate Pass tab if routed to /front-desk/gate-passes
    this.route.url.subscribe(segments => {
      if (segments.some(s => s.path === 'gate-passes')) this.activeTab = 1;
    });
    this.loadAll();
    this.loadStudents();
  }

  loadAll() {
    this.loadStats();
    this.loadVisitors();
    this.loadGatePasses();
  }

  loadStats() {
    this.http.get<FrontDeskStats>(`${API_BASE}/front-desk/stats`).subscribe({
      next: (s) => this.stats = s,
      error: () => {}
    });
  }

  loadVisitors() {
    this.loading = true;
    const params: any = { status: this.visitorStatus, visitorType: this.visitorType };
    if (this.visitorDate) params.date = this.visitorDate;
    if (this.visitorSearch) params.search = this.visitorSearch;

    this.http.get<VisitorLogDto[]>(`${API_BASE}/front-desk/visitors`, { params }).subscribe({
      next: (d) => { this.visitors = d; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  loadGatePasses() {
    this.loading = true;
    const params: any = { status: this.gatePassStatus };
    if (this.gatePassDate) params.date = this.gatePassDate;
    if (this.gatePassSearch) params.search = this.gatePassSearch;

    this.http.get<StudentGatePassDto[]>(`${API_BASE}/front-desk/gate-passes`, { params }).subscribe({
      next: (d) => { this.gatePasses = d; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  loadStudents() {
    this.http.get<any[]>(`${API_BASE}/students`).subscribe({
      next: (d) => {
        this.students = d.map((s: any) => ({
          id: s.id,
          studentName: s.studentName,
          rollNumber: s.rollNumber,
          className: s.className,
          sectionName: s.sectionName
        }));
      },
      error: () => {}
    });
  }

  // ── Visitor Actions ────────────────────────────────────────────
  openVisitorDialog() {
    const ref = this.dialog.open(VisitorCheckInDialogComponent, {
      disableClose: true,
      panelClass: 'fd-dialog-panel'
    });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.loadAll();
      }
    });
  }

  checkOutVisitor(v: VisitorLogDto) {
    this.confirm.confirm(
      'Check Out Visitor',
      `Mark <strong>${v.visitorName}</strong> as checked out?`,
      'Check Out', 'cancel'
    ).subscribe(ok => {
      if (!ok) return;
      this.http.put(`${API_BASE}/front-desk/visitors/${v.id}/checkout`, null).subscribe({
        next: () => this.loadAll(),
        error: () => {}
      });
    });
  }

  deleteVisitor(v: VisitorLogDto) {
    this.confirm.confirm(
      'Delete Record',
      `Delete visitor record for <strong>${v.visitorName}</strong>?`,
      'Delete', 'cancel'
    ).subscribe(ok => {
      if (!ok) return;
      this.http.delete(`${API_BASE}/front-desk/visitors/${v.id}`).subscribe({
        next: () => this.loadAll(),
        error: () => {}
      });
    });
  }

  // ── Gate Pass Actions ─────────────────────────────────────────
  openGatePassDialog() {
    const ref = this.dialog.open(GatePassDialogComponent, {
      data: { students: this.students },
      disableClose: true,
      panelClass: 'fd-dialog-panel'
    });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.activeTab = 1;
        this.loadAll();
      }
    });
  }

  approveGatePass(g: StudentGatePassDto, action: 'Approve' | 'Reject') {
    const ref = this.dialog.open(ApproveGatePassDialogComponent, {
      data: { id: g.id, action, gatePassNumber: g.gatePassNumber, studentName: g.studentName },
      disableClose: true
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.loadAll();
    });
  }

  markReturn(g: StudentGatePassDto) {
    this.confirm.confirm(
      'Mark Student Returned',
      `Mark <strong>${g.studentName}</strong> as returned to campus?`,
      'Mark Returned', 'cancel'
    ).subscribe(ok => {
      if (!ok) return;
      this.http.put(`${API_BASE}/front-desk/gate-passes/${g.id}/return`, {}).subscribe({
        next: () => this.loadAll(),
        error: () => {}
      });
    });
  }

  deleteGatePass(g: StudentGatePassDto) {
    this.confirm.confirm(
      'Delete Gate Pass',
      `Delete gate pass <strong>${g.gatePassNumber}</strong>?`,
      'Delete', 'cancel'
    ).subscribe(ok => {
      if (!ok) return;
      this.http.delete(`${API_BASE}/front-desk/gate-passes/${g.id}`).subscribe({
        next: () => this.loadAll(),
        error: () => {}
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────
  getDuration(checkIn: string, checkOut?: string): string {
    const end = checkOut ? new Date(checkOut) : new Date();
    const diff = Math.max(0, end.getTime() - new Date(checkIn).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  getGpIcon(status: string): string {
    const icons: Record<string, string> = {
      Pending: 'pending', Approved: 'check_circle', Rejected: 'cancel',
      Returned: 'keyboard_return', Expired: 'timer_off'
    };
    return icons[status] || 'help';
  }
}
