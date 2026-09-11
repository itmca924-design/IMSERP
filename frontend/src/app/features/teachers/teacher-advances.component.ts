import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TeacherSelectorComponent } from './teacher-selector.component';
import { API_BASE, TeacherDto, AdvanceDto } from './teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-teacher-advances',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatProgressBarModule,
    MatTooltipModule, TeacherSelectorComponent
  ],
  template: `
<div class="page-container">
  <div class="page-header">
    <div>
      <h1 class="page-title"><mat-icon>account_balance_wallet</mat-icon> Salary Advances</h1>
      <p class="page-subtitle">Advance salary requests — submit karo, approve/reject karo, aur ledger dekho.</p>
    </div>
  </div>

  <app-teacher-selector [preSelectId]="preSelectId" (teacherSelected)="onTeacherSelected($event)"></app-teacher-selector>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <div *ngIf="!selectedTeacher" class="no-selection">
    <mat-icon>person_search</mat-icon>
    <p>Upar se teacher select karo advances dekhne ke liye.</p>
  </div>

  <div *ngIf="selectedTeacher">
    <div class="section-header">
      <h3>{{selectedTeacher.fullName}} — Salary Advance Ledger</h3>
      <button mat-raised-button color="primary" (click)="showForm = !showForm" [disabled]="loading">
        <mat-icon>{{showForm ? 'close' : 'add'}}</mat-icon>
        {{showForm ? 'Cancel' : '+ Advance Request Karo'}}
      </button>
    </div>

    <!-- Advance Request Form -->
    <mat-card class="form-card mat-elevation-z1" *ngIf="showForm">
      <div class="form-title">
        <mat-icon>send_money</mat-icon>
        <strong>New Advance Request</strong>
      </div>
      <div class="form-row">
        <mat-form-field appearance="outline">
          <mat-label>Amount ₹ *</mat-label>
          <input matInput type="number" [(ngModel)]="newAdvance.amount" min="1" placeholder="5000">
          <mat-hint>Minimum ₹1</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline" style="flex:3">
          <mat-label>Reason *</mat-label>
          <input matInput [(ngModel)]="newAdvance.reason" placeholder="Medical emergency, personal, etc." maxlength="200">
          <mat-hint align="end">{{(newAdvance.reason || '').length}}/200</mat-hint>
        </mat-form-field>
      </div>

      <!-- Pending advance warning -->
      <div class="pending-warn" *ngIf="hasPendingOrApproved">
        <mat-icon>warning_amber</mat-icon>
        <span>
          Is teacher ke <strong>{{pendingCount}} pending</strong> aur <strong>{{approvedCount}} approved</strong> advance(s) hain
          (Total: <strong>₹{{totalApprovedAmt | number}}</strong> approved).
          Naya request submit karne se pehle existing advances review karein.
        </span>
      </div>

      <div class="form-actions">
        <button mat-button (click)="showForm = false; resetForm()">Cancel</button>
        <button mat-raised-button color="primary" (click)="requestAdvance()"
          [disabled]="!newAdvance.amount || newAdvance.amount <= 0 || !(newAdvance.reason || '').trim() || submitting">
          <mat-icon>{{submitting ? 'hourglass_empty' : 'send'}}</mat-icon>
          {{submitting ? 'Submitting...' : 'Request Submit Karo'}}
        </button>
      </div>
    </mat-card>

    <!-- Stats Row -->
    <div class="stats-row" *ngIf="advances.length > 0 || totalApprovedAmt > 0">
      <div class="stat-chip pending">
        <span>{{pendingCount}}</span><small>Pending</small>
      </div>
      <div class="stat-chip approved">
        <span>{{approvedCount}}</span><small>Approved</small>
      </div>
      <div class="stat-chip adjusted">
        <span>{{adjustedCount}}</span><small>Adjusted</small>
      </div>
      <div class="stat-chip rejected" *ngIf="rejectedCount > 0">
        <span>{{rejectedCount}}</span><small>Rejected</small>
      </div>
      <div class="stat-chip total-amt">
        <span>₹{{totalApprovedAmt | number}}</span><small>Total Approved (Pending Adjust)</small>
      </div>
      <div class="stat-chip recovered" *ngIf="totalAdjustedAmt > 0">
        <span>₹{{totalAdjustedAmt | number}}</span><small>Total Recovered</small>
      </div>
    </div>

    <!-- Advances Ledger Table -->
    <mat-card class="table-card mat-elevation-z1" *ngIf="advances.length > 0">
      <div class="table-header-strip">
        <span><mat-icon class="strip-icon">list_alt</mat-icon> Advance Ledger History</span>
        <span class="table-count">{{advances.length}} record(s)</span>
      </div>
      <table class="adv-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Request Date</th>
            <th>Amount</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Approved Date</th>
            <th>Adjusted In</th>
            <th class="text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let a of advances; let i = index" [class.adjusted-row]="a.status === 'Adjusted'" [class.pending-row]="a.status === 'Pending'">
            <td class="row-num">{{i + 1}}</td>
            <td>{{a.requestDate | date:'dd MMM yyyy'}}</td>
            <td><strong class="amount-cell">₹{{a.amount | number}}</strong></td>
            <td class="reason-cell">{{a.reason || '—'}}</td>
            <td>
              <span class="status-badge" [ngClass]="a.status.toLowerCase()">
                <mat-icon class="badge-icon">
                  {{a.status === 'Approved' ? 'check_circle' :
                    a.status === 'Pending'  ? 'schedule' :
                    a.status === 'Adjusted' ? 'account_balance_wallet' : 'cancel'}}
                </mat-icon>
                {{a.status}}
              </span>
            </td>
            <td>{{a.approvedDate ? (a.approvedDate | date:'dd MMM yyyy') : '—'}}</td>
            <td>
              <!-- Adjusted In Month/Year — This is the Ledger column -->
              <span class="adjusted-in-chip" *ngIf="a.status === 'Adjusted' && a.adjustedInMonth && a.adjustedInYear">
                <mat-icon class="inline-icon">payments</mat-icon>
                {{getMonthName(a.adjustedInMonth!)}} {{a.adjustedInYear}}
              </span>
              <span *ngIf="a.status === 'Approved'" class="pending-adjust-chip">
                <mat-icon class="inline-icon">pending_actions</mat-icon>
                Next salary mein
              </span>
              <span *ngIf="a.status !== 'Adjusted' && a.status !== 'Approved'" style="color:#94a3b8;font-size:.8rem;">—</span>
            </td>
            <td class="text-center">
              <div class="action-btns">
                <button mat-icon-button color="primary" *ngIf="a.status === 'Pending'"
                  (click)="approve(a.id, true)" matTooltip="Approve karo">
                  <mat-icon>check_circle</mat-icon>
                </button>
                <button mat-icon-button color="warn" *ngIf="a.status === 'Pending'"
                  (click)="approve(a.id, false)" matTooltip="Reject karo">
                  <mat-icon>cancel</mat-icon>
                </button>
                <span *ngIf="a.status === 'Adjusted'" class="done-label">
                  <mat-icon style="font-size:15px;width:15px;height:15px;color:#2e7d32">check</mat-icon> Recovered
                </span>
                <span *ngIf="a.status === 'Rejected'" style="color:#94a3b8;font-size:.78rem;">Rejected</span>
                <span *ngIf="a.status === 'Approved'" style="color:#1565c0;font-size:.78rem;">Awaiting salary</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Ledger Summary Footer -->
      <div class="ledger-footer">
        <div class="ledger-item">
          <span class="lk">Total Advances Requested:</span>
          <span class="lv">₹{{totalRequestedAmt | number}}</span>
        </div>
        <div class="ledger-item">
          <span class="lk">Total Approved (Outstanding):</span>
          <span class="lv outstanding">₹{{totalApprovedAmt | number}}</span>
        </div>
        <div class="ledger-item">
          <span class="lk">Total Recovered via Salary:</span>
          <span class="lv recovered">₹{{totalAdjustedAmt | number}}</span>
        </div>
      </div>
    </mat-card>

    <div class="empty-state" *ngIf="advances.length === 0 && !loading && !showForm">
      <mat-icon>account_balance_wallet</mat-icon>
      <p>Koi advance request nahi hai abhi tak.</p>
      <small>"+Advance Request Karo" button se naya request submit karein.</small>
    </div>
  </div>
</div>
  `,
  styles: [`
    .page-container { display:flex; flex-direction:column; gap:20px; }
    .page-header { display:flex; justify-content:space-between; align-items:center; }
    .page-title { font-size:1.5rem; font-weight:700; margin:0; color:#1976d2; display:flex; align-items:center; gap:8px;
      mat-icon{font-size:1.5rem;width:1.5rem;height:1.5rem;} }
    .page-subtitle { color:#666; margin:4px 0 0; font-size:.9rem; }
    .no-selection { display:flex; flex-direction:column; align-items:center; padding:60px; color:#94a3b8; background:#f8fafc; border-radius:12px;
      mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px;} p{margin:0;font-size:.95rem;} }
    .section-header { display:flex; justify-content:space-between; align-items:center;
      h3{margin:0;font-weight:700;font-size:1.05rem;} }
    .form-card { padding:20px; border-radius:10px; }
    .form-title { display:flex; align-items:center; gap:8px; margin-bottom:14px; font-size:1rem;
      mat-icon{color:#1976d2;} strong{color:#1e293b;} }
    .form-row { display:flex; flex-wrap:wrap; gap:12px; mat-form-field{flex:1;min-width:160px;} }
    .pending-warn {
      display:flex; align-items:flex-start; gap:8px; background:#fff3e0; border:1px solid #ffe0b2;
      border-radius:8px; padding:10px 14px; margin-top:10px; font-size:.85rem; color:#e65100;
      mat-icon{color:#f57c00;font-size:20px;width:20px;height:20px;flex-shrink:0;margin-top:2px;}
      strong{color:#bf360c;}
    }
    .form-actions { display:flex; justify-content:flex-end; gap:12px; margin-top:16px; }
    .stats-row { display:flex; gap:12px; flex-wrap:wrap; }
    .stat-chip { text-align:center; padding:14px 20px; border-radius:10px; min-width:100px;
      span{display:block;font-size:1.25rem;font-weight:700;} small{font-size:.7rem;color:#64748b;display:block;margin-top:2px;}
      &.pending{background:#fff8e1; span{color:#f57f17;}}
      &.approved{background:#e8f5e9; span{color:#2e7d32;}}
      &.adjusted{background:#e3f2fd; span{color:#1565c0;}}
      &.rejected{background:#ffebee; span{color:#c62828;}}
      &.total-amt{background:#fff3e0; span{color:#e65100;font-size:1.1rem;}}
      &.recovered{background:#e8f5e9; span{color:#1b5e20;font-size:1.1rem;}}
    }
    .table-card { border-radius:10px; overflow:hidden; padding:0; }
    .table-header-strip {
      display:flex; justify-content:space-between; align-items:center;
      padding:12px 16px; background:#f8fafc; border-bottom:1px solid #e2e8f0;
      font-size:.9rem; font-weight:600; color:#334155;
      .strip-icon{font-size:18px;width:18px;height:18px;vertical-align:middle;margin-right:6px;color:#1976d2;}
      .table-count{font-size:.78rem;color:#64748b;font-weight:400;}
    }
    .adv-table { width:100%; border-collapse:collapse; font-size:.85rem;
      th,td{padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:left;}
      th{background:#f8fafc;font-weight:600;color:#64748b;font-size:.76rem;text-transform:uppercase;letter-spacing:.3px;}
      tr:last-child td{border-bottom:none;}
      tr:hover td{background:#f8fafc;}
      &.adjusted-row td{background:#f0f9ff;}
      &.pending-row td{background:#fffbeb;}
    }
    .row-num{color:#94a3b8;font-size:.8rem;font-weight:500;}
    .amount-cell{color:#1e293b;font-size:.9rem;}
    .reason-cell{color:#475569;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .text-center{text-align:center;}
    .status-badge {
      display:inline-flex; align-items:center; gap:4px;
      padding:3px 10px; border-radius:10px; font-size:.74rem; font-weight:600;
      .badge-icon{font-size:13px;width:13px;height:13px;}
      &.pending{background:#fff8e1;color:#f57f17;}
      &.approved{background:#e8f5e9;color:#2e7d32;}
      &.rejected{background:#ffebee;color:#c62828;}
      &.adjusted{background:#e3f2fd;color:#1565c0;}
    }
    .adjusted-in-chip {
      display:inline-flex; align-items:center; gap:4px;
      background:#e3f2fd; color:#1565c0; font-size:.75rem; padding:3px 8px;
      border-radius:8px; font-weight:600; border:1px solid #bbdefb;
      .inline-icon{font-size:13px;width:13px;height:13px;}
    }
    .pending-adjust-chip {
      display:inline-flex; align-items:center; gap:4px;
      background:#fef3c7; color:#92400e; font-size:.74rem; padding:3px 8px;
      border-radius:8px; font-weight:600; border:1px solid #fde68a;
      .inline-icon{font-size:13px;width:13px;height:13px;}
    }
    .inline-icon{font-size:14px;width:14px;height:14px;}
    .action-btns{display:flex;align-items:center;justify-content:center;gap:4px;}
    .done-label{display:flex;align-items:center;gap:2px;font-size:.75rem;color:#2e7d32;font-weight:600;}
    /* Ledger Footer */
    .ledger-footer {
      display:flex; gap:0; border-top:2px solid #e2e8f0; background:#f8fafc;
      .ledger-item{flex:1;padding:12px 16px;border-right:1px solid #e2e8f0;
        &:last-child{border-right:none;}
        .lk{display:block;font-size:.72rem;color:#64748b;text-transform:uppercase;font-weight:600;letter-spacing:.3px;margin-bottom:4px;}
        .lv{font-size:1rem;font-weight:700;color:#1e293b;}
        .lv.outstanding{color:#e65100;}
        .lv.recovered{color:#2e7d32;}
      }
    }
    .empty-state { display:flex; flex-direction:column; align-items:center; padding:48px; color:#94a3b8; background:#f8fafc; border-radius:12px;
      mat-icon{font-size:44px;width:44px;height:44px;margin-bottom:10px;}
      p{margin:0;font-size:.95rem;font-weight:600;}
      small{margin-top:4px;font-size:.82rem;}
    }
  `]
})
export class TeacherAdvancesComponent implements OnInit {
  private api = API_BASE;
  selectedTeacher: TeacherDto | null = null;
  preSelectId: string | null = null;
  advances: AdvanceDto[] = [];
  loading = false;
  showForm = false;
  submitting = false;
  newAdvance: { amount: number; reason: string } = { amount: 0, reason: '' };

