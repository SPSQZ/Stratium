"use client";

import React from "react";

type Tone = "green" | "blue" | "amber" | "red" | "grey" | "slate";

const TONE_MAP: Record<Tone, string> = {
  green: "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/25",
  blue: "bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/25",
  amber: "bg-[#D69E36]/12 text-[#A16207] border-[#D69E36]/30",
  red: "bg-[#DC5252]/10 text-[#DC5252] border-[#DC5252]/25",
  grey: "bg-[#667085]/10 text-[#667085] border-[#667085]/20",
  slate: "bg-[#315B7D]/10 text-[#315B7D] border-[#315B7D]/25",
};

export function inferStatusTone(status: string): Tone {
  const s = status.toUpperCase();
  if (
    [
      "PAID",
      "COMPLETED",
      "APPROVED",
      "ACTIVE",
      "VERIFIED_PUBLIC",
      "SUCCESS",
      "IMPLEMENTED",
    ].includes(s)
  ) {
    return "green";
  }
  if (
    [
      "APPROVED_READY_FOR_EXECUTION",
      "CONTRACTED",
      "ISSUED",
      "IN_PROGRESS",
      "LLM_TOOL_ORCHESTRATED",
      "PAYPAL_SANDBOX",
    ].includes(s)
  ) {
    return "blue";
  }
  if (
    [
      "PENDING",
      "PENDING_VALIDATION",
      "PENDING_DEPT_APPROVAL",
      "PENDING_FINANCE_APPROVAL",
      "PENDING_EXEC_APPROVAL",
      "DUE",
      "PROPOSED",
      "PARTIALLY_PAID",
      "PARTIAL",
      "UNDER_REVIEW",
      "MANAGEMENT_ASSUMPTION",
      "USER_PROVIDED_UNVERIFIED",
      "PAYPAL_SIMULATED",
    ].includes(s)
  ) {
    return "amber";
  }
  if (
    ["FAILED", "REJECTED", "OVERDUE", "DENIED", "CANCELLED"].includes(s)
  ) {
    return "red";
  }
  if (["SYNTHETIC_RECORD", "AI_HYPOTHESIS"].includes(s)) {
    return "slate";
  }
  return "grey";
}

export function StatusBadge({
  label,
  tone,
  className = "",
}: {
  label: string;
  tone?: Tone;
  className?: string;
}) {
  const resolved = tone ?? inferStatusTone(label);
  const formatted = label.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap ${TONE_MAP[resolved]} ${className}`}
    >
      {formatted}
    </span>
  );
}

