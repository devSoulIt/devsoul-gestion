import { requireUser } from "@/lib/auth/session";
import { InstallAppCard } from "@/components/pwa/install-app-card";
import { ChangePasswordForm } from "./change-password-form";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Socio (Owner)",
  MANAGER: "Manager",
  FINANCIAL: "Finanzas",
};

export default async function PerfilPage() {
  const user = await requireUser();

  const fields = [
    { label: "Nombre", value: user.name },
    { label: "Email", value: user.email },
    { label: "Rol", value: ROLE_LABELS[user.role] ?? user.role },
    { label: "Alta", value: user.createdAt.toLocaleDateString("es-AR") },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="glass rounded-xl p-4">
        <h1 className="text-xl font-bold text-white">Perfil</h1>
      </div>

      <section className="glass rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((f) => (
          <div key={f.label}>
            <p className="text-xs text-white/40">{f.label}</p>
            <p className="text-sm text-white break-all">{f.value}</p>
          </div>
        ))}
      </section>

      <section className="glass rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">App en el celular</h2>
          <p className="text-xs text-white/40 mt-1">Instalá Devsoul en la pantalla de inicio para abrirla como una app.</p>
        </div>
        <InstallAppCard />
      </section>

      <section className="glass rounded-xl p-5 space-y-4">
        <h2 className="text-base font-semibold text-white">Cambiar contraseña</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
