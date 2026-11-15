import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { NotificationService } from '../../../core/services/notification.service';
import { AppNotification, NotificationType } from '../../../core/models/notification.model';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, OverlayModule],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationBellComponent implements OnInit {
  readonly notificationService = inject(NotificationService);

  readonly isOpen = signal<boolean>(false);
  readonly filter = signal<'all' | 'unread'>('all');
  readonly loadingMore = signal<boolean>(false);

  readonly filteredNotifications = computed(() => {
    const list = this.notificationService.notifications();
    if (this.filter() === 'unread') {
      return list.filter((n) => !n.isRead);
    }
    return list;
  });

  readonly overlayPositions: ConnectedPosition[] = [
    {
      originX: 'end',
      originY: 'bottom',
      overlayX: 'end',
      overlayY: 'top',
      offsetY: 10,
    },
    {
      originX: 'start',
      originY: 'bottom',
      overlayX: 'start',
      overlayY: 'top',
      offsetY: 10,
    },
    {
      originX: 'end',
      originY: 'top',
      overlayX: 'end',
      overlayY: 'bottom',
      offsetY: -10,
    }
  ];

  ngOnInit(): void {
    // Initial fetch of notifications & unread count (10 items per page)
    this.notificationService.loadNotifications(1, 10).subscribe();
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.isOpen.set(true);
    // Refresh page 1 when opening dropdown
    this.notificationService.loadNotifications(1, 10).subscribe();
  }

  loadMore(): void {
    const p = this.notificationService.pagination();
    if (p && p.hasMore && !this.loadingMore()) {
      this.loadingMore.set(true);
      this.notificationService.loadNotifications(p.page + 1, 10, true).subscribe({
        next: () => this.loadingMore.set(false),
        error: () => this.loadingMore.set(false),
      });
    }
  }

  close(): void {
    this.isOpen.set(false);
  }

  setFilter(mode: 'all' | 'unread'): void {
    this.filter.set(mode);
  }

  onItemClick(notification: AppNotification): void {
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification._id);
    }
  }

  markAllAsRead(event: Event): void {
    event.stopPropagation();
    this.notificationService.markAllAsRead();
  }

  deleteNotification(event: Event, id: string): void {
    event.stopPropagation();
    this.notificationService.deleteNotification(id);
  }

  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  getTypeLabel(type: NotificationType): string {
    switch (type) {
      case 'user_verified':
        return 'Verified';
      case 'user_unverified':
        return 'Status Alert';
      case 'booking_new':
        return 'New Booking';
      case 'trip_accepted':
        return 'Trip Approved';
      case 'trip_rejected':
        return 'Trip Rejected';
      case 'trip_cancelled':
        return 'Cancelled';
      case 'organizer_approved':
        return 'Organizer Approved';
      default:
        return 'Notice';
    }
  }
}
