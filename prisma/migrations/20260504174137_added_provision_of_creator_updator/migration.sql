/*
  Warnings:

  - You are about to drop the column `statusUpdatedById` on the `WalletTransaction` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[vendorProfileId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "WalletTransaction" DROP CONSTRAINT "WalletTransaction_statusUpdatedById_fkey";

-- DropForeignKey
ALTER TABLE "vendor_profiles" DROP CONSTRAINT "vendor_profiles_userId_fkey";

-- AlterTable
ALTER TABLE "WalletTransaction" DROP COLUMN "statusUpdatedById";

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "createdById" INTEGER;

-- AlterTable
ALTER TABLE "flash_sale_items" ADD COLUMN     "addedById" INTEGER;

-- AlterTable
ALTER TABLE "flash_sales" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "product_attributes" ADD COLUMN     "addedById" INTEGER,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "product_discounts" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" INTEGER;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "createdById" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "roleUpdatedById" INTEGER,
ADD COLUMN     "vendorProfileId" INTEGER;

-- AlterTable
ALTER TABLE "vendor_profiles" ADD COLUMN     "verifiedById" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "users_vendorProfileId_key" ON "users"("vendorProfileId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleUpdatedById_fkey" FOREIGN KEY ("roleUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flash_sale_items" ADD CONSTRAINT "flash_sale_items_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_discounts" ADD CONSTRAINT "product_discounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
