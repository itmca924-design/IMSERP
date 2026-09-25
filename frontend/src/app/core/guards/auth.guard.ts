import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    if (authService.checkSessionExpired()) {
      authService.logout('session_expired');
      return false;
    }

    // Lock expired tenants to the subscription renewal page
    if (authService.isSubscriptionExpired()) {
      const targetUrl = state.url.split('?')[0];
      if (targetUrl === '/subscription') {
        return true;
      }
      router.navigate(['/subscription']);
      return false;
    }

    return true;
  }

  router.navigate(['/login']);
  return false;
};

