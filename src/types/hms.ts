export type HmsEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

export type PatientUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  owner_id?: number;
  owner_type?: string;
  image_url?: string;
  patient_id?: number;
  patient_unique_id?: string;
};

export type LoginResult = {
  token: string;
  role: string;
  user: PatientUser;
};

export type HmsPrescription = Record<string, unknown>;
export type HmsAppointment = Record<string, unknown>;
export type HmsBill = Record<string, unknown>;
export type HmsDiagnosis = Record<string, unknown>;
export type HmsDocument = Record<string, unknown>;
export type HmsProfile = Record<string, unknown>;

export type LabParameter = {
  id?: number;
  name?: string;
  short_name?: string;
  value?: string | number | null;
  severity?: string | null;
  units?: string | null;
  methodology?: string | null;
  default_value?: string | null;
  data_allowed?: string | null;
  accession_no?: string | null;
  html?: string | null;
  study_url?: string | null;
  ranges?: Record<string, unknown>[];
};

export type LabTest = {
  id: number;
  visit_id?: number;
  visit_no?: string;
  sample_id?: string;
  test_name?: string;
  investigation_name?: string;
  doctor_name?: string;
  department_name?: string;
  consultation_type?: string;
  prescription_date?: string;
  prescription_time?: string;
  usage_type?: string;
  quantity?: number;
  instructions?: string;
  clinical_notes_conduction?: string;
  clinical_justification_prescription?: string;
  conduction_status?: string;
  test_type?: string;
  conduction_doctor?: string;
  signed_off_by?: string;
  signed_off_time?: string;
  study_url?: string;
  parameters: LabParameter[];
  raw_order?: Record<string, unknown>;
  raw_prescription?: Record<string, unknown>;
  raw_result?: Record<string, unknown>;
};

export type BillItem = {
  id?: number;
  order_no?: string;
  charge_head?: string;
  code?: string;
  description?: string;
  details?: string;
  rate?: number | string;
  quantity?: number | string;
  discount?: number | string;
  amount?: number | string;
  tax?: number | string;
  bill_item_type?: string;
  diagnostic_test?: string;
  medicine?: string;
  consultation_type?: string;
  service?: string;
  sponsor?: number | string;
  primary_claim_status?: string;
  primary_claim_reject_reason?: string;
  primary_claim_approved_amount?: number | string;
};

export type BillPayment = {
  id?: number;
  receipt_no?: string;
  payment_type?: string;
  payment_mode?: string;
  pay_amount?: number | string;
  payment_date?: string;
  paid_by?: string;
  narration?: string;
  remarks?: string;
  bank_name?: string;
  card_type?: string;
  user?: string;
};

export type PatientBill = {
  id: number;
  visit_id?: number;
  patient_id?: number;
  patient_name?: string;
  patient_unique_id?: string;
  visit_no?: string;
  bill_no?: string;
  open_date?: string;
  open_date_time?: string;
  bill_status?: string;
  payment_status?: string;
  primary_claim_no?: string;
  primary_claim_status?: string;
  primary_claim_approved_amount?: number | string;
  remarks?: string;
  cancel_reason?: string;
  reopen_reason?: string;
  created_by?: string;
  closed_by?: string;
  finalized_by?: string;
  discharge_date_time?: string;
  finalized_date_time?: string;
  doctor_name?: string;
  department_name?: string;
  consultation_type?: string;
  totals?: {
    gross?: number;
    discount?: number;
    net?: number;
    sponsor?: number;
    paid?: number;
    patient_due?: number;
  };
  items: BillItem[];
  payments: BillPayment[];
  raw_bill?: Record<string, unknown>;
};

export type AppointmentDoctor = {
  id: number;
  name?: string;
  department?: string;
  specialization?: string;
};

export type AppointmentSlot = {
  start: string;
  end: string;
  time: string;
};

export type AppointmentSlotDay = {
  date: string;
  label: string;
  slots: AppointmentSlot[];
};

export type AppointmentBookingResult = {
  appointment_id: number;
  visit_id: number;
  visit_no: string;
};

export type PatientAppointment = {
  id: number;
  visit_id?: number;
  visit_no?: string;
  doctor_id?: number;
  doctor_name?: string;
  department?: string;
  consultation_type?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  display_time?: string;
  status?: string;
  notes?: string;
  complaint?: string;
};

export type ConsultationStatus = "active" | "closed" | "partial" | "pending" | "unknown";

export type ConsultationSummary = {
  id: string;
  visitId?: string;
  visitNo?: string;
  title: string;
  doctorName: string;
  department?: string;
  date?: string;
  time?: string;
  status: ConsultationStatus;
  source: "consultation" | "prescription" | "appointment" | "diagnosis";
  complaints?: string;
  diagnosis?: string;
  prescription?: string;
  instructions?: string;
  patientName?: string;
  patientMrn?: string;
  visitType?: string;
  medicines?: Record<string, unknown>[];
  investigations?: Record<string, unknown>[];
  services?: Record<string, unknown>[];
  diagnoses?: Record<string, unknown>[];
  nonHospitalPrescriptions?: Record<string, unknown>[];
  sections?: Record<string, Record<string, unknown>[]>;
  raw: Record<string, unknown>;
};

export type PortalSnapshot = {
  profile?: HmsProfile;
  consultations: ConsultationSummary[];
  prescriptions: HmsPrescription[];
  appointments: HmsAppointment[];
  bills: HmsBill[];
  patientBills: PatientBill[];
  labTests: LabTest[];
  appointmentDoctors: AppointmentDoctor[];
  patientAppointments: PatientAppointment[];
  diagnosis: HmsDiagnosis[];
  documents: HmsDocument[];
  warnings: string[];
};
