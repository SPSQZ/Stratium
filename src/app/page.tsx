"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Landmark,
  MessageSquareText,
} from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { MonthlyCashFlowChart } from "@/components/SimpleCharts";
import { formatCurrency, formatDateShort } from "@/lib/types";
import type { FinancialOverview } from "@/lib/finance/metrics";

interface DashboardPayload {
  company: {
    id: string;
    name: string;
    currency: string;
    recordedCashBalance: number;
    recordedBalanceSource: string;
  };
  overview: FinancialOverview;
  pendingRequests: Array<{
    id: string;
    title: string;
    counterpartyName: string;
    amount: number;
    status: string;
    department: { name: string } | null;
    requestedBy: { name: string };
  }>;
  upcomingEvents: Array<{
    id: string;
    title: string;
    eventDate: string;
    amount: number;
    direction: string;
    status: string;
    category: string;
  }>;
  recentDecisions: Array<{
    id: string;
    title: string;
    estimatedCost: number;
    approvalStatus: string;
    department: { name: string } | null;
  }>;
  recentMeetings: Array<{
    id: string;
    title: string;
    scheduledAt: string;
    status: string;
  }>;
  recentDocuments: Array<{
    id: string;
    fileName: string;
    fileType: string;
    extractionStatus: string;
    verificationStatus: string;
  }>;
}

const WORKFLOW_STEPS = [
  { label: "Company Data", href: "/intelligence" },
  { label: "Intelligence", href: "/intelligence" },
  { label: "AI Boardroom", href: "/boardroom" },
  { label: "Strategic Decision", href: "/meetings" },
  { label: "Financial Plan", href: "/planning" },
  { label: "Human Approval", href: "/payments" },
  { label: "PayPal Execution", href: "/payments" },
  { label: "Outcome Tracking", href: "/calendar" },
];

