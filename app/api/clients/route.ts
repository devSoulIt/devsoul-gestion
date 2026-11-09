import { NextRequest, NextResponse } from "next/server";
import { ClientStage, Prisma, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseClient, type ClientBody } from "@/lib/clients";

export async function POST(req: NextRequest) {
  try {
    const parsed = parseClient((await req.json()) as ClientBody, false);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const stage = parsed.data.stage ?? ClientStage.PROSPECT;
    if (stage === ClientStage.CLIENT && !parsed.data.email) {
      return NextResponse.json({ error: "Para registrarlo como cliente cargá el email" }, { status: 400 });
    }

    const client = await prisma.client.create({
      data: {
        ...parsed.data,
        companyName: parsed.data.companyName!,
        contactName: parsed.data.contactName!,
        stage,
        convertedAt: stage === ClientStage.CLIENT ? new Date() : null,
        status: parsed.data.status ?? true,
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un cliente con ese email" }, { status: 409 });
    }
    console.error("[POST /api/clients]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const stageParam = req.nextUrl.searchParams.get("stage");
    const stage =
      stageParam && Object.values(ClientStage).includes(stageParam as ClientStage)
        ? (stageParam as ClientStage)
        : undefined;

    const clients = await prisma.client.findMany({
      where: { deletedAt: null, ...(stage && { stage }) },
      include: {
        _count: {
          select: {
            contracts: { where: { active: true, deletedAt: null } },
            projects: { where: { deletedAt: null } },
            tasks: { where: { status: TaskStatus.PENDING } },
          },
        },
      },
      orderBy: [{ stage: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error("[GET /api/clients]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
