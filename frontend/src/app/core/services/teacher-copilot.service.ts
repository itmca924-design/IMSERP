import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface QuestionItemDto {
  questionNumber: number;
  questionTextEn: string;
  questionTextHi?: string;
  marks: number;
  questionType: 'MCQ' | 'VeryShort' | 'Short' | 'Long' | 'CaseStudy';
  optionsEn?: string[];
  optionsHi?: string[];
  correctAnswerOrKey?: string;
  stepWiseExplanation?: string;
}

export interface QuestionSectionDto {
  sectionName: string;
  sectionTitle: string;
  marksPerQuestion: number;
  totalQuestions: number;
  sectionTotalMarks: number;
  questions: QuestionItemDto[];
}

export interface GenerateQuestionPaperRequestDto {
  branchId?: string | null;
  title: string;
  subject: string;
  className: string;
  boardOrCurriculum?: string;
  totalMarks: number;
  durationMinutes: number;
  difficultyLevel: 'Easy' | 'Moderate' | 'Challenging' | 'Balanced';
  language: 'English' | 'Hindi' | 'Bilingual';
  chaptersList: string;
  includeSolutions: boolean;
}

export interface TeacherQuestionPaperDto {
  id: string;
  tenantId: string;
  branchId?: string;
  branchName?: string;
  title: string;
  subject: string;
  className: string;
  boardOrCurriculum: string;
  totalMarks: number;
  durationMinutes: number;
  difficultyLevel: string;
  language: string;
  chaptersList: string;
  generalInstructions: string;
  sections: QuestionSectionDto[];
  markingSchemeHtmlOrJson?: string;
  createdBy: string;
  createdAt: string;
}

export interface LessonPeriodItemDto {
  periodNumber: number;
  phaseName: string;
  keyConcept: string;
  teacherAction: string;
  studentActivity: string;
  teachingAidsUsed: string;
  assessmentCheck: string;
}

export interface GenerateAiLessonPlanRequestDto {
  branchId?: string | null;
  subject: string;
  className: string;
  topicOrChapter: string;
  totalPeriods: number;
  pedagogicalApproach?: string;
}

export interface TeacherAiLessonPlanDto {
  id: string;
  tenantId: string;
  branchId?: string;
  branchName?: string;
  title: string;
  subject: string;
  className: string;
  topicOrChapter: string;
  totalPeriods: number;
  pedagogicalApproach: string;
  learningObjectives: string;
  teachingAidsAndResources: string;
  periods: LessonPeriodItemDto[];
  formativeAssessmentQuestions: string;
  homeworkAndWorksheetAssignment: string;
  createdBy: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class TeacherCopilotService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/teacher-copilot`;

  generateQuestionPaper(dto: GenerateQuestionPaperRequestDto): Observable<TeacherQuestionPaperDto> {
    return this.http.post<TeacherQuestionPaperDto>(`${this.apiUrl}/generate-paper`, dto);
  }

  getQuestionPapers(params?: { branchId?: string | null; subject?: string | null; className?: string | null }): Observable<TeacherQuestionPaperDto[]> {
    let httpParams = new HttpParams();
    if (params?.branchId) httpParams = httpParams.set('branchId', params.branchId);
    if (params?.subject) httpParams = httpParams.set('subject', params.subject.trim());
    if (params?.className) httpParams = httpParams.set('className', params.className.trim());
    return this.http.get<TeacherQuestionPaperDto[]>(`${this.apiUrl}/papers`, { params: httpParams });
  }

  getQuestionPaperById(id: string): Observable<TeacherQuestionPaperDto> {
    return this.http.get<TeacherQuestionPaperDto>(`${this.apiUrl}/papers/${id}`);
  }

  deleteQuestionPaper(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/papers/${id}`);
  }

  generateLessonPlan(dto: GenerateAiLessonPlanRequestDto): Observable<TeacherAiLessonPlanDto> {
    return this.http.post<TeacherAiLessonPlanDto>(`${this.apiUrl}/generate-lesson-plan`, dto);
  }

  getLessonPlans(params?: { branchId?: string | null; subject?: string | null; className?: string | null }): Observable<TeacherAiLessonPlanDto[]> {
    let httpParams = new HttpParams();
    if (params?.branchId) httpParams = httpParams.set('branchId', params.branchId);
    if (params?.subject) httpParams = httpParams.set('subject', params.subject.trim());
    if (params?.className) httpParams = httpParams.set('className', params.className.trim());
    return this.http.get<TeacherAiLessonPlanDto[]>(`${this.apiUrl}/lesson-plans`, { params: httpParams });
  }

  deleteLessonPlan(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/lesson-plans/${id}`);
  }
}
