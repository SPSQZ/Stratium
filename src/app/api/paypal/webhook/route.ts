import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { paymentProvider } from "@/lib/payments/provider";
import { getCompanyReferenceDate } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const parsedBody = JSON.parse(rawBody || "{}") as Record<string, unknown> & {
      event_type?: string;
      resource?: {
        id?: string;
        supplementary_data?: {
          related_ids?: { order_id?: string };
        };
        amount?: { value?: string; currency_code?: string };
      };
    };

    const headersObj: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headersObj[key.toLowerCase()] = value;
    });

    const verification = await paymentProvider.verifyWebhook({
      headers: headersObj,
      rawBody,
      parsedBody,
    });

    const eventType = String(parsedBody.event_type || "UNKNOWN_EVENT");
    const relatedOrderId =
      parsedBody.resource?.supplementary_data?.related_ids?.order_id ||
      parsedBody.resource?.id ||
      null;

    let reconciledInvoice = relatedOrderId
      ? await prisma.invoice.findFirst({
          where: { paypalOrderId: relatedOrderId },
          include: { company: true },
        })
      : null;

    let statusNote = "LOGGED";

    if (
      reconciledInvoice &&
      eventType === "PAYMENT.CAPTURE.COMPLETED" &&
      reconciledInvoice.status !== "PAID"
    ) {
      const capturedAmt = parsedBody.resource?.amount?.value
        ? Number.parseFloat(parsedBody.resource.amount.value)
        : Math.max(0, reconciledInvoice.amount - reconciledInvoice.paidAmount);

      const updatedInv = await prisma.invoice.update({
        where: { id: reconciledInvoice.id },
        data: {
          paidAmount: Math.min(
            reconciledInvoice.amount,
            reconciledInvoice.paidAmount + capturedAmt
          ),
          status: "PAID",
        },
        include: { company: true },
      });
      reconciledInvoice = updatedInv;

      const existingTx = await prisma.transaction.findFirst({
        where: {
          invoiceId: reconciledInvoice.id,
          externalRef: parsedBody.resource?.id ?? relatedOrderId ?? undefined,
        },
      });

      if (!existingTx) {
        await prisma.transaction.create({
          data: {
            companyId: reconciledInvoice.companyId,
            departmentId: reconciledInvoice.departmentId,
            invoiceId: reconciledInvoice.id,
            direction: "INCOMING",
            amount: capturedAmt,
            currency: reconciledInvoice.currency,
            category: "PayPal Webhook Capture",
            description: `Webhook Reconciled ${reconciledInvoice.invoiceNumber}`,
            counterparty: reconciledInvoice.counterpartyName,
            occurredAt: getCompanyReferenceDate(reconciledInvoice.company),
            status: "COMPLETED",
            source: verification.verified ? "PAYPAL_SANDBOX" : "PAYPAL_SIMULATED",
            externalRef: parsedBody.resource?.id || relatedOrderId,
            isSimulated: !verification.verified,
            isSynthetic: reconciledInvoice.isSynthetic,
          },
        });
        await prisma.company.update({
          where: { id: reconciledInvoice.companyId },
          data: { recordedCashBalance: { increment: capturedAmt } },
        });
      }

      await prisma.calendarEvent.updateMany({
        where: { invoiceId: reconciledInvoice.id },
        data: { status: "PAID" },
      });
      statusNote = "RECONCILED_INVOICE";
    }

    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        companyId: reconciledInvoice?.companyId ?? null,
        provider: "PAYPAL",
        eventType,
        transmissionId: headersObj["paypal-transmission-id"] || "",
        verified: verification.verified,
        verificationDetail: verification.detail,
        payloadJson: rawBody,
        reconciledOrderId: relatedOrderId,
        status: statusNote,
      },
    });

    return NextResponse.json({
      received: true,
      webhookEvent,
      verification,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Webhook processing failed", detail: String(err) },
      { status: 500 }
    );
  }
}

