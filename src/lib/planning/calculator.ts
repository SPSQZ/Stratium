export interface ScenarioInputParameters {
  title: string;
  horizonYears: number;
  targetUnits: number; // e.g., charging stations, regional hubs, or fleet units
  unitLabel: string; // e.g., "Supercharger Stations", "Regional Hubs"
  unitCapex: number; // upfront cost per unit
  annualOpexPerUnit: number; // annual operating & maintenance cost per deployed unit
  annualRevenuePerUnit: number; // direct or attributed annual revenue / margin benefit per unit (0 if cost-only)
  startingCashReserve: number; // recorded company cash available as reference
  workforcePerTenUnits: number; // operational/engineering FTEs per 10 units
  capexLeadMonths: number;
  notes?: string;
}

export interface YearlyProjectionPoint {
  year: number;
  cumulativeUnits: number;
  annualCapex: number;
  annualOpex: number;
  annualRevenue: number;
  netCashImpact: number;
  cumulativeCashImpact: number;
  workforceNeeded: number;
}

export interface ScenarioBranch {
  label: "Optimistic" | "Baseline" | "Adverse";
  assumptions: string[];
  totalUnitsDeployed: number;
  totalCapex: number;
  totalOpexOverHorizon: number;
  totalEstimatedCost: number;
  totalExpectedRevenue: number;
  netFinancialPositionImpact: number;
  peakAnnualCashDraw: number;
  cashReserveCoveragePct: number;
  workforceRequirement: number;
  estimatedTimelineMonths: number;
  fitsWithinHorizon: boolean;
  timelineStatus: string;
  operationalConstraints: string[];
  risks: string[];
  dependencies: string[];
  yearlySeries: YearlyProjectionPoint[];
}

export interface ThreeScenarioResult {
  title: string;
  horizonYears: number;
  horizonMonths: number;
  isCostOnly: boolean;
  unitLabel: string;
  methodologyNotes: string;
  disclaimer: string;
  input: ScenarioInputParameters;
  optimistic: ScenarioBranch;
  baseline: ScenarioBranch;
  adverse: ScenarioBranch;
}

function buildBranch(
  label: "Optimistic" | "Baseline" | "Adverse",
  input: ScenarioInputParameters,
  multipliers: {
    unitAchievement: number;
    capexCostFactor: number;
    opexCostFactor: number;
    revenueFactor: number;
    estimatedTimelineMonths: number;
    fitsWithinHorizon: boolean;
    timelineStatus: string;
    assumptions: string[];
    constraints: string[];
    risks: string[];
    dependencies: string[];
  }
): ScenarioBranch {
  const years = Math.max(1, Math.min(15, Math.round(input.horizonYears)));
  const totalUnits = Math.max(
    1,
    Math.round(input.targetUnits * multipliers.unitAchievement)
  );
  const effUnitCapex = input.unitCapex * multipliers.capexCostFactor;
  const effAnnualOpex = input.annualOpexPerUnit * multipliers.opexCostFactor;
  const effAnnualRev =
    input.annualRevenuePerUnit > 0
      ? input.annualRevenuePerUnit * multipliers.revenueFactor
      : 0;

  const yearlySeries: YearlyProjectionPoint[] = [];
  let cumulativeCashImpact = 0;
  let totalCapex = 0;
  let totalOpex = 0;
  let totalRev = 0;
  let peakAnnualCashDraw = 0;

  let deployedSoFar = 0;
  for (let y = 1; y <= years; y++) {
    const targetCumulative = Math.round((totalUnits * y) / years);
    const newUnitsThisYear = Math.max(0, targetCumulative - deployedSoFar);
    deployedSoFar = targetCumulative;

    const annualCapex = Math.round(newUnitsThisYear * effUnitCapex);
    const avgActiveUnits = deployedSoFar - newUnitsThisYear * 0.5;
    const annualOpex = Math.round(avgActiveUnits * effAnnualOpex);
    const annualRevenue = Math.round(avgActiveUnits * effAnnualRev);
    const netCashImpact = annualRevenue - (annualCapex + annualOpex);
    cumulativeCashImpact += netCashImpact;

    totalCapex += annualCapex;
    totalOpex += annualOpex;
    totalRev += annualRevenue;
    if (netCashImpact < 0) {
      peakAnnualCashDraw = Math.max(peakAnnualCashDraw, Math.abs(netCashImpact));
    }

    yearlySeries.push({
      year: y,
      cumulativeUnits: deployedSoFar,
      annualCapex,
      annualOpex,
      annualRevenue,
      netCashImpact,
      cumulativeCashImpact,
      workforceNeeded: Math.max(
        1,
        Math.ceil((deployedSoFar / 10) * input.workforcePerTenUnits)
      ),
    });
  }

  const totalEstimatedCost = totalCapex + totalOpex;
  const cashReserveCoveragePct =
    input.startingCashReserve > 0
      ? Math.round((totalEstimatedCost / input.startingCashReserve) * 1000) / 10
      : 0;

  return {
    label,
    assumptions: multipliers.assumptions,
    totalUnitsDeployed: totalUnits,
    totalCapex,
    totalOpexOverHorizon: totalOpex,
    totalEstimatedCost,
    totalExpectedRevenue: totalRev,
    netFinancialPositionImpact: totalRev - totalEstimatedCost,
    peakAnnualCashDraw,
    cashReserveCoveragePct,
    workforceRequirement: Math.max(
      1,
      Math.ceil((totalUnits / 10) * input.workforcePerTenUnits)
    ),
    estimatedTimelineMonths: multipliers.estimatedTimelineMonths,
    fitsWithinHorizon: multipliers.fitsWithinHorizon,
    timelineStatus: multipliers.timelineStatus,
    operationalConstraints: multipliers.constraints,
    risks: multipliers.risks,
    dependencies: multipliers.dependencies,
    yearlySeries,
  };
}

