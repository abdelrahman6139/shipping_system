-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('NOT_COLLECTED', 'DRIVER_COLLECTED', 'COMPANY_RECEIVED', 'SETTLED_TO_MERCHANT');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'RETURNED';

-- Migrate existing isCashCollected to collectionStatus before dropping
ALTER TABLE "orders"
  ADD COLUMN "collectionStatus" "CollectionStatus" NOT NULL DEFAULT 'NOT_COLLECTED';

-- Set DRIVER_COLLECTED for orders where isCashCollected was true
UPDATE "orders"
  SET "collectionStatus" = 'DRIVER_COLLECTED'
  WHERE "isCashCollected" = true;

-- Now safe to drop isCashCollected
ALTER TABLE "orders"
  DROP COLUMN "isCashCollected";

-- Add cancellation and return fields
ALTER TABLE "orders"
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "returnReason" TEXT,
  ADD COLUMN "returnFrom" TEXT;

-- CreateIndex
CREATE INDEX "orders_collectionStatus_idx" ON "orders"("collectionStatus");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "tickets_updatedAt_idx" ON "tickets"("updatedAt");
