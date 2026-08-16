import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { NoaChat } from "@/components/NoaChat";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "נועה ❤️ — עוזרת ה-AI של סבן" },
      { name: "description", content: "צ׳אט חכם בעברית לניתוח הזמנות, תעודות משלוח ופקדונות בזמן אמת." },
      { property: "og:title", content: "נועה ❤️ — עוזרת ה-AI של סבן" },
      { property: "og:description", content: "שאלו על לקוחות, פקדונות ותעודות, או נרמלו הזמנה גולמית להזמנה מסודרת." },
    ],
  }),
  component: () => (
    <AppShell title="נועה ❤️" subtitle="SABAN OS AI Copilot">
      <NoaChat />
    </AppShell>
  ),
});
