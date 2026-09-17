import { getServiceByCode } from "@/lib/services";
import { getProviderById } from "@/lib/providers";
import { notFound } from "next/navigation";
import { ClaimForm } from "./ClaimForm";

interface Props {
  searchParams: Promise<{
    service?: string;
    provider?: string;
    date?: string;
    claim?: string;
  }>;
}

export default async function ClaimPage({ searchParams }: Props) {
  const { service: serviceCode, provider: providerId, date: dateParam, claim: claimToken } = await searchParams;

  if (!serviceCode || !providerId || !dateParam || !claimToken) {
    notFound();
  }

  const service = await getServiceByCode(serviceCode);
  const provider = await getProviderById(providerId);

  if (!service || !provider) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container py-12 md:py-20">
        <div className="max-w-md mx-auto">
          <ClaimForm
            service={service}
            provider={provider}
            date={dateParam}
            claimToken={claimToken}
          />
        </div>
      </div>
    </main>
  );
}