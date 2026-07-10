import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandMark } from "@/components/brand/BrandMark";
import { StepIndicator } from "@/components/brand/StepIndicator";
import { CheckCircle2, ShieldCheck, Loader2, AlertTriangle, Zap } from "lucide-react";

const CONNECT_STEPS = [
  "Inicia sesión con Facebook usando una cuenta administradora de tu negocio.",
  "Selecciona tu negocio y tu cuenta de WhatsApp Business.",
  "Conecta el número de teléfono que quieres usar.",
  "Si Meta lo solicita, escanea el código QR desde la app de WhatsApp Business.",
];

export const Route = createFileRoute("/connect/$token")({
  ssr: false,
  component: ConnectPage,
});

declare global {
  interface Window {
    FB?: {
      init: (options: Record<string, unknown>) => void;
      login: (
        callback: (response: MetaLoginResponse) => void,
        options: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type ValidateResp =
  | { valid: true; client_id: string; client_name: string | null; company_name: string | null }
  | { valid: false; reason: string };

type Phase = "loading" | "invalid" | "ready" | "connecting" | "success" | "error";

type MetaLoginResponse = {
  authResponse?: {
    code?: string;
    accessToken?: string;
  };
  status?: string;
  error?: string;
  error_message?: string;
};

type MetaConfig = {
  appId: string | null;
  configurationId: string | null;
  graphApiVersion: string;
};

type SignupCapture = {
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
  errorMessage?: string;
  opened: boolean;
};

const META_SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";
const META_GRAPH_API_VERSION = "v25.0";
const EMBEDDED_SIGNUP_TIMEOUT_MS = 15_000;
const EMBEDDED_SIGNUP_TIMEOUT_MESSAGE =
  "No se pudo abrir Meta Embedded Signup. Revisa App ID, Configuration ID y dominios autorizados.";

let facebookSdkPromise: Promise<void> | null = null;
let initializedMetaAppId: string | null = null;

const readMetaConfig = (serverConfig?: Partial<MetaConfig>): MetaConfig => ({
  appId: import.meta.env.VITE_META_APP_ID ?? serverConfig?.appId ?? null,
  configurationId:
    import.meta.env.VITE_META_CONFIGURATION_ID ?? serverConfig?.configurationId ?? null,
  graphApiVersion: META_GRAPH_API_VERSION,
});

const extractMetaError = (response: MetaLoginResponse) =>
  response.error_message ??
  response.error ??
  (response.status
    ? `Meta respondió con estado: ${response.status}`
    : "Meta canceló o rechazó la conexión.");

const initializeFacebookSdk = (appId: string) => {
  if (!window.FB) {
    throw new Error("Facebook SDK loaded but window.FB is unavailable.");
  }

  window.FB.init({
    appId,
    cookie: true,
    xfbml: false,
    version: META_GRAPH_API_VERSION,
  });
  initializedMetaAppId = appId;
  console.log("FB initialized");
};

const readSignupPayload = (event: MessageEvent, capture: SignupCapture) => {
  if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com")
    return;

  try {
    const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
    if (data?.type !== "WA_EMBEDDED_SIGNUP") return;

    const payload = data.data ?? {};
    const eventName = payload.event ?? data.event;
    capture.opened = true;

    if (eventName === "ERROR") {
      capture.errorMessage =
        payload.error_message ?? payload.error ?? "Meta Embedded Signup devolvió un error.";
    }

    capture.wabaId = payload.waba_id ?? capture.wabaId;
    capture.phoneNumberId = payload.phone_number_id ?? capture.phoneNumberId;
    capture.businessId = payload.business_id ?? capture.businessId;
  } catch {
    // Ignore non-JSON postMessage events from Meta.
  }
};

const loadFacebookSdk = (appId: string): Promise<void> => {
  if (window.FB) {
    if (initializedMetaAppId !== appId) initializeFacebookSdk(appId);
    return Promise.resolve();
  }
  if (facebookSdkPromise) return facebookSdkPromise;

  facebookSdkPromise = new Promise((resolve, reject) => {
    console.log("Loading Facebook SDK");

    window.fbAsyncInit = () => {
      try {
        initializeFacebookSdk(appId);
        resolve();
      } catch (err) {
        reject(err instanceof Error ? err : new Error("No se pudo inicializar Facebook SDK."));
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${META_SDK_SRC}"]`,
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => console.log("Facebook SDK loaded"), {
        once: true,
      });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("No se pudo cargar Facebook SDK.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = META_SDK_SRC;
    script.onload = () => console.log("Facebook SDK loaded");
    script.onerror = () => {
      facebookSdkPromise = null;
      reject(new Error("No se pudo cargar Facebook SDK."));
    };
    document.body.appendChild(script);
  });

  return facebookSdkPromise;
};

function ConnectPage() {
  const { token } = Route.useParams();
  const [phase, setPhase] = useState<Phase>("loading");
  const [info, setInfo] = useState<{
    client_name?: string | null;
    company_name?: string | null;
    reason?: string;
    error?: string;
  }>({});
  const [metaConfig, setMetaConfig] = useState<MetaConfig | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

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
        const cfg = readMetaConfig(await cRes.json());
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

  useEffect(() => {
    if (phase !== "ready" || !metaConfig?.appId) return;
    let cancelled = false;

    loadFacebookSdk(metaConfig.appId)
      .then(() => {
        if (!cancelled) setSdkReady(true);
      })
      .catch((err: Error) => {
        console.log("Embedded Signup error", err);
        if (!cancelled) {
          setInfo({ error: err.message });
          setPhase("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [phase, metaConfig]);

  const launchSignup = () => {
    if (!metaConfig?.appId) {
      setInfo({ error: "Falta configurar VITE_META_APP_ID." });
      setPhase("error");
      return;
    }

    if (!metaConfig.configurationId) {
      setInfo({ error: "Falta configurar VITE_META_CONFIGURATION_ID." });
      setPhase("error");
      return;
    }

    if (!window.FB || !sdkReady) {
      setInfo({
        error: "El SDK de Meta aún no está listo. Recarga la página e inténtalo de nuevo.",
      });
      setPhase("error");
      return;
    }

    setPhase("connecting");

    console.log("Opening Embedded Signup");
    const capture: SignupCapture = { opened: false };
    let settled = false;
    let timeoutId: number | undefined;

    const markOpened = () => {
      capture.opened = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };

    // Normal (non-async) listener that delegates to an async handler.
    const processSignupMessage = async (event: MessageEvent) => {
      const wasOpened = capture.opened;
      readSignupPayload(event, capture);
      if (!wasOpened && capture.opened) markOpened();
      if (capture.errorMessage) fail(capture.errorMessage);
    };
    const messageListener = (event: MessageEvent) => {
      processSignupMessage(event).catch((err: Error) => {
        console.error("Embedded Signup failed", err);
        fail(err?.message ?? "Error procesando mensaje de Meta.");
      });
    };

    const cleanup = () => {
      window.removeEventListener("message", messageListener);
      window.removeEventListener("blur", markOpened);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };

    const fail = (message: string, response?: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      console.log("Embedded Signup failed", response ?? message);
      setInfo({ error: message });
      setPhase("error");
    };

    window.addEventListener("message", messageListener);
    window.addEventListener("blur", markOpened, { once: true });

    timeoutId = window.setTimeout(() => {
      if (settled) return;
      fail(EMBEDDED_SIGNUP_TIMEOUT_MESSAGE);
    }, EMBEDDED_SIGNUP_TIMEOUT_MS);

    const handleFacebookLoginResponse = async (response: MetaLoginResponse) => {
      if (settled) return;
      cleanup();
      console.log("FB.login response", response);

      const code = response.authResponse?.code;
      if (!code) {
        fail(extractMetaError(response), response);
        return;
      }

      if (!capture.wabaId || !capture.phoneNumberId) {
        fail(
          capture.errorMessage ??
            "Meta no devolvió WABA ID y Phone Number ID. No se marcó la conexión como completada.",
          {
            response,
            captured: capture,
          },
        );
        return;
      }

      try {
        const res = await fetch("/api/public/onboarding/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token,
            code,
            waba_id: capture.wabaId,
            phone_number_id: capture.phoneNumberId,
            business_id: capture.businessId,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          fail(
            json.detail?.error?.message ?? json.error ?? "Error al completar el onboarding.",
            json,
          );
          return;
        }
        settled = true;
        console.log("Embedded Signup completed");
        setPhase("success");
      } catch (err: any) {
        fail(err?.message ?? "Error de red.");
      }
    };

    window.FB.login(
      function (response: MetaLoginResponse) {
        handleFacebookLoginResponse(response).catch((error: Error) => {
          console.error("Embedded Signup failed", error);
          fail(error?.message ?? "Error inesperado en Embedded Signup.");
        });
      },
      {
        config_id: metaConfig.configurationId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
        },
      },
    );
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
        {/* Brand panel */}
        <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col items-center gap-8 text-center duration-500 lg:items-start lg:text-left">
          <BrandMark size="md" />
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Ya casi está listo{info.client_name ? `, ${info.client_name}` : ""}
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              {info.company_name
                ? `Vamos a conectar la cuenta de ${info.company_name} con WhatsApp Business.`
                : "Vamos a conectar tu cuenta de WhatsApp Business con Meta."}
            </p>
          </div>

          <div className="hidden w-full max-w-md items-start gap-3 rounded-xl border border-accent/30 bg-accent/10 p-4 text-left lg:flex">
            <ShieldCheck className="h-5 w-5 flex-shrink-0 text-accent" />
            <p className="text-sm text-accent">
              Tus credenciales de Meta nunca pasan por nuestro navegador. La conexión se completa de
              forma segura en nuestro servidor.
            </p>
          </div>
        </div>

        {/* Status panel */}
        <div className="animate-in fade-in slide-in-from-bottom-2 mx-auto w-full max-w-md delay-150 duration-500 fill-mode-both">
          <StepIndicator steps={["Tus datos", "Conectar WhatsApp"]} current={1} className="mb-6" />

          {phase === "loading" && (
            <Card className="border-border/60 bg-card/80 shadow-glow-primary backdrop-blur-sm">
              <CardContent className="flex items-center gap-3 py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Validando enlace…</span>
              </CardContent>
            </Card>
          )}

          {phase === "invalid" && (
            <Card className="border-border/60 bg-card/80 shadow-glow-primary backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <CardTitle className="font-display">Enlace no válido</CardTitle>
                </div>
                <CardDescription>
                  {info.reason === "expired" &&
                    "Este enlace expiró. Solicita uno nuevo a tu proveedor."}
                  {info.reason === "already_used" && "Este enlace ya fue utilizado."}
                  {info.reason === "not_found" && "No encontramos este enlace."}
                  {info.reason === "network_error" &&
                    "No pudimos validar el enlace. Revisa tu conexión."}
                  {!["expired", "already_used", "not_found", "network_error"].includes(
                    info.reason ?? "",
                  ) && "Enlace inválido."}
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {phase === "ready" && (
            <Card className="border-border/60 bg-card/80 shadow-glow-primary backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-accent" />
                  <CardTitle className="font-display text-xl">
                    Hola{info.client_name ? `, ${info.client_name}` : ""}
                  </CardTitle>
                </div>
                <CardDescription>Sigue estos pasos para conectar tu número.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ol>
                  {CONNECT_STEPS.map((text, i) => (
                    <li key={text} className="relative flex gap-3 pb-6 text-sm last:pb-0">
                      {i < CONNECT_STEPS.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute left-3 top-7 h-[calc(100%-1.75rem)] w-px bg-border"
                        />
                      )}
                      <span className="relative z-10 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{text}</span>
                    </li>
                  ))}
                </ol>

                <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs text-accent lg:hidden">
                  <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                  <span>
                    Tus credenciales de Meta nunca pasan por nuestro navegador. La conexión se
                    completa de forma segura en nuestro servidor.
                  </span>
                </div>

                <Button
                  onClick={launchSignup}
                  size="xl"
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={!metaConfig?.appId || !metaConfig?.configurationId || !sdkReady}
                >
                  Conectar WhatsApp Business
                </Button>
                {(!metaConfig?.appId || !metaConfig?.configurationId) && (
                  <p className="rounded-lg border border-warning/40 bg-warning/20 p-2 text-xs text-warning">
                    La configuración de Meta aún no está lista. Contacta a tu administrador.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {phase === "connecting" && (
            <Card className="border-border/60 bg-card/80 shadow-glow-primary backdrop-blur-sm">
              <CardContent className="flex items-center gap-3 py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm">Conectando con Meta…</span>
              </CardContent>
            </Card>
          )}

          {phase === "success" && (
            <Card className="border-border/60 bg-card/80 shadow-glow-accent backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-success/15 text-success">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <CardTitle className="font-display">¡Conexión completada!</CardTitle>
                </div>
                <CardDescription>
                  Ya puedes cerrar esta página. Tu proveedor recibirá la confirmación
                  automáticamente.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {phase === "error" && (
            <Card className="border-border/60 bg-card/80 shadow-glow-primary backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <CardTitle className="font-display">No pudimos completar la conexión</CardTitle>
                </div>
                <CardDescription>{info.error ?? "Intenta nuevamente."}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => setPhase("ready")}>
                  Reintentar
                </Button>
              </CardContent>
            </Card>
          )}

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
