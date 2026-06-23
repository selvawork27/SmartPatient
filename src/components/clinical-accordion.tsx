"use client";

import { ChevronDown } from "lucide-react";
import { asText } from "@/lib/format";

const sectionOrder = [
  "ALLERGIES",
  "VITALS",
  "HIV HISTORY",
  "CHIEF COMPLAINTS",
  "HISTORY OF PRESENT ILLNESS",
  "CONSULTATION NOTES",
  "PERSONAL, FAMILY & SOCIAL HISTORY",
  "CURRENT DRUG HISTORY",
  "PHYSICAL EXAMINATION NOTES",
  "DIFFERENTIAL DIAGNOSIS",
  "DIAGNOSIS DETAILS",
  "MANAGEMENT",
  "FOLLOWUP DETAILS",
];

const sectionThemes: Record<string, string> = {
  ALLERGIES: "danger",
  VITALS: "teal",
  "HIV HISTORY": "violet",
  "CHIEF COMPLAINTS": "amber",
  "HISTORY OF PRESENT ILLNESS": "blue",
  "CONSULTATION NOTES": "slate",
  "PERSONAL, FAMILY & SOCIAL HISTORY": "green",
  "CURRENT DRUG HISTORY": "violet",
  "PHYSICAL EXAMINATION NOTES": "blue",
  "DIFFERENTIAL DIAGNOSIS": "amber",
  "DIAGNOSIS DETAILS": "danger",
  MANAGEMENT: "green",
  "FOLLOWUP DETAILS": "teal",
};

type ClinicalItem = {
  label: string;
  value: unknown;
  highlight?: boolean;
};

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function hasContent(records: Record<string, unknown>[] | undefined) {
  return Boolean(records?.some((record) => Object.values(record).some(hasValue)));
}

function compact(items: ClinicalItem[]) {
  return items.filter((item) => hasValue(item.value));
}

function firstValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (hasValue(record[key])) return record[key];
  }
  return undefined;
}

function formatSectionRecord(section: string, record: Record<string, unknown>): ClinicalItem[] {
  switch (section) {
    case "ALLERGIES":
      return compact([
        { label: "Allergy", value: record.allergy, highlight: true },
        { label: "Type", value: record.allergy_type },
        { label: "Severity", value: record.severity, highlight: true },
        { label: "Reaction", value: record.reactions },
        { label: "Status", value: record.status },
        { label: "Onset", value: record.onset },
      ]);
    case "VITALS":
      return compact([
        { label: "Name", value: record.parameter, highlight: true },
        { label: "Value", value: record.value, highlight: true },
        { label: "Unit", value: record.unit },
      ]);
    case "HIV HISTORY":
      return compact([
        { label: "History", value: firstValue(record, ["HIV_history", "history"]), highlight: true },
        { label: "Remarks", value: record.remarks },
      ]);
    case "CHIEF COMPLAINTS":
      return compact([{ label: "Complaint", value: record.complaint, highlight: true }]);
    case "HISTORY OF PRESENT ILLNESS":
      return compact([
        { label: "Location", value: record.location },
        { label: "Quality", value: record.quality },
        { label: "Duration", value: record.duration, highlight: true },
        { label: "Timing", value: record.timings },
        { label: "Context", value: record.context },
        { label: "Modifying factor", value: record.modifying_factor },
        { label: "Severity", value: record.severity, highlight: true },
        { label: "Associated symptoms", value: record.associated_symptoms },
        { label: "Additional complaint", value: record.additional_complaint },
      ]);
    case "CONSULTATION NOTES":
      return compact([{ label: "Notes", value: record.consultation_notes, highlight: true }]);
    case "PERSONAL, FAMILY & SOCIAL HISTORY":
      return compact([
        { label: "Type", value: record.type, highlight: true },
        { label: "History", value: record.history },
      ]);
    case "CURRENT DRUG HISTORY":
      return compact([{ label: "Drug history", value: record.drug_history, highlight: true }]);
    case "PHYSICAL EXAMINATION NOTES":
      return compact([{ label: "Examination notes", value: record.physical_examination_notes, highlight: true }]);
    case "DIFFERENTIAL DIAGNOSIS":
      return compact([{ label: "Possible diagnosis", value: record.differential_diagnosis, highlight: true }]);
    case "DIAGNOSIS DETAILS":
      return compact([
        { label: "Diagnosis", value: record.diagnosis_code_text, highlight: true },
        { label: "Type", value: record.diagnosis_type_text },
        { label: "Date", value: record.diagnosis_date },
        { label: "Time", value: record.diagnosis_time },
        { label: "Year of onset", value: record.year_of_onset },
        { label: "Status", value: record.status },
        { label: "Remarks", value: record.remarks },
      ]);
    case "MANAGEMENT":
      return compact([
        { label: "Type", value: record.type, highlight: true },
        { label: "Medicine", value: record.medicine_name, highlight: true },
        { label: "Investigation", value: record.investigation_name, highlight: true },
        { label: "Service", value: record.service_name, highlight: true },
        { label: "Dosage", value: record.dosage },
        { label: "Frequency", value: record.frequency },
        { label: "Duration", value: record.duration },
        { label: "Quantity", value: record.total_quantity ?? record.quantity },
        { label: "Usage", value: record.usage_type },
        { label: "Instructions", value: record.instructions },
        { label: "Other instructions", value: record.other_instructions },
        { label: "Clinical notes", value: record.clinical_notes_conduction },
        { label: "Justification", value: record.clinical_justification_prescription },
      ]);
    case "FOLLOWUP DETAILS":
      return compact([
        { label: "Doctor", value: record.doctor_name, highlight: true },
        { label: "Date", value: record.follow_up_date, highlight: true },
        { label: "Time", value: record.follow_up_time },
        { label: "Remarks", value: record.remarks },
      ]);
    default:
      return compact(
        Object.entries(record)
          .filter(([key]) => key !== "raw" && key !== "id" && !key.endsWith("_id"))
          .map(([key, value]) => ({ label: key.replace(/_/g, " "), value })),
      );
  }
}

