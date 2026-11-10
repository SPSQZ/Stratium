"use client";

import React from "react";
import { formatCurrency } from "@/lib/types";

export function MonthlyCashFlowChart({
  data,
  currency = "USD",
}: {
  data: Array<{
    month: string;
    incoming: number;
    outgoing: number;
    projectedOutgoing: number;
  }>;
  currency?: string;
}) {
  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => [d.incoming, d.outgoing, d.projectedOutgoing])
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-[#667085]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-[#16A34A]" />
          Incoming (Completed)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-[#315B7D]" />
          Outgoing (Completed)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-[#D69E36]/75" />
          Planned / Forecasted Outflow
        </span>
      </div>
      <div className="grid grid-cols-5 gap-3 pt-2">
        {data.map((row) => {
          const inPct = Math.round((row.incoming / maxVal) * 100);
          const outPct = Math.round((row.outgoing / maxVal) * 100);
          const projPct = Math.round((row.projectedOutgoing / maxVal) * 100);
          return (
            <div key={row.month} className="flex flex-col items-center gap-2">
              <div className="flex h-36 w-full items-end justify-center gap-1.5 rounded bg-[#F7F8FA] px-2 pt-3 pb-1 border border-[#E5E7EB]">
                <div
                  className="w-3 rounded-t bg-[#16A34A] transition-all"
                  style={{ height: `${Math.max(inPct, row.incoming > 0 ? 6 : 0)}%` }}
                  title={`Incoming: ${formatCurrency(row.incoming, currency)}`}
                />
                <div
                  className="w-3 rounded-t bg-[#315B7D] transition-all"
                  style={{ height: `${Math.max(outPct, row.outgoing > 0 ? 6 : 0)}%` }}
                  title={`Outgoing: ${formatCurrency(row.outgoing, currency)}`}
                />
                <div
                  className="w-3 rounded-t bg-[#D69E36]/80 transition-all"
                  style={{
                    height: `${Math.max(
                      projPct,
                      row.projectedOutgoing > 0 ? 6 : 0
                    )}%`,
                  }}
                  title={`Planned/Forecast: ${formatCurrency(
                    row.projectedOutgoing,
                    currency
                  )}`}
                />
              </div>
              <span className="text-[11px] font-medium text-[#667085] tabular-nums">
                {row.month}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ScenarioLineChart({
  optimistic,
  baseline,
  adverse,
  currency = "USD",
}: {
  optimistic: Array<{ year: number; cumulativeCashImpact: number }>;
  baseline: Array<{ year: number; cumulativeCashImpact: number }>;
  adverse: Array<{ year: number; cumulativeCashImpact: number }>;
  currency?: string;
}) {
  const allVals = [
    0,
    ...optimistic.map((p) => p.cumulativeCashImpact),
    ...baseline.map((p) => p.cumulativeCashImpact),
    ...adverse.map((p) => p.cumulativeCashImpact),
  ];
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const span = Math.max(1, maxV - minV);

  const width = 620;
  const height = 220;
  const padL = 68;
  const padR = 20;
  const padT = 18;
  const padB = 32;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const years = Math.max(1, baseline.length);
  const toX = (yearIdx: number) =>
    padL + (yearIdx / Math.max(1, years - 1)) * plotW;
  const toY = (val: number) =>
    padT + ((maxV - val) / span) * plotH;

  const toPolyline = (pts: Array<{ year: number; cumulativeCashImpact: number }>) =>
    pts
      .map((p, i) => `${toX(i).toFixed(1)},${toY(p.cumulativeCashImpact).toFixed(1)}`)
      .join(" ");

  const zeroY = toY(0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-5 text-xs text-[#667085]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[#16A34A]" />
          Optimistic Range
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[#315B7D]" />
          Baseline Range
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[#DC5252]" />
          Adverse Range
        </span>
      </div>
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-56 w-full min-w-[480px]"
          role="img"
          aria-label="Three scenario cumulative cash impact range"
        >
          {/* Grid lines */}
          {[0, 0.5, 1].map((t) => {
            const val = maxV - t * span;
            const y = padT + t * plotH;
            return (
              <g key={t}>
                <line
                  x1={padL}
                  y1={y}
                  x2={width - padR}
                  y2={y}
                  stroke="#E5E7EB"
                  strokeDasharray="3 3"
                />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#667085"
                >
                  {formatCurrency(val, currency)}
                </text>
              </g>
            );
          })}

          {zeroY >= padT && zeroY <= padT + plotH && (
            <line
              x1={padL}
              y1={zeroY}
              x2={width - padR}
              y2={zeroY}
              stroke="#9CA3AF"
              strokeWidth="1"
            />
          )}

          <polyline
            fill="none"
            stroke="#16A34A"
            strokeWidth="2.2"
            points={toPolyline(optimistic)}
          />
          <polyline
            fill="none"
            stroke="#315B7D"
            strokeWidth="2.5"
            points={toPolyline(baseline)}
          />
          <polyline
            fill="none"
            stroke="#DC5252"
            strokeWidth="2.2"
            strokeDasharray="5 3"
            points={toPolyline(adverse)}
          />

          {baseline.map((p, i) => (
            <text
              key={p.year}
              x={toX(i)}
              y={height - 10}
              textAnchor="middle"
              fontSize="10"
              fill="#667085"
            >
              Y{p.year}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

