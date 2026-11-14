import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ToastService } from './toast.service';
import {
  Trip,
  TripQueryParams,
  TripListResponse,
  TripApiResponse,
  TripFormData,
} from '../models/trip.model';

@Injectable({ providedIn: 'root' })
export class TripService {
  private readonly http = inject(HttpClient);
  private readonly toastService = inject(ToastService);
  private readonly base = `${environment.apiUrl}/v1/trips`;

  getAllTrips(params?: TripQueryParams): Observable<TripApiResponse<TripListResponse>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          httpParams = httpParams.set(k, String(v));
        }
      });
    }
    return this.http
      .get<TripApiResponse<TripListResponse>>(this.base, {
        params: httpParams,
        withCredentials: true,
      })
      .pipe(catchError((err: HttpErrorResponse) => this.handleHttpError(err)));
  }

  getMyTrips(params?: { page?: number; limit?: number }): Observable<TripApiResponse<TripListResponse>> {
    let httpParams = new HttpParams();
    if (params?.page) httpParams = httpParams.set('page', params.page);
    if (params?.limit) httpParams = httpParams.set('limit', params.limit);

    return this.http
      .get<TripApiResponse<TripListResponse>>(`${this.base}/my-trips`, {
        params: httpParams,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        withCredentials: true,
      })
      .pipe(catchError((err: HttpErrorResponse) => this.handleHttpError(err)));
  }

  getTripById(id: string): Observable<TripApiResponse<{ trip: Trip }>> {
    return this.http
      .get<TripApiResponse<{ trip: Trip }>>(`${this.base}/${id}`, {
        withCredentials: true,
      })
      .pipe(catchError((err: HttpErrorResponse) => this.handleHttpError(err)));
  }

  createTrip(formData: FormData): Observable<TripApiResponse<{ trip: Trip }>> {
    return this.http
      .post<TripApiResponse<{ trip: Trip }>>(this.base, formData, {
        withCredentials: true,
      })
      .pipe(
        tap(() => this.toastService.success('Expedition created successfully!')),
        catchError((err: HttpErrorResponse) => this.handleHttpError(err, 'Failed to create expedition.'))
      );
  }

  updateTrip(id: string, formData: FormData): Observable<TripApiResponse<{ trip: Trip }>> {
    return this.http
      .patch<TripApiResponse<{ trip: Trip }>>(`${this.base}/${id}`, formData, {
        withCredentials: true,
      })
      .pipe(
        tap(() => this.toastService.success('Expedition updated successfully!')),
        catchError((err: HttpErrorResponse) => this.handleHttpError(err, 'Failed to update expedition.'))
      );
  }

  deleteTrip(id: string): Observable<TripApiResponse<null>> {
    return this.http
      .delete<TripApiResponse<null>>(`${this.base}/${id}`, {
        withCredentials: true,
      })
      .pipe(
        tap(() => this.toastService.success('Expedition deleted.')),
        catchError((err: HttpErrorResponse) => this.handleHttpError(err, 'Failed to delete expedition.'))
      );
  }

  /**
   * Build a FormData payload matching the backend DTO exactly.
   * Arrays/objects are JSON-serialized as expected by backend DTO parser.
   */
  buildTripFormData(
    form: TripFormData,
    coverFile: File | null,
    imageFiles: File[]
  ): FormData {
    const fd = new FormData();
    fd.append('title', form.title.trim());
    fd.append('location', form.location.trim());
    fd.append('durationDays', String(form.durationDays));
    fd.append('maxCapacity', String(form.maxCapacity));
    fd.append('meetingPoint', form.meetingPoint.trim());
    fd.append('description', form.description.trim());
    fd.append('pricePerPerson', String(form.pricePerPerson));

    // Nested arrays and objects serialized to JSON strings
    fd.append('highlights', JSON.stringify(form.highlights || []));
    fd.append('itinerary', JSON.stringify(form.itinerary || []));
    fd.append('includedItems', JSON.stringify(form.includedItems || []));
    fd.append('excludedItems', JSON.stringify(form.excludedItems || []));
    fd.append('ageRestriction', JSON.stringify(form.ageRestriction || { type: 'Any Age' }));

    // File fields
    if (coverFile) {
      fd.append('coverImage', coverFile);
    }
    if (imageFiles && imageFiles.length > 0) {
      imageFiles.forEach(f => fd.append('images', f));
    }

    return fd;
  }

  private handleHttpError(error: HttpErrorResponse, fallback = 'Operation failed.'): Observable<never> {
    let message = fallback;

    if (error.error?.errors && Array.isArray(error.error.errors) && error.error.errors.length > 0) {
      message = error.error.errors
        .map((e: any) => `${e.field ? e.field + ': ' : ''}${e.message}`)
        .join(' | ');
    } else if (error.error?.message) {
      message = error.error.message;
    } else if (error.status === 400) {
      message = 'Invalid data provided. Please check all form fields.';
    } else if (error.status === 401) {
      message = 'Session expired. Please log in again.';
    } else if (error.status === 403) {
      message = 'Forbidden: Only verified organizers have access to this feature.';
    } else if (error.status === 404) {
      message = 'Expedition not found.';
    } else if (error.status === 429) {
      message = 'Too many requests. Please wait a moment and try again.';
    } else if (error.status >= 500) {
      message = 'Server error occurred. Please try again shortly.';
    }

    this.toastService.error(message);
    return throwError(() => error);
  }
}
