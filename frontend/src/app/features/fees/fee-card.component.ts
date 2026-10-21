import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { WhatsAppFeeCardDialogComponent } from './whatsapp-fee-card-dialog.component';
import { FeesService, StudentFeeCard } from '../../core/services/fees.service';
import { SchoolService, SchoolClassDto, SchoolSectionDto } from '../../core/services/school.service';
import { CoachingService } from '../../core/services/coaching.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-fee-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule,
    IstDatetimeDirective
  ],
  template: `
    <div class="fee-card-page-container">
      <!-- Top Action & Title Bar (Screen Only) -->
      <div class="page-header no-print">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>contact_page</mat-icon>
          </div>
          <div class="header-titles">
            <h1 class="main-title">
              {{ (!hasSchoolModule() && hasCoachingModule()) || activeStream === 'coaching' ? 'Coaching Student Fee Card & Passbook' : 'Student Fee Card & Passbook' }}
            </h1>
            <p class="subtitle">
              {{ (!hasSchoolModule() && hasCoachingModule()) || activeStream === 'coaching' ? 'कोचिंग छात्र वार्षिक शुल्क पुस्तिका • Standard 12-Month Coaching Ledger & Passbook' : 'वार्षिक छात्र शुल्क कार्ड • Standard 12-Month Academic Ledger & Printable Passbook' }}
            </p>
          </div>
        </div>

        <div class="header-actions">
          <button mat-stroked-button class="btn-action" (click)="refresh()" [disabled]="loading" matTooltip="Reload Fee Card Data">
            <mat-icon [class.spin]="loading">sync</mat-icon>
            <span>Refresh</span>
          </button>

          <button mat-flat-button color="primary" class="btn-print" (click)="printCard()" [disabled]="loading || !currentCard">
            <mat-icon>print</mat-icon>
            <span>Print Fee Card</span>
          </button>
        </div>
      </div>

      <!-- Controls & Filter Toolbar (Screen Only) -->
      <div class="filters-card no-print">
        <!-- Dynamic Academic Stream Switcher (When tenant has both School & Coaching modules) -->
        <div class="stream-switcher-row" *ngIf="hasSchoolModule() && hasCoachingModule()">
          <span class="stream-label">Academic Scope:</span>
          <div class="stream-pills">
            <button
              type="button"
              class="stream-pill"
              [class.active]="activeStream === 'school'"
              (click)="switchStream('school')">
              <mat-icon>school</mat-icon>
              <span>School Classes</span>
            </button>
            <button
              type="button"
              class="stream-pill"
              [class.active]="activeStream === 'coaching'"
              (click)="switchStream('coaching')">
              <mat-icon>menu_book</mat-icon>
              <span>Coaching Batches</span>
            </button>
          </div>
        </div>

        <div class="filters-grid">
          <!-- Session Selector -->
          <div class="filter-col">
            <label class="filter-label">Academic Session</label>
            <mat-form-field appearance="outline" class="w-full">
              <mat-select [(ngModel)]="selectedSessionYear" (selectionChange)="onFilterChanged()">
                <mat-option *ngFor="let s of sessions" [value]="s.year">
                  {{ s.label }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Class Selector (School Stream Only) -->
          <div class="filter-col" *ngIf="activeStream === 'school'">
            <label class="filter-label">School Class</label>
            <mat-form-field appearance="outline" class="w-full">
              <mat-select [(ngModel)]="selectedClassId" placeholder="-- Select Class --" (selectionChange)="onClassChanged()">
                <mat-option value="">-- Select Class --</mat-option>
                <mat-option *ngFor="let c of classes" [value]="c.id">
                  {{ c.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Section Selector (School Stream Only) -->
          <div class="filter-col" *ngIf="activeStream === 'school'">
            <label class="filter-label">Section</label>
            <mat-form-field appearance="outline" class="w-full">
              <mat-select [(ngModel)]="selectedSectionId" placeholder="-- All Sections --" (selectionChange)="onSectionChanged()">
                <mat-option value="">-- All Sections --</mat-option>
                <mat-option *ngFor="let sec of sections" [value]="sec.id">
                  {{ sec.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Batch Selector (Coaching Stream Only) -->
          <div class="filter-col" *ngIf="activeStream === 'coaching'">
            <label class="filter-label">Coaching Batch</label>
            <mat-form-field appearance="outline" class="w-full">
              <mat-select [(ngModel)]="selectedBatchId" placeholder="-- Select Batch --" (selectionChange)="onBatchChanged()">
                <mat-option value="">-- Select Batch --</mat-option>
                <mat-option *ngFor="let b of batches" [value]="b.id">
                  {{ b.name }} <span *ngIf="b.subject">({{ b.subject }})</span>
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Student Selector / Search -->
          <div class="filter-col student-col">
            <label class="filter-label">Select Student</label>
            <mat-form-field appearance="outline" class="w-full">
              <mat-select [(ngModel)]="selectedStudentId" placeholder="-- Choose Student --" (selectionChange)="onStudentChanged()" [disabled]="students.length === 0">
                <mat-option value="">-- Choose Student ({{ students.length }}) --</mat-option>
                <mat-option *ngFor="let st of students" [value]="st.id">
                  <span class="st-opt-roll">#{{ (activeStream === 'coaching' ? (st.coachingRollNumber || st.rollNumber) : (st.schoolRollNumber || st.rollNumber)) || '-' }}</span>
                  <strong class="st-opt-name">{{ st.studentName }}</strong>
                  <span class="st-opt-adm">(Adm: {{ st.admissionNumber || '-' }})</span>
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <!-- Mode Toggle & Quick Filter Stats -->
        <div class="filter-bottom-bar">
          <div class="view-mode-toggle">
            <button
              class="toggle-chip"
              [class.active]="viewMode === 'single'"
              (click)="switchViewMode('single')">
              <mat-icon>person</mat-icon>
              <span>Single Student View</span>
            </button>
            <button
              class="toggle-chip"
              [class.active]="viewMode === 'class'"
              (click)="switchViewMode('class')"
              [disabled]="activeStream === 'school' ? !selectedClassId : !selectedBatchId">
              <mat-icon>groups</mat-icon>
              <span>{{ activeStream === 'coaching' ? 'Coaching Batch View' : 'Class Batch View' }} ({{ classCards.length }})</span>
            </button>
          </div>

          <div class="quick-helpers">
            <button *ngIf="currentCard" mat-button class="btn-whatsapp" (click)="openWhatsAppShareDialog()" matTooltip="Share Fee Passbook on WhatsApp (Popup)">
              <mat-icon>share</mat-icon>
              <span>Share via WhatsApp</span>
            </button>
            <span class="status-summary" *ngIf="currentCard">
              Monthly Rate: <strong>₹{{ currentCard.monthlyFeeRate | number:'1.2-2' }}</strong> |
              Balance Due: <strong [class.has-due]="currentCard.totalBalanceDue > 0">₹{{ currentCard.totalBalanceDue | number:'1.2-2' }}</strong>
            </span>
          </div>
        </div>
      </div>

      <!-- Empty / Prompt State -->
      <div class="empty-container no-print" *ngIf="!loading && !currentCard && viewMode === 'single'">
        <mat-icon class="empty-icon">badge</mat-icon>
        <h3>No Student Selected</h3>
        <p *ngIf="activeStream === 'school'">Please select a Class, Section and Student from the filters above to generate the Student Fee Card.</p>
        <p *ngIf="activeStream === 'coaching'">Please select a Coaching Batch and Student from the filters above to generate the Coaching Fee Card.</p>
      </div>

      <!-- SINGLE STUDENT FEE CARD (Screen & Print) -->
      <div class="fee-card-wrapper" *ngIf="!loading && currentCard && viewMode === 'single'">
        <div class="student-fee-passbook">
          <!-- CARD HEADER -->
          <div class="card-institute-header">
            <div class="inst-logo-col">
              <img [src]="getInstituteLogo(currentCard)" alt="Institute Logo" class="inst-logo-img" (error)="onLogoError($event)" />
            </div>
            <div class="inst-details-col">
              <h2 class="inst-name">{{ currentCard.instituteName || 'JnanDeep Campus' }}</h2>
              <p class="inst-tagline">Excellence in Education • Complete Student ERP Management</p>
              <p class="inst-address">{{ currentCard.instituteAddress || 'Parsa, Saran, Bihar - 841219' }}</p>
              <p class="inst-contact">
                <span *ngIf="currentCard.institutePhone">Phone / WhatsApp: {{ currentCard.institutePhone }}</span>
                <span *ngIf="currentCard.branchName"> • Branch: <strong>{{ currentCard.branchName }}</strong></span>
              </p>
            </div>
            <div class="student-photo-col">
              <div class="student-photo-box">
                <img *ngIf="getStudentPhoto(currentCard)" [src]="getStudentPhoto(currentCard)" alt="Student Photo" class="student-photo" (error)="onStudentPhotoError($event)" />
                <div *ngIf="!getStudentPhoto(currentCard)" class="student-photo-fallback">
                  <mat-icon>person</mat-icon>
                </div>
              </div>
              <span class="photo-caption">Student Photo</span>
            </div>
          </div>

          <!-- TITLE BANNER -->
          <div class="card-title-banner">
            <span class="banner-en">{{ (activeStream === 'coaching' || (!currentCard.className && currentCard.batchName)) ? 'COACHING STUDENT ANNUAL FEE CARD / PASSBOOK' : 'STUDENT ANNUAL FEE CARD / PASSBOOK' }}</span>
            <span class="banner-session">SESSION: {{ currentCard.sessionName }}</span>
            <span class="banner-hi">{{ (activeStream === 'coaching' || (!currentCard.className && currentCard.batchName)) ? 'छात्र कोचिंग वार्षिक शुल्क पुस्तिका' : 'छात्र वार्षिक शुल्क पुस्तिका' }}</span>
          </div>

          <!-- STUDENT INFO TABLE (Authentic ERP Passbook Format) -->
          <table class="student-info-table">
            <tbody>
              <tr>
                <td class="info-label">Student Name (विद्यार्थी का नाम)</td>
                <td class="info-value student-name-val">{{ currentCard.studentName }}</td>
                <td class="info-label">{{ (activeStream === 'coaching' || (!currentCard.className && currentCard.batchName)) ? 'Coaching Batch (बैच)' : 'Class & Sec (कक्षा / वर्ग)' }}</td>
                <td class="info-value bold-val">
                  <ng-container *ngIf="activeStream === 'coaching' || (!currentCard.className && currentCard.batchName)">
                    {{ currentCard.batchName || '-' }}
                    <span *ngIf="currentCard.className" class="hybrid-subtext"> • School: {{ currentCard.className }} ({{ currentCard.sectionName || '-' }})</span>
                  </ng-container>
                  <ng-container *ngIf="activeStream !== 'coaching' && (currentCard.className || !currentCard.batchName)">
                    {{ currentCard.className || '-' }} ({{ currentCard.sectionName || '-' }})
                    <span *ngIf="currentCard.batchName" class="hybrid-subtext"> • Batch: {{ currentCard.batchName }}</span>
                  </ng-container>
                </td>
              </tr>
              <tr>
                <td class="info-label">Roll No. (क्रमांक)</td>
                <td class="info-value bold-val">
                  {{ ((activeStream === 'coaching' ? (currentCard.coachingRollNumber || currentCard.rollNumber) : (currentCard.schoolRollNumber || currentCard.rollNumber)) || currentCard.rollNumber) || '-' }}
                </td>
                <td class="info-label">Admission No. (नामांकन सं.)</td>
                <td class="info-value bold-val">{{ currentCard.admissionNumber || '-' }}</td>
              </tr>
              <tr>
                <td class="info-label">Father's Name (पिता का नाम)</td>
                <td class="info-value">{{ currentCard.parentName || '-' }}</td>
                <td class="info-label">Mother's Name (माता का नाम)</td>
                <td class="info-value">{{ currentCard.motherName || '-' }}</td>
              </tr>
              <tr>
                <td class="info-label">Parent Mobile (मोबाइल नं.)</td>
                <td class="info-value">{{ currentCard.parentWhatsAppPhone || currentCard.emergencyContactPhone || '-' }}</td>
                <td class="info-label">Monthly Rate (मासिक शुल्क)</td>
                <td class="info-value rate-val">₹{{ currentCard.monthlyFeeRate | number:'1.2-2' }}/mo</td>
              </tr>
              <tr *ngIf="currentCard.address">
                <td class="info-label">Address (पता)</td>
                <td class="info-value" colspan="3">{{ currentCard.address }}</td>
              </tr>
            </tbody>
          </table>

          <!-- SUMMARY KPI STRIP -->
          <div class="summary-kpi-strip">
            <div class="kpi-box">
              <span class="kpi-label">Total Annual Fee</span>
              <span class="kpi-value">₹{{ currentCard.totalAnnualFee | number:'1.2-2' }}</span>
            </div>
            <div class="kpi-box" *ngIf="currentCard.totalConcession > 0">
              <span class="kpi-label">Concession Granted</span>
              <span class="kpi-value concession-val">-₹{{ currentCard.totalConcession | number:'1.2-2' }}</span>
            </div>
            <div class="kpi-box">
              <span class="kpi-label">Total Paid Amount</span>
              <span class="kpi-value paid-val">₹{{ currentCard.totalPaid | number:'1.2-2' }}</span>
            </div>
            <div class="kpi-box" [class.due-highlight]="currentCard.totalBalanceDue > 0" [class.clear-highlight]="currentCard.totalBalanceDue <= 0">
              <span class="kpi-label">Net Balance Due</span>
              <span class="kpi-value">₹{{ currentCard.totalBalanceDue | number:'1.2-2' }}</span>
            </div>
            <div class="kpi-box" *ngIf="currentCard.pendingLibraryFine > 0">
              <span class="kpi-label">Library Dues</span>
              <span class="kpi-value lib-val">₹{{ currentCard.pendingLibraryFine | number:'1.2-2' }}</span>
            </div>
          </div>

          <!-- 12-MONTH FEE PASSBOOK TABLE -->
          <div class="passbook-table-container">
            <table class="passbook-table">
              <thead>
                <tr>
                  <th class="th-sn">#</th>
                  <th class="th-month">Month (माह)</th>
                  <th class="th-amount">Payable (₹)</th>
                  <th class="th-amount">Paid (₹)</th>
                  <th class="th-amount">Balance (₹)</th>
                  <th class="th-status">Status</th>
                  <th class="th-receipt">Receipt No & Date / Time (IST)</th>
                  <th class="th-mode">Mode</th>
                  <th class="th-sign">Cashier Stamp / Sign</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let m of currentCard.months; let idx = index" [class.row-paid]="m.status === 'Paid'" [class.row-due]="m.status === 'Due' || m.status === 'Overdue'" [class.row-na]="m.status === 'N/A'">
                  <td class="td-sn">{{ m.monthIndex }}</td>
                  <td class="td-month">
                    <strong>{{ m.monthShort }}</strong>
                  </td>
                  <td class="td-amount">
                    <ng-container *ngIf="m.status !== 'N/A'">
                      <div *ngIf="m.concessionAmount > 0" class="concession-cell" [matTooltip]="'Gross: ₹' + (m.amountPayable | number:'1.2-2') + ' | Concession: -₹' + (m.concessionAmount | number:'1.2-2')">
                        <span class="net-amt">₹{{ m.netPayable | number:'1.2-2' }}</span>
                        <small class="concession-tag">-₹{{ m.concessionAmount | number:'1.0-0' }} Disc</small>
                      </div>
                      <span *ngIf="!m.concessionAmount || m.concessionAmount <= 0">₹{{ m.amountPayable | number:'1.2-2' }}</span>
                    </ng-container>
                    <span *ngIf="m.status === 'N/A'" class="text-muted">-</span>
                  </td>
                  <td class="td-amount font-bold-amt" [class.text-green]="m.amountPaid > 0">
                    {{ m.amountPaid > 0 ? ('₹' + (m.amountPaid | number:'1.2-2')) : '-' }}
                  </td>
                  <td class="td-amount" [class.text-red]="m.balanceDue > 0">
                    <ng-container *ngIf="m.status !== 'N/A'">
                      {{ m.balanceDue > 0 ? ('₹' + (m.balanceDue | number:'1.2-2')) : (m.status === 'Upcoming' ? '-' : '₹0.00') }}
                    </ng-container>
                    <span *ngIf="m.status === 'N/A'" class="text-muted">-</span>
                  </td>
                  <td class="td-status">
                    <span class="status-pill" [ngClass]="getStatusClass(m.status)">
                      {{ formatStatus(m.status) }}
                    </span>
                    <div *ngIf="m.remarks && m.remarks.includes('[BALANCE WAIVED & SETTLED]')" class="month-waiver-tag" [matTooltip]="m.remarks">
                      <mat-icon class="waiver-mini-icon">verified</mat-icon>
                      <span>Balance Waived</span>
                    </div>
                  </td>
                  <td class="td-receipt">
                    <ng-container *ngIf="m.receiptNumber">
                      <span class="rcpt-num">{{ m.receiptNumber }}</span>
                      <small class="rcpt-date" *ngIf="m.paymentDate">
                        <span [appIstDatetime]="m.paymentDate" [format]="'datetime'"></span>
                      </small>
                    </ng-container>
                    <span *ngIf="!m.receiptNumber" class="text-muted">-</span>
                  </td>
                  <td class="td-mode">
                    {{ m.paymentMode || '-' }}
                  </td>
                  <td class="td-sign">
                    <span *ngIf="m.status === 'Paid' || m.status === 'Settled'" class="verified-seal">
                      <mat-icon class="verified-icon">verified</mat-icon>
                      {{ m.status === 'Settled' ? 'SETTLED' : 'PAID' }}
                    </span>
                    <span *ngIf="m.status !== 'Paid' && m.status !== 'Settled'" class="sign-dash">__________</span>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="tfoot-total-row">
                  <td colspan="2" class="total-label">ANNUAL TOTAL:</td>
                  <td class="total-val">₹{{ currentCard.totalAnnualFee | number:'1.2-2' }}</td>
                  <td class="total-val text-green">₹{{ currentCard.totalPaid | number:'1.2-2' }}</td>
                  <td class="total-val" [class.text-red]="currentCard.totalBalanceDue > 0">
                    ₹{{ currentCard.totalBalanceDue | number:'1.2-2' }}
                  </td>
                  <td colspan="4" class="total-remarks">
                    <span *ngIf="currentCard.totalBalanceDue <= 0" class="clearance-badge">
                      <mat-icon>check_circle</mat-icon> No Outstanding Dues for Session {{ currentCard.sessionName }}
                    </span>
                    <span *ngIf="currentCard.totalBalanceDue > 0" class="pending-badge">
                      <mat-icon>warning</mat-icon> Outstanding Due of ₹{{ currentCard.totalBalanceDue | number:'1.2-2' }} pending clearance
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- RULES & TERMS FOOTER -->
          <div class="card-terms-box">
            <h4 class="terms-title">नियम एवं निर्देश / Important Instructions & Terms:</h4>
            <ol class="terms-list">
              <li>मासिक शुल्क प्रत्येक माह की <strong>10 तारीख</strong> तक कार्यालय में जमा कराना अनिवार्य है। (Tuition fee must be cleared on or before the 10th of every month).</li>
              <li>यह शुल्क कार्ड पूरे शैक्षणिक सत्र तक सुरक्षित रखें। परीक्षा हॉल प्रवेश एवं एडमिट कार्ड हेतु यह कार्ड प्रस्तुत करना आवश्यक है। (Keep this card safe for exam verification).</li>
              <li>कार्ड खो जाने अथवा क्षतिग्रस्त होने पर ₹50/- शुल्क देकर डुप्लीकेट कार्ड प्राप्त किया जा सकता है। (Duplicate card re-issue fee: ₹50).</li>
              <li>बिना आधिकारिक रसीद एवं मुहर के किया गया कोई भी भुगतान अमान्य होगा। (Always demand computer printed receipts).</li>
            </ol>
          </div>

          <!-- SIGNATURE BLOCKS -->
          <div class="signatures-container">
            <div class="sig-block">
              <div class="sig-line"></div>
              <span class="sig-title">Parent / Guardian Signature</span>
              <span class="sig-sub">(अभिभावक के हस्ताक्षर)</span>
            </div>

            <div class="sig-block">
              <div class="sig-line"></div>
              <span class="sig-title">Cashier / Accountant</span>
              <span class="sig-sub">(लेखापाल / कैशियर)</span>
            </div>

            <div class="sig-block principal-block">
              <div class="seal-placeholder">
                <span>INSTITUTE SEAL</span>
              </div>
              <div class="sig-line"></div>
              <span class="sig-title">Principal / Director Stamp</span>
              <span class="sig-sub">(प्राचार्य / निदेशक मुहर)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- CLASS BATCH VIEW (Multiple Cards For Selected Class) -->
      <div class="class-batch-wrapper" *ngIf="!loading && viewMode === 'class'">
        <div class="batch-controls no-print">
          <div class="batch-header-info">
            <h3>{{ activeStream === 'coaching' ? 'Coaching Batch Fee Cards Roster' : 'Class Fee Cards Roster' }} ({{ classCards.length }} Students)</h3>
            <p>Showing full 12-month passbooks for all active students in this {{ activeStream === 'coaching' ? 'coaching batch' : 'class' }}.</p>
          </div>
          <button mat-flat-button color="primary" (click)="printCard()" [disabled]="classCards.length === 0">
            <mat-icon>print</mat-icon>
            <span>Print All {{ activeStream === 'coaching' ? 'Batch Cards' : 'Class Cards' }} (A4 Pages)</span>
          </button>
        </div>

        <div *ngIf="classCards.length === 0" class="empty-container no-print">
          <mat-icon class="empty-icon">groups</mat-icon>
          <h3>No students found in this {{ activeStream === 'coaching' ? 'coaching batch' : 'class' }}</h3>
          <p>Please select another {{ activeStream === 'coaching' ? 'batch' : 'class or section' }}.</p>
        </div>

        <div class="batch-cards-list">
          <div *ngFor="let card of classCards" class="page-break-container">
            <div class="student-fee-passbook">
              <!-- CARD HEADER -->
              <div class="card-institute-header">
                <div class="inst-logo-col">
                  <img [src]="getInstituteLogo(card)" alt="Institute Logo" class="inst-logo-img" (error)="onLogoError($event)" />
                </div>
                <div class="inst-details-col">
                  <h2 class="inst-name">{{ card.instituteName || 'JnanDeep Campus' }}</h2>
                  <p class="inst-tagline">Excellence in Education • Complete Student ERP Management</p>
                  <p class="inst-address">{{ card.instituteAddress || 'Parsa, Saran, Bihar - 841219' }}</p>
                  <p class="inst-contact">
                    <span *ngIf="card.institutePhone">Phone / WhatsApp: {{ card.institutePhone }}</span>
                    <span *ngIf="card.branchName"> • Branch: <strong>{{ card.branchName }}</strong></span>
                  </p>
                </div>
                <div class="student-photo-col">
                  <div class="student-photo-box">
                    <img *ngIf="getStudentPhoto(card)" [src]="getStudentPhoto(card)" alt="Student Photo" class="student-photo" (error)="onStudentPhotoError($event)" />
                    <div *ngIf="!getStudentPhoto(card)" class="student-photo-fallback">
                      <mat-icon>person</mat-icon>
                    </div>
                  </div>
                  <span class="photo-caption">Student Photo</span>
                </div>
              </div>

              <!-- TITLE BANNER -->
              <div class="card-title-banner">
                <span class="banner-en">{{ (activeStream === 'coaching' || (!card.className && card.batchName)) ? 'COACHING STUDENT ANNUAL FEE CARD / PASSBOOK' : 'STUDENT ANNUAL FEE CARD / PASSBOOK' }}</span>
                <span class="banner-session">SESSION: {{ card.sessionName }}</span>
                <span class="banner-hi">{{ (activeStream === 'coaching' || (!card.className && card.batchName)) ? 'छात्र कोचिंग वार्षिक शुल्क पुस्तिका' : 'छात्र वार्षिक शुल्क पुस्तिका' }}</span>
              </div>

              <!-- STUDENT INFO TABLE (Authentic ERP Passbook Format) -->
              <table class="student-info-table">
                <tbody>
                  <tr>
                    <td class="info-label">Student Name (विद्यार्थी का नाम)</td>
                    <td class="info-value student-name-val">{{ card.studentName }}</td>
                    <td class="info-label">{{ (activeStream === 'coaching' || (!card.className && card.batchName)) ? 'Coaching Batch (बैच)' : 'Class & Sec (कक्षा / वर्ग)' }}</td>
                    <td class="info-value bold-val">
                      <ng-container *ngIf="activeStream === 'coaching' || (!card.className && card.batchName)">
                        {{ card.batchName || '-' }}
                        <span *ngIf="card.className" class="hybrid-subtext"> • School: {{ card.className }} ({{ card.sectionName || '-' }})</span>
                      </ng-container>
                      <ng-container *ngIf="activeStream !== 'coaching' && (card.className || !card.batchName)">
                        {{ card.className || '-' }} ({{ card.sectionName || '-' }})
                        <span *ngIf="card.batchName" class="hybrid-subtext"> • Batch: {{ card.batchName }}</span>
                      </ng-container>
                    </td>
                  </tr>
                  <tr>
                    <td class="info-label">Roll No. (क्रमांक)</td>
                    <td class="info-value bold-val">
                      {{ ((activeStream === 'coaching' ? (card.coachingRollNumber || card.rollNumber) : (card.schoolRollNumber || card.rollNumber)) || card.rollNumber) || '-' }}
                    </td>
                    <td class="info-label">Admission No. (नामांकन सं.)</td>
                    <td class="info-value bold-val">{{ card.admissionNumber || '-' }}</td>
                  </tr>
                  <tr>
                    <td class="info-label">Father's Name (पिता का नाम)</td>
                    <td class="info-value">{{ card.parentName || '-' }}</td>
                    <td class="info-label">Mother's Name (माता का नाम)</td>
                    <td class="info-value">{{ card.motherName || '-' }}</td>
                  </tr>
                  <tr>
                    <td class="info-label">Parent Mobile (मोबाइल नं.)</td>
                    <td class="info-value">{{ card.parentWhatsAppPhone || card.emergencyContactPhone || '-' }}</td>
                    <td class="info-label">Monthly Rate (मासिक शुल्क)</td>
                    <td class="info-value rate-val">₹{{ card.monthlyFeeRate | number:'1.2-2' }}/mo</td>
                  </tr>
                  <tr *ngIf="card.address">
                    <td class="info-label">Address (पता)</td>
                    <td class="info-value" colspan="3">{{ card.address }}</td>
                  </tr>
                </tbody>
              </table>

              <!-- SUMMARY KPI STRIP -->
              <div class="summary-kpi-strip">
                <div class="kpi-box">
                  <span class="kpi-label">Total Annual Fee</span>
                  <span class="kpi-value">₹{{ card.totalAnnualFee | number:'1.2-2' }}</span>
                </div>
                <div class="kpi-box" *ngIf="card.totalConcession > 0">
                  <span class="kpi-label">Concession Granted</span>
                  <span class="kpi-value concession-val">-₹{{ card.totalConcession | number:'1.2-2' }}</span>
                </div>
                <div class="kpi-box">
                  <span class="kpi-label">Total Paid Amount</span>
                  <span class="kpi-value paid-val">₹{{ card.totalPaid | number:'1.2-2' }}</span>
                </div>
                <div class="kpi-box" [class.due-highlight]="card.totalBalanceDue > 0" [class.clear-highlight]="card.totalBalanceDue <= 0">
                  <span class="kpi-label">Net Balance Due</span>
                  <span class="kpi-value">₹{{ card.totalBalanceDue | number:'1.2-2' }}</span>
                </div>
              </div>

              <!-- 12-MONTH FEE PASSBOOK TABLE -->
              <div class="passbook-table-container">
                <table class="passbook-table">
                  <thead>
                    <tr>
                      <th class="th-sn">#</th>
                      <th class="th-month">Month (माह)</th>
                      <th class="th-amount">Payable (₹)</th>
                      <th class="th-amount">Paid (₹)</th>
                      <th class="th-amount">Balance (₹)</th>
                      <th class="th-status">Status</th>
                      <th class="th-receipt">Receipt No & Date / Time (IST)</th>
                      <th class="th-mode">Mode</th>
                      <th class="th-sign">Cashier Stamp / Sign</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let m of card.months" [class.row-paid]="m.status === 'Paid'" [class.row-due]="m.status === 'Due' || m.status === 'Overdue'" [class.row-na]="m.status === 'N/A'">
                      <td class="td-sn">{{ m.monthIndex }}</td>
                      <td class="td-month"><strong>{{ m.monthShort }}</strong></td>
                      <td class="td-amount">
                        <ng-container *ngIf="m.status !== 'N/A'">
                          <div *ngIf="m.concessionAmount > 0" class="concession-cell">
                            <span class="net-amt">₹{{ m.netPayable | number:'1.2-2' }}</span>
                            <small class="concession-tag">-₹{{ m.concessionAmount | number:'1.0-0' }} Disc</small>
                          </div>
                          <span *ngIf="!m.concessionAmount || m.concessionAmount <= 0">₹{{ m.amountPayable | number:'1.2-2' }}</span>
                        </ng-container>
                        <span *ngIf="m.status === 'N/A'" class="text-muted">-</span>
                      </td>
                      <td class="td-amount font-bold-amt" [class.text-green]="m.amountPaid > 0">
                        {{ m.amountPaid > 0 ? ('₹' + (m.amountPaid | number:'1.2-2')) : '-' }}
                      </td>
                      <td class="td-amount" [class.text-red]="m.balanceDue > 0">
                        <ng-container *ngIf="m.status !== 'N/A'">
                          {{ m.balanceDue > 0 ? ('₹' + (m.balanceDue | number:'1.2-2')) : (m.status === 'Upcoming' ? '-' : '₹0.00') }}
                        </ng-container>
                        <span *ngIf="m.status === 'N/A'" class="text-muted">-</span>
                      </td>
                      <td class="td-status">
                        <span class="status-pill" [ngClass]="getStatusClass(m.status)">
                          {{ formatStatus(m.status) }}
                        </span>
                        <div *ngIf="m.remarks && m.remarks.includes('[BALANCE WAIVED & SETTLED]')" class="month-waiver-tag" [matTooltip]="m.remarks">
                          <mat-icon class="waiver-mini-icon">verified</mat-icon>
                          <span>Balance Waived</span>
                        </div>
                      </td>
                      <td class="td-receipt">
                        <ng-container *ngIf="m.receiptNumber">
                          <span class="rcpt-num">{{ m.receiptNumber }}</span>
                          <small class="rcpt-date" *ngIf="m.paymentDate">
                            <span [appIstDatetime]="m.paymentDate" [format]="'datetime'"></span>
                          </small>
                        </ng-container>
                        <span *ngIf="!m.receiptNumber" class="text-muted">-</span>
                      </td>
                      <td class="td-mode">{{ m.paymentMode || '-' }}</td>
                      <td class="td-sign">
                        <span *ngIf="m.status === 'Paid' || m.status === 'Settled'" class="verified-seal">
                          <mat-icon class="verified-icon">verified</mat-icon> {{ m.status === 'Settled' ? 'SETTLED' : 'PAID' }}
                        </span>
                        <span *ngIf="m.status !== 'Paid' && m.status !== 'Settled'" class="sign-dash">__________</span>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr class="tfoot-total-row">
                      <td colspan="2" class="total-label">ANNUAL TOTAL:</td>
                      <td class="total-val">₹{{ card.totalAnnualFee | number:'1.2-2' }}</td>
                      <td class="total-val text-green">₹{{ card.totalPaid | number:'1.2-2' }}</td>
                      <td class="total-val" [class.text-red]="card.totalBalanceDue > 0">
                        ₹{{ card.totalBalanceDue | number:'1.2-2' }}
                      </td>
                      <td colspan="4" class="total-remarks">
                        <span *ngIf="card.totalBalanceDue <= 0" class="clearance-badge">
                          <mat-icon>check_circle</mat-icon> Clearance for Session {{ card.sessionName }}
                        </span>
                        <span *ngIf="card.totalBalanceDue > 0" class="pending-badge">
                          <mat-icon>warning</mat-icon> Due ₹{{ card.totalBalanceDue | number:'1.2-2' }}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <!-- SIGNATURE BLOCKS -->
              <div class="signatures-container">
                <div class="sig-block">
                  <div class="sig-line"></div>
                  <span class="sig-title">Parent Signature</span>
                </div>
                <div class="sig-block">
                  <div class="sig-line"></div>
                  <span class="sig-title">Cashier / Accountant</span>
                </div>
                <div class="sig-block principal-block">
                  <div class="seal-placeholder">
                    <span>SEAL</span>
                  </div>
                  <div class="sig-line"></div>
                  <span class="sig-title">Principal / Director Stamp</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Host & Global Layout */
    :host {
      display: block;
      width: 100%;
    }

    .fee-card-page-container {
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 0 0 40px;
    }

    /* Page Header - Strict UI Rule */
    .page-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 14px;
      padding: 1.25rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 0;
      box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.05);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .header-icon-box {
      width: 48px;
      height: 48px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
    }

    .header-icon-box mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .header-titles .main-title {
      font-size: 1.35rem;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0;
      line-height: 1.2;
    }

    .header-titles .subtitle {
      font-size: 0.88rem;
      color: #3b82f6;
      margin: 0.25rem 0 0 0;
      font-weight: 500;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .btn-action {
      border-color: #93c5fd !important;
      color: #1e40af !important;
      font-weight: 600;
    }

    .btn-print {
      background: #2563eb !important;
      color: #ffffff !important;
      font-weight: 600;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);
    }

    /* Filters Card */
    .filters-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 0;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
    }

    /* Hybrid subtext in table */
    .hybrid-subtext {
      font-size: 0.78rem;
      font-weight: 500;
      color: #2563eb;
    }

    /* Stream Switcher */
    .stream-switcher-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 1.25rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
    }

    .stream-label {
      font-size: 0.84rem;
      font-weight: 700;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stream-pills {
      display: flex;
      gap: 8px;
      background: #f1f5f9;
      padding: 4px;
      border-radius: 10px;
    }

    .stream-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 16px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: #64748b;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .stream-pill mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .stream-pill.active {
      background: #ffffff;
      color: #1e40af;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
      font-weight: 700;
    }

    .stream-pill:hover:not(.active) {
      color: #0f172a;
      background: rgba(255, 255, 255, 0.5);
    }

    /* Single Loader Container */
    .loader-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      gap: 16px;
      color: #1e3a8a;
    }

    .loader-text {
      font-size: 0.95rem;
      font-weight: 600;
      color: #475569;
      margin: 0;
    }

    .filters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      align-items: flex-end;
    }

    .filter-col {
      display: flex;
      flex-direction: column;
    }

    .filter-label {
      font-size: 0.82rem;
      font-weight: 600;
      color: #475569;
      margin-bottom: 0.35rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .w-full {
      width: 100%;
    }

    ::ng-deep .filters-grid .mat-mdc-form-field-subscript-wrapper {
      display: none !important;
    }

    .st-opt-roll {
      display: inline-block;
      width: 40px;
      color: #2563eb;
      font-weight: 700;
    }

    .st-opt-name {
      color: #0f172a;
      margin-right: 6px;
    }

    .st-opt-adm {
      color: #64748b;
      font-size: 0.8rem;
    }

    .filter-bottom-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 1rem;
      padding-top: 0.85rem;
      border-top: 1px dashed #e2e8f0;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .view-mode-toggle {
      display: flex;
      gap: 0.5rem;
    }

    .toggle-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #475569;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .toggle-chip mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .toggle-chip.active {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #1d4ed8;
      box-shadow: 0 1px 3px rgba(37, 99, 235, 0.15);
    }

    .toggle-chip:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .quick-helpers {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .btn-whatsapp {
      color: #059669 !important;
      font-weight: 600;
    }

    .status-summary {
      font-size: 0.88rem;
      color: #334155;
    }

    .has-due {
      color: #dc2626;
      font-weight: 700;
    }

    /* Loading / Empty States */
    .loading-container, .empty-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 3.5rem 1.5rem;
      text-align: center;
      color: #64748b;
      margin-top: 0;
    }

    .loading-container mat-spinner {
      margin: 0 auto 1rem auto;
    }

    .empty-icon {
      font-size: 54px;
      width: 54px;
      height: 54px;
      color: #94a3b8;
      margin-bottom: 0.75rem;
    }

    .empty-container h3 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 0.5rem 0;
    }

    /* THE PHYSICAL PASSBOOK / FEE CARD */
    .fee-card-wrapper {
      margin-top: 0;
    }

    .student-fee-passbook {
      background: #ffffff;
      border: 2px solid #1e3a8a;
      border-radius: 10px;
      padding: 1.5rem;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
      position: relative;
    }

    /* Institute Header */
    .card-institute-header {
      display: grid;
      grid-template-columns: 85px 1fr 95px;
      gap: 1rem;
      align-items: center;
      padding-bottom: 1rem;
      border-bottom: 2px solid #0f172a;
    }

    .inst-logo-col {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .inst-logo-img {
      max-width: 80px;
      max-height: 80px;
      object-fit: contain;
      border-radius: 6px;
    }

    .inst-details-col {
      text-align: center;
    }

    .inst-name {
      font-size: 1.55rem;
      font-weight: 800;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0;
      line-height: 1.2;
    }

    .inst-tagline {
      font-size: 0.82rem;
      color: #64748b;
      font-weight: 600;
      margin: 0.2rem 0;
    }

    .inst-address {
      font-size: 0.85rem;
      color: #334155;
      font-weight: 500;
      margin: 0.15rem 0;
    }

    .inst-contact {
      font-size: 0.82rem;
      color: #475569;
      margin: 0.15rem 0 0 0;
    }

    .student-photo-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .student-photo-box {
      width: 80px;
      height: 90px;
      border: 1.5px solid #94a3b8;
      border-radius: 6px;
      overflow: hidden;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .student-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .student-photo-fallback mat-icon {
      font-size: 44px;
      width: 44px;
      height: 44px;
      color: #94a3b8;
    }

    .photo-caption {
      font-size: 0.68rem;
      color: #64748b;
      margin-top: 3px;
      text-transform: uppercase;
      font-weight: 600;
    }

    /* Card Banner */
    .card-title-banner {
      background: #1e3a8a;
      color: #ffffff;
      padding: 0.5rem 1rem;
      margin: 0.75rem 0;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 700;
      font-size: 0.95rem;
      letter-spacing: 0.5px;
    }

    .banner-session {
      background: #fef08a;
      color: #854d0e;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 800;
    }

    .banner-hi {
      font-size: 0.85rem;
      opacity: 0.9;
    }

    /* Student Info Table (Passbook Format) */
    .student-info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1rem;
      background: #ffffff;
      border: 1.5px solid #1e3a8a;
      border-radius: 6px;
      overflow: hidden;
      table-layout: fixed;
    }

    .student-info-table tbody tr {
      border-bottom: 1px solid #cbd5e1;
    }

    .student-info-table tbody tr:last-child {
      border-bottom: none;
    }

    .student-info-table td {
      padding: 6px 10px;
      border-right: 1px solid #cbd5e1;
      vertical-align: middle;
      font-size: 0.85rem;
    }

    .student-info-table td:last-child {
      border-right: none;
    }

    .info-label {
      width: 20%;
      background: #eff6ff;
      color: #1e3a8a;
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.2px;
    }

    .info-value {
      width: 30%;
      background: #ffffff;
      color: #1e293b;
    }

    .student-name-val {
      font-size: 0.95rem;
      font-weight: 800;
      color: #1e3a8a;
    }

    .bold-val {
      font-weight: 700;
      color: #0f172a;
    }

    .rate-val {
      font-weight: 800;
      color: #2563eb;
    }

    /* KPI Summary Strip */
    .summary-kpi-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }

    .kpi-box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 0.65rem 0.85rem;
      background: #ffffff;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .kpi-label {
      font-size: 0.74rem;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 3px;
    }

    .kpi-value {
      font-size: 1.15rem;
      font-weight: 800;
      color: #0f172a;
    }

    .paid-val {
      color: #16a34a;
    }

    .concession-val {
      color: #d97706;
    }

    .due-highlight {
      background: #fef2f2 !important;
      border-color: #fca5a5 !important;
    }

    .due-highlight .kpi-value {
      color: #dc2626 !important;
    }

    .clear-highlight {
      background: #f0fdf4 !important;
      border-color: #86efac !important;
    }

    .clear-highlight .kpi-value {
      color: #16a34a !important;
    }

    .lib-val {
      color: #b45309;
    }

    /* Passbook 12-Month Table */
    .passbook-table-container {
      border: 1.5px solid #0f172a;
      border-radius: 6px;
      overflow-x: auto;
      margin-bottom: 1.25rem;
      background: #ffffff;
    }

    .passbook-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.84rem;
    }

    .passbook-table th, .passbook-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      vertical-align: middle;
    }

    .passbook-table thead tr {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
    }

    .th-sn { width: 35px; text-align: center; }
    .th-month { width: 110px; }
    .th-amount { width: 95px; text-align: right; }
    .th-status { width: 90px; text-align: center; }
    .th-receipt { width: 130px; }
    .th-mode { width: 75px; text-align: center; }
    .th-sign { width: 130px; text-align: center; }

    .td-sn { text-align: center; font-weight: 600; color: #475569; }
    .td-amount { text-align: right; font-variant-numeric: tabular-nums; }
    .td-status { text-align: center; }
    .td-mode { text-align: center; font-size: 0.8rem; }
    .td-sign { text-align: center; }

    .concession-cell {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-end;
      line-height: 1.15;

      .net-amt {
        font-weight: 700;
        color: #0f172a;
      }
      .concession-tag {
        font-size: 0.68rem;
        color: #059669;
        font-weight: 600;
        background: #ecfdf5;
        padding: 0 4px;
        border-radius: 3px;
        border: 1px solid #a7f3d0;
      }
    }

    .font-bold-amt {
      font-weight: 700;
    }

    .text-green { color: #16a34a; font-weight: 700; }
    .text-red { color: #dc2626; font-weight: 700; }
    .text-muted { color: #94a3b8; }

    .status-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .pill-paid {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }

    .pill-settled {
      background: #dbeafe;
      color: #1e40af;
      border: 1px solid #bfdbfe;
    }

    .pill-cancelled {
      background: #f1f5f9;
      color: #64748b;
      border: 1px solid #cbd5e1;
    }

    .month-waiver-tag {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      margin-top: 3px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 0.68rem;
      font-weight: 600;
      cursor: help;

      .waiver-mini-icon {
        font-size: 11px;
        width: 11px;
        height: 11px;
        color: #2563eb;
      }
    }

    .pill-partially {
      background: #ffedd5;
      color: #9a3412;
      border: 1px solid #fed7aa;
    }

    .pill-due {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }

    .pill-overdue {
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #f87171;
    }

    .pill-upcoming {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
    }

    .pill-na {
      background: #f8fafc;
      color: #94a3b8;
      border: 1px solid #e2e8f0;
    }

    .row-na {
      background-color: #fafbfc;
      color: #94a3b8;
    }

    .rcpt-num {
      display: block;
      font-weight: 700;
      color: #1e3a8a;
      font-size: 0.8rem;
    }

    .rcpt-date {
      display: block;
      font-size: 0.72rem;
      color: #64748b;
    }

    .verified-seal {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: #15803d;
      font-weight: 800;
      font-size: 0.75rem;
    }

    .verified-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .sign-dash {
      color: #cbd5e1;
      font-size: 0.75rem;
    }

    /* Footer Totals Row */
    .tfoot-total-row {
      background: #f8fafc;
      font-weight: 800;
      border-top: 2px solid #0f172a;
    }

    .total-label {
      text-align: right;
      padding: 8px 10px;
      color: #0f172a;
      font-size: 0.85rem;
    }

    .total-val {
      text-align: right;
      padding: 8px 10px;
      font-size: 0.95rem;
      font-variant-numeric: tabular-nums;
    }

    .total-remarks {
      padding: 8px 10px;
      font-size: 0.82rem;
    }

    .clearance-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #15803d;
      font-weight: 700;
    }

    .pending-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #b91c1c;
      font-weight: 700;
    }

    /* Terms Box */
    .card-terms-box {
      border: 1px dashed #94a3b8;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      background: #f8fafc;
      margin-bottom: 1.5rem;
    }

    .terms-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0 0 0.4rem 0;
      text-transform: uppercase;
    }

    .terms-list {
      margin: 0;
      padding-left: 1.25rem;
      font-size: 0.78rem;
      color: #475569;
      line-height: 1.5;
    }

    /* Signatures Section */
    .signatures-container {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2rem;
      padding-top: 1.75rem;
      align-items: flex-end;
    }

    .sig-block {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .sig-line {
      width: 80%;
      height: 1px;
      background: #0f172a;
      margin-bottom: 6px;
    }

    .sig-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: #0f172a;
    }

    .sig-sub {
      font-size: 0.72rem;
      color: #64748b;
    }

    .principal-block {
      position: relative;
    }

    .seal-placeholder {
      width: 75px;
      height: 45px;
      border: 1px dashed #94a3b8;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
      color: #94a3b8;
      font-size: 0.65rem;
      font-weight: 700;
    }

    /* Class Batch View */
    .batch-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1rem 1.5rem;
      margin-bottom: 1.5rem;
    }

    .batch-header-info h3 {
      font-size: 1.15rem;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0;
    }

    .batch-header-info p {
      font-size: 0.85rem;
      color: #64748b;
      margin: 0.2rem 0 0 0;
    }

    .batch-cards-list {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .page-break-container {
      page-break-after: always;
      break-after: page;
    }

    .spin {
      animation: spinAnim 1s linear infinite;
    }

    @keyframes spinAnim {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Responsive Styles */
    @media (max-width: 900px) {
      .card-institute-header {
        grid-template-columns: 65px 1fr 75px;
      }
    }

    @media (max-width: 600px) {
      .fee-card-page-container {
        padding: 0 0 30px;
      }
      .page-header {
        flex-direction: column;
        align-items: flex-start;
      }
      .header-actions {
        width: 100%;
        justify-content: flex-end;
      }
      .inst-name {
        font-size: 1.25rem;
      }
      .card-title-banner {
        flex-direction: column;
        gap: 4px;
        text-align: center;
      }
    }

    /* STRICT SINGLE-PAGE A4 PRINT STYLESHEET */
    @page {
      size: A4 portrait;
      margin: 6mm 8mm;
    }

    @media print {
      body, html {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
      }

      .no-print, header, nav, .sidebar, .mat-toolbar, .header-container, app-footer, .footer {
        display: none !important;
      }

      .fee-card-page-container {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }

      .fee-card-wrapper {
        margin: 0 !important;
        padding: 0 !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
      }

      .page-break-container {
        page-break-after: always !important;
        break-after: page !important;
        margin-bottom: 0 !important;
      }

      .student-fee-passbook {
        border: 1.5px solid #000000 !important;
        box-shadow: none !important;
        padding: 6mm 8mm !important;
        border-radius: 0 !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }

      .card-institute-header {
        grid-template-columns: 55px 1fr 65px !important;
        gap: 8px !important;
        padding-bottom: 4px !important;
        border-bottom: 1.5px solid #000000 !important;
      }

      .inst-logo-img {
        max-width: 50px !important;
        max-height: 50px !important;
      }

      .inst-name {
        font-size: 15px !important;
        line-height: 1.15 !important;
        color: #000000 !important;
      }

      .inst-tagline {
        font-size: 8px !important;
        margin: 1px 0 !important;
        color: #333333 !important;
      }

      .inst-address, .inst-contact {
        font-size: 8.5px !important;
        margin: 1px 0 !important;
        color: #000000 !important;
      }

      .student-photo-box {
        width: 55px !important;
        height: 65px !important;
        border: 1px solid #000000 !important;
      }

      .photo-caption {
        font-size: 6.5px !important;
      }

      .card-title-banner {
        background: #1e3a8a !important;
        color: #ffffff !important;
        padding: 3px 8px !important;
        margin: 4px 0 !important;
        font-size: 10px !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .banner-session {
        background: #fef08a !important;
        color: #854d0e !important;
        padding: 1px 6px !important;
        font-size: 9px !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .banner-hi {
        font-size: 9px !important;
      }

      .student-info-table {
        width: 100% !important;
        border-collapse: collapse !important;
        border: 1.5px solid #000000 !important;
        margin-bottom: 4px !important;
        background: #ffffff !important;
        table-layout: fixed !important;
      }

      .student-info-table tbody tr {
        border-bottom: 1px solid #000000 !important;
      }

      .student-info-table td {
        padding: 2.5px 5px !important;
        border-right: 1px solid #000000 !important;
        line-height: 1.15 !important;
        vertical-align: middle !important;
      }

      .student-info-table td:last-child {
        border-right: none !important;
      }

      .info-label {
        width: 19% !important;
        background: #f1f5f9 !important;
        color: #000000 !important;
        font-size: 7.2px !important;
        font-weight: 700 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .info-value {
        width: 31% !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-size: 8px !important;
      }

      .student-name-val {
        font-size: 8.5px !important;
        font-weight: 800 !important;
        color: #000000 !important;
      }

      .bold-val {
        font-weight: 700 !important;
        color: #000000 !important;
      }

      .rate-val {
        font-weight: 800 !important;
        color: #000000 !important;
      }

      .summary-kpi-strip {
        gap: 5px !important;
        margin-bottom: 4px !important;
      }

      .kpi-box {
        border: 1px solid #000000 !important;
        padding: 2px 4px !important;
        border-radius: 4px !important;
      }

      .kpi-label {
        font-size: 7px !important;
        margin-bottom: 1px !important;
        color: #333333 !important;
      }

      .kpi-value {
        font-size: 10.5px !important;
        color: #000000 !important;
      }

      .passbook-table-container {
        border: 1.5px solid #000000 !important;
        margin-bottom: 4px !important;
        overflow: visible !important;
      }

      .passbook-table {
        width: 100% !important;
        table-layout: fixed !important;
        border-collapse: collapse !important;
        font-size: 8.5px !important;
      }

      .th-sn { width: 4% !important; text-align: center !important; }
      .th-month { width: 14% !important; }
      .th-amount { width: 10% !important; text-align: right !important; }
      .th-status { width: 11% !important; text-align: center !important; }
      .th-receipt { width: 17% !important; }
      .th-mode { width: 9% !important; text-align: center !important; }
      .th-sign { width: 15% !important; text-align: center !important; }

      .passbook-table th {
        border: 1px solid #000000 !important;
        background: #f1f5f9 !important;
        color: #000000 !important;
        padding: 2px 4px !important;
        font-size: 8px !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .passbook-table td {
        border: 1px solid #000000 !important;
        color: #000000 !important;
        padding: 1.5px 4px !important;
        font-size: 8px !important;
        line-height: 1.15 !important;
      }

      .status-pill {
        border: 1px solid #000000 !important;
        padding: 1px 3px !important;
        font-size: 7px !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .rcpt-num {
        font-size: 7.5px !important;
        color: #000000 !important;
      }

      .rcpt-date {
        font-size: 6.5px !important;
        color: #333333 !important;
      }

      .total-label, .total-val, .total-remarks {
        padding: 2.5px 4px !important;
        font-size: 8.5px !important;
      }

      .tfoot-total-row {
        border-top: 1.5px solid #000000 !important;
      }

      .card-terms-box {
        border: 1px dashed #000000 !important;
        padding: 3px 6px !important;
        margin-bottom: 5px !important;
        background: #ffffff !important;
      }

      .terms-title {
        font-size: 8px !important;
        margin: 0 0 1px 0 !important;
        color: #000000 !important;
      }

      .terms-list {
        font-size: 7px !important;
        line-height: 1.2 !important;
        margin: 0 !important;
        padding-left: 12px !important;
        color: #000000 !important;
      }

      .signatures-container {
        display: grid !important;
        grid-template-columns: repeat(3, 1fr) !important;
        width: 100% !important;
        padding-top: 8px !important;
        gap: 12px !important;
        align-items: flex-end !important;
      }

      .sig-line {
        background: #000000 !important;
        height: 1px !important;
        margin-bottom: 2px !important;
      }

      .sig-title {
        font-size: 8px !important;
        color: #000000 !important;
      }

      .sig-sub {
        font-size: 6.5px !important;
        color: #444444 !important;
      }

      .seal-placeholder {
        width: 50px !important;
        height: 24px !important;
        font-size: 6px !important;
        border: 1px dashed #000000 !important;
        margin-bottom: 2px !important;
      }
    }
  `]
})
export class FeeCardComponent implements OnInit {
  private feesService = inject(FeesService);
  private schoolService = inject(SchoolService);
  private coachingService = inject(CoachingService);
  private authService = inject(AuthService);
  private confirmDialog = inject(ConfirmDialogService);
  private dialog = inject(MatDialog);

