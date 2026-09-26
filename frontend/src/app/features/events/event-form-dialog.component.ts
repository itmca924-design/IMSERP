import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EventsService, SchoolEvent, CreateSchoolEventPayload, UpdateSchoolEventPayload } from '../../core/services/events.service';
import { BranchService, BranchDto } from '../../core/services/branch.service';

export interface EventFormDialogData {
  event?: SchoolEvent | null;
}

@Component({
  selector: 'app-event-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dialog-wrapper">
      <!-- Strict Light Blue Header matching AGENTS.md rule -->
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>{{ isEdit ? 'edit_calendar' : 'celebration' }}</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">
            {{ isEdit ? 'Edit Event & Celebration' : 'Schedule New Event / Celebration' }}
          </h2>
          <p class="subtitle">
            Capture school functions, festivals, sports meet, national celebrations & guidelines
          </p>
        </div>
        <button mat-icon-button class="close-btn" (click)="onCancel()" [disabled]="saving">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-content">
          <!-- Quick Preset Pill Badges for Fast Creation -->
          <div class="preset-row" *ngIf="!isEdit">
            <span class="preset-label">Quick Presets:</span>
            <div class="preset-chips">
              <button type="button" class="preset-chip national" (click)="applyPreset('15th August - Independence Day', 'National', 'Flag hoisting, march-past & cultural patriotic events in school ground.', 'School Ground')">🇮🇳 15 Aug</button>
              <button type="button" class="preset-chip national" (click)="applyPreset('26th January - Republic Day', 'National', 'Patriotic assembly, unfurling of Tricolour, speech & sweet distribution.', 'School Assembly Area')">🇮🇳 26 Jan</button>
              <button type="button" class="preset-chip cultural" (click)="applyPreset('Farewell Ceremony 2026', 'Cultural', 'Grand farewell celebration, memento distribution & blessings for graduating seniors.', 'School Auditorium')">🎓 Farewell Party</button>
              <button type="button" class="preset-chip sports" (click)="applyPreset('Annual Sports Meet', 'Sports', 'Track & field athletics, march-past, inter-house trophy tournaments.', 'Sports Arena')">🏆 Sports Day</button>
              <button type="button" class="preset-chip academic" (click)="applyPreset('Parent-Teacher Meeting (PTM)', 'PTM', 'Comprehensive review of student academic progress, attendance & term feedback.', 'Respective Classrooms')">🤝 PTM</button>
              <button type="button" class="preset-chip celebration" (click)="applyPreset('Teachers Day Celebration', 'Celebration', 'Special tribute performance by students honoring our esteemed educators.', 'School Auditorium')">💐 Teachers Day</button>
            </div>
          </div>

          <div class="form-grid">
            <!-- Event Title -->
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Event / Function Title *</mat-label>
              <input matInput formControlName="title" placeholder="e.g. Annual Cultural Fest & Exhibition 2026" />
              <mat-icon matSuffix color="primary">title</mat-icon>
              <mat-error *ngIf="form.get('title')?.hasError('required')">Event title is required</mat-error>
            </mat-form-field>

            <!-- Category -->
            <mat-form-field appearance="outline">
              <mat-label>Category *</mat-label>
              <mat-select formControlName="category">
                <mat-option value="National">🇮🇳 National Festival (15 Aug, 26 Jan)</mat-option>
                <mat-option value="Cultural">🎭 Cultural & Annual Day / Farewell</mat-option>
                <mat-option value="Sports">🏆 Sports & Athletics Meet</mat-option>
                <mat-option value="PTM">🤝 Parent-Teacher Meeting (PTM)</mat-option>
                <mat-option value="Academic">📚 Academic Exhibition / Science Fair</mat-option>
                <mat-option value="Celebration">🎉 School Celebration & Festivities</mat-option>
                <mat-option value="Other">📌 Other Special Event</mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">category</mat-icon>
            </mat-form-field>

            <!-- Target Audience -->
            <mat-form-field appearance="outline">
              <mat-label>Target Audience *</mat-label>
              <mat-select formControlName="targetAudience">
                <mat-option value="All School">Entire School (Students, Staff & Parents)</mat-option>
                <mat-option value="All Students">All Students & Faculty</mat-option>
                <mat-option value="Primary Wing">Primary Wing (Classes Nursery - 5)</mat-option>
                <mat-option value="Middle & Senior">Middle & Senior (Classes 6 - 12)</mat-option>
                <mat-option value="Staff Only">Staff & Teachers Only</mat-option>
                <mat-option value="Parents & Students">Parents & Students</mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">groups</mat-icon>
            </mat-form-field>

            <!-- Start Date -->
            <mat-form-field appearance="outline">
              <mat-label>Start Date *</mat-label>
              <input matInput type="date" formControlName="startDate" />
              <mat-icon matSuffix color="primary">calendar_today</mat-icon>
              <mat-error *ngIf="form.get('startDate')?.hasError('required')">Start date is required</mat-error>
            </mat-form-field>

            <!-- End Date -->
            <mat-form-field appearance="outline">
              <mat-label>End Date (Optional for multi-day)</mat-label>
              <input matInput type="date" formControlName="endDate" />
              <mat-icon matSuffix color="primary">event_repeat</mat-icon>
            </mat-form-field>

            <!-- Start Time -->
            <mat-form-field appearance="outline">
              <mat-label>Start Time (e.g. 09:00 AM)</mat-label>
              <input matInput formControlName="startTime" placeholder="09:00 AM" />
              <mat-icon matSuffix color="primary">schedule</mat-icon>
            </mat-form-field>

            <!-- End Time -->
            <mat-form-field appearance="outline">
              <mat-label>End Time (e.g. 01:30 PM)</mat-label>
              <input matInput formControlName="endTime" placeholder="01:30 PM" />
              <mat-icon matSuffix color="primary">update</mat-icon>
            </mat-form-field>

            <!-- Venue -->
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Venue / Location</mat-label>
              <input matInput formControlName="venue" placeholder="e.g. Main Auditorium / Central Sports Arena / Classroom 10-A" />
              <mat-icon matSuffix color="primary">place</mat-icon>
            </mat-form-field>

            <!-- Chief Guest -->
            <mat-form-field appearance="outline">
              <mat-label>Chief Guest / Special Invitee</mat-label>
              <input matInput formControlName="chiefGuestName" placeholder="e.g. Hon'ble District Collector / Renowned Scientist" />
              <mat-icon matSuffix color="primary">star</mat-icon>
            </mat-form-field>

            <!-- Coordinator Name -->
            <mat-form-field appearance="outline">
              <mat-label>Faculty Coordinator / In-Charge</mat-label>
              <input matInput formControlName="coordinatorName" placeholder="e.g. Mrs. Sunita Roy (CCA In-Charge)" />
              <mat-icon matSuffix color="primary">badge</mat-icon>
            </mat-form-field>

            <!-- Branch Dropdown (if multiple branches) -->
            <mat-form-field appearance="outline" *ngIf="branches.length > 1" class="col-span-2">
              <mat-label>Applicable Branch</mat-label>
              <mat-select formControlName="branchId">
                <mat-option [value]="null">🏢 All Branches (Central Event)</mat-option>
                <mat-option *ngFor="let b of branches" [value]="b.id">{{ b.name }}</mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">apartment</mat-icon>
            </mat-form-field>

            <!-- Status (if edit) -->
            <mat-form-field appearance="outline" *ngIf="isEdit" class="col-span-2">
              <mat-label>Event Status</mat-label>
              <mat-select formControlName="status">
                <mat-option value="Scheduled">Scheduled (Upcoming)</mat-option>
                <mat-option value="Ongoing">Ongoing (In Progress)</mat-option>
                <mat-option value="Completed">Completed (Concluded)</mat-option>
                <mat-option value="Cancelled">Cancelled</mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">rule</mat-icon>
            </mat-form-field>

            <!-- Description -->
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Event Overview & Schedule Instructions</mat-label>
              <textarea matInput rows="3" formControlName="description" placeholder="Dress code, flow of events, guidelines for students and parents..."></textarea>
              <mat-icon matSuffix color="primary">notes</mat-icon>
            </mat-form-field>
          </div>

          <!-- Attachments Section (Banner Poster & Circular PDF) -->
          <div class="attachments-box">
            <div class="box-title">
              <mat-icon>attachment</mat-icon>
              <span>Event Posters & Circular PDF Guidelines</span>
            </div>

            <div class="attachments-grid">
              <!-- Banner Image Upload -->
              <div class="upload-card">
                <div class="upload-card-head">
                  <mat-icon class="card-icon">image</mat-icon>
                  <div>
                    <span class="card-label">Event Poster / Banner Image</span>
                    <span class="card-sub">Will be featured on Dashboard & Event Card</span>
                  </div>
                </div>

                <div class="preview-area" *ngIf="bannerPreviewUrl">
                  <img [src]="bannerPreviewUrl" alt="Banner Preview" class="banner-img" />
                  <button type="button" class="remove-btn" (click)="removeBanner()">
                    <mat-icon>close</mat-icon> Remove
                  </button>
                </div>

                <div class="drop-zone" *ngIf="!bannerPreviewUrl" (click)="bannerFileInput.click()">
                  <mat-icon class="drop-icon">cloud_upload</mat-icon>
                  <span>Click to upload Banner (JPG, PNG, WebP)</span>
                  <input #bannerFileInput type="file" accept="image/*" (change)="onBannerFileSelected($event)" style="display:none;" />
                </div>
              </div>

              <!-- Circular PDF Upload -->
              <div class="upload-card">
                <div class="upload-card-head">
                  <mat-icon class="card-icon pdf-icon">description</mat-icon>
                  <div>
                    <span class="card-label">Official Circular / Notice PDF</span>
                    <span class="card-sub">Rules, routine & parent consent form</span>
                  </div>
                </div>

                <div class="preview-area pdf-preview" *ngIf="circularFileName">
                  <div class="pdf-info">
                    <mat-icon class="pdf-file-icon">picture_as_pdf</mat-icon>
                    <span class="pdf-name" [title]="circularFileName">{{ circularFileName }}</span>
                  </div>
                  <button type="button" class="remove-btn" (click)="removeCircular()">
                    <mat-icon>close</mat-icon> Remove
                  </button>
                </div>

                <div class="drop-zone" *ngIf="!circularFileName" (click)="circularFileInput.click()">
                  <mat-icon class="drop-icon pdf-drop">picture_as_pdf</mat-icon>
                  <span>Click to attach PDF Circular / Document</span>
                  <input #circularFileInput type="file" accept=".pdf,.doc,.docx" (change)="onCircularFileSelected($event)" style="display:none;" />
                </div>
              </div>
            </div>
          </div>

          <!-- Send WhatsApp Broadcast (Create Only) -->
          <div class="broadcast-banner" *ngIf="!isEdit">
            <mat-checkbox formControlName="sendWhatsAppBroadcast" color="primary">
              <span class="broadcast-label">
                <strong>Queue WhatsApp Announcement</strong> to students & parents with event timing & venue
              </span>
            </mat-checkbox>
          </div>

        </mat-dialog-content>

        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onCancel()" [disabled]="saving">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving" class="submit-btn">
            <mat-spinner diameter="18" *ngIf="saving" class="btn-spinner"></mat-spinner>
            <mat-icon *ngIf="!saving">{{ isEdit ? 'save' : 'celebration' }}</mat-icon>
            <span>{{ saving ? 'Saving...' : (isEdit ? 'Update Event' : 'Publish & Schedule Event') }}</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      padding: 0;
      box-sizing: border-box;
      min-width: 580px;
      max-width: 680px;
    }

    /* Strict UI Rule from AGENTS.md */
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
      padding: 16px 24px;
      max-height: 76vh;
      overflow-y: auto;
    }

    .preset-row {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
      background: #f8fafc;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px dashed #cbd5e1;

      .preset-label {
        font-size: 0.74rem;
        font-weight: 600;
        text-transform: uppercase;
        color: #64748b;
        letter-spacing: 0.5px;
      }

      .preset-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;

        .preset-chip {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          padding: 4px 10px;
          border-radius: 16px;
          font-size: 0.76rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 4px;

          &:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.06);
          }

          &.national { border-color: #fed7aa; color: #c2410c; background: #fff7ed; }
          &.cultural { border-color: #fbcfe8; color: #be185d; background: #fdf2f8; }
          &.sports { border-color: #bbf7d0; color: #15803d; background: #f0fdf4; }
          &.academic { border-color: #bfdbfe; color: #1d4ed8; background: #eff6ff; }
          &.celebration { border-color: #ddd6fe; color: #6d28d9; background: #f5f3ff; }
        }
      }
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 4px;

      .col-span-2 {
        grid-column: span 2;
      }

      mat-form-field {
        width: 100%;
      }
    }

    .attachments-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px;
      margin-top: 14px;

      .box-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 12px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
      }

      .attachments-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;

        .upload-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 12px;

          .upload-card-head {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            margin-bottom: 8px;

            .card-icon {
              font-size: 20px;
              width: 20px;
              height: 20px;
              color: #3b82f6;
              &.pdf-icon { color: #dc2626; }
            }

            .card-label {
              display: block;
              font-size: 0.78rem;
              font-weight: 700;
              color: #1e293b;
            }

            .card-sub {
              display: block;
              font-size: 0.68rem;
              color: #64748b;
            }
          }

          .drop-zone {
            border: 2px dashed #cbd5e1;
            border-radius: 6px;
            padding: 14px 10px;
            text-align: center;
            cursor: pointer;
            background: #fafafa;
            transition: all 0.2s ease;

            &:hover {
              border-color: #3b82f6;
              background: #f0f7ff;
            }

            .drop-icon {
              font-size: 28px;
              width: 28px;
              height: 28px;
              color: #3b82f6;
              margin-bottom: 4px;
              &.pdf-drop { color: #dc2626; }
            }

            span {
              display: block;
              font-size: 0.72rem;
              color: #475569;
              font-weight: 500;
            }
          }

          .preview-area {
            position: relative;
            border-radius: 6px;
            overflow: hidden;
            border: 1px solid #e2e8f0;

            .banner-img {
              width: 100%;
              height: 80px;
              object-fit: cover;
              display: block;
            }

            &.pdf-preview {
              padding: 10px;
              background: #fef2f2;
              border-color: #fecaca;

              .pdf-info {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 6px;

                .pdf-file-icon { color: #dc2626; font-size: 20px; width: 20px; height: 20px; }
                .pdf-name {
                  font-size: 0.74rem;
                  font-weight: 600;
                  color: #991b1b;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  max-width: 170px;
                }
              }
            }

            .remove-btn {
              border: none;
              background: rgba(0,0,0,0.65);
              color: #ffffff;
              font-size: 0.68rem;
              padding: 3px 8px;
              border-radius: 4px;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 3px;
              margin-top: 4px;

              mat-icon { font-size: 13px; width: 13px; height: 13px; }
              &:hover { background: #dc2626; }
            }
          }
        }
      }
    }

    .broadcast-banner {
      margin-top: 14px;
      padding: 10px 14px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;

      .broadcast-label {
        font-size: 0.79rem;
        color: #166534;
      }
    }

    .dialog-actions {
      padding: 12px 24px 16px;
      border-top: 1px solid #e2e8f0;
      gap: 10px;

      .submit-btn {
        background: #2563eb;
        color: #ffffff;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    }
  `]
})
export class EventFormDialogComponent implements OnInit {
  form: FormGroup;
  isEdit = false;
  saving = false;
  branches: BranchDto[] = [];

  bannerBase64: string | null = null;
  bannerPreviewUrl: string | null = null;
  circularBase64: string | null = null;
  circularFileName: string | null = null;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<EventFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EventFormDialogData,
    private eventsService: EventsService,
    private branchService: BranchService
  ) {
    this.isEdit = !!data?.event?.id;

    const todayStr = new Date().toISOString().substring(0, 10);

    this.form = this.fb.group({
      title: [data?.event?.title || '', [Validators.required, Validators.maxLength(250)]],
      category: [data?.event?.category || 'Cultural', Validators.required],
      startDate: [data?.event?.startDate ? data.event.startDate.substring(0, 10) : todayStr, Validators.required],
      endDate: [data?.event?.endDate ? data.event.endDate.substring(0, 10) : null],
      startTime: [data?.event?.startTime || '09:00 AM'],
      endTime: [data?.event?.endTime || '01:00 PM'],
      venue: [data?.event?.venue || 'School Campus'],
      targetAudience: [data?.event?.targetAudience || 'All School', Validators.required],
      chiefGuestName: [data?.event?.chiefGuestName || ''],
      coordinatorName: [data?.event?.coordinatorName || ''],
      branchId: [data?.event?.branchId || null],
      status: [data?.event?.status || 'Scheduled'],
      description: [data?.event?.description || ''],
      sendWhatsAppBroadcast: [true]
    });

    if (data?.event?.bannerUrl) {
      this.bannerPreviewUrl = data.event.bannerUrl;
    }
    if (data?.event?.attachmentPdfUrl) {
      this.circularFileName = 'Current Attached Circular PDF';
    }
  }

  ngOnInit(): void {
    this.branchService.getAllBranches().subscribe({
      next: (b: BranchDto[]) => (this.branches = b || []),
      error: () => {}
    });
  }

  applyPreset(title: string, category: string, description: string, venue: string): void {
    this.form.patchValue({
      title,
      category,
      description,
      venue
    });
  }

  onBannerFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      this.bannerBase64 = result;
      this.bannerPreviewUrl = result;
    };
    reader.readAsDataURL(file);
  }

  removeBanner(): void {
    this.bannerBase64 = null;
    this.bannerPreviewUrl = null;
  }

  onCircularFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;

    this.circularFileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      this.circularBase64 = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeCircular(): void {
    this.circularBase64 = null;
    this.circularFileName = null;
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving) return;

    this.saving = true;
    const formVals = this.form.value;

    if (this.isEdit && this.data.event?.id) {
      const payload: UpdateSchoolEventPayload = {
        title: formVals.title,
        category: formVals.category,
        startDate: formVals.startDate,
        endDate: formVals.endDate || null,
        startTime: formVals.startTime || null,
        endTime: formVals.endTime || null,
        venue: formVals.venue || null,
        description: formVals.description || null,
        targetAudience: formVals.targetAudience,
        bannerBase64: this.bannerBase64,
        attachmentPdfBase64: this.circularBase64,
        chiefGuestName: formVals.chiefGuestName || null,
        coordinatorName: formVals.coordinatorName || null,
        status: formVals.status || 'Scheduled',
        isActive: true,
        branchId: formVals.branchId || null
      };

      this.eventsService.updateEvent(this.data.event.id, payload).subscribe({
        next: (res) => {
          this.saving = false;
          this.dialogRef.close(res);
        },
        error: (err) => {
          this.saving = false;
          alert('Failed to update event: ' + (err.error?.message || err.message));
        }
      });
    } else {
      const payload: CreateSchoolEventPayload = {
        title: formVals.title,
        category: formVals.category,
        startDate: formVals.startDate,
        endDate: formVals.endDate || null,
        startTime: formVals.startTime || null,
        endTime: formVals.endTime || null,
        venue: formVals.venue || null,
        description: formVals.description || null,
        targetAudience: formVals.targetAudience,
        bannerBase64: this.bannerBase64,
        attachmentPdfBase64: this.circularBase64,
        chiefGuestName: formVals.chiefGuestName || null,
        coordinatorName: formVals.coordinatorName || null,
        branchId: formVals.branchId || null,
        sendWhatsAppBroadcast: formVals.sendWhatsAppBroadcast
      };

      this.eventsService.createEvent(payload).subscribe({
        next: (res) => {
          this.saving = false;
          this.dialogRef.close(res);
        },
        error: (err) => {
          this.saving = false;
          alert('Failed to create event: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
