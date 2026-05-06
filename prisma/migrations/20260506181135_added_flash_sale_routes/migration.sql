/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `flash_sales` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `flash_sales` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "flash_sales" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "flash_sales_slug_key" ON "flash_sales"("slug");

-- CreateIndex
CREATE INDEX "flash_sales_slug_idx" ON "flash_sales"("slug");
