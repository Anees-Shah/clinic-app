"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { Loader2, Send, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Provider } from "@/lib/providers";
import type { ServiceWithProviders } from "@/lib/services";

interface WaitlistEntry {
  id: string;
  providerId: string;
  serviceId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  requestedDate: string;
  position: number;
  notifiedAt: string | null;
  claimedAt: string | null;
  claimToken: string | null;
  expiresAt: string | null;
  createdAt: string;
  provider: { id: string; name: string };
  service: { id: string; name: string };
}

interface WaitlistClientProps {
  providers: Provider[];
  services: ServiceWithProviders[];
}

export function WaitlistClient({ providers, services }: WaitlistClientProps) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterProvider, setFilterProvider] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterProvider !== "all") params.set("providerId", filterProvider);
      if (filterDate) params.set("date", filterDate);

      const response = await fetch(`/api/dashboard/waitlist?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries);
      }
    } catch (error) {
      console.error("Failed to fetch waitlist:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Refetch from the server whenever filters change (async boundary, no cascade).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    fetchEntries();
  }, [filterProvider, filterDate]);

  const handlePromote = async (entry: WaitlistEntry) => {
    setPromotingId(entry.id);
    try {
      const response = await fetch("/api/dashboard/waitlist/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: entry.id }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error as { error?: string; message?: string }).error || (error as { message?: string }).message || "Failed to promote");
      }

      const data = await response.json().catch(() => null);
      // Promote generates a 30-min single-use claim link; in dev (no Resend
      // key) the link is server-logged ([WAITLIST]). Surface it for testing.
      if (data && (data as { claimLink?: string }).claimLink) {
        alert(`Claim link (30-min, single-use):\n${(data as { claimLink: string }).claimLink}`);
      }

      await fetchEntries();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to promote");
    } finally {
      setPromotingId(null);
    }
  };

  const handleClearFilters = () => {
    setFilterProvider("all");
    setFilterDate("");
  };

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Waitlist</h1>
        {/* Admin-only manual waitlist (spec: no waitlist UI on the landing/
            booking flow). Admin adds entries below, then Promote sends a
            30-minute single-use claim link. */}
        <p className="text-slate-400 mt-1">Admin-only: add entries manually, then promote with a 30-minute claim link</p>
      </div>

      <AddWaitlistForm providers={providers} services={services} onAdded={fetchEntries} />

      <div className="card bg-slate-900 border-slate-800 mb-6">
        <div className="p-4 border-b border-slate-800">
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={filterProvider}
              onChange={(e) => setFilterProvider(e.target.value)}
              className="input bg-slate-800 border-slate-700 w-auto"
            >
              <option value="all">All Providers</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="input bg-slate-800 border-slate-700 w-auto"
              placeholder="Filter by date"
            />

            {(filterProvider !== "all" || filterDate) && (
              <button
                onClick={handleClearFilters}
                className="btn btn-outline btn-sm"
              >
                <X className="h-4 w-4 mr-1" /> Clear Filters
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" role="table">
            <thead>
              <tr className="border-b border-slate-800 text-left text-sm font-medium text-slate-400">
                <th className="p-4">Patient</th>
                <th className="p-4 hidden md:table-cell">Contact</th>
                <th className="p-4">Service</th>
                <th className="p-4">Provider</th>
                <th className="p-4">Requested Date</th>
                <th className="p-4">Position</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-accent-400 mx-auto" />
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No waitlist entries found. There is no public waitlist signup —
                    entries are added here by the admin (form above) and promoted
                    manually with a 30-minute claim link. Cancellations also trigger
                    an automatic promotion check for a matching entry.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-800/50 hover:bg-slate-950/50">
                    <td className="p-4 font-medium">{entry.patientName}</td>
                    <td className="p-4 hidden md:table-cell text-sm text-slate-400">
                      <div>{entry.patientEmail}</div>
                      <div>{entry.patientPhone}</div>
                    </td>
                    <td className="p-4">{entry.service.name}</td>
                    <td className="p-4">{entry.provider.name}</td>
                    <td className="p-4">
                      {formatInTimeZone(entry.requestedDate, "Europe/London", "MMM d, yyyy")}
                    </td>
                    <td className="p-4 font-mono text-accent-400">#{entry.position}</td>
                    <td className="p-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full",
                          entry.claimedAt
                            ? "bg-green-900/30 text-green-400"
                            : entry.notifiedAt
                            ? "bg-amber-900/30 text-amber-400"
                            : "bg-blue-900/30 text-blue-400"
                        )}
                      >
                        {entry.claimedAt ? "Claimed" : entry.notifiedAt ? "Notified" : "Waiting"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {!entry.claimedAt && !entry.notifiedAt && (
                        <button
                          onClick={() => handlePromote(entry)}
                          disabled={promotingId === entry.id}
                          className="btn btn-primary btn-sm"
                        >
                          {promotingId === entry.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-1" /> Promote
                            </>
                          )}
                        </button>
                      )}
                      {entry.notifiedAt && !entry.claimedAt && (
                        <span className="text-sm text-amber-400">Link sent</span>
                      )}
                      {entry.claimedAt && (
                        <span className="text-sm text-green-400">Claimed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AddWaitlistForm({
  providers,
  services,
  onAdded,
}: {
  providers: Provider[];
  services: ServiceWithProviders[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    patientName: "",
    patientEmail: "",
    patientPhone: "",
    providerId: "",
    serviceId: "",
    requestedDate: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to add entry");
      }
      setForm({ patientName: "", patientEmail: "", patientPhone: "", providerId: "", serviceId: "", requestedDate: "" });
      setOpen(false);
      onAdded();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add entry");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "input bg-slate-800 border-slate-700 w-full text-sm";

  if (!open) {
    return (
      <div className="mb-6">
        <button onClick={() => setOpen(true)} className="btn btn-primary btn-sm">
          + Add waitlist entry
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card bg-slate-900 border-slate-800 p-4 mb-6 grid gap-3 md:grid-cols-3">
      <input className={inputCls} placeholder="Patient name" required value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
      <input className={inputCls} placeholder="Email" type="email" required value={form.patientEmail} onChange={(e) => setForm({ ...form, patientEmail: e.target.value })} />
      <input className={inputCls} placeholder="Phone" required value={form.patientPhone} onChange={(e) => setForm({ ...form, patientPhone: e.target.value })} />
      <select className={inputCls} required value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })}>
        <option value="">Select provider</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <select className={inputCls} required value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
        <option value="">Select service</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <input className={inputCls} type="date" required value={form.requestedDate} onChange={(e) => setForm({ ...form, requestedDate: e.target.value })} />
      <div className="md:col-span-3 flex gap-2 justify-end">
        <button type="button" onClick={() => setOpen(false)} className="btn btn-outline btn-sm">Cancel</button>
        <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? "Adding..." : "Add entry"}</button>
      </div>
    </form>
  );
}