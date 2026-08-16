import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, MapPin, Truck, Clock, CheckCircle2, Share2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/StatusPill";
import { useChime } from "@/hooks/use-chime";
import { updateNoteStatus } from "@/lib/saban.functions";
import { wazeUrl, type DeliveryNote } from "@/lib/saban-config";

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 border-b border-white/5 py-2 text-sm last:border-0">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1 whitespace-pre-wrap">{value}</span>
    </div>
  );
}

export function NoteSheet({
  note,
  onClose,
  onOpenDoc,
}: {
  note: DeliveryNote | null;
  onClose: () => void;
  onOpenDoc?: (fileName: string) => void;
}) {
  const qc = useQueryClient();
  const chime = useChime();

  const verify = useMutation({
    mutationFn: (status: string) => updateNoteStatus({ data: { row: note!.row, status } }),
    onSuccess: () => {
      chime();
      toast.success("הסטטוס עודכן בגיליון");
      void qc.invalidateQueries({ queryKey: ["notes"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Drawer open={!!note} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent dir="rtl" className="max-h-[92vh] border-white/10 bg-popover">
        {note ? (
          <div className="overflow-y-auto px-4 pb-8">
            <DrawerHeader className="px-0 text-right">
              <DrawerTitle className="flex flex-wrap items-center gap-2 text-base">
                תעודה {note.noteNumber}
                <StatusPill status={note.status} />
              </DrawerTitle>
              <p className="text-xs text-muted-foreground">
                {note.customer} · {note.datetime}
              </p>
            </DrawerHeader>

            <div className="mb-3 flex flex-wrap gap-2">
              {note.sourceFile ? (
                <Button size="sm" variant="secondary" className="gap-1" onClick={() => onOpenDoc?.(note.sourceFile)}>
                  <FileText className="size-4" /> צפה בתעודה
                </Button>
              ) : null}
              {note.address ? (
                <a href={wazeUrl(note.address)} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="secondary" className="gap-1">
                    <MapPin className="size-4" /> ניווט לאתר
                  </Button>
                </a>
              ) : null}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `תעודה ${note.noteNumber} · ${note.customer} · ${note.datetime}\n${note.goods}`,
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button size="sm" variant="secondary" className="gap-1">
                  <Share2 className="size-4" /> שתף בוואטסאפ
                </Button>
              </a>
            </div>

            <div className="glass-card p-3">
              <Row label="מספר הזמנה" value={note.orderNumber} />
              <Row label="מספר לקוח" value={note.customerId} />
              <Row label="כתובת / פרויקט" value={note.address} />
              <Row label="נהג / משאית" value={note.driver} />
              <Row label="פירוט סחורה" value={note.goods} />
              <Row label='סה"כ יחידות' value={note.totalUnits} />
            </div>

            <div className="glass-card mt-3 p-3">
              <p className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="size-3.5" /> זמני פריקה ומנוף
              </p>
              <Row label="פריקה / מנוף" value={note.craneTimes} />
              <Row label="המתנה" value={note.waitTimes} />
              <Row label="פקדון בלות" value={note.bigBagDeposit} />
              <Row label="פקדון משטחים" value={note.palletDeposit} />
              <Row label="החזרות וזיכויים" value={note.returns} />
              <Row label="אישור מחסנאי" value={note.warehouseApproval} />
              <Row label="הערות כתב יד" value={note.notes} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Button
                size="sm"
                className="gap-1"
                disabled={verify.isPending}
                onClick={() => verify.mutate("✅ חתום ומאושר מלא")}
              >
                <CheckCircle2 className="size-4" /> אימות
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={verify.isPending}
                onClick={() => verify.mutate("⚠️ חוסר מאושר")}
              >
                ⚠️ חוסר
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={verify.isPending}
                onClick={() => verify.mutate("❌ סטורנו")}
              >
                ❌ סטורנו
              </Button>
            </div>

            <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Truck className="size-3.5" /> קובץ מקור: {note.sourceFile || "—"}
            </p>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
