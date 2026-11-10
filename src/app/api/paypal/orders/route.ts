import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext, recordAuditLog } from "@/lib/auth/rbac";
import { paymentProvider } from "@/lib/payments/provider";

export async function POST(request: Request) {
  try {
    const session = await getSessionContext();
    const body = (await request.json()) as { invoiceId: string };

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: body.invoiceId,
        companyId: session.company.id,
        direction: "RECEIVABLE",
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Receivable invoice not found in active company." },
        { status: 404 }
      );
    }

    const remainingDue = Math.max(0.01, invoice.amount - invoice.paidAmount);
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";

    const orderResult = await paymentProvider.createIncomingOrder({
      companyId: session.company.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: remainingDue,
      currency: invoice.currency,
      description: `${invoice.invoiceNumber}: ${invoice.description}`,
      returnUrl: `${appUrl}/payments?paypalOrderSuccess=true&invoiceId=${invoice.id}`,
      cancelUrl: `${appUrl}/payments?paypalOrderCancel=true&invoiceId=${invoice.id}`,
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { paypalOrderId: orderResult.orderId },
    });

    await recordAuditLog({
      companyId: session.company.id,
      user: session.user,
      action: "PAYPAL_ORDER_CREATED",
      entityType: "Invoice",
      entityId: invoice.id,
      authorized: true,
      details: {
        orderId: orderResult.orderId,
        provider: orderResult.provider,
        isSimulated: orderResult.isSimulated,
        amount: remainingDue,
      },
    });

    return NextResponse.json({
      order: orderResult,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: remainingDue,
      currency: invoice.currency,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create PayPal order", detail: String(err) },
      { status: 500 }
    );
  }
}

