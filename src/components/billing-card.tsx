import { ChevronDown } from "lucide-react";
import { FieldList } from "@/components/field-list";
import type { PatientBill } from "@/types/hms";

function money(value: unknown) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(amount);
}

export function BillingCard({ bill }: { bill: PatientBill }) {
  return (
    <details className="record-card billing-accordion">
      <summary className="billing-summary">
        <div>
          <h3>{bill.bill_no || `Bill ${bill.id}`}</h3>
          <p className="subtle">
            {bill.visit_no || "Visit not recorded"} {bill.open_date ? `- ${bill.open_date}` : ""}
          </p>
          <p className="billing-summary-counts">
            {bill.items.length} item{bill.items.length === 1 ? "" : "s"} / {bill.payments.length} payment
            {bill.payments.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="pill">{bill.bill_status || "Status N/A"}</span>
        <ChevronDown className="summary-chevron" size={18} />
      </summary>

      <div className="billing-accordion-body">
        <div className="money-grid">
          <div>
            <span>Gross</span>
            <strong>{money(bill.totals?.gross)}</strong>
          </div>
          <div>
            <span>Discount</span>
            <strong>{money(bill.totals?.discount)}</strong>
          </div>
          <div>
            <span>Paid</span>
            <strong>{money(bill.totals?.paid)}</strong>
          </div>
          <div>
            <span>Due</span>
            <strong>{money(bill.totals?.patient_due)}</strong>
          </div>
        </div>

        <FieldList
          title="Bill Details"
          data={{
            payment_status: bill.payment_status,
            patient_name: bill.patient_name,
            patient_unique_id: bill.patient_unique_id,
            doctor_name: bill.doctor_name,
            department_name: bill.department_name,
            consultation_type: bill.consultation_type,
            primary_claim_no: bill.primary_claim_no,
            primary_claim_status: bill.primary_claim_status,
            primary_claim_approved_amount: bill.primary_claim_approved_amount,
            remarks: bill.remarks,
            cancel_reason: bill.cancel_reason,
            reopen_reason: bill.reopen_reason,
            created_by: bill.created_by,
            closed_by: bill.closed_by,
            finalized_by: bill.finalized_by,
            discharge_date_time: bill.discharge_date_time,
            finalized_date_time: bill.finalized_date_time,
          }}
        />

        <h4 className="table-title">Bill Items</h4>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>Rate</th>
                <th>Qty</th>
                <th>Discount</th>
                <th>Amount</th>
                <th>Sponsor</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.length ? (
                bill.items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Type">{item.bill_item_type || item.charge_head || ""}</td>
                    <td data-label="Description">{item.description || item.diagnostic_test || item.service || item.medicine || ""}</td>
                    <td data-label="Rate">{money(item.rate)}</td>
                    <td data-label="Qty">{item.quantity || ""}</td>
                    <td data-label="Discount">{money(item.discount)}</td>
                    <td data-label="Amount">{money(item.amount)}</td>
                    <td data-label="Sponsor">{money(item.sponsor)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>No bill items recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h4 className="table-title">Payments</h4>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Type</th>
                <th>Mode</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Paid By</th>
              </tr>
            </thead>
            <tbody>
              {bill.payments.length ? (
                bill.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td data-label="Receipt">{payment.receipt_no || ""}</td>
                    <td data-label="Type">{payment.payment_type || ""}</td>
                    <td data-label="Mode">{payment.payment_mode || ""}</td>
                    <td data-label="Amount">{money(payment.pay_amount)}</td>
                    <td data-label="Date">{payment.payment_date || ""}</td>
                    <td data-label="Paid By">{payment.paid_by || payment.user || ""}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>No payments recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
