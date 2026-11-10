import { prisma } from "@/lib/db";
import { getCompanyFinancialOverview } from "@/lib/finance/metrics";
import {
  assertDepartmentAccess,
  hasRolePermission,
  recordAuditLog,
  type SessionContext,
} from "@/lib/auth/rbac";
import { paymentProvider } from "@/lib/payments/provider";
import { getCompanyReferenceDate } from "@/lib/types";

export async function runAdvisoryPaymentValidation(
  companyId: string,
  params: {
    amount: number;
    departmentId: string | null;
    budgetId: string | null;
    invoiceId: string | null;
    counterpartyName: string;
    direction: string;
  }
): Promise<{
  summary: string;
  riskFlags: string[];
  requiresDeptApproval: boolean;
  requiresFinanceApproval: boolean;
  requiresExecApproval: boolean;
}> {
  const [overview, policies, existingSimilar] = await Promise.all([
    getCompanyFinancialOverview(companyId),
    prisma.approvalPolicy.findMany({
      where: { companyId, isActive: true },
      orderBy: { minAmount: "asc" },
    }),
    prisma.paymentRequest.findMany({
      where: {
        companyId,
        counterpartyName: params.counterpartyName,
        amount: params.amount,
        status: { notIn: ["REJECTED", "CANCELLED", "FAILED"] },
      },
    }),
  ]);

  const riskFlags: string[] = [];

  // Match configured approval policy tier
  const matchedPolicy =
    policies.find(
      (p) =>
        params.amount >= p.minAmount &&
        (p.maxAmount === null || params.amount <= p.maxAmount)
    ) ?? policies[policies.length - 1];

  const requiresDeptApproval = matchedPolicy?.requiresDeptManager ?? true;
  const requiresFinanceApproval = matchedPolicy?.requiresFinanceManager ?? true;
  const requiresExecApproval =
    matchedPolicy?.requiresExecutiveOrBoard ?? params.amount >= 50000;

  if (params.direction === "OUTGOING") {
    if (params.amount > overview.recordedCashBalance * 0.15) {
      riskFlags.push(
        `High cash concentration: request equals ${(
          (params.amount / Math.max(1, overview.recordedCashBalance)) *
          100
        ).toFixed(1)}% of recorded cash balance.`
      );
    }
    if (params.budgetId) {
      const budget = overview.budgets.find((b) => b.id === params.budgetId);
      if (!budget) {
        riskFlags.push("Referenced budget not found.");
      } else {
        const projectedRemaining =
          budget.remainingAmount - budget.pendingCommitted - params.amount;
        if (projectedRemaining < 0) {
          riskFlags.push(
            `Budget overrun warning: "${budget.name}" would exceed allocation by $${Math.abs(
              projectedRemaining
            ).toLocaleString("en-US")}.`
          );
        }
      }
    } else {
      riskFlags.push("No budget allocation linked — unbudgeted outgoing spend.");
    }
  }

  if (existingSimilar.length > 0) {
    riskFlags.push(
      `Potential duplicate: ${existingSimilar.length} active request(s) with identical counterparty and amount.`
    );
  }

  if (params.invoiceId) {
    const inv = await prisma.invoice.findUnique({ where: { id: params.invoiceId } });
    if (inv && inv.status === "PAID") {
      riskFlags.push(`Linked invoice ${inv.invoiceNumber} is already marked PAID.`);
    }
  }

  const tierText = [
    requiresDeptApproval ? "Department Manager" : null,
    requiresFinanceApproval ? "Finance Manager/CFO" : null,
    requiresExecApproval ? "Executive/Board" : null,
  ]
    .filter(Boolean)
    .join(" → ");

  const summary = `Advisory AI check complete (AI has zero approval/execution authority). Policy "${
    matchedPolicy?.name ?? "Default Threshold"
  }" requires human sign-off chain: ${tierText}. ${
    riskFlags.length === 0
      ? "No budget overrun or duplicate anomalies detected."
      : `${riskFlags.length} risk flag(s) surfaced for human reviewers.`
  }`;

  return {
    summary,
    riskFlags,
    requiresDeptApproval,
    requiresFinanceApproval,
    requiresExecApproval,
  };
}

