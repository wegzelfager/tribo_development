# 🗺️ Tribo - Trips Module API Documentation

> **Target Audience:** Frontend Team (Angular / Mobile / Web)  
> **Base Version:** API v1  
> **Last Updated:** November 2026  

---

## 📌 1. General Overview & Configuration

### 🌐 Base URLs
| Environment | Base URL |
| :--- | :--- |
| **Development** | `http://localhost:5000/api/v1/trips` |
| **Production** | `https://tribobackend-production.up.railway.app/api/v1/trips` |

---

### 🔐 Authentication & Headers
All Trips endpoints are protected by the `protect` middleware.

* **Option A (Bearer Token):**  
  `Authorization: Bearer <ACCESS_TOKEN>`
* **Option B (HTTP-Only Cookie):**  
  Sent automatically when requests include `withCredentials: true` (`credentials: 'include'`).

> [!IMPORTANT]
> Some endpoints (Create, Update, Delete, My Trips) additionally require the user to have the **`organizer`** role (`restrictTo('organizer')`).

---

### 📦 Standard API Response Formats

#### ✅ Success Response (200 / 201)
```json
{
  "status": "success",
  "message": "Trip created successfully",
  "data": {
    "trip": { ... }
  }
}
```

#### ❌ General Error Response (400 / 401 / 403 / 404 / 500)
```json
{
  "status": "fail",
  "message": "Trip not found"
}
```

#### ⚠️ Validation Error Response (400 Bad Request via Zod)
```json
{
  "status": "fail",
  "message": "Validation error",
  "errors": [
    {
      "field": "title",
      "message": "Title must be at least 3 characters"
    },
    {
      "field": "durationDays",
      "message": "Duration (2 days) cannot be less than the number of itinerary days (3 days)"
    }
  ]
}
```

---

## 📋 2. Endpoints Summary Table

