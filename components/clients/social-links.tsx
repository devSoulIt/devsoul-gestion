import { Globe } from "lucide-react";

export const SOCIAL_KEYS = ["website", "instagram", "facebook", "linkedin", "tiktok", "x"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];
export type Socials = Partial<Record<SocialKey, string | null>>;

export const SOCIAL_META: Record<SocialKey, { label: string; short: string; placeholder: string; className: string }> = {
  website: { label: "Sitio web", short: "Web", placeholder: "clinica.com", className: "text-white/70 border-white/15 bg-white/5" },
  instagram: { label: "Instagram", short: "IG", placeholder: "@usuario o link", className: "text-pink-300 border-pink-500/30 bg-pink-500/10" },
  facebook: { label: "Facebook", short: "FB", placeholder: "página o link", className: "text-blue-300 border-blue-500/30 bg-blue-500/10" },
  linkedin: { label: "LinkedIn", short: "in", placeholder: "empresa o link", className: "text-sky-300 border-sky-500/30 bg-sky-500/10" },
  tiktok: { label: "TikTok", short: "TT", placeholder: "@usuario o link", className: "text-white/80 border-white/20 bg-white/5" },
  x: { label: "X (Twitter)", short: "X", placeholder: "@usuario o link", className: "text-white/80 border-white/20 bg-white/5" },
};

export const STAGE_META = {
  PROSPECT: {
    label: "Posible cliente",
    hint: "Hubo un acercamiento o reunión, todavía no trabajamos juntos.",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  CLIENT: {
    label: "Cliente",
    hint: "Ya estamos trabajando: tiene o tuvo contratos.",
    className: "border-acento-lima/40 bg-acento-lima/10 text-acento-lima",
  },
} as const;

export type StageCode = keyof typeof STAGE_META;

export function StageBadge({ stage }: { stage: StageCode }) {
  return (
    <span className={`rounded-full border px-2 py-px text-[11px] whitespace-nowrap ${STAGE_META[stage].className}`}>
      {STAGE_META[stage].label}
    </span>
  );
}

export function SocialLinks({ socials, size = "sm" }: { socials: Socials; size?: "sm" | "md" }) {
  const present = SOCIAL_KEYS.filter((key) => socials[key]);
  if (present.length === 0) return null;
  const pad = size === "md" ? "px-2 py-1 text-xs" : "px-1.5 py-px text-[10px]";
  return (
    <div className="flex flex-wrap gap-1.5">
      {present.map((key) => (
        <a
          key={key}
          href={socials[key]!}
          target="_blank"
          rel="noopener noreferrer"
          title={`${SOCIAL_META[key].label}: ${socials[key]}`}
          onClick={(e) => e.stopPropagation()}
          className={`flex items-center gap-1 rounded-md border font-semibold transition-opacity hover:opacity-80 ${pad} ${SOCIAL_META[key].className}`}
        >
          {key === "website" && <Globe size={size === "md" ? 12 : 10} />}
          {SOCIAL_META[key].short}
        </a>
      ))}
    </div>
  );
}
