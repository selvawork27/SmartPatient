import { portalApiBaseUrl } from "@/lib/config";
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
  retryOnUnauthorized?: boolean;
};

type PortalPatient = {
  id: string;
  hmsPatientId?: string;
  hms_patient_id?: string;
  mobile?: string;
  email?: string;
  languagePref?: string;
  language_pref?: string;
  hmsProfileJson?: Record<string, unknown>;
  hms_profile_json?: Record<string, unknown>;
};

type PortalAppointment = {
  id: string;
  hmsAppointmentId?: string;
  hms_appointment_id?: string;
  doctorId?: string;
  doctor_id?: string;
  slotId?: string;
  slot_id?: string;
  status?: string;
  cancellationReason?: string;
  cancellation_reason?: string;
  createdAt?: string;
  created_at?: string;
  [key: string]: unknown;
};

const storageKey = "smartpatient.session";
const placeholderValues = new Set(["na", "n/a", "none", "null", "undefined", "-"]);

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text && !placeholderValues.has(text.toLowerCase()) ? text : "";
}

function readSession(): LoginResult | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LoginResult;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function writeStoredSession(session: LoginResult) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("smartpatient.session", { detail: session }));
}

export function clearStoredSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
  window.dispatchEvent(new CustomEvent("smartpatient.session", { detail: null }));
}

function normalizeError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${portalApiBaseUrl}/${path.replace(/^\//, "")}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json().catch(() => null)) as HmsEnvelope<T> | T | null;

  if (response.status === 401 && options.token && options.retryOnUnauthorized !== false) {
    const refreshed = await refreshStoredSession().catch(() => null);
    if (refreshed?.token) {
      return request<T>(path, { ...options, token: refreshed.token, retryOnUnauthorized: false });
    }
    clearStoredSession();
  }

  if (!response.ok) {
    throw new Error(normalizeError(payload, `Portal API request failed with ${response.status}`));
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as HmsEnvelope<T>).data as T;
  }

  return payload as T;
}

async function refreshStoredSession() {
  const session = readSession();
  if (!session?.refresh_token) return null;
  const refreshed = await request<{ access_token: string; refresh_token: string; patient: PortalPatient }>("auth/refresh", {
    method: "POST",
    body: { refresh_token: session.refresh_token },
    retryOnUnauthorized: false,
  });
  const nextSession: LoginResult = {
    ...session,
    token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    user: {
      ...session.user,
      id: refreshed.patient.id,
      patient_id: refreshed.patient.id,
      patient_unique_id: refreshed.patient.hmsPatientId || refreshed.patient.hms_patient_id,
      email: refreshed.patient.email,
      phone: refreshed.patient.mobile,
    },
  };
  writeStoredSession(nextSession);
  return nextSession;
}

export async function requestPatientOtp(mobile: string, dob: string) {
  return request<{ message: string }>("auth/otp/request", {
    method: "POST",
    body: { mobile, dob },
  });
}

export async function verifyPatientOtp(mobile: string, dob: string, firebaseIdToken: string): Promise<LoginResult> {
  const result = await request<{ access_token: string; refresh_token: string; patient: PortalPatient }>("auth/otp/verify", {
    method: "POST",
    body: { mobile, dob, firebase_id_token: firebaseIdToken },
  });

  const patient = result.patient;
  const rawProfile = patient.hmsProfileJson || patient.hms_profile_json || {};
  const nameFromParts = [cleanText(rawProfile.first_name), cleanText(rawProfile.last_name)].filter(Boolean).join(" ");
  const fullName = cleanText(rawProfile.full_name) || nameFromParts || cleanText(rawProfile.name) || cleanText(patient.email) || cleanText(patient.mobile) || "Patient";
  return {
    token: result.access_token,
    refresh_token: result.refresh_token,
    role: "Patient",
    user: {
      id: patient.id,
      patient_id: patient.id,
      patient_unique_id: patient.hmsPatientId || patient.hms_patient_id,
      email: cleanText(patient.email) || cleanText(rawProfile.email) || undefined,
      phone: cleanText(patient.mobile) || cleanText(rawProfile.phone) || undefined,
      mobile: cleanText(patient.mobile) || cleanText(rawProfile.mobile) || undefined,
      first_name: cleanText(rawProfile.first_name) || undefined,
      last_name: cleanText(rawProfile.last_name) || undefined,
      full_name: fullName,
      gender: cleanText(rawProfile.gender) || undefined,
      raw: rawProfile,
    },
  };
}

export function getStoredSession() {
  return readSession();
}

export async function logoutPatient(token: string) {
  await request("auth/logout", { method: "POST", token });
}

