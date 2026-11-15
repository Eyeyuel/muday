/*
  Warnings:

  - Changed the type of `category` on the `transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'paused';

-- DropForeignKey
ALTER TABLE "customer_sessions" DROP CONSTRAINT "customer_sessions_identity_id_fkey";

-- DropIndex
DROP INDEX "transactions_user_id_kind_occurred_at_idx";

-- AlterTable
ALTER TABLE "customer_refresh_tokens" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customer_sessions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "identity_link_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "new_category" VARCHAR(100);
UPDATE "transactions" SET "new_category" = "category"::text;
ALTER TABLE "transactions" DROP COLUMN "category";
ALTER TABLE "transactions" RENAME COLUMN "new_category" TO "category";
ALTER TABLE "transactions" ALTER COLUMN "category" SET NOT NULL;

-- AlterTable
ALTER TABLE "user_identities" ALTER COLUMN "id" DROP DEFAULT;

-- DropEnum
DROP TYPE "TransactionCategory";

-- CreateTable
CREATE TABLE "user_categories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_categories_user_id_type_idx" ON "user_categories"("user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "user_categories_user_id_label_key" ON "user_categories"("user_id", "label");

-- AddForeignKey
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "user_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_categories" ADD CONSTRAINT "user_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
