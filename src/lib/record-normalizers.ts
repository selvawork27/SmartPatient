import { asText, nestedText, pickText } from "@/lib/format";
import type {
  ConsultationSummary,
  DischargeSummary,
  HmsDocument,
  HmsPrescription,
  PatientBill,
  PatientUser,
  PrescriptionHistoryItem,
} from "@/types/hms";

function textArray(value: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string" || typeof item === "number") return String(item);
        if (item && typeof item === "object") {
          return pickText(item as Record<string, unknown>, ["name", "description", "procedure_name", "medicine_name", "medication_name"], "");
        }
        return "";
      })
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function statusFromPrescription(record: Record<string, unknown>): PrescriptionHistoryItem["dispensingStatus"] {
  const raw = pickText(record, ["dispensing_status", "dispense_status", "status", "pharmacy_status"], "Pending").toLowerCase();
  if (raw.includes("expired")) return "Expired";
  if (raw.includes("dispensed") || raw.includes("issued") || raw.includes("completed")) return "Dispensed";
  return "Pending";
}

function activeFromPrescription(record: Record<string, unknown>, status: PrescriptionHistoryItem["dispensingStatus"]) {
  const explicit = record.is_active ?? record.active;
  if (typeof explicit === "boolean") return explicit;
  if (typeof explicit === "number") return explicit === 1;
  if (typeof explicit === "string") return ["1", "true", "yes", "active"].includes(explicit.toLowerCase());

  const endDate = pickText(record, ["end_date", "stop_date", "valid_till", "expiry_date"], "");
  if (endDate) {
    const parsed = new Date(endDate);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime() >= Date.now();
  }

  return status !== "Expired";
}

function isMedicineRecord(record: Record<string, unknown>) {
  const medicineFields = [
    "medicine_id",
    "medicine_name",
    "medication_name",
    "drug_name",
    "generic_name",
    "brand_name",
    "medicine",
    "medication",
  ];
  if (medicineFields.some((field) => record[field] !== undefined && record[field] !== null && record[field] !== "")) return true;

  const type = pickText(record, ["type", "item_type", "prescription_type", "order_type"], "").toLowerCase();
  return type.includes("medicine") || type.includes("medication") || type.includes("pharmacy");
}

function prescriptionMedicineRecords(prescriptions: HmsPrescription[]) {
  return prescriptions.flatMap((record, recordIndex) => {
    const nested = record.medicines || record.medications || record.visit_medicine_prescriptions || record.items;

    if (Array.isArray(nested)) {
      return nested
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
        .filter(isMedicineRecord)
        .map((item, itemIndex) => ({
          ...record,
          ...item,
          id: item.id ?? record.id ?? `prescription-${recordIndex}-${itemIndex}`,
          visit_id: item.visit_id ?? item.patient_visit_id ?? record.visit_id ?? record.patient_visit_id,
          visit_no: item.visit_no ?? item.patient_visit_no ?? record.visit_no ?? record.patient_visit_no,
          doctor_name: item.doctor_name ?? record.doctor_name,
          prescription_date: item.prescription_date ?? record.prescription_date ?? record.date,
        }));
    }

    return isMedicineRecord(record) ? [record] : [];
  });
}

function joinValues(...values: unknown[]) {
  return values
    .map((value) => asText(value, "").trim())
    .filter(Boolean)
    .join(" ");
}

function medicineDose(record: Record<string, unknown>) {
  const direct = pickText(record, ["dose"], "");
  if (direct) return direct;

  return joinValues(
    pickText(record, ["dosage", "strength"], ""),
    nestedText(record, ["dosageunit", "dosage_unit"], ""),
    nestedText(record, ["dosage_unit", "dosage_unit"], ""),
  );
}

function medicineFrequency(record: Record<string, unknown>) {
  return (
    pickText(record, ["frequency_name", "medicine_frequency", "timing"], "") ||
    nestedText(record, ["frequencyunit", "name"], "") ||
    nestedText(record, ["frequency_unit", "name"], "") ||
    pickText(record, ["frequency"], "")
  );
}

