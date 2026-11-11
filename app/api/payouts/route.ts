import { NextRequest, NextResponse } from "next/server";
import { PayoutStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";

const STATUSES: PayoutStatus[] = [PayoutStatus.PENDING, PayoutStatus.PAID];

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole();
    if (!auth.ok) return auth.response;

    const { searchParams } = req.nextUrl;
    const statusParam = searchParams.get("status") as PayoutStatus | null;
    const status = statusParam && STATUSES.includes(statusParam) ? statusParam : PayoutStatus.PENDING;
    const userId = searchParams.get("userId") ?? undefined;

    const [payouts, users, pendingTotals] = await Promise.all([
      prisma.payout.findMany({
        where: { status, userId: userId ?? { not: null } },
        include: {
          user: { select: { id: true, name: true } },
          invoice: {
            select: {
              id: true,
              period: true,
              transaction: { select: { accountId: true } },
              contract: { select: { client: { select: { companyName: true } }, software: { select: { name: true } } } },
            },
          },
        },
        orderBy: status === PayoutStatus.PAID ? { paidAt: "desc" } : { createdAt: "asc" },
        take: status === PayoutStatus.PAID ? 50 : 200,
      }),
      prisma.user.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
      prisma.payout.groupBy({
        by: ["userId"],
        where: { status: PayoutStatus.PENDING, userId: { not: null } },
        _sum: { amountArs: true },
        _count: true,
      }),
    ]);

    const totals = users.map((u) => {
      const row = pendingTotals.find((t) => t.userId === u.id);
      return { userId: u.id, name: u.name, pendingArs: Number(row?._sum.amountArs ?? 0), count: row?._count ?? 0 };
    });

    return NextResponse.json({ payouts, totals });
  } catch (error) {
    console.error("[GET /api/payouts]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
