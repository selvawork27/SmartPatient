"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { Bot, CheckCircle2, Clock, MessageCircle, Mic, MicOff, Minus, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { parseAppointmentIntent, type PortalAssistantResult } from "@/lib/appointment-agent-client";
import { bookPatientAppointment, getAppointmentSlots } from "@/lib/hms-client";
import type { AppointmentDoctor, AppointmentSlot } from "@/types/hms";

type ChatMessage = {
  id: number;
  sender: "assistant" | "patient";
  text: string;
};

type SlotChoice = AppointmentSlot & { date: string };

const suggestions = [
  "What is my recent billing amount?",
  "Show my current medicines",
  "Book appointment tomorrow",
  "When is my next appointment?",
];

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function displayDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function PatientChatbot({
  patientName,
  token,
  doctors,
  preferredDoctorIds,
  onBooked,
  recordContext,
}: {
  patientName: string;
  token: string;
  doctors: AppointmentDoctor[];
  preferredDoctorIds: number[];
  onBooked: () => void;
  recordContext: Record<string, unknown>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      sender: "assistant",
      text: `Hello ${patientName}. I can help with your portal records and appointment booking.`,
    },
  ]);
  const [intent, setIntent] = useState<PortalAssistantResult | null>(null);
  const [doctorOptions, setDoctorOptions] = useState<AppointmentDoctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<AppointmentDoctor | null>(null);
  const [slots, setSlots] = useState<SlotChoice[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const preferredSet = useMemo(() => new Set(preferredDoctorIds), [preferredDoctorIds]);

  function appendMessage(sender: ChatMessage["sender"], text: string) {
    setMessages((current) => [...current, { id: Date.now() + current.length, sender, text }]);
  }

  function orderDoctors(parsedIntent: PortalAssistantResult) {
    const doctorNeedle = String(parsedIntent.doctor_name || "").toLowerCase();
    const departmentNeedle = String(parsedIntent.department || "").toLowerCase();
    const matching = doctors.filter((doctor) => {
      const doctorMatches = !doctorNeedle || String(doctor.name || "").toLowerCase().includes(doctorNeedle);
      const departmentMatches =
        !departmentNeedle ||
        `${doctor.department || ""} ${doctor.specialization || ""}`.toLowerCase().includes(departmentNeedle);
      return doctorMatches && departmentMatches;
    });
    const available = matching.length ? matching : doctors;
    return [...available].sort((a, b) => {
      const preferredDifference = Number(!preferredSet.has(a.id)) - Number(!preferredSet.has(b.id));
      return preferredDifference || String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  async function processIntent(input: { message?: string; audio?: Blob }) {
    setIsBusy(true);
    setDoctorOptions([]);
    setSelectedDoctor(null);
    setSlots([]);
    try {
      const result = await parseAppointmentIntent({
        ...input,
        currentDate: todayKey(),
        context: recordContext,
      });
      if (input.audio) appendMessage("patient", result.transcription);
      setIntent(result.data);

      if (result.data.action !== "book_appointment") {
        appendMessage("assistant", result.data.reply);
        return;
      }
      if (!result.data.date) {
        appendMessage("assistant", result.data.reply || "Which date would you like to book?");
        return;
      }

      const choices = orderDoctors(result.data);
      setDoctorOptions(choices);
      appendMessage(
        "assistant",
        choices.length
          ? `Choose a doctor for ${displayDate(result.data.date)}. Previously consulted doctors are shown first.`
          : "No active doctors are currently available.",
      );
    } catch (error) {
      appendMessage("assistant", error instanceof Error ? error.message : "Unable to process that request.");
    } finally {
      setIsBusy(false);
    }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isBusy) return;
    appendMessage("patient", text);
    setDraft("");
    await processIntent({ message: text });
  }

  async function chooseDoctor(doctor: AppointmentDoctor) {
    if (!intent?.date) return;
    setSelectedDoctor(doctor);
    setSlots([]);
    setIsBusy(true);
    appendMessage("patient", doctor.name || `Doctor #${doctor.id}`);
    try {
      const days = await getAppointmentSlots(token, doctor.id, intent.date, intent.date);
      const choices = (days[0]?.slots || []).map((slot) => ({ ...slot, date: intent.date as string }));
      setSlots(choices);
      appendMessage(
        "assistant",
        choices.length
          ? `These times are available with ${doctor.name || "the selected doctor"}. Choose one to book.`
          : `No slots are available with ${doctor.name || "this doctor"} on ${displayDate(intent.date)}.`,
      );
    } catch (error) {
      appendMessage("assistant", error instanceof Error ? error.message : "Unable to load appointment times.");
    } finally {
      setIsBusy(false);
    }
  }

  async function chooseSlot(slot: SlotChoice) {
    if (!selectedDoctor || isBusy) return;
    setIsBusy(true);
    appendMessage("patient", slot.time);
    try {
      const result = await bookPatientAppointment(token, {
        doctor_id: selectedDoctor.id,
        start_time: slot.start,
        end_time: slot.end,
        complaint: intent?.reason || "Appointment requested through SmartPatient Assistant",
        notes: "Booked through SmartPatient conversational assistant.",
      });
      appendMessage("assistant", `Your appointment is booked successfully. Visit No: ${result.visit_no}.`);
      setIntent(null);
      setDoctorOptions([]);
      setSelectedDoctor(null);
      setSlots([]);
      onBooked();
    } catch (error) {
      appendMessage("assistant", error instanceof Error ? error.message : "Unable to book the selected appointment.");
    } finally {
      setIsBusy(false);
    }
  }

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      appendMessage("assistant", "Voice dictation is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        const audio = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        void processIntent({ audio });
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      appendMessage("assistant", "Microphone access was not available.");
    }
  }

  return (
    <div className="patient-chatbot">
      {isOpen ? (
        <section aria-label="SmartPatient assistant" className={`chatbot-panel ${isMinimized ? "minimized" : ""}`}>
          <header className="chatbot-header">
            <div className="chatbot-identity">
              <span className="chatbot-avatar"><Bot size={20} /></span>
              <div>
                <strong>SmartPatient Assistant</strong>
                <span><i /> Portal assistant</span>
              </div>
            </div>
            <div className="chatbot-header-actions">
              <button aria-label="Minimize chat" onClick={() => setIsMinimized((value) => !value)} title="Minimize" type="button">
                <Minus size={18} />
              </button>
              <button aria-label="Close chat" onClick={() => setIsOpen(false)} title="Close" type="button"><X size={18} /></button>
            </div>
          </header>

          {!isMinimized ? (
            <>
              <div className="chatbot-safety-note">
                <ShieldCheck size={16} />
                <span>Answers use your portal records. Bookings are confirmed directly with SmartHMS.</span>
              </div>
              <div aria-live="polite" className="chatbot-messages">
                <div className="chatbot-day-label">Today</div>
                {messages.map((message) => (
                  <div className={`chatbot-message-row ${message.sender}`} key={message.id}>
                    {message.sender === "assistant" ? <span className="chatbot-message-icon"><Sparkles size={14} /></span> : null}
                    <div className="chatbot-message">{message.text}</div>
                  </div>
                ))}

                {doctorOptions.length && !selectedDoctor ? (
                  <div className="chatbot-choice-list">
                    {doctorOptions.map((doctor) => (
                      <button key={doctor.id} onClick={() => void chooseDoctor(doctor)} type="button">
                        <span>
                          <strong>{doctor.name || `Doctor #${doctor.id}`}</strong>
                          <small>{[doctor.department, doctor.specialization].filter(Boolean).join(" / ") || "Department not recorded"}</small>
                        </span>
                        {preferredSet.has(doctor.id) ? <em>Consulted</em> : null}
                      </button>
                    ))}
                  </div>
                ) : null}

                {slots.length ? (
                  <div className="chatbot-slot-list">
                    {slots.map((slot) => (
                      <button key={slot.start} onClick={() => void chooseSlot(slot)} type="button">
                        <Clock size={14} /> {slot.time}
                      </button>
                    ))}
                  </div>
                ) : null}

                {isBusy ? <div className="chatbot-thinking"><span /><span /><span /></div> : null}
                {messages.at(-1)?.text.includes("booked successfully") ? (
                  <div className="chatbot-booked"><CheckCircle2 size={16} /> Confirmed by SmartHMS</div>
                ) : null}
              </div>

              <div className="chatbot-suggestions">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} onClick={() => setDraft(suggestion)} type="button">{suggestion}</button>
                ))}
              </div>
              <form className="chatbot-composer" onSubmit={submitMessage}>
                <button
                  aria-label={isRecording ? "Stop recording" : "Dictate appointment request"}
                  className={isRecording ? "chatbot-mic recording" : "chatbot-mic"}
                  onClick={() => void toggleRecording()}
                  title={isRecording ? "Stop recording" : "Dictate"}
                  type="button"
                >
                  {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <textarea
                  aria-label="Message SmartPatient Assistant"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="Ask about bills, medicines, labs, or appointments"
                  rows={1}
                  value={draft}
                />
                <button aria-label="Send message" disabled={!draft.trim() || isBusy} title="Send" type="submit"><Send size={18} /></button>
              </form>
              <p className="chatbot-disclaimer">By DevEnv Tech </p>
            </>
          ) : null}
        </section>
      ) : (
        <button aria-label="Open SmartPatient Assistant" className="chatbot-launcher" onClick={() => setIsOpen(true)} title="SmartPatient Assistant" type="button">
          <MessageCircle size={24} /><span>Ask Assistant</span>
        </button>
      )}
    </div>
  );
}
