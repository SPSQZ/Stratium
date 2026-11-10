"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ShieldCheck, UserPlus, Wallet } from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { StatusBadge } from "@/components/StatusBadge";
import {
  ROLE_LABELS,
  USER_ROLES,
  formatCurrency,
  formatDateShort,
  type UserRole,
} from "@/lib/types";

interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  title: string;
  role: UserRole;
  departmentId: string | null;
  employmentType: string;
  monthlySalary: number;
  payCycle: string;
  payDayOfMonth: number;
  payoutEmail: string;
  bankAccountRef: string;
  nextPayDate: string | null;
  payrollStatus: string;
  isDemoAccount: boolean;
  department: { name: string } | null;
}

interface AdminPayload {
  company: { id: string; name: string; currency: string };
  currentUser: { id: string; name: string; role: string };
  canViewAudit: boolean;
  departments: Array<{
    id: string;
    name: string;
    code: string;
    headTitle: string;
    description: string;
    confidentialScope: boolean;
    parentDepartment: { name: string } | null;
  }>;
  users: AdminUserItem[];
  payrollSummary?: {
    activePaidEmployees: number;
    totalEmployees: number;
    totalMonthlyPayroll: number;
  };
  approvalPolicies: Array<{
    id: string;
    name: string;
    minAmount: number;
    maxAmount: number | null;
    requiresDeptManager: boolean;
    requiresFinanceManager: boolean;
    requiresExecutiveOrBoard: boolean;
    isActive: boolean;
  }>;
  auditLogs: Array<{
    id: string;
    actorName: string;
    actorRole: string;
    action: string;
    entityType: string;
    entityId: string;
    authorized: boolean;
    denialReason: string | null;
    createdAt: string;
  }>;
}

const DEFAULT_EMPLOYEE_FORM = {
  name: "",
  email: "",
  title: "",
  role: "EMPLOYEE" as UserRole,
  departmentId: "",
  employmentType: "FULL_TIME",
  monthlySalary: "7500",
  payCycle: "MONTHLY",
  payDayOfMonth: "28",
  nextPayDate: "",
  payoutEmail: "",
  bankAccountRef: "",
  payrollStatus: "ACTIVE",
  scheduleCalendarEvent: true,
};

