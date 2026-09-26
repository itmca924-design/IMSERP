import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EventsService, SchoolEvent, EventPhoto } from '../../core/services/events.service';

export interface EventGalleryDialogData {
  event: SchoolEvent;
}

@Component({
  selector: 'app-event-gallery-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dialog-wrapper">
      <!-- Strict Light Blue Header matching AGENTS.md rule -->
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>photo_library</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">
            {{ event.title }} — Photo Memories
          </h2>
          <p class="subtitle">
            Capture, celebrate & preserve unforgettable event moments ({{ photos.length }} Photos)
          </p>
        </div>
        <button mat-icon-button class="close-btn" (click)="onClose()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content class="dialog-content">
        <!-- Upload Zone -->
        <div class="upload-section">
          <div class="upload-dropzone" (click)="multiFileInput.click()">
            <mat-icon class="dropzone-icon">add_photo_alternate</mat-icon>
            <div class="dropzone-text">
              <span class="primary-text">Upload Event Memories & Photos</span>
              <span class="secondary-text">Select multiple JPG, PNG, or WebP images to upload</span>
            </div>
            <input #multiFileInput type="file" multiple accept="image/*" (change)="onFilesSelected($event)" style="display:none;" />
          </div>

          <!-- Pending Uploads Preview -->
          <div class="pending-section" *ngIf="pendingBase64Photos.length > 0">
            <div class="pending-header">
              <span>Ready to upload ({{ pendingBase64Photos.length }} selected):</span>
              <button mat-raised-button color="primary" (click)="uploadPendingPhotos()" [disabled]="uploading" class="upload-btn">
                <mat-spinner diameter="16" *ngIf="uploading"></mat-spinner>
                <mat-icon *ngIf="!uploading">cloud_upload</mat-icon>
                <span>{{ uploading ? 'Uploading...' : 'Confirm & Upload' }}</span>
              </button>
            </div>

            <div class="pending-grid">
              <div class="pending-thumb" *ngFor="let p of pendingBase64Photos; let i = index">
                <img [src]="p" alt="Pending upload" />
                <button type="button" class="remove-thumb-btn" (click)="removePending(i)">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Existing Photos Grid -->
        <div class="gallery-wrapper">
          <div class="gallery-empty" *ngIf="!loading && photos.length === 0 && pendingBase64Photos.length === 0">
            <mat-icon class="empty-icon">photo_camera_back</mat-icon>
            <p class="empty-title">No event photos uploaded yet</p>
            <p class="empty-sub">Add memorable photographs from this celebration using the upload section above.</p>
          </div>

          <div class="spinner-box" *ngIf="loading">
            <mat-spinner diameter="32"></mat-spinner>
            <span>Loading photo memories...</span>
          </div>

          <div class="photos-grid" *ngIf="photos.length > 0">
            <div class="photo-card" *ngFor="let photo of photos">
              <div class="image-box" (click)="viewFull(photo.photoUrl)">
                <img [src]="photo.photoUrl" [alt]="photo.caption || 'Event memory'" />
                <div class="hover-overlay">
                  <mat-icon>zoom_in</mat-icon>
                  <span>View Full</span>
                </div>
              </div>
              <div class="photo-footer">
                <span class="photo-caption">{{ photo.caption || 'Event Memory' }}</span>
                <button type="button" class="delete-btn" (click)="deletePhoto(photo.id)" [disabled]="deletingId === photo.id" title="Delete Photo">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Fullscreen Preview Overlay -->
        <div class="fullscreen-overlay" *ngIf="fullPreviewUrl" (click)="fullPreviewUrl = null">
          <div class="fullscreen-content" (click)="$event.stopPropagation()">
            <img [src]="fullPreviewUrl" alt="Full Preview" />
            <button class="close-full-btn" (click)="fullPreviewUrl = null">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button type="button" (click)="onClose()">Close Gallery</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      padding: 0;
      box-sizing: border-box;
      min-width: 650px;
      max-width: 820px;
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
      padding: 18px 24px;
      max-height: 75vh;
      overflow-y: auto;
    }

    .upload-section {
      margin-bottom: 18px;
    }

    .upload-dropzone {
      border: 2px dashed #93c5fd;
      background: #f0f7ff;
      border-radius: 10px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: #e0f2fe;
        border-color: #3b82f6;
      }

      .dropzone-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: #2563eb;
      }

      .dropzone-text {
        .primary-text {
          display: block;
          font-size: 0.9rem;
          font-weight: 700;
          color: #1e3a8a;
        }
        .secondary-text {
          display: block;
          font-size: 0.75rem;
          color: #64748b;
          margin-top: 2px;
        }
      }
    }

    .pending-section {
      margin-top: 12px;
      background: #fafafa;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;

      .pending-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        font-size: 0.8rem;
        font-weight: 600;
        color: #334155;

        .upload-btn {
          font-size: 0.76rem;
          height: 32px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
      }

      .pending-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .pending-thumb {
          position: relative;
          width: 72px;
          height: 72px;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid #cbd5e1;

          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .remove-thumb-btn {
            position: absolute;
            top: 2px;
            right: 2px;
            background: rgba(0,0,0,0.65);
            color: #ffffff;
            border: none;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;

            mat-icon { font-size: 12px; width: 12px; height: 12px; }
            &:hover { background: #dc2626; }
          }
        }
      }
    }

    .gallery-wrapper {
      margin-top: 10px;
    }

    .spinner-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 30px;
      color: #64748b;
      font-size: 0.85rem;
    }

    .gallery-empty {
      text-align: center;
      padding: 36px 16px;
      background: #f8fafc;
      border-radius: 10px;
      border: 1px dashed #cbd5e1;

      .empty-icon {
        font-size: 44px;
        width: 44px;
        height: 44px;
        color: #94a3b8;
        margin-bottom: 6px;
      }

      .empty-title {
        font-size: 0.95rem;
        font-weight: 700;
        color: #334155;
        margin: 0 0 4px;
      }

      .empty-sub {
        font-size: 0.8rem;
        color: #64748b;
        margin: 0;
      }
    }

    .photos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 14px;

      .photo-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        transition: transform 0.15s ease, box-shadow 0.15s ease;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .image-box {
          position: relative;
          width: 100%;
          height: 120px;
          cursor: pointer;
          background: #f1f5f9;

          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }

          .hover-overlay {
            position: absolute;
            inset: 0;
            background: rgba(15, 23, 42, 0.45);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            opacity: 0;
            transition: opacity 0.2s ease;
            gap: 4px;

            mat-icon { font-size: 24px; width: 24px; height: 24px; }
            span { font-size: 0.72rem; font-weight: 600; }
          }

          &:hover .hover-overlay {
            opacity: 1;
          }
        }

        .photo-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 8px;
          background: #fafafa;
          border-top: 1px solid #f1f5f9;

          .photo-caption {
            font-size: 0.72rem;
            color: #475569;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .delete-btn {
            background: none;
            border: none;
            color: #94a3b8;
            cursor: pointer;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;

            mat-icon { font-size: 16px; width: 16px; height: 16px; }
            &:hover { color: #dc2626; }
          }
        }
      }
    }

    .fullscreen-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;

      .fullscreen-content {
        position: relative;
        max-width: 90vw;
        max-height: 90vh;

        img {
          max-width: 100%;
          max-height: 85vh;
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }

        .close-full-btn {
          position: absolute;
          top: -16px;
          right: -16px;
          background: #ffffff;
          color: #0f172a;
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);

          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }
      }
    }

    .dialog-actions {
      padding: 12px 24px 16px;
      border-top: 1px solid #e2e8f0;
    }
  `]
})
export class EventGalleryDialogComponent implements OnInit {
  event: SchoolEvent;
  photos: EventPhoto[] = [];
  loading = false;
  uploading = false;
  deletingId: string | null = null;
  pendingBase64Photos: string[] = [];
  fullPreviewUrl: string | null = null;

  constructor(
    private dialogRef: MatDialogRef<EventGalleryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EventGalleryDialogData,
    private eventsService: EventsService
  ) {
    this.event = data.event;
    this.photos = data.event.photos || [];
  }

  ngOnInit(): void {
    this.loadEventDetails();
  }

  loadEventDetails(): void {
    if (!this.event?.id) return;
    this.loading = true;
    this.eventsService.getEventById(this.event.id).subscribe({
      next: (ev) => {
        this.loading = false;
        this.event = ev;
        this.photos = ev.photos || [];
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onFilesSelected(event: any): void {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        this.pendingBase64Photos.push(result);
      };
      reader.readAsDataURL(file);
    }
    // reset input so the same files can be chosen again if needed
    event.target.value = '';
  }

  removePending(index: number): void {
    this.pendingBase64Photos.splice(index, 1);
  }

  uploadPendingPhotos(): void {
    if (this.pendingBase64Photos.length === 0 || this.uploading) return;

    this.uploading = true;
    this.eventsService.addEventPhotos(this.event.id, {
      photosBase64: this.pendingBase64Photos,
      caption: this.event.title
    }).subscribe({
      next: (newPhotos) => {
        this.uploading = false;
        this.photos = [...this.photos, ...newPhotos];
        this.event.photosCount = this.photos.length;
        this.pendingBase64Photos = [];
      },
      error: (err) => {
        this.uploading = false;
        alert('Failed to upload photos: ' + (err.error?.message || err.message));
      }
    });
  }

  deletePhoto(photoId: string): void {
    if (!confirm('Are you sure you want to remove this photo memory?')) return;

    this.deletingId = photoId;
    this.eventsService.deleteEventPhoto(photoId).subscribe({
      next: () => {
        this.deletingId = null;
        this.photos = this.photos.filter(p => p.id !== photoId);
        this.event.photosCount = this.photos.length;
      },
      error: (err) => {
        this.deletingId = null;
        alert('Failed to delete photo: ' + (err.error?.message || err.message));
      }
    });
  }

  viewFull(url: string): void {
    this.fullPreviewUrl = url;
  }

  onClose(): void {
    this.dialogRef.close({ photosCount: this.photos.length });
  }
}