function primaryText(items: ClinicalItem[], fallback: string) {
  return asText(items.find((item) => item.highlight)?.value ?? items[0]?.value, fallback);
}

function secondaryItems(items: ClinicalItem[]) {
  const primaryIndex = items.findIndex((item) => item.highlight);
  const indexToSkip = primaryIndex >= 0 ? primaryIndex : 0;
  return items.filter((_, index) => index !== indexToSkip);
}

function ClinicalRecordCard({
  items,
  section,
  index,
}: {
  items: ClinicalItem[];
  section: string;
  index: number;
}) {
  if (!items.length) return null;
  const details = secondaryItems(items);

  return (
    <article className={`clinical-card ${sectionThemes[section] || "slate"}`}>
      <div className="clinical-card-head">
        <strong>{primaryText(items, `${section} ${index + 1}`)}</strong>
      </div>
      {details.length ? (
        <div className="clinical-value-list">
          {details.map((item, itemIndex) => (
          <div className="clinical-value-row" key={`${item.label}-${itemIndex}`}>
            <span>{item.label}</span>
            <strong>{asText(item.value, "")}</strong>
          </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function ClinicalAccordion({ sections }: { sections?: Record<string, Record<string, unknown>[]> }) {
  if (!sections) return null;

  const visibleSections = sectionOrder
    .map((title) => [title, sections[title]] as const)
    .filter(([, records]) => hasContent(records));

  if (!visibleSections.length) return null;

  return (
    <div className="clinical-accordion">
      {visibleSections.map(([title, records], index) => (
        <details className={`clinical-section ${sectionThemes[title] || "slate"}`} key={title} open={index === 0}>
          <summary>
            <span>{title}</span>
            <small>{records?.length || 0}</small>
            <ChevronDown size={18} />
          </summary>
          <div className="accordion-content clinical-card-list">
            {records?.map((record, recordIndex) => (
              <ClinicalRecordCard
                index={recordIndex}
                items={formatSectionRecord(title, record)}
                key={`${title}-${recordIndex}`}
                section={title}
              />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
