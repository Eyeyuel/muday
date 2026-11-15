-- Add pairing code fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "app_code_hash" VARCHAR(72);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "app_code_prefix" VARCHAR(4);

-- Create index on app_code_prefix
CREATE INDEX IF NOT EXISTS "users_app_code_prefix_idx" ON "users"("app_code_prefix") WHERE "app_code_prefix" IS NOT NULL;

-- Make identity_id nullable on customer_sessions
ALTER TABLE "customer_sessions" ALTER COLUMN "identity_id" DROP NOT NULL;
