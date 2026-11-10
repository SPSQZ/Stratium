"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { CALENDAR_STATUSES, formatCurrency, formatDateShort } from "@/lib/types";

interface CalendarEventItem {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  amount: number;
  direction: string;
  category: string;
  status: string;
  sourceLabel: string;
  department: { name: string } | null;
  budget: { name: string } | null;
  invoice: { invoiceNumber: string; status: string } | null;
  paymentRequest: { title: string; status: string } | null;
  decision: { title: string; approvalStatus: string } | null;
}

const DOT_COLOR: Record<string, string> = {
  PAID: "bg-[#16A34A]",
  APPROVED: "bg-[#3B82F6]",
  CONTRACTED: "bg-[#315B7D]",
  DUE: "bg-[#D69E36]",
  PROPOSED: "bg-[#D69E36]",
  FORECASTED: "bg-[#667085]",
  FAILED: "bg-[#DC5252]",
  CANCELLED: "bg-[#DC5252]",
};

export default function FinancialCalendarPage() {
  const { data: sessionData, revision } = useSession();
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [departments, setDepartments] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);
  const [referenceAnchor, setReferenceAnchor] = useState<Date | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(
    null
  );
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showAdd, setShowAdd] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    eventDate: "",
    amount: "",
    direction: "OUTGOING" as "INCOMING" | "OUTGOING" | "ALLOCATION",
    category: "Planned Spend",
    status: "PROPOSED",
    departmentId: "",
  });

  const loadEvents = useCallback(async () => {
    const qs =
      statusFilter !== "ALL"
        ? `?status=${encodeURIComponent(statusFilter)}`
        : "";
    const res = await fetch(`/api/calendar${qs}`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      setEvents(json.events ?? []);
      setDepartments(json.departments ?? []);
    }
  }, [statusFilter]);

  useEffect(() => {
    let active = true;
    async function init() {
      const qs =
        statusFilter !== "ALL"
          ? `?status=${encodeURIComponent(statusFilter)}`
          : "";
      const res = await fetch(`/api/calendar${qs}`, { cache: "no-store" });
      if (!active) return;

      let anchor = new Date();
      if (res.ok) {
        const json = await res.json();
        if (json.referenceDate) {
          anchor = new Date(json.referenceDate);
        }
        setEvents(json.events ?? []);
        setDepartments(json.departments ?? []);
      }

      const anchorKey = `${anchor.getFullYear()}-${String(
        anchor.getMonth() + 1
      ).padStart(2, "0")}-${String(anchor.getDate()).padStart(2, "0")}`;

      setReferenceAnchor(anchor);
      setCurrentMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
      setSelectedDayKey(anchorKey);
      setNewEvent((prev) => ({ ...prev, eventDate: anchorKey }));
    }
    void init();
    return () => {
      active = false;
    };
  }, [statusFilter, revision]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const ev of events) {
      const d = new Date(ev.eventDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const daysGrid = useMemo(() => {
    if (!currentMonth) return [];
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; key: string | null }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null, key: null });
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      cells.push({ day, key });
    }
    return cells;
  }, [currentMonth]);

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newEvent,
        amount: Number(newEvent.amount),
        departmentId: newEvent.departmentId || null,
      }),
    });
    if (res.ok) {
      setShowAdd(false);
      setNewEvent({
        title: "",
        eventDate: new Date().toISOString().slice(0, 10),
        amount: "",
        direction: "OUTGOING",
        category: "Planned Spend",
        status: "PROPOSED",
        departmentId: "",
      });
      await loadEvents();
    }
  }

  const cur = sessionData?.session.company.currency ?? "USD";
  const selectedDayEvents = eventsByDay.get(selectedDayKey) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-[#202938]">
            Financial Calendar
          </h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Live timeline of completed settlements, due payables, approved payments, board-decision tranches, and AI expenditure projections.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded border border-[#E5E7EB] bg-[#FFFFFF] px-2.5 text-xs"
          >
            <option value="ALL">All Statuses</option>
            {CALENDAR_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowAdd((s) => !s)}
            className="inline-flex h-8 items-center gap-1 rounded bg-[#315B7D] px-3 text-xs font-medium text-white hover:bg-[#274A66]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Planned Item
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded border border-[#E5E7EB] bg-[#FFFFFF] px-3.5 py-2 text-[11px] text-[#667085]">
        {[
          { label: "Paid", dot: "bg-[#16A34A]" },
          { label: "Approved / Contracted", dot: "bg-[#3B82F6]" },
          { label: "Due / Proposed", dot: "bg-[#D69E36]" },
          { label: "Forecasted", dot: "bg-[#667085]" },
          { label: "Failed / Cancelled", dot: "bg-[#DC5252]" },
        ].map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${item.dot}`} />
            {item.label}
          </span>
        ))}
      </div>

      {showAdd && (
        <form
          onSubmit={handleAddEvent}
          className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 grid grid-cols-1 md:grid-cols-6 gap-2.5 text-xs"
        >
          <input
            required
            placeholder="Commitment Title *"
            value={newEvent.title}
            onChange={(e) =>
              setNewEvent((p) => ({ ...p, title: e.target.value }))
            }
            className="md:col-span-2 rounded border border-[#E5E7EB] px-2.5 py-1.5"
          />
          <input
            required
            type="date"
            value={newEvent.eventDate}
            onChange={(e) =>
              setNewEvent((p) => ({ ...p, eventDate: e.target.value }))
            }
            className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
          />
          <input
            required
            type="number"
            placeholder="Amount *"
            value={newEvent.amount}
            onChange={(e) =>
              setNewEvent((p) => ({ ...p, amount: e.target.value }))
            }
            className="rounded border border-[#E5E7EB] px-2.5 py-1.5 tabular-nums"
          />
          <select
            value={newEvent.status}
            onChange={(e) =>
              setNewEvent((p) => ({ ...p, status: e.target.value }))
            }
            className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
          >
            <option value="PROPOSED">Proposed</option>
            <option value="FORECASTED">Forecasted</option>
          </select>
          <select
            value={newEvent.departmentId}
            onChange={(e) =>
              setNewEvent((p) => ({ ...p, departmentId: e.target.value }))
            }
            className="rounded border border-[#E5E7EB] px-2.5 py-1.5"
          >
            <option value="">Company-Wide</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <div className="md:col-span-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded border border-[#E5E7EB] px-3 py-1 text-[#667085]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-[#315B7D] px-3 py-1 font-medium text-white"
            >
              Save Event
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Monthly Calendar Grid (8 cols) */}
        <div className="xl:col-span-8 rounded-md border border-[#E5E7EB] bg-[#FFFFFF] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
            <h2 className="text-sm font-medium text-[#202938]">
              {currentMonth
                ? currentMonth.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })
                : "Loading calendar..."}
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  currentMonth &&
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() - 1,
                      1
                    )
                  )
                }
                className="rounded border border-[#E5E7EB] p-1 hover:bg-[#F7F8FA]"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  const base = referenceAnchor ?? new Date();
                  setCurrentMonth(new Date(base.getFullYear(), base.getMonth(), 1));
                }}
                className="rounded border border-[#E5E7EB] px-2.5 py-1 text-xs font-medium hover:bg-[#F7F8FA]"
              >
                {sessionData?.session.company.isHistoricalDemo
                  ? "Sim Cycle"
                  : "Today"}
              </button>
              <button
                onClick={() =>
                  currentMonth &&
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() + 1,
                      1
                    )
                  )
                }
                className="rounded border border-[#E5E7EB] p-1 hover:bg-[#F7F8FA]"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-[#E5E7EB] bg-[#F7F8FA] text-center text-[11px] font-medium text-[#667085]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {daysGrid.map((cell, idx) => {
              if (!cell.day || !cell.key) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-24 border-b border-r border-[#E5E7EB] bg-[#F7F8FA]/50"
                  />
                );
              }
              const dayEvents = eventsByDay.get(cell.key) ?? [];
              const isSelected = selectedDayKey === cell.key;
              return (
                <div
                  key={cell.key}
                  onClick={() => {
                    setSelectedDayKey(cell.key!);
                    if (dayEvents.length > 0) setSelectedEvent(dayEvents[0]);
                  }}
                  className={`min-h-24 border-b border-r border-[#E5E7EB] p-1.5 cursor-pointer transition-colors ${
                    isSelected ? "bg-[#315B7D]/5 ring-1 ring-inset ring-[#315B7D]" : "hover:bg-[#F7F8FA]"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span
                      className={`font-medium tabular-nums ${
                        isSelected ? "text-[#315B7D]" : "text-[#202938]"
                      }`}
                    >
                      {cell.day}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] text-[#667085] tabular-nums">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDayKey(cell.key!);
                          setSelectedEvent(ev);
                        }}
                        className="w-full text-left flex items-center gap-1 rounded bg-[#F7F8FA] border border-[#E5E7EB] px-1 py-0.5 text-[10px] truncate hover:border-[#315B7D]"
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                            DOT_COLOR[ev.status] ?? "bg-[#667085]"
                          }`}
                        />
                        <span className="truncate font-medium text-[#202938]">
                          {ev.title}
                        </span>
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-[#667085] pl-1">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Contextual Panel: Day Records & Event Details */}
        <div className="xl:col-span-4 space-y-4">
          <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-[#667085]">
              Records on {selectedDayKey}
            </div>
            {selectedDayEvents.length === 0 ? (
              <div className="py-4 text-xs text-[#667085]">
                No financial events recorded on this date. Select a highlighted date to inspect records.
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => setSelectedEvent(ev)}
                    className={`w-full text-left rounded border p-2.5 text-xs ${
                      selectedEvent?.id === ev.id
                        ? "border-[#315B7D] bg-[#315B7D]/5"
                        : "border-[#E5E7EB] hover:bg-[#F7F8FA]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-[#202938]">
                        {ev.title}
                      </span>
                      <span className="font-medium tabular-nums shrink-0">
                        {ev.direction === "INCOMING" ? "+" : "-"}
                        {formatCurrency(ev.amount, cur)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[11px] text-[#667085]">
                        {ev.category}
                      </span>
                      <StatusBadge label={ev.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedEvent && (
            <div className="rounded-md border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-2.5 text-xs">
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#E5E7EB]">
                <div>
                  <div className="text-sm font-medium text-[#202938]">
                    {selectedEvent.title}
                  </div>
                  <div className="text-[11px] text-[#667085]">
                    {formatDateShort(selectedEvent.eventDate)}
                  </div>
                </div>
                <StatusBadge label={selectedEvent.status} />
              </div>
              <p className="text-[#202938]">{selectedEvent.description}</p>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between">
                  <span className="text-[#667085]">Amount</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(selectedEvent.amount, cur)} (
                    {selectedEvent.direction})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Category</span>
                  <span>{selectedEvent.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Department</span>
                  <span>{selectedEvent.department?.name ?? "Company-Wide"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Origin Source</span>
                  <span>{selectedEvent.sourceLabel}</span>
                </div>
                {selectedEvent.budget && (
                  <div className="flex justify-between">
                    <span className="text-[#667085]">Budget</span>
                    <span>{selectedEvent.budget.name}</span>
                  </div>
                )}
                {selectedEvent.invoice && (
                  <div className="flex justify-between">
                    <span className="text-[#667085]">Invoice</span>
                    <span>
                      {selectedEvent.invoice.invoiceNumber} (
                      {selectedEvent.invoice.status})
                    </span>
                  </div>
                )}
                {selectedEvent.decision && (
                  <div className="flex justify-between">
                    <span className="text-[#667085]">Board Decision</span>
                    <span>{selectedEvent.decision.title}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

