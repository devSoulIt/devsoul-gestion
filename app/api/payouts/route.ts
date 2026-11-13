import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { getPartnerBalances } from "@/lib/finance/partner-payments";

const contractLabel = { select: { client: { select: { companyName: true } }, software: { select: { name: true } } } };

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole();
    if (!auth.ok) return auth.response;

    const userId = req.nextUrl.searchParams.get("userId") ?? undefined;

    const [payouts, balances] = await Promise.all([
      prisma.payout.findMany({
        where: { userId: userId ?? { not: null } },
        include: {
          user: { select: { id: true, name: true } },
          payment: { select: { id: true, date: true, contract: contractLabel } },
          invoice: { select: { id: true, period: true, paymentDate: true, contract: contractLabel } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      getPartnerBalances(),
    ]);

    return NextResponse.json({
      balances,
      payouts: payouts.map((p) => {
        const contract = p.payment?.contract ?? p.invoice?.contract ?? null;
        return {
          id: p.id,
          user: p.user,
          percent: p.percent,
          amount: p.amount,
          currency: p.currency,
          amountArs: p.amountArs,
          date: p.payment?.date ?? p.invoice?.paymentDate ?? p.createdAt,
          client: contract?.client.companyName ?? null,
          software: contract?.software.name ?? null,
        };
      }),
    });
  } catch (error) {
    console.error("[GET /api/payouts]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
