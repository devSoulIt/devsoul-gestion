import { PaymentStatus, BillingMode, Currency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { applyPaymentBalance, getContractAccounts } from "@/lib/billing/payments";
import { getAccountBalance } from "@/lib/finance/balances";

const APPLY = process.argv.includes("--apply");

const CONTRACT_ID = "cmwb92ud80001le07781kdajg";
const MANUAL_INVOICE_ID = "cmwb93myq0002lc07nadsp7dk";
const KEEP_PAYMENT_ID = "pay_cmwb94wbv0005lc077v4thsee";
const KEEP_TRANSACTION_ID = "cmwb94wbv0005lc077v4thsee";
const DUPLICATE_PAYMENT_ID = "pay_cmwb95f0b0008lc07vq3qcotg";
const DUPLICATE_TRANSACTION_ID = "cmwb95f0b0008lc07vq3qcotg";
const ADJUSTMENT_ID = "cmwdmr2tj0003js07aqsbgz9g";
const REAL_DATE = new Date("2026-11-10T00:00:00Z");
const NEW_DUE_DATE = new Date("2027-01-01T00:00:00Z");
const REASON = "Reestructura a cobro flexible: el cliente pagó una sola vez $400.000 el 10/11/2026";

class DryRun extends Error {}

async function main() {
  console.log(APPLY ? "== APLICANDO ==" : "== DRY RUN (sin cambios) ==");

  try {
    await prisma.$transaction(async (tx) => {
      const contract = await tx.contract.findUniqueOrThrow({
        where: { id: CONTRACT_ID },
        include: { client: true, software: true, invoices: true },
      });
      const [keep, duplicate, adjustment] = await Promise.all([
        tx.payment.findUniqueOrThrow({ where: { id: KEEP_PAYMENT_ID } }),
        tx.payment.findUniqueOrThrow({ where: { id: DUPLICATE_PAYMENT_ID } }),
        tx.transaction.findUniqueOrThrow({ where: { id: ADJUSTMENT_ID } }),
      ]);
      const account = await tx.financialAccount.findUniqueOrThrow({ where: { id: keep.accountId } });

      const checks: [string, boolean][] = [
        ["contrato de Popeye por 1.100.000", contract.client.companyName === "Popeye" && Number(contract.totalAmount) === 1_100_000],
        ["cobro de 400.000 vigente", Number(keep.amount) === 400_000 && !keep.reversedAt && keep.transactionId === KEEP_TRANSACTION_ID],
        ["cobro duplicado de 366.666,67 vigente", Number(duplicate.amount) === 366_666.67 && !duplicate.reversedAt && duplicate.transactionId === DUPLICATE_TRANSACTION_ID],
        ["ajuste de saldo de 2.523.162,32", adjustment.type === "ADJUSTMENT_IN" && Number(adjustment.amount) === 2_523_162.32],
        ["ajuste en la misma cuenta", adjustment.accountId === account.id],
        ["sin payouts asociados", (await tx.payout.count({ where: { paymentId: { in: [keep.id, duplicate.id] } } })) === 0],
      ];
      for (const [label, ok] of checks) {
        console.log(`${ok ? "OK  " : "FAIL"} ${label}`);
        if (!ok) throw new Error(`Chequeo previo fallido: ${label}`);
      }

      const before = await getAccountBalance(tx, account.id);
      console.log(`Saldo de ${account.name} antes: ${before?.balance} (conciliado ${account.reconciledBalance})`);

      await tx.paymentAllocation.deleteMany({ where: { paymentId: { in: [keep.id, duplicate.id] } } });

      await tx.payment.update({
        where: { id: duplicate.id },
        data: { reversedAt: new Date(), reverseReason: `Duplicado. ${REASON}`, transactionId: null },
      });
      await tx.transaction.delete({ where: { id: DUPLICATE_TRANSACTION_ID } });

      const label = `${contract.client.companyName} · ${contract.software.name}`;
      await tx.payment.update({ where: { id: keep.id }, data: { date: REAL_DATE } });
      await tx.transaction.update({
        where: { id: KEEP_TRANSACTION_ID },
        data: { date: REAL_DATE, description: `Cobro — ${label}` },
      });

      const toCancel = contract.invoices.filter((i) => i.status !== PaymentStatus.CANCELLED);
      await tx.invoice.updateMany({
        where: { id: { in: toCancel.map((i) => i.id) } },
        data: {
          status: PaymentStatus.CANCELLED,
          paidAmount: 0,
          paymentDate: null,
          rateToArs: null,
          cancelledAt: new Date(),
          cancelReason: REASON,
        },
      });
      console.log(`Facturas canceladas: ${toCancel.map((i) => `${i.period} ${i.amount}${i.id === MANUAL_INVOICE_ID ? " (manual)" : ""}`).join(", ")}`);

      await tx.contract.update({ where: { id: CONTRACT_ID }, data: { billingMode: BillingMode.FLEXIBLE } });
      const charge = await tx.invoice.create({
        data: {
          contractId: CONTRACT_ID,
          amount: 1_100_000,
          currency: Currency.ARS,
          period: "2026-11",
          dueDate: NEW_DUE_DATE,
          status: PaymentStatus.PENDING,
        },
      });
      await applyPaymentBalance(tx, keep.id);

      const newAdjustment = Math.round((Number(adjustment.amount) + 366_666.67) * 100) / 100;
      await tx.transaction.update({
        where: { id: ADJUSTMENT_ID },
        data: { amount: newAdjustment, amountArs: newAdjustment },
      });

      const after = await getAccountBalance(tx, account.id);
      const updatedCharge = await tx.invoice.findUniqueOrThrow({ where: { id: charge.id } });
      console.log(`Ajuste de saldo: ${adjustment.amount} → ${newAdjustment}`);
      console.log(`Saldo de ${account.name} después: ${after?.balance}`);
      console.log(`Cargo nuevo: ${updatedCharge.amount}, cobrado ${updatedCharge.paidAmount}, estado ${updatedCharge.status}`);

      if (after?.balance !== before?.balance) throw new Error("El saldo de la cuenta cambió");
      if (Number(updatedCharge.paidAmount) !== 400_000) throw new Error("El cobro no quedó aplicado al cargo");

      await audit(tx, {
        action: "fix.popeye",
        entity: "Contract",
        entityId: CONTRACT_ID,
        summary: `Corrección de Popeye: cobro único de $400.000 del 10/11/2026, cobro duplicado de $366.666,67 revertido y ajuste de saldo a ${newAdjustment}`,
        diff: {
          cancelledInvoices: toCancel.map((i) => i.id),
          newInvoice: charge.id,
          reversedPayment: duplicate.id,
          adjustment: { from: Number(adjustment.amount), to: newAdjustment },
        },
      });

      if (!APPLY) throw new DryRun();
    });
  } catch (error) {
    if (error instanceof DryRun) {
      console.log("Dry run OK: se deshizo todo. Corré con --apply para aplicar.");
      return;
    }
    throw error;
  }

  const account = (await getContractAccounts([CONTRACT_ID])).get(CONTRACT_ID);
  console.log(`Aplicado. Contrato: cobrado ${account?.collected}, falta ${account?.balance}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
