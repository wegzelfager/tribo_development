import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, finalize, shareReplay, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isVerified: boolean;
}

export interface LoginResponse {
  statusCode: number;
  message: string;
  accessToken: string;
  data: { user: AuthUser };
}

export interface RefreshTokenResponse {
  statusCode: number;
  message: string;
  accessToken: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private accessToken: string | null = null;
  private currentUser: AuthUser | null = null;
  private refreshInProgress$: Observable<RefreshTokenResponse> | null = null;

  constructor(private http: HttpClient) {}

  login(credentials: { email: string; password: string }): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/v1/auths/login`, credentials, { withCredentials: true })
      .pipe(
        tap(res => {
          this.accessToken = res.accessToken;
          if (res.data?.user) {
            this.currentUser = res.data.user;
            try {
              localStorage.setItem('user', JSON.stringify(res.data.user));
            } catch {}
          }
          console.log('Login successful. refreshToken in HTTP-only cookie, accessToken in memory.');
        }),
        catchError(this.handleError)
      );
  }

  register(userData: FormData): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/v1/auths/register`, userData, { withCredentials: true })
      .pipe(
        tap(() => console.log('Registration successful. Verification email sent.')),
        catchError(this.handleError)
      );
  }

  verifyEmail(token: string): Observable<any> {
    return this.http
      .get<any>(`${this.apiUrl}/v1/auths/verify-email/${token}`, { withCredentials: true })
      .pipe(
        tap(() => console.log('Email verified successfully.')),
        catchError(this.handleError)
      );
  }



  refreshToken(): Observable<RefreshTokenResponse> {
    if (this.refreshInProgress$) {
      return this.refreshInProgress$;
    }

    this.refreshInProgress$ = this.http
      .post<RefreshTokenResponse>(`${this.apiUrl}/v1/auths/refresh-token`, {}, { withCredentials: true })
      .pipe(
        tap(res => {
          this.accessToken = res.accessToken;
          console.log('Access token refreshed.');
        }),
        finalize(() => {
          this.refreshInProgress$ = null;
        }),
        shareReplay(1),
        catchError(err => {
          this.clearSession();
          return this.handleError(err);
        })
      );

    return this.refreshInProgress$;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Checks whether the current in-memory access token is expired based on its JWT `exp` claim.
   * Returns true if there is no token or if it is expired.
   */
  isTokenExpired(token?: string | null): boolean {
    const t = token ?? this.accessToken;
    if (!t) return true;
    try {
      const parts = t.split('.');
      if (parts.length !== 3) return true;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
      const payload = JSON.parse(atob(padded));
      if (!payload.exp) return false;
      // 5-second buffer for network latency/clock skew
      return Date.now() >= (payload.exp * 1000) - 5000;
    } catch {
      return true;
    }
  }

  getCurrentUser(): AuthUser | null {
    if (!this.currentUser) {
      try {
        const stored = localStorage.getItem('user');
        if (stored) {
          this.currentUser = JSON.parse(stored);
        }
      } catch {}
    }
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null && !this.isTokenExpired();
  }

  logout(): Observable<any> {
    const doLogout = (token: string) => {
      return this.http
        .post<any>(`${this.apiUrl}/v1/auths/logout`, {}, {
          withCredentials: true,
          headers: { Authorization: `Bearer ${token}` }
        })
        .pipe(
          tap(() => {
            this.clearSession();
            console.log('Logged out. Server session invalidated.');
          }),
          catchError(err => {
            this.clearSession();
            console.warn('Logout server request failed (session cleared locally):', err);
            return of({ status: 'success', message: 'Logged out locally' });
          })
        );
    };

    if (this.accessToken) {
      return doLogout(this.accessToken);
    }

    return this.refreshToken().pipe(
      switchMap(res => doLogout(res.accessToken)),
      catchError(() => {
        this.clearSession();
        console.warn('No valid session found. Cleared locally.');
        return of({ status: 'success', message: 'No active session, cleared locally' });
      })
    );
  }

  clearSession(): void {
    this.accessToken = null;
    this.currentUser = null;
    try {
      localStorage.removeItem('user');
    } catch {}
  }

  forgotPassword(email: string): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/v1/auths/forgot-password`, { email }, { withCredentials: true })
      .pipe(
        tap(() => console.log('Forgot-password email requested.')),
        catchError(this.handleError)
      );
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http
      .post<any>(
        `${this.apiUrl}/v1/auths/reset-password/${token}`,
        { newPassword },
        { withCredentials: true }
      )
      .pipe(
        tap(() => console.log('Password reset successfully.')),
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unexpected error occurred';

    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      if (error.status === 0) {
        errorMessage = 'Cannot connect to the backend server. Please ensure it is running.';
      } else if (error.status === 401) {
        errorMessage = 'Invalid credentials. Please try again.';
      } else if (error.status === 403) {
        errorMessage = 'Please verify your email before logging in.';
      } else if (error.status === 409) {
        errorMessage = 'Email already exists. Please use a different email.';
      } else {
        errorMessage = error.error?.message || `Server error: ${error.statusText}`;
      }
    }

    console.error('Auth error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
