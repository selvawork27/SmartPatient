import type { LucideIcon } from "lucide-react";

export function MetricCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <Icon size={20} color="var(--accent)" aria-hidden="true" />
    </div>
  );
}
