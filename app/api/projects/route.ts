import { NextRequest, NextResponse } from "next/server";
import { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { optionalDate, optionalText, projectInclude } from "@/lib/projects";

type CreateProjectBody = {
  clientId?: string;
  name?: string;
  description?: string;
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string;
};

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get("clientId");
    const projects = await prisma.project.findMany({
      where: { deletedAt: null, client: { deletedAt: null }, ...(clientId ? { clientId } : {}) },
      include: projectInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(projects);
  } catch (error) {
    console.error("[GET /api/projects]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateProjectBody = await req.json();
    const name = optionalText(body.name);
    if (!body.clientId || !name) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }
    if (body.status && !Object.values(ProjectStatus).includes(body.status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    const startDate = optionalDate(body.startDate);
    const endDate = optionalDate(body.endDate);
    if (startDate === undefined || endDate === undefined) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }
    if (startDate && endDate && endDate < startDate) {
      return NextResponse.json({ error: "La fecha de fin es anterior al inicio" }, { status: 400 });
    }

    const client = await prisma.client.findFirst({ where: { id: body.clientId, deletedAt: null } });
    if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    const project = await prisma.project.create({
      data: {
        clientId: client.id,
        name,
        description: optionalText(body.description),
        status: body.status ?? ProjectStatus.IN_PROGRESS,
        startDate,
        endDate,
      },
      include: projectInclude,
    });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
