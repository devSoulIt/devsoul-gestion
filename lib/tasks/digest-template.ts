import { formatDate } from "@/lib/format";
import { TASK_TYPE_LABELS } from "./labels";

export type DigestTask = {
  title: string;
  type: keyof typeof TASK_TYPE_LABELS;
  dueAt: Date;
  overdue: boolean;
  clientName: string | null;
  projectName: string | null;
};

const ACCENT = "#bdf61d";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function context(task: DigestTask) {
  return [task.clientName, task.projectName].filter(Boolean).join(" · ");
}

export function renderDigestEmail({ name, tasks, appUrl }: { name: string; tasks: DigestTask[]; appUrl: string | null }) {
  const overdue = tasks.filter((t) => t.overdue);
  const today = tasks.filter((t) => !t.overdue);
  const subject =
    overdue.length > 0
      ? `Tenés ${tasks.length} recordatorio${tasks.length === 1 ? "" : "s"} (${overdue.length} vencido${overdue.length === 1 ? "" : "s"})`
      : `Tenés ${tasks.length} recordatorio${tasks.length === 1 ? "" : "s"} para hoy`;

  const section = (title: string, list: DigestTask[], color: string) =>
    list.length === 0
      ? ""
      : `<tr><td style="padding:16px 24px 4px;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${color};">${title}</td></tr>
        ${list
          .map(
            (t) => `<tr><td style="padding:6px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #222222;border-radius:10px;">
            <tr><td style="padding:10px 14px;">
              <div style="font-size:14px;color:#ffffff;font-weight:bold;">${escapeHtml(t.title)}</div>
              <div style="font-size:12px;color:#888888;margin-top:2px;">${TASK_TYPE_LABELS[t.type]} · ${formatDate(t.dueAt)}${context(t) ? ` · ${escapeHtml(context(t))}` : ""}</div>
            </td></tr>
          </table>
        </td></tr>`
          )
          .join("")}`;

  const link = appUrl ? `${appUrl.replace(/\/$/, "")}/dashboard/recordatorios` : null;

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#000000;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0d0d0d;border:1px solid #222222;border-radius:16px;">
        <tr><td style="padding:24px 24px 8px;">
          <span style="font-size:22px;font-weight:bold;color:${ACCENT};letter-spacing:-0.5px;">Devsoul</span>
        </td></tr>
        <tr><td style="padding:8px 24px 0;">
          <h1 style="margin:0 0 8px;font-size:20px;color:#ffffff;">Tus recordatorios de hoy</h1>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#cccccc;">Hola ${escapeHtml(name)}, esto es lo que tenés pendiente.</p>
        </td></tr>
        ${section("Vencidos", overdue, "#f87171")}
        ${section("Hoy", today, ACCENT)}
        ${
          link
            ? `<tr><td align="center" style="padding:20px 24px 0;">
          <a href="${escapeHtml(link)}" style="display:inline-block;background:${ACCENT};color:#000000;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 28px;border-radius:10px;">Ver recordatorios</a>
        </td></tr>`
            : ""
        }
        <tr><td style="padding:20px 24px 24px;">
          <p style="margin:0;font-size:12px;color:#777777;">Resumen diario automático de Devsoul Gestión.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const line = (t: DigestTask) =>
    `- ${t.title} (${TASK_TYPE_LABELS[t.type]}, ${formatDate(t.dueAt)}${context(t) ? `, ${context(t)}` : ""})`;
  const text = [
    `Hola ${name}, esto es lo que tenés pendiente.`,
    ...(overdue.length ? ["", "VENCIDOS", ...overdue.map(line)] : []),
    ...(today.length ? ["", "HOY", ...today.map(line)] : []),
    ...(link ? ["", `Ver recordatorios: ${link}`] : []),
  ].join("\n");

  return { subject, html, text };
}
