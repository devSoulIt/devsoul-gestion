import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";

export async function GET() {
  try {
    const auth = await requireRole();
    if (!auth.ok) return auth.response;
    const users = await prisma.user.findMany({
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error("[GET /api/users]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
