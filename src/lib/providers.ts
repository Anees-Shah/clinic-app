import { prisma } from "@/lib/prisma";

export interface Provider {
  id: string;
  name: string;
  title: string;
  photoUrl: string | null;
  bio: string | null;
  qualifications: string[];
  active: boolean;
}

/**
 * Get all active providers
 */
export async function getProviders(): Promise<Provider[]> {
  try {
    return await prisma.provider.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        title: true,
        photoUrl: true,
        bio: true,
        qualifications: true,
        active: true,
      },
    });
  } catch (error) {
    console.error("[getProviders] Database unavailable, returning empty list:", error);
    return [];
  }
}

/**
 * Get a single provider by ID
 */
export async function getProviderById(id: string): Promise<Provider | null> {
  return prisma.provider.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      title: true,
      photoUrl: true,
      bio: true,
      qualifications: true,
      active: true,
    },
  });
}

export interface ProviderWithServices extends Provider {
  services: Array<{ id: string; code: string; name: string }>;
}

/**
 * Get ALL providers (including inactive) with assigned services — admin use.
 */
export async function getAllProviders(): Promise<ProviderWithServices[]> {
  try {
    const providers = await prisma.provider.findMany({
      include: {
        services: { include: { service: true }, orderBy: { service: { name: "asc" } } },
      },
      orderBy: { name: "asc" },
    });
    return providers.map((p) => ({
      id: p.id,
      name: p.name,
      title: p.title,
      photoUrl: p.photoUrl,
      bio: p.bio,
      qualifications: p.qualifications,
      active: p.active,
      services: p.services.map((sp) => ({
        id: sp.service.id,
        code: sp.service.code,
        name: sp.service.name,
      })),
    }));
  } catch (error) {
    console.error("[getAllProviders] Database unavailable, returning empty list:", error);
    return [];
  }
}

/**
 * Get providers for a specific service
 */export async function getProvidersForService(serviceId: string): Promise<Provider[]> {
  const serviceProviders = await prisma.serviceProvider.findMany({
    where: {
      serviceId,
      provider: { active: true },
    },
    include: { provider: true },
    orderBy: { provider: { name: "asc" } },
  });

  return serviceProviders.map((sp) => ({
    id: sp.provider.id,
    name: sp.provider.name,
    title: sp.provider.title,
    photoUrl: sp.provider.photoUrl,
    bio: sp.provider.bio,
    qualifications: sp.provider.qualifications,
    active: sp.provider.active,
  }));
}