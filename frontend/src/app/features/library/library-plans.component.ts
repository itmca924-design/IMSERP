import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { LibraryService, LibraryMembershipPlanDto } from '../../core/services/library.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-library-plans',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatSlideToggleModule
  ],
  template: `
    <div class="library-container">
      <!-- Top Page Header -->
      <div class="page-header">
        <div>
          <h2 class="page-title">
            <mat-icon class="title-icon">schedule</mat-icon>
            Library Shifts &amp; Membership Plans
          </h2>
          <p class="page-subtitle">
            Configure reading room study shifts, lending types, monthly fees, and book borrow limits. These dynamically populate in student admissions and fee invoices.
          </p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button routerLink="/library/books" class="link-btn">
            <mat-icon>local_library</mat-icon> Books Catalog
          </a>
          <a mat-stroked-button routerLink="/library/circulation" class="link-btn">
            <mat-icon>sync_alt</mat-icon> Circulation Counter
          </a>
          <button mat-raised-button color="primary" class="action-btn" (click)="openAddModal()">
            <mat-icon>add</mat-icon>
            <span>Add New Shift / Plan</span>
          </button>
        </div>
      </div>

      <!-- Quick KPI Summary Cards -->
      <div class="kpi-grid">
        <div class="kpi-card total">
          <div class="kpi-icon-box"><mat-icon>auto_stories</mat-icon></div>
          <div class="kpi-content">
            <span class="kpi-label">Configured Plans</span>
            <span class="kpi-value">{{ plans.length }}</span>
          </div>
        </div>
        <div class="kpi-card active">
          <div class="kpi-icon-box"><mat-icon>check_circle</mat-icon></div>
          <div class="kpi-content">
            <span class="kpi-label">Active Shifts</span>
            <span class="kpi-value">{{ activePlansCount }}</span>
          </div>
        </div>
        <div class="kpi-card free">
          <div class="kpi-icon-box"><mat-icon>volunteer_activism</mat-icon></div>
          <div class="kpi-content">
            <span class="kpi-label">Free Lending Plans</span>
            <span class="kpi-value">{{ freePlansCount }}</span>
          </div>
        </div>
        <div class="kpi-card paid">
          <div class="kpi-icon-box"><mat-icon>currency_rupee</mat-icon></div>
          <div class="kpi-content">
            <span class="kpi-label">Max Shift Fee</span>
            <span class="kpi-value">₹{{ maxShiftFee | number }}</span>
          </div>
        </div>
      </div>

      <!-- Progress bar -->
      <mat-progress-bar *ngIf="loading" mode="indeterminate" class="load-bar"></mat-progress-bar>

      <!-- Main Plans Table Card -->
      <mat-card class="table-card">
        <div class="table-card-header">
          <div class="tch-title">
            <mat-icon>tune</mat-icon>
            <span>All Shift &amp; Membership Rates</span>
          </div>
          <div class="tch-meta">
            <span>{{ plans.length }} Shifts Configured</span>
          </div>
        </div>

        <div class="table-responsive">
          <table mat-table [dataSource]="plans" class="custom-plans-table">
            <!-- Order Column -->
            <ng-container matColumnDef="sortOrder">
              <th mat-header-cell *matHeaderCellDef style="width: 70px;"># Order</th>
              <td mat-cell *matCellDef="let p">
                <span class="order-badge">{{ p.sortOrder }}</span>
              </td>
            </ng-container>

            <!-- Plan Name Column -->
            <ng-container matColumnDef="planName">
              <th mat-header-cell *matHeaderCellDef>Shift / Membership Plan</th>
              <td mat-cell *matCellDef="let p">
                <div class="plan-name-cell">
                  <strong>{{ p.planName }}</strong>
                  <span class="timing-sub" *ngIf="p.shiftTiming">
                    <mat-icon>access_time</mat-icon> {{ p.shiftTiming }}
                  </span>
                </div>
              </td>
            </ng-container>

            <!-- Monthly Fee Column -->
            <ng-container matColumnDef="monthlyFee">
              <th mat-header-cell *matHeaderCellDef>Monthly Fee</th>
              <td mat-cell *matCellDef="let p">
                <span class="fee-badge" [class.free-badge]="p.monthlyFee === 0">
                  {{ p.monthlyFee > 0 ? ('₹' + (p.monthlyFee | number) + ' / month') : 'Free Lending (₹0)' }}
                </span>
              </td>
            </ng-container>

            <!-- Max Books Limit Column -->
            <ng-container matColumnDef="maxBooks">
              <th mat-header-cell *matHeaderCellDef>Borrow Limit</th>
              <td mat-cell *matCellDef="let p">
                <div class="books-limit-badge">
                  <mat-icon>menu_book</mat-icon>
                  <span>{{ p.maxBooks }} Books</span>
                </div>
              </td>
            </ng-container>

            <!-- Status Column -->
            <ng-container matColumnDef="isActive">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let p">
                <span class="status-pill" [class.active-pill]="p.isActive" [class.inactive-pill]="!p.isActive">
                  {{ p.isActive ? 'Active' : 'Disabled' }}
                </span>
              </td>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef style="text-align: right;">Actions</th>
              <td mat-cell *matCellDef="let p" style="text-align: right;">
                <button mat-icon-button color="primary" matTooltip="Edit Shift / Plan" (click)="openEditModal(p)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" matTooltip="Delete Shift / Plan" (click)="deletePlan(p)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="plan-row"></tr>

            <!-- Empty Row -->
            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell empty-table" colspan="6">
                <mat-icon>info</mat-icon>
                <span>No library membership plans found. Click "+ Add New Shift / Plan" to create one.</span>
              </td>
            </tr>
          </table>
        </div>
      </mat-card>

      <!-- ============================================================= -->
      <!-- Add / Edit Shift Dialog Overlay (Strict Light Blue Header)     -->
      <!-- ============================================================= -->
      <div class="modal-backdrop" *ngIf="showModal" (click)="closeModal()">
        <div class="modal-dialog-card" (click)="$event.stopPropagation()">
          <!-- STRICT COMPLIANT HEADER -->
          <div class="modal-header-box">
            <div class="header-left">
              <div class="header-icon-box">
                <mat-icon>{{ isEditMode ? 'edit_note' : 'schedule' }}</mat-icon>
              </div>
              <div class="header-title-meta">
                <h3 class="header-title">{{ isEditMode ? 'Edit Library Shift / Plan' : 'Add New Library Shift / Plan' }}</h3>
                <p class="header-subtitle">
                  Configure <strong>pricing and book borrow quota</strong> for students opting into this shift.
                </p>
              </div>
            </div>
            <button type="button" class="close-btn" (click)="closeModal()" matTooltip="Close">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Dialog Body Form -->
          <form [formGroup]="planForm" (ngSubmit)="savePlan()" class="modal-form-body">
            <div class="form-grid">
              <mat-form-field appearance="outline" class="full-span">
                <mat-label>Plan / Shift Name *</mat-label>
                <input matInput formControlName="planName" placeholder="e.g. Morning Study Shift (8AM - 1PM)" />
                <mat-hint>Name shown in the admission dropdown and fee invoice</mat-hint>
                <mat-error *ngIf="planForm.get('planName')?.invalid">Plan name is required</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Shift Timing / Slot</mat-label>
                <input matInput formControlName="shiftTiming" placeholder="e.g. 8:00 AM - 1:00 PM" />
                <mat-hint>Timing hours for library access</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Monthly Library Fee (₹) *</mat-label>
                <input matInput type="number" formControlName="monthlyFee" min="0" placeholder="0" />
                <mat-hint>Keep ₹0 for free book lending, or enter monthly amount</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Max Book Borrow Limit *</mat-label>
                <input matInput type="number" formControlName="maxBooks" min="1" max="20" placeholder="2" />
                <mat-hint>Max physical books student can hold at once</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Display Order</mat-label>
                <input matInput type="number" formControlName="sortOrder" min="0" placeholder="1" />
                <mat-hint>Sorting order in dropdowns (lower first)</mat-hint>
              </mat-form-field>

              <div class="toggle-span" *ngIf="isEditMode">
                <mat-slide-toggle formControlName="isActive" color="primary">
                  <span>Shift Status: <strong>{{ planForm.get('isActive')?.value ? 'Active (Available)' : 'Disabled' }}</strong></span>
                </mat-slide-toggle>
              </div>
            </div>

            <!-- Modal Action Buttons -->
            <div class="modal-footer-actions">
              <button mat-button type="button" (click)="closeModal()" class="cancel-btn">Cancel</button>
              <button mat-raised-button color="primary" type="submit" [disabled]="planForm.invalid || saving" class="submit-btn">
                <mat-icon>{{ saving ? 'hourglass_top' : 'check' }}</mat-icon>
                <span>{{ saving ? 'Saving Plan...' : (isEditMode ? 'Update Shift' : 'Create Shift') }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .library-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Page Header */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 16px;

      .page-title {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0;
        font-size: 1.6rem;
        font-weight: 700;
        color: #0f172a;

        .title-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
          color: #2563eb;
        }
      }

      .page-subtitle {
        margin: 6px 0 0 0;
        color: #64748b;
        font-size: 0.92rem;
        max-width: 750px;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;

        .link-btn {
          border-color: #cbd5e1;
          color: #334155;
          font-weight: 500;
        }

        .action-btn {
          background: #2563eb;
          color: #ffffff;
          font-weight: 600;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
        }
      }
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;

      .kpi-card {
        background: #ffffff;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);

        .kpi-icon-box {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 26px; width: 26px; height: 26px; }
        }

        .kpi-content {
          display: flex;
          flex-direction: column;

          .kpi-label {
            font-size: 0.8rem;
            color: #64748b;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .kpi-value {
            font-size: 1.4rem;
            font-weight: 700;
            color: #0f172a;
          }
        }

        &.total .kpi-icon-box { background: #eff6ff; color: #2563eb; }
        &.active .kpi-icon-box { background: #f0fdf4; color: #16a34a; }
        &.free .kpi-icon-box { background: #faf5ff; color: #9333ea; }
        &.paid .kpi-icon-box { background: #fffbeb; color: #d97706; }
      }
    }

    .load-bar {
      border-radius: 4px;
    }

    /* Table Card */
    .table-card {
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);

      .table-card-header {
        padding: 16px 20px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;

        .tch-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          color: #1e293b;
          font-size: 1rem;
          mat-icon { color: #2563eb; font-size: 20px; width: 20px; height: 20px; }
        }

        .tch-meta {
          font-size: 0.84rem;
          color: #64748b;
          font-weight: 500;
        }
      }

      .table-responsive {
        overflow-x: auto;
      }
    }

    .custom-plans-table {
      width: 100%;

      th.mat-header-cell {
        background: #f8fafc;
        color: #475569;
        font-weight: 600;
        font-size: 0.85rem;
        padding: 14px 16px;
        border-bottom: 1px solid #e2e8f0;
      }

      td.mat-cell {
        padding: 14px 16px;
        color: #1e293b;
        font-size: 0.9rem;
        border-bottom: 1px solid #f1f5f9;
      }

      .plan-row:hover {
        background: #f8fafc;
      }

      .order-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        background: #f1f5f9;
        color: #475569;
        font-weight: 700;
        border-radius: 6px;
        font-size: 0.82rem;
      }

      .plan-name-cell {
        display: flex;
        flex-direction: column;
        gap: 3px;

        strong {
          color: #0f172a;
          font-weight: 600;
        }

        .timing-sub {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.8rem;
          color: #64748b;
          mat-icon { font-size: 14px; width: 14px; height: 14px; }
        }
      }

      .fee-badge {
        display: inline-flex;
        padding: 4px 10px;
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
        border-radius: 6px;
        font-weight: 700;
        font-size: 0.85rem;

        &.free-badge {
          background: #f0fdf4;
          color: #15803d;
          border-color: #bbf7d0;
        }
      }

      .books-limit-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #475569;
        font-weight: 500;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; }
      }

      .status-pill {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 12px;
        font-size: 0.76rem;
        font-weight: 600;

        &.active-pill {
          background: #dcfce7;
          color: #15803d;
        }

        &.inactive-pill {
          background: #fee2e2;
          color: #b91c1c;
        }
      }

      .empty-table {
        text-align: center;
        padding: 40px 20px;
        color: #94a3b8;
        mat-icon { font-size: 36px; width: 36px; height: 36px; margin-bottom: 8px; }
      }
    }

    /* Modal Backdrop & Strict Dialog Styling */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(4px);
      z-index: 1050;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .modal-dialog-card {
      background: #ffffff;
      border-radius: 14px;
      width: 100%;
      max-width: 560px;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
      animation: modalSlide 0.2s ease-out;

      /* STRICT AGENTS.MD LIGHT-BLUE GRADIENT HEADER */
      .modal-header-box {
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border-bottom: 1px solid #bfdbfe;
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;

        .header-left {
          display: flex;
          align-items: center;
          gap: 14px;

          .header-icon-box {
            background: #2563eb;
            color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            mat-icon { font-size: 24px; width: 24px; height: 24px; }
          }

          .header-title-meta {
            .header-title {
              margin: 0;
              font-size: 1.15rem;
              font-weight: 700;
              color: #1e3a8a;
            }

            .header-subtitle {
              margin: 2px 0 0 0;
              font-size: 0.82rem;
              color: #3b82f6;

              strong {
                color: #1e40af;
              }
            }
          }
        }

        .close-btn {
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          border-radius: 6px;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;

          &:hover {
            color: #1e293b;
            background: rgba(0, 0, 0, 0.05);
          }
        }
      }

      .modal-form-body {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;

          .full-span {
            grid-column: 1 / -1;
          }

          .toggle-span {
            grid-column: 1 / -1;
            padding: 8px 0;
          }
        }

        .modal-footer-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 12px;
          margin-top: 10px;
          border-top: 1px solid #f1f5f9;
          padding-top: 16px;

          .cancel-btn {
            color: #64748b;
            font-weight: 500;
          }

          .submit-btn {
            background: #2563eb;
            color: #ffffff;
            font-weight: 600;
          }
        }
      }
    }

    @keyframes modalSlide {
      from { transform: translateY(-12px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `]
})
export class LibraryPlansComponent implements OnInit {
  displayedColumns = ['sortOrder', 'planName', 'monthlyFee', 'maxBooks', 'isActive', 'actions'];
  plans: LibraryMembershipPlanDto[] = [];
  loading = false;
  saving = false;

