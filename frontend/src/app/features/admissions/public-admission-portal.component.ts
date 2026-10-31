import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { 
  PublicAdmissionsService, 
  PublicInstituteDetails, 
  PublicAdmissionResponse, 
  ApplicationTrackingResult,
  PublicClass,
  PublicBatch
} from '../../core/services/public-admissions.service';

@Component({
  selector: 'app-public-admission-portal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressBarModule,
    MatDividerModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  template: `
    <div class="portal-root">
      <!-- Top Branding Navigation Bar -->
      <header class="portal-header">
        <div class="header-container">
          <div class="brand-left">
            @if (institute?.profilePhoto) {
              <div class="brand-logo-wrap">
                <img [src]="$safeNavigationMigration(institute?.profilePhoto)" [alt]="$safeNavigationMigration(institute?.tenantName)" class="brand-img" />
              </div>
            } @else {
              <div class="brand-icon-box">
                <mat-icon>school</mat-icon>
              </div>
            }
            <div class="brand-text">
              <h1 class="institute-name">{{ institute?.tenantName || 'Online Admission Portal' }}</h1>
              @if (institute?.address) {
                <p class="institute-meta">
                  <mat-icon class="meta-icon">location_on</mat-icon> {{ institute?.address }}
                  @if (institute?.contactPhone) {
                    <span class="sep">•</span>
                  }
                  @if (institute?.contactPhone) {
                    <span><mat-icon class="meta-icon">call</mat-icon> {{ institute?.contactPhone }}</span>
                  }
                </p>
              }
            </div>
          </div>
    
          <div class="nav-actions">
            <button mat-stroked-button [class.btn-active]="activeTab === 'apply'" (click)="activeTab = 'apply'">
              <mat-icon>edit_note</mat-icon> Apply Online
            </button>
            <button mat-stroked-button [class.btn-active]="activeTab === 'track'" (click)="activeTab = 'track'">
              <mat-icon>search</mat-icon> Track Application
            </button>
            <button mat-flat-button color="primary" class="login-redirect-btn" (click)="goToLogin()">
              <mat-icon>lock</mat-icon> Staff Login
            </button>
          </div>
        </div>
      </header>
    
      <!-- Single Global Loader -->
      @if (loading) {
        <mat-progress-bar mode="indeterminate" class="portal-progress"></mat-progress-bar>
      }
    
      <main class="portal-main">
        <!-- Error Banner -->
        @if (errorMessage) {
          <div class="alert-box alert-danger">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>
        }
    
        <!-- ============================================================== -->
        <!-- VIEW 1: APPLICATION SUBMISSION SUCCESS SLIP                   -->
        <!-- ============================================================== -->
        @if (submittedResult && activeTab === 'apply') {
          <section class="success-section">
            <mat-card class="success-card print-slip">
              <div class="success-header">
                <div class="check-icon-circle">
                  <mat-icon>check_circle</mat-icon>
                </div>
                <h2 class="success-title">Application Submitted Successfully!</h2>
                <p class="success-subtitle">
                  Thank you, <strong>{{ submittedResult.studentName }}</strong>. Your admission application has been registered with <strong>{{ submittedResult.instituteName }}</strong>.
                </p>
              </div>
              <mat-divider></mat-divider>
              <div class="slip-details">
                <div class="ref-badge-deck">
                  <div class="ref-item">
                    <span class="ref-label">Application Reference No.</span>
                    <div class="ref-val-wrap">
                      <span class="ref-val">{{ submittedResult.applicationNumber }}</span>
                      <button mat-icon-button (click)="copyAppNumber(submittedResult.applicationNumber)" matTooltip="Copy Application Number">
                        <mat-icon>content_copy</mat-icon>
                      </button>
                    </div>
                  </div>
                  <div class="ref-item">
                    <span class="ref-label">Submission Date & Time (IST)</span>
                    <span class="ref-meta">{{ submittedResult.submissionDate }}</span>
                  </div>
                  @if (submittedResult.branchName) {
                    <div class="ref-item">
                      <span class="ref-label">Assigned Campus / Branch</span>
                      <span class="ref-meta">{{ submittedResult.branchName }}</span>
                    </div>
                  }
                </div>
                <div class="next-steps-panel">
                  <h4 class="steps-title"><mat-icon>info</mat-icon> Next Steps for Admission:</h4>
                  <ol class="steps-list">
                    <li>Keep this <strong>Application Number</strong> saved for all counseling, entrance tests, and fee payment queries.</li>
                    <li>Our admissions desk will verify your details and contact you via call or WhatsApp on the registered number.</li>
                    <li>You can track the status of your application anytime using the <strong>Track Application</strong> tab above.</li>
                  </ol>
                </div>
              </div>
              <div class="success-actions no-print">
                <button mat-raised-button color="primary" class="action-btn" (click)="printSlip()">
                  <mat-icon>print</mat-icon> Print Application Slip
                </button>
                <button mat-stroked-button class="action-btn" (click)="resetForm()">
                  <mat-icon>add_circle_outline</mat-icon> Submit Another Application
                </button>
              </div>
            </mat-card>
          </section>
        }
    
        <!-- ============================================================== -->
        <!-- VIEW 2: ONLINE ADMISSION APPLICATION FORM                      -->
        <!-- ============================================================== -->
        @if (!submittedResult && activeTab === 'apply') {
          <section class="form-section">
            <div class="form-hero">
              <span class="hero-chip">Academic Session Admissions Open</span>
              <h2 class="hero-title">Online Student Admission Application</h2>
              <p class="hero-desc">
                Fill in the application details carefully. Required fields are marked with an asterisk (<span class="req">*</span>).
              </p>
            </div>
            <form [formGroup]="admissionForm" (ngSubmit)="onSubmitApplication()" class="admission-form">
              <!-- SECTION 1: ADMISSION PREFERENCES -->
              <mat-card class="form-card">
                <div class="section-title-wrap">
                  <div class="section-badge">1</div>
                  <div>
                    <h3 class="section-title">Admission Stream & Campus Preferences</h3>
                    <p class="section-sub">Choose your admission stream (School Academic vs Coaching Batch) and select campus.</p>
                  </div>
                </div>
                <!-- Stream Selection Deck -->
                <div class="stream-selector-wrap">
                  <label class="stream-label">Select Admission Stream / Type <span class="req">*</span></label>
                  <div class="stream-btn-deck">
                    <button type="button"
                      class="stream-type-btn"
                      [class.active]="admissionForm.get('admissionStream')?.value === 'School'"
                      (click)="setStream('School')">
                      <div class="stream-icon-box school-box">
                        <mat-icon>school</mat-icon>
                      </div>
                      <div class="stream-info">
                        <span class="stream-name">School Academic Admission</span>
                        <span class="stream-desc">Nursery to Class 12 Regular CBSE / State Board</span>
                      </div>
                      @if (admissionForm.get('admissionStream')?.value === 'School') {
                        <mat-icon class="check-indicator">check_circle</mat-icon>
                      }
                    </button>
                    <button type="button"
                      class="stream-type-btn"
                      [class.active]="admissionForm.get('admissionStream')?.value === 'Coaching'"
                      (click)="setStream('Coaching')">
                      <div class="stream-icon-box coaching-box">
                        <mat-icon>menu_book</mat-icon>
                      </div>
                      <div class="stream-info">
                        <span class="stream-name">Coaching / Competitive Batch</span>
                        <span class="stream-desc">IIT-JEE, NEET, Foundation, Target & Test Series</span>
                      </div>
                      @if (admissionForm.get('admissionStream')?.value === 'Coaching') {
                        <mat-icon class="check-indicator">check_circle</mat-icon>
                      }
                    </button>
                  </div>
                </div>
                <div class="form-grid">
                  <mat-form-field appearance="outline" class="col-span-1">
                    <mat-label>Campus / Branch <span class="req">*</span></mat-label>
                    <mat-select formControlName="branchId" (selectionChange)="onBranchChanged()">
                      @for (b of institute?.branches; track b) {
                        <mat-option [value]="b.id">
                          {{ b.name }}
                        </mat-option>
                      }
                    </mat-select>
                    @if (admissionForm.get('branchId')?.hasError('required')) {
                      <mat-error>Branch is required</mat-error>
                    }
                  </mat-form-field>
                  <!-- Class selector for School -->
                  @if (admissionForm.get('admissionStream')?.value === 'School') {
                    <mat-form-field appearance="outline" class="col-span-1">
                      <mat-label>Class / Standard Applying For <span class="req">*</span></mat-label>
                      <mat-select formControlName="interestedClassId" (selectionChange)="onClassChanged()">
                        @for (c of filteredClasses; track c) {
                          <mat-option [value]="c.id">
                            {{ c.name }}
                          </mat-option>
                        }
                      </mat-select>
                      @if (admissionForm.get('interestedClassId')?.hasError('required')) {
                        <mat-error>Class is required</mat-error>
                      }
                    </mat-form-field>
                  }
                  <!-- Batch selector for Coaching -->
                  @if (admissionForm.get('admissionStream')?.value === 'Coaching') {
                    <mat-form-field appearance="outline" class="col-span-1">
                      <mat-label>Coaching Course / Batch Applying For <span class="req">*</span></mat-label>
                      <mat-select formControlName="interestedBatchId">
                        @for (bt of filteredBatches; track bt) {
                          <mat-option [value]="bt.id">
                            {{ bt.name }} ({{ bt.subject }}) &bull; ₹{{ bt.standardMonthlyFee }}/mo
                          </mat-option>
                        }
                      </mat-select>
                      @if (admissionForm.get('interestedBatchId')?.hasError('required')) {
                        <mat-error>Coaching batch is required</mat-error>
                      }
                    </mat-form-field>
                  }
                  <mat-form-field appearance="outline" class="col-span-1">
                    <mat-label>Target Academic Year</mat-label>
                    <mat-select formControlName="academicYear">
                      @for (yr of institute?.academicYears; track yr) {
                        <mat-option [value]="yr">
                          {{ yr }}
                        </mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
              </mat-card>
              <!-- SECTION 2: APPLICANT (STUDENT) DETAILS -->
              <mat-card class="form-card">
                <div class="section-title-wrap">
                  <div class="section-badge">2</div>
                  <div>
                    <h3 class="section-title">Applicant (Student) Particulars</h3>
                    <p class="section-sub">Personal information of the student as recorded in official documents.</p>
                  </div>
                </div>
                <div class="form-grid">
                  <mat-form-field appearance="outline" class="col-span-2">
                    <mat-label>Student Full Name <span class="req">*</span></mat-label>
                    <input matInput formControlName="studentName" placeholder="e.g. Aarav Sharma" />
                    <mat-icon matSuffix>person</mat-icon>
                    @if (admissionForm.get('studentName')?.hasError('required')) {
                      <mat-error>Student name is required</mat-error>
                    }
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="col-span-1">
                    <mat-label>Date of Birth</mat-label>
                    <input matInput [matDatepicker]="dobPicker" formControlName="dateOfBirth" placeholder="DD/MM/YYYY" />
                    <mat-datepicker-toggle matSuffix [for]="dobPicker"></mat-datepicker-toggle>
                    <mat-datepicker #dobPicker></mat-datepicker>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="col-span-1">
                    <mat-label>Gender <span class="req">*</span></mat-label>
                    <mat-select formControlName="gender">
                      <mat-option value="Male">Male</mat-option>
                      <mat-option value="Female">Female</mat-option>
                      <mat-option value="Other">Other</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="col-span-1">
                    <mat-label>Category (Quota)</mat-label>
                    <mat-select formControlName="category">
                      <mat-option value="General">General</mat-option>
                      <mat-option value="OBC">OBC</mat-option>
                      <mat-option value="SC">SC</mat-option>
                      <mat-option value="ST">ST</mat-option>
                      <mat-option value="EWS">EWS</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="col-span-1">
                    <mat-label>Blood Group</mat-label>
                    <mat-select formControlName="bloodGroup">
                      <mat-option value="A+">A+</mat-option>
                      <mat-option value="A-">A-</mat-option>
                      <mat-option value="B+">B+</mat-option>
                      <mat-option value="B-">B-</mat-option>
                      <mat-option value="O+">O+</mat-option>
                      <mat-option value="O-">O-</mat-option>
                      <mat-option value="AB+">AB+</mat-option>
                      <mat-option value="AB-">AB-</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="col-span-1">
                    <mat-label>Student Aadhaar Number</mat-label>
                    <input matInput formControlName="aadhaarNumber" placeholder="12-digit UID" maxlength="12" />
                    <mat-icon matSuffix>badge</mat-icon>
                  </mat-form-field>
                </div>
              </mat-card>
              <!-- SECTION 3: PARENTS & CONTACT DETAILS -->
              <mat-card class="form-card">
                <div class="section-title-wrap">
                  <div class="section-badge">3</div>
                  <div>
                    <h3 class="section-title">Parents / Guardian & Contact Information</h3>
                    <p class="section-sub">Primary contact numbers for admission updates, interview schedule & SMS/WhatsApp alerts.</p>
                  </div>
                </div>
                <div class="form-grid">
                  <mat-form-field appearance="outline" class="col-span-1">
                    <mat-label>Father's / Guardian's Name <span class="req">*</span></mat-label>
                    <input matInput formControlName="parentName" placeholder="Full name of Father / Guardian" />
                    <mat-icon matSuffix>supervisor_account</mat-icon>
                    @if (admissionForm.get('parentName')?.hasError('required')) {
                      <mat-error>Parent name is required</mat-error>
                    }
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="col-span-1">
                    <mat-label>Mother's Name</mat-label>
                    <input matInput formControlName="motherName" placeholder="Full name of Mother" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="col-span-1">
                    <mat-label>Father's / Guardian's Occupation</mat-label>
                    <input matInput formControlName="fatherOccupation" placeholder="e.g. Business, Govt Service, Engineer" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="col-span-1">
                    <mat-label>Primary WhatsApp / Mobile <span class="req">*</span></mat-label>
                    <input matInput formControlName="phone" placeholder="10-digit Mobile Number" maxlength="10" />
                    <mat-icon matSuffix>chat</mat-icon>
                    @if (admissionForm.get('phone')?.hasError('required')) {
                      <mat-error>Phone number is required</mat-error>
                    }
                    @if (admissionForm.get('phone')?.hasError('pattern')) {
                      <mat-error>Enter valid 10-digit number</mat-error>
                    }
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="col-span-1">
                    <mat-label>Alternate Phone Number</mat-label>
                    <input matInput formControlName="alternatePhone" placeholder="Emergency contact phone" maxlength="12" />
                    <mat-icon matSuffix>phone</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="col-span-1">
                    <mat-label>Email Address</mat-label>
                    <input matInput formControlName="email" type="email" placeholder="parent@example.com" />
                    <mat-icon matSuffix>email</mat-icon>
                    @if (admissionForm.get('email')?.hasError('email')) {
                      <mat-error>Invalid email address</mat-error>
                    }
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="col-span-3">
                    <mat-label>Full Residential Address</mat-label>
                    <input matInput formControlName="address" placeholder="House/Flat No., Street, Landmark, Area" />
                    <mat-icon matSuffix>home</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="col-span-1">
                    <mat-label>City / Town</mat-label>
                    <input matInput formControlName="city" placeholder="e.g. Delhi, Patna, Lucknow" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="col-span-1">
                    <mat-label>State</mat-label>
                    <input matInput formControlName="state" placeholder="e.g. Uttar Pradesh, Delhi" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="col-span-1">
                    <mat-label>PIN Code</mat-label>
                    <input matInput formControlName="pincode" placeholder="6-digit PIN" maxlength="6" />
                  </mat-form-field>
                </div>
              </mat-card>
              <!-- SECTION 4: PREVIOUS ACADEMIC DETAILS & FACILITIES -->
              <mat-card class="form-card">
                <div class="section-title-wrap">
                  <div class="section-badge">4</div>
                  <div>
                    <h3 class="section-title">Previous Academic Records & Facilities</h3>
                    <p class="section-sub">Schooling history and requested transport or hostel boarding facilities.</p>
                  </div>
                </div>
                <div class="form-grid">
                  <mat-form-field appearance="outline" class="col-span-2">
                    <mat-label>Previous School / Institute Attended</mat-label>
                    <input matInput formControlName="previousSchoolName" placeholder="Name of last attended school" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="col-span-1">
                    <mat-label>Last Exam Marks / Percentage</mat-label>
                    <input matInput formControlName="previousMarks" placeholder="e.g. 88.5% or Grade A" />
                  </mat-form-field>
                  <div class="col-span-3 facility-checkboxes">
                    <mat-checkbox formControlName="requiresTransport" color="primary" class="facility-check">
                      <div class="check-label">
                        <strong>🚌 School Bus / Van Transport Required</strong>
                        <span class="check-sub">Request pick-and-drop route allocation from nearest bus stop</span>
                      </div>
                    </mat-checkbox>
                    <mat-checkbox formControlName="requiresHostel" color="primary" class="facility-check">
                      <div class="check-label">
                        <strong>🏢 Hostel / Boarding Facility Required</strong>
                        <span class="check-sub">Request student hostel bed, meals and residential supervision</span>
                      </div>
                    </mat-checkbox>
                  </div>
                  <mat-form-field appearance="outline" class="col-span-3">
                    <mat-label>Special Remarks / Queries / Concession Request</mat-label>
                    <textarea matInput formControlName="remarks" rows="2" placeholder="Any sibling currently enrolled, medical conditions, or specific questions for the admission desk..."></textarea>
                  </mat-form-field>
                </div>
              </mat-card>
              <!-- SUBMISSION BUTTON -->
              <div class="form-submit-panel">
                <button mat-raised-button color="primary" type="submit" class="submit-btn" [disabled]="submitting || admissionForm.invalid">
                  @if (!submitting) {
                    <mat-icon>send</mat-icon>
                  }
                  <span>{{ submitting ? 'Submitting Application...' : 'Submit Admission Application' }}</span>
                </button>
                <p class="submit-notice">
                  By submitting this form, you certify that the provided information is accurate and agree to follow school admission norms.
                </p>
              </div>
            </form>
          </section>
        }
    
        <!-- ============================================================== -->
        <!-- VIEW 3: TRACK APPLICATION STATUS                               -->
        <!-- ============================================================== -->
        @if (activeTab === 'track') {
          <section class="track-section">
            <mat-card class="track-search-card">
              <div class="track-header">
                <div class="track-icon-box">
                  <mat-icon>travel_explore</mat-icon>
                </div>
                <h2 class="track-title">Track Your Admission Application</h2>
                <p class="track-sub">Enter your Application Reference Number and registered mobile number to view live status.</p>
              </div>
              <form [formGroup]="trackForm" (ngSubmit)="onTrackApplication()" class="track-form">
                <div class="track-inputs">
                  <mat-form-field appearance="outline" class="track-field">
                    <mat-label>Application Reference Number <span class="req">*</span></mat-label>
                    <input matInput formControlName="applicationNumber" placeholder="e.g. APP-2026-0001" />
                    <mat-icon matSuffix>tag</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="track-field">
                    <mat-label>Registered Mobile Number <span class="req">*</span></mat-label>
                    <input matInput formControlName="phone" placeholder="10-digit Mobile" maxlength="10" />
                    <mat-icon matSuffix>phone</mat-icon>
                  </mat-form-field>
                  <button mat-raised-button color="primary" type="submit" class="track-submit-btn" [disabled]="tracking || trackForm.invalid">
                    <mat-icon>search</mat-icon> {{ tracking ? 'Searching...' : 'Check Status' }}
                  </button>
                </div>
              </form>
            </mat-card>
            <!-- Tracking Result Card -->
            @if (trackingResult) {
              <mat-card class="track-result-card">
                <div class="result-header">
                  <div>
                    <span class="result-sub">Application Status for Ref: <strong>{{ trackingResult.applicationNumber }}</strong></span>
                    <h3 class="result-name">{{ trackingResult.studentName }}</h3>
                  </div>
              <span class="status-chip" [ngClass]="{
                'status-new': trackingResult.status === 'New',
                'status-contacted': trackingResult.status === 'Contacted',
                'status-demo': trackingResult.status === 'Demo' || trackingResult.status === 'Demo / Visit',
                'status-admitted': trackingResult.status === 'Admitted',
                'status-lost': trackingResult.status === 'Lost'
              }">
                    {{ trackingResult.status }}
                  </span>
                </div>
                <mat-divider></mat-divider>
                <div class="result-grid">
                  <div class="result-item">
                    <span class="label">Parent / Guardian:</span>
                    <span class="val">{{ trackingResult.parentName }}</span>
                  </div>
                  <div class="result-item">
                    <span class="label">Applied Class:</span>
                    <span class="val">{{ trackingResult.className || 'General' }}</span>
                  </div>
                  <div class="result-item">
                    <span class="label">Campus:</span>
                    <span class="val">{{ trackingResult.branchName || 'Main Campus' }}</span>
                  </div>
                  <div class="result-item">
                    <span class="label">Application Date:</span>
                    <span class="val">{{ trackingResult.applicationDate | date:'dd MMM yyyy, hh:mm a':'Asia/Kolkata' }}</span>
                  </div>
                </div>
                <div class="status-explanation">
                  <h4 class="exp-title"><mat-icon>lightbulb</mat-icon> Current Process Stage:</h4>
                  @if (trackingResult.status === 'New') {
                    <p class="exp-text">
                      Your application has been received and is queued for verification by the admissions team. You will receive an SMS / WhatsApp update shortly.
                    </p>
                  }
                  @if (trackingResult.status === 'Contacted') {
                    <p class="exp-text">
                      Our admissions coordinator has reviewed your profile. An interview or counseling session is being organized.
                    </p>
                  }
                  @if (trackingResult.status === 'Demo' || trackingResult.status === 'Demo / Visit') {
                    <p class="exp-text">
                      Entrance assessment / campus interaction is scheduled. Please visit the campus with original student documents.
                    </p>
                  }
                  @if (trackingResult.status === 'Admitted') {
                    <p class="exp-text">
                      🎉 <strong>Congratulations!</strong> Your admission has been approved and confirmed. Please contact the accounts office to collect your admission kit and fee receipt.
                    </p>
                  }
                  @if (trackingResult.status === 'Lost') {
                    <p class="exp-text">
                      This application has been closed or marked inactive. Please contact the admissions helpdesk for further details.
                    </p>
                  }
                </div>
              </mat-card>
            }
          </section>
        }
    
      </main>
    
      <!-- Footer -->
      <footer class="portal-footer no-print">
        <p class="footer-text">
          © {{ currentYear }} {{ institute?.tenantName || 'Institution ERP' }}. All rights reserved. Powered by IMSERP.
        </p>
      </footer>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #f8fafc;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    .portal-root {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    /* Top Branding Bar */
    .portal-header {
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .header-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .brand-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .brand-logo-wrap {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
    }

    .brand-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .brand-icon-box {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #bfdbfe;
    }

    .brand-icon-box mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .institute-name {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #1e3a8a;
      letter-spacing: -0.01em;
    }

    .institute-meta {
      margin: 3px 0 0;
      font-size: 12px;
      color: #64748b;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
    }

    .meta-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: #3b82f6;
    }

    .sep {
      color: #cbd5e1;
      margin: 0 4px;
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-active {
      background: #eff6ff !important;
      color: #1e40af !important;
      border-color: #3b82f6 !important;
      font-weight: 600;
    }

    .login-redirect-btn {
      font-weight: 600;
    }

    .portal-progress {
      position: sticky;
      top: 73px;
      z-index: 99;
    }

    /* Main Content Area */
    .portal-main {
      flex: 1;
      max-width: 1000px;
      width: 100%;
      margin: 0 auto;
      padding: 32px 20px 48px;
      box-sizing: border-box;
    }

    .alert-box {
      padding: 12px 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      font-size: 14px;
    }

    .alert-danger {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
    }

    .form-hero {
      text-align: center;
      margin-bottom: 28px;
    }

    .hero-chip {
      display: inline-block;
      padding: 4px 14px;
      background: #dbeafe;
      color: #1d4ed8;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
    }

    .hero-title {
      font-size: 26px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 8px;
    }

    .hero-desc {
      font-size: 14px;
      color: #64748b;
      margin: 0;
    }

    .req {
      color: #dc2626;
      font-weight: 700;
    }

    /* Form Cards */
    .form-card {
      margin-bottom: 24px;
      padding: 24px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      background: #ffffff;
    }

    .section-title-wrap {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 20px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 12px;
    }

    .section-badge {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #2563eb;
      color: #ffffff;
      font-size: 15px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .section-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #1e3a8a;
    }

    .section-sub {
      margin: 2px 0 0;
      font-size: 12px;
      color: #64748b;
    }

    /* Stream Selection Deck */
    .stream-selector-wrap {
      margin-bottom: 20px;
    }

    .stream-label {
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      display: block;
      margin-bottom: 8px;
    }

    .stream-btn-deck {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
    }

    .stream-type-btn {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 10px;
      background: #f8fafc;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s ease;
      position: relative;
    }

    .stream-type-btn:hover {
      border-color: #93c5fd;
      background: #f0fdf4;
    }

    .stream-type-btn.active {
      border-color: #2563eb;
      background: #eff6ff;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.12);
    }

    .stream-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .stream-icon-box.school-box {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .stream-icon-box.coaching-box {
      background: #fae8ff;
      color: #86198f;
    }

    .stream-info {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .stream-name {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }

    .stream-desc {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }

    .check-indicator {
      color: #2563eb;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .col-span-1 { grid-column: span 1; }
    .col-span-2 { grid-column: span 2; }
    .col-span-3 { grid-column: span 3; }

    .facility-checkboxes {
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .facility-check {
      margin-bottom: 4px;
    }

    .check-label {
      display: flex;
      flex-direction: column;
      margin-left: 6px;
    }

    .check-label strong {
      font-size: 14px;
      color: #1e293b;
    }

    .check-sub {
      font-size: 12px;
      color: #64748b;
    }

    .form-submit-panel {
      text-align: center;
      margin-top: 16px;
      margin-bottom: 32px;
    }

    .submit-btn {
      min-width: 280px;
      height: 48px;
      font-size: 16px;
      font-weight: 700;
      border-radius: 8px;
    }

    .submit-notice {
      margin-top: 12px;
      font-size: 12px;
      color: #64748b;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }

    /* Success Screen */
    .success-card {
      padding: 36px 32px;
      border-radius: 12px;
      border: 1px solid #bfdbfe;
      background: #ffffff;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }

    .success-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .check-icon-circle {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #dcfce7;
      color: #16a34a;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }

    .check-icon-circle mat-icon {
      font-size: 44px;
      width: 44px;
      height: 44px;
    }

    .success-title {
      font-size: 24px;
      font-weight: 800;
      color: #15803d;
      margin: 0 0 8px;
    }

    .success-subtitle {
      font-size: 15px;
      color: #475569;
      margin: 0;
      max-width: 700px;
      margin-left: auto;
      margin-right: auto;
    }

    .ref-badge-deck {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin: 24px 0;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      padding: 20px;
      border-radius: 10px;
      border: 1px solid #bfdbfe;
    }

    .ref-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .ref-label {
      font-size: 12px;
      font-weight: 600;
      color: #3b82f6;
      text-transform: uppercase;
    }

    .ref-val-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ref-val {
      font-size: 20px;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: 0.04em;
    }

    .ref-meta {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }

    .next-steps-panel {
      background: #f8fafc;
      padding: 20px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      margin-bottom: 24px;
    }

    .steps-title {
      margin: 0 0 12px;
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .steps-title mat-icon {
      color: #2563eb;
    }

    .steps-list {
      margin: 0;
      padding-left: 20px;
      font-size: 14px;
      color: #334155;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .success-actions {
      display: flex;
      justify-content: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .action-btn {
      height: 44px;
      font-weight: 600;
      min-width: 180px;
    }

    /* Track Application Section */
    .track-search-card {
      padding: 32px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      margin-bottom: 24px;
    }

    .track-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .track-icon-box {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 12px;
      border: 1px solid #bfdbfe;
    }

    .track-icon-box mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .track-title {
      margin: 0 0 6px;
      font-size: 22px;
      font-weight: 800;
      color: #1e3a8a;
    }

    .track-sub {
      margin: 0;
      font-size: 14px;
      color: #64748b;
    }

    .track-inputs {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
    }

    .track-field {
      flex: 1;
      min-width: 240px;
    }

    .track-submit-btn {
      height: 54px;
      min-width: 160px;
      font-weight: 700;
      margin-bottom: 22px;
    }

    .track-result-card {
      padding: 24px;
      border-radius: 12px;
      border: 1px solid #bfdbfe;
      background: #ffffff;
    }

    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .result-sub {
      font-size: 13px;
      color: #64748b;
    }

    .result-name {
      margin: 4px 0 0;
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
    }

    .status-chip {
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .status-new { background: #e0e7ff; color: #3730a3; }
    .status-contacted { background: #fef3c7; color: #92400e; }
    .status-demo { background: #ede9fe; color: #6b21a8; }
    .status-admitted { background: #dcfce7; color: #15803d; }
    .status-lost { background: #fee2e2; color: #b91c1c; }

    .result-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin: 20px 0;
    }

    .result-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .result-item .label {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }

    .result-item .val {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
    }

    .status-explanation {
      background: #f8fafc;
      padding: 16px 20px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .exp-title {
      margin: 0 0 6px;
      font-size: 14px;
      font-weight: 700;
      color: #1e3a8a;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .exp-title mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #f59e0b;
    }

    .exp-text {
      margin: 0;
      font-size: 13px;
      color: #334155;
      line-height: 1.5;
    }

    /* Footer */
    .portal-footer {
      border-top: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 16px 24px;
      text-align: center;
      margin-top: auto;
    }

    .footer-text {
      margin: 0;
      font-size: 13px;
      color: #64748b;
    }

    /* Responsive Media Queries */
    @media (max-width: 900px) {
      .form-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .col-span-1, .col-span-2, .col-span-3 {
        grid-column: span 2;
      }
      .ref-badge-deck {
        grid-template-columns: 1fr;
      }
      .result-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 640px) {
      .header-container {
        flex-direction: column;
        align-items: flex-start;
      }
      .stream-btn-deck {
        grid-template-columns: 1fr;
      }
      .form-grid {
        grid-template-columns: 1fr;
      }
      .col-span-1, .col-span-2, .col-span-3 {
        grid-column: span 1;
      }
      .result-grid {
        grid-template-columns: 1fr;
      }
      .track-inputs {
        flex-direction: column;
      }
      .track-submit-btn {
        width: 100%;
        margin-bottom: 0;
      }
    }

    /* Print View */
    @media print {
      .portal-header, .portal-footer, .no-print, .nav-actions {
        display: none !important;
      }
      .portal-root {
        background: #ffffff;
      }
      .print-slip {
        border: 2px solid #000 !important;
        box-shadow: none !important;
        padding: 20px !important;
      }
    }
  `]
})
export class PublicAdmissionPortalComponent implements OnInit {
  activeTab: 'apply' | 'track' = 'apply';
  loading = false;
  submitting = false;
  tracking = false;
  errorMessage = '';

