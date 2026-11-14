import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Trip } from '../../../core/models/trip.model';
import { injectTripDetailQuery } from '../../../core/queries/trip.queries';

export type DetailTab = 'overview' | 'itinerary' | 'included';

const ICONS = {
  back:    'M19 12H5M12 19l-7-7 7-7',
  heart:   'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  share:   'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13',
  pin:     'M12 21s6.5-5.6 6.5-11a6.5 6.5 0 10-13 0C5.5 15.4 12 21 12 21zM12 12.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4z',
  star:    'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  check:   'M5 13l4 4L19 7',
  cross:   'M18 6L6 18M6 6l12 12',
  chevron: 'M19 9l-7 7-7-7',
  clock:   'M12 22a10 10 0 110-20 10 10 0 010 20zM12 6v6l4 2',
  users:   'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  arrow:   'M5 12h14M13 6l6 6-6 6',
} as const;

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './trip-detail.component.html',
  styleUrl:    './trip-detail.component.scss',
})
export class TripDetailComponent {
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly icons = ICONS;

  protected readonly tripId = signal<string | null>(
    this.route.snapshot.paramMap.get('id')
  );

  protected readonly tripQuery = injectTripDetailQuery(() => this.tripId());

  protected readonly trip    = computed<Trip | null>(() => this.tripQuery.data() ?? null);
  protected readonly loading = computed(() => this.tripQuery.isLoading());
  protected readonly error   = computed(() => {
    if (!this.tripId()) return 'No expedition ID provided.';
    const e = this.tripQuery.error();
    return e ? e.message : null;
  });

  // Tab definitions (3 tabs only: Overview, Itinerary, Included)
  protected readonly tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview',   label: 'Overview'   },
    { id: 'itinerary',  label: 'Itinerary'  },
    { id: 'included',   label: 'Included'   },
  ];

  // Tab state
  protected readonly activeTab = signal<DetailTab>('overview');

  // Itinerary accordion: index of expanded day (-1 = none, 0 = first expanded by default)
  protected readonly expandedDay = signal<number>(0);

  // ── actions ──────────────────────────────────────────────────
  protected setTab(tab: DetailTab): void { this.activeTab.set(tab); }

  protected toggleDay(idx: number): void {
    this.expandedDay.set(this.expandedDay() === idx ? -1 : idx);
  }

  protected goBack(): void {
    if (this.router.url.includes('/organizer/')) {
      this.router.navigate(['/organizer/trips']);
    } else {
      this.router.navigate(['/trips']);
    }
  }

  protected bookTrip(): void {
    const t = this.trip();
    if (!t) return;
    this.router.navigate(['/booking/checkout'], { queryParams: { tripId: t._id } });
  }

  protected getInitials(name?: string): string {
    if (!name) return 'TR';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }

  // Meetup alias: show meetingPoint as the meetup chip
  protected meetup(t: Trip): string { return t.meetingPoint ?? 'TBD'; }

  // Parse time and text from timeline event string
  protected parseTimelineEvent(event: string): { time?: string; text: string } {
    const match = event.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\s*[-:—–]?\s*(.*)$/i);
    if (match) {
      return { time: match[1], text: match[2] || event };
    }
    return { text: event };
  }
}
