import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Shield, LinkIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <MessageCircle className="h-5 w-5" />
            </div>
            <span className="font-semibold">WhatsApp Onboarding</span>
          </div>
          <Link
            to="/auth"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Entrar al panel
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Panel interno · Tech Provider
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
            Onboarding de WhatsApp Business con coexistencia
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Genera enlaces únicos para tus clientes, conéctalos con Meta Embedded Signup
            y automatiza el envío y recepción de mensajes desde n8n.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-20 grid max-w-4xl gap-6 sm:grid-cols-3">
          {[
            { icon: LinkIcon, title: "Enlace único", desc: "Crea un token seguro por cliente con vencimiento." },
            { icon: Shield, title: "Sin exponer secretos", desc: "Toda la integración con Meta ocurre en el servidor." },
            { icon: MessageCircle, title: "n8n listo", desc: "Reenvío automático de webhooks a tu instancia de n8n." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-lg border bg-card p-6">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
