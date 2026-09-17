"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, eachDayOfInterval, eachHourOfInterval, isSameDay, isBefore, isAfter, parseISO, setHours, setMinutes } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, Calendar, Users, Filter, MoreHorizontal, Check, X, Edit, Trash2, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtLondon } from "@/lib/london";
import { DayView } from "@/components/dashboard/calendar/DayView";
import { WeekView } from "@/components/dashboard/calendar/WeekView";
import { MonthView } from "@/components/dashboard/calendar/MonthView";
import { EditAppointmentModal } from "@/components/dashboard/EditAppointmentModal";
import { ToastProvider, toast } from "@/components/dashboard/ui/Toast";
import type { Provider } from "@/lib/providers";
import type { Appointment } from "@/components/dashboard/types";

interface DashboardClientProps {
  providers: Provider[];
}

export function DashboardClient({ providers }: DashboardClientProps) {
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProviderId, setSelectedProviderId] = useState<string | "all">("all");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  // Bulk selection is keyed by per-appointment id (Set<string>), never by
  // date — selecting one card must only ever select that one appointment.
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);
  // Timestamp of the last drag end; clicks within ~300ms are treated as
  // drop-release clicks and must not open the edit modal.
  const lastDragEndAt = useRef<number>(0);

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("view", view);
      params.set("date", format(currentDate, "yyyy-MM-dd"));
      if (selectedProviderId !== "all") {
        params.set("providerId", selectedProviderId);
      }

      const response = await fetch(`/api/dashboard/appointments?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setAppointments(data.appointments);
      }
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
      toast.error("Failed to load appointments");
    } finally {
      setIsLoading(false);
    }
  }, [view, currentDate, selectedProviderId]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    eventSourceRef.current = new EventSource("/api/dashboard/stream");

    eventSourceRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "appointment_update") {
        fetchAppointments();
        toast.success("Schedule updated");
      }
    };

    eventSourceRef.current.onerror = () => {
      console.log("SSE connection error, will auto-reconnect");
    };

    return () => {
      eventSourceRef.current?.close();
    };
  }, [fetchAppointments]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    lastDragEndAt.current = Date.now();

    if (!over) return;

    const appointmentId = active.id as string;
    const overId = over.id as string;

    const appointment = appointments.find((a) => a.id === appointmentId);
    if (!appointment) return;

    // Drops onto another appointment card resolve `over` to that card's id,
    // not a time slot — ignore them (time slots are ISO datetime strings
    // from DayView/WeekView droppables). Previously every drop was treated
    // as a datetime, producing Invalid Date and the move never stuck.
    if (appointments.some((a) => a.id === overId)) return;

    const slotBase = new Date(overId);
    if (Number.isNaN(slotBase.getTime())) return;

    // Preserve the appointment's London minute offset within the hour so a
    // 10:30 card dropped on the 11:00 row lands at 11:30.
    const origMinutes = Number(fmtLondon(appointment.startsAt, "m"));
    const newStartDate = new Date(slotBase);
    newStartDate.setMinutes(origMinutes, 0, 0);
    const newStartAt = newStartDate.toISOString();

    // No-op when dropped back on its own slot
    if (new Date(appointment.startsAt).getTime() === newStartDate.getTime()) return;

    const optimisticAppointments = appointments.map((a) =>
      a.id === appointmentId ? { ...a, startsAt: newStartAt, endsAt: new Date(new Date(newStartAt).getTime() + a.service.durationMin * 60000).toISOString() } : a
    );
    setAppointments(optimisticAppointments);

    try {
      const response = await fetch("/api/dashboard/appointments/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, newStartAt }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || "Failed to move appointment");
        fetchAppointments();
      }
    } catch {
      toast.error("Failed to move appointment");
      fetchAppointments();
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const appointment = appointments.find((a) => a.id === event.active.id);
    if (appointment?.status !== "confirmed") {
      event.active.data.current = { ...event.active.data.current, draggable: false };
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const navigateDate = (direction: "prev" | "next") => {
    const amount = direction === "prev" ? -1 : 1;
    let newDate: Date;
    switch (view) {
      case "day":
        newDate = addDays(currentDate, amount);
        break;
      case "week":
        newDate = addWeeks(currentDate, amount);
        break;
      case "month":
        newDate = addMonths(currentDate, amount);
        break;
    }
    setCurrentDate(newDate);
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    // Ignore the synthetic click that fires on drop release.
    if (Date.now() - lastDragEndAt.current < 300) return;
    setEditingAppointment(appointment);
  };

  const handleSelectionChange = (appointmentId: string, selected: boolean) => {
    setSelectedAppointmentIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(appointmentId);
      else next.delete(appointmentId);
      return next;
    });
  };

  const handleBulkAction = async (action: "no_show" | "cancel") => {
    if (selectedAppointmentIds.size === 0) return;

    try {
      const response = await fetch("/api/dashboard/appointments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentIds: Array.from(selectedAppointmentIds),
          action,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || "Bulk action failed");
      } else {
        toast.success(`${selectedAppointmentIds.size} appointments updated`);
        setSelectedAppointmentIds(new Set());
        fetchAppointments();
      }
    } catch {
      toast.error("Bulk action failed");
    }
  };

  const exportCSV = () => {
    const filtered = appointments.filter((a) => selectedAppointmentIds.has(a.id));
    if (filtered.length === 0) return;

    const headers = ["Patient", "Email", "Phone", "Service", "Provider", "Date", "Time", "Duration", "Status", "Notes", "Late Cancel Fee", "No Show Fee"];
    const rows = filtered.map((a) => [
      a.patientName,
      a.patientEmail,
      a.patientPhone,
      a.service.name,
      a.provider.name,
      formatInTimeZone(a.startsAt, "Europe/London", "yyyy-MM-dd"),
      formatInTimeZone(a.startsAt, "Europe/London", "HH:mm"),
      `${a.service.durationMin}min`,
      a.status,
      a.notes || "",
      a.lateCancelFee ? "Yes" : "No",
      a.noShowFee ? "Yes" : "No",
    ]);

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `appointments-${format(currentDate, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredAppointments = selectedProviderId === "all"
    ? appointments
    : appointments.filter((a) => a.providerId === selectedProviderId);

  return (
    <div className="min-h-screen">
      <ToastProvider>
        <div className="container py-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
            <p className="text-slate-400 mt-1">Manage appointments across all providers</p>
          </div>

          <div className="card bg-slate-900 border-slate-800 p-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateDate("prev")}
                  className="btn btn-outline btn-sm p-2"
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="px-4 text-center min-w-[200px]">
                  <p className="font-medium">
                    {view === "day" && formatInTimeZone(currentDate, "Europe/London", "EEEE, MMMM d, yyyy")}
                    {view === "week" && `${formatInTimeZone(startOfWeek(currentDate, { weekStartsOn: 1 }), "Europe/London", "MMM d")} - ${formatInTimeZone(endOfWeek(currentDate, { weekStartsOn: 1 }), "Europe/London", "MMM d, yyyy")}`}
                    {view === "month" && formatInTimeZone(currentDate, "Europe/London", "MMMM yyyy")}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {view === "day" && formatInTimeZone(currentDate, "Europe/London", "ccc, MMM d")}
                    {view === "week" && `${formatInTimeZone(startOfWeek(currentDate, { weekStartsOn: 1 }), "Europe/London", "MMM d")} - ${formatInTimeZone(endOfWeek(currentDate, { weekStartsOn: 1 }), "Europe/London", "MMM d")}`}
                    {view === "month" && formatInTimeZone(currentDate, "Europe/London", "MMM yyyy")}
</p>
                </div>
                <button
                  onClick={() => navigateDate("next")}
                  className="btn btn-outline btn-sm p-2"
                  aria-label="Next"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  className="input bg-slate-800 border-slate-700 text-sm w-auto"
                  aria-label="Filter by provider"
                >
                  <option value="all">All Providers</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <div className="flex gap-1 bg-slate-800 rounded-md p-1" role="group" aria-label="Calendar view">
                  {(["day", "week", "month"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded transition-colors",
                        view === v
                          ? "bg-accent-600 text-slate-950"
                          : "text-slate-400 hover:text-slate-50"
                      )}
                      aria-pressed={view === v}
                    >
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>

                {selectedAppointmentIds.size > 0 && (
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-sm text-slate-400">{selectedAppointmentIds.size} selected</span>
                    <button onClick={() => handleBulkAction("no_show")} className="btn btn-outline btn-sm text-destructive border-destructive/50 hover:bg-destructive/10">
                      Mark No-Show
                    </button>
                    <button onClick={() => handleBulkAction("cancel")} className="btn btn-outline btn-sm text-warning border-warning/50 hover:bg-warning/10">
                      Cancel
                    </button>
                    <button onClick={exportCSV} className="btn btn-outline btn-sm">
                      <Download className="h-4 w-4 mr-1" /> Export CSV
                    </button>
                    <button onClick={() => setSelectedAppointmentIds(new Set())} className="btn btn-outline btn-sm">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="card bg-slate-900 border-slate-800 p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-accent-400 mx-auto mb-4" />
              <p className="text-slate-400">Loading appointments...</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              onDragStart={handleDragStart}
            >
              <SortableContext
                items={filteredAppointments.map((a) => a.id)}
                strategy={verticalListSortingStrategy}
              >
                {view === "day" && (
                  <DayView
                    date={currentDate}
                    appointments={filteredAppointments}
                    onAppointmentClick={handleAppointmentClick}
                    selectedAppointmentIds={selectedAppointmentIds}
                    onSelectionChange={handleSelectionChange}
                  />
                )}
                {view === "week" && (
                  <WeekView
                    date={currentDate}
                    appointments={filteredAppointments}
                    onAppointmentClick={handleAppointmentClick}
                    selectedAppointmentIds={selectedAppointmentIds}
                    onSelectionChange={handleSelectionChange}
                  />
                )}
                {view === "month" && (
                  <MonthView
                    date={currentDate}
                    appointments={filteredAppointments}
                    onAppointmentClick={handleAppointmentClick}
                    onDateClick={(date) => {
                      setView("day");
                      setCurrentDate(date);
                    }}
                  />
                )}
              </SortableContext>
            </DndContext>
          )}

          {editingAppointment && (
            <EditAppointmentModal
              appointment={editingAppointment}
              onClose={() => setEditingAppointment(null)}
              onSave={fetchAppointments}
            />
          )}
        </div>
      </ToastProvider>
    </div>
  );
}