export interface CoachingBatch {
  id: string;
  name: string;
  subject?: string;
  academicYear?: string;
  standardMonthlyFee?: number;
  studentCount?: number;
  branchId?: string;
  branchName?: string;
  roomId?: string;
  roomName?: string;
  classId?: string;
  className?: string;
  mentorTeacherId?: string;
  mentorTeacherName?: string;
  mentorTeacherPhone?: string;
  shift?: string;
  startTime?: string;
  endTime?: string;
}

export interface CoachingStudent {
  id: string;
  studentName: string;
  rollNumber?: string;
  coachingRollNumber?: string;
  admissionNumber?: string;
  fatherName?: string;
  motherName?: string;
  mobileNumber?: string;
  parentWhatsAppPhone?: string;
  joiningDate?: string;
  profilePhoto?: string;
  batchId?: string;
  batchName?: string;
  classId?: string;
  className?: string;
  isActive: boolean;
  isCoachingStudent: boolean;
  isSchoolStudent?: boolean;
}

export interface CoachingAttendanceItem {
  studentId: string;
  studentName: string;
  rollNumber?: string;
  coachingRollNumber?: string;
  profilePhoto?: string;
  parentWhatsAppPhone?: string;
  status: 'Present' | 'Absent' | 'Late' | 'HalfDay' | 'Leave';
  checkInTime?: string;
  checkOutTime?: string;
  remarks?: string;
  isPriorToJoining?: boolean;
}

export interface BatchTimetableSlot {
  id: string;
  dayOfWeek: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  teacherName?: string;
  teacherId?: string;
  roomNumber?: string;
}

export interface CoachingFeeSummary {
  studentId: string;
  studentName: string;
  rollNumber?: string;
  coachingRollNumber?: string;
  fatherName?: string;
  parentPhone?: string;
  batchId: string;
  batchName: string;
  monthlyFee: number;
  totalBilled: number;
  totalCollected: number;
  outstandingBalance: number;
  lastPaymentDate?: string;
  lastPaymentReceiptNo?: string;
  status: 'Clear' | 'Partial' | 'Overdue';
}
