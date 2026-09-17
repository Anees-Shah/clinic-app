import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public liveness probe for deploy verification (Vercel checks, owner testing).
 * Returns 200 with { ok, db } — db:false means the app is up but unreachable
 * from the database (wrong DATABASE_URL, paused Neon compute, firewall).
 * Contains no sensitive data; safe to leave unauthenticated.
 */
export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch (e) {
    console.error("[health] DB ping failed:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({
    ok: true,
    db,
    time: new Date().toISOString(),
    version: process.env.npm_package_version ?? "0.1.0",
  });
}
