-- CreateFunction
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
    WHERE "id" = NEW."account_id";
  ELSE
    RAISE EXCEPTION 'Unsupported transaction type: %', NEW.type;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account % not found', NEW."account_id";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CreateTrigger
CREATE TRIGGER trg_apply_transaction_to_account_balance
AFTER INSERT ON "transactions"
FOR EACH ROW
EXECUTE FUNCTION apply_transaction_to_account_balance();
