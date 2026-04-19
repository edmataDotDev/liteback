-- CreateIndex
CREATE UNIQUE INDEX "customers_user_id_key" ON "customers"("user_id");

-- DropIndex
DROP INDEX IF EXISTS "customers_user_id_idx";
