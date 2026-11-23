import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import {
  TeacherCopilotService,
  TeacherQuestionPaperDto,
  TeacherAiLessonPlanDto,
  GenerateQuestionPaperRequestDto,
  GenerateAiLessonPlanRequestDto
} from '../../core/services/teacher-copilot.service';
import { AuthService } from '../../core/services/auth.service';
import { SchoolService, SchoolClassDto } from '../../core/services/school.service';
import { BranchService, BranchDto } from '../../core/services/branch.service';
import { SubjectsService, SubjectDto, ClassSubjectDto } from '../../core/services/subjects.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { LocalDatetimePipe } from '../../shared/pipes/local-datetime.pipe';

@Component({
  selector: 'app-teacher-copilot',
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
    MatProgressBarModule,
    MatTooltipModule,
    MatTabsModule,
    MatChipsModule,
    MatSlideToggleModule,
    MatExpansionModule,
    LocalDatetimePipe
  ],
  template: `
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header-deck">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>auto_awesome</mat-icon>
          </div>
          <div class="header-titles">
            <div class="title-row">
              <h1 class="page-title">Teacher AI Copilot: Question Paper &amp; Lesson Plan Studio</h1>
              <span class="copilot-pill">
                <span class="pulse-dot"></span>
                NEP 2020 Compliant
              </span>
            </div>
            <p class="page-subtitle">
              Instant academic question paper synthesis with authentic CBSE/State Board blueprints, bilingual Hindi/English questions, step-wise marking schemes, and 5E pedagogical lesson plans.
            </p>
          </div>
        </div>

        <div class="header-action-buttons">
          <button class="header-action-btn" (click)="loadSavedLibrary()" [disabled]="loading" mat-stroked-button>
            <mat-icon>folder_open</mat-icon>
            <span>Saved Repository ({{ savedPapers.length + savedPlans.length }})</span>
          </button>
        </div>
      </div>

      <!-- Single Prominent Loader (Strict Rule) -->
      @if (loading) {
        <mat-progress-bar mode="indeterminate" class="page-loader"></mat-progress-bar>
      }

      <!-- Main Navigation Tabs -->
      <mat-card class="content-card mat-elevation-z1">
        <mat-tab-group [(selectedIndex)]="activeTabIndex" animationDuration="200ms" class="copilot-tabs">
          
          <!-- TAB 1: QUESTION PAPER STUDIO -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">quiz</mat-icon>
              <span>Question Paper Studio (प्रश्न-पत्र निर्माता)</span>
            </ng-template>

            <div class="tab-body">
              <div class="studio-layout">

                <!-- Left Form Panel -->
                <div class="generator-form-panel">
                  <div class="panel-header">
                    <mat-icon class="panel-icon">tune</mat-icon>
                    <h3>Paper Configuration &amp; Blueprint</h3>
                  </div>

                  <form [formGroup]="paperForm" (ngSubmit)="generatePaper()" class="copilot-form">
                    
                    <!-- Paper Title -->
                    <mat-form-field appearance="outline" class="full-span">
                      <mat-label>Examination / Test Title</mat-label>
                      <input matInput formControlName="title" placeholder="e.g. Term-1 Periodic Test / Half Yearly Exam" />
                      <mat-icon matSuffix color="primary">assignment</mat-icon>
                    </mat-form-field>

                    <div class="form-row-2">
                      <!-- Subject (Dynamic from DB) -->
                      <mat-form-field appearance="outline">
                        <mat-label>Subject (विषय)</mat-label>
                        <mat-select formControlName="subject">
                          @for (s of paperSubjects; track s.id) {
                            <mat-option [value]="s.name">{{ s.name }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>

                      <!-- Class Name (Dynamic from DB) -->
                      <mat-form-field appearance="outline">
                        <mat-label>Target Class (कक्षा)</mat-label>
                        <mat-select formControlName="className" (selectionChange)="onPaperClassChange($event.value)">
                          @for (c of classes; track c.id) {
                            <mat-option [value]="c.name">{{ c.name }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                    </div>

                    <div class="form-row-3">
                      <!-- Total Marks -->
                      <mat-form-field appearance="outline">
                        <mat-label>Total Marks (पूर्णांक)</mat-label>
                        <mat-select formControlName="totalMarks">
                          <mat-option [value]="20">20 Marks (Unit Test)</mat-option>
                          <mat-option [value]="25">25 Marks (Weekly Quiz)</mat-option>
                          <mat-option [value]="40">40 Marks (Periodic Test)</mat-option>
                          <mat-option [value]="50">50 Marks (Mid-Term)</mat-option>
                          <mat-option [value]="80">80 Marks (Annual / Board)</mat-option>
                          <mat-option [value]="100">100 Marks (Full Mock)</mat-option>
                        </mat-select>
                      </mat-form-field>

                      <!-- Duration -->
                      <mat-form-field appearance="outline">
                        <mat-label>Duration (समय)</mat-label>
                        <mat-select formControlName="durationMinutes">
                          <mat-option [value]="45">45 Minutes</mat-option>
                          <mat-option [value]="60">1 Hour (60 Min)</mat-option>
                          <mat-option [value]="90">1.5 Hours (90 Min)</mat-option>
                          <mat-option [value]="120">2 Hours (120 Min)</mat-option>
                          <mat-option [value]="180">3 Hours (180 Min)</mat-option>
                        </mat-select>
                      </mat-form-field>

                      <!-- Language -->
                      <mat-form-field appearance="outline">
                        <mat-label>Paper Language (भाषा)</mat-label>
                        <mat-select formControlName="language">
                          <mat-option value="Bilingual">🌐 Bilingual (Hindi + English)</mat-option>
                          <mat-option value="English">🇬🇧 English Only</mat-option>
                          <mat-option value="Hindi">🇮🇳 Hindi Only</mat-option>
                        </mat-select>
                      </mat-form-field>
                    </div>

                    <div class="form-row-2">
                      <!-- Difficulty Level -->
                      <mat-form-field appearance="outline">
                        <mat-label>Difficulty (कठिनाई स्तर)</mat-label>
                        <mat-select formControlName="difficultyLevel">
                          <mat-option value="Balanced">⚖️ Balanced (Board Pattern Standard)</mat-option>
                          <mat-option value="Easy">🟢 Easy (Foundational / Remedial)</mat-option>
                          <mat-option value="Moderate">🟡 Moderate (Application Heavy)</mat-option>
                          <mat-option value="Challenging">🔴 Challenging (Olympiad / HOTS)</mat-option>
                        </mat-select>
                      </mat-form-field>

                      <!-- Board / Curriculum -->
                      <mat-form-field appearance="outline">
                        <mat-label>Curriculum Standard</mat-label>
                        <input matInput formControlName="boardOrCurriculum" placeholder="e.g. CBSE / NCERT / State Board" />
                      </mat-form-field>
                    </div>

                    <!-- Chapters / Topics -->
                    <mat-form-field appearance="outline" class="full-span">
                      <mat-label>Chapters / Topics Covered (पाठ व अध्याय)</mat-label>
                      <textarea matInput rows="2" formControlName="chaptersList" placeholder="e.g. Chapter 1: Real Numbers, Chapter 2: Polynomials, Chapter 4: Quadratic Equations"></textarea>
                      <mat-hint>Enter specific chapters or leave empty for full prescribed syllabus</mat-hint>
                    </mat-form-field>

                    <!-- Submit Button -->
                    <button type="submit" [disabled]="paperForm.invalid || loading" mat-flat-button color="primary" class="generate-submit-btn">
                      <mat-icon>auto_awesome</mat-icon>
                      <span>{{ loading ? 'Synthesizing Blueprint...' : 'Generate Academic Paper & Solution Key' }}</span>
                    </button>
                  </form>
                </div>

                <!-- Right Live Preview Panel -->
                <div class="preview-panel">
                  @if (!currentPaper) {
                    <div class="empty-preview-card">
                      <div class="empty-icon-wrap">
                        <mat-icon>description</mat-icon>
                      </div>
                      <h3>No Paper Generated Yet</h3>
                      <p>Select your subject, class, and chapters on the left, then click <strong>"Generate Academic Paper"</strong>. The AI Copilot will construct an authentic exam paper with Section A, B, C, D and step-wise marking schemes.</p>
                    </div>
                  } @else {
                    <div class="paper-preview-wrapper" id="printable-question-paper">
                      
                      <!-- Paper Action Bar (Hidden during print) -->
                      <div class="paper-toolbar no-print">
                        <div class="toolbar-title">
                          <mat-icon color="primary">verified</mat-icon>
                          <span>Generated Paper Ready</span>
                        </div>
                        <div class="toolbar-actions">
                          <button mat-flat-button color="primary" (click)="printQuestionPaper()" class="print-btn">
                            <mat-icon>print</mat-icon>
                            <span>Print / PDF Export</span>
                          </button>
                          <button mat-stroked-button (click)="toggleSolutions()" class="sol-toggle-btn">
                            <mat-icon>{{ showSolutions ? 'visibility_off' : 'visibility' }}</mat-icon>
                            <span>{{ showSolutions ? 'Hide Marking Scheme' : 'View Marking Scheme' }}</span>
                          </button>
                        </div>
                      </div>

                      <!-- Printable Examination Sheet -->
                      <div class="exam-sheet">
                        
                        <!-- Institutional Header (100% Dynamic, Zero Hardcoding) -->
                        <div class="exam-header">
                          @if (instituteLogo) {
                            <img [src]="instituteLogo" alt="" class="exam-logo" />
                          }
                          <div class="exam-header-text">
                            <h2 class="inst-name">{{ instituteName }}</h2>
                            <p class="inst-sub">ANNUAL / PERIODIC EVALUATION EXAMINATION • ACADEMIC SESSION 2026-27</p>
                            <h3 class="paper-title-heading">{{ currentPaper.title }}</h3>
                          </div>
                        </div>

                        <!-- Paper Metadata Strip -->
                        <div class="paper-meta-strip">
                          <div class="meta-col">
                            <span><strong>Class:</strong> {{ currentPaper.className }}</span>
                            <span><strong>Subject:</strong> {{ currentPaper.subject }}</span>
                          </div>
                          <div class="meta-col center">
                            <span><strong>Time Allowed:</strong> {{ currentPaper.durationMinutes }} Minutes</span>
                            <span><strong>Curriculum:</strong> {{ currentPaper.boardOrCurriculum }}</span>
                          </div>
                          <div class="meta-col right">
                            <span><strong>Maximum Marks:</strong> {{ currentPaper.totalMarks }}</span>
                            <span><strong>Pattern:</strong> {{ currentPaper.difficultyLevel }}</span>
                          </div>
                        </div>

                        <!-- Candidate Details Box (Standard Exam Format) -->
                        <div class="candidate-box">
                          <span class="cand-field">Roll Number: _____________________</span>
                          <span class="cand-field">Candidate's Name: _________________________________</span>
                          <span class="cand-field">Invigilator's Sign: ______________</span>
                        </div>

                        <!-- General Instructions -->
                        <div class="instructions-box">
                          <div class="inst-title">General Instructions (सामान्य निर्देश):</div>
                          <pre class="inst-text">{{ currentPaper.generalInstructions }}</pre>
                        </div>

                        <!-- Question Sections -->
                        <div class="sections-container">
                          @for (sec of currentPaper.sections; track sec.sectionName) {
                            <div class="exam-section">
                              <div class="section-banner">
                                <span class="sec-title">{{ sec.sectionTitle }}</span>
                                <span class="sec-marks">[{{ sec.totalQuestions }} &times; {{ sec.marksPerQuestion }} = {{ sec.sectionTotalMarks }} Marks]</span>
                              </div>

                              <div class="questions-list">
                                @for (q of sec.questions; track q.questionNumber) {
                                  <div class="question-item">
                                    <div class="q-main-row">
                                      <div class="q-left">
                                        <span class="q-num">Q{{ q.questionNumber }}.</span>
                                        <div class="q-texts">
                                          <p class="q-text-en">{{ q.questionTextEn }}</p>
                                          @if (q.questionTextHi) {
                                            <p class="q-text-hi">{{ q.questionTextHi }}</p>
                                          }
                                        </div>
                                      </div>
                                      <span class="q-marks">[{{ q.marks }}]</span>
                                    </div>

                                    <!-- MCQ Options -->
                                    @if (q.optionsEn && q.optionsEn.length > 0) {
                                      <div class="mcq-grid">
                                        @for (opt of q.optionsEn; track opt; let optIdx = $index) {
                                          <div class="mcq-opt">
                                            <span class="opt-label">({{ getOptionLetter(optIdx) }})</span>
                                            <span class="opt-text">{{ opt }}</span>
                                            @if (q.optionsHi && q.optionsHi[optIdx]) {
                                              <span class="opt-hi">/ {{ q.optionsHi[optIdx] }}</span>
                                            }
                                          </div>
                                        }
                                      </div>
                                    }

                                    <!-- Marking Scheme & Solution Key (If toggled) -->
                                    @if (showSolutions) {
                                      <div class="solution-box no-print">
                                        <div class="sol-hdr">
                                          <mat-icon>check_circle</mat-icon>
                                          <strong>Model Answer / Key:</strong> {{ q.correctAnswerOrKey }}
                                        </div>
                                        <p class="sol-steps"><strong>Marking Rubric:</strong> {{ q.stepWiseExplanation }}</p>
                                      </div>
                                    }
                                  </div>
                                }
                              </div>
                            </div>
                          }
                        </div>

                        <!-- Footer -->
                        <div class="exam-footer">
                          <span>*** END OF QUESTION PAPER ***</span>
                        </div>

                      </div>
                    </div>
                  }
                </div>

              </div>
            </div>
          </mat-tab>

          <!-- TAB 2: NEP 2020 LESSON PLANNER -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">menu_book</mat-icon>
              <span>NEP 2020 Lesson Planner (पाठ योजना)</span>
            </ng-template>

            <div class="tab-body">
              <div class="studio-layout">

                <!-- Left Form Panel -->
                <div class="generator-form-panel">
                  <div class="panel-header">
                    <mat-icon class="panel-icon">psychology</mat-icon>
                    <h3>NEP 2020 Pedagogical Parameters</h3>
                  </div>

                  <form [formGroup]="planForm" (ngSubmit)="generateLessonPlan()" class="copilot-form">
                    
                    <div class="form-row-2">
                      <!-- Subject (Dynamic from DB) -->
                      <mat-form-field appearance="outline">
                        <mat-label>Subject (विषय)</mat-label>
                        <mat-select formControlName="subject">
                          @for (s of planSubjects; track s.id) {
                            <mat-option [value]="s.name">{{ s.name }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>

                      <!-- Class Name (Dynamic from DB) -->
                      <mat-form-field appearance="outline">
                        <mat-label>Class (कक्षा)</mat-label>
                        <mat-select formControlName="className" (selectionChange)="onPlanClassChange($event.value)">
                          @for (c of classes; track c.id) {
                            <mat-option [value]="c.name">{{ c.name }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                    </div>

                    <!-- Topic / Chapter -->
                    <mat-form-field appearance="outline" class="full-span">
                      <mat-label>Topic / Chapter Title (पाठ का नाम)</mat-label>
                      <input matInput formControlName="topicOrChapter" placeholder="e.g. Newton's Laws of Motion / Life Processes / Triangles" />
                      <mat-icon matSuffix color="primary">topic</mat-icon>
                    </mat-form-field>

                    <div class="form-row-2">
                      <!-- Total Periods -->
                      <mat-form-field appearance="outline">
                        <mat-label>Instructional Periods (कालांश)</mat-label>
                        <mat-select formControlName="totalPeriods">
                          <mat-option [value]="2">2 Periods (Quick Module)</mat-option>
                          <mat-option [value]="4">4 Periods (Standard Unit)</mat-option>
                          <mat-option [value]="6">6 Periods (Deep Dive)</mat-option>
                          <mat-option [value]="8">8 Periods (Full Chapter)</mat-option>
                        </mat-select>
                      </mat-form-field>

                      <!-- Pedagogical Approach -->
                      <mat-form-field appearance="outline">
                        <mat-label>Pedagogy Model</mat-label>
                        <mat-select formControlName="pedagogicalApproach">
                          <mat-option value="5E Inquiry Model (NEP 2020)">5E Inquiry Model (NEP 2020)</mat-option>
                          <mat-option value="Experiential & Hands-on">Experiential &amp; Hands-on</mat-option>
                          <mat-option value="Flipped Classroom & Discussion">Flipped Classroom &amp; Discussion</mat-option>
                          <mat-option value="Competency-Based Learning">Competency-Based Learning</mat-option>
                        </mat-select>
                      </mat-form-field>
                    </div>

                    <!-- Submit Button -->
                    <button type="submit" [disabled]="planForm.invalid || loading" mat-flat-button color="primary" class="generate-submit-btn">
                      <mat-icon>auto_awesome</mat-icon>
                      <span>{{ loading ? 'Drafting Lesson Plan...' : 'Generate NEP 2020 Lesson Plan' }}</span>
                    </button>
                  </form>
                </div>

                <!-- Right Live Preview Panel -->
                <div class="preview-panel">
                  @if (!currentPlan) {
                    <div class="empty-preview-card">
                      <div class="empty-icon-wrap">
                        <mat-icon>menu_book</mat-icon>
                      </div>
                      <h3>No Lesson Plan Generated Yet</h3>
                      <p>Enter the topic, grade, and duration on the left to synthesize a complete <strong>NEP 2020 5E Lesson Plan</strong> with learning objectives, teaching aids, formative evaluation checks, and worksheets.</p>
                    </div>
                  } @else {
                    <div class="plan-preview-wrapper" id="printable-lesson-plan">
                      
                      <!-- Action Toolbar -->
                      <div class="paper-toolbar no-print">
                        <div class="toolbar-title">
                          <mat-icon color="primary">verified</mat-icon>
                          <span>NEP 2020 Lesson Plan Ready</span>
                        </div>
                        <div class="toolbar-actions">
                          <button mat-flat-button color="primary" (click)="printLessonPlan()" class="print-btn">
                            <mat-icon>print</mat-icon>
                            <span>Print / Inspection Export</span>
                          </button>
                        </div>
                      </div>

                      <!-- Printable Plan Sheet -->
                      <div class="plan-sheet">
                        <div class="plan-header">
                          <h2 class="inst-name">{{ instituteName }}</h2>
                          <h3 class="plan-title-heading">{{ currentPlan.title }}</h3>
                          <div class="plan-meta-line">
                            <span><strong>Subject:</strong> {{ currentPlan.subject }}</span>
                            <span>•</span>
                            <span><strong>Class:</strong> {{ currentPlan.className }}</span>
                            <span>•</span>
                            <span><strong>Periods:</strong> {{ currentPlan.totalPeriods }}</span>
                            <span>•</span>
                            <span><strong>Pedagogy:</strong> {{ currentPlan.pedagogicalApproach }}</span>
                          </div>
                        </div>

                        <!-- Learning Objectives Box -->
                        <div class="plan-section-box">
                          <div class="sec-hdr">
                            <mat-icon>target</mat-icon>
                            <h4>Curricular Learning Outcomes &amp; Competencies (NEP 2020):</h4>
                          </div>
                          <pre class="sec-text">{{ currentPlan.learningObjectives }}</pre>
                        </div>

                        <!-- Teaching Aids -->
                        <div class="plan-section-box">
                          <div class="sec-hdr">
                            <mat-icon>build</mat-icon>
                            <h4>Teaching Aids &amp; Technology Integration:</h4>
                          </div>
                          <p class="sec-text">{{ currentPlan.teachingAidsAndResources }}</p>
                        </div>

                        <!-- 5E Pedagogical Period Breakdown Table -->
                        <div class="plan-section-box">
                          <div class="sec-hdr">
                            <mat-icon>schedule</mat-icon>
                            <h4>Period-Wise 5E Instructional Plan:</h4>
                          </div>
                          <div class="table-responsive">
                            <table class="plan-period-table">
                              <thead>
                                <tr>
                                  <th>Period</th>
                                  <th>5E Phase</th>
                                  <th>Teacher's Facilitation</th>
                                  <th>Student Activity</th>
                                  <th>Assessment Check</th>
                                </tr>
                              </thead>
                              <tbody>
                                @for (p of currentPlan.periods; track p.periodNumber) {
                                  <tr>
                                    <td class="col-p-num">Period {{ p.periodNumber }}</td>
                                    <td class="col-phase"><span class="phase-badge">{{ p.phaseName }}</span></td>
                                    <td>{{ p.teacherAction }}</td>
                                    <td>{{ p.studentActivity }}</td>
                                    <td>{{ p.assessmentCheck }}</td>
                                  </tr>
                                }
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <!-- Formative Assessment -->
                        <div class="plan-section-box">
                          <div class="sec-hdr">
                            <mat-icon>help_outline</mat-icon>
                            <h4>Formative Assessment Checks (रचनात्मक आकलन):</h4>
                          </div>
                          <pre class="sec-text">{{ currentPlan.formativeAssessmentQuestions }}</pre>
                        </div>

                        <!-- Homework & Differentiated Practice -->
                        <div class="plan-section-box">
                          <div class="sec-hdr">
                            <mat-icon>home_work</mat-icon>
                            <h4>Differentiated Homework &amp; Enrichment Worksheet:</h4>
                          </div>
                          <pre class="sec-text">{{ currentPlan.homeworkAndWorksheetAssignment }}</pre>
                        </div>

                        <!-- Signatures Box -->
                        <div class="signatures-strip">
                          <div class="sig-col">
                            <span class="sig-line">_________________________</span>
                            <span class="sig-label">Subject Teacher's Signature</span>
                          </div>
                          <div class="sig-col right">
                            <span class="sig-line">_________________________</span>
                            <span class="sig-label">Academic Coordinator / Principal</span>
                          </div>
                        </div>

                      </div>
                    </div>
                  }
                </div>

              </div>
            </div>
          </mat-tab>

          <!-- TAB 3: REPOSITORY / SAVED LIBRARY -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">inventory_2</mat-icon>
              <span>Saved Repository (सुरक्षित लाइब्रेरी)</span>
            </ng-template>

            <div class="tab-body">
              <div class="repository-view">
                
                <!-- Saved Question Papers Section -->
                <div class="repo-section">
                  <div class="repo-header">
                    <div class="title-with-badge">
                      <h3>Saved Question Papers</h3>
                      <span class="count-badge">{{ savedPapers.length }} Papers</span>
                    </div>
                  </div>

                  @if (savedPapers.length === 0) {
                    <div class="repo-empty">
                      <mat-icon>quiz</mat-icon>
                      <p>No saved question papers yet. Generate one in the Studio to save it automatically.</p>
                    </div>
                  } @else {
                    <div class="repo-grid">
                      @for (p of savedPapers; track p.id) {
                        <mat-card class="repo-item-card mat-elevation-z1">
                          <div class="card-top">
                            <span class="subject-pill">{{ p.subject }}</span>
                            <span class="marks-pill">{{ p.totalMarks }} Marks ({{ p.durationMinutes }}m)</span>
                          </div>
                          <h4 class="card-title">{{ p.title }}</h4>
                          <p class="card-meta">
                            <span>Class: <strong>{{ p.className }}</strong></span> • 
                            <span>Lang: <strong>{{ p.language }}</strong></span>
                          </p>
                          <span class="card-date">{{ p.createdAt | localDatetime:'datetime' }}</span>
                          <div class="card-actions">
                            <button mat-button color="primary" (click)="viewSavedPaper(p)">
                              <mat-icon>visibility</mat-icon> View &amp; Print
                            </button>
                            <button mat-icon-button color="warn" (click)="deleteSavedPaper(p.id)" matTooltip="Delete">
                              <mat-icon>delete</mat-icon>
                            </button>
                          </div>
                        </mat-card>
                      }
                    </div>
                  }
                </div>

                <!-- Saved Lesson Plans Section -->
                <div class="repo-section">
                  <div class="repo-header">
                    <div class="title-with-badge">
                      <h3>Saved NEP 2020 Lesson Plans</h3>
                      <span class="count-badge">{{ savedPlans.length }} Plans</span>
                    </div>
                  </div>

                  @if (savedPlans.length === 0) {
                    <div class="repo-empty">
                      <mat-icon>menu_book</mat-icon>
                      <p>No saved lesson plans yet. Generate one in the Lesson Planner tab to save it.</p>
                    </div>
                  } @else {
                    <div class="repo-grid">
                      @for (lp of savedPlans; track lp.id) {
                        <mat-card class="repo-item-card mat-elevation-z1">
                          <div class="card-top">
                            <span class="subject-pill plan-pill">{{ lp.subject }}</span>
                            <span class="marks-pill">{{ lp.totalPeriods }} Periods</span>
                          </div>
                          <h4 class="card-title">{{ lp.title }}</h4>
                          <p class="card-meta">
                            <span>Class: <strong>{{ lp.className }}</strong></span> • 
                            <span>Topic: <strong>{{ lp.topicOrChapter }}</strong></span>
                          </p>
                          <span class="card-date">{{ lp.createdAt | localDatetime:'datetime' }}</span>
                          <div class="card-actions">
                            <button mat-button color="primary" (click)="viewSavedPlan(lp)">
                              <mat-icon>visibility</mat-icon> View &amp; Print
                            </button>
                            <button mat-icon-button color="warn" (click)="deleteSavedPlan(lp.id)" matTooltip="Delete">
                              <mat-icon>delete</mat-icon>
                            </button>
                          </div>
                        </mat-card>
                      }
                    </div>
                  }
                </div>

              </div>
            </div>
          </mat-tab>

        </mat-tab-group>
      </mat-card>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .page-container {
      padding: 0 0 40px;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Page Header */
    .page-header-deck {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;

      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;

        .header-icon-box {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 6px 12px -2px rgba(37, 99, 235, 0.3);

          mat-icon { font-size: 28px; width: 28px; height: 28px; }
        }

        .header-titles {
          .title-row {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;

            .page-title {
              margin: 0;
              font-size: 1.35rem;
              font-weight: 700;
              color: #0f172a;
              letter-spacing: -0.02em;
            }

            .copilot-pill {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 3px 10px;
              background: #f5f3ff;
              border: 1px solid #ddd6fe;
              border-radius: 14px;
              font-size: 0.72rem;
              font-weight: 700;
              color: #6d28d9;

              .pulse-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #8b5cf6;
                box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
              }
            }
          }

          .page-subtitle {
            margin: 4px 0 0;
            font-size: 0.82rem;
            color: #64748b;
            max-width: 900px;
            line-height: 1.4;
          }
        }
      }

      .header-action-buttons {
        .header-action-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          border-radius: 8px;
          color: #334155;
        }
      }
    }

    .page-loader {
      border-radius: 4px;
    }

    /* Content Card */
    .content-card {
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }

    .copilot-tabs {
      .tab-icon { margin-right: 6px; }
    }

    .tab-body {
      padding: 20px;
    }

    /* Studio Layout */
    .studio-layout {
      display: grid;
      grid-template-columns: 420px 1fr;
      gap: 20px;

      @media (max-width: 1100px) {
        grid-template-columns: 1fr;
      }
    }

    /* Form Panel */
    .generator-form-panel {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;

      .panel-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e2e8f0;

        .panel-icon { color: #2563eb; }
        h3 { margin: 0; font-size: 1rem; font-weight: 700; color: #1e293b; }
      }

      .copilot-form {
        display: flex;
        flex-direction: column;
        gap: 12px;

        .full-span { width: 100%; margin-bottom: -1em; }

        .form-row-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          mat-form-field { margin-bottom: -1em; }
        }

        .form-row-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          mat-form-field { margin-bottom: -1em; }
        }

        .generate-submit-btn {
          height: 46px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 700;
          margin-top: 10px;
          background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
        }
      }
    }

    /* Right Preview Panel */
    .preview-panel {
      min-width: 0;
    }

    .empty-preview-card {
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
      padding: 60px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: #64748b;
      background: #ffffff;
      height: 100%;
      box-sizing: border-box;

      .empty-icon-wrap {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 14px;
        color: #94a3b8;
        mat-icon { font-size: 32px; width: 32px; height: 32px; }
      }

      h3 { margin: 0 0 8px; font-size: 1.15rem; color: #1e293b; }
      p { margin: 0; font-size: 0.85rem; max-width: 440px; line-height: 1.45; }
    }

    /* Paper Preview Wrapper */
    .paper-preview-wrapper, .plan-preview-wrapper {
      display: flex;
      flex-direction: column;
      gap: 14px;

      .paper-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 18px;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 8px;

        .toolbar-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 700;
          font-size: 0.9rem;
          color: #166534;
        }

        .toolbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;

          .print-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
          }
        }
      }
    }

    /* Printable Exam Sheet */
    .exam-sheet, .plan-sheet {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      font-family: 'Times New Roman', Times, serif;
      color: #000000;
      line-height: 1.4;

      .exam-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        border-bottom: 2px solid #000000;
        padding-bottom: 14px;
        margin-bottom: 12px;
        text-align: center;

        .exam-logo {
          max-height: 60px;
          max-width: 90px;
          object-fit: contain;
        }

        .exam-header-text {
          .inst-name {
            margin: 0;
            font-size: 1.4rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .inst-sub {
            margin: 2px 0 0;
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 0.3px;
          }
          .paper-title-heading {
            margin: 4px 0 0;
            font-size: 1.1rem;
            font-weight: 800;
            text-decoration: underline;
          }
        }
      }

      .paper-meta-strip {
        display: flex;
        justify-content: space-between;
        font-size: 0.88rem;
        padding: 6px 0;
        border-bottom: 1px solid #333333;
        margin-bottom: 10px;

        .meta-col {
          display: flex;
          flex-direction: column;
          gap: 2px;
          &.center { text-align: center; }
          &.right { text-align: right; }
        }
      }

      .candidate-box {
        display: flex;
        justify-content: space-between;
        font-size: 0.84rem;
        padding: 6px 0;
        border-bottom: 1px dashed #666666;
        margin-bottom: 12px;
      }

      .instructions-box {
        background: #fbfbfb;
        border: 1px solid #e5e5e5;
        padding: 8px 12px;
        margin-bottom: 16px;
        border-radius: 4px;

        .inst-title {
          font-weight: 800;
          font-size: 0.85rem;
          margin-bottom: 2px;
        }
        .inst-text {
          margin: 0;
          font-family: inherit;
          font-size: 0.8rem;
          white-space: pre-wrap;
          line-height: 1.35;
        }
      }

      .sections-container {
        display: flex;
        flex-direction: column;
        gap: 18px;

        .exam-section {
          .section-banner {
            display: flex;
            justify-content: space-between;
            background: #f1f5f9;
            padding: 4px 10px;
            font-weight: 800;
            font-size: 0.9rem;
            border-left: 4px solid #000000;
            margin-bottom: 10px;
          }

          .questions-list {
            display: flex;
            flex-direction: column;
            gap: 12px;

            .question-item {
              .q-main-row {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 12px;

                .q-left {
                  display: flex;
                  gap: 8px;
                  flex: 1 1 auto;

                  .q-num { font-weight: 800; font-size: 0.9rem; }

                  .q-texts {
                    p { margin: 0; font-size: 0.9rem; }
                    .q-text-hi { color: #1e3a8a; font-family: sans-serif; font-size: 0.86rem; margin-top: 2px; }
                  }
                }

                .q-marks {
                  font-weight: 800;
                  font-size: 0.88rem;
                  white-space: nowrap;
                }
              }

              .mcq-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 6px 14px;
                padding-left: 28px;
                margin-top: 6px;
                font-size: 0.86rem;

                .mcq-opt {
                  display: flex;
                  align-items: center;
                  gap: 4px;

                  .opt-label { font-weight: 700; }
                  .opt-hi { color: #1e3a8a; font-family: sans-serif; font-size: 0.82rem; }
                }
              }

              .solution-box {
                background: #f0fdf4;
                border: 1px solid #bbf7d0;
                border-radius: 6px;
                padding: 6px 12px;
                margin: 6px 0 0 28px;
                font-family: sans-serif;
                font-size: 0.8rem;

                .sol-hdr {
                  display: flex;
                  align-items: center;
                  gap: 4px;
                  color: #166534;
                  mat-icon { font-size: 14px; width: 14px; height: 14px; }
                }
                .sol-steps { margin: 2px 0 0; color: #15803d; }
              }
            }
          }
        }
      }

      .exam-footer {
        text-align: center;
        font-weight: 700;
        font-size: 0.85rem;
        padding-top: 20px;
        margin-top: 20px;
        border-top: 1px solid #000000;
      }
    }

    /* Lesson Plan Sheet */
    .plan-sheet {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

      .plan-header {
        text-align: center;
        border-bottom: 2px solid #2563eb;
        padding-bottom: 12px;
        margin-bottom: 16px;

        .inst-name { margin: 0; font-size: 1.3rem; font-weight: 800; color: #1e3a8a; }
        .plan-title-heading { margin: 4px 0; font-size: 1.1rem; color: #0f172a; }
        .plan-meta-line {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 0.82rem;
          color: #475569;
          flex-wrap: wrap;
        }
      }

      .plan-section-box {
        margin-bottom: 16px;

        .sec-hdr {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
          color: #1e40af;

          mat-icon { font-size: 18px; width: 18px; height: 18px; }
          h4 { margin: 0; font-size: 0.92rem; font-weight: 700; }
        }

        .sec-text {
          margin: 0;
          font-family: inherit;
          font-size: 0.85rem;
          color: #334155;
          line-height: 1.45;
          white-space: pre-wrap;
          background: #f8fafc;
          padding: 8px 12px;
          border-radius: 6px;
          border-left: 3px solid #3b82f6;
        }
      }

      .plan-period-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;

        th, td {
          border: 1px solid #cbd5e1;
          padding: 8px 10px;
          text-align: left;
          vertical-align: top;
        }

        th { background: #f1f5f9; font-weight: 700; color: #1e293b; }

        .col-p-num { font-weight: 700; white-space: nowrap; color: #2563eb; }
        .col-phase {
          .phase-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            background: #e0e7ff;
            color: #4338ca;
            font-weight: 700;
            font-size: 0.75rem;
            white-space: nowrap;
          }
        }
      }

      .signatures-strip {
        display: flex;
        justify-content: space-between;
        padding-top: 30px;
        margin-top: 20px;
        border-top: 1px solid #e2e8f0;

        .sig-col {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;

          &.right { align-items: flex-end; }
          .sig-line { font-family: monospace; color: #94a3b8; }
          .sig-label { font-size: 0.8rem; font-weight: 600; color: #475569; }
        }
      }
    }

    /* Repository Section */
    .repository-view {
      display: flex;
      flex-direction: column;
      gap: 28px;

      .repo-section {
        .repo-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;

          .title-with-badge {
            display: flex;
            align-items: center;
            gap: 10px;

            h3 { margin: 0; font-size: 1.05rem; font-weight: 700; color: #1e293b; }
            .count-badge {
              font-size: 0.74rem;
              font-weight: 700;
              padding: 2px 8px;
              border-radius: 12px;
              background: #f1f5f9;
              color: #475569;
            }
          }
        }

        .repo-empty {
          padding: 30px 20px;
          text-align: center;
          color: #94a3b8;
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
          mat-icon { font-size: 32px; width: 32px; height: 32px; margin-bottom: 6px; }
          p { margin: 0; font-size: 0.85rem; }
        }

        .repo-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;

          @media (max-width: 900px) {
            grid-template-columns: repeat(2, 1fr);
          }
          @media (max-width: 600px) {
            grid-template-columns: 1fr;
          }

          .repo-item-card {
            border-radius: 10px;
            padding: 14px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            display: flex;
            flex-direction: column;
            gap: 6px;

            .card-top {
              display: flex;
              align-items: center;
              justify-content: space-between;

              .subject-pill {
                font-size: 0.72rem;
                font-weight: 700;
                padding: 2px 6px;
                border-radius: 4px;
                background: #dbeafe;
                color: #1e40af;

                &.plan-pill {
                  background: #f3e8ff;
                  color: #7e22ce;
                }
              }

              .marks-pill {
                font-size: 0.72rem;
                color: #64748b;
                font-weight: 600;
              }
            }

            .card-title {
              margin: 4px 0 0;
              font-size: 0.92rem;
              font-weight: 700;
              color: #0f172a;
              line-height: 1.3;
            }

            .card-meta {
              margin: 0;
              font-size: 0.78rem;
              color: #64748b;
              strong { color: #334155; }
            }

            .card-date {
              font-size: 0.7rem;
              color: #94a3b8;
            }

            .card-actions {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-top: 1px solid #f1f5f9;
              padding-top: 8px;
              margin-top: 4px;
            }
          }
        }
      }
    }

    /* Print Styles */
    @media print {
      .no-print, .page-header-deck, .copilot-tabs, mat-tab-header, .generator-form-panel {
        display: none !important;
      }

      .page-container {
        padding: 0 !important;
      }

      .content-card {
        border: none !important;
        box-shadow: none !important;
      }

      .exam-sheet, .plan-sheet {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeacherCopilotComponent implements OnInit {
  private fb = inject(FormBuilder);
  private copilotService = inject(TeacherCopilotService);
  private authService = inject(AuthService);
  private schoolService = inject(SchoolService);
  private branchService = inject(BranchService);
  private subjectsService = inject(SubjectsService);
  private confirmDialog = inject(ConfirmDialogService);
  private cdr = inject(ChangeDetectorRef);

  activeTabIndex = 0;
  loading = false;
  showSolutions = false;

  paperForm!: FormGroup;
  planForm!: FormGroup;

  currentPaper: TeacherQuestionPaperDto | null = null;
  currentPlan: TeacherAiLessonPlanDto | null = null;

  savedPapers: TeacherQuestionPaperDto[] = [];
  savedPlans: TeacherAiLessonPlanDto[] = [];

  classes: SchoolClassDto[] = [];
  branches: BranchDto[] = [];

  allSubjects: SubjectDto[] = [];
  paperSubjects: SubjectDto[] = [];
  planSubjects: SubjectDto[] = [];

  instituteName = '';
  instituteLogo = '';

  ngOnInit(): void {
    this.instituteName = this.authService.getInstituteName() || 'Institution of Learning';
    this.instituteLogo = this.authService.getInstituteLogoUrl() || '';

    const activeBranchId = this.authService.selectedBranchId() || this.authService.currentUser()?.branchId || '';

    this.paperForm = this.fb.group({
      branchId: [activeBranchId],
      title: ['Term Examination / Periodic Assessment', Validators.required],
      subject: ['', Validators.required],
      className: ['', Validators.required],
      boardOrCurriculum: ['CBSE / State Board Standard'],
      totalMarks: [50, Validators.required],
      durationMinutes: [90, Validators.required],
      difficultyLevel: ['Balanced', Validators.required],
      language: ['Bilingual', Validators.required],
      chaptersList: [''],
      includeSolutions: [true]
    });

    this.planForm = this.fb.group({
      branchId: [activeBranchId],
      subject: ['', Validators.required],
      className: ['', Validators.required],
      topicOrChapter: ['', Validators.required],
      totalPeriods: [4, Validators.required],
      pedagogicalApproach: ['5E Inquiry Model (NEP 2020)', Validators.required]
    });

    this.loadClasses();
    this.loadSubjects();
    this.loadBranches();
    this.loadSavedLibrary();
  }

  loadClasses(): void {
    this.schoolService.getClasses().subscribe({
      next: (cList: SchoolClassDto[]) => {
        this.classes = cList || [];
        if (this.classes.length > 0) {
          const firstClass = this.classes[0].name;
          if (!this.paperForm.get('className')?.value) {
            this.paperForm.patchValue({ className: firstClass });
            this.onPaperClassChange(firstClass);
          }
          if (!this.planForm.get('className')?.value) {
            this.planForm.patchValue({ className: firstClass });
            this.onPlanClassChange(firstClass);
          }
        }
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  loadSubjects(): void {
    this.subjectsService.getSubjects(true).subscribe({
      next: (sList: SubjectDto[]) => {
        this.allSubjects = sList || [];
        if (this.paperSubjects.length === 0) {
          this.paperSubjects = [...this.allSubjects];
          if (this.paperSubjects.length > 0 && !this.paperForm.get('subject')?.value) {
            this.paperForm.patchValue({ subject: this.paperSubjects[0].name });
          }
        }
        if (this.planSubjects.length === 0) {
          this.planSubjects = [...this.allSubjects];
          if (this.planSubjects.length > 0 && !this.planForm.get('subject')?.value) {
            this.planForm.patchValue({ subject: this.planSubjects[0].name });
          }
        }
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  onPaperClassChange(className: string): void {
    const matchedClass = this.classes.find(c => c.name === className);
    if (matchedClass) {
      this.subjectsService.getClassSubjects(matchedClass.id).subscribe({
        next: (csList: ClassSubjectDto[]) => {
          if (csList && csList.length > 0) {
            this.paperSubjects = csList.map(cs => ({
              id: cs.subjectId,
              name: cs.subjectName,
              isActive: true,
              createdAt: cs.createdAt
            }));
          } else {
            this.paperSubjects = [...this.allSubjects];
          }
          if (this.paperSubjects.length > 0) {
            const currentSub = this.paperForm.get('subject')?.value;
            const exists = this.paperSubjects.some(s => s.name === currentSub);
            if (!exists) {
              this.paperForm.patchValue({ subject: this.paperSubjects[0].name });
            }
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.paperSubjects = [...this.allSubjects];
          this.cdr.markForCheck();
        }
      });
    }
  }

  onPlanClassChange(className: string): void {
    const matchedClass = this.classes.find(c => c.name === className);
    if (matchedClass) {
      this.subjectsService.getClassSubjects(matchedClass.id).subscribe({
        next: (csList: ClassSubjectDto[]) => {
          if (csList && csList.length > 0) {
            this.planSubjects = csList.map(cs => ({
              id: cs.subjectId,
              name: cs.subjectName,
              isActive: true,
              createdAt: cs.createdAt
            }));
          } else {
            this.planSubjects = [...this.allSubjects];
          }
          if (this.planSubjects.length > 0) {
            const currentSub = this.planForm.get('subject')?.value;
            const exists = this.planSubjects.some(s => s.name === currentSub);
            if (!exists) {
              this.planForm.patchValue({ subject: this.planSubjects[0].name });
            }
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.planSubjects = [...this.allSubjects];
          this.cdr.markForCheck();
        }
      });
    }
  }

  loadBranches(): void {
    this.branchService.getBranches().subscribe({
      next: (bList: BranchDto[]) => {
        this.branches = bList || [];
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  loadSavedLibrary(): void {
    const activeBranchId = this.authService.selectedBranchId();
    this.copilotService.getQuestionPapers({ branchId: activeBranchId }).subscribe({
      next: (papers) => {
        this.savedPapers = papers || [];
        this.cdr.markForCheck();
      },
      error: () => {}
    });

    this.copilotService.getLessonPlans({ branchId: activeBranchId }).subscribe({
      next: (plans) => {
        this.savedPlans = plans || [];
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  generatePaper(): void {
    if (this.paperForm.invalid || this.loading) return;

    this.loading = true;
    this.cdr.markForCheck();

    const fv = this.paperForm.value;

    this.copilotService.generateQuestionPaper({
      branchId: fv.branchId || null,
      title: fv.title,
      subject: fv.subject,
      className: fv.className,
      boardOrCurriculum: fv.boardOrCurriculum,
      totalMarks: Number(fv.totalMarks),
      durationMinutes: Number(fv.durationMinutes),
      difficultyLevel: fv.difficultyLevel,
      language: fv.language,
      chaptersList: fv.chaptersList,
      includeSolutions: fv.includeSolutions
    }).subscribe({
      next: (res: TeacherQuestionPaperDto) => {
        this.currentPaper = res;
        this.loading = false;
        this.loadSavedLibrary();
        this.cdr.markForCheck();
        this.confirmDialog.alert('Question Paper Synthesized', `Successfully generated ${res.title} with blueprint and marking scheme.`, 'success');
      },
      error: (err) => {
        this.loading = false;
        this.cdr.markForCheck();
        this.confirmDialog.alert('Generation Error', err?.error?.message || err?.message || 'Failed to synthesize question paper.', 'danger');
      }
    });
  }

  generateLessonPlan(): void {
    if (this.planForm.invalid || this.loading) return;

    this.loading = true;
    this.cdr.markForCheck();

    const fv = this.planForm.value;

    this.copilotService.generateLessonPlan({
      branchId: fv.branchId || null,
      subject: fv.subject,
      className: fv.className,
      topicOrChapter: fv.topicOrChapter,
      totalPeriods: Number(fv.totalPeriods),
      pedagogicalApproach: fv.pedagogicalApproach
    }).subscribe({
      next: (res: TeacherAiLessonPlanDto) => {
        this.currentPlan = res;
        this.loading = false;
        this.loadSavedLibrary();
        this.cdr.markForCheck();
        this.confirmDialog.alert('NEP Lesson Plan Ready', `Successfully drafted NEP 2020 5E lesson plan for "${res.topicOrChapter}".`, 'success');
      },
      error: (err) => {
        this.loading = false;
        this.cdr.markForCheck();
        this.confirmDialog.alert('Generation Error', err?.error?.message || err?.message || 'Failed to draft lesson plan.', 'danger');
      }
    });
  }

  toggleSolutions(): void {
    this.showSolutions = !this.showSolutions;
  }

  getOptionLetter(idx: number): string {
    return ['A', 'B', 'C', 'D', 'E'][idx] || `${idx + 1}`;
  }

  printQuestionPaper(): void {
    window.print();
  }

  printLessonPlan(): void {
    window.print();
  }

  viewSavedPaper(p: TeacherQuestionPaperDto): void {
    this.currentPaper = p;
    this.activeTabIndex = 0;
    this.cdr.markForCheck();
  }

  deleteSavedPaper(id: string): void {
    this.confirmDialog.confirm('Delete Question Paper', 'Are you sure you want to remove this question paper?', 'Delete', 'Cancel', 'danger')
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.copilotService.deleteQuestionPaper(id).subscribe({
          next: () => {
            if (this.currentPaper?.id === id) this.currentPaper = null;
            this.loadSavedLibrary();
          }
        });
      });
  }

  viewSavedPlan(lp: TeacherAiLessonPlanDto): void {
    this.currentPlan = lp;
    this.activeTabIndex = 1;
    this.cdr.markForCheck();
  }

  deleteSavedPlan(id: string): void {
    this.confirmDialog.confirm('Delete Lesson Plan', 'Are you sure you want to remove this NEP lesson plan?', 'Delete', 'Cancel', 'danger')
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.copilotService.deleteLessonPlan(id).subscribe({
          next: () => {
            if (this.currentPlan?.id === id) this.currentPlan = null;
            this.loadSavedLibrary();
          }
        });
      });
  }
}
