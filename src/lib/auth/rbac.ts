import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { UserRole } from "@/lib/types";

export const SESSION_COOKIE_NAME = "stratium_demo_session";

const SESSION_SECRET =
  process.env.SESSION_SECRET || "stratium-local-demo-session-signing-secret";

export interface SessionContext {
  company: {
    id: string;
    slug: string;
    name: string;
    currency: string;
    historicalCutoffDate: string | null;
    isHistoricalDemo: boolean;
    syntheticDataNotice: string | null;
    recordedCashBalance: number;
    recordedBalanceSource: string;
  };
  user: {
    id: string;
    companyId: string;
    departmentId: string | null;
    departmentName: string | null;
    departmentCode: string | null;
    name: string;
    email: string;
    title: string;
    role: UserRole;
    isDemoAccount: boolean;
  };
}

interface SignedPayload {
  companyId: string;
  userId: string;
  issuedAt: number;
}

export function signSessionToken(payload: SignedPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SignedPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encoded)
    .digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (typeof parsed.companyId === "string" && typeof parsed.userId === "string") {
      return parsed as SignedPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getSessionContext(): Promise<SessionContext> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionToken(raw);

  if (parsed) {
    const user = await prisma.user.findUnique({
      where: { id: parsed.userId },
      include: { company: true, department: true },
    });
    if (user && user.companyId === parsed.companyId) {
      return {
        company: {
          id: user.company.id,
          slug: user.company.slug,
          name: user.company.name,
          currency: user.company.currency,
          historicalCutoffDate: user.company.historicalCutoffDate,
          isHistoricalDemo: user.company.isHistoricalDemo,
          syntheticDataNotice: user.company.syntheticDataNotice,
          recordedCashBalance: user.company.recordedCashBalance,
          recordedBalanceSource: user.company.recordedBalanceSource,
        },
        user: {
          id: user.id,
          companyId: user.companyId,
          departmentId: user.departmentId,
          departmentName: user.department?.name ?? null,
          departmentCode: user.department?.code ?? null,
          name: user.name,
          email: user.email,
          title: user.title,
          role: user.role as UserRole,
          isDemoAccount: user.isDemoAccount,
        },
      };
    }
  }

  // Fallback to default seeded demo company (Tesla Motors 2012 Sim) and Demo Administrator account
  const defaultCompany = await prisma.company.findFirst({
    orderBy: [{ isHistoricalDemo: "desc" }, { createdAt: "asc" }],
  });
  if (!defaultCompany) {
    throw new Error("No company workspace seeded in database. Run prisma db seed.");
  }

  const defaultUser =
    (await prisma.user.findFirst({
      where: { companyId: defaultCompany.id, role: "ADMINISTRATOR" },
      include: { department: true },
    })) ??
    (await prisma.user.findFirst({
      where: { companyId: defaultCompany.id },
      include: { department: true },
    }));

  if (!defaultUser) {
    throw new Error(`No user accounts found for company ${defaultCompany.name}.`);
  }

  return {
    company: {
      id: defaultCompany.id,
      slug: defaultCompany.slug,
      name: defaultCompany.name,
      currency: defaultCompany.currency,
      historicalCutoffDate: defaultCompany.historicalCutoffDate,
      isHistoricalDemo: defaultCompany.isHistoricalDemo,
      syntheticDataNotice: defaultCompany.syntheticDataNotice,
      recordedCashBalance: defaultCompany.recordedCashBalance,
      recordedBalanceSource: defaultCompany.recordedBalanceSource,
    },
    user: {
      id: defaultUser.id,
      companyId: defaultUser.companyId,
      departmentId: defaultUser.departmentId,
      departmentName: defaultUser.department?.name ?? null,
      departmentCode: defaultUser.department?.code ?? null,
      name: defaultUser.name,
      email: defaultUser.email,
      title: defaultUser.title,
      role: defaultUser.role as UserRole,
      isDemoAccount: defaultUser.isDemoAccount,
    },
  };
}

export function canAccessKnowledgeRecord(
  user: SessionContext["user"],
  accessLevel: string,
  recordDepartmentId: string | null
): boolean {
  const role = user.role;
  if (["CEO", "BOARD_MEMBER", "AUDITOR", "ADMINISTRATOR"].includes(role)) {
    return true;
  }
  switch (accessLevel) {
    case "COMPANY_WIDE":
      return true;
    case "LEADERSHIP_ONLY":
      return [
        "CFO",
        "CTO",
        "DEPARTMENT_HEAD",
        "FINANCE_MANAGER",
        "HR_MANAGER",
      ].includes(role);
    case "FINANCE_AND_EXEC":
      return ["CFO", "FINANCE_MANAGER", "PAYMENT_EXECUTOR"].includes(role);
    case "HR_RESTRICTED":
      return role === "HR_MANAGER";
    case "DEPARTMENT_ONLY":
      return (
        ["CFO", "FINANCE_MANAGER"].includes(role) ||
        (!!recordDepartmentId && user.departmentId === recordDepartmentId)
      );
    default:
      return false;
  }
}

