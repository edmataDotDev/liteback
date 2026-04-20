-- CreateTable
CREATE TABLE "accounts" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "balance_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "accounts"
ADD CONSTRAINT "accounts_balance_minor_non_negative_check"
CHECK ("balance_minor" >= 0);

-- CreateIndex
CREATE INDEX "accounts_customer_id_idx" ON "accounts"("customer_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
