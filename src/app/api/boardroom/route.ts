import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext, recordAuditLog } from "@/lib/auth/rbac";
import { getCompanyFinancialOverview } from "@/lib/finance/metrics";
import { orchestrateBoardroomQuery } from "@/lib/ai/orchestrator";
import { formatCurrency } from "@/lib/types";

interface SuggestedInvestigation {
  label: string;
  isTranscript: boolean;
  prompt: string;
}

function buildSuggestedInvestigations(params: {
  company: {
    name: string;
    slug: string;
    industry: string;
    businessModel: string;
    productsAndServices: string;
    strategicObjectives: string;
    currency: string;
    isHistoricalDemo: boolean;
    historicalCutoffDate: string | null;
  };
  financial: {
    recordedCashBalance: number;
    remainingBudgetTotal: number;
    outstandingPayables: number;
    outstandingReceivables: number;
    pendingApprovalCount: number;
    forecastedCashConsumption30d: number;
  };
  documents: Array<{ fileName: string }>;
  decisions: Array<{ title: string; approvalStatus: string }>;
  paidEmployeeCount: number;
}): SuggestedInvestigation[] {
  const { company, financial, documents, decisions, paidEmployeeCount } = params;
  const cur = company.currency || "USD";
  const cashStr = formatCurrency(financial.recordedCashBalance, cur);
  const remBudgetStr = formatCurrency(financial.remainingBudgetTotal, cur);
  const burn30Str = formatCurrency(financial.forecastedCashConsumption30d, cur);
  const payablesStr = formatCurrency(financial.outstandingPayables, cur);
  const receivablesStr = formatCurrency(financial.outstandingReceivables, cur);

  if (company.isHistoricalDemo || company.slug.includes("tesla")) {
    return [
      {
        label: "Scenario 1: CEO vs CFO vs CTO Conflict",
        isTranscript: true,
        prompt:
          "CEO: We should aggressively expand Supercharger stations into 15 new regional corridors immediately.\nCFO: Our Q3 filings showed negative automotive margin and our financial position cannot support un-gated expansion.\nCTO: Our current power electronics engineering bandwidth and utility grid interconnection lead times cannot handle simultaneous rollout.",
      },
      {
        label: "Scenario 2: 10-Year Station Capacity Question",
        isTranscript: false,
        prompt:
          "Unexpected board question: How many charging stations can we realistically deploy over the next 10 years, what are the CapEx/OpEx ranges, and how does that compare to our recorded cash balance?",
      },
      {
        label: "Cutoff Verification (Post-2012 Test)",
        isTranscript: false,
        prompt:
          "What did Tesla's Model 3 launch and Gigafactory Nevada contribute to 2016 revenue?",
      },
    ];
  }

  if (company.slug.includes("meridian")) {
    return [
      {
        label: "Conflict: 45-Hub Growth vs Hardware Working Capital",
        isTranscript: true,
        prompt: `CEO: We should sign 15 new European & India depot charging contracts next quarter to capture fleet share.\nCFO: Hardware procurement ties up 40% supplier prepayments 60 days ahead of commissioning, straining our ${cashStr} recorded cash.\nCTO: GridOS telemetry onboarding and OCPP charger QA bandwidth are near full capacity.`,
      },
      {
        label: "5-Year Fleet Hub Capacity & Cash Runway",
        isTranscript: false,
        prompt: `How many commercial depot hubs can Meridian deploy over 5 years within our ${cashStr} cash reserve and ${remBudgetStr} remaining budget, comparing Optimistic, Baseline, and Adverse cases?`,
      },
      {
        label: "SaaS Margin vs Open Payables & Approvals",
        isTranscript: false,
        prompt: `With ${receivablesStr} in open receivables, ${payablesStr} in payables, and ${burn30Str} forecasted 30-day consumption, what liquidity guardrails should we set before approving new hardware capex?`,
      },
    ];
  }

  const focusArea =
    company.productsAndServices &&
    company.productsAndServices !== "Core commercial products and services."
      ? company.productsAndServices
      : company.industry;

  const thirdSuggestion: SuggestedInvestigation =
    documents.length > 0
      ? {
          label: `Evidence Check: ${documents[0].fileName}`,
          isTranscript: false,
          prompt: `Cross-check "${documents[0].fileName}" against ${company.name}'s recorded cash (${cashStr}), ${remBudgetStr} remaining budgets, and ${payablesStr} open payables. What assumptions need validation before committing spend?`,
        }
      : decisions.length > 0
      ? {
          label: `Decision Follow-Up: ${decisions[0].title}`,
          isTranscript: false,
          prompt: `Review our recent decision "${decisions[0].title}" alongside ${company.name}'s current cash balance (${cashStr}), ${financial.pendingApprovalCount} pending payment request(s), and ${burn30Str} 30-day forecasted outflows. What risks or missing metrics stand out?`,
        }
      : {
          label: "Liquidity, Payroll & Objectives Audit",
          isTranscript: false,
          prompt: `Evaluate ${company.name}'s strategic objectives ("${company.strategicObjectives.slice(
            0,
            140
          )}") against our ${cashStr} cash balance, ${receivablesStr} open receivables, ${payablesStr} payables, and ${paidEmployeeCount} active payroll schedule(s). What data should leadership upload next?`,
        };

  return [
    {
      label: `Conflict: ${company.name} Growth vs. Cash & Bandwidth`,
      isTranscript: true,
      prompt: `CEO: Let's accelerate expansion across ${focusArea} in our core markets next quarter.\nCFO: With ${cashStr} in recorded cash and ${burn30Str} forecasted in 30-day commitments, un-gated upfront spend could compress runway.\nCTO: Our current operations and engineering capacity cannot absorb rapid parallel scaling without phased milestones.`,
    },
    {
      label: "5-Year Rollout & Capital Capacity",
      isTranscript: false,
      prompt: `Unexpected board question: What phased 5-year expansion capacity in ${company.industry} can ${company.name} realistically support with ${cashStr} recorded cash and ${remBudgetStr} remaining budgets across Optimistic, Baseline, and Adverse cases?`,
    },
    thirdSuggestion,
  ];
}

