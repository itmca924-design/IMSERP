import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LibraryService, LibraryCirculationDto, BookCopyDto, LibrarySettingDto } from '../../core/services/library.service';
import { CoachingService } from '../../core/services/coaching.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-library-circulation',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  template: `
    <div class="circ-container">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h2 class="page-title">
            <mat-icon class="title-icon">sync_alt</mat-icon>
            Library Circulation Desk
          </h2>
          <p class="page-subtitle">
            Fast barcode issue/return counter, live overdue tracking, late fine settlement, and WhatsApp reminders.
          </p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button routerLink="/library/plans" class="catalog-link-btn">
            <mat-icon>schedule</mat-icon> Shifts &amp; Plans
          </a>
          <a mat-stroked-button routerLink="/library/books" class="catalog-link-btn">
            <mat-icon>local_library</mat-icon> Books Catalog
          </a>
        </div>
      </div>

      <!-- Quick Desk Tabs: Issue / Return / Ledger -->
      <div class="desk-tabs">
        <button type="button" class="desk-tab" [class.active]="activeDeskTab === 'issue'" (click)="activeDeskTab = 'issue'">
          <mat-icon>arrow_upward</mat-icon>
          <span>Issue Book Counter</span>
        </button>
        <button type="button" class="desk-tab" [class.active]="activeDeskTab === 'return'" (click)="activeDeskTab = 'return'">
          <mat-icon>arrow_downward</mat-icon>
          <span>Return Book Counter</span>
        </button>
        <button type="button" class="desk-tab" [class.active]="activeDeskTab === 'ledger'" (click)="activeDeskTab = 'ledger'">
          <mat-icon>format_list_bulleted</mat-icon>
          <span>Issued Ledger &amp; Overdue</span>
          <span class="badge-count" *ngIf="overdueCount > 0">{{ overdueCount }} Overdue</span>
        </button>
      </div>

      <!-- 1. Quick Issue Desk -->
      <mat-card *ngIf="activeDeskTab === 'issue'" class="desk-card mat-elevation-z2">
        <div class="desk-card-header">
          <div class="dch-title">
            <mat-icon color="primary">add_shopping_cart</mat-icon>
            <div>
              <h3>Fast Book Issue Counter</h3>
              <p>Scan or enter Book Accession barcode and select student / faculty member.</p>
            </div>
          </div>
        </div>

        <div class="desk-grid">
          <!-- Left: Book Barcode Lookup -->
          <div class="desk-section">
            <span class="ds-title">Step 1: Pick Available Book or Scan Barcode</span>

            <!-- Available Books Shelf Dropdown Filter -->
            <mat-form-field appearance="outline" class="full-width" style="margin-bottom: 8px;">
              <mat-label>📚 Select Available Book from Shelf</mat-label>
              <mat-select [(ngModel)]="selectedAvailableAccession" (selectionChange)="onAvailableBookSelected($event.value)" placeholder="Browse books currently on shelf..." panelClass="batch-filter-panel">
                <mat-option *ngFor="let copy of availableCopies" [value]="copy.accessionNumber">
                  📖 <strong>{{ copy.bookTitle }}</strong> &bull; Accession: <code>{{ copy.accessionNumber }}</code> ({{ copy.author }})
                </mat-option>
              </mat-select>
              <mat-hint>Choose from {{ availableCopies.length }} books currently available on shelf, or scan barcode below</mat-hint>
            </mat-form-field>

            <div class="lookup-row" style="margin-top: 6px;">
              <mat-form-field appearance="outline" class="flex-grow">
                <mat-label>Accession Number / Barcode</mat-label>
                <input matInput [(ngModel)]="issueAccession" (keyup.enter)="lookupBookForIssue()" placeholder="e.g. ACC-00001" />
                <mat-icon matSuffix>qr_code_scanner</mat-icon>
              </mat-form-field>
              <button mat-raised-button color="primary" class="btn-lookup" (click)="lookupBookForIssue()" [disabled]="!issueAccession">
                Scan / Check
              </button>
            </div>

            <!-- Book Verified Card -->
            <div class="verified-card" *ngIf="verifiedBook">
              <div class="vc-top">
                <span class="vc-badge">{{ verifiedBook.status }}</span>
                <span class="vc-rack"><mat-icon>shelves</mat-icon> {{ verifiedBook.rackLocation || 'Shelf General' }}</span>
              </div>
              <h4 class="vc-title">{{ verifiedBook.bookTitle }}</h4>
              <p class="vc-author">By {{ verifiedBook.author }} &bull; Accession: <strong>{{ verifiedBook.accessionNumber }}</strong></p>
            </div>
          </div>

          <!-- Right: Member Selection & Issue Details -->
          <div class="desk-section">
            <span class="ds-title">Step 2: Borrower &amp; Loan Duration</span>

            <!-- Member Type Switcher -->
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
              <button type="button" class="lp-pill" [class.active]="issueMemberType === 'Student'" (click)="setIssueMemberType('Student')">
                <mat-icon>school</mat-icon> Student
              </button>
              <button type="button" class="lp-pill" [class.active]="issueMemberType === 'Teacher'" (click)="setIssueMemberType('Teacher')">
                <mat-icon>co_present</mat-icon> Faculty / Teacher
              </button>
            </div>

            <!-- Student Picker -->
            <div *ngIf="issueMemberType === 'Student'">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Select Enrolled Student</mat-label>
                <mat-select [(ngModel)]="issueStudentId" panelClass="batch-filter-panel">
                  <mat-option *ngFor="let s of students" [value]="s.id">
                    <div class="borrower-opt">
                      <span class="borrower-opt-name">{{ s.studentName }}</span>
                      <span class="borrower-opt-id">({{ s.coachingRollNumber || s.rollNumber }}{{ s.admissionNumber ? ' • Adm: ' + s.admissionNumber : '' }})</span>
                      <span *ngIf="s.isLibraryMember" class="b-pill-member">📚 Member (Limit: {{ s.maxLibraryBooks || 2 }})</span>
                      <span *ngIf="!s.isLibraryMember" class="b-pill-non">Non-Member</span>
                    </div>
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <!-- Borrower Library Membership Summary Card -->
              <div class="borrower-summary-card" *ngIf="selectedStudentForIssue">
                <div class="bsc-badge-row">
                  <span class="bsc-status-pill" [class.is-member]="selectedStudentForIssue.isLibraryMember" [class.is-non-member]="!selectedStudentForIssue.isLibraryMember">
                    <mat-icon>{{ selectedStudentForIssue.isLibraryMember ? 'verified' : 'block' }}</mat-icon>
                    {{ selectedStudentForIssue.isLibraryMember ? 'Active Library Member' : 'Non-Member (Membership Required)' }}
                  </span>
                  <span class="bsc-limit-pill" *ngIf="selectedStudentForIssue.isLibraryMember">
                    Borrow Limit: <strong>{{ selectedStudentForIssue.maxLibraryBooks || 2 }} Books</strong>
                  </span>
                </div>
                <div class="bsc-details-grid" *ngIf="selectedStudentForIssue.isLibraryMember">
                  <div class="bsc-item">
                    <span class="bsc-lbl">Library Card / Barcode:</span>
                    <strong class="bsc-val">{{ selectedStudentForIssue.libraryCardNumber || 'Card Not Assigned' }}</strong>
                  </div>
                  <div class="bsc-item">
                    <span class="bsc-lbl">Shift / Facility:</span>
                    <strong class="bsc-val">{{ selectedStudentForIssue.libraryMembershipType || 'Standard Book Lending' }}</strong>
                  </div>
                  <div class="bsc-item" *ngIf="selectedStudentForIssue.monthlyLibraryFee > 0">
                    <span class="bsc-lbl">Monthly Reading Fee:</span>
                    <strong class="bsc-val">₹{{ selectedStudentForIssue.monthlyLibraryFee | number }}/mo</strong>
                  </div>
                </div>
                <div class="bsc-non-member-box" *ngIf="!selectedStudentForIssue.isLibraryMember">
                  <div class="bsc-non-content">
                    <mat-icon class="bsc-warn-ico">warning_amber</mat-icon>
                    <div class="bsc-warn-texts">
                      <span class="bsc-warn-heading">Membership Required to Borrow</span>
                      <p class="bsc-warn-desc">Student has not enrolled in a Library Membership Plan. Book circulation is restricted to registered members only.</p>
                    </div>
                  </div>
                  <a mat-stroked-button color="primary" class="btn-assign-mem" routerLink="/students" target="_blank">
                    <mat-icon>card_membership</mat-icon>
                    <span>Assign Membership in Students</span>
                  </a>
                </div>
              </div>
            </div>

            <!-- Teacher Picker -->
            <div *ngIf="issueMemberType === 'Teacher'">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Select Faculty Member</mat-label>
                <mat-select [(ngModel)]="issueTeacherId" panelClass="batch-filter-panel">
                  <mat-option *ngFor="let t of teachers" [value]="t.id">
                    <div class="borrower-opt">
                      <span class="borrower-opt-name">{{ t.fullName }}</span>
                      <span class="borrower-opt-id">({{ t.employeeCode }} &bull; {{ t.specialization || 'Faculty' }})</span>
                      <span class="b-pill-member">👨‍🏫 Faculty Privileges</span>
                    </div>
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <div class="borrower-summary-card" *ngIf="selectedTeacherForIssue">
                <div class="bsc-badge-row">
                  <span class="bsc-status-pill is-member">
                    <mat-icon>verified</mat-icon> Verified Faculty Member
                  </span>
                  <span class="bsc-limit-pill">
                    Faculty Loan: <strong>{{ settings?.maxBooksPerTeacher || 5 }} Books Max</strong>
                  </span>
                </div>
                <div class="bsc-details-grid">
                  <div class="bsc-item">
                    <span class="bsc-lbl">Employee Code:</span>
                    <strong class="bsc-val">{{ selectedTeacherForIssue.employeeCode }}</strong>
                  </div>
                  <div class="bsc-item">
                    <span class="bsc-lbl">Specialization:</span>
                    <strong class="bsc-val">{{ selectedTeacherForIssue.specialization || 'General' }}</strong>
                  </div>
                  <div class="bsc-item">
                    <span class="bsc-lbl">Phone Number:</span>
                    <strong class="bsc-val">{{ selectedTeacherForIssue.phoneNumber }}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div class="duration-row">
              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Loan Duration (Days)</mat-label>
                <input matInput type="number" [(ngModel)]="issueDays" min="1" max="90" />
                <mat-hint>{{ issueMemberType === 'Teacher' ? 'Faculty Policy: ' + (settings?.teacherIssueDays || 30) : 'Student Policy: ' + (settings?.studentIssueDays || 14) }} days</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-2">
                <mat-label>Remarks / Issue Notes</mat-label>
                <input matInput [(ngModel)]="issueRemarks" placeholder="Optional notes" />
              </mat-form-field>
            </div>

            <div class="issue-action-bar">
              <button mat-raised-button color="primary" class="btn-confirm-issue" (click)="confirmIssue()" [disabled]="!verifiedBook || verifiedBook.status !== 'Available' || (issueMemberType === 'Student' && (!issueStudentId || !selectedStudentForIssue?.isLibraryMember)) || (issueMemberType === 'Teacher' && !issueTeacherId) || issueSubmitting">
                <mat-icon>{{ (issueMemberType === 'Student' && selectedStudentForIssue && !selectedStudentForIssue.isLibraryMember) ? 'lock' : 'check_circle' }}</mat-icon>
                <span>{{ (issueMemberType === 'Student' && selectedStudentForIssue && !selectedStudentForIssue.isLibraryMember) ? 'Membership Required to Issue' : 'Confirm & Issue Book' }}</span>
              </button>
            </div>
          </div>
        </div>
      </mat-card>

      <!-- 2. Quick Return Desk -->
      <mat-card *ngIf="activeDeskTab === 'return'" class="desk-card mat-elevation-z2">
        <div class="desk-card-header">
          <div class="dch-title">
            <mat-icon color="primary">assignment_returned</mat-icon>
            <div>
              <h3>Fast Book Return &amp; Fine Settlement</h3>
              <p>Scan returned book barcode to auto-calculate overdue days and collect late fines.</p>
            </div>
          </div>
        </div>

        <div class="return-flow-box">
          <div class="lookup-row return-search-row">
            <mat-form-field appearance="outline" class="search-input">
              <mat-label>Scan Book Accession Barcode to Return</mat-label>
              <input matInput [(ngModel)]="returnAccession" (keyup.enter)="lookupForReturn()" placeholder="e.g. ACC-00101" />
              <mat-icon matSuffix>qr_code_scanner</mat-icon>
            </mat-form-field>
            <button mat-raised-button color="primary" class="btn-lookup" (click)="lookupForReturn()" [disabled]="!returnAccession">
              Fetch Issue Record
            </button>
          </div>

          <!-- Return Details Card -->
          <div class="return-record-card" *ngIf="returnCirculation">
            <div class="rrc-grid">
              <div class="rrc-col">
                <div class="col-lbl">Book Details</div>
                <div class="col-val-title">{{ returnCirculation.bookTitle }}</div>
                <div class="col-sub">Acc No: <strong>{{ returnCirculation.accessionNumber }}</strong> &bull; Rack: {{ returnCirculation.rackLocation }}</div>
              </div>

              <div class="rrc-col">
                <div class="col-lbl">Borrower</div>
                <div class="col-val">{{ returnCirculation.studentName || returnCirculation.teacherName }}</div>
                <div class="col-sub">{{ returnCirculation.studentClassName ? 'Class: ' + returnCirculation.studentClassName : '' }} {{ returnCirculation.studentBatchName ? '• Batch: ' + returnCirculation.studentBatchName : '' }}</div>
              </div>

              <div class="rrc-col">
                <div class="col-lbl">Due Date &amp; Overdue</div>
                <div class="col-val">{{ returnCirculation.dueDate | date:'dd MMM yyyy' }}</div>
                <div class="overdue-tag" [class.is-late]="returnCirculation.overdueDays > 0">
                  {{ returnCirculation.overdueDays > 0 ? (returnCirculation.overdueDays + ' Days Overdue!') : 'On-Time Return ✓' }}
                </div>
              </div>

              <div class="rrc-col fine-col">
                <div class="col-lbl">Late Fine / Penalty (₹)</div>
                <div class="fine-edit-row">
                  <input type="number" [(ngModel)]="customFineAmount" class="fine-input" min="0" placeholder="0" (ngModelChange)="onFineAmountChange($event)" />
                  <mat-select [(ngModel)]="finePaymentStatus" class="fine-select">
                    <mat-option value="None">None (₹0)</mat-option>
                    <mat-option value="Pending">Pending (Add to Fee Dues)</mat-option>
                    <mat-option value="Paid">Paid at Counter (Cash)</mat-option>
                    <mat-option value="Waived">Waived / Excused</mat-option>
                  </mat-select>
                </div>
              </div>
            </div>

            <div class="return-btn-bar">
              <button mat-raised-button color="primary" class="btn-confirm-return" (click)="confirmReturn()" [disabled]="returnSubmitting">
                <mat-icon>done_all</mat-icon>
                <span>Confirm Return &amp; Restock to Shelf</span>
              </button>
            </div>
          </div>
        </div>
      </mat-card>

      <!-- 3. Issued Ledger & Overdue List -->
      <mat-card *ngIf="activeDeskTab === 'ledger'" class="desk-card mat-elevation-z2">
        <div class="ledger-toolbar">
          <div class="ledger-pill-group">
            <button type="button" class="lp-pill" [class.active]="!ledgerOverdueOnly" (click)="setOverdueFilter(false)">
              All Active Issues ({{ circulations.length }})
            </button>
            <button type="button" class="lp-pill overdue-pill" [class.active]="ledgerOverdueOnly" (click)="setOverdueFilter(true)">
              <mat-icon>warning</mat-icon>
              Overdue Only ({{ overdueCount }})
            </button>
          </div>

          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search Book, Student, Roll No...</mat-label>
            <input matInput [(ngModel)]="ledgerSearchTerm" (keyup.enter)="loadCirculations()" placeholder="Search..." />
            <button mat-icon-button matSuffix (click)="loadCirculations()"><mat-icon>search</mat-icon></button>
          </mat-form-field>
        </div>

        <mat-progress-bar mode="indeterminate" *ngIf="loadingCircs"></mat-progress-bar>

        <div class="ledger-table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                <th>Accession / Book Title</th>
                <th>Borrower (Student / Faculty)</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Status / Overdue</th>
                <th>Late Fine</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of circulations">
                <td>
                  <div class="bk-title">{{ c.bookTitle }}</div>
                  <div class="bk-acc">Acc: <strong>{{ c.accessionNumber }}</strong> &bull; {{ c.rackLocation }}</div>
                </td>
                <td>
                  <div class="borrower-name">
                    {{ c.studentName || c.teacherName }}
                    <span *ngIf="c.memberType === 'Teacher'" style="background: #faf5ff; color: #7e22ce; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; margin-left: 6px;">Faculty</span>
                  </div>
                  <div class="borrower-meta">
                    <span *ngIf="c.studentRollNumber">Roll: {{ c.studentRollNumber }}</span>
                    <span *ngIf="c.studentClassName">&bull; {{ c.studentClassName }}</span>
                    <span *ngIf="c.studentBatchName">&bull; {{ c.studentBatchName }}</span>
                    <span *ngIf="c.teacherEmployeeCode">Emp Code: {{ c.teacherEmployeeCode }}</span>
                  </div>
                </td>
                <td>{{ c.issueDate | date:'dd MMM yyyy' }}</td>
                <td><strong>{{ c.dueDate | date:'dd MMM yyyy' }}</strong></td>
                <td>
                  <span class="circ-status-pill" [class.overdue]="c.status === 'Overdue' || c.overdueDays > 0">
                    {{ c.overdueDays > 0 ? (c.overdueDays + ' Days Overdue') : 'Active Loan' }}
                  </span>
                </td>
                <td>
                  <span *ngIf="c.fineAmount > 0" class="fine-badge">₹{{ c.fineAmount }}</span>
                  <span *ngIf="c.fineAmount === 0" class="text-muted">₹0</span>
                </td>
                <td>
                  <div class="action-btn-row">
                    <!-- WhatsApp Reminder for Overdue -->
                    <a *ngIf="c.parentWhatsAppPhone && c.overdueDays > 0"
                       mat-icon-button
                       class="btn-wa"
                       [href]="getWhatsAppUrl(c)"
                       target="_blank"
                       matTooltip="Send Overdue WhatsApp Reminder to Parent">
                      <mat-icon>chat</mat-icon>
                    </a>
                    <button mat-stroked-button color="primary" class="btn-quick-return" (click)="quickReturnFromRow(c)" matTooltip="Return this book">
                      <mat-icon>arrow_downward</mat-icon> Return
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="!loadingCircs && circulations.length === 0">
                <td colspan="7" class="no-records">No active issued records found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .circ-container { display: flex; flex-direction: column; gap: 16px; }
    .page-header {
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
      .page-title { font-size: 1.5rem; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 10px; }
      .title-icon { color: #2563eb; font-size: 1.7rem; width: 1.7rem; height: 1.7rem; }
      .page-subtitle { color: #64748b; margin: 4px 0 0; font-size: 0.88rem; }
    }
    .catalog-link-btn {
      color: #2563eb !important; border-color: #93c5fd !important; font-weight: 600;
      mat-icon { margin-right: 4px; }
    }

    /* Desk Switcher Tabs */
    .desk-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
    .desk-tab {
      display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border: 1px solid #e2e8f0;
      background: #ffffff; border-radius: 20px; font-size: 0.88rem; font-weight: 600; color: #475569;
      cursor: pointer; transition: all 0.15s ease;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      .badge-count { background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 12px; font-size: 0.72rem; font-weight: 700; }
      &:hover { background: #f8fafc; border-color: #cbd5e1; }
      &.active {
        background: #1e3a8a; color: #ffffff; border-color: #1e3a8a;
        box-shadow: 0 4px 12px rgba(30,58,138,0.2);
        mat-icon { color: #ffffff; }
      }
    }

    /* Desk Card Layout */
    .desk-card {
      border-radius: 12px; padding: 20px;
      .desk-card-header {
        border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; margin-bottom: 16px;
        .dch-title {
          display: flex; align-items: center; gap: 10px;
          mat-icon { font-size: 26px; width: 26px; height: 26px; }
          h3 { margin: 0; font-size: 1.15rem; color: #0f172a; font-weight: 700; }
          p { margin: 2px 0 0; color: #64748b; font-size: 0.82rem; }
        }
      }
    }

    .desk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .desk-section {
      display: flex; flex-direction: column; gap: 12px;
      .ds-title { font-weight: 700; font-size: 0.92rem; color: #1e293b; }
    }

    .lookup-row { display: flex; gap: 10px; align-items: center; }
    .flex-grow { flex: 1; margin-bottom: -16px; }
    .btn-lookup { height: 48px; min-width: 120px; font-weight: 600; }

    .verified-card {
      background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 14px;
      display: flex; flex-direction: column; gap: 4px;
      .vc-top { display: flex; justify-content: space-between; align-items: center; }
      .vc-badge { background: #dcfce7; color: #15803d; font-size: 0.72rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
      .vc-rack { display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; color: #047857; mat-icon { font-size: 14px; width: 14px; height: 14px; } }
      .vc-title { margin: 4px 0 0; font-size: 1rem; color: #14532d; font-weight: 700; }
      .vc-author { margin: 0; font-size: 0.8rem; color: #166534; }
    }

    .duration-row { display: flex; gap: 12px; }
    .flex-1 { flex: 1; }
    .flex-2 { flex: 2; }
    .full-width { width: 100%; margin-bottom: -16px; }

    .issue-action-bar { display: flex; justify-content: flex-end; margin-top: 10px; }
    .btn-confirm-issue { height: 44px; padding: 0 20px; font-weight: 700; font-size: 0.9rem; mat-icon { margin-right: 4px; } }

    /* Return Counter Box */
    .return-flow-box { display: flex; flex-direction: column; gap: 16px; }
    .return-search-row { max-width: 580px; }
    .search-input { flex: 1; margin-bottom: -16px; }

    .return-record-card {
      background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px;
      display: flex; flex-direction: column; gap: 16px;
      .rrc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
      .col-lbl { font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; }
      .col-val-title { font-size: 1.05rem; font-weight: 700; color: #0f172a; }
      .col-val { font-size: 0.95rem; font-weight: 700; color: #1e293b; }
      .col-sub { font-size: 0.78rem; color: #64748b; margin-top: 2px; }
      .overdue-tag {
        display: inline-block; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: #dcfce7; color: #15803d;
        &.is-late { background: #fee2e2; color: #dc2626; }
      }
      .fine-val { font-size: 1.25rem; font-weight: 800; color: #dc2626; }
      .fine-edit-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 4px;
        .fine-input {
          width: 100%;
          padding: 6px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          font-weight: 700;
          font-size: 1rem;
          color: #dc2626;
          background: #ffffff;
          box-sizing: border-box;
          &:focus { outline: none; border-color: #3b82f6; }
        }
      }
      .fine-select { font-size: 0.82rem; }
      .return-btn-bar { display: flex; justify-content: flex-end; border-top: 1px solid #e2e8f0; padding-top: 14px; }
      .btn-confirm-return { height: 44px; padding: 0 20px; font-weight: 700; mat-icon { margin-right: 4px; } }
    }

    /* Issued Ledger Table */
    .ledger-toolbar {
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;
      .ledger-pill-group { display: flex; gap: 8px; }
      .lp-pill {
        padding: 6px 14px; border: 1px solid #e2e8f0; background: #ffffff; border-radius: 16px; font-size: 0.82rem; font-weight: 600; cursor: pointer;
        display: inline-flex; align-items: center; gap: 4px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
        &.active { background: #0f172a; color: #ffffff; border-color: #0f172a; }
        &.overdue-pill.active { background: #dc2626; border-color: #dc2626; }
      }
      .search-field { width: 300px; margin-bottom: -16px; }
    }

    .ledger-table-wrap {
      border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;
      .ledger-table {
        width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;
        th { background: #f8fafc; color: #475569; font-weight: 700; padding: 10px 14px; border-bottom: 1px solid #e2e8f0; }
        td { padding: 10px 14px; border-top: 1px solid #f1f5f9; }
        .bk-title { font-weight: 700; color: #0f172a; }
        .bk-acc { font-size: 0.74rem; color: #64748b; }
        .borrower-name { font-weight: 600; color: #1e293b; }
        .borrower-meta { font-size: 0.74rem; color: #64748b; }
        .circ-status-pill {
          padding: 2px 8px; border-radius: 10px; font-size: 0.72rem; font-weight: 700; background: #e0f2fe; color: #0369a1;
          &.overdue { background: #fee2e2; color: #b91c1c; }
        }
        .fine-badge { font-weight: 700; color: #dc2626; }
        .action-btn-row { display: flex; align-items: center; gap: 6px; }
        .btn-wa { color: #16a34a !important; }
        .btn-quick-return { height: 30px; font-size: 0.75rem; font-weight: 600; padding: 0 10px; mat-icon { font-size: 15px; width: 15px; height: 15px; } }
        .no-records { text-align: center; color: #94a3b8; padding: 30px; }
      }
    }

    /* Borrower Select Option & Summary Card */
    .borrower-opt {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.88rem;
      width: 100%;
      .borrower-opt-name { font-weight: 600; color: #1e293b; }
      .borrower-opt-id { color: #64748b; font-size: 0.8rem; }
      .b-pill-member {
        margin-left: auto;
        font-size: 0.72rem;
        font-weight: 700;
        background: #ecfdf5;
        color: #047857;
        border: 1px solid #a7f3d0;
        padding: 1px 8px;
        border-radius: 10px;
      }
      .b-pill-non {
        margin-left: auto;
        font-size: 0.72rem;
        font-weight: 600;
        background: #f8fafc;
        color: #64748b;
        border: 1px solid #cbd5e1;
        padding: 1px 8px;
        border-radius: 10px;
      }
    }

    .borrower-summary-card {
      margin-bottom: 14px;
      padding: 12px 14px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;

      .bsc-badge-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;

        .bsc-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 0.76rem;
          font-weight: 700;
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #cbd5e1;
          mat-icon { font-size: 14px; width: 14px; height: 14px; }

          &.is-member {
            background: #ecfdf5;
            color: #047857;
            border-color: #6ee7b7;
          }

          &.is-non-member {
            background: #fef2f2;
            color: #b91c1c;
            border-color: #fca5a5;
          }
        }

        .bsc-limit-pill {
          font-size: 0.78rem;
          color: #1e40af;
          background: #eff6ff;
          padding: 2px 8px;
          border-radius: 6px;
          border: 1px solid #bfdbfe;
        }
      }

      .bsc-details-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 8px;
        font-size: 0.8rem;
        background: #ffffff;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid #f1f5f9;

        .bsc-item {
          display: flex;
          flex-direction: column;
          gap: 1px;
          .bsc-lbl { font-size: 0.7rem; color: #64748b; }
          .bsc-val { color: #0f172a; font-weight: 600; }
        }
      }

      .bsc-non-member-box {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        background: #fff1f2;
        border: 1px dashed #fca5a5;
        border-radius: 6px;

        .bsc-non-content {
          display: flex;
          align-items: center;
          gap: 10px;

          .bsc-warn-ico {
            color: #e11d48;
            font-size: 22px;
            width: 22px;
            height: 22px;
          }

          .bsc-warn-texts {
            display: flex;
            flex-direction: column;
            gap: 2px;

            .bsc-warn-heading {
              font-size: 0.82rem;
              font-weight: 700;
              color: #9f1239;
            }

            .bsc-warn-desc {
              margin: 0;
              font-size: 0.76rem;
              color: #be123c;
            }
          }
        }

        .btn-assign-mem {
          height: 32px;
          font-size: 0.76rem;
          font-weight: 700;
          color: #2563eb;
          border-color: #93c5fd;
          background: #ffffff;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
        }
      }
    }
  `]
})
export class LibraryCirculationComponent implements OnInit {
  activeDeskTab: 'issue' | 'return' | 'ledger' = 'issue';

