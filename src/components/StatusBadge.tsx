import { cn } from "@/lib/utils";

type ClientStatus =
  "pending" | "onboarding_started" | "in_progress" | "connected" | "onboarding_error" | "error";

const statusStyles: Record<ClientStatus, { label: string; className: string; dot: string }> = {
  pending: {
    label: "Pendiente",
    className: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  onboarding_started: {
    label: "Onboarding iniciado",
    className: "border-warning/40 bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  in_progress: {
    label: "En proceso",
    className: "border-warning/40 bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  connected: {
    label: "Conectado",
    className: "border-success/40 bg-success/10 text-success",
    dot: "bg-success",
  },
  onboarding_error: {
    label: "Error de onboarding",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  error: {
    label: "Error",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

/** Badge de estado de cliente con semántica de color por token. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const s = statusStyles[status as ClientStatus] ?? statusStyles.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        s.className,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}
