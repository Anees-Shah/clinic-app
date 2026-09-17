import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProviders } from "@/lib/providers";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  const providers = await getProviders();

  return <DashboardClient providers={providers} />;
}