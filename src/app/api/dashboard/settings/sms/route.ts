import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const smsSchema = z.object({
  enabled: z.boolean(),
});

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.smsSettings.findUnique({
    where: { id: "singleton" },
  });

  return NextResponse.json({ enabled: settings?.enabled || false });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = smsSchema.parse(body);

    const settings = await prisma.smsSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", enabled: data.enabled },
      update: { enabled: data.enabled },
    });

    return NextResponse.json({ enabled: settings.enabled });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Failed to update SMS settings:", error);
    return NextResponse.json({ error: "Failed to update SMS settings" }, { status: 500 });
  }
}
