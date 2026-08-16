import { Phone, MapPin, FolderOpen, Package, FileText } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/StatusPill";
import type { CustomerFile } from "@/lib/customers";
import { DRIVE, driveFolderUrl, wazeUrl, type DeliveryNote, type Order } from "@/lib/saban-config";

export function CustomerSheet({
  customer,
  onClose,
  onOpenNote,
  onOpenOrder,
}: {
  customer: CustomerFile | null;
  onClose: () => void;
  onOpenNote: (n: DeliveryNote) => void;
  onOpenOrder: (o: Order) => void;
}) {
  return (
    <Drawer open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent dir="rtl" className="max-h-[92vh] border-white/10 bg-popover">
        {customer ? (
          <div className="overflow-y-auto px-4 pb-8">
            <DrawerHeader className="px-0 text-right">
              <DrawerTitle className="text-base">{customer.name}</DrawerTitle>
              <p className="text-xs text-muted-foreground">
                מס' לקוח {customer.customerId || "—"} · {customer.address || "ללא כתובת"}
              </p>
            </DrawerHeader>

            <div className="mb-3 flex flex-wrap gap-2">
              <a href="tel:+97239999999">
                <Button size="sm" variant="secondary" className="gap-1">
                  <Phone className="size-4" /> חיוג
                </Button>
              </a>
              {customer.address ? (
                <a href={wazeUrl(customer.address)} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="secondary" className="gap-1">
                    <MapPin className="size-4" /> ניווט
                  </Button>
                </a>
              ) : null}
              <a href={driveFolderUrl(DRIVE.customers)} target="_blank" rel="noreferrer">
                <Button size="sm" variant="secondary" className="gap-1">
                  <FolderOpen className="size-4" /> ארכיון Drive
                </Button>
              </a>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="glass-card p-3">
                <p className="text-xs text-muted-foreground">בלות (שק גדול) אצל הלקוח</p>
                <p className="text-2xl font-bold text-primary">{customer.bigBags}</p>
              </div>
              <div className="glass-card p-3">
                <p className="text-xs text-muted-foreground">משטחים אצל הלקוח</p>
                <p className="text-2xl font-bold text-accent">{customer.pallets}</p>
              </div>
            </div>

            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Package className="size-4" /> ציר הזמנות ({customer.orders.length})
            </h3>
            <div className="mb-4 space-y-2">
              {customer.orders.map((o) => (
                <button
                  key={o.row}
                  onClick={() => onOpenOrder(o)}
                  className="glass-card w-full p-3 text-right transition-transform active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">#{o.orderNumber}</span>
                    <span className="text-xs text-muted-foreground">{o.receivedAt}</span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{o.address}</p>
                </button>
              ))}
              {customer.orders.length === 0 ? <p className="text-xs text-muted-foreground">אין הזמנות פתוחות</p> : null}
            </div>

            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <FileText className="size-4" /> היסטוריית תעודות ({customer.notes.length})
            </h3>
            <div className="space-y-2">
              {customer.notes.map((n) => (
                <button
                  key={n.row}
                  onClick={() => onOpenNote(n)}
                  className="glass-card w-full p-3 text-right transition-transform active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">תעודה {n.noteNumber}</span>
                    <span className="text-xs text-muted-foreground">{n.datetime}</span>
                  </div>
                  <div className="mt-2">
                    <StatusPill status={n.status} />
                  </div>
                </button>
              ))}
              {customer.notes.length === 0 ? <p className="text-xs text-muted-foreground">אין תעודות</p> : null}
            </div>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