export async function getProfile(_token: string) {
  const session = readSession();
  return {
    ...(session?.user.raw || {}),
    portal_patient_id: session?.user.patient_id,
    hms_patient_id: session?.user.patient_unique_id,
    full_name: session?.user.full_name,
    first_name: session?.user.first_name,
    last_name: session?.user.last_name,
    email: session?.user.email,
    mobile: session?.user.mobile || session?.user.phone,
    phone: session?.user.phone,
    gender: session?.user.gender,
  } satisfies HmsProfile;
}

export async function getPrescriptions(token: string) {
  return request<HmsPrescription[]>("records/prescriptions?status=all", { token });
}

export async function getAppointments(token: string) {
  const result = await request<[PortalAppointment[], number]>("appointments?page=1&limit=50", { token });
  return result[0] as HmsAppointment[];
}

export async function getBills(token: string) {
  return request<HmsBill[]>("billing/invoices?page=1&limit=50", { token });
}

export async function getDiagnosis(_token: string) {
  return [] satisfies HmsDiagnosis[];
}

export async function getDocuments(token: string) {
  return request<HmsDocument[]>("documents", { token });
}

export async function getConsultations(token: string) {
  return request<Record<string, unknown>[]>("records/consultations", { token });
}

function normalizeLab(raw: Record<string, unknown>, index: number): LabTest {
  return {
    id: Number(raw.id || index + 1),
    visit_no: String(raw.visit_no || raw.visitNo || ""),
    test_name: String(raw.test_name || raw.testName || raw.name || raw.investigation_name || "Lab result"),
    investigation_name: String(raw.investigation_name || raw.test_name || raw.name || "Lab result"),
    doctor_name: String(raw.doctor_name || raw.doctorName || ""),
    conduction_status: String(raw.status || raw.conduction_status || ""),
    signed_off_time: String(raw.signed_off_time || raw.date || raw.created_at || ""),
    parameters: Array.isArray(raw.parameters) ? (raw.parameters as LabTest["parameters"]) : [],
    raw_result: raw,
  };
}

export async function getLabTests(token: string) {
  const rows = await request<Record<string, unknown>[]>("records/labs?page=1&limit=50", { token });
  return rows.map(normalizeLab);
}

function normalizeInvoice(raw: Record<string, unknown>, index: number): PatientBill {
  const nested = [
    raw,
    raw.totals,
    raw.total,
    raw.summary,
    raw.bill,
  ].filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item));
  const pickNumber = (keys: string[]) => {
    for (const source of nested) {
      for (const key of keys) {
        const value = source[key];
        if (value !== null && value !== undefined && value !== "") {
          const number = Number(String(value).replace(/,/g, ""));
          if (Number.isFinite(number)) return number;
        }
      }
    }
    return undefined;
  };
  const items = Array.isArray(raw.items)
    ? (raw.items as PatientBill["items"])
    : Array.isArray(raw.bill_items)
      ? (raw.bill_items as PatientBill["items"])
      : Array.isArray(raw.billItems)
        ? (raw.billItems as PatientBill["items"])
        : [];
  const payments = Array.isArray(raw.payments)
    ? (raw.payments as PatientBill["payments"])
    : Array.isArray(raw.receipts)
      ? (raw.receipts as PatientBill["payments"])
      : [];
  const itemSum = items.reduce((sum, item) => sum + Number(String(item.amount || item.rate || 0).replace(/,/g, "")), 0);
  const paidSum = payments.reduce((sum, payment) => {
    const row = payment as Record<string, unknown>;
    return sum + Number(String(row.pay_amount || row.amount || 0).replace(/,/g, ""));
  }, 0);
  const gross = pickNumber(["gross", "gross_amount", "grossAmount", "sub_total", "subtotal", "total_amount", "totalAmount", "bill_amount", "amount"]) ?? itemSum;
  const discount = pickNumber(["discount", "discount_amount", "discountAmount", "total_discount"]) ?? 0;
  const paid = pickNumber(["paid", "paid_amount", "paidAmount", "amount_paid", "received_amount", "total_paid"]) ?? paidSum;
  const patientDue =
    pickNumber(["patient_due", "patientDue", "due", "due_amount", "dueAmount", "balance", "balance_due", "net_due"]) ??
    Math.max(gross - discount - paid, 0);
  const net = pickNumber(["net", "net_amount", "netAmount", "payable", "payable_amount", "total_payable"]) ?? Math.max(gross - discount, 0);
  return {
    id: Number(raw.id || index + 1),
    bill_no: String(raw.invoice_id || raw.invoiceId || raw.bill_no || raw.id || ""),
    open_date: String(raw.date || raw.created_at || raw.createdAt || ""),
    bill_status: String(raw.status || raw.bill_status || ""),
    payment_status: String(raw.payment_status || raw.status || ""),
    totals: { gross, discount, net, paid, patient_due: patientDue },
    items,
    payments,
    raw_bill: raw,
  };
}