  showModal = false;
  isEditMode = false;
  editingId: string | null = null;
  planForm: FormGroup;

  constructor(
    private libraryService: LibraryService,
    private confirmDialog: ConfirmDialogService,
    private fb: FormBuilder
  ) {
    this.planForm = this.fb.group({
      planName: ['', Validators.required],
      shiftTiming: [''],
      monthlyFee: [0, [Validators.required, Validators.min(0)]],
      maxBooks: [2, [Validators.required, Validators.min(1)]],
      sortOrder: [1, Validators.required],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading = true;
    this.libraryService.getMembershipPlans(false).subscribe({
      next: (res) => {
        this.plans = res || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching plans:', err);
        this.loading = false;
      }
    });
  }

  get activePlansCount(): number {
    return this.plans.filter(p => p.isActive).length;
  }

  get freePlansCount(): number {
    return this.plans.filter(p => p.monthlyFee === 0).length;
  }

  get maxShiftFee(): number {
    if (this.plans.length === 0) return 0;
    return Math.max(...this.plans.map(p => p.monthlyFee || 0));
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.editingId = null;
    const nextOrder = (this.plans.length > 0 ? Math.max(...this.plans.map(p => p.sortOrder || 0)) + 1 : 1);
    this.planForm.reset({
      planName: '',
      shiftTiming: '',
      monthlyFee: 500,
      maxBooks: 2,
      sortOrder: nextOrder,
      isActive: true
    });
    this.showModal = true;
  }

  openEditModal(plan: LibraryMembershipPlanDto): void {
    this.isEditMode = true;
    this.editingId = plan.id;
    this.planForm.patchValue({
      planName: plan.planName,
      shiftTiming: plan.shiftTiming || '',
      monthlyFee: plan.monthlyFee,
      maxBooks: plan.maxBooks,
      sortOrder: plan.sortOrder,
      isActive: plan.isActive
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingId = null;
  }

  savePlan(): void {
    if (this.planForm.invalid) return;

    this.saving = true;
    const formVal = this.planForm.value;

    if (this.isEditMode && this.editingId) {
      this.libraryService.updateMembershipPlan(this.editingId, {
        planName: formVal.planName,
        shiftTiming: formVal.shiftTiming,
        monthlyFee: Number(formVal.monthlyFee),
        maxBooks: Number(formVal.maxBooks),
        sortOrder: Number(formVal.sortOrder),
        isActive: formVal.isActive
      }).subscribe({
        next: () => {
          this.saving = false;
          this.closeModal();
          this.loadPlans();
        },
        error: (err) => {
          console.error('Error updating plan:', err);
          this.saving = false;
        }
      });
    } else {
      this.libraryService.createMembershipPlan({
        planName: formVal.planName,
        shiftTiming: formVal.shiftTiming,
        monthlyFee: Number(formVal.monthlyFee),
        maxBooks: Number(formVal.maxBooks),
        sortOrder: Number(formVal.sortOrder)
      }).subscribe({
        next: () => {
          this.saving = false;
          this.closeModal();
          this.loadPlans();
        },
        error: (err) => {
          console.error('Error creating plan:', err);
          this.saving = false;
        }
      });
    }
  }

  deletePlan(plan: LibraryMembershipPlanDto): void {
    this.confirmDialog.danger(
      'Delete Shift / Membership Plan?',
      `Are you sure you want to delete "${plan.planName}"? Students already enrolled with this shift will keep their existing fee, but this plan won't appear for new admissions.`,
      'Delete Plan'
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.libraryService.deleteMembershipPlan(plan.id).subscribe({
          next: () => this.loadPlans(),
          error: (err) => console.error('Error deleting plan:', err)
        });
      }
    });
  }
}
