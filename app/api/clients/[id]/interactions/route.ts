import { NextRequest, NextResponse } from "next/server";
import { InteractionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { optionalText } from "@/lib/projects";

type Params = { params: Promise<{ id: string }> };

const interactionInclude = { user: { select: { id: true, name: true } } } as const;

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 50));
    const interactions = await prisma.clientInteraction.findMany({
      where: { clientId: id },
      include: interactionInclude,
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
    return NextResponse.json(interactions);
  } catch (error) {
    console.error("[GET /api/clients/[id]/interactions]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireRole();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body: { type?: InteractionType; note?: string; occurredAt?: string } = await req.json();
    const note = optionalText(body.note);

    if (!body.type || !Object.values(InteractionType).includes(body.type)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }
    if (!note) return NextResponse.json({ error: "La nota es obligatoria" }, { status: 400 });

    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime()) || occurredAt.getTime() > Date.now() + 60_000) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }

    const client = await prisma.client.findFirst({ where: { id, deletedAt: null } });
    if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    const interaction = await prisma.$transaction(async (tx) => {
      const created = await tx.clientInteraction.create({
        data: { clientId: id, userId: auth.session.userId, type: body.type!, note, occurredAt },
        include: interactionInclude,
      });
      if (!client.lastContactAt || client.lastContactAt < occurredAt) {
        await tx.client.update({ where: { id }, data: { lastContactAt: occurredAt } });
      }
      return created;
    });

    return NextResponse.json(interaction, { status: 201 });
  } catch (error) {
    console.error("[POST /api/clients/[id]/interactions]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
