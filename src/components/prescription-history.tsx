"use client";

import { useMemo, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { requestRepeatPrescription } from "@/lib/hms-client";
import { formatDisplayDate } from "@/lib/format";
import type { PrescriptionHistoryItem } from "@/types/hms";

type RequestState = Record<string, "idle" | "sending" | "sent" | "error">;
type SelectionState = Record<string, boolean>;

function statusClass(status: PrescriptionHistoryItem["dispensingStatus"]) {
  if (status === "Dispensed") return "booked";
  if (status === "Expired") return "cancelled";
  return "completed";
}

function groupByVisit(items: PrescriptionHistoryItem[]) {
  const groups = new Map<string, PrescriptionHistoryItem[]>();

  for (const item of items) {
    const key = item.visitNo || item.visitId || "Visit not recorded";
    groups.set(key, [...(groups.get(key) || []), item]);
  }

  return Array.from(groups.entries()).map(([visitLabel, prescriptions]) => ({
    visitLabel,
    prescriptions,
    date: prescriptions[0]?.date,
    doctor: prescriptions[0]?.prescribedBy,
  }));
}

function PrescriptionVisitGroup({
  group,
  onRepeatSelected,
  requestState,
  selected,
  onToggle,
  onToggleVisit,
}: {
  group: ReturnType<typeof groupByVisit>[number];
  onRepeatSelected: (items: PrescriptionHistoryItem[]) => void;
  requestState: RequestState;
  selected: SelectionState;
  onToggle: (itemId: string, checked: boolean) => void;
  onToggleVisit: (items: PrescriptionHistoryItem[], checked: boolean) => void;
}) {
  const selectable = group.prescriptions.filter((item) => requestState[item.id] !== "sending" && requestState[item.id] !== "sent");
  const selectedItems = selectable.filter((item) => selected[item.id]);
  const allSelected = selectable.length > 0 && selectable.every((item) => selected[item.id]);
  const isSubmitting = group.prescriptions.some((item) => requestState[item.id] === "sending");

  return (
    <details className="prescription-visit-group">
      <summary className="visit-group-header prescription-visit-header">
        <div>
          <h3>{group.visitLabel}</h3>
          <p className="subtle">{[formatDisplayDate(group.date), group.doctor].filter(Boolean).join(" - ")}</p>
        </div>
        <span className="pill closed">
          {group.prescriptions.length} medicine{group.prescriptions.length === 1 ? "" : "s"}
        </span>
        <ChevronDown className="summary-chevron" size={18} />
      </summary>

      <div className="prescription-table-toolbar">
        <label className="checkbox-label">
          <input
            checked={allSelected}
            disabled={!selectable.length}
            onChange={(event) => onToggleVisit(selectable, event.target.checked)}
            type="checkbox"
          />
          Select all
        </label>
        <button
          className="secondary-button repeat-button"
          disabled={!selectedItems.length || isSubmitting}
          onClick={() => onRepeatSelected(selectedItems)}
          type="button"
        >
          <RefreshCw size={16} /> Repeat selected {selectedItems.length ? `(${selectedItems.length})` : ""}
        </button>
      </div>

      <div className="responsive-table prescription-table">
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Medication</th>
              <th>Generic / Brand</th>
              <th>Dose</th>
              <th>Frequency</th>
              <th>Duration</th>
              <th>Date</th>
              <th>Prescribed by</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {group.prescriptions.map((item) => {
              const requestStatus = requestState[item.id] || "idle";
              const disabled = requestStatus === "sending" || requestStatus === "sent";

              return (
                <tr className={item.isActive ? "active-medicine-row" : ""} key={item.id}>
                  <td data-label="Select">
                    <input
                      aria-label={`Select ${item.medicationName}`}
                      checked={Boolean(selected[item.id])}
                      disabled={disabled}
                      onChange={(event) => onToggle(item.id, event.target.checked)}
                      type="checkbox"
                    />
                  </td>
                  <td data-label="Medication">
                    <strong>{item.medicationName}</strong>
                  </td>
                  <td data-label="Generic / Brand">{[item.genericName, item.brandName].filter(Boolean).join(" / ") || "Not recorded"}</td>
                  <td data-label="Dose">{item.dose || "Not recorded"}</td>
                  <td data-label="Frequency">{item.frequency || "Not recorded"}</td>
                  <td data-label="Duration">{item.duration || "Not recorded"}</td>
                  <td data-label="Date">{formatDisplayDate(item.date)}</td>
                  <td data-label="Prescribed by">{item.prescribedBy || "Not recorded"}</td>
                  <td data-label="Status">
                    <span className={`appointment-status ${statusClass(item.dispensingStatus)}`}>
                      {requestStatus === "sending"
                        ? "Requesting"
                        : requestStatus === "sent"
                          ? "Requested"
                          : requestStatus === "error"
                            ? "Retry"
                            : item.dispensingStatus}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function PrescriptionHistory({
  prescriptions,
  token,
}: {
  prescriptions: PrescriptionHistoryItem[];
  token: string;
}) {
  const [requestState, setRequestState] = useState<RequestState>({});
  const [selected, setSelected] = useState<SelectionState>({});
  const visitGroups = useMemo(() => groupByVisit(prescriptions), [prescriptions]);

  function handleToggle(itemId: string, checked: boolean) {
    setSelected((state) => ({ ...state, [itemId]: checked }));
  }

  function handleToggleVisit(items: PrescriptionHistoryItem[], checked: boolean) {
    setSelected((state) => {
      const next = { ...state };
      for (const item of items) next[item.id] = checked;
      return next;
    });
  }

  async function handleRepeatSelected(items: PrescriptionHistoryItem[]) {
    setRequestState((state) => ({
      ...state,
      ...Object.fromEntries(items.map((item) => [item.id, "sending" as const])),
    }));

    try {
      await requestRepeatPrescription(
        token,
        items.map((item) => item.id),
      );
      setRequestState((state) => ({
        ...state,
        ...Object.fromEntries(items.map((item) => [item.id, "sent" as const])),
      }));
      setSelected((state) => ({
        ...state,
        ...Object.fromEntries(items.map((item) => [item.id, false])),
      }));
    } catch {
      setRequestState((state) => ({
        ...state,
        ...Object.fromEntries(items.map((item) => [item.id, "error" as const])),
      }));
    }
  }

  if (!prescriptions.length) return <div className="empty-state">No medicine prescriptions found.</div>;

  return (
    <div className="prescription-history">
      <section className="record-section">
        <div className="table-title">Medicine prescriptions by visit</div>
        <div className="prescription-visit-list">
          {visitGroups.length ? (
            visitGroups.map((group) => (
              <PrescriptionVisitGroup
                group={group}
                key={group.visitLabel}
                onRepeatSelected={handleRepeatSelected}
                onToggle={handleToggle}
                onToggleVisit={handleToggleVisit}
                requestState={requestState}
                selected={selected}
              />
            ))
          ) : (
            <div className="empty-state compact">No medicine prescriptions found.</div>
          )}
        </div>
      </section>
    </div>
  );
}
