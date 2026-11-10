"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ExternalLink,
  Plus,
  Send,
  ShieldAlert,
  Webhook,
  XCircle,
} from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDateShort } from "@/lib/types";

interface PaymentRequestItem {
  id: string;
  title: string;
  direction: string;
  counterpartyName: string;
  counterpartyEmail: string;
  amount: number;
  currency: string;
  category: string;
  purpose: string;
  status: string;
  aiValidationSummary: string;
  aiRiskFlagsJson: string;
  requiresDeptApproval: boolean;
  requiresFinanceApproval: boolean;
  requiresExecApproval: boolean;
  provider: string;
  providerReference: string | null;
  isSimulated: boolean;
  dueDate: string | null;
  department: { id: string; name: string } | null;
  budget: { id: string; name: string } | null;
  invoice: { id: string; invoiceNumber: string } | null;
  requestedBy: { id: string; name: string; role: string };
  approvalActions: Array<{
    id: string;
    actorName: string;
    actorRole: string;
    action: string;
    comment: string;
    createdAt: string;
  }>;
}

interface PaymentsPayload {
  company: { id: string; name: string; currency: string };
  currentUser: { id: string; name: string; role: string };
  paypalStatus: {
    sandboxConfigured: boolean;
    payoutsEnabled: boolean;
    env: string;
  };
  paymentRequests: PaymentRequestItem[];
  openReceivables: Array<{
    id: string;
    invoiceNumber: string;
    counterpartyName: string;
    description: string;
    amount: number;
    paidAmount: number;
    status: string;
    paypalOrderId: string | null;
    dueDate: string;
  }>;
  openPayables: Array<{
    id: string;
    invoiceNumber: string;
    counterpartyName: string;
    amount: number;
  }>;
  budgets: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  employees: Array<{
    id: string;
    name: string;
    email: string;
    title: string;
    role: string;
    departmentId: string | null;
    employmentType: string;
    monthlySalary: number;
    payCycle: string;
    payDayOfMonth: number;
    payoutEmail: string;
    nextPayDate: string | null;
    payrollStatus: string;
  }>;
  transactions: Array<{
    id: string;
    direction: string;
    amount: number;
    description: string;
    counterparty: string;
    occurredAt: string;
    status: string;
    source: string;
    externalRef: string | null;
    isSimulated: boolean;
  }>;
  webhookEvents: Array<{
    id: string;
    eventType: string;
    verified: boolean;
    verificationDetail: string;
    reconciledOrderId: string | null;
    status: string;
    createdAt: string;
  }>;
}

function buildEmployeeReqPatch(
  emp: PaymentsPayload["employees"][number]
) {
  return {
    selectedEmployeeId: emp.id,
    category: "Employee Payroll",
    title: `${emp.payCycle === "MONTHLY" ? "Monthly" : emp.payCycle} Salary — ${emp.name}`,
    counterpartyName: emp.name,
    counterpartyEmail: emp.payoutEmail || emp.email,
    amount: emp.monthlySalary > 0 ? String(emp.monthlySalary) : "",
    departmentId: emp.departmentId || "",
    dueDate: emp.nextPayDate ? emp.nextPayDate.slice(0, 10) : "",
    purpose: `Scheduled ${emp.payCycle.toLowerCase()} payroll (${emp.employmentType.replace(
      "_",
      " "
    )}) — ${emp.title}`,
  };
}

