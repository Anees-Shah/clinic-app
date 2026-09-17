import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { setDefaultAutoSelectFamily } from "node:net";

// The local network/VPN blackholes IPv6 to Neon while IPv4 works. Node's
// Happy Eyeballs (autoSelectFamily, on by default) races IPv6 first and the
// pg driver (v8) offers no per-connection family option, so connections fail
// with ETIMEDOUT. Disable the racing process-wide so plain IPv4 is used.
// No-op on runtimes without the API; harmless where IPv6 works.
try {
  setDefaultAutoSelectFamily(false);
} catch {
  // ignore — older Node or non-Node runtime
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Neon PgBouncer (pooled DATABASE_URL) closes idle connections; the default
// pg Pool keeps them open and the next write then fails with
// "Server has closed the connection" (seen on POST /api/dashboard/providers).
// Short idle timeout + keepalive + small pool keeps pooled connections fresh.
const adapter = new PrismaPg({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});
const prisma = globalForPrisma.prisma || new PrismaClient({
  adapter,
  log: ["error"],
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { prisma };
