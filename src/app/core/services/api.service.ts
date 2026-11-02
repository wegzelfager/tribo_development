import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface HttpOptions {
  headers?: HttpHeaders | { [header: string]: string | string[] };
  params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> };
  withCredentials?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  get<T>(endpoint: string, options: HttpOptions = {}): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${endpoint}`, {
      withCredentials: true,
      ...options
    });
  }

  post<T>(endpoint: string, body: any, options: HttpOptions = {}): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, body, {
      withCredentials: true,
      ...options
    });
  }

  put<T>(endpoint: string, body: any, options: HttpOptions = {}): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, body, {
      withCredentials: true,
      ...options
    });
  }

  patch<T>(endpoint: string, body: any, options: HttpOptions = {}): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${endpoint}`, body, {
      withCredentials: true,
      ...options
    });
  }

  delete<T>(endpoint: string, options: HttpOptions = {}): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${endpoint}`, {
      withCredentials: true,
      ...options
    });
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}
