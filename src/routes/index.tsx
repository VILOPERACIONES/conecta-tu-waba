import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, LinkIcon, Zap } from "lucide-react";
import viloLogo from "@/assets/vilo-logo-white.png.asset.json";
import { BrandMark } from "@/components/brand/BrandMark";

export const Route = createFileRoute("/")({
  component: Landing,
});

const features = [
  {
    icon: LinkIcon,
    title: "Enlace único",
    desc: "Crea un token seguro por cliente con vencimiento automático.",
    iconClass: "bg-primary/15 text-primary",
  },
  {
    icon: Shield,
    title: "Sin exponer secretos",
    desc: "Toda la integración con Meta ocurre en el servidor de forma segura.",
    iconClass: "bg-accent/15 text-accent",
  },
  {
    icon: Zap,
    title: "n8n listo",
    desc: "Reenvío automático de webhooks a tu instancia de n8n.",
    iconClass: "bg-success/15 text-success",
  },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="glow-primary pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="glow-accent pointer-events-none absolute -left-40 bottom-0 h-[420px] w-[420px] rounded-full blur-3xl"
      />

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={viloLogo.url} alt="Vilo" className="h-8 w-auto brightness-0 invert" />
            <span className="text-xs font-medium text-muted-foreground">WhatsApp Onboarding</span>
          </div>
          <Link
            to="/auth"
            className="inline-flex h-10 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-accent-foreground transition-all hover:scale-105 hover:shadow-lg hover:shadow-accent/20"
          >
            Entrar al panel
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container relative z-10 mx-auto px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="animate-in fade-in slide-in-from-bottom-2 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent duration-500">
            <Zap className="h-4 w-4" />
            Panel profesional · Tech Provider
          </div>
          <h1 className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both mt-8 font-display text-5xl font-bold tracking-tight text-foreground delay-100 duration-500 sm:text-6xl lg:text-7xl">
            Onboarding de WhatsApp Business
            <span className="block text-accent">con Vilo × Búho</span>
          </h1>
          <p className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both mt-6 text-xl text-muted-foreground delay-200 duration-500 sm:text-2xl">
            Genera enlaces únicos para tus clientes, conéctalos con Meta Embedded Signup y
            automatiza el envío y recepción de mensajes desde n8n.
          </p>
          <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both mt-10 flex flex-wrap justify-center gap-4 delay-300 duration-500">
            <Link
              to="/auth"
              className="inline-flex h-12 items-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground transition-all hover:scale-105 hover:shadow-glow-primary"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/onboarding"
              className="inline-flex h-12 items-center rounded-lg border-2 border-border bg-card px-8 text-base font-semibold text-foreground transition-all hover:scale-105 hover:border-accent/50 hover:shadow-glow-accent"
            >
              Ver demo
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mx-auto mt-24 grid max-w-5xl gap-8 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, desc, iconClass }) => (
            <div
              key={title}
              className="group rounded-2xl border border-border/50 bg-card/80 p-8 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/50 hover:shadow-glow-accent"
            >
              <div
                className={`inline-flex h-14 w-14 items-center justify-center rounded-xl ${iconClass}`}
              >
                <Icon className="h-7 w-7" />
              </div>
              <h3 className="mt-6 font-display text-xl font-bold text-foreground">{title}</h3>
              <p className="mt-3 text-base text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-24 border-t border-border/50 pt-8">
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <span className="text-sm text-muted-foreground">Powered by</span>
            <BrandMark size="sm" />
          </div>
        </div>
      </main>
    </div>
  );
}
