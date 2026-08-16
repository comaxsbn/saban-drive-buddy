import { statusTone, type DeliveryNote, type Order } from "./saban-config";

export const DISPATCH_STATUSES = [
  { id: "pending", label: "ממתינה לליקוט", emoji: "🟡", cls: "bg-amber-500/15 text-amber-300 border-amber-400/25" },
  { id: "picking", label: "בהכנה / בליקוט", emoji: "🟠", cls: "bg-orange-500/15 text-orange-300 border-orange-400/25" },
  { id: "transit", label: "בדרך / בשינוע", emoji: "🔵", cls: "bg-sky-500/15 text-sky-300 border-sky-400/25" },
  { id: "delivered", label: "סופק / ממתין לתעודה", emoji: "🟢", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-400/25" },
] as const;

export type DispatchStatusId = (typeof DISPATCH_STATUSES)[number]["id"];

export const DRIVERS = [
  { id: "hachmat", name: "חכמת", vehicle: "משאית מרצדס מנוף 615-41-002", short: "מנוף", emoji: "🏗️", kind: "crane" },
  { id: "naim", name: "נעים", vehicle: "מוביל חיצוני - מנוף מחליף", short: "מנוף מחליף", emoji: "🏗️", kind: "crane" },
  { id: "ali", name: "עלי", vehicle: "משאית חלוקה", short: "משאית חלוקה", emoji: "🚛", kind: "truck" },
  { id: "external", name: "מוביל חיצוני / איסוף עצמי", vehicle: "מוביל חיצוני", short: "חיצוני", emoji: "🚚", kind: "crane" },
] as const;

export type DriverId = (typeof DRIVERS)[number]["id"];

export const WAREHOUSES = [
  { id: "harash", label: "מחסן 4 החרש", short: "החרש" },
  { id: "talmid", label: "מחסן 1 התלמיד", short: "התלמיד" },
] as const;

export type WarehouseId = (typeof WAREHOUSES)[number]["id"];

export type DispatchMeta = {
  status: DispatchStatusId;
  driver: DriverId | "";
  warehouse: WarehouseId | "";
  time: string;
};

export const emptyMeta = (o: Order): DispatchMeta => ({
  status: "pending",
  driver: "",
  warehouse: /תלמיד|התלמיד|1/.test(o.warehouse) && !/החרש/.test(o.warehouse) ? "talmid" : /החרש|4/.test(o.warehouse) ? "harash" : "",
  time: "",
});

const KEY = "saban.dispatch.v1";

export function loadMeta(): Record<string, DispatchMeta> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, DispatchMeta>;
  } catch {
    return {};
  }
}

export function saveMeta(all: Record<string, DispatchMeta>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(all));
}

export const orderKey = (o: Order) => `${o.orderNumber || "?"}#${o.row}`;

/** Orders with no approved (ok-tone) delivery note attached. */
export function openOrders(orders: Order[], notes: DeliveryNote[]): Order[] {
  const closed = new Set(
    notes
      .filter((n) => statusTone(n.status) === "ok")
      .map((n) => (n.orderNumber || "").trim())
      .filter(Boolean),
  );
  return orders.filter((o) => !closed.has((o.orderNumber || "").trim()));
}

const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function buildMorningBrief(
  rows: { order: Order; meta: DispatchMeta }[],
  now = new Date(),
): string {
  const day = HE_DAYS[now.getDay()];
  const date = now.toLocaleDateString("he-IL");
  const lines: string[] = [`📅 *דוח בוקר של יום ${day} - ח. סבן | ${date}*`, ""];

  const wh = (id: string) => WAREHOUSES.find((w) => w.id === id)?.label ?? "ללא מחסן";

  for (const d of DRIVERS) {
    const mine = rows.filter((r) => r.meta.driver === d.id);
    if (!mine.length) continue;
    mine.sort((a, b) => (a.meta.time || "99:99").localeCompare(b.meta.time || "99:99"));
    lines.push(`👤 *${d.name}* (${d.vehicle}):`);
    let prevTime = "";
    for (const r of mine) {
      const t = r.meta.time || "ללא שעה";
      const label = t !== "ללא שעה" && t === prevTime ? "ביחד" : t;
      prevTime = t;
      lines.push(`*${label}* | 📦 ${r.order.orderNumber || "-"} - *${r.order.customer} | ${wh(r.meta.warehouse)}*`);
    }
    lines.push("");
  }

  const unassigned = rows.filter((r) => !r.meta.driver);
  if (unassigned.length) {
    lines.push("👤 *ללא שיוך נהג*:");
    for (const r of unassigned) {
      lines.push(`*${r.meta.time || "ללא שעה"}* | 📦 ${r.order.orderNumber || "-"} - *${r.order.customer} | ${wh(r.meta.warehouse)}*`);
    }
    lines.push("");
  }

  const harash = rows.filter((r) => r.meta.warehouse === "harash").length;
  const talmid = rows.filter((r) => r.meta.warehouse === "talmid").length;
  const crane = rows.filter((r) => DRIVERS.find((d) => d.id === r.meta.driver)?.kind === "crane").length;
  const truck = rows.filter((r) => DRIVERS.find((d) => d.id === r.meta.driver)?.kind === "truck").length;

  lines.push("📊 *סיכום סידור* :", `*סה"כ הזמנות: ${rows.length}*`, "");
  lines.push(`📦 *מהמחסנים* : *החרש (${harash}) | התלמיד (${talmid})*`);
  lines.push(`🚛 *סוגי הובלה* : *מנוף / מוביל חיצוני (${crane}) | משאית (${truck})*`);

  return lines.join("\n");
}

export const whatsappUrl = (text: string) => `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
