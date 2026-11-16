# 🔔 Tribo - Notifications & Real-Time Socket.IO API Documentation

> **Target Audience:** Frontend Team (Angular / Web / Mobile)  
> **Base Version:** API v1  
> **Last Updated:** November 2026  

---

## 📌 1. Architecture Overview

The Tribo Notification System consists of two synchronized layers:
1. **REST API (`/api/v1/notifications`):** For initial data fetching, paginated history (10 per page), marking as read, badge count, and deletion.
2. **WebSocket (Socket.IO):** For instantaneous, real-time push notifications delivered to connected users when events happen (e.g. account verification, trip approved, new booking).

```
   [ Backend Event Trigger ]
              │
      ┌───────┴───────┐
      ▼               ▼
[ Save to MongoDB ]  [ Push via Socket.IO ]
      │               │
      │               ▼
[ Invalidate Cache ] [ Frontend Socket Listener ]
                      │
                      ▼
             [ Update Signal & Badge ]
             [ Show Toast & Play Audio ]
```

---

## 🌐 2. Base URLs & Connection Endpoints

| Service | Development | Production |
| :--- | :--- | :--- |
| **REST API Base** | `http://localhost:5000/api/v1/notifications` | `https://tribobackend-production.up.railway.app/api/v1/notifications` |
| **Socket.IO Server** | `http://localhost:5000` | `https://tribobackend-production.up.railway.app` |

---

## ⚡ 3. Socket.IO Real-Time Integration

### 🔑 Authentication Handshake
When connecting to Socket.IO, pass the user's `accessToken` in the `auth` object:

```typescript
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('https://tribobackend-production.up.railway.app', {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  auth: {
    token: accessToken // JWT Access Token string
  }
});
```

* The server verifies the JWT token using `JWT_ACCESS_SECRET`.
* Upon successful authentication, the server automatically joins the socket into a private room named after the user's ID: `socket.join(userId.toString())`.
* If the token is missing or invalid, the socket connection will be rejected with an `Authentication error`.

---

### 📡 Real-Time Events

#### Event: `new_notification`
Triggered by backend services whenever a notification is sent to the logged-in user.

* **Direction:** Server ➔ Client
* **Event Name:** `new_notification`
* **Payload Structure (`AppNotification`):**

```json
{
  "_id": "673752e2f6a91b48b59d9999",
  "recipient": "67374b9ef6a91b48b59d19f0",
  "title": "Account Verified",
  "message": "Your account and national ID have been successfully verified by Tribo admin.",
  "type": "user_verified",
  "relatedId": null,
  "isRead": false,
  "createdAt": "2026-11-16T13:00:00.000Z",
  "updatedAt": "2026-11-16T13:00:00.000Z"
}
```

---

### 🏷️ Available Notification Types (`NotificationType`)

| Type Name | Description | When It Triggers |
| :--- | :--- | :--- |
| `user_verified` | Account ID verification approved | Admin verifies user national ID |
| `user_unverified` | Account ID verification revoked | Admin revokes verification |
| `organizer_approved`| Organizer application approved | Admin approves organizer request |
| `organizer_rejected`| Organizer application rejected | Admin rejects organizer request |
| `trip_accepted` | Expedition approved by Admin | Admin publishes organizer's trip |
| `trip_rejected` | Expedition rejected by Admin | Admin rejects organizer's trip |
| `trip_created` | New expedition created | Trip successfully posted |
| `trip_cancelled` | Expedition cancelled | Organizer or Admin cancels trip |
| `booking_new` | New booking reserved | Traveler books a spot on trip |
| `system` | General system alert | System maintenance / updates |

---

## 📋 4. REST API Endpoints Summary Table

