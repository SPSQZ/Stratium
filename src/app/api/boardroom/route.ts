import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext, recordAuditLog } from "@/lib/auth/rbac";
import { getCompanyFinancialOverview } from "@/lib/finance/metrics";
import { orchestrateBoardroomQuery } from "@/lib/ai/orchestrator";

export async function GET(request: Request) {
  try {
    const session = await getSessionContext();
    const { searchParams } = new URL(request.url);
    const requestedMeetingId = searchParams.get("meetingId");

    const meetings = await prisma.meeting.findMany({
      where: { companyId: session.company.id },
      orderBy: { scheduledAt: "desc" },
    });

    const activeMeeting =
      (requestedMeetingId
        ? meetings.find((m) => m.id === requestedMeetingId)
        : null) ?? meetings[0] ?? null;

    const [messages, financialOverview, recentDecisions] = await Promise.all([
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
    ]);

    return NextResponse.json({
      company: session.company,
      meetings,
      activeMeeting,
      messages,
      financialSnapshot: {
        currency: financialOverview.currency,
        recordedCashBalance: financialOverview.recordedCashBalance,
        remainingBudgetTotal: financialOverview.remainingBudgetTotal,
        outstandingPayables: financialOverview.outstandingPayables,
        outstandingReceivables: financialOverview.outstandingReceivables,
        pendingApprovalCount: financialOverview.pendingApprovalCount,
        forecastedCashConsumption30d:
          financialOverview.forecastedCashConsumption30d,
      },
      recentDecisions,
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

