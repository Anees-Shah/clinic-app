import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const scheduleSchema = z.object({
  providerId: z.string().min(1),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(timeRegex, "startTime must be HH:mm"),
  endTime: z.string().regex(timeRegex, "endTime must be HH:mm"),
});

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
  }

  const providerId = request.nextUrl.searchParams.get("providerId");

  const schedules = await prisma.availabilitySchedule.findMany({
    where: providerId ? { providerId } : undefined,
    include: { provider: { select: { id: true, name: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ schedules });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = scheduleSchema.parse(body);

    if (!Number.isFinite(data.dayOfWeek)) {
      return NextResponse.json(
        { error: "Day of week must be a number 0–6", message: "Day of week must be a number 0–6" },
        { status: 400 }
      );
    }

    if (toMinutes(data.startTime) >= toMinutes(data.endTime)) {
      return NextResponse.json(
        { error: "Start time must be before end time", message: "Start time must be before end time" },
        { status: 400 }
      );
    }

    // Validate provider exists first so unknown ids return 400, not a 500 FK error.
    const provider = await prisma.provider.findUnique({
      where: { id: data.providerId },
      select: { id: true },
    });
    if (!provider) {
      return NextResponse.json(
        { error: "Unknown provider. Refresh the page and try again.", message: "Unknown provider. Refresh the page and try again." },
        { status: 400 }
      );
    }

    const schedule = await prisma.availabilitySchedule.create({ data });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return NextResponse.json({ error: message, message }, { status: 400 });
    }
    // Prisma unique violation on providerId+dayOfWeek+startTime+endTime
    if (typeof (error as { code?: string })?.code === "string" && (error as { code: string }).code === "P2002") {
      const msg = "This time block already exists for this provider and day.";
      return NextResponse.json({ error: msg, message: msg }, { status: 400 });
    }
    console.error("Failed to create schedule:", error);
    return NextResponse.json(
      { error: "Failed to create time block", message: "Failed to create time block" },
      { status: 500 }
    );
  }
}
