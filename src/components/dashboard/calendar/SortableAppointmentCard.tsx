"use client";

import { useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { fmtLondon } from "@/lib/london";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/components/dashboard/types";

interface SortableAppointmentCardProps {
  appointment: Appointment;
  top?: number;
  height?: number;
  onClick: (appointment: Appointment) => void;
  selected: boolean;
  onSelectionChange: (selected: boolean) => void;
  /**
   * "absolute" (default) — positioned overlay block with proportional height
   * (Day view). "stacked" — in-flow compact row that never overflows its
   * hour cell, so back-to-back appointments can't cover each other
   * (Week view).
   */
  layout?: "absolute" | "stacked";
  /**
   * Day-view overlap columns: when two appointments share an hour they sit
   * side-by-side instead of painting over each other.
   */
  side?: { left: string; width: string };
}

const STATUS_STYLES: Record<Appointment["status"], { card: string; bar: string; dot: string }> = {
  confirmed: { card: "bg-emerald-500/10 text-emerald-50 border-emerald-500/30", bar: "bg-emerald-400", dot: "bg-emerald-400" },
  completed: { card: "bg-sky-500/10 text-sky-50 border-sky-500/30", bar: "bg-sky-400", dot: "bg-sky-400" },
  cancelled: { card: "bg-slate-500/10 text-slate-400 border-slate-500/30 border-dashed", bar: "bg-slate-500", dot: "bg-slate-500" },
  no_show: { card: "bg-red-500/10 text-red-50 border-red-500/30", bar: "bg-red-400", dot: "bg-red-400" },
};

export function SortableAppointmentCard({
  appointment,
  top = 0,
  height,
  onClick,
  selected,
  onSelectionChange,
  layout = "absolute",
  side,
}: SortableAppointmentCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: appointment.id });

  const stacked = layout === "stacked";
  const style: React.CSSProperties = stacked
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.8 : 1,
        zIndex: isDragging ? 100 : 10,
      }
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        top: `${top}px`,
        height: `${height ?? 64}px`,
        ...(side ? { left: side.left, width: side.width } : {}),
        opacity: isDragging ? 0.8 : 1,
        zIndex: isDragging ? 100 : 10,
      };

  // Display the STORED instants in London time. Never pre-shift with
  // toZonedTime here: formatInTimeZone already interprets instants, so a
  // shifted input double-shifts and shows wrong hours abroad.
  const timeRange = `${fmtLondon(appointment.startsAt, "HH:mm")}–${fmtLondon(appointment.endsAt, "HH:mm")}`;
  const isCancelled = appointment.status === "cancelled";
  // Absolute blocks shorter than ~1hr collapse to one line; stacked rows
  // always show both lines (they have a fixed compact height, never overlap).
  const compact = stacked ? false : (height ?? 64) < 56;
  const styles = STATUS_STYLES[appointment.status];

  // Suppress click-to-edit when the pointer actually dragged (dnd-kit
  // listeners live on the whole card, so a drop would otherwise also fire
  // onClick and reopen the edit modal right after a move).
  const downPos = useRef<{ x: number; y: number } | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.target instanceof HTMLButtonElement) return;
    if ((e.target as HTMLElement).closest("input,button")) return;
    if (isDragging) return;
    if (downPos.current) {
      const dx = e.clientX - downPos.current.x;
      const dy = e.clientY - downPos.current.y;
      if (Math.hypot(dx, dy) > 5) return;
    }
    onClick(appointment);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelectionChange(e.target.checked);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        stacked ? "relative" : "absolute",
        !stacked && !side && "left-1 right-1",
        "flex gap-1.5 overflow-hidden rounded-lg border p-1.5 cursor-pointer transition-shadow",
        "hover:shadow-lg hover:brightness-125",
        styles.card,
        isCancelled && "opacity-60",
        selected && "ring-2 ring-accent-400",
        isDragging && "shadow-xl rotate-1 scale-[1.02]"
      )}
      onClick={handleClick}
      onPointerDown={(e) => {
        downPos.current = { x: e.clientX, y: e.clientY };
      }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(appointment);
        }
      }}
      aria-pressed={selected}
      aria-label={`${appointment.patientName}, ${appointment.service.name}, ${timeRange}, ${appointment.status}`}
      title={`${appointment.patientName} — ${appointment.service.name} — ${timeRange} — ${appointment.provider?.name || "Unknown"} (${appointment.status})`}
      data-draggable={appointment.status === "confirmed"}
    >
      <span className={cn("w-1 flex-shrink-0 self-stretch rounded-full", styles.bar)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
            className="h-3.5 w-3.5 flex-shrink-0 rounded border-slate-500 text-accent-500 focus:ring-accent-500"
            aria-label={`Select appointment for ${appointment.patientName}`}
          />
          <p className="min-w-0 flex-1 truncate text-xs font-semibold leading-tight">{appointment.patientName}</p>
          <span className="flex-shrink-0 text-[10px] font-medium tabular-nums text-slate-400">{timeRange}</span>
        </div>
        {!compact && (
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", styles.dot)} aria-hidden="true" />
            <p className="min-w-0 flex-1 truncate text-[11px] leading-tight text-slate-400">
              {appointment.service.name}
              {appointment.provider?.name ? ` · ${appointment.provider.name}` : ""}
            </p>
          </div>
        )}
      </div>

      {isDragging && (
        <div
          className="absolute -top-2 -right-2 flex items-center justify-center w-6 h-6 bg-accent-600 rounded-full text-slate-950"
          aria-hidden="true"
        >
          <GripVertical className="h-3 w-3" />
        </div>
      )}
    </div>
  );
}