  // Tenant Module Context & Stream
  readonly hasSchoolModule = this.authService.hasSchoolModule;
  readonly hasCoachingModule = this.authService.hasCoachingModule;
  activeStream: 'school' | 'coaching' = 'school';

  // Filter State
  sessions: { year: number; label: string }[] = [];
  selectedSessionYear: number = 2026;

  // School Stream
  classes: SchoolClassDto[] = [];
  selectedClassId: string = '';
  sections: SchoolSectionDto[] = [];
  selectedSectionId: string = '';

  // Coaching Stream
  batches: any[] = [];
  selectedBatchId: string = '';

  // Student State
  students: any[] = [];
  selectedStudentId: string = '';

  // View state
  viewMode: 'single' | 'class' = 'single';
  loading: boolean = false;

  currentCard: StudentFeeCard | null = null;
  classCards: StudentFeeCard[] = [];

  ngOnInit(): void {
    this.initSessions();

    if (!this.hasSchoolModule() && this.hasCoachingModule()) {
      this.activeStream = 'coaching';
      this.loadBatches();
    } else {
      this.activeStream = 'school';
      if (this.hasSchoolModule()) {
        this.loadClasses();
      }
      if (this.hasCoachingModule()) {
        this.loadBatches();
      }
    }
  }

  private initSessions(): void {
    const now = new Date();
    const currYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    this.selectedSessionYear = currYear;

    this.sessions = [
      { year: currYear + 1, label: `${currYear + 1}-${currYear + 2} (Next Session)` },
      { year: currYear, label: `${currYear}-${currYear + 1} (Current Academic Session)` },
      { year: currYear - 1, label: `${currYear - 1}-${currYear} (Previous Session)` },
      { year: currYear - 2, label: `${currYear - 2}-${currYear - 1} (Archived Session)` }
    ];
  }

