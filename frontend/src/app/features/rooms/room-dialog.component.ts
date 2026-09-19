import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RoomDto, CreateRoomDto, UpdateRoomDto, RoomService } from '../../core/services/room.service';
import { BranchDto } from '../../core/services/branch.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';

export interface RoomDialogData {
  isEditing: boolean;
  room?: RoomDto;
  branches: BranchDto[];
}

@Component({
  selector: 'app-room-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dialog-wrapper">
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>{{ data.isEditing ? 'edit_location' : 'meeting_room' }}</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">{{ data.isEditing ? 'Edit Classroom' : 'Create New Classroom' }}</h2>
          <p class="subtitle">{{ data.isEditing ? 'Modify room identifier, seating capacity, and building wing.' : 'Register a physical classroom with seating capacity and campus branch.' }}</p>
        </div>
        <button mat-icon-button type="button" class="close-btn" (click)="onCancel()" [disabled]="saving">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="roomForm" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-content">

          <!-- Info Callout -->
          <div class="info-callout">
            <mat-icon class="info-icon">auto_awesome</mat-icon>
            <div class="info-text">
              <strong>Classroom Capacity Engine:</strong> Seating capacity defined here ensures optimal batch allocation and prevents over-enrollment during student admissions.
            </div>
          </div>

          <!-- Section: Location & Branch -->
          <div class="section-label">
            <mat-icon class="section-icon">storefront</mat-icon>
            <span>Campus &amp; Location Allocation</span>
          </div>

          <div class="form-grid">
            <!-- Branch Selector (only on create) -->
            <mat-form-field appearance="outline" class="full-width" *ngIf="!data.isEditing">
              <mat-label>Campus Branch *</mat-label>
              <mat-select formControlName="branchId" placeholder="Select Branch">
                <mat-option *ngFor="let b of data.branches" [value]="b.id">
                  {{ b.name }} {{ b.isMainBranch ? '(Main Branch)' : '' }}
                </mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">storefront</mat-icon>
              <mat-error *ngIf="roomForm.get('branchId')?.hasError('required')">
                Branch selection is required.
              </mat-error>
            </mat-form-field>

            <!-- Room Number -->
            <mat-form-field appearance="outline" [class.half-width]="!data.isEditing" [class.full-width]="data.isEditing">
              <mat-label>Room Number / Name *</mat-label>
              <input matInput formControlName="roomNumber" placeholder="e.g. Room 101, Science Lab A" />
              <mat-icon matSuffix color="primary">meeting_room</mat-icon>
              <mat-error *ngIf="roomForm.get('roomNumber')?.hasError('required')">
                Room Number is required.
              </mat-error>
            </mat-form-field>

            <!-- Seating Capacity -->
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Seating Capacity (Desk Seats) *</mat-label>
              <input matInput type="number" formControlName="capacity" min="1" placeholder="e.g. 40" />
              <mat-icon matSuffix color="primary">groups</mat-icon>
              <mat-error *ngIf="roomForm.get('capacity')?.hasError('min')">
                Must be at least 1.
              </mat-error>
            </mat-form-field>

            <!-- Floor / Block Details -->
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Floor / Wing / Block Details</mat-label>
              <input matInput formControlName="floor" placeholder="e.g. Ground Floor, Science Wing" />
              <mat-icon matSuffix color="primary">layers</mat-icon>
            </mat-form-field>
          </div>

          <!-- Live Preview Card -->
          <div class="preview-box">
            <div class="preview-header">
              <mat-icon class="preview-header-icon">preview</mat-icon>
              <span>Classroom Summary Preview</span>
            </div>
            <div class="preview-body">
              <div class="preview-item">
                <span class="preview-label">Room Designation:</span>
                <strong class="preview-val highlight">{{ roomForm.get('roomNumber')?.value || '—' }}</strong>
              </div>
              <div class="preview-item">
                <span class="preview-label">Campus Branch:</span>
                <span class="preview-val">{{ getSelectedBranchName() }}</span>
              </div>
              <div class="preview-item">
                <span class="preview-label">Seating Capacity:</span>
                <strong class="preview-val amount">{{ roomForm.get('capacity')?.value || 0 }} Student Seats</strong>
              </div>
              <div class="preview-item">
                <span class="preview-label">Floor Location:</span>
                <span class="preview-val">{{ roomForm.get('floor')?.value || 'Ground Floor' }}</span>
              </div>
            </div>
          </div>

        </mat-dialog-content>

        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onCancel()" [disabled]="saving">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="roomForm.invalid || saving" class="submit-btn">
            <mat-progress-spinner *ngIf="saving" mode="indeterminate" diameter="18" class="btn-spinner"></mat-progress-spinner>
            <mat-icon *ngIf="!saving">{{ data.isEditing ? 'save' : 'add_task' }}</mat-icon>
            <span>{{ saving ? 'Saving...' : (data.isEditing ? 'Update Classroom' : 'Create Classroom') }}</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      padding: 0;
      box-sizing: border-box;
      min-width: 500px;
      max-width: 600px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px 24px 16px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;

      .header-icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }

      .header-titles {
        flex: 1 1 auto;
        .main-title {
          margin: 0;
          font-size: 1.18rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.3;
        }
        .subtitle {
          margin: 3px 0 0;
          font-size: 0.79rem;
          color: #3b82f6;
        }
      }

      .close-btn { color: #64748b; }
    }

    .dialog-content {
      padding: 18px 24px 10px !important;
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .info-callout {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 13px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;

      .info-icon { color: #16a34a; font-size: 18px; width: 18px; height: 18px; margin-top: 1px; flex-shrink: 0; }
      .info-text { font-size: 0.79rem; color: #166534; line-height: 1.45; strong { font-weight: 700; } }
    }

    .section-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      margin-bottom: -4px;

      .section-icon { font-size: 15px; width: 15px; height: 15px; color: #94a3b8; }
    }

    .form-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .full-width {
      width: 100%;
      flex: 1 1 100%;
    }
    .half-width {
      flex: 1 1 calc(50% - 6px);
      min-width: 200px;
    }

    .preview-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;

      .preview-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: #f1f5f9;
        border-bottom: 1px solid #e2e8f0;
        font-size: 0.73rem;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        .preview-header-icon { font-size: 14px; width: 14px; height: 14px; color: #94a3b8; }
      }

      .preview-body {
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .preview-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.82rem;
        .preview-label { color: #64748b; }
        .preview-val {
          color: #0f172a;
          font-weight: 600;
          &.highlight { color: #2563eb; }
          &.amount { color: #059669; font-size: 0.92rem; }
        }
      }
    }

    .dialog-actions {
      padding: 13px 24px 20px;
      border-top: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      gap: 10px;

      .submit-btn {
        height: 42px;
        font-weight: 600;
        padding: 0 20px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .btn-spinner { margin-right: 4px; display: inline-block; }
    }

    @media (max-width: 560px) {
      .dialog-wrapper { min-width: 100% !important; }
      .form-grid {
        flex-direction: column;
        .half-width, .full-width { width: 100% !important; flex: 1 1 100% !important; }
      }
    }
  `]
})
export class RoomDialogComponent implements OnInit {
  roomForm!: FormGroup;
  saving = false;

  constructor(
    private dialogRef: MatDialogRef<RoomDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RoomDialogData,
    private fb: FormBuilder,
    private roomService: RoomService,
    private authService: AuthService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    const activeBranchId = this.authService.selectedBranchId() || this.authService.currentUser()?.branchId;
    const matchingBranch = activeBranchId
      ? this.data.branches.find(b => b.id?.toLowerCase() === activeBranchId.toLowerCase())
      : null;
    const defaultBranchId = matchingBranch?.id ||
      this.data.branches.find(b => b.isMainBranch)?.id ||
      (this.data.branches.length > 0 ? this.data.branches[0].id : '');

    this.roomForm = this.fb.group({
      branchId: [this.data.room?.branchId || defaultBranchId, Validators.required],
      roomNumber: [this.data.room?.roomNumber || '', Validators.required],
      capacity: [this.data.room?.capacity || 40, [Validators.required, Validators.min(1)]],
      floor: [this.data.room?.floor || 'Ground Floor']
    });
  }

  getSelectedBranchName(): string {
    const bId = this.roomForm?.get('branchId')?.value;
    if (!bId) return 'All Branches / Main Campus';
    const found = this.data.branches?.find(b => b.id === bId);
    return found ? `${found.name} (${found.code})` : 'Main Campus';
  }

  onSubmit(): void {
    if (this.roomForm.invalid) return;

    this.saving = true;
    const formVal = this.roomForm.value;

    if (this.data.isEditing && this.data.room) {
      const updateDto: UpdateRoomDto = {
        roomNumber: formVal.roomNumber.trim(),
        capacity: Number(formVal.capacity),
        floor: formVal.floor?.trim() || null,
        isActive: this.data.room.isActive
      };

      this.roomService.updateRoom(this.data.room.id, updateDto).subscribe({
        next: (res) => {
          this.saving = false;
          this.dialogRef.close(res || true);
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert(
            'Update Failed',
            err?.error?.message || 'Failed to update classroom details.',
            'danger'
          );
        }
      });
    } else {
      const createDto: CreateRoomDto = {
        branchId: formVal.branchId,
        roomNumber: formVal.roomNumber.trim(),
        capacity: Number(formVal.capacity),
        floor: formVal.floor?.trim() || null
      };

      this.roomService.createRoom(createDto).subscribe({
        next: (res) => {
          this.saving = false;
          this.dialogRef.close(res || true);
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert(
            'Create Failed',
            err?.error?.message || 'Failed to create classroom.',
            'danger'
          );
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
