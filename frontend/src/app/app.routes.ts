import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },

      // Master Management
      {
        path: 'branches',
        loadComponent: () => import('./features/branches/branches.component').then(m => m.BranchesComponent)
      },
      {
        path: 'batches',
        loadComponent: () => import('./features/batches/batches.component').then(m => m.BatchesComponent)
      },
      {
        path: 'rooms',
        loadComponent: () => import('./features/rooms/rooms.component').then(m => m.RoomsComponent)
      },
      {
        path: 'subjects',
        loadComponent: () => import('./features/subjects/subjects.component').then(m => m.SubjectsComponent)
      },
      {
        path: 'students',
        loadComponent: () => import('./features/students/students.component').then(m => m.StudentsComponent)
      },
      {
        path: 'students/attendance',
        loadComponent: () => import('./features/students/student-attendance.component').then(m => m.StudentAttendanceComponent)
      },
      {
        path: 'holidays',
        loadComponent: () => import('./features/holidays/holidays.component').then(m => m.HolidaysComponent)
      },
      {
        path: 'attendance/reports',
        loadComponent: () => import('./features/attendance/attendance-reports.component').then(m => m.AttendanceReportsComponent)
      },
      {
        path: 'attendance/devices',
        loadComponent: () => import('./features/attendance/biometric-devices.component').then(m => m.BiometricDevicesComponent)
      },

      // Teacher Module – 7 dedicated pages
      {
        path: 'teachers',
        loadComponent: () => import('./features/teachers/teacher-profiles.component').then(m => m.TeacherProfilesComponent)
      },
      {
        path: 'teachers/assignments',
        loadComponent: () => import('./features/teachers/teacher-assignments.component').then(m => m.TeacherAssignmentsComponent)
      },
      {
        path: 'teachers/attendance',
        loadComponent: () => import('./features/teachers/teacher-attendance.component').then(m => m.TeacherAttendanceComponent)
      },
      {
        path: 'teachers/salary',
        loadComponent: () => import('./features/teachers/teacher-salary.component').then(m => m.TeacherSalaryComponent)
      },
      {
        path: 'teachers/payments',
        loadComponent: () => import('./features/teachers/teacher-payments.component').then(m => m.TeacherPaymentsComponent)
      },
      {
        path: 'teachers/advances',
        loadComponent: () => import('./features/teachers/teacher-advances.component').then(m => m.TeacherAdvancesComponent)
      },
      {
        path: 'teachers/leaves',
        loadComponent: () => import('./features/teachers/teacher-leaves.component').then(m => m.TeacherLeavesComponent)
      },
      {
        path: 'teachers/reports',
        loadComponent: () => import('./features/teachers/teacher-reports.component').then(m => m.TeacherReportsComponent)
      },

      // Academic Operations
      {
        path: 'fees',
        loadComponent: () => import('./features/fees/fees.component').then(m => m.FeesComponent)
      },
      {
        path: 'tests',
        loadComponent: () => import('./features/tests/tests.component').then(m => m.TestsComponent)
      },
      {
        path: 'whatsapp',
        loadComponent: () => import('./features/whatsapp/whatsapp.component').then(m => m.WhatsAppLogsComponent)
      },

      // Admin Settings
      {
        path: 'roles',
        loadComponent: () => import('./features/roles/roles.component').then(m => m.RolesComponent)
      },
      {
        path: 'users',
        loadComponent: () => import('./features/users/users.component').then(m => m.UsersComponent)
      },
      {
        path: 'admin/tenants',
        loadComponent: () => import('./features/tenants/tenants.component').then(m => m.TenantsComponent)
      },
      { path: 'tenants', redirectTo: 'admin/tenants', pathMatch: 'full' },
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
