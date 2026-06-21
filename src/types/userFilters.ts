// types/user-filter.ts

// ==========================================
// Enums
// ==========================================

export enum Role {
  CUSTOMER = "CUSTOMER",
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",
  VENDOR = "VENDOR",
}

export enum Gender {
  MALE = "MALE",
  FEMALE = "FEMALE",
  OTHER = "OTHER",
  PREFER_NOT_TO_SAY = "PREFER_NOT_TO_SAY",
}

export enum AddressType {
  HOME = "HOME",
  OFFICE = "OFFICE",
  BILLING = "BILLING",
  SHIPPING = "SHIPPING",
  OTHER = "OTHER",
}

export enum OrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  RETURN_REQUESTED = "RETURN_REQUESTED",
  RETURNED = "RETURNED",
  REFUNDED = "REFUNDED",
}

export enum FlashSaleStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  ENDED = "ENDED",
  CANCELLED = "CANCELLED",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  INITIATED = "INITIATED",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
}

export enum WithdrawRequestStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  PAID = "PAID",
  CANCELLED = "CANCELLED",
}

export enum WalletTransactionPaymentStatus {
  PENDING = "PENDING",
  INITIATED = "INITIATED",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export enum PaymentMethod {
  CREDIT_CARD = "CREDIT_CARD",
  DEBIT_CARD = "DEBIT_CARD",
  NET_BANKING = "NET_BANKING",
  MOBILE_BANKING = "MOBILE_BANKING",
  CASH_ON_DELIVERY = "CASH_ON_DELIVERY",
}

export enum DiscountType {
  PERCENTAGE = "PERCENTAGE",
  FLAT = "FLAT",
}

export enum ReviewStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  FLAGGED = "FLAGGED",
}

export enum ProductStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  OUT_OF_STOCK = "OUT_OF_STOCK",
  DISCONTINUED = "DISCONTINUED",
  ARCHIVED = "ARCHIVED",
}

export enum ReturnReason {
  DAMAGED = "DAMAGED",
  WRONG_ITEM = "WRONG_ITEM",
  NOT_AS_DESCRIBED = "NOT_AS_DESCRIBED",
  CHANGED_MIND = "CHANGED_MIND",
  OTHER = "OTHER",
}

export enum NotificationType {
  ORDER_UPDATE = "ORDER_UPDATE",
  PAYMENT = "PAYMENT",
  PROMOTION = "PROMOTION",
  REVIEW = "REVIEW",
  SYSTEM = "SYSTEM",
  RESTOCK = "RESTOCK",
}

export enum ReturnRequestStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  COMPLETED = "COMPLETED",
}

export enum ReturnRequestRefundMethod {
  WALLET = "WALLET",
  BANK_TRANSFER = "BANK_TRANSFER",
  BKASH = "BKASH",
  NAGAD = "NAGAD",
  ROCKET = "ROCKET",
  YET_TO_BE_PAID = "YET_TO_BE_PAID",
}

// ==========================================
// Utility Interfaces
// ==========================================

export interface DateRange {
  from?: Date | string;
  to?: Date | string;
}

export interface NumberRange {
  min?: number;
  max?: number;
}

// ==========================================
// Main User Filter Interface
// ==========================================

// types/user-filter.ts
export interface UserFilter {
  // Pagination & sorting
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";

  // Basic fields
  search?: string;
  email?: string;
  phone?: string;
  role?: Role | Role[];
  isBanned?: boolean;
  isEmailVerified?: boolean;
  isActive?: boolean;
  createdAtFrom?: string;
  createdAtTo?: string;
  lastLoginFrom?: string;
  lastLoginTo?: string;

  // AccountInfo
  firstName?: string;
  lastName?: string;
  displayName?: string;
  gender?: Gender;
  ageMin?: number;
  ageMax?: number;
  dobFrom?: string;
  dobTo?: string;

  // Address
  addressCityDistrict?: string;
  addressCountry?: string;
  addressPostalCode?: string;
  addressType?: AddressType;
  addressIsDefault?: boolean;

  // Order aggregates (using having)
  orderCountMin?: number;
  orderCountMax?: number;
  orderTotalSpentMin?: number;
  orderTotalSpentMax?: number;

  // Order status filters (existence)
  hasDeliveredOrders?: boolean;
  hasCancelledOrders?: boolean;
  hasReturnedOrders?: boolean;
  orderStatus?: OrderStatus | OrderStatus[];

  // Return request filters
  returnRequestStatus?: ReturnRequestStatus | ReturnRequestStatus[];
  returnRequestCountMin?: number;
  returnRequestCountMax?: number;

  // Product interactions (product IDs)
  productInCart?: number[];
  productInWishlist?: number[];
  orderedProduct?: number[];
  reviewedProduct?: number[];

  // Vendor profile
  isVendor?: boolean;
  vendorVerified?: boolean;
  vendorStoreName?: string;
  vendorRatingMin?: number;
  vendorRatingMax?: number;
  vendorTotalSalesMin?: number;
  vendorTotalSalesMax?: number;

  // Coupon usage
  usedCouponCode?: string;
  usedCouponId?: number;

  // Review aggregates
  hasWrittenReviews?: boolean;
  reviewRatingMin?: number;
  reviewRatingMax?: number;
  reviewCountMin?: number;
  reviewCountMax?: number;

  // Wallet
  walletBalanceMin?: number;
  walletBalanceMax?: number;

  // Session
  hasActiveSession?: boolean;
}
