import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canAccessKnowledgeRecord, getSessionContext } from "@/lib/auth/rbac";
import { getCompanyFinancialOverview } from "@/lib/finance/metrics";
import { getCompanyReferenceDate } from "@/lib/types";

export async function GET() {
  try {
    const session = await getSessionContext();
    const refNow = getCompanyReferenceDate(session.company);
    const [
      overview,
      pendingRequests,
      upcomingEvents,
      recentDecisions,
      recentMeetings,
      documents,
      recentTransactions,
    ] = await Promise.all([
      getCompanyFinancialOverview(session.company.id),
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
        include: { department: true, requestedBy: true },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.calendarEvent.findMany({
        where: {
          companyId: session.company.id,
          eventDate: {
            gte: new Date(refNow.getTime() - 4 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { eventDate: "asc" },
        take: 8,
      }),
      prisma.strategicDecision.findMany({
        where: { companyId: session.company.id },
        include: { department: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.meeting.findMany({
        where: { companyId: session.company.id },
        orderBy: { scheduledAt: "desc" },
        take: 4,
      }),
      prisma.companyDocument.findMany({
        where: { companyId: session.company.id },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.transaction.findMany({
        where: { companyId: session.company.id },
        orderBy: { occurredAt: "desc" },
        take: 6,
      }),
    ]);

    const visibleDocs = documents.filter((d) =>
      canAccessKnowledgeRecord(session.user, d.accessLevel, d.departmentId)
    );

    return NextResponse.json({
      company: session.company,
      user: session.user,
      overview,
      pendingRequests,
      upcomingEvents,
      recentDecisions,
      recentMeetings,
      recentDocuments: visibleDocs,
      recentTransactions,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load dashboard", detail: String(err) },
      { status: 500 }
    );
  }
}

