import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, LinkIcon, Zap } from "lucide-react";
import viloLogo from "@/assets/vilo-logo-white.png.asset.json";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              src={viloLogo.url}
              alt="Vilo"
              className="h-8 w-auto brightness-0 invert"
            />
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
      <main className="container mx-auto px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent-foreground">
            <Zap className="h-4 w-4" />
            Panel profesional · Tech Provider
          </div>
          <h1 className="mt-8 text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Onboarding de WhatsApp Business
            <span className="block text-accent">con Vilo × Búho</span>
          </h1>
          <p className="mt-6 text-xl text-muted-foreground sm:text-2xl">
            Genera enlaces únicos para tus clientes, conéctalos con Meta Embedded Signup
            y automatiza el envío y recepción de mensajes desde n8n.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link
              to="/auth"
              className="inline-flex h-12 items-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary/30"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/onboarding"
              className="inline-flex h-12 items-center rounded-lg border-2 border-border bg-card px-8 text-base font-semibold text-foreground transition-all hover:scale-105 hover:border-accent/50"
            >
              Ver demo
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mx-auto mt-24 grid max-w-5xl gap-8 sm:grid-cols-3">
          {[
            {
              icon: LinkIcon,
              title: "Enlace único",
              desc: "Crea un token seguro por cliente con vencimiento automático.",
              color: "bg-primary",
            },
            {
              icon: Shield,
              title: "Sin exponer secretos",
              desc: "Toda la integración con Meta ocurre en el servidor de forma segura.",
              color: "bg-accent",
            },
            {
              icon: Zap,
              title: "n8n listo",
              desc: "Reenvío automático de webhooks a tu instancia de n8n.",
              color: "bg-secondary",
            },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div
              key={title}
              className="group rounded-2xl border border-border/50 bg-card p-8 transition-all hover:border-accent/50 hover:shadow-xl hover:shadow-accent/5"
            >
              <div className={`inline-flex h-14 w-14 items-center justify-center rounded-xl ${color} shadow-lg`}>
                <Icon className="h-7 w-7 text-primary-foreground" />
              </div>
              <h3 className="mt-6 text-xl font-bold text-foreground">{title}</h3>
              <p className="mt-3 text-base text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-24 border-t border-border/50 pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Powered by <span className="font-semibold text-accent">Vilo AI Studio</span> ×{" "}
            <span className="font-semibold text-primary">Búho Solutions</span>
          </p>
        </div>
      </main>
    </div>
  );
}
