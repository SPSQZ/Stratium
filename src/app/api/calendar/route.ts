import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionContext,
  hasRolePermission,
  recordAuditLog,
} from "@/lib/auth/rbac";
import { getCompanyReferenceDate } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const session = await getSessionContext();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const [events, departments] = await Promise.all([
      prisma.calendarEvent.findMany({
        where: {
          companyId: session.company.id,
          ...(status && status !== "ALL" ? { status } : {}),
        },
        include: {
          department: true,
          budget: true,
          invoice: true,
          paymentRequest: true,
          decision: true,
        },
        orderBy: { eventDate: "asc" },
      }),
      prisma.department.findMany({
        where: { companyId: session.company.id },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      company: session.company,
      referenceDate: getCompanyReferenceDate(session.company).toISOString(),
      events,
      departments,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load financial calendar", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionContext();
    if (!hasRolePermission(session.user.role, "MANAGE_BUDGET")) {
      return NextResponse.json(
        { error: `Role ${session.user.role} cannot add calendar financial plans.` },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      title: string;
      description?: string;
      eventDate: string;
      amount: number;
      direction: "INCOMING" | "OUTGOING" | "ALLOCATION";
      category: string;
      status?: string;
      departmentId?: string | null;
    };

    if (!body.title?.trim() || !body.eventDate || !(Number(body.amount) > 0)) {
      return NextResponse.json(
        { error: "Title, eventDate, and positive amount are required." },
        { status: 400 }
      );
    }

    const event = await prisma.calendarEvent.create({
      data: {
        companyId: session.company.id,
        departmentId: body.departmentId || null,
        title: body.title.trim(),
        description: body.description?.trim() || "Planned financial calendar commitment.",
        eventDate: new Date(body.eventDate),
        amount: Number(body.amount),
        direction: body.direction || "OUTGOING",
        category: body.category || "Planned Commitment",
        status: body.status || "PROPOSED",
        sourceLabel: `Manual Plan (${session.user.name})`,
        isSynthetic: true,
      },
    });

    await recordAuditLog({
      companyId: session.company.id,
      user: session.user,
      action: "CALENDAR_EVENT_CREATED",
      entityType: "CalendarEvent",
      entityId: event.id,
      authorized: true,
      details: { title: event.title, amount: event.amount, status: event.status },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create calendar event", detail: String(err) },
      { status: 500 }
    );
  }
}

