import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  sendConfirmation,
  sendCancellation,
  sendReschedule,
  sendReminder24h,
  sendReminder1h,
  scheduleReminders,
  syncCalendarEvent,
  cleanupExpiredTokens,
  promoteWaitlist,
} from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendConfirmation,
    sendCancellation,
    sendReschedule,
    sendReminder24h,
    sendReminder1h,
    scheduleReminders,
    syncCalendarEvent,
    cleanupExpiredTokens,
    promoteWaitlist,
  ],
});