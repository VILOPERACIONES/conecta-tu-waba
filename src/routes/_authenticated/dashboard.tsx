import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listClients, createClient } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendiente", variant: "secondary" },
  in_progress: { label: "En proceso", variant: "outline" },
  connected: { label: "Conectado", variant: "default" },
  error: { label: "Error", variant: "destructive" },
};

function Dashboard() {
  const list = useServerFn(listClients);
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ["clients"], queryFn: () => list() });
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Gestiona el onboarding de WhatsApp Business de tus clientes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nuevo cliente</Button>
          </DialogTrigger>
          <NewClientDialog onDone={() => { setOpen(false); router.invalidate(); }} />
        </Dialog>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {!isLoading && data && data.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Todavía no hay clientes</p>
            <p className="text-sm text-muted-foreground">Crea el primero para comenzar el onboarding.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="grid gap-3">
          {data.map((c: any) => {
            const s = statusMap[c.status] ?? statusMap.pending;
            const wa = c.whatsapp_accounts?.[0];
            return (
              <Link
                key={c.id}
                to="/clients/$id"
                params={{ id: c.id }}
                className="block"
              >
                <Card className="transition-colors hover:border-primary/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div>
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.company_name ?? "Sin empresa"} · {c.email ?? "Sin email"}
                      </p>
                    </div>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </CardHeader>
                  {wa && (
                    <CardContent className="text-xs text-muted-foreground">
                      {wa.display_phone_number ?? "Sin número"} · {wa.verified_name ?? "—"}
                    </CardContent>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewClientDialog({ onDone }: { onDone: () => void }) {
  const create = useServerFn(createClient);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await create({ data: { name, email, company_name: company } });
      toast.success("Cliente creado");
      onDone();
    } catch (err: any) {
      toast.error("Error al crear cliente", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Crear cliente</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre *</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Empresa</Label>
          <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading}>{loading ? "Creando…" : "Crear"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
