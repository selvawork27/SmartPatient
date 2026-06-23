export const hmsApiBaseUrl =
  process.env.NEXT_PUBLIC_SMARTHMS_API_URL?.replace(/\/$/, "") || "http://localhost:8000/api";

export const consultationsPath =
  process.env.NEXT_PUBLIC_SMARTHMS_CONSULTATIONS_PATH?.replace(/^\/|\/$/g, "") || "patient-consultations";
