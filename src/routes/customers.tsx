import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CustomerSheet } from "@/components/CustomerSheet";
import { NoteSheet } from "@/components/NoteSheet";
import { OrderSheet } from "@/components/OrderSheet";
import { DocViewer, type DocTarget } from "@/components/DocViewer";
import { Input } from "@/components/ui/input";
import { notesQuery, ordersQuery, driveQuery } from "@/lib/queries";
import { buildCustomers, type CustomerFile } from "@/lib/customers";
import type { DeliveryNote, Order } from "@/lib/saban-config";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "תיקי לקוחות — SABAN OS Deluxe" },
      { name: "description", content: "תיק לקוח 360°: הזמנות, תעודות, יתרות פקדונות וארכיון Drive." },
      { property: "og:title", content: "תיקי לקוחות — SABAN OS Deluxe" },
      { property: "og:description", content: "כל המידע על הלקוח במקום אחד, כולל יתרות בלות ומשטחים." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const orders = useQuery(ordersQuery);
  const notes = useQuery(notesQuery);
  const scans = useQuery(driveQuery("scans"));
  const [q, setQ] = useState("");
  const [customer, setCustomer] = useState<CustomerFile | null>(null);
  const [note, setNote] = useState<DeliveryNote | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [doc, setDoc] = useState<DocTarget>(null);

  const customers = useMemo(() => buildCustomers(orders.data ?? [], notes.data ?? []), [orders.data, notes.data]);
  const list = customers.filter((c) => !q.trim() || c.name.includes(q.trim()) || c.customerId.includes(q.trim()));

  return (
    <AppShell title="תיקי לקוחות" subtitle={`${customers.length} לקוחות פעילים`}>
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          dir="rtl"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש לקוח…"
          className="h-12 rounded-2xl border-white/10 bg-white/5 pr-10"
        />
      </div>
      {orders.isLoading || notes.isLoading ? <Loader2 className="mx-auto my-8 size-5 animate-spin text-primary" /> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((c) => (
          <button
            key={c.key}
            onClick={() => setCustomer(c)}
            className="glass-card p-3 text-right transition-transform active:scale-[0.99]"
          >
            <p className="text-sm font-medium">{c.name}</p>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{c.address || "ללא כתובת"}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
              <span className="rounded-full bg-white/5 px-2 py-1">{c.orders.length} הזמנות</span>
              <span className="rounded-full bg-white/5 px-2 py-1">{c.notes.length} תעודות</span>
              <span className="rounded-full bg-amber-500/15 px-2 py-1 text-amber-300">{c.bigBags} בלות</span>
              <span className="rounded-full bg-orange-500/15 px-2 py-1 text-orange-300">{c.pallets} משטחים</span>
            </div>
          </button>
        ))}
      </div>

      <CustomerSheet
        customer={customer}
        onClose={() => setCustomer(null)}
        onOpenNote={setNote}
        onOpenOrder={setOrder}
      />
      <NoteSheet
        note={note}
        onClose={() => setNote(null)}
        onOpenDoc={(name) => {
          const f = (scans.data ?? []).find((x) => x.name === name);
          setDoc(f ? { id: f.id, name: f.name } : null);
        }}
      />
      <OrderSheet order={order} onClose={() => setOrder(null)} />
      <DocViewer doc={doc} onClose={() => setDoc(null)} />
    </AppShell>
  );
}
