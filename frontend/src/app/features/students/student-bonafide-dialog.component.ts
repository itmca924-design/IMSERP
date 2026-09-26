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
import { MatRadioModule } from '@angular/material/radio';

const API_BASE = 'http://localhost:5000/api';

export interface BonafideCertificateDto {
  studentId: string; studentName: string; admissionNumber?: string;
  schoolRollNumber?: string; className?: string; sectionName?: string;
  academicYear?: string; dateOfBirth?: string; gender?: string;
  category?: string; parentName?: string; motherName?: string;
  address?: string; profilePhoto?: string; previousSchoolName?: string;
  bloodGroup?: string; religion?: string; admissionDate: string;
  institutionName: string; branchName?: string; institutionAddress?: string;
  institutionPhone?: string; principalName?: string; affiliationCode?: string;
  affiliationNumber?: string; certificateType: string; generatedOn: string;
}

export interface BonafideDialogData {
  student: any;
}

@Component({
  selector: 'app-student-bonafide-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatTooltipModule, MatProgressBarModule, MatSelectModule, MatFormFieldModule, MatRadioModule],
  template: `
<div class="bonafide-wrap">
  <!-- AGENTS.md light-blue header -->
  <div class="modal-header no-print">
    <div class="header-left">
      <div class="header-icon-box"><mat-icon>workspace_premium</mat-icon></div>
      <div>
        <h2 class="modal-title">Certificate Generator (प्रमाणपत्र)</h2>
        <p class="modal-subtitle">
          <strong style="color:#1e40af">{{data.student?.studentName}}</strong>
          <span> &bull; {{data.student?.className || data.student?.batchName || '—'}}</span>
          <span *ngIf="data.student?.admissionNumber"> &bull; Adm: {{data.student?.admissionNumber}}</span>
        </p>
      </div>
    </div>
    <div class="header-controls">
      <!-- Certificate Type Selector -->
      <div class="cert-type-btns">
        <button mat-stroked-button [class.active-btn]="certType==='Bonafide'" (click)="setCertType('Bonafide')">
          <mat-icon>verified</mat-icon> Bonafide
        </button>
        <button mat-stroked-button [class.active-btn]="certType==='Character'" (click)="setCertType('Character')">
          <mat-icon>psychology</mat-icon> Character
        </button>
        <button mat-stroked-button [class.active-btn]="certType==='StudyCertificate'" (click)="setCertType('StudyCertificate')">
          <mat-icon>school</mat-icon> Study Cert.
        </button>
      </div>
      <button mat-raised-button class="print-btn" (click)="printCert()" [disabled]="loading||!cert">
        <mat-icon>print</mat-icon> Print
      </button>
      <button mat-icon-button (click)="dialogRef.close()" class="close-btn" matTooltip="Close">
        <mat-icon>close</mat-icon>
      </button>
    </div>
  </div>

  <!-- Purpose of Certificate Selection Toolbar -->
  <div class="purpose-bar no-print" *ngIf="!loading && cert">
    <div class="purpose-hdr">
      <div class="p-title-wrap">
        <mat-icon class="p-icon">edit_note</mat-icon>
        <span class="p-label">Purpose of Certificate (प्रयोजन):</span>
      </div>
      <div class="p-input-wrap">
        <input type="text" [(ngModel)]="certPurpose" placeholder="Type custom purpose or click a quick option below..." class="p-input" />
        <button class="p-clear-btn" *ngIf="certPurpose" (click)="certPurpose=''" title="Clear Purpose">✕</button>
      </div>
    </div>
    <div class="p-pills">
      <span class="p-pill" [class.active-pill]="certPurpose==='Opening a Bank Account'" (click)="setPurpose('Opening a Bank Account')">🏦 Bank Account</span>
      <span class="p-pill" [class.active-pill]="certPurpose==='Scholarship Application'" (click)="setPurpose('Scholarship Application')">🎓 Scholarship</span>
      <span class="p-pill" [class.active-pill]="certPurpose==='Passport Verification / Application'" (click)="setPurpose('Passport Verification / Application')">🛂 Passport</span>
      <span class="p-pill" [class.active-pill]="certPurpose==='Admission to Higher Studies'" (click)="setPurpose('Admission to Higher Studies')">📚 Higher Studies</span>
      <span class="p-pill" [class.active-pill]="certPurpose==='Bus Pass / Travel Concession'" (click)="setPurpose('Bus Pass / Travel Concession')">🚌 Bus Pass</span>
      <span class="p-pill" [class.active-pill]="certPurpose==='Official Verification'" (click)="setPurpose('Official Verification')">📄 Official Use</span>
      <span class="p-pill p-pill-blank" [class.active-pill]="!certPurpose" (click)="certPurpose=''">✍️ Leave Blank (Handwritten)</span>
    </div>
  </div>

  <mat-progress-bar mode="indeterminate" *ngIf="loading" class="no-print"></mat-progress-bar>

  <!-- ============ PRINTABLE CERTIFICATE ============ -->
  <div class="cert-preview-area" *ngIf="!loading && cert">
    <div id="bonafide-cert-print" class="certificate print-area">

      <!-- Certificate Top Strip -->
      <div class="cert-top-stripe"></div>

      <!-- Letterhead -->
      <div class="letterhead">
        <div class="lh-logo-wrap">
          <div class="lh-logo-circle">
            <mat-icon class="lh-icon">account_balance</mat-icon>
          </div>
        </div>
        <div class="lh-text">
          <div class="lh-institution">{{cert.institutionName}}</div>
          <div class="lh-branch" *ngIf="cert.branchName">{{cert.branchName}}</div>
          <div class="lh-address" *ngIf="cert.institutionAddress">{{cert.institutionAddress}}</div>
          <div class="lh-phone" *ngIf="cert.institutionPhone">📞 {{cert.institutionPhone}}</div>
          <div class="lh-affiliation" *ngIf="cert.affiliationCode">Affiliation: {{cert.affiliationCode}}</div>
        </div>
        <div class="lh-photo-area" *ngIf="cert.profilePhoto">
          <img [src]="getPhotoUrl(cert.profilePhoto)" class="cert-photo" (error)="imgErr($event)">
        </div>
      </div>

      <!-- Certificate Title -->
      <div class="cert-title-section">
        <div class="cert-title-line"></div>
        <div class="cert-title-text">
          <mat-icon class="cert-title-icon">{{getCertIcon()}}</mat-icon>
          {{getCertTitle()}}
        </div>
        <div class="cert-title-line"></div>
      </div>

      <!-- Serial Number & Date -->
      <div class="cert-meta-bar">
        <span>No.: _______________</span>
        <span>Date: {{cert.generatedOn}}</span>
      </div>

      <!-- Certificate Body -->
      <div class="cert-body">
        <!-- BONAFIDE -->
        <ng-container *ngIf="cert.certificateType === 'Bonafide'">
          <p class="cert-text">
            This is to certify that <strong class="hi">{{cert.studentName}}</strong>
            <span *ngIf="cert.gender"> {{cert.gender==='Male'?'S/O':'D/O'}}</span>
            <span *ngIf="cert.parentName"> <strong class="hi">{{cert.parentName}}</strong></span>,
            is a <em>bonafide student</em> of this institution for the academic year
            <strong class="hi">{{cert.academicYear || currentAcadYear}}</strong>.
          </p>
          <p class="cert-text" *ngIf="cert.className">
            The student is enrolled in <strong class="hi">Class {{cert.className}}<span *ngIf="cert.sectionName"> - {{cert.sectionName.startsWith('Sec') ? cert.sectionName : 'Section ' + cert.sectionName}}</span></strong>.
          </p>
          <p class="cert-text">
            The student was admitted to this institution on
            <strong class="hi">{{cert.admissionDate | date:'dd MMMM yyyy'}}</strong>
            <span *ngIf="cert.admissionNumber"> with Admission Number <strong class="hi">{{cert.admissionNumber}}</strong></span>.
          </p>
          <p class="cert-text" *ngIf="cert.dateOfBirth">
            Date of Birth as per school records: <strong class="hi">{{cert.dateOfBirth}}</strong>.
          </p>
          <p class="cert-text cert-purpose">
            This certificate is issued on request of the student/parent for the purpose of
            <span *ngIf="certPurpose" class="purpose-filled"><strong class="hi">{{certPurpose}}</strong></span><span *ngIf="!certPurpose" class="purpose-blank">&nbsp;</span>.
          </p>
        </ng-container>

        <!-- CHARACTER -->
        <ng-container *ngIf="cert.certificateType === 'Character'">
          <p class="cert-text">
            This is to certify that <strong class="hi">{{cert.studentName}}</strong>
            <span *ngIf="cert.parentName">, {{cert.gender==='Male'?'S/O':'D/O'}} <strong class="hi">{{cert.parentName}}</strong></span>,
            was a student of this institution.
          </p>
          <p class="cert-text" *ngIf="cert.className">
            The student studied in <strong class="hi">Class {{cert.className}}<span *ngIf="cert.sectionName"> - {{cert.sectionName.startsWith('Sec') ? cert.sectionName : 'Section ' + cert.sectionName}}</span></strong>
            during the academic year <strong class="hi">{{cert.academicYear || currentAcadYear}}</strong>.
          </p>
          <p class="cert-text">
            During the period of study at this institution, the student's <strong class="hi">character and conduct were found to be good</strong>.
            The student has always maintained a high standard of discipline and decorum.
          </p>
          <p class="cert-text" *ngIf="cert.admissionDate">
            The student was admitted on <strong class="hi">{{cert.admissionDate | date:'dd MMMM yyyy'}}</strong>
            and has no dues pending with the institution at the time of leaving.
          </p>
          <p class="cert-text cert-purpose">
            This certificate is issued on the request of the student for
            <span *ngIf="certPurpose" class="purpose-filled"><strong class="hi">{{certPurpose}}</strong></span><span *ngIf="!certPurpose" class="purpose-blank">&nbsp;</span>.
          </p>
        </ng-container>

        <!-- STUDY CERTIFICATE -->
        <ng-container *ngIf="cert.certificateType === 'StudyCertificate'">
          <p class="cert-text">
            This is to certify that <strong class="hi">{{cert.studentName}}</strong>
            <span *ngIf="cert.gender"> ({{cert.gender}})</span>
            <span *ngIf="cert.parentName">, {{cert.gender==='Male'?'S/O':'D/O'}} <strong class="hi">{{cert.parentName}}</strong></span>,
            is studying in this institution.
          </p>
          <p class="cert-text" *ngIf="cert.className">
            Currently studying in <strong class="hi">Class {{cert.className}}<span *ngIf="cert.sectionName"> - {{cert.sectionName.startsWith('Sec') ? cert.sectionName : 'Section ' + cert.sectionName}}</span></strong>,
            Academic Year <strong class="hi">{{cert.academicYear || currentAcadYear}}</strong>.
          </p>
          <p class="cert-text" *ngIf="cert.admissionNumber">
            Admission Number: <strong class="hi">{{cert.admissionNumber}}</strong>
            <span *ngIf="cert.dateOfBirth"> &bull; Date of Birth: <strong class="hi">{{cert.dateOfBirth}}</strong></span>.
          </p>
          <p class="cert-text" *ngIf="cert.address">
            Permanent Address: <strong class="hi">{{cert.address}}</strong>.
          </p>
          <p class="cert-text cert-purpose">
            This certificate is issued on request for the purpose of
            <span *ngIf="certPurpose" class="purpose-filled"><strong class="hi">{{certPurpose}}</strong></span><span *ngIf="!certPurpose" class="purpose-blank">&nbsp;</span>.
          </p>
        </ng-container>
      </div>

      <!-- Signatures -->
      <div class="cert-signatures">
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-name">Class Teacher</div>
        </div>
        <div class="sig-block center">
          <div class="school-seal">[ School Seal ]</div>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-name">{{cert.principalName || 'Principal / Head of Institution'}}</div>
          <div class="sig-desig">Principal</div>
        </div>
      </div>

      <!-- Bottom Strip -->
      <div class="cert-bottom-strip">
        <span>{{cert.institutionName}} &bull; {{cert.academicYear || currentAcadYear}}</span>
        <span *ngIf="cert.affiliationCode"> &bull; Affiliation: {{cert.affiliationCode}}</span>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .bonafide-wrap{display:flex;flex-direction:column;max-height:90vh;background:#f1f5f9;overflow:hidden}
    .modal-header{background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);border-bottom:1px solid #bfdbfe;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .header-left{display:flex;align-items:center;gap:12px}
    .header-icon-box{width:40px;height:40px;background:#2563eb;color:#fff;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 6px -1px rgba(37,99,235,.25);flex-shrink:0}
    .modal-title{margin:0;font-size:18px;font-weight:700;color:#1e3a8a}
    .modal-subtitle{margin:2px 0 0;font-size:12px;color:#3b82f6;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .header-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .cert-type-btns{display:flex;gap:4px;background:#fff;padding:3px;border-radius:8px;border:1px solid #cbd5e1}
    .cert-type-btns button{font-size:11px;padding:0 10px;height:28px;line-height:28px;border:none;display:flex;align-items:center;gap:4px}
    .cert-type-btns button mat-icon{font-size:14px;width:14px;height:14px}
    .active-btn{background:#2563eb!important;color:#fff!important;font-weight:700}
    .close-btn{color:#64748b}.close-btn:hover{color:#1e293b}
    /* Purpose toolbar */
    .purpose-bar{background:#ffffff;border-bottom:1px solid #e2e8f0;padding:10px 20px;display:flex;flex-direction:column;gap:8px}
    .purpose-hdr{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
    .p-title-wrap{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#1e3a8a;flex-shrink:0}
    .p-icon{font-size:18px;width:18px;height:18px;color:#2563eb}
    .p-input-wrap{flex:1;min-width:240px;position:relative;display:flex;align-items:center}
    .p-input{width:100%;height:32px;border:1px solid #cbd5e1;border-radius:6px;padding:0 28px 0 10px;font-size:12px;outline:none;transition:border-color .15s}
    .p-input:focus{border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,.15)}
    .p-clear-btn{position:absolute;right:6px;background:none;border:none;color:#94a3b8;font-size:12px;cursor:pointer;padding:2px 4px}
    .p-clear-btn:hover{color:#ef4444}
    .p-pills{display:flex;gap:6px;flex-wrap:wrap}
    .p-pill{background:#f8fafc;border:1px solid #cbd5e1;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:600;color:#475569;cursor:pointer;transition:all .15s;user-select:none}
    .p-pill:hover{background:#eff6ff;border-color:#93c5fd;color:#1d4ed8}
    .active-pill{background:#2563eb!important;border-color:#1d4ed8!important;color:#ffffff!important;font-weight:700}
    .p-pill-blank{background:#fff;border-style:dashed}
    .purpose-filled{color:#1e3a8a;font-weight:700;border-bottom:1.5px solid #1e3a8a;padding-bottom:1px}
    /* Preview area */
    .cert-preview-area{padding:24px;overflow-y:auto;flex:1;display:flex;justify-content:center}
    /* A4 Portrait Certificate */
    .certificate{width:680px;min-height:880px;background:#ffffff;box-shadow:0 8px 32px rgba(0,0,0,.12);border:1px solid #e2e8f0;position:relative;display:flex;flex-direction:column}
    .cert-top-stripe{height:8px;background:linear-gradient(90deg,#1e3a8a,#2563eb,#3b82f6,#2563eb,#1e3a8a)}
    /* Letterhead */
    .letterhead{display:flex;gap:16px;padding:20px 32px 16px;border-bottom:2px solid #1e3a8a;align-items:center}
    .lh-logo-wrap{flex-shrink:0}
    .lh-logo-circle{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#1e3a8a,#2563eb);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(37,99,235,.3)}
    .lh-icon{font-size:36px;width:36px;height:36px;color:#fff}
    .lh-text{flex:1;line-height:1.4}
    .lh-institution{font-size:20px;font-weight:900;color:#1e3a8a;letter-spacing:.5px;text-transform:uppercase}
    .lh-branch{font-size:13px;font-weight:600;color:#2563eb}
    .lh-address{font-size:11px;color:#475569;margin-top:2px}
    .lh-phone{font-size:11px;color:#475569}
    .lh-affiliation{font-size:10px;color:#64748b;margin-top:2px}
    .lh-photo-area{flex-shrink:0}
    .cert-photo{width:80px;height:90px;object-fit:cover;border:2px solid #2563eb;border-radius:4px}
    /* Title */
    .cert-title-section{display:flex;align-items:center;gap:12px;padding:20px 32px 8px}
    .cert-title-line{flex:1;height:2px;background:linear-gradient(90deg,transparent,#2563eb)}
    .cert-title-line:last-child{background:linear-gradient(90deg,#2563eb,transparent)}
    .cert-title-text{font-size:16px;font-weight:900;color:#1e3a8a;letter-spacing:2px;text-transform:uppercase;white-space:nowrap;display:flex;align-items:center;gap:8px}
    .cert-title-icon{font-size:20px;width:20px;height:20px;color:#2563eb}
    /* Meta bar */
    .cert-meta-bar{display:flex;justify-content:space-between;padding:0 32px 12px;font-size:12px;color:#475569}
    /* Body */
    .cert-body{padding:8px 40px 24px;flex:1}
    .cert-text{font-size:14px;line-height:1.9;color:#1e293b;text-align:justify;margin-bottom:16px}
    .cert-purpose{border-top:1px dashed #cbd5e1;padding-top:12px;margin-top:24px}
    .purpose-blank{display:inline-block;width:240px;border-bottom:1.5px solid #1e293b;vertical-align:bottom;margin:0 4px}
    /* Signatures */
    .cert-signatures{display:flex;justify-content:space-between;align-items:flex-end;padding:16px 40px 28px;margin-top:auto}
    .sig-block{text-align:center;min-width:160px}
    .sig-block.center{min-width:120px}
    .sig-line{border-bottom:1px solid #334155;height:40px;margin-bottom:6px}
    .sig-name{font-size:12px;font-weight:700;color:#1e293b}
    .sig-desig{font-size:11px;color:#475569}
    .school-seal{width:90px;height:90px;border:2px dashed #94a3b8;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#94a3b8;margin:0 auto;font-weight:600}
    /* Bottom strip */
    .cert-bottom-strip{background:#1e3a8a;color:#fff;padding:8px 32px;font-size:11px;text-align:center;opacity:.9}
    @media print{body *{visibility:hidden!important}.print-area,.print-area *{visibility:visible!important}.print-area{position:absolute!important;left:0!important;top:0!important;width:100%!important;background:#fff!important;box-shadow:none!important;border:none!important}.no-print{display:none!important}.certificate{box-shadow:none!important;width:100%!important;min-height:auto!important}}
  `]
})
export class StudentBonafideDialogComponent implements OnInit {
  cert: BonafideCertificateDto | null = null;
  loading = false;
  certType: 'Bonafide' | 'Character' | 'StudyCertificate' = 'Bonafide';
  currentAcadYear: string;
  certPurpose: string = '';

