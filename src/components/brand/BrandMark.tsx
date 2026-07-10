import { cn } from "@/lib/utils";
import viloLogo from "@/assets/vilo-logo-white.png.asset.json";
import buhoLogo from "@/assets/buho-logo-white.png.asset.json";

const logoHeight: Record<"sm" | "md" | "lg", string> = {
  sm: "h-4",
  md: "h-6",
  lg: "h-8",
};

interface BrandMarkProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Lockup Vilo × Búho reutilizable en headers y footers de marca. */
export function BrandMark({ size = "md", className }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={viloLogo.url}
        alt="Vilo"
        className={cn(logoHeight[size], "w-auto brightness-0 invert")}
      />
      <span className="text-sm text-muted-foreground/60" aria-hidden>
        ×
      </span>
      <img
        src={buhoLogo.url}
        alt="Búho"
        className={cn(logoHeight[size], "w-auto brightness-0 invert")}
      />
    </div>
  );
}

const badgePadding: Record<"sm" | "md" | "lg", string> = {
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

/** Panel de vidrio que envuelve el BrandMark, reemplaza al ícono genérico usado en headers de páginas públicas. */
export function BrandBadge({ size = "lg", className }: BrandMarkProps) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-2xl border border-border/60 bg-card/80 shadow-glow-primary backdrop-blur-sm",
        badgePadding[size],
        className,
      )}
    >
      <BrandMark size={size} />
    </div>
  );
}
