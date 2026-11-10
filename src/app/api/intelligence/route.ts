import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  canAccessKnowledgeRecord,
  getSessionContext,
  hasRolePermission,
  recordAuditLog,
} from "@/lib/auth/rbac";
import { parseUploadedDocument } from "@/lib/intelligence/parser";

export async function GET() {
  try {
    const session = await getSessionContext();
    const [company, departments, sections, documents] = await Promise.all([
      prisma.company.findUniqueOrThrow({ where: { id: session.company.id } }),
      prisma.department.findMany({
        where: { companyId: session.company.id },
        orderBy: { name: "asc" },
      }),
      prisma.companyProfileSection.findMany({
        where: { companyId: session.company.id },
        include: { department: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.companyDocument.findMany({
        where: { companyId: session.company.id },
        include: { department: true, uploadedBy: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const visibleSections = sections.filter((s) =>
      canAccessKnowledgeRecord(session.user, s.accessLevel, s.departmentId)
    );
    const visibleDocuments = documents.filter((d) =>
      canAccessKnowledgeRecord(session.user, d.accessLevel, d.departmentId)
    );

    return NextResponse.json({
      company,
      departments,
      sections: visibleSections,
      documents: visibleDocuments,
      restrictedCount:
        sections.length -
        visibleSections.length +
        (documents.length - visibleDocuments.length),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load company intelligence", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionContext();

    if (!hasRolePermission(session.user.role, "UPLOAD_INTELLIGENCE")) {
      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "INTELLIGENCE_WRITE_DENIED",
        entityType: "CompanyIntelligence",
        entityId: session.company.id,
        authorized: false,
        denialReason: `Role ${session.user.role} cannot add or upload company intelligence.`,
      });
      return NextResponse.json(
        {
          error: `Permission denied: role ${session.user.role} cannot modify company intelligence.`,
        },
        { status: 403 }
      );
    }

    const contentType = request.headers.get("content-type") || "";

    // 1. Multipart file upload (PDF / CSV / XLSX / TXT)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const category = String(formData.get("category") || "FINANCIALS");
      const sourceLabel = String(
        formData.get("sourceLabel") || "User Uploaded Document"
      );
      const accessLevel = String(formData.get("accessLevel") || "COMPANY_WIDE");
      const departmentId = formData.get("departmentId")
        ? String(formData.get("departmentId"))
        : null;
      const verificationStatus = String(
        formData.get("verificationStatus") || "USER_PROVIDED_UNVERIFIED"
      );

      if (!file) {
        return NextResponse.json(
          { error: "No file provided in upload." },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const parsed = await parseUploadedDocument({
        fileName: file.name,
        buffer,
        category,
      });

      const doc = await prisma.companyDocument.create({
        data: {
          companyId: session.company.id,
          departmentId,
          uploadedById: session.user.id,
          fileName: file.name,
          fileType: parsed.fileType,
          fileSizeBytes: buffer.length,
          sourceLabel,
          sourceType: "USER_UPLOADED",
          verificationStatus,
          extractionStatus: parsed.extractionStatus,
          extractedSummary: parsed.extractedSummary,
          associatedInfo: parsed.associatedInfo,
          accessLevel,
          chunks: {
            create: parsed.chunks.map((ch) => ({
              companyId: session.company.id,
              departmentId,
              category,
              chunkIndex: ch.index,
              content: ch.content,
              metadataJson: JSON.stringify(ch.metadata),
              accessLevel,
            })),
          },
        },
      });

      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "DOCUMENT_UPLOADED",
        entityType: "CompanyDocument",
        entityId: doc.id,
        authorized: true,
        details: {
          fileName: doc.fileName,
          fileType: doc.fileType,
          extractionStatus: doc.extractionStatus,
          chunkCount: parsed.chunks.length,
        },
      });

      return NextResponse.json(
        {
          document: doc,
          chunkCount: parsed.chunks.length,
          detectedRowsCount: parsed.detectedStructuredRows?.length ?? 0,
        },
        { status: 201 }
      );
    }

    // 2. JSON payload: either update company profile OR add manual knowledge section
    const body = (await request.json()) as {
      kind: "PROFILE_UPDATE" | "KNOWLEDGE_SECTION";
      // Profile update fields
      industry?: string;
      businessModel?: string;
      description?: string;
      operatingRegions?: string;
      companySize?: string;
      strategicObjectives?: string;
      productsAndServices?: string;
      customerSegments?: string;
      competitorsSummary?: string;
      // Knowledge section fields
      category?: string;
      title?: string;
      summary?: string;
      content?: string;
      sourceCitation?: string;
      verificationStatus?: string;
      accessLevel?: string;
      departmentId?: string | null;
      effectiveDate?: string | null;
    };

    if (body.kind === "PROFILE_UPDATE") {
      const updated = await prisma.company.update({
        where: { id: session.company.id },
        data: {
          ...(body.industry !== undefined ? { industry: body.industry } : {}),
          ...(body.businessModel !== undefined
            ? { businessModel: body.businessModel }
            : {}),
          ...(body.description !== undefined
            ? { description: body.description }
            : {}),
          ...(body.operatingRegions !== undefined
            ? { operatingRegions: body.operatingRegions }
            : {}),
          ...(body.companySize !== undefined
            ? { companySize: body.companySize }
            : {}),
          ...(body.strategicObjectives !== undefined
            ? { strategicObjectives: body.strategicObjectives }
            : {}),
          ...(body.productsAndServices !== undefined
            ? { productsAndServices: body.productsAndServices }
            : {}),
          ...(body.customerSegments !== undefined
            ? { customerSegments: body.customerSegments }
            : {}),
          ...(body.competitorsSummary !== undefined
            ? { competitorsSummary: body.competitorsSummary }
            : {}),
        },
      });
      await recordAuditLog({
        companyId: session.company.id,
        user: session.user,
        action: "COMPANY_PROFILE_UPDATED",
        entityType: "Company",
        entityId: updated.id,
        authorized: true,
      });
      return NextResponse.json({ company: updated });
    }

    if (!body.title?.trim() || !body.content?.trim()) {
      return NextResponse.json(
        { error: "Title and content are required for knowledge section." },
        { status: 400 }
      );
    }

    const section = await prisma.companyProfileSection.create({
      data: {
        companyId: session.company.id,
        departmentId: body.departmentId ?? null,
        category: body.category || "STRATEGY",
        title: body.title.trim(),
        summary: body.summary?.trim() || body.content.trim().slice(0, 180),
        content: body.content.trim(),
        sourceType: "MANUAL_ENTRY",
        sourceCitation: body.sourceCitation?.trim() || `Entered by ${session.user.name}`,
        verificationStatus:
          body.verificationStatus || "USER_PROVIDED_UNVERIFIED",
        effectiveDate: body.effectiveDate || null,
        accessLevel: body.accessLevel || "COMPANY_WIDE",
      },
    });

    await recordAuditLog({
      companyId: session.company.id,
      user: session.user,
      action: "INTELLIGENCE_SECTION_ADDED",
      entityType: "CompanyProfileSection",
      entityId: section.id,
      authorized: true,
      details: { category: section.category, title: section.title },
    });

    return NextResponse.json({ section }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to save company intelligence", detail: String(err) },
      { status: 500 }
    );
  }
}

