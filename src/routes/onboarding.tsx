import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, Loader2, AlertTriangle, Zap } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Conectar WhatsApp Business — Vilo × Búho" },
      {
        name: "description",
        content:
          "Inicia el onboarding de tu cuenta de WhatsApp Business con Meta Embedded Signup.",
      },
    ],
  }),
  component: PublicOnboardingPage,
});

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
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-xl">
        {/* Brand Header */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary shadow-2xl shadow-primary/30">
            <MessageCircle className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Vilo × Búho</h1>
            <p className="text-sm text-muted-foreground">WhatsApp Business Onboarding</p>
          </div>
        </div>

        {/* Form Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" />
              <CardTitle className="text-xl">Empecemos</CardTitle>
            </div>
            <CardDescription>
              Cuéntanos quién eres. En el siguiente paso conectarás tu cuenta de
              WhatsApp Business con Meta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del contacto *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={200}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Empresa</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  maxLength={200}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono (opcional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={40}
                  className="h-11"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="h-11 w-full bg-accent text-accent-foreground hover:bg-accent/90"
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
  );
}
