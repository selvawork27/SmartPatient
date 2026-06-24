"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarPlus, ChevronDown, ClipboardPlus, FileText, FlaskConical, LayoutDashboard, Pill, ReceiptText } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  hasRecordAccess,
  normalizeConsultationMedicinePrescriptions,
  normalizeDischargeSummaries,
} from "@/lib/record-normalizers";
import { usePortalSnapshot } from "@/lib/use-portal-snapshot";
import { AppointmentBooking } from "@/components/appointment-booking";
import { BillingCard } from "@/components/billing-card";
import { ConsultationCard } from "@/components/consultation-card";
import { DischargeAccessGate, DischargeSummaryCard } from "@/components/discharge-summary-card";
import { LabTestCard, LabTrendGraphButton } from "@/components/lab-test-card";
import { MetricCard } from "@/components/metric-card";
import { MobileModuleNav, ModuleSidebar, type PortalModule } from "@/components/module-sidebar";
import { PatientChatbot } from "@/components/patient-chatbot";
import { PrescriptionHistory } from "@/components/prescription-history";
import { Spinner } from "@/components/spinner";
import { Topbar } from "@/components/topbar";

export function DashboardClient() {
  const router = useRouter();
  const { token, isReady, user } = useAuth();
  const { snapshot, isLoading, error, refresh } = usePortalSnapshot(token);
  const [activeModule, setActiveModule] = useState<PortalModule>("dashboard");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  if (isReady && !token) router.replace("/login");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return snapshot.consultations.filter((consultation) => {
      const matchesStatus = status === "all" || consultation.status === status;
      const haystack = [
        consultation.title,
        consultation.doctorName,
        consultation.date,
        consultation.complaints,
        consultation.diagnosis,
        consultation.prescription,
        consultation.instructions,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [query, snapshot.consultations, status]);

  const filteredLabs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return snapshot.labTests;
    return snapshot.labTests.filter((test) =>
      [
        test.test_name,
        test.investigation_name,
        test.visit_no,
        test.doctor_name,
        test.conduction_status,
        test.parameters.map((parameter) => `${parameter.name} ${parameter.value}`).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [query, snapshot.labTests]);

  const dischargeSummaries = useMemo(() => normalizeDischargeSummaries(snapshot.documents), [snapshot.documents]);
  const prescriptionHistory = useMemo(
    () => normalizeConsultationMedicinePrescriptions(snapshot.consultations),
    [snapshot.consultations],
  );
  const canAccessDischarge = useMemo(() => hasRecordAccess(snapshot.profile, user), [snapshot.profile, user]);

  const filteredDischargeSummaries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return dischargeSummaries;
    return dischargeSummaries.filter((summary) =>
      [
        summary.admissionDate,
        summary.dischargeDate,
        summary.primaryDiagnosisCode,
        summary.primaryDiagnosisDescription,
        summary.procedures.join(" "),
        summary.medications.join(" "),
        summary.followUpInstructions,
        summary.attendingDoctor,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [dischargeSummaries, query]);

  const filteredPrescriptionHistory = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return prescriptionHistory;
    return prescriptionHistory.filter((item) =>
      [
        item.medicationName,
        item.visitNo,
        item.visitId,
        item.genericName,
        item.brandName,
        item.dose,
        item.frequency,
        item.duration,
        item.prescribedBy,
        item.date,
        item.dispensingStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [prescriptionHistory, query]);

  const filteredBills = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return snapshot.patientBills;
    return snapshot.patientBills.filter((bill) =>
      [
        bill.bill_no,
        bill.visit_no,
        bill.bill_status,
        bill.payment_status,
        bill.doctor_name,
        bill.items.map((item) => item.description).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [query, snapshot.patientBills]);

  const consultationVisits = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    for (const consultation of filtered) {
      const key = consultation.visitNo || consultation.visitId || "Visit not recorded";
      groups.set(key, [...(groups.get(key) || []), consultation]);
    }

    return Array.from(groups.entries()).map(([visitLabel, consultations]) => ({
      visitLabel,
      consultations,
      date: consultations[0]?.date,
      doctor: consultations[0]?.doctorName,
      department: consultations[0]?.department,
    }));
  }, [filtered]);

  const preferredDoctorIds = useMemo(() => {
    const doctorIds = new Set<number>();
    const doctorNames = new Set(snapshot.consultations.map((consultation) => consultation.doctorName.toLowerCase()).filter(Boolean));

    for (const consultation of snapshot.consultations) {
      const rawDoctorId = consultation.raw.consulting_doctor_id || consultation.raw.doctor_id;
      const parsed = Number(rawDoctorId);
      if (Number.isFinite(parsed) && parsed > 0) doctorIds.add(parsed);
    }

    for (const doctor of snapshot.appointmentDoctors) {
      if (doctor.name && doctorNames.has(doctor.name.toLowerCase())) {
        doctorIds.add(doctor.id);
      }
    }

    return Array.from(doctorIds);
  }, [snapshot.appointmentDoctors, snapshot.consultations]);

  const assistantRecordContext = useMemo(
    () => ({
      patient: {
        name: user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(" "),
        patient_id: user?.patient_id,
        patient_unique_id: user?.patient_unique_id,
      },
      bills: snapshot.patientBills.map((bill) => ({
        bill_no: bill.bill_no,
        visit_no: bill.visit_no,
        open_date: bill.open_date,
        bill_status: bill.bill_status,
        payment_status: bill.payment_status,
        doctor_name: bill.doctor_name,
        totals: bill.totals,
        items: bill.items.map((item) => ({
          description: item.description || item.medicine || item.diagnostic_test || item.service,
          quantity: item.quantity,
          amount: item.amount,
        })),
      })),
      appointments: snapshot.patientAppointments.map((appointment) => ({
        visit_no: appointment.visit_no,
        doctor_name: appointment.doctor_name,
        department: appointment.department,
        date: appointment.date,
        display_time: appointment.display_time,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        status: appointment.status,
      })),
      consultations: snapshot.consultations.map((consultation) => ({
        visit_no: consultation.visitNo,
        title: consultation.title,
        doctor_name: consultation.doctorName,
        department: consultation.department,
        date: consultation.date,
        status: consultation.status,
        complaints: consultation.complaints,
        diagnosis: consultation.diagnosis,
        instructions: consultation.instructions,
      })),
      prescriptions: prescriptionHistory.map((prescription) => ({
        visit_no: prescription.visitNo,
        medication_name: prescription.medicationName,
        dose: prescription.dose,
        frequency: prescription.frequency,
        duration: prescription.duration,
        prescribed_by: prescription.prescribedBy,
        date: prescription.date,
        status: prescription.dispensingStatus,
      })),
      lab_tests: snapshot.labTests.map((test) => ({
        visit_no: test.visit_no,
        test_name: test.test_name || test.investigation_name,
        prescription_date: test.prescription_date,
        status: test.conduction_status,
        parameters: test.parameters.map((parameter) => ({
          name: parameter.name,
          value: parameter.value,
          units: parameter.units,
          severity: parameter.severity,
        })),
      })),
      discharge_summaries: dischargeSummaries.map((summary) => ({
        admission_date: summary.admissionDate,
        discharge_date: summary.dischargeDate,
        primary_diagnosis_code: summary.primaryDiagnosisCode,
        primary_diagnosis: summary.primaryDiagnosisDescription,
        attending_doctor: summary.attendingDoctor,
        follow_up_instructions: summary.followUpInstructions,
      })),
    }),
    [
      dischargeSummaries,
      prescriptionHistory,
      snapshot.consultations,
      snapshot.labTests,
      snapshot.patientAppointments,
      snapshot.patientBills,
      user,
    ],
  );

  const moduleCounts = {
    dashboard:
      snapshot.consultations.length +
      snapshot.labTests.length +
      dischargeSummaries.length +
      prescriptionHistory.length +
      snapshot.patientBills.length +
      snapshot.patientAppointments.length,
    consultation: snapshot.consultations.length,
    lab: snapshot.labTests.length,
    discharge: dischargeSummaries.length,
    prescription: prescriptionHistory.length,
    billing: snapshot.patientBills.length,
    appointment: snapshot.patientAppointments.length,
  };

  const moduleTitle =
    activeModule === "dashboard"
      ? "Dashboard"
      : activeModule === "consultation"
      ? "Consultation"
      : activeModule === "lab"
        ? "Lab Test"
        : activeModule === "discharge"
          ? "Discharge Summaries"
          : activeModule === "prescription"
            ? "Prescription History"
            : activeModule === "billing"
              ? "Billing"
              : "Appointment";

  const shownCount =
    activeModule === "dashboard"
      ? moduleCounts.dashboard
      : activeModule === "consultation"
      ? filtered.length
      : activeModule === "lab"
        ? filteredLabs.length
        : activeModule === "discharge"
          ? canAccessDischarge
            ? filteredDischargeSummaries.length
            : 0
          : activeModule === "prescription"
            ? filteredPrescriptionHistory.length
            : activeModule === "billing"
              ? filteredBills.length
              : snapshot.patientAppointments.length;

  if (!isReady || !token) return <Spinner label="Preparing patient portal..." />;

  return (
    <div className="app-shell">
      <Topbar onRefresh={refresh} refreshing={isLoading} />
      <main className="dashboard">
        {snapshot.warnings.length ? (
          <div className="notice" style={{ marginBottom: 18 }}>
            <AlertCircle size={19} />
            <span>{snapshot.warnings.join(" | ")}</span>
          </div>
        ) : null}

        {error ? <div className="error-box">{error}</div> : null}

        <MobileModuleNav
          active={activeModule}
          onChange={setActiveModule}
        />

        <div className="portal-layout">
          <ModuleSidebar
            active={activeModule}
            onChange={setActiveModule}
          />

          <section className="section module-content">
            <div className="section-header">
              <div>
                <div className="module-title-row">
                  <h2>{moduleTitle}</h2>
                  {activeModule === "lab" ? <LabTrendGraphButton labTests={snapshot.labTests} /> : null}
                </div>
                <p className="subtle">
                  {activeModule === "dashboard"
                    ? `Welcome ${user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Patient"}`
                    : "Review your SmartHMS records in a patient-friendly view."}
                </p>
              </div>
              <span className="pill closed">{shownCount} shown</span>
            </div>

            {activeModule !== "appointment" && activeModule !== "dashboard" ? (
              <div className="module-toolbar">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    activeModule === "consultation"
                      ? "Search doctor, diagnosis, medicine, notes..."
                      : activeModule === "lab"
                        ? "Search test, FBC parameter, value, status..."
                        : activeModule === "discharge"
                          ? "Search diagnosis, procedure, medicine, doctor..."
                          : activeModule === "prescription"
                            ? "Search medicine, dose, doctor, status..."
                            : "Search bill, item, status, doctor..."
                  }
                />
                {activeModule === "consultation" ? (
                  <select value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="all">All status</option>
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                    <option value="partial">Partial</option>
                    <option value="pending">Pending</option>
                    <option value="unknown">Unknown</option>
                  </select>
                ) : null}
              </div>
            ) : null}

            <div className="section-body">
              {isLoading ? <Spinner label="Loading SmartHMS records..." /> : null}
              {!isLoading && activeModule === "dashboard" ? (
                <div className="overview-grid">
                  <MetricCard label="Consultation records" value={snapshot.consultations.length} icon={ClipboardPlus} />
                  <MetricCard label="Lab tests" value={snapshot.labTests.length} icon={FlaskConical} />
                  <MetricCard label="Discharge summaries" value={dischargeSummaries.length} icon={FileText} />
                  <MetricCard label="Prescriptions" value={prescriptionHistory.length} icon={Pill} />
                  <MetricCard label="Bills" value={snapshot.patientBills.length} icon={ReceiptText} />
                  <MetricCard label="Appointments" value={snapshot.patientAppointments.length} icon={CalendarPlus} />

                  <div className="overview-panel span-2">
                    <div className="overview-panel-head">
                      <LayoutDashboard size={18} />
                      <h3>Recent consultations</h3>
                    </div>
                    {snapshot.consultations.slice(0, 3).length ? (
                      snapshot.consultations.slice(0, 3).map((consultation) => (
                        <button className="overview-row" key={consultation.id} onClick={() => setActiveModule("consultation")} type="button">
                          <span>
                            <strong>{consultation.title}</strong>
                            <small>{[consultation.doctorName, consultation.date].filter(Boolean).join(" - ")}</small>
                          </span>
                          <em>{consultation.status}</em>
                        </button>
                      ))
                    ) : (
                      <div className="empty-state compact">No consultations found.</div>
                    )}
                  </div>

                  <div className="overview-panel span-2">
                    <div className="overview-panel-head">
                      <CalendarPlus size={18} />
                      <h3>Upcoming appointments</h3>
                    </div>
                    {snapshot.patientAppointments.slice(0, 3).length ? (
                      snapshot.patientAppointments.slice(0, 3).map((appointment) => (
                        <button className="overview-row" key={appointment.id} onClick={() => setActiveModule("appointment")} type="button">
                          <span>
                            <strong>{appointment.doctor_name || "Doctor not recorded"}</strong>
                            <small>{[appointment.date, appointment.display_time].filter(Boolean).join(" - ")}</small>
                          </span>
                          <em>{appointment.status || "BOOKED"}</em>
                        </button>
                      ))
                    ) : (
                      <div className="empty-state compact">No appointments booked yet.</div>
                    )}
                  </div>
                </div>
              ) : null}
              {!isLoading && activeModule === "consultation" && (
                consultationVisits.length ? (
                  consultationVisits.map((visit, visitIndex) => (
                    <details className="visit-group" key={visit.visitLabel} open={visitIndex === 0}>
                      <summary className="visit-group-header">
                        <div>
                          <h3>{visit.visitLabel}</h3>
                          <p className="subtle">
                            {[visit.date, visit.doctor, visit.department].filter(Boolean).join(" - ")}
                          </p>
                        </div>
                        <span className="pill closed">
                          {visit.consultations.length} consultation{visit.consultations.length === 1 ? "" : "s"}
                        </span>
                        <ChevronDown className="summary-chevron" size={18} />
                      </summary>
                      <div className="visit-group-body">
                        {visit.consultations.map((consultation) => (
                          <ConsultationCard consultation={consultation} key={consultation.id} />
                        ))}
                      </div>
                    </details>
                  ))
                ) : (
                  <div className="empty-state">No consultation details matched the current filters.</div>
                )
              )}
              {!isLoading && activeModule === "lab" && (
                filteredLabs.length ? (
                  filteredLabs.map((test) => <LabTestCard allTests={snapshot.labTests} test={test} key={test.id} />)
                ) : (
                  <div className="empty-state">No lab test records matched the current filters.</div>
                )
              )}
              {!isLoading && activeModule === "discharge" && (
                canAccessDischarge ? (
                  filteredDischargeSummaries.length ? (
                    filteredDischargeSummaries.map((summary) => <DischargeSummaryCard key={summary.id} summary={summary} />)
                  ) : (
                    <div className="empty-state">No discharge summaries matched the current filters.</div>
                  )
                ) : (
                  <DischargeAccessGate />
                )
              )}
              {!isLoading && activeModule === "prescription" ? (
                <PrescriptionHistory prescriptions={filteredPrescriptionHistory} token={token} />
              ) : null}
              {!isLoading && activeModule === "billing" && (
                filteredBills.length ? (
                  filteredBills.map((bill) => <BillingCard bill={bill} key={bill.id} />)
                ) : (
                  <div className="empty-state">No billing records matched the current filters.</div>
                )
              )}
              {!isLoading && activeModule === "appointment" ? (
                <AppointmentBooking
                  appointments={snapshot.patientAppointments}
                  doctors={snapshot.appointmentDoctors}
                  onBooked={refresh}
                  preferredDoctorIds={preferredDoctorIds}
                  token={token}
                />
              ) : null}
            </div>
          </section>
        </div>
      </main>
      <PatientChatbot
        doctors={snapshot.appointmentDoctors}
        onBooked={refresh}
        patientName={
          user?.full_name ||
          [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
          "Patient"
        }
        preferredDoctorIds={preferredDoctorIds}
        recordContext={assistantRecordContext}
        token={token}
      />
    </div>
  );
}
