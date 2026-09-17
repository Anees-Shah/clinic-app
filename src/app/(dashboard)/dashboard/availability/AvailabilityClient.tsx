"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

interface ProviderOption {
  id: string;
  name: string;
}

interface ScheduleItem {
  id: string;
  providerId: string;
  providerName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface OverrideItem {
  id: string;
  providerId: string;
  providerName: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isBlocked: boolean;
  revision: number;
}

interface AvailabilityClientProps {
  providers: ProviderOption[];
  initialSchedules: ScheduleItem[];
  initialOverrides: OverrideItem[];
}

// 0=Sunday per the Prisma seed convention
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Stored as ISO (2026-09-30T00:00:00.000Z) — show a friendly London date.
function formatOverrideDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function readError(body: unknown, fallback: string): string {  if (typeof body === "object" && body !== null) {
    const b = body as { error?: unknown; message?: unknown };
    if (typeof b.error === "string" && b.error) return b.error;
    if (typeof b.message === "string" && b.message) return b.message;
  }
  return fallback;
}

export function AvailabilityClient({
  providers,
  initialSchedules,
  initialOverrides,
}: AvailabilityClientProps) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>(initialSchedules);
  const [overrides, setOverrides] = useState<OverrideItem[]>(initialOverrides);
  const [selectedProvider, setSelectedProvider] = useState<string>(providers[0]?.id ?? "");
  const [isSaving, setIsSaving] = useState(false);

  // Add-block form
  const [day, setDay] = useState("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");

  // Override form
  const [ovDate, setOvDate] = useState("");
  const [fullDay, setFullDay] = useState(true);
  const [ovStart, setOvStart] = useState("09:00");
  const [ovEnd, setOvEnd] = useState("13:00");
  const [ovBlocked, setOvBlocked] = useState(true);

