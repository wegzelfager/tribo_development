import { inject, Signal } from '@angular/core';
import {
  injectQuery,
  injectMutation,
  injectQueryClient,
  CreateQueryResult,
  CreateMutationResult,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../services/admin.service';
import {
  AdminUser,
  AdminUsersListResponse,
  AdminUserFilterParams,
} from '../models/admin.model';

export const adminQueryKeys = {
  all: ['admin'] as const,
  users: (params?: AdminUserFilterParams) => ['admin', 'users', params ?? {}] as const,
  detail: (id: string) => ['admin', 'users', 'detail', id] as const,
};

/** Fetches paginated/filtered admin users list */
export function injectAdminUsersQuery(
  paramsAccessor: () => AdminUserFilterParams
): CreateQueryResult<AdminUsersListResponse['data'], Error> {
  const adminService = inject(AdminService);

  return injectQuery(() => {
    const params = paramsAccessor();
    const hasSearch = !!params.search || !!params.startDate || !!params.endDate;
    return {
      queryKey: adminQueryKeys.users(params),
      queryFn: async (): Promise<AdminUsersListResponse['data']> => {
        const res = hasSearch
          ? await firstValueFrom(adminService.searchUsers(params))
          : await firstValueFrom(adminService.getUsers(params));
        return res.data;
      },
    };
  });
}

/** Fetches single admin user detail */
export function injectAdminUserDetailQuery(
  idAccessor: () => string | null | undefined
): CreateQueryResult<AdminUser, Error> {
  const adminService = inject(AdminService);

  return injectQuery(() => {
    const id = idAccessor();
    return {
      queryKey: id ? adminQueryKeys.detail(id) : ['admin', 'users', 'detail', 'none'],
      enabled: !!id,
      queryFn: async (): Promise<AdminUser> => {
        if (!id) throw new Error('User ID required');
        const res = await firstValueFrom(adminService.getUserById(id));
        return res.data;
      },
    };
  });
}

/** Toggle block/unblock a user */
export function injectToggleBlockMutation(): CreateMutationResult<AdminUser, Error, string> {
  const adminService = inject(AdminService);
  const queryClient = injectQueryClient();

  return injectMutation(() => ({
    mutationFn: async (userId: string): Promise<AdminUser> => {
      const res = await firstValueFrom(adminService.toggleBlock(userId));
      return res.data;
    },
    onSuccess: (updatedUser) => {
      // Update detail cache immediately
      queryClient.setQueryData<AdminUser>(adminQueryKeys.detail(updatedUser._id), updatedUser);
      // Invalidate all user lists so they refetch
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
    },
  }));
}

/** Toggle verify/unverify a user */
export function injectToggleVerifyMutation(): CreateMutationResult<AdminUser, Error, string> {
  const adminService = inject(AdminService);
  const queryClient = injectQueryClient();

  return injectMutation(() => ({
    mutationFn: async (userId: string): Promise<AdminUser> => {
      const res = await firstValueFrom(adminService.toggleVerify(userId));
      return res.data;
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData<AdminUser>(adminQueryKeys.detail(updatedUser._id), updatedUser);
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
    },
  }));
}
