import type { Provider } from "@/lib/providers";

export interface Appointment {
  id: string;
  providerId: string;
  serviceId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  startsAt: string;
  endsAt: string;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  lateCancelFee: boolean;
  noShowFee: boolean;
  service: {
    id: string;
    name: string;
    durationMin: number;
    bufferBeforeMin: number;
    bufferAfterMin: number;
    price: number;
  };
  provider: {
    id: string;
    name: string;
    title: string;
  };
}

export interface DashboardClientProps {
  providers: Provider[];
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  isRecurring: boolean;
}