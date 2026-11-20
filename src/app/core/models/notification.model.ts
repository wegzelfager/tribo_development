export type NotificationType =
  | 'trip_accepted'
  | 'trip_rejected'
  | 'trip_pending'
  | 'booking_new'
  | 'trip_created'
  | 'trip_cancelled'
  | 'organizer_approved'
  | 'organizer_rejected'
  | 'user_verified'
  | 'user_unverified'
  | 'account_blocked'
  | 'account_unblocked'
  | 'system';

export interface AppNotification {
  _id: string;
  recipient: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedId?: {
    _id: string;
    title?: string;
    destination?: string;
    price?: number;
    startDate?: string;
  } | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface NotificationResponse {
  statusCode: number;
  message: string;
  data: {
    notifications: AppNotification[];
    unreadCount: number;
    pagination: NotificationPagination;
  };
}

export interface UnreadCountResponse {
  statusCode: number;
  message: string;
  data: {
    unreadCount: number;
  };
}