  switchStream(stream: 'school' | 'coaching'): void {
    if (this.activeStream === stream) return;
    this.activeStream = stream;
    this.students = [];
    this.selectedStudentId = '';
    this.currentCard = null;
    this.classCards = [];

    if (stream === 'school') {
      if (this.classes.length === 0) {
        this.loadClasses();
      } else if (this.selectedClassId) {
        this.loadStudents();
      }
    } else {
      this.selectedBatchId = '';
      if (this.batches.length === 0) {
        this.loadBatches();
      }
    }
  }

  loadBatches(): void {
    this.coachingService.getBatches().subscribe({
      next: (data) => {
        this.batches = data || [];
        this.selectedBatchId = '';
      },
      error: (err) => console.error('Failed to load batches', err)
    });
  }

  onBatchChanged(): void {
    this.students = [];
    this.selectedStudentId = '';
    this.currentCard = null;
    this.classCards = [];

    if (!this.selectedBatchId) return;
    this.loadStudents();
  }

  loadClasses(): void {
    this.schoolService.getClasses(true).subscribe({
      next: (data) => {
        this.classes = data || [];
        if (this.activeStream === 'school' && this.classes.length > 0 && !this.selectedClassId) {
          this.selectedClassId = this.classes[0].id;
          this.selectedSectionId = '';
          this.onClassChanged();
        }
      },
      error: (err) => console.error('Failed to load classes', err)
    });
  }

