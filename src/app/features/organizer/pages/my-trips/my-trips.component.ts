import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { OrganizerStats, OrganizerTrip, TripStatus } from '../../models/organizer.models';
import { Trip, TripApprovalStatus } from '../../../../core/models/trip.model';
import { injectMyTripsQuery, injectDeleteTripMutation } from '../../../../core/queries/trip.queries';

const ICONS = {
  bell:     'M6 16.5V11a6 6 0 1112 0v5.5l1.5 2h-15zM10 21h4',
  calendar: 'M5 6.5h14a1 1 0 011 1V19a1 1 0 01-1 1H5a1 1 0 01-1-1V7.5a1 1 0 011-1zM4 10.5h16M8 4v4M16 4v4',
  dots:     'M5 12h.01M12 12h.01M19 12h.01',
  arrow:    'M5 12h14M13 6l6 6-6 6',
  edit:     'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  car:      'M5 11l1.5-4.5h11L19 11M3 16v3h2v-3M19 16v3h2v-3M3 13h18v3H3zM7 16h.01M17 16h.01',
  users:    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  clock:    'M12 22a10 10 0 110-20 10 10 0 010 20zM12 6v6l4 2',
  plus:     'M12 5v14M5 12h14',
  pin:      'M12 21s6.5-5.6 6.5-11a6.5 6.5 0 10-13 0C5.5 15.4 12 21 12 21zM12 12.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4z',
  search:   'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  sort:     'M3 6h18M6 12h12M10 18h4',
  eye:      'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z',
  copy:     'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  eyeOff:   'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22',
  trash:    'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
} as const;

// Cover gradient fallbacks (cycle by index)
const GRADIENTS = [
  'linear-gradient(160deg, #2d4a3e 0%, #8B6914 100%)',
  'linear-gradient(160deg, #3a2d4a 0%, #6B4914 100%)',
  'linear-gradient(160deg, #2d3a4a 0%, #148B6B 100%)',
];

function mapTripStatus(raw: Trip): TripStatus {
  if (raw.status === 'completed') return 'Completed';
  if (raw.approvalStatus === 'approved') return 'Published';
  return 'Draft';
}

function toOrganizerTrip(raw: Trip): OrganizerTrip {
  const durationStr = raw.durationDays === 1 ? '1 day' : `${raw.durationDays} days`;
  return {
    id:          raw._id,
    title:       raw.title,
    coverImage:  raw.coverImage,
    status:      mapTripStatus(raw),
    dateRange:   durationStr,
    capacity:    raw.maxCapacity || 1,
    booked:      0,
    avatars:     [],
    price:       raw.pricePerPerson,
    location:    raw.location,
    description: raw.description,
  };
}

export type FilterTab = 'all' | 'published' | 'drafts' | 'completed';

@Component({
  selector: 'app-my-trips',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './my-trips.component.html',
  styleUrl: './my-trips.component.scss',
})
export class MyTripsComponent {
  private readonly router = inject(Router);

  protected readonly icons          = ICONS;
  protected readonly gradients      = GRADIENTS;
  protected readonly skeletonItems  = [1, 2, 3, 4];
  protected readonly skeletonCards  = [1, 2, 3];

  // TanStack Query: manages caching, deduplication, and background synchronization
  protected readonly myTripsQuery   = injectMyTripsQuery();
  private readonly deleteMutation   = injectDeleteTripMutation();

  // Filters & Controls
  protected readonly activeTab     = signal<FilterTab>('all');
  protected readonly searchQuery   = signal('');
  protected readonly sortOrder     = signal<'newest' | 'oldest'>('newest');

  // Reactive state derived directly from the cached query
  protected readonly rawTrips = computed<Trip[]>(() => this.myTripsQuery.data()?.trips ?? []);
  protected readonly trips    = computed<OrganizerTrip[]>(() => this.rawTrips().map(toOrganizerTrip));
  protected readonly stats    = computed<OrganizerStats>(() => this.computeStats(this.trips()));
  protected readonly loading  = computed(() => this.myTripsQuery.isLoading());

  protected readonly tabCounts = computed(() => {
    const all = this.trips();
    return {
      all: all.length,
      published: all.filter(t => t.status === 'Published').length,
      drafts: all.filter(t => t.status === 'Draft').length,
      completed: all.filter(t => t.status === 'Completed').length,
    };
  });

  protected readonly revenue = computed(() => {
    return this.trips().reduce((sum, t) => sum + (t.booked * (t.price || 0)), 0);
  });

  protected readonly filteredTrips = computed(() => {
    let list = this.trips();
    const tab = this.activeTab();
    if (tab === 'published') {
      list = list.filter(t => t.status === 'Published');
    } else if (tab === 'drafts') {
      list = list.filter(t => t.status === 'Draft');
    } else if (tab === 'completed') {
      list = list.filter(t => t.status === 'Completed');
    }

    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(t =>
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.location && t.location.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    }

    if (this.sortOrder() === 'oldest') {
      return [...list].reverse();
    }
    return list;
  });

