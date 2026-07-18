-- CreateEnum
CREATE TYPE "AuthAttemptType" AS ENUM ('LOGIN', 'REGISTER');

-- CreateTable
CREATE TABLE "auth_attempts" (
    "id" SERIAL NOT NULL,
    "type" "AuthAttemptType" NOT NULL,
    "ip" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_attempts_type_ip_created_at_idx" ON "auth_attempts"("type", "ip", "created_at");

-- CreateIndex
CREATE INDEX "auth_attempts_type_email_created_at_idx" ON "auth_attempts"("type", "email", "created_at");