  onClassChanged(): void {
    this.selectedSectionId = '';
    this.sections = [];
    this.students = [];
    this.selectedStudentId = '';
    this.currentCard = null;
    this.classCards = [];

    if (!this.selectedClassId) return;

    this.schoolService.getSections(this.selectedClassId).subscribe({
      next: (secData) => {
        this.sections = secData || [];
        this.selectedSectionId = '';
      },
      error: (err) => console.error('Failed to load sections', err)
    });

    this.loadStudents();
  }

  onSectionChanged(): void {
    this.loadStudents();
  }

  loadStudents(): void {
    if (this.activeStream === 'school') {
      if (!this.selectedClassId) return;

      this.loading = true;
      this.coachingService.getStudents(undefined, this.selectedClassId, this.selectedSectionId || undefined).subscribe({
        next: (res) => {
          this.students = res || [];
          this.loading = false;
          if (this.students.length > 0) {
            this.selectedStudentId = this.students[0].id;
            this.loadStudentCard();
          } else {
            this.selectedStudentId = '';
            this.currentCard = null;
          }

          if (this.viewMode === 'class') {
            this.loadBatchCards();
          }
        },
        error: (err) => {
          this.loading = false;
          console.error('Failed to load students', err);
        }
      });
    } else {
      if (!this.selectedBatchId) return;

      this.loading = true;
      this.coachingService.getStudents(this.selectedBatchId, undefined, undefined).subscribe({
        next: (res) => {
          this.students = res || [];
          this.loading = false;
          if (this.students.length > 0) {
            this.selectedStudentId = this.students[0].id;
            this.loadStudentCard();
          } else {
            this.selectedStudentId = '';
            this.currentCard = null;
          }

          if (this.viewMode === 'class') {
            this.loadBatchCards();
          }
        },
        error: (err) => {
          this.loading = false;
          console.error('Failed to load batch students', err);
        }
      });
    }
  }