  circulations: LibraryCirculationDto[] = [];
  students: any[] = [];
  teachers: any[] = [];
  settings: LibrarySettingDto | null = null;
  overdueCount = 0;
  loadingCircs = false;

  // Issue Desk Fields
  issueMemberType: 'Student' | 'Teacher' = 'Student';
  issueAccession = '';
  verifiedBook: BookCopyDto | null = null;
  issueStudentId: string | null = null;
  issueTeacherId: string | null = null;
  issueDays = 14;
  issueRemarks = '';
  issueSubmitting = false;

  // Return Desk Fields
  returnAccession = '';
  returnCirculation: LibraryCirculationDto | null = null;
  customFineAmount = 0;
  finePaymentStatus = 'None';
  returnSubmitting = false;

  // Ledger Filter
  ledgerOverdueOnly = false;
  ledgerSearchTerm = '';

  // Available books shelf picker
  availableCopies: BookCopyDto[] = [];
  selectedAvailableAccession = '';

  constructor(
    private libraryService: LibraryService,
    private coachingService: CoachingService,
    private confirmDialog: ConfirmDialogService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.loadStudents();
    this.loadTeachers();
    this.loadCirculations();
    this.loadAvailableCopies();
  }

  setIssueMemberType(type: 'Student' | 'Teacher'): void {
    this.issueMemberType = type;
    if (type === 'Teacher') {
      this.issueDays = this.settings?.teacherIssueDays || 30;
    } else {
      this.issueDays = this.settings?.studentIssueDays || 14;
    }
  }

