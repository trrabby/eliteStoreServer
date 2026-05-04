/*
  Warnings:

  - You are about to drop the column `userId` on the `flash_sales` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "flash_sales" DROP CONSTRAINT "flash_sales_userId_fkey";

-- AlterTable
ALTER TABLE "flash_sales" DROP COLUMN "userId";
