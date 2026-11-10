import { NextRequest, NextResponse } from "next/server";
import { TicketStatus, TicketPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findClientProject } from "@/lib/projects";

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

type CreateTicketBody = {
  clientId: string;
  softwareId: string;
  projectId?: string | null;
  title: string;
  description: string;
  priority: TicketPriority;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as TicketStatus | null;

    const tickets = await prisma.ticket.findMany({
      where: status ? { status } : { status: { not: TicketStatus.RESOLVED } },
      include: {
        client: { select: { id: true, companyName: true } },
        software: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    tickets.sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        a.status.localeCompare(b.status)
    );

    return NextResponse.json(tickets);
  } catch (error) {
    console.error("[GET /api/tickets]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateTicketBody = await req.json();
    const { clientId, softwareId, projectId, title, description, priority } = body;

    if (!clientId || !softwareId || !title || !description || !priority) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    if (!Object.values(TicketPriority).includes(priority)) {
      return NextResponse.json({ error: "Prioridad inválida" }, { status: 400 });
    }

    const [client, software] = await Promise.all([
      prisma.client.findFirst({ where: { id: clientId, deletedAt: null } }),
      prisma.software.findFirst({ where: { id: softwareId, deletedAt: null } }),
    ]);

    if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    if (!software) return NextResponse.json({ error: "Software no encontrado" }, { status: 404 });

    const project = await findClientProject(projectId, clientId);
    if (!project.ok) return NextResponse.json({ error: project.error }, { status: project.status });

    const ticket = await prisma.ticket.create({
      data: {
        clientId,
        softwareId,
        projectId: project.projectId,
        title,
        description,
        priority,
        status: TicketStatus.OPEN,
      },
      include: {
        client: { select: { id: true, companyName: true } },
        software: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error("[POST /api/tickets]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
