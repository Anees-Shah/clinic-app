import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const serviceSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  durationMin: z.coerce.number().int().min(15).max(480),
  bufferBeforeMin: z.coerce.number().int().min(0).max(120).default(0),
  bufferAfterMin: z.coerce.number().int().min(0).max(120).default(0),
  price: z.coerce.number().min(0),
  description: z.string().optional(),
  active: z.boolean().default(true),
  providerIds: z.array(z.string()).default([]),
});

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const services = await prisma.service.findMany({
    include: {
      providers: {
        include: { provider: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ services });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = serviceSchema.parse(body);

    // Check if code already exists
    const existing = await prisma.service.findUnique({ where: { code: data.code.toUpperCase() } });
    if (existing) {
      return NextResponse.json({ error: "Service code already exists" }, { status: 400 });
    }

    const service = await prisma.service.create({
      data: {
        code: data.code.toUpperCase(),
        name: data.name,
        durationMin: data.durationMin,
        bufferBeforeMin: data.bufferBeforeMin,
        bufferAfterMin: data.bufferAfterMin,
        price: data.price,
        description: data.description,
        active: data.active,
        providers: {
          create: data.providerIds.map((providerId) => ({ providerId })),
        },
      },
      include: {
        providers: { include: { provider: true } },
      },
    });

    return NextResponse.json({
      service: {
        ...service,
        price: Number(service.price),
        providers: service.providers.map((sp) => sp.provider),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Failed to create service:", error);
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
}
