import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

const RETRY_HEADER = 'X-Refresh-Retry';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private readonly refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.getAccessToken();
    const authReq = this.addToken(request, token);

    return next.handle(authReq).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return this.handle401Error(request, next, error);
        }
        return throwError(() => error);
      })
    );
  }

  private handle401Error(
    request: HttpRequest<unknown>,
    next: HttpHandler,
    originalError: HttpErrorResponse
  ): Observable<HttpEvent<unknown>> {

    if (this.isAuthEndpoint(request.url)) {
      this.isRefreshing = false;
      this.refreshTokenSubject.next(null);
      return throwError(() => originalError);
    }

 
    if (request.headers.has(RETRY_HEADER)) {
      this.isRefreshing = false;
      this.refreshTokenSubject.next(null);
      this.authService.clearSession();
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: this.router.url }
      });
      return throwError(() => originalError);
    }


    if (this.isRefreshing) {
      return this.refreshTokenSubject.pipe(
        filter(token => token !== null),
        take(1),
        switchMap(token => next.handle(this.addToken(this.markRetry(request), token)))
      );
    }


    this.isRefreshing = true;
    this.refreshTokenSubject.next(null);

    return this.authService.refreshToken().pipe(
      switchMap(res => {
        this.isRefreshing = false;
        this.refreshTokenSubject.next(res.accessToken);
        
        return next.handle(this.addToken(this.markRetry(request), res.accessToken));
      }),
      catchError(err => {
        this.isRefreshing = false;
        this.refreshTokenSubject.next(null);
        this.authService.clearSession();
        this.router.navigate(['/auth/login'], {
          queryParams: { returnUrl: this.router.url }
        });
        return throwError(() => err);
      })
    );
  }

  private addToken(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
    return request.clone({
      withCredentials: true,
      ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {})
    });
  }

  private markRetry(request: HttpRequest<unknown>): HttpRequest<unknown> {
    return request.clone({
      setHeaders: { [RETRY_HEADER]: 'true' }
    });
  }

  private isAuthEndpoint(url: string): boolean {
    return (
      url.includes('refresh-token') ||
      url.includes('/auths/login') ||
      url.includes('/auths/register') ||
      url.includes('/auths/logout') ||
      url.includes('/auths/forgot-password') ||
      url.includes('/auths/reset-password') ||
      url.includes('/auths/verify-email')
    );
  }
}
