import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeSlots } from "@/lib/availability";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date"); // YYYY-MM-DD

    if (!dateStr) {
      return NextResponse.json({ error: "Missing ?date=YYYY-MM-DD" }, { status: 400 });
    }

    // Noon UTC: the London AND server-local calendar day both equal dateStr
    // regardless of server timezone. (Previously server-local midnight, which
    // in UTC+5 is the previous day 19:00Z — London still "yesterday" — so the
    // Sep-30 block was looked up as Sep-29 and missed.)
    const date = new Date(`${dateStr}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { providerId: true, serviceId: true },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Exclude self so the current slot shows as available
    const slots = await computeSlots(
      appointment.providerId,
      appointment.serviceId,
      date,
      id
    );

    return NextResponse.json({
      slots: slots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        available: s.available,
      })),
    });
  } catch (error) {
    console.error("Failed to load admin slots:", error);
    return NextResponse.json({ error: "Failed to load slots" }, { status: 500 });
  }
}
