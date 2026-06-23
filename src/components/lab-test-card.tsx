import { ExternalLink } from "lucide-react";
import { formatDisplayDate } from "@/lib/format";
import { FieldList } from "@/components/field-list";
import type { LabTest } from "@/types/hms";

export function LabTestCard({ test }: { test: LabTest }) {
  return (
    <article className="record-card">
      <header>
        <div>
          <h3>{test.test_name || test.investigation_name || "Lab test"}</h3>
          <p className="subtle">
            {formatDisplayDate(test.prescription_date, test.prescription_time)} {test.visit_no ? `- ${test.visit_no}` : ""}
          </p>
        </div>
        <span className="pill">{test.conduction_status || "PENDING"}</span>
      </header>

      <FieldList
        title="Test Details"
        data={{
          visit_no: test.visit_no,
          sample_id: test.sample_id,
          doctor_name: test.doctor_name,
          department_name: test.department_name,
          consultation_type: test.consultation_type,
          usage_type: test.usage_type,
          quantity: test.quantity,
          test_type: test.test_type,
          conduction_doctor: test.conduction_doctor,
          signed_off_by: test.signed_off_by,
          signed_off_time: test.signed_off_time,
          instructions: test.instructions,
          clinical_notes_conduction: test.clinical_notes_conduction,
          clinical_justification_prescription: test.clinical_justification_prescription,
        }}
      />

      {test.study_url ? (
        <a className="inline-link" href={test.study_url} target="_blank" rel="noreferrer">
          <ExternalLink size={16} /> Open study
        </a>
      ) : null}

      <div className="responsive-table">
        <table>
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Value</th>
              <th>Unit</th>
              <th>Severity</th>
              <th>Range / Allowed</th>
              <th>Method</th>
            </tr>
          </thead>
          <tbody>
            {test.parameters.length ? (
              test.parameters.map((parameter, index) => (
                <tr key={`${parameter.id || parameter.name || index}`}>
                  <td data-label="Parameter">{parameter.name || parameter.short_name || "Parameter"}</td>
                  <td data-label="Value">
                    <strong>{parameter.value ?? "Not recorded"}</strong>
                  </td>
                  <td data-label="Unit">{parameter.units || ""}</td>
                  <td data-label="Severity">{parameter.severity || ""}</td>
                  <td data-label="Range / Allowed">{parameter.data_allowed || parameter.default_value || ""}</td>
                  <td data-label="Method">{parameter.methodology || ""}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>No result parameters recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
