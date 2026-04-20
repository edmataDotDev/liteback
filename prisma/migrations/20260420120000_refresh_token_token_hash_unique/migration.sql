-- Ensure unique token hashes if this migration is present in history.
-- NOTE: Current schema may later remove this uniqueness by design.
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_token_hash_key"
ON "refresh_tokens"("token_hash");
