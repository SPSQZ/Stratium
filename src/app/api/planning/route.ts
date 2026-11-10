import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext, recordAuditLog } from "@/lib/auth/rbac";
import { getCompanyFinancialOverview } from "@/lib/finance/metrics";
import {
  computeThreeScenarios,
  type ScenarioInputParameters,
} from "@/lib/planning/calculator";

export async function GET() {
  try {
    const session = await getSessionContext();
    const [scenarios, overview, decisions] = await Promise.all([
      prisma.strategicScenario.findMany({
        where: { companyId: session.company.id },
        include: { decision: true },
        orderBy: { createdAt: "desc" },
      }),
      getCompanyFinancialOverview(session.company.id),
      prisma.strategicDecision.findMany({
        where: { companyId: session.company.id },
        select: { id: true, title: true, approvalStatus: true },
      }),
    ]);

    const computedScenarios = scenarios.map((s) => {
      const params = JSON.parse(
        s.baseParametersJson
      ) as ScenarioInputParameters;
      return {
        id: s.id,
        decisionId: s.decisionId,
        decisionTitle: s.decision?.title ?? null,
        questionContext: s.questionContext,
        createdAt: s.createdAt,
        computed: computeThreeScenarios({
          ...params,
          startingCashReserve:
            params.startingCashReserve || overview.recordedCashBalance,
        }),
      };
    });

    return NextResponse.json({
      company: session.company,
      recordedCashBalance: overview.recordedCashBalance,
      remainingBudgetTotal: overview.remainingBudgetTotal,
      scenarios: computedScenarios,
      decisions,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load strategic scenarios", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionContext();
    const body = (await request.json()) as Partial<ScenarioInputParameters> & {
      questionContext?: string;
      decisionId?: string | null;
      save?: boolean;
    };

    const overview = await getCompanyFinancialOverview(session.company.id);

    const input: ScenarioInputParameters = {
      title: body.title?.trim() || "Strategic Expansion Scenario",
      horizonYears: Math.max(1, Math.min(15, Number(body.horizonYears) || 10)),
      targetUnits: Math.max(1, Number(body.targetUnits) || 250),
      unitLabel: body.unitLabel?.trim() || "Infrastructure Units",
      unitCapex: Math.max(0, Number(body.unitCapex) || 165000),
      annualOpexPerUnit: Math.max(0, Number(body.annualOpexPerUnit) || 18500),
      annualRevenuePerUnit: Math.max(0, Number(body.annualRevenuePerUnit) || 0),
      startingCashReserve:
        Number(body.startingCashReserve) || overview.recordedCashBalance,
      workforcePerTenUnits: Math.max(
        0.1,
        Number(body.workforcePerTenUnits) || 1.5
      ),
      capexLeadMonths: Math.max(0, Number(body.capexLeadMonths) || 4),
    };

    const computed = computeThreeScenarios(input);

    if (body.save === false) {
      return NextResponse.json({ computed });
    }

    const saved = await prisma.strategicScenario.create({
      data: {
        companyId: session.company.id,
        decisionId: body.decisionId || null,
        title: input.title,
        horizonYears: input.horizonYears,
        questionContext:
          body.questionContext?.trim() ||
          "Strategic range exploration generated in Strategic Planning.",
        baseParametersJson: JSON.stringify(input),
        optimisticJson: JSON.stringify(computed.optimistic),
        baselineJson: JSON.stringify(computed.baseline),
        adverseJson: JSON.stringify(computed.adverse),
        methodologyNotes: computed.methodologyNotes,
      },
    });

    await recordAuditLog({
      companyId: session.company.id,
      user: session.user,
      action: "SCENARIO_CREATED",
      entityType: "StrategicScenario",
      entityId: saved.id,
      authorized: true,
      details: {
        title: saved.title,
        horizonYears: saved.horizonYears,
        targetUnits: input.targetUnits,
      },
    });

    return NextResponse.json({ id: saved.id, computed }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to run scenario model", detail: String(err) },
      { status: 500 }
    );
  }
}

