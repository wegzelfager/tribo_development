import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
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

  constructor(private http: HttpClient) {}

  login(credentials: { email: string; password: string }): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/v1/auths/login`, credentials, { withCredentials: true })
      .pipe(
        tap(res => {
          this.accessToken = res.accessToken;
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

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  logout(): void {
    this.accessToken = null;
    console.log('Logged out. Access token cleared from memory.');
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
