export interface StudyMaterialDto {
  id: string;
  tenantId: string;
  branchId?: string | null;
  title: string;
  description?: string | null;
  targetScope: 'Both' | 'School' | 'Coaching' | string;
  classId?: string | null;
  className?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  batchId?: string | null;
  batchName?: string | null;
  subjectId?: string | null;
  subject: string;
  materialType: 'Notes' | 'PYQ' | 'QuestionBank' | 'FormulaSheet' | 'SamplePaper' | 'Syllabus' | string;
  chapterName?: string | null;
  topic?: string | null;
  academicYear?: string | null;
  targetExam?: string | null;
  examYear?: string | null;
  hasSolutions: boolean;
  difficultyLevel?: string | null;
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  fileFormat: string;
  externalLink?: string | null;
  solutionFileUrl?: string | null;
  solutionFileName?: string | null;
  uploadedByName: string;
  uploadedByUserId?: string | null;
  downloadCount: number;
  viewCount: number;
  isPublished: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudyMaterialDto {
  title: string;
  description?: string;
  targetScope: string;
  classId?: string | null;
  sectionId?: string | null;
  batchId?: string | null;
  subjectId?: string | null;
  subject: string;
  materialType: string;
  chapterName?: string;
  topic?: string;
  academicYear?: string;
  targetExam?: string;
  examYear?: string;
  hasSolutions: boolean;
  difficultyLevel?: string;
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  fileFormat: string;
  externalLink?: string;
  solutionFileUrl?: string;
  solutionFileName?: string;
  isPublished: boolean;
  isFeatured: boolean;
}

export interface StudyMaterialStatsDto {
  totalItems: number;
  notesCount: number;
  pyqCount: number;
  questionBankCount: number;
  formulaSheetCount: number;
  totalDownloads: number;
  topSubjects: { subject: string; count: number }[];
}

export interface StudyMaterialPagedResult {
  items: StudyMaterialDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
