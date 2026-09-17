import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HolidaysClient } from "./HolidaysClient";
import type { Holiday } from "@/components/dashboard/types";

export default async function HolidaysPage() {
  const session = await auth();
  if (!session) {
    return null;
  }

  const holidays = await prisma.holiday.findMany({
    orderBy: { date: "desc" },
  });

  const formattedHolidays: Holiday[] = holidays.map((h) => ({
    ...h,
    date: h.date.toISOString().split("T")[0],
  }));

  return <HolidaysClient initialHolidays={formattedHolidays} />;
}
