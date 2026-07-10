import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand/BrandMark";
import { StepIndicator } from "@/components/brand/StepIndicator";
import {
  Loader2,
  AlertTriangle,
  Zap,
  User,
  Mail,
  Building2,
  Phone,
  ShieldCheck,
  Timer,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Conectar WhatsApp Business — Vilo × Búho" },
      {
        name: "description",
        content: "Inicia el onboarding de tu cuenta de WhatsApp Business con Meta Embedded Signup.",
      },
    ],
  }),
  component: PublicOnboardingPage,
});

const trustPoints = [
  {
    icon: ShieldCheck,
    title: "Conexión oficial con Meta",
    description: "Usamos Meta Embedded Signup, el flujo oficial para WhatsApp Business API.",
  },
  {
    icon: Lock,
    title: "Tus credenciales están seguras",
    description: "Nunca pasan por nuestro navegador: la conexión se completa en nuestro servidor.",
  },
  {
    icon: Timer,
    title: "Activación en minutos",
    description: "Completa tus datos y conecta tu número desde la app de WhatsApp Business.",
  },
];

function PublicOnboardingPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Ingresa tu nombre.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError("Ingresa un email válido.");
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/public/onboarding/self-start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company_name: company.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.token) {
        setError(json.error ?? "No pudimos iniciar el onboarding.");
        setSubmitting(false);
        return;
      }
      // Reuse existing /connect/:token flow to drive Meta Embedded Signup.
      navigate({ to: "/connect/$token", params: { token: json.token } });
    } catch (err: any) {
      setError(err?.message ?? "Error de red.");
      setSubmitting(false);
    }
  };

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

      <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl gap-10 px-4 py-10 sm:py-14 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-16">
        {/* Brand / value proposition panel */}
        <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col items-center gap-8 text-center duration-500 lg:items-start lg:text-left">
          <BrandMark size="md" />
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Conecta tu WhatsApp Business en minutos
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Vilo × Búho activan tu cuenta oficial de WhatsApp Business API con Meta, de forma
              segura y sin fricción.
            </p>
          </div>

          <ul className="hidden w-full max-w-md space-y-4 lg:block">
            {trustPoints.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex items-start gap-3 text-left">
                <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Form panel */}
        <div className="animate-in fade-in slide-in-from-bottom-2 mx-auto w-full max-w-md delay-150 duration-500 fill-mode-both">
          <StepIndicator steps={["Tus datos", "Conectar WhatsApp"]} current={0} className="mb-6" />

          <Card className="border-border/60 bg-card/80 shadow-glow-primary backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-accent" />
                <CardTitle className="font-display text-xl">Empecemos</CardTitle>
              </div>
              <CardDescription>
                Cuéntanos quién eres. En el siguiente paso conectarás tu cuenta de WhatsApp Business
                con Meta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del contacto *</Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={200}
                      required
                      className="h-11 pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={255}
                      required
                      className="h-11 pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Empresa</Label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      maxLength={200}
                      className="h-11 pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono (opcional)</Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={40}
                      className="h-11 pl-9"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  size="xl"
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Preparando…
                    </>
                  ) : (
                    "Continuar a Meta"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground">
              Powered by <span className="font-semibold text-accent">Vilo AI Studio</span> ×{" "}
              <span className="font-semibold text-primary">Búho Solutions</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
