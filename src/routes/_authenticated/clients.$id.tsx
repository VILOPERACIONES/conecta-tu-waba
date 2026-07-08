import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getClient, createOnboardingLink } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, LinkIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  component: ClientDetail,
});

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendiente", variant: "secondary" },
  in_progress: { label: "En proceso", variant: "outline" },
  connected: { label: "Conectado", variant: "default" },
  error: { label: "Error", variant: "destructive" },
};

function ClientDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const get = useServerFn(getClient);
  const makeLink = useServerFn(createOnboardingLink);
  const { data, isLoading, error } = useQuery({
    queryKey: ["client", id],
    queryFn: () => get({ data: { id } }),
  });
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      await makeLink({ data: { client_id: id } });
      toast.success("Enlace generado");
      router.invalidate();
    } catch (err: any) {
      toast.error("Error", { description: err.message });
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (error || !data) return <p className="text-sm text-destructive">{(error as Error)?.message ?? "No encontrado"}</p>;

  const status = statusMap[data.status] ?? statusMap.pending;
  const wa = (data.whatsapp_accounts as any[])?.[0];
  const activeLinks = ((data.onboarding_links as any[]) ?? [])
    .filter((l) => !l.used_at && (!l.expires_at || new Date(l.expires_at) > new Date()))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />Volver
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{data.name}</h1>
          <p className="text-sm text-muted-foreground">
            {data.company_name ?? "Sin empresa"} · {data.email ?? "Sin email"}
          </p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enlace de conexión</CardTitle>
          <CardDescription>
            Genera un enlace único para que el cliente conecte su WhatsApp Business con Meta Embedded Signup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={generate} disabled={generating}>
            <RefreshCw className={`mr-2 h-4 w-4 ${generating ? "animate-spin" : ""}`} />
            Generar enlace de conexión
          </Button>

          {activeLinks.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Enlaces activos</p>
              {activeLinks.map((l) => {
                const url = `${origin}/connect/${l.token}`;
                return (
                  <div key={l.id} className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
                    <LinkIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <code className="flex-1 truncate text-xs">{url}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(url);
                        toast.success("Copiado");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cuenta de WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          {wa ? (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-muted-foreground">Número</dt><dd className="font-medium">{wa.display_phone_number ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Nombre verificado</dt><dd className="font-medium">{wa.verified_name ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">WABA ID</dt><dd className="font-mono text-xs">{wa.waba_id ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Phone Number ID</dt><dd className="font-mono text-xs">{wa.phone_number_id ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Estado</dt><dd className="font-medium">{wa.status}</dd></div>
              <div><dt className="text-muted-foreground">Webhook suscrito</dt><dd className="font-medium">{wa.webhook_subscribed ? "Sí" : "No"}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no se ha conectado ninguna cuenta.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
