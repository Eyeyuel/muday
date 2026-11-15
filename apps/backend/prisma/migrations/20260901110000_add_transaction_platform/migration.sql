-- AlterTable
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "platform" VARCHAR(50);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "transactions_user_id_platform_idx" ON "transactions"("user_id", "platform");
