import "server-only";
import { ComponentKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { optionalText } from "@/lib/projects";

export type ComponentBody = {
  name?: string;
  kind?: ComponentKind;
  softwareId?: string | null;
  url?: string | null;
  repoUrl?: string | null;
  notes?: string | null;
  active?: boolean;
};

type ComponentData = {
  name?: string;
  kind?: ComponentKind;
  softwareId?: string | null;
  url?: string | null;
  repoUrl?: string | null;
  notes?: string | null;
  active?: boolean;
};

export const componentInclude = { software: { select: { id: true, name: true, type: true } } } as const;

function normalizeUrl(value: unknown) {
  const text = optionalText(value);
  if (!text) return null;
  const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    return new URL(candidate).toString();
  } catch {
    return undefined;
  }
}

export async function parseComponent(
  body: ComponentBody,
  partial: boolean
): Promise<{ data: ComponentData } | { error: string }> {
  const data: ComponentData = {};

  if (!partial || body.name !== undefined) {
    const name = optionalText(body.name);
    if (!name) return { error: "El nombre es obligatorio" };
    data.name = name;
  }
  if (!partial || body.kind !== undefined) {
    if (!body.kind || !Object.values(ComponentKind).includes(body.kind)) {
      return { error: "Tipo de componente inválido" };
    }
    data.kind = body.kind;
  }
  if (body.softwareId !== undefined) {
    if (body.softwareId) {
      const software = await prisma.software.findFirst({ where: { id: body.softwareId, deletedAt: null } });
      if (!software) return { error: "Software no encontrado" };
    }
    data.softwareId = body.softwareId || null;
  }
  for (const key of ["url", "repoUrl"] as const) {
    if (body[key] === undefined) continue;
    const url = normalizeUrl(body[key]);
    if (url === undefined) return { error: "URL inválida" };
    data[key] = url;
  }
  if (body.notes !== undefined) data.notes = optionalText(body.notes);
  if (body.active !== undefined) data.active = Boolean(body.active);

  return { data };
}
