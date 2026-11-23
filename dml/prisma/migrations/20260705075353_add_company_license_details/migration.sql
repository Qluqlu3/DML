-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "capital_thousand_yen" INTEGER,
ADD COLUMN     "license_valid_from" TIMESTAMP(3),
ADD COLUMN     "license_valid_until" TIMESTAMP(3),
ADD COLUMN     "licensed_trades" JSONB,
ADD COLUMN     "office_address" TEXT,
ADD COLUMN     "permit_number" TEXT,
ADD COLUMN     "representative_name" TEXT;
