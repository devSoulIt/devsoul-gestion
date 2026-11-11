"use client";

import { useState } from "react";
import { Button } from "@heroui/react/button";
import { CalendarClock, Check, Pencil, Plus, Repeat, SkipForward, Trash2, Zap } from "lucide-react";
import { FinanceTabs } from "@/components/finance/finance-tabs";
import { Field, FormModal, postJson } from "@/components/form-modal";
import { useJson } from "@/lib/hooks/use-json";
import { formatAmount, formatDate, todayKey, type CurrencyCode } from "@/lib/format";
import { inputClass, selectClass, type AccountsResponse, type Category } from "../types";

type Expense = {
  id: string;
  name: string;
  amount: string;
  currency: CurrencyCode;
  frequency: "MONTHLY" | "YEARLY";
  dayOfMonth: number;
  month: number | null;
  autoRecord: boolean;
  startDate: string;
  notes: string | null;
  nextDueDate: string;
  account: { id: string; name: string; currency: CurrencyCode };
  category: { id: string; name: string };
};

type Occurrence = {
  id: string;
  period: string;
  dueDate: string;
  expectedAmount: string;
  recurringExpense: { id: string; name: string; currency: CurrencyCode; accountId: string; account: { name: string } };
};

type ExpensesResponse = { expenses: Expense[]; pending: Occurrence[] };

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function GastosFijosPage() {
  const { data, loading, reload } = useJson<ExpensesResponse>("/api/recurring-expenses");
  const accountsQ = useJson<AccountsResponse>("/api/accounts");
  const categoriesQ = useJson<Category[]>("/api/categories");
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [confirming, setConfirming] = useState<Occurrence | null>(null);
  const [skipping, setSkipping] = useState<Occurrence | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accounts = accountsQ.data?.accounts ?? [];
  const categories = (categoriesQ.data ?? []).filter((c) => c.type === "EXPENSE" && c.active);
  const expenses = data?.expenses ?? [];
  const pending = data?.pending ?? [];
  const monthlyArs = expenses
    .filter((e) => e.currency === "ARS")
    .reduce((acc, e) => acc + Number(e.amount) / (e.frequency === "YEARLY" ? 12 : 1), 0);
  const monthlyUsd = expenses
    .filter((e) => e.currency === "USD")
    .reduce((acc, e) => acc + Number(e.amount) / (e.frequency === "YEARLY" ? 12 : 1), 0);

  const remove = async (e: Expense) => {
    const res = await fetch(`/api/recurring-expenses/${e.id}`, { method: "DELETE" });
    if (!res.ok) return setError((await res.json().catch(() => null))?.error ?? "No se pudo eliminar.");
    setError(null);
    reload();
  };

  return (
    <div className="space-y-4">
      <FinanceTabs />
      <div className="glass rounded-xl p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white">Gastos fijos</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Por mes: {formatAmount(monthlyArs)}
            {monthlyUsd > 0 ? ` + ${formatAmount(monthlyUsd, "USD")}` : ""}
          </p>
        </div>
        <Button
          onPress={() => setEditing("new")}
          className="bg-acento-lima text-black font-medium text-sm px-4 rounded-lg flex-shrink-0"
        >
          <Plus size={15} />
          <span className="ml-1">Nuevo gasto</span>
        </Button>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-white/70 px-1">A pagar</h2>
        {pending.length === 0 ? (
          <div className="glass rounded-xl py-8 text-center text-sm text-white/40">
            No hay gastos fijos pendientes de confirmar.
          </div>
        ) : (
          pending.map((o) => {
            const overdue = o.dueDate.slice(0, 10) < todayKey();
            return (
              <div key={o.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">
                    {o.recurringExpense.name} · {formatAmount(o.expectedAmount, o.recurringExpense.currency)}
                  </p>
                  <p className={`text-xs ${overdue ? "text-red-400/80" : "text-white/50"}`}>
                    Vence el {formatDate(o.dueDate)} · {o.recurringExpense.account.name}
                  </p>
                </div>
                <button
                  onClick={() => setSkipping(o)}
                  title="Omitir este mes"
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <SkipForward size={17} />
                </button>
                <button
                  onClick={() => setConfirming(o)}
                  className="shrink-0 flex items-center gap-1.5 text-sm bg-acento-lima text-black font-medium rounded-lg px-3 py-2"
                >
                  <Check size={15} />
                  Pagado
                </button>
              </div>
            );
          })
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-white/70 px-1">Todos los gastos fijos</h2>
        {loading && !data ? (
          <div className="glass rounded-xl h-20 animate-pulse" />
        ) : expenses.length === 0 ? (
          <div className="glass rounded-xl py-10 text-center text-sm text-white/40">
            Cargá tus suscripciones y pagos mensuales (Claude, hosting, dominios…).
          </div>
        ) : (
          expenses.map((e) => (
            <div key={e.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/5 text-white/60 shrink-0">
                <Repeat size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                  {e.name}
                  {e.autoRecord && <Zap size={12} className="text-acento-lima shrink-0" aria-label="Se registra solo" />}
                </p>
                <p className="text-xs text-white/50 truncate">
                  {formatAmount(e.amount, e.currency)}{" "}
                  {e.frequency === "YEARLY" ? `al año (${e.dayOfMonth} ${MONTHS[(e.month ?? 1) - 1]})` : `por mes (día ${e.dayOfMonth})`}{" "}
                  · {e.category.name}
                </p>
                <p className="text-xs text-white/40 flex items-center gap-1">
                  <CalendarClock size={11} /> Próximo: {formatDate(e.nextDueDate)}
                </p>
              </div>
              <button onClick={() => setEditing(e)} title="Editar" className="text-white/40 hover:text-white">
                <Pencil size={16} />
              </button>
              <button onClick={() => remove(e)} title="Dejar de pagar" className="text-white/40 hover:text-red-400">
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </section>

      <ExpenseModal
        expense={editing}
        accounts={accounts}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
      <ConfirmModal occurrence={confirming} accounts={accounts} onClose={() => setConfirming(null)} onDone={reload} />
      <SkipModal occurrence={skipping} onClose={() => setSkipping(null)} onDone={reload} />
    </div>
  );
}

type ExpenseForm = {
  name: string;
  amount: string;
  accountId: string;
  categoryId: string;
  frequency: "MONTHLY" | "YEARLY";
  dayOfMonth: string;
  month: string;
  autoRecord: boolean;
  startDate: string;
  notes: string;
};

function ExpenseModal({
  expense,
  accounts,
  categories,
  onClose,
  onSaved,
}: {
  expense: Expense | "new" | null;
  accounts: AccountsResponse["accounts"];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ExpenseForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const key = expense === "new" ? "new" : expense?.id ?? null;

  if (key !== current) {
    setCurrent(key);
    setError(null);
    if (expense === "new") {
      setForm({
        name: "",
        amount: "",
        accountId: accounts[0]?.id ?? "",
        categoryId: categories.find((c) => c.name === "Suscripciones IA")?.id ?? categories[0]?.id ?? "",
        frequency: "MONTHLY",
        dayOfMonth: todayKey().slice(8, 10).replace(/^0/, ""),
        month: String(Number(todayKey().slice(5, 7))),
        autoRecord: false,
        startDate: todayKey(),
        notes: "",
      });
    } else if (expense) {
      setForm({
        name: expense.name,
        amount: String(Number(expense.amount)),
        accountId: expense.account.id,
        categoryId: expense.category.id,
        frequency: expense.frequency,
        dayOfMonth: String(expense.dayOfMonth),
        month: String(expense.month ?? 1),
        autoRecord: expense.autoRecord,
        startDate: expense.startDate.slice(0, 10),
        notes: expense.notes ?? "",
      });
    } else setForm(null);
  }

  const set = <K extends keyof ExpenseForm>(k: K, v: ExpenseForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const account = accounts.find((a) => a.id === form?.accountId);

  const submit = async () => {
    if (!form || !expense) return;
    setSaving(true);
    setError(null);
    const body = {
      ...form,
      amount: Number(form.amount),
      dayOfMonth: Number(form.dayOfMonth),
      month: Number(form.month),
      currency: account?.currency ?? "ARS",
    };
    const err =
      expense === "new"
        ? await postJson("/api/recurring-expenses", body)
        : await postJson(`/api/recurring-expenses/${expense.id}`, body, "PUT");
    setSaving(false);
    if (err) return setError(err);
    onSaved();
    onClose();
  };

  return (
    <FormModal
      isOpen={Boolean(expense)}
      onOpenChange={(open) => !open && onClose()}
      title={expense === "new" ? "Nuevo gasto fijo" : "Editar gasto fijo"}
      error={error}
      saving={saving}
      submitLabel="Guardar"
      onSubmit={submit}
    >
      {form && (
        <>
          <Field label="Nombre *">
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Claude Max" className={inputClass} />
          </Field>
          <div className="flex gap-3">
            <Field label={`Monto * (${account?.currency ?? "ARS"})`}>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Se paga desde *">
              <select value={form.accountId} onChange={(e) => set("accountId", e.target.value)} className={selectClass}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} className="bg-black">
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Categoría *">
            <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={selectClass}>
              {categories.map((c) => (
                <option key={c.id} value={c.id} className="bg-black">
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex gap-3">
            <Field label="Frecuencia">
              <select
                value={form.frequency}
                onChange={(e) => set("frequency", e.target.value as ExpenseForm["frequency"])}
                className={selectClass}
              >
                <option value="MONTHLY" className="bg-black">Mensual</option>
                <option value="YEARLY" className="bg-black">Anual</option>
              </select>
            </Field>
            <Field label="Día *">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={form.dayOfMonth}
                onChange={(e) => set("dayOfMonth", e.target.value)}
                className={inputClass}
              />
            </Field>
            {form.frequency === "YEARLY" && (
              <Field label="Mes">
                <select value={form.month} onChange={(e) => set("month", e.target.value)} className={selectClass}>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={String(i + 1)} className="bg-black">
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          <Field label="Desde">
            <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={inputClass} />
          </Field>
          <label className="flex items-start gap-2 text-sm text-white/80 cursor-pointer">
            <input
              type="checkbox"
              checked={form.autoRecord}
              onChange={(e) => set("autoRecord", e.target.checked)}
              className="accent-[#bdf61d] mt-0.5"
            />
            <span>
              Registrar automático
              <span className="block text-xs text-white/40">
                El día del vencimiento se carga el egreso sin pedir confirmación. Usalo si el monto nunca cambia.
              </span>
            </span>
          </label>
        </>
      )}
    </FormModal>
  );
}

function ConfirmModal({
  occurrence,
  accounts,
  onClose,
  onDone,
}: {
  occurrence: Occurrence | null;
  accounts: AccountsResponse["accounts"];
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(todayKey());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  if ((occurrence?.id ?? null) !== current) {
    setCurrent(occurrence?.id ?? null);
    if (occurrence) {
      setAmount(String(Number(occurrence.expectedAmount)));
      setAccountId(occurrence.recurringExpense.accountId);
      setDate(todayKey());
      setError(null);
    }
  }

  const account = accounts.find((a) => a.id === accountId);

  const submit = async () => {
    if (!occurrence) return;
    setSaving(true);
    setError(null);
    const err = await postJson(`/api/expense-occurrences/${occurrence.id}/confirm`, {
      amount: Number(amount),
      accountId,
      date,
    });
    setSaving(false);
    if (err) return setError(err);
    onDone();
    onClose();
  };

  return (
    <FormModal
      isOpen={Boolean(occurrence)}
      onOpenChange={(open) => !open && onClose()}
      title={occurrence ? `Pagar ${occurrence.recurringExpense.name}` : "Pagar"}
      error={error}
      saving={saving}
      submitLabel="Confirmar pago"
      onSubmit={submit}
    >
      <div className="flex gap-3">
        <Field label={`Monto pagado * (${account?.currency ?? ""})`}>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Fecha *">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <Field label="Cuenta *">
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectClass}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id} className="bg-black">
              {a.name} ({a.currency})
            </option>
          ))}
        </select>
      </Field>
      <p className="text-xs text-white/40">Si el monto cambió (por ejemplo, por la cotización), ajustalo antes de confirmar.</p>
    </FormModal>
  );
}

function SkipModal({ occurrence, onClose, onDone }: { occurrence: Occurrence | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  if ((occurrence?.id ?? null) !== current) {
    setCurrent(occurrence?.id ?? null);
    setReason("");
    setError(null);
  }

  const submit = async () => {
    if (!occurrence) return;
    if (!reason.trim()) return setError("Indicá el motivo.");
    setSaving(true);
    const err = await postJson(`/api/expense-occurrences/${occurrence.id}/skip`, { reason: reason.trim() });
    setSaving(false);
    if (err) return setError(err);
    onDone();
    onClose();
  };

  return (
    <FormModal
      isOpen={Boolean(occurrence)}
      onOpenChange={(open) => !open && onClose()}
      title="Omitir este pago"
      error={error}
      saving={saving}
      submitLabel="Omitir"
      onSubmit={submit}
    >
      <Field label="Motivo *">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="No se cobró este mes, se pagó anual…"
          className={inputClass}
        />
      </Field>
    </FormModal>
  );
}
