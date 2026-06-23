"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight, Clock, Plus, Send, XCircle } from "lucide-react";
import { bookPatientAppointment, cancelPatientAppointment, getAppointmentSlots } from "@/lib/hms-client";
import type { AppointmentDoctor, AppointmentSlot, AppointmentSlotDay, PatientAppointment } from "@/types/hms";
import { Spinner } from "@/components/spinner";

type SelectedSlot = AppointmentSlot & {
  date: string;
  label: string;
};

type AppointmentBookingProps = {
  token: string;
  doctors: AppointmentDoctor[];
  appointments: PatientAppointment[];
  preferredDoctorIds: string[];
  onBooked: () => void;
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function atStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatRange(start: Date, end: Date) {
  return `${start.toLocaleDateString(undefined, { day: "2-digit", month: "short" })} - ${end.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  })}`;
}

function slotHour(slot: AppointmentSlot) {
  return Number(slot.time.slice(0, 2));
}

function appointmentStatusClass(status?: string) {
  const text = String(status || "").toLowerCase();
  if (text.includes("cancel")) return "cancelled";
  if (text.includes("complete")) return "completed";
  if (text.includes("arrived")) return "arrived";
  return "booked";
}

function canCancelAppointment(appointment: PatientAppointment) {
  const status = String(appointment.status || "").toLowerCase();
  if (status.includes("cancel") || status.includes("complete")) return false;
  if (!appointment.date) return true;

  const endTime = appointment.end_time || appointment.start_time;
  if (!endTime) return true;

  return new Date(`${appointment.date}T${endTime}`).getTime() > Date.now();
}

export function AppointmentBooking({ token, doctors, appointments, preferredDoctorIds, onBooked }: AppointmentBookingProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(preferredDoctorIds[0] ?? doctors[0]?.id ?? null);
  const [weekStart, setWeekStart] = useState(() => atStartOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [slotDays, setSlotDays] = useState<AppointmentSlotDay[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [complaint, setComplaint] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preferredSet = useMemo(() => new Set(preferredDoctorIds), [preferredDoctorIds]);

  const orderedDoctors = useMemo(() => {
    return [...doctors].sort((a, b) => {
      const aPreferred = preferredSet.has(a.id) ? 0 : 1;
      const bPreferred = preferredSet.has(b.id) ? 0 : 1;
      if (aPreferred !== bPreferred) return aPreferred - bPreferred;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [doctors, preferredSet]);

  useEffect(() => {
    const preferred = preferredDoctorIds.find((id) => doctors.some((doctor) => doctor.id === id));
    if (!selectedDoctorId && preferred) {
      setSelectedDoctorId(preferred);
      return;
    }

    if (!selectedDoctorId && doctors[0]?.id) {
      setSelectedDoctorId(doctors[0].id);
    }
  }, [doctors, preferredDoctorIds, selectedDoctorId]);

  useEffect(() => {
    if (!isCreating || !selectedDoctorId) return;

    let cancelled = false;
    const startDate = toDateKey(weekStart);
    const endDate = toDateKey(addDays(weekStart, 6));

    setIsLoadingSlots(true);
    setError(null);
    setSelectedSlot(null);

    getAppointmentSlots(token, selectedDoctorId, startDate, endDate)
      .then((days) => {
        if (!cancelled) {
          setSlotDays(days);
          if (!days.some((day) => day.date === selectedDate)) {
            setSelectedDate(days[0]?.date || startDate);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load appointment slots");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isCreating, selectedDoctorId, token, weekStart]);

  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => doctor.id === selectedDoctorId),
    [doctors, selectedDoctorId],
  );

  const selectedDay = useMemo(() => slotDays.find((day) => day.date === selectedDate), [selectedDate, slotDays]);
  const groupedSlots = useMemo(() => {
    const slots = selectedDay?.slots || [];
    return [
      { label: "Morning", slots: slots.filter((slot) => slotHour(slot) < 12) },
      { label: "Afternoon", slots: slots.filter((slot) => slotHour(slot) >= 12 && slotHour(slot) < 17) },
      { label: "Evening", slots: slots.filter((slot) => slotHour(slot) >= 17) },
    ].filter((group) => group.slots.length > 0);
  }, [selectedDay]);

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [appointments]);

  const jumpToDate = (offset: number) => {
    const date = atStartOfDay(addDays(new Date(), offset));
    setWeekStart(date);
    setSelectedDate(toDateKey(date));
  };

  const handleBook = async () => {
    if (!selectedDoctorId || !selectedSlot) return;

    setIsBooking(true);
    setError(null);
    setBookingMessage(null);

    try {
      const result = await bookPatientAppointment(token, {
        doctor_id: selectedDoctorId,
        slot_id: selectedSlot.slot_id,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
        complaint,
        notes,
      });
      setBookingMessage(`Your appointment is booked successfully. Visit No: ${result.visit_no}`);
      setComplaint("");
      setNotes("");
      setSelectedSlot(null);
      setIsCreating(false);
      onBooked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to book appointment");
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancel = async (appointment: PatientAppointment) => {
    const confirmed = window.confirm("Cancel this appointment? The selected time slot will become available again.");
    if (!confirmed) return;

    setCancellingId(appointment.id);
    setError(null);
    setCancelMessage(null);

    try {
      await cancelPatientAppointment(token, appointment.id);
      setCancelMessage("Appointment cancelled successfully.");
      onBooked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel appointment");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="appointment-shell">
      <div className="appointment-topline">
        <div>
          <span className="eyebrow">Appointments</span>
          <h3>My appointments</h3>
        </div>
        <button className="primary-button appointment-toggle" onClick={() => setIsCreating((value) => !value)} type="button">
          <Plus size={18} />
          {isCreating ? "Close booking" : "Create Appointment"}
        </button>
      </div>

      {bookingMessage ? (
        <div className="booking-confirmation">
          <CheckCircle2 size={28} />
          <div>
            <strong>Appointment booked successfully</strong>
            <span>{bookingMessage}</span>
          </div>
        </div>
      ) : null}

      {cancelMessage ? (
        <div className="booking-confirmation cancelled">
          <XCircle size={28} />
          <div>
            <strong>Appointment cancelled</strong>
            <span>{cancelMessage}</span>
          </div>
        </div>
      ) : null}

      {isCreating ? (
        doctors.length === 0 ? (
          <div className="empty-state compact">No active doctors are available for appointment booking.</div>
        ) : (
          <div className="appointment-grid">
            <aside className="doctor-panel">
              <label htmlFor="doctor-select">Doctor</label>
              <select
                id="doctor-select"
                value={selectedDoctorId ?? ""}
                onChange={(event) => setSelectedDoctorId(event.target.value)}
              >
                {orderedDoctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {preferredSet.has(doctor.id) ? "Visited - " : ""}
                    {doctor.name || `Doctor #${doctor.id}`}
                  </option>
                ))}
              </select>

              {selectedDoctor ? (
                <div className="doctor-card">
                  <span className={preferredSet.has(selectedDoctor.id) ? "doctor-badge active" : "doctor-badge"}>
                    {preferredSet.has(selectedDoctor.id) ? "Previously consulted" : "Available doctor"}
                  </span>
                  <strong>{selectedDoctor.name || "Doctor"}</strong>
                  <span>{selectedDoctor.department || "Department not recorded"}</span>
                  {selectedDoctor.specialization ? <small>{selectedDoctor.specialization}</small> : null}
                </div>
              ) : null}
            </aside>

            <div className="calendar-panel">
              <div className="quick-date-row">
                <button className={selectedDate === toDateKey(new Date()) ? "active" : ""} onClick={() => jumpToDate(0)} type="button">
                  Today
                </button>
                <button className={selectedDate === toDateKey(addDays(new Date(), 1)) ? "active" : ""} onClick={() => jumpToDate(1)} type="button">
                  Tomorrow
                </button>
              </div>

              <div className="calendar-toolbar">
                <button className="icon-button" onClick={() => setWeekStart((date) => addDays(date, -7))} type="button" title="Previous week">
                  <ChevronLeft size={18} />
                </button>
                <strong>{formatRange(weekStart, addDays(weekStart, 6))}</strong>
                <button className="icon-button" onClick={() => setWeekStart((date) => addDays(date, 7))} type="button" title="Next week">
                  <ChevronRight size={18} />
                </button>
              </div>

              {isLoadingSlots ? <Spinner label="Loading available slots..." /> : null}

              {!isLoadingSlots ? (
                <>
                  <div className="day-strip">
                    {slotDays.map((day) => (
                      <button
                        className={selectedDate === day.date ? "active" : ""}
                        key={day.date}
                        onClick={() => {
                          setSelectedDate(day.date);
                          setSelectedSlot(null);
                        }}
                        type="button"
                      >
                        <strong>{day.label.split(",")[0]}</strong>
                        <span>{day.label.split(",").slice(1).join(",").trim()}</span>
                        <small>{day.slots.length} slots</small>
                      </button>
                    ))}
                  </div>

                  {groupedSlots.length ? (
                    <div className="slot-groups">
                      {groupedSlots.map((group) => (
                        <section className="slot-group" key={group.label}>
                          <h4>{group.label}</h4>
                          <div className="slot-list compact">
                            {group.slots.map((slot) => {
                              const active = selectedSlot?.start === slot.start;
                              return (
                                <button
                                  className={active ? "slot-button active" : "slot-button"}
                                  key={`${selectedDate}-${slot.start}`}
                                  onClick={() => setSelectedSlot({ ...slot, date: selectedDate, label: selectedDay?.label || selectedDate })}
                                  type="button"
                                >
                                  <Clock size={14} />
                                  {slot.time}
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state compact">No available slots for the selected day.</div>
                  )}
                </>
              ) : null}

              <div className="booking-form">
                <div className="selected-slot">
                  <span>Selected slot</span>
                  <strong>{selectedSlot ? `${selectedSlot.label}, ${selectedSlot.time}` : "Choose a time from the selected day"}</strong>
                </div>
                <label>
                  Main complaint
                  <textarea value={complaint} onChange={(event) => setComplaint(event.target.value)} placeholder="Reason for the appointment" />
                </label>
                <label>
                  Notes
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Any additional notes for the hospital" />
                </label>
                <button className="primary-button" disabled={!selectedSlot || isBooking} onClick={handleBook} type="button">
                  <Send size={17} />
                  {isBooking ? "Booking..." : "Confirm Appointment"}
                </button>
              </div>

              {error ? <div className="error-box">{error}</div> : null}
            </div>
          </div>
        )
      ) : null}

      <div className="appointment-list">
        {sortedAppointments.length ? (
          sortedAppointments.map((appointment) => (
            <article className="appointment-card" key={appointment.id}>
              <div className="appointment-icon">
                <CalendarCheck size={20} />
              </div>
              <div>
                <h4>{appointment.doctor_name || "Doctor not recorded"}</h4>
                <p className="subtle">{[appointment.department, appointment.consultation_type, appointment.visit_no].filter(Boolean).join(" - ")}</p>
                {appointment.complaint ? <p>{appointment.complaint}</p> : null}
              </div>
              <div className="appointment-meta">
                <strong>{appointment.date || "Date not recorded"}</strong>
                <span>{appointment.display_time || [appointment.start_time, appointment.end_time].filter(Boolean).join(" - ") || "Time not recorded"}</span>
                <small className={`appointment-status ${appointmentStatusClass(appointment.status)}`}>{appointment.status || "BOOKED"}</small>
                {canCancelAppointment(appointment) ? (
                  <button
                    className="danger-button"
                    disabled={cancellingId === appointment.id}
                    onClick={() => handleCancel(appointment)}
                    type="button"
                  >
                    <XCircle size={15} />
                    {cancellingId === appointment.id ? "Cancelling..." : "Cancel"}
                  </button>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state compact">No booked appointments found.</div>
        )}
      </div>
    </div>
  );
}
