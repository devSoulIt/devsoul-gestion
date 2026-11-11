import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { getDefaultSplit, parseShares, replaceSplit, withNames } from "@/lib/finance/splits";

export async function GET() {
  try {
    const auth = await requireRole();
    if (!auth.ok) return auth.response;

    const [shares, users] = await Promise.all([
      getDefaultSplit().then(withNames),
      prisma.user.findMany({ select: { id: true, name: true, role: true }, orderBy: { createdAt: "asc" } }),
    ]);
    return NextResponse.json({ shares, users });
  } catch (error) {
    console.error("[GET /api/splits/default]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireRole([Role.OWNER]);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const parsed = await parseShares(body.shares);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    await prisma.$transaction((tx) => replaceSplit(tx, null, parsed.shares));
    return NextResponse.json({ shares: await withNames(parsed.shares) });
  } catch (error) {
    console.error("[PUT /api/splits/default]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
