import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';
import { LayoutComponent } from './layout/layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { BatchesComponent } from './features/batches/batches.component';
import { SubjectsComponent } from './features/subjects/subjects.component';
import { StudentsComponent } from './features/students/students.component';
import { StudentAttendanceComponent } from './features/students/student-attendance.component';
import { RolesComponent } from './features/roles/roles.component';
import { UsersComponent } from './features/users/users.component';
import { FeesComponent } from './features/fees/fees.component';
import { TestsComponent } from './features/tests/tests.component';
import { WhatsAppLogsComponent } from './features/whatsapp/whatsapp.component';
import { TeacherProfilesComponent } from './features/teachers/teacher-profiles.component';
import { TeacherAssignmentsComponent } from './features/teachers/teacher-assignments.component';
import { TeacherAttendanceComponent } from './features/teachers/teacher-attendance.component';
import { TeacherSalaryComponent } from './features/teachers/teacher-salary.component';
import { TeacherPaymentsComponent } from './features/teachers/teacher-payments.component';
import { TeacherAdvancesComponent } from './features/teachers/teacher-advances.component';
import { TeacherLeavesComponent } from './features/teachers/teacher-leaves.component';
import { HolidaysComponent } from './features/holidays/holidays.component';
import { AttendanceReportsComponent } from './features/attendance/attendance-reports.component';
import { BiometricDevicesComponent } from './features/attendance/biometric-devices.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },

      // Master Management
      { path: 'batches', component: BatchesComponent },
      { path: 'subjects', component: SubjectsComponent },
      { path: 'students', component: StudentsComponent },
      { path: 'students/attendance', component: StudentAttendanceComponent },
      { path: 'holidays', component: HolidaysComponent },
      { path: 'attendance/reports', component: AttendanceReportsComponent },
      { path: 'attendance/devices', component: BiometricDevicesComponent },

      // Teacher Module – 7 dedicated pages
      { path: 'teachers', component: TeacherProfilesComponent },
      { path: 'teachers/assignments', component: TeacherAssignmentsComponent },
      { path: 'teachers/attendance', component: TeacherAttendanceComponent },
      { path: 'teachers/salary', component: TeacherSalaryComponent },
      { path: 'teachers/payments', component: TeacherPaymentsComponent },
      { path: 'teachers/advances', component: TeacherAdvancesComponent },
      { path: 'teachers/leaves', component: TeacherLeavesComponent },

      // Academic Operations
      { path: 'fees', component: FeesComponent },
      { path: 'tests', component: TestsComponent },
      { path: 'whatsapp', component: WhatsAppLogsComponent },

      // Admin Settings
      { path: 'roles', component: RolesComponent },
      { path: 'users', component: UsersComponent },
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
