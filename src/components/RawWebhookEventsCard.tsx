import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listRawWebhookEvents } from "@/lib/raw-webhook-events.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Copy,
  FlaskConical,
  Webhook,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

type RawRow = {
  id: string;
  received_at: string;
  method: string | null;
  url: string | null;
  query_params: any;
  headers: any;
  body_raw: string | null;
  body_json: any;
  phone_number_id: string | null;
  object_type: string | null;
  is_meta_test: boolean;
  processing_error: string | null;
  processed: boolean;
};

export function RawWebhookEventsCard() {
  const load = useServerFn(listRawWebhookEvents);
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const query = useQuery({
    queryKey: ["raw-webhook-events"],
    queryFn: () => load({ data: { limit: 50 } }),
    refetchOnWindowFocus: false,
    refetchInterval: 10000,
  });

  const rows = (query.data as RawRow[] | undefined) ?? [];

  const copyRow = (r: RawRow) => {
    navigator.clipboard.writeText(JSON.stringify(r, null, 2));
    toast.success("Evento copiado");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-primary" />
              Raw Meta Webhook Events
            </CardTitle>
            <CardDescription>
              Cada POST recibido en <code>/api/public/whatsapp/webhook</code> se guarda aquí antes
              de cualquier validación, incluidos los eventos del botón Test de Meta.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["raw-webhook-events"] })}
            disabled={query.isFetching}
          >
            <RefreshCw className={`mr-1 h-3 w-3 ${query.isFetching ? "animate-spin" : ""}`} />
            Recargar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No se han recibido eventos aún. Prueba el botón Test en Meta Developers.
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {rows.map((r) => {
              const isOpen = !!expanded[r.id];
              // Derivar tipo de evento del payload crudo.
              const change = r.body_json?.entry?.[0]?.changes?.[0];
              const val = change?.value;
              let kindBadge: { label: string; cls: string } | null = null;
              if (val?.messages?.[0]) {
                kindBadge = {
                  label: "received_from_meta · message",
                  cls: "border-opal/40 bg-opal/10 text-opal",
                };
              } else if (val?.statuses?.[0]) {
                const st = val.statuses[0].status;
                kindBadge = {
                  label: `status_event_ignored · ${st ?? "?"}`,
                  cls: "border-border bg-muted text-muted-foreground",
                };
              }
              return (
                <div key={r.id} className="text-sm">
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => ({ ...e, [r.id]: !isOpen }))}
                    className="flex w-full items-start gap-2 p-3 text-left hover:bg-muted/50"
                  >
                    {isOpen ? (
                      <ChevronDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {kindBadge && (
                          <Badge variant="outline" className={`gap-1 ${kindBadge.cls}`}>
                            {kindBadge.label}
                          </Badge>
                        )}
                        {r.is_meta_test && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-warning/40 bg-warning/10 text-warning"
                          >
                            <FlaskConical className="h-3 w-3" /> Meta Test
                          </Badge>
                        )}
                        <Badge
                          variant={r.processed ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {r.processed ? "procesado" : "sin procesar"}
                        </Badge>
                        {r.object_type && (
                          <span className="text-[11px] text-muted-foreground">{r.object_type}</span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(r.received_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                        <span className="text-muted-foreground">phone_number_id:</span>
                        <code className="text-foreground">{r.phone_number_id ?? "—"}</code>
                      </div>
                      {r.processing_error && (
                        <p className="text-xs text-warning break-all">{r.processing_error}</p>
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="space-y-3 border-t bg-muted/30 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Detalle completo</span>
                        <Button variant="ghost" size="sm" onClick={() => copyRow(r)}>
                          <Copy className="mr-1 h-3 w-3" /> Copiar
                        </Button>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                        <dt className="text-muted-foreground">ID</dt>
                        <dd className="font-mono break-all">{r.id}</dd>
                        <dt className="text-muted-foreground">Método</dt>
                        <dd>{r.method ?? "—"}</dd>
                        <dt className="text-muted-foreground">URL</dt>
                        <dd className="font-mono break-all">{r.url ?? "—"}</dd>
                      </dl>
                      {r.query_params && Object.keys(r.query_params).length > 0 && (
                        <div>
                          <p className="mb-1 text-muted-foreground">Query params</p>
                          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border bg-background/60 p-2 text-[11px]">
                            {JSON.stringify(r.query_params, null, 2)}
                          </pre>
                        </div>
                      )}
                      {r.headers && (
                        <div>
                          <p className="mb-1 text-muted-foreground">Headers</p>
                          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border bg-background/60 p-2 text-[11px]">
                            {JSON.stringify(r.headers, null, 2)}
                          </pre>
                        </div>
                      )}
                      {r.body_json ? (
                        <div>
                          <p className="mb-1 text-muted-foreground">Body (JSON)</p>
                          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border bg-background/60 p-2 text-[11px]">
                            {JSON.stringify(r.body_json, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        r.body_raw && (
                          <div>
                            <p className="mb-1 text-muted-foreground">Body (raw)</p>
                            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border bg-background/60 p-2 text-[11px]">
                              {r.body_raw}
                            </pre>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
