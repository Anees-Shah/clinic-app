import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { entryId } = await request.json();

    if (!entryId) {
      return NextResponse.json({ error: "Entry ID required" }, { status: 400 });
    }

    // Get the waitlist entry
    const entry = await prisma.waitlistEntry.findUnique({
      where: { id: entryId },
      include: { provider: true, service: true },
    });

    if (!entry) {
      return NextResponse.json({ error: "Waitlist entry not found" }, { status: 404 });
    }

    if (entry.claimedAt) {
      return NextResponse.json({ error: "Already claimed" }, { status: 400 });
    }

    // Generate claim token (30 min TTL)
    const claimToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Update waitlist entry
    await prisma.waitlistEntry.update({
      where: { id: entryId },
      data: {
        claimToken,
        expiresAt,
        notifiedAt: new Date(),
      },
    });

    // TODO: Send email with claim link
    // The claim link would be: /booking?service={code}&provider={id}&date={date}&claim={token}
    // For now, we'll just log it
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const claimLink = `${baseUrl}/booking?service=${entry.service.code}&provider=${entry.providerId}&date=${format(entry.requestedDate, "yyyy-MM-dd")}&claim=${claimToken}`;

    console.log(`[WAITLIST] Promote link for ${entry.patientEmail}: ${claimLink}`);

    // In production, send email via Inngest
    await fetch(`${process.env.NEXTAUTH_URL}/api/inngest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "waitlist.promoted",
        data: {
          entryId,
          patientEmail: entry.patientEmail,
          patientName: entry.patientName,
          claimLink,
        },
      }),
    }).catch(() => {});

    return NextResponse.json({ success: true, claimLink });
  } catch (error) {
    console.error("Failed to promote waitlist entry:", error);
    return NextResponse.json({ error: "Failed to promote" }, { status: 500 });
  }
}

function format(date: Date, fmt: string): string {
  // Simple format function
  const d = new Date(date);
  if (fmt === "yyyy-MM-dd") {
    return d.toISOString().split("T")[0];
  }
  return d.toISOString();
}