All REST endpoints require user authentication (`protect`).

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/notifications` | Get paginated list of user's notifications (default: 10 per page) |
| `GET` | `/api/v1/notifications/unread-count` | Get lightweight unread count for bell badge |
| `PATCH` | `/api/v1/notifications/:id/read` | Mark a specific notification as read |
| `PATCH` | `/api/v1/notifications/mark-all-read` | Mark all user notifications as read |
| `DELETE`| `/api/v1/notifications/:id` | Permanently delete a notification |

---

## 🔍 5. REST Endpoints in Detail

---

### 1️⃣ Get Notifications (Paginated)
Fetches user notifications sorted from newest to oldest.

* **Method:** `GET`
* **URL:** `/api/v1/notifications`
* **Auth:** Required (`protect` via Bearer token or cookie)

#### Query Parameters:
| Param | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `page` | number | No | `1` | Page number (min: 1) |
| `limit` | number | No | `10` | Items per page (min: 1, max: 50) |

#### 📥 Success Response (200 OK):
```json
{
  "status": "success",
  "message": "Notifications fetched successfully",
  "data": {
    "notifications": [
      {
        "_id": "673752e2f6a91b48b59d9999",
        "recipient": "67374b9ef6a91b48b59d19f0",
        "title": "Account Verified",
        "message": "Your account and national ID have been successfully verified by Tribo admin.",
        "type": "user_verified",
        "relatedId": null,
        "isRead": false,
        "createdAt": "2026-11-16T13:00:00.000Z",
        "updatedAt": "2026-11-16T13:00:00.000Z"
      },
      {
        "_id": "673752e2f6a91b48b59d8888",
        "recipient": "67374b9ef6a91b48b59d19f0",
        "title": "Trip Approved",
        "message": "Your expedition 'Dahab Blue Hole' has been approved by admin.",
        "type": "trip_accepted",
        "relatedId": {
          "_id": "673752e2f6a91b48b59d1a10",
          "title": "Dahab Blue Hole & Canyon Adventure",
          "destination": "Dahab, South Sinai",
          "price": 2200,
          "startDate": "2026-12-01T00:00:00.000Z"
        },
        "isRead": true,
        "createdAt": "2026-11-15T18:30:00.000Z",
        "updatedAt": "2026-11-15T19:00:00.000Z"
      }
    ],
    "unreadCount": 1,
    "pagination": {
      "total": 12,
      "page": 1,
      "limit": 10,
      "totalPages": 2,
      "hasMore": true
    }
  }
}
```

---

### 2️⃣ Get Unread Count (Lightweight Badge Check)
Returns only the unread count number. Ideal for lightweight initial badge loading or polling without transferring notification lists.

* **Method:** `GET`
* **URL:** `/api/v1/notifications/unread-count`
* **Auth:** Required (`protect`)

#### 📥 Success Response (200 OK):
```json
{
  "status": "success",
  "message": "Unread notifications count fetched successfully",
  "data": {
    "unreadCount": 3
  }
}
```

---

### 3️⃣ Mark Single Notification as Read
Marks a single notification as read by its ID. Automatically updates Redis cached unread counter.

* **Method:** `PATCH`
* **URL:** `/api/v1/notifications/:id/read`
* **Auth:** Required (`protect`)
* **Path Params:** `id` (Notification ObjectId)
* **Request Body:** None

#### 📥 Success Response (200 OK):
```json
{
  "status": "success",
  "message": "Notification marked as read",
  "data": {
    "notification": {
      "_id": "673752e2f6a91b48b59d9999",
      "isRead": true,
      "updatedAt": "2026-11-16T13:05:00.000Z"
    }
  }
}
```

---

### 4️⃣ Mark All Notifications as Read
Marks all unread notifications of the logged-in user as read in one batch operation and sets unread counter to 0.

* **Method:** `PATCH`
* **URL:** `/api/v1/notifications/mark-all-read`
* **Auth:** Required (`protect`)
* **Request Body:** None

#### 📥 Success Response (200 OK):
```json
{
  "status": "success",
  "message": "All notifications marked as read",
  "data": {
    "modifiedCount": 3
  }
}
```

---

### 5️⃣ Delete Notification
Permanently removes a notification from the database.

* **Method:** `DELETE`
* **URL:** `/api/v1/notifications/:id`
* **Auth:** Required (`protect`)
* **Path Params:** `id` (Notification ObjectId)

#### 📥 Success Response (200 OK):
```json
{
  "status": "success",
  "message": "Notification deleted successfully",
  "data": null
}
```

---

## 💻 6. TypeScript Interfaces (Copy & Paste for Frontend)

Save this file as `src/app/core/models/notification.model.ts`:

```typescript
export type NotificationType =
  | 'trip_accepted'
  | 'trip_rejected'
  | 'booking_new'
  | 'trip_created'
  | 'trip_cancelled'
  | 'organizer_approved'
  | 'organizer_rejected'
  | 'user_verified'
  | 'user_unverified'
  | 'system';

export interface RelatedTrip {
  _id: string;
  title?: string;
  destination?: string;
  departureLocation?: string;
  price?: number;
  startDate?: string;
}

export interface AppNotification {
  _id: string;
  recipient: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedId?: RelatedTrip | null;
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
  status: 'success' | 'fail';
  message: string;
  data: {
    notifications: AppNotification[];
    unreadCount: number;
    pagination: NotificationPagination;
  };
}

export interface UnreadCountResponse {
  status: 'success' | 'fail';
  message: string;
  data: {
    unreadCount: number;
  };
}
```

---

## 🛠️ 7. Frontend Integration Recommendations

1. **Optimistic Updates:** When the user clicks a notification to mark as read, update the local Signal/State immediately, decrement the unread counter by 1, and fire the `PATCH /:id/read` request in the background.
2. **Infinite Pagination / Load More:** Initial load should request `limit=10`. If `pagination.hasMore` is `true`, show a "Load more" button that requests `page + 1` with `limit=10` and appends the results.
3. **Sound & Toast:** When a new `new_notification` socket event arrives:
   - Prepend the notification to the list: `[newNotif, ...list]`.
   - Increment `unreadCount + 1`.
   - Trigger a bottom-right toast alert.
   - (Optional) Play a subtle chime via Web Audio API.
