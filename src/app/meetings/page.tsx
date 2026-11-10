"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Plus, XCircle, ArrowRight } from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDateShort } from "@/lib/types";

interface MeetingsPayload {
  company: { id: string; name: string; currency: string };
  meetings: Array<{
    id: string;
    title: string;
    meetingType: string;
    scheduledAt: string;
    status: string;
    agenda: string;
    contextSummary: string;
    aiSummary: string;
    _count: { messages: number };
  }>;
  decisions: Array<{
    id: string;
    title: string;
    description: string;
    objective: string;
    alternativesConsidered: string;
    selectedOption: string;
    rationale: string;
    assumptions: string;
    risks: string;
    financialImplications: string;
    estimatedCost: number;
    expectedOutcome: string;
    reviewDate: string | null;
    approvalStatus: string;
    department: { id: string; name: string } | null;
    meeting: { id: string; title: string } | null;
    responsibleUser: { id: string; name: string } | null;
    budgets: Array<{ id: string; name: string; allocatedAmount: number }>;
  }>;
  departments: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; role: string }>;
}

export default function MeetingsDecisionsPage() {
  const { revision } = useSession();
  const [data, setData] = useState<MeetingsPayload | null>(null);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [meetingForm, setMeetingForm] = useState({
    title: "",
    meetingType: "Board Strategy Session",
    agenda: "",
    contextSummary: "",
  });

  const [decisionForm, setDecisionForm] = useState({
    title: "",
    objective: "",
    alternativesConsidered: "",
    selectedOption: "",
    rationale: "",
    assumptions: "",
    risks: "",
    estimatedCost: "250000",
    departmentId: "",
    meetingId: "",
  });

  const loadData = useCallback(async () => {
    const res = await fetch("/api/meetings", { cache: "no-store" });
    if (res.ok) {
      setData(await res.json());
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const res = await fetch("/api/meetings", { cache: "no-store" });
      if (res.ok && active) {
        setData(await res.json());
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [revision]);

  async function handleCreateMeeting(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    const res = await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "CREATE_MEETING", ...meetingForm }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to schedule meeting.");
    } else {
      setShowMeetingForm(false);
      setMeetingForm({
        title: "",
        meetingType: "Board Strategy Session",
        agenda: "",
        contextSummary: "",
      });
      setFeedback(`Scheduled meeting "${json.meeting.title}".`);
      await loadData();
    }
  }

  async function handleCreateDecision(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    const res = await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "CREATE_DECISION",
        ...decisionForm,
        estimatedCost: Number(decisionForm.estimatedCost) || 0,
        departmentId: decisionForm.departmentId || null,
        meetingId: decisionForm.meetingId || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to record decision.");
    } else {
      setShowDecisionForm(false);
      setDecisionForm({
        title: "",
        objective: "",
        alternativesConsidered: "",
        selectedOption: "",
        rationale: "",
        assumptions: "",
        risks: "",
        estimatedCost: "250000",
        departmentId: "",
        meetingId: "",
      });
      setFeedback(
        `Decision "${json.decision.title}" recorded as PROPOSED and added to Financial Calendar.`
      );
      await loadData();
    }
  }

  async function handleApproveDecision(
    decisionId: string,
    title: string,
    cost: number,
    approvalStatus: "APPROVED" | "REJECTED"
  ) {
    const msg =
      approvalStatus === "APPROVED"
        ? `Confirm Board/Executive approval for "${title}"? This will create an approved budget of ${formatCurrency(
            cost,
            data?.company.currency
          )} and schedule phased tranches on the Financial Calendar.`
        : `Confirm rejecting decision "${title}"?`;
    if (!window.confirm(msg)) return;

    setError(null);
    setFeedback(null);
    const res = await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "APPROVE_DECISION",
        decisionId,
        approvalStatus,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Permission denied approving resolution.");
    } else {
      setFeedback(
        approvalStatus === "APPROVED"
          ? `Approved "${title}". Created linked Budget & ${
              json.createdScheduleEvents?.length ?? 0
            } Calendar schedule tranche(s), and updated AI Decision Memory.`
          : `Decision "${title}" marked REJECTED.`
      );
      await loadData();
    }
  }

  if (!data) {
    return (
      <div className="p-8 text-sm text-[#667085]">
        Loading meetings &amp; strategic decision memory...
      </div>
    );
  }

  const cur = data.company.currency;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-[#202938]">
            Meetings &amp; Decision Memory
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Track boardroom agendas, record structured resolutions, and translate approved decisions into budgets and calendar schedules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMeetingForm((s) => !s)}
            className="inline-flex items-center gap-1 rounded border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#202938]"
          >
            <Plus className="h-3.5 w-3.5" />
            Schedule Meeting
          </button>
          <button
            onClick={() => setShowDecisionForm((s) => !s)}
            className="inline-flex items-center gap-1 rounded bg-[#315B7D] px-3 py-1.5 text-xs font-medium text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Record Decision
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

      {showMeetingForm && (
        <form
          onSubmit={handleCreateMeeting}
          className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3 text-xs"
        >
          <div className="font-medium text-sm text-[#202938]">
            Schedule Board / Executive Meeting
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              required
              placeholder="Meeting Title *"
              value={meetingForm.title}
              onChange={(e) =>
                setMeetingForm((p) => ({ ...p, title: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
            <input
              placeholder="Meeting Type"
              value={meetingForm.meetingType}
              onChange={(e) =>
                setMeetingForm((p) => ({ ...p, meetingType: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
          </div>
          <textarea
            rows={2}
            placeholder="Agenda items..."
            value={meetingForm.agenda}
            onChange={(e) =>
              setMeetingForm((p) => ({ ...p, agenda: e.target.value }))
            }
            className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowMeetingForm(false)}
              className="rounded border border-[#E5E7EB] px-3 py-1.5 text-[#667085]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-[#315B7D] px-3.5 py-1.5 font-medium text-white"
            >
              Create Meeting
            </button>
          </div>
        </form>
      )}

      {showDecisionForm && (
        <form
          onSubmit={handleCreateDecision}
          className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3 text-xs"
        >
          <div className="font-medium text-sm text-[#202938]">
            Record Strategic Decision Proposal
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              required
              placeholder="Decision Title *"
              value={decisionForm.title}
              onChange={(e) =>
                setDecisionForm((p) => ({ ...p, title: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
            <input
              required
              type="number"
              placeholder={`Estimated Cost (${cur}) *`}
              value={decisionForm.estimatedCost}
              onChange={(e) =>
                setDecisionForm((p) => ({
                  ...p,
                  estimatedCost: e.target.value,
                }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
            />
            <select
              value={decisionForm.departmentId}
              onChange={(e) =>
                setDecisionForm((p) => ({ ...p, departmentId: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            >
              <option value="">Assign Responsible Dept</option>
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              required
              placeholder="Selected Option *"
              value={decisionForm.selectedOption}
              onChange={(e) =>
                setDecisionForm((p) => ({
                  ...p,
                  selectedOption: e.target.value,
                }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
            <input
              placeholder="Alternatives Considered"
              value={decisionForm.alternativesConsidered}
              onChange={(e) =>
                setDecisionForm((p) => ({
                  ...p,
                  alternativesConsidered: e.target.value,
                }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
            <textarea
              rows={2}
              placeholder="Rationale"
              value={decisionForm.rationale}
              onChange={(e) =>
                setDecisionForm((p) => ({ ...p, rationale: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
            <textarea
              rows={2}
              placeholder="Assumptions & Key Risks"
              value={decisionForm.risks}
              onChange={(e) =>
                setDecisionForm((p) => ({ ...p, risks: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowDecisionForm(false)}
              className="rounded border border-[#E5E7EB] px-3 py-1.5 text-[#667085]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-[#315B7D] px-3.5 py-1.5 font-medium text-white"
            >
              Save Decision Proposal
            </button>
          </div>
        </form>
      )}

      {/* Meetings List */}
      <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3">
        <h2 className="text-sm font-medium text-[#202938]">
          Board &amp; Executive Meetings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.meetings.map((m) => (
            <div
              key={m.id}
              className="rounded border border-[#E5E7EB] p-3 text-xs space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-[#202938]">{m.title}</div>
                  <div className="text-[11px] text-[#667085]">
                    {m.meetingType} · {formatDateShort(m.scheduledAt)} ·{" "}
                    {m._count.messages} boardroom entries
                  </div>
                </div>
                <StatusBadge label={m.status} />
              </div>
              <p className="text-[#667085]">{m.contextSummary}</p>
              <div className="pt-1 flex justify-end">
                <Link
                  href="/boardroom"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#315B7D] hover:underline"
                >
                  Open in AI Boardroom <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Structured Decisions & Budget Conversion */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-[#202938]">
          Structured Strategic Decisions &amp; Financial Translation
        </h2>
        {data.decisions.map((dec) => (
          <div
            key={dec.id}
            className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3 text-xs"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#202938]">
                    {dec.title}
                  </span>
                  <StatusBadge label={dec.approvalStatus} />
                </div>
                <div className="text-[11px] text-[#667085] mt-0.5">
                  Owner: {dec.responsibleUser?.name ?? "Executive"} · Dept:{" "}
                  {dec.department?.name ?? "Company-Wide"} · Review:{" "}
                  {formatDateShort(dec.reviewDate)}
                </div>
              </div>
              <div className="text-right font-medium text-sm tabular-nums text-[#202938]">
                {formatCurrency(dec.estimatedCost, cur)}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded bg-[#F7F8FA] border border-[#E5E7EB] p-2.5">
                <div className="font-medium text-[#202938] mb-0.5">
                  Selected Option &amp; Rationale
                </div>
                <p className="text-[#202938]">{dec.selectedOption}</p>
                <p className="text-[#667085] mt-1">{dec.rationale}</p>
              </div>
              <div className="rounded bg-[#F7F8FA] border border-[#E5E7EB] p-2.5">
                <div className="font-medium text-[#202938] mb-0.5">
                  Alternatives &amp; Assumptions
                </div>
                <p className="text-[#667085]">{dec.alternativesConsidered}</p>
                <p className="text-[#667085] mt-1">{dec.assumptions}</p>
              </div>
              <div className="rounded bg-[#F7F8FA] border border-[#E5E7EB] p-2.5">
                <div className="font-medium text-[#202938] mb-0.5">
                  Risks &amp; Financial Link
                </div>
                <p className="text-[#667085]">{dec.risks}</p>
                {dec.budgets.length > 0 && (
                  <div className="mt-1.5 text-[#16A34A] font-medium">
                    Linked Budget: {dec.budgets[0].name} (
                    {formatCurrency(dec.budgets[0].allocatedAmount, cur)})
                  </div>
                )}
              </div>
            </div>

            {dec.approvalStatus === "PROPOSED" && (
              <div className="pt-2 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-[#667085]">
                  Approving converts this resolution into an active Budget Allocation and phased Calendar spending schedule (requires Board Member, CEO, or CFO).
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      void handleApproveDecision(
                        dec.id,
                        dec.title,
                        dec.estimatedCost,
                        "REJECTED"
                      )
                    }
                    className="inline-flex items-center gap-1 rounded border border-[#DC5252]/40 px-2.5 py-1 font-medium text-[#DC5252]"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </button>
                  <button
                    onClick={() =>
                      void handleApproveDecision(
                        dec.id,
                        dec.title,
                        dec.estimatedCost,
                        "APPROVED"
                      )
                    }
                    className="inline-flex items-center gap-1 rounded bg-[#16A34A] px-3 py-1 font-medium text-white hover:bg-[#15803D]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve Resolution &amp; Generate Budget
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

