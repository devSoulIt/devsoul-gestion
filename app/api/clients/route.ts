import { NextRequest, NextResponse } from "next/server";
import { Prisma, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CreateClientBody = {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  status?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body: CreateClientBody = await req.json();
    const { companyName, contactName, email, phone, status } = body;

    if (!companyName || !contactName || !email) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    const client = await prisma.client.create({
      data: {
        companyName,
        contactName,
        email,
        phone: phone || null,
        status: status ?? true,
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

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: {
            contracts: { where: { active: true, deletedAt: null } },
            projects: { where: { deletedAt: null } },
            tasks: { where: { status: TaskStatus.PENDING } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error("[GET /api/clients]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
