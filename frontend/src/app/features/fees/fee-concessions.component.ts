import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FeesService, StudentFeeConcession, FeeConcessionStats, CreateFeeConcessionDto, FeeHead } from '../../core/services/fees.service';
import { CoachingService, StudentDetail360 } from '../../core/services/coaching.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-fee-concessions',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatChipsModule
  ],
  template: `
    <div class="page-container">

      <!-- Header Section -->
      <div class="header-card">
        <div class="header-content">
          <div class="header-title-wrap">
            <div class="header-icon-box">
              <mat-icon>card_giftcard</mat-icon>
            </div>
            <div>
              <h1 class="header-title">Fee Concessions &amp; Sibling Discounts</h1>
              <p class="header-subtitle">
                Institutional scholarship management, sibling discounts, and fee waiver policies
              </p>
            </div>
          </div>
          <div class="header-actions">
            <button mat-stroked-button (click)="loadData()" [disabled]="loading" class="action-btn">
              <mat-icon>refresh</mat-icon> Refresh
            </button>
            <button mat-raised-button color="primary" (click)="openAddModal()" class="action-btn-primary">
              <mat-icon>add</mat-icon> Grant Concession
            </button>
          </div>
        </div>
      </div>

      <!-- Single Global Loader per AGENTS.md rule -->
      <mat-progress-bar mode="indeterminate" *ngIf="loading" class="global-progress-bar"></mat-progress-bar>

      <!-- KPI Metrics Deck -->
      <div class="kpi-grid">
        <div class="kpi-card total-card">
          <div class="kpi-icon-wrap blue">
            <mat-icon>verified</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">Active Concessions</span>
            <span class="kpi-val">{{ stats?.totalActiveConcessions || 0 }}</span>
          </div>
        </div>

        <div class="kpi-card sibling-card">
          <div class="kpi-icon-wrap purple">
            <mat-icon>diversity_3</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">Sibling Discounts</span>
            <span class="kpi-val">{{ stats?.siblingDiscountsActive || 0 }}</span>
          </div>
        </div>

        <div class="kpi-card merit-card">
          <div class="kpi-icon-wrap amber">
            <mat-icon>military_tech</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">Merit Scholarships</span>
            <span class="kpi-val">{{ stats?.meritScholarshipsActive || 0 }}</span>
          </div>
        </div>

        <div class="kpi-card ews-card">
          <div class="kpi-icon-wrap green">
            <mat-icon>volunteer_activism</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">EWS / RTE Scholars</span>
            <span class="kpi-val">{{ stats?.ewsRteActive || 0 }}</span>
          </div>
        </div>

        <div class="kpi-card savings-card">
          <div class="kpi-icon-wrap rose">
            <mat-icon>savings</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">Total Concessions Billed</span>
            <span class="kpi-val font-amount">₹{{ (stats?.totalConcessionAmountBilled || 0) | number:'1.2-2' }}</span>
          </div>
        </div>
      </div>

      <!-- Filter Controls Deck (Pure Reactive Forms) -->
      <mat-card class="filter-card">
        <form [formGroup]="filterForm" class="filter-form">
          <div class="filter-row">
            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Search Student or Concession Title</mat-label>
              <input matInput formControlName="searchTerm" placeholder="Search by name, roll, adm no..." />
              <mat-icon matPrefix>search</mat-icon>
              <button mat-icon-button matSuffix *ngIf="filterForm.get('searchTerm')?.value" (click)="filterForm.get('searchTerm')?.setValue('')" type="button">
                <mat-icon>close</mat-icon>
              </button>
            </mat-form-field>

            <mat-form-field appearance="outline" class="select-field">
              <mat-label>Concession Type</mat-label>
              <mat-select formControlName="concessionType">
                <mat-option value="all">All Concession Categories</mat-option>
                <mat-option value="SiblingDiscount">👨‍👩‍👧 Sibling Discount</mat-option>
                <mat-option value="MeritScholarship">🌟 Merit Scholarship</mat-option>
                <mat-option value="StaffWard">👨‍🏫 Staff Ward Concession</mat-option>
                <mat-option value="EWS_RTE">🤝 EWS / RTE Concession</mat-option>
                <mat-option value="SportsQuota">🏆 Sports Quota</mat-option>
                <mat-option value="SpecialManagement">🎁 Management Discretion</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="select-field">
              <mat-label>Status</mat-label>
              <mat-select formControlName="status">
                <mat-option value="all">All Statuses</mat-option>
                <mat-option value="Active">Active</mat-option>
                <mat-option value="Suspended">Suspended</mat-option>
                <mat-option value="Expired">Expired</mat-option>
              </mat-select>
            </mat-form-field>

            <button mat-stroked-button (click)="resetFilters()" type="button" class="reset-btn">
              <mat-icon>clear_all</mat-icon> Reset
            </button>
          </div>
        </form>
      </mat-card>

      <!-- Concessions Data Table -->
      <mat-card class="table-card">
        <div class="table-responsive">
          <table class="custom-table" *ngIf="concessions.length > 0; else noData">
            <thead>
              <tr>
                <th>Student</th>
                <th>Concession Policy</th>
                <th>Category</th>
                <th>Discount Benefit</th>
                <th>Scope / Applicable Head</th>
                <th>Validity Window</th>
                <th>Status</th>
                <th>Approved By</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of concessions">
                <td>
                  <div class="student-cell">
                    <div class="student-avatar">
                      <mat-icon>person</mat-icon>
                    </div>
                    <div class="student-meta">
                      <span class="st-name">{{ c.studentName }}</span>
                      <span class="st-sub">
                        Roll: <strong>{{ c.rollNumber }}</strong>
                        <span *ngIf="c.admissionNumber"> &bull; Adm: <strong>{{ c.admissionNumber }}</strong></span>
                      </span>
                      <span class="st-class" *ngIf="c.classOrBatchName">{{ c.classOrBatchName }}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="concession-title font-bold">{{ c.title }}</span>
                  <div class="concession-remarks" *ngIf="c.remarks">{{ c.remarks }}</div>
                </td>
                <td>
                  <span class="badge-cat" [ngClass]="getCategoryBadgeClass(c.concessionType)">
                    {{ getCategoryLabel(c.concessionType) }}
                  </span>
                </td>
                <td>
                  <div class="discount-val-pill">
                    <span class="val font-bold">
                      {{ c.discountMode === 'Percentage' ? (c.discountValue + '% Off') : ('₹' + (c.discountValue | number:'1.2-2') + ' Flat') }}
                    </span>
                  </div>
                </td>
                <td>
                  <span class="head-pill" [class.all-heads]="!c.feeHeadName">
                    {{ c.feeHeadName ? c.feeHeadName : 'All Tuition & Applicable Heads' }}
                  </span>
                </td>
                <td>
                  <div class="validity-wrap">
                    <span class="valid-from">From: {{ c.applicableFrom | date:'dd MMM yyyy':'Asia/Kolkata' }}</span>
                    <span class="valid-to" *ngIf="c.applicableTo">To: {{ c.applicableTo | date:'dd MMM yyyy':'Asia/Kolkata' }}</span>
                    <span class="valid-ongoing" *ngIf="!c.applicableTo">Ongoing (Indefinite)</span>
                  </div>
                </td>
                <td>
                  <span class="status-chip" [ngClass]="{
                    'status-active': c.status === 'Active',
                    'status-suspended': c.status === 'Suspended',
                    'status-expired': c.status === 'Expired'
                  }">
                    {{ c.status }}
                  </span>
                </td>
                <td>
                  <span class="approved-by text-muted">{{ c.approvedBy || 'Administration' }}</span>
                </td>
                <td style="text-align: right;">
                  <div class="row-actions">
                    <button mat-icon-button (click)="toggleConcessionStatus(c)" [matTooltip]="c.status === 'Active' ? 'Suspend Concession' : 'Activate Concession'">
                      <mat-icon [color]="c.status === 'Active' ? 'warn' : 'primary'">
                        {{ c.status === 'Active' ? 'pause_circle_outline' : 'play_circle_outline' }}
                      </mat-icon>
                    </button>
                    <button mat-icon-button color="warn" (click)="deleteConcession(c)" matTooltip="Delete Concession">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ng-template #noData>
          <div class="empty-state-box" *ngIf="!loading">
            <mat-icon class="empty-icon">card_giftcard</mat-icon>
            <h3>No Fee Concessions Found</h3>
            <p>No active scholarship policies or sibling discount records match your current filter selection.</p>
            <button mat-raised-button color="primary" (click)="openAddModal()">
              <mat-icon>add</mat-icon> Grant First Concession
            </button>
          </div>
        </ng-template>
      </mat-card>

      <!-- Grant Concession Modal Dialog -->
      <div class="custom-modal-backdrop" *ngIf="showAddModal" (click)="closeAddModal()">
        <div class="custom-modal-box" (click)="$event.stopPropagation()">
          
          <!-- Strict Light Blue Gradient Header per AGENTS.md rule -->
          <div class="dialog-header">
            <div class="header-icon-wrap">
              <mat-icon>card_giftcard</mat-icon>
            </div>
            <div class="header-titles">
              <h2 class="main-title">Grant Fee Concession / Scholarship</h2>
              <p class="subtitle">Enroll a student into institutional sibling discounts, merit waivers, or scholarship schemes</p>
            </div>
            <button mat-icon-button type="button" class="close-btn" (click)="closeAddModal()" [disabled]="saving">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <form [formGroup]="concessionForm" (ngSubmit)="submitConcession()" class="modal-form">
            <div class="modal-body-scroll">

              <!-- Student Search & Selection -->
              <div class="form-section-title">1. Target Student Selection</div>
              <div class="student-search-box">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Search Student (Name, Admission No, Roll No, Phone)</mat-label>
                  <input matInput [formControl]="studentSearchControl" placeholder="Type at least 2 characters..." />
                  <mat-icon matPrefix>person_search</mat-icon>
                  <mat-progress-spinner matSuffix *ngIf="searchingStudents" diameter="20" mode="indeterminate"></mat-progress-spinner>
                </mat-form-field>

                <!-- Student Candidates List -->
                <div class="student-candidates-list" *ngIf="candidateStudents.length > 0">
                  <div class="candidate-row" *ngFor="let st of candidateStudents" (click)="selectStudent(st)" [class.selected]="selectedStudent?.id === st.id">
                    <mat-icon class="cand-icon">account_circle</mat-icon>
                    <div class="cand-info">
                      <strong>{{ st.studentName }}</strong>
                      <span>Roll: {{ st.rollNumber || 'N/A' }} &bull; Adm: {{ st.admissionNumber || 'N/A' }} &bull; {{ st.className || st.batchName || 'General' }}</span>
                    </div>
                    <mat-icon class="cand-check" *ngIf="selectedStudent?.id === st.id">check_circle</mat-icon>
                  </div>
                </div>

                <!-- Selected Student Banner -->
                <div class="selected-student-banner" *ngIf="selectedStudent">
                  <mat-icon class="banner-icon">check</mat-icon>
                  <div>
                    <strong>{{ selectedStudent.studentName }}</strong>
                    <span class="sub">({{ selectedStudent.rollNumber }} &bull; {{ selectedStudent.className || selectedStudent.batchName }})</span>
                  </div>
                  <button mat-button color="warn" type="button" (click)="clearSelectedStudent()" class="change-btn">Change</button>
                </div>
              </div>

              <!-- Concession Policy Details -->
              <div class="form-section-title" style="margin-top: 16px;">2. Concession Policy &amp; Discount Calculation</div>

              <div class="form-grid-2">
                <mat-form-field appearance="outline">
                  <mat-label>Concession Category *</mat-label>
                  <mat-select formControlName="concessionType" (selectionChange)="onCategoryChanged($event.value)">
                    <mat-option value="SiblingDiscount">👨‍👩‍👧 Sibling Discount</mat-option>
                    <mat-option value="MeritScholarship">🌟 Merit Scholarship (Academic/Board)</mat-option>
                    <mat-option value="StaffWard">👨‍🏫 Staff Ward / Teacher Child</mat-option>
                    <mat-option value="EWS_RTE">🤝 EWS / RTE Government Scheme</mat-option>
                    <mat-option value="SportsQuota">🏆 Sports &amp; Extra-curricular Quota</mat-option>
                    <mat-option value="SpecialManagement">🎁 Management Discretion Waiver</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Concession Policy Title *</mat-label>
                  <input matInput formControlName="title" placeholder="e.g. 2nd Child Sibling Discount (25%)" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Discount Mode *</mat-label>
                  <mat-select formControlName="discountMode">
                    <mat-option value="Percentage">Percentage (% Off Base Fee)</mat-option>
                    <mat-option value="FixedAmount">Fixed Amount (₹ Flat Deduction)</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Discount Value *</mat-label>
                  <input matInput type="number" formControlName="discountValue" min="0" placeholder="e.g. 20 or 500" />
                  <span matSuffix class="suffix-text">{{ concessionForm.get('discountMode')?.value === 'Percentage' ? '%' : '₹' }}</span>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Scope / Target Fee Head</mat-label>
                  <mat-select formControlName="feeHeadId">
                    <mat-option [value]="null">All Tuition &amp; Recurring Heads</mat-option>
                    <mat-option *ngFor="let h of feeHeadsList" [value]="h.id">{{ h.name }} ({{ h.code }})</mat-option>
                  </mat-select>
                  <mat-hint>Choose specific head or apply to all tuition</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Authorized By</mat-label>
                  <input matInput formControlName="approvedBy" placeholder="e.g. Principal / Director" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Valid From Date *</mat-label>
                  <input matInput type="date" formControlName="applicableFrom" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Valid To Date (Optional)</mat-label>
                  <input matInput type="date" formControlName="applicableTo" />
                  <mat-hint>Leave blank for continuous ongoing concession</mat-hint>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width" style="margin-top: 8px;">
                <mat-label>Internal Notes &amp; Verification Details</mat-label>
                <textarea matInput formControlName="remarks" rows="2" placeholder="e.g. Verified 92% in 10th CBSE; approved by management committee"></textarea>
              </mat-form-field>

            </div>

            <div class="modal-footer">
              <button mat-button type="button" (click)="closeAddModal()" [disabled]="saving">Cancel</button>
              <button mat-raised-button color="primary" type="submit" [disabled]="concessionForm.invalid || !selectedStudent || saving">
                <mat-icon>check</mat-icon> {{ saving ? 'Granting...' : 'Grant Concession' }}
              </button>
            </div>
          </form>

        </div>
      </div>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .page-container {
      padding: 0 0 40px;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Header Card */
    .header-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
      }

      .header-title-wrap {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .header-icon-box {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);

        mat-icon {
          font-size: 26px;
          width: 26px;
          height: 26px;
        }
      }

      .header-title {
        font-size: 1.45rem;
        font-weight: 700;
        color: #1e3a8a;
        margin: 0;
        line-height: 1.2;
      }

      .header-subtitle {
        font-size: 0.85rem;
        color: #64748b;
        margin: 4px 0 0;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
        margin-left: auto;
      }
    }

    .global-progress-bar {
      margin-top: -10px;
      margin-bottom: -10px;
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 16px;
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      transition: transform 0.15s ease, box-shadow 0.15s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.06);
      }

      .kpi-icon-wrap {
        width: 46px;
        height: 46px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }

        &.blue { background: #eff6ff; color: #2563eb; }
        &.purple { background: #f3e8ff; color: #9333ea; }
        &.amber { background: #fef3c7; color: #d97706; }
        &.green { background: #ecfdf5; color: #059669; }
        &.rose { background: #ffe4e6; color: #e11d48; }
      }

      .kpi-info {
        display: flex;
        flex-direction: column;

        .kpi-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .kpi-val {
          font-size: 1.45rem;
          font-weight: 700;
          color: #0f172a;
          margin-top: 2px;
        }

        .font-amount {
          color: #059669;
        }
      }
    }

    /* Filter Card */
    .filter-card {
      padding: 16px 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;

      .filter-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 14px;
      }

      .search-field {
        flex: 2;
        min-width: 260px;
        margin-bottom: -1.25em;
      }

      .select-field {
        flex: 1;
        min-width: 190px;
        margin-bottom: -1.25em;
      }

      .reset-btn {
        margin-top: 4px;
        height: 48px;
        color: #64748b;
      }
    }

    /* Table Styles */
    .table-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      padding: 0;
    }

    .table-responsive {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      width: 100%;
    }

    .custom-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.88rem;

      thead th {
        background: #f8fafc;
        padding: 12px 16px;
        color: #475569;
        font-weight: 600;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 1px solid #e2e8f0;
        white-space: nowrap;
      }

      tbody td {
        padding: 14px 16px;
        border-bottom: 1px solid #f1f5f9;
        color: #1e293b;
        vertical-align: middle;
      }

      tbody tr:hover {
        background: #f8fafc;
      }
    }

    .student-cell {
      display: flex;
      align-items: center;
      gap: 12px;

      .student-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #e0e7ff;
        color: #4338ca;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }

      .student-meta {
        display: flex;
        flex-direction: column;

        .st-name {
          font-weight: 700;
          color: #1e293b;
        }

        .st-sub {
          font-size: 0.78rem;
          color: #64748b;
        }

        .st-class {
          font-size: 0.75rem;
          font-weight: 600;
          color: #2563eb;
        }
      }
    }

    .concession-title {
      font-size: 0.92rem;
      color: #1e293b;
    }

    .concession-remarks {
      font-size: 0.75rem;
      color: #64748b;
      font-style: italic;
      margin-top: 2px;
    }

    .badge-cat {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;

      &.cat-sibling { background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; }
      &.cat-merit { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
      &.cat-staff { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
      &.cat-ews { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
      &.cat-sports { background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; }
      &.cat-mgmt { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
    }

    .discount-val-pill {
      display: inline-block;
      padding: 4px 10px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      color: #15803d;
      font-size: 0.92rem;
    }

    .head-pill {
      font-size: 0.8rem;
      padding: 3px 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      color: #334155;

      &.all-heads {
        background: #eff6ff;
        color: #1e40af;
        border-color: #bfdbfe;
        font-weight: 600;
      }
    }

    .validity-wrap {
      display: flex;
      flex-direction: column;
      font-size: 0.75rem;
      color: #475569;

      .valid-ongoing {
        color: #16a34a;
        font-weight: 600;
      }
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 600;

      &.status-active { background: #dcfce7; color: #166534; }
      &.status-suspended { background: #fef3c7; color: #92400e; }
      &.status-expired { background: #fee2e2; color: #991b1b; }
    }

    .empty-state-box {
      padding: 48px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;

      .empty-icon {
        font-size: 56px;
        width: 56px;
        height: 56px;
        color: #94a3b8;
      }

      h3 {
        margin: 0;
        font-size: 1.2rem;
        color: #1e293b;
      }

      p {
        margin: 0;
        color: #64748b;
        font-size: 0.88rem;
        max-width: 450px;
      }
    }

    /* Modal Backdrop and Container */
    .custom-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
    }

    .custom-modal-box {
      background: #ffffff;
      border-radius: 14px;
      width: 100%;
      max-width: 680px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      overflow: hidden;
    }

    /* Strict Light Blue Gradient Header matching AGENTS.md */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 14px;

      .header-icon-wrap {
        background: #2563eb;
        color: #ffffff;
        border-radius: 10px;
        box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        mat-icon { font-size: 22px; width: 22px; height: 22px; }
      }

      .header-titles {
        flex: 1;
        min-width: 0;

        .main-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.2;
        }

        .subtitle {
          margin: 2px 0 0;
          font-size: 0.78rem;
          color: #3b82f6;
        }
      }

      .close-btn { color: #64748b; &:hover { color: #1e293b; } }
    }

    .modal-body-scroll {
      padding: 20px;
      overflow-y: auto;
      max-height: calc(90vh - 140px);
    }

    .form-section-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
    }

    .student-candidates-list {
      max-height: 160px;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-top: -12px;
      margin-bottom: 12px;
      background: #f8fafc;

      .candidate-row {
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        border-bottom: 1px solid #f1f5f9;
        transition: background 0.1s ease;

        &:hover { background: #e0e7ff; }
        &.selected { background: #dbeafe; }

        .cand-icon { color: #64748b; font-size: 20px; width: 20px; height: 20px; }
        .cand-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          font-size: 0.82rem;
          strong { color: #1e293b; }
          span { color: #64748b; font-size: 0.75rem; }
        }
        .cand-check { color: #2563eb; font-size: 18px; width: 18px; height: 18px; }
      }
    }

    .selected-student-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 8px;
      margin-bottom: 14px;

      .banner-icon { color: #16a34a; }
      strong { color: #166534; font-size: 0.9rem; }
      .sub { color: #15803d; font-size: 0.8rem; margin-left: 6px; }
      .change-btn { margin-left: auto; font-size: 0.78rem; }
    }

    .form-grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;

      mat-form-field { margin-bottom: -1em; }
    }

    .full-width {
      width: 100%;
    }

    .suffix-text {
      font-weight: 700;
      color: #64748b;
      margin-right: 8px;
    }

    .modal-footer {
      padding: 14px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    /* Responsive Queries */
    @media (max-width: 768px) {
      .header-card .header-actions {
        width: 100%;
        justify-content: flex-start;
        margin-left: 0;
      }
      .filter-card .filter-row {
        flex-direction: column;
        align-items: stretch;
      }
      .search-field, .select-field {
        width: 100%;
      }
    }
  `]
})
export class FeeConcessionsComponent implements OnInit, OnDestroy {
  loading = false;
  saving = false;
  searchingStudents = false;

