import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  durationMin: z.coerce.number().int().min(15).max(480).optional(),
  bufferBeforeMin: z.coerce.number().int().min(0).max(120).optional(),
  bufferAfterMin: z.coerce.number().int().min(0).max(120).optional(),
  price: z.coerce.number().min(0).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  providerIds: z.array(z.string()).optional(),
});

// Flatten the Prisma join shape (providers: [{ provider }]) into the
// ServiceWithProviders shape the client table expects
// (providers: [{ id, name, ... }], price as number), so keys never go
// undefined and edits keep working after a save.
function toClientService(svc: {
  id: string;
  code: string;
  name: string;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  price: unknown;
  description: string | null;
  active: boolean;
  providers: Array<{ provider: { id: string; name: string; title: string; photoUrl: string | null; bio: string | null; qualifications: string[] } }>;
}) {
  return {
    ...svc,
    price: Number(svc.price),
    providers: svc.providers.map((sp) => sp.provider),
  };
}

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
    const data = updateSchema.parse(body);

    const { providerIds, ...serviceData } = data;

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...serviceData,
        ...(providerIds !== undefined && {
          providers: {
            deleteMany: {},
            create: providerIds.map((providerId) => ({ providerId })),
          },
        }),
      },
      include: {
        providers: { include: { provider: true } },
      },
    });

    return NextResponse.json({ service: toClientService(service) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Failed to update service:", error);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Check if service has appointments
    const appointmentCount = await prisma.appointment.count({ where: { serviceId: id } });
    if (appointmentCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete service with existing appointments" },
        { status: 400 }
      );
    }

    await prisma.service.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete service:", error);
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
  }
}