  institute: PublicInstituteDetails | null = null;
  filteredClasses: PublicClass[] = [];
  filteredBatches: PublicBatch[] = [];
  submittedResult: PublicAdmissionResponse | null = null;
  trackingResult: ApplicationTrackingResult | null = null;

  currentYear = new Date().getFullYear();

  admissionForm!: FormGroup;
  trackForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private admissionsService: PublicAdmissionsService
  ) {}

  ngOnInit(): void {
    this.initForms();
    this.loadInstituteDetails();
  }

  private initForms(): void {
    this.admissionForm = this.fb.group({
      branchId: ['', Validators.required],
      admissionStream: ['School', Validators.required],
      interestedClassId: ['', Validators.required],
      interestedBatchId: [''],
      academicYear: [''],
      studentName: ['', [Validators.required, Validators.minLength(2)]],
      dateOfBirth: [null],
      gender: ['Male', Validators.required],
      category: ['General'],
      bloodGroup: [''],
      aadhaarNumber: [''],
      parentName: ['', [Validators.required, Validators.minLength(2)]],
      motherName: [''],
      fatherOccupation: [''],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      alternatePhone: [''],
      email: ['', [Validators.email]],
      address: [''],
      city: [''],
      state: [''],
      pincode: [''],
      previousSchoolName: [''],
      previousMarks: [''],
      requiresTransport: [false],
      requiresHostel: [false],
      remarks: ['']
    });

    this.trackForm = this.fb.group({
      applicationNumber: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]]
    });
  }

  setStream(stream: 'School' | 'Coaching'): void {
    this.admissionForm.patchValue({ admissionStream: stream });
    const classCtrl = this.admissionForm.get('interestedClassId');
    const batchCtrl = this.admissionForm.get('interestedBatchId');

    if (stream === 'School') {
      classCtrl?.setValidators([Validators.required]);
      batchCtrl?.clearValidators();
      batchCtrl?.setValue('');
    } else {
      batchCtrl?.setValidators([Validators.required]);
      classCtrl?.clearValidators();
      classCtrl?.setValue('');
    }
    classCtrl?.updateValueAndValidity();
    batchCtrl?.updateValueAndValidity();
  }

  private loadInstituteDetails(): void {
    this.loading = true;
    this.errorMessage = '';

    const tenantCode = this.route.snapshot.queryParamMap.get('tenant') || this.route.snapshot.queryParamMap.get('code') || undefined;
    const tenantId = this.route.snapshot.queryParamMap.get('tenantId') || undefined;

    this.admissionsService.getInstituteDetails(tenantCode, tenantId).subscribe({
      next: (details) => {
        this.loading = false;
        this.institute = details;

        // Auto select first branch
        if (details.branches && details.branches.length > 0) {
          const firstBranchId = details.branches[0].id;
          this.admissionForm.patchValue({ branchId: firstBranchId });
          this.filterOptionsForBranch(firstBranchId);
        } else {
          this.filteredClasses = details.classes || [];
          this.filteredBatches = details.batches || [];
        }

        // Auto select first academic year
        if (details.academicYears && details.academicYears.length > 0) {
          this.admissionForm.patchValue({ academicYear: details.academicYears[0] });
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Failed to load institute details. Please refresh or contact school.';
      }
    });
  }

  onBranchChanged(): void {
    const branchId = this.admissionForm.get('branchId')?.value;
    this.filterOptionsForBranch(branchId);
    this.admissionForm.patchValue({ interestedClassId: '', interestedBatchId: '' });
  }

  private filterOptionsForBranch(branchId: string): void {
    if (!this.institute?.classes) {
      this.filteredClasses = [];
    } else {
      this.filteredClasses = this.institute.classes.filter(
        c => !c.branchId || c.branchId === branchId
      );
    }

    if (!this.institute?.batches) {
      this.filteredBatches = [];
    } else {
      this.filteredBatches = this.institute.batches.filter(
        b => !b.branchId || b.branchId === branchId
      );
    }
  }

  onClassChanged(): void {
    // optional logic when class changed
  }

  onSubmitApplication(): void {
    if (this.admissionForm.invalid) {
      this.admissionForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    const formVal = this.admissionForm.value;
    const isCoaching = formVal.admissionStream === 'Coaching';
    const selectedClass = this.filteredClasses.find(c => c.id === formVal.interestedClassId);
    const selectedBatch = this.filteredBatches.find(b => b.id === formVal.interestedBatchId);

    // Format DOB if present
    let dobString: string | null = null;
    if (formVal.dateOfBirth) {
      const d = new Date(formVal.dateOfBirth);
      dobString = d.toISOString();
    }

    const payload = {
      tenantId: this.institute?.tenantId,
      tenantCode: this.institute?.tenantCode,
      branchId: formVal.branchId,
      studentName: formVal.studentName,
      dateOfBirth: dobString,
      gender: formVal.gender,
      bloodGroup: formVal.bloodGroup,
      category: formVal.category,
      aadhaarNumber: formVal.aadhaarNumber,
      parentName: formVal.parentName,
      motherName: formVal.motherName,
      fatherOccupation: formVal.fatherOccupation,
      phone: formVal.phone,
      alternatePhone: formVal.alternatePhone,
      email: formVal.email,
      address: formVal.address,
      city: formVal.city,
      state: formVal.state,
      pincode: formVal.pincode,
      admissionStream: formVal.admissionStream,
      interestedClassId: !isCoaching ? formVal.interestedClassId : null,
      interestedClassName: !isCoaching ? (selectedClass?.name || '') : null,
      interestedBatchId: isCoaching ? formVal.interestedBatchId : null,
      interestedBatchName: isCoaching ? (selectedBatch ? `${selectedBatch.name} (${selectedBatch.subject})` : '') : null,
      academicYear: formVal.academicYear,
      previousSchoolName: formVal.previousSchoolName,
      previousMarks: formVal.previousMarks,
      requiresTransport: !!formVal.requiresTransport,
      requiresHostel: !!formVal.requiresHostel,
      remarks: formVal.remarks
    };

    this.admissionsService.submitApplication(payload).subscribe({
      next: (res) => {
        this.submitting = false;
        this.submittedResult = res;
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || 'Failed to submit application. Please check details and try again.';
      }
    });
  }

  onTrackApplication(): void {
    if (this.trackForm.invalid) {
      this.trackForm.markAllAsTouched();
      return;
    }

    this.tracking = true;
    this.errorMessage = '';
    this.trackingResult = null;

    const { applicationNumber, phone } = this.trackForm.value;

    this.admissionsService.trackStatus(applicationNumber, phone).subscribe({
      next: (res) => {
        this.tracking = false;
        this.trackingResult = res;
      },
      error: (err) => {
        this.tracking = false;
        this.errorMessage = err.error?.remarks || err.error?.message || 'Application not found with provided reference and mobile number.';
      }
    });
  }

  copyAppNumber(num: string): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(num);
    }
  }

  printSlip(): void {
    window.print();
  }

  resetForm(): void {
    this.submittedResult = null;
    this.admissionForm.reset({
      admissionStream: 'School',
      gender: 'Male',
      category: 'General',
      requiresTransport: false,
      requiresHostel: false
    });
    if (this.institute?.branches && this.institute.branches.length > 0) {
      const firstBranchId = this.institute.branches[0].id;
      this.admissionForm.patchValue({ branchId: firstBranchId });
      this.filterOptionsForBranch(firstBranchId);
    }
    if (this.institute?.academicYears && this.institute.academicYears.length > 0) {
      this.admissionForm.patchValue({ academicYear: this.institute.academicYears[0] });
    }
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
