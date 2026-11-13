-- Pagos a socios hechos fuera de las cuentas de la empresa (sin movimiento)
ALTER TABLE "PartnerPayment" ALTER COLUMN "accountId" DROP NOT NULL;
