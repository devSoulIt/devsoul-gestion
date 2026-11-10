import { requireUser } from "@/lib/auth/session";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <>
      <ServiceWorkerRegistrar />
      <DashboardShell user={{ name: user.name, role: user.role }}>{children}</DashboardShell>
    </>
  );
}
