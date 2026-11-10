import { NextRequest, NextResponse } from "next/server";
import { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { optionalDate, optionalText, projectInclude } from "@/lib/projects";

type Params = { params: Promise<{ id: string }> };

type UpdateProjectBody = {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
};

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const project = await prisma.project.findFirst({ where: { id, deletedAt: null }, include: projectInclude });
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    return NextResponse.json(project);
  } catch (error) {
    console.error("[GET /api/projects/[id]]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body: UpdateProjectBody = await req.json();

    const existing = await prisma.project.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const name = body.name !== undefined ? optionalText(body.name) : existing.name;
    if (!name) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    if (body.status !== undefined && !Object.values(ProjectStatus).includes(body.status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    const startDate = body.startDate !== undefined ? optionalDate(body.startDate) : existing.startDate;
    const endDate = body.endDate !== undefined ? optionalDate(body.endDate) : existing.endDate;
    if (startDate === undefined || endDate === undefined) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }
    if (startDate && endDate && endDate < startDate) {
      return NextResponse.json({ error: "La fecha de fin es anterior al inicio" }, { status: 400 });
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        name,
        ...(body.description !== undefined && { description: optionalText(body.description) }),
        ...(body.status !== undefined && { status: body.status }),
        startDate,
        endDate,
      },
      include: projectInclude,
    });
    return NextResponse.json(project);
  } catch (error) {
    console.error("[PUT /api/projects/[id]]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const existing = await prisma.project.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const activeContracts = await prisma.contract.count({
      where: { projectId: id, active: true, deletedAt: null },
    });
    if (activeContracts > 0) {
      return NextResponse.json(
        { error: "El proyecto tiene contratos activos. Finalizalos antes de archivarlo." },
        { status: 409 }
      );
    }

    await prisma.project.update({
      where: { id },
      data: { deletedAt: new Date(), status: ProjectStatus.CLOSED },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/projects/[id]]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
