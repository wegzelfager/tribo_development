export type TripStatus = 'Published' | 'Draft' | 'Full' | 'Completed';

export interface OrganizerTrip {
  id: string;
  title: string;
  coverImage?: string;        // optional — fallback to gradient
  status: TripStatus;
  dateRange: string;          // e.g. "Oct 12–15, 2026"
  capacity: number;
  booked: number;
  avatars: string[];          // avatar URLs (may be empty → initials fallback)
  price: number;
  location?: string;
  description?: string;
}

export interface OrganizerProfile {
  name: string;
  avatar?: string;
  since: string;              // "Jan 2023"
  isVerified: boolean;
  tripsHosted: number;
  reviews: number;
  rating: number;             // e.g. 4.9
  email: string;
  phone: string;
  lifetimeRevenue: string;    // "$48.2k"
  revenueTrend: string;       // "+12% this month"
  sparklinePoints: number[];  // e.g. [20,35,28,45,38,55,48]
  licenseName: string;
}

export interface OrganizerStats {
  activeTrips: number;
  totalBookings: number;
  spotsLeft: number;
}