function medicineDuration(record: Record<string, unknown>) {
  const direct = pickText(record, ["duration_text"], "");
  if (direct) return direct;

  return joinValues(
    pickText(record, ["duration", "no_of_days", "days"], ""),
    nestedText(record, ["durationunit", "duration"], ""),
    nestedText(record, ["duration_unit", "duration"], ""),
  );
}

export function hasRecordAccess(profile: Record<string, unknown> | undefined, user?: PatientUser | null) {
  const source: Record<string, unknown> = { ...(profile || {}), ...(user || {}) };
  const registered = source.registration_completed ?? source.is_registered ?? source.isRegistrationComplete ?? source.registration_status;
  const consented =
    source.consented_record_access ?? source.record_access_consent ?? source.has_consented ?? source.hasConsented ?? source.consent;

  const registrationOk =
    registered === undefined ||
    registered === true ||
    registered === 1 ||
    String(registered).toLowerCase() === "completed" ||
    String(registered).toLowerCase() === "registered" ||
    String(registered).toLowerCase() === "true";

  const consentOk =
    consented === undefined ||
    consented === true ||
    consented === 1 ||
    String(consented).toLowerCase() === "yes" ||
    String(consented).toLowerCase() === "true" ||
    String(consented).toLowerCase() === "consented";

  return registrationOk && consentOk;
}

