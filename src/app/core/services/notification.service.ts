import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscription, catchError, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SocketService } from './socket.service';
import { ToastService } from './toast.service';
import {
  AppNotification,
  NotificationPagination,
  NotificationResponse,
  UnreadCountResponse
} from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly socketService = inject(SocketService);
  private readonly toastService = inject(ToastService);
  private readonly apiUrl = `${environment.apiUrl}/v1/notifications`;

  // Reactive state
  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadCount = signal<number>(0);
  readonly loading = signal<boolean>(false);
  readonly pagination = signal<NotificationPagination | null>(null);

  // Derived state
  readonly hasUnread = computed(() => this.unreadCount() > 0);

  private socketSub: Subscription | null = null;

  constructor() {
    this.initSocketListener();
  }

  /**
   * Initializes real-time listener for incoming notifications via Socket.IO
   */
  private initSocketListener(): void {
    this.socketSub = this.socketService
      .on<AppNotification>('new_notification')
      .subscribe({
        next: (newNotification) => {
          this.handleIncomingNotification(newNotification);
        },
        error: (err) => console.warn('Notification socket stream error:', err)
      });
  }

  /**
   * Handle an incoming real-time notification
   */
  private handleIncomingNotification(notification: AppNotification): void {
    this.notifications.update((list) => [notification, ...list]);
    this.unreadCount.update((count) => count + 1);

    // Show toast for real-time notification
    this.toastService.info(notification.message ?? 'You have a new notification', 5000);

    // Optional subtle audio notification
    this.playNotificationSound();
  }

  /**
   * Fetch paginated notifications from backend
   */
  loadNotifications(page = 1, limit = 10, append = false): Observable<NotificationResponse | null> {
    this.loading.set(true);

    return this.http
      .get<NotificationResponse>(`${this.apiUrl}?page=${page}&limit=${limit}`, {
        withCredentials: true
      })
      .pipe(
        tap((res) => {
          if (res?.data) {
            if (append) {
              this.notifications.update((prev) => {
                const existingIds = new Set(prev.map((n) => n._id));
                const newItems = res.data.notifications.filter((n) => !existingIds.has(n._id));
                return [...prev, ...newItems];
              });
            } else {
              this.notifications.set(res.data.notifications);
            }
            this.unreadCount.set(res.data.unreadCount ?? 0);
            this.pagination.set(res.data.pagination ?? null);
          }
          this.loading.set(false);
        }),
        catchError((err) => {
          console.warn('Failed to load notifications:', err);
          this.loading.set(false);
          return of(null);
        })
      );
  }

  /**
   * Fetch only unread count (lightweight, for badges)
   */
  loadUnreadCount(): Observable<UnreadCountResponse | null> {
    return this.http
      .get<UnreadCountResponse>(`${this.apiUrl}/unread-count`, {
        withCredentials: true
      })
      .pipe(
        tap((res) => {
          if (res?.data?.unreadCount !== undefined) {
            this.unreadCount.set(res.data.unreadCount);
          }
        }),
        catchError((err) => {
          console.warn('Failed to fetch unread count:', err);
          return of(null);
        })
      );
  }

  /**
   * Mark a single notification as read
   */
  markAsRead(notificationId: string): void {
    // Optimistic UI update
    const current = this.notifications();
    const target = current.find((n) => n._id === notificationId);

    if (target && !target.isRead) {
      this.notifications.update((list) =>
        list.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
      );
      this.unreadCount.update((c) => Math.max(0, c - 1));
    }

    this.http
      .patch(`${this.apiUrl}/${notificationId}/read`, {}, { withCredentials: true })
      .pipe(
        catchError((err) => {
          console.warn('Failed to mark notification as read:', err);
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): void {
    // Optimistic update
    this.notifications.update((list) => list.map((n) => ({ ...n, isRead: true })));
    this.unreadCount.set(0);

    this.http
      .patch(`${this.apiUrl}/mark-all-read`, {}, { withCredentials: true })
      .pipe(
        catchError((err) => {
          console.warn('Failed to mark all as read:', err);
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Delete a notification
   */
  deleteNotification(notificationId: string): void {
    const target = this.notifications().find((n) => n._id === notificationId);

    // Optimistic removal
    this.notifications.update((list) => list.filter((n) => n._id !== notificationId));
    if (target && !target.isRead) {
      this.unreadCount.update((c) => Math.max(0, c - 1));
    }

    this.http
      .delete(`${this.apiUrl}/${notificationId}`, { withCredentials: true })
      .pipe(
        catchError((err) => {
          console.warn('Failed to delete notification:', err);
          return of(null);
        })
      )
      .subscribe();
  }

  private playNotificationSound(): void {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch {
      // AudioContext not allowed or not supported in silent mode
    }
  }
}
