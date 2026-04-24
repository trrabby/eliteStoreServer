/*
  Warnings:

  - You are about to drop the column `referenceId` on the `wallet_transactions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "wallet_transactions" DROP COLUMN "referenceId",
ADD COLUMN     "reference" TEXT;
