import { prisma } from "@/lib/prisma";

export interface ServiceWithProviders {
  id: string;
  code: string;
  name: string;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  price: number;
  description: string | null;
  active: boolean;
  providers: Array<{
    id: string;
    name: string;
    title: string;
    photoUrl: string | null;
    bio: string | null;
    qualifications: string[];
  }>;
}

/**
 * Get all active services with their assigned providers
 * Cached for 60 seconds via Next.js fetch cache
 */
export async function getServices(): Promise<ServiceWithProviders[]> {
  try {
    const services = await prisma.service.findMany({
      where: { active: true },
      include: {
        providers: {
          where: { provider: { active: true } },
          include: { provider: true },
          orderBy: { provider: { name: "asc" } },
        },
      },
      orderBy: { name: "asc" },
    });

  return services.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    durationMin: s.durationMin,
    bufferBeforeMin: s.bufferBeforeMin,
    bufferAfterMin: s.bufferAfterMin,
    price: Number(s.price),
    description: s.description,
    active: s.active,
    providers: s.providers.map((sp) => ({
      id: sp.provider.id,
      name: sp.provider.name,
      title: sp.provider.title,
      photoUrl: sp.provider.photoUrl,
      bio: sp.provider.bio,
      qualifications: sp.provider.qualifications,
    })),
  }));
  } catch (error) {
    console.error("[getServices] Database unavailable, returning empty list:", error);
    return [];
  }
}

/**
 * Get a single service by code with providers
 */
export async function getServiceByCode(code: string): Promise<ServiceWithProviders | null> {
  const service = await prisma.service.findUnique({
    where: { code },
    include: {
      providers: {
        where: { provider: { active: true } },
        include: { provider: true },
        orderBy: { provider: { name: "asc" } },
      },
    },
  });

  if (!service) return null;

  return {
    id: service.id,
    code: service.code,
    name: service.name,
    durationMin: service.durationMin,
    bufferBeforeMin: service.bufferBeforeMin,
    bufferAfterMin: service.bufferAfterMin,
    price: Number(service.price),
    description: service.description,
    active: service.active,
    providers: service.providers.map((sp) => ({
      id: sp.provider.id,
      name: sp.provider.name,
      title: sp.provider.title,
      photoUrl: sp.provider.photoUrl,
      bio: sp.provider.bio,
      qualifications: sp.provider.qualifications,
    })),
  };
}

/**
 * Get all active providers
 */
export async function getProviders() {
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
      },
    });
  } catch (error) {
    console.error("[getProviders] Database unavailable, returning empty list:", error);
    return [];
  }
}