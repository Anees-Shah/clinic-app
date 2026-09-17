import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["confirmed", "completed", "cancelled", "no_show"]).optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
  lateCancelFee: z.boolean().optional(),
  noShowFee: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.parse(body);
    // NOTE: `tags` is a UI-only field (no column in Appointment model).
    // Strip it before the Prisma update — passing it caused
    // "Unknown argument `tags`" -> 500 "Failed to update appointment".
    const { tags: _tags, ...data } = parsed;

    const appointment = await prisma.appointment.update({
      where: { id },
      data,
      include: {
        service: true,
        provider: true,
      },
    });

    // Trigger SSE broadcast
    await fetch(`${process.env.NEXTAUTH_URL}/api/inngest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "appointment.updated",
        data: { appointmentId: appointment.id },
      }),
    }).catch(() => {});

    return NextResponse.json({ appointment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", message: error.errors.map((e) => e.message).join(", ") }, { status: 400 });
    }
    console.error("Failed to update appointment:", error);
    return NextResponse.json({ error: "Failed to update appointment", message: "Failed to update appointment" }, { status: 500 });
  }
}