import type {
  Trip,
  TripQueryParams,
  TripListResponse,
  TripApiResponse,
} from './types';

const API_BASE_URL = typeof window !== 'undefined' && (window as any).__API_BASE_URL__
  ? (window as any).__API_BASE_URL__
  : 'http://localhost:3000/api/v1/trips';

/**
 * Fetch trips with filtering, pagination, and sorting.
 * Accepts AbortSignal to enable TanStack Query request cancellation.
 */
export async function fetchTrips(
  params?: TripQueryParams,
  signal?: AbortSignal
): Promise<TripListResponse> {
  const url = new URL(API_BASE_URL);

  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.append(key, String(val));
      }
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch trips (${response.status})`);
  }

  const result: TripApiResponse<TripListResponse> = await response.json();
  return result.data;
}

/**
 * Fetch single trip by its ID.
 */
export async function fetchTripById(
  id: string,
  signal?: AbortSignal
): Promise<Trip> {
  const response = await fetch(`${API_BASE_URL}/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch trip ${id}`);
  }

  const result: TripApiResponse<{ trip: Trip }> = await response.json();
  return result.data.trip;
}

/**
 * Create a new trip using FormData.
 */
export async function createTripApi(formData: FormData): Promise<Trip> {
  const response = await fetch(API_BASE_URL, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to create trip');
  }

  const result: TripApiResponse<{ trip: Trip }> = await response.json();
  return result.data.trip;
}

/**
 * Update an existing trip by ID.
 */
export async function updateTripApi(id: string, formData: FormData): Promise<Trip> {
  const response = await fetch(`${API_BASE_URL}/${id}`, {
    method: 'PATCH',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to update trip ${id}`);
  }

  const result: TripApiResponse<{ trip: Trip }> = await response.json();
  return result.data.trip;
}

/**
 * Delete a trip by ID.
 */
export async function deleteTripApi(id: string): Promise<null> {
  const response = await fetch(`${API_BASE_URL}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to delete trip ${id}`);
  }

  return null;
}
