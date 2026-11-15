-- Drop the check constraint that enforces transcript expiration
ALTER TABLE "transaction_groups" DROP CONSTRAINT IF EXISTS "transaction_groups_transcript_retention_check";