  onStudentChanged(): void {
    if (this.selectedStudentId) {
      this.loadStudentCard();
    } else {
      this.currentCard = null;
    }
  }

  onFilterChanged(): void {
    if (this.viewMode === 'single' && this.selectedStudentId) {
      this.loadStudentCard();
    } else if (this.viewMode === 'class') {
      const hasScope = this.activeStream === 'school' ? !!this.selectedClassId : !!this.selectedBatchId;
      if (hasScope) {
        this.loadBatchCards();
      }
    }
  }

  loadStudentCard(): void {
    if (!this.selectedStudentId) return;
    this.loading = true;

    this.feesService.getStudentFeeCard(this.selectedStudentId, this.selectedSessionYear).subscribe({
      next: (card) => {
        this.currentCard = card;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.confirmDialog.alert('Notice', 'Failed to load student fee card: ' + (err?.error?.message || err.message), 'danger');
      }
    });
  }

  loadBatchCards(): void {
    if (this.activeStream === 'school') {
      if (!this.selectedClassId) return;
      this.loading = true;

      this.feesService.getStudentFeeCardsByClass(
        this.selectedClassId,
        this.selectedSectionId || undefined,
        undefined,
        this.selectedSessionYear
      ).subscribe({
        next: (cards) => {
          this.classCards = cards || [];
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.confirmDialog.alert('Notice', 'Failed to load class fee cards: ' + (err?.error?.message || err.message), 'danger');
        }
      });
    } else {
      if (!this.selectedBatchId) return;
      this.loading = true;

      this.feesService.getStudentFeeCardsByClass(
        undefined,
        undefined,
        this.selectedBatchId,
        this.selectedSessionYear
      ).subscribe({
        next: (cards) => {
          this.classCards = cards || [];
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.confirmDialog.alert('Notice', 'Failed to load coaching batch fee cards: ' + (err?.error?.message || err.message), 'danger');
        }
      });
    }
  }

