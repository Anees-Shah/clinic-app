"use client";

import { useState, useEffect } from "react";
import { formatPrice } from "@/lib/utils";
import { Plus, Save, X, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceWithProviders } from "@/lib/services";
import type { Provider } from "@/lib/providers";

interface ServicesClientProps {
  services: ServiceWithProviders[];
  providers: Provider[];
}

interface ServiceFormData {
  id?: string;
  code: string;
  name: string;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  price: number;
  description: string;
  active: boolean;
  providerIds: string[];
}

// API returns `providers` as join rows ({ provider: {...} }) while the
// client table uses flattened providers ({ id, name, ... }). Normalize both
// shapes so keys/ids never collapse to `undefined` (the duplicate-key +
// "Failed to save service on second edit" bug).
function normalizeService(svc: Record<string, unknown>): ServiceWithProviders {
  const raw = (svc.providers ?? []) as Array<Record<string, unknown>>;
  const providers = raw.map((p) => {
    const nested = p.provider as Record<string, unknown> | undefined;
    const src = nested ?? p;
    return {
      id: String(src.id ?? ""),
      name: String(src.name ?? ""),
      title: String(src.title ?? ""),
      photoUrl: (src.photoUrl as string | null) ?? null,
      bio: (src.bio as string | null) ?? null,
      qualifications: (src.qualifications as string[]) ?? [],
    };
  });
  return {
    id: String(svc.id),
    code: String(svc.code ?? ""),
    name: String(svc.name ?? ""),
    durationMin: Number(svc.durationMin ?? 30),
    bufferBeforeMin: Number(svc.bufferBeforeMin ?? 0),
    bufferAfterMin: Number(svc.bufferAfterMin ?? 0),
    price: Number(svc.price ?? 0),
    description: (svc.description as string | null) ?? null,
    active: Boolean(svc.active ?? true),
    providers,
  };
}

