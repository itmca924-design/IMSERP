import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { LibraryService, LibraryMembershipPlanDto } from '../../core/services/library.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-manage-library-plans-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatSlideToggleModule
  ],
  template: `
    <div class="plans-dialog-wrapper">
      <!-- STRICT COMPLIANT HEADER -->
      <div class="dialog-header-box">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>schedule</mat-icon>
          </div>
          <div class="header-title-meta">
            <h2 class="header-title">Manage Library Shifts &amp; Membership Plans</h2>
            <p class="header-subtitle">
              Configure <strong>shifts, study timings, and monthly rates</strong> for student enrollments.
            </p>
          </div>
        </div>
        <button type="button" class="close-btn" (click)="closeDialog()" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Loading Bar -->
      <mat-progress-bar *ngIf="loading" mode="indeterminate"></mat-progress-bar>

      <!-- Dialog Body Content -->
      <div class="dialog-body">
        <!-- Add / Edit Inline Box -->
        <div class="plan-form-card" [class.editing]="isEditMode">
          <div class="pfc-header">
            <mat-icon color="primary">{{ isEditMode ? 'edit_note' : 'add_circle' }}</mat-icon>
            <strong>{{ isEditMode ? 'Edit Selected Shift' : 'Add New Shift / Plan' }}</strong>
            <button mat-button color="warn" type="button" *ngIf="isEditMode" (click)="resetForm()" class="cancel-edit-btn">
              Cancel Edit
            </button>
          </div>

          <form [formGroup]="planForm" (ngSubmit)="savePlan()" class="pfc-form">
            <div class="form-row">
              <mat-form-field appearance="outline" class="flex-2">
                <mat-label>Plan / Shift Name *</mat-label>
                <input matInput formControlName="planName" placeholder="e.g. Morning Shift (8AM - 1PM)" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Shift Timing</mat-label>
                <input matInput formControlName="shiftTiming" placeholder="e.g. 8:00 AM - 1:00 PM" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Monthly Fee (₹) *</mat-label>
                <input matInput type="number" formControlName="monthlyFee" min="0" placeholder="0" />
              </mat-form-field>

              <mat-form-field appearance="outline" style="width: 110px;">
                <mat-label>Max Books</mat-label>
                <input matInput type="number" formControlName="maxBooks" min="1" max="20" placeholder="2" />
              </mat-form-field>

              <mat-form-field appearance="outline" style="width: 80px;">
                <mat-label>Order</mat-label>
                <input matInput type="number" formControlName="sortOrder" min="1" placeholder="1" />
              </mat-form-field>

              <div class="submit-col">
                <button mat-raised-button color="primary" type="submit" [disabled]="planForm.invalid || saving" class="save-plan-btn">
                  <mat-icon>{{ saving ? 'hourglass_top' : (isEditMode ? 'save' : 'add') }}</mat-icon>
                  <span>{{ isEditMode ? 'Update' : 'Add' }}</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        <!-- Table of Existing Plans -->
        <div class="plans-table-wrapper">
          <table mat-table [dataSource]="plans" class="plans-table">
            <!-- Order Column -->
            <ng-container matColumnDef="sortOrder">
              <th mat-header-cell *matHeaderCellDef style="width: 50px;">#</th>
              <td mat-cell *matCellDef="let p">
                <span class="order-tag">{{ p.sortOrder }}</span>
              </td>
            </ng-container>

            <!-- Plan Name Column -->
            <ng-container matColumnDef="planName">
              <th mat-header-cell *matHeaderCellDef>Shift / Membership Plan</th>
              <td mat-cell *matCellDef="let p">
                <div class="name-block">
                  <span class="p-name">{{ p.planName }}</span>
                  <span class="p-timing" *ngIf="p.shiftTiming">
                    <mat-icon>access_time</mat-icon> {{ p.shiftTiming }}
                  </span>
                </div>
              </td>
            </ng-container>

            <!-- Fee Column -->
            <ng-container matColumnDef="monthlyFee">
              <th mat-header-cell *matHeaderCellDef>Monthly Rate</th>
              <td mat-cell *matCellDef="let p">
                <span class="fee-pill" [class.free]="p.monthlyFee === 0">
                  {{ p.monthlyFee > 0 ? ('₹' + (p.monthlyFee | number) + ' / mo') : 'Free / ₹0' }}
                </span>
              </td>
            </ng-container>

            <!-- Books Limit Column -->
            <ng-container matColumnDef="maxBooks">
              <th mat-header-cell *matHeaderCellDef>Quota</th>
              <td mat-cell *matCellDef="let p">
                <span class="quota-text">{{ p.maxBooks }} Books</span>
              </td>
            </ng-container>

            <!-- Status Column -->
            <ng-container matColumnDef="isActive">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let p">
                <span class="status-dot" [class.active]="p.isActive"></span>
                <span>{{ p.isActive ? 'Active' : 'Disabled' }}</span>
              </td>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef style="text-align: right;">Actions</th>
              <td mat-cell *matCellDef="let p" style="text-align: right;">
                <button mat-icon-button color="primary" matTooltip="Edit Plan" (click)="startEdit(p)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" matTooltip="Delete Plan" (click)="deletePlan(p)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="table-row"></tr>

            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell empty-row" colspan="6">
                No shifts found. Fill the form above to add a new shift.
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Dialog Footer -->
      <div class="dialog-footer">
        <span class="footer-hint">
          <mat-icon>lightbulb</mat-icon>
          Changes here update all admission dropdowns instantly.
        </span>
        <button mat-flat-button color="primary" (click)="closeDialog()" class="done-btn">
          <mat-icon>check</mat-icon> Done &amp; Apply
        </button>
      </div>
    </div>
  `,
  styles: [`
    .plans-dialog-wrapper {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      overflow: hidden;
      background: #ffffff;
    }

    /* STRICT AGENTS.MD LIGHT-BLUE GRADIENT HEADER */
    .dialog-header-box {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 22px;
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
            font-size: 1.18rem;
            font-weight: 700;
            color: #1e3a8a;
          }

          .header-subtitle {
            margin: 2px 0 0 0;
            font-size: 0.83rem;
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

    /* Dialog Body */
    .dialog-body {
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .plan-form-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;

      &.editing {
        background: #f0f9ff;
        border-color: #bae6fd;
      }

      .pfc-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        color: #1e293b;
        font-size: 0.95rem;

        .cancel-edit-btn {
          margin-left: auto;
          font-size: 0.8rem;
          height: 28px;
          line-height: 28px;
        }
      }

      .form-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;

        .flex-2 { flex: 2; min-width: 180px; }
        .flex-1 { flex: 1; min-width: 140px; }

        mat-form-field {
          margin-bottom: -10px;
        }

        .submit-col {
          display: flex;
          align-items: center;
          padding-bottom: 8px;

          .save-plan-btn {
            height: 48px;
            font-weight: 600;
          }
        }
      }
    }

    .plans-table-wrapper {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }

    .plans-table {
      width: 100%;

      th.mat-header-cell {
        background: #f8fafc;
        color: #475569;
        font-weight: 600;
        font-size: 0.82rem;
        padding: 10px 14px;
      }

      td.mat-cell {
        padding: 10px 14px;
        font-size: 0.88rem;
        color: #1e293b;
      }

      .order-tag {
        display: inline-block;
        background: #f1f5f9;
        color: #475569;
        font-weight: 700;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 0.75rem;
      }

      .name-block {
        display: flex;
        flex-direction: column;
        gap: 2px;

        .p-name {
          font-weight: 600;
          color: #0f172a;
        }

        .p-timing {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.78rem;
          color: #64748b;
          mat-icon { font-size: 13px; width: 13px; height: 13px; }
        }
      }

      .fee-pill {
        display: inline-block;
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
        border-radius: 6px;
        padding: 2px 8px;
        font-weight: 700;
        font-size: 0.82rem;

        &.free {
          background: #f0fdf4;
          color: #15803d;
          border-color: #bbf7d0;
        }
      }

      .quota-text {
        font-weight: 500;
        color: #475569;
      }

      .status-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #cbd5e1;
        margin-right: 6px;

        &.active {
          background: #22c55e;
        }
      }

      .empty-row {
        text-align: center;
        padding: 30px;
        color: #94a3b8;
      }
    }

    /* Dialog Footer */
    .dialog-footer {
      padding: 12px 20px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      display: flex;
      justify-content: space-between;
      align-items: center;

      .footer-hint {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.82rem;
        color: #64748b;
        mat-icon { font-size: 16px; width: 16px; height: 16px; color: #f59e0b; }
      }

      .done-btn {
        background: #2563eb;
        color: #ffffff;
        font-weight: 600;
      }
    }
  `]
})
export class ManageLibraryPlansDialogComponent implements OnInit {
  displayedColumns = ['sortOrder', 'planName', 'monthlyFee', 'maxBooks', 'isActive', 'actions'];
  plans: LibraryMembershipPlanDto[] = [];
  loading = false;
  saving = false;

  isEditMode = false;
  editingId: string | null = null;
  planForm: FormGroup;

  constructor(
    private dialogRef: MatDialogRef<ManageLibraryPlansDialogComponent>,
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
        console.error('Error loading plans:', err);
        this.loading = false;
      }
    });
  }

  resetForm(): void {
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
  }

  startEdit(plan: LibraryMembershipPlanDto): void {
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
          this.resetForm();
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
          this.resetForm();
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
          next: () => {
            if (this.editingId === plan.id) this.resetForm();
            this.loadPlans();
          },
          error: (err) => console.error('Error deleting plan:', err)
        });
      }
    });
  }

  closeDialog(): void {
    this.dialogRef.close(true);
  }
}
