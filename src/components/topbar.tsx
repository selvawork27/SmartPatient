"use client";

import { LogOut, RefreshCw, Stethoscope, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type { PatientUser } from "@/types/hms";

function patientName(user: PatientUser | null) {
  if (!user) return "Patient";
  const invalid = new Set(["na", "n/a", "none", "null", "undefined", "-"]);
  const clean = (value: unknown) => {
    const text = String(value ?? "").trim();
    return text && !invalid.has(text.toLowerCase()) ? text : "";
  };
  return clean(user.full_name) || [clean(user.first_name), clean(user.last_name)].filter(Boolean).join(" ") || clean(user.email) || clean(user.mobile) || clean(user.phone) || "Patient";
}

export function Topbar({ onProfile, onRefresh, refreshing }: { onProfile?: () => void; onRefresh: () => void; refreshing: boolean }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const name = patientName(user);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "P";

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

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
        <button className="icon-button" title="Refresh records" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={18} />
        </button>
        <div className="profile-menu" ref={menuRef}>
          <button className="profile-trigger" type="button" onClick={() => setOpen((value) => !value)} title="Patient profile">
            <span className="avatar-circle">{initials}</span>
            <span className="profile-name">{name}</span>
          </button>
          {open ? (
            <div className="profile-dropdown">
              <div className="profile-card">
                <span className="avatar-circle large">{initials}</span>
                <strong>{name}</strong>
                <small>{user?.patient_unique_id || user?.phone || user?.email || "Registered patient"}</small>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onProfile?.();
                }}
              >
                <UserRound size={16} />
                View profile
              </button>
              <button type="button" onClick={handleLogout}>
                <LogOut size={16} />
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
