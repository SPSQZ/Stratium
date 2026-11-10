"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Send,
  Scale,
  FileCheck2,
  AlertTriangle,
  HelpCircle,
  GitBranch,
  ClipboardPlus,
  Wrench,
  Sparkles,
} from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { StatusBadge } from "@/components/StatusBadge";
import {
  formatCurrency,
  formatDateShort,
  type StructuredBoardroomResponse,
} from "@/lib/types";

interface MeetingItem {
  id: string;
  title: string;
  meetingType: string;
  scheduledAt: string;
  status: string;
  agenda: string;
  participantsJson: string;
  contextSummary: string;
}

interface BoardroomMessageItem {
  id: string;
  speakerName: string;
  speakerRole: string;
  messageType: string;
  content: string;
  structuredResponseJson: string | null;
  createdAt: string;
}

interface BoardroomData {
  company: {
    id: string;
    name: string;
    currency: string;
    historicalCutoffDate: string | null;
    isHistoricalDemo: boolean;
  };
  meetings: MeetingItem[];
  activeMeeting: MeetingItem | null;
  messages: BoardroomMessageItem[];
  financialSnapshot: {
    currency: string;
    recordedCashBalance: number;
    remainingBudgetTotal: number;
    outstandingPayables: number;
    outstandingReceivables: number;
    pendingApprovalCount: number;
    forecastedCashConsumption30d: number;
  };
  recentDecisions: Array<{
    id: string;
    title: string;
    approvalStatus: string;
    estimatedCost: number;
  }>;
}

const DEMO_PROMPTS = [
  {
    label: "Scenario 1: CEO vs CFO vs CTO Conflict",
    isTranscript: true,
    prompt:
      "CEO: We should aggressively expand Supercharger stations into 15 new regional corridors immediately.\nCFO: Our Q3 filings showed negative automotive margin and our financial position cannot support un-gated expansion.\nCTO: Our current power electronics engineering bandwidth and utility grid interconnection lead times cannot handle simultaneous rollout.",
  },
  {
    label: "Scenario 2: 10-Year Station Capacity Question",
    isTranscript: false,
    prompt:
      "Unexpected board question: How many charging stations can we realistically deploy over the next 10 years, what are the CapEx/OpEx ranges, and how does that compare to our recorded cash balance?",
  },
  {
    label: "Cutoff Verification (Post-2012 Test)",
    isTranscript: false,
    prompt:
      "What did Tesla's Model 3 launch and Gigafactory Nevada contribute to 2016 revenue?",
  },
];

