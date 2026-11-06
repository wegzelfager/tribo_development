import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
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
    return this.http
      .post<RefreshTokenResponse>(`${this.apiUrl}/v1/auths/refresh-token`, {}, { withCredentials: true })
      .pipe(
        tap(res => {
          this.accessToken = res.accessToken;
          console.log('Access token refreshed.');
        }),
        catchError(this.handleError)
      );
  }

  getAccessToken(): string | null {
    return this.accessToken;
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
    return this.accessToken !== null;
  }

  logout(): Observable<any> {
    // If we already have a token in memory, use it directly.
    // If the page was refreshed and the in-memory token is gone,
    // first call refresh-token (which uses the HTTP-only cookie) to
    // get a fresh access token — then call logout with that token so
    // the backend `protect` middleware passes and can blacklist it.
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
            // Always clear locally even if server call fails
            this.clearSession();
            console.warn('Logout server request failed (session cleared locally):', err);
            return of({ status: 'success', message: 'Logged out locally' });
          })
        );
    };

    if (this.accessToken) {
      // Token already in memory — use it directly
      return doLogout(this.accessToken);
    }

    // Token lost (e.g. page refresh) — get a fresh one via the HTTP-only refresh cookie, then logout
    return this.http
      .post<RefreshTokenResponse>(`${this.apiUrl}/v1/auths/refresh-token`, {}, { withCredentials: true })
      .pipe(
        switchMap(res => {
          this.accessToken = res.accessToken;
          return doLogout(res.accessToken);
        }),
        catchError(() => {
          // Refresh cookie is also gone — session is already expired, just clear locally
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