| Method | Endpoint | Role | Content-Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/trips` | Any Auth User | N/A | Explore/search trips with filters & pagination |
| `GET` | `/api/v1/trips/my-trips` | `organizer` | N/A | Get organizer's own trips with pagination |
| `GET` | `/api/v1/trips/:id` | Any Auth User | N/A | Get full details of a specific trip |
| `POST` | `/api/v1/trips` | `organizer` | `multipart/form-data` | Create a new trip with images |
| `PATCH` | `/api/v1/trips/:id` | `organizer` (Owner) | `multipart/form-data` or `json` | Update trip details and/or images |
| `DELETE`| `/api/v1/trips/:id` | `organizer` (Owner) | N/A | Delete trip (if not ongoing) |

---

## 🔍 3. Endpoints in Detail

---

### 1️⃣ Get All Trips (Public Explore & Filter)
Retrieves a paginated list of upcoming/active trips (cancelled trips are automatically filtered out). Results are cached in Redis for fast loading.

* **Method:** `GET`
* **URL:** `/api/v1/trips`
* **Auth:** Required (`protect`)

#### Query Parameters:
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `page` | number | No | `1` | Page number (min: 1) |
| `limit` | number | No | `10` | Items per page (min: 1, max: 50) |
| `location` | string | No | `""` | Case-insensitive search on destination |
| `minPrice` | number | No | - | Minimum price per person filter |
| `maxPrice` | number | No | - | Maximum price per person filter |
| `sortBy` | string | No | `'createdAt'` | Sort field: `'pricePerPerson'` \| `'durationDays'` \| `'createdAt'` |
| `order` | string | No | `'desc'` | Sort order: `'asc'` \| `'desc'` |

#### 📤 Example Request:
```http
GET /api/v1/trips?location=Dahab&minPrice=500&maxPrice=3000&sortBy=pricePerPerson&order=asc&page=1&limit=10
Authorization: Bearer <TOKEN>
```

#### 📥 Success Response (200 OK):
```json
{
  "status": "success",
  "message": "Trips fetched successfully",
  "data": {
    "trips": [
      {
        "_id": "673752e2f6a91b48b59d1a10",
        "title": "Dahab Blue Hole & Canyon Adventure",
        "coverImage": "https://res.cloudinary.com/dmkt2t0d2/image/upload/v1731670754/tribo/trips/cover.jpg",
        "images": [
          "https://res.cloudinary.com/dmkt2t0d2/image/upload/v1731670755/tribo/trips/image1.jpg"
        ],
        "location": "Dahab, South Sinai",
        "durationDays": 4,
        "maxCapacity": 15,
        "meetingPoint": "Cairo Airport Terminal 3",
        "pricePerPerson": 2200,
        "description": "An unforgettable 4-day desert & diving journey...",
        "highlights": ["Diving at Blue Hole", "Bedouin Dinner under stars"],
        "itinerary": [
          {
            "dayNumber": 1,
            "dayTitle": "Arrival & Lagoon Sunset",
            "activitySummary": "Check-in at camp and sunset gathering",
            "timelineEvents": ["08:00 AM Departure", "02:00 PM Arrival"]
          }
        ],
        "includedItems": ["Accommodation", "Transportation", "Breakfast"],
        "excludedItems": ["Diving gear rental"],
        "ageRestriction": {
          "type": "Any Age",
          "minAge": 0,
          "maxAge": 100
        },
        "approvalStatus": "approved",
        "status": "upcoming",
        "organizer": {
          "_id": "67374b9ef6a91b48b59d19f0",
          "name": "Ahmed Al-Rashid",
          "profileImage": "https://res.cloudinary.com/..."
        },
        "createdAt": "2026-11-15T14:19:14.000Z",
        "updatedAt": "2026-11-15T14:19:14.000Z"
      }
    ],
    "pagination": {
      "total": 24,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    }
  }
}
```

---

### 2️⃣ Get Single Trip Details
Fetches full details of a specific trip by its ID, including organizer contact details.

* **Method:** `GET`
* **URL:** `/api/v1/trips/:id`
* **Auth:** Required (`protect`)
* **Path Params:** `id` (MongoDB ObjectId)

#### 📥 Success Response (200 OK):
```json
{
  "status": "success",
  "message": "Trip fetched successfully",
  "data": {
    "trip": {
      "_id": "673752e2f6a91b48b59d1a10",
      "title": "Dahab Blue Hole & Canyon Adventure",
      "coverImage": "https://res.cloudinary.com/...",
      "images": ["https://res.cloudinary.com/..."],
      "location": "Dahab, South Sinai",
      "durationDays": 4,
      "maxCapacity": 15,
      "meetingPoint": "Cairo Airport Terminal 3",
      "pricePerPerson": 2200,
      "description": "Full detailed description...",
      "highlights": ["Diving at Blue Hole"],
      "itinerary": [
        {
          "dayNumber": 1,
          "dayTitle": "Arrival",
          "activitySummary": "Welcome gathering",
          "timelineEvents": ["10:00 AM Meeting"]
        }
      ],
      "includedItems": ["Transportation", "Camp"],
      "excludedItems": ["Personal snacks"],
      "ageRestriction": {
        "type": "Custom Limit",
        "minAge": 18,
        "maxAge": 55
      },
      "approvalStatus": "approved",
      "status": "upcoming",
      "organizer": {
        "_id": "67374b9ef6a91b48b59d19f0",
        "name": "Ahmed Al-Rashid",
        "email": "ahmed@tribo.com",
        "profileImage": "https://res.cloudinary.com/..."
      },
      "createdAt": "2026-11-15T14:19:14.000Z"
    }
  }
}
```

#### ❌ Error Responses:
* `404 Not Found`: `{"status": "fail", "message": "Trip not found"}`
* `404 Not Found`: `{"status": "fail", "message": "This trip has been cancelled"}`

---

### 3️⃣ Get My Trips (Organizer Portal)
Fetches all trips created by the currently logged-in organizer.

* **Method:** `GET`
* **URL:** `/api/v1/trips/my-trips`
* **Auth:** Required (`protect` + Role `organizer`)

#### Query Parameters:
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `page` | number | No | `1` | Page number |
| `limit` | number | No | `10` | Items per page (max: 50) |

#### 📥 Success Response (200 OK):
```json
{
  "status": "success",
  "message": "Your trips fetched successfully",
  "data": {
    "trips": [
      {
        "_id": "673752e2f6a91b48b59d1a10",
        "title": "Dahab Blue Hole & Canyon Adventure",
        "coverImage": "https://res.cloudinary.com/...",
        "status": "upcoming",
        "approvalStatus": "approved",
        "durationDays": 4,
        "maxCapacity": 15,
        "pricePerPerson": 2200,
        "location": "Dahab, South Sinai",
        "description": "...",
        "createdAt": "2026-11-15T14:19:14.000Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

---

### 4️⃣ Create New Trip (Organizer)
Creates a new expedition trip with Cloudinary image uploads.

* **Method:** `POST`
* **URL:** `/api/v1/trips`
* **Auth:** Required (`protect` + Role `organizer`)
* **Rate Limit:** 10 requests / 1 hour per IP
* **Content-Type:** `multipart/form-data`

#### 📁 Files:
| Field Name | Type | Required | Max Files | Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `coverImage` | File | **YES** | 1 | Images only (jpg, png, webp), max 5MB |
| `images` | File[] | NO | 10 | Images only (jpg, png, webp), max 5MB each |

#### 📝 Form Fields (`multipart/form-data`):
| Field | Type | Required | Constraints | Example Value |
| :--- | :--- | :--- | :--- | :--- |
| `title` | String | **YES** | 3 to 100 chars | `"Sinai Mountain Sunrise Expedition"` |
| `location` | String | **YES** | 2 to 150 chars | `"Saint Catherine, South Sinai"` |
| `durationDays` | Number | **YES** | 1 to 365 days | `3` |
| `maxCapacity` | Number | **YES** | 1 to 1000 people | `20` |
| `meetingPoint` | String | **YES** | 3 to 200 chars | `"Abbassia Bus Station, Cairo"` |
| `pricePerPerson` | Number | **YES** | Min: 0, Max: 1,000,000 | `1850` |
| `description` | String | **YES** | 20 to 5000 chars | `"Climb Mount Moses at dawn and experience..."` |
| `ageRestriction` | JSON String | NO | Object with `type`, `minAge`, `maxAge` | `{"type":"Custom Limit","minAge":16,"maxAge":60}` |
| `highlights` | JSON String / Array | NO | Max 20 items, max 200 chars/item | `["Sunrise at Moses Mountain","Bedouin Campfire"]` |
| `itinerary` | JSON String / Array | NO | Array of Day Objects (see rules below) | *(See schema below)* |
| `includedItems` | JSON String / Array | NO | Max 50 items | `["Transport A/C bus","Local Bedouin guide","2 Dinners"]` |
| `excludedItems` | JSON String / Array | NO | Max 50 items | `["Personal hiking poles","Sleeping bag rental"]` |

> [!WARNING]
> **Critical Validation Rules for Itinerary:**
> 1. `durationDays` **must not be less** than the number of days in `itinerary`.
> 2. No `dayNumber` inside `itinerary` can be greater than `durationDays`.
> 3. Complex arrays/objects (`itinerary`, `highlights`, `ageRestriction`, `includedItems`, `excludedItems`) **must be JSON-stringified** when appended to `FormData`.

#### 🧩 Itinerary Day Object Schema:
```json
[
  {
    "dayNumber": 1,
    "dayTitle": "Arrival & Camp Setup",
    "activitySummary": "Travel from Cairo to St. Catherine, check-in, and evening tea.",
    "timelineEvents": [
      "07:00 AM - Meet at Abbassia",
      "02:00 PM - Arrive St. Catherine",
      "08:00 PM - Bedouin dinner"
    ]
  },
  {
    "dayNumber": 2,
    "dayTitle": "Summit Climb",
    "activitySummary": "Ascend to Mount Sinai peak for sunrise.",
    "timelineEvents": [
      "01:00 AM - Start ascent",
      "05:30 AM - Sunrise on summit",
      "10:00 AM - Monastery visit"
    ]
  }
]
```

#### 📥 Success Response (201 Created):
```json
{
  "status": "success",
  "message": "Trip created successfully",
  "data": {
    "trip": {
      "_id": "67389c90f23b7a1d12345678",
      "title": "Sinai Mountain Sunrise Expedition",
      "coverImage": "https://res.cloudinary.com/dmkt2t0d2/image/upload/v1731757200/tribo/trips/cover.jpg",
      "images": [],
      "location": "Saint Catherine, South Sinai",
      "durationDays": 3,
      "maxCapacity": 20,
      "meetingPoint": "Abbassia Bus Station, Cairo",
      "pricePerPerson": 1850,
      "description": "Climb Mount Moses at dawn and experience...",
      "highlights": ["Sunrise at Moses Mountain", "Bedouin Campfire"],
      "itinerary": [ ... ],
      "includedItems": [ ... ],
      "excludedItems": [ ... ],
      "ageRestriction": {
        "type": "Custom Limit",
        "minAge": 16,
        "maxAge": 60
      },
      "approvalStatus": "approved",
      "status": "upcoming",
      "organizer": "67374b9ef6a91b48b59d19f0",
      "createdAt": "2026-11-16T12:00:00.000Z",
      "updatedAt": "2026-11-16T12:00:00.000Z"
    }
  }
}
```

---

### 5️⃣ Update Trip (Organizer)
Updates an existing trip. Only the organizer who created the trip can edit it.

* **Method:** `PATCH`
* **URL:** `/api/v1/trips/:id`
* **Auth:** Required (`protect` + Role `organizer`)
* **Content-Type:** `multipart/form-data` (if updating images) OR `application/json` (if text only)
* **Path Params:** `id` (Trip ObjectId)

> [!CAUTION]
> Cannot update trips that are currently marked as **`ongoing`** or **`completed`**.

#### Updatable Fields:
All fields from **Create Trip** are supported and are **optional** for `PATCH`:
* `title`, `location`, `durationDays`, `maxCapacity`, `meetingPoint`, `pricePerPerson`, `description`
* `coverImage` (New file will replace existing cover image)
* `images` (New files will replace existing secondary images)
* `highlights`, `itinerary`, `includedItems`, `excludedItems`, `ageRestriction`

#### 📥 Success Response (200 OK):
```json
{
  "status": "success",
  "message": "Trip updated successfully",
  "data": {
    "trip": {
      "_id": "67389c90f23b7a1d12345678",
      "title": "Sinai Mountain Sunrise Expedition (Updated)",
      "pricePerPerson": 1950,
      "updatedAt": "2026-11-16T12:45:00.000Z"
    }
  }
}
```

#### ❌ Error Responses:
* `403 Forbidden`: `{"status": "fail", "message": "You are not authorized to update this trip"}`
* `400 Bad Request`: `{"status": "fail", "message": "Cannot update a trip that is ongoing"}`

---

### 6️⃣ Delete Trip (Organizer)
Deletes a trip from the database and clears all related cache entries.

* **Method:** `DELETE`
* **URL:** `/api/v1/trips/:id`
* **Auth:** Required (`protect` + Role `organizer`)
* **Path Params:** `id` (Trip ObjectId)

> [!NOTE]
> Cannot delete a trip that is currently **`ongoing`**.

#### 📥 Success Response (200 OK):
```json
{
  "status": "success",
  "message": "Trip deleted successfully",
  "data": null
}
```

---

## 💻 4. TypeScript Interfaces (Copy & Paste for Frontend)

Save this file as `src/app/core/models/trip.model.ts` in your frontend project:

```typescript
export type TripApprovalStatus = 'pending' | 'approved' | 'rejected';
export type TripStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
export type AgeRestrictionType = 'Any Age' | 'Custom Limit';

export interface AgeRestriction {
  type: AgeRestrictionType;
  minAge?: number;
  maxAge?: number;
}

export interface ItineraryDay {
  dayNumber: number;
  dayTitle: string;
  activitySummary?: string;
  timelineEvents?: string[];
}

export interface TripOrganizer {
  _id: string;
  name: string;
  profileImage?: string;
  email?: string;
}

export interface Trip {
  _id: string;
  title: string;
  coverImage: string;
  images: string[];
  location: string;
  durationDays: number;
  maxCapacity: number;
  meetingPoint: string;
  ageRestriction: AgeRestriction;
  description: string;
  highlights: string[];
  itinerary: ItineraryDay[];
  includedItems: string[];
  excludedItems: string[];
  pricePerPerson: number;
  organizer: TripOrganizer | string;
  approvalStatus: TripApprovalStatus;
  status: TripStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TripPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TripListResponse {
  status: 'success' | 'fail';
  message: string;
  data: {
    trips: Trip[];
    pagination: TripPagination;
  };
}

export interface SingleTripResponse {
  status: 'success' | 'fail';
  message: string;
  data: {
    trip: Trip;
  };
}

export interface TripFilterParams {
  page?: number;
  limit?: number;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'pricePerPerson' | 'durationDays' | 'createdAt';
  order?: 'asc' | 'desc';
}

export interface CreateTripDto {
  title: string;
  location: string;
  durationDays: number;
  maxCapacity: number;
  meetingPoint: string;
  pricePerPerson: number;
  description: string;
  ageRestriction?: AgeRestriction;
  highlights?: string[];
  itinerary?: ItineraryDay[];
  includedItems?: string[];
  excludedItems?: string[];
}
```

---

## 🛠️ 5. Angular Helper: Preparing FormData for Create / Update

Because the endpoint receives files (`coverImage`, `images`) alongside complex objects (`itinerary`, `highlights`), use this helper function to build the `FormData`:

```typescript
export function buildTripFormData(dto: CreateTripDto, coverFile: File, galleryFiles?: File[]): FormData {
  const formData = new FormData();

  // 1. Files
  formData.append('coverImage', coverFile);
  if (galleryFiles && galleryFiles.length > 0) {
    galleryFiles.forEach((file) => formData.append('images', file));
  }

  // 2. Primitive fields
  formData.append('title', dto.title);
  formData.append('location', dto.location);
  formData.append('durationDays', String(dto.durationDays));
  formData.append('maxCapacity', String(dto.maxCapacity));
  formData.append('meetingPoint', dto.meetingPoint);
  formData.append('pricePerPerson', String(dto.pricePerPerson));
  formData.append('description', dto.description);

  // 3. Complex JSON fields (Must be JSON stringified)
  if (dto.ageRestriction) {
    formData.append('ageRestriction', JSON.stringify(dto.ageRestriction));
  }
  if (dto.highlights && dto.highlights.length > 0) {
    formData.append('highlights', JSON.stringify(dto.highlights));
  }
  if (dto.itinerary && dto.itinerary.length > 0) {
    formData.append('itinerary', JSON.stringify(dto.itinerary));
  }
  if (dto.includedItems && dto.includedItems.length > 0) {
    formData.append('includedItems', JSON.stringify(dto.includedItems));
  }
  if (dto.excludedItems && dto.excludedItems.length > 0) {
    formData.append('excludedItems', JSON.stringify(dto.excludedItems));
  }

  return formData;
}
```
