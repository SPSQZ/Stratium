import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext, recordAuditLog } from "@/lib/auth/rbac";
import { paymentProvider } from "@/lib/payments/provider";
import { getCompanyReferenceDate } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const session = await getSessionContext();
    const body = (await request.json()) as {
      orderId: string;
      invoiceId?: string;
    };

    if (!body.orderId) {
      return NextResponse.json(
        { error: "orderId is required." },
        { status: 400 }
      );
    }

    const invoice = body.invoiceId
      ? await prisma.invoice.findFirst({
          where: { id: body.invoiceId, companyId: session.company.id },
        })
      : await prisma.invoice.findFirst({
          where: {
            paypalOrderId: body.orderId,
            companyId: session.company.id,
          },
        });

    if (!invoice) {
      return NextResponse.json(
        { error: "Matching invoice not found for capture reconciliation." },
        { status: 404 }
      );
    }

    if (invoice.status === "PAID") {
      return NextResponse.json({
        alreadyPaid: true,
        invoice,
        message: `Invoice ${invoice.invoiceNumber} is already reconciled as PAID.`,
      });
    }

    const remainingDue = Math.max(0, invoice.amount - invoice.paidAmount);
    const capture = await paymentProvider.captureIncomingOrder(
      body.orderId,
      remainingDue,
      invoice.currency
    );

    if (capture.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "PayPal capture did not complete.", capture },
        { status: 400 }
      );
    }

    const now = getCompanyReferenceDate(session.company);
    const newPaidAmount = Math.min(
      invoice.amount,
      invoice.paidAmount + capture.capturedAmount
    );
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: newPaidAmount,
        status: newPaidAmount >= invoice.amount ? "PAID" : "PARTIALLY_PAID",
        paypalOrderId: capture.orderId,
      },
    });

    const tx = await prisma.transaction.create({
      data: {
        companyId: session.company.id,
        departmentId: invoice.departmentId,
        invoiceId: invoice.id,
        direction: "INCOMING",
        amount: capture.capturedAmount,
        currency: capture.currency,
        category: "Customer Invoice Collection",
        description: `PayPal Capture for ${invoice.invoiceNumber} — ${invoice.counterpartyName}`,
        counterparty: invoice.counterpartyName,
        occurredAt: now,
        status: "COMPLETED",
        source: capture.provider,
        externalRef: capture.captureId,
        isSimulated: capture.isSimulated,
        isSynthetic: invoice.isSynthetic,
      },
    });

    const updatedCalendar = await prisma.calendarEvent.updateMany({
      where: { invoiceId: invoice.id },
      data: { status: "PAID", eventDate: now },
    });

    if (updatedCalendar.count === 0) {
      await prisma.calendarEvent.create({
        data: {
          companyId: session.company.id,
          departmentId: invoice.departmentId,
          invoiceId: invoice.id,
          title: `Collected ${invoice.invoiceNumber}: ${invoice.counterpartyName}`,
          description: `PayPal ${capture.provider} capture reconciled.`,
          eventDate: now,
          amount: capture.capturedAmount,
          direction: "INCOMING",
          category: "Customer Receivable",
          status: "PAID",
          sourceLabel: `PayPal (${capture.captureId})`,
          isSynthetic: invoice.isSynthetic,
        },
      });
    }

    await prisma.company.update({
      where: { id: session.company.id },
      data: { recordedCashBalance: { increment: capture.capturedAmount } },
    });

    await recordAuditLog({
      companyId: session.company.id,
      user: session.user,
      action: "PAYPAL_PAYMENT_CAPTURED_AND_RECONCILED",
      entityType: "Invoice",
      entityId: invoice.id,
      authorized: true,
      details: {
        orderId: capture.orderId,
        captureId: capture.captureId,
        provider: capture.provider,
        isSimulated: capture.isSimulated,
        amount: capture.capturedAmount,
      },
    });

    return NextResponse.json({
      capture,
      invoice: updatedInvoice,
      transaction: tx,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "PayPal capture failed", detail: String(err) },
      { status: 500 }
    );
  }
}

