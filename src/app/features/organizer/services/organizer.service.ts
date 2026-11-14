import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { OrganizerTrip, OrganizerProfile } from '../models/organizer.models';

// TODO: Replace mock data with real API calls when backend endpoints are ready.
//       Swap of() with this.http.get<OrganizerTrip[]>(`${environment.apiUrl}/v1/organizer/trips`)
//       and inject HttpClient. The interfaces are already shaped for the API response.
@Injectable({ providedIn: 'root' })
export class OrganizerService {
  getTrips(): Observable<OrganizerTrip[]> {
    return of(MOCK_TRIPS);
  }

  getProfile(): Observable<OrganizerProfile> {
    return of(MOCK_PROFILE);
  }
}

const MOCK_TRIPS: OrganizerTrip[] = [
  {
    id: '1',
    title: 'Siwa Oasis Overland',
    coverImage: '/desert_sky.jpg',
    status: 'Published',
    dateRange: 'Oct 12–15, 2026',
    capacity: 10,
    booked: 6,
    avatars: [],
    price: 1200,
  },
  {
    id: '2',
    title: 'Wadi Rum Desert Trek',
    coverImage: undefined,
    status: 'Published',
    dateRange: 'Nov 3–7, 2026',
    capacity: 12,
    booked: 5,
    avatars: [],
    price: 950,
  },
  {
    id: '3',
    title: 'Atlas Mountain Traverse',
    coverImage: undefined,
    status: 'Published',
    dateRange: 'Dec 1–5, 2026',
    capacity: 13,
    booked: 0,
    avatars: [],
    price: 1500,
  },
];

const MOCK_PROFILE: OrganizerProfile = {
  name: 'Ahmed Al-Rashid',
  avatar: undefined,
  since: 'Jan 2023',
  isVerified: true,
  tripsHosted: 24,
  reviews: 118,
  rating: 4.9,
  email: 'ahmed@triboexped.com',
  phone: '+971 54 432 5060',
  lifetimeRevenue: '$48.2k',
  revenueTrend: '+12% this month',
  sparklinePoints: [22, 38, 28, 52, 41, 60, 48],
  licenseName: 'Business License & UAE Tourism Permit',
};
