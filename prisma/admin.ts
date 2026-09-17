/**
 * One-off PRODUCTION admin bootstrap.
 * Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed:admin
 * Upserts a single admin user. Reads credentials ONLY from env vars —
 * never hardcode or commit them. Delete the password from your shell
 * history / .env afterwards and rotate via dashboard sessions (re-run works).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL ?? "";
const password = process.env.ADMIN_PASSWORD ?? "";

if (!connectionString) throw new Error("DATABASE_URL is not set");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("ADMIN_EMAIL must be a valid email address");
}
if (password.length < 12) {
  throw new Error("ADMIN_PASSWORD must be at least 12 characters");
}

const adapter = new PrismaPg(connectionString);
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "admin" },
    create: { email, passwordHash, role: "admin" },
  });
  // Never print the password.
  console.log(`Admin ready: ${admin.email} (id ${admin.id.slice(0, 8)}…)`);
}

main()
  .catch((e) => {
    console.error("Admin bootstrap failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