  protected readonly openMenuId = signal<string | null>(null);

  protected setTab(tab: FilterTab): void {
    this.activeTab.set(tab);
  }

  protected toggleSort(): void {
    this.sortOrder.set(this.sortOrder() === 'newest' ? 'oldest' : 'newest');
  }

  protected onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input?.value ?? '');
  }

  protected formatCurrency(val: number): string {
    return `$${val.toLocaleString()}`;
  }

  /** Single clean status badge */
  protected singleBadge(trip: OrganizerTrip): { label: string; dotColor: string; bg: string; color: string } {
    const raw = this.rawTrips().find(r => r._id === trip.id);
    if (raw?.approvalStatus === 'pending') {
      return { label: 'Pending Review', dotColor: '#C89D66', bg: 'rgba(255, 255, 255, 0.96)', color: '#8A5D24' };
    }
    if (raw?.approvalStatus === 'rejected') {
      return { label: 'Rejected', dotColor: '#B84A39', bg: 'rgba(255, 255, 255, 0.96)', color: '#B84A39' };
    }
    if (trip.status === 'Completed') {
      return { label: 'Completed', dotColor: '#4A7C59', bg: 'rgba(255, 255, 255, 0.96)', color: '#2B2118' };
    }
    if (trip.status === 'Full') {
      return { label: 'Full', dotColor: '#C69C6D', bg: 'rgba(255, 255, 255, 0.96)', color: '#2B2118' };
    }
    if (trip.status === 'Draft') {
      return { label: 'Draft', dotColor: '#8A7F73', bg: 'rgba(255, 255, 255, 0.96)', color: '#6A5F53' };
    }
    return { label: 'Published', dotColor: '#4A7C59', bg: 'rgba(255, 255, 255, 0.96)', color: '#2B2118' };
  }

  private computeStats(trips: OrganizerTrip[]): OrganizerStats {
    return {
      activeTrips:   trips.filter(t => t.status === 'Published').length,
      totalBookings: trips.reduce((s, t) => s + t.booked, 0),
      spotsLeft:     trips.reduce((s, t) => s + Math.max(0, t.capacity - t.booked), 0),
    };
  }

  protected progressPct(trip: OrganizerTrip): number {
    return trip.capacity === 0 ? 0 : Math.round((trip.booked / trip.capacity) * 100);
  }

  protected spotsLeft(trip: OrganizerTrip): number {
    return Math.max(0, trip.capacity - trip.booked);
  }

  protected formatSpots(spots: number): string {
    if (spots === 0) return 'Fully booked';
    if (spots === 1) return '1 spot left';
    return `${spots} spots left`;
  }

  protected visibleAvatars(trip: OrganizerTrip): string[] {
    return trip.avatars.slice(0, 4);
  }

  protected extraAvatars(trip: OrganizerTrip): number {
    return Math.max(0, trip.avatars.length - 4);
  }

  /** Returns an array of `n` placeholder items for the initials-filler avatar slots */
  protected fillerAvatars(trip: OrganizerTrip): number[] {
    const shown  = this.visibleAvatars(trip).length;
    const target = Math.min(4, trip.booked);
    const count  = Math.max(0, target - shown);
    return Array.from({ length: count }, (_, i) => i);
  }

  protected initials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  protected tripInitials(trip: OrganizerTrip): string {
    return this.initials(trip.title);
  }

  protected gradient(index: number): string {
    return this.gradients[index % this.gradients.length];
  }

  protected toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.set(this.openMenuId() === id ? null : id);
  }

  protected closeMenu(): void {
    this.openMenuId.set(null);
  }

  protected menuAction(action: string, trip: OrganizerTrip): void {
    this.closeMenu();
    if (action === 'view') {
      this.viewTripDetails(trip);
      return;
    }
    if (action === 'delete') {
      this.deleteMutation.mutate(trip.id);
      return;
    }
    if (action === 'edit') {
      this.editTrip(trip);
      return;
    }
    console.log(`[Action] ${action}`, trip.id);
  }

  /** Navigate to the full trip details page */
  protected viewTripDetails(trip: OrganizerTrip): void {
    this.router.navigate(['/organizer/trips', trip.id]);
  }

  protected manageBookings(trip: OrganizerTrip): void {
    this.router.navigate(['/organizer/trips', trip.id, 'bookings']);
  }

  protected editTrip(trip: OrganizerTrip): void {
    this.router.navigate(['/organizer/trips', trip.id, 'edit']);
  }

  protected goNewTrip(): void {
    this.router.navigate(['/organizer/trips/create']);
  }
}
