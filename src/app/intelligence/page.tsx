"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Upload, Plus, Lock, FileText, Building2 } from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { StatusBadge } from "@/components/StatusBadge";
import {
  CATEGORY_LABELS,
  INTELLIGENCE_CATEGORIES,
  formatDateShort,
  type IntelligenceCategory,
} from "@/lib/types";

interface IntelligencePayload {
  company: {
    id: string;
    name: string;
    industry: string;
    businessModel: string;
    description: string;
    operatingRegions: string;
    companySize: string;
    strategicObjectives: string;
    productsAndServices: string;
    customerSegments: string;
    competitorsSummary: string;
    historicalCutoffDate: string | null;
  };
  departments: Array<{ id: string; name: string; code: string }>;
  sections: Array<{
    id: string;
    category: IntelligenceCategory;
    title: string;
    summary: string;
    content: string;
    sourceType: string;
    sourceCitation: string;
    verificationStatus: string;
    effectiveDate: string | null;
    accessLevel: string;
    department: { name: string } | null;
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
    sourceLabel: string;
    sourceType: string;
    verificationStatus: string;
    extractionStatus: string;
    extractedSummary: string;
    associatedInfo: string;
    accessLevel: string;
    createdAt: string;
  }>;
  restrictedCount: number;
}

export default function IntelligencePage() {
  const { revision } = useSession();
  const [data, setData] = useState<IntelligencePayload | null>(null);
  const [tab, setTab] = useState<"KNOWLEDGE" | "DOCUMENTS" | "PROFILE">(
    "KNOWLEDGE"
  );
  const [selectedCat, setSelectedCat] = useState<string>("ALL");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manual entry form
  const [showAddKnowledge, setShowAddKnowledge] = useState(false);
  const [newEntry, setNewEntry] = useState({
    category: "STRATEGY",
    title: "",
    summary: "",
    content: "",
    sourceCitation: "",
    verificationStatus: "USER_PROVIDED_UNVERIFIED",
    accessLevel: "COMPANY_WIDE",
  });

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMeta, setUploadMeta] = useState({
    category: "FINANCIALS",
    sourceLabel: "Internal Financial Upload",
    verificationStatus: "USER_PROVIDED_UNVERIFIED",
    accessLevel: "COMPANY_WIDE",
  });
  const [uploading, setUploading] = useState(false);

  // Profile edit state
  const [profileForm, setProfileForm] = useState({
    industry: "",
    businessModel: "",
    description: "",
    operatingRegions: "",
    companySize: "",
    strategicObjectives: "",
    productsAndServices: "",
    customerSegments: "",
    competitorsSummary: "",
  });

  const loadData = useCallback(async () => {
    const res = await fetch("/api/intelligence", { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as IntelligencePayload;
      setData(json);
      setProfileForm({
        industry: json.company.industry,
        businessModel: json.company.businessModel,
        description: json.company.description,
        operatingRegions: json.company.operatingRegions,
        companySize: json.company.companySize,
        strategicObjectives: json.company.strategicObjectives,
        productsAndServices: json.company.productsAndServices,
        customerSegments: json.company.customerSegments,
        competitorsSummary: json.company.competitorsSummary,
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const res = await fetch("/api/intelligence", { cache: "no-store" });
      if (res.ok && active) {
        const json = (await res.json()) as IntelligencePayload;
        setData(json);
        setProfileForm({
          industry: json.company.industry,
          businessModel: json.company.businessModel,
          description: json.company.description,
          operatingRegions: json.company.operatingRegions,
          companySize: json.company.companySize,
          strategicObjectives: json.company.strategicObjectives,
          productsAndServices: json.company.productsAndServices,
          customerSegments: json.company.customerSegments,
          competitorsSummary: json.company.competitorsSummary,
        });
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [revision]);

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("category", uploadMeta.category);
      fd.append("sourceLabel", uploadMeta.sourceLabel);
      fd.append("verificationStatus", uploadMeta.verificationStatus);
      fd.append("accessLevel", uploadMeta.accessLevel);

      const res = await fetch("/api/intelligence", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMessage(json.error || "Upload failed.");
      } else {
        setUploadFile(null);
        setStatusMessage(
          `Uploaded "${json.document.fileName}" (${json.document.extractionStatus}) — indexed ${json.chunkCount} retrieval chunk(s).`
        );
        await loadData();
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleAddKnowledge(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    const res = await fetch("/api/intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "KNOWLEDGE_SECTION", ...newEntry }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErrorMessage(json.error || "Failed to add intelligence entry.");
    } else {
      setShowAddKnowledge(false);
      setNewEntry({
        category: "STRATEGY",
        title: "",
        summary: "",
        content: "",
        sourceCitation: "",
        verificationStatus: "USER_PROVIDED_UNVERIFIED",
        accessLevel: "COMPANY_WIDE",
      });
      setStatusMessage("Structured knowledge section added and indexed for AI Boardroom.");
      await loadData();
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    const res = await fetch("/api/intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "PROFILE_UPDATE", ...profileForm }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErrorMessage(json.error || "Permission denied updating company profile.");
    } else {
      setStatusMessage("Company profile updated.");
      await loadData();
    }
  }

  if (!data) {
    return (
      <div className="p-8 text-sm text-[#667085]">
        Loading company intelligence repository...
      </div>
    );
  }

  const filteredSections =
    selectedCat === "ALL"
      ? data.sections
      : data.sections.filter((s) => s.category === selectedCat);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-[#202938]">
            Company Intelligence
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Structured company profile, verified historical facts, synthetic demo records, and uploaded PDF/CSV/Excel sources.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("KNOWLEDGE")}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              tab === "KNOWLEDGE"
                ? "bg-[#315B7D] text-white"
                : "border border-[#E5E7EB] bg-[#FFFFFF] text-[#202938]"
            }`}
          >
            Knowledge Base ({data.sections.length})
          </button>
          <button
            onClick={() => setTab("DOCUMENTS")}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              tab === "DOCUMENTS"
                ? "bg-[#315B7D] text-white"
                : "border border-[#E5E7EB] bg-[#FFFFFF] text-[#202938]"
            }`}
          >
            Documents &amp; Upload ({data.documents.length})
          </button>
          <button
            onClick={() => setTab("PROFILE")}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              tab === "PROFILE"
                ? "bg-[#315B7D] text-white"
                : "border border-[#E5E7EB] bg-[#FFFFFF] text-[#202938]"
            }`}
          >
            Company Profile
          </button>
        </div>
      </div>

      {data.restrictedCount > 0 && (
        <div className="rounded border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-2 text-xs text-[#667085] flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-[#315B7D]" />
          <span>
            RBAC/ABAC Isolation Active: {data.restrictedCount} restricted record(s) (e.g., confidential HR or Finance memos) are hidden for your current demo role.
          </span>
        </div>
      )}

      {statusMessage && (
        <div className="rounded border border-[#16A34A]/30 bg-[#16A34A]/10 px-3 py-2 text-xs text-[#16A34A]">
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded border border-[#DC5252]/30 bg-[#DC5252]/10 px-3 py-2 text-xs text-[#DC5252]">
          {errorMessage}
        </div>
      )}

      {/* TAB 1: Knowledge Base */}
      {tab === "KNOWLEDGE" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedCat("ALL")}
                className={`rounded px-2.5 py-1 text-xs ${
                  selectedCat === "ALL"
                    ? "bg-[#202938] text-white font-medium"
                    : "border border-[#E5E7EB] bg-[#FFFFFF] text-[#667085]"
                }`}
              >
                All Domains
              </button>
              {INTELLIGENCE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCat(cat)}
                  className={`rounded px-2.5 py-1 text-xs ${
                    selectedCat === cat
                      ? "bg-[#202938] text-white font-medium"
                      : "border border-[#E5E7EB] bg-[#FFFFFF] text-[#667085]"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddKnowledge((s) => !s)}
              className="inline-flex items-center gap-1 rounded bg-[#315B7D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#274A66]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Manual Entry
            </button>
          </div>

          {showAddKnowledge && (
            <form
              onSubmit={handleAddKnowledge}
              className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3 text-xs"
            >
              <div className="font-medium text-sm text-[#202938]">
                Add Structured Company Knowledge
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Domain</label>
                  <select
                    value={newEntry.category}
                    onChange={(e) =>
                      setNewEntry((p) => ({ ...p, category: e.target.value }))
                    }
                    className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
                  >
                    {INTELLIGENCE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Verification Classification
                  </label>
                  <select
                    value={newEntry.verificationStatus}
                    onChange={(e) =>
                      setNewEntry((p) => ({
                        ...p,
                        verificationStatus: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
                  >
                    <option value="USER_PROVIDED_UNVERIFIED">
                      User Provided (Unverified)
                    </option>
                    <option value="MANAGEMENT_ASSUMPTION">
                      Management Assumption
                    </option>
                    <option value="VERIFIED_PUBLIC">Verified Public Fact</option>
                    <option value="SYNTHETIC_RECORD">Synthetic Record</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Access Scope</label>
                  <select
                    value={newEntry.accessLevel}
                    onChange={(e) =>
                      setNewEntry((p) => ({ ...p, accessLevel: e.target.value }))
                    }
                    className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
                  >
                    <option value="COMPANY_WIDE">Company-Wide</option>
                    <option value="LEADERSHIP_ONLY">Leadership Only</option>
                    <option value="FINANCE_AND_EXEC">Finance &amp; Exec</option>
                    <option value="HR_RESTRICTED">HR Restricted</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Title *</label>
                  <input
                    required
                    value={newEntry.title}
                    onChange={(e) =>
                      setNewEntry((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="e.g., Q1 Supplier Copper Tariff Exposure"
                    className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Source Citation
                  </label>
                  <input
                    value={newEntry.sourceCitation}
                    onChange={(e) =>
                      setNewEntry((p) => ({
                        ...p,
                        sourceCitation: e.target.value,
                      }))
                    }
                    placeholder="e.g., Internal Procurement Memo #14"
                    className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">Content *</label>
                <textarea
                  required
                  rows={3}
                  value={newEntry.content}
                  onChange={(e) =>
                    setNewEntry((p) => ({ ...p, content: e.target.value }))
                  }
                  className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddKnowledge(false)}
                  className="rounded border border-[#E5E7EB] px-3 py-1.5 text-[#667085]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-[#315B7D] px-3.5 py-1.5 font-medium text-white"
                >
                  Save Entry
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSections.map((sec) => (
              <div
                key={sec.id}
                className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-[#315B7D]">
                      {CATEGORY_LABELS[sec.category] ?? sec.category}
                    </div>
                    <h3 className="text-sm font-medium text-[#202938]">
                      {sec.title}
                    </h3>
                  </div>
                  <StatusBadge label={sec.verificationStatus} />
                </div>
                <p className="text-xs text-[#667085]">{sec.summary}</p>
                <p className="text-xs text-[#202938] leading-relaxed whitespace-pre-line">
                  {sec.content}
                </p>
                <div className="pt-2 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#667085]">
                  <span>Source: {sec.sourceCitation}</span>
                  <span>
                    Scope: {sec.accessLevel.replace(/_/g, " ")}
                    {sec.effectiveDate ? ` · ${sec.effectiveDate}` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Documents & Upload */}
      {tab === "DOCUMENTS" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <form
            onSubmit={handleUploadSubmit}
            className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3 text-xs h-fit"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-[#202938]">
              <Upload className="h-4 w-4 text-[#315B7D]" />
              Upload PDF, CSV, Excel (.xlsx), or TXT
            </div>
            <p className="text-[#667085]">
              Documents are parsed server-side, chunked, and immediately available for RBAC-filtered AI Boardroom retrieval.
            </p>
            <div>
              <label className="block font-medium mb-1">Select File *</label>
              <input
                type="file"
                accept=".pdf,.csv,.xlsx,.txt,.md"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="w-full rounded border border-[#E5E7EB] bg-[#F7F8FA] p-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Domain Category</label>
              <select
                value={uploadMeta.category}
                onChange={(e) =>
                  setUploadMeta((p) => ({ ...p, category: e.target.value }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              >
                {INTELLIGENCE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Source Label</label>
              <input
                value={uploadMeta.sourceLabel}
                onChange={(e) =>
                  setUploadMeta((p) => ({ ...p, sourceLabel: e.target.value }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Access Level</label>
              <select
                value={uploadMeta.accessLevel}
                onChange={(e) =>
                  setUploadMeta((p) => ({ ...p, accessLevel: e.target.value }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              >
                <option value="COMPANY_WIDE">Company-Wide</option>
                <option value="LEADERSHIP_ONLY">Leadership Only</option>
                <option value="FINANCE_AND_EXEC">Finance &amp; Exec</option>
                <option value="HR_RESTRICTED">HR Restricted</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={!uploadFile || uploading}
              className="w-full rounded bg-[#315B7D] py-2 font-medium text-white hover:bg-[#274A66] disabled:opacity-50"
            >
              {uploading ? "Extracting & Indexing..." : "Upload & Parse Document"}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={async () => {
                setUploading(true);
                setErrorMessage(null);
                setStatusMessage(null);
                try {
                  const csvContent =
                    "CorridorSite,EstCapexUSD,UtilityLeadWeeks,Notes\n" +
                    "Barstow CA,168000,18,I-15 LA-Las Vegas midpoint\n" +
                    "Gilroy CA,162000,14,US-101 Bay Area gateway\n" +
                    "Tejon Ranch CA,174000,20,I-5 Grapevine grade station\n";
                  const blob = new Blob([csvContent], { type: "text/csv" });
                  const fd = new FormData();
                  fd.append("file", blob, "Sample_Corridor_Schedule.csv");
                  fd.append("category", "OPERATIONS");
                  fd.append("sourceLabel", "Sample Demo Dataset");
                  fd.append("verificationStatus", "SYNTHETIC_RECORD");
                  fd.append("accessLevel", "COMPANY_WIDE");
                  const res = await fetch("/api/intelligence", {
                    method: "POST",
                    body: fd,
                  });
                  const json = await res.json();
                  if (res.ok) {
                    setStatusMessage(
                      `Loaded sample dataset "${json.document.fileName}" (${json.chunkCount} chunk(s) indexed).`
                    );
                    await loadData();
                  } else {
                    setErrorMessage(json.error || "Sample load failed.");
                  }
                } finally {
                  setUploading(false);
                }
              }}
              className="w-full rounded border border-[#E5E7EB] bg-[#F7F8FA] py-1.5 font-medium text-[#315B7D] hover:bg-[#FFFFFF]"
            >
              Load Sample Operations CSV Dataset
            </button>
          </form>

          <div className="lg:col-span-2 rounded-md border border-[#E5E7EB] bg-[#FFFFFF] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E7EB] text-sm font-medium text-[#202938]">
              Ingested Documents &amp; Extraction Provenance
            </div>
            <div className="divide-y divide-[#E5E7EB]">
              {data.documents.map((doc) => (
                <div key={doc.id} className="p-4 space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-medium text-[#202938]">
                      <FileText className="h-4 w-4 text-[#315B7D]" />
                      <span>{doc.fileName}</span>
                      <span className="rounded bg-[#F7F8FA] border border-[#E5E7EB] px-1.5 py-0.5 text-[10px]">
                        {doc.fileType}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge label={doc.extractionStatus} />
                      <StatusBadge label={doc.verificationStatus} />
                    </div>
                  </div>
                  <p className="text-[#202938]">{doc.extractedSummary}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#667085]">
                    <span>
                      Source: {doc.sourceLabel} · {doc.associatedInfo}
                    </span>
                    <span>
                      Uploaded {formatDateShort(doc.createdAt)} · Access:{" "}
                      {doc.accessLevel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Company Profile */}
      {tab === "PROFILE" && (
        <form
          onSubmit={handleSaveProfile}
          className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-5 space-y-4 text-xs"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-[#202938] pb-2 border-b border-[#E5E7EB]">
            <Building2 className="h-4 w-4 text-[#315B7D]" />
            {data.company.name} — Corporate Profile
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium mb-1">Industry</label>
              <input
                value={profileForm.industry}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, industry: e.target.value }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Company Size</label>
              <input
                value={profileForm.companySize}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, companySize: e.target.value }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Operating Regions</label>
              <input
                value={profileForm.operatingRegions}
                onChange={(e) =>
                  setProfileForm((p) => ({
                    ...p,
                    operatingRegions: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">Business Model</label>
              <textarea
                rows={3}
                value={profileForm.businessModel}
                onChange={(e) =>
                  setProfileForm((p) => ({
                    ...p,
                    businessModel: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">
                Strategic Objectives
              </label>
              <textarea
                rows={3}
                value={profileForm.strategicObjectives}
                onChange={(e) =>
                  setProfileForm((p) => ({
                    ...p,
                    strategicObjectives: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">
                Products &amp; Services
              </label>
              <textarea
                rows={3}
                value={profileForm.productsAndServices}
                onChange={(e) =>
                  setProfileForm((p) => ({
                    ...p,
                    productsAndServices: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">
                Customer Segments
              </label>
              <textarea
                rows={3}
                value={profileForm.customerSegments}
                onChange={(e) =>
                  setProfileForm((p) => ({
                    ...p,
                    customerSegments: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">
                Competitors
              </label>
              <textarea
                rows={3}
                value={profileForm.competitorsSummary}
                onChange={(e) =>
                  setProfileForm((p) => ({
                    ...p,
                    competitorsSummary: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">
                Company Description
              </label>
              <textarea
                rows={3}
                value={profileForm.description}
                onChange={(e) =>
                  setProfileForm((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded bg-[#315B7D] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#274A66]"
            >
              Update Company Profile
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

