-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionSource" ADD VALUE 'ADJUSTMENT';
ALTER TYPE "TransactionSource" ADD VALUE 'YIELD';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'ADJUSTMENT_IN';
ALTER TYPE "TransactionType" ADD VALUE 'ADJUSTMENT_OUT';

-- AlterTable
ALTER TABLE "FinancialAccount" ADD COLUMN     "earnsYield" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reconciledAt" TIMESTAMP(3),
ADD COLUMN     "reconciledBalance" DECIMAL(14,2);

-- Ualá ARS es la cuenta remunerada
UPDATE "FinancialAccount" SET "earnsYield" = true WHERE "provider" = 'UALA' AND "currency" = 'ARS';
