import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/rbac";
import { processPaymentApprovalAction } from "@/lib/payments/workflow";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getSessionContext();
    const body = (await request.json()) as {
      action: "APPROVE" | "REJECT" | "EXECUTE";
      comment?: string;
    };

    if (!["APPROVE", "REJECT", "EXECUTE"].includes(body.action)) {
      return NextResponse.json(
        { error: "Invalid payment workflow action." },
        { status: 400 }
      );
    }

    const result = await processPaymentApprovalAction({
      session,
      paymentRequestId: id,
      action: body.action,
      comment: body.comment,
    });

    return NextResponse.json(
      {
        ok: result.ok,
        message: result.message,
        paymentRequest: result.paymentRequest ?? null,
      },
      { status: result.status }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Payment action failed", detail: String(err) },
      { status: 500 }
    );
  }
}

