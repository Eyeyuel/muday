-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM (
  'morning_reminder',
  'night_status',
  'weekly_summary',
  'monthly_summary'
);

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
  'queued',
  'processing',
  'sent',
  'skipped',
  'failed'
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "kind" "NotificationKind" NOT NULL,
  "period_key" VARCHAR(80) NOT NULL,
  "deterministic_key" VARCHAR(180) NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'queued',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "scheduled_for" TIMESTAMPTZ(3) NOT NULL,
  "sent_at" TIMESTAMPTZ(3),
  "last_error_code" VARCHAR(80),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "notification_deliveries"
ADD CONSTRAINT "notification_deliveries_attempt_count_check"
CHECK ("attempt_count" >= 0);

ALTER TABLE "notification_deliveries"
ADD CONSTRAINT "notification_deliveries_sent_at_check"
CHECK ("status" <> 'sent' OR "sent_at" IS NOT NULL);

CREATE UNIQUE INDEX "notification_deliveries_deterministic_key_key"
ON "notification_deliveries"("deterministic_key");

CREATE UNIQUE INDEX "notification_deliveries_user_id_kind_period_key_key"
ON "notification_deliveries"("user_id", "kind", "period_key");

CREATE INDEX "notification_deliveries_status_scheduled_for_idx"
ON "notification_deliveries"("status", "scheduled_for");

CREATE INDEX "notification_deliveries_user_id_created_at_idx"
ON "notification_deliveries"("user_id", "created_at" DESC);

ALTER TABLE "notification_deliveries"
ADD CONSTRAINT "notification_deliveries_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
