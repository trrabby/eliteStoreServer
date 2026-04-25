/*
  Warnings:

  - The `status` column on the `WalletTransaction` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "WalletTransactionPaymentStatus" AS ENUM ('PENDING', 'INITIATED', 'SUCCESS', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "WalletTransaction" DROP COLUMN "status",
ADD COLUMN     "status" "WalletTransactionPaymentStatus" NOT NULL DEFAULT 'PENDING';
