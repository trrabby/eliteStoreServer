/*
  Warnings:

  - Made the column `refundedAmount` on table `payments` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "refundedAmount" SET NOT NULL,
ALTER COLUMN "refundedAmount" SET DEFAULT 0;