function PaymentsContent() {
  const searchParams = useSearchParams();
  const returnSuccess = searchParams.get("paypalOrderSuccess") === "true";
  const returnCancel = searchParams.get("paypalOrderCancel") === "true";
  const returnInvoiceId = searchParams.get("invoiceId") || "";
  const returnOrderId = searchParams.get("token") || "";
  const prefillEmployeeId = searchParams.get("employeeId") || "";

  const { revision, refreshSession } = useSession();
  const [data, setData] = useState<PaymentsPayload | null>(null);
  const [tab, setTab] = useState<"APPROVALS" | "INCOMING" | "LEDGER">(() =>
    returnSuccess || returnCancel ? "INCOMING" : "APPROVALS"
  );
  const [showRequestForm, setShowRequestForm] = useState(
    Boolean(prefillEmployeeId)
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeOrderInfo, setActiveOrderInfo] = useState<{
    invoiceId: string;
    invoiceNumber: string;
    orderId: string;
    approveUrl: string | null;
    isSimulated: boolean;
    note: string;
    rawPayload?: Record<string, unknown>;
  } | null>(null);

  const [reqForm, setReqForm] = useState({
    selectedEmployeeId: "",
    title: "",
    counterpartyName: "",
    counterpartyEmail: "",
    amount: "",
    category: "Vendor Payment",
    purpose: "",
    departmentId: "",
    budgetId: "",
    invoiceId: "",
    dueDate: "",
  });

  const loadPayments = useCallback(async () => {
    const res = await fetch("/api/payments", { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as PaymentsPayload;
      setData(json);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const res = await fetch("/api/payments", { cache: "no-store" });
      if (res.ok && active) {
        const json = (await res.json()) as PaymentsPayload;
        setData(json);
        if (prefillEmployeeId) {
          const match = json.employees.find((e) => e.id === prefillEmployeeId);
          if (match) {
            setShowRequestForm(true);
            setReqForm((prev) => ({
              ...prev,
              ...buildEmployeeReqPatch(match),
            }));
          }
        }
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [revision, prefillEmployeeId]);

  async function handleCreateRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: reqForm.title,
        counterpartyName: reqForm.counterpartyName,
        counterpartyEmail: reqForm.counterpartyEmail,
        category: reqForm.category,
        purpose: reqForm.purpose,
        amount: Number(reqForm.amount),
        departmentId: reqForm.departmentId || null,
        budgetId: reqForm.budgetId || null,
        invoiceId: reqForm.invoiceId || null,
        dueDate: reqForm.dueDate || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to create payment request.");
    } else {
      setShowRequestForm(false);
      setReqForm({
        selectedEmployeeId: "",
        title: "",
        counterpartyName: "",
        counterpartyEmail: "",
        amount: "",
        category: "Vendor Payment",
        purpose: "",
        departmentId: "",
        budgetId: "",
        invoiceId: "",
        dueDate: "",
      });
      setFeedback(
        `Submitted payment request "${json.paymentRequest.title}" for human approval chain.`
      );
      await loadPayments();
    }
  }

  async function handleWorkflowAction(
    pr: PaymentRequestItem,
    action: "APPROVE" | "REJECT" | "EXECUTE"
  ) {
    const confirmMsg =
      action === "EXECUTE"
        ? `Confirm human execution of "${pr.title}" (${formatCurrency(
            pr.amount,
            pr.currency
          )}) to ${pr.counterpartyName}?`
        : action === "APPROVE"
        ? `Confirm ${data?.currentUser.role} approval for "${pr.title}" (${formatCurrency(
            pr.amount,
            pr.currency
          )})?`
        : `Confirm rejection of "${pr.title}"?`;

    if (!window.confirm(confirmMsg)) return;

    setError(null);
    setFeedback(null);
    const res = await fetch(`/api/payments/${pr.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.message || json.error || "Action blocked by policy.");
    } else {
      setFeedback(json.message);
      await Promise.all([loadPayments(), refreshSession()]);
    }
  }

  async function handleCreatePayPalOrder(invoiceId: string) {
    setError(null);
    setFeedback(null);
    const res = await fetch("/api/paypal/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to create PayPal order.");
    } else {
      setActiveOrderInfo({
        invoiceId: json.invoiceId,
        invoiceNumber: json.invoiceNumber,
        orderId: json.order.orderId,
        approveUrl: json.order.approveUrl,
        isSimulated: json.order.isSimulated,
        note: json.order.note,
        rawPayload: json.order.rawPayload,
      });
      setFeedback(
        `PayPal Order ${json.order.orderId} created for ${json.invoiceNumber}.`
      );
      await loadPayments();
    }
  }

  async function handleCaptureOrder(orderId: string, invoiceId: string) {
    if (
      !window.confirm(
        `Confirm capturing PayPal order ${orderId} and reconciling the invoice?`
      )
    ) {
      return;
    }
    setError(null);
    setFeedback(null);
    const res = await fetch("/api/paypal/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, invoiceId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Capture failed.");
    } else {
      setActiveOrderInfo(null);
      setFeedback(
        `Captured ${json.capture.captureId} (${json.capture.provider}) — invoice reconciled as ${json.invoice.status} and cash ledger updated.`
      );
      await Promise.all([loadPayments(), refreshSession()]);
    }
  }

  async function handleTestWebhook(orderId: string, amount: number) {
    setError(null);
    setFeedback(null);
    const res = await fetch("/api/paypal/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: {
          id: `WH-CAP-${Date.now().toString(36).toUpperCase()}`,
          amount: { value: amount.toFixed(2), currency_code: "USD" },
          supplementary_data: { related_ids: { order_id: orderId } },
        },
      }),
    });
    const json = await res.json();
    if (res.ok) {
      setActiveOrderInfo(null);
      setFeedback(
        `Webhook processed (${json.webhookEvent.status}): ${json.verification.detail}`
      );
      await Promise.all([loadPayments(), refreshSession()]);
    }
  }

  if (!data) {
    return (
      <div className="p-8 text-sm text-[#667085]">
        Loading payments &amp; PayPal sandbox workspace...
      </div>
    );
  }

  const cur = data.company.currency;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-[#202938]">
            Payments, Approvals &amp; PayPal Integration
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Human-authorized payment pipeline and PayPal REST v2 Sandbox order, capture, webhook verification, and reconciliation.
          </p>
        </div>

        <button
          onClick={() => setShowRequestForm((s) => !s)}
          className="inline-flex items-center gap-1 rounded bg-[#315B7D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#274A66]"
        >
          <Plus className="h-3.5 w-3.5" />
          New Payment Request
        </button>
      </div>

      {/* Explicit Integration Status Banner */}
      <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge
            label={
              data.paypalStatus.sandboxConfigured
                ? "PAYPAL_SANDBOX"
                : "PAYPAL_SIMULATED"
            }
          />
          <span className="text-[#202938]">
            {data.paypalStatus.sandboxConfigured
              ? "PayPal Sandbox API credentials detected — Checkout Orders use live api-m.sandbox.paypal.com."
              : "PayPal Sandbox credentials not set in .env — running in explicitly labeled Sandbox Simulation mode (never pretended as live transfers)."}
          </span>
        </div>
        <span className="text-[11px] text-[#667085]">
          Outgoing Payouts:{" "}
          {data.paypalStatus.payoutsEnabled
            ? "PayPal Payouts Sandbox Enabled"
            : "Simulated Adapter Active"}
        </span>
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

      {showRequestForm && (
        <form
          onSubmit={handleCreateRequest}
          className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-sm text-[#202938]">
              Submit Outgoing Payment Request (AI Validates · Humans Approve)
            </span>
            <span className="text-[11px] text-[#667085]">
              Select an employee to auto-fill salary &amp; pay date
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Payment Category
              </label>
              <select
                value={reqForm.category}
                onChange={(e) =>
                  setReqForm((p) => ({ ...p, category: e.target.value }))
                }
                className="w-full rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2.5 py-1.5"
              >
                <option value="Vendor Payment">Vendor Payment</option>
                <option value="Employee Payroll">
                  Employee Salary &amp; Payroll
                </option>
                <option value="Employee Reimbursement">
                  Employee Reimbursement
                </option>
                <option value="Infrastructure & CapEx">
                  Infrastructure &amp; CapEx
                </option>
                <option value="Operations & G&A">Operations &amp; G&amp;A</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Employee Payroll Preset (Optional)
              </label>
              <select
                value={reqForm.selectedEmployeeId}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) {
                    setReqForm((p) => ({ ...p, selectedEmployeeId: "" }));
                    return;
                  }
                  const emp = data.employees.find((x) => x.id === id);
                  if (emp) {
                    setReqForm((p) => ({
                      ...p,
                      ...buildEmployeeReqPatch(emp),
                    }));
                  }
                }}
                className="w-full rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2.5 py-1.5"
              >
                <option value="">Manual Vendor / Counterparty Entry</option>
                {data.employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.title}
                    {emp.monthlySalary > 0
                      ? ` · ${formatCurrency(emp.monthlySalary, cur)}/${emp.payCycle.toLowerCase()}`
                      : ""}
                    )
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Scheduled Due / Pay Date
              </label>
              <input
                type="date"
                value={reqForm.dueDate}
                onChange={(e) =>
                  setReqForm((p) => ({ ...p, dueDate: e.target.value }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
              />
            </div>
            <input
              required
              placeholder="Request Title *"
              value={reqForm.title}
              onChange={(e) =>
                setReqForm((p) => ({ ...p, title: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
            <input
              required
              placeholder="Vendor / Employee Name *"
              value={reqForm.counterpartyName}
              onChange={(e) =>
                setReqForm((p) => ({ ...p, counterpartyName: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
            <input
              required
              type="number"
              step="0.01"
              placeholder={`Amount (${cur}) *`}
              value={reqForm.amount}
              onChange={(e) =>
                setReqForm((p) => ({ ...p, amount: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
            />
            <input
              placeholder="Recipient PayPal Email (Sandbox)"
              value={reqForm.counterpartyEmail}
              onChange={(e) =>
                setReqForm((p) => ({ ...p, counterpartyEmail: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
            <select
              value={reqForm.departmentId}
              onChange={(e) =>
                setReqForm((p) => ({ ...p, departmentId: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2.5 py-1.5"
            >
              <option value="">Select Department (Optional)</option>
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              value={reqForm.budgetId}
              onChange={(e) =>
                setReqForm((p) => ({ ...p, budgetId: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2.5 py-1.5"
            >
              <option value="">Select Linked Budget (Optional)</option>
              {data.budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              value={reqForm.invoiceId}
              onChange={(e) =>
                setReqForm((p) => ({ ...p, invoiceId: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2.5 py-1.5 md:col-span-3"
            >
              <option value="">Select Linked AP Invoice (Optional)</option>
              {data.openPayables.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} — {inv.counterpartyName} (
                  {formatCurrency(inv.amount, cur)})
                </option>
              ))}
            </select>
          </div>
          <input
            placeholder="Business Purpose / Justification"
            value={reqForm.purpose}
            onChange={(e) =>
              setReqForm((p) => ({ ...p, purpose: e.target.value }))
            }
            className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRequestForm(false)}
              className="rounded border border-[#E5E7EB] px-3 py-1.5 text-[#667085]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-[#315B7D] px-3.5 py-1.5 font-medium text-white"
            >
              Submit for AI Validation &amp; Human Approval
            </button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E5E7EB] pb-2">
        <button
          onClick={() => setTab("APPROVALS")}
          className={`rounded px-3 py-1.5 text-xs font-medium ${
            tab === "APPROVALS"
              ? "bg-[#315B7D] text-white"
              : "bg-[#FFFFFF] border border-[#E5E7EB] text-[#667085]"
          }`}
        >
          Outgoing Approvals &amp; Payouts ({data.paymentRequests.length})
        </button>
        <button
          onClick={() => setTab("INCOMING")}
          className={`rounded px-3 py-1.5 text-xs font-medium ${
            tab === "INCOMING"
              ? "bg-[#315B7D] text-white"
              : "bg-[#FFFFFF] border border-[#E5E7EB] text-[#667085]"
          }`}
        >
          Incoming PayPal Checkout ({data.openReceivables.length})
        </button>
        <button
          onClick={() => setTab("LEDGER")}
          className={`rounded px-3 py-1.5 text-xs font-medium ${
            tab === "LEDGER"
              ? "bg-[#315B7D] text-white"
              : "bg-[#FFFFFF] border border-[#E5E7EB] text-[#667085]"
          }`}
        >
          Webhooks &amp; Reconciliation ({data.webhookEvents.length})
        </button>
      </div>

      {/* TAB 1: Outgoing Payment Approval Chain */}
      {tab === "APPROVALS" && (
        <div className="space-y-3">
          {data.paymentRequests.map((pr) => {
            const riskFlags: string[] = JSON.parse(pr.aiRiskFlagsJson || "[]");
            const isSelf = pr.requestedBy.id === data.currentUser.id;
            const canApproveStep =
              pr.status === "PENDING_DEPT_APPROVAL" ||
              pr.status === "PENDING_FINANCE_APPROVAL" ||
              pr.status === "PENDING_EXEC_APPROVAL";
            const canExecute = pr.status === "APPROVED_READY_FOR_EXECUTION";

            return (
              <div
                key={pr.id}
                className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3 text-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#202938]">
                        {pr.title}
                      </span>
                      <StatusBadge label={pr.status} />
                      <StatusBadge label={pr.provider} />
                    </div>
                    <div className="text-[#667085] mt-0.5">
                      To: <strong>{pr.counterpartyName}</strong> · Requested by{" "}
                      {pr.requestedBy.name} ({pr.requestedBy.role}) ·{" "}
                      {pr.department?.name ?? "Company-Wide"}
                      {pr.budget ? ` · Budget: ${pr.budget.name}` : ""}
                      {pr.invoice ? ` · Invoice: ${pr.invoice.invoiceNumber}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-medium text-[#202938] tabular-nums">
                      {formatCurrency(pr.amount, pr.currency)}
                    </div>
                    {pr.providerReference && (
                      <div className="text-[11px] text-[#667085]">
                        Ref: {pr.providerReference}
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Advisory Validation Box */}
                <div className="rounded border border-[#E5E7EB] bg-[#F7F8FA] p-2.5 space-y-1">
                  <div className="font-medium text-[#315B7D]">
                    AI Advisory Validation (Cannot Approve or Execute)
                  </div>
                  <p className="text-[#202938]">{pr.aiValidationSummary}</p>
                  {riskFlags.map((flag, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 text-[#A16207]"
                    >
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                      <span>{flag}</span>
                    </div>
                  ))}
                </div>

                {/* Approval Audit Trail */}
                <div className="flex flex-wrap gap-2">
                  {pr.approvalActions.map((act) => (
                    <div
                      key={act.id}
                      className="rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2.5 py-1.5 text-[11px]"
                    >
                      <span className="font-medium text-[#202938]">
                        {act.action.replace(/_/g, " ")}
                      </span>{" "}
                      <span className="text-[#667085]">
                        by {act.actorName} ({act.actorRole})
                      </span>
                    </div>
                  ))}
                </div>

                {/* Human Action Controls */}
                <div className="pt-2 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-[#667085]">
                    {isSelf && canApproveStep
                      ? "Self-approval blocked by policy: switch to an authorized approver in the top demo role switcher to advance."
                      : "Switch roles in the top bar (Department Manager → Finance Manager → CFO/CEO → Payment Executor) to test RBAC enforcement."}
                  </span>

                  <div className="flex items-center gap-2">
                    {canApproveStep && (
                      <>
                        <button
                          onClick={() =>
                            void handleWorkflowAction(pr, "REJECT")
                          }
                          className="inline-flex items-center gap-1 rounded border border-[#DC5252]/40 px-2.5 py-1 text-xs font-medium text-[#DC5252] hover:bg-[#DC5252]/10"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </button>
                        <button
                          onClick={() =>
                            void handleWorkflowAction(pr, "APPROVE")
                          }
                          className="inline-flex items-center gap-1 rounded bg-[#315B7D] px-3 py-1 text-xs font-medium text-white hover:bg-[#274A66]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve Current Stage
                        </button>
                      </>
                    )}
                    {canExecute && (
                      <button
                        onClick={() =>
                          void handleWorkflowAction(pr, "EXECUTE")
                        }
                        className="inline-flex items-center gap-1 rounded bg-[#16A34A] px-3 py-1 text-xs font-medium text-white hover:bg-[#15803D]"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Execute Authorized Payout
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: Incoming PayPal Checkout */}
      {tab === "INCOMING" && (
        <div className="space-y-4">
          {returnSuccess && returnOrderId && (
            <div className="rounded-md border border-[#16A34A]/35 bg-[#16A34A]/10 p-4 space-y-2 text-xs">
              <div className="font-medium text-sm text-[#16A34A]">
                PayPal Sandbox Buyer Approval Completed (Order {returnOrderId})
              </div>
              <p className="text-[#202938]">
                Click below to capture the authorized funds via PayPal REST v2 and reconcile the linked receivable invoice.
              </p>
              <button
                onClick={() =>
                  void handleCaptureOrder(returnOrderId, returnInvoiceId)
                }
                className="rounded bg-[#16A34A] px-3.5 py-1.5 font-medium text-white hover:bg-[#15803D]"
              >
                Capture Approved Order {returnOrderId}
              </button>
            </div>
          )}
          {returnCancel && (
            <div className="rounded-md border border-[#D69E36]/35 bg-[#D69E36]/10 p-3 text-xs text-[#A16207]">
              PayPal Sandbox checkout was cancelled by the buyer before approval. No funds were captured.
            </div>
          )}
          {activeOrderInfo && (
            <div className="rounded-md border border-[#3B82F6]/35 bg-[#3B82F6]/5 p-4 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium text-sm text-[#202938]">
                  Active PayPal Order: {activeOrderInfo.orderId} (
                  {activeOrderInfo.invoiceNumber})
                </div>
                <StatusBadge
                  label={
                    activeOrderInfo.isSimulated
                      ? "PAYPAL_SIMULATED"
                      : "PAYPAL_SANDBOX"
                  }
                />
              </div>
              <p className="text-[#202938]">{activeOrderInfo.note}</p>
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {activeOrderInfo.approveUrl && (
                  <a
                    href={activeOrderInfo.approveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-[#315B7D] bg-[#FFFFFF] px-3 py-1.5 font-medium text-[#315B7D]"
                  >
                    Open PayPal Sandbox Buyer Approval
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  onClick={() =>
                    void handleCaptureOrder(
                      activeOrderInfo.orderId,
                      activeOrderInfo.invoiceId
                    )
                  }
                  className="rounded bg-[#16A34A] px-3.5 py-1.5 font-medium text-white hover:bg-[#15803D]"
                >
                  Capture Order &amp; Reconcile Invoice
                </button>
                <button
                  onClick={() => {
                    const inv = data.openReceivables.find(
                      (i) => i.id === activeOrderInfo.invoiceId
                    );
                    void handleTestWebhook(
                      activeOrderInfo.orderId,
                      inv ? inv.amount - inv.paidAmount : 100
                    );
                  }}
                  className="inline-flex items-center gap-1 rounded border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-1.5 font-medium text-[#202938]"
                >
                  <Webhook className="h-3.5 w-3.5" />
                  Simulate Webhook Reconciliation
                </button>
              </div>
              {activeOrderInfo.rawPayload && (
                <details className="pt-1">
                  <summary className="cursor-pointer text-[11px] font-medium text-[#315B7D]">
                    Inspect PayPal REST v2 Order Payload
                  </summary>
                  <pre className="mt-1.5 max-h-40 overflow-auto rounded border border-[#E5E7EB] bg-[#FFFFFF] p-2 text-[11px] text-[#202938]">
                    {JSON.stringify(activeOrderInfo.rawPayload, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F7F8FA] border-b border-[#E5E7EB] text-[#667085]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Invoice #</th>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="px-4 py-2.5 font-medium">Due</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">
                    Open Amount
                  </th>
                  <th className="px-4 py-2.5 font-medium text-right">
                    PayPal Checkout Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {data.openReceivables.map((inv) => {
                  const openAmt = Math.max(0, inv.amount - inv.paidAmount);
                  return (
                    <tr key={inv.id}>
                      <td className="px-4 py-2.5 font-medium">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-4 py-2.5">{inv.counterpartyName}</td>
                      <td className="px-4 py-2.5 text-[#667085] max-w-xs">
                        {inv.description}
                      </td>
                      <td className="px-4 py-2.5 text-[#667085]">
                        {formatDateShort(inv.dueDate)}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge label={inv.status} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                        {formatCurrency(openAmt, cur)}
                      </td>
                      <td className="px-4 py-2.5 text-right space-x-2">
                        {inv.status !== "PAID" && inv.status !== "REFUNDED" ? (
                          <>
                            <button
                              onClick={() => void handleCreatePayPalOrder(inv.id)}
                              className="rounded bg-[#315B7D] px-3 py-1 text-xs font-medium text-white hover:bg-[#274A66]"
                            >
                              Create PayPal Order
                            </button>
                            {inv.paypalOrderId && (
                              <button
                                onClick={() =>
                                  void handleCaptureOrder(
                                    inv.paypalOrderId!,
                                    inv.id
                                  )
                                }
                                className="rounded bg-[#16A34A] px-2.5 py-1 text-xs font-medium text-white"
                              >
                                Capture
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-[#16A34A]">
                            Reconciled ({inv.paypalOrderId ?? "Ledger"})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Webhooks & Reconciliation */}
      {tab === "LEDGER" && (
        <div className="space-y-4">
          <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] overflow-x-auto">
            <div className="px-4 py-3 border-b border-[#E5E7EB] text-sm font-medium text-[#202938]">
              PayPal Webhook Verification Log (`/api/paypal/webhook`)
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F7F8FA] border-b border-[#E5E7EB] text-[#667085]">
                <tr>
                  <th className="px-4 py-2 font-medium">Timestamp</th>
                  <th className="px-4 py-2 font-medium">Event Type</th>
                  <th className="px-4 py-2 font-medium">Order Ref</th>
                  <th className="px-4 py-2 font-medium">Signature Verified</th>
                  <th className="px-4 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {data.webhookEvents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-[#667085]"
                    >
                      No webhook events received yet. Create and reconcile a PayPal order in the Incoming Checkout tab to test webhook verification.
                    </td>
                  </tr>
                ) : (
                  data.webhookEvents.map((ev) => (
                    <tr key={ev.id}>
                      <td className="px-4 py-2 text-[#667085]">
                        {formatDateShort(ev.createdAt)}
                      </td>
                      <td className="px-4 py-2 font-medium">{ev.eventType}</td>
                      <td className="px-4 py-2">
                        {ev.reconciledOrderId ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge
                          label={ev.verified ? "VERIFIED" : "UNVERIFIED_TEST"}
                          tone={ev.verified ? "green" : "amber"}
                        />
                      </td>
                      <td className="px-4 py-2 text-[#667085]">
                        {ev.verificationDetail}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-[#667085]">
          Loading payments &amp; PayPal sandbox workspace...
        </div>
      }
    >
      <PaymentsContent />
    </Suspense>
  );
}

