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
    <h2 mat-dialog-title class="dialog-header">
      <mat-icon color="primary">{{ data.isEditing ? 'edit' : 'meeting_room' }}</mat-icon>
      <span>{{ data.isEditing ? 'Edit Classroom' : 'Create New Classroom' }}</span>
    </h2>

    <form [formGroup]="roomForm" (ngSubmit)="onSubmit()">
      <mat-dialog-content class="dialog-content">
        <div class="form-grid">
          <!-- Branch Selector (only on create) -->
          <mat-form-field appearance="outline" class="full-width" *ngIf="!data.isEditing">
            <mat-label>Branch Scope</mat-label>
            <mat-select formControlName="branchId" placeholder="Select Branch">
              <mat-option *ngFor="let b of data.branches" [value]="b.id">
                {{ b.name }} {{ b.isMainBranch ? '(Main Branch)' : '' }}
              </mat-option>
            </mat-select>
            <mat-error *ngIf="roomForm.get('branchId')?.hasError('required')">
              Branch selection is required.
            </mat-error>
          </mat-form-field>

          <!-- Room Number -->
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Room Number / Name</mat-label>
            <input matInput formControlName="roomNumber" placeholder="e.g. Room 101, Lab A" />
            <mat-error *ngIf="roomForm.get('roomNumber')?.hasError('required')">
              Room Number is required.
            </mat-error>
          </mat-form-field>

          <!-- Seating Capacity -->
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Seating Capacity</mat-label>
            <input matInput type="number" formControlName="capacity" min="1" placeholder="e.g. 40" />
            <mat-error *ngIf="roomForm.get('capacity')?.hasError('min')">
              Must be at least 1.
            </mat-error>
          </mat-form-field>

          <!-- Floor / Block Details -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Floor / Wing / Block Details</mat-label>
            <input matInput formControlName="floor" placeholder="e.g. 1st Floor, Science Wing" />
          </mat-form-field>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-stroked-button type="button" (click)="onCancel()" [disabled]="saving">
          Cancel
        </button>
        <button mat-raised-button color="primary" type="submit" [disabled]="roomForm.invalid || saving">
          <mat-progress-spinner *ngIf="saving" mode="indeterminate" diameter="18" class="spinner"></mat-progress-spinner>
          <span>{{ saving ? 'Saving...' : (data.isEditing ? 'Update Classroom' : 'Create Classroom') }}</span>
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      color: #0f172a;
      padding: 16px 24px 8px;
      margin: 0;
    }
    .dialog-content {
      padding-top: 12px;
      min-width: 440px;
      max-width: 100%;
      box-sizing: border-box;

      @media (max-width: 540px) {
        min-width: 100%;
        padding-left: 12px;
        padding-right: 12px;
      }
    }
    .form-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .full-width {
      width: 100%;
    }
    .half-width {
      flex: 1 1 45%;
      min-width: 180px;

      @media (max-width: 480px) {
        flex: 1 1 100%;
      }
    }
    .dialog-actions {
      padding: 14px 24px 18px;
      gap: 10px;

      button {
        min-width: 100px;
      }
    }
    .spinner {
      display: inline-block;
      margin-right: 8px;
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
