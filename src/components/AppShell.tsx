"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquareText,
  Building2,
  GitBranch,
  Landmark,
  CalendarDays,
  CreditCard,
  ClipboardCheck,
  ShieldCheck,
  Search,
  Bell,
  Plus,
  Menu,
  X,
  Info,
} from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { formatCurrency, ROLE_LABELS } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/boardroom", label: "AI Boardroom", icon: MessageSquareText },
  { href: "/intelligence", label: "Company Intelligence", icon: Building2 },
  { href: "/planning", label: "Strategic Planning", icon: GitBranch },
  { href: "/finance", label: "Financial Management", icon: Landmark },
  { href: "/calendar", label: "Financial Calendar", icon: CalendarDays },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/meetings", label: "Meetings & Decisions", icon: ClipboardCheck },
  { href: "/admin", label: "Administration", icon: ShieldCheck },
];

const DEMO_COMPANY_SLUGS = new Set(["tesla-2012-sim", "meridian-mobility"]);

function isSeededDemoCompany(c: {
  slug: string;
  isHistoricalDemo: boolean;
}): boolean {
  return c.isHistoricalDemo || DEMO_COMPANY_SLUGS.has(c.slug);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data, refreshSession, switchWorkspaceOrUser } = useSession();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ kind: string; title: string; subtitle: string; href: string }>
  >([]);
  const [searchFocused, setSearchFocused] = useState(false);

  const [newCompany, setNewCompany] = useState({
    name: "",
    industry: "",
    businessModel: "",
    description: "",
    operatingRegions: "",
    recordedCashBalance: "1500000",
    currency: "USD",
  });
  const [onboardingSaving, setOnboardingSaving] = useState(false);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const json = await res.json();
        setSearchResults(json.results ?? []);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function handleOnboardCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!newCompany.name.trim() || !newCompany.industry.trim()) return;
    setOnboardingSaving(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newCompany,
          recordedCashBalance: Number(newCompany.recordedCashBalance) || 1000000,
        }),
      });
      if (res.ok) {
        setOnboardOpen(false);
        setNewCompany({
          name: "",
          industry: "",
          businessModel: "",
          description: "",
          operatingRegions: "",
          recordedCashBalance: "1500000",
          currency: "USD",
        });
        await refreshSession();
        window.location.reload();
      }
    } finally {
      setOnboardingSaving(false);
    }
  }

  const activeCompany = data?.session.company;
  const activeUser = data?.session.user;

  return (
    <div className="min-h-screen flex bg-[#F7F8FA] text-[#202938]">
      {/* Left Sidebar (Desktop) */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 bg-[#FFFFFF] border-r border-[#E5E7EB]">
        <div className="flex h-14 items-center gap-2.5 border-b border-[#E5E7EB] px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-[#315B7D] text-xs font-semibold text-white">
            S
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-[#202938]">
              Stratium
            </div>
            <div className="text-[11px] text-[#667085]">
              Boardroom &amp; Treasury
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-2.5 py-3 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors ${active
                    ? "bg-[#315B7D]/10 text-[#315B7D] font-medium border border-[#315B7D]/20"
                    : "text-[#667085] hover:bg-[#F7F8FA] hover:text-[#202938] border border-transparent"
                  }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#E5E7EB] p-3 text-[11px] text-[#667085] space-y-1">
          <div className="flex items-center justify-between">
            <span>AI Engine</span>
            <span className="font-medium text-[#202938] truncate max-w-[125px]">
              {data?.integrations.llmMode.includes("No API Key")
                ? "Local Tool Engine"
                : data?.integrations.llmMode ?? "Loading"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>PayPal Mode</span>
            <span
              className={`font-medium ${data?.integrations.paypalConfigured
                  ? "text-[#16A34A]"
                  : "text-[#D69E36]"
                }`}
            >
              {data?.integrations.paypalConfigured
                ? "Sandbox Live"
                : "Simulated Sandbox"}
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/25"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 flex w-64 flex-col bg-[#FFFFFF] border-r border-[#E5E7EB]">
            <div className="flex h-14 items-center justify-between border-b border-[#E5E7EB] px-4">
              <span className="text-sm font-semibold text-[#202938]">
                Stratium
              </span>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="rounded p-1 text-[#667085] hover:bg-[#F7F8FA]"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 px-2.5 py-3">
              {NAV_ITEMS.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] ${active
                        ? "bg-[#315B7D]/10 text-[#315B7D] font-medium"
                        : "text-[#667085] hover:bg-[#F7F8FA]"
                      }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col lg:pl-60 min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[#E5E7EB] bg-[#FFFFFF] px-4 lg:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="rounded p-1.5 text-[#667085] hover:bg-[#F7F8FA] lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Company Workspace Selector */}
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Company workspace selector"
                value={activeCompany?.id ?? ""}
                onChange={(e) =>
                  switchWorkspaceOrUser({ companyId: e.target.value })
                }
                className="h-8 max-w-[260px] rounded border border-[#E5E7EB] bg-[#F7F8FA] px-2.5 text-xs font-medium text-[#202938] focus:border-[#315B7D] focus:outline-none"
              >
                {data?.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {isSeededDemoCompany(c) ? `[DEMO] ${c.name}` : c.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setOnboardOpen(true)}
                className="inline-flex h-8 items-center gap-1 rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2.5 text-xs font-medium text-[#315B7D] hover:bg-[#F7F8FA]"
                title="Onboard new company workspace"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Company</span>
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative hidden md:block flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-[#667085]" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
              onChange={(e) => {
                const v = e.target.value;
                setSearchQuery(v);
                if (!v.trim()) setSearchResults([]);
              }}
              placeholder="Search intelligence, decisions, invoices..."
              className="h-8 w-full rounded border border-[#E5E7EB] bg-[#F7F8FA] pl-8 pr-3 text-xs text-[#202938] placeholder:text-[#667085] focus:border-[#315B7D] focus:bg-[#FFFFFF] focus:outline-none"
            />
            {searchFocused && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-9 z-40 rounded-md border border-[#E5E7EB] bg-[#FFFFFF] shadow-sm max-h-72 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <Link
                    key={`${r.kind}-${i}`}
                    href={r.href}
                    className="flex items-start justify-between gap-2 border-b border-[#E5E7EB] last:border-b-0 px-3 py-2 text-xs hover:bg-[#F7F8FA]"
                  >
                    <div>
                      <div className="font-medium text-[#202938]">{r.title}</div>
                      <div className="text-[11px] text-[#667085]">{r.subtitle}</div>
                    </div>
                    <span className="rounded bg-[#F7F8FA] px-1.5 py-0.5 text-[10px] font-medium text-[#667085] border border-[#E5E7EB]">
                      {r.kind}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Right Controls: Notifications + Demo Role Switcher */}
          <div className="flex items-center gap-2.5">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative flex h-8 w-8 items-center justify-center rounded border border-[#E5E7EB] bg-[#FFFFFF] text-[#667085] hover:bg-[#F7F8FA]"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {(data?.notifications.totalCount ?? 0) > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D69E36] px-1 text-[10px] font-medium text-white tabular-nums">
                    {data?.notifications.totalCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-10 z-40 w-80 rounded-md border border-[#E5E7EB] bg-[#FFFFFF] shadow-sm p-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
                    <span className="font-medium text-[#202938]">
                      Governance &amp; Treasury Alerts
                    </span>
                    <button
                      onClick={() => setNotifOpen(false)}
                      className="text-[#667085] hover:text-[#202938]"
                    >
                      Close
                    </button>
                  </div>
                  <div className="mt-2 space-y-2 max-h-72 overflow-y-auto">
                    {data?.notifications.pendingApprovals.map((p) => (
                      <Link
                        key={p.id}
                        href="/payments"
                        onClick={() => setNotifOpen(false)}
                        className="block rounded border border-[#E5E7EB] p-2 hover:bg-[#F7F8FA]"
                      >
                        <div className="font-medium text-[#202938]">{p.title}</div>
                        <div className="text-[11px] text-[#667085] tabular-nums">
                          {formatCurrency(p.amount, activeCompany?.currency)} ·{" "}
                          {p.status.replace(/_/g, " ")}
                        </div>
                      </Link>
                    ))}
                    {data?.notifications.dueInvoices.map((inv) => (
                      <Link
                        key={inv.id}
                        href="/finance"
                        onClick={() => setNotifOpen(false)}
                        className="block rounded border border-[#E5E7EB] p-2 hover:bg-[#F7F8FA]"
                      >
                        <div className="font-medium text-[#202938]">
                          {inv.invoiceNumber} — {inv.counterpartyName}
                        </div>
                        <div className="text-[11px] text-[#667085] tabular-nums">
                          Open{" "}
                          {formatCurrency(
                            inv.amount - inv.paidAmount,
                            activeCompany?.currency
                          )}{" "}
                          ({inv.direction})
                        </div>
                      </Link>
                    ))}
                    {data?.notifications.totalCount === 0 && (
                      <div className="py-4 text-center text-[#667085]">
                        No active alerts.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Controlled Demo Role Switcher */}
            <div className="flex items-center gap-2 rounded border border-[#E5E7EB] bg-[#F7F8FA] px-2 py-1">
              <span className="hidden xl:inline rounded bg-[#D69E36]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#A16207]">
                DEMO ONLY
              </span>
              <select
                aria-label="Demo role switcher"
                value={activeUser?.id ?? ""}
                onChange={(e) => switchWorkspaceOrUser({ userId: e.target.value })}
                className="bg-transparent text-xs font-medium text-[#202938] focus:outline-none max-w-[205px]"
              >
                {data?.companyUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {ROLE_LABELS[u.role] ?? u.role}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Historical Cutoff / Synthetic Data Integrity Banner */}
        {activeCompany && (
          <div className="border-b border-[#E5E7EB] bg-[#FFFFFF] px-4 lg:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#667085]">
            <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-[#3B82F6] shrink-0" />
              {isSeededDemoCompany(activeCompany) && (
                <span className="rounded bg-[#D69E36]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#A16207]">
                  DEMO WORKSPACE
                </span>
              )}
              <span>
                <strong className="font-medium text-[#202938]">
                  {activeCompany.name}
                </strong>
                {activeCompany.isHistoricalDemo &&
                  activeCompany.historicalCutoffDate && (
                    <>
                      {" "}
                      · Historical Knowledge Cutoff:{" "}
                      <span className="font-medium text-[#315B7D]">
                        {activeCompany.historicalCutoffDate}
                      </span>{" "}
                      (post-2012 facts excluded)
                    </>
                  )}
                {activeCompany.syntheticDataNotice && (
                  <> · {activeCompany.syntheticDataNotice}</>
                )}
              </span>
            </div>
            {activeUser && (
              <span className="text-[11px] text-[#667085]">
                Active Role:{" "}
                <strong className="font-medium text-[#202938]">
                  {ROLE_LABELS[activeUser.role] ?? activeUser.role}
                </strong>
                {activeUser.departmentName ? ` (${activeUser.departmentName})` : ""}
              </span>
            )}
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Company Onboarding Modal */}
      {onboardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <h2 className="text-base font-medium text-[#202938]">
                Onboard Company Workspace
              </h2>
              <button
                onClick={() => setOnboardOpen(false)}
                className="text-xs text-[#667085] hover:text-[#202938]"
              >
                Cancel
              </button>
            </div>
            <form onSubmit={handleOnboardCompany} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#202938] mb-1">
                  Company Name *
                </label>
                <input
                  required
                  value={newCompany.name}
                  onChange={(e) =>
                    setNewCompany((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g., Horizon CleanGrid Corp"
                  className="w-full rounded border border-[#E5E7EB] px-3 py-1.5 text-sm focus:border-[#315B7D] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#202938] mb-1">
                    Industry *
                  </label>
                  <input
                    required
                    value={newCompany.industry}
                    onChange={(e) =>
                      setNewCompany((p) => ({ ...p, industry: e.target.value }))
                    }
                    placeholder="e.g., Grid Storage SaaS"
                    className="w-full rounded border border-[#E5E7EB] px-3 py-1.5 text-sm focus:border-[#315B7D] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#202938] mb-1">
                    Opening Recorded Balance
                  </label>
                  <input
                    type="number"
                    value={newCompany.recordedCashBalance}
                    onChange={(e) =>
                      setNewCompany((p) => ({
                        ...p,
                        recordedCashBalance: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-[#E5E7EB] px-3 py-1.5 text-sm tabular-nums focus:border-[#315B7D] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#202938] mb-1">
                  Business Model
                </label>
                <input
                  value={newCompany.businessModel}
                  onChange={(e) =>
                    setNewCompany((p) => ({
                      ...p,
                      businessModel: e.target.value,
                    }))
                  }
                  placeholder="e.g., B2B hardware + recurring software monitoring"
                  className="w-full rounded border border-[#E5E7EB] px-3 py-1.5 text-sm focus:border-[#315B7D] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#202938] mb-1">
                  Description &amp; Objectives
                </label>
                <textarea
                  rows={3}
                  value={newCompany.description}
                  onChange={(e) =>
                    setNewCompany((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Key products, markets, and strategic objectives..."
                  className="w-full rounded border border-[#E5E7EB] px-3 py-1.5 text-sm focus:border-[#315B7D] focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOnboardOpen(false)}
                  className="rounded border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#667085] hover:bg-[#F7F8FA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={onboardingSaving}
                  className="rounded bg-[#315B7D] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#274A66] disabled:opacity-60"
                >
                  {onboardingSaving ? "Creating..." : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