export default function BoardroomPage() {
  const router = useRouter();
  const { data: sessionData, revision } = useSession();
  const [boardData, setBoardData] = useState<BoardroomData | null>(null);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [speakerRoleOverride, setSpeakerRoleOverride] = useState<string | null>(
    null
  );
  const speakerRole =
    speakerRoleOverride ?? sessionData?.session.user.role ?? "CEO";
  const [isTranscriptPaste, setIsTranscriptPaste] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft decision modal state
  const [draftModal, setDraftModal] = useState<{
    title: string;
    objective: string;
    selectedOption: string;
    alternativesConsidered: string;
    rationale: string;
    assumptions: string;
    risks: string;
    financialImplications: string;
    estimatedCost: number;
  } | null>(null);
  const [draftFeedback, setDraftFeedback] = useState<string | null>(null);

  const loadBoardroom = useCallback(
    async (meetingId?: string) => {
      const qs = meetingId ? `?meetingId=${encodeURIComponent(meetingId)}` : "";
      const res = await fetch(`/api/boardroom${qs}`, { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as BoardroomData;
        setBoardData(json);
        if (json.activeMeeting && !meetingId) {
          setSelectedMeetingId(json.activeMeeting.id);
        }
      }
    },
    []
  );

  useEffect(() => {
    let active = true;
    async function init() {
      const res = await fetch("/api/boardroom", { cache: "no-store" });
      if (res.ok && active) {
        const json = (await res.json()) as BoardroomData;
        setBoardData(json);
        if (json.activeMeeting) {
          setSelectedMeetingId(json.activeMeeting.id);
        }
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [revision]);

  async function handleSubmitPrompt(e?: React.FormEvent, overridePrompt?: string) {
    if (e) e.preventDefault();
    const text = (overridePrompt ?? prompt).trim();
    if (!text) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/boardroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: selectedMeetingId || boardData?.activeMeeting?.id,
          prompt: text,
          speakerName: isTranscriptPaste
            ? "Meeting Transcript Input"
            : sessionData?.session.user.name,
          speakerRole: isTranscriptPaste ? "TRANSCRIPT" : speakerRole,
          isTranscriptPaste,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to analyze boardroom input.");
      } else {
        setPrompt("");
        await loadBoardroom(json.meetingId);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveDecisionDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!draftModal) return;
    setDraftFeedback(null);
    const res = await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "CREATE_DECISION",
        meetingId: boardData?.activeMeeting?.id ?? null,
        ...draftModal,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setDraftFeedback(json.error || "Permission denied or validation error.");
    } else {
      setDraftModal(null);
      setDraftFeedback(
        "Strategic decision recorded as PROPOSED in Meetings & Decisions. Human executive/board approval is required before budget allocation."
      );
      await loadBoardroom(selectedMeetingId);
    }
  }

  if (!boardData) {
    return (
      <div className="p-8 text-sm text-[#667085]">
        Loading AI Boardroom workspace...
      </div>
    );
  }

  const activeMeeting = boardData.activeMeeting;
  const participants: Array<{ name: string; role: string }> = activeMeeting
    ? JSON.parse(activeMeeting.participantsJson || "[]")
    : [];
  const cur = boardData.financialSnapshot.currency;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-[#202938]">
            AI Strategic Boardroom Assistant
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Investigates unexpected questions, evaluates conflicting executive arguments, and grounds claims in verified company intelligence and financial records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Select meeting"
            value={activeMeeting?.id ?? ""}
            onChange={(e) => {
              setSelectedMeetingId(e.target.value);
              void loadBoardroom(e.target.value);
            }}
            className="h-8 rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2.5 text-xs font-medium text-[#202938] max-w-xs focus:border-[#315B7D] focus:outline-none"
          >
            {boardData.meetings.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {draftFeedback && (
        <div className="rounded border border-[#16A34A]/30 bg-[#16A34A]/10 px-3 py-2 text-xs text-[#16A34A] flex items-center justify-between">
          <span>{draftFeedback}</span>
          <Link href="/meetings" className="font-medium underline">
            Go to Meetings &amp; Decisions →
          </Link>
        </div>
      )}

      {/* Main Split Workspace: Conversation + Contextual Evidence/Metrics Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Conversation & Analysis Area (8 cols) */}
        <div className="xl:col-span-8 space-y-4">
          {/* Meeting Meta Card */}
          {activeMeeting && (
            <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-[#202938]">
                    {activeMeeting.title}
                  </div>
                  <div className="text-xs text-[#667085] mt-0.5">
                    {activeMeeting.meetingType} ·{" "}
                    {formatDateShort(activeMeeting.scheduledAt)}
                  </div>
                </div>
                <StatusBadge label={activeMeeting.status} />
              </div>
              <p className="mt-2 text-xs text-[#667085]">
                {activeMeeting.contextSummary}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {participants.map((p, idx) => (
                  <span
                    key={idx}
                    className="rounded border border-[#E5E7EB] bg-[#F7F8FA] px-2 py-0.5 text-[11px] text-[#202938]"
                  >
                    {p.name}{" "}
                    <span className="text-[#667085]">({p.role})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Investigation Prompts */}
          <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[#667085] mb-2">
              Suggested Boardroom Investigations
            </div>
            <div className="flex flex-wrap gap-2">
              {DEMO_PROMPTS.map((dp) => (
                <button
                  key={dp.label}
                  type="button"
                  onClick={() => {
                    setIsTranscriptPaste(dp.isTranscript);
                    setPrompt(dp.prompt);
                  }}
                  className="rounded border border-[#E5E7EB] bg-[#F7F8FA] px-2.5 py-1 text-xs font-medium text-[#315B7D] hover:border-[#315B7D] hover:bg-[#FFFFFF]"
                >
                  {dp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Thread */}
          <div className="space-y-3">
            {boardData.messages.map((msg) => {
              if (msg.messageType !== "AI_ANALYSIS") {
                return (
                  <div
                    key={msg.id}
                    className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[#202938]">
                          {msg.speakerName}
                        </span>
                        <StatusBadge label={msg.speakerRole} tone="grey" />
                      </div>
                      <span className="text-[11px] text-[#667085]">
                        {formatDateShort(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-[#202938] whitespace-pre-line">
                      {msg.content}
                    </p>
                  </div>
                );
              }

              const structured: StructuredBoardroomResponse | null =
                msg.structuredResponseJson
                  ? JSON.parse(msg.structuredResponseJson)
                  : null;

              if (!structured) {
                return (
                  <div
                    key={msg.id}
                    className="rounded-md border border-[#315B7D]/30 bg-[#FFFFFF] p-4 text-sm"
                  >
                    {msg.content}
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className="rounded-md border border-[#315B7D]/30 bg-[#FFFFFF] p-4 space-y-4"
                >
                  {/* AI Meta Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E5E7EB]">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#315B7D]/10 text-[#315B7D]">
                        <Scale className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-xs font-medium text-[#202938]">
                        Stratium Structured Analysis
                      </span>
                      <StatusBadge label={structured.mode} />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#667085]">
                      <span>{structured.modelLabel}</span>
                      {structured.historicalCutoffApplied && (
                        <span className="rounded bg-[#F7F8FA] border border-[#E5E7EB] px-1.5 py-0.5 text-[#315B7D]">
                          Cutoff: {structured.historicalCutoffApplied}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 1. Direct Answer */}
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-[#667085] mb-1">
                      1. Direct Answer
                    </div>
                    <p className="text-sm text-[#202938] whitespace-pre-line leading-relaxed">
                      {structured.directAnswer}
                    </p>
                  </div>

                  {/* Conflicting Arguments Investigation (when detected) */}
                  {structured.conflictAnalysis?.hasConflict && (
                    <div className="rounded border border-[#D69E36]/35 bg-[#D69E36]/5 p-3.5 space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[#A16207]">
                        <Scale className="h-3.5 w-3.5" />
                        Conflicting Perspectives Evaluation (Independent of Seniority)
                      </div>
                      <p className="text-xs text-[#202938]">
                        <strong>Underlying Conflict:</strong>{" "}
                        {structured.conflictAnalysis.underlyingConflict}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {structured.conflictAnalysis.perspectives.map((p, i) => (
                          <div
                            key={i}
                            className="rounded border border-[#E5E7EB] bg-[#FFFFFF] p-2.5 space-y-1.5"
                          >
                            <div className="text-xs font-medium text-[#315B7D]">
                              {p.roleOrSpeaker}
                            </div>
                            <p className="text-xs text-[#202938]">{p.position}</p>
                            <p className="text-[11px] text-[#667085]">
                              <strong>Evidence Check:</strong> {p.evidenceCheck}
                            </p>
                            {p.unsupportedAssumptions.length > 0 && (
                              <div className="text-[11px] text-[#A16207]">
                                <strong>Challenged Assumption:</strong>{" "}
                                {p.unsupportedAssumptions.join("; ")}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-[#202938]">
                        <strong>Balanced Assessment:</strong>{" "}
                        {structured.conflictAnalysis.balancedAssessment}
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-[#202938] mb-1">
                          Alternative Courses of Action:
                        </div>
                        <ul className="list-disc pl-4 space-y-1 text-xs text-[#202938]">
                          {structured.conflictAnalysis.recommendedAlternatives.map(
                            (alt, i) => (
                              <li key={i}>{alt}</li>
                            )
                          )}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* 2. Supporting Evidence + 3. Counterargument */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded border border-[#E5E7EB] bg-[#F7F8FA] p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[#202938] mb-2">
                        <FileCheck2 className="h-3.5 w-3.5 text-[#16A34A]" />
                        2. Supporting Evidence &amp; Sources
                      </div>
                      <div className="space-y-2">
                        {structured.supportingEvidence.map((ev, i) => (
                          <div
                            key={i}
                            className="rounded bg-[#FFFFFF] border border-[#E5E7EB] p-2 text-xs space-y-1"
                          >
                            <p className="text-[#202938]">{ev.claim}</p>
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className="text-[11px] text-[#667085]">
                                Source: {ev.source}
                              </span>
                              <StatusBadge label={ev.verificationBadge} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded border border-[#E5E7EB] bg-[#F7F8FA] p-3">
                        <div className="text-xs font-medium text-[#202938] mb-1">
                          3. Counterargument
                        </div>
                        <p className="text-xs text-[#202938] leading-relaxed">
                          {structured.counterargument}
                        </p>
                      </div>
                      <div className="rounded border border-[#E5E7EB] bg-[#F7F8FA] p-3">
                        <div className="text-xs font-medium text-[#202938] mb-1">
                          4. Financial Impact
                        </div>
                        <p className="text-xs text-[#202938] leading-relaxed tabular-nums">
                          {structured.financialImpact}
                        </p>
                      </div>
                      <div className="rounded border border-[#E5E7EB] bg-[#F7F8FA] p-3">
                        <div className="text-xs font-medium text-[#202938] mb-1">
                          5. Operational Impact
                        </div>
                        <p className="text-xs text-[#202938] leading-relaxed">
                          {structured.operationalImpact}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 6. Risks & 7. Uncertainties */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="rounded border border-[#DC5252]/25 bg-[#DC5252]/5 p-3">
                      <div className="flex items-center gap-1.5 font-medium text-[#DC5252] mb-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        6. Relevant Risks
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-[#202938]">
                        {structured.risks.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded border border-[#E5E7EB] bg-[#F7F8FA] p-3">
                      <div className="flex items-center gap-1.5 font-medium text-[#202938] mb-1.5">
                        <HelpCircle className="h-3.5 w-3.5 text-[#667085]" />
                        7. Uncertainties &amp; Missing Data
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-[#667085]">
                        {structured.uncertaintiesAndMissingData.map((u, i) => (
                          <li key={i}>{u}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Tool Execution Trace */}
                  <div className="rounded border border-[#E5E7EB] bg-[#F7F8FA] p-2.5 text-[11px] text-[#667085]">
                    <div className="flex items-center gap-1.5 font-medium text-[#202938] mb-1">
                      <Wrench className="h-3 w-3 text-[#315B7D]" />
                      Orchestrator Tool Trace
                    </div>
                    <div className="space-y-0.5">
                      {structured.toolTrace.map((t, i) => (
                        <div key={i}>
                          <code className="text-[#315B7D]">{t.tool}</code>:{" "}
                          {t.summary}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Next Questions + Human Action Bridges */}
                  <div className="pt-2 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {structured.suggestedNextQuestions.map((q, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => void handleSubmitPrompt(undefined, q)}
                          className="rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2 py-1 text-[11px] text-[#315B7D] hover:bg-[#F7F8FA] text-left"
                        >
                          {q}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      {structured.suggestedScenarioParams && (
                        <button
                          type="button"
                          onClick={() => {
                            const p = structured.suggestedScenarioParams!;
                            const qs = new URLSearchParams({
                              title: p.title,
                              horizonYears: String(p.horizonYears),
                              targetUnits: String(p.targetUnits),
                              unitCapex: String(p.unitCapex),
                              annualOpexPerUnit: String(p.annualOpexPerUnit),
                            });
                            router.push(`/planning?${qs.toString()}`);
                          }}
                          className="inline-flex items-center gap-1 rounded border border-[#315B7D] px-2.5 py-1 text-xs font-medium text-[#315B7D] hover:bg-[#315B7D]/10"
                        >
                          <GitBranch className="h-3.5 w-3.5" />
                          Model Scenarios
                        </button>
                      )}
                      {structured.suggestedDecisionDraft && (
                        <button
                          type="button"
                          onClick={() =>
                            setDraftModal(structured.suggestedDecisionDraft!)
                          }
                          className="inline-flex items-center gap-1 rounded bg-[#315B7D] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#274A66]"
                        >
                          <ClipboardPlus className="h-3.5 w-3.5" />
                          Draft Board Decision
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input Composer */}
          <form
            onSubmit={(e) => void handleSubmitPrompt(e)}
            className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTranscriptPaste(false)}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${
                    !isTranscriptPaste
                      ? "bg-[#315B7D] text-white"
                      : "bg-[#F7F8FA] text-[#667085] border border-[#E5E7EB]"
                  }`}
                >
                  Boardroom Question
                </button>
                <button
                  type="button"
                  onClick={() => setIsTranscriptPaste(true)}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${
                    isTranscriptPaste
                      ? "bg-[#315B7D] text-white"
                      : "bg-[#F7F8FA] text-[#667085] border border-[#E5E7EB]"
                  }`}
                >
                  Paste Meeting Transcript
                </button>
              </div>
              {!isTranscriptPaste && (
                <div className="flex items-center gap-1.5 text-xs text-[#667085]">
                  <span>Speaker perspective:</span>
                  <select
                    value={speakerRole}
                    onChange={(e) => setSpeakerRoleOverride(e.target.value)}
                    className="rounded border border-[#E5E7EB] bg-[#F7F8FA] px-2 py-0.5 text-xs text-[#202938]"
                  >
                    <option value="CEO">CEO</option>
                    <option value="CFO">CFO</option>
                    <option value="CTO">CTO</option>
                    <option value="BOARD_MEMBER">Board Member</option>
                    <option value="FINANCE_MANAGER">Finance Manager</option>
                  </select>
                </div>
              )}
            </div>

            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                isTranscriptPaste
                  ? "Paste multi-speaker transcript lines (e.g., CEO: ... / CFO: ... / CTO: ...) to evaluate conflicts and assumptions..."
                  : "Ask any strategic, operational, or unexpected financial question..."
              }
              className="w-full rounded border border-[#E5E7EB] bg-[#F7F8FA] p-2.5 text-sm text-[#202938] placeholder:text-[#667085] focus:border-[#315B7D] focus:bg-[#FFFFFF] focus:outline-none"
            />

            {error && <div className="text-xs text-[#DC5252]">{error}</div>}

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#667085] flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-[#315B7D]" />
                AI never approves or executes payments; all claims cite company records or mark assumptions.
              </span>
              <button
                type="submit"
                disabled={submitting || !prompt.trim()}
                className="inline-flex items-center gap-1.5 rounded bg-[#315B7D] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#274A66] disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {submitting ? "Investigating..." : "Analyze in Boardroom"}
              </button>
            </div>
          </form>
        </div>

        {/* Right Contextual Panel: Relevant Metrics & Decision Memory (4 cols) */}
        <div className="xl:col-span-4 space-y-4">
          <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-[#667085]">
              Live Corporate Financial Context
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#667085]">Recorded Cash Balance</span>
                <span className="font-medium text-[#202938] tabular-nums">
                  {formatCurrency(
                    boardData.financialSnapshot.recordedCashBalance,
                    cur
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#667085]">Remaining Approved Budgets</span>
                <span className="font-medium text-[#202938] tabular-nums">
                  {formatCurrency(
                    boardData.financialSnapshot.remainingBudgetTotal,
                    cur
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#667085]">Open Receivables</span>
                <span className="font-medium text-[#16A34A] tabular-nums">
                  {formatCurrency(
                    boardData.financialSnapshot.outstandingReceivables,
                    cur
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#667085]">Open Payables</span>
                <span className="font-medium text-[#D69E36] tabular-nums">
                  {formatCurrency(
                    boardData.financialSnapshot.outstandingPayables,
                    cur
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t border-[#E5E7EB] pt-2">
                <span className="text-[#667085]">
                  Forecasted 30d Consumption
                </span>
                <span className="font-medium text-[#667085] tabular-nums">
                  {formatCurrency(
                    boardData.financialSnapshot.forecastedCashConsumption30d,
                    cur
                  )}
                </span>
              </div>
            </div>
          </div>

          {activeMeeting && (
            <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-[#667085]">
                  Meeting Agenda
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch("/api/boardroom", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "SUMMARIZE_MEETING",
                        meetingId: activeMeeting.id,
                      }),
                    });
                    if (res.ok) {
                      await loadBoardroom(activeMeeting.id);
                    }
                  }}
                  className="text-[11px] font-medium text-[#315B7D] hover:underline"
                >
                  Refresh AI Summary
                </button>
              </div>
              <p className="text-xs text-[#202938] whitespace-pre-line leading-relaxed">
                {activeMeeting.agenda}
              </p>
            </div>
          )}

          <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-[#667085]">
                Decision Memory
              </span>
              <Link
                href="/meetings"
                className="text-xs font-medium text-[#315B7D] hover:underline"
              >
                View All
              </Link>
            </div>
            {boardData.recentDecisions.map((d) => (
              <div
                key={d.id}
                className="rounded border border-[#E5E7EB] p-2.5 text-xs space-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-[#202938]">{d.title}</span>
                  <StatusBadge label={d.approvalStatus} />
                </div>
                <div className="text-[11px] text-[#667085] tabular-nums">
                  Estimated Cost: {formatCurrency(d.estimatedCost, cur)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Draft Strategic Decision Modal (Requires Human Confirmation) */}
      {draftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
              <h3 className="text-sm font-medium text-[#202938]">
                Record Proposed Strategic Decision (Human Review Required)
              </h3>
              <button
                onClick={() => setDraftModal(null)}
                className="text-xs text-[#667085]"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleSaveDecisionDraft} className="space-y-2.5 text-xs">
              <div>
                <label className="block font-medium text-[#202938] mb-1">
                  Decision Title
                </label>
                <input
                  required
                  value={draftModal.title}
                  onChange={(e) =>
                    setDraftModal((d) => (d ? { ...d, title: e.target.value } : d))
                  }
                  className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-medium text-[#202938] mb-1">
                  Selected Option
                </label>
                <textarea
                  rows={2}
                  value={draftModal.selectedOption}
                  onChange={(e) =>
                    setDraftModal((d) =>
                      d ? { ...d, selectedOption: e.target.value } : d
                    )
                  }
                  className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-medium text-[#202938] mb-1">
                  Estimated Capital Commitment ({cur})
                </label>
                <input
                  type="number"
                  value={draftModal.estimatedCost}
                  onChange={(e) =>
                    setDraftModal((d) =>
                      d
                        ? { ...d, estimatedCost: Number(e.target.value) || 0 }
                        : d
                    )
                  }
                  className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-medium text-[#202938] mb-1">
                  Rationale
                </label>
                <textarea
                  rows={2}
                  value={draftModal.rationale}
                  onChange={(e) =>
                    setDraftModal((d) =>
                      d ? { ...d, rationale: e.target.value } : d
                    )
                  }
                  className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDraftModal(null)}
                  className="rounded border border-[#E5E7EB] px-3 py-1.5 text-xs text-[#667085]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-[#315B7D] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#274A66]"
                >
                  Save as Proposed Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

