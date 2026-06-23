import { FieldList } from "@/components/field-list";
import type { HmsProfile, PatientUser } from "@/types/hms";

function value(...items: unknown[]) {
  const invalid = new Set(["na", "n/a", "none", "null", "undefined", "-"]);
  for (const item of items) {
    const text = String(item ?? "").trim();
    if (text && !invalid.has(text.toLowerCase())) return text;
  }
  return "Not recorded";
}

export function ProfilePanel({ profile, user }: { profile?: HmsProfile; user: PatientUser | null }) {
  const raw = {
    ...(profile || {}),
    ...(user?.raw || {}),
  };
  const fullName = value(raw.full_name, user?.full_name, [raw.first_name || user?.first_name, raw.last_name || user?.last_name].filter(Boolean).join(" "));
  const patientId = value(raw.patient_unique_id, raw.hms_patient_id, user?.patient_unique_id, raw.patient_id, user?.patient_id);
  const mobile = value(raw.mobile, raw.phone, user?.mobile, user?.phone);

  return (
    <div className="profile-panel">
      <section className="profile-hero">
        <div className="profile-avatar">{fullName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "P"}</div>
        <div>
          <span className="eyebrow">Patient Profile</span>
          <h3>{fullName}</h3>
          <p className="subtle">{patientId}</p>
        </div>
      </section>

      <div className="profile-stat-grid">
        <div>
          <span>Patient ID</span>
          <strong>{patientId}</strong>
        </div>
        <div>
          <span>Mobile Number</span>
          <strong>{mobile}</strong>
        </div>
        <div>
          <span>Email</span>
          <strong>{value(raw.email, user?.email)}</strong>
        </div>
        <div>
          <span>Gender</span>
          <strong>{value(raw.gender, user?.gender)}</strong>
        </div>
      </div>

      <FieldList
        title="All Patient Details"
        data={{
          patient_id: patientId,
          patient_unique_id: patientId,
          full_name: fullName,
          first_name: raw.first_name || user?.first_name,
          last_name: raw.last_name || user?.last_name,
          mobile_number: mobile,
          phone: raw.phone || user?.phone,
          email: raw.email || user?.email,
          gender: raw.gender || user?.gender,
          owner_id: raw.owner_id || user?.owner_id,
          owner_type: raw.owner_type || user?.owner_type,
          ...raw,
        }}
      />
    </div>
  );
}
