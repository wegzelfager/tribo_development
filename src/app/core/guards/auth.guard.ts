import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, map, of } from 'rxjs';

/**
 * Auth Guard — protects routes that require authentication.
 *
 * Strategy:
 *  1. If in-memory access token exists → allow navigation.
 *  2. If there is no stored user session at all → redirect to /auth/login immediately (no unnecessary HTTP ping).
 *  3. If user has a stored session but token is gone (page refresh) → attempt silent restore via refresh cookie.
 *  4. If refresh fails → clear session and redirect to /auth/login.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  const loginTree = router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url }
  });

  // Fast path — token already alive in memory
  if (authService.getAccessToken()) {
    return true;
  }

  // If there is no stored user session, do not ping the refresh endpoint
  if (!authService.getCurrentUser()) {
    return loginTree;
  }

  // Slow path — try to silently restore the session via the refresh cookie
  return authService.refreshToken().pipe(
    map(() => true),
    catchError(() => {
      authService.clearSession();
      return of(loginTree);
    })
  );
};
