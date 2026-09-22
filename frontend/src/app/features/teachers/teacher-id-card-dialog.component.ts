import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { API_BASE, TeacherIdCardDto } from './teacher.models';

export interface TeacherIdCardDialogData {
  teacherId?: string;
  teacherName?: string;
}

@Component({
  selector: 'app-teacher-id-card-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule,
    MatButtonModule, MatIconModule, MatTooltipModule,
    MatProgressBarModule, MatSelectModule, MatFormFieldModule
  ],
  template: `
<div class="idcard-modal-container">
  <!-- Top Action Bar (Screen Only) adhering strictly to AGENTS.md light-blue header rule -->
  <div class="modal-header no-print">
    <div class="header-left">
      <div class="header-icon-box">
        <mat-icon>badge</mat-icon>
      </div>
      <div>
        <h2 class="modal-title">Staff Identity Cards (शिक्षक पहचान पत्र)</h2>
        <p class="modal-subtitle">Official Staff ID Cards &bull; High Resolution Printable Badges</p>
      </div>
    </div>

    <div class="header-controls">
      <div class="side-selector">
        <button mat-stroked-button [class.active-btn]="cardSide === 'both'" (click)="cardSide = 'both'">Both Sides</button>
        <button mat-stroked-button [class.active-btn]="cardSide === 'front'" (click)="cardSide = 'front'">Front Only</button>
        <button mat-stroked-button [class.active-btn]="cardSide === 'back'" (click)="cardSide = 'back'">Back Only</button>
      </div>

      <button mat-raised-button color="primary" class="print-btn" (click)="printCards()">
        <mat-icon>print</mat-icon> Print ID Cards
      </button>

      <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
        <mat-icon>close</mat-icon>
      </button>
    </div>
  </div>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <!-- Printable Area -->
  <div class="id-cards-sheet print-area" *ngIf="!loading">
    <div class="cards-grid">
      <div class="card-pair-wrapper" *ngFor="let card of cards">
        <!-- ================= FRONT SIDE ================= -->
        <div class="id-card id-card-front" *ngIf="cardSide === 'both' || cardSide === 'front'">
          <!-- Card Header -->
          <div class="card-header-banner">
            <div class="inst-logo-badge">
              <mat-icon>school</mat-icon>
            </div>
            <div class="inst-names">
              <div class="inst-title">{{card.institutionName}}</div>
              <div class="inst-branch">{{card.branchName || 'Main Campus'}} &bull; Staff Identity Card</div>
            </div>
          </div>

          <!-- Card Body -->
          <div class="card-body">
            <div class="photo-container">
              <img *ngIf="card.photoUrl" [src]="card.photoUrl" alt="Photo" class="staff-photo">
              <div *ngIf="!card.photoUrl" class="photo-placeholder">
                {{getInitials(card.fullName)}}
              </div>
            </div>

            <div class="staff-primary-info">
              <h3 class="staff-name">{{card.fullName}}</h3>
              <div class="emp-id-badge">{{card.employeeCode}}</div>
              <div class="staff-desig">{{card.designation || 'Faculty / Teacher'}}</div>
              <div class="staff-qual" *ngIf="card.qualification">{{card.qualification}}</div>
            </div>

            <div class="meta-table">
              <div class="meta-row">
                <span class="meta-label">Blood Grp:</span>
                <span class="meta-val highlight-red">{{card.bloodGroup || 'O+'}}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Mobile:</span>
                <span class="meta-val">{{card.phoneNumber}}</span>
              </div>
              <div class="meta-row" *ngIf="card.joiningDate">
                <span class="meta-label">Joined:</span>
                <span class="meta-val">{{card.joiningDate | date:'dd-MMM-yyyy'}}</span>
              </div>
            </div>
          </div>

          <!-- Card Footer & QR -->
          <div class="card-footer">
            <div class="qr-mock-box">
              <mat-icon class="qr-icon">qr_code_2</mat-icon>
              <span class="qr-label">{{card.employeeCode}}</span>
            </div>
            <div class="signature-block">
              <div class="sign-line"></div>
              <span class="sign-label">Authorized Signatory</span>
            </div>
          </div>
        </div>

        <!-- ================= BACK SIDE ================= -->
        <div class="id-card id-card-back" *ngIf="cardSide === 'both' || cardSide === 'back'">
          <div class="back-header">
            <h4>Instructions &amp; Emergency Contact</h4>
          </div>

          <div class="back-content">
            <div class="info-block">
              <div class="info-line"><strong>Institution:</strong> {{card.institutionName}}</div>
              <div class="info-line" *ngIf="card.institutionAddress"><strong>Address:</strong> {{card.institutionAddress}}</div>
              <div class="info-line" *ngIf="card.institutionPhone"><strong>Helpline:</strong> {{card.institutionPhone}}</div>
            </div>

            <div class="rules-list">
              <div>&bull; Yeh card sanstha ki sampatti hai, sadav sath rakhein.</div>
              <div>&bull; Kho jane par turant office me report karein.</div>
              <div>&bull; Transferable nahi hai.</div>
              <div>&bull; If found, please return to the school reception.</div>
            </div>

            <div class="emergency-box" *ngIf="card.emergencyContact">
              <span class="em-title">Emergency Contact:</span>
              <span class="em-number">{{card.emergencyContact}}</span>
            </div>
          </div>

          <div class="back-footer">
            <span>Official ERP System ID &bull; {{card.affiliationCode || 'IMS-STAFF'}}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .idcard-modal-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      background: #f1f5f9;
      overflow: hidden;
    }

    /* Modal Top Header (Strict Light-Blue Gradient) */
    .modal-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
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

    .header-controls {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .side-selector {
      display: flex;
      gap: 4px;
      background: #ffffff;
      padding: 3px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
    }

    .side-selector button {
      font-size: 11px;
      padding: 0 10px;
      height: 28px;
      line-height: 28px;
      border: none;
    }

    .active-btn {
      background: #2563eb !important;
      color: #ffffff !important;
      font-weight: 700;
    }

    .print-btn {
      background: #2563eb;
      color: #ffffff;
      font-weight: 600;
    }

    .close-btn {
      color: #64748b;
    }

    .close-btn:hover {
      color: #1e293b;
    }

    /* Print / Preview Sheet */
    .id-cards-sheet {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }

    .cards-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      justify-content: center;
    }

    .card-pair-wrapper {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    /* Standard CR80 Ratio Card (Width 220px x Height 340px) */
    .id-card {
      width: 230px;
      height: 350px;
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
      page-break-inside: avoid;
    }

    /* Card Front */
    .card-header-banner {
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      color: #ffffff;
      padding: 10px 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .inst-logo-badge {
      width: 28px;
      height: 28px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .inst-logo-badge mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .inst-names {
      line-height: 1.1;
      overflow: hidden;
    }

    .inst-title {
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .inst-branch {
      font-size: 8px;
      opacity: 0.85;
      margin-top: 1px;
    }

    .card-body {
      padding: 12px 10px 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
    }

    .photo-container {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      border: 3px solid #2563eb;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
      overflow: hidden;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }

    .staff-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .photo-placeholder {
      font-size: 22px;
      font-weight: 800;
      color: #2563eb;
    }

    .staff-primary-info {
      text-align: center;
      width: 100%;
      margin-bottom: 8px;
    }

    .staff-name {
      margin: 0;
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
    }

    .emp-id-badge {
      display: inline-block;
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
      font-size: 10px;
      font-weight: 800;
      padding: 1px 6px;
      border-radius: 4px;
      margin-top: 3px;
      letter-spacing: 0.5px;
    }

    .staff-desig {
      font-size: 10px;
      font-weight: 600;
      color: #475569;
      margin-top: 3px;
    }

    .staff-qual {
      font-size: 9px;
      color: #64748b;
    }

    .meta-table {
      width: 100%;
      background: #f8fafc;
      border-radius: 6px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      border: 1px solid #f1f5f9;
    }

    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
    }

    .meta-label {
      color: #64748b;
      font-weight: 600;
    }

    .meta-val {
      color: #0f172a;
      font-weight: 700;
    }

    .highlight-red {
      color: #dc2626;
    }

    .card-footer {
      padding: 6px 10px 10px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      margin-top: auto;
    }

    .qr-mock-box {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .qr-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #0f172a;
    }

    .qr-label {
      font-size: 7px;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.3px;
    }

    .signature-block {
      text-align: center;
      width: 100px;
    }

    .sign-line {
      border-bottom: 1px solid #64748b;
      height: 20px;
      margin-bottom: 2px;
    }

    .sign-label {
      font-size: 8px;
      font-weight: 700;
      color: #475569;
    }

    /* Card Back */
    .id-card-back {
      background: #fafafa;
    }

    .back-header {
      background: #1e3a8a;
      color: #ffffff;
      padding: 8px 10px;
      text-align: center;
    }

    .back-header h4 {
      margin: 0;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .back-content {
      padding: 12px 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
      font-size: 9px;
      color: #334155;
    }

    .info-block {
      line-height: 1.3;
    }

    .info-line {
      margin-bottom: 3px;
    }

    .rules-list {
      line-height: 1.4;
      font-size: 8.5px;
      color: #475569;
    }

    .emergency-box {
      margin-top: auto;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 6px;
      text-align: center;
    }

    .em-title {
      display: block;
      font-size: 8px;
      font-weight: 700;
      color: #991b1b;
    }

    .em-number {
      font-size: 11px;
      font-weight: 800;
      color: #dc2626;
      letter-spacing: 0.5px;
    }

    .back-footer {
      background: #e2e8f0;
      padding: 5px;
      text-align: center;
      font-size: 7.5px;
      font-weight: 700;
      color: #475569;
    }

    /* ================= PRINT STYLES ================= */
    @media print {
      body * {
        visibility: hidden !important;
      }
      .print-area, .print-area * {
        visibility: visible !important;
      }
      .print-area {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        padding: 10mm !important;
        background: transparent !important;
      }
      .no-print {
        display: none !important;
      }
      .id-card {
        box-shadow: none !important;
        border: 1px solid #94a3b8 !important;
        break-inside: avoid;
        margin: 5mm;
      }
    }
  `]
})
export class TeacherIdCardDialogComponent implements OnInit {
  cards: TeacherIdCardDto[] = [];
  loading = false;
  cardSide: 'both' | 'front' | 'back' = 'both';

  constructor(
    public dialogRef: MatDialogRef<TeacherIdCardDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TeacherIdCardDialogData,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadIdCards();
  }

  loadIdCards() {
    this.loading = true;
    let url = `${API_BASE}/teachers/id-cards`;
    if (this.data?.teacherId) {
      url += `?teacherId=${this.data.teacherId}`;
    }

    this.http.get<TeacherIdCardDto[]>(url).subscribe({
      next: res => {
        this.cards = res;
        this.loading = false;
      },
      error: () => {
        this.cards = [];
        this.loading = false;
      }
    });
  }

  getInitials(name: string): string {
    if (!name) return 'T';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  printCards() {
    window.print();
  }
}
