import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCw, ZoomIn, ZoomOut, Download, ExternalLink } from "lucide-react";

export type DocTarget = { id: string; name: string } | null;

export function DocViewer({ doc, onClose }: { doc: DocTarget; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  if (!doc) return null;

  const preview = `https://drive.google.com/file/d/${doc.id}/preview`;
  const download = `https://drive.google.com/uc?export=download&id=${doc.id}`;

  return (
    <Dialog
      open={!!doc}
      onOpenChange={(o) => {
        if (!o) {
          setZoom(1);
          setRotation(0);
          onClose();
        }
      }}
    >
      <DialogContent dir="rtl" className="max-w-[95vw] border-white/10 bg-popover p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-white/10 p-4 text-right">
          <DialogTitle className="truncate text-base">{doc.name}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 px-4">
          <Button size="icon" variant="secondary" onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}>
            <ZoomIn className="size-4" />
          </Button>
          <Button size="icon" variant="secondary" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
            <ZoomOut className="size-4" />
          </Button>
          <Button size="icon" variant="secondary" onClick={() => setRotation((r) => (r + 90) % 360)}>
            <RotateCw className="size-4" />
          </Button>
          <a href={download} target="_blank" rel="noreferrer" className="ms-auto">
            <Button size="sm" variant="secondary" className="gap-1">
              <Download className="size-4" /> הורדה
            </Button>
          </a>
          <a href={`https://drive.google.com/file/d/${doc.id}/view`} target="_blank" rel="noreferrer">
            <Button size="sm" variant="secondary" className="gap-1">
              <ExternalLink className="size-4" /> Drive
            </Button>
          </a>
        </div>
        <div className="h-[65vh] overflow-auto rounded-b-xl bg-black/40 p-2">
          <iframe
            title={doc.name}
            src={preview}
            className="h-full w-full origin-center rounded-lg border-0 transition-transform"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}