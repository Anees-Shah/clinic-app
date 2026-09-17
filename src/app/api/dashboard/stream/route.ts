import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const clients = new Map<string, ReadableStreamDefaultController<Uint8Array>>();
let clientIdCounter = 0;

function sendToAll(data: string) {
  const message = `data: ${data}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(message);

  clients.forEach((controller) => {
    try {
      controller.enqueue(encoded);
    } catch {
      // Client disconnected, will be cleaned up
    }
  });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const clientId = `${Date.now()}-${clientIdCounter++}`;
      clients.set(clientId, controller);

      // Send initial connection message
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "connected", clientId })}\n\n`));

      // Heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
          clients.delete(clientId);
        }
      }, 30000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        clients.delete(clientId);
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// Export function to broadcast events from Inngest/webhooks
export function broadcastAppointmentUpdate(type: "created" | "cancelled" | "moved" | "updated", appointmentId: string) {
  sendToAll(JSON.stringify({ type: "appointment_update", eventType: type, appointmentId }));
}
