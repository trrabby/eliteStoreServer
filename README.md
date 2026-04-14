# 🛍️ Elite Store Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-blue.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue.svg)](https://www.postgresql.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)

**Elite Store Server** is a robust, production-ready backend API for a modern e-commerce platform. Built with scalability, security, and performance in mind, it provides a complete solution for managing users, products, orders, payments, inventory, and more.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Database Schema](#-database-schema)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
- [API Overview](#-api-overview)
- [Project Structure](#-project-structure)
- [Key Modules](#-key-modules)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 👤 User Management
- Multi-role system (Customer, Vendor, Admin, Super Admin)
- Email/Phone verification
- OAuth support (Google, Facebook, etc.)
- Session management with device tracking
- Account status (Active/Banned)

### 📦 Product System
- Multi-vendor support
- Product variants (SKU, price, stock)
- Categories & subcategories (unlimited depth)
- Brands management
- Product attributes & options
- Featured products & tags
- Inventory tracking with logs

### 🛒 Shopping & Orders
- Shopping cart with persistent storage
- Wishlist functionality
- Multiple address types (Home, Office, Billing, Shipping)
- Order management with status history
- Shipment tracking
- Return & refund requests

### 💳 Payments & Wallet
- Multiple payment methods (Credit Card, Mobile Banking, COD, etc.)
- Payment status tracking (Success, Failed, Refunded, etc.)
- Digital wallet system
- Transaction history

### 🎟️ Discounts & Coupons
- Percentage & flat discounts
- Coupon codes with usage limits
- Product-specific discounts
- Time-based promotions

### ⭐ Reviews & Ratings
- Product reviews with images
- Helpful votes system
- Verified purchase tagging
- Review moderation (Pending, Approved, Rejected, Flagged)

### 🔔 Notifications
- Real-time order updates
- Payment notifications
- Promotional alerts
- Restock notifications

### 🔍 Search & Analytics
- Search history tracking
- Product view counts
- Sales analytics ready
- Rating & review aggregation

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js (20.x) |
| **Framework** | Express.js / NestJS *(choose based on your implementation)* |
| **ORM** | Prisma ORM |
| **Database** | PostgreSQL |
| **Authentication** | JWT / Sessions |
| **Caching** | Redis (optional) |
| **File Storage** | AWS S3 / Cloudinary |
| **Email** | Nodemailer / SendGrid |
| **SMS** | Twilio |

---

## 🗄️ Database Schema

The database schema is meticulously designed with 30+ models covering all aspects of an e-commerce platform:

### Core Models
- `User`, `AccountInfo`, `Session`, `OAuthAccount`
- `Address`, `VendorProfile`

### Product Models
- `Product`, `ProductVariant`, `ProductImage`
- `Category`, `Brand`, `ProductAttribute`
- `ProductOption`, `ProductOptionValue`

### Order Models
- `Order`, `OrderItem`, `OrderStatusHistory`
- `Payment`, `Shipment`, `ReturnRequest`

### Commerce Models
- `Cart`, `CartItem`, `Wishlist`, `WishlistItem`
- `Coupon`, `CouponUsage`, `ProductDiscount`

### Review & Feedback
- `Review`, `ReviewVote`

### Utility Models
- `Wallet`, `WalletTransaction`
- `Notification`, `SearchHistory`
- `InventoryLog`

### Relationships
- Many-to-many relationships with proper junction tables
- Cascade deletes for data integrity
- Optimized indexes for query performance
- Public IDs (CUID) for API exposure vs internal integer IDs

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v20 or higher)
- PostgreSQL (v14 or higher)
- npm / yarn / pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/elite-store-server.git
cd elite-store-server

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Seed the database (optional)
npx prisma db seed