import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { PresenceService } from '../services/presence.service';
import { catchError, switchMap, throwError } from 'rxjs';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
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
        const presenceService = inject(PresenceService);
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

      return throwError(() => error);
    })
  );
};

