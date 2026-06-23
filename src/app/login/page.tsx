"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, KeyRound, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { confirmFirebasePhoneOtp, resetFirebasePhoneOtp, sendFirebasePhoneOtp } from "@/lib/firebase-phone";

export default function LoginPage() {
  const router = useRouter();
  const { requestOtp, verifyOtp, token, isReady } = useAuth();
  const [mobileNumber, setMobileNumber] = useState("");
  const [dob, setDob] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isReady && token) router.replace("/dashboard");
  }, [isReady, router, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      if (!otpRequested) {
        await requestOtp(mobileNumber, dob);
        await sendFirebasePhoneOtp(mobileNumber);
        setOtpRequested(true);
        return;
      }
      const firebaseIdToken = await confirmFirebasePhoneOtp(otp);
      await verifyOtp(mobileNumber, dob, firebaseIdToken);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to login");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <div>
          <h1>SmartPatient <p>By SmartHMS</p></h1>
          <p>Secure access for registered patients to review consultations, prescriptions, investigations, bills, and medical documents from SmartHMS.</p>
        </div>
      </section>
      <section className="login-panel">
        <form onSubmit={handleSubmit}>
          <div id="firebase-recaptcha" />
          <span className="eyebrow">SmartPatient Portal</span>
          <h2>View Your Health Records</h2>
          <p className="subtle">
            Use your registered mobile number and date of birth in ddmmyyyy format. Enter the OTP after it is sent.
          </p>

          <div className="field">
            <label htmlFor="mobile">Mobile number</label>
            <div style={{ position: "relative" }}>
              <Smartphone size={18} style={{ left: 12, position: "absolute", top: 13, color: "var(--muted)" }} />
              <input
                id="mobile"
                inputMode="numeric"
                autoComplete="tel"
                value={mobileNumber}
                onChange={(event) => setMobileNumber(event.target.value.replace(/\D/g, "").slice(0, 15))}
                placeholder="9876543210"
                required
                style={{ paddingLeft: 42 }}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="dob">Date of birth</label>
            <div style={{ position: "relative" }}>
              <CalendarDays size={18} style={{ left: 12, position: "absolute", top: 13, color: "var(--muted)" }} />
              <input
                id="dob"
                inputMode="numeric"
                autoComplete="bday"
                value={dob}
                onChange={(event) => setDob(event.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="ddmmyyyy"
                pattern="\d{8}"
                required
                disabled={otpRequested}
                style={{ paddingLeft: 42 }}
              />
            </div>
          </div>

          {otpRequested ? (
          <div className="field">
            <label htmlFor="otp">OTP</label>
            <div style={{ position: "relative" }}>
              <KeyRound size={18} style={{ left: 12, position: "absolute", top: 13, color: "var(--muted)" }} />
              <input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                pattern="\d{6}"
                required
                style={{ paddingLeft: 42 }}
              />
            </div>
          </div>
          ) : null}

          {error ? <div className="error-box">{error}</div> : null}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : otpRequested ? "Verify OTP" : "Send OTP"}
          </button>
          {otpRequested ? (
            <button
              className="secondary-button"
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setOtpRequested(false);
                setOtp("");
                setError("");
                resetFirebasePhoneOtp();
              }}
            >
              Change mobile number
            </button>
          ) : null}
        </form>
      </section>
    </main>
  );
}
