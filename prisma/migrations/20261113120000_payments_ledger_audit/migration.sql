-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('FLEXIBLE', 'INSTALLMENTS');

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "billingMode" "BillingMode" NOT NULL DEFAULT 'INSTALLMENTS';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "paymentId" TEXT,
ALTER COLUMN "invoiceId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "rateToArs" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "amountArs" DECIMAL(14,2) NOT NULL,
    "appliedAmount" DECIMAL(12,2) NOT NULL,
    "appliedCurrency" "Currency" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "transactionId" TEXT,
    "createdById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reverseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "rateToArs" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "amountArs" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "concept" TEXT,
    "transactionId" TEXT,
    "createdById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reverseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "diff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");

-- CreateIndex
CREATE INDEX "Payment_clientId_date_idx" ON "Payment"("clientId", "date");

-- CreateIndex
CREATE INDEX "Payment_contractId_idx" ON "Payment"("contractId");

-- CreateIndex
CREATE INDEX "Payment_reversedAt_idx" ON "Payment"("reversedAt");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_invoiceId_key" ON "PaymentAllocation"("paymentId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerPayment_transactionId_key" ON "PartnerPayment"("transactionId");

-- CreateIndex
CREATE INDEX "PartnerPayment_userId_date_idx" ON "PartnerPayment"("userId", "date");

-- CreateIndex
CREATE INDEX "PartnerPayment_reversedAt_idx" ON "PartnerPayment"("reversedAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "Payout_paymentId_idx" ON "Payout"("paymentId");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayment" ADD CONSTRAINT "PartnerPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayment" ADD CONSTRAINT "PartnerPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayment" ADD CONSTRAINT "PartnerPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayment" ADD CONSTRAINT "PartnerPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayment" ADD CONSTRAINT "PartnerPayment_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: cada factura cobrada con su movimiento pasa a Payment + PaymentAllocation
INSERT INTO "Payment" ("id", "clientId", "contractId", "accountId", "amount", "currency", "rateToArs", "amountArs",
  "appliedAmount", "appliedCurrency", "date", "transactionId", "createdById", "createdAt", "updatedAt")
SELECT 'pay_' || t."id", c."clientId", c."id", t."accountId", t."amount", t."currency", t."rateToArs", t."amountArs",
  i."amount", i."currency", t."date", t."id", t."createdById", t."createdAt", CURRENT_TIMESTAMP
FROM "Transaction" t
JOIN "Invoice" i ON i."id" = t."invoiceId"
JOIN "Contract" c ON c."id" = i."contractId";

INSERT INTO "PaymentAllocation" ("id", "paymentId", "invoiceId", "amount", "createdAt")
SELECT 'pal_' || t."id", 'pay_' || t."id", t."invoiceId", i."amount", t."createdAt"
FROM "Transaction" t
JOIN "Invoice" i ON i."id" = t."invoiceId";

UPDATE "Invoice" SET "paidAmount" = "amount" WHERE "status" = 'PAID';

UPDATE "Payout" p SET "paymentId" = 'pay_' || t."id"
FROM "Transaction" t
WHERE t."invoiceId" = p."invoiceId";

-- Backfill: pagos a socios ya registrados pasan a PartnerPayment
INSERT INTO "PartnerPayment" ("id", "userId", "accountId", "amount", "currency", "rateToArs", "amountArs", "date",
  "concept", "transactionId", "createdById", "createdAt", "updatedAt")
SELECT 'ppm_' || p."id", p."userId", t."accountId", t."amount", t."currency", t."rateToArs", t."amountArs", t."date",
  'Reparto de cobro', t."id", t."createdById", t."createdAt", CURRENT_TIMESTAMP
FROM "Payout" p
JOIN "Transaction" t ON t."id" = p."transactionId"
WHERE p."userId" IS NOT NULL;

-- Columnas reemplazadas por Payment.transactionId y PartnerPayment.transactionId
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_transactionId_fkey";
DROP INDEX "Payout_transactionId_key";
ALTER TABLE "Payout" DROP COLUMN "transactionId";

ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_invoiceId_fkey";
DROP INDEX "Transaction_invoiceId_key";
ALTER TABLE "Transaction" DROP COLUMN "invoiceId";
