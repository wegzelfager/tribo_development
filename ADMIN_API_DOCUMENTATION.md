# 🛡️ Tribo - Admin Module API Documentation

> **Target Audience:** Frontend Team (Admin Dashboard / Portal Developers)  
> **Base Version:** API v1  
> **Last Updated:** November 2026  

---

## 📌 1. General Overview & Security

### 🌐 Base URLs
| Environment | Base URL |
| :--- | :--- |
| **Development** | `http://localhost:5000/api/v1/admin` |
| **Production** | `https://tribobackend-production-f5280d85.up.railway.app/api/v1/admin` |

---

### 🔐 Access Control & Roles
Every single endpoint in the Admin module is strictly guarded by two layers of middleware:
1. `protect`: Validates the JWT access token (via Bearer header or HTTP-Only cookie).
2. `restrictTo('admin')`: Ensures `req.user.role === 'admin'`.

> [!CAUTION]
> If a non-admin user attempts to call any of these endpoints, the server returns:
> `403 Forbidden: {"status": "fail", "message": "You do not have permission to perform this action"}`

---

## 📋 2. Endpoints Summary Table

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/admin/users` | List users with pagination, role, verification, and search filters |
| `GET` | `/api/v1/admin/users/search` | Advanced search users with date ranges and multi-filters |
| `GET` | `/api/v1/admin/users/:id` | Get full profile of a single user (including ID card images) |
| `PATCH` | `/api/v1/admin/users/:id/block` | Toggle block/unblock status for a user |
| `PATCH` | `/api/v1/admin/users/:id/verify` | Toggle national ID verification status (triggers real-time notification) |

---

## 🔍 3. Endpoints in Detail

---

### 1️⃣ Get All Users (List & Filter)
Retrieves a paginated list of registered users sorted by registration date (newest first). Passwords are excluded from the output.

* **Method:** `GET`
* **URL:** `/api/v1/admin/users`
* **Auth:** Required (`role: admin`)

#### Query Parameters:
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `page` | number | No | `1` | Current page number (min: 1) |
| `limit` | number | No | `10` | Items per page (min: 1) |
| `search` | string | No | - | Case-insensitive regex search on `name` OR `email` |
| `role` | string | No | - | Filter by role: `'traveller'` \| `'organizer'` \| `'admin'` |
| `isVerified`| string | No | - | Filter verification status: `'true'` \| `'false'` |

#### 📤 Example Request:
```http
GET /api/v1/admin/users?role=organizer&isVerified=false&page=1&limit=10
Authorization: Bearer <ADMIN_TOKEN>
```

#### 📥 Success Response (200 OK):
```json
{
  "status": "success",
  "message": "Users fetched successfully",
  "data": {
    "users": [
      {
        "_id": "67374b9ef6a91b48b59d19f0",
        "name": "Ahmed Al-Rashid",
        "email": "ahmed@tribo.com",
        "age": 28,
        "role": "organizer",
        "profileImage": "https://res.cloudinary.com/dmkt2t0d2/image/upload/v1731670000/profile.jpg",
        "idCard": {
          "frontImage": "https://res.cloudinary.com/dmkt2t0d2/image/upload/v1731670001/front.jpg",
          "backImage": "https://res.cloudinary.com/dmkt2t0d2/image/upload/v1731670002/back.jpg",
          "isVerified": false
        },
        "isVerified": false,
        "isBlocked": false,
        "organizerProfile": null,
        "createdAt": "2026-11-15T12:00:00.000Z",
        "updatedAt": "2026-11-15T12:00:00.000Z"
      }
    ],
    "pagination": {
      "totalDocs": 42,
      "totalPages": 5,
      "currentPage": 1,
      "limit": 10
    }
  }
}
```

---

### 2️⃣ Advanced Search Users (Date Range & Multi-Filters)
Performs complex queries including date range filters on user registration dates.

* **Method:** `GET`
* **URL:** `/api/v1/admin/users/search`
* **Auth:** Required (`role: admin`)

#### Query Parameters:
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Page size (default: 10) |
| `search` | string | No | Search name or email |
| `role` | string | No | Filter role: `'traveller'` \| `'organizer'` \| `'admin'` |
| `isVerified`| string | No | `'true'` \| `'false'` |
| `startDate` | string | No | ISO Date (e.g. `2026-11-01` or `2026-11-01T00:00:00.000Z`) |
| `endDate` | string | No | ISO Date (e.g. `2026-11-30` or `2026-11-30T23:59:59.999Z`) |

#### 📥 Success Response (200 OK):
```json
{
  "status": "success",
  "message": "Advanced search completed successfully",
  "data": {
    "users": [ ... ],
    "pagination": {
      "totalDocs": 15,
      "totalPages": 2,
      "currentPage": 1,
      "limit": 10
    }
  }
}
```

---

### 3️⃣ Get User Profile Details
Retrieves full user details by user ID, including ID card front and back image URLs for verification review.

* **Method:** `GET`
* **URL:** `/api/v1/admin/users/:id`
* **Auth:** Required (`role: admin`)
* **Path Params:** `id` (User ObjectId)

#### 📥 Success Response (200 OK):
```json
{
  "status": "success",
  "message": "User fetched successfully",
  "data": {
    "_id": "67374b9ef6a91b48b59d19f0",
    "name": "Ahmed Al-Rashid",
    "email": "ahmed@tribo.com",
    "age": 28,
    "role": "organizer",
    "profileImage": "https://res.cloudinary.com/dmkt2t0d2/image/upload/v1731670000/profile.jpg",
    "idCard": {
      "frontImage": "https://res.cloudinary.com/dmkt2t0d2/image/upload/v1731670001/front.jpg",
      "backImage": "https://res.cloudinary.com/dmkt2t0d2/image/upload/v1731670002/back.jpg",
      "isVerified": false
    },
    "isVerified": false,
    "isBlocked": false,
    "organizerProfile": null,
    "createdAt": "2026-11-15T12:00:00.000Z",
    "updatedAt": "2026-11-15T12:00:00.000Z"
  }
}
```

#### ❌ Error Responses:
* `404 Not Found`: `{"status": "fail", "message": "User not found"}`

---

### 4️⃣ Toggle User Block Status
Toggles the `isBlocked` flag (`true` ⟷ `false`). Automatically logs the action into the admin audit trail (`ActivityLog`).

* **Method:** `PATCH`
* **URL:** `/api/v1/admin/users/:id/block`
* **Auth:** Required (`role: admin`)
* **Path Params:** `id` (User ObjectId)
* **Request Body:** None

#### 📥 Success Response (200 OK):
```json
{
  "status": "success",
  "message": "User block status updated successfully",
  "data": {
    "_id": "67374b9ef6a91b48b59d19f0",
    "name": "Ahmed Al-Rashid",
    "email": "ahmed@tribo.com",
    "isBlocked": true,
    "isVerified": false,
    "updatedAt": "2026-11-16T13:40:00.000Z"
  }
}
```

---

### 5️⃣ Toggle User Verification (ID Card Review)
Toggles the national ID verification status for a user (`isVerified` and `idCard.isVerified`).

* **Method:** `PATCH`
* **URL:** `/api/v1/admin/users/:id/verify`
* **Auth:** Required (`role: admin`)
* **Path Params:** `id` (User ObjectId)
* **Request Body:** None

#### ⚡ Automated Side Effects:
1. Toggles both `user.isVerified` and `user.idCard.isVerified`.
2. Creates an audit record in `ActivityLog`:
   * Action: `VERIFY_USER_ID_CARD` or `UNVERIFY_USER_ID_CARD`.
   * Details: Logged with admin ID and target user email.
3. Automatically triggers a **real-time push notification** to the user via Socket.IO:
   * **When Verified (`true`):**  
     Type: `user_verified`  
     Title: `"Account Verified"`  
     Message: `"Your account and national ID have been successfully verified by Tribo admin."`
   * **When Revoked (`false`):**  
     Type: `user_unverified`  
     Title: `"Verification Revoked"`  
     Message: `"Your account verification has been revoked by admin. Please contact support."`

#### 📥 Success Response (200 OK):
```json
{
  "status": "success",
  "message": "User verified successfully",
  "data": {
    "_id": "67374b9ef6a91b48b59d19f0",
    "name": "Ahmed Al-Rashid",
    "email": "ahmed@tribo.com",
    "isVerified": true,
    "idCard": {
      "frontImage": "https://res.cloudinary.com/...",
      "backImage": "https://res.cloudinary.com/...",
      "isVerified": true
    },
    "isBlocked": false,
    "updatedAt": "2026-11-16T13:40:00.000Z"
  }
}
```

---

## 💻 4. TypeScript Interfaces for Admin Dashboard

Save this file as `src/app/core/models/admin.model.ts`:

```typescript
export type UserRole = 'traveller' | 'organizer' | 'admin';

export interface UserIdCard {
  frontImage: string;
  backImage: string;
  isVerified: boolean;
}

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  age: number;
  role: UserRole;
  profileImage: string;
  idCard: UserIdCard;
  isVerified: boolean;
  isBlocked: boolean;
  organizerProfile?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPagination {
  totalDocs: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

export interface AdminUsersListResponse {
  status: 'success' | 'fail';
  message: string;
  data: {
    users: AdminUser[];
    pagination: AdminPagination;
  };
}

export interface AdminSingleUserResponse {
  status: 'success' | 'fail';
  message: string;
  data: AdminUser;
}

export interface AdminUserFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  isVerified?: boolean | string;
  startDate?: string;
  endDate?: string;
}
```
