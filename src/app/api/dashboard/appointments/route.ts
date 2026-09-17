import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "day";
  const dateParam = searchParams.get("date");
  const providerId = searchParams.get("providerId");

  if (!dateParam) {
    return NextResponse.json({ error: "Date parameter required" }, { status: 400 });
  }

  // Parse date in Europe/London timezone
  const date = toZonedTime(dateParam, "Europe/London");
  let startDate: Date;
  let endDate: Date;

  switch (view) {
    case "day":
      startDate = startOfDay(date);
      endDate = endOfDay(date);
      break;
    case "week":
      startDate = startOfWeek(date, { weekStartsOn: 1 });
      endDate = endOfWeek(date, { weekStartsOn: 1 });
      break;
    case "month":
      startDate = startOfMonth(date);
      endDate = endOfMonth(date);
      break;
    default:
      startDate = startOfDay(date);
      endDate = endOfDay(date);
  }

  // Convert to UTC for database query
  const startUTC = new Date(formatInTimeZone(startDate, "UTC", "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"));
  const endUTC = new Date(formatInTimeZone(endDate, "UTC", "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"));

  const where: Record<string, unknown> = {
    startsAt: {
      gte: startUTC,
      lte: endUTC,
    },
  };

  if (providerId && providerId !== "all") {
    where.providerId = providerId;
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      service: {
        select: {
          id: true,
          name: true,
          durationMin: true,
          bufferBeforeMin: true,
          bufferAfterMin: true,
          price: true,
        },
      },
      provider: {
        select: {
          id: true,
          name: true,
          title: true,
        },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  return NextResponse.json({ appointments });
}