export type PermissionAction =
  | "UPLOAD_INTELLIGENCE"
  | "CREATE_MEETING"
  | "RECORD_DECISION"
  | "APPROVE_DECISION"
  | "MANAGE_BUDGET"
  | "MANAGE_INVOICE"
  | "CREATE_PAYMENT_REQUEST"
  | "APPROVE_PAYMENT_DEPT"
  | "APPROVE_PAYMENT_FINANCE"
  | "APPROVE_PAYMENT_EXEC"
  | "EXECUTE_PAYMENT"
  | "MANAGE_ADMIN_POLICIES"
  | "VIEW_AUDIT_LOGS";

const ROLE_PERMISSIONS: Record<PermissionAction, UserRole[]> = {
  UPLOAD_INTELLIGENCE: [
    "BOARD_MEMBER",
    "CEO",
    "CFO",
    "CTO",
    "DEPARTMENT_HEAD",
    "FINANCE_MANAGER",
    "HR_MANAGER",
    "DEPARTMENT_MANAGER",
    "ADMINISTRATOR",
  ],
  CREATE_MEETING: [
    "BOARD_MEMBER",
    "CEO",
    "CFO",
    "CTO",
    "DEPARTMENT_HEAD",
    "FINANCE_MANAGER",
    "ADMINISTRATOR",
  ],
  RECORD_DECISION: [
    "BOARD_MEMBER",
    "CEO",
    "CFO",
    "CTO",
    "DEPARTMENT_HEAD",
    "ADMINISTRATOR",
  ],
  APPROVE_DECISION: ["BOARD_MEMBER", "CEO", "CFO"],
  MANAGE_BUDGET: [
    "CEO",
    "CFO",
    "FINANCE_MANAGER",
    "DEPARTMENT_HEAD",
    "ADMINISTRATOR",
  ],
  MANAGE_INVOICE: [
    "CEO",
    "CFO",
    "FINANCE_MANAGER",
    "PAYMENT_EXECUTOR",
    "ADMINISTRATOR",
  ],
  CREATE_PAYMENT_REQUEST: [
    "BOARD_MEMBER",
    "CEO",
    "CFO",
    "CTO",
    "DEPARTMENT_HEAD",
    "FINANCE_MANAGER",
    "HR_MANAGER",
    "DEPARTMENT_MANAGER",
    "EMPLOYEE",
    "ADMINISTRATOR",
    "PAYMENT_EXECUTOR",
  ],
  APPROVE_PAYMENT_DEPT: [
    "DEPARTMENT_MANAGER",
    "DEPARTMENT_HEAD",
    "CTO",
    "CEO",
    "BOARD_MEMBER",
  ],
  APPROVE_PAYMENT_FINANCE: ["FINANCE_MANAGER", "CFO"],
  APPROVE_PAYMENT_EXEC: ["CEO", "CFO", "BOARD_MEMBER"],
  EXECUTE_PAYMENT: ["PAYMENT_EXECUTOR", "FINANCE_MANAGER", "CFO"],
  MANAGE_ADMIN_POLICIES: ["ADMINISTRATOR", "CEO", "CFO"],
  VIEW_AUDIT_LOGS: [
    "AUDITOR",
    "ADMINISTRATOR",
    "CEO",
    "CFO",
    "BOARD_MEMBER",
    "FINANCE_MANAGER",
  ],
};

export function hasRolePermission(role: UserRole, action: PermissionAction): boolean {
  if (role === "AUDITOR" && action !== "VIEW_AUDIT_LOGS") {
    return false;
  }
  return ROLE_PERMISSIONS[action]?.includes(role) ?? false;
}

export async function recordAuditLog(params: {
  companyId: string;
  user: SessionContext["user"];
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
  authorized: boolean;
  denialReason?: string;
}) {
  await prisma.auditLog.create({
    data: {
      companyId: params.companyId,
      actorUserId: params.user.id,
      actorName: params.user.name,
      actorRole: params.user.role,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      detailsJson: JSON.stringify(params.details ?? {}),
      authorized: params.authorized,
      denialReason: params.denialReason ?? null,
    },
  });
}

export async function assertDepartmentAccess(
  user: SessionContext["user"],
  departmentId: string | null | undefined
): Promise<{ allowed: boolean; reason?: string }> {
  if (
    ["CEO", "CFO", "BOARD_MEMBER", "FINANCE_MANAGER", "AUDITOR", "ADMINISTRATOR", "PAYMENT_EXECUTOR"].includes(
      user.role
    )
  ) {
    return { allowed: true };
  }
  if (!departmentId) {
    return { allowed: true };
  }
  if (user.departmentId === departmentId) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `Department isolation policy: role ${user.role} in ${user.departmentName ?? "unassigned"} cannot access or approve records belonging to another department.`,
  };
}

