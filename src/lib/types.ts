export const USER_ROLES = [
  "BOARD_MEMBER",
  "CEO",
  "CFO",
  "CTO",
  "DEPARTMENT_HEAD",
  "FINANCE_MANAGER",
  "HR_MANAGER",
  "DEPARTMENT_MANAGER",
  "EMPLOYEE",
  "AUDITOR",
  "ADMINISTRATOR",
  "PAYMENT_EXECUTOR",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  BOARD_MEMBER: "Board Member",
  CEO: "CEO",
  CFO: "CFO",
  CTO: "CTO",
  DEPARTMENT_HEAD: "Department Head",
  FINANCE_MANAGER: "Finance Manager",
  HR_MANAGER: "HR Manager",
  DEPARTMENT_MANAGER: "Department Manager",
  EMPLOYEE: "Employee",
  AUDITOR: "Auditor (Read-Only)",
  ADMINISTRATOR: "Administrator",
  PAYMENT_EXECUTOR: "Payment Executor",
};

export const INTELLIGENCE_CATEGORIES = [
  "STRATEGY",
  "PRODUCTS_TECH",
  "CUSTOMERS",
  "COMPETITORS",
  "FINANCIALS",
  "OPERATIONS",
  "WORKFORCE",
  "RISKS",
  "HISTORICAL_DECISIONS",
] as const;

export type IntelligenceCategory = (typeof INTELLIGENCE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<IntelligenceCategory, string> = {
  STRATEGY: "Company Strategy",
  PRODUCTS_TECH: "Products & Technology",
  CUSTOMERS: "Customers",
  COMPETITORS: "Competitors",
  FINANCIALS: "Financials",
  OPERATIONS: "Operations",
  WORKFORCE: "Workforce",
  RISKS: "Risks",
  HISTORICAL_DECISIONS: "Historical Decisions",
};

export const CALENDAR_STATUSES = [
  "FORECASTED",
  "PROPOSED",
  "APPROVED",
  "CONTRACTED",
  "DUE",
  "PAID",
  "FAILED",
  "CANCELLED",
] as const;

export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

export interface StructuredBoardroomResponse {
  mode: "LLM_TOOL_ORCHESTRATED" | "DETERMINISTIC_TOOL_ENGINE";
  modelLabel: string;
  historicalCutoffApplied: string | null;
  directAnswer: string;
  conflictAnalysis?: {
    hasConflict: boolean;
    underlyingConflict: string;
    perspectives: Array<{
      roleOrSpeaker: string;
      position: string;
      evidenceCheck: string;
      unsupportedAssumptions: string[];
    }>;
    balancedAssessment: string;
    recommendedAlternatives: string[];
  };
  supportingEvidence: Array<{
    claim: string;
    source: string;
    verificationBadge: "VERIFIED_PUBLIC" | "SYNTHETIC_RECORD" | "USER_PROVIDED_UNVERIFIED" | "MANAGEMENT_ASSUMPTION" | "AI_HYPOTHESIS";
  }>;
  counterargument: string;
  financialImpact: string;
  operationalImpact: string;
  risks: string[];
  uncertaintiesAndMissingData: string[];
  suggestedNextQuestions: string[];
  toolTrace: Array<{
    tool: string;
    summary: string;
  }>;
  suggestedScenarioParams?: {
    title: string;
    horizonYears: number;
    targetUnits: number;
    unitLabel?: string;
    unitCapex: number;
    annualOpexPerUnit: number;
    annualRevenuePerUnit: number;
    workingCapitalReserve: number;
  };
  suggestedDecisionDraft?: {
    title: string;
    objective: string;
    selectedOption: string;
    alternativesConsidered: string;
    rationale: string;
    assumptions: string;
    risks: string;
    financialImplications: string;
    estimatedCost: number;
  };
}

export function formatCurrency(amount: number, currency = "USD"): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: Math.abs(safe) >= 1000 ? 0 : 2,
    }).format(safe);
  } catch {
    return `$${safe.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
}

export function formatDateShort(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getCompanyReferenceDate(company: {
  isHistoricalDemo?: boolean;
  historicalCutoffDate?: string | null;
}): Date {
  if (company.isHistoricalDemo && company.historicalCutoffDate) {
    // Anchor historical simulation operationally in mid-November 2012 (within Dec 31, 2012 cutoff)
    return new Date("2012-11-15T12:00:00.000Z");
  }
  return new Date();
}

