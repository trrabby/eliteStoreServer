-- CreateEnum
CREATE TYPE "WithdrawRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "vendor_profiles" ADD COLUMN     "lastPaymentReceived" TIMESTAMP(3),
ADD COLUMN     "vendorDue" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "vendor_withdraw_requests" (
    "id" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "description" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "WithdrawRequestStatus" NOT NULL DEFAULT 'PENDING',
    "paidThrough" TEXT,
    "paidById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_withdraw_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_withdraw_requests_publicId_key" ON "vendor_withdraw_requests"("publicId");

-- CreateIndex
CREATE INDEX "vendor_withdraw_requests_vendorId_idx" ON "vendor_withdraw_requests"("vendorId");

-- CreateIndex
CREATE INDEX "vendor_withdraw_requests_userId_idx" ON "vendor_withdraw_requests"("userId");

-- CreateIndex
CREATE INDEX "vendor_withdraw_requests_status_idx" ON "vendor_withdraw_requests"("status");

-- CreateIndex
CREATE INDEX "vendor_withdraw_requests_createdAt_idx" ON "vendor_withdraw_requests"("createdAt");

-- AddForeignKey
ALTER TABLE "vendor_withdraw_requests" ADD CONSTRAINT "vendor_withdraw_requests_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_withdraw_requests" ADD CONSTRAINT "vendor_withdraw_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_withdraw_requests" ADD CONSTRAINT "vendor_withdraw_requests_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