export default function AdministrationPage() {
  const { revision, refreshSession, switchWorkspaceOrUser } = useSession();
  const [data, setData] = useState<AdminPayload | null>(null);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<AdminUserItem | null>(
    null
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [policyForm, setPolicyForm] = useState({
    name: "",
    minAmount: "0",
    maxAmount: "",
    requiresDeptManager: true,
    requiresFinanceManager: true,
    requiresExecutiveOrBoard: true,
  });

  const [employeeForm, setEmployeeForm] = useState(DEFAULT_EMPLOYEE_FORM);
  const [editPayrollForm, setEditPayrollForm] = useState({
    title: "",
    departmentId: "",
    employmentType: "FULL_TIME",
    monthlySalary: "0",
    payCycle: "MONTHLY",
    payDayOfMonth: "28",
    nextPayDate: "",
    payoutEmail: "",
    bankAccountRef: "",
    payrollStatus: "ACTIVE",
    scheduleCalendarEvent: true,
  });

  const loadAdmin = useCallback(async () => {
    const res = await fetch("/api/admin", { cache: "no-store" });
    if (res.ok) {
      setData(await res.json());
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const res = await fetch("/api/admin", { cache: "no-store" });
      if (res.ok && active) {
        setData(await res.json());
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [revision]);

  async function handleCreatePolicy(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "CREATE_POLICY",
        name: policyForm.name,
        minAmount: Number(policyForm.minAmount) || 0,
        maxAmount: policyForm.maxAmount ? Number(policyForm.maxAmount) : null,
        requiresDeptManager: policyForm.requiresDeptManager,
        requiresFinanceManager: policyForm.requiresFinanceManager,
        requiresExecutiveOrBoard: policyForm.requiresExecutiveOrBoard,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Permission denied.");
    } else {
      setShowPolicyForm(false);
      setPolicyForm({
        name: "",
        minAmount: "0",
        maxAmount: "",
        requiresDeptManager: true,
        requiresFinanceManager: true,
        requiresExecutiveOrBoard: true,
      });
      setFeedback(`Created approval policy "${json.policy.name}".`);
      await loadAdmin();
    }
  }

  async function handleCreateEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "CREATE_USER",
        name: employeeForm.name,
        email: employeeForm.email,
        title: employeeForm.title || undefined,
        role: employeeForm.role,
        departmentId: employeeForm.departmentId || null,
        employmentType: employeeForm.employmentType,
        monthlySalary: Number(employeeForm.monthlySalary) || 0,
        payCycle: employeeForm.payCycle,
        payDayOfMonth: Number(employeeForm.payDayOfMonth) || 28,
        nextPayDate: employeeForm.nextPayDate || null,
        payoutEmail: employeeForm.payoutEmail || employeeForm.email,
        bankAccountRef: employeeForm.bankAccountRef,
        payrollStatus: employeeForm.payrollStatus,
        scheduleCalendarEvent: employeeForm.scheduleCalendarEvent,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to add employee.");
    } else {
      setShowEmployeeForm(false);
      setEmployeeForm(DEFAULT_EMPLOYEE_FORM);
      setFeedback(
        `Added employee "${json.user.name}" (${json.user.payCycle} · ${formatCurrency(
          json.user.monthlySalary,
          cur
        )}). Scheduled payroll on Financial Calendar.`
      );
      await Promise.all([loadAdmin(), refreshSession()]);
    }
  }

  function startEditPayroll(u: AdminUserItem) {
    setEditingEmployee(u);
    setEditPayrollForm({
      title: u.title,
      departmentId: u.departmentId || "",
      employmentType: u.employmentType || "FULL_TIME",
      monthlySalary: String(u.monthlySalary ?? 0),
      payCycle: u.payCycle || "MONTHLY",
      payDayOfMonth: String(u.payDayOfMonth ?? 28),
      nextPayDate: u.nextPayDate ? u.nextPayDate.slice(0, 10) : "",
      payoutEmail: u.payoutEmail || u.email,
      bankAccountRef: u.bankAccountRef || "",
      payrollStatus: u.payrollStatus || "ACTIVE",
      scheduleCalendarEvent: true,
    });
  }

  async function handleUpdatePayroll(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEmployee) return;
    setError(null);
    setFeedback(null);
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "UPDATE_USER_PAYROLL",
        userId: editingEmployee.id,
        title: editPayrollForm.title,
        departmentId: editPayrollForm.departmentId || null,
        employmentType: editPayrollForm.employmentType,
        monthlySalary: Number(editPayrollForm.monthlySalary) || 0,
        payCycle: editPayrollForm.payCycle,
        payDayOfMonth: Number(editPayrollForm.payDayOfMonth) || 28,
        nextPayDate: editPayrollForm.nextPayDate || null,
        payoutEmail: editPayrollForm.payoutEmail,
        bankAccountRef: editPayrollForm.bankAccountRef,
        payrollStatus: editPayrollForm.payrollStatus,
        scheduleCalendarEvent: editPayrollForm.scheduleCalendarEvent,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to update employee payroll.");
    } else {
      setFeedback(
        `Updated payroll & pay schedule for "${json.user.name}" (${formatCurrency(
          json.user.monthlySalary,
          cur
        )} · ${json.user.payCycle}).`
      );
      setEditingEmployee(null);
      await Promise.all([loadAdmin(), refreshSession()]);
    }
  }

  if (!data) {
    return (
      <div className="p-8 text-sm text-[#667085]">
        Loading governance, RBAC &amp; audit settings...
      </div>
    );
  }

  const cur = data.company.currency;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-[#202938]">
            Organisation, Employees &amp; Governance
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Department hierarchy, employee payroll schedules, 12-role RBAC/ABAC controls, payment thresholds, and audit logs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setShowEmployeeForm((s) => !s);
              setShowPolicyForm(false);
            }}
            className="inline-flex items-center gap-1 rounded bg-[#315B7D] px-3 py-1.5 text-xs font-medium text-white"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add Employee &amp; Salary
          </button>
          <button
            onClick={() => {
              setShowPolicyForm((s) => !s);
              setShowEmployeeForm(false);
            }}
            className="inline-flex items-center gap-1 rounded border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#202938]"
          >
            <Plus className="h-3.5 w-3.5" />
            New Approval Policy
          </button>
        </div>
      </div>

      {feedback && (
        <div className="rounded border border-[#16A34A]/30 bg-[#16A34A]/10 px-3 py-2 text-xs text-[#16A34A]">
          {feedback}
        </div>
      )}
      {error && (
        <div className="rounded border border-[#DC5252]/30 bg-[#DC5252]/10 px-3 py-2 text-xs text-[#DC5252]">
          {error}
        </div>
      )}

      {showEmployeeForm && (
        <form
          onSubmit={handleCreateEmployee}
          className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3 text-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-[#202938]">
              Add Employee, Compensation &amp; Payroll Schedule
            </span>
            <span className="text-[11px] text-[#667085]">
              All salary payouts still require human approval in Payments
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Full Name *
              </label>
              <input
                required
                placeholder="e.g. Jordan Lee"
                value={employeeForm.name}
                onChange={(e) =>
                  setEmployeeForm((p) => ({ ...p, name: e.target.value }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Corporate Email *
              </label>
              <input
                required
                type="email"
                placeholder="jordan.lee@company.com"
                value={employeeForm.email}
                onChange={(e) =>
                  setEmployeeForm((p) => ({ ...p, email: e.target.value }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Job Title
              </label>
              <input
                placeholder="e.g. Senior Systems Engineer"
                value={employeeForm.title}
                onChange={(e) =>
                  setEmployeeForm((p) => ({ ...p, title: e.target.value }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                RBAC Role *
              </label>
              <select
                value={employeeForm.role}
                onChange={(e) =>
                  setEmployeeForm((p) => ({
                    ...p,
                    role: e.target.value as UserRole,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2.5 py-1.5"
              >
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Department
              </label>
              <select
                value={employeeForm.departmentId}
                onChange={(e) =>
                  setEmployeeForm((p) => ({
                    ...p,
                    departmentId: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2.5 py-1.5"
              >
                <option value="">Executive / Cross-Functional</option>
                {data.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Employment Type
              </label>
              <select
                value={employeeForm.employmentType}
                onChange={(e) =>
                  setEmployeeForm((p) => ({
                    ...p,
                    employmentType: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2.5 py-1.5"
              >
                <option value="FULL_TIME">Full-Time Salaried</option>
                <option value="PART_TIME">Part-Time</option>
                <option value="CONTRACTOR">Contractor / Retainer</option>
                <option value="EXECUTIVE">Executive / Officer</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Monthly Salary / Gross Pay ({cur})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="7500"
                value={employeeForm.monthlySalary}
                onChange={(e) =>
                  setEmployeeForm((p) => ({
                    ...p,
                    monthlySalary: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Pay Cycle &amp; Pay Day (1-28)
              </label>
              <div className="flex gap-2">
                <select
                  value={employeeForm.payCycle}
                  onChange={(e) =>
                    setEmployeeForm((p) => ({ ...p, payCycle: e.target.value }))
                  }
                  className="flex-1 rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2 py-1.5"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="BIWEEKLY">Biweekly</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
                <input
                  type="number"
                  min="1"
                  max="28"
                  title="Pay day of month (1-28)"
                  value={employeeForm.payDayOfMonth}
                  onChange={(e) =>
                    setEmployeeForm((p) => ({
                      ...p,
                      payDayOfMonth: e.target.value,
                    }))
                  }
                  className="w-16 rounded border border-[#E5E7EB] px-2 py-1.5 tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Next Pay Date (optional override)
              </label>
              <input
                type="date"
                value={employeeForm.nextPayDate}
                onChange={(e) =>
                  setEmployeeForm((p) => ({
                    ...p,
                    nextPayDate: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                PayPal / Payout Email
              </label>
              <input
                type="email"
                placeholder="Defaults to corporate email"
                value={employeeForm.payoutEmail}
                onChange={(e) =>
                  setEmployeeForm((p) => ({
                    ...p,
                    payoutEmail: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Bank / Ledger Ref (optional)
              </label>
              <input
                placeholder="e.g. ACH-****4421"
                value={employeeForm.bankAccountRef}
                onChange={(e) =>
                  setEmployeeForm((p) => ({
                    ...p,
                    bankAccountRef: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Payroll Status
              </label>
              <select
                value={employeeForm.payrollStatus}
                onChange={(e) =>
                  setEmployeeForm((p) => ({
                    ...p,
                    payrollStatus: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2.5 py-1.5"
              >
                <option value="ACTIVE">Active Payroll</option>
                <option value="PAUSED">Paused</option>
                <option value="UNSCHEDULED">Unscheduled / Advisory Only</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-1.5 text-[#667085]">
              <input
                type="checkbox"
                checked={employeeForm.scheduleCalendarEvent}
                onChange={(e) =>
                  setEmployeeForm((p) => ({
                    ...p,
                    scheduleCalendarEvent: e.target.checked,
                  }))
                }
              />
              Forecast recurring salary run on Financial Calendar
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowEmployeeForm(false)}
                className="rounded border border-[#E5E7EB] px-3 py-1.5 text-[#667085]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-[#315B7D] px-3.5 py-1.5 font-medium text-white"
              >
                Save Employee &amp; Schedule
              </button>
            </div>
          </div>
        </form>
      )}

      {showPolicyForm && (
        <form
          onSubmit={handleCreatePolicy}
          className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3 text-xs"
        >
          <div className="font-medium text-sm text-[#202938]">
            Configure Payment Approval Policy Tier
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              required
              placeholder="Policy Name *"
              value={policyForm.name}
              onChange={(e) =>
                setPolicyForm((p) => ({ ...p, name: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
            />
            <input
              type="number"
              placeholder="Min Amount"
              value={policyForm.minAmount}
              onChange={(e) =>
                setPolicyForm((p) => ({ ...p, minAmount: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
            />
            <input
              type="number"
              placeholder="Max Amount (blank = unlimited)"
              value={policyForm.maxAmount}
              onChange={(e) =>
                setPolicyForm((p) => ({ ...p, maxAmount: e.target.value }))
              }
              className="rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={policyForm.requiresDeptManager}
                onChange={(e) =>
                  setPolicyForm((p) => ({
                    ...p,
                    requiresDeptManager: e.target.checked,
                  }))
                }
              />
              Requires Dept Manager
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={policyForm.requiresFinanceManager}
                onChange={(e) =>
                  setPolicyForm((p) => ({
                    ...p,
                    requiresFinanceManager: e.target.checked,
                  }))
                }
              />
              Requires Finance Manager
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={policyForm.requiresExecutiveOrBoard}
                onChange={(e) =>
                  setPolicyForm((p) => ({
                    ...p,
                    requiresExecutiveOrBoard: e.target.checked,
                  }))
                }
              />
              Requires Executive / Board
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowPolicyForm(false)}
              className="rounded border border-[#E5E7EB] px-3 py-1.5 text-[#667085]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-[#315B7D] px-3.5 py-1.5 font-medium text-white"
            >
              Save Policy
            </button>
          </div>
        </form>
      )}

      {/* Org Hierarchy & Approval Policies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-2.5">
          <h2 className="text-sm font-medium text-[#202938]">
            Organisation Hierarchy
          </h2>
          <div className="space-y-2 text-xs">
            {data.departments.map((d) => (
              <div
                key={d.id}
                className="rounded border border-[#E5E7EB] p-2.5 flex items-start justify-between gap-2"
              >
                <div>
                  <div className="font-medium text-[#202938]">
                    {d.name}{" "}
                    <span className="text-[#667085]">({d.code})</span>
                  </div>
                  <div className="text-[11px] text-[#667085]">
                    Head: {d.headTitle}
                    {d.parentDepartment
                      ? ` · Reports to ${d.parentDepartment.name}`
                      : ""}
                  </div>
                  <div className="text-[11px] text-[#667085] mt-0.5">
                    {d.description}
                  </div>
                </div>
                {d.confidentialScope && (
                  <StatusBadge label="RESTRICTED_SCOPE" tone="amber" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-2.5">
          <h2 className="text-sm font-medium text-[#202938]">
            Payment Approval Threshold Policies
          </h2>
          <div className="space-y-2 text-xs">
            {data.approvalPolicies.map((p) => (
              <div
                key={p.id}
                className="rounded border border-[#E5E7EB] p-2.5 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#202938]">{p.name}</span>
                  <StatusBadge label={p.isActive ? "ACTIVE" : "INACTIVE"} />
                </div>
                <div className="text-[11px] text-[#667085] tabular-nums">
                  Range: {formatCurrency(p.minAmount, cur)} —{" "}
                  {p.maxAmount !== null
                    ? formatCurrency(p.maxAmount, cur)
                    : "No Upper Cap"}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {p.requiresDeptManager && (
                    <StatusBadge label="DEPT_MANAGER" tone="grey" />
                  )}
                  {p.requiresFinanceManager && (
                    <StatusBadge label="FINANCE_MANAGER" tone="blue" />
                  )}
                  {p.requiresExecutiveOrBoard && (
                    <StatusBadge label="EXEC_OR_BOARD" tone="amber" />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded bg-[#F7F8FA] border border-[#E5E7EB] p-2.5 text-[11px] text-[#667085] flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-[#315B7D] shrink-0" />
            Backend enforces: no self-approval, no AI approval/execution, strict company &amp; department isolation, and read-only Auditor enforcement.
          </div>
        </div>
      </div>

      {/* Payroll Summary & Role Directory */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-3">
          <div className="text-[11px] text-[#667085]">Active Paid Employees</div>
          <div className="text-lg font-medium text-[#202938] tabular-nums mt-0.5">
            {data.payrollSummary?.activePaidEmployees ?? 0} /{" "}
            {data.payrollSummary?.totalEmployees ?? data.users.length}
          </div>
        </div>
        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-3">
          <div className="text-[11px] text-[#667085]">
            Scheduled Monthly Payroll
          </div>
          <div className="text-lg font-medium text-[#202938] tabular-nums mt-0.5">
            {formatCurrency(data.payrollSummary?.totalMonthlyPayroll ?? 0, cur)}
          </div>
        </div>
        <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] text-[#667085]">Payroll Disbursement</div>
            <div className="text-xs font-medium text-[#202938] mt-0.5">
              Human Approval + PayPal Sandbox
            </div>
          </div>
          <Link
            href="/payments"
            className="inline-flex items-center gap-1 rounded border border-[#E5E7EB] px-2.5 py-1.5 text-[11px] font-medium text-[#315B7D] hover:bg-[#F7F8FA]"
          >
            <Wallet className="h-3.5 w-3.5" />
            Run Payroll
          </Link>
        </div>
      </div>

      {editingEmployee && (
        <form
          onSubmit={handleUpdatePayroll}
          className="rounded-md border border-[#315B7D]/40 bg-[#FFFFFF] p-4 space-y-3 text-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-[#202938]">
              Edit Compensation &amp; Pay Schedule — {editingEmployee.name}
            </span>
            <span className="text-[11px] text-[#667085]">
              {ROLE_LABELS[editingEmployee.role] ?? editingEmployee.role}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Job Title
              </label>
              <input
                value={editPayrollForm.title}
                onChange={(e) =>
                  setEditPayrollForm((p) => ({ ...p, title: e.target.value }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Department
              </label>
              <select
                value={editPayrollForm.departmentId}
                onChange={(e) =>
                  setEditPayrollForm((p) => ({
                    ...p,
                    departmentId: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2.5 py-1.5"
              >
                <option value="">Executive / Cross-Functional</option>
                {data.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Employment Type
              </label>
              <select
                value={editPayrollForm.employmentType}
                onChange={(e) =>
                  setEditPayrollForm((p) => ({
                    ...p,
                    employmentType: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2.5 py-1.5"
              >
                <option value="FULL_TIME">Full-Time Salaried</option>
                <option value="PART_TIME">Part-Time</option>
                <option value="CONTRACTOR">Contractor / Retainer</option>
                <option value="EXECUTIVE">Executive / Officer</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Monthly Salary ({cur})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editPayrollForm.monthlySalary}
                onChange={(e) =>
                  setEditPayrollForm((p) => ({
                    ...p,
                    monthlySalary: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Pay Cycle &amp; Day (1-28)
              </label>
              <div className="flex gap-2">
                <select
                  value={editPayrollForm.payCycle}
                  onChange={(e) =>
                    setEditPayrollForm((p) => ({
                      ...p,
                      payCycle: e.target.value,
                    }))
                  }
                  className="flex-1 rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2 py-1.5"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="BIWEEKLY">Biweekly</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={editPayrollForm.payDayOfMonth}
                  onChange={(e) =>
                    setEditPayrollForm((p) => ({
                      ...p,
                      payDayOfMonth: e.target.value,
                    }))
                  }
                  className="w-16 rounded border border-[#E5E7EB] px-2 py-1.5 tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Next Pay Date
              </label>
              <input
                type="date"
                value={editPayrollForm.nextPayDate}
                onChange={(e) =>
                  setEditPayrollForm((p) => ({
                    ...p,
                    nextPayDate: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                PayPal / Payout Email
              </label>
              <input
                type="email"
                value={editPayrollForm.payoutEmail}
                onChange={(e) =>
                  setEditPayrollForm((p) => ({
                    ...p,
                    payoutEmail: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Bank / Ledger Ref
              </label>
              <input
                value={editPayrollForm.bankAccountRef}
                onChange={(e) =>
                  setEditPayrollForm((p) => ({
                    ...p,
                    bankAccountRef: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#667085] mb-1">
                Payroll Status
              </label>
              <select
                value={editPayrollForm.payrollStatus}
                onChange={(e) =>
                  setEditPayrollForm((p) => ({
                    ...p,
                    payrollStatus: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2.5 py-1.5"
              >
                <option value="ACTIVE">Active Payroll</option>
                <option value="PAUSED">Paused</option>
                <option value="UNSCHEDULED">Unscheduled</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingEmployee(null)}
              className="rounded border border-[#E5E7EB] px-3 py-1.5 text-[#667085]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-[#315B7D] px-3.5 py-1.5 font-medium text-white"
            >
              Update Payroll Schedule
            </button>
          </div>
        </form>
      )}

      {/* Employee Directory, Payroll & Roles */}
      <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] overflow-x-auto">
        <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
          <span className="text-sm font-medium text-[#202938]">
            Employee Payroll &amp; Role Directory ({USER_ROLES.length} Supported Roles)
          </span>
          <span className="rounded bg-[#D69E36]/15 px-2 py-0.5 text-[10px] font-medium text-[#A16207]">
            DEMO-ONLY ACCOUNT SWITCHING
          </span>
        </div>
        <table className="w-full text-xs text-left">
          <thead className="bg-[#F7F8FA] border-b border-[#E5E7EB] text-[#667085]">
            <tr>
              <th className="px-4 py-2 font-medium">Employee</th>
              <th className="px-4 py-2 font-medium">Department &amp; Role</th>
              <th className="px-4 py-2 font-medium">Salary &amp; Type</th>
              <th className="px-4 py-2 font-medium">Pay Schedule</th>
              <th className="px-4 py-2 font-medium">Payout Email</th>
              <th className="px-4 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {data.users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2">
                  <div className="font-medium text-[#202938]">{u.name}</div>
                  <div className="text-[11px] text-[#667085]">{u.title}</div>
                </td>
                <td className="px-4 py-2 space-y-1">
                  <div className="text-[#667085]">
                    {u.department?.name ?? "Executive"}
                  </div>
                  <StatusBadge label={ROLE_LABELS[u.role] ?? u.role} />
                </td>
                <td className="px-4 py-2 tabular-nums">
                  {u.monthlySalary > 0 ? (
                    <div>
                      <div className="font-medium text-[#202938]">
                        {formatCurrency(u.monthlySalary, cur)}/mo
                      </div>
                      <div className="text-[11px] text-[#667085]">
                        {u.employmentType.replace("_", " ")} ·{" "}
                        {u.payrollStatus}
                      </div>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[#667085]">
                      {u.employmentType.replace("_", " ")} (No salary set)
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-[#667085] tabular-nums">
                  <div>
                    {u.payCycle} · Day {u.payDayOfMonth}
                  </div>
                  <div className="text-[11px]">
                    {u.nextPayDate
                      ? `Next: ${formatDateShort(u.nextPayDate)}`
                      : "Unscheduled"}
                  </div>
                </td>
                <td className="px-4 py-2 text-[11px] text-[#667085]">
                  <div>{u.payoutEmail || u.email}</div>
                  {u.bankAccountRef && (
                    <div className="text-[#202938]">{u.bankAccountRef}</div>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                    <button
                      onClick={() => startEditPayroll(u)}
                      className="rounded border border-[#E5E7EB] px-2 py-1 text-[11px] text-[#202938] hover:bg-[#F7F8FA]"
                    >
                      Edit Pay
                    </button>
                    {u.monthlySalary > 0 && (
                      <Link
                        href={`/payments?employeeId=${encodeURIComponent(u.id)}`}
                        className="rounded border border-[#315B7D]/30 px-2 py-1 text-[11px] font-medium text-[#315B7D] hover:bg-[#315B7D]/5"
                      >
                        Schedule Pay →
                      </Link>
                    )}
                    {u.id === data.currentUser.id ? (
                      <span className="text-[11px] font-medium text-[#16A34A] px-1">
                        Active
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          void switchWorkspaceOrUser({ userId: u.id })
                        }
                        className="rounded border border-[#E5E7EB] px-2 py-1 text-[11px] font-medium text-[#315B7D] hover:bg-[#F7F8FA]"
                      >
                        Switch Role
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Audit Logs */}
      <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] overflow-x-auto">
        <div className="px-4 py-3 border-b border-[#E5E7EB] text-sm font-medium text-[#202938]">
          Backend Security &amp; Governance Audit Log
        </div>
        {!data.canViewAudit ? (
          <div className="p-6 text-xs text-[#667085]">
            Audit logs are restricted to Auditor, Administrator, CEO, CFO, Board Member, and Finance Manager roles.
          </div>
        ) : (
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F7F8FA] border-b border-[#E5E7EB] text-[#667085]">
              <tr>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Actor</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Target</th>
                <th className="px-4 py-2 font-medium">Authorization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {data.auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-2 text-[#667085]">
                    {formatDateShort(log.createdAt)}
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-medium">{log.actorName}</span>{" "}
                    <span className="text-[#667085]">({log.actorRole})</span>
                  </td>
                  <td className="px-4 py-2 font-medium">{log.action}</td>
                  <td className="px-4 py-2 text-[#667085]">
                    {log.entityType}
                  </td>
                  <td className="px-4 py-2">
                    {log.authorized ? (
                      <StatusBadge label="AUTHORIZED" tone="green" />
                    ) : (
                      <div className="space-y-0.5">
                        <StatusBadge label="DENIED" tone="red" />
                        {log.denialReason && (
                          <div className="text-[11px] text-[#DC5252]">
                            {log.denialReason}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

