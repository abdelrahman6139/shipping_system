ALTER TABLE "orders"
ADD COLUMN "itemPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "addonsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "addons" JSONB NOT NULL DEFAULT '[]';

UPDATE "orders"
SET
  "deliveryFee" = COALESCE("totalPrice", 0),
  "grandTotal" = COALESCE("totalPrice", 0),
  "addonsTotal" = 0,
  "addons" = '[]'
WHERE "grandTotal" = 0;
