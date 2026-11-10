import { prisma } from "@/lib/db";
import { getCompanyReferenceDate } from "@/lib/types";

export interface BudgetSummary {
  id: string;
  name: string;
  category: string;
  departmentId: string | null;
  departmentName: string;
  decisionId: string | null;
  decisionTitle: string | null;
  fiscalPeriod: string;
  allocatedAmount: number;
  actualSpent: number;
  pendingCommitted: number;
  remainingAmount: number;
  utilizationPct: number;
  variance: number;
  status: string;
  notes: string;
  isSynthetic: boolean;
}

export interface DepartmentSpendSummary {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  allocated: number;
  actualSpent: number;
  pendingCommitted: number;
  remaining: number;
}

export interface FinancialOverview {
  companyId: string;
  currency: string;
  recordedCashBalance: number;
  recordedBalanceSource: string;
  totalIncomingCompleted: number;
  totalOutgoingCompleted: number;
  netRecordedCashFlow: number;
  outstandingReceivables: number;
  overdueReceivables: number;
  outstandingPayables: number;
  overduePayables: number;
  approvedBudgetTotal: number;
  actualBudgetExpenditure: number;
  pendingCommittedExpenditure: number;
  remainingBudgetTotal: number;
  upcomingObligations30d: number;
  forecastedCashConsumption30d: number;
  pendingApprovalCount: number;
  pendingApprovalAmount: number;
  budgets: BudgetSummary[];
  departmentSpend: DepartmentSpendSummary[];
  monthlyCashFlow: Array<{
    month: string;
    incoming: number;
    outgoing: number;
    projectedOutgoing: number;
  }>;
}

