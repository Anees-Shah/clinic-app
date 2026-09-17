"use client";

import { useState } from "react";
import { fmtLondon } from "@/lib/london";
import { Plus, Trash2, Calendar, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Holiday {
  id: string;
  date: string;
  name: string;
  isRecurring: boolean;
}

interface HolidaysClientProps {
  initialHolidays: Holiday[];
}

export function HolidaysClient({ initialHolidays }: HolidaysClientProps) {
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
  const [newHoliday, setNewHoliday] = useState({ date: "", name: "", isRecurring: false });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHoliday.date || !newHoliday.name) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/dashboard/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newHoliday),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add holiday");
      }

      const saved = await response.json();
      setHolidays([saved.holiday, ...holidays]);
      setNewHoliday({ date: "", name: "", isRecurring: false });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to add holiday");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this holiday?")) return;

    try {
      const response = await fetch(`/api/dashboard/holidays/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");
      setHolidays(holidays.filter((h) => h.id !== id));
    } catch {
      alert("Failed to delete holiday");
    }
  };

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Holidays</h1>
        <p className="text-slate-400 mt-1">Manage clinic closure dates. These affect cancellation windows and availability.</p>
      </div>

      <div className="card bg-slate-900 border-slate-800">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold mb-4">Add Holiday</h2>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-4 items-end">
            <div>
              <label htmlFor="date" className="label">Date</label>
              <input
                id="date"
                type="date"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                className="input bg-slate-800 border-slate-700"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="name" className="label">Name</label>
              <input
                id="name"
                type="text"
                value={newHoliday.name}
                onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                className="input bg-slate-800 border-slate-700"
                placeholder="e.g., Christmas Day, Bank Holiday"
                required
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={newHoliday.isRecurring}
                  onChange={(e) => setNewHoliday({ ...newHoliday, isRecurring: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-600 text-accent-600 focus:ring-accent-500"
                />
                <span className="text-sm">Recurring annually</span>
              </label>
              <button type="submit" disabled={isLoading} className="btn btn-primary">
                {isLoading ? "Adding..." : <Plus className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>

        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full" role="table">
              <thead>
                <tr className="border-b border-slate-800 text-left text-sm font-medium text-slate-400">
                  <th className="p-4">Date</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Type</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {holidays.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      No holidays configured. Add holidays above to block dates clinic-wide.
                    </td>
                  </tr>
                ) : (
                  holidays.map((holiday) => (
                    <tr key={holiday.id} className="border-b border-slate-800/50 hover:bg-slate-950/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-5 w-5 text-slate-400" />
                          <span>{fmtLondon(holiday.date, "EEEE, MMMM d, yyyy")}</span>
                        </div>
                      </td>
                      <td className="p-4 font-medium">{holiday.name}</td>
                      <td className="p-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full",
                            holiday.isRecurring
                              ? "bg-amber-900/30 text-amber-400 border border-amber-800"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          )}
                        >
                          {holiday.isRecurring && <AlertTriangle className="h-3 w-3" />}
                          {holiday.isRecurring ? "Recurring" : "One-time"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDelete(holiday.id)}
                          className="btn btn-outline btn-sm text-destructive border-destructive/50 hover:bg-destructive/10"
                          aria-label={`Delete ${holiday.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
        <h3 className="font-medium mb-2 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          How Holidays Work
        </h3>
        <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
          <li>Holidays are clinic-wide closure dates</li>
          <li>They are excluded from the 48-business-hour cancellation window calculation</li>
          <li>They automatically block availability for all providers on those dates</li>
          <li>Recurring holidays repeat annually on the same date</li>
        </ul>
      </div>
    </div>
  );
}