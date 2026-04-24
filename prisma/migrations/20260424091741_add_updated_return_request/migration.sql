-- CreateEnum
CREATE TYPE "ReturnRequestRefundMethod" AS ENUM ('WALLET', 'BANK_TRANSFER', 'BKASH', 'NAGAD', 'ROCKET');

-- AlterTable
ALTER TABLE "return_requests" ADD COLUMN     "paidThrough" "ReturnRequestRefundMethod" NOT NULL DEFAULT 'WALLET';