export async function getPatientBilling(token: string) {
  const rows = await request<Record<string, unknown>[]>("billing/invoices?page=1&limit=50", { token });
  return rows.map(normalizeInvoice);
}

function normalizeAppointment(raw: PortalAppointment): PatientAppointment {
  const doctorId = String(raw.doctorId || raw.doctor_id || raw.consulting_doctor_id || "");
  const slotId = String(raw.slotId || raw.slot_id || raw.start_time || raw.appointment_time || "");
  const created = String(raw.createdAt || raw.created_at || raw.date || raw.appointment_date || raw.opd_date || "");
  const firstName = String(raw.doctor_first_name || "");
  const lastName = String(raw.doctor_last_name || "");
  const doctorName = String(raw.doctor_name || raw.consulting_doctor_name || [firstName, lastName].filter(Boolean).join(" ") || "");
  return {
    id: String(raw.id || raw.appointment_id || raw.visit_id || raw.hmsAppointmentId || raw.hms_appointment_id),
    visit_id: String(raw.visit_id || ""),
    visit_no: String(raw.visit_no || raw.patient_visit_no || raw.hmsAppointmentId || raw.hms_appointment_id || ""),
    doctor_id: doctorId,
    doctor_name: doctorName || (doctorId ? `Doctor ${doctorId}` : "Doctor not recorded"),
    department: String(raw.department || raw.department_name || raw.doctor_department || ""),
    consultation_type: String(raw.consultation_type || raw.visit_type || ""),
    date: created ? created.slice(0, 10) : undefined,
    start_time: String(raw.start_time || raw.appointment_time || slotId),
    end_time: String(raw.end_time || ""),
    display_time: String(raw.display_time || raw.appointment_time || slotId),
    status: String(raw.status || raw.visit_status || raw.appointment_status || "BOOKED"),
    notes: String(raw.notes || raw.cancellationReason || raw.cancellation_reason || ""),
    complaint: String(raw.complaint || raw.problem || raw.description || ""),
  };
}

export async function getPatientAppointments(token: string) {
  const result = await request<[PortalAppointment[], number]>("appointments?page=1&limit=50", { token });
  return result[0].map(normalizeAppointment);
}

export async function getAppointmentDoctors(token: string) {
  const directDoctors = await request<Record<string, unknown>[]>("appointments/doctors", { token }).catch(() => []);
  if (directDoctors.length) {
    return directDoctors.map((doctor, index) => ({
      id: String(doctor.id || doctor.doctor_id || index),
      name: String(doctor.name || doctor.doctor_name || doctor.full_name || "Doctor"),
      department: String(doctor.department || doctor.department_name || ""),
      specialization: String(doctor.specialization || doctor.speciality || ""),
    }));
  }
  const appointments = await getPatientAppointments(token);
  const doctors = new Map<string, AppointmentDoctor>();
  for (const appointment of appointments) {
    if (!appointment.doctor_id) continue;
    doctors.set(appointment.doctor_id, {
      id: appointment.doctor_id,
      name: appointment.doctor_name || `Doctor ${appointment.doctor_id}`,
    });
  }
  return Array.from(doctors.values());
}

function dayLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

export async function getAppointmentSlots(token: string, doctorId: string, startDate: string, endDate: string) {
  const days: AppointmentSlotDay[] = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    const params = new URLSearchParams({ doctor_id: doctorId, date });
    const slots = await request<{ slot_id: string; time: string; available: boolean }[]>(`appointments/slots?${params.toString()}`, { token });
    days.push({
      date,
      label: dayLabel(date),
      slots: slots
        .filter((slot) => slot.available)
        .map((slot) => ({
          slot_id: slot.slot_id,
          start: slot.slot_id,
          end: slot.slot_id,
          time: slot.time,
        })),
    });
  }
  return days;
}

export async function bookPatientAppointment(
  token: string,
  input: {
    doctor_id: string;
    slot_id?: string;
    start_time: string;
    end_time: string;
    complaint?: string;
    notes?: string;
  },
) {
  const result = await request<PortalAppointment>("appointments", {
    method: "POST",
    token,
    body: {
      doctor_id: input.doctor_id,
      slot_id: input.slot_id || input.start_time,
      notes: [input.complaint, input.notes].filter(Boolean).join("\n"),
    },
  });
  return {
    appointment_id: result.id,
    visit_no: result.hmsAppointmentId || result.hms_appointment_id || result.id,
  } satisfies AppointmentBookingResult;
}

export async function cancelPatientAppointment(token: string, appointmentId: string) {
  return request<{ id: string; status: string }>(`appointments/${appointmentId}`, {
    method: "DELETE",
    token,
    body: { reason: "Cancelled by patient" },
  });
}