export function computeThreeScenarios(
  input: ScenarioInputParameters
): ThreeScenarioResult {
  const years = Math.max(1, Math.min(15, Math.round(input.horizonYears)));
  const horizonMonths = years * 12;
  const isCostOnly = input.annualRevenuePerUnit <= 0;

  const optMonths = Math.max(6, horizonMonths - Math.min(6, Math.round(horizonMonths * 0.05)));
  const baseMonths = horizonMonths;
  const advOverrunMonths = Math.max(6, input.capexLeadMonths + 8);
  const advMonths = horizonMonths + advOverrunMonths;

  const optUnits = Math.round(input.targetUnits * 1.15);
  const advUnitsWithinHorizon = Math.round(input.targetUnits * 0.7);

  const optimistic = buildBranch("Optimistic", input, {
    unitAchievement: 1.15,
    capexCostFactor: 0.88,
    opexCostFactor: 0.9,
    revenueFactor: 1.2,
    estimatedTimelineMonths: optMonths,
    fitsWithinHorizon: true,
    timelineStatus: `Completes within ${years}-year (${horizonMonths}-mo) horizon (${horizonMonths - optMonths} mo ahead of deadline)`,
    assumptions: [
      `Deploys ${optUnits} ${input.unitLabel} (115% of ${input.targetUnits} baseline target) within the ${horizonMonths}-month horizon using standardized site templates.`,
      "Unit CapEx drops 12% due to bulk hardware procurement and streamlined permitting.",
      isCostOnly
        ? "Annual OpEx is 10% below baseline via lower utility demand charges and site-host cost sharing. Cost-only model ($0 direct revenue)."
        : "Annual OpEx is 10% below baseline; direct revenue per unit is 20% above baseline from stronger utilization.",
    ],
    constraints: [
      "Requires concurrent Year-1 permitting and utility transformer staging so lead times do not slip past Month 120.",
      "Manufacturing & supply chain must avoid bottlenecks on core power hardware.",
    ],
    risks: [
      "Accelerated field execution may strain commissioning QA if hiring lags deployment.",
      isCostOnly
        ? "Site-host lease/utility demand-charge savings may be smaller than modeled if peak electricity tariffs rise."
        : "Higher utilization and revenue per unit may not materialize evenly across secondary corridors.",
    ],
    dependencies: [
      "Standardized site-host agreements",
      "Reliable supplier volume pricing",
      "Dedicated project financing or operating cash generation",
    ],
  });

  const baseline = buildBranch("Baseline", input, {
    unitAchievement: 1.0,
    capexCostFactor: 1.0,
    opexCostFactor: 1.0,
    revenueFactor: 1.0,
    estimatedTimelineMonths: baseMonths,
    fitsWithinHorizon: true,
    timelineStatus: `On-target completion at ${baseMonths} mo (fits ${years}-yr horizon with ${input.capexLeadMonths}-mo lead staged inside Year 1)`,
    assumptions: [
      `Deploys ${input.targetUnits} ${input.unitLabel} (100% of target) over the ${years}-year (${horizonMonths}-month) horizon.`,
      `Unit CapEx fixed at $${input.unitCapex.toLocaleString("en-US")} and annual OpEx at $${input.annualOpexPerUnit.toLocaleString("en-US")}/unit.`,
      isCostOnly
        ? `Cost-only deployment ($0 direct unit revenue); ${input.capexLeadMonths}-month permitting lead is staged inside Year 1 so full target completes by Month ${baseMonths}.`
        : `Direct revenue modeled at $${input.annualRevenuePerUnit.toLocaleString("en-US")}/unit/yr; ${input.capexLeadMonths}-month permitting lead is staged inside Year 1.`,
    ],
    constraints: [
      "Annual CapEx must stay gated behind quarterly cash liquidity thresholds.",
      "Field deployment workforce grows proportionally with active sites.",
    ],
    risks: [
      "Permitting delays in key corridors beyond the staged Year-1 buffer can push deployments past the 10-year window.",
      "Core vehicle/product gross margins must stabilize to self-fund later-year CapEx.",
    ],
    dependencies: [
      "Quarterly board budget gating",
      "Utility grid interconnection schedules",
      "Internal engineering & service bandwidth",
    ],
  });

  const adverse = buildBranch("Adverse", input, {
    unitAchievement: 0.7,
    capexCostFactor: 1.25,
    opexCostFactor: 1.2,
    revenueFactor: 0.7,
    estimatedTimelineMonths: advMonths,
    fitsWithinHorizon: false,
    timelineStatus: `Exceeds ${years}-year horizon (+${advOverrunMonths} mo overrun): only ${advUnitsWithinHorizon} of ${input.targetUnits} finish by Month ${horizonMonths}; full target slips to ~${advMonths} mo`,
    assumptions: [
      `Only ${advUnitsWithinHorizon} ${input.unitLabel} (70% of target) complete within the ${horizonMonths}-month horizon; reaching the full ${input.targetUnits} target slips to ~${advMonths} months (+${advOverrunMonths} mo overrun).`,
      "Unit CapEx overruns by +25% from grid upgrades, civil works, and component price increases.",
      isCostOnly
        ? "Annual OpEx rises +20% due to peak utility demand charges and emergency site maintenance. Cost-only model ($0 direct revenue)."
        : "Annual OpEx rises +20% while direct revenue/utilization falls 30% amid slower adoption.",
    ],
    constraints: [
      "High risk of breaching minimum operating cash buffer if CapEx is front-loaded.",
      "Target of 250 units cannot be completed within 10 years under adverse grid/permitting slippage without expanding budget & field headcount.",
    ],
    risks: [
      "Capital dilution or debt covenants triggered if core product cash burn worsens.",
      isCostOnly
        ? "Higher per-station CapEx and OpEx drain corporate cash faster without direct charging fee offsets."
        : "Underutilized assets increase fixed depreciation and OpEx drag against 30% lower revenue.",
    ],
    dependencies: [
      "Contingency credit lines or partner co-investment",
      "Strict pause/deferral triggers if cash drops below minimum threshold",
    ],
  });

  return {
    title: input.title,
    horizonYears: years,
    horizonMonths,
    isCostOnly,
    unitLabel: input.unitLabel,
    methodologyNotes: isCostOnly
      ? "Cost-only deterministic range model (Annual Rev / Unit = $0; indirect product demand benefits are intentionally excluded from direct cash flows). Probability percentages are omitted."
      : "Deterministic range-based model computed strictly from explicit unit CapEx, annual OpEx, linear deployment pacing, and attributed annual revenue. Probability percentages are intentionally omitted.",
    disclaimer:
      "Illustrative scenario ranges only — not guaranteed forecasts. All assumptions are editable and must be gated by human board approval and cash-balance checks.",
    input,
    optimistic,
    baseline,
    adverse,
  };
}
