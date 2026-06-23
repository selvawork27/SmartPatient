import { CalendarDays, ChevronDown, ClipboardList, UserRound } from "lucide-react";
import { formatDisplayDate } from "@/lib/format";
import { ClinicalAccordion } from "@/components/clinical-accordion";
import { FieldList } from "@/components/field-list";
import type { ConsultationSummary } from "@/types/hms";

export function ConsultationCard({ consultation }: { consultation: ConsultationSummary }) {
  const closed = consultation.status === "closed";

  return (
    <details className="consultation-card">
      <summary className="consultation-summary">
        <div>
          <h3>{consultation.title}</h3>
          <div className="meta">
            <span>
              <CalendarDays size={15} /> {formatDisplayDate(consultation.date, consultation.time)}
            </span>
            <span>
              <UserRound size={15} /> {consultation.doctorName}
            </span>
            {consultation.visitNo ? <span>Visit {consultation.visitNo}</span> : null}
          </div>
        </div>
        <span className={`pill ${closed ? "closed" : ""}`}>{consultation.status}</span>
        <ChevronDown className="summary-chevron" size={18} />
      </summary>

      <div className="consultation-detail-body">
        <div className="detail-grid">
          <div className="detail-block">
            <span>Complaint</span>
            <p>{consultation.complaints || "Not recorded"}</p>
          </div>
          <div className="detail-block">
            <span>Diagnosis</span>
            <p>{consultation.diagnosis || "Not recorded"}</p>
          </div>
          <div className="detail-block">
            <span>Prescription</span>
            <p>{consultation.prescription || "Not recorded"}</p>
          </div>
        </div>

        {consultation.instructions ? (
          <div className="detail-block" style={{ marginTop: 12 }}>
            <span>
              <ClipboardList size={14} /> Instructions
            </span>
            <p>{consultation.instructions}</p>
          </div>
        ) : null}

        <FieldList
          title="Visit Summary"
          data={{
            visit_no: consultation.visitNo,
            visit_type: consultation.visitType,
            department: consultation.department,
            status: consultation.status,
            date: consultation.date,
            time: consultation.time,
            doctor_name: consultation.doctorName,
          }}
        />

        <ClinicalAccordion sections={consultation.sections} />
      </div>
    </details>
  );
}
