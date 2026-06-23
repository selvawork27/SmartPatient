"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAppointmentDoctors,
  getAppointments,
  getBills,
  getConsultations,
  getDiagnosis,
  getDocuments,
  getLabTests,
  getPatientAppointments,
  getPatientBilling,
  getPrescriptions,
  getProfile,
} from "@/lib/hms-client";
import {
  consultationFromAppointment,
  consultationFromDiagnosis,
  consultationFromPrescription,
  consultationFromRecord,
} from "@/lib/consultation-normalizer";
import type { PortalSnapshot } from "@/types/hms";

const emptySnapshot: PortalSnapshot = {
  consultations: [],
  prescriptions: [],
  appointments: [],
  bills: [],
  patientBills: [],
  labTests: [],
  appointmentDoctors: [],
  patientAppointments: [],
  diagnosis: [],
  documents: [],
  warnings: [],
};

export function usePortalSnapshot(token: string | null) {
  const [snapshot, setSnapshot] = useState<PortalSnapshot>(emptySnapshot);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    const warnings: string[] = [];
    const guarded = async <T,>(label: string, task: Promise<T>, fallback: T) => {
      try {
        return await task;
      } catch (err) {
        warnings.push(`${label}: ${err instanceof Error ? err.message : "Unable to load"}`);
        return fallback;
      }
    };

    try {
      const [
        profile,
        consultationsRaw,
        labTests,
        patientBills,
        appointmentDoctors,
        patientAppointments,
        prescriptions,
        appointments,
        bills,
        diagnosis,
        documents,
      ] = await Promise.all([
        guarded("Profile", getProfile(token), undefined),
        guarded("Consultations", getConsultations(token), []),
        guarded("Lab tests", getLabTests(token), []),
        guarded("Billing", getPatientBilling(token), []),
        guarded("Appointment doctors", getAppointmentDoctors(token), []),
        guarded("Appointments", getPatientAppointments(token), []),
        guarded("Prescriptions", getPrescriptions(token), []),
        guarded("Legacy appointments", getAppointments(token), []),
        guarded("Bills", getBills(token), []),
        guarded("Diagnosis", getDiagnosis(token), []),
        guarded("Documents", getDocuments(token), []),
      ]);

      const directConsultations = consultationsRaw.map((item, index) => consultationFromRecord(item, index));
      const derivedConsultations =
        directConsultations.length > 0
          ? directConsultations
          : [
              ...prescriptions.map((item, index) => consultationFromPrescription(item, index)),
              ...appointments.map((item, index) => consultationFromAppointment(item, index)),
              ...diagnosis.map((item, index) => consultationFromDiagnosis(item, index)),
            ];

      setSnapshot({
        profile,
        consultations: derivedConsultations,
        labTests,
        patientBills,
        appointmentDoctors,
        patientAppointments,
        prescriptions,
        appointments,
        bills,
        diagnosis,
        documents,
        warnings,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load patient details");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { snapshot, isLoading, error, refresh: load };
}
