import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionContext,
  recordAuditLog,
  SESSION_COOKIE_NAME,
  signSessionToken,
} from "@/lib/auth/rbac";
import { isPayPalConfigured, isPayPalPayoutsEnabled } from "@/lib/payments/provider";

export async function GET() {
  try {
    const session = await getSessionContext();
    const [companies, companyUsers, pendingApprovals, dueInvoices, upcomingReviews] =
      await Promise.all([
        prisma.company.findMany({
          select: {
            id: true,
            slug: true,
            name: true,
            industry: true,
            isHistoricalDemo: true,
            historicalCutoffDate: true,
            currency: true,
          },
          orderBy: [{ isHistoricalDemo: "desc" }, { createdAt: "asc" }],
        }),
        prisma.user.findMany({
          where: { companyId: session.company.id },
          include: { department: true },
          orderBy: [{ role: "asc" }, { name: "asc" }],
        }),
        prisma.paymentRequest.findMany({
          where: {
            companyId: session.company.id,
            status: {
              in: [
                "PENDING_DEPT_APPROVAL",
                "PENDING_FINANCE_APPROVAL",
                "PENDING_EXEC_APPROVAL",
                "APPROVED_READY_FOR_EXECUTION",
              ],
            },
          },
          select: { id: true, title: true, amount: true, status: true },
          take: 8,
        }),
        prisma.invoice.findMany({
          where: {
            companyId: session.company.id,
            status: { in: ["ISSUED", "OVERDUE", "PARTIALLY_PAID"] },
          },
          select: {
            id: true,
            invoiceNumber: true,
            counterpartyName: true,
            amount: true,
            paidAmount: true,
            dueDate: true,
            direction: true,
          },
          orderBy: { dueDate: "asc" },
          take: 6,
        }),
        prisma.strategicDecision.findMany({
          where: {
            companyId: session.company.id,
            approvalStatus: "PROPOSED",
          },
          select: { id: true, title: true, estimatedCost: true },
          take: 5,
        }),
      ]);

    const llmMode =
      process.env.LLM_PROVIDER === "deterministic"
        ? "DETERMINISTIC_TOOL_ENGINE"
        : process.env.GEMINI_API_KEY?.trim()
        ? `Gemini (${process.env.GEMINI_MODEL || "gemini-3.6-flash"})`
        : "Deterministic Tool Engine (No API Key Configured)";

    return NextResponse.json({
      session,
      companies,
      companyUsers: companyUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        title: u.title,
        role: u.role,
        departmentId: u.departmentId,
        departmentName: u.department?.name ?? null,
        isDemoAccount: u.isDemoAccount,
      })),
      notifications: {
        pendingApprovals,
        dueInvoices,
        upcomingReviews,
        totalCount:
          pendingApprovals.length + dueInvoices.length + upcomingReviews.length,
      },
      integrations: {
        llmMode,
        paypalConfigured: isPayPalConfigured(),
        paypalPayoutsEnabled: isPayPalPayoutsEnabled(),
        paypalEnv: process.env.PAYPAL_ENV || "sandbox",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load session", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      companyId?: string;
      userId?: string;
    };

    const currentSession = await getSessionContext();
    const targetCompanyId = body.companyId || currentSession.company.id;

    let targetUser = body.userId
      ? await prisma.user.findFirst({
          where: { id: body.userId, companyId: targetCompanyId },
          include: { department: true },
        })
      : null;

    if (!targetUser) {
      targetUser =
        (await prisma.user.findFirst({
          where: { companyId: targetCompanyId, role: "CEO" },
          include: { department: true },
        })) ??
        (await prisma.user.findFirst({
          where: { companyId: targetCompanyId },
          include: { department: true },
        }));
    }

    if (!targetUser) {
      return NextResponse.json(
        { error: "No matching demo user in target company." },
        { status: 404 }
      );
    }

    const token = signSessionToken({
      companyId: targetCompanyId,
      userId: targetUser.id,
      issuedAt: Date.now(),
    });

    await recordAuditLog({
      companyId: targetCompanyId,
      user: {
        id: targetUser.id,
        companyId: targetCompanyId,
        departmentId: targetUser.departmentId,
        departmentName: targetUser.department?.name ?? null,
        departmentCode: targetUser.department?.code ?? null,
        name: targetUser.name,
        email: targetUser.email,
        title: targetUser.title,
        role: targetUser.role as typeof currentSession.user.role,
        isDemoAccount: targetUser.isDemoAccount,
      },
      action: "DEMO_ROLE_OR_WORKSPACE_SWITCH",
      entityType: "Session",
      entityId: targetUser.id,
      authorized: true,
      details: {
        demoOnly: true,
        previousUserId: currentSession.user.id,
        previousRole: currentSession.user.role,
        newRole: targetUser.role,
      },
    });

    const response = NextResponse.json({
      ok: true,
      demoOnlyNotice: "Controlled demo account switcher updated active session.",
      companyId: targetCompanyId,
      userId: targetUser.id,
      role: targetUser.role,
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to switch workspace/role", detail: String(err) },
      { status: 500 }
    );
  }
}

