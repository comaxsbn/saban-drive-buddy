import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, LayoutDashboard, FileText, PackageSearch, Users, Sparkles, Truck } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "לוח מחוונים", icon: LayoutDashboard },
  { to: "/notes", label: "תעודות", icon: FileText },
  { to: "/orders", label: "הזמנות", icon: PackageSearch },
  { to: "/dispatch", label: "סידור", icon: Truck },
  { to: "/customers", label: "תיקי לקוחות", icon: Users },
  { to: "/chat", label: "צ'אט נועה", icon: Sparkles },
] as const;

export function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div dir="rtl" className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="תפריט">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" dir="rtl" className="w-72 border-white/10 bg-sidebar/95 backdrop-blur-2xl">
              <SheetHeader className="text-right">
                <SheetTitle className="text-gradient-gold text-lg">SABAN OS Deluxe</SheetTitle>
                <p className="text-xs text-muted-foreground">ח. סבן חומרי בניין (1994) בע"מ</p>
              </SheetHeader>
              <nav className="mt-4 space-y-1 px-2">
                {NAV.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors",
                      pathname === to ? "bg-primary/15 text-primary" : "text-foreground/80 hover:bg-white/5",
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">{title}</h1>
            {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>

          <Link to="/chat" aria-label="נועה">
            <span className="animate-noa-pulse flex size-9 items-center justify-center rounded-full bg-[image:var(--gradient-noa)] text-sm">
              ❤️
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-stretch justify-between px-2 py-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] transition-colors",
                pathname === to ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
