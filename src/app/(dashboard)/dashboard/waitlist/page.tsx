import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProviders } from "@/lib/providers";
import { getServices } from "@/lib/services";
import { WaitlistClient } from "./WaitlistClient";

export default async function WaitlistPage() {
  const session = await auth();
  if (!session) {
    return null;
  }

  const [providers, services] = await Promise.all([
    getProviders(),
    getServices(),
  ]);

  return <WaitlistClient providers={providers} services={services} />;
}
