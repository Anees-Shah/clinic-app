"use client";

import { useState } from "react";
import { Loader2, Bell, MessageSquare, Shield, Globe, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsClientProps {
  smsEnabled: boolean;
}

export function SettingsClient({ smsEnabled: initialSmsEnabled }: SettingsClientProps) {
  const [smsEnabled, setSmsEnabled] = useState(initialSmsEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleToggleSms = async () => {
    const newValue = !smsEnabled;
    setSmsEnabled(newValue);
    setIsSaving(true);
    try {
      const response = await fetch("/api/dashboard/settings/sms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newValue }),
      });

      if (!response.ok) {
        throw new Error("Failed to update SMS settings");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      setSmsEnabled(smsEnabled); // Revert on error
      alert("Failed to update SMS settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container py-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-slate-400 mt-1">Configure clinic-wide settings</p>
      </div>

      <div className="card bg-slate-900 border-slate-800 space-y-6 p-6">
        <section>
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="h-6 w-6 text-accent-400" />
            <h2 className="text-lg font-semibold">SMS Notifications</h2>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Enable or disable SMS notifications globally. When enabled, patients who opt-in will receive SMS reminders.
            Email notifications are always sent regardless of this setting.
          </p>

          <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-lg border border-slate-800">
            <div>
              <p className="font-medium">SMS Notifications</p>
              <p className="text-sm text-slate-400">Send SMS reminders to patients who opt-in</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={smsEnabled}
                onChange={handleToggleSms}
                disabled={isSaving}
                className="sr-only peer"
              />
              <div className={cn(
                "w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-600"
              )} />
            </label>
          </div>

          {saved && (
            <p className="text-sm text-green-400 flex items-center gap-1">
              <Loader2 className="h-4 w-4" /> Settings saved
            </p>
          )}
        </section>

        <section className="border-t border-slate-800 pt-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-6 w-6 text-accent-400" />
            <h2 className="text-lg font-semibold">Security</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800">
              <p className="font-medium mb-1">Session Duration</p>
              <p className="text-sm text-slate-400">30 days (fixed)</p>
            </div>
            <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800">
              <p className="font-medium mb-1">Authentication</p>
              <p className="text-sm text-slate-400">Email/password with bcrypt</p>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-800 pt-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="h-6 w-6 text-accent-400" />
            <h2 className="text-lg font-semibold">Localization</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800">
              <p className="font-medium mb-1">Timezone</p>
              <p className="text-sm text-slate-400">Europe/London (fixed)</p>
            </div>
            <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800">
              <p className="font-medium mb-1">Business Hours</p>
              <p className="text-sm text-slate-400">Mon-Fri 09:00-18:00</p>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-800 pt-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="h-6 w-6 text-accent-400" />
            <h2 className="text-lg font-semibold">Data Management</h2>
          </div>
          <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800">
            <p className="font-medium mb-2">Database</p>
            <p className="text-sm text-slate-400 mb-4">
              PostgreSQL on Neon (serverless). Automatic backups and point-in-time recovery available via Neon dashboard.
            </p>
            <div className="flex gap-2">
              <a
                href="https://console.neon.tech"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
              >
                Open Neon Dashboard
              </a>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-800 pt-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="h-6 w-6 text-accent-400" />
            <h2 className="text-lg font-semibold">Notifications</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800">
              <p className="font-medium mb-1">Email Provider</p>
              <p className="text-sm text-slate-400">Resend (configured via RESEND_API_KEY)</p>
            </div>
            <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800">
              <p className="font-medium mb-1">SMS Provider</p>
              <p className="text-sm text-slate-400">Twilio Verify (configured via TWILIO_* env vars)</p>
            </div>
            <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800">
              <p className="font-medium mb-1">Reminder Schedule</p>
              <p className="text-sm text-slate-400">24 hours & 1 hour before appointment</p>
            </div>
            <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800">
              <p className="font-medium mb-1">Queue System</p>
              <p className="text-sm text-slate-400">Inngest (free tier: 100k events/mo)</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}