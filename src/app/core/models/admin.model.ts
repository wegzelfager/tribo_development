import { UserIdCard, VerificationStatus } from './user.model';

export type { UserIdCard, VerificationStatus };

export type UserRole = 'traveller' | 'organizer' | 'admin';

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  age: number | null;
  birthDate?: string | null;
  role: UserRole;
  profileImage: string;
  idCard?: UserIdCard;
  isVerified: boolean;
  isBlocked: boolean;
  organizerProfile?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPagination {
  totalDocs: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

export interface AdminUsersListResponse {
  status: 'success' | 'fail';
  message: string;
  data: {
    users: AdminUser[];
    pagination: AdminPagination;
  };
}

export interface AdminSingleUserResponse {
  status: 'success' | 'fail';
  message: string;
  data: AdminUser;
}

export interface AdminActionResponse {
  status: 'success' | 'fail';
  message: string;
  data: AdminUser;
}

export interface AdminUserFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole | '';
  isVerified?: boolean | string;
  startDate?: string;
  endDate?: string;
}

export interface AdminTripFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | '' | 'all';
}

export interface AdminTripsListResponse {
  status: 'success' | 'fail';
  message: string;
  data: {
    trips: import('./trip.model').Trip[];
    pagination: AdminPagination;
  };
}

export interface AdminReviewTripDto {
  approvalStatus: 'pending' | 'approved' | 'rejected';
  message?: string;
}

export interface AdminReviewTripResponse {
  status: 'success' | 'fail';
  message: string;
  data: import('./trip.model').Trip;
}
