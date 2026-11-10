import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionContext,
  hasRolePermission,
  recordAuditLog,
} from "@/lib/auth/rbac";
import { getCompanyReferenceDate } from "@/lib/types";

export async function GET() {
  try {
    const session = await getSessionContext();
    const [meetings, decisions, departments, users] = await Promise.all([
      prisma.meeting.findMany({
        where: { companyId: session.company.id },
        include: {
          decisions: true,
          _count: { select: { messages: true } },
        },
        orderBy: { scheduledAt: "desc" },
      }),
      prisma.strategicDecision.findMany({
        where: { companyId: session.company.id },
        include: {
          meeting: true,
          department: true,
          responsibleUser: true,
          budgets: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.department.findMany({
        where: { companyId: session.company.id },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { companyId: session.company.id },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      company: session.company,
      meetings,
      decisions,
      departments,
      users,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load meetings & decisions", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionContext();
    const body = (await request.json()) as {
      kind: "CREATE_MEETING" | "CREATE_DECISION" | "APPROVE_DECISION";
      // Meeting fields
      title?: string;
      meetingType?: string;
      scheduledAt?: string;
      agenda?: string;
      contextSummary?: string;
      participants?: Array<{ name: string; role: string }>;
      // Decision fields
      meetingId?: string | null;
      departmentId?: string | null;
      responsibleUserId?: string | null;
      description?: string;
      objective?: string;
      alternativesConsidered?: string;
      selectedOption?: string;
      rationale?: string;
      assumptions?: string;
      risks?: string;
      financialImplications?: string;
      estimatedCost?: number;
      expectedOutcome?: string;
      reviewDate?: string;
      // Approve Decision fields
      decisionId?: string;
      approvalStatus?: "APPROVED" | "REJECTED";
      createBudgetAndSchedule?: boolean;
      tranches?: number;
    };

    if (body.kind === "CREATE_MEETING") {
      if (!hasRolePermission(session.user.role, "CREATE_MEETING")) {
        return NextResponse.json(
          { error: `Role ${session.user.role} cannot schedule meetings.` },
          { status: 403 }
        );
      }
      if (!body.title?.trim()) {
        return NextResponse.json(
          { error: "Meeting title is required." },
          { status: 400 }
        );
      }

      const refNow = getCompanyReferenceDate(session.company);
      const meeting = await prisma.meeting.create({
        data: {
          companyId: session.company.id,
          title: body.title.trim(),
          meetingType: body.meetingType?.trim() || "Executive Strategy Meeting",
          scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : refNow,
          status: "SCHEDULED",
          agenda: body.agenda?.trim() || "1. Strategic alignment\n2. Financial review",
          participantsJson: JSON.stringify(
            body.participants ?? [{ name: session.user.name, role: session.user.role }]
          ),
          contextSummary:
            body.contextSummary?.trim() || "Scheduled corporate governance session.",
          isSynthetic: true,
        },
      });

      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "MEETING_CREATED",
        entityType: "Meeting",
        entityId: meeting.id,
        authorized: true,
      });

      return NextResponse.json({ meeting }, { status: 201 });
    }

    if (body.kind === "CREATE_DECISION") {
      if (!hasRolePermission(session.user.role, "RECORD_DECISION")) {
        return NextResponse.json(
          { error: `Role ${session.user.role} cannot record strategic decisions.` },
          { status: 403 }
        );
      }
      if (!body.title?.trim() || !body.selectedOption?.trim()) {
        return NextResponse.json(
          { error: "Decision title and selectedOption are required." },
          { status: 400 }
        );
      }

      const refNow = getCompanyReferenceDate(session.company);
      const decision = await prisma.strategicDecision.create({
        data: {
          companyId: session.company.id,
          meetingId: body.meetingId || null,
          departmentId: body.departmentId || null,
          responsibleUserId: body.responsibleUserId || session.user.id,
          title: body.title.trim(),
          description: body.description?.trim() || body.selectedOption.trim(),
          objective: body.objective?.trim() || "Strategic corporate initiative",
          alternativesConsidered:
            body.alternativesConsidered?.trim() || "Status quo vs phased investment.",
          selectedOption: body.selectedOption.trim(),
          rationale: body.rationale?.trim() || "Aligned with strategic boardroom analysis.",
          assumptions: body.assumptions?.trim() || "Baseline cost and timeline parameters.",
          risks: body.risks?.trim() || "Execution slippage or budget variance.",
          financialImplications:
            body.financialImplications?.trim() ||
            `Estimated capital commitment of ${body.estimatedCost ?? 0}`,
          estimatedCost: Math.max(0, Number(body.estimatedCost) || 0),
          expectedOutcome:
            body.expectedOutcome?.trim() || "Measurable milestone delivery by review date.",
          reviewDate: body.reviewDate
            ? new Date(body.reviewDate)
            : new Date(refNow.getTime() + 60 * 24 * 60 * 60 * 1000),
          approvalStatus: "PROPOSED",
          isSynthetic: true,
        },
      });

      // Add proposed calendar entry
      if (decision.estimatedCost > 0) {
        await prisma.calendarEvent.create({
          data: {
            companyId: session.company.id,
            departmentId: decision.departmentId,
            decisionId: decision.id,
            title: `Proposed Resolution: ${decision.title}`,
            description: decision.selectedOption,
            eventDate: new Date(refNow.getTime() + 14 * 24 * 60 * 60 * 1000),
            amount: decision.estimatedCost,
            direction: "ALLOCATION",
            category: "Board Resolution Proposal",
            status: "PROPOSED",
            sourceLabel: "Meetings & Decision Memory",
            isSynthetic: true,
          },
        });
      }

      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "STRATEGIC_DECISION_RECORDED",
        entityType: "StrategicDecision",
        entityId: decision.id,
        authorized: true,
        details: { title: decision.title, estimatedCost: decision.estimatedCost },
      });

      return NextResponse.json({ decision }, { status: 201 });
    }

    if (body.kind === "APPROVE_DECISION" && body.decisionId) {
      if (!hasRolePermission(session.user.role, "APPROVE_DECISION")) {
        await recordAuditLog({
          companyId: session.company.id,
          user: session.user,
          action: "DECISION_APPROVAL_DENIED",
          entityType: "StrategicDecision",
          entityId: body.decisionId,
          authorized: false,
          denialReason: `Role ${session.user.role} cannot approve board resolutions.`,
        });
        return NextResponse.json(
          { error: "Only Board Member, CEO, or CFO can approve strategic decisions." },
          { status: 403 }
        );
      }

      const existing = await prisma.strategicDecision.findFirst({
        where: { id: body.decisionId, companyId: session.company.id },
      });
      if (!existing) {
        return NextResponse.json({ error: "Decision not found." }, { status: 404 });
      }

      const newStatus = body.approvalStatus === "REJECTED" ? "REJECTED" : "APPROVED";
      const updated = await prisma.strategicDecision.update({
        where: { id: existing.id },
        data: { approvalStatus: newStatus },
      });

      let createdBudget = null;
      const createdScheduleEvents = [];

      if (newStatus === "APPROVED" && existing.estimatedCost > 0) {
        // Section 13: Automatically translate approved resolution into budget + spending schedule + calendar!
        const existingBudget = await prisma.budget.findFirst({
          where: { decisionId: existing.id },
        });
        if (!existingBudget) {
          createdBudget = await prisma.budget.create({
            data: {
              companyId: session.company.id,
              departmentId: existing.departmentId,
              decisionId: existing.id,
              name: `${existing.title} — Approved Budget`,
              category: "PROJECT",
              fiscalPeriod: "Approved Resolution",
              allocatedAmount: existing.estimatedCost,
              status: "APPROVED",
              notes: `Generated automatically upon executive/board approval by ${session.user.name}.`,
              isSynthetic: true,
            },
          });

          // Remove old PROPOSED entry and create phased spending schedule
          await prisma.calendarEvent.deleteMany({
            where: { decisionId: existing.id, status: "PROPOSED" },
          });

          const trancheCount = Math.min(4, Math.max(2, body.tranches ?? 3));
          const trancheAmt = Math.round(existing.estimatedCost / trancheCount);
          const refNow = getCompanyReferenceDate(session.company);
          for (let i = 0; i < trancheCount; i++) {
            const eventDate = new Date(refNow.getTime() + (i + 1) * 10 * 24 * 60 * 60 * 1000);
            const ev = await prisma.calendarEvent.create({
              data: {
                companyId: session.company.id,
                departmentId: existing.departmentId,
                budgetId: createdBudget.id,
                decisionId: existing.id,
                title: `${existing.title} — Tranche ${i + 1}/${trancheCount}`,
                description: `Approved phased spending schedule from Board Resolution.`,
                eventDate,
                amount:
                  i === trancheCount - 1
                    ? existing.estimatedCost - trancheAmt * (trancheCount - 1)
                    : trancheAmt,
                direction: "OUTGOING",
                category: "Approved Strategic Initiative",
                status: i === 0 ? "APPROVED" : "FORECASTED",
                sourceLabel: `Decision: ${existing.title}`,
                isSynthetic: true,
              },
            });
            createdScheduleEvents.push(ev);
          }
        }
      } else if (newStatus === "REJECTED") {
        await prisma.calendarEvent.updateMany({
          where: { decisionId: existing.id },
          data: { status: "CANCELLED" },
        });
      }

      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: `STRATEGIC_DECISION_${newStatus}`,
        entityType: "StrategicDecision",
        entityId: existing.id,
        authorized: true,
        details: {
          budgetCreatedId: createdBudget?.id ?? null,
          scheduleEventsCreated: createdScheduleEvents.length,
        },
      });

      return NextResponse.json({
        decision: updated,
        createdBudget,
        createdScheduleEvents,
      });
    }

    return NextResponse.json(
      { error: "Unsupported meetings/decisions action." },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Meetings/Decisions operation failed", detail: String(err) },
      { status: 500 }
    );
  }
}

