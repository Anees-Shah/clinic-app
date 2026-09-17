-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE "ReminderType" AS ENUM ('confirmation', 'reminder_24h', 'reminder_1h', 'cancellation', 'reschedule');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "photoUrl" TEXT,
    "bio" TEXT,
    "qualifications" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "bufferBeforeMin" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMin" INTEGER NOT NULL DEFAULT 0,
    "price" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceProvider" (
    "serviceId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    CONSTRAINT "ServiceProvider_pkey" PRIMARY KEY ("serviceId", "providerId")
);

-- CreateTable
CREATE TABLE "AvailabilitySchedule" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    CONSTRAINT "AvailabilitySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityOverride" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AvailabilityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientEmail" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'confirmed',
    "notes" TEXT,
    "lateCancelFee" BOOLEAN NOT NULL DEFAULT false,
    "noShowFee" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT,
    "cancelToken" TEXT,
    "rescheduleToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientEmail" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "requestedDate" DATE NOT NULL,
    "position" INTEGER NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerMessageId" TEXT,
    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsSettings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SmsSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Service_code_key" ON "Service"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilitySchedule_providerId_dayOfWeek_startTime_endTime_key" ON "AvailabilitySchedule"("providerId", "dayOfWeek", "startTime", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityOverride_providerId_date_startTime_endTime_key" ON "AvailabilityOverride"("providerId", "date", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "Appointment_providerId_startsAt_idx" ON "Appointment"("providerId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_patientEmail_idx" ON "Appointment"("patientEmail");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_idempotencyKey_key" ON "Appointment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_cancelToken_key" ON "Appointment"("cancelToken");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_rescheduleToken_key" ON "Appointment"("rescheduleToken");

-- CreateIndex
CREATE INDEX "WaitlistEntry_providerId_requestedDate_idx" ON "WaitlistEntry"("providerId", "requestedDate");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_claimToken_key" ON "WaitlistEntry"("claimToken");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderLog_appointmentId_type_key" ON "ReminderLog"("appointmentId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- AddForeignKey
ALTER TABLE "ServiceProvider" ADD CONSTRAINT "ServiceProvider_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProvider" ADD CONSTRAINT "ServiceProvider_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySchedule" ADD CONSTRAINT "AvailabilitySchedule_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityOverride" ADD CONSTRAINT "AvailabilityOverride_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;