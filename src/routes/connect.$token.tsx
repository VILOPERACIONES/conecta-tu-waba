import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, MessageCircle, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/connect/$token")({
  ssr: false,
  component: ConnectPage,
});

declare global {
  interface Window {
    FB?: {
      init: (options: Record<string, unknown>) => void;
      login: (callback: (response: MetaLoginResponse) => void, options: Record<string, unknown>) => void;
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
  configurationId: import.meta.env.VITE_META_CONFIGURATION_ID ?? serverConfig?.configurationId ?? null,
  graphApiVersion: META_GRAPH_API_VERSION,
});

const extractMetaError = (response: MetaLoginResponse) =>
  response.error_message ?? response.error ?? (response.status ? `Meta respondió con estado: ${response.status}` : "Meta canceló o rechazó la conexión.");

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
  if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;

  try {
    const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
    if (data?.type !== "WA_EMBEDDED_SIGNUP") return;

    const payload = data.data ?? {};
    const eventName = payload.event ?? data.event;
    capture.opened = true;

    if (eventName === "ERROR") {
      capture.errorMessage = payload.error_message ?? payload.error ?? "Meta Embedded Signup devolvió un error.";
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

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${META_SDK_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => console.log("Facebook SDK loaded"), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("No se pudo cargar Facebook SDK.")), { once: true });
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
  const [info, setInfo] = useState<{ client_name?: string | null; company_name?: string | null; reason?: string; error?: string }>({});
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
      setInfo({ error: "El SDK de Meta aún no está listo. Recarga la página e inténtalo de nuevo." });
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

    const messageListener = (event: MessageEvent) => {
      const wasOpened = capture.opened;
      readSignupPayload(event, capture);
      if (!wasOpened && capture.opened) markOpened();
      if (capture.errorMessage) fail(capture.errorMessage);
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
      console.log("Embedded Signup error", response ?? message);
      setInfo({ error: message });
      setPhase("error");
    };

    window.addEventListener("message", messageListener);
    window.addEventListener("blur", markOpened, { once: true });

    timeoutId = window.setTimeout(() => {
      if (settled) return;
      fail(EMBEDDED_SIGNUP_TIMEOUT_MESSAGE);
    }, EMBEDDED_SIGNUP_TIMEOUT_MS);

    window.FB.login(
      async (response: MetaLoginResponse) => {
        if (settled) return;
        cleanup();
        console.log("Embedded Signup response", response);

        const code = response.authResponse?.code;
        if (!code) {
          fail(extractMetaError(response), response);
          return;
        }

        if (!capture.wabaId || !capture.phoneNumberId) {
          fail(capture.errorMessage ?? "Meta no devolvió WABA ID y Phone Number ID. No se marcó la conexión como completada.", {
            response,
            captured: capture,
          });
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
            fail(json.detail?.error?.message ?? json.error ?? "Error al completar el onboarding.", json);
            return;
          }
          settled = true;
          setPhase("success");
        } catch (err: any) {
          fail(err?.message ?? "Error de red.");
        }
      },
      {
        config_id: metaConfig.configurationId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          sessionInfoVersion: 3,
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

              <Button onClick={launchSignup} size="lg" className="w-full" disabled={!metaConfig?.appId || !metaConfig?.configurationId || !sdkReady}>
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
