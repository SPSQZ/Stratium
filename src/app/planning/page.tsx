"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Calculator, Save } from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { ScenarioLineChart } from "@/components/SimpleCharts";
import { formatCurrency } from "@/lib/types";
import type { ThreeScenarioResult } from "@/lib/planning/calculator";

interface PlanningResponse {
  company: { id: string; name: string; currency: string };
  recordedCashBalance: number;
  remainingBudgetTotal: number;
  scenarios: Array<{
    id: string;
    decisionTitle: string | null;
    questionContext: string;
    createdAt: string;
    computed: ThreeScenarioResult;
  }>;
  decisions: Array<{ id: string; title: string; approvalStatus: string }>;
}

function StrategicPlanningContent() {
  const searchParams = useSearchParams();
  const { revision } = useSession();
  const [data, setData] = useState<PlanningResponse | null>(null);
  const [activeResult, setActiveResult] = useState<ThreeScenarioResult | null>(
    null
  );
  const [running, setRunning] = useState(false);

  const [form, setForm] = useState(() => ({
    title:
      searchParams.get("title") || "Multi-Year Strategic Expansion Model",
    horizonYears: Number(searchParams.get("horizonYears")) || 5,
    targetUnits: Number(searchParams.get("targetUnits")) || 25,
    unitLabel:
      searchParams.get("unitLabel") || "Expansion Units / Initiatives",
    unitCapex: Number(searchParams.get("unitCapex")) || 85000,
    annualOpexPerUnit: Number(searchParams.get("annualOpexPerUnit")) || 12000,
    annualRevenuePerUnit:
      Number(searchParams.get("annualRevenuePerUnit")) || 40000,
    workforcePerTenUnits: 1.5,
    capexLeadMonths: 4,
    questionContext:
      "Multi-year capital, infrastructure capacity, and cash-coverage exploration across Optimistic, Baseline, and Adverse ranges.",
    decisionId: "",
  }));

  const loadPlanning = useCallback(async () => {
    const res = await fetch("/api/planning", { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as PlanningResponse;
      setData(json);
      if (json.scenarios.length > 0) {
        setActiveResult((prev) => prev ?? json.scenarios[0].computed);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const res = await fetch("/api/planning", { cache: "no-store" });
      if (res.ok && active) {
        const json = (await res.json()) as PlanningResponse;
        setData(json);
        setActiveResult(json.scenarios[0]?.computed ?? null);
        if (!searchParams.get("title")) {
          const n = json.company.name.toLowerCase();
          if (n.includes("tesla")) {
            setForm((p) => ({
              ...p,
              title: "10-Year US & Regional Supercharger Network Rollout",
              horizonYears: 10,
              targetUnits: 250,
              unitLabel: "Supercharger Stations (6 Stalls)",
              unitCapex: 165000,
              annualOpexPerUnit: 18500,
              annualRevenuePerUnit: 0,
            }));
          } else if (n.includes("meridian")) {
            setForm((p) => ({
              ...p,
              title: "5-Year Commercial Fleet Hub Rollout",
              horizonYears: 5,
              targetUnits: 45,
              unitLabel: "Regional Fleet Charging Hubs",
              unitCapex: 95000,
              annualOpexPerUnit: 14000,
              annualRevenuePerUnit: 52000,
            }));
          } else {
            setForm((p) => ({
              ...p,
              title: `${json.company.name} 5-Year Expansion Model`,
              horizonYears: 5,
              targetUnits: 25,
              unitLabel: "Expansion Units / Initiatives",
              unitCapex: 85000,
              annualOpexPerUnit: 12000,
              annualRevenuePerUnit: 40000,
            }));
          }
        }
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [revision, searchParams]);

  async function runScenario(save: boolean) {
    setRunning(true);
    try {
      const res = await fetch("/api/planning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          decisionId: form.decisionId || null,
          save,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setActiveResult(json.computed);
        if (save) await loadPlanning();
      }
    } finally {
      setRunning(false);
    }
  }

  const cur = data?.company.currency ?? "USD";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-medium text-[#202938]">
          Strategic Planning &amp; Scenario Modeling
        </h1>
        <p className="text-xs text-[#667085] mt-0.5">
          Explore Optimistic, Baseline, and Adverse outcome ranges grounded in explicit assumptions — without inventing certainty or arbitrary probabilities.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Parameter Builder */}
        <div className="lg:col-span-4 rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
            <span className="text-sm font-medium text-[#202938]">
              Scenario Parameters
            </span>
            {data && (
              <span className="text-[11px] text-[#667085] tabular-nums">
                Cash Ref: {formatCurrency(data.recordedCashBalance, cur)}
              </span>
            )}
          </div>

          <div>
            <label className="block font-medium mb-1">Scenario Name</label>
            <input
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
              className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-medium mb-1">Horizon (Years)</label>
              <input
                type="number"
                min={1}
                max={15}
                value={form.horizonYears}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    horizonYears: Number(e.target.value) || 1,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Target Units</label>
              <input
                type="number"
                min={1}
                value={form.targetUnits}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    targetUnits: Number(e.target.value) || 1,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1">Unit Description</label>
            <input
              value={form.unitLabel}
              onChange={(e) =>
                setForm((p) => ({ ...p, unitLabel: e.target.value }))
              }
              className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-medium mb-1">
                CapEx / Unit ({cur})
              </label>
              <input
                type="number"
                value={form.unitCapex}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    unitCapex: Number(e.target.value) || 0,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">
                Annual OpEx / Unit
              </label>
              <input
                type="number"
                value={form.annualOpexPerUnit}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    annualOpexPerUnit: Number(e.target.value) || 0,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-medium mb-1">
                Annual Rev / Unit
              </label>
              <input
                type="number"
                value={form.annualRevenuePerUnit}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    annualRevenuePerUnit: Number(e.target.value) || 0,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">
                FTEs per 10 Units
              </label>
              <input
                type="number"
                step="0.5"
                value={form.workforcePerTenUnits}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    workforcePerTenUnits: Number(e.target.value) || 1,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={running}
              onClick={() => void runScenario(false)}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded border border-[#315B7D] py-1.5 font-medium text-[#315B7D] hover:bg-[#315B7D]/10"
            >
              <Calculator className="h-3.5 w-3.5" />
              Calculate Range
            </button>
            <button
              type="button"
              disabled={running}
              onClick={() => void runScenario(true)}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded bg-[#315B7D] py-1.5 font-medium text-white hover:bg-[#274A66]"
            >
              <Save className="h-3.5 w-3.5" />
              Save Scenario
            </button>
          </div>

          {data && data.scenarios.length > 0 && (
            <div className="pt-3 border-t border-[#E5E7EB] space-y-1.5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-[#667085]">
                Saved Scenarios
              </div>
              {data.scenarios.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setActiveResult(sc.computed)}
                  className="w-full text-left rounded border border-[#E5E7EB] p-2 hover:bg-[#F7F8FA]"
                >
                  <div className="font-medium text-[#202938]">
                    {sc.computed.title}
                  </div>
                  <div className="text-[11px] text-[#667085]">
                    {sc.computed.horizonYears}y · Baseline{" "}
                    {sc.computed.baseline.totalUnitsDeployed} units
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Comparison & Chart Area */}
        <div className="lg:col-span-8 space-y-4">
          {activeResult && (
            <>
              <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E5E7EB]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-medium text-[#202938]">
                        {activeResult.title} — Cumulative Cash Impact Range
                      </h2>
                      <span className="rounded border border-[#E5E7EB] bg-[#F7F8FA] px-2 py-0.5 text-[11px] font-medium text-[#315B7D]">
                        {activeResult.isCostOnly
                          ? "Cost-Only Model ($0 Direct Revenue)"
                          : "Revenue-Attributed Model"}
                      </span>
                      <span className="rounded border border-[#E5E7EB] bg-[#F7F8FA] px-2 py-0.5 text-[11px] text-[#667085] tabular-nums">
                        Horizon: {activeResult.horizonYears} yr ({activeResult.horizonMonths} mo)
                      </span>
                    </div>
                    <p className="text-xs text-[#667085] mt-1">
                      {activeResult.methodologyNotes}
                    </p>
                  </div>
                </div>
                <ScenarioLineChart
                  optimistic={activeResult.optimistic.yearlySeries}
                  baseline={activeResult.baseline.yearlySeries}
                  adverse={activeResult.adverse.yearlySeries}
                  currency={cur}
                />
                <div className="rounded bg-[#F7F8FA] border border-[#E5E7EB] px-3 py-2 text-[11px] text-[#667085]">
                  {activeResult.disclaimer}
                </div>
              </div>

              {/* Side-by-Side Comparison Table */}
              <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F7F8FA] border-b border-[#E5E7EB] text-[#667085]">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Dimension</th>
                      <th className="px-4 py-2.5 font-medium text-[#16A34A]">
                        Optimistic
                      </th>
                      <th className="px-4 py-2.5 font-medium text-[#315B7D]">
                        Baseline
                      </th>
                      <th className="px-4 py-2.5 font-medium text-[#DC5252]">
                        Adverse
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] tabular-nums">
                    <tr>
                      <td className="px-4 py-2.5 font-medium">
                        Units Deployed ({activeResult.unitLabel})
                      </td>
                      <td className="px-4 py-2.5">
                        {activeResult.optimistic.totalUnitsDeployed}
                      </td>
                      <td className="px-4 py-2.5">
                        {activeResult.baseline.totalUnitsDeployed}
                      </td>
                      <td className="px-4 py-2.5">
                        {activeResult.adverse.totalUnitsDeployed}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium">Total CapEx</td>
                      <td className="px-4 py-2.5">
                        {formatCurrency(activeResult.optimistic.totalCapex, cur)}
                      </td>
                      <td className="px-4 py-2.5">
                        {formatCurrency(activeResult.baseline.totalCapex, cur)}
                      </td>
                      <td className="px-4 py-2.5">
                        {formatCurrency(activeResult.adverse.totalCapex, cur)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium">
                        Total Horizon OpEx
                      </td>
                      <td className="px-4 py-2.5">
                        {formatCurrency(
                          activeResult.optimistic.totalOpexOverHorizon,
                          cur
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {formatCurrency(
                          activeResult.baseline.totalOpexOverHorizon,
                          cur
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {formatCurrency(
                          activeResult.adverse.totalOpexOverHorizon,
                          cur
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium">
                        Total Estimated Cost
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {formatCurrency(
                          activeResult.optimistic.totalEstimatedCost,
                          cur
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {formatCurrency(
                          activeResult.baseline.totalEstimatedCost,
                          cur
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {formatCurrency(
                          activeResult.adverse.totalEstimatedCost,
                          cur
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium">
                        {activeResult.isCostOnly
                          ? "Direct Attributed Revenue (Cost-Only)"
                          : "Expected Attributed Revenue"}
                      </td>
                      <td className="px-4 py-2.5 text-[#667085]">
                        {activeResult.isCostOnly
                          ? "$0 (Cost-only)"
                          : formatCurrency(
                              activeResult.optimistic.totalExpectedRevenue,
                              cur
                            )}
                      </td>
                      <td className="px-4 py-2.5 text-[#667085]">
                        {activeResult.isCostOnly
                          ? "$0 (Cost-only)"
                          : formatCurrency(
                              activeResult.baseline.totalExpectedRevenue,
                              cur
                            )}
                      </td>
                      <td className="px-4 py-2.5 text-[#667085]">
                        {activeResult.isCostOnly
                          ? "$0 (Cost-only)"
                          : formatCurrency(
                              activeResult.adverse.totalExpectedRevenue,
                              cur
                            )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium">
                        Workforce Required (FTEs)
                      </td>
                      <td className="px-4 py-2.5">
                        {activeResult.optimistic.workforceRequirement}
                      </td>
                      <td className="px-4 py-2.5">
                        {activeResult.baseline.workforceRequirement}
                      </td>
                      <td className="px-4 py-2.5">
                        {activeResult.adverse.workforceRequirement}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium">
                        Estimated Completion vs. {activeResult.horizonMonths}-mo Horizon
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-[#16A34A]">
                          {activeResult.optimistic.estimatedTimelineMonths} mo
                        </div>
                        <div className="text-[11px] text-[#667085]">
                          {activeResult.optimistic.timelineStatus}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-[#315B7D]">
                          {activeResult.baseline.estimatedTimelineMonths} mo
                        </div>
                        <div className="text-[11px] text-[#667085]">
                          {activeResult.baseline.timelineStatus}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-[#DC5252]">
                          {activeResult.adverse.estimatedTimelineMonths} mo
                        </div>
                        <div className="text-[11px] text-[#DC5252]">
                          {activeResult.adverse.timelineStatus}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Assumptions, Constraints, Risks */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {[
                  activeResult.optimistic,
                  activeResult.baseline,
                  activeResult.adverse,
                ].map((branch) => (
                  <div
                    key={branch.label}
                    className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-3.5 space-y-2"
                  >
                    <div className="font-medium text-[#202938] border-b border-[#E5E7EB] pb-1.5">
                      {branch.label} Drivers &amp; Risks
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-[#667085]">
                        Assumptions
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-[#202938] mt-1">
                        {branch.assumptions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-[#667085]">
                        Risks
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-[#DC5252] mt-1">
                        {branch.risks.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-[#667085]">
                        Constraints &amp; Dependencies
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-[#667085] mt-1">
                        {branch.operationalConstraints.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                        {branch.dependencies.map((d, i) => (
                          <li key={`d-${i}`}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StrategicPlanningPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-[#667085]">
          Loading strategic planning scenarios...
        </div>
      }
    >
      <StrategicPlanningContent />
    </Suspense>
  );
}

