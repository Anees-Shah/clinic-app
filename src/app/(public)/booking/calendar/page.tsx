import { getServiceByCode } from "@/lib/services";
import { getProviderById } from "@/lib/providers";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isBefore } from "date-fns";
import { notFound } from "next/navigation";
import { BookingCalendarClient } from "./CalendarClient";

interface Props {
  searchParams: Promise<{ service?: string; provider?: string; date?: string }>;
}

export default async function BookingCalendarPage({ searchParams }: Props) {
  const { service: serviceCode, provider: providerId, date: dateParam } = await searchParams;

  if (!serviceCode || !providerId) {
    notFound();
  }

  const service = await getServiceByCode(serviceCode);
  const provider = await getProviderById(providerId);

  if (!service || !provider) {
    notFound();
  }

  // dateParam is a London calendar day ("yyyy-MM-dd"). Anchor month-grid math
  // on noon UTC (always the same civil date in London, winter and summer) —
  // never parseISO(), which builds a server-local midnight that east of the
  // UK resolves to the previous London day.
  const currentDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? new Date(`${dateParam}T12:00:00.000Z`)
      : new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let day = calendarStart;
  while (isBefore(day, calendarEnd) || isSameDay(day, calendarEnd)) {
    days.push(day);
    day = addDays(day, 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const initialData = {
    serviceCode,
    providerId,
    serviceName: service.name,
    providerName: provider.name,
    currentDate,
    days,
    today,
  };

  return <BookingCalendarClient initialData={initialData} />;
}