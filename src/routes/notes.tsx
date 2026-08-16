import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { NoteSheet } from "@/components/NoteSheet";
import { DocViewer, type DocTarget } from "@/components/DocViewer";
import { Input } from "@/components/ui/input";
import { notesQuery, driveQuery } from "@/lib/queries";
import type { DeliveryNote } from "@/lib/saban-config";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "תעודות משלוח — SABAN OS Deluxe" },
      { name: "description", content: "כל תעודות המשלוח החתומות, זמני מנוף, פקדונות והערות כתב יד." },
      { property: "og:title", content: "תעודות משלוח — SABAN OS Deluxe" },
      { property: "og:description", content: "היסטוריית תעודות משלוח מלאה עם סטטוסי אימות וסריקות מקור." },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const notes = useQuery(notesQuery);
  const scans = useQuery(driveQuery("scans"));
  const [q, setQ] = useState("");
  const [note, setNote] = useState<DeliveryNote | null>(null);
  const [doc, setDoc] = useState<DocTarget>(null);

  const list = (notes.data ?? []).filter(
    (n) => !q.trim() || [n.customer, n.noteNumber, n.orderNumber, n.driver, n.address].join(" ").includes(q.trim()),
  );

  return (
    <AppShell title="תעודות משלוח" subtitle={`${notes.data?.length ?? 0} תעודות מנותחות`}>
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          dir="rtl"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש תעודה…"
          className="h-12 rounded-2xl border-white/10 bg-white/5 pr-10"
        />
      </div>
      {notes.isLoading ? <Loader2 className="mx-auto my-8 size-5 animate-spin text-primary" /> : null}
      <div className="space-y-2">
        {list.map((n) => (
          <button
            key={n.row}
            onClick={() => setNote(n)}
            className="glass-card w-full p-3 text-right transition-transform active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{n.customer}</span>
              <span className="text-[11px] text-muted-foreground">{n.datetime}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.goods}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill status={n.status} />
              <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px]">#{n.noteNumber}</span>
              <span className="text-[10px] text-muted-foreground">{n.driver}</span>
            </div>
          </button>
        ))}
      </div>
      <NoteSheet
        note={note}
        onClose={() => setNote(null)}
        onOpenDoc={(name) => {
          const f = (scans.data ?? []).find((x) => x.name === name);
          setDoc(f ? { id: f.id, name: f.name } : null);
        }}
      />
      <DocViewer doc={doc} onClose={() => setDoc(null)} />
    </AppShell>
  );
}
