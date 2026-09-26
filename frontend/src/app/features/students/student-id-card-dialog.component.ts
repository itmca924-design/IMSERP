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

const API_BASE = 'http://localhost:5000/api';

export interface StudentIdCardDto {
  id: string; studentName: string; admissionNumber?: string;
  schoolRollNumber?: string; rollNumber?: string; className?: string;
  sectionName?: string; batchName?: string; dateOfBirth?: string;
  gender?: string; bloodGroup?: string; parentName?: string; parentPhone?: string;
  address?: string; profilePhoto?: string; aadhaarNumber?: string; category?: string;
  institutionName: string; branchName?: string; institutionAddress?: string;
  institutionPhone?: string; affiliationCode?: string; academicYear?: string; qrCodeData: string;
}

export interface StudentIdCardDialogData {
  studentId?: string; classId?: string; sectionId?: string; batchId?: string;
  studentName?: string; className?: string; schoolClasses?: any[];
}

@Component({
  selector: 'app-student-id-card-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatTooltipModule, MatProgressBarModule, MatSelectModule, MatFormFieldModule],
  template: `
<div class="idcard-wrap">
  <div class="modal-header no-print">
    <div class="header-left">
      <div class="header-icon-box"><mat-icon>badge</mat-icon></div>
      <div>
        <h2 class="modal-title">Student Identity Cards (छात्र पहचान पत्र)</h2>
        <p class="modal-subtitle">Official Printable ID Cards &bull; School ERP
          <span *ngIf="cards.length>0" class="count-chip">{{cards.length}} cards</span></p>
      </div>
    </div>
    <div class="header-controls">
      <div class="side-selector">
        <button mat-stroked-button [class.active-btn]="cardSide==='both'" (click)="cardSide='both'">Both</button>
        <button mat-stroked-button [class.active-btn]="cardSide==='front'" (click)="cardSide='front'">Front</button>
        <button mat-stroked-button [class.active-btn]="cardSide==='back'" (click)="cardSide='back'">Back</button>
      </div>
      <mat-form-field appearance="outline" class="class-filter no-print" *ngIf="!data?.studentId && (schoolClasses?.length ?? 0)>0">
        <mat-label>Class</mat-label>
        <mat-select [(ngModel)]="selectedClassId" (selectionChange)="loadIdCards()">
          <mat-option value="">All Classes</mat-option>
          <mat-option *ngFor="let c of schoolClasses" [value]="c.id">{{c.name}}</mat-option>
        </mat-select>
      </mat-form-field>
      <button mat-raised-button class="print-btn" (click)="printCards()" [disabled]="cards.length===0">
        <mat-icon>print</mat-icon> Print {{cards.length}} Card{{cards.length!==1?'s':''}}
      </button>
      <button mat-icon-button (click)="dialogRef.close()" class="close-btn" matTooltip="Close">
        <mat-icon>close</mat-icon>
      </button>
    </div>
  </div>
  <mat-progress-bar mode="indeterminate" *ngIf="loading" class="no-print"></mat-progress-bar>
  <div class="empty-state no-print" *ngIf="!loading && cards.length===0">
    <mat-icon>badge</mat-icon>
    <h3>No Students Found</h3>
    <p>No active school students. Try selecting a class.</p>
  </div>
  <div id="student-id-cards-print" class="cards-sheet print-area" *ngIf="!loading && cards.length>0">
    <div class="cards-grid">
      <div class="card-wrap" *ngFor="let c of cards">
        <!-- FRONT -->
        <div class="id-card id-card-front" *ngIf="cardSide==='both'||cardSide==='front'">
          <div class="card-banner">
            <div class="inst-icon"><mat-icon>school</mat-icon></div>
            <div class="inst-info">
              <div class="inst-name" [title]="c.institutionName">{{c.institutionName}}</div>
              <div class="inst-sub">STUDENT IDENTITY CARD</div>
            </div>
          </div>
          <div class="card-body">
            <div class="photo-wrap">
              <img *ngIf="c.profilePhoto" [src]="getPhotoUrl(c.profilePhoto)" class="stu-photo" (error)="imgErr($event)">
              <div *ngIf="!c.profilePhoto" class="photo-init">{{getInitials(c.studentName)}}</div>
            </div>
            <div class="stu-info">
              <div class="stu-name">{{c.studentName}}</div>
              <div class="adm-badge">{{c.admissionNumber||c.schoolRollNumber||c.rollNumber||'ID'}}</div>
              <div class="stu-class">
                <span *ngIf="c.className">{{c.className}}<span *ngIf="c.sectionName"> &bull; {{c.sectionName.startsWith('Sec') ? c.sectionName : 'Sec ' + c.sectionName}}</span></span>
                <span *ngIf="!c.className && c.batchName">{{c.batchName}}</span>
              </div>
              <div class="acad-year" *ngIf="c.academicYear">{{c.academicYear}}</div>
            </div>
            <div class="meta-grid">
              <div class="meta-row" *ngIf="c.dateOfBirth">
                <span class="lbl">DOB:</span><span class="val">{{c.dateOfBirth|date:'dd-MMM-yy'}}</span>
              </div>
              <div class="meta-row">
                <span class="lbl">Blood:</span><span class="val red">{{c.bloodGroup||'N/A'}}</span>
              </div>
              <div class="meta-row" *ngIf="c.parentName">
                <span class="lbl">Father:</span><span class="val trunc">{{c.parentName}}</span>
              </div>
              <div class="meta-row" *ngIf="c.parentPhone">
                <span class="lbl">Phone:</span><span class="val">{{c.parentPhone}}</span>
              </div>
            </div>
          </div>
          <div class="card-foot">
            <div class="qr-box">
              <mat-icon class="qr-ic">qr_code_2</mat-icon>
              <span class="qr-lbl">{{c.admissionNumber||'STU-ID'}}</span>
            </div>
            <div class="sign-box">
              <div class="sign-line"></div>
              <span class="sign-lbl">Principal / Auth.</span>
            </div>
          </div>
        </div>
        <!-- BACK -->
        <div class="id-card id-card-back" *ngIf="cardSide==='both'||cardSide==='back'">
          <div class="back-hdr"><h4>{{c.institutionName}}</h4></div>
          <div class="back-body">
            <div class="back-inst-info">
              <div *ngIf="c.branchName"><strong>Branch:</strong> {{c.branchName}}</div>
              <div *ngIf="c.institutionAddress"><strong>Address:</strong> {{c.institutionAddress}}</div>
              <div *ngIf="c.institutionPhone"><strong>Phone:</strong> {{c.institutionPhone}}</div>
              <div *ngIf="c.affiliationCode"><strong>Aff. Code:</strong> {{c.affiliationCode}}</div>
            </div>
            <div class="stu-summary">
              <div><strong>Name:</strong> {{c.studentName}}</div>
              <div *ngIf="c.admissionNumber"><strong>Adm No:</strong> {{c.admissionNumber}}</div>
              <div *ngIf="c.className"><strong>Class:</strong> {{c.className}}{{c.sectionName?' - '+c.sectionName:''}}</div>
              <div *ngIf="c.gender"><strong>Gender:</strong> {{c.gender}}</div>
              <div *ngIf="c.category"><strong>Category:</strong> {{c.category}}</div>
            </div>
            <div class="rules">
              <div>&bull; This card is the property of the institution.</div>
              <div>&bull; Carry at all times in school premises.</div>
              <div>&bull; If found, return to the school office.</div>
              <div>&bull; Non-transferable.</div>
            </div>
            <div class="emrg" *ngIf="c.parentPhone">
              <span class="emrg-lbl">Emergency Contact</span>
              <span class="emrg-num">{{c.parentPhone}}</span>
            </div>
          </div>
          <div class="back-foot">{{c.academicYear||'Academic Year'}} &bull; {{c.affiliationCode||'STUDENT-ID'}}</div>
        </div>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .idcard-wrap{display:flex;flex-direction:column;max-height:90vh;background:#f1f5f9;overflow:hidden}
    .modal-header{background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);border-bottom:1px solid #bfdbfe;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .header-left{display:flex;align-items:center;gap:12px}
    .header-icon-box{width:40px;height:40px;background:#2563eb;color:#fff;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 6px -1px rgba(37,99,235,.25);flex-shrink:0}
    .modal-title{margin:0;font-size:18px;font-weight:700;color:#1e3a8a}
    .modal-subtitle{margin:2px 0 0;font-size:12px;color:#3b82f6;display:flex;align-items:center;gap:8px}
    .count-chip{background:#2563eb;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px}
    .header-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .side-selector{display:flex;gap:4px;background:#fff;padding:3px;border-radius:8px;border:1px solid #cbd5e1}
    .side-selector button{font-size:11px;padding:0 10px;height:28px;line-height:28px;border:none}
    .active-btn{background:#2563eb!important;color:#fff!important;font-weight:700}
    .class-filter{height:40px;font-size:12px}
    .class-filter ::ng-deep .mat-mdc-form-field-subscript-wrapper{display:none}
    .class-filter ::ng-deep .mat-mdc-text-field-wrapper{height:40px}
    .print-btn{background:#2563eb;color:#fff;font-weight:600}
    .close-btn{color:#64748b}.close-btn:hover{color:#1e293b}
    .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;color:#94a3b8;gap:12px}
    .empty-state mat-icon{font-size:56px;width:56px;height:56px}
    .empty-state h3{margin:0;font-size:18px;color:#64748b}
    .empty-state p{margin:0;font-size:13px;text-align:center;max-width:320px}
    .cards-sheet{padding:24px;overflow-y:auto;flex:1}
    .cards-grid{display:flex;flex-wrap:wrap;gap:24px;justify-content:center}
    .card-wrap{display:flex;gap:16px;flex-wrap:wrap}
    .id-card{width:240px;height:400px;background:#fff;border-radius:12px;border:1px solid #cbd5e1;box-shadow:0 4px 14px rgba(0,0,0,.08);display:flex;flex-direction:column;overflow:hidden;page-break-inside:avoid;position:relative}
    .card-banner{background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);color:#fff;padding:8px 10px;display:flex;align-items:center;gap:8px;flex-shrink:0}
    .inst-icon{width:28px;height:28px;background:rgba(255,255,255,.2);border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .inst-icon mat-icon{font-size:18px;width:18px;height:18px}
    .inst-info{flex:1;min-width:0;display:flex;flex-direction:column}
    .inst-name{font-size:11px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.5px;text-transform:uppercase}
    .inst-sub{font-size:7.5px;font-weight:700;color:#bfdbfe;letter-spacing:.8px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
    .card-body{padding:8px 10px 4px;display:flex;flex-direction:column;align-items:center;flex:1;justify-content:flex-start}
    .photo-wrap{width:60px;height:60px;border-radius:50%;border:2.5px solid #2563eb;box-shadow:0 2px 6px rgba(37,99,235,.25);overflow:hidden;background:#f1f5f9;display:flex;align-items:center;justify-content:center;margin-bottom:4px;flex-shrink:0}
    .stu-photo{width:100%;height:100%;object-fit:cover}
    .photo-init{font-size:20px;font-weight:800;color:#2563eb}
    .stu-info{text-align:center;width:100%;margin-bottom:4px}
    .stu-name{margin:0;font-size:13px;font-weight:800;color:#0f172a;line-height:1.2}
    .adm-badge{display:inline-block;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;font-size:9.5px;font-weight:800;padding:1.5px 8px;border-radius:4px;margin-top:2px;letter-spacing:.5px}
    .stu-class{font-size:10px;font-weight:600;color:#475569;margin-top:2px}
    .acad-year{font-size:8px;color:#64748b;margin-top:1px}
    .meta-grid{width:100%;background:#f8fafc;border-radius:6px;padding:5px 8px;display:flex;flex-direction:column;gap:2.5px;border:1px solid #e2e8f0;margin-top:4px}
    .meta-row{display:flex;justify-content:space-between;font-size:9px;line-height:1.35}
    .lbl{color:#64748b;font-weight:600}.val{color:#0f172a;font-weight:700}
    .trunc{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .red{color:#dc2626}
    .card-foot{padding:6px 12px 8px;display:flex;align-items:center;justify-content:space-between;border-top:1px dashed #cbd5e1;background:#fff;flex-shrink:0;margin-top:auto}
    .qr-box{display:flex;flex-direction:column;align-items:center;justify-content:center}
    .qr-ic{font-size:26px;width:26px;height:26px;line-height:26px;color:#1e3a8a}
    .qr-lbl{font-size:7.5px;font-weight:700;color:#64748b;letter-spacing:.3px;margin-top:1px}
    .sign-box{text-align:center;width:95px;display:flex;flex-direction:column;align-items:center}
    .sign-line{border-bottom:1.5px solid #475569;width:80px;height:14px;margin-bottom:3px}
    .sign-lbl{font-size:8px;font-weight:700;color:#475569;white-space:nowrap;text-transform:uppercase;letter-spacing:.4px;display:block}
    .id-card-back{background:#fafafa}
    .back-hdr{background:#1e3a8a;color:#fff;padding:9px 10px;text-align:center;flex-shrink:0}
    .back-hdr h4{margin:0;font-size:10px;font-weight:700;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .back-body{padding:8px 10px;display:flex;flex-direction:column;gap:6px;flex:1;font-size:9px;color:#334155;justify-content:space-between}
    .back-inst-info{line-height:1.4}
    .stu-summary{background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;padding:5px 7px;line-height:1.5;font-size:8.5px}
    .rules{line-height:1.4;font-size:8px;color:#475569}
    .emrg{margin-top:auto;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:5px;text-align:center}
    .emrg-lbl{display:block;font-size:8px;font-weight:700;color:#991b1b}
    .emrg-num{font-size:11px;font-weight:800;color:#dc2626;letter-spacing:.5px}
    .back-foot{background:#e2e8f0;padding:6px;text-align:center;font-size:7.5px;font-weight:700;color:#475569;flex-shrink:0}
    @media print{body *{visibility:hidden!important}.print-area,.print-area *{visibility:visible!important}.print-area{position:absolute!important;left:0!important;top:0!important;width:100%!important;padding:10mm!important;background:transparent!important}.no-print{display:none!important}.id-card{box-shadow:none!important;border:1px solid #94a3b8!important;break-inside:avoid;margin:5mm}}
  `]
})
export class StudentIdCardDialogComponent implements OnInit {
  cards: StudentIdCardDto[] = [];
  loading = false;
  cardSide: 'both'|'front'|'back' = 'both';
  selectedClassId = '';
  schoolClasses: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<StudentIdCardDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: StudentIdCardDialogData,
    private http: HttpClient
  ) {}

  ngOnInit() {
    if (this.data?.schoolClasses?.length) this.schoolClasses = this.data.schoolClasses;
    if (this.data?.classId) this.selectedClassId = this.data.classId;
    this.loadIdCards();
  }

  loadIdCards() {
    this.loading = true;
    let url = `${API_BASE}/students/id-cards`;
    const params: string[] = [];
    if (this.data?.studentId) params.push(`studentId=${this.data.studentId}`);
    else if (this.selectedClassId) { params.push(`classId=${this.selectedClassId}`); if(this.data?.sectionId) params.push(`sectionId=${this.data.sectionId}`); }
    else if (this.data?.classId) params.push(`classId=${this.data.classId}`);
    else if (this.data?.batchId) params.push(`batchId=${this.data.batchId}`);
    if (params.length > 0) url += '?' + params.join('&');
    this.http.get<StudentIdCardDto[]>(url).subscribe({ next: r => { this.cards=r; this.loading=false; }, error: () => { this.cards=[]; this.loading=false; } });
  }

  getInitials(name: string): string {
    if (!name) return 'S';
    const p = name.trim().split(' ').filter(Boolean);
    if (p.length === 1) return p[0][0].toUpperCase();
    return (p[0][0]+p[p.length-1][0]).toUpperCase();
  }

  getPhotoUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')||path.startsWith('data:')) return path;
    return `http://localhost:5000${path}`;
  }

  imgErr(e: Event): void {
    const img = e.target as HTMLImageElement;
    img.style.display = 'none';
    const ph = img.parentElement?.querySelector('.photo-init') as HTMLElement;
    if (ph) ph.style.display = 'flex';
  }

  printCards() {
    document.body.classList.add('printing-student-id-cards');
    const cleanup = () => {
      document.body.classList.remove('printing-student-id-cards');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 2500);
  }
}