function toInt(value: string, fallback: number): number {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toFloat(value: string, fallback: number): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

export function ServicesClient({ services: initialServices, providers }: ServicesClientProps) {
  const [services, setServices] = useState<ServiceWithProviders[]>(initialServices);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>({
    code: "",
    name: "",
    durationMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    price: 0,
    description: "",
    active: true,
    providerIds: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const handleEdit = (service: ServiceWithProviders) => {
    setEditingId(service.id);
    setFormData({
      id: service.id,
      code: service.code,
      name: service.name,
      durationMin: service.durationMin,
      bufferBeforeMin: service.bufferBeforeMin,
      bufferAfterMin: service.bufferAfterMin,
      price: service.price,
      description: service.description || "",
      active: service.active,
      providerIds: service.providers.map((p) => p.id),
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowCreate(false);
    setFormData({
      code: "",
      name: "",
      durationMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      price: 0,
      description: "",
      active: true,
      providerIds: [],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const url = editingId ? `/api/dashboard/services/${editingId}` : "/api/dashboard/services";
      const method = editingId ? "PATCH" : "POST";

      // Send only the fields the API validates, with NaN-proof numbers.
      // (Clearing a number input yields NaN via parseInt/parseFloat, which
      // fails Zod and caused "Failed to save service" on edit.)
      const payload = {
        ...(editingId ? {} : { code: formData.code }),
        name: formData.name,
        durationMin: Number.isFinite(formData.durationMin) ? formData.durationMin : 30,
        bufferBeforeMin: Number.isFinite(formData.bufferBeforeMin) ? formData.bufferBeforeMin : 0,
        bufferAfterMin: Number.isFinite(formData.bufferAfterMin) ? formData.bufferAfterMin : 0,
        price: Number.isFinite(formData.price) ? formData.price : 0,
        description: formData.description,
        active: formData.active,
        providerIds: formData.providerIds,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const detail = Array.isArray((error as { error?: unknown }).error)
          ? ((error as { error: Array<{ message?: string; path?: string[] }> }).error
              .map((z) => `${(z.path || []).join(".")}: ${z.message}`)
              .join("; ") || "Validation failed")
          : ((error as { error?: string }).error || (error as { message?: string }).message || "Failed to save service");
        throw new Error(detail);
      }

      const saved = await response.json();
      const normalized = normalizeService(saved.service);
      if (editingId) {
        setServices(services.map((s) => (s.id === editingId ? normalized : s)));
      } else {
        setServices([...services, normalized]);
      }
      handleCancel();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save service");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this service? This cannot be undone.")) return;
    try {
      const response = await fetch(`/api/dashboard/services/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");
      setServices(services.filter((s) => s.id !== id));
    } catch {
      alert("Failed to delete service");
    }
  };

  const handleToggleActive = async (service: ServiceWithProviders) => {
    try {
      const response = await fetch(`/api/dashboard/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !service.active }),
      });
      if (!response.ok) throw new Error("Failed to update");
      setServices(services.map((s) => (s.id === service.id ? { ...s, active: !s.active } : s)));
    } catch {
      alert("Failed to update service");
    }
  };

  const currentService = editingId
    ? services.find((s) => s.id === editingId)
    : null;

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Services</h1>
        <p className="text-slate-400 mt-1">Manage services, pricing, and provider assignments</p>
      </div>

      <div className="card bg-slate-900 border-slate-800">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Service List</h2>
          <button
            onClick={() => {
              setShowCreate(true);
              setEditingId(null);
              setFormData({
                code: "",
                name: "",
                durationMin: 30,
                bufferBeforeMin: 0,
                bufferAfterMin: 0,
                price: 0,
                description: "",
                active: true,
                providerIds: [],
              });
            }}
            className="btn btn-primary btn-sm"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Service
          </button>
        </div>

        {showCreate || editingId ? (
          <form onSubmit={handleSubmit} className="p-4 border-b border-slate-800 bg-slate-950/50 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="code" className="label">Code (unique)</label>
                <input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="input bg-slate-800 border-slate-700"
                  placeholder="BOTOX, FILLER, etc."
                  required
                  disabled={!!editingId}
                />
              </div>
              <div>
                <label htmlFor="name" className="label">Name</label>
                <input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input bg-slate-800 border-slate-700"
                  placeholder="Anti-Wrinkle Injections"
                  required
                />
              </div>
              <div>
                <label htmlFor="durationMin" className="label">Duration (minutes)</label>
                <input
                  id="durationMin"
                  type="number"
                  min="15"
                  max="240"
                  step="15"
                  value={Number.isFinite(formData.durationMin) ? formData.durationMin : ""}
                  onChange={(e) => setFormData({ ...formData, durationMin: toInt(e.target.value, 30) })}
                  className="input bg-slate-800 border-slate-700"
                  required
                />
              </div>
              <div>
                <label htmlFor="price" className="label">Price (£)</label>
                <input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={Number.isFinite(formData.price) ? formData.price : ""}
                  onChange={(e) => setFormData({ ...formData, price: toFloat(e.target.value, 0) })}
                  className="input bg-slate-800 border-slate-700"
                  required
                />
              </div>
              <div>
                <label htmlFor="bufferBeforeMin" className="label">Buffer Before (min)</label>
                <input
                  id="bufferBeforeMin"
                  type="number"
                  min="0"
                  max="60"
                  value={Number.isFinite(formData.bufferBeforeMin) ? formData.bufferBeforeMin : 0}
                  onChange={(e) => setFormData({ ...formData, bufferBeforeMin: toInt(e.target.value, 0) })}
                  className="input bg-slate-800 border-slate-700"
                />
              </div>
              <div>
                <label htmlFor="bufferAfterMin" className="label">Buffer After (min)</label>
                <input
                  id="bufferAfterMin"
                  type="number"
                  min="0"
                  max="60"
                  value={Number.isFinite(formData.bufferAfterMin) ? formData.bufferAfterMin : 0}
                  onChange={(e) => setFormData({ ...formData, bufferAfterMin: toInt(e.target.value, 0) })}
                  className="input bg-slate-800 border-slate-700"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="label">Description</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="input bg-slate-800 border-slate-700 resize-none"
                placeholder="Service description..."
              />
            </div>

            <div>
              <label className="label">Providers</label>
              <div className="flex flex-wrap gap-2">
                {providers.map((provider) => (
                  <label
                    key={provider.id}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors",
                      formData.providerIds.includes(provider.id)
                        ? "bg-accent-600 text-slate-950"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={formData.providerIds.includes(provider.id)}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          providerIds: e.target.checked
                            ? [...formData.providerIds, provider.id]
                            : formData.providerIds.filter((id) => id !== provider.id),
                        })
                      }
                      className="h-4 w-4 rounded border-slate-600 text-accent-600 focus:ring-accent-500"
                    />
                    {provider.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-600 text-accent-600 focus:ring-accent-500"
                />
                <span className="text-sm">Active</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={handleCancel} className="btn btn-outline">
                <X className="h-4 w-4 mr-1" /> Cancel
              </button>
              <button type="submit" disabled={isLoading} className="btn btn-primary">
                {isLoading ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full" role="table">
            <thead>
              <tr className="border-b border-slate-800 text-left text-sm font-medium text-slate-400">
                <th className="p-4">Service</th>
                <th className="p-4 hidden md:table-cell">Duration</th>
                <th className="p-4 hidden md:table-cell">Price</th>
                <th className="p-4 hidden md:table-cell">Buffers</th>
                <th className="p-4 hidden md:table-cell">Providers</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id} className="border-b border-slate-800/50 hover:bg-slate-950/50">
                  <td className="p-4">
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-xs text-slate-500">Code: {service.code}</p>
                      {service.description && (
                        <p className="text-xs text-slate-400 line-clamp-1 mt-1">{service.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">{service.durationMin} min</td>
                  <td className="p-4 hidden md:table-cell">{formatPrice(service.price)}</td>
                  <td className="p-4 hidden md:table-cell text-sm text-slate-400">
                    {service.bufferBeforeMin > 0 && <span className="mr-2">↑ {service.bufferBeforeMin}min</span>}
                    {service.bufferAfterMin > 0 && <span>↓ {service.bufferAfterMin}min</span>}
                    {service.bufferBeforeMin === 0 && service.bufferAfterMin === 0 && <span className="text-slate-600">None</span>}
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {service.providers?.map((p) => (
                        <span key={p.id} className="px-2 py-0.5 text-xs bg-slate-800 text-slate-300 rounded">
                          {p.name}
                        </span>
                      ))}
                      {(!service.providers || service.providers.length === 0) && <span className="text-slate-600 text-xs">None assigned</span>}
                    </div>
                  </td>
                  <td className="p-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={service.active}
                        onChange={() => handleToggleActive(service)}
                        className="h-4 w-4 rounded border-slate-600 text-accent-600 focus:ring-accent-500"
                      />
                      <span className="text-sm">{service.active ? "Active" : "Inactive"}</span>
                    </label>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(service)}
                        className="btn btn-outline btn-sm"
                        aria-label={`Edit ${service.name}`}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(service.id)}
                        className="btn btn-outline btn-sm text-destructive border-destructive/50 hover:bg-destructive/10"
                        aria-label={`Delete ${service.name}`}
                      >
                        <AlertCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}