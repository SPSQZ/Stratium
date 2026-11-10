import { prisma } from "@/lib/db";
import { canAccessKnowledgeRecord, type SessionContext } from "@/lib/auth/rbac";
import { getCompanyFinancialOverview } from "@/lib/finance/metrics";
import {
  computeThreeScenarios,
  type ScenarioInputParameters,
} from "@/lib/planning/calculator";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function scoreOverlap(queryTokens: string[], targetText: string): number {
  if (queryTokens.length === 0) return 1;
  const hay = targetText.toLowerCase();
  let score = 0;
  for (const tok of queryTokens) {
    if (hay.includes(tok)) {
      score += tok.length > 5 ? 3 : 2;
    }
  }
  return score;
}

export async function toolRetrieveCompanyIntelligence(
  session: SessionContext,
  args: { query: string; categories?: string[]; limit?: number }
) {
  const limit = Math.min(12, Math.max(3, args.limit ?? 8));
  const queryTokens = tokenize(args.query);

  const [sections, chunks] = await Promise.all([
    prisma.companyProfileSection.findMany({
      where: {
        companyId: session.company.id,
        ...(args.categories && args.categories.length > 0
          ? { category: { in: args.categories } }
          : {}),
      },
      include: { department: true },
    }),
    prisma.documentChunk.findMany({
      where: {
        companyId: session.company.id,
        ...(args.categories && args.categories.length > 0
          ? { category: { in: args.categories } }
          : {}),
      },
      include: { document: true },
    }),
  ]);

  const permittedSections = sections.filter((s) =>
    canAccessKnowledgeRecord(session.user, s.accessLevel, s.departmentId)
  );
  const permittedChunks = chunks.filter((c) =>
    canAccessKnowledgeRecord(session.user, c.accessLevel, c.departmentId)
  );

  const scoredSections = permittedSections
    .map((s) => ({
      type: "PROFILE_SECTION" as const,
      id: s.id,
      category: s.category,
      title: s.title,
      content: `${s.summary}\n${s.content}`,
      source: s.sourceCitation || s.sourceType,
      sourceType: s.sourceType,
      verificationStatus: s.verificationStatus,
      effectiveDate: s.effectiveDate,
      score:
        scoreOverlap(queryTokens, `${s.title} ${s.summary} ${s.content} ${s.category}`) +
        1,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.ceil(limit / 2));

  const scoredChunks = permittedChunks
    .map((c) => ({
      type: "DOCUMENT_CHUNK" as const,
      id: c.id,
      category: c.category,
      title: `${c.document.fileName} (Chunk ${c.chunkIndex + 1})`,
      content: c.content,
      source: `${c.document.fileName} — ${c.document.sourceLabel}`,
      sourceType: c.document.sourceType,
      verificationStatus: c.document.verificationStatus,
      effectiveDate: null as string | null,
      score: scoreOverlap(queryTokens, `${c.document.fileName} ${c.content} ${c.category}`),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.ceil(limit / 2));

  const restrictedCount =
    sections.length - permittedSections.length + (chunks.length - permittedChunks.length);

  return {
    historicalCutoffDate: session.company.historicalCutoffDate,
    restrictedRecordsOmittedForRole: restrictedCount,
    results: [...scoredSections, ...scoredChunks].sort((a, b) => b.score - a.score),
  };
}

export async function toolQueryFinancialRecords(
  session: SessionContext,
  args: { scope?: "SUMMARY" | "BUDGETS" | "INVOICES" | "TRANSACTIONS" | "ALL" }
) {
  const overview = await getCompanyFinancialOverview(session.company.id);
  const [recentInvoices, pendingRequests] = await Promise.all([
    prisma.invoice.findMany({
      where: { companyId: session.company.id },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.paymentRequest.findMany({
      where: {
        companyId: session.company.id,
        status: {
          in: [
            "PENDING_VALIDATION",
            "PENDING_DEPT_APPROVAL",
            "PENDING_FINANCE_APPROVAL",
            "PENDING_EXEC_APPROVAL",
            "APPROVED_READY_FOR_EXECUTION",
          ],
        },
      },
      include: { department: true },
    }),
  ]);

  return {
    scope: args.scope ?? "ALL",
    currency: overview.currency,
    recordedCashBalance: overview.recordedCashBalance,
    recordedBalanceSource: overview.recordedBalanceSource,
    totalIncomingCompleted: overview.totalIncomingCompleted,
    totalOutgoingCompleted: overview.totalOutgoingCompleted,
    outstandingReceivables: overview.outstandingReceivables,
    overdueReceivables: overview.overdueReceivables,
    outstandingPayables: overview.outstandingPayables,
    overduePayables: overview.overduePayables,
    approvedBudgetTotal: overview.approvedBudgetTotal,
    actualBudgetExpenditure: overview.actualBudgetExpenditure,
    pendingCommittedExpenditure: overview.pendingCommittedExpenditure,
    remainingBudgetTotal: overview.remainingBudgetTotal,
    upcomingObligations30d: overview.upcomingObligations30d,
    forecastedCashConsumption30d: overview.forecastedCashConsumption30d,
    budgets: overview.budgets.map((b) => ({
      name: b.name,
      department: b.departmentName,
      allocated: b.allocatedAmount,
      spent: b.actualSpent,
      pendingCommitted: b.pendingCommitted,
      remaining: b.remainingAmount,
      status: b.status,
    })),
    openInvoicesSample: recentInvoices.map((i) => ({
      invoiceNumber: i.invoiceNumber,
      direction: i.direction,
      counterparty: i.counterpartyName,
      amount: i.amount,
      paidAmount: i.paidAmount,
      status: i.status,
      dueDate: i.dueDate.toISOString().slice(0, 10),
    })),
    pendingApprovals: pendingRequests.map((p) => ({
      title: p.title,
      department: p.department?.name ?? "Company-Wide",
      amount: p.amount,
      status: p.status,
    })),
  };
}

export async function toolRetrieveHistoricalDecisions(
  session: SessionContext,
  args: { query?: string }
) {
  const decisions = await prisma.strategicDecision.findMany({
    where: { companyId: session.company.id },
    include: { meeting: true, department: true, budgets: true },
    orderBy: { createdAt: "desc" },
  });

  const q = (args.query ?? "").toLowerCase();
  const filtered = q
    ? decisions.filter((d) =>
        `${d.title} ${d.description} ${d.selectedOption} ${d.rationale}`
          .toLowerCase()
          .includes(q)
      )
    : decisions;

  const list = filtered.length > 0 ? filtered : decisions;
  return {
    count: list.length,
    decisions: list.map((d) => ({
      id: d.id,
      title: d.title,
      approvalStatus: d.approvalStatus,
      selectedOption: d.selectedOption,
      rationale: d.rationale,
      assumptions: d.assumptions,
      risks: d.risks,
      estimatedCost: d.estimatedCost,
      financialImplications: d.financialImplications,
      department: d.department?.name ?? "Executive",
      meetingTitle: d.meeting?.title ?? null,
      linkedBudgets: d.budgets.map((b) => ({
        name: b.name,
        allocatedAmount: b.allocatedAmount,
        status: b.status,
      })),
    })),
  };
}

export async function toolCalculateFinancialScenario(
  session: SessionContext,
  args: Partial<ScenarioInputParameters>
) {
  const overview = await getCompanyFinancialOverview(session.company.id);
  const input: ScenarioInputParameters = {
    title: args.title || "Strategic Expansion Capacity Model",
    horizonYears: args.horizonYears ?? 10,
    targetUnits: args.targetUnits ?? 250,
    unitLabel: args.unitLabel || "Infrastructure Units / Stations",
    unitCapex: args.unitCapex ?? 175000,
    annualOpexPerUnit: args.annualOpexPerUnit ?? 18000,
    annualRevenuePerUnit: args.annualRevenuePerUnit ?? 0,
    startingCashReserve: args.startingCashReserve ?? overview.recordedCashBalance,
    workforcePerTenUnits: args.workforcePerTenUnits ?? 1.5,
    capexLeadMonths: args.capexLeadMonths ?? 4,
  };
  return computeThreeScenarios(input);
}

export async function toolSearchPublicBenchmarks(
  session: SessionContext,
  args: { query: string }
) {
  const cutoff = session.company.historicalCutoffDate;
  const q = args.query.toLowerCase();

  // Enforce strict historical simulation boundary for Tesla 2012 demo
  const post2012Keywords = [
    "model 3",
    "model x delivery",
    "model y",
    "cybertruck",
    "gigafactory",
    "solarcity acquisition",
    "2013",
    "2014",
    "2015",
    "2016",
    "2017",
    "2018",
    "2019",
    "2020",
    "2021",
    "2022",
    "2023",
    "2024",
    "2025",
    "2026",
  ];

  const mentionsPostCutoff =
    cutoff && post2012Keywords.some((kw) => q.includes(kw));

  const publicSections = await prisma.companyProfileSection.findMany({
    where: {
      companyId: session.company.id,
      sourceType: "PUBLIC_HISTORICAL",
    },
  });

  const tokens = tokenize(args.query);
  const matched = publicSections
    .map((s) => ({
      title: s.title,
      summary: s.summary,
      content: s.content,
      sourceCitation: s.sourceCitation,
      effectiveDate: s.effectiveDate,
      score: scoreOverlap(tokens, `${s.title} ${s.summary} ${s.content}`),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return {
    historicalCutoffDate: cutoff,
    postCutoffWarning: mentionsPostCutoff
      ? `Query references topics outside the historical simulation cutoff (${cutoff}). Information published after December 2012 is strictly excluded from this historical workspace.`
      : null,
    publicRecords: matched,
  };
}

