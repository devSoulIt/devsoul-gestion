import "server-only";
import { Prisma } from "@prisma/client";

export type AuditEntity = "Payment" | "PartnerPayment" | "Invoice" | "Contract" | "Account" | "Transaction";

export type AuditInput = {
  userId?: string | null;
  action: string;
  entity: AuditEntity;
  entityId: string;
  summary: string;
  diff?: Prisma.InputJsonValue;
};

export function audit(db: Pick<Prisma.TransactionClient, "auditLog">, input: AuditInput) {
  return db.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      summary: input.summary,
      diff: input.diff,
    },
  });
}
