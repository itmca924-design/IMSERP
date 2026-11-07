import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { TeacherSelectorComponent } from './teacher-selector.component';
import { API_BASE, TeacherDto, AdvanceDto } from './teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-teacher-advances',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatProgressBarModule, MatSelectModule,
    MatTooltipModule, TeacherSelectorComponent
  ],
  template: `
<div class="page-container">
  <div class="page-header">
    <div>
      <h1 class="page-title"><mat-icon>account_balance_wallet</mat-icon> Salary Advances & EMI Recovery</h1>
      <p class="page-subtitle">Manage staff salary advances, flexible EMI installment tenures, approval workflows, and live recovery ledger.</p>
    </div>
  </div>

  <app-teacher-selector [preSelectId]="preSelectId" (teacherSelected)="onTeacherSelected($event)"></app-teacher-selector>

  @if (loading) {
    <mat-progress-bar mode="indeterminate"></mat-progress-bar>
  }

  @if (!selectedTeacher) {
    <div class="no-selection">
      <mat-icon>person_search</mat-icon>
      <p>Please select a faculty member above to view and manage their salary advances.</p>
    </div>
  }

  @if (selectedTeacher) {
    <div>
      <div class="section-header">
        <h3>{{selectedTeacher.fullName}} — Advance & EMI Recovery Ledger</h3>
        <button color="primary" (click)="toggleForm()" [disabled]="loading" matButton="filled">
          <mat-icon>{{showForm ? 'close' : 'add'}}</mat-icon>
          {{showForm ? 'Cancel' : 'Request Salary Advance'}}
        </button>
      </div>

      <!-- Advance Request Form (Angular Material Reactive Form) -->
      @if (showForm) {
        <mat-card class="form-card mat-elevation-z1">
          <div class="form-title">
            <mat-icon>send_money</mat-icon>
            <strong>New Advance Request (With Structured EMI)</strong>
          </div>
          <form [formGroup]="advanceForm" (ngSubmit)="requestAdvance()">
            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Advance Amount (₹) *</mat-label>
                <input matInput type="number" formControlName="amount" min="1" placeholder="5000" (input)="recalculateEmi()">
                <mat-hint>Principal advance amount</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Tenure (Months) *</mat-label>
                <mat-select formControlName="installmentTenureMonths" (selectionChange)="recalculateEmi()">
                  <mat-option [value]="1">1 Month (Full Deduct Next Salary)</mat-option>
                  <mat-option [value]="2">2 Months (Equal Split)</mat-option>
                  <mat-option [value]="3">3 Months (Quarterly EMI)</mat-option>
                  <mat-option [value]="4">4 Months</mat-option>
                  <mat-option [value]="5">5 Months</mat-option>
                  <mat-option [value]="6">6 Months (Half-Yearly)</mat-option>
                  <mat-option [value]="7">7 Months</mat-option>
                  <mat-option [value]="8">8 Months</mat-option>
                  <mat-option [value]="9">9 Months</mat-option>
                  <mat-option [value]="10">10 Months</mat-option>
                  <mat-option [value]="11">11 Months</mat-option>
                  <mat-option [value]="12">12 Months (1 Year)</mat-option>
                  <mat-option [value]="18">18 Months (1.5 Years)</mat-option>
                  <mat-option [value]="24">24 Months (2 Years)</mat-option>
                </mat-select>
                <mat-hint>Repayment installments</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Monthly EMI (₹/Month) *</mat-label>
                <input matInput type="number" formControlName="monthlyInstallment" min="1">
                <mat-hint>Auto-calculated monthly deduction</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline" style="flex:2">
                <mat-label>Reason & Purpose *</mat-label>
                <input matInput formControlName="reason" placeholder="Medical emergency, festival, family need, etc." maxlength="200">
                <mat-hint align="end">{{(advanceForm.get('reason')?.value || '').length}}/200</mat-hint>
              </mat-form-field>
            </div>

            <!-- Pending advance warning -->
            @if (hasPendingOrApproved) {
              <div class="pending-warn">
                <mat-icon>warning_amber</mat-icon>
                <span>
                  Faculty member has <strong>{{pendingCount}} pending</strong> and <strong>{{approvedCount}} approved</strong> advance(s)
                  (Total active balance: <strong>₹{{totalOutstandingAmt | number}}</strong>).
                  Please verify repayment capacity before submitting additional advance requests.
                </span>
              </div>
            }

            <div class="form-actions">
              <button type="button" (click)="toggleForm()" matButton="filled" class="app-button-cancel">Cancel</button>
              <button color="primary" type="submit" [disabled]="advanceForm.invalid || submitting" matButton="filled">
                <mat-icon>{{submitting ? 'hourglass_empty' : 'send'}}</mat-icon>
                {{submitting ? 'Submitting...' : 'Submit Advance Request'}}
              </button>
            </div>
          </form>
        </mat-card>
      }

      <!-- Stats Row -->
      @if (advances.length > 0 || totalApprovedAmt > 0) {
        <div class="stats-row">
          <div class="stat-chip pending">
            <span>{{pendingCount}}</span><small>Pending</small>
          </div>
          <div class="stat-chip approved">
            <span>{{approvedCount}}</span><small>Active Advances</small>
          </div>
          <div class="stat-chip adjusted">
            <span>{{adjustedCount}}</span><small>Fully Settled</small>
          </div>
          @if (rejectedCount > 0) {
            <div class="stat-chip rejected">
              <span>{{rejectedCount}}</span><small>Rejected</small>
            </div>
          }
          <div class="stat-chip total-amt">
            <span>₹{{totalOutstandingAmt | number}}</span><small>Total Outstanding Balance</small>
          </div>
          <div class="stat-chip recovered">
            <span>₹{{totalAdjustedAmt | number}}</span><small>Total Recovered to Date</small>
          </div>
        </div>
      }

      <!-- Advances Ledger Table -->
      @if (advances.length > 0) {
        <mat-card class="table-card mat-elevation-z1">
          <div class="table-header-strip">
            <span><mat-icon class="strip-icon">list_alt</mat-icon> Advance &amp; EMI Repayment Ledger</span>
            <span class="table-count">{{advances.length}} record(s)</span>
          </div>
          <div class="table-responsive">
            <table class="adv-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Request Date</th>
                  <th>Principal Amount</th>
                  <th>EMI Schedule</th>
                  <th>Repayment Status</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Approved Date</th>
                  <th>Adjusted In</th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (a of advances; track a; let i = $index) {
                  <tr [class.adjusted-row]="a.status === 'Adjusted'" [class.pending-row]="a.status === 'Pending'">
                    <td class="row-num">{{i + 1}}</td>
                    <td>{{a.requestDate | date:'dd MMM yyyy'}}</td>
                    <td><strong class="amount-cell">₹{{a.amount | number}}</strong></td>
                    <td>
                      @if (a.monthlyInstallment && a.monthlyInstallment > 0) {
                        <span class="emi-chip">
                          ₹{{a.monthlyInstallment | number}}/mo ({{a.installmentTenureMonths || 1}}m)
                        </span>
                      } @else {
                        <span>Lump-sum</span>
                      }
                    </td>
                    <td>
                      <div class="repay-box">
                        <span class="repay-txt">₹{{(a.recoveredAmount || 0) | number}} of ₹{{a.amount | number}}</span>
                        <div class="progress-track">
                          <div class="progress-fill" [style.width.%]="getRepaymentPercent(a)"></div>
                        </div>
                        <span class="rem-bal">Rem: ₹{{(a.remainingBalance ?? (a.amount - (a.recoveredAmount || 0))) | number}}</span>
                      </div>
                    </td>
                    <td class="reason-cell" [matTooltip]="a.reason || ''">{{a.reason || '—'}}</td>
                    <td>
                      <span class="status-badge" [ngClass]="a.status.toLowerCase()">
                        <mat-icon class="badge-icon">
                          {{a.status === 'Approved' ? 'check_circle' :
                          a.status === 'Pending'  ? 'schedule' :
                          a.status === 'Adjusted' ? 'task_alt' : 'cancel'}}
                        </mat-icon>
                        {{a.status === 'Adjusted' ? 'Settled' : a.status}}
                      </span>
                    </td>
                    <td>{{a.approvedDate ? (a.approvedDate | date:'dd MMM yyyy') : '—'}}</td>
                    <td>
                      @if (a.status === 'Adjusted' && a.adjustedInMonth && a.adjustedInYear) {
                        <span class="adjusted-in-chip">
                          <mat-icon class="inline-icon">payments</mat-icon>
                          {{getMonthName(a.adjustedInMonth!)}} {{a.adjustedInYear}}
                        </span>
                      }
                      @if (a.status === 'Approved') {
                        <span class="pending-adjust-chip">
                          <mat-icon class="inline-icon">pending_actions</mat-icon>
                          ₹{{a.monthlyInstallment || a.amount | number}} in next salary
                        </span>
                      }
                      @if (a.status !== 'Adjusted' && a.status !== 'Approved') {
                        <span style="color:#94a3b8;font-size:.8rem;">—</span>
                      }
                    </td>
                    <td class="text-center">
                      <div class="action-btns">
                        @if (a.status === 'Pending') {
                          <button color="primary"
                            (click)="approve(a.id, true)" matTooltip="Approve request" mat-icon-button>
                            <mat-icon>check_circle</mat-icon>
                          </button>
                          <button color="warn"
                            (click)="approve(a.id, false)" matTooltip="Reject request" mat-icon-button>
                            <mat-icon>cancel</mat-icon>
                          </button>
                        }
                        @if (a.status === 'Adjusted') {
                          <span class="done-label">
                            <mat-icon style="font-size:15px;width:15px;height:15px;color:#2e7d32">check</mat-icon> Recovered
                          </span>
                        }
                        @if (a.status === 'Rejected') {
                          <span style="color:#94a3b8;font-size:.78rem;">Rejected</span>
                        }
                        @if (a.status === 'Approved') {
                          <span style="color:#1565c0;font-size:.78rem;">Active Recovery</span>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Ledger Summary Footer -->
          <div class="ledger-footer">
            <div class="ledger-item">
              <span class="lk">Total Advances Requested:</span>
              <span class="lv">₹{{totalRequestedAmt | number}}</span>
            </div>
            <div class="ledger-item">
              <span class="lk">Total Approved Principal:</span>
              <span class="lv">₹{{totalApprovedAmt | number}}</span>
            </div>
            <div class="ledger-item">
              <span class="lk">Active Outstanding Balance:</span>
              <span class="lv outstanding">₹{{totalOutstandingAmt | number}}</span>
            </div>
            <div class="ledger-item">
              <span class="lk">Total Recovered via Salary:</span>
              <span class="lv recovered">₹{{totalAdjustedAmt | number}}</span>
            </div>
          </div>
        </mat-card>
      }

      @if (advances.length === 0 && !loading && !showForm) {
        <div class="empty-state">
          <mat-icon>account_balance_wallet</mat-icon>
          <p>No advance requests recorded yet for this faculty member.</p>
          <small>Click "Request Salary Advance" above to submit a new request.</small>
        </div>
      }
    </div>
  }
</div>
`,
  changeDetection: ChangeDetectionStrategy.Eager,
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
    .table-responsive { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .table-header-strip {
      display:flex; justify-content:space-between; align-items:center;
      padding:12px 16px; background:#f8fafc; border-bottom:1px solid #e2e8f0;
      font-size:.9rem; font-weight:600; color:#334155;
      .strip-icon{font-size:18px;width:18px;height:18px;vertical-align:middle;margin-right:6px;color:#1976d2;}
      .table-count{font-size:.78rem;color:#64748b;font-weight:400;}
    }
    .adv-table { width:100%; border-collapse:collapse; font-size:.85rem; white-space:nowrap;
      th,td{padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:left;}
      th{background:#f8fafc;font-weight:600;color:#64748b;font-size:.76rem;text-transform:uppercase;letter-spacing:.3px;}
      tr:last-child td{border-bottom:none;}
      tr:hover td{background:#f8fafc;}
      &.adjusted-row td{background:#f0f9ff;}
      &.pending-row td{background:#fffbeb;}
    }
    .row-num{color:#94a3b8;font-size:.8rem;font-weight:500;}
    .amount-cell{color:#1e293b;font-size:.9rem;}
    .reason-cell{color:#475569;max-width:200px;overflow:hidden;text-overflow:ellipsis;}
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
      background:#f1f5f9; padding:2px 8px; border-radius:6px; font-size:.75rem; color:#475569;
      .inline-icon{font-size:13px;width:13px;height:13px;color:#2563eb;}
    }
    .pending-adjust-chip {
      display:inline-flex; align-items:center; gap:4px;
      background:#eff6ff; padding:2px 8px; border-radius:6px; font-size:.75rem; color:#1d4ed8; font-weight:600;
      .inline-icon{font-size:13px;width:13px;height:13px;}
    }
    .emi-chip {
      display:inline-block; padding:2px 8px; background:#f0fdf4; border:1px solid #bbf7d0;
      border-radius:6px; font-weight:600; color:#15803d; font-size:.75rem;
    }
    .repay-box {
      display:flex; flex-direction:column; gap:2px; min-width:110px;
    }
    .repay-txt { font-size:.75rem; font-weight:600; color:#0f172a; }
    .progress-track {
      width:100%; height:5px; background:#e2e8f0; border-radius:3px; overflow:hidden;
    }
    .progress-fill {
      height:100%; background:#2563eb; transition:width .3s ease;
    }
    .rem-bal { font-size:.7rem; color:#64748b; }
    .action-btns { display:flex; align-items:center; justify-content:center; gap:4px; }
    .done-label { display:inline-flex; align-items:center; gap:4px; color:#2e7d32; font-weight:600; font-size:.78rem; }
    .ledger-footer {
      display:flex; justify-content:space-between; flex-wrap:wrap; gap:12px;
      padding:14px 20px; background:#f8fafc; border-top:1px solid #e2e8f0; font-size:.85rem;
      .ledger-item { display:flex; flex-direction:column; gap:2px;
        .lk{color:#64748b;font-size:.74rem;}
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

  advanceForm: FormGroup;

  months = ['January','February','March','April','May','June','July','August','September',
            'October','November','December'];

  get pendingCount()  { return this.advances.filter(a => a.status === 'Pending').length; }
  get approvedCount() { return this.advances.filter(a => a.status === 'Approved').length; }
  get adjustedCount() { return this.advances.filter(a => a.status === 'Adjusted').length; }
  get rejectedCount() { return this.advances.filter(a => a.status === 'Rejected').length; }

  get hasPendingOrApproved() { return this.pendingCount > 0 || this.approvedCount > 0; }

  get totalRequestedAmt() { return this.advances.reduce((s, a) => s + a.amount, 0); }
  get totalApprovedAmt()  { return this.advances.filter(a => a.status === 'Approved' || a.status === 'Adjusted').reduce((s, a) => s + a.amount, 0); }
  get totalAdjustedAmt()  { return this.advances.reduce((s, a) => s + (a.recoveredAmount || (a.status === 'Adjusted' ? a.amount : 0)), 0); }
  get totalOutstandingAmt() {
    return this.advances
      .filter(a => a.status === 'Approved')
      .reduce((s, a) => s + (a.remainingBalance ?? (a.amount - (a.recoveredAmount || 0))), 0);
  }

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private route: ActivatedRoute,
    private confirmDialog: ConfirmDialogService
  ) {
    this.advanceForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(1)]],
      installmentTenureMonths: [1, [Validators.required, Validators.min(1)]],
      monthlyInstallment: [null, [Validators.required, Validators.min(1)]],
      reason: ['', [Validators.required, Validators.maxLength(200)]]
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(p => { if (p['teacherId']) this.preSelectId = p['teacherId']; });
  }

  onTeacherSelected(t: TeacherDto) {
    this.selectedTeacher = t;
    this.showForm = false;
    this.advanceForm.reset({ installmentTenureMonths: 1 });
    this.loadAdvances();
  }

  toggleForm() {
    this.showForm = !this.showForm;
    if (this.showForm) {
      this.advanceForm.reset({ installmentTenureMonths: 1 });
    }
  }

  recalculateEmi() {
    const amt = Number(this.advanceForm.get('amount')?.value) || 0;
    const tenure = Number(this.advanceForm.get('installmentTenureMonths')?.value) || 1;
    if (amt > 0 && tenure > 0) {
      const emi = Math.round(amt / tenure);
      this.advanceForm.patchValue({ monthlyInstallment: emi }, { emitEvent: false });
    }
  }

  getRepaymentPercent(a: AdvanceDto): number {
    const total = a.amount || 1;
    const rec = a.recoveredAmount || (a.status === 'Adjusted' ? a.amount : 0);
    return Math.min(100, Math.round((rec / total) * 100));
  }

  loadAdvances() {
    if (!this.selectedTeacher) return;
    this.loading = true;
    this.http.get<AdvanceDto[]>(`${this.api}/teachers/${this.selectedTeacher.id}/advances`).subscribe({
      next: r => { this.advances = r; this.loading = false; },
      error: () => this.loading = false
    });
  }

  requestAdvance() {
    if (!this.selectedTeacher || this.advanceForm.invalid) return;
    const val = this.advanceForm.value;
    const amount = Number(val.amount);
    const tenure = Number(val.installmentTenureMonths) || 1;
    const emi = Number(val.monthlyInstallment) || amount;
    const reason = (val.reason || '').trim();

    this.submitting = true;
    this.http.post<AdvanceDto>(`${this.api}/teachers/advances`, {
      teacherId: this.selectedTeacher.id,
      amount,
      installmentTenureMonths: tenure,
      monthlyInstallment: emi,
      reason
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.showForm = false;
        this.advanceForm.reset({ installmentTenureMonths: 1 });
        this.loadAdvances();
        this.confirmDialog.alert(
          'Advance Requested ✓',
          `Salary advance request for ₹${amount.toLocaleString('en-IN')} with EMI of ₹${emi.toLocaleString('en-IN')}/mo (${tenure} month${tenure > 1 ? 's' : ''}) submitted successfully! Awaiting administrative approval.`,
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
      ? 'Are you sure you want to approve this faculty salary advance? Monthly EMI will be auto-deducted from subsequent payroll cycles.'
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
              ? 'Advance approved! Scheduled EMI installments will be deducted from regular salary cycles.'
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
