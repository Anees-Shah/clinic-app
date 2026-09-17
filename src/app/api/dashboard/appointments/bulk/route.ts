import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { appointmentIds, action } = await request.json();

    if (!appointmentIds || !Array.isArray(appointmentIds) || appointmentIds.length === 0) {
      return NextResponse.json({ error: "No appointments selected" }, { status: 400 });
    }

    if (!["no_show", "cancel"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const status = action === "no_show" ? "no_show" : "cancelled";

    const appointments = await prisma.appointment.findMany({
      where: { id: { in: appointmentIds } },
      include: { service: true, provider: true },
    });

    if (appointments.length === 0) {
      return NextResponse.json({ error: "No appointments found" }, { status: 404 });
    }

    // Update all appointments
    await prisma.appointment.updateMany({
      where: { id: { in: appointmentIds } },
      data: { status },
    });

    // Trigger SSE broadcast for each appointment via Inngest
    for (const appt of appointments) {
      await fetch(`${process.env.NEXTAUTH_URL}/api/inngest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: action === "no_show" ? "appointment.no_show" : "appointment.cancelled",
          data: { appointmentId: appt.id },
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, count: appointments.length });
  } catch (error) {
    console.error("Bulk action failed:", error);
    return NextResponse.json({ error: "Bulk action failed" }, { status: 500 });
  }
}
