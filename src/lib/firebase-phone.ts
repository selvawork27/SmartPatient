"use client";

import { initializeApp, getApps } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { firebaseConfig, firebasePhoneRegionCode } from "@/lib/config";

let confirmationResult: ConfirmationResult | null = null;
let recaptchaVerifier: RecaptchaVerifier | null = null;

function auth() {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return getAuth(app);
}

function e164Phone(mobileNumber: string) {
  const digits = mobileNumber.replace(/\D/g, "");
  if (mobileNumber.trim().startsWith("+")) return `+${digits}`;
  return `${firebasePhoneRegionCode}${digits}`;
}

function verifier() {
  if (recaptchaVerifier) return recaptchaVerifier;
  recaptchaVerifier = new RecaptchaVerifier(auth(), "firebase-recaptcha", {
    size: "invisible",
  });
  return recaptchaVerifier;
}

export async function sendFirebasePhoneOtp(mobileNumber: string) {
  confirmationResult = await signInWithPhoneNumber(auth(), e164Phone(mobileNumber), verifier());
}

export async function confirmFirebasePhoneOtp(otp: string) {
  if (!confirmationResult) throw new Error("Please request the OTP again.");
  const credential = await confirmationResult.confirm(otp);
  return credential.user.getIdToken();
}

export function resetFirebasePhoneOtp() {
  confirmationResult = null;
}
