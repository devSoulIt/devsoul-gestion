import { NextRequest, NextResponse } from "next/server";
import { AccountProvider, Currency, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";
import { getAccountBalances } from "@/lib/finance/balances";

type CreateAccountBody = {
  name: string;
  provider: AccountProvider;
  currency: Currency;
  openingBalance?: number;
  openingDate: string;
  earnsYield?: boolean;
};

export async function GET(req: NextRequest) {
  try {
    const includeInactive = req.nextUrl.searchParams.get("all") === "true";
    return NextResponse.json(await getAccountBalances({ includeInactive }));
  } catch (error) {
    console.error("[GET /api/accounts]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const { name, provider, currency, openingBalance, openingDate, earnsYield }: CreateAccountBody = await req.json();

    if (!name?.trim() || !provider || !currency || !openingDate) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }
    if (!Object.values(AccountProvider).includes(provider)) {
      return NextResponse.json({ error: "Proveedor inválido" }, { status: 400 });
    }
    if (!Object.values(Currency).includes(currency)) {
      return NextResponse.json({ error: "Moneda inválida" }, { status: 400 });
    }

    const account = await prisma.financialAccount.create({
      data: {
        name: name.trim(),
        provider,
        currency,
        openingBalance: openingBalance ?? 0,
        openingDate: new Date(openingDate),
        earnsYield: earnsYield === true,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe una cuenta con ese nombre" }, { status: 409 });
    }
    console.error("[POST /api/accounts]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
