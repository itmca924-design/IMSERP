import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { API_BASE, TeacherDocumentDto, CreateTeacherDocumentDto } from './teacher.models';

export interface TeacherDocumentsDialogData {
  teacherId: string;
  teacherName: string;
  employeeCode: string;
}

@Component({
  selector: 'app-teacher-documents-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule,
    MatButtonModule, MatIconModule, MatTooltipModule,
    MatProgressBarModule, MatFormFieldModule, MatInputModule,
    MatSelectModule
  ],
  template: `
<div class="docs-modal-container">
  <!-- Strictly compliant light-blue gradient header (AGENTS.md) -->
  <div class="modal-header">
    <div class="header-left">
      <div class="header-icon-box">
        <mat-icon>folder_shared</mat-icon>
      </div>
      <div>
        <h2 class="modal-title">Staff KYC &amp; Documents Vault</h2>
        <p class="modal-subtitle">{{data.teacherName}} ({{data.employeeCode}}) &bull; सत्यापन एवं दस्तावेज़ रिपॉजिटरी</p>
      </div>
    </div>
    <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
      <mat-icon>close</mat-icon>
    </button>
  </div>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <div class="modal-body">
    <!-- Top Action Row -->
    <div class="top-row">
      <div class="count-badge">
        <mat-icon>verified</mat-icon>
        <span>{{getVerifiedCount()}} of {{documents.length}} Documents Verified</span>
      </div>
      <button mat-raised-button color="primary" (click)="showAddForm = !showAddForm">
        <mat-icon>{{showAddForm ? 'close' : 'add'}}</mat-icon>
        {{showAddForm ? 'Cancel Add' : 'Upload / Add Document'}}
      </button>
    </div>

    <!-- Inline Add Document Form -->
    <div class="add-form-card" *ngIf="showAddForm">
      <h4><mat-icon>cloud_upload</mat-icon> Upload & Attach New Document</h4>
      <div class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>Document Type *</mat-label>
          <mat-select [(ngModel)]="newDoc.documentType">
            <mat-option value="Aadhaar">Aadhaar Card (आधार कार्ड)</mat-option>
            <mat-option value="PAN">PAN Card (पैन कार्ड)</mat-option>
            <mat-option value="Degree">Degree / Graduation Certificate</mat-option>
            <mat-option value="BEd">B.Ed / Teaching Diploma</mat-option>
            <mat-option value="PoliceVerification">Police Verification Certificate</mat-option>
            <mat-option value="AppointmentLetter">Appointment / Joining Letter</mat-option>
            <mat-option value="Experience">Past Experience Letter</mat-option>
            <mat-option value="Resume">Curriculum Vitae / Resume</mat-option>
            <mat-option value="Other">Other Document</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Document Title *</mat-label>
          <input matInput [(ngModel)]="newDoc.title" placeholder="e.g. Master's in Physics Degree">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Document Number (ID / Reg No)</mat-label>
          <input matInput [(ngModel)]="newDoc.documentNumber" placeholder="e.g. XXXX-XXXX-1234">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Document File URL / Cloud Link</mat-label>
          <input matInput [(ngModel)]="newDoc.fileUrl" placeholder="https://... or drive link">
        </mat-form-field>

        <mat-form-field appearance="outline" class="col-full">
          <mat-label>Remarks / Notes</mat-label>
          <input matInput [(ngModel)]="newDoc.remarks" placeholder="Original verified on joining date">
        </mat-form-field>
      </div>

      <div class="form-actions">
        <button mat-button (click)="showAddForm = false">Cancel</button>
        <button mat-raised-button color="primary" [disabled]="saving || !newDoc.documentType || !newDoc.title" (click)="saveDocument()">
          <mat-icon *ngIf="!saving">save</mat-icon>
          <span>{{saving ? 'Saving...' : 'Save Document'}}</span>
        </button>
      </div>
    </div>

    <!-- Documents List -->
    <div class="docs-list" *ngIf="documents.length > 0">
      <div class="doc-card" *ngFor="let doc of documents">
        <div class="doc-icon-col">
          <div class="doc-type-icon" [ngClass]="'type-' + doc.documentType.toLowerCase()">
            <mat-icon>{{getDocIcon(doc.documentType)}}</mat-icon>
          </div>
        </div>

        <div class="doc-info-col">
          <div class="doc-title-row">
            <h4 class="doc-title">{{doc.title}}</h4>
            <span class="status-chip" [ngClass]="'status-' + doc.verificationStatus.toLowerCase()">
              {{doc.verificationStatus}}
            </span>
          </div>

          <div class="doc-meta-row">
            <span class="doc-type-badge">{{doc.documentType}}</span>
            <span class="doc-num" *ngIf="doc.documentNumber"><strong>No:</strong> {{doc.documentNumber}}</span>
            <span class="doc-date">Uploaded: {{doc.createdAt | date:'dd MMM yyyy'}}</span>
          </div>

          <div class="doc-verify-info" *ngIf="doc.verificationStatus === 'Verified'">
            <mat-icon>verified</mat-icon>
            <span>Verified by <strong>{{doc.verifiedBy}}</strong> on {{doc.verifiedAt | date:'dd MMM yyyy'}}</span>
          </div>

          <div class="doc-remarks" *ngIf="doc.remarks">
            <em>{{doc.remarks}}</em>
          </div>

          <div class="doc-link-box" *ngIf="doc.fileUrl">
            <a [href]="doc.fileUrl" target="_blank" class="doc-url-link">
              <mat-icon>open_in_new</mat-icon> Open Document File
            </a>
          </div>
        </div>

        <div class="doc-actions-col">
          <button mat-stroked-button color="primary" class="action-btn" *ngIf="doc.verificationStatus !== 'Verified'" (click)="verifyDoc(doc, 'Verified')">
            <mat-icon>check_circle</mat-icon> Verify
          </button>
          <button mat-stroked-button color="warn" class="action-btn" *ngIf="doc.verificationStatus === 'Verified'" (click)="verifyDoc(doc, 'Pending')">
            <mat-icon>undo</mat-icon> Unverify
          </button>
          <button mat-icon-button color="warn" matTooltip="Delete Document" (click)="deleteDoc(doc.id)">
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div class="empty-docs" *ngIf="!loading && documents.length === 0">
      <mat-icon class="empty-icon">folder_open</mat-icon>
      <h3>No Documents Attached</h3>
      <p>No documents or KYC certificates have been uploaded for this faculty member yet.</p>
    </div>
  </div>
</div>
  `,
  styles: [`
    .docs-modal-container {
      display: flex;
      flex-direction: column;
      max-height: 85vh;
      width: 100%;
      min-width: 650px;
      max-width: 780px;
    }

    /* Strict Header (AGENTS.md) */
    .modal-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon-box {
      width: 40px;
      height: 40px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }

    .modal-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #1e3a8a;
    }

    .modal-subtitle {
      margin: 2px 0 0;
      font-size: 12px;
      color: #3b82f6;
    }

    .close-btn {
      color: #64748b;
    }

    .modal-body {
      padding: 20px;
      overflow-y: auto;
      background: #f8fafc;
    }

    .top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .count-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
      color: #15803d;
      background: #f0fdf4;
      padding: 6px 12px;
      border-radius: 20px;
      border: 1px solid #bbf7d0;
    }

    .count-badge mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .add-form-card {
      background: #ffffff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.05);
    }

    .add-form-card h4 {
      margin: 0 0 12px;
      font-size: 14px;
      color: #1e3a8a;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .col-full {
      grid-column: span 2;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }

    .docs-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .doc-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      gap: 14px;
      align-items: flex-start;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }

    .doc-type-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: #eff6ff;
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .doc-info-col {
      flex: 1;
    }

    .doc-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 4px;
    }

    .doc-title {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }

    .status-chip {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
      text-transform: uppercase;
    }

    .status-verified { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
    .status-pending { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
    .status-rejected { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }

    .doc-meta-row {
      display: flex;
      gap: 10px;
      font-size: 11px;
      color: #64748b;
      margin-bottom: 4px;
    }

    .doc-type-badge {
      background: #f1f5f9;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 600;
    }

    .doc-verify-info {
      font-size: 11px;
      color: #15803d;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
    }

    .doc-verify-info mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .doc-remarks {
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
    }

    .doc-link-box {
      margin-top: 6px;
    }

    .doc-url-link {
      font-size: 11px;
      color: #2563eb;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 600;
    }

    .doc-url-link mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .doc-actions-col {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .action-btn {
      font-size: 11px;
      height: 30px;
      line-height: 30px;
      padding: 0 10px;
    }

    .empty-docs {
      text-align: center;
      padding: 40px;
      color: #64748b;
    }

    .empty-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #94a3b8;
    }
  `]
})
export class TeacherDocumentsDialogComponent implements OnInit {
  documents: TeacherDocumentDto[] = [];
  loading = false;
  saving = false;
  showAddForm = false;

