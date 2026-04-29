-- Users lookup and role/status filters
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE INDEX "users_isActive_idx" ON "users"("isActive");
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- Orders list filters, dashboard filters, and date-range reports
CREATE INDEX "orders_deliveryType_idx" ON "orders"("deliveryType");
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");
CREATE INDEX "orders_clientId_createdAt_idx" ON "orders"("clientId", "createdAt");
CREATE INDEX "orders_driverId_createdAt_idx" ON "orders"("driverId", "createdAt");

-- Ticket list filters and client support views
CREATE INDEX "tickets_orderId_idx" ON "tickets"("orderId");
CREATE INDEX "tickets_clientId_status_idx" ON "tickets"("clientId", "status");
CREATE INDEX "tickets_status_updatedAt_idx" ON "tickets"("status", "updatedAt");

-- Driver finance reports
CREATE INDEX "driver_earnings_driverId_date_idx" ON "driver_earnings"("driverId", "date");

-- Pricing lookup by zone; unique index already exists, this keeps the schema requirement explicit.
CREATE INDEX "pricing_rules_zoneId_idx" ON "pricing_rules"("zoneId");
