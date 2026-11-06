import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, map, of } from 'rxjs';

/**
 * Auth Guard — protects routes that require authentication.
 *
 * Strategy:
 *  1. If the in-memory access token exists → allow navigation.
 *  2. If the token is gone (e.g. page refresh) → try /refresh-token using
 *     the HTTP-only cookie. If it succeeds, the user is still logged in → allow.
 *  3. If refresh also fails → redirect to /auth/login.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  // Fast path — token already in memory
  if (authService.getAccessToken()) {
    return true;
  }

  // Slow path — try to silently restore the session via the refresh cookie
  return authService.refreshToken().pipe(
    map(() => true),          // refresh succeeded → user is authenticated
    catchError(() =>          // refresh failed → no valid session
      of(router.createUrlTree(['/auth/login']))
    )
  );
};

