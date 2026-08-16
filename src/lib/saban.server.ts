const GATEWAY = "https://connector-gateway.lovable.dev";

function keys(service: "google_sheets" | "google_drive") {
  const lovable = process.env["LOVABLE_API_KEY"];
  const conn =
    service === "google_sheets"
      ? process.env["GOOGLE_SHEETS_API_KEY"]
      : process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovable || !conn) throw new Error("חסר חיבור ל-Google (" + service + ")");
  return { lovable, conn };
}

async function call(
  service: "google_sheets" | "google_drive",
  path: string,
  init: { method?: string; body?: unknown } = {},
) {
  const { lovable, conn } = keys(service);
  const res = await fetch(`${GATEWAY}/${service}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": conn,
      "Content-Type": "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : null,
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Gateway ${service} failed [${res.status}]: ${text}`);
    throw new Error(`בקשה ל-Google נכשלה [${res.status}]: ${text.slice(0, 400)}`);
  }
  return res.json();
}

export async function readRange(spreadsheetId: string, range: string) {
  const data = (await call(
    "google_sheets",
    `/v4/spreadsheets/${spreadsheetId}/values/${range}`,
  )) as { values?: string[][] };
  return data.values ?? [];
}

export async function appendRow(spreadsheetId: string, range: string, values: string[]) {
  return call(
    "google_sheets",
    `/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: { values: [values] } },
  );
}

export async function writeRange(spreadsheetId: string, range: string, values: string[][]) {
  return call(
    "google_sheets",
    `/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    { method: "PUT", body: { values } },
  );
}

export async function listDrive(folderId: string, search?: string) {
  const clauses = [`'${folderId}' in parents`, "trashed = false"];
  if (search) clauses.push(`name contains '${search.replace(/'/g, "")}'`);
  const params = new URLSearchParams({
    q: clauses.join(" and "),
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    pageSize: "100",
    orderBy: "modifiedTime desc",
  });
  const data = (await call("google_drive", `/drive/v3/files?${params.toString()}`)) as {
    files?: unknown[];
  };
  return (data.files ?? []) as {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    webViewLink?: string;
  }[];
}

export async function chatWithNoa(
  messages: { role: "user" | "assistant"; content: string }[],
  context: string,
) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("חסר מפתח AI");
  const system = `את "נועה ❤️", עוזרת AI של חברת ח. סבן חומרי בניין (1994) בע"מ.
דברי עברית מקצועית, חמה ותמציתית.

החזירי תשובה כ-HTML בלבד (ללא markdown, ללא \`\`\`), בעזרת מחלקות Tailwind בלבד:
- טבלאות פריטים: <table class="w-full text-sm"><thead class="text-white/50">…
- תגיות מק"ט: <span class="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs">10002</span>
- גלולות סטטוס: <span class="rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-xs">✅ חתום</span> / bg-amber-500/20 text-amber-300 / bg-rose-500/20 text-rose-300
- אקורדיון לתעודות ארוכות: <details class="rounded-xl border border-white/10 bg-white/5 p-3"><summary>…</summary>…</details>
- כפתורי פעולה: <a class="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs text-amber-200" href="…" target="_blank">📄 צפה בתעודה</a>

ידע מוצרים: מלט אפור 25 ק"ג (10002), חול שק (11500), חול שק גדול (11501), סומסום שק (11510), סומסום שק גדול (11511), גבס לבן (111260), ירוק (112200), כחול (114200), פרופילי מתכת 0.6, בלוק בטון 10/20/40 (12010) ו-20/20/40, דבקים כרמית 109/116/181, סיקה 235/לסטיק, פקדונות: שק גדול (60002), משטח סבן (60060), משטח בלוקים (60006).

נרמול הזמנות: כשמקבלים הודעת לקוח גולמית, החזירי טבלה מסודרת של פריטים, מק"טים וכמויות + פקדונות מתאימים.

נתונים חיים מהמערכת (השתמשי בהם לתשובות עובדתיות):
${context}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`AI gateway failed [${res.status}]: ${text}`);
    if (res.status === 429) throw new Error("יותר מדי בקשות, נסו שוב בעוד רגע.");
    if (res.status === 402) throw new Error("נגמר תקציב ה-AI בסביבת העבודה.");
    throw new Error("נועה לא זמינה כרגע.");
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return (data.choices?.[0]?.message?.content ?? "").replace(/```html|```/g, "").trim();
}