export default function DashboardPage() {
  const { revision } = useSession();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (!res.ok) throw new Error("Unable to load dashboard metrics.");
        const json = (await res.json()) as DashboardPayload;
        if (active) setData(json);
      } catch (e) {
        if (active) setError(String(e));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [revision]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 rounded bg-[#E5E7EB]/60 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-md border border-[#E5E7EB] bg-[#FFFFFF] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-md border border-[#DC5252]/30 bg-[#FFFFFF] p-6 text-sm text-[#DC5252]">
        Failed to load workspace dashboard: {error ?? "Unknown error"}
      </div>
    );
  }

  const { overview } = data;
  const cur = overview.currency;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-[#202938]">
            Executive Dashboard
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Unified corporate intelligence, board decisions, and live treasury records for{" "}
            {data.company.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/boardroom"
            className="inline-flex items-center gap-1.5 rounded bg-[#315B7D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#274A66]"
          >
            <MessageSquareText className="h-3.5 w-3.5" />
            Open AI Boardroom
          </Link>
          <Link
            href="/payments"
            className="inline-flex items-center gap-1.5 rounded border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#202938] hover:bg-[#F7F8FA]"
          >
            <Landmark className="h-3.5 w-3.5" />
            Approvals &amp; PayPal
          </Link>
        </div>
      </div>

      {/* Central Continuous Workflow Strip */}
      <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[#667085] mb-2">
          Stratium Governance &amp; Treasury Loop
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {WORKFLOW_STEPS.map((step, i) => (
            <React.Fragment key={step.label}>
              <Link
                href={step.href}
                className="rounded border border-[#E5E7EB] bg-[#F7F8FA] px-2.5 py-1 text-xs font-medium text-[#202938] hover:border-[#315B7D] hover:text-[#315B7D]"
              >
                {i + 1}. {step.label}
              </Link>
              {i < WORKFLOW_STEPS.length - 1 && (
                <ArrowRight className="h-3.5 w-3.5 text-[#667085]" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Primary KPIs — strictly backed by database records */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4">
          <div className="text-xs text-[#667085]">Recorded Cash Balance</div>
          <div className="mt-1 text-2xl font-medium text-[#202938] tabular-nums">
            {formatCurrency(overview.recordedCashBalance, cur)}
          </div>
          <div className="mt-1.5 text-[11px] text-[#667085] truncate">
            {overview.recordedBalanceSource}
          </div>
        </div>

        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4">
          <div className="text-xs text-[#667085]">Remaining Approved Budgets</div>
          <div className="mt-1 text-2xl font-medium text-[#202938] tabular-nums">
            {formatCurrency(overview.remainingBudgetTotal, cur)}
          </div>
          <div className="mt-1.5 text-[11px] text-[#667085] tabular-nums">
            {formatCurrency(overview.actualBudgetExpenditure, cur)} spent of{" "}
            {formatCurrency(overview.approvedBudgetTotal, cur)}
          </div>
        </div>

        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4">
          <div className="text-xs text-[#667085]">
            Open Receivables / Payables
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-medium text-[#16A34A] tabular-nums">
              +{formatCurrency(overview.outstandingReceivables, cur)}
            </span>
            <span className="text-xs text-[#667085]">/</span>
            <span className="text-lg font-medium text-[#D69E36] tabular-nums">
              -{formatCurrency(overview.outstandingPayables, cur)}
            </span>
          </div>
          <div className="mt-1.5 text-[11px] text-[#667085] tabular-nums">
            {overview.pendingApprovalCount} payment request(s) awaiting human sign-off
          </div>
        </div>

        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#667085]">
              Forecasted 30d Consumption
            </span>
            <StatusBadge label="PROJECTED" tone="grey" />
          </div>
          <div className="mt-1 text-2xl font-medium text-[#202938] tabular-nums">
            {formatCurrency(overview.forecastedCashConsumption30d, cur)}
          </div>
          <div className="mt-1.5 text-[11px] text-[#667085] tabular-nums">
            Includes {formatCurrency(overview.upcomingObligations30d, cur)} committed obligations
          </div>
        </div>
      </div>

      {/* Main Grid: Chart + Pending Human Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <div>
              <h2 className="text-sm font-medium text-[#202938]">
                Cash Movement &amp; Planned Outflows
              </h2>
              <p className="text-xs text-[#667085]">
                Completed ledger transactions vs. scheduled &amp; forecasted calendar commitments
              </p>
            </div>
            <Link
              href="/finance"
              className="text-xs font-medium text-[#315B7D] hover:underline"
            >
              View Ledger →
            </Link>
          </div>
          <div className="pt-3">
            <MonthlyCashFlowChart data={overview.monthlyCashFlow} currency={cur} />
          </div>
        </div>

        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <h2 className="text-sm font-medium text-[#202938]">
              Human Approval Queue
            </h2>
            <Link
              href="/payments"
              className="text-xs font-medium text-[#315B7D] hover:underline"
            >
              Review All →
            </Link>
          </div>
          <div className="mt-3 space-y-2.5 flex-1">
            {data.pendingRequests.length === 0 ? (
              <div className="flex items-center gap-2 py-8 justify-center text-xs text-[#667085]">
                <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                All payment requests settled.
              </div>
            ) : (
              data.pendingRequests.map((pr) => (
                <Link
                  key={pr.id}
                  href="/payments"
                  className="block rounded border border-[#E5E7EB] p-2.5 hover:bg-[#F7F8FA]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-medium text-[#202938]">
                      {pr.title}
                    </div>
                    <span className="text-xs font-medium text-[#202938] tabular-nums shrink-0">
                      {formatCurrency(pr.amount, cur)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#667085] truncate">
                      {pr.department?.name ?? "General"} · By {pr.requestedBy.name}
                    </span>
                    <StatusBadge label={pr.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
          <div className="mt-3 rounded bg-[#F7F8FA] border border-[#E5E7EB] px-2.5 py-2 text-[11px] text-[#667085] flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-[#315B7D] shrink-0" />
            AI provides advisory validation only; human authorization is strictly enforced.
          </div>
        </div>
      </div>

      {/* Bottom Row: Upcoming Calendar, Decisions, Intelligence Docs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E7EB]">
            <h2 className="text-sm font-medium text-[#202938]">
              Upcoming Financial Calendar
            </h2>
            <Link
              href="/calendar"
              className="text-xs font-medium text-[#315B7D] hover:underline"
            >
              Calendar →
            </Link>
          </div>
          <div className="mt-2.5 divide-y divide-[#E5E7EB]">
            {data.upcomingEvents.map((ev) => (
              <div
                key={ev.id}
                className="py-2 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-[#202938] truncate">
                    {ev.title}
                  </div>
                  <div className="text-[11px] text-[#667085]">
                    {formatDateShort(ev.eventDate)} · {ev.category}
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <div className="font-medium tabular-nums text-[#202938]">
                    {ev.direction === "INCOMING" ? "+" : "-"}
                    {formatCurrency(ev.amount, cur)}
                  </div>
                  <StatusBadge label={ev.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E7EB]">
            <h2 className="text-sm font-medium text-[#202938]">
              Strategic Decision Memory
            </h2>
            <Link
              href="/meetings"
              className="text-xs font-medium text-[#315B7D] hover:underline"
            >
              Meetings →
            </Link>
          </div>
          <div className="mt-2.5 space-y-2.5">
            {data.recentDecisions.map((d) => (
              <div
                key={d.id}
                className="rounded border border-[#E5E7EB] p-2.5 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-[#202938]">{d.title}</div>
                  <StatusBadge label={d.approvalStatus} />
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-[#667085]">
                  <span>{d.department?.name ?? "Executive"}</span>
                  <span className="tabular-nums font-medium text-[#202938]">
                    {formatCurrency(d.estimatedCost, cur)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E7EB]">
            <h2 className="text-sm font-medium text-[#202938]">
              Company Intelligence Sources
            </h2>
            <Link
              href="/intelligence"
              className="text-xs font-medium text-[#315B7D] hover:underline"
            >
              Manage →
            </Link>
          </div>
          <div className="mt-2.5 space-y-2">
            {data.recentDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-2 rounded border border-[#E5E7EB] px-2.5 py-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-[#315B7D] shrink-0" />
                  <div className="truncate">
                    <div className="font-medium text-[#202938] truncate">
                      {doc.fileName}
                    </div>
                    <div className="text-[11px] text-[#667085]">
                      {doc.fileType} · Extraction: {doc.extractionStatus}
                    </div>
                  </div>
                </div>
                <StatusBadge label={doc.verificationStatus} />
              </div>
            ))}
            {data.recentMeetings.slice(0, 2).map((m) => (
              <Link
                key={m.id}
                href="/boardroom"
                className="flex items-center justify-between gap-2 rounded bg-[#F7F8FA] border border-[#E5E7EB] px-2.5 py-2 text-xs hover:border-[#315B7D]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="h-3.5 w-3.5 text-[#667085] shrink-0" />
                  <div className="truncate font-medium text-[#202938]">
                    {m.title}
                  </div>
                </div>
                <StatusBadge label={m.status} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
