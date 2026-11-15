-- CreateEnum
CREATE TYPE "IdentityProvider" AS ENUM ('telegram', 'google', 'apple', 'phone', 'email');

-- CreateEnum
CREATE TYPE "IdentityEventType" AS ENUM ('created', 'oidc_bound', 'linked', 'conflict', 'unlinked', 'session_revoked');

-- CreateEnum
CREATE TYPE "IdentityChannel" AS ENUM ('telegram_bot', 'telegram_miniapp', 'flutter', 'web', 'backfill', 'admin_recovery');

-- CreateEnum
CREATE TYPE "CustomerClientType" AS ENUM ('flutter_android', 'flutter_ios', 'web');

-- CreateTable
CREATE TABLE "user_identities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "provider_subject" VARCHAR(255) NOT NULL,
    "oidc_subject" VARCHAR(255),
    "telegram_user_id" BIGINT,
    "profile_display_name" VARCHAR(160),
    "profile_username" VARCHAR(120),
    "profile_picture_url" TEXT,
    "verified_at" TIMESTAMPTZ(3) NOT NULL,
    "last_authenticated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_identities_telegram_fields_check" CHECK (
        "provider" <> 'telegram' OR (
            "telegram_user_id" IS NOT NULL
            AND "provider_subject" = "telegram_user_id"::TEXT
        )
    ),
    CONSTRAINT "user_identities_non_telegram_id_check" CHECK (
        "provider" = 'telegram' OR "telegram_user_id" IS NULL
    )
);

-- CreateTable
CREATE TABLE "customer_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "client_type" "CustomerClientType" NOT NULL,
    "device_name" VARCHAR(160),
    "app_version" VARCHAR(40),
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" VARCHAR(80),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_sessions_expiry_check" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "customer_sessions_revocation_check" CHECK (
        ("revoked_at" IS NULL AND "revoke_reason" IS NULL)
        OR ("revoked_at" IS NOT NULL AND "revoke_reason" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "customer_refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_refresh_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_refresh_tokens_expiry_check" CHECK ("expires_at" > "created_at")
);

-- CreateTable
CREATE TABLE "identity_link_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "identity_id" UUID,
    "event_type" "IdentityEventType" NOT NULL,
    "channel" "IdentityChannel" NOT NULL,
    "correlation_id" VARCHAR(80),
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_link_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_provider_subject_key" ON "user_identities"("provider", "provider_subject");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_oidc_subject_key" ON "user_identities"("provider", "oidc_subject");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_telegram_user_id_key" ON "user_identities"("provider", "telegram_user_id");

-- CreateIndex
CREATE INDEX "user_identities_user_id_idx" ON "user_identities"("user_id");

-- CreateIndex
CREATE INDEX "customer_sessions_user_id_revoked_at_idx" ON "customer_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "customer_sessions_identity_id_revoked_at_idx" ON "customer_sessions"("identity_id", "revoked_at");

-- CreateIndex
CREATE INDEX "customer_sessions_expires_at_idx" ON "customer_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_refresh_tokens_token_hash_key" ON "customer_refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "customer_refresh_tokens_session_id_created_at_idx" ON "customer_refresh_tokens"("session_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "customer_refresh_tokens_expires_at_idx" ON "customer_refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "identity_link_events_user_id_occurred_at_idx" ON "identity_link_events"("user_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "identity_link_events_identity_id_occurred_at_idx" ON "identity_link_events"("identity_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "identity_link_events_event_type_occurred_at_idx" ON "identity_link_events"("event_type", "occurred_at");

-- AddForeignKey
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "user_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_refresh_tokens" ADD CONSTRAINT "customer_refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "customer_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_link_events" ADD CONSTRAINT "identity_link_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_link_events" ADD CONSTRAINT "identity_link_events_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "user_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
