-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "vendorId" INTEGER;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
