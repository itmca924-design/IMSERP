import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { ConfirmDialogService } from '../services/confirm-dialog.service';
import { PresenceService } from '../services/presence.service';
import { catchError, switchMap, throwError } from 'rxjs';

let isForbiddenAlertOpen = false;

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const confirmService = inject(ConfirmDialogService);
  const presenceService = inject(PresenceService);
  const token = authService.getToken();
  const branchId = authService.selectedBranchId();

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (branchId) {
    headers['X-Branch-Id'] = branchId;
  }

  let authReq = req.clone({ setHeaders: headers });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // If unauthorized and not already refreshing or logging in
      const isAuthApi = req.url.includes('/api/auth/login') || req.url.includes('/api/auth/refresh-token');
      
      // Check if session was terminated due to concurrent login from another place
      const isSessionKicked = error.headers?.get('X-Session-Terminated') === 'true' || error?.error?.error === 'SessionTerminated';
      if (error.status === 401 && isSessionKicked) {
        const msg = error?.error?.message || 'Your account has been logged in from another browser or device. For security reasons, this session has been terminated.';
        presenceService.handleForceLogout(msg);
        return throwError(() => error);
      }

      if (error.status === 401 && !isAuthApi && authService.getRefreshToken()) {
        return authService.refreshToken().pipe(
          switchMap(newRes => {
            const retriedReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${newRes.token}`
              }
            });
            return next(retriedReq);
          }),
          catchError(refreshErr => {
            authService.logout('session_expired');
            return throwError(() => refreshErr);
          })
        );
      }

      // Handle 403 Forbidden - Role / Menu permission denied (Show exact API message in English)
      if (error.status === 403) {
        if (!isForbiddenAlertOpen) {
          isForbiddenAlertOpen = true;
          const apiMsg = typeof error?.error === 'string'
            ? error.error
            : (error?.error?.message || error?.error?.title || 'You do not have permission to perform this action. Please contact your Institute Administrator.');

          confirmService.alert('Access Denied', apiMsg, 'danger').subscribe(() => {
            isForbiddenAlertOpen = false;
          });
        }
        return throwError(() => error);
      }

      return throwError(() => error);
    })
  );
};

