import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { componentInclude, parseComponent, type ComponentBody } from "@/lib/project-components";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const existing = await prisma.projectComponent.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Componente no encontrado" }, { status: 404 });

    const parsed = await parseComponent((await req.json()) as ComponentBody, true);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const component = await prisma.projectComponent.update({
      where: { id },
      data: parsed.data,
      include: componentInclude,
    });
    return NextResponse.json(component);
  } catch (error) {
    console.error("[PUT /api/project-components/[id]]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const existing = await prisma.projectComponent.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Componente no encontrado" }, { status: 404 });
    await prisma.projectComponent.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/project-components/[id]]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
