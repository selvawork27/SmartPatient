import { asText, nestedText, pickText } from "@/lib/format";
import type { ConsultationStatus, ConsultationSummary } from "@/types/hms";

function normalizeStatus(status: unknown): ConsultationStatus {
  const text = String(status || "").toLowerCase();
  if (text.includes("active") || text.includes("open")) return "active";
  if (text.includes("closed") || text.includes("complete")) return "closed";
  if (text.includes("partial")) return "partial";
  if (text.includes("pending") || text.includes("booked")) return "pending";
  return "unknown";
}

function doctorFrom(record: Record<string, unknown>) {
  const direct = pickText(record, ["doctor_name", "doctorName", "consulting_doctor_name", "doctor"], "");
  if (direct) return direct;
  const doctorUser = nestedText(record, ["doctor", "doctor_user", "full_name"], "");
  if (doctorUser) return doctorUser;
  return nestedText(record, ["doctor", "doctorUser", "full_name"], "Doctor not recorded");
}

export function consultationFromRecord(record: Record<string, unknown>, index: number): ConsultationSummary {
  const date = pickText(record, ["consultation_date", "date", "prescription_date", "appointment_date"], "");
  const time = pickText(record, ["consultation_time", "time", "prescription_time", "appointment_time"], "");
  const status = normalizeStatus(record.status || record.visit_status || record.consultation_status);
  const title = pickText(record, ["consultation_type", "title", "visit_type", "type"], "Consultation");

  return {
    id: asText(record.id, `consultation-${index}`),
    visitId: pickText(record, ["visit_id", "patient_visit_id"], ""),
    visitNo: pickText(record, ["patient_visit_no", "visit_no", "visit_number"], ""),
    title,
    doctorName: doctorFrom(record),
    department: pickText(record, ["department", "doctor_department", "department_name"], ""),
    patientName: pickText(record, ["patient_name"], ""),
    patientMrn: pickText(record, ["patient_unique_id"], ""),
    visitType: pickText(record, ["visit_type"], ""),
    date,
    time,
    status,
    source: "consultation",
    complaints: pickText(record, ["complaints", "chief_complaints", "presenting_complaint"], ""),
    diagnosis: pickText(record, ["diagnosis", "diagnosis_name", "diagnose"], ""),
    prescription: pickText(record, ["prescription", "medicine_name", "medicines"], ""),
    instructions: pickText(record, ["instructions", "patient_instruction", "remarks"], ""),
    medicines: Array.isArray(record.medicines) ? (record.medicines as Record<string, unknown>[]) : [],
    investigations: Array.isArray(record.investigations) ? (record.investigations as Record<string, unknown>[]) : [],
    services: Array.isArray(record.services) ? (record.services as Record<string, unknown>[]) : [],
    diagnoses: Array.isArray(record.diagnoses) ? (record.diagnoses as Record<string, unknown>[]) : [],
    nonHospitalPrescriptions: Array.isArray(record.non_hospital_prescriptions)
      ? (record.non_hospital_prescriptions as Record<string, unknown>[])
      : [],
    sections:
      record.sections && typeof record.sections === "object" && !Array.isArray(record.sections)
        ? (record.sections as Record<string, Record<string, unknown>[]>)
        : {},
    raw: record,
  };
}

export function consultationFromPrescription(record: Record<string, unknown>, index: number): ConsultationSummary {
  const date = pickText(record, ["prescription_date", "date", "created_at"], "");
  const time = pickText(record, ["prescription_time", "time"], "");

  return {
    id: `prescription-${asText(record.id, String(index))}`,
    visitId: pickText(record, ["visit_id", "patient_visit_id"], ""),
    visitNo: pickText(record, ["patient_visit_no", "visit_no"], ""),
    title: "Prescription consultation",
    doctorName: doctorFrom(record),
    date,
    time,
    status: "closed",
    source: "prescription",
    diagnosis: pickText(record, ["diagnosis", "disease", "problem_name"], ""),
    prescription: pickText(record, ["prescription_name", "medicine_name", "name"], "Prescription available"),
    instructions: pickText(record, ["instructions", "notes", "description"], ""),
    raw: record,
  };
}

export function consultationFromAppointment(record: Record<string, unknown>, index: number): ConsultationSummary {
  const date = pickText(record, ["opd_date", "appointment_date", "date"], "");
  const time = pickText(record, ["appointment_time", "time"], "");

  return {
    id: `appointment-${asText(record.id, String(index))}`,
    title: pickText(record, ["problem", "description", "department_name"], "Appointment"),
    doctorName: doctorFrom(record),
    department: pickText(record, ["department", "department_name"], ""),
    date,
    time,
    status: normalizeStatus(record.status || record.is_completed),
    source: "appointment",
    complaints: pickText(record, ["problem", "description"], ""),
    raw: record,
  };
}

export function consultationFromDiagnosis(record: Record<string, unknown>, index: number): ConsultationSummary {
  const date = pickText(record, ["report_date", "date", "created_at"], "");

  return {
    id: `diagnosis-${asText(record.id, String(index))}`,
    title: "Diagnostic consultation",
    doctorName: doctorFrom(record),
    date,
    status: "closed",
    source: "diagnosis",
    diagnosis: pickText(record, ["test_name", "diagnosis_name", "name"], "Diagnostic record available"),
    instructions: pickText(record, ["description", "remarks", "result"], ""),
    raw: record,
  };
}
