import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, FileText, PackageSearch, Users, Boxes, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { NoteSheet } from "@/components/NoteSheet";
import { OrderSheet } from "@/components/OrderSheet";
import { DocViewer, type DocTarget } from "@/components/DocViewer";
import { Input } from "@/components/ui/input";
import { notesQuery, ordersQuery, driveQuery } from "@/lib/queries";
import { buildCustomers } from "@/lib/customers";
import type { DeliveryNote, Order } from "@/lib/saban-config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SABAN OS Deluxe — לוח מחוונים לוגיסטי" },
      {
        name: "description",
        content: "ניהול חי של הזמנות, תעודות משלוח, פקדונות ותיקי לקוחות עבור ח. סבן חומרי בניין.",
      },
      { property: "og:title", content: "SABAN OS Deluxe — לוח מחוונים לוגיסטי" },
      {
        property: "og:description",
        content: "הזמנות, תעודות משלוח, פקדונות ותיקי לקוחות בזמן אמת, עם העוזרת נועה ❤️.",
      },
    ],
  }),
  component: Dashboard,
});

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Boxes }) {
  return (
    <div className="glass-card p-3">
      <Icon className="mb-2 size-4 text-primary" />
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Dashboard() {
  const orders = useQuery(ordersQuery);
  const notes = useQuery(notesQuery);
  const scans = useQuery(driveQuery("scans"));
  const [q, setQ] = useState("");
  const [note, setNote] = useState<DeliveryNote | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [doc, setDoc] = useState<DocTarget>(null);

  const customers = useMemo(
    () => buildCustomers(orders.data ?? [], notes.data ?? []),
    [orders.data, notes.data],
  );

  const term = q.trim();
  const filteredNotes = (notes.data ?? []).filter(
    (n) => !term || [n.customer, n.noteNumber, n.orderNumber, n.address, n.goods].join(" ").includes(term),
  );
  const filteredOrders = (orders.data ?? []).filter(
    (o) => !term || [o.customer, o.orderNumber, o.address, o.items].join(" ").includes(term),
  );

  const openDoc = (fileName: string) => {
    const file = (scans.data ?? []).find((f) => f.name === fileName);
    setDoc(file ? { id: file.id, name: file.name } : null);
  };

  const openDeposits = customers.reduce((s, c) => s + c.bigBags + c.pallets, 0);
  const error = orders.error ?? notes.error;

  return (
    <AppShell title="לוח מחוונים" subtitle="ח. סבן חומרי בניין (1994) בע״מ">
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          dir="rtl"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש לקוח, תעודה, הזמנה או כתובת…"
          className="h-12 rounded-2xl border-white/10 bg-white/5 pr-10"
        />
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">
          {(error as Error).message}
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="הזמנות קומקס" value={orders.data?.length ?? "…"} icon={PackageSearch} />
        <Metric label="תעודות משלוח" value={notes.data?.length ?? "…"} icon={FileText} />
        <Metric label="תיקי לקוחות" value={customers.length || "…"} icon={Users} />
        <Metric label="פקדונות פתוחים" value={openDeposits} icon={Boxes} />
      </div>

      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">תעודות אחרונות</h2>
      {notes.isLoading ? (
        <Loader2 className="mx-auto my-6 size-5 animate-spin text-primary" />
      ) : (
        <div className="mb-6 space-y-2">
          {filteredNotes.slice(0, 8).map((n) => (
            <button
              key={n.row}
              onClick={() => setNote(n)}
              className="glass-card w-full p-3 text-right transition-transform active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{n.customer}</span>
                <span className="text-[11px] text-muted-foreground">{n.datetime}</span>
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{n.goods}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusPill status={n.status} />
                <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px]">#{n.noteNumber}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">הזמנות אחרונות</h2>
      <div className="space-y-2">
        {filteredOrders.slice(0, 6).map((o) => (
          <button
            key={o.row}
            onClick={() => setOrder(o)}
            className="glass-card w-full p-3 text-right transition-transform active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{o.customer}</span>
              <span className="text-[11px] text-muted-foreground">{o.receivedAt}</span>
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{o.address}</p>
          </button>
        ))}
      </div>

      <NoteSheet note={note} onClose={() => setNote(null)} onOpenDoc={openDoc} />
      <OrderSheet order={order} onClose={() => setOrder(null)} />
      <DocViewer doc={doc} onClose={() => setDoc(null)} />
    </AppShell>
  );
}
