-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "rejected_at" TIMESTAMP(3),
ADD COLUMN     "rejection_reason" TEXT;
