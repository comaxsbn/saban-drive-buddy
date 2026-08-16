import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getOrders = createServerFn({ method: "GET" }).handler(async () => {
  const { readRange } = await import("./saban.server");
  const { SHEETS, ORDERS_TAB } = await import("./saban-config");
  const rows = await readRange(SHEETS.orders, `${ORDERS_TAB}!A2:H`);
  return rows
    .map((r, i) => ({
      row: i + 2,
      receivedAt: r[0] ?? "",
      orderNumber: r[1] ?? "",
      customer: r[2] ?? "",
      warehouse: r[3] ?? "",
      address: r[4] ?? "",
      items: r[5] ?? "",
      bigBagDeposit: r[6] ?? "",
      palletDeposit: r[7] ?? "",
    }))
    .filter((o) => o.orderNumber || o.customer);
});

export const getNotes = createServerFn({ method: "GET" }).handler(async () => {
  const { readRange } = await import("./saban.server");
  const { SHEETS, NOTES_TAB } = await import("./saban-config");
  const rows = await readRange(SHEETS.notes, `${NOTES_TAB}!A2:S`);
  return rows
    .map((r, i) => ({
      row: i + 2,
      serial: r[0] ?? "",
      sourceFile: r[1] ?? "",
      noteNumber: r[2] ?? "",
      datetime: r[3] ?? "",
      customer: r[4] ?? "",
      customerId: r[5] ?? "",
      address: r[6] ?? "",
      driver: r[7] ?? "",
      orderNumber: r[8] ?? "",
      craneTimes: r[9] ?? "",
      waitTimes: r[10] ?? "",
      bigBagDeposit: r[11] ?? "",
      palletDeposit: r[12] ?? "",
      returns: r[13] ?? "",
      warehouseApproval: r[14] ?? "",
      goods: r[15] ?? "",
      totalUnits: r[16] ?? "",
      status: r[17] ?? "",
      notes: r[18] ?? "",
    }))
    .filter((n) => n.noteNumber || n.customer);
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        orderNumber: z.string().min(1),
        customer: z.string().min(1),
        warehouse: z.string().default(""),
        address: z.string().default(""),
        items: z.string().default(""),
        bigBagDeposit: z.string().default(""),
        palletDeposit: z.string().default(""),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { appendRow } = await import("./saban.server");
    const { SHEETS, ORDERS_TAB } = await import("./saban-config");
    const now = new Date().toLocaleString("he-IL");
    await appendRow(SHEETS.orders, `${ORDERS_TAB}!A:H`, [
      now,
      data.orderNumber,
      data.customer,
      data.warehouse,
      data.address,
      data.items,
      data.bigBagDeposit,
      data.palletDeposit,
    ]);
    return { ok: true };
  });

export const updateNoteStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ row: z.number().int().min(2), status: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { writeRange } = await import("./saban.server");
    const { SHEETS, NOTES_TAB } = await import("./saban-config");
    await writeRange(SHEETS.notes, `${NOTES_TAB}!R${data.row}:R${data.row}`, [[data.status]]);
    return { ok: true };
  });

export const getDriveFiles = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ folder: z.enum(["scans", "customers"]), search: z.string().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { listDrive } = await import("./saban.server");
    const { DRIVE } = await import("./saban-config");
    return listDrive(DRIVE[data.folder], data.search);
  });

export const askNoa = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        messages: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
          .min(1)
          .max(30),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { chatWithNoa, readRange } = await import("./saban.server");
    const { SHEETS, ORDERS_TAB, NOTES_TAB } = await import("./saban-config");
    // Same ranges as getOrders/getNotes so the server cache is shared (Sheets read quota).
    const [allOrders, allNotes] = await Promise.all([
      readRange(SHEETS.orders, `${ORDERS_TAB}!A2:H`),
      readRange(SHEETS.notes, `${NOTES_TAB}!A2:S`),
    ]);
    const orders = allOrders.slice(-40);
    const notes = allNotes.slice(-60);
    const context = [
      "### הזמנות אחרונות (תאריך | מספר | לקוח | מחסן | כתובת | פריטים | פקדון בלות | פקדון משטחים)",
      ...orders.map((r) => r.join(" | ")),
      "### תעודות משלוח (סידורי | קובץ | תעודה | תאריך | לקוח | מס' לקוח | כתובת | נהג | הזמנה | מנוף | המתנה | בלות | משטחים | החזרות | מחסנאי | סחורה | יחידות | סטטוס | הערות)",
      ...notes.map((r) => r.join(" | ")),
    ].join("\n");
    const html = await chatWithNoa(data.messages, context.slice(0, 60000));
    return { html };
  });