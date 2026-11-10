import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { componentInclude, parseComponent, type ComponentBody } from "@/lib/project-components";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const parsed = await parseComponent((await req.json()) as ComponentBody, false);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { name, kind, ...rest } = parsed.data;

    const component = await prisma.projectComponent.create({
      data: { ...rest, name: name!, kind: kind!, projectId: id },
      include: componentInclude,
    });
    return NextResponse.json(component, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects/[id]/components]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
