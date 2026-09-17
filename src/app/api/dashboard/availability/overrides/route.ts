import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const optionalTime = z.string().regex(timeRegex, "Time must be HH:mm").optional().or(z.literal("")).or(z.null());

const overrideSchema = z.object({
  providerId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  isBlocked: z.coerce.boolean(),
  startTime: optionalTime,
  endTime: optionalTime,
});

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function norm(t: string | null | undefined): string | null {
  if (!t) return null;
  const trimmed = t.trim();
  return trimmed === "" ? null : trimmed;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
  }

  const providerId = request.nextUrl.searchParams.get("providerId");

  const overrides = await prisma.availabilityOverride.findMany({
    where: providerId ? { providerId } : undefined,
    include: { provider: { select: { id: true, name: true } } },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ overrides });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = overrideSchema.parse(body);

    const startTime = norm(data.startTime);
    const endTime = norm(data.endTime);

    // Both-or-neither: null+null = full-day block; otherwise both required.
    if ((startTime === null) !== (endTime === null)) {
      const msg = "Provide both start and end times, or leave both empty for a full-day block.";
      return NextResponse.json({ error: msg, message: msg }, { status: 400 });
    }
    if (startTime && endTime && toMinutes(startTime) >= toMinutes(endTime)) {
      const msg = "Start time must be before end time.";
      return NextResponse.json({ error: msg, message: msg }, { status: 400 });
    }

    const provider = await prisma.provider.findUnique({
      where: { id: data.providerId },
      select: { id: true },
    });
    if (!provider) {
      const msg = "Unknown provider. Refresh the page and try again.";
      return NextResponse.json({ error: msg, message: msg }, { status: 400 });
    }

    const date = new Date(`${data.date}T00:00:00.000Z`);

    // NOTE: the @@unique constraint includes nullable startTime/endTime, and
    // PostgreSQL treats NULL as distinct — so duplicate full-day blocks would
    // NOT trip P2002. Check manually for a friendly 400 instead.
    const existing = await prisma.availabilityOverride.findFirst({
      where: { providerId: data.providerId, date, startTime, endTime },
    });
    if (existing) {
      const msg = "An override for this provider, date and time already exists.";
      return NextResponse.json({ error: msg, message: msg }, { status: 400 });
    }

    // Auto-bump revision = max+1 for this provider (used for future caching).
    const latest = await prisma.availabilityOverride.findFirst({
      where: { providerId: data.providerId },
      orderBy: { revision: "desc" },
      select: { revision: true },
    });
    const revision = (latest?.revision ?? 0) + 1;

    const override = await prisma.availabilityOverride.create({
      data: {
        providerId: data.providerId,
        date,
        startTime,
        endTime,
        isBlocked: data.isBlocked,
        revision,
      },
    });

    return NextResponse.json({ override }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return NextResponse.json({ error: message, message }, { status: 400 });
    }
    if (typeof (error as { code?: string })?.code === "string" && (error as { code: string }).code === "P2002") {
      const msg = "An override for this provider, date and time already exists.";
      return NextResponse.json({ error: msg, message: msg }, { status: 400 });
    }
    console.error("Failed to create override:", error);
    return NextResponse.json(
      { error: "Failed to create date override", message: "Failed to create date override" },
      { status: 500 }
    );
  }
}
