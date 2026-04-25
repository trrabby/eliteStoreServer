# Elite Store — Backend API

### "Feel the elegance" — REST API powering Bangladesh's premium e-commerce platform

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)

</div>

---

## Table of Contents

- [Elite Store — Backend API](#elite-store--backend-api)
  - ["Feel the elegance" — REST API powering Bangladesh's premium e-commerce platform](#feel-the-elegance--rest-api-powering-bangladeshs-premium-e-commerce-platform)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Architecture](#architecture)
  - [Tech Stack](#tech-stack)
  - [Project Structure](#project-structure)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Schema](#database-schema)
  - [API Modules](#api-modules)
  - [Authentication](#authentication)
  - [Payment Gateways](#payment-gateways)
    - [SSLCommerz](#sslcommerz)
    - [bKash (Tokenized Checkout)](#bkash-tokenized-checkout)
    - [Nagad](#nagad)
    - [Cash on Delivery](#cash-on-delivery)
    - [Wallet Topup](#wallet-topup)
  - [Real-time (Socket.io)](#real-time-socketio)
  - [File Uploads](#file-uploads)
  - [API Reference](#api-reference)
    - [Standard Response Format](#standard-response-format)
    - [Error Response Format](#error-response-format)
    - [Pagination](#pagination)
    - [Public vs Protected](#public-vs-protected)
  - [Scripts](#scripts)
  - [Key Design Decisions](#key-design-decisions)
  - [License](#license)

---

## Overview

Elite Store backend is a production-grade, multi-vendor e-commerce REST API built with **Node.js**, **TypeScript**, **Express**, **Prisma ORM**, and **PostgreSQL**. It powers all business logic for a Bangladesh-focused online marketplace including multi-vendor storefronts, full order lifecycle management, three payment gateways (SSLCommerz, bKash, Nagad), Steadfast courier integration, real-time notifications via Socket.io, and browser push notifications.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client (Next.js)                    │
└──────────────────────────┬──────────────────────────────┘
                           │  REST + Socket.io
┌──────────────────────────▼──────────────────────────────┐
│                   Express Server                        │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐  │
│  │ Middlewares││  Routes   │  │  Socket.io Server    │  │
│  │ - auth    │ │ /api/...  │  │  - notification      │  │
│  │ - validate│ │           │  │  - real-time events  │  │
│  │ - errors  │ │           │  └──────────────────────┘  │
│  └──────────┘  └─────┬─────┘                            │
│                      │                                  │
│  ┌───────────────────▼──────────────────────────────┐   │
│  │               Service Layer                       │   │
│  │  Business logic, validations, transactions        │   │
│  └───────────────────┬──────────────────────────────┘   │
│                      │                                  │
│  ┌───────────────────▼──────────────────────────────┐   │
│  │            Prisma ORM (Data Layer)                │   │
│  └───────────────────┬──────────────────────────────┘   │
└──────────────────────┼──────────────────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │       PostgreSQL DB         │
        └─────────────────────────────┘
```

---

## Tech Stack

| Category       | Technology                    |
| -------------- | ----------------------------- |
| Runtime        | Node.js 20+                   |
| Language       | TypeScript 5                  |
| Framework      | Express.js 4                  |
| ORM            | Prisma 6 (prisma-client-js)   |
| Database       | PostgreSQL 15                 |
| Authentication | JWT (access + refresh tokens) |
| Real-time      | Socket.io 4                   |
| File Upload    | Multer + Cloudinary           |
| Email          | Nodemailer (Gmail SMTP)       |
| Validation     | Zod                           |
| Push Notif.    | Web-push (VAPID)              |
| Payments       | SSLCommerz, bKash, Nagad      |
| Courier        | Steadfast Courier API         |
| Password       | bcrypt                        |

---

## Project Structure

```
src/
├── app/
│   ├── errors/
│   │   └── AppError.ts                    ← Custom error class
│   ├── middlewares/
│   │   ├── auth.ts                        ← JWT auth guard
│   │   ├── globalErrorHandler.ts          ← Global error middleware
│   │   ├── notFound.ts                    ← 404 handler
│   │   ├── validateRequest.ts             ← Zod JSON validation
│   │   ├── validateRequestFormdata.ts     ← Zod formdata validation
│   │   └── validateRequestFormdataMustPhotoArray.ts
│   ├── modules/
│   │   ├── Auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.route.ts
│   │   │   ├── auth.services.ts
│   │   │   └── auth.validation.ts
│   │   ├── User/
│   │   ├── VendorProfile/
│   │   ├── Category/
│   │   ├── Brand/
│   │   ├── Product/
│   │   ├── Cart/
│   │   ├── Wishlist/
│   │   ├── Coupon/
│   │   ├── Order/
│   │   ├── Payment/
│   │   ├── Shipment/
│   │   ├── ReturnRequest/
│   │   ├── Review/
│   │   ├── InventoryLog/
│   │   ├── Wallet/
│   │   └── Notification/
│   ├── routes/
│   │   └── index.ts                       ← All routes aggregated
│   └── socket.ts                          ← Socket.io server
├── config/
│   ├── index.ts                           ← All env variables
│   ├── cloudinary.config.ts
│   └── multer.config.ts
├── generated/
│   └── prisma/                            ← Generated Prisma client
├── helpers/
│   └── jwtHelpers.ts
├── shared/
│   ├── catchAsync.ts
│   ├── sendResponse.ts
│   ├── prisma.ts                          ← Prisma singleton
│   └── emailSender.ts
├── app.ts
└── server.ts

prisma/
└── schema.prisma                          ← Full database schema
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm or yarn

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/elite-store-backend.git
cd elite-store-backend

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env
# Fill in all required values in .env

# 4. Generate Prisma client
npx prisma generate

# 5. Run database migrations
npx prisma migrate dev

# 6. (Optional) Seed the database
npm run seed

# 7. Start development server
npm run dev
```

The API will be running at `http://localhost:5000`

---

## Environment Variables

Create a `.env` file in the root directory:

```env
# ─── Server ───────────────────────────────
NODE_ENV=development
PORT=5000

# ─── Database ─────────────────────────────
DATABASE_URL="postgresql://user:password@localhost:5432/elite_store"

# ─── JWT ──────────────────────────────────
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
EXPIRES_IN=1d
REFRESH_TOKEN_SECRET=your_refresh_token_secret
REFRESH_TOKEN_EXPIRES_IN=30d

# ─── Password Reset ───────────────────────
RESET_PASS_TOKEN=your_reset_pass_token_secret
RESET_PASS_TOKEN_EXPIRES_IN=10m
RESET_PASS_LINK=http://localhost:3000/reset-password

# ─── Email (Gmail SMTP) ───────────────────
EMAIL=your_gmail@gmail.com
APP_PASS=your_gmail_app_password

# ─── Cloudinary ───────────────────────────
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ─── Frontend ─────────────────────────────
FRONTEND_URL=http://localhost:3000

# ─── SSLCommerz ───────────────────────────
STORE_ID=your_store_id
STORE_PASS=your_store_pass
SUCCESS_URL=http://localhost:5000/api/payments/ssl/success
CANCEL_URL=http://localhost:5000/api/payments/ssl/cancel
FAIL_URL=http://localhost:5000/api/payments/ssl/fail
SSL_PAYMENT_API=https://sandbox.sslcommerz.com/gwprocess/v4/api.php
SSL_VALIDATIOIN_API=https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php
SSL_IPN_URL=http://localhost:5000/api/payments/ssl/ipn

# ─── bKash ────────────────────────────────
BKASH_APP_KEY=your_bkash_app_key
BKASH_APP_SECRET=your_bkash_app_secret
BKASH_USERNAME=your_bkash_username
BKASH_PASSWORD=your_bkash_password
BKASH_CALLBACK_URL=http://localhost:5000/api/payments/bkash/callback

# ─── Nagad ────────────────────────────────
NAGAD_MERCHANT_ID=your_nagad_merchant_id
NAGAD_MERCHANT_NUMBER=your_nagad_merchant_number
NAGAD_PUBLIC_KEY=your_nagad_public_key
NAGAD_PRIVATE_KEY=your_nagad_private_key
NAGAD_CALLBACK_URL=http://localhost:5000/api/payments/nagad/callback

# ─── Steadfast Courier ────────────────────
STEADFAST_BASE_URL=https://portal.packzy.com/api/v1
STEADFAST_API_KEY=your_steadfast_api_key
STEADFAST_SECRET_KEY=your_steadfast_secret_key

# ─── Web Push (VAPID) ─────────────────────
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@elitestore.com.bd

# ─── Wallet SSLCommerz callbacks ──────────
# (reuse SSL vars above, differentiate via route paths)
```

> **Generate VAPID keys once:**
>
> ```bash
> npx web-push generate-vapid-keys
> ```

---

## Database Schema

The database has **30+ models** across these domains:

```
Auth & Identity
  └── User, AccountInfo, Session, OAuthAccount, PushSubscription

Vendor
  └── VendorProfile

Catalog
  └── Category (unlimited nesting), Brand, Product, ProductVariant,
      ProductImage, ProductAttribute, ProductOption, ProductOptionValue,
      VariantOptionValue, RelatedProduct

Commerce
  └── Cart, CartItem, Wishlist, WishlistItem

Ordering
  └── Order, OrderItem, OrderStatusHistory

Payments
  └── Payment

Shipping
  └── Shipment

Returns
  └── ReturnRequest

Reviews
  └── Review, ReviewVote

Promotions
  └── Coupon, CouponUsage, ProductDiscount

Inventory
  └── InventoryLog

Finance
  └── Wallet, WalletTransaction

System
  └── Notification
```

> View the full schema: [`prisma/schema.prisma`](./prisma/schema.prisma)

---

## API Modules

| Module         | Base Route           | Description                                       |
| -------------- | -------------------- | ------------------------------------------------- |
| Auth           | `/api/auth`          | Register, login, OAuth, token refresh, passwords  |
| User           | `/api/users`         | Profile, addresses, role management               |
| Vendor Profile | `/api/vendors`       | Store creation, verification, management          |
| Category       | `/api/categories`    | Unlimited-depth category tree                     |
| Brand          | `/api/brands`        | Brand management                                  |
| Product        | `/api/products`      | CRUD, variants, images, attributes, stock         |
| Cart           | `/api/cart`          | Add, update, remove, validate                     |
| Wishlist       | `/api/wishlist`      | Toggle, move to cart                              |
| Coupon         | `/api/coupons`       | Apply, validate, CRUD                             |
| Order          | `/api/orders`        | Place, track, cancel, status management           |
| Payment        | `/api/payments`      | SSLCommerz, bKash, Nagad, COD, callbacks          |
| Shipment       | `/api/shipments`     | Manual + Steadfast bulk, sync, track              |
| Return Request | `/api/returns`       | Submit, process, approve/reject with full cascade |
| Review         | `/api/reviews`       | Create, vote, moderate                            |
| Inventory Log  | `/api/inventory`     | Stock history, low stock, out of stock            |
| Wallet         | `/api/wallet`        | Balance, topup (SSL/bKash), transfer              |
| Notification   | `/api/notifications` | Real-time, push, mark read, bulk send             |

---

## Authentication

The API uses **dual-token JWT authentication**:

```
POST /api/auth/register        → Register with email + password
POST /api/auth/login           → Returns accessToken + sets refreshToken cookie
POST /api/auth/refresh-token   → Silent refresh via httpOnly cookie
POST /api/auth/logout          → Deletes session record
POST /api/auth/forgot-password → Sends reset link via email
POST /api/auth/reset-pass      → Resets password with token
POST /api/auth/change-password → Changes password (authenticated)
```

**OAuth (Google + GitHub):**

```
POST /api/auth/oauth/google    → Login or auto-register via Google
POST /api/auth/oauth/github    → Login or auto-register via GitHub
```

**Token usage:**

```
Authorization: <accessToken>
```

**Roles:** `CUSTOMER` | `VENDOR` | `ADMIN` | `SUPER_ADMIN`

---

## Payment Gateways

### SSLCommerz

```
POST   /api/payments/initiate        → Initiate (CREDIT_CARD/DEBIT_CARD/NET_BANKING)
POST   /api/payments/ssl/success     → Success callback (redirects to frontend)
POST   /api/payments/ssl/fail        → Fail callback
POST   /api/payments/ssl/cancel      → Cancel callback
POST   /api/payments/ssl/ipn         → IPN (server-to-server)
```

### bKash (Tokenized Checkout)

```
POST   /api/payments/initiate        → Initiate with MOBILE_BANKING
GET    /api/payments/bkash/callback  → Execute after user approval
```

### Nagad

```
POST   /api/payments/initiate        → Initiate with MOBILE_BANKING
GET    /api/payments/nagad/callback  → Verify after user approval
```

### Cash on Delivery

```
POST   /api/payments/initiate        → method: CASH_ON_DELIVERY
                                       → Confirms order immediately
                                       → Payment marked SUCCESS on delivery
```

### Wallet Topup

```
POST   /api/wallet/add-money         → method: SSLCOMMERZ or BKASH
POST   /api/wallet/ssl/success       → SSL callback
GET    /api/wallet/bkash/callback    → bKash callback
```

---

## Real-time (Socket.io)

The server exposes a Socket.io instance authenticated via JWT.

**Server → Client events:**

```
notification:new          → New notification object
notification:unreadCount  → { count: number }
notification:allRead      → {} (all marked read)
```

**Client → Server events:**

```
notification:markRead       → notificationId
notification:markAllRead    → (no payload)
notification:getUnreadCount → (no payload)
```

**Connection:**

```js
const socket = io("http://localhost:5000", {
  auth: { token: "your_access_token" },
});
```

---

## File Uploads

All file uploads use **Multer + Cloudinary**. Files are sent as `multipart/form-data` with a `data` field containing JSON stringified payload.

**Single image:**

```
multerUpload.single("image")
req.file.path → Cloudinary URL
```

**Multiple named fields (e.g. logo + banner):**

```
multerUpload.fields([{ name: "logo" }, { name: "banner" }])
req.files["logo"][0].path → Cloudinary URL
```

**Array of images (e.g. product images):**

```
multerUpload.array("images", 10)
req.files[].path → Cloudinary URL
```

**No file (formdata text only):**

```
multerUpload.none()
```

---

## API Reference

### Standard Response Format

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

### Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "error": {}
}
```

### Pagination

All list endpoints support:

```
?page=1&limit=20
```

Response includes:

```json
{
  "total": 100,
  "page": 1,
  "limit": 20,
  "data": []
}
```

### Public vs Protected

- **Public routes** — no Authorization header needed
- **Protected routes** — require `Authorization: <token>` header
- **Role-specific routes** — checked at middleware level

---

## Scripts

```bash
# Development (hot reload)
npm run dev

# Build
npm run build

# Production
npm start

# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Open Prisma Studio (DB GUI)
npx prisma studio

# Format schema
npx prisma format

# Type check
npm run type-check

# Lint
npm run lint
```

---

## Key Design Decisions

| Decision                                         | Reason                                                  |
| ------------------------------------------------ | ------------------------------------------------------- |
| `autoincrement` internal IDs + `publicId` (cuid) | Fast joins internally, non-guessable IDs in public APIs |
| `@@map` snake_case table names                   | PostgreSQL convention — `users` not `User`              |
| `Json` snapshot on `OrderItem`                   | Preserves product state at purchase time                |
| `$transaction` everywhere                        | Atomic operations — no partial state                    |
| Zod body-wrapped schemas                         | Consistent validation across all endpoints              |
| `multerUpload.none()` on formdata without files  | Parses multipart body without expecting files           |
| Session stored as JWT                            | Logout can match exact token — no crypto mismatch       |
| Steadfast status mapped to OrderStatus           | Single status source of truth for all couriers          |

---

## License

MIT — Elite Store Team
