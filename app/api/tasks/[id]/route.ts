import { NextRequest, NextResponse } from "next/server";
import { TaskRecurrence, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { nextDueAt } from "@/lib/tasks/recurrence";
import { parseTask, taskInclude, type TaskBody } from "@/lib/tasks/service";

type Params = { params: Promise<{ id: string }> };
type UpdateBody = TaskBody & { action?: "complete" | "reopen" };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireRole();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body: UpdateBody = await req.json();
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Recordatorio no encontrado" }, { status: 404 });

    if (body.action === "complete") {
      const result = await prisma.$transaction(async (tx) => {
        const { count } = await tx.task.updateMany({
          where: { id, status: TaskStatus.PENDING },
          data: { status: TaskStatus.DONE, completedAt: new Date() },
        });
        if (!count) return null;

        const nextDue =
          existing.recurrence === TaskRecurrence.NONE ? null : nextDueAt(existing.dueAt, existing.recurrence);
        const next = nextDue
          ? await tx.task.create({
              data: {
                title: existing.title,
                notes: existing.notes,
                type: existing.type,
                recurrence: existing.recurrence,
                dueAt: nextDue,
                assignedToId: existing.assignedToId,
                createdById: existing.createdById,
                clientId: existing.clientId,
                projectId: existing.projectId,
                invoiceId: null,
              },
              include: taskInclude,
            })
          : null;

        const task = await tx.task.findUniqueOrThrow({ where: { id }, include: taskInclude });
        return { task, next };
      });
      if (!result) {
        return NextResponse.json({ error: "El recordatorio ya no está pendiente" }, { status: 409 });
      }
      return NextResponse.json(result);
    }

    if (body.action === "reopen") {
      if (existing.status === TaskStatus.PENDING) {
        return NextResponse.json({ error: "El recordatorio ya está pendiente" }, { status: 409 });
      }
      const task = await prisma.task.update({
        where: { id },
        data: { status: TaskStatus.PENDING, completedAt: null, notifiedAt: null },
        include: taskInclude,
      });
      return NextResponse.json({ task, next: null });
    }

    const parsed = await parseTask(body, existing);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status ?? 400 });

    const dueChanged = parsed.data.dueAt && parsed.data.dueAt.getTime() !== existing.dueAt.getTime();
    const task = await prisma.task.update({
      where: { id },
      data: { ...parsed.data, ...(dueChanged && { notifiedAt: null }) },
      include: taskInclude,
    });
    return NextResponse.json({ task, next: null });
  } catch (error) {
    console.error("[PUT /api/tasks/[id]]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireRole();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Recordatorio no encontrado" }, { status: 404 });

    await prisma.task.update({ where: { id }, data: { status: TaskStatus.CANCELLED } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/tasks/[id]]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
