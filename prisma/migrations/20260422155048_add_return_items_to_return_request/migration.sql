-- AlterTable
ALTER TABLE "return_requests" ADD COLUMN     "returnItems" JSONB NOT NULL DEFAULT '[]';
