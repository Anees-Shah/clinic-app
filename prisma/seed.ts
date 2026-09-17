import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg(connectionString);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Create admin user
  const passwordHash = await bcrypt.hash("changeme123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@clinic.local" },
    update: {},
    create: {
      email: "admin@clinic.local",
      passwordHash,
      role: "admin",
    },
  });
  console.log("✅ Admin user created:", admin.email);

  // Create providers
  const drSmith = await prisma.provider.upsert({
    where: { id: "provider-dr-smith" },
    update: {},
    create: {
      id: "provider-dr-smith",
      name: "Dr. Sarah Smith",
      title: "Medical Director, Aesthetic Medicine",
      photoUrl: "/providers/dr-smith.jpg",
      bio: "Dr. Smith has over 15 years of experience in aesthetic medicine. She is a member of the British College of Aesthetic Medicine (BCAM) and the Royal College of Surgeons.",
      qualifications: ["MBBS", "MRCS", "BCAM Member", "Level 7 Aesthetic Medicine"],
      active: true,
    },
  });
  console.log("✅ Provider created:", drSmith.name);

  const drJones = await prisma.provider.upsert({
    where: { id: "provider-dr-jones" },
    update: {},
    create: {
      id: "provider-dr-jones",
      name: "Dr. James Jones",
      title: "Aesthetic Physician",
      photoUrl: "/providers/dr-jones.jpg",
      bio: "Dr. Jones specializes in non-surgical facial rejuvenation with a focus on natural-looking results. He holds a Level 7 Certificate in Injectables for Aesthetic Medicine.",
      qualifications: ["MBChB", "Level 7 Aesthetic Medicine", "GMC Registered"],
      active: true,
    },
  });
  console.log("✅ Provider created:", drJones.name);

  // Create services
  const botox = await prisma.service.upsert({
    where: { code: "botox" },
    update: {},
    create: {
      code: "botox",
      name: "Anti-Wrinkle Injections (Botox)",
      durationMin: 30,
      bufferBeforeMin: 10,
      bufferAfterMin: 10,
      price: 250.00,
      description: "Temporarily relaxes facial muscles to smooth lines and wrinkles. Results appear within 3-5 days and last 3-4 months.",
      active: true,
    },
  });
  console.log("✅ Service created:", botox.name);

  const filler = await prisma.service.upsert({
    where: { code: "filler" },
    update: {},
    create: {
      code: "filler",
      name: "Dermal Fillers",
      durationMin: 45,
      bufferBeforeMin: 15,
      bufferAfterMin: 15,
      price: 350.00,
      description: "Hyaluronic acid fillers restore volume and contour to the face. Immediate results lasting 9-18 months depending on area.",
      active: true,
    },
  });
  console.log("✅ Service created:", filler.name);

  const consultation = await prisma.service.upsert({
    where: { code: "consultation" },
    update: {},
    create: {
      code: "consultation",
      name: "Aesthetic Consultation",
      durationMin: 30,
      bufferBeforeMin: 5,
      bufferAfterMin: 5,
      price: 50.00,
      description: "Comprehensive facial assessment and treatment planning. Fee redeemable against any treatment booked on the day.",
      active: true,
    },
  });
  console.log("✅ Service created:", consultation.name);

  const profhilo = await prisma.service.upsert({
    where: { code: "profhilo" },
    update: {},
    create: {
      code: "profhilo",
      name: "Profhilo (Skin Remodelling)",
      durationMin: 30,
      bufferBeforeMin: 10,
      bufferAfterMin: 10,
      price: 300.00,
      description: "Injectable hyaluronic acid treatment that remodels skin laxity. Two sessions 4 weeks apart. Results last 6 months.",
      active: true,
    },
  });
  console.log("✅ Service created:", profhilo.name);

  // Assign providers to services (matrix)
  await prisma.serviceProvider.upsert({
    where: { serviceId_providerId: { serviceId: botox.id, providerId: drSmith.id } },
    update: {},
    create: { serviceId: botox.id, providerId: drSmith.id },
  });
  await prisma.serviceProvider.upsert({
    where: { serviceId_providerId: { serviceId: botox.id, providerId: drJones.id } },
    update: {},
    create: { serviceId: botox.id, providerId: drJones.id },
  });

  await prisma.serviceProvider.upsert({
    where: { serviceId_providerId: { serviceId: filler.id, providerId: drSmith.id } },
    update: {},
    create: { serviceId: filler.id, providerId: drSmith.id },
  });
  await prisma.serviceProvider.upsert({
    where: { serviceId_providerId: { serviceId: filler.id, providerId: drJones.id } },
    update: {},
    create: { serviceId: filler.id, providerId: drJones.id },
  });

  await prisma.serviceProvider.upsert({
    where: { serviceId_providerId: { serviceId: consultation.id, providerId: drSmith.id } },
    update: {},
    create: { serviceId: consultation.id, providerId: drSmith.id },
  });
  await prisma.serviceProvider.upsert({
    where: { serviceId_providerId: { serviceId: consultation.id, providerId: drJones.id } },
    update: {},
    create: { serviceId: consultation.id, providerId: drJones.id },
  });

  await prisma.serviceProvider.upsert({
    where: { serviceId_providerId: { serviceId: profhilo.id, providerId: drSmith.id } },
    update: {},
    create: { serviceId: profhilo.id, providerId: drSmith.id },
  });
  // Profhilo only by Dr Smith
  console.log("✅ Provider-Service matrix created");

  // Create default weekly schedules (Mon-Fri 9-18)
  const days = [1, 2, 3, 4, 5]; // Mon-Fri
  for (const dayOfWeek of days) {
    await prisma.availabilitySchedule.upsert({
      where: { id: `schedule-${drSmith.id}-${dayOfWeek}` },
      update: {},
      create: {
        id: `schedule-${drSmith.id}-${dayOfWeek}`,
        providerId: drSmith.id,
        dayOfWeek,
        startTime: "09:00",
        endTime: "18:00",
      },
    });
    await prisma.availabilitySchedule.upsert({
      where: { id: `schedule-${drJones.id}-${dayOfWeek}` },
      update: {},
      create: {
        id: `schedule-${drJones.id}-${dayOfWeek}`,
        providerId: drJones.id,
        dayOfWeek,
        startTime: "09:00",
        endTime: "18:00",
      },
    });
  }
  console.log("✅ Weekly schedules created (Mon-Fri 09:00-18:00)");

  // Create SMS settings (disabled by default)
  await prisma.smsSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", enabled: false },
  });
  console.log("✅ SMS settings created (disabled by default)");

  // Create some UK bank holidays 2026
  const holidays2026 = [
    { date: new Date("2026-01-01"), name: "New Year's Day" },
    { date: new Date("2026-04-03"), name: "Good Friday" },
    { date: new Date("2026-04-06"), name: "Easter Monday" },
    { date: new Date("2026-05-04"), name: "Early May Bank Holiday" },
    { date: new Date("2026-05-25"), name: "Spring Bank Holiday" },
    { date: new Date("2026-08-31"), name: "Summer Bank Holiday" },
    { date: new Date("2026-12-25"), name: "Christmas Day" },
    { date: new Date("2026-12-28"), name: "Boxing Day (observed)" },
  ];
  for (const h of holidays2026) {
    await prisma.holiday.upsert({
      where: { date: h.date },
      update: {},
      create: h,
    });
  }
  console.log("✅ UK Bank Holidays 2026 created");

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });