import { NextRequest, NextResponse } from "next/server";
import { Prisma, TaskRecurrence, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { rangeFilter, type TaskRange } from "@/lib/tasks/recurrence";
import { parseTask, taskInclude, type TaskBody } from "@/lib/tasks/service";

const RANGES: TaskRange[] = ["overdue", "today", "week", "upcoming"];

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole();
    if (!auth.ok) return auth.response;

    const params = req.nextUrl.searchParams;
    const statusParam = params.get("status");
    const status =
      statusParam && Object.values(TaskStatus).includes(statusParam as TaskStatus)
        ? (statusParam as TaskStatus)
        : TaskStatus.PENDING;
    const range = params.get("range") as TaskRange | null;
    const assignedTo = params.get("assignedTo");
    const limit = Math.min(200, Math.max(1, Number(params.get("limit")) || 100));

    const where: Prisma.TaskWhereInput = {
      status,
      ...(params.get("clientId") && { clientId: params.get("clientId") }),
      ...(params.get("projectId") && { projectId: params.get("projectId") }),
      ...(params.get("invoiceId") && { invoiceId: params.get("invoiceId") }),
      ...(assignedTo === "me" && { assignedToId: auth.session.userId }),
      ...(assignedTo && assignedTo !== "me" && { assignedToId: assignedTo }),
      ...(range && RANGES.includes(range) && { dueAt: rangeFilter(range) }),
    };

    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: status === TaskStatus.PENDING ? [{ dueAt: "asc" }, { createdAt: "asc" }] : [{ updatedAt: "desc" }],
      take: limit,
    });
    return NextResponse.json(tasks);
  } catch (error) {
    console.error("[GET /api/tasks]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole();
    if (!auth.ok) return auth.response;

    const parsed = await parseTask((await req.json()) as TaskBody);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status ?? 400 });
    const { title, type, dueAt, ...rest } = parsed.data;

    const task = await prisma.task.create({
      data: {
        ...rest,
        title: title!,
        type: type!,
        dueAt: dueAt!,
        recurrence: rest.recurrence ?? TaskRecurrence.NONE,
        assignedToId: rest.assignedToId === undefined ? auth.session.userId : rest.assignedToId,
        createdById: auth.session.userId,
      },
      include: taskInclude,
    });
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("[POST /api/tasks]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