  loadAvailableCopies(): void {
    this.libraryService.getAvailableCopies().subscribe({
      next: (copies) => this.availableCopies = copies || [],
      error: (err) => console.error('Failed to load available book copies', err)
    });
  }

  onAvailableBookSelected(accession: string): void {
    if (!accession) return;
    this.issueAccession = accession;
    this.lookupBookForIssue();
  }

  loadSettings(): void {
    this.libraryService.getSettings().subscribe(s => {
      this.settings = s;
      if (s) {
        this.issueDays = this.issueMemberType === 'Teacher' ? (s.teacherIssueDays || 30) : (s.studentIssueDays || 14);
      }
    });
  }

  loadStudents(): void {
    this.coachingService.getStudents().subscribe(res => {
      this.students = (res || []).map((s: any) => ({
        ...s,
        isLibraryMember: !!(s.isLibraryMember ?? s.IsLibraryMember),
        libraryCardNumber: s.libraryCardNumber || s.LibraryCardNumber,
        libraryMembershipType: s.libraryMembershipType || s.LibraryMembershipType,
        maxLibraryBooks: s.maxLibraryBooks ?? s.MaxLibraryBooks ?? 2,
        monthlyLibraryFee: s.monthlyLibraryFee ?? s.MonthlyLibraryFee ?? 0
      }));
    });
  }

