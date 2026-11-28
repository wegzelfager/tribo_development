import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { UserIdCard } from '../models/user.model';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  age: number | null;
  birthDate: string | null;
  profileImage?: string;
  isVerified: boolean;
  idCard?: UserIdCard;
  createdAt?: string;
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

export interface VerifyIdentityResponse {
  status: string;
  message: string;
  data: {
    age?: number | null;
    birthDate?: string | null;
    idCard: UserIdCard;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private accessToken: string | null = null;
  private readonly currentUserSubject = new BehaviorSubject<AuthUser | null>(this.readStoredUser());
  readonly currentUser$ = this.currentUserSubject.asObservable();
  readonly currentUserSignal = signal<AuthUser | null>(this.currentUserSubject.value);
  private refreshInProgress$: Observable<RefreshTokenResponse> | null = null;

  constructor(private http: HttpClient) {}

  private readStoredUser(): AuthUser | null {
    try {
      const stored = localStorage.getItem('user');
      return stored ? (JSON.parse(stored) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  private toStoredUser(user: AuthUser): AuthUser {
    return {
      id: user.id,
      name: user.name,
      email: '',
      role: user.role,
      age: null,
      birthDate: null,
      profileImage: user.profileImage,
      isVerified: user.isVerified,
      idCard: user.idCard
        ? {
            frontImage: '',
            backImage: '',
            nationalId: null,
            isVerified: user.idCard.isVerified,
            verificationStatus: user.idCard.verificationStatus,
            verificationError: user.idCard.verificationError,
          }
        : undefined,
    };
  }

  private setCurrentUser(user: AuthUser | null): void {
    this.currentUserSubject.next(user);
    this.currentUserSignal.set(user);
    try {
      if (user) {
        localStorage.setItem('user', JSON.stringify(this.toStoredUser(user)));
      } else {
        localStorage.removeItem('user');
      }
    } catch {}
  }

  login(credentials: { email: string; password: string }): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/v1/auths/login`, credentials, { withCredentials: true })
      .pipe(
        tap(res => {
          this.accessToken = res.accessToken;
          if (res.data?.user) {
            this.setCurrentUser(res.data.user);
          }
        }),
        catchError(this.handleError)
      );
  }

  register(userData: FormData): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/v1/auths/register`, userData, { withCredentials: true })
      .pipe(
        catchError(this.handleError)
      );
  }

  verifyEmail(token: string): Observable<any> {
    return this.http
      .get<any>(`${this.apiUrl}/v1/auths/verify-email/${token}`, { withCredentials: true })
      .pipe(
        catchError(this.handleError)
      );
  }

  verifyIdentityManual(nationalId: string): Observable<VerifyIdentityResponse> {
    return this.http
      .patch<VerifyIdentityResponse>(
        `${this.apiUrl}/v1/auths/verify-identity`,
        { nationalId },
        { withCredentials: true }
      )
      .pipe(
        tap(res => {
          const existing = this.getCurrentUser();
          if (existing && res.data) {
            this.setCurrentUser({
              ...existing,
              age: res.data.age !== undefined ? res.data.age : existing.age,
              birthDate: res.data.birthDate !== undefined ? res.data.birthDate : existing.birthDate,
              idCard: res.data.idCard ?? existing.idCard,
            });
          }
        }),
        catchError(this.handleError)
      );
  }

  verifyIdentityImages(formData: FormData): Observable<VerifyIdentityResponse> {
    return this.http
      .patch<VerifyIdentityResponse>(
        `${this.apiUrl}/v1/auths/verify-identity`,
        formData,
        { withCredentials: true }
      )
      .pipe(
        tap(res => {
          const existing = this.getCurrentUser();
          if (existing && res.data?.idCard) {
            this.setCurrentUser({
              ...existing,
              idCard: res.data.idCard,
            });
          }
        }),
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
      return Date.now() >= (payload.exp * 1000) - 5000;
    } catch {
      return true;
    }
  }

  getCurrentUser(): AuthUser | null {
    if (!this.currentUserSubject.value) {
      const stored = this.readStoredUser();
      if (stored) {
        this.currentUserSubject.next(stored);
        this.currentUserSignal.set(stored);
      }
    }
    return this.currentUserSubject.value;
  }

  refreshCurrentUser(): Observable<AuthUser | null> {
    if (!this.getCurrentUser() && !this.accessToken) {
      return of(null);
    }

    return this.http
      .get<{ status: string; data: { user: AuthUser } }>(`${this.apiUrl}/v1/auths/me`, {
        withCredentials: true,
      })
      .pipe(
        tap(res => {
          if (res?.data?.user) {
            this.setCurrentUser(res.data.user);
          }
        }),
        map(res => res?.data?.user ?? null),
        catchError(() => of(null))
      );
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
          }),
          catchError(() => {
            this.clearSession();
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
        return of({ status: 'success', message: 'No active session, cleared locally' });
      })
    );
  }

  clearSession(): void {
    this.accessToken = null;
    this.setCurrentUser(null);
  }

  forgotPassword(email: string): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/v1/auths/forgot-password`, { email }, { withCredentials: true })
      .pipe(
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
      } else if (Array.isArray(error.error?.errors) && error.error.errors.length > 0) {
        errorMessage = error.error.errors.map((e: any) => e.message).join(' ');
      } else if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.status === 401) {
        errorMessage = 'Invalid credentials. Please try again.';
      } else if (error.status === 403) {
        errorMessage = 'Please verify your email before logging in.';
      } else if (error.status === 409) {
        errorMessage = 'Conflict: This record is already registered.';
      } else if (error.status === 429) {
        errorMessage = 'Too many attempts. Please try again after 15 minutes.';
      } else {
        errorMessage = `Server error: ${error.statusText}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  }
}
