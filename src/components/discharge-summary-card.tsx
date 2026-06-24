"use client";

import { Download, LockKeyhole } from "lucide-react";
import { jsPDF } from "jspdf";
import { formatDisplayDate } from "@/lib/format";
import type { DischargeSummary } from "@/types/hms";

function writeSection(doc: jsPDF, title: string, rows: [string, string][], y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, 14, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const [label, value] of rows) {
    if (y > 276) {
      doc.addPage();
      y = 18;
    }
    doc.setTextColor(90, 103, 121);
    doc.text(label, 14, y);
    doc.setTextColor(19, 34, 53);
    const wrapped = doc.splitTextToSize(value || "Not recorded", 68);
    doc.text(wrapped, 74, y);
    y += Math.max(7, wrapped.length * 5);
  }
  return y + 4;
}

function downloadDischargePdf(summary: DischargeSummary) {
  if (summary.pdfUrl) {
    window.open(summary.pdfUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const doc = new jsPDF();
  doc.setTextColor(19, 34, 53);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Discharge Summary", 14, 18);

  writeSection(
    doc,
    "Summary",
    [
      ["Admission date", formatDisplayDate(summary.admissionDate)],
      ["Discharge date", formatDisplayDate(summary.dischargeDate)],
      ["Primary diagnosis", [summary.primaryDiagnosisCode, summary.primaryDiagnosisDescription].filter(Boolean).join(" - ")],
      ["Procedures", summary.procedures.join(", ")],
      ["Medications", summary.medications.join(", ")],
      ["Follow-up", summary.followUpInstructions || ""],
      ["Attending doctor", summary.attendingDoctor || ""],
    ],
    34,
  );

  doc.save(`discharge-summary-${summary.id}.pdf`);
}

export function DischargeAccessGate() {
  return (
    <div className="access-gate">
      <LockKeyhole size={22} />
      <div>
        <strong>Discharge summaries are locked</strong>
        <p>Complete registration and consent to record access before discharge summaries can be viewed.</p>
      </div>
    </div>
  );
}

export function DischargeSummaryCard({ summary }: { summary: DischargeSummary }) {
  return (
    <article className="record-card discharge-card">
      <header>
        <div>
          <h3>Discharge Summary</h3>
          <p className="subtle">
            {[formatDisplayDate(summary.admissionDate), formatDisplayDate(summary.dischargeDate)].filter(Boolean).join(" - ")}
          </p>
        </div>
        <div className="record-actions">
          <button className="secondary-button compact-button" onClick={() => downloadDischargePdf(summary)} type="button">
            <Download size={16} /> PDF
          </button>
          <span className={`pill ${summary.signed ? "" : "closed"}`}>{summary.signed ? "Signed" : "Available"}</span>
        </div>
      </header>

      <div className="detail-grid discharge-grid">
        <div className="detail-block">
          <span>Admission date</span>
          <p>{formatDisplayDate(summary.admissionDate)}</p>
        </div>
        <div className="detail-block">
          <span>Discharge date</span>
          <p>{formatDisplayDate(summary.dischargeDate)}</p>
        </div>
        <div className="detail-block">
          <span>Attending doctor</span>
          <p>{summary.attendingDoctor || "Not recorded"}</p>
        </div>
      </div>

      <div className="detail-block" style={{ marginTop: 12 }}>
        <span>Primary diagnosis</span>
        <p>{[summary.primaryDiagnosisCode, summary.primaryDiagnosisDescription].filter(Boolean).join(" - ") || "Not recorded"}</p>
      </div>

      <div className="record-two-column">
        <div className="detail-block">
          <span>Procedures</span>
          <p>{summary.procedures.length ? summary.procedures.join(", ") : "Not recorded"}</p>
        </div>
        <div className="detail-block">
          <span>Medications on discharge</span>
          <p>{summary.medications.length ? summary.medications.join(", ") : "Not recorded"}</p>
        </div>
      </div>

      <div className="detail-block" style={{ marginTop: 12 }}>
        <span>Follow-up instructions</span>
        <p>{summary.followUpInstructions || "Not recorded"}</p>
      </div>
    </article>
  );
}
