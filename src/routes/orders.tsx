import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { OrderSheet } from "@/components/OrderSheet";
import { StatusPill } from "@/components/StatusPill";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ordersQuery } from "@/lib/queries";
import { createOrder } from "@/lib/saban.functions";
import { useChime } from "@/hooks/use-chime";
import type { Order } from "@/lib/saban-config";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "הזמנות קומקס — SABAN OS Deluxe" },
      { name: "description", content: "ריכוז הזמנות חי, פירוט מק״טים, פקדונות וניווט לאתר האספקה." },
      { property: "og:title", content: "הזמנות קומקס — SABAN OS Deluxe" },
      { property: "og:description", content: "יצירה וצפייה בהזמנות ישירות מול גיליון ריכוז ההזמנות." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const orders = useQuery(ordersQuery);
  const qc = useQueryClient();
  const chime = useChime();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [form, setForm] = useState({
    orderNumber: "",
    customer: "",
    warehouse: "",
    address: "",
    items: "",
    bigBagDeposit: "",
    palletDeposit: "",
  });

  const create = useMutation({
    mutationFn: () => createOrder({ data: form }),
    onSuccess: () => {
      chime();
      toast.success("ההזמנה נוספה לגיליון");
      setOpen(false);
      setForm({ orderNumber: "", customer: "", warehouse: "", address: "", items: "", bigBagDeposit: "", palletDeposit: "" });
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = (orders.data ?? []).filter(
    (o) => !q.trim() || [o.customer, o.orderNumber, o.address, o.items].join(" ").includes(q.trim()),
  );

  return (
    <AppShell title="הזמנות" subtitle={`${orders.data?.length ?? 0} הזמנות בריכוז`}>
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            dir="rtl"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש הזמנה…"
            className="h-12 rounded-2xl border-white/10 bg-white/5 pr-10"
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="icon" className="size-12 rounded-2xl" aria-label="הזמנה חדשה">
              <Plus className="size-5" />
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto border-white/10 bg-popover">
            <DialogHeader className="text-right">
              <DialogTitle>הזמנה חדשה</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Input dir="rtl" placeholder="מספר הזמנה" value={form.orderNumber} onChange={(e) => setForm({ ...form, orderNumber: e.target.value })} />
              <Input dir="rtl" placeholder="שם לקוח / פרויקט" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} />
              <Input dir="rtl" placeholder="מחסן" value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} />
              <Input dir="rtl" placeholder="כתובת אספקה" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <Textarea dir="rtl" rows={5} placeholder={'פירוט מוצרים וכמויות\n1. 📦 מק"ט: 10002 | מלט אפור 25 ק"ג | כמות: 30'} value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input dir="rtl" placeholder="פקדון בלות" value={form.bigBagDeposit} onChange={(e) => setForm({ ...form, bigBagDeposit: e.target.value })} />
                <Input dir="rtl" placeholder="פקדון משטחים" value={form.palletDeposit} onChange={(e) => setForm({ ...form, palletDeposit: e.target.value })} />
              </div>
              <Button className="w-full" disabled={create.isPending || !form.orderNumber || !form.customer} onClick={() => create.mutate()}>
                {create.isPending ? <Loader2 className="size-4 animate-spin" /> : "שמירה לגיליון"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {orders.isLoading ? <Loader2 className="mx-auto my-8 size-5 animate-spin text-primary" /> : null}
      <div className="space-y-2">
        {list.map((o) => (
          <button
            key={o.row}
            onClick={() => setOrder(o)}
            className="glass-card w-full p-3 text-right transition-transform active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{o.customer}</span>
              <span className="text-[11px] text-muted-foreground">{o.receivedAt}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              #{o.orderNumber} · {o.address}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusPill status={o.bigBagDeposit} />
              <StatusPill status={o.palletDeposit} />
            </div>
          </button>
        ))}
      </div>

      <OrderSheet order={order} onClose={() => setOrder(null)} />
    </AppShell>
  );
}
