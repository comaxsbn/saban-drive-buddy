const GATEWAY = "https://connector-gateway.lovable.dev";

/** Short-lived server cache: Sheets allows ~60 reads/min per project. */
const TTL_MS = 45_000;
const cache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = (async () => {
    try {
      const value = await fn();
      cache.set(key, { at: Date.now(), value });
      return value;
    } catch (err) {
      // Serve slightly stale data rather than blowing up the page on a 429.
      if (hit) return hit.value as T;
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

function invalidate(spreadsheetId: string) {
  for (const key of cache.keys()) if (key.includes(spreadsheetId)) cache.delete(key);
}

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
  let lastText = "";
  let lastStatus = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${GATEWAY}/${service}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": conn,
        "Content-Type": "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : null,
    });
    if (res.ok) return res.json();
    lastStatus = res.status;
    lastText = await res.text();
    console.error(`Gateway ${service} failed [${res.status}]: ${lastText.slice(0, 300)}`);
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === 3) break;
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 700 * 2 ** attempt + Math.random() * 300,
    );
  }
  if (lastStatus === 429) {
    throw new Error("מכסת הקריאות של Google נוצלה זמנית. נסו שוב בעוד כדקה.");
  }
  throw new Error(`בקשה ל-Google נכשלה [${lastStatus}]: ${lastText.slice(0, 400)}`);
}

export async function readRange(spreadsheetId: string, range: string) {
  const data = await cached(`read:${spreadsheetId}:${range}`, async () => {
    return (await call(
      "google_sheets",
      `/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    )) as { values?: string[][] };
  });
  return data.values ?? [];
}

export async function appendRow(spreadsheetId: string, range: string, values: string[]) {
  const out = await call(
    "google_sheets",
    `/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: { values: [values] } },
  );
  invalidate(spreadsheetId);
  return out;
}

export async function writeRange(spreadsheetId: string, range: string, values: string[][]) {
  const out = await call(
    "google_sheets",
    `/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    { method: "PUT", body: { values } },
  );
  invalidate(spreadsheetId);
  return out;
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
  const data = await cached(`drive:${params.toString()}`, async () => {
    return (await call("google_drive", `/drive/v3/files?${params.toString()}`)) as {
      files?: unknown[];
    };
  });
  const files = (data.files ?? []) as {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    webViewLink?: string;
  }[];
  return files;
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