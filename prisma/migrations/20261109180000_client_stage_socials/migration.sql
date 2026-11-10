-- CreateEnum
CREATE TYPE "ClientStage" AS ENUM ('PROSPECT', 'CLIENT');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "facebook" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "linkedin" TEXT,
ADD COLUMN     "stage" "ClientStage" NOT NULL DEFAULT 'PROSPECT',
ADD COLUMN     "tiktok" TEXT,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "x" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Client_stage_idx" ON "Client"("stage");


-- Los clientes existentes ya trabajan con Devsoul
UPDATE "Client" SET "stage" = 'CLIENT', "convertedAt" = "createdAt";
