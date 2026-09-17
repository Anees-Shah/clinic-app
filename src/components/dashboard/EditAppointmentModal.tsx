"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/components/dashboard/types";

const editSchema = z.object({
  status: z.enum(["confirmed", "completed", "cancelled", "no_show"]),
  notes: z.string().optional(),
  tags: z.string().optional(),
  lateCancelFee: z.boolean(),
  noShowFee: z.boolean(),
  lateCancelFeeOverride: z.boolean(),
  noShowFeeOverride: z.boolean(),
});

type EditFormData = z.infer<typeof editSchema>;

interface EditAppointmentModalProps {
  appointment: Appointment;
  onClose: () => void;
  onSave: () => void;
}

const STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No Show" },
];

export function EditAppointmentModal({ appointment, onClose, onSave }: EditAppointmentModalProps) {
  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      status: appointment.status,
      notes: appointment.notes || "",
      tags: "",
      lateCancelFee: appointment.lateCancelFee,
      noShowFee: appointment.noShowFee,
      lateCancelFeeOverride: false,
      noShowFeeOverride: false,
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ---- Admin reschedule state ----
  const toDateInput = (iso: string) => {
    // Europe/London date as YYYY-MM-DD for <input type="date">
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
    return parts; // already YYYY-MM-DD
  };
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(() => toDateInput(appointment.startsAt));
  const [slots, setSlots] = useState<{ start: string; end: string; available: boolean }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlotIso, setSelectedSlotIso] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveSuccess, setMoveSuccess] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const loadAdminSlots = async (dateStr: string) => {
    setLoadingSlots(true);
    setMoveError(null);
    setMoveSuccess(null);
    setSelectedSlotIso(null);
    try {
      const res = await fetch(
        `/api/dashboard/appointments/${appointment.id}/slots?date=${encodeURIComponent(dateStr)}`
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to load slots");
      setSlots(Array.isArray(body.slots) ? body.slots : []);
    } catch (e) {
      console.error("Failed to load admin slots:", e);
      setSlots([]);
      setMoveError(e instanceof Error ? e.message : "Failed to load slots");
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (showReschedule && rescheduleDate) loadAdminSlots(rescheduleDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReschedule, rescheduleDate]);

  const handleMove = async () => {
    if (!selectedSlotIso) return;
    setIsMoving(true);
    setMoveError(null);
    setMoveSuccess(null);
    try {
      const res = await fetch("/api/dashboard/appointments/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: appointment.id, newStartAt: selectedSlotIso }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || body.message || "Failed to move appointment");
      const when = new Date(selectedSlotIso).toLocaleString("en-GB", {
        timeZone: "Europe/London",
        dateStyle: "medium",
        timeStyle: "short",
      });
      setMoveSuccess(`Moved to ${when}.`);
      onSave(); // refresh calendar behind the modal
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : "Failed to move appointment");
    } finally {
      setIsMoving(false);
    }
  };

  useEffect(() => {
    form.reset({
      status: appointment.status,
      notes: appointment.notes || "",
      tags: "",
      lateCancelFee: appointment.lateCancelFee,
      noShowFee: appointment.noShowFee,
      lateCancelFeeOverride: false,
      noShowFeeOverride: false,
    });
  }, [appointment, form]);

  const onSubmit = async (data: EditFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(`/api/dashboard/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: data.status,
          notes: data.notes,
          // tags is UI-only (no DB column) — API strips it, safe to send
          tags: data.tags,
          lateCancelFee: data.lateCancelFeeOverride ? data.lateCancelFee : appointment.lateCancelFee,
          noShowFee: data.noShowFeeOverride ? data.noShowFee : appointment.noShowFee,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const msg =
          (typeof errorBody?.message === "string" && errorBody.message) ||
          (typeof errorBody?.error === "string" && errorBody.error) ||
          "Failed to update appointment";
        throw new Error(msg);
      }

      onSave();
      onClose();
    } catch (error) {
      console.error("Failed to update appointment:", error);
      setSubmitError(error instanceof Error ? error.message : "Failed to update appointment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // Controlled dialog: parent mounts us only when an appointment is
    // selected, so keep `open` true and map close -> onClose. (Previously
    // <Dialog.Root> had no `open` prop and no Trigger, so the modal never
    // appeared on card click.)
    <Dialog.Root
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-slate-900 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-slate-800 data-[state=open]:text-slate-100">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Dialog.Close>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
            <div>
              <Dialog.Title className="text-lg font-semibold">Edit Appointment</Dialog.Title>
              <Dialog.Description className="text-sm text-slate-400 mt-1">
                {appointment.patientName} - {appointment.service.name}
              </Dialog.Description>
            </div>

            {submitError && (
              <div className="p-3 text-sm text-red-200 bg-red-950/60 border border-red-800 rounded-md" role="alert">
                {submitError}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div>
                  <label htmlFor="status" className="label">Status</label>
                  <select
                    id="status"
                    {...form.register("status")}
                    className="input bg-slate-800 border-slate-700"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Date & Time</label>
                  <input
                    type="text"
                    readOnly
                    className="input bg-slate-800/50 border-slate-700"
                    value={`${new Date(appointment.startsAt).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "short", timeStyle: "short" })} - ${new Date(appointment.endsAt).toLocaleString("en-GB", { timeZone: "Europe/London", timeStyle: "short" })}`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="label">Notes</label>
                <textarea
                  id="notes"
                  {...form.register("notes")}
                  rows={3}
                  className="input bg-slate-800 border-slate-700 resize-none"
                  placeholder="Internal notes..."
                />
              </div>

              <div>
                <label htmlFor="tags" className="label">Tags (comma-separated)</label>
                <input
                  id="tags"
                  {...form.register("tags")}
                  className="input bg-slate-800 border-slate-700"
                  placeholder="vip, follow-up, referral"
                />
              </div>

              <div className="border-t border-slate-800 pt-4">
                <h4 className="font-medium mb-3">Fee Flags</h4>
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-medium">Late Cancellation Fee</p>
                      <p className="text-sm text-slate-400">Applied when cancelled within 48 business hours</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={appointment.lateCancelFee}
                          disabled={!form.watch("lateCancelFeeOverride")}
                          className="h-4 w-4 rounded border-slate-600 text-accent-600 focus:ring-accent-500 disabled:opacity-50"
                        />
                        <span className="text-sm">{appointment.lateCancelFee ? "Applied" : "Not applied"}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          {...form.register("lateCancelFeeOverride")}
                          className="h-4 w-4 rounded border-slate-600 text-accent-600 focus:ring-accent-500"
                        />
                        Override
                      </label>
                    </div>
                  </div>

                  {form.watch("lateCancelFeeOverride") && (
                    <div className="ml-10 flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          {...form.register("lateCancelFee")}
                          className="h-4 w-4 rounded border-slate-600 text-accent-600 focus:ring-accent-500"
                        />
                        Apply late cancellation fee
                      </label>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-medium">No-Show Fee</p>
                      <p className="text-sm text-slate-400">Applied when patient does not attend</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={appointment.noShowFee}
                          disabled={!form.watch("noShowFeeOverride")}
                          className="h-4 w-4 rounded border-slate-600 text-accent-600 focus:ring-accent-500 disabled:opacity-50"
                        />
                        <span className="text-sm">{appointment.noShowFee ? "Applied" : "Not applied"}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          {...form.register("noShowFeeOverride")}
                          className="h-4 w-4 rounded border-slate-600 text-accent-600 focus:ring-accent-500"
                        />
                        Override
                      </label>
                    </div>
                  </div>

                  {form.watch("noShowFeeOverride") && (
                    <div className="ml-10 flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          {...form.register("noShowFee")}
                          className="h-4 w-4 rounded border-slate-600 text-accent-600 focus:ring-accent-500"
                        />
                        Apply no-show fee
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setShowReschedule((v) => !v)}
                className="btn btn-primary w-full"
                aria-expanded={showReschedule}
              >
                {showReschedule ? "Hide dates" : "Re-schedule show dates"}
              </button>

              {showReschedule && (
                <div className="mt-3 space-y-3">
                  {appointment.status !== "confirmed" ? (
                    <p className="text-sm text-slate-400">
                      Only confirmed appointments can be moved. Change status back to Confirmed first.
                    </p>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="reschedule-date" className="label">New date</label>
                        <input
                          id="reschedule-date"
                          type="date"
                          value={rescheduleDate}
                          onChange={(e) => setRescheduleDate(e.target.value)}
                          className="input bg-slate-800 border-slate-700"
                        />
                      </div>

                      {loadingSlots ? (
                        <p className="text-sm text-slate-400">Loading vacant slots…</p>
                      ) : slots.length === 0 ? (
                        <p className="text-sm text-slate-400">
                          {moveError || "No slots for this date — pick another day."}
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto" role="listbox" aria-label="Vacant slots">
                          {slots.map((s) => {
                            const selected = selectedSlotIso === s.start;
                            return (
                              <button
                                key={s.start}
                                type="button"
                                disabled={!s.available}
                                onClick={() => setSelectedSlotIso(s.start)}
                                className={
                                  s.available
                                    ? selected
                                      ? "btn btn-primary px-2 py-2 text-sm"
                                      : "px-2 py-2 text-sm rounded-md border border-slate-700 text-slate-200 hover:border-accent-500"
                                    : "px-2 py-2 text-sm rounded-md border border-slate-800 text-slate-600 cursor-not-allowed"
                                }
                                aria-pressed={selected}
                              >
                                {new Date(s.start).toLocaleTimeString("en-GB", {
                                  timeZone: "Europe/London",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {!s.available && " • busy"}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {moveError && (
                        <div className="p-3 text-sm text-red-200 bg-red-950/60 border border-red-800 rounded-md" role="alert">
                          {moveError}
                        </div>
                      )}
                      {moveSuccess && (
                        <div className="p-3 text-sm text-green-200 bg-green-950/60 border border-green-800 rounded-md" role="status">
                          {moveSuccess} Calendar refreshed behind this window.
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleMove}
                        disabled={!selectedSlotIso || isMoving}
                        className="btn btn-primary w-full"
                      >
                        {isMoving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Move to selected slot"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-slate-800">
              {/* Both buttons use btn-primary (white text on green) — btn-outline
                  renders black-on-black inside the dark modal when OS is in
                  light mode because it relies on var(--foreground). */}
              <button type="button" onClick={onClose} className="btn btn-primary w-full sm:w-auto">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full sm:w-auto">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}