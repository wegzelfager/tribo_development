import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Trip, TripQueryParams } from '../../../core/models/trip.model';
import { injectTripsQuery } from '../../../core/queries/trip.queries';

const ICONS = {
  search:   'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  pin:      'M12 21s6.5-5.6 6.5-11a6.5 6.5 0 10-13 0C5.5 15.4 12 21 12 21zM12 12.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4z',
  clock:    'M12 22a10 10 0 110-20 10 10 0 010 20zM12 6v6l4 2',
  users:    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  arrow:    'M5 12h14M13 6l6 6-6 6',
  filter:   'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z',
};

const GRADIENTS = [
  'linear-gradient(160deg, #2d4a3e 0%, #8B6914 100%)',
  'linear-gradient(160deg, #3a2d4a 0%, #6B4914 100%)',
  'linear-gradient(160deg, #2d3a4a 0%, #148B6B 100%)',
  'linear-gradient(160deg, #4a2d32 0%, #C89D66 100%)',
];

@Component({
  selector: 'app-trip-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './trip-list.component.html',
  styleUrl: './trip-list.component.scss',
})
export class TripListComponent {
  private readonly router = inject(Router);

  protected readonly icons = ICONS;
  protected readonly gradients = GRADIENTS;

  // Local filter form bindings
  protected searchLocation = '';
  protected minPrice: number | null = null;
  protected maxPrice: number | null = null;
  protected sortBy = 'createdAt';
  protected sortOrder: 'asc' | 'desc' = 'desc';

  // Reactive state for query params that feeds TanStack Query
  protected readonly queryParams = signal<TripQueryParams>({
    page: 1,
    limit: 9,
    sortBy: 'createdAt',
    order: 'desc',
  });

  // TanStack Query hook with global 5min staleTime and caching
  protected readonly tripsQuery = injectTripsQuery(() => this.queryParams());

  // Reactive signals derived from TanStack Query
  protected trips = computed<Trip[]>(() => this.tripsQuery.data()?.trips ?? []);
  protected total = computed(() => this.tripsQuery.data()?.pagination?.total ?? 0);
  protected totalPages = computed(() => this.tripsQuery.data()?.pagination?.totalPages ?? 1);
  protected currentPage = computed(() => this.queryParams().page || 1);
  protected loading = computed(() => this.tripsQuery.isLoading());

  protected onFilterChange(): void {
    this.applyFilters(1);
  }

  protected fetchTrips(page = 1): void {
    this.applyFilters(page);
  }

  private applyFilters(page = 1): void {
    const params: TripQueryParams = {
      page,
      limit: 9,
      sortBy: this.sortBy,
      order: this.sortOrder,
    };

    if (this.searchLocation.trim()) {
      params.location = this.searchLocation.trim();
    }
    if (this.minPrice !== null && this.minPrice >= 0) {
      params.minPrice = this.minPrice;
    }
    if (this.maxPrice !== null && this.maxPrice > 0) {
      params.maxPrice = this.maxPrice;
    }

    this.queryParams.set(params);
  }

  protected resetFilters(): void {
    this.searchLocation = '';
    this.minPrice = null;
    this.maxPrice = null;
    this.sortBy = 'createdAt';
    this.sortOrder = 'desc';
    this.applyFilters(1);
  }

  protected goToTrip(id: string): void {
    this.router.navigate(['/trips', id]);
  }

  protected gradient(index: number): string {
    return this.gradients[index % this.gradients.length];
  }
}
