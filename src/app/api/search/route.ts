import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canAccessKnowledgeRecord, getSessionContext } from "@/lib/auth/rbac";

export async function GET(request: Request) {
  try {
    const session = await getSessionContext();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();

    if (!q) {
      return NextResponse.json({ results: [] });
    }

    const [sections, docs, decisions, invoices, transactions] = await Promise.all([
      prisma.companyProfileSection.findMany({
        where: { companyId: session.company.id },
      }),
      prisma.companyDocument.findMany({
        where: { companyId: session.company.id },
      }),
      prisma.strategicDecision.findMany({
        where: { companyId: session.company.id },
      }),
      prisma.invoice.findMany({
        where: { companyId: session.company.id },
      }),
      prisma.transaction.findMany({
        where: { companyId: session.company.id },
      }),
    ]);

    const results: Array<{
      kind: string;
      title: string;
      subtitle: string;
      href: string;
    }> = [];

    for (const s of sections) {
      if (!canAccessKnowledgeRecord(session.user, s.accessLevel, s.departmentId)) {
        continue;
      }
      if (`${s.title} ${s.summary} ${s.content}`.toLowerCase().includes(q)) {
        results.push({
          kind: "Intelligence",
          title: s.title,
          subtitle: `${s.category} · ${s.verificationStatus}`,
          href: "/intelligence",
        });
      }
    }

    for (const d of docs) {
      if (!canAccessKnowledgeRecord(session.user, d.accessLevel, d.departmentId)) {
        continue;
      }
      if (`${d.fileName} ${d.extractedSummary}`.toLowerCase().includes(q)) {
        results.push({
          kind: "Document",
          title: d.fileName,
          subtitle: d.sourceLabel,
          href: "/intelligence",
        });
      }
    }

    for (const dec of decisions) {
      if (`${dec.title} ${dec.description} ${dec.selectedOption}`.toLowerCase().includes(q)) {
        results.push({
          kind: "Decision",
          title: dec.title,
          subtitle: `Status: ${dec.approvalStatus}`,
          href: "/meetings",
        });
      }
    }

    for (const inv of invoices) {
      if (`${inv.invoiceNumber} ${inv.counterpartyName} ${inv.description}`.toLowerCase().includes(q)) {
        results.push({
          kind: "Invoice",
          title: `${inv.invoiceNumber} — ${inv.counterpartyName}`,
          subtitle: `${inv.direction} · ${inv.status}`,
          href: "/finance",
        });
      }
    }

    for (const tx of transactions) {
      if (`${tx.description} ${tx.counterparty} ${tx.category}`.toLowerCase().includes(q)) {
        results.push({
          kind: "Transaction",
          title: tx.description,
          subtitle: `${tx.direction} · ${tx.status}`,
          href: "/payments",
        });
      }
    }

    return NextResponse.json({ results: results.slice(0, 15) });
  } catch (err) {
    return NextResponse.json(
      { error: "Search failed", detail: String(err) },
      { status: 500 }
    );
  }
}

