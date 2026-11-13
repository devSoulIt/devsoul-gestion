import type { CurrencyCode } from "@/lib/format";
import type { ComponentKindCode, InteractionTypeCode, ProjectStatusCode } from "@/lib/tasks/labels";
import type { TaskRow } from "@/components/tasks/types";
import type { SocialKey, StageCode } from "@/components/clients/social-links";

export type ContractTypeCode = "SAAS_SUBSCRIPTION" | "MAINTENANCE" | "CUSTOM_DEVELOPMENT";

export const CONTRACT_TYPE_LABELS: Record<ContractTypeCode, string> = {
  SAAS_SUBSCRIPTION: "Suscripción SaaS",
  MAINTENANCE: "Mantenimiento",
  CUSTOM_DEVELOPMENT: "Desarrollo a medida",
};

export type ComponentRow = {
  id: string;
  name: string;
  kind: ComponentKindCode;
  url: string | null;
  repoUrl: string | null;
  notes: string | null;
  active: boolean;
  software: { id: string; name: string; type: "SAAS" | "CUSTOM" } | null;
};

export type ProjectContract = {
  id: string;
  type: ContractTypeCode;
  active: boolean;
  totalAmount: string;
  currency: CurrencyCode;
  startDate: string;
  endDate: string | null;
  software: { id: string; name: string };
};

export type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatusCode;
  startDate: string | null;
  endDate: string | null;
  components: ComponentRow[];
  contracts: ProjectContract[];
  _count: { tickets: number; tasks: number };
};

export type ContractAccount = {
  agreed: number | null;
  invoiced: number;
  collected: number;
  pending: number;
  credit: number;
  balance: number;
};

export type ClientContract = ProjectContract & {
  project: { id: string; name: string } | null;
  billingMode: "FLEXIBLE" | "INSTALLMENTS";
  splitShares: { userId: string | null; percent: string }[];
  account: ContractAccount | null;
};

export type InvoiceRow = {
  id: string;
  amount: string;
  paidAmount: string;
  outstandingArs: number;
  currency: CurrencyCode;
  dueDate: string;
  paymentDate: string | null;
  period: string;
  status: "PAID" | "PENDING";
  amountArs: number;
  overdue: boolean;
  contract: { id: string; software: { name: string }; project: { id: string; name: string } | null };
};

export type TicketRow = {
  id: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  createdAt: string;
  software: { id: string; name: string };
  project: { id: string; name: string } | null;
};

export type InteractionRow = {
  id: string;
  type: InteractionTypeCode;
  note: string;
  occurredAt: string;
  user: { id: string; name: string } | null;
};

export type ClientDetail = {
  client: {
    id: string;
    companyName: string;
    contactName: string;
    email: string | null;
    phone: string | null;
    status: boolean;
    stage: StageCode;
    convertedAt: string | null;
    lastContactAt: string | null;
    createdAt: string;
  } & Record<SocialKey, string | null>;
  projects: ProjectRow[];
  contracts: ClientContract[];
  invoices: { pending: InvoiceRow[]; paid: InvoiceRow[] };
  tickets: TicketRow[];
  tasks: TaskRow[];
  interactions: InteractionRow[];
  summary: {
    pendingArs: number;
    overdueArs: number;
    overdueCount: number;
    activeContracts: number;
    openTickets: number;
    pendingTasks: number;
    overdueTasks: number;
    usdRate: number | null;
  };
};
