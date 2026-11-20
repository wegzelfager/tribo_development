import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  AdminUsersListResponse,
  AdminSingleUserResponse,
  AdminActionResponse,
  AdminUserFilterParams,
  AdminTripFilterParams,
  AdminTripsListResponse,
  AdminReviewTripDto,
  AdminReviewTripResponse,
} from '../models/admin.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);
  private readonly BASE = '/v1/admin';

  /** GET /api/v1/admin/users - Paginated list with optional filters */
  getUsers(params: AdminUserFilterParams = {}): Observable<AdminUsersListResponse> {
    const httpParams: Record<string, string | number | boolean> = {};

    if (params.page !== undefined) httpParams['page'] = params.page;
    if (params.limit !== undefined) httpParams['limit'] = params.limit;
    if (params.search) httpParams['search'] = params.search;
    if (params.role) httpParams['role'] = params.role;
    if (params.isVerified !== undefined && params.isVerified !== '')
      httpParams['isVerified'] = params.isVerified as boolean;

    return this.api.get<AdminUsersListResponse>(`${this.BASE}/users`, { params: httpParams });
  }

  /** GET /api/v1/admin/users/search - Search with date range */
  searchUsers(params: AdminUserFilterParams = {}): Observable<AdminUsersListResponse> {
    const httpParams: Record<string, string | number | boolean> = {};

    if (params.page !== undefined) httpParams['page'] = params.page;
    if (params.limit !== undefined) httpParams['limit'] = params.limit;
    if (params.search) httpParams['search'] = params.search;
    if (params.role) httpParams['role'] = params.role;
    if (params.isVerified !== undefined && params.isVerified !== '')
      httpParams['isVerified'] = params.isVerified as boolean;
    if (params.startDate) httpParams['startDate'] = params.startDate;
    if (params.endDate) httpParams['endDate'] = params.endDate;

    return this.api.get<AdminUsersListResponse>(`${this.BASE}/users/search`, { params: httpParams });
  }

  /** GET /api/v1/admin/users/:id */
  getUserById(id: string): Observable<AdminSingleUserResponse> {
    return this.api.get<AdminSingleUserResponse>(`${this.BASE}/users/${id}`);
  }

  /** PATCH /api/v1/admin/users/:id/block */
  toggleBlock(id: string): Observable<AdminActionResponse> {
    return this.api.patch<AdminActionResponse>(`${this.BASE}/users/${id}/block`, {});
  }

  /** PATCH /api/v1/admin/users/:id/verify */
  toggleVerify(id: string): Observable<AdminActionResponse> {
    return this.api.patch<AdminActionResponse>(`${this.BASE}/users/${id}/verify`, {});
  }

  /** GET /api/v1/admin/trips - List trips for admin review with filtering */
  getTrips(params: AdminTripFilterParams = {}): Observable<AdminTripsListResponse> {
    const httpParams: Record<string, string | number> = {};

    if (params.page !== undefined) httpParams['page'] = params.page;
    if (params.limit !== undefined) httpParams['limit'] = params.limit;
    if (params.search) httpParams['search'] = params.search;
    if (params.status) httpParams['status'] = params.status;
    if (params.approvalStatus && params.approvalStatus !== 'all') {
      httpParams['approvalStatus'] = params.approvalStatus;
    }

    return this.api.get<AdminTripsListResponse>(`${this.BASE}/trips`, { params: httpParams });
  }

  /** PATCH /api/v1/admin/trips/:id/review - Approve, reject or set pending */
  reviewTrip(id: string, body: AdminReviewTripDto): Observable<AdminReviewTripResponse> {
    return this.api.patch<AdminReviewTripResponse>(`${this.BASE}/trips/${id}/review`, body);
  }
}
