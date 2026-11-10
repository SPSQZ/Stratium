import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionContext,
  hasRolePermission,
  recordAuditLog,
} from "@/lib/auth/rbac";
import { getCompanyReferenceDate } from "@/lib/types";

function resolveNextPayDate(
  refDate: Date,
  payDayOfMonth: number,
  explicitDate?: string | null
): Date {
  if (explicitDate && explicitDate.trim()) {
    const parsed = new Date(explicitDate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const day = Math.max(1, Math.min(28, Math.round(payDayOfMonth || 28)));
  const candidate = new Date(
    Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), day, 12, 0, 0)
  );
  if (candidate.getTime() <= refDate.getTime()) {
    candidate.setUTCMonth(candidate.getUTCMonth() + 1);
  }
  return candidate;
}

async function syncEmployeePayrollCalendarEvent(params: {
  companyId: string;
  departmentId: string | null;
  employeeName: string;
  previousName?: string;
  monthlySalary: number;
  payCycle: string;
  employmentType: string;
  payrollStatus: string;
  nextPayDate: Date;
}) {
  const namesToClean = Array.from(
    new Set(
      [params.employeeName, params.previousName]
        .filter(Boolean)
        .map((n) => `Scheduled Payroll — ${n}`)
    )
  );
  if (namesToClean.length > 0) {
    await prisma.calendarEvent.deleteMany({
      where: {
        companyId: params.companyId,
        sourceLabel: "Admin Payroll Schedule",
        status: "FORECASTED",
        title: { in: namesToClean },
      },
    });
  }

  if (params.monthlySalary > 0 && params.payrollStatus === "ACTIVE") {
    await prisma.calendarEvent.create({
      data: {
        companyId: params.companyId,
        departmentId: params.departmentId,
        title: `Scheduled Payroll — ${params.employeeName}`,
        description: `${params.payCycle} ${params.employmentType} salary disbursement schedule`,
        eventDate: params.nextPayDate,
        amount: params.monthlySalary,
        direction: "OUTGOING",
        category: "Employee Payroll",
        status: "FORECASTED",
        sourceLabel: "Admin Payroll Schedule",
        isSynthetic: true,
      },
    });
  }
}

