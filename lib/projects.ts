import "server-only";
import { Prisma, TaskStatus, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function findClientProject(projectId: string | null | undefined, clientId: string) {
  if (!projectId) return { ok: true as const, projectId: null };
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, clientId: true },
  });
  if (!project) return { ok: false as const, status: 404, error: "Proyecto no encontrado" };
  if (project.clientId !== clientId) {
    return { ok: false as const, status: 400, error: "El proyecto no pertenece a ese cliente" };
  }
  return { ok: true as const, projectId: project.id };
}

export function optionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function optionalDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export const projectInclude = {
  client: { select: { id: true, companyName: true } },
  components: {
    where: { active: true },
    orderBy: { createdAt: "asc" },
    include: { software: { select: { id: true, name: true, type: true } } },
  },
  contracts: {
    where: { deletedAt: null },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      type: true,
      active: true,
      totalAmount: true,
      currency: true,
      startDate: true,
      endDate: true,
      software: { select: { id: true, name: true } },
    },
  },
  _count: {
    select: {
      tickets: { where: { status: { not: TicketStatus.RESOLVED } } },
      tasks: { where: { status: TaskStatus.PENDING } },
    },
  },
} satisfies Prisma.ProjectInclude;