  switchViewMode(mode: 'single' | 'class'): void {
    this.viewMode = mode;
    if (mode === 'class') {
      const hasScope = this.activeStream === 'school' ? !!this.selectedClassId : !!this.selectedBatchId;
      if (this.classCards.length === 0 && hasScope) {
        this.loadBatchCards();
      }
    } else {
      if (!this.currentCard && this.selectedStudentId) {
        this.loadStudentCard();
      }
    }
  }

  refresh(): void {
    if (this.viewMode === 'single') {
      this.loadStudentCard();
    } else {
      this.loadBatchCards();
    }
  }

  printCard(): void {
    window.print();
  }

  getInstituteLogo(card?: StudentFeeCard | null): string {
    const rawLogo = card?.instituteLogo || this.authService.getInstituteLogoUrl();
    if (!rawLogo) return '/assets/images/logo.png';
    return this.getPhotoUrl(rawLogo);
  }

  getStudentPhoto(card?: StudentFeeCard | null): string {
    const photo = card?.profilePhoto;
    if (!photo) return '';
    return this.getPhotoUrl(photo);
  }

  getPhotoUrl(path?: string | null): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `${environment.apiBaseUrl}${clean}`;
  }

  onLogoError(event: any): void {
    event.target.src = '/assets/images/logo.png';
  }

  onStudentPhotoError(event: any): void {
    event.target.style.display = 'none';
    if (event.target.parentElement) {
      const fallback = event.target.parentElement.querySelector('.student-photo-fallback');
      if (fallback) fallback.style.display = 'flex';
    }
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'Paid': return 'Paid (पूर्ण)';
      case 'Settled': return 'Settled (समाधान / माफ)';
      case 'Cancelled': return 'Cancelled (रद्द)';
      case 'PartiallyPaid': return 'Partial (आंशिक)';
      case 'Overdue': return 'Overdue (अतिदेय)';
      case 'Due': return 'Due (देय)';
      case 'Upcoming': return 'Upcoming (आगामी)';
      case 'N/A': return 'N/A (पूर्व नामांकन)';
      default: return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Paid': return 'pill-paid';
      case 'Settled': return 'pill-settled';
      case 'Cancelled': return 'pill-cancelled';
      case 'PartiallyPaid': return 'pill-partially';
      case 'Overdue': return 'pill-overdue';
      case 'Due': return 'pill-due';
      case 'Upcoming': return 'pill-upcoming';
      case 'N/A': return 'pill-na';
      default: return 'pill-upcoming';
    }
  }

  openWhatsAppShareDialog(card?: StudentFeeCard): void {
    const targetCard = card || this.currentCard;
    if (!targetCard) return;

    this.dialog.open(WhatsAppFeeCardDialogComponent, {
      width: '620px',
      maxWidth: '95vw',
      panelClass: 'whatsapp-fee-card-dialog-container',
      data: { card: targetCard }
    });
  }

  copyWhatsAppSummary(card?: StudentFeeCard): void {
    this.openWhatsAppShareDialog(card);
  }
}