export async function GET(request: Request) {
  try {
    const session = await getSessionContext();
    const { searchParams } = new URL(request.url);
    const requestedMeetingId = searchParams.get("meetingId");

    const [company, meetings] = await Promise.all([
      prisma.company.findUniqueOrThrow({
        where: { id: session.company.id },
      }),
      prisma.meeting.findMany({
        where: { companyId: session.company.id },
        orderBy: { scheduledAt: "desc" },
      }),
    ]);

    const activeMeeting =
      (requestedMeetingId
        ? meetings.find((m) => m.id === requestedMeetingId)
        : null) ?? meetings[0] ?? null;

    const [
      messages,
      financialOverview,
      recentDecisions,
      recentDocuments,
      paidEmployeeCount,
    ] = await Promise.all([
      activeMeeting
        ? prisma.boardroomMessage.findMany({
            where: {
              companyId: session.company.id,
              meetingId: activeMeeting.id,
            },
            orderBy: { createdAt: "asc" },
          })
        : Promise.resolve([]),
      getCompanyFinancialOverview(session.company.id),
      prisma.strategicDecision.findMany({
        where: { companyId: session.company.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.companyDocument.findMany({
        where: { companyId: session.company.id },
        select: { fileName: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      prisma.user.count({
        where: {
          companyId: session.company.id,
          monthlySalary: { gt: 0 },
          payrollStatus: { not: "PAUSED" },
        },
      }),
    ]);

    const financialSnapshot = {
      currency: financialOverview.currency,
      recordedCashBalance: financialOverview.recordedCashBalance,
      remainingBudgetTotal: financialOverview.remainingBudgetTotal,
      outstandingPayables: financialOverview.outstandingPayables,
      outstandingReceivables: financialOverview.outstandingReceivables,
      pendingApprovalCount: financialOverview.pendingApprovalCount,
      forecastedCashConsumption30d:
        financialOverview.forecastedCashConsumption30d,
    };

    const suggestedInvestigations = buildSuggestedInvestigations({
      company,
      financial: financialSnapshot,
      documents: recentDocuments,
      decisions: recentDecisions,
      paidEmployeeCount,
    });

    return NextResponse.json({
      company: {
        id: company.id,
        slug: company.slug,
        name: company.name,
        industry: company.industry,
        currency: company.currency,
        historicalCutoffDate: company.historicalCutoffDate,
        isHistoricalDemo: company.isHistoricalDemo,
      },
      meetings,
      activeMeeting,
      messages,
      financialSnapshot,
      recentDecisions,
      suggestedInvestigations,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load AI Boardroom", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionContext();
    const body = (await request.json()) as {
      action?: "ASK" | "SUMMARIZE_MEETING";
      meetingId?: string;
      prompt?: string;
      speakerName?: string;
      speakerRole?: string;
      isTranscriptPaste?: boolean;
    };

    if (body.action === "SUMMARIZE_MEETING" && body.meetingId) {
      const targetMeeting = await prisma.meeting.findFirst({
        where: { id: body.meetingId, companyId: session.company.id },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
          decisions: true,
        },
      });
      if (!targetMeeting) {
        return NextResponse.json(
          { error: "Meeting not found." },
          { status: 404 }
        );
      }

      const participantNotes = targetMeeting.messages
        .filter((m) => m.messageType !== "AI_ANALYSIS")
        .map((m) => `${m.speakerName} (${m.speakerRole}): ${m.content}`);
      const aiFindings = targetMeeting.messages
        .filter((m) => m.messageType === "AI_ANALYSIS")
        .slice(-2)
        .map((m) => m.content.split("\n")[0]);

      const summary = [
        `Session "${targetMeeting.title}" covered ${participantNotes.length} participant/transcript statement(s) and ${targetMeeting.decisions.length} linked resolution(s).`,
        aiFindings.length > 0
          ? `Key AI Findings: ${aiFindings.join(" | ")}`
          : "No AI analysis generated yet.",
      ].join(" ");

      const updated = await prisma.meeting.update({
        where: { id: targetMeeting.id },
        data: {
          aiSummary: summary,
          actionItemsJson: JSON.stringify([
            "Review any proposed resolutions in Meetings & Decisions",
            "Verify open payment approvals and liquidity headroom before commitment",
          ]),
        },
      });
      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "MEETING_SUMMARIZED",
        entityType: "Meeting",
        entityId: targetMeeting.id,
        authorized: true,
      });
      return NextResponse.json({ meeting: updated });
    }

    if (!body.prompt?.trim()) {
      return NextResponse.json(
        { error: "Prompt or transcript input cannot be empty." },
        { status: 400 }
      );
    }

    let meeting = body.meetingId
      ? await prisma.meeting.findFirst({
          where: { id: body.meetingId, companyId: session.company.id },
        })
      : await prisma.meeting.findFirst({
          where: { companyId: session.company.id },
          orderBy: { scheduledAt: "desc" },
        });

    if (!meeting) {
      meeting = await prisma.meeting.create({
        data: {
          companyId: session.company.id,
          title: `${session.company.name} — Live Boardroom Session`,
          meetingType: "Ad-hoc Executive Review",
          scheduledAt: new Date(),
          status: "IN_PROGRESS",
          agenda: "Strategic review and live boardroom Q&A.",
          participantsJson: JSON.stringify([
            { name: session.user.name, role: session.user.role },
          ]),
          contextSummary: "Live interactive boardroom inquiry.",
        },
      });
    }

    const priorMessages = await prisma.boardroomMessage.findMany({
      where: { companyId: session.company.id, meetingId: meeting.id },
      orderBy: { createdAt: "asc" },
      take: 16,
    });

    const userMsg = await prisma.boardroomMessage.create({
      data: {
        companyId: session.company.id,
        meetingId: meeting.id,
        authorUserId: session.user.id,
        speakerName: body.speakerName?.trim() || session.user.name,
        speakerRole: body.speakerRole?.trim() || session.user.role,
        messageType: body.isTranscriptPaste ? "TRANSCRIPT_CHUNK" : "PARTICIPANT",
        content: body.prompt.trim(),
      },
    });

    if (body.isTranscriptPaste) {
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          transcript: meeting.transcript
            ? `${meeting.transcript}\n${body.prompt.trim()}`
            : body.prompt.trim(),
        },
      });
    }

    const structured = await orchestrateBoardroomQuery({
      session,
      meetingTitle: meeting.title,
      meetingContext: meeting.contextSummary,
      prompt: body.prompt.trim(),
      speakerName: body.speakerName?.trim() || session.user.name,
      speakerRole: body.speakerRole?.trim() || session.user.role,
      recentTranscript: priorMessages
        .filter((m) => m.messageType !== "AI_ANALYSIS")
        .map((m) => ({
          speaker: m.speakerName,
          role: m.speakerRole,
          text: m.content,
        })),
    });

    const aiMsg = await prisma.boardroomMessage.create({
      data: {
        companyId: session.company.id,
        meetingId: meeting.id,
        speakerName: "Stratium Boardroom Assistant",
        speakerRole: "AI_ORCHESTRATOR",
        messageType: "AI_ANALYSIS",
        content: structured.directAnswer,
        structuredResponseJson: JSON.stringify(structured),
      },
    });

    await recordAuditLog({
      companyId: session.company.id,
      user: session.user,
      action: "BOARDROOM_AI_QUERY",
      entityType: "Meeting",
      entityId: meeting.id,
      authorized: true,
      details: {
        mode: structured.mode,
        toolsCalled: structured.toolTrace.map((t) => t.tool),
      },
    });

    return NextResponse.json({
      meetingId: meeting.id,
      userMessage: userMsg,
      aiMessage: aiMsg,
      structuredResponse: structured,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Boardroom analysis failed", detail: String(err) },
      { status: 500 }
    );
  }
}

