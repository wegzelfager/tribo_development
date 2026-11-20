import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  injectAdminTripsQuery,
  injectReviewTripMutation,
} from '../../../../../core/queries/admin.queries';
import {
  AdminTripFilterParams,
} from '../../../../../core/models/admin.model';
import {
  Trip,
  TripApprovalStatus,
  TripStatus,
} from '../../../../../core/models/trip.model';

@Component({
  selector: 'app-trips-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trips-list.component.html',
  styleUrl: './trips-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripsListComponent {
  private readonly router = inject(Router);

  // ── Filter State ──
  searchQuery = signal('');
  approvalFilter = signal<TripApprovalStatus | ''>('');
  statusFilter = signal<TripStatus | ''>('');
  currentPage = signal(1);
  readonly limit = 10;

  // ── Rejection Modal State ──
  rejectModalOpen = signal(false);
  selectedTripForReject = signal<Trip | null>(null);
  rejectReason = signal('');
  rejectError = signal('');

  // ── Query Params ──
  private params = computed<AdminTripFilterParams>(() => ({
    page: this.currentPage(),
    limit: this.limit,
    search: this.searchQuery().trim() || undefined,
    approvalStatus: this.approvalFilter() || undefined,
    status: this.statusFilter() || undefined,
  }));

  // ── Queries & Mutations ──
  tripsQuery = injectAdminTripsQuery(() => this.params());
  reviewMutation = injectReviewTripMutation();

  // ── Computed ──
  trips = computed(() => this.tripsQuery.data()?.trips ?? []);
  pagination = computed(() => this.tripsQuery.data()?.pagination);
  isLoading = computed(() => this.tripsQuery.isLoading());
  isError = computed(() => this.tripsQuery.isError());
  totalPages = computed(() => this.pagination()?.totalPages ?? 1);

  // ── Handlers ──
  onSearch(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
  }

  onApprovalChange(value: string): void {
    this.approvalFilter.set(value as TripApprovalStatus | '');
    this.currentPage.set(1);
  }

  onStatusChange(value: string): void {
    this.statusFilter.set(value as TripStatus | '');
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
  }

  pagesArray(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }

  viewTrip(trip: Trip): void {
    this.router.navigate(['/trips', trip._id]);
  }

  // ── Approval Actions ──
  onApprove(event: Event, trip: Trip): void {
    event.stopPropagation();
    if (confirm(`Are you sure you want to approve "${trip.title}"?`)) {
      this.reviewMutation.mutate({
        tripId: trip._id,
        approvalStatus: 'approved',
      });
    }
  }

  onSetPending(event: Event, trip: Trip): void {
    event.stopPropagation();
    if (confirm(`Reset approval status of "${trip.title}" to pending?`)) {
      this.reviewMutation.mutate({
        tripId: trip._id,
        approvalStatus: 'pending',
      });
    }
  }

  openRejectModal(event: Event, trip: Trip): void {
    event.stopPropagation();
    this.selectedTripForReject.set(trip);
    this.rejectReason.set('');
    this.rejectError.set('');
    this.rejectModalOpen.set(true);
  }

  closeRejectModal(): void {
    this.rejectModalOpen.set(false);
    this.selectedTripForReject.set(null);
    this.rejectReason.set('');
    this.rejectError.set('');
  }

  confirmReject(): void {
    const trip = this.selectedTripForReject();
    const reason = this.rejectReason().trim();

    if (!trip) return;

    if (!reason) {
      this.rejectError.set('Please provide a reason for rejecting this trip.');
      return;
    }

    this.reviewMutation.mutate(
      {
        tripId: trip._id,
        approvalStatus: 'rejected',
        message: reason,
      },
      {
        onSuccess: () => {
          this.closeRejectModal();
        },
        onError: (err: any) => {
          this.rejectError.set(err?.error?.message || 'Failed to reject trip.');
        },
      }
    );
  }

  // ── Styling Helpers ──
  approvalBadgeClass(status: TripApprovalStatus): string {
    switch (status) {
      case 'approved':
        return 'badge-status badge-status--approved';
      case 'rejected':
        return 'badge-status badge-status--rejected';
      case 'pending':
      default:
        return 'badge-status badge-status--pending';
    }
  }

  tripStatusBadgeClass(status: TripStatus): string {
    switch (status) {
      case 'ongoing':
        return 'pill-status pill-status--ongoing';
      case 'completed':
        return 'pill-status pill-status--completed';
      case 'cancelled':
        return 'pill-status pill-status--cancelled';
      case 'upcoming':
      default:
        return 'pill-status pill-status--upcoming';
    }
  }
}