  const visibleSchedules = selectedProvider
    ? schedules.filter((s) => s.providerId === selectedProvider)
    : schedules;
  const visibleOverrides = selectedProvider
    ? overrides.filter((o) => o.providerId === selectedProvider)
    : overrides;
  const selectedName = providers.find((p) => p.id === selectedProvider)?.name ?? "";

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider) {
      alert("Choose a staff member first.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/dashboard/availability/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: selectedProvider,
          dayOfWeek: Number(day),
          startTime: start,
          endTime: end,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readError(body, "Failed to add time block"));
      setSchedules([...schedules, (body as { schedule: ScheduleItem }).schedule]);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to add time block");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBlock = async (id: string) => {
    if (!confirm("Remove this time block?")) return;
    try {
      const response = await fetch(`/api/dashboard/availability/schedules/${id}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readError(body, "Failed to delete"));
      setSchedules(schedules.filter((s) => s.id !== id));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete time block");
    }
  };

  const handleAddOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider) {
      alert("Choose a staff member first.");
      return;
    }
    if (!ovDate) {
      alert("Pick a date first.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/dashboard/availability/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: selectedProvider,
          date: ovDate,
          isBlocked: ovBlocked,
          startTime: fullDay ? null : ovStart,
          endTime: fullDay ? null : ovEnd,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readError(body, "Failed to add date override"));
      const created = (body as { override: Omit<OverrideItem, "providerName"> }).override;
      setOverrides(
        [...overrides, { ...created, providerName: selectedName }].sort((a, b) =>
          a.date.localeCompare(b.date)
        )
      );
      setOvDate("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to add date override");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteOverride = async (id: string) => {
    if (!confirm("Remove this date override?")) return;
    try {
      const response = await fetch(`/api/dashboard/availability/overrides/${id}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readError(body, "Failed to delete"));
      setOverrides(overrides.filter((o) => o.id !== id));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete date override");
    }
  };

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Availability</h1>
        <p className="text-slate-400 mt-1">
          Weekly working hours and one-off date changes per staff member
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <label htmlFor="avail-provider" className="label">Staff member</label>
        {providers.length === 0 ? (
          <p className="text-sm text-slate-500">
            No staff yet — add a doctor on the Staff tab first.
          </p>
        ) : (
          <select
            id="avail-provider"
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="input bg-slate-800 border-slate-700 w-full sm:w-auto"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Weekly hours */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 mb-6">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold">Weekly hours{selectedName ? ` — ${selectedName}` : ""}</h2>
          <p className="text-sm text-slate-500 mt-1">
            Days with no time blocks are closed (no bookings).
          </p>
        </div>

        <form onSubmit={handleAddBlock} className="p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="avail-day" className="label">Day</label>
              <select
                id="avail-day"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="input bg-slate-800 border-slate-700"
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={String(i)}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="avail-start" className="label">Start</label>
              <input
                id="avail-start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="input bg-slate-800 border-slate-700"
                required
              />
            </div>
            <div>
              <label htmlFor="avail-end" className="label">End</label>
              <input
                id="avail-end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="input bg-slate-800 border-slate-700"
                required
              />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={isSaving} className="btn btn-primary w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-1" /> Add hours
              </button>
            </div>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full" role="table">
            <thead>
              <tr className="border-b border-slate-800 text-left text-sm font-medium text-slate-400">
                <th className="p-4">Day</th>
                <th className="p-4">Time blocks</th>
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d, i) => {
                const blocks = visibleSchedules
                  .filter((s) => s.dayOfWeek === i)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
                return (
                  <tr key={d} className="border-b border-slate-800/50 hover:bg-slate-950/50">
                    <td className="p-4 font-medium whitespace-nowrap">{d}</td>
                    <td className="p-4">
                      {blocks.length === 0 ? (
                        <span className="text-sm text-slate-600">Closed</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {blocks.map((b) => (
                            <span
                              key={b.id}
                              className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-slate-800 text-slate-200 rounded-full"
                            >
                              {b.startTime}–{b.endTime}
                              <button
                                type="button"
                                onClick={() => handleDeleteBlock(b.id)}
                                className="text-slate-400 hover:text-red-400"
                                aria-label={`Remove ${d} ${b.startTime} to ${b.endTime}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visibleSchedules.length === 0 && (
                <tr>
                  <td colSpan={2} className="p-8 text-center text-slate-500">
                    No hours set{selectedName ? ` for ${selectedName}` : ""} — add the first block above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Date overrides */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 mb-6">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold">Date overrides{selectedName ? ` — ${selectedName}` : ""}</h2>
          <p className="text-sm text-slate-500 mt-1">
            One-off changes: block a full day, block a few hours, or add extra hours.
          </p>
        </div>

        <form onSubmit={handleAddOverride} className="p-4 border-b border-slate-800 bg-slate-950/50 space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div>
              <label htmlFor="ov-date" className="label">Date</label>
              <input
                id="ov-date"
                type="date"
                value={ovDate}
                onChange={(e) => setOvDate(e.target.value)}
                className="input bg-slate-800 border-slate-700"
                required
              />
            </div>
            <div>
              <span className="label" id="ov-type-label">Type</span>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ov-type-label">
                <button
                  type="button"
                  onClick={() => setOvBlocked(true)}
                  className={`btn btn-sm ${ovBlocked ? "btn-primary" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                >
                  Block time
                </button>
                <button
                  type="button"
                  onClick={() => setOvBlocked(false)}
                  className={`btn btn-sm ${!ovBlocked ? "btn-primary" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                >
                  Add extra hours
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={fullDay}
                onChange={(e) => setFullDay(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 text-accent-600 focus:ring-accent-500"
              />
              <span className="text-sm">Whole day</span>
            </label>
          </div>

          {!fullDay && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <div>
                <label htmlFor="ov-start" className="label">Start</label>
                <input
                  id="ov-start"
                  type="time"
                  value={ovStart}
                  onChange={(e) => setOvStart(e.target.value)}
                  className="input bg-slate-800 border-slate-700"
                  required
                />
              </div>
              <div>
                <label htmlFor="ov-end" className="label">End</label>
                <input
                  id="ov-end"
                  type="time"
                  value={ovEnd}
                  onChange={(e) => setOvEnd(e.target.value)}
                  className="input bg-slate-800 border-slate-700"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <button type="submit" disabled={isSaving} className="btn btn-primary w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" /> Add date change
            </button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full" role="table">
            <thead>
              <tr className="border-b border-slate-800 text-left text-sm font-medium text-slate-400">
                <th className="p-4">Date</th>
                <th className="p-4">Change</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleOverrides.map((o) => (
                <tr key={o.id} className="border-b border-slate-800/50 hover:bg-slate-950/50">
                  <td className="p-4 whitespace-nowrap">{formatOverrideDate(o.date)}</td>
                  <td className="p-4">
                    <span className="text-sm">
                      {o.startTime && o.endTime
                        ? `${o.isBlocked ? "Blocked" : "Extra hours"} ${o.startTime}–${o.endTime}`
                        : o.isBlocked ? "Day blocked" : "Day added"}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDeleteOverride(o.id)}
                      className="btn btn-primary btn-sm opacity-80"
                      aria-label={`Remove override on ${formatOverrideDate(o.date)}`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {visibleOverrides.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-slate-500">
                    No date changes{selectedName ? ` for ${selectedName}` : ""} — bank holidays and leave go here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        The public booking calendar reads these hours live from the database, so changes take
        effect immediately — no restart needed. Each date change carries a version number so
        future updates can spot stale data.
      </p>
    </div>
  );
}
