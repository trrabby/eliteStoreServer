/*
  Warnings:

  - The `status` column on the `return_requests` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ReturnRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED');

-- AlterTable
ALTER TABLE "return_requests" DROP COLUMN "status",
ADD COLUMN     "status" "ReturnRequestStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "return_requests_status_idx" ON "return_requests"("status");
