import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./admin-shell/admin-shell.component').then(m => m.AdminShellComponent),
    children: [
      {
        path: '',
        redirectTo: 'users',
        pathMatch: 'full',
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/users/users-list/users-list.component').then(
            m => m.UsersListComponent
          ),
      },
      {
        path: 'users/:id',
        loadComponent: () =>
          import('./pages/users/user-detail/user-detail.component').then(
            m => m.UserDetailComponent
          ),
      },
    ],
  },
];
