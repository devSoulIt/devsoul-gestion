import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole([Role.OWNER]);
    if (!auth.ok) return auth.response;

    const { searchParams } = req.nextUrl;
    const entity = searchParams.get("entity") ?? undefined;
    const userId = searchParams.get("userId") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = 30;

    const where = { ...(entity && { entity }), ...(userId && { userId }) };
    const [data, total, users] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
      prisma.user.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    ]);

    return NextResponse.json({ data, total, page, totalPages: Math.ceil(total / limit), users });
  } catch (error) {
    console.error("[GET /api/audit]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
