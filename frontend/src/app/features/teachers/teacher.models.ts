export const API_BASE = 'http://localhost:5000/api';

export interface TeacherDto {
  id: string; employeeCode: string; fullName: string; fatherName?: string;
  gender: string; dateOfBirth?: string; qualification?: string; specialization?: string;
  experienceYears: number; phoneNumber: string; whatsAppPhone?: string;
  email?: string; address?: string; photoUrl?: string;
  joiningDate: string; leavingDate?: string; isActive: boolean;
  createdAt: string; assignedBatchCount: number;
}
export interface BatchAssignmentDto {
  id: string; teacherId: string; teacherName: string; batchId: string;
  batchName: string; subject: string; daysOfWeek?: string; timeSlot?: string;
  isActive: boolean; assignedAt: string;
}
export interface AttendanceDto {
  id: string; teacherId: string; teacherName: string; employeeCode: string;
  attendanceDate: string; status: string; checkInTime?: string; checkOutTime?: string; remarks?: string; captureSource?: string; capturedAt?: string;
}
export interface AttendanceSettingsDto { studentMode: 'Manual' | 'Biometric' | 'Both'; teacherMode: 'Manual' | 'Biometric' | 'Both'; }
export interface AttendancePermissionsDto {
  canChangeMode: boolean; canManualMark: boolean; canBiometricCapture: boolean;
  canMapBiometric: boolean; canCorrectAttendance: boolean;
}
export interface AttendanceSummaryDto {
  presentDays: number; absentDays: number; lateDays: number; halfDays: number;
  holidayDays: number; totalWorkingDays: number; attendancePercentage: number;
  allowedLateDays?: number; excessLateDays?: number; latePenaltyDays?: number; payableDays?: number;
}

export interface PayrollPreviewDto {
  teacherId: string; teacherName: string; employeeCode: string;
  month: number; year: number;
  basicSalary: number; hra: number; otherAllowances: number; grossSalary: number;
  pfDeduction: number; tdsDeduction: number; otherDeductions: number;
  totalWorkingDays: number; perDayRate: number;
  presentDays: number; absentDays: number; halfDays: number; lateDays: number;
  allowedLateDays: number; excessLateDays: number; latePenaltyDays: number;
  absentDeduction: number; halfDayDeduction: number; latePenaltyDeduction: number;
  totalAttendanceDeduction: number; pendingAdvance: number; recommendedNetPaid: number;
}
export interface SalaryDto {
  id: string; teacherId: string; teacherName: string;
  basicSalary: number; hra: number; otherAllowances: number; grossSalary: number;
  pfDeduction: number; tdsDeduction: number; otherDeductions: number; netSalary: number;
  effectiveFrom: string; effectiveTo?: string; isActive: boolean;
}
export interface SalaryPaymentDto {
  id: string; teacherId: string; teacherName: string; employeeCode: string;
  paymentMonth: number; paymentYear: number; monthName: string; paymentDate: string;
  grossAmount: number; deductions: number; advanceAdjusted: number; netPaid: number;
  paymentMode: string; transactionRef?: string; receiptNumber: string;
  presentDays: number; absentDays: number; remarks?: string;
}
export interface AdvanceDto {
  id: string; teacherId: string; teacherName: string; employeeCode: string;
  amount: number; requestDate: string; approvedDate?: string; reason?: string;
  status: string; adjustedInMonth?: number; adjustedInYear?: number;
}
export interface LeaveDto {
  id: string; teacherId: string; teacherName: string; employeeCode: string;
  leaveType: string; fromDate: string; toDate: string; totalDays: number;
  reason?: string; status: string; approvedBy?: string; approvedAt?: string;
  rejectionReason?: string; createdAt: string;
}
export interface BatchDto {
  id: string; name: string; subject: string; academicYear: string;
  standardMonthlyFee: number; studentCount: number;
}

export interface SubjectDto {
  id: string;
  name: string;
  code?: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface HolidayDto {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  holidayType: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface TeacherWorkloadSummaryItemDto {
  teacherId: string;
  teacherName: string;
  employeeCode: string;
  qualification?: string;
  specialization?: string;
  assignedBatchCount: number;
  weeklyClassesCount: number;
  weeklyHours: number;
  totalStudentReach: number;
  assignedBatches: BatchAssignmentDto[];
}

export interface TeacherWorkloadReportDto {
  totalActiveTeachers: number;
  totalAssignedBatches: number;
  totalWeeklyClasses: number;
  totalWeeklyHours: number;
  totalStudentsReached: number;
  teachers: TeacherWorkloadSummaryItemDto[];
}

export interface TeacherBatchCoverageReportDto {
  totalBatches: number;
  assignedBatchesCount: number;
  unassignedBatchesCount: number;
  coveragePercentage: number;
  unassignedBatches: BatchDto[];
  allAssignments: BatchAssignmentDto[];
}

export interface TeacherMonthlyPayrollReportDto {
  month: number;
  year: number;
  monthName: string;
  totalTeachers: number;
  paidTeachersCount: number;
  pendingTeachersCount: number;
  totalGrossAmount: number;
  totalDeductions: number;
  totalAdvancesAdjusted: number;
  totalNetPaid: number;
  payments: SalaryPaymentDto[];
}

export interface AttendanceReportRowDto {
  personId: string;
  personName: string;
  name?: string;
  code: string;
  groupName?: string;
  batchOrRoleName?: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  holidayDays: number;
  totalWorkingDays: number;
  attendancePercentage: number;
  dailyStatuses?: string;
}

export interface AttendanceReportDto {
  reportType: string;
  month: number;
  year: number;
  totalRecords: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalHalfDays: number;
  totalHolidays: number;
  rows: AttendanceReportRowDto[];
}