  loadTeachers(): void {
    this.http.get<any[]>('http://localhost:5000/api/teachers?activeOnly=true').subscribe({
      next: (res) => this.teachers = res || [],
      error: (err) => console.error('Failed to load teachers for library circulation', err)
    });
  }

  get selectedStudentForIssue(): any {
    if (!this.issueStudentId) return null;
    return this.students.find(s => s.id === this.issueStudentId) || null;
  }

  get selectedTeacherForIssue(): any {
    if (!this.issueTeacherId) return null;
    return this.teachers.find(t => t.id === this.issueTeacherId) || null;
  }

  loadCirculations(): void {
    this.loadingCircs = true;
    this.libraryService.getActiveCirculations({
      overdueOnly: this.ledgerOverdueOnly,
      searchTerm: this.ledgerSearchTerm || undefined
    }).subscribe({
      next: (res) => {
        this.circulations = res || [];
        this.overdueCount = this.circulations.filter(c => c.overdueDays > 0).length;
        this.loadingCircs = false;
      },
      error: () => {
        this.circulations = [];
        this.loadingCircs = false;
      }
    });
  }

  setOverdueFilter(overdueOnly: boolean): void {
    this.ledgerOverdueOnly = overdueOnly;
    this.loadCirculations();
  }

  // --- Issue Book Flow ---

