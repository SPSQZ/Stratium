"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { MonthlyCashFlowChart } from "@/components/SimpleCharts";
import { formatCurrency, formatDateShort } from "@/lib/types";
import type { FinancialOverview } from "@/lib/finance/metrics";

interface FinancePayload {
  company: { id: string; name: string; currency: string };
  overview: FinancialOverview;
  invoices: Array<{
    id: string;
    direction: "RECEIVABLE" | "PAYABLE";
    invoiceNumber: string;
    counterpartyName: string;
    counterpartyEmail: string;
    description: string;
    amount: number;
    paidAmount: number;
    refundedAmount: number;
    issueDate: string;
    dueDate: string;
    status: string;
    department: { id: string; name: string } | null;
    budget: { id: string; name: string } | null;
    isSynthetic: boolean;
  }>;
  transactions: Array<{
    id: string;
    direction: "INCOMING" | "OUTGOING";
    amount: number;
    category: string;
    description: string;
    counterparty: string;
    occurredAt: string;
    status: string;
    source: string;
    externalRef: string | null;
    isSimulated: boolean;
    department: { name: string } | null;
  }>;
  departments: Array<{ id: string; name: string; code: string }>;
}

export default function FinancePage() {
  const { revision } = useSession();
  const [data, setData] = useState<FinancePayload | null>(null);
  const [tab, setTab] = useState<"REPORTING" | "AR" | "AP" | "BUDGETS">(
    "REPORTING"
  );
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [budgetForm, setBudgetForm] = useState({
    name: "",
    category: "DEPARTMENT",
    departmentId: "",
    fiscalPeriod: "Active Cycle",
    allocatedAmount: "",
    notes: "",
  });

  const [invoiceForm, setInvoiceForm] = useState({
    direction: "RECEIVABLE" as "RECEIVABLE" | "PAYABLE",
    counterpartyName: "",
    counterpartyEmail: "",
    description: "",
    amount: "",
    departmentId: "",
    budgetId: "",
    dueDate: "",
  });

  const loadFinance = useCallback(async () => {
    const res = await fetch("/api/finance", { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as FinancePayload;
      setData(json);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const res = await fetch("/api/finance", { cache: "no-store" });
      if (res.ok && active) {
        const json = (await res.json()) as FinancePayload;
        setData(json);
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [revision]);

  async function handleCreateBudget(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    const res = await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "BUDGET",
        ...budgetForm,
        allocatedAmount: Number(budgetForm.allocatedAmount),
        departmentId: budgetForm.departmentId || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to create budget.");
    } else {
      setShowBudgetForm(false);
      setBudgetForm({
        name: "",
        category: "DEPARTMENT",
        departmentId: "",
        fiscalPeriod: "Active Cycle",
        allocatedAmount: "",
        notes: "",
      });
      setFeedback(`Created budget "${json.budget.name}".`);
      await loadFinance();
    }
  }

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    const res = await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "INVOICE",
        ...invoiceForm,
        amount: Number(invoiceForm.amount),
        departmentId: invoiceForm.departmentId || null,
        budgetId: invoiceForm.budgetId || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to create invoice.");
    } else {
      setShowInvoiceForm(false);
      setInvoiceForm({
        direction: "RECEIVABLE",
        counterpartyName: "",
        counterpartyEmail: "",
        description: "",
        amount: "",
        departmentId: "",
        budgetId: "",
        dueDate: "",
      });
      setFeedback(
        `Issued ${json.invoice.invoiceNumber} and synced it to Financial Calendar.`
      );
      await loadFinance();
    }
  }

  async function handleRefundInvoice(invoiceId: string, invoiceNumber: string) {
    if (
      !window.confirm(
        `Confirm simulated refund for paid invoice ${invoiceNumber}? This records an outgoing refund transaction.`
      )
    ) {
      return;
    }
    setError(null);
    setFeedback(null);
    const res = await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "REFUND_INVOICE", invoiceId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Refund failed.");
    } else {
      setFeedback(`Refund recorded for ${invoiceNumber}.`);
      await loadFinance();
    }
  }

  if (!data) {
    return (
      <div className="p-8 text-sm text-[#667085]">
        Loading corporate financial records...
      </div>
    );
  }

  const { overview } = data;
  const cur = overview.currency;
  const arInvoices = data.invoices.filter((i) => i.direction === "RECEIVABLE");
  const apInvoices = data.invoices.filter((i) => i.direction === "PAYABLE");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-[#202938]">
            Corporate Financial Management
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Consistent management-finance layer connecting receivables, payables, budgets, and historical transactions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowInvoiceForm((s) => !s)}
            className="inline-flex items-center gap-1 rounded border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#202938] hover:bg-[#F7F8FA]"
          >
            <Plus className="h-3.5 w-3.5" />
            New Invoice
          </button>
          <button
            onClick={() => setShowBudgetForm((s) => !s)}
            className="inline-flex items-center gap-1 rounded bg-[#315B7D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#274A66]"
          >
            <Plus className="h-3.5 w-3.5" />
            New Budget
          </button>
        </div>
      </div>

      {feedback && (
        <div className="rounded border border-[#16A34A]/30 bg-[#16A34A]/10 px-3 py-2 text-xs text-[#16A34A]">
          {feedback}
        </div>
      )}
      {error && (
        <div className="rounded border border-[#DC5252]/30 bg-[#DC5252]/10 px-3 py-2 text-xs text-[#DC5252]">
          {error}
        </div>
      )}

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-3.5">
          <div className="text-[11px] text-[#667085]">Recorded Balance</div>
          <div className="mt-1 text-lg font-medium text-[#202938] tabular-nums">
            {formatCurrency(overview.recordedCashBalance, cur)}
          </div>
          <div className="text-[10px] text-[#667085]">Actual ledger pool</div>
        </div>
        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-3.5">
          <div className="text-[11px] text-[#667085]">Incoming Completed</div>
          <div className="mt-1 text-lg font-medium text-[#16A34A] tabular-nums">
            +{formatCurrency(overview.totalIncomingCompleted, cur)}
          </div>
        </div>
        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-3.5">
          <div className="text-[11px] text-[#667085]">Outgoing Completed</div>
          <div className="mt-1 text-lg font-medium text-[#202938] tabular-nums">
            -{formatCurrency(overview.totalOutgoingCompleted, cur)}
          </div>
        </div>
        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-3.5">
          <div className="text-[11px] text-[#667085]">Approved Budgets</div>
          <div className="mt-1 text-lg font-medium text-[#202938] tabular-nums">
            {formatCurrency(overview.approvedBudgetTotal, cur)}
          </div>
          <div className="text-[10px] text-[#667085] tabular-nums">
            Remaining: {formatCurrency(overview.remainingBudgetTotal, cur)}
          </div>
        </div>
        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-3.5">
          <div className="text-[11px] text-[#667085]">
            30d Projected Consumption
          </div>
          <div className="mt-1 text-lg font-medium text-[#D69E36] tabular-nums">
            {formatCurrency(overview.forecastedCashConsumption30d, cur)}
          </div>
          <div className="text-[10px] text-[#667085]">
            Projected (not deducted)
          </div>
        </div>
      </div>

      {/* Inline Creation Forms */}
      {showBudgetForm && (
        <form
          onSubmit={handleCreateBudget}
          className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3 text-xs"
        >
          <div className="font-medium text-sm text-[#202938]">
            Create Department / Project Budget Allocation
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              required
              placeholder="Budget Name *"
              value={budgetForm.name}
              onChange={(e) =>
                setBudgetForm((p) => ({ ...p, name: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
            <select
              value={budgetForm.category}
              onChange={(e) =>
                setBudgetForm((p) => ({ ...p, category: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            >
              <option value="DEPARTMENT">Department</option>
              <option value="PROJECT">Project</option>
              <option value="INFRASTRUCTURE">Infrastructure</option>
              <option value="OPERATING">Operating</option>
            </select>
            <select
              value={budgetForm.departmentId}
              onChange={(e) =>
                setBudgetForm((p) => ({ ...p, departmentId: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            >
              <option value="">Company-Wide</option>
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <input
              required
              type="number"
              placeholder={`Amount (${cur}) *`}
              value={budgetForm.allocatedAmount}
              onChange={(e) =>
                setBudgetForm((p) => ({
                  ...p,
                  allocatedAmount: e.target.value,
                }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowBudgetForm(false)}
              className="rounded border border-[#E5E7EB] px-3 py-1.5 text-[#667085]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-[#315B7D] px-3.5 py-1.5 font-medium text-white"
            >
              Save Budget
            </button>
          </div>
        </form>
      )}

      {showInvoiceForm && (
        <form
          onSubmit={handleCreateInvoice}
          className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3 text-xs"
        >
          <div className="font-medium text-sm text-[#202938]">
            Issue Customer Receivable or Record Vendor Payable Invoice
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={invoiceForm.direction}
              onChange={(e) =>
                setInvoiceForm((p) => ({
                  ...p,
                  direction: e.target.value as "RECEIVABLE" | "PAYABLE",
                }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            >
              <option value="RECEIVABLE">Accounts Receivable (Incoming)</option>
              <option value="PAYABLE">Accounts Payable (Outgoing)</option>
            </select>
            <input
              required
              placeholder="Customer / Vendor Name *"
              value={invoiceForm.counterpartyName}
              onChange={(e) =>
                setInvoiceForm((p) => ({
                  ...p,
                  counterpartyName: e.target.value,
                }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
            <input
              required
              type="number"
              placeholder={`Amount (${cur}) *`}
              value={invoiceForm.amount}
              onChange={(e) =>
                setInvoiceForm((p) => ({ ...p, amount: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
            />
            <input
              placeholder="Counterparty Email"
              value={invoiceForm.counterpartyEmail}
              onChange={(e) =>
                setInvoiceForm((p) => ({
                  ...p,
                  counterpartyEmail: e.target.value,
                }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
            <input
              placeholder="Description"
              value={invoiceForm.description}
              onChange={(e) =>
                setInvoiceForm((p) => ({ ...p, description: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
            <input
              type="date"
              value={invoiceForm.dueDate}
              onChange={(e) =>
                setInvoiceForm((p) => ({ ...p, dueDate: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowInvoiceForm(false)}
              className="rounded border border-[#E5E7EB] px-3 py-1.5 text-[#667085]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-[#315B7D] px-3.5 py-1.5 font-medium text-white"
            >
              Create Invoice
            </button>
          </div>
        </form>
      )}

      {/* Submodule Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E5E7EB] pb-2">
        {[
          { id: "REPORTING", label: "Reporting & Cash Flow" },
          { id: "AR", label: `Accounts Receivable (${arInvoices.length})` },
          { id: "AP", label: `Accounts Payable (${apInvoices.length})` },
          { id: "BUDGETS", label: `Budgets & Variance (${overview.budgets.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              tab === t.id
                ? "bg-[#315B7D] text-white"
                : "bg-[#FFFFFF] border border-[#E5E7EB] text-[#667085] hover:text-[#202938]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "REPORTING" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4">
            <h2 className="text-sm font-medium text-[#202938] mb-3">
              Income, Expenditure &amp; Forecasted Outflow
            </h2>
            <MonthlyCashFlowChart data={overview.monthlyCashFlow} currency={cur} />
          </div>

          <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4">
            <h2 className="text-sm font-medium text-[#202938] mb-3">
              Department-Wise Expenditure vs Allocation
            </h2>
            <div className="space-y-3">
              {overview.departmentSpend.map((d) => {
                const pct =
                  d.allocated > 0
                    ? Math.min(100, Math.round((d.actualSpent / d.allocated) * 100))
                    : 0;
                return (
                  <div key={d.departmentId} className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium text-[#202938]">
                        {d.departmentName}
                      </span>
                      <span className="text-[#667085] tabular-nums">
                        {formatCurrency(d.actualSpent, cur)} /{" "}
                        {formatCurrency(d.allocated, cur)} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded bg-[#F7F8FA] border border-[#E5E7EB] overflow-hidden">
                      <div
                        className="h-full bg-[#315B7D]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-md border border-[#E5E7EB] bg-[#FFFFFF] overflow-x-auto">
            <div className="px-4 py-3 border-b border-[#E5E7EB] text-sm font-medium text-[#202938]">
              Payment &amp; Transaction History
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F7F8FA] border-b border-[#E5E7EB] text-[#667085]">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Counterparty</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {data.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-2 text-[#667085]">
                      {formatDateShort(tx.occurredAt)}
                    </td>
                    <td className="px-4 py-2 font-medium">{tx.counterparty}</td>
                    <td className="px-4 py-2 text-[#667085]">{tx.description}</td>
                    <td className="px-4 py-2">
                      <StatusBadge label={tx.source} />
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge label={tx.status} />
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium tabular-nums ${
                        tx.direction === "INCOMING"
                          ? "text-[#16A34A]"
                          : "text-[#202938]"
                      }`}
                    >
                      {tx.direction === "INCOMING" ? "+" : "-"}
                      {formatCurrency(tx.amount, cur)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(tab === "AR" || tab === "AP") && (
        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F7F8FA] border-b border-[#E5E7EB] text-[#667085]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Invoice #</th>
                <th className="px-4 py-2.5 font-medium">Counterparty</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 font-medium">Due Date</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                <th className="px-4 py-2.5 font-medium text-right">Paid</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {(tab === "AR" ? arInvoices : apInvoices).map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-2.5 font-medium">
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-4 py-2.5">{inv.counterpartyName}</td>
                  <td className="px-4 py-2.5 text-[#667085] max-w-xs truncate">
                    {inv.description}
                  </td>
                  <td className="px-4 py-2.5 text-[#667085]">
                    {formatDateShort(inv.dueDate)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={inv.status} />
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                    {formatCurrency(inv.amount, cur)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#16A34A]">
                    {formatCurrency(inv.paidAmount, cur)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {tab === "AR" && inv.status === "PAID" && (
                      <button
                        onClick={() =>
                          void handleRefundInvoice(inv.id, inv.invoiceNumber)
                        }
                        className="inline-flex items-center gap-1 rounded border border-[#E5E7EB] px-2 py-1 text-[11px] text-[#667085] hover:text-[#DC5252]"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Refund
                      </button>
                    )}
                    {tab === "AR" && inv.status !== "PAID" && inv.status !== "REFUNDED" && (
                      <a
                        href="/payments"
                        className="text-[11px] font-medium text-[#315B7D] hover:underline"
                      >
                        Collect via PayPal →
                      </a>
                    )}
                    {tab === "AP" && inv.status !== "PAID" && (
                      <a
                        href="/payments"
                        className="text-[11px] font-medium text-[#315B7D] hover:underline"
                      >
                        Request Payment →
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "BUDGETS" && (
        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F7F8FA] border-b border-[#E5E7EB] text-[#667085]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Budget Name</th>
                <th className="px-4 py-2.5 font-medium">Department</th>
                <th className="px-4 py-2.5 font-medium">Linked Decision</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Allocated</th>
                <th className="px-4 py-2.5 font-medium text-right">Actual</th>
                <th className="px-4 py-2.5 font-medium text-right">Pending</th>
                <th className="px-4 py-2.5 font-medium text-right">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] tabular-nums">
              {overview.budgets.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-2.5 font-medium">{b.name}</td>
                  <td className="px-4 py-2.5 text-[#667085]">
                    {b.departmentName}
                  </td>
                  <td className="px-4 py-2.5 text-[#667085]">
                    {b.decisionTitle ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={b.status} />
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    {formatCurrency(b.allocatedAmount, cur)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {formatCurrency(b.actualSpent, cur)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[#D69E36]">
                    {formatCurrency(b.pendingCommitted, cur)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-[#16A34A]">
                    {formatCurrency(b.remainingAmount, cur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

