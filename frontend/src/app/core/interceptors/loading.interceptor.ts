import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LoadingService } from '../services/loading.service';
import { finalize } from 'rxjs';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  // Exclude silent background calls
  const isSilent = 
    req.url.includes('/api/auth/refresh-token') ||
    req.url.includes('/api/auth/revoke-token') ||
    req.url.includes('/api/chat') ||
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
  } else if (req.url.includes('/attendance')) {
    msg = 'Loading Attendance Records...';
  } else if (req.url.includes('/exams')) {
    msg = 'Loading Examination Data...';
  } else if (req.url.includes('/subjects')) {
    msg = 'Loading Subject Catalog & Curriculum...';
  } else if (req.url.includes('/events')) {
    msg = 'Loading Events & Activities...';
  }

  loadingService.show(msg);

  return next(req).pipe(
    finalize(() => {
      loadingService.hide();
    })
  );
};
