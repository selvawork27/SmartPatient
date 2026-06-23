"use client";

import { useState } from "react";
import { CalendarPlus, ClipboardPlus, FlaskConical, LayoutDashboard, Menu, ReceiptText, X } from "lucide-react";

export type PortalModule = "dashboard" | "profile" | "consultation" | "lab" | "billing" | "appointment";

const modules = [
  { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { id: "consultation" as const, label: "Consultation", icon: ClipboardPlus },
  { id: "lab" as const, label: "Lab Test", icon: FlaskConical },
  { id: "billing" as const, label: "Billing", icon: ReceiptText },
  { id: "appointment" as const, label: "Appointment", icon: CalendarPlus },
];

type ModuleNavProps = {
  active: PortalModule;
  onChange: (module: PortalModule) => void;
  counts: Record<PortalModule, number>;
};

export function ModuleSidebar({
  active,
  onChange,
  counts,
}: ModuleNavProps) {
  return (
    <aside className="module-sidebar">
      <div className="sidebar-title">
        <span>Patient Portal</span>
        <strong>SmartHMS</strong>
      </div>
      {modules.map((module) => {
        const Icon = module.icon;
        return (
          <button className={active === module.id ? "active" : ""} key={module.id} onClick={() => onChange(module.id)}>
            <Icon size={19} />
            <span>{module.label}</span>
            <strong>{counts[module.id]}</strong>
          </button>
        );
      })}
    </aside>
  );
}

export function MobileModuleNav({ active, onChange, counts }: ModuleNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activeModule = modules.find((module) => module.id === active);
  const ActiveIcon = activeModule?.icon || LayoutDashboard;

  return (
    <div className="mobile-menu-shell">
      <button className="mobile-menu-trigger" onClick={() => setIsOpen((value) => !value)} type="button">
        <span>
          <ActiveIcon size={18} />
          {activeModule?.label || "Menu"}
        </span>
        {isOpen ? <X size={19} /> : <Menu size={19} />}
      </button>

      {isOpen ? (
        <div className="mobile-menu-panel">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <button
                className={active === module.id ? "active" : ""}
                key={module.id}
                onClick={() => {
                  onChange(module.id);
                  setIsOpen(false);
                }}
                type="button"
              >
                <Icon size={18} />
                <span>{module.label}</span>
                <strong>{counts[module.id]}</strong>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
