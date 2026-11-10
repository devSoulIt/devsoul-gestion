import "server-only";
import { Prisma, TaskRecurrence, TaskType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { optionalText } from "@/lib/projects";
import { parseDueAt } from "./recurrence";

export const taskInclude = {
  assignedTo: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  client: { select: { id: true, companyName: true } },
  project: { select: { id: true, name: true } },
  invoice: {
    select: { id: true, period: true, amount: true, currency: true, dueDate: true, status: true },
  },
} satisfies Prisma.TaskInclude;

export type TaskBody = {
  title?: string;
  notes?: string | null;
  type?: TaskType;
  dueAt?: string;
  recurrence?: TaskRecurrence;
  assignedToId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  invoiceId?: string | null;
};

type Links = { clientId: string | null; projectId: string | null; invoiceId: string | null };

export type TaskData = Partial<{
  title: string;
  notes: string | null;
  type: TaskType;
  dueAt: Date;
  recurrence: TaskRecurrence;
  assignedToId: string | null;
}> &
  Partial<Links>;

type Parsed = { data: TaskData } | { error: string; status?: number };

async function resolveLinks(links: Links): Promise<{ links: Links } | { error: string; status?: number }> {
  let { clientId } = links;
  const { projectId, invoiceId } = links;

  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
    if (!project) return { error: "Proyecto no encontrado", status: 404 };
    if (clientId && clientId !== project.clientId) return { error: "El proyecto no pertenece a ese cliente" };
    clientId = project.clientId;
  }

  if (invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { contract: { select: { clientId: true } } },
    });
    if (!invoice) return { error: "Factura no encontrada", status: 404 };
    if (clientId && clientId !== invoice.contract.clientId) {
      return { error: "La factura no pertenece a ese cliente" };
    }
    clientId = invoice.contract.clientId;
  }

  if (clientId) {
    const client = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } });
    if (!client) return { error: "Cliente no encontrado", status: 404 };
  }

  return { links: { clientId, projectId, invoiceId } };
}

export async function parseTask(body: TaskBody, existing?: Links): Promise<Parsed> {
  const partial = Boolean(existing);
  const data: TaskData = {};

  if (!partial || body.title !== undefined) {
    const title = optionalText(body.title);
    if (!title) return { error: "El título es obligatorio" };
    data.title = title.slice(0, 200);
  }
  if (!partial || body.type !== undefined) {
    if (!body.type || !Object.values(TaskType).includes(body.type)) return { error: "Tipo inválido" };
    data.type = body.type;
  }
  if (!partial || body.dueAt !== undefined) {
    const dueAt = parseDueAt(body.dueAt);
    if (!dueAt) return { error: "Fecha inválida" };
    data.dueAt = dueAt;
  }
  if (body.recurrence !== undefined) {
    if (!Object.values(TaskRecurrence).includes(body.recurrence)) return { error: "Repetición inválida" };
    data.recurrence = body.recurrence;
  }
  if (body.notes !== undefined) data.notes = optionalText(body.notes);

  if (body.assignedToId !== undefined) {
    if (body.assignedToId) {
      const user = await prisma.user.findUnique({ where: { id: body.assignedToId }, select: { id: true } });
      if (!user) return { error: "Responsable no encontrado", status: 404 };
    }
    data.assignedToId = body.assignedToId || null;
  }

  const touchesLinks = body.clientId !== undefined || body.projectId !== undefined || body.invoiceId !== undefined;
  if (!partial || touchesLinks) {
    const resolved = await resolveLinks({
      clientId: body.clientId !== undefined ? body.clientId || null : existing?.clientId ?? null,
      projectId: body.projectId !== undefined ? body.projectId || null : existing?.projectId ?? null,
      invoiceId: body.invoiceId !== undefined ? body.invoiceId || null : existing?.invoiceId ?? null,
    });
    if ("error" in resolved) return resolved;
    Object.assign(data, resolved.links);
  }

  return { data };
}
