import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionContext,
  hasRolePermission,
  recordAuditLog,
} from "@/lib/auth/rbac";
import { getCompanyFinancialOverview } from "@/lib/finance/metrics";
import { getCompanyReferenceDate } from "@/lib/types";
import { paymentProvider } from "@/lib/payments/provider";

export async function GET() {
  try {
    const session = await getSessionContext();
    const [overview, invoices, transactions, departments] = await Promise.all([
      getCompanyFinancialOverview(session.company.id),
      prisma.invoice.findMany({
        where: { companyId: session.company.id },
        include: { department: true, budget: true },
        orderBy: { dueDate: "asc" },
      }),
      prisma.transaction.findMany({
        where: { companyId: session.company.id },
        include: { department: true, budget: true, invoice: true },
        orderBy: { occurredAt: "desc" },
      }),
      prisma.department.findMany({
        where: { companyId: session.company.id },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      company: session.company,
      overview,
      invoices,
      transactions,
      departments,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load financial overview", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionContext();
    const body = (await request.json()) as {
      kind: "BUDGET" | "INVOICE" | "EXPENSE_RECORD" | "REFUND_INVOICE";
      // Budget fields
      name?: string;
      category?: string;
      departmentId?: string | null;
      fiscalPeriod?: string;
      allocatedAmount?: number;
      notes?: string;
      // Invoice fields
      direction?: "RECEIVABLE" | "PAYABLE";
      counterpartyName?: string;
      counterpartyEmail?: string;
      description?: string;
      amount?: number;
      dueDate?: string;
      budgetId?: string | null;
      // Refund fields
      invoiceId?: string;
    };

    if (body.kind === "BUDGET") {
      if (!hasRolePermission(session.user.role, "MANAGE_BUDGET")) {
        await recordAuditLog({
          companyId: session.company.id,
          user: session.user,
          action: "BUDGET_CREATE_DENIED",
          entityType: "Budget",
          entityId: "NEW",
          authorized: false,
          denialReason: `Role ${session.user.role} cannot create or modify budgets.`,
        });
        return NextResponse.json(
          { error: `Role ${session.user.role} cannot create budgets.` },
          { status: 403 }
        );
      }

      if (!body.name?.trim() || !(Number(body.allocatedAmount) > 0)) {
        return NextResponse.json(
          { error: "Budget name and positive allocatedAmount are required." },
          { status: 400 }
        );
      }

      const budget = await prisma.budget.create({
        data: {
          companyId: session.company.id,
          departmentId: body.departmentId || null,
          name: body.name.trim(),
          category: body.category || "DEPARTMENT",
          fiscalPeriod: body.fiscalPeriod?.trim() || "Active Cycle",
          allocatedAmount: Number(body.allocatedAmount),
          status: "APPROVED",
          notes: body.notes?.trim() || "",
          isSynthetic: true,
        },
      });

      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "BUDGET_CREATED",
        entityType: "Budget",
        entityId: budget.id,
        authorized: true,
        details: { name: budget.name, allocatedAmount: budget.allocatedAmount },
      });

      return NextResponse.json({ budget }, { status: 201 });
    }

    if (body.kind === "INVOICE") {
      if (!hasRolePermission(session.user.role, "MANAGE_INVOICE")) {
        await recordAuditLog({
          companyId: session.company.id,
          user: session.user,
          action: "INVOICE_CREATE_DENIED",
          entityType: "Invoice",
          entityId: "NEW",
          authorized: false,
          denialReason: `Role ${session.user.role} cannot issue invoices.`,
        });
        return NextResponse.json(
          { error: `Role ${session.user.role} cannot create invoices.` },
          { status: 403 }
        );
      }

      const amount = Number(body.amount);
      if (!body.counterpartyName?.trim() || !(amount > 0)) {
        return NextResponse.json(
          { error: "Counterparty name and positive amount are required." },
          { status: 400 }
        );
      }

      const dir = body.direction === "PAYABLE" ? "PAYABLE" : "RECEIVABLE";
      const invNum = `INV-${dir === "RECEIVABLE" ? "AR" : "AP"}-${Date.now()
        .toString(36)
        .toUpperCase()}`;
      const refNow = getCompanyReferenceDate(session.company);
      const dueDate = body.dueDate
        ? new Date(body.dueDate)
        : new Date(refNow.getTime() + 7 * 24 * 60 * 60 * 1000);

      const invoice = await prisma.invoice.create({
        data: {
          companyId: session.company.id,
          departmentId: body.departmentId || null,
          budgetId: body.budgetId || null,
          direction: dir,
          invoiceNumber: invNum,
          counterpartyName: body.counterpartyName.trim(),
          counterpartyEmail: body.counterpartyEmail?.trim() || "",
          description: body.description?.trim() || "Corporate invoice",
          amount,
          currency: session.company.currency,
          issueDate: refNow,
          dueDate,
          status: "ISSUED",
          isSynthetic: true,
        },
      });

      await prisma.calendarEvent.create({
        data: {
          companyId: session.company.id,
          departmentId: body.departmentId || null,
          budgetId: body.budgetId || null,
          invoiceId: invoice.id,
          title: `${invoice.invoiceNumber}: ${invoice.counterpartyName}`,
          description: invoice.description,
          eventDate: dueDate,
          amount: invoice.amount,
          direction: dir === "RECEIVABLE" ? "INCOMING" : "OUTGOING",
          category: dir === "RECEIVABLE" ? "Customer Receivable" : "Vendor Payable",
          status: dir === "RECEIVABLE" ? "CONTRACTED" : "DUE",
          sourceLabel: `Invoice ${invoice.invoiceNumber}`,
          isSynthetic: true,
        },
      });

      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "INVOICE_CREATED",
        entityType: "Invoice",
        entityId: invoice.id,
        authorized: true,
        details: { invoiceNumber: invoice.invoiceNumber, amount: invoice.amount },
      });

      return NextResponse.json({ invoice }, { status: 201 });
    }

    if (body.kind === "REFUND_INVOICE" && body.invoiceId) {
      if (!hasRolePermission(session.user.role, "MANAGE_INVOICE")) {
        return NextResponse.json(
          { error: `Role ${session.user.role} cannot process refunds.` },
          { status: 403 }
        );
      }

      const inv = await prisma.invoice.findFirst({
        where: { id: body.invoiceId, companyId: session.company.id },
      });
      if (!inv || inv.paidAmount <= 0) {
        return NextResponse.json(
          { error: "Paid invoice not found for refund." },
          { status: 404 }
        );
      }

      const refundAmt = inv.paidAmount;
      const origTx = await prisma.transaction.findFirst({
        where: { invoiceId: inv.id, direction: "INCOMING", status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
      });

      const refundRes = await paymentProvider.refundCapture({
        captureId: origTx?.externalRef ?? "",
        amount: refundAmt,
        currency: inv.currency,
        note: `Refund for ${inv.invoiceNumber}`,
      });

      if (refundRes.status === "FAILED") {
        return NextResponse.json({ error: refundRes.note }, { status: 502 });
      }

      const updated = await prisma.invoice.update({
        where: { id: inv.id },
        data: {
          refundedAmount: refundAmt,
          status: "REFUNDED",
        },
      });

      await prisma.transaction.create({
        data: {
          companyId: session.company.id,
          departmentId: inv.departmentId,
          invoiceId: inv.id,
          direction: "OUTGOING",
          amount: refundAmt,
          currency: inv.currency,
          category: "Customer Refund",
          description: `Refund for ${inv.invoiceNumber} — ${inv.counterpartyName}`,
          counterparty: inv.counterpartyName,
          occurredAt: getCompanyReferenceDate(session.company),
          status: "REFUNDED",
          source: refundRes.provider,
          externalRef: refundRes.refundId,
          isSimulated: refundRes.isSimulated,
          isSynthetic: true,
        },
      });

      await prisma.company.update({
        where: { id: session.company.id },
        data: { recordedCashBalance: { decrement: refundAmt } },
      });

      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "INVOICE_REFUNDED",
        entityType: "Invoice",
        entityId: inv.id,
        authorized: true,
        details: { refundAmt },
      });

      return NextResponse.json({ invoice: updated });
    }

    return NextResponse.json(
      { error: "Unsupported finance operation." },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Finance action failed", detail: String(err) },
      { status: 500 }
    );
  }
}

