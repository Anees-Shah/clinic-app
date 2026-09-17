import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const providerSchema = z.object({
  name: z.string().min(1).max(100),
  title: z.string().min(1).max(100),
  photoUrl: z.string().max(500).optional().or(z.literal("")),
  bio: z.string().max(2000).optional().or(z.literal("")),
  qualifications: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  serviceIds: z.array(z.string()).default([]),
});

function shape(p: {
  id: string;
  name: string;
  title: string;
  photoUrl: string | null;
  bio: string | null;
  qualifications: string[];
  active: boolean;
  services: Array<{ service: { id: string; code: string; name: string } }>;
}) {
  return {
    id: p.id,
    name: p.name,
    title: p.title,
    photoUrl: p.photoUrl,
    bio: p.bio,
    qualifications: p.qualifications,
    active: p.active,
    services: p.services.map((sp) => sp.service),
  };
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providers = await prisma.provider.findMany({
    include: {
      services: { include: { service: true }, orderBy: { service: { name: "asc" } } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ providers: providers.map(shape) });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = providerSchema.parse(body);

    // Validate serviceIds up front: unknown/stale ids would otherwise surface
    // as an FK 500 from the nested create. Return 400 with a clear message.
    // (Also warms a fresh pooled connection before the write.)
    if (data.serviceIds.length > 0) {
      const existing = await prisma.service.findMany({
        where: { id: { in: data.serviceIds } },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((s) => s.id));
      const unknown = data.serviceIds.filter((id) => !existingIds.has(id));
      if (unknown.length > 0) {
        return NextResponse.json(
          { error: `Unknown service IDs: ${unknown.join(", ")}. Refresh the page and try again.` },
          { status: 400 }
        );
      }
    }

    const createProvider = () =>
      prisma.provider.create({
        data: {
          name: data.name,
          title: data.title,
          photoUrl: data.photoUrl || null,
          bio: data.bio || null,
          qualifications: data.qualifications,
          active: data.active,
          services: {
            create: data.serviceIds.map((serviceId) => ({ serviceId })),
          },
          // Default Mon–Fri 09:00–18:00 so a new doctor is bookable immediately
          schedules: {
            create: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
              dayOfWeek,
              startTime: "09:00",
              endTime: "18:00",
            })),
          },
        },
        include: {
          services: { include: { service: true }, orderBy: { service: { name: "asc" } } },
        },
      });

    let provider;
    try {
      provider = await createProvider();
    } catch (retryable) {
      // Neon PgBouncer occasionally closes an idle pooled connection; the
      // first write on it fails with "Server has closed the connection".
      // Retry once on a fresh connection before giving up.
      const msg = retryable instanceof Error ? retryable.message : String(retryable);
      const isTransient =
        msg.includes("Server has closed the connection") ||
        msg.includes("Connection closed") ||
        msg.includes("Connection terminated") ||
        (typeof (retryable as { code?: string })?.code === "string" &&
          ["P1001", "P1002", "P1017"].includes((retryable as { code: string }).code));
      if (!isTransient) throw retryable;
      console.warn("Retrying provider create after transient DB error:", msg);
      provider = await createProvider();
    }

    return NextResponse.json({ provider: shape(provider) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Failed to create provider:", error);
    return NextResponse.json({ error: "Failed to create staff member" }, { status: 500 });
  }
}
