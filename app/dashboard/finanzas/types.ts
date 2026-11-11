import type { CurrencyCode } from "@/lib/format";

export type TxType = "INCOME" | "EXPENSE" | "TRANSFER_IN" | "TRANSFER_OUT" | "PARTNER_PAYOUT";
export type TxSource =
  | "MANUAL"
  | "INVOICE"
  | "TRANSFER"
  | "UALA_IMPORT"
  | "UALA_WEBHOOK"
  | "PAYOUT"
  | "RECURRING_EXPENSE";
export type Provider = "UALA" | "BANK" | "CASH" | "OTHER";

export type Account = {
  id: string;
  name: string;
  provider: Provider;
  currency: CurrencyCode;
  active: boolean;
  openingBalance: number;
  openingDate: string;
  balance: number;
  balanceArs: number | null;
};

export type AccountsResponse = {
  accounts: Account[];
  totalArs: number;
  usdRate: number | null;
};

export type Category = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  active: boolean;
  _count: { transactions: number };
};

export type TransactionRow = {
  id: string;
  type: TxType;
  amount: string;
  amountArs: string;
  rateToArs: string;
  currency: CurrencyCode;
  description: string | null;
  date: string;
  source: TxSource;
  transferGroupId: string | null;
  account: { id: string; name: string; currency: CurrencyCode };
  category: { id: string; name: string } | null;
  invoice: { id: string; period: string } | null;
};

export type TransactionsResponse = {
  data: TransactionRow[];
  total: number;
  page: number;
  totalPages: number;
  summary: { income: number; expense: number; net: number };
};

export const PROVIDER_LABELS: Record<Provider, string> = {
  UALA: "Ualá",
  BANK: "Banco",
  CASH: "Efectivo",
  OTHER: "Otro",
};

export const SOURCE_LABELS: Record<TxSource, string> = {
  MANUAL: "Manual",
  INVOICE: "Factura",
  TRANSFER: "Transferencia",
  UALA_IMPORT: "Import Ualá",
  UALA_WEBHOOK: "Ualá Bis",
  PAYOUT: "Pago a socio",
  RECURRING_EXPENSE: "Gasto fijo",
};

export const selectClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-acento-lima/50 transition-colors appearance-none";

export const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-acento-lima/50 transition-colors [color-scheme:dark]";
