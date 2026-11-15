CREATE TYPE "FinancialEventKind" AS ENUM (
  'income',
  'expense',
  'loan_received',
  'loan_repayment',
  'refund',
  'reimbursement'
);

ALTER TYPE "TransactionCategory" ADD VALUE 'freelance';
ALTER TYPE "TransactionCategory" ADD VALUE 'gift_received';
ALTER TYPE "TransactionCategory" ADD VALUE 'investment_return';
ALTER TYPE "TransactionCategory" ADD VALUE 'rental_income';
ALTER TYPE "TransactionCategory" ADD VALUE 'food_groceries';
ALTER TYPE "TransactionCategory" ADD VALUE 'housing_rent';
ALTER TYPE "TransactionCategory" ADD VALUE 'airtime_internet';
ALTER TYPE "TransactionCategory" ADD VALUE 'clothing_personal_care';
ALTER TYPE "TransactionCategory" ADD VALUE 'shopping_household';
ALTER TYPE "TransactionCategory" ADD VALUE 'fees_taxes';
ALTER TYPE "TransactionCategory" ADD VALUE 'church_charity_gifts';
ALTER TYPE "TransactionCategory" ADD VALUE 'travel';
ALTER TYPE "TransactionCategory" ADD VALUE 'other_expense';
ALTER TYPE "TransactionCategory" ADD VALUE 'borrowed_money';
ALTER TYPE "TransactionCategory" ADD VALUE 'debt_repayment';
ALTER TYPE "TransactionCategory" ADD VALUE 'refund';
ALTER TYPE "TransactionCategory" ADD VALUE 'reimbursement';

ALTER TABLE "transactions"
ADD COLUMN "kind" "FinancialEventKind";

UPDATE "transactions"
SET "kind" = CASE
  WHEN "type" = 'income' THEN 'income'::"FinancialEventKind"
  ELSE 'expense'::"FinancialEventKind"
END;

ALTER TABLE "transactions"
ALTER COLUMN "kind" SET NOT NULL,
ALTER COLUMN "kind" SET DEFAULT 'expense';

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_kind_direction_check"
CHECK (
  ("kind" IN ('income', 'loan_received', 'refund', 'reimbursement') AND "type" = 'income')
  OR ("kind" IN ('expense', 'loan_repayment') AND "type" = 'expense')
);

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_kind_category_check"
CHECK (
  ("kind" = 'income' AND "category" IN ('salary', 'business', 'freelance', 'remittance', 'gift_received', 'investment_return', 'rental_income', 'other_income'))
  OR ("kind" = 'expense' AND "category" IN ('food_groceries', 'transport', 'housing_rent', 'utilities', 'airtime_internet', 'health', 'education', 'family_support', 'entertainment', 'clothing_personal_care', 'shopping_household', 'fees_taxes', 'church_charity_gifts', 'travel', 'other_expense', 'food', 'rent', 'airtime_data', 'clothing', 'church_charity', 'other'))
  OR ("kind" = 'loan_received' AND "category" = 'borrowed_money')
  OR ("kind" = 'loan_repayment' AND "category" = 'debt_repayment')
  OR ("kind" = 'refund' AND "category" = 'refund')
  OR ("kind" = 'reimbursement' AND "category" = 'reimbursement')
);

CREATE INDEX "transactions_user_id_kind_occurred_at_idx"
ON "transactions"("user_id", "kind", "occurred_at");
