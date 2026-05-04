-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "statusUpdatedById" INTEGER;

-- AlterTable
ALTER TABLE "flash_sales" ADD COLUMN     "statusUpdatedById" INTEGER;

-- AlterTable
ALTER TABLE "order_status_histories" ADD COLUMN     "statusUpdatedById" INTEGER;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "statusUpdatedById" INTEGER;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "statusUpdatedById" INTEGER;

-- AlterTable
ALTER TABLE "return_requests" ADD COLUMN     "statusUpdatedById" INTEGER;

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "statusUpdatedById" INTEGER;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_statusUpdatedById_fkey" FOREIGN KEY ("statusUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flash_sales" ADD CONSTRAINT "flash_sales_statusUpdatedById_fkey" FOREIGN KEY ("statusUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_statusUpdatedById_fkey" FOREIGN KEY ("statusUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_histories" ADD CONSTRAINT "order_status_histories_statusUpdatedById_fkey" FOREIGN KEY ("statusUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_statusUpdatedById_fkey" FOREIGN KEY ("statusUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_statusUpdatedById_fkey" FOREIGN KEY ("statusUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_statusUpdatedById_fkey" FOREIGN KEY ("statusUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