export async function GET() {
  try {
    const session = await getSessionContext();
    const canViewAudit = hasRolePermission(session.user.role, "VIEW_AUDIT_LOGS");

    const [departments, users, approvalPolicies, auditLogs] = await Promise.all([
      prisma.department.findMany({
        where: { companyId: session.company.id },
        include: { parentDepartment: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { companyId: session.company.id },
        include: { department: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }),
      prisma.approvalPolicy.findMany({
        where: { companyId: session.company.id },
        orderBy: { minAmount: "asc" },
      }),
      canViewAudit
        ? prisma.auditLog.findMany({
            where: { companyId: session.company.id },
            orderBy: { createdAt: "desc" },
            take: 60,
          })
        : Promise.resolve([]),
    ]);

    const paidActiveUsers = users.filter(
      (u) => u.monthlySalary > 0 && u.payrollStatus !== "PAUSED"
    );
    const totalMonthlyPayroll = paidActiveUsers.reduce(
      (sum, u) => sum + u.monthlySalary,
      0
    );

    return NextResponse.json({
      company: session.company,
      currentUser: session.user,
      canViewAudit,
      departments,
      users,
      payrollSummary: {
        activePaidEmployees: paidActiveUsers.length,
        totalEmployees: users.length,
        totalMonthlyPayroll,
      },
      approvalPolicies,
      auditLogs,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load administration data", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionContext();
    const body = (await request.json()) as {
      kind:
        | "CREATE_POLICY"
        | "CREATE_USER"
        | "UPDATE_USER_PAYROLL"
        | "CREATE_DEPARTMENT";
      name?: string;
      minAmount?: number;
      maxAmount?: number | null;
      requiresDeptManager?: boolean;
      requiresFinanceManager?: boolean;
      requiresExecutiveOrBoard?: boolean;
      // User & Payroll
      userId?: string;
      email?: string;
      title?: string;
      role?: string;
      departmentId?: string | null;
      employmentType?: string;
      monthlySalary?: number;
      payCycle?: string;
      payDayOfMonth?: number;
      payoutEmail?: string;
      bankAccountRef?: string;
      nextPayDate?: string | null;
      payrollStatus?: string;
      scheduleCalendarEvent?: boolean;
      // Dept
      code?: string;
      headTitle?: string;
      description?: string;
      parentDepartmentId?: string | null;
    };

    const isEmployeeAction =
      body.kind === "CREATE_USER" || body.kind === "UPDATE_USER_PAYROLL";
    const canManagePolicies = hasRolePermission(
      session.user.role,
      "MANAGE_ADMIN_POLICIES"
    );
    const canManagePeople =
      canManagePolicies || session.user.role === "HR_MANAGER";

    if (isEmployeeAction ? !canManagePeople : !canManagePolicies) {
      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "ADMIN_POLICY_CHANGE_DENIED",
        entityType: isEmployeeAction ? "User" : "ApprovalPolicy",
        entityId: body.userId || "NEW",
        authorized: false,
        denialReason: `Role ${session.user.role} cannot modify ${
          isEmployeeAction ? "employee/payroll records" : "policies or org structure"
        }.`,
      });
      return NextResponse.json(
        {
          error: `Permission denied: role ${session.user.role} cannot modify governance or payroll settings.`,
        },
        { status: 403 }
      );
    }

    if (body.kind === "CREATE_POLICY") {
      if (!body.name?.trim()) {
        return NextResponse.json(
          { error: "Policy name is required." },
          { status: 400 }
        );
      }
      const policy = await prisma.approvalPolicy.create({
        data: {
          companyId: session.company.id,
          name: body.name.trim(),
          minAmount: Number(body.minAmount) || 0,
          maxAmount:
            body.maxAmount !== undefined && body.maxAmount !== null
              ? Number(body.maxAmount)
              : null,
          requiresDeptManager: body.requiresDeptManager ?? true,
          requiresFinanceManager: body.requiresFinanceManager ?? true,
          requiresExecutiveOrBoard: body.requiresExecutiveOrBoard ?? false,
          isActive: true,
        },
      });
      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "APPROVAL_POLICY_CREATED",
        entityType: "ApprovalPolicy",
        entityId: policy.id,
        authorized: true,
        details: { name: policy.name, minAmount: policy.minAmount },
      });
      return NextResponse.json({ policy }, { status: 201 });
    }

    if (body.kind === "CREATE_DEPARTMENT") {
      if (!body.name?.trim() || !body.code?.trim()) {
        return NextResponse.json(
          { error: "Department name and code are required." },
          { status: 400 }
        );
      }
      const dept = await prisma.department.create({
        data: {
          companyId: session.company.id,
          name: body.name.trim(),
          code: body.code.trim().toUpperCase(),
          parentDepartmentId: body.parentDepartmentId || null,
          headTitle: body.headTitle?.trim() || "Department Head",
          description: body.description?.trim() || "Corporate department",
        },
      });
      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "DEPARTMENT_CREATED",
        entityType: "Department",
        entityId: dept.id,
        authorized: true,
      });
      return NextResponse.json({ department: dept }, { status: 201 });
    }

    if (body.kind === "CREATE_USER") {
      if (!body.name?.trim() || !body.email?.trim() || !body.role) {
        return NextResponse.json(
          { error: "Name, email, and role are required." },
          { status: 400 }
        );
      }
      const cleanEmail = body.email.trim().toLowerCase();
      const existingEmail = await prisma.user.findUnique({
        where: {
          companyId_email: {
            companyId: session.company.id,
            email: cleanEmail,
          },
        },
        select: { id: true },
      });
      if (existingEmail) {
        return NextResponse.json(
          {
            error: `An employee with email ${cleanEmail} already exists in this company.`,
          },
          { status: 400 }
        );
      }

      const monthlySalary = Math.max(0, Number(body.monthlySalary) || 0);
      const payDayOfMonth = Math.max(
        1,
        Math.min(28, Math.round(Number(body.payDayOfMonth) || 28))
      );
      const employmentType = body.employmentType?.trim() || "FULL_TIME";
      const payCycle = body.payCycle?.trim() || "MONTHLY";
      const payrollStatus =
        body.payrollStatus?.trim() ||
        (monthlySalary > 0 ? "ACTIVE" : "UNSCHEDULED");
      const payoutEmail = body.payoutEmail?.trim() || cleanEmail;
      const refNow = getCompanyReferenceDate(session.company);
      const nextPayDate =
        monthlySalary > 0 || body.nextPayDate
          ? resolveNextPayDate(refNow, payDayOfMonth, body.nextPayDate)
          : null;

      const user = await prisma.user.create({
        data: {
          companyId: session.company.id,
          departmentId: body.departmentId || null,
          name: body.name.trim(),
          email: cleanEmail,
          title: body.title?.trim() || body.role,
          role: body.role,
          employmentType,
          monthlySalary,
          payCycle,
          payDayOfMonth,
          payoutEmail,
          bankAccountRef: body.bankAccountRef?.trim() || "",
          nextPayDate,
          payrollStatus,
          isDemoAccount: true,
        },
        include: { department: true },
      });

      if (nextPayDate && body.scheduleCalendarEvent !== false) {
        await syncEmployeePayrollCalendarEvent({
          companyId: session.company.id,
          departmentId: user.departmentId,
          employeeName: user.name,
          monthlySalary: user.monthlySalary,
          payCycle: user.payCycle,
          employmentType: user.employmentType,
          payrollStatus: user.payrollStatus,
          nextPayDate,
        });
      }

      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "USER_CREATED",
        entityType: "User",
        entityId: user.id,
        authorized: true,
        details: {
          role: user.role,
          monthlySalary: user.monthlySalary,
          payCycle: user.payCycle,
          payDayOfMonth: user.payDayOfMonth,
        },
      });
      return NextResponse.json({ user }, { status: 201 });
    }

    if (body.kind === "UPDATE_USER_PAYROLL") {
      if (!body.userId) {
        return NextResponse.json(
          { error: "userId is required to update employee payroll." },
          { status: 400 }
        );
      }
      const existing = await prisma.user.findUnique({
        where: { id: body.userId },
      });
      if (!existing || existing.companyId !== session.company.id) {
        return NextResponse.json(
          { error: "Employee not found in active company workspace." },
          { status: 404 }
        );
      }

      const monthlySalary =
        body.monthlySalary !== undefined
          ? Math.max(0, Number(body.monthlySalary) || 0)
          : existing.monthlySalary;
      const payDayOfMonth =
        body.payDayOfMonth !== undefined
          ? Math.max(1, Math.min(28, Math.round(Number(body.payDayOfMonth) || 28)))
          : existing.payDayOfMonth;
      const employmentType =
        body.employmentType?.trim() || existing.employmentType;
      const payCycle = body.payCycle?.trim() || existing.payCycle;
      const payrollStatus =
        body.payrollStatus?.trim() ||
        (monthlySalary > 0 ? "ACTIVE" : "UNSCHEDULED");
      const payoutEmail =
        body.payoutEmail !== undefined
          ? body.payoutEmail.trim() || existing.email
          : existing.payoutEmail;
      const refNow = getCompanyReferenceDate(session.company);
      const nextPayDate =
        monthlySalary > 0 || body.nextPayDate
          ? resolveNextPayDate(
              refNow,
              payDayOfMonth,
              body.nextPayDate !== undefined
                ? body.nextPayDate
                : body.payDayOfMonth !== undefined
                ? null
                : existing.nextPayDate
                ? existing.nextPayDate.toISOString().slice(0, 10)
                : null
            )
          : null;

      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          title: body.title?.trim() || existing.title,
          departmentId:
            body.departmentId !== undefined
              ? body.departmentId || null
              : existing.departmentId,
          employmentType,
          monthlySalary,
          payCycle,
          payDayOfMonth,
          payoutEmail,
          bankAccountRef:
            body.bankAccountRef !== undefined
              ? body.bankAccountRef.trim()
              : existing.bankAccountRef,
          nextPayDate,
          payrollStatus,
        },
        include: { department: true },
      });

      if (nextPayDate && body.scheduleCalendarEvent !== false) {
        await syncEmployeePayrollCalendarEvent({
          companyId: session.company.id,
          departmentId: updated.departmentId,
          employeeName: updated.name,
          previousName: existing.name,
          monthlySalary: updated.monthlySalary,
          payCycle: updated.payCycle,
          employmentType: updated.employmentType,
          payrollStatus: updated.payrollStatus,
          nextPayDate,
        });
      }

      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "EMPLOYEE_PAYROLL_UPDATED",
        entityType: "User",
        entityId: updated.id,
        authorized: true,
        details: {
          monthlySalary: updated.monthlySalary,
          payCycle: updated.payCycle,
          payDayOfMonth: updated.payDayOfMonth,
          payrollStatus: updated.payrollStatus,
        },
      });
      return NextResponse.json({ user: updated });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: "Admin operation failed", detail: String(err) },
      { status: 500 }
    );
  }
}