export async function processPaymentApprovalAction(params: {
  session: SessionContext;
  paymentRequestId: string;
  action: "APPROVE" | "REJECT" | "EXECUTE";
  comment?: string;
}): Promise<{ ok: boolean; status: number; message: string; paymentRequest?: unknown }> {
  const { session, paymentRequestId, action, comment = "" } = params;

  const pr = await prisma.paymentRequest.findUnique({
    where: { id: paymentRequestId },
    include: { approvalActions: true, invoice: true, department: true },
  });

  if (!pr || pr.companyId !== session.company.id) {
    return {
      ok: false,
      status: 404,
      message: "Payment request not found in active company workspace.",
    };
  }

  if (session.user.role === "AUDITOR") {
    await recordAuditLog({
      companyId: session.company.id,
      user: session.user,
      action: `PAYMENT_${action}_DENIED`,
      entityType: "PaymentRequest",
      entityId: pr.id,
      authorized: false,
      denialReason: "Auditor role is strictly read-only.",
    });
    return { ok: false, status: 403, message: "Auditor role is strictly read-only." };
  }

  // Strictly block self-approval
  if (action === "APPROVE" && pr.requestedById === session.user.id) {
    await recordAuditLog({
      companyId: session.company.id,
      user: session.user,
      action: "PAYMENT_SELF_APPROVAL_BLOCKED",
      entityType: "PaymentRequest",
      entityId: pr.id,
      authorized: false,
      denialReason: "Policy violation: requesters cannot approve their own payment requests.",
    });
    return {
      ok: false,
      status: 403,
      message: "Policy block: You cannot approve your own payment request.",
    };
  }

  // Dual-control segregation: one reviewer cannot approve multiple sequential tiers
  if (
    action === "APPROVE" &&
    pr.approvalActions.some(
      (a) => a.actorUserId === session.user.id && a.action.endsWith("_APPROVED")
    )
  ) {
    await recordAuditLog({
      companyId: session.company.id,
      user: session.user,
      action: "PAYMENT_DUAL_CONTROL_BLOCKED",
      entityType: "PaymentRequest",
      entityId: pr.id,
      authorized: false,
      denialReason:
        "Dual-control violation: same reviewer cannot approve multiple tiers on one request.",
    });
    return {
      ok: false,
      status: 403,
      message:
        "Dual-control policy: you already approved an earlier stage; another authorized approver must sign off this tier.",
    };
  }

  if (action === "REJECT") {
    const canReject =
      hasRolePermission(session.user.role, "APPROVE_PAYMENT_DEPT") ||
      hasRolePermission(session.user.role, "APPROVE_PAYMENT_FINANCE") ||
      hasRolePermission(session.user.role, "APPROVE_PAYMENT_EXEC");
    if (!canReject) {
      return { ok: false, status: 403, message: "Role cannot reject payment requests." };
    }
    const updated = await prisma.paymentRequest.update({
      where: { id: pr.id },
      data: { status: "REJECTED" },
    });
    await prisma.approvalAction.create({
      data: {
        paymentRequestId: pr.id,
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        action: "REJECTED",
        comment: comment || "Rejected by reviewer.",
      },
    });
    await prisma.calendarEvent.updateMany({
      where: { paymentRequestId: pr.id },
      data: { status: "CANCELLED" },
    });
    await recordAuditLog({
      companyId: session.company.id,
      user: session.user,
      action: "PAYMENT_REJECTED",
      entityType: "PaymentRequest",
      entityId: pr.id,
      authorized: true,
      details: { comment },
    });
    return {
      ok: true,
      status: 200,
      message: "Payment request rejected.",
      paymentRequest: updated,
    };
  }

  if (action === "APPROVE") {
    if (pr.status === "PENDING_DEPT_APPROVAL") {
      if (!hasRolePermission(session.user.role, "APPROVE_PAYMENT_DEPT")) {
        await recordAuditLog({
          companyId: session.company.id,
          user: session.user,
          action: "PAYMENT_DEPT_APPROVAL_DENIED",
          entityType: "PaymentRequest",
          entityId: pr.id,
          authorized: false,
          denialReason: `Role ${session.user.role} lacks department approval permission.`,
        });
        return {
          ok: false,
          status: 403,
          message: `Role ${session.user.role} cannot grant Department Manager approval.`,
        };
      }
      const deptCheck = await assertDepartmentAccess(session.user, pr.departmentId);
      if (!deptCheck.allowed) {
        await recordAuditLog({
          companyId: session.company.id,
          user: session.user,
          action: "PAYMENT_DEPT_ABAC_DENIED",
          entityType: "PaymentRequest",
          entityId: pr.id,
          authorized: false,
          denialReason: deptCheck.reason,
        });
        return { ok: false, status: 403, message: deptCheck.reason ?? "Forbidden" };
      }

      const nextStatus = pr.requiresFinanceApproval
        ? "PENDING_FINANCE_APPROVAL"
        : pr.requiresExecApproval
        ? "PENDING_EXEC_APPROVAL"
        : "APPROVED_READY_FOR_EXECUTION";

      const updated = await prisma.paymentRequest.update({
        where: { id: pr.id },
        data: { status: nextStatus },
      });
      await prisma.approvalAction.create({
        data: {
          paymentRequestId: pr.id,
          actorUserId: session.user.id,
          actorName: session.user.name,
          actorRole: session.user.role,
          action: "DEPT_APPROVED",
          comment: comment || "Department scope verified and approved.",
        },
      });
      if (nextStatus === "APPROVED_READY_FOR_EXECUTION") {
        await prisma.calendarEvent.updateMany({
          where: { paymentRequestId: pr.id },
          data: { status: "APPROVED" },
        });
      }
      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "PAYMENT_DEPT_APPROVED",
        entityType: "PaymentRequest",
        entityId: pr.id,
        authorized: true,
        details: { nextStatus },
      });
      return {
        ok: true,
        status: 200,
        message: `Department approval recorded. Moved to ${nextStatus}.`,
        paymentRequest: updated,
      };
    }

    if (pr.status === "PENDING_FINANCE_APPROVAL") {
      if (!hasRolePermission(session.user.role, "APPROVE_PAYMENT_FINANCE")) {
        await recordAuditLog({
          companyId: session.company.id,
          user: session.user,
          action: "PAYMENT_FINANCE_APPROVAL_DENIED",
          entityType: "PaymentRequest",
          entityId: pr.id,
          authorized: false,
          denialReason: `Role ${session.user.role} cannot grant Finance approval.`,
        });
        return {
          ok: false,
          status: 403,
          message: "Only Finance Manager or CFO can grant Finance approval.",
        };
      }
      const nextStatus = pr.requiresExecApproval
        ? "PENDING_EXEC_APPROVAL"
        : "APPROVED_READY_FOR_EXECUTION";

      const updated = await prisma.paymentRequest.update({
        where: { id: pr.id },
        data: { status: nextStatus },
      });
      await prisma.approvalAction.create({
        data: {
          paymentRequestId: pr.id,
          actorUserId: session.user.id,
          actorName: session.user.name,
          actorRole: session.user.role,
          action: "FINANCE_APPROVED",
          comment: comment || "Finance compliance and budget check approved.",
        },
      });
      if (nextStatus === "APPROVED_READY_FOR_EXECUTION") {
        await prisma.calendarEvent.updateMany({
          where: { paymentRequestId: pr.id },
          data: { status: "APPROVED" },
        });
      }
      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "PAYMENT_FINANCE_APPROVED",
        entityType: "PaymentRequest",
        entityId: pr.id,
        authorized: true,
        details: { nextStatus },
      });
      return {
        ok: true,
        status: 200,
        message: `Finance approval recorded. Moved to ${nextStatus}.`,
        paymentRequest: updated,
      };
    }

    if (pr.status === "PENDING_EXEC_APPROVAL") {
      if (!hasRolePermission(session.user.role, "APPROVE_PAYMENT_EXEC")) {
        await recordAuditLog({
          companyId: session.company.id,
          user: session.user,
          action: "PAYMENT_EXEC_APPROVAL_DENIED",
          entityType: "PaymentRequest",
          entityId: pr.id,
          authorized: false,
          denialReason: `Role ${session.user.role} cannot grant Executive/Board approval.`,
        });
        return {
          ok: false,
          status: 403,
          message: "Only CEO, CFO, or Board Member can grant Executive approval.",
        };
      }
      const updated = await prisma.paymentRequest.update({
        where: { id: pr.id },
        data: { status: "APPROVED_READY_FOR_EXECUTION" },
      });
      await prisma.approvalAction.create({
        data: {
          paymentRequestId: pr.id,
          actorUserId: session.user.id,
          actorName: session.user.name,
          actorRole: session.user.role,
          action: "EXEC_APPROVED",
          comment: comment || "Executive/Board authorization granted.",
        },
      });
      await prisma.calendarEvent.updateMany({
        where: { paymentRequestId: pr.id },
        data: { status: "APPROVED" },
      });
      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "PAYMENT_EXEC_APPROVED",
        entityType: "PaymentRequest",
        entityId: pr.id,
        authorized: true,
      });
      return {
        ok: true,
        status: 200,
        message: "Executive approval recorded. Request is ready for payment execution.",
        paymentRequest: updated,
      };
    }

    return {
      ok: false,
      status: 400,
      message: `Cannot approve request in status ${pr.status}.`,
    };
  }

  // EXECUTE
  if (action === "EXECUTE") {
    if (!hasRolePermission(session.user.role, "EXECUTE_PAYMENT")) {
      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "PAYMENT_EXECUTION_DENIED",
        entityType: "PaymentRequest",
        entityId: pr.id,
        authorized: false,
        denialReason: `Role ${session.user.role} lacks EXECUTE_PAYMENT permission.`,
      });
      return {
        ok: false,
        status: 403,
        message:
          "Only Payment Executor, Finance Manager, or CFO can release approved payments.",
      };
    }

    if (pr.status !== "APPROVED_READY_FOR_EXECUTION") {
      return {
        ok: false,
        status: 400,
        message: `Payment cannot be executed before completing all human approvals (current status: ${pr.status}).`,
      };
    }

    const payoutResult = await paymentProvider.executeOutgoingPayout({
      paymentRequestId: pr.id,
      recipientEmail: pr.counterpartyEmail || "vendor@example.com",
      recipientName: pr.counterpartyName,
      amount: pr.amount,
      currency: pr.currency,
      note: pr.title,
    });

    if (payoutResult.status === "FAILED") {
      const updated = await prisma.paymentRequest.update({
        where: { id: pr.id },
        data: {
          status: "FAILED",
          provider: payoutResult.provider,
          providerReference: payoutResult.batchId,
          isSimulated: payoutResult.isSimulated,
        },
      });
      await prisma.approvalAction.create({
        data: {
          paymentRequestId: pr.id,
          actorUserId: session.user.id,
          actorName: session.user.name,
          actorRole: session.user.role,
          action: "FAILED",
          comment: payoutResult.note,
        },
      });
      await prisma.calendarEvent.updateMany({
        where: { paymentRequestId: pr.id },
        data: { status: "FAILED" },
      });
      return {
        ok: false,
        status: 502,
        message: payoutResult.note,
        paymentRequest: updated,
      };
    }

    const now = getCompanyReferenceDate(session.company);
    const updated = await prisma.paymentRequest.update({
      where: { id: pr.id },
      data: {
        status: "PAID",
        executedAt: now,
        provider: payoutResult.provider,
        providerReference: payoutResult.batchId,
        isSimulated: payoutResult.isSimulated,
      },
    });

    await prisma.approvalAction.create({
      data: {
        paymentRequestId: pr.id,
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        action: "EXECUTED",
        comment: `${payoutResult.note} (Ref: ${payoutResult.batchId})`,
      },
    });

    // Record financial transaction & reconcile linked invoice, budget & calendar
    await prisma.transaction.create({
      data: {
        companyId: pr.companyId,
        departmentId: pr.departmentId,
        budgetId: pr.budgetId,
        invoiceId: pr.invoiceId,
        paymentRequestId: pr.id,
        direction: pr.direction === "INCOMING" ? "INCOMING" : "OUTGOING",
        amount: pr.amount,
        currency: pr.currency,
        category: pr.category,
        description: `${pr.title} — ${pr.counterpartyName}`,
        counterparty: pr.counterpartyName,
        occurredAt: now,
        status: "COMPLETED",
        source: payoutResult.provider,
        externalRef: payoutResult.batchId,
        isSimulated: payoutResult.isSimulated,
        isSynthetic: pr.isSynthetic,
      },
    });

    if (pr.invoiceId && pr.invoice) {
      const newPaid = pr.invoice.paidAmount + pr.amount;
      const newInvStatus = newPaid >= pr.invoice.amount ? "PAID" : "PARTIALLY_PAID";
      await prisma.invoice.update({
        where: { id: pr.invoiceId },
        data: { paidAmount: newPaid, status: newInvStatus },
      });
    }

    await prisma.calendarEvent.updateMany({
      where: { paymentRequestId: pr.id },
      data: { status: "PAID", eventDate: now },
    });

    // Update recorded balance for non-simulated or demo ledger consistency
    await prisma.company.update({
      where: { id: pr.companyId },
      data: {
        recordedCashBalance: {
          decrement: pr.direction === "OUTGOING" ? pr.amount : -pr.amount,
        },
      },
    });

    await recordAuditLog({
      companyId: session.company.id,
      user: session.user,
      action: "PAYMENT_EXECUTED",
      entityType: "PaymentRequest",
      entityId: pr.id,
      authorized: true,
      details: {
        provider: payoutResult.provider,
        isSimulated: payoutResult.isSimulated,
        batchId: payoutResult.batchId,
        amount: pr.amount,
      },
    });

    return {
      ok: true,
      status: 200,
      message: payoutResult.note,
      paymentRequest: updated,
    };
  }

  return { ok: false, status: 400, message: "Unsupported action." };
}

