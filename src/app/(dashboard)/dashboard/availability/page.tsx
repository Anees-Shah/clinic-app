import { auth } from "@/auth";
import { getAllProviders } from "@/lib/providers";
import { prisma } from "@/lib/prisma";
import { AvailabilityClient } from "./AvailabilityClient";

export default async function AvailabilityPage() {
  const session = await auth();
  if (!session) {
    return null; // Will be redirected by middleware
  }

  const [providers, schedules, overrides] = await Promise.all([
    getAllProviders(),
    prisma.availabilitySchedule
      .findMany({
        include: { provider: { select: { id: true, name: true } } },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      })
      .catch(() => []),
    prisma.availabilityOverride
      .findMany({
        include: { provider: { select: { id: true, name: true } } },
        orderBy: { date: "asc" },
      })
      .catch(() => []),
  ]);

  return (
    <AvailabilityClient
      providers={providers.map((p) => ({ id: p.id, name: p.name }))}
      initialSchedules={schedules.map((s) => ({
        id: s.id,
        providerId: s.providerId,
        providerName: s.provider.name,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      }))}
      initialOverrides={overrides.map((o) => ({
        id: o.id,
        providerId: o.providerId,
        providerName: o.provider.name,
        date: o.date.toISOString().slice(0, 10),
        startTime: o.startTime,
        endTime: o.endTime,
        isBlocked: o.isBlocked,
        revision: o.revision,
      }))}
    />
  );
}
