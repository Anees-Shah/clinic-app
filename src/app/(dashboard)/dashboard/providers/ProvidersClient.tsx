"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProviderWithServices } from "@/lib/providers";

interface ServiceOption {
  id: string;
  code: string;
  name: string;
}

interface ProvidersClientProps {
  providers: ProviderWithServices[];
  services: ServiceOption[];
}

interface ProviderFormData {
  id?: string;
  name: string;
  title: string;
  photoUrl: string;
  bio: string;
  qualifications: string; // comma-separated in the form
  active: boolean;
  serviceIds: string[];
}

const emptyForm: ProviderFormData = {
  name: "",
  title: "",
  photoUrl: "",
  bio: "",
  qualifications: "",
  active: true,
  serviceIds: [],
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Circle avatar with live preview; falls back to initials on empty/broken URL.
 *  Remounted via key={url} by callers, so no reset effect is needed. */
function StaffAvatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  const [broken, setBroken] = useState(false);
  const clean = (url || "").trim();
  return (
    <div
      className="rounded-full bg-slate-700 text-slate-200 flex-shrink-0 overflow-hidden flex items-center justify-center font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {clean && !broken ? (
        // Plain img (not next/image): instant preview of any URL, incl. unsaved drafts
        <img src={clean} alt="" className="w-full h-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span>{initialsOf(name)}</span>
      )}
    </div>
  );
}

