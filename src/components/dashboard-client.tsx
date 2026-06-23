"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarPlus, ChevronDown, ClipboardPlus, FlaskConical, LayoutDashboard, ReceiptText } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePortalSnapshot } from "@/lib/use-portal-snapshot";
import { AppointmentBooking } from "@/components/appointment-booking";
import { BillingCard } from "@/components/billing-card";
import { ConsultationCard } from "@/components/consultation-card";
import { LabTestCard } from "@/components/lab-test-card";
import { MetricCard } from "@/components/metric-card";
import { MobileModuleNav, ModuleSidebar, type PortalModule } from "@/components/module-sidebar";
import { ProfilePanel } from "@/components/profile-panel";
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
    const doctorIds = new Set<string>();
    const doctorNames = new Set(snapshot.consultations.map((consultation) => consultation.doctorName.toLowerCase()).filter(Boolean));

    for (const consultation of snapshot.consultations) {
      const rawDoctorId = consultation.raw.consulting_doctor_id || consultation.raw.doctor_id;
      if (rawDoctorId) doctorIds.add(String(rawDoctorId));
    }

    for (const doctor of snapshot.appointmentDoctors) {
      if (doctor.name && doctorNames.has(doctor.name.toLowerCase())) {
        doctorIds.add(doctor.id);
      }
    }

    return Array.from(doctorIds);
  }, [snapshot.appointmentDoctors, snapshot.consultations]);

  const moduleCounts = {
    dashboard: snapshot.consultations.length + snapshot.labTests.length + snapshot.patientBills.length + snapshot.patientAppointments.length,
    profile: 1,
    consultation: snapshot.consultations.length,
    lab: snapshot.labTests.length,
    billing: snapshot.patientBills.length,
    appointment: snapshot.patientAppointments.length,
  };

  const moduleTitle =
    activeModule === "dashboard"
      ? "Dashboard"
      : activeModule === "profile"
      ? "Profile"
      : activeModule === "consultation"
      ? "Consultation"
      : activeModule === "lab"
        ? "Lab Test"
        : activeModule === "billing"
          ? "Billing"
          : "Appointment";

  const shownCount =
    activeModule === "dashboard"
      ? moduleCounts.dashboard
      : activeModule === "profile"
      ? 1
      : activeModule === "consultation"
      ? filtered.length
      : activeModule === "lab"
        ? filteredLabs.length
        : activeModule === "billing"
          ? filteredBills.length
          : snapshot.patientAppointments.length;

  if (!isReady || !token) return <Spinner label="Preparing patient portal..." />;

  return (
    <div className="app-shell">
      <Topbar onProfile={() => setActiveModule("profile")} onRefresh={refresh} refreshing={isLoading} />
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
          counts={moduleCounts}
          onChange={setActiveModule}
        />

        <div className="portal-layout">
          <ModuleSidebar
            active={activeModule}
            counts={moduleCounts}
            onChange={setActiveModule}
          />

          <section className="section module-content">
            <div className="section-header">
              <div>
                <span className="eyebrow">Registered patient portal</span>
                <h2>{moduleTitle}</h2>
                <p className="subtle">
                  {activeModule === "dashboard"
                    ? `Welcome ${user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Patient"}`
                    : "Review your SmartHMS records in a patient-friendly view."}
                </p>
              </div>
              <span className="pill closed">{shownCount} shown</span>
            </div>

            {activeModule !== "appointment" && activeModule !== "dashboard" && activeModule !== "profile" ? (
              <div className="module-toolbar">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    activeModule === "consultation"
                      ? "Search doctor, diagnosis, medicine, notes..."
                      : activeModule === "lab"
                        ? "Search test, FBC parameter, value, status..."
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
              {!isLoading && activeModule === "profile" ? <ProfilePanel profile={snapshot.profile} user={user} /> : null}
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
                  filteredLabs.map((test) => <LabTestCard test={test} key={test.id} />)
                ) : (
                  <div className="empty-state">No lab test records matched the current filters.</div>
                )
              )}
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
    </div>
  );
}
