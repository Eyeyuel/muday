ALTER TABLE "users" DROP CONSTRAINT "users_status_fields_check";

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
        "status" = 'deleting'
        AND "telegram_id" IS NOT NULL
        AND "deleted_at" IS NULL
    )
    OR (
        "status" = 'deleted'
        AND "deleted_at" IS NOT NULL
    )
);