  lookupBookForIssue(): void {
    if (!this.issueAccession) return;
    this.libraryService.lookupCopy(this.issueAccession.trim()).subscribe({
      next: (copy) => {
        this.verifiedBook = copy;
      },
      error: (err) => {
        this.verifiedBook = null;
        this.confirmDialog.alert('Book Not Found', err?.error?.message || 'Accession not found.', 'warning');
      }
    });
  }

  confirmIssue(): void {
    if (!this.verifiedBook) return;

    if (this.issueMemberType === 'Student') {
      if (!this.issueStudentId) return;
      const student = this.selectedStudentForIssue;
      if (student && !student.isLibraryMember) {
        this.confirmDialog.alert(
          'Library Membership Required',
          `Student "${student.studentName}" is not an active library member. Please assign a Library Membership Plan from Students Module before issuing books.`,
          'danger'
        );
        return;
      }
    } else {
      if (!this.issueTeacherId) return;
    }

    this.executeIssue();
  }

  private executeIssue(): void {
    if (!this.verifiedBook) return;
    if (this.issueMemberType === 'Student' && !this.issueStudentId) return;
    if (this.issueMemberType === 'Teacher' && !this.issueTeacherId) return;
    this.issueSubmitting = true;

    this.libraryService.issueBook({
      accessionNumber: this.verifiedBook.accessionNumber,
      studentId: this.issueMemberType === 'Student' ? this.issueStudentId! : undefined,
      teacherId: this.issueMemberType === 'Teacher' ? this.issueTeacherId! : undefined,
      memberType: this.issueMemberType,
      customDueDays: this.issueDays,
      remarks: this.issueRemarks
    }).subscribe({
      next: (res) => {
        this.issueSubmitting = false;
        const msg = res?.message || 'Book issued successfully!';
        this.confirmDialog.alert('Book Issued', msg, 'success');
        this.issueAccession = '';
        this.selectedAvailableAccession = '';
        this.verifiedBook = null;
        this.issueRemarks = '';
        this.loadCirculations();
        this.loadAvailableCopies();
      },
      error: (err) => {
        this.issueSubmitting = false;
        this.confirmDialog.alert('Issue Failed', err?.error?.message || 'Could not issue book.', 'danger');
      }
    });
  }

