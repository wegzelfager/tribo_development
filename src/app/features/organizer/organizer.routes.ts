import { Routes } from '@angular/router';

export const ORGANIZER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./organizer-shell/organizer-shell.component').then(m => m.OrganizerShellComponent),
    children: [
      {
        path: '',
        redirectTo: 'trips',
        pathMatch: 'full'
      },
      {
        path: 'trips',
        loadComponent: () =>
          import('./pages/my-trips/my-trips.component').then(m => m.MyTripsComponent)
      },
      {
        path: 'trips/create',
        loadComponent: () =>
          import('./pages/edit-trip/edit-trip.component').then(m => m.EditTripComponent)
      },
      {
        path: 'trips/:id',
        loadComponent: () =>
          import('../trips/trip-detail/trip-detail.component').then(m => m.TripDetailComponent)
      },
      {
        path: 'trips/:id/bookings',
        loadComponent: () =>
          import('./pages/trip-bookings/trip-bookings.component').then(m => m.TripBookingsComponent)
      },
      {
        path: 'trips/:id/edit',
        loadComponent: () =>
          import('./pages/edit-trip/edit-trip.component').then(m => m.EditTripComponent)
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      }
    ]
  }
];
