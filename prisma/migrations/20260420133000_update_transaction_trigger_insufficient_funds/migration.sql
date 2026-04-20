-- ReplaceFunction
CREATE OR REPLACE FUNCTION apply_transaction_to_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'DEPOSIT' THEN
    UPDATE "accounts"
    SET "balance_minor" = "balance_minor" + NEW."amount_minor"
    WHERE "id" = NEW."account_id";
  ELSIF NEW.type = 'WITHDRAWAL' THEN
    UPDATE "accounts"
    SET "balance_minor" = "balance_minor" - NEW."amount_minor"
    WHERE "id" = NEW."account_id"
      AND "balance_minor" >= NEW."amount_minor";
  ELSE
    RAISE EXCEPTION 'Unsupported transaction type: %', NEW.type;
  END IF;

  IF NOT FOUND THEN
    IF NEW.type = 'WITHDRAWAL' THEN
      IF EXISTS (SELECT 1 FROM "accounts" WHERE "id" = NEW."account_id") THEN
        RAISE EXCEPTION 'Insufficient funds for account %', NEW."account_id";
      END IF;
    END IF;
    RAISE EXCEPTION 'Account % not found', NEW."account_id";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