  // --- Return Book Flow ---

  lookupForReturn(): void {
    if (!this.returnAccession) return;
    this.libraryService.getActiveCirculations({ searchTerm: this.returnAccession.trim() }).subscribe({
      next: (res) => {
        const found = res?.find(c => c.accessionNumber.toLowerCase() === this.returnAccession.trim().toLowerCase());
        if (found) {
          this.returnCirculation = found;
          this.customFineAmount = found.fineAmount || 0;
          this.finePaymentStatus = found.fineAmount > 0 ? 'Pending' : 'None';
        } else {
          this.returnCirculation = null;
          this.confirmDialog.alert('Not Found', `No active loan found for accession '${this.returnAccession}'.`, 'warning');
        }
      },
      error: () => {
        this.returnCirculation = null;
      }
    });
  }

  onFineAmountChange(val: number): void {
    if (val > 0 && this.finePaymentStatus === 'None') {
      this.finePaymentStatus = 'Pending';
    } else if (!val || val <= 0) {
      this.finePaymentStatus = 'None';
    }
  }

  confirmReturn(): void {
    if (!this.returnCirculation) return;
    this.returnSubmitting = true;

    this.libraryService.returnBook({
      accessionNumber: this.returnCirculation.accessionNumber,
      collectedFineAmount: this.customFineAmount,
      finePaymentStatus: this.finePaymentStatus
    }).subscribe({
      next: (res) => {
        this.returnSubmitting = false;
        this.confirmDialog.alert('Book Returned', res?.message || 'Book returned to shelf.', 'success');
        this.returnAccession = '';
        this.returnCirculation = null;
        this.customFineAmount = 0;
        this.finePaymentStatus = 'None';
        this.loadCirculations();
        this.loadAvailableCopies();
      },
      error: (err) => {
        this.returnSubmitting = false;
        this.confirmDialog.alert('Return Failed', err?.error?.message || 'Failed to return book.', 'danger');
      }
    });
  }

  quickReturnFromRow(c: LibraryCirculationDto): void {
    this.returnAccession = c.accessionNumber;
    this.returnCirculation = c;
    this.finePaymentStatus = c.fineAmount > 0 ? 'Paid' : 'None';
    this.activeDeskTab = 'return';
  }

  getWhatsAppUrl(c: LibraryCirculationDto): string {
    const phone = (c.parentWhatsAppPhone || '').replace(/\D/g, '');
    const cleanPhone = phone.startsWith('91') ? phone : `91${phone}`;
    const text = encodeURIComponent(
      `Dear Parent, Book "${c.bookTitle}" (Acc: ${c.accessionNumber}) issued to ${c.studentName} was due on ${c.dueDate.split('T')[0]} and is now overdue by ${c.overdueDays} days. Fine applicable: Rs ${c.fineAmount}. Please return it to the library.`
    );
    return `https://wa.me/${cleanPhone}?text=${text}`;
  }
}