  months = ['January','February','March','April','May','June','July','August','September',
            'October','November','December'];

  get pendingCount()  { return this.advances.filter(a => a.status === 'Pending').length; }
  get approvedCount() { return this.advances.filter(a => a.status === 'Approved').length; }
  get adjustedCount() { return this.advances.filter(a => a.status === 'Adjusted').length; }
  get rejectedCount() { return this.advances.filter(a => a.status === 'Rejected').length; }

  get hasPendingOrApproved() { return this.pendingCount > 0 || this.approvedCount > 0; }

  get totalRequestedAmt() { return this.advances.reduce((s, a) => s + a.amount, 0); }
  get totalApprovedAmt()  { return this.advances.filter(a => a.status === 'Approved').reduce((s, a) => s + a.amount, 0); }
  get totalAdjustedAmt()  { return this.advances.filter(a => a.status === 'Adjusted').reduce((s, a) => s + a.amount, 0); }

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(p => { if (p['teacherId']) this.preSelectId = p['teacherId']; });
  }

  onTeacherSelected(t: TeacherDto) {
    this.selectedTeacher = t;
    this.showForm = false;
    this.resetForm();
    this.loadAdvances();
  }

  loadAdvances() {
    if (!this.selectedTeacher) return;
    this.loading = true;
    this.http.get<AdvanceDto[]>(`${this.api}/teachers/${this.selectedTeacher.id}/advances`).subscribe({
      next: r => { this.advances = r; this.loading = false; },
      error: () => this.loading = false
    });
  }

  resetForm() {
    this.newAdvance = { amount: 0, reason: '' };
  }

  requestAdvance() {
    if (!this.selectedTeacher) return;
    const amount = Number(this.newAdvance.amount);
    const reason = (this.newAdvance.reason || '').trim();

    // Validations
    if (!amount || amount <= 0) {
      this.confirmDialog.alert('Validation Error', 'Amount must be greater than ₹0.', 'warning');
      return;
    }
    if (!reason) {
      this.confirmDialog.alert('Validation Error', 'Reason required hai advance request ke liye.', 'warning');
      return;
    }

    this.submitting = true;
    this.http.post<AdvanceDto>(`${this.api}/teachers/advances`, {
      teacherId: this.selectedTeacher.id,
      amount,
      reason
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.showForm = false;
        this.resetForm();
        this.loadAdvances();
        this.confirmDialog.alert(
          'Advance Requested ✓',
          `₹${amount.toLocaleString('en-IN')} ka advance request successfully submit ho gaya! Admin approval ka wait karein.`,
          'success'
        );
      },
      error: e => {
        this.submitting = false;
        this.confirmDialog.alert('Error', e?.error?.message || 'Error submitting advance request. Please try again.', 'danger');
      }
    });
  }

  approve(id: string, doApprove: boolean) {
    const title = doApprove ? 'Approve Salary Advance' : 'Reject Salary Advance';
    const msg   = doApprove
      ? 'Are you sure you want to approve this faculty salary advance? It will be auto-deducted from next salary payment.'
      : 'Are you sure you want to reject this salary advance request?';
    const btn   = doApprove ? 'Approve' : 'Reject';
    const type  = doApprove ? 'info' : 'danger';

    this.confirmDialog.confirm(title, msg, btn, 'Cancel', type).subscribe(confirmed => {
      if (!confirmed) return;
      this.http.put(`${this.api}/teachers/advances/${id}/approve`, { approve: doApprove }).subscribe({
        next: () => {
          this.loadAdvances();
          this.confirmDialog.alert(
            'Status Updated ✓',
            doApprove
              ? 'Advance approved! Yeh amount next salary payment mein auto-deduct hoga.'
              : 'Advance rejected successfully.',
            doApprove ? 'success' : 'warning'
          );
        },
        error: e => this.confirmDialog.alert('Error', e?.error?.message || 'Status update failed.', 'danger')
      });
    });
  }

  getMonthName(m: number): string {
    return this.months[m - 1] || '';
  }
}
