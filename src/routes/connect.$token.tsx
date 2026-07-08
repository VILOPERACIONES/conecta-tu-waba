import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, MessageCircle, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/connect/$token")({
  ssr: false,
  component: ConnectPage,
});

type ValidateResp =
  | { valid: true; client_id: string; client_name: string | null; company_name: string | null }
  | { valid: false; reason: string };

type Phase = "loading" | "invalid" | "ready" | "connecting" | "success" | "error";

function ConnectPage() {
  const { token } = Route.useParams();
  const [phase, setPhase] = useState<Phase>("loading");
  const [info, setInfo] = useState<{ client_name?: string | null; company_name?: string | null; reason?: string; error?: string }>({});
  const [metaConfig, setMetaConfig] = useState<{ appId: string | null; configurationId: string | null; graphApiVersion: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [vRes, cRes] = await Promise.all([
          fetch("/api/public/onboarding/validate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token }),
          }),
          fetch("/api/public/meta-config"),
        ]);
        const v: ValidateResp = await vRes.json();
        const cfg = await cRes.json();
        setMetaConfig(cfg);
        if (!v.valid) {
          setInfo({ reason: v.reason });
          setPhase("invalid");
          return;
        }
        setInfo({ client_name: v.client_name, company_name: v.company_name });
        setPhase("ready");
      } catch (err: any) {
        setInfo({ reason: "network_error" });
        setPhase("invalid");
      }
    })();
  }, [token]);

  // Load Meta Facebook SDK once we're ready and have config
  useEffect(() => {
    if (phase !== "ready" || !metaConfig?.appId) return;
    if ((window as any).FB) return;
    (window as any).fbAsyncInit = function () {
      (window as any).FB.init({
        appId: metaConfig.appId,
        cookie: true,
        xfbml: true,
        version: metaConfig.graphApiVersion ?? "v21.0",
      });
    };
    const s = document.createElement("script");
    s.async = true;
    s.defer = true;
    s.crossOrigin = "anonymous";
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    document.body.appendChild(s);
  }, [phase, metaConfig]);

  const launchSignup = () => {
    const FB = (window as any).FB;
    if (!FB || !metaConfig?.configurationId) {
      setInfo({ error: "El SDK de Meta aún no está listo. Recarga la página." });
      setPhase("error");
      return;
    }
    setPhase("connecting");

    // Session logging callback (best-effort, receives waba_id / phone_number_id via message events)
    let capturedWaba: string | undefined;
    let capturedPhone: string | undefined;
    let capturedBusiness: string | undefined;

    const messageListener = (event: MessageEvent) => {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP") {
          const payload = data.data ?? {};
          capturedWaba = payload.waba_id ?? capturedWaba;
          capturedPhone = payload.phone_number_id ?? capturedPhone;
          capturedBusiness = payload.business_id ?? capturedBusiness;
        }
      } catch { /* ignore */ }
    };
    window.addEventListener("message", messageListener);

    FB.login(
      async (response: any) => {
        window.removeEventListener("message", messageListener);
        if (!response?.authResponse) {
          setInfo({ error: "Cancelaste la conexión con Facebook." });
          setPhase("error");
          return;
        }
        // TODO Meta: prefer `code` from Embedded Signup response for Tech Provider flow.
        // Fallback: use accessToken if available.
        const code = response.authResponse.code ?? response.authResponse.accessToken;
        try {
          const res = await fetch("/api/public/onboarding/complete", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              token,
              code,
              waba_id: capturedWaba,
              phone_number_id: capturedPhone,
              business_id: capturedBusiness,
            }),
          });
          const json = await res.json();
          if (!res.ok || !json.ok) {
            setInfo({ error: json.error ?? "Error al completar el onboarding." });
            setPhase("error");
            return;
          }
          setPhase("success");
        } catch (err: any) {
          setInfo({ error: err.message ?? "Error de red." });
          setPhase("error");
        }
      },
      {
        config_id: metaConfig.configurationId,
        response_type: "code",
        override_default_response_type: true,
        // TODO Meta: extras exactos para WhatsApp Business App Onboarding / Coexistence
        extras: {
          feature: "whatsapp_business_app_onboarding",
          setup: {},
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
            <MessageCircle className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">Conectar WhatsApp Business</span>
        </div>

        {phase === "loading" && (
          <Card><CardContent className="flex items-center gap-3 py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Validando enlace…</span>
          </CardContent></Card>
        )}

        {phase === "invalid" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle>Enlace no válido</CardTitle>
              </div>
              <CardDescription>
                {info.reason === "expired" && "Este enlace expiró. Solicita uno nuevo a tu proveedor."}
                {info.reason === "already_used" && "Este enlace ya fue utilizado."}
                {info.reason === "not_found" && "No encontramos este enlace."}
                {info.reason === "network_error" && "No pudimos validar el enlace. Revisa tu conexión."}
                {!["expired", "already_used", "not_found", "network_error"].includes(info.reason ?? "") && "Enlace inválido."}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {phase === "ready" && (
          <Card>
            <CardHeader>
              <CardTitle>Hola{info.client_name ? `, ${info.client_name}` : ""}</CardTitle>
              <CardDescription>
                {info.company_name ? `Vamos a conectar la cuenta de ${info.company_name} con WhatsApp Business.` : "Vamos a conectar tu cuenta de WhatsApp Business."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3"><span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">1</span>Inicia sesión con Facebook usando una cuenta administradora de tu negocio.</li>
                <li className="flex gap-3"><span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">2</span>Selecciona tu negocio y tu cuenta de WhatsApp Business.</li>
                <li className="flex gap-3"><span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">3</span>Conecta el número de teléfono que quieres usar.</li>
                <li className="flex gap-3"><span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">4</span>Si Meta lo solicita, escanea el código QR desde la app de WhatsApp Business.</li>
              </ol>

              <div className="flex items-start gap-2 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 flex-shrink-0 text-primary" />
                <span>Tus credenciales de Meta nunca pasan por nuestro navegador. La conexión se completa de forma segura en nuestro servidor.</span>
              </div>

              <Button onClick={launchSignup} size="lg" className="w-full" disabled={!metaConfig?.appId || !metaConfig?.configurationId}>
                Conectar WhatsApp Business
              </Button>
              {(!metaConfig?.appId || !metaConfig?.configurationId) && (
                <p className="text-xs text-warning-foreground bg-warning/20 border border-warning/40 rounded p-2">
                  La configuración de Meta aún no está lista. Contacta a tu administrador.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {phase === "connecting" && (
          <Card><CardContent className="flex items-center gap-3 py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm">Conectando con Meta…</span>
          </CardContent></Card>
        )}

        {phase === "success" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="h-6 w-6" />
                <CardTitle>¡Conexión completada!</CardTitle>
              </div>
              <CardDescription>Ya puedes cerrar esta página. Tu proveedor recibirá la confirmación automáticamente.</CardDescription>
            </CardHeader>
          </Card>
        )}

        {phase === "error" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle>No pudimos completar la conexión</CardTitle>
              </div>
              <CardDescription>{info.error ?? "Intenta nuevamente."}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => setPhase("ready")}>Reintentar</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
