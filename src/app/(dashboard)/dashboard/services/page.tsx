import { auth } from "@/auth";
import { getServices } from "@/lib/services";
import { getProviders } from "@/lib/providers";
import { ServicesClient } from "./ServicesClient";

export default async function ServicesPage() {
  const session = await auth();
  if (!session) {
    return null; // Will be redirected by middleware
  }

  const [services, providers] = await Promise.all([
    getServices(),
    getProviders(),
  ]);

  return <ServicesClient services={services} providers={providers} />;
}
