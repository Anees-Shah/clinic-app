import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await prisma.availabilityOverride.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete override:", error);
    return NextResponse.json(
      { error: "Failed to delete date override", message: "Failed to delete date override" },
      { status: 500 }
    );
  }
}
