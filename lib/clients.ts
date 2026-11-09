import { ClientStage } from "@prisma/client";
import { optionalText } from "@/lib/projects";

export const SOCIAL_FIELDS = ["website", "instagram", "facebook", "linkedin", "tiktok", "x"] as const;
export type SocialField = (typeof SOCIAL_FIELDS)[number];

const SOCIAL_BASE: Record<Exclude<SocialField, "website">, (handle: string) => string> = {
  instagram: (h) => `https://instagram.com/${h}`,
  facebook: (h) => `https://facebook.com/${h}`,
  linkedin: (h) => `https://linkedin.com/company/${h}`,
  tiktok: (h) => `https://tiktok.com/@${h}`,
  x: (h) => `https://x.com/${h}`,
};

function toUrl(value: string) {
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeSocial(field: SocialField, value: unknown): string | null | undefined {
  const text = optionalText(value);
  if (!text) return null;
  const looksLikeUrl = /^https?:\/\//i.test(text) || /^[\w-]+(\.[\w-]+)+\//.test(text);
  if (field === "website" || looksLikeUrl) return toUrl(text) ?? undefined;
  const handle = text.replace(/^@/, "");
  if (!/^[\w.\-]{1,100}$/.test(handle)) return undefined;
  return SOCIAL_BASE[field](handle);
}

export type ClientBody = {
  companyName?: string;
  contactName?: string;
  email?: string | null;
  phone?: string | null;
  status?: boolean;
  stage?: ClientStage;
} & Partial<Record<SocialField, string | null>>;

export type ClientData = Partial<{
  companyName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  status: boolean;
  stage: ClientStage;
}> &
  Partial<Record<SocialField, string | null>>;

const SOCIAL_LABELS: Record<SocialField, string> = {
  website: "la web",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  x: "X",
};

export function parseClient(body: ClientBody, partial: boolean): { data: ClientData } | { error: string } {
  const data: ClientData = {};

  for (const key of ["companyName", "contactName"] as const) {
    if (partial && body[key] === undefined) continue;
    const value = optionalText(body[key]);
    if (!value) return { error: "Completá la razón social y el contacto" };
    data[key] = value;
  }

  if (!partial || body.email !== undefined) {
    const email = optionalText(body.email)?.toLowerCase() ?? null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Email inválido" };
    data.email = email;
  }
  if (body.phone !== undefined) data.phone = optionalText(body.phone);
  if (body.status !== undefined) data.status = Boolean(body.status);

  if (body.stage !== undefined) {
    if (!Object.values(ClientStage).includes(body.stage)) return { error: "Etapa inválida" };
    data.stage = body.stage;
  }

  for (const field of SOCIAL_FIELDS) {
    if (body[field] === undefined) continue;
    const value = normalizeSocial(field, body[field]);
    if (value === undefined) return { error: `No se reconoce el usuario o link de ${SOCIAL_LABELS[field]}` };
    data[field] = value;
  }

  return { data };
}
