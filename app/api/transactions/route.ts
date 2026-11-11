import { NextRequest, NextResponse } from "next/server";
import { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";
import { buildLedgerEntry, parseAmount, parseDate } from "@/lib/finance/ledger";
import { RateUnavailableError } from "@/lib/finance/rates";

type CreateTransactionBody = {
  type: TransactionType;
  accountId: string;
  categoryId: string;
  amount: number;
  description?: string;
  date: string;
};

const MANUAL_TYPES: TransactionType[] = [TransactionType.INCOME, TransactionType.EXPENSE];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const type = searchParams.get("type");
    const month = searchParams.get("month");
    const accountId = searchParams.get("accountId");
    const categoryId = searchParams.get("categoryId");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const skip = (page - 1) * limit;

    let dateFilter: Prisma.TransactionWhereInput = {};
    if (month) {
      const [y, m] = month.split("-").map(Number);
      if (y && m) {
        dateFilter = { date: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) } };
      }
    }

    const typeFilter: Prisma.TransactionWhereInput =
      type === "TRANSFER"
        ? { type: { in: [TransactionType.TRANSFER_IN, TransactionType.TRANSFER_OUT] } }
        : type === "ADJUSTMENT"
          ? { type: { in: [TransactionType.ADJUSTMENT_IN, TransactionType.ADJUSTMENT_OUT] } }
          : type && Object.values(TransactionType).includes(type as TransactionType)
            ? { type: type as TransactionType }
            : {};

    const where: Prisma.TransactionWhereInput = {
      ...typeFilter,
      ...dateFilter,
      ...(accountId ? { accountId } : {}),
      ...(categoryId ? { categoryId } : {}),
    };

    const [data, total, sums] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: { select: { id: true, name: true, currency: true } },
          category: { select: { id: true, name: true } },
          invoice: { select: { id: true, period: true } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.groupBy({ by: ["type"], where, _sum: { amountArs: true } }),
    ]);

    const sumOf = (t: TransactionType) => Number(sums.find((s) => s.type === t)?._sum.amountArs ?? 0);
    const income = sumOf(TransactionType.INCOME);
    const expense = sumOf(TransactionType.EXPENSE);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      summary: { income, expense, net: income - expense },
    });
  } catch (error) {
    console.error("[GET /api/transactions]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const body: CreateTransactionBody = await req.json();
    const amount = parseAmount(body.amount);
    const date = parseDate(body.date);

    if (!MANUAL_TYPES.includes(body.type)) {
      return NextResponse.json({ error: "Tipo inválido (INCOME o EXPENSE)" }, { status: 400 });
    }
    if (!body.accountId || !body.categoryId || !amount || !date) {
      return NextResponse.json({ error: "Faltan campos requeridos o son inválidos" }, { status: 400 });
    }

    const [account, category] = await Promise.all([
      prisma.financialAccount.findFirst({ where: { id: body.accountId, active: true } }),
      prisma.transactionCategory.findFirst({ where: { id: body.categoryId, active: true } }),
    ]);

    if (!account) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    if (!category) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
    if (category.type !== body.type) {
      return NextResponse.json({ error: "La categoría no corresponde al tipo de movimiento" }, { status: 400 });
    }

    const transaction = await prisma.transaction.create({
      data: await buildLedgerEntry({
        account,
        type: body.type,
        amount,
        date,
        categoryId: category.id,
        description: body.description?.trim(),
        createdById: auth.session.userId,
      }),
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    if (error instanceof RateUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("[POST /api/transactions]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
