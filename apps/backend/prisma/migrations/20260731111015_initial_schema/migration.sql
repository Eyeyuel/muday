-- CreateEnum
CREATE TYPE "Language" AS ENUM ('am', 'en');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('pending_consent', 'active', 'deleted');

-- CreateEnum
CREATE TYPE "ConsentAction" AS ENUM ('accepted', 'withdrawn');

-- CreateEnum
CREATE TYPE "UpdateStatus" AS ENUM ('received', 'queued', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('voice', 'text');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('salary', 'business', 'remittance', 'other_income', 'food', 'transport', 'rent', 'utilities', 'airtime_data', 'health', 'education', 'family_support', 'entertainment', 'clothing', 'church_charity', 'other');

-- CreateEnum
CREATE TYPE "InteractionKind" AS ENUM ('consent', 'clarify_type', 'clarify_amount', 'confirm_large_amount', 'confirm_undo', 'confirm_delete_step_1', 'confirm_delete_step_2');

-- CreateEnum
CREATE TYPE "InteractionState" AS ENUM ('pending', 'resolved', 'cancelled', 'expired');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "telegram_id" BIGINT,
    "language" "Language" NOT NULL DEFAULT 'am',
    "status" "UserStatus" NOT NULL DEFAULT 'pending_consent',
    "consent_version" VARCHAR(20),
    "consent_at" TIMESTAMPTZ(3),
    "morning_enabled" BOOLEAN NOT NULL DEFAULT true,
    "morning_time" TIME(0) NOT NULL DEFAULT '08:00:00'::time without time zone,
    "night_enabled" BOOLEAN NOT NULL DEFAULT true,
    "night_time" TIME(0) NOT NULL DEFAULT '21:00:00'::time without time zone,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "action" "ConsentAction" NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_updates" (
    "telegram_update_id" BIGINT NOT NULL,
    "user_id" UUID,
    "telegram_chat_id" BIGINT,
    "telegram_message_id" BIGINT,
    "update_type" VARCHAR(30) NOT NULL,
    "status" "UpdateStatus" NOT NULL DEFAULT 'received',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "last_error_code" VARCHAR(80),

    CONSTRAINT "processed_updates_pkey" PRIMARY KEY ("telegram_update_id")
);

-- CreateTable
CREATE TABLE "transaction_groups" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "telegram_update_id" BIGINT NOT NULL,
    "telegram_message_id" BIGINT NOT NULL,
    "source" "TransactionSource" NOT NULL,
    "message_at" TIMESTAMPTZ(3) NOT NULL,
    "raw_transcript" TEXT,
    "transcript_expires_at" TIMESTAMPTZ(3),
    "stt_provider" VARCHAR(50),
    "stt_model" VARCHAR(100),
    "extraction_model" VARCHAR(100) NOT NULL,
    "prompt_version" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undone_at" TIMESTAMPTZ(3),

    CONSTRAINT "transaction_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount_etb" DECIMAL(12,2) NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "note" VARCHAR(500),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_interactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "InteractionKind" NOT NULL,
    "state" "InteractionState" NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "source_update_id" BIGINT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "pending_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "event_type" VARCHAR(50) NOT NULL,
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_audits" (
    "id" UUID NOT NULL,
    "deletion_policy_version" VARCHAR(20) NOT NULL,
    "consent_version_withdrawn" VARCHAR(20),
    "completed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" VARCHAR(30) NOT NULL,

    CONSTRAINT "deletion_audits_pkey" PRIMARY KEY ("id")
);

-- Domain invariants that Prisma schema cannot express.
ALTER TABLE "users"
ADD CONSTRAINT "users_status_fields_check"
CHECK (
    (
        "status" = 'pending_consent'
        AND "telegram_id" IS NOT NULL
        AND "consent_version" IS NULL
        AND "consent_at" IS NULL
        AND "deleted_at" IS NULL
    )
    OR (
        "status" = 'active'
        AND "telegram_id" IS NOT NULL
        AND "consent_version" IS NOT NULL
        AND "consent_at" IS NOT NULL
        AND "deleted_at" IS NULL
    )
    OR (
        "status" = 'deleted'
        AND "deleted_at" IS NOT NULL
    )
);

ALTER TABLE "processed_updates"
ADD CONSTRAINT "processed_updates_attempt_count_check"
CHECK ("attempt_count" >= 0);

ALTER TABLE "processed_updates"
ADD CONSTRAINT "processed_updates_completed_at_check"
CHECK ("status" <> 'completed' OR "completed_at" IS NOT NULL);

ALTER TABLE "transaction_groups"
ADD CONSTRAINT "transaction_groups_transcript_retention_check"
CHECK ("raw_transcript" IS NULL OR "transcript_expires_at" IS NOT NULL);

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_amount_range_check"
CHECK ("amount_etb" > 0 AND "amount_etb" < 1000000);

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_type_category_check"
CHECK (
    (
        "type" = 'income'
        AND "category" IN ('salary', 'business', 'remittance', 'other_income')
    )
    OR (
        "type" = 'expense'
        AND "category" IN (
            'food',
            'transport',
            'rent',
            'utilities',
            'airtime_data',
            'health',
            'education',
            'family_support',
            'entertainment',
            'clothing',
            'church_charity',
            'other'
        )
    )
);

ALTER TABLE "pending_interactions"
ADD CONSTRAINT "pending_interactions_resolution_check"
CHECK (
    ("state" = 'pending' AND "resolved_at" IS NULL)
    OR ("state" <> 'pending' AND "resolved_at" IS NOT NULL)
);

ALTER TABLE "pending_interactions"
ADD CONSTRAINT "pending_interactions_payload_object_check"
CHECK (jsonb_typeof("payload") = 'object');

ALTER TABLE "events"
ADD CONSTRAINT "events_metadata_object_check"
CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object');

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX "consent_records_user_id_recorded_at_idx" ON "consent_records"("user_id", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "processed_updates_status_received_at_idx" ON "processed_updates"("status", "received_at");

-- CreateIndex
CREATE INDEX "processed_updates_user_id_received_at_idx" ON "processed_updates"("user_id", "received_at" DESC);

-- CreateIndex
CREATE INDEX "transaction_groups_user_id_message_at_idx" ON "transaction_groups"("user_id", "message_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "transaction_groups_user_id_telegram_message_id_key" ON "transaction_groups"("user_id", "telegram_message_id");

-- CreateIndex
CREATE INDEX "transactions_group_id_idx" ON "transactions"("group_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_occurred_at_idx" ON "transactions"("user_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "transactions_user_id_type_occurred_at_idx" ON "transactions"("user_id", "type", "occurred_at");

-- CreateIndex
CREATE INDEX "pending_interactions_user_id_state_expires_at_idx" ON "pending_interactions"("user_id", "state", "expires_at");

-- CreateIndex
CREATE INDEX "pending_interactions_expires_at_state_idx" ON "pending_interactions"("expires_at", "state");

-- CreateIndex
CREATE INDEX "events_event_type_occurred_at_idx" ON "events"("event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "events_user_id_occurred_at_idx" ON "events"("user_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_updates" ADD CONSTRAINT "processed_updates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_groups" ADD CONSTRAINT "transaction_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "transaction_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_interactions" ADD CONSTRAINT "pending_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
