import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(100).optional(),
  photoUrl: z.string().max(500).optional().or(z.literal("")).optional(),
  bio: z.string().max(2000).optional().or(z.literal("")).optional(),
  qualifications: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  serviceIds: z.array(z.string()).optional(),
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
    const data = updateSchema.parse(body);
    const { serviceIds, ...fields } = data;

    const normalized: Record<string, unknown> = { ...fields };
    if (typeof normalized.photoUrl === "string" && normalized.photoUrl === "") {
      normalized.photoUrl = null;
    }
    if (typeof normalized.bio === "string" && normalized.bio === "") {
      normalized.bio = null;
    }

    const provider = await prisma.$transaction(async (tx) => {
      if (serviceIds !== undefined) {
        await tx.serviceProvider.deleteMany({ where: { providerId: id } });
        if (serviceIds.length > 0) {
          await tx.serviceProvider.createMany({
            data: serviceIds.map((serviceId) => ({ serviceId, providerId: id })),
            skipDuplicates: true,
          });
        }
      }
      return tx.provider.update({
        where: { id },
        data: normalized as never,
        include: {
          services: { include: { service: true }, orderBy: { service: { name: "asc" } } },
        },
      });
    });

    return NextResponse.json({
      provider: {
        ...provider,
        services: provider.services.map((sp) => sp.service),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Failed to update provider:", error);
    return NextResponse.json({ error: "Failed to update staff member" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const upcoming = await prisma.appointment.count({
      where: { providerId: id, status: { in: ["confirmed", "completed"] } },
    });
    if (upcoming > 0) {
      return NextResponse.json(
        { error: "This staff member has appointments. Deactivate instead of deleting." },
        { status: 400 }
      );
    }
    await prisma.provider.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete provider:", error);
    return NextResponse.json({ error: "Failed to delete staff member" }, { status: 500 });
  }
}
