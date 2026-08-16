import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Sunrise } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { OrderSheet } from "@/components/OrderSheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { notesQuery, ordersQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/saban-config";
import {
  DISPATCH_STATUSES,
  DRIVERS,
  WAREHOUSES,
  buildMorningBrief,
  emptyMeta,
  loadMeta,
  openOrders,
  orderKey,
  saveMeta,
  whatsappUrl,
  type DispatchMeta,
} from "@/lib/dispatch";

export const Route = createFileRoute("/dispatch")({
  head: () => ({
    meta: [
      { title: "מצב סידור — SABAN OS Deluxe" },
      { name: "description", content: "לוח סידור יומי להזמנות פתוחות: סטטוס ליקוט, שיוך נהגים ומחסנים ודוח בוקר לוואטסאפ." },
      { property: "og:title", content: "מצב סידור — SABAN OS Deluxe" },
      { property: "og:description", content: "ניהול הזמנות פתוחות, שיבוץ נהגים ושליחת דוח בוקר בלחיצה." },
    ],
  }),
  component: DispatchPage,
});

function DispatchPage() {
  const orders = useQuery(ordersQuery);
  const notes = useQuery(notesQuery);
  const [meta, setMeta] = useState<Record<string, DispatchMeta>>({});
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [sheetOrder, setSheetOrder] = useState<Order | null>(null);

  useEffect(() => setMeta(loadMeta()), []);

  const list = useMemo(() => openOrders(orders.data ?? [], notes.data ?? []), [orders.data, notes.data]);

  const get = (o: Order): DispatchMeta => meta[orderKey(o)] ?? emptyMeta(o);
  const patch = (o: Order, p: Partial<DispatchMeta>) =>
    setMeta((prev) => {
      const next = { ...prev, [orderKey(o)]: { ...(prev[orderKey(o)] ?? emptyMeta(o)), ...p } };
      saveMeta(next);
      return next;
    });

  const term = q.trim();
  const shown = list.filter(
    (o) =>
      (filter === "all" || get(o).status === filter) &&
      (!term || [o.customer, o.orderNumber, o.address, o.warehouse].join(" ").includes(term)),
  );

  const sendBrief = () => {
    if (!list.length) return toast.error("אין הזמנות פתוחות לדוח");
    const text = buildMorningBrief(list.map((o) => ({ order: o, meta: get(o) })));
    window.open(whatsappUrl(text), "_blank", "noopener");
  };

  return (
    <AppShell title="מצב סידור" subtitle={`${list.length} הזמנות פתוחות ללא תעודה מאושרת`}>
      <Button onClick={sendBrief} className="mb-4 h-14 w-full rounded-2xl text-base font-semibold">
        <Sunrise className="size-5" />
        🌅 שלח דוח בוקר ל-WhatsApp
      </Button>

      <div className="relative mb-3">
        <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          dir="rtl"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש לקוח, הזמנה או כתובת…"
          className="h-12 rounded-2xl border-white/10 bg-white/5 pr-10"
        />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {[{ id: "all", label: "הכל", emoji: "📋" }, ...DISPATCH_STATUSES].map((s) => (
          <button
            key={s.id}
            onClick={() => setFilter(s.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[11px] transition-colors",
              filter === s.id ? "border-primary/40 bg-primary/15 text-primary" : "border-white/10 bg-white/5 text-muted-foreground",
            )}
          >
            {s.emoji} {s.label}
          </button>
        ))}
      </div>

      {orders.isLoading || notes.isLoading ? <Loader2 className="mx-auto my-8 size-5 animate-spin text-primary" /> : null}

      <div className="space-y-3">
        {shown.map((o) => {
          const m = get(o);
          const status = DISPATCH_STATUSES.find((s) => s.id === m.status)!;
          return (
            <div key={orderKey(o)} className="glass-card p-3">
              <button onClick={() => setSheetOrder(o)} className="w-full text-right">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{o.customer}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{o.receivedAt}</span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  #{o.orderNumber} · {o.address || "ללא כתובת"}
                </p>
              </button>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {DISPATCH_STATUSES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => patch(o, { status: s.id })}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                      m.status === s.id ? s.cls : "border-white/10 bg-white/5 text-muted-foreground",
                    )}
                  >
                    {s.emoji} {s.label}
                  </button>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {DRIVERS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => patch(o, { driver: m.driver === d.id ? "" : d.id })}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                      m.driver === d.id ? "border-primary/40 bg-primary/15 text-primary" : "border-white/10 bg-white/5 text-muted-foreground",
                    )}
                  >
                    {d.emoji} {d.name}
                  </button>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {WAREHOUSES.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => patch(o, { warehouse: m.warehouse === w.id ? "" : w.id })}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                      m.warehouse === w.id ? "border-primary/40 bg-primary/15 text-primary" : "border-white/10 bg-white/5 text-muted-foreground",
                    )}
                  >
                    🏬 {w.label}
                  </button>
                ))}
                <input
                  type="time"
                  aria-label="שעת יציאה"
                  value={m.time}
                  onChange={(e) => patch(o, { time: e.target.value })}
                  className="ms-auto rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-foreground"
                />
              </div>

              <p className="mt-2 text-[10px] text-muted-foreground">
                {status.emoji} {status.label}
              </p>
            </div>
          );
        })}
        {!shown.length && !orders.isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">אין הזמנות תואמות</p>
        ) : null}
      </div>

      <OrderSheet order={sheetOrder} onClose={() => setSheetOrder(null)} />
    </AppShell>
  );
}
