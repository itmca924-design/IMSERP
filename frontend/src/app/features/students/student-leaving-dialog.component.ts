import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CoachingService } from '../../core/services/coaching.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';

export interface StudentLeavingDialogData {
  student: any;
  isViewOnly?: boolean;
}

@Component({
  selector: 'app-student-leaving-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="tc-dialog-wrapper">
      <!-- Dialog Header -->
      <div class="tc-dialog-header">
        <div class="header-left">
          <div class="header-icon-box" [class.left-status]="!student?.isActive">
            <mat-icon>{{ !student?.isActive ? 'assignment_turned_in' : 'exit_to_app' }}</mat-icon>
          </div>
          <div>
            <h2 class="dialog-title">
              {{ isPassedOut ? 'School Leaving Certificate (SLC) & Terminal Record' : (!student?.isActive ? 'Transfer Certificate (TC) & Clearance Record' : 'Student Leaving & TC/SLC Clearance Process') }}
            </h2>
            <div class="student-meta-strip">
              <span class="st-name">{{ student?.studentName }}</span>
              <span class="meta-dot">•</span>
              <span>Roll: <strong>{{ student?.rollNumber }}</strong></span>
              <span class="meta-dot" *ngIf="student?.admissionNumber">•</span>
              <span *ngIf="student?.admissionNumber">SR No: <strong>{{ student?.admissionNumber }}</strong></span>
              <span class="meta-dot">•</span>
              <span>{{ student?.className ? student?.className + ' (' + (student?.sectionName || 'A') + ')' : student?.batchName }}</span>
              <span class="status-badge" [class.badge-active]="student?.isActive" [class.badge-left]="!student?.isActive && !isPassedOut" [class.badge-passed-out]="!student?.isActive && isPassedOut">
                {{ !student?.isActive ? (isPassedOut ? '🎓 Passed Out (SLC)' : 'Left / TC Issued') : 'Enrolled Active' }}
              </span>
            </div>
          </div>
        </div>
        <div class="header-right">
          <button mat-icon-button class="close-btn" (click)="closeDialog()" matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tc-nav-tabs">
        <button type="button" class="tab-btn" [class.active]="activeTab === 'clearance'" (click)="activeTab = 'clearance'">
          <mat-icon>verified_user</mat-icon>
          <span>Clearance &amp; Workflow</span>
        </button>
        <button type="button" class="tab-btn" [class.active]="activeTab === 'certificate'" (click)="activeTab = 'certificate'">
          <mat-icon>{{ isPassedOut ? 'workspace_premium' : 'description' }}</mat-icon>
          <span>{{ isPassedOut ? 'School Leaving Certificate (SLC)' : 'Transfer Certificate (TC)' }}</span>
          <span class="tc-tag" *ngIf="student?.tcNumber || clearanceData?.existingTCNumber">
            {{ student?.tcNumber || clearanceData?.existingTCNumber }}
          </span>
        </button>
      </div>

      <!-- Loading State -->
      <div class="loading-state" *ngIf="loadingClearance">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Fetching institutional clearance records (Fees, Hostel, Library)...</p>
      </div>

      <!-- Main Content Body -->
      <div class="tc-dialog-body" *ngIf="!loadingClearance">
        
        <!-- ==================== TAB 1: CLEARANCE & WORKFLOW ==================== -->
        <div *ngIf="activeTab === 'clearance'" class="tab-pane">
          
          <!-- Clearance Status Cards -->
          <div class="clearance-cards-grid">
            
            <!-- Fee Dues Card -->
            <div class="clearance-card" [class.card-clean]="clearanceData?.pendingFees === 0" [class.card-alert]="clearanceData?.pendingFees > 0">
              <div class="card-icon-wrap">
                <mat-icon>{{ clearanceData?.pendingFees === 0 ? 'check_circle' : 'payments' }}</mat-icon>
              </div>
              <div class="card-info">
                <div class="card-title">Fee Dues Status</div>
                <div class="card-val" *ngIf="clearanceData?.pendingFees === 0">
                  <span class="clean-text">All Fees Cleared (₹0 Due)</span>
                </div>
                <div class="card-val" *ngIf="clearanceData?.pendingFees > 0">
                  <span class="alert-text">₹{{ clearanceData?.pendingFees | number:'1.2-2' }} Pending</span>
                </div>
                <div class="card-sub">
                  {{ clearanceData?.pendingInvoicesCount || 0 }} unpaid invoices recorded
                </div>
              </div>
            </div>

            <!-- Hostel Allocation Card -->
            <div class="clearance-card" [class.card-clean]="!clearanceData?.hasHostelBed" [class.card-info-theme]="clearanceData?.hasHostelBed">
              <div class="card-icon-wrap">
                <mat-icon>{{ clearanceData?.hasHostelBed ? 'apartment' : 'night_shelter' }}</mat-icon>
              </div>
              <div class="card-info">
                <div class="card-title">Hostel Residency</div>
                <div class="card-val" *ngIf="clearanceData?.hasHostelBed">
                  <span class="info-text">{{ clearanceData?.hostelName || 'Hostel' }} — Bed {{ clearanceData?.bedCode }}</span>
                </div>
                <div class="card-val" *ngIf="!clearanceData?.hasHostelBed">
                  <span class="clean-text">Day Scholar (No Bed)</span>
                </div>
                <div class="card-sub" *ngIf="clearanceData?.hasHostelBed">
                  Room: {{ clearanceData?.roomNumber || 'N/A' }}
                </div>
                <div class="card-sub" *ngIf="!clearanceData?.hasHostelBed">
                  No hostel deallocation required
                </div>
              </div>
            </div>

            <!-- Library Clearance Card -->
            <div class="clearance-card" [class.card-clean]="clearanceData?.issuedLibraryBooksCount === 0 && clearanceData?.pendingLibraryFines === 0" [class.card-alert]="clearanceData?.issuedLibraryBooksCount > 0 || clearanceData?.pendingLibraryFines > 0">
              <div class="card-icon-wrap">
                <mat-icon>{{ clearanceData?.issuedLibraryBooksCount === 0 ? 'check_circle' : 'local_library' }}</mat-icon>
              </div>
              <div class="card-info">
                <div class="card-title">Library Clearance</div>
                <div class="card-val" *ngIf="clearanceData?.issuedLibraryBooksCount === 0 && clearanceData?.pendingLibraryFines === 0">
                  <span class="clean-text">All Clear (0 Books)</span>
                </div>
                <div class="card-val" *ngIf="clearanceData?.issuedLibraryBooksCount > 0 || clearanceData?.pendingLibraryFines > 0">
                  <span class="alert-text">{{ clearanceData?.issuedLibraryBooksCount }} Books Pending</span>
                </div>
                <div class="card-sub">
                  Fines Pending: ₹{{ clearanceData?.pendingLibraryFines || 0 }}
                </div>
              </div>
            </div>

            <!-- Transport Allocation Card -->
            <div class="clearance-card" [class.card-clean]="!clearanceData?.hasTransportAllocation" [class.card-info-theme]="clearanceData?.hasTransportAllocation">
              <div class="card-icon-wrap">
                <mat-icon>{{ clearanceData?.hasTransportAllocation ? 'directions_bus' : 'directions_walk' }}</mat-icon>
              </div>
              <div class="card-info">
                <div class="card-title">Campus Transport</div>
                <div class="card-val" *ngIf="clearanceData?.hasTransportAllocation">
                  <span class="info-text">{{ clearanceData?.transportRouteName }}</span>
                </div>
                <div class="card-val" *ngIf="!clearanceData?.hasTransportAllocation">
                  <span class="clean-text">Self Commuter (No Bus Pass)</span>
                </div>
                <div class="card-sub" *ngIf="clearanceData?.hasTransportAllocation">
                  Stop: {{ clearanceData?.transportStopName || 'N/A' }} (₹{{ clearanceData?.transportMonthlyFare }}/mo)
                </div>
                <div class="card-sub" *ngIf="!clearanceData?.hasTransportAllocation">
                  No transport deallocation required
                </div>
              </div>
            </div>

          </div>

          <!-- Pending Dues Notice Alert if any -->
          <div class="dues-warning-banner" *ngIf="clearanceData?.pendingFees > 0">
            <mat-icon>warning</mat-icon>
            <div class="dw-text">
              <strong>Institutional Dues Notice:</strong> Student has outstanding fee dues of ₹{{ clearanceData?.pendingFees | number:'1.2-2' }}. 
              In standard institutional workflow, TC can still be issued upon administrative clearance/waiver, and dues will remain recorded in financial ledger.
            </div>
          </div>

          <!-- If student has already left -->
          <div class="student-left-banner" *ngIf="!student?.isActive">
            <div class="slb-header">
              <mat-icon class="slb-icon">check_circle</mat-icon>
              <div>
                <div class="slb-title">Student Has Already Left Institution</div>
                <div class="slb-desc">
                  This student was marked as left on <strong>{{ student?.leavingDate | date:'dd MMM yyyy' }}</strong>. 
                  Reason: <em>{{ student?.leavingReason || 'TC Issued' }}</em>.
                  TC Number: <strong>{{ student?.tcNumber || clearanceData?.existingTCNumber || 'Issued' }}</strong>.
                </div>
              </div>
            </div>
            <div class="slb-actions-container">
              <div class="slb-buttons-row">
                <button mat-raised-button color="primary" class="btn-slb-print" (click)="activeTab = 'certificate'">
                  <mat-icon>print</mat-icon>
                  <span>View &amp; Print {{ isPassedOut ? 'School Leaving Certificate (SLC)' : 'Transfer Certificate (TC)' }}</span>
                </button>
                <button mat-stroked-button color="primary" class="btn-slb-readmit" (click)="onReAdmitStudent()" [disabled]="actionLoading" *ngIf="!isPassedOut">
                  <mat-icon>replay</mat-icon>
                  <span>Re-Admit Student Workflow</span>
                </button>
              </div>
              <div class="passed-out-notice" *ngIf="isPassedOut">
                <mat-icon>school</mat-icon>
                <span><strong>Passed-Out Alumnus:</strong> Direct re-admission to the same class is not applicable. For higher class or new stream, register as fresh admission.</span>
              </div>
            </div>
          </div>

          <!-- Leaving & TC Form (for active students) -->
          <form [formGroup]="leavingForm" (ngSubmit)="onConfirmLeaving()" class="leaving-form-card" *ngIf="student?.isActive">
            <div class="form-header-line">
              <mat-icon color="primary">assignment</mat-icon>
              <span>Leaving &amp; Transfer Certificate Details</span>
            </div>

            <div class="form-grid-row">
              <!-- Leaving Date -->
              <mat-form-field appearance="outline">
                <mat-label>Leaving / Discharge Date</mat-label>
                <input matInput type="date" formControlName="leavingDate" required />
                <mat-error *ngIf="leavingForm.get('leavingDate')?.hasError('required')">Date is required</mat-error>
              </mat-form-field>

              <!-- Leaving Reason -->
              <mat-form-field appearance="outline">
                <mat-label>Reason for Leaving</mat-label>
                <mat-select formControlName="leavingReason" required panelClass="leaving-reason-select-panel">
                  <mat-option value="TC Issued / School Leaving">Transfer Certificate (TC) Requested</mat-option>
                  <mat-option value="Course / Class Completed (Passed Out)">Course / Class Completed (Passed Out)</mat-option>
                  <mat-option value="School Transfer / Relocation">School Transfer / Relocation</mat-option>
                  <mat-option value="Dropped Out / Discontinued">Dropped Out / Discontinued</mat-option>
                  <mat-option value="Personal / Family Reasons">Personal / Family Reasons</mat-option>
                  <mat-option value="Rusticated / Expelled">Rusticated / Expelled</mat-option>
                  <mat-option value="Other">Other Reason</mat-option>
                </mat-select>
                <mat-error *ngIf="leavingForm.get('leavingReason')?.hasError('required')">Reason is required</mat-error>
              </mat-form-field>

              <!-- Custom / Suggested TC Number -->
              <mat-form-field appearance="outline">
                <mat-label>TC Serial Number</mat-label>
                <input matInput formControlName="customTCNumber" placeholder="Auto-generated if blank (e.g. TC-2026-0042)" />
                <mat-hint>Leave empty to auto-generate TC number</mat-hint>
              </mat-form-field>
            </div>

            <!-- General Conduct & Remarks Row -->
            <div class="form-grid-row">
              <mat-form-field appearance="outline">
                <mat-label>General Conduct &amp; Character</mat-label>
                <mat-select formControlName="conduct" panelClass="leaving-reason-select-panel">
                  <mat-option value="Good">Good</mat-option>
                  <mat-option value="Very Good">Very Good</mat-option>
                  <mat-option value="Exemplary">Exemplary</mat-option>
                  <mat-option value="Satisfactory">Satisfactory</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="remarks-field">
                <mat-label>Additional Remarks / Notes</mat-label>
                <input matInput formControlName="remarks" placeholder="e.g. Cleared 10th Board, moving to new city..." />
              </mat-form-field>
            </div>

            <!-- Hostel Bed Vacate Option (if hostel resident) -->
            <div class="checkbox-option-box" *ngIf="clearanceData?.hasHostelBed">
              <mat-checkbox formControlName="vacateHostelBed" color="primary">
                <span class="cb-label">Automatically vacate hostel bed (<strong>Bed {{ clearanceData?.bedCode }}</strong> in {{ clearanceData?.hostelName }}) and mark as Available.</span>
              </mat-checkbox>
            </div>

            <!-- Transport Seat Release Option (if transport student) -->
            <div class="checkbox-option-box" *ngIf="clearanceData?.hasTransportAllocation">
              <mat-checkbox formControlName="releaseTransportSeat" color="primary">
                <span class="cb-label">Automatically discontinue transport pass on <strong>{{ clearanceData?.transportRouteName }}</strong> and release bus seat.</span>
              </mat-checkbox>
            </div>

            <!-- Actions Row -->
            <div class="form-actions-row">
              <button mat-button type="button" (click)="closeDialog()" [disabled]="actionLoading">
                Cancel
              </button>
              <button mat-raised-button color="warn" type="submit" [disabled]="leavingForm.invalid || actionLoading" class="confirm-leave-btn">
                <mat-spinner diameter="18" *ngIf="actionLoading" style="display:inline-block; margin-right:6px;"></mat-spinner>
                <mat-icon *ngIf="!actionLoading">assignment_turned_in</mat-icon>
                <span>Process Leaving &amp; Issue Transfer Certificate</span>
              </button>
            </div>
          </form>

        </div>

        <!-- ==================== TAB 2: TRANSFER CERTIFICATE DOCUMENT ==================== -->
        <div *ngIf="activeTab === 'certificate'" class="tab-pane">
          
          <!-- TC Top Action Bar -->
          <div class="tc-doc-actions no-print">
            <div class="tc-action-info">
              <mat-icon>print</mat-icon>
              <span>Transfer Certificate ready for official printing &amp; records.</span>
            </div>
            <div class="tc-action-btns">
              <button mat-raised-button color="primary" (click)="printCertificate()">
                <mat-icon>print</mat-icon> Print TC Document (A4)
              </button>
            </div>
          </div>

          <!-- Printable Certificate Document -->
          <div class="tc-printable-sheet" id="printableTcDoc">
            
            <!-- Certificate Border Box -->
            <div class="tc-border-outer">
              <div class="tc-border-inner">
                
                <!-- School Header -->
                <div class="tc-school-header">
                  <div class="school-badge-logo">
                    <mat-icon class="badge-icon">school</mat-icon>
                  </div>
                  <div class="school-name">{{ instituteName }}</div>
                  <div class="school-sub">Recognised &amp; Affiliated Senior Secondary Co-Educational Institution</div>
                  <div class="school-addr">Main Campus, Academic Zone • Official Institutional Transfer Certificate Record</div>
                </div>

                <div class="tc-doc-title-wrap">
                  <div class="tc-doc-title">{{ isPassedOut ? 'SCHOOL LEAVING CERTIFICATE (SLC)' : 'TRANSFER CERTIFICATE (TC)' }}</div>
                  <div class="tc-doc-subtitle">{{ isPassedOut ? 'BOARD / TERMINAL PASS-OUT & CLEARANCE RECORD' : 'SCHOOL TRANSFER & CLEARANCE CERTIFICATE' }}</div>
                </div>

                <!-- TC Numbers Row -->
                <div class="tc-meta-row">
                  <div><strong>{{ isPassedOut ? 'SLC Serial No:' : 'TC Serial No:' }}</strong> <span class="tc-highlight">{{ student?.tcNumber || clearanceData?.existingTCNumber || leavingForm.get('customTCNumber')?.value || (isPassedOut ? 'SLC-2026-PENDING' : 'TC-2026-PENDING') }}</span></div>
                  <div><strong>Admission / SR No:</strong> {{ student?.admissionNumber || student?.rollNumber || 'N/A' }}</div>
                  <div><strong>Date of Issue:</strong> {{ todayDate | date:'dd/MM/yyyy' }}</div>
                </div>

                <div class="tc-divider-line"></div>

                <!-- Certificate Body Fields (Official 18-point format) -->
                <div class="tc-field-list">
                  <div class="tc-field-row">
                    <span class="field-num">1.</span>
                    <span class="field-label">Name of Pupil:</span>
                    <span class="field-value highlight-name">{{ student?.studentName | uppercase }}</span>
                  </div>

                  <div class="tc-field-row">
                    <span class="field-num">2.</span>
                    <span class="field-label">Father's / Guardian's Name:</span>
                    <span class="field-value">{{ student?.parentName }}</span>
                  </div>

                  <div class="tc-field-row">
                    <span class="field-num">3.</span>
                    <span class="field-label">Mother's Name:</span>
                    <span class="field-value">{{ student?.motherName || 'Smt. ' + student?.parentName }}</span>
                  </div>

                  <div class="tc-field-row">
                    <span class="field-num">4.</span>
                    <span class="field-label">Nationality:</span>
                    <span class="field-value">Indian</span>
                  </div>

                  <div class="tc-field-row">
                    <span class="field-num">5.</span>
                    <span class="field-label">Date of Birth (according to Admission Register):</span>
                    <span class="field-value">
                      {{ student?.dateOfBirth ? (student?.dateOfBirth | date:'dd/MM/yyyy') : 'As per School Records' }}
                    </span>
                  </div>

                  <div class="tc-field-row">
                    <span class="field-num">6.</span>
                    <span class="field-label">Date of First Admission to the Institution:</span>
                    <span class="field-value">{{ student?.joiningDate | date:'dd/MM/yyyy' }}</span>
                  </div>

                  <div class="tc-field-row">
                    <span class="field-num">7.</span>
                    <span class="field-label">Class in which the pupil last studied:</span>
                    <span class="field-value">{{ student?.className ? student?.className + ' - ' + (student?.sectionName || 'A') : (student?.batchName || 'General Academic') }}</span>
                  </div>

                  <div class="tc-field-row">
                    <span class="field-num">8.</span>
                    <span class="field-label">School / Board Annual Examination last taken:</span>
                    <span class="field-value">Appeared &amp; Passed Annual Term</span>
                  </div>

                  <div class="tc-field-row">
                    <span class="field-num">9.</span>
                    <span class="field-label">Whether failed, if so once / twice in same class:</span>
                    <span class="field-value">No</span>
                  </div>

                  <div class="tc-field-row">
                    <span class="field-num">10.</span>
                    <span class="field-label">Month up to which the pupil has paid school dues:</span>
                    <span class="field-value">
                      {{ clearanceData?.pendingFees === 0 ? 'All Institutional Dues Fully Cleared' : ('Outstanding: ₹' + (clearanceData?.pendingFees | number:'1.2-2')) }}
                    </span>
                  </div>

                  <div class="tc-field-row">
                    <span class="field-num">11.</span>
                    <span class="field-label">Any fee concession availed of (if so nature):</span>
                    <span class="field-value">Nil</span>
                  </div>

                  <div class="tc-field-row">
                    <span class="field-num">12.</span>
                    <span class="field-label">Hostel Clearance Status:</span>
                    <span class="field-value">
                      {{ clearanceData?.hasHostelBed ? 'Hostel Bed Vacated & Keys Handed Over' : 'Day Scholar' }}
                    </span>
                  </div>

                  <div class="tc-field-row">
                    <span class="field-num">13.</span>
                    <span class="field-label">Library Clearance Status:</span>
                    <span class="field-value">All Library Books Returned &amp; Fines Settled</span>
                  </div>

                  <div class="tc-field-row">
                    <span class="field-num">14.</span>
                    <span class="field-label">Date on which pupil's name was struck off:</span>
                    <span class="field-value">{{ (student?.leavingDate || leavingForm.get('leavingDate')?.value) | date:'dd/MM/yyyy' }}</span>
                  </div>

                  <div class="tc-field-row">
                    <span class="field-num">15.</span>
                    <span class="field-label">Reason for leaving the institution:</span>
                    <span class="field-value font-semibold">
                      {{ student?.leavingReason || leavingForm.get('leavingReason')?.value || 'Transfer Certificate Issued' }}
                    </span>
                  </div>

                  <div class="tc-field-row">
                    <span class="field-num">16.</span>
                    <span class="field-label">General Conduct &amp; Character:</span>
                    <span class="field-value">{{ leavingForm.get('conduct')?.value || 'Good' }}</span>
                  </div>

                  <div class="tc-field-row" *ngIf="leavingForm.get('remarks')?.value">
                    <span class="field-num">17.</span>
                    <span class="field-label">Any other remarks:</span>
                    <span class="field-value">{{ leavingForm.get('remarks')?.value }}</span>
                  </div>
                </div>

                <!-- Signatures Row -->
                <div class="tc-signatures-block">
                  <div class="sig-column">
                    <div class="sig-line"></div>
                    <div class="sig-title">Class Teacher</div>
                  </div>
                  <div class="sig-column">
                    <div class="sig-line"></div>
                    <div class="sig-title">Accountant / Cashier</div>
                  </div>
                  <div class="sig-column seal-column">
                    <div class="sig-seal-box">
                      <span>[ Official Seal ]</span>
                    </div>
                    <div class="sig-line"></div>
                    <div class="sig-title">Principal / Headmaster</div>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>

      </div>

      <!-- Footer for View Mode -->
      <div class="tc-dialog-footer" *ngIf="activeTab === 'clearance' && !student?.isActive">
        <button mat-stroked-button (click)="closeDialog()">Close</button>
      </div>

    </div>
  `,
  styles: [`
    .tc-dialog-wrapper {
      max-width: 820px;
      width: 100%;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
    }

    /* Header */
    .tc-dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 24px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .header-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: #2563eb;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      flex-shrink: 0;

      mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }
    }
    .header-icon-box.left-status {
      background: #0284c7;
      box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.25);
      color: #ffffff;
    }
    .dialog-title {
      margin: 0;
      font-size: 1.18rem;
      font-weight: 700;
      color: #1e3a8a;
      line-height: 1.3;
      letter-spacing: -0.3px;
    }
    .student-meta-strip {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
      font-size: 0.82rem;
      color: #3b82f6;

      strong {
        color: #1e40af;
      }
    }
    .st-name {
      color: #1e3a8a;
      font-weight: 700;
    }
    .meta-dot {
      color: #93c5fd;
    }
    .status-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
      margin-left: 4px;
    }
    .badge-active {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }
    .badge-left {
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fca5a5;
    }
    .badge-passed-out {
      background: #ede9fe;
      color: #6d28d9;
      border: 1px solid #ddd6fe;
    }
    .passed-out-notice {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 8px 12px;
      color: #1e40af;
      font-size: 0.82rem;

      mat-icon {
        color: #2563eb;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }
    .close-btn {
      color: #64748b;
    }
    .close-btn:hover {
      color: #1e293b;
      background: rgba(0, 0, 0, 0.04);
    }

    /* Nav Tabs */
    .tc-nav-tabs {
      display: flex;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 0 24px;
      gap: 8px;
    }
    .tab-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 18px;
      border: none;
      background: transparent;
      font-size: 14px;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s ease;
    }
    .tab-btn:hover {
      color: #1e293b;
    }
    .tab-btn.active {
      color: #0284c7;
      border-bottom-color: #0284c7;
      background: #ffffff;
    }
    .tc-tag {
      font-size: 11px;
      background: #e0f2fe;
      color: #0369a1;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 700;
    }

    /* Body */
    .tc-dialog-body {
      padding: 24px;
      max-height: 75vh;
      overflow-y: auto;
    }
    .loading-state {
      padding: 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: #64748b;
    }

    /* Clearance Grid */
    .clearance-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .clearance-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px;
      display: flex;
      gap: 12px;
      align-items: flex-start;
      transition: all 0.2s;
    }
    .card-clean {
      border-color: #bbf7d0;
      background: #f0fdf4;
    }
    .card-clean .card-icon-wrap {
      background: #dcfce7;
      color: #16a34a;
    }
    .card-alert {
      border-color: #fecaca;
      background: #fef2f2;
    }
    .card-alert .card-icon-wrap {
      background: #fee2e2;
      color: #dc2626;
    }
    .card-info-theme {
      border-color: #bae6fd;
      background: #f0f9ff;
    }
    .card-info-theme .card-icon-wrap {
      background: #e0f2fe;
      color: #0284c7;
    }
    .card-icon-wrap {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: #e2e8f0;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .card-title {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-val {
      font-size: 14px;
      font-weight: 700;
      margin: 2px 0;
    }
    .clean-text { color: #15803d; }
    .alert-text { color: #b91c1c; }
    .info-text { color: #0369a1; }
    .card-sub {
      font-size: 11px;
      color: #64748b;
    }

    /* Warning Banner */
    .dues-warning-banner {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      color: #92400e;
      font-size: 13px;
      margin-bottom: 20px;
    }
    .dues-warning-banner mat-icon {
      color: #d97706;
      flex-shrink: 0;
    }

    /* Already Left Banner */
    .student-left-banner {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .slb-header {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    .slb-icon {
      color: #10b981;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }
    .slb-title {
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
    }
    .slb-desc {
      font-size: 13px;
      color: #475569;
      margin-top: 4px;
    }
    .slb-actions-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    }
    .slb-buttons-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }
    .btn-slb-print {
      height: auto !important;
      min-height: 42px !important;
      line-height: 1.35 !important;
      padding: 10px 18px !important;
      white-space: normal !important;
      text-align: left !important;
      display: inline-flex !important;
      align-items: center !important;
      font-weight: 600 !important;
      border-radius: 8px !important;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2) !important;
    }
    .btn-slb-print mat-icon {
      margin-right: 8px !important;
      flex-shrink: 0 !important;
    }
    .btn-slb-readmit {
      height: auto !important;
      min-height: 42px !important;
      line-height: 1.35 !important;
      padding: 10px 18px !important;
      white-space: normal !important;
      text-align: left !important;
      display: inline-flex !important;
      align-items: center !important;
      font-weight: 600 !important;
      border-radius: 8px !important;
    }
    .btn-slb-readmit mat-icon {
      margin-right: 8px !important;
      flex-shrink: 0 !important;
    }

    /* Leaving Form */
    .leaving-form-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 20px;
    }
    .form-header-line {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 18px;
      padding-bottom: 10px;
      border-bottom: 1px solid #f1f5f9;
    }
    .form-grid-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
    }
    .remarks-field {
      grid-column: span 1;
    }
    .checkbox-option-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin: 12px 0 20px 0;
    }
    .cb-label {
      font-size: 13px;
      color: #334155;
    }
    .form-actions-row {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 14px;
      border-top: 1px solid #f1f5f9;
    }
    .confirm-leave-btn {
      font-weight: 600;
    }

    /* TC Document Preview */
    .tc-doc-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 18px;
      margin-bottom: 20px;
    }
    .tc-action-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
    }

    /* Printable A4 Certificate */
    .tc-printable-sheet {
      background: #ffffff;
      padding: 10px;
    }
    .tc-border-outer {
      border: 3px double #1e293b;
      padding: 6px;
      background: #fffdfa;
    }
    .tc-border-inner {
      border: 1px solid #94a3b8;
      padding: 24px;
    }
    .tc-school-header {
      text-align: center;
      margin-bottom: 16px;
    }
    .school-badge-logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      background: #0f172a;
      color: #f8fafc;
      border-radius: 50%;
      margin-bottom: 6px;
    }
    .school-name {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 1px;
    }
    .school-sub {
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      margin-top: 2px;
    }
    .school-addr {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    .tc-doc-title-wrap {
      text-align: center;
      margin: 14px 0 10px 0;
    }
    .tc-doc-title {
      font-size: 18px;
      font-weight: 800;
      color: #b91c1c;
      letter-spacing: 2px;
      text-decoration: underline;
    }
    .tc-doc-subtitle {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      letter-spacing: 1px;
      margin-top: 2px;
    }
    .tc-meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #334155;
      padding: 6px 0;
      background: #f8fafc;
      padding: 6px 12px;
      border-radius: 4px;
    }
    .tc-highlight {
      color: #b91c1c;
      font-weight: 800;
    }
    .tc-divider-line {
      height: 1px;
      background: #cbd5e1;
      margin: 12px 0 16px 0;
    }
    .tc-field-list {
      display: flex;
      flex-direction: column;
      gap: 9px;
      font-size: 13px;
      color: #1e293b;
      line-height: 1.5;
    }
    .tc-field-row {
      display: flex;
      align-items: baseline;
    }
    .field-num {
      width: 24px;
      color: #64748b;
      font-weight: 600;
    }
    .field-label {
      width: 320px;
      color: #334155;
      font-weight: 500;
    }
    .field-value {
      flex: 1;
      border-bottom: 1px dotted #94a3b8;
      padding-bottom: 2px;
      color: #0f172a;
    }
    .highlight-name {
      font-weight: 800;
      font-size: 14px;
      letter-spacing: 0.5px;
    }
    .font-semibold {
      font-weight: 700;
    }

    /* Signatures */
    .tc-signatures-block {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 48px;
      padding-top: 10px;
    }
    .sig-column {
      text-align: center;
      width: 150px;
    }
    .sig-line {
      border-top: 1px solid #334155;
      margin-bottom: 6px;
    }
    .sig-title {
      font-size: 12px;
      font-weight: 700;
      color: #334155;
    }
    .seal-column {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .sig-seal-box {
      width: 80px;
      height: 40px;
      border: 1px dashed #94a3b8;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: #94a3b8;
      margin-bottom: 8px;
    }

    /* Footer */
    .tc-dialog-footer {
      display: flex;
      justify-content: flex-end;
      padding: 14px 24px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    /* Print Styles */
    @media print {
      body * {
        visibility: hidden;
      }
      #printableTcDoc, #printableTcDoc * {
        visibility: visible;
      }
      #printableTcDoc {
        position: fixed;
        left: 0;
        top: 0;
        width: 100%;
        margin: 0;
        padding: 10mm;
        box-sizing: border-box;
      }
      .no-print {
        display: none !important;
      }
    }

    @media (max-width: 640px) {
      .tc-dialog-header {
        padding: 12px 14px;
        gap: 8px;
        align-items: flex-start;
      }
      .header-left {
        gap: 10px;
        align-items: flex-start;
      }
      .header-icon-box {
        width: 36px;
        height: 36px;
        border-radius: 8px;
      }
      .header-icon-box mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
      .dialog-title {
        font-size: 1.02rem;
        line-height: 1.25;
      }
      .student-meta-strip {
        font-size: 0.76rem;
        gap: 4px;
      }
      .close-btn {
        margin-top: -6px;
        margin-right: -6px;
      }
      .tc-nav-tabs {
        overflow-x: auto;
        white-space: nowrap;
        display: flex;
        flex-wrap: nowrap;
        -webkit-overflow-scrolling: touch;
      }
      .tab-btn {
        padding: 10px 12px;
        font-size: 0.8rem;
        gap: 6px;
        flex-shrink: 0;
      }
      .tab-btn mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .tc-dialog-body {
        padding: 14px 12px;
      }
      .clearance-cards-grid {
        grid-template-columns: 1fr;
        gap: 10px;
      }
      .slb-buttons-row {
        flex-direction: column;
        width: 100%;
      }
      .btn-slb-print, .btn-slb-readmit {
        width: 100% !important;
        justify-content: center !important;
        text-align: center !important;
      }
      .passed-out-notice {
        flex-direction: column;
        align-items: flex-start;
        font-size: 0.78rem;
      }
      .tc-printable-sheet {
        padding: 0;
        overflow-x: auto;
      }
      .tc-border-inner {
        padding: 12px;
      }
      .tc-school-header .school-name {
        font-size: 16px;
      }
      .tc-school-header .school-sub {
        font-size: 10px;
      }
      .tc-school-header .school-addr {
        font-size: 9px;
      }
      .tc-doc-title {
        font-size: 14px;
        letter-spacing: 1px;
      }
      .tc-doc-subtitle {
        font-size: 10px;
      }
      .tc-meta-row {
        flex-direction: column;
        gap: 4px;
        font-size: 11px;
      }
      .tc-field-list {
        font-size: 11px;
        gap: 8px;
      }
      .tc-field-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
      }
      .field-num {
        display: inline-block;
        width: 18px;
      }
      .field-label {
        width: 100% !important;
        font-weight: 600;
      }
      .field-value {
        width: 100% !important;
        border-bottom: 1px dotted #cbd5e1;
        padding-bottom: 2px;
      }
      .tc-signatures-block {
        flex-direction: column;
        align-items: center;
        gap: 20px;
        margin-top: 30px;
      }
      .sig-column {
        width: 80% !important;
      }
      .tc-doc-actions {
        flex-direction: column;
        gap: 10px;
        align-items: stretch;
      }
      .tc-doc-actions button {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class StudentLeavingDialogComponent implements OnInit {
  student: any;
  activeTab: 'clearance' | 'certificate' = 'clearance';
  loadingClearance = true;
  actionLoading = false;
  clearanceData: any = null;
  leavingForm!: FormGroup;
  todayDate = new Date();

  constructor(
    public dialogRef: MatDialogRef<StudentLeavingDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: StudentLeavingDialogData,
    private fb: FormBuilder,
    private coachingService: CoachingService,
    private confirmDialog: ConfirmDialogService,
    private authService: AuthService
  ) {
    this.student = data.student;
    if (data.isViewOnly || !this.student?.isActive) {
      this.activeTab = 'certificate';
    }
  }

  ngOnInit(): void {
    const todayStr = new Date().toISOString().substring(0, 10);
    this.leavingForm = this.fb.group({
      leavingDate: [todayStr, Validators.required],
      leavingReason: ['TC Issued / School Leaving', Validators.required],
      customTCNumber: [''],
      conduct: ['Good'],
      remarks: [''],
      vacateHostelBed: [true],
      releaseTransportSeat: [true]
    });

    this.loadClearanceStatus();
  }

  loadClearanceStatus(): void {
    if (!this.student?.id) return;
    this.loadingClearance = true;

    this.coachingService.getStudentClearanceStatus(this.student.id).subscribe({
      next: (res) => {
        this.clearanceData = res;
        this.loadingClearance = false;

        // If TC number exists, prefill it
        if (res.existingTCNumber) {
          this.leavingForm.patchValue({ customTCNumber: res.existingTCNumber });
        }
        if (res.existingLeavingReason) {
          this.leavingForm.patchValue({ leavingReason: res.existingLeavingReason });
        }
      },
      error: (err) => {
        console.error('Error fetching clearance status:', err);
        this.loadingClearance = false;
      }
    });
  }

  onConfirmLeaving(): void {
    if (this.leavingForm.invalid || !this.student?.id) return;

    const val = this.leavingForm.value;
    const hasDues = this.clearanceData?.pendingFees > 0;

    const confirmMsg = hasDues
      ? `Student has pending dues of ₹${this.clearanceData.pendingFees}. Are you sure you want to proceed with issuing TC and marking the student as left?`
      : `Are you sure you want to mark ${this.student.studentName} as left and issue a Transfer Certificate (TC)?`;

    this.confirmDialog.confirm(
      'Confirm Student Leaving & TC',
      confirmMsg,
      'Yes, Issue TC & Mark Left',
      'Cancel',
      hasDues ? 'warning' : 'info'
    ).subscribe((confirmed) => {
      if (!confirmed) return;

      this.actionLoading = true;
      const payload = {
        leavingDate: val.leavingDate,
        leavingReason: val.leavingReason,
        remarks: val.remarks,
        vacateHostelBed: !!val.vacateHostelBed,
        releaseTransportSeat: !!val.releaseTransportSeat,
        customTCNumber: val.customTCNumber ? val.customTCNumber.trim() : undefined
      };

      this.coachingService.markStudentLeft(this.student.id, payload).subscribe({
        next: (result) => {
          this.actionLoading = false;
          // Update local student object
          this.student.isActive = false;
          this.student.leavingDate = result.leavingDate;
          this.student.leavingReason = result.leavingReason;
          this.student.tcNumber = result.tcNumber;

          if (this.clearanceData) {
            this.clearanceData.existingTCNumber = result.tcNumber;
            if (result.hostelVacated) {
              this.clearanceData.hasHostelBed = false;
            }
          }

          // Switch to printable TC tab
          this.activeTab = 'certificate';
          this.confirmDialog.alert(
            this.isPassedOut ? 'School Leaving Certificate Issued' : 'Transfer Certificate Issued',
            `${this.isPassedOut ? 'School Leaving Certificate' : 'Transfer Certificate'} ${result.tcNumber} has been generated successfully. You can now preview or print the official document.`,
            'success'
          );
        },
        error: (err) => {
          this.actionLoading = false;
          this.confirmDialog.alert(
            'Failed to Process Leaving',
            err.error?.message || 'An error occurred while marking student as left.',
            'danger'
          );
        }
      });
    });
  }

  get isPassedOut(): boolean {
    const reason = this.student?.leavingReason || this.leavingForm?.get('leavingReason')?.value;
    return !!(reason && (reason.includes('Passed Out') || reason.includes('Completed')));
  }

  onReAdmitStudent(): void {
    if (!this.student?.id) return;

    if (this.isPassedOut) {
      this.confirmDialog.alert(
        'Re-Admission Not Permitted',
        'This student has graduated / passed out from the terminal class. They cannot be re-admitted to the same class. Please register a fresh admission for higher class/stream.',
        'info'
      );
      return;
    }

    this.dialogRef.close({ openReAdmit: true, student: this.student });
  }

  get instituteName(): string {
    return this.authService.currentUser()?.instituteName || 'Apex School Academy';
  }

  printCertificate(): void {
    const el = document.getElementById('printableTcDoc');
    if (!el) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=950,height=800');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Transfer Certificate - ${this.student?.studentName || 'Student'}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 0;
              color: #1e293b;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .tc-printable-sheet {
              width: 100%;
              max-width: 100%;
              margin: 0;
              padding: 0;
            }
            .tc-border-outer {
              border: 3px double #1e293b;
              padding: 6px;
              background: #fffdfa;
            }
            .tc-border-inner {
              border: 1px solid #94a3b8;
              padding: 22px 24px;
            }
            .tc-school-header {
              text-align: center;
              margin-bottom: 12px;
            }
            .school-badge-logo {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 44px;
              height: 44px;
              background: #0f172a;
              color: #f8fafc;
              border-radius: 50%;
              margin-bottom: 4px;
            }
            .school-badge-logo mat-icon {
              display: none;
            }
            .school-badge-logo::before {
              content: '🎓';
              font-size: 24px;
            }
            .school-name {
              font-size: 22px;
              font-weight: 900;
              color: #0f172a;
              letter-spacing: 1px;
            }
            .school-sub {
              font-size: 11px;
              font-weight: 600;
              color: #475569;
              margin-top: 2px;
            }
            .school-addr {
              font-size: 10.5px;
              color: #64748b;
              margin-top: 2px;
            }
            .tc-doc-title-wrap {
              text-align: center;
              margin: 14px 0 10px 0;
            }
            .tc-doc-title {
              font-size: 18px;
              font-weight: 800;
              color: #b91c1c;
              letter-spacing: 2px;
              text-decoration: underline;
            }
            .tc-doc-subtitle {
              font-size: 10.5px;
              color: #64748b;
              font-weight: 600;
              letter-spacing: 1px;
              margin-top: 2px;
            }
            .tc-meta-row {
              display: flex;
              justify-content: space-between;
              font-size: 11.5px;
              color: #334155;
              padding: 6px 12px;
              background: #f8fafc;
              border-radius: 4px;
              border: 1px solid #e2e8f0;
            }
            .tc-highlight {
              color: #b91c1c;
              font-weight: 800;
            }
            .tc-divider-line {
              height: 1px;
              background: #cbd5e1;
              margin: 10px 0 14px 0;
            }
            .tc-field-list {
              display: flex;
              flex-direction: column;
              gap: 8px;
              font-size: 12px;
              color: #1e293b;
              line-height: 1.4;
            }
            .tc-field-row {
              display: flex;
              align-items: baseline;
            }
            .field-num {
              width: 24px;
              color: #64748b;
              font-weight: 600;
              flex-shrink: 0;
            }
            .field-label {
              width: 320px;
              color: #334155;
              font-weight: 500;
              flex-shrink: 0;
            }
            .field-value {
              flex: 1;
              border-bottom: 1px dotted #94a3b8;
              padding-bottom: 2px;
              color: #0f172a;
              font-weight: 600;
            }
            .highlight-name {
              font-weight: 800;
              font-size: 13.5px;
              letter-spacing: 0.5px;
            }
            .font-semibold {
              font-weight: 700;
            }
            .tc-signatures-block {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: 42px;
              padding-top: 8px;
            }
            .sig-column {
              text-align: center;
              width: 150px;
            }
            .sig-line {
              border-top: 1px solid #334155;
              margin-bottom: 6px;
            }
            .sig-title {
              font-size: 11px;
              font-weight: 700;
              color: #1e293b;
            }
            .seal-column .sig-seal-box {
              border: 1px dashed #94a3b8;
              border-radius: 50%;
              width: 60px;
              height: 60px;
              margin: 0 auto 8px auto;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 9px;
              color: #94a3b8;
            }
          </style>
        </head>
        <body>
          ${el.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  }

  closeDialog(): void {
    this.dialogRef.close({ updated: !this.student?.isActive });
  }
}
