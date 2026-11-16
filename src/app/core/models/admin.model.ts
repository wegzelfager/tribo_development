export type UserRole = 'traveller' | 'organizer' | 'admin';

export interface UserIdCard {
  frontImage: string;
  backImage: string;
  isVerified: boolean;
}

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  age: number;
  role: UserRole;
  profileImage: string;
  idCard: UserIdCard;
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