export async function getCompanyFinancialOverview(
  companyId: string
): Promise<FinancialOverview> {
  const [
    company,
    departments,
    budgets,
    invoices,
    transactions,
    paymentRequests,
    calendarEvents,
  ] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
    prisma.department.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
    }),
    prisma.budget.findMany({
      where: { companyId },
      include: { department: true, decision: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invoice.findMany({
      where: { companyId },
      orderBy: { dueDate: "asc" },
    }),
    prisma.transaction.findMany({
      where: { companyId },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.paymentRequest.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.calendarEvent.findMany({
      where: { companyId },
      orderBy: { eventDate: "asc" },
    }),
  ]);

  const completedTx = transactions.filter((t) => t.status === "COMPLETED");
  const totalIncomingCompleted = completedTx
    .filter((t) => t.direction === "INCOMING")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalOutgoingCompleted = completedTx
    .filter((t) => t.direction === "OUTGOING")
    .reduce((sum, t) => sum + t.amount, 0);

  const now = getCompanyReferenceDate(company);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const openReceivables = invoices.filter(
    (inv) =>
      inv.direction === "RECEIVABLE" &&
      ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status)
  );
  const outstandingReceivables = openReceivables.reduce(
    (sum, inv) => sum + Math.max(0, inv.amount - inv.paidAmount),
    0
  );
  const overdueReceivables = openReceivables
    .filter((inv) => inv.status === "OVERDUE" || inv.dueDate < now)
    .reduce((sum, inv) => sum + Math.max(0, inv.amount - inv.paidAmount), 0);

  const openPayables = invoices.filter(
    (inv) =>
      inv.direction === "PAYABLE" &&
      ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status)
  );
  const outstandingPayables = openPayables.reduce(
    (sum, inv) => sum + Math.max(0, inv.amount - inv.paidAmount),
    0
  );
  const overduePayables = openPayables
    .filter((inv) => inv.status === "OVERDUE" || inv.dueDate < now)
    .reduce((sum, inv) => sum + Math.max(0, inv.amount - inv.paidAmount), 0);

  // Compute budget summaries strictly from linked transactions & active payment requests
  const budgetSummaries: BudgetSummary[] = budgets.map((b) => {
    const actualSpent = completedTx
      .filter((t) => t.direction === "OUTGOING" && t.budgetId === b.id)
      .reduce((sum, t) => sum + t.amount, 0);

    const pendingCommitted = paymentRequests
      .filter(
        (pr) =>
          pr.direction === "OUTGOING" &&
          pr.budgetId === b.id &&
          [
            "PENDING_VALIDATION",
            "PENDING_DEPT_APPROVAL",
            "PENDING_FINANCE_APPROVAL",
            "PENDING_EXEC_APPROVAL",
            "APPROVED_READY_FOR_EXECUTION",
            "PROCESSING",
          ].includes(pr.status)
      )
      .reduce((sum, pr) => sum + pr.amount, 0);

    const remainingAmount = b.allocatedAmount - actualSpent;
    const utilizationPct =
      b.allocatedAmount > 0 ? (actualSpent / b.allocatedAmount) * 100 : 0;

    return {
      id: b.id,
      name: b.name,
      category: b.category,
      departmentId: b.departmentId,
      departmentName: b.department?.name ?? "Company-Wide",
      decisionId: b.decisionId,
      decisionTitle: b.decision?.title ?? null,
      fiscalPeriod: b.fiscalPeriod,
      allocatedAmount: b.allocatedAmount,
      actualSpent,
      pendingCommitted,
      remainingAmount,
      utilizationPct,
      variance: b.allocatedAmount - actualSpent,
      status: b.status,
      notes: b.notes,
      isSynthetic: b.isSynthetic,
    };
  });

  const activeApprovedBudgets = budgetSummaries.filter((b) =>
    ["APPROVED", "ACTIVE"].includes(b.status)
  );
  const approvedBudgetTotal = activeApprovedBudgets.reduce(
    (sum, b) => sum + b.allocatedAmount,
    0
  );
  const actualBudgetExpenditure = activeApprovedBudgets.reduce(
    (sum, b) => sum + b.actualSpent,
    0
  );
  const pendingCommittedExpenditure = activeApprovedBudgets.reduce(
    (sum, b) => sum + b.pendingCommitted,
    0
  );
  const remainingBudgetTotal = approvedBudgetTotal - actualBudgetExpenditure;

  const upcomingEvents30d = calendarEvents.filter(
    (ev) =>
      ev.eventDate >= new Date(now.getTime() - 24 * 60 * 60 * 1000) &&
      ev.eventDate <= in30Days &&
      ev.direction === "OUTGOING"
  );

  const upcomingObligations30d = upcomingEvents30d
    .filter((ev) => ["APPROVED", "CONTRACTED", "DUE"].includes(ev.status))
    .reduce((sum, ev) => sum + ev.amount, 0);

  const forecastedCashConsumption30d = upcomingEvents30d
    .filter((ev) =>
      ["FORECASTED", "PROPOSED", "APPROVED", "CONTRACTED", "DUE"].includes(ev.status)
    )
    .reduce((sum, ev) => sum + ev.amount, 0);

  const pendingApprovals = paymentRequests.filter((pr) =>
    [
      "PENDING_VALIDATION",
      "PENDING_DEPT_APPROVAL",
      "PENDING_FINANCE_APPROVAL",
      "PENDING_EXEC_APPROVAL",
      "APPROVED_READY_FOR_EXECUTION",
    ].includes(pr.status)
  );

  const departmentSpend: DepartmentSpendSummary[] = departments.map((dept) => {
    const deptBudgets = budgetSummaries.filter(
      (b) => b.departmentId === dept.id && ["APPROVED", "ACTIVE"].includes(b.status)
    );
    const allocated = deptBudgets.reduce((s, b) => s + b.allocatedAmount, 0);
    const actualSpent = completedTx
      .filter((t) => t.direction === "OUTGOING" && t.departmentId === dept.id)
      .reduce((s, t) => s + t.amount, 0);
    const pendingCommitted = paymentRequests
      .filter(
        (pr) =>
          pr.direction === "OUTGOING" &&
          pr.departmentId === dept.id &&
          [
            "PENDING_VALIDATION",
            "PENDING_DEPT_APPROVAL",
            "PENDING_FINANCE_APPROVAL",
            "PENDING_EXEC_APPROVAL",
            "APPROVED_READY_FOR_EXECUTION",
            "PROCESSING",
          ].includes(pr.status)
      )
      .reduce((s, pr) => s + pr.amount, 0);

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      departmentCode: dept.code,
      allocated,
      actualSpent,
      pendingCommitted,
      remaining: allocated - actualSpent,
    };
  });

  // Build 4-month rolling cash flow summary (2 past/current + 1 future)
  const monthBuckets = new Map<
    string,
    { incoming: number; outgoing: number; projectedOutgoing: number }
  >();

  for (let offset = -2; offset <= 2; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthBuckets.set(key, { incoming: 0, outgoing: 0, projectedOutgoing: 0 });
  }

  for (const tx of completedTx) {
    const key = `${tx.occurredAt.getFullYear()}-${String(
      tx.occurredAt.getMonth() + 1
    ).padStart(2, "0")}`;
    const bucket = monthBuckets.get(key);
    if (bucket) {
      if (tx.direction === "INCOMING") bucket.incoming += tx.amount;
      if (tx.direction === "OUTGOING") bucket.outgoing += tx.amount;
    }
  }

  for (const ev of calendarEvents) {
    if (
      ev.direction === "OUTGOING" &&
      ["FORECASTED", "PROPOSED", "APPROVED", "CONTRACTED", "DUE"].includes(ev.status)
    ) {
      const key = `${ev.eventDate.getFullYear()}-${String(
        ev.eventDate.getMonth() + 1
      ).padStart(2, "0")}`;
      const bucket = monthBuckets.get(key);
      if (bucket) {
        bucket.projectedOutgoing += ev.amount;
      }
    }
  }

  const monthlyCashFlow = Array.from(monthBuckets.entries()).map(([month, v]) => ({
    month,
    ...v,
  }));

  return {
    companyId,
    currency: company.currency,
    recordedCashBalance: company.recordedCashBalance,
    recordedBalanceSource: company.recordedBalanceSource,
    totalIncomingCompleted,
    totalOutgoingCompleted,
    netRecordedCashFlow: totalIncomingCompleted - totalOutgoingCompleted,
    outstandingReceivables,
    overdueReceivables,
    outstandingPayables,
    overduePayables,
    approvedBudgetTotal,
    actualBudgetExpenditure,
    pendingCommittedExpenditure,
    remainingBudgetTotal,
    upcomingObligations30d,
    forecastedCashConsumption30d,
    pendingApprovalCount: pendingApprovals.length,
    pendingApprovalAmount: pendingApprovals.reduce((s, p) => s + p.amount, 0),
    budgets: budgetSummaries,
    departmentSpend,
    monthlyCashFlow,
  };
}

