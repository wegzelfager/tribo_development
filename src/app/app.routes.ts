import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(m => m.LandingComponent)
  },
  {
    path: 'home',
    canActivate: [roleGuard('Traveler')],
    loadChildren: () =>
      import('./features/home/home.routes').then(m => m.homeRoutes)
  },
  {
    path: 'organizer',
    canActivate: [roleGuard('Organizer')],
    loadChildren: () =>
      import('./features/organizer/organizer.routes').then(m => m.ORGANIZER_ROUTES)
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadChildren: () =>
      import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES)
  },
  {
    path: 'login',
    redirectTo: '/auth/login',
    pathMatch: 'full'
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./features/auth/verify-email/verify-email.component').then(m => m.VerifyEmailComponent)
  },
  {

    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.authRoutes)
  },
  {
    path: 'trips',
    loadComponent: () =>
      import('./features/organizer/organizer-shell/organizer-shell.component').then(m => m.OrganizerShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/trips/trip-list/trip-list.component').then(m => m.TripListComponent)
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./features/trips/trip-detail/trip-detail.component').then(m => m.TripDetailComponent)
      }
    ]
  },
  {
    path: 'create-trip-step1',
    redirectTo: '/organizer/trips/create',
    pathMatch: 'full'
  },
  {
    path: 'step1',
    redirectTo: '/organizer/trips/create',
    pathMatch: 'full'
  },
  { path: '**', redirectTo: '/auth/login' }
];
