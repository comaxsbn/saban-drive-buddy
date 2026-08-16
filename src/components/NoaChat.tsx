import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChime } from "@/hooks/use-chime";
import { askNoa } from "@/lib/saban.functions";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "מה מצב הפקדונות של ערוגת הבשם?",
  "הצג את התעודות האחרונות עם חוסרים",
  "נרמל הזמנה: 30 שק מלט, 2 חול שק גדול, 450 בלוק 10/20/40",
];

export function NoaChat() {
  const chime = useChime();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        '<p>שלום! אני <b>נועה</b> ❤️ — העוזרת החכמה של ח. סבן.<br/>אפשר לשאול אותי על הזמנות, תעודות משלוח, פקדונות ולקוחות, או לשלוח הודעת לקוח גולמית ואנרמל אותה להזמנה מסודרת.</p>',
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  const send = useMutation({
    mutationFn: (history: Msg[]) => askNoa({ data: { messages: history.slice(-12) } }),
    onSuccess: (res) => {
      chime();
      setMessages((m) => [...m, { role: "assistant", content: res.html || "לא הצלחתי לנסח תשובה." }]);
    },
    onError: (e: Error) =>
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `<p class="text-rose-300">${e.message}</p>` },
      ]),
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, send.isPending]);

  const submit = (text: string) => {
    const clean = text.trim();
    if (!clean || send.isPending) return;
    const next: Msg[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setInput("");
    send.mutate(next.filter((m, i) => !(i === 0 && m.role === "assistant")));
  };

  return (
    <div className="flex min-h-[calc(100vh-13rem)] flex-col">
      <div className="glass-card mb-3 flex items-center gap-3 p-3">
        <span className="animate-noa-pulse flex size-11 items-center justify-center rounded-full bg-[image:var(--gradient-noa)] text-lg">
          ❤️
        </span>
        <div>
          <p className="text-sm font-semibold">נועה ❤️</p>
          <p className="text-[11px] text-muted-foreground">SABAN OS AI · מחוברת לגיליונות החיים</p>
        </div>
        <span className="ms-auto rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] text-emerald-300">פעילה</span>
      </div>

      <div className="flex-1 space-y-3">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ms-auto max-w-[85%] rounded-2xl rounded-te-sm bg-primary/20 p-3 text-sm">
              {m.content}
            </div>
          ) : (
            <div
              key={i}
              className="noa-html glass-card max-w-[95%] space-y-2 p-3 text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: m.content }}
            />
          ),
        )}
        {send.isPending ? (
          <div className="glass-card flex w-fit items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> נועה מקלידה…
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-muted-foreground"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            dir="rtl"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            rows={1}
            placeholder="כתבו לנועה…"
            className="min-h-11 resize-none border-white/10 bg-white/5"
          />
          <Button size="icon" onClick={() => submit(input)} disabled={send.isPending} aria-label="שליחה">
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
