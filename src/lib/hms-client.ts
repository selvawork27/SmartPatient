import { consultationsPath, hmsApiBaseUrl } from "@/lib/config";
import type {
  AppointmentBookingResult,
  AppointmentDoctor,
  AppointmentSlotDay,
  HmsAppointment,
  HmsBill,
  HmsDiagnosis,
  HmsDocument,
  HmsEnvelope,
  HmsPrescription,
  HmsProfile,
  LabTest,
  LoginResult,
  PatientAppointment,
  PatientBill,
} from "@/types/hms";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
};

function normalizeError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${hmsApiBaseUrl}/${path.replace(/^\//, "")}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json().catch(() => null)) as HmsEnvelope<T> | T | null;

  if (!response.ok) {
    throw new Error(normalizeError(payload, `SmartHMS request failed with ${response.status}`));
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as HmsEnvelope<T>).data as T;
  }

  return payload as T;
}

export async function loginPatient(mobileNumber: string, dob: string): Promise<LoginResult> {
  const result = await request<LoginResult>("patient-login", {
    method: "POST",
    body: { mobile_number: mobileNumber, dob },
  });

  if (result.role !== "Patient") {
    throw new Error("This portal is for registered patient accounts only.");
  }

  return result;
}

export async function logoutPatient(token: string) {
  await request("logout", { method: "POST", token });
}

export async function getProfile(token: string) {
  return request<HmsProfile>("get-profile", { token });
}

export async function getPrescriptions(token: string) {
  return request<HmsPrescription[]>("patient-prescription", { token });
}

export async function getAppointments(token: string) {
  return request<HmsAppointment[]>("appointments", { token });
}

export async function getBills(token: string) {
  return request<HmsBill[]>("bills", { token });
}

export async function getDiagnosis(token: string) {
  return request<HmsDiagnosis[]>("diagnosis", { token });
}

export async function getDocuments(token: string) {
  return request<HmsDocument[]>("documents", { token });
}

export async function getConsultations(token: string) {
  if (!consultationsPath) return [];
  return request<Record<string, unknown>[]>(consultationsPath, { token });
}

export async function getLabTests(token: string) {
  return request<LabTest[]>("patient-lab-tests", { token });
}

export async function getPatientBilling(token: string) {
  return request<PatientBill[]>("patient-billing", { token });
}

export async function getAppointmentDoctors(token: string) {
  return request<AppointmentDoctor[]>("patient-appointment-doctors", { token });
}

export async function getPatientAppointments(token: string) {
  return request<PatientAppointment[]>("patient-appointments", { token });
}

export async function getAppointmentSlots(token: string, doctorId: number, startDate: string, endDate: string) {
  const params = new URLSearchParams({
    doctor_id: String(doctorId),
    start_date: startDate,
    end_date: endDate,
  });

  return request<AppointmentSlotDay[]>(`patient-appointment-slots?${params.toString()}`, { token });
}

export async function bookPatientAppointment(
  token: string,
  input: {
    doctor_id: number;
    start_time: string;
    end_time: string;
    complaint?: string;
    notes?: string;
  },
) {
  return request<AppointmentBookingResult>("patient-appointment-book", {
    method: "POST",
    token,
    body: input,
  });
}

export async function cancelPatientAppointment(token: string, appointmentId: number) {
  return request<{ appointment_id: number; status: string }>(`patient-appointment-cancel/${appointmentId}`, {
    method: "POST",
    token,
  });
}

export async function requestRepeatPrescription(token: string, prescriptionIds: string[]) {
  return request<{ request_id?: number | string; status?: string; message?: string }>("patient-repeat-prescription-request", {
    method: "POST",
    token,
    body: { prescription_ids: prescriptionIds },
  });
}