  setPurpose(p: string): void {
    this.certPurpose = p;
  }

  constructor(
    public dialogRef: MatDialogRef<StudentBonafideDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: BonafideDialogData,
    private http: HttpClient
  ) {
    const now = new Date();
    this.currentAcadYear = `${now.getFullYear()}-${now.getFullYear()+1}`;
  }

  ngOnInit() { this.loadCert(); }

  loadCert() {
    if (!this.data?.student?.id) return;
    this.loading = true;
    this.http.get<BonafideCertificateDto>(`${API_BASE}/students/${this.data.student.id}/bonafide?certType=${this.certType}`).subscribe({
      next: r => { this.cert = r; this.loading = false; },
      error: () => { this.cert = null; this.loading = false; }
    });
  }

  setCertType(t: 'Bonafide'|'Character'|'StudyCertificate') { this.certType = t; this.loadCert(); }

  getCertTitle(): string {
    switch(this.certType) {
      case 'Character': return 'Character Certificate';
      case 'StudyCertificate': return 'Study Certificate';
      default: return 'Bonafide Certificate';
    }
  }

  getCertIcon(): string {
    switch(this.certType) {
      case 'Character': return 'psychology';
      case 'StudyCertificate': return 'school';
      default: return 'verified';
    }
  }

  getPhotoUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')||path.startsWith('data:')) return path;
    return `http://localhost:5000${path}`;
  }

  imgErr(e: Event): void { (e.target as HTMLImageElement).style.display = 'none'; }

  printCert() {
    document.body.classList.add('printing-bonafide-cert');
    const cleanup = () => {
      document.body.classList.remove('printing-bonafide-cert');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 2500);
  }
}
