-- AddColumn
ALTER TABLE "accounts"
ADD COLUMN "public_id" TEXT;

-- Backfill existing rows with 12-char public IDs
UPDATE "accounts"
SET "public_id" = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
WHERE "public_id" IS NULL;

-- Enforce not null
ALTER TABLE "accounts"
ALTER COLUMN "public_id" SET NOT NULL;

-- Set default for future rows
ALTER TABLE "accounts"
ALTER COLUMN "public_id" SET DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

-- Create unique index
CREATE UNIQUE INDEX "accounts_public_id_key" ON "accounts"("public_id");