export function ProvidersClient({ providers: initialProviders, services }: ProvidersClientProps) {
  const [providers, setProviders] = useState<ProviderWithServices[]>(initialProviders);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState<ProviderFormData>(emptyForm);
  const [isLoading, setIsLoading] = useState(false);

  const handleEdit = (p: ProviderWithServices) => {
    setEditingId(p.id);
    setShowCreate(false);
    setFormData({
      id: p.id,
      name: p.name,
      title: p.title,
      photoUrl: p.photoUrl || "",
      bio: p.bio || "",
      qualifications: p.qualifications.join(", "),
      active: p.active,
      serviceIds: p.services.map((s) => s.id),
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowCreate(false);
    setFormData(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const url = editingId ? `/api/dashboard/providers/${editingId}` : "/api/dashboard/providers";
      const method = editingId ? "PATCH" : "POST";
      const payload = {
        name: formData.name.trim(),
        title: formData.title.trim(),
        photoUrl: formData.photoUrl.trim(),
        bio: formData.bio.trim(),
        qualifications: formData.qualifications
          .split(",")
          .map((q) => q.trim())
          .filter(Boolean),
        active: formData.active,
        serviceIds: formData.serviceIds,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const raw = (error as { error?: unknown }).error;
        const detail = Array.isArray(raw)
          ? raw
              .map((e) =>
                typeof e === "string"
                  ? e
                  : [ (e as { path?: unknown }).path, (e as { message?: unknown }).message ]
                      .filter(Boolean)
                      .join(" ")
              )
              .join("; ") || "Validation failed — check all fields"
          : ((error as { error?: string }).error || "Failed to save staff member");
        throw new Error(detail);
      }

      const saved = await response.json();
      if (editingId) {
        setProviders(providers.map((p) => (p.id === editingId ? saved.provider : p)));
      } else {
        setProviders([...providers, saved.provider]);
      }
      handleCancel();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save staff member");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? Blocked if they have appointments — deactivate instead.`)) return;
    try {
      const response = await fetch(`/api/dashboard/providers/${id}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Failed to delete");
      setProviders(providers.filter((p) => p.id !== id));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete staff member");
    }
  };

  const handleToggleActive = async (p: ProviderWithServices) => {
    try {
      const response = await fetch(`/api/dashboard/providers/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !p.active }),
      });
      if (!response.ok) throw new Error("Failed to update");
      const saved = await response.json();
      setProviders(providers.map((x) => (x.id === p.id ? saved.provider : x)));
    } catch {
      alert("Failed to update staff member");
    }
  };

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Staff</h1>
        <p className="text-slate-400 mt-1">Add doctors / service providers, assign services, set active status</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="p-4 border-b border-slate-800 flex flex-wrap justify-between items-center gap-3">
          <h2 className="text-lg font-semibold">Team List</h2>
          <button
            onClick={() => {
              setShowCreate(true);
              setEditingId(null);
              setFormData(emptyForm);
            }}
            className="btn btn-primary btn-sm"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Staff
          </button>
        </div>

        {showCreate || editingId ? (
          <form onSubmit={handleSubmit} className="p-4 border-b border-slate-800 bg-slate-950/50 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="staff-name" className="label">Full name</label>
                <input
                  id="staff-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input bg-slate-800 border-slate-700"
                  placeholder="Dr. Sarah Smith"
                  required
                />
              </div>
              <div>
                <label htmlFor="staff-title" className="label">Title</label>
                <input
                  id="staff-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input bg-slate-800 border-slate-700"
                  placeholder="Aesthetic Doctor"
                  required
                />
              </div>
              <div>
                <label htmlFor="staff-photo" className="label">Photo URL (optional)</label>
                <div className="flex items-center gap-3">
                  <StaffAvatar key={formData.photoUrl} url={formData.photoUrl} name={formData.name || "New staff"} size={56} />
                  <input
                    id="staff-photo"
                    value={formData.photoUrl}
                    onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                    className="input bg-slate-800 border-slate-700"
                    placeholder="/providers/dr-smith.jpg"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Put the photo file in the clinic-app/public/providers folder, then enter /providers/filename.jpg — or paste a full https:// link. Live preview on the left.
                </p>
              </div>
              <div>
                <label htmlFor="staff-qual" className="label">Qualifications (comma-separated)</label>
                <input
                  id="staff-qual"
                  value={formData.qualifications}
                  onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                  className="input bg-slate-800 border-slate-700"
                  placeholder="MBBS, MRCS"
                />
              </div>
            </div>

            <div>
              <label htmlFor="staff-bio" className="label">Bio (optional)</label>
              <textarea
                id="staff-bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                className="input bg-slate-800 border-slate-700 resize-none"
                placeholder="Short professional bio shown on the landing page…"
              />
            </div>

            <div>
              <label className="label">Services offered</label>
              {services.length === 0 ? (
                <p className="text-sm text-slate-500">No services yet — create services first.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {services.map((s) => (
                    <label
                      key={s.id}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors",
                        formData.serviceIds.includes(s.id)
                          ? "bg-accent-600 text-slate-950"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={formData.serviceIds.includes(s.id)}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            serviceIds: e.target.checked
                              ? [...formData.serviceIds, s.id]
                              : formData.serviceIds.filter((id) => id !== s.id),
                          })
                        }
                        className="h-4 w-4 rounded border-slate-600 text-accent-600 focus:ring-accent-500"
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-slate-500">New staff get Mon–Fri 09:00–18:00 availability by default.</p>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-600 text-accent-600 focus:ring-accent-500"
                />
                <span className="text-sm">Active (bookable)</span>
              </label>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <button type="button" onClick={handleCancel} className="btn btn-primary w-full sm:w-auto">
                <X className="h-4 w-4 mr-1" /> Cancel
              </button>
              <button type="submit" disabled={isLoading} className="btn btn-primary w-full sm:w-auto">
                {isLoading ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full" role="table">
            <thead>
              <tr className="border-b border-slate-800 text-left text-sm font-medium text-slate-400">
                <th className="p-4">Staff</th>
                <th className="p-4 hidden md:table-cell">Services</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-950/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <StaffAvatar key={`${p.id}-${p.photoUrl ?? ""}`} url={p.photoUrl} name={p.name} size={40} />
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.title}</p>
                        {p.qualifications.length > 0 && (
                          <p className="text-xs text-slate-400 mt-1">{p.qualifications.join(", ")}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {p.services.map((s) => (
                        <span key={s.id} className="px-2 py-0.5 text-xs bg-slate-800 text-slate-300 rounded">
                          {s.name}
                        </span>
                      ))}
                      {p.services.length === 0 && <span className="text-slate-600 text-xs">None assigned</span>}
                    </div>
                  </td>
                  <td className="p-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={p.active}
                        onChange={() => handleToggleActive(p)}
                        className="h-4 w-4 rounded border-slate-600 text-accent-600 focus:ring-accent-500"
                      />
                      <span className="text-sm">{p.active ? "Active" : "Inactive"}</span>
                    </label>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(p)} className="btn btn-primary btn-sm" aria-label={`Edit ${p.name}`}>
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        className="btn btn-primary btn-sm opacity-80"
                        aria-label={`Delete ${p.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {providers.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    No staff yet — click “Add Staff” to add your first doctor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
