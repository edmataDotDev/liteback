-- Ensure pgcrypto extension exists for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add column if missing
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "public_id" UUID;

-- Backfill null values
UPDATE "users"
SET "public_id" = gen_random_uuid()
WHERE "public_id" IS NULL;

-- Enforce not null and default
ALTER TABLE "users"
ALTER COLUMN "public_id" SET NOT NULL,
ALTER COLUMN "public_id" SET DEFAULT gen_random_uuid();

-- Ensure uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS "users_public_id_key" ON "users"("public_id");
