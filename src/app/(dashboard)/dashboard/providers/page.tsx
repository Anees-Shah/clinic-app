import { auth } from "@/auth";
import { getAllProviders } from "@/lib/providers";
import { prisma } from "@/lib/prisma";
import { ProvidersClient } from "./ProvidersClient";

export default async function ProvidersPage() {
  const session = await auth();
  if (!session) {
    return null; // Will be redirected by middleware
  }

  const [providers, services] = await Promise.all([
    getAllProviders(),
    prisma.service
      .findMany({ select: { id: true, code: true, name: true }, orderBy: { name: "asc" } })
      .catch(() => []),
  ]);

  return <ProvidersClient providers={providers} services={services} />;
}
