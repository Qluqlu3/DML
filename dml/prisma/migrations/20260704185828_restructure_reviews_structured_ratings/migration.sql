-- CreateEnum
CREATE TYPE "StructureType" AS ENUM ('WOODEN', 'LIGHT_STEEL', 'STEEL', 'RC', 'OTHER');

-- AlterTable: add new columns as nullable first so existing rows can be backfilled
ALTER TABLE "reviews"
  ADD COLUMN "price_rating" INTEGER,
  ADD COLUMN "service_rating" INTEGER,
  ADD COLUMN "quality_rating" INTEGER,
  ADD COLUMN "structure_type" "StructureType";

-- Backfill: carry the old overall rating into each new per-item rating
UPDATE "reviews"
SET "price_rating" = "rating",
    "service_rating" = "rating",
    "quality_rating" = "rating";

-- Backfill: map the old free-text work_type into the new structure_type enum
UPDATE "reviews"
SET "structure_type" = CASE "work_type"
  WHEN '木造住宅' THEN 'WOODEN'
  WHEN 'RC造（鉄筋コンクリート）' THEN 'RC'
  WHEN 'RC造' THEN 'RC'
  WHEN '鉄骨造' THEN 'STEEL'
  ELSE 'OTHER'
END::"StructureType";

-- Enforce NOT NULL now that every row has been backfilled
ALTER TABLE "reviews"
  ALTER COLUMN "price_rating" SET NOT NULL,
  ALTER COLUMN "service_rating" SET NOT NULL,
  ALTER COLUMN "quality_rating" SET NOT NULL,
  ALTER COLUMN "structure_type" SET NOT NULL;

-- Drop the old free-text / single-rating columns
ALTER TABLE "reviews"
  DROP COLUMN "rating",
  DROP COLUMN "title",
  DROP COLUMN "body",
  DROP COLUMN "work_type";
