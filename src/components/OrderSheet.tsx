import { MapPin, Share2, Warehouse } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/StatusPill";
import { parseItems, wazeUrl, type Order } from "@/lib/saban-config";

export function OrderSheet({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const items = order ? parseItems(order.items) : [];

  return (
    <Drawer open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent dir="rtl" className="max-h-[92vh] border-white/10 bg-popover">
        {order ? (
          <div className="overflow-y-auto px-4 pb-8">
            <DrawerHeader className="px-0 text-right">
              <DrawerTitle className="text-base">הזמנה {order.orderNumber}</DrawerTitle>
              <p className="text-xs text-muted-foreground">
                {order.customer} · {order.receivedAt}
              </p>
            </DrawerHeader>

            <div className="mb-3 flex flex-wrap gap-2">
              {order.address ? (
                <a href={wazeUrl(order.address)} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="secondary" className="gap-1">
                    <MapPin className="size-4" /> ניווט Waze
                  </Button>
                </a>
              ) : null}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `הזמנה ${order.orderNumber} · ${order.customer}\n${order.address}\n${order.items}`,
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button size="sm" variant="secondary" className="gap-1">
                  <Share2 className="size-4" /> שתף בוואטסאפ
                </Button>
              </a>
            </div>

            <div className="glass-card mb-3 space-y-2 p-3 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Warehouse className="size-4" /> {order.warehouse || "—"}
              </p>
              <p>{order.address}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <StatusPill status={order.bigBagDeposit} />
                <StatusPill status={order.palletDeposit} />
              </div>
            </div>

            <div className="glass-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-right">מק"ט</th>
                    <th className="p-2 text-right">פריט</th>
                    <th className="p-2 text-right">כמות</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="p-2">
                        <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[11px]">{it.sku || "—"}</span>
                      </td>
                      <td className="p-2">{it.name}</td>
                      <td className="p-2 font-semibold text-primary">{it.qty || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
