import { appointmentAgentApiBaseUrl } from "@/lib/config";

export type PortalAssistantResult = {
  action: "book_appointment" | "answer" | "unknown";
  date?: string | null;
  doctor_name?: string | null;
  department?: string | null;
  reason?: string | null;
  reply: string;
};

type AppointmentIntentResponse = {
  success: boolean;
  transcription: string;
  data: PortalAssistantResult;
};

export async function parseAppointmentIntent(input: {
  message?: string;
  audio?: Blob;
  currentDate: string;
  context: Record<string, unknown>;
}) {
  const form = new FormData();
  form.append("current_date", input.currentDate);
  form.append("context", JSON.stringify(input.context));
  if (input.message) form.append("message", input.message);
  if (input.audio) form.append("audio", input.audio, "appointment-request.webm");

  const response = await fetch(`${appointmentAgentApiBaseUrl}/api/appointment-intent`, {
    method: "POST",
    body: form,
  });
  const payload = (await response.json().catch(() => null)) as AppointmentIntentResponse | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(payload && "detail" in payload && payload.detail ? payload.detail : "Unable to understand appointment request.");
  }
  return payload as AppointmentIntentResponse;
}
