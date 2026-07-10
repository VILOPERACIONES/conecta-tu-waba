import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getChatwootConfig,
  updateChatwootConfig,
  testChatwootConnection,
} from "@/lib/chatwoot.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Plug } from "lucide-react";

export function ChatwootIntegrationCard({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const load = useServerFn(getChatwootConfig);
  const save = useServerFn(updateChatwootConfig);
  const test = useServerFn(testChatwootConnection);

  const cfgQuery = useQuery({
    queryKey: ["chatwoot-config", clientId],
    queryFn: () => load({ data: { client_id: clientId } }),
  });

  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [accountId, setAccountId] = useState("");
  const [inboxId, setInboxId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [pauseLabel, setPauseLabel] = useState("human");
  const [activeLabel, setActiveLabel] = useState("bot_on");
  const [pauseOnAssigned, setPauseOnAssigned] = useState(false);
  const [signatureEnabled, setSignatureEnabled] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clearingSecret, setClearingSecret] = useState(false);

  useEffect(() => {
    if (!cfgQuery.data || initialized) return;
    const d = cfgQuery.data;
    setEnabled(!!d.chatwoot_enabled);
    setBaseUrl(d.chatwoot_base_url ?? "");
    setAccountId(d.chatwoot_account_id ?? "");
    setInboxId(d.chatwoot_inbox_id ?? "");
    setPauseLabel(d.chatwoot_bot_pause_label ?? "human");
    setActiveLabel(d.chatwoot_bot_active_label ?? "bot_on");
    setPauseOnAssigned(!!d.pause_on_assigned);
    setSignatureEnabled(d.chatwoot_webhook_signature_enabled !== false);
    setInitialized(true);
  }, [cfgQuery.data, initialized]);

  const d = cfgQuery.data;

  const onSave = async () => {
    setSaving(true);
    try {
      await save({
        data: {
          client_id: clientId,
          chatwoot_enabled: enabled,
          chatwoot_base_url: baseUrl.trim() || null,
          chatwoot_account_id: accountId.trim() || null,
          chatwoot_inbox_id: inboxId.trim() || null,
          chatwoot_bot_pause_label: pauseLabel.trim() || "human",
          chatwoot_bot_active_label: activeLabel.trim() || "bot_on",
          pause_on_assigned: pauseOnAssigned,
          chatwoot_webhook_signature_enabled: signatureEnabled,
          ...(apiToken.trim() ? { chatwoot_api_token: apiToken.trim() } : {}),
          ...(webhookSecret.trim() ? { chatwoot_webhook_secret: webhookSecret.trim() } : {}),
        },
      });
      setApiToken("");
      setWebhookSecret("");
      toast.success("Configuración de Chatwoot guardada");
      await qc.invalidateQueries({ queryKey: ["chatwoot-config", clientId] });
    } catch (err: any) {
      toast.error("Error al guardar", { description: String(err?.message ?? err) });
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    try {
      const res = await test({ data: { client_id: clientId } });
      if ((res as any).ok) {
        toast.success("Conexión Chatwoot OK", {
          description: `HTTP ${(res as any).http_status} · ${(res as any).latency_ms}ms`,
        });
      } else {
        toast.error("Fallo de conexión", {
          description: (res as any).error ?? "Error desconocido",
        });
      }
      await qc.invalidateQueries({ queryKey: ["chatwoot-config", clientId] });
    } catch (err: any) {
      toast.error("Error al probar", { description: String(err?.message ?? err) });
    } finally {
      setTesting(false);
    }
  };

  const onClearSecret = async () => {
    if (
      !confirm(
        "¿Eliminar el webhook secret guardado? Chatwoot dejará de firmar; asegúrate de desactivar la verificación o subir uno nuevo.",
      )
    )
      return;
    setClearingSecret(true);
    try {
      await save({
        data: {
          client_id: clientId,
          chatwoot_enabled: enabled,
          chatwoot_base_url: baseUrl.trim() || null,
          chatwoot_account_id: accountId.trim() || null,
          chatwoot_inbox_id: inboxId.trim() || null,
          chatwoot_bot_pause_label: pauseLabel.trim() || "human",
          chatwoot_bot_active_label: activeLabel.trim() || "bot_on",
          pause_on_assigned: pauseOnAssigned,
          chatwoot_webhook_signature_enabled: signatureEnabled,
          clear_webhook_secret: true,
        },
      });
      setWebhookSecret("");
      toast.success("Webhook secret eliminado");
      await qc.invalidateQueries({ queryKey: ["chatwoot-config", clientId] });
    } catch (err: any) {
      toast.error("Error al eliminar", { description: String(err?.message ?? err) });
    } finally {
      setClearingSecret(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-primary" />
          <CardTitle>Chatwoot (bandeja humana)</CardTitle>
        </div>
        <CardDescription>
          Opcional. Si está desactivado, el flujo Meta → n8n → Meta sigue funcionando exactamente
          como ahora. Al activarlo, cada mensaje entrante también se sincronizará con Chatwoot y los
          mensajes con label "{pauseLabel}" pausarán el reenvío a n8n.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="cw-enabled">Chatwoot habilitado</Label>
            <p className="text-xs text-muted-foreground">
              Solo se sincroniza si está activo y hay credenciales válidas.
            </p>
          </div>
          <Switch id="cw-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cw-base-url">Base URL</Label>
            <Input
              id="cw-base-url"
              type="url"
              placeholder="https://chatwoot.tudominio.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cw-account-id">Account ID</Label>
            <Input
              id="cw-account-id"
              placeholder="1"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cw-inbox-id">Inbox ID (API channel)</Label>
            <Input
              id="cw-inbox-id"
              placeholder="12"
              value={inboxId}
              onChange={(e) => setInboxId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cw-api-token">API access token</Label>
            <Input
              id="cw-api-token"
              type="password"
              placeholder={
                d?.has_api_token ? "•••••••• (dejar vacío para no cambiar)" : "Sin configurar"
              }
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Se envía como header <code>api_access_token</code>.
            </p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="cw-sig-enabled">Verificar firma HMAC del webhook</Label>
                <p className="text-xs text-muted-foreground">
                  Si lo desactivas, se aceptarán webhooks de Chatwoot sin validar la firma (útil si
                  Chatwoot no envía <code>X-Chatwoot-Signature</code>).
                </p>
              </div>
              <Switch
                id="cw-sig-enabled"
                checked={signatureEnabled}
                onCheckedChange={setSignatureEnabled}
              />
            </div>
            <Label htmlFor="cw-webhook-secret">Webhook secret</Label>
            <Input
              id="cw-webhook-secret"
              type="password"
              placeholder={
                d?.has_webhook_secret ? "•••••••• (dejar vacío para no cambiar)" : "Sin configurar"
              }
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              disabled={!signatureEnabled}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Solo se usa si la verificación de firma está activada.
              </p>
              {d?.has_webhook_secret && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={onClearSecret}
                  disabled={clearingSecret}
                >
                  {clearingSecret ? "Eliminando…" : "Eliminar secreto"}
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cw-pause-label">Label para pausar bot</Label>
            <Input
              id="cw-pause-label"
              placeholder="human"
              value={pauseLabel}
              onChange={(e) => setPauseLabel(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cw-active-label">Label para bot activo</Label>
            <Input
              id="cw-active-label"
              placeholder="bot_on"
              value={activeLabel}
              onChange={(e) => setActiveLabel(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label htmlFor="cw-pause-assigned">Pausar bot si conversación está asignada</Label>
            <p className="text-xs text-muted-foreground">
              Desactivado por defecto. Se aplicará cuando la sincronización esté activa.
            </p>
          </div>
          <Switch
            id="cw-pause-assigned"
            checked={pauseOnAssigned}
            onCheckedChange={setPauseOnAssigned}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar configuración de Chatwoot"}
          </Button>
          <Button
            variant="outline"
            onClick={onTest}
            disabled={testing || !d?.chatwoot_base_url || !d?.has_api_token}
          >
            {testing ? "Probando…" : "Probar conexión"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => qc.invalidateQueries({ queryKey: ["chatwoot-config", clientId] })}
          >
            <RefreshCw className="mr-1 h-3 w-3" /> Recargar
          </Button>
        </div>

        <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
          <p className="font-medium text-sm">Estado real (BD)</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span className="text-muted-foreground">chatwoot_enabled</span>
            <span className="font-mono">{String(!!d?.chatwoot_enabled)}</span>
            <span className="text-muted-foreground">Base URL</span>
            <span className="font-mono break-all">{d?.chatwoot_base_url || "—"}</span>
            <span className="text-muted-foreground">Account ID</span>
            <span className="font-mono">{d?.chatwoot_account_id || "—"}</span>
            <span className="text-muted-foreground">Inbox ID</span>
            <span className="font-mono">{d?.chatwoot_inbox_id || "—"}</span>
            <span className="text-muted-foreground">API token</span>
            <span className="font-mono">{d?.has_api_token ? "Sí" : "No"}</span>
            <span className="text-muted-foreground">Webhook secret</span>
            <span className="font-mono">{d?.has_webhook_secret ? "Sí" : "No"}</span>
            <span className="text-muted-foreground">Verificar firma</span>
            <span className="font-mono">
              {d?.chatwoot_webhook_signature_enabled === false ? "No" : "Sí"}
            </span>
            <span className="text-muted-foreground">Última prueba</span>
            <span className="font-mono">
              {d?.last_test_at ? new Date(d.last_test_at).toLocaleString() : "—"}
            </span>
            <span className="text-muted-foreground">Último status</span>
            <span>
              {d?.last_test_status ? (
                <Badge variant={d.last_test_status === "success" ? "default" : "destructive"}>
                  {d.last_test_status}
                </Badge>
              ) : (
                <span className="font-mono">—</span>
              )}
            </span>
          </div>
          {d?.last_test_error && <p className="text-destructive break-all">{d.last_test_error}</p>}
        </div>

        <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-2">
          <p className="font-medium text-sm">Webhook para Chatwoot</p>
          <p className="text-muted-foreground">
            En Chatwoot: Settings → Integrations → Webhooks, agrega esta URL. Firma con el "Webhook
            secret" configurado arriba (HMAC-SHA256 hex, header <code>X-Chatwoot-Signature</code>).
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-background px-2 py-1">
              {typeof window !== "undefined"
                ? `${window.location.origin}/api/public/chatwoot/webhook`
                : "/api/public/chatwoot/webhook"}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const url = `${window.location.origin}/api/public/chatwoot/webhook`;
                navigator.clipboard.writeText(url).then(
                  () => toast.success("URL copiada"),
                  () => toast.error("No se pudo copiar"),
                );
              }}
            >
              Copiar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