  newDoc: CreateTeacherDocumentDto = {
    documentType: 'Aadhaar',
    title: '',
    documentNumber: '',
    fileUrl: '',
    remarks: ''
  };

  constructor(
    public dialogRef: MatDialogRef<TeacherDocumentsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TeacherDocumentsDialogData,
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    this.loadDocuments();
  }

  loadDocuments() {
    this.loading = true;
    this.http.get<TeacherDocumentDto[]>(`${API_BASE}/teachers/${this.data.teacherId}/documents`).subscribe({
      next: res => {
        this.documents = res;
        this.loading = false;
      },
      error: () => {
        this.documents = [];
        this.loading = false;
      }
    });
  }

  getVerifiedCount(): number {
    return this.documents.filter(d => d.verificationStatus === 'Verified').length;
  }

  getDocIcon(type: string): string {
    switch (type.toLowerCase()) {
      case 'aadhaar':
      case 'pan':
        return 'badge';
      case 'degree':
      case 'bed':
        return 'school';
      case 'policeverification':
        return 'policy';
      case 'appointmentletter':
      case 'experience':
        return 'description';
      case 'resume':
        return 'contact_page';
      default:
        return 'insert_drive_file';
    }
  }

  saveDocument() {
    if (!this.newDoc.title) {
      this.confirmDialog.alert('Required Field', 'Kripya document title dalein.', 'warning');
      return;
    }

    this.saving = true;
    this.http.post<TeacherDocumentDto>(`${API_BASE}/teachers/${this.data.teacherId}/documents`, this.newDoc).subscribe({
      next: () => {
        this.saving = false;
        this.showAddForm = false;
        this.newDoc = { documentType: 'Aadhaar', title: '', documentNumber: '', fileUrl: '', remarks: '' };
        this.confirmDialog.alert('Added', 'Document record safalta se add ho gaya!', 'success');
        this.loadDocuments();
      },
      error: () => {
        this.saving = false;
        this.confirmDialog.alert('Error', 'Document save karne me samasya aayi.', 'danger');
      }
    });
  }

  verifyDoc(doc: TeacherDocumentDto, newStatus: string) {
    this.http.put(`${API_BASE}/teachers/${this.data.teacherId}/documents/${doc.id}/verify`, { verificationStatus: newStatus }).subscribe({
      next: () => {
        this.confirmDialog.alert('Status Updated', `Document status updated to ${newStatus}`, 'success');
        this.loadDocuments();
      },
      error: () => this.confirmDialog.alert('Error', 'Error updating document status.', 'danger')
    });
  }

  deleteDoc(docId: string) {
    this.confirmDialog.danger('Delete Document?', 'Kya aap is document record ko delete karna chahte hain?').subscribe(ok => {
      if (!ok) return;

      this.http.delete(`${API_BASE}/teachers/${this.data.teacherId}/documents/${docId}`).subscribe({
        next: () => {
          this.confirmDialog.alert('Deleted', 'Document safaltapoorvak delete ho gaya.', 'success');
          this.loadDocuments();
        },
        error: () => this.confirmDialog.alert('Error', 'Document delete karne me samasya aayi.', 'danger')
      });
    });
  }
}
