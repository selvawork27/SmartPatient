export const portalApiBaseUrl =
  process.env.NEXT_PUBLIC_PORTAL_API_URL?.replace(/\/$/, "") || "http://localhost:3000";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCjYPQm3zzM-WqQWUT70QXyK2SBoE-HxE0",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "devenvportal-ca93d.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "devenvportal-ca93d",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "devenvportal-ca93d.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "477362729562",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:477362729562:web:227eed9ba22c3896cc5e63",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-J2LWGT7PYF",
};

export const firebasePhoneRegionCode = process.env.NEXT_PUBLIC_FIREBASE_PHONE_REGION_CODE || "+91";
