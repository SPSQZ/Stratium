export interface CreateOrderInput {
  companyId: string;
  invoiceId?: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface CreateOrderResult {
  provider: "PAYPAL_SANDBOX" | "PAYPAL_SIMULATED";
  isSimulated: boolean;
  orderId: string;
  status: string;
  approveUrl: string | null;
  rawPayload: Record<string, unknown>;
  note: string;
}

export interface CaptureOrderResult {
  provider: "PAYPAL_SANDBOX" | "PAYPAL_SIMULATED";
  isSimulated: boolean;
  orderId: string;
  captureId: string;
  status: "COMPLETED" | "FAILED";
  capturedAmount: number;
  currency: string;
  rawPayload: Record<string, unknown>;
  note: string;
}

export interface OutgoingPayoutInput {
  paymentRequestId: string;
  recipientEmail: string;
  recipientName: string;
  amount: number;
  currency: string;
  note: string;
}

export interface OutgoingPayoutResult {
  provider: "PAYPAL_SANDBOX" | "PAYPAL_SIMULATED";
  isSimulated: boolean;
  batchId: string;
  status: "SUCCESS" | "PENDING" | "FAILED";
  rawPayload: Record<string, unknown>;
  note: string;
}

export interface WebhookVerifyInput {
  headers: Record<string, string>;
  rawBody: string;
  parsedBody: Record<string, unknown>;
}

export interface WebhookVerifyResult {
  verified: boolean;
  mode: "PAYPAL_SANDBOX_API" | "SIMULATED_SANDBOX_MODE";
  detail: string;
}

export interface RefundCaptureResult {
  provider: "PAYPAL_SANDBOX" | "PAYPAL_SIMULATED";
  isSimulated: boolean;
  refundId: string;
  status: "COMPLETED" | "FAILED";
  note: string;
}

export interface PaymentProviderAdapter {
  readonly name: string;
  isLiveSandboxConfigured(): boolean;
  createIncomingOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  captureIncomingOrder(
    orderId: string,
    fallbackAmount?: number,
    fallbackCurrency?: string
  ): Promise<CaptureOrderResult>;
  refundCapture(input: {
    captureId: string;
    amount: number;
    currency: string;
    note?: string;
  }): Promise<RefundCaptureResult>;
  executeOutgoingPayout(input: OutgoingPayoutInput): Promise<OutgoingPayoutResult>;
  verifyWebhook(input: WebhookVerifyInput): Promise<WebhookVerifyResult>;
}

function getPayPalBaseUrl(): string {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function isPayPalConfigured(): boolean {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID?.trim() &&
      process.env.PAYPAL_CLIENT_SECRET?.trim()
  );
}

export function isPayPalPayoutsEnabled(): boolean {
  return (
    isPayPalConfigured() &&
    process.env.PAYPAL_ENABLE_PAYOUTS?.toLowerCase() === "true"
  );
}

export class PayPalSandboxAdapter implements PaymentProviderAdapter {
  readonly name = "PayPal REST API v2 (Sandbox)";

  isLiveSandboxConfigured(): boolean {
    return isPayPalConfigured();
  }

  private async getAccessToken(): Promise<string> {
    const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      throw new Error("PayPal sandbox credentials are not configured.");
    }
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`PayPal OAuth failed (${res.status}): ${errText}`);
    }
    const json = (await res.json()) as { access_token: string };
    return json.access_token;
  }

  async createIncomingOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    if (!isPayPalConfigured()) {
      const simOrderId = `SIM-PP-ORD-${Date.now().toString(36).toUpperCase()}`;
      return {
        provider: "PAYPAL_SIMULATED",
        isSimulated: true,
        orderId: simOrderId,
        status: "CREATED",
        approveUrl: null,
        rawPayload: {
          simulated: true,
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: input.invoiceNumber,
              description: input.description,
              amount: {
                currency_code: input.currency,
                value: input.amount.toFixed(2),
              },
            },
          ],
        },
        note: "PayPal Sandbox credentials not configured in .env; created an explicitly labeled simulated sandbox order for demonstration.",
      };
    }

    const token = await this.getAccessToken();
    const payload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.invoiceNumber,
          custom_id: input.invoiceId ?? input.invoiceNumber,
          description: input.description.slice(0, 127),
          amount: {
            currency_code: input.currency,
            value: input.amount.toFixed(2),
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Stratium Corporate Treasury",
            user_action: "PAY_NOW",
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
          },
        },
      },
    };

    const res = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as Record<string, unknown> & {
      id?: string;
      status?: string;
      links?: Array<{ rel: string; href: string }>;
    };

    if (!res.ok || !data.id) {
      throw new Error(
        `PayPal Create Order failed (${res.status}): ${JSON.stringify(data)}`
      );
    }

    const approveLink =
      data.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")
        ?.href ?? null;

    return {
      provider: "PAYPAL_SANDBOX",
      isSimulated: false,
      orderId: data.id,
      status: data.status ?? "CREATED",
      approveUrl: approveLink,
      rawPayload: data,
      note: "Live PayPal Sandbox Order created via /v2/checkout/orders.",
    };
  }

  async captureIncomingOrder(
    orderId: string,
    fallbackAmount = 0,
    fallbackCurrency = "USD"
  ): Promise<CaptureOrderResult> {
    if (!isPayPalConfigured() || orderId.startsWith("SIM-PP-ORD-")) {
      const simCaptureId = `SIM-PP-CAP-${Date.now().toString(36).toUpperCase()}`;
      return {
        provider: "PAYPAL_SIMULATED",
        isSimulated: true,
        orderId,
        captureId: simCaptureId,
        status: "COMPLETED",
        capturedAmount: fallbackAmount,
        currency: fallbackCurrency,
        rawPayload: {
          simulated: true,
          id: orderId,
          status: "COMPLETED",
          captureId: simCaptureId,
        },
        note: "Simulated sandbox capture completed (not a live PayPal settlement).",
      };
    }

    const token = await this.getAccessToken();
    const res = await fetch(
      `${getPayPalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = (await res.json()) as Record<string, unknown> & {
      id?: string;
      status?: string;
      purchase_units?: Array<{
        payments?: {
          captures?: Array<{
            id: string;
            status: string;
            amount: { value: string; currency_code: string };
          }>;
        };
      }>;
    };

    if (!res.ok) {
      throw new Error(
        `PayPal Capture failed (${res.status}): ${JSON.stringify(data)}`
      );
    }

    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    const capturedAmount = capture?.amount?.value
      ? Number.parseFloat(capture.amount.value)
      : fallbackAmount;

    return {
      provider: "PAYPAL_SANDBOX",
      isSimulated: false,
      orderId: data.id ?? orderId,
      captureId: capture?.id ?? orderId,
      status: data.status === "COMPLETED" ? "COMPLETED" : "FAILED",
      capturedAmount,
      currency: capture?.amount?.currency_code ?? fallbackCurrency,
      rawPayload: data,
      note: "Captured via live PayPal Sandbox API /v2/checkout/orders/{id}/capture.",
    };
  }

  async refundCapture(input: {
    captureId: string;
    amount: number;
    currency: string;
    note?: string;
  }): Promise<RefundCaptureResult> {
    if (
      !isPayPalConfigured() ||
      !input.captureId ||
      input.captureId.startsWith("SIM-") ||
      input.captureId.startsWith("WIRE-") ||
      input.captureId.startsWith("ACH-")
    ) {
      const simId = `SIM-REFUND-${Date.now().toString(36).toUpperCase()}`;
      return {
        provider: "PAYPAL_SIMULATED",
        isSimulated: true,
        refundId: simId,
        status: "COMPLETED",
        note: "Simulated refund recorded (original collection was not a live PayPal Sandbox capture).",
      };
    }

    const token = await this.getAccessToken();
    const res = await fetch(
      `${getPayPalBaseUrl()}/v2/payments/captures/${encodeURIComponent(
        input.captureId
      )}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: {
            value: input.amount.toFixed(2),
            currency_code: input.currency,
          },
          note_to_payer: input.note?.slice(0, 255) || "Stratium invoice refund",
        }),
      }
    );
    const data = (await res.json()) as { id?: string; status?: string; message?: string };
    if (!res.ok) {
      return {
        provider: "PAYPAL_SANDBOX",
        isSimulated: false,
        refundId: input.captureId,
        status: "FAILED",
        note: `PayPal refund failed (${res.status}): ${data.message ?? "error"}`,
      };
    }
    return {
      provider: "PAYPAL_SANDBOX",
      isSimulated: false,
      refundId: data.id ?? input.captureId,
      status: "COMPLETED",
      note: "Refunded via live PayPal Sandbox Refunds API (/v2/payments/captures/{id}/refund).",
    };
  }

  async executeOutgoingPayout(
    input: OutgoingPayoutInput
  ): Promise<OutgoingPayoutResult> {
    // Only call PayPal Payouts API if explicitly configured & enabled for eligible sandbox accounts
    if (!isPayPalPayoutsEnabled()) {
      const batchId = `SIM-PAYOUT-${Date.now().toString(36).toUpperCase()}`;
      return {
        provider: "PAYPAL_SIMULATED",
        isSimulated: true,
        batchId,
        status: "SUCCESS",
        rawPayload: {
          simulated: true,
          reason:
            "PAYPAL_ENABLE_PAYOUTS is false or sandbox credentials are not configured.",
          sender_batch_header: {
            sender_batch_id: batchId,
            email_subject: `Stratium Payment: ${input.note}`,
          },
          items: [
            {
              recipient_type: "EMAIL",
              receiver: input.recipientEmail || "vendor-sandbox@example.com",
              amount: {
                value: input.amount.toFixed(2),
                currency: input.currency,
              },
            },
          ],
        },
        note: "Simulated outgoing payout (PayPal Payouts sandbox not enabled/eligible). Clearly labeled as simulated — not an actual bank or PayPal transfer.",
      };
    }

    try {
      const token = await this.getAccessToken();
      const senderBatchId = `STRATIUM-${input.paymentRequestId}-${Date.now()}`;
      const res = await fetch(`${getPayPalBaseUrl()}/v1/payments/payouts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender_batch_header: {
            sender_batch_id: senderBatchId,
            email_subject: `Payment from Stratium: ${input.note.slice(0, 60)}`,
          },
          items: [
            {
              recipient_type: "EMAIL",
              amount: {
                value: input.amount.toFixed(2),
                currency: input.currency,
              },
              note: input.note.slice(0, 120),
              sender_item_id: input.paymentRequestId,
              receiver: input.recipientEmail || "sb-vendor@personal.example.com",
            },
          ],
        }),
      });

      const data = (await res.json()) as Record<string, unknown> & {
        batch_header?: { payout_batch_id: string; batch_status: string };
        name?: string;
        message?: string;
      };

      if (!res.ok) {
        // Fallback transparently labeled if sandbox account lacks Payouts entitlement
        if (res.status === 403 || res.status === 401) {
          const simBatchId = `SIM-PAYOUT-${Date.now().toString(36).toUpperCase()}`;
          return {
            provider: "PAYPAL_SIMULATED",
            isSimulated: true,
            batchId: simBatchId,
            status: "SUCCESS",
            rawPayload: {
              simulated: true,
              paypalError: data,
            },
            note: `PayPal Sandbox Payouts entitlement unavailable (${res.status}); recorded explicitly as SIMULATED outgoing payout.`,
          };
        }
        return {
          provider: "PAYPAL_SANDBOX",
          isSimulated: false,
          batchId: senderBatchId,
          status: "FAILED",
          rawPayload: data,
          note: `PayPal Sandbox Payouts returned ${res.status}: ${data.message ?? "error"}`,
        };
      }

      return {
        provider: "PAYPAL_SANDBOX",
        isSimulated: false,
        batchId: data.batch_header?.payout_batch_id ?? senderBatchId,
        status: "SUCCESS",
        rawPayload: data,
        note: "Executed via PayPal Sandbox Payouts API (/v1/payments/payouts).",
      };
    } catch (error) {
      return {
        provider: "PAYPAL_SANDBOX",
        isSimulated: false,
        batchId: `ERR-${Date.now()}`,
        status: "FAILED",
        rawPayload: { error: String(error) },
        note: `PayPal Payouts execution failed: ${String(error)}`,
      };
    }
  }

  async verifyWebhook(input: WebhookVerifyInput): Promise<WebhookVerifyResult> {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
    if (!isPayPalConfigured() || !webhookId) {
      return {
        verified: false,
        mode: "SIMULATED_SANDBOX_MODE",
        detail:
          "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_WEBHOOK_ID not configured; signature verification bypassed in local sandbox test mode (event marked unverified unless explicitly local test).",
      };
    }

    const token = await this.getAccessToken();
    const res = await fetch(
      `${getPayPalBaseUrl()}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: input.headers["paypal-auth-algo"] ?? "",
          cert_url: input.headers["paypal-cert-url"] ?? "",
          transmission_id: input.headers["paypal-transmission-id"] ?? "",
          transmission_sig: input.headers["paypal-transmission-sig"] ?? "",
          transmission_time: input.headers["paypal-transmission-time"] ?? "",
          webhook_id: webhookId,
          webhook_event: input.parsedBody,
        }),
      }
    );

    const data = (await res.json()) as { verification_status?: string };
    const verified = res.ok && data.verification_status === "SUCCESS";
    return {
      verified,
      mode: "PAYPAL_SANDBOX_API",
      detail: verified
        ? "PayPal webhook cryptographic signature verified (SUCCESS)."
        : `PayPal webhook verification returned ${data.verification_status ?? res.status}.`,
    };
  }
}

export const paymentProvider: PaymentProviderAdapter = new PayPalSandboxAdapter();

