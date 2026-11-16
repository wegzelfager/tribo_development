import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = (route, state): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const loginTree = (): UrlTree =>
    router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });

  const homeTree = (): UrlTree => router.createUrlTree(['/home']);

  const resolveAccess = (): boolean | UrlTree => {
    const user = authService.getCurrentUser();
    if (!user) return loginTree();
    const role = user.role?.trim().toLowerCase();
    if (role === 'admin') return true;
    // Wrong role — send to their own portal
    if (role === 'organizer') return router.createUrlTree(['/organizer']);
    return homeTree();
  };

  // Fast path: token in memory
  const token = authService.getAccessToken();
  if (token) return of(resolveAccess());

  // No user at all → login
  if (!authService.getCurrentUser()) return of(loginTree());

  // Page refresh → restore session
  return authService.refreshToken().pipe(
    map(() => resolveAccess()),
    catchError(() => {
      authService.clearSession();
      return of(loginTree());
    })
  );
};
