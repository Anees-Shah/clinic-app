import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get("providerId");
  const date = searchParams.get("date");

  const where: Record<string, unknown> = {};

  if (providerId && providerId !== "all") {
    where.providerId = providerId;
  }

  if (date) {
    where.requestedDate = {
      equals: new Date(date),
    };
  }

  const entries = await prisma.waitlistEntry.findMany({
    where,
    include: {
      provider: { select: { id: true, name: true } },
      service: { select: { id: true, name: true } },
    },
    orderBy: [{ requestedDate: "asc" }, { position: "asc" }],
  });

  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { patientName, patientEmail, patientPhone, providerId, serviceId, requestedDate } = body;

    if (!patientName || !patientEmail || !patientPhone || !providerId || !serviceId || !requestedDate) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const dateOnly = new Date(requestedDate);
    dateOnly.setHours(0, 0, 0, 0);
    if (Number.isNaN(dateOnly.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    // Next position for this provider/service/date queue
    const max = await prisma.waitlistEntry.aggregate({
      where: { providerId, serviceId, requestedDate: dateOnly },
      _max: { position: true },
    });

    const entry = await prisma.waitlistEntry.create({
      data: {
        providerId,
        serviceId,
        patientName,
        patientEmail,
        patientPhone,
        requestedDate: dateOnly,
        position: (max._max.position ?? 0) + 1,
      },
      include: {
        provider: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Failed to create waitlist entry:", error);
    return NextResponse.json({ error: "Failed to create waitlist entry" }, { status: 500 });
  }
}
