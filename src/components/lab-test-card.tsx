"use client";

import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { ChevronDown, Download, ExternalLink, LineChart as LineChartIcon, X } from "lucide-react";
import { jsPDF } from "jspdf";
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDisplayDate } from "@/lib/format";
import { FieldList } from "@/components/field-list";
import type { LabParameter, LabTest } from "@/types/hms";

type TrendPoint = {
  date: string;
  label: string;
  value: number;
  displayValue: string;
};

type ParameterTrend = {
  key: string;
  name: string;
  unit: string;
  points: TrendPoint[];
};

function parameterLabel(parameter: LabParameter) {
  return parameter.name || parameter.short_name || "Parameter";
}

function parameterKey(parameter: LabParameter) {
  return parameterLabel(parameter).trim().toLowerCase();
}

function testTitle(test: LabTest) {
  return test.test_name || test.investigation_name || "Lab test";
}

function parseNumericValue(value: LabParameter["value"]) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!normalized) return null;
  const parsed = Number(normalized[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getTestDate(test: LabTest) {
  const date = test.prescription_date || test.signed_off_time?.slice(0, 10) || "";
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return { raw: date, time: parsed.getTime(), label: formatDisplayDate(date) };
}

function getParameterTrends(currentTest: LabTest, allTests: LabTest[]) {
  const currentKeys = new Map<string, LabParameter>();
  for (const parameter of currentTest.parameters) {
    const numericValue = parseNumericValue(parameter.value);
    const key = parameterKey(parameter);
    if (key && numericValue !== null) currentKeys.set(key, parameter);
  }

  const trends: ParameterTrend[] = [];
  for (const [key, currentParameter] of currentKeys) {
    const readings = allTests
      .flatMap((test) => {
        const date = getTestDate(test);
        if (!date) return [];

        return test.parameters
          .filter((parameter) => parameterKey(parameter) === key)
          .map((parameter) => {
            const value = parseNumericValue(parameter.value);
            if (value === null) return null;
            return {
              date: date.raw,
              label: date.label,
              value,
              displayValue: String(parameter.value),
              sortTime: date.time,
            };
          })
          .filter((point): point is TrendPoint & { sortTime: number } => Boolean(point));
      })
      .sort((a, b) => a.sortTime - b.sortTime)
      .slice(-12)
      .map(({ sortTime: _sortTime, ...point }) => point);

    if (readings.length >= 2) {
      trends.push({
        key,
        name: parameterLabel(currentParameter),
        unit: currentParameter.units || "",
        points: readings,
      });
    }
  }

  return trends;
}

function getAllParameterTrends(allTests: LabTest[]) {
  const parameterSamples = new Map<string, LabParameter>();

  for (const test of allTests) {
    for (const parameter of test.parameters) {
      const key = parameterKey(parameter);
      if (key && parseNumericValue(parameter.value) !== null && !parameterSamples.has(key)) {
        parameterSamples.set(key, parameter);
      }
    }
  }

  return Array.from(parameterSamples.entries())
    .map(([key, sample]) => {
      const readings = allTests
        .flatMap((test) => {
          const date = getTestDate(test);
          if (!date) return [];

          return test.parameters
            .filter((parameter) => parameterKey(parameter) === key)
            .map((parameter) => {
              const value = parseNumericValue(parameter.value);
              if (value === null) return null;
              return {
                date: date.raw,
                label: date.label,
                value,
                displayValue: String(parameter.value),
                sortTime: date.time,
              };
            })
            .filter((point): point is TrendPoint & { sortTime: number } => Boolean(point));
        })
        .sort((a, b) => a.sortTime - b.sortTime)
        .slice(-12)
        .map(({ sortTime: _sortTime, ...point }) => point);

      return {
        key,
        name: parameterLabel(sample),
        unit: sample.units || "",
        points: readings,
      };
    })
    .filter((trend) => trend.points.length >= 2);
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "lab-result";
}

function addPdfSection(doc: jsPDF, title: string, rows: [string, string][], startY: number) {
  const margin = 14;
  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const [label, value] of rows) {
    if (y > 276) {
      doc.addPage();
      y = 18;
    }
    doc.setTextColor(90, 103, 121);
    doc.text(label, margin, y);
    doc.setTextColor(19, 34, 53);
    const wrapped = doc.splitTextToSize(value || "Not recorded", 126);
    doc.text(wrapped, 68, y);
    y += Math.max(7, wrapped.length * 5);
  }

  return y + 4;
}

function downloadLabResultPdf(test: LabTest) {
  const doc = new jsPDF();
  const title = testTitle(test);

  doc.setTextColor(19, 34, 53);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 14, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(102, 117, 138);
  doc.text(formatDisplayDate(test.prescription_date, test.prescription_time), 14, 26);

  let y = addPdfSection(
    doc,
    "Test Details",
    [
      ["Visit No", test.visit_no || ""],
      ["Sample ID", test.sample_id || ""],
      ["Doctor", test.doctor_name || ""],
      ["Department", test.department_name || ""],
      ["Status", test.conduction_status || "PENDING"],
      ["Signed Off By", test.signed_off_by || ""],
      ["Signed Off Time", test.signed_off_time || ""],
      ["Instructions", test.instructions || ""],
    ],
    38,
  );

  y = addPdfSection(
    doc,
    "Result Parameters",
    test.parameters.length
      ? test.parameters.map((parameter) => [
          parameterLabel(parameter),
          [
            parameter.value ?? "Not recorded",
            parameter.units,
            parameter.severity ? `Severity: ${parameter.severity}` : "",
            parameter.data_allowed || parameter.default_value ? `Range: ${parameter.data_allowed || parameter.default_value}` : "",
            parameter.methodology ? `Method: ${parameter.methodology}` : "",
          ]
            .filter(Boolean)
            .join(" | "),
        ])
      : [["Parameters", "No result parameters recorded yet."]],
    y,
  );

  doc.setFontSize(8);
  doc.setTextColor(102, 117, 138);
  doc.text(`Generated from SmartPatient on ${new Date().toLocaleString("en-IN")}`, 14, 288);
  doc.save(`${sanitizeFileName(title)}-${test.id}.pdf`);
}

function stopSummaryToggle(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function svgCoordinates(points: TrendPoint[], width: number, height: number, padding = 18) {
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  return points.map((point, index) => {
    const x = padding + (points.length === 1 ? usableWidth / 2 : (index / (points.length - 1)) * usableWidth);
    const y = padding + usableHeight - ((point.value - min) / range) * usableHeight;
    return { x, y };
  });
}

function svgPoints(points: TrendPoint[], width: number, height: number, padding = 18) {
  return svgCoordinates(points, width, height, padding)
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
}

function trendViewerSrcDoc(title: string, trends: ParameterTrend[]) {
  const charts = trends
    .map((trend) => {
      const first = trend.points[0];
      const last = trend.points.at(-1);
      const coordinates = svgCoordinates(trend.points, 520, 220, 28);
      return `
        <section class="chart-card">
          <div class="chart-head">
            <strong>${escapeHtml(trend.name)}</strong>
            <span>${escapeHtml(trend.unit || "Value")}</span>
          </div>
          <svg viewBox="0 0 520 220" role="img" aria-label="${escapeHtml(trend.name)} trend">
            <rect x="0" y="0" width="520" height="220" rx="10" fill="#fbfdff"></rect>
            <polyline points="${svgPoints(trend.points, 520, 220, 28)}" fill="none" stroke="#087f8c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
            ${coordinates
              .map((point) => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4" fill="#087f8c"></circle>`)
              .join("")}
          </svg>
          <div class="chart-meta">
            <span>${escapeHtml(first ? `${first.label}: ${first.displayValue}` : "")}</span>
            <span>${escapeHtml(last ? `${last.label}: ${last.displayValue}` : "")}</span>
          </div>
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          :root { color: #132235; font-family: Arial, Helvetica, sans-serif; }
          body { margin: 0; background: #f6f8fb; }
          main { display: grid; gap: 14px; padding: 18px; }
          h1 { margin: 0; font-size: 22px; }
          .subtle { color: #66758a; margin: -6px 0 4px; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
          .chart-card { border: 1px solid #dfe7f1; border-radius: 8px; background: #fff; padding: 12px; }
          .chart-head, .chart-meta { display: flex; justify-content: space-between; gap: 10px; }
          .chart-head span, .chart-meta { color: #66758a; font-size: 12px; font-weight: 700; }
          svg { display: block; width: 100%; height: 220px; margin-top: 8px; }
          @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } main { padding: 12px; } }
        </style>
      </head>
      <body>
        <main>
          <h1>${escapeHtml(title)}</h1>
          <p class="subtle">All available repeat trends, last 12 readings.</p>
          <div class="grid">${charts || "<p>No repeat trends available.</p>"}</div>
        </main>
      </body>
    </html>`;
}

function TrendChart({ height = 190, trend }: { height?: number; trend: ParameterTrend }) {
  return (
    <ResponsiveContainer height={height} width="100%">
      <RechartsLineChart data={trend.points} margin={{ top: 8, right: 10, bottom: 0, left: -18 }}>
        <CartesianGrid stroke="#dfe7f1" strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} width={54} />
        <Tooltip
          formatter={(_value, _name, item) => [
            `${item.payload.displayValue}${trend.unit ? ` ${trend.unit}` : ""}`,
            trend.name,
          ]}
          labelFormatter={(label) => String(label)}
        />
        <Line dataKey="value" dot={{ r: 3 }} stroke="#087f8c" strokeWidth={2.4} type="monotone" />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}

function MiniTrendButton({ onClick, trend }: { onClick: () => void; trend?: ParameterTrend }) {
  if (!trend) return <span className="trend-empty">-</span>;

  return (
    <button aria-label={`Open ${trend.name} trend`} className="mini-trend-button" onClick={onClick} type="button">
      <svg aria-hidden="true" viewBox="0 0 96 34">
        <polyline points={svgPoints(trend.points, 96, 34, 4)} />
      </svg>
    </button>
  );
}

export function LabTrendGraphButton({ labTests }: { labTests: LabTest[] }) {
  const trends = useMemo(() => getAllParameterTrends(labTests), [labTests]);
  const [showTrends, setShowTrends] = useState(false);

  return (
    <>
      <button
        aria-label="Show global lab trend graphs"
        className="icon-button graph-icon-button lab-global-graph"
        disabled={!trends.length}
        onClick={() => setShowTrends(true)}
        title={trends.length ? "Show global lab trend graphs" : "No repeat lab trends available"}
        type="button"
      >
        <LineChartIcon size={17} />
      </button>

      {showTrends ? (
        <div aria-modal="true" className="graph-modal" role="dialog">
          <div className="graph-modal-card graph-modal-card-wide">
            <div className="graph-modal-head">
              {/* <div>
                <strong>Lab Test Trends</strong>
                <span>All repeat result graphs</span>
              </div> */}
              <button aria-label="Close graph view" className="icon-button" onClick={() => setShowTrends(false)} type="button">
                <X size={18} />
              </button>
            </div>
            <iframe className="graph-iframe" srcDoc={trendViewerSrcDoc("Lab Trends", trends)} title="Global lab trend graphs" />
          </div>
        </div>
      ) : null}
    </>
  );
}

export function LabTestCard({ allTests, test }: { allTests: LabTest[]; test: LabTest }) {
  const trends = useMemo(() => getParameterTrends(test, allTests), [allTests, test]);
  const trendByKey = useMemo(() => new Map(trends.map((trend) => [trend.key, trend])), [trends]);
  const [selectedTrend, setSelectedTrend] = useState<ParameterTrend | null>(null);
  const title = testTitle(test);

  return (
    <>
      <details className="record-card lab-accordion">
        <summary className="lab-summary">
          <div className="lab-title-block">
            <div className="lab-title-row">
              <h3>{title}</h3>
            </div>
            <p className="subtle">
              {formatDisplayDate(test.prescription_date, test.prescription_time)} {test.visit_no ? `- ${test.visit_no}` : ""}
            </p>
          </div>
          <div className="record-actions">
            <button
              className="secondary-button compact-button"
              onClick={(event) => {
                stopSummaryToggle(event);
                downloadLabResultPdf(test);
              }}
              type="button"
            >
              <Download size={16} /> PDF
            </button>
            <span className="pill">{test.conduction_status || "PENDING"}</span>
          </div>
          <ChevronDown className="summary-chevron" size={18} />
        </summary>

        <div className="lab-accordion-body">
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
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {test.parameters.length ? (
                  test.parameters.map((parameter, index) => {
                    const trend = trendByKey.get(parameterKey(parameter));

                    return (
                      <tr key={`${parameter.id || parameter.name || index}`}>
                        <td data-label="Parameter">{parameter.name || parameter.short_name || "Parameter"}</td>
                        <td data-label="Value">
                          <strong>{parameter.value ?? "Not recorded"}</strong>
                        </td>
                        <td data-label="Unit">{parameter.units || ""}</td>
                        <td data-label="Severity">{parameter.severity || ""}</td>
                        <td data-label="Range / Allowed">{parameter.data_allowed || parameter.default_value || ""}</td>
                        <td data-label="Method">{parameter.methodology || ""}</td>
                        <td data-label="Trend">
                          <MiniTrendButton onClick={() => trend && setSelectedTrend(trend)} trend={trend} />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7}>No result parameters recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      {selectedTrend ? (
        <div aria-modal="true" className="graph-modal" role="dialog">
          <div className="graph-modal-card">
            <div className="graph-modal-head">
              <div>
                <strong>{selectedTrend.name}</strong>
                <span>Last {selectedTrend.points.length} readings</span>
              </div>
              <button aria-label="Close trend graph" className="icon-button" onClick={() => setSelectedTrend(null)} type="button">
                <X size={18} />
              </button>
            </div>
            <TrendChart height={320} trend={selectedTrend} />
          </div>
        </div>
      ) : null}
    </>
  );
}
