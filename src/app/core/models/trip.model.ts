export interface ItineraryDay {
  dayNumber: number;
  dayTitle: string;
  activitySummary?: string;
  timelineEvents?: string[];
}

export interface AgeRestriction {
  type?: 'Any Age' | 'Custom Limit';
  minAge?: number;
  maxAge?: number;
}

export interface TripOrganizer {
  _id?: string;
  name: string;
  profileImage?: string;
  email?: string;
}

export type TripApprovalStatus = 'pending' | 'approved' | 'rejected';
export type TripStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface Trip {
  _id: string;
  title: string;
  coverImage: string;
  images: string[];
  location: string;
  durationDays: number;
  maxCapacity: number;
  meetingPoint: string;
  ageRestriction?: AgeRestriction;
  description: string;
  highlights: string[];
  itinerary: ItineraryDay[];
  includedItems: string[];
  excludedItems: string[];
  pricePerPerson: number;
  organizer: TripOrganizer;
  approvalStatus: TripApprovalStatus;
  status: TripStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TripQueryParams {
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface TripPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TripListResponse {
  trips: Trip[];
  pagination: TripPagination;
}

export interface TripApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

// Form data shape (used by create/update wizard)
export interface TripFormData {
  title: string;
  location: string;
  durationDays: number;
  maxCapacity: number;
  meetingPoint: string;
  ageRestriction: AgeRestriction;
  description: string;
  highlights: string[];
  itinerary: ItineraryDay[];
  includedItems: string[];
  excludedItems: string[];
  pricePerPerson: number;
}
