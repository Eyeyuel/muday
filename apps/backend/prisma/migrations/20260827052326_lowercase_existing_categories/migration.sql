-- Lowercase existing category labels to match new dynamic conventions
UPDATE "transactions" SET "category" = LOWER("category");