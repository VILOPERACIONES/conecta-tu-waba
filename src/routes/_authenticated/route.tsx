import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MessageCircle, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Ambient blue glow, single light source */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, oklch(0.55 0.24 262 / 0.35), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 bottom-0 h-[420px] w-[420px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, oklch(0.4 0.2 262 / 0.18), transparent 70%)" }}
      />

      <header className="relative z-10 border-b border-border/60 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_24px_-6px_oklch(0.62_0.22_262/0.7)]">
              <MessageCircle className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">WhatsApp Onboarding</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Salir
            </Button>
          </div>
        </div>
      </header>
      <main className="container relative z-10 mx-auto px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
