import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listClients, createClient, deleteClient } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Users, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const list = useServerFn(listClients);
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ["clients"], queryFn: () => list() });
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Gestiona el onboarding de WhatsApp Business de tus clientes."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo cliente
              </Button>
            </DialogTrigger>
            <NewClientDialog
              onDone={() => {
                setOpen(false);
                router.invalidate();
              }}
            />
          </Dialog>
        }
      />

      {isLoading && (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardHeader className="space-y-2 pb-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && data && data.length === 0 && (
        <EmptyState
          icon={Users}
          title="Todavía no hay clientes"
          description="Crea el primero para comenzar el onboarding."
        />
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="grid gap-3">
          {data.map((c: any) => {
            const wa = c.whatsapp_accounts?.[0];
            return (
              <Card
                key={c.id}
                className="transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-glow-primary"
              >
                <div className="flex items-start justify-between gap-2 pr-4">
                  <Link
                    to="/clients/$id"
                    params={{ id: c.id }}
                    className="flex flex-1 items-center gap-4 p-0"
                  >
                    <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-primary/15 font-display text-sm font-semibold text-primary">
                      {c.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 py-4">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0">
                        <div>
                          <CardTitle className="text-base">{c.name}</CardTitle>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {c.company_name ?? "Sin empresa"} · {c.email ?? "Sin email"}
                          </p>
                        </div>
                        <StatusBadge status={c.status} />
                      </CardHeader>
                      {wa && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {wa.display_phone_number ?? "Sin número"} · {wa.verified_name ?? "—"}
                        </p>
                      )}
                    </div>
                  </Link>
                  <div className="pt-4">
                    <DeleteClientButton
                      id={c.id}
                      name={c.name}
                      onDone={() => router.invalidate()}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeleteClientButton({
  id,
  name,
  onDone,
}: {
  id: string;
  name: string;
  onDone: () => void;
}) {
  const del = useServerFn(deleteClient);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await del({ data: { id } });
      toast.success("Cliente eliminado");
      setOpen(false);
      onDone();
    } catch (err: any) {
      toast.error("Error al eliminar", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará <strong>{name}</strong> junto con sus enlaces de onboarding y cuentas de
            WhatsApp asociadas. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Eliminando…" : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Empresa</Label>
          <Input
            id="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            maxLength={200}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading}>
            {loading ? "Creando…" : "Crear"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
