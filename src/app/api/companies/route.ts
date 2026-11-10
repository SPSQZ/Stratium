import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionContext,
  SESSION_COOKIE_NAME,
  signSessionToken,
} from "@/lib/auth/rbac";

export async function GET() {
  const companies = await prisma.company.findMany({
    orderBy: [{ isHistoricalDemo: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ companies });
}

export async function POST(request: Request) {
  try {
    await getSessionContext();
    const body = (await request.json()) as {
      name: string;
      industry: string;
      businessModel: string;
      description: string;
      operatingRegions?: string;
      companySize?: string;
      strategicObjectives?: string;
      productsAndServices?: string;
      customerSegments?: string;
      competitorsSummary?: string;
      currency?: string;
      recordedCashBalance?: number;
    };

    if (!body.name?.trim() || !body.industry?.trim()) {
      return NextResponse.json(
        { error: "Company name and industry are required." },
        { status: 400 }
      );
    }

    const baseSlug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const slug = `${baseSlug || "company"}-${Date.now().toString(36)}`;

    const company = await prisma.company.create({
      data: {
        slug,
        name: body.name.trim(),
        industry: body.industry.trim(),
        businessModel:
          body.businessModel?.trim() || "Corporate Operations & Services",
        description:
          body.description?.trim() ||
          `${body.name.trim()} corporate strategy and financial workspace.`,
        operatingRegions: body.operatingRegions?.trim() || "Primary Region",
        companySize: body.companySize?.trim() || "50–200 employees",
        strategicObjectives:
          body.strategicObjectives?.trim() ||
          "Sustainable growth, capital discipline, and operational resilience.",
        productsAndServices:
          body.productsAndServices?.trim() || "Core commercial products and services.",
        customerSegments:
          body.customerSegments?.trim() || "Enterprise & commercial accounts.",
        competitorsSummary:
          body.competitorsSummary?.trim() || "Regional & category incumbents.",
        isHistoricalDemo: false,
        syntheticDataNotice:
          "User-onboarded workspace. Verify imported records before executive reliance.",
        currency: body.currency?.trim() || "USD",
        recordedCashBalance: Number(body.recordedCashBalance) || 1000000,
        recordedBalanceSource: "Onboarding Opening Balance Entry",
      },
    });

    const execDept = await prisma.department.create({
      data: {
        companyId: company.id,
        name: "Executive Leadership",
        code: "EXEC",
        headTitle: "CEO",
        description: "Executive management and board governance.",
      },
    });
    const finDept = await prisma.department.create({
      data: {
        companyId: company.id,
        name: "Finance",
        code: "FIN",
        parentDepartmentId: execDept.id,
        headTitle: "CFO",
        description: "Treasury, budgeting, payables, and receivables.",
      },
    });
    const opsDept = await prisma.department.create({
      data: {
        companyId: company.id,
        name: "Operations & Engineering",
        code: "OPS",
        parentDepartmentId: execDept.id,
        headTitle: "Department Manager",
        description: "Core product delivery, infrastructure, and vendor operations.",
      },
    });

    const prefix = body.name.trim().split(" ")[0];
    const adminUser = await prisma.user.create({
      data: {
        companyId: company.id,
        departmentId: execDept.id,
        name: `${prefix} Workspace Admin (Demo)`,
        email: `admin@${slug}.local`,
        title: "Workspace Administrator",
        role: "ADMINISTRATOR",
      },
    });
    const ceoUser = await prisma.user.create({
      data: {
        companyId: company.id,
        departmentId: execDept.id,
        name: `${prefix} CEO (Demo)`,
        email: `ceo@${slug}.local`,
        title: "Chief Executive Officer",
        role: "CEO",
      },
    });
    await prisma.user.create({
      data: {
        companyId: company.id,
        departmentId: finDept.id,
        name: `${prefix} CFO (Demo)`,
        email: `cfo@${slug}.local`,
        title: "Chief Financial Officer",
        role: "CFO",
      },
    });
    await prisma.user.create({
      data: {
        companyId: company.id,
        departmentId: finDept.id,
        name: `${prefix} Finance Mgr (Demo)`,
        email: `finance@${slug}.local`,
        title: "Finance Manager",
        role: "FINANCE_MANAGER",
      },
    });
    await prisma.user.create({
      data: {
        companyId: company.id,
        departmentId: finDept.id,
        name: `${prefix} Executor (Demo)`,
        email: `executor@${slug}.local`,
        title: "Payment Executor",
        role: "PAYMENT_EXECUTOR",
      },
    });
    await prisma.user.create({
      data: {
        companyId: company.id,
        departmentId: opsDept.id,
        name: `${prefix} Ops Mgr (Demo)`,
        email: `opsmgr@${slug}.local`,
        title: "Department Manager",
        role: "DEPARTMENT_MANAGER",
      },
    });
    await prisma.user.create({
      data: {
        companyId: company.id,
        departmentId: opsDept.id,
        name: `${prefix} Analyst (Demo)`,
        email: `employee@${slug}.local`,
        title: "Operations Specialist",
        role: "EMPLOYEE",
      },
    });
    await prisma.user.create({
      data: {
        companyId: company.id,
        departmentId: finDept.id,
        name: `${prefix} Auditor (Demo)`,
        email: `auditor@${slug}.local`,
        title: "Compliance Auditor",
        role: "AUDITOR",
      },
    });

    await prisma.approvalPolicy.create({
      data: {
        companyId: company.id,
        name: "Default Corporate Spend Policy",
        minAmount: 0,
        maxAmount: null,
        requiresDeptManager: true,
        requiresFinanceManager: true,
        requiresExecutiveOrBoard: true,
        isActive: true,
      },
    });

    await prisma.companyProfileSection.create({
      data: {
        companyId: company.id,
        category: "STRATEGY",
        title: `${company.name} Strategic Profile`,
        summary: company.strategicObjectives,
        content: `${company.description}\n\nProducts & Services: ${company.productsAndServices}\nCustomers: ${company.customerSegments}\nCompetitors: ${company.competitorsSummary}`,
        sourceType: "MANUAL_ENTRY",
        sourceCitation: "Company Onboarding Form",
        verificationStatus: "MANAGEMENT_ASSUMPTION",
        accessLevel: "COMPANY_WIDE",
      },
    });

    await prisma.meeting.create({
      data: {
        companyId: company.id,
        title: `${company.name} — Inaugural Strategy & Budget Review`,
        meetingType: "Board Kickoff",
        scheduledAt: new Date(),
        status: "IN_PROGRESS",
        agenda: "1. Review opening capital balance\n2. Align departmental priorities",
        participantsJson: JSON.stringify([
          { name: ceoUser.name, role: "CEO" },
        ]),
        contextSummary: "Initial strategic boardroom session.",
        isSynthetic: false,
      },
    });

    const token = signSessionToken({
      companyId: company.id,
      userId: adminUser.id,
      issuedAt: Date.now(),
    });

    const res = NextResponse.json({ company }, { status: 201 });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to onboard company", detail: String(err) },
      { status: 500 }
    );
  }
}

