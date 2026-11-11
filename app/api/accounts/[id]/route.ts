import { NextRequest, NextResponse } from "next/server";
import { AccountProvider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";

type UpdateAccountBody = {
  name?: string;
  provider?: AccountProvider;
  openingBalance?: number;
  openingDate?: string;
  active?: boolean;
  earnsYield?: boolean;
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body: UpdateAccountBody = await req.json();

    const existing = await prisma.financialAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }
    if (body.provider && !Object.values(AccountProvider).includes(body.provider)) {
      return NextResponse.json({ error: "Proveedor inválido" }, { status: 400 });
    }

    const updated = await prisma.financialAccount.update({
      where: { id },
      data: {
        ...(body.name?.trim() && { name: body.name.trim() }),
        ...(body.provider && { provider: body.provider }),
        ...(body.openingBalance !== undefined && { openingBalance: body.openingBalance }),
        ...(body.openingDate && { openingDate: new Date(body.openingDate) }),
        ...(body.active !== undefined && { active: body.active }),
        ...(typeof body.earnsYield === "boolean" && { earnsYield: body.earnsYield }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe una cuenta con ese nombre" }, { status: 409 });
    }
    console.error("[PATCH /api/accounts/[id]]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
