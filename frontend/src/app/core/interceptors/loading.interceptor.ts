import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LoadingService } from '../services/loading.service';
import { finalize } from 'rxjs';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  // Exclude silent background calls and layout shell background hydration so they don't lock the screen or violate the Strict Single Loader Rule
  const isSilent = 
    req.url.includes('/api/auth/refresh-token') ||
    req.url.includes('/api/auth/revoke-token') ||
    req.url.includes('/subscription/pricing-config') ||
    req.url.includes('/api/chat') ||
    req.url.includes('/api/presence') ||
    req.url.includes('/api/menu/my-menu') ||
    req.url.includes('/api/tenants/current') ||
    req.url.includes('/api/users/me') ||
    req.url.includes('/api/roles/my-permissions') ||
    req.url.includes('/api/school/smart-bell-settings') ||
    req.url.includes('/api/school/period-slots') ||
    req.url.includes('/api/events/dashboard-summary') ||
    req.url.includes('/api/dashboard/urgent-fee-reminders') ||
    req.url.includes('/api/biometric-devices/events') ||
    (req.method === 'GET' && req.url.includes('/api/holidays') && req.url.includes('activeOnly=true')) ||
    req.headers.has('X-Skip-Loader');

  if (isSilent) {
    return next(req);
  }

  // Determine friendly message based on action
  let msg = 'Loading Institute Data...';
  if (req.method === 'POST') {
    msg = req.url.includes('/login') ? 'Authenticating credentials...' : 'Processing request...';
  } else if (req.method === 'PUT') {
    msg = 'Saving updates...';
  } else if (req.method === 'DELETE') {
    msg = 'Removing record...';
  } else if (req.url.includes('/dashboard/summary')) {
    msg = 'Syncing Institute Analytics...';
  } else if (req.url.includes('/students')) {
    msg = 'Loading Student Records...';
  } else if (req.url.includes('/fees')) {
    msg = 'Loading Fee & Financial Data...';
  } else if (req.url.includes('/biometric-devices')) {
    msg = 'Loading Biometric Devices...';
  } else if (req.url.includes('/attendance')) {
    msg = 'Loading Attendance Records...';
  } else if (req.url.includes('/exams')) {
    msg = 'Loading Examination Data...';
  } else if (req.url.includes('/subjects')) {
    msg = 'Loading Subject Catalog & Curriculum...';
  } else if (req.url.includes('/api/events')) {
    msg = 'Loading Events & Activities...';
  }

  loadingService.show(msg);

  return next(req).pipe(
    finalize(() => {
      loadingService.hide();
    })
  );
};
