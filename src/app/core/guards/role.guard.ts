import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

type AppRole = 'Organizer' | 'Traveler' | 'Admin';

const ROLE_CLAIM_KEYS = [
  'role',
  'roles',
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
];

/** Extract role from JWT payload or stored user object. */
function extractUserRole(token: string | null, authService: AuthService): AppRole | null {
  // 1. Try decoding JWT payload safely (supporting UTF-8 characters)
  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
        const json = decodeURIComponent(
          atob(padded)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const payload = JSON.parse(json);
        for (const key of ROLE_CLAIM_KEYS) {
          const val = payload[key];
          if (typeof val === 'string') {
            const r = normaliseRole(val);
            if (r) return r;
          } else if (Array.isArray(val) && val.length > 0) {
            for (const item of val) {
              const r = normaliseRole(String(item));
              if (r) return r;
            }
          }
        }
      }
    } catch {}
  }

  // 2. Fall back to stored user object in localStorage
  const user = authService.getCurrentUser();
  if (user && user.role) {
    return normaliseRole(user.role);
  }

  return null;
}

/** Normalise raw role string to known AppRole. */
function normaliseRole(raw: string): AppRole | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (lower === 'organizer') return 'Organizer';
  if (lower === 'traveler' || lower === 'traveller') return 'Traveler';
  if (lower === 'admin') return 'Admin';
  return null;
}

export function roleGuard(requiredRole: AppRole): CanActivateFn {
  return (route, state): Observable<boolean | UrlTree> => {
    const authService = inject(AuthService);
    const router      = inject(Router);

    const loginTree = (): UrlTree =>
      router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: state.url }
      });

    const resolveAccess = (token: string | null): boolean | UrlTree => {
      const role = extractUserRole(token, authService);
      if (!role) {
        return loginTree();
      }

      if (role === requiredRole) {
        return true;
      }

      // Wrong role: redirect to their own portal, protecting strictly against navigation loops
      if (role === 'Organizer') {
        if (state.url.startsWith('/organizer')) {
          return true;
        }
        return router.createUrlTree(['/organizer']);
      }

      if (role === 'Admin') {
        if (state.url.startsWith('/admin')) {
          return true;
        }
        return router.createUrlTree(['/admin']);
      }


      if (state.url.startsWith('/home')) {
        return true; 
      }
      return router.createUrlTree(['/home']);
    };

    // ── Fast path: token already alive in memory ──────────────────────────
    const existingToken = authService.getAccessToken();
    if (existingToken) {
      return of(resolveAccess(existingToken));
    }

    // ── Unauthenticated visitor: do not ping /refresh-token ───────────────
    if (!authService.getCurrentUser()) {
      return of(loginTree());
    }

    // ── Slow path: page refresh — restore session via refresh cookie ───────
    return authService.refreshToken().pipe(
      map(res => resolveAccess(res.accessToken)),
      catchError(() => {
        authService.clearSession();
        return of(loginTree());
      })
    );
  };
}
