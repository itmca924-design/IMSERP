import { Component, OnInit, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { environment } from '../../../environments/environment';

export interface AiNurturePitchItem {
  type: string;
  title: string;
  description: string;
  message: string;
}

export interface AiNurtureResponse {
  enquiryId: string;
  studentName: string;
  parentName: string;
  phone: string;
  className: string;
  leadScore: number;
  intentCategory: string;
  recommendedAction: string;
  pitches: AiNurturePitchItem[];
}

@Component({
  selector: 'app-ai-admission-nurture-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-container">
      <!-- Light Blue Gradient Header -->
      <div class="dialog-header">
        <div class="header-content">
          <div class="header-icon-box">
            <mat-icon>psychology</mat-icon>
          </div>
          <div>
            <div class="badge-row">
              <span class="ai-pill">AI ADMISSION CONVERSION AGENT</span>
              <span class="score-badge" [ngClass]="getScoreClass()">
                {{ nurtureData?.intentCategory || 'Evaluating...' }} ({{ nurtureData?.leadScore || 0 }}/100)
              </span>
            </div>
            <h2 class="dialog-title">WhatsApp Prospect Nurturing & Pitch Studio</h2>
            <div class="dialog-subtitle">
              Student: <strong>{{ data.enquiry.studentName }}</strong> | Class: <strong>{{ data.enquiry.interestedClassName || 'General' }}</strong>
            </div>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="dialogRef.close()" matTooltip="Close dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-progress-bar *ngIf="loading" mode="indeterminate"></mat-progress-bar>

      <div class="dialog-body" *ngIf="nurtureData">
        <!-- Next Recommended Action Banner -->
        <div class="recommendation-banner">
          <div class="rec-icon"><mat-icon>auto_awesome</mat-icon></div>
          <div class="rec-content">
            <span class="rec-label">COUNSELOR'S NEXT BEST ACTION</span>
            <p class="rec-text">{{ nurtureData.recommendedAction }}</p>
          </div>
        </div>

        <!-- Pitch Selection Deck -->
        <div class="pitch-selector-tabs">
          <button
            type="button"
            *ngFor="let p of nurtureData.pitches; let i = index"
            class="pitch-tab-btn"
            [class.active]="selectedPitchIndex === i"
            (click)="selectPitch(i)"
          >
            <span class="tab-idx">#{{ i + 1 }}</span>
            <span class="tab-name">{{ p.type }}</span>
          </button>
        </div>

        <!-- Active Pitch Editor Card -->
        <div class="pitch-editor-card" *ngIf="currentPitch">
          <div class="pitch-meta">
            <div class="pitch-title-wrap">
              <h3 class="pitch-card-title">{{ currentPitch.title }}</h3>
              <p class="pitch-card-desc">{{ currentPitch.description }}</p>
            </div>
            <span class="phone-pill">
              <mat-icon>phone</mat-icon> {{ nurtureData.phone }}
            </span>
          </div>

          <div class="message-editor-box">
            <textarea
              [(ngModel)]="editableMessage"
              rows="9"
              class="message-textarea"
              placeholder="Tailor your WhatsApp message here..."
            ></textarea>
            <div class="char-count">{{ editableMessage.length }} characters</div>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="dialog-footer">
        <button mat-stroked-button (click)="copyPitchText()" [disabled]="!editableMessage">
          <mat-icon>content_copy</mat-icon> Copy Text
        </button>
        <button mat-button (click)="dialogRef.close()">Cancel</button>
        <button
          mat-flat-button
          class="whatsapp-send-btn"
          (click)="sendViaWhatsApp()"
          [disabled]="loading || !editableMessage"
        >
          <mat-icon>send</mat-icon> Send via WhatsApp & Log
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      overflow: hidden;
    }
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-content {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .header-icon-box {
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      padding: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }
    .header-icon-box mat-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
    }
    .badge-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .ai-pill {
      background: #1e40af;
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 999px;
      letter-spacing: 0.5px;
    }
    .score-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
    }
    .score-badge.hot { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .score-badge.warm { background: #fefce8; color: #ca8a04; border: 1px solid #fef08a; }
    .score-badge.cold { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }

    .dialog-title {
      font-size: 18px;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0 0 2px;
    }
    .dialog-subtitle {
      font-size: 12px;
      color: #3b82f6;
    }
    .dialog-subtitle strong {
      color: #1e40af;
    }
    .close-btn {
      color: #64748b;
    }
    .close-btn:hover {
      color: #1e293b;
    }

    .dialog-body {
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .recommendation-banner {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .rec-icon {
      background: #16a34a;
      color: #ffffff;
      border-radius: 8px;
      padding: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .rec-label {
      font-size: 10px;
      font-weight: 800;
      color: #15803d;
      letter-spacing: 0.5px;
    }
    .rec-text {
      font-size: 13px;
      color: #14532d;
      font-weight: 600;
      margin: 2px 0 0;
    }

    .pitch-selector-tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .pitch-tab-btn {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .pitch-tab-btn:hover {
      background: #f1f5f9;
    }
    .pitch-tab-btn.active {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #1e40af;
      font-weight: 700;
    }
    .tab-idx {
      font-size: 11px;
      font-weight: 800;
      color: #3b82f6;
    }
    .tab-name {
      font-size: 12px;
    }

    .pitch-editor-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      background: #ffffff;
    }
    .pitch-meta {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      gap: 12px;
    }
    .pitch-card-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 2px;
    }
    .pitch-card-desc {
      font-size: 12px;
      color: #64748b;
      margin: 0;
    }
    .phone-pill {
      background: #eff6ff;
      color: #1e40af;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .phone-pill mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .message-editor-box {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .message-textarea {
      width: 100%;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      font-family: inherit;
      font-size: 13px;
      line-height: 1.5;
      color: #1e293b;
      resize: vertical;
      box-sizing: border-box;
      outline: none;
    }
    .message-textarea:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 2px rgba(37,99,235,0.15);
    }
    .char-count {
      text-align: right;
      font-size: 11px;
      color: #94a3b8;
    }

    .dialog-footer {
      border-top: 1px solid #e2e8f0;
      padding: 12px 20px;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
      background: #f8fafc;
    }
    .whatsapp-send-btn {
      background: #16a34a !important;
      color: #ffffff !important;
      font-weight: 700;
    }
    .whatsapp-send-btn:hover {
      background: #15803d !important;
    }
  `]
})
export class AiAdmissionNurtureDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<AiAdmissionNurtureDialogComponent>);
  private http = inject(HttpClient);
  private confirmDialog = inject(ConfirmDialogService);

  loading = true;
  nurtureData: AiNurtureResponse | null = null;
  selectedPitchIndex = 0;
  editableMessage = '';

  constructor(@Inject(MAT_DIALOG_DATA) public data: { enquiry: any }) {}

  get currentPitch(): AiNurturePitchItem | null {
    if (!this.nurtureData || !this.nurtureData.pitches.length) return null;
    return this.nurtureData.pitches[this.selectedPitchIndex];
  }

  ngOnInit(): void {
    this.loadNurturePitch();
  }

  loadNurturePitch(): void {
    this.loading = true;
    const url = `${environment.apiUrl}/api/enquiries/${this.data.enquiry.id}/ai-nurture-pitch`;
    this.http.get<AiNurtureResponse>(url).subscribe({
      next: res => {
        this.loading = false;
        this.nurtureData = res;
        this.selectPitch(0);
      },
      error: err => {
        this.loading = false;
        this.confirmDialog.alert('Error', 'Unable to generate AI pitch: ' + (err?.error?.message || err.message));
      }
    });
  }

  selectPitch(index: number): void {
    this.selectedPitchIndex = index;
    if (this.currentPitch) {
      this.editableMessage = this.currentPitch.message;
    }
  }

  getScoreClass(): string {
    const score = this.nurtureData?.leadScore || 0;
    if (score >= 75) return 'hot';
    if (score >= 50) return 'warm';
    return 'cold';
  }

  copyPitchText(): void {
    if (!this.editableMessage) return;
    navigator.clipboard.writeText(this.editableMessage);
    this.confirmDialog.alert('Copied 🎉', 'WhatsApp pitch copied to clipboard!');
  }

  sendViaWhatsApp(): void {
    if (!this.editableMessage || !this.nurtureData) return;

    const phone = this.nurtureData.phone;
    let cleanPhone = phone.replace(/[^\d]/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    // Log outreach to backend
    const url = `${environment.apiUrl}/api/enquiries/${this.nurtureData.enquiryId}/log-outreach`;
    this.http.post(url, {
      outreachType: this.currentPitch?.type || 'WhatsApp Nurture',
      content: this.editableMessage,
      recipientPhone: cleanPhone
    }).subscribe({
      next: () => {
        // Open WhatsApp web
        const encoded = encodeURIComponent(this.editableMessage);
        const waUrl = `https://wa.me/${cleanPhone}?text=${encoded}`;
        window.open(waUrl, '_blank');
        this.dialogRef.close({ logged: true });
      },
      error: () => {
        // Still open WhatsApp even if log call fails
        const encoded = encodeURIComponent(this.editableMessage);
        const waUrl = `https://wa.me/${cleanPhone}?text=${encoded}`;
        window.open(waUrl, '_blank');
        this.dialogRef.close({ logged: true });
      }
    });
  }
}