export function normalizeDischargeSummaries(documents: HmsDocument[]) {
  return documents
    .filter((document) => {
      const haystack = [
        document.type,
        document.document_type,
        document.category,
        document.title,
        document.name,
        document.file_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes("discharge");
    })
    .map((document, index): DischargeSummary => {
      const diagnosisDescription =
        pickText(document, ["primary_diagnosis_description", "diagnosis_description", "primary_diagnosis", "diagnosis"], "") ||
        nestedText(document, ["primary_diagnosis", "description"], "");

      return {
        id: asText(document.id, `discharge-${index}`),
        admissionDate: pickText(document, ["admission_date", "admitted_at", "admission_datetime"], ""),
        dischargeDate: pickText(document, ["discharge_date", "discharged_at", "discharge_datetime"], ""),
        primaryDiagnosisCode:
          pickText(document, ["primary_diagnosis_code", "icd10_code", "icd_code"], "") ||
          nestedText(document, ["primary_diagnosis", "icd10_code"], ""),
        primaryDiagnosisDescription: diagnosisDescription,
        procedures: textArray(document.procedures || document.procedure || document.operations),
        medications: textArray(document.medications || document.discharge_medications || document.medicines),
        followUpInstructions: pickText(document, ["follow_up_instructions", "followup_instructions", "instructions", "advice"], ""),
        attendingDoctor: pickText(document, ["attending_doctor", "doctor_name", "consultant_name", "signed_by"], ""),
        pdfUrl: pickText(document, ["pdf_url", "file_url", "document_url", "url", "path"], ""),
        signed: Boolean(document.signed || document.signed_at || document.signed_by),
        raw: document,
      };
    });
}

export function normalizePrescriptionHistory(prescriptions: HmsPrescription[]) {
  return prescriptionMedicineRecords(prescriptions).map((record, index): PrescriptionHistoryItem => {
    const genericName = pickText(record, ["generic_name", "generic", "medicine_generic_name"], "");
    const brandName = pickText(record, ["brand_name", "brand", "medicine_brand_name", "trade_name"], "");
    const medicationName =
      pickText(record, ["medication_name", "medicine_name", "drug_name", "name"], "") ||
      nestedText(record, ["medicine", "name"], "") ||
      nestedText(record, ["medication", "name"], "");
    const status = statusFromPrescription(record);

    return {
      id: asText(record.id, `prescription-${index}`),
      visitId: pickText(record, ["visit_id", "patient_visit_id"], ""),
      visitNo: pickText(record, ["visit_no", "patient_visit_no", "visit_number"], ""),
      medicationName: medicationName || [genericName, brandName].filter(Boolean).join(" / ") || "Medication",
      genericName,
      brandName,
      dose: medicineDose(record),
      frequency: medicineFrequency(record),
      duration: medicineDuration(record),
      prescribedBy: pickText(record, ["prescribed_by", "doctor_name", "consulting_doctor_name", "created_by"], ""),
      date: pickText(record, ["prescription_date", "date", "created_at"], ""),
      dispensingStatus: status,
      isActive: activeFromPrescription(record, status),
      raw: record,
    };
  });
}

export function normalizeConsultationMedicinePrescriptions(consultations: ConsultationSummary[]) {
  return consultations.flatMap((consultation) =>
    (consultation.medicines || []).map((record, index): PrescriptionHistoryItem => {
      const medicationName =
        pickText(record, ["medication_name", "medicine_name", "drug_name", "name"], "") ||
        nestedText(record, ["medicine", "store_item", "name"], "") ||
        nestedText(record, ["medicine", "storeItem", "name"], "") ||
        "Medication";
      const status = statusFromPrescription(record);

      return {
        id: asText(record.id, `consultation-${consultation.id}-medicine-${index}`),
        visitId: pickText(record, ["visit_id", "patient_visit_id"], consultation.visitId || ""),
        visitNo: pickText(record, ["visit_no", "patient_visit_no", "patient_visit_number"], consultation.visitNo || ""),
        medicationName,
        genericName:
          pickText(record, ["generic_name", "generic"], "") ||
          nestedText(record, ["medicine", "store_item", "generic_name"], "") ||
          nestedText(record, ["medicine", "storeItem", "generic_name"], ""),
        brandName: pickText(record, ["brand_name", "brand", "trade_name"], ""),
        dose: medicineDose(record),
        frequency: medicineFrequency(record),
        duration: medicineDuration(record),
        prescribedBy: pickText(record, ["prescribed_by", "doctor_name"], consultation.doctorName),
        date: pickText(record, ["prescription_date", "date", "created_at"], consultation.date || ""),
        dispensingStatus: status,
        isActive: activeFromPrescription(record, status),
        raw: record,
      };
    }),
  );
}

function isBillingMedicineItem(item: Record<string, unknown>) {
  const type = pickText(item, ["bill_item_type", "charge_head", "item_type", "type"], "").toLowerCase();
  if (type.includes("medicine") || type.includes("medication") || type.includes("pharmacy")) return true;
  return Boolean(item.medicine);
}

export function normalizeBillingMedicinePrescriptions(bills: PatientBill[]) {
  return bills.flatMap((bill) =>
    bill.items
      .filter((item) => isBillingMedicineItem(item as Record<string, unknown>))
      .map((item, index): PrescriptionHistoryItem => {
        const raw = item as Record<string, unknown>;
        const medicationName = item.medicine || item.description || item.details || "Medicine";
        const billClosed = String(bill.bill_status || "").toLowerCase().includes("closed");
        const paymentPending = String(bill.payment_status || "").toLowerCase().includes("pending");

        return {
          id: asText(item.id, `bill-${bill.id}-medicine-${index}`),
          visitId: asText(bill.visit_id, ""),
          visitNo: bill.visit_no || "",
          medicationName,
          genericName: pickText(raw, ["generic_name", "generic"], ""),
          brandName: pickText(raw, ["brand_name", "brand"], ""),
          dose: medicineDose(raw),
          frequency: medicineFrequency(raw),
          duration: medicineDuration(raw),
          prescribedBy: bill.doctor_name || pickText(raw, ["prescribed_by", "doctor_name"], ""),
          date: bill.open_date || bill.open_date_time || "",
          dispensingStatus: billClosed && !paymentPending ? "Dispensed" : "Pending",
          isActive: !billClosed,
          raw: {
            ...raw,
            bill_id: bill.id,
            bill_no: bill.bill_no,
            visit_id: bill.visit_id,
            visit_no: bill.visit_no,
          },
        };
      }),
  );
}
