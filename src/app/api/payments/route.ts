import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionContext,
  hasRolePermission,
  recordAuditLog,
} from "@/lib/auth/rbac";
import { runAdvisoryPaymentValidation } from "@/lib/payments/workflow";
import { isPayPalConfigured, isPayPalPayoutsEnabled } from "@/lib/payments/provider";
import { getCompanyReferenceDate } from "@/lib/types";

export async function GET() {
  try {
    const session = await getSessionContext();
    const [
      paymentRequests,
      approvalPolicies,
      openReceivables,
      openPayables,
      budgets,
      departments,
      employees,
      transactions,
      webhookEvents,
    ] = await Promise.all([
      prisma.paymentRequest.findMany({
        where: { companyId: session.company.id },
        include: {
          department: true,
          budget: true,
          invoice: true,
          requestedBy: true,
          approvalActions: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.approvalPolicy.findMany({
        where: { companyId: session.company.id },
        orderBy: { minAmount: "asc" },
      }),
      prisma.invoice.findMany({
        where: {
          companyId: session.company.id,
          direction: "RECEIVABLE",
        },
        orderBy: { dueDate: "asc" },
      }),
      prisma.invoice.findMany({
        where: {
          companyId: session.company.id,
          direction: "PAYABLE",
          status: { in: ["ISSUED", "OVERDUE", "PARTIALLY_PAID"] },
        },
        orderBy: { dueDate: "asc" },
      }),
      prisma.budget.findMany({
        where: { companyId: session.company.id },
        orderBy: { name: "asc" },
      }),
      prisma.department.findMany({
        where: { companyId: session.company.id },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { companyId: session.company.id },
        select: {
          id: true,
          name: true,
          email: true,
          title: true,
          role: true,
          departmentId: true,
          employmentType: true,
          monthlySalary: true,
          payCycle: true,
          payDayOfMonth: true,
          payoutEmail: true,
          nextPayDate: true,
          payrollStatus: true,
        },
        orderBy: [{ monthlySalary: "desc" }, { name: "asc" }],
      }),
      prisma.transaction.findMany({
        where: { companyId: session.company.id },
        orderBy: { occurredAt: "desc" },
        take: 25,
      }),
      prisma.webhookEvent.findMany({
        where: {
          OR: [{ companyId: session.company.id }, { companyId: null }],
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ]);

    return NextResponse.json({
      company: session.company,
      currentUser: session.user,
      paypalStatus: {
        sandboxConfigured: isPayPalConfigured(),
        payoutsEnabled: isPayPalPayoutsEnabled(),
        env: process.env.PAYPAL_ENV || "sandbox",
      },
      paymentRequests,
      approvalPolicies,
      openReceivables,
      openPayables,
      budgets,
      departments,
      employees,
      transactions,
      webhookEvents,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load payments workspace", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionContext();

    if (!hasRolePermission(session.user.role, "CREATE_PAYMENT_REQUEST")) {
      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "PAYMENT_REQUEST_CREATE_DENIED",
        entityType: "PaymentRequest",
        entityId: "NEW",
        authorized: false,
        denialReason: `Role ${session.user.role} cannot submit payment requests.`,
      });
      return NextResponse.json(
        { error: `Role ${session.user.role} cannot create payment requests.` },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      title: string;
      direction?: "OUTGOING" | "INTERNAL_ALLOCATION";
      counterpartyName: string;
      counterpartyEmail?: string;
      amount: number;
      category: string;
      purpose: string;
      departmentId?: string | null;
      budgetId?: string | null;
      invoiceId?: string | null;
      dueDate?: string;
    };

    const amount = Number(body.amount);
    if (!body.title?.trim() || !body.counterpartyName?.trim() || !(amount > 0)) {
      return NextResponse.json(
        { error: "Title, counterpartyName, and positive amount are required." },
        { status: 400 }
      );
    }

    const departmentId = body.departmentId || session.user.departmentId || null;

    // Step 1: AI Advisory Validation (NEVER approves or executes!)
    const validation = await runAdvisoryPaymentValidation(session.company.id, {
      amount,
      departmentId,
      budgetId: body.budgetId || null,
      invoiceId: body.invoiceId || null,
      counterpartyName: body.counterpartyName.trim(),
      direction: body.direction || "OUTGOING",
    });

    const initialStatus = validation.requiresDeptApproval
      ? "PENDING_DEPT_APPROVAL"
      : validation.requiresFinanceApproval
      ? "PENDING_FINANCE_APPROVAL"
      : "PENDING_EXEC_APPROVAL";

    const refNow = getCompanyReferenceDate(session.company);
    const dueDate = body.dueDate
      ? new Date(body.dueDate)
      : new Date(refNow.getTime() + 5 * 24 * 60 * 60 * 1000);

    const pr = await prisma.paymentRequest.create({
      data: {
        companyId: session.company.id,
        departmentId,
        budgetId: body.budgetId || null,
        invoiceId: body.invoiceId || null,
        requestedById: session.user.id,
        direction: body.direction || "OUTGOING",
        title: body.title.trim(),
        counterpartyName: body.counterpartyName.trim(),
        counterpartyEmail: body.counterpartyEmail?.trim() || "",
        amount,
        currency: session.company.currency,
        category: body.category?.trim() || "Vendor Payment",
        purpose: body.purpose?.trim() || "Vendor settlement",
        status: initialStatus,
        aiValidationSummary: validation.summary,
        aiRiskFlagsJson: JSON.stringify(validation.riskFlags),
        requiresDeptApproval: validation.requiresDeptApproval,
        requiresFinanceApproval: validation.requiresFinanceApproval,
        requiresExecApproval: validation.requiresExecApproval,
        dueDate,
        provider: isPayPalPayoutsEnabled() ? "PAYPAL_SANDBOX" : "PAYPAL_SIMULATED",
        isSimulated: !isPayPalPayoutsEnabled(),
        isSynthetic: true,
        approvalActions: {
          create: [
            {
              actorUserId: session.user.id,
              actorName: session.user.name,
              actorRole: session.user.role,
              action: "SUBMITTED",
              comment: body.purpose?.trim() || "Payment request submitted.",
            },
            {
              actorUserId: session.user.id,
              actorName: "Stratium AI Policy Check",
              actorRole: "AI_ADVISORY_ONLY",
              action: "AI_VALIDATED",
              comment: validation.summary,
            },
          ],
        },
      },
      include: { approvalActions: true },
    });

    await prisma.calendarEvent.create({
      data: {
        companyId: session.company.id,
        departmentId,
        budgetId: body.budgetId || null,
        invoiceId: body.invoiceId || null,
        paymentRequestId: pr.id,
        title: `${pr.title} (${pr.counterpartyName})`,
        description: `Payment request pending human approval (${pr.status}).`,
        eventDate: dueDate,
        amount: pr.amount,
        direction: pr.direction === "INTERNAL_ALLOCATION" ? "ALLOCATION" : "OUTGOING",
        category: pr.category,
        status: "DUE",
        sourceLabel: "Payment Request Workflow",
        isSynthetic: true,
      },
    });

    await recordAuditLog({
      companyId: session.company.id,
      user: session.user,
      action: "PAYMENT_REQUEST_CREATED",
      entityType: "PaymentRequest",
      entityId: pr.id,
      authorized: true,
      details: { amount: pr.amount, status: pr.status },
    });

    return NextResponse.json({ paymentRequest: pr }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create payment request", detail: String(err) },
      { status: 500 }
    );
  }
}

