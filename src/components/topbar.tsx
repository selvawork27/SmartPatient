"use client";

import { LogOut, RefreshCw, Stethoscope } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { PatientUser } from "@/types/hms";

function patientName(user: PatientUser | null) {
  if (!user) return "Patient";
  return user.full_name || [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Patient";
}

export function Topbar({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="topbar">
      <div className="brand">
        <span className="brand-mark">
          <Stethoscope size={22} />
        </span>
        <span>SmartPatient</span>
      </div>
      <div className="patient-chip">
        <span>{patientName(user)}</span>
        <button className="icon-button" title="Refresh records" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={18} />
        </button>
        <button className="secondary-button" onClick={handleLogout}>
          <LogOut size={17} />
          Logout
        </button>
      </div>
    </div>
  );
}
