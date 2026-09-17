import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) {
    return null;
  }

  const smsSettings = await prisma.smsSettings.findUnique({
    where: { id: "singleton" },
  });

  return <SettingsClient smsEnabled={smsSettings?.enabled || false} />;
}
