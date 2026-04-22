/*
  Warnings:

  - The values [RECEIVED,REFUNDED] on the enum `ReturnRequestStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ReturnRequestStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');
ALTER TABLE "return_requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "return_requests" ALTER COLUMN "status" TYPE "ReturnRequestStatus_new" USING ("status"::text::"ReturnRequestStatus_new");
ALTER TYPE "ReturnRequestStatus" RENAME TO "ReturnRequestStatus_old";
ALTER TYPE "ReturnRequestStatus_new" RENAME TO "ReturnRequestStatus";
DROP TYPE "ReturnRequestStatus_old";
ALTER TABLE "return_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