  concessions: StudentFeeConcession[] = [];
  stats: FeeConcessionStats | null = null;
  feeHeadsList: FeeHead[] = [];

  // Filter form
  filterForm: FormGroup;

  // Add Concession form & candidate selection
  showAddModal = false;
  concessionForm: FormGroup;
  studentSearchControl = this.fb.control('');
  candidateStudents: any[] = [];
  selectedStudent: any = null;

  private subs: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private feesService: FeesService,
    private coachingService: CoachingService,
    public authService: AuthService,
    private confirmDialog: ConfirmDialogService
  ) {
    this.filterForm = this.fb.group({
      searchTerm: [''],
      concessionType: ['all'],
      status: ['all']
    });

    this.concessionForm = this.fb.group({
      concessionType: ['SiblingDiscount', Validators.required],
      title: ['Sibling Discount (2nd Child)', Validators.required],
      discountMode: ['Percentage', Validators.required],
      discountValue: [20, [Validators.required, Validators.min(0.01)]],
      feeHeadId: [null],
      applicableFrom: [new Date().toISOString().substring(0, 10), Validators.required],
      applicableTo: [null],
      approvedBy: ['Administration'],
      remarks: ['']
    });
  }

  ngOnInit(): void {
    this.loadData();
    this.loadFeeHeads();

    // Auto-search on filter changes
    this.subs.push(
      this.filterForm.valueChanges
        .pipe(debounceTime(300), distinctUntilChanged())
        .subscribe(() => {
          this.loadConcessions();
        })
    );

    // Auto-search for student candidates in modal
    this.subs.push(
      this.studentSearchControl.valueChanges
        .pipe(debounceTime(300), distinctUntilChanged())
        .subscribe(term => {
          if (term && term.trim().length >= 2) {
            this.searchCandidates(term.trim());
          } else {
            this.candidateStudents = [];
          }
        })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  loadData(): void {
    this.loadConcessions();
    this.loadStats();
  }

  loadConcessions(): void {
    this.loading = true;
    const branchId = this.authService.selectedBranchId() || undefined;
    const val = this.filterForm.value;

    this.feesService.getConcessions({
      search: val.searchTerm,
      concessionType: val.concessionType,
      status: val.status,
      branchId
    }).subscribe({
      next: (list) => {
        this.concessions = list || [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        console.error('Failed to load concessions', err);
      }
    });
  }

  loadStats(): void {
    const branchId = this.authService.selectedBranchId() || undefined;
    this.feesService.getConcessionStats(branchId).subscribe({
      next: (res) => {
        this.stats = res;
      },
      error: () => {}
    });
  }

  loadFeeHeads(): void {
    this.feesService.getFeeHeads(true).subscribe({
      next: (heads) => {
        this.feeHeadsList = (heads || []).filter((h: any) => h.isActive !== false);
      },
      error: () => {}
    });
  }

  resetFilters(): void {
    this.filterForm.reset({
      searchTerm: '',
      concessionType: 'all',
      status: 'all'
    });
    this.loadConcessions();
  }

  // Candidate Search
  searchCandidates(term: string): void {
    this.searchingStudents = true;

    this.coachingService.getStudentsPaged(1, 15, term, 'studentName', false).subscribe({
      next: (res) => {
        this.searchingStudents = false;
        this.candidateStudents = res?.items || [];
      },
      error: () => {
        this.searchingStudents = false;
        this.candidateStudents = [];
      }
    });
  }

  selectStudent(st: any): void {
    this.selectedStudent = st;
    this.candidateStudents = [];
    this.studentSearchControl.setValue('', { emitEvent: false });
  }

  clearSelectedStudent(): void {
    this.selectedStudent = null;
  }

  openAddModal(): void {
    this.selectedStudent = null;
    this.candidateStudents = [];
    this.studentSearchControl.reset();
    this.concessionForm.reset({
      concessionType: 'SiblingDiscount',
      title: 'Sibling Discount (2nd Child)',
      discountMode: 'Percentage',
      discountValue: 20,
      feeHeadId: null,
      applicableFrom: new Date().toISOString().substring(0, 10),
      applicableTo: null,
      approvedBy: 'Administration',
      remarks: ''
    });
    this.showAddModal = true;
  }

  closeAddModal(): void {
    this.showAddModal = false;
  }

  onCategoryChanged(cat: string): void {
    switch (cat) {
      case 'SiblingDiscount':
        this.concessionForm.patchValue({
          title: 'Sibling Discount (2nd Child)',
          discountMode: 'Percentage',
          discountValue: 20
        });
        break;
      case 'MeritScholarship':
        this.concessionForm.patchValue({
          title: 'Board Exam 90%+ Merit Scholarship',
          discountMode: 'Percentage',
          discountValue: 50
        });
        break;
      case 'StaffWard':
        this.concessionForm.patchValue({
          title: 'Institutional Staff Ward Waiver',
          discountMode: 'Percentage',
          discountValue: 100
        });
        break;
      case 'EWS_RTE':
        this.concessionForm.patchValue({
          title: 'RTE / EWS Government Concession',
          discountMode: 'Percentage',
          discountValue: 100
        });
        break;
      case 'SportsQuota':
        this.concessionForm.patchValue({
          title: 'State Sports Championship Quota',
          discountMode: 'Percentage',
          discountValue: 25
        });
        break;
      default:
        this.concessionForm.patchValue({
          title: 'Management Discretion Waiver',
          discountMode: 'FixedAmount',
          discountValue: 500
        });
        break;
    }
  }

  submitConcession(): void {
    if (this.concessionForm.invalid || !this.selectedStudent || this.saving) return;

    this.saving = true;
    const val = this.concessionForm.value;
    const dto: CreateFeeConcessionDto = {
      studentId: this.selectedStudent.id,
      concessionType: val.concessionType,
      title: val.title.trim(),
      discountMode: val.discountMode,
      discountValue: Number(val.discountValue),
      feeHeadId: val.feeHeadId || null,
      applicableFrom: val.applicableFrom ? new Date(val.applicableFrom).toISOString() : null,
      applicableTo: val.applicableTo ? new Date(val.applicableTo).toISOString() : null,
      approvedBy: val.approvedBy?.trim() || null,
      remarks: val.remarks?.trim() || null
    };

    this.feesService.createConcession(dto).subscribe({
      next: () => {
        this.saving = false;
        this.closeAddModal();
        this.loadData();
        this.confirmDialog.alert(
          'Concession Granted',
          `Fee concession granted successfully for ${this.selectedStudent.studentName}. Automated invoice billing will now apply this discount!`,
          'success'
        );
      },
      error: (err) => {
        this.saving = false;
        this.confirmDialog.alert('Failed to Grant Concession', err?.error?.message || err.message || 'Error granting concession.', 'danger');
      }
    });
  }

  toggleConcessionStatus(c: StudentFeeConcession): void {
    const newStatus = c.status === 'Active' ? 'Suspended' : 'Active';
    const actionLabel = newStatus === 'Active' ? 'Activate' : 'Suspend';

    this.confirmDialog.confirm(
      `${actionLabel} Concession`,
      `Are you sure you want to ${actionLabel.toLowerCase()} the concession "${c.title}" for ${c.studentName}?`,
      `Yes, ${actionLabel}`,
      'Cancel',
      newStatus === 'Active' ? 'success' : 'warning'
    ).subscribe(confirmed => {
      if (!confirmed) return;

      this.feesService.updateConcessionStatus(c.id, { status: newStatus }).subscribe({
        next: () => {
          c.status = newStatus;
          this.loadStats();
          this.confirmDialog.alert('Status Updated', `Concession status changed to ${newStatus}.`, 'success');
        },
        error: (err) => {
          this.confirmDialog.alert('Error', err?.error?.message || 'Failed to update concession status.', 'danger');
        }
      });
    });
  }

  deleteConcession(c: StudentFeeConcession): void {
    this.confirmDialog.confirm(
      'Delete Fee Concession',
      `Are you sure you want to delete the concession "${c.title}" for ${c.studentName}? Future invoices will no longer receive this discount.`,
      'Yes, Delete',
      'Cancel',
      'danger'
    ).subscribe(confirmed => {
      if (!confirmed) return;

      this.feesService.deleteConcession(c.id).subscribe({
        next: () => {
          this.concessions = this.concessions.filter(x => x.id !== c.id);
          this.loadStats();
          this.confirmDialog.alert('Deleted', 'Fee concession removed successfully.', 'success');
        },
        error: (err) => {
          this.confirmDialog.alert('Error', err?.error?.message || 'Failed to remove concession.', 'danger');
        }
      });
    });
  }

  getCategoryLabel(type: string): string {
    switch (type) {
      case 'SiblingDiscount': return '👨‍👩‍👧 Sibling Discount';
      case 'MeritScholarship': return '🌟 Merit Scholarship';
      case 'StaffWard': return '👨‍🏫 Staff Ward';
      case 'EWS_RTE': return '🤝 EWS / RTE';
      case 'SportsQuota': return '🏆 Sports Quota';
      default: return '🎁 Management';
    }
  }

  getCategoryBadgeClass(type: string): string {
    switch (type) {
      case 'SiblingDiscount': return 'cat-sibling';
      case 'MeritScholarship': return 'cat-merit';
      case 'StaffWard': return 'cat-staff';
      case 'EWS_RTE': return 'cat-ews';
      case 'SportsQuota': return 'cat-sports';
      default: return 'cat-mgmt';
    }
  }
}
